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

  /** CPF e filiação só se gravam pela função (revisão da Fase 3): devolve 'ok' ou 'cpf_repetido' */
  const gravar = (quem: string, pessoa: string, dados: Record<string, string | null>) =>
    chamar(quem, 'select public.gravar_identidade($1, $2::jsonb) as r', [pessoa, JSON.stringify(dados)]).then(
      (r) => (r.rows[0] as { r: string }).r,
    )

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
    for (const errado of ['12345678900', '11111111111', '5299822472', '529.982.247-2']) {
      await assert.rejects(gravar(ministro, pessoaMinistro, { cpf: errado }), erroComCodigo(FORA_DO_FORMATO), errado)
    }
    // direto na tabela, nem tenta (sem permissão na coluna)
    await assert.rejects(
      chamar(ministro, 'update public.pessoas set cpf = $1 where id = $2', [CPF_A, pessoaMinistro]),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('o ministro preenche o próprio CPF e a filiação; depois, não muda mais', async () => {
    assert.equal(await gravar(ministro, pessoaMinistro, { cpf: '529.982.247-25', nome_mae: 'Maria de Teste' }), 'ok')
    await assert.rejects(gravar(ministro, pessoaMinistro, { cpf: CPF_B }), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(gravar(ministro, pessoaMinistro, { nome_mae: 'Outra' }), erroComCodigo(SEM_PERMISSAO))
    // O pai, ainda vazio, ele preenche
    assert.equal(await gravar(ministro, pessoaMinistro, { nome_pai: 'José de Teste' }), 'ok')
    const r = await chamar(ministro, 'select public.identidade_pessoa($1) as i', [pessoaMinistro])
    assert.deepEqual((r.rows[0] as { i: unknown }).i, { cpf: CPF_A, nome_pai: 'José de Teste', nome_mae: 'Maria de Teste' })
  })

  it('a secretaria corrige; o mesmo CPF não serve para duas pessoas', async () => {
    assert.equal(await gravar(secretaria, pessoaMinistro, { cpf: CPF_B }), 'ok')
    const pastorPessoa = await pessoaDe(pastor)
    assert.equal(await gravar(secretaria, pastorPessoa, { cpf: CPF_B }), 'cpf_repetido')
    // e o índice único continua lá, por garantia
    await assert.rejects(db.query('update public.pessoas set cpf = $1 where id = $2', [CPF_B, pastorPessoa]), erroComCodigo(DUPLICADO))
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
