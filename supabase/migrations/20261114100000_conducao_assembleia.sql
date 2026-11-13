-- =====================================================================
-- Fase 4.3 — Quórum, votações, desligamentos e ata (PROJETO.md, seção 4.6; Estatuto, Art. 8º, 11, 12, 16 e 21)
--
--   * QUÓRUM DE INSTALAÇÃO (Art. 16, §4º): 1ª chamada com metade mais um dos associados APTOS (ativos e
--     em dia — Art. 11; diretoria, 11/11/2026); 2ª chamada, passados os minutos da configuração (60),
--     com qualquer número. O sistema guarda a conta do momento da instalação;
--   * VOTAÇÃO de cada item da pauta que vai a votação: a secretaria registra a favor, contra e
--     abstenções. Votam só os presentes em dia (Art. 11). Maiorias:
--       - simples: mais votos a favor que contra;
--       - 3/5 e 2/3: a favor ≥ 3/5 (ou 2/3) dos presentes aptos — pergunta 24 do PROJETO.md
--         (a base é os presentes aptos ou os votos válidos?). A conta fica registrada;
--   * DESLIGAMENTO (Art. 8º): votado em Assembleia ORDINÁRIA, por 3/5. Aprovado, o associado fica
--     "desligado" e perde o perfil de ministro (o gatilho da Fase 1 cuida disso). Falecimento é
--     registrado direto pela secretaria (não se vota um fato) — pergunta 5 do PROJETO.md;
--   * ATA (Art. 12, §2º, IV e §4º; Art. 16, §5º): redigida pelo 1º secretário (perfil Secretaria até a
--     4.4) e assinada por ele e pelo presidente — duas pessoas diferentes. Assinada, não muda mais.
--     Pode levar o arquivo da ata assinada no papel (PDF ou foto).
-- =====================================================================

alter table public.encontros
  add column instalada_em          timestamptz,
  add column chamada               text check (chamada in ('primeira', 'segunda')),
  add column aptos_na_instalacao   integer,
  add column presentes_aptos_na_instalacao integer;
comment on column public.encontros.chamada is 'Assembleia instalada em 1ª chamada (com quórum) ou em 2ª chamada (qualquer número) — Art. 16, §4º.';


-- ---------------------------------------------------------------------
-- 1. Votações (uma por item da pauta; corrigir = arquivar e registrar de novo, antes da ata assinada)
-- ---------------------------------------------------------------------
create table public.deliberacoes (
  id                      uuid primary key default gen_random_uuid(),
  encontro_id             uuid not null references public.encontros (id),
  pauta_id                uuid not null references public.encontro_pauta (id),
  maioria                 public.maioria_exigida not null,
  votantes                integer not null check (votantes >= 0),
  a_favor                 integer not null check (a_favor >= 0),
  contra                  integer not null check (contra >= 0),
  abstencoes              integer not null check (abstencoes >= 0),
  aprovada                boolean not null,
  desligamento_pessoa_id  uuid references public.pessoas (id),
  desligamento_inciso     text check (desligamento_inciso in ('I', 'II', 'III', 'IV')),
  observacao              text check (observacao is null or length(observacao) <= 1000),
  arquivado_em            timestamptz,
  criado_por              uuid default auth.uid(),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  constraint deliberacoes_votos check (a_favor + contra + abstencoes <= votantes),
  constraint deliberacoes_desligamento check ((desligamento_pessoa_id is null) = (desligamento_inciso is null))
);
comment on table public.deliberacoes is 'Votação de cada item da pauta: votos, maioria exigida, votantes (presentes em dia) e o resultado.';
create unique index deliberacoes_uma_por_item on public.deliberacoes (pauta_id) where arquivado_em is null;
select interno.aplicar_padroes('public.deliberacoes');


-- ---------------------------------------------------------------------
-- 2. Desligamentos (Art. 8º): pela assembleia (I a IV) ou falecimento (V), registrado pela secretaria
-- ---------------------------------------------------------------------
create table public.desligamentos (
  id              uuid primary key default gen_random_uuid(),
  associado_id    uuid not null references public.associados (id),
  inciso          text not null check (inciso in ('I', 'II', 'III', 'IV', 'V')),
  data            date not null,
  deliberacao_id  uuid references public.deliberacoes (id),
  observacao      text check (observacao is null or length(observacao) <= 1000),
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint desligamentos_origem check ((inciso = 'V') = (deliberacao_id is null))
);
comment on table public.desligamentos is
  'Art. 8º: I a pedido; II conduta; III transferência; IV três faltas seguidas (decididos em assembleia, 3/5); V falecimento (registrado).';
