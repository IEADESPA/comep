-- =====================================================================
-- FASE 1.1 — CADASTROS
-- Denominações, igrejas, títulos ministeriais e associados (ministros),
-- com o histórico de títulos e de igrejas de cada um.
--
-- Mesmas regras da Fase 0 (PROJETO.md, seção 2):
--   * nada se apaga (arquivado_em), tudo é auditado, RLS em todas as tabelas;
--   * listas e cadastros: secretaria e presidência (Art. 12, §4º e §5º);
--   * cada ministro vê os próprios dados; a diretoria vê todos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------

-- Situação do associado (PROJETO.md, 4.2). O estatuto não prevê "suspenso" (Art. 11).
-- Desligamento e falecimento são registrados na Fase 4 (decididos em assembleia — Art. 8º).
create type public.situacao_associado as enum ('ativo', 'desligado', 'falecido');

-- Como a pessoa se tornou associada (Art. 7º, a):
--   cadastro_inicial = já era associada antes do sistema; a secretaria cadastra direto;
--   assembleia       = pedido aprovado em Assembleia Ordinária (entra na Fase 1.2).
create type public.forma_admissao as enum ('cadastro_inicial', 'assembleia');


-- ---------------------------------------------------------------------
-- 2. Funções auxiliares
-- ---------------------------------------------------------------------

-- CNPJ: 14 caracteres, já sem pontuação. Aceita o CNPJ alfanumérico (Receita Federal, 2026):
-- as 12 primeiras posições podem ter letras; cada caractere vale (código ASCII − 48).
create function interno.cnpj_valido(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_valores int[];
  v_soma    int;
  v_digito  int;
  v_pesos1  int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_pesos2  int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
begin
  if p_cnpj is null then
    return true;
  end if;
  if p_cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$' or p_cnpj ~ '^(.)\1{13}$' then
    return false;
  end if;

  v_valores := array(select ascii(substr(p_cnpj, g, 1)) - 48 from generate_series(1, 14) as g);

  v_soma := 0;
  for g in 1..12 loop
    v_soma := v_soma + v_valores[g] * v_pesos1[g];
  end loop;
  v_digito := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
  if v_digito <> v_valores[13] then
    return false;
  end if;

  v_soma := 0;
  for g in 1..13 loop
    v_soma := v_soma + v_valores[g] * v_pesos2[g];
  end loop;
  v_digito := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
  return v_digito = v_valores[14];
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Listas configuráveis (secretaria)
-- ---------------------------------------------------------------------

create table public.denominacoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) > 0),
  sigla         text,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.denominacoes is 'Denominações evangélicas das igrejas. Nunca apagar: arquivar.';
create unique index denominacoes_nome_unico on public.denominacoes (lower(trim(nome))) where arquivado_em is null;

-- Títulos aceitos (PROJETO.md, decisão 9 — lista provisória até a resposta da diretoria).
create table public.titulos_ministeriais (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) > 0),
  ordem         integer not null default 100,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.titulos_ministeriais is 'Títulos ministeriais aceitos pelo Conselho (Art. 7º). Configurável pela secretaria.';
create unique index titulos_ministeriais_nome_unico on public.titulos_ministeriais (lower(trim(nome))) where arquivado_em is null;


-- ---------------------------------------------------------------------
-- 4. Igrejas
-- ---------------------------------------------------------------------

create table public.igrejas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null check (length(trim(nome)) > 0),
  denominacao_id  uuid references public.denominacoes (id),
  cnpj            text check (interno.cnpj_valido(cnpj)),
  endereco        text,
  bairro          text,
  telefone        text,
  presidente_nome text,
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.igrejas is 'Igrejas dos associados. Nunca apagar: arquivar.';
comment on column public.igrejas.cnpj is 'Só os 14 caracteres, sem pontuação (aceita o CNPJ alfanumérico).';
comment on column public.igrejas.presidente_nome is 'Nome do pastor presidente, como texto. O painel do presidente de igreja depende da decisão 12.';
create unique index igrejas_cnpj_unico on public.igrejas (cnpj) where cnpj is not null and arquivado_em is null;
create index igrejas_denominacao on public.igrejas (denominacao_id);


-- ---------------------------------------------------------------------
-- 5. Associados (ministros) e históricos
-- ---------------------------------------------------------------------

create table public.associados (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas (id),
  numero_registro integer generated always as identity unique,
  situacao        public.situacao_associado not null default 'ativo',
  forma_admissao  public.forma_admissao not null,
  admitido_em     date,
  assembleia_data date,
  assembleia_ata  text,
  observacoes     text,
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint associados_admissao_por_assembleia
    check (forma_admissao <> 'assembleia' or (assembleia_data is not null and admitido_em is not null))
);
comment on table public.associados is 'Associados do COMEP (Art. 7º). Arquivar só cadastro feito por engano; desligamento é outra coisa (Fase 4).';
comment on column public.associados.numero_registro is 'Nº de registro do associado (carteirinha). Gerado pelo banco.';
create unique index associados_pessoa_unico on public.associados (pessoa_id) where arquivado_em is null;

