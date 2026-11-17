-- =====================================================================
-- FASE 5.5.1 — PATRIMÔNIO E EMPRÉSTIMO ÀS IGREJAS (Art. 18; PROJETO.md, seção 4.12; 14/11/2026)
--
--   * os bens do COMEP (som, palcos, cadeiras…), com a quantidade, como foram adquiridos (Art. 18) e a compra no caixa;
--   * o presidente da igreja pede itens emprestados para um período e aceita o termo de compromisso; a secretaria
--     (o secretário executivo) ou a presidência aprova, conferindo a agenda; registra a retirada e a devolução;
--   * o COMEP também reserva os itens para os próprios eventos (a agenda mostra os dois);
--   * o que não volta (ou volta quebrado) sai do estoque com o motivo (baixa), e nada se apaga;
--   * as regras de apoio ainda vão ser definidas pela diretoria: os números ficam em configurações (presidência).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Regras do empréstimo (configuráveis, só a presidência muda)
-- ---------------------------------------------------------------------
create table public.config_patrimonio (
  id                    boolean primary key default true check (id),
  antecedencia_dias     integer not null default 3 check (antecedencia_dias between 0 and 90),
  prazo_maximo_dias     integer not null default 7 check (prazo_maximo_dias between 1 and 90),
  exige_em_dia          boolean not null default true,
  texto_termo           text not null check (length(trim(texto_termo)) between 20 and 4000),
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
comment on table public.config_patrimonio is
  'Regras do empréstimo do patrimônio às igrejas (a diretoria ainda define as regras de apoio — 14/11/2026).';
select interno.aplicar_padroes('public.config_patrimonio');
insert into public.config_patrimonio (id, texto_termo) values (true,
  'Declaro, como responsável pela igreja indicada, que recebo os itens do patrimônio do COMEP listados neste termo, '
  || 'em bom estado, e me comprometo a: usá-los somente na finalidade informada; zelar pela sua guarda e conservação; '
  || 'devolvê-los completos e limpos na data combinada; e responder, em nome da igreja, por perda ou dano, repondo o item '
  || 'ou indenizando o COMEP pelo seu valor.');


-- ---------------------------------------------------------------------
-- 2. Os bens
-- ---------------------------------------------------------------------
create table public.patrimonio_itens (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) between 3 and 120),
  categoria       text check (categoria is null or length(categoria) <= 60),
  descricao       text check (descricao is null or length(descricao) <= 1000),
  quantidade      integer not null check (quantidade between 0 and 100000),
  emprestavel     boolean not null default true,
  forma_aquisicao text not null default 'compra' check (forma_aquisicao in ('compra', 'doacao', 'legado', 'outro')),
  adquirido_em    date,
  valor_unitario  numeric(12, 2) check (valor_unitario is null or valor_unitario >= 0),
  lancamento_id   uuid references public.lancamentos (id),
  local_guarda    text check (local_guarda is null or length(local_guarda) <= 200),
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.patrimonio_itens is 'Bens do COMEP (Art. 18): aquisições, doações e legados. A quantidade baixa pelas baixas registradas.';
create unique index patrimonio_itens_nome on public.patrimonio_itens (lower(trim(nome))) where arquivado_em is null;
create index patrimonio_itens_lancamento on public.patrimonio_itens (lancamento_id);
select interno.aplicar_padroes('public.patrimonio_itens');

create type public.situacao_emprestimo as enum ('solicitado', 'aprovado', 'recusado', 'cancelado', 'retirado', 'devolvido');

create table public.emprestimos (
  id                    uuid primary key default gen_random_uuid(),
  igreja_id             uuid references public.igrejas (id),
  evento_id             uuid references public.eventos (id),
  solicitante_id        uuid not null references public.pessoas (id),
  retirada              date not null,
  devolucao             date not null,
  finalidade            text not null check (length(trim(finalidade)) between 3 and 500),
  situacao              public.situacao_emprestimo not null default 'solicitado',
  termo_texto           text,
  termo_aceito_em       timestamptz,
  decidido_por          uuid references public.pessoas (id),
  decidido_em           timestamptz,
  motivo                text check (motivo is null or length(motivo) <= 500),
  retirado_em           timestamptz,
  retirado_por_nome     text check (retirado_por_nome is null or length(retirado_por_nome) <= 120),
  entregue_por          uuid references public.pessoas (id),
  devolvido_em          timestamptz,
  recebido_por          uuid references public.pessoas (id),
  observacao_devolucao  text check (observacao_devolucao is null or length(observacao_devolucao) <= 1000),
  arquivado_em          timestamptz,
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  -- de uma igreja (empréstimo) ou de um evento do próprio COMEP (reserva)
  constraint emprestimos_destino check ((igreja_id is null) <> (evento_id is null)),
  constraint emprestimos_periodo check (devolucao >= retirada),
  constraint emprestimos_termo check (igreja_id is null or termo_aceito_em is not null)
);
comment on table public.emprestimos is
  'Empréstimos às igrejas (com o termo de compromisso) e reservas para os eventos do COMEP. A agenda conta os aprovados e os retirados.';
