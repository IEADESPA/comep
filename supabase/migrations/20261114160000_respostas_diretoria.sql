-- =====================================================================
-- ENTREGA 4.5 — AJUSTES DAS RESPOSTAS DE 14/11/2026 (PROJETO.md, seções 11.3 e 11.5)
--
--   1. Configurações do estatuto: tempo de mandato e membros do Conselho Fiscal (pergunta 13).
--   2. Secretário executivo: o acesso da secretaria e da tesouraria (pergunta 27).
--   3. Quórum da 1ª chamada: metade dos em dia, mais um, arredondado para cima — 75 → 39 (pergunta 25).
--   4. Maiorias de 3/5 e 2/3 sobre os votos válidos: sim + não (pergunta 24).
--   5. Em dia: o pagamento informado até o vencimento conta, até a conferência (pergunta 23);
--      na assembleia, conta também o que vence no dia dela (pergunta 19).
--   6. O anual vence na data da AGO que abre o exercício (pergunta 18).
--   7. Troca entre mensal e anual no meio do exercício; admitido no meio paga só os meses que faltam (pergunta 18).
--   8. Desligamento: só a conduta (II) vai à votação; I, III, IV e V a diretoria homologa e registra (pergunta 5);
--      as faltas seguidas contam só nas assembleias (pergunta 22).
--   9. Jubilado: vota, mas não é votado; a jubilação é aprovada pela assembleia (pergunta 20).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Configurações do estatuto: tempo de mandato e Conselho Fiscal
-- ---------------------------------------------------------------------
alter table public.config_assembleias
  add column anos_mandato integer not null default 4 check (anos_mandato between 1 and 10),
  add column membros_conselho_fiscal integer not null default 3 check (membros_conselho_fiscal between 1 and 9);
comment on column public.config_assembleias.anos_mandato is 'Mandato do Conselho Diretor e do Conselho Fiscal, em anos (Art. 12). Vale para os próximos registros.';
comment on column public.config_assembleias.membros_conselho_fiscal is 'Membros do Conselho Fiscal (Art. 14; diretoria, 11/11/2026: 3).';
comment on column public.config_assembleias.faltas_pauta is
  'Faltas seguidas às assembleias, sem justificativa aceita, para a diretoria homologar o desligamento (Art. 8º, IV; 14/11/2026).';
comment on column public.config_assembleias.faltas_aviso is 'Faltas seguidas às assembleias para avisar o associado.';
grant update (anos_mandato, membros_conselho_fiscal) on public.config_assembleias to authenticated;

-- o limite dos anos passa a ser conferido no registro, com o número das configurações
alter table public.mandatos drop constraint mandatos_quatro_anos;


-- ---------------------------------------------------------------------
-- 2. Os perfis de cada cargo (o secretário executivo: secretaria e tesouraria)
-- ---------------------------------------------------------------------
create function interno.perfis_do_cargo(p_cargo public.cargo)
returns public.perfil_acesso[]
language sql
immutable
set search_path = ''
as $$
  select case p_cargo
    when 'presidente' then '{presidencia}'
    when 'vice_presidente' then '{presidencia}'
    when 'primeiro_secretario' then '{secretaria}'
    when 'segundo_secretario' then '{secretaria}'
    when 'primeiro_tesoureiro' then '{tesouraria}'
    when 'segundo_tesoureiro' then '{tesouraria}'
    -- expediente (secretaria e lançamentos financeiros) e os eventos do Conselho (pergunta 27)
    when 'secretario_executivo' then '{secretaria,tesouraria}'
    when 'conselheiro_fiscal' then '{conselho_fiscal}'
  end::public.perfil_acesso[];
$$;

-- o perfil principal (para os textos): o do secretário executivo é o da secretaria
create or replace function interno.perfil_do_cargo(p_cargo public.cargo)
returns public.perfil_acesso
language sql
immutable
set search_path = ''
as $$ select (interno.perfis_do_cargo(p_cargo))[1]; $$;

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
      and interno.perfis_do_cargo(m.cargo) && p_perfis
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
    select unnest(interno.perfis_do_cargo(m.cargo))
    from public.mandatos m
    join public.pessoas p on p.id = m.pessoa_id
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where p.usuario_id = (select auth.uid()) and p.arquivado_em is null and m.arquivado_em is null
      and current_date between m.inicio and interno.fim_efetivo(m)
  ) x
  where x.perfil is not null;
