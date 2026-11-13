-- =====================================================================
-- Fase 4.1 — Assembleias e reuniões: agenda, pauta, convocação e edital no site
-- (PROJETO.md, seção 4.6; Estatuto, Art. 15 e 16)
--
--   * três tipos de encontro: Assembleia Geral Ordinária (AGO), Extraordinária (AGE) e reunião mensal
--     (a reunião mensal não tem efeito de AGO nem de AGE: não se vota nela o que é da assembleia);
--   * a secretaria (ou a presidência) prepara: data, local, pauta e o texto do edital;
--   * a CONVOCAÇÃO das assembleias é do presidente (Art. 16, §2º), com antecedência mínima
--     (30 dias); a AGO só na 2ª quinzena de abril ou de outubro (Art. 16, §6º); a AGE diz quem pediu
--     (3/5 dos associados ou a maioria do Conselho Diretor — Art. 16, §3º);
--   * convocada, a assembleia aparece no site para qualquer pessoa (edital e pauta);
--   * os números do estatuto ficam em config_assembleias: se o estatuto mudar, muda-se lá;
--   * nada se apaga: cancelar pede motivo; arquivar só tira das listas.
-- =====================================================================

create type public.tipo_encontro as enum ('ago', 'age', 'reuniao_mensal');
create type public.situacao_encontro as enum ('agendado', 'convocado', 'realizado', 'cancelado');
create type public.maioria_exigida as enum ('simples', 'tres_quintos', 'dois_tercos');


