-- =====================================================================
-- SEMENTE DAS ASSEMBLEIAS E REUNIÕES — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
--   * AGO de abril de 2027, CONVOCADA (aparece no site), com pauta e edital;
--   * AGE de reforma do estatuto, ainda em RASCUNHO (só a secretaria e a presidência veem);
--   * reuniões mensais fictícias (1ª terça, 19h30): dezembro e janeiro publicadas, fevereiro em rascunho.
-- Tudo marcado pelo local "Sede fictícia do COMEP (teste)". Datas e textos fictícios.
-- =====================================================================
do $$
declare
  c_local constant text := 'Sede fictícia do COMEP (teste)';
  v_presidente uuid;
  v_ago uuid;
  v_age uuid;
  v_reuniao uuid;
  v_data timestamptz;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.encontros where local = c_local and titulo = 'Assembleia Geral Ordinária — abril de 2027') then
    raise notice 'A semente das assembleias já foi aplicada antes: nada a fazer.';
    return;
  end if;
  select pa.pessoa_id into v_presidente from public.perfis_acesso pa where pa.perfil = 'presidencia' and pa.arquivado_em is null limit 1;

  -- AGO de abril de 2027 (convocada)
  insert into public.encontros (tipo, titulo, inicio, local, edital, situacao, convocado_em, convocado_por)
  values (
    'ago',
    'Assembleia Geral Ordinária — abril de 2027',
    '2027-04-22 19:00:00-03',
    c_local,
    E'EDITAL DE CONVOCAÇÃO — ASSEMBLEIA GERAL ORDINÁRIA\n\n'
    || 'O Presidente do Conselho de Ministros Evangélicos de Parauapebas (COMEP), no uso das atribuições que lhe confere o Estatuto '
    || '(Art. 16, §2º), convoca os associados para a Assembleia Geral Ordinária, que será realizada quinta-feira, 22 de abril de 2027, '
    || 'às 19h00, em ' || c_local || ', em primeira chamada com a presença de metade mais um dos associados aptos e, em segunda chamada, '
    || E'60 minutos depois, com qualquer número de presentes (Art. 16, §4º), para tratar da seguinte pauta:\n\n'
    || E'1. Balanço do exercício 2026/2027 e parecer do Conselho Fiscal\n'
    || E'2. Orçamento e plano de trabalho 2027/2028\n'
    || E'3. Admissão de novos associados\n'
    || E'4. Informes\n\n'
    || E'Só votam e são votados os associados em dia com os seus compromissos (Art. 11).\n\n'
    || E'Parauapebas, 13 de novembro de 2026.\n\nPresidente do COMEP\n\n(Texto fictício do ambiente de teste.)',
    'convocado',
    now(),
    v_presidente
  )
  returning id into v_ago;
  insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria) values
    (v_ago, 1, 'Balanço do exercício 2026/2027 e parecer do Conselho Fiscal', 'Art. 15 e Art. 14', true, 'simples'),
    (v_ago, 2, 'Orçamento e plano de trabalho 2027/2028', 'Art. 15, I', true, 'simples'),
    (v_ago, 3, 'Admissão de novos associados', 'Art. 7º, a', true, 'simples'),
    (v_ago, 4, 'Informes', null, false, null);

  -- AGE de reforma do estatuto (rascunho)
  insert into public.encontros (tipo, titulo, inicio, local, fundamento)
  values ('age', 'Assembleia Geral Extraordinária — reforma do estatuto (exemplo)', '2027-02-18 19:00:00-03', c_local,
          'Maioria do Conselho Diretor (exemplo fictício)')
  returning id into v_age;
  insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria) values
    (v_age, 1, 'Reforma do estatuto', 'Correção das lacunas encontradas (PROJETO.md, seção 13.8). Exige 2/3 (Art. 21).', true, 'dois_tercos');

  -- Reuniões mensais: 1ª terça, 19h30
  foreach v_data in array array['2026-12-01 19:30:00-03', '2027-01-05 19:30:00-03', '2027-02-02 19:30:00-03']::timestamptz[] loop
    insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, convocado_por)
    values (
      'reuniao_mensal',
      'Reunião mensal — ' || to_char(v_data at time zone 'America/Belem', 'MM/YYYY'),
      v_data,
      c_local,
      case when v_data < '2027-02-01' then 'convocado' else 'agendado' end::public.situacao_encontro,
      case when v_data < '2027-02-01' then now() end,
      case when v_data < '2027-02-01' then v_presidente end
    )
    returning id into v_reuniao;
    insert into public.encontro_pauta (encontro_id, ordem, titulo) values
      (v_reuniao, 1, 'Oração e comunhão'),
      (v_reuniao, 2, 'Informes da diretoria');
  end loop;

  raise notice 'Semente das assembleias aplicada: 1 AGO convocada, 1 AGE em rascunho e 3 reuniões mensais.';
end;
$$;
