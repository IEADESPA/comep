-- =====================================================================
-- Taxa de inscrição (PROJETO.md, pergunta 17) — decisão de 12/11/2026:
--   * hoje é ISENTA (R$ 0,00);
--   * a assembleia pode definir um valor no futuro (Configurações → Taxa de inscrição);
--   * quando houver valor, é cobrada UMA vez de quem é admitido pela assembleia
--     (pedido aprovado), com vencimento N dias depois da admissão (padrão: 30).
--     Quem entrou no cadastro inicial não paga; jubilado é isento.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Valor de hoje: isenta (as três categorias)
-- ---------------------------------------------------------------------
insert into public.valores_contribuicao (categoria, tipo, valor, vigente_desde, observacao) values
  ('presidente_igreja', 'inscricao', 0.00, '2026-04-01', 'Isenta (decisão de 12/11/2026). A assembleia pode definir um valor.'),
  ('nao_presidente',    'inscricao', 0.00, '2026-04-01', 'Isenta (decisão de 12/11/2026). A assembleia pode definir um valor.'),
  ('jubilado',          'inscricao', 0.00, '2026-04-01', 'Jubilado é isento.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Prazo para pagar (dias depois da admissão)
-- ---------------------------------------------------------------------
alter table public.config_financeiro
  add column prazo_taxa_inscricao integer not null default 30 check (prazo_taxa_inscricao between 1 and 365);
comment on column public.config_financeiro.prazo_taxa_inscricao is
  'Dias depois da admissão para pagar a taxa de inscrição (quando ela tiver valor).';
grant update (prazo_taxa_inscricao) on public.config_financeiro to authenticated;

-- ---------------------------------------------------------------------
-- 3. Cobrança da taxa na admissão pela assembleia
-- ---------------------------------------------------------------------
create function interno.gerar_taxa_inscricao(p_pessoa_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assoc record;
  v_valor numeric;
  v_prazo integer;
begin
  select a.pessoa_id, a.admitido_em, a.forma_admissao, a.jubilado, v.categoria_contribuicao
  into v_assoc
  from public.associados a
  join public.vw_associados v on v.id = a.id
  where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
  if not found or v_assoc.jubilado or v_assoc.forma_admissao <> 'assembleia' or v_assoc.admitido_em is null then
    return 0;
  end if;
  if exists (
    select 1 from public.cobrancas
    where pessoa_id = p_pessoa_id and tipo = 'inscricao' and situacao <> 'cancelada' and arquivado_em is null
  ) then
    return 0; -- já tem (uma vez só)
  end if;
  v_valor := interno.valor_vigente(v_assoc.categoria_contribuicao, 'inscricao', v_assoc.admitido_em);
  if coalesce(v_valor, 0) <= 0 then
    return 0; -- isenta
  end if;
  select prazo_taxa_inscricao into v_prazo from public.config_financeiro where id;

  insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
  values (p_pessoa_id, interno.exercicio_de(v_assoc.admitido_em), 'inscricao', v_assoc.admitido_em,
          v_assoc.admitido_em + coalesce(v_prazo, 30), v_assoc.categoria_contribuicao, v_valor);
  return 1;
end;
$$;

create function interno.taxa_inscricao_na_admissao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.forma_admissao = 'assembleia' then
    perform interno.gerar_taxa_inscricao(new.pessoa_id);
  end if;
  return null;
end;
$$;

create trigger taxa_inscricao_na_admissao
  after insert on public.associados
  for each row execute function interno.taxa_inscricao_na_admissao();

revoke all on function interno.gerar_taxa_inscricao(uuid) from public;
revoke all on function interno.taxa_inscricao_na_admissao() from public;

-- ---------------------------------------------------------------------
-- 4. Definir a taxa (tesouraria e presidência; vale para presidente e não presidente)
-- ---------------------------------------------------------------------
create function public.definir_taxa_inscricao(
  p_valor         numeric,
  p_vigente_desde date,
  p_assembleia    date,
  p_ata           text,
  p_prazo_dias    integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência definem a taxa de inscrição.' using errcode = '42501';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'Informe o valor (0 = isenta).' using errcode = 'P0001';
  end if;
  insert into public.valores_contribuicao (categoria, tipo, valor, vigente_desde, aprovado_em_assembleia, ata, observacao)
  select c, 'inscricao', p_valor, p_vigente_desde, p_assembleia, nullif(trim(p_ata), ''),
         case when p_valor = 0 then 'Isenta.' end
  from unnest(array['presidente_igreja', 'nao_presidente']::public.categoria_contribuicao[]) c;
  update public.config_financeiro set prazo_taxa_inscricao = p_prazo_dias where id;
end;
$$;
revoke all on function public.definir_taxa_inscricao(numeric, date, date, text, integer) from public, anon;
grant execute on function public.definir_taxa_inscricao(numeric, date, date, text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5. O plano (mensal/anual) não mexe na taxa de inscrição
-- ---------------------------------------------------------------------
create or replace function interno.escolher_plano(p_pessoa_id uuid, p_exercicio integer, p_tipo public.tipo_valor)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo not in ('mensal', 'anual') then
    raise exception 'Escolha mensal ou anual.' using errcode = 'P0001';
  end if;
  if not (p_pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('tesouraria', 'presidencia'))) then
    raise exception 'Só o próprio associado ou a tesouraria escolhem o plano.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.associados where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo'
  ) then
    raise exception 'Só associado ativo tem plano de contribuição.' using errcode = 'P0001';
  end if;
  if p_tipo = 'anual' and exists (
    select 1 from public.associados
    where pessoa_id = p_pessoa_id and arquivado_em is null and situacao = 'ativo'
      and admitido_em >= make_date(p_exercicio, 5, 1)
  ) then
    raise exception 'Quem foi admitido depois de abril paga por mês neste exercício (a anuidade vence em abril).' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.cobrancas
    where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo in ('mensal', 'anual')
      and situacao = 'paga' and arquivado_em is null
  ) or exists (
    select 1 from public.informes_pagamento i join public.cobrancas c on c.id = i.cobranca_id
    where c.pessoa_id = p_pessoa_id and c.exercicio = p_exercicio and c.tipo in ('mensal', 'anual')
      and i.situacao = 'pendente'
  ) then
    raise exception 'Já há pagamento neste exercício: o plano não muda mais até março. Fale com a tesouraria.' using errcode = 'P0001';
  end if;

  update public.planos_contribuicao set arquivado_em = now()
  where pessoa_id = p_pessoa_id and exercicio = p_exercicio and arquivado_em is null;
  insert into public.planos_contribuicao (pessoa_id, exercicio, tipo) values (p_pessoa_id, p_exercicio, p_tipo);

  -- Cobranças em aberto do outro plano saem; as do plano novo entram (se o exercício já foi gerado)
  if exists (
    select 1 from public.cobrancas where pessoa_id = p_pessoa_id and exercicio = p_exercicio and tipo in ('mensal', 'anual')
  ) then
    update public.cobrancas
    set situacao = 'cancelada', observacao = 'Plano trocado para ' || p_tipo::text || '.'
    where pessoa_id = p_pessoa_id and exercicio = p_exercicio and situacao = 'aberta'
      and tipo in ('mensal', 'anual') and tipo <> p_tipo;
    perform interno.gerar_cobrancas_pessoa(p_pessoa_id, p_exercicio);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. No caixa, a descrição diz "taxa de inscrição"
-- ---------------------------------------------------------------------
create or replace function interno.contribuicao_no_caixa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.config_financeiro;
  v_nome text;
begin
  if new.situacao = 'paga' and old.situacao is distinct from 'paga' and coalesce(new.valor_pago, 0) > 0 then
    select * into v_config from public.config_financeiro where id;
    select nome into v_nome from public.pessoas where id = new.pessoa_id;
    insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, cobranca_id, situacao, criado_por)
    values (
      case when new.forma_pagamento ilike 'dinheiro%' then v_config.conta_dinheiro_id else v_config.conta_banco_id end,
      'entrada',
      (select id from public.categorias_financeiras where sistema = 'contribuicoes'),
      new.pago_em,
      new.valor_pago,
      'Contribuição de ' || v_nome || ' — ' ||
        case new.tipo
          when 'anual' then 'anuidade ' || new.exercicio || '/' || (new.exercicio + 1)
          when 'inscricao' then 'taxa de inscrição'
          else 'mensalidade ' || to_char(new.competencia, 'MM/YYYY')
        end,
      new.id,
      'efetivado',
      auth.uid()
    )
    on conflict do nothing;
  end if;
  return null;
end;
$$;
