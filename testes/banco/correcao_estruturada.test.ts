// Telas novas, parte 4 (Fase 5.5, 18/11/2026): a correção ESTRUTURADA no cadastro. Nada de texto livre: o ministro
// (ou o pastor presidente da igreja dele) escolhe o dado numa lista fechada; o banco guarda como está e como deve ficar;
// a secretaria aceita (a correção entra sozinha no cadastro) ou recusa com o motivo. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Parte 4 — correção estruturada no cadastro', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let pastorA: string
  let pastorB: string
  let ministroA: string
  let ministroB: string
  const pessoa: Record<string, string> = {}
  let semLogin: string
  let igrejaA: string
  let igrejaB: string
  let evangelista: string
  let presbitero: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const pedir = (quem: string, pessoaId: string, campo: string, valor: string | null, referencia: string | null = null) =>
    chamar(quem, 'select public.pedir_correcao_dado($1, $2, $3, $4) as id', [pessoaId, campo, valor, referencia]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )
  const responder = (quem: string, id: string, aceito: boolean, motivo: string | null = null) =>
    chamar(quem, 'select public.responder_correcao($1, $2, $3)', [id, aceito, motivo])

  async function associar(pessoaId: string, igreja: string, presidente: boolean) {
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoaId])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente, funcao) values ($1, $2, $3, $4)', [
      pessoaId,
      igreja,
      presidente,
      presidente ? null : 'Evangelista dirigente',
    ])
  }
  async function usuarioAssociado(email: string, nome: string, igreja: string, presidente: boolean) {
    const u = await criarUsuario(db, email, nome)
    pessoa[u] = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u])).id
    await associar(pessoa[u], igreja, presidente)
    return u
  }

  before(async () => {
    db = await criarBanco()
    igrejaA = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")).id
    igrejaB = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja B') returning id")).id
    evangelista = (await um<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Evangelista'")).id
    presbitero = (await um<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Presbítero'")).id
    secretaria = await usuarioAssociado('sec@teste.local', 'Secretária de Teste', igrejaB, false)
    await darPerfil(db, secretaria, 'secretaria')
    presidencia = await criarUsuario(db, 'pres@teste.local', 'Presidência de Teste')
    await darPerfil(db, presidencia, 'presidencia')
    pastorA = await usuarioAssociado('pa@teste.local', 'Pastor Presidente A', igrejaA, true)
    pastorB = await usuarioAssociado('pb@teste.local', 'Pastor Presidente B', igrejaB, true)
    ministroA = await usuarioAssociado('ma@teste.local', 'Ministro A', igrejaA, false)
    ministroB = await usuarioAssociado('mb@teste.local', 'Ministro B', igrejaB, false)
    await db.query("update public.pessoas set telefone = '(94) 91111-1111' where id = $1", [pessoa[ministroA]])
    await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [pessoa[ministroA], evangelista])
    // um ministro sem login (cadastrado pela secretaria, ainda não entrou no sistema)
    semLogin = (await um<{ id: string }>("insert into public.pessoas (nome, email) values ('Ministro Sem Login', 'antigo@teste.local') returning id")).id
    await associar(semLogin, igrejaA, false)
  })

  it('a lista é fechada: dado fora da lista é recusado, e o pedido em texto livre não existe mais pela API', async () => {
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'apelido', 'Marquinhos'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(ministroA, pessoa[ministroA], '', 'x'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(
      chamar(ministroA, "select public.pedir_correcao($1, 'Meu nome tem acento.')", [pessoa[ministroA]]),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('o banco guarda como está hoje (não o que a tela manda) e como deve ficar', async () => {
    const id = await pedir(ministroA, pessoa[ministroA], 'telefone', '  (94) 92222-2222 ')
    const p = await um<{ campo: string; valor_atual: string; valor_pedido: string; texto: string; situacao: string }>(
      'select campo, valor_atual, valor_pedido, texto, situacao from public.pedidos_correcao where id = $1',
      [id],
    )
    assert.deepEqual(p, {
      campo: 'telefone',
      valor_atual: '(94) 91111-1111',
      valor_pedido: '(94) 92222-2222',
      texto: 'Telefone: (94) 91111-1111 → (94) 92222-2222',
      situacao: 'pendente',
    })
  })

  it('o mesmo dado não fica pendente duas vezes; igual ao de hoje e valor sem sentido são recusados', async () => {
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'telefone', '(94) 93333-3333'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'funcao', 'Evangelista dirigente'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'cpf', '123'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'nome', '   '), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'titulo', null, igrejaA), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(ministroA, pessoa[ministroA], 'igreja', null, igrejaA), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('quem pede: o próprio ministro e o pastor presidente da igreja dele; CPF e filiação, só o próprio', async () => {
    await pedir(pastorA, pessoa[ministroA], 'titulo', null, presbitero)
    await assert.rejects(pedir(pastorB, pessoa[ministroA], 'nome', 'Ministro A da Silva'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(pedir(ministroB, pessoa[ministroA], 'nome', 'Ministro A da Silva'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(pedir(pastorA, pessoa[ministroA], 'cpf', '529.982.247-25'), erroComCodigo(SEM_PERMISSAO))
    await pedir(ministroA, pessoa[ministroA], 'cpf', '529.982.247-25')
  })

  it('quem lê: o pastor presidente vê os pedidos da igreja, menos o do CPF; o outro pastor não vê; a secretaria vê todos', async () => {
    const campos = async (quem: string) =>
      (await chamar(quem, 'select campo from public.pedidos_correcao where pessoa_id = $1 order by campo', [pessoa[ministroA]])).rows.map(
        (r) => (r as { campo: string }).campo,
      )
    assert.deepEqual(await campos(pastorA), ['telefone', 'titulo'])
    assert.deepEqual(await campos(pastorB), [])
    assert.deepEqual(await campos(secretaria), ['cpf', 'telefone', 'titulo'])
    assert.deepEqual(await campos(ministroA), ['cpf', 'telefone', 'titulo'])
  })

  it('aceitar aplica sozinho: o telefone, o título (o anterior fica no histórico) e o CPF', async () => {
    const pendentes = (await db.query<{ id: string; campo: string }>(
      "select id, campo from public.pedidos_correcao where pessoa_id = $1 and situacao = 'pendente'",
      [pessoa[ministroA]],
    )).rows
    const de = (campo: string) => pendentes.find((p) => p.campo === campo)!.id
    await assert.rejects(responder(pastorA, de('telefone'), true), erroComCodigo(SEM_PERMISSAO))
    await responder(secretaria, de('telefone'), true)
    await responder(secretaria, de('titulo'), true, 'Conferido com a credencial da denominação.')
    await responder(secretaria, de('cpf'), true)

    const p = await um<{ telefone: string; cpf: string }>('select telefone, cpf from public.pessoas where id = $1', [pessoa[ministroA]])
    assert.deepEqual(p, { telefone: '(94) 92222-2222', cpf: '52998224725' })
    const titulos = (await db.query<{ nome: string }>(
      `select tm.nome from public.titulos_pessoa tp join public.titulos_ministeriais tm on tm.id = tp.titulo_id
       where tp.pessoa_id = $1 and tp.arquivado_em is null order by tp.criado_em`,
      [pessoa[ministroA]],
    )).rows.map((r) => r.nome)
    assert.deepEqual(titulos, ['Evangelista', 'Presbítero'])
    const situacoes = (await db.query<{ situacao: string }>(
      'select distinct situacao from public.pedidos_correcao where pessoa_id = $1',
      [pessoa[ministroA]],
    )).rows.map((r) => r.situacao)
    assert.deepEqual(situacoes, ['atendido'])
  })

  it('recusar exige o motivo e não muda o cadastro', async () => {
    const id = await pedir(ministroA, pessoa[ministroA], 'nome', 'Ministro A de Souza')
    await assert.rejects(responder(secretaria, id, false), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await responder(secretaria, id, false, 'O nome segue o RG enviado.')
    const p = await um<{ nome: string }>('select nome from public.pessoas where id = $1', [pessoa[ministroA]])
    assert.equal(p.nome, 'Ministro A')
    await assert.rejects(responder(secretaria, id, true), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('a igreja errada: aceitar encerra o vínculo e abre o da igreja certa, com a mesma função', async () => {
    const id = await pedir(pastorA, pessoa[ministroA], 'igreja', null, igrejaB)
    await responder(secretaria, id, true)
    const v = (await db.query<{ igreja_id: string; funcao: string | null; atual: boolean }>(
      'select igreja_id, funcao, fim is null as atual from public.vinculos_igreja where pessoa_id = $1 order by criado_em',
      [pessoa[ministroA]],
    )).rows
    assert.deepEqual(v, [
      { igreja_id: igrejaA, funcao: 'Evangelista dirigente', atual: false },
      { igreja_id: igrejaB, funcao: 'Evangelista dirigente', atual: true },
    ])
  })

  it('o e-mail: só de quem ainda não tem login (o de quem tem é o do login)', async () => {
    await assert.rejects(pedir(ministroB, pessoa[ministroB], 'email', 'novo@teste.local'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorA, semLogin, 'email', 'sem-arroba'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    const id = await pedir(pastorA, semLogin, 'email', 'Certo@Teste.Local')
    await responder(secretaria, id, true)
    const p = await um<{ email: string }>('select email from public.pessoas where id = $1', [semLogin])
    assert.equal(p.email, 'certo@teste.local')
  })

  it('ninguém aceita a correção do próprio cadastro', async () => {
    const id = await pedir(secretaria, pessoa[secretaria], 'nome', 'Secretária de Teste da Silva')
    await assert.rejects(responder(secretaria, id, true), erroComCodigo(SEM_PERMISSAO))
    await responder(presidencia, id, true)
    const p = await um<{ nome: string }>('select nome from public.pessoas where id = $1', [pessoa[secretaria]])
    assert.equal(p.nome, 'Secretária de Teste da Silva')
  })

  it('nada se apaga: os pedidos não se excluem', async () => {
    await assert.rejects(chamar(secretaria, 'delete from public.pedidos_correcao'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(db.query('delete from public.pedidos_correcao'))
  })
})
