-- =====================================================================
-- REVISÃO GERAL DE SEGURANÇA ANTES DO LANÇAMENTO (trava da entrega 1.4)
-- Correções dos achados da revisão independente (docs/revisoes/fase-1.md).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. (ALTO) Código de acesso para quem é da diretoria: só a presidência gera.
--    Antes, a secretaria ou o administrador técnico podiam gerar um código de
--    "nova senha" para a presidência e entrar no lugar dela.
-- 5. Código não vale para pessoa arquivada.
-- ---------------------------------------------------------------------
create or replace function interno.gerar_codigo_acesso(p_pessoa_id uuid, p_finalidade public.finalidade_codigo)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario   uuid;
  v_arquivada timestamptz;
  v_codigo    text;
  v_id        uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia', 'admin_tecnico')) then
    raise exception 'Só a secretaria, a presidência ou o administrador técnico geram códigos de acesso.' using errcode = '42501';
  end if;

  select usuario_id, arquivado_em into v_usuario, v_arquivada from public.pessoas where id = p_pessoa_id;
  if not found or v_arquivada is not null then
    raise exception 'Pessoa não encontrada.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.perfis_acesso pa
    where pa.pessoa_id = p_pessoa_id
      and pa.arquivado_em is null
      and pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'admin_tecnico')
  ) and not (select interno.tenho_perfil('presidencia')) then
    raise exception 'Esta pessoa tem perfil da diretoria: só a presidência gera o código de acesso dela.' using errcode = '42501';
  end if;

  if p_finalidade = 'primeiro_acesso' and v_usuario is not null then
    raise exception 'Esta pessoa já tem login. Para trocar a senha, gere um código de nova senha.' using errcode = 'P0001';
  end if;
  if p_finalidade = 'nova_senha' and v_usuario is null then
    raise exception 'Esta pessoa ainda não tem login. Gere um código de primeiro acesso.' using errcode = 'P0001';
  end if;

  update public.codigos_acesso
  set arquivado_em = now()
  where pessoa_id = p_pessoa_id and finalidade = p_finalidade and usado_em is null and arquivado_em is null;

  v_codigo := interno.novo_codigo();
  insert into public.codigos_acesso (pessoa_id, finalidade, expira_em)
  values (p_pessoa_id, p_finalidade, now() + interval '7 days')
  returning id into v_id;
  insert into interno.codigos_segredos (codigo_id, hash) values (v_id, interno.hash_codigo(v_codigo));

  return v_codigo;
end;
$$;

create or replace function interno.codigo_valido(p_codigo text, p_finalidade public.finalidade_codigo)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from interno.codigos_segredos s
  join public.codigos_acesso c on c.id = s.codigo_id
  join public.pessoas p on p.id = c.pessoa_id
  where s.hash = interno.hash_codigo(p_codigo)
    and c.finalidade = p_finalidade
    and c.usado_em is null
    and c.arquivado_em is null
    and c.expira_em > now()
    and p.arquivado_em is null;
$$;


