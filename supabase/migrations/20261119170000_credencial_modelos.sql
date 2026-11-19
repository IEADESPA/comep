-- =====================================================================
-- FASE 5.5 — TELAS NOVAS, PARTE 7: OS MODELOS DA CREDENCIAL (versão 5.5.0-teste.11)
--
-- Regras aprovadas pelo usuário (rodadas 7 a 12, 18/11/2026; PROJETO.md, seção 4.5):
--   * VÁRIOS MODELOS de credencial, um por grupo (diretoria, pastor presidente, 10 anos de COMEP, pentecostais…).
--     Cada modelo tem nome, ORDEM (prioridade) e a regra de QUEM RECEBE; o desenho continua em VERSÕES que não
--     mudam nem se apagam (modelos_credencial). Vence o primeiro modelo da ordem que serve à pessoa; sem nenhum,
--     fica o modelo PADRÃO;
--   * quem recebe: condições da pessoa (cargo na diretoria, título, tempo de COMEP, pastor presidente, jubilado,
--     comissão, forma de admissão), da igreja (igreja, denominação, tradição) e do tempo (entre duas datas, durante
--     o mandato), exigindo TODAS ou QUALQUER UMA;
--   * MODELO EXCLUSIVO de uma igreja: a igreja paga à parte (exemplo do usuário: R$ 300,00) para os ministros dela
--     terem um modelo com as cores dela. Guarda o valor, quem pediu e o pagamento (com a entrada do caixa, se houver);
--     só vale depois de pago;
--   * o MINISTRO EM READEQUAÇÃO (o da igreja sem registro) recebe SEMPRE o modelo de readequação, de categoria mais
--     baixa, com a faixa de aviso e o prazo (a AGO de 28/04/2027); a conferência pelo QR também mostra;
--   * o tamanho do cartão (mm) fica dentro do desenho (JSON), com o padrão de cartão de crédito (85,6 × 54 mm).
--
-- NÃO QUEBRA o que existe: o modelo em uso hoje (config_credencial.modelo_id) vira o desenho do modelo PADRÃO;
-- as funções antigas (salvar_modelo_credencial, usar_modelo_credencial…) passam a mexer no modelo padrão; os dados
-- da credencial continuam trazendo "modelo" (o do padrão) e a validação pública (validar_credencial) só ganha campos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. O prazo da readequação (só a presidência muda, como as outras regras da regularização)
-- ---------------------------------------------------------------------
alter table public.config_igrejas add column readequacao_ate date not null default '2027-04-28';
comment on column public.config_igrejas.readequacao_ate is
  'Prazo da readequação dos ministros das igrejas sem registro (a AGO de abril de 2027): vai na credencial e na conferência pelo QR.';
grant update (readequacao_ate) on public.config_igrejas to authenticated;


-- ---------------------------------------------------------------------
-- 2. Os modelos (um por grupo) e o elo das versões com o modelo
-- ---------------------------------------------------------------------
create table public.credencial_modelos (
  id                      uuid primary key default gen_random_uuid(),
  nome                    text not null,
  descricao               text,
  tipo                    text not null check (tipo in ('padrao', 'grupo', 'exclusivo', 'readequacao')),
  prioridade              integer not null default 1 check (prioridade between 1 and 100000),
  regra                   jsonb not null default '{"modo": "todas", "condicoes": []}'::jsonb,
  versao_id               uuid references public.modelos_credencial (id),
  em_uso                  boolean not null default false,
  exclusivo_igreja_id     uuid references public.igrejas (id),
  exclusivo_valor         numeric(12, 2),
  exclusivo_pedido_por    uuid references public.pessoas (id),
  exclusivo_pago_em       date,
  exclusivo_lancamento_id uuid references public.lancamentos (id),
  arquivado_em            timestamptz,
  criado_por              uuid default auth.uid(),
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  constraint credencial_modelos_nome check (length(trim(nome)) between 2 and 60),
  constraint credencial_modelos_descricao check (descricao is null or length(descricao) <= 200),
  -- coalesce: parte que falta dá falso, e não "vazio" (que passaria na regra)
  constraint credencial_modelos_regra check (coalesce(
    jsonb_typeof(regra) = 'object'
    and regra ->> 'modo' in ('todas', 'qualquer')
    and jsonb_typeof(regra -> 'condicoes') = 'array'
    and jsonb_array_length(regra -> 'condicoes') <= 12
    and octet_length(regra::text) <= 20000,
    false
  )),
  constraint credencial_modelos_exclusivo check (coalesce(
    (tipo = 'exclusivo') = (exclusivo_igreja_id is not null)
    and (tipo <> 'exclusivo' or exclusivo_valor > 0)
    and (tipo = 'exclusivo' or (exclusivo_valor is null and exclusivo_pedido_por is null
                                and exclusivo_pago_em is null and exclusivo_lancamento_id is null))
    and (exclusivo_lancamento_id is null or exclusivo_pago_em is not null),
    false
  )),
  -- o padrão e o de readequação estão sempre em uso (o desenho vazio = o do sistema)
  constraint credencial_modelos_sempre_em_uso check (tipo in ('grupo', 'exclusivo') or em_uso),
  constraint credencial_modelos_em_uso_com_desenho check (not em_uso or tipo in ('padrao', 'readequacao') or versao_id is not null)
);
comment on table public.credencial_modelos is
  'Os modelos da credencial, um por grupo (Fase 5.5): nome, ordem, quem recebe e o desenho em uso (versão). '
  'Vence o primeiro da ordem que serve à pessoa; sem nenhum, o padrão. O ministro em readequação recebe sempre o de readequação.';
comment on column public.credencial_modelos.prioridade is 'A ordem: 1 é o primeiro. Só conta nos modelos de grupo e exclusivos.';
comment on column public.credencial_modelos.regra is
  'Quem recebe: {"modo": "todas"|"qualquer", "condicoes": [{"tipo": …, …}]} (interno.normalizar_regra confere).';
comment on column public.credencial_modelos.versao_id is 'A versão do desenho em uso. Vazio no padrão e na readequação = o desenho do sistema.';
comment on column public.credencial_modelos.em_uso is 'Rascunho (falso) não é escolhido para ninguém.';
comment on column public.credencial_modelos.exclusivo_valor is 'Modelo exclusivo: o valor que a igreja paga à parte (ex.: R$ 300,00).';
comment on column public.credencial_modelos.exclusivo_pago_em is 'Modelo exclusivo: só vale depois de pago.';
comment on column public.credencial_modelos.exclusivo_lancamento_id is 'Modelo exclusivo: a entrada do caixa do pagamento (opcional).';
select interno.aplicar_padroes('public.credencial_modelos');

create unique index credencial_modelos_um_de_cada on public.credencial_modelos (tipo)
  where tipo in ('padrao', 'readequacao') and arquivado_em is null;
create unique index credencial_modelos_nome_unico on public.credencial_modelos (lower(trim(nome))) where arquivado_em is null;
create unique index credencial_modelos_um_exclusivo on public.credencial_modelos (exclusivo_igreja_id)
  where tipo = 'exclusivo' and arquivado_em is null;
create index credencial_modelos_versao on public.credencial_modelos (versao_id);
create index credencial_modelos_pedido_por on public.credencial_modelos (exclusivo_pedido_por);
create index credencial_modelos_lancamento on public.credencial_modelos (exclusivo_lancamento_id);

