-- =====================================================================
-- AJUSTE: limite de 30 arquivos só para quem ainda NÃO é associado
--
-- O limite (revisão de segurança, 20261112140648) existe para barrar logins
-- criados só para encher o espaço gratuito. Associado ativo é pessoa conferida
-- e pode trocar a foto quantas vezes precisar ao longo dos anos.
-- (Achado com o banco de teste cheio: o ministro fictício dos testes chegou a
-- 30 fotos e não conseguia mais trocar — docs/revisoes/fase-1.md, problema 15.)
-- =====================================================================
create function interno.posso_enviar_arquivo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.associados a
           where a.pessoa_id = (select interno.minha_pessoa_id()) and a.arquivado_em is null and a.situacao = 'ativo'
         )
      or (select interno.quantos_arquivos_tenho()) < 30;
$$;

revoke all on function interno.posso_enviar_arquivo() from public;
grant execute on function interno.posso_enviar_arquivo() to authenticated;

drop policy "documentos: cada um envia para a própria pasta (até 30 arquivos)" on storage.objects;
create policy "documentos: cada um envia para a própria pasta (até 30 arquivos para quem não é associado)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = 'pessoas'
    and (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
    and position('..' in name) = 0
    and position('//' in name) = 0
    and (select interno.posso_enviar_arquivo())
  );