-- ---------------------------------------------------------------------
-- 5. Senha esquecida: o código é travado e gasto uma vez só (duas chamadas ao
--    mesmo tempo não passam), e as sessões abertas daquele login são encerradas.
-- ---------------------------------------------------------------------
create or replace function interno.redefinir_senha_com_codigo(p_email text, p_codigo text, p_senha text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo_id uuid;
  v_usuario   uuid;
begin
  if length(coalesce(p_senha, '')) < 8 or p_senha !~ '[A-Za-z]' or p_senha !~ '[0-9]' then
    raise exception 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' using errcode = 'P0001';
  end if;

  v_codigo_id := interno.codigo_valido(p_codigo, 'nova_senha');
  if v_codigo_id is not null then
    -- Trava o código: uma segunda chamada simultânea espera e depois o encontra já usado
    perform 1 from public.codigos_acesso where id = v_codigo_id and usado_em is null for update;
    if not found then
      v_codigo_id := null;
    end if;
  end if;

  select p.usuario_id into v_usuario
  from public.codigos_acesso c
  join public.pessoas p on p.id = c.pessoa_id
  where c.id = v_codigo_id;

  if v_codigo_id is null or v_usuario is null or not exists (
    select 1 from auth.users u where u.id = v_usuario and lower(u.email) = lower(trim(p_email))
  ) then
    raise exception 'O código ou o e-mail não conferem. Confira os dois ou peça um código novo à secretaria.'
      using errcode = 'P0001';
  end if;

  update public.codigos_acesso set usado_em = now() where id = v_codigo_id and usado_em is null;
  if not found then
    raise exception 'Este código acabou de ser usado. Peça um código novo à secretaria.' using errcode = 'P0001';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
      updated_at = now()
  where id = v_usuario;

  -- Quem estava logado com a senha antiga (em qualquer aparelho) precisa entrar de novo
  delete from auth.refresh_tokens where user_id = v_usuario::text;
  delete from auth.sessions where user_id = v_usuario;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Primeiro acesso: depois de usado, o código é apagado do cadastro do login
--    (não fica guardado em auth.users nem nas próximas sessões).
-- ---------------------------------------------------------------------
create or replace function interno.criar_pessoa_para_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo_id uuid;
  v_pessoa_id uuid;
  v_ligado    boolean := false;
begin
  if coalesce(new.raw_user_meta_data ->> 'codigo_acesso', '') <> '' then
    v_codigo_id := interno.codigo_valido(new.raw_user_meta_data ->> 'codigo_acesso', 'primeiro_acesso');
    if v_codigo_id is not null then
      select pessoa_id into v_pessoa_id from public.codigos_acesso where id = v_codigo_id;
      update public.pessoas
      set usuario_id = new.id, email = new.email
      where id = v_pessoa_id and usuario_id is null and arquivado_em is null;
      v_ligado := found;
      if v_ligado then
        update public.codigos_acesso set usado_em = now() where id = v_codigo_id;
      end if;
    end if;
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'codigo_acesso' where id = new.id;
  end if;

  if v_ligado then
    return new;
  end if;

  insert into public.pessoas (usuario_id, nome, email, criado_por)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sem nome'
    ),
    new.email,
    new.id
  );
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. (ALTO) Perfis da diretoria só para associados ativos.
--    Com o cadastro aberto, qualquer um cria login com o nome e o e-mail que
--    quiser. Associado ativo foi conferido (cadastro da secretaria + código, ou
--    aprovação em assembleia). Vale para quem usa o sistema; a manutenção pelo
--    dono do banco (sem login, ex.: primeiro acesso no lançamento) não é barrada.
-- ---------------------------------------------------------------------
create function interno.validar_concessao_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.perfil in ('secretaria', 'tesouraria', 'presidencia')
     and not exists (
       select 1 from public.associados a
       where a.pessoa_id = new.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
     ) then
    raise exception 'Os perfis da diretoria só podem ser dados a associados ativos. Confira se é a pessoa certa: um login criado pelo site ainda não foi conferido.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger validar_concessao_perfil
  before insert on public.perfis_acesso
  for each row execute function interno.validar_concessao_perfil();


-- ---------------------------------------------------------------------
-- 10. Último perfil de Presidência: duas retiradas ao mesmo tempo não passam juntas.
-- ---------------------------------------------------------------------
create or replace function interno.proteger_ultima_presidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.perfil = 'presidencia' and old.arquivado_em is null and new.arquivado_em is not null then
    perform pg_advisory_xact_lock(hashtext('comep.ultima_presidencia'));
    if not exists (
      select 1
      from public.perfis_acesso pa
      join public.pessoas p on p.id = pa.pessoa_id
      where pa.perfil = 'presidencia'
        and pa.arquivado_em is null
        and p.arquivado_em is null
        and pa.id <> old.id
    ) then
      raise exception 'Não é possível retirar o último perfil de Presidência: ninguém mais poderia conceder acessos.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Caminhos de arquivo: sem "..", sem "//" e sempre na pasta da própria pessoa.
