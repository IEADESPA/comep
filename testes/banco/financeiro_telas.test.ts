// Telas novas, parte 9 (Fase 5.5): o Financeiro nas 6 funções — os números do alto, o caixa como extrato (o saldo no
// começo e no fim do período), os lançamentos com os nomes, o orçamento que vai para a assembleia e o plano anual
// de trabalho em atividades. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.5, parte 9 — o Financeiro nas 6 funções', () => {
  let db: PGlite
  let presidente: string
  let tesoureiro: string
  let conselheiro: string
  let ministro: string
  let caixa: string
  let banco: string
  const categoria: Record<string, string> = {}

  async function chamar(quem: string, sql: string, params: unknown[] = []) {
    return como(db, quem, () => db.query(sql, params))
  }

  async function lancar(quem: string, conta: string, tipo: string, cat: string, valor: number, data: string, descricao = 'Teste') {
    const r = await chamar(quem, 'select public.lancar($1, $2, $3, $4::date, $5, $6, null) as id', [
      conta,
      tipo,
      categoria[cat],
      data,
      valor,
      descricao,
    ])
    return (r.rows[0] as { id: string }).id
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    conselheiro = await criarUsuario(db, 'conselheiro@teste.local', 'Conselheiro de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, conselheiro, 'conselho_fiscal')

    // O caixa "começou" em 01/01/2026 com R$ 100 no dinheiro; o banco abre em 10/02/2026 com R$ 1.000
    await db.query(
      "update public.contas_financeiras set saldo_inicial_em = case tipo when 'caixa' then '2026-01-01'::date else '2026-02-10'::date end, saldo_inicial = case tipo when 'caixa' then 100 else 1000 end",
    )
    const contas = await db.query<{ id: string; tipo: string }>('select id, tipo from public.contas_financeiras')
    caixa = contas.rows.find((c) => c.tipo === 'caixa')!.id
    banco = contas.rows.find((c) => c.tipo === 'banco')!.id
    const cats = await db.query<{ id: string; nome: string }>('select id, nome from public.categorias_financeiras')
    for (const c of cats.rows) categoria[c.nome] = c.id

    await lancar(tesoureiro, caixa, 'entrada', 'Ofertas', 50, '2026-01-15', 'Oferta de janeiro')
    await lancar(tesoureiro, caixa, 'entrada', 'Ofertas', 30, '2026-02-05', 'Oferta de fevereiro')
    const material = await lancar(tesoureiro, caixa, 'saida', 'Material e expediente', 20, '2026-02-12', 'Papel')
    await chamar(presidente, 'select public.autorizar_despesa($1, true, null)', [material])
    await chamar(tesoureiro, "select public.transferir($1, $2, '2026-02-20', 40, 'Depósito')", [caixa, banco])
    // despesa esperando o presidente: não entra no saldo
    await lancar(tesoureiro, caixa, 'saida', 'Outras despesas', 7, '2026-02-25', 'Esperando')
  })

  describe('os números do alto e o caixa como extrato', () => {
    it('os números: o saldo de hoje e as despesas esperando; o ministro não vê', async () => {
      const r = await chamar(conselheiro, 'select public.numeros_do_financeiro() as n')
      const n = (r.rows[0] as { n: { saldo: number; despesas_esperando: { quantidade: number; valor: number } } }).n
      assert.equal(Number(n.saldo), 100 + 50 + 30 - 20 + 1000)
      assert.deepEqual(n.despesas_esperando, { quantidade: 1, valor: 7 })
      await assert.rejects(chamar(ministro, 'select public.numeros_do_financeiro()'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o saldo no começo e no fim do mês, com a conta aberta dentro dele', async () => {
      const r = await chamar(tesoureiro, "select public.caixa_no_periodo('2026-02-01', '2026-02-28') as c")
      const c = (r.rows[0] as { c: { saldo_inicio: number; saldo_fim: number; aberturas: { conta: string; valor: number; data: string }[] } }).c
      assert.equal(Number(c.saldo_inicio), 150) // 100 + a oferta de janeiro
      // + 30 − 20 e a abertura do banco (1.000); a transferência não muda o total; a despesa esperando não conta
      assert.equal(Number(c.saldo_fim), 1160)
      assert.equal(c.aberturas.length, 1)
      assert.equal(Number(c.aberturas[0].valor), 1000)
      assert.equal(c.aberturas[0].data, '2026-02-10')

      // antes da abertura do caixa, o saldo é zero
      const antes = await chamar(tesoureiro, "select public.caixa_no_periodo('2025-12-01', '2025-12-31') as c")
      assert.equal(Number((antes.rows[0] as { c: { saldo_fim: number } }).c.saldo_fim), 0)
      await assert.rejects(
        chamar(tesoureiro, "select public.caixa_no_periodo('2026-02-28', '2026-02-01')"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(ministro, "select public.caixa_no_periodo('2026-02-01', '2026-02-28')"), erroComCodigo(SEM_PERMISSAO))
    })

    it('os lançamentos com o nome de quem lançou e de quem autorizou; só quem vê o caixa', async () => {
      const r = await chamar(conselheiro, "select descricao, lancado_por_nome, autorizado_por_nome, no_saldo from public.vw_lancamentos where descricao = 'Papel'")
      assert.deepEqual(r.rows, [
        { descricao: 'Papel', lancado_por_nome: 'Tesoureiro de Teste', autorizado_por_nome: 'Presidente de Teste', no_saldo: true },
      ])
      const esperando = await chamar(tesoureiro, "select no_saldo from public.vw_lancamentos where descricao = 'Esperando'")
      assert.deepEqual(esperando.rows, [{ no_saldo: false }])
      const m = await chamar(ministro, 'select id from public.vw_lancamentos')
      assert.equal(m.rows.length, 0)
      // a vista é só leitura (sem permissão de gravar e com junções)
      await assert.rejects(chamar(tesoureiro, "update public.vw_lancamentos set descricao = 'x'"))
    })
  })

  describe('o orçamento vai para a assembleia', () => {
    const itens = (valor: number) => JSON.stringify([{ categoria_id: categoria['Ofertas'], valor }])

    it('salvar o previsto não apaga o texto do plano (null mantém)', async () => {
      await chamar(tesoureiro, "select public.salvar_orcamento(2027, 'Encontros trimestrais', $1::jsonb)", [itens(100)])
      await chamar(tesoureiro, 'select public.salvar_orcamento(2027, null, $1::jsonb)', [itens(150)])
      const o = await db.query<{ plano: string; valor: string }>(
        `select o.plano_trabalho as plano, i.valor::text as valor
         from public.orcamentos o join public.orcamento_itens i on i.orcamento_id = o.id where o.exercicio = 2027`,
      )
      assert.deepEqual(o.rows, [{ plano: 'Encontros trimestrais', valor: '150.00' }])
    })

    it('sem previsto não vai; mandado, não muda; volta para o rascunho; o Conselho Fiscal não manda', async () => {
      await chamar(tesoureiro, 'select public.salvar_orcamento(2028, null, $1::jsonb)', [itens(0)])
      await assert.rejects(chamar(tesoureiro, 'select public.mandar_orcamento(2028, null)'), erroComCodigo(BLOQUEADO_PELO_BANCO))

      await assert.rejects(chamar(conselheiro, 'select public.mandar_orcamento(2027, null)'), erroComCodigo(SEM_PERMISSAO))
      await chamar(tesoureiro, 'select public.mandar_orcamento(2027, null)')
      await assert.rejects(
        chamar(tesoureiro, 'select public.salvar_orcamento(2027, null, $1::jsonb)', [itens(9)]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(tesoureiro, "select public.salvar_atividade_plano(2027, null, 'Congresso', null, null, null, null, null)"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(tesoureiro, 'select public.mandar_orcamento(2027, null)'), erroComCodigo(BLOQUEADO_PELO_BANCO))

      await chamar(presidente, 'select public.voltar_orcamento(2027)')
      await chamar(tesoureiro, 'select public.salvar_orcamento(2027, null, $1::jsonb)', [itens(200)])
      await assert.rejects(chamar(tesoureiro, 'select public.voltar_orcamento(2027)'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a assembleia escolhida tem que ser uma AGO ou AGE não cancelada', async () => {
      const reuniao = await db.query<{ id: string }>(
        "insert into public.encontros (tipo, titulo, inicio, local) values ('reuniao_mensal', 'Reunião', now() + interval '10 days', 'Sede') returning id",
      )
      const ago = await db.query<{ id: string }>(
        "insert into public.encontros (tipo, titulo, inicio, local) values ('ago', 'AGO de abril', now() + interval '20 days', 'Sede') returning id",
      )
      await assert.rejects(
        chamar(tesoureiro, 'select public.mandar_orcamento(2027, $1)', [reuniao.rows[0].id]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(tesoureiro, 'select public.mandar_orcamento(2027, $1)', [ago.rows[0].id])
      const o = await chamar(conselheiro, 'select encontro_id, enviado_por is not null as quem from public.orcamentos where exercicio = 2027')
      assert.deepEqual(o.rows, [{ encontro_id: ago.rows[0].id, quem: true }])
    })

    it('a aprovação só depois de mandado; aprovado, não volta para o rascunho', async () => {
      await chamar(tesoureiro, 'select public.salvar_orcamento(2029, null, $1::jsonb)', [itens(10)])
      await assert.rejects(
        chamar(presidente, "select public.aprovar_orcamento(2029, current_date, 'Ata')"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(presidente, "select public.aprovar_orcamento(2027, current_date, 'Ata da AGO')")
      await assert.rejects(chamar(presidente, 'select public.voltar_orcamento(2027)'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        db.query("update public.orcamentos set enviado_em = null where exercicio = 2027"),
        /orcamentos_aprovado_depois_de_mandado/,
      )
    })
  })

  describe('o plano anual de trabalho em atividades', () => {
    let atividade: string

    it('a tesouraria cria e corrige atividades dentro do exercício; o mês vira o primeiro dia', async () => {
      const r = await chamar(
        tesoureiro,
        "select public.salvar_atividade_plano(2030, null, 'Congresso de obreiros', '2030-09-17', 'Com workshops', 'Comissão de eventos', $1, 1500) as id",
        [categoria['Eventos e encontros']],
      )
      atividade = (r.rows[0] as { id: string }).id
      await chamar(tesoureiro, "select public.salvar_atividade_plano(2030, null, 'Reuniões mensais', null, null, null, null, null)")
      await chamar(
        tesoureiro,
        "select public.salvar_atividade_plano(2030, $1, 'Congresso de obreiros e pastores', '2030-10-01', null, 'Comissão de eventos', $2, 1800)",
        [atividade, categoria['Eventos e encontros']],
      )
      const a = await chamar(conselheiro, 'select titulo, mes::text as mes, valor::text as valor from public.plano_atividades where arquivado_em is null order by titulo')
      assert.deepEqual(a.rows, [
        { titulo: 'Congresso de obreiros e pastores', mes: '2030-10-01', valor: '1800.00' },
        { titulo: 'Reuniões mensais', mes: null, valor: null },
      ])
    })

    it('mês fora do exercício, título vazio, transferência e quem não pode são recusados', async () => {
      await assert.rejects(
        chamar(tesoureiro, "select public.salvar_atividade_plano(2030, null, 'Fora', '2031-04-01', null, null, null, null)"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(tesoureiro, "select public.salvar_atividade_plano(2030, null, ' ', null, null, null, null, null)"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const transferencia = await db.query<{ id: string }>("select id from public.categorias_financeiras where sistema = 'transferencia_saida'")
      await assert.rejects(
        chamar(tesoureiro, "select public.salvar_atividade_plano(2030, null, 'Depósito', null, null, null, $1, 10)", [transferencia.rows[0].id]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(conselheiro, "select public.salvar_atividade_plano(2030, null, 'Teste', null, null, null, null, null)"),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(tesoureiro, "insert into public.plano_atividades (orcamento_id, titulo) select id, 'Direto' from public.orcamentos limit 1"),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('tirar do plano arquiva (nada se apaga); o ministro não vê o plano', async () => {
      await chamar(presidente, 'select public.arquivar_atividade_plano($1)', [atividade])
      const a = await db.query<{ arquivada: boolean }>('select arquivado_em is not null as arquivada from public.plano_atividades where id = $1', [
        atividade,
      ])
      assert.deepEqual(a.rows, [{ arquivada: true }])
      await assert.rejects(chamar(presidente, 'select public.arquivar_atividade_plano($1)', [atividade]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(db.query('delete from public.plano_atividades where id = $1', [atividade]))
      const m = await chamar(ministro, 'select id from public.plano_atividades')
      assert.equal(m.rows.length, 0)
    })
  })
})
