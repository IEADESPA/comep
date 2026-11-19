-- =====================================================================
-- FASE 5.5 — TELAS NOVAS, PARTE 5: A REGULARIZAÇÃO DAS IGREJAS (o tipo novo de documento)
--
-- O alvará de licenciamento (inclui o Corpo de Bombeiros e a Vigilância Sanitária) passa a ser exigido
-- das igrejas (decisão do usuário com a diretoria, 18/11/2026). Valor novo de enum vai numa migração
-- própria: ele só pode ser usado depois de gravado (Convenções do banco).
-- =====================================================================
alter type public.tipo_documento_igreja add value if not exists 'alvara';
