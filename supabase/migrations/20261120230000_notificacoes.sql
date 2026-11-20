-- =====================================================================
-- Telas novas, parte 11 (Fase 5.5): as notificações (rodada 15, aprovada em 18/11/2026)
--
--   * a tabela das notificações: para quem, o quê, o link e quando foi lida (o "lido" passa a ser por pessoa,
--     no banco, e não mais no aparelho);
--   * os avisos que o sino já mostrava passam a GERAR notificações quando acontecem: a assembleia convocada, a
--     votação aberta, o pedido de AGE para assinar, o aviso novo no mural, a pendência no pedido de associação,
--     o comprovante conferido e o item da igreja que voltou da conferência;
--   * os avisos com data (os documentos da igreja 60 e 30 dias antes de vencer e a igreja suspensa) saem uma
--     vez por dia, na primeira leitura do dia (ou na rodada do envio);
--   * as preferências de cada pessoa: se ativou os avisos no celular, o que chega e o silêncio à noite;
--   * as inscrições dos aparelhos para a notificação do navegador (push) e as funções que o envio usa
--     (supabase/functions/enviar-avisos): a lista do que mandar e o resultado de cada envio;
--   * o recado da secretaria pelo aplicativo ("Mandar pelo aplicativo", ao lado do WhatsApp) e o
--     "Lembrar todos" das Contribuições.
-- Sem e-mail e sem SMS (decisão do usuário). Nada se apaga: tudo vai para a auditoria.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table public.notificacoes (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas (id),
  -- o assunto (a pessoa escolhe quais chegam no celular): veja interno.tipos_de_aviso()
  tipo            text not null check (tipo in ('assembleias', 'votacoes', 'mural', 'mensalidade', 'documentos', 'pedido', 'recado')),
  titulo          text not null check (length(trim(titulo)) between 2 and 120),
  texto           text not null check (length(trim(texto)) between 2 and 1000),
  -- o endereço dentro do sistema que o aviso abre (nunca um site de fora)
  link            text check (link is null or (link ~ '^/[A-Za-z0-9/_?=&%.:-]*$' and link !~ '//' and length(link) <= 300)),
  -- a mesma notificação não se repete para a mesma pessoa (ex.: 'votacao:<id>')
  chave           text check (chave is null or length(chave) <= 200),
  urgente         boolean not null default false,
  -- quando aconteceu o que o aviso conta (a ordem do sino)
  quando          timestamptz not null default now(),
  lida_em         timestamptz,
  push_enviado_em timestamptz,
  push_tentativas integer not null default 0 check (push_tentativas >= 0),
  -- quem mandou (o recado da secretaria e o "Lembrar todos"); null = o próprio sistema
  enviada_por     uuid references public.pessoas (id),
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.notificacoes is
  'Os avisos de cada pessoa (o sino e a notificação no celular). O lido é por pessoa; o envio pelo navegador (push) fica marcado em push_enviado_em.';
create unique index notificacoes_chave on public.notificacoes (pessoa_id, chave) where chave is not null;
create index notificacoes_da_pessoa on public.notificacoes (pessoa_id, quando desc) where arquivado_em is null;
create index notificacoes_para_enviar on public.notificacoes (quando) where push_enviado_em is null and lida_em is null and arquivado_em is null;
create index notificacoes_enviada_por on public.notificacoes (enviada_por);
select interno.aplicar_padroes('public.notificacoes');

create table public.notificacao_preferencias (
  id               uuid primary key default gen_random_uuid(),
  pessoa_id        uuid not null references public.pessoas (id),
  -- a resposta do primeiro acesso ("Receber os avisos no celular?")
  ativou_em        timestamptz,
  recusou_em       timestamptz,
  -- os assuntos que NÃO chegam no celular (no sino aparecem todos)
  tipos_desligados text[] not null default '{}',
  -- das 22h às 7h, só o que for urgente
  silencio_noite   boolean not null default true,
  arquivado_em     timestamptz,
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint notificacao_preferencias_tipos check (
    tipos_desligados <@ array['assembleias', 'votacoes', 'mural', 'mensalidade', 'documentos']::text[]
  )
);
comment on table public.notificacao_preferencias is 'O que cada pessoa escolheu receber no celular e o silêncio à noite.';
create unique index notificacao_preferencias_pessoa on public.notificacao_preferencias (pessoa_id) where arquivado_em is null;
select interno.aplicar_padroes('public.notificacao_preferencias');

create table public.inscricoes_push (
  id              uuid primary key default gen_random_uuid(),
  pessoa_id       uuid not null references public.pessoas (id),
  -- o endereço que o navegador deu para mandar a notificação (do serviço do próprio navegador)
  endpoint        text not null check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh          text not null check (length(p256dh) between 20 and 200),
  auth            text not null check (length(auth) between 8 and 100),
  -- só para a pessoa reconhecer ("Celular · Chrome"), sem identificar o aparelho
  aparelho        text check (aparelho is null or length(aparelho) <= 120),
  ultimo_envio_em timestamptz,
  falhas          integer not null default 0 check (falhas >= 0),
  arquivado_em    timestamptz,
  motivo_arquivo  text check (motivo_arquivo is null or motivo_arquivo in ('saiu', 'expirou', 'outra_pessoa', 'falhou')),
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.inscricoes_push is
  'Os aparelhos em que cada pessoa ativou a notificação do navegador. Quando o navegador avisa que a inscrição acabou, ela é arquivada.';
create unique index inscricoes_push_endpoint on public.inscricoes_push (endpoint) where arquivado_em is null;
create index inscricoes_push_pessoa on public.inscricoes_push (pessoa_id) where arquivado_em is null;
select interno.aplicar_padroes('public.inscricoes_push');

-- O dia em que os avisos com data (documentos da igreja) já foram gerados
create table public.config_notificacoes (
  id                boolean primary key default true check (id),
  ultimo_dia_gerado date,
  criado_por        uuid default auth.uid(),
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
comment on table public.config_notificacoes is 'Controle interno das notificações: o último dia em que os avisos com data foram gerados.';
select interno.aplicar_padroes('public.config_notificacoes');
insert into public.config_notificacoes (id) values (true);


-- ---------------------------------------------------------------------
-- 2. Ajudantes: o texto da data e da hora, e criar a notificação
-- ---------------------------------------------------------------------
-- "28/04" e "19h30" (ou "19h"), no fuso de Parauapebas
create function interno.dia_mes(p_instante timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_instante at time zone 'America/Belem', 'DD/MM');
$$;

create function interno.hora_curta(p_instante timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case to_char(p_instante at time zone 'America/Belem', 'MI')
           when '00' then to_char(p_instante at time zone 'America/Belem', 'FMHH24') || 'h'
           else to_char(p_instante at time zone 'America/Belem', 'FMHH24') || 'h' || to_char(p_instante at time zone 'America/Belem', 'MI')
         end;
$$;

-- "R$ 1.234,50" (o to_char com vírgula e ponto fixos não depende do idioma do servidor)
create function interno.em_reais(p_valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(p_valor, 'FM999,999,990.00'), ',.', '.,');
$$;

-- "julho de 2026"
create function interno.mes_por_extenso(p_dia date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro',
                'novembro', 'dezembro'])[extract(month from p_dia)::integer] || ' de ' || extract(year from p_dia)::integer;
$$;

-- Cria a mesma notificação para cada pessoa da lista (sem repetir a chave). Devolve quantas criou.
create function interno.notificar(
  p_pessoas     uuid[],
  p_tipo        text,
  p_titulo      text,
  p_texto       text,
  p_link        text,
  p_chave       text,
  p_urgente     boolean default false,
  p_quando      timestamptz default now(),
  p_enviada_por uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_criadas integer;
begin
  insert into public.notificacoes (pessoa_id, tipo, titulo, texto, link, chave, urgente, quando, enviada_por)
  select distinct p.id, p_tipo, left(p_titulo, 120), left(p_texto, 1000), p_link, p_chave, p_urgente, coalesce(p_quando, now()), p_enviada_por
  from public.pessoas p
  where p.id = any (p_pessoas) and p.arquivado_em is null
  on conflict (pessoa_id, chave) where chave is not null do nothing;
  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

-- Os associados ativos (os ministros do COMEP)
create function interno.associados_ativos()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct a.pessoa_id), '{}')
  from public.associados a
  join public.pessoas p on p.id = a.pessoa_id and p.arquivado_em is null
  where a.arquivado_em is null and a.situacao = 'ativo';
$$;

-- Quem é do COMEP (tem algum perfil): quem lê o mural
create function interno.pessoas_do_comep()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct pa.pessoa_id), '{}')
  from public.perfis_acesso pa
  join public.pessoas p on p.id = pa.pessoa_id and p.arquivado_em is null
  where pa.arquivado_em is null;
