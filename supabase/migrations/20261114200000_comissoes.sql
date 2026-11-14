-- =====================================================================
-- FASE 5.2 — COMISSÕES (Art. 3º, IV e Art. 9º, III; respostas 28 a 30 de 14/11/2026)
--
--   * comissões permanentes e temporárias (educação, segurança, saúde, política, cidadania…);
--   * só associados ativos são membros; a presidência e a secretaria criam e indicam os membros;
--   * o coordenador cuida da sua comissão: registra as reuniões, as atividades e os avisos dela;
--   * todos com login veem as comissões e os membros; os registros, os membros da comissão e a diretoria;
--   * quem sai do COMEP sai das comissões. Nada se apaga: encerrar e arquivar.
-- =====================================================================

create type public.tipo_comissao as enum ('permanente', 'temporaria');

create table public.comissoes (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null check (length(trim(nome)) between 3 and 120),
  tipo                public.tipo_comissao not null,
  area                text check (area is null or length(area) <= 80),
  finalidade          text check (finalidade is null or length(finalidade) <= 2000),
  inicio              date not null default current_date,
  fim                 date,
  encerrada_em        date,
  motivo_encerramento text check (motivo_encerramento is null or length(motivo_encerramento) <= 500),
  arquivado_em        timestamptz,
  criado_por          uuid default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint comissoes_temporaria_tem_fim check (tipo <> 'temporaria' or fim is not null),
  constraint comissoes_periodo check (fim is null or fim >= inicio),
  constraint comissoes_encerramento check ((encerrada_em is null) = (motivo_encerramento is null))
);
comment on table public.comissoes is 'Comissões permanentes e temporárias (Art. 3º, IV; Art. 9º, III).';
create unique index comissoes_nome_unico on public.comissoes (lower(trim(nome))) where arquivado_em is null and encerrada_em is null;
select interno.aplicar_padroes('public.comissoes');

create table public.comissao_membros (
  id            uuid primary key default gen_random_uuid(),
  comissao_id   uuid not null references public.comissoes (id),
  pessoa_id     uuid not null references public.pessoas (id),
  coordenador   boolean not null default false,
  desde         date not null default current_date,
  ate           date,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint comissao_membros_periodo check (ate is null or ate >= desde)
);
comment on table public.comissao_membros is 'Membros de cada comissão (só associados ativos — resposta 28). Sair = data de saída; o histórico fica.';
create unique index comissao_membros_um_por_pessoa on public.comissao_membros (comissao_id, pessoa_id) where ate is null and arquivado_em is null;
create unique index comissao_membros_um_coordenador on public.comissao_membros (comissao_id) where coordenador and ate is null and arquivado_em is null;
create index comissao_membros_pessoa on public.comissao_membros (pessoa_id);
select interno.aplicar_padroes('public.comissao_membros');

create type public.tipo_registro_comissao as enum ('reuniao', 'atividade', 'aviso');

