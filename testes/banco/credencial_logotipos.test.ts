// Fase 5.5, parte 8: o logotipo de cada denominação (o arquivo que a denominação fornecer, enviado pela secretaria)
// e o logotipo nos dados da credencial de cada pessoa. Rodar: npm test
import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.5 (parte 8) — os logotipos das denominações', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let pessoaMinistro: string
  let denominacao: string
  const arquivo = '0f0e0d0c-0b0a-4908-8706-050403020101.png'

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    pessoaMinistro = (await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])).rows[0].id
    denominacao = (await db.query<{ id: string }>("insert into public.denominacoes (nome, tradicao) values ('Denominação Fictícia', 'pentecostal') returning id")).rows[0].id
    const igreja = (await db.query<{ id: string }>("insert into public.igrejas (nome, sigla, denominacao_id) values ('Igreja Fictícia', 'IF', $1) returning id", [denominacao])).rows[0].id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoaMinistro])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao) values ($1, $2, $3)', [pessoaMinistro, igreja, 'Pastor auxiliar'])
  })

  const logotipoNaCredencial = async () => {
    const r = await chamar(ministro, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoaMinistro]])
    return (r.rows[0] as { d: { credenciais: { denominacao_logotipo: string | null }[] } }).d.credenciais[0].denominacao_logotipo
  }

  it('sem logotipo enviado, a credencial não traz nenhum', async () => {
    assert.equal(await logotipoNaCredencial(), null)
  })

  it('só a secretaria (ou a presidência) envia; o arquivo precisa estar na pasta do modelo', async () => {
    await assert.rejects(chamar(ministro, 'select public.enviar_logotipo_denominacao($1, $2)', [denominacao, arquivo]), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(chamar(secretaria, 'select public.enviar_logotipo_denominacao($1, $2)', [denominacao, arquivo]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(
      chamar(secretaria, 'select public.enviar_logotipo_denominacao($1, $2)', [denominacao, 'https://exemplo.com/logo.png']),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    await chamar(secretaria, "insert into storage.objects (bucket_id, name) values ('credencial-modelo', $1)", [arquivo])
    await chamar(secretaria, 'select public.enviar_logotipo_denominacao($1, $2)', [denominacao, arquivo])
    const d = (await db.query<{ logotipo: string; logotipo_em: string | null }>('select logotipo, logotipo_em from public.denominacoes where id = $1', [denominacao])).rows[0]
    assert.equal(d.logotipo, arquivo)
    assert.ok(d.logotipo_em)
  })

  it('a credencial de cada pessoa traz o logotipo da denominação da igreja dela', async () => {
    assert.equal(await logotipoNaCredencial(), arquivo)
  })

  it('ninguém muda o logotipo direto na tabela; tirar o logotipo é pela função', async () => {
    await assert.rejects(chamar(secretaria, 'update public.denominacoes set logotipo = null where id = $1', [denominacao]), erroComCodigo(SEM_PERMISSAO))
    await chamar(secretaria, 'select public.enviar_logotipo_denominacao($1, null)', [denominacao])
    assert.equal(await logotipoNaCredencial(), null)
  })
})
