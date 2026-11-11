-- =====================================================================
-- FASE 1.2 (parte 1) — CONFIGURAÇÕES, PRESIDENTE DE IGREJA E JUBILADO
--
-- * Sistema personalizável: listas (denominações, bairros, títulos) e
--   valores da contribuição mantidos pela própria diretoria, com histórico.
-- * Contribuição por categoria (diretoria, 11/11/2026):
--     presidente de igreja R$ 40/mês ou R$ 400/ano; não presidente R$ 20/mês
--     ou R$ 200/ano; jubilado isento.
-- * Previsão para a decisão 12 (11/11/2026): o pastor presidente da igreja
--   recebe o perfil "presidente de igreja" automaticamente, e é esse perfil
--   que define a categoria de contribuição "presidente de igreja".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Bairros (lista configurável) e ligação com as igrejas
-- ---------------------------------------------------------------------
create table public.bairros (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) > 0),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.bairros is 'Bairros de Parauapebas (lista configurável). Nunca apagar: arquivar.';
create unique index bairros_nome_unico on public.bairros (lower(trim(nome))) where arquivado_em is null;
select interno.aplicar_padroes('public.bairros');

alter table public.igrejas add column bairro_id uuid references public.bairros (id);
create index igrejas_bairro on public.igrejas (bairro_id);
comment on column public.igrejas.bairro is 'SUBSTITUÍDA por bairro_id (lista de bairros). Mantida só pelo histórico; não se edita mais.';

-- Os bairros digitados até agora viram itens da lista
insert into public.bairros (nome)
select distinct on (lower(trim(bairro))) trim(bairro)
from public.igrejas
where bairro is not null and trim(bairro) <> '';

update public.igrejas i
set bairro_id = b.id
from public.bairros b
where i.bairro is not null
  and lower(trim(i.bairro)) = lower(trim(b.nome))
  and b.arquivado_em is null;


-- ---------------------------------------------------------------------
-- 2. Valores da contribuição (configuráveis, com histórico de vigência)
-- ---------------------------------------------------------------------
create type public.categoria_contribuicao as enum ('presidente_igreja', 'nao_presidente', 'jubilado');
create type public.tipo_valor as enum ('mensal', 'anual', 'inscricao');