select interno.aplicar_padroes('public.desligamentos');


-- ---------------------------------------------------------------------
-- 3. Atas
-- ---------------------------------------------------------------------
create table public.atas (
  id                       uuid primary key default gen_random_uuid(),
  encontro_id              uuid not null references public.encontros (id),
  texto                    text not null check (length(trim(texto)) between 10 and 30000),
  arquivo_caminho          text,
  assinada_secretario_por  uuid references public.pessoas (id),
  assinada_secretario_em   timestamptz,
  assinada_presidente_por  uuid references public.pessoas (id),
  assinada_presidente_em   timestamptz,
  arquivado_em             timestamptz,
  criado_por               uuid default auth.uid(),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now(),
  constraint atas_assinaturas_distintas check (
    assinada_secretario_por is null or assinada_presidente_por is null or assinada_secretario_por <> assinada_presidente_por
  )
);
comment on table public.atas is 'Ata da assembleia: redigida pelo 1º secretário e assinada por ele e pelo presidente (Art. 12). Assinada, não muda.';
create unique index atas_uma_por_encontro on public.atas (encontro_id) where arquivado_em is null;
select interno.aplicar_padroes('public.atas');

-- Ata assinada por alguém não muda mais o texto; com as duas assinaturas, nada muda
create function interno.proteger_ata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.assinada_secretario_em is not null and old.assinada_presidente_em is not null then
    raise exception 'Ata assinada pelo presidente e pelo 1º secretário não muda mais.' using errcode = 'P0001';
  end if;
  if (old.assinada_secretario_em is not null or old.assinada_presidente_em is not null)
     and (new.texto is distinct from old.texto or new.encontro_id is distinct from old.encontro_id) then
    raise exception 'Depois da primeira assinatura, o texto da ata não muda.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger proteger_ata before update on public.atas for each row execute function interno.proteger_ata();


-- ---------------------------------------------------------------------
-- 4. Contas do quórum: associados aptos (ativos e em dia) e presentes aptos
-- ---------------------------------------------------------------------
create function interno.contagem_quorum(p_encontro_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'aptos', (
      select count(*) from public.associados a
      where a.arquivado_em is null and a.situacao = 'ativo' and interno.esta_em_dia(a.pessoa_id)
    ),
    'presentes', (
      select count(*) from public.encontro_presencas p
      where p.encontro_id = p_encontro_id and p.presente_em is not null and p.arquivado_em is null
    ),
    'presentes_aptos', (
      select count(*) from public.encontro_presencas p
      join public.associados a on a.pessoa_id = p.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where p.encontro_id = p_encontro_id and p.presente_em is not null and p.arquivado_em is null
        and interno.esta_em_dia(p.pessoa_id)
    )
  );
$$;

