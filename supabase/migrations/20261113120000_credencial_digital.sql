-- =====================================================================
-- Fase 3.2/3.3 — Credencial digital, validação pública pelo QR Code e impressão
-- (PROJETO.md, seção 4.5; decisões de 12/11/2026)
--
--   * cada associado tem UMA credencial ativa, com um código aleatório (não dá para adivinhar);
--     o QR Code abre /validar/<código>, que mostra a situação DE AGORA: ativo, em dia ou inapto
--     para votar (Art. 11) e a validade até o fim do mandato da diretoria em curso — sem data
--     impressa e sem reimpressão;
--   * perdeu a credencial? A secretaria emite outra: o QR antigo passa a dizer "substituída";
--   * a foto da página pública é uma CÓPIA, numa pasta pública com o nome do código
--     (só quem tem o QR acha); o original continua na pasta privada. Nada se sobrescreve;
--   * Configurações → Credencial: fim do mandato atual e o texto do verso.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Configuração da credencial (uma linha)
-- ---------------------------------------------------------------------
create table public.config_credencial (
  id            boolean primary key default true check (id),
  fim_mandato   date,
  texto_verso   text not null default
    'Credencial pessoal e intransferível de associado do Conselho de Ministros Evangélicos de Parauapebas (COMEP). '
    || 'A situação atual — ativo, em dia com a contribuição e validade — é conferida pelo QR Code, sem necessidade de reimpressão.',
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint config_credencial_texto check (length(trim(texto_verso)) between 1 and 600)
);
comment on table public.config_credencial is 'Fim do mandato da diretoria em curso (validade das credenciais) e texto do verso.';
comment on column public.config_credencial.fim_mandato is 'Vazio = credencial vale enquanto o associado estiver ativo. Na posse da nova diretoria, muda aqui e todas as credenciais acompanham.';
select interno.aplicar_padroes('public.config_credencial');
insert into public.config_credencial (id) values (true);


