// Testes dos dados do COMEP mostrados no site (decisão 14: editáveis pela diretoria).
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'

describe('Dados do COMEP no site', () => {
  let db: PGlite
  let secretaria: string
  let administrador: string
  let ministro: string

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    administrador = await criarUsuario(db, 'admin@teste.local', 'Administrador de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, administrador, 'admin_tecnico')
    await darPerfil(db, ministro, 'ministro')
  })

  it('começa com uma linha vazia, que o visitante (sem login) consegue ler', async () => {
    const r = await como(db, null, () =>
      db.query<{ cnpj: string | null; email: string | null }>('select cnpj, email from public.dados_comep'),
    )
    assert.deepEqual(r.rows, [{ cnpj: null, email: null }])
  })

  it('a secretaria e o administrador técnico atualizam; o ministro não', async () => {
    for (const [usuario, email] of [
      [secretaria, 'contato@comep.teste'],
      [administrador, 'secretaria@comep.teste'],
    ]) {
      const r = await como(db, usuario, () => db.query('update public.dados_comep set email = $1', [email]))
      assert.equal(r.affectedRows, 1)
    }
    const m = await como(db, ministro, () => db.query("update public.dados_comep set email = 'invadido@x'"))
    assert.equal(m.affectedRows, 0)
  })

  it('o visitante não altera', async () => {
    await assert.rejects(
      como(db, null, () => db.query("update public.dados_comep set email = 'x'")),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('não aceita CNPJ inválido e não cria uma segunda linha', async () => {
    await assert.rejects(
      como(db, secretaria, () => db.query("update public.dados_comep set cnpj = '11222333000182'")),
      erroComCodigo('23514'),
    )
    await assert.rejects(
      como(db, secretaria, () => db.query('insert into public.dados_comep (id) values (true)')),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('a alteração fica na auditoria e nada se apaga', async () => {
    const r = await db.query<{ total: number }>(
      "select count(*)::int as total from public.auditoria where tabela = 'dados_comep' and operacao = 'UPDATE'",
    )
    assert.equal(r.rows[0].total, 2)
    await assert.rejects(db.query('delete from public.dados_comep'), erroComCodigo('P0001'))
  })
})