-- Cada versão do desenho é de um modelo
alter table public.modelos_credencial add column modelo_id uuid references public.credencial_modelos (id);
comment on column public.modelos_credencial.modelo_id is 'O modelo a que esta versão do desenho pertence.';
create index modelos_credencial_modelo on public.modelos_credencial (modelo_id, criado_em desc);

-- O modelo em uso hoje vira o PADRÃO; a readequação nasce com o desenho do sistema
insert into public.credencial_modelos (nome, descricao, tipo, prioridade, em_uso)
values
  ('Ministro (padrão)', 'Todos os ministros associados que não se encaixam em nenhum modelo de cima.', 'padrao', 100000, true),
  ('Ministro em readequação', 'Os ministros das igrejas sem registro: categoria mais baixa, com o prazo da readequação.', 'readequacao', 100000, true);

-- as versões já salvas são do padrão (a versão salva não muda: o gatilho fica desligado só aqui)
alter table public.modelos_credencial disable trigger proteger_versao;
update public.modelos_credencial set modelo_id = (select id from public.credencial_modelos where tipo = 'padrao');
alter table public.modelos_credencial enable trigger proteger_versao;
alter table public.modelos_credencial alter column modelo_id set not null;

update public.credencial_modelos
set versao_id = (select modelo_id from public.config_credencial where id)
where tipo = 'padrao';

-- A versão salva continua sem mudar (agora também o modelo a que pertence)
create or replace function interno.proteger_versao_modelo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.modelo is distinct from old.modelo
     or new.descricao is distinct from old.descricao
     or new.modelo_id is distinct from old.modelo_id
     or new.criado_por is distinct from old.criado_por
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Versão salva do modelo não muda (só pode ser arquivada).' using errcode = 'P0001';
  end if;
  if old.arquivado_em is not null then
    raise exception 'Esta versão já está arquivada.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- O modelo: o tipo não muda; o desenho em uso é uma versão dele (não arquivada); o padrão e a readequação não se arquivam
create function interno.proteger_modelo_credencial()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.tipo is distinct from old.tipo then
      raise exception 'O tipo do modelo não muda: crie outro modelo.' using errcode = 'P0001';
    end if;
    if old.arquivado_em is not null then
      raise exception 'Este modelo já está arquivado.' using errcode = 'P0001';
    end if;
    if new.arquivado_em is not null and new.tipo in ('padrao', 'readequacao') then
      raise exception 'O modelo padrão e o da readequação não se arquivam.' using errcode = 'P0001';
    end if;
  end if;
  if new.versao_id is not null then
    if tg_op = 'UPDATE' then
      if new.versao_id is not distinct from old.versao_id then
        return new;
      end if;
    end if;
    if not exists (select 1 from public.modelos_credencial v
                   where v.id = new.versao_id and v.modelo_id = new.id and v.arquivado_em is null) then
      raise exception 'Esta versão do desenho não é deste modelo.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger proteger_modelo before insert or update on public.credencial_modelos
  for each row execute function interno.proteger_modelo_credencial();


-- ---------------------------------------------------------------------
-- 3. Quem é cada pessoa para a regra (o "contexto") e a escolha do modelo
-- ---------------------------------------------------------------------
-- O que as condições olham, de uma vez: cargos vigentes no dia, título, igreja (denominação, tradição, cadastro)…
-- null = não é associado ativo.
create function interno.contexto_credencial(p_pessoa_id uuid, p_dia date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pessoa_id', a.pessoa_id,
    'admitido_em', a.admitido_em,
    'forma_admissao', a.forma_admissao,
    'jubilado', a.jubilado,
    'titulo_id', (select tp.titulo_id from public.titulos_pessoa tp
                  where tp.pessoa_id = a.pessoa_id and tp.arquivado_em is null
                  order by tp.criado_em desc limit 1),
    'igreja_id', vi.igreja_id,
    'pastor_presidente', coalesce(vi.pastor_presidente, false),
    'denominacao_id', i.denominacao_id,
    'tradicao', d.tradicao,
    'igreja_cadastro', i.cadastro,
    'cargos', coalesce((select jsonb_agg(distinct m.cargo) from public.mandatos m
                        where m.pessoa_id = a.pessoa_id and m.arquivado_em is null
                          and m.inicio <= p_dia and interno.fim_efetivo(m) >= p_dia), '[]'::jsonb),
    'comissoes', coalesce((select jsonb_agg(distinct cm.comissao_id) from public.comissao_membros cm
                           join public.comissoes c on c.id = cm.comissao_id
                           where cm.pessoa_id = a.pessoa_id and cm.arquivado_em is null and c.arquivado_em is null
                             and cm.desde <= p_dia and (cm.ate is null or cm.ate >= p_dia)), '[]'::jsonb)
  )
  from public.associados a
  left join lateral (
    select v.igreja_id, v.pastor_presidente from public.vinculos_igreja v
    where v.pessoa_id = a.pessoa_id and v.fim is null and v.arquivado_em is null
    limit 1
  ) vi on true
  left join public.igrejas i on i.id = vi.igreja_id
  left join public.denominacoes d on d.id = i.denominacao_id
  where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo';
$$;

-- Uma condição da regra (já conferida por interno.normalizar_regra). Dado que falta = não atende.
create function interno.atende_condicao(p_ctx jsonb, p_cond jsonb, p_dia date)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_valores text[] := array(select jsonb_array_elements_text(coalesce(p_cond -> 'valores', '[]'::jsonb)));
begin
  return coalesce(case p_cond ->> 'tipo'
    when 'cargo' then (p_ctx -> 'cargos') ?| v_valores
    when 'titulo' then (p_ctx ->> 'titulo_id') = any (v_valores)
    when 'tempo' then (p_ctx ->> 'admitido_em')::date <= (p_dia - make_interval(years => (p_cond ->> 'anos')::integer))::date
    when 'pastor_presidente' then (p_ctx ->> 'pastor_presidente')::boolean
    when 'jubilado' then (p_ctx ->> 'jubilado')::boolean
    when 'comissao' then case when cardinality(v_valores) = 0 then jsonb_array_length(p_ctx -> 'comissoes') > 0
                              else (p_ctx -> 'comissoes') ?| v_valores end
    when 'admissao' then (p_ctx ->> 'forma_admissao') = any (v_valores)
    when 'igreja' then (p_ctx ->> 'igreja_id') = any (v_valores)
    when 'denominacao' then (p_ctx ->> 'denominacao_id') = any (v_valores)
    when 'tradicao' then (p_ctx ->> 'tradicao') = any (v_valores)
    when 'periodo' then p_dia between (p_cond ->> 'de')::date and (p_cond ->> 'ate')::date
    when 'mandato' then p_dia <= (p_cond ->> 'ate')::date
  end, false);
end;
$$;

-- A regra inteira: TODAS as condições ou QUALQUER UMA. Sem condição nenhuma, ninguém recebe.
create function interno.atende_regra(p_ctx jsonb, p_regra jsonb, p_dia date)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_qualquer boolean := (p_regra ->> 'modo') = 'qualquer';
  v_cond jsonb;
begin
  if p_ctx is null or jsonb_array_length(coalesce(p_regra -> 'condicoes', '[]'::jsonb)) = 0 then
    return false;
  end if;
  for v_cond in select * from jsonb_array_elements(p_regra -> 'condicoes') loop
    if interno.atende_condicao(p_ctx, v_cond, p_dia) then
      if v_qualquer then
        return true;
      end if;
    elsif not v_qualquer then
      return false;
    end if;
  end loop;
  return not v_qualquer;
end;
$$;

