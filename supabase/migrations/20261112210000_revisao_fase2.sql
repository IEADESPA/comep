-- =====================================================================
-- REVISÃO GERAL DA FASE 2 — correções dos achados da revisão independente
-- (docs/revisoes/fase-2.md, seção "Revisão geral da Fase 2").
--
--   1. Período fechado de verdade: nada com data até o fim do último exercício fechado muda
--      (lançamentos, saldos iniciais, contas) — não só o próprio exercício.
--   2. Contas só pelas funções (antes, a tesouraria gravava direto na tabela).
--   3. Lançamento com data anterior ao início da conta é recusado (antes, era aceito e sumia do saldo).
--   4. Ninguém cancela a própria cobrança.
--   5. O Conselho Fiscal é protegido como a diretoria (código de acesso) e é independente dela:
--      não acumula perfil da diretoria, e quem analisou não dá o parecer. Ninguém dá perfil a si mesmo.
--   6. Plano anual + taxa de inscrição: a taxa não impede a anuidade de ser gerada.
--   7. Pagamento registrado precisa ter valor; diferença do valor da cobrança precisa de explicação.
--   8. Cobrança cancelada pela tesouraria não volta ao gerar de novo (só as canceladas por troca de plano).
--   9. Taxa de inscrição com a categoria certa (gerada depois do vínculo com a igreja).
--  10. Jubilado: as cobranças em aberto do mês em diante são canceladas sozinhas (isento).
--  11. Fuso horário do banco: America/Belem (antes, o "hoje" do banco virava às 21h).
--  12. Fechamento do exercício e lançamentos simultâneos não se atropelam.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 11. Fuso horário: o "hoje" do banco é o de Parauapebas
-- ---------------------------------------------------------------------
do $$
begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Belem');
end
$$;


-- ---------------------------------------------------------------------
-- 8. Como a cobrança foi cancelada
-- ---------------------------------------------------------------------
alter table public.cobrancas
  add column cancelada_como text check (cancelada_como in ('manual', 'plano', 'jubilado'));
comment on column public.cobrancas.cancelada_como is
  'manual = pela tesouraria (não volta ao gerar de novo); plano = troca de plano; jubilado = isenção do jubilado.';
update public.cobrancas
set cancelada_como = case when observacao like 'Plano trocado%' then 'plano' else 'manual' end
where situacao = 'cancelada' and cancelada_como is null;


-- ---------------------------------------------------------------------
-- 1. Período fechado: até o fim do último exercício com balanço fechado (e não devolvido)
-- ---------------------------------------------------------------------
create function interno.fim_periodo_fechado()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(make_date(exercicio + 1, 3, 31))
  from public.balancos
  where arquivado_em is null and situacao <> 'devolvido';
$$;

