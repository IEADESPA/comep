// Taxa de inscrição: isenta hoje; quando a assembleia definir um valor, é cobrada uma vez de quem
// for admitido pela assembleia. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'

describe('Taxa de inscrição', () => {
  let db: PGlite
  let tesoureiro: string
  let ministro: string
  let igreja: string

  /** Pessoa nova admitida (pela assembleia, hoje, ou no cadastro inicial). */
  async function admitir(nome: string, forma: 'assembleia' | 'cadastro_inicial', jubilado = false): Promise<string> {
    const p = await db.query<{ id: string }>('insert into public.pessoas (nome) values ($1) returning id', [nome])
    const pessoa = p.rows[0].id
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoa, igreja])
    await db.query(
      `insert into public.associados (pessoa_id, forma_admissao, admitido_em, assembleia_data, assembleia_ata, jubilado)
       values ($1, $2::public.forma_admissao, current_date, case when $2::text = 'assembleia' then current_date end,
               case when $2::text = 'assembleia' then 'Ata de teste' end, $3)`,
      [pessoa, forma, jubilado],
    )
    return pessoa
  }

  async function taxasDe(pessoa: string) {
    const r = await db.query<{ id: string; valor: string; prazo: number; situacao: string }>(
      `select id, valor::text, (vencimento - competencia) as prazo, situacao::text
       from public.cobrancas where pessoa_id = $1 and tipo = 'inscricao'`,
      [pessoa],
    )
    return r.rows
  }

  before(async () => {
    db = await criarBanco()
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, tesoureiro, 'tesouraria')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
    igreja = i.rows[0].id
  })

  it('hoje é isenta: R$ 0,00 em todas as categorias, e a admissão não gera cobrança', async () => {
    const v = await db.query<{ categoria: string; valor: string }>(
      "select categoria::text, valor::text from public.vw_valores_vigentes where tipo = 'inscricao' order by 1",
    )
    assert.deepEqual(v.rows, [
      { categoria: 'jubilado', valor: '0.00' },
      { categoria: 'nao_presidente', valor: '0.00' },
      { categoria: 'presidente_igreja', valor: '0.00' },
    ])
    const pessoa = await admitir('Admitido Isento', 'assembleia')
    assert.deepEqual(await taxasDe(pessoa), [])
  })

  it('o ministro não define a taxa', async () => {
    await assert.rejects(
      como(db, ministro, () => db.query("select public.definir_taxa_inscricao(50, current_date, null, null, 30)")),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  describe('com valor definido pela assembleia', () => {
    before(async () => {
      await como(db, tesoureiro, () =>
        db.query("select public.definir_taxa_inscricao(50, current_date - 1, current_date - 1, 'Ata 3/2026', 15)"),
      )
    })

    it('quem é admitido pela assembleia recebe uma cobrança, com o prazo configurado', async () => {
      const pessoa = await admitir('Admitido Pagante', 'assembleia')
      assert.deepEqual(
        (await taxasDe(pessoa)).map(({ valor, prazo, situacao }) => ({ valor, prazo, situacao })),
        [{ valor: '50.00', prazo: 15, situacao: 'aberta' }],
      )
      // gerar de novo não repete
      const r = await db.query<{ n: number }>('select interno.gerar_taxa_inscricao($1) as n', [pessoa])
      assert.equal(r.rows[0].n, 0)
    })

    it('cadastro inicial e jubilado não pagam', async () => {
      assert.deepEqual(await taxasDe(await admitir('Do Cadastro Inicial', 'cadastro_inicial')), [])
      assert.deepEqual(await taxasDe(await admitir('Jubilado Admitido', 'assembleia', true)), [])
    })

    it('pagar a taxa não trava o plano; o plano não cancela a taxa; no caixa, "taxa de inscrição"', async () => {
      const pessoa = await admitir('Admitido Plano', 'assembleia')
      const [taxa] = await taxasDe(pessoa)
      await como(db, tesoureiro, () =>
        db.query("select public.registrar_pagamento($1, current_date, 50, 'Dinheiro', null)", [taxa.id]),
      )
      await como(db, tesoureiro, () =>
        db.query("select public.escolher_plano($1, interno.exercicio_de(current_date), 'mensal')", [pessoa]),
      )
      assert.equal((await taxasDe(pessoa))[0].situacao, 'paga')
      const l = await db.query<{ descricao: string }>('select descricao from public.lancamentos where cobranca_id = $1', [
        taxa.id,
      ])
      assert.equal(l.rows[0].descricao, 'Contribuição de Admitido Plano — taxa de inscrição')
    })

    it('com as mensalidades já geradas, escolher o plano não cancela a taxa em aberto', async () => {
      const pessoa = await admitir('Admitido Em Aberto', 'assembleia')
      await como(db, tesoureiro, () => db.query('select public.gerar_cobrancas(interno.exercicio_de(current_date))'))
      await como(db, tesoureiro, () =>
        db.query("select public.escolher_plano($1, interno.exercicio_de(current_date), 'mensal')", [pessoa]),
      )
      assert.deepEqual(
        (await taxasDe(pessoa)).map((t) => t.situacao),
        ['aberta'],
      )
    })

    it('voltar a ser isenta: quem é admitido depois não paga', async () => {
      await como(db, tesoureiro, () =>
        db.query('select public.definir_taxa_inscricao(0, current_date, null, null, 30)'),
      )
      assert.deepEqual(await taxasDe(await admitir('Admitido Depois', 'assembleia')), [])
    })
  })
})