$$;

-- O pastor presidente de hoje (associado ativo) de uma igreja
create function interno.pastores_da_igreja(p_igreja_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct v.pessoa_id), '{}')
  from public.vinculos_igreja v
  join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  where v.igreja_id = p_igreja_id and v.pastor_presidente and v.fim is null and v.arquivado_em is null;
$$;


-- ---------------------------------------------------------------------
-- 3. Os avisos que já existiam passam a gerar notificações (na hora em que acontecem)
-- ---------------------------------------------------------------------

-- A assembleia (ou a reunião mensal) convocada: para todos os associados
create function interno.notificar_encontro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo text;
  v_nome text;
begin
  if new.situacao <> 'convocado' or new.arquivado_em is not null or new.inicio < now()
     or (tg_op = 'UPDATE' and old.situacao = 'convocado') then
    return null;
  end if;
  v_titulo := case new.tipo when 'reuniao_mensal' then 'Reunião mensal convocada' when 'ago' then 'AGO convocada' else 'AGE convocada' end;
  v_nome := case new.tipo when 'reuniao_mensal' then 'Reunião mensal' when 'ago' then 'Assembleia Geral Ordinária' else 'Assembleia Geral Extraordinária' end;
  perform interno.notificar(
    interno.associados_ativos(), 'assembleias', v_titulo,
    v_nome || ' em ' || interno.dia_mes(new.inicio) || ', às ' || interno.hora_curta(new.inicio) || ', ' || new.local || '. Confirme a presença.',
    '/assembleias/' || new.id, 'encontro:' || new.id, false, coalesce(new.convocado_em, now()));
  return null;
end;
$$;
create trigger notificar_encontro
  after insert or update of situacao on public.encontros
  for each row execute function interno.notificar_encontro();

-- A votação (ou enquete) aberta: para quem pode votar
create function interno.notificar_votacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aptos uuid[];
begin
  if new.situacao <> 'aberta' or new.arquivado_em is not null or (tg_op = 'UPDATE' and old.situacao = 'aberta') then
    return null;
  end if;
  select coalesce(array_agg(a.pessoa_id), '{}') into v_aptos
  from public.associados a
  where a.arquivado_em is null and a.situacao = 'ativo' and interno.pode_votar(new.id, a.pessoa_id);
  perform interno.notificar(
    v_aptos, 'votacoes', case new.tipo when 'enquete' then 'Enquete aberta' else 'Votação aberta' end,
    new.titulo || case when new.fecha_em is not null then '. Vote até ' || interno.dia_mes(new.fecha_em) || ', às ' || interno.hora_curta(new.fecha_em) || '.' else '.' end,
    '/votacoes/' || new.id, 'votacao:' || new.id, false, coalesce(new.aberta_em, now()));
  return null;
end;
$$;
create trigger notificar_votacao
  after insert or update of situacao on public.votacoes
  for each row execute function interno.notificar_votacao();

