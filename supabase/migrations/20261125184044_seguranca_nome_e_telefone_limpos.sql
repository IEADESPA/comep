-- Revisão do portão do ramo da segurança do banco (25/11/2026), ressalva 2 (e as menores 3 e 4): o nome e o telefone.
-- O nome ou o telefone colado de outro aplicativo traz caracteres que não aparecem (marcas de direção, espaço duro,
-- espaço de largura zero...). A regra da tabela recusava, com a mensagem genérica, e a pessoa não tinha como ver o que
-- corrigir. Agora:
--   - o banco limpa o nome e o telefone em toda gravação (o próprio, a secretaria, a correção aceita e o cadastro),
--     como o cadastro aberto já fazia: o de controle e o espaço diferente viram espaço; o que não aparece sai; o acento
--     empilhado (mais de dois na mesma letra) é cortado em dois;
--   - o que passa do limite recebe a mensagem do campo: o nome até 150 letras e o telefone até 40 caracteres (antes 30:
--     dois números no mesmo campo não cabiam);
--   - o pedido de correção do nome e do telefone grava o valor limpo e recusa na hora o que o aceite não gravaria;
--   - a lista do que não aparece fica completa, escrita por código (\uXXXX), para quem lê ver cada caractere.


-- ---------------------------------------------------------------------
-- 1. O que não aparece, e o texto sem ele
-- ---------------------------------------------------------------------
-- Os grupos (os mesmos de src/utilitarios/textoLimpo.ts, que as telas usam antes de mandar):
--   controle e separador de linha (viram espaço): U+0001 a U+001F, U+007F a U+009F, U+2028, U+2029;
--   espaço diferente (vira espaço): U+00A0, U+1680, U+2000 a U+200A, U+202F, U+205F, U+3000;
--   o que não aparece (sai): o hífen invisível U+00AD, U+034F, U+061C, os preenchimentos U+115F, U+1160, U+3164 e
--     U+FFA0, U+17B4, U+17B5, U+180B a U+180F, a largura zero e a direção (U+200B a U+200F, U+202A a U+202E, U+2060 a
--     U+2064, U+2066 a U+206F), o braille vazio U+2800, os seletores U+FE00 a U+FE0F e U+E0100 a U+E01EF, U+FEFF,
--     U+FFF9 a U+FFFB, U+1D173 a U+1D17A e as etiquetas U+E0000 a U+E007F;
--   acento empilhado: mais de dois acentos combinados seguidos na mesma letra.
create or replace function interno.tem_caractere_invisivel(p_texto text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_texto, '') ~ '[\u0001-\u001f\u007f-\u009f\u2028\u2029\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e007f\U000e0100-\U000e01ef]'
      or coalesce(p_texto, '') ~ '[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]{3,}';
$$;
comment on function interno.tem_caractere_invisivel(text) is
  'O texto tem caractere de controle, espaço diferente, caractere que não aparece ou acento empilhado (nome e telefone não aceitam).';

create function interno.sem_invisiveis(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(p_texto, '[\u0001-\u001f\u007f-\u009f\u2028\u2029\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]', ' ', 'g'),
               '[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e007f\U000e0100-\U000e01ef]', '', 'g'),
             '([\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f][\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f])[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]+', '\1', 'g'),
           ' {2,}', ' ', 'g'));
$$;
comment on function interno.sem_invisiveis(text) is
  'O texto sem o que não aparece: o de controle e o espaço diferente viram espaço, o invisível sai, o acento empilhado é cortado em dois e os espaços se juntam.';