-- Os modelos que podem ser escolhidos, já na ordem (rascunho e arquivado ficam de fora)
create function interno.modelos_ativos()
returns public.credencial_modelos[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m order by m.prioridade, m.criado_em, m.id), '{}')
  from public.credencial_modelos m
  where m.arquivado_em is null and m.em_uso;
$$;

-- A escolha: o ministro em readequação recebe SEMPRE o de readequação; depois, o primeiro da ordem que serve
-- (o exclusivo só depois de pago e só para os ministros daquela igreja); sem nenhum, o padrão.
create function interno.escolher_modelo(p_ctx jsonb, p_modelos public.credencial_modelos[], p_dia date)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
  v_padrao uuid;
  v_readequacao uuid;
begin
  if p_ctx is null then
    return null;
  end if;
  foreach v_modelo in array p_modelos loop
    if v_modelo.tipo = 'padrao' then
      v_padrao := v_modelo.id;
    elsif v_modelo.tipo = 'readequacao' then
      v_readequacao := v_modelo.id;
    end if;
  end loop;
  if (p_ctx ->> 'igreja_cadastro') = 'sem_registro' then
    return v_readequacao;
  end if;
  foreach v_modelo in array p_modelos loop
    continue when v_modelo.tipo not in ('grupo', 'exclusivo');
    if v_modelo.tipo = 'exclusivo' then
      continue when v_modelo.exclusivo_pago_em is null
                 or v_modelo.exclusivo_igreja_id::text is distinct from (p_ctx ->> 'igreja_id');
      if jsonb_array_length(v_modelo.regra -> 'condicoes') = 0 then
        return v_modelo.id;
      end if;
    end if;
    if interno.atende_regra(p_ctx, v_modelo.regra, p_dia) then
      return v_modelo.id;
    end if;
  end loop;
  return v_padrao;
end;
$$;

-- O modelo da credencial de uma pessoa no dia (null = não é associado ativo)
create function interno.modelo_da_pessoa(p_pessoa_id uuid, p_dia date default current_date)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select interno.escolher_modelo(interno.contexto_credencial(p_pessoa_id, p_dia), interno.modelos_ativos(), p_dia);
$$;

-- O ministro em readequação: associado ativo cuja igreja é sem registro
create function interno.em_readequacao(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.associados a
    join public.vinculos_igreja v on v.pessoa_id = a.pessoa_id and v.fim is null and v.arquivado_em is null
    join public.igrejas i on i.id = v.igreja_id
    where a.pessoa_id = p_pessoa_id and a.arquivado_em is null and a.situacao = 'ativo' and i.cadastro = 'sem_registro'
  );
$$;

