-- =====================================================================
-- FASE 5.5.2 — VOTAÇÕES E ENQUETES ON-LINE (PROJETO.md, seção 9; 17/11/2026)
--
--   * enquete: uma pergunta com opções (pode deixar escolher mais de uma), para ouvir os associados;
--   * votação: "a favor, contra, abstenção", com a maioria exigida (simples, 3/5, 2/3 dos votos válidos);
--   * quem vota: os associados, só os em dia, ou só os presentes (em dia) numa assembleia;
--   * na assembleia: o item da pauta é votado pelo celular dos presentes e, ao encerrar, o resultado vai para a votação do
--     item (deliberação e ata), com o desligamento ou a jubilação, como se tivesse sido contado à mão;
--   * VOTO SECRETO (o padrão): o sistema guarda QUE a pessoa votou, não O QUE votou. A contagem fica numa tabela sem
--     auditoria e sem ligação com quem votou, e ninguém vê a parcial antes do fim (nem quem organiza);
--   * voto aberto (nominal): depois do fim, todos veem quem votou em quê;
--   * o usuário pediu (17/11/2026) que se faça sem se prender ao estatuto (que só prevê a assembleia presencial).
-- =====================================================================

create type public.tipo_votacao as enum ('enquete', 'votacao');
create type public.situacao_votacao as enum ('rascunho', 'aberta', 'encerrada', 'cancelada');

create table public.votacoes (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 public.tipo_votacao not null,
  titulo               text not null check (length(trim(titulo)) between 3 and 200),
  descricao            text check (descricao is null or length(descricao) <= 5000),
  encontro_id          uuid references public.encontros (id),
  pauta_id             uuid references public.encontro_pauta (id),
  quem_vota            text not null default 'em_dia' check (quem_vota in ('associados', 'em_dia', 'presentes')),
  secreta              boolean not null default true,
  max_escolhas         integer not null default 1 check (max_escolhas between 1 and 20),
  maioria              public.maioria_exigida,
  parcial_visivel      boolean not null default false,
  fecha_em             timestamptz,
  situacao             public.situacao_votacao not null default 'rascunho',
  aberta_em            timestamptz,
  encerrada_em         timestamptz,
  aptos                integer check (aptos is null or aptos >= 0),
  deliberacao_id       uuid references public.deliberacoes (id),
  motivo_cancelamento  text check (motivo_cancelamento is null or length(motivo_cancelamento) <= 500),
  arquivado_em         timestamptz,
  criado_por           uuid default auth.uid(),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  -- a votação tem a maioria e uma escolha só; a enquete não tem maioria
  constraint votacoes_maioria check ((tipo = 'votacao') = (maioria is not null)),
  constraint votacoes_uma_escolha check (tipo = 'enquete' or max_escolhas = 1),
  constraint votacoes_presentes check (quem_vota <> 'presentes' or encontro_id is not null),
  constraint votacoes_pauta check (pauta_id is null or (encontro_id is not null and tipo = 'votacao' and quem_vota = 'presentes')),
  -- no voto secreto, ninguém vê a parcial (senão daria para ligar o voto a quem acabou de votar)
  constraint votacoes_secreta_sem_parcial check (not (secreta and parcial_visivel))
);
comment on table public.votacoes is
  'Votações e enquetes on-line (17/11/2026). No voto secreto, só se guarda QUEM votou; a contagem fica em votacao_apuracao.';
create index votacoes_encontro on public.votacoes (encontro_id);
create index votacoes_pauta on public.votacoes (pauta_id);
create index votacoes_deliberacao on public.votacoes (deliberacao_id);
create unique index votacoes_uma_aberta_por_item on public.votacoes (pauta_id)
  where pauta_id is not null and situacao = 'aberta' and arquivado_em is null;
select interno.aplicar_padroes('public.votacoes');