-- Data de um pagamento de contribuição: depois do período fechado e não antes do início das contas
create function interno.conferir_data_pagamento(p_data date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite date := interno.fim_periodo_fechado();
  v_inicio date;
begin
  if v_limite is not null and p_data <= v_limite then
    raise exception 'O período até % já foi fechado na prestação de contas. Use a data em que o dinheiro entrou agora (por exemplo, hoje).',
      to_char(v_limite, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  select min(c.saldo_inicial_em) into v_inicio
  from public.config_financeiro f
  join public.contas_financeiras c on c.id in (f.conta_dinheiro_id, f.conta_banco_id)
  where f.id;
  if v_inicio is not null and p_data < v_inicio then
    raise exception 'A data do pagamento não pode ser anterior ao início das contas do COMEP no sistema (%).',
      to_char(v_inicio, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
end;
$$;

-- Lançamentos: período fechado (1), data antes do início da conta (3) e fechamento simultâneo (12)
create or replace function interno.bloquear_exercicio_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite date;
  v_inicio date;
  v_conta  text;
begin
  -- Se um fechamento estiver gravando, espera ele terminar (e então enxerga o período fechado)
  perform pg_advisory_xact_lock_shared(hashtext('comep: fechamento do exercício'));
  v_limite := interno.fim_periodo_fechado();
  if v_limite is not null and (new.data <= v_limite or (tg_op = 'UPDATE' and old.data <= v_limite)) then
    raise exception 'O período até % está fechado para a prestação de contas: os lançamentos dele não mudam mais.',
      to_char(v_limite, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' or new.data is distinct from old.data or new.conta_id is distinct from old.conta_id then
    select saldo_inicial_em, nome into v_inicio, v_conta from public.contas_financeiras where id = new.conta_id;
    if new.data < v_inicio then
      raise exception 'A data (%) é anterior ao início da conta "%" no sistema (%).',
        to_char(new.data, 'DD/MM/YYYY'), v_conta, to_char(v_inicio, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Contas só pelas funções
-- ---------------------------------------------------------------------
revoke insert, update on public.contas_financeiras from authenticated;
drop policy "contas: tesouraria e presidência cadastram" on public.contas_financeiras;
drop policy "contas: tesouraria e presidência alteram" on public.contas_financeiras;

create function interno.criar_conta(p_nome text, p_tipo public.tipo_conta, p_saldo_inicial numeric, p_saldo_inicial_em date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite date := interno.fim_periodo_fechado();
  v_id uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência criam contas.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' or p_tipo is null then
    raise exception 'Informe o nome e o tipo da conta.' using errcode = 'P0001';
  end if;
  if p_saldo_inicial is null or p_saldo_inicial_em is null or p_saldo_inicial_em > current_date then
    raise exception 'Informe o saldo inicial (pode ser zero) e a data dele (não futura).' using errcode = 'P0001';
  end if;
  if v_limite is not null and p_saldo_inicial_em <= v_limite then
    raise exception 'A data do saldo inicial cai num período já fechado na prestação de contas (até %). Use uma data depois disso.',
      to_char(v_limite, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  insert into public.contas_financeiras (nome, tipo, saldo_inicial, saldo_inicial_em)
  values (trim(p_nome), p_tipo, round(p_saldo_inicial, 2), p_saldo_inicial_em)
  returning id into v_id;
  return v_id;
end;
$$;

create function interno.alterar_conta(p_conta_id uuid, p_nome text, p_saldo_inicial numeric, p_saldo_inicial_em date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conta    public.contas_financeiras;
  v_limite   date := interno.fim_periodo_fechado();
  v_primeiro date;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência alteram contas.' using errcode = '42501';
  end if;
  select * into v_conta from public.contas_financeiras where id = p_conta_id and arquivado_em is null for update;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome da conta.' using errcode = 'P0001';
  end if;
  if p_saldo_inicial is null or p_saldo_inicial_em is null or p_saldo_inicial_em > current_date then
    raise exception 'Informe o saldo inicial (pode ser zero) e a data dele (não futura).' using errcode = 'P0001';
  end if;
  if (round(p_saldo_inicial, 2), p_saldo_inicial_em) is distinct from (v_conta.saldo_inicial, v_conta.saldo_inicial_em) then
    if v_limite is not null and least(p_saldo_inicial_em, v_conta.saldo_inicial_em) <= v_limite then
      raise exception 'O saldo inicial desta conta faz parte de um período já fechado na prestação de contas (até %): não muda mais.',
        to_char(v_limite, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    select min(data) into v_primeiro from public.lancamentos where conta_id = p_conta_id and arquivado_em is null;
    if v_primeiro is not null and v_primeiro < p_saldo_inicial_em then
      raise exception 'Esta conta tem lançamentos desde %: a data do saldo inicial não pode ficar depois deles.',
        to_char(v_primeiro, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
  end if;
  update public.contas_financeiras
  set nome = trim(p_nome), saldo_inicial = round(p_saldo_inicial, 2), saldo_inicial_em = p_saldo_inicial_em
  where id = p_conta_id;
end;
$$;

create function public.criar_conta(p_nome text, p_tipo public.tipo_conta, p_saldo_inicial numeric, p_saldo_inicial_em date)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.criar_conta(p_nome, p_tipo, p_saldo_inicial, p_saldo_inicial_em);
$$;
create function public.alterar_conta(p_conta_id uuid, p_nome text, p_saldo_inicial numeric, p_saldo_inicial_em date)
returns void language sql security invoker set search_path = '' as $$
  select interno.alterar_conta(p_conta_id, p_nome, p_saldo_inicial, p_saldo_inicial_em);
$$;


-- ---------------------------------------------------------------------
-- 4. Ninguém cancela a própria cobrança; o cancelamento da tesouraria é "manual"
-- ---------------------------------------------------------------------
create or replace function interno.cancelar_cobranca(p_cobranca_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_pessoa uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência cancelam cobranças.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  select pessoa_id into v_pessoa from public.cobrancas where id = p_cobranca_id for update;
  if v_pessoa = v_eu then
    raise exception 'Ninguém cancela a própria cobrança: outra pessoa da tesouraria ou da presidência precisa fazer isso.'
      using errcode = '42501';
  end if;
  update public.cobrancas set situacao = 'cancelada', cancelada_como = 'manual', observacao = trim(p_motivo)
  where id = p_cobranca_id and situacao = 'aberta';
  if not found then
    raise exception 'Só cobrança em aberto pode ser cancelada.' using errcode = 'P0001';
  end if;
  update public.informes_pagamento set situacao = 'cancelado', motivo_recusa = 'Cobrança cancelada: ' || trim(p_motivo)
  where cobranca_id = p_cobranca_id and situacao = 'pendente';
end;
$$;


-- ---------------------------------------------------------------------
-- Funções ajustadas (texto atual + as correções 1, 5, 6, 7, 8 e 12)
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

  if coalesce(v_plano, 'mensal') = 'anual' and v_primeiro = v_inicio then
    v_valor := interno.valor_vigente(v_assoc.categoria_contribuicao, 'anual', v_inicio);
    if v_valor is not null and not exists (
      select 1 from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo in ('mensal', 'anual')
        and (c.situacao <> 'cancelada' or (c.tipo = 'anual' and c.cancelada_como = 'manual'))
        and c.arquivado_em is null
    ) then
      insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
      values (p_pessoa_id, p_exercicio, 'anual', v_inicio, make_date(p_exercicio, 4, v_config.dia_vencimento_anual),
              v_assoc.categoria_contribuicao, v_valor);
      v_criadas := 1;
    end if;
    return v_criadas;
  end if;

  -- Mensal (também para quem escolheu anual mas entrou depois de abril)
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

create or replace function interno.escolher_plano(p_pessoa_id uuid, p_exercicio integer, p_tipo public.tipo_valor)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo not in ('mensal', 'anual') then
    raise exception 'Escolha mensal ou anual.' using errcode = 'P0001';
  end if;
  if not (p_pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia'))) then
    raise exception 'Só o próprio associado ou a tesouraria escolhem o plano.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.associados where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo'
  ) then
    raise exception 'Só associado ativo tem plano de contribuição.' using errcode = 'P0001';
  end if;
  if p_tipo = 'anual' and exists (
    select 1 from public.associados
    where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo'
      and admitido_em >= make_date(p_exercicio, 5, 1)
  ) then
    raise exception 'Quem foi admitido depois de abril paga por mês neste exercício (a anuidade vence em abril).' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.cobrancas
    where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo in ('mensal', 'anual')
      and situacao = 'paga' and arquivado_em is null
  ) or exists (
    select 1 from public.informes_pagamento i join public.cobrancas c on c.id = i.cobranca_id
    where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo in ('mensal', 'anual')
      and i.situacao = 'pendente'
  ) then
    raise exception 'Já há pagamento neste exercício: o plano não muda mais até março. Fale com a tesouraria.' using errcode = 'P0001';
  end if;

  update public.planos_contribuicao set arquivado_em = now()
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  insert into public.planos_contribuicao (pessoa_id, exercicio, tipo) values (p_pessoa_id, p_exercicio, p_tipo);

  -- Cobranças em aberto do outro plano saem; as do plano novo entram (se o exercício já foi gerado)
  if exists (
    select 1 from public.cobrancas where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo in ('mensal', 'anual')
  ) then
    update public.cobrancas
    set situacao = 'cancelada', cancelada_como = 'plano', observacao = 'Plano trocado para ' || p_tipo::text || '.'
    where pessoa_id = p_pessoa_id and exercicio = p_exercicio and situacao = 'aberta'
      and tipo in ('mensal', 'anual') and tipo <> p_tipo;
    perform interno.gerar_cobrancas_pessoa(p_pessoa_id, p_exercicio);
  end if;
end;
$$;

create or replace function interno.informar_pagamento(
  p_cobrancas   uuid[],
  p_data        date,
  p_forma       text,
  p_comprovante text,
  p_observacao  text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_cobranca public.cobrancas;
  v_criados integer := 0;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para informar o pagamento.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_cobrancas, 1), 0) = 0 then
    raise exception 'Escolha qual mensalidade (ou anuidade) você pagou.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data do pagamento (não pode ser futura).' using errcode = 'P0001';
  end if;
  perform interno.conferir_data_pagamento(p_data);
  if coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe a forma de pagamento (PIX, depósito, dinheiro…).' using errcode = 'P0001';
  end if;
  if p_comprovante is not null and not interno.caminho_seguro(p_comprovante, v_eu) then
    raise exception 'O comprovante precisa ser um arquivo enviado por você.' using errcode = 'P0001';
  end if;

  for v_cobranca in select * from public.cobrancas where id = any (p_cobrancas) for update loop
    if v_cobranca.pessoa_id <> v_eu then
      raise exception 'Só se informa pagamento das próprias contribuições.' using errcode = '42501';
    end if;
    if v_cobranca.situacao <> 'aberta' then
      raise exception 'Uma das contribuições escolhidas já está paga ou cancelada.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.informes_pagamento where cobranca_id = v_cobranca.id and situacao = 'pendente') then
      raise exception 'Uma das contribuições escolhidas já tem pagamento informado, aguardando a tesouraria.' using errcode = 'P0001';
    end if;
    insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma, comprovante_caminho, observacao)
    values (v_cobranca.id, v_eu, p_data, v_cobranca.valor, trim(p_forma), p_comprovante, nullif(trim(p_observacao), ''));
    v_criados := v_criados + 1;
  end loop;
  if v_criados <> array_length(p_cobrancas, 1) then
    raise exception 'Contribuição não encontrada.' using errcode = 'P0001';
  end if;
  return v_criados;
end;
$$;

create or replace function interno.registrar_pagamento(p_cobranca_id uuid, p_data date, p_valor numeric, p_forma text, p_observacao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_cobranca public.cobrancas;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram pagamentos.' using errcode = '42501';
  end if;
  select * into v_cobranca from public.cobrancas where id = p_cobranca_id for update;
  if not found or v_cobranca.situacao <> 'aberta' then
    raise exception 'Esta contribuição não está em aberto.' using errcode = 'P0001';
  end if;
  if v_cobranca.pessoa_id = v_eu then
    raise exception 'Ninguém registra o próprio pagamento: outra pessoa da tesouraria ou da presidência precisa fazer isso.'
      using errcode = '42501';
  end if;
  if p_data is null or p_data > current_date or coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe a data (não futura) e a forma do pagamento.' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor recebido precisa ser maior que zero. Para dispensar a contribuição, cancele a cobrança, com o motivo.'
      using errcode = 'P0001';
  end if;
  if p_valor <> v_cobranca.valor and coalesce(trim(p_observacao), '') = '' then
    raise exception 'O valor recebido é diferente do valor da contribuição: explique a diferença na observação.' using errcode = 'P0001';
  end if;
  perform interno.conferir_data_pagamento(p_data);
  update public.cobrancas
  set situacao = 'paga', pago_em = p_data, valor_pago = p_valor, forma_pagamento = trim(p_forma),
      confirmado_por = v_eu, confirmado_em = now(), observacao = nullif(trim(p_observacao), '')
  where id = p_cobranca_id;
  -- Algum aviso do próprio associado sobre esta cobrança deixa de valer
  update public.informes_pagamento
  set situacao = 'cancelado', analisado_por = v_eu, analisado_em = now(), motivo_recusa = 'Pagamento registrado direto pela tesouraria.'
  where cobranca_id = p_cobranca_id and situacao = 'pendente';
end;
$$;

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

  if exists (
    select 1 from public.perfis_acesso pa
    where pa.pessoa_id = p_pessoa_id
      and pa.arquivado_em is null
      and pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'admin_tecnico', 'conselho_fiscal')
  ) and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Esta pessoa tem perfil da diretoria ou do Conselho Fiscal: só a presidência gera o código de acesso dela.' using errcode = '42501';
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

create or replace function interno.fechar_balanco(p_exercicio integer, p_nota text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
  v_resumo jsonb;
  v_id uuid;
  v_existe boolean;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria (ou a presidência) fecha o exercício.' using errcode = '42501';
  end if;
  -- Espera os lançamentos em andamento terminarem (e segura os novos até o fechamento gravar)
  perform pg_advisory_xact_lock(hashtext('comep: fechamento do exercício'));
  if make_date(p_exercicio + 1, 3, 31) >= current_date then
    raise exception 'O exercício %/% ainda não terminou (vai até 31/03/%).', p_exercicio, p_exercicio + 1, p_exercicio + 1
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.lancamentos
    where situacao = 'aguardando_autorizacao' and arquivado_em is null
      and data between make_date(p_exercicio, 4, 1) and make_date(p_exercicio + 1, 3, 31)
  ) then
    raise exception 'Há despesas deste exercício aguardando a autorização do presidente. Resolva antes de fechar.'
      using errcode = 'P0001';
  end if;

  select * into v_balanco from public.balancos where exercicio = p_exercicio and arquivado_em is null for update;
  v_existe := found;
  if v_existe and v_balanco.situacao <> 'devolvido' then
    raise exception 'O balanço de %/% já foi fechado e está em andamento.', p_exercicio, p_exercicio + 1 using errcode = 'P0001';
  end if;

  v_resumo := interno.resumo_exercicio(p_exercicio);
  if v_existe then
    update public.balancos
    set situacao = 'analise_diretoria', resumo = v_resumo, nota_tesouraria = nullif(trim(p_nota), ''),
        fechado_por = (select interno.minha_pessoa_id()), fechado_em = now(),
        analise_diretoria = null, analisado_por = null, analisado_em = null,
        parecer = null, parecer_texto = null, parecer_por = null, parecer_em = null,
        assembleia_data = null, assembleia_ata = null, aprovado_assembleia = null, assembleia_registrada_por = null,
        motivo_devolucao = null
    where id = v_balanco.id;
    v_id := v_balanco.id;
    perform interno.evento_balanco(v_id, 'Refeito pela tesouraria e reenviado à diretoria', p_nota);
  else
    insert into public.balancos (exercicio, resumo, nota_tesouraria, fechado_por, fechado_em)
    values (p_exercicio, v_resumo, nullif(trim(p_nota), ''), (select interno.minha_pessoa_id()), now())
    returning id into v_id;
    perform interno.evento_balanco(v_id, 'Fechado pela tesouraria e enviado à diretoria', p_nota);
  end if;
  return v_id;
end;
$$;

create or replace function interno.parecer_balanco(p_balanco_id uuid, p_parecer public.tipo_parecer, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
begin
  if not (select interno.tenho_perfil('conselho_fiscal')) then
    raise exception 'Só o Conselho Fiscal dá o parecer sobre as contas (Art. 14).' using errcode = '42501';
  end if;
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null for update;
  if not found or v_balanco.situacao <> 'aguardando_parecer' then
    raise exception 'Este balanço não está aguardando o parecer do Conselho Fiscal.' using errcode = 'P0001';
  end if;
  if v_balanco.fechado_por = (select interno.minha_pessoa_id()) then
    raise exception 'Quem fechou o balanço não dá o parecer sobre ele.' using errcode = '42501';
  end if;
  if v_balanco.analisado_por = (select interno.minha_pessoa_id())
     or (select interno.tenho_perfil('presidencia', 'tesouraria', 'secretaria')) then
    raise exception 'O parecer é do Conselho Fiscal, independente da diretoria: quem é da diretoria ou registrou a análise não dá o parecer.'
      using errcode = '42501';
  end if;
  if p_parecer is null or coalesce(trim(p_texto), '') = '' then
    raise exception 'Escolha o parecer e escreva o texto.' using errcode = 'P0001';
  end if;
  update public.balancos
  set situacao = 'aguardando_assembleia', parecer = p_parecer, parecer_texto = trim(p_texto),
      parecer_por = (select interno.minha_pessoa_id()), parecer_em = now()
  where id = p_balanco_id;
  perform interno.evento_balanco(p_balanco_id,
    'Parecer do Conselho Fiscal: ' || case p_parecer when 'favoravel' then 'favorável'
                                                     when 'favoravel_com_ressalvas' then 'favorável com ressalvas'
                                                     else 'desfavorável' end,
    p_texto);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Perfis: ninguém dá perfil a si mesmo; Conselho Fiscal independente da diretoria
-- ---------------------------------------------------------------------
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
  if (new.perfil = 'conselho_fiscal' and exists (
        select 1 from public.perfis_acesso pa
        where pa.pessoa_id = new.pessoa_id and pa.arquivado_em is null and pa.perfil in ('secretaria', 'tesouraria', 'presidencia')
      ))
     or (new.perfil in ('secretaria', 'tesouraria', 'presidencia') and exists (
        select 1 from public.perfis_acesso pa
        where pa.pessoa_id = new.pessoa_id and pa.arquivado_em is null and pa.perfil = 'conselho_fiscal'
      )) then
    raise exception 'O Conselho Fiscal fiscaliza a diretoria: a mesma pessoa não pode ter perfil da diretoria (presidência, secretaria ou tesouraria) e do Conselho Fiscal.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 9. Taxa de inscrição gerada no fim da transação (depois do vínculo com a igreja)
-- ---------------------------------------------------------------------
drop trigger taxa_inscricao_na_admissao on public.associados;
create constraint trigger taxa_inscricao_na_admissao
  after insert on public.associados
  deferrable initially deferred
  for each row execute function interno.taxa_inscricao_na_admissao();


-- ---------------------------------------------------------------------
-- 10. Jubilado: isento das cobranças em aberto do mês em diante
-- ---------------------------------------------------------------------
create function interno.isentar_jubilado(p_pessoa_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.informes_pagamento
  set situacao = 'cancelado', motivo_recusa = 'Cobrança cancelada: associado jubilado (isento).'
  where situacao = 'pendente' and cobranca_id in (
    select id from public.cobrancas
    where pessoa_id = p_pessoa_id and situacao = 'aberta' and competencia >= date_trunc('month', current_date)::date
      and arquivado_em is null
  );
  update public.cobrancas
  set situacao = 'cancelada', cancelada_como = 'jubilado',
      observacao = 'Isento: jubilado desde ' || to_char(current_date, 'DD/MM/YYYY') || '.'
  where pessoa_id = p_pessoa_id and situacao = 'aberta' and competencia >= date_trunc('month', current_date)::date
    and arquivado_em is null;
$$;

create function interno.jubilado_isento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.jubilado and not old.jubilado then
    perform interno.isentar_jubilado(new.pessoa_id);
  end if;
  return null;
end;
$$;
create trigger jubilado_isento
  after update of jubilado on public.associados
  for each row execute function interno.jubilado_isento();

-- Quem já é jubilado hoje
select interno.isentar_jubilado(pessoa_id)
from public.associados
where jubilado and arquivado_em is null;


-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on function interno.fim_periodo_fechado() from public;
revoke all on function interno.conferir_data_pagamento(date) from public;
revoke all on function interno.isentar_jubilado(uuid) from public;
revoke all on function interno.jubilado_isento() from public;
revoke all on function interno.criar_conta(text, public.tipo_conta, numeric, date) from public;
revoke all on function interno.alterar_conta(uuid, text, numeric, date) from public;
grant execute on function interno.criar_conta(text, public.tipo_conta, numeric, date) to authenticated;
grant execute on function interno.alterar_conta(uuid, text, numeric, date) to authenticated;
revoke all on function public.criar_conta(text, public.tipo_conta, numeric, date) from public, anon;
revoke all on function public.alterar_conta(uuid, text, numeric, date) from public, anon;
grant execute on function public.criar_conta(text, public.tipo_conta, numeric, date) to authenticated;
grant execute on function public.alterar_conta(uuid, text, numeric, date) to authenticated;
