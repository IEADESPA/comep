-- =====================================================================
-- Fase 4.4 (ajuste): o nome de quem tem cargo aparece para todos com login
-- A lista da diretoria juntava o cadastro de pessoas, que o ministro só lê o próprio: ele via a lista vazia.
-- Quem é da diretoria e do Conselho Fiscal é informação do Conselho: a função devolve o nome SÓ de quem tem
-- (ou teve) mandato. Nenhum outro dado da pessoa sai.
-- =====================================================================

create function interno.nome_de_mandatario(p_pessoa_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.nome from public.pessoas p
  where p.id = p_pessoa_id
    and exists (select 1 from public.mandatos m where m.pessoa_id = p_pessoa_id and m.arquivado_em is null);
$$;
revoke all on function interno.nome_de_mandatario(uuid) from public;
grant execute on function interno.nome_de_mandatario(uuid) to authenticated;

create or replace view public.vw_mandatos
with (security_invoker = true)
as
select
  m.id,
  m.pessoa_id,
  interno.nome_de_mandatario(m.pessoa_id) as nome,
  m.cargo,
  case when m.cargo = 'conselheiro_fiscal' then 'conselho_fiscal' else 'conselho_diretor' end as orgao,
  m.inicio,
  m.fim,
  m.encerrado_em,
  m.motivo_encerramento,
  m.encontro_id,
  e.titulo as encontro_titulo,
  (current_date between m.inicio and interno.fim_efetivo(m)) as vigente
from public.mandatos m
left join public.encontros e on e.id = m.encontro_id
where m.arquivado_em is null;
