-- =====================================================================
-- Telas novas, parte 10 (Fase 5.5): o Conselho Fiscal aprova as contas mês a mês (rodadas 13 e 14, 18/11/2026)
--
--   * o painel do ano (do exercício, abril a março): os 12 meses e a situação de cada um;
--   * o mês: o Conselho aprova (ou aprova com ressalva) e guarda a "fotografia" dos números; se os números
--     do mês mudarem depois, a aprovação deixa de valer e o mês volta para a análise ("mudou");
--   * os pedidos de esclarecimento (sobre o mês ou sobre um lançamento) e as respostas da tesouraria, com o
--     comprovante que faltava;
--   * as assinaturas dos membros (no mês e no parecer do ano);
--   * o parecer do ano só sai com os 12 meses aprovados.
-- O Conselho Fiscal é independente da diretoria (como no parecer do balanço): quem tem perfil da diretoria não decide.
-- Nada se apaga: a aprovação que deixou de valer fica arquivada; tudo vai para a auditoria.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create type public.decisao_mes as enum ('aprovado', 'aprovado_com_ressalva');

create table public.conselho_meses (
  id            uuid primary key default gen_random_uuid(),
  competencia   date not null check (extract(day from competencia) = 1),
  decisao       public.decisao_mes not null,
  ressalva      text check (ressalva is null or length(trim(ressalva)) between 3 and 2000),
  -- a fotografia dos números do mês no dia da aprovação
  entradas      numeric(12, 2) not null,
  saidas        numeric(12, 2) not null,
  lancamentos   integer not null,
  saldo_inicio  numeric(12, 2) not null,
  saldo_fim     numeric(12, 2) not null,
  sem_movimento boolean not null default false,
  decidido_por  uuid not null references public.pessoas (id),
  decidido_em   timestamptz not null default now(),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint conselho_meses_ressalva check ((decisao = 'aprovado_com_ressalva') = (ressalva is not null))
);
comment on table public.conselho_meses is 'A aprovação das contas de cada mês pelo Conselho Fiscal, com os números do dia. Mudou o mês, a aprovação deixa de valer (fica arquivada quando o mês é aprovado de novo).';
create unique index conselho_meses_um_por_mes on public.conselho_meses (competencia) where arquivado_em is null;
create index conselho_meses_decidido_por on public.conselho_meses (decidido_por);
select interno.aplicar_padroes('public.conselho_meses');

create table public.conselho_assinaturas (
  id            uuid primary key default gen_random_uuid(),
  mes_id        uuid references public.conselho_meses (id),
  balanco_id    uuid references public.balancos (id),
  pessoa_id     uuid not null references public.pessoas (id),
  assinado_em   timestamptz not null default now(),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint conselho_assinaturas_um_alvo check ((mes_id is null) <> (balanco_id is null))
);
comment on table public.conselho_assinaturas is 'Quem do Conselho Fiscal assinou a aprovação de um mês ou o parecer do ano (o do ano vale a partir do parecer em vigor).';
create unique index conselho_assinaturas_mes on public.conselho_assinaturas (mes_id, pessoa_id) where mes_id is not null and arquivado_em is null;
create index conselho_assinaturas_balanco on public.conselho_assinaturas (balanco_id, pessoa_id) where balanco_id is not null;
create index conselho_assinaturas_pessoa on public.conselho_assinaturas (pessoa_id);
select interno.aplicar_padroes('public.conselho_assinaturas');

