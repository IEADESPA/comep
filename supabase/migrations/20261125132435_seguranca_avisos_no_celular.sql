-- Revisão permanente, módulo 1 (25/11/2026), achado S1-01 e o complemento S3-04: os avisos no celular (push) ficam
-- mais robustos.
--   1. O endereço do aparelho tem de ser de um serviço de push dos navegadores (Google, Mozilla, Apple, Windows):
--      o envio nunca vai para outro servidor. Vale na função e na tabela (para os aparelhos ativos).
--   2. Cada pessoa tem no máximo 10 aparelhos ativos: quando entra o 11º, o mais antigo sai (motivo "limite").
--   3. O lote do envio reparte a vez: no máximo 3 avisos de cada pessoa por lote (o recado também), a 1ª vez de todos
--      antes da 2ª de alguém, e um aviso entra inteiro (todos os aparelhos da pessoa juntos) ou fica para o lote seguinte.
--   4. O resultado do envio conta UMA tentativa por aviso a cada rodada, e não uma por aparelho que falhou.
--   5. O recado pelo aplicativo: no máximo 30 por dia de quem manda para a mesma pessoa.
-- A função supabase/functions/enviar-avisos ganhou, no mesmo ramo, o tempo-limite por envio, os envios em grupos e o
-- resultado gravado a cada grupo.


-- ---------------------------------------------------------------------
-- 1. Os serviços de push aceitos
-- ---------------------------------------------------------------------
-- A lista segue a de referência dos serviços conhecidos (github.com/pushpad/known-push-services):
--   Chrome, Edge, Opera, Samsung e Android ... fcm.googleapis.com, android.googleapis.com (antigo), jmt17.google.com
--   Firefox .................................. *.push.services.mozilla.com
--   Edge no Windows .......................... *.notify.windows.com
--   Safari (Mac, iPhone e iPad) .............. *.push.apple.com
-- E o domínio reservado .invalid (RFC 6761), que nunca existe na internet: é o da inscrição falsa do ponta a ponta
-- (testes/e2e/notificacoes.spec.ts). O envio para ele falha na hora, sem servidor do outro lado.
-- O nome do servidor termina logo antes da primeira "/": nada de porta, usuário ("@") ou domínio parecido.
create function interno.endereco_de_push_aceito(p_endereco text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_endereco, '') ~* ('^https://('
    || 'fcm\.googleapis\.com'
    || '|android\.googleapis\.com'
    || '|jmt17\.google\.com'
    || '|([a-z0-9-]+\.)*push\.services\.mozilla\.com'
    || '|([a-z0-9-]+\.)+notify\.windows\.com'
    || '|([a-z0-9-]+\.)*push\.apple\.com'
    || '|([a-z0-9-]+\.)+invalid'
    || ')/');
$$;
comment on function interno.endereco_de_push_aceito(text) is
  'O endereço do aparelho é de um serviço de push dos navegadores (ou do domínio reservado .invalid, dos testes).';
revoke all on function interno.endereco_de_push_aceito(text) from public;

-- Os motivos novos para um aparelho sair: passou do limite de aparelhos; o endereço não é de um serviço aceito
alter table public.inscricoes_push drop constraint inscricoes_push_motivo_arquivo_check;
alter table public.inscricoes_push add constraint inscricoes_push_motivo_arquivo_check check (
  motivo_arquivo is null or motivo_arquivo in ('saiu', 'expirou', 'outra_pessoa', 'falhou', 'limite', 'endereco_recusado')
);

-- O que já estava ativo e não serve mais sai antes da regra nova (no banco de teste; a produção começa vazia)
update public.inscricoes_push
set arquivado_em = now(), motivo_arquivo = 'endereco_recusado'
where arquivado_em is null and not interno.endereco_de_push_aceito(endpoint);

update public.inscricoes_push
set arquivado_em = now(), motivo_arquivo = 'limite'
where id in (
  select x.id from (
    select i.id, row_number() over (partition by i.pessoa_id order by i.criado_em desc, i.id desc) as ordem
    from public.inscricoes_push i
    where i.arquivado_em is null
  ) x
  where x.ordem > 10
);

