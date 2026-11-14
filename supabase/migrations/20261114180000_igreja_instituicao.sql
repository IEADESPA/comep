-- =====================================================================
-- FASE 5.1 — A IGREJA COMO INSTITUIÇÃO E O PRESIDENTE DE IGREJA (PROJETO.md, seção 4.3)
--
-- O novo presidente do COMEP quer um conselho que represente e apoie as igrejas da cidade (14/11/2026):
--   * a igreja guarda o estatuto, o cartão CNPJ e a ata da diretoria dela; a secretaria do COMEP confere;
--   * a diretoria da igreja (cargos, nomes e o mandato);
--   * o presidente da igreja (e o próprio ministro) pedem correções no cadastro; a secretaria atende;
--   * o resumo das igrejas: o peso (ministros associados), os em dia e a documentação.
-- Quem cuida da igreja: o pastor presidente dela (perfil Presidente de igreja), a secretaria e a presidência.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Quem cuida da igreja
-- ---------------------------------------------------------------------
create function interno.cuido_da_igreja(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select interno.tenho_perfil('secretaria', 'presidencia'))
      or p_igreja_id in (select interno.igrejas_que_presido());
$$;


-- ---------------------------------------------------------------------
-- 2. Documentos da igreja (pasta privada "igrejas", uma pasta por igreja)
-- ---------------------------------------------------------------------
create type public.tipo_documento_igreja as enum ('estatuto', 'cartao_cnpj', 'ata_diretoria', 'outro');
create type public.situacao_documento_igreja as enum ('pendente', 'conferido', 'recusado');

create table public.igreja_documentos (
  id              uuid primary key default gen_random_uuid(),
  igreja_id       uuid not null references public.igrejas (id),
  tipo            public.tipo_documento_igreja not null,
  descricao       text check (descricao is null or length(descricao) <= 300),
  arquivo_caminho text not null check (length(arquivo_caminho) <= 200),
  situacao        public.situacao_documento_igreja not null default 'pendente',
  motivo_recusa   text check (motivo_recusa is null or length(motivo_recusa) <= 500),
  enviado_por     uuid references public.pessoas (id),
  conferido_por   uuid references public.pessoas (id),
  conferido_em    timestamptz,
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint igreja_documentos_recusa check (situacao <> 'recusado' or length(trim(coalesce(motivo_recusa, ''))) > 0),
  constraint igreja_documentos_outro check (tipo <> 'outro' or length(trim(coalesce(descricao, ''))) > 0)
);
comment on table public.igreja_documentos is
  'Estatuto, cartão CNPJ e ata da diretoria de cada igreja (14/11/2026). Um em vigor por tipo; o anterior fica arquivado.';
create unique index igreja_documentos_um_por_tipo on public.igreja_documentos (igreja_id, tipo)
  where arquivado_em is null and tipo <> 'outro';
create index igreja_documentos_igreja on public.igreja_documentos (igreja_id);
create index igreja_documentos_pendentes on public.igreja_documentos (criado_em) where situacao = 'pendente' and arquivado_em is null;
create index igreja_documentos_enviado_por on public.igreja_documentos (enviado_por);
create index igreja_documentos_conferido_por on public.igreja_documentos (conferido_por);
select interno.aplicar_padroes('public.igreja_documentos');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('igrejas', 'igrejas', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- igrejas/<id da igreja>/<arquivo>: envia e lê quem cuida da igreja. Ninguém sobrescreve nem apaga.
create policy "igrejas: quem cuida da igreja envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'igrejas'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$'
    and (
      (select interno.tenho_perfil('secretaria', 'presidencia'))
      or split_part(name, '/', 1) in (select x::text from interno.igrejas_que_presido() x)
    )
  );
create policy "igrejas: quem cuida da igreja lê"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'igrejas'
    and (
      (select interno.tenho_perfil('secretaria', 'presidencia'))
      or split_part(name, '/', 1) in (select x::text from interno.igrejas_que_presido() x)
    )
  );

