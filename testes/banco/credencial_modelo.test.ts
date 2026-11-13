// Fase 3.4: editor do modelo da credencial — versões salvas, versão em uso, voltar ao padrão. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const FORA_DA_REGRA = '23514'

const MODELO = { versao: 1, frente: { fundo: '#ffffff', elementos: [{ id: 'nome', tipo: 'texto', texto: '{nome}' }] }, verso: { fundo: '#ffffff', elementos: [] } }

describe('Fase 3.4 — modelo da credencial', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let ministro: string
  let pessoaMinistro: string
  let primeira: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  const salvar = (quem: string, modelo: unknown, descricao: string, usar: boolean) =>
    chamar(quem, 'select public.salvar_modelo_credencial($1::jsonb, $2, $3) as id', [JSON.stringify(modelo), descricao, usar]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )

  async function modeloQueOMinistroVe(): Promise<unknown> {
    const r = await chamar(ministro, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoaMinistro]])
    return (r.rows[0] as { d: { modelo: unknown; credenciais: unknown[] } }).d.modelo
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])
    pessoaMinistro = p.rows[0].id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [
      pessoaMinistro,
    ])
  })

  it('sem modelo salvo, a credencial usa o padrão do sistema (modelo vazio)', async () => {
    assert.equal(await modeloQueOMinistroVe(), null)
  })

  it('o ministro não salva nem escolhe modelo', async () => {
    await assert.rejects(salvar(ministro, MODELO, 'Tentativa', true), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(chamar(ministro, 'select public.usar_modelo_credencial(null)'), erroComCodigo(SEM_PERMISSAO))
  })

  it('salvar pede a descrição e um modelo no formato certo', async () => {
    await assert.rejects(salvar(secretaria, MODELO, '  ', true), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(salvar(secretaria, { ...MODELO, versao: 2 }, 'Versão errada', true), erroComCodigo(FORA_DA_REGRA))
    await assert.rejects(salvar(secretaria, { versao: 1, frente: {} }, 'Sem verso', true), erroComCodigo(FORA_DA_REGRA))
    const muitos = { ...MODELO, frente: { fundo: '#ffffff', elementos: Array.from({ length: 61 }, (_, i) => ({ id: `x${i}`, tipo: 'qr' })) } }
    await assert.rejects(salvar(secretaria, muitos, 'Itens demais', true), erroComCodigo(FORA_DA_REGRA))
  })

  it('salvar sem usar guarda a versão; salvar e usar muda a credencial de todos', async () => {
    primeira = await salvar(secretaria, MODELO, 'Rascunho', false)
    assert.equal(await modeloQueOMinistroVe(), null)
    const segunda = await salvar(presidencia, { ...MODELO, frente: { ...MODELO.frente, fundo: '#fef2f2' } }, 'Fundo rosado', true)
    assert.deepEqual(await modeloQueOMinistroVe(), { ...MODELO, frente: { ...MODELO.frente, fundo: '#fef2f2' } })
    const r = await chamar(secretaria, 'select id, descricao, criado_por_nome, em_uso from public.vw_modelos_credencial order by criado_em, descricao')
    const versoes = r.rows as { id: string; descricao: string; criado_por_nome: string; em_uso: boolean }[]
    assert.equal(versoes.length, 2)
    assert.deepEqual(
      versoes.map((v) => [v.descricao, v.criado_por_nome, v.em_uso]).sort(),
      [
        ['Fundo rosado', 'Presidência de Teste', true],
        ['Rascunho', 'Secretaria de Teste', false],
      ],
    )
    assert.ok(versoes.some((v) => v.id === segunda))
  })

  it('volta a uma versão anterior, ou ao padrão do sistema', async () => {
    await chamar(secretaria, 'select public.usar_modelo_credencial($1)', [primeira])
    assert.deepEqual(await modeloQueOMinistroVe(), MODELO)
    await chamar(secretaria, 'select public.usar_modelo_credencial(null)')
    assert.equal(await modeloQueOMinistroVe(), null)
    await assert.rejects(
      chamar(secretaria, 'select public.usar_modelo_credencial($1)', ['00000000-0000-0000-0000-000000000000']),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
  })

  it('versão salva não muda nem se apaga; o ministro não lê as versões', async () => {
    await assert.rejects(db.query("update public.modelos_credencial set descricao = 'Outra'"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(db.query('delete from public.modelos_credencial'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(
      chamar(secretaria, "insert into public.modelos_credencial (modelo, descricao) values ('{}', 'direto')"),
      erroComCodigo(SEM_PERMISSAO),
    )
    const r = await chamar(ministro, 'select count(*)::int as n from public.vw_modelos_credencial')
    assert.equal((r.rows[0] as { n: number }).n, 0)
  })

  it('arquivar: tira da lista sem apagar; a versão em uso não pode; arquivada não volta a ser usada', async () => {
    const em_uso = await salvar(secretaria, MODELO, 'Em uso agora', true)
    await assert.rejects(chamar(secretaria, 'select public.arquivar_modelo_credencial($1)', [em_uso]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(ministro, 'select public.arquivar_modelo_credencial($1)', [primeira]), erroComCodigo(SEM_PERMISSAO))
    await chamar(secretaria, 'select public.arquivar_modelo_credencial($1)', [primeira])
    const r = await chamar(secretaria, 'select descricao from public.vw_modelos_credencial')
    assert.ok(!(r.rows as { descricao: string }[]).some((v) => v.descricao === 'Rascunho'))
    const guardada = await db.query('select count(*)::int as n from public.modelos_credencial where id = $1', [primeira])
    assert.equal((guardada.rows[0] as { n: number }).n, 1, 'continua guardada')
    await assert.rejects(chamar(secretaria, 'select public.usar_modelo_credencial($1)', [primeira]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(secretaria, 'select public.arquivar_modelo_credencial($1)', [primeira]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await chamar(secretaria, 'select public.usar_modelo_credencial(null)')
  })

  it('imagens do modelo: só a secretaria/presidência enviam, com nome aleatório', async () => {
    const nome = '0f0e0d0c-0b0a-4908-8706-050403020100.png'
    await chamar(secretaria, "insert into storage.objects (bucket_id, name) values ('credencial-modelo', $1)", [nome])
    await assert.rejects(
      chamar(ministro, "insert into storage.objects (bucket_id, name) values ('credencial-modelo', $1)", [nome.replace('0f', '1f')]),
      erroComCodigo(SEM_PERMISSAO),
    )
    await assert.rejects(
      chamar(secretaria, "insert into storage.objects (bucket_id, name) values ('credencial-modelo', 'pasta/../logo.png')"),
      erroComCodigo(SEM_PERMISSAO),
    )
  })
})
