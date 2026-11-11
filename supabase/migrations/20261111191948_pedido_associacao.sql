-- =====================================================================
-- FASE 1.2 (parte 2) — CÓDIGOS DE ACESSO E PEDIDO DE ASSOCIAÇÃO
--
-- * Sem e-mail (PROJETO.md, 4.1): o primeiro acesso dos associados atuais e
--   a senha esquecida usam um CÓDIGO gerado pela secretaria (WhatsApp).
--   Ninguém da diretoria fica sabendo a senha de ninguém.
-- * Pedido de associação (Art. 7º): candidato → análise da diretoria (aceite
--   de um diretor na ficha) → Assembleia Ordinária aprova → associado.
-- * Fotos e comprovantes ficam no Storage, em pastas privadas por pessoa.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Códigos de acesso
--    O código só existe às claras na tela de quem gerou. No banco fica só
--    o "resumo" (hash), numa tabela interna, fora da API e fora da auditoria.
-- ---------------------------------------------------------------------
create type public.finalidade_codigo as enum ('primeiro_acesso', 'nova_senha');

create table public.codigos_acesso (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoas (id),
  finalidade    public.finalidade_codigo not null,
  expira_em     timestamptz not null,
  usado_em      timestamptz,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.codigos_acesso is 'Códigos de primeiro acesso e de nova senha (sem e-mail). O código em si não fica aqui.';
create index codigos_acesso_pessoa on public.codigos_acesso (pessoa_id);
select interno.aplicar_padroes('public.codigos_acesso');

create table interno.codigos_segredos (
  codigo_id uuid primary key references public.codigos_acesso (id),
  hash      text not null unique
);
comment on table interno.codigos_segredos is 'Resumo (SHA-256) de cada código de acesso. Fora da API e da auditoria.';

-- Normaliza o que a pessoa digitou (maiúsculas, sem traços/espaços) e calcula o resumo
create function interno.hash_codigo(p_codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g')), 'UTF8')), 'hex');
$$;

-- 12 caracteres sem os que se confundem (0/O, 1/I/L): XXXX-XXXX-XXXX (~59 bits de acaso)
create function interno.novo_codigo()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes    bytea := extensions.gen_random_bytes(12);
  v_codigo   text := '';
begin
  for i in 0..11 loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4) || '-' || substr(v_codigo, 9, 4);
end;
$$;

-- Código válido (não usado, não cancelado, dentro do prazo) → id; senão, null
create function interno.codigo_valido(p_codigo text, p_finalidade public.finalidade_codigo)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from interno.codigos_segredos s
  join public.codigos_acesso c on c.id = s.codigo_id
  where s.hash = interno.hash_codigo(p_codigo)
    and c.finalidade = p_finalidade
    and c.usado_em is null
    and c.arquivado_em is null
    and c.expira_em > now();
$$;

create function interno.gerar_codigo_acesso(p_pessoa_id uuid, p_finalidade public.finalidade_codigo)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario   uuid;
  v_arquivada timestamptz;
  v_codigo    text;
  v_id        uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')) then
    raise exception 'Só a secretaria, a presidência ou o administrador técnico geram códigos de acesso.' using errcode = '42501';
  end if;

  select usuario_id, arquivado_em into v_usuario, v_arquivada from public.pessoas where id = p_pessoa_id;
  if not found or v_arquivada is not null then
    raise exception 'Pessoa não encontrada.' using errcode = 'P0001';
  end if;
  if p_finalidade = 'primeiro_acesso' and v_usuario is not null then
    raise exception 'Esta pessoa já tem login. Para trocar a senha, gere um código de nova senha.' using errcode = 'P0001';
  end if;
  if p_finalidade = 'nova_senha' and v_usuario is null then
    raise exception 'Esta pessoa ainda não tem login. Gere um código de primeiro acesso.' using errcode = 'P0001';
  end if;

  -- Um código por vez: o anterior (ainda não usado) deixa de valer
  update public.codigos_acesso
  set arquivado_em = now()
  where pessoa_id = p_pessoa_id and finalidade = p_finalidade and usado_em is null and arquivado_em is null;

  v_codigo := interno.novo_codigo();
  insert into public.codigos_acesso (pessoa_id, finalidade, expira_em)
  values (p_pessoa_id, p_finalidade, now() + interval '7 days')
  returning id into v_id;
  insert into interno.codigos_segredos (codigo_id, hash) values (v_id, interno.hash_codigo(v_codigo));

  return v_codigo;
end;
$$;

create function interno.conferir_codigo_acesso(p_codigo text, p_finalidade public.finalidade_codigo)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select interno.codigo_valido(p_codigo, p_finalidade) is not null;
$$;

-- Senha esquecida: troca a senha do login ligado ao código (o e-mail tem de conferir)
create function interno.redefinir_senha_com_codigo(p_email text, p_codigo text, p_senha text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo_id uuid;
  v_usuario   uuid;
begin
  if length(coalesce(p_senha, '')) < 8 or p_senha !~ '[A-Za-z]' or p_senha !~ '[0-9]' then
    raise exception 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' using errcode = 'P0001';
  end if;

  v_codigo_id := interno.codigo_valido(p_codigo, 'nova_senha');
  select p.usuario_id into v_usuario
  from public.codigos_acesso c
  join public.pessoas p on p.id = c.pessoa_id
  where c.id = v_codigo_id;

  if v_codigo_id is null or v_usuario is null or not exists (
    select 1 from auth.users u where u.id = v_usuario and lower(u.email) = lower(trim(p_email))
  ) then
    raise exception 'O código ou o e-mail não conferem. Confira os dois ou peça um código novo à secretaria.'
      using errcode = 'P0001';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = v_usuario;

  update public.codigos_acesso set usado_em = now() where id = v_codigo_id;
end;
$$;

-- Primeiro acesso: o login criado com um código válido é ligado ao cadastro que a secretaria já fez
create or replace function interno.criar_pessoa_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo_id uuid;
  v_pessoa_id uuid;
begin
  if coalesce(new.raw_user_meta_data ->> 'codigo_acesso', '') <> '' then
    v_codigo_id := interno.codigo_valido(new.raw_user_meta_data ->> 'codigo_acesso', 'primeiro_acesso');
    if v_codigo_id is not null then
      select pessoa_id into v_pessoa_id from public.codigos_acesso where id = v_codigo_id;
      update public.pessoas
      set usuario_id = new.id, email = new.email
      where id = v_pessoa_id and usuario_id is null and arquivado_em is null;
      if found then
        update public.codigos_acesso set usado_em = now() where id = v_codigo_id;
        return new;
      end if;
    end if;
  end if;

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

-- Entradas pela API (só repassam para as funções internas acima)
create function public.gerar_codigo_acesso(p_pessoa_id uuid, p_finalidade public.finalidade_codigo)
returns text
language sql
security invoker
set search_path = ''
as $$ select interno.gerar_codigo_acesso(p_pessoa_id, p_finalidade); $$;

create function public.conferir_codigo_acesso(p_codigo text, p_finalidade public.finalidade_codigo)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select interno.conferir_codigo_acesso(p_codigo, p_finalidade); $$;

create function public.redefinir_senha_com_codigo(p_email text, p_codigo text, p_senha text)
returns void
language sql
security invoker
set search_path = ''
as $$ select interno.redefinir_senha_com_codigo(p_email, p_codigo, p_senha); $$;


-- ---------------------------------------------------------------------
-- 2. Foto da pessoa (usada na ficha e, na Fase 3, na carteirinha)
-- ---------------------------------------------------------------------
alter table public.pessoas add column foto_caminho text;
comment on column public.pessoas.foto_caminho is 'Caminho da foto no Storage (bucket "documentos").';


-- ---------------------------------------------------------------------
-- 3. Pedido de associação (Art. 7º)
-- ---------------------------------------------------------------------
create type public.situacao_pedido as enum (
  'enviado',               -- aguardando a análise da diretoria
  'pendencia',             -- a diretoria pediu correção ao candidato
  'aguardando_assembleia', -- um diretor aceitou a ficha; vai para a Assembleia Ordinária
  'aprovado',              -- aprovado em assembleia: virou associado
  'recusado',              -- recusado pela diretoria ou pela assembleia
  'desistiu'               -- o próprio candidato desistiu
);

create table public.pedidos_associacao (
  id                    uuid primary key default gen_random_uuid(),
  pessoa_id             uuid not null references public.pessoas (id),
  situacao              public.situacao_pedido not null default 'enviado',
  -- informado pelo candidato
  titulo_id             uuid references public.titulos_ministeriais (id),
  titulo_desde          date,
  igreja_id             uuid references public.igrejas (id),
  igreja_informada      text,
  denominacao_informada text,
  funcao                text,
  pastor_presidente     boolean not null default false,
  foto_caminho          text,
  comprovante_caminho   text,
  observacoes           text,
  declara_principios_fe boolean not null default false,
  declara_estatuto      boolean not null default false,
  consente_lgpd         boolean not null default false,
  declaracoes_em        timestamptz,
  enviado_em            timestamptz,
  -- análise da diretoria e decisão
  mensagem_pendencia    text,
  aceite_diretor_por    uuid references public.pessoas (id),
  aceite_diretor_em     timestamptz,
  assembleia_data       date,
  assembleia_ata        text,
  motivo_recusa         text,
  decisao_por           uuid references public.pessoas (id),
  decisao_em            timestamptz,
  associado_id          uuid references public.associados (id),
  arquivado_em          timestamptz,
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
comment on table public.pedidos_associacao is 'Pedidos de associação (Art. 7º): candidato → diretoria → Assembleia Ordinária. Nunca apagar.';
comment on column public.pedidos_associacao.igreja_informada is 'Quando a igreja do candidato ainda não está cadastrada. A secretaria cadastra e escolhe a igreja antes de encaminhar.';

create unique index pedidos_associacao_um_aberto
  on public.pedidos_associacao (pessoa_id)
  where situacao in ('enviado', 'pendencia', 'aguardando_assembleia') and arquivado_em is null;
create index pedidos_associacao_situacao on public.pedidos_associacao (situacao);
create index pedidos_associacao_titulo on public.pedidos_associacao (titulo_id);
create index pedidos_associacao_igreja on public.pedidos_associacao (igreja_id);
create index pedidos_associacao_aceite on public.pedidos_associacao (aceite_diretor_por);
create index pedidos_associacao_decisao on public.pedidos_associacao (decisao_por);
create index pedidos_associacao_associado on public.pedidos_associacao (associado_id);
select interno.aplicar_padroes('public.pedidos_associacao');

-- O que precisa estar preenchido para o pedido ir (ou voltar) para a diretoria
create function interno.exigir_dados_pedido(p public.pedidos_associacao)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_pasta text := 'pessoas/' || p.pessoa_id || '/';
begin
  if p.titulo_id is null then
    raise exception 'Informe o título ministerial (Art. 7º).' using errcode = 'P0001';
  end if;
  if p.igreja_id is null and coalesce(trim(p.igreja_informada), '') = '' then
    raise exception 'Informe a sua igreja (Art. 7º, §1º).' using errcode = 'P0001';
  end if;
  if p.foto_caminho is null then
    raise exception 'Envie uma foto.' using errcode = 'P0001';
  end if;
  if p.comprovante_caminho is null then
    raise exception 'Envie o comprovante do título (credencial ou certificado).' using errcode = 'P0001';
  end if;
  if left(p.foto_caminho, length(v_pasta)) <> v_pasta or left(p.comprovante_caminho, length(v_pasta)) <> v_pasta then
    raise exception 'Os arquivos do pedido precisam ser os enviados pelo próprio candidato.' using errcode = 'P0001';
  end if;
  if not (p.declara_principios_fe and p.declara_estatuto and p.consente_lgpd) then
    raise exception 'É preciso marcar as três declarações (princípios de fé, estatuto e LGPD).' using errcode = 'P0001';
  end if;
end;
$$;

-- Regras do caminho do pedido (vale para qualquer alteração, pela tela ou não)
create function interno.regras_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_eu        uuid := (select interno.minha_pessoa_id());
begin
  if tg_op = 'INSERT' then
    new.situacao := 'enviado';
    new.enviado_em := now();
    new.declaracoes_em := now();
    new.mensagem_pendencia := null;
    new.motivo_recusa := null;
    new.assembleia_data := null;
    new.assembleia_ata := null;
    new.associado_id := null;
    new.aceite_diretor_por := null;
    new.aceite_diretor_em := null;
    new.decisao_por := null;
    new.decisao_em := null;
    perform interno.exigir_dados_pedido(new);
    return new;
  end if;

  if new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'O pedido não pode mudar de pessoa.' using errcode = 'P0001';
  end if;
  if old.situacao in ('aprovado', 'recusado', 'desistiu') then
    raise exception 'Este pedido já foi encerrado e não pode mais ser alterado.' using errcode = 'P0001';
  end if;

  if not v_diretoria then
    if new.mensagem_pendencia is distinct from old.mensagem_pendencia
       or new.motivo_recusa is distinct from old.motivo_recusa
       or new.assembleia_data is distinct from old.assembleia_data
       or new.assembleia_ata is distinct from old.assembleia_ata
       or new.associado_id is distinct from old.associado_id then
      raise exception 'Só a diretoria registra a análise do pedido.' using errcode = '42501';
    end if;
    if old.situacao not in ('enviado', 'pendencia') then
      raise exception 'O pedido já foi encaminhado à assembleia e não pode mais ser alterado.' using errcode = 'P0001';
    end if;
  end if;

  if new.situacao is distinct from old.situacao then
    if new.situacao = 'enviado' and old.situacao = 'pendencia' and new.pessoa_id = v_eu then
      new.enviado_em := now();
      new.declaracoes_em := now();
      perform interno.exigir_dados_pedido(new);
    elsif new.situacao = 'desistiu' and new.pessoa_id = v_eu then
      new.decisao_por := v_eu;
      new.decisao_em := now();
    elsif new.situacao = 'pendencia' and old.situacao = 'enviado' and v_diretoria then
      if coalesce(trim(new.mensagem_pendencia), '') = '' then
        raise exception 'Escreva o que o candidato precisa corrigir.' using errcode = 'P0001';
      end if;
    elsif new.situacao = 'aguardando_assembleia' and old.situacao in ('enviado', 'pendencia') and v_diretoria then
      if new.igreja_id is null then
        raise exception 'Escolha a igreja cadastrada do candidato antes de encaminhar (cadastre a igreja, se preciso).'
          using errcode = 'P0001';
      end if;
      perform interno.exigir_dados_pedido(new);
      new.aceite_diretor_por := v_eu;
      new.aceite_diretor_em := now();
    elsif new.situacao = 'recusado' and v_diretoria then
      if coalesce(trim(new.motivo_recusa), '') = '' then
        raise exception 'Informe o motivo da recusa.' using errcode = 'P0001';
      end if;
      new.decisao_por := v_eu;
      new.decisao_em := now();
    elsif new.situacao = 'aprovado' and old.situacao = 'aguardando_assembleia' and v_diretoria then
      if new.assembleia_data is null or new.assembleia_data > current_date then
        raise exception 'Informe a data da Assembleia Ordinária que aprovou (não pode ser data futura).' using errcode = 'P0001';
      end if;
      if new.associado_id is null then
        raise exception 'Use "Registrar aprovação" para aprovar o pedido.' using errcode = 'P0001';
      end if;
      new.decisao_por := v_eu;
      new.decisao_em := now();
    else
      raise exception 'Mudança de situação não permitida (de % para %).', old.situacao, new.situacao
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger regras_pedido
  before insert or update on public.pedidos_associacao
  for each row execute function interno.regras_pedido();

-- Aprovação em Assembleia Ordinária: o candidato vira associado (tudo ou nada)
create function public.aprovar_pedido(p_pedido_id uuid, p_assembleia_data date, p_assembleia_ata text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pedido       public.pedidos_associacao;
  v_associado_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram a decisão da assembleia.' using errcode = '42501';
  end if;

  select * into v_pedido from public.pedidos_associacao where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.situacao <> 'aguardando_assembleia' then
    raise exception 'Só pedidos encaminhados à assembleia podem ser aprovados.' using errcode = 'P0001';
  end if;
  if p_assembleia_data is null or p_assembleia_data > current_date then
    raise exception 'Informe a data da Assembleia Ordinária que aprovou (não pode ser data futura).' using errcode = 'P0001';
  end if;

  insert into public.associados (pessoa_id, forma_admissao, admitido_em, assembleia_data, assembleia_ata)
  values (v_pedido.pessoa_id, 'assembleia', p_assembleia_data, p_assembleia_data, nullif(trim(p_assembleia_ata), ''))
  returning id into v_associado_id;

  insert into public.titulos_pessoa (pessoa_id, titulo_id, desde)
  values (v_pedido.pessoa_id, v_pedido.titulo_id, v_pedido.titulo_desde);

  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, pastor_presidente)
  values (v_pedido.pessoa_id, v_pedido.igreja_id, nullif(trim(v_pedido.funcao), ''), v_pedido.pastor_presidente);

  update public.pessoas
  set foto_caminho = v_pedido.foto_caminho
  where id = v_pedido.pessoa_id and foto_caminho is null;

  update public.pedidos_associacao
  set situacao = 'aprovado',
      assembleia_data = p_assembleia_data,
      assembleia_ata = nullif(trim(p_assembleia_ata), ''),
      associado_id = v_associado_id
  where id = p_pedido_id;

  return v_associado_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Arquivos (Storage): bucket privado "documentos", uma pasta por pessoa
--    pessoas/<id da pessoa>/<arquivo>. Ninguém sobrescreve nem apaga.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "documentos: cada um envia para a própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = 'pessoas'
    and (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
  );

create policy "documentos: ver os próprios ou ser da secretaria/presidência"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
      or (select interno.tenho_perfil('secretaria', 'presidencia'))
    )
  );


-- ---------------------------------------------------------------------
-- 5. Quem pode executar as funções
-- ---------------------------------------------------------------------
grant usage on schema interno to anon;

revoke all on function interno.hash_codigo(text) from public;
revoke all on function interno.novo_codigo() from public;
revoke all on function interno.codigo_valido(text, public.finalidade_codigo) from public;
revoke all on function interno.gerar_codigo_acesso(uuid, public.finalidade_codigo) from public;
revoke all on function interno.conferir_codigo_acesso(text, public.finalidade_codigo) from public;
revoke all on function interno.redefinir_senha_com_codigo(text, text, text) from public;
revoke all on function interno.exigir_dados_pedido(public.pedidos_associacao) from public;
revoke all on function interno.regras_pedido() from public;

grant execute on function interno.gerar_codigo_acesso(uuid, public.finalidade_codigo) to authenticated;
grant execute on function interno.conferir_codigo_acesso(text, public.finalidade_codigo) to anon, authenticated;
grant execute on function interno.redefinir_senha_com_codigo(text, text, text) to anon, authenticated;
grant execute on function interno.exigir_dados_pedido(public.pedidos_associacao) to authenticated;

revoke all on function public.gerar_codigo_acesso(uuid, public.finalidade_codigo) from public, anon;
revoke all on function public.conferir_codigo_acesso(text, public.finalidade_codigo) from public;
revoke all on function public.redefinir_senha_com_codigo(text, text, text) from public;
revoke all on function public.aprovar_pedido(uuid, date, text) from public, anon;
grant execute on function public.gerar_codigo_acesso(uuid, public.finalidade_codigo) to authenticated;
grant execute on function public.conferir_codigo_acesso(text, public.finalidade_codigo) to anon, authenticated;
grant execute on function public.redefinir_senha_com_codigo(text, text, text) to anon, authenticated;
grant execute on function public.aprovar_pedido(uuid, date, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Permissões das tabelas (ninguém recebe DELETE)
-- ---------------------------------------------------------------------
revoke all on public.codigos_acesso, public.pedidos_associacao from anon, authenticated;
revoke all on interno.codigos_segredos from public, anon, authenticated;

-- Códigos: a diretoria vê quando foi gerado, até quando vale e se já foi usado (nunca o código)
grant select on public.codigos_acesso to authenticated;

grant select on public.pedidos_associacao to authenticated;
grant insert (
  pessoa_id, titulo_id, titulo_desde, igreja_id, igreja_informada, denominacao_informada, funcao,
  pastor_presidente, foto_caminho, comprovante_caminho, observacoes,
  declara_principios_fe, declara_estatuto, consente_lgpd
) on public.pedidos_associacao to authenticated;
grant update (
  titulo_id, titulo_desde, igreja_id, igreja_informada, denominacao_informada, funcao,
  pastor_presidente, foto_caminho, comprovante_caminho, observacoes,
  declara_principios_fe, declara_estatuto, consente_lgpd,
  situacao, mensagem_pendencia, motivo_recusa, assembleia_data, assembleia_ata, associado_id
) on public.pedidos_associacao to authenticated;

grant update (foto_caminho) on public.pessoas to authenticated;


-- ---------------------------------------------------------------------
-- 7. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.codigos_acesso     enable row level security;
alter table public.pedidos_associacao enable row level security;
alter table interno.codigos_segredos  enable row level security;

create policy "códigos: secretaria, presidência e administrador veem"
  on public.codigos_acesso for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));

create policy "pedidos: ver o próprio ou ser da secretaria/presidência"
  on public.pedidos_associacao for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  );

create policy "pedidos: a própria pessoa pede, se ainda não for associada"
  on public.pedidos_associacao for insert to authenticated
  with check (
    pessoa_id = (select interno.minha_pessoa_id())
    and not exists (
      select 1 from public.associados a
      where a.pessoa_id = (select interno.minha_pessoa_id()) and a.arquivado_em is null
    )
  );

create policy "pedidos: o candidato corrige; a secretaria/presidência analisa"
  on public.pedidos_associacao for update to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  )
  with check (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  );
