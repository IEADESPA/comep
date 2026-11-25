// D-10 (homologação, 22/11/2026; desenho minha-igreja-2): quem preside a igreja pede a correção do NOME e do CNPJ da
// igreja por um fluxo de verdade. O pedido é de uma pessoa OU de uma igreja; a secretaria aceita (a correção entra
// sozinha no cadastro da igreja) ou recusa com o motivo; a resposta vai para o sino de quem pediu. Nada se apaga.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const VIOLA_A_REGRA = '23514'

/** O CNPJ com os dois dígitos certos, a partir das 12 primeiras posições (números ou letras: cada uma vale ASCII − 48). */
function cnpjCom(base: string): string {
  const valores = [...base].map((c) => c.charCodeAt(0) - 48)
  const digito = (v: number[]) => {
    const pesos = v.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = v.reduce((t, n, i) => t + n * pesos[i], 0)
    return soma % 11 < 2 ? 0 : 11 - (soma % 11)
  }
  const d1 = digito(valores)
  const d2 = digito([...valores, d1])
  return `${base}${d1}${d2}`
}

const CNPJ_A = cnpjCom('112223330001')
const CNPJ_B = cnpjCom('114447770001')
const CNPJ_NOVO = cnpjCom('223334440001')
const CNPJ_ALFANUMERICO = cnpjCom('12ABC3450001')
const pontuado = (c: string) => `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`

