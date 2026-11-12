-- =====================================================================
-- FASE 2.2 — CAIXA
--
-- * Contas (caixa em dinheiro, conta bancária) com saldo.
-- * Lançamentos de entrada e saída por categoria. Receitas do Art. 17:
--   contribuições dos associados, ofertas, doações e outras receitas.
-- * Despesa só vale depois de AUTORIZADA pelo presidente (Art. 12, §2º, VI);
--   ninguém autoriza a própria despesa.
-- * Contribuição paga vira entrada no caixa sozinha (dinheiro → caixa;
--   PIX/depósito/transferência → banco).
-- * Nada se apaga: lançamento errado é cancelado, com motivo.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tipos, contas e categorias
-- ---------------------------------------------------------------------
create type public.tipo_conta as enum ('caixa', 'banco');
create type public.tipo_lancamento as enum ('entrada', 'saida');
create type public.situacao_lancamento as enum ('efetivado', 'aguardando_autorizacao', 'recusado', 'cancelado');

create table public.contas_financeiras (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(trim(nome)) > 0),
  tipo             public.tipo_conta not null,
  saldo_inicial    numeric(12, 2) not null default 0,
  saldo_inicial_em date not null default current_date,
  arquivado_em     timestamptz,
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.contas_financeiras is 'Contas do COMEP (caixa em dinheiro, banco). O saldo é calculado pelos lançamentos.';
create unique index contas_financeiras_nome_unico on public.contas_financeiras (lower(trim(nome))) where arquivado_em is null;
select interno.aplicar_padroes('public.contas_financeiras');

create table public.categorias_financeiras (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) > 0),
  tipo          public.tipo_lancamento not null,
  ordem         integer not null default 100,
  sistema       text unique,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.categorias_financeiras is 'Categorias de entrada e saída (configuráveis). As marcadas em "sistema" são usadas automaticamente e não se arquivam.';
create unique index categorias_financeiras_nome_unico
  on public.categorias_financeiras (lower(trim(nome)), tipo) where arquivado_em is null;
select interno.aplicar_padroes('public.categorias_financeiras');

insert into public.categorias_financeiras (nome, tipo, ordem, sistema) values
  ('Contribuições dos associados', 'entrada', 10, 'contribuicoes'),
  ('Ofertas', 'entrada', 20, null),
  ('Doações', 'entrada', 30, null),
  ('Outras receitas', 'entrada', 90, null),
  ('Transferência recebida', 'entrada', 99, 'transferencia_entrada'),
  ('Eventos e encontros', 'saida', 10, null),
  ('Ação social', 'saida', 20, null),
  ('Material e expediente', 'saida', 30, null),
  ('Tarifas bancárias', 'saida', 40, null),
  ('Outras despesas', 'saida', 90, null),
  ('Transferência enviada', 'saida', 99, 'transferencia_saida');

-- Categoria do sistema não muda de nome nem é arquivada
create function interno.proteger_categoria_sistema()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.sistema is not null and (new.nome is distinct from old.nome or new.arquivado_em is distinct from old.arquivado_em
                                  or new.tipo is distinct from old.tipo) then
    raise exception 'Esta categoria é usada automaticamente pelo sistema e não pode ser alterada.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger proteger_categoria_sistema
  before update on public.categorias_financeiras
  for each row execute function interno.proteger_categoria_sistema();

-- Contas iniciais e para onde vão as contribuições pagas
alter table public.config_financeiro
  add column conta_dinheiro_id uuid references public.contas_financeiras (id),
  add column conta_banco_id    uuid references public.contas_financeiras (id);

insert into public.contas_financeiras (nome, tipo, saldo_inicial, saldo_inicial_em) values
  ('Caixa (dinheiro)', 'caixa', 0, make_date(interno.exercicio_de(current_date), 4, 1)),
  ('Conta bancária', 'banco', 0, make_date(interno.exercicio_de(current_date), 4, 1));

update public.config_financeiro
set conta_dinheiro_id = (select id from public.contas_financeiras where nome = 'Caixa (dinheiro)'),
    conta_banco_id    = (select id from public.contas_financeiras where nome = 'Conta bancária');


