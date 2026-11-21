// Telas novas, parte 12 (Fase 5.5): a blindagem do Financeiro — uma função só grava no livro-caixa, o lançamento não
// muda, todo valor pago num módulo tem o lançamento ligado à origem, cancelar o lançamento devolve a origem para
// "a pagar" e cancelar a inscrição paga estorna. Testes de CONCILIAÇÃO: para cada origem, a soma dos pagos é igual à
// soma dos lançamentos ligados. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const REGRA_DA_TABELA = '23514'

describe('Fase 5.5, parte 12 — a blindagem do Financeiro', () => {
  let db: PGlite
  let tesouraria: string
  let presidencia: string
  let presidencia2: string
  let secretaria: string
  let ministro: string
  let pessoaMinistro: string
  let banco: string
  let caixa: string
  let ofertas: string
  let material: string
  let evento: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const numero = async (sql: string, params: unknown[] = []) => Number((await um<{ n: string | number | null }>(sql, params)).n ?? 0)
  const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString()

  /** Conciliação das contribuições: o pago nas cobranças = as entradas do caixa ligadas a elas. */
  async function conciliarContribuicoes() {
    const pago = await numero("select coalesce(sum(valor_pago), 0) as n from public.cobrancas where situacao = 'paga'")
    const noCaixa = await numero("select coalesce(sum(valor), 0) as n from public.lancamentos where cobranca_id is not null and situacao = 'efetivado'")
    assert.equal(noCaixa, pago, 'contribuições: o pago e o caixa batem')
  }
  /** Conciliação das inscrições: o pago nas inscrições = as entradas do caixa ligadas a elas. */
  async function conciliarInscricoes() {
    const pago = await numero('select coalesce(sum(valor), 0) as n from public.evento_inscricoes where pago_em is not null')
    const noCaixa = await numero(
      "select coalesce(sum(l.valor), 0) as n from public.evento_inscricoes i join public.lancamentos l on l.id = i.lancamento_id where l.situacao = 'efetivado'",
    )
    const soltas = await numero(
      "select count(*) as n from public.lancamentos l join public.categorias_financeiras c on c.id = l.categoria_id where c.sistema = 'inscricoes_eventos' and l.situacao = 'efetivado' and not exists (select 1 from public.evento_inscricoes i where i.lancamento_id = l.id)",
    )
    assert.equal(noCaixa, pago, 'inscrições: o pago e o caixa batem')
    assert.equal(soltas, 0, 'nenhuma entrada de inscrição solta no caixa')
  }
  /** Conciliação dos modelos exclusivos: o valor dos pagos = as entradas ligadas. */
  async function conciliarExclusivos() {
    const pago = await numero("select coalesce(sum(exclusivo_valor), 0) as n from public.credencial_modelos where exclusivo_pago_em is not null")
    const noCaixa = await numero(
      "select coalesce(sum(l.valor), 0) as n from public.credencial_modelos m join public.lancamentos l on l.id = m.exclusivo_lancamento_id where l.situacao = 'efetivado'",
    )
    assert.equal(noCaixa, pago, 'modelos exclusivos: o pago e o caixa batem')
  }

  before(async () => {
    db = await criarBanco()
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    presidencia2 = await criarUsuario(db, 'vice@teste.local', 'Vice-presidência de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, tesouraria, 'tesouraria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, presidencia2, 'presidencia')
    await darPerfil(db, secretaria, 'secretaria')
    pessoaMinistro = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])).id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoaMinistro])
    await db.query("update public.contas_financeiras set saldo_inicial_em = '2025-01-01', saldo_inicial = 0")
    const contas = await um<{ banco: string; caixa: string }>('select conta_banco_id as banco, conta_dinheiro_id as caixa from public.config_financeiro')
    banco = contas.banco
    caixa = contas.caixa
    ofertas = (await um<{ id: string }>("select id from public.categorias_financeiras where nome = 'Ofertas'")).id
    material = (await um<{ id: string }>("select id from public.categorias_financeiras where tipo = 'saida' and sistema is null order by ordem limit 1")).id
    for (const comp of ['2025-05-01', '2025-06-01', '2025-07-01']) {
      await db.query(
        `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
         values ($1, 2025, 'mensal', $2::date, $2::date + 9, 'nao_presidente', 20)`,
        [pessoaMinistro, comp],
      )
    }
  })

  describe('a trava do livro-caixa', () => {
    it('ninguém grava direto: nem a API, nem o dono do banco, nem outra função; só a função única', async () => {
      await assert.rejects(
        chamar(tesouraria, "insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao) values ($1, 'entrada', $2, current_date, 10, 'Direto', 'efetivado')", [banco, ofertas]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        db.query("insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao) values ($1, 'entrada', $2, current_date, 10, 'Direto', 'efetivado')", [banco, ofertas]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(chamar(tesouraria, "select interno.registrar_lancamento($1, 'entrada', $2, current_date, 10, 'Pela API', 'efetivado')", [banco, ofertas]), erroComCodigo(SEM_PERMISSAO))
      const id = (await chamar(tesouraria, "select public.lancar($1, 'entrada', $2, current_date, 50, 'Oferta do culto', null) as id", [banco, ofertas])).rows[0] as { id: string }
      // a porta fecha logo depois de gravar: na mesma transação, outra gravação direta continua recusada
      await assert.rejects(
        db.exec(`begin;
          select interno.registrar_lancamento('${banco}', 'entrada', '${ofertas}', current_date, 1, 'Pela função', 'efetivado');
          insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao) values ('${banco}', 'entrada', '${ofertas}', current_date, 1, 'Escondido', 'efetivado');
          commit;`),
        erroComCodigo(SEM_PERMISSAO),
      )
      await db.exec('rollback').catch(() => undefined)
      // gravado, não muda; nada se apaga
      await assert.rejects(db.query('update public.lancamentos set valor = 5 where id = $1', [id.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(db.query("update public.lancamentos set descricao = 'Outra' where id = $1", [id.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(db.query('delete from public.lancamentos where id = $1', [id.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(tesouraria, "select public.cancelar_lancamento($1, 'Lançado em dobro')", [id.id])
      await assert.rejects(db.query("update public.lancamentos set situacao = 'efetivado' where id = $1", [id.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('as contribuições', () => {
    it('o pagamento entra no caixa ligado à cobrança; cancelar o lançamento devolve a cobrança para "em aberto"', async () => {
      const [maio, junho] = (await db.query<{ id: string }>("select id from public.cobrancas where pessoa_id = $1 order by competencia", [pessoaMinistro])).rows
      await chamar(tesouraria, "select public.registrar_pagamento($1, '2025-05-08', 20, 'PIX', null)", [maio.id])
      await chamar(tesouraria, "select public.registrar_pagamento($1, '2025-06-08', 20, 'Dinheiro', null)", [junho.id])
      await conciliarContribuicoes()
      const l = await um<{ id: string; conta_id: string; origem: string; origem_texto: string; origem_link: string }>(
        'select id, conta_id, origem, origem_texto, origem_link from public.vw_lancamentos where cobranca_id = $1',
        [junho.id],
      )
      assert.equal(l.conta_id, caixa, 'dinheiro vai para o caixa')
      assert.equal(l.origem, 'contribuicao')
      assert.equal(l.origem_texto, 'Mensalidade 06/2025 de Ministro de Teste')
      assert.equal(l.origem_link, `/ministros/${pessoaMinistro}/contribuicao`)

      // o estorno: cancelar o lançamento da contribuição (antes era proibido pelo caixa) devolve a cobrança
      await assert.rejects(chamar(secretaria, "select public.cancelar_lancamento($1, 'Erro')", [l.id]), erroComCodigo(SEM_PERMISSAO))
      await chamar(tesouraria, "select public.cancelar_lancamento($1, 'O dinheiro não estava no envelope')", [l.id])
      const c = await um<{ situacao: string; pago_em: string | null; valor_pago: string | null }>('select situacao, pago_em, valor_pago from public.cobrancas where id = $1', [junho.id])
      assert.deepEqual(c, { situacao: 'aberta', pago_em: null, valor_pago: null })
      await conciliarContribuicoes()
      // pagar de novo: outro lançamento
      await chamar(tesouraria, "select public.registrar_pagamento($1, '2025-06-10', 20, 'PIX', null)", [junho.id])
      await conciliarContribuicoes()
      assert.equal(await numero("select count(*) as n from public.lancamentos where cobranca_id = $1", [junho.id]), 2)
    })

    it('cobrança paga sem o lançamento não fica: o banco recusa no fim da transação', async () => {
      const maio = await um<{ id: string }>("select id from public.cobrancas where pessoa_id = $1 and competencia = '2025-05-01'", [pessoaMinistro])
      await assert.rejects(db.query('update public.cobrancas set valor_pago = 25 where id = $1', [maio.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await conciliarContribuicoes()
    })

    it('o "recebido" do Financeiro é lido do caixa', async () => {
      const n = (await chamar(tesouraria, 'select public.numeros_do_financeiro() as n')).rows[0] as { n: { exercicio: number } }
      const exercicio = n.n.exercicio
      const noCaixa = await numero(
        "select coalesce(sum(l.valor), 0) as n from public.lancamentos l join public.cobrancas c on c.id = l.cobranca_id where l.situacao = 'efetivado' and c.exercicio = $1",
        [exercicio],
      )
      assert.equal(Number((n.n as unknown as { contribuicoes: { recebido: number } }).contribuicoes.recebido), noCaixa)
    })
  })

  describe('os eventos', () => {
    before(async () => {
      evento = (
        (
          await chamar(secretaria, 'select public.salvar_evento(null, $1::jsonb) as id', [
            JSON.stringify({ titulo: 'Seminário de Liderança (blindagem)', local: 'Sede', inicio: daqui(30), inscricao: true, inscricao_publica: true, taxa: 30, orcamento: 500 }),
          ])
        ).rows[0] as { id: string }
      ).id
      await chamar(presidencia, 'select public.publicar_evento($1)', [evento])
    })

    it('a inscrição paga entra no caixa ligada ao evento; pago sem lançamento a tabela recusa', async () => {
      await chamar(null, "select public.inscrever_no_evento($1, 'Visitante Um', '94999990101', null, true)", [evento])
      await chamar(null, "select public.inscrever_no_evento($1, 'Visitante Dois', '94999990102', null, true)", [evento])
      const [i1, i2] = (await db.query<{ id: string }>('select id from public.evento_inscricoes where evento_id = $1 order by numero', [evento])).rows
      await chamar(tesouraria, "select public.registrar_pagamento_inscricao($1, current_date, 'PIX')", [i1.id])
      await chamar(tesouraria, "select public.registrar_pagamento_inscricao($1, current_date, 'Dinheiro')", [i2.id])
      await conciliarInscricoes()
      const o = await um<{ origem: string; origem_texto: string; origem_link: string }>(
        'select v.origem, v.origem_texto, v.origem_link from public.vw_lancamentos v join public.evento_inscricoes i on i.lancamento_id = v.id where i.id = $1',
        [i1.id],
      )
      assert.deepEqual(o, { origem: 'inscricao_evento', origem_texto: 'Inscrição nº 1 — Seminário de Liderança (blindagem)', origem_link: `/eventos/${evento}` })
      // marcar paga sem o lançamento
      await chamar(null, "select public.inscrever_no_evento($1, 'Visitante Três', '94999990103', null, true)", [evento])
      const i3 = await um<{ id: string }>('select id from public.evento_inscricoes where evento_id = $1 and numero = 3', [evento])
      await assert.rejects(db.query("update public.evento_inscricoes set pago_em = current_date, situacao = 'confirmada' where id = $1", [i3.id]), erroComCodigo(REGRA_DA_TABELA))
    })

    it('cancelar a inscrição paga estorna o lançamento (só a tesouraria ou a presidência, com o motivo)', async () => {
      const i2 = await um<{ id: string; lancamento_id: string }>('select id, lancamento_id from public.evento_inscricoes where evento_id = $1 and numero = 2', [evento])
      await assert.rejects(chamar(secretaria, "select public.cancelar_inscricao($1, 'Desistiu')", [i2.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(tesouraria, "select public.cancelar_inscricao($1, '')", [i2.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(tesouraria, "select public.cancelar_inscricao($1, 'Desistiu antes do evento: devolvido em dinheiro')", [i2.id])
      const depois = await um<{ situacao: string; pago_em: string | null; lancamento_id: string | null }>('select situacao, pago_em, lancamento_id from public.evento_inscricoes where id = $1', [i2.id])
      assert.deepEqual(depois, { situacao: 'cancelada', pago_em: null, lancamento_id: null })
      const l = await um<{ situacao: string; motivo: string }>('select situacao, motivo from public.lancamentos where id = $1', [i2.lancamento_id])
      assert.equal(l.situacao, 'cancelado')
      assert.match(l.motivo, /^Estorno da inscrição nº 2: /)
      await conciliarInscricoes()
    })

    it('o evento lança a própria receita e a própria despesa (a despesa espera o presidente, só com o orçamento aprovado)', async () => {
      const receita = (await chamar(tesouraria, "select public.lancar_no_evento($1, $2, 'entrada', $3, current_date, 200, 'Patrocínio da gráfica', null) as id", [evento, banco, ofertas]))
        .rows[0] as { id: string }
      await assert.rejects(
        chamar(tesouraria, "select public.lancar_no_evento($1, $2, 'saida', $3, current_date, 150, 'Som do seminário', null)", [evento, banco, material]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(secretaria, "select public.lancar_no_evento($1, $2, 'entrada', $3, current_date, 10, 'Oferta', null)", [evento, banco, ofertas]), erroComCodigo(SEM_PERMISSAO))
      // o orçamento aprovado pela assembleia (o cenário vem direto do dono do banco: a aprovação é testada em eventos.test.ts)
      const encontro = (await um<{ id: string }>("insert into public.encontros (tipo, titulo, inicio, local) values ('age', 'AGE do orçamento', now() - interval '1 day', 'Sede') returning id")).id
      await db.query('update public.eventos set orcamento_encontro_id = $2, orcamento_aprovado_em = now() where id = $1', [evento, encontro])
      const despesa = (await chamar(tesouraria, "select public.lancar_no_evento($1, $2, 'saida', $3, current_date, 150, 'Som do seminário', null) as id", [evento, banco, material]))
        .rows[0] as { id: string }
      const d = await um<{ situacao: string; evento_id: string; origem: string }>('select situacao, evento_id, origem from public.vw_lancamentos where id = $1', [despesa.id])
      assert.deepEqual(d, { situacao: 'aguardando_autorizacao', evento_id: evento, origem: 'evento' })
      await chamar(presidencia, 'select public.autorizar_despesa($1, true, null)', [despesa.id])
      const f = (await chamar(tesouraria, 'select public.financas_do_evento($1) as f', [evento])).rows[0] as { f: { receitas: number; despesas: number } }
      // receitas: a inscrição paga (30) e o patrocínio (200); despesas: o som (150)
      assert.equal(Number(f.f.receitas), 230)
      assert.equal(Number(f.f.despesas), 150)
      assert.equal((await um<{ origem: string }>('select origem from public.vw_lancamentos where id = $1', [receita.id])).origem, 'evento')
    })
  })

  describe('o modelo exclusivo da credencial', () => {
    it('pago sempre com a entrada no caixa; desfazer estorna; a tabela recusa pago sem lançamento', async () => {
      const denominacao = (await um<{ id: string }>("insert into public.denominacoes (nome) values ('Denominação Fictícia') returning id")).id
      const igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Batista Fictícia', $1) returning id", [denominacao])).id
      const modelo = (
        (await chamar(secretaria, 'select public.salvar_modelo(null, $1::jsonb) as id', [JSON.stringify({ nome: 'Exclusivo fictício', tipo: 'exclusivo', igreja_id: igreja, valor: 300 })]))
          .rows[0] as { id: string }
      ).id
      await assert.rejects(db.query('update public.credencial_modelos set exclusivo_pago_em = current_date where id = $1', [modelo]), erroComCodigo(REGRA_DA_TABELA))
      await assert.rejects(chamar(secretaria, "select public.receber_pagamento_exclusivo($1, current_date, 'PIX')", [modelo]), erroComCodigo(SEM_PERMISSAO))
      const lancamento = ((await chamar(tesouraria, "select public.receber_pagamento_exclusivo($1, current_date, 'PIX') as id", [modelo])).rows[0] as { id: string }).id
      const o = await um<{ origem: string; origem_texto: string; valor: string }>('select origem, origem_texto, valor::text from public.vw_lancamentos where id = $1', [lancamento])
      assert.deepEqual(o, { origem: 'modelo_exclusivo', origem_texto: 'Modelo exclusivo da credencial — Igreja Batista Fictícia', valor: '300.00' })
      await conciliarExclusivos()
      await assert.rejects(chamar(tesouraria, "select public.receber_pagamento_exclusivo($1, current_date, 'PIX')", [modelo]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(tesouraria, "select public.desfazer_pagamento_exclusivo($1, 'A igreja desistiu')", [modelo])
      const m = await um<{ pago: string | null; l: string | null }>('select exclusivo_pago_em as pago, exclusivo_lancamento_id as l from public.credencial_modelos where id = $1', [modelo])
      assert.deepEqual(m, { pago: null, l: null })
      assert.equal((await um<{ s: string }>('select situacao as s from public.lancamentos where id = $1', [lancamento])).s, 'cancelado')
      await conciliarExclusivos()
    })
  })

  describe('as transferências e o avulso', () => {
    it('a transferência são duas pernas ligadas (cancelar uma cancela as duas); o lançado no Caixa é "avulso"', async () => {
      await chamar(tesouraria, "select public.transferir($1, $2, current_date, 40, 'Depósito do dinheiro do caixa')", [caixa, banco])
      const pernas = (await db.query<{ id: string; origem: string }>("select id, origem from public.vw_lancamentos where descricao = 'Depósito do dinheiro do caixa'")).rows
      assert.equal(pernas.length, 2)
      assert.ok(pernas.every((p) => p.origem === 'transferencia'))
      await chamar(presidencia2, "select public.cancelar_lancamento($1, 'Depósito não feito')", [pernas[0].id])
      assert.equal(await numero("select count(*) as n from public.lancamentos where descricao = 'Depósito do dinheiro do caixa' and situacao = 'cancelado'"), 2)
      const avulso = ((await chamar(tesouraria, "select public.lancar($1, 'entrada', $2, current_date, 12, 'Oferta avulsa', null) as id", [banco, ofertas])).rows[0] as { id: string }).id
      assert.deepEqual(await um('select origem, origem_texto, origem_link from public.vw_lancamentos where id = $1', [avulso]), {
        origem: 'avulso',
        origem_texto: 'Lançado no Caixa',
        origem_link: null,
      })
    })

    it('no fim, tudo concilia', async () => {
      await conciliarContribuicoes()
      await conciliarInscricoes()
      await conciliarExclusivos()
    })
  })
})
