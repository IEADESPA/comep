// Fase 3.3 (ajuste de 13/11/2026): validade da credencial por mandato. Rodar: npm test
// A digital acompanha o mandato em curso e muda sozinha na posse; a impressa vale até a data que está nela.

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Credencial = { codigo: string; valida_ate: string | null; emitida_em: string | null; foto_publica: string | null }
type Validacao = { situacao: string; valida_ate?: string | null; renovada?: boolean }

describe('Fase 3.3 — validade da credencial por mandato', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let pessoaMinistro: string
  const codigos: Record<string, string> = {}

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  async function minha(): Promise<Credencial> {
    const r = await chamar(ministro, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoaMinistro]])
    return (r.rows[0] as { d: { credenciais: Credencial[] } }).d.credenciais[0]
  }

  async function validar(codigo: string): Promise<Validacao> {
    const r = await chamar(null, 'select public.validar_credencial($1) as v', [codigo])
    return (r.rows[0] as { v: Validacao }).v
  }

  async function dia(deslocamento: number): Promise<string> {
    const r = await db.query<{ d: string }>('select (current_date + $1::int)::text as d', [deslocamento])
    return r.rows[0].d
  }

  const posse = (quem: string, fim: string) => chamar(quem, 'select public.registrar_novo_mandato($1::date) as n', [fim])

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])
    pessoaMinistro = p.rows[0].id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [
      pessoaMinistro,
    ])
  })

  it('posse sem o fim do mandato atual informado: pede para informar primeiro', async () => {
    await assert.rejects(posse(secretaria, await dia(1000)), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('a credencial atual acompanha o fim do mandato em curso (mandato acabou e a posse atrasou: "vencida")', async () => {
    await chamar(secretaria, 'update public.config_credencial set fim_mandato = current_date - 1')
    const c = await minha()
    codigos.a = c.codigo
    assert.equal(c.valida_ate, await dia(-1))
    assert.ok(c.emitida_em, 'data de emissão')
    const v = await validar(c.codigo)
    assert.equal(v.situacao, 'vencida')
    assert.equal(v.renovada, false)
  })

  it('só a secretaria (ou a presidência) registra o novo mandato, com data depois do atual e de hoje', async () => {
    await assert.rejects(posse(ministro, await dia(1000)), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(posse(secretaria, await dia(0)), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(
      chamar(secretaria, 'select public.registrar_novo_mandato(null)'),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
  })

  it('posse: a digital ganha novo QR com a nova validade; a antiga continua "vencida" (é de outro mandato)', async () => {
    await db.query("update public.credenciais set foto_publica = $1 || '/foto.jpg' where codigo = $1", [codigos.a])
    const r = await posse(secretaria, await dia(1000))
    assert.ok((r.rows[0] as { n: number }).n >= 1)
    const c = await minha()
    codigos.b = c.codigo
    assert.notEqual(c.codigo, codigos.a)
    assert.equal(c.valida_ate, await dia(1000))
    assert.equal(c.foto_publica, `${codigos.a}/foto.jpg`, 'a foto pública continua até ser publicada de novo')
    const antiga = await validar(codigos.a)
    assert.equal(antiga.situacao, 'vencida')
    assert.equal(antiga.renovada, true)
    assert.equal(antiga.valida_ate, await dia(-1))
    assert.equal((await validar(codigos.b)).situacao, 'valida')
  })

  it('corrigir a data muda a validade do mandato em curso, sem trocar o QR nem mexer no mandato anterior', async () => {
    await chamar(secretaria, 'update public.config_credencial set fim_mandato = current_date + 900')
    const c = await minha()
    assert.equal(c.codigo, codigos.b)
    assert.equal(c.valida_ate, await dia(900))
    assert.equal((await validar(codigos.b)).valida_ate, await dia(900))
    assert.equal((await validar(codigos.a)).valida_ate, await dia(-1))
  })

  it('a impressa do mandato anterior vale até a data dela (aqui, ainda no prazo); a nova, até o novo fim', async () => {
    await posse(secretaria, await dia(2000))
    const c = await minha()
    codigos.c = c.codigo
    const anterior = await validar(codigos.b)
    assert.equal(anterior.situacao, 'valida')
    assert.equal(anterior.renovada, true)
    assert.equal(anterior.valida_ate, await dia(900))
    assert.equal((await validar(codigos.c)).valida_ate, await dia(2000))
  })

  it('a credencial de mandato anterior não recebe foto pública (só a atual)', async () => {
    await assert.rejects(
      chamar(ministro, 'select public.registrar_foto_publica($1, $2)', [codigos.b, `${codigos.b}/foto-2.jpg`]),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
  })

  it('perda: todas as credenciais da pessoa (inclusive as de mandatos anteriores) passam a dizer "substituída"', async () => {
    const r = await chamar(secretaria, "select public.substituir_credencial($1, 'Perda') as novo", [pessoaMinistro])
    const novo = (r.rows[0] as { novo: string }).novo
    for (const antigo of [codigos.a, codigos.b, codigos.c]) assert.equal((await validar(antigo)).situacao, 'substituida')
    const v = await validar(novo)
    assert.equal(v.situacao, 'valida')
    assert.equal(v.valida_ate, await dia(2000))
  })
})