create index emprestimos_igreja on public.emprestimos (igreja_id);
create index emprestimos_evento on public.emprestimos (evento_id);
create index emprestimos_solicitante on public.emprestimos (solicitante_id);
create index emprestimos_decidido_por on public.emprestimos (decidido_por);
create index emprestimos_entregue_por on public.emprestimos (entregue_por);
create index emprestimos_recebido_por on public.emprestimos (recebido_por);
create index emprestimos_periodo on public.emprestimos (retirada, devolucao) where situacao in ('aprovado', 'retirado');
select interno.aplicar_padroes('public.emprestimos');

create table public.emprestimo_itens (
  id             uuid primary key default gen_random_uuid(),
  emprestimo_id  uuid not null references public.emprestimos (id),
  item_id        uuid not null references public.patrimonio_itens (id),
  quantidade     integer not null check (quantidade between 1 and 100000),
  devolvida      integer check (devolvida is null or devolvida >= 0),
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint emprestimo_itens_devolvida check (devolvida is null or devolvida <= quantidade)
);
create unique index emprestimo_itens_unico on public.emprestimo_itens (emprestimo_id, item_id) where arquivado_em is null;
create index emprestimo_itens_item on public.emprestimo_itens (item_id);
select interno.aplicar_padroes('public.emprestimo_itens');