-- ---------------------------------------------------------------------
create function interno.caminho_seguro(p_caminho text, p_pessoa_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_caminho is null
      or (
        left(p_caminho, length('pessoas/' || p_pessoa_id || '/')) = 'pessoas/' || p_pessoa_id || '/'
        and position('..' in p_caminho) = 0
        and position('//' in p_caminho) = 0
      );
$$;

create or replace function interno.validar_foto_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not interno.caminho_seguro(new.foto_caminho, new.id) then
    raise exception 'A foto precisa ser um arquivo da pasta da própria pessoa.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function interno.exigir_dados_pedido(p public.pedidos_associacao)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p.titulo_id is null then
    raise exception 'Informe o título ministerial (Art. 7º).' using errcode = 'P0001';
  end if;
  if p.igreja_id is null and coalesce(trim(p.igreja_informada), '') = '' then
    raise exception 'Informe a sua igreja (Art. 7º, §1º).' using errcode = 'P0001';
  end if;
  if p.foto_caminho is null then
    raise exception 'Envie uma foto.' using errcode = 'P0001';
  end if;
  if p.comprovante_caminho is null then
    raise exception 'Envie o comprovante do título (credencial ou certificado).' using errcode = 'P0001';
  end if;
  if not interno.caminho_seguro(p.foto_caminho, p.pessoa_id) or not interno.caminho_seguro(p.comprovante_caminho, p.pessoa_id) then
    raise exception 'Os arquivos do pedido precisam ser os enviados pelo próprio candidato.' using errcode = 'P0001';
  end if;
  if not (p.declara_principios_fe and p.declara_estatuto and p.consente_lgpd) then
    raise exception 'É preciso marcar as três declarações (princípios de fé, estatuto e LGPD).' using errcode = 'P0001';
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 6 e 9. Pedido de associação:
--   * em análise ("enviado"), o candidato não altera nada (só pode desistir);
--     para corrigir, a secretaria devolve com pendência;
--   * ninguém decide o próprio pedido;
--   * "aprovado" só com o associado criado para a mesma pessoa.
-- ---------------------------------------------------------------------
create or replace function interno.regras_pedido()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_eu        uuid := (select interno.minha_pessoa_id());
begin
  if tg_op = 'INSERT' then
    new.situacao := 'enviado';
    new.enviado_em := now();
    new.declaracoes_em := now();
    new.mensagem_pendencia := null;
    new.motivo_recusa := null;
    new.assembleia_data := null;
    new.assembleia_ata := null;
    new.associado_id := null;
    new.aceite_diretor_por := null;
    new.aceite_diretor_em := null;
    new.decisao_por := null;
    new.decisao_em := null;
    perform interno.exigir_dados_pedido(new);
    return new;
  end if;

  if new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'O pedido não pode mudar de pessoa.' using errcode = 'P0001';
  end if;
  if old.situacao in ('aprovado', 'recusado', 'desistiu') then
    raise exception 'Este pedido já foi encerrado e não pode mais ser alterado.' using errcode = 'P0001';
  end if;

  if not v_diretoria then
    if new.mensagem_pendencia is distinct from old.mensagem_pendencia
       or new.motivo_recusa is distinct from old.motivo_recusa
       or new.assembleia_data is distinct from old.assembleia_data
       or new.assembleia_ata is distinct from old.assembleia_ata
       or new.associado_id is distinct from old.associado_id then
      raise exception 'Só a diretoria registra a análise do pedido.' using errcode = '42501';
    end if;
    if old.situacao = 'aguardando_assembleia' then
      raise exception 'O pedido já foi encaminhado à assembleia e não pode mais ser alterado.' using errcode = 'P0001';
    end if;
    if old.situacao = 'enviado' and new.situacao is distinct from 'desistiu' then
      raise exception 'O pedido está em análise e não pode ser alterado. Para corrigir algo, peça à secretaria que o devolva com pendência.'
        using errcode = 'P0001';
    end if;
  end if;

  if new.situacao is distinct from old.situacao then
    if new.situacao in ('pendencia', 'aguardando_assembleia', 'recusado', 'aprovado') and new.pessoa_id = v_eu then
      raise exception 'Ninguém decide o próprio pedido: outra pessoa da secretaria ou da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;

    if new.situacao = 'enviado' and old.situacao = 'pendencia' and new.pessoa_id = v_eu then
      new.enviado_em := now();
      new.declaracoes_em := now();
      perform interno.exigir_dados_pedido(new);
    elsif new.situacao = 'desistiu' and new.pessoa_id = v_eu then
      new.decisao_por := v_eu;
      new.decisao_em := now();
    elsif new.situacao = 'pendencia' and old.situacao = 'enviado' and v_diretoria then
      if coalesce(trim(new.mensagem_pendencia), '') = '' then
        raise exception 'Escreva o que o candidato precisa corrigir.' using errcode = 'P0001';
      end if;
    elsif new.situacao = 'aguardando_assembleia' and old.situacao in ('enviado', 'pendencia') and v_diretoria then
      if new.igreja_id is null then
        raise exception 'Escolha a igreja cadastrada do candidato antes de encaminhar (cadastre a igreja, se preciso).'
          using errcode = 'P0001';
      end if;
      perform interno.exigir_dados_pedido(new);
      new.aceite_diretor_por := v_eu;
      new.aceite_diretor_em := now();
    elsif new.situacao = 'recusado' and v_diretoria then
      if coalesce(trim(new.motivo_recusa), '') = '' then
        raise exception 'Informe o motivo da recusa.' using errcode = 'P0001';
      end if;
      new.decisao_por := v_eu;
      new.decisao_em := now();
    elsif new.situacao = 'aprovado' and old.situacao = 'aguardando_assembleia' and v_diretoria then
      if new.assembleia_data is null or new.assembleia_data > current_date then
        raise exception 'Informe a data da Assembleia Ordinária que aprovou (não pode ser data futura).' using errcode = 'P0001';
      end if;
      if new.associado_id is null or not exists (
        select 1 from public.associados a where a.id = new.associado_id and a.pessoa_id = new.pessoa_id
      ) then
        raise exception 'Use "Registrar aprovação" para aprovar o pedido.' using errcode = 'P0001';
      end if;
      new.decisao_por := v_eu;
      new.decisao_em := now();
    else
      raise exception 'Mudança de situação não permitida (de % para %).', old.situacao, new.situacao
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 6 e 9. Pedido de troca de igreja: pendente, o ministro só pode cancelar
-- (não muda os dados depois que a secretaria viu); ninguém decide o próprio.
-- ---------------------------------------------------------------------
create or replace function interno.regras_troca_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_eu        uuid := (select interno.minha_pessoa_id());
begin
  if tg_op = 'INSERT' then
    new.situacao := 'pendente';
    new.motivo_recusa := null;
    new.decidido_por := null;
    new.decidido_em := null;
    if new.igreja_id is null and coalesce(trim(new.igreja_informada), '') = '' then
      raise exception 'Escolha a igreja nova (ou escreva o nome dela, se não estiver na lista).' using errcode = 'P0001';
    end if;
    if new.igreja_id is not null and exists (
      select 1 from public.vinculos_igreja
      where pessoa_id = new.pessoa_id and igreja_id = new.igreja_id and fim is null and arquivado_em is null
    ) then
      raise exception 'Você já está nesta igreja.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.pessoa_id is distinct from old.pessoa_id then
    raise exception 'O pedido não pode mudar de pessoa.' using errcode = 'P0001';
  end if;
  if old.situacao <> 'pendente' then
    raise exception 'Este pedido já foi decidido e não pode mais ser alterado.' using errcode = 'P0001';
  end if;

  if not v_diretoria then
    if new.situacao in ('aprovado', 'recusado') or new.motivo_recusa is distinct from old.motivo_recusa then
      raise exception 'Só a secretaria ou a presidência decidem o pedido de troca.' using errcode = '42501';
    end if;
    if new.situacao is distinct from 'cancelado' then
      raise exception 'O pedido de troca não pode ser alterado depois de enviado. Cancele e faça outro.' using errcode = 'P0001';
    end if;
  end if;

  if new.situacao is distinct from old.situacao then
    if new.situacao in ('aprovado', 'recusado') and new.pessoa_id = v_eu then
      raise exception 'Ninguém decide o próprio pedido: outra pessoa da secretaria ou da presidência precisa fazer isso.'
        using errcode = '42501';
    end if;
    if new.situacao = 'cancelado' and new.pessoa_id = v_eu then
      null;
    elsif new.situacao = 'recusado' and v_diretoria then
      if coalesce(trim(new.motivo_recusa), '') = '' then
        raise exception 'Informe o motivo da recusa.' using errcode = 'P0001';
      end if;
    elsif new.situacao = 'aprovado' and v_diretoria then
      if new.igreja_id is null then
        raise exception 'Escolha a igreja cadastrada antes de aprovar.' using errcode = 'P0001';
      end if;
    else
      raise exception 'Mudança de situação não permitida (de % para %).', old.situacao, new.situacao
        using errcode = 'P0001';
    end if;
    new.decidido_por := v_eu;
    new.decidido_em := now();
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 4 e 7. Arquivos: no máximo 30 por pessoa (evita abuso do espaço gratuito por
-- logins criados só para isso) e nenhum caminho com "..".
-- ---------------------------------------------------------------------
create function interno.quantos_arquivos_tenho()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects o
  where o.bucket_id = 'documentos'
    and (storage.foldername(o.name))[2] = (select interno.minha_pessoa_id())::text;
$$;

drop policy "documentos: cada um envia para a própria pasta" on storage.objects;
create policy "documentos: cada um envia para a própria pasta (até 30 arquivos)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = 'pessoas'
    and (storage.foldername(name))[2] = (select interno.minha_pessoa_id())::text
    and position('..' in name) = 0
    and position('//' in name) = 0
    and (select interno.quantos_arquivos_tenho()) < 30
  );


-- ---------------------------------------------------------------------
-- Quem pode executar as funções novas
-- ---------------------------------------------------------------------
revoke all on function interno.validar_concessao_perfil() from public;
revoke all on function interno.caminho_seguro(text, uuid) from public;
revoke all on function interno.quantos_arquivos_tenho() from public;
grant execute on function interno.caminho_seguro(text, uuid) to authenticated;
grant execute on function interno.quantos_arquivos_tenho() to authenticated;
