-- =====================================================================
-- Fase 2.3 — Prestação de contas (PROJETO.md, seção 4.4)
--
--   * Conselho Fiscal: lê o financeiro (só leitura) e os comprovantes de pagamento;
--   * resumo do exercício (abril a março): saldos por conta, entradas e saídas por categoria,
--     contribuições previstas e recebidas — e contribuições por igreja;
--   * balanço anual em quatro passos (Art. 12, §6º, III; Art. 14; Art. 15, I):
--       1. a tesouraria fecha o exercício (o resumo fica congelado) e envia à diretoria;
--       2. a diretoria (presidência) registra a análise — ou devolve para correção;
--       3. o Conselho Fiscal dá o parecer — ou devolve para correção;
--       4. a presidência registra a decisão da assembleia (aprovado; reprovado volta à tesouraria);
--     com o exercício fechado, nenhum lançamento dele muda (até ser devolvido);
--   * orçamento e plano anual de trabalho (Art. 15, I), com o registro da aprovação em assembleia.
-- Nada se apaga; tudo vai para a auditoria.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. O Conselho Fiscal lê o financeiro (e os cadastros que ele mostra)
-- ---------------------------------------------------------------------
alter policy "pessoas: ver o próprio cadastro ou ser da diretoria" on public.pessoas
  using (
    usuario_id = (select auth.uid())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "associados: ver o próprio ou ser da diretoria" on public.associados
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "títulos da pessoa: ver os próprios ou ser da diretoria" on public.titulos_pessoa
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "vínculos: ver os próprios ou ser da diretoria" on public.vinculos_igreja
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "planos: ver o próprio ou ser da tesouraria/presidência" on public.planos_contribuicao
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "cobranças: ver as próprias ou ser da secretaria/tesouraria/presidência" on public.cobrancas
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "informes: ver os próprios ou ser da tesouraria/presidência" on public.informes_pagamento
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal'))
  );
alter policy "contas: tesouraria e presidência leem" on public.contas_financeiras
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
alter policy "categorias financeiras: tesouraria e presidência leem" on public.categorias_financeiras
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
alter policy "lançamentos: tesouraria e presidência leem" on public.lancamentos
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));

-- Arquivos: o Conselho Fiscal vê só os comprovantes de pagamento (não as fotos e documentos dos pedidos)
drop policy "documentos: ver os próprios ou ser da secretaria/tesouraria/presidência" on storage.objects;
create policy "documentos: ver os próprios, ser da diretoria ou comprovante para o Conselho Fiscal"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
      or (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia'))
      or (name like 'pessoas/%/pagamento-%' and (select interno.tenho_perfil('conselho_fiscal')))
    )
  );


