-- Ajustes da Parte 14 pedidos pela revisão de 23/11/2026, antes da produção.
--
-- 1. O segredo da portaria ia para a auditoria inteiro (o gatilho copia a linha toda), e quem lê a auditoria (a
--    presidência e o admin técnico) podia refazer o código do minuto e marcar a presença sem estar na portaria.
--    Agora a auditoria guarda "(protegido)" no lugar do segredo, como já faz com o CPF e os nomes dos pais.
--    Os segredos que já passaram pela auditoria (só no banco de teste) deixam de valer: as portarias abertas são
--    arquivadas, e a próxima abertura da portaria cria um segredo novo.
-- 7. A entrada lixo recebe uma mensagem em português, não o erro cru do banco (o nome da regra, em inglês).
-- 8. Depois da primeira assinatura da ata, nada do que entra no texto dela muda: os convidados, a abertura e o
--    roteiro travam, como a pauta e as resoluções já travavam.

-- ---------------------------------------------------------------------
-- 1. A auditoria sem o segredo da portaria
-- ---------------------------------------------------------------------
create or replace function interno.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes  jsonb;
  v_depois jsonb;
  v_campo  text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_depois := to_jsonb(new);
  end if;

  -- Não registra UPDATE que não mudou nada (além do carimbo atualizado_em)
  if tg_op = 'UPDATE' and (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then
    return null;
  end if;

  if tg_table_name = 'pessoas' then
    foreach v_campo in array array['cpf', 'nome_pai', 'nome_mae'] loop
      if v_depois ->> v_campo is not null then
        v_depois := jsonb_set(v_depois, array[v_campo], to_jsonb(
          case when tg_op = 'UPDATE' and (v_antes ->> v_campo) is distinct from (v_depois ->> v_campo)
               then '(protegido — alterado)' else '(protegido)' end));
      end if;
      if v_antes ->> v_campo is not null then
        v_antes := jsonb_set(v_antes, array[v_campo], to_jsonb('(protegido)'::text));
      end if;
    end loop;
  end if;

  -- O segredo da portaria nunca vai para a auditoria: com ele, refaz-se o código de qualquer minuto
  if tg_table_name = 'encontro_portarias' then
    if v_depois ? 'segredo' then
      v_depois := jsonb_set(v_depois, '{segredo}', to_jsonb('(protegido)'::text));
    end if;
    if v_antes ? 'segredo' then
      v_antes := jsonb_set(v_antes, '{segredo}', to_jsonb('(protegido)'::text));
    end if;
  end if;

  insert into public.auditoria (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, coalesce(v_depois ->> 'id', v_antes ->> 'id'), tg_op, v_antes, v_depois, auth.uid());

  return null;
end;
$$;

-- Os segredos que já foram para a auditoria deixam de valer (nada se apaga: a linha é arquivada).
update public.encontro_portarias set arquivado_em = now() where arquivado_em is null;

-- ---------------------------------------------------------------------
-- 7 e 8. O roteiro: o código da pauta conferido antes de virar uuid; trava depois da primeira assinatura da ata
-- ---------------------------------------------------------------------
create or replace function interno.salvar_abertura_do_roteiro(p_encontro_id uuid, p_itens text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_itens text[];
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mudam o roteiro.' using errcode = '42501';
  end if;
  if interno.ata_em_assinatura(p_encontro_id) then
    raise exception 'A ata já começou a ser assinada: o roteiro não muda mais.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(trim(x) order by n), '{}') into v_itens
  from unnest(coalesce(p_itens, '{}')) with ordinality as u(x, n)
  where length(trim(x)) > 0;
  if cardinality(v_itens) > 10 or exists (select 1 from unnest(v_itens) x where length(x) > 120) then
    raise exception 'A abertura tem até 10 itens, cada um com até 120 letras.' using errcode = 'P0001';
  end if;
  update public.encontros set roteiro_abertura = v_itens, roteiro_atual = null
  where id = p_encontro_id and arquivado_em is null and situacao in ('agendado', 'convocado') and presenca_encerrada_em is null;
  if not found then
    raise exception 'Encontro não encontrado ou já encerrado.' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function interno.avancar_roteiro(p_encontro_id uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_valido boolean := p_item is null or p_item = 'encerramento';
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conduzem o roteiro.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found or v_encontro.situacao not in ('convocado', 'realizado') then
    raise exception 'Encontro não encontrado (ou cancelado).' using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(p_encontro_id) then
    raise exception 'A ata já começou a ser assinada: o roteiro não muda mais.' using errcode = 'P0001';
  end if;
  if not v_valido and p_item ~ '^abertura:[0-9]{1,2}$' then
    v_valido := split_part(p_item, ':', 2)::integer < cardinality(v_encontro.roteiro_abertura);
  end if;
  -- o código da pauta é conferido pelo formato do uuid antes da conversão (36 hífens não passam)
  if not v_valido and p_item ~ '^pauta:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_valido := exists (
      select 1 from public.encontro_pauta
      where id = split_part(p_item, ':', 2)::uuid and encontro_id = p_encontro_id and arquivado_em is null
    );
  end if;
  if not v_valido then
    raise exception 'Item do roteiro inválido.' using errcode = 'P0001';
  end if;
  update public.encontros set roteiro_atual = p_item where id = p_encontro_id;
end;
$$;

-- 7. A descrição da pauta que chegou no período: até 2000 letras, com a mensagem em português
create or replace function interno.incluir_na_pauta(p_encontro_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_encontro public.encontros;
  v_titulo text := trim(coalesce(p_dados ->> 'titulo', ''));
  v_descricao text := nullif(trim(coalesce(p_dados ->> 'descricao', '')), '');
  v_deliberativo boolean;
  v_maioria public.maioria_exigida;
  v_ordem integer;
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência juntam pautas ao roteiro.' using errcode = '42501';
  end if;
  select * into v_encontro from public.encontros where id = p_encontro_id and arquivado_em is null for update;
  if not found then
    raise exception 'Encontro não encontrado.' using errcode = 'P0001';
  end if;
  if v_encontro.situacao <> 'convocado' or v_encontro.presenca_encerrada_em is not null then
    raise exception 'Só se junta pauta depois da convocação e antes de encerrar o encontro. Antes de convocar, edite a pauta.'
      using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(p_encontro_id) then
    raise exception 'A ata já começou a ser assinada: o roteiro não muda mais.' using errcode = 'P0001';
  end if;
  begin
    v_deliberativo := coalesce((p_dados ->> 'deliberativo')::boolean, false);
    v_maioria := nullif(p_dados ->> 'maioria', '')::public.maioria_exigida;
  exception when others then
    raise exception 'Dados inválidos.' using errcode = 'P0001';
  end;
  if length(v_titulo) < 1 or length(v_titulo) > 300 then
    raise exception 'Escreva o assunto da pauta (até 300 letras).' using errcode = 'P0001';
  end if;
  if length(coalesce(v_descricao, '')) > 2000 then
    raise exception 'A descrição da pauta tem até 2000 letras.' using errcode = 'P0001';
  end if;
  if v_deliberativo and v_encontro.tipo = 'age' then
    raise exception 'Na AGE só vai a votação o que estava no edital: a pauta nova entra como informe.' using errcode = 'P0001';
  end if;
  if v_deliberativo and v_encontro.tipo = 'reuniao_mensal' then
    raise exception 'A reunião mensal não tem votação: a pauta entra como informe, e a decisão vira resolução.' using errcode = 'P0001';
  end if;
  if v_deliberativo then
    v_maioria := coalesce(v_maioria, 'simples');
  else
    v_maioria := null;
  end if;
  select coalesce(max(ordem), 0) + 1 into v_ordem from public.encontro_pauta where encontro_id = p_encontro_id and arquivado_em is null;
  if v_ordem > 50 then
    raise exception 'A pauta já tem 50 itens.' using errcode = 'P0001';
  end if;
  insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria, origem, incluido_em)
  values (p_encontro_id, v_ordem, v_titulo, v_descricao, v_deliberativo, v_maioria, 'periodo', now())
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7 e 8. Os convidados: o tamanho conferido com mensagem; trava depois da primeira assinatura da ata
-- ---------------------------------------------------------------------
create or replace function interno.registrar_convidado(p_encontro_id uuid, p_nome text, p_quem_e text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_quem_e text := nullif(trim(coalesce(p_quem_e, '')), '');
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência registram os convidados.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.encontros where id = p_encontro_id and arquivado_em is null and situacao = 'convocado'
  ) then
    raise exception 'Só se registra convidado em encontro convocado.' using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(p_encontro_id) then
    raise exception 'A ata já começou a ser assinada: os convidados não mudam mais.' using errcode = 'P0001';
  end if;
  if length(v_nome) < 2 then
    raise exception 'Escreva o nome do convidado.' using errcode = 'P0001';
  end if;
  if length(v_nome) > 150 or length(coalesce(v_quem_e, '')) > 150 then
    raise exception 'O nome e o "quem é" do convidado têm até 150 letras cada um.' using errcode = 'P0001';
  end if;
  insert into public.encontro_convidados (encontro_id, nome, quem_e, registrado_por)
  values (p_encontro_id, v_nome, v_quem_e, (select interno.minha_pessoa_id()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function interno.arquivar_convidado(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.encontro_convidados;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência mexem nos convidados.' using errcode = '42501';
  end if;
  select * into v from public.encontro_convidados where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Convidado não encontrado.' using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(v.encontro_id) then
    raise exception 'A ata já começou a ser assinada: os convidados não mudam mais.' using errcode = 'P0001';
  end if;
  update public.encontro_convidados set arquivado_em = now() where id = p_id;
end;
$$;

-- 7. O motivo da anulação: de 3 a 500 letras, com a mensagem em português
create or replace function interno.anular_resolucao(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.resolucoes;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência anulam uma resolução.' using errcode = '42501';
  end if;
  select * into v from public.resolucoes where id = p_id and arquivado_em is null and anulada_em is null for update;
  if not found then
    raise exception 'Resolução não encontrada (ou já anulada).' using errcode = 'P0001';
  end if;
  if interno.ata_em_assinatura(v.encontro_id) then
    raise exception 'A ata já começou a ser assinada: as resoluções não mudam mais.' using errcode = 'P0001';
  end if;
  if length(v_motivo) < 3 then
    raise exception 'Diga o motivo da anulação.' using errcode = 'P0001';
  end if;
  if length(v_motivo) > 500 then
    raise exception 'O motivo da anulação tem até 500 letras.' using errcode = 'P0001';
  end if;
  update public.resolucoes set anulada_em = now(), motivo_anulacao = v_motivo where id = p_id;
end;
$$;
