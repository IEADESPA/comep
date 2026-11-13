-- =====================================================================
-- Revisão geral da Fase 4 (13/11/2026) — correções dos achados (docs/revisoes/fase-4.md)
--
--   1. Contas de quem tem cargo pelo mandato: só a presidência gera o código de acesso (antes, a
--      secretaria podia gerar um código de nova senha para o presidente e assumir a conta);
--   2. assinar a ata: a assinatura vazia (NULL) virava a do presidente — agora é recusada; a ata guarda o
--      cargo de quem assinou;
--   3. diretoria: ninguém se põe num cargo que lhe dá poder novo; depois do primeiro registro, a diretoria
--      eleita precisa de uma assembleia instalada; mandato de no máximo 4 anos (Art. 12); tirar alguém do
--      cargo de presidente ou do Conselho Fiscal (que não seja ele mesmo, renunciando) pede a assembleia;
--   4. desligado ou falecido perde os perfis da diretoria (também os dados à mão) e os mandatos acabam;
--   5. a secretaria não desfaz desligamento (readmissão só pela assembleia), não arquiva associado com
--      cargo, desligado ou falecido, e não registra o falecimento de quem tem cargo (só a presidência);
--   6. perfil arquivado não volta a valer por "desarquivar" (as regras de concessão não eram conferidas);
--   7. arquivos das atas: só a secretaria e a presidência, ou o associado ativo depois de a ata ser assinada;
--      o resultado das votações e a ata assinada: associados ativos (antes, qualquer login);
--   8. assembleia instalada não se cancela; votações travam na primeira assinatura da ata; a lista de
--      presença de uma assembleia só se encerra depois de instalada; instalar só no dia (lista aberta);
--   9. desligamento: o associado é indicado no item da pauta, já na convocação; inciso IV confere as faltas;
--  10. mandato registrado por engano pode ser encerrado no dia do início (não chega a valer);
--  11. regras das assembleias: só a presidência muda; a 2ª chamada fica guardada na convocação;
--  12. faltas contam só depois de o associado entrar no sistema; quórum e contagem só para a diretoria;
--      rascunho cancelado sem convocação não aparece para os associados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------
-- Desligado ou falecido (não é cadastro por engano: esse se arquiva)
create function interno.saiu_do_comep(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.associados a
    where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao in ('desligado', 'falecido')
  );
$$;

-- Tem (ou terá) poder de direção: perfil da diretoria/Conselho Fiscal dado à mão, ou cargo que dá perfil
create function interno.tem_poder_de_direcao(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis_acesso pa
    where pa.pessoa_id = p_pessoa_id and pa.arquivado_em is null
      and pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'admin_tecnico', 'conselho_fiscal')
  ) or exists (
    select 1 from public.mandatos m
    where m.pessoa_id = p_pessoa_id and m.arquivado_em is null and m.cargo <> 'secretario_executivo'
      and interno.fim_efetivo(m) >= current_date
  );
$$;


-- ---------------------------------------------------------------------
-- 1. Código de acesso: quem tem cargo (ou perfil da diretoria) só pela presidência
-- ---------------------------------------------------------------------
create or replace function interno.gerar_codigo_acesso(p_pessoa_id uuid, p_finalidade public.finalidade_codigo)
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

  if interno.tem_poder_de_direcao(p_pessoa_id) and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Esta pessoa tem cargo ou perfil da diretoria ou do Conselho Fiscal: só a presidência gera o código de acesso dela.'
      using errcode = '42501';
  end if;

  if p_finalidade = 'primeiro_acesso' and v_usuario is not null then
    raise exception 'Esta pessoa já tem login. Para trocar a senha, gere um código de nova senha.' using errcode = 'P0001';
  end if;
  if p_finalidade = 'nova_senha' and v_usuario is null then
    raise exception 'Esta pessoa ainda não tem login. Gere um código de primeiro acesso.' using errcode = 'P0001';
  end if;

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

