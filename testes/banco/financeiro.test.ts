// Testes da Fase 2.1: contribuições (cobranças, plano, pagamento informado, conferência, em dia/em atraso).
// Usa o exercício ANTERIOR ao atual (todo vencido), para não depender do dia em que o teste roda.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 2.1 — contribuições', () => {
  let db: PGlite
  let exercicio: number
  let tesoureiro: string
  let secretaria: string
  let ministroA: string // não presidente
  let presidenteB: string // pastor presidente (R$ 40)
  let jubiladoC: string
  let novoD: string // admitido no meio do exercício
  let igreja: string
  let titulo: string

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function associar(usuarioId: string, opcoes: { presidente?: boolean; jubilado?: boolean; admitido?: string }) {
    const pessoa = await pessoaDe(usuarioId)
    await db.query(
      "insert into public.associados (pessoa_id, forma_admissao, admitido_em, jubilado) values ($1, 'cadastro_inicial', $2, $3)",
      [pessoa, opcoes.admitido ?? '2020-01-01', opcoes.jubilado ?? false],
    )
    await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [pessoa, titulo])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [
      pessoa,
      igreja,
      opcoes.presidente ?? false,
    ])
  }

  async function cobrancas(usuarioId: string, situacao = 'aberta') {
    const r = await db.query<{ id: string; tipo: string; valor: string; vencimento: string; competencia: string }>(
      `select id, tipo, valor::text, vencimento::text, competencia::text from public.cobrancas
       where pessoa_id = $1 and exercicio = $2 and situacao = $3 order by competencia`,
      [await pessoaDe(usuarioId), exercicio, situacao],
    )
    return r.rows
  }

  async function emDia(usuarioId: string): Promise<boolean> {
    const r = await db.query<{ em_dia: boolean }>('select em_dia from public.vw_situacao_contribuicao where pessoa_id = $1', [
      await pessoaDe(usuarioId),
    ])
    return r.rows[0].em_dia
  }

  before(async () => {
    db = await criarBanco()
    const e = await db.query<{ e: number }>('select interno.exercicio_de(current_date) - 1 as e')
    exercicio = e.rows[0].e
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    ministroA = await criarUsuario(db, 'a@teste.local', 'Ministro A')
    presidenteB = await criarUsuario(db, 'b@teste.local', 'Presidente B')
    jubiladoC = await criarUsuario(db, 'c@teste.local', 'Jubilado C')
    novoD = await criarUsuario(db, 'd@teste.local', 'Novo D')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, secretaria, 'secretaria')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
    igreja = i.rows[0].id
    const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
    titulo = t.rows[0].id
    // Valores vigentes desde antes do exercício testado
    await db.query("update public.valores_contribuicao set vigente_desde = '2020-01-01'")
    await associar(ministroA, {})
    await associar(presidenteB, { presidente: true })
    await associar(jubiladoC, { jubilado: true })
    await associar(novoD, { admitido: `${exercicio}-08-15` })
  })

  describe('gerar as cobranças do exercício', () => {
    it('só a tesouraria ou a presidência geram', async () => {
      for (const usuario of [secretaria, ministroA]) {
        await assert.rejects(
          como(db, usuario, () => db.query('select public.gerar_cobrancas($1)', [exercicio])),
          erroComCodigo(SEM_PERMISSAO),
        )
      }
    })

    it('mensal por categoria: R$ 20 (não presidente), R$ 40 (presidente), jubilado isento, novo a partir da admissão', async () => {
      const r = await como(db, tesoureiro, () =>
        db.query<{ n: number }>('select public.gerar_cobrancas($1) as n', [exercicio]),
      )
      assert.equal(r.rows[0].n, 12 + 12 + 8)
      const a = await cobrancas(ministroA)
      assert.equal(a.length, 12)
      assert.ok(a.every((c) => c.tipo === 'mensal' && c.valor === '20.00'))
      assert.equal(a[0].competencia, `${exercicio}-04-01`)
      assert.equal(a[0].vencimento, `${exercicio}-04-10`, 'mensalidade vence no dia 10')
      assert.equal(a[11].competencia, `${exercicio + 1}-03-01`, 'o exercício termina em março')
      assert.ok((await cobrancas(presidenteB)).every((c) => c.valor === '40.00'))
      assert.equal((await cobrancas(jubiladoC)).length, 0)
      const d = await cobrancas(novoD)
      assert.equal(d.length, 8)
      assert.equal(d[0].competencia, `${exercicio}-08-01`)
    })

    it('gerar de novo não repete nada', async () => {
      const r = await como(db, tesoureiro, () =>
        db.query<{ n: number }>('select public.gerar_cobrancas($1) as n', [exercicio]),
      )
      assert.equal(r.rows[0].n, 0)
    })
  })

  describe('plano mensal ou anual', () => {
    it('o próprio associado escolhe anual: as mensalidades em aberto saem e entra a anuidade (R$ 200, vence em 30/04)', async () => {
      await como(db, ministroA, async () =>
        db.query("select public.escolher_plano($1, $2, 'anual')", [await pessoaDe(ministroA), exercicio]),
      )
      const abertas = await cobrancas(ministroA)
      assert.deepEqual(
        abertas.map((c) => [c.tipo, c.valor, c.vencimento]),
        [['anual', '200.00', `${exercicio}-04-30`]],
      )
      assert.equal((await cobrancas(ministroA, 'cancelada')).length, 12)
    })

    it('quem entrou depois de abril não escolhe anual', async () => {
      await assert.rejects(
        como(db, novoD, async () => db.query("select public.escolher_plano($1, $2, 'anual')", [await pessoaDe(novoD), exercicio])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('ninguém escolhe o plano de outro (só a tesouraria)', async () => {
      const pessoaB = await pessoaDe(presidenteB)
      await assert.rejects(
        como(db, ministroA, () => db.query("select public.escolher_plano($1, $2, 'anual')", [pessoaB, exercicio])),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('pagamento informado e conferência da tesouraria', () => {
    let informe: string

    it('o associado informa o pagamento com comprovante da própria pasta', async () => {
      const pessoaA = await pessoaDe(ministroA)
      const [anuidade] = await cobrancas(ministroA)
      await como(db, ministroA, () =>
        db.query("select public.informar_pagamento($1, current_date, 'PIX', $2, null)", [
          [anuidade.id],
          `pessoas/${pessoaA}/pagamento-1.jpg`,
        ]),
      )
      const r = await db.query<{ id: string; situacao: string; valor: string }>(
        'select id, situacao, valor::text from public.informes_pagamento where cobranca_id = $1',
        [anuidade.id],
      )
      informe = r.rows[0].id
      assert.deepEqual([r.rows[0].situacao, r.rows[0].valor], ['pendente', '200.00'])
    })

    it('não informa duas vezes, nem data futura, nem a contribuição de outro', async () => {
      const [anuidade] = await cobrancas(ministroA)
      await assert.rejects(
        como(db, ministroA, () =>
          db.query("select public.informar_pagamento($1, current_date, 'PIX', null, null)", [[anuidade.id]]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const [deB] = await cobrancas(presidenteB)
      await assert.rejects(
        como(db, ministroA, () =>
          db.query("select public.informar_pagamento($1, current_date, 'PIX', null, null)", [[deB.id]]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, presidenteB, () =>
          db.query("select public.informar_pagamento($1, current_date + 1, 'PIX', null, null)", [[deB.id]]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('com pagamento informado, o plano não muda mais', async () => {
      await assert.rejects(
        como(db, ministroA, async () =>
          db.query("select public.escolher_plano($1, $2, 'mensal')", [await pessoaDe(ministroA), exercicio]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('o ministro não confere pagamento; a recusa exige motivo', async () => {
      await assert.rejects(
        como(db, ministroA, () => db.query('select public.analisar_informe($1, true, null)', [informe])),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, tesoureiro, () => db.query('select public.analisar_informe($1, false, null)', [informe])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('a tesouraria confirma: a anuidade fica paga e o associado fica em dia', async () => {
      assert.equal(await emDia(ministroA), false, 'antes de confirmar, a anuidade vencida está em aberto')
      await como(db, tesoureiro, () => db.query('select public.analisar_informe($1, true, null)', [informe]))
      const pagas = await cobrancas(ministroA, 'paga')
      assert.equal(pagas.length, 1)
      assert.equal(await emDia(ministroA), true)
    })

    it('a tesouraria registra pagamento em dinheiro; quem tem mensalidade vencida continua em atraso', async () => {
      const [abril] = await cobrancas(presidenteB)
      await como(db, tesoureiro, () =>
        db.query("select public.registrar_pagamento($1, current_date, 40, 'Dinheiro (reunião mensal)', null)", [abril.id]),
      )
      assert.equal((await cobrancas(presidenteB, 'paga')).length, 1)
      assert.equal(await emDia(presidenteB), false)
      assert.equal(await emDia(jubiladoC), true, 'jubilado é isento: sempre em dia')
    })

    it('cancelar cobrança exige motivo e só vale para a tesouraria', async () => {
      const [maio] = await cobrancas(presidenteB)
      await assert.rejects(
        como(db, secretaria, () => db.query("select public.cancelar_cobranca($1, 'x')", [maio.id])),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, tesoureiro, () => db.query("select public.cancelar_cobranca($1, '')", [maio.id])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, tesoureiro, () => db.query("select public.cancelar_cobranca($1, 'Lançada por engano')", [maio.id]))
      assert.equal((await cobrancas(presidenteB, 'cancelada')).length, 1)
    })
  })

  describe('quem vê o quê', () => {
    it('o ministro vê só as próprias cobranças e a própria situação; a tesouraria vê todas', async () => {
      const pessoaA = await pessoaDe(ministroA)
      const proprias = await como(db, ministroA, () =>
        db.query<{ pessoa_id: string }>('select distinct pessoa_id from public.cobrancas'),
      )
      assert.deepEqual(
        proprias.rows.map((r) => r.pessoa_id),
        [pessoaA],
      )
      const situacao = await como(db, ministroA, () => db.query('select pessoa_id from public.vw_situacao_contribuicao'))
      assert.equal(situacao.rows.length, 1)
      const todas = await como(db, tesoureiro, () => db.query('select distinct pessoa_id from public.cobrancas'))
      assert.equal(todas.rows.length, 3)
    })

    it('ninguém grava direto nas tabelas (só pelas funções) e nada se apaga', async () => {
      await assert.rejects(
        como(db, tesoureiro, async () =>
          db.query(
            "insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor) values ($1, 2030, 'mensal', '2030-04-01', '2030-04-10', 'nao_presidente', 1)",
            [await pessoaDe(ministroA)],
          ),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, tesoureiro, () => db.query("update public.cobrancas set situacao = 'paga'")),
        erroComCodigo(SEM_PERMISSAO),
      )
      for (const tabela of ['cobrancas', 'informes_pagamento', 'planos_contribuicao']) {
        await assert.rejects(db.query(`delete from public.${tabela}`), erroComCodigo(BLOQUEADO_PELO_BANCO))
      }
    })

    it('a secretaria vê a situação certa (em atraso), mas não grava nada', async () => {
      const r = await como(db, secretaria, async () =>
        db.query<{ em_dia: boolean }>('select em_dia from public.vw_situacao_contribuicao where pessoa_id = $1', [
          await pessoaDe(presidenteB),
        ]),
      )
      assert.equal(r.rows[0].em_dia, false)
      await assert.rejects(
        como(db, secretaria, () => db.query('select public.gerar_cobrancas($1)', [exercicio])),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('o pastor presidente vê quem da igreja dele está em dia', async () => {
      const r = await como(db, presidenteB, () =>
        db.query<{ nome: string; em_dia: boolean }>('select nome, em_dia from public.ministros_da_minha_igreja() order by nome'),
      )
      assert.deepEqual(r.rows, [
        { nome: 'Jubilado C', em_dia: true },
        { nome: 'Ministro A', em_dia: true },
        { nome: 'Novo D', em_dia: false },
        { nome: 'Presidente B', em_dia: false },
      ])
    })

    it('a tesouraria muda o dia de vencimento; o ministro não', async () => {
      const t = await como(db, tesoureiro, () => db.query('update public.config_financeiro set dia_vencimento_mensal = 15'))
      assert.equal(t.affectedRows, 1)
      const m = await como(db, ministroA, () => db.query('update public.config_financeiro set dia_vencimento_mensal = 1'))
      assert.equal(m.affectedRows, 0)
    })
  })
})
