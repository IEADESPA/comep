-- =====================================================================
-- FASE 5.5.3 — PEDIDO DE ASSEMBLEIA EXTRAORDINÁRIA ON-LINE (Art. 16, §3º; PROJETO.md, seção 9; 17/11/2026)
--
--   * a AGE é pedida por 3/5 dos associados ou pela maioria simples do Conselho Diretor, sempre com a pauta;
--   * um associado em dia (ou um membro do Conselho Diretor) abre o pedido com o assunto, a justificativa e a pauta, e já
--     assina; os outros assinam pelo sistema (como um abaixo-assinado: as assinaturas são públicas entre os associados);
--   * a conta: 3/5 dos associados APTOS (ativos e em dia, como no quórum — pergunta 25), ou mais da metade dos membros do
--     Conselho Diretor em mandato; vale a situação de HOJE de quem assinou;
--   * a coleta tem prazo (configurável, 30 dias); atingida a meta, o pedido fica guardado como atingido (não muda mais);
--   * a presidência (ou a secretaria) marca a AGE a partir do pedido: a pauta vem do pedido e o "quem pediu" (fundamento)
--     é preenchido sozinho; a convocação segue as regras de sempre (30 dias, edital).
-- =====================================================================

create type public.situacao_pedido_age as enum ('coletando', 'atingido', 'atendido', 'cancelado');

alter table public.config_assembleias
  add column prazo_pedido_age_dias integer not null default 30 check (prazo_pedido_age_dias between 1 and 180);
comment on column public.config_assembleias.prazo_pedido_age_dias is 'Dias para colher as assinaturas do pedido de AGE (Art. 16, §3º; 17/11/2026).';
grant update (prazo_pedido_age_dias) on public.config_assembleias to authenticated;

create table public.pedidos_age (
  id                         uuid primary key default gen_random_uuid(),
  titulo                     text not null check (length(trim(titulo)) between 3 and 200),
  justificativa              text not null check (length(trim(justificativa)) between 10 and 5000),
  pauta                      jsonb not null check (jsonb_typeof(pauta) = 'array' and jsonb_array_length(pauta) between 1 and 20),
  autor_id                   uuid not null references public.pessoas (id),
  prazo                      date not null,
  situacao                   public.situacao_pedido_age not null default 'coletando',
  atingido_em                timestamptz,
  atingido_por               text check (atingido_por in ('associados', 'diretoria')),
  conta_no_atingimento       jsonb,
  encontro_id                uuid references public.encontros (id),
  cancelado_em               timestamptz,
  motivo_cancelamento        text check (motivo_cancelamento is null or length(motivo_cancelamento) <= 500),
  arquivado_em               timestamptz,
  criado_por                 uuid default auth.uid(),
  criado_em                  timestamptz not null default now(),
  atualizado_em              timestamptz not null default now(),
  constraint pedidos_age_atingido check ((atingido_em is null) = (atingido_por is null)),
  constraint pedidos_age_atendido check (situacao <> 'atendido' or encontro_id is not null)
);
comment on table public.pedidos_age is 'Pedidos de Assembleia Extraordinária assinados pelos associados no sistema (Art. 16, §3º).';
create index pedidos_age_autor on public.pedidos_age (autor_id);
create index pedidos_age_encontro on public.pedidos_age (encontro_id);
select interno.aplicar_padroes('public.pedidos_age');

