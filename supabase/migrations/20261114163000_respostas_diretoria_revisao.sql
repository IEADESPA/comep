-- =====================================================================
-- ENTREGA 4.5 — CORREÇÕES DA REVISÃO (14/11/2026)
--
-- Um revisor independente leu a migração 20261114160000_respostas_diretoria.sql e provou:
--   1. Diminuir o Conselho Fiscal nas configurações travava a renúncia, o desligamento e o falecimento de quem
--      já estava no cargo (a vaga era recontada ao encerrar o mandato).
--   2. O jubilado ainda podia ser marcado (ou desmarcado) sem a assembleia: arquivando o cadastro e inserindo de novo.
--   3. Na assembleia, o pagamento informado durante a própria reunião contava (a regra é: pago antes de começar).
--   4. A troca de plano e um pagamento (ou a geração das cobranças) ao mesmo tempo podiam cobrar duas vezes.
--   5. A troca de plano olhava também informes arquivados.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Encerrar um mandato não reconta as vagas
-- ---------------------------------------------------------------------
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
  -- encurtar um mandato (renúncia, desligamento, engano) nunca cria conflito: não reconta as vagas, que podem ter
  -- diminuído nas configurações depois da posse
  if tg_op = 'UPDATE' and new.pessoa_id = old.pessoa_id and new.cargo = old.cargo and new.inicio >= old.inicio
     and v_fim <= interno.fim_efetivo(old) then
    return new;
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


-- ---------------------------------------------------------------------
-- 2. Jubilado: só pela assembleia (nem arquivando e cadastrando de novo)
-- ---------------------------------------------------------------------
-- o cadastro inicial (pessoa nova, que já era jubilada antes do sistema) continua marcando; o gatilho abaixo
-- impede mudar a jubilação de quem já tem cadastro

create or replace function interno.proteger_associado()
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
    -- cadastrar de novo não muda a jubilação: ela só muda pela assembleia (14/11/2026)
    if exists (
      select 1 from public.associados a where a.pessoa_id = new.pessoa_id and a.situacao = 'ativo' and a.jubilado is distinct from new.jubilado
    ) then
      raise exception 'A jubilação só muda pela assembleia (item da pauta), não pelo cadastro.' using errcode = 'P0001';
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


-- ---------------------------------------------------------------------
-- 3. Na assembleia: o informe conta se foi enviado antes de ela começar (e até o vencimento)
-- ---------------------------------------------------------------------
create function interno.em_dia_no_encontro(p_pessoa_id uuid, p_encontro_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz;
begin
  select e.inicio into v_inicio from public.encontros e where e.id = p_encontro_id;
  if not found then
    return interno.esta_em_dia(p_pessoa_id);
  end if;
  -- vencido até o dia da assembleia, inclusive (o anual vence no dia da AGO — pergunta 19)
  return not exists (
    select 1 from public.cobrancas c
    where c.pessoa_id = p_pessoa_id and c.situacao = 'aberta' and c.arquivado_em is null
      and c.vencimento <= (v_inicio at time zone 'America/Belem')::date
      and not exists (
        select 1 from public.informes_pagamento i
        where i.cobranca_id = c.id and i.situacao = 'pendente' and i.arquivado_em is null
          and (i.criado_em at time zone 'America/Belem')::date <= c.vencimento
          and i.criado_em <= v_inicio
      )
  );
end;
$$;
revoke all on function interno.em_dia_no_encontro(uuid, uuid) from public;

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
      where a.arquivado_em is null and a.situacao = 'ativo' and interno.em_dia_no_encontro(a.pessoa_id, p_encontro_id)
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
        and interno.em_dia_no_encontro(p.pessoa_id, p_encontro_id)
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
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a lista de presença.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pessoa_id', a.pessoa_id,
      'nome', pe.nome,
      'numero_registro', a.numero_registro,
      'em_dia', interno.em_dia_no_encontro(a.pessoa_id, p_encontro_id),
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
    'em_dia', interno.em_dia_no_encontro(v_credencial.pessoa_id, p_encontro_id)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 4 e 5. Troca de plano: trava as cobranças do exercício; gerar usa a mesma trava; informes arquivados não contam
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
  -- a mesma trava da troca de plano: gerar e trocar ao mesmo tempo não duplicam cobranças
  perform pg_advisory_xact_lock(hashtext('comep: plano ' || p_pessoa_id::text));
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
  -- as cobranças do exercício ficam presas até o fim: um pagamento registrado ao mesmo tempo espera e vê a troca
  perform 1 from public.cobrancas where pessoa_id = p_pessoa_id and exercicio = p_exercicio for update;

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
          and (c.situacao = 'paga' or exists (select 1 from public.informes_pagamento i where i.cobranca_id = c.id and i.situacao = 'pendente' and i.arquivado_em is null))
      ) then v_mes else '-infinity'::date end;
      select count(*), min(c.competencia), min(c.vencimento) into v_meses, v_competencia, v_vencimento
      from public.cobrancas c
      where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo = 'mensal' and c.situacao = 'aberta'
        and c.arquivado_em is null and c.competencia >= v_desde
        and not exists (select 1 from public.informes_pagamento i where i.cobranca_id = c.id and i.situacao = 'pendente' and i.arquivado_em is null);
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
        and not exists (select 1 from public.informes_pagamento i where i.cobranca_id = c.id and i.situacao = 'pendente' and i.arquivado_em is null);
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
        if exists (select 1 from public.informes_pagamento i where i.cobranca_id = v_anual.id and i.situacao = 'pendente' and i.arquivado_em is null) then
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

-- a função de antes (o limite por data) não é mais usada
drop function interno.limite_em_dia_do_encontro(uuid);
