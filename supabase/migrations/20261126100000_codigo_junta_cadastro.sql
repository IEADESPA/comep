-- =====================================================================
-- "Tenho um código" (S5-04; decisão do presidente de 25/11/2026; a tela `codigo-login` da rodada 37): o código de
-- primeiro acesso também liga um login que JÁ existe ao cadastro que a secretaria fez.
--
-- Até aqui o código só era usado quando nascia um login novo (o gatilho criar_pessoa_para_novo_usuario). O associado
-- antigo que criou o login pelo site ("Quero me associar") ficava com dois cadastros e sem saída (revisão das telas
-- gerais, S5-04). Agora ele entra com o login que já tem e, no Início, usa o código em "Tenho um código":
--   1. conferir_codigo_cadastro: mostra "É você?" (a conta de agora e o cadastro da secretaria, lado a lado). Não muda
--      nada;
--   2. ligar_login_ao_cadastro ("Sim, sou eu: ligar a conta"):
--      * o cadastro aberto pelo site perde o login e é arquivado (nada se apaga); o pedido de associação aberto
--        (enviado ou com pendência) vira "desistiu", pelo próprio dono, antes da troca;
--      * o login passa para o cadastro da secretaria, com o e-mail do login (como no primeiro acesso de sempre);
--      * o código fica usado; a junção fica registrada em juncoes_cadastro, com a lista do que o aberto tinha;
--      * a secretaria e a presidência recebem essa lista no sino. A foto e os documentos NÃO passam: ficam no
--        cadastro arquivado;
--      * a pessoa aceita o termo de novo (o aceite é de cada cadastro, e o da secretaria ainda não aceitou).
-- Todo código que não vale dá a mesma resposta (não revela se o código existe nem de quem é). Errou 5 vezes, espera
-- 15 minutos (o que a tela promete). Quem já é do COMEP (associado, com perfil ou cargo) não troca de cadastro por
-- aqui: fala com a secretaria. Duas abas (ou dois cliques): uma junção por login de cada vez, e a segunda chamada
-- com o mesmo código responde o mesmo.
-- O pedido que já foi encaminhado à assembleia o candidato não desiste (regras_pedido): fica para a secretaria
-- recusar (o sino pede), e a aprovação em assembleia passa a recusar o pedido de um cadastro arquivado.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. O registro de cada junção (a auditoria de pessoas e de códigos continua, pelos gatilhos de sempre)
-- ---------------------------------------------------------------------
create table public.juncoes_cadastro (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid references auth.users (id) on delete set null,
  pessoa_aberta_id uuid not null references public.pessoas (id),
  pessoa_id        uuid not null references public.pessoas (id),
  codigo_id        uuid references public.codigos_acesso (id),
  -- o que o cadastro aberto tinha (ex.: 'a foto', 'o pedido de associação (enviado; agora "desistiu")')
  tinha            text[] not null default '{}',
  arquivado_em     timestamptz,
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  constraint juncoes_cadastro_dois_cadastros check (pessoa_aberta_id <> pessoa_id)
);
comment on table public.juncoes_cadastro is
  'Cada login criado pelo site que foi ligado, pelo código de primeiro acesso, ao cadastro da secretaria: o cadastro aberto (arquivado), o da secretaria e o que o aberto tinha.';
create index juncoes_cadastro_usuario on public.juncoes_cadastro (usuario_id);
create index juncoes_cadastro_pessoa_aberta on public.juncoes_cadastro (pessoa_aberta_id);
create index juncoes_cadastro_pessoa on public.juncoes_cadastro (pessoa_id);
create index juncoes_cadastro_codigo on public.juncoes_cadastro (codigo_id);
select interno.aplicar_padroes('public.juncoes_cadastro');

