// Testes da Fase 2.2: caixa (contas, lançamentos, despesas autorizadas pelo presidente,
// contribuição paga entrando no caixa, transferências). Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 2.2 — caixa', () => {
  let db: PGlite
  let presidente: string
  let vice: string // segunda pessoa da presidência
  let tesoureiro: string
  let ministro: string
  let caixa: string
  let banco: string
  const categoria: Record<string, string> = {}

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function saldo(contaId: string) {
    const r = await db.query<{ saldo: string; aguardando: string }>(
      'select saldo::text, aguardando_autorizacao::text as aguardando from public.vw_saldos_contas where id = $1',
      [contaId],
    )
    return r.rows[0]
  }

  async function lancar(quem: string, conta: string, tipo: string, cat: string, valor: number, data = 'current_date') {
    const r = await como(db, quem, () =>
      db.query<{ id: string }>(`select public.lancar($1, $2, $3, ${data}, $4, 'Lançamento de teste', null) as id`, [
        conta,
        tipo,
        cat,
        valor,
      ]),
    )
    return r.rows[0].id
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    vice = await criarUsuario(db, 'vice@teste.local', 'Vice de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, vice, 'presidencia')
    await darPerfil(db, tesoureiro, 'tesouraria')
    const contas = await db.query<{ id: string; tipo: string }>('select id, tipo from public.contas_financeiras')
    caixa = contas.rows.find((c) => c.tipo === 'caixa')!.id
    banco = contas.rows.find((c) => c.tipo === 'banco')!.id
    const cats = await db.query<{ id: string; nome: string }>('select id, nome from public.categorias_financeiras')
    for (const c of cats.rows) categoria[c.nome] = c.id
  })

  it('começa com caixa e conta bancária, e as contribuições pagas já apontam para elas', async () => {
    const r = await db.query<{ ok: boolean }>(
      'select conta_dinheiro_id = $1 and conta_banco_id = $2 as ok from public.config_financeiro',
      [caixa, banco],
    )
    assert.equal(r.rows[0].ok, true)
    assert.deepEqual(await saldo(caixa), { saldo: '0.00', aguardando: '0.00' })
  })

  describe('entradas e despesas', () => {
    let despesa: string

    it('entrada (oferta) entra no saldo na hora', async () => {
      await lancar(tesoureiro, caixa, 'entrada', categoria['Ofertas'], 150)
      assert.equal((await saldo(caixa)).saldo, '150.00')
    })

    it('despesa fica aguardando a autorização do presidente e não sai do saldo', async () => {
      despesa = await lancar(tesoureiro, caixa, 'saida', categoria['Eventos e encontros'], 80)
      assert.deepEqual(await saldo(caixa), { saldo: '150.00', aguardando: '80.00' })
    })

    it('a tesouraria não autoriza; a presidência autoriza e a despesa sai do saldo', async () => {
      await assert.rejects(
        como(db, tesoureiro, () => db.query('select public.autorizar_despesa($1, true, null)', [despesa])),
        erroComCodigo(SEM_PERMISSAO),
      )
      await como(db, presidente, () => db.query('select public.autorizar_despesa($1, true, null)', [despesa]))
      assert.deepEqual(await saldo(caixa), { saldo: '70.00', aguardando: '0.00' })
    })

    it('ninguém autoriza a própria despesa; outra pessoa da presidência autoriza', async () => {
      const minha = await lancar(presidente, caixa, 'saida', categoria['Material e expediente'], 20)
      await assert.rejects(
        como(db, presidente, () => db.query('select public.autorizar_despesa($1, true, null)', [minha])),
        erroComCodigo(SEM_PERMISSAO),
      )
      await como(db, vice, () => db.query('select public.autorizar_despesa($1, true, null)', [minha]))
      assert.equal((await saldo(caixa)).saldo, '50.00')
    })

    it('recusa exige motivo e a despesa recusada não conta', async () => {
      const recusada = await lancar(tesoureiro, caixa, 'saida', categoria['Outras despesas'], 999)
      await assert.rejects(
        como(db, presidente, () => db.query("select public.autorizar_despesa($1, false, '')", [recusada])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, presidente, () =>
        db.query("select public.autorizar_despesa($1, false, 'Sem nota fiscal')", [recusada]),
      )
      assert.deepEqual(await saldo(caixa), { saldo: '50.00', aguardando: '0.00' })
    })

    it('recusa categoria de outro tipo, categoria do sistema, data futura e valor zero', async () => {
      await assert.rejects(
        lancar(tesoureiro, caixa, 'entrada', categoria['Ação social'], 10),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        lancar(tesoureiro, caixa, 'entrada', categoria['Contribuições dos associados'], 10),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        lancar(tesoureiro, caixa, 'entrada', categoria['Ofertas'], 10, 'current_date + 1'),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(lancar(tesoureiro, caixa, 'entrada', categoria['Ofertas'], 0), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('cancelar exige motivo e tira o lançamento do saldo', async () => {
      const errado = await lancar(tesoureiro, caixa, 'entrada', categoria['Doações'], 30)
      assert.equal((await saldo(caixa)).saldo, '80.00')
      await assert.rejects(
        como(db, tesoureiro, () => db.query("select public.cancelar_lancamento($1, '')", [errado])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, tesoureiro, () => db.query("select public.cancelar_lancamento($1, 'Lançado em dobro')", [errado]))
      assert.equal((await saldo(caixa)).saldo, '50.00')
    })
  })

  describe('contribuição paga entra no caixa sozinha', () => {
    let pessoa: string

    before(async () => {
      await db.query("update public.valores_contribuicao set vigente_desde = '2020-01-01'")
      const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
      const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
      pessoa = await pessoaDe(ministro)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2020-01-01')", [pessoa])
      await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [pessoa, t.rows[0].id])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoa, i.rows[0].id])
      await como(db, tesoureiro, () => db.query('select public.gerar_cobrancas(interno.exercicio_de(current_date) - 1)'))
    })

    it('em dinheiro vai para o caixa; por PIX, para o banco', async () => {
      const c = await db.query<{ id: string }>(
        "select id from public.cobrancas where pessoa_id = $1 and situacao = 'aberta' order by competencia limit 2",
        [pessoa],
      )
      await como(db, tesoureiro, () =>
        db.query("select public.registrar_pagamento($1, current_date, 20, 'Dinheiro', null)", [c.rows[0].id]),
      )
      await como(db, tesoureiro, () =>
        db.query("select public.registrar_pagamento($1, current_date, 20, 'PIX', null)", [c.rows[1].id]),
      )
      assert.equal((await saldo(caixa)).saldo, '70.00')
      assert.equal((await saldo(banco)).saldo, '20.00')
      const l = await db.query<{ descricao: string }>(
        'select descricao from public.lancamentos where cobranca_id = $1',
        [c.rows[0].id],
      )
      assert.match(l.rows[0].descricao, /^Contribuição de Ministro de Teste — mensalidade \d{2}\/\d{4}$/)
    })

    // Parte 12 (a blindagem do caixa, 20/11/2026): antes, a entrada automática não se cancelava pelo caixa; agora
    // cancelar o lançamento devolve a contribuição para "em aberto" (e pagar de novo lança de novo)
    it('cancelar a entrada automática devolve a contribuição para "em aberto"', async () => {
      const l = await db.query<{ id: string; cobranca_id: string }>(
        'select l.id, l.cobranca_id from public.lancamentos l where l.cobranca_id is not null and l.conta_id = $1 limit 1',
        [banco],
      )
      await assert.rejects(
        como(db, tesoureiro, () => db.query("select public.cancelar_lancamento($1, '')", [l.rows[0].id])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, tesoureiro, () => db.query("select public.cancelar_lancamento($1, 'Lançado na pessoa errada')", [l.rows[0].id]))
      const c = await db.query<{ situacao: string }>('select situacao from public.cobrancas where id = $1', [l.rows[0].cobranca_id])
      assert.equal(c.rows[0].situacao, 'aberta')
      assert.equal((await saldo(banco)).saldo, '0.00')
      await como(db, tesoureiro, () => db.query("select public.registrar_pagamento($1, current_date, 20, 'PIX', null)", [l.rows[0].cobranca_id]))
      assert.equal((await saldo(banco)).saldo, '20.00')
    })
  })

  describe('transferências, categorias e acesso', () => {
    it('transferir do caixa para o banco; cancelar desfaz os dois lados', async () => {
      await como(db, tesoureiro, () =>
        db.query("select public.transferir($1, $2, current_date, 50, 'Depósito das ofertas')", [caixa, banco]),
      )
      assert.equal((await saldo(caixa)).saldo, '20.00')
      assert.equal((await saldo(banco)).saldo, '70.00')
      const t = await db.query<{ id: string }>("select id from public.lancamentos where descricao = 'Depósito das ofertas' limit 1")
      await como(db, tesoureiro, () => db.query("select public.cancelar_lancamento($1, 'Não foi depositado')", [t.rows[0].id]))
      assert.equal((await saldo(caixa)).saldo, '70.00')
      assert.equal((await saldo(banco)).saldo, '20.00')
    })

    it('categoria do sistema não muda de nome nem é arquivada; as outras sim', async () => {
      await assert.rejects(
        como(db, tesoureiro, () =>
          db.query("update public.categorias_financeiras set nome = 'X' where sistema = 'contribuicoes'"),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const r = await como(db, tesoureiro, () =>
        db.query("update public.categorias_financeiras set nome = 'Ofertas das reuniões' where nome = 'Ofertas'"),
      )
      assert.equal(r.affectedRows, 1)
    })

    it('o ministro não vê nem lança nada no caixa', async () => {
      for (const tabela of ['lancamentos', 'contas_financeiras', 'vw_saldos_contas']) {
        const r = await como(db, ministro, () => db.query(`select * from public.${tabela}`))
        assert.equal(r.rows.length, 0, tabela)
      }
      await assert.rejects(lancar(ministro, caixa, 'entrada', categoria['Doações'], 10), erroComCodigo(SEM_PERMISSAO))
    })

    it('ninguém grava direto nem apaga', async () => {
      await assert.rejects(
        como(db, tesoureiro, () => db.query("update public.lancamentos set situacao = 'efetivado'")),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(db.query('delete from public.lancamentos'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })
})
