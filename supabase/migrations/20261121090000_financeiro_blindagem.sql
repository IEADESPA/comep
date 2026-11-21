-- =====================================================================
-- Telas novas, parte 12 (Fase 5.5): a blindagem do Financeiro (pedido do usuário em 20/11/2026)
--
-- O usuário só aprova o Financeiro BLINDADO: toda entrada e toda saída de qualquer módulo chega sozinha ao caixa,
-- ligada à origem. O que esta migração faz:
--   * UMA função grava no livro-caixa (interno.registrar_lancamento): o banco recusa qualquer outra gravação em
--     public.lancamentos, mesmo de outra função do sistema; e um lançamento gravado não muda (cancela-se e lança-se de novo);
--   * as contribuições, as inscrições dos eventos, as transferências e o lançamento do Caixa passam por ela;
--   * o evento lança a própria despesa (para a autorização do presidente, como as outras, só com o orçamento
--     aprovado) e a própria receita avulsa (patrocínio, oferta);
--   * o modelo exclusivo da credencial é pago com a entrada no caixa (não existe mais "pago sem lançamento"); os que
--     estavam pagos sem a entrada ganham a entrada agora;
--   * item pago num módulo tem sempre o lançamento (restrições no banco);
--   * cancelar o lançamento devolve a origem para "a pagar" (a contribuição, a inscrição, o modelo exclusivo, a compra
--     do patrimônio); cancelar a inscrição paga estorna o lançamento;
--   * o extrato mostra a origem de cada lançamento (vw_lancamentos.origem…), e o "recebido" das contribuições é lido
--     do caixa.
-- Os cursos e os eventos das IGREJAS não passam pelo caixa do COMEP: o dinheiro é da igreja (o COMEP só divulga).
-- Nada se apaga: tudo vai para a auditoria.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. A categoria do sistema para o modelo exclusivo da credencial
-- ---------------------------------------------------------------------
insert into public.categorias_financeiras (nome, tipo, ordem, sistema)
select 'Modelos exclusivos da credencial', 'entrada', 16, 'modelos_exclusivos'
where not exists (select 1 from public.categorias_financeiras where sistema = 'modelos_exclusivos');


-- ---------------------------------------------------------------------
-- 2. A função única que grava no livro-caixa, e a trava
-- ---------------------------------------------------------------------
create function interno.registrar_lancamento(
  p_conta_id         uuid,
  p_tipo             public.tipo_lancamento,
  p_categoria_id     uuid,
  p_data             date,
  p_valor            numeric,
  p_descricao        text,
  p_situacao         public.situacao_lancamento,
  p_comprovante      text default null,
  p_cobranca_id      uuid default null,
  p_evento_id        uuid default null,
  p_transferencia_id uuid default null,
  p_criado_por       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_situacao not in ('efetivado', 'aguardando_autorizacao') then
    raise exception 'Um lançamento novo entra efetivado ou esperando a autorização.' using errcode = 'P0001';
  end if;
  -- só esta função abre a porta (vale até o fim da transação; ela fecha logo depois de gravar)
  perform set_config('comep.lancamento_pela_funcao', 'sim', true);
  insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, comprovante_caminho, cobranca_id,
                                  evento_id, transferencia_id, situacao, criado_por)
  values (p_conta_id, p_tipo, p_categoria_id, p_data, p_valor, trim(p_descricao), p_comprovante, p_cobranca_id,
          p_evento_id, p_transferencia_id, p_situacao, coalesce(p_criado_por, auth.uid()))
  returning id into v_id;
  perform set_config('comep.lancamento_pela_funcao', '', true);
  return v_id;
end;
$$;

create function interno.exigir_funcao_de_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('comep.lancamento_pela_funcao', true), '') <> 'sim' then
    raise exception 'O caixa só recebe lançamentos pela função do sistema: nenhum módulo grava direto no livro-caixa.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger exigir_funcao_de_lancamento
  before insert on public.lancamentos
  for each row execute function interno.exigir_funcao_de_lancamento();

