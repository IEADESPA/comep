-- D-10 (homologação, 22/11/2026; desenho aprovado minha-igreja-2, aba Dados): quem preside a igreja pede a correção do
-- NOME e do CNPJ da igreja pelo sistema, com o link "Pedir correção" ao lado de cada um. A Denominação continua só com a
-- secretaria (o desenho não tem o link nela).
--
-- 1. O pedido de correção passa a ser de uma PESSOA ou de uma IGREJA. No da igreja, `pessoa_id` fica nulo e
--    `igreja_id` é a igreja corrigida (no da pessoa, `igreja_id` continua sendo a igreja dela, que deixa quem preside
--    ler o pedido). Os campos `igreja_nome` e `igreja_cnpj` entram na lista fechada.
-- 2. `pedir_correcao_da_igreja`: só quem preside a igreja. O CNPJ passa pela conferência dos dígitos
--    (`interno.cnpj_valido`, que já aceita o alfanumérico da Receita) e não pode ser o de outra igreja.
-- 3. Aceitar aplica sozinho no cadastro da igreja; ninguém aceita o próprio pedido; a resposta vai para o sino de quem
--    pediu (a tabela de notificações), no pedido da igreja e também no da pessoa (este sem o dado, que pode ser o CPF).
--    Nada se apaga.

-- ---------------------------------------------------------------------
-- 1. O pedido é de uma pessoa OU de uma igreja
-- ---------------------------------------------------------------------
alter table public.pedidos_correcao alter column pessoa_id drop not null;

alter table public.pedidos_correcao drop constraint pedidos_correcao_campo;
alter table public.pedidos_correcao
  add constraint pedidos_correcao_campo check (
    campo is null
    or campo in ('nome', 'telefone', 'email', 'cpf', 'nome_mae', 'nome_pai', 'titulo', 'funcao', 'igreja', 'igreja_nome', 'igreja_cnpj')
  ),
  add constraint pedidos_correcao_alvo check (
    (coalesce(campo, '') in ('igreja_nome', 'igreja_cnpj')) = (pessoa_id is null)
    and (pessoa_id is not null or igreja_id is not null)
  );

comment on column public.pedidos_correcao.pessoa_id is
  'A pessoa cujo cadastro se corrige. Nulo no pedido da igreja (campo igreja_nome ou igreja_cnpj).';
comment on column public.pedidos_correcao.igreja_id is
  'No pedido da pessoa, a igreja dela (quem preside lê o pedido). No pedido da igreja, a igreja corrigida.';
comment on column public.pedidos_correcao.campo is
  'O dado da lista fechada (nome, telefone, email, cpf, nome_mae, nome_pai, titulo, funcao, igreja; e, da igreja, '
  'igreja_nome e igreja_cnpj). Nulo = pedido antigo, em texto.';

create or replace function interno.nome_do_campo(p_campo text)
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
    when 'igreja_nome' then 'Nome da igreja'
    when 'igreja_cnpj' then 'CNPJ da igreja'
  end;
$$;

-- ---------------------------------------------------------------------
-- 2. Quem preside pede
-- ---------------------------------------------------------------------
create function interno.pedir_correcao_da_igreja(p_igreja_id uuid, p_campo text, p_valor text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := (select interno.minha_pessoa_id());
  v_atual  text;
  v_pedido text;
  v_id     uuid;
begin
  -- a igreja de outro e a que não existe recebem o mesmo erro (ninguém descobre por aqui quais igrejas existem)
  if v_eu is null
     or p_igreja_id is null
     or p_igreja_id not in (select interno.igrejas_que_presido())
     or not exists (select 1 from public.igrejas g where g.id = p_igreja_id and g.arquivado_em is null) then
    raise exception 'Só quem preside a igreja pede a correção do nome e do CNPJ dela.' using errcode = '42501';
  end if;
  if p_campo is null or p_campo not in ('igreja_nome', 'igreja_cnpj') then
    raise exception 'Escolha na lista o dado da igreja que precisa ser corrigido: o nome ou o CNPJ.' using errcode = 'P0001';
  end if;

  select case p_campo when 'igreja_nome' then g.nome else g.cnpj end
  into v_atual
  from public.igrejas g
  where g.id = p_igreja_id;

  if p_campo = 'igreja_nome' then
    v_pedido := nullif(regexp_replace(trim(coalesce(p_valor, '')), '\s+', ' ', 'g'), '');
    if v_pedido is null or length(v_pedido) not between 3 and 200 then
      raise exception 'Escreva o nome da igreja como deve ficar (de 3 a 200 letras).' using errcode = 'P0001';
    end if;
  else
    -- o CNPJ sem a pontuação; as letras (o CNPJ alfanumérico) em maiúsculas
    v_pedido := upper(regexp_replace(coalesce(p_valor, ''), '[\s./-]', '', 'g'));
    if v_pedido = '' or not interno.cnpj_valido(v_pedido) then
      raise exception 'Confira o CNPJ: são 14 caracteres, e os dois últimos (os dígitos) precisam bater.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.igrejas g where g.cnpj = v_pedido and g.id <> p_igreja_id and g.arquivado_em is null) then
      raise exception 'Este CNPJ já está no cadastro de outra igreja. Fale com a secretaria.' using errcode = 'P0001';
    end if;
  end if;

  if v_pedido is not distinct from v_atual then
    raise exception 'O dado já está assim no cadastro.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.pedidos_correcao
    where igreja_id = p_igreja_id and pessoa_id is null and campo = p_campo and situacao = 'pendente' and arquivado_em is null
  ) then
    raise exception 'Já há um pedido de correção deste dado esperando a secretaria.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.pedidos_correcao
      where pedido_por = v_eu and situacao = 'pendente' and arquivado_em is null) >= 20 then
    raise exception 'Há muitos pedidos esperando a secretaria. Aguarde a resposta dos anteriores.' using errcode = 'P0001';
  end if;

  insert into public.pedidos_correcao (pessoa_id, igreja_id, pedido_por, texto, campo, valor_atual, valor_pedido)
  values (
    null, p_igreja_id, v_eu,
    left(format('%s: %s → %s', interno.nome_do_campo(p_campo), coalesce(v_atual, '(vazio)'), v_pedido), 1000),
    p_campo, v_atual, v_pedido
  )
  returning id into v_id;
  return v_id;
