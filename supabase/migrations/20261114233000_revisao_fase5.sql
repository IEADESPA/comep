-- =====================================================================
-- REVISÃO GERAL DA FASE 5 — CORREÇÕES DO BANCO (14/11/2026)
--
-- Dois revisores independentes (banco e telas) leram a Fase 5. Aqui, as correções do banco:
--   1. Inscrição pública: limite por origem (o endereço vira um resumo, LGPD), o não pago deixa de segurar a
--      vaga depois de 72 horas, a mensagem não confirma se um telefone está inscrito, e o aceite fica guardado.
--   2. Cancelar o lançamento do pagamento devolve a inscrição para "aguardando o pagamento".
--   3. "Todos com login" passa a ser quem é do COMEP (tem algum perfil): quem só criou uma conta no site não lê
--      os avisos internos, as comissões nem os eventos (usa o site).
--   4. O orçamento é aprovado por uma assembleia do dia em que ele foi definido ou depois.
--   5. O painel não conta as transferências entre contas como entradas e saídas.
--   6. Cancelar o evento cancela as inscrições não pagas; evento cancelado não recebe pagamento.
--   7. A diretoria da igreja: uma gravação de cada vez.
--   8. A categoria "Inscrições em eventos" existe sempre; forma de pagamento aparada; conta do caixa conferida.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------
alter table public.eventos add column orcamento_definido_em timestamptz;
update public.eventos set orcamento_definido_em = criado_em where orcamento is not null and orcamento_definido_em is null;
comment on column public.eventos.orcamento_definido_em is 'Quando o valor do orçamento foi definido (a aprovação é de uma assembleia desse dia ou depois).';

alter table public.evento_inscricoes
  add column aceite_em timestamptz,
  add column aceite_texto text check (aceite_texto is null or length(aceite_texto) <= 300),
  add column origem text check (origem is null or origem ~ '^[0-9a-f]{32}$');
comment on column public.evento_inscricoes.aceite_em is 'Quando a pessoa aceitou o uso dos dados (LGPD, Art. 8º).';
comment on column public.evento_inscricoes.origem is 'Resumo (md5) do endereço de onde veio a inscrição pública: só para o limite contra abuso.';
create index evento_inscricoes_origem on public.evento_inscricoes (origem, criado_em) where origem is not null;

-- a categoria do sistema sempre existe (se já havia uma com o mesmo nome, ela passa a ser a do sistema)
update public.categorias_financeiras set sistema = 'inscricoes_eventos'
where sistema is null and arquivado_em is null and tipo = 'entrada' and lower(trim(nome)) = 'inscrições em eventos'
  and not exists (select 1 from public.categorias_financeiras where sistema = 'inscricoes_eventos');
insert into public.categorias_financeiras (nome, tipo, ordem, sistema)
select 'Inscrições em eventos (sistema)', 'entrada', 15, 'inscricoes_eventos'
where not exists (select 1 from public.categorias_financeiras where sistema = 'inscricoes_eventos');


