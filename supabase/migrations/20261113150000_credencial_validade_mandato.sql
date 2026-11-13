-- =====================================================================
-- Fase 3.3 (ajuste de 13/11/2026) — Validade da credencial por mandato
--
-- Decisão do administrador técnico (13/11/2026), revendo a seção 4.5 do PROJETO.md:
--   * a credencial traz a validade: o fim do mandato da diretoria em curso;
--   * a DIGITAL passa sozinha para o mandato seguinte (na posse, o sistema emite outra, com novo QR Code);
--   * a IMPRESSA vale até a data que está nela: depois da posse da nova diretoria, imprime-se de novo.
--     O QR Code da impressa antiga mostra "vencida" depois dessa data.
--
-- Duas ações diferentes em Configurações → Credencial (para um erro de digitação não estragar nada):
--   * CORRIGIR a data do mandato em curso: todas as credenciais do mandato acompanham;
--   * REGISTRAR O NOVO MANDATO (posse): a credencial atual de cada associado fica registrada, valendo
--     até o fim do mandato que terminou, e nasce outra para o novo mandato.
-- =====================================================================

alter table public.credenciais
  add column valida_ate  date,
  add column renovada_em timestamptz;
comment on column public.credenciais.valida_ate is
  'Vazia = acompanha o fim do mandato em curso (Configurações → Credencial). Preenchida na posse de uma nova diretoria: o fim do mandato que terminou (a impressa vale até essa data).';
comment on column public.credenciais.renovada_em is
  'Quando foi trocada pela credencial do mandato seguinte (continua valendo até valida_ate).';

-- A credencial ATUAL de cada pessoa: nem substituída (perda) nem renovada (novo mandato)
drop index public.credenciais_uma_ativa;
create unique index credenciais_uma_atual on public.credenciais (pessoa_id)
  where substituida_em is null and renovada_em is null and arquivado_em is null;