-- O pedido de AGE: para quem pode assinar (associado em dia ou do Conselho Diretor), menos quem abriu
create function interno.notificar_pedido_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quem uuid[];
begin
  if new.situacao <> 'coletando' or new.arquivado_em is not null then
    return null;
  end if;
  select coalesce(array_agg(distinct a.pessoa_id), '{}') into v_quem
  from public.associados a
  where a.arquivado_em is null and a.situacao = 'ativo' and a.pessoa_id <> new.autor_id
    and (interno.associado_apto(a.pessoa_id) or interno.do_conselho_diretor(a.pessoa_id));
  perform interno.notificar(
    v_quem, 'assembleias', 'Pedido de AGE',
    new.titulo || ': falta a sua assinatura (até ' || to_char(new.prazo, 'DD/MM/YYYY') || ').',
    '/assembleias/pedidos/' || new.id, 'age:' || new.id, false, new.criado_em);
  return null;
end;
$$;
create trigger notificar_pedido_age
  after insert on public.pedidos_age
  for each row execute function interno.notificar_pedido_age();

-- O aviso novo no mural: para quem é do COMEP (menos quem publicou)
create function interno.notificar_aviso_mural()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.arquivado_em is not null or (new.valido_ate is not null and new.valido_ate < current_date) then
    return null;
  end if;
  perform interno.notificar(
    array(select x from unnest(interno.pessoas_do_comep()) x where new.autor_id is null or x <> new.autor_id),
    'mural', 'Aviso no mural', new.titulo, '/avisos', 'aviso:' || new.id, false, new.criado_em);
  return null;
end;
$$;
create trigger notificar_aviso_mural
  after insert on public.avisos
  for each row execute function interno.notificar_aviso_mural();

