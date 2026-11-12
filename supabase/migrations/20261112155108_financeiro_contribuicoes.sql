-- =====================================================================
-- FASE 2.1 — CONTRIBUIÇÕES (mensalidades e anuidade)
--
-- Regras (PROJETO.md, 4.4; diretoria, 11/11/2026):
--   * exercício de 1º de abril a 31 de março;
--   * o associado paga por mês ou o ano inteiro em abril;
--   * valor pela categoria: presidente de igreja, não presidente, jubilado (isento);
--   * só vota e é votado quem está em dia (Art. 11).
-- Padrões PROVISÓRIOS até a diretoria responder (perguntas 17 a 20), configuráveis:
--   * mensalidade vence no dia 10; anuidade vence em 30 de abril;
--   * quem é admitido no meio do exercício paga a partir do mês da admissão
--     (se escolheu anual e entrou depois de abril, paga mensal no resto do exercício);
--   * em atraso = alguma cobrança vencida e não paga;
--   * taxa de inscrição: ainda sem valor (pergunta 17) — não é cobrada.
--
-- Todas as gravações passam por funções que conferem quem pode fazer o quê;
-- as tabelas só aceitam leitura pela API.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Configuração do financeiro (uma linha)
-- ---------------------------------------------------------------------
create table public.config_financeiro (
  id                    boolean primary key default true check (id),
  dia_vencimento_mensal integer not null default 10 check (dia_vencimento_mensal between 1 and 28),
  dia_vencimento_anual  integer not null default 30 check (dia_vencimento_anual between 1 and 30),
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
comment on table public.config_financeiro is 'Vencimentos das contribuições (uma linha). Padrões provisórios até a decisão 18.';
select interno.aplicar_padroes('public.config_financeiro');
insert into public.config_financeiro (id) values (true);


-- ---------------------------------------------------------------------
-- 2. Plano do associado em cada exercício (mensal ou anual)
-- ---------------------------------------------------------------------
create table public.planos_contribuicao (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoas (id),
  exercicio     integer not null check (exercicio between 2020 and 2100),
  tipo          public.tipo_valor not null check (tipo in ('mensal', 'anual')),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.planos_contribuicao is 'Plano escolhido (mensal ou anual) por exercício. Sem plano = mensal.';
create unique index planos_contribuicao_unico on public.planos_contribuicao (pessoa_id, exercicio) where arquivado_em is null;
select interno.aplicar_padroes('public.planos_contribuicao');


-- ---------------------------------------------------------------------
-- 3. Cobranças
-- ---------------------------------------------------------------------
create type public.situacao_cobranca as enum ('aberta', 'paga', 'cancelada');

create table public.cobrancas (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas (id),
  exercicio       integer not null,
  tipo            public.tipo_valor not null,
  competencia     date not null,
  vencimento      date not null,
  categoria       public.categoria_contribuicao not null,
  valor           numeric(10, 2) not null check (valor >= 0),
  situacao        public.situacao_cobranca not null default 'aberta',
  pago_em         date,
  valor_pago      numeric(10, 2) check (valor_pago is null or valor_pago >= 0),
  forma_pagamento text,
  confirmado_por  uuid references public.pessoas (id),
  confirmado_em   timestamptz,
  observacao      text,
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint cobrancas_paga_tem_dados check (situacao <> 'paga' or (pago_em is not null and valor_pago is not null))
);
comment on table public.cobrancas is 'Mensalidades e anuidades de cada associado. Nunca apagar: cancelar (com motivo).';
create unique index cobrancas_unica on public.cobrancas (pessoa_id, tipo, competencia)
  where situacao <> 'cancelada' and arquivado_em is null;
create index cobrancas_pessoa on public.cobrancas (pessoa_id, exercicio);
create index cobrancas_abertas on public.cobrancas (vencimento) where situacao = 'aberta';
create index cobrancas_confirmado_por on public.cobrancas (confirmado_por);
select interno.aplicar_padroes('public.cobrancas');


-- ---------------------------------------------------------------------
-- 4. Pagamentos informados pelo associado (com comprovante)
-- ---------------------------------------------------------------------
create type public.situacao_informe as enum ('pendente', 'confirmado', 'recusado', 'cancelado');

create table public.informes_pagamento (
  id                  uuid primary key default gen_random_uuid(),
  cobranca_id         uuid not null references public.cobrancas (id),
  pessoa_id           uuid not null references public.pessoas (id),
  data_pagamento      date not null,
  valor               numeric(10, 2) not null check (valor >= 0),
  forma               text not null,
  comprovante_caminho text,
  observacao          text,
  situacao            public.situacao_informe not null default 'pendente',
  motivo_recusa       text,
  analisado_por       uuid references public.pessoas (id),
  analisado_em        timestamptz,
  arquivado_em        timestamptz,
  criado_por          uuid default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
comment on table public.informes_pagamento is 'Pagamentos informados pelo associado, conferidos pela tesouraria.';
create unique index informes_pagamento_um_pendente on public.informes_pagamento (cobranca_id)
  where situacao = 'pendente' and arquivado_em is null;
create index informes_pagamento_pessoa on public.informes_pagamento (pessoa_id);
create index informes_pagamento_analisado on public.informes_pagamento (analisado_por);
create index informes_pagamento_pendentes on public.informes_pagamento (criado_em) where situacao = 'pendente';
select interno.aplicar_padroes('public.informes_pagamento');


-- ---------------------------------------------------------------------
-- 5. Funções auxiliares
-- ---------------------------------------------------------------------
-- Exercício (ano em que começa: abril) de uma data
create function interno.exercicio_de(p_data date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when extract(month from p_data) >= 4 then extract(year from p_data)::integer
              else extract(year from p_data)::integer - 1 end;
$$;

-- Valor vigente numa data, para a categoria e o tipo
create function interno.valor_vigente(p_categoria public.categoria_contribuicao, p_tipo public.tipo_valor, p_data date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select v.valor
  from public.valores_contribuicao v
  where v.categoria = p_categoria and v.tipo = p_tipo and v.vigente_desde <= p_data and v.arquivado_em is null
  order by v.vigente_desde desc, v.criado_em desc
  limit 1;
$$;

-- Gera (sem repetir) as cobranças de uma pessoa no exercício. Não confere permissão: quem chama confere.
create function interno.gerar_cobrancas_pessoa(p_pessoa_id uuid, p_exercicio integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assoc       record;
  v_config      public.config_financeiro;
  v_plano       public.tipo_valor;
  v_inicio      date := make_date(p_exercicio, 4, 1);
  v_primeiro    date;
  v_competencia date;
  v_valor       numeric;
  v_criadas     integer := 0;
begin
  select a.pessoa_id, a.admitido_em, a.jubilado, v.categoria_contribuicao
  into v_assoc
  from public.associados a
  join public.vw_associados v on v.id = a.id
  where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found or v_assoc.jubilado then
    return 0; -- não é associado ativo, ou é jubilado (isento)
  end if;

  select * into v_config from public.config_financeiro where id;
  select tipo into v_plano from public.planos_contribuicao
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  v_primeiro := greatest(v_inicio, date_trunc('month', coalesce(v_assoc.admitido_em, v_inicio))::date);
  if v_primeiro > make_date(p_exercicio + 1, 3, 1) then
    return 0; -- admitido depois do fim do exercício
  end if;

  if coalesce(v_plano, 'mensal') = 'anual' and v_primeiro = v_inicio then
    v_valor := interno.valor_vigente(v_assoc.categoria_contribuicao, 'anual', v_inicio);
    if v_valor is not null and not exists (
      select 1 from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.situacao <> 'cancelada' and c.arquivado_em is null
    ) then
      insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
      values (p_pessoa_id, p_exercicio, 'anual', v_inicio, make_date(p_exercicio, 4, v_config.dia_vencimento_anual),
              v_assoc.categoria_contribuicao, v_valor);
      v_criadas := 1;
    end if;
    return v_criadas;
  end if;

  -- Mensal (também para quem escolheu anual mas entrou depois de abril)
  if exists (
    select 1 from public.cobrancas c
    where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo = 'anual'
      and c.situacao <> 'cancelada' and c.arquivado_em is null
  ) then
    return 0;
  end if;
  for m in 0..11 loop
    v_competencia := (v_inicio + make_interval(months => m))::date;
    continue when v_competencia < v_primeiro;
    v_valor := interno.valor_vigente(v_assoc.categoria_contribuicao, 'mensal', v_competencia);
    continue when v_valor is null;
    if not exists (
      select 1 from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.tipo = 'mensal' and c.competencia = v_competencia
        and c.situacao <> 'cancelada' and c.arquivado_em is null
    ) then
      insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
      values (p_pessoa_id, p_exercicio, 'mensal', v_competencia, v_competencia + (v_config.dia_vencimento_mensal - 1),
              v_assoc.categoria_contribuicao, v_valor);
      v_criadas := v_criadas + 1;
    end if;
  end loop;
  return v_criadas;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Operações (todas conferem o perfil de quem chama)
-- ---------------------------------------------------------------------
-- Tesouraria/presidência: gera as cobranças do exercício para todos os associados ativos
create function interno.gerar_cobrancas(p_exercicio integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_pessoa uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência geram cobranças.' using errcode = '42501';
  end if;
  for v_pessoa in select pessoa_id from public.associados where arquivado_em is null and situacao = 'ativo' loop
    v_total := v_total + interno.gerar_cobrancas_pessoa(v_pessoa, p_exercicio);
  end loop;
  return v_total;
end;
$$;

-- O próprio associado (ou a tesouraria) escolhe mensal ou anual — enquanto nada do exercício foi pago
create function interno.escolher_plano(p_pessoa_id uuid, p_exercicio integer, p_tipo public.tipo_valor)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo not in ('mensal', 'anual') then
    raise exception 'Escolha mensal ou anual.' using errcode = 'P0001';
  end if;
  if not (p_pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia'))) then
    raise exception 'Só o próprio associado ou a tesouraria escolhem o plano.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.associados where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo'
  ) then
    raise exception 'Só associado ativo tem plano de contribuição.' using errcode = 'P0001';
  end if;
  if p_tipo = 'anual' and exists (
    select 1 from public.associados
    where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo'
      and admitido_em >= make_date(p_exercicio, 5, 1)
  ) then
    raise exception 'Quem foi admitido depois de abril paga por mês neste exercício (a anuidade vence em abril).' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.cobrancas
    where pessoa_id = p_pessoa_id and exercicio = p_exercicio and situacao = 'paga' and arquivado_em is null
  ) or exists (
    select 1 from public.informes_pagamento i join public.cobrancas c on c.id = i.cobranca_id
    where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and i.situacao = 'pendente'
  ) then
    raise exception 'Já há pagamento neste exercício: o plano não muda mais até março. Fale com a tesouraria.' using errcode = 'P0001';
  end if;

  update public.planos_contribuicao set arquivado_em = now()
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  insert into public.planos_contribuicao (pessoa_id, exercicio, tipo) values (p_pessoa_id, p_exercicio, p_tipo);

  -- Cobranças em aberto do outro plano saem; as do plano novo entram (se o exercício já foi gerado)
  if exists (select 1 from public.cobrancas where pessoa_id = p_pessoa_id and exercicio = p_exercicio) then
    update public.cobrancas
    set situacao = 'cancelada', observacao = 'Plano trocado para ' || p_tipo::text || '.'
    where pessoa_id = p_pessoa_id and exercicio = p_exercicio and situacao = 'aberta' and tipo <> p_tipo;
    perform interno.gerar_cobrancas_pessoa(p_pessoa_id, p_exercicio);
  end if;
end;
$$;

-- O associado informa que pagou (uma ou várias cobranças, mesmo comprovante)
create function interno.informar_pagamento(
  p_cobrancas   uuid[],
  p_data        date,
  p_forma       text,
  p_comprovante text,
  p_observacao  text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_cobranca public.cobrancas;
  v_criados integer := 0;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para informar o pagamento.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_cobrancas, 1), 0) = 0 then
    raise exception 'Escolha qual mensalidade (ou anuidade) você pagou.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data do pagamento (não pode ser futura).' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe a forma de pagamento (PIX, depósito, dinheiro…).' using errcode = 'P0001';
  end if;
  if p_comprovante is not null and not interno.caminho_seguro(p_comprovante, v_eu) then
    raise exception 'O comprovante precisa ser um arquivo enviado por você.' using errcode = 'P0001';
  end if;

  for v_cobranca in select * from public.cobrancas where id = any (p_cobrancas) for update loop
    if v_cobranca.pessoa_id <> v_eu then
      raise exception 'Só se informa pagamento das próprias contribuições.' using errcode = '42501';
    end if;
    if v_cobranca.situacao <> 'aberta' then
      raise exception 'Uma das contribuições escolhidas já está paga ou cancelada.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.informes_pagamento where cobranca_id = v_cobranca.id and situacao = 'pendente') then
      raise exception 'Uma das contribuições escolhidas já tem pagamento informado, aguardando a tesouraria.' using errcode = 'P0001';
    end if;
    insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma, comprovante_caminho, observacao)
    values (v_cobranca.id, v_eu, p_data, v_cobranca.valor, trim(p_forma), p_comprovante, nullif(trim(p_observacao), ''));
    v_criados := v_criados + 1;
  end loop;
  if v_criados <> array_length(p_cobrancas, 1) then
    raise exception 'Contribuição não encontrada.' using errcode = 'P0001';
  end if;
  return v_criados;
end;
$$;

-- Tesouraria confere o pagamento informado: confirma (a cobrança fica paga) ou recusa (com motivo)
create function interno.analisar_informe(p_informe_id uuid, p_confirmar boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_informe public.informes_pagamento;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência conferem pagamentos.' using errcode = '42501';
  end if;
  select * into v_informe from public.informes_pagamento where id = p_informe_id for update;
  if not found or v_informe.situacao <> 'pendente' then
    raise exception 'Este pagamento informado já foi conferido.' using errcode = 'P0001';
  end if;
  if v_informe.pessoa_id = v_eu then
    raise exception 'Ninguém confere o próprio pagamento: outra pessoa da tesouraria ou da presidência precisa fazer isso.'
      using errcode = '42501';
  end if;

  if p_confirmar then
    update public.informes_pagamento
    set situacao = 'confirmado', analisado_por = v_eu, analisado_em = now()
    where id = p_informe_id;
    update public.cobrancas
    set situacao = 'paga', pago_em = v_informe.data_pagamento, valor_pago = v_informe.valor,
        forma_pagamento = v_informe.forma, confirmado_por = v_eu, confirmado_em = now()
    where id = v_informe.cobranca_id and situacao = 'aberta';
  else
    if coalesce(trim(p_motivo), '') = '' then
      raise exception 'Informe o motivo da recusa (ex.: comprovante ilegível, valor diferente).' using errcode = 'P0001';
    end if;
    update public.informes_pagamento
    set situacao = 'recusado', motivo_recusa = trim(p_motivo), analisado_por = v_eu, analisado_em = now()
    where id = p_informe_id;
  end if;
end;
$$;

-- Tesouraria registra pagamento recebido direto (ex.: em dinheiro na reunião mensal)
create function interno.registrar_pagamento(p_cobranca_id uuid, p_data date, p_valor numeric, p_forma text, p_observacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_cobranca public.cobrancas;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram pagamentos.' using errcode = '42501';
  end if;
  select * into v_cobranca from public.cobrancas where id = p_cobranca_id for update;
  if not found or v_cobranca.situacao <> 'aberta' then
    raise exception 'Esta contribuição não está em aberto.' using errcode = 'P0001';
  end if;
  if v_cobranca.pessoa_id = v_eu then
    raise exception 'Ninguém registra o próprio pagamento: outra pessoa da tesouraria ou da presidência precisa fazer isso.'
      using errcode = '42501';
  end if;
  if p_data is null or p_data > current_date or p_valor is null or p_valor < 0 or coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe data (não futura), valor e forma do pagamento.' using errcode = 'P0001';
  end if;
  update public.cobrancas
  set situacao = 'paga', pago_em = p_data, valor_pago = p_valor, forma_pagamento = trim(p_forma),
      confirmado_por = v_eu, confirmado_em = now(), observacao = nullif(trim(p_observacao), '')
  where id = p_cobranca_id;
  -- Algum aviso do próprio associado sobre esta cobrança deixa de valer
  update public.informes_pagamento
  set situacao = 'cancelado', analisado_por = v_eu, analisado_em = now(), motivo_recusa = 'Pagamento registrado direto pela tesouraria.'
  where cobranca_id = p_cobranca_id and situacao = 'pendente';
end;
$$;

-- Tesouraria cancela uma cobrança lançada errada (com motivo; nada se apaga)
create function interno.cancelar_cobranca(p_cobranca_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência cancelam cobranças.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  update public.cobrancas set situacao = 'cancelada', observacao = trim(p_motivo)
  where id = p_cobranca_id and situacao = 'aberta';
  if not found then
    raise exception 'Só cobrança em aberto pode ser cancelada.' using errcode = 'P0001';
  end if;
  update public.informes_pagamento set situacao = 'cancelado', motivo_recusa = 'Cobrança cancelada: ' || trim(p_motivo)
  where cobranca_id = p_cobranca_id and situacao = 'pendente';
end;
$$;

-- Entradas pela API
create function public.gerar_cobrancas(p_exercicio integer) returns integer
language sql security invoker set search_path = '' as $$ select interno.gerar_cobrancas(p_exercicio); $$;
create function public.escolher_plano(p_pessoa_id uuid, p_exercicio integer, p_tipo public.tipo_valor) returns void
language sql security invoker set search_path = '' as $$ select interno.escolher_plano(p_pessoa_id, p_exercicio, p_tipo); $$;
create function public.informar_pagamento(p_cobrancas uuid[], p_data date, p_forma text, p_comprovante text, p_observacao text)
returns integer
language sql security invoker set search_path = '' as $$
  select interno.informar_pagamento(p_cobrancas, p_data, p_forma, p_comprovante, p_observacao);
$$;
create function public.analisar_informe(p_informe_id uuid, p_confirmar boolean, p_motivo text) returns void
language sql security invoker set search_path = '' as $$ select interno.analisar_informe(p_informe_id, p_confirmar, p_motivo); $$;
create function public.registrar_pagamento(p_cobranca_id uuid, p_data date, p_valor numeric, p_forma text, p_observacao text)
returns void
language sql security invoker set search_path = '' as $$
  select interno.registrar_pagamento(p_cobranca_id, p_data, p_valor, p_forma, p_observacao);
$$;
create function public.cancelar_cobranca(p_cobranca_id uuid, p_motivo text) returns void
language sql security invoker set search_path = '' as $$ select interno.cancelar_cobranca(p_cobranca_id, p_motivo); $$;


-- ---------------------------------------------------------------------
-- 7. Situação de cada associado: em dia ou em atraso (Art. 11)
--    security_invoker: o ministro vê só a sua; a tesouraria/presidência veem todas.
-- ---------------------------------------------------------------------
create view public.vw_situacao_contribuicao
with (security_invoker = true)
as
select
  v.pessoa_id,
  v.nome,
  v.numero_registro,
  v.igreja,
  v.categoria_contribuicao,
  v.jubilado,
  coalesce(e.vencidas, 0) as cobrancas_vencidas,
  coalesce(e.valor_vencido, 0) as valor_vencido,
  coalesce(e.vencidas, 0) = 0 as em_dia
from public.vw_associados v
left join lateral (
  select count(*)::integer as vencidas, sum(c.valor) as valor_vencido
  from public.cobrancas c
  where c.pessoa_id = v.pessoa_id and c.situacao = 'aberta' and c.vencimento < current_date and c.arquivado_em is null
) e on true
where v.situacao = 'ativo';

comment on view public.vw_situacao_contribuicao is 'Em dia = nenhuma cobrança vencida e não paga (Art. 11). Respeita a RLS de quem consulta.';


-- ---------------------------------------------------------------------
-- 8. Painel do presidente de igreja: passa a mostrar quem está em dia
-- ---------------------------------------------------------------------
drop function public.ministros_da_minha_igreja();
drop function interno.ministros_da_minha_igreja();

create function interno.ministros_da_minha_igreja()
returns table (
  pessoa_id         uuid,
  nome              text,
  telefone          text,
  numero_registro   integer,
  titulo            text,
  funcao            text,
  pastor_presidente boolean,
  igreja_id         uuid,
  em_dia            boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.pessoa_id, p.nome, p.telefone, a.numero_registro, tm.nome, v.funcao, v.pastor_presidente, v.igreja_id,
         not exists (
           select 1 from public.cobrancas c
           where c.pessoa_id = a.pessoa_id and c.situacao = 'aberta' and c.vencimento < current_date and c.arquivado_em is null
         )
  from public.vinculos_igreja v
  join public.associados a
    on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  join public.pessoas p on p.id = v.pessoa_id
  left join lateral (
    select tp.titulo_id
    from public.titulos_pessoa tp
    where tp.pessoa_id = v.pessoa_id and tp.arquivado_em is null
    order by tp.criado_em desc
    limit 1
  ) t on true
  left join public.titulos_ministeriais tm on tm.id = t.titulo_id
  where v.fim is null
    and v.arquivado_em is null
    and v.igreja_id in (select interno.igrejas_que_presido())
  order by v.pastor_presidente desc, p.nome;
$$;

create function public.ministros_da_minha_igreja()
returns table (
  pessoa_id         uuid,
  nome              text,
  telefone          text,
  numero_registro   integer,
  titulo            text,
  funcao            text,
  pastor_presidente boolean,
  igreja_id         uuid,
  em_dia            boolean
)
language sql
security invoker
set search_path = ''
as $$ select * from interno.ministros_da_minha_igreja(); $$;


-- ---------------------------------------------------------------------
-- 9. A tesouraria passa a ver os arquivos (comprovantes de pagamento)
-- ---------------------------------------------------------------------
drop policy "documentos: ver os próprios ou ser da secretaria/presidência" on storage.objects;
create policy "documentos: ver os próprios ou ser da secretaria/tesouraria/presidência"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
      or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
    )
  );


-- ---------------------------------------------------------------------
-- 10. Permissões (as tabelas só se leem pela API; gravar, só pelas funções)
-- ---------------------------------------------------------------------
revoke all on function interno.exercicio_de(date) from public;
revoke all on function interno.valor_vigente(public.categoria_contribuicao, public.tipo_valor, date) from public;
revoke all on function interno.gerar_cobrancas_pessoa(uuid, integer) from public;
revoke all on function interno.gerar_cobrancas(integer) from public;
revoke all on function interno.escolher_plano(uuid, integer, public.tipo_valor) from public;
revoke all on function interno.informar_pagamento(uuid[], date, text, text, text) from public;
revoke all on function interno.analisar_informe(uuid, boolean, text) from public;
revoke all on function interno.registrar_pagamento(uuid, date, numeric, text, text) from public;
revoke all on function interno.cancelar_cobranca(uuid, text) from public;
revoke all on function interno.ministros_da_minha_igreja() from public;

grant execute on function interno.exercicio_de(date) to authenticated;
grant execute on function interno.gerar_cobrancas(integer) to authenticated;
grant execute on function interno.escolher_plano(uuid, integer, public.tipo_valor) to authenticated;
grant execute on function interno.informar_pagamento(uuid[], date, text, text, text) to authenticated;
grant execute on function interno.analisar_informe(uuid, boolean, text) to authenticated;
grant execute on function interno.registrar_pagamento(uuid, date, numeric, text, text) to authenticated;
grant execute on function interno.cancelar_cobranca(uuid, text) to authenticated;
grant execute on function interno.ministros_da_minha_igreja() to authenticated;

revoke all on function public.gerar_cobrancas(integer) from public, anon;
revoke all on function public.escolher_plano(uuid, integer, public.tipo_valor) from public, anon;
revoke all on function public.informar_pagamento(uuid[], date, text, text, text) from public, anon;
revoke all on function public.analisar_informe(uuid, boolean, text) from public, anon;
revoke all on function public.registrar_pagamento(uuid, date, numeric, text, text) from public, anon;
revoke all on function public.cancelar_cobranca(uuid, text) from public, anon;
revoke all on function public.ministros_da_minha_igreja() from public, anon;
grant execute on function public.gerar_cobrancas(integer) to authenticated;
grant execute on function public.escolher_plano(uuid, integer, public.tipo_valor) to authenticated;
grant execute on function public.informar_pagamento(uuid[], date, text, text, text) to authenticated;
grant execute on function public.analisar_informe(uuid, boolean, text) to authenticated;
grant execute on function public.registrar_pagamento(uuid, date, numeric, text, text) to authenticated;
grant execute on function public.cancelar_cobranca(uuid, text) to authenticated;
grant execute on function public.ministros_da_minha_igreja() to authenticated;

revoke all on public.config_financeiro, public.planos_contribuicao, public.cobrancas, public.informes_pagamento,
              public.vw_situacao_contribuicao
  from anon, authenticated;
grant select on public.config_financeiro, public.planos_contribuicao, public.cobrancas, public.informes_pagamento,
                public.vw_situacao_contribuicao
  to authenticated;
grant update (dia_vencimento_mensal, dia_vencimento_anual) on public.config_financeiro to authenticated;


-- ---------------------------------------------------------------------
-- 11. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.config_financeiro   enable row level security;
alter table public.planos_contribuicao enable row level security;
alter table public.cobrancas           enable row level security;
alter table public.informes_pagamento  enable row level security;

create policy "config financeiro: todos com login leem"
  on public.config_financeiro for select to authenticated using (true);
create policy "config financeiro: tesouraria e presidência alteram"
  on public.config_financeiro for update to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')))
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));

create policy "planos: ver o próprio ou ser da tesouraria/presidência"
  on public.planos_contribuicao for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia')));

create policy "cobranças: ver as próprias ou ser da tesouraria/presidência"
  on public.cobrancas for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia')));

create policy "informes: ver os próprios ou ser da tesouraria/presidência"
  on public.informes_pagamento for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia')));