create function interno.registrar_documento_igreja(p_igreja_id uuid, p_tipo public.tipo_documento_igreja, p_caminho text, p_descricao text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not interno.cuido_da_igreja(p_igreja_id) then
    raise exception 'Só o pastor presidente da igreja, a secretaria ou a presidência enviam os documentos dela.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.igrejas where id = p_igreja_id and arquivado_em is null) then
    raise exception 'Igreja não encontrada.' using errcode = 'P0001';
  end if;
  if p_tipo is null then
    raise exception 'Escolha o tipo do documento.' using errcode = 'P0001';
  end if;
  if p_caminho is null or p_caminho !~ ('^' || p_igreja_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$') then
    raise exception 'O arquivo precisa estar na pasta da igreja.' using errcode = 'P0001';
  end if;
  if p_tipo = 'outro' and coalesce(trim(p_descricao), '') = '' then
    raise exception 'Diga que documento é este.' using errcode = 'P0001';
  end if;
  -- um em vigor por tipo: o anterior fica guardado (arquivado)
  if p_tipo <> 'outro' then
    update public.igreja_documentos set arquivado_em = now()
    where igreja_id = p_igreja_id and tipo = p_tipo and arquivado_em is null;
  end if;
  insert into public.igreja_documentos (igreja_id, tipo, descricao, arquivo_caminho, enviado_por)
  values (p_igreja_id, p_tipo, nullif(trim(p_descricao), ''), p_caminho, (select interno.minha_pessoa_id()))
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.conferir_documento_igreja(p_id uuid, p_aceito boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.igreja_documentos;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conferem os documentos das igrejas.' using errcode = '42501';
  end if;
  select * into v_doc from public.igreja_documentos where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Documento não encontrado.' using errcode = 'P0001';
  end if;
  if v_doc.situacao <> 'pendente' then
    raise exception 'Este documento já foi conferido.' using errcode = 'P0001';
  end if;
  if p_aceito is null then
    raise exception 'Diga se o documento foi aceito.' using errcode = 'P0001';
  end if;
  if not p_aceito and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para recusar, diga o motivo (ex.: ilegível, de outra igreja).' using errcode = 'P0001';
  end if;
  update public.igreja_documentos
  set situacao = case when p_aceito then 'conferido' else 'recusado' end::public.situacao_documento_igreja,
      motivo_recusa = case when p_aceito then null else trim(p_motivo) end,
      conferido_por = (select interno.minha_pessoa_id()), conferido_em = now()
  where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Diretoria da igreja (cargos, nomes e o mandato)
-- ---------------------------------------------------------------------
create table public.igreja_diretoria (
  id            uuid primary key default gen_random_uuid(),
  igreja_id     uuid not null references public.igrejas (id),
  cargo         text not null check (length(trim(cargo)) between 2 and 80),
  nome          text not null check (length(trim(nome)) between 2 and 200),
  inicio        date,
  fim           date,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint igreja_diretoria_periodo check (inicio is null or fim is null or fim >= inicio)
);
comment on table public.igreja_diretoria is
  'A diretoria de cada igreja, como ela informa (14/11/2026). Mudar a diretoria arquiva a anterior: o histórico fica.';
create index igreja_diretoria_igreja on public.igreja_diretoria (igreja_id);
select interno.aplicar_padroes('public.igreja_diretoria');

-- Troca a diretoria inteira (a anterior fica no histórico). Membros: [{cargo, nome}]; o mandato vale para todos.
create function interno.salvar_diretoria_igreja(p_igreja_id uuid, p_inicio date, p_fim date, p_membros jsonb)
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
  if not exists (select 1 from public.igrejas where id = p_igreja_id and arquivado_em is null) then
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
-- 4. Pedidos de correção no cadastro do ministro (a secretaria atende)
-- ---------------------------------------------------------------------
create table public.pedidos_correcao (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references public.pessoas (id),
  igreja_id      uuid references public.igrejas (id),
  pedido_por     uuid not null references public.pessoas (id),
  texto          text not null check (length(trim(texto)) between 5 and 1000),
  situacao       text not null default 'pendente' check (situacao in ('pendente', 'atendido', 'recusado')),
  resposta       text check (resposta is null or length(resposta) <= 1000),
  respondido_por uuid references public.pessoas (id),
  respondido_em  timestamptz,
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint pedidos_correcao_recusa check (situacao <> 'recusado' or length(trim(coalesce(resposta, ''))) > 0)
);
comment on table public.pedidos_correcao is
  'Correções no cadastro pedidas pelo próprio ministro ou pelo pastor presidente da igreja dele; a secretaria atende (14/11/2026).';
create index pedidos_correcao_pessoa on public.pedidos_correcao (pessoa_id);
create index pedidos_correcao_igreja on public.pedidos_correcao (igreja_id);
create index pedidos_correcao_pedido_por on public.pedidos_correcao (pedido_por);
create index pedidos_correcao_respondido_por on public.pedidos_correcao (respondido_por);
create index pedidos_correcao_pendentes on public.pedidos_correcao (criado_em) where situacao = 'pendente' and arquivado_em is null;
select interno.aplicar_padroes('public.pedidos_correcao');

create function interno.pedir_correcao(p_pessoa_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_igreja uuid;
  v_id uuid;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para pedir a correção.' using errcode = '42501';
  end if;
  if not interno.associado_ativo(p_pessoa_id) then
    raise exception 'A correção é do cadastro de um associado ativo.' using errcode = 'P0001';
  end if;
  -- a igreja atual do ministro
  select v.igreja_id into v_igreja from public.vinculos_igreja v
  where v.pessoa_id = p_pessoa_id and v.fim is null and v.arquivado_em is null
  limit 1;
  if p_pessoa_id <> v_eu and (v_igreja is null or v_igreja not in (select interno.igrejas_que_presido())) then
    raise exception 'Só o próprio ministro ou o pastor presidente da igreja dele pedem a correção.' using errcode = '42501';
  end if;
  if coalesce(length(trim(p_texto)), 0) < 5 then
    raise exception 'Diga o que precisa ser corrigido.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.pedidos_correcao
      where pedido_por = v_eu and situacao = 'pendente' and arquivado_em is null) >= 20 then
    raise exception 'Há muitos pedidos esperando a secretaria. Aguarde a resposta dos anteriores.' using errcode = 'P0001';
  end if;
  insert into public.pedidos_correcao (pessoa_id, igreja_id, pedido_por, texto)
  values (p_pessoa_id, v_igreja, v_eu, trim(p_texto))
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.responder_correcao(p_id uuid, p_atendido boolean, p_resposta text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_correcao;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência respondem os pedidos de correção.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos_correcao where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.situacao <> 'pendente' then
    raise exception 'Este pedido já foi respondido.' using errcode = 'P0001';
  end if;
  if p_atendido is null then
    raise exception 'Diga se o pedido foi atendido.' using errcode = 'P0001';
  end if;
  if not p_atendido and coalesce(trim(p_resposta), '') = '' then
    raise exception 'Para recusar, diga o motivo.' using errcode = 'P0001';
  end if;
  update public.pedidos_correcao
  set situacao = case when p_atendido then 'atendido' else 'recusado' end,
      resposta = nullif(trim(p_resposta), ''),
      respondido_por = (select interno.minha_pessoa_id()), respondido_em = now()
  where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Resumo das igrejas: o peso (ministros associados), os em dia e a documentação
-- ---------------------------------------------------------------------
create function interno.resumo_das_igrejas()
returns table (
  igreja_id         uuid,
  ministros         integer,
  ministros_em_dia  integer,
  documentos_ok     text[],
  documentos_pendentes integer,
  diretoria         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem o resumo das igrejas.' using errcode = '42501';
  end if;
  return query
  select i.id,
         (select count(*)::integer from public.vinculos_igreja v
          join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
          where v.igreja_id = i.id and v.fim is null and v.arquivado_em is null),
         (select count(*)::integer from public.vinculos_igreja v
          join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
          where v.igreja_id = i.id and v.fim is null and v.arquivado_em is null and interno.esta_em_dia(v.pessoa_id)),
         coalesce((select array_agg(d.tipo::text order by d.tipo::text) from public.igreja_documentos d
                   where d.igreja_id = i.id and d.arquivado_em is null and d.situacao = 'conferido' and d.tipo <> 'outro'), '{}'),
         (select count(*)::integer from public.igreja_documentos d
          where d.igreja_id = i.id and d.arquivado_em is null and d.situacao = 'pendente'),
         exists (select 1 from public.igreja_diretoria g where g.igreja_id = i.id and g.arquivado_em is null)
  from public.igrejas i
  where i.arquivado_em is null;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.igreja_documentos, public.igreja_diretoria, public.pedidos_correcao from anon, authenticated;
grant select on public.igreja_documentos, public.igreja_diretoria, public.pedidos_correcao to authenticated;
alter table public.igreja_documentos enable row level security;
alter table public.igreja_diretoria enable row level security;
alter table public.pedidos_correcao enable row level security;

create policy "documentos da igreja: quem cuida da igreja lê"
  on public.igreja_documentos for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')) or igreja_id in (select interno.igrejas_que_presido()));
create policy "diretoria da igreja: quem cuida da igreja lê"
  on public.igreja_diretoria for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')) or igreja_id in (select interno.igrejas_que_presido()));
create policy "pedidos de correção: quem pediu, o ministro, o pastor presidente e a secretaria leem"
  on public.pedidos_correcao for select to authenticated
  using (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or pedido_por = (select interno.minha_pessoa_id())
    or pessoa_id = (select interno.minha_pessoa_id())
    or igreja_id in (select interno.igrejas_que_presido())
  );

create function public.registrar_documento_igreja(p_igreja_id uuid, p_tipo public.tipo_documento_igreja, p_caminho text, p_descricao text)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.registrar_documento_igreja(p_igreja_id, p_tipo, p_caminho, p_descricao);
$$;
create function public.conferir_documento_igreja(p_id uuid, p_aceito boolean, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.conferir_documento_igreja(p_id, p_aceito, p_motivo); $$;
create function public.salvar_diretoria_igreja(p_igreja_id uuid, p_inicio date, p_fim date, p_membros jsonb)
returns integer language sql security invoker set search_path = '' as $$
  select interno.salvar_diretoria_igreja(p_igreja_id, p_inicio, p_fim, p_membros);
$$;
create function public.pedir_correcao(p_pessoa_id uuid, p_texto text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.pedir_correcao(p_pessoa_id, p_texto); $$;
create function public.responder_correcao(p_id uuid, p_atendido boolean, p_resposta text)
returns void language sql security invoker set search_path = '' as $$ select interno.responder_correcao(p_id, p_atendido, p_resposta); $$;
create function public.resumo_das_igrejas()
returns table (igreja_id uuid, ministros integer, ministros_em_dia integer, documentos_ok text[], documentos_pendentes integer, diretoria boolean)
language sql stable security invoker set search_path = '' as $$ select * from interno.resumo_das_igrejas(); $$;

do $$
declare
  v text;
begin
  foreach v in array array[
    'cuido_da_igreja(uuid)', 'registrar_documento_igreja(uuid, public.tipo_documento_igreja, text, text)',
    'conferir_documento_igreja(uuid, boolean, text)', 'salvar_diretoria_igreja(uuid, date, date, jsonb)',
    'pedir_correcao(uuid, text)', 'responder_correcao(uuid, boolean, text)', 'resumo_das_igrejas()'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
  end loop;
  foreach v in array array[
    'registrar_documento_igreja(uuid, public.tipo_documento_igreja, text, text)', 'conferir_documento_igreja(uuid, boolean, text)',
    'salvar_diretoria_igreja(uuid, date, date, jsonb)', 'pedir_correcao(uuid, text)', 'responder_correcao(uuid, boolean, text)',
    'resumo_das_igrejas()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
end;
$$;
