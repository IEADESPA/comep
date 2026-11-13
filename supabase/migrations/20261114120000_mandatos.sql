-- =====================================================================
-- Fase 4.4 — Diretoria e Conselho Fiscal: mandatos e perfis automáticos pelo cargo
-- (PROJETO.md, seções 3 e 4.10; Estatuto, Art. 11, 12 e 14)
--
--   * o Conselho Diretor (Art. 12): presidente, vice-presidente, 1º e 2º secretários, 1º e 2º tesoureiros e
--     secretário executivo; o Conselho Fiscal: 3 membros (diretoria, 11/11/2026). Mandato de 4 anos;
--   * a presidência registra a diretoria eleita (a assembleia que elegeu, o início e o fim). Só associados
--     ativos e EM DIA podem ser votados (Art. 11). Uma pessoa por cargo de cada vez (3 no Conselho Fiscal);
--     ninguém acumula dois cargos, nem diretoria e Conselho Fiscal (o Conselho fiscaliza a diretoria);
--   * PERFIS AUTOMÁTICOS: enquanto o mandato vale (e a pessoa é associada ativa), o cargo dá o perfil:
--       presidente e vice → Presidência; 1º e 2º secretários → Secretaria; 1º e 2º tesoureiros → Tesouraria;
--       conselheiros → Conselho Fiscal. O secretário executivo fica registrado (perfil próprio fica para depois).
--     Na posse o acesso começa sozinho e, no fim do mandato, termina sozinho. Os perfis dados à mão
--     (Perfis de acesso) continuam valendo como antes;
--   * mandato que acaba antes (renúncia, desligamento, falecimento): "encerrar", com motivo. Nada se apaga.
-- =====================================================================

create type public.cargo as enum (
  'presidente', 'vice_presidente', 'primeiro_secretario', 'segundo_secretario',
  'primeiro_tesoureiro', 'segundo_tesoureiro', 'secretario_executivo', 'conselheiro_fiscal'
);

create table public.mandatos (
  id                   uuid primary key default gen_random_uuid(),
  pessoa_id            uuid not null references public.pessoas (id),
  cargo                public.cargo not null,
  inicio               date not null,
  fim                  date not null,
  encontro_id          uuid references public.encontros (id),
  encerrado_em         date,
  motivo_encerramento  text,
  arquivado_em         timestamptz,
  criado_por           uuid default auth.uid(),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  constraint mandatos_periodo check (fim > inicio),
  constraint mandatos_encerramento check ((encerrado_em is null) = (motivo_encerramento is null)),
  constraint mandatos_encerrado_no_periodo check (encerrado_em is null or (encerrado_em > inicio and encerrado_em <= fim))
);
comment on table public.mandatos is 'Cargos do Conselho Diretor e do Conselho Fiscal (Art. 12 e 14). O cargo dá o perfil enquanto o mandato vale.';
comment on column public.mandatos.encerrado_em is 'Mandato que acabou antes (renúncia, desligamento, falecimento): a partir deste dia não vale mais.';
create index mandatos_pessoa on public.mandatos (pessoa_id);
select interno.aplicar_padroes('public.mandatos');

-- O perfil que cada cargo dá
create function interno.perfil_do_cargo(p_cargo public.cargo)
returns public.perfil_acesso
language sql
immutable
set search_path = ''
as $$
  select case p_cargo
    when 'presidente' then 'presidencia'
    when 'vice_presidente' then 'presidencia'
    when 'primeiro_secretario' then 'secretaria'
    when 'segundo_secretario' then 'secretaria'
    when 'primeiro_tesoureiro' then 'tesouraria'
    when 'segundo_tesoureiro' then 'tesouraria'
    when 'conselheiro_fiscal' then 'conselho_fiscal'
  end::public.perfil_acesso;
$$;

-- Último dia em que o mandato vale
create function interno.fim_efetivo(p_mandato public.mandatos)
returns date
language sql
immutable
set search_path = ''
as $$ select coalesce(p_mandato.encerrado_em - 1, p_mandato.fim); $$;