create table public.valores_contribuicao (
  id                     uuid primary key default gen_random_uuid(),
  categoria              public.categoria_contribuicao not null,
  tipo                   public.tipo_valor not null,
  valor                  numeric(10, 2) not null check (valor >= 0),
  vigente_desde          date not null,
  aprovado_em_assembleia date,
  ata                    text,
  observacao             text,
  arquivado_em           timestamptz,
  criado_por             uuid default auth.uid(),
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
comment on table public.valores_contribuicao is 'Valores da contribuição por categoria e tipo. Novo valor = nova linha com nova vigência (Art. 7º, §3º). Lançado por engano = arquivar.';
create unique index valores_contribuicao_unico
  on public.valores_contribuicao (categoria, tipo, vigente_desde) where arquivado_em is null;
select interno.aplicar_padroes('public.valores_contribuicao');

-- Valor em vigor hoje, para cada categoria e tipo
create view public.vw_valores_vigentes
with (security_invoker = true)
as
select distinct on (categoria, tipo)
  id, categoria, tipo, valor, vigente_desde, aprovado_em_assembleia, ata, observacao
from public.valores_contribuicao
where arquivado_em is null
  and vigente_desde <= current_date
order by categoria, tipo, vigente_desde desc, criado_em desc;

-- Valores informados pela diretoria em 11/11/2026 (vigência a partir do exercício atual, a confirmar).
-- A taxa de inscrição ainda não foi informada (PROJETO.md, pergunta 17).
insert into public.valores_contribuicao (categoria, tipo, valor, vigente_desde, observacao) values
  ('presidente_igreja', 'mensal',  40.00, '2026-04-01', 'Informado pela diretoria em 11/11/2026'),
  ('presidente_igreja', 'anual',  400.00, '2026-04-01', 'Informado pela diretoria em 11/11/2026 (pago em abril)'),
  ('nao_presidente',    'mensal',  20.00, '2026-04-01', 'Informado pela diretoria em 11/11/2026'),
  ('nao_presidente',    'anual',  200.00, '2026-04-01', 'Informado pela diretoria em 11/11/2026 (pago em abril)'),
  ('jubilado',          'mensal',   0.00, '2026-04-01', 'Jubilado é isento (diretoria, 11/11/2026)'),
  ('jubilado',          'anual',    0.00, '2026-04-01', 'Jubilado é isento (diretoria, 11/11/2026)');


-- ---------------------------------------------------------------------
-- 3. Jubilado e pastor presidente
-- ---------------------------------------------------------------------
alter table public.associados add column jubilado boolean not null default false;
comment on column public.associados.jubilado is 'Associado jubilado: isento da contribuição (diretoria, 11/11/2026).';

alter table public.vinculos_igreja add column pastor_presidente boolean not null default false;
comment on column public.vinculos_igreja.pastor_presidente is 'É o pastor presidente desta igreja. Dá o perfil "presidente de igreja" e a categoria de contribuição.';
create unique index vinculos_igreja_presidente_unico
  on public.vinculos_igreja (igreja_id) where pastor_presidente and fim is null and arquivado_em is null;


-- ---------------------------------------------------------------------
-- 4. Perfis automáticos: "ministro" (associado ativo) e
--    "presidente de igreja" (associado ativo que é pastor presidente)
-- ---------------------------------------------------------------------
create function interno.ajustar_perfil(p_pessoa_id uuid, p_perfil public.perfil_acesso, p_deve_ter boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_deve_ter then
    insert into public.perfis_acesso (pessoa_id, perfil)
    values (p_pessoa_id, p_perfil)
    on conflict (pessoa_id, perfil) where arquivado_em is null do nothing;
  else
    update public.perfis_acesso
    set arquivado_em = now()
    where pessoa_id = p_pessoa_id
      and perfil = p_perfil
      and arquivado_em is null;
  end if;
end;
$$;

create function interno.sincronizar_perfis_automaticos(p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ministro   boolean;
  v_presidente boolean;
begin
  v_ministro := exists (
    select 1 from public.associados a
    where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  );
  v_presidente := v_ministro and exists (
    select 1 from public.vinculos_igreja v
    where v.pessoa_id = p_pessoa_id and v.pastor_presidente and v.fim is null and v.arquivado_em is null
  );
  perform interno.ajustar_perfil(p_pessoa_id, 'ministro', v_ministro);
  perform interno.ajustar_perfil(p_pessoa_id, 'presidente_igreja', v_presidente);
end;
$$;

-- O gatilho dos associados (Fase 1.1) passa a usar a regra completa.
-- Cadastro arquivado (ou que deixou de estar ativo) libera a vaga de pastor presidente da igreja.
create or replace function interno.sincronizar_perfil_ministro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (new.arquivado_em is null and new.situacao = 'ativo') then
    update public.vinculos_igreja
    set pastor_presidente = false
    where pessoa_id = new.pessoa_id
      and pastor_presidente
      and fim is null
      and arquivado_em is null;
  end if;
  perform interno.sincronizar_perfis_automaticos(new.pessoa_id);
  return null;
end;
$$;

create function interno.sincronizar_perfis_por_vinculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.sincronizar_perfis_automaticos(new.pessoa_id);
  return null;
end;
$$;

create trigger sincronizar_perfis_por_vinculo
  after insert or update of pastor_presidente, fim, arquivado_em on public.vinculos_igreja
  for each row execute function interno.sincronizar_perfis_por_vinculo();

-- Perfis automáticos não impedem arquivar a pessoa sem login de um cadastro feito por engano
create or replace function interno.arquivar_pessoa_sem_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.arquivado_em is null and new.arquivado_em is not null then
    update public.pessoas p
    set arquivado_em = new.arquivado_em
    where p.id = new.pessoa_id
      and p.usuario_id is null
      and p.arquivado_em is null
      and not exists (
        select 1 from public.associados a
        where a.pessoa_id = p.id and a.arquivado_em is null and a.id <> new.id
      )
      and not exists (
        select 1 from public.perfis_acesso pa
        where pa.pessoa_id = p.id and pa.arquivado_em is null
          and pa.perfil not in ('ministro', 'presidente_igreja')
      );
  end if;
  return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Lista de associados com categoria de contribuição
--    (colunas novas no fim, para não mudar as que já existem)
-- ---------------------------------------------------------------------
create or replace view public.vw_associados
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
  v.funcao,
  a.jubilado,
  coalesce(v.pastor_presidente, false) as pastor_presidente,
  (case
     when a.jubilado then 'jubilado'
     when coalesce(v.pastor_presidente, false) then 'presidente_igreja'
     else 'nao_presidente'
   end)::public.categoria_contribuicao as categoria_contribuicao
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
  select vi.igreja_id, vi.funcao, vi.pastor_presidente
  from public.vinculos_igreja vi
  where vi.pessoa_id = a.pessoa_id
    and vi.fim is null
    and vi.arquivado_em is null
  limit 1
) v on true
left join public.igrejas i on i.id = v.igreja_id
where a.arquivado_em is null;


-- ---------------------------------------------------------------------
-- 6. Cadastro direto e troca de igreja passam a registrar o pastor presidente
--    (e o jubilado). As versões antigas saem: a assinatura mudou.
-- ---------------------------------------------------------------------
drop function public.cadastrar_associado(text, text, text, uuid, date, uuid, text, date, date, text);
drop function public.mudar_igreja(uuid, uuid, text, date);

create function public.cadastrar_associado(
  p_nome              text,
  p_email             text,
  p_telefone          text,
  p_titulo_id         uuid,
  p_titulo_desde      date,
  p_igreja_id         uuid,
  p_funcao            text,
  p_vinculo_inicio    date,
  p_admitido_em       date,
  p_observacoes       text,
  p_pastor_presidente boolean,
  p_jubilado          boolean
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

  insert into public.associados (pessoa_id, forma_admissao, admitido_em, observacoes, jubilado)
  values (v_pessoa_id, 'cadastro_inicial', p_admitido_em, nullif(trim(p_observacoes), ''), coalesce(p_jubilado, false));

  insert into public.titulos_pessoa (pessoa_id, titulo_id, desde)
  values (v_pessoa_id, p_titulo_id, p_titulo_desde);

  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, inicio, pastor_presidente)
  values (v_pessoa_id, p_igreja_id, nullif(trim(p_funcao), ''), p_vinculo_inicio, coalesce(p_pastor_presidente, false));

  return v_pessoa_id;
end;
$$;

create function public.mudar_igreja(
  p_pessoa_id         uuid,
  p_igreja_id         uuid,
  p_funcao            text,
  p_data              date,
  p_pastor_presidente boolean
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

  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, inicio, pastor_presidente)
  values (p_pessoa_id, p_igreja_id, nullif(trim(p_funcao), ''), v_data, coalesce(p_pastor_presidente, false));
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Quem pode executar as funções
-- ---------------------------------------------------------------------
revoke all on function interno.ajustar_perfil(uuid, public.perfil_acesso, boolean) from public;
revoke all on function interno.sincronizar_perfis_automaticos(uuid) from public;
revoke all on function interno.sincronizar_perfis_por_vinculo() from public;

revoke all on function public.cadastrar_associado(text, text, text, uuid, date, uuid, text, date, date, text, boolean, boolean) from public, anon;
revoke all on function public.mudar_igreja(uuid, uuid, text, date, boolean) from public, anon;
grant execute on function public.cadastrar_associado(text, text, text, uuid, date, uuid, text, date, date, text, boolean, boolean) to authenticated;
grant execute on function public.mudar_igreja(uuid, uuid, text, date, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- 8. Permissões das tabelas (ninguém recebe DELETE)
-- ---------------------------------------------------------------------
revoke all on public.bairros, public.valores_contribuicao, public.vw_valores_vigentes from anon, authenticated;

grant select on public.bairros to authenticated;
grant insert (nome) on public.bairros to authenticated;
grant update (nome, arquivado_em) on public.bairros to authenticated;

grant select on public.valores_contribuicao to authenticated;
grant insert (categoria, tipo, valor, vigente_desde, aprovado_em_assembleia, ata, observacao)
  on public.valores_contribuicao to authenticated;
grant update (arquivado_em) on public.valores_contribuicao to authenticated;
grant select on public.vw_valores_vigentes to authenticated;

-- Igrejas: o bairro passa a vir da lista; o campo de texto antigo não se edita mais
revoke insert (bairro), update (bairro) on public.igrejas from authenticated;
grant insert (bairro_id), update (bairro_id) on public.igrejas to authenticated;

grant insert (jubilado), update (jubilado) on public.associados to authenticated;
grant insert (pastor_presidente), update (pastor_presidente) on public.vinculos_igreja to authenticated;


-- ---------------------------------------------------------------------
-- 9. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.bairros              enable row level security;
alter table public.valores_contribuicao enable row level security;

-- Listas configuráveis: secretaria, presidência e administrador técnico mantêm
create policy "bairros: todos com login leem"
  on public.bairros for select to authenticated using (true);
create policy "bairros: secretaria, presidência e administrador cadastram"
  on public.bairros for insert to authenticated
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));
create policy "bairros: secretaria, presidência e administrador alteram"
  on public.bairros for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));

