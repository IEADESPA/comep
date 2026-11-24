-- Telas novas, parte 14 (Fase 5.5): Assembleias — a presença pela portaria, o roteiro da condução, os convidados
-- e as resoluções protocoladas durante a reunião (desenho aprovado: asm-presenca opção 3, asm-conducao opções 1, 2
-- e 3 juntas, asm-fechamento opção 3; docs/telas-novas.md).
--
-- 1. A portaria: a secretaria deixa um celular ou tablet na entrada com um QR Code e um código de 6 letras que muda
--    a cada minuto. O ministro lê o QR (ou digita o código) no próprio celular e a presença dele fica marcada.
--    Continuam valendo a credencial lida pela secretaria e a marcação pelo nome (quem chegou atrasado).
-- 2. O roteiro: a abertura (introdução, oração e oportunidade), as pautas do edital, as que chegaram no período
--    (incluídas pela secretaria depois da convocação) e o encerramento. O item de agora vai para o telão.
-- 3. Os convidados: entram na tela, mas não votam e não contam no quórum.
-- 4. As resoluções: a secretaria protocola durante a reunião, com número por ano (01/2027, 02/2027...).
--
-- Regra da rodada 30: o edital e a ata têm o RESUMO, feito no sistema, e o OFICIAL, feito no Word para o cartório,
-- que não passa pelo sistema.

-- ---------------------------------------------------------------------
-- 1. A presença pela portaria
-- ---------------------------------------------------------------------
alter table public.encontro_presencas drop constraint encontro_presencas_forma_check;
alter table public.encontro_presencas add constraint encontro_presencas_forma_check
  check (forma in ('qr_code', 'lista', 'portaria_qr', 'portaria_codigo'));
comment on column public.encontro_presencas.forma is
  'Como a presença foi marcada: qr_code = a secretaria leu a credencial; lista = a secretaria marcou pelo nome; '
  'portaria_qr = o ministro leu o QR da portaria; portaria_codigo = o ministro digitou o código da portaria.';

-- O segredo de cada encontro, de onde sai o código da portaria. Ninguém lê direto (RLS sem política): o código sai
-- só pela função da secretaria e é conferido só pela função do ministro.
create table public.encontro_portarias (
  id            uuid primary key default gen_random_uuid(),
  encontro_id   uuid not null references public.encontros (id),
  segredo       bytea not null default extensions.gen_random_bytes(32),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.encontro_portarias is
  'O segredo da portaria de cada encontro: o código de 6 letras (muda a cada minuto) sai dele. Ninguém lê a tabela.';
create unique index encontro_portarias_encontro on public.encontro_portarias (encontro_id) where arquivado_em is null;
select interno.aplicar_padroes('public.encontro_portarias');

-- O código de um minuto: 6 letras e números sem os que se confundem (sem I, O, 0 e 1)
create function interno.codigo_da_portaria(p_segredo bytea, p_minuto bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(h.d, i) % 32 + 1, 1), '' order by i)
  from (select extensions.hmac(convert_to(p_minuto::text, 'UTF8'), p_segredo, 'sha256') as d) h,
       generate_series(0, 5) as i;
$$;

