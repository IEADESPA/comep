-- =====================================================================
-- SEMENTE DO PATRIMÔNIO — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
-- Bens fictícios parecidos com os do COMEP (cadeiras, som, palco), para a diretoria ver a tela do patrimônio com
-- alguma coisa. O teste de ponta a ponta usa outro bem, o "Cadeira de teste (E2E)", que ele mesmo cria.
-- =====================================================================
do $$
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.patrimonio_itens where nome = 'Cadeira plástica branca (fictícia)') then
    raise notice 'A semente do patrimônio já foi aplicada antes: nada a fazer.';
    return;
  end if;
  insert into public.patrimonio_itens (nome, categoria, quantidade, emprestavel, forma_aquisicao, adquirido_em, valor_unitario, local_guarda)
  values
    ('Cadeira plástica branca (fictícia)', 'Mobiliário', 350, true, 'compra', '2025-03-10', 45.90, 'Depósito da sede (fictício)'),
    ('Caixa de som ativa 15" (fictícia)', 'Som', 4, true, 'compra', '2025-06-02', 1890.00, 'Depósito da sede (fictício)'),
    ('Mesa de som 12 canais (fictícia)', 'Som', 1, true, 'doacao', '2024-11-20', null, 'Sala da secretaria (fictícia)'),
    ('Microfone sem fio (fictício)', 'Som', 6, true, 'compra', '2025-06-02', 320.00, 'Sala da secretaria (fictícia)'),
    ('Palco modular 1 × 2 m (fictício)', 'Estrutura', 8, true, 'compra', '2025-08-15', 980.00, 'Depósito da sede (fictício)'),
    ('Projetor (fictício)', 'Eletrônicos', 1, false, 'doacao', '2023-05-01', null, 'Sala da presidência (fictícia)');
end;
$$;
