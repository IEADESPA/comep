-- =====================================================================
-- FASE 1.3 — PORTAL DO MINISTRO
--
-- * Meu perfil: a pessoa troca a própria foto (só da própria pasta).
-- * Pedido de troca de igreja feito pelo próprio ministro, decidido pela
--   secretaria ou pela presidência.
-- * Presidente de igreja (decisão 12 — previsão: mantido): vê os ministros
--   da sua igreja (só o necessário) e atualiza o contato da igreja.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Foto da pessoa: só um arquivo da própria pasta do Storage
-- ---------------------------------------------------------------------
create function interno.validar_foto_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_pasta text := 'pessoas/' || new.id || '/';
begin
  if new.foto_caminho is not null and left(new.foto_caminho, length(v_pasta)) <> v_pasta then
    raise exception 'A foto precisa ser um arquivo da pasta da própria pessoa.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger validar_foto_pessoa
  before insert or update of foto_caminho on public.pessoas
  for each row execute function interno.validar_foto_pessoa();


-- ---------------------------------------------------------------------
-- 2. Presidente de igreja: as igrejas que eu presido (associado ativo,
--    marcado como pastor presidente no vínculo atual)
-- ---------------------------------------------------------------------
create function interno.igrejas_que_presido()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.igreja_id
  from public.vinculos_igreja v
  join public.associados a
    on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  where v.pessoa_id = (select interno.minha_pessoa_id())
    and v.pastor_presidente
    and v.fim is null
    and v.arquivado_em is null;
$$;

-- O pastor presidente atualiza o contato da própria igreja
create policy "igrejas: o pastor presidente atualiza a própria igreja"
  on public.igrejas for update to authenticated
  using (id in (select interno.igrejas_que_presido()))
  with check (id in (select interno.igrejas_que_presido()));

-- ...mas só endereço, bairro e telefone. Nome, CNPJ, denominação e arquivamento são da secretaria.
create function interno.proteger_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Manutenção pelo dono do banco (sem login) e secretaria/presidência: sem restrição
  if (select auth.uid()) is null or (select interno.tenho_perfil('secretaria', 'presidencia')) then
    return new;
  end if;
  if new.nome is distinct from old.nome
     or new.denominacao_id is distinct from old.denominacao_id
     or new.cnpj is distinct from old.cnpj
     or new.presidente_nome is distinct from old.presidente_nome
     or new.arquivado_em is distinct from old.arquivado_em then
    raise exception 'O pastor presidente atualiza só o endereço, o bairro e o telefone da igreja. O resto é com a secretaria.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_igreja
  before update on public.igrejas
  for each row execute function interno.proteger_igreja();