-- A pendência no pedido de associação: para quem pediu (cada pendência é um aviso novo)
create function interno.notificar_pedido_associacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao <> 'pendencia' or old.situacao = 'pendencia' then
    return null;
  end if;
  perform interno.notificar(
    array[new.pessoa_id], 'pedido', 'O seu pedido tem pendência',
    coalesce(nullif(trim(new.mensagem_pendencia), ''), 'A secretaria pediu uma correção no seu pedido de associação.'),
    '/meu-pedido', 'pedido:' || new.id || ':pendencia:' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'), false, now());
  return null;
end;
$$;
create trigger notificar_pedido_associacao
  after update of situacao on public.pedidos_associacao
  for each row execute function interno.notificar_pedido_associacao();

-- O comprovante de pagamento conferido (confirmado ou recusado): para quem pagou
create function interno.notificar_informe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valor text := interno.em_reais(new.valor);
begin
  if old.situacao <> 'pendente' or new.situacao not in ('confirmado', 'recusado') then
    return null;
  end if;
  if new.situacao = 'confirmado' then
    perform interno.notificar(
      array[new.pessoa_id], 'mensalidade', 'Comprovante conferido',
      'O pagamento de ' || v_valor || ' (' || to_char(new.data_pagamento, 'DD/MM/YYYY') || ') foi confirmado pela tesouraria.',
      '/minhas-mensalidades', 'informe:' || new.id || ':confirmado', false, now());
  else
    perform interno.notificar(
      array[new.pessoa_id], 'mensalidade', 'Comprovante não confirmado',
      'A tesouraria não confirmou o pagamento de ' || v_valor || coalesce(': ' || nullif(trim(new.motivo_recusa), ''), '') || '.',
      '/minhas-mensalidades', 'informe:' || new.id || ':recusado', false, now());
  end if;
  return null;
end;
$$;
create trigger notificar_informe
  after update of situacao on public.informes_pagamento
  for each row execute function interno.notificar_informe();

-- A igreja cadastrada pelo pastor: o item que a secretaria devolveu
create function interno.notificar_item_igreja()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
begin
  if new.situacao <> 'recusado' or old.situacao = 'recusado' then
    return null;
  end if;
  select * into v_igreja from public.igrejas where id = new.igreja_id;
  if v_igreja.cadastrada_por is null then
    return null;
  end if;
  perform interno.notificar(
    array[v_igreja.cadastrada_por], 'documentos', 'A secretaria devolveu um item',
    v_igreja.nome || ': ' || coalesce(new.motivo, 'veja o motivo') || '. Mande de novo só o que voltou.',
    '/cadastrar-minha-igreja', 'igreja-item:' || new.id || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'), false, now());
  return null;
end;
$$;
create trigger notificar_item_igreja
  after update of situacao on public.igreja_analise_itens
  for each row execute function interno.notificar_item_igreja();

-- O documento da igreja que voltou da conferência: para o pastor presidente (ou para quem cadastrou a igreja)
create function interno.notificar_documento_igreja()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v_quem uuid[];
begin
  if new.situacao <> 'recusado' or old.situacao = 'recusado' then
    return null;
  end if;
  select * into v_igreja from public.igrejas where id = new.igreja_id;
  if v_igreja.cadastro = 'em_analise' then
    v_quem := array_remove(array[v_igreja.cadastrada_por], null);
  else
    v_quem := interno.pastores_da_igreja(new.igreja_id) || array_remove(array[new.enviado_por], null);
  end if;
  perform interno.notificar(
    v_quem, 'documentos', 'Um documento voltou da conferência',
    v_igreja.nome || ': ' || coalesce(new.motivo_recusa, 'veja o motivo') || '. Mande o documento de novo.',
    case when v_igreja.cadastro = 'em_analise' then '/cadastrar-minha-igreja' else '/minha-igreja/documentos' end,
    'igreja-doc:' || new.id || ':recusado', false, now());
  return null;
end;
$$;
create trigger notificar_documento_igreja
  after update of situacao on public.igreja_documentos
  for each row execute function interno.notificar_documento_igreja();


-- ---------------------------------------------------------------------
-- 4. Os avisos com data: uma vez por dia
--    O pastor presidente recebe os avisos de 60 e de 30 dias antes de vencer (a responsabilidade é dele) e o
--    aviso da igreja suspensa (urgente: o perfil é bloqueado no fim do prazo).
-- ---------------------------------------------------------------------
create function interno.gerar_avisos_do_dia(p_forcar boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := current_date;
  v_criadas integer := 0;
  v_igreja record;
  v_s jsonb;
  v_ate date;
  v_item text;
  v_dias integer;
  v_marco integer;
  v_nome_item text;
  v_doc text;
  v_vencidos text;
begin
  -- dois ao mesmo tempo não geram em dobro
  perform pg_advisory_xact_lock(hashtext('comep: avisos do dia'));
  if not p_forcar and exists (select 1 from public.config_notificacoes where id and ultimo_dia_gerado = v_hoje) then
    return 0;
  end if;

  for v_igreja in
    select g.id, g.nome from public.igrejas g where g.arquivado_em is null and g.cadastro = 'completo'
  loop
    if cardinality(interno.pastores_da_igreja(v_igreja.id)) = 0 then
      continue;
    end if;
    v_s := interno.situacao_igreja(v_igreja.id, v_hoje);
    if v_s ->> 'situacao' = 'suspensa' and not coalesce((v_s ->> 'perfil_bloqueado')::boolean, false) then
      select string_agg(case x
               when 'estatuto' then 'o estatuto'
               when 'cartao_cnpj' then 'o Cartão CNPJ'
               when 'natureza_juridica' then 'a natureza jurídica'
               when 'ata_diretoria' then 'a ata da diretoria'
               else 'o alvará' end, ', ')
        into v_vencidos
      from jsonb_array_elements_text(v_s -> 'vencidos') x;
      v_criadas := v_criadas + interno.notificar(
        interno.pastores_da_igreja(v_igreja.id), 'documentos', 'A igreja está suspensa',
        v_igreja.nome || ': mande ' || coalesce(v_vencidos, 'o documento vencido') || ' até '
          || to_char((v_s ->> 'prazo_ate')::date, 'DD/MM/YYYY') || '. Depois, o perfil de pastor presidente é bloqueado.',
        '/minha-igreja', 'igreja-suspensa:' || v_igreja.id || ':' || (v_s ->> 'suspensa_desde'), true,
        ((v_s ->> 'suspensa_desde')::date + time '08:00') at time zone 'America/Belem');
    elsif v_s ->> 'situacao' = 'regular' and v_s ->> 'proximo_vencimento' is not null then
      v_ate := (v_s ->> 'proximo_vencimento')::date;
      v_dias := v_ate - v_hoje;
      if v_dias > 60 then
        continue;
      end if;
      v_marco := case when v_dias <= 30 then 30 else 60 end;
      v_item := case
        when v_s ->> 'alvara_ate' = v_s ->> 'proximo_vencimento' then 'alvara'
        when v_s ->> 'mandato_ate' = v_s ->> 'proximo_vencimento' then 'ata_diretoria'
        when v_s ->> 'natureza_prazo' = v_s ->> 'proximo_vencimento' then 'natureza_juridica'
        else v_s -> 'pendencias' ->> 0
      end;
      if v_item is null then
        continue;
      end if;
      v_nome_item := case v_item
        when 'estatuto' then 'Estatuto'
        when 'cartao_cnpj' then 'Cartão CNPJ'
        when 'natureza_juridica' then 'Natureza jurídica'
        when 'ata_diretoria' then 'Ata da diretoria'
        else 'Alvará' end;
      v_doc := case v_item when 'natureza_juridica' then 'cartao_cnpj' else v_item end;
      v_criadas := v_criadas + interno.notificar(
        interno.pastores_da_igreja(v_igreja.id), 'documentos',
        v_nome_item || ' vence ' || case v_dias when 0 then 'hoje' when 1 then 'amanhã' else 'em ' || v_dias || ' dias' end,
        v_igreja.nome || ': vale até ' || to_char(v_ate, 'DD/MM/YYYY')
          || '. Mande o novo antes de vencer: ele entra sozinho no dia certo, e a igreja não fica suspensa.',
        '/minha-igreja/documentos/' || v_doc || '/atualizar',
        'igreja-vence:' || v_igreja.id || ':' || v_item || ':' || v_ate || ':' || v_marco, false,
        ((v_ate - v_marco) + time '08:00') at time zone 'America/Belem');
    end if;
  end loop;

  update public.config_notificacoes set ultimo_dia_gerado = v_hoje where id;
  return v_criadas;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O sino: as minhas notificações e o lido
-- ---------------------------------------------------------------------
create function interno.minhas_notificacoes(p_limite integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if v_eu is null then
    return jsonb_build_object('itens', '[]'::jsonb, 'nao_lidas', 0);
  end if;
  perform interno.gerar_avisos_do_dia();
  return jsonb_build_object(
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'tipo', n.tipo, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'urgente', n.urgente,
        'quando', n.quando, 'lida_em', n.lida_em,
        'enviada_por', (select nome from public.pessoas where id = n.enviada_por)
      ) order by n.quando desc, n.criado_em desc)
      from (
        select * from public.notificacoes
        where pessoa_id = v_eu and arquivado_em is null
        order by quando desc, criado_em desc
        limit greatest(1, least(coalesce(p_limite, 30), 100))
      ) n
    ), '[]'::jsonb),
    'nao_lidas', (select count(*) from public.notificacoes where pessoa_id = v_eu and arquivado_em is null and lida_em is null)
  );
end;
$$;

-- Marca como lidas (só as minhas); null = todas
create function interno.marcar_notificacoes_lidas(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_n integer;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver os seus avisos.' using errcode = '42501';
  end if;
  update public.notificacoes
  set lida_em = now()
  where pessoa_id = v_eu and lida_em is null and arquivado_em is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. As preferências e os aparelhos
-- ---------------------------------------------------------------------
create function interno.minhas_preferencias_avisos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_pref public.notificacao_preferencias;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver as suas preferências.' using errcode = '42501';
  end if;
  select * into v_pref from public.notificacao_preferencias where pessoa_id = v_eu and arquivado_em is null;
  return jsonb_build_object(
    'ativou_em', v_pref.ativou_em,
    'recusou_em', v_pref.recusou_em,
    'tipos_desligados', to_jsonb(coalesce(v_pref.tipos_desligados, '{}'::text[])),
    'silencio_noite', coalesce(v_pref.silencio_noite, true),
    'aparelhos', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'endpoint', i.endpoint, 'aparelho', i.aparelho, 'criado_em', i.criado_em,
                                          'ultimo_envio_em', i.ultimo_envio_em) order by i.criado_em desc)
      from public.inscricoes_push i where i.pessoa_id = v_eu and i.arquivado_em is null
    ), '[]'::jsonb)
  );
