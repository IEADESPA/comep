-- =====================================================================
-- Telas novas, parte 13 (Fase 5.5): a privacidade — o termo de uso de dados (LGPD), com versão e aceite
-- (rodadas 19 e 20, aprovadas em 19/11/2026: a tela inteira logo depois de entrar, o resumo em 9 pontos, o dado
-- sensível da fé com o consentimento destacado, o opcional como escolha separada e o termo completo em 10 partes,
-- que é uma MINUTA: a diretoria e um advogado conferem antes de valer de verdade).
--
--   * cada versão do termo: o resumo, as partes, o que mudou e a data em que passa a valer. A versão publicada
--     não muda nem se apaga; para mudar, escreve-se uma versão nova, e todos aceitam de novo;
--   * o aceite guarda a versão, a data, a hora, o aparelho e o consentimento do dado sensível (LGPD, art. 11, I);
--   * as escolhas opcionais (receber avisos pelo WhatsApp e aparecer na lista de aniversariantes);
--   * Meu perfil › Privacidade: o termo aceito, os meus dados para baixar, o pedido de exclusão e quem mexeu nos
--     meus dados (da auditoria que já existe);
--   * a secretaria: as versões, quem aceitou, o lembrete e os pedidos de exclusão.
-- Quem lê o termo: quem é do COMEP (tem algum perfil). O candidato à associação dá o consentimento no pedido.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table public.termos_uso (
  id            uuid primary key default gen_random_uuid(),
  versao        integer not null check (versao > 0),
  -- o resumo em pontos: [{ "icone", "titulo", "texto" }]
  resumo        jsonb not null check (jsonb_typeof(resumo) = 'array' and jsonb_array_length(resumo) between 1 and 20),
  -- o termo completo, em partes: [{ "titulo", "texto" }]
  partes        jsonb not null check (jsonb_typeof(partes) = 'array' and jsonb_array_length(partes) between 1 and 30),
  -- o que mudou em relação à versão anterior
  mudancas      text[] not null default '{}',
  -- minuta: o texto ainda precisa da revisão de um advogado
  minuta        boolean not null default true,
  vale_a_partir date not null,
  publicado_em  timestamptz,
  publicado_por uuid references public.pessoas (id),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.termos_uso is
  'As versões do termo de uso de dados (LGPD). Publicada, a versão não muda nem se apaga; mudar = versão nova, e todos aceitam de novo.';
create unique index termos_uso_versao on public.termos_uso (versao) where arquivado_em is null;
create unique index termos_uso_um_rascunho on public.termos_uso ((true)) where publicado_em is null and arquivado_em is null;
create index termos_uso_publicado_por on public.termos_uso (publicado_por);
select interno.aplicar_padroes('public.termos_uso');

create table public.termo_aceites (
  id            uuid primary key default gen_random_uuid(),
  termo_id      uuid not null references public.termos_uso (id),
  pessoa_id     uuid not null references public.pessoas (id),
  aceito_em     timestamptz not null default now(),
  -- só para a pessoa reconhecer ("Celular · Chrome")
  aparelho      text check (aparelho is null or length(aparelho) <= 120),
  -- o consentimento específico e destacado do dado sensível (a fé: LGPD, art. 5º, II, e art. 11, I)
  dado_sensivel boolean not null check (dado_sensivel),
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.termo_aceites is 'Quem aceitou cada versão do termo: a data, a hora, o aparelho e o consentimento do dado sensível.';
create unique index termo_aceites_um on public.termo_aceites (termo_id, pessoa_id) where arquivado_em is null;
create index termo_aceites_pessoa on public.termo_aceites (pessoa_id);
select interno.aplicar_padroes('public.termo_aceites');

create table public.privacidade_escolhas (
  id                       uuid primary key default gen_random_uuid(),
  pessoa_id                uuid not null references public.pessoas (id),
  receber_whatsapp         boolean not null default true,
  aparecer_aniversariantes boolean not null default false,
  arquivado_em             timestamptz,
  criado_por               uuid default auth.uid(),
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz not null default now()
);
comment on table public.privacidade_escolhas is 'O que é opcional (LGPD, art. 7º, I): receber avisos pelo WhatsApp e aparecer na lista de aniversariantes.';
create unique index privacidade_escolhas_pessoa on public.privacidade_escolhas (pessoa_id) where arquivado_em is null;
select interno.aplicar_padroes('public.privacidade_escolhas');

create table public.pedidos_titular (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references public.pessoas (id),
  tipo           text not null check (tipo in ('exclusao')),
  texto          text not null check (length(trim(texto)) between 3 and 2000),
  situacao       text not null default 'pendente' check (situacao in ('pendente', 'atendido', 'recusado')),
  resposta       text check (resposta is null or length(trim(resposta)) between 3 and 2000),
  respondido_por uuid references public.pessoas (id),
  respondido_em  timestamptz,
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint pedidos_titular_resposta check ((situacao = 'pendente') = (respondido_em is null) and (situacao = 'pendente') = (resposta is null))
);
comment on table public.pedidos_titular is
  'Os pedidos do titular dos dados (LGPD, art. 18): a exclusão. A correção usa os pedidos de correção do cadastro.';
create index pedidos_titular_pessoa on public.pedidos_titular (pessoa_id);
create index pedidos_titular_pendentes on public.pedidos_titular (criado_em) where situacao = 'pendente' and arquivado_em is null;
create index pedidos_titular_respondido_por on public.pedidos_titular (respondido_por);
select interno.aplicar_padroes('public.pedidos_titular');


-- ---------------------------------------------------------------------
-- 2. A versão publicada não muda (o rascunho, sim)
-- ---------------------------------------------------------------------
create function interno.proteger_termo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.publicado_em is not null then
    raise exception 'A versão publicada do termo não muda nem se apaga: escreva uma versão nova.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger proteger_termo
  before update on public.termos_uso
  for each row execute function interno.proteger_termo();

-- O aceite também não muda: fica como foi dado
create function interno.proteger_aceite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'O aceite do termo fica como foi dado (a versão, a data, a hora e o aparelho).' using errcode = 'P0001';
end;
$$;
create trigger proteger_aceite
  before update on public.termo_aceites
  for each row execute function interno.proteger_aceite();


-- ---------------------------------------------------------------------
-- 3. A primeira versão (minuta das rodadas 19 e 20), valendo a partir de hoje
-- ---------------------------------------------------------------------
insert into public.termos_uso (versao, resumo, partes, mudancas, minuta, vale_a_partir, publicado_em)
values (
  1,
  jsonb_build_array(
    jsonb_build_object('icone', 'escudo', 'titulo', 'Quem cuida dos seus dados', 'texto',
      'O COMEP. Quem responde por isso (o encarregado) é a secretaria, pelos contatos do COMEP no site ou na sede.'),
    jsonb_build_object('icone', 'texto', 'titulo', 'O que guardamos', 'texto',
      'Nome, CPF, nascimento, contatos, igreja, título, foto da credencial e pagamentos.'),
    jsonb_build_object('icone', 'alerta', 'titulo', 'Um dado sensível: a sua fé', 'texto',
      'O cadastro mostra que você é ministro evangélico. A lei trata a religião como dado sensível; por isso o aceite é separado e em destaque.'),
    jsonb_build_object('icone', 'check', 'titulo', 'Para quê', 'texto',
      'O cadastro e a credencial, as contribuições, as assembleias, os avisos e a regularização das igrejas.'),
    jsonb_build_object('icone', 'olho', 'titulo', 'Quem vê', 'texto',
      'A secretaria, a tesouraria, a diretoria e o conselho fiscal, cada um só o que precisa. O COMEP não vende nem repassa os seus dados.'),
    jsonb_build_object('icone', 'igreja', 'titulo', 'O que fica público', 'texto',
      'Só o nome do pastor presidente com a igreja, e a conferência da credencial pelo QR Code.'),
    jsonb_build_object('icone', 'cadeado', 'titulo', 'Onde e como guardamos', 'texto',
      'Num serviço de nuvem contratado pelo COMEP, com acesso por senha, cópia de segurança e o registro de quem mexeu em quê.'),
    jsonb_build_object('icone', 'relogio', 'titulo', 'Por quanto tempo', 'texto',
      'Enquanto você for associado. Depois, só o que a lei manda guardar, como os pagamentos; o resto é apagado ou tornado anônimo.'),
    jsonb_build_object('icone', 'perfil', 'titulo', 'Os seus direitos', 'texto',
      'Ver, corrigir e levar os seus dados, pedir a exclusão e retirar o aceite do que é opcional, em Meu perfil › Privacidade.')
  ),
  jsonb_build_array(
    jsonb_build_object('titulo', '1. Quem somos e como falar conosco', 'texto',
      'O Conselho de Ministros Evangélicos de Parauapebas (COMEP) é o controlador dos seus dados: é ele quem decide como os dados são usados. O encarregado pelo tratamento é a secretaria do COMEP, pelos contatos publicados no site do COMEP ou na sede.'),
    jsonb_build_object('titulo', '2. Que dados tratamos', 'texto',
      'Do cadastro: nome, CPF, data de nascimento, contatos, igreja, título ministerial e foto da credencial. Da vida no COMEP: contribuições e comprovantes, presença nas assembleias, pedidos e documentos enviados. Do uso do sistema: a data, a hora e o aparelho de cada acesso, para a sua segurança.'),
    jsonb_build_object('titulo', '3. Um dado sensível: a sua fé', 'texto',
      'Por ser um conselho de ministros evangélicos, o cadastro revela a sua convicção religiosa, que a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) chama de dado sensível. Por isso o seu consentimento é pedido de forma específica e destacada (art. 11, I), e esse dado só é usado para o que está neste termo.'),
    jsonb_build_object('titulo', '4. Para que usamos e com base em quê', 'texto',
      'Para manter o seu cadastro, emitir a credencial e cumprir o estatuto, porque é o que a sua associação ao COMEP exige (art. 7º, V). Para guardar os pagamentos e prestar contas, por obrigação legal e contábil (art. 7º, II). Para dar segurança ao sistema e evitar fraudes (art. 7º, IX). E o que é opcional, só com o seu consentimento, que pode ser retirado quando você quiser (art. 7º, I).'),
    jsonb_build_object('titulo', '5. Com quem compartilhamos', 'texto',
      'Dentro do COMEP, cada função vê só o que precisa. Fora dele, só os serviços contratados para o sistema funcionar (como o banco de dados na nuvem e o envio de avisos), que seguem as instruções do COMEP. Quando a lei ou um juiz exigir, entregamos o que for pedido. O COMEP não vende nem repassa dados.'),
    jsonb_build_object('titulo', '6. Onde e como guardamos', 'texto',
      'Num serviço de nuvem que pode ter servidores fora do Brasil, com as garantias que a lei pede (art. 33). O acesso é por senha. Há cópias de segurança e o registro de quem mexeu em quê.'),
    jsonb_build_object('titulo', '7. Por quanto tempo', 'texto',
      'Enquanto você for associado. Ao sair, os seus dados são apagados ou tornados anônimos, menos o que a lei manda guardar, como os pagamentos, pelo prazo que ela exige.'),
    jsonb_build_object('titulo', '8. Os seus direitos', 'texto',
      'A qualquer momento você pode: confirmar que tratamos os seus dados e vê-los; corrigir o que estiver errado; levar os seus dados; pedir a exclusão do que não for obrigatório guardar; saber com quem compartilhamos; e retirar o consentimento do que é opcional (art. 18). Faça isso em Meu perfil › Privacidade ou com a secretaria. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).'),
    jsonb_build_object('titulo', '9. O que é opcional', 'texto',
      'Receber avisos pelo WhatsApp e aparecer na lista de aniversariantes. Você liga e desliga em Meu perfil › Privacidade, sem perder nada do resto.'),
    jsonb_build_object('titulo', '10. Mudanças neste termo', 'texto',
      'Quando o termo mudar, você verá a versão nova com a lista do que mudou, e o sistema pedirá o seu aceite de novo. Cada versão aceita fica guardada com a data, a hora e o aparelho.')
  ),
  '{}',
  true,
  current_date,
  now()
);


-- ---------------------------------------------------------------------
-- 4. O meu termo: a versão que vale, a próxima (publicada, para depois) e o aceite
-- ---------------------------------------------------------------------
create function interno.termo_json(p_termo public.termos_uso, p_pessoa uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_termo.id is null then null else jsonb_build_object(
    'id', p_termo.id, 'versao', p_termo.versao, 'resumo', p_termo.resumo, 'partes', p_termo.partes,
    'mudancas', to_jsonb(p_termo.mudancas), 'minuta', p_termo.minuta, 'vale_a_partir', p_termo.vale_a_partir,
    'publicado_em', p_termo.publicado_em,
    'aceite', (select jsonb_build_object('aceito_em', a.aceito_em, 'aparelho', a.aparelho)
               from public.termo_aceites a where a.termo_id = p_termo.id and a.pessoa_id = p_pessoa and a.arquivado_em is null)
  ) end;
$$;

create function interno.meu_termo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_atual public.termos_uso;
  v_proxima public.termos_uso;
  v_j_atual jsonb;
  v_j_proxima jsonb;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver o termo.' using errcode = '42501';
  end if;
  select * into v_atual from public.termos_uso
  where publicado_em is not null and arquivado_em is null and vale_a_partir <= current_date
  order by versao desc limit 1;
  select * into v_proxima from public.termos_uso
  where publicado_em is not null and arquivado_em is null and vale_a_partir > current_date
  order by versao desc limit 1;
  v_j_atual := interno.termo_json(v_atual, v_eu);
  v_j_proxima := interno.termo_json(v_proxima, v_eu);
  return jsonb_build_object(
    'do_comep', (select interno.sou_do_comep()),
    'atual', v_j_atual,
    'proxima', v_j_proxima,
    -- a versão a aceitar agora: a que vale (obrigatória) ou a próxima (já dá para aceitar antes de valer)
    'pedir', case
      when (select interno.sou_do_comep()) and v_j_atual is not null and v_j_atual -> 'aceite' = 'null'::jsonb then v_j_atual
      when (select interno.sou_do_comep()) and v_j_proxima is not null and v_j_proxima -> 'aceite' = 'null'::jsonb then v_j_proxima
    end
  );
end;
$$;

-- Aceitar: a versão, o aparelho, o dado sensível (obrigatório) e as escolhas opcionais
create function interno.aceitar_termo(p_termo_id uuid, p_aparelho text, p_dado_sensivel boolean, p_whatsapp boolean, p_aniversariantes boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if v_eu is null then
    raise exception 'Entre no sistema para aceitar o termo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.termos_uso where id = p_termo_id and publicado_em is not null and arquivado_em is null) then
    raise exception 'Versão do termo não encontrada.' using errcode = 'P0001';
  end if;
  if not coalesce(p_dado_sensivel, false) then
    raise exception 'Para aceitar, marque também o uso do dado sensível sobre a sua fé (LGPD, art. 11, I).' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.termo_aceites where termo_id = p_termo_id and pessoa_id = v_eu and arquivado_em is null) then
    raise exception 'Você já aceitou esta versão do termo.' using errcode = 'P0001';
  end if;
  insert into public.termo_aceites (termo_id, pessoa_id, aparelho, dado_sensivel)
  values (p_termo_id, v_eu, left(nullif(trim(p_aparelho), ''), 120), true);
  perform interno.salvar_privacidade(jsonb_strip_nulls(jsonb_build_object('receber_whatsapp', p_whatsapp, 'aparecer_aniversariantes', p_aniversariantes)));
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Meu perfil › Privacidade
-- ---------------------------------------------------------------------
create function interno.salvar_privacidade(p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if v_eu is null then
    raise exception 'Entre no sistema para mudar as suas escolhas.' using errcode = '42501';
  end if;
  insert into public.privacidade_escolhas (pessoa_id) values (v_eu)
  on conflict (pessoa_id) where arquivado_em is null do nothing;
  update public.privacidade_escolhas
  set receber_whatsapp = coalesce((p_dados ->> 'receber_whatsapp')::boolean, receber_whatsapp),
      aparecer_aniversariantes = coalesce((p_dados ->> 'aparecer_aniversariantes')::boolean, aparecer_aniversariantes)
  where pessoa_id = v_eu and arquivado_em is null;
end;
$$;

-- As tabelas com os dados de uma pessoa, para "quem mexeu nos seus dados" (da auditoria)
create function interno.quem_mexeu_nos_dados(p_pessoa uuid, p_dias integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x ->> 'em' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'em', a.ocorrido_em,
      'quem', coalesce(p.nome, 'O sistema'),
      'perfil', (select string_agg(distinct pa.perfil::text, ', ') from public.perfis_acesso pa where pa.pessoa_id = p.id and pa.arquivado_em is null),
      'o_que', case a.tabela
        when 'pessoas' then 'o seu cadastro'
        when 'associados' then 'a sua associação'
        when 'vinculos_igreja' then 'a sua igreja'
        when 'titulos_pessoa' then 'o seu título'
        when 'cobrancas' then 'as suas contribuições'
        when 'informes_pagamento' then 'os seus comprovantes'
        when 'pedidos_correcao' then 'um pedido de correção'
        when 'pedidos_associacao' then 'o seu pedido de associação'
        when 'perfis_acesso' then 'os seus perfis de acesso'
        else a.tabela end,
      'operacao', a.operacao
    ) as x
    from public.auditoria a
    left join public.pessoas p on p.usuario_id = a.usuario_id
    where a.ocorrido_em > now() - make_interval(days => greatest(1, least(coalesce(p_dias, 90), 365)))
      and a.tabela in ('pessoas', 'associados', 'vinculos_igreja', 'titulos_pessoa', 'cobrancas', 'informes_pagamento',
                       'pedidos_correcao', 'pedidos_associacao', 'perfis_acesso')
      and (
        (a.tabela = 'pessoas' and a.registro_id = p_pessoa::text)
        or coalesce(a.dados_depois ->> 'pessoa_id', a.dados_antes ->> 'pessoa_id') = p_pessoa::text
      )
      and (p.id is null or p.id <> p_pessoa)
    order by a.ocorrido_em desc
    limit 30
  ) y;
$$;

create function interno.minha_privacidade()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_esc public.privacidade_escolhas;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver a sua privacidade.' using errcode = '42501';
  end if;
  select * into v_esc from public.privacidade_escolhas where pessoa_id = v_eu and arquivado_em is null;
  return jsonb_build_object(
    'receber_whatsapp', coalesce(v_esc.receber_whatsapp, true),
    'aparecer_aniversariantes', coalesce(v_esc.aparecer_aniversariantes, false),
    'aceites', coalesce((
      select jsonb_agg(jsonb_build_object('termo_id', t.id, 'versao', t.versao, 'aceito_em', a.aceito_em, 'aparelho', a.aparelho) order by t.versao desc)
      from public.termo_aceites a join public.termos_uso t on t.id = a.termo_id
      where a.pessoa_id = v_eu and a.arquivado_em is null
    ), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'texto', texto, 'situacao', situacao, 'resposta', resposta,
                                          'criado_em', criado_em, 'respondido_em', respondido_em) order by criado_em desc)
      from public.pedidos_titular where pessoa_id = v_eu and arquivado_em is null
    ), '[]'::jsonb),
    'quem_mexeu', interno.quem_mexeu_nos_dados(v_eu, 90)
  );
