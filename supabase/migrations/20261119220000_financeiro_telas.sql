-- =====================================================================
-- Telas novas, parte 9 (Fase 5.5): o Financeiro nas 6 funções aprovadas (rodada 11, 18/11/2026)
--
--   * os números do alto de cada função (saldo de hoje, recebido no exercício, em aberto);
--   * o caixa como extrato: o saldo no começo e no fim de um período e as contas abertas nele;
--   * os lançamentos com os nomes de quem lançou e de quem autorizou (vw_lancamentos);
--   * o orçamento por categoria vai para a assembleia ("Mandar para a assembleia", com a volta
--     para o rascunho) e só é aprovado depois de mandado;
--   * o plano anual de trabalho em atividades (o mês, o que é, quem cuida e quanto custa).
-- Nada se apaga: a atividade sai do plano arquivada; tudo vai para a auditoria.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Os números do alto do Financeiro
-- ---------------------------------------------------------------------
create function interno.numeros_do_financeiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_exercicio integer := interno.exercicio_de(current_date);
  v_saldo numeric;
  v_contribuicoes jsonb;
  v_informes jsonb;
  v_despesas jsonb;
  v_atraso integer;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')) then
    raise exception 'Só a tesouraria, a presidência e o Conselho Fiscal veem os números do financeiro.' using errcode = '42501';
  end if;

  select coalesce(sum(saldo), 0) into v_saldo from public.vw_saldos_contas;

  select jsonb_build_object(
    'previsto',  coalesce(round(sum(valor), 2), 0),
    'recebido',  coalesce(round(sum(valor_pago) filter (where situacao = 'paga'), 2), 0),
    'em_aberto', coalesce(round(sum(valor) filter (where situacao = 'aberta' and vencimento < current_date), 2), 0)
  )
  into v_contribuicoes
  from public.cobrancas
  where exercicio = v_exercicio and situacao <> 'cancelada' and arquivado_em is null;

  select jsonb_build_object('quantidade', count(*), 'valor', coalesce(round(sum(valor), 2), 0))
  into v_informes
  from public.informes_pagamento
  where situacao = 'pendente' and arquivado_em is null;

  select jsonb_build_object('quantidade', count(*), 'valor', coalesce(round(sum(valor), 2), 0))
  into v_despesas
  from public.lancamentos
  where situacao = 'aguardando_autorizacao' and arquivado_em is null;

  select count(*) into v_atraso from public.vw_situacao_contribuicao where not em_dia;

  return jsonb_build_object(
    'exercicio', v_exercicio,
    'saldo', round(v_saldo, 2),
    'contribuicoes', v_contribuicoes,
    'em_atraso', v_atraso,
    'para_conferir', v_informes,
    'despesas_esperando', v_despesas
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 2. O caixa como extrato: o saldo de todas as contas no começo e no fim de um período
--    (a mesma regra dos saldos: só o efetivado, a partir da data do saldo inicial de cada conta)
-- ---------------------------------------------------------------------
create function interno.saldo_do_caixa_em(p_data date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(round(sum(
    c.saldo_inicial + coalesce((
      select sum(case when l.tipo = 'entrada' then l.valor else -l.valor end)
      from public.lancamentos l
      where l.conta_id = c.id and l.situacao = 'efetivado' and l.arquivado_em is null
        and l.data >= c.saldo_inicial_em and l.data <= p_data
    ), 0)
  ), 2), 0)
  from public.contas_financeiras c
  where c.arquivado_em is null and c.saldo_inicial_em <= p_data;
$$;

create function interno.caixa_no_periodo(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')) then
    raise exception 'Só a tesouraria, a presidência e o Conselho Fiscal veem o caixa.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'Período inválido.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'inicio', p_inicio,
    'fim', p_fim,
    -- o saldo no fim do dia anterior ao começo
    'saldo_inicio', interno.saldo_do_caixa_em(p_inicio - 1),
    'saldo_fim', interno.saldo_do_caixa_em(p_fim),
    -- conta aberta dentro do período: o saldo inicial dela entra no dia da abertura
    'aberturas', coalesce((
      select jsonb_agg(jsonb_build_object('conta', nome, 'data', saldo_inicial_em, 'valor', saldo_inicial) order by saldo_inicial_em, nome)
      from public.contas_financeiras
      where arquivado_em is null and saldo_inicial_em between p_inicio and p_fim
    ), '[]'::jsonb)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Os lançamentos com os nomes (quem lançou e quem autorizou), para o extrato, as despesas e o Conselho Fiscal.
--    Vê só quem já vê os lançamentos (RLS das tabelas de baixo: security_invoker).
-- ---------------------------------------------------------------------
create view public.vw_lancamentos
with (security_invoker = true)
as
select
  l.id,
  l.conta_id,
  l.tipo,
  l.data,
  l.valor,
  l.descricao,
  l.comprovante_caminho,
  l.cobranca_id,
  l.transferencia_id,
  l.evento_id,
  l.situacao,
  l.motivo,
  l.autorizado_em,
  l.criado_em,
  c.nome as conta_nome,
  c.tipo as conta_tipo,
  c.saldo_inicial_em as conta_desde,
  cat.id as categoria_id,
  cat.nome as categoria_nome,
  cat.sistema as categoria_sistema,
  pa.id as autorizado_por_id,
  pa.nome as autorizado_por_nome,
  pl.id as lancado_por_id,
  pl.nome as lancado_por_nome,
  (l.situacao = 'efetivado' and l.data >= c.saldo_inicial_em) as no_saldo
from public.lancamentos l
join public.contas_financeiras c on c.id = l.conta_id
join public.categorias_financeiras cat on cat.id = l.categoria_id
left join public.pessoas pa on pa.id = l.autorizado_por
left join public.pessoas pl on pl.usuario_id = l.criado_por
where l.arquivado_em is null;
comment on view public.vw_lancamentos is 'Lançamentos do caixa com a conta, a categoria e os nomes de quem lançou e de quem autorizou.';


-- ---------------------------------------------------------------------
-- 4. O orçamento vai para a assembleia
-- ---------------------------------------------------------------------
alter table public.orcamentos
  add column enviado_em  timestamptz,
  add column enviado_por uuid references public.pessoas (id),
  add column encontro_id uuid references public.encontros (id);
comment on column public.orcamentos.enviado_em is 'Quando foi mandado para a assembleia: daí em diante não muda (a não ser que volte para o rascunho).';
comment on column public.orcamentos.encontro_id is 'A assembleia (AGO ou AGE) que vai apreciar o orçamento, se já marcada.';
create index orcamentos_enviado_por on public.orcamentos (enviado_por);
create index orcamentos_encontro on public.orcamentos (encontro_id);

-- os que já foram aprovados antes desta entrega contam como mandados (a aprovação veio da assembleia)
update public.orcamentos set enviado_em = criado_em where aprovado_em_assembleia is not null and enviado_em is null;
alter table public.orcamentos
  add constraint orcamentos_aprovado_depois_de_mandado check (aprovado_em_assembleia is null or enviado_em is not null);

-- O orçamento do exercício que ainda pode mudar (cria, se não existir). Para as funções do orçamento e do plano.
create function interno.orcamento_em_preparo(p_exercicio integer)
returns public.orcamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência preparam o orçamento.' using errcode = '42501';
  end if;
  if p_exercicio is null or p_exercicio not between 2000 and 2100 then
    raise exception 'Exercício inválido.' using errcode = 'P0001';
  end if;
  select * into v_orcamento from public.orcamentos where exercicio = p_exercicio and arquivado_em is null for update;
  if not found then
    insert into public.orcamentos (exercicio) values (p_exercicio) returning * into v_orcamento;
  elsif v_orcamento.aprovado_em_assembleia is not null then
    raise exception 'O orçamento de %/% já foi aprovado em assembleia e não muda mais.', p_exercicio, p_exercicio + 1
      using errcode = 'P0001';
  elsif v_orcamento.enviado_em is not null then
    raise exception 'O orçamento de %/% foi mandado para a assembleia. Para mudar, volte para o rascunho.', p_exercicio, p_exercicio + 1
      using errcode = 'P0001';
  end if;
  return v_orcamento;
end;
$$;

-- Salva o previsto por categoria. p_plano null mantém o texto do plano; '' apaga o texto.
create or replace function interno.salvar_orcamento(p_exercicio integer, p_plano text, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
  v_item jsonb;
  v_categoria uuid;
  v_valor numeric;
begin
  v_orcamento := interno.orcamento_em_preparo(p_exercicio);
  if p_plano is not null then
    update public.orcamentos set plano_trabalho = nullif(trim(p_plano), '') where id = v_orcamento.id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_categoria := (v_item ->> 'categoria_id')::uuid;
    v_valor := coalesce((v_item ->> 'valor')::numeric, 0);
    if v_valor < 0 then
      raise exception 'O valor previsto não pode ser negativo.' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.categorias_financeiras
      where id = v_categoria and coalesce(sistema, '') not like 'transferencia%'
    ) then
      raise exception 'Categoria inválida para o orçamento.' using errcode = 'P0001';
    end if;
    update public.orcamento_itens set valor = round(v_valor, 2)
    where orcamento_id = v_orcamento.id and categoria_id = v_categoria and arquivado_em is null;
    if not found then
      insert into public.orcamento_itens (orcamento_id, categoria_id, valor) values (v_orcamento.id, v_categoria, round(v_valor, 2));
    end if;
  end loop;
  return v_orcamento.id;
end;
$$;

-- "Mandar para a assembleia": daí em diante o orçamento não muda (a não ser que volte para o rascunho)
create function interno.mandar_orcamento(p_exercicio integer, p_encontro_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
begin
  v_orcamento := interno.orcamento_em_preparo(p_exercicio);
  if not exists (select 1 from public.orcamento_itens where orcamento_id = v_orcamento.id and arquivado_em is null and valor > 0) then
    raise exception 'Preencha o previsto de pelo menos uma categoria antes de mandar para a assembleia.' using errcode = 'P0001';
  end if;
  if p_encontro_id is not null and not exists (
    select 1 from public.encontros
    where id = p_encontro_id and arquivado_em is null and tipo in ('ago', 'age') and situacao <> 'cancelado'
  ) then
    raise exception 'Escolha uma assembleia (AGO ou AGE) que não foi cancelada.' using errcode = 'P0001';
  end if;
  update public.orcamentos
  set enviado_em = now(), enviado_por = (select interno.minha_pessoa_id()), encontro_id = p_encontro_id
  where id = v_orcamento.id;
end;
$$;

create function interno.voltar_orcamento(p_exercicio integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência mexem no orçamento.' using errcode = '42501';
  end if;
  update public.orcamentos
  set enviado_em = null, enviado_por = null, encontro_id = null
  where exercicio = p_exercicio and arquivado_em is null and enviado_em is not null and aprovado_em_assembleia is null;
  if not found then
    raise exception 'O orçamento de %/% não está esperando a assembleia.', p_exercicio, p_exercicio + 1 using errcode = 'P0001';
  end if;
end;
$$;

-- A aprovação da assembleia só vem depois de mandado
create or replace function interno.aprovar_orcamento(p_exercicio integer, p_data date, p_ata text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Quem registra a aprovação da assembleia é a presidência.' using errcode = '42501';
  end if;
  if p_data is null or p_data > current_date or coalesce(trim(p_ata), '') = '' then
    raise exception 'Informe a data da assembleia (não futura) e a ata.' using errcode = 'P0001';
  end if;
  select * into v_orcamento from public.orcamentos
  where exercicio = p_exercicio and arquivado_em is null and aprovado_em_assembleia is null for update;
  if not found then
    raise exception 'Não há orçamento em preparo para %/%.', p_exercicio, p_exercicio + 1 using errcode = 'P0001';
  end if;
  if v_orcamento.enviado_em is null then
    raise exception 'Mande o orçamento para a assembleia antes de registrar a aprovação.' using errcode = 'P0001';
  end if;
  update public.orcamentos
  set aprovado_em_assembleia = p_data, ata = trim(p_ata), aprovacao_registrada_por = (select interno.minha_pessoa_id())
  where id = v_orcamento.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O plano anual de trabalho em atividades (Art. 15, I)
-- ---------------------------------------------------------------------
create table public.plano_atividades (
  id            uuid primary key default gen_random_uuid(),
  orcamento_id  uuid not null references public.orcamentos (id),
  titulo        text not null check (length(trim(titulo)) between 2 and 200),
  mes           date check (mes is null or extract(day from mes) = 1),
  descricao     text check (descricao is null or length(descricao) <= 2000),
  responsavel   text check (responsavel is null or length(responsavel) <= 200),
  categoria_id  uuid references public.categorias_financeiras (id),
  valor         numeric(12, 2) check (valor is null or valor >= 0),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.plano_atividades is 'As atividades do plano anual de trabalho de cada exercício: o mês (vazio = o ano todo), quem cuida e quanto custa.';
comment on column public.plano_atividades.mes is 'O primeiro dia do mês da atividade, dentro do exercício; vazio = ao longo do ano.';
create index plano_atividades_orcamento on public.plano_atividades (orcamento_id, mes);
create index plano_atividades_categoria on public.plano_atividades (categoria_id);
select interno.aplicar_padroes('public.plano_atividades');

-- Cria (p_id null) ou corrige uma atividade
create function interno.salvar_atividade_plano(
  p_exercicio   integer,
  p_id          uuid,
  p_titulo      text,
  p_mes         date,
  p_descricao   text,
  p_responsavel text,
  p_categoria   uuid,
  p_valor       numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
  v_mes date := date_trunc('month', p_mes)::date;
  v_id uuid;
begin
  v_orcamento := interno.orcamento_em_preparo(p_exercicio);
  if length(trim(coalesce(p_titulo, ''))) < 2 then
    raise exception 'Diga o que é a atividade.' using errcode = 'P0001';
  end if;
  if v_mes is not null and v_mes not between make_date(p_exercicio, 4, 1) and make_date(p_exercicio + 1, 3, 1) then
    raise exception 'O mês da atividade precisa estar dentro do exercício (abril de % a março de %).', p_exercicio, p_exercicio + 1
      using errcode = 'P0001';
  end if;
  if p_valor is not null and p_valor < 0 then
    raise exception 'O valor não pode ser negativo.' using errcode = 'P0001';
  end if;
  if p_categoria is not null and not exists (
    select 1 from public.categorias_financeiras where id = p_categoria and coalesce(sistema, '') not like 'transferencia%'
  ) then
    raise exception 'Categoria inválida para o plano.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.plano_atividades (orcamento_id, titulo, mes, descricao, responsavel, categoria_id, valor)
    values (v_orcamento.id, trim(p_titulo), v_mes, nullif(trim(p_descricao), ''), nullif(trim(p_responsavel), ''),
            p_categoria, round(p_valor, 2))
    returning id into v_id;
  else
    update public.plano_atividades
    set titulo = trim(p_titulo), mes = v_mes, descricao = nullif(trim(p_descricao), ''),
        responsavel = nullif(trim(p_responsavel), ''), categoria_id = p_categoria, valor = round(p_valor, 2)
    where id = p_id and orcamento_id = v_orcamento.id and arquivado_em is null
    returning id into v_id;
    if v_id is null then
      raise exception 'Atividade não encontrada neste plano.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

-- Tirar do plano (nada se apaga: fica arquivada)
create function interno.arquivar_atividade_plano(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercicio integer;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência mexem no plano.' using errcode = '42501';
  end if;
  select o.exercicio into v_exercicio
  from public.plano_atividades a join public.orcamentos o on o.id = a.orcamento_id
  where a.id = p_id and a.arquivado_em is null;
  if not found then
    raise exception 'Atividade não encontrada.' using errcode = 'P0001';
  end if;
  perform interno.orcamento_em_preparo(v_exercicio);
  update public.plano_atividades set arquivado_em = now() where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Funções pela API (finas; quem confere é a função interna)
-- ---------------------------------------------------------------------
create function public.numeros_do_financeiro()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.numeros_do_financeiro(); $$;
create function public.caixa_no_periodo(p_inicio date, p_fim date)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.caixa_no_periodo(p_inicio, p_fim); $$;
create function public.mandar_orcamento(p_exercicio integer, p_encontro_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.mandar_orcamento(p_exercicio, p_encontro_id); $$;
create function public.voltar_orcamento(p_exercicio integer)
returns void language sql security invoker set search_path = '' as $$ select interno.voltar_orcamento(p_exercicio); $$;
create function public.salvar_atividade_plano(
  p_exercicio integer, p_id uuid, p_titulo text, p_mes date, p_descricao text, p_responsavel text, p_categoria uuid, p_valor numeric
)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.salvar_atividade_plano(p_exercicio, p_id, p_titulo, p_mes, p_descricao, p_responsavel, p_categoria, p_valor);
$$;
create function public.arquivar_atividade_plano(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_atividade_plano(p_id); $$;


-- ---------------------------------------------------------------------
-- 7. Permissões e regras de acesso
-- ---------------------------------------------------------------------
revoke all on function interno.numeros_do_financeiro() from public;
revoke all on function interno.saldo_do_caixa_em(date) from public;
revoke all on function interno.caixa_no_periodo(date, date) from public;
revoke all on function interno.orcamento_em_preparo(integer) from public;
revoke all on function interno.mandar_orcamento(integer, uuid) from public;
revoke all on function interno.voltar_orcamento(integer) from public;
revoke all on function interno.salvar_atividade_plano(integer, uuid, text, date, text, text, uuid, numeric) from public;
revoke all on function interno.arquivar_atividade_plano(uuid) from public;
grant execute on function interno.numeros_do_financeiro() to authenticated;
grant execute on function interno.caixa_no_periodo(date, date) to authenticated;
grant execute on function interno.mandar_orcamento(integer, uuid) to authenticated;
grant execute on function interno.voltar_orcamento(integer) to authenticated;
grant execute on function interno.salvar_atividade_plano(integer, uuid, text, date, text, text, uuid, numeric) to authenticated;
grant execute on function interno.arquivar_atividade_plano(uuid) to authenticated;

revoke all on function public.numeros_do_financeiro() from public, anon;
revoke all on function public.caixa_no_periodo(date, date) from public, anon;
revoke all on function public.mandar_orcamento(integer, uuid) from public, anon;
revoke all on function public.voltar_orcamento(integer) from public, anon;
revoke all on function public.salvar_atividade_plano(integer, uuid, text, date, text, text, uuid, numeric) from public, anon;
revoke all on function public.arquivar_atividade_plano(uuid) from public, anon;
grant execute on function public.numeros_do_financeiro() to authenticated;
grant execute on function public.caixa_no_periodo(date, date) to authenticated;
grant execute on function public.mandar_orcamento(integer, uuid) to authenticated;
grant execute on function public.voltar_orcamento(integer) to authenticated;
grant execute on function public.salvar_atividade_plano(integer, uuid, text, date, text, text, uuid, numeric) to authenticated;
grant execute on function public.arquivar_atividade_plano(uuid) to authenticated;

-- Tabela e vista: só leitura pela API; gravar, só pelas funções
revoke all on public.plano_atividades from anon, authenticated;
grant select on public.plano_atividades to authenticated;
revoke all on public.vw_lancamentos from anon, authenticated;
grant select on public.vw_lancamentos to authenticated;

alter table public.plano_atividades enable row level security;
create policy "plano de trabalho: tesouraria, presidência e Conselho Fiscal leem"
  on public.plano_atividades for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
