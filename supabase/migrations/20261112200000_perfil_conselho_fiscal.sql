-- =====================================================================
-- Fase 2.3 (parte 1): perfil do Conselho Fiscal (Art. 14).
-- Vê o financeiro (só leitura) e registra o parecer sobre o balanço anual.
-- Fica sozinho nesta migração: um valor novo de enum só pode ser usado depois de gravado.
-- =====================================================================
alter type public.perfil_acesso add value if not exists 'conselho_fiscal';
