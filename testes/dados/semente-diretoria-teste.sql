-- =====================================================================
-- SEMENTE DA DIRETORIA — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
-- Diretoria e Conselho Fiscal FICTÍCIOS (associados fictícios em dia), mandato de 01/01/2026 a 31/12/2029
-- (a mesma data fictícia do fim do mandato nas credenciais). A diretoria verdadeira depende da pergunta 10.
-- Os associados fictícios não têm login: os perfis que os cargos dão não mudam o acesso de ninguém no teste.
-- =====================================================================
do $$
declare
  c_marca constant text := 'Dado fictício (semente de teste).';
  v_cargos public.cargo[] := array[
    'presidente', 'vice_presidente', 'primeiro_secretario', 'segundo_secretario', 'primeiro_tesoureiro',
    'segundo_tesoureiro', 'secretario_executivo', 'conselheiro_fiscal', 'conselheiro_fiscal', 'conselheiro_fiscal'
  ]::public.cargo[];
  v_pessoas uuid[];
  i integer;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.mandatos m join public.associados a on a.pessoa_id = m.pessoa_id where a.observacoes = c_marca) then
    raise notice 'A semente da diretoria já foi aplicada antes: nada a fazer.';
    return;
  end if;
  -- os 10 primeiros associados fictícios em dia e sem login
  select array_agg(x.pessoa_id order by x.numero_registro) into v_pessoas
  from (
    select a.pessoa_id, a.numero_registro
    from public.associados a
    join public.pessoas p on p.id = a.pessoa_id
    where a.arquivado_em is null and a.situacao = 'ativo' and a.observacoes = c_marca and p.usuario_id is null
      and not exists (
        select 1 from public.cobrancas c
        where c.pessoa_id = a.pessoa_id and c.situacao = 'aberta' and c.vencimento < current_date and c.arquivado_em is null
      )
    order by a.numero_registro
    limit 10
  ) x;
  if coalesce(array_length(v_pessoas, 1), 0) < 10 then
    raise exception 'Faltam associados fictícios em dia para a semente da diretoria.';
  end if;
  for i in 1..10 loop
    insert into public.mandatos (pessoa_id, cargo, inicio, fim) values (v_pessoas[i], v_cargos[i], '2026-01-01', '2029-12-31');
  end loop;
  raise notice 'Semente da diretoria aplicada: 7 cargos do Conselho Diretor e 3 do Conselho Fiscal.';
end;
$$;