-- As tentativas com código errado (5 em 15 minutos: espera). Fora da API.
create table public.tentativas_codigo (
  id            bigint generated always as identity primary key,
  usuario_id    uuid references auth.users (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.tentativas_codigo is
  'Tentativas com código de primeiro acesso errado em "Tenho um código". Errou 5 vezes em 15 minutos, espera.';
create index tentativas_codigo_usuario on public.tentativas_codigo (usuario_id, criado_em);
select interno.aplicar_padroes('public.tentativas_codigo');


-- ---------------------------------------------------------------------
-- 2. As peças
-- ---------------------------------------------------------------------

-- Quem recebe o aviso: a secretaria e a presidência de hoje (pelo perfil ou pelo cargo em vigor)
create function interno.secretaria_e_presidencia()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.pessoa_id), '{}')
  from (
    select pa.pessoa_id
    from public.perfis_acesso pa
    join public.pessoas p on p.id = pa.pessoa_id and p.arquivado_em is null
    where pa.arquivado_em is null
      and pa.perfil in ('secretaria', 'presidencia')
      and not interno.saiu_do_comep(p.id)
    union
    select m.pessoa_id
    from public.mandatos m
    join public.pessoas p on p.id = m.pessoa_id and p.arquivado_em is null
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where m.arquivado_em is null
      and current_date between m.inicio and interno.fim_efetivo(m)
      and interno.perfis_do_cargo(m.cargo) && array['secretaria', 'presidencia']::public.perfil_acesso[]
  ) x;
$$;

-- O cadastro de hoje do login tem de ser o aberto pelo site: criado pelo próprio login, sem associado (nem antigo),
-- sem perfil e sem cargo. Vem antes do código: a resposta não depende de o código valer.
create function interno.exigir_cadastro_aberto(p_usuario uuid)
returns public.pessoas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.pessoas;
begin
  select * into v from public.pessoas where usuario_id = p_usuario and arquivado_em is null for update;
  if v.id is null
     or v.criado_por is distinct from p_usuario
     or exists (select 1 from public.associados a where a.pessoa_id = v.id)
     or exists (select 1 from public.perfis_acesso pa where pa.pessoa_id = v.id and pa.arquivado_em is null)
     or exists (select 1 from public.mandatos m where m.pessoa_id = v.id and m.arquivado_em is null) then
    raise exception 'Este login já é de um cadastro do COMEP. Se precisar trocar, fale com a secretaria.'
      using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- Errou 5 vezes em 15 minutos: espera
create function interno.exigir_poucas_tentativas(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.tentativas_codigo t
      where t.usuario_id = p_usuario and t.criado_em > now() - interval '15 minutes') >= 5 then
    raise exception 'Você errou o código 5 vezes. Espere 15 minutos e tente de novo.' using errcode = 'P0001';
  end if;
end;
$$;

