-- =====================================================================
-- FASE 5.5 — AS REGRAS NOVAS DA REGULARIZAÇÃO DAS IGREJAS (decisões do presidente de 26/11/2026)
--
-- Substituem as de 18/11/2026 (o PROJETO.md, seção 4, foi atualizado junto):
--   1. Sem a transição até a AGO de 28/04/2027. O documento que falta tem 30 dias, contados da ATIVAÇÃO da igreja no
--      sistema (o dia em que ela passou a valer: o cadastro pela secretaria, a ativação da igreja pedida pelo pastor ou
--      a regularização da igreja sem registro). Nesses dias a igreja fica suspensa (o pastor presidente só manda os
--      documentos); passados os 30 dias sem o documento, o perfil de pastor presidente é bloqueado. O alvará vencido
--      também tem 30 dias. Nada conta antes da ativação: a igreja não nasce bloqueada (achado S7-03 da revisão).
--   2. O alvará que vence em 31/12 só suspende a igreja se o novo não chegar até 31/01 (a tolerância de janeiro).
--      Chegou (mandado até 31/01, esperando a conferência), não suspende. Depois, valem os 30 dias de sempre.
--   3. O pastor mandou o documento dentro do prazo e a secretaria só recusou depois dele: ele ganha 7 dias, contados
--      do dia da recusa, para mandar de novo, e não perde o perfil na hora.
--   4. A natureza jurídica é a do Cartão CNPJ conferido, nos dois sentidos (achado S7-02 b). Com um Cartão conferido,
--      a ficha não muda a natureza: muda-se mandando o Cartão novo.
--   5. A associação privada tem 120 dias para mudar para organização religiosa, contados da ativação (ou do dia em que
--      ela passou a ser associação privada: o Cartão conferido que mostra isso). O fim do mandato da diretoria não
--      conta mais. Passou do prazo, a igreja fica suspensa (e vêm os 30 dias para mandar o Cartão novo).
--   6. A igreja sem registro (a readequação) tem 120 dias, contados da ativação, para se registrar. Sai a AGO de
--      28/04/2027, também da credencial de readequação.
-- Os prazos continuam configuráveis pela presidência (Central de regularização): 30 dias para mandar, 31 dias de
-- tolerância do alvará (até 31/01), 7 dias depois da recusa, 120 dias para a natureza e 120 para a readequação.
-- Junto: o efeito das regras antes de salvar (achado S7-08: quantas igrejas mudam de situação hoje).
-- As colunas antigas (o fim da transição, os dias do Cartão CNPJ novo, a data da readequação e o prazo guardado da
-- natureza) ficam na tabela, sem uso: nada se apaga.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. As regras configuráveis (só a presidência muda)
-- ---------------------------------------------------------------------
alter table public.config_igrejas
  add column dias_tolerancia_alvara integer not null default 31 check (dias_tolerancia_alvara between 0 and 90),
  add column dias_apos_recusa       integer not null default 7 check (dias_apos_recusa between 1 and 60),
  add column dias_natureza          integer not null default 120 check (dias_natureza between 30 and 365),
  add column dias_readequacao       integer not null default 120 check (dias_readequacao between 30 and 365);
comment on table public.config_igrejas is
  'Regras da regularização das igrejas (26/11/2026): os 30 dias para mandar o documento (contados da ativação ou do '
  'vencimento), a tolerância do alvará que vence em 31/12, os dias depois da recusa fora do prazo, os 120 dias da '
  'associação privada e os 120 dias da igreja sem registro.';
comment on column public.config_igrejas.dias_para_mandar is
  'Dias que o pastor presidente tem para mandar o documento que falta (desde a ativação) ou que venceu, antes de perder o perfil.';
comment on column public.config_igrejas.dias_tolerancia_alvara is
  'O alvará que vence em 31/12 só suspende a igreja depois destes dias (31: até 31/01). 0: sem tolerância.';
comment on column public.config_igrejas.dias_apos_recusa is
  'Mandado dentro do prazo e recusado depois dele: os dias, contados da recusa, para mandar de novo.';
comment on column public.config_igrejas.dias_natureza is
  'Dias que a associação privada tem para mudar para organização religiosa (desde a ativação ou o Cartão que mostra a associação).';
comment on column public.config_igrejas.dias_readequacao is
  'Dias que a igreja sem registro tem para se registrar, contados da ativação.';
comment on column public.config_igrejas.transicao_ate is 'Sem uso desde 26/11/2026 (as regras novas não têm transição).';
comment on column public.config_igrejas.dias_cartao_cnpj is 'Sem uso desde 26/11/2026 (a associação privada tem dias_natureza).';
comment on column public.config_igrejas.readequacao_ate is 'Sem uso desde 26/11/2026 (cada igreja sem registro tem dias_readequacao).';