-- Todos os associados ativos e o modelo de cada um, com os modelos dados (a lista, a contagem e a simulação)
create function interno.modelos_dos_associados(p_modelos public.credencial_modelos[], p_dia date)
returns table (pessoa_id uuid, modelo_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
begin
  for v_pessoa in
    select a.pessoa_id from public.associados a where a.arquivado_em is null and a.situacao = 'ativo'
  loop
    pessoa_id := v_pessoa;
    modelo_id := interno.escolher_modelo(interno.contexto_credencial(v_pessoa, p_dia), p_modelos, p_dia);
    return next;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. A regra de quem recebe: conferida e arrumada antes de gravar
-- ---------------------------------------------------------------------
create function interno.data_da_regra(p_texto text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_texto is null or p_texto !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_texto::date;
exception when others then
  return null;
end;
$$;

create function interno.normalizar_regra(p_regra jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_condicoes jsonb := coalesce(p_regra -> 'condicoes', '[]'::jsonb);
  v_modo text := coalesce(p_regra ->> 'modo', 'todas');
  v_cond jsonb;
  v_tipo text;
  v_valores jsonb;
  v_valor text;
  v_vistos text[] := '{}';
  v_saida jsonb := '[]'::jsonb;
  v_anos integer;
  v_de date;
  v_ate date;
  v_existe boolean;
begin
  if p_regra is null or jsonb_typeof(p_regra) <> 'object' or jsonb_typeof(v_condicoes) <> 'array' then
    raise exception 'A regra de quem recebe veio num formato errado.' using errcode = 'P0001';
  end if;
  if v_modo not in ('todas', 'qualquer') then
    raise exception 'Escolha se a pessoa precisa atender a todas as condições ou a qualquer uma.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_condicoes) > 12 then
    raise exception 'São no máximo 12 condições por modelo.' using errcode = 'P0001';
  end if;
  for v_cond in select * from jsonb_array_elements(v_condicoes) loop
    v_tipo := case when jsonb_typeof(v_cond) = 'object' then v_cond ->> 'tipo' end;
    if v_tipo is null or v_tipo not in ('cargo', 'titulo', 'tempo', 'pastor_presidente', 'jubilado', 'comissao', 'admissao',
                                       'igreja', 'denominacao', 'tradicao', 'periodo', 'mandato') then
      raise exception 'Condição desconhecida na regra de quem recebe.' using errcode = 'P0001';
    end if;
    if v_tipo = any (v_vistos) then
      raise exception 'Uma condição aparece duas vezes: junte os valores numa só.' using errcode = 'P0001';
    end if;
    v_vistos := v_vistos || v_tipo;

    if v_tipo in ('cargo', 'titulo', 'comissao', 'admissao', 'igreja', 'denominacao', 'tradicao') then
      v_valores := coalesce(v_cond -> 'valores', '[]'::jsonb);
      if jsonb_typeof(v_valores) <> 'array' or jsonb_array_length(v_valores) > 100 then
        raise exception 'A lista de valores de uma condição veio num formato errado.' using errcode = 'P0001';
      end if;
      -- sem valor, só a comissão faz sentido ("membro de qualquer comissão")
      if jsonb_array_length(v_valores) = 0 and v_tipo <> 'comissao' then
        raise exception 'Escolha pelo menos um valor em cada condição.' using errcode = 'P0001';
      end if;
      for v_valor in select jsonb_array_elements_text(v_valores) loop
        if v_tipo = 'cargo' then
          v_existe := v_valor in (select unnest(enum_range(null::public.cargo))::text);
        elsif v_tipo = 'admissao' then
          v_existe := v_valor in (select unnest(enum_range(null::public.forma_admissao))::text);
        elsif v_tipo = 'tradicao' then
          v_existe := v_valor in ('pentecostal', 'neopentecostal', 'batista', 'reformada', 'metodista', 'luterana',
                                  'anglicana', 'adventista', 'congregacional', 'outra');
        elsif v_valor !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
          v_existe := false;
        elsif v_tipo = 'titulo' then
          v_existe := exists (select 1 from public.titulos_ministeriais t where t.id = v_valor::uuid);
        elsif v_tipo = 'comissao' then
          v_existe := exists (select 1 from public.comissoes c where c.id = v_valor::uuid);
        elsif v_tipo = 'igreja' then
          v_existe := exists (select 1 from public.igrejas i where i.id = v_valor::uuid);
        else
          v_existe := exists (select 1 from public.denominacoes d where d.id = v_valor::uuid);
        end if;
        if not coalesce(v_existe, false) then
          raise exception 'Um dos valores escolhidos numa condição não existe (atualize a página).' using errcode = 'P0001';
        end if;
      end loop;
      v_saida := v_saida || jsonb_build_array(jsonb_build_object(
        'tipo', v_tipo,
        'valores', (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements_text(v_valores) x)
      ));
    elsif v_tipo = 'tempo' then
      v_anos := case when jsonb_typeof(v_cond -> 'anos') = 'number' and (v_cond ->> 'anos') ~ '^\d{1,2}$'
                     then (v_cond ->> 'anos')::integer end;
      if v_anos is null or v_anos not between 1 and 80 then
        raise exception 'O tempo de COMEP vai de 1 a 80 anos.' using errcode = 'P0001';
      end if;
      v_saida := v_saida || jsonb_build_array(jsonb_build_object('tipo', v_tipo, 'anos', v_anos));
    elsif v_tipo in ('pastor_presidente', 'jubilado') then
      v_saida := v_saida || jsonb_build_array(jsonb_build_object('tipo', v_tipo));
    elsif v_tipo = 'periodo' then
      v_de := interno.data_da_regra(v_cond ->> 'de');
      v_ate := interno.data_da_regra(v_cond ->> 'ate');
      if v_de is null or v_ate is null or v_ate < v_de then
        raise exception 'Informe as duas datas do período (a segunda não pode ser antes da primeira).' using errcode = 'P0001';
      end if;
      v_saida := v_saida || jsonb_build_array(jsonb_build_object('tipo', v_tipo, 'de', v_de, 'ate', v_ate));
    else
      -- "só durante o mandato": guarda o fim do mandato da diretoria em curso (a posse seguinte não estica o modelo)
      v_ate := coalesce(interno.data_da_regra(v_cond ->> 'ate'), (select c.fim_mandato from public.config_credencial c where c.id));
      if v_ate is null then
        raise exception 'Informe antes o fim do mandato da diretoria (Credenciais › Validade e verso).' using errcode = 'P0001';
      end if;
      v_saida := v_saida || jsonb_build_array(jsonb_build_object('tipo', v_tipo, 'ate', v_ate));
    end if;
  end loop;
  return jsonb_build_object('modo', v_modo, 'condicoes', v_saida);
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Criar, mudar, ordenar, pôr em uso, duplicar e arquivar os modelos (secretaria e presidência)
-- ---------------------------------------------------------------------
create function interno.exigir_cuidar_dos_modelos()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam os modelos da credencial.' using errcode = '42501';
  end if;
end;
$$;

-- p_dados: nome, descricao, regra; na criação, tipo ('grupo' ou 'exclusivo'); no exclusivo, igreja_id, valor e pedido_por.
create function interno.salvar_modelo(p_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
  v_tipo text;
  v_nome text := trim(coalesce(p_dados ->> 'nome', ''));
  v_descricao text := nullif(trim(coalesce(p_dados ->> 'descricao', '')), '');
  v_regra jsonb;
  v_igreja uuid;
  v_valor numeric;
  v_pedido uuid;
  v_id uuid;
begin
  perform interno.exigir_cuidar_dos_modelos();
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados do modelo num formato errado.' using errcode = 'P0001';
  end if;
  if length(v_nome) not between 2 and 60 then
    raise exception 'Dê um nome ao modelo (de 2 a 60 letras).' using errcode = 'P0001';
  end if;
  if p_id is not null then
    select * into v_modelo from public.credencial_modelos where id = p_id and arquivado_em is null for update;
    if not found then
      raise exception 'Modelo não encontrado.' using errcode = 'P0001';
    end if;
    v_tipo := v_modelo.tipo;
  else
    v_tipo := coalesce(p_dados ->> 'tipo', 'grupo');
    if v_tipo not in ('grupo', 'exclusivo') then
      raise exception 'Só se criam modelos de grupo ou exclusivos de uma igreja.' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from public.credencial_modelos m
             where m.arquivado_em is null and lower(trim(m.nome)) = lower(v_nome) and m.id is distinct from p_id) then
    raise exception 'Já existe um modelo com este nome.' using errcode = 'P0001';
  end if;
  -- o padrão e a readequação não têm regra: um recebe quem sobra; o outro, quem está em readequação
  v_regra := case when v_tipo in ('grupo', 'exclusivo')
                  then interno.normalizar_regra(coalesce(p_dados -> 'regra', v_modelo.regra, '{"modo": "todas", "condicoes": []}'::jsonb))
                  else v_modelo.regra end;

  if v_tipo = 'exclusivo' then
    v_igreja := case when (p_dados ->> 'igreja_id') ~ '^[0-9a-f-]{36}$' then (p_dados ->> 'igreja_id')::uuid end;
    v_valor := case when jsonb_typeof(p_dados -> 'valor') = 'number' then (p_dados ->> 'valor')::numeric end;
    v_pedido := case when (p_dados ->> 'pedido_por') ~ '^[0-9a-f-]{36}$' then (p_dados ->> 'pedido_por')::uuid end;
    if v_igreja is null or not exists (select 1 from public.igrejas i where i.id = v_igreja and i.arquivado_em is null) then
      raise exception 'Escolha a igreja do modelo exclusivo.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.igrejas i where i.id = v_igreja and i.cadastro <> 'completo') then
      raise exception 'Só a igreja com registro tem modelo exclusivo (os ministros da igreja sem registro recebem a credencial de readequação).'
        using errcode = 'P0001';
    end if;
    if v_valor is null or v_valor <= 0 or v_valor > 100000 then
      raise exception 'Informe o valor do modelo exclusivo.' using errcode = 'P0001';
    end if;
    if v_pedido is not null and not exists (select 1 from public.pessoas p where p.id = v_pedido) then
      raise exception 'Quem pediu o modelo não foi encontrado.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.credencial_modelos m
               where m.tipo = 'exclusivo' and m.arquivado_em is null and m.exclusivo_igreja_id = v_igreja and m.id is distinct from p_id) then
      raise exception 'Esta igreja já tem um modelo exclusivo.' using errcode = 'P0001';
    end if;
    if v_modelo.exclusivo_pago_em is not null
       and (v_igreja is distinct from v_modelo.exclusivo_igreja_id or round(v_valor, 2) is distinct from v_modelo.exclusivo_valor) then
      raise exception 'Depois do pagamento, a igreja e o valor do modelo exclusivo não mudam.' using errcode = 'P0001';
    end if;
  end if;

  if p_id is null then
    insert into public.credencial_modelos (nome, descricao, tipo, prioridade, regra, exclusivo_igreja_id, exclusivo_valor, exclusivo_pedido_por)
    values (
      v_nome, v_descricao, v_tipo,
      coalesce((select max(m.prioridade) from public.credencial_modelos m
                where m.arquivado_em is null and m.tipo in ('grupo', 'exclusivo')), 0) + 1,
      v_regra, v_igreja, round(v_valor, 2), v_pedido
    )
    returning id into v_id;
    return v_id;
  end if;
  update public.credencial_modelos
  set nome = v_nome,
      descricao = v_descricao,
      regra = v_regra,
      exclusivo_igreja_id = case when v_tipo = 'exclusivo' then v_igreja end,
      exclusivo_valor = case when v_tipo = 'exclusivo' then round(v_valor, 2) end,
      exclusivo_pedido_por = case when v_tipo = 'exclusivo' then v_pedido end
  where id = p_id;
  return p_id;
end;
$$;

-- Nova versão do desenho de um modelo; "usar" passa a valer na hora (e põe o rascunho em uso)
create function interno.salvar_versao_modelo(p_modelo_id uuid, p_desenho jsonb, p_descricao text, p_usar boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
  v_id uuid;
begin
  perform interno.exigir_cuidar_dos_modelos();
  if coalesce(trim(p_descricao), '') = '' then
    raise exception 'Descreva o que mudou (ex.: logo oficial no cabeçalho).' using errcode = 'P0001';
  end if;
  select * into v_modelo from public.credencial_modelos where id = p_modelo_id and arquivado_em is null for update;
  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0001';
  end if;
  insert into public.modelos_credencial (modelo, descricao, modelo_id) values (p_desenho, trim(p_descricao), p_modelo_id)
  returning id into v_id;
  if p_usar then
    update public.credencial_modelos set versao_id = v_id, em_uso = true where id = p_modelo_id;
    if v_modelo.tipo = 'padrao' then
      update public.config_credencial set modelo_id = v_id where id;
    end if;
  end if;
  return v_id;
end;
$$;

-- Escolhe a versão do desenho em uso (vazio: o desenho do sistema, só no padrão e na readequação)
create function interno.usar_versao_modelo(p_modelo_id uuid, p_versao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
begin
  perform interno.exigir_cuidar_dos_modelos();
  select * into v_modelo from public.credencial_modelos where id = p_modelo_id and arquivado_em is null for update;
  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0001';
  end if;
  if p_versao_id is null then
    if v_modelo.tipo not in ('padrao', 'readequacao') then
      raise exception 'Escolha uma versão do desenho deste modelo.' using errcode = 'P0001';
    end if;
  else
    perform 1 from public.modelos_credencial v where v.id = p_versao_id and v.modelo_id = p_modelo_id and v.arquivado_em is null for share;
    if not found then
      raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
    end if;
  end if;
  update public.credencial_modelos set versao_id = p_versao_id where id = p_modelo_id;
  if v_modelo.tipo = 'padrao' then
    update public.config_credencial set modelo_id = p_versao_id where id;
  end if;
end;
$$;

-- Põe em uso ou volta a rascunho (só os de grupo e os exclusivos)
create function interno.por_modelo_em_uso(p_id uuid, p_em_uso boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
begin
  perform interno.exigir_cuidar_dos_modelos();
  select * into v_modelo from public.credencial_modelos where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0001';
  end if;
  if v_modelo.tipo not in ('grupo', 'exclusivo') then
    raise exception 'O modelo padrão e o da readequação estão sempre em uso.' using errcode = 'P0001';
  end if;
  if p_em_uso and v_modelo.versao_id is null then
    raise exception 'Salve o desenho do modelo antes de usar.' using errcode = 'P0001';
  end if;
  update public.credencial_modelos set em_uso = coalesce(p_em_uso, false) where id = p_id;
end;
$$;

-- A ordem: a lista completa dos modelos de grupo e exclusivos, do primeiro ao último
create function interno.ordenar_modelos(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atuais uuid[];
  v_pedidos uuid[] := coalesce(p_ids, '{}');
begin
  perform interno.exigir_cuidar_dos_modelos();
  perform 1 from public.credencial_modelos m
  where m.arquivado_em is null and m.tipo in ('grupo', 'exclusivo') order by m.id for update;
  v_atuais := array(select m.id from public.credencial_modelos m where m.arquivado_em is null and m.tipo in ('grupo', 'exclusivo'));
  if coalesce(array_ndims(v_pedidos), 1) <> 1
     or cardinality(v_pedidos) <> cardinality(v_atuais)
     or (select count(distinct x) from unnest(v_pedidos) x) <> cardinality(v_atuais)
     or not (v_pedidos <@ v_atuais) then
    raise exception 'A ordem mudou enquanto a tela estava aberta. Atualize a página e tente de novo.' using errcode = 'P0001';
  end if;
  update public.credencial_modelos m
  set prioridade = o.n
  from unnest(v_pedidos) with ordinality as o(id, n)
  where m.id = o.id and m.prioridade is distinct from o.n::integer;
end;
$$;

-- Cópia (rascunho) com a mesma regra e o desenho em uso
create function interno.duplicar_modelo(p_id uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem public.credencial_modelos;
  v_novo uuid;
  v_versao uuid;
begin
  perform interno.exigir_cuidar_dos_modelos();
  select * into v_origem from public.credencial_modelos where id = p_id and arquivado_em is null;
  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0001';
  end if;
  v_novo := interno.salvar_modelo(null, jsonb_build_object(
    'nome', p_nome,
    'descricao', v_origem.descricao,
    'tipo', 'grupo',
    'regra', case when v_origem.tipo in ('grupo', 'exclusivo') then v_origem.regra else '{"modo": "todas", "condicoes": []}'::jsonb end
  ));
  if v_origem.versao_id is not null then
    insert into public.modelos_credencial (modelo, descricao, modelo_id)
    select v.modelo, left('Cópia do modelo "' || v_origem.nome || '"', 200), v_novo
    from public.modelos_credencial v where v.id = v_origem.versao_id
    returning id into v_versao;
    update public.credencial_modelos set versao_id = v_versao where id = v_novo;
  end if;
  return v_novo;
end;
$$;

create function interno.arquivar_modelo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.exigir_cuidar_dos_modelos();
  update public.credencial_modelos set arquivado_em = now(), em_uso = false
  where id = p_id and arquivado_em is null and tipo in ('grupo', 'exclusivo');
  if not found then
    raise exception 'Este modelo não pode ser arquivado (o padrão e o da readequação ficam sempre).' using errcode = 'P0001';
  end if;
end;
$$;

-- O pagamento do modelo exclusivo: a tesouraria ou a presidência (é dinheiro). Vazio = desfazer.
-- A entrada do caixa é opcional e precisa ser uma entrada não cancelada.
create function interno.registrar_pagamento_exclusivo(p_id uuid, p_pago_em date, p_lancamento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria ou a presidência registram o pagamento do modelo exclusivo.' using errcode = '42501';
  end if;
  if p_pago_em is not null and p_pago_em > current_date then
    raise exception 'O pagamento não pode ter data no futuro.' using errcode = 'P0001';
  end if;
  if p_pago_em is null and p_lancamento_id is not null then
    raise exception 'Informe a data do pagamento.' using errcode = 'P0001';
  end if;
  if p_lancamento_id is not null and not exists (
    select 1 from public.lancamentos l where l.id = p_lancamento_id and l.tipo = 'entrada' and l.situacao <> 'cancelado' and l.arquivado_em is null
  ) then
    raise exception 'Escolha uma entrada do caixa (o pagamento da igreja).' using errcode = 'P0001';
  end if;
  update public.credencial_modelos
  set exclusivo_pago_em = p_pago_em, exclusivo_lancamento_id = p_lancamento_id
  where id = p_id and tipo = 'exclusivo' and arquivado_em is null;
  if not found then
    raise exception 'Modelo exclusivo não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Leituras para as telas
-- ---------------------------------------------------------------------
-- A galeria: os modelos na ordem (os de grupo, depois o padrão e a readequação), o desenho e quantas pessoas hoje
create function interno.painel_modelos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_contagem jsonb;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')) then
    raise exception 'Só a secretaria, a presidência e a tesouraria veem os modelos da credencial.' using errcode = '42501';
  end if;
  select coalesce(jsonb_object_agg(x.modelo_id::text, x.n), '{}'::jsonb) into v_contagem
  from (select q.modelo_id, count(*) as n from interno.modelos_dos_associados(interno.modelos_ativos(), current_date) q
        where q.modelo_id is not null group by q.modelo_id) x;
  return jsonb_build_object(
    'fim_mandato', (select c.fim_mandato from public.config_credencial c where c.id),
    'readequacao_ate', (select c.readequacao_ate from public.config_igrejas c where c.id),
    'associados', (select count(*) from public.associados a where a.arquivado_em is null and a.situacao = 'ativo'),
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'nome', m.nome,
        'descricao', m.descricao,
        'tipo', m.tipo,
        'prioridade', m.prioridade,
        'em_uso', m.em_uso,
        'regra', m.regra,
        'versao_id', m.versao_id,
        'desenho', v.modelo,
        'salvo_em', v.criado_em,
        'igreja_id', m.exclusivo_igreja_id,
        'igreja_nome', i.nome,
        'valor', m.exclusivo_valor,
        'pedido_por', m.exclusivo_pedido_por,
        'pedido_por_nome', p.nome,
        'pago_em', m.exclusivo_pago_em,
        'lancamento_id', m.exclusivo_lancamento_id,
        'pessoas', coalesce((v_contagem ->> m.id::text)::integer, 0)
      ) order by case when m.tipo in ('grupo', 'exclusivo') then 0 when m.tipo = 'padrao' then 1 else 2 end,
                 m.prioridade, m.criado_em)
      from public.credencial_modelos m
      left join public.modelos_credencial v on v.id = m.versao_id
      left join public.igrejas i on i.id = m.exclusivo_igreja_id
      left join public.pessoas p on p.id = m.exclusivo_pedido_por
      where m.arquivado_em is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Quem receberia o modelo com a regra da tela (ainda sem salvar), como se estivesse em uso (e o exclusivo, pago).
-- Devolve as pessoas que recebem e quantas se encaixam mas ficam com um modelo de cima.
create function interno.simular_quem_recebe(p_modelo_id uuid, p_regra jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_modelo public.credencial_modelos;
  v_modelos public.credencial_modelos[];
  v_pessoa uuid;
  v_ctx jsonb;
  v_ids uuid[] := '{}';
  v_acima integer := 0;
  v_grupo boolean;
begin
  perform interno.exigir_cuidar_dos_modelos();
  select * into v_modelo from public.credencial_modelos where id = p_modelo_id and arquivado_em is null;
  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0001';
  end if;
  v_grupo := v_modelo.tipo in ('grupo', 'exclusivo');
  if v_grupo then
    if p_regra is not null then
      v_modelo.regra := interno.normalizar_regra(p_regra);
    end if;
    v_modelo.em_uso := true;
    if v_modelo.tipo = 'exclusivo' then
      v_modelo.exclusivo_pago_em := coalesce(v_modelo.exclusivo_pago_em, current_date);
    end if;
  end if;
  -- os modelos em uso, com este no lugar dele (como se estivesse em uso), na ordem
  v_modelos := array(
    select x from (
      select y.* from unnest(interno.modelos_ativos()) y where y.id <> p_modelo_id
      union all
      select (v_modelo).*
    ) x
    order by x.prioridade, x.criado_em, x.id
  );

  for v_pessoa in select a.pessoa_id from public.associados a where a.arquivado_em is null and a.situacao = 'ativo' loop
    v_ctx := interno.contexto_credencial(v_pessoa, current_date);
    if interno.escolher_modelo(v_ctx, v_modelos, current_date) = p_modelo_id then
      v_ids := v_ids || v_pessoa;
    elsif v_grupo and (v_ctx ->> 'igreja_cadastro') is distinct from 'sem_registro' then
      -- se encaixa, mas fica com um modelo de cima
      if v_modelo.tipo = 'exclusivo' then
        if (v_ctx ->> 'igreja_id') = v_modelo.exclusivo_igreja_id::text
           and (jsonb_array_length(v_modelo.regra -> 'condicoes') = 0 or interno.atende_regra(v_ctx, v_modelo.regra, current_date)) then
          v_acima := v_acima + 1;
        end if;
      elsif interno.atende_regra(v_ctx, v_modelo.regra, current_date) then
        v_acima := v_acima + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'regra', v_modelo.regra,
    'acima', v_acima,
    'pessoas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pessoa_id', va.pessoa_id,
        'nome', va.nome,
        'numero_registro', va.numero_registro,
        'titulo', va.titulo,
        'igreja', va.igreja
      ) order by va.nome)
      from public.vw_associados va
      where va.pessoa_id = any (v_ids)
    ), '[]'::jsonb)
  );
end;
$$;

-- A lista do módulo: todos os associados ativos, com as pendências, se está em dia, se está em readequação e o modelo
create function interno.lista_credenciais()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a lista das credenciais.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'fim_mandato', (select c.fim_mandato from public.config_credencial c where c.id),
    'readequacao_ate', (select c.readequacao_ate from public.config_igrejas c where c.id),
    'credenciais', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pessoa_id', pc.pessoa_id,
        'numero_registro', pc.numero_registro,
        'nome', pc.nome,
        'igreja_id', pc.igreja_id,
        'igreja', pc.igreja,
        'pendencias', to_jsonb(pc.pendencias),
        'em_dia', interno.esta_em_dia(pc.pessoa_id),
        'readequacao', interno.em_readequacao(pc.pessoa_id),
        'modelo_id', q.modelo_id,
        'modelo', m.nome,
        'valida_ate', coalesce(cr.valida_ate, (select c.fim_mandato from public.config_credencial c where c.id))
      ) order by pc.nome)
      from public.vw_pendencias_credencial pc
      left join interno.modelos_dos_associados(interno.modelos_ativos(), current_date) q on q.pessoa_id = pc.pessoa_id
      left join public.credencial_modelos m on m.id = q.modelo_id
      left join public.credenciais cr on cr.pessoa_id = pc.pessoa_id
        and cr.substituida_em is null and cr.renovada_em is null and cr.arquivado_em is null
    ), '[]'::jsonb)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 7. A credencial de cada um sai no modelo dele; a da readequação, com o prazo