end;
$$;

create function public.pedir_correcao_da_igreja(p_igreja_id uuid, p_campo text, p_valor text)
returns uuid language sql security invoker set search_path = '' as $$
  select interno.pedir_correcao_da_igreja(p_igreja_id, p_campo, p_valor);
$$;

-- ---------------------------------------------------------------------
-- 3. Aceitar aplica sozinho; a resposta vai para o sino
-- ---------------------------------------------------------------------
create or replace function interno.aplicar_correcao(p_pedido public.pedidos_correcao)
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
    when 'igreja_nome' then
      update public.igrejas set nome = p_pedido.valor_pedido where id = p_pedido.igreja_id and arquivado_em is null;
      if not found then
        raise exception 'A igreja não está mais no cadastro. Recuse o pedido com esse motivo.' using errcode = 'P0001';
      end if;
    when 'igreja_cnpj' then
      -- outra igreja pode ter passado a usar o CNPJ depois do pedido
      if exists (
        select 1 from public.igrejas g
        where g.cnpj = p_pedido.valor_pedido and g.id <> p_pedido.igreja_id and g.arquivado_em is null
      ) then
        raise exception 'Este CNPJ já está no cadastro de outra igreja. Recuse o pedido com esse motivo.' using errcode = 'P0001';
      end if;
      update public.igrejas set cnpj = p_pedido.valor_pedido where id = p_pedido.igreja_id and arquivado_em is null;
      if not found then
        raise exception 'A igreja não está mais no cadastro. Recuse o pedido com esse motivo.' using errcode = 'P0001';
      end if;
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
  v_eu     uuid := (select interno.minha_pessoa_id());
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
    if v_pedido.pessoa_id = v_eu then
      raise exception 'Ninguém aceita a correção do próprio cadastro: outra pessoa da secretaria ou da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;
    -- o pedido da igreja: quem pediu (quem preside) não aceita o próprio pedido
    if v_pedido.pessoa_id is null and v_pedido.pedido_por = v_eu then
      raise exception 'Ninguém aceita o próprio pedido: outra pessoa da secretaria ou da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;
    perform interno.aplicar_correcao(v_pedido);
  end if;
  update public.pedidos_correcao
  set situacao = case when p_atendido then 'atendido' else 'recusado' end,
      resposta = nullif(trim(p_resposta), ''),
      respondido_por = v_eu, respondido_em = now()
  where id = p_id;

  -- D-10: a resposta vai para o sino de quem pediu
  if v_pedido.pessoa_id is null then
    -- o pedido da igreja: o nome e o CNPJ da igreja são públicos e vão no aviso
    perform interno.notificar(
      array[v_pedido.pedido_por],
      'recado',
      case when p_atendido then 'Pedido de correção atendido' else 'Pedido de correção recusado' end,
      interno.nome_do_campo(v_pedido.campo) || ': ' || coalesce(v_pedido.valor_pedido, '')
        || case when p_atendido then '. A correção já está no cadastro da igreja.'
                else '. Motivo: ' || trim(p_resposta) end,
      '/minha-igreja',
      'correcao:' || p_id
    );
  else
    -- o pedido da pessoa (plano do D-10: "também para o da pessoa"): SEM o dado pedido no aviso, porque o aviso pode
    -- aparecer na tela do celular, e o dado pode ser o CPF ou a filiação. Quem pediu pode ser o próprio ministro
    -- (Meu perfil › Correções) ou quem preside a igreja dele (Minha igreja › Ministros).
    perform interno.notificar(
      array[v_pedido.pedido_por],
      'recado',
      case when p_atendido then 'Pedido de correção atendido' else 'Pedido de correção recusado' end,
      coalesce(interno.nome_do_campo(v_pedido.campo), 'A correção no cadastro')
        || case when v_pedido.pedido_por = v_pedido.pessoa_id then ''
                else ' de ' || (select p.nome from public.pessoas p where p.id = v_pedido.pessoa_id) end
        || ': '
        || case when not p_atendido then 'o pedido foi recusado. Motivo: ' || trim(p_resposta)
                when v_pedido.campo is null then 'a secretaria atendeu o pedido.'
                when v_pedido.pedido_por = v_pedido.pessoa_id then 'a correção já está no seu cadastro.'
                else 'a correção já está no cadastro.' end,
      case when v_pedido.pedido_por = v_pedido.pessoa_id then '/meu-perfil/correcoes' else '/minha-igreja/ministros' end,
      'correcao:' || p_id
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke all on function interno.nome_do_campo(text) from public;
revoke all on function interno.aplicar_correcao(public.pedidos_correcao) from public;
revoke all on function interno.pedir_correcao_da_igreja(uuid, text, text) from public;
grant execute on function interno.pedir_correcao_da_igreja(uuid, text, text) to authenticated;
revoke all on function public.pedir_correcao_da_igreja(uuid, text, text) from public, anon;
grant execute on function public.pedir_correcao_da_igreja(uuid, text, text) to authenticated;
