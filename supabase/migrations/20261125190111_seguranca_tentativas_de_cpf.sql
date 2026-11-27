-- Revisão da segurança do banco, achado S1-05, com a decisão do presidente de 25/11/2026: o limite de tentativas do CPF.
-- O aviso "Este CPF já está no cadastro de outra pessoa" continua (quem tem cadastro repetido precisa saber), mas cada
-- conta tenta poucos CPFs por dia:
--   - até 10 tentativas por dia, por conta, contando o CPF livre e o de outra pessoa. A reunião do lançamento terá
--     muita gente se cadastrando ao mesmo tempo: 10 não barra quem errou um dígito e barra a consulta em massa;
--   - continua o teto antigo: 5 vezes com CPF de outra pessoa, e depois só a secretaria resolve;
--   - quem já tem o CPF preenchido não troca por aqui (só a secretaria corrige), e agora recebe essa resposta antes de
--     qualquer conferência, a mesma para todo CPF tentado;
--   - a tabela das tentativas guarda só a conta, a hora e se o CPF já era de outra pessoa; nunca o CPF tentado;
--   - a secretaria e a presidência, que corrigem a ficha, não entram na conta.


-- ---------------------------------------------------------------------
-- 1. A tentativa guarda se o CPF já era de outra pessoa (as de antes eram todas assim)
-- ---------------------------------------------------------------------
alter table public.tentativas_cpf add column encontrado boolean not null default true;
comment on column public.tentativas_cpf.encontrado is
  'true: o CPF tentado já era de outra pessoa; false: estava livre. O CPF tentado não é guardado.';
comment on table public.tentativas_cpf is
  'Tentativas de gravar o próprio CPF: até 10 por dia por conta, e até 5 com CPF que já é de outra pessoa (depois, só a secretaria resolve).';
create index tentativas_cpf_pessoa_hora on public.tentativas_cpf (pessoa_id, criado_em);


-- ---------------------------------------------------------------------
-- 2. A gravação (a última versão era a de 20261113190000_revisao_fase3.sql)
-- ---------------------------------------------------------------------
create or replace function interno.gravar_identidade(p_pessoa_id uuid, p_dados jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Mudou aqui? Mude também o teste (testes/banco/seguranca_portao.test.ts, Portão 4).
  c_tentativas_por_dia constant integer := 10;
  c_repetidos constant integer := 5;
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
  v_atual text;
  v_repetido boolean;
begin
  if v_eu is null or (p_pessoa_id <> v_eu and not v_diretoria) then
    raise exception 'CPF e filiação: cada um grava os seus; a secretaria corrige.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  if not v_diretoria and (select count(*) from public.tentativas_cpf where pessoa_id = v_eu and encontrado) >= c_repetidos then
    raise exception 'Muitas tentativas com CPF que já está no cadastro de outra pessoa. Fale com a secretaria.' using errcode = 'P0001';
  end if;
  if p_dados ? 'cpf' and v_cpf is not null then
    v_repetido := exists (select 1 from public.pessoas where cpf = v_cpf and id <> p_pessoa_id and arquivado_em is null);
    if not v_diretoria then
      -- a própria pessoa (p_pessoa_id = v_eu)
      select cpf into v_atual from public.pessoas where id = v_eu;
      if v_cpf is distinct from v_atual then
        -- quem já tem CPF não troca por aqui: a mesma resposta para qualquer CPF tentado
        if v_atual is not null then
          raise exception 'CPF e filiação, depois de preenchidos, só a secretaria corrige (eles vão na credencial).'
            using errcode = '42501';
        end if;
        if (select count(*) from public.tentativas_cpf
            where pessoa_id = v_eu and criado_em >= current_date::timestamptz) >= c_tentativas_por_dia then
          raise exception 'Você já tentou % CPFs hoje. Confira o número no documento e tente de novo amanhã, ou fale com a secretaria.',
            c_tentativas_por_dia using errcode = 'P0001';
        end if;
        insert into public.tentativas_cpf (pessoa_id, encontrado) values (v_eu, v_repetido);
      end if;
    end if;
    if v_repetido then
      return 'cpf_repetido';
    end if;
  end if;
  update public.pessoas
  set cpf      = case when p_dados ? 'cpf' then v_cpf else cpf end,
      nome_pai = case when p_dados ? 'nome_pai' then nullif(trim(p_dados ->> 'nome_pai'), '') else nome_pai end,
      nome_mae = case when p_dados ? 'nome_mae' then nullif(trim(p_dados ->> 'nome_mae'), '') else nome_mae end
  where id = p_pessoa_id;
  return 'ok';
end;
$$;
comment on function interno.gravar_identidade(uuid, jsonb) is
  'Grava o CPF e a filiação. A própria pessoa: até 10 tentativas de CPF por dia e 5 com CPF de outra pessoa; a secretaria corrige. Achado S1-05.';
