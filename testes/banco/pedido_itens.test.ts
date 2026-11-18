// Telas novas, parte 4 (Fase 5.5, 18/11/2026): o pedido de associação conferido ITEM POR ITEM. Cada item (dados
// pessoais, igreja e título, foto 3×4, comprovante) fica em análise, aprovado ou recusado com o motivo; "Mandar para
// a AGO" só se libera com todos aprovados; ao reenviar, o que foi recusado (ou mudou) volta para a análise.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const ITENS = ['dados_pessoais', 'igreja_titulo', 'foto', 'comprovante']

describe('Parte 4 — o pedido de associação conferido item por item', () => {
  let db: PGlite
  let secretaria: string
  let candidato: string
  let outro: string
  let pessoaCandidato: string
  let igreja: string
  let titulo: string
  let pedido: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const conferir = (quem: string, item: string, aprovado: boolean, motivo: string | null = null) =>
    chamar(quem, 'select public.conferir_item_pedido($1, $2, $3, $4)', [pedido, item, aprovado, motivo])
  const situacoes = async () =>
    Object.fromEntries(
      (await db.query<{ item: string; situacao: string }>('select item, situacao from public.pedidos_associacao_itens where pedido_id = $1', [pedido])).rows.map(
        (r) => [r.item, r.situacao],
      ),
    )
  const mandarParaAgo = (quem: string) =>
    chamar(quem, "update public.pedidos_associacao set igreja_id = $2, situacao = 'aguardando_assembleia' where id = $1", [pedido, igreja])

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    candidato = await criarUsuario(db, 'candidato@teste.local', 'Candidato de Teste')
    outro = await criarUsuario(db, 'outro@teste.local', 'Outro Candidato')
    pessoaCandidato = (await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [candidato])).rows[0].id
    igreja = (await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")).rows[0].id
    titulo = (await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")).rows[0].id
    const r = await chamar(
      candidato,
      `insert into public.pedidos_associacao (pessoa_id, titulo_id, igreja_informada, foto_caminho, comprovante_caminho,
         declara_principios_fe, declara_estatuto, consente_lgpd)
       values ($1, $2, 'Igreja Nova do Bairro', $3, $4, true, true, true) returning id`,
      [pessoaCandidato, titulo, `pessoas/${pessoaCandidato}/foto-1.jpg`, `pessoas/${pessoaCandidato}/comprovante-1.pdf`],
    )
    pedido = (r.rows[0] as { id: string }).id
  })

  it('só a secretaria (ou a presidência) confere; o candidato não confere o próprio pedido', async () => {
    await assert.rejects(conferir(candidato, 'foto', true), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(
      chamar(candidato, "insert into public.pedidos_associacao_itens (pedido_id, item, situacao) values ($1, 'foto', 'aprovado')", [pedido]),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('item desconhecido é recusado; recusar exige o motivo', async () => {
    await assert.rejects(conferir(secretaria, 'rg', true), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(conferir(secretaria, 'foto', false), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(conferir(secretaria, 'foto', false, '   '), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('cada item tem a sua situação; mudar de ideia troca a situação (sem linha repetida)', async () => {
    await conferir(secretaria, 'dados_pessoais', true)
    await conferir(secretaria, 'igreja_titulo', true)
    await conferir(secretaria, 'foto', true)
    await conferir(secretaria, 'foto', false, 'A foto precisa ter o fundo claro.')
    await conferir(secretaria, 'comprovante', true)
    assert.deepEqual(await situacoes(), { dados_pessoais: 'aprovado', igreja_titulo: 'aprovado', foto: 'recusado', comprovante: 'aprovado' })
    const m = await db.query<{ motivo: string }>("select motivo from public.pedidos_associacao_itens where pedido_id = $1 and item = 'foto'", [pedido])
    assert.equal(m.rows[0].motivo, 'A foto precisa ter o fundo claro.')
  })

  it('"Mandar para a AGO" só com todos os itens aprovados', async () => {
    await assert.rejects(mandarParaAgo(secretaria), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('quem lê: o candidato vê a conferência do próprio pedido; outro candidato não; a secretaria vê', async () => {
    const ver = async (quem: string) => (await chamar(quem, 'select item from public.pedidos_associacao_itens')).rows.length
    assert.equal(await ver(candidato), 4)
    assert.equal(await ver(outro), 0)
    assert.equal(await ver(secretaria), 4)
  })

  it('devolvido e reenviado: o item recusado (e o que o candidato mudou) volta para a análise; o resto fica aprovado', async () => {
    await chamar(secretaria, "update public.pedidos_associacao set situacao = 'pendencia', mensagem_pendencia = 'Foto 3×4: fundo claro.' where id = $1", [pedido])
    await chamar(
      candidato,
      "update public.pedidos_associacao set foto_caminho = $2, titulo_desde = '2015-03-01', situacao = 'enviado' where id = $1",
      [pedido, `pessoas/${pessoaCandidato}/foto-2.jpg`],
    )
    assert.deepEqual(await situacoes(), { dados_pessoais: 'aprovado', igreja_titulo: 'analise', foto: 'analise', comprovante: 'aprovado' })
  })

  it('com todos aprovados, o pedido vai para a AGO; depois, a conferência não muda mais', async () => {
    await conferir(secretaria, 'foto', true)
    await conferir(secretaria, 'igreja_titulo', true)
    await mandarParaAgo(secretaria)
    const r = await db.query<{ situacao: string }>('select situacao from public.pedidos_associacao where id = $1', [pedido])
    assert.equal(r.rows[0].situacao, 'aguardando_assembleia')
    await assert.rejects(conferir(secretaria, 'foto', false, 'mudei de ideia'), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('ninguém confere o próprio pedido', async () => {
    const pessoaSec = (await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [secretaria])).rows[0].id
    const r = await chamar(
      secretaria,
      `insert into public.pedidos_associacao (pessoa_id, titulo_id, igreja_id, foto_caminho, comprovante_caminho,
         declara_principios_fe, declara_estatuto, consente_lgpd)
       values ($1, $2, $3, $4, $5, true, true, true) returning id`,
      [pessoaSec, titulo, igreja, `pessoas/${pessoaSec}/f.jpg`, `pessoas/${pessoaSec}/c.pdf`],
    )
    const proprio = (r.rows[0] as { id: string }).id
    await assert.rejects(
      chamar(secretaria, "select public.conferir_item_pedido($1, 'foto', true, null)", [proprio]),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('nada se apaga', async () => {
    await assert.rejects(db.query('delete from public.pedidos_associacao_itens'))
    assert.equal(ITENS.length, (await db.query("select unnest(interno.itens_do_pedido())")).rows.length)
  })
})