end;
$$;

-- "Baixar os meus dados": tudo o que o COMEP guarda sobre a pessoa (LGPD, art. 18, II e V)
create function interno.meus_dados()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
begin
  if v_eu is null then
    raise exception 'Entre no sistema para baixar os seus dados.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'cadastro', (select to_jsonb(p) - 'usuario_id' - 'criado_por' from public.pessoas p where p.id = v_eu),
    'associacao', (select coalesce(jsonb_agg(to_jsonb(a) - 'criado_por'), '[]'::jsonb) from public.associados a where a.pessoa_id = v_eu),
    'igrejas', (select coalesce(jsonb_agg(jsonb_build_object('igreja', g.nome, 'inicio', v.inicio, 'fim', v.fim, 'funcao', v.funcao,
                                                             'pastor_presidente', v.pastor_presidente)), '[]'::jsonb)
                from public.vinculos_igreja v join public.igrejas g on g.id = v.igreja_id where v.pessoa_id = v_eu),
    'titulos', (select coalesce(jsonb_agg(jsonb_build_object('titulo', t.nome, 'desde', tp.desde)), '[]'::jsonb)
                from public.titulos_pessoa tp join public.titulos_ministeriais t on t.id = tp.titulo_id where tp.pessoa_id = v_eu),
    'perfis', (select coalesce(jsonb_agg(pa.perfil), '[]'::jsonb) from public.perfis_acesso pa where pa.pessoa_id = v_eu and pa.arquivado_em is null),
    'contribuicoes', (select coalesce(jsonb_agg(jsonb_build_object('competencia', c.competencia, 'tipo', c.tipo, 'valor', c.valor, 'situacao', c.situacao,
                                                                   'pago_em', c.pago_em, 'valor_pago', c.valor_pago) order by c.competencia), '[]'::jsonb)
                      from public.cobrancas c where c.pessoa_id = v_eu),
    'comprovantes', (select coalesce(jsonb_agg(jsonb_build_object('data_pagamento', i.data_pagamento, 'valor', i.valor, 'forma', i.forma,
                                                                  'situacao', i.situacao) order by i.criado_em), '[]'::jsonb)
                     from public.informes_pagamento i where i.pessoa_id = v_eu),
    'termos_aceitos', (select coalesce(jsonb_agg(jsonb_build_object('versao', t.versao, 'aceito_em', a.aceito_em, 'aparelho', a.aparelho)), '[]'::jsonb)
                       from public.termo_aceites a join public.termos_uso t on t.id = a.termo_id where a.pessoa_id = v_eu),
    'escolhas', (select to_jsonb(e) - 'criado_por' - 'id' - 'pessoa_id' from public.privacidade_escolhas e where e.pessoa_id = v_eu and e.arquivado_em is null)
  );