-- O cadastro do código: de primeiro acesso, sem uso, não vencido nem cancelado, de um cadastro sem login e não
-- arquivado. Travado e conferido de novo (dois logins com o mesmo código ao mesmo tempo: só um passa).
-- Devolve nulos quando o código não vale, seja qual for o motivo.
create function interno.cadastro_do_codigo(p_codigo text, out o_codigo uuid, out o_pessoa uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := interno.codigo_valido(p_codigo, 'primeiro_acesso');
  v_pessoa uuid;
begin
  if v_id is null then
    return;
  end if;
  select c.pessoa_id into v_pessoa
  from public.codigos_acesso c
  where c.id = v_id and c.usado_em is null and c.arquivado_em is null and c.expira_em > now()
  for update;
  if v_pessoa is null then
    return;
  end if;
  perform 1 from public.pessoas p where p.id = v_pessoa and p.usuario_id is null and p.arquivado_em is null for update;
  if found then
    o_codigo := v_id;
    o_pessoa := v_pessoa;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. "É você?": o cadastro do código, ao lado da conta de agora. Não muda nada.
--    { valido: false } ou { valido: true, conta: {…}, cadastro: {…} }
-- ---------------------------------------------------------------------
create function interno.conferir_codigo_cadastro(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_aberta  public.pessoas;
  v_alvo    record;
begin
  if v_usuario is null then
    raise exception 'Entre no sistema para usar o código.' using errcode = '42501';
  end if;
  v_aberta := interno.exigir_cadastro_aberto(v_usuario);
  perform interno.exigir_poucas_tentativas(v_usuario);

  select * into v_alvo from interno.cadastro_do_codigo(p_codigo);
  if v_alvo.o_pessoa is null then
    insert into public.tentativas_codigo (usuario_id) values (v_usuario);
    return jsonb_build_object('valido', false);
  end if;

  return jsonb_build_object(
    'valido', true,
    'conta', jsonb_build_object(
      'nome', v_aberta.nome,
      'criada_em', v_aberta.criado_em,
      'pedido', (select pa.situacao from public.pedidos_associacao pa
                 where pa.pessoa_id = v_aberta.id and pa.arquivado_em is null
                   and pa.situacao in ('enviado', 'pendencia', 'aguardando_assembleia')
                 order by pa.criado_em desc limit 1)),
    'cadastro', (
      select jsonb_build_object(
        'nome', p.nome,
        'numero', (select a.numero_registro from public.associados a
                   where a.pessoa_id = p.id and a.arquivado_em is null order by a.criado_em desc limit 1),
        'associado_desde', (select a.admitido_em from public.associados a
                            where a.pessoa_id = p.id and a.arquivado_em is null order by a.criado_em desc limit 1),
        'igreja', (select g.nome from public.vinculos_igreja vi join public.igrejas g on g.id = vi.igreja_id
                   where vi.pessoa_id = p.id and vi.fim is null and vi.arquivado_em is null
                   order by vi.criado_em desc limit 1),
        'funcao', coalesce(
          (select nullif(trim(vi.funcao), '') from public.vinculos_igreja vi
           where vi.pessoa_id = p.id and vi.fim is null and vi.arquivado_em is null
           order by vi.criado_em desc limit 1),
          (select t.nome from public.titulos_pessoa tp join public.titulos_ministeriais t on t.id = tp.titulo_id
           where tp.pessoa_id = p.id and tp.arquivado_em is null order by tp.criado_em desc limit 1)),
        'em_dia', interno.esta_em_dia(p.id))
      from public.pessoas p where p.id = v_alvo.o_pessoa));
end;
$$;


-- ---------------------------------------------------------------------
-- 4. "Sim, sou eu: ligar a conta"
--    { valido: false } ou { valido: true, nome, numero, pedido (o aberto tinha pedido de associação) }
-- ---------------------------------------------------------------------
create function interno.ligar_login_ao_cadastro(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario     uuid := (select auth.uid());
  v_aberta      public.pessoas;
  v_alvo        public.pessoas;
  v_cod         record;
  v_ja          record;
  v_email       text;
  v_gerado_em   timestamptz;
  v_tinha       text[] := '{}';
  v_pedido      record;
  v_teve_pedido boolean := false;
  v_assembleia  uuid;
  v_arquivos    integer;
  v_juncao      uuid;
  v_texto       text;
begin
  if v_usuario is null then
    raise exception 'Entre no sistema para usar o código.' using errcode = '42501';
  end if;

  -- Duas abas (ou dois cliques): uma junção por login de cada vez; a segunda espera a primeira terminar.
  perform pg_advisory_xact_lock(hashtext('juncao_cadastro'), hashtext(v_usuario::text));

  -- A segunda aba: o login já está no cadastro deste mesmo código. Responde o mesmo, sem mudar nada.
  select p.id, p.nome into v_ja
  from interno.codigos_segredos s
  join public.codigos_acesso c on c.id = s.codigo_id
  join public.pessoas p on p.id = c.pessoa_id
  where s.hash = interno.hash_codigo(p_codigo)
    and c.finalidade = 'primeiro_acesso'
    and c.usado_em is not null
    and p.usuario_id = v_usuario
    and p.arquivado_em is null;
  if v_ja.id is not null then
    return jsonb_build_object(
      'valido', true,
      'nome', v_ja.nome,
      'numero', (select a.numero_registro from public.associados a
                 where a.pessoa_id = v_ja.id and a.arquivado_em is null order by a.criado_em desc limit 1),
      'pedido', exists (select 1 from public.juncoes_cadastro j, unnest(j.tinha) x(item)
                        where j.usuario_id = v_usuario and j.pessoa_id = v_ja.id
                          and x.item like 'o pedido de associação%'));
  end if;

  v_aberta := interno.exigir_cadastro_aberto(v_usuario);
  perform interno.exigir_poucas_tentativas(v_usuario);

  select * into v_cod from interno.cadastro_do_codigo(p_codigo);
  if v_cod.o_pessoa is null then
    insert into public.tentativas_codigo (usuario_id) values (v_usuario);
    return jsonb_build_object('valido', false);
  end if;
  select * into v_alvo from public.pessoas where id = v_cod.o_pessoa;

  -- O que o cadastro aberto tinha (vai para o registro e para o sino; nada passa e nada se apaga)
  if v_aberta.foto_caminho is not null then
    v_tinha := v_tinha || 'a foto'::text;
  end if;
  if v_aberta.cpf is not null then
    v_tinha := v_tinha || 'o CPF'::text;
  end if;
  if v_aberta.telefone is not null then
    v_tinha := v_tinha || 'o telefone'::text;
  end if;
  if v_aberta.nome_pai is not null or v_aberta.nome_mae is not null then
    v_tinha := v_tinha || 'a filiação'::text;
  end if;
  select count(*)::integer into v_arquivos
  from storage.objects o
  where o.bucket_id = 'documentos'
    and (storage.foldername(o.name))[1] = 'pessoas'
    and (storage.foldername(o.name))[2] = v_aberta.id::text;
  if v_arquivos > 0 then
    v_tinha := v_tinha || (v_arquivos || case when v_arquivos = 1 then ' arquivo enviado' else ' arquivos enviados' end);
  end if;

  -- O pedido de associação aberto: o próprio dono desiste (o login ainda é dele, e regras_pedido confere isso).
  -- O que já foi à assembleia o candidato não desiste: fica para a secretaria recusar.
  for v_pedido in
    select pa.id, pa.situacao
    from public.pedidos_associacao pa
    where pa.pessoa_id = v_aberta.id
      and pa.arquivado_em is null
      and pa.situacao in ('enviado', 'pendencia', 'aguardando_assembleia')
    order by pa.criado_em
  loop
    v_teve_pedido := true;
    if v_pedido.situacao = 'aguardando_assembleia' then
      v_assembleia := v_pedido.id;
      v_tinha := v_tinha || 'o pedido de associação (já encaminhado à assembleia)'::text;
    else
      update public.pedidos_associacao set situacao = 'desistiu' where id = v_pedido.id;
      v_tinha := v_tinha || format('o pedido de associação (%s; agora "desistiu")',
                                   case v_pedido.situacao when 'enviado' then 'enviado' else 'com pendência' end);
    end if;
  end loop;

  -- A troca, nesta ordem (pessoas.usuario_id é único; e o CPF só é único entre os cadastros não arquivados)
  update public.pessoas set usuario_id = null, arquivado_em = now() where id = v_aberta.id;
  select u.email into v_email from auth.users u where u.id = v_usuario;
  update public.pessoas set usuario_id = v_usuario, email = v_email where id = v_alvo.id;
  update public.codigos_acesso set usado_em = now() where id = v_cod.o_codigo
  returning criado_em into v_gerado_em;

  insert into public.juncoes_cadastro (usuario_id, pessoa_aberta_id, pessoa_id, codigo_id, tinha)
  values (v_usuario, v_aberta.id, v_alvo.id, v_cod.o_codigo, v_tinha)
  returning id into v_juncao;

  -- O sino da secretaria e da presidência
  v_texto := format('Usou o código que a secretaria gerou em %s, com a conta que já tinha criado pelo site. '
                    || 'O cadastro aberto pela conta (%s) foi arquivado; nada se apagou.',
                    to_char(v_gerado_em at time zone 'America/Belem', 'DD/MM/YYYY'), v_aberta.nome);
  if cardinality(v_tinha) > 0 then
    v_texto := v_texto || ' Ele tinha: ' || array_to_string(v_tinha, ', ') || '.'
               || ' A foto e os documentos não passaram para o cadastro da secretaria.';
  end if;
  if v_assembleia is not null then
    v_texto := v_texto || ' O pedido de associação já estava na assembleia: recuse-o, com o motivo '
               || '"Já é associado pelo cadastro da secretaria".';
  end if;
  perform interno.notificar(
    interno.secretaria_e_presidencia(), 'pedido', left(v_alvo.nome || ' ligou a conta ao cadastro', 120), v_texto,
    case when v_assembleia is not null then '/inscricoes/' || v_assembleia else '/ministros/' || v_alvo.id end,
    'juncao:' || v_juncao);

  return jsonb_build_object(
    'valido', true,
    'nome', v_alvo.nome,
    'numero', (select a.numero_registro from public.associados a
               where a.pessoa_id = v_alvo.id and a.arquivado_em is null order by a.criado_em desc limit 1),
    'pedido', v_teve_pedido);
end;
$$;

create function public.conferir_codigo_cadastro(p_codigo text)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.conferir_codigo_cadastro(p_codigo); $$;
create function public.ligar_login_ao_cadastro(p_codigo text)
returns jsonb language sql security invoker set search_path = '' as $$ select interno.ligar_login_ao_cadastro(p_codigo); $$;


-- ---------------------------------------------------------------------
-- 5. A assembleia não aprova o pedido de um cadastro arquivado (não nasce um associado repetido).
--    Igual a 20261111191948_pedido_associacao.sql, mais a conferência do cadastro arquivado.
-- ---------------------------------------------------------------------
create or replace function public.aprovar_pedido(p_pedido_id uuid, p_assembleia_data date, p_assembleia_ata text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pedido       public.pedidos_associacao;
  v_associado_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram a decisão da assembleia.' using errcode = '42501';
  end if;

  select * into v_pedido from public.pedidos_associacao where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.situacao <> 'aguardando_assembleia' then
    raise exception 'Só pedidos encaminhados à assembleia podem ser aprovados.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pessoas p where p.id = v_pedido.pessoa_id and p.arquivado_em is not null) then
    raise exception 'O cadastro deste pedido foi arquivado: a pessoa já entrou pelo cadastro da secretaria. Recuse o pedido, com o motivo "Já é associado pelo cadastro da secretaria".'
      using errcode = 'P0001';
  end if;
  if p_assembleia_data is null or p_assembleia_data > current_date then
    raise exception 'Informe a data da Assembleia Ordinária que aprovou (não pode ser data futura).' using errcode = 'P0001';
  end if;

  insert into public.associados (pessoa_id, forma_admissao, admitido_em, assembleia_data, assembleia_ata)
  values (v_pedido.pessoa_id, 'assembleia', p_assembleia_data, p_assembleia_data, nullif(trim(p_assembleia_ata), ''))
  returning id into v_associado_id;

  insert into public.titulos_pessoa (pessoa_id, titulo_id, desde)
  values (v_pedido.pessoa_id, v_pedido.titulo_id, v_pedido.titulo_desde);

  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, pastor_presidente)
  values (v_pedido.pessoa_id, v_pedido.igreja_id, nullif(trim(v_pedido.funcao), ''), v_pedido.pastor_presidente);

  update public.pessoas
  set foto_caminho = v_pedido.foto_caminho
  where id = v_pedido.pessoa_id and foto_caminho is null;

  update public.pedidos_associacao
  set situacao = 'aprovado',
      assembleia_data = p_assembleia_data,
      assembleia_ata = nullif(trim(p_assembleia_ata), ''),
      associado_id = v_associado_id
  where id = p_pedido_id;

  return v_associado_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Quem pode
-- ---------------------------------------------------------------------
revoke all on function interno.secretaria_e_presidencia() from public;
revoke all on function interno.exigir_cadastro_aberto(uuid) from public;
revoke all on function interno.exigir_poucas_tentativas(uuid) from public;
revoke all on function interno.cadastro_do_codigo(text) from public;
revoke all on function interno.conferir_codigo_cadastro(text) from public;
revoke all on function interno.ligar_login_ao_cadastro(text) from public;
grant execute on function interno.conferir_codigo_cadastro(text) to authenticated;
grant execute on function interno.ligar_login_ao_cadastro(text) to authenticated;

revoke all on function public.conferir_codigo_cadastro(text) from public, anon;
revoke all on function public.ligar_login_ao_cadastro(text) from public, anon;
grant execute on function public.conferir_codigo_cadastro(text) to authenticated;
grant execute on function public.ligar_login_ao_cadastro(text) to authenticated;

-- O registro: a secretaria e a presidência leem; ninguém grava pela API (só a função acima).
-- As tentativas: fora da API.
revoke all on public.juncoes_cadastro, public.tentativas_codigo from anon, authenticated;
grant select on public.juncoes_cadastro to authenticated;
alter table public.juncoes_cadastro enable row level security;
alter table public.tentativas_codigo enable row level security;
create policy "junções de cadastro: a secretaria e a presidência leem"
  on public.juncoes_cadastro for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')));