create table public.patrimonio_baixas (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.patrimonio_itens (id),
  quantidade     integer not null check (quantidade between 1 and 100000),
  motivo         text not null check (length(trim(motivo)) between 3 and 500),
  data           date not null default current_date,
  emprestimo_id  uuid references public.emprestimos (id),
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table public.patrimonio_baixas is 'Saídas do patrimônio (perda, dano, doação, venda…): o histórico de por que a quantidade baixou.';
create index patrimonio_baixas_item on public.patrimonio_baixas (item_id);
create index patrimonio_baixas_emprestimo on public.patrimonio_baixas (emprestimo_id);
select interno.aplicar_padroes('public.patrimonio_baixas');


-- ---------------------------------------------------------------------
-- 3. Quem é quem
-- ---------------------------------------------------------------------
-- Cuidam do patrimônio: a secretaria (o secretário executivo), a tesouraria e a presidência
create function interno.cuido_do_patrimonio()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia')); $$;

-- Vê o empréstimo: quem cuida do patrimônio, o Conselho Fiscal, quem pediu e o presidente da igreja
create function interno.vejo_emprestimo(p_emprestimo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
      or exists (
        select 1 from public.emprestimos e
        where e.id = p_emprestimo_id
          and (e.solicitante_id = (select interno.minha_pessoa_id()) or e.igreja_id in (select interno.igrejas_que_presido()))
      );
$$;

-- Quantos de um item estão comprometidos num dia (empréstimos aprovados e retirados; o retirado segura até voltar)
create function interno.reservado_no_dia(p_item_id uuid, p_dia date, p_ignorar uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(ei.quantidade), 0)::integer
  from public.emprestimo_itens ei
  join public.emprestimos e on e.id = ei.emprestimo_id
  where ei.item_id = p_item_id and ei.arquivado_em is null and e.arquivado_em is null
    and e.id is distinct from p_ignorar
    and e.situacao in ('aprovado', 'retirado')
    and e.retirada <= p_dia
    and (e.devolucao >= p_dia or (e.situacao = 'retirado' and p_dia <= current_date));
$$;

-- O menor número livre do item no período (para pedir e para aprovar)
create function interno.livre_no_periodo(p_item_id uuid, p_de date, p_ate date, p_ignorar uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select i.quantidade from public.patrimonio_itens i where i.id = p_item_id)
         - coalesce(max(interno.reservado_no_dia(p_item_id, d::date, p_ignorar)), 0)
  from generate_series(p_de, p_ate, interval '1 day') d;
$$;

-- Confere os itens de um pedido no período; devolve a mensagem do primeiro que falta (ou null)
create function interno.falta_no_periodo(p_emprestimo_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_emprestimo public.emprestimos;
  v_item record;
  v_livre integer;
begin
  select * into v_emprestimo from public.emprestimos where id = p_emprestimo_id;
  for v_item in
    select ei.item_id, ei.quantidade, i.nome from public.emprestimo_itens ei
    join public.patrimonio_itens i on i.id = ei.item_id
    where ei.emprestimo_id = p_emprestimo_id and ei.arquivado_em is null
  loop
    v_livre := interno.livre_no_periodo(v_item.item_id, v_emprestimo.retirada, v_emprestimo.devolucao, p_emprestimo_id);
    if v_livre < v_item.quantidade then
      return format('%s: só %s livre(s) nesse período (pedido: %s).', v_item.nome, greatest(v_livre, 0), v_item.quantidade);
    end if;
  end loop;
  return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Cadastro dos bens, baixas e a compra no caixa
-- ---------------------------------------------------------------------
create function interno.salvar_item_patrimonio(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_quantidade integer;
  v_adquirido date;
  v_valor numeric;
begin
  if not interno.cuido_do_patrimonio() then
    raise exception 'Só a secretaria, a tesouraria ou a presidência cadastram o patrimônio.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_quantidade := (p_dados ->> 'quantidade')::integer;
    v_adquirido := nullif(p_dados ->> 'adquirido_em', '')::date;
    v_valor := nullif(p_dados ->> 'valor_unitario', '')::numeric;
  exception when others then
    raise exception 'Quantidade, data ou valor inválidos.' using errcode = 'P0001';
  end;
  if coalesce(length(trim(p_dados ->> 'nome')), 0) < 3 then
    raise exception 'Dê um nome ao item.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.patrimonio_itens where lower(trim(nome)) = lower(trim(p_dados ->> 'nome'))
             and arquivado_em is null and id is distinct from v_id) then
    raise exception 'Já existe um item com este nome.' using errcode = 'P0001';
  end if;
  if v_adquirido is not null and v_adquirido > current_date then
    raise exception 'A data de aquisição não pode ser futura.' using errcode = 'P0001';
  end if;
  if coalesce(p_dados ->> 'forma_aquisicao', 'compra') not in ('compra', 'doacao', 'legado', 'outro') then
    raise exception 'Forma de aquisição inválida.' using errcode = 'P0001';
  end if;
  if v_id is null then
    if v_quantidade is null or v_quantidade < 1 then
      raise exception 'Informe a quantidade (pelo menos 1).' using errcode = 'P0001';
    end if;
    insert into public.patrimonio_itens (nome, categoria, descricao, quantidade, emprestavel, forma_aquisicao, adquirido_em,
                                         valor_unitario, local_guarda)
    values (trim(p_dados ->> 'nome'), nullif(trim(p_dados ->> 'categoria'), ''), nullif(trim(p_dados ->> 'descricao'), ''),
            v_quantidade, coalesce((p_dados ->> 'emprestavel')::boolean, true), coalesce(p_dados ->> 'forma_aquisicao', 'compra'),
            v_adquirido, v_valor, nullif(trim(p_dados ->> 'local_guarda'), ''))
    returning id into v_id;
  else
    -- a quantidade não muda aqui: entra com "acrescentar" e sai com a baixa (fica o histórico)
    update public.patrimonio_itens
    set nome = trim(p_dados ->> 'nome'), categoria = nullif(trim(p_dados ->> 'categoria'), ''),
        descricao = nullif(trim(p_dados ->> 'descricao'), ''), emprestavel = coalesce((p_dados ->> 'emprestavel')::boolean, true),
        forma_aquisicao = coalesce(p_dados ->> 'forma_aquisicao', 'compra'), adquirido_em = v_adquirido,
        valor_unitario = v_valor, local_guarda = nullif(trim(p_dados ->> 'local_guarda'), '')
    where id = v_id and arquivado_em is null;
    if not found then
      raise exception 'Item não encontrado.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

-- Mais unidades do mesmo item (nova compra ou doação)
create function interno.acrescentar_item_patrimonio(p_item_id uuid, p_quantidade integer, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not interno.cuido_do_patrimonio() then
    raise exception 'Só a secretaria, a tesouraria ou a presidência mexem no patrimônio.' using errcode = '42501';
  end if;
  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'Informe quantas unidades entram.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Diga de onde vieram (ex.: compra de 13/11/2026, doação da igreja X).' using errcode = 'P0001';
  end if;
  update public.patrimonio_itens set quantidade = quantidade + p_quantidade where id = p_item_id and arquivado_em is null;
  if not found then
    raise exception 'Item não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

-- Baixa: perda, dano, doação, venda… (o histórico fica em patrimonio_baixas)
create function interno.baixar_item_patrimonio(p_item_id uuid, p_quantidade integer, p_motivo text, p_emprestimo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.patrimonio_itens;
  v_fora integer;
begin
  if not interno.cuido_do_patrimonio() then
    raise exception 'Só a secretaria, a tesouraria ou a presidência dão baixa no patrimônio.' using errcode = '42501';
  end if;
  select * into v_item from public.patrimonio_itens where id = p_item_id and arquivado_em is null for update;
  if not found then
    raise exception 'Item não encontrado.' using errcode = 'P0001';
  end if;
  -- o que está fora (retirado e ainda não devolvido) só sai do patrimônio na devolução
  v_fora := coalesce((
    select sum(ei.quantidade) from public.emprestimo_itens ei join public.emprestimos e on e.id = ei.emprestimo_id
    where ei.item_id = p_item_id and ei.arquivado_em is null and e.arquivado_em is null and e.situacao = 'retirado'
  ), 0);
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > v_item.quantidade - v_fora then
    raise exception 'A baixa é de 1 a % unidade(s) (as que estão emprestadas saem na devolução).', greatest(v_item.quantidade - v_fora, 0)
      using errcode = 'P0001';
  end if;
  if p_emprestimo_id is not null and not exists (
    select 1 from public.emprestimo_itens ei join public.emprestimos e on e.id = ei.emprestimo_id
    where ei.emprestimo_id = p_emprestimo_id and ei.item_id = p_item_id and ei.arquivado_em is null and e.situacao = 'devolvido'
  ) then
    raise exception 'Esse empréstimo não tem este item (ou ainda não foi devolvido).' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Diga o motivo da baixa (ex.: quebrou, perdido, doado).' using errcode = 'P0001';
  end if;
  insert into public.patrimonio_baixas (item_id, quantidade, motivo, emprestimo_id) values (p_item_id, p_quantidade, trim(p_motivo), p_emprestimo_id);
  update public.patrimonio_itens set quantidade = quantidade - p_quantidade where id = p_item_id;
end;
$$;

-- A compra no caixa: liga o item ao lançamento de saída
create function interno.ligar_compra_patrimonio(p_item_id uuid, p_lancamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência ligam a compra ao caixa.' using errcode = '42501';
  end if;
  if p_lancamento_id is not null and not exists (
    select 1 from public.lancamentos l where l.id = p_lancamento_id and l.tipo = 'saida' and l.situacao <> 'cancelado'
  ) then
    raise exception 'Escolha uma saída do caixa (a compra).' using errcode = 'P0001';
  end if;
  update public.patrimonio_itens set lancamento_id = p_lancamento_id where id = p_item_id and arquivado_em is null;
  if not found then
    raise exception 'Item não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O pedido (o presidente da igreja, com o termo) e a reserva para os eventos do COMEP
-- ---------------------------------------------------------------------
create function interno.pedir_emprestimo(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_config public.config_patrimonio;
  v_igreja uuid;
  v_evento uuid;
  v_retirada date;
  v_devolucao date;
  v_equipe boolean := interno.cuido_do_patrimonio();
  v_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_qtd integer;
  v_falta text;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para pedir.' using errcode = '42501';
  end if;
  begin
    v_igreja := nullif(p_dados ->> 'igreja_id', '')::uuid;
    v_evento := nullif(p_dados ->> 'evento_id', '')::uuid;
    v_retirada := (p_dados ->> 'retirada')::date;
    v_devolucao := (p_dados ->> 'devolucao')::date;
  exception when others then
    raise exception 'Datas inválidas.' using errcode = 'P0001';
  end;
  select * into v_config from public.config_patrimonio where id;
  if v_retirada is null or v_devolucao is null or v_devolucao < v_retirada then
    raise exception 'Informe a retirada e a devolução (a devolução depois da retirada).' using errcode = 'P0001';
  end if;
  -- um pedido de cada vez na agenda (a reserva do evento já entra aprovada)
  perform pg_advisory_xact_lock(hashtext('comep: agenda do patrimônio'));
  if (v_igreja is null) = (v_evento is null) then
    raise exception 'O pedido é de uma igreja ou de um evento do COMEP.' using errcode = 'P0001';
  end if;
  if v_evento is not null then
    -- reserva para um evento do próprio COMEP: só quem cuida do patrimônio
    if not v_equipe then
      raise exception 'A reserva para os eventos do COMEP é da secretaria ou da presidência.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.eventos where id = v_evento and arquivado_em is null and situacao in ('rascunho', 'publicado')) then
      raise exception 'Evento não encontrado (ou já realizado/cancelado).' using errcode = 'P0001';
    end if;
  else
    -- empréstimo à igreja: o presidente dela pede (ou a equipe, em nome da igreja)
    if not (v_igreja in (select interno.igrejas_que_presido()) or v_equipe) then
      raise exception 'Só o pastor presidente da igreja pede os itens emprestados.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.igrejas where id = v_igreja and arquivado_em is null) then
      raise exception 'Igreja não encontrada.' using errcode = 'P0001';
    end if;
    if not coalesce((p_dados ->> 'aceite')::boolean, false) then
      raise exception 'Para pedir, aceite o termo de compromisso.' using errcode = 'P0001';
    end if;
    if v_config.exige_em_dia and not v_equipe and not interno.esta_em_dia(v_eu) then
      raise exception 'Para pedir, a sua contribuição precisa estar em dia.' using errcode = 'P0001';
    end if;
    if v_retirada < current_date + v_config.antecedencia_dias and not v_equipe then
      raise exception 'O pedido precisa de % dia(s) de antecedência.', v_config.antecedencia_dias using errcode = 'P0001';
    end if;
  end if;
  if v_retirada < current_date then
    raise exception 'A retirada não pode ser no passado.' using errcode = 'P0001';
  end if;
  if v_devolucao - v_retirada + 1 > v_config.prazo_maximo_dias then
    raise exception 'O empréstimo é de no máximo % dia(s).', v_config.prazo_maximo_dias using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_dados ->> 'finalidade')), 0) < 3 then
    raise exception 'Diga para que é (ex.: culto de aniversário da igreja).' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_dados -> 'itens') <> 'array' or jsonb_array_length(p_dados -> 'itens') = 0 then
    raise exception 'Escolha os itens.' using errcode = 'P0001';
  end if;

  insert into public.emprestimos (igreja_id, evento_id, solicitante_id, retirada, devolucao, finalidade, termo_texto, termo_aceito_em)
  values (v_igreja, v_evento, v_eu, v_retirada, v_devolucao, trim(p_dados ->> 'finalidade'),
          case when v_igreja is not null then v_config.texto_termo end, case when v_igreja is not null then now() end)
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_dados -> 'itens') loop
    begin
      v_item_id := (v_item ->> 'item_id')::uuid;
      v_qtd := (v_item ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Item ou quantidade inválidos.' using errcode = 'P0001';
    end;
    if v_qtd is null or v_qtd < 1 then
      raise exception 'A quantidade é pelo menos 1.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.patrimonio_itens where id = v_item_id and arquivado_em is null and emprestavel) then
      raise exception 'Um dos itens não está disponível para empréstimo.' using errcode = 'P0001';
    end if;
    insert into public.emprestimo_itens (emprestimo_id, item_id, quantidade) values (v_id, v_item_id, v_qtd);
  end loop;
  -- já avisa se o período não tem o que foi pedido
  v_falta := interno.falta_no_periodo(v_id);
  if v_falta is not null then
    raise exception 'Não há o suficiente nesse período. %', v_falta using errcode = 'P0001';
  end if;
  -- a reserva para os eventos do COMEP já entra aprovada
  if v_evento is not null then
    update public.emprestimos set situacao = 'aprovado', decidido_por = v_eu, decidido_em = now() where id = v_id;
  end if;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Aprovar, cancelar, retirada e devolução
-- ---------------------------------------------------------------------
create function interno.decidir_emprestimo(p_id uuid, p_aprovar boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emprestimo public.emprestimos;
  v_falta text;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria (o secretário executivo) ou a presidência aprovam os empréstimos.' using errcode = '42501';
  end if;
  -- um de cada vez: duas aprovações ao mesmo tempo não emprestam o mesmo item duas vezes
  perform pg_advisory_xact_lock(hashtext('comep: agenda do patrimônio'));
  select * into v_emprestimo from public.emprestimos where id = p_id and arquivado_em is null for update;
  if not found or v_emprestimo.situacao <> 'solicitado' then
    raise exception 'Este pedido não está esperando a aprovação.' using errcode = 'P0001';
  end if;
  if p_aprovar is null then
    raise exception 'Diga se o pedido foi aprovado.' using errcode = 'P0001';
  end if;
  if not p_aprovar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para recusar, diga o motivo.' using errcode = 'P0001';
  end if;
  if p_aprovar then
    v_falta := interno.falta_no_periodo(p_id);
    if v_falta is not null then
      raise exception 'Não dá para aprovar: %', v_falta using errcode = 'P0001';
    end if;
  end if;
  update public.emprestimos
  set situacao = case when p_aprovar then 'aprovado' else 'recusado' end::public.situacao_emprestimo,
      decidido_por = (select interno.minha_pessoa_id()), decidido_em = now(), motivo = nullif(trim(p_motivo), '')
  where id = p_id;
end;
$$;

create function interno.cancelar_emprestimo(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emprestimo public.emprestimos;
begin
  select * into v_emprestimo from public.emprestimos where id = p_id and arquivado_em is null for update;
  if not found or v_emprestimo.situacao not in ('solicitado', 'aprovado') then
    raise exception 'Só se cancela um pedido antes da retirada.' using errcode = 'P0001';
  end if;
  if not (interno.cuido_do_patrimonio() or v_emprestimo.solicitante_id = (select interno.minha_pessoa_id())
          or v_emprestimo.igreja_id in (select interno.igrejas_que_presido())) then
    raise exception 'Só quem pediu, o presidente da igreja ou a equipe cancelam.' using errcode = '42501';
  end if;
  update public.emprestimos
  set situacao = 'cancelado', motivo = coalesce(nullif(trim(p_motivo), ''), 'Cancelado')
  where id = p_id;
end;
$$;

create function interno.registrar_retirada(p_id uuid, p_retirado_por text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emprestimo public.emprestimos;
begin
  if not interno.cuido_do_patrimonio() then
    raise exception 'Só a equipe do patrimônio registra a retirada.' using errcode = '42501';
  end if;
  select * into v_emprestimo from public.emprestimos where id = p_id and arquivado_em is null for update;
  if not found or v_emprestimo.situacao <> 'aprovado' then
    raise exception 'Só se retira um pedido aprovado.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_retirado_por)), 0) < 3 then
    raise exception 'Informe o nome de quem retirou.' using errcode = 'P0001';
  end if;
  update public.emprestimos
  set situacao = 'retirado', retirado_em = now(), retirado_por_nome = trim(p_retirado_por),
      entregue_por = (select interno.minha_pessoa_id())
  where id = p_id;
end;
$$;

-- Devolução: quanto voltou de cada item; o que faltou sai do patrimônio (baixa), com o motivo
create function interno.registrar_devolucao(p_id uuid, p_itens jsonb, p_observacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_emprestimo public.emprestimos;
  v_linha record;
  v_devolvida integer;
  v_faltou boolean := false;
begin
  if not interno.cuido_do_patrimonio() then
    raise exception 'Só a equipe do patrimônio registra a devolução.' using errcode = '42501';
  end if;
  select * into v_emprestimo from public.emprestimos where id = p_id and arquivado_em is null for update;
  if not found or v_emprestimo.situacao <> 'retirado' then
    raise exception 'Só se devolve um empréstimo retirado.' using errcode = 'P0001';
  end if;
  for v_linha in
    select ei.id, ei.item_id, ei.quantidade, i.nome from public.emprestimo_itens ei
    join public.patrimonio_itens i on i.id = ei.item_id
    where ei.emprestimo_id = p_id and ei.arquivado_em is null
    for update of ei
  loop
    begin
      v_devolvida := coalesce((
        select (x ->> 'devolvida')::integer from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
        where (x ->> 'item_id')::uuid = v_linha.item_id limit 1
      ), v_linha.quantidade);
    exception when others then
      raise exception 'Quantidade devolvida inválida.' using errcode = 'P0001';
    end;
    if v_devolvida < 0 or v_devolvida > v_linha.quantidade then
      raise exception '%: a devolução é de 0 a %.', v_linha.nome, v_linha.quantidade using errcode = 'P0001';
    end if;
    update public.emprestimo_itens set devolvida = v_devolvida where id = v_linha.id;
    if v_devolvida < v_linha.quantidade then
      v_faltou := true;
    end if;
  end loop;
  if v_faltou and coalesce(length(trim(p_observacao)), 0) < 3 then
    raise exception 'Faltaram itens: diga o que aconteceu (fica no histórico e no termo).' using errcode = 'P0001';
  end if;
  -- o que não voltou sai do patrimônio, ligado a este empréstimo
  insert into public.patrimonio_baixas (item_id, quantidade, motivo, emprestimo_id)
  select ei.item_id, ei.quantidade - ei.devolvida,
         left('Não voltou do empréstimo: ' || trim(p_observacao), 500), p_id
  from public.emprestimo_itens ei
  where ei.emprestimo_id = p_id and ei.arquivado_em is null and ei.devolvida < ei.quantidade;
  update public.patrimonio_itens i
  set quantidade = greatest(i.quantidade - (ei.quantidade - ei.devolvida), 0)
  from public.emprestimo_itens ei
  where ei.emprestimo_id = p_id and ei.arquivado_em is null and ei.item_id = i.id and ei.devolvida < ei.quantidade;
  update public.emprestimos
  set situacao = 'devolvido', devolvido_em = now(), recebido_por = (select interno.minha_pessoa_id()),
      observacao_devolucao = nullif(trim(p_observacao), '')
  where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. A agenda: o que está reservado num período (quem é do COMEP vê, para planejar o pedido)
-- ---------------------------------------------------------------------
create function interno.agenda_patrimonio(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'A agenda do patrimônio é de quem é do COMEP.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 366 then
    raise exception 'Escolha um período de até um ano.' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'emprestimo_id', e.id,
      'retirada', e.retirada,
      'devolucao', e.devolucao,
      'situacao', e.situacao,
      'quem', coalesce(g.nome, 'COMEP: ' || ev.titulo),
      'itens', (select jsonb_agg(jsonb_build_object('item_id', ei.item_id, 'nome', i.nome, 'quantidade', ei.quantidade) order by i.nome)
                from public.emprestimo_itens ei join public.patrimonio_itens i on i.id = ei.item_id
                where ei.emprestimo_id = e.id and ei.arquivado_em is null)
    ) order by e.retirada)
    from public.emprestimos e
    left join public.igrejas g on g.id = e.igreja_id
    left join public.eventos ev on ev.id = e.evento_id
    where e.arquivado_em is null and e.situacao in ('aprovado', 'retirado')
      and e.retirada <= p_ate and (e.devolucao >= p_de or e.situacao = 'retirado')
  ), '[]'::jsonb);
end;
$$;

-- Quanto de cada item está livre num período (para o formulário do pedido)
create function interno.livres_no_periodo(p_de date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'O patrimônio é de quem é do COMEP.' using errcode = '42501';
  end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 90 then
    raise exception 'Escolha um período de até 90 dias.' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('item_id', i.id, 'livre', greatest(interno.livre_no_periodo(i.id, p_de, p_ate, null), 0)))
    from public.patrimonio_itens i where i.arquivado_em is null and i.emprestavel
  ), '[]'::jsonb);
end;
$$;


-- As igrejas para o pedido (o pastor presidente: a dele; a equipe: todas), com o peso de cada uma (14/11/2026):
-- quantos ministros associados ela tem e quantos estão em dia
create function interno.igrejas_do_pedido()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_equipe boolean := interno.cuido_do_patrimonio();
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'O patrimônio é de quem é do COMEP.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome, 'ministros', m.ministros, 'em_dia', m.em_dia) order by g.nome)
    from public.igrejas g
    cross join lateral (
      select count(distinct v.pessoa_id)::integer as ministros,
             count(distinct v.pessoa_id) filter (where interno.esta_em_dia(v.pessoa_id))::integer as em_dia
      from public.vinculos_igreja v
      join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where v.igreja_id = g.id and v.fim is null and v.arquivado_em is null
    ) m
    where g.arquivado_em is null and (v_equipe or g.id in (select interno.igrejas_que_presido()))
  ), '[]'::jsonb);
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.config_patrimonio, public.patrimonio_itens, public.emprestimos, public.emprestimo_itens, public.patrimonio_baixas
  from anon, authenticated;
