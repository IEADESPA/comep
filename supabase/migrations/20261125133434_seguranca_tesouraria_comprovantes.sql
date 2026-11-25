-- Revisão permanente, módulo 1 (25/11/2026), achado S1-04, com a decisão do presidente de 25/11/2026: a tesouraria
-- vê no balde "documentos" só os comprovantes de pagamento, como o Conselho Fiscal. As fotos, o comprovante do título
-- e os outros documentos pessoais ficam com a própria pessoa, a secretaria e a presidência.
-- As telas do Financeiro e do Conselho Fiscal só abrem comprovantes de pagamento: todos são gravados como
-- pessoas/<id>/pagamento-<data>.<ext> (src/dados/pedidos.ts, enviarArquivo com o tipo "pagamento").
-- O nome do comprovante fica mais justo para os dois: direto na pasta da pessoa, sem subpasta.

drop policy "documentos: ver os próprios, ser da diretoria ou comprovante para o Conselho Fiscal" on storage.objects;
create policy "documentos: ver os próprios, ser da secretaria/presidência ou comprovante para a tesouraria e o Conselho Fiscal"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
      or (select interno.tenho_perfil('secretaria', 'presidencia'))
      or (name ~ '^pessoas/[^/]+/pagamento-[^/]+$' and (select interno.tenho_perfil('tesouraria', 'conselho_fiscal')))
    )
  );