end;
$$;

create function interno.pedir_exclusao(p_texto text)
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
    raise exception 'Entre no sistema para fazer o pedido.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 3 then
    raise exception 'Diga o que você quer que seja excluído.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pedidos_titular where pessoa_id = v_eu and situacao = 'pendente' and arquivado_em is null) then
    raise exception 'Você já tem um pedido esperando a resposta da secretaria.' using errcode = 'P0001';
  end if;
  insert into public.pedidos_titular (pessoa_id, tipo, texto) values (v_eu, 'exclusao', trim(p_texto)) returning id into v_id;
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. A secretaria: as versões, o rascunho, publicar, os pedidos e a escolha do WhatsApp de cada um
-- ---------------------------------------------------------------------
create function interno.versoes_do_termo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pessoas uuid[] := interno.pessoas_do_comep_termo();
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')) then
    raise exception 'Só a secretaria, a presidência e o administrador técnico veem as versões do termo.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pessoas', cardinality(v_pessoas),
    'versoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'versao', t.versao, 'resumo', t.resumo, 'partes', t.partes, 'mudancas', to_jsonb(t.mudancas), 'minuta', t.minuta,
        'vale_a_partir', t.vale_a_partir, 'publicado_em', t.publicado_em,
        'aceites', (select count(*) from public.termo_aceites a where a.termo_id = t.id and a.arquivado_em is null and a.pessoa_id = any (v_pessoas)),
        'faltam', (select count(*) from unnest(v_pessoas) x where not exists (
                     select 1 from public.termo_aceites a where a.termo_id = t.id and a.pessoa_id = x and a.arquivado_em is null))
      ) order by t.versao desc)
      from public.termos_uso t where t.arquivado_em is null
    ), '[]'::jsonb),
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('id', pt.id, 'nome', p.nome, 'pessoa_id', p.id, 'tipo', pt.tipo, 'texto', pt.texto,
                                          'situacao', pt.situacao, 'resposta', pt.resposta, 'criado_em', pt.criado_em) order by pt.criado_em desc)
      from public.pedidos_titular pt join public.pessoas p on p.id = pt.pessoa_id
      where pt.arquivado_em is null
    ), '[]'::jsonb)
  );
