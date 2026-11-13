-- =====================================================================
-- Fase 3.1 — Dados da credencial (PROJETO.md, seção 4.5; decisões de 12/11/2026)
--
--   * pessoa: CPF e filiação (pai e mãe) — vão na credencial (é de um conselho municipal);
--     o próprio ministro preenche enquanto estão vazios; depois, só a secretaria corrige;
--   * igreja: sigla (nome curto que vai na credencial, com o CNPJ);
--   * pendências da credencial de cada associado: sem foto, sem CPF, sem o nome da mãe,
--     sem título, sem igreja, sem função na igreja, igreja sem sigla, igreja sem CNPJ.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CPF e filiação
-- ---------------------------------------------------------------------
create function interno.cpf_valido(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_soma integer;
  v_digito integer;
begin
  if p_cpf is null then
    return true;
  end if;
  if p_cpf !~ '^[0-9]{11}$' or p_cpf ~ '^([0-9])\1{10}$' then
    return false;
  end if;
  v_soma := 0;
  for i in 1..9 loop
    v_soma := v_soma + substr(p_cpf, i, 1)::integer * (11 - i);
  end loop;
  v_digito := (v_soma * 10) % 11 % 10;
  if v_digito <> substr(p_cpf, 10, 1)::integer then
    return false;
  end if;
  v_soma := 0;
  for i in 1..10 loop
    v_soma := v_soma + substr(p_cpf, i, 1)::integer * (12 - i);
  end loop;
  v_digito := (v_soma * 10) % 11 % 10;
  return v_digito = substr(p_cpf, 11, 1)::integer;
end;
$$;

alter table public.pessoas
  add column cpf text check (interno.cpf_valido(cpf)),
  add column nome_pai text check (nome_pai is null or length(trim(nome_pai)) > 0),
  add column nome_mae text check (nome_mae is null or length(trim(nome_mae)) > 0);
comment on column public.pessoas.cpf is 'Só os 11 números, sem pontuação. Vai na credencial.';
comment on column public.pessoas.nome_pai is 'Filiação (vai na credencial). Pode ficar vazio quando não há pai registrado.';
comment on column public.pessoas.nome_mae is 'Filiação (vai na credencial).';
create unique index pessoas_cpf_unico on public.pessoas (cpf) where cpf is not null and arquivado_em is null;

grant insert (cpf, nome_pai, nome_mae), update (cpf, nome_pai, nome_mae) on public.pessoas to authenticated;

-- Depois de preenchidos, CPF e filiação só a secretaria (ou a presidência) corrige
create function interno.proteger_identidade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select interno.tenho_perfil('secretaria', 'presidencia')) then
    return new;
  end if;
  if (old.cpf is not null and new.cpf is distinct from old.cpf)
     or (old.nome_pai is not null and new.nome_pai is distinct from old.nome_pai)
     or (old.nome_mae is not null and new.nome_mae is distinct from old.nome_mae) then
    raise exception 'CPF e filiação, depois de preenchidos, só a secretaria corrige (eles vão na credencial).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger proteger_identidade
  before update on public.pessoas
  for each row execute function interno.proteger_identidade();


-- ---------------------------------------------------------------------
-- 2. Sigla da igreja (o pastor presidente também pode preencher: proteger_igreja não a impede)
-- ---------------------------------------------------------------------
alter table public.igrejas
  add column sigla text check (sigla is null or length(trim(sigla)) between 2 and 20);
comment on column public.igrejas.sigla is 'Nome curto da igreja (ex.: IEADESPA). Vai na credencial, com o CNPJ.';
create unique index igrejas_sigla_unica on public.igrejas (lower(trim(sigla))) where sigla is not null and arquivado_em is null;
grant insert (sigla), update (sigla) on public.igrejas to authenticated;


-- ---------------------------------------------------------------------
-- 3. Pendências da credencial (respeita a RLS de quem consulta: o associado vê as suas;
--    a diretoria, as de todos)
-- ---------------------------------------------------------------------
create view public.vw_pendencias_credencial
with (security_invoker = true)
as
select
  v.id as associado_id,
  v.pessoa_id,
  v.numero_registro,
  v.nome,
  v.igreja_id,
  v.igreja,
  array_remove(array[
    case when p.foto_caminho is null then 'Sem foto' end,
    case when p.cpf is null then 'Sem CPF' end,
    case when p.nome_mae is null then 'Sem o nome da mãe' end,
    case when v.titulo_id is null then 'Sem título' end,
    case when v.igreja_id is null then 'Sem igreja' end,
    case when v.igreja_id is not null and v.funcao is null and not v.pastor_presidente then 'Sem a função na igreja' end,
    case when v.igreja_id is not null and i.sigla is null then 'Igreja sem sigla' end,
    case when v.igreja_id is not null and i.cnpj is null then 'Igreja sem CNPJ' end
  ], null) as pendencias
from public.vw_associados v
join public.associados a on a.id = v.id
join public.pessoas p on p.id = v.pessoa_id
left join public.igrejas i on i.id = v.igreja_id
where v.situacao = 'ativo' and a.arquivado_em is null;
comment on view public.vw_pendencias_credencial is
  'O que falta para a credencial de cada associado ativo. Lista vazia = credencial completa.';

revoke all on public.vw_pendencias_credencial from anon, authenticated;
grant select on public.vw_pendencias_credencial to authenticated;

revoke all on function interno.proteger_identidade() from public;
