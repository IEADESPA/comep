-- =====================================================================
-- Fase 3.4 — Arquivar versões do modelo da credencial que não servem mais
-- A versão continua guardada (nada se apaga) e só sai da lista. O desenho e a descrição não mudam nunca.
-- A versão em uso não pode ser arquivada; versão arquivada não pode voltar a ser usada.
-- =====================================================================

alter table public.modelos_credencial add column arquivado_em timestamptz;

drop trigger proibir_alteracao on public.modelos_credencial;

create function interno.proteger_versao_modelo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.modelo is distinct from old.modelo
     or new.descricao is distinct from old.descricao
     or new.criado_por is distinct from old.criado_por
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Versão salva do modelo não muda (só pode ser arquivada).' using errcode = 'P0001';
  end if;
  if old.arquivado_em is not null then
    raise exception 'Esta versão já está arquivada.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger proteger_versao before update on public.modelos_credencial
  for each row execute function interno.proteger_versao_modelo();

create function interno.arquivar_modelo_credencial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o modelo da credencial.' using errcode = '42501';
  end if;
  if p_id is not distinct from (select modelo_id from public.config_credencial where id) then
    raise exception 'Esta versão está em uso. Escolha outra antes de arquivar.' using errcode = 'P0001';
  end if;
  update public.modelos_credencial set arquivado_em = now() where id = p_id and arquivado_em is null;
  if not found then
    raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
  end if;
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
  if p_id is not null and not exists (select 1 from public.modelos_credencial where id = p_id and arquivado_em is null) then
    raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
  end if;
  update public.config_credencial set modelo_id = p_id where id;
end;
$$;

create or replace view public.vw_modelos_credencial
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
where c.id and m.arquivado_em is null;

create function public.arquivar_modelo_credencial(p_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select interno.arquivar_modelo_credencial(p_id);
$$;

revoke all on function interno.arquivar_modelo_credencial(uuid) from public;
grant execute on function interno.arquivar_modelo_credencial(uuid) to authenticated;
revoke all on function public.arquivar_modelo_credencial(uuid) from public, anon;
grant execute on function public.arquivar_modelo_credencial(uuid) to authenticated;
