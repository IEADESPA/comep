-- Revisão do bloco 11 do revisor permanente (25/11/2026), achado S5-06: o nome, o endereço e o telefone da igreja ganham
-- tamanho máximo. As outras colunas do contato já tinham regra; estas três aceitavam texto de qualquer tamanho, pela
-- tabela (o contato que o pastor presidente salva) e pelas funções do cadastro (a secretaria, o pedido e a correção
-- do pastor que cadastra a própria igreja). Os limites são os que o cadastro já usava para cortar:
--   - o nome da igreja até 200 letras;
--   - o endereço até 300 caracteres;
--   - o telefone até 40 caracteres (o mesmo da pessoa).
-- Quem passa do limite recebe a mensagem do campo, em qualquer caminho: o gatilho fica na própria tabela, por onde
-- passam todas as gravações (a função interno.dados_da_igreja não muda).


-- ---------------------------------------------------------------------
-- 1. O que já estava gravado além do limite é cortado antes (no banco de teste; a produção começa vazia).
--    A auditoria guarda o de antes. O dono do banco não passa pela regra do pastor (proteger_igreja).
-- ---------------------------------------------------------------------
update public.igrejas
   set nome     = case when char_length(nome) > 200 then btrim(left(nome, 200)) else nome end,
       endereco = case when char_length(endereco) > 300 then nullif(btrim(left(endereco, 300)), '') else endereco end,
       telefone = case when char_length(telefone) > 40 then nullif(btrim(left(telefone, 40)), '') else telefone end
 where char_length(nome) > 200 or char_length(endereco) > 300 or char_length(telefone) > 40;


-- ---------------------------------------------------------------------
-- 2. O tamanho na própria coluna (vale para qualquer gravação)
-- ---------------------------------------------------------------------
alter table public.igrejas
  add constraint igrejas_nome_tamanho check (char_length(nome) <= 200),
  add constraint igrejas_endereco_tamanho check (char_length(endereco) <= 300),
  add constraint igrejas_telefone_tamanho check (char_length(telefone) <= 40);


-- ---------------------------------------------------------------------
-- 3. A mensagem do campo quando passa do limite (antes da regra da tabela, que só daria a mensagem genérica).
--    O nome do gatilho o põe depois de proteger_igreja: quem não pode mudar o nome continua lendo aquela mensagem.
-- ---------------------------------------------------------------------
create function interno.tamanho_dos_textos_da_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if char_length(new.nome) > 200 then
    raise exception 'O nome da igreja pode ter no máximo 200 letras.' using errcode = 'P0001';
  end if;
  if char_length(new.endereco) > 300 then
    raise exception 'O endereço da igreja pode ter no máximo 300 caracteres.' using errcode = 'P0001';
  end if;
  if char_length(new.telefone) > 40 then
    raise exception 'O telefone da igreja pode ter no máximo 40 caracteres.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
comment on function interno.tamanho_dos_textos_da_igreja() is
  'Explica o limite do nome (200), do endereço (300) e do telefone (40) da igreja. Revisão do bloco 11, achado S5-06.';

create trigger tamanho_dos_textos_da_igreja
  before insert or update of nome, endereco, telefone on public.igrejas
  for each row execute function interno.tamanho_dos_textos_da_igreja();

revoke all on function interno.tamanho_dos_textos_da_igreja() from public;
