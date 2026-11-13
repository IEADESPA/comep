-- =====================================================================
-- Fase 3.4 — Editor do modelo da credencial (PROJETO.md, seção 4.5)
--
--   * o desenho da credencial (o que vai em cada lado, onde, cores, formas, fotos e textos) é um
--     MODELO em JSON, editado na tela pela secretaria ou pela presidência;
--   * cada vez que se salva, nasce uma VERSÃO nova. Nenhuma versão muda nem se apaga: dá para voltar
--     a qualquer versão anterior, ou ao modelo padrão do sistema (modelo_id vazio);
--   * imagens do modelo (ex.: o logo oficial) vão para a pasta pública "credencial-modelo",
--     com nome aleatório. Não são dados pessoais.
-- O desenho é sempre conferido na tela antes de desenhar (utilitarios/modeloCredencial.ts):
-- cores, números e imagens fora do esperado são descartados.
-- =====================================================================

create table public.modelos_credencial (
  id            uuid primary key default gen_random_uuid(),
  modelo        jsonb not null,
  descricao     text not null,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- coalesce: parte que falta (ex.: sem "verso") dá falso, e não "vazio" (que passaria na regra)
  constraint modelos_credencial_formato check (coalesce(
    jsonb_typeof(modelo) = 'object'
    and modelo ->> 'versao' = '1'
    and jsonb_typeof(modelo -> 'frente') = 'object'
    and jsonb_typeof(modelo -> 'verso') = 'object'
    and jsonb_typeof(modelo -> 'frente' -> 'elementos') = 'array'
    and jsonb_typeof(modelo -> 'verso' -> 'elementos') = 'array'
    and jsonb_array_length(modelo -> 'frente' -> 'elementos') <= 60
    and jsonb_array_length(modelo -> 'verso' -> 'elementos') <= 60
    and octet_length(modelo::text) <= 100000,
    false
  )),
  constraint modelos_credencial_descricao check (length(trim(descricao)) between 1 and 200)
);
comment on table public.modelos_credencial is 'Versões do desenho da credencial. Nenhuma muda nem se apaga; a em uso fica em config_credencial.modelo_id.';
select interno.aplicar_padroes('public.modelos_credencial');

-- Versão salva não muda (o histórico vale como registro do que foi impresso)
create trigger proibir_alteracao before update on public.modelos_credencial
  for each row execute function interno.proibir_alteracao();

alter table public.config_credencial
  add column modelo_id uuid references public.modelos_credencial (id);
comment on column public.config_credencial.modelo_id is 'Versão do modelo em uso. Vazio = o modelo padrão do sistema.';


-- ---------------------------------------------------------------------
-- Salvar (nova versão) e escolher a versão em uso
-- ---------------------------------------------------------------------
create function interno.salvar_modelo_credencial(p_modelo jsonb, p_descricao text, p_usar boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o modelo da credencial.' using errcode = '42501';
  end if;
  if coalesce(trim(p_descricao), '') = '' then
    raise exception 'Descreva o que mudou (ex.: logo oficial no cabeçalho).' using errcode = 'P0001';
  end if;
  insert into public.modelos_credencial (modelo, descricao) values (p_modelo, trim(p_descricao)) returning id into v_id;
  if p_usar then
    update public.config_credencial set modelo_id = v_id where id;
  end if;
  return v_id;
end;
$$;

create function interno.usar_modelo_credencial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o modelo da credencial.' using errcode = '42501';
  end if;
  if p_id is not null and not exists (select 1 from public.modelos_credencial where id = p_id) then
    raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
  end if;
  update public.config_credencial set modelo_id = p_id where id;
end;
$$;


-- ---------------------------------------------------------------------
-- Os dados da credencial passam a levar o modelo em uso (vazio = padrão do sistema)
-- ---------------------------------------------------------------------
create function interno.modelo_credencial_em_uso()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select m.modelo
  from public.config_credencial c
  join public.modelos_credencial m on m.id = c.modelo_id
  where c.id;
$$;

create or replace function public.dados_credenciais(p_pessoas uuid[])
returns jsonb language sql security invoker set search_path = '' as $$
  select interno.dados_credenciais(p_pessoas) || jsonb_build_object('modelo', interno.modelo_credencial_em_uso());
$$;


-- ---------------------------------------------------------------------
-- Lista das versões (com o nome de quem salvou), para o editor
-- ---------------------------------------------------------------------
create view public.vw_modelos_credencial
with (security_invoker = true)
as
select
  m.id,
  m.descricao,
  m.modelo,
  m.criado_em,
  p.nome as criado_por_nome,
  (m.id = c.modelo_id) as em_uso
from public.modelos_credencial m
left join public.pessoas p on p.usuario_id = m.criado_por
cross join public.config_credencial c
where c.id;


-- ---------------------------------------------------------------------
-- Pasta pública das imagens do modelo (só a secretaria e a presidência enviam)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credencial-modelo', 'credencial-modelo', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "credencial-modelo: secretaria e presidência enviam imagens do modelo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'credencial-modelo'
    and name ~ '^[0-9a-f-]{36}\.(png|jpg|webp)$'
    and (select interno.tenho_perfil('secretaria', 'presidencia'))
  );


-- ---------------------------------------------------------------------
-- Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.salvar_modelo_credencial(p_modelo jsonb, p_descricao text, p_usar boolean)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.salvar_modelo_credencial(p_modelo, p_descricao, p_usar);
$$;
create function public.usar_modelo_credencial(p_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select interno.usar_modelo_credencial(p_id);
$$;

revoke all on function interno.salvar_modelo_credencial(jsonb, text, boolean) from public;
revoke all on function interno.usar_modelo_credencial(uuid) from public;
revoke all on function interno.modelo_credencial_em_uso() from public;
grant execute on function interno.salvar_modelo_credencial(jsonb, text, boolean) to authenticated;
grant execute on function interno.usar_modelo_credencial(uuid) to authenticated;
grant execute on function interno.modelo_credencial_em_uso() to authenticated;

revoke all on function public.salvar_modelo_credencial(jsonb, text, boolean) from public, anon;
revoke all on function public.usar_modelo_credencial(uuid) from public, anon;
revoke all on function public.dados_credenciais(uuid[]) from public, anon;
grant execute on function public.salvar_modelo_credencial(jsonb, text, boolean) to authenticated;
grant execute on function public.usar_modelo_credencial(uuid) to authenticated;
grant execute on function public.dados_credenciais(uuid[]) to authenticated;

-- Tabela: só leitura pela API (secretaria e presidência); gravar, só pelas funções
revoke all on public.modelos_credencial from anon, authenticated;
grant select on public.modelos_credencial to authenticated;
revoke all on public.vw_modelos_credencial from anon, authenticated;
grant select on public.vw_modelos_credencial to authenticated;

alter table public.modelos_credencial enable row level security;
create policy "modelos da credencial: secretaria e presidência leem"
  on public.modelos_credencial for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')));
