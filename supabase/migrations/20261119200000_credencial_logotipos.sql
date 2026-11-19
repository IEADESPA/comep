-- =====================================================================
-- FASE 5.5 — TELAS NOVAS, PARTE 8: OS LOGOTIPOS DAS DENOMINAÇÕES NA CREDENCIAL (versão 5.5.0-teste.12)
--
-- Regras aprovadas pelo usuário (rodadas 10 e 11, 18/11/2026; PROJETO.md, seção 4.5):
--   * a biblioteca de símbolos da credencial é de desenhos próprios em SVG (no código, nunca emojis);
--   * os LOGOTIPOS OFICIAIS das denominações NÃO são copiados da internet: a secretaria envia o arquivo que a própria
--     denominação fornecer (com a autorização dela). Ele fica na pasta pública das imagens do modelo
--     ("credencial-modelo", nome aleatório) e a denominação guarda qual é o arquivo e quando foi enviado;
--   * no modelo, o item "logotipo da denominação" mostra, em cada credencial, o logotipo da denominação da igreja
--     daquela pessoa (sem logotipo enviado, o lugar fica vazio).
-- Trocar o logotipo não apaga nada: o arquivo antigo continua na pasta e a troca fica na auditoria.
-- =====================================================================

alter table public.denominacoes
  add column logotipo text check (logotipo is null or logotipo ~ '^[0-9a-f-]{36}\.(png|jpg|webp)$'),
  add column logotipo_em timestamptz;
comment on column public.denominacoes.logotipo is
  'O logotipo oficial, enviado pela secretaria com o arquivo que a denominação forneceu (pasta pública "credencial-modelo").';
comment on column public.denominacoes.logotipo_em is 'Quando o logotipo foi enviado (ou trocado).';
-- só pela função (as colunas novas não entram nos grants de insert/update da tabela)

create function interno.enviar_logotipo_denominacao(p_denominacao_id uuid, p_arquivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência enviam o logotipo da denominação.' using errcode = '42501';
  end if;
  if p_arquivo is not null and (
    p_arquivo !~ '^[0-9a-f-]{36}\.(png|jpg|webp)$'
    or not exists (select 1 from storage.objects o where o.bucket_id = 'credencial-modelo' and o.name = p_arquivo)
  ) then
    raise exception 'Envie a imagem do logotipo antes (PNG, JPG ou WebP).' using errcode = 'P0001';
  end if;
  update public.denominacoes
  set logotipo = p_arquivo, logotipo_em = case when p_arquivo is null then null else now() end
  where id = p_denominacao_id and arquivado_em is null;
  if not found then
    raise exception 'Denominação não encontrada.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.enviar_logotipo_denominacao(p_denominacao_id uuid, p_arquivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.enviar_logotipo_denominacao(p_denominacao_id, p_arquivo);
$$;

revoke all on function interno.enviar_logotipo_denominacao(uuid, text) from public;
grant execute on function interno.enviar_logotipo_denominacao(uuid, text) to authenticated;
revoke all on function public.enviar_logotipo_denominacao(uuid, text) from public, anon;
grant execute on function public.enviar_logotipo_denominacao(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- Os dados da credencial levam o logotipo da denominação da igreja de cada pessoa
-- ---------------------------------------------------------------------
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
      'readequacao', coalesce(i.cadastro = 'sem_registro', false),
      'denominacao_logotipo', dn.logotipo
    )
    into v_item
    from public.vw_associados v
    join public.associados a on a.id = v.id
    join public.pessoas p on p.id = v.pessoa_id
    left join public.igrejas i on i.id = v.igreja_id
    left join public.denominacoes dn on dn.id = i.denominacao_id and dn.arquivado_em is null
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