create table public.esclarecimentos (
  id              uuid primary key default gen_random_uuid(),
  competencia     date not null check (extract(day from competencia) = 1),
  lancamento_id   uuid references public.lancamentos (id),
  pergunta        text not null check (length(trim(pergunta)) between 3 and 2000),
  perguntado_por  uuid not null references public.pessoas (id),
  perguntado_em   timestamptz not null default now(),
  resposta        text check (resposta is null or length(trim(resposta)) between 2 and 4000),
  resposta_arquivo text,
  respondido_por  uuid references public.pessoas (id),
  respondido_em   timestamptz,
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint esclarecimentos_resposta check ((resposta is null) = (respondido_em is null) and (resposta is null) = (respondido_por is null))
);
comment on table public.esclarecimentos is 'Os pedidos de esclarecimento do Conselho Fiscal sobre um mês (ou um lançamento) e as respostas da tesouraria.';
create index esclarecimentos_competencia on public.esclarecimentos (competencia);
create index esclarecimentos_abertos on public.esclarecimentos (perguntado_em) where respondido_em is null and arquivado_em is null;
create index esclarecimentos_lancamento on public.esclarecimentos (lancamento_id);
create index esclarecimentos_perguntado_por on public.esclarecimentos (perguntado_por);
create index esclarecimentos_respondido_por on public.esclarecimentos (respondido_por);
select interno.aplicar_padroes('public.esclarecimentos');


-- ---------------------------------------------------------------------
-- 2. Os números de um mês e a situação dele
-- ---------------------------------------------------------------------

-- Quem decide pelo Conselho Fiscal: tem o perfil e não é da diretoria (como no parecer do balanço)
create function interno.exigir_conselho_independente()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('conselho_fiscal')) then
    raise exception 'Só o Conselho Fiscal aprova as contas (Art. 14).' using errcode = '42501';
  end if;
  if (select interno.tenho_perfil('presidencia', 'tesouraria', 'secretaria')) then
    raise exception 'O Conselho Fiscal é independente da diretoria: quem tem perfil da diretoria não aprova as contas.'
      using errcode = '42501';
  end if;
end;
$$;