revoke update (transicao_ate, dias_cartao_cnpj, readequacao_ate) on public.config_igrejas from authenticated;
grant update (dias_tolerancia_alvara, dias_apos_recusa, dias_natureza, dias_readequacao) on public.config_igrejas to authenticated;


-- ---------------------------------------------------------------------
-- 2. A igreja guarda o dia da ativação e o dia em que passou a ser associação privada
-- ---------------------------------------------------------------------
alter table public.igrejas
  add column ativada_em date,
  add column natureza_desde date;
comment on column public.igrejas.ativada_em is
  'O dia em que a igreja passou a valer no sistema (completo ou sem registro): os prazos da regularização contam dele.';
comment on column public.igrejas.natureza_desde is
  'Associação privada: o dia em que a igreja passou a ser (o cadastro, a ficha ou o Cartão CNPJ conferido).';
comment on column public.igrejas.natureza_prazo is
  'Sem uso desde 26/11/2026: o prazo da associação privada é calculado (situacao_igreja), da ativação ou de natureza_desde.';

-- As igrejas que já existem: a ativação é a última vez que o cadastro passou ao que está hoje (a auditoria guarda a
-- ativação da igreja pedida pelo pastor e a regularização da sem registro); sem isso, o dia do cadastro.
update public.igrejas g
set ativada_em = coalesce(
      (select max(a.ocorrido_em)::date
       from public.auditoria a
       where a.tabela = 'igrejas' and a.registro_id = g.id::text and a.operacao = 'UPDATE'
         and a.dados_depois ->> 'cadastro' = g.cadastro
         and (a.dados_antes ->> 'cadastro') is distinct from g.cadastro),
      g.criado_em::date)
where g.cadastro in ('completo', 'sem_registro');
update public.igrejas set natureza_prazo = null where natureza_prazo is not null;

-- Daqui em diante o próprio banco marca a ativação: na inclusão (completo ou sem registro) e quando o cadastro muda
-- para um dos dois. A igreja em análise ainda não foi ativada. Ninguém escreve a coluna pela API (sem permissão).
create function interno.ativacao_da_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cadastro not in ('completo', 'sem_registro') then
    new.ativada_em := null;
  elsif tg_op = 'INSERT' then
    new.ativada_em := coalesce(new.ativada_em, current_date);
  elsif new.cadastro is distinct from old.cadastro then
    new.ativada_em := current_date;
  end if;
  return new;
end;
$$;
create trigger ativacao_da_igreja
  before insert or update of cadastro on public.igrejas
  for each row execute function interno.ativacao_da_igreja();

-- A natureza mudou (o cadastro, a ficha ou o Cartão conferido): a associação privada guarda o dia em que passou a ser.
-- Outro Cartão ainda como associação privada não muda a natureza, e a conta não recomeça.
create or replace function interno.prazo_da_natureza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.natureza_juridica is distinct from 'associacao_privada' then
    new.natureza_desde := null;
  elsif tg_op = 'INSERT' or old.natureza_juridica is distinct from 'associacao_privada' then
    new.natureza_desde := current_date;
  end if;
  new.natureza_prazo := null;
  return new;
end;
$$;

-- A natureza é a do Cartão CNPJ conferido: com ele, a ficha não diz outra coisa. O nome põe este gatilho depois de
-- proteger_igreja (os gatilhos rodam em ordem alfabética): o pastor continua lendo que a natureza é da secretaria.
create function interno.validar_natureza_do_cartao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cartao text;
begin
  if new.natureza_juridica is not distinct from old.natureza_juridica then
    return new;
  end if;
  select d.natureza into v_cartao
  from public.igreja_documentos d
  where d.igreja_id = new.id and d.tipo = 'cartao_cnpj' and d.situacao = 'conferido' and d.arquivado_em is null
    and d.natureza is not null
  order by d.conferido_em desc nulls last, d.criado_em desc
  limit 1;
  if v_cartao is not null and new.natureza_juridica is distinct from v_cartao then
    raise exception 'A natureza jurídica é a do Cartão CNPJ conferido (%). Para mudar, mande o Cartão CNPJ novo pela aba Documentos.',
      case v_cartao when 'organizacao_religiosa' then 'organização religiosa' else 'associação privada' end
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger validar_natureza_do_cartao
  before update of natureza_juridica on public.igrejas
  for each row execute function interno.validar_natureza_do_cartao();


-- ---------------------------------------------------------------------
-- 3. O que o documento conferido muda na igreja: só a natureza do Cartão CNPJ, nos dois sentidos
-- ---------------------------------------------------------------------
-- (A ata que muda a natureza não mexe mais no prazo; enquanto espera a conferência, ela ainda segura o bloqueio.)
create or replace function interno.efeitos_do_documento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.igreja_documentos;
begin
  select * into v_doc from public.igreja_documentos where id = p_id;
  if not found or v_doc.situacao <> 'conferido' then
    return;
  end if;
  if v_doc.tipo = 'cartao_cnpj' and v_doc.natureza is not null then
    update public.igrejas set natureza_juridica = v_doc.natureza
    where id = v_doc.igreja_id and cadastro <> 'sem_registro' and natureza_juridica is distinct from v_doc.natureza;
  end if;
