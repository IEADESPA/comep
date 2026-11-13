// Fase 3.1: dados da credencial — CPF, filiação, sigla da igreja e pendências. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const FORA_DO_FORMATO = '23514'
const DUPLICADO = '23505'

// CPFs fictícios com dígitos verificadores válidos
const CPF_A = '52998224725'
const CPF_B = '11144477735'

describe('Fase 3.1 — dados da credencial', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let pastor: string
  let pessoaMinistro: string
  let igreja: string

  const chamar = (quem: string, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function pendencias(pessoa: string): Promise<string[]> {
    const r = await db.query<{ pendencias: string[] }>(
      'select pendencias from public.vw_pendencias_credencial where pessoa_id = $1',
      [pessoa],
    )
    return r.rows[0].pendencias
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    pastor = await criarUsuario(db, 'pastor@teste.local', 'Pastor Presidente de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja Evangélica de Teste') returning id")
    igreja = i.rows[0].id
    pessoaMinistro = await pessoaDe(ministro)
    const pessoaPastor = await pessoaDe(pastor)
    for (const p of [pessoaMinistro, pessoaPastor]) {
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p])
    }
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoaMinistro, igreja])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, true)', [
      pessoaPastor,
      igreja,
    ])
  })

  it('a credencial começa com todas as pendências', async () => {
    assert.deepEqual(await pendencias(pessoaMinistro), [
      'Sem foto',
      'Sem CPF',
      'Sem o nome da mãe',
      'Sem título',
      'Sem a função na igreja',
      'Igreja sem sigla',
      'Igreja sem CNPJ',
    ])
  })

  it('CPF só com dígitos verificadores certos', async () => {
    for (const errado of ['12345678900', '11111111111', '5299822472', '529.982.247-25']) {
      await assert.rejects(
        chamar(ministro, 'update public.pessoas set cpf = $1 where id = $2', [errado, pessoaMinistro]),
        erroComCodigo(FORA_DO_FORMATO),
        errado,
      )
    }
  })

  it('o ministro preenche o próprio CPF e a filiação; depois, não muda mais', async () => {
    await chamar(ministro, "update public.pessoas set cpf = $1, nome_mae = 'Maria de Teste' where id = $2", [CPF_A, pessoaMinistro])
    await assert.rejects(
      chamar(ministro, 'update public.pessoas set cpf = $1 where id = $2', [CPF_B, pessoaMinistro]),
      erroComCodigo(SEM_PERMISSAO),
    )
    await assert.rejects(
      chamar(ministro, "update public.pessoas set nome_mae = 'Outra' where id = $1", [pessoaMinistro]),
      erroComCodigo(SEM_PERMISSAO),
    )
    // O pai, ainda vazio, ele preenche
    await chamar(ministro, "update public.pessoas set nome_pai = 'José de Teste' where id = $1", [pessoaMinistro])
  })

  it('a secretaria corrige; o mesmo CPF não serve para duas pessoas', async () => {
    await chamar(secretaria, 'update public.pessoas set cpf = $1 where id = $2', [CPF_B, pessoaMinistro])
    const pastorPessoa = await pessoaDe(pastor)
    await assert.rejects(
      chamar(secretaria, 'update public.pessoas set cpf = $1 where id = $2', [CPF_B, pastorPessoa]),
      erroComCodigo(DUPLICADO),
    )
  })

  it('o pastor presidente põe a sigla da própria igreja, mas não o CNPJ', async () => {
    await chamar(pastor, "update public.igrejas set sigla = 'IET' where id = $1", [igreja])
    await assert.rejects(
      chamar(pastor, "update public.igrejas set cnpj = '11222333000181' where id = $1", [igreja]),
      erroComCodigo(SEM_PERMISSAO),
    )
    await assert.rejects(
      chamar(secretaria, "insert into public.igrejas (nome, sigla) values ('Outra Igreja', 'iet')"),
      erroComCodigo(DUPLICADO),
    )
  })

  it('as pendências diminuem conforme os dados chegam; o pastor presidente não precisa de função', async () => {
    assert.deepEqual(await pendencias(pessoaMinistro), [
      'Sem foto',
      'Sem título',
      'Sem a função na igreja',
      'Igreja sem CNPJ',
    ])
    const pastorPessoa = await pessoaDe(pastor)
    assert.ok(!(await pendencias(pastorPessoa)).includes('Sem a função na igreja'))
  })

  it('o ministro vê só as próprias pendências; a secretaria vê todas', async () => {
    const meu = await chamar(ministro, 'select pessoa_id from public.vw_pendencias_credencial')
    assert.deepEqual(meu.rows, [{ pessoa_id: pessoaMinistro }])
    const todas = await chamar(secretaria, 'select pessoa_id from public.vw_pendencias_credencial')
    assert.equal(todas.rows.length, 2)
  })
})
