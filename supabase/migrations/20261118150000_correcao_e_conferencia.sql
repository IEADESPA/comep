-- Telas novas, parte 4 (Fase 5.5, 18/11/2026): o banco que as telas aprovadas pedem.
--
-- 1. Correção ESTRUTURADA no cadastro (observação do usuário na rodada 5: "nada de texto livre, porque a pessoa
--    digita errado"): o ministro (ou o pastor presidente da igreja dele) escolhe o dado numa lista fechada; o banco
--    guarda como está hoje e como deve ficar; a secretaria aceita (a correção entra sozinha no cadastro) ou recusa
--    com o motivo. O pedido em texto livre deixa de ser aceito.
-- 2. O pedido de associação conferido ITEM POR ITEM (rodadas 5 e 6): dados pessoais, igreja e título, foto 3×4 e o
--    comprovante. Cada item fica em análise, aprovado ou recusado com o motivo; "Mandar para a AGO" só com todos
--    aprovados; ao reenviar, o que foi recusado (ou mudou) volta para a análise.


-- ---------------------------------------------------------------------
-- 1. Correção estruturada
-- ---------------------------------------------------------------------
alter table public.pedidos_correcao
  add column campo            text,
  add column valor_atual      text,
  add column valor_pedido     text,
  add column titulo_pedido_id uuid references public.titulos_ministeriais (id),
  add column igreja_pedida_id uuid references public.igrejas (id);

alter table public.pedidos_correcao
  add constraint pedidos_correcao_campo check (
    campo is null
    or campo in ('nome', 'telefone', 'email', 'cpf', 'nome_mae', 'nome_pai', 'titulo', 'funcao', 'igreja')
  ),
  add constraint pedidos_correcao_valores check (
    campo is null
    or (valor_pedido is not null and length(valor_pedido) between 1 and 300 and coalesce(length(valor_atual), 0) <= 300)
  ),
  add constraint pedidos_correcao_referencia check (
    (campo is distinct from 'titulo' or titulo_pedido_id is not null)
    and (campo is distinct from 'igreja' or igreja_pedida_id is not null)
  );

comment on column public.pedidos_correcao.campo is
  'O dado da lista fechada (nome, telefone, email, cpf, nome_mae, nome_pai, titulo, funcao, igreja). Nulo = pedido antigo, em texto.';
comment on column public.pedidos_correcao.valor_atual is 'Como o dado estava no cadastro quando o pedido foi feito (o banco preenche).';
comment on column public.pedidos_correcao.valor_pedido is 'Como deve ficar. No título e na igreja, o nome do escolhido na lista.';

create index pedidos_correcao_titulo_pedido on public.pedidos_correcao (titulo_pedido_id);
create index pedidos_correcao_igreja_pedida on public.pedidos_correcao (igreja_pedida_id);

-- O pastor presidente vê os pedidos da igreja dele, menos os de CPF e filiação (dado pessoal: só a própria pessoa e
-- a secretaria). Ele também não pede a correção desses dados (ver pedir_correcao_dado).
alter policy "pedidos de correção: quem pediu, o ministro, o pastor presidente e a secretaria leem"
  on public.pedidos_correcao
  using (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or pedido_por = (select interno.minha_pessoa_id())
    or pessoa_id = (select interno.minha_pessoa_id())
    or (igreja_id in (select interno.igrejas_que_presido()) and coalesce(campo, '') not in ('cpf', 'nome_mae', 'nome_pai'))
  );

create function interno.nome_do_campo(p_campo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_campo
    when 'nome' then 'Nome completo'
    when 'telefone' then 'Telefone'
    when 'email' then 'E-mail'
    when 'cpf' then 'CPF'
    when 'nome_mae' then 'Nome da mãe'
    when 'nome_pai' then 'Nome do pai'
    when 'titulo' then 'Título ministerial'
    when 'funcao' then 'Função na igreja'
    when 'igreja' then 'Igreja'
  end;
$$;

-- Como o dado está hoje no cadastro (lê CPF e filiação: só as funções do banco chamam)
create function interno.valor_do_campo(p_pessoa_id uuid, p_campo text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_campo
    when 'nome' then p.nome
    when 'telefone' then p.telefone
    when 'email' then p.email
    when 'cpf' then p.cpf
    when 'nome_mae' then p.nome_mae
    when 'nome_pai' then p.nome_pai
    when 'titulo' then (
      select tm.nome
      from public.titulos_pessoa tp
      join public.titulos_ministeriais tm on tm.id = tp.titulo_id
      where tp.pessoa_id = p.id and tp.arquivado_em is null
      order by tp.criado_em desc
      limit 1
    )
    when 'funcao' then (
      select v.funcao from public.vinculos_igreja v
      where v.pessoa_id = p.id and v.fim is null and v.arquivado_em is null
      limit 1
    )
    when 'igreja' then (
      select i.nome
      from public.vinculos_igreja v
      join public.igrejas i on i.id = v.igreja_id
      where v.pessoa_id = p.id and v.fim is null and v.arquivado_em is null
      limit 1
    )
  end
  from public.pessoas p
  where p.id = p_pessoa_id;
$$;

create function interno.pedir_correcao_dado(p_pessoa_id uuid, p_campo text, p_valor text, p_referencia uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu            uuid := (select interno.minha_pessoa_id());
  v_igreja        uuid;
  v_atual         text;
  v_pedido        text;
  v_titulo        uuid;
  v_igreja_pedida uuid;
  v_id            uuid;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para pedir a correção.' using errcode = '42501';
  end if;
  if not interno.associado_ativo(p_pessoa_id) then
    raise exception 'A correção é do cadastro de um associado ativo.' using errcode = 'P0001';
  end if;
  select v.igreja_id into v_igreja from public.vinculos_igreja v
  where v.pessoa_id = p_pessoa_id and v.fim is null and v.arquivado_em is null
  limit 1;
  if p_pessoa_id <> v_eu and (v_igreja is null or v_igreja not in (select interno.igrejas_que_presido())) then
    raise exception 'Só o próprio ministro ou o pastor presidente da igreja dele pedem a correção.' using errcode = '42501';
  end if;
  if p_campo is null
     or p_campo not in ('nome', 'telefone', 'email', 'cpf', 'nome_mae', 'nome_pai', 'titulo', 'funcao', 'igreja') then
    raise exception 'Escolha na lista o dado que precisa ser corrigido.' using errcode = 'P0001';
  end if;
  if p_campo in ('cpf', 'nome_mae', 'nome_pai') and p_pessoa_id <> v_eu then
    raise exception 'CPF e filiação: só a própria pessoa pede a correção.' using errcode = '42501';
  end if;
  if p_campo = 'email' and exists (select 1 from public.pessoas where id = p_pessoa_id and usuario_id is not null) then
    raise exception 'O e-mail de quem já entra no sistema é o do login e não se corrige por aqui.' using errcode = 'P0001';
  end if;

  v_atual := interno.valor_do_campo(p_pessoa_id, p_campo);

  if p_campo = 'titulo' then
    select t.id, t.nome into v_titulo, v_pedido
    from public.titulos_ministeriais t where t.id = p_referencia and t.arquivado_em is null;
    if v_titulo is null then
      raise exception 'Escolha o título na lista.' using errcode = 'P0001';
    end if;
  elsif p_campo = 'igreja' then
    select i.id, i.nome into v_igreja_pedida, v_pedido
    from public.igrejas i where i.id = p_referencia and i.arquivado_em is null;
    if v_igreja_pedida is null then
      raise exception 'Escolha a igreja na lista.' using errcode = 'P0001';
    end if;
    if v_igreja_pedida = v_igreja then
      raise exception 'O dado já está assim no cadastro.' using errcode = 'P0001';
    end if;
  else
    v_pedido := nullif(trim(regexp_replace(coalesce(p_valor, ''), '\s+', ' ', 'g')), '');
    if v_pedido is null then
      raise exception 'Escreva como o dado deve ficar.' using errcode = 'P0001';
    end if;
    if length(v_pedido) > 300 then
      raise exception 'O texto passou do tamanho (300 letras).' using errcode = 'P0001';
    end if;
    if p_campo = 'cpf' then
      v_pedido := regexp_replace(v_pedido, '[^0-9]', '', 'g');
      if length(v_pedido) <> 11 then
        raise exception 'O CPF tem 11 números.' using errcode = 'P0001';
      end if;
    elsif p_campo = 'telefone' then
      if length(regexp_replace(v_pedido, '[^0-9]', '', 'g')) not between 10 and 13 then
        raise exception 'Confira o telefone, com o DDD.' using errcode = 'P0001';
      end if;
    elsif p_campo = 'email' then
      v_pedido := lower(v_pedido);
      if v_pedido !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' then
        raise exception 'Confira o e-mail.' using errcode = 'P0001';
      end if;
    elsif p_campo = 'nome' and length(v_pedido) < 5 then
      raise exception 'Escreva o nome completo.' using errcode = 'P0001';
    elsif p_campo = 'funcao' and v_igreja is null then
      raise exception 'O ministro está sem igreja no cadastro: peça antes a correção da igreja.' using errcode = 'P0001';
    end if;
  end if;

  if v_pedido is not distinct from v_atual then
    raise exception 'O dado já está assim no cadastro.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.pedidos_correcao
    where pessoa_id = p_pessoa_id and campo = p_campo and situacao = 'pendente' and arquivado_em is null
  ) then
    raise exception 'Já há um pedido de correção deste dado esperando a secretaria.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.pedidos_correcao
      where pedido_por = v_eu and situacao = 'pendente' and arquivado_em is null) >= 20 then
    raise exception 'Há muitos pedidos esperando a secretaria. Aguarde a resposta dos anteriores.' using errcode = 'P0001';
  end if;

  insert into public.pedidos_correcao
    (pessoa_id, igreja_id, pedido_por, texto, campo, valor_atual, valor_pedido, titulo_pedido_id, igreja_pedida_id)
  values (
    p_pessoa_id, v_igreja, v_eu,
    left(format('%s: %s → %s', interno.nome_do_campo(p_campo), coalesce(v_atual, '(vazio)'), v_pedido), 1000),
    p_campo, v_atual, v_pedido, v_titulo, v_igreja_pedida
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Aceita: a correção entra sozinha no cadastro (só as funções do banco chamam)
create function interno.aplicar_correcao(p_pedido public.pedidos_correcao)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_funcao text;
begin
  case p_pedido.campo
    when 'nome' then
      update public.pessoas set nome = p_pedido.valor_pedido where id = p_pedido.pessoa_id;
    when 'telefone' then
      update public.pessoas set telefone = p_pedido.valor_pedido where id = p_pedido.pessoa_id;
    when 'email' then
      if exists (select 1 from public.pessoas where id = p_pedido.pessoa_id and usuario_id is not null) then
        raise exception 'O ministro já entra no sistema: o e-mail é o do login. Recuse o pedido com esse motivo.' using errcode = 'P0001';
      end if;
      update public.pessoas set email = p_pedido.valor_pedido where id = p_pedido.pessoa_id;
    when 'cpf', 'nome_mae', 'nome_pai' then
      if interno.gravar_identidade(p_pedido.pessoa_id, jsonb_build_object(p_pedido.campo, p_pedido.valor_pedido)) = 'cpf_repetido' then
        raise exception 'Este CPF já está no cadastro de outra pessoa. Recuse o pedido com esse motivo.' using errcode = 'P0001';
      end if;
    when 'titulo' then
      insert into public.titulos_pessoa (pessoa_id, titulo_id) values (p_pedido.pessoa_id, p_pedido.titulo_pedido_id);
    when 'funcao' then
      update public.vinculos_igreja set funcao = p_pedido.valor_pedido
      where pessoa_id = p_pedido.pessoa_id and fim is null and arquivado_em is null;
      if not found then
        raise exception 'O ministro está sem igreja no cadastro: corrija a igreja antes.' using errcode = 'P0001';
      end if;
    when 'igreja' then
      select v.funcao into v_funcao from public.vinculos_igreja v
      where v.pessoa_id = p_pedido.pessoa_id and v.fim is null and v.arquivado_em is null
      limit 1;
      -- cadastro errado: a igreja certa entra hoje e a anterior fica no histórico (como na troca de igreja)
      perform public.mudar_igreja(p_pedido.pessoa_id, p_pedido.igreja_pedida_id, v_funcao, current_date, false);
    else
      raise exception 'Dado desconhecido.' using errcode = 'P0001';
  end case;
end;
$$;

create or replace function interno.responder_correcao(p_id uuid, p_atendido boolean, p_resposta text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_correcao;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência respondem os pedidos de correção.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos_correcao where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.situacao <> 'pendente' then
    raise exception 'Este pedido já foi respondido.' using errcode = 'P0001';
  end if;
  if p_atendido is null then
    raise exception 'Diga se o pedido foi atendido.' using errcode = 'P0001';
  end if;
  if not p_atendido and coalesce(trim(p_resposta), '') = '' then
    raise exception 'Para recusar, diga o motivo.' using errcode = 'P0001';
  end if;
  if p_atendido and v_pedido.campo is not null then
    if v_pedido.pessoa_id = (select interno.minha_pessoa_id()) then
      raise exception 'Ninguém aceita a correção do próprio cadastro: outra pessoa da secretaria ou da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;
    perform interno.aplicar_correcao(v_pedido);
  end if;
  update public.pedidos_correcao
  set situacao = case when p_atendido then 'atendido' else 'recusado' end,
      resposta = nullif(trim(p_resposta), ''),
      respondido_por = (select interno.minha_pessoa_id()), respondido_em = now()
  where id = p_id;
end;
$$;

create function public.pedir_correcao_dado(p_pessoa_id uuid, p_campo text, p_valor text, p_referencia uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.pedir_correcao_dado(p_pessoa_id, p_campo, p_valor, p_referencia);
$$;

-- Nada de texto livre: o pedido antigo (só o texto) deixa de ser aceito pela API
revoke execute on function public.pedir_correcao(uuid, text) from authenticated;
revoke execute on function interno.pedir_correcao(uuid, text) from authenticated;

revoke all on function interno.nome_do_campo(text) from public;
revoke all on function interno.valor_do_campo(uuid, text) from public;
revoke all on function interno.aplicar_correcao(public.pedidos_correcao) from public;
revoke all on function interno.pedir_correcao_dado(uuid, text, text, uuid) from public;
grant execute on function interno.pedir_correcao_dado(uuid, text, text, uuid) to authenticated;
revoke all on function public.pedir_correcao_dado(uuid, text, text, uuid) from public, anon;
grant execute on function public.pedir_correcao_dado(uuid, text, text, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 2. O pedido de associação conferido item por item
-- ---------------------------------------------------------------------
create table public.pedidos_associacao_itens (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid not null references public.pedidos_associacao (id),
  item          text not null check (item in ('dados_pessoais', 'igreja_titulo', 'foto', 'comprovante')),
  situacao      text not null default 'analise' check (situacao in ('analise', 'aprovado', 'recusado')),
  motivo        text check (motivo is null or length(motivo) <= 500),
  conferido_por uuid references public.pessoas (id),
  conferido_em  timestamptz,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint pedidos_associacao_itens_unico unique (pedido_id, item),
  constraint pedidos_associacao_itens_motivo check (situacao <> 'recusado' or length(trim(coalesce(motivo, ''))) > 0)
);
comment on table public.pedidos_associacao_itens is
  'A conferência da secretaria em cada item do pedido de associação (18/11/2026). Sem linha = em análise.';
create index pedidos_associacao_itens_conferido_por on public.pedidos_associacao_itens (conferido_por);
select interno.aplicar_padroes('public.pedidos_associacao_itens');

revoke all on public.pedidos_associacao_itens from anon, authenticated;
grant select on public.pedidos_associacao_itens to authenticated;
alter table public.pedidos_associacao_itens enable row level security;
create policy "itens do pedido: o candidato e a secretaria leem"
  on public.pedidos_associacao_itens for select to authenticated
  using (
    (select interno.tenho_perfil('secretaria', 'presidencia'))
    or pedido_id in (select p.id from public.pedidos_associacao p where p.pessoa_id = (select interno.minha_pessoa_id()))
  );

create function interno.itens_do_pedido()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['dados_pessoais', 'igreja_titulo', 'foto', 'comprovante']; $$;

create function interno.conferir_item_pedido(p_pedido_id uuid, p_item text, p_aprovado boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := (select interno.minha_pessoa_id());
  v_pedido public.pedidos_associacao;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conferem o pedido de associação.' using errcode = '42501';
  end if;
  select * into v_pedido from public.pedidos_associacao where id = p_pedido_id and arquivado_em is null for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;
  if v_pedido.pessoa_id = v_eu then
    raise exception 'Ninguém confere o próprio pedido: outra pessoa da secretaria ou da presidência precisa fazer isso.'
      using errcode = '42501';
  end if;
  if v_pedido.situacao not in ('enviado', 'pendencia') then
    raise exception 'Este pedido não está mais em análise.' using errcode = 'P0001';
  end if;
  if p_item is null or not (p_item = any (interno.itens_do_pedido())) then
    raise exception 'Item do pedido desconhecido.' using errcode = 'P0001';
  end if;
  if p_aprovado is null then
    raise exception 'Diga se o item foi aprovado ou recusado.' using errcode = 'P0001';
  end if;
  if not p_aprovado and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para recusar, diga o motivo.' using errcode = 'P0001';
  end if;
  insert into public.pedidos_associacao_itens (pedido_id, item, situacao, motivo, conferido_por, conferido_em)
  values (
    p_pedido_id, p_item,
    case when p_aprovado then 'aprovado' else 'recusado' end,
    case when p_aprovado then null else left(trim(p_motivo), 500) end,
    v_eu, now()
  )
  on conflict (pedido_id, item) do update
  set situacao = excluded.situacao, motivo = excluded.motivo,
      conferido_por = excluded.conferido_por, conferido_em = excluded.conferido_em;
end;
$$;

-- Os pedidos que a diretoria já tinha aceitado inteiros (antes da conferência por item) contam como conferidos
insert into public.pedidos_associacao_itens (pedido_id, item, situacao, conferido_por, conferido_em)
select p.id, i.item, 'aprovado', p.aceite_diretor_por, coalesce(p.aceite_diretor_em, p.atualizado_em)
from public.pedidos_associacao p
cross join unnest(interno.itens_do_pedido()) as i (item)
where p.situacao in ('aguardando_assembleia', 'aprovado') and p.arquivado_em is null;

-- "Mandar para a AGO" só com todos os itens aprovados. O nome do gatilho vem depois de "regras_pedido" (a ordem é a
-- do nome): primeiro valem as regras de sempre (quem decide, a igreja cadastrada), depois a conferência.
create function interno.regras_pedido_itens()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao = 'aguardando_assembleia' and old.situacao is distinct from 'aguardando_assembleia' then
    if (select count(*) from public.pedidos_associacao_itens i
        where i.pedido_id = new.id and i.situacao = 'aprovado' and i.arquivado_em is null)
       < cardinality(interno.itens_do_pedido()) then
      raise exception 'Confira e aprove todos os itens do pedido antes de mandar para a AGO.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger regras_pedido_itens
  before update on public.pedidos_associacao
  for each row execute function interno.regras_pedido_itens();

-- O candidato reenviou: o que foi recusado (ou o que ele mudou) volta para a análise
create function interno.itens_voltam_para_analise()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.situacao = 'enviado' and old.situacao = 'pendencia' then
    update public.pedidos_associacao_itens
    set situacao = 'analise', motivo = null, conferido_por = null, conferido_em = null
    where pedido_id = new.id
      and situacao <> 'analise'
      and (
        situacao = 'recusado'
        or (item = 'foto' and new.foto_caminho is distinct from old.foto_caminho)
        or (item = 'comprovante' and new.comprovante_caminho is distinct from old.comprovante_caminho)
        or (item = 'igreja_titulo' and (
              new.titulo_id, new.titulo_desde, new.igreja_id, new.igreja_informada, new.denominacao_informada,
              new.funcao, new.pastor_presidente
            ) is distinct from (
              old.titulo_id, old.titulo_desde, old.igreja_id, old.igreja_informada, old.denominacao_informada,
              old.funcao, old.pastor_presidente
            ))
      );
  end if;
  return new;
end;
$$;

create trigger itens_voltam_para_analise
  after update on public.pedidos_associacao
  for each row execute function interno.itens_voltam_para_analise();

create function public.conferir_item_pedido(p_pedido_id uuid, p_item text, p_aprovado boolean, p_motivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.conferir_item_pedido(p_pedido_id, p_item, p_aprovado, p_motivo);
$$;

revoke all on function interno.itens_do_pedido() from public;
revoke all on function interno.regras_pedido_itens() from public;
revoke all on function interno.itens_voltam_para_analise() from public;
revoke all on function interno.conferir_item_pedido(uuid, text, boolean, text) from public;
grant execute on function interno.conferir_item_pedido(uuid, text, boolean, text) to authenticated;
revoke all on function public.conferir_item_pedido(uuid, text, boolean, text) from public, anon;
grant execute on function public.conferir_item_pedido(uuid, text, boolean, text) to authenticated;
