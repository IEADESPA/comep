-- =====================================================================
-- FASE 5.5 — TELAS NOVAS, PARTE 5: O BANCO DA REGULARIZAÇÃO DAS IGREJAS (versão 5.5.0-teste.9)
--
-- Regras aprovadas pelo usuário com a diretoria (memória do projeto, 18/11/2026; PROJETO.md, seção 4.3):
--   * a igreja em 3 níveis: REGULAR, SUSPENSA e SEM REGISTRO (mais a igreja nova "em análise", cadastrada pelo pastor);
--   * regular = estatuto, Cartão CNPJ como organização religiosa, ata da diretoria em dia e alvará válido;
--   * venceu a ata (o mandato) ou o alvará: a igreja fica SUSPENSA no mesmo dia, sem carência. O pastor presidente
--     tem 30 dias só para mandar o documento; sem mandar, o perfil de pastor presidente também é bloqueado;
--   * o documento pode ir ANTES de vencer: fica guardado e entra sozinho no dia certo (nenhum dia de suspensão);
--   * a diretoria por cargo (ministro associado OU nome completo), com o mandato de cada cargo; a ata vale pelo MENOR;
--   * natureza jurídica: organização religiosa (Código Civil, art. 44, IV); associação privada é aceita com prazo;
--   * igreja sem registro: cadastro simples, sem empréstimos e sem perfil de pastor presidente;
--   * filiais (congregações, pontos de culto e células), numa gestão simples (sem lista de membros);
--   * documentos em partes, até 25 MB por arquivo;
--   * a denominação ganha a tradição; a igreja ganha fundação, membros, CEP, e-mail, site e convenção;
--   * quem já está cadastrado e irregular tem até a AGO de abril de 2027 (transição, configurável).
--
-- A SITUAÇÃO É CALCULADA NA LEITURA, PELA DATA (interno.situacao_igreja), como o mandato da diretoria do COMEP
-- (interno.fim_efetivo): a suspensão, o fim dos 30 dias e a entrada do documento antecipado acontecem sem
-- ninguém clicar e sem rotina agendada (o plano gratuito não garante o pg_cron).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. As regras configuráveis (só a presidência muda)
-- ---------------------------------------------------------------------
create table public.config_igrejas (
  id               boolean primary key default true check (id),
  transicao_ate    date not null default '2027-04-28',
  dias_para_mandar integer not null default 30 check (dias_para_mandar between 1 and 180),
  dias_cartao_cnpj integer not null default 90 check (dias_cartao_cnpj between 30 and 365),
  criado_por       uuid default auth.uid(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.config_igrejas is
  'Regras da regularização das igrejas (18/11/2026): o fim da transição (AGO de 28/04/2027), os 30 dias para mandar o documento '
  'vencido e o prazo do Cartão CNPJ novo da associação privada.';
comment on column public.config_igrejas.transicao_ate is 'Até quando o documento que nunca foi mandado não suspende a igreja.';
comment on column public.config_igrejas.dias_para_mandar is 'Dias que o pastor presidente tem para mandar o documento vencido antes de perder o perfil.';
comment on column public.config_igrejas.dias_cartao_cnpj is 'Dias, depois da ata que muda a natureza, para mandar o Cartão CNPJ como organização religiosa.';
select interno.aplicar_padroes('public.config_igrejas');
insert into public.config_igrejas (id) values (true);


-- ---------------------------------------------------------------------
-- 2. A igreja ganha os dados novos; a denominação, a tradição
-- ---------------------------------------------------------------------
alter table public.igrejas
  add column cadastro text not null default 'completo' check (cadastro in ('completo', 'sem_registro', 'em_analise')),
  add column natureza_juridica text check (natureza_juridica in ('organizacao_religiosa', 'associacao_privada')),
  add column natureza_prazo date,
  add column fundada_em smallint check (fundada_em is null or fundada_em between 1500 and 2100),
  add column membros integer check (membros is null or membros between 0 and 1000000),
  add column cep text check (cep is null or cep ~ '^[0-9]{8}$'),
  add column email text check (email is null or (length(email) <= 200 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  add column site text check (site is null or (length(site) <= 300 and site ~* '^https?://[^[:space:]]+$')),
  add column convencao text check (convencao is null or length(trim(convencao)) between 2 and 200),
  add column cadastrada_por uuid references public.pessoas (id),
  add constraint igrejas_sem_registro check (cadastro <> 'sem_registro' or (cnpj is null and natureza_juridica is null)),
  add constraint igrejas_em_analise check (cadastro <> 'em_analise' or cadastrada_por is not null);
comment on column public.igrejas.cadastro is
  'completo (com registro: as regras da regularização valem); sem_registro (cadastro simples, limitado); em_analise (o pastor cadastrou e a secretaria confere).';
comment on column public.igrejas.natureza_juridica is 'Como está no Cartão CNPJ. Associação privada é aceita com prazo (natureza_prazo).';
comment on column public.igrejas.natureza_prazo is
  'Associação privada: até quando mudar para organização religiosa (o fim do primeiro mandato; depois da ata que muda, os dias do Cartão CNPJ novo).';
comment on column public.igrejas.fundada_em is 'Ano de fundação.';
comment on column public.igrejas.membros is 'Número aproximado de membros (o COMEP não guarda a lista de membros).';
comment on column public.igrejas.convencao is 'Convenção estadual ou nacional (opcional), para o COMEP entender o mapa da cidade.';
comment on column public.igrejas.cadastrada_por is 'O pastor que cadastrou a igreja pelo sistema (a secretaria confere item por item).';
create index igrejas_cadastrada_por on public.igrejas (cadastrada_por);
create index igrejas_em_analise on public.igrejas (criado_em) where cadastro = 'em_analise' and arquivado_em is null;

-- o pastor presidente atualiza o contato; o resto é da secretaria (o gatilho proteger_igreja confere)
grant update (fundada_em, membros, cep, email, site, convencao, natureza_juridica) on public.igrejas to authenticated;

alter table public.denominacoes
  add column tradicao text check (tradicao in ('pentecostal', 'neopentecostal', 'batista', 'reformada', 'metodista', 'luterana',
                                               'anglicana', 'adventista', 'congregacional', 'outra'));
comment on column public.denominacoes.tradicao is
  'A tradição (pentecostal, batista, reformada…): serve aos modelos de credencial por tradição e ao mapa da cidade.';
grant insert (tradicao), update (tradicao) on public.denominacoes to authenticated;


-- ---------------------------------------------------------------------
-- 3. Os documentos: validade, natureza do Cartão CNPJ, partes e o documento antecipado
-- ---------------------------------------------------------------------
alter table public.igreja_documentos
  add column valido_de date,
  add column valido_ate date,
  add column natureza text check (natureza in ('organizacao_religiosa', 'associacao_privada')),
  add column muda_natureza boolean not null default false,
  add constraint igreja_documentos_validade check (valido_de is null or valido_ate is null or valido_ate >= valido_de),
  add constraint igreja_documentos_alvara check (tipo <> 'alvara' or valido_ate is not null);
comment on column public.igreja_documentos.valido_de is
  'Desde quando vale (o alvará do ano; a posse da diretoria da ata). Mandado antes, fica guardado e entra sozinho nesse dia.';
comment on column public.igreja_documentos.valido_ate is 'Até quando vale: o alvará (31/12) e a ata (o MENOR mandato da diretoria).';
comment on column public.igreja_documentos.natureza is 'Cartão CNPJ: a natureza jurídica que está nele.';
comment on column public.igreja_documentos.muda_natureza is 'Ata: muda a natureza para organização religiosa (a igreja que é associação privada).';
comment on table public.igreja_documentos is
  'Estatuto, Cartão CNPJ, ata da diretoria e alvará de cada igreja. Nada se substitui: o que vale hoje se calcula pelas datas '
  '(o documento mandado antes de vencer entra sozinho no dia certo). Só o que espera a conferência é trocado (fica arquivado).';

-- antes: um em vigor por tipo (o novo arquivava o anterior). Agora o histórico fica e só o que espera a conferência é único.
drop index public.igreja_documentos_um_por_tipo;
create unique index igreja_documentos_um_em_analise
  on public.igreja_documentos (igreja_id, tipo, coalesce(valido_de, date '1900-01-01'))
  where situacao = 'pendente' and arquivado_em is null and tipo <> 'outro';
create index igreja_documentos_conferidos on public.igreja_documentos (igreja_id, tipo) where situacao = 'conferido' and arquivado_em is null;

-- as partes de cada documento (o estatuto grande vai em vários arquivos, até 25 MB cada)
create table public.igreja_documento_partes (
  id              uuid primary key default gen_random_uuid(),
  documento_id    uuid not null references public.igreja_documentos (id),
  ordem           smallint not null check (ordem between 1 and 20),
  arquivo_caminho text not null check (length(arquivo_caminho) <= 200),
  nome_arquivo    text check (nome_arquivo is null or length(nome_arquivo) <= 200),
  tamanho         bigint check (tamanho is null or tamanho between 1 and 26214400),
  arquivado_em    timestamptz,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
comment on table public.igreja_documento_partes is 'Os arquivos de cada documento da igreja, em ordem (até 20 partes de até 25 MB).';
create unique index igreja_documento_partes_ordem on public.igreja_documento_partes (documento_id, ordem) where arquivado_em is null;
create unique index igreja_documento_partes_caminho on public.igreja_documento_partes (arquivo_caminho);
select interno.aplicar_padroes('public.igreja_documento_partes');

-- os documentos que já existiam viram documentos de uma parte só (o mesmo arquivo registrado duas vezes fica no mais novo)
insert into public.igreja_documento_partes (documento_id, ordem, arquivo_caminho, criado_em)
select distinct on (d.arquivo_caminho) d.id, 1, d.arquivo_caminho, d.criado_em
from public.igreja_documentos d
order by d.arquivo_caminho, d.criado_em desc;

-- 25 MB por arquivo (o estatuto do COMEP tem 4 MB; há quem junte o estatuto com outros arquivos)
update storage.buckets set file_size_limit = 26214400 where id = 'igrejas';


-- ---------------------------------------------------------------------
-- 4. A diretoria da igreja por cargo, ligada à ata
-- ---------------------------------------------------------------------
alter table public.igreja_diretoria
  add column documento_id uuid references public.igreja_documentos (id),
  add column pessoa_id uuid references public.pessoas (id),
  add column ordem smallint check (ordem is null or ordem between 1 and 30),
  add constraint igreja_diretoria_mandato check (documento_id is null or (inicio is not null and fim is not null and fim > inicio));
comment on column public.igreja_diretoria.documento_id is
  'A ata da diretoria. A diretoria em vigor é a da ata que vale hoje; a seguinte (mandada antes) entra sozinha.';
comment on column public.igreja_diretoria.pessoa_id is 'O cargo ocupado por um ministro associado (senão, só o nome completo).';
create index igreja_diretoria_documento on public.igreja_diretoria (documento_id);
create index igreja_diretoria_pessoa on public.igreja_diretoria (pessoa_id);


-- ---------------------------------------------------------------------
-- 5. A igreja nova cadastrada pelo pastor: a conferência item por item (os documentos se conferem um a um)
-- ---------------------------------------------------------------------
create table public.igreja_analise_itens (
  id            uuid primary key default gen_random_uuid(),
  igreja_id     uuid not null references public.igrejas (id),
  item          text not null check (item in ('dados', 'endereco', 'diretoria')),
  situacao      text not null default 'analise' check (situacao in ('analise', 'aprovado', 'recusado')),
  motivo        text check (motivo is null or length(motivo) <= 500),
  decidido_por  uuid references public.pessoas (id),
  decidido_em   timestamptz,
  arquivado_em  timestamptz,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint igreja_analise_itens_recusa check (situacao <> 'recusado' or length(trim(coalesce(motivo, ''))) > 0)
);
comment on table public.igreja_analise_itens is
  'A conferência da igreja cadastrada pelo pastor (dados, endereço e contato, pastor e diretoria). Os documentos se conferem um a um.';
create unique index igreja_analise_itens_um on public.igreja_analise_itens (igreja_id, item) where arquivado_em is null;
create index igreja_analise_itens_decidido_por on public.igreja_analise_itens (decidido_por);
select interno.aplicar_padroes('public.igreja_analise_itens');


-- ---------------------------------------------------------------------
-- 6. As filiais (congregações, pontos de culto e células)
-- ---------------------------------------------------------------------
create table public.igreja_filiais (
  id             uuid primary key default gen_random_uuid(),
  igreja_id      uuid not null references public.igrejas (id),
  tipo           text not null check (tipo in ('congregacao', 'ponto_de_culto', 'celula')),
  nome           text not null check (length(trim(nome)) between 3 and 120),
  bairro_id      uuid references public.bairros (id),
  responsavel_id uuid references public.pessoas (id),
  latitude       numeric(9, 6) check (latitude between -90 and 90),
  longitude      numeric(9, 6) check (longitude between -180 and 180),
  arquivado_em   timestamptz,
  criado_por     uuid default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint igreja_filiais_local check ((latitude is null) = (longitude is null))
);
comment on table public.igreja_filiais is
  'As filiais da igreja (18/11/2026): sem lista de membros; usam o CNPJ e os documentos da matriz. O responsável é só ministro associado.';
comment on column public.igreja_filiais.latitude is 'Localização opcional, tirada do link do Google Maps (só o bairro; nada de rua).';
create unique index igreja_filiais_nome on public.igreja_filiais (igreja_id, lower(trim(nome))) where arquivado_em is null;
create index igreja_filiais_bairro on public.igreja_filiais (bairro_id);
create index igreja_filiais_responsavel on public.igreja_filiais (responsavel_id);
select interno.aplicar_padroes('public.igreja_filiais');


-- ---------------------------------------------------------------------
-- 7. A situação da igreja, calculada pela data
-- ---------------------------------------------------------------------
-- Até quando o tipo de documento está coberto, olhando o dia p_dia:
--   * coberto no dia: o último dia coberto, emendando os documentos seguintes já conferidos (o antecipado, que entra
--     sozinho); 'infinity' para o que não vence (estatuto e Cartão CNPJ);
--   * não coberto: o último dia em que esteve coberto (null: nunca esteve).
create function interno.cobertura_documento(p_igreja_id uuid, p_tipo public.tipo_documento_igreja, p_dia date)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ate date;
  v_mais date;
begin
  if p_tipo in ('estatuto', 'cartao_cnpj') then
    if exists (select 1 from public.igreja_documentos d
               where d.igreja_id = p_igreja_id and d.tipo = p_tipo and d.situacao = 'conferido' and d.arquivado_em is null) then
      return 'infinity'::date;
    end if;
    return null;
  end if;
  select max(d.valido_ate) into v_ate
  from public.igreja_documentos d
  where d.igreja_id = p_igreja_id and d.tipo = p_tipo and d.situacao = 'conferido' and d.arquivado_em is null
    and d.valido_ate is not null and coalesce(d.valido_de, '-infinity'::date) <= p_dia and d.valido_ate >= p_dia;
  if v_ate is null then
    return (select max(d.valido_ate) from public.igreja_documentos d
            where d.igreja_id = p_igreja_id and d.tipo = p_tipo and d.situacao = 'conferido' and d.arquivado_em is null
              and d.valido_ate < p_dia);
  end if;
  -- o documento seguinte, já conferido, emenda no atual
  loop
    select max(d.valido_ate) into v_mais
    from public.igreja_documentos d
    where d.igreja_id = p_igreja_id and d.tipo = p_tipo and d.situacao = 'conferido' and d.arquivado_em is null
      and d.valido_ate > v_ate and coalesce(d.valido_de, '-infinity'::date) <= v_ate + 1;
    exit when v_mais is null;
    v_ate := v_mais;
  end loop;
  return v_ate;
end;
$$;

-- A situação da igreja no dia (hoje, sem dizer). Devolve:
--   situacao: regular | suspensa | sem_registro | em_analise
--   vencidos: o que suspendeu (estatuto, cartao_cnpj, natureza_juridica, ata_diretoria, alvara); pendencias: o que falta
--   e ainda está no prazo da transição (pendencias_ate); suspensa_desde; prazo_ate (o último dos 30 dias);
--   perfil_bloqueado (sem registro, em análise, ou suspensa há mais de 30 dias sem ter mandado o documento);
--   alvara_ate e mandato_ate (até quando vale, já contando o documento antecipado); proximo_vencimento.
create function interno.situacao_igreja(p_igreja_id uuid, p_dia date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v_cfg public.config_igrejas;
  v_base date;
  v_item text;
  v_cob date;
  v_desde date;
  v_suspensa date;
  v_vencidos text[] := '{}';
  v_pendencias text[] := '{}';
  v_sem_envio boolean := false;
  v_proximo date;
  v_alvara date;
  v_mandato date;
  v_prazo date;
  v_bloqueado boolean := false;
begin
  select * into v_igreja from public.igrejas where id = p_igreja_id;
  if not found then
    return null;
  end if;
  if v_igreja.cadastro <> 'completo' then
    return jsonb_build_object('situacao', v_igreja.cadastro, 'perfil_bloqueado', true,
                              'vencidos', '[]'::jsonb, 'pendencias', '[]'::jsonb);
  end if;
  select * into v_cfg from public.config_igrejas where id;
  -- o que nunca foi mandado tem até o fim da transição; a igreja cadastrada depois dele, desde o cadastro
  v_base := greatest(v_cfg.transicao_ate, v_igreja.criado_em::date - 1);
  foreach v_item in array array['estatuto', 'cartao_cnpj', 'natureza_juridica', 'ata_diretoria', 'alvara'] loop
    if v_item = 'natureza_juridica' then
      v_cob := case v_igreja.natureza_juridica
                 when 'organizacao_religiosa' then 'infinity'::date
                 when 'associacao_privada' then v_igreja.natureza_prazo
               end;
    else
      v_cob := interno.cobertura_documento(p_igreja_id, v_item::public.tipo_documento_igreja, p_dia);
    end if;
    if v_cob is not null and v_cob >= p_dia then
      if v_cob < 'infinity'::date then
        v_proximo := least(v_proximo, v_cob);
        if v_item = 'alvara' then
          v_alvara := v_cob;
        elsif v_item = 'ata_diretoria' then
          v_mandato := v_cob;
        end if;
      end if;
    else
      -- venceu (ou nunca veio): o primeiro dia sem o documento
      v_desde := coalesce(v_cob, v_base) + 1;
      if v_desde <= p_dia then
        v_suspensa := least(v_suspensa, v_desde);
        v_vencidos := v_vencidos || v_item;
        -- mandou o documento novo (esperando a conferência)? então o perfil não é bloqueado
        if not exists (
          select 1 from public.igreja_documentos d
          where d.igreja_id = p_igreja_id and d.situacao = 'pendente' and d.arquivado_em is null
            and (d.tipo::text = v_item
                 or (v_item = 'natureza_juridica' and (d.tipo = 'cartao_cnpj' or (d.tipo = 'ata_diretoria' and d.muda_natureza))))
        ) then
          v_sem_envio := true;
        end if;
      else
        v_pendencias := v_pendencias || v_item;
        v_proximo := least(v_proximo, v_desde - 1);
      end if;
    end if;
  end loop;
  if v_suspensa is not null then
    v_prazo := v_suspensa + v_cfg.dias_para_mandar - 1;
    v_bloqueado := p_dia > v_prazo and v_sem_envio;
  end if;
  return jsonb_build_object(
    'situacao', case when v_suspensa is null then 'regular' else 'suspensa' end,
    'vencidos', to_jsonb(v_vencidos),
    'pendencias', to_jsonb(v_pendencias),
    'pendencias_ate', case when cardinality(v_pendencias) > 0 then v_base end,
    'suspensa_desde', v_suspensa,
    'prazo_ate', v_prazo,
    'perfil_bloqueado', v_bloqueado,
    'alvara_ate', v_alvara,
    'mandato_ate', v_mandato,
    'natureza_prazo', case when v_igreja.natureza_juridica = 'associacao_privada' then v_igreja.natureza_prazo end,
    'proximo_vencimento', v_proximo
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 8. O perfil de pastor presidente segue a situação da igreja
-- ---------------------------------------------------------------------
-- Bloqueado: a igreja que ele preside é sem registro, ou está suspensa há mais de 30 dias sem o documento novo.
create function interno.presidente_bloqueado(p_pessoa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and((interno.situacao_igreja(v.igreja_id) ->> 'perfil_bloqueado')::boolean), false)
  from public.vinculos_igreja v
  where v.pessoa_id = p_pessoa_id and v.pastor_presidente and v.fim is null and v.arquivado_em is null;
$$;

-- As igrejas que eu presido com TODOS os direitos (regulares): pedir empréstimo, corrigir cadastros, mudar o contato…
-- Suspensa, o pastor presidente só manda o documento (interno.igrejas_que_cuido).
create or replace function interno.igrejas_que_presido()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.igreja_id
  from public.vinculos_igreja v
  join public.associados a
    on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  where v.pessoa_id = (select interno.minha_pessoa_id())
    and v.pastor_presidente
    and v.fim is null
    and v.arquivado_em is null
    and interno.situacao_igreja(v.igreja_id) ->> 'situacao' = 'regular';
$$;

-- As igrejas de que eu cuido: a que presido (regular, ou suspensa ainda nos 30 dias) e a que cadastrei e está em análise.
-- Servem para mandar e ler os documentos e a diretoria.
create function interno.igrejas_que_cuido()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.igreja_id
  from public.vinculos_igreja v
  join public.associados a
    on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  where v.pessoa_id = (select interno.minha_pessoa_id())
    and v.pastor_presidente
    and v.fim is null
    and v.arquivado_em is null
    and not (interno.situacao_igreja(v.igreja_id) ->> 'perfil_bloqueado')::boolean
  union
  select g.id
  from public.igrejas g
  where g.cadastro = 'em_analise' and g.arquivado_em is null and g.cadastrada_por = (select interno.minha_pessoa_id());
$$;

create or replace function interno.cuido_da_igreja(p_igreja_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select interno.tenho_perfil('secretaria', 'presidencia'))
      or p_igreja_id in (select interno.igrejas_que_cuido());
$$;

-- O perfil "presidente_igreja" some sozinho quando o pastor é bloqueado (e volta sozinho quando a igreja se regulariza)
create or replace function interno.tenho_perfil(variadic p_perfis public.perfil_acesso[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis_acesso pa
    join public.pessoas p on p.id = pa.pessoa_id
    where p.usuario_id = (select auth.uid())
      and p.arquivado_em is null
      and pa.arquivado_em is null
      and pa.perfil = any (p_perfis)
      -- quem saiu do COMEP perde os perfis da diretoria e do Conselho Fiscal (o de ministro sai pelo gatilho)
      and not (pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal') and interno.saiu_do_comep(p.id))
      -- a igreja sem registro, ou suspensa há mais de 30 dias: o pastor presidente perde o perfil
      and not (pa.perfil = 'presidente_igreja' and interno.presidente_bloqueado(p.id))
  ) or exists (
    select 1
    from public.mandatos m
    join public.pessoas p on p.id = m.pessoa_id
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where p.usuario_id = (select auth.uid())
      and p.arquivado_em is null
      and m.arquivado_em is null
      and current_date between m.inicio and interno.fim_efetivo(m)
      and interno.perfis_do_cargo(m.cargo) && p_perfis
  );
$$;

create or replace function interno.meus_perfis()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct x.perfil::text order by x.perfil::text), '{}')
  from (
    select pa.perfil
    from public.perfis_acesso pa
    join public.pessoas p on p.id = pa.pessoa_id
    where p.usuario_id = (select auth.uid()) and p.arquivado_em is null and pa.arquivado_em is null
      and not (pa.perfil in ('secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal') and interno.saiu_do_comep(p.id))
      and not (pa.perfil = 'presidente_igreja' and interno.presidente_bloqueado(p.id))
    union
    select unnest(interno.perfis_do_cargo(m.cargo))
    from public.mandatos m
    join public.pessoas p on p.id = m.pessoa_id
    join public.associados a on a.pessoa_id = m.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where p.usuario_id = (select auth.uid()) and p.arquivado_em is null and m.arquivado_em is null
      and current_date between m.inicio and interno.fim_efetivo(m)
  ) x
  where x.perfil is not null;
$$;


-- ---------------------------------------------------------------------
-- 9. O pastor presidente só muda o contato; o resto é da secretaria
-- ---------------------------------------------------------------------
create or replace function interno.proteger_igreja()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Manutenção pelo dono do banco (sem login) e secretaria/presidência: sem restrição
  if (select auth.uid()) is null or (select interno.tenho_perfil('secretaria', 'presidencia')) then
    return new;
  end if;
  -- o pastor corrige a igreja que ele cadastrou, enquanto ela está em análise (só pela função corrigir_cadastro_igreja)
  if old.cadastro = 'em_analise' and new.cadastro = 'em_analise' and old.cadastrada_por = (select interno.minha_pessoa_id())
     and new.cadastrada_por is not distinct from old.cadastrada_por and new.arquivado_em is not distinct from old.arquivado_em then
    return new;
  end if;
  if new.nome is distinct from old.nome
     or new.denominacao_id is distinct from old.denominacao_id
     or new.cnpj is distinct from old.cnpj
     or new.presidente_nome is distinct from old.presidente_nome
     or new.arquivado_em is distinct from old.arquivado_em
     or new.natureza_juridica is distinct from old.natureza_juridica
     or new.natureza_prazo is distinct from old.natureza_prazo
     or new.fundada_em is distinct from old.fundada_em
     or new.cadastro is distinct from old.cadastro
     or new.cadastrada_por is distinct from old.cadastrada_por then
    raise exception 'O pastor presidente atualiza só o contato da igreja (endereço, bairro, CEP, telefone, e-mail, site, convenção, sigla e membros). O resto é com a secretaria.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- A igreja sem registro (ou em análise) não tem pastor presidente: não há mandato que o justifique.
-- E ninguém se liga a uma igreja que ainda está em análise.
create function interno.validar_vinculo_igreja()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cadastro text;
begin
  if new.fim is not null or new.arquivado_em is not null then
    return new;
  end if;
  select cadastro into v_cadastro from public.igrejas where id = new.igreja_id;
  if v_cadastro = 'em_analise' then
    raise exception 'A igreja ainda está em análise pela secretaria.' using errcode = 'P0001';
  end if;
  if new.pastor_presidente and v_cadastro = 'sem_registro' then
    raise exception 'Igreja sem registro não tem pastor presidente no COMEP: sem ata, não há mandato que o justifique.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger validar_vinculo_igreja
  before insert or update of igreja_id, pastor_presidente, fim, arquivado_em on public.vinculos_igreja
  for each row execute function interno.validar_vinculo_igreja();


-- ---------------------------------------------------------------------
-- 10. Mandar e conferir os documentos
-- ---------------------------------------------------------------------
-- Associação privada: o prazo começa no fim do mandato da primeira diretoria registrada (eleger a diretoria nova e,
-- na mesma ata, mudar a natureza).
create function interno.ajustar_prazo_natureza(p_igreja_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.igrejas g
  set natureza_prazo = (
    select d.valido_ate from public.igreja_documentos d
    where d.igreja_id = g.id and d.tipo = 'ata_diretoria' and d.situacao = 'conferido' and d.arquivado_em is null
      and d.valido_ate is not null
    order by d.valido_de, d.conferido_em
    limit 1
  )
  where g.id = p_igreja_id and g.natureza_juridica = 'associacao_privada' and g.natureza_prazo is null;
$$;

-- A natureza mudou na ficha (a secretaria): organização religiosa não tem prazo; associação privada ganha o prazo do
-- primeiro mandato registrado (se já houver ata conferida)
create function interno.prazo_da_natureza()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.natureza_juridica is distinct from 'associacao_privada' then
    new.natureza_prazo := null;
  elsif new.natureza_prazo is null then
    new.natureza_prazo := (
      select d.valido_ate from public.igreja_documentos d
      where d.igreja_id = new.id and d.tipo = 'ata_diretoria' and d.situacao = 'conferido' and d.arquivado_em is null
        and d.valido_ate is not null
      order by d.valido_de, d.conferido_em
      limit 1
    );
  end if;
  return new;
end;
$$;
create trigger prazo_da_natureza
  before insert or update of natureza_juridica on public.igrejas
  for each row execute function interno.prazo_da_natureza();

-- O que muda na igreja quando o documento é conferido (a natureza do Cartão CNPJ, a ata que muda a natureza)
create function interno.efeitos_do_documento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.igreja_documentos;
  v_cfg public.config_igrejas;
begin
  select * into v_doc from public.igreja_documentos where id = p_id;
  if not found or v_doc.situacao <> 'conferido' then
    return;
  end if;
  select * into v_cfg from public.config_igrejas where id;
  if v_doc.tipo = 'cartao_cnpj' and v_doc.natureza = 'organizacao_religiosa' then
    update public.igrejas set natureza_juridica = 'organizacao_religiosa', natureza_prazo = null
    where id = v_doc.igreja_id and natureza_juridica is distinct from 'organizacao_religiosa';
  elsif v_doc.tipo = 'cartao_cnpj' and v_doc.natureza = 'associacao_privada' then
    update public.igrejas set natureza_juridica = 'associacao_privada'
    where id = v_doc.igreja_id and natureza_juridica is null;
  elsif v_doc.tipo = 'ata_diretoria' and v_doc.muda_natureza then
    -- a ata mudou a natureza: agora são os dias do Cartão CNPJ novo
    update public.igrejas set natureza_prazo = current_date + v_cfg.dias_cartao_cnpj
    where id = v_doc.igreja_id and natureza_juridica = 'associacao_privada';
  end if;
  perform interno.ajustar_prazo_natureza(v_doc.igreja_id);
end;
$$;

-- Manda um documento da igreja (p_dados: tipo, descricao, partes [{caminho, nome, tamanho}], valido_de, valido_ate,
-- natureza, muda_natureza e, na ata, a diretoria [{cargo, pessoa_id | nome, inicio, fim}]). Mandado pela secretaria ou
-- pela presidência, já entra conferido; pelo pastor, espera a conferência.
create function interno.enviar_documento_igreja(p_igreja_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_igreja public.igrejas;
  v_tipo public.tipo_documento_igreja;
  v_partes jsonb := p_dados -> 'partes';
  v_diretoria jsonb := p_dados -> 'diretoria';
  v_parte jsonb;
  v_membro jsonb;
  v_caminho text;
  v_tamanho bigint;
  v_ordem integer := 0;
  v_de date;
  v_ate date;
  v_inicio date;
  v_fim date;
  v_pessoa uuid;
  v_natureza text := nullif(p_dados ->> 'natureza', '');
  v_muda boolean;
  v_confere boolean;
  v_id uuid;
begin
  if v_eu is null or not interno.cuido_da_igreja(p_igreja_id) then
    raise exception 'Só o pastor presidente da igreja, a secretaria ou a presidência mandam os documentos dela.' using errcode = '42501';
  end if;
  select * into v_igreja from public.igrejas where id = p_igreja_id and arquivado_em is null;
  if not found then
    raise exception 'Igreja não encontrada.' using errcode = 'P0001';
  end if;
  begin
    v_tipo := nullif(p_dados ->> 'tipo', '')::public.tipo_documento_igreja;
    v_de := nullif(p_dados ->> 'valido_de', '')::date;
    v_ate := nullif(p_dados ->> 'valido_ate', '')::date;
    v_muda := coalesce((p_dados ->> 'muda_natureza')::boolean, false);
  exception when others then
    raise exception 'O tipo do documento ou as datas estão num formato inválido.' using errcode = 'P0001';
  end;
  if v_tipo is null then
    raise exception 'Escolha o tipo do documento.' using errcode = 'P0001';
  end if;
  if v_tipo = 'outro' and coalesce(trim(p_dados ->> 'descricao'), '') = '' then
    raise exception 'Diga que documento é este.' using errcode = 'P0001';
  end if;

  -- as partes: de 1 a 20 arquivos na pasta da igreja, até 25 MB cada
  if v_partes is null or jsonb_typeof(v_partes) <> 'array' or jsonb_array_length(v_partes) not between 1 and 20 then
    raise exception 'Mande de 1 a 20 arquivos (partes) do documento.' using errcode = 'P0001';
  end if;
  for v_parte in select * from jsonb_array_elements(v_partes) loop
    v_caminho := v_parte ->> 'caminho';
    if v_caminho is null or v_caminho !~ ('^' || p_igreja_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$') then
      raise exception 'Cada arquivo precisa estar na pasta da igreja.' using errcode = 'P0001';
    end if;
    begin
      v_tamanho := nullif(v_parte ->> 'tamanho', '')::bigint;
    exception when others then
      v_tamanho := -1;
    end;
    if v_tamanho is not null and (v_tamanho < 1 or v_tamanho > 26214400) then
      raise exception 'Cada arquivo pode ter até 25 MB. Mande o documento em partes.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.igreja_documento_partes x where x.arquivo_caminho = v_caminho) then
      raise exception 'Este arquivo já foi usado em outro documento.' using errcode = 'P0001';
    end if;
  end loop;
  if (select count(distinct x ->> 'caminho') from jsonb_array_elements(v_partes) x) <> jsonb_array_length(v_partes) then
    raise exception 'O mesmo arquivo foi mandado duas vezes.' using errcode = 'P0001';
  end if;

  -- a validade de cada tipo
  if v_tipo = 'alvara' then
    if v_ate is null then
      raise exception 'Informe até quando o alvará vale.' using errcode = 'P0001';
    end if;
    v_de := coalesce(v_de, make_date(extract(year from v_ate)::integer, 1, 1));
    if v_ate < v_de then
      raise exception 'A validade do alvará termina depois de começar.' using errcode = 'P0001';
    end if;
    if v_ate < current_date then
      raise exception 'Este alvará já venceu. Mande o que vale agora (ou o do próximo ano).' using errcode = 'P0001';
    end if;
    if v_ate - v_de > 1100 then
      raise exception 'O alvará vale no máximo 3 anos. Confira as datas.' using errcode = 'P0001';
    end if;
  elsif v_tipo = 'ata_diretoria' then
    if v_diretoria is null or jsonb_typeof(v_diretoria) <> 'array' or jsonb_array_length(v_diretoria) not between 1 and 30 then
      raise exception 'Informe a diretoria da ata (de 1 a 30 cargos), com o mandato de cada cargo.' using errcode = 'P0001';
    end if;
    v_de := null;
    v_ate := null;
    for v_membro in select * from jsonb_array_elements(v_diretoria) loop
      begin
        v_inicio := (v_membro ->> 'inicio')::date;
        v_fim := (v_membro ->> 'fim')::date;
        v_pessoa := nullif(v_membro ->> 'pessoa_id', '')::uuid;
      exception when others then
        raise exception 'As datas do mandato (ou o ministro) estão num formato inválido.' using errcode = 'P0001';
      end;
      if length(trim(coalesce(v_membro ->> 'cargo', ''))) < 2 then
        raise exception 'Cada linha da diretoria precisa do nome do cargo.' using errcode = 'P0001';
      end if;
      if v_inicio is null or v_fim is null then
        raise exception 'Cada cargo precisa da posse e do fim do mandato: não existe mandato sem prazo nem vitalício.' using errcode = 'P0001';
      end if;
      if v_fim <= v_inicio then
        raise exception 'O fim do mandato vem depois da posse.' using errcode = 'P0001';
      end if;
      if v_fim > (v_inicio + interval '20 years')::date then
        raise exception 'Mandato de mais de 20 anos não é aceito: confira no estatuto e na ata o tempo de cada cargo.' using errcode = 'P0001';
      end if;
      if v_pessoa is not null and not interno.associado_ativo(v_pessoa) then
        raise exception 'O cargo ligado a um ministro precisa ser de um ministro associado ativo.' using errcode = 'P0001';
      end if;
      if v_pessoa is null and length(trim(coalesce(v_membro ->> 'nome', ''))) < 5 then
        raise exception 'Escreva o nome completo de quem ocupa cada cargo (ou escolha um ministro associado).' using errcode = 'P0001';
      end if;
      -- a ata vale do primeiro dia da diretoria até o MENOR mandato
      v_de := least(v_de, v_inicio);
      v_ate := least(v_ate, v_fim);
    end loop;
    if v_ate < current_date then
      raise exception 'O mandato desta diretoria já terminou. Mande a ata da diretoria que está valendo (ou a da próxima).' using errcode = 'P0001';
    end if;
  else
    v_de := null;
    v_ate := null;
  end if;
  if v_tipo = 'cartao_cnpj' then
    if v_natureza is null or v_natureza not in ('organizacao_religiosa', 'associacao_privada') then
      raise exception 'Diga a natureza jurídica que está no Cartão CNPJ.' using errcode = 'P0001';
    end if;
  else
    v_natureza := null;
  end if;
  if v_tipo <> 'ata_diretoria' then
    v_muda := false;
  end if;

  -- a secretaria e a presidência (que não presidem esta igreja) mandam já conferido
  v_confere := (select interno.tenho_perfil('secretaria', 'presidencia'))
               and p_igreja_id not in (select interno.igrejas_que_cuido());

  -- o que esperava a conferência, do mesmo tipo e do mesmo período, é trocado pelo novo (e fica guardado)
  if v_tipo <> 'outro' then
    update public.igreja_documentos set arquivado_em = now()
    where igreja_id = p_igreja_id and tipo = v_tipo and situacao = 'pendente' and arquivado_em is null
      and coalesce(valido_de, date '1900-01-01') = coalesce(v_de, date '1900-01-01');
  end if;

  insert into public.igreja_documentos (igreja_id, tipo, descricao, arquivo_caminho, enviado_por, valido_de, valido_ate,
                                        natureza, muda_natureza, situacao, conferido_por, conferido_em)
  values (p_igreja_id, v_tipo, left(nullif(trim(p_dados ->> 'descricao'), ''), 300), v_partes -> 0 ->> 'caminho', v_eu,
          v_de, v_ate, v_natureza, v_muda,
          (case when v_confere then 'conferido' else 'pendente' end)::public.situacao_documento_igreja,
          case when v_confere then v_eu end, case when v_confere then now() end)
  returning id into v_id;

  for v_parte in select * from jsonb_array_elements(v_partes) loop
    v_ordem := v_ordem + 1;
    insert into public.igreja_documento_partes (documento_id, ordem, arquivo_caminho, nome_arquivo, tamanho)
    values (v_id, v_ordem, v_parte ->> 'caminho', left(nullif(trim(v_parte ->> 'nome'), ''), 200),
            nullif(v_parte ->> 'tamanho', '')::bigint);
  end loop;

  if v_tipo = 'ata_diretoria' then
    v_ordem := 0;
    for v_membro in select * from jsonb_array_elements(v_diretoria) loop
      v_ordem := v_ordem + 1;
      v_pessoa := nullif(v_membro ->> 'pessoa_id', '')::uuid;
      insert into public.igreja_diretoria (igreja_id, documento_id, ordem, cargo, pessoa_id, nome, inicio, fim)
      values (p_igreja_id, v_id, v_ordem, left(trim(v_membro ->> 'cargo'), 80), v_pessoa,
              left(coalesce((select p.nome from public.pessoas p where p.id = v_pessoa), trim(v_membro ->> 'nome')), 200),
              (v_membro ->> 'inicio')::date, (v_membro ->> 'fim')::date);
    end loop;
    -- a igreja em análise mandou a diretoria de novo: o item volta para a secretaria
    if v_igreja.cadastro = 'em_analise' then
      update public.igreja_analise_itens set situacao = 'analise', motivo = null, decidido_por = null, decidido_em = null
      where igreja_id = p_igreja_id and item = 'diretoria' and arquivado_em is null and situacao <> 'analise';
    end if;
  end if;

  if v_confere then
    perform interno.efeitos_do_documento(v_id);
  end if;
  return v_id;
end;
$$;

-- Conferir (ou recusar com o motivo). Ninguém confere o documento que ele mesmo mandou.
create or replace function interno.conferir_documento_igreja(p_id uuid, p_aceito boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.igreja_documentos;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conferem os documentos das igrejas.' using errcode = '42501';
  end if;
  select * into v_doc from public.igreja_documentos where id = p_id and arquivado_em is null for update;
  if not found then
    raise exception 'Documento não encontrado.' using errcode = 'P0001';
  end if;
  if v_doc.enviado_por = (select interno.minha_pessoa_id()) then
    raise exception 'Ninguém confere o documento que ele mesmo mandou.' using errcode = '42501';
  end if;
  if v_doc.situacao <> 'pendente' then
    raise exception 'Este documento já foi conferido.' using errcode = 'P0001';
  end if;
  if p_aceito is null then
    raise exception 'Diga se o documento foi aceito.' using errcode = 'P0001';
  end if;
  if not p_aceito and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para recusar, diga o motivo (ex.: ilegível, de outra igreja).' using errcode = 'P0001';
  end if;
  update public.igreja_documentos
  set situacao = case when p_aceito then 'conferido' else 'recusado' end::public.situacao_documento_igreja,
      motivo_recusa = case when p_aceito then null else trim(p_motivo) end,
      conferido_por = (select interno.minha_pessoa_id()), conferido_em = now()
  where id = p_id;
  if p_aceito then
    perform interno.efeitos_do_documento(p_id);
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 11. O cadastro da igreja: pela secretaria (completo ou sem registro) e pelo próprio pastor (em análise)
-- ---------------------------------------------------------------------
-- Confere e devolve os dados da igreja (p_registro: com CNPJ e natureza jurídica).
create function interno.dados_da_igreja(p_dados jsonb, p_registro boolean)
returns public.igrejas
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.igrejas;
begin
  v.nome := nullif(trim(p_dados ->> 'nome'), '');
  v.sigla := nullif(upper(trim(p_dados ->> 'sigla')), '');
  v.endereco := left(nullif(trim(p_dados ->> 'endereco'), ''), 300);
  v.telefone := left(nullif(trim(p_dados ->> 'telefone'), ''), 40);
  v.cep := nullif(regexp_replace(coalesce(p_dados ->> 'cep', ''), '[^0-9]', '', 'g'), '');
  v.email := nullif(lower(trim(p_dados ->> 'email')), '');
  v.site := nullif(trim(p_dados ->> 'site'), '');
  v.convencao := nullif(trim(p_dados ->> 'convencao'), '');
  v.presidente_nome := left(nullif(trim(p_dados ->> 'presidente_nome'), ''), 200);
  begin
    v.denominacao_id := nullif(p_dados ->> 'denominacao_id', '')::uuid;
    v.bairro_id := nullif(p_dados ->> 'bairro_id', '')::uuid;
    v.fundada_em := nullif(p_dados ->> 'fundada_em', '')::smallint;
    v.membros := nullif(p_dados ->> 'membros', '')::integer;
  exception when others then
    raise exception 'A denominação, o bairro, o ano de fundação ou o número de membros estão num formato inválido.' using errcode = 'P0001';
  end;
  if v.nome is null or length(v.nome) < 3 then
    raise exception 'Informe o nome da igreja.' using errcode = 'P0001';
  end if;
  if v.denominacao_id is null or not exists (select 1 from public.denominacoes d where d.id = v.denominacao_id and d.arquivado_em is null) then
    raise exception 'Escolha a denominação.' using errcode = 'P0001';
  end if;
  if v.bairro_id is not null and not exists (select 1 from public.bairros b where b.id = v.bairro_id and b.arquivado_em is null) then
    raise exception 'Bairro não encontrado.' using errcode = 'P0001';
  end if;
  if v.fundada_em is not null and (v.fundada_em < 1500 or v.fundada_em > extract(year from current_date)) then
    raise exception 'O ano de fundação não está certo.' using errcode = 'P0001';
  end if;
  if v.membros is not null and (v.membros < 0 or v.membros > 1000000) then
    raise exception 'O número de membros não está certo.' using errcode = 'P0001';
  end if;
  if v.cep is not null and v.cep !~ '^[0-9]{8}$' then
    raise exception 'O CEP tem 8 números.' using errcode = 'P0001';
  end if;
  if v.email is not null and (length(v.email) > 200 or v.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'O e-mail da igreja não está certo.' using errcode = 'P0001';
  end if;
  if v.site is not null and v.site !~* '^https?://' then
    v.site := 'https://' || v.site;
  end if;
  if v.site is not null and (length(v.site) > 300 or v.site !~* '^https?://[^[:space:]]+\.[^[:space:]]+$') then
    raise exception 'O site da igreja não está certo (ex.: https://minhaigreja.com.br).' using errcode = 'P0001';
  end if;
  if v.convencao is not null and length(v.convencao) not between 2 and 200 then
    raise exception 'O nome da convenção não está certo.' using errcode = 'P0001';
  end if;
  if v.sigla is not null and length(v.sigla) > 20 then
    raise exception 'A sigla tem no máximo 20 letras.' using errcode = 'P0001';
  end if;
  if p_registro then
    v.cnpj := nullif(upper(regexp_replace(coalesce(p_dados ->> 'cnpj', ''), '[^0-9A-Za-z]', '', 'g')), '');
    if v.cnpj is null then
      raise exception 'Informe o CNPJ da igreja. Sem CNPJ, use o cadastro simples (sem registro).' using errcode = 'P0001';
    end if;
    if not interno.cnpj_valido(v.cnpj) then
      raise exception 'CNPJ inválido. Confira os números.' using errcode = 'P0001';
    end if;
    v.natureza_juridica := nullif(p_dados ->> 'natureza_juridica', '');
    if v.natureza_juridica is null or v.natureza_juridica not in ('organizacao_religiosa', 'associacao_privada') then
      raise exception 'Diga a natureza jurídica que está no Cartão CNPJ.' using errcode = 'P0001';
    end if;
  end if;
  return v;
end;
$$;

-- CNPJ e sigla não se repetem entre as igrejas ativas
create function interno.conferir_repetidos_igreja(p_cnpj text, p_sigla text, p_ignorar uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_cnpj is not null and exists (select 1 from public.igrejas g where g.cnpj = p_cnpj and g.arquivado_em is null
                                      and g.id is distinct from p_ignorar) then
    raise exception 'Já existe uma igreja com esse CNPJ.' using errcode = 'P0001';
  end if;
  if p_sigla is not null and exists (select 1 from public.igrejas g where lower(trim(g.sigla)) = lower(trim(p_sigla))
                                       and g.arquivado_em is null and g.id is distinct from p_ignorar) then
    raise exception 'Já existe uma igreja com essa sigla.' using errcode = 'P0001';
  end if;
end;
$$;

-- O ministro passa a ser o pastor presidente da igreja: o vínculo anterior termina hoje (fica no histórico).
create function interno.tornar_pastor_presidente(p_pessoa_id uuid, p_igreja_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.vinculos_igreja;
begin
  if not interno.associado_ativo(p_pessoa_id) then
    raise exception 'O pastor presidente precisa ser um ministro associado ativo.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.vinculos_igreja v
             where v.igreja_id = p_igreja_id and v.pastor_presidente and v.fim is null and v.arquivado_em is null
               and v.pessoa_id <> p_pessoa_id) then
    raise exception 'A igreja já tem pastor presidente.' using errcode = 'P0001';
  end if;
  select * into v_atual from public.vinculos_igreja v
  where v.pessoa_id = p_pessoa_id and v.fim is null and v.arquivado_em is null;
  if found and v_atual.igreja_id = p_igreja_id then
    update public.vinculos_igreja set pastor_presidente = true where id = v_atual.id;
    return;
  end if;
  if found and v_atual.pastor_presidente then
    raise exception 'Ele já é pastor presidente da igreja "%". A troca se faz primeiro na ficha dele.',
      (select g.nome from public.igrejas g where g.id = v_atual.igreja_id) using errcode = 'P0001';
  end if;
  if found then
    update public.vinculos_igreja set fim = greatest(current_date, coalesce(inicio, current_date)) where id = v_atual.id;
  end if;
  insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, inicio, pastor_presidente)
  values (p_pessoa_id, p_igreja_id, 'Pastor presidente', current_date, true);
end;
$$;

-- A secretaria cadastra a igreja (com registro: completo; sem registro: o cadastro simples). Devolve o id.
-- Os documentos vão depois, um a um (interno.enviar_documento_igreja): mandados pela secretaria, já entram conferidos.
create function interno.cadastrar_igreja(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.igrejas;
  v_registro boolean;
  v_presidente uuid;
  v_id uuid;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência cadastram as igrejas.' using errcode = '42501';
  end if;
  begin
    v_registro := coalesce((p_dados ->> 'tem_registro')::boolean, true);
    v_presidente := nullif(p_dados ->> 'presidente_id', '')::uuid;
  exception when others then
    raise exception 'Dados do cadastro inválidos.' using errcode = 'P0001';
  end;
  v := interno.dados_da_igreja(p_dados, v_registro);
  if not v_registro and v_presidente is not null then
    raise exception 'Igreja sem registro não tem pastor presidente no COMEP: sem ata, não há mandato que o justifique.' using errcode = 'P0001';
  end if;
  perform interno.conferir_repetidos_igreja(v.cnpj, v.sigla, null);
  if v_presidente is not null then
    v.presidente_nome := coalesce(v.presidente_nome, (select p.nome from public.pessoas p where p.id = v_presidente));
  end if;
  insert into public.igrejas (nome, sigla, denominacao_id, cnpj, natureza_juridica, fundada_em, membros, endereco, bairro_id,
                              cep, telefone, email, site, convencao, presidente_nome, cadastro)
  values (v.nome, v.sigla, v.denominacao_id, v.cnpj, v.natureza_juridica, v.fundada_em, v.membros, v.endereco, v.bairro_id,
          v.cep, v.telefone, v.email, v.site, v.convencao, v.presidente_nome,
          case when v_registro then 'completo' else 'sem_registro' end)
  returning id into v_id;
  if v_presidente is not null then
    perform interno.tornar_pastor_presidente(v_presidente, v_id);
  end if;
  return v_id;
end;
$$;

-- O pastor (ministro associado) cadastra a própria igreja: ela fica em análise e a secretaria confere item por item.
create function interno.pedir_cadastro_igreja(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v public.igrejas;
  v_id uuid;
begin
  if v_eu is null or not interno.associado_ativo(v_eu) then
    raise exception 'Só o ministro associado cadastra a própria igreja.' using errcode = '42501';
  end if;
  if exists (select 1 from public.vinculos_igreja vi
             where vi.pessoa_id = v_eu and vi.pastor_presidente and vi.fim is null and vi.arquivado_em is null) then
    raise exception 'Você já é pastor presidente de uma igreja no COMEP.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.igrejas g where g.cadastrada_por = v_eu and g.cadastro = 'em_analise' and g.arquivado_em is null) then
    raise exception 'Você já tem uma igreja esperando a secretaria.' using errcode = 'P0001';
  end if;
  v := interno.dados_da_igreja(p_dados, true);
  perform interno.conferir_repetidos_igreja(v.cnpj, v.sigla, null);
  insert into public.igrejas (nome, sigla, denominacao_id, cnpj, natureza_juridica, fundada_em, membros, endereco, bairro_id,
                              cep, telefone, email, site, convencao, presidente_nome, cadastro, cadastrada_por)
  values (v.nome, v.sigla, v.denominacao_id, v.cnpj, v.natureza_juridica, v.fundada_em, v.membros, v.endereco, v.bairro_id,
          v.cep, v.telefone, v.email, v.site, v.convencao, (select p.nome from public.pessoas p where p.id = v_eu),
          'em_analise', v_eu)
  returning id into v_id;
  insert into public.igreja_analise_itens (igreja_id, item)
  select v_id, x from unnest(array['dados', 'endereco', 'diretoria']) x;
  return v_id;
end;
$$;

-- O pastor corrige o item que voltou (dados ou endereço e contato): o item volta para a secretaria.
create function interno.corrigir_cadastro_igreja(p_igreja_id uuid, p_item text, p_dados jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v public.igrejas;
begin
  select * into v_igreja from public.igrejas
  where id = p_igreja_id and arquivado_em is null and cadastro = 'em_analise' and cadastrada_por = (select interno.minha_pessoa_id());
  if not found then
    raise exception 'Só quem cadastrou a igreja corrige, enquanto ela está em análise.' using errcode = '42501';
  end if;
  if p_item is null or p_item not in ('dados', 'endereco') then
    raise exception 'Escolha o que corrigir: os dados ou o endereço e contato.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.igreja_analise_itens i
             where i.igreja_id = p_igreja_id and i.item = p_item and i.arquivado_em is null and i.situacao = 'aprovado') then
    raise exception 'Este item já foi aprovado pela secretaria.' using errcode = 'P0001';
  end if;
  v := interno.dados_da_igreja(p_dados, true);
  if p_item = 'dados' then
    perform interno.conferir_repetidos_igreja(v.cnpj, v.sigla, p_igreja_id);
    update public.igrejas
    set nome = v.nome, sigla = v.sigla, denominacao_id = v.denominacao_id, cnpj = v.cnpj, natureza_juridica = v.natureza_juridica,
        fundada_em = v.fundada_em, membros = v.membros
    where id = p_igreja_id;
  else
    update public.igrejas
    set endereco = v.endereco, bairro_id = v.bairro_id, cep = v.cep, telefone = v.telefone, email = v.email, site = v.site,
        convencao = v.convencao
    where id = p_igreja_id;
  end if;
  update public.igreja_analise_itens set situacao = 'analise', motivo = null, decidido_por = null, decidido_em = null
  where igreja_id = p_igreja_id and item = p_item and arquivado_em is null;
end;
$$;

-- A secretaria confere um item da igreja nova (os documentos se conferem em conferir_documento_igreja).
create function interno.conferir_item_igreja(p_igreja_id uuid, p_item text, p_aprovar boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência conferem a igreja nova.' using errcode = '42501';
  end if;
  select * into v_igreja from public.igrejas where id = p_igreja_id and arquivado_em is null for update;
  if not found or v_igreja.cadastro <> 'em_analise' then
    raise exception 'A igreja não está em análise.' using errcode = 'P0001';
  end if;
  if v_igreja.cadastrada_por = (select interno.minha_pessoa_id()) then
    raise exception 'Ninguém confere a igreja que ele mesmo cadastrou.' using errcode = '42501';
  end if;
  if p_item is null or p_item not in ('dados', 'endereco', 'diretoria') then
    raise exception 'Item da conferência inválido.' using errcode = 'P0001';
  end if;
  if p_aprovar is null then
    raise exception 'Diga se o item foi aprovado.' using errcode = 'P0001';
  end if;
  if not p_aprovar and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Para recusar, diga o motivo: ele volta para o pastor.' using errcode = 'P0001';
  end if;
  if p_item = 'diretoria' and p_aprovar and not exists (
    select 1 from public.igreja_documentos d join public.igreja_diretoria g on g.documento_id = d.id
    where d.igreja_id = p_igreja_id and d.tipo = 'ata_diretoria' and d.arquivado_em is null and d.situacao <> 'recusado'
  ) then
    raise exception 'A igreja ainda não mandou a ata com a diretoria.' using errcode = 'P0001';
  end if;
  update public.igreja_analise_itens
  set situacao = case when p_aprovar then 'aprovado' else 'recusado' end,
      motivo = case when p_aprovar then null else left(trim(p_motivo), 500) end,
      decidido_por = (select interno.minha_pessoa_id()), decidido_em = now()
  where igreja_id = p_igreja_id and item = p_item and arquivado_em is null;
end;
$$;

-- Com tudo aprovado, a secretaria ativa a igreja: o pastor que cadastrou vira o pastor presidente dela.
create function interno.ativar_igreja(p_igreja_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja public.igrejas;
  v_tipo text;
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência ativam a igreja.' using errcode = '42501';
  end if;
  select * into v_igreja from public.igrejas where id = p_igreja_id and arquivado_em is null for update;
  if not found or v_igreja.cadastro <> 'em_analise' then
    raise exception 'A igreja não está em análise.' using errcode = 'P0001';
  end if;
  if v_igreja.cadastrada_por = (select interno.minha_pessoa_id()) then
    raise exception 'Ninguém ativa a igreja que ele mesmo cadastrou.' using errcode = '42501';
  end if;
  if exists (select 1 from public.igreja_analise_itens i
             where i.igreja_id = p_igreja_id and i.arquivado_em is null and i.situacao <> 'aprovado') then
    raise exception 'Para ativar, todos os itens precisam estar aprovados.' using errcode = 'P0001';
  end if;
  foreach v_tipo in array array['estatuto', 'cartao_cnpj', 'ata_diretoria'] loop
    if not exists (select 1 from public.igreja_documentos d
                   where d.igreja_id = p_igreja_id and d.tipo::text = v_tipo and d.situacao = 'conferido' and d.arquivado_em is null) then
      raise exception 'Para ativar, o estatuto, o Cartão CNPJ e a ata da diretoria precisam estar conferidos.' using errcode = 'P0001';
    end if;
  end loop;
  if exists (select 1 from public.igreja_documentos d
             where d.igreja_id = p_igreja_id and d.situacao = 'pendente' and d.arquivado_em is null) then
    raise exception 'Ainda há documento esperando a conferência.' using errcode = 'P0001';
  end if;
  update public.igrejas set cadastro = 'completo' where id = p_igreja_id;
  perform interno.ajustar_prazo_natureza(p_igreja_id);
  perform interno.tornar_pastor_presidente(v_igreja.cadastrada_por, p_igreja_id);
end;
$$;

-- A igreja sem registro se regulariza: ganha o CNPJ e a natureza jurídica e passa ao cadastro completo
-- (os documentos vão depois; sem eles, vale a transição ou os 30 dias).
create function interno.regularizar_igreja(p_igreja_id uuid, p_cnpj text, p_natureza text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cnpj text := nullif(upper(regexp_replace(coalesce(p_cnpj, ''), '[^0-9A-Za-z]', '', 'g')), '');
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência regularizam a igreja.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.igrejas where id = p_igreja_id and arquivado_em is null and cadastro = 'sem_registro') then
    raise exception 'A igreja não está como sem registro.' using errcode = 'P0001';
  end if;
  if v_cnpj is null or not interno.cnpj_valido(v_cnpj) then
    raise exception 'Informe um CNPJ válido.' using errcode = 'P0001';
  end if;
  if p_natureza is null or p_natureza not in ('organizacao_religiosa', 'associacao_privada') then
    raise exception 'Diga a natureza jurídica que está no Cartão CNPJ.' using errcode = 'P0001';
  end if;
  perform interno.conferir_repetidos_igreja(v_cnpj, null, p_igreja_id);
  update public.igrejas set cadastro = 'completo', cnpj = v_cnpj, natureza_juridica = p_natureza where id = p_igreja_id;
  perform interno.ajustar_prazo_natureza(p_igreja_id);
end;
$$;


-- ---------------------------------------------------------------------
-- 12. As filiais
-- ---------------------------------------------------------------------
create function interno.salvar_filial(p_id uuid, p_igreja_id uuid, p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text := nullif(p_dados ->> 'tipo', '');
  v_nome text := nullif(trim(p_dados ->> 'nome'), '');
  v_bairro uuid;
  v_responsavel uuid;
  v_lat numeric;
  v_lon numeric;
  v_id uuid;
begin
  if p_id is not null then
    select f.igreja_id into p_igreja_id from public.igreja_filiais f where f.id = p_id and f.arquivado_em is null;
    if not found then
      raise exception 'Filial não encontrada.' using errcode = 'P0001';
    end if;
  end if;
  if not ((select interno.tenho_perfil('secretaria', 'presidencia')) or p_igreja_id in (select interno.igrejas_que_presido())) then
    raise exception 'Só o pastor presidente da igreja (regular), a secretaria ou a presidência cuidam das filiais.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.igrejas g where g.id = p_igreja_id and g.arquivado_em is null and g.cadastro = 'completo') then
    raise exception 'Só a igreja com registro tem filiais no COMEP.' using errcode = 'P0001';
  end if;
  begin
    v_bairro := nullif(p_dados ->> 'bairro_id', '')::uuid;
    v_responsavel := nullif(p_dados ->> 'responsavel_id', '')::uuid;
    v_lat := nullif(p_dados ->> 'latitude', '')::numeric;
    v_lon := nullif(p_dados ->> 'longitude', '')::numeric;
  exception when others then
    raise exception 'O bairro, o responsável ou a localização estão num formato inválido.' using errcode = 'P0001';
  end;
  if v_tipo is null or v_tipo not in ('congregacao', 'ponto_de_culto', 'celula') then
    raise exception 'Escolha o tipo: congregação, ponto de culto ou célula.' using errcode = 'P0001';
  end if;
  if v_nome is null or length(v_nome) not between 3 and 120 then
    raise exception 'Informe o nome da filial.' using errcode = 'P0001';
  end if;
  if v_bairro is not null and not exists (select 1 from public.bairros b where b.id = v_bairro and b.arquivado_em is null) then
    raise exception 'Bairro não encontrado.' using errcode = 'P0001';
  end if;
  -- o COMEP cuida de ministros, não de membros: o responsável é ministro associado da igreja (ou fica sem responsável)
  if v_responsavel is not null and not exists (
    select 1 from public.vinculos_igreja vi
    join public.associados a on a.pessoa_id = vi.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
    where vi.pessoa_id = v_responsavel and vi.igreja_id = p_igreja_id and vi.fim is null and vi.arquivado_em is null
  ) then
    raise exception 'O responsável precisa ser um ministro associado desta igreja. Se não houver, deixe sem responsável.' using errcode = 'P0001';
  end if;
  if (v_lat is null) <> (v_lon is null) or v_lat not between -90 and 90 or v_lon not between -180 and 180 then
    raise exception 'A localização não está certa. Cole de novo o link do Google Maps.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.igreja_filiais f where f.igreja_id = p_igreja_id and f.arquivado_em is null
               and lower(trim(f.nome)) = lower(v_nome) and f.id is distinct from p_id) then
    raise exception 'A igreja já tem uma filial com esse nome.' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.igreja_filiais (igreja_id, tipo, nome, bairro_id, responsavel_id, latitude, longitude)
    values (p_igreja_id, v_tipo, v_nome, v_bairro, v_responsavel, round(v_lat, 6), round(v_lon, 6))
    returning id into v_id;
    return v_id;
  end if;
  update public.igreja_filiais
  set tipo = v_tipo, nome = v_nome, bairro_id = v_bairro, responsavel_id = v_responsavel,
      latitude = round(v_lat, 6), longitude = round(v_lon, 6)
  where id = p_id;
  return p_id;
end;
$$;

create function interno.arquivar_filial(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_igreja uuid;
begin
  select f.igreja_id into v_igreja from public.igreja_filiais f where f.id = p_id and f.arquivado_em is null;
  if not found then
    raise exception 'Filial não encontrada.' using errcode = 'P0001';
  end if;
  if not ((select interno.tenho_perfil('secretaria', 'presidencia')) or v_igreja in (select interno.igrejas_que_presido())) then
    raise exception 'Só o pastor presidente da igreja (regular), a secretaria ou a presidência cuidam das filiais.' using errcode = '42501';
  end if;
  update public.igreja_filiais set arquivado_em = now() where id = p_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 13. A leitura da situação: a da minha igreja (pastor), a de uma igreja e a de todas (secretaria)
-- ---------------------------------------------------------------------
create function interno.situacao_da_igreja(p_igreja_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not interno.cuido_da_igreja(p_igreja_id) then
    raise exception 'Só quem cuida da igreja vê a situação dela.' using errcode = '42501';
  end if;
  return interno.situacao_igreja(p_igreja_id);
end;
$$;

-- A igreja do pastor: a que ele preside (mesmo suspensa ou com o perfil bloqueado) ou a que cadastrou e está em análise.
create function interno.minha_igreja()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_id uuid;
begin
  if v_eu is null then
    return null;
  end if;
  select vi.igreja_id into v_id
  from public.vinculos_igreja vi
  join public.associados a on a.pessoa_id = vi.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
  where vi.pessoa_id = v_eu and vi.pastor_presidente and vi.fim is null and vi.arquivado_em is null
  limit 1;
  if v_id is null then
    select g.id into v_id from public.igrejas g
    where g.cadastrada_por = v_eu and g.cadastro = 'em_analise' and g.arquivado_em is null
    order by g.criado_em desc
    limit 1;
  end if;
  if v_id is null then
    return null;
  end if;
  return (select jsonb_build_object('igreja_id', g.id, 'nome', g.nome, 'cadastro', g.cadastro, 'situacao', interno.situacao_igreja(g.id))
          from public.igrejas g where g.id = v_id);
end;
$$;

create function interno.situacao_das_igrejas()
returns table (
  igreja_id            uuid,
  situacao             jsonb,
  ministros            integer,
  ministros_em_dia     integer,
  filiais              integer,
  documentos_pendentes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Só a secretaria ou a presidência veem a situação das igrejas.' using errcode = '42501';
  end if;
  return query
  select g.id,
         interno.situacao_igreja(g.id),
         (select count(*)::integer from public.vinculos_igreja v
          join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
          where v.igreja_id = g.id and v.fim is null and v.arquivado_em is null),
         (select count(*)::integer from public.vinculos_igreja v
          join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
          where v.igreja_id = g.id and v.fim is null and v.arquivado_em is null and interno.esta_em_dia(v.pessoa_id)),
         (select count(*)::integer from public.igreja_filiais f where f.igreja_id = g.id and f.arquivado_em is null),
         (select count(*)::integer from public.igreja_documentos d
          where d.igreja_id = g.id and d.arquivado_em is null and d.situacao = 'pendente')
  from public.igrejas g
  where g.arquivado_em is null;
end;
$$;


-- ---------------------------------------------------------------------
-- 14. Empréstimos: só a igreja regular; a secretaria registra direto (já aprovado)
-- ---------------------------------------------------------------------
create or replace function interno.pedir_emprestimo(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu uuid := (select interno.minha_pessoa_id());
  v_config public.config_patrimonio;
  v_igreja uuid;
  v_evento uuid;
  v_retirada date;
  v_devolucao date;
  v_equipe boolean := interno.cuido_do_patrimonio();
  v_direto boolean := false;
  v_situacao text;
  v_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_qtd integer;
  v_falta text;
begin
  if v_eu is null then
    raise exception 'Entre no sistema para pedir.' using errcode = '42501';
  end if;
  begin
    v_igreja := nullif(p_dados ->> 'igreja_id', '')::uuid;
    v_evento := nullif(p_dados ->> 'evento_id', '')::uuid;
    v_retirada := (p_dados ->> 'retirada')::date;
    v_devolucao := (p_dados ->> 'devolucao')::date;
    v_direto := coalesce((p_dados ->> 'registrar_direto')::boolean, false);
  exception when others then
    raise exception 'Datas inválidas.' using errcode = 'P0001';
  end;
  select * into v_config from public.config_patrimonio where id;
  if v_retirada is null or v_devolucao is null or v_devolucao < v_retirada then
    raise exception 'Informe a retirada e a devolução (a devolução depois da retirada).' using errcode = 'P0001';
  end if;
  -- um pedido de cada vez na agenda (a reserva do evento já entra aprovada)
  perform pg_advisory_xact_lock(hashtext('comep: agenda do patrimônio'));
  if (v_igreja is null) = (v_evento is null) then
    raise exception 'O pedido é de uma igreja ou de um evento do COMEP.' using errcode = 'P0001';
  end if;
  -- registrar direto (já aprovado) é da secretaria e da presidência, que aprovam os pedidos
  if v_direto and not (select interno.tenho_perfil('secretaria', 'presidencia')) then
    raise exception 'Registrar o empréstimo direto é da secretaria ou da presidência.' using errcode = '42501';
  end if;
  if v_evento is not null then
    -- reserva para um evento do próprio COMEP: só quem cuida do patrimônio
    if not v_equipe then
      raise exception 'A reserva para os eventos do COMEP é da secretaria ou da presidência.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.eventos where id = v_evento and arquivado_em is null and situacao in ('rascunho', 'publicado')) then
      raise exception 'Evento não encontrado (ou já realizado/cancelado).' using errcode = 'P0001';
    end if;
  else
    -- empréstimo à igreja: o presidente dela pede (ou a equipe, em nome da igreja)
    if not (v_igreja in (select interno.igrejas_que_presido()) or v_equipe) then
      raise exception 'Só o pastor presidente da igreja (regular) pede os itens emprestados.' using errcode = '42501';
    end if;
    if not exists (select 1 from public.igrejas where id = v_igreja and arquivado_em is null) then
      raise exception 'Igreja não encontrada.' using errcode = 'P0001';
    end if;
    -- só a igreja regular: sem registro não há como fazer o contrato; suspensa, só depois de mandar o documento
    v_situacao := interno.situacao_igreja(v_igreja) ->> 'situacao';
    if v_situacao = 'sem_registro' then
      raise exception 'Igreja sem registro não pega empréstimos: sem CNPJ, não há como fazer o contrato.' using errcode = 'P0001';
    elsif v_situacao = 'em_analise' then
      raise exception 'A igreja ainda está em análise pela secretaria.' using errcode = 'P0001';
    elsif v_situacao <> 'regular' then
      raise exception 'A igreja está suspensa: os empréstimos voltam quando ela estiver regular.' using errcode = 'P0001';
    end if;
    if not coalesce((p_dados ->> 'aceite')::boolean, false) then
      raise exception 'Para pedir, aceite o termo de compromisso.' using errcode = 'P0001';
    end if;
    if v_config.exige_em_dia and not v_equipe and not interno.esta_em_dia(v_eu) then
      raise exception 'Para pedir, a sua contribuição precisa estar em dia.' using errcode = 'P0001';
    end if;
    if v_retirada < current_date + v_config.antecedencia_dias and not v_equipe then
      raise exception 'O pedido precisa de % dia(s) de antecedência.', v_config.antecedencia_dias using errcode = 'P0001';
    end if;
  end if;
  if v_retirada < current_date then
    raise exception 'A retirada não pode ser no passado.' using errcode = 'P0001';
  end if;
  if v_devolucao - v_retirada + 1 > v_config.prazo_maximo_dias then
    raise exception 'O empréstimo é de no máximo % dia(s).', v_config.prazo_maximo_dias using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_dados ->> 'finalidade')), 0) < 3 then
    raise exception 'Diga para que é (ex.: culto de aniversário da igreja).' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_dados -> 'itens') <> 'array' or jsonb_array_length(p_dados -> 'itens') = 0 then
    raise exception 'Escolha os itens.' using errcode = 'P0001';
  end if;

  insert into public.emprestimos (igreja_id, evento_id, solicitante_id, retirada, devolucao, finalidade, termo_texto, termo_aceito_em)
  values (v_igreja, v_evento, v_eu, v_retirada, v_devolucao, trim(p_dados ->> 'finalidade'),
          case when v_igreja is not null then v_config.texto_termo end, case when v_igreja is not null then now() end)
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(p_dados -> 'itens') loop
    begin
      v_item_id := (v_item ->> 'item_id')::uuid;
      v_qtd := (v_item ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Item ou quantidade inválidos.' using errcode = 'P0001';
    end;
    if v_qtd is null or v_qtd < 1 then
      raise exception 'A quantidade é pelo menos 1.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.patrimonio_itens where id = v_item_id and arquivado_em is null and emprestavel) then
      raise exception 'Um dos itens não está disponível para empréstimo.' using errcode = 'P0001';
    end if;
    insert into public.emprestimo_itens (emprestimo_id, item_id, quantidade) values (v_id, v_item_id, v_qtd);
  end loop;
  -- já avisa se o período não tem o que foi pedido
  v_falta := interno.falta_no_periodo(v_id);
  if v_falta is not null then
    raise exception 'Não há o suficiente nesse período. %', v_falta using errcode = 'P0001';
  end if;
  -- a reserva para os eventos do COMEP e o empréstimo registrado direto pela secretaria já entram aprovados
  if v_evento is not null or v_direto then
    update public.emprestimos set situacao = 'aprovado', decidido_por = v_eu, decidido_em = now() where id = v_id;
  end if;
  return v_id;
end;
$$;

-- As igrejas para o pedido (o pastor presidente: a dele; a equipe: todas), com o peso e a situação de cada uma
create or replace function interno.igrejas_do_pedido()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_equipe boolean := interno.cuido_do_patrimonio();
begin
  if not (select interno.sou_do_comep()) then
    raise exception 'O patrimônio é de quem é do COMEP.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome, 'ministros', m.ministros, 'em_dia', m.em_dia,
                                        'situacao', interno.situacao_igreja(g.id) ->> 'situacao') order by g.nome)
    from public.igrejas g
    cross join lateral (
      select count(distinct v.pessoa_id)::integer as ministros,
             count(distinct v.pessoa_id) filter (where interno.esta_em_dia(v.pessoa_id))::integer as em_dia
      from public.vinculos_igreja v
      join public.associados a on a.pessoa_id = v.pessoa_id and a.arquivado_em is null and a.situacao = 'ativo'
      where v.igreja_id = g.id and v.fim is null and v.arquivado_em is null
    ) m
    where g.arquivado_em is null and g.cadastro <> 'em_analise' and (v_equipe or g.id in (select interno.igrejas_que_presido()))
  ), '[]'::jsonb);
end;
$$;


-- ---------------------------------------------------------------------
-- 15. Leitura (RLS), arquivos e funções pela API
-- ---------------------------------------------------------------------
revoke all on public.config_igrejas, public.igreja_documento_partes, public.igreja_analise_itens, public.igreja_filiais
  from anon, authenticated;
grant select on public.config_igrejas, public.igreja_documento_partes, public.igreja_analise_itens, public.igreja_filiais
  to authenticated;
grant update (transicao_ate, dias_para_mandar, dias_cartao_cnpj) on public.config_igrejas to authenticated;
alter table public.config_igrejas enable row level security;
alter table public.igreja_documento_partes enable row level security;
alter table public.igreja_analise_itens enable row level security;
alter table public.igreja_filiais enable row level security;

create policy "regras das igrejas: quem é do COMEP lê"
  on public.config_igrejas for select to authenticated using ((select interno.sou_do_comep()));
create policy "regras das igrejas: a presidência altera"
  on public.config_igrejas for update to authenticated
  using ((select interno.tenho_perfil('presidencia'))) with check ((select interno.tenho_perfil('presidencia')));

-- documentos e diretoria: a secretaria, a presidência e quem cuida da igreja (mesmo suspensa, nos 30 dias; ou em análise)
drop policy "documentos da igreja: quem cuida da igreja lê" on public.igreja_documentos;
create policy "documentos da igreja: quem cuida da igreja lê"
  on public.igreja_documentos for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')) or igreja_id in (select interno.igrejas_que_cuido()));
drop policy "diretoria da igreja: quem cuida da igreja lê" on public.igreja_diretoria;
create policy "diretoria da igreja: quem cuida da igreja lê"
  on public.igreja_diretoria for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')) or igreja_id in (select interno.igrejas_que_cuido()));
create policy "partes dos documentos: quem lê o documento"
  on public.igreja_documento_partes for select to authenticated
  using (exists (select 1 from public.igreja_documentos d where d.id = documento_id));
create policy "conferência da igreja nova: a secretaria e quem cadastrou"
  on public.igreja_analise_itens for select to authenticated
  using ((select interno.tenho_perfil('secretaria', 'presidencia')) or igreja_id in (select interno.igrejas_que_cuido()));
create policy "filiais: a secretaria e o pastor presidente da igreja"
  on public.igreja_filiais for select to authenticated
  using (arquivado_em is null
         and ((select interno.tenho_perfil('secretaria', 'presidencia')) or igreja_id in (select interno.igrejas_que_presido())));

-- os arquivos: igrejas/<id da igreja>/<arquivo>, para quem cuida da igreja
drop policy "igrejas: quem cuida da igreja envia" on storage.objects;
drop policy "igrejas: quem cuida da igreja lê" on storage.objects;
create policy "igrejas: quem cuida da igreja envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'igrejas'
    and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]{0,99}$'
    and (
      (select interno.tenho_perfil('secretaria', 'presidencia'))
      or split_part(name, '/', 1) in (select x::text from interno.igrejas_que_cuido() x)
    )
  );
create policy "igrejas: quem cuida da igreja lê"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'igrejas'
    and (
      (select interno.tenho_perfil('secretaria', 'presidencia'))
      or split_part(name, '/', 1) in (select x::text from interno.igrejas_que_cuido() x)
    )
  );

-- o envio antigo (um arquivo, o novo arquivando o anterior) e a diretoria sem ata saem da API:
-- agora o documento vai com as partes e a validade, e a diretoria vai com a ata
revoke execute on function public.registrar_documento_igreja(uuid, public.tipo_documento_igreja, text, text) from authenticated;
revoke execute on function public.salvar_diretoria_igreja(uuid, date, date, jsonb) from authenticated;

create function public.enviar_documento_igreja(p_igreja_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.enviar_documento_igreja(p_igreja_id, p_dados); $$;
create function public.cadastrar_igreja(p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.cadastrar_igreja(p_dados); $$;
create function public.pedir_cadastro_igreja(p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.pedir_cadastro_igreja(p_dados); $$;
create function public.corrigir_cadastro_igreja(p_igreja_id uuid, p_item text, p_dados jsonb)
returns void language sql security invoker set search_path = '' as $$ select interno.corrigir_cadastro_igreja(p_igreja_id, p_item, p_dados); $$;
create function public.conferir_item_igreja(p_igreja_id uuid, p_item text, p_aprovar boolean, p_motivo text)
returns void language sql security invoker set search_path = '' as $$
  select interno.conferir_item_igreja(p_igreja_id, p_item, p_aprovar, p_motivo);
$$;
create function public.ativar_igreja(p_igreja_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.ativar_igreja(p_igreja_id); $$;
create function public.regularizar_igreja(p_igreja_id uuid, p_cnpj text, p_natureza text)
returns void language sql security invoker set search_path = '' as $$ select interno.regularizar_igreja(p_igreja_id, p_cnpj, p_natureza); $$;
create function public.salvar_filial(p_id uuid, p_igreja_id uuid, p_dados jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select interno.salvar_filial(p_id, p_igreja_id, p_dados); $$;
create function public.arquivar_filial(p_id uuid)
returns void language sql security invoker set search_path = '' as $$ select interno.arquivar_filial(p_id); $$;
create function public.situacao_da_igreja(p_igreja_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.situacao_da_igreja(p_igreja_id); $$;
create function public.minha_igreja()
returns jsonb language sql stable security invoker set search_path = '' as $$ select interno.minha_igreja(); $$;
create function public.situacao_das_igrejas()
returns table (igreja_id uuid, situacao jsonb, ministros integer, ministros_em_dia integer, filiais integer, documentos_pendentes integer)
language sql stable security invoker set search_path = '' as $$ select * from interno.situacao_das_igrejas(); $$;

do $$
declare
  v text;
begin
  -- as internas que as regras de acesso e as públicas chamam
  foreach v in array array[
    'cobertura_documento(uuid, public.tipo_documento_igreja, date)', 'situacao_igreja(uuid, date)',
    'presidente_bloqueado(uuid)', 'igrejas_que_cuido()', 'ajustar_prazo_natureza(uuid)', 'efeitos_do_documento(uuid)',
    'enviar_documento_igreja(uuid, jsonb)', 'dados_da_igreja(jsonb, boolean)', 'conferir_repetidos_igreja(text, text, uuid)',
    'tornar_pastor_presidente(uuid, uuid)', 'cadastrar_igreja(jsonb)', 'pedir_cadastro_igreja(jsonb)',
    'corrigir_cadastro_igreja(uuid, text, jsonb)', 'conferir_item_igreja(uuid, text, boolean, text)', 'ativar_igreja(uuid)',
    'regularizar_igreja(uuid, text, text)', 'salvar_filial(uuid, uuid, jsonb)', 'arquivar_filial(uuid)',
    'situacao_da_igreja(uuid)', 'minha_igreja()', 'situacao_das_igrejas()'
  ] loop
    execute format('revoke all on function interno.%s from public', v);
    execute format('grant execute on function interno.%s to authenticated', v);
  end loop;
  revoke all on function interno.validar_vinculo_igreja() from public;
  revoke all on function interno.prazo_da_natureza() from public;
  foreach v in array array[
    'enviar_documento_igreja(uuid, jsonb)', 'cadastrar_igreja(jsonb)', 'pedir_cadastro_igreja(jsonb)',
    'corrigir_cadastro_igreja(uuid, text, jsonb)', 'conferir_item_igreja(uuid, text, boolean, text)', 'ativar_igreja(uuid)',
    'regularizar_igreja(uuid, text, text)', 'salvar_filial(uuid, uuid, jsonb)', 'arquivar_filial(uuid)',
    'situacao_da_igreja(uuid)', 'minha_igreja()', 'situacao_das_igrejas()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
end;
$$;
