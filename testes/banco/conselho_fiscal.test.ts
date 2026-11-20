// Telas novas, parte 10 (Fase 5.5): o Conselho Fiscal aprova as contas mês a mês — os 12 meses do exercício, a
// aprovação com a fotografia dos números (mudou o mês, deixa de valer), os pedidos de esclarecimento e as respostas
// da tesouraria, as assinaturas e o parecer do ano só com os meses aprovados. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Mes = {
  competencia: string
  situacao: string
  entradas: number
  saidas: number
  lancamentos: number
  saldo_inicio: number
  saldo_fim: number
  perguntas_abertas: number
  perguntas_respondidas: number
  aprovacao: { id: string; decisao: string; ressalva: string | null; vale: boolean; sem_movimento: boolean; assinaturas: { nome: string }[] } | null
}

describe('Fase 5.5, parte 10 — o Conselho Fiscal mês a mês', () => {
  let db: PGlite
  let presidente: string
  let tesoureiro: string
  let conselheiro: string
  let conselheiro2: string
  let ministro: string
  let caixa: string
  let tesoureiroPessoa: string
  let ofertaDeMaio: string
  const categoria: Record<string, string> = {}

  async function chamar(quem: string, sql: string, params: unknown[] = []) {
    return como(db, quem, () => db.query(sql, params))
  }

  async function lancar(quem: string, tipo: string, cat: string, valor: number, data: string, descricao = 'Teste') {
    const r = await chamar(quem, 'select public.lancar($1, $2, $3, $4::date, $5, $6, null) as id', [caixa, tipo, categoria[cat], data, valor, descricao])
    return (r.rows[0] as { id: string }).id
  }

  async function meses(quem: string, exercicio: number): Promise<Mes[]> {
    const r = await chamar(quem, 'select public.meses_do_conselho($1) as m', [exercicio])
    return (r.rows[0] as { m: Mes[] }).m
  }

  const doMes = (lista: Mes[], comp: string) => lista.find((m) => m.competencia === comp)!

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    conselheiro = await criarUsuario(db, 'conselheiro@teste.local', 'Conselheiro Um')
    conselheiro2 = await criarUsuario(db, 'conselheiro2@teste.local', 'Conselheiro Dois')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, conselheiro, 'conselho_fiscal')
    await darPerfil(db, conselheiro2, 'conselho_fiscal')
    const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [tesoureiro])
    tesoureiroPessoa = p.rows[0].id

    // O caixa começou em 01/04/2024 com R$ 100; exercício 2024/2025 (todo no passado)
    await db.query("update public.contas_financeiras set saldo_inicial_em = '2024-04-01', saldo_inicial = case tipo when 'caixa' then 100 else 0 end")
    const contas = await db.query<{ id: string; tipo: string }>('select id, tipo from public.contas_financeiras')
    caixa = contas.rows.find((c) => c.tipo === 'caixa')!.id
    const cats = await db.query<{ id: string; nome: string }>('select id, nome from public.categorias_financeiras')
    for (const c of cats.rows) categoria[c.nome] = c.id

    ofertaDeMaio = await lancar(tesoureiro, 'entrada', 'Ofertas', 50, '2024-05-10', 'Oferta de maio')
    const papel = await lancar(tesoureiro, 'saida', 'Material e expediente', 20, '2024-05-20', 'Papel')
    await chamar(presidente, 'select public.autorizar_despesa($1, true, null)', [papel])
    await lancar(tesoureiro, 'entrada', 'Doações', 30, '2024-06-15', 'Doação de junho')
  })

  it('os 12 meses do exercício (abril a março), com os números e o saldo; o ministro não vê', async () => {
    const lista = await meses(conselheiro, 2024)
    assert.equal(lista.length, 12)
    assert.equal(lista[0].competencia, '2024-04-01')
    assert.equal(lista[11].competencia, '2025-03-01')
    const maio = doMes(lista, '2024-05-01')
    assert.deepEqual(
      [Number(maio.entradas), Number(maio.saidas), Number(maio.lancamentos), Number(maio.saldo_inicio), Number(maio.saldo_fim), maio.situacao],
      [50, 20, 2, 100, 130, 'para_analisar'],
    )
    // o tesoureiro e a presidência também veem
    assert.equal((await meses(tesoureiro, 2024)).length, 12)
    await assert.rejects(meses(ministro, 2024), erroComCodigo(SEM_PERMISSAO))
    // o exercício de agora: o mês aberto e os que ainda não começaram
    const atual = await chamar(conselheiro, 'select public.meses_do_conselho(interno.exercicio_de(current_date)) as m')
    const situacoes = ((atual.rows[0] as { m: Mes[] }).m).map((m) => m.situacao)
    assert.ok(situacoes.includes('aberto'))
  })

  it('só o Conselho Fiscal independente aprova; mês que não terminou não; ressalva com texto', async () => {
    await assert.rejects(chamar(tesoureiro, "select public.decidir_mes('2024-05-01', 'aprovado', null)"), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(chamar(presidente, "select public.decidir_mes('2024-05-01', 'aprovado', null)"), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(
      chamar(conselheiro, "select public.decidir_mes(date_trunc('month', current_date)::date, 'aprovado', null)"),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    await assert.rejects(
      chamar(conselheiro, "select public.decidir_mes('2024-05-01', 'aprovado_com_ressalva', ' ')"),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    // (quem é do Conselho não pode ter perfil da diretoria: o banco já recusa dar os dois à mesma pessoa)
  })

  it('aprova com a fotografia dos números; o outro membro assina também; não aprova duas vezes', async () => {
    await chamar(conselheiro, "select public.decidir_mes('2024-05-17', 'aprovado_com_ressalva', 'O papel passou do previsto.')")
    let maio = doMes(await meses(conselheiro, 2024), '2024-05-01')
    assert.equal(maio.situacao, 'ressalva')
    assert.equal(maio.aprovacao?.ressalva, 'O papel passou do previsto.')
    assert.deepEqual(maio.aprovacao?.assinaturas.map((a) => a.nome), ['Conselheiro Um'])
    await assert.rejects(chamar(conselheiro2, "select public.decidir_mes('2024-05-01', 'aprovado', null)"), erroComCodigo(BLOQUEADO_PELO_BANCO))

    await chamar(conselheiro2, 'select public.assinar_mes($1)', [maio.aprovacao!.id])
    await assert.rejects(chamar(conselheiro2, 'select public.assinar_mes($1)', [maio.aprovacao!.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    maio = doMes(await meses(tesoureiro, 2024), '2024-05-01')
    assert.deepEqual(maio.aprovacao?.assinaturas.map((a) => a.nome), ['Conselheiro Um', 'Conselheiro Dois'])
    // ninguém grava direto
    await assert.rejects(chamar(conselheiro, "update public.conselho_meses set decisao = 'aprovado'"), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(db.query('delete from public.conselho_meses'))
  })

  it('mudou o mês depois da aprovação: deixa de valer e o Conselho aprova de novo (a antiga fica arquivada)', async () => {
    await chamar(tesoureiro, "select public.cancelar_lancamento($1, 'Lançado em dobro')", [ofertaDeMaio])
    let maio = doMes(await meses(conselheiro, 2024), '2024-05-01')
    assert.equal(maio.situacao, 'mudou')
    assert.equal(maio.aprovacao?.vale, false)
    await assert.rejects(chamar(conselheiro2, 'select public.assinar_mes($1)', [maio.aprovacao!.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))

    await chamar(conselheiro2, "select public.decidir_mes('2024-05-01', 'aprovado', null)")
    maio = doMes(await meses(conselheiro, 2024), '2024-05-01')
    assert.equal(maio.situacao, 'aprovado')
    const todas = await db.query<{ arquivada: boolean }>(
      "select arquivado_em is not null as arquivada from public.conselho_meses where competencia = '2024-05-01' order by criado_em",
    )
    assert.deepEqual(todas.rows, [{ arquivada: true }, { arquivada: false }])
  })

  it('cancelar um lançamento e lançar outro do mesmo valor também faz a aprovação deixar de valer', async () => {
    // defeito achado no ponta a ponta (20/11/2026): as somas e a quantidade voltavam a bater e a aprovação valia de novo
    const extra = await lancar(tesoureiro, 'entrada', 'Ofertas', 7, '2024-05-25', 'Oferta extra')
    await chamar(conselheiro, "select public.decidir_mes('2024-05-01', 'aprovado', null)")
    assert.equal(doMes(await meses(conselheiro, 2024), '2024-05-01').situacao, 'aprovado')
    await chamar(tesoureiro, "select public.cancelar_lancamento($1, 'Trocado')", [extra])
    await lancar(tesoureiro, 'entrada', 'Ofertas', 7, '2024-05-26', 'Oferta extra (a certa)')
    const maio = doMes(await meses(conselheiro, 2024), '2024-05-01')
    assert.equal(maio.situacao, 'mudou')
    await chamar(conselheiro, "select public.decidir_mes('2024-05-01', 'aprovado', null)")
  })

  it('pede esclarecimento; o mês espera a tesouraria; a resposta com o comprovante vai para o lançamento', async () => {
    const doacao = await db.query<{ id: string }>("select id from public.lancamentos where descricao = 'Doação de junho'")
    const lancamento = doacao.rows[0].id
    await assert.rejects(
      chamar(conselheiro, "select public.pedir_esclarecimento('2024-07-01', $1, 'De quem foi a doação?')", [lancamento]),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    await assert.rejects(
      chamar(tesoureiro, "select public.pedir_esclarecimento('2024-06-01', $1, 'De quem foi a doação?')", [lancamento]),
      erroComCodigo(SEM_PERMISSAO),
    )
    const r = await chamar(conselheiro, "select public.pedir_esclarecimento('2024-06-01', $1, 'De quem foi a doação?') as id", [lancamento])
    const pedido = (r.rows[0] as { id: string }).id
    let junho = doMes(await meses(conselheiro, 2024), '2024-06-01')
    assert.deepEqual([junho.situacao, junho.perguntas_abertas], ['esclarecimento', 1])
    await assert.rejects(chamar(conselheiro, "select public.decidir_mes('2024-06-01', 'aprovado', null)"), erroComCodigo(BLOQUEADO_PELO_BANCO))

    // só a tesouraria (ou a presidência) responde; o arquivo é dela
    await assert.rejects(chamar(conselheiro, "select public.responder_esclarecimento($1, 'x', null)", [pedido]), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(
      chamar(tesoureiro, "select public.responder_esclarecimento($1, 'Da Igreja A', 'pessoas/outra/pagamento-1.pdf')", [pedido]),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    const arquivo = `pessoas/${tesoureiroPessoa}/pagamento-recibo.pdf`
    await chamar(tesoureiro, "select public.responder_esclarecimento($1, 'Da Igreja A, com recibo.', $2)", [pedido, arquivo])
    await assert.rejects(chamar(tesoureiro, "select public.responder_esclarecimento($1, 'De novo', null)", [pedido]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    const l = await db.query<{ comprovante: string }>('select comprovante_caminho as comprovante from public.lancamentos where id = $1', [lancamento])
    assert.equal(l.rows[0].comprovante, arquivo)

    junho = doMes(await meses(conselheiro, 2024), '2024-06-01')
    assert.deepEqual([junho.situacao, junho.perguntas_abertas, junho.perguntas_respondidas], ['para_analisar', 0, 1])
    await chamar(conselheiro, "select public.decidir_mes('2024-06-01', 'aprovado', null)")
    // aprovado, não aceita mais pergunta
    await assert.rejects(
      chamar(conselheiro, "select public.pedir_esclarecimento('2024-06-01', null, 'Mais uma?')"),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    const m = await chamar(ministro, 'select id from public.esclarecimentos')
    assert.equal(m.rows.length, 0)
  })

  it('os meses sem movimento se aprovam de uma vez; o parecer do ano só com os 12 meses e os membros assinam', async () => {
    const r = await chamar(conselheiro, 'select public.aprovar_meses_sem_movimento(2024) as n')
    assert.equal((r.rows[0] as { n: number }).n, 10) // abril e de julho a março; maio e junho já estavam aprovados
    const sem = doMes(await meses(conselheiro, 2024), '2024-04-01')
    assert.equal(sem.aprovacao?.sem_movimento, true)

    // o balanço: a tesouraria fecha, a diretoria analisa
    const b = await chamar(tesoureiro, "select public.fechar_balanco(2024, '') as id")
    const balanco = (b.rows[0] as { id: string }).id
    const vice = await criarUsuario(db, 'vice@teste.local', 'Vice de Teste')
    await darPerfil(db, vice, 'presidencia')
    await chamar(vice, "select public.analisar_balanco($1, 'Conferido')", [balanco])

    // um mês ainda por aprovar trava o parecer: arquiva a aprovação de julho para simular
    await db.query("update public.conselho_meses set arquivado_em = now() where competencia = '2024-07-01' and arquivado_em is null")
    await assert.rejects(
      chamar(conselheiro, "select public.parecer_balanco($1, 'favoravel', 'Contas em ordem')", [balanco]),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    await chamar(conselheiro, "select public.decidir_mes('2024-07-01', 'aprovado', null)")
    await chamar(conselheiro, "select public.parecer_balanco($1, 'favoravel', 'Contas em ordem')", [balanco])
    await chamar(conselheiro2, 'select public.assinar_parecer($1)', [balanco])
    await assert.rejects(chamar(conselheiro2, 'select public.assinar_parecer($1)', [balanco]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    const a = await chamar(tesoureiro, 'select p.nome from public.conselho_assinaturas a join public.pessoas p on p.id = a.pessoa_id where a.balanco_id = $1 order by a.assinado_em', [
      balanco,
    ])
    assert.deepEqual((a.rows as { nome: string }[]).map((x) => x.nome), ['Conselheiro Um', 'Conselheiro Dois'])
  })

  it('os membros do Conselho Fiscal (pelo perfil); o ministro não vê', async () => {
    const r = await chamar(presidente, 'select nome from public.membros_conselho_fiscal()')
    assert.deepEqual(
      (r.rows as { nome: string }[]).map((x) => x.nome),
      ['Conselheiro Dois', 'Conselheiro Um'],
    )
    await assert.rejects(chamar(ministro, 'select * from public.membros_conselho_fiscal()'), erroComCodigo(SEM_PERMISSAO))
  })
})
