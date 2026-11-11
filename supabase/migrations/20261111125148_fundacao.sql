-- =====================================================================
-- FASE 0 — FUNDAÇÃO
-- Pessoas (ligadas ao login), perfis de acesso e auditoria automática.
--
-- Regras do PROJETO.md (seção 2) que este arquivo garante NO BANCO:
--   * Nada se apaga: DELETE e TRUNCATE são bloqueados; usa-se arquivado_em.
--   * Toda alteração fica registrada na tabela auditoria (quem, quando, o quê).
--   * Cada um vê só o que lhe cabe: RLS (Row Level Security) em todas as tabelas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Esquema "interno": funções auxiliares que NÃO ficam expostas na API
-- ---------------------------------------------------------------------
create schema if not exists interno;
grant usage on schema interno to authenticated;


-- ---------------------------------------------------------------------
-- 2. Segurança por padrão: tabelas novas não nascem acessíveis pela API.
--    Cada tabela recebe, explicitamente, só as permissões de que precisa.
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Perfis de acesso (PROJETO.md, seção 3)
-- ---------------------------------------------------------------------
create type public.perfil_acesso as enum (
  'ministro',
  'presidente_igreja',
  'secretaria',
  'tesouraria',
  'presidencia',
  'admin_tecnico'
);


-- ---------------------------------------------------------------------
-- 4. Tabelas
-- ---------------------------------------------------------------------

-- Pessoas: quem usa o sistema. Ligada ao login por usuario_id.
-- Os dados ministeriais (cargo, igreja, documentos...) entram na Fase 1.
create table public.pessoas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid unique references auth.users (id) on delete set null,
  nome          text not null check (length(trim(nome)) > 0),
  email         text,
  telefone      text,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.pessoas is 'Pessoas que usam o sistema (ministros e diretoria). Nunca apagar: arquivar.';