create table public.pedido_age_assinaturas (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos_age (id),
  pessoa_id      uuid not null references public.pessoas (id),
  assinado_em    timestamptz not null default now(),
  retirada_em    timestamptz,
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on column public.pedido_age_assinaturas.retirada_em is 'A pessoa retirou a assinatura (enquanto o pedido colhia assinaturas). Fica o histórico.';
create unique index pedido_age_assinaturas_uma on public.pedido_age_assinaturas (pedido_id, pessoa_id)
  where arquivado_em is null and retirada_em is null;
create index pedido_age_assinaturas_pessoa on public.pedido_age_assinaturas (pessoa_id);
select interno.aplicar_padroes('public.pedido_age_assinaturas');


-- ---------------------------------------------------------------------
-- 1. Quem assina e a conta
-- ---------------------------------------------------------------------
-- Apto: associado ativo e em dia (como no quórum)
create function interno.associado_apto(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.associados a where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo')
     and interno.esta_em_dia(p_pessoa_id);
$$;

-- Membro do Conselho Diretor em mandato hoje (o Conselho Fiscal não entra)
create function interno.do_conselho_diretor(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mandatos m
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where m.pessoa_id = p_pessoa_id and m.arquivado_em is null and m.cargo <> 'conselheiro_fiscal'
      and current_date between m.inicio and interno.fim_efetivo(m)
  );
$$;

create function interno.conta_pedido_age(p_pedido_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with
    aptos as (
      select count(*)::integer as n from public.associados a
      where a.arquivado_em is null and a.situacao = 'ativo' and interno.esta_em_dia(a.pessoa_id)
    ),
    diretoria as (
      select count(distinct m.pessoa_id)::integer as n from public.mandatos m
      join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where m.arquivado_em is null and m.cargo <> 'conselheiro_fiscal' and current_date between m.inicio and interno.fim_efetivo(m)
    ),
    assinaturas as (
      select s.pessoa_id from public.pedido_age_assinaturas s
      where s.pedido_id = p_pedido_id and s.arquivado_em is null and s.retirada_em is null
    )
  select jsonb_build_object(
    'assinaturas', (select count(*) from assinaturas),
    'aptos', (select n from aptos),
    'assinaturas_aptas', (select count(*) from assinaturas s where interno.associado_apto(s.pessoa_id)),
    -- 3/5 dos aptos, arredondado para cima (mas pelo menos 1)
    'minimo_associados', greatest(((select n from aptos) * 3 + 4) / 5, 1),
    'diretoria', (select n from diretoria),
    'assinaturas_diretoria', (select count(*) from assinaturas s where interno.do_conselho_diretor(s.pessoa_id)),
    -- maioria simples do Conselho Diretor: mais da metade dos membros em mandato
    'minimo_diretoria', (select n from diretoria) / 2 + 1
  );
$$;

-- Atingiu a meta? Guarda a conta do momento e o pedido não muda mais
create function interno.conferir_meta_pedido_age(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta jsonb := interno.conta_pedido_age(p_pedido_id);
  v_por text;
begin
  if (v_conta ->> 'assinaturas_aptas')::integer >= (v_conta ->> 'minimo_associados')::integer and (v_conta ->> 'aptos')::integer > 0 then
    v_por := 'associados';
  elsif (v_conta ->> 'diretoria')::integer > 0
        and (v_conta ->> 'assinaturas_diretoria')::integer >= (v_conta ->> 'minimo_diretoria')::integer then
    v_por := 'diretoria';
  end if;
  if v_por is not null then
    update public.pedidos_age
    set situacao = 'atingido', atingido_em = now(), atingido_por = v_por, conta_no_atingimento = v_conta
    where id = p_pedido_id and situacao = 'coletando';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Abrir o pedido, assinar, retirar a assinatura, cancelar
-- ---------------------------------------------------------------------
create function interno.assinar_pedido_age(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_pedido public.pedidos_age;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para assinar.' using errcode = '42501';
  end if;
  -- uma assinatura de cada vez no mesmo pedido (a conta da meta não se perde)
  select * into v_pedido from public.pedidos_age where id = p_id and arquivado_em is null for update;
  if not found or v_pedido.situacao <> 'coletando' then
    raise exception 'Este pedido não está colhendo assinaturas.' using errcode = 'P0001';
  end if;
  if v_pedido.prazo < current_date then
    raise exception 'O prazo para assinar este pedido terminou.' using errcode = 'P0001';
  end if;
  if not (interno.associado_apto(v_eu) or interno.do_conselho_diretor(v_eu)) then
    raise exception 'Assinam os associados em dia (ou os membros do Conselho Diretor).' using errcode = '42501';
  end if;
  if exists (select 1 from public.pedido_age_assinaturas
             where pedido_id = p_id and pessoa_id = v_eu and arquivado_em is null and retirada_em is null) then
    raise exception 'Você já assinou este pedido.' using errcode = 'P0001';
  end if;
  insert into public.pedido_age_assinaturas (pedido_id, pessoa_id) values (p_id, v_eu);
  perform interno.conferir_meta_pedido_age(p_id);
  return interno.detalhe_pedido_age(p_id);
end;
$$;

create function interno.criar_pedido_age(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_pauta jsonb := '[]'::jsonb;
  v_item jsonb;
  v_id uuid;
begin
  if v_eu is null or not (interno.associado_apto(v_eu) or interno.do_conselho_diretor(v_eu)) then
    raise exception 'Pedem a assembleia os associados em dia (ou os membros do Conselho Diretor).' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_dados ->> 'titulo')), 0) < 3 then
    raise exception 'Diga o assunto da assembleia.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_dados ->> 'justificativa')), 0) < 10 then
    raise exception 'Explique por que a assembleia é necessária.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_dados -> 'pauta') <> 'array' then
    raise exception 'Informe a pauta (Art. 16, §3º).' using errcode = 'P0001';
  end if;
  for v_item in select * from jsonb_array_elements(p_dados -> 'pauta') loop
    if length(trim(coalesce(v_item ->> 'titulo', ''))) > 0 then
      if length(trim(v_item ->> 'titulo')) > 200 or length(coalesce(v_item ->> 'descricao', '')) > 2000 then
        raise exception 'Cada item da pauta tem até 200 letras (e a descrição, até 2.000).' using errcode = 'P0001';
      end if;
      v_pauta := v_pauta || jsonb_build_array(jsonb_build_object(
        'titulo', trim(v_item ->> 'titulo'), 'descricao', nullif(trim(coalesce(v_item ->> 'descricao', '')), '')));
    end if;
  end loop;
  if jsonb_array_length(v_pauta) not between 1 and 20 then
    raise exception 'A pauta tem de 1 a 20 itens (Art. 16, §3º).' using errcode = 'P0001';
  end if;
  insert into public.pedidos_age (titulo, justificativa, pauta, autor_id, prazo)
  values (trim(p_dados ->> 'titulo'), trim(p_dados ->> 'justificativa'), v_pauta, v_eu,
          current_date + (select c.prazo_pedido_age_dias from public.config_assembleias c where c.id))
  returning id into v_id;
  -- quem pede já assina
  perform interno.assinar_pedido_age(v_id);
  return v_id;
end;
$$;

create function interno.retirar_assinatura_age(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if not exists (select 1 from public.pedidos_age where id = p_id and arquivado_em is null and situacao = 'coletando') then
    raise exception 'Só se retira a assinatura enquanto o pedido colhe assinaturas.' using errcode = 'P0001';
  end if;
  update public.pedido_age_assinaturas set retirada_em = now()
  where pedido_id = p_id and pessoa_id = v_eu and arquivado_em is null and retirada_em is null;
  if not found then
    raise exception 'Você não assinou este pedido.' using errcode = 'P0001';
  end if;
end;
$$;

create function interno.cancelar_pedido_age(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_age;
begin
  select * into v_pedido from public.pedidos_age where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.autor_id is distinct from (select interno.minha_pessoa_id()) then
    raise exception 'Só quem abriu o pedido o cancela.' using errcode = '42501';
  end if;
  if v_pedido.situacao <> 'coletando' then
    raise exception 'Só se cancela o pedido enquanto ele colhe assinaturas.' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Diga o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  update public.pedidos_age set situacao = 'cancelado', cancelado_em = now(), motivo_cancelamento = trim(p_motivo) where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Marcar a AGE a partir do pedido atingido
-- ---------------------------------------------------------------------
create function interno.marcar_age_do_pedido(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_age;
  v_conta jsonb;
  v_fundamento text;
  v_encontro uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a presidência ou a secretaria marcam a assembleia.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos_age where id = p_id and arquivado_em is null for update;
  if not found or v_pedido.situacao <> 'atingido' then
    raise exception 'Só se marca a AGE de um pedido que atingiu as assinaturas.' using errcode = 'P0001';
  end if;
  v_conta := v_pedido.conta_no_atingimento;
  v_fundamento := case v_pedido.atingido_por
    when 'associados' then format(
      'Pedido de 3/5 dos associados (Art. 16, §3º), feito no sistema: %s assinaturas de associados em dia, de %s aptos (mínimo %s), em %s.',
      v_conta ->> 'assinaturas_aptas', v_conta ->> 'aptos', v_conta ->> 'minimo_associados',
      to_char(v_pedido.atingido_em at time zone 'America/Belem', 'DD/MM/YYYY'))
    else format(
      'Pedido da maioria simples do Conselho Diretor (Art. 16, §3º), feito no sistema: %s de %s membros (mínimo %s), em %s.',
      v_conta ->> 'assinaturas_diretoria', v_conta ->> 'diretoria', v_conta ->> 'minimo_diretoria',
      to_char(v_pedido.atingido_em at time zone 'America/Belem', 'DD/MM/YYYY'))
  end;
  -- a assembleia nasce em preparo, com a pauta do pedido (itens de votação, maioria simples: a secretaria ajusta antes
  -- de convocar); as regras de sempre valem na convocação
  v_encontro := interno.salvar_encontro(null, jsonb_build_object(
    'tipo', 'age',
    'titulo', coalesce(nullif(trim(p_dados ->> 'titulo'), ''), 'Assembleia Geral Extraordinária — ' || v_pedido.titulo),
    'inicio', p_dados ->> 'inicio',
    'local', p_dados ->> 'local',
    'fundamento', v_fundamento,
    'pauta', (select jsonb_agg(jsonb_build_object('titulo', i ->> 'titulo', 'descricao', i ->> 'descricao', 'deliberativo', true, 'maioria', 'simples'))
              from jsonb_array_elements(v_pedido.pauta) i)
  ));
  update public.pedidos_age set situacao = 'atendido', encontro_id = v_encontro where id = p_id;
  return v_encontro;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Ver: a lista e o pedido (com as assinaturas, públicas entre os associados)
-- ---------------------------------------------------------------------
create function interno.detalhe_pedido_age(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_pedido public.pedidos_age;
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'Os pedidos de assembleia são de quem é do COMEP.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos_age where id = p_id and arquivado_em is null;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_pedido.id,
    'titulo', v_pedido.titulo,
    'justificativa', v_pedido.justificativa,
    'pauta', v_pedido.pauta,
    'autor', (select nome from public.pessoas where id = v_pedido.autor_id),
    'sou_autor', v_pedido.autor_id = v_eu,
    'prazo', v_pedido.prazo,
    'situacao', v_pedido.situacao,
    'expirado', v_pedido.situacao = 'coletando' and v_pedido.prazo < current_date,
    'atingido_em', v_pedido.atingido_em,
    'atingido_por', v_pedido.atingido_por,
    'encontro_id', v_pedido.encontro_id,
    'motivo_cancelamento', v_pedido.motivo_cancelamento,
    'criado_em', v_pedido.criado_em,
    'conta', coalesce(v_pedido.conta_no_atingimento, interno.conta_pedido_age(p_id)),
    'eu_assinei', exists (select 1 from public.pedido_age_assinaturas
                          where pedido_id = p_id and pessoa_id = v_eu and arquivado_em is null and retirada_em is null),
    'posso_assinar', v_pedido.situacao = 'coletando' and v_pedido.prazo >= current_date and v_eu is not null
                     and (interno.associado_apto(v_eu) or interno.do_conselho_diretor(v_eu)),
    'assinaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', pe.nome,
        'assinado_em', s.assinado_em,
        'conta', interno.associado_apto(s.pessoa_id),
        'diretoria', interno.do_conselho_diretor(s.pessoa_id)
      ) order by s.assinado_em)
      from public.pedido_age_assinaturas s join public.pessoas pe on pe.id = s.pessoa_id
      where s.pedido_id = p_id and s.arquivado_em is null and s.retirada_em is null
    ), '[]'::jsonb)
  );
end;
$$;

create function interno.listar_pedidos_age()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'Os pedidos de assembleia são de quem é do COMEP.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'titulo', p.titulo, 'situacao', p.situacao, 'prazo', p.prazo, 'criado_em', p.criado_em,
      'expirado', p.situacao = 'coletando' and p.prazo < current_date,
      'autor', (select nome from public.pessoas where id = p.autor_id),
      'conta', coalesce(p.conta_no_atingimento, interno.conta_pedido_age(p.id)),
      'eu_assinei', exists (select 1 from public.pedido_age_assinaturas s
                            where s.pedido_id = p.id and s.pessoa_id = v_eu and s.arquivado_em is null and s.retirada_em is null),
      'posso_assinar', p.situacao = 'coletando' and p.prazo >= current_date and v_eu is not null
                       and (interno.associado_apto(v_eu) or interno.do_conselho_diretor(v_eu)),
      'encontro_id', p.encontro_id
    ) order by p.criado_em desc)
    from public.pedidos_age p
    where p.arquivado_em is null
  ), '[]'::jsonb);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.pedidos_age, public.pedido_age_assinaturas from anon, authenticated;