end;
$$;

-- O prazo da natureza deixou de ser guardado (é calculado): a ativação e a regularização continuam chamando esta função.
create or replace function interno.ajustar_prazo_natureza(p_igreja_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  return;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. A situação da igreja, calculada pela data, com as regras que se passar
-- ---------------------------------------------------------------------
-- Devolve:
--   situacao: regular | suspensa | sem_registro | em_analise
--   vencidos: o que suspendeu (estatuto, cartao_cnpj, natureza_juridica, ata_diretoria, alvara), e destes, os que
--   nunca vieram (nunca_vieram: o que faltava na ativação); pendencias: o que falta e ainda está no prazo, sem suspender (pendencias_ate; null quando o novo já chegou e espera a conferência);
--   suspensa_desde; prazo_ate (o último dia para mandar, contando os dias depois da recusa fora do prazo);
--   perfil_bloqueado; alvara_ate e mandato_ate (já contando o documento antecipado); natureza_prazo (associação
--   privada); proximo_vencimento; ativada_em; e, na igreja sem registro, readequacao_ate.
create function interno.situacao_igreja_com(p_igreja_id uuid, p_dia date, p_cfg public.config_igrejas)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v_ativada date;
  v_item text;
  v_cob date;
  v_desde date;
  v_tolerancia date;
  v_suspensa date;
  v_vencidos text[] := '{}';
  v_nunca text[] := '{}';
  v_pendencias text[] := '{}';
  v_pendencias_ate date;
  v_sem_envio text[] := '{}';
  v_proximo date;
  v_alvara date;
  v_mandato date;
  v_natureza_prazo date;
  v_prazo date;
  v_recusa date;
  v_prazo_item date;
  v_prazo_efetivo date;
  v_bloqueado boolean := false;
begin
  select * into v_igreja from public.igrejas where id = p_igreja_id;
  if not found then
    return null;
  end if;
  -- nada conta antes da ativação (no dado antigo sem ela, o dia do cadastro)
  v_ativada := coalesce(v_igreja.ativada_em, v_igreja.criado_em::date);
  if v_igreja.cadastro = 'sem_registro' then
    return jsonb_build_object('situacao', 'sem_registro', 'perfil_bloqueado', true,
                              'vencidos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
                              'ativada_em', v_ativada, 'readequacao_ate', v_ativada + p_cfg.dias_readequacao);
  end if;
  if v_igreja.cadastro <> 'completo' then
    return jsonb_build_object('situacao', v_igreja.cadastro, 'perfil_bloqueado', true,
                              'vencidos', '[]'::jsonb, 'pendencias', '[]'::jsonb);
  end if;
  if v_igreja.natureza_juridica = 'associacao_privada' then
    v_natureza_prazo := greatest(coalesce(v_igreja.natureza_desde, v_ativada), v_ativada) + p_cfg.dias_natureza;
  end if;

  foreach v_item in array array['estatuto', 'cartao_cnpj', 'natureza_juridica', 'ata_diretoria', 'alvara'] loop
    if v_item = 'natureza_juridica' then
      v_cob := case v_igreja.natureza_juridica
                 when 'organizacao_religiosa' then 'infinity'::date
                 when 'associacao_privada' then v_natureza_prazo
               end;
    else
      v_cob := interno.cobertura_documento(p_igreja_id, v_item::public.tipo_documento_igreja, p_dia);
    end if;
    if v_cob is not null and v_cob >= p_dia then
      if v_cob < 'infinity'::date then
        v_proximo := least(v_proximo, v_cob);
        if v_item = 'alvara' then
          v_alvara := v_cob;
        elsif v_item = 'ata_diretoria' then
          v_mandato := v_cob;
        end if;
      end if;
      continue;
    end if;

    -- venceu (ou nunca veio): o primeiro dia sem o documento, nunca antes da ativação
    v_tolerancia := null;
    if v_cob is null then
      v_desde := v_ativada;
    else
      v_desde := v_cob + 1;
      -- o alvará que vence em 31/12: a tolerância de janeiro
      if v_item = 'alvara' and to_char(v_cob, 'MM-DD') = '12-31' and p_cfg.dias_tolerancia_alvara > 0 then
        v_tolerancia := v_cob + p_cfg.dias_tolerancia_alvara;
        v_desde := v_tolerancia + 1;
      end if;
    end if;
    v_desde := greatest(v_desde, v_ativada);

    if v_desde > p_dia then
      -- ainda no prazo: falta, sem suspender
      v_pendencias := v_pendencias || v_item;
      v_pendencias_ate := least(v_pendencias_ate, v_desde - 1);
      v_proximo := least(v_proximo, v_desde - 1);
    elsif v_tolerancia is not null and exists (
      select 1 from public.igreja_documentos d
      where d.igreja_id = p_igreja_id and d.tipo = 'alvara' and d.situacao = 'pendente' and d.arquivado_em is null
        and d.criado_em::date <= v_tolerancia
    ) then
      -- o alvará novo chegou dentro da tolerância e espera a conferência: não suspende
      v_pendencias := v_pendencias || v_item;
    else
      v_suspensa := least(v_suspensa, v_desde);
      v_vencidos := v_vencidos || v_item;
      if v_cob is null then
        v_nunca := v_nunca || v_item;
      end if;
      -- mandou o documento novo (esperando a conferência)? então o perfil não é bloqueado
      if not exists (
        select 1 from public.igreja_documentos d
        where d.igreja_id = p_igreja_id and d.situacao = 'pendente' and d.arquivado_em is null
          and (d.tipo::text = v_item
               or (v_item = 'natureza_juridica' and (d.tipo = 'cartao_cnpj' or (d.tipo = 'ata_diretoria' and d.muda_natureza))))
      ) then
        v_sem_envio := v_sem_envio || v_item;
      end if;
    end if;
  end loop;

  if v_suspensa is not null then
    v_prazo := v_suspensa + p_cfg.dias_para_mandar - 1;
    -- cada item sem o documento novo: o prazo da igreja, ou, se o pastor mandou dentro dele e a secretaria só recusou
    -- depois, os dias depois da recusa
    foreach v_item in array v_sem_envio loop
      select max(d.conferido_em::date) into v_recusa
      from public.igreja_documentos d
      where d.igreja_id = p_igreja_id and d.situacao = 'recusado' and d.arquivado_em is null
        and (d.tipo::text = v_item
             or (v_item = 'natureza_juridica' and (d.tipo = 'cartao_cnpj' or (d.tipo = 'ata_diretoria' and d.muda_natureza))))
        and d.criado_em::date <= v_prazo
        and d.conferido_em::date > v_prazo;
      v_prazo_item := greatest(v_prazo, v_recusa + p_cfg.dias_apos_recusa - 1);
      v_prazo_efetivo := least(v_prazo_efetivo, v_prazo_item);
      if p_dia > v_prazo_item then
        v_bloqueado := true;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'situacao', case when v_suspensa is null then 'regular' else 'suspensa' end,
    'vencidos', to_jsonb(v_vencidos),
    'nunca_vieram', to_jsonb(v_nunca),
    'pendencias', to_jsonb(v_pendencias),
    'pendencias_ate', v_pendencias_ate,
    'suspensa_desde', v_suspensa,
    'prazo_ate', coalesce(v_prazo_efetivo, v_prazo),
    'perfil_bloqueado', v_bloqueado,
    'alvara_ate', v_alvara,
    'mandato_ate', v_mandato,
    'natureza_prazo', v_natureza_prazo,
    'proximo_vencimento', v_proximo,
    'ativada_em', v_ativada
  );
