-- =====================================================================
-- FASE 5.4 — MURAL DE AVISOS E PAINEL DA PRESIDÊNCIA (respostas 34 a 36 de 14/11/2026)
--
--   * mural de avisos: só a secretaria publica (Art. 12, §5º — o secretário executivo tem o perfil); cada aviso
--     vale para todos com login e, se a secretaria escolher, também para o site; pode ter validade e ficar fixado;
--   * painel da presidência: associados, finanças, presença e agenda e projetos, num lugar só.
-- =====================================================================

create table public.avisos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(trim(titulo)) between 3 and 200),
  texto         text not null check (length(trim(texto)) between 3 and 5000),
  no_site       boolean not null default false,
  fixado        boolean not null default false,
  valido_ate    date,
  autor_id      uuid references public.pessoas (id),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.avisos is
  'Mural de avisos (14/11/2026): só a secretaria publica; a secretaria escolhe se o aviso vai também para o site.';
create index avisos_recentes on public.avisos (criado_em desc) where arquivado_em is null;
create index avisos_autor on public.avisos (autor_id);
select interno.aplicar_padroes('public.avisos');

create function interno.salvar_aviso(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_valido date;
begin
  if not (select interno.tenho_perfil('secretaria')) then
    raise exception 'Só a secretaria publica no mural (Art. 12, §5º).' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_valido := nullif(p_dados ->> 'valido_ate', '')::date;
  exception when others then
    raise exception 'Data inválida.' using errcode = 'P0001';
  end;
  if coalesce(length(trim(p_dados ->> 'titulo')), 0) < 3 or coalesce(length(trim(p_dados ->> 'texto')), 0) < 3 then
    raise exception 'Escreva o título e o texto do aviso.' using errcode = 'P0001';
  end if;
  if v_valido is not null and v_valido < current_date then
    raise exception 'A validade do aviso não pode ter passado.' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into public.avisos (titulo, texto, no_site, fixado, valido_ate, autor_id)
    values (trim(p_dados ->> 'titulo'), trim(p_dados ->> 'texto'), coalesce((p_dados ->> 'no_site')::boolean, false),
            coalesce((p_dados ->> 'fixado')::boolean, false), v_valido, (select interno.minha_pessoa_id()))
    returning id into v_id;
  else
    update public.avisos
    set titulo = trim(p_dados ->> 'titulo'), texto = trim(p_dados ->> 'texto'),
        no_site = coalesce((p_dados ->> 'no_site')::boolean, false), fixado = coalesce((p_dados ->> 'fixado')::boolean, false),
        valido_ate = v_valido
    where id = v_id and arquivado_em is null;
    if not found then
      raise exception 'Aviso não encontrado.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

create function interno.arquivar_aviso(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria')) then
    raise exception 'Só a secretaria tira avisos do mural.' using errcode = '42501';
  end if;
  update public.avisos set arquivado_em = now() where id = p_id and arquivado_em is null;
  if not found then
    raise exception 'Aviso não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

-- O site (sem login): os avisos que a secretaria mandou para o site e que ainda valem
create function interno.avisos_publicos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'texto', a.texto, 'criado_em', a.criado_em)
                            order by a.fixado desc, a.criado_em desc), '[]'::jsonb)
  from (
    select * from public.avisos
    where arquivado_em is null and no_site and (valido_ate is null or valido_ate >= current_date)
    order by fixado desc, criado_em desc
    limit 10
  ) a;
$$;


