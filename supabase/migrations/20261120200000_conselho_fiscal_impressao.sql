-- =====================================================================
-- Telas novas, parte 10 (Fase 5.5): a fotografia do mês aprovado ganha a impressão digital dos lançamentos.
--
-- Defeito achado no teste de ponta a ponta (20/11/2026): a fotografia guardava só as somas e a quantidade. Cancelar
-- um lançamento e lançar outro do mesmo valor deixava as somas e a quantidade iguais, e a aprovação antiga voltava
-- a valer. Agora a fotografia guarda também a impressão digital (md5) de QUAIS lançamentos contam no mês: qualquer
-- troca faz a aprovação deixar de valer.
-- =====================================================================

alter table public.conselho_meses add column impressao text;
comment on column public.conselho_meses.impressao is 'A impressão digital (md5) dos lançamentos que contavam no mês no dia da aprovação.';

-- Os números do mês, agora com a impressão digital dos lançamentos efetivados que contam
create or replace function interno.numeros_do_mes(p_competencia date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mov as (
    select l.id, l.tipo, l.valor, coalesce(cat.sistema, '') like 'transferencia%' as transferencia
    from public.lancamentos l
    join public.contas_financeiras c on c.id = l.conta_id
    join public.categorias_financeiras cat on cat.id = l.categoria_id
    where l.situacao = 'efetivado' and l.arquivado_em is null and l.data >= c.saldo_inicial_em
      and l.data >= p_competencia and l.data < (p_competencia + interval '1 month')::date
  )
  select jsonb_build_object(
    'entradas', coalesce(round(sum(valor) filter (where tipo = 'entrada' and not transferencia), 2), 0),
    'saidas', coalesce(round(sum(valor) filter (where tipo = 'saida' and not transferencia), 2), 0),
    'lancamentos', count(*),
    'impressao', md5(coalesce(string_agg(id::text || ':' || tipo || ':' || valor, ',' order by id), '')),
    'saldo_inicio', interno.saldo_do_caixa_em(p_competencia - 1),
    'saldo_fim', interno.saldo_do_caixa_em(((p_competencia + interval '1 month')::date - 1))
  )
  from mov;
$$;

-- As aprovações em vigor que ainda batem com os números de hoje ficam com a impressão de hoje
update public.conselho_meses m
set impressao = n ->> 'impressao'
from (select id, interno.numeros_do_mes(competencia) as n from public.conselho_meses where arquivado_em is null) x
where x.id = m.id
  and (x.n ->> 'entradas')::numeric = m.entradas
  and (x.n ->> 'saidas')::numeric = m.saidas
  and (x.n ->> 'lancamentos')::integer = m.lancamentos;

-- A aprovação vale enquanto as somas, a quantidade e a impressão digital forem as mesmas
create or replace function interno.aprovacao_vale(p_mes public.conselho_meses)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_mes.id is not null and p_mes.arquivado_em is null and p_mes.impressao is not null
     and (n ->> 'entradas')::numeric = p_mes.entradas
     and (n ->> 'saidas')::numeric = p_mes.saidas
     and (n ->> 'lancamentos')::integer = p_mes.lancamentos
     and n ->> 'impressao' = p_mes.impressao
  from (select interno.numeros_do_mes(p_mes.competencia) as n) x;
$$;

create or replace function interno.gravar_aprovacao_mes(p_competencia date, p_decisao public.decisao_mes, p_ressalva text, p_sem_movimento boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numeros jsonb := interno.numeros_do_mes(p_competencia);
  v_id uuid;
begin
  -- a aprovação que deixou de valer (o mês mudou) fica arquivada
  update public.conselho_meses set arquivado_em = now() where competencia = p_competencia and arquivado_em is null;
  insert into public.conselho_meses (competencia, decisao, ressalva, entradas, saidas, lancamentos, impressao, saldo_inicio, saldo_fim,
                                     sem_movimento, decidido_por)
  values (p_competencia, p_decisao, nullif(trim(p_ressalva), ''), (v_numeros ->> 'entradas')::numeric, (v_numeros ->> 'saidas')::numeric,
          (v_numeros ->> 'lancamentos')::integer, v_numeros ->> 'impressao', (v_numeros ->> 'saldo_inicio')::numeric,
          (v_numeros ->> 'saldo_fim')::numeric, p_sem_movimento, (select interno.minha_pessoa_id()))
  returning id into v_id;
  insert into public.conselho_assinaturas (mes_id, pessoa_id) values (v_id, (select interno.minha_pessoa_id()));
  return v_id;
end;
$$;

-- as permissões das funções trocadas continuam as de antes (create or replace mantém os grants)
revoke all on function interno.numeros_do_mes(date) from public;
revoke all on function interno.aprovacao_vale(public.conselho_meses) from public;
revoke all on function interno.gravar_aprovacao_mes(date, public.decisao_mes, text, boolean) from public;