end;
$$;

-- A situação no dia, com as regras salvas (o perfil, as listas e as telas usam esta)
create or replace function interno.situacao_igreja(p_igreja_id uuid, p_dia date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return interno.situacao_igreja_com(p_igreja_id, p_dia, (select c from public.config_igrejas c where c.id));
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O efeito das regras antes de salvar (S7-08): quais igrejas mudam de situação hoje
-- ---------------------------------------------------------------------
-- p_regras: os dias que a presidência quer (os que faltarem ficam como estão). Nada é salvo. Devolve quantas igrejas
-- foram olhadas e as que mudam ({igreja_id, nome, antes, depois}: regular, suspensa ou bloqueada).
create function interno.efeito_das_regras(p_regras jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_atual public.config_igrejas;
  v_nova public.config_igrejas;
  v_igreja record;
  v_antes jsonb;
  v_depois jsonb;
  v_de text;
  v_para text;
  v_total integer := 0;
  v_mudam jsonb := '[]'::jsonb;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Só a presidência muda as regras da regularização.' using errcode = '42501';
  end if;
  if p_regras is null or jsonb_typeof(p_regras) <> 'object' then
    raise exception 'As regras vieram num formato inválido.' using errcode = 'P0001';
  end if;
  select * into v_atual from public.config_igrejas where id;
  v_nova := v_atual;
  begin
    v_nova.dias_para_mandar := coalesce((p_regras ->> 'dias_para_mandar')::integer, v_atual.dias_para_mandar);
    v_nova.dias_tolerancia_alvara := coalesce((p_regras ->> 'dias_tolerancia_alvara')::integer, v_atual.dias_tolerancia_alvara);
    v_nova.dias_apos_recusa := coalesce((p_regras ->> 'dias_apos_recusa')::integer, v_atual.dias_apos_recusa);
    v_nova.dias_natureza := coalesce((p_regras ->> 'dias_natureza')::integer, v_atual.dias_natureza);
    v_nova.dias_readequacao := coalesce((p_regras ->> 'dias_readequacao')::integer, v_atual.dias_readequacao);
  exception when others then
    raise exception 'Os prazos são números inteiros de dias.' using errcode = 'P0001';
  end;
  if v_nova.dias_para_mandar not between 1 and 180 then
    raise exception 'Os dias para mandar o documento vão de 1 a 180.' using errcode = 'P0001';
  end if;
  if v_nova.dias_tolerancia_alvara not between 0 and 90 then
    raise exception 'A tolerância do alvará vai de 0 a 90 dias.' using errcode = 'P0001';
  end if;
  if v_nova.dias_apos_recusa not between 1 and 60 then
    raise exception 'Os dias depois da recusa vão de 1 a 60.' using errcode = 'P0001';
  end if;
  if v_nova.dias_natureza not between 30 and 365 or v_nova.dias_readequacao not between 30 and 365 then
    raise exception 'Os dias da associação privada e da igreja sem registro vão de 30 a 365.' using errcode = 'P0001';
  end if;

  for v_igreja in
    select g.id, g.nome from public.igrejas g where g.arquivado_em is null and g.cadastro = 'completo' order by g.nome
  loop
    v_total := v_total + 1;
    v_antes := interno.situacao_igreja_com(v_igreja.id, current_date, v_atual);
    v_depois := interno.situacao_igreja_com(v_igreja.id, current_date, v_nova);
    v_de := case when (v_antes ->> 'perfil_bloqueado')::boolean then 'bloqueada' else v_antes ->> 'situacao' end;
    v_para := case when (v_depois ->> 'perfil_bloqueado')::boolean then 'bloqueada' else v_depois ->> 'situacao' end;
    if v_de is distinct from v_para then
      v_mudam := v_mudam || jsonb_build_array(jsonb_build_object(
        'igreja_id', v_igreja.id, 'nome', v_igreja.nome, 'antes', v_de, 'depois', v_para));
    end if;
  end loop;
  return jsonb_build_object('igrejas', v_total, 'mudam', v_mudam);
end;
$$;
create function public.efeito_das_regras(p_regras jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.efeito_das_regras(p_regras); $$;


-- ---------------------------------------------------------------------
-- 6. A readequação: o prazo é de cada igreja (120 dias da ativação), e não mais a AGO
-- ---------------------------------------------------------------------
create function interno.prazo_readequacao(p_igreja_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(g.ativada_em, g.criado_em::date) + c.dias_readequacao
  from public.igrejas g
  cross join public.config_igrejas c
  where g.id = p_igreja_id and g.cadastro = 'sem_registro' and c.id;
$$;

-- A galeria dos modelos: os dias da readequação (cada igreja tem o seu prazo)
create or replace function interno.painel_modelos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_contagem jsonb;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')) then
    raise exception 'Só a secretaria, a presidência e a tesouraria veem os modelos da credencial.' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(x.modelo_id::text, x.n), '{}'::jsonb) into v_contagem
  from (select q.modelo_id, count(*) as n from interno.modelos_dos_associados(interno.modelos_ativos(), current_date) q
        where q.modelo_id is not null group by q.modelo_id) x;
  return jsonb_build_object(
    'fim_mandato', (select c.fim_mandato from public.config_credencial c where c.id),
    'dias_readequacao', (select c.dias_readequacao from public.config_igrejas c where c.id),
    'associados', (select count(*) from public.associados a where a.arquivado_em is null and a.situacao = 'ativo'),
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'nome', m.nome,
        'descricao', m.descricao,
        'tipo', m.tipo,
        'prioridade', m.prioridade,
        'em_uso', m.em_uso,
        'regra', m.regra,
        'versao_id', m.versao_id,
        'desenho', v.modelo,
        'salvo_em', v.criado_em,
        'igreja_id', m.exclusivo_igreja_id,
        'igreja_nome', i.nome,
        'valor', m.exclusivo_valor,
        'pedido_por', m.exclusivo_pedido_por,
        'pedido_por_nome', p.nome,
        'pago_em', m.exclusivo_pago_em,
        'lancamento_id', m.exclusivo_lancamento_id,
        'pessoas', coalesce((v_contagem ->> m.id::text)::integer, 0)
      ) order by case when m.tipo in ('grupo', 'exclusivo') then 0 when m.tipo = 'padrao' then 1 else 2 end,
                 m.prioridade, m.criado_em)
      from public.credencial_modelos m
      left join public.modelos_credencial v on v.id = m.versao_id
      left join public.igrejas i on i.id = m.exclusivo_igreja_id
      left join public.pessoas p on p.id = m.exclusivo_pedido_por
      where m.arquivado_em is null
    ), '[]'::jsonb)
  );