-- A tela da portaria (secretaria e presidência): o código de agora, os segundos até mudar e quem chegou por último
create function interno.portaria_do_encontro(p_encontro_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_segredo bytea;
  v_agora numeric := extract(epoch from now());
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência abrem a portaria.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not interno.presenca_aberta(v_encontro) then
    raise exception 'A portaria abre no dia do encontro (6 horas antes) e fecha quando a lista de presença é encerrada.'
      using errcode = 'P0001';
  end if;
  select segredo into v_segredo from public.encontro_portarias where encontro_id = p_encontro_id and arquivado_em is null;
  if not found then
    insert into public.encontro_portarias (encontro_id) values (p_encontro_id)
    on conflict (encontro_id) where arquivado_em is null do nothing;
    select segredo into v_segredo from public.encontro_portarias where encontro_id = p_encontro_id and arquivado_em is null;
  end if;
  return jsonb_build_object(
    'codigo', interno.codigo_da_portaria(v_segredo, floor(v_agora / 60)::bigint),
    'segundos', 60 - (floor(v_agora)::bigint % 60),
    'presentes', (
      select count(*) from public.encontro_presencas
      where encontro_id = p_encontro_id and presente_em is not null and arquivado_em is null
    ),
    'chegaram', coalesce((
      select jsonb_agg(jsonb_build_object('nome', x.nome, 'presente_em', x.presente_em, 'forma', x.forma) order by x.presente_em desc)
      from (
        select pe.nome, p.presente_em, p.forma
        from public.encontro_presencas p join public.pessoas pe on pe.id = p.pessoa_id
        where p.encontro_id = p_encontro_id and p.presente_em is not null and p.arquivado_em is null
        order by p.presente_em desc
        limit 8
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- O ministro marca a própria presença com o código da portaria (lido no QR ou digitado). Vale o código deste
-- minuto e o do minuto anterior (quem leu no fim do minuto).
create function interno.marcar_minha_presenca(p_encontro_id uuid, p_codigo text, p_pelo_qr boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_encontro public.encontros;
  v_segredo bytea;
  v_minuto bigint := floor(extract(epoch from now()) / 60)::bigint;
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_linha public.encontro_presencas;
begin
  if v_eu is null or not interno.associado_ativo(v_eu) then
    raise exception 'Só associado ativo marca a presença.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not interno.presenca_aberta(v_encontro) then
    raise exception 'A presença abre no dia do encontro (6 horas antes) e fecha quando a lista é encerrada.' using errcode = 'P0001';
  end if;
  select segredo into v_segredo from public.encontro_portarias where encontro_id = p_encontro_id and arquivado_em is null;
  if not found
     or v_codigo not in (interno.codigo_da_portaria(v_segredo, v_minuto), interno.codigo_da_portaria(v_segredo, v_minuto - 1)) then
    raise exception 'Código errado ou vencido: confira o código na tela da portaria (ele muda a cada minuto).' using errcode = 'P0001';
  end if;
  select * into v_linha from public.encontro_presencas
  where encontro_id = p_encontro_id and pessoa_id = v_eu and arquivado_em is null for update;
  if found and v_linha.presente_em is not null then
    return jsonb_build_object('resultado', 'ja_presente', 'presente_em', v_linha.presente_em,
                              'em_dia', interno.em_dia_no_encontro(v_eu, p_encontro_id));
  end if;
  if found then
    update public.encontro_presencas
    set presente_em = now(), forma = case when p_pelo_qr then 'portaria_qr' else 'portaria_codigo' end, registrado_por = v_eu
    where id = v_linha.id;
  else
    insert into public.encontro_presencas (encontro_id, pessoa_id, presente_em, forma, registrado_por)
    values (p_encontro_id, v_eu, now(), case when p_pelo_qr then 'portaria_qr' else 'portaria_codigo' end, v_eu);
  end if;
  return jsonb_build_object('resultado', 'registrada', 'presente_em', now(), 'em_dia', interno.em_dia_no_encontro(v_eu, p_encontro_id));
end;
$$;

-- ---------------------------------------------------------------------
-- 2. O roteiro da condução
-- ---------------------------------------------------------------------
alter table public.encontros
  add column roteiro_abertura text[] not null default array['Introdução', 'Oração', 'Oportunidade'],
  add column roteiro_atual text,
  add constraint encontros_roteiro_abertura check (cardinality(roteiro_abertura) <= 10),
  add constraint encontros_roteiro_atual check (
    roteiro_atual is null or roteiro_atual ~ '^(abertura:[0-9]{1,2}|pauta:[0-9a-f-]{36}|encerramento)$'
  );
comment on column public.encontros.roteiro_abertura is 'Os itens da abertura do roteiro, antes da pauta (introdução, oração, oportunidade).';
comment on column public.encontros.roteiro_atual is
  'O item do roteiro em andamento (vai para o telão): abertura:N, pauta:<id do item> ou encerramento.';

alter table public.encontro_pauta
  add column origem text not null default 'edital' check (origem in ('edital', 'periodo')),
  add column incluido_em timestamptz;
comment on column public.encontro_pauta.origem is
  'edital = a pauta da convocação; periodo = chegou depois da convocação e a secretaria juntou ao roteiro.';

-- A secretaria junta ao roteiro uma pauta que chegou no período (depois da convocação). Só na AGO ela pode ir a
-- votação: na AGE, só se vota o que estava no edital; a reunião mensal não tem votação (a decisão vira resolução).
create function interno.incluir_na_pauta(p_encontro_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_titulo text := trim(coalesce(p_dados ->> 'titulo', ''));
  v_descricao text := nullif(trim(coalesce(p_dados ->> 'descricao', '')), '');
  v_deliberativo boolean;
  v_maioria public.maioria_exigida;
  v_ordem integer;
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência juntam pautas ao roteiro.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if v_encontro.situacao <> 'convocado' or v_encontro.presenca_encerrada_em is not null then
    raise exception 'Só se junta pauta depois da convocação e antes de encerrar o encontro. Antes de convocar, edite a pauta.'
      using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(p_encontro_id) then
    raise exception 'A ata já começou a ser assinada: o roteiro não muda mais.' using errcode = 'P0001';
  end if;
  begin
    v_deliberativo := coalesce((p_dados ->> 'deliberativo')::boolean, false);
    v_maioria := nullif(p_dados ->> 'maioria', '')::public.maioria_exigida;
  exception when others then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end;
  if length(v_titulo) < 1 or length(v_titulo) > 300 then
    raise exception 'Escreva o assunto da pauta (até 300 letras).' using errcode = 'P0001';
  end if;
  if v_deliberativo and v_encontro.tipo = 'age' then
    raise exception 'Na AGE só vai a votação o que estava no edital: a pauta nova entra como informe.' using errcode = 'P0001';
  end if;
  if v_deliberativo and v_encontro.tipo = 'reuniao_mensal' then
    raise exception 'A reunião mensal não tem votação: a pauta entra como informe, e a decisão vira resolução.' using errcode = 'P0001';
  end if;
  if v_deliberativo then
    v_maioria := coalesce(v_maioria, 'simples');
  else
    v_maioria := null;
  end if;
  select coalesce(max(ordem), 0) + 1 into v_ordem from public.encontro_pauta where encontro_id = p_encontro_id and arquivado_em is null;
  if v_ordem > 50 then
    raise exception 'A pauta já tem 50 itens.' using errcode = 'P0001';
  end if;
  insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria, origem, incluido_em)
  values (p_encontro_id, v_ordem, v_titulo, v_descricao, v_deliberativo, v_maioria, 'periodo', now())
  returning id into v_id;
  return v_id;
end;
$$;

-- A abertura do roteiro (a secretaria ajusta os itens antes da pauta)
create function interno.salvar_abertura_do_roteiro(p_encontro_id uuid, p_itens text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_itens text[];
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o roteiro.' using errcode = '42501';
  end if;
  select coalesce(array_agg(trim(x) order by n), '{}') into v_itens
  from unnest(coalesce(p_itens, '{}')) with ordinality as u(x, n)
  where length(trim(x)) > 0;
  if cardinality(v_itens) > 10 or exists (select 1 from unnest(v_itens) x where length(x) > 120) then
    raise exception 'A abertura tem até 10 itens, cada um com até 120 letras.' using errcode = 'P0001';
  end if;
  update public.encontros set roteiro_abertura = v_itens, roteiro_atual = null
  where id = p_encontro_id and arquivado_em is null and situacao in ('agendado', 'convocado') and presenca_encerrada_em is null;
  if not found then
    raise exception 'Encontro não encontrado ou já encerrado.' using errcode = 'P0001';
  end if;
end;
$$;

-- O item de agora (o telão mostra). null = nenhum (antes de começar).
create function interno.avancar_roteiro(p_encontro_id uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conduzem o roteiro.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found or v_encontro.situacao not in ('convocado', 'realizado') then
    raise exception 'Encontro não encontrado (ou cancelado).' using errcode = 'P0001';
  end if;
  if p_item is not null and not (
    (p_item ~ '^abertura:[0-9]{1,2}$' and split_part(p_item, ':', 2)::integer < cardinality(v_encontro.roteiro_abertura))
    or (p_item ~ '^pauta:[0-9a-f-]{36}$' and exists (
      select 1 from public.encontro_pauta
      where id = split_part(p_item, ':', 2)::uuid and encontro_id = p_encontro_id and arquivado_em is null
    ))
    or p_item = 'encerramento'
  ) then
    raise exception 'Item do roteiro inválido.' using errcode = 'P0001';
  end if;
  update public.encontros set roteiro_atual = p_item where id = p_encontro_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Os convidados (não votam e não contam no quórum)
-- ---------------------------------------------------------------------
create table public.encontro_convidados (
  id             uuid primary key default gen_random_uuid(),
  encontro_id    uuid not null references public.encontros (id),
  nome           text not null check (length(trim(nome)) between 2 and 150),
  -- quem é: "Vereador", "Secretário de Assistência Social", "Imprensa"...
  quem_e         text check (quem_e is null or length(trim(quem_e)) <= 150),
  chegou_em      timestamptz not null default now(),
  registrado_por uuid references public.pessoas (id),
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table public.encontro_convidados is 'Os convidados de um encontro: aparecem na condução, não votam e não contam no quórum.';
create index encontro_convidados_encontro on public.encontro_convidados (encontro_id) where arquivado_em is null;
create index encontro_convidados_registrado_por on public.encontro_convidados (registrado_por);
select interno.aplicar_padroes('public.encontro_convidados');

create function interno.registrar_convidado(p_encontro_id uuid, p_nome text, p_quem_e text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram os convidados.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.encontros where id = p_encontro_id and arquivado_em is null and situacao = 'convocado'
  ) then
    raise exception 'Só se registra convidado em encontro convocado.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Escreva o nome do convidado.' using errcode = 'P0001';
  end if;
  insert into public.encontro_convidados (encontro_id, nome, quem_e, registrado_por)
  values (p_encontro_id, trim(p_nome), nullif(trim(coalesce(p_quem_e, '')), ''), (select interno.minha_pessoa_id()))
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.arquivar_convidado(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mexem nos convidados.' using errcode = '42501';
  end if;
  update public.encontro_convidados set arquivado_em = now() where id = p_id and arquivado_em is null;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. As resoluções protocoladas durante a reunião
-- ---------------------------------------------------------------------
create table public.resolucoes (
  id              uuid primary key default gen_random_uuid(),
  encontro_id     uuid not null references public.encontros (id),
  -- o número é por ano (o ano do encontro): 01/2027, 02/2027... Anulada, o número não volta.
  ano             integer not null check (ano between 2000 and 2200),
  numero          integer not null check (numero between 1 and 9999),
  texto           text not null check (length(trim(texto)) between 5 and 2000),
  pauta_id        uuid references public.encontro_pauta (id),
  protocolada_por uuid references public.pessoas (id),
  protocolada_em  timestamptz not null default now(),
  anulada_em      timestamptz,
  motivo_anulacao text check (motivo_anulacao is null or length(trim(motivo_anulacao)) between 3 and 500),
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint resolucoes_anulacao check ((anulada_em is null) = (motivo_anulacao is null))
);
comment on table public.resolucoes is
  'As resoluções de um encontro, protocoladas pela secretaria durante a reunião, com número por ano. Entram no texto da ata.';
create unique index resolucoes_numero on public.resolucoes (ano, numero);
create index resolucoes_encontro on public.resolucoes (encontro_id);
create index resolucoes_pauta on public.resolucoes (pauta_id);
create index resolucoes_protocolada_por on public.resolucoes (protocolada_por);
select interno.aplicar_padroes('public.resolucoes');

create function interno.protocolar_resolucao(p_encontro_id uuid, p_texto text, p_pauta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_ano integer;
  v_numero integer;
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência protocolam as resoluções.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null;
  if not found or v_encontro.situacao not in ('convocado', 'realizado') then
    raise exception 'Encontro não encontrado (ou cancelado).' using errcode = 'P0001';
  end if;
  if v_encontro.inicio > now() + interval '6 hours' then
    raise exception 'As resoluções se protocolam no dia do encontro.' using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(p_encontro_id) then
    raise exception 'A ata já começou a ser assinada: as resoluções não mudam mais.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 5 or length(trim(p_texto)) > 2000 then
    raise exception 'Escreva o texto da resolução (de 5 a 2000 letras).' using errcode = 'P0001';
  end if;
  if p_pauta_id is not null and not exists (
    select 1 from public.encontro_pauta where id = p_pauta_id and encontro_id = p_encontro_id and arquivado_em is null
  ) then
    raise exception 'O item da pauta não é deste encontro.' using errcode = 'P0001';
  end if;
  v_ano := extract(year from v_encontro.inicio at time zone 'America/Belem')::integer;
  -- um número de cada vez, por ano
  perform pg_advisory_xact_lock(hashtext('resolucoes'), v_ano);
  select coalesce(max(numero), 0) + 1 into v_numero from public.resolucoes where ano = v_ano;
  insert into public.resolucoes (encontro_id, ano, numero, texto, pauta_id, protocolada_por)
  values (p_encontro_id, v_ano, v_numero, trim(p_texto), p_pauta_id, (select interno.minha_pessoa_id()))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ano', v_ano, 'numero', v_numero);
end;
$$;

create function interno.anular_resolucao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.resolucoes;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência anulam uma resolução.' using errcode = '42501';
  end if;
  select * into v from public.resolucoes where id = p_id and arquivado_em is null and anulada_em is null for update;
  if not found then
    raise exception 'Resolução não encontrada (ou já anulada).' using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(v.encontro_id) then
    raise exception 'A ata já começou a ser assinada: as resoluções não mudam mais.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Diga o motivo da anulação.' using errcode = 'P0001';
  end if;
  update public.resolucoes set anulada_em = now(), motivo_anulacao = trim(p_motivo) where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. As funções públicas (a porta do app) e as permissões
-- ---------------------------------------------------------------------
create function public.portaria_do_encontro(p_encontro_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.portaria_do_encontro(p_encontro_id); $$;
create function public.marcar_minha_presenca(p_encontro_id uuid, p_codigo text, p_pelo_qr boolean)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.marcar_minha_presenca(p_encontro_id, p_codigo, p_pelo_qr); $$;
create function public.incluir_na_pauta(p_encontro_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.incluir_na_pauta(p_encontro_id, p_dados); $$;
create function public.salvar_abertura_do_roteiro(p_encontro_id uuid, p_itens text[])
returns void language sql security invoker set search_path = '' as $$ select interno.salvar_abertura_do_roteiro(p_encontro_id, p_itens); $$;
create function public.avancar_roteiro(p_encontro_id uuid, p_item text)
returns void language sql security invoker set search_path = '' as $$ select interno.avancar_roteiro(p_encontro_id, p_item); $$;
create function public.registrar_convidado(p_encontro_id uuid, p_nome text, p_quem_e text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.registrar_convidado(p_encontro_id, p_nome, p_quem_e); $$;
create function public.arquivar_convidado(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_convidado(p_id); $$;
create function public.protocolar_resolucao(p_encontro_id uuid, p_texto text, p_pauta_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.protocolar_resolucao(p_encontro_id, p_texto, p_pauta_id); $$;
create function public.anular_resolucao(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.anular_resolucao(p_id, p_motivo); $$;

revoke all on function interno.codigo_da_portaria(bytea, bigint) from public;
revoke all on function interno.portaria_do_encontro(uuid) from public;
revoke all on function interno.marcar_minha_presenca(uuid, text, boolean) from public;
revoke all on function interno.incluir_na_pauta(uuid, jsonb) from public;
revoke all on function interno.salvar_abertura_do_roteiro(uuid, text[]) from public;
revoke all on function interno.avancar_roteiro(uuid, text) from public;
revoke all on function interno.registrar_convidado(uuid, text, text) from public;
revoke all on function interno.arquivar_convidado(uuid) from public;
revoke all on function interno.protocolar_resolucao(uuid, text, uuid) from public;
revoke all on function interno.anular_resolucao(uuid, text) from public;
grant execute on function interno.portaria_do_encontro(uuid) to authenticated;
grant execute on function interno.marcar_minha_presenca(uuid, text, boolean) to authenticated;
grant execute on function interno.incluir_na_pauta(uuid, jsonb) to authenticated;
grant execute on function interno.salvar_abertura_do_roteiro(uuid, text[]) to authenticated;
grant execute on function interno.avancar_roteiro(uuid, text) to authenticated;
grant execute on function interno.registrar_convidado(uuid, text, text) to authenticated;
grant execute on function interno.arquivar_convidado(uuid) to authenticated;
grant execute on function interno.protocolar_resolucao(uuid, text, uuid) to authenticated;
grant execute on function interno.anular_resolucao(uuid, text) to authenticated;

revoke all on function public.portaria_do_encontro(uuid) from public, anon;
revoke all on function public.marcar_minha_presenca(uuid, text, boolean) from public, anon;
revoke all on function public.incluir_na_pauta(uuid, jsonb) from public, anon;
revoke all on function public.salvar_abertura_do_roteiro(uuid, text[]) from public, anon;
revoke all on function public.avancar_roteiro(uuid, text) from public, anon;
revoke all on function public.registrar_convidado(uuid, text, text) from public, anon;
revoke all on function public.arquivar_convidado(uuid) from public, anon;
revoke all on function public.protocolar_resolucao(uuid, text, uuid) from public, anon;
revoke all on function public.anular_resolucao(uuid, text) from public, anon;
grant execute on function public.portaria_do_encontro(uuid) to authenticated;
grant execute on function public.marcar_minha_presenca(uuid, text, boolean) to authenticated;
grant execute on function public.incluir_na_pauta(uuid, jsonb) to authenticated;
grant execute on function public.salvar_abertura_do_roteiro(uuid, text[]) to authenticated;
grant execute on function public.avancar_roteiro(uuid, text) to authenticated;
grant execute on function public.registrar_convidado(uuid, text, text) to authenticated;
grant execute on function public.arquivar_convidado(uuid) to authenticated;
grant execute on function public.protocolar_resolucao(uuid, text, uuid) to authenticated;
grant execute on function public.anular_resolucao(uuid, text) to authenticated;

-- Tabelas: gravar, só pelas funções
revoke all on public.encontro_portarias, public.encontro_convidados, public.resolucoes from anon, authenticated;
grant select on public.encontro_convidados, public.resolucoes to authenticated;

alter table public.encontro_portarias enable row level security;
alter table public.encontro_convidados enable row level security;
alter table public.resolucoes enable row level security;

-- encontro_portarias: nenhuma política (ninguém lê; o código sai só pelas funções)

create policy "convidados: secretaria e presidência"
  on public.encontro_convidados for select to authenticated
  using (arquivado_em is null and (select interno.tenho_perfil('secretaria', 'presidencia')));

-- as resoluções seguem as votações: a diretoria sempre; os associados ativos depois da ata assinada
create policy "resoluções: diretoria; associados ativos depois da ata assinada"
  on public.resolucoes for select to authenticated
  using (arquivado_em is null and (select interno.leio_documentos_da_assembleia(encontro_id)));