end;
$$;

-- Quem precisa aceitar o termo: quem é do COMEP (tem algum perfil) e tem login
create function interno.pessoas_do_comep_termo()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct pa.pessoa_id), '{}')
  from public.perfis_acesso pa
  join public.pessoas p on p.id = pa.pessoa_id and p.arquivado_em is null and p.usuario_id is not null
  where pa.arquivado_em is null;
$$;

-- O rascunho da versão nova (começa como cópia da última). p_dados: { resumo, partes, mudancas, vale_a_partir, minuta }
create function interno.salvar_rascunho_termo(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ultima public.termos_uso;
  v_id uuid;
  v_mudancas text[];
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência escrevem uma versão nova do termo.' using errcode = '42501';
  end if;
  select * into v_ultima from public.termos_uso where arquivado_em is null and publicado_em is not null order by versao desc limit 1;
  if p_dados ? 'mudancas' then
    select coalesce(array_agg(trim(m)), '{}') into v_mudancas
    from jsonb_array_elements_text(p_dados -> 'mudancas') m where length(trim(m)) > 0;
  end if;
  if (p_dados ->> 'vale_a_partir')::date < current_date then
    raise exception 'A versão nova vale de hoje em diante.' using errcode = 'P0001';
  end if;
  select id into v_id from public.termos_uso where publicado_em is null and arquivado_em is null;
  if v_id is null then
    insert into public.termos_uso (versao, resumo, partes, mudancas, minuta, vale_a_partir)
    values (coalesce(v_ultima.versao, 0) + 1,
            coalesce(p_dados -> 'resumo', v_ultima.resumo), coalesce(p_dados -> 'partes', v_ultima.partes),
            coalesce(v_mudancas, '{}'), coalesce((p_dados ->> 'minuta')::boolean, true),
            coalesce((p_dados ->> 'vale_a_partir')::date, current_date + 10))
    returning id into v_id;
  else
    update public.termos_uso
    set resumo = coalesce(p_dados -> 'resumo', resumo), partes = coalesce(p_dados -> 'partes', partes),
        mudancas = coalesce(v_mudancas, mudancas), minuta = coalesce((p_dados ->> 'minuta')::boolean, minuta),
        vale_a_partir = coalesce((p_dados ->> 'vale_a_partir')::date, vale_a_partir)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create function interno.publicar_termo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_termo public.termos_uso;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência publicam o termo.' using errcode = '42501';
  end if;
  select * into v_termo from public.termos_uso where id = p_id and arquivado_em is null for update;
  if not found or v_termo.publicado_em is not null then
    raise exception 'Este rascunho não existe ou já foi publicado.' using errcode = 'P0001';
  end if;
  if v_termo.vale_a_partir < current_date then
    raise exception 'A versão nova vale de hoje em diante: acerte a data.' using errcode = 'P0001';
  end if;
  if cardinality(v_termo.mudancas) = 0 and v_termo.versao > 1 then
    raise exception 'Escreva o que mudou nesta versão: é o que as pessoas leem antes de aceitar de novo.' using errcode = 'P0001';
  end if;
  update public.termos_uso set publicado_em = now(), publicado_por = (select interno.minha_pessoa_id()) where id = p_id;
end;
$$;

create function interno.responder_pedido_titular(p_id uuid, p_atendido boolean, p_resposta text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência respondem os pedidos de exclusão.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_resposta, ''))) < 3 then
    raise exception 'Escreva a resposta (o que foi feito, ou por que a lei manda guardar).' using errcode = 'P0001';
  end if;
  update public.pedidos_titular
  set situacao = case when p_atendido then 'atendido' else 'recusado' end, resposta = trim(p_resposta),
      respondido_por = (select interno.minha_pessoa_id()), respondido_em = now()
  where id = p_id and situacao = 'pendente' and arquivado_em is null;
  if not found then
    raise exception 'Pedido não encontrado ou já respondido.' using errcode = 'P0001';
  end if;