-- Regras ao registrar: um por cargo (3 no Conselho Fiscal), sem acumular, só associado ativo
create function interno.validar_mandato()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fim date := interno.fim_efetivo(new);
  v_ocupados integer;
  v_vagas integer := case when new.cargo = 'conselheiro_fiscal' then 3 else 1 end;
begin
  if new.arquivado_em is not null then
    return new;
  end if;
  if tg_op = 'INSERT' and not exists (
    select 1 from public.associados a where a.pessoa_id = new.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  ) then
    raise exception 'Só associado ativo assume cargo.' using errcode = 'P0001';
  end if;
  -- o Conselho Fiscal fiscaliza a diretoria: também contra os perfis dados à mão
  if tg_op = 'INSERT' and exists (
    select 1 from public.perfis_acesso pa
    where pa.pessoa_id = new.pessoa_id and pa.arquivado_em is null
      and ((new.cargo = 'conselheiro_fiscal' and pa.perfil in ('secretaria', 'tesouraria', 'presidencia'))
        or (new.cargo <> 'conselheiro_fiscal' and pa.perfil = 'conselho_fiscal'))
  ) then
    raise exception 'O Conselho Fiscal fiscaliza a diretoria: a pessoa já tem perfil do outro lado (Perfis de acesso).' using errcode = 'P0001';
  end if;
  select count(*) into v_ocupados from public.mandatos m
  where m.cargo = new.cargo and m.id <> new.id and m.arquivado_em is null
    and m.inicio <= v_fim and interno.fim_efetivo(m) >= new.inicio;
  if v_ocupados >= v_vagas then
    if v_vagas = 3 then
      raise exception 'O Conselho Fiscal já tem 3 membros nesse período.' using errcode = 'P0001';
    end if;
    raise exception 'O cargo já está ocupado nesse período.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.mandatos m
    where m.pessoa_id = new.pessoa_id and m.id <> new.id and m.arquivado_em is null
      and m.inicio <= v_fim and interno.fim_efetivo(m) >= new.inicio
  ) then
    raise exception 'A mesma pessoa não acumula dois cargos (nem diretoria e Conselho Fiscal) no mesmo período.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger validar_mandato before insert or update on public.mandatos for each row execute function interno.validar_mandato();


-- E o contrário: perfil dado à mão não pode cruzar com um mandato do outro lado
create or replace function interno.validar_concessao_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and new.pessoa_id = (select interno.minha_pessoa_id()) then
    raise exception 'Ninguém concede perfil a si mesmo: outra pessoa da presidência precisa fazer isso.' using errcode = '42501';
  end if;
  if (select auth.uid()) is not null
     and new.perfil in ('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal')
     and not exists (
       select 1 from public.associados a
       where a.pessoa_id = new.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
     ) then
    raise exception 'Os perfis da diretoria e do Conselho Fiscal só podem ser dados a associados ativos. Confira se é a pessoa certa: um login criado pelo site ainda não foi conferido.'
      using errcode = 'P0001';
  end if;
  if (new.perfil = 'conselho_fiscal' and (
        exists (select 1 from public.perfis_acesso pa
                where pa.pessoa_id = new.pessoa_id and pa.arquivado_em is null and pa.perfil in ('secretaria', 'tesouraria', 'presidencia'))
        or exists (select 1 from public.mandatos m
                   where m.pessoa_id = new.pessoa_id and m.arquivado_em is null and m.cargo <> 'conselheiro_fiscal'
                     and current_date <= interno.fim_efetivo(m))
      ))
     or (new.perfil in ('secretaria', 'tesouraria', 'presidencia') and (
        exists (select 1 from public.perfis_acesso pa
                where pa.pessoa_id = new.pessoa_id and pa.arquivado_em is null and pa.perfil = 'conselho_fiscal')
        or exists (select 1 from public.mandatos m
                   where m.pessoa_id = new.pessoa_id and m.arquivado_em is null and m.cargo = 'conselheiro_fiscal'
                     and current_date <= interno.fim_efetivo(m))
      )) then
    raise exception 'O Conselho Fiscal fiscaliza a diretoria: a mesma pessoa não pode ter perfil da diretoria (presidência, secretaria ou tesouraria) e do Conselho Fiscal.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- Perfis: além dos dados à mão, os do mandato em vigor (o acesso começa e termina sozinho)