end;
$$;

-- A lista do módulo: os dias da readequação, e o prazo de cada um em readequação
create or replace function interno.lista_credenciais()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a lista das credenciais.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'fim_mandato', (select c.fim_mandato from public.config_credencial c where c.id),
    'dias_readequacao', (select c.dias_readequacao from public.config_igrejas c where c.id),
    'credenciais', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pessoa_id', pc.pessoa_id,
        'numero_registro', pc.numero_registro,
        'nome', pc.nome,
        'igreja_id', pc.igreja_id,
        'igreja', pc.igreja,
        'pendencias', to_jsonb(pc.pendencias),
        'em_dia', interno.esta_em_dia(pc.pessoa_id),
        'readequacao', interno.em_readequacao(pc.pessoa_id),
        'prazo_readequacao', interno.prazo_readequacao(pc.igreja_id),
        'modelo_id', q.modelo_id,
        'modelo', m.nome,
        'valida_ate', coalesce(cr.valida_ate, (select c.fim_mandato from public.config_credencial c where c.id))
      ) order by pc.nome)
      from public.vw_pendencias_credencial pc
      left join interno.modelos_dos_associados(interno.modelos_ativos(), current_date) q on q.pessoa_id = pc.pessoa_id
      left join public.credencial_modelos m on m.id = q.modelo_id
      left join public.credenciais cr on cr.pessoa_id = pc.pessoa_id
        and cr.substituida_em is null and cr.renovada_em is null and cr.arquivado_em is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Os dados da credencial: o prazo da readequação é o da igreja da pessoa (o resto é o de 19/11, com o logotipo)