describe('D-10 — a correção do nome e do CNPJ da igreja', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let pastorA: string
  let pastorB: string
  let ministroA: string
  const pessoa: Record<string, string> = {}
  let igrejaA: string
  let igrejaB: string
  let igrejaC: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const pedir = (quem: string | null, igreja: string, campo: string, valor: string | null) =>
    chamar(quem, 'select public.pedir_correcao_da_igreja($1, $2, $3) as id', [igreja, campo, valor]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )
  const responder = (quem: string, id: string, aceito: boolean, motivo: string | null = null) =>
    chamar(quem, 'select public.responder_correcao($1, $2, $3)', [id, aceito, motivo])
  const mensagemDoErro = (p: Promise<unknown>) =>
    p.then(
      () => assert.fail('devia recusar'),
      (e: { code?: string; message?: string }) => `${e.code}: ${e.message}`,
    )

  async function usuarioAssociado(email: string, nome: string, igreja: string, presidente: boolean) {
    const u = await criarUsuario(db, email, nome)
    pessoa[u] = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u])).id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoa[u]])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [pessoa[u], igreja, presidente])
    return u
  }

  before(async () => {
    db = await criarBanco()
    igrejaA = (await um<{ id: string }>('insert into public.igrejas (nome, cnpj) values ($1, $2) returning id', ['Igreja Fictícia Vida Nova', CNPJ_A])).id
    igrejaB = (await um<{ id: string }>('insert into public.igrejas (nome, cnpj) values ($1, $2) returning id', ['Igreja Fictícia Monte Sião', CNPJ_B])).id
    igrejaC = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja Fictícia da Secretária') returning id")).id
    pastorA = await usuarioAssociado('pa@teste.local', 'Pastor Presidente A', igrejaA, true)
    pastorB = await usuarioAssociado('pb@teste.local', 'Pastor Presidente B', igrejaB, true)
    ministroA = await usuarioAssociado('ma@teste.local', 'Ministro A', igrejaA, false)
    // a secretária também preside uma igreja (pode pedir pela igreja dela, mas não aceita o próprio pedido)
    secretaria = await usuarioAssociado('sec@teste.local', 'Secretária de Teste', igrejaC, true)
    await darPerfil(db, secretaria, 'secretaria')
    presidencia = await criarUsuario(db, 'pres@teste.local', 'Presidência de Teste')
    await darPerfil(db, presidencia, 'presidencia')
  })

  it('quem preside pede: o banco guarda como está hoje e como deve ficar (o CNPJ sem a pontuação)', async () => {
    const nome = await pedir(pastorA, igrejaA, 'igreja_nome', '  Igreja Fictícia Vida Nova em Cristo ')
    const cnpj = await pedir(pastorA, igrejaA, 'igreja_cnpj', pontuado(CNPJ_NOVO))
    const linhas = (await db.query(
      'select pessoa_id, igreja_id, pedido_por, campo, valor_atual, valor_pedido, texto, situacao from public.pedidos_correcao where id in ($1, $2) order by campo',
      [cnpj, nome],
    )).rows
    assert.deepEqual(linhas, [
      {
        pessoa_id: null,
        igreja_id: igrejaA,
        pedido_por: pessoa[pastorA],
        campo: 'igreja_cnpj',
        valor_atual: CNPJ_A,
        valor_pedido: CNPJ_NOVO,
        texto: `CNPJ da igreja: ${CNPJ_A} → ${CNPJ_NOVO}`,
        situacao: 'pendente',
      },
      {
        pessoa_id: null,
        igreja_id: igrejaA,
        pedido_por: pessoa[pastorA],
        campo: 'igreja_nome',
        valor_atual: 'Igreja Fictícia Vida Nova',
        valor_pedido: 'Igreja Fictícia Vida Nova em Cristo',
        texto: 'Nome da igreja: Igreja Fictícia Vida Nova → Igreja Fictícia Vida Nova em Cristo',
        situacao: 'pendente',
      },
    ])
  })

  it('só quem preside a própria igreja: o outro pastor, o ministro e a igreja que não existe recebem o mesmo "sem permissão"', async () => {
    const naoExiste = '00000000-0000-4000-8000-000000000000'
    const deOutro = await mensagemDoErro(pedir(pastorB, igrejaA, 'igreja_nome', 'Outro nome qualquer'))
    const inexistente = await mensagemDoErro(pedir(pastorB, naoExiste, 'igreja_nome', 'Outro nome qualquer'))
    assert.ok(deOutro.startsWith(`${SEM_PERMISSAO}:`), deOutro)
    assert.equal(inexistente, deOutro)
    await assert.rejects(pedir(ministroA, igrejaA, 'igreja_nome', 'Outro nome qualquer'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(pedir(presidencia, igrejaA, 'igreja_nome', 'Outro nome qualquer'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(pedir(null, igrejaA, 'igreja_nome', 'Outro nome qualquer'), erroComCodigo(SEM_PERMISSAO))
  })

  it('a lista é fechada e o valor é conferido: o lixo, o CNPJ com o dígito errado ou de outra igreja e o repetido são recusados', async () => {
    // fora da lista (a denominação fica com a secretaria; os dados da pessoa vão por pedir_correcao_dado)
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_denominacao', 'Assembleia'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'nome', 'Pastor B'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    // o nome: vazio, curto demais e comprido demais
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_nome', '   '), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_nome', 'Ig'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_nome', 'x'.repeat(500)), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_nome', null), erroComCodigo(BLOQUEADO_PELO_BANCO))
    // o CNPJ: o dígito errado, o tamanho errado, o igual ao de hoje e o de outra igreja
    const errado = `${CNPJ_NOVO.slice(0, 13)}${(Number(CNPJ_NOVO[13]) + 1) % 10}`
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_cnpj', errado), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_cnpj', '123'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_cnpj', `${pontuado(CNPJ_B)}; drop table public.igrejas`), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_cnpj', pontuado(CNPJ_B)), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(pedir(pastorB, igrejaB, 'igreja_cnpj', pontuado(CNPJ_A)), erroComCodigo(BLOQUEADO_PELO_BANCO))
    // o mesmo dado não fica pendente duas vezes
    await assert.rejects(pedir(pastorA, igrejaA, 'igreja_nome', 'Igreja Fictícia Vida Plena'), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('o CNPJ alfanumérico (Receita, 2026) é aceito; o texto com aspas fica só como texto', async () => {
    const id = await pedir(pastorB, igrejaB, 'igreja_cnpj', pontuado(CNPJ_ALFANUMERICO).toLowerCase())
    assert.equal((await um<{ valor_pedido: string }>('select valor_pedido from public.pedidos_correcao where id = $1', [id])).valor_pedido, CNPJ_ALFANUMERICO)
    const texto = await pedir(pastorB, igrejaB, 'igreja_nome', "Igreja Fictícia'); drop table public.igrejas; --")
    assert.equal(
      (await um<{ valor_pedido: string }>('select valor_pedido from public.pedidos_correcao where id = $1', [texto])).valor_pedido,
      "Igreja Fictícia'); drop table public.igrejas; --",
    )
    assert.equal((await um<{ n: number }>('select count(*)::int as n from public.igrejas')).n, 3)
  })

  it('quem lê: quem preside vê os pedidos da igreja dele; o outro pastor e o ministro não; a secretaria vê todos', async () => {
    const campos = async (quem: string) =>
      (await chamar(quem, 'select campo from public.pedidos_correcao where igreja_id = $1 and pessoa_id is null order by campo', [igrejaA])).rows.map(
        (r) => (r as { campo: string }).campo,
      )
    assert.deepEqual(await campos(pastorA), ['igreja_cnpj', 'igreja_nome'])
    assert.deepEqual(await campos(pastorB), [])
    assert.deepEqual(await campos(ministroA), [])
    assert.deepEqual(await campos(secretaria), ['igreja_cnpj', 'igreja_nome'])
  })

  it('o pedido é de uma pessoa OU de uma igreja (a regra está na tabela)', async () => {
    await assert.rejects(
      db.query("insert into public.pedidos_correcao (pessoa_id, igreja_id, pedido_por, texto, campo, valor_pedido) values (null, $1, $2, 'Nome: x → y', 'nome', 'y')", [
        igrejaA,
        pessoa[pastorA],
      ]),
      erroComCodigo(VIOLA_A_REGRA),
    )
    await assert.rejects(
      db.query(
        "insert into public.pedidos_correcao (pessoa_id, igreja_id, pedido_por, texto, campo, valor_pedido) values ($1, $2, $1, 'Nome da igreja: x → y', 'igreja_nome', 'y')",
        [pessoa[pastorA], igrejaA],
      ),
      erroComCodigo(VIOLA_A_REGRA),
    )
    await assert.rejects(
      db.query("insert into public.pedidos_correcao (pessoa_id, igreja_id, pedido_por, texto, campo, valor_pedido) values (null, null, $1, 'Nome da igreja: x → y', 'igreja_nome', 'y')", [
        pessoa[pastorA],
      ]),
      erroComCodigo(VIOLA_A_REGRA),
    )
  })

  it('aceitar aplica sozinho no cadastro da igreja, e quem pediu recebe o aviso no sino', async () => {
    const pendentes = (await db.query<{ id: string; campo: string }>(
      "select id, campo from public.pedidos_correcao where igreja_id = $1 and pessoa_id is null and situacao = 'pendente'",
      [igrejaA],
    )).rows
    const de = (campo: string) => pendentes.find((p) => p.campo === campo)!.id
    await assert.rejects(responder(pastorA, de('igreja_nome'), true), erroComCodigo(SEM_PERMISSAO))
    await responder(secretaria, de('igreja_nome'), true)
    await responder(presidencia, de('igreja_cnpj'), true, 'Conferido com o cartão CNPJ.')
    assert.deepEqual(await um('select nome, cnpj from public.igrejas where id = $1', [igrejaA]), {
      nome: 'Igreja Fictícia Vida Nova em Cristo',
      cnpj: CNPJ_NOVO,
    })
    const avisos = (await db.query<{ tipo: string; titulo: string; link: string }>(
      "select tipo, titulo, link from public.notificacoes where pessoa_id = $1 and chave like 'correcao:%' order by titulo",
      [pessoa[pastorA]],
    )).rows
    assert.equal(avisos.length, 2)
    assert.ok(avisos.every((a) => a.tipo === 'recado' && a.titulo === 'Pedido de correção atendido' && a.link === '/minha-igreja'), JSON.stringify(avisos))
  })

  it('recusar exige o motivo, não muda o cadastro e avisa quem pediu com o motivo', async () => {
    const id = await pedir(pastorA, igrejaA, 'igreja_nome', 'Igreja Fictícia Vida Plena')
    await assert.rejects(responder(secretaria, id, false), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await responder(secretaria, id, false, 'O nome segue o estatuto registrado.')
    assert.equal((await um<{ nome: string }>('select nome from public.igrejas where id = $1', [igrejaA])).nome, 'Igreja Fictícia Vida Nova em Cristo')
    const aviso = await um<{ titulo: string; texto: string }>("select titulo, texto from public.notificacoes where chave = $1", [`correcao:${id}`])
    assert.equal(aviso.titulo, 'Pedido de correção recusado')
    assert.match(aviso.texto, /O nome segue o estatuto registrado\./)
  })

  it('o CNPJ que outra igreja passou a usar depois do pedido: aceitar é recusado com a explicação', async () => {
    // o pedido do CNPJ alfanumérico (pendente desde o teste anterior) e, no meio, a igreja C passa a usar esse CNPJ
    const pedido = (await um<{ id: string }>("select id from public.pedidos_correcao where igreja_id = $1 and campo = 'igreja_cnpj' and situacao = 'pendente'", [igrejaB])).id
    await db.query('update public.igrejas set cnpj = $1 where id = $2', [CNPJ_ALFANUMERICO, igrejaC])
    await assert.rejects(responder(presidencia, pedido, true), erroComCodigo(BLOQUEADO_PELO_BANCO))
    assert.equal((await um<{ cnpj: string }>('select cnpj from public.igrejas where id = $1', [igrejaB])).cnpj, CNPJ_B)
  })

  it('ninguém aceita o próprio pedido: a secretária que preside uma igreja pede, e outra pessoa aceita', async () => {
    const id = await pedir(secretaria, igrejaC, 'igreja_nome', 'Igreja Fictícia da Secretária e do Bairro')
    await assert.rejects(responder(secretaria, id, true), erroComCodigo(SEM_PERMISSAO))
    await responder(presidencia, id, true)
    assert.equal((await um<{ nome: string }>('select nome from public.igrejas where id = $1', [igrejaC])).nome, 'Igreja Fictícia da Secretária e do Bairro')
  })

  it('o pedido da pessoa também avisa quem pediu, sem o dado no aviso (ele pode aparecer na tela do celular)', async () => {
    const pedirDado = (quem: string, de: string, campo: string, valor: string) =>
      chamar(quem, 'select public.pedir_correcao_dado($1, $2, $3, null) as id', [pessoa[de], campo, valor]).then(
        (r) => (r.rows[0] as { id: string }).id,
      )
    // o próprio ministro pede o telefone; quem preside a igreja dele pede o nome
    const telefone = await pedirDado(ministroA, ministroA, 'telefone', '(94) 98888-7777')
    const nome = await pedirDado(pastorA, ministroA, 'nome', 'Ministro A da Silva Fictício')
    await responder(secretaria, telefone, true)
    await responder(presidencia, nome, false, 'O nome segue a identidade.')
    const aviso = (id: string) =>
      um<{ pessoa_id: string; tipo: string; titulo: string; texto: string; link: string }>(
        'select pessoa_id, tipo, titulo, texto, link from public.notificacoes where chave = $1',
        [`correcao:${id}`],
      )
    assert.deepEqual(await aviso(telefone), {
      pessoa_id: pessoa[ministroA],
      tipo: 'recado',
      titulo: 'Pedido de correção atendido',
      texto: 'Telefone: a correção já está no seu cadastro.',
      link: '/meu-perfil/correcoes',
    })
    assert.deepEqual(await aviso(nome), {
      pessoa_id: pessoa[pastorA],
      tipo: 'recado',
      titulo: 'Pedido de correção recusado',
      texto: 'Nome completo de Ministro A: o pedido foi recusado. Motivo: O nome segue a identidade.',
      link: '/minha-igreja/ministros',
    })
  })

  it('nada se apaga: os pedidos da igreja não se excluem', async () => {
    await assert.rejects(chamar(secretaria, 'delete from public.pedidos_correcao where pessoa_id is null'), erroComCodigo(SEM_PERMISSAO))
  })
})