-- ---------------------------------------------------------------------
-- Vagas ocupadas: as confirmadas e as que esperam pagamento há menos de 72 horas
-- ---------------------------------------------------------------------
create function interno.vagas_ocupadas(p_evento_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.evento_inscricoes i
  where i.evento_id = p_evento_id and i.arquivado_em is null
    and (i.situacao = 'confirmada' or (i.situacao = 'aguardando_pagamento' and i.criado_em > now() - interval '72 hours'));
$$;
revoke all on function interno.vagas_ocupadas(uuid) from public;

create or replace function interno.inscrever_no_evento(p_evento_id uuid, p_nome text, p_telefone text, p_igreja text, p_aceite boolean)
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
  v_cabecalhos jsonb;
  v_origem text;
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
  -- de onde veio o pedido (o endereço, só como resumo — LGPD): um limite por origem, e não um só para o evento todo
  begin
    v_cabecalhos := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_cabecalhos := null;
  end;
  v_origem := nullif(trim(split_part(coalesce(v_cabecalhos ->> 'cf-connecting-ip', v_cabecalhos ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_origem := case when v_origem is null then null else md5('comep-inscricao:' || v_origem) end;
  if v_eu is null and v_origem is not null and (
    select count(*) from public.evento_inscricoes
    where origem = v_origem and criado_em > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Muitas inscrições deste aparelho agora. Tente de novo mais tarde.' using errcode = 'P0001';
  end if;
  -- freio geral do evento (contra inscrições em massa)
  if (select count(*) from public.evento_inscricoes
      where evento_id = p_evento_id and criado_em > now() - interval '10 minutes') >= 60 then
    raise exception 'Muitas inscrições agora. Tente de novo em alguns minutos.' using errcode = 'P0001';
  end if;
  -- não confirma a quem é de fora se um telefone está inscrito
  if exists (select 1 from public.evento_inscricoes where evento_id = p_evento_id and telefone = v_telefone and situacao <> 'cancelada') then
    raise exception 'Não foi possível fazer a inscrição com este telefone. Se você já se inscreveu, guarde o número da inscrição; se não, fale com o COMEP.'
      using errcode = 'P0001';
  end if;
  v_inscritos := interno.vagas_ocupadas(p_evento_id);
  if v_evento.vagas is not null and v_inscritos >= v_evento.vagas then
    raise exception 'As vagas acabaram.' using errcode = 'P0001';
  end if;
  select coalesce(max(numero), 0) + 1 into v_numero from public.evento_inscricoes where evento_id = p_evento_id;
  v_situacao := case when v_evento.taxa > 0 then 'aguardando_pagamento' else 'confirmada' end;
  insert into public.evento_inscricoes (evento_id, numero, nome, telefone, igreja, pessoa_id, situacao, valor, aceite_em, aceite_texto, origem)
  values (p_evento_id, v_numero, v_nome, v_telefone, nullif(trim(p_igreja), ''), v_eu, v_situacao, v_evento.taxa, now(),
          'Aceito que o COMEP use o meu nome, telefone e igreja só para este evento (LGPD).', v_origem);
  return jsonb_build_object('numero', v_numero, 'situacao', v_situacao, 'valor', v_evento.taxa);
end;
$$;

create or replace function interno.eventos_publicos()
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
    'vagas_restantes', case when e.vagas is null then null else greatest(e.vagas - interno.vagas_ocupadas(e.id), 0) end
  ) order by e.inicio), '[]'::jsonb)
  from public.eventos e
  where e.arquivado_em is null and e.publicado_em is not null and e.situacao in ('publicado', 'cancelado', 'realizado')
    and coalesce(e.fim, e.inicio) >= now() - interval '60 days';
$$;

create or replace function interno.cancelar_evento(p_id uuid, p_motivo text)
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
  -- as inscrições não pagas caem junto; as pagas ficam (a devolução é com a tesouraria)
  update public.evento_inscricoes
  set situacao = 'cancelada', cancelada_em = now(), motivo = 'Evento cancelado'
  where evento_id = p_id and situacao <> 'cancelada' and pago_em is null;
end;
$$;

create or replace function interno.registrar_pagamento_inscricao(p_id uuid, p_data date, p_forma text)
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
  if v_evento.situacao = 'cancelado' then
    raise exception 'O evento foi cancelado: não se registra pagamento.' using errcode = 'P0001';
  end if;
  select * into v_config from public.config_financeiro where id;
  if (case when trim(p_forma) ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end) is null
     or not exists (select 1 from public.contas_financeiras c where c.arquivado_em is null
                    and c.id = case when trim(p_forma) ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end) then
    raise exception 'A conta do caixa para esta forma de pagamento não está definida (Financeiro → Caixa).' using errcode = 'P0001';
  end if;
  insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao, evento_id)
  values (
    case when trim(p_forma) ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end,
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

-- A secretaria libera de uma vez as inscrições que esperam pagamento há mais de 72 horas
create function interno.cancelar_inscricoes_sem_pagamento(p_evento_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantas integer;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência cancelam inscrições.' using errcode = '42501';
  end if;
  update public.evento_inscricoes
  set situacao = 'cancelada', cancelada_em = now(), motivo = 'Sem pagamento em 72 horas'
  where evento_id = p_evento_id and situacao = 'aguardando_pagamento' and pago_em is null
    and criado_em <= now() - interval '72 hours';
  get diagnostics v_quantas = row_count;
  return v_quantas;
end;
$$;
create function public.cancelar_inscricoes_sem_pagamento(p_evento_id uuid)
returns integer language sql security invoker set search_path = '' as $$ select interno.cancelar_inscricoes_sem_pagamento(p_evento_id); $$;
revoke all on function interno.cancelar_inscricoes_sem_pagamento(uuid) from public;
grant execute on function interno.cancelar_inscricoes_sem_pagamento(uuid) to authenticated;
revoke all on function public.cancelar_inscricoes_sem_pagamento(uuid) from public, anon;
grant execute on function public.cancelar_inscricoes_sem_pagamento(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Cancelar o lançamento do pagamento devolve a inscrição para "aguardando o pagamento"
-- ---------------------------------------------------------------------
create function interno.lancamento_de_inscricao_cancelado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao = 'cancelado' and old.situacao is distinct from 'cancelado' then
    update public.evento_inscricoes
    set situacao = 'aguardando_pagamento', pago_em = null, lancamento_id = null
    where lancamento_id = new.id;
  end if;
  return null;
end;
$$;
create trigger lancamento_de_inscricao_cancelado
  after update of situacao on public.lancamentos
  for each row execute function interno.lancamento_de_inscricao_cancelado();
revoke all on function interno.lancamento_de_inscricao_cancelado() from public;


-- ---------------------------------------------------------------------
-- Orçamento e painel
-- ---------------------------------------------------------------------
create or replace function interno.salvar_evento(p_id uuid, p_dados jsonb)
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
                                inscricao_ate, vagas, taxa, orcamento_definido_em)
    values (v_tipo, trim(p_dados ->> 'titulo'), nullif(trim(p_dados ->> 'descricao'), ''), nullif(trim(p_dados ->> 'local'), ''),
            v_inicio, v_fim, v_responsavel, v_orcamento, v_inscricao, v_publica, v_ate, v_vagas, v_taxa, now())
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
        orcamento_aprovado_em = case when v_orcamento is distinct from v_atual.orcamento then null else orcamento_aprovado_em end,
        orcamento_definido_em = case when v_orcamento is distinct from v_atual.orcamento then now() else orcamento_definido_em end
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function interno.aprovar_orcamento_evento(p_id uuid, p_encontro_id uuid)
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
  -- a assembleia que aprova é a do dia em que o orçamento foi definido ou depois (não uma antiga)
  if exists (
    select 1 from public.encontros e
    where e.id = p_encontro_id
      and (e.inicio at time zone 'America/Belem')::date < (v_evento.orcamento_definido_em at time zone 'America/Belem')::date
  ) then
    raise exception 'Esta assembleia é anterior a este orçamento: escolha a que aprovou este valor.' using errcode = 'P0001';
  end if;
  update public.eventos set orcamento_encontro_id = p_encontro_id, orcamento_aprovado_em = now() where id = p_id;
end;
$$;

create or replace function interno.painel_presidencia()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_config public.config_assembleias;
  v_mes date := date_trunc('month', current_date)::date;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'O painel é da presidência.' using errcode = '42501';
  end if;
  select * into v_config from public.config_assembleias where id;
  return jsonb_build_object(
    'associados', (
      select jsonb_build_object(
        'ativos', count(*),
        'em_dia', count(*) filter (where interno.esta_em_dia(a.pessoa_id)),
        'jubilados', count(*) filter (where a.jubilado),
        'igrejas', (select count(*) from public.igrejas where arquivado_em is null),
        'pedidos', (select count(*) from public.pedidos_associacao p
                    where p.arquivado_em is null and p.situacao in ('enviado', 'pendencia', 'aguardando_assembleia'))
      )
      from public.associados a where a.arquivado_em is null and a.situacao = 'ativo'
    ),
    'financas', jsonb_build_object(
      'saldo', (
        select coalesce(sum(c.saldo_inicial), 0)
          + coalesce((select sum(case when l.tipo = 'entrada' then l.valor else -l.valor end)
                      from public.lancamentos l join public.contas_financeiras c2 on c2.id = l.conta_id
                      where l.arquivado_em is null and l.situacao = 'efetivado' and l.data >= c2.saldo_inicial_em
                        and c2.arquivado_em is null), 0)
        from public.contas_financeiras c where c.arquivado_em is null
      ),
      -- transferências entre as contas do COMEP não são receita nem despesa (como na prestação de contas)
      'entradas_mes', (select coalesce(sum(l.valor), 0) from public.lancamentos l
                       join public.categorias_financeiras k on k.id = l.categoria_id
                       where l.arquivado_em is null and l.situacao = 'efetivado' and l.tipo = 'entrada' and l.data >= v_mes
                         and coalesce(k.sistema, '') not like 'transferencia%'),
      'saidas_mes', (select coalesce(sum(l.valor), 0) from public.lancamentos l
                     join public.categorias_financeiras k on k.id = l.categoria_id
                     where l.arquivado_em is null and l.situacao = 'efetivado' and l.tipo = 'saida' and l.data >= v_mes
                       and coalesce(k.sistema, '') not like 'transferencia%'),
      'despesas_a_autorizar', (select count(*) from public.lancamentos
                               where arquivado_em is null and situacao = 'aguardando_autorizacao'),
      'contribuicoes_vencidas', (select coalesce(sum(c.valor), 0) from public.cobrancas c
                                 join public.associados a on a.pessoa_id = c.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
                                 where c.situacao = 'aberta' and c.arquivado_em is null and c.vencimento < current_date),
      'pagamentos_a_conferir', (select count(*) from public.informes_pagamento where situacao = 'pendente' and arquivado_em is null)
    ),
    'presenca', jsonb_build_object(
      'ultimos', coalesce((
        select jsonb_agg(x order by x.inicio desc) from (
          select e.id, e.titulo, e.tipo, e.inicio,
                 (select count(*) from public.encontro_presencas p
                  where p.encontro_id = e.id and p.presente_em is not null and p.arquivado_em is null) as presentes
          from public.encontros e
          where e.arquivado_em is null and e.situacao = 'realizado'
          order by e.inicio desc limit 5
        ) x
      ), '[]'::jsonb),
      'com_faltas', (select count(*) from public.associados a
                     where a.arquivado_em is null and a.situacao = 'ativo' and interno.faltas_seguidas(a.pessoa_id) >= v_config.faltas_aviso),
      'justificativas_pendentes', (select count(*) from public.justificativas_falta where situacao = 'pendente' and arquivado_em is null)
    ),
    'agenda', jsonb_build_object(
      'encontros', coalesce((
        select jsonb_agg(x order by x.inicio) from (
          select e.id, e.titulo, e.tipo, e.inicio, e.situacao
          from public.encontros e
          where e.arquivado_em is null and e.situacao in ('agendado', 'convocado') and e.inicio >= now()
          order by e.inicio limit 5
        ) x
      ), '[]'::jsonb),
      'eventos', coalesce((
        select jsonb_agg(x order by x.inicio) from (
          select ev.id, ev.titulo, ev.tipo, ev.inicio, ev.situacao,
                 (select count(*) from public.evento_inscricoes i where i.evento_id = ev.id and i.situacao <> 'cancelada') as inscritos,
                 ev.vagas, ev.orcamento, ev.orcamento_aprovado_em is not null as orcamento_aprovado
          from public.eventos ev
          where ev.arquivado_em is null and ev.situacao in ('rascunho', 'publicado') and coalesce(ev.fim, ev.inicio) >= now()
          order by ev.inicio limit 8
        ) x
      ), '[]'::jsonb),
      'comissoes', (select count(*) from public.comissoes c where c.arquivado_em is null and interno.comissao_ativa(c.id))
    )
  );
end;
$$;

create or replace function interno.salvar_diretoria_igreja(p_igreja_id uuid, p_inicio date, p_fim date, p_membros jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro jsonb;
  v_quantos integer := 0;
begin
  if not interno.cuido_da_igreja(p_igreja_id) then
    raise exception 'Só o pastor presidente da igreja, a secretaria ou a presidência mudam a diretoria dela.' using errcode = '42501';
  end if;
  -- uma gravação de cada vez por igreja (dois cliques não deixam duas diretorias)
  perform 1 from public.igrejas where id = p_igreja_id and arquivado_em is null for update;
  if not found then
    raise exception 'Igreja não encontrada.' using errcode = 'P0001';
  end if;
  if p_inicio is not null and p_fim is not null and p_fim < p_inicio then
    raise exception 'O fim do mandato vem depois do início.' using errcode = 'P0001';
  end if;
  if p_membros is null or jsonb_typeof(p_membros) <> 'array' or jsonb_array_length(p_membros) = 0
     or jsonb_array_length(p_membros) > 30 then
    raise exception 'Informe de 1 a 30 membros da diretoria (cargo e nome).' using errcode = 'P0001';
  end if;
  update public.igreja_diretoria set arquivado_em = now() where igreja_id = p_igreja_id and arquivado_em is null;
  for v_membro in select * from jsonb_array_elements(p_membros) loop
    if coalesce(trim(v_membro ->> 'cargo'), '') = '' or coalesce(trim(v_membro ->> 'nome'), '') = '' then
      raise exception 'Cada membro da diretoria precisa do cargo e do nome.' using errcode = 'P0001';
    end if;
    insert into public.igreja_diretoria (igreja_id, cargo, nome, inicio, fim)
    values (p_igreja_id, trim(v_membro ->> 'cargo'), trim(v_membro ->> 'nome'), p_inicio, p_fim);
    v_quantos := v_quantos + 1;
  end loop;
  return v_quantos;
end;
$$;


-- ---------------------------------------------------------------------
-- "Todos com login" = quem é do COMEP (tem algum perfil); quem só criou uma conta usa o site
-- ---------------------------------------------------------------------
create function interno.sou_do_comep()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select interno.tenho_perfil('ministro', 'presidente_igreja', 'secretaria', 'tesouraria', 'presidencia',
                                      'conselho_fiscal', 'admin_tecnico'));
$$;
revoke all on function interno.sou_do_comep() from public;
grant execute on function interno.sou_do_comep() to authenticated;

drop policy "avisos: todos com login leem os que valem; a secretaria, todos" on public.avisos;
create policy "avisos: quem é do COMEP lê os que valem; a secretaria, todos"
  on public.avisos for select to authenticated
  using (
    arquivado_em is null
    and (
      (select interno.tenho_perfil('secretaria'))
      or ((select interno.sou_do_comep()) and (valido_ate is null or valido_ate >= current_date))
    )
  );

drop policy "comissões: todos com login veem" on public.comissoes;
create policy "comissões: quem é do COMEP vê"
  on public.comissoes for select to authenticated using (arquivado_em is null and (select interno.sou_do_comep()));
drop policy "membros das comissões: todos com login veem" on public.comissao_membros;
create policy "membros das comissões: quem é do COMEP vê"
  on public.comissao_membros for select to authenticated using (arquivado_em is null and (select interno.sou_do_comep()));

drop policy "eventos: publicados para todos com login; rascunhos, a diretoria" on public.eventos;
create policy "eventos: publicados para quem é do COMEP; rascunhos, a diretoria"
  on public.eventos for select to authenticated
  using (
    arquivado_em is null
    and ((publicado_em is not null and (select interno.sou_do_comep()))
         or (select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')))
  );
