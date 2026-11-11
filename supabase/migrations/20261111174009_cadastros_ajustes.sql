-- =====================================================================
-- FASE 1.1 — AJUSTES DA REVISÃO (docs/revisoes/fase-1.md)
-- A migração anterior já está no banco de teste; por isso os ajustes vêm
-- numa migração nova (migrações só acrescentam — PROJETO.md, seção 14.3).
-- =====================================================================

-- 1. Índice para a chave estrangeira titulos_pessoa.titulo_id (aviso do verificador do Supabase).
create index titulos_pessoa_titulo on public.titulos_pessoa (titulo_id);

-- 2. Ao arquivar um cadastro de associado feito por engano, a pessoa SEM login que existia
--    só por causa dele também é arquivada, para não sobrar na lista de perfis de acesso.
--    Quem tem login, outro cadastro ativo ou algum perfil da diretoria não é arquivado.
create function interno.arquivar_pessoa_sem_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.arquivado_em is null and new.arquivado_em is not null then
    update public.pessoas p
    set arquivado_em = new.arquivado_em
    where p.id = new.pessoa_id
      and p.usuario_id is null
      and p.arquivado_em is null
      and not exists (
        select 1 from public.associados a
        where a.pessoa_id = p.id and a.arquivado_em is null and a.id <> new.id
      )
      and not exists (
        select 1 from public.perfis_acesso pa
        where pa.pessoa_id = p.id and pa.arquivado_em is null and pa.perfil <> 'ministro'
      );
  end if;
  return null;
end;
$$;

create trigger arquivar_pessoa_sem_login
  after update of arquivado_em on public.associados
  for each row execute function interno.arquivar_pessoa_sem_login();

revoke all on function interno.arquivar_pessoa_sem_login() from public;
