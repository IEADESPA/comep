-- Fase 3.3 (ajuste de 13/11/2026): o texto padrão do verso dizia "sem necessidade de reimpressão",
-- o que deixou de valer (a impressa é renovada a cada mandato). Troca só se ninguém mudou o texto.

alter table public.config_credencial alter column texto_verso set default
  'Credencial pessoal e intransferível de associado do Conselho de Ministros Evangélicos de Parauapebas (COMEP), '
  || 'válida até o fim do mandato da diretoria. A situação atual — ativo e em dia com a contribuição — é conferida pelo QR Code.';

update public.config_credencial
set texto_verso =
  'Credencial pessoal e intransferível de associado do Conselho de Ministros Evangélicos de Parauapebas (COMEP), '
  || 'válida até o fim do mandato da diretoria. A situação atual — ativo e em dia com a contribuição — é conferida pelo QR Code.'
where id
  and texto_verso =
    'Credencial pessoal e intransferível de associado do Conselho de Ministros Evangélicos de Parauapebas (COMEP). '
    || 'A situação atual — ativo, em dia com a contribuição e validade — é conferida pelo QR Code, sem necessidade de reimpressão.';