alter policy "denominações: secretaria e presidência cadastram" on public.denominacoes
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));
alter policy "denominações: secretaria e presidência cadastram" on public.denominacoes
  rename to "denominações: secretaria, presidência e administrador cadastram";
alter policy "denominações: secretaria e presidência alteram" on public.denominacoes
  using ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));
alter policy "denominações: secretaria e presidência alteram" on public.denominacoes
  rename to "denominações: secretaria, presidência e administrador alteram";

alter policy "títulos: secretaria e presidência cadastram" on public.titulos_ministeriais
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));
alter policy "títulos: secretaria e presidência cadastram" on public.titulos_ministeriais
  rename to "títulos: secretaria, presidência e administrador cadastram";
alter policy "títulos: secretaria e presidência alteram" on public.titulos_ministeriais
  using ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));
alter policy "títulos: secretaria e presidência alteram" on public.titulos_ministeriais
  rename to "títulos: secretaria, presidência e administrador alteram";

-- Valores da contribuição: todos com login veem; tesouraria e presidência lançam
create policy "valores: todos com login leem"
  on public.valores_contribuicao for select to authenticated using (true);
create policy "valores: tesouraria e presidência lançam"
  on public.valores_contribuicao for insert to authenticated
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));
create policy "valores: tesouraria e presidência arquivam"
  on public.valores_contribuicao for update to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia')))
  with check ((select interno.tenho_perfil('tesouraria', 'presidencia')));
