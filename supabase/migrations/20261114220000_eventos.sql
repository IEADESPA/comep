-- =====================================================================
-- FASE 5.3 — EVENTOS E PROJETOS (Art. 3º, VII; respostas 27, 31, 32 e 33 de 14/11/2026)
--
--   * eventos (encontros, seminários, conferências) e projetos do Conselho, com responsável e orçamento;
--   * o orçamento é aprovado pela assembleia (AGO ou AGE instalada); despesa ligada ao evento só depois disso;
--   * inscrição pelo sistema (associados) ou aberta ao público pelo site (nome e telefone, com o aceite da LGPD);
--   * taxa de inscrição por evento: a tesouraria registra o pagamento e ele entra no caixa, ligado ao evento;
--   * os lançamentos do caixa podem ser ligados ao evento (receitas e despesas do evento);
--   * quem cuida: a secretaria (o secretário executivo, responsável pelos eventos, tem esse perfil) e a presidência.
-- =====================================================================

create type public.tipo_evento as enum ('evento', 'projeto');
create type public.situacao_evento as enum ('rascunho', 'publicado', 'realizado', 'cancelado');

create table public.eventos (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  public.tipo_evento not null default 'evento',
  titulo                text not null check (length(trim(titulo)) between 3 and 200),
  descricao             text check (descricao is null or length(descricao) <= 5000),
  local                 text check (local is null or length(local) <= 300),
  inicio                timestamptz not null,
  fim                   timestamptz,
  responsavel_id        uuid references public.pessoas (id),
  orcamento             numeric(12, 2) check (orcamento is null or orcamento >= 0),
  orcamento_encontro_id uuid references public.encontros (id),
  orcamento_aprovado_em timestamptz,
  inscricao             boolean not null default false,
  inscricao_publica     boolean not null default false,
  inscricao_ate         timestamptz,
  vagas                 integer check (vagas is null or vagas between 1 and 100000),
  taxa                  numeric(10, 2) not null default 0 check (taxa >= 0 and taxa <= 100000),
  situacao              public.situacao_evento not null default 'rascunho',
  publicado_em          timestamptz,
  cancelado_em          timestamptz,
  motivo_cancelamento   text check (motivo_cancelamento is null or length(motivo_cancelamento) <= 500),
  arquivado_em          timestamptz,
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  constraint eventos_periodo check (fim is null or fim >= inicio),
  constraint eventos_inscricao_publica check (not inscricao_publica or inscricao),
  constraint eventos_orcamento_aprovado check ((orcamento_encontro_id is null) = (orcamento_aprovado_em is null))
);
comment on table public.eventos is 'Eventos e projetos do Conselho (Art. 3º, VII). O orçamento é aprovado pela assembleia (14/11/2026).';
create index eventos_inicio on public.eventos (inicio) where arquivado_em is null;
create index eventos_responsavel on public.eventos (responsavel_id);
create index eventos_orcamento_encontro on public.eventos (orcamento_encontro_id);
select interno.aplicar_padroes('public.eventos');

