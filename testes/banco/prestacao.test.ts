// Testes da Fase 2.3: prestação de contas — Conselho Fiscal, resumo do exercício, balanço anual em quatro
// passos (tesouraria → diretoria → Conselho Fiscal → assembleia), exercício fechado, orçamento. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Resumo = {
  encerrado: boolean
  contas: { nome: string; tipo: string; saldo_inicial: number; entradas: number; saidas: number; saldo_final: number }[]
  entradas: { categoria: string; total: number }[]
  saidas: { categoria: string; total: number }[]
  total_entradas: number
  total_saidas: number
  transferencias: number
  despesas_aguardando: { quantidade: number; total: number }
  contribuicoes: { previsto: number; recebido: number; em_aberto: number; vencido: number }
}

describe('Fase 2.3 — prestação de contas', () => {
  let db: PGlite
  let presidente: string
  let vice: string
  let tesoureiro: string
  let conselheiro: string
  let ministro: string
  let caixa: string
  let banco: string
  let ofertaDe2024: string
  let pendente: string
  let balanco2024: string
  const categoria: Record<string, string> = {}

  async function lancar(quem: string, conta: string, tipo: string, cat: string, valor: number, data: string) {
    const r = await como(db, quem, () =>
      db.query<{ id: string }>("select public.lancar($1, $2, $3, $4::date, $5, 'Teste', null) as id", [
        conta,
        tipo,
        categoria[cat],
        data,
        valor,
      ]),
    )
    return r.rows[0].id
  }

  async function resumo(quem: string, exercicio: number): Promise<Resumo> {
    const r = await como(db, quem, () =>
      db.query<{ r: Resumo }>('select public.resumo_exercicio($1) as r', [exercicio]),
    )
    return r.rows[0].r
  }

  async function chamar(quem: string, sql: string, params: unknown[] = []) {
    return como(db, quem, () => db.query(sql, params))
  }

  async function situacao(id: string) {
    const r = await db.query<{ situacao: string }>('select situacao::text from public.balancos where id = $1', [id])
    return r.rows[0].situacao
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    vice = await criarUsuario(db, 'vice@teste.local', 'Vice de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    conselheiro = await criarUsuario(db, 'conselheiro@teste.local', 'Conselheiro Fiscal de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, vice, 'presidencia')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, conselheiro, 'conselho_fiscal')

    // O sistema "começou" em abril de 2024, com R$ 100 no caixa e R$ 1.000 no banco
    await db.query(
      "update public.contas_financeiras set saldo_inicial_em = '2024-04-01', saldo_inicial = case tipo when 'caixa' then 100 else 1000 end",
    )
    const contas = await db.query<{ id: string; tipo: string }>('select id, tipo from public.contas_financeiras')
    caixa = contas.rows.find((c) => c.tipo === 'caixa')!.id
    banco = contas.rows.find((c) => c.tipo === 'banco')!.id
    const cats = await db.query<{ id: string; nome: string }>('select id, nome from public.categorias_financeiras')
    for (const c of cats.rows) categoria[c.nome] = c.id

    // Exercício 2024/2025
    ofertaDe2024 = await lancar(tesoureiro, caixa, 'entrada', 'Ofertas', 300, '2024-05-10')
    await lancar(tesoureiro, banco, 'entrada', 'Doações', 200, '2024-06-10')
    const material = await lancar(tesoureiro, caixa, 'saida', 'Material e expediente', 50, '2024-07-01')
    await chamar(presidente, 'select public.autorizar_despesa($1, true, null)', [material])
    await chamar(tesoureiro, "select public.transferir($1, $2, '2024-08-01', 100, 'Depósito')", [caixa, banco])
    pendente = await lancar(tesoureiro, caixa, 'saida', 'Outras despesas', 30, '2024-09-01')
    // Exercício 2025/2026
    await lancar(tesoureiro, caixa, 'entrada', 'Ofertas', 70, '2025-05-01')
  })

  describe('Conselho Fiscal e resumo do exercício', () => {
    it('o Conselho Fiscal vê o financeiro, mas não lança, não cancela e não grava direto', async () => {
      const l = await chamar(conselheiro, 'select id from public.lancamentos')
      assert.equal(l.rows.length, 7) // a transferência tem dois lados
      const s = await chamar(conselheiro, 'select id from public.vw_saldos_contas')
      assert.equal(s.rows.length, 2)
      await assert.rejects(lancar(conselheiro, caixa, 'entrada', 'Doações', 10, '2025-06-01'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(
        chamar(conselheiro, "select public.cancelar_lancamento($1, 'x')", [ofertaDe2024]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(conselheiro, "update public.lancamentos set descricao = 'x'"),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('o ministro não vê o resumo', async () => {
      await assert.rejects(resumo(ministro, 2024), erroComCodigo(SEM_PERMISSAO))
    })

    it('saldos por conta e totais por categoria, sem contar a transferência como receita ou despesa', async () => {
      const r = await resumo(conselheiro, 2024)
      assert.equal(r.encerrado, true)
      const porTipo = Object.fromEntries(r.contas.map((c) => [c.tipo, c]))
      assert.deepEqual(
        { ...porTipo.caixa, nome: undefined },
        { nome: undefined, tipo: 'caixa', saldo_inicial: 100, abertura: 0, entradas: 300, saidas: 150, saldo_final: 250 },
      )
      assert.deepEqual(
        { ...porTipo.banco, nome: undefined },
        { nome: undefined, tipo: 'banco', saldo_inicial: 1000, abertura: 0, entradas: 300, saidas: 0, saldo_final: 1300 },
      )
      assert.deepEqual(
        Object.fromEntries(r.entradas.map((e) => [e.categoria, e.total])),
        { Ofertas: 300, Doações: 200 },
      )
      assert.deepEqual(r.saidas, [{ categoria: 'Material e expediente', total: 50 }])
      assert.equal(r.total_entradas, 500)
      assert.equal(r.total_saidas, 50)
      assert.equal(r.transferencias, 100)
      assert.deepEqual(r.despesas_aguardando, { quantidade: 1, total: 30 })

      // O exercício seguinte começa com o saldo final deste
      const seguinte = await resumo(tesoureiro, 2025)
      assert.equal(seguinte.contas.find((c) => c.tipo === 'caixa')!.saldo_inicial, 250)
    })
  })

  describe('balanço anual', () => {
    it('só fecha exercício encerrado, sem despesa aguardando, e só pela tesouraria ou presidência', async () => {
      await assert.rejects(
        chamar(tesoureiro, "select public.fechar_balanco(interno.exercicio_de(current_date), '')"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(tesoureiro, "select public.fechar_balanco(2024, '')"), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidente, "select public.autorizar_despesa($1, false, 'Sem nota fiscal')", [pendente])
      await assert.rejects(chamar(conselheiro, "select public.fechar_balanco(2024, '')"), erroComCodigo(SEM_PERMISSAO))

      const r = await chamar(tesoureiro, "select public.fechar_balanco(2024, 'Nota da tesouraria') as id")
      balanco2024 = (r.rows[0] as { id: string }).id
      assert.equal(await situacao(balanco2024), 'analise_diretoria')
      const congelado = await db.query<{ total: number }>("select (resumo ->> 'total_saidas')::numeric as total from public.balancos where id = $1", [
        balanco2024,
      ])
      assert.equal(Number(congelado.rows[0].total), 50)
      await assert.rejects(chamar(tesoureiro, "select public.fechar_balanco(2024, '')"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('com o exercício fechado, os lançamentos dele não mudam (os de outro exercício, sim)', async () => {
      await assert.rejects(lancar(tesoureiro, caixa, 'entrada', 'Doações', 10, '2024-10-01'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        chamar(tesoureiro, "select public.cancelar_lancamento($1, 'Erro')", [ofertaDe2024]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await lancar(tesoureiro, caixa, 'entrada', 'Doações', 5, '2025-06-01')
    })

    it('a tesouraria não analisa; a presidência analisa (com texto); a presidência não dá parecer', async () => {
      await assert.rejects(chamar(tesoureiro, "select public.analisar_balanco($1, 'ok')", [balanco2024]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(presidente, "select public.analisar_balanco($1, ' ')", [balanco2024]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidente, "select public.analisar_balanco($1, 'Contas conferidas pela diretoria')", [balanco2024])
      assert.equal(await situacao(balanco2024), 'aguardando_parecer')
      await assert.rejects(
        chamar(presidente, "select public.parecer_balanco($1, 'favoravel', 'ok')", [balanco2024]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('o Conselho Fiscal devolve; o exercício reabre; a tesouraria corrige e fecha de novo', async () => {
      await assert.rejects(chamar(conselheiro, "select public.devolver_balanco($1, '')", [balanco2024]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(conselheiro, "select public.devolver_balanco($1, 'Falta a doação de junho')", [balanco2024])
      assert.equal(await situacao(balanco2024), 'devolvido')

      await lancar(tesoureiro, banco, 'entrada', 'Doações', 10, '2024-06-20')
      const r = await chamar(tesoureiro, "select public.fechar_balanco(2024, 'Doação incluída') as id")
      assert.equal((r.rows[0] as { id: string }).id, balanco2024)
      const b = await db.query<{ situacao: string; analise: string | null; entradas: string }>(
        "select situacao::text, analise_diretoria as analise, resumo ->> 'total_entradas' as entradas from public.balancos where id = $1",
        [balanco2024],
      )
      assert.deepEqual(b.rows[0], { situacao: 'analise_diretoria', analise: null, entradas: '510.00' })
    })

    it('parecer do Conselho Fiscal e aprovação da assembleia; aprovado é final, com todo o histórico', async () => {
      await chamar(presidente, "select public.analisar_balanco($1, 'Agora está completo')", [balanco2024])
      // Fase 5.5: o parecer do ano só sai com os 12 meses aprovados pelo Conselho Fiscal
      await assert.rejects(
        chamar(conselheiro, "select public.parecer_balanco($1, 'favoravel', 'Contas em ordem')", [balanco2024]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(conselheiro, 'select public.aprovar_meses_sem_movimento(2024)')
      for (const mes of ['2024-05-01', '2024-06-01', '2024-07-01', '2024-08-01']) {
        await chamar(conselheiro, "select public.decidir_mes($1, 'aprovado', null)", [mes])
      }
      await chamar(conselheiro, "select public.parecer_balanco($1, 'favoravel', 'Contas em ordem')", [balanco2024])
      assert.equal(await situacao(balanco2024), 'aguardando_assembleia')
      await assert.rejects(
        chamar(presidente, "select public.assembleia_balanco($1, true, current_date + 1, 'Ata')", [balanco2024]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(presidente, "select public.assembleia_balanco($1, true, current_date, 'Ata da AGO')", [balanco2024])
      assert.equal(await situacao(balanco2024), 'aprovado')
      await assert.rejects(chamar(tesoureiro, "select public.fechar_balanco(2024, '')"), erroComCodigo(BLOQUEADO_PELO_BANCO))

      const h = await chamar(conselheiro, 'select acao from public.balanco_eventos where balanco_id = $1 order by criado_em', [
        balanco2024,
      ])
      const acoes = (h.rows as { acao: string }[]).map((e) => e.acao)
      assert.equal(acoes.length, 7)
      assert.equal(acoes[0], 'Fechado pela tesouraria e enviado à diretoria')
      assert.equal(acoes[2], 'Devolvido pelo Conselho Fiscal para correção')
      assert.equal(acoes[5], 'Parecer do Conselho Fiscal: favorável')
      assert.match(acoes[6], /^Aprovado pela assembleia de \d{2}\/\d{2}\/\d{4}$/)
    })

    it('quem fechou não registra a análise; a assembleia que reprova devolve à tesouraria', async () => {
      const r = await chamar(presidente, "select public.fechar_balanco(2023, '') as id")
      const id = (r.rows[0] as { id: string }).id
      await assert.rejects(chamar(presidente, "select public.analisar_balanco($1, 'ok')", [id]), erroComCodigo(SEM_PERMISSAO))
      await chamar(vice, "select public.analisar_balanco($1, 'Analisado')", [id])
      await chamar(conselheiro, 'select public.aprovar_meses_sem_movimento(2023)')
      await chamar(conselheiro, "select public.parecer_balanco($1, 'desfavoravel', 'Faltam comprovantes')", [id])
      await chamar(presidente, "select public.assembleia_balanco($1, false, current_date, 'Ata da AGE')", [id])
      const b = await db.query<{ situacao: string; motivo: string }>(
        'select situacao::text, motivo_devolucao as motivo from public.balancos where id = $1',
        [id],
      )
      assert.equal(b.rows[0].situacao, 'devolvido')
      assert.match(b.rows[0].motivo, /^Reprovado pela assembleia de/)
    })

    it('o ministro não vê os balanços', async () => {
      const r = await chamar(ministro, 'select id from public.balancos')
      assert.equal(r.rows.length, 0)
    })
  })

  describe('orçamento e plano anual de trabalho', () => {
    const itens = (ofertas: number) =>
      JSON.stringify([
        { categoria_id: categoria['Ofertas'], valor: ofertas },
        { categoria_id: categoria['Material e expediente'], valor: 300 },
      ])

    it('a tesouraria prepara e corrige; o Conselho Fiscal não; transferência não entra', async () => {
      await chamar(tesoureiro, "select public.salvar_orcamento(2026, 'Encontros trimestrais', $1::jsonb)", [itens(1000)])
      await chamar(tesoureiro, "select public.salvar_orcamento(2026, 'Encontros trimestrais e ação social', $1::jsonb)", [
        itens(1200),
      ])
      const r = await chamar(conselheiro, 'select valor::text as previsto from public.orcamento_itens order by orcamento_itens.valor desc')
      assert.deepEqual(r.rows, [{ previsto: '1200.00' }, { previsto: '300.00' }])
      await assert.rejects(
        chamar(conselheiro, "select public.salvar_orcamento(2026, 'x', '[]'::jsonb)"),
        erroComCodigo(SEM_PERMISSAO),
      )
      const transferencia = await db.query<{ id: string }>(
        "select id from public.categorias_financeiras where sistema = 'transferencia_saida'",
      )
      await assert.rejects(
        chamar(tesoureiro, 'select public.salvar_orcamento(2026, null, $1::jsonb)', [
          JSON.stringify([{ categoria_id: transferencia.rows[0].id, valor: 10 }]),
        ]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('a presidência registra a aprovação da assembleia; depois disso não muda mais', async () => {
      await assert.rejects(
        chamar(tesoureiro, "select public.aprovar_orcamento(2026, current_date, 'Ata')"),
        erroComCodigo(SEM_PERMISSAO),
      )
      // Fase 5.5: só depois de mandado para a assembleia
      await assert.rejects(
        chamar(presidente, "select public.aprovar_orcamento(2026, current_date, 'Ata da AGO')"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(tesoureiro, 'select public.mandar_orcamento(2026, null)')
      await chamar(presidente, "select public.aprovar_orcamento(2026, current_date, 'Ata da AGO')")
      await assert.rejects(
        chamar(tesoureiro, "select public.salvar_orcamento(2026, 'mudou', $1::jsonb)", [itens(5)]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const m = await chamar(ministro, 'select id from public.orcamentos')
      assert.equal(m.rows.length, 0)
    })
  })

  describe('contribuições por igreja e arquivos', () => {
    it('soma previsto, recebido e em aberto por igreja; o ministro não vê', async () => {
      await db.query("update public.valores_contribuicao set vigente_desde = '2020-01-01' where tipo in ('mensal', 'anual')")
      const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
      const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])
      const pessoa = p.rows[0].id
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2020-01-01')", [pessoa])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoa, i.rows[0].id])
      await chamar(tesoureiro, 'select public.gerar_cobrancas(2025)')
      const c = await db.query<{ id: string }>(
        'select id from public.cobrancas where pessoa_id = $1 and exercicio = 2025 order by competencia limit 1',
        [pessoa],
      )
      await chamar(tesoureiro, "select public.registrar_pagamento($1, current_date, 20, 'PIX', null)", [c.rows[0].id])

      const r = await chamar(conselheiro, 'select * from public.contribuicoes_por_igreja(2025)')
      assert.equal(r.rows.length, 1)
      const linha = r.rows[0] as Record<string, unknown>
      assert.deepEqual(
        Object.fromEntries(Object.entries(linha).map(([k, v]) => [k, String(v)])),
        { igreja: 'Igreja A', associados: '1', previsto: '240.00', recebido: '20.00', em_aberto: '220.00', vencido: '220.00' },
      )
      await assert.rejects(chamar(ministro, 'select * from public.contribuicoes_por_igreja(2025)'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o Conselho Fiscal vê os comprovantes de pagamento, não as fotos e documentos', async () => {
      const pasta = 'pessoas/00000000-0000-0000-0000-0000000000aa'
      await db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1), ('documentos', $2)", [
        `${pasta}/pagamento-1.pdf`,
        `${pasta}/foto-1.jpg`,
      ])
      const r = await chamar(conselheiro, 'select name from storage.objects where name like $1', [`${pasta}/%`])
      assert.deepEqual(r.rows, [{ name: `${pasta}/pagamento-1.pdf` }])
    })
  })
})