end;
$$;

-- "Mandar lembrete": o aviso no sino (e no celular) de quem ainda não aceitou a versão (uma vez por dia)
create function interno.lembrar_termo(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_termo public.termos_uso;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mandam o lembrete do termo.' using errcode = '42501';
  end if;
  select * into v_termo from public.termos_uso where id = p_id and publicado_em is not null and arquivado_em is null;
  if not found then
    raise exception 'Versão do termo não encontrada.' using errcode = 'P0001';
  end if;
  return interno.notificar(
    array(select x from unnest(interno.pessoas_do_comep_termo()) x
          where not exists (select 1 from public.termo_aceites a where a.termo_id = p_id and a.pessoa_id = x and a.arquivado_em is null)),
    'recado', 'Termo de uso de dados',
    'Leia e aceite o termo de uso dos seus dados (versão ' || v_termo.versao || ', vale a partir de '
      || to_char(v_termo.vale_a_partir, 'DD/MM/YYYY') || '). Leva 2 minutos.',
    '/meu-perfil/privacidade', 'termo:' || p_id || ':' || current_date, false, now(), (select interno.minha_pessoa_id()));
end;
$$;

-- A ficha do ministro (o WhatsApp da secretaria): a pessoa quer receber avisos pelo WhatsApp?
create function interno.privacidade_de(p_pessoa uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_esc public.privacidade_escolhas;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'tesouraria')) then
    raise exception 'Só a secretaria, a tesouraria e a presidência veem as escolhas de privacidade de outra pessoa.' using errcode = '42501';
  end if;
  select * into v_esc from public.privacidade_escolhas where pessoa_id = p_pessoa and arquivado_em is null;
  return jsonb_build_object('receber_whatsapp', coalesce(v_esc.receber_whatsapp, true));
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.meu_termo()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.meu_termo(); $$;
create function public.aceitar_termo(p_termo_id uuid, p_aparelho text, p_dado_sensivel boolean, p_whatsapp boolean, p_aniversariantes boolean)
returns void language sql security invoker set search_path = '' as $$
  select interno.aceitar_termo(p_termo_id, p_aparelho, p_dado_sensivel, p_whatsapp, p_aniversariantes);