-- ---------------------------------------------------------------------
-- Painel da presidência (resposta 36)
-- ---------------------------------------------------------------------
create function interno.painel_presidencia()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_config public.config_assembleias;
  v_mes date := date_trunc('month', current_date)::date;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'O painel é da presidência.' using errcode = '42501';
  end if;
  select * into v_config from public.config_assembleias where id;
  return jsonb_build_object(
    'associados', (
      select jsonb_build_object(
        'ativos', count(*),
        'em_dia', count(*) filter (where interno.esta_em_dia(a.pessoa_id)),
        'jubilados', count(*) filter (where a.jubilado),
        'igrejas', (select count(*) from public.igrejas where arquivado_em is null),
        'pedidos', (select count(*) from public.pedidos_associacao p
                    where p.arquivado_em is null and p.situacao in ('enviado', 'pendencia', 'aguardando_assembleia'))
      )
      from public.associados a where a.arquivado_em is null and a.situacao = 'ativo'
    ),
    'financas', jsonb_build_object(
      'saldo', (
        select coalesce(sum(c.saldo_inicial), 0)
          + coalesce((select sum(case when l.tipo = 'entrada' then l.valor else -l.valor end)
                      from public.lancamentos l join public.contas_financeiras c2 on c2.id = l.conta_id
                      where l.arquivado_em is null and l.situacao = 'efetivado' and l.data >= c2.saldo_inicial_em
                        and c2.arquivado_em is null), 0)
        from public.contas_financeiras c where c.arquivado_em is null
      ),
      'entradas_mes', (select coalesce(sum(valor), 0) from public.lancamentos
                       where arquivado_em is null and situacao = 'efetivado' and tipo = 'entrada' and data >= v_mes),
      'saidas_mes', (select coalesce(sum(valor), 0) from public.lancamentos
                     where arquivado_em is null and situacao = 'efetivado' and tipo = 'saida' and data >= v_mes),
      'despesas_a_autorizar', (select count(*) from public.lancamentos
                               where arquivado_em is null and situacao = 'aguardando_autorizacao'),
      'contribuicoes_vencidas', (select coalesce(sum(c.valor), 0) from public.cobrancas c
                                 join public.associados a on a.pessoa_id = c.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
                                 where c.situacao = 'aberta' and c.arquivado_em is null and c.vencimento < current_date),
      'pagamentos_a_conferir', (select count(*) from public.informes_pagamento where situacao = 'pendente' and arquivado_em is null)
    ),
    'presenca', jsonb_build_object(
      'ultimos', coalesce((
        select jsonb_agg(x order by x.inicio desc) from (
          select e.id, e.titulo, e.tipo, e.inicio,
                 (select count(*) from public.encontro_presencas p
                  where p.encontro_id = e.id and p.presente_em is not null and p.arquivado_em is null) as presentes
          from public.encontros e
          where e.arquivado_em is null and e.situacao = 'realizado'
          order by e.inicio desc limit 5
        ) x
      ), '[]'::jsonb),
      'com_faltas', (select count(*) from public.associados a
                     where a.arquivado_em is null and a.situacao = 'ativo' and interno.faltas_seguidas(a.pessoa_id) >= v_config.faltas_aviso),
      'justificativas_pendentes', (select count(*) from public.justificativas_falta where situacao = 'pendente' and arquivado_em is null)
    ),
    'agenda', jsonb_build_object(
      'encontros', coalesce((
        select jsonb_agg(x order by x.inicio) from (
          select e.id, e.titulo, e.tipo, e.inicio, e.situacao
          from public.encontros e
          where e.arquivado_em is null and e.situacao in ('agendado', 'convocado') and e.inicio >= now()
          order by e.inicio limit 5
        ) x
      ), '[]'::jsonb),
      'eventos', coalesce((
        select jsonb_agg(x order by x.inicio) from (
          select ev.id, ev.titulo, ev.tipo, ev.inicio, ev.situacao,
                 (select count(*) from public.evento_inscricoes i where i.evento_id = ev.id and i.situacao <> 'cancelada') as inscritos,
                 ev.vagas, ev.orcamento, ev.orcamento_aprovado_em is not null as orcamento_aprovado
          from public.eventos ev
          where ev.arquivado_em is null and ev.situacao in ('rascunho', 'publicado') and coalesce(ev.fim, ev.inicio) >= now()
          order by ev.inicio limit 8
        ) x
      ), '[]'::jsonb),
      'comissoes', (select count(*) from public.comissoes c where c.arquivado_em is null and interno.comissao_ativa(c.id))
    )
  );
end;
$$;


-- ---------------------------------------------------------------------
-- Leitura (RLS) e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
alter table public.avisos enable row level security;
create policy "avisos: todos com login leem os que valem; a secretaria, todos"
  on public.avisos for select to authenticated
  using (
    arquivado_em is null
    and (valido_ate is null or valido_ate >= current_date or (select interno.tenho_perfil('secretaria')))
  );

create function public.salvar_aviso(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_aviso(p_id, p_dados); $$;
create function public.arquivar_aviso(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_aviso(p_id); $$;
create function public.avisos_publicos()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.avisos_publicos(); $$;
create function public.painel_presidencia()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.painel_presidencia(); $$;

do $$
declare
  v text;
begin
  foreach v in array array['salvar_aviso(uuid, jsonb)', 'arquivar_aviso(uuid)', 'painel_presidencia()'] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
  execute 'revoke all on function interno.avisos_publicos() from public';
  execute 'grant execute on function interno.avisos_publicos() to anon, authenticated';
  execute 'revoke all on function public.avisos_publicos() from public';
  execute 'grant execute on function public.avisos_publicos() to anon, authenticated';
end;
$$;