-- ---------------------------------------------------------------------
-- 1. Regras do estatuto que podem mudar (uma linha)
-- ---------------------------------------------------------------------
create table public.config_assembleias (
  id                       boolean primary key default true check (id),
  antecedencia_dias        integer not null default 30 check (antecedencia_dias between 0 and 365),
  meses_ago                integer[] not null default '{4,10}'
                           check (cardinality(meses_ago) between 1 and 12 and meses_ago <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'),
  dia_minimo_ago           integer not null default 16 check (dia_minimo_ago between 1 and 28),
  minutos_segunda_chamada  integer not null default 60 check (minutos_segunda_chamada between 0 and 600),
  faltas_aviso             integer not null default 2 check (faltas_aviso between 1 and 12),
  faltas_pauta             integer not null default 3 check (faltas_pauta between 1 and 12),
  criado_por               uuid default auth.uid(),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now()
);
comment on table public.config_assembleias is
  'Números do estatuto para assembleias e reuniões: antecedência da convocação (Art. 16, §2º), meses e dia da AGO (Art. 16, §6º), 2ª chamada (Art. 16, §4º) e faltas seguidas (Art. 8º, IV).';
select interno.aplicar_padroes('public.config_assembleias');
insert into public.config_assembleias (id) values (true);


-- ---------------------------------------------------------------------
-- 2. Encontros e pauta
-- ---------------------------------------------------------------------
create table public.encontros (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 public.tipo_encontro not null,
  titulo               text not null check (length(trim(titulo)) between 3 and 200),
  inicio               timestamptz not null,
  local                text not null check (length(trim(local)) between 1 and 300),
  edital               text check (edital is null or length(edital) <= 6000),
  fundamento           text check (fundamento is null or length(fundamento) <= 1000),
  situacao             public.situacao_encontro not null default 'agendado',
  convocado_em         timestamptz,
  convocado_por        uuid,
  cancelado_em         timestamptz,
  motivo_cancelamento  text,
  arquivado_em         timestamptz,
  criado_por           uuid default auth.uid(),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
comment on table public.encontros is 'Assembleias (AGO, AGE) e reuniões mensais. Gravar só pelas funções.';
comment on column public.encontros.inicio is 'Data e hora da 1ª chamada.';
comment on column public.encontros.fundamento is 'AGE: quem pediu (3/5 dos associados ou a maioria do Conselho Diretor — Art. 16, §3º).';
create index encontros_inicio on public.encontros (inicio);
select interno.aplicar_padroes('public.encontros');

create table public.encontro_pauta (
  id            uuid primary key default gen_random_uuid(),
  encontro_id   uuid not null references public.encontros (id),
  ordem         integer not null check (ordem between 1 and 50),
  titulo        text not null check (length(trim(titulo)) between 1 and 300),
  descricao     text check (descricao is null or length(descricao) <= 2000),
  deliberativo  boolean not null default false,
  maioria       public.maioria_exigida,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint encontro_pauta_maioria check ((deliberativo and maioria is not null) or (not deliberativo and maioria is null))
);
comment on table public.encontro_pauta is 'Itens da pauta. Deliberativo = vai a votação, com a maioria exigida (simples, 3/5, 2/3).';
create index encontro_pauta_encontro on public.encontro_pauta (encontro_id);
select interno.aplicar_padroes('public.encontro_pauta');


-- ---------------------------------------------------------------------
-- 3. Preparar (criar ou alterar enquanto não foi convocado)
-- ---------------------------------------------------------------------
create function interno.salvar_encontro(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_atual public.encontros;
  v_tipo public.tipo_encontro;
  v_inicio timestamptz;
  v_item jsonb;
  v_ordem integer := 0;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência preparam assembleias e reuniões.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_tipo := (p_dados ->> 'tipo')::public.tipo_encontro;
    v_inicio := (p_dados ->> 'inicio')::timestamptz;
  exception when others then
    raise exception 'Tipo ou data inválidos.' using errcode = 'P0001';
  end;
  if v_tipo is null or v_inicio is null then
    raise exception 'Informe o tipo e a data.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_dados ->> 'titulo'), '') = '' or coalesce(trim(p_dados ->> 'local'), '') = '' then
    raise exception 'Informe o título e o local.' using errcode = 'P0001';
  end if;
  if v_inicio <= now() then
    raise exception 'A data do encontro precisa ser no futuro.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_dados -> 'pauta', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_dados -> 'pauta', '[]'::jsonb)) > 50 then
    raise exception 'A pauta tem no máximo 50 itens.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.encontros (tipo, titulo, inicio, local, edital, fundamento)
    values (
      v_tipo,
      trim(p_dados ->> 'titulo'),
      v_inicio,
      trim(p_dados ->> 'local'),
      nullif(trim(p_dados ->> 'edital'), ''),
      nullif(trim(p_dados ->> 'fundamento'), '')
    )
    returning id into v_id;
  else
    select * into v_atual from public.encontros where id = v_id and arquivado_em is null for update;
    if not found then
      raise exception 'Encontro não encontrado.' using errcode = 'P0001';
    end if;
    if v_atual.situacao <> 'agendado' then
      raise exception 'Depois de convocado, o encontro não muda. Para mudar, cancele e convoque de novo.' using errcode = 'P0001';
    end if;
    update public.encontros
    set tipo = v_tipo,
        titulo = trim(p_dados ->> 'titulo'),
        inicio = v_inicio,
        local = trim(p_dados ->> 'local'),
        edital = nullif(trim(p_dados ->> 'edital'), ''),
        fundamento = nullif(trim(p_dados ->> 'fundamento'), '')
    where id = v_id;
    -- a pauta anterior fica guardada (arquivada); entra a nova
    update public.encontro_pauta set arquivado_em = now() where encontro_id = v_id and arquivado_em is null;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_dados -> 'pauta', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    if coalesce((v_item ->> 'deliberativo')::boolean, false) and v_tipo = 'reuniao_mensal' then
      raise exception 'Reunião mensal não tem votação de assembleia: os itens dela são só de informe ou conversa.' using errcode = 'P0001';
    end if;
    insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria)
    values (
      v_id,
      v_ordem,
      trim(v_item ->> 'titulo'),
      nullif(trim(v_item ->> 'descricao'), ''),
      coalesce((v_item ->> 'deliberativo')::boolean, false),
      case when coalesce((v_item ->> 'deliberativo')::boolean, false)
           then coalesce(nullif(v_item ->> 'maioria', ''), 'simples')::public.maioria_exigida end
    );
  end loop;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Convocar (publicar): assembleia, só o presidente; reunião mensal, a secretaria também
-- ---------------------------------------------------------------------
create function interno.pode_conduzir(p_tipo public.tipo_encontro)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_tipo = 'reuniao_mensal' then (select interno.tenho_perfil('secretaria', 'presidencia'))
    else (select interno.tenho_perfil('presidencia'))
  end;
$$;

create function interno.convocar_encontro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_config public.config_assembleias;
  v_dia date;
  v_limite date;
begin
  select * into v_encontro from public.encontros where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not (select interno.pode_conduzir(v_encontro.tipo)) then
    raise exception 'A convocação de assembleia é do presidente (Art. 16, §2º).' using errcode = '42501';
  end if;
  if v_encontro.situacao <> 'agendado' then
    raise exception 'Este encontro já foi convocado ou cancelado.' using errcode = 'P0001';
  end if;
  if v_encontro.inicio <= now() then
    raise exception 'A data do encontro já passou.' using errcode = 'P0001';
  end if;

  if v_encontro.tipo in ('ago', 'age') then
    select * into v_config from public.config_assembleias where id;
    v_dia := (v_encontro.inicio at time zone 'America/Belem')::date;
    v_limite := current_date + v_config.antecedencia_dias;
    if v_dia < v_limite then
      raise exception 'A convocação precisa de pelo menos % dias de antecedência (Art. 16, §2º): a assembleia pode ser a partir de %.',
        v_config.antecedencia_dias, to_char(v_limite, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.encontro_pauta where encontro_id = p_id and arquivado_em is null) then
      raise exception 'A convocação precisa da pauta (Art. 16, §3º).' using errcode = 'P0001';
    end if;
    if coalesce(trim(v_encontro.edital), '') = '' then
      raise exception 'Escreva o texto do edital antes de convocar.' using errcode = 'P0001';
    end if;
    if v_encontro.tipo = 'ago'
       and (not (extract(month from v_dia)::integer = any (v_config.meses_ago)) or extract(day from v_dia) < v_config.dia_minimo_ago) then
      raise exception 'A Assembleia Ordinária acontece na 2ª quinzena de abril ou de outubro (Art. 16, §6º).' using errcode = 'P0001';
    end if;
    if v_encontro.tipo = 'age' and coalesce(trim(v_encontro.fundamento), '') = '' then
      raise exception 'Informe quem pediu a Assembleia Extraordinária: 3/5 dos associados ou a maioria do Conselho Diretor (Art. 16, §3º).'
        using errcode = 'P0001';
    end if;
  end if;

  update public.encontros
  set situacao = 'convocado', convocado_em = now(), convocado_por = (select interno.minha_pessoa_id())
  where id = p_id;
end;
$$;

create function interno.cancelar_encontro(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
begin
  select * into v_encontro from public.encontros where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not (select interno.pode_conduzir(v_encontro.tipo)) then
    raise exception 'Só o presidente cancela uma assembleia convocada.' using errcode = '42501';
  end if;
  if v_encontro.situacao not in ('agendado', 'convocado') then
    raise exception 'Este encontro já foi realizado ou cancelado.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  update public.encontros
  set situacao = 'cancelado', cancelado_em = now(), motivo_cancelamento = trim(p_motivo)
  where id = p_id;
end;
$$;

-- Arquivar: tira das listas (rascunho que não vai mais acontecer, ou encontro cancelado). Nada se apaga.
create function interno.arquivar_encontro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência arquivam encontros.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if v_encontro.situacao not in ('agendado', 'cancelado') then
    raise exception 'Só se arquiva encontro ainda não convocado ou já cancelado.' using errcode = 'P0001';
  end if;
  update public.encontros set arquivado_em = now() where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Site: as convocações das assembleias, para qualquer pessoa (edital e pauta)
-- ---------------------------------------------------------------------
create function interno.convocacoes_publicas()
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
    'inicio', e.inicio,
    'local', e.local,
    'edital', e.edital,
    'situacao', e.situacao,
    'convocado_em', e.convocado_em,
    'motivo_cancelamento', e.motivo_cancelamento,
    'pauta', (
      select coalesce(jsonb_agg(jsonb_build_object('ordem', p.ordem, 'titulo', p.titulo, 'descricao', p.descricao) order by p.ordem), '[]'::jsonb)
      from public.encontro_pauta p where p.encontro_id = e.id and p.arquivado_em is null
    )
  ) order by e.inicio desc), '[]'::jsonb)
  from public.encontros e
  where e.arquivado_em is null
    and e.tipo in ('ago', 'age')
    and e.situacao in ('convocado', 'realizado', 'cancelado')
    and e.convocado_em is not null
    and e.inicio > now() - interval '2 years';
