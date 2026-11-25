-- Revisão das telas gerais (módulo 5, 25/11/2026), achado S5-01, complemento do S1-06 (o nome e o telefone).
-- S5-01: o cadastro do site é aberto, e o que se grava não se apaga (e ainda vai para a auditoria). Por isso o texto
-- livre do pedido de associação, da troca de igreja e do informe de pagamento ganha limite de tamanho, e pedir e
-- desistir (ou cancelar) ganha um teto por dia:
--   - igreja e denominação informadas: até 200 caracteres (como a igreja da inscrição pública);
--   - função: até 120;
--   - observações: até 1.000 (como as outras observações do sistema);
--   - forma de pagamento: até 60 (a tela oferece PIX, depósito, transferência ou dinheiro);
--   - até 3 pedidos de associação e 3 pedidos de troca de igreja por pessoa e por dia.


-- ---------------------------------------------------------------------
-- 1. O que já passa do limite é cortado no tamanho (a auditoria guarda o texto de antes).
--    As regras do pedido e da troca barram mexer em pedido encerrado: ficam desligadas só durante o corte, nesta
--    mesma transação, e voltam logo depois.
-- ---------------------------------------------------------------------
alter table public.pedidos_associacao disable trigger regras_pedido;
update public.pedidos_associacao
   set igreja_informada      = left(igreja_informada, 200),
       denominacao_informada = left(denominacao_informada, 200),
       funcao                = left(funcao, 120),
       observacoes           = left(observacoes, 1000)
 where char_length(igreja_informada) > 200
    or char_length(denominacao_informada) > 200
    or char_length(funcao) > 120
    or char_length(observacoes) > 1000;
alter table public.pedidos_associacao enable trigger regras_pedido;

alter table public.pedidos_troca_igreja disable trigger regras_troca_igreja;
update public.pedidos_troca_igreja
   set igreja_informada = left(igreja_informada, 200),
       funcao           = left(funcao, 120),
       observacao       = left(observacao, 1000)
 where char_length(igreja_informada) > 200
    or char_length(funcao) > 120
    or char_length(observacao) > 1000;
alter table public.pedidos_troca_igreja enable trigger regras_troca_igreja;

update public.informes_pagamento
   set forma      = left(forma, 60),
       observacao = left(observacao, 1000)
 where char_length(forma) > 60
    or char_length(observacao) > 1000;


-- ---------------------------------------------------------------------
-- 2. O tamanho de cada campo livre
-- ---------------------------------------------------------------------
alter table public.pedidos_associacao
  add constraint pedidos_associacao_igreja_informada_tamanho check (char_length(igreja_informada) <= 200),
  add constraint pedidos_associacao_denominacao_informada_tamanho check (char_length(denominacao_informada) <= 200),
  add constraint pedidos_associacao_funcao_tamanho check (char_length(funcao) <= 120),
  add constraint pedidos_associacao_observacoes_tamanho check (char_length(observacoes) <= 1000);

alter table public.pedidos_troca_igreja
  add constraint pedidos_troca_igreja_igreja_informada_tamanho check (char_length(igreja_informada) <= 200),
  add constraint pedidos_troca_igreja_funcao_tamanho check (char_length(funcao) <= 120),
  add constraint pedidos_troca_igreja_observacao_tamanho check (char_length(observacao) <= 1000);

alter table public.informes_pagamento
  add constraint informes_pagamento_forma_tamanho check (char_length(forma) <= 60),
  add constraint informes_pagamento_observacao_tamanho check (char_length(observacao) <= 1000);


-- ---------------------------------------------------------------------
-- 3. O teto de pedidos por pessoa e por dia (pedir e desistir, pedir e cancelar)
-- ---------------------------------------------------------------------
create function interno.limitar_pedidos_por_dia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Quantos pedidos a própria pessoa faz por dia, contando os de que desistiu ou que cancelou. Quem pede certo usa
  -- um; três dão folga para quem desistiu por engano. Vale para o pedido de associação e para a troca de igreja
  -- (os dois gatilhos abaixo). Mudou aqui? Mude também o teste (testes/banco/seguranca_modulo1.test.ts).
  c_pedidos_por_dia constant integer := 3;
  v_hoje integer;
begin
  -- Só o pedido feito pela própria pessoa entra na conta (o dono do banco, nas cargas e nos testes, não).
  if new.pessoa_id is distinct from (select interno.minha_pessoa_id()) then
    return new;
  end if;
  execute format(
    'select count(*) from %I.%I where pessoa_id = $1 and criado_em >= current_date::timestamptz',
    tg_table_schema, tg_table_name
  ) into v_hoje using new.pessoa_id;
  if v_hoje >= c_pedidos_por_dia then
    raise exception 'Você já fez % pedidos hoje. Tente de novo amanhã ou fale com a secretaria do COMEP.', c_pedidos_por_dia
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
comment on function interno.limitar_pedidos_por_dia() is
  'Teto de pedidos (associação e troca de igreja) que a própria pessoa faz por dia. Revisão das telas gerais, S5-01.';

create trigger limitar_pedidos_por_dia
  before insert on public.pedidos_associacao
  for each row execute function interno.limitar_pedidos_por_dia();

create trigger limitar_pedidos_por_dia
  before insert on public.pedidos_troca_igreja
  for each row execute function interno.limitar_pedidos_por_dia();


-- ---------------------------------------------------------------------
-- 4. Permissões: a função do gatilho não é chamada por ninguém de fora
-- ---------------------------------------------------------------------
revoke all on function interno.limitar_pedidos_por_dia() from public;