-- ---------------------------------------------------------------------
-- 2. Lançamentos
-- ---------------------------------------------------------------------
create table public.lancamentos (
  id                  uuid primary key default gen_random_uuid(),
  conta_id            uuid not null references public.contas_financeiras (id),
  tipo                public.tipo_lancamento not null,
  categoria_id        uuid not null references public.categorias_financeiras (id),
  data                date not null,
  valor               numeric(12, 2) not null check (valor > 0),
  descricao           text not null check (length(trim(descricao)) > 0),
  comprovante_caminho text,
  cobranca_id         uuid references public.cobrancas (id),
  transferencia_id    uuid,
  situacao            public.situacao_lancamento not null,
  autorizado_por      uuid references public.pessoas (id),
  autorizado_em       timestamptz,
  motivo              text,
  arquivado_em        timestamptz,
  criado_por          uuid default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
comment on table public.lancamentos is 'Entradas e saídas do caixa. Despesa só vale autorizada pelo presidente (Art. 12, §2º, VI). Nunca apagar: cancelar.';
create unique index lancamentos_um_por_cobranca on public.lancamentos (cobranca_id)
  where cobranca_id is not null and situacao <> 'cancelado';
create index lancamentos_conta_data on public.lancamentos (conta_id, data);
create index lancamentos_categoria on public.lancamentos (categoria_id);
create index lancamentos_autorizado_por on public.lancamentos (autorizado_por);
create index lancamentos_pendentes on public.lancamentos (criado_em) where situacao = 'aguardando_autorizacao';
select interno.aplicar_padroes('public.lancamentos');


-- ---------------------------------------------------------------------
-- 3. Operações (conferem o perfil de quem chama)
-- ---------------------------------------------------------------------
create function interno.lancar(
  p_conta_id    uuid,
  p_tipo        public.tipo_lancamento,
  p_categoria   uuid,
  p_data        date,
  p_valor       numeric,
  p_descricao   text,
  p_comprovante text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_categoria public.categorias_financeiras;
  v_id uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência lançam no caixa.' using errcode = '42501';
  end if;
  select * into v_categoria from public.categorias_financeiras where id = p_categoria and arquivado_em is null;
  if not found or v_categoria.tipo <> p_tipo then
    raise exception 'Escolha uma categoria de %.', case p_tipo when 'entrada' then 'entrada' else 'saída' end using errcode = 'P0001';
  end if;
  if v_categoria.sistema is not null then
    raise exception 'Esta categoria é usada automaticamente pelo sistema (contribuições e transferências).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contas_financeiras where id = p_conta_id and arquivado_em is null) then
    raise exception 'Escolha a conta.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'A data do lançamento não pode ser futura.' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor precisa ser maior que zero.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_descricao), '') = '' then
    raise exception 'Descreva o lançamento.' using errcode = 'P0001';
  end if;
  if p_comprovante is not null and not interno.caminho_seguro(p_comprovante, (select interno.minha_pessoa_id())) then
    raise exception 'O comprovante precisa ser um arquivo enviado por você.' using errcode = 'P0001';
  end if;

  insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, comprovante_caminho, situacao)
  values (p_conta_id, p_tipo, p_categoria, p_data, p_valor, trim(p_descricao), p_comprovante,
          case p_tipo when 'saida' then 'aguardando_autorizacao'::public.situacao_lancamento else 'efetivado' end)
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.autorizar_despesa(p_lancamento_id uuid, p_autorizar boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Só a presidência autoriza despesas (Art. 12, §2º, VI).' using errcode = '42501';
  end if;
  select * into v_lancamento from public.lancamentos where id = p_lancamento_id for update;
  if not found or v_lancamento.situacao <> 'aguardando_autorizacao' then
    raise exception 'Esta despesa não está aguardando autorização.' using errcode = 'P0001';
  end if;
  if v_lancamento.criado_por = (select auth.uid()) then
    raise exception 'Ninguém autoriza a própria despesa: outra pessoa da presidência precisa autorizar.' using errcode = '42501';
  end if;
  if not p_autorizar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da recusa.' using errcode = 'P0001';
  end if;
  update public.lancamentos
  set situacao = case when p_autorizar then 'efetivado'::public.situacao_lancamento else 'recusado' end,
      autorizado_por = (select interno.minha_pessoa_id()),
      autorizado_em = now(),
      motivo = case when p_autorizar then null else trim(p_motivo) end
  where id = p_lancamento_id;
end;
$$;

create function interno.cancelar_lancamento(p_lancamento_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência cancelam lançamentos.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  select * into v_lancamento from public.lancamentos where id = p_lancamento_id for update;
  if not found or v_lancamento.situacao in ('cancelado', 'recusado') then
    raise exception 'Este lançamento já está cancelado ou recusado.' using errcode = 'P0001';
  end if;
  if v_lancamento.cobranca_id is not null then
    raise exception 'Entrada automática de contribuição: não se cancela pelo caixa.' using errcode = 'P0001';
  end if;
  update public.lancamentos set situacao = 'cancelado', motivo = trim(p_motivo)
  where id = p_lancamento_id or (v_lancamento.transferencia_id is not null and transferencia_id = v_lancamento.transferencia_id);
end;
$$;

create function interno.transferir(p_origem uuid, p_destino uuid, p_data date, p_valor numeric, p_descricao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_par uuid := gen_random_uuid();
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência transferem entre contas.' using errcode = '42501';
  end if;
  if p_origem = p_destino or (select count(*) from public.contas_financeiras where id in (p_origem, p_destino) and arquivado_em is null) <> 2 then
    raise exception 'Escolha duas contas diferentes.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date or p_valor is null or p_valor <= 0 then
    raise exception 'Informe data (não futura) e valor maior que zero.' using errcode = 'P0001';
  end if;
  insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, transferencia_id, situacao) values
    (p_origem, 'saida', (select id from public.categorias_financeiras where sistema = 'transferencia_saida'),
     p_data, p_valor, coalesce(nullif(trim(p_descricao), ''), 'Transferência entre contas'), v_par, 'efetivado'),
    (p_destino, 'entrada', (select id from public.categorias_financeiras where sistema = 'transferencia_entrada'),
     p_data, p_valor, coalesce(nullif(trim(p_descricao), ''), 'Transferência entre contas'), v_par, 'efetivado');
end;
$$;

-- Contribuição paga → entrada no caixa (dinheiro → caixa; o resto → banco)
create function interno.contribuicao_no_caixa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.config_financeiro;
  v_nome text;
begin
  if new.situacao = 'paga' and old.situacao is distinct from 'paga' and coalesce(new.valor_pago, 0) > 0 then
    select * into v_config from public.config_financeiro where id;
    select nome into v_nome from public.pessoas where id = new.pessoa_id;
    insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, cobranca_id, situacao, criado_por)
    values (
      case when new.forma_pagamento ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end,
      'entrada',
      (select id from public.categorias_financeiras where sistema = 'contribuicoes'),
      new.pago_em,
      new.valor_pago,
      'Contribuição de ' || v_nome || ' — ' ||
        case new.tipo when 'anual' then 'anuidade ' || new.exercicio || '/' || (new.exercicio + 1)
                      else 'mensalidade ' || to_char(new.competencia, 'MM/YYYY') end,
      new.id,
      'efetivado',
      auth.uid()
    )
    on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger contribuicao_no_caixa
  after update of situacao on public.cobrancas
  for each row execute function interno.contribuicao_no_caixa();

-- Contribuições já pagas antes do caixa existir entram também
insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, cobranca_id, situacao, criado_por)
select
  case when c.forma_pagamento ilike 'dinheiro%' then cf.conta_dinheiro_id else cf.conta_banco_id end,
  'entrada',
  (select id from public.categorias_financeiras where sistema = 'contribuicoes'),
  c.pago_em,
  c.valor_pago,
  'Contribuição de ' || p.nome || ' — ' ||
    case c.tipo when 'anual' then 'anuidade ' || c.exercicio || '/' || (c.exercicio + 1)
                else 'mensalidade ' || to_char(c.competencia, 'MM/YYYY') end,
  c.id,
  'efetivado',
  c.criado_por
from public.cobrancas c
join public.pessoas p on p.id = c.pessoa_id
cross join public.config_financeiro cf
where c.situacao = 'paga' and coalesce(c.valor_pago, 0) > 0 and c.arquivado_em is null;

-- Entradas pela API
create function public.lancar(p_conta_id uuid, p_tipo public.tipo_lancamento, p_categoria uuid, p_data date,
                              p_valor numeric, p_descricao text, p_comprovante text)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.lancar(p_conta_id, p_tipo, p_categoria, p_data, p_valor, p_descricao, p_comprovante);
$$;
create function public.autorizar_despesa(p_lancamento_id uuid, p_autorizar boolean, p_motivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.autorizar_despesa(p_lancamento_id, p_autorizar, p_motivo);
$$;
create function public.cancelar_lancamento(p_lancamento_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.cancelar_lancamento(p_lancamento_id, p_motivo);
$$;
create function public.transferir(p_origem uuid, p_destino uuid, p_data date, p_valor numeric, p_descricao text)
returns void language sql security invoker set search_path = '' as $$
  select interno.transferir(p_origem, p_destino, p_data, p_valor, p_descricao);
$$;


-- ---------------------------------------------------------------------
-- 4. Saldos (só lançamentos efetivados, a partir da data do saldo inicial)
-- ---------------------------------------------------------------------
create view public.vw_saldos_contas
with (security_invoker = true)
as
select
  c.id,
  c.nome,
  c.tipo,
  c.saldo_inicial,
  c.saldo_inicial_em,
  coalesce(sum(l.valor) filter (where l.tipo = 'entrada' and l.situacao = 'efetivado'), 0)::numeric(12, 2) as entradas,
  coalesce(sum(l.valor) filter (where l.tipo = 'saida' and l.situacao = 'efetivado'), 0)::numeric(12, 2) as saidas,
  (c.saldo_inicial
    + coalesce(sum(l.valor) filter (where l.tipo = 'entrada' and l.situacao = 'efetivado'), 0)
    - coalesce(sum(l.valor) filter (where l.tipo = 'saida' and l.situacao = 'efetivado'), 0))::numeric(12, 2) as saldo,
  coalesce(sum(l.valor) filter (where l.situacao = 'aguardando_autorizacao'), 0)::numeric(12, 2) as aguardando_autorizacao
from public.contas_financeiras c
left join public.lancamentos l
  on l.conta_id = c.id and l.arquivado_em is null and l.data >= c.saldo_inicial_em
where c.arquivado_em is null
group by c.id;


-- ---------------------------------------------------------------------
-- 5. Permissões e regras de acesso
-- ---------------------------------------------------------------------
revoke all on function interno.proteger_categoria_sistema() from public;
revoke all on function interno.contribuicao_no_caixa() from public;
revoke all on function interno.lancar(uuid, public.tipo_lancamento, uuid, date, numeric, text, text) from public;
revoke all on function interno.autorizar_despesa(uuid, boolean, text) from public;
revoke all on function interno.cancelar_lancamento(uuid, text) from public;
revoke all on function interno.transferir(uuid, uuid, date, numeric, text) from public;
grant execute on function interno.lancar(uuid, public.tipo_lancamento, uuid, date, numeric, text, text) to authenticated;
grant execute on function interno.autorizar_despesa(uuid, boolean, text) to authenticated;
grant execute on function interno.cancelar_lancamento(uuid, text) to authenticated;
grant execute on function interno.transferir(uuid, uuid, date, numeric, text) to authenticated;

revoke all on function public.lancar(uuid, public.tipo_lancamento, uuid, date, numeric, text, text) from public, anon;
revoke all on function public.autorizar_despesa(uuid, boolean, text) from public, anon;
revoke all on function public.cancelar_lancamento(uuid, text) from public, anon;
revoke all on function public.transferir(uuid, uuid, date, numeric, text) from public, anon;
grant execute on function public.lancar(uuid, public.tipo_lancamento, uuid, date, numeric, text, text) to authenticated;
grant execute on function public.autorizar_despesa(uuid, boolean, text) to authenticated;
grant execute on function public.cancelar_lancamento(uuid, text) to authenticated;
grant execute on function public.transferir(uuid, uuid, date, numeric, text) to authenticated;

revoke all on public.contas_financeiras, public.categorias_financeiras, public.lancamentos, public.vw_saldos_contas
  from anon, authenticated;
grant select on public.contas_financeiras, public.categorias_financeiras, public.lancamentos, public.vw_saldos_contas
  to authenticated;
grant insert (nome, tipo, saldo_inicial, saldo_inicial_em) on public.contas_financeiras to authenticated;
grant update (nome, saldo_inicial, saldo_inicial_em, arquivado_em) on public.contas_financeiras to authenticated;
grant insert (nome, tipo, ordem) on public.categorias_financeiras to authenticated;
grant update (nome, ordem, arquivado_em) on public.categorias_financeiras to authenticated;
grant update (conta_dinheiro_id, conta_banco_id) on public.config_financeiro to authenticated;

alter table public.contas_financeiras    enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.lancamentos           enable row level security;

create policy "contas: tesouraria e presidência leem"
  on public.contas_financeiras for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')));
create policy "contas: tesouraria e presidência cadastram"
  on public.contas_financeiras for insert to authenticated
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));
create policy "contas: tesouraria e presidência alteram"
  on public.contas_financeiras for update to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')))
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));

create policy "categorias financeiras: tesouraria e presidência leem"
  on public.categorias_financeiras for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')));
create policy "categorias financeiras: tesouraria e presidência cadastram"
  on public.categorias_financeiras for insert to authenticated
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));
create policy "categorias financeiras: tesouraria e presidência alteram"
  on public.categorias_financeiras for update to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')))
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));

create policy "lançamentos: tesouraria e presidência leem"
  on public.lancamentos for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')));