create table public.votacao_opcoes (
  id             uuid primary key default gen_random_uuid(),
  votacao_id     uuid not null references public.votacoes (id),
  ordem          integer not null check (ordem between 1 and 20),
  texto          text not null check (length(trim(texto)) between 1 and 200),
  -- na votação: qual opção é "a favor", "contra" ou "abstenção" (a conta da maioria)
  papel          text check (papel in ('a_favor', 'contra', 'abstencao')),
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index votacao_opcoes_votacao on public.votacao_opcoes (votacao_id);
select interno.aplicar_padroes('public.votacao_opcoes');

-- Quem votou (e, só no voto aberto, em quê)
create table public.votacao_votantes (
  id             uuid primary key default gen_random_uuid(),
  votacao_id     uuid not null references public.votacoes (id),
  pessoa_id      uuid not null references public.pessoas (id),
  votou_em       timestamptz not null default now(),
  opcoes         uuid[],
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on column public.votacao_votantes.opcoes is 'Só no voto aberto. No secreto fica vazio: o voto vai direto para a contagem, sem o nome.';
create unique index votacao_votantes_um_voto on public.votacao_votantes (votacao_id, pessoa_id) where arquivado_em is null;
create index votacao_votantes_pessoa on public.votacao_votantes (pessoa_id);
select interno.aplicar_padroes('public.votacao_votantes');

-- A contagem: SEM auditoria, SEM quem e SEM quando (de propósito, para o voto secreto). Só as funções mexem nela.
create table public.votacao_apuracao (
  votacao_id  uuid not null references public.votacoes (id),
  opcao_id    uuid not null references public.votacao_opcoes (id),
  votos       integer not null default 0 check (votos >= 0),
  primary key (votacao_id, opcao_id)
);
comment on table public.votacao_apuracao is
  'Contagem dos votos por opção. Sem auditoria nem carimbo de hora de propósito (voto secreto). Ninguém lê direto: só pela apuração.';
create index votacao_apuracao_opcao on public.votacao_apuracao (opcao_id);
create trigger proibir_exclusao before delete on public.votacao_apuracao
  for each row execute function interno.proibir_exclusao();
create trigger proibir_truncate before truncate on public.votacao_apuracao
  for each statement execute function interno.proibir_exclusao();


-- ---------------------------------------------------------------------
-- 1. Quem pode votar
-- ---------------------------------------------------------------------
create function interno.organizo_votacoes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select (select interno.tenho_perfil('secretaria', 'presidencia')); $$;

-- Associado ativo (o jubilado vota — 14/11/2026), e conforme a regra da votação
create function interno.pode_votar(p_votacao_id uuid, p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.votacoes v
    join public.associados a on a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where v.id = p_votacao_id
      and (
        v.quem_vota = 'associados'
        or (v.quem_vota = 'em_dia' and v.encontro_id is null and interno.esta_em_dia(p_pessoa_id))
        or (v.quem_vota = 'em_dia' and v.encontro_id is not null and interno.em_dia_no_encontro(p_pessoa_id, v.encontro_id))
        or (v.quem_vota = 'presentes'
            and interno.em_dia_no_encontro(p_pessoa_id, v.encontro_id)
            and exists (select 1 from public.encontro_presencas pr
                        where pr.encontro_id = v.encontro_id and pr.pessoa_id = p_pessoa_id
                          and pr.presente_em is not null and pr.arquivado_em is null))
      )
  );
$$;

create function interno.aptos_da_votacao(p_votacao_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.associados a
  where a.arquivado_em is null and a.situacao = 'ativo' and interno.pode_votar(p_votacao_id, a.pessoa_id);
$$;

-- Acabou: encerrada, ou aberta com o prazo vencido
create function interno.votacao_fechada(p_votacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.votacoes v
    where v.id = p_votacao_id
      and (v.situacao = 'encerrada' or (v.situacao = 'aberta' and v.fecha_em is not null and v.fecha_em <= now()))
  );
$$;


-- ---------------------------------------------------------------------
-- 2. Preparar (rascunho), abrir, cancelar
-- ---------------------------------------------------------------------
create function interno.salvar_votacao(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_tipo public.tipo_votacao;
  v_encontro uuid;
  v_pauta uuid;
  v_item public.encontro_pauta;
  v_quem text;
  v_maioria public.maioria_exigida;
  v_max integer;
  v_fecha timestamptz;
  v_secreta boolean;
  v_parcial boolean;
  v_titulo text;
  v_opcoes jsonb;
  v_n integer;
  v_texto text;
  v_i integer := 0;
begin
  if not interno.organizo_votacoes() then
    raise exception 'Só a secretaria ou a presidência preparam as votações e enquetes.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_tipo := (p_dados ->> 'tipo')::public.tipo_votacao;
    v_encontro := nullif(p_dados ->> 'encontro_id', '')::uuid;
    v_pauta := nullif(p_dados ->> 'pauta_id', '')::uuid;
    v_maioria := nullif(p_dados ->> 'maioria', '')::public.maioria_exigida;
    v_max := coalesce(nullif(p_dados ->> 'max_escolhas', '')::integer, 1);
    v_fecha := nullif(p_dados ->> 'fecha_em', '')::timestamptz;
    v_secreta := coalesce((p_dados ->> 'secreta')::boolean, true);
    v_parcial := coalesce((p_dados ->> 'parcial_visivel')::boolean, false);
  exception when others then
    raise exception 'Tipo, maioria, data ou número inválidos.' using errcode = 'P0001';
  end;
  if v_tipo is null then
    raise exception 'Escolha se é uma votação ou uma enquete.' using errcode = 'P0001';
  end if;
  v_quem := coalesce(nullif(p_dados ->> 'quem_vota', ''), 'em_dia');
  if v_quem not in ('associados', 'em_dia', 'presentes') then
    raise exception 'Escolha quem vota.' using errcode = 'P0001';
  end if;
  v_titulo := trim(coalesce(p_dados ->> 'titulo', ''));

  -- o item da pauta de uma assembleia: a votação dele, pelos presentes em dia, com a maioria do item
  if v_pauta is not null then
    select * into v_item from public.encontro_pauta where id = v_pauta and arquivado_em is null;
    if not found or not v_item.deliberativo then
      raise exception 'Este item da pauta não vai a votação.' using errcode = 'P0001';
    end if;
    v_encontro := v_item.encontro_id;
    v_tipo := 'votacao';
    v_quem := 'presentes';
    v_maioria := v_item.maioria;
    v_max := 1;
    if v_titulo = '' then
      v_titulo := v_item.titulo;
    end if;
  end if;
  if v_encontro is not null and not exists (
    select 1 from public.encontros where id = v_encontro and arquivado_em is null and situacao <> 'cancelado'
  ) then
    raise exception 'Assembleia não encontrada (ou cancelada).' using errcode = 'P0001';
  end if;
  if v_quem = 'presentes' and v_encontro is null then
    raise exception 'Para votar só quem está presente, escolha a assembleia.' using errcode = 'P0001';
  end if;
  if length(v_titulo) < 3 then
    raise exception 'Escreva a pergunta (o título).' using errcode = 'P0001';
  end if;
  if v_tipo = 'votacao' then
    v_max := 1;
    if v_maioria is null then
      raise exception 'Escolha a maioria exigida.' using errcode = 'P0001';
    end if;
  else
    v_maioria := null;
  end if;
  if v_fecha is not null and v_fecha <= now() then
    raise exception 'O prazo para votar precisa ser no futuro.' using errcode = 'P0001';
  end if;
  if v_secreta and v_parcial then
    raise exception 'No voto secreto ninguém vê a parcial (daria para descobrir o voto de quem acabou de votar).' using errcode = 'P0001';
  end if;

  -- as opções: na votação, sempre as três; na enquete, de 2 a 20
  if v_tipo = 'votacao' then
    v_opcoes := '[{"texto": "A favor", "papel": "a_favor"}, {"texto": "Contra", "papel": "contra"}, {"texto": "Abstenção", "papel": "abstencao"}]'::jsonb;
  else
    v_opcoes := coalesce(p_dados -> 'opcoes', '[]'::jsonb);
    if jsonb_typeof(v_opcoes) <> 'array' then
      raise exception 'Opções inválidas.' using errcode = 'P0001';
    end if;
    select count(*) into v_n from jsonb_array_elements(v_opcoes) x where length(trim(coalesce(x ->> 'texto', x #>> '{}', ''))) > 0;
    if v_n < 2 or v_n > 20 then
      raise exception 'A enquete tem de 2 a 20 opções.' using errcode = 'P0001';
    end if;
    if v_max > v_n then
      raise exception 'Não dá para escolher mais opções do que existem.' using errcode = 'P0001';
    end if;
  end if;

  if v_id is null then
    insert into public.votacoes (tipo, titulo, descricao, encontro_id, pauta_id, quem_vota, secreta, max_escolhas, maioria,
                                 parcial_visivel, fecha_em)
    values (v_tipo, v_titulo, nullif(trim(p_dados ->> 'descricao'), ''), v_encontro, v_pauta, v_quem, v_secreta, v_max, v_maioria,
            v_parcial, v_fecha)
    returning id into v_id;
  else
    update public.votacoes
    set tipo = v_tipo, titulo = v_titulo, descricao = nullif(trim(p_dados ->> 'descricao'), ''), encontro_id = v_encontro,
        pauta_id = v_pauta, quem_vota = v_quem, secreta = v_secreta, max_escolhas = v_max, maioria = v_maioria,
        parcial_visivel = v_parcial, fecha_em = v_fecha
    where id = v_id and arquivado_em is null and situacao = 'rascunho';
    if not found then
      raise exception 'Só se altera a votação antes de abrir.' using errcode = 'P0001';
    end if;
    update public.votacao_opcoes set arquivado_em = now() where votacao_id = v_id and arquivado_em is null;
  end if;
  for v_texto in
    select trim(coalesce(x ->> 'texto', x #>> '{}')) from jsonb_array_elements(v_opcoes) with ordinality as e(x, n)
    where length(trim(coalesce(x ->> 'texto', x #>> '{}', ''))) > 0
    order by n
  loop
    v_i := v_i + 1;
    if length(v_texto) > 200 then
      raise exception 'Cada opção tem até 200 letras.' using errcode = 'P0001';
    end if;
    insert into public.votacao_opcoes (votacao_id, ordem, texto, papel)
    values (v_id, v_i, v_texto,
            case when v_tipo = 'votacao' then (v_opcoes -> (v_i - 1)) ->> 'papel' end);
  end loop;
  return v_id;
end;
$$;

create function interno.abrir_votacao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.votacoes;
  v_encontro public.encontros;
begin
  if not interno.organizo_votacoes() then
    raise exception 'Só a secretaria ou a presidência abrem as votações.' using errcode = '42501';
  end if;
  select * into v from public.votacoes where id = p_id and arquivado_em is null for update;
  if not found or v.situacao <> 'rascunho' then
    raise exception 'Só se abre uma votação em preparo.' using errcode = 'P0001';
  end if;
  if v.fecha_em is not null and v.fecha_em <= now() then
    raise exception 'O prazo para votar já passou: mude o prazo antes de abrir.' using errcode = 'P0001';
  end if;
  if v.pauta_id is not null then
    select * into v_encontro from public.encontros where id = v.encontro_id;
    if v_encontro.instalada_em is null then
      raise exception 'Instale a assembleia (quórum) antes de abrir a votação do item.' using errcode = 'P0001';
    end if;
    if interno.ata_em_assinatura(v.encontro_id) then
      raise exception 'A ata já começou a ser assinada: as votações não mudam mais.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.votacoes where pauta_id = v.pauta_id and situacao = 'aberta' and arquivado_em is null) then
      raise exception 'Este item da pauta já tem uma votação aberta.' using errcode = 'P0001';
    end if;
  end if;
  update public.votacoes set situacao = 'aberta', aberta_em = now() where id = p_id;
  insert into public.votacao_apuracao (votacao_id, opcao_id)
  select p_id, o.id from public.votacao_opcoes o where o.votacao_id = p_id and o.arquivado_em is null;
end;
$$;

create function interno.cancelar_votacao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not interno.organizo_votacoes() then
    raise exception 'Só a secretaria ou a presidência cancelam as votações.' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Diga o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  update public.votacoes set situacao = 'cancelada', motivo_cancelamento = trim(p_motivo)
  where id = p_id and arquivado_em is null and situacao in ('rascunho', 'aberta');
  if not found then
    raise exception 'Só se cancela uma votação em preparo ou aberta.' using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Votar (um voto por pessoa, sem volta)
-- ---------------------------------------------------------------------
create function interno.votar(p_id uuid, p_opcoes uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.votacoes;
  v_eu uuid := (select interno.minha_pessoa_id());
  v_escolhas uuid[];
  v_validas integer;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para votar.' using errcode = '42501';
  end if;
  -- um voto de cada vez na mesma votação (a contagem não se perde)
  select * into v from public.votacoes where id = p_id and arquivado_em is null for update;
  if not found or v.situacao <> 'aberta' then
    raise exception 'Esta votação não está aberta.' using errcode = 'P0001';
  end if;
  if v.fecha_em is not null and v.fecha_em <= now() then
    raise exception 'O prazo para votar terminou.' using errcode = 'P0001';
  end if;
  if not interno.pode_votar(p_id, v_eu) then
    raise exception 'Você não está entre os que votam nesta votação (associado ativo%).',
      case v.quem_vota when 'em_dia' then ' e em dia' when 'presentes' then ', em dia e presente na assembleia' else '' end
      using errcode = '42501';
  end if;
  if exists (select 1 from public.votacao_votantes where votacao_id = p_id and pessoa_id = v_eu and arquivado_em is null) then
    raise exception 'Você já votou nesta votação.' using errcode = 'P0001';
  end if;
  select array_agg(distinct x) into v_escolhas from unnest(coalesce(p_opcoes, '{}'::uuid[])) x;
  if v_escolhas is null or cardinality(v_escolhas) < 1 or cardinality(v_escolhas) > v.max_escolhas then
    raise exception 'Escolha de 1 a % opção(ões).', v.max_escolhas using errcode = 'P0001';
  end if;
  select count(*) into v_validas from public.votacao_opcoes o
  where o.votacao_id = p_id and o.arquivado_em is null and o.id = any (v_escolhas);
  if v_validas <> cardinality(v_escolhas) then
    raise exception 'Opção inválida.' using errcode = 'P0001';
  end if;
  insert into public.votacao_votantes (votacao_id, pessoa_id, opcoes)
  values (p_id, v_eu, case when v.secreta then null else v_escolhas end);
  update public.votacao_apuracao set votos = votos + 1 where votacao_id = p_id and opcao_id = any (v_escolhas);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Encerrar e apurar (o item da pauta recebe o resultado)
-- ---------------------------------------------------------------------
create function interno.encerrar_votacao(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.votacoes;
  v_item public.encontro_pauta;
  v_favor integer;
  v_contra integer;
  v_abst integer;
  v_registro jsonb;
begin
  if not interno.organizo_votacoes() then
    raise exception 'Só a secretaria ou a presidência encerram as votações.' using errcode = '42501';
  end if;
  select * into v from public.votacoes where id = p_id and arquivado_em is null for update;
  if not found or v.situacao <> 'aberta' then
    raise exception 'Só se encerra uma votação aberta.' using errcode = 'P0001';
  end if;
  update public.votacoes set situacao = 'encerrada', encerrada_em = now(), aptos = interno.aptos_da_votacao(p_id)
  where id = p_id;
  if v.pauta_id is not null then
    select
      coalesce(sum(a.votos) filter (where o.papel = 'a_favor'), 0),
      coalesce(sum(a.votos) filter (where o.papel = 'contra'), 0),
      coalesce(sum(a.votos) filter (where o.papel = 'abstencao'), 0)
    into v_favor, v_contra, v_abst
    from public.votacao_apuracao a join public.votacao_opcoes o on o.id = a.opcao_id
    where a.votacao_id = p_id;
    select * into v_item from public.encontro_pauta where id = v.pauta_id;
    -- a mesma regra da contagem à mão (presentes em dia, desligamento só por conduta, jubilação, ata)
    v_registro := interno.registrar_votacao(
      v.pauta_id, v_favor, v_contra, v_abst, v_item.desligamento_pessoa_id,
      case when v_item.desligamento_pessoa_id is not null then 'II' end,
      case when v.secreta then 'Votação secreta pelo sistema (on-line).' else 'Votação aberta pelo sistema (on-line).' end
    );
    update public.votacoes set deliberacao_id = (v_registro ->> 'id')::uuid where id = p_id;
  end if;
  return interno.resultado_votacao(p_id);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O resultado (e a situação de quem olha)
-- ---------------------------------------------------------------------
create function interno.resultado_votacao(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.votacoes;
  v_eu uuid := (select interno.minha_pessoa_id());
  v_organizo boolean := interno.organizo_votacoes();
  v_fechada boolean;
  v_mostra boolean;
  v_favor integer;
  v_contra integer;
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'As votações são de quem é do COMEP.' using errcode = '42501';
  end if;
  select * into v from public.votacoes where id = p_id and arquivado_em is null;
  if not found or (v.situacao = 'rascunho' and not v_organizo) then
    return null;
  end if;
  v_fechada := interno.votacao_fechada(p_id);
  -- a contagem aparece no fim; antes, só se a votação deixar (e nunca no voto secreto)
  v_mostra := v.situacao <> 'cancelada' and (v_fechada or (v.situacao = 'aberta' and v.parcial_visivel and not v.secreta));
  select coalesce(sum(a.votos) filter (where o.papel = 'a_favor'), 0), coalesce(sum(a.votos) filter (where o.papel = 'contra'), 0)
  into v_favor, v_contra
  from public.votacao_apuracao a join public.votacao_opcoes o on o.id = a.opcao_id
  where a.votacao_id = p_id;
  return jsonb_build_object(
    'id', v.id,
    'fechada', v_fechada,
    'votantes', (select count(*) from public.votacao_votantes where votacao_id = p_id and arquivado_em is null),
    'aptos', coalesce(v.aptos, interno.aptos_da_votacao(p_id)),
    'eu_votei', exists (select 1 from public.votacao_votantes where votacao_id = p_id and pessoa_id = v_eu and arquivado_em is null),
    'posso_votar', v.situacao = 'aberta' and not v_fechada and v_eu is not null and interno.pode_votar(p_id, v_eu),
    'minhas_opcoes', (select to_jsonb(opcoes) from public.votacao_votantes where votacao_id = p_id and pessoa_id = v_eu and arquivado_em is null),
    'mostra_contagem', v_mostra,
    'opcoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'texto', o.texto, 'papel', o.papel,
        'votos', case when v_mostra then coalesce(a.votos, 0) end
      ) order by o.ordem)
      from public.votacao_opcoes o
      left join public.votacao_apuracao a on a.votacao_id = p_id and a.opcao_id = o.id
      where o.votacao_id = p_id and o.arquivado_em is null
    ), '[]'::jsonb),
    'aprovada', case when v.tipo = 'votacao' and v_fechada and v.situacao <> 'cancelada'
                     then interno.aprovada(v.maioria, 0, v_favor, v_contra) end,
    -- voto aberto: depois do fim, quem votou em quê
    'nominal', case when not v.secreta and v_fechada and v.situacao <> 'cancelada' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', pe.nome,
        'opcoes', (select jsonb_agg(o.texto order by o.ordem) from public.votacao_opcoes o where o.id = any (vv.opcoes))
      ) order by pe.nome)
      from public.votacao_votantes vv join public.pessoas pe on pe.id = vv.pessoa_id
      where vv.votacao_id = p_id and vv.arquivado_em is null
    ), '[]'::jsonb) end
  );
end;
$$;

-- A lista (com "já votei" e "posso votar"), para a tela e o Início
create function interno.listar_votacoes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_organizo boolean := interno.organizo_votacoes();
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'As votações são de quem é do COMEP.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id, 'tipo', v.tipo, 'titulo', v.titulo, 'situacao', v.situacao, 'fecha_em', v.fecha_em,
      'aberta_em', v.aberta_em, 'encerrada_em', v.encerrada_em, 'criado_em', v.criado_em,
      'encontro', (select e.titulo from public.encontros e where e.id = v.encontro_id),
      'fechada', interno.votacao_fechada(v.id),
      'votantes', (select count(*) from public.votacao_votantes vv where vv.votacao_id = v.id and vv.arquivado_em is null),
      'eu_votei', exists (select 1 from public.votacao_votantes vv where vv.votacao_id = v.id and vv.pessoa_id = v_eu and vv.arquivado_em is null),
      'posso_votar', v.situacao = 'aberta' and not interno.votacao_fechada(v.id) and v_eu is not null and interno.pode_votar(v.id, v_eu)
    ) order by v.criado_em desc)
    from public.votacoes v
    where v.arquivado_em is null and (v.situacao <> 'rascunho' or v_organizo)
  ), '[]'::jsonb);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.votacoes, public.votacao_opcoes, public.votacao_votantes, public.votacao_apuracao from anon, authenticated;
grant select on public.votacoes, public.votacao_opcoes, public.votacao_votantes to authenticated;
alter table public.votacoes enable row level security;
alter table public.votacao_opcoes enable row level security;
alter table public.votacao_votantes enable row level security;
-- a contagem não se lê direto (sem política nenhuma): só pela apuração
alter table public.votacao_apuracao enable row level security;

create policy "votações: quem é do COMEP vê as abertas e as encerradas; o rascunho, quem organiza"
  on public.votacoes for select to authenticated
  using (arquivado_em is null and (select interno.sou_do_comep()) and (situacao <> 'rascunho' or (select interno.organizo_votacoes())));
create policy "opções: as das votações que a pessoa vê"
  on public.votacao_opcoes for select to authenticated
  using (arquivado_em is null and exists (select 1 from public.votacoes v where v.id = votacao_id));
-- quem votou: a própria pessoa e quem organiza (a participação); no voto secreto não há o "em quê"
create policy "votantes: o próprio voto; quem organiza vê quem já votou"
  on public.votacao_votantes for select to authenticated
  using (arquivado_em is null and (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.organizo_votacoes())));

create function public.salvar_votacao(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_votacao(p_id, p_dados); $$;
create function public.abrir_votacao(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.abrir_votacao(p_id); $$;
create function public.cancelar_votacao(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.cancelar_votacao(p_id, p_motivo); $$;
create function public.votar(p_id uuid, p_opcoes uuid[])
returns void language sql security invoker set search_path = '' as $$ select interno.votar(p_id, p_opcoes); $$;
create function public.encerrar_votacao(p_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.encerrar_votacao(p_id); $$;
create function public.resultado_votacao(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.resultado_votacao(p_id); $$;
create function public.listar_votacoes()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.listar_votacoes(); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'pode_votar(uuid, uuid)', 'aptos_da_votacao(uuid)', 'votacao_fechada(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', f);
  end loop;
  -- as políticas chamam organizo_votacoes como quem consulta
  execute 'revoke all on function interno.organizo_votacoes() from public';
  execute 'grant execute on function interno.organizo_votacoes() to authenticated';
  foreach f in array array[
    'salvar_votacao(uuid, jsonb)', 'abrir_votacao(uuid)', 'cancelar_votacao(uuid, text)', 'votar(uuid, uuid[])',
    'encerrar_votacao(uuid)', 'resultado_votacao(uuid)', 'listar_votacoes()'
  ] loop
    execute format('revoke all on function interno.%s from public', f);
    execute format('grant execute on function interno.%s to authenticated', f);
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
