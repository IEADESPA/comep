-- =====================================================================
-- SEMENTE DE PAGAMENTOS FICTÍCIOS — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
-- Para os associados da semente, no exercício atual (pelas regras do sistema,
-- como a presidência fictícia — "registrar pagamento recebido"):
--   * 2 em cada 10 escolhem a anuidade: metade paga, metade não (em atraso);
--   * 5 em cada 10 pagam tudo o que já venceu (em dia);
--   * 2 em cada 10 pagam quase tudo, menos os 2 últimos meses vencidos (em atraso);
--   * 1 em cada 10 não paga nada (em atraso).
-- =====================================================================
do $$
declare
  c_marca constant text := 'Dado fictício (semente de teste).';
  c_marca_pagamento constant text := 'Pagamento fictício (semente de teste).';
  v_presidencia uuid;
  v_exercicio integer := interno.exercicio_de(current_date);
  v_formas text[] := array['PIX', 'PIX', 'Dinheiro', 'Depósito', 'Transferência'];
  v_assoc record;
  v_cobranca record;
  v_grupo integer;
  v_vencidas integer;
  v_n integer;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if not exists (select 1 from public.associados where observacoes = c_marca) then
    raise exception 'Rode antes a semente principal (semente-teste.sql).';
  end if;
  if exists (select 1 from public.cobrancas where observacao = c_marca_pagamento) then
    raise notice 'A semente de pagamentos já foi aplicada antes: nada a fazer.';
    return;
  end if;

  select id into v_presidencia from auth.users where email = 'e2e.presidencia@example.com';
  perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
  perform setseed(0.7);

  for v_assoc in
    select a.pessoa_id, row_number() over (order by a.numero_registro) as k
    from public.associados a
    where a.observacoes = c_marca and a.arquivado_em is null and a.situacao = 'ativo' and not a.jubilado
  loop
    v_grupo := v_assoc.k % 10;

    -- Plano anual (antes de qualquer pagamento)
    if v_grupo in (0, 1) and not exists (
      select 1 from public.cobrancas where pessoa_id = v_assoc.pessoa_id and exercicio = v_exercicio and situacao = 'paga'
    ) then
      perform public.escolher_plano(v_assoc.pessoa_id, v_exercicio, 'anual');
    end if;
    perform interno.gerar_cobrancas_pessoa(v_assoc.pessoa_id, v_exercicio);

    continue when v_grupo in (1, 9); -- anual sem pagar, ou não pagou nada

    select count(*) into v_vencidas from public.cobrancas
    where pessoa_id = v_assoc.pessoa_id and exercicio = v_exercicio and situacao = 'aberta' and vencimento < current_date;
    v_n := 0;
    for v_cobranca in
      select id, valor, vencimento from public.cobrancas
      where pessoa_id = v_assoc.pessoa_id and exercicio = v_exercicio and situacao = 'aberta' and vencimento < current_date
      order by vencimento
    loop
      v_n := v_n + 1;
      exit when v_grupo in (7, 8) and v_n > v_vencidas - 2; -- deixa os 2 últimos vencidos em aberto
      perform public.registrar_pagamento(
        v_cobranca.id,
        least(current_date, v_cobranca.vencimento - floor(random() * 6)::int),
        v_cobranca.valor,
        v_formas[1 + floor(random() * array_length(v_formas, 1))::int],
        c_marca_pagamento
      );
    end loop;
  end loop;
  raise notice 'Semente de pagamentos aplicada.';
end
$$;

select
  count(*) filter (where em_dia) as em_dia,
  count(*) filter (where not em_dia) as em_atraso,
  sum(valor_vencido) as total_vencido
from public.vw_situacao_contribuicao;
