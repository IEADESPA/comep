// Fase 5.5.1: patrimônio e empréstimo às igrejas — os bens, o pedido com o termo de compromisso, a agenda,
// a aprovação, a retirada, a devolução (o que falta vira baixa) e quem vê o quê. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.5.1 — patrimônio e empréstimo às igrejas', () => {
  let db: PGlite
  let secretaria: string
  let tesouraria: string
  let presidencia: string
  let fiscal: string
  let pastorA: string
  let pastorB: string
  let ministroA: string
  let semPerfil: string
  let igrejaA: string
  let igrejaB: string
  let cadeiras: string
  let caixaSom: string
  let evento: string
  const pessoa: Record<string, string> = {}

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const dia = (dias: number) => {
    const d = new Date(Date.now() + dias * 86_400_000)
    return d.toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  }

  async function associar(usuario: string, igreja: string, presidente: boolean) {
    const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])
    pessoa[usuario] = p.id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.id])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [p.id, igreja, presidente])
  }
  const salvarItem = (quem: string, id: string | null, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.salvar_item_patrimonio($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )
  const pedir = (quem: string, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.pedir_emprestimo($1::jsonb) as id', [JSON.stringify(dados)]).then((r) => (r.rows[0] as { id: string }).id)
  const pedidoDaIgreja = (igreja: string, de: number, ate: number, itens: { item_id: string; quantidade: number }[], aceite = true) => ({
    igreja_id: igreja,
    retirada: dia(de),
    devolucao: dia(ate),
    finalidade: 'Culto de aniversário da igreja',
    aceite,
    itens,
  })
  const decidir = (quem: string, id: string, aprovar: boolean, motivo: string | null = null) =>
    chamar(quem, 'select public.decidir_emprestimo($1, $2, $3)', [id, aprovar, motivo])
  const situacao = async (id: string) => (await um<{ s: string }>('select situacao::text as s from public.emprestimos where id = $1', [id])).s
  const quantidade = async (item: string) => (await um<{ q: number }>('select quantidade as q from public.patrimonio_itens where id = $1', [item])).q

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    fiscal = await criarUsuario(db, 'fiscal@teste.local', 'Conselho Fiscal de Teste')
    semPerfil = await criarUsuario(db, 'site@teste.local', 'Conta do Site')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, tesouraria, 'tesouraria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, fiscal, 'conselho_fiscal')
    igrejaA = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")).id
    igrejaB = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja B') returning id")).id
    pastorA = await criarUsuario(db, 'pa@teste.local', 'Pastor Presidente A')
    pastorB = await criarUsuario(db, 'pb@teste.local', 'Pastor Presidente B')
    ministroA = await criarUsuario(db, 'ma@teste.local', 'Ministro A')
    await associar(pastorA, igrejaA, true)
    await associar(pastorB, igrejaB, true)
    await associar(ministroA, igrejaA, false)
    evento = (
      await um<{ id: string }>("insert into public.eventos (titulo, inicio, situacao) values ('Congresso de Teste', now() + interval '20 days', 'publicado') returning id")
    ).id
  })

  describe('os bens', () => {
    it('a secretaria cadastra; o ministro e o pastor presidente não', async () => {
      cadeiras = await salvarItem(secretaria, null, { nome: 'Cadeira plástica branca', categoria: 'Mobiliário', quantidade: 100, forma_aquisicao: 'compra' })
      caixaSom = await salvarItem(tesouraria, null, { nome: 'Caixa de som ativa', quantidade: 2, forma_aquisicao: 'doacao' })
      await assert.rejects(salvarItem(ministroA, null, { nome: 'Palco', quantidade: 1 }), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(salvarItem(pastorA, null, { nome: 'Palco', quantidade: 1 }), erroComCodigo(SEM_PERMISSAO))
    })

    it('nome repetido, quantidade zero, data futura ou forma de aquisição inválida: recusado', async () => {
      await assert.rejects(salvarItem(secretaria, null, { nome: 'cadeira plástica BRANCA ', quantidade: 5 }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvarItem(secretaria, null, { nome: 'Mesa', quantidade: 0 }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvarItem(secretaria, null, { nome: 'Mesa', quantidade: 1, adquirido_em: dia(5) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvarItem(secretaria, null, { nome: 'Mesa', quantidade: 1, forma_aquisicao: 'achado' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('editar não muda a quantidade; ela entra com "acrescentar" (com a origem)', async () => {
      await salvarItem(secretaria, cadeiras, { nome: 'Cadeira plástica branca', quantidade: 999, local_guarda: 'Depósito da sede' })
      assert.equal(await quantidade(cadeiras), 100)
      await assert.rejects(chamar(secretaria, "select public.acrescentar_item_patrimonio($1, 10, '')", [cadeiras]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(ministroA, "select public.acrescentar_item_patrimonio($1, 10, 'Doação')", [cadeiras]), erroComCodigo(SEM_PERMISSAO))
      await chamar(secretaria, "select public.acrescentar_item_patrimonio($1, 20, 'Doação da Igreja B')", [cadeiras])
      assert.equal(await quantidade(cadeiras), 120)
    })

    it('quem é do COMEP vê os bens; a conta só do site não', async () => {
      assert.equal((await chamar(ministroA, 'select id from public.patrimonio_itens')).rows.length, 2)
      assert.equal((await chamar(semPerfil, 'select id from public.patrimonio_itens')).rows.length, 0)
    })

    it('a compra no caixa: a tesouraria liga a uma saída; a secretaria não; uma entrada não serve', async () => {
      const conta = await um<{ id: string }>('select conta_banco_id as id from public.config_financeiro')
      const categoria = await um<{ id: string }>("select id from public.categorias_financeiras where tipo = 'saida' and sistema is null limit 1")
      const compra = await um<{ id: string }>(
        `insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao)
         values ($1, 'saida', $2, current_date, 1200, 'Compra de cadeiras', 'efetivado') returning id`,
        [conta.id, categoria.id],
      )
      const categoriaEntrada = await um<{ id: string }>("select id from public.categorias_financeiras where tipo = 'entrada' and sistema is null limit 1")
      const entrada = await um<{ id: string }>(
        `insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao)
         values ($1, 'entrada', $2, current_date, 50, 'Oferta', 'efetivado') returning id`,
        [conta.id, categoriaEntrada.id],
      )
      await assert.rejects(chamar(secretaria, 'select public.ligar_compra_patrimonio($1, $2)', [cadeiras, compra.id]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(tesouraria, 'select public.ligar_compra_patrimonio($1, $2)', [cadeiras, entrada.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(tesouraria, 'select public.ligar_compra_patrimonio($1, $2)', [cadeiras, compra.id])
      const i = await um<{ l: string }>('select lancamento_id as l from public.patrimonio_itens where id = $1', [cadeiras])
      assert.equal(i.l, compra.id)
    })
  })

  describe('as regras (presidência)', () => {
    it('a presidência muda as regras; a secretaria não', async () => {
      await chamar(secretaria, 'update public.config_patrimonio set prazo_maximo_dias = 30 where id')
      assert.equal((await um<{ p: number }>('select prazo_maximo_dias as p from public.config_patrimonio')).p, 7)
      await chamar(presidencia, 'update public.config_patrimonio set prazo_maximo_dias = 5 where id')
      assert.equal((await um<{ p: number }>('select prazo_maximo_dias as p from public.config_patrimonio')).p, 5)
    })
  })

  describe('o pedido da igreja', () => {
    it('as igrejas do pedido: o pastor vê só a dele; a equipe vê todas, com o peso (ministros associados)', async () => {
      const igrejas = async (quem: string) =>
        ((await chamar(quem, 'select public.igrejas_do_pedido() as i')).rows[0] as { i: { id: string; ministros: number }[] }).i
      assert.deepEqual(
        (await igrejas(pastorA)).map((i) => [i.id, i.ministros]),
        [[igrejaA, 2]],
      )
      assert.equal((await igrejas(secretaria)).length, 2)
      assert.deepEqual(await igrejas(ministroA), [])
      await assert.rejects(chamar(semPerfil, 'select public.igrejas_do_pedido()'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o pastor presidente pede para a própria igreja, aceitando o termo (o texto fica guardado no pedido)', async () => {
      const id = await pedir(pastorA, pedidoDaIgreja(igrejaA, 5, 6, [{ item_id: cadeiras, quantidade: 60 }]))
      const e = await um<{ s: string; termo: string; aceite: boolean }>(
        'select situacao::text as s, termo_texto as termo, termo_aceito_em is not null as aceite from public.emprestimos where id = $1',
        [id],
      )
      assert.equal(e.s, 'solicitado')
      assert.match(e.termo, /me comprometo/)
      assert.equal(e.aceite, true)
    })

    it('sem aceitar o termo, para outra igreja ou pelo ministro que não preside: recusado', async () => {
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaA, 5, 6, [{ item_id: cadeiras, quantidade: 1 }], false)), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaB, 5, 6, [{ item_id: cadeiras, quantidade: 1 }])), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(pedir(ministroA, pedidoDaIgreja(igrejaA, 5, 6, [{ item_id: cadeiras, quantidade: 1 }])), erroComCodigo(SEM_PERMISSAO))
    })

    it('antecedência mínima, prazo máximo, data passada e mais do que o COMEP tem: recusado', async () => {
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaA, 1, 2, [{ item_id: cadeiras, quantidade: 1 }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaA, 5, 12, [{ item_id: cadeiras, quantidade: 1 }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaA, 6, 5, [{ item_id: cadeiras, quantidade: 1 }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaA, 5, 6, [{ item_id: cadeiras, quantidade: 121 }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(pedir(pastorA, pedidoDaIgreja(igrejaA, 5, 6, [])), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a equipe pede em nome da igreja mesmo em cima da hora (sem a antecedência)', async () => {
      const id = await pedir(secretaria, pedidoDaIgreja(igrejaB, 1, 1, [{ item_id: caixaSom, quantidade: 1 }]))
      assert.equal(await situacao(id), 'solicitado')
      await chamar(secretaria, "select public.cancelar_emprestimo($1, 'Pedido de teste')", [id])
    })

    it('em atraso com a contribuição não pede (regra configurável)', async () => {
      await db.query(
        `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
         values ($1, 2025, 'mensal', '2025-05-01', '2025-05-10', 'nao_presidente', 20) returning id`,
        [pessoa[pastorB]],
      )
      await assert.rejects(pedir(pastorB, pedidoDaIgreja(igrejaB, 5, 6, [{ item_id: cadeiras, quantidade: 10 }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidencia, 'update public.config_patrimonio set exige_em_dia = false where id')
      const id = await pedir(pastorB, pedidoDaIgreja(igrejaB, 5, 6, [{ item_id: cadeiras, quantidade: 10 }]))
      await chamar(pastorB, "select public.cancelar_emprestimo($1, 'Mudou o culto')", [id])
      await chamar(presidencia, 'update public.config_patrimonio set exige_em_dia = true where id')
      await db.query("update public.cobrancas set situacao = 'cancelada' where pessoa_id = $1", [pessoa[pastorB]])
    })
  })

  describe('a agenda e a aprovação', () => {
    let primeiro: string
    let conflito: string

    it('dois pedidos no mesmo período: o primeiro aprovado segura as cadeiras; o segundo não passa', async () => {
      primeiro = (await um<{ id: string }>("select id from public.emprestimos where igreja_id = $1 and situacao = 'solicitado'", [igrejaA])).id
      conflito = await pedir(pastorB, pedidoDaIgreja(igrejaB, 6, 7, [{ item_id: cadeiras, quantidade: 70 }]))
      await decidir(secretaria, primeiro, true)
      assert.equal(await situacao(primeiro), 'aprovado')
      await assert.rejects(decidir(secretaria, conflito, true), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // e o pedido novo já avisa que não há o suficiente
      await assert.rejects(pedir(pastorB, pedidoDaIgreja(igrejaB, 6, 6, [{ item_id: cadeiras, quantidade: 61 }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('fora do período, o mesmo tanto está livre', async () => {
      const depois = await pedir(pastorB, pedidoDaIgreja(igrejaB, 8, 9, [{ item_id: cadeiras, quantidade: 120 }]))
      await decidir(presidencia, depois, true)
      assert.equal(await situacao(depois), 'aprovado')
      const livres = await chamar(ministroA, 'select public.livres_no_periodo($1::date, $2::date) as l', [dia(5), dia(6)])
      const l = (livres.rows[0] as { l: { item_id: string; livre: number }[] }).l
      assert.equal(l.find((x) => x.item_id === cadeiras)?.livre, 60)
      await chamar(pastorB, "select public.cancelar_emprestimo($1, 'Não vai mais precisar')", [depois])
    })

    it('só a secretaria ou a presidência aprovam; recusar pede o motivo', async () => {
      await assert.rejects(decidir(pastorB, conflito, false, 'x'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(decidir(tesouraria, conflito, false, 'x'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(decidir(secretaria, conflito, false), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await decidir(secretaria, conflito, false, 'As cadeiras já estão com a Igreja A nesse dia.')
      assert.equal(await situacao(conflito), 'recusado')
      await assert.rejects(decidir(secretaria, conflito, true), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a reserva para o evento do COMEP já entra aprovada e conta na agenda; o pastor não reserva', async () => {
      const dados = { evento_id: evento, retirada: dia(5), devolucao: dia(5), finalidade: 'Som do congresso', itens: [{ item_id: caixaSom, quantidade: 2 }] }
      await assert.rejects(pedir(pastorA, dados), erroComCodigo(SEM_PERMISSAO))
      const reserva = await pedir(secretaria, dados)
      assert.equal(await situacao(reserva), 'aprovado')
      const agenda = await chamar(ministroA, 'select public.agenda_patrimonio($1::date, $2::date) as a', [dia(0), dia(30)])
      const a = (agenda.rows[0] as { a: { quem: string }[] }).a
      assert.deepEqual(a.map((x) => x.quem).sort(), ['COMEP: Congresso de Teste', 'Igreja A'])
      await assert.rejects(chamar(semPerfil, 'select public.agenda_patrimonio($1::date, $2::date)', [dia(0), dia(30)]), erroComCodigo(SEM_PERMISSAO))
    })

    it('quem vê: o pastor vê os pedidos da sua igreja; o outro pastor não; o Conselho Fiscal vê todos', async () => {
      const ver = async (quem: string) => (await chamar(quem, 'select igreja_id from public.emprestimos where igreja_id = $1', [igrejaA])).rows.length
      assert.equal(await ver(pastorA), 1)
      assert.equal(await ver(pastorB), 0)
      assert.equal(await ver(fiscal), 1)
      assert.equal(await ver(ministroA), 0)
      const itens = async (quem: string) => (await chamar(quem, 'select id from public.emprestimo_itens where emprestimo_id = $1', [primeiro])).rows.length
      assert.equal(await itens(pastorA), 1)
      assert.equal(await itens(pastorB), 0)
    })
  })

  describe('retirada, devolução e baixa', () => {
    let emprestimo: string

    it('a retirada pede o nome de quem levou; o pastor não registra; depois não se cancela', async () => {
      emprestimo = (await um<{ id: string }>("select id from public.emprestimos where igreja_id = $1 and situacao = 'aprovado'", [igrejaA])).id
      await assert.rejects(chamar(pastorA, "select public.registrar_retirada($1, 'Diácono Fulano')", [emprestimo]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(secretaria, "select public.registrar_retirada($1, '')", [emprestimo]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, "select public.registrar_retirada($1, 'Diácono Fulano de Tal')", [emprestimo])
      assert.equal(await situacao(emprestimo), 'retirado')
      await assert.rejects(chamar(pastorA, "select public.cancelar_emprestimo($1, 'x')", [emprestimo]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('enquanto as cadeiras estão fora, a baixa só alcança as que estão no depósito', async () => {
      await assert.rejects(chamar(secretaria, "select public.baixar_item_patrimonio($1, 61, 'Quebraram', null)", [cadeiras]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(ministroA, "select public.baixar_item_patrimonio($1, 1, 'Quebrou', null)", [cadeiras]), erroComCodigo(SEM_PERMISSAO))
      await chamar(secretaria, "select public.baixar_item_patrimonio($1, 1, 'Quebrou no depósito', null)", [cadeiras])
      assert.equal(await quantidade(cadeiras), 119)
    })

    it('voltaram 58 de 60: sem dizer o que houve, recusado; com a observação, as 2 saem do patrimônio (baixa ligada ao empréstimo)', async () => {
      const itens = JSON.stringify([{ item_id: cadeiras, devolvida: 58 }])
      await assert.rejects(chamar(secretaria, 'select public.registrar_devolucao($1, $2::jsonb, null)', [emprestimo, itens]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        chamar(secretaria, 'select public.registrar_devolucao($1, $2::jsonb, null)', [emprestimo, JSON.stringify([{ item_id: cadeiras, devolvida: 61 }])]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secretaria, "select public.registrar_devolucao($1, $2::jsonb, 'Duas quebraram no culto; a igreja vai repor.')", [emprestimo, itens])
      assert.equal(await situacao(emprestimo), 'devolvido')
      assert.equal(await quantidade(cadeiras), 117)
      const b = await um<{ q: number; e: string }>(
        'select quantidade as q, emprestimo_id as e from public.patrimonio_baixas where item_id = $1 and emprestimo_id is not null',
        [cadeiras],
      )
      assert.deepEqual(b, { q: 2, e: emprestimo })
    })

    it('as baixas: a equipe e o Conselho Fiscal veem; o pastor não', async () => {
      assert.equal((await chamar(fiscal, 'select id from public.patrimonio_baixas')).rows.length, 2)
      assert.equal((await chamar(pastorA, 'select id from public.patrimonio_baixas')).rows.length, 0)
    })
  })
})
