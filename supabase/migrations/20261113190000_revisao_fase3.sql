-- =====================================================================
-- Revisão geral da Fase 3 (13/11/2026) — correções dos achados (docs/revisoes/fase-3.md)
--
--   1. CPF e filiação: só a própria pessoa, a secretaria e a presidência leem e gravam
--      (antes, o Conselho Fiscal e a tesouraria liam pela tabela, e a auditoria guardava os valores);
--   2. o nome vai na credencial: depois da associação, só a secretaria corrige;
--   3. tentativas com CPF que já é de outra pessoa: no máximo 5 (impede "sondar" quem é associado);
--   4. fotos públicas da credencial: só de associado ativo, com nome de arquivo conferido e no máximo
--      20 por credencial; a posse e a substituição só para associados ativos;
--   5. corrigir o fim do mandato: por função, conferindo se a data não mudou enquanto a tela estava
--      aberta e se fica depois do fim do mandato anterior;
--   6. dados_credenciais: o limite de 1 a 500 não pode ser burlado (lista de duas dimensões) e ids
--      repetidos contam uma vez;
--   7. ordem das travas (posse × emissão × substituição; usar × arquivar modelo), para não haver
--      credencial fora da posse nem versão arquivada em uso.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CPF e filiação fora da leitura comum de "pessoas"
-- ---------------------------------------------------------------------
revoke select on public.pessoas from authenticated;
grant select (id, usuario_id, nome, email, telefone, arquivado_em, criado_por, criado_em, atualizado_em, foto_caminho)
  on public.pessoas to authenticated;
revoke insert (cpf, nome_pai, nome_mae), update (cpf, nome_pai, nome_mae) on public.pessoas from authenticated;
comment on table public.pessoas is
  'Cadastro de pessoas. CPF e filiação NÃO saem na leitura comum: só por identidade_pessoa / gravar_identidade.';