-- Quórum da 1ª chamada: metade mais um dos aptos
create function interno.quorum_primeira_chamada(p_aptos integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select p_aptos / 2 + 1; $$;

-- Resultado da votação pela maioria exigida
create function interno.aprovada(p_maioria public.maioria_exigida, p_votantes integer, p_a_favor integer, p_contra integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_maioria
    when 'simples' then p_a_favor > p_contra
    when 'tres_quintos' then p_votantes > 0 and p_a_favor * 5 >= p_votantes * 3
    when 'dois_tercos' then p_votantes > 0 and p_a_favor * 3 >= p_votantes * 2
  end;
$$;

create function interno.ata_assinada(p_encontro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atas
    where encontro_id = p_encontro_id and arquivado_em is null
      and assinada_secretario_em is not null and assinada_presidente_em is not null
  );
$$;


-- ---------------------------------------------------------------------
-- 5. Instalar a assembleia (1ª ou 2ª chamada)
-- ---------------------------------------------------------------------
create function interno.instalar_assembleia(p_encontro_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_config public.config_assembleias;
  v_conta jsonb;
  v_aptos integer;
  v_presentes_aptos integer;
  v_minimo integer;
  v_segunda timestamptz;
  v_chamada text;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conduzem a assembleia.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found or v_encontro.tipo not in ('ago', 'age') then
    raise exception 'Assembleia não encontrada.' using errcode = 'P0001';
  end if;
  if v_encontro.situacao <> 'convocado' or v_encontro.instalada_em is not null then
    raise exception 'Esta assembleia já foi instalada, encerrada ou cancelada.' using errcode = 'P0001';
  end if;
  if now() < v_encontro.inicio then
    raise exception 'A assembleia ainda não começou (%).', to_char(v_encontro.inicio at time zone 'America/Belem', 'DD/MM/YYYY HH24:MI')
      using errcode = 'P0001';
  end if;
  select * into v_config from public.config_assembleias where id;
  v_conta := interno.contagem_quorum(p_encontro_id);
  v_aptos := (v_conta ->> 'aptos')::integer;
  v_presentes_aptos := (v_conta ->> 'presentes_aptos')::integer;
  v_minimo := interno.quorum_primeira_chamada(v_aptos);
  v_segunda := v_encontro.inicio + make_interval(mins => v_config.minutos_segunda_chamada);
  if v_presentes_aptos >= v_minimo then
    v_chamada := 'primeira';
  elsif now() >= v_segunda then
    v_chamada := 'segunda';
  else
    raise exception 'Sem quórum na 1ª chamada: % presentes aptos de % (precisa de %). A 2ª chamada, com qualquer número, é às %.',
      v_presentes_aptos, v_aptos, v_minimo, to_char(v_segunda at time zone 'America/Belem', 'HH24:MI') using errcode = 'P0001';
  end if;
  update public.encontros
  set instalada_em = now(), chamada = v_chamada, aptos_na_instalacao = v_aptos, presentes_aptos_na_instalacao = v_presentes_aptos
  where id = p_encontro_id;
  return jsonb_build_object('chamada', v_chamada, 'aptos', v_aptos, 'presentes_aptos', v_presentes_aptos, 'minimo', v_minimo);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Registrar a votação de um item (e o desligamento, se for o caso)
-- ---------------------------------------------------------------------
create function interno.registrar_votacao(
  p_pauta_id uuid,
  p_a_favor integer,
  p_contra integer,
  p_abstencoes integer,
  p_desligamento_pessoa_id uuid,
  p_desligamento_inciso text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.encontro_pauta;
  v_encontro public.encontros;
  v_anterior public.deliberacoes;
  v_votantes integer;
  v_aprovada boolean;
  v_id uuid;
  v_associado public.associados;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram a votação.' using errcode = '42501';
  end if;
  select * into v_item from public.encontro_pauta where id = p_pauta_id and arquivado_em is null;
  if not found or not v_item.deliberativo then
    raise exception 'Este item da pauta não vai a votação.' using errcode = 'P0001';
  end if;
  select * into v_encontro from public.encontros where id = v_item.encontro_id and arquivado_em is null for update;
  if v_encontro.instalada_em is null then
    raise exception 'Instale a assembleia (quórum) antes de registrar as votações.' using errcode = 'P0001';
  end if;
  if v_encontro.situacao = 'cancelado' or interno.ata_assinada(v_encontro.id) then
    raise exception 'Com a ata assinada, as votações não mudam mais.' using errcode = 'P0001';
  end if;
  if least(p_a_favor, p_contra, p_abstencoes) < 0 then
    raise exception 'Os votos não podem ser negativos.' using errcode = 'P0001';
  end if;

  select * into v_anterior from public.deliberacoes where pauta_id = p_pauta_id and arquivado_em is null for update;
  if found and v_anterior.desligamento_pessoa_id is not null and v_anterior.aprovada then
    raise exception 'Esta votação já desligou um associado e não pode ser refeita aqui.' using errcode = 'P0001';
  end if;

  -- votam os presentes em dia (Art. 11)
  v_votantes := (interno.contagem_quorum(v_encontro.id) ->> 'presentes_aptos')::integer;
  if p_a_favor + p_contra + p_abstencoes > v_votantes then
    raise exception 'São % votos, mas só % presentes em dia podem votar.', p_a_favor + p_contra + p_abstencoes, v_votantes
      using errcode = 'P0001';
  end if;

  if p_desligamento_pessoa_id is not null then
    if v_encontro.tipo <> 'ago' or v_item.maioria <> 'tres_quintos' then
      raise exception 'Desligamento se decide em Assembleia Ordinária, por 3/5 (Art. 8º): marque o item com essa maioria.'
        using errcode = 'P0001';
    end if;
    if p_desligamento_inciso not in ('I', 'II', 'III', 'IV') then
      raise exception 'Informe o motivo do Art. 8º (I a IV). Falecimento é registrado na ficha do ministro.' using errcode = 'P0001';
    end if;
    select * into v_associado from public.associados
    where pessoa_id = p_desligamento_pessoa_id and arquivado_em is null and situacao = 'ativo';
    if not found then
      raise exception 'Associado ativo não encontrado.' using errcode = 'P0001';
    end if;
  elsif p_desligamento_inciso is not null then
    raise exception 'Escolha o associado do desligamento.' using errcode = 'P0001';
  end if;

  if v_anterior.id is not null then
    update public.deliberacoes set arquivado_em = now() where id = v_anterior.id;
  end if;
  v_aprovada := interno.aprovada(v_item.maioria, v_votantes, p_a_favor, p_contra);
  insert into public.deliberacoes (encontro_id, pauta_id, maioria, votantes, a_favor, contra, abstencoes, aprovada,
                                   desligamento_pessoa_id, desligamento_inciso, observacao)
  values (v_encontro.id, p_pauta_id, v_item.maioria, v_votantes, p_a_favor, p_contra, p_abstencoes, v_aprovada,
          p_desligamento_pessoa_id, p_desligamento_inciso, nullif(trim(p_observacao), ''))
  returning id into v_id;

  if p_desligamento_pessoa_id is not null and v_aprovada then
    insert into public.desligamentos (associado_id, inciso, data, deliberacao_id, observacao)
    values (v_associado.id, p_desligamento_inciso, (v_encontro.inicio at time zone 'America/Belem')::date, v_id, nullif(trim(p_observacao), ''));
    update public.associados set situacao = 'desligado' where id = v_associado.id;
  end if;

  return jsonb_build_object('id', v_id, 'aprovada', v_aprovada, 'votantes', v_votantes);
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Falecimento (Art. 8º, V): registrado pela secretaria, sem votação
-- ---------------------------------------------------------------------
create function interno.registrar_falecimento(p_pessoa_id uuid, p_data date, p_observacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_associado public.associados;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram o falecimento.' using errcode = '42501';
  end if;
  select * into v_associado from public.associados where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo' for update;
  if not found then
    raise exception 'Associado ativo não encontrado.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data do falecimento (não pode ser no futuro).' using errcode = 'P0001';
  end if;
  insert into public.desligamentos (associado_id, inciso, data, observacao) values (v_associado.id, 'V', p_data, nullif(trim(p_observacao), ''));
  update public.associados set situacao = 'falecido' where id = v_associado.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Ata: salvar o texto, anexar o arquivo e assinar
-- ---------------------------------------------------------------------
create function interno.salvar_ata(p_encontro_id uuid, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_ata public.atas;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'A ata é redigida pelo 1º secretário.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null;
  if not found or v_encontro.tipo not in ('ago', 'age') or v_encontro.instalada_em is null then
    raise exception 'A ata é de uma assembleia instalada.' using errcode = 'P0001';
  end if;
  select * into v_ata from public.atas where encontro_id = p_encontro_id and arquivado_em is null for update;
  if found then
    update public.atas set texto = trim(p_texto) where id = v_ata.id;
    return v_ata.id;
  end if;
  insert into public.atas (encontro_id, texto) values (p_encontro_id, trim(p_texto)) returning id into v_ata.id;
  return v_ata.id;
end;
$$;

create function interno.anexar_ata(p_encontro_id uuid, p_caminho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência anexam a ata.' using errcode = '42501';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_encontro_id::text
     or not exists (select 1 from storage.objects where bucket_id = 'atas' and name = p_caminho) then
    raise exception 'O arquivo precisa estar na pasta desta assembleia.' using errcode = 'P0001';
  end if;
  update public.atas set arquivo_caminho = p_caminho where encontro_id = p_encontro_id and arquivado_em is null;
  if not found then
    raise exception 'Escreva a ata antes de anexar o arquivo.' using errcode = 'P0001';
  end if;
end;
$$;

-- Assina como 1º secretário (perfil Secretaria) ou como presidente (perfil Presidência). Duas pessoas diferentes.
create function interno.assinar_ata(p_encontro_id uuid, p_como text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_ata public.atas;
begin
  if p_como = 'secretario' and not (select interno.tenho_perfil('secretaria')) then
    raise exception 'Assina como 1º secretário quem tem o perfil Secretaria.' using errcode = '42501';
  end if;
  if p_como = 'presidente' and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Assina como presidente quem tem o perfil Presidência.' using errcode = '42501';
  end if;
  if p_como not in ('secretario', 'presidente') then
    raise exception 'Assinatura inválida.' using errcode = 'P0001';
  end if;
  select * into v_ata from public.atas where encontro_id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'A ata ainda não foi escrita.' using errcode = 'P0001';
  end if;
  if (p_como = 'secretario' and v_ata.assinada_presidente_por = v_eu) or (p_como = 'presidente' and v_ata.assinada_secretario_por = v_eu) then
    raise exception 'A ata é assinada por duas pessoas: o presidente e o 1º secretário.' using errcode = 'P0001';
  end if;
  if p_como = 'secretario' then
    if v_ata.assinada_secretario_em is not null then
      raise exception 'A ata já foi assinada pelo 1º secretário.' using errcode = 'P0001';
    end if;
    update public.atas set assinada_secretario_por = v_eu, assinada_secretario_em = now() where id = v_ata.id;
  else
    if v_ata.assinada_presidente_em is not null then
      raise exception 'A ata já foi assinada pelo presidente.' using errcode = 'P0001';
    end if;
    update public.atas set assinada_presidente_por = v_eu, assinada_presidente_em = now() where id = v_ata.id;
  end if;
end;
$$;

-- Pasta privada das atas assinadas no papel (PDF ou foto). Ninguém sobrescreve nem apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atas', 'atas', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "atas: secretaria e presidência enviam"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'atas'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$'
    and (select interno.tenho_perfil('secretaria', 'presidencia'))
  );
create policy "atas: quem tem login lê"
  on storage.objects for select to authenticated
  using (bucket_id = 'atas');


-- ---------------------------------------------------------------------
-- 9. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.contagem_quorum(p_encontro_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.contagem_quorum(p_encontro_id); $$;
create function public.instalar_assembleia(p_encontro_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.instalar_assembleia(p_encontro_id); $$;
create function public.registrar_votacao(p_pauta_id uuid, p_a_favor integer, p_contra integer, p_abstencoes integer,
                                         p_desligamento_pessoa_id uuid, p_desligamento_inciso text, p_observacao text)
returns jsonb language sql security invoker set search_path = '' as $$
  select interno.registrar_votacao(p_pauta_id, p_a_favor, p_contra, p_abstencoes, p_desligamento_pessoa_id, p_desligamento_inciso, p_observacao);
$$;
create function public.registrar_falecimento(p_pessoa_id uuid, p_data date, p_observacao text)
returns void language sql security invoker set search_path = '' as $$ select interno.registrar_falecimento(p_pessoa_id, p_data, p_observacao); $$;
create function public.salvar_ata(p_encontro_id uuid, p_texto text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_ata(p_encontro_id, p_texto); $$;
create function public.anexar_ata(p_encontro_id uuid, p_caminho text)
returns void language sql security invoker set search_path = '' as $$ select interno.anexar_ata(p_encontro_id, p_caminho); $$;
create function public.assinar_ata(p_encontro_id uuid, p_como text)
returns void language sql security invoker set search_path = '' as $$ select interno.assinar_ata(p_encontro_id, p_como); $$;

do $$
declare
  v text;
begin
  foreach v in array array[
    'contagem_quorum(uuid)', 'quorum_primeira_chamada(integer)', 'aprovada(public.maioria_exigida, integer, integer, integer)',
    'ata_assinada(uuid)', 'instalar_assembleia(uuid)',
    'registrar_votacao(uuid, integer, integer, integer, uuid, text, text)', 'registrar_falecimento(uuid, date, text)',
    'salvar_ata(uuid, text)', 'anexar_ata(uuid, text)', 'assinar_ata(uuid, text)'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
  end loop;
  foreach v in array array[
    'contagem_quorum(uuid)', 'instalar_assembleia(uuid)', 'registrar_votacao(uuid, integer, integer, integer, uuid, text, text)',
    'registrar_falecimento(uuid, date, text)', 'salvar_ata(uuid, text)', 'anexar_ata(uuid, text)', 'assinar_ata(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
end;
$$;
revoke all on function interno.proteger_ata() from public;

-- Tabelas: só leitura pela API; gravar, só pelas funções
revoke all on public.deliberacoes, public.desligamentos, public.atas from anon, authenticated;
grant select on public.deliberacoes, public.desligamentos, public.atas to authenticated;
alter table public.deliberacoes enable row level security;
alter table public.desligamentos enable row level security;
alter table public.atas enable row level security;

-- Votações: quem vê o encontro vê o resultado (são decisões da assembleia)
create policy "votações: de encontros que a pessoa vê"
  on public.deliberacoes for select to authenticated
  using (exists (select 1 from public.encontros e where e.id = encontro_id));
-- Desligamentos: o próprio, ou a secretaria e a presidência
create policy "desligamentos: o próprio, ou secretaria e presidência"
  on public.desligamentos for select to authenticated
  using (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or exists (select 1 from public.associados a where a.id = associado_id and a.pessoa_id = (select interno.minha_pessoa_id()))
  );
-- Atas: assinadas, todos com login leem; em preparação, só a secretaria e a presidência
create policy "atas: assinadas para todos com login; rascunho, secretaria e presidência"
  on public.atas for select to authenticated
  using (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or (assinada_secretario_em is not null and assinada_presidente_em is not null)
  );