-- Ministros da minha igreja: só nome, telefone, nº de registro, título e função
-- (não abre o cadastro completo dessas pessoas para o presidente de igreja)
create function interno.ministros_da_minha_igreja()
returns table (
  pessoa_id         uuid,
  nome              text,
  telefone          text,
  numero_registro   integer,
  titulo            text,
  funcao            text,
  pastor_presidente boolean,
  igreja_id         uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.pessoa_id, p.nome, p.telefone, a.numero_registro, tm.nome, v.funcao, v.pastor_presidente, v.igreja_id
  from public.vinculos_igreja v
  join public.associados a
    on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  join public.pessoas p on p.id = v.pessoa_id
  left join lateral (
    select tp.titulo_id
    from public.titulos_pessoa tp
    where tp.pessoa_id = v.pessoa_id and tp.arquivado_em is null
    order by tp.criado_em desc
    limit 1
  ) t on true
  left join public.titulos_ministeriais tm on tm.id = t.titulo_id
  where v.fim is null
    and v.arquivado_em is null
    and v.igreja_id in (select interno.igrejas_que_presido())
  order by v.pastor_presidente desc, p.nome;
$$;

create function public.ministros_da_minha_igreja()
returns table (
  pessoa_id         uuid,
  nome              text,
  telefone          text,
  numero_registro   integer,
  titulo            text,
  funcao            text,
  pastor_presidente boolean,
  igreja_id         uuid
)
language sql
security invoker
set search_path = ''
as $$ select * from interno.ministros_da_minha_igreja(); $$;


-- ---------------------------------------------------------------------
-- 3. Pedido de troca de igreja (feito pelo próprio ministro)
-- ---------------------------------------------------------------------
create type public.situacao_troca as enum ('pendente', 'aprovado', 'recusado', 'cancelado');

create table public.pedidos_troca_igreja (
  id                uuid primary key default gen_random_uuid(),
  pessoa_id         uuid not null references public.pessoas (id),
  igreja_id         uuid references public.igrejas (id),
  igreja_informada  text,
  funcao            text,
  pastor_presidente boolean not null default false,
  a_partir_de       date,
  observacao        text,
  situacao          public.situacao_troca not null default 'pendente',
  motivo_recusa     text,
  decidido_por      uuid references public.pessoas (id),
  decidido_em       timestamptz,
  arquivado_em      timestamptz,
  criado_por        uuid default auth.uid(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
comment on table public.pedidos_troca_igreja is 'Pedidos de troca de igreja feitos pelo ministro e decididos pela secretaria/presidência. Nunca apagar.';

create unique index pedidos_troca_igreja_um_pendente
  on public.pedidos_troca_igreja (pessoa_id) where situacao = 'pendente' and arquivado_em is null;
create index pedidos_troca_igreja_igreja on public.pedidos_troca_igreja (igreja_id);
create index pedidos_troca_igreja_decidido on public.pedidos_troca_igreja (decidido_por);
create index pedidos_troca_igreja_situacao on public.pedidos_troca_igreja (situacao);
select interno.aplicar_padroes('public.pedidos_troca_igreja');

create function interno.regras_troca_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_eu        uuid := (select interno.minha_pessoa_id());
begin
  if tg_op = 'INSERT' then
    new.situacao := 'pendente';
    new.motivo_recusa := null;
    new.decidido_por := null;
    new.decidido_em := null;
    if new.igreja_id is null and coalesce(trim(new.igreja_informada), '') = '' then
      raise exception 'Escolha a igreja nova (ou escreva o nome dela, se não estiver na lista).' using errcode = 'P0001';
    end if;
    if new.igreja_id is not null and exists (
      select 1 from public.vinculos_igreja
      where pessoa_id = new.pessoa_id and igreja_id = new.igreja_id and fim is null and arquivado_em is null
    ) then
      raise exception 'Você já está nesta igreja.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'O pedido não pode mudar de pessoa.' using errcode = 'P0001';
  end if;
  if old.situacao <> 'pendente' then
    raise exception 'Este pedido já foi decidido e não pode mais ser alterado.' using errcode = 'P0001';
  end if;
  if not v_diretoria and (
       new.motivo_recusa is distinct from old.motivo_recusa
    or new.situacao in ('aprovado', 'recusado')
  ) then
    raise exception 'Só a secretaria ou a presidência decidem o pedido de troca.' using errcode = '42501';
  end if;

  if new.situacao is distinct from old.situacao then
    if new.situacao = 'cancelado' and new.pessoa_id = v_eu then
      null;
    elsif new.situacao = 'recusado' and v_diretoria then
      if coalesce(trim(new.motivo_recusa), '') = '' then
        raise exception 'Informe o motivo da recusa.' using errcode = 'P0001';
      end if;
    elsif new.situacao = 'aprovado' and v_diretoria then
      if new.igreja_id is null then
        raise exception 'Escolha a igreja cadastrada antes de aprovar.' using errcode = 'P0001';
      end if;
    else
      raise exception 'Mudança de situação não permitida (de % para %).', old.situacao, new.situacao
        using errcode = 'P0001';
    end if;
    new.decidido_por := v_eu;
    new.decidido_em := now();
  end if;
  return new;
end;
$$;

create trigger regras_troca_igreja
  before insert or update on public.pedidos_troca_igreja
  for each row execute function interno.regras_troca_igreja();

-- Aprovação: registra a troca (encerra o vínculo atual e abre o novo) e fecha o pedido, tudo junto
create function public.aprovar_troca_igreja(p_pedido_id uuid, p_igreja_id uuid, p_data date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pedido public.pedidos_troca_igreja;
  v_igreja uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência aprovam a troca de igreja.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos_troca_igreja where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.situacao <> 'pendente' then
    raise exception 'Este pedido já foi decidido.' using errcode = 'P0001';
  end if;
  v_igreja := coalesce(p_igreja_id, v_pedido.igreja_id);
  if v_igreja is null then
    raise exception 'Escolha a igreja cadastrada antes de aprovar (cadastre a igreja, se preciso).' using errcode = 'P0001';
  end if;

  perform public.mudar_igreja(
    v_pedido.pessoa_id,
    v_igreja,
    v_pedido.funcao,
    coalesce(p_data, v_pedido.a_partir_de, current_date),
    v_pedido.pastor_presidente
  );

  update public.pedidos_troca_igreja
  set igreja_id = v_igreja, situacao = 'aprovado'
  where id = p_pedido_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Quem pode executar as funções
-- ---------------------------------------------------------------------
revoke all on function interno.validar_foto_pessoa() from public;
revoke all on function interno.igrejas_que_presido() from public;
revoke all on function interno.proteger_igreja() from public;
revoke all on function interno.ministros_da_minha_igreja() from public;
revoke all on function interno.regras_troca_igreja() from public;
grant execute on function interno.igrejas_que_presido() to authenticated;
grant execute on function interno.ministros_da_minha_igreja() to authenticated;

revoke all on function public.ministros_da_minha_igreja() from public, anon;
revoke all on function public.aprovar_troca_igreja(uuid, uuid, date) from public, anon;
grant execute on function public.ministros_da_minha_igreja() to authenticated;
grant execute on function public.aprovar_troca_igreja(uuid, uuid, date) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Permissões e regras de acesso (ninguém recebe DELETE)
-- ---------------------------------------------------------------------
revoke all on public.pedidos_troca_igreja from anon, authenticated;
grant select on public.pedidos_troca_igreja to authenticated;
grant insert (pessoa_id, igreja_id, igreja_informada, funcao, pastor_presidente, a_partir_de, observacao)
  on public.pedidos_troca_igreja to authenticated;
grant update (igreja_id, igreja_informada, funcao, pastor_presidente, a_partir_de, observacao, situacao, motivo_recusa)
  on public.pedidos_troca_igreja to authenticated;

alter table public.pedidos_troca_igreja enable row level security;

create policy "trocas: ver o próprio ou ser da secretaria/presidência"
  on public.pedidos_troca_igreja for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  );

create policy "trocas: o próprio associado ativo pede"
  on public.pedidos_troca_igreja for insert to authenticated
  with check (
    pessoa_id = (select interno.minha_pessoa_id())
    and exists (
      select 1 from public.associados a
      where a.pessoa_id = (select interno.minha_pessoa_id()) and a.arquivado_em is null and a.situacao = 'ativo'
    )
  );

create policy "trocas: o associado cancela; a secretaria/presidência decide"
  on public.pedidos_troca_igreja for update to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  )
  with check (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  );