end;
$$;

-- p_dados: { "resposta": "ativar" | "agora_nao" (opcional), "tipos_desligados": [...] (opcional), "silencio_noite": bool (opcional) }
create function interno.salvar_preferencias_avisos(p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_tipos text[];
begin
  if v_eu is null then
    raise exception 'Entre no sistema para escolher os seus avisos.' using errcode = '42501';
  end if;
  if p_dados ? 'resposta' and p_dados ->> 'resposta' not in ('ativar', 'agora_nao') then
    raise exception 'Resposta inválida.' using errcode = 'P0001';
  end if;
  if p_dados ? 'tipos_desligados' then
    if jsonb_typeof(p_dados -> 'tipos_desligados') <> 'array' then
      raise exception 'A lista do que não chega está num formato inválido.' using errcode = 'P0001';
    end if;
    select coalesce(array_agg(distinct t), '{}') into v_tipos from jsonb_array_elements_text(p_dados -> 'tipos_desligados') t;
    if not v_tipos <@ array['assembleias', 'votacoes', 'mural', 'mensalidade', 'documentos']::text[] then
      raise exception 'Assunto de aviso desconhecido.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.notificacao_preferencias (pessoa_id) values (v_eu)
  on conflict (pessoa_id) where arquivado_em is null do nothing;

  update public.notificacao_preferencias
  set ativou_em = case p_dados ->> 'resposta' when 'ativar' then coalesce(ativou_em, now()) when 'agora_nao' then null else ativou_em end,
      recusou_em = case p_dados ->> 'resposta' when 'agora_nao' then now() when 'ativar' then null else recusou_em end,
      tipos_desligados = coalesce(v_tipos, tipos_desligados),
      silencio_noite = coalesce((p_dados ->> 'silencio_noite')::boolean, silencio_noite)
  where pessoa_id = v_eu and arquivado_em is null;
end;
$$;

-- Este aparelho passa a receber os avisos (o mesmo endereço, se era de outra pessoa, passa para quem entrou agora)
create function interno.registrar_inscricao_push(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_id uuid;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para receber os avisos neste aparelho.' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'O navegador não deu um endereço válido para os avisos.' using errcode = 'P0001';
  end if;
  select id into v_id from public.inscricoes_push where endpoint = p_endpoint and pessoa_id = v_eu and arquivado_em is null;
  if found then
    update public.inscricoes_push
    set p256dh = p_p256dh, auth = p_auth, aparelho = left(nullif(trim(p_aparelho), ''), 120), falhas = 0
    where id = v_id;
  else
    update public.inscricoes_push set arquivado_em = now(), motivo_arquivo = 'outra_pessoa'
    where endpoint = p_endpoint and arquivado_em is null;
    insert into public.inscricoes_push (pessoa_id, endpoint, p256dh, auth, aparelho)
    values (v_eu, p_endpoint, p_p256dh, p_auth, left(nullif(trim(p_aparelho), ''), 120))
    returning id into v_id;
  end if;
  perform interno.salvar_preferencias_avisos('{"resposta": "ativar"}'::jsonb);
  return v_id;
end;
$$;

-- Este aparelho (ou um dos meus aparelhos, pelo id) para de receber
create function interno.cancelar_inscricao_push(p_endpoint text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if v_eu is null then
    raise exception 'Entre no sistema para mudar os seus avisos.' using errcode = '42501';
  end if;
  update public.inscricoes_push
  set arquivado_em = now(), motivo_arquivo = 'saiu'
  where pessoa_id = v_eu and arquivado_em is null
    and ((p_endpoint is not null and endpoint = p_endpoint) or (p_id is not null and id = p_id));
end;
$$;


-- ---------------------------------------------------------------------
-- 7. A secretaria fala com a pessoa: o recado pelo aplicativo e o "Lembrar todos"
-- ---------------------------------------------------------------------
-- "Mandar pelo aplicativo" (ao lado do WhatsApp, na ficha do ministro): a mesma mensagem, no sino e no celular
create function interno.mandar_recado(p_pessoa_id uuid, p_tipo text, p_titulo text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')) then
    raise exception 'Só a secretaria, a tesouraria e a presidência mandam recados pelo aplicativo.' using errcode = '42501';
  end if;
  if p_tipo not in ('recado', 'mensalidade', 'assembleias', 'documentos') then
    raise exception 'Assunto de recado inválido.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 5 then
    raise exception 'Escreva a mensagem.' using errcode = 'P0001';
  end if;
  if length(p_texto) > 1000 then
    raise exception 'A mensagem passou de 1.000 letras: encurte um pouco.' using errcode = 'P0001';
  end if;
  if p_pessoa_id = v_eu then
    raise exception 'O recado é para outra pessoa.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.pessoas where id = p_pessoa_id and arquivado_em is null) then
    raise exception 'Pessoa não encontrada.' using errcode = 'P0001';
  end if;
  insert into public.notificacoes (pessoa_id, tipo, titulo, texto, link, enviada_por)
  values (p_pessoa_id, p_tipo, left(coalesce(nullif(trim(p_titulo), ''), 'Recado da secretaria'), 120), trim(p_texto),
          case p_tipo when 'mensalidade' then '/minhas-mensalidades' when 'assembleias' then '/assembleias'
                      when 'documentos' then '/minha-igreja' else null end,
          v_eu)
  returning id into v_id;
  return v_id;
end;
$$;

-- "Lembrar todos" (Financeiro › Contribuições): quem está em atraso e ainda não mandou o comprovante.
-- Uma vez por dia para cada pessoa (apertar de novo no mesmo dia não repete).
create function interno.lembrar_contribuicoes_em_atraso()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_criadas integer := 0;
  v_pessoa record;
begin
  if not (select interno.tenho_perfil('tesouraria', 'presidencia')) then
    raise exception 'Só a tesouraria e a presidência mandam o lembrete das contribuições.' using errcode = '42501';
  end if;
  for v_pessoa in
    select a.pessoa_id,
           count(c.id) as vencidas,
           min(c.competencia) as desde
    from public.associados a
    join public.pessoas p on p.id = a.pessoa_id and p.arquivado_em is null
    join public.cobrancas c on c.pessoa_id = a.pessoa_id and c.situacao = 'aberta' and c.vencimento < current_date and c.arquivado_em is null
    where a.arquivado_em is null and a.situacao = 'ativo'
      and not exists (select 1 from public.informes_pagamento i where i.pessoa_id = a.pessoa_id and i.situacao = 'pendente' and i.arquivado_em is null)
    group by a.pessoa_id
  loop
    v_criadas := v_criadas + interno.notificar(
      array[v_pessoa.pessoa_id], 'mensalidade', 'Contribuição em atraso',
      case when v_pessoa.vencidas = 1 then 'Você tem 1 contribuição vencida' else 'Você tem ' || v_pessoa.vencidas || ' contribuições vencidas' end
        || ', desde ' || interno.mes_por_extenso(v_pessoa.desde)
        || '. Em Minhas mensalidades você vê os valores e manda o comprovante.',
      '/minhas-mensalidades', 'lembrete-contribuicao:' || v_pessoa.pessoa_id || ':' || current_date, false, now(), v_eu);
  end loop;
  return v_criadas;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. O envio pelo navegador (push): o que mandar e o resultado
--    Quem envia é a função supabase/functions/enviar-avisos (com a chave secreta, nunca pelo aplicativo).
-- ---------------------------------------------------------------------
-- O que mandar agora: só para quem ativou, o assunto que a pessoa quer, fora do silêncio da noite (menos o
-- urgente), ainda não lido, dos últimos 3 dias, em cada aparelho inscrito.
create function interno.push_pendentes(p_limite integer default 200)
returns table (
  notificacao_id uuid,
  inscricao_id   uuid,
  endpoint       text,
  p256dh         text,
  auth           text,
  titulo         text,
  texto          text,
  link           text,
  urgente        boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hora time := (now() at time zone 'America/Belem')::time;
  v_noite boolean := v_hora >= time '22:00' or v_hora < time '07:00';
begin
  perform interno.gerar_avisos_do_dia();
  return query
  select n.id, i.id, i.endpoint, i.p256dh, i.auth, n.titulo, n.texto, n.link, n.urgente
  from public.notificacoes n
  join public.notificacao_preferencias pr on pr.pessoa_id = n.pessoa_id and pr.arquivado_em is null and pr.ativou_em is not null
  join public.inscricoes_push i on i.pessoa_id = n.pessoa_id and i.arquivado_em is null
  where n.arquivado_em is null and n.push_enviado_em is null and n.lida_em is null
    and n.quando > now() - interval '3 days' and n.push_tentativas < 5
    and not (n.tipo = any (pr.tipos_desligados))
    and (n.urgente or not (pr.silencio_noite and v_noite))
  order by n.quando
  limit greatest(1, least(coalesce(p_limite, 200), 1000));
end;
$$;

-- O resultado de cada envio: [{ "notificacao_id", "inscricao_id", "ok": bool, "status": número }]
-- 404 e 410 = a inscrição acabou (a pessoa desinstalou ou bloqueou): ela é arquivada.
create function interno.push_resultado(p_resultados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r jsonb;
begin
  if jsonb_typeof(p_resultados) <> 'array' then
    raise exception 'Resultado do envio em formato inválido.' using errcode = 'P0001';
  end if;
  for v_r in select * from jsonb_array_elements(p_resultados) loop
    if (v_r ->> 'ok')::boolean then
      update public.notificacoes set push_enviado_em = coalesce(push_enviado_em, now())
      where id = (v_r ->> 'notificacao_id')::uuid;
      update public.inscricoes_push set ultimo_envio_em = now(), falhas = 0
      where id = (v_r ->> 'inscricao_id')::uuid;
    else
      update public.notificacoes set push_tentativas = push_tentativas + 1
      where id = (v_r ->> 'notificacao_id')::uuid and push_enviado_em is null;
      if coalesce((v_r ->> 'status')::integer, 0) in (404, 410) then
        update public.inscricoes_push set arquivado_em = now(), motivo_arquivo = 'expirou'
        where id = (v_r ->> 'inscricao_id')::uuid and arquivado_em is null;
      else
        update public.inscricoes_push
        set falhas = falhas + 1,
            arquivado_em = case when falhas + 1 >= 20 then now() end,
            motivo_arquivo = case when falhas + 1 >= 20 then 'falhou' end
        where id = (v_r ->> 'inscricao_id')::uuid and arquivado_em is null;
      end if;
    end if;
  end loop;
end;
$$;

-- Administração › Avisos e notificações: quantos ativaram, os aparelhos e o último envio
create function interno.situacao_dos_avisos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')) then
    raise exception 'Só a secretaria, a presidência e o administrador técnico veem a situação dos avisos.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pessoas', cardinality(interno.pessoas_do_comep()),
    'ativaram', (select count(*) from public.notificacao_preferencias where arquivado_em is null and ativou_em is not null),
    'recusaram', (select count(*) from public.notificacao_preferencias where arquivado_em is null and ativou_em is null and recusou_em is not null),
    'aparelhos', (select count(*) from public.inscricoes_push where arquivado_em is null),
    'pessoas_com_aparelho', (select count(distinct pessoa_id) from public.inscricoes_push where arquivado_em is null),
    'ultimo_envio', (select max(push_enviado_em) from public.notificacoes),
    'esperando_envio', (select count(*) from public.notificacoes n
                        where n.push_enviado_em is null and n.lida_em is null and n.arquivado_em is null
                          and n.quando > now() - interval '3 days'
                          and exists (select 1 from public.inscricoes_push i where i.pessoa_id = n.pessoa_id and i.arquivado_em is null)),
    'notificacoes_7_dias', (select count(*) from public.notificacoes where criado_em > now() - interval '7 days')
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 9. O que já está aberto hoje entra no sino (as mesmas regras do sino de antes)
-- ---------------------------------------------------------------------
do $$
declare
  v record;
  v_aptos uuid[];
begin
  -- as votações abertas
  for v in select * from public.votacoes where situacao = 'aberta' and arquivado_em is null and (fecha_em is null or fecha_em > now()) loop
    select coalesce(array_agg(a.pessoa_id), '{}') into v_aptos
    from public.associados a
    where a.arquivado_em is null and a.situacao = 'ativo' and interno.pode_votar(v.id, a.pessoa_id)
      and not exists (select 1 from public.votacao_votantes vv where vv.votacao_id = v.id and vv.pessoa_id = a.pessoa_id);
    perform interno.notificar(v_aptos, 'votacoes', case v.tipo when 'enquete' then 'Enquete aberta' else 'Votação aberta' end,
      v.titulo || case when v.fecha_em is not null then '. Vote até ' || interno.dia_mes(v.fecha_em) || ', às ' || interno.hora_curta(v.fecha_em) || '.' else '.' end,
      '/votacoes/' || v.id, 'votacao:' || v.id, false, coalesce(v.aberta_em, v.criado_em));
  end loop;
  -- os pedidos de AGE colhendo assinaturas
  for v in select * from public.pedidos_age where situacao = 'coletando' and arquivado_em is null and prazo >= current_date loop
    select coalesce(array_agg(distinct a.pessoa_id), '{}') into v_aptos
    from public.associados a
    where a.arquivado_em is null and a.situacao = 'ativo' and a.pessoa_id <> v.autor_id
      and (interno.associado_apto(a.pessoa_id) or interno.do_conselho_diretor(a.pessoa_id))
      and not exists (select 1 from public.pedido_age_assinaturas s
                      where s.pedido_id = v.id and s.pessoa_id = a.pessoa_id and s.arquivado_em is null and s.retirada_em is null);
    perform interno.notificar(v_aptos, 'assembleias', 'Pedido de AGE',
      v.titulo || ': falta a sua assinatura (até ' || to_char(v.prazo, 'DD/MM/YYYY') || ').',
      '/assembleias/pedidos/' || v.id, 'age:' || v.id, false, v.criado_em);
  end loop;
  -- as assembleias e reuniões convocadas que ainda vão acontecer
  for v in select * from public.encontros where situacao = 'convocado' and arquivado_em is null and inicio >= now() loop
    perform interno.notificar(interno.associados_ativos(), 'assembleias',
      case v.tipo when 'reuniao_mensal' then 'Reunião mensal convocada' when 'ago' then 'AGO convocada' else 'AGE convocada' end,
      case v.tipo when 'reuniao_mensal' then 'Reunião mensal' when 'ago' then 'Assembleia Geral Ordinária' else 'Assembleia Geral Extraordinária' end
        || ' em ' || interno.dia_mes(v.inicio) || ', às ' || interno.hora_curta(v.inicio) || ', ' || v.local || '. Confirme a presença.',
      '/assembleias/' || v.id, 'encontro:' || v.id, false, coalesce(v.convocado_em, v.criado_em));
  end loop;
  -- os avisos do mural que ainda valem
  for v in select * from public.avisos where arquivado_em is null and (valido_ate is null or valido_ate >= current_date) loop
    perform interno.notificar(array(select x from unnest(interno.pessoas_do_comep()) x where v.autor_id is null or x <> v.autor_id),
      'mural', 'Aviso no mural', v.titulo, '/avisos', 'aviso:' || v.id, false, v.criado_em);
  end loop;
  -- os pedidos de associação com pendência
  for v in select * from public.pedidos_associacao where situacao = 'pendencia' and arquivado_em is null loop
    perform interno.notificar(array[v.pessoa_id], 'pedido', 'O seu pedido tem pendência',
      coalesce(nullif(trim(v.mensagem_pendencia), ''), 'A secretaria pediu uma correção no seu pedido de associação.'),
      '/meu-pedido', 'pedido:' || v.id || ':pendencia:inicio', false, coalesce(v.enviado_em, v.criado_em));
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 10. Funções pela API (finas; quem confere é a função interna)
-- ---------------------------------------------------------------------
create function public.minhas_notificacoes(p_limite integer default 30)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.minhas_notificacoes(p_limite); $$;
create function public.marcar_notificacoes_lidas(p_ids uuid[] default null)
returns integer language sql security invoker set search_path = '' as $$ select interno.marcar_notificacoes_lidas(p_ids); $$;
create function public.minhas_preferencias_avisos()
returns jsonb language sql security invoker set search_path = '' as $$ select interno.minhas_preferencias_avisos(); $$;
create function public.salvar_preferencias_avisos(p_dados jsonb)
returns void language sql security invoker set search_path = '' as $$ select interno.salvar_preferencias_avisos(p_dados); $$;
create function public.registrar_inscricao_push(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.registrar_inscricao_push(p_endpoint, p_p256dh, p_auth, p_aparelho); $$;
create function public.cancelar_inscricao_push(p_endpoint text default null, p_id uuid default null)
returns void language sql security invoker set search_path = '' as $$ select interno.cancelar_inscricao_push(p_endpoint, p_id); $$;
create function public.mandar_recado(p_pessoa_id uuid, p_tipo text, p_titulo text, p_texto text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.mandar_recado(p_pessoa_id, p_tipo, p_titulo, p_texto); $$;
create function public.lembrar_contribuicoes_em_atraso()
returns integer language sql security invoker set search_path = '' as $$ select interno.lembrar_contribuicoes_em_atraso(); $$;
create function public.situacao_dos_avisos()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.situacao_dos_avisos(); $$;
-- só para o envio (a chave secreta, na função supabase/functions/enviar-avisos)
create function public.push_pendentes(p_limite integer default 200)
returns table (notificacao_id uuid, inscricao_id uuid, endpoint text, p256dh text, auth text, titulo text, texto text, link text, urgente boolean)
language sql security invoker set search_path = '' as $$ select * from interno.push_pendentes(p_limite); $$;
create function public.push_resultado(p_resultados jsonb)
returns void language sql security invoker set search_path = '' as $$ select interno.push_resultado(p_resultados); $$;


-- ---------------------------------------------------------------------
-- 11. Permissões e regras de acesso
-- ---------------------------------------------------------------------
-- os ajudantes internos e os gatilhos: só as funções do banco chamam
revoke all on function interno.dia_mes(timestamptz) from public;
revoke all on function interno.hora_curta(timestamptz) from public;
revoke all on function interno.em_reais(numeric) from public;
revoke all on function interno.mes_por_extenso(date) from public;
revoke all on function interno.notificar(uuid[], text, text, text, text, text, boolean, timestamptz, uuid) from public;
revoke all on function interno.associados_ativos() from public;
revoke all on function interno.pessoas_do_comep() from public;
revoke all on function interno.pastores_da_igreja(uuid) from public;
revoke all on function interno.notificar_encontro() from public;
revoke all on function interno.notificar_votacao() from public;
revoke all on function interno.notificar_pedido_age() from public;
revoke all on function interno.notificar_aviso_mural() from public;
revoke all on function interno.notificar_pedido_associacao() from public;
revoke all on function interno.notificar_informe() from public;
revoke all on function interno.notificar_item_igreja() from public;
revoke all on function interno.notificar_documento_igreja() from public;
revoke all on function interno.gerar_avisos_do_dia(boolean) from public;

revoke all on function interno.minhas_notificacoes(integer) from public;
revoke all on function interno.marcar_notificacoes_lidas(uuid[]) from public;
revoke all on function interno.minhas_preferencias_avisos() from public;
revoke all on function interno.salvar_preferencias_avisos(jsonb) from public;
revoke all on function interno.registrar_inscricao_push(text, text, text, text) from public;
revoke all on function interno.cancelar_inscricao_push(text, uuid) from public;
revoke all on function interno.mandar_recado(uuid, text, text, text) from public;
revoke all on function interno.lembrar_contribuicoes_em_atraso() from public;
revoke all on function interno.situacao_dos_avisos() from public;
revoke all on function interno.push_pendentes(integer) from public;
revoke all on function interno.push_resultado(jsonb) from public;
grant execute on function interno.minhas_notificacoes(integer) to authenticated;
grant execute on function interno.marcar_notificacoes_lidas(uuid[]) to authenticated;
grant execute on function interno.minhas_preferencias_avisos() to authenticated;
grant execute on function interno.salvar_preferencias_avisos(jsonb) to authenticated;
grant execute on function interno.registrar_inscricao_push(text, text, text, text) to authenticated;
grant execute on function interno.cancelar_inscricao_push(text, uuid) to authenticated;
grant execute on function interno.mandar_recado(uuid, text, text, text) to authenticated;
grant execute on function interno.lembrar_contribuicoes_em_atraso() to authenticated;
grant execute on function interno.situacao_dos_avisos() to authenticated;
-- o envio usa a chave secreta (service_role): só ele lista os endereços dos aparelhos
grant usage on schema interno to service_role;
grant execute on function interno.push_pendentes(integer) to service_role;
grant execute on function interno.push_resultado(jsonb) to service_role;

revoke all on function public.minhas_notificacoes(integer) from public, anon;
revoke all on function public.marcar_notificacoes_lidas(uuid[]) from public, anon;
revoke all on function public.minhas_preferencias_avisos() from public, anon;
revoke all on function public.salvar_preferencias_avisos(jsonb) from public, anon;
revoke all on function public.registrar_inscricao_push(text, text, text, text) from public, anon;
revoke all on function public.cancelar_inscricao_push(text, uuid) from public, anon;
revoke all on function public.mandar_recado(uuid, text, text, text) from public, anon;
revoke all on function public.lembrar_contribuicoes_em_atraso() from public, anon;
revoke all on function public.situacao_dos_avisos() from public, anon;
revoke all on function public.push_pendentes(integer) from public, anon, authenticated;
revoke all on function public.push_resultado(jsonb) from public, anon, authenticated;
grant execute on function public.minhas_notificacoes(integer) to authenticated;
grant execute on function public.marcar_notificacoes_lidas(uuid[]) to authenticated;
grant execute on function public.minhas_preferencias_avisos() to authenticated;
grant execute on function public.salvar_preferencias_avisos(jsonb) to authenticated;
grant execute on function public.registrar_inscricao_push(text, text, text, text) to authenticated;
grant execute on function public.cancelar_inscricao_push(text, uuid) to authenticated;
grant execute on function public.mandar_recado(uuid, text, text, text) to authenticated;
grant execute on function public.lembrar_contribuicoes_em_atraso() to authenticated;
grant execute on function public.situacao_dos_avisos() to authenticated;
grant execute on function public.push_pendentes(integer) to service_role;
grant execute on function public.push_resultado(jsonb) to service_role;

-- Tabelas: cada um lê só o que é seu; gravar, só pelas funções
revoke all on public.notificacoes, public.notificacao_preferencias, public.inscricoes_push, public.config_notificacoes from anon, authenticated;
grant select on public.notificacoes, public.notificacao_preferencias, public.inscricoes_push to authenticated;

alter table public.notificacoes enable row level security;
alter table public.notificacao_preferencias enable row level security;
alter table public.inscricoes_push enable row level security;
alter table public.config_notificacoes enable row level security;

create policy "notificações: cada um lê as suas"
  on public.notificacoes for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()));
create policy "preferências dos avisos: cada um lê as suas"
  on public.notificacao_preferencias for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()));
create policy "aparelhos dos avisos: cada um lê os seus"
  on public.inscricoes_push for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()));