create table public.comissao_registros (
  id            uuid primary key default gen_random_uuid(),
  comissao_id   uuid not null references public.comissoes (id),
  tipo          public.tipo_registro_comissao not null,
  data          date not null,
  titulo        text not null check (length(trim(titulo)) between 3 and 200),
  texto         text check (texto is null or length(texto) <= 5000),
  autor_id      uuid references public.pessoas (id),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.comissao_registros is 'Reuniões, atividades e avisos da comissão, registrados pelo coordenador ou pela diretoria.';
create index comissao_registros_comissao on public.comissao_registros (comissao_id, data desc);
create index comissao_registros_autor on public.comissao_registros (autor_id);
select interno.aplicar_padroes('public.comissao_registros');


-- ---------------------------------------------------------------------
-- Quem é quem
-- ---------------------------------------------------------------------
create function interno.sou_membro_da_comissao(p_comissao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.comissao_membros m
    where m.comissao_id = p_comissao_id and m.pessoa_id = (select interno.minha_pessoa_id())
      and m.ate is null and m.arquivado_em is null
  );
$$;

create function interno.coordeno_a_comissao(p_comissao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.comissao_membros m
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where m.comissao_id = p_comissao_id and m.pessoa_id = (select interno.minha_pessoa_id())
      and m.coordenador and m.ate is null and m.arquivado_em is null
  );
$$;

-- Comissão em atividade: não encerrada, não arquivada, e o prazo (da temporária) não passou
create function interno.comissao_ativa(p_comissao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.comissoes c
    where c.id = p_comissao_id and c.arquivado_em is null and c.encerrada_em is null
      and (c.fim is null or c.fim >= current_date)
  );
$$;


-- ---------------------------------------------------------------------
-- A presidência e a secretaria criam, alteram e encerram (resposta 29)
-- ---------------------------------------------------------------------
create function interno.salvar_comissao(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_tipo public.tipo_comissao;
  v_inicio date;
  v_fim date;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a presidência ou a secretaria criam e alteram as comissões.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_tipo := (p_dados ->> 'tipo')::public.tipo_comissao;
    v_inicio := coalesce(nullif(p_dados ->> 'inicio', '')::date, current_date);
    v_fim := nullif(p_dados ->> 'fim', '')::date;
  exception when others then
    raise exception 'Tipo ou datas inválidos.' using errcode = 'P0001';
  end;
  if v_tipo is null then
    raise exception 'Diga se a comissão é permanente ou temporária.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_dados ->> 'nome')), 0) < 3 then
    raise exception 'Dê um nome à comissão.' using errcode = 'P0001';
  end if;
  if v_tipo = 'temporaria' and v_fim is null then
    raise exception 'A comissão temporária precisa da data de término.' using errcode = 'P0001';
  end if;
  if v_fim is not null and v_fim < v_inicio then
    raise exception 'O término vem depois do início.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.comissoes c where lower(trim(c.nome)) = lower(trim(p_dados ->> 'nome'))
             and c.arquivado_em is null and c.encerrada_em is null and c.id is distinct from v_id) then
    raise exception 'Já existe uma comissão em atividade com este nome.' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into public.comissoes (nome, tipo, area, finalidade, inicio, fim)
    values (trim(p_dados ->> 'nome'), v_tipo, nullif(trim(p_dados ->> 'area'), ''), nullif(trim(p_dados ->> 'finalidade'), ''), v_inicio, v_fim)
    returning id into v_id;
  else
    update public.comissoes
    set nome = trim(p_dados ->> 'nome'), tipo = v_tipo, area = nullif(trim(p_dados ->> 'area'), ''),
        finalidade = nullif(trim(p_dados ->> 'finalidade'), ''), inicio = v_inicio, fim = v_fim
    where id = v_id and arquivado_em is null and encerrada_em is null;
    if not found then
      raise exception 'Comissão não encontrada (ou já encerrada).' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

create function interno.encerrar_comissao(p_id uuid, p_data date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comissao public.comissoes;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a presidência ou a secretaria encerram as comissões.' using errcode = '42501';
  end if;
  select * into v_comissao from public.comissoes where id = p_id and arquivado_em is null for update;
  if not found or v_comissao.encerrada_em is not null then
    raise exception 'Comissão não encontrada (ou já encerrada).' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Diga o motivo (ex.: trabalho concluído).' using errcode = 'P0001';
  end if;
  if p_data is null or p_data < v_comissao.inicio then
    raise exception 'Informe a data do encerramento (depois do início).' using errcode = 'P0001';
  end if;
  update public.comissoes set encerrada_em = p_data, motivo_encerramento = trim(p_motivo) where id = p_id;
  -- os membros saem junto
  update public.comissao_membros set ate = greatest(p_data, desde)
  where comissao_id = p_id and ate is null and arquivado_em is null;
end;
$$;


-- ---------------------------------------------------------------------
-- Membros: só associados ativos (resposta 28); um coordenador por vez
-- ---------------------------------------------------------------------
create function interno.incluir_membro_comissao(p_comissao_id uuid, p_pessoa_id uuid, p_coordenador boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a presidência ou a secretaria indicam os membros (Art. 9º, III).' using errcode = '42501';
  end if;
  perform 1 from public.comissoes where id = p_comissao_id for update;
  if not interno.comissao_ativa(p_comissao_id) then
    raise exception 'Comissão não encontrada, encerrada ou com o prazo vencido.' using errcode = 'P0001';
  end if;
  if not interno.associado_ativo(p_pessoa_id) then
    raise exception 'Só associados ativos são membros das comissões.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.comissao_membros where comissao_id = p_comissao_id and pessoa_id = p_pessoa_id
             and ate is null and arquivado_em is null) then
    raise exception 'Esta pessoa já é membro da comissão.' using errcode = 'P0001';
  end if;
  if coalesce(p_coordenador, false) then
    -- o coordenador anterior continua como membro
    update public.comissao_membros set coordenador = false
    where comissao_id = p_comissao_id and coordenador and ate is null and arquivado_em is null;
  end if;
  insert into public.comissao_membros (comissao_id, pessoa_id, coordenador)
  values (p_comissao_id, p_pessoa_id, coalesce(p_coordenador, false))
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.definir_coordenador(p_comissao_id uuid, p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a presidência ou a secretaria escolhem o coordenador.' using errcode = '42501';
  end if;
  perform 1 from public.comissoes where id = p_comissao_id for update;
  if not interno.comissao_ativa(p_comissao_id) then
    raise exception 'Comissão não encontrada, encerrada ou com o prazo vencido.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.comissao_membros where comissao_id = p_comissao_id and pessoa_id = p_pessoa_id
                 and ate is null and arquivado_em is null) then
    raise exception 'O coordenador é um dos membros da comissão.' using errcode = 'P0001';
  end if;
  update public.comissao_membros set coordenador = false
  where comissao_id = p_comissao_id and coordenador and ate is null and arquivado_em is null;
  update public.comissao_membros set coordenador = true
  where comissao_id = p_comissao_id and pessoa_id = p_pessoa_id and ate is null and arquivado_em is null;
end;
$$;

create function interno.retirar_membro_comissao(p_membro_id uuid, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membro public.comissao_membros;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a presidência ou a secretaria tiram membros das comissões.' using errcode = '42501';
  end if;
  select * into v_membro from public.comissao_membros where id = p_membro_id and arquivado_em is null for update;
  if not found or v_membro.ate is not null then
    raise exception 'Membro não encontrado (ou já saiu).' using errcode = 'P0001';
  end if;
  update public.comissao_membros
  set ate = greatest(coalesce(p_data, current_date), v_membro.desde), coordenador = false
  where id = p_membro_id;
end;
$$;

-- Quem sai do COMEP sai das comissões
create function interno.sair_das_comissoes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.situacao = 'ativo' and new.situacao in ('desligado', 'falecido')
     or (old.arquivado_em is null and new.arquivado_em is not null) then
    update public.comissao_membros m
    set ate = greatest(current_date, m.desde), coordenador = false
    where m.pessoa_id = new.pessoa_id and m.ate is null and m.arquivado_em is null;
  end if;
  return null;
end;
$$;
create trigger sair_das_comissoes after update of situacao, arquivado_em on public.associados
  for each row execute function interno.sair_das_comissoes();


-- ---------------------------------------------------------------------
-- Registros: o coordenador (e a diretoria) registram reuniões, atividades e avisos (resposta 30)
-- ---------------------------------------------------------------------
create function interno.registrar_na_comissao(p_comissao_id uuid, p_tipo public.tipo_registro_comissao, p_data date, p_titulo text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not ((select interno.tenho_perfil('secretaria', 'presidencia')) or interno.coordeno_a_comissao(p_comissao_id)) then
    raise exception 'Só o coordenador da comissão (ou a presidência e a secretaria) registram nela.' using errcode = '42501';
  end if;
  if not interno.comissao_ativa(p_comissao_id) then
    raise exception 'Comissão não encontrada, encerrada ou com o prazo vencido.' using errcode = 'P0001';
  end if;
  if p_tipo is null or p_data is null or coalesce(length(trim(p_titulo)), 0) < 3 then
    raise exception 'Informe o tipo, a data e o título.' using errcode = 'P0001';
  end if;
  if p_data > current_date + 365 or p_data < current_date - 365 then
    raise exception 'A data precisa estar a menos de um ano de hoje.' using errcode = 'P0001';
  end if;
  insert into public.comissao_registros (comissao_id, tipo, data, titulo, texto, autor_id)
  values (p_comissao_id, p_tipo, p_data, trim(p_titulo), nullif(trim(p_texto), ''), (select interno.minha_pessoa_id()))
  returning id into v_id;
  return v_id;
end;
$$;

-- Tirar um registro feito por engano (fica guardado, arquivado): quem registrou ou a diretoria
create function interno.arquivar_registro_comissao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registro public.comissao_registros;
begin
  select * into v_registro from public.comissao_registros where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Registro não encontrado.' using errcode = 'P0001';
  end if;
  if not ((select interno.tenho_perfil('secretaria', 'presidencia'))
          or (v_registro.autor_id = (select interno.minha_pessoa_id()) and interno.coordeno_a_comissao(v_registro.comissao_id))) then
    raise exception 'Só quem registrou (sendo coordenador) ou a diretoria tiram o registro.' using errcode = '42501';
  end if;
  update public.comissao_registros set arquivado_em = now() where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- Nomes dos membros (o ministro não lê o cadastro dos outros, mas vê o nome de quem está nas comissões)
-- ---------------------------------------------------------------------
create function interno.nome_de_membro_de_comissao(p_pessoa_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.nome from public.pessoas p
  where p.id = p_pessoa_id
    and exists (select 1 from public.comissao_membros m where m.pessoa_id = p_pessoa_id and m.arquivado_em is null);
$$;
revoke all on function interno.nome_de_membro_de_comissao(uuid) from public;
grant execute on function interno.nome_de_membro_de_comissao(uuid) to authenticated;

create view public.vw_comissao_membros
with (security_invoker = true)
as
select m.id, m.comissao_id, m.pessoa_id, interno.nome_de_membro_de_comissao(m.pessoa_id) as nome, m.coordenador, m.desde, m.ate
from public.comissao_membros m
where m.arquivado_em is null;
comment on view public.vw_comissao_membros is 'Membros das comissões com o nome (todos com login veem).';


-- ---------------------------------------------------------------------
-- Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.comissoes, public.comissao_membros, public.comissao_registros from anon, authenticated;
grant select on public.comissoes, public.comissao_membros, public.comissao_registros to authenticated;
grant select on public.vw_comissao_membros to authenticated;
alter table public.comissoes enable row level security;
alter table public.comissao_membros enable row level security;
alter table public.comissao_registros enable row level security;

create policy "comissões: todos com login veem"
  on public.comissoes for select to authenticated using (arquivado_em is null);
create policy "membros das comissões: todos com login veem"
  on public.comissao_membros for select to authenticated using (arquivado_em is null);
create policy "registros da comissão: os membros e a diretoria leem"
  on public.comissao_registros for select to authenticated
  using (
    arquivado_em is null
    and ((select interno.tenho_perfil('secretaria', 'presidencia')) or interno.sou_membro_da_comissao(comissao_id))
  );

create function public.salvar_comissao(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_comissao(p_id, p_dados); $$;
create function public.encerrar_comissao(p_id uuid, p_data date, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.encerrar_comissao(p_id, p_data, p_motivo); $$;
create function public.incluir_membro_comissao(p_comissao_id uuid, p_pessoa_id uuid, p_coordenador boolean)
returns uuid language sql security invoker set search_path = '' as $$ select interno.incluir_membro_comissao(p_comissao_id, p_pessoa_id, p_coordenador); $$;
create function public.definir_coordenador(p_comissao_id uuid, p_pessoa_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.definir_coordenador(p_comissao_id, p_pessoa_id); $$;
create function public.retirar_membro_comissao(p_membro_id uuid, p_data date)
returns void language sql security invoker set search_path = '' as $$ select interno.retirar_membro_comissao(p_membro_id, p_data); $$;
create function public.registrar_na_comissao(p_comissao_id uuid, p_tipo public.tipo_registro_comissao, p_data date, p_titulo text, p_texto text)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.registrar_na_comissao(p_comissao_id, p_tipo, p_data, p_titulo, p_texto);
$$;
create function public.arquivar_registro_comissao(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_registro_comissao(p_id); $$;
create function public.coordeno_a_comissao(p_comissao_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$ select interno.coordeno_a_comissao(p_comissao_id); $$;

do $$
declare
  v text;
begin
  foreach v in array array[
    'sou_membro_da_comissao(uuid)', 'coordeno_a_comissao(uuid)', 'comissao_ativa(uuid)', 'salvar_comissao(uuid, jsonb)',
    'encerrar_comissao(uuid, date, text)', 'incluir_membro_comissao(uuid, uuid, boolean)', 'definir_coordenador(uuid, uuid)',
    'retirar_membro_comissao(uuid, date)', 'registrar_na_comissao(uuid, public.tipo_registro_comissao, date, text, text)',
    'arquivar_registro_comissao(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
  end loop;
  foreach v in array array[
    'salvar_comissao(uuid, jsonb)', 'encerrar_comissao(uuid, date, text)', 'incluir_membro_comissao(uuid, uuid, boolean)',
    'definir_coordenador(uuid, uuid)', 'retirar_membro_comissao(uuid, date)',
    'registrar_na_comissao(uuid, public.tipo_registro_comissao, date, text, text)', 'arquivar_registro_comissao(uuid)',
    'coordeno_a_comissao(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
end;
$$;
revoke all on function interno.sair_das_comissoes() from public;
