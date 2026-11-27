-- Revisão do portão do ramo da segurança do banco (25/11/2026), ressalva 1: completa o S5-01 pelas colunas de caminho.
-- O caminho de um arquivo (a foto da pessoa, a foto e o comprovante do pedido de associação, o comprovante do informe
-- de pagamento) ganha tamanho máximo, e a própria pessoa troca a foto até 10 vezes por dia. O cadastro é aberto e nada
-- se apaga: sem isso, uma conta recém-criada guardaria texto de qualquer tamanho nessas colunas, sem fim.
--   - caminho de arquivo: até 200 caracteres (os que as telas gravam têm uns 80: pessoas/<id>/<tipo>-<hora>.<ext>);
--   - troca da própria foto: até 10 por dia (a secretaria, que corrige a ficha, não entra na conta).


-- ---------------------------------------------------------------------
-- 1. O caminho seguro também tem tamanho (vale para todas as funções e gatilhos que já o usam)
-- ---------------------------------------------------------------------
create or replace function interno.caminho_seguro(p_caminho text, p_pessoa_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_caminho is null
      or (
        char_length(p_caminho) <= 200
        and left(p_caminho, length('pessoas/' || p_pessoa_id || '/')) = 'pessoas/' || p_pessoa_id || '/'
        and position('..' in p_caminho) = 0
        and position('//' in p_caminho) = 0
      );
$$;


-- ---------------------------------------------------------------------
-- 2. O caminho maior que 200 não é de arquivo que as telas mandaram: fica vazio (a auditoria guarda o de antes).
--    As regras do pedido barram mexer em pedido encerrado: ficam desligadas só durante a limpeza.
-- ---------------------------------------------------------------------
update public.pessoas set foto_caminho = null where char_length(foto_caminho) > 200;

alter table public.pedidos_associacao disable trigger regras_pedido;
update public.pedidos_associacao
   set foto_caminho        = case when char_length(foto_caminho) > 200 then null else foto_caminho end,
       comprovante_caminho = case when char_length(comprovante_caminho) > 200 then null else comprovante_caminho end
 where char_length(foto_caminho) > 200 or char_length(comprovante_caminho) > 200;
alter table public.pedidos_associacao enable trigger regras_pedido;

update public.informes_pagamento set comprovante_caminho = null where char_length(comprovante_caminho) > 200;


-- ---------------------------------------------------------------------
-- 3. O tamanho na própria coluna (vale para qualquer gravação)
-- ---------------------------------------------------------------------
alter table public.pessoas
  add constraint pessoas_foto_caminho_tamanho check (char_length(foto_caminho) <= 200);
alter table public.pedidos_associacao
  add constraint pedidos_associacao_foto_caminho_tamanho check (char_length(foto_caminho) <= 200),
  add constraint pedidos_associacao_comprovante_caminho_tamanho check (char_length(comprovante_caminho) <= 200);
alter table public.informes_pagamento
  add constraint informes_pagamento_comprovante_caminho_tamanho check (char_length(comprovante_caminho) <= 200);


-- ---------------------------------------------------------------------
-- 4. A troca da própria foto: até 10 por dia
-- ---------------------------------------------------------------------
create function interno.limitar_trocas_de_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Quantas vezes a própria pessoa troca a foto num dia. Quem tira de novo porque não gostou usa duas ou três.
  -- Mudou aqui? Mude também o teste (testes/banco/seguranca_portao.test.ts).
  c_trocas_por_dia constant integer := 10;
begin
  -- só a troca feita pela própria pessoa entra na conta (a secretaria e o dono do banco, não)
  if new.foto_caminho is not distinct from old.foto_caminho
     or new.id is distinct from (select interno.minha_pessoa_id()) then
    return new;
  end if;
  -- as trocas de hoje estão na auditoria (o gatilho dela grava depois desta)
  if (select count(*) from public.auditoria a
      where a.tabela = 'pessoas'
        and a.registro_id = new.id::text
        and a.operacao = 'UPDATE'
        and a.usuario_id = (select auth.uid())
        and a.ocorrido_em >= current_date::timestamptz
        and (a.dados_antes ->> 'foto_caminho') is distinct from (a.dados_depois ->> 'foto_caminho')) >= c_trocas_por_dia then
    raise exception 'Você já trocou a foto % vezes hoje. Tente de novo amanhã.', c_trocas_por_dia using errcode = 'P0001';
  end if;
  return new;
end;
$$;
comment on function interno.limitar_trocas_de_foto() is
  'Teto de trocas da própria foto por dia. Revisão do portão da segurança do banco, ressalva 1.';

create trigger limitar_trocas_de_foto
  before update of foto_caminho on public.pessoas
  for each row execute function interno.limitar_trocas_de_foto();

revoke all on function interno.limitar_trocas_de_foto() from public;
