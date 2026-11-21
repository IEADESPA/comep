-- Telas novas, parte 13 (Fase 5.5): "Quem mexeu nos seus dados" (Meu perfil › Privacidade) ficava lento demais.
-- A auditoria do banco de teste já passa de 76 mil linhas, e a busca pela pessoa_id dentro do JSON lia a tabela
-- inteira: 3 s com o banco folgado, e passou do limite de 8 s durante o ponta a ponta (a tela mostrava o erro). A
-- auditoria só cresce, então a produção chegaria lá também.
-- Agora: um índice pela pessoa do registro, e a busca em duas partes, cada uma pelo seu índice (o cadastro da pessoa
-- por auditoria_registro; o resto por auditoria_pessoa). O resultado é o mesmo da função anterior.

create index auditoria_pessoa on public.auditoria ((coalesce(dados_depois ->> 'pessoa_id', dados_antes ->> 'pessoa_id')), ocorrido_em desc);

create or replace function interno.quem_mexeu_nos_dados(p_pessoa uuid, p_dias integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with limites as (
    select now() - make_interval(days => greatest(1, least(coalesce(p_dias, 90), 365))) as desde,
           (select pe.usuario_id from public.pessoas pe where pe.id = p_pessoa) as dela
  ),
  achados as (
    -- o cadastro da própria pessoa (pelo índice auditoria_registro); o que ela mesma fez não entra
    (select a.tabela, a.operacao, a.usuario_id, a.ocorrido_em
       from public.auditoria a, limites l
      where a.tabela = 'pessoas'
        and a.registro_id = p_pessoa::text
        and a.ocorrido_em > l.desde
        and (l.dela is null or a.usuario_id is distinct from l.dela)
      order by a.ocorrido_em desc
      limit 30)
    union all
    -- o que leva a pessoa_id dela (pelo índice auditoria_pessoa)
    (select a.tabela, a.operacao, a.usuario_id, a.ocorrido_em
       from public.auditoria a, limites l
      where coalesce(a.dados_depois ->> 'pessoa_id', a.dados_antes ->> 'pessoa_id') = p_pessoa::text
        and a.tabela in ('associados', 'vinculos_igreja', 'titulos_pessoa', 'cobrancas', 'informes_pagamento',
                         'pedidos_correcao', 'pedidos_associacao', 'perfis_acesso')
        and a.ocorrido_em > l.desde
        and (l.dela is null or a.usuario_id is distinct from l.dela)
      order by a.ocorrido_em desc
      limit 30)
  )
  select coalesce(jsonb_agg(x order by x ->> 'em' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'em', a.ocorrido_em,
      'quem', coalesce(p.nome, 'O sistema'),
      'perfil', (select string_agg(distinct pa.perfil::text, ', ') from public.perfis_acesso pa where pa.pessoa_id = p.id and pa.arquivado_em is null),
      'o_que', case a.tabela
        when 'pessoas' then 'o seu cadastro'
        when 'associados' then 'a sua associação'
        when 'vinculos_igreja' then 'a sua igreja'
        when 'titulos_pessoa' then 'o seu título'
        when 'cobrancas' then 'as suas contribuições'
        when 'informes_pagamento' then 'os seus comprovantes'
        when 'pedidos_correcao' then 'um pedido de correção'
        when 'pedidos_associacao' then 'o seu pedido de associação'
        when 'perfis_acesso' then 'os seus perfis de acesso'
        else a.tabela end,
      'operacao', a.operacao
    ) as x
    from (select * from achados order by ocorrido_em desc limit 30) a
    left join public.pessoas p on p.usuario_id = a.usuario_id
  ) y;
$$;

revoke all on function interno.quem_mexeu_nos_dados(uuid, integer) from public;