-- ---------------------------------------------------------------------
-- A igreja sem registro não tem CNPJ: na credencial de readequação isso não é pendência
create or replace view public.vw_pendencias_credencial
with (security_invoker = true)
as
select
  v.id as associado_id,
  v.pessoa_id,
  v.numero_registro,
  v.nome,
  v.igreja_id,
  v.igreja,
  array_remove(
    array[case when p.foto_caminho is null then 'Sem foto' end]
    || coalesce(interno.pendencias_identidade(p.id), '{}'::text[])
    || array[
      case when v.titulo_id is null then 'Sem título' end,
      case when v.igreja_id is null then 'Sem igreja' end,
      case when v.igreja_id is not null and v.funcao is null and not v.pastor_presidente then 'Sem a função na igreja' end,
      case when v.igreja_id is not null and i.sigla is null then 'Igreja sem sigla' end,
      case when v.igreja_id is not null and i.cnpj is null and i.cadastro <> 'sem_registro' then 'Igreja sem CNPJ' end
    ],
    null
  ) as pendencias
from public.vw_associados v
join public.associados a on a.id = v.id
join public.pessoas p on p.id = v.pessoa_id
left join public.igrejas i on i.id = v.igreja_id
where v.situacao = 'ativo' and a.arquivado_em is null;