-- O aparelho ativo só com endereço aceito (o arquivado fica como estava: é histórico)
alter table public.inscricoes_push add constraint inscricoes_push_endereco_aceito
  check (arquivado_em is not null or interno.endereco_de_push_aceito(endpoint));


-- ---------------------------------------------------------------------
-- 2. Registrar o aparelho: o endereço aceito e no máximo 10 por pessoa
-- ---------------------------------------------------------------------
create or replace function interno.registrar_inscricao_push(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- quantos aparelhos ativos cada pessoa pode ter (celular, computador, tablet... com folga)
  c_max_aparelhos constant integer := 10;
  v_eu uuid := (select interno.minha_pessoa_id());
  v_id uuid;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para receber os avisos neste aparelho.' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'O navegador não deu um endereço válido para os avisos.' using errcode = 'P0001';
  end if;
  if not interno.endereco_de_push_aceito(p_endpoint) then
    raise exception 'Este navegador usa um serviço de avisos que o COMEP não reconhece. Use o Chrome, o Edge, o Firefox ou o Safari.'
      using errcode = 'P0001';
  end if;
  -- uma inscrição por vez para a mesma pessoa (duas ao mesmo tempo não passam do limite)
  perform pg_advisory_xact_lock(hashtextextended('comep: aparelhos de ' || v_eu::text, 0));

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
    -- passou do limite: sai o mais antigo (o que acabou de entrar fica)
    update public.inscricoes_push
    set arquivado_em = now(), motivo_arquivo = 'limite'
    where id in (
      select i.id from public.inscricoes_push i
      where i.pessoa_id = v_eu and i.arquivado_em is null
      order by (i.id = v_id) desc, i.criado_em desc, i.id desc
      offset c_max_aparelhos
    );
  end if;
  perform interno.salvar_preferencias_avisos('{"resposta": "ativar"}'::jsonb);
  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. O lote do envio reparte a vez entre as pessoas
-- ---------------------------------------------------------------------
-- O que mandar agora: só para quem ativou, o assunto que a pessoa quer, fora do silêncio da noite (menos o urgente),
-- ainda não lido, dos últimos 3 dias, em cada aparelho inscrito. A ordem: o 1º aviso de cada pessoa (do mais antigo
-- para o mais novo), depois o 2º, depois o 3º; no máximo 3 por pessoa em cada lote, de qualquer assunto (o recado
-- também). O aviso entra inteiro, com todos os aparelhos da pessoa: o lote pode passar do limite em até um aviso
-- (10 linhas), mas nunca corta um aviso no meio (o aparelho que ficasse de fora não receberia mais, porque o aviso
-- já estaria marcado como enviado).
create or replace function interno.push_pendentes(p_limite integer default 200)
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
  -- quantos avisos de uma mesma pessoa entram em cada lote (o resto vai nos lotes seguintes, de 5 em 5 minutos)
  c_avisos_por_pessoa constant integer := 3;
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_hora time := (now() at time zone 'America/Belem')::time;
  v_noite boolean := v_hora >= time '22:00' or v_hora < time '07:00';
begin
  perform interno.gerar_avisos_do_dia();
  return query
  with linhas as (
    select n.id as aviso, n.pessoa_id as pessoa, n.quando as quando_aviso, i.id as aparelho, i.endpoint as e_endpoint,
           i.p256dh as e_p256dh, i.auth as e_auth, n.titulo as e_titulo, n.texto as e_texto, n.link as e_link,
           n.urgente as e_urgente
    from public.notificacoes n
    join public.notificacao_preferencias pr on pr.pessoa_id = n.pessoa_id and pr.arquivado_em is null and pr.ativou_em is not null
    join public.inscricoes_push i on i.pessoa_id = n.pessoa_id and i.arquivado_em is null
    where n.arquivado_em is null and n.push_enviado_em is null and n.lida_em is null
      and n.quando > now() - interval '3 days' and n.push_tentativas < 5
      and not (n.tipo = any (pr.tipos_desligados))
      and (n.urgente or not (pr.silencio_noite and v_noite))
  ),
  avisos as (
    select l.aviso, l.quando_aviso, count(*) as aparelhos,
           row_number() over (partition by l.pessoa order by l.quando_aviso, l.aviso) as vez
    from linhas l
    group by l.aviso, l.pessoa, l.quando_aviso
  ),
  escolhidos as (
    select a.aviso, a.vez, a.quando_aviso,
           coalesce(sum(a.aparelhos) over (order by a.vez, a.quando_aviso, a.aviso
                                           rows between unbounded preceding and 1 preceding), 0) as antes
    from avisos a
    where a.vez <= c_avisos_por_pessoa
  )
  select l.aviso, l.aparelho, l.e_endpoint, l.e_p256dh, l.e_auth, l.e_titulo, l.e_texto, l.e_link, l.e_urgente
  from linhas l
  join escolhidos e on e.aviso = l.aviso
  where e.antes < v_limite
  order by e.vez, e.quando_aviso, e.aviso, l.aparelho;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. O resultado do envio: uma tentativa por aviso a cada rodada
-- ---------------------------------------------------------------------
-- [{ "notificacao_id", "inscricao_id", "ok": bool, "status": número }]. A função de envio manda numa chamada todos
-- os aparelhos de um aviso. Se algum aparelho recebeu, o aviso está enviado; se nenhum recebeu, o aviso ganha UMA
-- tentativa (com 5, sai da fila). Cada aparelho continua com as suas falhas: 404 e 410 = a inscrição acabou (a pessoa
-- desinstalou ou bloqueou) e ela é arquivada; outra resposta do serviço conta uma falha, e 20 seguidas arquivam.
-- Status 0 = não houve resposta (a rede caiu ou passou o tempo-limite do envio): o problema não é do aparelho, e ele
-- fica como estava.
create or replace function interno.push_resultado(p_resultados jsonb)
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

  -- os avisos: enviado se algum aparelho recebeu; senão, uma tentativa a mais
  with r as (
    select (x ->> 'notificacao_id')::uuid as aviso, coalesce((x ->> 'ok')::boolean, false) as ok
    from jsonb_array_elements(p_resultados) x
  ),
  por_aviso as (
    select r.aviso, bool_or(r.ok) as algum_ok from r group by r.aviso
  )
  update public.notificacoes n
  set push_enviado_em = case when p.algum_ok then coalesce(n.push_enviado_em, now()) else n.push_enviado_em end,
      push_tentativas = case when p.algum_ok then n.push_tentativas else n.push_tentativas + 1 end
  from por_aviso p
  where n.id = p.aviso and (p.algum_ok or n.push_enviado_em is null);

  -- os aparelhos
  for v_r in select * from jsonb_array_elements(p_resultados) loop
    if coalesce((v_r ->> 'ok')::boolean, false) then
      update public.inscricoes_push set ultimo_envio_em = now(), falhas = 0
      where id = (v_r ->> 'inscricao_id')::uuid;
    elsif coalesce((v_r ->> 'status')::integer, 0) in (404, 410) then
      update public.inscricoes_push set arquivado_em = now(), motivo_arquivo = 'expirou'
      where id = (v_r ->> 'inscricao_id')::uuid and arquivado_em is null;
    elsif coalesce((v_r ->> 'status')::integer, 0) <> 0 then
      update public.inscricoes_push
      set falhas = falhas + 1,
          arquivado_em = case when falhas + 1 >= 20 then now() end,
          motivo_arquivo = case when falhas + 1 >= 20 then 'falhou' end
      where id = (v_r ->> 'inscricao_id')::uuid and arquivado_em is null;
    end if;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. O recado pelo aplicativo: no máximo 30 por dia para a mesma pessoa
-- ---------------------------------------------------------------------
-- "Mandar pelo aplicativo" (ao lado do WhatsApp, na ficha do ministro): a mesma mensagem, no sino e no celular
create or replace function interno.mandar_recado(p_pessoa_id uuid, p_tipo text, p_titulo text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- quantos recados a mesma pessoa da diretoria manda para a mesma pessoa num dia (o recado não se desliga)
  c_recados_por_dia constant integer := 30;
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
  if (select count(*) from public.notificacoes
      where pessoa_id = p_pessoa_id and enviada_por = v_eu and criado_em >= current_date::timestamptz) >= c_recados_por_dia then
    raise exception 'Você já mandou % recados para esta pessoa hoje. Fale com ela pelo WhatsApp ou mande amanhã.', c_recados_por_dia
      using errcode = 'P0001';
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