create table public.evento_inscricoes (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.eventos (id),
  numero          integer not null,
  nome            text not null check (length(trim(nome)) between 3 and 120),
  telefone        text not null check (telefone ~ '^[0-9]{10,13}$'),
  igreja          text check (igreja is null or length(igreja) <= 200),
  pessoa_id       uuid references public.pessoas (id),
  situacao        text not null check (situacao in ('confirmada', 'aguardando_pagamento', 'cancelada')),
  valor           numeric(10, 2) not null default 0 check (valor >= 0),
  pago_em         date,
  lancamento_id   uuid references public.lancamentos (id),
  cancelada_em    timestamptz,
  motivo          text check (motivo is null or length(motivo) <= 500),
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.evento_inscricoes is
  'Inscrições nos eventos: associados pelo sistema ou o público pelo site (nome e telefone, com o aceite da LGPD).';
create unique index evento_inscricoes_numero on public.evento_inscricoes (evento_id, numero);
create unique index evento_inscricoes_um_por_telefone on public.evento_inscricoes (evento_id, telefone) where situacao <> 'cancelada';
create index evento_inscricoes_pessoa on public.evento_inscricoes (pessoa_id);
create index evento_inscricoes_lancamento on public.evento_inscricoes (lancamento_id);
create index evento_inscricoes_recentes on public.evento_inscricoes (evento_id, criado_em);
select interno.aplicar_padroes('public.evento_inscricoes');

-- Receitas e despesas do evento: os lançamentos do caixa ligados a ele
alter table public.lancamentos add column evento_id uuid references public.eventos (id);
create index lancamentos_evento on public.lancamentos (evento_id) where evento_id is not null;

-- Categoria do sistema para as taxas de inscrição
insert into public.categorias_financeiras (nome, tipo, ordem, sistema)
values ('Inscrições em eventos', 'entrada', 15, 'inscricoes_eventos')
on conflict do nothing;


-- ---------------------------------------------------------------------
-- Preparar, publicar, cancelar e concluir (a secretaria e a presidência)
-- ---------------------------------------------------------------------
create function interno.salvar_evento(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_atual public.eventos;
  v_tipo public.tipo_evento;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_ate timestamptz;
  v_responsavel uuid;
  v_orcamento numeric;
  v_taxa numeric;
  v_vagas integer;
  v_inscricao boolean;
  v_publica boolean;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria (o secretário executivo) ou a presidência preparam os eventos.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_tipo := coalesce(nullif(p_dados ->> 'tipo', ''), 'evento')::public.tipo_evento;
    v_inicio := (p_dados ->> 'inicio')::timestamptz;
    v_fim := nullif(p_dados ->> 'fim', '')::timestamptz;
    v_ate := nullif(p_dados ->> 'inscricao_ate', '')::timestamptz;
    v_responsavel := nullif(p_dados ->> 'responsavel_id', '')::uuid;
    v_orcamento := nullif(p_dados ->> 'orcamento', '')::numeric;
    v_taxa := coalesce(nullif(p_dados ->> 'taxa', '')::numeric, 0);
    v_vagas := nullif(p_dados ->> 'vagas', '')::integer;
    v_inscricao := coalesce((p_dados ->> 'inscricao')::boolean, false);
    v_publica := coalesce((p_dados ->> 'inscricao_publica')::boolean, false);
  exception when others then
    raise exception 'Datas, valores ou números inválidos.' using errcode = 'P0001';
  end;
  if coalesce(length(trim(p_dados ->> 'titulo')), 0) < 3 then
    raise exception 'Dê um título.' using errcode = 'P0001';
  end if;
  if v_inicio is null then
    raise exception 'Informe quando começa.' using errcode = 'P0001';
  end if;
  if v_fim is not null and v_fim < v_inicio then
    raise exception 'O fim vem depois do início.' using errcode = 'P0001';
  end if;
  if v_publica and not v_inscricao then
    raise exception 'Para abrir a inscrição ao público, marque que o evento tem inscrição.' using errcode = 'P0001';
  end if;
  if v_responsavel is not null and not interno.associado_ativo(v_responsavel) then
    raise exception 'O responsável é um associado ativo.' using errcode = 'P0001';
  end if;
  if v_orcamento is not null and v_orcamento < 0 or v_taxa < 0 then
    raise exception 'Valores não podem ser negativos.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.eventos (tipo, titulo, descricao, local, inicio, fim, responsavel_id, orcamento, inscricao, inscricao_publica,
                                inscricao_ate, vagas, taxa)
    values (v_tipo, trim(p_dados ->> 'titulo'), nullif(trim(p_dados ->> 'descricao'), ''), nullif(trim(p_dados ->> 'local'), ''),
            v_inicio, v_fim, v_responsavel, v_orcamento, v_inscricao, v_publica, v_ate, v_vagas, v_taxa)
    returning id into v_id;
  else
    select * into v_atual from public.eventos where id = v_id and arquivado_em is null for update;
    if not found then
      raise exception 'Evento não encontrado.' using errcode = 'P0001';
    end if;
    if v_atual.situacao in ('realizado', 'cancelado') then
      raise exception 'Evento realizado ou cancelado não muda.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.evento_inscricoes where evento_id = v_id and situacao <> 'cancelada') then
      if v_taxa <> v_atual.taxa then
        raise exception 'Já há inscritos: a taxa não muda mais.' using errcode = 'P0001';
      end if;
      if not v_inscricao then
        raise exception 'Já há inscritos: a inscrição não sai do evento (cancele as inscrições antes).' using errcode = 'P0001';
      end if;
    end if;
    -- orçamento aprovado pela assembleia: mudar o valor pede nova aprovação
    update public.eventos
    set tipo = v_tipo, titulo = trim(p_dados ->> 'titulo'), descricao = nullif(trim(p_dados ->> 'descricao'), ''),
        local = nullif(trim(p_dados ->> 'local'), ''), inicio = v_inicio, fim = v_fim, responsavel_id = v_responsavel,
        orcamento = v_orcamento, inscricao = v_inscricao, inscricao_publica = v_publica, inscricao_ate = v_ate,
        vagas = v_vagas, taxa = v_taxa,
        orcamento_encontro_id = case when v_orcamento is distinct from v_atual.orcamento then null else orcamento_encontro_id end,
        orcamento_aprovado_em = case when v_orcamento is distinct from v_atual.orcamento then null else orcamento_aprovado_em end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create function interno.publicar_evento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência publicam os eventos.' using errcode = '42501';
  end if;
  select * into v_evento from public.eventos where id = p_id and arquivado_em is null for update;
  if not found or v_evento.situacao <> 'rascunho' then
    raise exception 'Só se publica um evento em rascunho.' using errcode = 'P0001';
  end if;
  if coalesce(v_evento.fim, v_evento.inicio) < now() then
    raise exception 'O evento já passou.' using errcode = 'P0001';
  end if;
  update public.eventos set situacao = 'publicado', publicado_em = now() where id = p_id;
end;
$$;

create function interno.cancelar_evento(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência cancelam os eventos.' using errcode = '42501';
  end if;
  select * into v_evento from public.eventos where id = p_id and arquivado_em is null for update;
  if not found or v_evento.situacao in ('realizado', 'cancelado') then
    raise exception 'Evento não encontrado, já realizado ou cancelado.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Diga o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  update public.eventos set situacao = 'cancelado', cancelado_em = now(), motivo_cancelamento = trim(p_motivo) where id = p_id;
end;
$$;

create function interno.concluir_evento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram o evento como realizado.' using errcode = '42501';
  end if;
  select * into v_evento from public.eventos where id = p_id and arquivado_em is null for update;
  if not found or v_evento.situacao <> 'publicado' then
    raise exception 'Só um evento publicado é registrado como realizado.' using errcode = 'P0001';
  end if;
  if v_evento.inicio > now() then
    raise exception 'O evento ainda não começou.' using errcode = 'P0001';
  end if;
  update public.eventos set situacao = 'realizado' where id = p_id;
end;
$$;

-- Rascunho que não vai acontecer, ou cancelado: sai das listas (fica guardado)
create function interno.arquivar_evento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência arquivam os eventos.' using errcode = '42501';
  end if;
  update public.eventos set arquivado_em = now()
  where id = p_id and arquivado_em is null and situacao in ('rascunho', 'cancelado');
  if not found then
    raise exception 'Só se arquiva um rascunho ou um evento cancelado.' using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- Orçamento aprovado pela assembleia (resposta 31)
-- ---------------------------------------------------------------------
create function interno.aprovar_orcamento_evento(p_id uuid, p_encontro_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos;
begin
  if not (select interno.tenho_perfil('presidencia', 'secretaria')) then
    raise exception 'Só a presidência ou a secretaria registram a aprovação do orçamento.' using errcode = '42501';
  end if;
  select * into v_evento from public.eventos where id = p_id and arquivado_em is null for update;
  if not found or v_evento.situacao in ('realizado', 'cancelado') then
    raise exception 'Evento não encontrado, realizado ou cancelado.' using errcode = 'P0001';
  end if;
  if coalesce(v_evento.orcamento, 0) <= 0 then
    raise exception 'Informe o orçamento do evento antes.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.encontros e
    where e.id = p_encontro_id and e.tipo in ('ago', 'age') and e.instalada_em is not null and e.arquivado_em is null
  ) then
    raise exception 'O orçamento é aprovado por uma AGO ou AGE instalada no sistema.' using errcode = 'P0001';
  end if;
  update public.eventos set orcamento_encontro_id = p_encontro_id, orcamento_aprovado_em = now() where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Inscrição (resposta 32): pelo site (público) ou pelo sistema (associado)
-- ---------------------------------------------------------------------
create function interno.inscrever_no_evento(p_evento_id uuid, p_nome text, p_telefone text, p_igreja text, p_aceite boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos;
  v_eu uuid := (select interno.minha_pessoa_id());
  v_nome text := trim(p_nome);
  v_telefone text := regexp_replace(coalesce(p_telefone, ''), '[^0-9]', '', 'g');
  v_numero integer;
  v_situacao text;
  v_inscritos integer;
begin
  select * into v_evento from public.eventos where id = p_evento_id and arquivado_em is null for update;
  if not found or v_evento.situacao <> 'publicado' or not v_evento.inscricao then
    raise exception 'Este evento não está com inscrições abertas.' using errcode = 'P0001';
  end if;
  -- sem login, só nos eventos com a inscrição aberta ao público
  if not v_evento.inscricao_publica and (v_eu is null or not interno.associado_ativo(v_eu)) then
    raise exception 'A inscrição neste evento é só para os associados, pelo sistema.' using errcode = '42501';
  end if;
  if now() > coalesce(v_evento.inscricao_ate, v_evento.inicio) then
    raise exception 'As inscrições terminaram.' using errcode = 'P0001';
  end if;
  if not coalesce(p_aceite, false) then
    raise exception 'Para se inscrever, aceite o uso do seu nome e telefone para este evento (LGPD).' using errcode = 'P0001';
  end if;
  if v_nome is null or length(v_nome) < 3 or length(v_nome) > 120 then
    raise exception 'Informe o nome completo.' using errcode = 'P0001';
  end if;
  if length(v_telefone) not between 10 and 13 then
    raise exception 'Informe o telefone com DDD.' using errcode = 'P0001';
  end if;
  -- muitas inscrições em pouco tempo: espera (evita abuso da página pública)
  if (select count(*) from public.evento_inscricoes
      where evento_id = p_evento_id and criado_em > now() - interval '10 minutes') >= 60 then
    raise exception 'Muitas inscrições agora. Tente de novo em alguns minutos.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.evento_inscricoes where evento_id = p_evento_id and telefone = v_telefone and situacao <> 'cancelada') then
    raise exception 'Este telefone já está inscrito neste evento.' using errcode = 'P0001';
  end if;
  select count(*) into v_inscritos from public.evento_inscricoes where evento_id = p_evento_id and situacao <> 'cancelada';
  if v_evento.vagas is not null and v_inscritos >= v_evento.vagas then
    raise exception 'As vagas acabaram.' using errcode = 'P0001';
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from public.evento_inscricoes where evento_id = p_evento_id;
  v_situacao := case when v_evento.taxa > 0 then 'aguardando_pagamento' else 'confirmada' end;
  insert into public.evento_inscricoes (evento_id, numero, nome, telefone, igreja, pessoa_id, situacao, valor)
  values (p_evento_id, v_numero, v_nome, v_telefone, nullif(trim(p_igreja), ''), v_eu, v_situacao, v_evento.taxa);
  return jsonb_build_object('numero', v_numero, 'situacao', v_situacao, 'valor', v_evento.taxa);
end;
$$;

create function interno.cancelar_inscricao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inscricao public.evento_inscricoes;
begin
  select * into v_inscricao from public.evento_inscricoes where id = p_id and arquivado_em is null for update;
  if not found or v_inscricao.situacao = 'cancelada' then
    raise exception 'Inscrição não encontrada (ou já cancelada).' using errcode = 'P0001';
  end if;
  if not ((select interno.tenho_perfil('secretaria', 'presidencia'))
          or (v_inscricao.pessoa_id is not null and v_inscricao.pessoa_id = (select interno.minha_pessoa_id()))) then
    raise exception 'Só a secretaria, a presidência ou o próprio inscrito cancelam a inscrição.' using errcode = '42501';
  end if;
  if v_inscricao.pago_em is not null then
    raise exception 'A inscrição já foi paga: a devolução é com a tesouraria.' using errcode = 'P0001';
  end if;
  update public.evento_inscricoes
  set situacao = 'cancelada', cancelada_em = now(), motivo = coalesce(nullif(trim(p_motivo), ''), 'Cancelada')
  where id = p_id;
end;
$$;

-- A tesouraria registra o pagamento da taxa: a inscrição confirma e o valor entra no caixa, ligado ao evento
create function interno.registrar_pagamento_inscricao(p_id uuid, p_data date, p_forma text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inscricao public.evento_inscricoes;
  v_evento public.eventos;
  v_config public.config_financeiro;
  v_lancamento uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram o pagamento.' using errcode = '42501';
  end if;
  select * into v_inscricao from public.evento_inscricoes where id = p_id and arquivado_em is null for update;
  if not found or v_inscricao.situacao <> 'aguardando_pagamento' then
    raise exception 'Esta inscrição não está esperando pagamento.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data do pagamento (não pode ser futura).' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe a forma de pagamento (PIX, dinheiro…).' using errcode = 'P0001';
  end if;
  select * into v_evento from public.eventos where id = v_inscricao.evento_id;
  select * into v_config from public.config_financeiro where id;
  insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao, evento_id)
  values (
    case when p_forma ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end,
    'entrada',
    (select id from public.categorias_financeiras where sistema = 'inscricoes_eventos'),
    p_data, v_inscricao.valor,
    'Inscrição nº ' || v_inscricao.numero || ' — ' || v_evento.titulo || ' (' || trim(p_forma) || ')',
    'efetivado', v_evento.id
  )
  returning id into v_lancamento;
  update public.evento_inscricoes
  set situacao = 'confirmada', pago_em = p_data, lancamento_id = v_lancamento
  where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Lançamentos do caixa ligados ao evento (despesa só com o orçamento aprovado)
-- ---------------------------------------------------------------------
create function interno.ligar_lancamento_evento(p_lancamento_id uuid, p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
  v_evento public.eventos;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência ligam lançamentos aos eventos.' using errcode = '42501';
  end if;
  select * into v_lancamento from public.lancamentos where id = p_lancamento_id and arquivado_em is null for update;
  if not found or v_lancamento.situacao = 'cancelado' then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.evento_inscricoes where lancamento_id = p_lancamento_id) then
    raise exception 'Este lançamento é o pagamento de uma inscrição: já está ligado ao evento.' using errcode = 'P0001';
  end if;
  if p_evento_id is not null then
    select * into v_evento from public.eventos where id = p_evento_id and arquivado_em is null;
    if not found then
      raise exception 'Evento não encontrado.' using errcode = 'P0001';
    end if;
    if v_lancamento.tipo = 'saida' and v_evento.orcamento_aprovado_em is null then
      raise exception 'Despesa do evento só depois de o orçamento ser aprovado pela assembleia.' using errcode = 'P0001';
    end if;
  end if;
  update public.lancamentos set evento_id = p_evento_id where id = p_lancamento_id;
end;
$$;

-- Receitas, despesas e saldo de um evento (para a tesouraria, a presidência e o Conselho Fiscal)
create function interno.financas_do_evento(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')) then
    raise exception 'Só a tesouraria, a presidência e o Conselho Fiscal veem as finanças do evento.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'receitas', coalesce(sum(valor) filter (where tipo = 'entrada' and situacao = 'efetivado'), 0),
      'despesas', coalesce(sum(valor) filter (where tipo = 'saida' and situacao = 'efetivado'), 0),
      'aguardando', coalesce(sum(valor) filter (where tipo = 'saida' and situacao = 'aguardando_autorizacao'), 0)
    )
    from public.lancamentos where evento_id = p_evento_id and arquivado_em is null
  );
end;
$$;


-- ---------------------------------------------------------------------
-- O site (sem login): os eventos publicados e as vagas
-- ---------------------------------------------------------------------
create function interno.eventos_publicos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'tipo', e.tipo,
    'titulo', e.titulo,
    'descricao', e.descricao,
    'local', e.local,
    'inicio', e.inicio,
    'fim', e.fim,
    'situacao', e.situacao,
    'motivo_cancelamento', e.motivo_cancelamento,
    'inscricao', e.inscricao,
    'inscricao_publica', e.inscricao_publica,
    'inscricao_ate', coalesce(e.inscricao_ate, e.inicio),
    'taxa', e.taxa,
    'vagas_restantes', case when e.vagas is null then null else greatest(e.vagas - (
      select count(*) from public.evento_inscricoes i where i.evento_id = e.id and i.situacao <> 'cancelada'), 0) end
  ) order by e.inicio), '[]'::jsonb)
  from public.eventos e
  where e.arquivado_em is null and e.publicado_em is not null and e.situacao in ('publicado', 'cancelado', 'realizado')
    and coalesce(e.fim, e.inicio) >= now() - interval '60 days';