$$;

-- o secretário executivo agora tem poder de direção (secretaria e tesouraria)
create or replace function interno.tem_poder_de_direcao(p_pessoa_id uuid)
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
    where m.pessoa_id = p_pessoa_id and m.arquivado_em is null and interno.fim_efetivo(m) >= current_date
  );
$$;

-- vagas do Conselho Fiscal pela configuração
create or replace function interno.validar_mandato()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fim date := interno.fim_efetivo(new);
  v_ocupados integer;
  v_vagas integer;
begin
  if new.arquivado_em is not null then
    return new;
  end if;
  -- registros ao mesmo tempo não passam juntos pela conferência das vagas
  perform pg_advisory_xact_lock(hashtext('comep: mandatos'));
  v_vagas := case when new.cargo = 'conselheiro_fiscal'
                  then (select c.membros_conselho_fiscal from public.config_assembleias c where c.id)
                  else 1 end;
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
    if new.cargo = 'conselheiro_fiscal' then
      raise exception 'O Conselho Fiscal já tem % membros nesse período.', v_vagas using errcode = 'P0001';
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

-- registrar a diretoria: anos pela configuração; o jubilado não é votado (pergunta 20)
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
  v_anos integer := (select c.anos_mandato from public.config_assembleias c where c.id);
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
  if v_fim > v_inicio + make_interval(years => v_anos) then
    raise exception 'O mandato é de no máximo % anos (Art. 12; Configurações → regras do estatuto).', v_anos using errcode = 'P0001';
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
    if v_pessoa = v_eu and exists (
      select 1 from unnest(interno.perfis_do_cargo(v_cargo)) x(perfil) where not (select interno.tenho_perfil(x.perfil))
    ) then
      raise exception 'Ninguém registra a si mesmo num cargo que lhe dá poder novo: outra pessoa da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;
    if exists (select 1 from public.associados a where a.pessoa_id = v_pessoa and a.arquivado_em is null and a.jubilado) then
      raise exception '% é jubilado: vota, mas não pode ser votado (decisão de 14/11/2026).',
        (select nome from public.pessoas where id = v_pessoa) using errcode = 'P0001';
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

revoke all on function interno.perfis_do_cargo(public.cargo) from public;
grant execute on function interno.perfis_do_cargo(public.cargo) to authenticated;