-- Títulos de cada pessoa. O título atual é o último registrado (não arquivado).
create table public.titulos_pessoa (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoas (id),
  titulo_id     uuid not null references public.titulos_ministeriais (id),
  desde         date,
  observacao    text,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.titulos_pessoa is 'Histórico de títulos ministeriais de cada pessoa. O atual é o último registrado.';
comment on column public.titulos_pessoa.desde is 'Data de consagração ou de reconhecimento do título, se conhecida.';
create index titulos_pessoa_pessoa on public.titulos_pessoa (pessoa_id);

-- Vínculo com igreja. O atual é o que não tem data de fim.
create table public.vinculos_igreja (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoas (id),
  igreja_id     uuid not null references public.igrejas (id),
  funcao        text,
  inicio        date,
  fim           date,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint vinculos_igreja_periodo check (fim is null or inicio is null or fim >= inicio)
);
comment on table public.vinculos_igreja is 'Histórico de igrejas de cada pessoa. O vínculo atual é o que não tem fim.';
comment on column public.vinculos_igreja.funcao is 'Ex.: pastor presidente, pastor auxiliar, evangelista dirigente.';
create unique index vinculos_igreja_atual_unico on public.vinculos_igreja (pessoa_id) where fim is null and arquivado_em is null;
create index vinculos_igreja_igreja on public.vinculos_igreja (igreja_id);


-- ---------------------------------------------------------------------
-- 6. Padrões: carimbo, auditoria e "nada se apaga"
-- ---------------------------------------------------------------------
select interno.aplicar_padroes('public.denominacoes');
select interno.aplicar_padroes('public.titulos_ministeriais');
select interno.aplicar_padroes('public.igrejas');
select interno.aplicar_padroes('public.associados');
select interno.aplicar_padroes('public.titulos_pessoa');
select interno.aplicar_padroes('public.vinculos_igreja');


-- ---------------------------------------------------------------------
-- 7. Regras automáticas
-- ---------------------------------------------------------------------

-- Associado ativo tem o perfil "ministro"; cadastro arquivado (ou desligado/falecido) perde o perfil.
create function interno.sincronizar_perfil_ministro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.arquivado_em is null and new.situacao = 'ativo' then
    insert into public.perfis_acesso (pessoa_id, perfil)
    values (new.pessoa_id, 'ministro')
    on conflict (pessoa_id, perfil) where arquivado_em is null do nothing;
  else
    update public.perfis_acesso
    set arquivado_em = now()
    where pessoa_id = new.pessoa_id
      and perfil = 'ministro'
      and arquivado_em is null;
  end if;
  return null;
end;
$$;

create trigger sincronizar_perfil_ministro
  after insert or update of situacao, arquivado_em on public.associados
  for each row execute function interno.sincronizar_perfil_ministro();

-- O sistema nunca fica sem ninguém de Presidência (quem concede os perfis).
create function interno.proteger_ultima_presidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.perfil = 'presidencia' and old.arquivado_em is null and new.arquivado_em is not null then
    if not exists (
      select 1
      from public.perfis_acesso pa
      join public.pessoas p on p.id = pa.pessoa_id
      where pa.perfil = 'presidencia'
        and pa.arquivado_em is null
        and p.arquivado_em is null
        and pa.id <> old.id
    ) then
      raise exception 'Não é possível retirar o último perfil de Presidência: ninguém mais poderia conceder acessos.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger proteger_ultima_presidencia
  before update of arquivado_em on public.perfis_acesso
  for each row execute function interno.proteger_ultima_presidencia();

-- O e-mail de quem já tem login vem do próprio login e não é trocado por aqui.
create function interno.proteger_email_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and old.usuario_id is not null then
    raise exception 'O e-mail de quem já tem login não pode ser trocado por aqui.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger proteger_email_pessoa
  before update of email on public.pessoas
  for each row execute function interno.proteger_email_pessoa();


-- ---------------------------------------------------------------------
-- 8. Visão de associados (lista da secretaria)
--    security_invoker: quem consulta só vê o que as regras RLS das tabelas permitem.
-- ---------------------------------------------------------------------
create view public.vw_associados
with (security_invoker = true)
as
select
  a.id,
  a.pessoa_id,
  a.numero_registro,
  a.situacao,
  a.forma_admissao,
  a.admitido_em,
  a.assembleia_data,
  a.assembleia_ata,
  a.observacoes,
  p.nome,
  p.email,
  p.telefone,
  (p.usuario_id is not null) as tem_login,
  t.titulo_id,
  tm.nome as titulo,
  v.igreja_id,
  i.nome as igreja,
  v.funcao
from public.associados a
join public.pessoas p on p.id = a.pessoa_id
left join lateral (
  select tp.titulo_id
  from public.titulos_pessoa tp
  where tp.pessoa_id = a.pessoa_id
    and tp.arquivado_em is null
  order by tp.criado_em desc
  limit 1
) t on true
left join public.titulos_ministeriais tm on tm.id = t.titulo_id
left join lateral (
  select vi.igreja_id, vi.funcao
  from public.vinculos_igreja vi
  where vi.pessoa_id = a.pessoa_id
    and vi.fim is null
    and vi.arquivado_em is null
  limit 1
) v on true
left join public.igrejas i on i.id = v.igreja_id
where a.arquivado_em is null;

comment on view public.vw_associados is 'Associados não arquivados, com título e igreja atuais. Respeita a RLS de quem consulta.';


-- ---------------------------------------------------------------------
-- 9. Operações em várias tabelas de uma vez (tudo ou nada)
--    security invoker: valem as permissões e a RLS de quem chama.
-- ---------------------------------------------------------------------

-- Cadastro direto de um associado atual (Art. 7º, a), feito pela secretaria.
create function public.cadastrar_associado(
  p_nome            text,
  p_email           text,
  p_telefone        text,
  p_titulo_id       uuid,
  p_titulo_desde    date,
  p_igreja_id       uuid,
  p_funcao          text,
  p_vinculo_inicio  date,
  p_admitido_em     date,
  p_observacoes     text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pessoa_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência cadastram associados.' using errcode = '42501';
  end if;
  if p_titulo_id is null then
    raise exception 'Informe o título ministerial (Art. 7º).' using errcode = 'P0001';
  end if;
  if p_igreja_id is null then
    raise exception 'Informe a igreja do associado (Art. 7º, §1º).' using errcode = 'P0001';
  end if;

  insert into public.pessoas (nome, email, telefone)
  values (trim(p_nome), nullif(lower(trim(p_email)), ''), nullif(trim(p_telefone), ''))
  returning id into v_pessoa_id;

  insert into public.associados (pessoa_id, forma_admissao, admitido_em, observacoes)
  values (v_pessoa_id, 'cadastro_inicial', p_admitido_em, nullif(trim(p_observacoes), ''));

  insert into public.titulos_pessoa (pessoa_id, titulo_id, desde)
  values (v_pessoa_id, p_titulo_id, p_titulo_desde);

  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, inicio)
  values (v_pessoa_id, p_igreja_id, nullif(trim(p_funcao), ''), p_vinculo_inicio);

  return v_pessoa_id;
end;
$$;

-- Troca de igreja registrada pela secretaria: encerra o vínculo atual e abre o novo.
create function public.mudar_igreja(
  p_pessoa_id uuid,
  p_igreja_id uuid,
  p_funcao    text,
  p_data      date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_data date := coalesce(p_data, current_date);
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram troca de igreja.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.vinculos_igreja
    where pessoa_id = p_pessoa_id and igreja_id = p_igreja_id and fim is null and arquivado_em is null
  ) then
    raise exception 'O associado já está nesta igreja.' using errcode = 'P0001';
  end if;

  update public.vinculos_igreja
  set fim = v_data
  where pessoa_id = p_pessoa_id
    and fim is null
    and arquivado_em is null;

  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, inicio)
  values (p_pessoa_id, p_igreja_id, nullif(trim(p_funcao), ''), v_data);
