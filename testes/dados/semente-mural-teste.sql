-- =====================================================================
-- SEMENTE DO MURAL — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
-- Um aviso fictício, fixado e também no site, para os testes de ponta a ponta verem o mural, o Início e o site
-- (os usuários fictícios dos testes não têm o perfil da secretaria, que é quem publica).
-- =====================================================================
do $$
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (select 1 from public.avisos where titulo = 'Aviso fictício do ambiente de teste') then
    raise notice 'A semente do mural já foi aplicada antes: nada a fazer.';
    return;
  end if;
  insert into public.avisos (titulo, texto, no_site, fixado)
  values ('Aviso fictício do ambiente de teste',
          'Este aviso existe só no ambiente de teste, para conferir o mural, o Início e o site.', true, true);
end;
$$;
