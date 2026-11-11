// Banco PostgreSQL de teste que roda dentro do Node (PGlite), sem Docker e sem internet.
// Aplica as mesmas migrações de supabase/migrations e imita o mínimo do Supabase
// (papéis anon/authenticated, tabela auth.users e a função auth.uid()).
// Serve para testar as regras de acesso (RLS) antes de cada publicação.
// A conferência final continua sendo no projeto Supabase de teste.

import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PASTA_MIGRACOES = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')

const IMITACAO_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id                 uuid primary key default gen_random_uuid(),
    email              text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(IMITACAO_SUPABASE)
  const migracoes = readdirSync(PASTA_MIGRACOES)
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort()
  for (const arquivo of migracoes) {
    try {
      await db.exec(readFileSync(join(PASTA_MIGRACOES, arquivo), 'utf8'))
    } catch (erro) {
      throw new Error(`Falha ao aplicar a migração ${arquivo}: ${(erro as Error).message}`)
    }
  }
  return db
}

/** Simula alguém criando login no app. Devolve o id do usuário. */
export async function criarUsuario(db: PGlite, email: string, nome?: string): Promise<string> {
  const resultado = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id',
    [email, JSON.stringify(nome ? { nome } : {})],
  )
  return resultado.rows[0].id
}

/** Dá um perfil direto pelo dono do banco (como no primeiro acesso, pelo SQL Editor). */
export async function darPerfil(db: PGlite, usuarioId: string, perfil: string): Promise<void> {
  await db.query(
    `insert into public.perfis_acesso (pessoa_id, perfil)
     select id, $2::public.perfil_acesso from public.pessoas where usuario_id = $1`,
    [usuarioId, perfil],
  )
}

/** Roda as consultas como um usuário logado no app (ou como visitante, se usuarioId = null). */
export async function como<T>(db: PGlite, usuarioId: string | null, acao: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [usuarioId ?? ''])
  await db.exec(usuarioId ? 'set role authenticated' : 'set role anon')
  try {
    return await acao()
  } finally {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
  }
}

/** Confere o código de erro do PostgreSQL (ex.: 42501 = sem permissão). */
export function erroComCodigo(codigo: string) {
  return (erro: unknown) => (erro as { code?: string }).code === codigo
}
