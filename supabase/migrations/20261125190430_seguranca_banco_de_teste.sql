-- Revisão do portão do ramo da segurança do banco (25/11/2026), menor 1: o domínio reservado .invalid (RFC 6761), da
-- inscrição falsa do ponta a ponta, deixa de valer na produção. Vale só no banco marcado como de teste.
--   - interno.ambiente: uma linha só, que diz se este banco é o de teste. Nasce "não" (a produção fica certa sem
--     ninguém fazer nada); no banco de teste, o dono do banco marca uma vez, à mão:
--       update interno.ambiente set de_teste = true;
--     Ninguém mais lê nem muda essa linha (fica fora da API).
--   - o aparelho ativo com endereço .invalid só entra no banco marcado; no outro, recebe a mesma mensagem do serviço
--     de push que o COMEP não reconhece.


-- ---------------------------------------------------------------------
-- 1. O ambiente deste banco
-- ---------------------------------------------------------------------
create table interno.ambiente (
  id            boolean primary key default true check (id),
  de_teste      boolean not null default false,
  criado_por    uuid default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table interno.ambiente is
  'Uma linha: se este banco é o de teste (marcado à mão pelo dono do banco, só no de teste). A produção fica com "não".';
comment on column interno.ambiente.de_teste is
  'true só no banco de teste: libera o que existe só para os testes (o aparelho falso do ponta a ponta).';
select interno.aplicar_padroes('interno.ambiente');
alter table interno.ambiente enable row level security;
revoke all on interno.ambiente from public, anon, authenticated;
insert into interno.ambiente (id) values (true);


-- ---------------------------------------------------------------------
-- 2. O aparelho com endereço .invalid só no banco de teste
-- ---------------------------------------------------------------------
create function interno.endereco_de_teste_so_no_banco_de_teste()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.arquivado_em is null
     and coalesce(new.endpoint, '') ~* '^https://([a-z0-9-]+\.)+invalid/'
     and not coalesce((select a.de_teste from interno.ambiente a where a.id), false) then
    raise exception 'Este navegador usa um serviço de avisos que o COMEP não reconhece. Use o Chrome, o Edge, o Firefox ou o Safari.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
comment on function interno.endereco_de_teste_so_no_banco_de_teste() is
  'O aparelho com endereço do domínio reservado .invalid (o falso do ponta a ponta) só fica ativo no banco marcado como de teste.';

create trigger endereco_de_teste_so_no_banco_de_teste
  before insert or update of endpoint, arquivado_em on public.inscricoes_push
  for each row execute function interno.endereco_de_teste_so_no_banco_de_teste();

revoke all on function interno.endereco_de_teste_so_no_banco_de_teste() from public;

comment on function interno.endereco_de_push_aceito(text) is
  'O endereço do aparelho é de um serviço de push dos navegadores (o domínio reservado .invalid, dos testes, só vale no banco de teste: gatilho endereco_de_teste_so_no_banco_de_teste).';


-- ---------------------------------------------------------------------
-- 3. O aparelho .invalid que estava ativo sai (o banco ainda não está marcado: no de teste, o ponta a ponta inscreve
--    de novo depois da marca; a produção começa vazia)
-- ---------------------------------------------------------------------
update public.inscricoes_push
set arquivado_em = now(), motivo_arquivo = 'endereco_recusado'
where arquivado_em is null and endpoint ~* '^https://([a-z0-9-]+\.)+invalid/';
