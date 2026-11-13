-- =====================================================================
-- Fase 4.2 — Presença e faltas (PROJETO.md, seção 4.6; Estatuto, Art. 16, §1º e Art. 8º, IV)
--
--   * a lista de presença do sistema vale como "livro ou outro controle similar" (Art. 16, §1º);
--   * o associado confirma que vai ("vou participar") e, se não puder ir, justifica a falta;
--   * no dia, a secretaria marca a presença: pelo QR Code da credencial (a câmera do celular abre a
--     página de validação, que mostra o botão "Marcar presença") ou pela busca do nome;
--   * terminado o encontro, a secretaria encerra a lista: o encontro fica "realizado" e quem não
--     esteve presente tem falta;
--   * a justificativa vai ao 1º secretário, que aceita ou recusa (diretoria, 11/11/2026). Até a
--     Fase 4.4 (cargos), quem decide é a secretaria (ou a presidência);
--   * faltas SEGUIDAS às reuniões mensais, sem justificativa aceita: com 2, o associado e a secretaria
--     são avisados; com 3, o caso vai para a pauta da assembleia (Art. 8º, IV). Os números estão em
--     config_assembleias (faltas_aviso, faltas_pauta). Se a regra valer também para as assembleias é
--     a pergunta 22 do PROJETO.md: por enquanto, contam só as reuniões mensais.
-- =====================================================================

alter table public.encontros
  add column presenca_encerrada_em  timestamptz,
  add column presenca_encerrada_por uuid;
comment on column public.encontros.presenca_encerrada_em is 'Lista de presença encerrada: o encontro aconteceu (realizado); quem não esteve tem falta.';


-- ---------------------------------------------------------------------
-- 1. Presenças (uma linha por pessoa e encontro: a confirmação e a presença)
-- ---------------------------------------------------------------------
create table public.encontro_presencas (
  id             uuid primary key default gen_random_uuid(),
  encontro_id    uuid not null references public.encontros (id),
  pessoa_id      uuid not null references public.pessoas (id),
  confirmou_em   timestamptz,
  presente_em    timestamptz,
  registrado_por uuid,
  forma          text check (forma in ('qr_code', 'lista')),
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint encontro_presencas_forma check ((presente_em is null) = (forma is null))
);
comment on table public.encontro_presencas is 'Confirmação ("vou participar") e presença de cada associado em cada encontro. Gravar só pelas funções.';
create unique index encontro_presencas_uma on public.encontro_presencas (encontro_id, pessoa_id) where arquivado_em is null;
create index encontro_presencas_pessoa on public.encontro_presencas (pessoa_id);
select interno.aplicar_padroes('public.encontro_presencas');


-- ---------------------------------------------------------------------
-- 2. Justificativas de falta (o 1º secretário aceita ou recusa)
-- ---------------------------------------------------------------------
create table public.justificativas_falta (
  id              uuid primary key default gen_random_uuid(),
  encontro_id     uuid not null references public.encontros (id),
  pessoa_id       uuid not null references public.pessoas (id),
  texto           text not null check (length(trim(texto)) between 3 and 1000),
  enviada_em      timestamptz not null default now(),
  situacao        text not null default 'pendente' check (situacao in ('pendente', 'aceita', 'recusada')),
  decidida_por    uuid,
  decidida_em     timestamptz,
  motivo_decisao  text,
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  constraint justificativas_falta_recusa check (situacao <> 'recusada' or length(trim(coalesce(motivo_decisao, ''))) > 0)
);
comment on table public.justificativas_falta is 'Justificativa de falta: o associado envia; o 1º secretário aceita ou recusa (com motivo).';
create unique index justificativas_falta_uma on public.justificativas_falta (encontro_id, pessoa_id) where arquivado_em is null;
select interno.aplicar_padroes('public.justificativas_falta');


-- ---------------------------------------------------------------------
-- 3. Regras auxiliares
-- ---------------------------------------------------------------------
-- Associado ativo (hoje)
create function interno.associado_ativo(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.associados a
    where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  );
$$;

-- Dá para marcar presença agora? (do dia do encontro: de 6 horas antes até 18 horas depois, antes de encerrar)
create function interno.presenca_aberta(p_encontro public.encontros)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_encontro.situacao = 'convocado'
    and p_encontro.presenca_encerrada_em is null
    and now() between p_encontro.inicio - interval '6 hours' and p_encontro.inicio + interval '18 hours';
$$;


