-- =====================================================================
-- FASE 5.5 — S7-01 (revisão do módulo de Igrejas, 26/11/2026): quem é da secretaria (ou da presidência) e preside a
-- igreja não confere o próprio documento, nem com a igreja bloqueada.
--
-- O envio decidia o "já entra conferido" pela lista das igrejas de que a pessoa cuida, e a igreja bloqueada (mais de
-- 30 dias suspensa sem o documento) sai dessa lista: o documento entrava conferido por quem o mandou, e a igreja
-- voltava a regular. Agora o "preside" é o vínculo de pastor presidente, bloqueada ou não. O resto da função é o de
-- 19/11 (20261119140000_regularizacao_historico.sql).
-- =====================================================================

create or replace function interno.enviar_documento_igreja(p_igreja_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_igreja public.igrejas;
  v_tipo public.tipo_documento_igreja;
  v_partes jsonb := p_dados -> 'partes';
  v_diretoria jsonb := p_dados -> 'diretoria';
  v_parte jsonb;
  v_membro jsonb;
  v_caminho text;
  v_tamanho bigint;
  v_ordem integer := 0;
  v_de date;
  v_ate date;
  v_inicio date;
  v_fim date;
  v_pessoa uuid;
  v_natureza text := nullif(p_dados ->> 'natureza', '');
  v_muda boolean;
  v_confere boolean;
  v_id uuid;
begin
  if v_eu is null or not interno.cuido_da_igreja(p_igreja_id) then
    raise exception 'Só o pastor presidente da igreja, a secretaria ou a presidência mandam os documentos dela.' using errcode = '42501';
  end if;
  select * into v_igreja from public.igrejas where id = p_igreja_id and arquivado_em is null;
  if not found then
    raise exception 'Igreja não encontrada.' using errcode = 'P0001';
  end if;
  -- a secretaria e a presidência (que não presidem esta igreja) mandam já conferido, e podem registrar o histórico.
  -- "Presidir" é o vínculo de pastor presidente, com a igreja bloqueada ou não (S7-01), e a igreja em análise que
  -- ela mesma cadastrou: ninguém confere o documento que mandou.
  v_confere := (select interno.tenho_perfil('secretaria', 'presidencia'))
               and not exists (select 1 from public.vinculos_igreja v
                               where v.pessoa_id = v_eu and v.igreja_id = p_igreja_id and v.pastor_presidente
                                 and v.fim is null and v.arquivado_em is null)
               and not (v_igreja.cadastro = 'em_analise' and v_igreja.cadastrada_por is not distinct from v_eu);
  begin
    v_tipo := nullif(p_dados ->> 'tipo', '')::public.tipo_documento_igreja;
    v_de := nullif(p_dados ->> 'valido_de', '')::date;
    v_ate := nullif(p_dados ->> 'valido_ate', '')::date;
    v_muda := coalesce((p_dados ->> 'muda_natureza')::boolean, false);
  exception when others then
    raise exception 'O tipo do documento ou as datas estão num formato inválido.' using errcode = 'P0001';
  end;
  if v_tipo is null then
    raise exception 'Escolha o tipo do documento.' using errcode = 'P0001';
  end if;
  if v_tipo = 'outro' and coalesce(trim(p_dados ->> 'descricao'), '') = '' then
    raise exception 'Diga que documento é este.' using errcode = 'P0001';
  end if;

  -- as partes: de 1 a 20 arquivos na pasta da igreja, até 25 MB cada
  if v_partes is null or jsonb_typeof(v_partes) <> 'array' or jsonb_array_length(v_partes) not between 1 and 20 then
    raise exception 'Mande de 1 a 20 arquivos (partes) do documento.' using errcode = 'P0001';
  end if;
  for v_parte in select * from jsonb_array_elements(v_partes) loop
    v_caminho := v_parte ->> 'caminho';
    if v_caminho is null or v_caminho !~ ('^' || p_igreja_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$') then
      raise exception 'Cada arquivo precisa estar na pasta da igreja.' using errcode = 'P0001';
    end if;
    begin
      v_tamanho := nullif(v_parte ->> 'tamanho', '')::bigint;
    exception when others then
      v_tamanho := -1;
    end;
    if v_tamanho is not null and (v_tamanho < 1 or v_tamanho > 26214400) then
      raise exception 'Cada arquivo pode ter até 25 MB. Mande o documento em partes.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.igreja_documento_partes x where x.arquivo_caminho = v_caminho) then
      raise exception 'Este arquivo já foi usado em outro documento.' using errcode = 'P0001';
    end if;
  end loop;
  if (select count(distinct x ->> 'caminho') from jsonb_array_elements(v_partes) x) <> jsonb_array_length(v_partes) then
    raise exception 'O mesmo arquivo foi mandado duas vezes.' using errcode = 'P0001';
  end if;

  -- a validade de cada tipo
  if v_tipo = 'alvara' then
    if v_ate is null then
      raise exception 'Informe até quando o alvará vale.' using errcode = 'P0001';
    end if;
    v_de := coalesce(v_de, make_date(extract(year from v_ate)::integer, 1, 1));
    if v_ate < v_de then
      raise exception 'A validade do alvará termina depois de começar.' using errcode = 'P0001';
    end if;
    -- o vencido só entra pela secretaria, para o histórico (pelo pastor, só o que vale agora ou o do próximo ano)
    if v_ate < current_date and not v_confere then
      raise exception 'Este alvará já venceu. Mande o que vale agora (ou o do próximo ano).' using errcode = 'P0001';
    end if;
    if v_ate - v_de > 1100 then
      raise exception 'O alvará vale no máximo 3 anos. Confira as datas.' using errcode = 'P0001';
    end if;
  elsif v_tipo = 'ata_diretoria' then
    if v_diretoria is null or jsonb_typeof(v_diretoria) <> 'array' or jsonb_array_length(v_diretoria) not between 1 and 30 then
      raise exception 'Informe a diretoria da ata (de 1 a 30 cargos), com o mandato de cada cargo.' using errcode = 'P0001';
    end if;
    v_de := null;
    v_ate := null;
    for v_membro in select * from jsonb_array_elements(v_diretoria) loop
      begin
        v_inicio := (v_membro ->> 'inicio')::date;
        v_fim := (v_membro ->> 'fim')::date;
        v_pessoa := nullif(v_membro ->> 'pessoa_id', '')::uuid;
      exception when others then
        raise exception 'As datas do mandato (ou o ministro) estão num formato inválido.' using errcode = 'P0001';
      end;
      if length(trim(coalesce(v_membro ->> 'cargo', ''))) < 2 then
        raise exception 'Cada linha da diretoria precisa do nome do cargo.' using errcode = 'P0001';
      end if;
      if v_inicio is null or v_fim is null then
        raise exception 'Cada cargo precisa da posse e do fim do mandato: não existe mandato sem prazo nem vitalício.' using errcode = 'P0001';
      end if;
      if v_fim <= v_inicio then
        raise exception 'O fim do mandato vem depois da posse.' using errcode = 'P0001';
      end if;
      if v_fim > (v_inicio + interval '20 years')::date then
        raise exception 'Mandato de mais de 20 anos não é aceito: confira no estatuto e na ata o tempo de cada cargo.' using errcode = 'P0001';
      end if;
      if v_pessoa is not null and not interno.associado_ativo(v_pessoa) then
        raise exception 'O cargo ligado a um ministro precisa ser de um ministro associado ativo.' using errcode = 'P0001';
      end if;
      if v_pessoa is null and length(trim(coalesce(v_membro ->> 'nome', ''))) < 5 then
        raise exception 'Escreva o nome completo de quem ocupa cada cargo (ou escolha um ministro associado).' using errcode = 'P0001';
      end if;
      -- a ata vale do primeiro dia da diretoria até o MENOR mandato
      v_de := least(v_de, v_inicio);
      v_ate := least(v_ate, v_fim);
    end loop;
    if v_ate < current_date and not v_confere then
      raise exception 'O mandato desta diretoria já terminou. Mande a ata da diretoria que está valendo (ou a da próxima).' using errcode = 'P0001';
    end if;
  else
    v_de := null;
    v_ate := null;
  end if;
  if v_tipo = 'cartao_cnpj' then
    if v_natureza is null or v_natureza not in ('organizacao_religiosa', 'associacao_privada') then
      raise exception 'Diga a natureza jurídica que está no Cartão CNPJ.' using errcode = 'P0001';
    end if;
  else
    v_natureza := null;
  end if;
  if v_tipo <> 'ata_diretoria' then
    v_muda := false;
  end if;

  -- o que esperava a conferência, do mesmo tipo e do mesmo período, é trocado pelo novo (e fica guardado)
  if v_tipo <> 'outro' then
    update public.igreja_documentos set arquivado_em = now()
    where igreja_id = p_igreja_id and tipo = v_tipo and situacao = 'pendente' and arquivado_em is null
      and coalesce(valido_de, date '1900-01-01') = coalesce(v_de, date '1900-01-01');
  end if;

  insert into public.igreja_documentos (igreja_id, tipo, descricao, arquivo_caminho, enviado_por, valido_de, valido_ate,
                                        natureza, muda_natureza, situacao, conferido_por, conferido_em)
  values (p_igreja_id, v_tipo, left(nullif(trim(p_dados ->> 'descricao'), ''), 300), v_partes -> 0 ->> 'caminho', v_eu,
          v_de, v_ate, v_natureza, v_muda,
          (case when v_confere then 'conferido' else 'pendente' end)::public.situacao_documento_igreja,
          case when v_confere then v_eu end, case when v_confere then now() end)
  returning id into v_id;

  for v_parte in select * from jsonb_array_elements(v_partes) loop
    v_ordem := v_ordem + 1;
    insert into public.igreja_documento_partes (documento_id, ordem, arquivo_caminho, nome_arquivo, tamanho)
    values (v_id, v_ordem, v_parte ->> 'caminho', left(nullif(trim(v_parte ->> 'nome'), ''), 200),
            nullif(v_parte ->> 'tamanho', '')::bigint);
  end loop;

  if v_tipo = 'ata_diretoria' then
    v_ordem := 0;
    for v_membro in select * from jsonb_array_elements(v_diretoria) loop
      v_ordem := v_ordem + 1;
      v_pessoa := nullif(v_membro ->> 'pessoa_id', '')::uuid;
      insert into public.igreja_diretoria (igreja_id, documento_id, ordem, cargo, pessoa_id, nome, inicio, fim)
      values (p_igreja_id, v_id, v_ordem, left(trim(v_membro ->> 'cargo'), 80), v_pessoa,
              left(coalesce((select p.nome from public.pessoas p where p.id = v_pessoa), trim(v_membro ->> 'nome')), 200),
              (v_membro ->> 'inicio')::date, (v_membro ->> 'fim')::date);
    end loop;
    -- a igreja em análise mandou a diretoria de novo: o item volta para a secretaria
    if v_igreja.cadastro = 'em_analise' then
      update public.igreja_analise_itens set situacao = 'analise', motivo = null, decidido_por = null, decidido_em = null
      where igreja_id = p_igreja_id and item = 'diretoria' and arquivado_em is null and situacao <> 'analise';
    end if;
  end if;

  if v_confere then
    perform interno.efeitos_do_documento(v_id);
  end if;
  return v_id;
end;
$$;