$$;
create function public.salvar_privacidade(p_dados jsonb)
returns void language sql security invoker set search_path = '' as $$ select interno.salvar_privacidade(p_dados); $$;
create function public.minha_privacidade()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.minha_privacidade(); $$;
create function public.meus_dados()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.meus_dados(); $$;
create function public.pedir_exclusao(p_texto text)
returns uuid language sql security invoker set search_path = '' as $$ select interno.pedir_exclusao(p_texto); $$;
create function public.versoes_do_termo()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.versoes_do_termo(); $$;
create function public.salvar_rascunho_termo(p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_rascunho_termo(p_dados); $$;
create function public.publicar_termo(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.publicar_termo(p_id); $$;
create function public.responder_pedido_titular(p_id uuid, p_atendido boolean, p_resposta text)
returns void language sql security invoker set search_path = '' as $$ select interno.responder_pedido_titular(p_id, p_atendido, p_resposta); $$;
create function public.lembrar_termo(p_id uuid)
returns integer language sql security invoker set search_path = '' as $$ select interno.lembrar_termo(p_id); $$;
create function public.privacidade_de(p_pessoa uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.privacidade_de(p_pessoa); $$;

revoke all on function interno.proteger_termo() from public;
revoke all on function interno.proteger_aceite() from public;
revoke all on function interno.termo_json(public.termos_uso, uuid) from public;
revoke all on function interno.quem_mexeu_nos_dados(uuid, integer) from public;
revoke all on function interno.pessoas_do_comep_termo() from public;

revoke all on function interno.meu_termo() from public;
revoke all on function interno.aceitar_termo(uuid, text, boolean, boolean, boolean) from public;
revoke all on function interno.salvar_privacidade(jsonb) from public;
revoke all on function interno.minha_privacidade() from public;
revoke all on function interno.meus_dados() from public;
revoke all on function interno.pedir_exclusao(text) from public;
revoke all on function interno.versoes_do_termo() from public;
revoke all on function interno.salvar_rascunho_termo(jsonb) from public;
revoke all on function interno.publicar_termo(uuid) from public;
revoke all on function interno.responder_pedido_titular(uuid, boolean, text) from public;
revoke all on function interno.privacidade_de(uuid) from public;
revoke all on function interno.lembrar_termo(uuid) from public;
grant execute on function interno.lembrar_termo(uuid) to authenticated;
grant execute on function interno.meu_termo() to authenticated;
grant execute on function interno.aceitar_termo(uuid, text, boolean, boolean, boolean) to authenticated;
grant execute on function interno.salvar_privacidade(jsonb) to authenticated;
grant execute on function interno.minha_privacidade() to authenticated;
grant execute on function interno.meus_dados() to authenticated;
grant execute on function interno.pedir_exclusao(text) to authenticated;
grant execute on function interno.versoes_do_termo() to authenticated;
grant execute on function interno.salvar_rascunho_termo(jsonb) to authenticated;
grant execute on function interno.publicar_termo(uuid) to authenticated;
grant execute on function interno.responder_pedido_titular(uuid, boolean, text) to authenticated;
grant execute on function interno.privacidade_de(uuid) to authenticated;

revoke all on function public.meu_termo() from public, anon;
revoke all on function public.aceitar_termo(uuid, text, boolean, boolean, boolean) from public, anon;
revoke all on function public.salvar_privacidade(jsonb) from public, anon;
revoke all on function public.minha_privacidade() from public, anon;
revoke all on function public.meus_dados() from public, anon;
revoke all on function public.pedir_exclusao(text) from public, anon;
revoke all on function public.versoes_do_termo() from public, anon;
revoke all on function public.salvar_rascunho_termo(jsonb) from public, anon;
revoke all on function public.publicar_termo(uuid) from public, anon;
revoke all on function public.responder_pedido_titular(uuid, boolean, text) from public, anon;
revoke all on function public.privacidade_de(uuid) from public, anon;
revoke all on function public.lembrar_termo(uuid) from public, anon;
grant execute on function public.lembrar_termo(uuid) to authenticated;
grant execute on function public.meu_termo() to authenticated;
grant execute on function public.aceitar_termo(uuid, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.salvar_privacidade(jsonb) to authenticated;
grant execute on function public.minha_privacidade() to authenticated;
grant execute on function public.meus_dados() to authenticated;
grant execute on function public.pedir_exclusao(text) to authenticated;
grant execute on function public.versoes_do_termo() to authenticated;
grant execute on function public.salvar_rascunho_termo(jsonb) to authenticated;
grant execute on function public.publicar_termo(uuid) to authenticated;
grant execute on function public.responder_pedido_titular(uuid, boolean, text) to authenticated;
grant execute on function public.privacidade_de(uuid) to authenticated;

-- Tabelas: o termo publicado todos do COMEP leem; o aceite, as escolhas e os pedidos, cada um os seus (e a secretaria)
revoke all on public.termos_uso, public.termo_aceites, public.privacidade_escolhas, public.pedidos_titular from anon, authenticated;
grant select on public.termos_uso, public.termo_aceites, public.privacidade_escolhas, public.pedidos_titular to authenticated;

alter table public.termos_uso enable row level security;
alter table public.termo_aceites enable row level security;
alter table public.privacidade_escolhas enable row level security;
alter table public.pedidos_titular enable row level security;

create policy "termo de uso: quem tem login lê o publicado; a secretaria e a presidência, o rascunho"
  on public.termos_uso for select to authenticated
  using (publicado_em is not null or (select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "aceites do termo: cada um os seus; a secretaria e a presidência, todos"
  on public.termo_aceites for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "escolhas de privacidade: cada um as suas"
  on public.privacidade_escolhas for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()));
create policy "pedidos do titular: cada um os seus; a secretaria e a presidência, todos"
  on public.pedidos_titular for select to authenticated
  using (pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')));
