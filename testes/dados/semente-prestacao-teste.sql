-- =====================================================================
-- SEMENTE DA PRESTAÇÃO DE CONTAS FICTÍCIA — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql, semente-financeiro-teste.sql e semente-caixa-teste.sql.
-- Se rodar de novo, não faz nada.
--
--   * as contas passam a começar em 01/04/2025, com saldo de abertura;
--   * exercício 2025/2026 inteiro (abril/2025 a março/2026): contribuições recebidas, ofertas,
--     doações e despesas autorizadas pelo presidente, depósitos das ofertas;
--   * balanço 2025/2026 completo: fechado pela tesouraria, analisado pela diretoria, parecer
--     favorável do Conselho Fiscal e aprovado na AGO de 25/04/2026;
--   * orçamento e plano de trabalho 2026/2027, aprovados na mesma AGO.
-- Toda descrição termina com "(fictício)".
-- =====================================================================
do $$
declare
  c_marca constant text := '(fictício)';
  v_tesouraria uuid;
  v_presidencia uuid;
  v_conselho uuid;
  v_caixa uuid;
  v_banco uuid;
  v_mes date := '2025-04-01';
  v_num integer;
  v_nome_mes text;
  v_oferta numeric;
  v_id uuid;
  v_despesas uuid[];
  v_balanco uuid;
  v_meses text[] := array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
                          'outubro', 'novembro', 'dezembro'];

  -- categoria pelo nome
  v_cat jsonb;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.balancos where exercicio = 2025 and arquivado_em is null) then
    raise notice 'A semente da prestação de contas já foi aplicada antes: nada a fazer.';
    return;
  end if;

  select id into v_tesouraria from auth.users where email = 'e2e.tesouraria@example.com';
  select id into v_presidencia from auth.users where email = 'e2e.presidencia@example.com';
  select id into v_conselho from auth.users where email = 'e2e.conselho@example.com';
  if v_tesouraria is null or v_presidencia is null or v_conselho is null then
    raise exception 'Faltam os usuários fictícios e2e.tesouraria, e2e.presidencia e e2e.conselho.';
  end if;
  select conta_dinheiro_id, conta_banco_id into v_caixa, v_banco from public.config_financeiro where id;
  select jsonb_object_agg(nome, id) into v_cat from public.categorias_financeiras;
  perform setseed(0.2025);

  -- 1. As contas começam em 01/04/2025, com o saldo de abertura (fictício)
  update public.contas_financeiras
  set saldo_inicial_em = '2025-04-01', saldo_inicial = case tipo when 'caixa' then 420.00 else 3850.00 end
  where id in (v_caixa, v_banco);

  -- 2. Exercício 2025/2026, mês a mês
  while v_mes <= '2026-03-01' loop
    v_num := extract(month from v_mes)::integer;
    v_nome_mes := v_meses[v_num] || '/' || extract(year from v_mes);
    v_despesas := '{}';

    perform set_config('request.jwt.claim.sub', v_tesouraria::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tesouraria, 'role', 'authenticated')::text, true);

    -- Contribuições do mês (lançadas de uma vez, como resumo do mês)
    insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao, criado_por)
    values (v_banco, 'entrada', (v_cat ->> 'Contribuições dos associados')::uuid, v_mes + 11,
            round((1100 + random() * 600)::numeric, 2), 'Contribuições recebidas em ' || v_nome_mes || ' ' || c_marca,
            'efetivado', v_tesouraria);

    v_oferta := round((300 + random() * 500)::numeric, 2);
    perform public.lancar(v_caixa, 'entrada', (v_cat ->> 'Ofertas')::uuid, v_mes + 4, v_oferta,
      'Oferta da reunião mensal de ' || v_nome_mes || ' ' || c_marca, null);
    if v_num % 2 = 1 then
      perform public.lancar(v_banco, 'entrada', (v_cat ->> 'Doações')::uuid, v_mes + 9,
        round((100 + random() * 400)::numeric, 2), 'Doação de igreja parceira ' || c_marca, null);
    end if;

    v_id := public.lancar(v_banco, 'saida', (v_cat ->> 'Tarifas bancárias')::uuid, v_mes + 2, 24.90,
      'Tarifa da conta — ' || v_nome_mes || ' ' || c_marca, null);
    v_despesas := v_despesas || v_id;
    v_id := public.lancar(v_caixa, 'saida', (v_cat ->> 'Material e expediente')::uuid, v_mes + 6,
      round((40 + random() * 110)::numeric, 2), 'Papel, impressão e café da reunião ' || c_marca, null);
    v_despesas := v_despesas || v_id;
    if v_num in (5, 8, 11) then
      v_id := public.lancar(v_banco, 'saida', (v_cat ->> 'Eventos e encontros')::uuid, v_mes + 13,
        round((450 + random() * 500)::numeric, 2), 'Encontro trimestral de ministros ' || c_marca, null);
      v_despesas := v_despesas || v_id;
    end if;
    if v_num in (6, 12) then
      v_id := public.lancar(v_banco, 'saida', (v_cat ->> 'Ação social')::uuid, v_mes + 15,
        round((250 + random() * 400)::numeric, 2), 'Cestas básicas para famílias atendidas ' || c_marca, null);
      v_despesas := v_despesas || v_id;
    end if;
    perform public.transferir(v_caixa, v_banco, v_mes + 7, round(v_oferta * 0.8, 2),
      'Depósito das ofertas de ' || v_nome_mes || ' ' || c_marca);

    perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
    foreach v_id in array v_despesas loop
      perform public.autorizar_despesa(v_id, true, null);
    end loop;

    v_mes := (v_mes + interval '1 month')::date;
  end loop;

  -- 3. Balanço 2025/2026: os quatro passos
  perform set_config('request.jwt.claim.sub', v_tesouraria::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_tesouraria, 'role', 'authenticated')::text, true);
  v_balanco := public.fechar_balanco(2025,
    'Primeiro exercício completo no sistema. Saldos de abertura conferidos com o extrato bancário e a contagem do caixa de 31/03/2025. ' || c_marca);

  perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
  perform public.analisar_balanco(v_balanco,
    'A diretoria conferiu os lançamentos, os comprovantes das despesas e os extratos, e não encontrou divergências. ' || c_marca);

  perform set_config('request.jwt.claim.sub', v_conselho::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_conselho, 'role', 'authenticated')::text, true);
  perform public.parecer_balanco(v_balanco, 'favoravel',
    'O Conselho Fiscal examinou o balanço, os lançamentos e os comprovantes do exercício 2025/2026 e é de parecer FAVORÁVEL à aprovação das contas pela Assembleia Geral. ' || c_marca);

  perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
  perform public.assembleia_balanco(v_balanco, true, '2026-04-25', 'Ata da AGO de 25/04/2026 (fictícia)');

  -- Datas de cada passo como teriam sido em abril de 2026
  update public.balancos
  set fechado_em = '2026-04-06 10:00:00-03', analisado_em = '2026-04-13 19:30:00-03', parecer_em = '2026-04-18 16:00:00-03'
  where id = v_balanco;
  update public.balanco_eventos
  set criado_em = case
    when acao like 'Fechado%' then '2026-04-06 10:00:00-03'::timestamptz
    when acao like 'Analisado%' then '2026-04-13 19:30:00-03'::timestamptz
    when acao like 'Parecer%' then '2026-04-18 16:00:00-03'::timestamptz
    else '2026-04-25 21:00:00-03'::timestamptz end
  where balanco_id = v_balanco;

  -- 4. Orçamento e plano de trabalho 2026/2027 (aprovados na mesma AGO)
  perform set_config('request.jwt.claim.sub', v_tesouraria::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_tesouraria, 'role', 'authenticated')::text, true);
  perform public.salvar_orcamento(2026,
    E'1. Reuniões mensais de ministros, na primeira segunda-feira de cada mês.\n'
    || E'2. Encontros trimestrais de ministros com as famílias (maio, agosto e novembro).\n'
    || E'3. Ação social de Natal: cestas básicas para famílias atendidas pelas igrejas.\n'
    || E'4. Seminário de liderança em setembro.\n' || c_marca,
    jsonb_build_array(
      jsonb_build_object('categoria_id', v_cat ->> 'Contribuições dos associados', 'valor', 18000),
      jsonb_build_object('categoria_id', v_cat ->> 'Ofertas', 'valor', 6000),
      jsonb_build_object('categoria_id', v_cat ->> 'Doações', 'valor', 1500),
      jsonb_build_object('categoria_id', v_cat ->> 'Eventos e encontros', 'valor', 3000),
      jsonb_build_object('categoria_id', v_cat ->> 'Ação social', 'valor', 1500),
      jsonb_build_object('categoria_id', v_cat ->> 'Material e expediente', 'valor', 1200),
      jsonb_build_object('categoria_id', v_cat ->> 'Tarifas bancárias', 'valor', 300),
      jsonb_build_object('categoria_id', v_cat ->> 'Outras despesas', 'valor', 500)
    ));
  perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
  perform public.aprovar_orcamento(2026, '2026-04-25', 'Ata da AGO de 25/04/2026 (fictícia)');
end
$$;

select b.exercicio, b.situacao, (b.resumo ->> 'total_entradas') as receitas, (b.resumo ->> 'total_saidas') as despesas
from public.balancos b where b.arquivado_em is null order by b.exercicio;