-- Perfis de cada pessoa. Uma pessoa pode ter vários perfis.
create table public.perfis_acesso (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoas (id),
  perfil        public.perfil_acesso not null,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.perfis_acesso is 'Perfis de acesso de cada pessoa. Retirar um perfil = arquivar a linha.';

create unique index perfis_acesso_ativo_unico on public.perfis_acesso (pessoa_id, perfil) where arquivado_em is null;
create index perfis_acesso_pessoa on public.perfis_acesso (pessoa_id);

-- Auditoria: preenchida só pelos gatilhos. É imutável (não tem arquivado_em de propósito).
create table public.auditoria (
  id           bigint generated always as identity primary key,
  tabela       text not null,
  registro_id  text,
  operacao     text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  dados_antes  jsonb,
  dados_depois jsonb,
  usuario_id   uuid,
  ocorrido_em  timestamptz not null default now()
);
comment on table public.auditoria is 'Registro automático de toda criação/alteração. Imutável.';

create index auditoria_registro on public.auditoria (tabela, registro_id);
create index auditoria_quando on public.auditoria (ocorrido_em desc);


-- ---------------------------------------------------------------------
-- 5. Funções de gatilho (padrões de todas as tabelas)
-- ---------------------------------------------------------------------

create function interno.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create function interno.proibir_exclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Exclusão não permitida na tabela "%". Use o arquivamento (arquivado_em).', tg_table_name
    using errcode = 'P0001';
end;
$$;

create function interno.proibir_alteracao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A tabela "%" não pode ser alterada.', tg_table_name
    using errcode = 'P0001';
end;
$$;

create function interno.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_depois := to_jsonb(new);
  end if;

  -- Não registra UPDATE que não mudou nada (além do carimbo atualizado_em)
  if tg_op = 'UPDATE' and (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then
    return null;
  end if;

  insert into public.auditoria (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, coalesce(v_depois ->> 'id', v_antes ->> 'id'), tg_op, v_antes, v_depois, auth.uid());

  return null;
end;
$$;

-- Aplica os padrões a uma tabela: carimbo de atualização, auditoria e proibição de exclusão.
-- Toda tabela nova das próximas fases deve chamar: select interno.aplicar_padroes('public.<tabela>');
create function interno.aplicar_padroes(p_tabela regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('create trigger tocar_atualizado_em before update on %s for each row execute function interno.tocar_atualizado_em()', p_tabela);
  execute format('create trigger registrar_auditoria after insert or update or delete on %s for each row execute function interno.registrar_auditoria()', p_tabela);
  execute format('create trigger proibir_exclusao before delete on %s for each row execute function interno.proibir_exclusao()', p_tabela);
  execute format('create trigger proibir_truncate before truncate on %s for each statement execute function interno.proibir_exclusao()', p_tabela);
end;
$$;

select interno.aplicar_padroes('public.pessoas');
select interno.aplicar_padroes('public.perfis_acesso');

-- Auditoria: ninguém altera, ninguém apaga.
create trigger proibir_alteracao before update on public.auditoria
  for each row execute function interno.proibir_alteracao();
create trigger proibir_exclusao before delete on public.auditoria
  for each row execute function interno.proibir_exclusao();
create trigger proibir_truncate before truncate on public.auditoria
  for each statement execute function interno.proibir_exclusao();


-- ---------------------------------------------------------------------
-- 6. Funções usadas nas regras de acesso (RLS)
--    "security definer" para consultar perfis sem cair na própria RLS.
-- ---------------------------------------------------------------------

create function interno.minha_pessoa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.pessoas p
  where p.usuario_id = (select auth.uid())
    and p.arquivado_em is null
  limit 1;
$$;

create function interno.tenho_perfil(variadic p_perfis public.perfil_acesso[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis_acesso pa
    join public.pessoas p on p.id = pa.pessoa_id
    where p.usuario_id = (select auth.uid())
      and p.arquivado_em is null
      and pa.arquivado_em is null
      and pa.perfil = any (p_perfis)
  );
$$;


-- ---------------------------------------------------------------------
-- 7. Novo login → cria automaticamente o cadastro em "pessoas"
--    (sem perfil nenhum: os perfis são dados pela presidência)
-- ---------------------------------------------------------------------

create function interno.criar_pessoa_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pessoas (usuario_id, nome, email, criado_por)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sem nome'
    ),
    new.email,
    new.id
  );
  return new;
end;
$$;

create trigger criar_pessoa_para_novo_usuario
  after insert on auth.users
  for each row execute function interno.criar_pessoa_para_novo_usuario();


-- ---------------------------------------------------------------------
-- 8. Quem pode executar as funções internas
-- ---------------------------------------------------------------------
revoke all on all functions in schema interno from public;
grant execute on function interno.minha_pessoa_id() to authenticated;
grant execute on function interno.tenho_perfil(public.perfil_acesso[]) to authenticated;


-- ---------------------------------------------------------------------
-- 9. Permissões das tabelas: só o necessário. Ninguém recebe DELETE.
--    "anon" (visitante sem login) não acessa nenhuma destas tabelas.
-- ---------------------------------------------------------------------
revoke all on public.pessoas, public.perfis_acesso, public.auditoria from anon, authenticated;

grant select on public.pessoas to authenticated;
grant update (nome, telefone) on public.pessoas to authenticated;

grant select on public.perfis_acesso to authenticated;
grant insert (pessoa_id, perfil) on public.perfis_acesso to authenticated;
grant update (arquivado_em) on public.perfis_acesso to authenticated;

grant select on public.auditoria to authenticated;


-- ---------------------------------------------------------------------
-- 10. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.pessoas       enable row level security;
alter table public.perfis_acesso enable row level security;
alter table public.auditoria     enable row level security;

-- pessoas ---------------------------------------------------------------
create policy "pessoas: ver o próprio cadastro ou ser da diretoria"
  on public.pessoas for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
  );

create policy "pessoas: editar o próprio cadastro, ou secretaria/presidência"
  on public.pessoas for update to authenticated
  using (
    usuario_id = (select auth.uid())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  )
  with check (
    usuario_id = (select auth.uid())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  );

-- perfis_acesso ---------------------------------------------------------
create policy "perfis: ver os próprios, ou presidência/secretaria/administrador"
  on public.perfis_acesso for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('presidencia', 'secretaria', 'admin_tecnico'))
  );

create policy "perfis: só a presidência concede"
  on public.perfis_acesso for insert to authenticated
  with check ((select interno.tenho_perfil('presidencia')));

create policy "perfis: só a presidência retira (arquiva)"
  on public.perfis_acesso for update to authenticated
  using ((select interno.tenho_perfil('presidencia')))
  with check ((select interno.tenho_perfil('presidencia')));

-- auditoria -------------------------------------------------------------
create policy "auditoria: presidência e administrador técnico"
  on public.auditoria for select to authenticated
  using ((select interno.tenho_perfil('presidencia', 'admin_tecnico')));