end;
$$;


-- ---------------------------------------------------------------------
-- 10. Quem pode executar as funções
-- ---------------------------------------------------------------------
revoke all on function interno.cnpj_valido(text) from public;
revoke all on function interno.sincronizar_perfil_ministro() from public;
revoke all on function interno.proteger_ultima_presidencia() from public;
revoke all on function interno.proteger_email_pessoa() from public;
grant execute on function interno.cnpj_valido(text) to authenticated;

revoke all on function public.cadastrar_associado(text, text, text, uuid, date, uuid, text, date, date, text) from public, anon;
revoke all on function public.mudar_igreja(uuid, uuid, text, date) from public, anon;
grant execute on function public.cadastrar_associado(text, text, text, uuid, date, uuid, text, date, date, text) to authenticated;
grant execute on function public.mudar_igreja(uuid, uuid, text, date) to authenticated;


-- ---------------------------------------------------------------------
-- 11. Permissões das tabelas: só o necessário. Ninguém recebe DELETE.
--     "anon" (visitante sem login) não acessa nenhuma destas tabelas.
-- ---------------------------------------------------------------------
revoke all on public.denominacoes, public.titulos_ministeriais, public.igrejas,
              public.associados, public.titulos_pessoa, public.vinculos_igreja,
              public.vw_associados
  from anon, authenticated;