-- ---------------------------------------------------------------------
-- 4. O associado: "vou participar" e justificar a falta
-- ---------------------------------------------------------------------
create function interno.confirmar_presenca(p_encontro_id uuid, p_vou boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_encontro public.encontros;
begin
  if v_eu is null or not (select interno.associado_ativo(v_eu)) then
    raise exception 'Só associado ativo confirma presença.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null;
  if not found or v_encontro.situacao <> 'convocado' or v_encontro.inicio < now() then
    raise exception 'Só dá para confirmar presença em encontro convocado que ainda vai acontecer.' using errcode = 'P0001';
  end if;
  insert into public.encontro_presencas (encontro_id, pessoa_id, confirmou_em)
  values (p_encontro_id, v_eu, case when p_vou then now() end)
  on conflict (encontro_id, pessoa_id) where arquivado_em is null
  do update set confirmou_em = case when p_vou then coalesce(public.encontro_presencas.confirmou_em, now()) end;
end;
$$;

create function interno.justificar_falta(p_encontro_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_encontro public.encontros;
  v_atual public.justificativas_falta;
begin
  if v_eu is null or not (select interno.associado_ativo(v_eu)) then
    raise exception 'Só associado ativo justifica falta.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null;
  if not found or v_encontro.situacao not in ('convocado', 'realizado') then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if v_encontro.situacao = 'realizado' and v_encontro.presenca_encerrada_em < now() - interval '30 days' then
    raise exception 'A justificativa vale até 30 dias depois do encontro.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.encontro_presencas where encontro_id = p_encontro_id and pessoa_id = v_eu
             and presente_em is not null and arquivado_em is null) then
    raise exception 'Você esteve presente: não há falta para justificar.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_texto)), 0) < 3 then
    raise exception 'Escreva a justificativa.' using errcode = 'P0001';
  end if;
  select * into v_atual from public.justificativas_falta
  where encontro_id = p_encontro_id and pessoa_id = v_eu and arquivado_em is null for update;
  if found then
    if v_atual.situacao <> 'pendente' then
      raise exception 'A justificativa já foi analisada pelo 1º secretário.' using errcode = 'P0001';
    end if;
    update public.justificativas_falta set texto = trim(p_texto), enviada_em = now() where id = v_atual.id;
  else
    insert into public.justificativas_falta (encontro_id, pessoa_id, texto) values (p_encontro_id, v_eu, trim(p_texto));
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. A secretaria: marcar presença (pela lista ou pelo QR Code), desfazer e encerrar a lista
-- ---------------------------------------------------------------------
create function interno.registrar_presenca(p_encontro_id uuid, p_pessoa_id uuid, p_forma text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_linha public.encontro_presencas;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência marcam presença.' using errcode = '42501';
  end if;
  if p_forma not in ('qr_code', 'lista') then
    raise exception 'Forma de registro inválida.' using errcode = 'P0001';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not interno.presenca_aberta(v_encontro) then
    raise exception 'A lista de presença abre no dia do encontro (6 horas antes) e fecha quando é encerrada.' using errcode = 'P0001';
  end if;
  if not (select interno.associado_ativo(p_pessoa_id)) then
    raise exception 'Só associado ativo tem presença registrada.' using errcode = 'P0001';
  end if;
  select * into v_linha from public.encontro_presencas
  where encontro_id = p_encontro_id and pessoa_id = p_pessoa_id and arquivado_em is null for update;
  if found and v_linha.presente_em is not null then
    return 'ja_presente';
  end if;
  if found then
    update public.encontro_presencas
    set presente_em = now(), forma = p_forma, registrado_por = (select interno.minha_pessoa_id())
    where id = v_linha.id;
  else
    insert into public.encontro_presencas (encontro_id, pessoa_id, presente_em, forma, registrado_por)
    values (p_encontro_id, p_pessoa_id, now(), p_forma, (select interno.minha_pessoa_id()));
  end if;
  return 'registrada';
end;
$$;

-- Pelo QR Code: o código da credencial (de qualquer credencial não substituída da pessoa)
create function interno.registrar_presenca_por_codigo(p_encontro_id uuid, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
  v_nome text;
  v_resultado text;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência marcam presença.' using errcode = '42501';
  end if;
  select * into v_credencial from public.credenciais
  where codigo = p_codigo and substituida_em is null and arquivado_em is null;
  if not found then
    raise exception 'Credencial não encontrada ou substituída: marque pela lista, conferindo o documento.' using errcode = 'P0001';
  end if;
  v_resultado := interno.registrar_presenca(p_encontro_id, v_credencial.pessoa_id, 'qr_code');
  select nome into v_nome from public.pessoas where id = v_credencial.pessoa_id;
  return jsonb_build_object(
    'resultado', v_resultado,
    'pessoa_id', v_credencial.pessoa_id,
    'nome', v_nome,
    'em_dia', interno.esta_em_dia(v_credencial.pessoa_id)
  );
end;
$$;

create function interno.desfazer_presenca(p_encontro_id uuid, p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mexem na lista de presença.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found or not interno.presenca_aberta(v_encontro) then
    raise exception 'A lista de presença já foi encerrada.' using errcode = 'P0001';
  end if;
  update public.encontro_presencas
  set presente_em = null, forma = null, registrado_por = (select interno.minha_pessoa_id())
  where encontro_id = p_encontro_id and pessoa_id = p_pessoa_id and arquivado_em is null and presente_em is not null;
end;
$$;

create function interno.encerrar_presenca(p_encontro_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência encerram a lista de presença.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found or v_encontro.situacao <> 'convocado' or v_encontro.presenca_encerrada_em is not null then
    raise exception 'Só se encerra a lista de um encontro convocado e ainda aberto.' using errcode = 'P0001';
  end if;
  if v_encontro.inicio > now() then
    raise exception 'O encontro ainda não começou.' using errcode = 'P0001';
  end if;
  update public.encontros
  set situacao = 'realizado', presenca_encerrada_em = now(), presenca_encerrada_por = (select interno.minha_pessoa_id())
  where id = p_encontro_id;
end;
$$;

-- Encontros com a lista de presença aberta agora (para a página do QR Code mostrar o botão)
create function interno.encontros_com_presenca_aberta()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select interno.tenho_perfil('secretaria', 'presidencia')) then
    coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'inicio', e.inicio) order by e.inicio)
      from public.encontros e
      where e.arquivado_em is null and interno.presenca_aberta(e)
    ), '[]'::jsonb)
  else '[]'::jsonb end;
