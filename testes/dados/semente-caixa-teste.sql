-- =====================================================================
-- SEMENTE DO CAIXA FICTÍCIO — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql e semente-financeiro-teste.sql. Se rodar de novo, não faz nada.
--
-- Do início do exercício (abril) até hoje, mês a mês, pelas regras do sistema:
--   * a tesouraria fictícia lança as ofertas da reunião mensal (no caixa em dinheiro),
--     doações (no banco) e as despesas do mês;
--   * a presidência fictícia autoriza as despesas (uma é recusada, com motivo);
--   * as despesas do mês atual ficam aguardando a autorização;
--   * a tesouraria deposita as ofertas no banco (transferência entre contas).
-- Toda descrição termina com "(fictício)".
-- =====================================================================
do $$
declare
  c_marca constant text := '(fictício)';
  v_tesouraria uuid;
  v_presidencia uuid;
  v_caixa uuid;
  v_banco uuid;
  v_inicio date := make_date(interno.exercicio_de(current_date), 4, 1);
  v_mes date;
  v_nome_mes text;
  v_atual boolean;
  v_id uuid;
  v_oferta numeric;
  v_meses text[] := array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
                          'outubro', 'novembro', 'dezembro'];
  v_despesas_mes uuid[];

begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.lancamentos where descricao like '%' || c_marca) then
    raise notice 'A semente do caixa já foi aplicada antes: nada a fazer.';
    return;
  end if;

  select id into v_tesouraria from auth.users where email = 'e2e.tesouraria@example.com';
  select id into v_presidencia from auth.users where email = 'e2e.presidencia@example.com';
  if v_tesouraria is null or v_presidencia is null then
    raise exception 'Faltam os usuários fictícios e2e.tesouraria e e2e.presidencia.';
  end if;
  select conta_dinheiro_id, conta_banco_id into v_caixa, v_banco from public.config_financeiro where id;
  perform setseed(0.42);

  v_mes := v_inicio;
  while v_mes <= current_date loop
    v_nome_mes := v_meses[extract(month from v_mes)::integer] || '/' || extract(year from v_mes);
    v_atual := date_trunc('month', current_date) = v_mes;
    v_despesas_mes := '{}';

    -- ---------- Tesouraria lança ----------
    perform set_config('request.jwt.claim.sub', v_tesouraria::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_tesouraria, 'role', 'authenticated')::text, true);

    v_oferta := round((300 + random() * 500)::numeric, 2);
    perform public.lancar(v_caixa, 'entrada', (select id from public.categorias_financeiras where nome = 'Ofertas'),
      least(v_mes + 4, current_date), v_oferta, 'Oferta da reunião mensal de ' || v_nome_mes || ' ' || c_marca, null);

    if extract(month from v_mes)::integer % 2 = 0 then
      perform public.lancar(v_banco, 'entrada', (select id from public.categorias_financeiras where nome = 'Doações'),
        least(v_mes + 9, current_date), round((100 + random() * 400)::numeric, 2),
        'Doação de igreja parceira ' || c_marca, null);
    end if;

    v_id := public.lancar(v_banco, 'saida', (select id from public.categorias_financeiras where nome = 'Tarifas bancárias'),
      least(v_mes + 2, current_date), 24.90, 'Tarifa da conta — ' || v_nome_mes || ' ' || c_marca, null);
    v_despesas_mes := v_despesas_mes || v_id;

    v_id := public.lancar(v_caixa, 'saida', (select id from public.categorias_financeiras where nome = 'Material e expediente'),
      least(v_mes + 6, current_date), round((40 + random() * 110)::numeric, 2),
      'Papel, impressão e café da reunião ' || c_marca, null);
    v_despesas_mes := v_despesas_mes || v_id;

    if extract(month from v_mes)::integer in (5, 8, 10) then
      v_id := public.lancar(v_banco, 'saida', (select id from public.categorias_financeiras where nome = 'Eventos e encontros'),
        least(v_mes + 11, current_date), round((350 + random() * 450)::numeric, 2),
        'Encontro de ministros — som e lanche ' || c_marca, null);
      v_despesas_mes := v_despesas_mes || v_id;
    end if;

    if extract(month from v_mes)::integer in (6, 9) then
      v_id := public.lancar(v_banco, 'saida', (select id from public.categorias_financeiras where nome = 'Ação social'),
        least(v_mes + 14, current_date), round((200 + random() * 300)::numeric, 2),
        'Cestas básicas para famílias atendidas ' || c_marca, null);
      v_despesas_mes := v_despesas_mes || v_id;
    end if;

    if extract(month from v_mes)::integer = 7 then
      v_id := public.lancar(v_banco, 'saida', (select id from public.categorias_financeiras where nome = 'Outras despesas'),
        least(v_mes + 15, current_date), 980.00, 'Camisetas personalizadas para a diretoria ' || c_marca, null);
      v_despesas_mes := v_despesas_mes || v_id;
    end if;

    if not v_atual then
      perform public.transferir(v_caixa, v_banco, least(v_mes + 7, current_date), round(v_oferta * 0.8, 2),
        'Depósito das ofertas de ' || v_nome_mes || ' ' || c_marca);
    end if;

    -- ---------- Presidência autoriza (o mês atual fica aguardando) ----------
    if not v_atual then
      perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
      perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
      foreach v_id in array v_despesas_mes loop
        if exists (select 1 from public.lancamentos where id = v_id and descricao like 'Camisetas%') then
          perform public.autorizar_despesa(v_id, false, 'Não está no orçamento do exercício.');
        else
          perform public.autorizar_despesa(v_id, true, null);
        end if;
      end loop;
    end if;

    v_mes := (v_mes + interval '1 month')::date;
  end loop;
end
$$;

select nome, saldo, aguardando_autorizacao from public.vw_saldos_contas order by tipo;