-- Gravado, não muda: o valor, a conta, a data, o tipo, a categoria e a origem ficam como estão. Muda só a situação
-- (autorizar, recusar, cancelar), o motivo, o comprovante que faltava e a ligação ao evento.
create function interno.proteger_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valor is distinct from old.valor or new.conta_id is distinct from old.conta_id or new.data is distinct from old.data
     or new.tipo is distinct from old.tipo or new.categoria_id is distinct from old.categoria_id
     or new.cobranca_id is distinct from old.cobranca_id or new.transferencia_id is distinct from old.transferencia_id
     or new.criado_por is distinct from old.criado_por or new.criado_em is distinct from old.criado_em
     or new.descricao is distinct from old.descricao then
    raise exception 'Um lançamento do caixa não muda: cancele (com o motivo) e lance de novo.' using errcode = 'P0001';
  end if;
  if old.situacao in ('cancelado', 'recusado') and new.situacao is distinct from old.situacao then
    raise exception 'Lançamento cancelado ou recusado não volta: lance de novo.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger proteger_lancamento
  before update on public.lancamentos
  for each row execute function interno.proteger_lancamento();


-- ---------------------------------------------------------------------
-- 3. Os módulos que já lançavam passam pela função única (mesmas regras de antes)
-- ---------------------------------------------------------------------

-- O Caixa (lançar à mão: entrada efetivada; saída esperando o presidente)
create or replace function interno.lancar(
  p_conta_id    uuid,
  p_tipo        public.tipo_lancamento,
  p_categoria   uuid,
  p_data        date,
  p_valor       numeric,
  p_descricao   text,
  p_comprovante text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_categoria public.categorias_financeiras;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência lançam no caixa.' using errcode = '42501';
  end if;
  select * into v_categoria from public.categorias_financeiras where id = p_categoria and arquivado_em is null;
  if not found or v_categoria.tipo <> p_tipo then
    raise exception 'Escolha uma categoria de %.', case p_tipo when 'entrada' then 'entrada' else 'saída' end using errcode = 'P0001';
  end if;
  if v_categoria.sistema is not null then
    raise exception 'Esta categoria é usada automaticamente pelo sistema (contribuições, inscrições, modelos exclusivos e transferências).'
      using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contas_financeiras where id = p_conta_id and arquivado_em is null) then
    raise exception 'Escolha a conta.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'A data do lançamento não pode ser futura.' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'O valor precisa ser maior que zero.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_descricao), '') = '' then
    raise exception 'Descreva o lançamento.' using errcode = 'P0001';
  end if;
  if p_comprovante is not null and not interno.caminho_seguro(p_comprovante, (select interno.minha_pessoa_id())) then
    raise exception 'O comprovante precisa ser um arquivo enviado por você.' using errcode = 'P0001';
  end if;
  return interno.registrar_lancamento(
    p_conta_id, p_tipo, p_categoria, p_data, p_valor, p_descricao,
    case p_tipo when 'saida' then 'aguardando_autorizacao'::public.situacao_lancamento else 'efetivado' end,
    p_comprovante);
end;
$$;

-- A contribuição paga entra no caixa (dinheiro → caixa; o resto → banco), uma vez só
create or replace function interno.contribuicao_no_caixa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.config_financeiro;
  v_nome text;
begin
  if new.situacao = 'paga' and old.situacao is distinct from 'paga' and coalesce(new.valor_pago, 0) > 0
     and not exists (select 1 from public.lancamentos where cobranca_id = new.id and situacao <> 'cancelado') then
    select * into v_config from public.config_financeiro where id;
    select nome into v_nome from public.pessoas where id = new.pessoa_id;
    perform interno.registrar_lancamento(
      case when new.forma_pagamento ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end,
      'entrada',
      (select id from public.categorias_financeiras where sistema = 'contribuicoes'),
      new.pago_em,
      new.valor_pago,
      'Contribuição de ' || v_nome || ' — ' ||
        case new.tipo
          when 'anual' then 'anuidade ' || new.exercicio || '/' || (new.exercicio + 1)
          when 'inscricao' then 'taxa de inscrição'
          else 'mensalidade ' || to_char(new.competencia, 'MM/YYYY')
        end,
      'efetivado',
      null,
      new.id);
  end if;
  return null;
end;
$$;