-- Leitura: a própria pessoa, a secretaria ou a presidência
create function interno.identidade_pessoa(p_pessoa_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (p_pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia'))) then
    raise exception 'CPF e filiação: só a própria pessoa, a secretaria ou a presidência veem.' using errcode = '42501';
  end if;
  return (select jsonb_build_object('cpf', cpf, 'nome_pai', nome_pai, 'nome_mae', nome_mae) from public.pessoas where id = p_pessoa_id);
end;
$$;

-- Tentativas com CPF que já é de outra pessoa (para limitar a "sondagem")
create table public.tentativas_cpf (
  id            bigint generated always as identity primary key,
  pessoa_id     uuid not null references public.pessoas (id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.tentativas_cpf is 'Tentativas de gravar um CPF que já é de outra pessoa. Passou de 5, só a secretaria resolve.';
select interno.aplicar_padroes('public.tentativas_cpf');
alter table public.tentativas_cpf enable row level security;
revoke all on public.tentativas_cpf from anon, authenticated;

-- Gravação: só as chaves enviadas mudam. O ministro só preenche o que está vazio (gatilho proteger_identidade)
create function interno.gravar_identidade(p_pessoa_id uuid, p_dados jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_cpf text := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '[^0-9]', '', 'g'), '');
begin
  if v_eu is null or (p_pessoa_id <> v_eu and not v_diretoria) then
    raise exception 'CPF e filiação: cada um grava os seus; a secretaria corrige.' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end if;
  if not v_diretoria and (select count(*) from public.tentativas_cpf where pessoa_id = v_eu) >= 5 then
    raise exception 'Muitas tentativas com CPF que já está no cadastro de outra pessoa. Fale com a secretaria.' using errcode = 'P0001';
  end if;
  if p_dados ? 'cpf' and v_cpf is not null
     and exists (select 1 from public.pessoas where cpf = v_cpf and id <> p_pessoa_id and arquivado_em is null) then
    if not v_diretoria then
      insert into public.tentativas_cpf (pessoa_id) values (v_eu);
    end if;
    return 'cpf_repetido';
  end if;
  update public.pessoas
  set cpf      = case when p_dados ? 'cpf' then v_cpf else cpf end,
      nome_pai = case when p_dados ? 'nome_pai' then nullif(trim(p_dados ->> 'nome_pai'), '') else nome_pai end,
      nome_mae = case when p_dados ? 'nome_mae' then nullif(trim(p_dados ->> 'nome_mae'), '') else nome_mae end
  where id = p_pessoa_id;
  return 'ok';
end;
$$;

-- Pendências: as de CPF e mãe vêm de uma função (quem consulta não lê as colunas)
create function interno.pendencias_identidade(p_pessoa_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when p.cpf is null then 'Sem CPF' end,
    case when p.nome_mae is null then 'Sem o nome da mãe' end
  ], null)
  from public.pessoas p where p.id = p_pessoa_id;
$$;

create or replace view public.vw_pendencias_credencial
with (security_invoker = true)
as
select
  v.id as associado_id,
  v.pessoa_id,
  v.numero_registro,
  v.nome,
  v.igreja_id,
  v.igreja,
  array_remove(
    array[case when p.foto_caminho is null then 'Sem foto' end]
    || coalesce(interno.pendencias_identidade(p.id), '{}'::text[])
    || array[
      case when v.titulo_id is null then 'Sem título' end,
      case when v.igreja_id is null then 'Sem igreja' end,
      case when v.igreja_id is not null and v.funcao is null and not v.pastor_presidente then 'Sem a função na igreja' end,
      case when v.igreja_id is not null and i.sigla is null then 'Igreja sem sigla' end,
      case when v.igreja_id is not null and i.cnpj is null then 'Igreja sem CNPJ' end
    ],
    null
  ) as pendencias
from public.vw_associados v
join public.associados a on a.id = v.id
join public.pessoas p on p.id = v.pessoa_id
left join public.igrejas i on i.id = v.igreja_id
where v.situacao = 'ativo' and a.arquivado_em is null;

-- Auditoria: CPF e filiação de "pessoas" ficam mascarados (dá para ver QUE mudou, não o valor)
create or replace function interno.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_campo  text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_depois := to_jsonb(new);
  end if;

  -- Não registra UPDATE que não mudou nada (além do carimbo atualizado_em)
  if tg_op = 'UPDATE' and (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then
    return null;
  end if;

  if tg_table_name = 'pessoas' then
    foreach v_campo in array array['cpf', 'nome_pai', 'nome_mae'] loop
      if v_depois ->> v_campo is not null then
        v_depois := jsonb_set(v_depois, array[v_campo], to_jsonb(
          case when tg_op = 'UPDATE' and (v_antes ->> v_campo) is distinct from (v_depois ->> v_campo)
               then '(protegido — alterado)' else '(protegido)' end));
      end if;
      if v_antes ->> v_campo is not null then
        v_antes := jsonb_set(v_antes, array[v_campo], to_jsonb('(protegido)'::text));
      end if;
    end loop;
  end if;

  insert into public.auditoria (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, coalesce(v_depois ->> 'id', v_antes ->> 'id'), tg_op, v_antes, v_depois, auth.uid());

  return null;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. O nome vai na credencial: depois da associação, só a secretaria (ou a presidência) corrige
-- ---------------------------------------------------------------------
create or replace function interno.proteger_identidade()
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
  if new.nome is distinct from old.nome
     and exists (select 1 from public.associados a where a.pessoa_id = old.id and a.arquivado_em is null and a.situacao = 'ativo') then
    raise exception 'O nome vai na credencial: depois da associação, só a secretaria corrige.' using errcode = '42501';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Fotos públicas da credencial: associado ativo, nome conferido, no máximo 20 por credencial
-- ---------------------------------------------------------------------
create function interno.posso_publicar_foto(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_caminho ~ '^[0-9a-f]{32}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$'
    and position('..' in p_caminho) = 0
    and exists (
      select 1
      from public.credenciais c
      join public.associados a on a.pessoa_id = c.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where c.codigo = split_part(p_caminho, '/', 1)
        and c.substituida_em is null and c.renovada_em is null and c.arquivado_em is null
        and (c.pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')))
    )
    and (select count(*) from storage.objects o
         where o.bucket_id = 'credenciais' and split_part(o.name, '/', 1) = split_part(p_caminho, '/', 1)) < 20;
$$;

drop policy "credenciais: o dono ou a secretaria enviam a foto da credencial" on storage.objects;
create policy "credenciais: o dono ou a secretaria enviam a foto da credencial"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'credenciais' and (select interno.posso_publicar_foto(name)));

create or replace function interno.registrar_foto_publica(p_codigo text, p_caminho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
begin
  select * into v_credencial from public.credenciais
  where codigo = p_codigo and substituida_em is null and renovada_em is null and arquivado_em is null for update;
  if not found then
    raise exception 'Credencial não encontrada.' using errcode = 'P0001';
  end if;
  if not (v_credencial.pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia'))) then
    raise exception 'Sem permissão para esta credencial.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.associados a where a.pessoa_id = v_credencial.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo') then
    raise exception 'Só associado ativo tem credencial.' using errcode = 'P0001';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_codigo
     or p_caminho !~ '^[0-9a-f]{32}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$' or position('..' in p_caminho) > 0
     or not exists (select 1 from storage.objects where bucket_id = 'credenciais' and name = p_caminho) then
    raise exception 'A foto precisa estar na pasta desta credencial.' using errcode = 'P0001';
  end if;
  update public.credenciais set foto_publica = p_caminho where id = v_credencial.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Ordem das travas: tudo o que cria ou troca credencial passa antes pela linha da configuração
--    (a posse a trava para escrever; os demais, para ler). Assim nada escapa da posse.
-- ---------------------------------------------------------------------
create or replace function interno.codigo_credencial(p_pessoa_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  perform 1 from public.config_credencial where id for share;
  perform pg_advisory_xact_lock(hashtext('comep: credencial ' || p_pessoa_id::text));
  select codigo into v_codigo from public.credenciais
  where pessoa_id = p_pessoa_id and substituida_em is null and renovada_em is null and arquivado_em is null;
  if v_codigo is null then
    v_codigo := replace(gen_random_uuid()::text, '-', '');
    insert into public.credenciais (pessoa_id, codigo) values (p_pessoa_id, v_codigo);
  end if;
  return v_codigo;
end;
$$;

create or replace function interno.substituir_credencial(p_pessoa_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência emitem uma nova credencial.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo (ex.: perda, roubo, dados mudaram).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.associados a where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo') then
    raise exception 'Só associado ativo tem credencial.' using errcode = 'P0001';
  end if;
  perform 1 from public.config_credencial where id for share;
  perform pg_advisory_xact_lock(hashtext('comep: credencial ' || p_pessoa_id::text));
  update public.credenciais
  set substituida_em = now(), motivo_substituicao = trim(p_motivo)
  where pessoa_id = p_pessoa_id and substituida_em is null and arquivado_em is null;
  return interno.codigo_credencial(p_pessoa_id);
end;
$$;

-- Posse: só as credenciais de associados ativos são renovadas
create or replace function interno.registrar_novo_mandato(p_fim date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.config_credencial;
  v_atual public.credenciais;
  v_renovadas integer := 0;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram o novo mandato.' using errcode = '42501';
  end if;
  select * into v_config from public.config_credencial where id for update;
  if v_config.fim_mandato is null then
    raise exception 'Informe primeiro o fim do mandato em curso (Configurações → Credencial).' using errcode = 'P0001';
  end if;
  if p_fim is null or p_fim <= v_config.fim_mandato or p_fim <= current_date then
    raise exception 'O fim do novo mandato precisa ser depois do fim do mandato atual e depois de hoje.' using errcode = 'P0001';
  end if;

  for v_atual in
    select c.* from public.credenciais c
    where c.substituida_em is null and c.renovada_em is null and c.arquivado_em is null
      and exists (select 1 from public.associados a where a.pessoa_id = c.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo')
    order by c.pessoa_id
    for update
  loop
    update public.credenciais
    set renovada_em = now(), valida_ate = v_config.fim_mandato
    where id = v_atual.id;
    insert into public.credenciais (pessoa_id, codigo, foto_publica)
    values (v_atual.pessoa_id, replace(gen_random_uuid()::text, '-', ''), v_atual.foto_publica);
    v_renovadas := v_renovadas + 1;
  end loop;

  update public.config_credencial set fim_mandato = p_fim where id;
  return v_renovadas;
end;
$$;

create or replace function interno.usar_modelo_credencial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o modelo da credencial.' using errcode = '42501';
  end if;
  perform 1 from public.config_credencial where id for update;
  if p_id is not null then
    perform 1 from public.modelos_credencial where id = p_id and arquivado_em is null for share;
    if not found then
      raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
    end if;
  end if;
  update public.config_credencial set modelo_id = p_id where id;
end;
$$;

create or replace function interno.arquivar_modelo_credencial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o modelo da credencial.' using errcode = '42501';
  end if;
  perform 1 from public.config_credencial where id for update;
  if p_id is not distinct from (select modelo_id from public.config_credencial where id) then
    raise exception 'Esta versão está em uso. Escolha outra antes de arquivar.' using errcode = 'P0001';
  end if;
  update public.modelos_credencial set arquivado_em = now() where id = p_id and arquivado_em is null;
  if not found then
    raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Corrigir o fim do mandato em curso (não mais direto na tabela)
-- ---------------------------------------------------------------------
create function interno.corrigir_fim_mandato(p_fim date, p_esperado date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.config_credencial;
  v_anterior date;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência corrigem o fim do mandato.' using errcode = '42501';
  end if;
  select * into v_config from public.config_credencial where id for update;
  if v_config.fim_mandato is distinct from p_esperado then
    raise exception 'O fim do mandato mudou enquanto a tela estava aberta (talvez alguém registrou a posse). Recarregue a página e confira.'
      using errcode = 'P0001';
  end if;
  v_anterior := (select max(valida_ate) from public.credenciais where renovada_em is not null);
  if v_anterior is not null and (p_fim is null or p_fim <= v_anterior) then
    raise exception 'O fim do mandato em curso precisa ser depois do fim do mandato anterior (%).', to_char(v_anterior, 'DD/MM/YYYY')
      using errcode = 'P0001';
  end if;
  update public.config_credencial set fim_mandato = p_fim where id;
end;
$$;

revoke update (fim_mandato) on public.config_credencial from authenticated;


-- ---------------------------------------------------------------------
-- 6. Dados das credenciais: limite de verdade (uma dimensão, 1 a 500, sem repetir) e emissão
--    em ordem fixa (evita duas telas travando uma à outra)
-- ---------------------------------------------------------------------
create or replace function interno.dados_credenciais(p_pessoas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_ids uuid[];
  v_pessoa uuid;
  v_lista jsonb := '[]'::jsonb;
  v_item jsonb;
  v_codigo text;
  v_credencial public.credenciais;
  v_config public.config_credencial;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver a credencial.' using errcode = '42501';
  end if;
  if p_pessoas is null or array_ndims(p_pessoas) <> 1 or cardinality(p_pessoas) not between 1 and 500 then
    raise exception 'Escolha de 1 a 500 credenciais.' using errcode = 'P0001';
  end if;
  -- sem repetir e sem vazios, na ordem pedida
  v_ids := array(
    select x from unnest(p_pessoas) with ordinality as t(x, n) where x is not null group by x order by min(n)
  );
  foreach v_pessoa in array v_ids loop
    if v_pessoa <> v_eu and not v_diretoria then
      raise exception 'Só a secretaria ou a presidência veem a credencial de outra pessoa.' using errcode = '42501';
    end if;
  end loop;
  select * into v_config from public.config_credencial where id;

  -- cria as credenciais que faltam em ordem fixa (duas telas ao mesmo tempo não se travam)
  for v_pessoa in
    select x from unnest(v_ids) x
    where exists (select 1 from public.associados a where a.pessoa_id = x and a.arquivado_em is null and a.situacao = 'ativo')
    order by x
  loop
    perform interno.codigo_credencial(v_pessoa);
  end loop;

  foreach v_pessoa in array v_ids loop
    select jsonb_build_object(
      'pessoa_id', v.pessoa_id,
      'nome', v.nome,
      'cpf', p.cpf,
      'nome_pai', p.nome_pai,
      'nome_mae', p.nome_mae,
      'numero_registro', v.numero_registro,
      'admitido_em', v.admitido_em,
      'titulo', v.titulo,
      'funcao', coalesce(v.funcao, case when v.pastor_presidente then 'Pastor presidente' end),
      'igreja', v.igreja,
      'igreja_sigla', i.sigla,
      'igreja_cnpj', i.cnpj,
      'foto_caminho', p.foto_caminho,
      'em_dia', interno.esta_em_dia(v.pessoa_id),
      'jubilado', v.jubilado,
      'pendencias', coalesce(pc.pendencias, '{}'::text[])
    )
    into v_item
    from public.vw_associados v
    join public.associados a on a.id = v.id
    join public.pessoas p on p.id = v.pessoa_id
    left join public.igrejas i on i.id = v.igreja_id
    left join public.vw_pendencias_credencial pc on pc.associado_id = v.id
    where v.pessoa_id = v_pessoa and v.situacao = 'ativo' and a.arquivado_em is null;
    if v_item is not null then
      v_codigo := interno.codigo_credencial(v_pessoa);
      select * into v_credencial from public.credenciais where codigo = v_codigo;
      v_item := v_item || jsonb_build_object(
        'codigo', v_credencial.codigo,
        'foto_publica', v_credencial.foto_publica,
        'valida_ate', coalesce(v_credencial.valida_ate, v_config.fim_mandato),
        'emitida_em', v_credencial.criado_em
      );
      v_lista := v_lista || jsonb_build_array(v_item);
    end if;
  end loop;

  return jsonb_build_object(
    'fim_mandato', v_config.fim_mandato,
    'texto_verso', v_config.texto_verso,
    'credenciais', v_lista
  );
end;
$$;


-- ---------------------------------------------------------------------
-- Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.identidade_pessoa(p_pessoa_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select interno.identidade_pessoa(p_pessoa_id);
$$;
create function public.gravar_identidade(p_pessoa_id uuid, p_dados jsonb)
returns text language sql security invoker set search_path = '' as $$
  select interno.gravar_identidade(p_pessoa_id, p_dados);
$$;
create function public.corrigir_fim_mandato(p_fim date, p_esperado date)
returns void language sql security invoker set search_path = '' as $$
  select interno.corrigir_fim_mandato(p_fim, p_esperado);
$$;

revoke all on function interno.identidade_pessoa(uuid) from public;
revoke all on function interno.gravar_identidade(uuid, jsonb) from public;
revoke all on function interno.pendencias_identidade(uuid) from public;
revoke all on function interno.posso_publicar_foto(text) from public;
revoke all on function interno.corrigir_fim_mandato(date, date) from public;
grant execute on function interno.identidade_pessoa(uuid) to authenticated;
grant execute on function interno.gravar_identidade(uuid, jsonb) to authenticated;
grant execute on function interno.pendencias_identidade(uuid) to authenticated;
grant execute on function interno.posso_publicar_foto(text) to authenticated;
grant execute on function interno.corrigir_fim_mandato(date, date) to authenticated;

revoke all on function public.identidade_pessoa(uuid) from public, anon;
revoke all on function public.gravar_identidade(uuid, jsonb) from public, anon;
revoke all on function public.corrigir_fim_mandato(date, date) from public, anon;
grant execute on function public.identidade_pessoa(uuid) to authenticated;
grant execute on function public.gravar_identidade(uuid, jsonb) to authenticated;
grant execute on function public.corrigir_fim_mandato(date, date) to authenticated;