-- Pessoa sem login com cargo não é arquivada junto com um cadastro de associado
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
      and not interno.tem_poder_de_direcao(p.id);
  end if;
  return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 4 e 6. Perfis: desligado/falecido não tem perfil da diretoria; perfil arquivado não volta
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
      -- quem saiu do COMEP perde os perfis da diretoria e do Conselho Fiscal (o de ministro sai pelo gatilho)
      and not (pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal') and interno.saiu_do_comep(p.id))
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

create or replace function interno.meus_perfis()
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
      and not (pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal') and interno.saiu_do_comep(p.id))
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

-- O último perfil de Presidência: só conta quem ainda pode usá-lo (não saiu do COMEP); um presidente ou vice
-- em exercício pelo mandato também serve
create or replace function interno.proteger_ultima_presidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.perfil = 'presidencia' and old.arquivado_em is null and new.arquivado_em is not null then
    if not exists (
      select 1
      from public.perfis_acesso pa
      join public.pessoas p on p.id = pa.pessoa_id
      where pa.perfil = 'presidencia' and pa.arquivado_em is null and p.arquivado_em is null and pa.id <> old.id
        and not interno.saiu_do_comep(p.id)
    ) and not exists (
      select 1 from public.mandatos m
      join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where m.arquivado_em is null and m.cargo in ('presidente', 'vice_presidente')
        and current_date between m.inicio and interno.fim_efetivo(m)
    ) then
      raise exception 'Não é possível retirar o último perfil de Presidência: ninguém mais poderia conceder acessos.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Perfil arquivado não volta: para dar de novo, concede-se outro (e as regras de concessão são conferidas)
create function interno.proibir_desarquivar_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.arquivado_em is not null and new.arquivado_em is null then
    raise exception 'Perfil retirado não volta a valer: conceda o perfil de novo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger proibir_desarquivar_perfil before update on public.perfis_acesso
  for each row execute function interno.proibir_desarquivar_perfil();


-- ---------------------------------------------------------------------
-- 3 e 10. Mandatos: sem autopromoção, assembleia que elegeu, 4 anos, encerrar
-- ---------------------------------------------------------------------
alter table public.mandatos drop constraint mandatos_encerrado_no_periodo;
alter table public.mandatos add constraint mandatos_encerrado_no_periodo
  check (encerrado_em is null or (encerrado_em >= inicio and encerrado_em <= fim));
alter table public.mandatos add constraint mandatos_quatro_anos check (fim <= inicio + interval '4 years');
alter table public.mandatos add column documento text check (documento is null or length(documento) <= 500);
comment on column public.mandatos.documento is 'Primeiro registro (diretoria eleita antes do sistema): a ata ou o documento que comprova a eleição.';

create or replace function interno.validar_mandato()
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
  -- registros ao mesmo tempo não passam juntos pela conferência das vagas
  perform pg_advisory_xact_lock(hashtext('comep: mandatos'));
  if tg_op = 'INSERT' and not exists (
    select 1 from public.associados a where a.pessoa_id = new.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  ) then
    raise exception 'Só associado ativo assume cargo.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.perfis_acesso pa
    where pa.pessoa_id = new.pessoa_id and pa.arquivado_em is null
      and ((new.cargo = 'conselheiro_fiscal' and pa.perfil in ('secretaria', 'tesouraria', 'presidencia'))
        or (new.cargo <> 'conselheiro_fiscal' and pa.perfil = 'conselho_fiscal'))
  ) then
    raise exception 'O Conselho Fiscal fiscaliza a diretoria: a pessoa já tem perfil do outro lado (Perfis de acesso).' using errcode = 'P0001';
  end if;
  if v_fim < new.inicio then
    return new; -- encerrado antes de começar (registro por engano): não ocupa a vaga
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

create or replace function interno.registrar_diretoria(p_dados jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_inicio date;
  v_fim date;
  v_encontro uuid;
  v_documento text := nullif(trim(p_dados ->> 'documento'), '');
  v_assembleia public.encontros;
  v_primeiro boolean;
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
  if v_fim > v_inicio + interval '4 years' then
    raise exception 'O mandato é de no máximo 4 anos (Art. 12).' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('comep: mandatos'));
  v_primeiro := not exists (select 1 from public.mandatos where arquivado_em is null);
  if v_encontro is not null then
    select * into v_assembleia from public.encontros where id = v_encontro and arquivado_em is null;
    if not found or v_assembleia.tipo not in ('ago', 'age') or v_assembleia.instalada_em is null
       or (v_assembleia.inicio at time zone 'America/Belem')::date > v_inicio then
      raise exception 'A assembleia que elegeu precisa ser uma AGO ou AGE instalada, antes da posse.' using errcode = 'P0001';
    end if;
  elsif not v_primeiro then
    raise exception 'Informe a assembleia que elegeu (instalada no sistema).' using errcode = 'P0001';
  elsif v_documento is null then
    raise exception 'Primeiro registro (diretoria eleita antes do sistema): informe a ata ou o documento da eleição.' using errcode = 'P0001';
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
    -- ninguém se põe num cargo que lhe dá poder que ainda não tem
    if v_pessoa = v_eu and interno.perfil_do_cargo(v_cargo) is not null
       and not (select interno.tenho_perfil(interno.perfil_do_cargo(v_cargo))) then
      raise exception 'Ninguém registra a si mesmo num cargo que lhe dá poder novo: outra pessoa da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;
    if not interno.esta_em_dia(v_pessoa) then
      raise exception '% está com a contribuição em atraso: não pode ser votado (Art. 11).',
        (select nome from public.pessoas where id = v_pessoa) using errcode = 'P0001';
    end if;
    insert into public.mandatos (pessoa_id, cargo, inicio, fim, encontro_id, documento)
    values (v_pessoa, v_cargo, v_inicio, v_fim, v_encontro, case when v_encontro is null then v_documento end);
    v_quantos := v_quantos + 1;
  end loop;
  return v_quantos;
end;
$$;

-- Encerrar antes: a própria pessoa (renúncia) ou a presidência. Tirar outra pessoa do cargo de presidente,
-- vice ou do Conselho Fiscal, depois de o mandato começar, pede a assembleia (instalada) que tratou disso.
-- No dia do início (ou antes), encerrar = registro por engano: o mandato não chega a valer.
drop function public.encerrar_mandato(uuid, date, text);
drop function interno.encerrar_mandato(uuid, date, text);
create function interno.encerrar_mandato(p_id uuid, p_data date, p_motivo text, p_encontro_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_mandato public.mandatos;
begin
  select * into v_mandato from public.mandatos where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Mandato não encontrado.' using errcode = 'P0001';
  end if;
  if v_mandato.pessoa_id <> v_eu and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Só a presidência (ou a própria pessoa, renunciando) encerra um mandato.' using errcode = '42501';
  end if;
  if v_mandato.encerrado_em is not null then
    raise exception 'Este mandato já foi encerrado.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo (ex.: renúncia).' using errcode = 'P0001';
  end if;
  if p_data is null or p_data < v_mandato.inicio or p_data > v_mandato.fim then
    raise exception 'A data precisa estar dentro do mandato.' using errcode = 'P0001';
  end if;
  if v_mandato.pessoa_id <> v_eu and v_mandato.cargo in ('presidente', 'vice_presidente', 'conselheiro_fiscal')
     and v_mandato.inicio < current_date
     and not exists (
       select 1 from public.encontros e
       where e.id = p_encontro_id and e.tipo in ('ago', 'age') and e.instalada_em is not null and e.arquivado_em is null
     ) then
    raise exception 'Tirar alguém do cargo de presidente, vice ou do Conselho Fiscal pede a assembleia (instalada) que tratou disso. Renúncia: a própria pessoa encerra.'
      using errcode = 'P0001';
  end if;
  update public.mandatos
  set encerrado_em = p_data,
      motivo_encerramento = trim(p_motivo) || case when p_encontro_id is not null then ' (assembleia registrada no sistema)' else '' end
  where id = p_id;
end;
$$;
create function public.encerrar_mandato(p_id uuid, p_data date, p_motivo text, p_encontro_id uuid default null)
returns void language sql security invoker set search_path = '' as $$ select interno.encerrar_mandato(p_id, p_data, p_motivo, p_encontro_id); $$;
revoke all on function interno.encerrar_mandato(uuid, date, text, uuid) from public;
grant execute on function interno.encerrar_mandato(uuid, date, text, uuid) to authenticated;
revoke all on function public.encerrar_mandato(uuid, date, text, uuid) from public, anon;
grant execute on function public.encerrar_mandato(uuid, date, text, uuid) to authenticated;

-- "Em exercício" só se a pessoa continua associada ativa
create or replace view public.vw_mandatos
with (security_invoker = true)
as
select
  m.id,
  m.pessoa_id,
  interno.nome_de_mandatario(m.pessoa_id) as nome,
  m.cargo,
  case when m.cargo = 'conselheiro_fiscal' then 'conselho_fiscal' else 'conselho_diretor' end as orgao,
  m.inicio,
  m.fim,
  m.encerrado_em,
  m.motivo_encerramento,
  m.encontro_id,
  e.titulo as encontro_titulo,
  (current_date between m.inicio and interno.fim_efetivo(m) and not interno.saiu_do_comep(m.pessoa_id)) as vigente
from public.mandatos m
left join public.encontros e on e.id = m.encontro_id
where m.arquivado_em is null;


-- ---------------------------------------------------------------------
-- 4 e 5. Saiu do COMEP: os mandatos acabam; readmissão só pela assembleia; arquivo com regras
-- ---------------------------------------------------------------------
create function interno.ao_sair_do_comep()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.situacao = 'ativo' and new.situacao in ('desligado', 'falecido') then
    update public.mandatos m
    set encerrado_em = greatest(current_date, m.inicio),
        motivo_encerramento = case new.situacao when 'falecido' then 'Falecimento' else 'Desligado do COMEP (Art. 8º)' end
    where m.pessoa_id = new.pessoa_id and m.arquivado_em is null and m.encerrado_em is null
      and m.fim >= greatest(current_date, m.inicio);
  end if;
  return null;
end;
$$;
create trigger ao_sair_do_comep after update of situacao on public.associados
  for each row execute function interno.ao_sair_do_comep();

create function interno.proteger_associado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- quem foi desligado (ou registrado como falecido) só volta pela assembleia (novo pedido de associação)
    if new.forma_admissao <> 'assembleia' and exists (
      select 1 from public.associados a where a.pessoa_id = new.pessoa_id and a.situacao in ('desligado', 'falecido')
    ) then
      raise exception 'Esta pessoa foi desligada do COMEP: a readmissão é pela assembleia (pedido de associação).' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.arquivado_em is null and new.arquivado_em is not null then
    if old.situacao <> 'ativo' then
      raise exception 'Desligamento e falecimento ficam no histórico: este cadastro não se arquiva.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.mandatos m where m.pessoa_id = old.pessoa_id and m.arquivado_em is null
               and interno.fim_efetivo(m) >= current_date) then
      raise exception 'Esta pessoa tem cargo na diretoria ou no Conselho Fiscal: encerre o mandato antes.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger proteger_associado before insert or update on public.associados
  for each row execute function interno.proteger_associado();

create or replace function interno.registrar_falecimento(p_pessoa_id uuid, p_data date, p_observacao text)
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
  if interno.tem_poder_de_direcao(p_pessoa_id) and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Esta pessoa tem cargo ou perfil da diretoria: o falecimento é registrado pela presidência.' using errcode = '42501';
  end if;
  if p_pessoa_id = (select interno.minha_pessoa_id()) then
    raise exception 'Registro inválido.' using errcode = '42501';
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
-- 2. Ata: assinatura conferida (sem NULL), cargo de quem assinou; anexo depois de assinada
-- ---------------------------------------------------------------------
alter table public.atas
  add column assinada_secretario_cargo text,
  add column assinada_presidente_cargo text,
  add constraint atas_assinatura_secretario check ((assinada_secretario_por is null) = (assinada_secretario_em is null)),
  add constraint atas_assinatura_presidente check ((assinada_presidente_por is null) = (assinada_presidente_em is null));

create or replace function interno.assinar_ata(p_encontro_id uuid, p_como text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_ata public.atas;
  v_cargo text;
begin
  if p_como is null or p_como not in ('secretario', 'presidente') then
    raise exception 'Assinatura inválida: como 1º secretário ou como presidente.' using errcode = 'P0001';
  end if;
  if v_eu is null then
    raise exception 'Entre no sistema para assinar.' using errcode = '42501';
  end if;
  if p_como = 'secretario' and not (select interno.tenho_perfil('secretaria')) then
    raise exception 'Assina como 1º secretário quem tem o perfil Secretaria.' using errcode = '42501';
  end if;
  if p_como = 'presidente' and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Assina como presidente quem tem o perfil Presidência.' using errcode = '42501';
  end if;
  select * into v_ata from public.atas where encontro_id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'A ata ainda não foi escrita.' using errcode = 'P0001';
  end if;
  if (p_como = 'secretario' and v_ata.assinada_presidente_por = v_eu) or (p_como = 'presidente' and v_ata.assinada_secretario_por = v_eu) then
    raise exception 'A ata é assinada por duas pessoas: o presidente e o 1º secretário.' using errcode = 'P0001';
  end if;
  -- o cargo de quem assina, se houver (titular ou substituto: 2º secretário, vice)
  select m.cargo::text into v_cargo from public.mandatos m
  where m.pessoa_id = v_eu and m.arquivado_em is null and current_date between m.inicio and interno.fim_efetivo(m)
  limit 1;
  if p_como = 'secretario' then
    if v_ata.assinada_secretario_em is not null then
      raise exception 'A ata já foi assinada pelo 1º secretário.' using errcode = 'P0001';
    end if;
    update public.atas set assinada_secretario_por = v_eu, assinada_secretario_em = now(), assinada_secretario_cargo = v_cargo where id = v_ata.id;
  else
    if v_ata.assinada_presidente_em is not null then
      raise exception 'A ata já foi assinada pelo presidente.' using errcode = 'P0001';
    end if;
    update public.atas set assinada_presidente_por = v_eu, assinada_presidente_em = now(), assinada_presidente_cargo = v_cargo where id = v_ata.id;
  end if;
end;
$$;

-- Assinada pelos dois, só o arquivo da ata no papel pode entrar (uma vez)
create or replace function interno.proteger_ata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.assinada_secretario_em is not null and old.assinada_presidente_em is not null then
    if old.arquivo_caminho is null and new.arquivo_caminho is not null
       and (to_jsonb(new) - 'arquivo_caminho' - 'atualizado_em') = (to_jsonb(old) - 'arquivo_caminho' - 'atualizado_em') then
      return new;
    end if;
    raise exception 'Ata assinada pelo presidente e pelo 1º secretário não muda mais.' using errcode = 'P0001';
  end if;
  if (old.assinada_secretario_em is not null or old.assinada_presidente_em is not null)
     and (new.texto is distinct from old.texto or new.encontro_id is distinct from old.encontro_id) then
    raise exception 'Depois da primeira assinatura, o texto da ata não muda.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function interno.anexar_ata(p_encontro_id uuid, p_caminho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ata public.atas;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência anexam a ata.' using errcode = '42501';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_encontro_id::text
     or not exists (select 1 from storage.objects where bucket_id = 'atas' and name = p_caminho) then
    raise exception 'O arquivo precisa estar na pasta desta assembleia.' using errcode = 'P0001';
  end if;
  select * into v_ata from public.atas where encontro_id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'Escreva a ata antes de anexar o arquivo.' using errcode = 'P0001';
  end if;
  if v_ata.assinada_secretario_em is not null and v_ata.assinada_presidente_em is not null and v_ata.arquivo_caminho is not null then
    raise exception 'A ata assinada já tem o arquivo anexado.' using errcode = 'P0001';
  end if;
  update public.atas set arquivo_caminho = p_caminho where id = v_ata.id;
end;
$$;

-- Ata em assinatura: votações travam já na primeira assinatura
create function interno.ata_em_assinatura(p_encontro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.atas
    where encontro_id = p_encontro_id and arquivado_em is null
      and (assinada_secretario_em is not null or assinada_presidente_em is not null)
  );
$$;


-- ---------------------------------------------------------------------
-- 9 e 8. Desligamento indicado na pauta; votações: travas e conferências
-- ---------------------------------------------------------------------
alter table public.encontro_pauta add column desligamento_pessoa_id uuid references public.pessoas (id);
comment on column public.encontro_pauta.desligamento_pessoa_id is 'Item de desligamento (Art. 8º): o associado já indicado na convocação.';

create or replace function interno.salvar_encontro(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_atual public.encontros;
  v_tipo public.tipo_encontro;
  v_inicio timestamptz;
  v_item jsonb;
  v_ordem integer := 0;
  v_deliberativo boolean;
  v_maioria public.maioria_exigida;
  v_alvo uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência preparam assembleias e reuniões.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  begin
    v_tipo := (p_dados ->> 'tipo')::public.tipo_encontro;
    v_inicio := (p_dados ->> 'inicio')::timestamptz;
  exception when others then
    raise exception 'Tipo ou data inválidos.' using errcode = 'P0001';
  end;
  if v_tipo is null or v_inicio is null then
    raise exception 'Informe o tipo e a data.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_dados ->> 'titulo'), '') = '' or coalesce(trim(p_dados ->> 'local'), '') = '' then
    raise exception 'Informe o título e o local.' using errcode = 'P0001';
  end if;
  if v_inicio <= now() then
    raise exception 'A data do encontro precisa ser no futuro.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_dados -> 'pauta', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_dados -> 'pauta', '[]'::jsonb)) > 50 then
    raise exception 'A pauta tem no máximo 50 itens.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.encontros (tipo, titulo, inicio, local, edital, fundamento)
    values (v_tipo, trim(p_dados ->> 'titulo'), v_inicio, trim(p_dados ->> 'local'),
            nullif(trim(p_dados ->> 'edital'), ''), nullif(trim(p_dados ->> 'fundamento'), ''))
    returning id into v_id;
  else
    select * into v_atual from public.encontros where id = v_id and arquivado_em is null for update;
    if not found then
      raise exception 'Encontro não encontrado.' using errcode = 'P0001';
    end if;
    if v_atual.situacao <> 'agendado' then
      raise exception 'Depois de convocado, o encontro não muda. Para mudar, cancele e convoque de novo.' using errcode = 'P0001';
    end if;
    update public.encontros
    set tipo = v_tipo, titulo = trim(p_dados ->> 'titulo'), inicio = v_inicio, local = trim(p_dados ->> 'local'),
        edital = nullif(trim(p_dados ->> 'edital'), ''), fundamento = nullif(trim(p_dados ->> 'fundamento'), '')
    where id = v_id;
    update public.encontro_pauta set arquivado_em = now() where encontro_id = v_id and arquivado_em is null;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_dados -> 'pauta', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_deliberativo := coalesce((v_item ->> 'deliberativo')::boolean, false);
    if v_deliberativo and v_tipo = 'reuniao_mensal' then
      raise exception 'Reunião mensal não tem votação de assembleia: os itens dela são só de informe ou conversa.' using errcode = 'P0001';
    end if;
    v_maioria := case when v_deliberativo then coalesce(nullif(v_item ->> 'maioria', ''), 'simples')::public.maioria_exigida end;
    v_alvo := nullif(v_item ->> 'desligamento_pessoa_id', '')::uuid;
    if v_alvo is not null then
      if v_tipo <> 'ago' or not v_deliberativo or v_maioria <> 'tres_quintos' then
        raise exception 'Desligamento é item de votação da Assembleia Ordinária, por 3/5 (Art. 8º).' using errcode = 'P0001';
      end if;
      if not interno.associado_ativo(v_alvo) then
        raise exception 'O desligamento é de um associado ativo.' using errcode = 'P0001';
      end if;
    end if;
    insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria, desligamento_pessoa_id)
    values (v_id, v_ordem, trim(v_item ->> 'titulo'), nullif(trim(v_item ->> 'descricao'), ''), v_deliberativo, v_maioria, v_alvo);
  end loop;
  return v_id;
end;
$$;

create or replace function interno.registrar_votacao(
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
  v_config public.config_assembleias;
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
  if v_encontro.situacao = 'cancelado' or interno.ata_em_assinatura(v_encontro.id) then
    raise exception 'A ata já começou a ser assinada: as votações não mudam mais.' using errcode = 'P0001';
  end if;
  if p_a_favor is null or p_contra is null or p_abstencoes is null or least(p_a_favor, p_contra, p_abstencoes) < 0 then
    raise exception 'Informe os votos (a favor, contra e abstenções).' using errcode = 'P0001';
  end if;

  select * into v_anterior from public.deliberacoes where pauta_id = p_pauta_id and arquivado_em is null for update;
  if found and v_anterior.desligamento_pessoa_id is not null and v_anterior.aprovada then
    raise exception 'Esta votação já desligou um associado e não pode ser refeita aqui.' using errcode = 'P0001';
  end if;

  v_votantes := (interno.contagem_quorum(v_encontro.id) ->> 'presentes_aptos')::integer;
  if p_a_favor + p_contra + p_abstencoes > v_votantes then
    raise exception 'São % votos, mas só % presentes em dia podem votar.', p_a_favor + p_contra + p_abstencoes, v_votantes
      using errcode = 'P0001';
  end if;

  -- o desligamento é o do associado indicado no item da pauta (desde a convocação)
  if p_desligamento_pessoa_id is distinct from v_item.desligamento_pessoa_id then
    raise exception 'O desligamento é o do associado indicado na pauta da convocação.' using errcode = 'P0001';
  end if;
  if v_item.desligamento_pessoa_id is not null then
    if p_desligamento_inciso is null or p_desligamento_inciso not in ('I', 'II', 'III', 'IV') then
      raise exception 'Informe o motivo do Art. 8º (I a IV). Falecimento é registrado na ficha do ministro.' using errcode = 'P0001';
    end if;
    select * into v_config from public.config_assembleias where id;
    if p_desligamento_inciso = 'IV' and interno.faltas_seguidas(v_item.desligamento_pessoa_id) < v_config.faltas_pauta then
      raise exception 'Pelo inciso IV, o associado precisa ter % faltas seguidas sem justificativa.', v_config.faltas_pauta using errcode = 'P0001';
    end if;
    select * into v_associado from public.associados
    where pessoa_id = v_item.desligamento_pessoa_id and arquivado_em is null and situacao = 'ativo';
    if not found then
      raise exception 'Associado ativo não encontrado.' using errcode = 'P0001';
    end if;
  elsif p_desligamento_inciso is not null then
    raise exception 'Este item não é de desligamento.' using errcode = 'P0001';
  end if;

  if v_anterior.id is not null then
    update public.deliberacoes set arquivado_em = now() where id = v_anterior.id;
  end if;
  v_aprovada := interno.aprovada(v_item.maioria, v_votantes, p_a_favor, p_contra);
  insert into public.deliberacoes (encontro_id, pauta_id, maioria, votantes, a_favor, contra, abstencoes, aprovada,
                                   desligamento_pessoa_id, desligamento_inciso, observacao)
  values (v_encontro.id, p_pauta_id, v_item.maioria, v_votantes, p_a_favor, p_contra, p_abstencoes, v_aprovada,
          v_item.desligamento_pessoa_id, p_desligamento_inciso, nullif(trim(p_observacao), ''))
  returning id into v_id;

  if v_item.desligamento_pessoa_id is not null and v_aprovada then
    insert into public.desligamentos (associado_id, inciso, data, deliberacao_id, observacao)
    values (v_associado.id, p_desligamento_inciso, (v_encontro.inicio at time zone 'America/Belem')::date, v_id, nullif(trim(p_observacao), ''));
    update public.associados set situacao = 'desligado' where id = v_associado.id;
  end if;

  return jsonb_build_object('id', v_id, 'aprovada', v_aprovada, 'votantes', v_votantes);
end;
$$;


-- ---------------------------------------------------------------------
-- 8 e 11. Assembleia: instalar só no dia; 2ª chamada guardada na convocação; não se cancela instalada;
--         a lista de presença de assembleia só fecha depois de instalada
-- ---------------------------------------------------------------------
alter table public.encontros
  add column segunda_chamada_minutos integer,
  add column presentes_na_instalacao integer;
comment on column public.encontros.segunda_chamada_minutos is 'Minutos até a 2ª chamada, guardados na convocação (a regra que valia quando foi convocada).';

create or replace function interno.convocar_encontro(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_config public.config_assembleias;
  v_dia date;
  v_limite date;
begin
  select * into v_encontro from public.encontros where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not (select interno.pode_conduzir(v_encontro.tipo)) then
    raise exception 'A convocação de assembleia é do presidente (Art. 16, §2º).' using errcode = '42501';
  end if;
  if v_encontro.situacao <> 'agendado' then
    raise exception 'Este encontro já foi convocado ou cancelado.' using errcode = 'P0001';
  end if;
  if v_encontro.inicio <= now() then
    raise exception 'A data do encontro já passou.' using errcode = 'P0001';
  end if;
  select * into v_config from public.config_assembleias where id;

  if v_encontro.tipo in ('ago', 'age') then
    v_dia := (v_encontro.inicio at time zone 'America/Belem')::date;
    v_limite := current_date + v_config.antecedencia_dias;
    if v_dia < v_limite then
      raise exception 'A convocação precisa de pelo menos % dias de antecedência (Art. 16, §2º): a assembleia pode ser a partir de %.',
        v_config.antecedencia_dias, to_char(v_limite, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.encontro_pauta where encontro_id = p_id and arquivado_em is null) then
      raise exception 'A convocação precisa da pauta (Art. 16, §3º).' using errcode = 'P0001';
    end if;
    if coalesce(trim(v_encontro.edital), '') = '' then
      raise exception 'Escreva o texto do edital antes de convocar.' using errcode = 'P0001';
    end if;
    if v_encontro.tipo = 'ago'
       and (not (extract(month from v_dia)::integer = any (v_config.meses_ago)) or extract(day from v_dia) < v_config.dia_minimo_ago) then
      raise exception 'A Assembleia Ordinária só pode ser nos meses e dias das regras (Art. 16, §6º).' using errcode = 'P0001';
    end if;
    if v_encontro.tipo = 'age' and coalesce(trim(v_encontro.fundamento), '') = '' then
      raise exception 'Informe quem pediu a Assembleia Extraordinária: 3/5 dos associados ou a maioria do Conselho Diretor (Art. 16, §3º).'
        using errcode = 'P0001';
    end if;
  end if;

  update public.encontros
  set situacao = 'convocado', convocado_em = now(), convocado_por = (select interno.minha_pessoa_id()),
      segunda_chamada_minutos = v_config.minutos_segunda_chamada
  where id = p_id;
end;
$$;

create or replace function interno.instalar_assembleia(p_encontro_id uuid)
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
  if not interno.presenca_aberta(v_encontro) then
    raise exception 'A assembleia se instala no dia (até 18 horas depois do horário marcado).' using errcode = 'P0001';
  end if;
  select * into v_config from public.config_assembleias where id;
  v_conta := interno.contagem_quorum(p_encontro_id);
  v_aptos := (v_conta ->> 'aptos')::integer;
  v_presentes_aptos := (v_conta ->> 'presentes_aptos')::integer;
  v_minimo := interno.quorum_primeira_chamada(v_aptos);
  v_segunda := v_encontro.inicio + make_interval(mins => coalesce(v_encontro.segunda_chamada_minutos, v_config.minutos_segunda_chamada));
  if v_presentes_aptos >= v_minimo then
    v_chamada := 'primeira';
  elsif now() >= v_segunda then
    v_chamada := 'segunda';
  else
    raise exception 'Sem quórum na 1ª chamada: % presentes aptos de % (precisa de %). A 2ª chamada, com qualquer número, é às %.',
      v_presentes_aptos, v_aptos, v_minimo, to_char(v_segunda at time zone 'America/Belem', 'HH24:MI') using errcode = 'P0001';
  end if;
  update public.encontros
  set instalada_em = now(), chamada = v_chamada, aptos_na_instalacao = v_aptos,
      presentes_aptos_na_instalacao = v_presentes_aptos, presentes_na_instalacao = (v_conta ->> 'presentes')::integer
  where id = p_encontro_id;
  return jsonb_build_object('chamada', v_chamada, 'aptos', v_aptos, 'presentes_aptos', v_presentes_aptos, 'minimo', v_minimo);
end;
$$;

create or replace function interno.cancelar_encontro(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
begin
  select * into v_encontro from public.encontros where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if not (select interno.pode_conduzir(v_encontro.tipo)) then
    raise exception 'Só o presidente cancela uma assembleia convocada.' using errcode = '42501';
  end if;
  if v_encontro.situacao not in ('agendado', 'convocado') then
    raise exception 'Este encontro já foi realizado ou cancelado.' using errcode = 'P0001';
  end if;
  if v_encontro.instalada_em is not null then
    raise exception 'A assembleia já foi instalada: aconteceu e fica registrada (não se cancela).' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  update public.encontros
  set situacao = 'cancelado', cancelado_em = now(), motivo_cancelamento = trim(p_motivo)
  where id = p_id;
end;
$$;

create or replace function interno.encerrar_presenca(p_encontro_id uuid)
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
  if v_encontro.tipo in ('ago', 'age') and v_encontro.instalada_em is null then
    raise exception 'Instale a assembleia (quórum) antes de encerrar a lista de presença.' using errcode = 'P0001';
  end if;
  update public.encontros
  set situacao = 'realizado', presenca_encerrada_em = now(), presenca_encerrada_por = (select interno.minha_pessoa_id())
  where id = p_encontro_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 11. Regras das assembleias: só a presidência muda; faltas para avisar ≤ faltas para a pauta
-- ---------------------------------------------------------------------
drop policy "regras das assembleias: secretaria e presidência alteram" on public.config_assembleias;
create policy "regras das assembleias: a presidência altera"
  on public.config_assembleias for update to authenticated
  using ((select interno.tenho_perfil('presidencia')))
  with check ((select interno.tenho_perfil('presidencia')));
alter table public.config_assembleias add constraint config_assembleias_faltas check (faltas_aviso <= faltas_pauta);


-- ---------------------------------------------------------------------
-- 12. Faltas só depois de entrar no sistema; quórum só para a diretoria; rascunho cancelado escondido
-- ---------------------------------------------------------------------
create or replace function interno.faltas_seguidas(p_pessoa_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde date;
  v_reuniao record;
  v_faltas integer := 0;
begin
  -- conta a partir da admissão, mas nunca antes de o associado entrar no sistema (antes não havia como marcar)
  select greatest(coalesce(a.admitido_em, '-infinity'::date), (a.criado_em at time zone 'America/Belem')::date) into v_desde
  from public.associados a where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found then
    return 0;
  end if;
  for v_reuniao in
    select e.id
    from public.encontros e
    where e.tipo = 'reuniao_mensal' and e.situacao = 'realizado' and e.arquivado_em is null
      and (e.inicio at time zone 'America/Belem')::date >= v_desde
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

create or replace function interno.contagem_quorum(p_encontro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a contagem do quórum.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'aptos', (
      select count(*) from public.associados a
      where a.arquivado_em is null and a.situacao = 'ativo' and interno.esta_em_dia(a.pessoa_id)
    ),
    'presentes', (
      select count(*) from public.encontro_presencas p
      join public.associados a on a.pessoa_id = p.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where p.encontro_id = p_encontro_id and p.presente_em is not null and p.arquivado_em is null
    ),
    'presentes_aptos', (
      select count(*) from public.encontro_presencas p
      join public.associados a on a.pessoa_id = p.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where p.encontro_id = p_encontro_id and p.presente_em is not null and p.arquivado_em is null
        and interno.esta_em_dia(p.pessoa_id)
    )
  );
end;
$$;

drop policy "encontros: convocados para todos; rascunhos, secretaria e presidência" on public.encontros;
create policy "encontros: convocados para todos; rascunhos, secretaria e presidência"
  on public.encontros for select to authenticated
  using (
    arquivado_em is null
    and ((situacao <> 'agendado' and convocado_em is not null) or (select interno.tenho_perfil('secretaria', 'presidencia')))
  );


-- ---------------------------------------------------------------------
-- 7. Votações, atas e arquivos das atas: associados ativos (depois de assinada) e a diretoria
-- ---------------------------------------------------------------------
create function interno.leio_documentos_da_assembleia(p_encontro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select interno.tenho_perfil('secretaria', 'presidencia', 'conselho_fiscal'))
    or (interno.associado_ativo((select interno.minha_pessoa_id())) and interno.ata_assinada(p_encontro_id));
$$;

drop policy "votações: de encontros que a pessoa vê" on public.deliberacoes;
create policy "votações: diretoria; associados ativos depois da ata assinada"
  on public.deliberacoes for select to authenticated
  using ((select interno.leio_documentos_da_assembleia(encontro_id)));

drop policy "atas: assinadas para todos com login; rascunho, secretaria e presidência" on public.atas;
create policy "atas: diretoria; associados ativos depois de assinada"
  on public.atas for select to authenticated
  using ((select interno.leio_documentos_da_assembleia(encontro_id)));

drop policy "atas: quem tem login lê" on storage.objects;
create policy "atas: diretoria; associados ativos depois de assinada"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'atas'
    and (select interno.leio_documentos_da_assembleia(
      case when split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' then split_part(name, '/', 1)::uuid end
    ))
  );


-- ---------------------------------------------------------------------
-- Permissões das funções novas
-- ---------------------------------------------------------------------
do $$
declare
  v text;
begin
  foreach v in array array[
    'saiu_do_comep(uuid)', 'tem_poder_de_direcao(uuid)', 'ata_em_assinatura(uuid)', 'leio_documentos_da_assembleia(uuid)'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
  end loop;
end;
$$;
revoke all on function interno.proibir_desarquivar_perfil() from public;
revoke all on function interno.ao_sair_do_comep() from public;
revoke all on function interno.proteger_associado() from public;