-- ---------------------------------------------------------------------
-- 2. Resumo do exercício (abril a março)
-- ---------------------------------------------------------------------
create function interno.resumo_exercicio(p_exercicio integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inicio date := make_date(p_exercicio, 4, 1);
  v_fim    date := make_date(p_exercicio + 1, 3, 31);
  v_contas jsonb;
  v_entradas jsonb;
  v_saidas jsonb;
  v_transferido numeric;
  v_contribuicoes jsonb;
  v_aguardando jsonb;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')) then
    raise exception 'Só a tesouraria, a presidência e o Conselho Fiscal veem o resumo financeiro.' using errcode = '42501';
  end if;

  -- Por conta: saldo no início do exercício, abertura (conta criada no meio), entradas, saídas e saldo no fim
  with mov as (
    select l.conta_id, l.tipo, l.valor, l.data
    from public.lancamentos l
    join public.contas_financeiras c on c.id = l.conta_id
    where l.situacao = 'efetivado' and l.arquivado_em is null and l.data >= c.saldo_inicial_em and l.data <= v_fim
  ),
  por_conta as (
    select
      c.nome, c.tipo,
      (case when c.saldo_inicial_em <= v_inicio then c.saldo_inicial else 0 end)
        + coalesce(sum(case when m.tipo = 'entrada' then m.valor else -m.valor end) filter (where m.data < v_inicio), 0)
        as saldo_inicial,
      case when c.saldo_inicial_em > v_inicio then c.saldo_inicial else 0 end as abertura,
      coalesce(sum(m.valor) filter (where m.tipo = 'entrada' and m.data >= v_inicio), 0) as entradas,
      coalesce(sum(m.valor) filter (where m.tipo = 'saida' and m.data >= v_inicio), 0) as saidas
    from public.contas_financeiras c
    left join mov m on m.conta_id = c.id
    where c.saldo_inicial_em <= v_fim
    group by c.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'nome', nome, 'tipo', tipo,
           'saldo_inicial', round(saldo_inicial, 2), 'abertura', round(abertura, 2),
           'entradas', round(entradas, 2), 'saidas', round(saidas, 2),
           'saldo_final', round(saldo_inicial + abertura + entradas - saidas, 2)
         ) order by tipo, nome), '[]'::jsonb)
  into v_contas
  from por_conta;

  -- Por categoria (sem as transferências entre contas, que não são receita nem despesa)
  with mov as (
    select l.tipo, l.valor, cat.nome as categoria, cat.sistema, cat.ordem
    from public.lancamentos l
    join public.contas_financeiras c on c.id = l.conta_id
    join public.categorias_financeiras cat on cat.id = l.categoria_id
    where l.situacao = 'efetivado' and l.arquivado_em is null and l.data >= c.saldo_inicial_em
      and l.data between v_inicio and v_fim
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'total', total) order by ordem, categoria)
              from (select categoria, min(ordem) as ordem, round(sum(valor), 2) as total from mov
                    where tipo = 'entrada' and coalesce(sistema, '') not like 'transferencia%' group by categoria) e), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('categoria', categoria, 'total', total) order by ordem, categoria)
              from (select categoria, min(ordem) as ordem, round(sum(valor), 2) as total from mov
                    where tipo = 'saida' and coalesce(sistema, '') not like 'transferencia%' group by categoria) s), '[]'::jsonb),
    coalesce((select round(sum(valor), 2) from mov where sistema = 'transferencia_saida'), 0)
  into v_entradas, v_saidas, v_transferido;

  select jsonb_build_object(
    'previsto',   coalesce(round(sum(valor), 2), 0),
    'recebido',   coalesce(round(sum(valor_pago) filter (where situacao = 'paga'), 2), 0),
    'em_aberto',  coalesce(round(sum(valor) filter (where situacao = 'aberta'), 2), 0),
    'vencido',    coalesce(round(sum(valor) filter (where situacao = 'aberta' and vencimento < least(current_date, v_fim + 1)), 2), 0)
  )
  into v_contribuicoes
  from public.cobrancas
  where exercicio = p_exercicio and situacao <> 'cancelada' and arquivado_em is null;

  select jsonb_build_object('quantidade', count(*), 'total', coalesce(round(sum(valor), 2), 0))
  into v_aguardando
  from public.lancamentos
  where situacao = 'aguardando_autorizacao' and arquivado_em is null and data between v_inicio and v_fim;

  return jsonb_build_object(
    'exercicio', p_exercicio,
    'inicio', v_inicio,
    'fim', v_fim,
    'encerrado', v_fim < current_date,
    'calculado_em', now(),
    'contas', v_contas,
    'entradas', v_entradas,
    'saidas', v_saidas,
    'total_entradas', (select coalesce(sum((e ->> 'total')::numeric), 0) from jsonb_array_elements(v_entradas) e),
    'total_saidas', (select coalesce(sum((s ->> 'total')::numeric), 0) from jsonb_array_elements(v_saidas) s),
    'transferencias', v_transferido,
    'contribuicoes', v_contribuicoes,
    'despesas_aguardando', v_aguardando
  );
end;
$$;

