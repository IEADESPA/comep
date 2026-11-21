-- =====================================================================
-- SEMENTE DA BLINDAGEM DO CAIXA — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql e da migração 20261121090000_financeiro_blindagem.sql. Se rodar de novo, não faz nada.
--
-- Um evento FICTÍCIO publicado, com a inscrição pelo site (taxa de R$ 1,00) e o orçamento já aprovado, para o teste de
-- ponta a ponta financeiro-blindagem.spec: a inscrição paga e a despesa lançada no evento chegam ao extrato e ao mês do
-- Conselho Fiscal. A aprovação do orçamento pede uma AGO ou AGE instalada (o teste conducao.spec instala as dele); aqui
-- a semente liga o evento à AGE instalada mais recente, direto no banco (a regra da aprovação é testada em
-- testes/banco/eventos.test.ts). O evento fica um ano à frente, para não sair da agenda.
-- =====================================================================
do $$
declare
  v_age uuid;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.eventos where titulo = 'Evento fictício da blindagem do caixa (E2E)' and arquivado_em is null) then
    raise notice 'A semente da blindagem já foi aplicada antes: nada a fazer.';
    return;
  end if;
  select id into v_age from public.encontros
  where tipo in ('ago', 'age') and instalada_em is not null and arquivado_em is null
  order by instalada_em desc
  limit 1;
  if v_age is null then
    raise exception 'Não há AGO ou AGE instalada no banco de teste: rode antes o ponta a ponta conducao.spec.';
  end if;
  insert into public.eventos (titulo, descricao, local, inicio, inscricao, inscricao_publica, taxa, orcamento, orcamento_definido_em,
                              orcamento_encontro_id, orcamento_aprovado_em, situacao, publicado_em)
  values ('Evento fictício da blindagem do caixa (E2E)',
          'Evento FICTÍCIO do ambiente de teste: o teste automático paga uma inscrição e lança uma despesa (e desfaz no fim).',
          'Local fictício (teste automático)', now() + interval '365 days', true, true, 1.00, 100.00, now(),
          v_age, now(), 'publicado', now());
end;
$$;