-- ---------------------------------------------------------------------
create or replace function interno.tenho_perfil(variadic p_perfis public.perfil_acesso[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis_acesso pa
    join public.pessoas p on p.id = pa.pessoa_id
    where p.usuario_id = (select auth.uid())
      and p.arquivado_em is null
      and pa.arquivado_em is null
      and pa.perfil = any (p_perfis)
  ) or exists (
    select 1
    from public.mandatos m
    join public.pessoas p on p.id = m.pessoa_id
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where p.usuario_id = (select auth.uid())
      and p.arquivado_em is null
      and m.arquivado_em is null
      and current_date between m.inicio and interno.fim_efetivo(m)
      and interno.perfil_do_cargo(m.cargo) = any (p_perfis)
  );
$$;

-- Os perfis de quem está logado (os dados à mão e os do mandato), para o menu
create function interno.meus_perfis()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.perfil::text order by x.perfil::text), '{}')
  from (
    select pa.perfil
    from public.perfis_acesso pa
    join public.pessoas p on p.id = pa.pessoa_id
    where p.usuario_id = (select auth.uid()) and p.arquivado_em is null and pa.arquivado_em is null
    union
    select interno.perfil_do_cargo(m.cargo)
    from public.mandatos m
    join public.pessoas p on p.id = m.pessoa_id
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where p.usuario_id = (select auth.uid()) and p.arquivado_em is null and m.arquivado_em is null
      and current_date between m.inicio and interno.fim_efetivo(m)
      and interno.perfil_do_cargo(m.cargo) is not null
  ) x;
$$;


