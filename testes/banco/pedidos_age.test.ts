// Fase 5.5.3: pedido de Assembleia Extraordinária on-line (Art. 16, §3º) — abrir o pedido com a pauta, assinar,
// retirar a assinatura, a meta (3/5 dos aptos ou a maioria simples do Conselho Diretor), o prazo, cancelar e marcar a
// AGE a partir do pedido. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Conta = {
  assinaturas: number
  aptos: number
  assinaturas_aptas: number
  minimo_associados: number
  diretoria: number
  assinaturas_diretoria: number
  minimo_diretoria: number
}
type Detalhe = {
  situacao: string
  atingido_por: string | null
  expirado: boolean
  eu_assinei: boolean
  posso_assinar: boolean
  conta: Conta
  assinaturas: { nome: string; conta: boolean; diretoria: boolean }[]
  encontro_id: string | null
}

describe('Fase 5.5.3 — pedido de AGE on-line', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let semPerfil: string
  const m: string[] = []
  const p: string[] = []
  let pedidoA: string
  let pedidoB: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const pauta = [{ titulo: 'Reforma do estatuto', descricao: 'Permitir a votação on-line' }]
  const criar = (quem: string, dados: Record<string, unknown> = {}) =>
    chamar(quem, 'select public.criar_pedido_age($1::jsonb) as id', [
      JSON.stringify({ titulo: 'Reforma do estatuto', justificativa: 'O estatuto precisa prever a votação on-line.', pauta, ...dados }),
    ]).then((r) => (r.rows[0] as { id: string }).id)
  const assinar = (quem: string, id: string) => chamar(quem, 'select public.assinar_pedido_age($1)', [id])
  const detalhe = (quem: string, id: string) =>
    chamar(quem, 'select public.detalhe_pedido_age($1) as d', [id]).then((r) => (r.rows[0] as { d: Detalhe }).d)

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Antes')
    semPerfil = await criarUsuario(db, 'site@teste.local', 'Conta do Site')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    for (let i = 1; i <= 6; i++) {
      m.push(await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`))
      const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [m[i - 1]])
      p.push(r.rows[0].id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [r.rows[0].id])
    }
    // o 6º está em atraso: não é apto
    await db.query(
      `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
       values ($1, 2025, 'mensal', '2025-05-01', '2025-05-10', 'nao_presidente', 20)`,
      [p[5]],
    )
    // Conselho Diretor: 1, 2 e 3 (o 5 é do Conselho Fiscal, que não conta)
    await chamar(
      presidencia,
      `select public.registrar_diretoria(jsonb_build_object('inicio', current_date - 10, 'fim', current_date + 1450, 'encontro_id', null,
         'documento', 'Ata da eleição (teste)', 'membros', $1::jsonb))`,
      [
        JSON.stringify([
          { cargo: 'presidente', pessoa_id: p[0] },
          { cargo: 'vice_presidente', pessoa_id: p[1] },
          { cargo: 'primeiro_secretario', pessoa_id: p[2] },
          { cargo: 'conselheiro_fiscal', pessoa_id: p[4] },
        ]),
      ],
    )
  })

  describe('abrir o pedido', () => {
    it('quem está em atraso, ou não é associado, não abre; sem a pauta ou sem a justificativa, recusado', async () => {
      await assert.rejects(criar(m[5]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(criar(secretaria), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(criar(m[3], { pauta: [] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(criar(m[3], { pauta: [{ titulo: '  ' }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(criar(m[3], { justificativa: 'curta' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('o associado em dia abre e já assina; a conta: 3/5 de 5 aptos = 3; maioria do Conselho Diretor (3) = 2', async () => {
      pedidoA = await criar(m[3])
      const d = await detalhe(m[0], pedidoA)
      assert.equal(d.situacao, 'coletando')
      assert.deepEqual(d.conta, {
        assinaturas: 1,
        aptos: 5,
        assinaturas_aptas: 1,
        minimo_associados: 3,
        diretoria: 3,
        assinaturas_diretoria: 0,
        minimo_diretoria: 2,
      })
      assert.equal(d.posso_assinar, true)
      assert.equal(d.eu_assinei, false)
      assert.equal((await detalhe(m[3], pedidoA)).eu_assinei, true)
    })
  })

  describe('assinar e a meta', () => {
    it('em atraso ou sem ser associado não assina; ninguém assina duas vezes; retirar e assinar de novo', async () => {
      await assert.rejects(assinar(m[5], pedidoA), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(assinar(secretaria, pedidoA), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(assinar(m[3], pedidoA), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assinar(m[4], pedidoA)
      await chamar(m[4], 'select public.retirar_assinatura_age($1)', [pedidoA])
      assert.equal((await detalhe(m[4], pedidoA)).conta.assinaturas, 1)
      await assert.rejects(chamar(m[4], 'select public.retirar_assinatura_age($1)', [pedidoA]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assinar(m[4], pedidoA)
      assert.equal((await detalhe(m[4], pedidoA)).situacao, 'coletando')
    })

    it('a 3ª assinatura apta atinge os 3/5: o pedido fica atingido (pelos associados) e não muda mais', async () => {
      await assinar(m[2], pedidoA)
      const d = await detalhe(m[0], pedidoA)
      assert.equal(d.situacao, 'atingido')
      assert.equal(d.atingido_por, 'associados')
      assert.equal(d.conta.assinaturas_aptas, 3)
      assert.equal(d.posso_assinar, false)
      await assert.rejects(assinar(m[0], pedidoA), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(m[4], 'select public.retirar_assinatura_age($1)', [pedidoA]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(m[3], "select public.cancelar_pedido_age($1, 'Mudei de ideia')", [pedidoA]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a maioria simples do Conselho Diretor também basta: 2 de 3', async () => {
      pedidoB = await criar(m[0], { titulo: 'Compra de um terreno' })
      assert.equal((await detalhe(m[0], pedidoB)).situacao, 'coletando')
      await assinar(m[1], pedidoB)
      const d = await detalhe(m[0], pedidoB)
      assert.equal(d.situacao, 'atingido')
      assert.equal(d.atingido_por, 'diretoria')
      assert.deepEqual(
        d.assinaturas.map((a) => [a.nome, a.diretoria]),
        [
          ['Associado 1', true],
          ['Associado 2', true],
        ],
      )
    })
  })

  describe('prazo, cancelamento e quem vê', () => {
    it('passado o prazo, ninguém mais assina', async () => {
      const c = await criar(m[4], { titulo: 'Pedido que venceu' })
      await db.query("update public.pedidos_age set prazo = current_date - 1 where id = $1", [c])
      await assert.rejects(assinar(m[3], c), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const d = await detalhe(m[3], c)
      assert.equal(d.expirado, true)
      assert.equal(d.posso_assinar, false)
    })

    it('só quem abriu cancela, com o motivo', async () => {
      const c = await criar(m[4], { titulo: 'Pedido cancelado' })
      await assert.rejects(chamar(m[3], "select public.cancelar_pedido_age($1, 'Não quero')", [c]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(m[4], "select public.cancelar_pedido_age($1, '')", [c]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(m[4], "select public.cancelar_pedido_age($1, 'Resolvido na reunião mensal')", [c])
      assert.equal((await detalhe(m[4], c)).situacao, 'cancelado')
      await assert.rejects(assinar(m[3], c), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('quem é do COMEP vê os pedidos e as assinaturas; a conta só do site, não', async () => {
      assert.ok((await chamar(m[5], 'select id from public.pedido_age_assinaturas')).rows.length > 0)
      assert.equal((await chamar(semPerfil, 'select id from public.pedidos_age')).rows.length, 0)
      await assert.rejects(chamar(semPerfil, 'select public.listar_pedidos_age()'), erroComCodigo(SEM_PERMISSAO))
    })
  })

  describe('marcar a AGE a partir do pedido', () => {
    const marcar = (quem: string, id: string) =>
      chamar(quem, "select public.marcar_age_do_pedido($1, jsonb_build_object('inicio', (now() + interval '40 days')::text, 'local', 'Sede')) as id", [
        id,
      ]).then((r) => (r.rows[0] as { id: string }).id)

    it('o associado não marca; um pedido que ainda colhe assinaturas não vira AGE', async () => {
      await assert.rejects(marcar(m[3], pedidoA), erroComCodigo(SEM_PERMISSAO))
      const c = await criar(m[4], { titulo: 'Ainda colhendo' })
      await assert.rejects(marcar(secretaria, c), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a presidência marca: a AGE nasce em preparo, com a pauta do pedido e o "quem pediu" preenchido; o pedido fica atendido', async () => {
      const encontro = await marcar(presidencia, pedidoA)
      const e = (
        await db.query<{ tipo: string; situacao: string; fundamento: string; itens: number }>(
          `select e.tipo::text, e.situacao::text, e.fundamento,
                  (select count(*)::int from public.encontro_pauta i where i.encontro_id = e.id and i.arquivado_em is null and i.deliberativo) as itens
           from public.encontros e where e.id = $1`,
          [encontro],
        )
      ).rows[0]
      assert.equal(e.tipo, 'age')
      assert.equal(e.situacao, 'agendado')
      assert.equal(e.itens, 1)
      assert.match(e.fundamento, /^Pedido de 3\/5 dos associados \(Art\. 16, §3º\), feito no sistema: 3 assinaturas de associados em dia, de 5 aptos \(mínimo 3\)/)
      const d = await detalhe(m[3], pedidoA)
      assert.equal(d.situacao, 'atendido')
      assert.equal(d.encontro_id, encontro)
      await assert.rejects(marcar(presidencia, pedidoA), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a conta vale para HOJE: quem assinou e caiu em atraso deixa de contar', async () => {
      const c = await criar(m[3], { titulo: 'Pedido do associado 4' })
      await db.query(
        `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
         values ($1, 2025, 'mensal', '2025-06-01', '2025-06-10', 'nao_presidente', 20)`,
        [p[3]],
      )
      const d = await detalhe(m[0], c)
      assert.equal(d.conta.assinaturas, 1)
      assert.equal(d.conta.assinaturas_aptas, 0)
      assert.equal(d.conta.aptos, 4)
      assert.deepEqual(
        d.assinaturas.map((a) => a.conta),
        [false],
      )
    })
  })
})