-- As entradas e as saídas efetivadas do mês (sem as transferências), quantos lançamentos e os saldos
create function interno.numeros_do_mes(p_competencia date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mov as (
    select l.tipo, l.valor, coalesce(cat.sistema, '') like 'transferencia%' as transferencia
    from public.lancamentos l
    join public.contas_financeiras c on c.id = l.conta_id
    join public.categorias_financeiras cat on cat.id = l.categoria_id
    where l.situacao = 'efetivado' and l.arquivado_em is null and l.data >= c.saldo_inicial_em
      and l.data >= p_competencia and l.data < (p_competencia + interval '1 month')::date
  )
  select jsonb_build_object(
    'entradas', coalesce(round(sum(valor) filter (where tipo = 'entrada' and not transferencia), 2), 0),
    'saidas', coalesce(round(sum(valor) filter (where tipo = 'saida' and not transferencia), 2), 0),
    'lancamentos', count(*),
    'saldo_inicio', interno.saldo_do_caixa_em(p_competencia - 1),
    'saldo_fim', interno.saldo_do_caixa_em(((p_competencia + interval '1 month')::date - 1))
  )
  from mov;
$$;

-- A aprovação ainda vale? (os números do mês são os mesmos do dia em que foi aprovado)
create function interno.aprovacao_vale(p_mes public.conselho_meses)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_mes.id is not null and p_mes.arquivado_em is null
     and (n ->> 'entradas')::numeric = p_mes.entradas
     and (n ->> 'saidas')::numeric = p_mes.saidas
     and (n ->> 'lancamentos')::integer = p_mes.lancamentos
  from (select interno.numeros_do_mes(p_mes.competencia) as n) x;
$$;

-- Os 12 meses do exercício (abril a março), com os números, a situação, a aprovação e os pedidos
create function interno.meses_do_conselho(p_exercicio integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mes_atual date := date_trunc('month', current_date)::date;
  v_resultado jsonb := '[]'::jsonb;
  v_comp date;
  v_numeros jsonb;
  v_aprovacao public.conselho_meses;
  v_abertas integer;
  v_respondidas integer;
  v_vale boolean;
  v_situacao text;
begin
  if not (select interno.tenho_perfil('conselho_fiscal', 'tesouraria', 'presidencia')) then
    raise exception 'Só o Conselho Fiscal, a tesouraria e a presidência veem as contas dos meses.' using errcode = '42501';
  end if;
  for i in 0..11 loop
    v_comp := (make_date(p_exercicio, 4, 1) + make_interval(months => i))::date;
    v_numeros := interno.numeros_do_mes(v_comp);
    select * into v_aprovacao from public.conselho_meses where competencia = v_comp and arquivado_em is null;
    v_vale := found and interno.aprovacao_vale(v_aprovacao);
    select count(*) filter (where respondido_em is null), count(*) filter (where respondido_em is not null)
    into v_abertas, v_respondidas
    from public.esclarecimentos where competencia = v_comp and arquivado_em is null;

    v_situacao := case
      when v_comp > v_mes_atual then 'futuro'
      when v_abertas > 0 then 'esclarecimento'
      when v_comp = v_mes_atual then 'aberto'
      when v_vale and v_aprovacao.decisao = 'aprovado' then 'aprovado'
      when v_vale then 'ressalva'
      when v_aprovacao.id is not null then 'mudou'
      else 'para_analisar'
    end;

    v_resultado := v_resultado || jsonb_build_object(
      'competencia', v_comp,
      'situacao', v_situacao,
      'entradas', v_numeros -> 'entradas',
      'saidas', v_numeros -> 'saidas',
      'lancamentos', v_numeros -> 'lancamentos',
      'saldo_inicio', v_numeros -> 'saldo_inicio',
      'saldo_fim', v_numeros -> 'saldo_fim',
      'perguntas_abertas', v_abertas,
      'perguntas_respondidas', v_respondidas,
      'aprovacao', case when v_aprovacao.id is null then null else jsonb_build_object(
        'id', v_aprovacao.id,
        'decisao', v_aprovacao.decisao,
        'ressalva', v_aprovacao.ressalva,
        'sem_movimento', v_aprovacao.sem_movimento,
        'vale', v_vale,
        'decidido_em', v_aprovacao.decidido_em,
        'decidido_por', (select nome from public.pessoas where id = v_aprovacao.decidido_por),
        'assinaturas', coalesce((
          select jsonb_agg(jsonb_build_object('pessoa_id', a.pessoa_id, 'nome', p.nome, 'em', a.assinado_em) order by a.assinado_em)
          from public.conselho_assinaturas a join public.pessoas p on p.id = a.pessoa_id
          where a.mes_id = v_aprovacao.id and a.arquivado_em is null
        ), '[]'::jsonb)
      ) end
    );
  end loop;
  return v_resultado;
end;
$$;

-- Os membros do Conselho Fiscal hoje (pelo perfil dado à mão ou pelo mandato), para as assinaturas
create function interno.membros_conselho_fiscal()
returns table (pessoa_id uuid, nome text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('conselho_fiscal', 'tesouraria', 'presidencia')) then
    raise exception 'Sem permissão para ver os membros do Conselho Fiscal.' using errcode = '42501';
  end if;
  return query
  select distinct p.id, p.nome
  from public.pessoas p
  where p.arquivado_em is null and (
    exists (
      select 1 from public.perfis_acesso pa
      where pa.pessoa_id = p.id and pa.perfil = 'conselho_fiscal' and pa.arquivado_em is null and not interno.saiu_do_comep(p.id)
    )
    or exists (
      select 1 from public.mandatos m
      join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where m.pessoa_id = p.id and m.cargo = 'conselheiro_fiscal' and m.arquivado_em is null
        and current_date between m.inicio and interno.fim_efetivo(m)
    )
  )
  order by p.nome;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Aprovar o mês, assinar e os meses sem movimento
-- ---------------------------------------------------------------------
create function interno.gravar_aprovacao_mes(p_competencia date, p_decisao public.decisao_mes, p_ressalva text, p_sem_movimento boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numeros jsonb := interno.numeros_do_mes(p_competencia);
  v_id uuid;
begin
  -- a aprovação que deixou de valer (o mês mudou) fica arquivada
  update public.conselho_meses set arquivado_em = now() where competencia = p_competencia and arquivado_em is null;
  insert into public.conselho_meses (competencia, decisao, ressalva, entradas, saidas, lancamentos, saldo_inicio, saldo_fim,
                                     sem_movimento, decidido_por)
  values (p_competencia, p_decisao, nullif(trim(p_ressalva), ''), (v_numeros ->> 'entradas')::numeric, (v_numeros ->> 'saidas')::numeric,
          (v_numeros ->> 'lancamentos')::integer, (v_numeros ->> 'saldo_inicio')::numeric, (v_numeros ->> 'saldo_fim')::numeric,
          p_sem_movimento, (select interno.minha_pessoa_id()))
  returning id into v_id;
  insert into public.conselho_assinaturas (mes_id, pessoa_id) values (v_id, (select interno.minha_pessoa_id()));
  return v_id;
end;
$$;

create function interno.decidir_mes(p_competencia date, p_decisao public.decisao_mes, p_ressalva text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
  v_atual public.conselho_meses;
begin
  perform interno.exigir_conselho_independente();
  if v_comp is null or v_comp >= date_trunc('month', current_date)::date then
    raise exception 'Só se aprova um mês que já terminou.' using errcode = 'P0001';
  end if;
  if p_decisao is null then
    raise exception 'Escolha: aprovar ou aprovar com ressalva.' using errcode = 'P0001';
  end if;
  if p_decisao = 'aprovado_com_ressalva' and length(trim(coalesce(p_ressalva, ''))) < 3 then
    raise exception 'Escreva a ressalva.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.esclarecimentos where competencia = v_comp and respondido_em is null and arquivado_em is null) then
    raise exception 'Há pedido de esclarecimento sem resposta neste mês: espere a resposta da tesouraria.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('comep: conselho fiscal ' || v_comp));
  select * into v_atual from public.conselho_meses where competencia = v_comp and arquivado_em is null;
  if found and interno.aprovacao_vale(v_atual) then
    raise exception 'As contas deste mês já foram aprovadas. Para assinar junto, use "Assinar também".' using errcode = 'P0001';
  end if;
  return interno.gravar_aprovacao_mes(v_comp, p_decisao, case when p_decisao = 'aprovado' then null else p_ressalva end, false);
end;
$$;

create function interno.assinar_mes(p_mes_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mes public.conselho_meses;
begin
  perform interno.exigir_conselho_independente();
  select * into v_mes from public.conselho_meses where id = p_mes_id and arquivado_em is null;
  if not found or not interno.aprovacao_vale(v_mes) then
    raise exception 'Esta aprovação não vale mais: os números do mês mudaram.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.conselho_assinaturas where mes_id = p_mes_id and pessoa_id = (select interno.minha_pessoa_id()) and arquivado_em is null) then
    raise exception 'Você já assinou este mês.' using errcode = 'P0001';
  end if;
  insert into public.conselho_assinaturas (mes_id, pessoa_id) values (p_mes_id, (select interno.minha_pessoa_id()));
end;
$$;

-- Os meses que já terminaram e não tiveram movimento (ex.: antes de o sistema começar) se aprovam de uma vez
create function interno.aprovar_meses_sem_movimento(p_exercicio integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp date;
  v_atual public.conselho_meses;
  v_quantos integer := 0;
begin
  perform interno.exigir_conselho_independente();
  for i in 0..11 loop
    v_comp := (make_date(p_exercicio, 4, 1) + make_interval(months => i))::date;
    exit when v_comp >= date_trunc('month', current_date)::date;
    continue when (interno.numeros_do_mes(v_comp) ->> 'lancamentos')::integer > 0;
    continue when exists (select 1 from public.esclarecimentos where competencia = v_comp and respondido_em is null and arquivado_em is null);
    select * into v_atual from public.conselho_meses where competencia = v_comp and arquivado_em is null;
    continue when found and interno.aprovacao_vale(v_atual);
    perform interno.gravar_aprovacao_mes(v_comp, 'aprovado', null, true);
    v_quantos := v_quantos + 1;
  end loop;
  return v_quantos;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Os pedidos de esclarecimento e as respostas da tesouraria
-- ---------------------------------------------------------------------
create function interno.pedir_esclarecimento(p_competencia date, p_lancamento_id uuid, p_pergunta text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp date := date_trunc('month', p_competencia)::date;
  v_atual public.conselho_meses;
  v_id uuid;
begin
  perform interno.exigir_conselho_independente();
  if v_comp is null or v_comp > date_trunc('month', current_date)::date then
    raise exception 'Escolha um mês que já começou.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_pergunta, ''))) < 3 then
    raise exception 'Escreva a pergunta.' using errcode = 'P0001';
  end if;
  if p_lancamento_id is not null and not exists (
    select 1 from public.lancamentos
    where id = p_lancamento_id and arquivado_em is null and data >= v_comp and data < (v_comp + interval '1 month')::date
  ) then
    raise exception 'O lançamento precisa ser deste mês.' using errcode = 'P0001';
  end if;
  select * into v_atual from public.conselho_meses where competencia = v_comp and arquivado_em is null;
  if found and interno.aprovacao_vale(v_atual) then
    raise exception 'As contas deste mês já foram aprovadas.' using errcode = 'P0001';
  end if;
  insert into public.esclarecimentos (competencia, lancamento_id, pergunta, perguntado_por)
  values (v_comp, p_lancamento_id, trim(p_pergunta), (select interno.minha_pessoa_id()))
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.responder_esclarecimento(p_id uuid, p_resposta text, p_arquivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.esclarecimentos;
  v_lancamento public.lancamentos;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Quem responde ao Conselho Fiscal é a tesouraria (ou a presidência).' using errcode = '42501';
  end if;
  select * into v_pedido from public.esclarecimentos where id = p_id and arquivado_em is null for update;
  if not found or v_pedido.respondido_em is not null then
    raise exception 'Este pedido não está esperando resposta.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_resposta, ''))) < 2 then
    raise exception 'Escreva a resposta.' using errcode = 'P0001';
  end if;
  if p_arquivo is not null and not interno.caminho_seguro(p_arquivo, (select interno.minha_pessoa_id())) then
    raise exception 'O arquivo precisa ser um arquivo enviado por você.' using errcode = 'P0001';
  end if;
  update public.esclarecimentos
  set resposta = trim(p_resposta), resposta_arquivo = p_arquivo,
      respondido_por = (select interno.minha_pessoa_id()), respondido_em = now()
  where id = p_id;

  -- o comprovante que faltava vai também para o lançamento (se o exercício dele não estiver fechado)
  if p_arquivo is not null and v_pedido.lancamento_id is not null then
    select * into v_lancamento from public.lancamentos where id = v_pedido.lancamento_id;
    if v_lancamento.comprovante_caminho is null and not exists (
      select 1 from public.balancos
      where exercicio = interno.exercicio_de(v_lancamento.data) and arquivado_em is null and situacao <> 'devolvido'
    ) then
      update public.lancamentos set comprovante_caminho = p_arquivo where id = v_lancamento.id;
    end if;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O parecer do ano: só com os 12 meses aprovados; os membros assinam
-- ---------------------------------------------------------------------
create or replace function interno.parecer_balanco(p_balanco_id uuid, p_parecer public.tipo_parecer, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
  v_faltam integer;
begin
  if not (select interno.tenho_perfil('conselho_fiscal')) then
    raise exception 'Só o Conselho Fiscal dá o parecer sobre as contas (Art. 14).' using errcode = '42501';
  end if;
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null for update;
  if not found or v_balanco.situacao <> 'aguardando_parecer' then
    raise exception 'Este balanço não está aguardando o parecer do Conselho Fiscal.' using errcode = 'P0001';
  end if;
  if v_balanco.fechado_por = (select interno.minha_pessoa_id()) then
    raise exception 'Quem fechou o balanço não dá o parecer sobre ele.' using errcode = '42501';
  end if;
  if v_balanco.analisado_por = (select interno.minha_pessoa_id())
     or (select interno.tenho_perfil('presidencia', 'tesouraria', 'secretaria')) then
    raise exception 'O parecer é do Conselho Fiscal, independente da diretoria: quem é da diretoria ou registrou a análise não dá o parecer.'
      using errcode = '42501';
  end if;
  if p_parecer is null or coalesce(trim(p_texto), '') = '' then
    raise exception 'Escolha o parecer e escreva o texto.' using errcode = 'P0001';
  end if;
  -- Fase 5.5: o parecer do ano sai dos meses aprovados
  select count(*) into v_faltam
  from jsonb_array_elements(interno.meses_do_conselho(v_balanco.exercicio)) m
  where m ->> 'situacao' not in ('aprovado', 'ressalva');
  if v_faltam > 0 then
    raise exception 'Faltam % mês(es) do exercício para o Conselho Fiscal aprovar antes do parecer do ano.', v_faltam
      using errcode = 'P0001';
  end if;
  update public.balancos
  set situacao = 'aguardando_assembleia', parecer = p_parecer, parecer_texto = trim(p_texto),
      parecer_por = (select interno.minha_pessoa_id()), parecer_em = now()
  where id = p_balanco_id;
  insert into public.conselho_assinaturas (balanco_id, pessoa_id) values (p_balanco_id, (select interno.minha_pessoa_id()));
  perform interno.evento_balanco(p_balanco_id,
    'Parecer do Conselho Fiscal: ' || case p_parecer when 'favoravel' then 'favorável'
                                                     when 'favoravel_com_ressalvas' then 'favorável com ressalvas'
                                                     else 'desfavorável' end,
    p_texto);
end;
$$;

-- Os outros membros assinam o parecer em vigor
create function interno.assinar_parecer(p_balanco_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
begin
  perform interno.exigir_conselho_independente();
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null;
  if not found or v_balanco.parecer is null or v_balanco.situacao = 'devolvido' then
    raise exception 'Este balanço ainda não tem o parecer do Conselho Fiscal.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.conselho_assinaturas
    where balanco_id = p_balanco_id and pessoa_id = (select interno.minha_pessoa_id()) and arquivado_em is null
      and assinado_em >= v_balanco.parecer_em
  ) then
    raise exception 'Você já assinou este parecer.' using errcode = 'P0001';
  end if;
  insert into public.conselho_assinaturas (balanco_id, pessoa_id) values (p_balanco_id, (select interno.minha_pessoa_id()));
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Funções pela API (finas; quem confere é a função interna)
-- ---------------------------------------------------------------------
create function public.meses_do_conselho(p_exercicio integer)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.meses_do_conselho(p_exercicio); $$;
create function public.membros_conselho_fiscal()
returns table (pessoa_id uuid, nome text) language sql stable security invoker set search_path = '' as $$
  select * from interno.membros_conselho_fiscal();
$$;
create function public.decidir_mes(p_competencia date, p_decisao public.decisao_mes, p_ressalva text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.decidir_mes(p_competencia, p_decisao, p_ressalva); $$;
create function public.assinar_mes(p_mes_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.assinar_mes(p_mes_id); $$;
create function public.aprovar_meses_sem_movimento(p_exercicio integer)
returns integer language sql security invoker set search_path = '' as $$ select interno.aprovar_meses_sem_movimento(p_exercicio); $$;
create function public.pedir_esclarecimento(p_competencia date, p_lancamento_id uuid, p_pergunta text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.pedir_esclarecimento(p_competencia, p_lancamento_id, p_pergunta); $$;
create function public.responder_esclarecimento(p_id uuid, p_resposta text, p_arquivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.responder_esclarecimento(p_id, p_resposta, p_arquivo); $$;
create function public.assinar_parecer(p_balanco_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.assinar_parecer(p_balanco_id); $$;


-- ---------------------------------------------------------------------
-- 7. Permissões e regras de acesso
-- ---------------------------------------------------------------------
-- os ajudantes internos: só as funções do banco chamam
revoke all on function interno.exigir_conselho_independente() from public;
revoke all on function interno.numeros_do_mes(date) from public;
revoke all on function interno.aprovacao_vale(public.conselho_meses) from public;
revoke all on function interno.gravar_aprovacao_mes(date, public.decisao_mes, text, boolean) from public;

revoke all on function interno.meses_do_conselho(integer) from public;
revoke all on function interno.membros_conselho_fiscal() from public;
revoke all on function interno.decidir_mes(date, public.decisao_mes, text) from public;
revoke all on function interno.assinar_mes(uuid) from public;
revoke all on function interno.aprovar_meses_sem_movimento(integer) from public;
revoke all on function interno.pedir_esclarecimento(date, uuid, text) from public;
revoke all on function interno.responder_esclarecimento(uuid, text, text) from public;
revoke all on function interno.assinar_parecer(uuid) from public;
grant execute on function interno.meses_do_conselho(integer) to authenticated;
grant execute on function interno.membros_conselho_fiscal() to authenticated;
grant execute on function interno.decidir_mes(date, public.decisao_mes, text) to authenticated;
grant execute on function interno.assinar_mes(uuid) to authenticated;
grant execute on function interno.aprovar_meses_sem_movimento(integer) to authenticated;
grant execute on function interno.pedir_esclarecimento(date, uuid, text) to authenticated;
grant execute on function interno.responder_esclarecimento(uuid, text, text) to authenticated;
grant execute on function interno.assinar_parecer(uuid) to authenticated;

revoke all on function public.meses_do_conselho(integer) from public, anon;
revoke all on function public.membros_conselho_fiscal() from public, anon;
revoke all on function public.decidir_mes(date, public.decisao_mes, text) from public, anon;
revoke all on function public.assinar_mes(uuid) from public, anon;
revoke all on function public.aprovar_meses_sem_movimento(integer) from public, anon;
revoke all on function public.pedir_esclarecimento(date, uuid, text) from public, anon;
revoke all on function public.responder_esclarecimento(uuid, text, text) from public, anon;
revoke all on function public.assinar_parecer(uuid) from public, anon;
grant execute on function public.meses_do_conselho(integer) to authenticated;
grant execute on function public.membros_conselho_fiscal() to authenticated;
grant execute on function public.decidir_mes(date, public.decisao_mes, text) to authenticated;
grant execute on function public.assinar_mes(uuid) to authenticated;
grant execute on function public.aprovar_meses_sem_movimento(integer) to authenticated;
grant execute on function public.pedir_esclarecimento(date, uuid, text) to authenticated;
grant execute on function public.responder_esclarecimento(uuid, text, text) to authenticated;
grant execute on function public.assinar_parecer(uuid) to authenticated;

-- Tabelas: só leitura pela API; gravar, só pelas funções
revoke all on public.conselho_meses, public.conselho_assinaturas, public.esclarecimentos from anon, authenticated;
grant select on public.conselho_meses, public.conselho_assinaturas, public.esclarecimentos to authenticated;

alter table public.conselho_meses enable row level security;
alter table public.conselho_assinaturas enable row level security;
alter table public.esclarecimentos enable row level security;

create policy "contas dos meses: Conselho Fiscal, tesouraria e presidência leem"
  on public.conselho_meses for select to authenticated
  using ((select interno.tenho_perfil('conselho_fiscal', 'tesouraria', 'presidencia')));
create policy "assinaturas do Conselho Fiscal: Conselho Fiscal, tesouraria e presidência leem"
  on public.conselho_assinaturas for select to authenticated
  using ((select interno.tenho_perfil('conselho_fiscal', 'tesouraria', 'presidencia')));
create policy "esclarecimentos: Conselho Fiscal, tesouraria e presidência leem"
  on public.esclarecimentos for select to authenticated
  using ((select interno.tenho_perfil('conselho_fiscal', 'tesouraria', 'presidencia')));