-- ---------------------------------------------------------------------
-- Registrar a diretoria eleita (presidência) e encerrar um mandato
-- ---------------------------------------------------------------------
create function interno.registrar_diretoria(p_dados jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio date;
  v_fim date;
  v_encontro uuid;
  v_membro jsonb;
  v_pessoa uuid;
  v_cargo public.cargo;
  v_quantos integer := 0;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Só a presidência registra a diretoria eleita.' using errcode = '42501';
  end if;
  begin
    v_inicio := (p_dados ->> 'inicio')::date;
    v_fim := (p_dados ->> 'fim')::date;
    v_encontro := nullif(p_dados ->> 'encontro_id', '')::uuid;
  exception when others then
    raise exception 'Datas ou assembleia inválidas.' using errcode = 'P0001';
  end;
  if v_inicio is null or v_fim is null or v_fim <= v_inicio then
    raise exception 'Informe o início e o fim do mandato.' using errcode = 'P0001';
  end if;
  if v_encontro is not null and not exists (
    select 1 from public.encontros where id = v_encontro and tipo in ('ago', 'age') and situacao in ('convocado', 'realizado') and arquivado_em is null
  ) then
    raise exception 'A assembleia que elegeu precisa ser uma AGO ou AGE convocada ou realizada.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_dados -> 'membros') <> 'array' or jsonb_array_length(p_dados -> 'membros') = 0 then
    raise exception 'Informe quem foi eleito para cada cargo.' using errcode = 'P0001';
  end if;
  for v_membro in select * from jsonb_array_elements(p_dados -> 'membros') loop
    begin
      v_pessoa := (v_membro ->> 'pessoa_id')::uuid;
      v_cargo := (v_membro ->> 'cargo')::public.cargo;
    exception when others then
      raise exception 'Cargo ou pessoa inválidos.' using errcode = 'P0001';
    end;
    -- só quem está em dia pode ser votado (Art. 11)
    if not interno.esta_em_dia(v_pessoa) then
      raise exception '% está com a contribuição em atraso: não pode ser votado (Art. 11).',
        (select nome from public.pessoas where id = v_pessoa) using errcode = 'P0001';
    end if;
    insert into public.mandatos (pessoa_id, cargo, inicio, fim, encontro_id) values (v_pessoa, v_cargo, v_inicio, v_fim, v_encontro);
    v_quantos := v_quantos + 1;
  end loop;
  return v_quantos;
end;
$$;

create function interno.encerrar_mandato(p_id uuid, p_data date, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mandato public.mandatos;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Só a presidência encerra um mandato.' using errcode = '42501';
  end if;
  select * into v_mandato from public.mandatos where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Mandato não encontrado.' using errcode = 'P0001';
  end if;
  if v_mandato.encerrado_em is not null then
    raise exception 'Este mandato já foi encerrado.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo (ex.: renúncia).' using errcode = 'P0001';
  end if;
  if p_data is null or p_data <= v_mandato.inicio or p_data > v_mandato.fim then
    raise exception 'A data precisa estar dentro do mandato.' using errcode = 'P0001';
  end if;
  update public.mandatos set encerrado_em = p_data, motivo_encerramento = trim(p_motivo) where id = p_id;
end;
$$;

-- Quem é (ou foi) de cada cargo: para todos com login (é informação do Conselho)
create view public.vw_mandatos
with (security_invoker = true)
as
select
  m.id,
  m.pessoa_id,
  p.nome,
  m.cargo,
  case when m.cargo = 'conselheiro_fiscal' then 'conselho_fiscal' else 'conselho_diretor' end as orgao,
  m.inicio,
  m.fim,
  m.encerrado_em,
  m.motivo_encerramento,
  m.encontro_id,
  e.titulo as encontro_titulo,
  (current_date between m.inicio and interno.fim_efetivo(m)) as vigente
from public.mandatos m
join public.pessoas p on p.id = m.pessoa_id
left join public.encontros e on e.id = m.encontro_id
where m.arquivado_em is null;


-- ---------------------------------------------------------------------
-- Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.meus_perfis()
returns text[] language sql stable security invoker set search_path = '' as $$ select interno.meus_perfis(); $$;
create function public.registrar_diretoria(p_dados jsonb)
returns integer language sql security invoker set search_path = '' as $$ select interno.registrar_diretoria(p_dados); $$;
create function public.encerrar_mandato(p_id uuid, p_data date, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.encerrar_mandato(p_id, p_data, p_motivo); $$;

revoke all on function interno.perfil_do_cargo(public.cargo) from public;
revoke all on function interno.fim_efetivo(public.mandatos) from public;
revoke all on function interno.validar_mandato() from public;
revoke all on function interno.meus_perfis() from public;
revoke all on function interno.registrar_diretoria(jsonb) from public;
revoke all on function interno.encerrar_mandato(uuid, date, text) from public;
grant execute on function interno.perfil_do_cargo(public.cargo) to authenticated;
grant execute on function interno.fim_efetivo(public.mandatos) to authenticated;
grant execute on function interno.meus_perfis() to authenticated;
grant execute on function interno.registrar_diretoria(jsonb) to authenticated;
grant execute on function interno.encerrar_mandato(uuid, date, text) to authenticated;

revoke all on function public.meus_perfis() from public, anon;
revoke all on function public.registrar_diretoria(jsonb) from public, anon;
revoke all on function public.encerrar_mandato(uuid, date, text) from public, anon;
grant execute on function public.meus_perfis() to authenticated;
grant execute on function public.registrar_diretoria(jsonb) to authenticated;
grant execute on function public.encerrar_mandato(uuid, date, text) to authenticated;

revoke all on public.mandatos from anon, authenticated;
grant select on public.mandatos to authenticated;
revoke all on public.vw_mandatos from anon, authenticated;
grant select on public.vw_mandatos to authenticated;
alter table public.mandatos enable row level security;
create policy "mandatos: todos com login veem a diretoria e o Conselho Fiscal"
  on public.mandatos for select to authenticated using (true);
