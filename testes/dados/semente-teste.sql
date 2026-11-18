-- =====================================================================
-- SEMENTE DE DADOS FICTÍCIOS — SÓ PARA O BANCO DE TESTE (comep-teste)
--
-- Enche o ambiente de teste para a diretoria ver o sistema "cheio"
-- (decisão de 12/11/2026: o sistema fica em teste até a versão 5.0).
-- Tudo é INVENTADO: nomes de pessoas e igrejas, telefones (94) 90000-xxxx,
-- e-mails @example.com. Bairros e denominações são nomes públicos.
--
-- Os dados passam pelas MESMAS regras do sistema (cadastro direto, troca de
-- igreja, pedido, aprovação em assembleia), executadas como a presidência
-- fictícia (e2e.presidencia@example.com). A auditoria registra tudo.
--
-- Rodar (uma vez; se rodar de novo, não faz nada):
--   npx supabase db query --remote=<ref do comep-teste> -f testes/dados/semente-teste.sql
-- Depois, enviar as fotos e comprovantes fictícios: node testes/dados/arquivos-semente.mjs
-- =====================================================================
do $$
declare
  c_marca constant text := 'Dado fictício (semente de teste).';
  v_presidencia uuid;
  v_igrejas uuid[];
  v_titulos uuid[];
  v_titulo_pastor uuid;
  v_titulo_evangelista uuid;
  v_masc text[] := array['José','João','Antônio','Francisco','Carlos','Paulo','Pedro','Lucas','Marcos','Luiz',
                         'Gabriel','Rafael','Daniel','Marcelo','Bruno','Eduardo','Felipe','Raimundo','Rodrigo','Manoel',
                         'Sebastião','Samuel','Davi','Elias','Josué','Natanael','Moisés','Timóteo','Ezequiel','Jonas'];
  v_fem  text[] := array['Maria','Ana','Francisca','Antônia','Adriana','Juliana','Márcia','Fernanda','Patrícia','Aline',
                         'Sandra','Camila','Raimunda','Débora','Raquel','Rute','Ester','Sara','Priscila','Lídia'];
  v_sobre text[] := array['Silva','Santos','Oliveira','Souza','Lima','Pereira','Ferreira','Costa','Rodrigues','Almeida',
                          'Nascimento','Alves','Carvalho','Araújo','Ribeiro','Gomes','Martins','Rocha','Barbosa','Moraes',
                          'Cardoso','Teixeira','Correia','Batista','Pinheiro','Monteiro','Mendes','Nunes','Vieira','Freitas',
                          'Cavalcante','Dias','Castro','Campos','Moura','Brito','Leite','Sales','Farias','Bezerra'];
  v_funcoes text[] := array['Pastor auxiliar','Evangelista dirigente','Pastor de congregação','Líder de jovens',
                            'Missionário(a)','Líder de louvor','Diácono','Professor da EBD'];
  v_nome text;
  v_email text;
  v_pessoa uuid;
  v_pedido uuid;
  v_igreja uuid;
  v_titulo uuid;
  v_feminino boolean;
  v_usados text[] := '{}';
  v_datas_ago date[] := array['2025-04-24','2025-10-23','2026-04-23','2026-10-22']::date[];
  v_nomes_igrejas_informadas text[] := array['Igreja Evangélica Esperança do Norte','Missão Evangélica Vida Plena'];
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.associados where observacoes = c_marca) then
    raise notice 'A semente já foi aplicada antes: nada a fazer.';
    return;
  end if;

  -- Age como a presidência fictícia (as regras do sistema conferem o perfil)
  select id into v_presidencia from auth.users where email = 'e2e.presidencia@example.com';
  if v_presidencia is null then
    raise exception 'Usuário fictício da presidência não encontrado.';
  end if;
  perform set_config('request.jwt.claim.sub', v_presidencia::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_presidencia, 'role', 'authenticated')::text, true);
  perform setseed(0.42);

  -- Bairros de Parauapebas
  insert into public.bairros (nome)
  select b from unnest(array['Cidade Jardim','Rio Verde','Beira Rio','Liberdade','Primavera','União','Altamira',
    'Nova Carajás','Jardim Canadá','Bairro da Paz','Tropical','Novo Brasil','Esplanada','Casas Populares',
    'Linha Verde','Vila Rica','Guanabara','Paraíso','Novo Horizonte','Cidade Nova']) as b
  where not exists (select 1 from public.bairros x where lower(x.nome) = lower(b) and x.arquivado_em is null);

  -- Denominações
  insert into public.denominacoes (nome, sigla)
  select d.nome, d.sigla
  from (values ('Assembleia de Deus','AD'), ('Batista',null), ('Presbiteriana',null), ('Quadrangular','IEQ'),
               ('Metodista',null), ('Pentecostal',null), ('Nazareno',null), ('Comunidade evangélica',null),
               ('Batista renovada',null), ('Presbiteriana renovada',null), ('O Brasil para Cristo','OBPC')) as d (nome, sigla)
  where not exists (select 1 from public.denominacoes x where lower(x.nome) = lower(d.nome) and x.arquivado_em is null);

  -- Igrejas (nomes inventados)
  insert into public.igrejas (nome, denominacao_id, bairro_id, endereco, telefone)
  select v.nome, d.id, b.id, v.endereco, v.telefone
  from (values
    ('Igreja Evangélica Monte Sião','Assembleia de Deus','Cidade Jardim','Rua das Palmeiras, 120','(94) 90000-1001'),
    ('Igreja Batista Esperança Viva','Batista','Rio Verde','Avenida dos Ipês, 455','(94) 90000-1002'),
    ('Igreja Presbiteriana Caminho da Graça','Presbiteriana','Beira Rio','Rua do Sol, 33','(94) 90000-1003'),
    ('Igreja do Evangelho Quadrangular Nova Aliança','Quadrangular','Liberdade','Rua Sete, 870','(94) 90000-1004'),
    ('Comunidade Cristã Água da Vida','Comunidade evangélica','Primavera','Rua das Acácias, 15','(94) 90000-1005'),
    ('Igreja Evangélica Pentecostal Fonte de Luz','Pentecostal','União','Travessa Boa Vista, 210','(94) 90000-1006'),
    ('Igreja Metodista Semear','Metodista','Altamira','Rua Castanheira, 64','(94) 90000-1007'),
    ('Igreja Batista Peniel','Batista','Nova Carajás','Avenida Central, 1500','(94) 90000-1008'),
    ('Igreja Assembleia Betel','Assembleia de Deus','Jardim Canadá','Rua Quebec, 300','(94) 90000-1009'),
    ('Igreja Evangélica Rocha Eterna','Pentecostal','Bairro da Paz','Rua da Paz, 77','(94) 90000-1010'),
    ('Igreja do Nazareno Vale da Bênção','Nazareno','Tropical','Rua dos Cajueiros, 12','(94) 90000-1011'),
    ('Igreja Evangélica Shalom','Comunidade evangélica','Novo Brasil','Rua Amazonas, 540','(94) 90000-1012'),
    ('Igreja Pentecostal Chama Viva','Pentecostal','Esplanada','Avenida Esplanada, 98','(94) 90000-1013'),
    ('Igreja Batista Renovada Ebenézer','Batista renovada','Casas Populares','Rua Quatro, 401','(94) 90000-1014'),
    ('Igreja O Brasil para Cristo Maranata','O Brasil para Cristo','Linha Verde','Rua Linha Verde, 1200','(94) 90000-1015'),
    ('Ministério Ágape','Comunidade evangélica','Vila Rica','Rua Rio Branco, 56','(94) 90000-1016'),
    ('Igreja Evangélica Luz do Mundo','Assembleia de Deus','Guanabara','Rua Guanabara, 230','(94) 90000-1017'),
    ('Igreja Presbiteriana Renovada Getsêmani','Presbiteriana renovada','Paraíso','Rua Paraíso, 88','(94) 90000-1018'),
    ('Comunidade Evangélica Novo Tempo','Comunidade evangélica','Novo Horizonte','Avenida Horizonte, 700','(94) 90000-1019'),
    ('Igreja Evangélica Monte Moriá','Assembleia de Deus','Cidade Nova','Rua Moriá, 19','(94) 90000-1020')
  ) as v (nome, denom, bairro, endereco, telefone)
  join public.denominacoes d on lower(d.nome) = lower(v.denom) and d.arquivado_em is null
  join public.bairros b on lower(b.nome) = lower(v.bairro) and b.arquivado_em is null
  where not exists (select 1 from public.igrejas x where x.nome = v.nome and x.arquivado_em is null);

  select array_agg(id order by telefone) into v_igrejas
  from public.igrejas where telefone like '(94) 90000-10%' and arquivado_em is null;
  select array_agg(id order by ordem) into v_titulos from public.titulos_ministeriais where arquivado_em is null;
  select id into v_titulo_pastor from public.titulos_ministeriais where nome = 'Pastor(a)' and arquivado_em is null;
  select id into v_titulo_evangelista from public.titulos_ministeriais where nome = 'Evangelista' and arquivado_em is null;

  -- 50 associados atuais (cadastro direto da secretaria — Art. 7º, a)
  for i in 1..50 loop
    loop
      v_feminino := random() < 0.3;
      v_nome := (case when v_feminino then v_fem[1 + floor(random() * array_length(v_fem, 1))::int]
                      else v_masc[1 + floor(random() * array_length(v_masc, 1))::int] end)
                || ' ' || v_sobre[1 + floor(random() * array_length(v_sobre, 1))::int]
                || ' ' || v_sobre[1 + floor(random() * array_length(v_sobre, 1))::int];
      exit when not (v_nome = any (v_usados));
    end loop;
    v_usados := v_usados || v_nome;
    v_email := lower(translate(split_part(v_nome, ' ', 1) || '.' || split_part(v_nome, ' ', 3) || i,
                     'áàâãéêíóôõúçÁÉÍÓÚÇ', 'aaaaeeioooucaeiouc')) || '@example.com';
    v_igreja := v_igrejas[1 + ((i - 1) % array_length(v_igrejas, 1))];
    -- os 20 primeiros presidem uma igreja cada; os demais são auxiliares, evangelistas, líderes...
    v_titulo := case
      when i <= 20 then (array[v_titulo_pastor, v_titulo_pastor, v_titulo_pastor, v_titulos[4], v_titulos[5]])[1 + floor(random() * 5)::int]
      else v_titulos[1 + floor(random() * 3)::int]
    end;

    v_pessoa := public.cadastrar_associado(
      v_nome,
      v_email,
      '(94) 90000-' || lpad((2000 + i)::text, 4, '0'),
      v_titulo,
      date '1990-01-01' + floor(random() * 12000)::int,
      v_igreja,
      case when i <= 20 then null else v_funcoes[1 + floor(random() * array_length(v_funcoes, 1))::int] end,
      date '2008-01-01' + floor(random() * 5000)::int,
      date '2015-01-01' + floor(random() * 2300)::int,
      c_marca,
      i <= 20,
      i in (44, 47, 50)
    );
    update public.pessoas set foto_caminho = 'pessoas/' || v_pessoa || '/foto-semente.png' where id = v_pessoa;

    -- Histórico de título: alguns eram evangelistas e foram consagrados pastores
    if i % 6 = 0 then
      -- (o título atual é o último registrado: o antigo fica com data de registro anterior)
      update public.titulos_pessoa
      set titulo_id = v_titulo_evangelista, desde = date '2000-01-01' + floor(random() * 3000)::int,
          criado_em = now() - interval '1 day'
      where pessoa_id = v_pessoa;
      insert into public.titulos_pessoa (pessoa_id, titulo_id, desde)
      values (v_pessoa, v_titulo_pastor, date '2012-01-01' + floor(random() * 4000)::int);
    end if;

    -- Histórico de igreja: alguns auxiliares mudaram de igreja
    if i > 20 and i % 4 = 0 then
      perform public.mudar_igreja(
        v_pessoa,
        v_igrejas[1 + ((i + 6) % array_length(v_igrejas, 1))],
        v_funcoes[1 + floor(random() * array_length(v_funcoes, 1))::int],
        date '2023-01-01' + floor(random() * 600)::int,
        false
      );
    end if;
  end loop;

  -- 19 pedidos de associação em todas as situações
  for j in 1..19 loop
    loop
      v_feminino := random() < 0.35;
      v_nome := (case when v_feminino then v_fem[1 + floor(random() * array_length(v_fem, 1))::int]
                      else v_masc[1 + floor(random() * array_length(v_masc, 1))::int] end)
                || ' ' || v_sobre[1 + floor(random() * array_length(v_sobre, 1))::int]
                || ' ' || v_sobre[1 + floor(random() * array_length(v_sobre, 1))::int];
      exit when not (v_nome = any (v_usados));
    end loop;
    v_usados := v_usados || v_nome;
    insert into public.pessoas (nome, email, telefone)
    values (
      v_nome,
      lower(translate(split_part(v_nome, ' ', 1) || '.' || split_part(v_nome, ' ', 3) || '.candidato' || j,
                      'áàâãéêíóôõúçÁÉÍÓÚÇ', 'aaaaeeioooucaeiouc')) || '@example.com',
      '(94) 90000-' || lpad((3000 + j)::text, 4, '0')
    )
    returning id into v_pessoa;
    update public.pessoas set foto_caminho = 'pessoas/' || v_pessoa || '/foto-semente.png' where id = v_pessoa;

    insert into public.pedidos_associacao (
      pessoa_id, titulo_id, titulo_desde, igreja_id, igreja_informada, denominacao_informada, funcao,
      foto_caminho, comprovante_caminho, observacoes, declara_principios_fe, declara_estatuto, consente_lgpd
    ) values (
      v_pessoa,
      v_titulos[1 + floor(random() * 3)::int],
      date '2005-01-01' + floor(random() * 6000)::int,
      case when j in (2, 4) then null else v_igrejas[1 + floor(random() * array_length(v_igrejas, 1))::int] end,
      case when j in (2, 4) then v_nomes_igrejas_informadas[j / 2] end,
      case when j in (2, 4) then 'Pentecostal' end,
      v_funcoes[1 + floor(random() * array_length(v_funcoes, 1))::int],
      'pessoas/' || v_pessoa || '/foto-semente.png',
      'pessoas/' || v_pessoa || '/comprovante-semente.pdf',
      case when j % 3 = 0 then 'Pedido fictício gerado para teste.' end,
      true, true, true
    )
    returning id into v_pedido;

    if j in (5, 6) then
      update public.pedidos_associacao
      set situacao = 'pendencia',
          mensagem_pendencia = case j when 5 then 'O comprovante enviado está ilegível. Envie outra foto da credencial.'
                                      else 'Falta a data de consagração. Corrija e reenvie.' end
      where id = v_pedido;
    elsif j between 7 and 9 then
      -- a conferência item por item (parte 4) vem antes de mandar para a AGO
      insert into public.pedidos_associacao_itens (pedido_id, item, situacao, conferido_em)
      select v_pedido, unnest(interno.itens_do_pedido()), 'aprovado', now();
      update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = v_pedido;
    elsif j in (10, 11) then
      update public.pedidos_associacao
      set situacao = 'recusado',
          motivo_recusa = case j when 10 then 'A igreja informada não declarou os princípios de fé do Art. 7º, §1º.'
                                 else 'Título não reconhecido pela denominação.' end
      where id = v_pedido;
    elsif j >= 12 then
      insert into public.pedidos_associacao_itens (pedido_id, item, situacao, conferido_em)
      select v_pedido, unnest(interno.itens_do_pedido()), 'aprovado', now();
      update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = v_pedido;
      perform public.aprovar_pedido(
        v_pedido,
        v_datas_ago[1 + (j % array_length(v_datas_ago, 1))],
        'Ata nº ' || (10 + (j % array_length(v_datas_ago, 1))) || '/AGO'
      );
    end if;
  end loop;

  -- 3 pedidos de troca de igreja pendentes (feitos pelos próprios ministros)
  insert into public.pedidos_troca_igreja (pessoa_id, igreja_id, funcao, a_partir_de, observacao)
  select a.pessoa_id,
         v_igrejas[1 + ((array_position(v_igrejas, v.igreja_id) - 1 + 5) % array_length(v_igrejas, 1))],
         'Pastor auxiliar', current_date + 15, 'Pedido fictício gerado para teste.'
  from public.associados a
  join public.vinculos_igreja v on v.pessoa_id = a.pessoa_id and v.fim is null and not v.pastor_presidente
  where a.observacoes = c_marca and a.arquivado_em is null
  order by a.numero_registro desc
  limit 3;

  raise notice 'Semente aplicada.';
end
$$;

select
  (select count(*) from public.associados where arquivado_em is null) as associados_ativos,
  (select count(*) from public.igrejas where arquivado_em is null) as igrejas,
  (select count(*) from public.vinculos_igreja where pastor_presidente and fim is null and arquivado_em is null) as pastores_presidentes,
  (select count(*) from public.associados where jubilado and arquivado_em is null) as jubilados,
  (select count(*) from public.pedidos_troca_igreja where situacao = 'pendente') as trocas_pendentes,
  (select string_agg(situacao::text || ': ' || n, ', ') from (
     select situacao, count(*) as n from public.pedidos_associacao group by situacao order by situacao) s) as pedidos;