$$;


-- ---------------------------------------------------------------------
-- Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.eventos, public.evento_inscricoes from anon, authenticated;
grant select on public.eventos, public.evento_inscricoes to authenticated;
alter table public.eventos enable row level security;
alter table public.evento_inscricoes enable row level security;

create policy "eventos: publicados para todos com login; rascunhos, a diretoria"
  on public.eventos for select to authenticated
  using (
    arquivado_em is null
    and (publicado_em is not null or (select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')))
  );
create policy "inscrições: a diretoria, a tesouraria e o próprio inscrito"
  on public.evento_inscricoes for select to authenticated
  using (
    arquivado_em is null
    and ((select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria'))
         or pessoa_id = (select interno.minha_pessoa_id()))
  );

create function public.salvar_evento(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_evento(p_id, p_dados); $$;
create function public.publicar_evento(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.publicar_evento(p_id); $$;
create function public.cancelar_evento(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.cancelar_evento(p_id, p_motivo); $$;
create function public.concluir_evento(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.concluir_evento(p_id); $$;
create function public.arquivar_evento(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_evento(p_id); $$;
create function public.aprovar_orcamento_evento(p_id uuid, p_encontro_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.aprovar_orcamento_evento(p_id, p_encontro_id); $$;
create function public.inscrever_no_evento(p_evento_id uuid, p_nome text, p_telefone text, p_igreja text, p_aceite boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select interno.inscrever_no_evento(p_evento_id, p_nome, p_telefone, p_igreja, p_aceite);
$$;
create function public.cancelar_inscricao(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.cancelar_inscricao(p_id, p_motivo); $$;
create function public.registrar_pagamento_inscricao(p_id uuid, p_data date, p_forma text)
returns void language sql security invoker set search_path = '' as $$ select interno.registrar_pagamento_inscricao(p_id, p_data, p_forma); $$;
create function public.ligar_lancamento_evento(p_lancamento_id uuid, p_evento_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.ligar_lancamento_evento(p_lancamento_id, p_evento_id); $$;
create function public.financas_do_evento(p_evento_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.financas_do_evento(p_evento_id); $$;
create function public.eventos_publicos()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.eventos_publicos(); $$;

do $$
declare
  v text;
begin
  foreach v in array array[
    'salvar_evento(uuid, jsonb)', 'publicar_evento(uuid)', 'cancelar_evento(uuid, text)', 'concluir_evento(uuid)',
    'arquivar_evento(uuid)', 'aprovar_orcamento_evento(uuid, uuid)', 'cancelar_inscricao(uuid, text)',
    'registrar_pagamento_inscricao(uuid, date, text)', 'ligar_lancamento_evento(uuid, uuid)', 'financas_do_evento(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
  -- o site: sem login também
  foreach v in array array['inscrever_no_evento(uuid, text, text, text, boolean)', 'eventos_publicos()'] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to anon, authenticated', v);
    execute format('revoke all on function public.%s from public', v);
    execute format('grant execute on function public.%s to anon, authenticated', v);
  end loop;
end;
$$;