-- ---------------------------------------------------------------------
-- 2. Credenciais (uma ativa por pessoa)
-- ---------------------------------------------------------------------
create table public.credenciais (
  id                  uuid primary key default gen_random_uuid(),
  pessoa_id           uuid not null references public.pessoas (id),
  codigo              text not null unique check (codigo ~ '^[0-9a-f]{32}$'),
  foto_publica        text,
  substituida_em      timestamptz,
  motivo_substituicao text,
  arquivado_em        timestamptz,
  criado_por          uuid default auth.uid(),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
comment on table public.credenciais is 'Credencial de cada associado: o código do QR Code. Perdeu? Substitui (a antiga fica registrada).';
comment on column public.credenciais.foto_publica is 'Caminho da cópia da foto na pasta pública "credenciais" (<código>/<arquivo>).';
create unique index credenciais_uma_ativa on public.credenciais (pessoa_id) where substituida_em is null and arquivado_em is null;
create index credenciais_pessoa on public.credenciais (pessoa_id);
select interno.aplicar_padroes('public.credenciais');

-- Código da credencial ativa da pessoa (cria na primeira vez). Não confere permissão: quem chama confere.
create function interno.codigo_credencial(p_pessoa_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  select codigo into v_codigo from public.credenciais
  where pessoa_id = p_pessoa_id and substituida_em is null and arquivado_em is null;
  if v_codigo is null then
    v_codigo := replace(gen_random_uuid()::text, '-', '') ;
    insert into public.credenciais (pessoa_id, codigo) values (p_pessoa_id, v_codigo);
  end if;
  return v_codigo;
end;
$$;

-- Em dia = nenhuma contribuição vencida e não paga (Art. 11)
create function interno.esta_em_dia(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.cobrancas
    where pessoa_id = p_pessoa_id and situacao = 'aberta' and vencimento < current_date and arquivado_em is null
  );
$$;


-- ---------------------------------------------------------------------
-- 3. Dados para mostrar e imprimir a credencial (a própria, ou de todos para a secretaria/presidência)
-- ---------------------------------------------------------------------
create function interno.dados_credenciais(p_pessoas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_diretoria boolean := (select interno.tenho_perfil('secretaria', 'presidencia'));
  v_pessoa uuid;
  v_lista jsonb := '[]'::jsonb;
  v_item jsonb;
  v_config public.config_credencial;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para ver a credencial.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_pessoas, 1), 0) = 0 or array_length(p_pessoas, 1) > 500 then
    raise exception 'Escolha de 1 a 500 credenciais.' using errcode = 'P0001';
  end if;
  foreach v_pessoa in array p_pessoas loop
    if v_pessoa <> v_eu and not v_diretoria then
      raise exception 'Só a secretaria ou a presidência veem a credencial de outra pessoa.' using errcode = '42501';
    end if;
  end loop;
  select * into v_config from public.config_credencial where id;

  foreach v_pessoa in array p_pessoas loop
    select jsonb_build_object(
      'pessoa_id', v.pessoa_id,
      'codigo', interno.codigo_credencial(v.pessoa_id),
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
      'pendencias', coalesce(pc.pendencias, '{}'::text[])
    )
    into v_item
    from public.vw_associados v
    join public.associados a on a.id = v.id
    join public.pessoas p on p.id = v.pessoa_id
    left join public.igrejas i on i.id = v.igreja_id
    left join public.vw_pendencias_credencial pc on pc.associado_id = v.id
    where v.pessoa_id = v_pessoa and v.situacao = 'ativo' and a.arquivado_em is null;
    if v_item is not null then
      -- a foto pública vem depois de criar (ou achar) a credencial
      v_item := v_item || jsonb_build_object(
        'foto_publica', (select foto_publica from public.credenciais where codigo = v_item ->> 'codigo')
      );
      v_lista := v_lista || jsonb_build_array(v_item);
    end if;
  end loop;

  return jsonb_build_object(
    'fim_mandato', v_config.fim_mandato,
    'texto_verso', v_config.texto_verso,
    'credenciais', v_lista
  );
end;
$$;

-- Perdeu a credencial? Emite outra; a antiga passa a dizer "substituída"
create function interno.substituir_credencial(p_pessoa_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência emitem uma nova credencial.' using errcode = '42501';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo (ex.: perda, roubo, dados mudaram).' using errcode = 'P0001';
  end if;
  update public.credenciais
  set substituida_em = now(), motivo_substituicao = trim(p_motivo)
  where pessoa_id = p_pessoa_id and substituida_em is null and arquivado_em is null;
  return interno.codigo_credencial(p_pessoa_id);
end;
$$;

-- Registra a cópia pública da foto (enviada antes para credenciais/<código>/...)
create function interno.registrar_foto_publica(p_codigo text, p_caminho text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
begin
  select * into v_credencial from public.credenciais
  where codigo = p_codigo and substituida_em is null and arquivado_em is null for update;
  if not found then
    raise exception 'Credencial não encontrada.' using errcode = 'P0001';
  end if;
  if not (v_credencial.pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia'))) then
    raise exception 'Sem permissão para esta credencial.' using errcode = '42501';
  end if;
  if p_caminho is null or split_part(p_caminho, '/', 1) <> p_codigo
     or not exists (select 1 from storage.objects where bucket_id = 'credenciais' and name = p_caminho) then
    raise exception 'A foto precisa estar na pasta desta credencial.' using errcode = 'P0001';
  end if;
  update public.credenciais set foto_publica = p_caminho where id = v_credencial.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Validação pública (QR Code): qualquer pessoa, sem login, vê só o necessário
-- ---------------------------------------------------------------------
create function interno.validar_credencial(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_credencial public.credenciais;
  v_fim date;
  v_dados jsonb;
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
    'ativo', (v.situacao = 'ativo' and a.arquivado_em is null)
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
  select fim_mandato into v_fim from public.config_credencial where id;
  return (v_dados - 'ativo') || jsonb_build_object(
    'situacao', case when v_fim is not null and v_fim < current_date then 'vencida' else 'valida' end,
    'valida_ate', v_fim,
    'consultado_em', now()
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Pasta pública "credenciais" (só as cópias das fotos; o nome tem o código)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('credenciais', 'credenciais', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "credenciais: o dono ou a secretaria enviam a foto da credencial"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'credenciais'
    and exists (
      select 1 from public.credenciais c
      where c.codigo = (storage.foldername(name))[1]
        and c.substituida_em is null and c.arquivado_em is null
        and (c.pessoa_id = (select interno.minha_pessoa_id()) or (select interno.tenho_perfil('secretaria', 'presidencia')))
    )
  );


-- ---------------------------------------------------------------------
-- 6. Funções pela API e permissões
-- ---------------------------------------------------------------------
create function public.dados_credenciais(p_pessoas uuid[])
returns jsonb language sql security invoker set search_path = '' as $$
  select interno.dados_credenciais(p_pessoas);
$$;
create function public.substituir_credencial(p_pessoa_id uuid, p_motivo text)
returns text language sql security invoker set search_path = '' as $$
  select interno.substituir_credencial(p_pessoa_id, p_motivo);
$$;
create function public.registrar_foto_publica(p_codigo text, p_caminho text)
returns void language sql security invoker set search_path = '' as $$
  select interno.registrar_foto_publica(p_codigo, p_caminho);
$$;
create function public.validar_credencial(p_codigo text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select interno.validar_credencial(p_codigo);
$$;

revoke all on function interno.codigo_credencial(uuid) from public;
revoke all on function interno.esta_em_dia(uuid) from public;
revoke all on function interno.dados_credenciais(uuid[]) from public;
revoke all on function interno.substituir_credencial(uuid, text) from public;
revoke all on function interno.registrar_foto_publica(text, text) from public;
revoke all on function interno.validar_credencial(text) from public;
grant execute on function interno.dados_credenciais(uuid[]) to authenticated;
grant execute on function interno.substituir_credencial(uuid, text) to authenticated;
grant execute on function interno.registrar_foto_publica(text, text) to authenticated;
grant execute on function interno.validar_credencial(text) to anon, authenticated;

revoke all on function public.dados_credenciais(uuid[]) from public, anon;
revoke all on function public.substituir_credencial(uuid, text) from public, anon;
revoke all on function public.registrar_foto_publica(text, text) from public, anon;
revoke all on function public.validar_credencial(text) from public;
grant execute on function public.dados_credenciais(uuid[]) to authenticated;
grant execute on function public.substituir_credencial(uuid, text) to authenticated;
grant execute on function public.registrar_foto_publica(text, text) to authenticated;
grant execute on function public.validar_credencial(text) to anon, authenticated;

-- Tabelas: só leitura pela API; gravar, só pelas funções
revoke all on public.config_credencial, public.credenciais from anon, authenticated;
grant select on public.config_credencial, public.credenciais to authenticated;
grant update (fim_mandato, texto_verso) on public.config_credencial to authenticated;

alter table public.config_credencial enable row level security;
alter table public.credenciais       enable row level security;

create policy "config da credencial: todos com login leem"
  on public.config_credencial for select to authenticated using (true);
create policy "config da credencial: secretaria e presidência alteram"
  on public.config_credencial for update to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')))
  with check ((select interno.tenho_perfil('secretaria', 'presidencia')));
create policy "credenciais: a própria, ou secretaria e presidência"
  on public.credenciais for select to authenticated
  using (
    pessoa_id = (select interno.minha_pessoa_id())
    or (select interno.tenho_perfil('secretaria', 'presidencia'))
  );