-- ---------------------------------------------------------------------
-- 1. Código da credencial atual (cria na primeira vez). Uma trava por pessoa evita duas ao mesmo tempo.
-- ---------------------------------------------------------------------
create or replace function interno.codigo_credencial(p_pessoa_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  perform pg_advisory_xact_lock(hashtext('comep: credencial ' || p_pessoa_id::text));
  select codigo into v_codigo from public.credenciais
  where pessoa_id = p_pessoa_id and substituida_em is null and renovada_em is null and arquivado_em is null;
  if v_codigo is null then
    v_codigo := replace(gen_random_uuid()::text, '-', '');
    insert into public.credenciais (pessoa_id, codigo) values (p_pessoa_id, v_codigo);
  end if;
  return v_codigo;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Dados para mostrar e imprimir: agora com a validade e a data de emissão
-- ---------------------------------------------------------------------
create or replace function interno.dados_credenciais(p_pessoas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_pessoa uuid;
  v_lista jsonb := '[]'::jsonb;
  v_item jsonb;
  v_codigo text;
  v_credencial public.credenciais;
  v_config public.config_credencial;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver a credencial.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_pessoas, 1), 0) = 0 or array_length(p_pessoas, 1) > 500 then
    raise exception 'Escolha de 1 a 500 credenciais.' using errcode = 'P0001';
  end if;
  foreach v_pessoa in array p_pessoas loop
    if v_pessoa <> v_eu and not v_diretoria then
      raise exception 'Só a secretaria ou a presidência veem a credencial de outra pessoa.' using errcode = '42501';
    end if;
  end loop;
  select * into v_config from public.config_credencial where id;

  foreach v_pessoa in array p_pessoas loop
    select jsonb_build_object(
      'pessoa_id', v.pessoa_id,
      'nome', v.nome,
      'cpf', p.cpf,
      'nome_pai', p.nome_pai,
      'nome_mae', p.nome_mae,
      'numero_registro', v.numero_registro,
      'admitido_em', v.admitido_em,
      'titulo', v.titulo,
      'funcao', coalesce(v.funcao, case when v.pastor_presidente then 'Pastor presidente' end),
      'igreja', v.igreja,
      'igreja_sigla', i.sigla,
      'igreja_cnpj', i.cnpj,
      'foto_caminho', p.foto_caminho,
      'em_dia', interno.esta_em_dia(v.pessoa_id),
      'jubilado', v.jubilado,
      'pendencias', coalesce(pc.pendencias, '{}'::text[])
    )
    into v_item
    from public.vw_associados v
    join public.associados a on a.id = v.id
    join public.pessoas p on p.id = v.pessoa_id
    left join public.igrejas i on i.id = v.igreja_id
    left join public.vw_pendencias_credencial pc on pc.associado_id = v.id
    where v.pessoa_id = v_pessoa and v.situacao = 'ativo' and a.arquivado_em is null;
    if v_item is not null then
      -- a credencial (código do QR) é criada na primeira vez
      v_codigo := interno.codigo_credencial(v_pessoa);
      select * into v_credencial from public.credenciais where codigo = v_codigo;
      v_item := v_item || jsonb_build_object(
        'codigo', v_credencial.codigo,
        'foto_publica', v_credencial.foto_publica,
        'valida_ate', coalesce(v_credencial.valida_ate, v_config.fim_mandato),
        'emitida_em', v_credencial.criado_em
      );
      v_lista := v_lista || jsonb_build_array(v_item);
    end if;
  end loop;

  return jsonb_build_object(
    'fim_mandato', v_config.fim_mandato,
    'texto_verso', v_config.texto_verso,
    'credenciais', v_lista
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Perda ou roubo: TODAS as credenciais da pessoa (a atual e as de mandatos anteriores que ainda valem)
--    passam a dizer "substituída"; nasce outra.
-- ---------------------------------------------------------------------
create or replace function interno.substituir_credencial(p_pessoa_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência emitem uma nova credencial.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo (ex.: perda, roubo, dados mudaram).' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('comep: credencial ' || p_pessoa_id::text));
  update public.credenciais
  set substituida_em = now(), motivo_substituicao = trim(p_motivo)
  where pessoa_id = p_pessoa_id and substituida_em is null and arquivado_em is null;
  return interno.codigo_credencial(p_pessoa_id);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Foto pública: só para a credencial atual
-- ---------------------------------------------------------------------
create or replace function interno.registrar_foto_publica(p_codigo text, p_caminho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
begin
  select * into v_credencial from public.credenciais
  where codigo = p_codigo and substituida_em is null and renovada_em is null and arquivado_em is null for update;
  if not found then
    raise exception 'Credencial não encontrada.' using errcode = 'P0001';
  end if;
  if not (v_credencial.pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia'))) then
    raise exception 'Sem permissão para esta credencial.' using errcode = '42501';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_codigo
     or not exists (select 1 from storage.objects where bucket_id = 'credenciais' and name = p_caminho) then
    raise exception 'A foto precisa estar na pasta desta credencial.' using errcode = 'P0001';
  end if;
  update public.credenciais set foto_publica = p_caminho where id = v_credencial.id;
end;
$$;

drop policy "credenciais: o dono ou a secretaria enviam a foto da credencial" on storage.objects;
create policy "credenciais: o dono ou a secretaria enviam a foto da credencial"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'credenciais'
    and exists (
      select 1 from public.credenciais c
      where c.codigo = (storage.foldername(name))[1]
        and c.substituida_em is null and c.renovada_em is null and c.arquivado_em is null
        and (c.pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')))
    )
  );


-- ---------------------------------------------------------------------
-- 5. Validação pública: cada credencial vale até a SUA data
--    (a atual acompanha o mandato em curso; a de mandato anterior, a data com que foi renovada)
-- ---------------------------------------------------------------------
create or replace function interno.validar_credencial(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
  v_ate date;
  v_dados jsonb;
begin
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('situacao', 'inexistente', 'consultado_em', now());
  end if;
  select * into v_credencial from public.credenciais where codigo = p_codigo and arquivado_em is null;
  if not found then
    return jsonb_build_object('situacao', 'inexistente', 'consultado_em', now());
  end if;
  if v_credencial.substituida_em is not null then
    return jsonb_build_object('situacao', 'substituida', 'substituida_em', v_credencial.substituida_em, 'consultado_em', now());
  end if;

  select jsonb_build_object(
    'nome', v.nome,
    'titulo', v.titulo,
    'numero_registro', v.numero_registro,
    'igreja', coalesce(i.sigla, v.igreja),
    'foto_publica', v_credencial.foto_publica,
    'em_dia', interno.esta_em_dia(v.pessoa_id),
    'ativo', (v.situacao = 'ativo' and a.arquivado_em is null)
  )
  into v_dados
  from public.vw_associados v
  join public.associados a on a.id = v.id
  left join public.igrejas i on i.id = v.igreja_id
  where v.pessoa_id = v_credencial.pessoa_id
  order by (v.situacao = 'ativo' and a.arquivado_em is null) desc
  limit 1;

  if v_dados is null or not (v_dados ->> 'ativo')::boolean then
    return jsonb_build_object('situacao', 'inativa', 'nome', v_dados ->> 'nome', 'consultado_em', now());
  end if;
  v_ate := coalesce(v_credencial.valida_ate, (select fim_mandato from public.config_credencial where id));
  return (v_dados - 'ativo') || jsonb_build_object(
    'situacao', case when v_ate is not null and v_ate < current_date then 'vencida' else 'valida' end,
    'valida_ate', v_ate,
    'renovada', v_credencial.renovada_em is not null,
    'consultado_em', now()
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Posse da nova diretoria: registra o novo mandato e renova as credenciais
-- ---------------------------------------------------------------------
create function interno.registrar_novo_mandato(p_fim date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.config_credencial;
  v_atual public.credenciais;
  v_renovadas integer := 0;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram o novo mandato.' using errcode = '42501';
  end if;
  select * into v_config from public.config_credencial where id for update;
  if v_config.fim_mandato is null then
    raise exception 'Informe primeiro o fim do mandato em curso (Configurações → Credencial).' using errcode = 'P0001';
  end if;
  if p_fim is null or p_fim <= v_config.fim_mandato or p_fim <= current_date then
    raise exception 'O fim do novo mandato precisa ser depois do fim do mandato atual e depois de hoje.' using errcode = 'P0001';
  end if;

  for v_atual in
    select * from public.credenciais
    where substituida_em is null and renovada_em is null and arquivado_em is null
    for update
  loop
    perform pg_advisory_xact_lock(hashtext('comep: credencial ' || v_atual.pessoa_id::text));
    -- a antiga (e a impressa dela) vale até o fim do mandato que terminou
    update public.credenciais
    set renovada_em = now(), valida_ate = v_config.fim_mandato
    where id = v_atual.id;
    -- a nova acompanha o novo mandato; a foto pública continua a mesma até ser publicada de novo
    insert into public.credenciais (pessoa_id, codigo, foto_publica)
    values (v_atual.pessoa_id, replace(gen_random_uuid()::text, '-', ''), v_atual.foto_publica);
    v_renovadas := v_renovadas + 1;
  end loop;

  update public.config_credencial set fim_mandato = p_fim where id;
  return v_renovadas;
end;
$$;

create function public.registrar_novo_mandato(p_fim date)
returns integer language sql security invoker set search_path = '' as $$
  select interno.registrar_novo_mandato(p_fim);
$$;

revoke all on function interno.registrar_novo_mandato(date) from public;
grant execute on function interno.registrar_novo_mandato(date) to authenticated;
revoke all on function public.registrar_novo_mandato(date) from public, anon;
grant execute on function public.registrar_novo_mandato(date) to authenticated;

comment on column public.config_credencial.fim_mandato is
  'Fim do mandato da diretoria em curso. Mudar aqui = CORRIGIR a data (todas as credenciais do mandato acompanham). Na posse da nova diretoria, use registrar_novo_mandato.';