grant select on public.denominacoes to authenticated;
grant insert (nome, sigla) on public.denominacoes to authenticated;
grant update (nome, sigla, arquivado_em) on public.denominacoes to authenticated;

grant select on public.titulos_ministeriais to authenticated;
grant insert (nome, ordem) on public.titulos_ministeriais to authenticated;
grant update (nome, ordem, arquivado_em) on public.titulos_ministeriais to authenticated;

grant select on public.igrejas to authenticated;
grant insert (nome, denominacao_id, cnpj, endereco, bairro, telefone, presidente_nome) on public.igrejas to authenticated;
grant update (nome, denominacao_id, cnpj, endereco, bairro, telefone, presidente_nome, arquivado_em) on public.igrejas to authenticated;

grant select on public.associados to authenticated;
grant insert (pessoa_id, forma_admissao, admitido_em, assembleia_data, assembleia_ata, observacoes) on public.associados to authenticated;
grant update (admitido_em, assembleia_data, assembleia_ata, observacoes, arquivado_em) on public.associados to authenticated;

grant select on public.titulos_pessoa to authenticated;
grant insert (pessoa_id, titulo_id, desde, observacao) on public.titulos_pessoa to authenticated;
grant update (desde, observacao, arquivado_em) on public.titulos_pessoa to authenticated;

grant select on public.vinculos_igreja to authenticated;
grant insert (pessoa_id, igreja_id, funcao, inicio) on public.vinculos_igreja to authenticated;
grant update (funcao, inicio, fim, arquivado_em) on public.vinculos_igreja to authenticated;

grant select on public.vw_associados to authenticated;

-- Pessoas: a secretaria passa a cadastrar associados atuais (sem login) e a corrigir o e-mail deles.
grant insert (nome, email, telefone) on public.pessoas to authenticated;
grant update (email) on public.pessoas to authenticated;


-- ---------------------------------------------------------------------
-- 12. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.denominacoes         enable row level security;
alter table public.titulos_ministeriais enable row level security;
alter table public.igrejas              enable row level security;
alter table public.associados           enable row level security;
alter table public.titulos_pessoa       enable row level security;
alter table public.vinculos_igreja      enable row level security;

-- Listas (denominações, títulos, igrejas): todos com login leem; secretaria e presidência mantêm.
create policy "denominações: todos com login leem"
  on public.denominacoes for select to authenticated using (true);
create policy "denominações: secretaria e presidência cadastram"
  on public.denominacoes for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "denominações: secretaria e presidência alteram"
  on public.denominacoes for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

create policy "títulos: todos com login leem"
  on public.titulos_ministeriais for select to authenticated using (true);
create policy "títulos: secretaria e presidência cadastram"
  on public.titulos_ministeriais for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "títulos: secretaria e presidência alteram"
  on public.titulos_ministeriais for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

create policy "igrejas: todos com login leem"
  on public.igrejas for select to authenticated using (true);
create policy "igrejas: secretaria e presidência cadastram"
  on public.igrejas for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "igrejas: secretaria e presidência alteram"
  on public.igrejas for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

-- Associados e históricos: o próprio associado vê os seus; a diretoria vê todos.
create policy "associados: ver o próprio ou ser da diretoria"
  on public.associados for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
  );
create policy "associados: secretaria e presidência cadastram"
  on public.associados for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "associados: secretaria e presidência alteram"
  on public.associados for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

create policy "títulos da pessoa: ver os próprios ou ser da diretoria"
  on public.titulos_pessoa for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
  );
create policy "títulos da pessoa: secretaria e presidência registram"
  on public.titulos_pessoa for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "títulos da pessoa: secretaria e presidência alteram"
  on public.titulos_pessoa for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

create policy "vínculos: ver os próprios ou ser da diretoria"
  on public.vinculos_igreja for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
  );
create policy "vínculos: secretaria e presidência registram"
  on public.vinculos_igreja for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "vínculos: secretaria e presidência alteram"
  on public.vinculos_igreja for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));

-- Pessoas: secretaria e presidência cadastram associados atuais (que ainda não têm login).
create policy "pessoas: secretaria e presidência cadastram"
  on public.pessoas for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));


-- ---------------------------------------------------------------------
-- 13. Lista inicial de títulos (PROJETO.md, decisão 9 — provisória)
-- ---------------------------------------------------------------------
insert into public.titulos_ministeriais (nome, ordem) values
  ('Pastor', 10),
  ('Evangelista', 20),
  ('Presbítero', 30),
  ('Missionário', 40),
  ('Líder', 50);