-- A inscrição paga do evento entra no caixa, ligada ao evento
create or replace function interno.registrar_pagamento_inscricao(p_id uuid, p_data date, p_forma text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inscricao public.evento_inscricoes;
  v_evento public.eventos;
  v_config public.config_financeiro;
  v_conta uuid;
  v_lancamento uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram o pagamento.' using errcode = '42501';
  end if;
  select * into v_inscricao from public.evento_inscricoes where id = p_id and arquivado_em is null for update;
  if not found or v_inscricao.situacao <> 'aguardando_pagamento' then
    raise exception 'Esta inscrição não está esperando pagamento.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data do pagamento (não pode ser futura).' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe a forma de pagamento (PIX, dinheiro…).' using errcode = 'P0001';
  end if;
  select * into v_evento from public.eventos where id = v_inscricao.evento_id;
  if v_evento.situacao = 'cancelado' then
    raise exception 'O evento foi cancelado: não se registra pagamento.' using errcode = 'P0001';
  end if;
  select * into v_config from public.config_financeiro where id;
  v_conta := case when trim(p_forma) ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end;
  if v_conta is null or not exists (select 1 from public.contas_financeiras c where c.arquivado_em is null and c.id = v_conta) then
    raise exception 'A conta do caixa para esta forma de pagamento não está definida (Financeiro → Caixa).' using errcode = 'P0001';
  end if;
  v_lancamento := interno.registrar_lancamento(
    v_conta, 'entrada', (select id from public.categorias_financeiras where sistema = 'inscricoes_eventos'),
    p_data, v_inscricao.valor,
    'Inscrição nº ' || v_inscricao.numero || ' — ' || v_evento.titulo || ' (' || trim(p_forma) || ')',
    'efetivado', null, null, v_evento.id);
  update public.evento_inscricoes
  set situacao = 'confirmada', pago_em = p_data, lancamento_id = v_lancamento
  where id = p_id;
end;
$$;

-- As transferências entre contas (as duas pernas, ligadas)
create or replace function interno.transferir(p_origem uuid, p_destino uuid, p_data date, p_valor numeric, p_descricao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_par uuid := gen_random_uuid();
  v_texto text := coalesce(nullif(trim(p_descricao), ''), 'Transferência entre contas');
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência transferem entre contas.' using errcode = '42501';
  end if;
  if p_origem = p_destino or (select count(*) from public.contas_financeiras where id in (p_origem, p_destino) and arquivado_em is null) <> 2 then
    raise exception 'Escolha duas contas diferentes.' using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date or p_valor is null or p_valor <= 0 then
    raise exception 'Informe data (não futura) e valor maior que zero.' using errcode = 'P0001';
  end if;
  perform interno.registrar_lancamento(p_origem, 'saida', (select id from public.categorias_financeiras where sistema = 'transferencia_saida'),
                                       p_data, p_valor, v_texto, 'efetivado', null, null, null, v_par);
  perform interno.registrar_lancamento(p_destino, 'entrada', (select id from public.categorias_financeiras where sistema = 'transferencia_entrada'),
                                       p_data, p_valor, v_texto, 'efetivado', null, null, null, v_par);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. O evento lança a própria despesa e a própria receita avulsa
-- ---------------------------------------------------------------------
create function interno.lancar_no_evento(
  p_evento_id   uuid,
  p_conta_id    uuid,
  p_tipo        public.tipo_lancamento,
  p_categoria   uuid,
  p_data        date,
  p_valor       numeric,
  p_descricao   text,
  p_comprovante text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos;
  v_id uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência lançam as finanças do evento.' using errcode = '42501';
  end if;
  select * into v_evento from public.eventos where id = p_evento_id and arquivado_em is null;
  if not found then
    raise exception 'Evento não encontrado.' using errcode = 'P0001';
  end if;
  if p_tipo = 'saida' and v_evento.orcamento_aprovado_em is null then
    raise exception 'Despesa do evento só depois de o orçamento ser aprovado pela assembleia.' using errcode = 'P0001';
  end if;
  if p_tipo = 'entrada' and v_evento.situacao = 'cancelado' then
    raise exception 'O evento foi cancelado: não recebe mais entradas.' using errcode = 'P0001';
  end if;
  -- as mesmas regras do Caixa (a categoria, a conta, a data, o valor, o comprovante); a despesa espera o presidente
  v_id := interno.lancar(p_conta_id, p_tipo, p_categoria, p_data, p_valor, p_descricao, p_comprovante);
  update public.lancamentos set evento_id = p_evento_id where id = v_id;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O modelo exclusivo da credencial é pago com a entrada no caixa
-- ---------------------------------------------------------------------
-- Receber o pagamento: a entrada entra no caixa (dinheiro → caixa; o resto → banco), ligada ao modelo
create function interno.receber_pagamento_exclusivo(p_id uuid, p_data date, p_forma text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
  v_config public.config_financeiro;
  v_conta uuid;
  v_igreja text;
  v_lancamento uuid;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram o pagamento do modelo exclusivo.' using errcode = '42501';
  end if;
  select * into v_modelo from public.credencial_modelos where id = p_id and tipo = 'exclusivo' and arquivado_em is null for update;
  if not found then
    raise exception 'Modelo exclusivo não encontrado.' using errcode = 'P0001';
  end if;
  if v_modelo.exclusivo_pago_em is not null then
    raise exception 'Este modelo já está pago. Para corrigir, desfaça o pagamento (a entrada do caixa é cancelada) e registre de novo.'
      using errcode = 'P0001';
  end if;
  if p_data is null or p_data > current_date then
    raise exception 'Informe a data do pagamento (não pode ser futura).' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_forma), '') = '' then
    raise exception 'Informe a forma de pagamento (PIX, dinheiro…).' using errcode = 'P0001';
  end if;
  select * into v_config from public.config_financeiro where id;
  v_conta := case when trim(p_forma) ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end;
  if v_conta is null or not exists (select 1 from public.contas_financeiras c where c.arquivado_em is null and c.id = v_conta) then
    raise exception 'A conta do caixa para esta forma de pagamento não está definida (Financeiro → Caixa).' using errcode = 'P0001';
  end if;
  select nome into v_igreja from public.igrejas where id = v_modelo.exclusivo_igreja_id;
  v_lancamento := interno.registrar_lancamento(
    v_conta, 'entrada', (select id from public.categorias_financeiras where sistema = 'modelos_exclusivos'),
    p_data, v_modelo.exclusivo_valor,
    'Modelo exclusivo da credencial — ' || coalesce(v_igreja, v_modelo.nome) || ' (' || trim(p_forma) || ')',
    'efetivado');
  update public.credencial_modelos set exclusivo_pago_em = p_data, exclusivo_lancamento_id = v_lancamento where id = p_id;
  return v_lancamento;
end;
$$;

-- Ligar uma entrada que já está no caixa (a tesouraria lançou antes): agora o pagamento SEMPRE tem a entrada
create or replace function interno.registrar_pagamento_exclusivo(p_id uuid, p_pago_em date, p_lancamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram o pagamento do modelo exclusivo.' using errcode = '42501';
  end if;
  if p_pago_em is null or p_lancamento_id is null then
    raise exception 'O pagamento do modelo exclusivo tem sempre a entrada no caixa: registre o recebimento ou ligue a entrada já lançada. Para desfazer, use "Desfazer o pagamento".'
      using errcode = 'P0001';
  end if;
  if p_pago_em > current_date then
    raise exception 'O pagamento não pode ter data no futuro.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.lancamentos l where l.id = p_lancamento_id and l.tipo = 'entrada' and l.situacao = 'efetivado' and l.arquivado_em is null
      and l.cobranca_id is null and l.transferencia_id is null and l.evento_id is null
  ) then
    raise exception 'Escolha uma entrada do caixa (o pagamento da igreja).' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.credencial_modelos where exclusivo_lancamento_id = p_lancamento_id and id <> p_id)
     or exists (select 1 from public.patrimonio_itens where lancamento_id = p_lancamento_id) then
    raise exception 'Esta entrada já está ligada a outra origem.' using errcode = 'P0001';
  end if;
  update public.credencial_modelos
  set exclusivo_pago_em = p_pago_em, exclusivo_lancamento_id = p_lancamento_id
  where id = p_id and tipo = 'exclusivo' and arquivado_em is null;
  if not found then
    raise exception 'Modelo exclusivo não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

-- Desfazer o pagamento: a entrada do caixa é cancelada (estorno), e o modelo volta a esperar o pagamento
create function interno.desfazer_pagamento_exclusivo(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
begin
  select * into v_modelo from public.credencial_modelos where id = p_id and tipo = 'exclusivo' for update;
  if not found or v_modelo.exclusivo_lancamento_id is null then
    raise exception 'Este modelo não tem pagamento para desfazer.' using errcode = 'P0001';
  end if;
  perform interno.cancelar_lancamento(v_modelo.exclusivo_lancamento_id,
                                      'Pagamento do modelo exclusivo desfeito: ' || coalesce(nullif(trim(p_motivo), ''), 'sem motivo'));
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Cancelar: o lançamento devolve a origem para "a pagar"; a inscrição paga cancelada estorna o lançamento
-- ---------------------------------------------------------------------
-- Cancelar o lançamento: agora vale também para a contribuição (ela volta para "em aberto")
create or replace function interno.cancelar_lancamento(p_lancamento_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lancamento public.lancamentos;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência cancelam lançamentos.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo do cancelamento.' using errcode = 'P0001';
  end if;
  select * into v_lancamento from public.lancamentos where id = p_lancamento_id for update;
  if not found or v_lancamento.situacao in ('cancelado', 'recusado') then
    raise exception 'Este lançamento já está cancelado ou recusado.' using errcode = 'P0001';
  end if;
  update public.lancamentos set situacao = 'cancelado', motivo = trim(p_motivo)
  where id = p_lancamento_id or (v_lancamento.transferencia_id is not null and transferencia_id = v_lancamento.transferencia_id);
end;
$$;

-- O lançamento cancelado devolve a origem (a inscrição do evento já voltava: interno.lancamento_de_inscricao_cancelado)
create function interno.lancamento_cancelado_devolve_origem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao = 'cancelado' and old.situacao is distinct from 'cancelado' then
    if new.cobranca_id is not null then
      update public.cobrancas
      set situacao = 'aberta', pago_em = null, valor_pago = null, forma_pagamento = null, confirmado_por = null, confirmado_em = null,
          observacao = left('Pagamento estornado: ' || coalesce(new.motivo, ''), 500)
      where id = new.cobranca_id and situacao = 'paga';
      update public.informes_pagamento
      set situacao = 'cancelado', motivo_recusa = left('Pagamento estornado pela tesouraria: ' || coalesce(new.motivo, ''), 500)
      where cobranca_id = new.cobranca_id and situacao = 'confirmado';
    end if;
    update public.credencial_modelos set exclusivo_pago_em = null, exclusivo_lancamento_id = null
    where exclusivo_lancamento_id = new.id;
    update public.patrimonio_itens set lancamento_id = null where lancamento_id = new.id;
  end if;
  return null;
end;
$$;
create trigger lancamento_cancelado_devolve_origem
  after update of situacao on public.lancamentos
  for each row execute function interno.lancamento_cancelado_devolve_origem();

-- Cancelar a inscrição: a paga só a tesouraria ou a presidência cancelam, e o pagamento é estornado (o lançamento é cancelado)
create or replace function interno.cancelar_inscricao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inscricao public.evento_inscricoes;
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'Cancelada');
begin
  select * into v_inscricao from public.evento_inscricoes where id = p_id and arquivado_em is null for update;
  if not found or v_inscricao.situacao = 'cancelada' then
    raise exception 'Inscrição não encontrada (ou já cancelada).' using errcode = 'P0001';
  end if;
  if v_inscricao.pago_em is not null then
    if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
      raise exception 'A inscrição já foi paga: a devolução é com a tesouraria.' using errcode = 'P0001';
    end if;
    if coalesce(trim(p_motivo), '') = '' then
      raise exception 'Informe o motivo: o pagamento da inscrição vai ser estornado.' using errcode = 'P0001';
    end if;
    -- o estorno: o lançamento é cancelado (e a inscrição volta a esperar o pagamento, antes de ser cancelada)
    perform interno.cancelar_lancamento(v_inscricao.lancamento_id, 'Estorno da inscrição nº ' || v_inscricao.numero || ': ' || v_motivo);
  elsif not ((select interno.tenho_perfil('secretaria', 'presidencia'))
             or (v_inscricao.pessoa_id is not null and v_inscricao.pessoa_id = (select interno.minha_pessoa_id()))) then
    raise exception 'Só a secretaria, a presidência ou o próprio inscrito cancelam a inscrição.' using errcode = '42501';
  end if;
  update public.evento_inscricoes
  set situacao = 'cancelada', cancelada_em = now(), motivo = v_motivo
  where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Item pago num módulo tem sempre o lançamento
-- ---------------------------------------------------------------------
-- O modelo exclusivo pago sem a entrada no caixa (antes era opcional) ganha a entrada agora
do $$
declare
  v_modelo record;
  v_config public.config_financeiro;
  v_inicio date;
  v_lancamento uuid;
begin
  select * into v_config from public.config_financeiro where id;
  for v_modelo in
    select m.*, g.nome as igreja_nome from public.credencial_modelos m
    left join public.igrejas g on g.id = m.exclusivo_igreja_id
    where m.tipo = 'exclusivo' and m.exclusivo_pago_em is not null and m.exclusivo_lancamento_id is null
  loop
    select saldo_inicial_em into v_inicio from public.contas_financeiras where id = v_config.conta_banco_id;
    v_lancamento := interno.registrar_lancamento(
      v_config.conta_banco_id, 'entrada', (select id from public.categorias_financeiras where sistema = 'modelos_exclusivos'),
      greatest(v_modelo.exclusivo_pago_em, coalesce(v_inicio, v_modelo.exclusivo_pago_em)), v_modelo.exclusivo_valor,
      'Modelo exclusivo da credencial — ' || coalesce(v_modelo.igreja_nome, v_modelo.nome) || ' (pago antes da blindagem do caixa)',
      'efetivado', null, null, null, null, v_modelo.criado_por);
    update public.credencial_modelos set exclusivo_lancamento_id = v_lancamento where id = v_modelo.id;
  end loop;
end;
$$;

alter table public.credencial_modelos
  add constraint credencial_modelos_pago_tem_lancamento check (exclusivo_pago_em is null or exclusivo_lancamento_id is not null);
alter table public.evento_inscricoes
  add constraint evento_inscricoes_pago_tem_lancamento check ((pago_em is null) = (lancamento_id is null));

-- E o lançamento ligado está valendo (efetivado): conferido no fim da transação (depois dos gatilhos)
create function interno.conferir_pago_tem_lancamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean := true;
begin
  if tg_table_name = 'cobrancas' then
    if new.situacao = 'paga' and coalesce(new.valor_pago, 0) > 0 then
      v_ok := exists (select 1 from public.lancamentos l where l.cobranca_id = new.id and l.situacao = 'efetivado' and l.valor = new.valor_pago);
    end if;
  elsif tg_table_name = 'evento_inscricoes' then
    if new.pago_em is not null then
      v_ok := exists (select 1 from public.lancamentos l where l.id = new.lancamento_id and l.situacao = 'efetivado' and l.valor = new.valor);
    end if;
  elsif tg_table_name = 'credencial_modelos' then
    if new.exclusivo_pago_em is not null then
      v_ok := exists (select 1 from public.lancamentos l where l.id = new.exclusivo_lancamento_id and l.situacao = 'efetivado');
    end if;
  end if;
  if not v_ok then
    raise exception 'Pago sem o lançamento no caixa: todo valor pago num módulo entra no caixa pela função do sistema.'
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;
create constraint trigger conferir_pago_tem_lancamento
  after insert or update on public.cobrancas
  deferrable initially deferred
  for each row execute function interno.conferir_pago_tem_lancamento();
create constraint trigger conferir_pago_tem_lancamento
  after insert or update on public.evento_inscricoes
  deferrable initially deferred
  for each row execute function interno.conferir_pago_tem_lancamento();
create constraint trigger conferir_pago_tem_lancamento
  after insert or update on public.credencial_modelos
  deferrable initially deferred
  for each row execute function interno.conferir_pago_tem_lancamento();


-- ---------------------------------------------------------------------
-- 8. A origem de cada lançamento (o extrato mostra de onde veio o valor, com o link)
-- ---------------------------------------------------------------------
create function interno.origem_do_lancamento(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_l public.lancamentos;
  v jsonb;
begin
  select * into v_l from public.lancamentos where id = p_id;
  if not found then
    return null;
  end if;
  if v_l.cobranca_id is not null then
    select jsonb_build_object(
      'tipo', case c.tipo when 'inscricao' then 'taxa_inscricao' else 'contribuicao' end,
      'texto', case c.tipo
                 when 'inscricao' then 'Taxa de inscrição de ' || p.nome
                 when 'anual' then 'Anuidade ' || c.exercicio || '/' || (c.exercicio + 1) || ' de ' || p.nome
                 else 'Mensalidade ' || to_char(c.competencia, 'MM/YYYY') || ' de ' || p.nome
               end,
      'link', '/ministros/' || p.id || '/contribuicao')
    into v
    from public.cobrancas c join public.pessoas p on p.id = c.pessoa_id
    where c.id = v_l.cobranca_id;
    return v;
  end if;
  if v_l.transferencia_id is not null then
    return jsonb_build_object('tipo', 'transferencia', 'texto', 'Transferência entre contas', 'link', '/financeiro/caixa/transferencias');
  end if;
  select jsonb_build_object('tipo', 'inscricao_evento', 'texto', 'Inscrição nº ' || i.numero || ' — ' || e.titulo, 'link', '/eventos/' || e.id)
  into v
  from public.evento_inscricoes i join public.eventos e on e.id = i.evento_id
  where i.lancamento_id = p_id
  limit 1;
  if v is not null then
    return v;
  end if;
  if v_l.evento_id is not null then
    return (select jsonb_build_object('tipo', 'evento', 'texto', 'Evento: ' || e.titulo, 'link', '/eventos/' || e.id)
            from public.eventos e where e.id = v_l.evento_id);
  end if;
  select jsonb_build_object('tipo', 'modelo_exclusivo',
                            'texto', 'Modelo exclusivo da credencial — ' || coalesce(g.nome, m.nome),
                            'link', '/credenciais/modelos/' || m.id || '/quem-recebe')
  into v
  from public.credencial_modelos m left join public.igrejas g on g.id = m.exclusivo_igreja_id
  where m.exclusivo_lancamento_id = p_id
  limit 1;
  if v is not null then
    return v;
  end if;
  select jsonb_build_object('tipo', 'patrimonio', 'texto', 'Compra do patrimônio: ' || b.nome, 'link', '/patrimonio/bens')
  into v
  from public.patrimonio_itens b
  where b.lancamento_id = p_id
  limit 1;
  if v is not null then
    return v;
  end if;
  return jsonb_build_object('tipo', 'avulso', 'texto', 'Lançado no Caixa', 'link', null);
end;
$$;

create or replace view public.vw_lancamentos
with (security_invoker = true)
as
select
  l.id,
  l.conta_id,
  l.tipo,
  l.data,
  l.valor,
  l.descricao,
  l.comprovante_caminho,
  l.cobranca_id,
  l.transferencia_id,
  l.evento_id,
  l.situacao,
  l.motivo,
  l.autorizado_em,
  l.criado_em,
  c.nome as conta_nome,
  c.tipo as conta_tipo,
  c.saldo_inicial_em as conta_desde,
  cat.id as categoria_id,
  cat.nome as categoria_nome,
  cat.sistema as categoria_sistema,
  pa.id as autorizado_por_id,
  pa.nome as autorizado_por_nome,
  pl.id as lancado_por_id,
  pl.nome as lancado_por_nome,
  (l.situacao = 'efetivado' and l.data >= c.saldo_inicial_em) as no_saldo,
  o.origem ->> 'tipo' as origem,
  o.origem ->> 'texto' as origem_texto,
  o.origem ->> 'link' as origem_link
from public.lancamentos l
join public.contas_financeiras c on c.id = l.conta_id
join public.categorias_financeiras cat on cat.id = l.categoria_id
left join public.pessoas pa on pa.id = l.autorizado_por
left join public.pessoas pl on pl.usuario_id = l.criado_por
cross join lateral (select interno.origem_do_lancamento(l.id) as origem) o
where l.arquivado_em is null;
comment on view public.vw_lancamentos is
  'Lançamentos do caixa com a conta, a categoria, os nomes de quem lançou e de quem autorizou, e a origem (de onde veio o valor, com o link).';


-- ---------------------------------------------------------------------
-- 9. Os números do Financeiro: o "recebido" das contribuições vem do caixa (a fonte é uma só)
-- ---------------------------------------------------------------------
create or replace function interno.numeros_do_financeiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_exercicio integer := interno.exercicio_de(current_date);
  v_saldo numeric;
  v_contribuicoes jsonb;
  v_recebido numeric;
  v_informes jsonb;
  v_despesas jsonb;
  v_atraso integer;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')) then
    raise exception 'Só a tesouraria, a presidência e o Conselho Fiscal veem os números do financeiro.' using errcode = '42501';
  end if;

  select coalesce(sum(saldo), 0) into v_saldo from public.vw_saldos_contas;

  -- o recebido: as entradas do caixa ligadas às cobranças do exercício
  select coalesce(round(sum(l.valor), 2), 0) into v_recebido
  from public.lancamentos l
  join public.cobrancas c on c.id = l.cobranca_id
  where l.situacao = 'efetivado' and l.arquivado_em is null and c.exercicio = v_exercicio and c.arquivado_em is null;

  select jsonb_build_object(
    'previsto',  coalesce(round(sum(valor), 2), 0),
    'recebido',  v_recebido,
    'em_aberto', coalesce(round(sum(valor) filter (where situacao = 'aberta' and vencimento < current_date), 2), 0)
  )
  into v_contribuicoes
  from public.cobrancas
  where exercicio = v_exercicio and situacao <> 'cancelada' and arquivado_em is null;

  select jsonb_build_object('quantidade', count(*), 'valor', coalesce(round(sum(valor), 2), 0))
  into v_informes
  from public.informes_pagamento
  where situacao = 'pendente' and arquivado_em is null;

  select jsonb_build_object('quantidade', count(*), 'valor', coalesce(round(sum(valor), 2), 0))
  into v_despesas
  from public.lancamentos
  where situacao = 'aguardando_autorizacao' and arquivado_em is null;

  select count(*) into v_atraso from public.vw_situacao_contribuicao where not em_dia;

  return jsonb_build_object(
    'exercicio', v_exercicio,
    'saldo', round(v_saldo, 2),
    'contribuicoes', v_contribuicoes,
    'em_atraso', v_atraso,
    'para_conferir', v_informes,
    'despesas_esperando', v_despesas
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 10. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.lancar_no_evento(p_evento_id uuid, p_conta_id uuid, p_tipo public.tipo_lancamento, p_categoria uuid,
                                        p_data date, p_valor numeric, p_descricao text, p_comprovante text)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.lancar_no_evento(p_evento_id, p_conta_id, p_tipo, p_categoria, p_data, p_valor, p_descricao, p_comprovante);
$$;
create function public.receber_pagamento_exclusivo(p_id uuid, p_data date, p_forma text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.receber_pagamento_exclusivo(p_id, p_data, p_forma); $$;
create function public.desfazer_pagamento_exclusivo(p_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$ select interno.desfazer_pagamento_exclusivo(p_id, p_motivo); $$;

-- a função única e as travas: só as funções do banco chamam
revoke all on function interno.registrar_lancamento(uuid, public.tipo_lancamento, uuid, date, numeric, text, public.situacao_lancamento, text, uuid, uuid, uuid, uuid) from public;
revoke all on function interno.exigir_funcao_de_lancamento() from public;
revoke all on function interno.proteger_lancamento() from public;
revoke all on function interno.lancamento_cancelado_devolve_origem() from public;
revoke all on function interno.conferir_pago_tem_lancamento() from public;
revoke all on function interno.origem_do_lancamento(uuid) from public;
-- a origem aparece no extrato (a vista roda com quem está vendo, que já precisa ver os lançamentos)
grant execute on function interno.origem_do_lancamento(uuid) to authenticated;

revoke all on function interno.lancar_no_evento(uuid, uuid, public.tipo_lancamento, uuid, date, numeric, text, text) from public;
revoke all on function interno.receber_pagamento_exclusivo(uuid, date, text) from public;
revoke all on function interno.desfazer_pagamento_exclusivo(uuid, text) from public;
grant execute on function interno.lancar_no_evento(uuid, uuid, public.tipo_lancamento, uuid, date, numeric, text, text) to authenticated;
grant execute on function interno.receber_pagamento_exclusivo(uuid, date, text) to authenticated;
grant execute on function interno.desfazer_pagamento_exclusivo(uuid, text) to authenticated;

revoke all on function public.lancar_no_evento(uuid, uuid, public.tipo_lancamento, uuid, date, numeric, text, text) from public, anon;
revoke all on function public.receber_pagamento_exclusivo(uuid, date, text) from public, anon;
revoke all on function public.desfazer_pagamento_exclusivo(uuid, text) from public, anon;
grant execute on function public.lancar_no_evento(uuid, uuid, public.tipo_lancamento, uuid, date, numeric, text, text) to authenticated;
grant execute on function public.receber_pagamento_exclusivo(uuid, date, text) to authenticated;
grant execute on function public.desfazer_pagamento_exclusivo(uuid, text) to authenticated;

-- o livro-caixa continua só leitura pela API (RLS) — a trava de cima vale até para as funções do próprio banco
revoke insert, update, delete, truncate on public.lancamentos from anon, authenticated;
