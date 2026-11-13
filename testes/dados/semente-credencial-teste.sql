-- =====================================================================
-- SEMENTE DOS DADOS DA CREDENCIAL — SÓ PARA O BANCO DE TESTE (comep-teste)
-- Rodar DEPOIS de semente-teste.sql. Se rodar de novo, não faz nada.
--
--   * associados fictícios da semente: CPF fictício (com dígitos válidos) e filiação.
--     1 em cada 7 fica sem CPF e 1 em cada 9 sem o nome da mãe, para a lista de pendências ter o que mostrar;
--   * igrejas: sigla pelas iniciais (1 em cada 5 fica sem) e CNPJ ALFANUMÉRICO FICTÍCIO começando com "ZZ"
--     (o formato novo da Receita; com "ZZ" não é de nenhuma empresa). 1 em cada 4 fica sem CNPJ.
-- Roda como dono do banco (sem login): a regra "depois de preenchido, só a secretaria corrige" não se aplica.
-- =====================================================================
do $$
declare
  c_marca constant text := 'Dado fictício (semente de teste).';
  v_assoc record;
  v_igreja record;
  v_base text;
  v_soma integer;
  v_d1 integer;
  v_d2 integer;
  v_sobrenome text;
  v_sigla text;
  v_cnpj text;
  v_valores int[];
  v_pesos1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_pesos2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  v_n integer := 0;
begin
  if not exists (select 1 from public.igrejas where nome = 'Igreja Fictícia A (teste)') then
    raise exception 'Esta semente só roda no banco de TESTE (comep-teste).';
  end if;
  if exists (
    select 1 from public.pessoas p join public.associados a on a.pessoa_id = p.id
    where a.observacoes = c_marca and p.cpf is not null
  ) then
    raise notice 'A semente dos dados da credencial já foi aplicada antes: nada a fazer.';
    return;
  end if;

  -- 1. CPF e filiação dos associados fictícios
  for v_assoc in
    select a.pessoa_id, a.numero_registro, p.nome, row_number() over (order by a.numero_registro) as k
    from public.associados a join public.pessoas p on p.id = a.pessoa_id
    where a.observacoes = c_marca and a.arquivado_em is null
  loop
    v_sobrenome := regexp_replace(v_assoc.nome, '^.* ', '');
    if v_assoc.k % 7 <> 0 then
      v_base := lpad(((v_assoc.k * 7919 + 104729) % 999999999)::text, 9, '0');
      v_soma := 0;
      for i in 1..9 loop
        v_soma := v_soma + substr(v_base, i, 1)::integer * (11 - i);
      end loop;
      v_d1 := (v_soma * 10) % 11 % 10;
      v_soma := 0;
      for i in 1..9 loop
        v_soma := v_soma + substr(v_base, i, 1)::integer * (12 - i);
      end loop;
      v_soma := v_soma + v_d1 * 2;
      v_d2 := (v_soma * 10) % 11 % 10;
      begin
        update public.pessoas set cpf = v_base || v_d1 || v_d2 where id = v_assoc.pessoa_id;
      exception when unique_violation then
        null; -- coincidiu com um CPF de teste automático: fica sem
      end;
    end if;
    update public.pessoas
    set nome_mae = case when v_assoc.k % 9 = 0 then null else 'Maria ' || v_sobrenome end,
        nome_pai = case when v_assoc.k % 5 = 0 then null else 'José ' || v_sobrenome end
    where id = v_assoc.pessoa_id;
  end loop;

  -- 2. Sigla e CNPJ (alfanumérico fictício) das igrejas
  for v_igreja in
    select id, nome, row_number() over (order by nome) as k
    from public.igrejas
    where arquivado_em is null and sigla is null
  loop
    v_n := v_n + 1;
    if v_igreja.k % 5 <> 0 then
      select upper(string_agg(left(w, 1), '' order by ord))
      into v_sigla
      from regexp_split_to_table(v_igreja.nome, '\s+') with ordinality as t(w, ord)
      where lower(w) not in ('de', 'da', 'do', 'das', 'dos', 'e', 'o', 'a', 'para', '(teste)');
      if exists (select 1 from public.igrejas where lower(trim(sigla)) = lower(v_sigla) and arquivado_em is null)
         or length(v_sigla) < 2 then
        v_sigla := v_sigla || v_igreja.k;
      end if;
      update public.igrejas set sigla = v_sigla where id = v_igreja.id;
    end if;
    if v_igreja.k % 4 <> 0 then
      v_base := 'ZZ' || lpad(v_igreja.k::text, 6, '0') || '0001';
      v_valores := array(select ascii(substr(v_base, g, 1)) - 48 from generate_series(1, 12) as g);
      v_soma := 0;
      for g in 1..12 loop
        v_soma := v_soma + v_valores[g] * v_pesos1[g];
      end loop;
      v_d1 := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
      v_soma := v_d1 * v_pesos2[13];
      for g in 1..12 loop
        v_soma := v_soma + v_valores[g] * v_pesos2[g];
      end loop;
      v_d2 := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
      v_cnpj := v_base || v_d1 || v_d2;
      update public.igrejas set cnpj = v_cnpj where id = v_igreja.id and cnpj is null;
    end if;
  end loop;
end
$$;

select
  count(*) as associados_ativos,
  count(*) filter (where cardinality(pendencias) = 0) as credencial_completa,
  count(*) filter (where cardinality(pendencias) > 0) as com_pendencia
from public.vw_pendencias_credencial;