grant select on public.config_patrimonio, public.patrimonio_itens, public.emprestimos, public.emprestimo_itens, public.patrimonio_baixas
  to authenticated;
grant update (antecedencia_dias, prazo_maximo_dias, exige_em_dia, texto_termo) on public.config_patrimonio to authenticated;
alter table public.config_patrimonio enable row level security;
alter table public.patrimonio_itens enable row level security;
alter table public.emprestimos enable row level security;
alter table public.emprestimo_itens enable row level security;
alter table public.patrimonio_baixas enable row level security;

create policy "regras do patrimônio: quem é do COMEP lê"
  on public.config_patrimonio for select to authenticated using ((select interno.sou_do_comep()));
create policy "regras do patrimônio: a presidência altera"
  on public.config_patrimonio for update to authenticated
  using ((select interno.tenho_perfil('presidencia'))) with check ((select interno.tenho_perfil('presidencia')));
create policy "patrimônio: quem é do COMEP vê os bens"
  on public.patrimonio_itens for select to authenticated using (arquivado_em is null and (select interno.sou_do_comep()));
create policy "empréstimos: a equipe, o Conselho Fiscal, quem pediu e o presidente da igreja"
  on public.emprestimos for select to authenticated
  using (
    arquivado_em is null
    and ((select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
         or solicitante_id = (select interno.minha_pessoa_id())
         or igreja_id in (select interno.igrejas_que_presido()))
  );
create policy "itens do empréstimo: quem vê o empréstimo"
  on public.emprestimo_itens for select to authenticated using (arquivado_em is null and interno.vejo_emprestimo(emprestimo_id));
create policy "baixas: a equipe e o Conselho Fiscal"
  on public.patrimonio_baixas for select to authenticated
  using (arquivado_em is null and (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal')));

create function public.salvar_item_patrimonio(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_item_patrimonio(p_id, p_dados); $$;
create function public.acrescentar_item_patrimonio(p_item_id uuid, p_quantidade integer, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.acrescentar_item_patrimonio(p_item_id, p_quantidade, p_motivo); $$;
create function public.baixar_item_patrimonio(p_item_id uuid, p_quantidade integer, p_motivo text, p_emprestimo_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select interno.baixar_item_patrimonio(p_item_id, p_quantidade, p_motivo, p_emprestimo_id);
$$;
create function public.ligar_compra_patrimonio(p_item_id uuid, p_lancamento_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.ligar_compra_patrimonio(p_item_id, p_lancamento_id); $$;
create function public.pedir_emprestimo(p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.pedir_emprestimo(p_dados); $$;
create function public.decidir_emprestimo(p_id uuid, p_aprovar boolean, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.decidir_emprestimo(p_id, p_aprovar, p_motivo); $$;
create function public.cancelar_emprestimo(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.cancelar_emprestimo(p_id, p_motivo); $$;
create function public.registrar_retirada(p_id uuid, p_retirado_por text)
returns void language sql security invoker set search_path = '' as $$ select interno.registrar_retirada(p_id, p_retirado_por); $$;
create function public.registrar_devolucao(p_id uuid, p_itens jsonb, p_observacao text)
returns void language sql security invoker set search_path = '' as $$ select interno.registrar_devolucao(p_id, p_itens, p_observacao); $$;
create function public.agenda_patrimonio(p_de date, p_ate date)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.agenda_patrimonio(p_de, p_ate); $$;
create function public.livres_no_periodo(p_de date, p_ate date)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.livres_no_periodo(p_de, p_ate); $$;
create function public.igrejas_do_pedido()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.igrejas_do_pedido(); $$;

do $$
declare
  v text;
begin
  foreach v in array array[
    'cuido_do_patrimonio()', 'vejo_emprestimo(uuid)', 'reservado_no_dia(uuid, date, uuid)', 'livre_no_periodo(uuid, date, date, uuid)',
    'falta_no_periodo(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
  end loop;
  -- a política dos itens chama vejo_emprestimo como quem consulta
  execute 'grant execute on function interno.vejo_emprestimo(uuid) to authenticated';
  foreach v in array array[
    'salvar_item_patrimonio(uuid, jsonb)', 'acrescentar_item_patrimonio(uuid, integer, text)',
    'baixar_item_patrimonio(uuid, integer, text, uuid)', 'ligar_compra_patrimonio(uuid, uuid)', 'pedir_emprestimo(jsonb)',
    'decidir_emprestimo(uuid, boolean, text)', 'cancelar_emprestimo(uuid, text)', 'registrar_retirada(uuid, text)',
    'registrar_devolucao(uuid, jsonb, text)', 'agenda_patrimonio(date, date)', 'livres_no_periodo(date, date)', 'igrejas_do_pedido()'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
end;
$$;
