-- =====================================================================
-- SEMENTE DO PEDIDO DE AGE — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
-- Um pedido de Assembleia Extraordinária fictício, aberto por um associado fictício em dia e assinado por mais dois,
-- para a diretoria ver a tela com assinaturas e para o teste de ponta a ponta (os usuários fictícios dos testes não podem
-- assinar: a presidência fictícia não é associada e o ministro fictício está em atraso de propósito).
-- Os três são escolhidos entre os associados fictícios ativos sem contribuição vencida.
-- =====================================================================
do $$
declare
  v_assinantes uuid[];
  v_pedido uuid;
  v_i integer;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.pedidos_age where titulo = 'Pedido fictício de AGE (teste)') then
    raise notice 'A semente do pedido de AGE já foi aplicada antes: nada a fazer.';
    return;
  end if;
  select array_agg(pessoa_id order by nome) into v_assinantes from (
    select a.pessoa_id, pe.nome from public.associados a join public.pessoas pe on pe.id = a.pessoa_id
    where a.arquivado_em is null and a.situacao = 'ativo' and coalesce(pe.email, '') not like 'e2e.%'
      and not exists (select 1 from public.cobrancas c where c.pessoa_id = a.pessoa_id and c.situacao = 'aberta'
                      and c.vencimento < current_date and c.arquivado_em is null)
    order by pe.nome limit 3
  ) x;
  if coalesce(cardinality(v_assinantes), 0) < 3 then
    raise exception 'Não há três associados fictícios em dia para assinar.';
  end if;
  insert into public.pedidos_age (titulo, justificativa, pauta, autor_id, prazo)
  values ('Pedido fictício de AGE (teste)',
          'Pedido fictício do ambiente de teste, para conferir a tela dos pedidos de assembleia e as assinaturas.',
          '[{"titulo": "Assunto fictício para a assembleia", "descricao": "Item de teste"}]'::jsonb,
          v_assinantes[1], current_date + 60)
  returning id into v_pedido;
  for v_i in 1..3 loop
    insert into public.pedido_age_assinaturas (pedido_id, pessoa_id, assinado_em)
    values (v_pedido, v_assinantes[v_i], now() - make_interval(hours => 4 - v_i));
  end loop;
end;
$$;