create or replace function interno.dados_credenciais(p_pessoas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_ids uuid[];
  v_pessoa uuid;
  v_lista jsonb := '[]'::jsonb;
  v_item jsonb;
  v_codigo text;
  v_credencial public.credenciais;
  v_config public.config_credencial;
  v_ativos public.credencial_modelos[] := interno.modelos_ativos();
  v_modelo uuid;
  v_usados uuid[] := '{}';
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver a credencial.' using errcode = '42501';
  end if;
  if p_pessoas is null or array_ndims(p_pessoas) <> 1 or cardinality(p_pessoas) not between 1 and 500 then
    raise exception 'Escolha de 1 a 500 credenciais.' using errcode = 'P0001';
  end if;
  -- sem repetir e sem vazios, na ordem pedida
  v_ids := array(
    select x from unnest(p_pessoas) with ordinality as t(x, n) where x is not null group by x order by min(n)
  );
  foreach v_pessoa in array v_ids loop
    if v_pessoa <> v_eu and not v_diretoria then
      raise exception 'Só a secretaria ou a presidência veem a credencial de outra pessoa.' using errcode = '42501';
    end if;
  end loop;
  select * into v_config from public.config_credencial where id;

  -- cria as credenciais que faltam em ordem fixa (duas telas ao mesmo tempo não se travam)
  for v_pessoa in
    select x from unnest(v_ids) x
    where exists (select 1 from public.associados a where a.pessoa_id = x and a.arquivado_em is null and a.situacao = 'ativo')
    order by x
  loop
    perform interno.codigo_credencial(v_pessoa);
  end loop;

  foreach v_pessoa in array v_ids loop
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
      'pendencias', coalesce(pc.pendencias, '{}'::text[]),
      'cargo', (select m.cargo from public.mandatos m
                where m.pessoa_id = v.pessoa_id and m.arquivado_em is null
                  and m.inicio <= current_date and interno.fim_efetivo(m) >= current_date
                order by m.inicio desc limit 1),
      'readequacao', coalesce(i.cadastro = 'sem_registro', false),
      'prazo_readequacao', case when i.cadastro = 'sem_registro' then interno.prazo_readequacao(i.id) end,
      'denominacao_logotipo', dn.logotipo
    )
    into v_item
    from public.vw_associados v
    join public.associados a on a.id = v.id
    join public.pessoas p on p.id = v.pessoa_id
    left join public.igrejas i on i.id = v.igreja_id
    left join public.denominacoes dn on dn.id = i.denominacao_id and dn.arquivado_em is null
    left join public.vw_pendencias_credencial pc on pc.associado_id = v.id
    where v.pessoa_id = v_pessoa and v.situacao = 'ativo' and a.arquivado_em is null;
    if v_item is not null then
      v_codigo := interno.codigo_credencial(v_pessoa);
      select * into v_credencial from public.credenciais where codigo = v_codigo;
      v_modelo := interno.escolher_modelo(interno.contexto_credencial(v_pessoa, current_date), v_ativos, current_date);
      if v_modelo is not null and not (v_modelo = any (v_usados)) then
        v_usados := v_usados || v_modelo;
      end if;
      v_item := v_item || jsonb_build_object(
        'codigo', v_credencial.codigo,
        'foto_publica', v_credencial.foto_publica,
        'valida_ate', coalesce(v_credencial.valida_ate, v_config.fim_mandato),
        'emitida_em', v_credencial.criado_em,
        'modelo_id', v_modelo
      );
      v_lista := v_lista || jsonb_build_array(v_item);
    end if;
  end loop;

  return jsonb_build_object(
    'fim_mandato', v_config.fim_mandato,
    'texto_verso', v_config.texto_verso,
    'credenciais', v_lista,
    -- o desenho de cada modelo usado (vazio = o desenho do sistema para o tipo)
    'modelos', coalesce((
      select jsonb_object_agg(m.id, jsonb_build_object('nome', m.nome, 'tipo', m.tipo, 'desenho', ve.modelo))
      from public.credencial_modelos m
      left join public.modelos_credencial ve on ve.id = m.versao_id
      where m.id = any (v_usados)
    ), '{}'::jsonb)
  );