-- O nome do cadastro aberto (a mesma assinatura de 20261125133624): agora pela mesma limpeza
create or replace function interno.texto_limpo(p_texto text, p_maximo integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(left(interno.sem_invisiveis(coalesce(p_texto, '')), p_maximo));
$$;

revoke all on function interno.sem_invisiveis(text) from public;


-- ---------------------------------------------------------------------
-- 2. O que já estava gravado fora da regra nova é limpo antes (no banco de teste; a produção começa vazia)
-- ---------------------------------------------------------------------
update public.pessoas
set nome = coalesce(nullif(interno.texto_limpo(nome, 150), ''), 'Sem nome')
where interno.tem_caractere_invisivel(nome);

update public.pessoas
set telefone = nullif(interno.sem_invisiveis(telefone), '')
where telefone is not null and interno.tem_caractere_invisivel(telefone);


-- ---------------------------------------------------------------------
-- 3. O telefone até 40 caracteres
-- ---------------------------------------------------------------------
alter table public.pessoas drop constraint pessoas_telefone_formato;
alter table public.pessoas add constraint pessoas_telefone_formato
  check (telefone is null or (char_length(telefone) <= 40 and not interno.tem_caractere_invisivel(telefone)));


-- ---------------------------------------------------------------------
-- 4. A limpeza em toda gravação, com a mensagem do campo quando passa do limite
-- ---------------------------------------------------------------------
create function interno.limpar_nome_e_telefone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.nome is distinct from old.nome then
    new.nome := interno.sem_invisiveis(new.nome);
    if coalesce(new.nome, '') = '' then
      raise exception 'Escreva o nome completo.' using errcode = 'P0001';
    end if;
    if char_length(new.nome) > 150 then
      raise exception 'O nome pode ter no máximo 150 letras.' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' or new.telefone is distinct from old.telefone then
    new.telefone := nullif(interno.sem_invisiveis(new.telefone), '');
    if char_length(new.telefone) > 40 then
      raise exception 'O telefone pode ter no máximo 40 caracteres.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
comment on function interno.limpar_nome_e_telefone() is
  'Limpa o nome e o telefone em toda gravação e explica o limite. Revisão do portão da segurança do banco, ressalva 2.';

create trigger limpar_nome_e_telefone
  before insert or update of nome, telefone on public.pessoas
  for each row execute function interno.limpar_nome_e_telefone();

revoke all on function interno.limpar_nome_e_telefone() from public;


-- ---------------------------------------------------------------------
-- 5. O pedido de correção (a última versão era a de 20261118150000_correcao_e_conferencia.sql): o nome e o telefone
--    saem limpos e com os limites do cadastro. O resto da função não muda.
-- ---------------------------------------------------------------------
create or replace function interno.pedir_correcao_dado(p_pessoa_id uuid, p_campo text, p_valor text, p_referencia uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu            uuid := (select interno.minha_pessoa_id());
  v_igreja        uuid;
  v_atual         text;
  v_pedido        text;
  v_titulo        uuid;
  v_igreja_pedida uuid;
  v_id            uuid;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para pedir a correção.' using errcode = '42501';
  end if;
  if not interno.associado_ativo(p_pessoa_id) then
    raise exception 'A correção é do cadastro de um associado ativo.' using errcode = 'P0001';
  end if;
  select v.igreja_id into v_igreja from public.vinculos_igreja v
  where v.pessoa_id = p_pessoa_id and v.fim is null and v.arquivado_em is null
  limit 1;
  if p_pessoa_id <> v_eu and (v_igreja is null or v_igreja not in (select interno.igrejas_que_presido())) then
    raise exception 'Só o próprio ministro ou o pastor presidente da igreja dele pedem a correção.' using errcode = '42501';
  end if;
  if p_campo is null
     or p_campo not in ('nome', 'telefone', 'email', 'cpf', 'nome_mae', 'nome_pai', 'titulo', 'funcao', 'igreja') then
    raise exception 'Escolha na lista o dado que precisa ser corrigido.' using errcode = 'P0001';
  end if;
  if p_campo in ('cpf', 'nome_mae', 'nome_pai') and p_pessoa_id <> v_eu then
    raise exception 'CPF e filiação: só a própria pessoa pede a correção.' using errcode = '42501';
  end if;
  if p_campo = 'email' and exists (select 1 from public.pessoas where id = p_pessoa_id and usuario_id is not null) then
    raise exception 'O e-mail de quem já entra no sistema é o do login e não se corrige por aqui.' using errcode = 'P0001';
  end if;

  v_atual := interno.valor_do_campo(p_pessoa_id, p_campo);

  if p_campo = 'titulo' then
    select t.id, t.nome into v_titulo, v_pedido
    from public.titulos_ministeriais t where t.id = p_referencia and t.arquivado_em is null;
    if v_titulo is null then
      raise exception 'Escolha o título na lista.' using errcode = 'P0001';
    end if;
  elsif p_campo = 'igreja' then
    select i.id, i.nome into v_igreja_pedida, v_pedido
    from public.igrejas i where i.id = p_referencia and i.arquivado_em is null;
    if v_igreja_pedida is null then
      raise exception 'Escolha a igreja na lista.' using errcode = 'P0001';
    end if;
    if v_igreja_pedida = v_igreja then
      raise exception 'O dado já está assim no cadastro.' using errcode = 'P0001';
    end if;
  else
    -- o nome e o telefone saem sem o que não aparece (colado de outro aplicativo), como no cadastro
    if p_campo in ('nome', 'telefone') then
      v_pedido := nullif(interno.sem_invisiveis(p_valor), '');
    else
      v_pedido := nullif(trim(regexp_replace(coalesce(p_valor, ''), '\s+', ' ', 'g')), '');
    end if;
    if v_pedido is null then
      raise exception 'Escreva como o dado deve ficar.' using errcode = 'P0001';
    end if;
    if length(v_pedido) > 300 then
      raise exception 'O texto passou do tamanho (300 letras).' using errcode = 'P0001';
    end if;
    -- os mesmos limites do cadastro: o que o aceite não conseguiria gravar é recusado já no pedido
    if p_campo = 'nome' and char_length(v_pedido) > 150 then
      raise exception 'O nome pode ter no máximo 150 letras.' using errcode = 'P0001';
    end if;
    if p_campo = 'telefone' and char_length(v_pedido) > 40 then
      raise exception 'O telefone pode ter no máximo 40 caracteres.' using errcode = 'P0001';
    end if;
    if p_campo = 'cpf' then
      v_pedido := regexp_replace(v_pedido, '[^0-9]', '', 'g');
      if length(v_pedido) <> 11 then
        raise exception 'O CPF tem 11 números.' using errcode = 'P0001';
      end if;
    elsif p_campo = 'telefone' then
      if length(regexp_replace(v_pedido, '[^0-9]', '', 'g')) not between 10 and 13 then
        raise exception 'Confira o telefone, com o DDD.' using errcode = 'P0001';
      end if;
    elsif p_campo = 'email' then
      v_pedido := lower(v_pedido);
      if v_pedido !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' then
        raise exception 'Confira o e-mail.' using errcode = 'P0001';
      end if;
    elsif p_campo = 'nome' and length(v_pedido) < 5 then
      raise exception 'Escreva o nome completo.' using errcode = 'P0001';
    elsif p_campo = 'funcao' and v_igreja is null then
      raise exception 'O ministro está sem igreja no cadastro: peça antes a correção da igreja.' using errcode = 'P0001';
    end if;
  end if;

  if v_pedido is not distinct from v_atual then
    raise exception 'O dado já está assim no cadastro.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.pedidos_correcao
    where pessoa_id = p_pessoa_id and campo = p_campo and situacao = 'pendente' and arquivado_em is null
  ) then
    raise exception 'Já há um pedido de correção deste dado esperando a secretaria.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.pedidos_correcao
      where pedido_por = v_eu and situacao = 'pendente' and arquivado_em is null) >= 20 then
    raise exception 'Há muitos pedidos esperando a secretaria. Aguarde a resposta dos anteriores.' using errcode = 'P0001';
  end if;

  insert into public.pedidos_correcao
    (pessoa_id, igreja_id, pedido_por, texto, campo, valor_atual, valor_pedido, titulo_pedido_id, igreja_pedida_id)
  values (
    p_pessoa_id, v_igreja, v_eu,
    left(format('%s: %s → %s', interno.nome_do_campo(p_campo), coalesce(v_atual, '(vazio)'), v_pedido), 1000),
    p_campo, v_atual, v_pedido, v_titulo, v_igreja_pedida
  )
  returning id into v_id;
  return v_id;
end;
$$;
