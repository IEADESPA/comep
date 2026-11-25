-- Revisão permanente, módulo 1 (25/11/2026), achado S1-06: o nome e o telefone da pessoa ganham limite de tamanho e
-- não aceitam caracteres invisíveis de controle. O nome aparece nas listas da secretaria, da tesouraria e do Conselho
-- Fiscal, na credencial e na auditoria: precisa ser só o nome.
--   - nome: até 150 letras (folga para os nomes compridos; os acentos, o apóstrofo e o hífen continuam valendo);
--   - telefone: até 30 caracteres;
--   - nos dois, nada de caractere de controle (quebra de linha, tabulação...), dos que invertem ou isolam o texto
--     (U+202A a U+202E, U+2066 a U+2069, U+200E, U+200F, U+061C) nem dos que não aparecem (U+200B a U+200D, U+2060 a
--     U+2064, U+FEFF, U+2028, U+2029);
--   - o cadastro aberto do site limpa o nome que vem do formulário (troca a quebra de linha por espaço, tira o
--     invisível, junta os espaços e corta no tamanho), para a conta nova nunca falhar por isso.


-- ---------------------------------------------------------------------
-- 1. O que é caractere invisível, e o texto limpo
-- ---------------------------------------------------------------------
create function interno.tem_caractere_invisivel(p_texto text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_texto, '') ~ '[\u0001-\u001f\u007f-\u009f؜​-‏ -‮⁠-⁤⁦-⁩﻿]';
$$;
comment on function interno.tem_caractere_invisivel(text) is
  'O texto tem caractere de controle, que inverte ou isola o texto, ou que não aparece (nome e telefone não aceitam).';

-- Troca os de controle por espaço, tira os que invertem ou não aparecem, junta os espaços e corta em p_maximo letras
create function interno.texto_limpo(p_texto text, p_maximo integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(left(btrim(regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p_texto, ''), '[\u0001-\u001f\u007f-\u009f]', ' ', 'g'),
             '[؜​-‏ -‮⁠-⁤⁦-⁩﻿]', '', 'g'),
           '[[:space:]]+', ' ', 'g')), p_maximo));
$$;
comment on function interno.texto_limpo(text, integer) is
  'O texto sem caracteres invisíveis, com os espaços juntos e cortado no tamanho (o nome que vem do cadastro aberto).';

revoke all on function interno.tem_caractere_invisivel(text) from public;
revoke all on function interno.texto_limpo(text, integer) from public;
-- a regra da tabela roda com o papel de quem grava (o próprio troca o nome e o telefone pela tabela)
grant execute on function interno.tem_caractere_invisivel(text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2. O que já estava gravado fora da regra é limpo antes (no banco de teste; a produção começa vazia)
-- ---------------------------------------------------------------------
update public.pessoas
set nome = coalesce(nullif(interno.texto_limpo(nome, 150), ''), 'Sem nome')
where char_length(nome) > 150 or interno.tem_caractere_invisivel(nome);

update public.pessoas
set telefone = nullif(interno.texto_limpo(telefone, 30), '')
where telefone is not null and (char_length(telefone) > 30 or interno.tem_caractere_invisivel(telefone));


-- ---------------------------------------------------------------------
-- 3. A regra na tabela (vale para toda gravação: o próprio, a secretaria, a correção e o cadastro)
-- ---------------------------------------------------------------------
alter table public.pessoas add constraint pessoas_nome_formato
  check (char_length(nome) <= 150 and not interno.tem_caractere_invisivel(nome));
alter table public.pessoas add constraint pessoas_telefone_formato
  check (telefone is null or (char_length(telefone) <= 30 and not interno.tem_caractere_invisivel(telefone)));


-- ---------------------------------------------------------------------
-- 4. O cadastro aberto: o nome que vem do site é limpo (a última versão era a de 20261112140648_seguranca_revisao.sql)
-- ---------------------------------------------------------------------
create or replace function interno.criar_pessoa_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo_id uuid;
  v_pessoa_id uuid;
  v_ligado    boolean := false;
begin
  if coalesce(new.raw_user_meta_data ->> 'codigo_acesso', '') <> '' then
    v_codigo_id := interno.codigo_valido(new.raw_user_meta_data ->> 'codigo_acesso', 'primeiro_acesso');
    if v_codigo_id is not null then
      select pessoa_id into v_pessoa_id from public.codigos_acesso where id = v_codigo_id;
      update public.pessoas
      set usuario_id = new.id, email = new.email
      where id = v_pessoa_id and usuario_id is null and arquivado_em is null;
      v_ligado := found;
      if v_ligado then
        update public.codigos_acesso set usado_em = now() where id = v_codigo_id;
      end if;
    end if;
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'codigo_acesso' where id = new.id;
  end if;

  if v_ligado then
    return new;
  end if;

  insert into public.pessoas (usuario_id, nome, email, criado_por)
  values (
    new.id,
    coalesce(
      nullif(interno.texto_limpo(new.raw_user_meta_data ->> 'nome', 150), ''),
      nullif(interno.texto_limpo(new.raw_user_meta_data ->> 'full_name', 150), ''),
      nullif(interno.texto_limpo(split_part(coalesce(new.email, ''), '@', 1), 150), ''),
      'Sem nome'
    ),
    new.email,
    new.id
  );
  return new;
end;
$$;