$$;


-- A lista de presença do encontro: os associados ativos, quem confirmou, quem está presente, se está em dia
-- e a justificativa (secretaria e presidência)
create function interno.lista_presenca(p_encontro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a lista de presença.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pessoa_id', a.pessoa_id,
      'nome', pe.nome,
      'numero_registro', a.numero_registro,
      'em_dia', interno.esta_em_dia(a.pessoa_id),
      'confirmou_em', pr.confirmou_em,
      'presente_em', pr.presente_em,
      'forma', pr.forma,
      'justificativa', j.situacao
    ) order by pe.nome)
    from public.associados a
    join public.pessoas pe on pe.id = a.pessoa_id
    left join public.encontro_presencas pr on pr.encontro_id = p_encontro_id and pr.pessoa_id = a.pessoa_id and pr.arquivado_em is null
    left join public.justificativas_falta j on j.encontro_id = p_encontro_id and j.pessoa_id = a.pessoa_id and j.arquivado_em is null
    where a.arquivado_em is null and (a.situacao = 'ativo' or pr.presente_em is not null)
  ), '[]'::jsonb);
end;
$$;


-- ---------------------------------------------------------------------
-- 6. O 1º secretário decide a justificativa
-- ---------------------------------------------------------------------
create function interno.decidir_justificativa(p_id uuid, p_aceita boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_justificativa public.justificativas_falta;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'A justificativa de falta é decidida pelo 1º secretário.' using errcode = '42501';
  end if;
  select * into v_justificativa from public.justificativas_falta where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Justificativa não encontrada.' using errcode = 'P0001';
  end if;
  if v_justificativa.pessoa_id = (select interno.minha_pessoa_id()) then
    raise exception 'Ninguém decide a própria justificativa.' using errcode = '42501';
  end if;
  if v_justificativa.situacao <> 'pendente' then
    raise exception 'Esta justificativa já foi decidida.' using errcode = 'P0001';
  end if;
  if not p_aceita and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para recusar, informe o motivo.' using errcode = 'P0001';
  end if;
  update public.justificativas_falta
  set situacao = case when p_aceita then 'aceita' else 'recusada' end,
      decidida_por = (select interno.minha_pessoa_id()),
      decidida_em = now(),
      motivo_decisao = nullif(trim(p_motivo), '')
  where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Faltas seguidas nas reuniões mensais (Art. 8º, IV)
--    Conta, da reunião mais recente para trás, as faltas sem justificativa aceita, até achar uma
--    presença ou uma falta justificada. Só reuniões encerradas depois da admissão do associado.
-- ---------------------------------------------------------------------
create function interno.faltas_seguidas(p_pessoa_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admitido date;
  v_reuniao record;
  v_faltas integer := 0;
begin
  select coalesce(a.admitido_em, '-infinity'::date) into v_admitido
  from public.associados a where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found then
    return 0;
  end if;
  for v_reuniao in
    select e.id
    from public.encontros e
    where e.tipo = 'reuniao_mensal' and e.situacao = 'realizado' and e.arquivado_em is null
      and (e.inicio at time zone 'America/Belem')::date >= v_admitido
    order by e.inicio desc
  loop
    exit when exists (
      select 1 from public.encontro_presencas p
      where p.encontro_id = v_reuniao.id and p.pessoa_id = p_pessoa_id and p.presente_em is not null and p.arquivado_em is null
    ) or exists (
      select 1 from public.justificativas_falta j
      where j.encontro_id = v_reuniao.id and j.pessoa_id = p_pessoa_id and j.situacao = 'aceita' and j.arquivado_em is null
    );
    v_faltas := v_faltas + 1;
  end loop;
  return v_faltas;
end;
$$;

-- As do próprio associado
create function interno.minhas_faltas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'faltas_seguidas', interno.faltas_seguidas((select interno.minha_pessoa_id())),
    'faltas_aviso', c.faltas_aviso,
    'faltas_pauta', c.faltas_pauta
  )
  from public.config_assembleias c where c.id;
$$;

-- As de todos os associados ativos que têm pelo menos uma falta seguida (secretaria e presidência)
create function interno.faltas_dos_associados()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem as faltas de todos.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('pessoa_id', x.pessoa_id, 'nome', x.nome, 'numero_registro', x.numero_registro, 'faltas_seguidas', x.faltas)
                     order by x.faltas desc, x.nome)
    from (
      select a.pessoa_id, p.nome, a.numero_registro, interno.faltas_seguidas(a.pessoa_id) as faltas
      from public.associados a
      join public.pessoas p on p.id = a.pessoa_id
      where a.arquivado_em is null and a.situacao = 'ativo'
    ) x
    where x.faltas > 0
  ), '[]'::jsonb);
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.confirmar_presenca(p_encontro_id uuid, p_vou boolean)
returns void language sql security invoker set search_path = '' as $$ select interno.confirmar_presenca(p_encontro_id, p_vou); $$;
create function public.justificar_falta(p_encontro_id uuid, p_texto text)
returns void language sql security invoker set search_path = '' as $$ select interno.justificar_falta(p_encontro_id, p_texto); $$;
create function public.registrar_presenca(p_encontro_id uuid, p_pessoa_id uuid, p_forma text)
returns text language sql security invoker set search_path = '' as $$ select interno.registrar_presenca(p_encontro_id, p_pessoa_id, p_forma); $$;
create function public.registrar_presenca_por_codigo(p_encontro_id uuid, p_codigo text)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.registrar_presenca_por_codigo(p_encontro_id, p_codigo); $$;
create function public.desfazer_presenca(p_encontro_id uuid, p_pessoa_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.desfazer_presenca(p_encontro_id, p_pessoa_id); $$;
create function public.encerrar_presenca(p_encontro_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.encerrar_presenca(p_encontro_id); $$;
create function public.encontros_com_presenca_aberta()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.encontros_com_presenca_aberta(); $$;
create function public.lista_presenca(p_encontro_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.lista_presenca(p_encontro_id); $$;
create function public.decidir_justificativa(p_id uuid, p_aceita boolean, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.decidir_justificativa(p_id, p_aceita, p_motivo); $$;
create function public.minhas_faltas()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.minhas_faltas(); $$;
create function public.faltas_dos_associados()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.faltas_dos_associados(); $$;

do $$
declare
  v_assinatura text;
begin
  foreach v_assinatura in array array[
    'associado_ativo(uuid)', 'presenca_aberta(public.encontros)', 'confirmar_presenca(uuid, boolean)', 'justificar_falta(uuid, text)',
    'registrar_presenca(uuid, uuid, text)', 'registrar_presenca_por_codigo(uuid, text)', 'desfazer_presenca(uuid, uuid)',
    'encerrar_presenca(uuid)', 'encontros_com_presenca_aberta()', 'decidir_justificativa(uuid, boolean, text)',
    'faltas_seguidas(uuid)', 'minhas_faltas()', 'faltas_dos_associados()', 'lista_presenca(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', v_assinatura);
    execute format('grant execute on function interno.%s to authenticated', v_assinatura);
  end loop;
  foreach v_assinatura in array array[
    'confirmar_presenca(uuid, boolean)', 'justificar_falta(uuid, text)', 'registrar_presenca(uuid, uuid, text)',
    'registrar_presenca_por_codigo(uuid, text)', 'desfazer_presenca(uuid, uuid)', 'encerrar_presenca(uuid)',
    'encontros_com_presenca_aberta()', 'decidir_justificativa(uuid, boolean, text)', 'minhas_faltas()', 'faltas_dos_associados()',
    'lista_presenca(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v_assinatura);
    execute format('grant execute on function public.%s to authenticated', v_assinatura);
  end loop;
end;
$$;

-- Tabelas: só leitura pela API; gravar, só pelas funções
revoke all on public.encontro_presencas, public.justificativas_falta from anon, authenticated;
grant select on public.encontro_presencas, public.justificativas_falta to authenticated;
alter table public.encontro_presencas enable row level security;
alter table public.justificativas_falta enable row level security;

create policy "presenças: a própria, ou secretaria e presidência"
  on public.encontro_presencas for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "justificativas: a própria, ou secretaria e presidência"
  on public.justificativas_falta for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')));
