-- =====================================================================
-- FASE 2.1 — AJUSTE: a secretaria lê as cobranças (só leitura)
--
-- Sem isso, a lista "em dia / em atraso" (vw_situacao_contribuicao) mostrava
-- TODOS em dia para a secretaria, que via os associados mas não as cobranças.
-- A secretaria precisa da situação certa para as assembleias (quem vota — Art. 11).
-- Gravar continua só com a tesouraria/presidência, pelas funções.
-- =====================================================================
alter policy "cobranças: ver as próprias ou ser da tesouraria/presidência" on public.cobrancas
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
  );
alter policy "cobranças: ver as próprias ou ser da tesouraria/presidência" on public.cobrancas
  rename to "cobranças: ver as próprias ou ser da secretaria/tesouraria/presidência";