end;
$$;

-- A validação pública: o prazo da readequação é o da igreja (o resto é o de 19/11)
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
    'ativo', (v.situacao = 'ativo' and a.arquivado_em is null),
    'readequacao', coalesce(i.cadastro = 'sem_registro', false),
    'prazo_readequacao', case when i.cadastro = 'sem_registro' then interno.prazo_readequacao(i.id) end
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
-- 7. Os avisos: o que falta (o alvará de janeiro), a associação privada e a recusa com o prazo
-- ---------------------------------------------------------------------
-- A mesma rotina de 20/11, com três textos novos: o documento que falta (ainda no prazo, sem suspender) diz até quando
-- mandar; a associação privada diz até quando mudar; o resto continua igual.
create or replace function interno.gerar_avisos_do_dia(p_forcar boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := current_date;
  v_criadas integer := 0;
  v_igreja record;
  v_s jsonb;
  v_ate date;
  v_item text;
  v_dias integer;
  v_marco integer;
  v_nome_item text;
  v_doc text;
  v_vencidos text;
  v_falta boolean;
  v_quando text;
  v_titulo text;
  v_texto text;
begin
  -- dois ao mesmo tempo não geram em dobro
  perform pg_advisory_xact_lock(hashtext('comep: avisos do dia'));
  if not p_forcar and exists (select 1 from public.config_notificacoes where id and ultimo_dia_gerado = v_hoje) then
    return 0;
  end if;

  for v_igreja in
    select g.id, g.nome from public.igrejas g where g.arquivado_em is null and g.cadastro = 'completo'
  loop
    if cardinality(interno.pastores_da_igreja(v_igreja.id)) = 0 then
      continue;
    end if;
    v_s := interno.situacao_igreja(v_igreja.id, v_hoje);
    if v_s ->> 'situacao' = 'suspensa' and not coalesce((v_s ->> 'perfil_bloqueado')::boolean, false) then
      select string_agg(case x
               when 'estatuto' then 'o estatuto'
               when 'cartao_cnpj' then 'o Cartão CNPJ'
               when 'natureza_juridica' then 'a natureza jurídica'
               when 'ata_diretoria' then 'a ata da diretoria'
               else 'o alvará' end, ', ')
        into v_vencidos
      from jsonb_array_elements_text(v_s -> 'vencidos') x;
      v_criadas := v_criadas + interno.notificar(
        interno.pastores_da_igreja(v_igreja.id), 'documentos', 'A igreja está suspensa',
        v_igreja.nome || ': mande ' || coalesce(v_vencidos, 'o documento vencido') || ' até '
          || to_char((v_s ->> 'prazo_ate')::date, 'DD/MM/YYYY') || '. Depois, o perfil de pastor presidente é bloqueado.',
        '/minha-igreja', 'igreja-suspensa:' || v_igreja.id || ':' || (v_s ->> 'suspensa_desde'), true,
        ((v_s ->> 'suspensa_desde')::date + time '08:00') at time zone 'America/Belem');
    elsif v_s ->> 'situacao' = 'regular' and v_s ->> 'proximo_vencimento' is not null then
      v_ate := (v_s ->> 'proximo_vencimento')::date;
      v_dias := v_ate - v_hoje;
      if v_dias > 60 then
        continue;
      end if;
      v_marco := case when v_dias <= 30 then 30 else 60 end;
      v_falta := false;
      v_item := case
        when v_s ->> 'alvara_ate' = v_s ->> 'proximo_vencimento' then 'alvara'
        when v_s ->> 'mandato_ate' = v_s ->> 'proximo_vencimento' then 'ata_diretoria'
        when v_s ->> 'natureza_prazo' = v_s ->> 'proximo_vencimento' then 'natureza_juridica'
      end;
      if v_item is null then
        v_item := v_s -> 'pendencias' ->> 0;
        v_falta := true;
      end if;
      if v_item is null then
        continue;
      end if;
      v_nome_item := case v_item
        when 'estatuto' then 'Estatuto'
        when 'cartao_cnpj' then 'Cartão CNPJ'
        when 'natureza_juridica' then 'Natureza jurídica'
        when 'ata_diretoria' then 'Ata da diretoria'
        else 'Alvará' end;
      v_doc := case v_item when 'natureza_juridica' then 'cartao_cnpj' else v_item end;
      v_quando := case v_dias when 0 then 'hoje' when 1 then 'amanhã' else 'em ' || v_dias || ' dias' end;
      if v_falta then
        v_titulo := v_nome_item || ': o prazo acaba ' || v_quando;
        v_texto := v_igreja.nome || ': mande ' || lower(left(v_nome_item, 1)) || substr(v_nome_item, 2) || ' até '
          || to_char(v_ate, 'DD/MM/YYYY') || '. Depois, a igreja fica suspensa.';
      elsif v_item = 'natureza_juridica' then
        v_titulo := 'Associação privada: o prazo acaba ' || v_quando;
        v_texto := v_igreja.nome || ': até ' || to_char(v_ate, 'DD/MM/YYYY')
          || ', mude para organização religiosa e mande o Cartão CNPJ novo. Depois, a igreja fica suspensa.';
      else
        v_titulo := v_nome_item || ' vence ' || v_quando;
        v_texto := v_igreja.nome || ': vale até ' || to_char(v_ate, 'DD/MM/YYYY')
          || '. Mande o novo antes de vencer: ele entra sozinho no dia certo, e a igreja não fica suspensa.';
      end if;
      v_criadas := v_criadas + interno.notificar(
        interno.pastores_da_igreja(v_igreja.id), 'documentos', v_titulo, v_texto,
        '/minha-igreja/documentos/' || v_doc || '/atualizar',
        'igreja-vence:' || v_igreja.id || ':' || v_item || ':' || v_ate || ':' || v_marco, false,
        ((v_ate - v_marco) + time '08:00') at time zone 'America/Belem');
    end if;
  end loop;

  update public.config_notificacoes set ultimo_dia_gerado = v_hoje where id;
  return v_criadas;
end;
$$;

-- O documento que voltou da conferência: o aviso diz até quando mandar de novo (a recusa fora do prazo dá os dias
-- depois da recusa). O resto é o de 20/11.
create or replace function interno.notificar_documento_igreja()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v_quem uuid[];
  v_s jsonb;
  v_ate text;
begin
  if new.situacao <> 'recusado' or old.situacao = 'recusado' then
    return null;
  end if;
  select * into v_igreja from public.igrejas where id = new.igreja_id;
  if v_igreja.cadastro = 'em_analise' then
    v_quem := array_remove(array[v_igreja.cadastrada_por], null);
  else
    v_quem := interno.pastores_da_igreja(new.igreja_id) || array_remove(array[new.enviado_por], null);
    v_s := interno.situacao_igreja(new.igreja_id);
    if v_s ->> 'situacao' = 'suspensa' and not coalesce((v_s ->> 'perfil_bloqueado')::boolean, false)
       and v_s ->> 'prazo_ate' is not null then
      v_ate := to_char((v_s ->> 'prazo_ate')::date, 'DD/MM/YYYY');
    end if;
  end if;
  perform interno.notificar(
    v_quem, 'documentos', 'Um documento voltou da conferência',
    v_igreja.nome || ': ' || coalesce(new.motivo_recusa, 'veja o motivo') || '. Mande o documento de novo'
      || coalesce(' até ' || v_ate, '') || '.',
    case when v_igreja.cadastro = 'em_analise' then '/cadastrar-minha-igreja' else '/minha-igreja/documentos' end,
    'igreja-doc:' || new.id || ':recusado', false, now());
  return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Quem chama o quê
-- ---------------------------------------------------------------------
-- Os ajudantes que só as outras funções do banco chamam (como dono) ficam fechados para quem tem login.
revoke all on function interno.situacao_igreja_com(uuid, date, public.config_igrejas) from public;
revoke all on function interno.prazo_readequacao(uuid) from public;
revoke all on function interno.ativacao_da_igreja() from public;
revoke all on function interno.validar_natureza_do_cartao() from public;
-- o efeito das regras: a função pública confere a presidência
revoke all on function interno.efeito_das_regras(jsonb) from public;
grant execute on function interno.efeito_das_regras(jsonb) to authenticated;
revoke all on function public.efeito_das_regras(jsonb) from public, anon;
grant execute on function public.efeito_das_regras(jsonb) to authenticated;
