-- =====================================================================
-- SEMENTE DA ASSEMBLEIA DE ELEIÇÃO — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
-- Revisão da Fase 4: a diretoria eleita é registrada com a AGO ou AGE instalada que a elegeu. Esta AGO
-- FICTÍCIA (outubro de 2025, já realizada e instalada) serve para os testes automáticos escolherem a
-- assembleia ao registrar uma diretoria. Marcada pelo local "Sede fictícia do COMEP (teste)".
-- =====================================================================
do $$
declare
  c_local constant text := 'Sede fictícia do COMEP (teste)';
  c_titulo constant text := 'AGO de eleição da diretoria (fictícia)';
  v_ago uuid;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.encontros where local = c_local and titulo = c_titulo) then
    raise notice 'A semente da assembleia de eleição já foi aplicada antes: nada a fazer.';
    return;
  end if;

  insert into public.encontros (tipo, titulo, inicio, local, edital, situacao, convocado_em, instalada_em, chamada,
                                aptos_na_instalacao, presentes_aptos_na_instalacao, presentes_na_instalacao,
                                segunda_chamada_minutos, presenca_encerrada_em)
  values ('ago', c_titulo, '2025-10-20 19:00:00-03', c_local,
          'Edital fictício do ambiente de teste.', 'realizado', '2025-09-15 10:00:00-03', '2025-10-20 20:00:00-03', 'segunda',
          0, 0, 0, 60, '2025-10-20 22:00:00-03')
  returning id into v_ago;
  insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria) values
    (v_ago, 1, 'Eleição do Conselho Diretor e do Conselho Fiscal (fictícia)', 'Art. 12 e Art. 14', true, 'simples');
end;
$$;