grant select on public.pedidos_age, public.pedido_age_assinaturas to authenticated;
alter table public.pedidos_age enable row level security;
alter table public.pedido_age_assinaturas enable row level security;
create policy "pedidos de AGE: quem é do COMEP vê"
  on public.pedidos_age for select to authenticated using (arquivado_em is null and (select interno.sou_do_comep()));
create policy "assinaturas do pedido de AGE: quem é do COMEP vê (é um abaixo-assinado)"
  on public.pedido_age_assinaturas for select to authenticated using (arquivado_em is null and (select interno.sou_do_comep()));

create function public.criar_pedido_age(p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.criar_pedido_age(p_dados); $$;
create function public.assinar_pedido_age(p_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.assinar_pedido_age(p_id); $$;
create function public.retirar_assinatura_age(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.retirar_assinatura_age(p_id); $$;
create function public.cancelar_pedido_age(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.cancelar_pedido_age(p_id, p_motivo); $$;
create function public.marcar_age_do_pedido(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.marcar_age_do_pedido(p_id, p_dados); $$;
create function public.detalhe_pedido_age(p_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.detalhe_pedido_age(p_id); $$;
create function public.listar_pedidos_age()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.listar_pedidos_age(); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'associado_apto(uuid)', 'do_conselho_diretor(uuid)', 'conta_pedido_age(uuid)', 'conferir_meta_pedido_age(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', f);
  end loop;
  foreach f in array array[
    'criar_pedido_age(jsonb)', 'assinar_pedido_age(uuid)', 'retirar_assinatura_age(uuid)', 'cancelar_pedido_age(uuid, text)',
    'marcar_age_do_pedido(uuid, jsonb)', 'detalhe_pedido_age(uuid)', 'listar_pedidos_age()'
  ] loop
    execute format('revoke all on function interno.%s from public', f);
    execute format('grant execute on function interno.%s to authenticated', f);
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