create or replace function interno.dados_credenciais(p_pessoas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_ids uuid[];
  v_pessoa uuid;
  v_lista jsonb := '[]'::jsonb;
  v_item jsonb;
  v_codigo text;
  v_credencial public.credenciais;
  v_config public.config_credencial;
  v_prazo date := (select c.readequacao_ate from public.config_igrejas c where c.id);
  v_ativos public.credencial_modelos[] := interno.modelos_ativos();
  v_modelo uuid;
  v_usados uuid[] := '{}';
  v_readequacao boolean;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver a credencial.' using errcode = '42501';
  end if;
  if p_pessoas is null or array_ndims(p_pessoas) <> 1 or cardinality(p_pessoas) not between 1 and 500 then
    raise exception 'Escolha de 1 a 500 credenciais.' using errcode = 'P0001';
  end if;
  -- sem repetir e sem vazios, na ordem pedida
  v_ids := array(
    select x from unnest(p_pessoas) with ordinality as t(x, n) where x is not null group by x order by min(n)
  );
  foreach v_pessoa in array v_ids loop
    if v_pessoa <> v_eu and not v_diretoria then
      raise exception 'Só a secretaria ou a presidência veem a credencial de outra pessoa.' using errcode = '42501';
    end if;
  end loop;
  select * into v_config from public.config_credencial where id;

  -- cria as credenciais que faltam em ordem fixa (duas telas ao mesmo tempo não se travam)
  for v_pessoa in
    select x from unnest(v_ids) x
    where exists (select 1 from public.associados a where a.pessoa_id = x and a.arquivado_em is null and a.situacao = 'ativo')
    order by x
  loop
    perform interno.codigo_credencial(v_pessoa);
  end loop;

  foreach v_pessoa in array v_ids loop
    select jsonb_build_object(
      'pessoa_id', v.pessoa_id,
      'nome', v.nome,
      'cpf', p.cpf,
      'nome_pai', p.nome_pai,
      'nome_mae', p.nome_mae,
      'numero_registro', v.numero_registro,
      'admitido_em', v.admitido_em,
      'titulo', v.titulo,
      'funcao', coalesce(v.funcao, case when v.pastor_presidente then 'Pastor presidente' end),
      'igreja', v.igreja,
      'igreja_sigla', i.sigla,
      'igreja_cnpj', i.cnpj,
      'foto_caminho', p.foto_caminho,
      'em_dia', interno.esta_em_dia(v.pessoa_id),
      'jubilado', v.jubilado,
      'pendencias', coalesce(pc.pendencias, '{}'::text[]),
      'cargo', (select m.cargo from public.mandatos m
                where m.pessoa_id = v.pessoa_id and m.arquivado_em is null
                  and m.inicio <= current_date and interno.fim_efetivo(m) >= current_date
                order by m.inicio desc limit 1),
      'readequacao', coalesce(i.cadastro = 'sem_registro', false)
    )
    into v_item
    from public.vw_associados v
    join public.associados a on a.id = v.id
    join public.pessoas p on p.id = v.pessoa_id
    left join public.igrejas i on i.id = v.igreja_id
    left join public.vw_pendencias_credencial pc on pc.associado_id = v.id
    where v.pessoa_id = v_pessoa and v.situacao = 'ativo' and a.arquivado_em is null;
    if v_item is not null then
      v_codigo := interno.codigo_credencial(v_pessoa);
      select * into v_credencial from public.credenciais where codigo = v_codigo;
      v_modelo := interno.escolher_modelo(interno.contexto_credencial(v_pessoa, current_date), v_ativos, current_date);
      v_readequacao := (v_item ->> 'readequacao')::boolean;
      if v_modelo is not null and not (v_modelo = any (v_usados)) then
        v_usados := v_usados || v_modelo;
      end if;
      v_item := v_item || jsonb_build_object(
        'codigo', v_credencial.codigo,
        'foto_publica', v_credencial.foto_publica,
        'valida_ate', coalesce(v_credencial.valida_ate, v_config.fim_mandato),
        'emitida_em', v_credencial.criado_em,
        'modelo_id', v_modelo,
        'prazo_readequacao', case when v_readequacao then v_prazo end
      );
      v_lista := v_lista || jsonb_build_array(v_item);
    end if;
  end loop;

  return jsonb_build_object(
    'fim_mandato', v_config.fim_mandato,
    'texto_verso', v_config.texto_verso,
    'credenciais', v_lista,
    -- o desenho de cada modelo usado (vazio = o desenho do sistema para o tipo)
    'modelos', coalesce((
      select jsonb_object_agg(m.id, jsonb_build_object('nome', m.nome, 'tipo', m.tipo, 'desenho', ve.modelo))
      from public.credencial_modelos m
      left join public.modelos_credencial ve on ve.id = m.versao_id
      where m.id = any (v_usados)
    ), '{}'::jsonb)
  );
end;
$$;

-- "modelo" (o desenho do padrão), que as telas antigas leem
create or replace function interno.modelo_credencial_em_uso()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select v.modelo
  from public.credencial_modelos m
  join public.modelos_credencial v on v.id = m.versao_id
  where m.tipo = 'padrao' and m.arquivado_em is null;
$$;

-- A validação pública ganha a readequação (a faixa e o prazo); o resto continua igual
create or replace function interno.validar_credencial(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
  v_ate date;
  v_dados jsonb;
  v_readequacao boolean;
begin
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('situacao', 'inexistente', 'consultado_em', now());
  end if;
  select * into v_credencial from public.credenciais where codigo = p_codigo and arquivado_em is null;
  if not found then
    return jsonb_build_object('situacao', 'inexistente', 'consultado_em', now());
  end if;
  if v_credencial.substituida_em is not null then
    return jsonb_build_object('situacao', 'substituida', 'substituida_em', v_credencial.substituida_em, 'consultado_em', now());
  end if;

  select jsonb_build_object(
    'nome', v.nome,
    'titulo', v.titulo,
    'numero_registro', v.numero_registro,
    'igreja', coalesce(i.sigla, v.igreja),
    'foto_publica', v_credencial.foto_publica,
    'em_dia', interno.esta_em_dia(v.pessoa_id),
    'ativo', (v.situacao = 'ativo' and a.arquivado_em is null),
    'readequacao', coalesce(i.cadastro = 'sem_registro', false)
  )
  into v_dados
  from public.vw_associados v
  join public.associados a on a.id = v.id
  left join public.igrejas i on i.id = v.igreja_id
  where v.pessoa_id = v_credencial.pessoa_id
  order by (v.situacao = 'ativo' and a.arquivado_em is null) desc
  limit 1;

  if v_dados is null or not (v_dados ->> 'ativo')::boolean then
    return jsonb_build_object('situacao', 'inativa', 'nome', v_dados ->> 'nome', 'consultado_em', now());
  end if;
  v_ate := coalesce(v_credencial.valida_ate, (select fim_mandato from public.config_credencial where id));
  v_readequacao := (v_dados ->> 'readequacao')::boolean;
  return (v_dados - 'ativo') || jsonb_build_object(
    'situacao', case when v_ate is not null and v_ate < current_date then 'vencida' else 'valida' end,
    'valida_ate', v_ate,
    'renovada', v_credencial.renovada_em is not null,
    'prazo_readequacao', case when v_readequacao then (select c.readequacao_ate from public.config_igrejas c where c.id) end,
    'consultado_em', now()
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 8. As funções antigas do modelo passam a mexer no modelo PADRÃO (as telas antigas continuam funcionando)
-- ---------------------------------------------------------------------
create or replace function interno.salvar_modelo_credencial(p_modelo jsonb, p_descricao text, p_usar boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return interno.salvar_versao_modelo(
    (select m.id from public.credencial_modelos m where m.tipo = 'padrao' and m.arquivado_em is null), p_modelo, p_descricao, p_usar
  );
end;
$$;

create or replace function interno.usar_modelo_credencial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.usar_versao_modelo((select m.id from public.credencial_modelos m where m.tipo = 'padrao' and m.arquivado_em is null), p_id);
end;
$$;

-- Arquivar uma versão: a que está em uso em QUALQUER modelo não pode
create or replace function interno.arquivar_modelo_credencial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform interno.exigir_cuidar_dos_modelos();
  perform 1 from public.config_credencial where id for update;
  if exists (select 1 from public.credencial_modelos m where m.versao_id = p_id and m.arquivado_em is null) then
    raise exception 'Esta versão está em uso. Escolha outra antes de arquivar.' using errcode = 'P0001';
  end if;
  update public.modelos_credencial set arquivado_em = now() where id = p_id and arquivado_em is null;
  if not found then
    raise exception 'Versão do modelo não encontrada.' using errcode = 'P0001';
  end if;
end;
$$;

-- As versões de cada modelo (o editor), com quem salvou e se está em uso
create view public.vw_versoes_modelo
with (security_invoker = true)
as
select
  v.id,
  v.modelo_id,
  v.descricao,
  v.modelo,
  v.criado_em,
  p.nome as criado_por_nome,
  exists (select 1 from public.credencial_modelos m where m.versao_id = v.id and m.arquivado_em is null) as em_uso
from public.modelos_credencial v
left join public.pessoas p on p.usuario_id = v.criado_por
where v.arquivado_em is null;


-- ---------------------------------------------------------------------
-- 9. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.salvar_modelo(p_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_modelo(p_id, p_dados); $$;
create function public.salvar_versao_modelo(p_modelo_id uuid, p_desenho jsonb, p_descricao text, p_usar boolean)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.salvar_versao_modelo(p_modelo_id, p_desenho, p_descricao, p_usar);
$$;
create function public.usar_versao_modelo(p_modelo_id uuid, p_versao_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.usar_versao_modelo(p_modelo_id, p_versao_id); $$;
create function public.por_modelo_em_uso(p_id uuid, p_em_uso boolean)
returns void language sql security invoker set search_path = '' as $$ select interno.por_modelo_em_uso(p_id, p_em_uso); $$;
create function public.ordenar_modelos(p_ids uuid[])
returns void language sql security invoker set search_path = '' as $$ select interno.ordenar_modelos(p_ids); $$;
create function public.duplicar_modelo(p_id uuid, p_nome text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.duplicar_modelo(p_id, p_nome); $$;
create function public.arquivar_modelo(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_modelo(p_id); $$;
create function public.registrar_pagamento_exclusivo(p_id uuid, p_pago_em date, p_lancamento_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select interno.registrar_pagamento_exclusivo(p_id, p_pago_em, p_lancamento_id);
$$;
create function public.painel_modelos()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.painel_modelos(); $$;
create function public.simular_quem_recebe(p_modelo_id uuid, p_regra jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.simular_quem_recebe(p_modelo_id, p_regra); $$;
create function public.lista_credenciais()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.lista_credenciais(); $$;

-- os ajudantes internos: só as funções do banco chamam
revoke all on function interno.proteger_modelo_credencial() from public;
revoke all on function interno.contexto_credencial(uuid, date) from public;
revoke all on function interno.atende_condicao(jsonb, jsonb, date) from public;
revoke all on function interno.atende_regra(jsonb, jsonb, date) from public;
revoke all on function interno.modelos_ativos() from public;
revoke all on function interno.escolher_modelo(jsonb, public.credencial_modelos[], date) from public;
revoke all on function interno.modelo_da_pessoa(uuid, date) from public;
revoke all on function interno.em_readequacao(uuid) from public;
revoke all on function interno.modelos_dos_associados(public.credencial_modelos[], date) from public;
revoke all on function interno.data_da_regra(text) from public;
revoke all on function interno.normalizar_regra(jsonb) from public;
revoke all on function interno.exigir_cuidar_dos_modelos() from public;

revoke all on function interno.salvar_modelo(uuid, jsonb) from public;
revoke all on function interno.salvar_versao_modelo(uuid, jsonb, text, boolean) from public;
revoke all on function interno.usar_versao_modelo(uuid, uuid) from public;
revoke all on function interno.por_modelo_em_uso(uuid, boolean) from public;
revoke all on function interno.ordenar_modelos(uuid[]) from public;
revoke all on function interno.duplicar_modelo(uuid, text) from public;
revoke all on function interno.arquivar_modelo(uuid) from public;
revoke all on function interno.registrar_pagamento_exclusivo(uuid, date, uuid) from public;
revoke all on function interno.painel_modelos() from public;
revoke all on function interno.simular_quem_recebe(uuid, jsonb) from public;
revoke all on function interno.lista_credenciais() from public;
grant execute on function interno.salvar_modelo(uuid, jsonb) to authenticated;
grant execute on function interno.salvar_versao_modelo(uuid, jsonb, text, boolean) to authenticated;
grant execute on function interno.usar_versao_modelo(uuid, uuid) to authenticated;
grant execute on function interno.por_modelo_em_uso(uuid, boolean) to authenticated;
grant execute on function interno.ordenar_modelos(uuid[]) to authenticated;
grant execute on function interno.duplicar_modelo(uuid, text) to authenticated;
grant execute on function interno.arquivar_modelo(uuid) to authenticated;
grant execute on function interno.registrar_pagamento_exclusivo(uuid, date, uuid) to authenticated;
grant execute on function interno.painel_modelos() to authenticated;
grant execute on function interno.simular_quem_recebe(uuid, jsonb) to authenticated;
grant execute on function interno.lista_credenciais() to authenticated;

revoke all on function public.salvar_modelo(uuid, jsonb) from public, anon;
revoke all on function public.salvar_versao_modelo(uuid, jsonb, text, boolean) from public, anon;
revoke all on function public.usar_versao_modelo(uuid, uuid) from public, anon;
revoke all on function public.por_modelo_em_uso(uuid, boolean) from public, anon;
revoke all on function public.ordenar_modelos(uuid[]) from public, anon;
revoke all on function public.duplicar_modelo(uuid, text) from public, anon;
revoke all on function public.arquivar_modelo(uuid) from public, anon;
revoke all on function public.registrar_pagamento_exclusivo(uuid, date, uuid) from public, anon;
revoke all on function public.painel_modelos() from public, anon;
revoke all on function public.simular_quem_recebe(uuid, jsonb) from public, anon;
revoke all on function public.lista_credenciais() from public, anon;
grant execute on function public.salvar_modelo(uuid, jsonb) to authenticated;
grant execute on function public.salvar_versao_modelo(uuid, jsonb, text, boolean) to authenticated;
grant execute on function public.usar_versao_modelo(uuid, uuid) to authenticated;
grant execute on function public.por_modelo_em_uso(uuid, boolean) to authenticated;
grant execute on function public.ordenar_modelos(uuid[]) to authenticated;
grant execute on function public.duplicar_modelo(uuid, text) to authenticated;
grant execute on function public.arquivar_modelo(uuid) to authenticated;
grant execute on function public.registrar_pagamento_exclusivo(uuid, date, uuid) to authenticated;
grant execute on function public.painel_modelos() to authenticated;
grant execute on function public.simular_quem_recebe(uuid, jsonb) to authenticated;
grant execute on function public.lista_credenciais() to authenticated;

-- Tabela: só leitura pela API; gravar, só pelas funções
revoke all on public.credencial_modelos from anon, authenticated;
grant select on public.credencial_modelos to authenticated;
revoke all on public.vw_versoes_modelo from anon, authenticated;
grant select on public.vw_versoes_modelo to authenticated;
revoke all on public.vw_pendencias_credencial from anon, authenticated;
grant select on public.vw_pendencias_credencial to authenticated;

alter table public.credencial_modelos enable row level security;
create policy "modelos da credencial: a secretaria, a presidência e a tesouraria leem"
  on public.credencial_modelos for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')));
