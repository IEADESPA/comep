-- =====================================================================
-- FASE 5.5.4 — SITE VIVO: A DIRETORIA E AS IGREJAS DO COMEP NO SITE (PROJETO.md, seção 9; 14/11/2026)
--
-- O que se lança no sistema aparece no site. Já iam para o site: as convocações, os eventos (com a inscrição) e os avisos
-- marcados pela secretaria. Agora também:
--   * a diretoria: o Conselho Diretor e o Conselho Fiscal com mandato valendo hoje (cargo, nome e período);
--   * as igrejas do COMEP: as que têm ministros associados ativos (nome, denominação, bairro e quantos ministros);
--   * os números do COMEP para a página inicial (ministros associados e igrejas).
-- Cuidado com os dados (LGPD): só o que já é institucional. Endereço e telefone das igrejas, CPF, e-mail, telefone e foto das
-- pessoas NÃO vão para o site.
-- =====================================================================

create function interno.diretoria_publica()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cargo', m.cargo, 'nome', pe.nome, 'inicio', m.inicio, 'fim', interno.fim_efetivo(m)
  ) order by m.cargo, pe.nome), '[]'::jsonb)
  from public.mandatos m
  join public.pessoas pe on pe.id = m.pessoa_id
  join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  where m.arquivado_em is null and current_date between m.inicio and interno.fim_efetivo(m);
$$;

-- As igrejas que têm ministros associados ativos (vínculo atual)
create function interno.igrejas_publicas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'nome', g.nome, 'sigla', g.sigla, 'denominacao', d.nome, 'bairro', b.nome, 'ministros', x.ministros
  ) order by g.nome), '[]'::jsonb)
  from public.igrejas g
  left join public.denominacoes d on d.id = g.denominacao_id
  left join public.bairros b on b.id = g.bairro_id
  cross join lateral (
    select count(distinct v.pessoa_id)::integer as ministros
    from public.vinculos_igreja v
    join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where v.igreja_id = g.id and v.fim is null and v.arquivado_em is null
  ) x
  where g.arquivado_em is null and x.ministros > 0;
$$;

create function interno.numeros_publicos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ministros', (select count(*) from public.associados a where a.arquivado_em is null and a.situacao = 'ativo'),
    'igrejas', (select jsonb_array_length(interno.igrejas_publicas())),
    'denominacoes', (
      select count(distinct g.denominacao_id) from public.igrejas g
      where g.arquivado_em is null and g.denominacao_id is not null
        and exists (select 1 from public.vinculos_igreja v
                    join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
                    where v.igreja_id = g.id and v.fim is null and v.arquivado_em is null)
    )
  );
$$;

create function public.diretoria_publica()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.diretoria_publica(); $$;
create function public.igrejas_publicas()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.igrejas_publicas(); $$;
create function public.numeros_publicos()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.numeros_publicos(); $$;

do $$
declare
  f text;
begin
  foreach f in array array['diretoria_publica()', 'igrejas_publicas()', 'numeros_publicos()'] loop
    execute format('revoke all on function interno.%s from public', f);
    execute format('grant execute on function interno.%s to anon, authenticated', f);
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end;
$$;