-- ---------------------------------------------------------------------
-- 3 e 4. Quórum (37,5 + 1 → 39) e maiorias sobre os votos válidos
-- ---------------------------------------------------------------------
create or replace function interno.quorum_primeira_chamada(p_aptos integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select (p_aptos + 3) / 2; $$;
comment on function interno.quorum_primeira_chamada(integer) is
  'Metade dos aptos mais um, arredondado para cima (pergunta 25): 74 → 38; 75 → 39.';

-- p_votantes fica na assinatura (as chamadas não mudam), mas a base agora são os votos válidos
create or replace function interno.aprovada(p_maioria public.maioria_exigida, p_votantes integer, p_a_favor integer, p_contra integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_maioria
    when 'simples' then p_a_favor > p_contra
    when 'tres_quintos' then p_a_favor + p_contra > 0 and p_a_favor * 5 >= (p_a_favor + p_contra) * 3
    when 'dois_tercos' then p_a_favor + p_contra > 0 and p_a_favor * 3 >= (p_a_favor + p_contra) * 2
  end;
$$;
comment on function interno.aprovada(public.maioria_exigida, integer, integer, integer) is
  '3/5 e 2/3 sobre os votos válidos (sim + não); abstenção e branco não entram (pergunta 24).';


-- ---------------------------------------------------------------------
-- 5. Em dia: pagamento informado no prazo; na assembleia, o que vence no dia dela
-- ---------------------------------------------------------------------
-- A cobrança tem pagamento informado até o vencimento, ainda não conferido (pergunta 23)
create function interno.coberta_por_informe(p_cobranca_id uuid, p_vencimento date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.informes_pagamento i
    where i.cobranca_id = p_cobranca_id and i.situacao = 'pendente' and i.arquivado_em is null
      and (i.criado_em at time zone 'America/Belem')::date <= p_vencimento
  );
$$;

-- Em dia até a data-limite: nada em aberto que venceu antes dela (salvo o informado no prazo)
create function interno.em_dia_ate(p_pessoa_id uuid, p_limite date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.cobrancas c
    where c.pessoa_id = p_pessoa_id and c.situacao = 'aberta' and c.arquivado_em is null
      and c.vencimento < p_limite and not interno.coberta_por_informe(c.id, c.vencimento)
  );
$$;

create or replace function interno.esta_em_dia(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select interno.em_dia_ate(p_pessoa_id, current_date); $$;

-- Na assembleia: o que vence no próprio dia também precisa estar pago (pergunta 19)
create function interno.limite_em_dia_do_encontro(p_encontro_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (e.inicio at time zone 'America/Belem')::date + 1 from public.encontros e where e.id = p_encontro_id),
    current_date
  );
$$;

create or replace function interno.contagem_quorum(p_encontro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite date := interno.limite_em_dia_do_encontro(p_encontro_id);
begin
  if (select auth.uid()) is not null and not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a contagem do quórum.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'aptos', (
      select count(*) from public.associados a
      where a.arquivado_em is null and a.situacao = 'ativo' and interno.em_dia_ate(a.pessoa_id, v_limite)
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
        and interno.em_dia_ate(p.pessoa_id, v_limite)
    )
  );
end;
$$;

create or replace function interno.lista_presenca(p_encontro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite date := interno.limite_em_dia_do_encontro(p_encontro_id);
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a lista de presença.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pessoa_id', a.pessoa_id,
      'nome', pe.nome,
      'numero_registro', a.numero_registro,
      'em_dia', interno.em_dia_ate(a.pessoa_id, v_limite),
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

create or replace function interno.registrar_presenca_por_codigo(p_encontro_id uuid, p_codigo text)
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
    'em_dia', interno.em_dia_ate(v_credencial.pessoa_id, interno.limite_em_dia_do_encontro(p_encontro_id))
  );
end;
$$;

-- A lista "em dia / em atraso" com a mesma regra (o informado no prazo não conta como vencido)
create or replace view public.vw_situacao_contribuicao
with (security_invoker = true)
as
select
  v.pessoa_id,
  v.nome,
  v.numero_registro,
  v.igreja,
  v.categoria_contribuicao,
  v.jubilado,
  coalesce(e.vencidas, 0) as cobrancas_vencidas,
  coalesce(e.valor_vencido, 0) as valor_vencido,
  coalesce(e.vencidas, 0) = 0 as em_dia
from public.vw_associados v
left join lateral (
  select count(*)::integer as vencidas, sum(c.valor) as valor_vencido
  from public.cobrancas c
  where c.pessoa_id = v.pessoa_id and c.situacao = 'aberta' and c.vencimento < current_date and c.arquivado_em is null
    and not interno.coberta_por_informe(c.id, c.vencimento)
) e on true
where v.situacao = 'ativo';
comment on view public.vw_situacao_contribuicao is
  'Em dia = nada vencido e não pago (Art. 11); o pagamento informado até o vencimento conta até a conferência (14/11/2026).';

create or replace function interno.ministros_da_minha_igreja()
returns table (
  pessoa_id         uuid,
  nome              text,
  telefone          text,
  numero_registro   integer,
  titulo            text,
  funcao            text,
  pastor_presidente boolean,
  igreja_id         uuid,
  em_dia            boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.pessoa_id, p.nome, p.telefone, a.numero_registro, tm.nome, v.funcao, v.pastor_presidente, v.igreja_id,
         interno.esta_em_dia(a.pessoa_id)
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

revoke all on function interno.coberta_por_informe(uuid, date) from public;
revoke all on function interno.em_dia_ate(uuid, date) from public;
revoke all on function interno.limite_em_dia_do_encontro(uuid) from public;
grant execute on function interno.coberta_por_informe(uuid, date) to authenticated;


-- ---------------------------------------------------------------------
-- 6. O anual vence na data da AGO que abre o exercício
-- ---------------------------------------------------------------------
-- A primeira AGO convocada (ou realizada) no primeiro semestre do exercício; sem ela, o dia das configurações
create function interno.vencimento_anual(p_exercicio integer)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select min((e.inicio at time zone 'America/Belem')::date)
     from public.encontros e
     where e.tipo = 'ago' and e.arquivado_em is null and e.situacao in ('convocado', 'realizado')
       and (e.inicio at time zone 'America/Belem')::date >= make_date(p_exercicio, 4, 1)
       and (e.inicio at time zone 'America/Belem')::date < make_date(p_exercicio, 10, 1)),
    make_date(p_exercicio, 4, (select c.dia_vencimento_anual from public.config_financeiro c where c.id))
  );
$$;
comment on function interno.vencimento_anual(integer) is
  'O anual vence na data da AGO que abre o exercício (pergunta 18); antes de ela ser convocada, no dia das configurações.';

-- Convocar, cancelar, mudar ou arquivar a AGO acerta o vencimento dos anuais em aberto
create function interno.acertar_vencimento_anual()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cobrancas c
  set vencimento = interno.vencimento_anual(c.exercicio)
  where c.tipo = 'anual' and c.situacao = 'aberta' and c.arquivado_em is null
    and c.competencia = make_date(c.exercicio, 4, 1)
    and c.exercicio in (interno.exercicio_de((old.inicio at time zone 'America/Belem')::date),
                        interno.exercicio_de((new.inicio at time zone 'America/Belem')::date))
    and c.vencimento is distinct from interno.vencimento_anual(c.exercicio);
  return null;
end;
$$;
create trigger acertar_vencimento_anual
  after update of situacao, inicio, arquivado_em on public.encontros
  for each row when (new.tipo = 'ago' or old.tipo = 'ago')
  execute function interno.acertar_vencimento_anual();

revoke all on function interno.vencimento_anual(integer) from public;
revoke all on function interno.acertar_vencimento_anual() from public;

-- Os anuais em aberto que já existem passam a vencer pela regra nova
update public.cobrancas c
set vencimento = interno.vencimento_anual(c.exercicio)
where c.tipo = 'anual' and c.situacao = 'aberta' and c.arquivado_em is null
  and c.competencia = make_date(c.exercicio, 4, 1)
  and c.vencimento is distinct from interno.vencimento_anual(c.exercicio);


-- ---------------------------------------------------------------------
-- 7. Cobranças: anual proporcional (admitido no meio ou troca no meio do exercício)
-- ---------------------------------------------------------------------
create or replace function interno.gerar_cobrancas_pessoa(p_pessoa_id uuid, p_exercicio integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assoc       record;
  v_config      public.config_financeiro;
  v_plano       public.tipo_valor;
  v_inicio      date := make_date(p_exercicio, 4, 1);
  v_primeiro    date;
  v_meses       integer;
  v_competencia date;
  v_valor       numeric;
  v_criadas     integer := 0;
begin
  select a.pessoa_id, a.admitido_em, a.jubilado, v.categoria_contribuicao
  into v_assoc
  from public.associados a
  join public.vw_associados v on v.id = a.id
  where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found or v_assoc.jubilado then
    return 0; -- não é associado ativo, ou é jubilado (isento)
  end if;

  select * into v_config from public.config_financeiro where id;
  select tipo into v_plano from public.planos_contribuicao
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  v_primeiro := greatest(v_inicio, date_trunc('month', coalesce(v_assoc.admitido_em, v_inicio))::date);
  if v_primeiro > make_date(p_exercicio + 1, 3, 1) then
    return 0; -- admitido depois do fim do exercício
  end if;

  if coalesce(v_plano, 'mensal') = 'anual' then
    -- o anual cobre do primeiro mês até março; admitido no meio paga só os meses que faltam (pergunta 18)
    v_meses := 12 - ((extract(year from v_primeiro)::integer - p_exercicio) * 12 + extract(month from v_primeiro)::integer - 4);
    v_valor := interno.valor_vigente(v_assoc.categoria_contribuicao, 'anual', v_inicio);
    if v_valor is not null and not exists (
      select 1 from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo in ('mensal', 'anual')
        and (c.situacao <> 'cancelada' or (c.tipo = 'anual' and c.cancelada_como = 'manual'))
        and c.arquivado_em is null
    ) then
      insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor, observacao)
      values (p_pessoa_id, p_exercicio, 'anual', v_primeiro,
              case when v_primeiro = v_inicio then interno.vencimento_anual(p_exercicio)
                   else v_primeiro + (v_config.dia_vencimento_mensal - 1) end,
              v_assoc.categoria_contribuicao,
              case when v_meses = 12 then v_valor else round(v_valor * v_meses / 12.0, 2) end,
              case when v_meses < 12 then 'Anual proporcional: ' || v_meses || ' meses (até março).' end);
      v_criadas := 1;
    end if;
    return v_criadas;
  end if;

  -- Mensal
  if exists (
    select 1 from public.cobrancas c
    where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo = 'anual'
      and (c.situacao <> 'cancelada' or c.cancelada_como = 'manual') and c.arquivado_em is null
  ) then
    return 0;
  end if;
  for m in 0..11 loop
    v_competencia := (v_inicio + make_interval(months => m))::date;
    continue when v_competencia < v_primeiro;
    v_valor := interno.valor_vigente(v_assoc.categoria_contribuicao, 'mensal', v_competencia);
    continue when v_valor is null;
    if not exists (
      select 1 from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.tipo = 'mensal' and c.competencia = v_competencia
        and (c.situacao <> 'cancelada' or c.cancelada_como = 'manual') and c.arquivado_em is null
    ) then
      insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
      values (p_pessoa_id, p_exercicio, 'mensal', v_competencia, v_competencia + (v_config.dia_vencimento_mensal - 1),
              v_assoc.categoria_contribuicao, v_valor);
      v_criadas := v_criadas + 1;
    end if;
  end loop;
  return v_criadas;
end;
$$;

-- Troca no meio do exercício (pergunta 18):
--   * mensal → anual: as mensalidades em aberto deste mês em diante viram um anual proporcional;
--   * anual → mensal: o anual em aberto sai e voltam as mensalidades (as já pagas continuam pagas).
create or replace function interno.escolher_plano(p_pessoa_id uuid, p_exercicio integer, p_tipo public.tipo_valor)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.tipo_valor;
  v_categoria public.categoria_contribuicao;
  v_mes date := date_trunc('month', current_date)::date;
  v_desde date;
  v_meses integer;
  v_competencia date;
  v_vencimento date;
  v_valor numeric;
  v_anual public.cobrancas;
begin
  if p_tipo not in ('mensal', 'anual') then
    raise exception 'Escolha mensal ou anual.' using errcode = 'P0001';
  end if;
  if not (p_pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia'))) then
    raise exception 'Só o próprio associado ou a tesouraria escolhem o plano.' using errcode = '42501';
  end if;
  select v.categoria_contribuicao into v_categoria
  from public.associados a join public.vw_associados v on v.id = a.id
  where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found then
    raise exception 'Só associado ativo tem plano de contribuição.' using errcode = 'P0001';
  end if;
  -- uma troca de cada vez para a mesma pessoa
  perform pg_advisory_xact_lock(hashtext('comep: plano ' || p_pessoa_id::text));

  select tipo into v_atual from public.planos_contribuicao
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  if v_atual = p_tipo then
    return; -- já é este o plano
  end if;

  if exists (
    select 1 from public.cobrancas where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo in ('mensal', 'anual')
  ) then
    if p_tipo = 'anual' then
      -- sem nenhuma mensalidade paga (ou informada) no exercício, todas viram o anual; com alguma, só deste mês em diante
      v_desde := case when exists (
        select 1 from public.cobrancas c
        where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo = 'mensal' and c.arquivado_em is null
          and (c.situacao = 'paga' or exists (select 1 from public.informes_pagamento i where i.cobranca_id = c.id and i.situacao = 'pendente'))
      ) then v_mes else '-infinity'::date end;
      select count(*), min(c.competencia), min(c.vencimento) into v_meses, v_competencia, v_vencimento
      from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo = 'mensal' and c.situacao = 'aberta'
        and c.arquivado_em is null and c.competencia >= v_desde
        and not exists (select 1 from public.informes_pagamento i where i.cobranca_id = c.id and i.situacao = 'pendente');
      if v_meses = 0 then
        raise exception 'Não há mensalidades em aberto deste mês até março para trocar pelo anual.' using errcode = 'P0001';
      end if;
      -- o exercício inteiro (desde abril): o anual cheio, que vence na AGO; senão, proporcional aos meses
      v_valor := interno.valor_vigente(v_categoria, 'anual', make_date(p_exercicio, 4, 1));
      if v_valor is null then
        raise exception 'Não há valor anual em vigor para esta categoria.' using errcode = 'P0001';
      end if;
      if v_meses >= 12 and v_competencia = make_date(p_exercicio, 4, 1) then
        v_vencimento := interno.vencimento_anual(p_exercicio);
      else
        v_valor := round(v_valor * v_meses / 12.0, 2);
      end if;
      update public.cobrancas c
      set situacao = 'cancelada', cancelada_como = 'plano', observacao = 'Plano trocado para anual.'
      where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo = 'mensal' and c.situacao = 'aberta'
        and c.arquivado_em is null and c.competencia >= v_desde
        and not exists (select 1 from public.informes_pagamento i where i.cobranca_id = c.id and i.situacao = 'pendente');
      insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor, observacao)
      values (p_pessoa_id, p_exercicio, 'anual', v_competencia, v_vencimento, v_categoria, v_valor,
              case when v_meses < 12 then 'Anual proporcional: ' || v_meses || ' meses (até março).' end);
    else
      select * into v_anual from public.cobrancas
      where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo = 'anual' and situacao <> 'cancelada'
        and arquivado_em is null
      order by competencia desc limit 1;
      if found then
        if v_anual.situacao = 'paga' then
          raise exception 'O anual deste exercício já está pago: não há o que trocar.' using errcode = 'P0001';
        end if;
        if exists (select 1 from public.informes_pagamento i where i.cobranca_id = v_anual.id and i.situacao = 'pendente') then
          raise exception 'O anual tem pagamento informado, aguardando a tesouraria.' using errcode = 'P0001';
        end if;
        update public.cobrancas
        set situacao = 'cancelada', cancelada_como = 'plano', observacao = 'Plano trocado para mensal.'
        where id = v_anual.id;
      end if;
    end if;
  end if;

  update public.planos_contribuicao set arquivado_em = now()
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  insert into public.planos_contribuicao (pessoa_id, exercicio, tipo) values (p_pessoa_id, p_exercicio, p_tipo);

  if p_tipo = 'mensal' and exists (
    select 1 from public.cobrancas where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo in ('mensal', 'anual')
  ) then
    perform interno.gerar_cobrancas_pessoa(p_pessoa_id, p_exercicio);
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Desligamento: só a conduta (II) vai à votação; I, III, IV e V a diretoria homologa
-- ---------------------------------------------------------------------
alter table public.desligamentos drop constraint desligamentos_origem;
alter table public.desligamentos add constraint desligamentos_origem check ((inciso = 'II') = (deliberacao_id is not null));
comment on table public.desligamentos is
  'Art. 8º: II conduta (votação de 3/5 na AGO). I a pedido, III transferência, IV faltas seguidas e V falecimento: '
  'homologados e registrados pela diretoria (14/11/2026).';
comment on column public.desligamentos.observacao is 'O documento (carta, ofício da denominação…) ou a observação.';

create function interno.registrar_desligamento(p_pessoa_id uuid, p_inciso text, p_data date, p_observacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_associado public.associados;
  v_config public.config_assembleias;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram o desligamento.' using errcode = '42501';
  end if;
  if interno.tem_poder_de_direcao(p_pessoa_id) and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Esta pessoa tem cargo ou perfil da diretoria: o registro é da presidência.' using errcode = '42501';
  end if;
  if p_pessoa_id = (select interno.minha_pessoa_id()) then
    raise exception 'Ninguém registra o próprio desligamento: peça a outra pessoa da diretoria.' using errcode = '42501';
  end if;
  if p_inciso is null or p_inciso not in ('I', 'III', 'IV', 'V') then
    raise exception 'A conduta (II) vai à votação da Assembleia Ordinária, por 3/5. Aqui se registram os incisos I, III, IV e V.'
      using errcode = 'P0001';
  end if;
  select * into v_associado from public.associados
  where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo' for update;
  if not found then
    raise exception 'Associado ativo não encontrado.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data (não pode ser no futuro).' using errcode = 'P0001';
  end if;
  if p_inciso in ('I', 'III') and coalesce(trim(p_observacao), '') = '' then
    raise exception 'Informe o documento (a carta do associado ou o ofício da denominação).' using errcode = 'P0001';
  end if;
  if p_inciso = 'IV' then
    select * into v_config from public.config_assembleias where id;
    if interno.faltas_seguidas(p_pessoa_id) < v_config.faltas_pauta then
      raise exception 'Pelo inciso IV, o associado precisa ter % faltas seguidas às assembleias, sem justificativa aceita.',
        v_config.faltas_pauta using errcode = 'P0001';
    end if;
  end if;
  insert into public.desligamentos (associado_id, inciso, data, observacao)
  values (v_associado.id, p_inciso, p_data, nullif(trim(p_observacao), ''));
  update public.associados set situacao = case when p_inciso = 'V' then 'falecido' else 'desligado' end::public.situacao_associado
  where id = v_associado.id;
end;
$$;

create function public.registrar_desligamento(p_pessoa_id uuid, p_inciso text, p_data date, p_observacao text)
returns void language sql security invoker set search_path = '' as $$
  select interno.registrar_desligamento(p_pessoa_id, p_inciso, p_data, p_observacao);
$$;
revoke all on function interno.registrar_desligamento(uuid, text, date, text) from public;
grant execute on function interno.registrar_desligamento(uuid, text, date, text) to authenticated;
revoke all on function public.registrar_desligamento(uuid, text, date, text) from public, anon;
grant execute on function public.registrar_desligamento(uuid, text, date, text) to authenticated;

-- o falecimento é o inciso V
create or replace function interno.registrar_falecimento(p_pessoa_id uuid, p_data date, p_observacao text)
returns void
language sql
security definer
set search_path = ''
as $$ select interno.registrar_desligamento(p_pessoa_id, 'V', p_data, p_observacao); $$;

-- As faltas seguidas contam só nas assembleias (AGO e AGE) — pergunta 22
create or replace function interno.faltas_seguidas(p_pessoa_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde date;
  v_encontro record;
  v_faltas integer := 0;
begin
  -- conta a partir da admissão, mas nunca antes de o associado entrar no sistema (antes não havia como marcar)
  select greatest(coalesce(a.admitido_em, '-infinity'::date), (a.criado_em at time zone 'America/Belem')::date) into v_desde
  from public.associados a where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found then
    return 0;
  end if;
  for v_encontro in
    select e.id
    from public.encontros e
    where e.tipo in ('ago', 'age') and e.situacao = 'realizado' and e.arquivado_em is null
      and (e.inicio at time zone 'America/Belem')::date >= v_desde
    order by e.inicio desc
  loop
    exit when exists (
      select 1 from public.encontro_presencas p
      where p.encontro_id = v_encontro.id and p.pessoa_id = p_pessoa_id and p.presente_em is not null and p.arquivado_em is null
    ) or exists (
      select 1 from public.justificativas_falta j
      where j.encontro_id = v_encontro.id and j.pessoa_id = p_pessoa_id and j.situacao = 'aceita' and j.arquivado_em is null
    );
    v_faltas := v_faltas + 1;
  end loop;
  return v_faltas;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Jubilação: item da pauta da assembleia (AGO ou AGE), com o documento da denominação
-- ---------------------------------------------------------------------
alter table public.encontro_pauta add column jubilacao_pessoa_id uuid references public.pessoas (id);
alter table public.encontro_pauta add constraint encontro_pauta_um_alvo
  check (desligamento_pessoa_id is null or jubilacao_pessoa_id is null);
create index encontro_pauta_jubilacao on public.encontro_pauta (jubilacao_pessoa_id);
comment on column public.encontro_pauta.jubilacao_pessoa_id is
  'Item de jubilação: o associado (com o documento da denominação na descrição). Aprovado, ele fica jubilado (14/11/2026).';

-- a secretaria não marca mais o jubilado na ficha: só a assembleia (ou o cadastro de quem já era jubilado)
revoke update (jubilado) on public.associados from authenticated;

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
  v_jubilar uuid;
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
    v_jubilar := nullif(v_item ->> 'jubilacao_pessoa_id', '')::uuid;
    if v_alvo is not null and v_jubilar is not null then
      raise exception 'Um item é de desligamento ou de jubilação, não dos dois.' using errcode = 'P0001';
    end if;
    if v_alvo is not null then
      if v_tipo <> 'ago' or not v_deliberativo or v_maioria <> 'tres_quintos' then
        raise exception 'Desligamento por conduta (Art. 8º, II) é item de votação da Assembleia Ordinária, por 3/5.' using errcode = 'P0001';
      end if;
      if not interno.associado_ativo(v_alvo) then
        raise exception 'O desligamento é de um associado ativo.' using errcode = 'P0001';
      end if;
    end if;
    if v_jubilar is not null then
      if v_tipo = 'reuniao_mensal' or not v_deliberativo then
        raise exception 'A jubilação é item de votação da assembleia (AGO ou AGE).' using errcode = 'P0001';
      end if;
      if not interno.associado_ativo(v_jubilar) then
        raise exception 'A jubilação é de um associado ativo.' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.associados a where a.pessoa_id = v_jubilar and a.arquivado_em is null and a.jubilado) then
        raise exception 'Este associado já é jubilado.' using errcode = 'P0001';
      end if;
      if coalesce(trim(v_item ->> 'descricao'), '') = '' then
        raise exception 'Na jubilação, descreva o documento da denominação (na descrição do item).' using errcode = 'P0001';
      end if;
    end if;
    insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria, desligamento_pessoa_id, jubilacao_pessoa_id)
    values (v_id, v_ordem, trim(v_item ->> 'titulo'), nullif(trim(v_item ->> 'descricao'), ''), v_deliberativo, v_maioria, v_alvo, v_jubilar);
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
  if found and v_anterior.aprovada and (v_anterior.desligamento_pessoa_id is not null or v_item.jubilacao_pessoa_id is not null) then
    raise exception 'Esta votação já desligou ou jubilou um associado e não pode ser refeita aqui.' using errcode = 'P0001';
  end if;

  v_votantes := (interno.contagem_quorum(v_encontro.id) ->> 'presentes_aptos')::integer;
  if p_a_favor + p_contra + p_abstencoes > v_votantes then
    raise exception 'São % votos, mas só % presentes em dia podem votar.', p_a_favor + p_contra + p_abstencoes, v_votantes
      using errcode = 'P0001';
  end if;

  -- o desligamento é o do associado indicado no item da pauta (desde a convocação), só pela conduta (II)
  if p_desligamento_pessoa_id is distinct from v_item.desligamento_pessoa_id then
    raise exception 'O desligamento é o do associado indicado na pauta da convocação.' using errcode = 'P0001';
  end if;
  if v_item.desligamento_pessoa_id is not null then
    if p_desligamento_inciso is distinct from 'II' then
      raise exception 'Só a conduta (Art. 8º, II) vai à votação. Os incisos I, III, IV e V são homologados pela diretoria, na ficha do associado.'
        using errcode = 'P0001';
    end if;
    select * into v_associado from public.associados
    where pessoa_id = v_item.desligamento_pessoa_id and arquivado_em is null and situacao = 'ativo';
    if not found then
      raise exception 'Associado ativo não encontrado.' using errcode = 'P0001';
    end if;
  elsif p_desligamento_inciso is not null then
    raise exception 'Este item não é de desligamento.' using errcode = 'P0001';
  end if;
  if v_item.jubilacao_pessoa_id is not null and not interno.associado_ativo(v_item.jubilacao_pessoa_id) then
    raise exception 'A jubilação é de um associado ativo.' using errcode = 'P0001';
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
  if v_item.jubilacao_pessoa_id is not null and v_aprovada then
    update public.associados set jubilado = true
    where pessoa_id = v_item.jubilacao_pessoa_id and arquivado_em is null and situacao = 'ativo';
  end if;

  return jsonb_build_object('id', v_id, 'aprovada', v_aprovada, 'votantes', v_votantes);
end;
$$;