-- Contribuições do exercício por igreja (vínculo atual do associado)
create function interno.contribuicoes_por_igreja(p_exercicio integer)
returns table (igreja text, associados bigint, previsto numeric, recebido numeric, em_aberto numeric, vencido numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal')) then
    raise exception 'Sem permissão para ver as contribuições por igreja.' using errcode = '42501';
  end if;
  return query
  select
    coalesce(i.nome, 'Sem igreja informada'),
    count(distinct c.pessoa_id),
    coalesce(round(sum(c.valor), 2), 0),
    coalesce(round(sum(c.valor_pago) filter (where c.situacao = 'paga'), 2), 0),
    coalesce(round(sum(c.valor) filter (where c.situacao = 'aberta'), 2), 0),
    coalesce(round(sum(c.valor) filter (where c.situacao = 'aberta' and c.vencimento < current_date), 2), 0)
  from public.cobrancas c
  left join lateral (
    select v.igreja_id from public.vinculos_igreja v
    where v.pessoa_id = c.pessoa_id and v.fim is null and v.arquivado_em is null
    order by v.inicio desc nulls last, v.criado_em desc
    limit 1
  ) vi on true
  left join public.igrejas i on i.id = vi.igreja_id
  where c.exercicio = p_exercicio and c.situacao <> 'cancelada' and c.arquivado_em is null
  group by i.nome
  order by 6 desc, 1;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Balanço anual
-- ---------------------------------------------------------------------
create type public.situacao_balanco as enum (
  'analise_diretoria',     -- fechado pela tesouraria; a diretoria analisa
  'aguardando_parecer',    -- a diretoria analisou; o Conselho Fiscal dá o parecer
  'aguardando_assembleia', -- com parecer; a assembleia aprecia
  'aprovado',              -- aprovado pela assembleia (final)
  'devolvido'              -- voltou para a tesouraria corrigir (o exercício reabre)
);
create type public.tipo_parecer as enum ('favoravel', 'favoravel_com_ressalvas', 'desfavoravel');

create table public.balancos (
  id                    uuid primary key default gen_random_uuid(),
  exercicio             integer not null check (exercicio between 2000 and 2100),
  situacao              public.situacao_balanco not null default 'analise_diretoria',
  resumo                jsonb not null,
  nota_tesouraria       text,
  fechado_por           uuid references public.pessoas (id),
  fechado_em            timestamptz,
  analise_diretoria     text,
  analisado_por         uuid references public.pessoas (id),
  analisado_em          timestamptz,
  parecer               public.tipo_parecer,
  parecer_texto         text,
  parecer_por           uuid references public.pessoas (id),
  parecer_em            timestamptz,
  assembleia_data       date,
  assembleia_ata        text,
  aprovado_assembleia   boolean,
  assembleia_registrada_por uuid references public.pessoas (id),
  motivo_devolucao      text,
  arquivado_em          timestamptz,
  criado_por            uuid default auth.uid(),
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
comment on table public.balancos is 'Balanço anual (prestação de contas) de cada exercício. O resumo fica congelado quando a tesouraria fecha.';
create unique index balancos_exercicio on public.balancos (exercicio) where arquivado_em is null;
create index balancos_fechado_por on public.balancos (fechado_por);
create index balancos_analisado_por on public.balancos (analisado_por);
create index balancos_parecer_por on public.balancos (parecer_por);
create index balancos_assembleia_registrada_por on public.balancos (assembleia_registrada_por);
select interno.aplicar_padroes('public.balancos');

create table public.balanco_eventos (
  id            uuid primary key default gen_random_uuid(),
  balanco_id    uuid not null references public.balancos (id),
  acao          text not null,
  texto         text,
  pessoa_id     uuid references public.pessoas (id),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.balanco_eventos is 'Histórico de cada balanço: quem fez cada passo, quando e o que escreveu.';
create index balanco_eventos_balanco on public.balanco_eventos (balanco_id, criado_em);
create index balanco_eventos_pessoa on public.balanco_eventos (pessoa_id);
select interno.aplicar_padroes('public.balanco_eventos');

create function interno.evento_balanco(p_balanco_id uuid, p_acao text, p_texto text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.balanco_eventos (balanco_id, acao, texto, pessoa_id)
  values (p_balanco_id, p_acao, nullif(trim(p_texto), ''), (select interno.minha_pessoa_id()));
$$;

-- 3.1 A tesouraria fecha o exercício e envia à diretoria
create function interno.fechar_balanco(p_exercicio integer, p_nota text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
  v_resumo jsonb;
  v_id uuid;
  v_existe boolean;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria (ou a presidência) fecha o exercício.' using errcode = '42501';
  end if;
  if make_date(p_exercicio + 1, 3, 31) >= current_date then
    raise exception 'O exercício %/% ainda não terminou (vai até 31/03/%).', p_exercicio, p_exercicio + 1, p_exercicio + 1
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.lancamentos
    where situacao = 'aguardando_autorizacao' and arquivado_em is null
      and data between make_date(p_exercicio, 4, 1) and make_date(p_exercicio + 1, 3, 31)
  ) then
    raise exception 'Há despesas deste exercício aguardando a autorização do presidente. Resolva antes de fechar.'
      using errcode = 'P0001';
  end if;

  select * into v_balanco from public.balancos where exercicio = p_exercicio and arquivado_em is null for update;
  v_existe := found;
  if v_existe and v_balanco.situacao <> 'devolvido' then
    raise exception 'O balanço de %/% já foi fechado e está em andamento.', p_exercicio, p_exercicio + 1 using errcode = 'P0001';
  end if;

  v_resumo := interno.resumo_exercicio(p_exercicio);
  if v_existe then
    update public.balancos
    set situacao = 'analise_diretoria', resumo = v_resumo, nota_tesouraria = nullif(trim(p_nota), ''),
        fechado_por = (select interno.minha_pessoa_id()), fechado_em = now(),
        analise_diretoria = null, analisado_por = null, analisado_em = null,
        parecer = null, parecer_texto = null, parecer_por = null, parecer_em = null,
        assembleia_data = null, assembleia_ata = null, aprovado_assembleia = null, assembleia_registrada_por = null,
        motivo_devolucao = null
    where id = v_balanco.id;
    v_id := v_balanco.id;
    perform interno.evento_balanco(v_id, 'Refeito pela tesouraria e reenviado à diretoria', p_nota);
  else
    insert into public.balancos (exercicio, resumo, nota_tesouraria, fechado_por, fechado_em)
    values (p_exercicio, v_resumo, nullif(trim(p_nota), ''), (select interno.minha_pessoa_id()), now())
    returning id into v_id;
    perform interno.evento_balanco(v_id, 'Fechado pela tesouraria e enviado à diretoria', p_nota);
  end if;
  return v_id;
end;
$$;

-- 3.2 A diretoria (presidência) registra a análise
create function interno.analisar_balanco(p_balanco_id uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Quem registra a análise da diretoria é a presidência.' using errcode = '42501';
  end if;
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null for update;
  if not found or v_balanco.situacao <> 'analise_diretoria' then
    raise exception 'Este balanço não está na análise da diretoria.' using errcode = 'P0001';
  end if;
  if v_balanco.fechado_por = (select interno.minha_pessoa_id()) then
    raise exception 'Quem fechou o balanço não registra a análise da diretoria.' using errcode = '42501';
  end if;
  if coalesce(trim(p_texto), '') = '' then
    raise exception 'Escreva a análise da diretoria.' using errcode = 'P0001';
  end if;
  update public.balancos
  set situacao = 'aguardando_parecer', analise_diretoria = trim(p_texto),
      analisado_por = (select interno.minha_pessoa_id()), analisado_em = now()
  where id = p_balanco_id;
  perform interno.evento_balanco(p_balanco_id, 'Analisado pela diretoria', p_texto);
end;
$$;

-- 3.3 O Conselho Fiscal dá o parecer
create function interno.parecer_balanco(p_balanco_id uuid, p_parecer public.tipo_parecer, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
begin
  if not (select interno.tenho_perfil('conselho_fiscal')) then
    raise exception 'Só o Conselho Fiscal dá o parecer sobre as contas (Art. 14).' using errcode = '42501';
  end if;
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null for update;
  if not found or v_balanco.situacao <> 'aguardando_parecer' then
    raise exception 'Este balanço não está aguardando o parecer do Conselho Fiscal.' using errcode = 'P0001';
  end if;
  if v_balanco.fechado_por = (select interno.minha_pessoa_id()) then
    raise exception 'Quem fechou o balanço não dá o parecer sobre ele.' using errcode = '42501';
  end if;
  if p_parecer is null or coalesce(trim(p_texto), '') = '' then
    raise exception 'Escolha o parecer e escreva o texto.' using errcode = 'P0001';
  end if;
  update public.balancos
  set situacao = 'aguardando_assembleia', parecer = p_parecer, parecer_texto = trim(p_texto),
      parecer_por = (select interno.minha_pessoa_id()), parecer_em = now()
  where id = p_balanco_id;
  perform interno.evento_balanco(p_balanco_id,
    'Parecer do Conselho Fiscal: ' || case p_parecer when 'favoravel' then 'favorável'
                                                     when 'favoravel_com_ressalvas' then 'favorável com ressalvas'
                                                     else 'desfavorável' end,
    p_texto);
end;
$$;

-- 3.4 Devolver para a tesouraria corrigir (diretoria, na análise; Conselho Fiscal, no parecer)
create function interno.devolver_balanco(p_balanco_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
begin
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null for update;
  if not found then
    raise exception 'Balanço não encontrado.' using errcode = 'P0001';
  end if;
  if not (
    (v_balanco.situacao = 'analise_diretoria' and (select interno.tenho_perfil('presidencia')))
    or (v_balanco.situacao = 'aguardando_parecer' and (select interno.tenho_perfil('conselho_fiscal')))
  ) then
    raise exception 'Neste passo, só quem analisa o balanço pode devolvê-lo.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o que precisa ser corrigido.' using errcode = 'P0001';
  end if;
  update public.balancos set situacao = 'devolvido', motivo_devolucao = trim(p_motivo) where id = p_balanco_id;
  perform interno.evento_balanco(p_balanco_id,
    case v_balanco.situacao when 'analise_diretoria' then 'Devolvido pela diretoria para correção'
                            else 'Devolvido pelo Conselho Fiscal para correção' end,
    p_motivo);
end;
$$;

-- 3.5 A presidência registra a decisão da assembleia
create function interno.assembleia_balanco(p_balanco_id uuid, p_aprovado boolean, p_data date, p_ata text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balanco public.balancos;
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Quem registra a decisão da assembleia é a presidência.' using errcode = '42501';
  end if;
  select * into v_balanco from public.balancos where id = p_balanco_id and arquivado_em is null for update;
  if not found or v_balanco.situacao <> 'aguardando_assembleia' then
    raise exception 'Este balanço não está aguardando a assembleia.' using errcode = 'P0001';
  end if;
  if p_aprovado is null or p_data is null or p_data > current_date or coalesce(trim(p_ata), '') = '' then
    raise exception 'Informe a decisão, a data da assembleia (não futura) e a ata.' using errcode = 'P0001';
  end if;
  update public.balancos
  set situacao = case when p_aprovado then 'aprovado'::public.situacao_balanco else 'devolvido' end,
      assembleia_data = p_data, assembleia_ata = trim(p_ata), aprovado_assembleia = p_aprovado,
      assembleia_registrada_por = (select interno.minha_pessoa_id()),
      motivo_devolucao = case when p_aprovado then null
                              else 'Reprovado pela assembleia de ' || to_char(p_data, 'DD/MM/YYYY') || ' (' || trim(p_ata) || ').' end
  where id = p_balanco_id;
  perform interno.evento_balanco(p_balanco_id,
    case when p_aprovado then 'Aprovado pela assembleia de ' else 'Reprovado pela assembleia de ' end || to_char(p_data, 'DD/MM/YYYY'),
    p_ata);
end;
$$;

-- 3.6 Com o balanço fechado, os lançamentos do exercício não mudam
create function interno.bloquear_exercicio_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercicio integer;
begin
  select b.exercicio into v_exercicio
  from public.balancos b
  where b.arquivado_em is null and b.situacao <> 'devolvido'
    and b.exercicio in (
      interno.exercicio_de(new.data),
      case when tg_op = 'UPDATE' then interno.exercicio_de(old.data) end
    )
  limit 1;
  if found then
    raise exception 'O exercício %/% está fechado para a prestação de contas: os lançamentos dele não mudam mais.',
      v_exercicio, v_exercicio + 1 using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger bloquear_exercicio_fechado
  before insert or update on public.lancamentos
  for each row execute function interno.bloquear_exercicio_fechado();


-- ---------------------------------------------------------------------
-- 4. Orçamento e plano anual de trabalho (Art. 15, I)
-- ---------------------------------------------------------------------
create table public.orcamentos (
  id                      uuid primary key default gen_random_uuid(),
  exercicio               integer not null check (exercicio between 2000 and 2100),
  plano_trabalho          text,
  aprovado_em_assembleia  date,
  ata                     text,
  aprovacao_registrada_por uuid references public.pessoas (id),
  arquivado_em            timestamptz,
  criado_por              uuid default auth.uid(),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
comment on table public.orcamentos is 'Orçamento e plano anual de trabalho de cada exercício (Art. 15, I). Aprovado em assembleia, não muda mais.';
create unique index orcamentos_exercicio on public.orcamentos (exercicio) where arquivado_em is null;
create index orcamentos_aprovacao_registrada_por on public.orcamentos (aprovacao_registrada_por);
select interno.aplicar_padroes('public.orcamentos');

create table public.orcamento_itens (
  id            uuid primary key default gen_random_uuid(),
  orcamento_id  uuid not null references public.orcamentos (id),
  categoria_id  uuid not null references public.categorias_financeiras (id),
  valor         numeric(12, 2) not null check (valor >= 0),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.orcamento_itens is 'Valor previsto por categoria no orçamento do exercício.';
create unique index orcamento_itens_unico on public.orcamento_itens (orcamento_id, categoria_id) where arquivado_em is null;
create index orcamento_itens_categoria on public.orcamento_itens (categoria_id);
select interno.aplicar_padroes('public.orcamento_itens');

-- Salva o orçamento inteiro de uma vez: plano de trabalho + [{categoria_id, valor}]
create function interno.salvar_orcamento(p_exercicio integer, p_plano text, p_itens jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos;
  v_item jsonb;
  v_categoria uuid;
  v_valor numeric;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência preparam o orçamento.' using errcode = '42501';
  end if;
  if p_exercicio is null or p_exercicio not between 2000 and 2100 then
    raise exception 'Exercício inválido.' using errcode = 'P0001';
  end if;
  select * into v_orcamento from public.orcamentos where exercicio = p_exercicio and arquivado_em is null for update;
  if found and v_orcamento.aprovado_em_assembleia is not null then
    raise exception 'O orçamento de %/% já foi aprovado em assembleia e não muda mais.', p_exercicio, p_exercicio + 1
      using errcode = 'P0001';
  end if;
  if not found then
    insert into public.orcamentos (exercicio, plano_trabalho) values (p_exercicio, nullif(trim(p_plano), ''))
    returning * into v_orcamento;
  else
    update public.orcamentos set plano_trabalho = nullif(trim(p_plano), '') where id = v_orcamento.id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_categoria := (v_item ->> 'categoria_id')::uuid;
    v_valor := coalesce((v_item ->> 'valor')::numeric, 0);
    if v_valor < 0 then
      raise exception 'O valor previsto não pode ser negativo.' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.categorias_financeiras
      where id = v_categoria and coalesce(sistema, '') not like 'transferencia%'
    ) then
      raise exception 'Categoria inválida para o orçamento.' using errcode = 'P0001';
    end if;
    update public.orcamento_itens set valor = v_valor
    where orcamento_id = v_orcamento.id and categoria_id = v_categoria and arquivado_em is null;
    if not found then
      insert into public.orcamento_itens (orcamento_id, categoria_id, valor) values (v_orcamento.id, v_categoria, v_valor);
    end if;
  end loop;
  return v_orcamento.id;
end;
$$;

create function interno.aprovar_orcamento(p_exercicio integer, p_data date, p_ata text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Quem registra a aprovação da assembleia é a presidência.' using errcode = '42501';
  end if;
  if p_data is null or p_data > current_date or coalesce(trim(p_ata), '') = '' then
    raise exception 'Informe a data da assembleia (não futura) e a ata.' using errcode = 'P0001';
  end if;
  update public.orcamentos
  set aprovado_em_assembleia = p_data, ata = trim(p_ata), aprovacao_registrada_por = (select interno.minha_pessoa_id())
  where exercicio = p_exercicio and arquivado_em is null and aprovado_em_assembleia is null;
  if not found then
    raise exception 'Não há orçamento em preparo para %/%.', p_exercicio, p_exercicio + 1 using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Funções pela API (finas; quem confere é a função interna)
-- ---------------------------------------------------------------------
create function public.resumo_exercicio(p_exercicio integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select interno.resumo_exercicio(p_exercicio);
$$;
create function public.contribuicoes_por_igreja(p_exercicio integer)
returns table (igreja text, associados bigint, previsto numeric, recebido numeric, em_aberto numeric, vencido numeric)
language sql stable security invoker set search_path = '' as $$
  select * from interno.contribuicoes_por_igreja(p_exercicio);
$$;
create function public.fechar_balanco(p_exercicio integer, p_nota text)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.fechar_balanco(p_exercicio, p_nota);
$$;
create function public.analisar_balanco(p_balanco_id uuid, p_texto text)
returns void language sql security invoker set search_path = '' as $$
  select interno.analisar_balanco(p_balanco_id, p_texto);
$$;
create function public.parecer_balanco(p_balanco_id uuid, p_parecer public.tipo_parecer, p_texto text)
returns void language sql security invoker set search_path = '' as $$
  select interno.parecer_balanco(p_balanco_id, p_parecer, p_texto);
$$;
create function public.devolver_balanco(p_balanco_id uuid, p_motivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.devolver_balanco(p_balanco_id, p_motivo);
$$;
create function public.assembleia_balanco(p_balanco_id uuid, p_aprovado boolean, p_data date, p_ata text)
returns void language sql security invoker set search_path = '' as $$
  select interno.assembleia_balanco(p_balanco_id, p_aprovado, p_data, p_ata);
$$;
create function public.salvar_orcamento(p_exercicio integer, p_plano text, p_itens jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.salvar_orcamento(p_exercicio, p_plano, p_itens);
$$;
create function public.aprovar_orcamento(p_exercicio integer, p_data date, p_ata text)
returns void language sql security invoker set search_path = '' as $$
  select interno.aprovar_orcamento(p_exercicio, p_data, p_ata);
$$;


-- ---------------------------------------------------------------------
-- 6. Permissões e regras de acesso
-- ---------------------------------------------------------------------
revoke all on function interno.resumo_exercicio(integer) from public;
revoke all on function interno.contribuicoes_por_igreja(integer) from public;
revoke all on function interno.evento_balanco(uuid, text, text) from public;
revoke all on function interno.fechar_balanco(integer, text) from public;
revoke all on function interno.analisar_balanco(uuid, text) from public;
revoke all on function interno.parecer_balanco(uuid, public.tipo_parecer, text) from public;
revoke all on function interno.devolver_balanco(uuid, text) from public;
revoke all on function interno.assembleia_balanco(uuid, boolean, date, text) from public;
revoke all on function interno.bloquear_exercicio_fechado() from public;
revoke all on function interno.salvar_orcamento(integer, text, jsonb) from public;
revoke all on function interno.aprovar_orcamento(integer, date, text) from public;
grant execute on function interno.resumo_exercicio(integer) to authenticated;
grant execute on function interno.contribuicoes_por_igreja(integer) to authenticated;
grant execute on function interno.fechar_balanco(integer, text) to authenticated;
grant execute on function interno.analisar_balanco(uuid, text) to authenticated;
grant execute on function interno.parecer_balanco(uuid, public.tipo_parecer, text) to authenticated;
grant execute on function interno.devolver_balanco(uuid, text) to authenticated;
grant execute on function interno.assembleia_balanco(uuid, boolean, date, text) to authenticated;
grant execute on function interno.salvar_orcamento(integer, text, jsonb) to authenticated;
grant execute on function interno.aprovar_orcamento(integer, date, text) to authenticated;

revoke all on function public.resumo_exercicio(integer) from public, anon;
revoke all on function public.contribuicoes_por_igreja(integer) from public, anon;
revoke all on function public.fechar_balanco(integer, text) from public, anon;
revoke all on function public.analisar_balanco(uuid, text) from public, anon;
revoke all on function public.parecer_balanco(uuid, public.tipo_parecer, text) from public, anon;
revoke all on function public.devolver_balanco(uuid, text) from public, anon;
revoke all on function public.assembleia_balanco(uuid, boolean, date, text) from public, anon;
revoke all on function public.salvar_orcamento(integer, text, jsonb) from public, anon;
revoke all on function public.aprovar_orcamento(integer, date, text) from public, anon;
grant execute on function public.resumo_exercicio(integer) to authenticated;
grant execute on function public.contribuicoes_por_igreja(integer) to authenticated;
grant execute on function public.fechar_balanco(integer, text) to authenticated;
grant execute on function public.analisar_balanco(uuid, text) to authenticated;
grant execute on function public.parecer_balanco(uuid, public.tipo_parecer, text) to authenticated;
grant execute on function public.devolver_balanco(uuid, text) to authenticated;
grant execute on function public.assembleia_balanco(uuid, boolean, date, text) to authenticated;
grant execute on function public.salvar_orcamento(integer, text, jsonb) to authenticated;
grant execute on function public.aprovar_orcamento(integer, date, text) to authenticated;

-- Tabelas: só leitura pela API; gravar, só pelas funções
revoke all on public.balancos, public.balanco_eventos, public.orcamentos, public.orcamento_itens from anon, authenticated;
grant select on public.balancos, public.balanco_eventos, public.orcamentos, public.orcamento_itens to authenticated;

alter table public.balancos        enable row level security;
alter table public.balanco_eventos enable row level security;
alter table public.orcamentos      enable row level security;
alter table public.orcamento_itens enable row level security;

create policy "balanços: tesouraria, presidência e Conselho Fiscal leem"
  on public.balancos for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
create policy "histórico dos balanços: tesouraria, presidência e Conselho Fiscal leem"
  on public.balanco_eventos for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
create policy "orçamentos: tesouraria, presidência e Conselho Fiscal leem"
  on public.orcamentos for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
create policy "itens do orçamento: tesouraria, presidência e Conselho Fiscal leem"
  on public.orcamento_itens for select to authenticated
  using ((select interno.tenho_perfil('tesouraria', 'presidencia', 'conselho_fiscal')));
