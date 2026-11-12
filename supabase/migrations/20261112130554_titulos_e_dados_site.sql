-- =====================================================================
-- FASE 1 — RESPOSTAS DA DIRETORIA (12/11/2026)
--
-- * Decisão 9: títulos aceitos — Pastor(a), Evangelista, Presbítero,
--   Apóstolo(a), Bispo(a). "Missionário" e "Líder" (lista provisória) são
--   arquivados: quem já os tinha continua com o histórico.
-- * Decisão 14: os dados do COMEP para o site (CNPJ, sede, contatos) ainda
--   não existem. Ficam numa tabela editável pela diretoria; o site mostra "—"
--   onde estiver vazio. Inclui o dia das reuniões mensais (decisão 7).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Títulos ministeriais (decisão 9)
-- ---------------------------------------------------------------------
update public.titulos_ministeriais set nome = 'Pastor(a)', ordem = 10 where nome = 'Pastor' and arquivado_em is null;
update public.titulos_ministeriais set ordem = 20 where nome = 'Evangelista' and arquivado_em is null;
update public.titulos_ministeriais set ordem = 30 where nome = 'Presbítero' and arquivado_em is null;

insert into public.titulos_ministeriais (nome, ordem)
select x.nome, x.ordem
from (values ('Apóstolo(a)', 40), ('Bispo(a)', 50)) as x (nome, ordem)
where not exists (
  select 1 from public.titulos_ministeriais t
  where lower(trim(t.nome)) = lower(x.nome) and t.arquivado_em is null
);

update public.titulos_ministeriais
set arquivado_em = now()
where nome in ('Missionário', 'Líder') and arquivado_em is null;


-- ---------------------------------------------------------------------
-- 2. Dados do COMEP mostrados no site (uma linha só)
-- ---------------------------------------------------------------------
create table public.dados_comep (
  id               boolean primary key default true check (id),
  cnpj             text check (interno.cnpj_valido(cnpj)),
  endereco_sede    text,
  telefone         text,
  whatsapp         text,
  email            text,
  instagram        text,
  facebook         text,
  youtube          text,
  reunioes_mensais text,
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.dados_comep is 'Dados públicos do COMEP mostrados no site (uma linha só). Editáveis pela secretaria, presidência e administrador técnico.';
comment on column public.dados_comep.reunioes_mensais is 'Dia e horário das reuniões mensais, como texto (ex.: "Toda 1ª segunda-feira do mês, às 19h").';
select interno.aplicar_padroes('public.dados_comep');

insert into public.dados_comep (id) values (true);

revoke all on public.dados_comep from anon, authenticated;
grant select on public.dados_comep to anon, authenticated;
grant update (cnpj, endereco_sede, telefone, whatsapp, email, instagram, facebook, youtube, reunioes_mensais)
  on public.dados_comep to authenticated;

alter table public.dados_comep enable row level security;

create policy "dados do COMEP: públicos (aparecem no site)"
  on public.dados_comep for select to anon, authenticated using (true);

create policy "dados do COMEP: secretaria, presidência e administrador alteram"
  on public.dados_comep for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')));