$$;


-- ---------------------------------------------------------------------
-- 6. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.salvar_encontro(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.salvar_encontro(p_id, p_dados);
$$;
create function public.convocar_encontro(p_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select interno.convocar_encontro(p_id);
$$;
create function public.cancelar_encontro(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.cancelar_encontro(p_id, p_motivo);
$$;
create function public.arquivar_encontro(p_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select interno.arquivar_encontro(p_id);
$$;
create function public.convocacoes_publicas()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select interno.convocacoes_publicas();
$$;

revoke all on function interno.salvar_encontro(uuid, jsonb) from public;
revoke all on function interno.pode_conduzir(public.tipo_encontro) from public;
revoke all on function interno.convocar_encontro(uuid) from public;
revoke all on function interno.cancelar_encontro(uuid, text) from public;
revoke all on function interno.arquivar_encontro(uuid) from public;
revoke all on function interno.convocacoes_publicas() from public;
grant execute on function interno.salvar_encontro(uuid, jsonb) to authenticated;
grant execute on function interno.pode_conduzir(public.tipo_encontro) to authenticated;
grant execute on function interno.convocar_encontro(uuid) to authenticated;
grant execute on function interno.cancelar_encontro(uuid, text) to authenticated;
grant execute on function interno.arquivar_encontro(uuid) to authenticated;
grant execute on function interno.convocacoes_publicas() to anon, authenticated;

revoke all on function public.salvar_encontro(uuid, jsonb) from public, anon;
revoke all on function public.convocar_encontro(uuid) from public, anon;
revoke all on function public.cancelar_encontro(uuid, text) from public, anon;
revoke all on function public.arquivar_encontro(uuid) from public, anon;
revoke all on function public.convocacoes_publicas() from public;
grant execute on function public.salvar_encontro(uuid, jsonb) to authenticated;
grant execute on function public.convocar_encontro(uuid) to authenticated;
grant execute on function public.cancelar_encontro(uuid, text) to authenticated;
grant execute on function public.arquivar_encontro(uuid) to authenticated;
grant execute on function public.convocacoes_publicas() to anon, authenticated;

-- Tabelas: só leitura pela API; gravar, só pelas funções (a configuração, pela secretaria/presidência)
revoke all on public.config_assembleias, public.encontros, public.encontro_pauta from anon, authenticated;
grant select on public.config_assembleias, public.encontros, public.encontro_pauta to authenticated;
grant update (antecedencia_dias, meses_ago, dia_minimo_ago, minutos_segunda_chamada, faltas_aviso, faltas_pauta)
  on public.config_assembleias to authenticated;

alter table public.config_assembleias enable row level security;
alter table public.encontros enable row level security;
alter table public.encontro_pauta enable row level security;

create policy "regras das assembleias: todos com login leem"
  on public.config_assembleias for select to authenticated using (true);
create policy "regras das assembleias: secretaria e presidência alteram"
  on public.config_assembleias for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

-- Rascunhos (ainda não convocados) só a secretaria e a presidência veem; o resto, todos com login
create policy "encontros: convocados para todos; rascunhos, secretaria e presidência"
  on public.encontros for select to authenticated
  using (arquivado_em is null and (situacao <> 'agendado' or (select interno.tenho_perfil('secretaria', 'presidencia'))));
create policy "pauta: a dos encontros que a pessoa vê"
  on public.encontro_pauta for select to authenticated
  using (exists (select 1 from public.encontros e where e.id = encontro_id));
