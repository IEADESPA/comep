-- =====================================================================
-- FASE 1.3 — AJUSTE DA REVISÃO (aviso do verificador do Supabase)
-- Duas regras de alteração na tabela igrejas viram uma só (mesmo efeito,
-- consulta mais leve): secretaria/presidência alteram; o pastor presidente
-- atualiza a própria igreja (o gatilho proteger_igreja limita a endereço,
-- bairro e telefone).
-- =====================================================================
drop policy "igrejas: secretaria e presidência alteram" on public.igrejas;
drop policy "igrejas: o pastor presidente atualiza a própria igreja" on public.igrejas;

create policy "igrejas: secretaria/presidência alteram; o pastor presidente atualiza a própria"
  on public.igrejas for update to authenticated
  using (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or id in (select interno.igrejas_que_presido())
  )
  with check (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or id in (select interno.igrejas_que_presido())
  );
