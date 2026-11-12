// Testes da Fase 1.2 (parte 1): configurações, valores da contribuição,
// pastor presidente (perfil e categoria automáticos) e jubilado.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const DUPLICADO = '23505'

describe('Fase 1.2 — configurações e categorias', () => {
  let db: PGlite
  let presidente: string
  let secretaria: string
  let tesoureiro: string
  let administrador: string
  let ministro: string
  let igrejaA: string
  let igrejaB: string
  let tituloPastor: string

  async function perfisDe(pessoaId: string): Promise<string[]> {
    const r = await db.query<{ perfil: string }>(
      'select perfil from public.perfis_acesso where pessoa_id = $1 and arquivado_em is null order by perfil',
      [pessoaId],
    )
    return r.rows.map((l) => l.perfil)
  }

  async function categoriaDe(pessoaId: string): Promise<string> {
    const r = await db.query<{ categoria_contribuicao: string }>(
      'select categoria_contribuicao from public.vw_associados where pessoa_id = $1',
      [pessoaId],
    )
    return r.rows[0].categoria_contribuicao
  }

  async function cadastrar(nome: string, igrejaId: string, pastorPresidente: boolean, jubilado = false): Promise<string> {
    const r = await como(db, secretaria, () =>
      db.query<{ id: string }>(
        'select public.cadastrar_associado($1, null, null, $2, null, $3, null, null, null, null, $4, $5) as id',
        [nome, tituloPastor, igrejaId, pastorPresidente, jubilado],
      ),
    )
    return r.rows[0].id
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    administrador = await criarUsuario(db, 'admin@teste.local', 'Administrador de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, administrador, 'admin_tecnico')
    await darPerfil(db, ministro, 'ministro')

    const igrejas = await db.query<{ id: string }>(
      "insert into public.igrejas (nome) values ('Igreja A'), ('Igreja B') returning id",
    )
    igrejaA = igrejas.rows[0].id
    igrejaB = igrejas.rows[1].id
    const titulo = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
    tituloPastor = titulo.rows[0].id
  })

  describe('listas configuráveis', () => {
    it('secretaria e administrador técnico cadastram bairros; ministro e tesouraria não', async () => {
      for (const [usuario, nome] of [
        [secretaria, 'Cidade Jardim'],
        [administrador, 'Rio Verde'],
      ]) {
        const r = await como(db, usuario, () => db.query('insert into public.bairros (nome) values ($1)', [nome]))
        assert.equal(r.affectedRows, 1)
      }
      for (const usuario of [ministro, tesoureiro]) {
        await assert.rejects(
          como(db, usuario, () => db.query("insert into public.bairros (nome) values ('Indevido')")),
          erroComCodigo(SEM_PERMISSAO),
        )
      }
    })

    it('não aceita bairro repetido (ignorando maiúsculas)', async () => {
      await assert.rejects(
        como(db, secretaria, () => db.query("insert into public.bairros (nome) values ('cidade jardim')")),
        erroComCodigo(DUPLICADO),
      )
    })

    it('o administrador técnico também mantém denominações e títulos', async () => {
      const d = await como(db, administrador, () =>
        db.query("insert into public.denominacoes (nome) values ('Pentecostal')"),
      )
      assert.equal(d.affectedRows, 1)
      const t = await como(db, administrador, () =>
        db.query("insert into public.titulos_ministeriais (nome, ordem) values ('Apóstolo', 60)"),
      )
      assert.equal(t.affectedRows, 1)
    })

    it('a igreja usa o bairro da lista; o campo de texto antigo não se edita mais', async () => {
      const bairro = await db.query<{ id: string }>("select id from public.bairros where nome = 'Cidade Jardim'")
      const r = await como(db, secretaria, () =>
        db.query('update public.igrejas set bairro_id = $1 where id = $2', [bairro.rows[0].id, igrejaA]),
      )
      assert.equal(r.affectedRows, 1)
      await assert.rejects(
        como(db, secretaria, () => db.query("update public.igrejas set bairro = 'Texto' where id = $1", [igrejaA])),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('valores da contribuição', () => {
    it('vêm com os valores informados pela diretoria (taxa de inscrição isenta)', async () => {
      const r = await db.query<{ categoria: string; tipo: string; valor: string }>(
        'select categoria, tipo, valor::text from public.vw_valores_vigentes order by categoria, tipo',
      )
      assert.deepEqual(r.rows, [
        { categoria: 'presidente_igreja', tipo: 'mensal', valor: '40.00' },
        { categoria: 'presidente_igreja', tipo: 'anual', valor: '400.00' },
        { categoria: 'presidente_igreja', tipo: 'inscricao', valor: '0.00' },
        { categoria: 'nao_presidente', tipo: 'mensal', valor: '20.00' },
        { categoria: 'nao_presidente', tipo: 'anual', valor: '200.00' },
        { categoria: 'nao_presidente', tipo: 'inscricao', valor: '0.00' },
        { categoria: 'jubilado', tipo: 'mensal', valor: '0.00' },
        { categoria: 'jubilado', tipo: 'anual', valor: '0.00' },
        { categoria: 'jubilado', tipo: 'inscricao', valor: '0.00' },
      ])
    })

    it('a tesouraria lança um valor novo; o vigente passa a ser o mais recente já em vigor', async () => {
      await como(db, tesoureiro, () =>
        db.query(
          `insert into public.valores_contribuicao (categoria, tipo, valor, vigente_desde)
           values ('nao_presidente', 'mensal', 25, current_date), ('nao_presidente', 'mensal', 30, current_date + 30)`,
        ),
      )
      const r = await como(db, ministro, () =>
        db.query<{ valor: string }>(
          "select valor::text from public.vw_valores_vigentes where categoria = 'nao_presidente' and tipo = 'mensal'",
        ),
      )
      assert.equal(r.rows[0].valor, '25.00', 'o valor futuro ainda não deveria valer')
    })

    it('secretaria e ministro não lançam valores', async () => {
      for (const usuario of [secretaria, ministro]) {
        await assert.rejects(
          como(db, usuario, () =>
            db.query(
              "insert into public.valores_contribuicao (categoria, tipo, valor, vigente_desde) values ('jubilado', 'inscricao', 0, current_date)",
            ),
          ),
          erroComCodigo(SEM_PERMISSAO),
        )
      }
    })

    it('não aceita valor negativo nem alteração do valor já lançado (só arquivar)', async () => {
      await assert.rejects(
        como(db, tesoureiro, () =>
          db.query(
            "insert into public.valores_contribuicao (categoria, tipo, valor, vigente_desde) values ('jubilado', 'inscricao', -1, current_date)",
          ),
        ),
        erroComCodigo('23514'),
      )
      await assert.rejects(
        como(db, tesoureiro, () => db.query('update public.valores_contribuicao set valor = 1')),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('pastor presidente e jubilado', () => {
    let pastorA: string
    let auxiliar: string

    it('o pastor presidente ganha o perfil "presidente de igreja" e a categoria de R$ 40', async () => {
      pastorA = await cadastrar('Pr. Presidente A', igrejaA, true)
      assert.deepEqual(await perfisDe(pastorA), ['ministro', 'presidente_igreja'])
      assert.equal(await categoriaDe(pastorA), 'presidente_igreja')
    })

    it('quem não é presidente fica na categoria de R$ 20, sem o perfil', async () => {
      auxiliar = await cadastrar('Pr. Auxiliar A', igrejaA, false)
      assert.deepEqual(await perfisDe(auxiliar), ['ministro'])
      assert.equal(await categoriaDe(auxiliar), 'nao_presidente')
    })

    it('a igreja só tem um pastor presidente por vez', async () => {
      await assert.rejects(cadastrar('Outro Presidente A', igrejaA, true), erroComCodigo(DUPLICADO))
    })

    it('ao mudar para outra igreja sem ser presidente, perde o perfil', async () => {
      await como(db, secretaria, () =>
        db.query("select public.mudar_igreja($1, $2, 'Pastor auxiliar', current_date, false)", [pastorA, igrejaB]),
      )
      assert.deepEqual(await perfisDe(pastorA), ['ministro'])
      assert.equal(await categoriaDe(pastorA), 'nao_presidente')
    })

    it('marcar como presidente na igreja atual devolve o perfil', async () => {
      await como(db, secretaria, () =>
        db.query(
          'update public.vinculos_igreja set pastor_presidente = true where pessoa_id = $1 and fim is null',
          [auxiliar],
        ),
      )
      assert.deepEqual(await perfisDe(auxiliar), ['ministro', 'presidente_igreja'])
    })

    it('jubilado é isento, mesmo sendo presidente', async () => {
      await como(db, secretaria, () =>
        db.query('update public.associados set jubilado = true where pessoa_id = $1', [auxiliar]),
      )
      assert.equal(await categoriaDe(auxiliar), 'jubilado')
    })

    it('ministro não marca a si mesmo como presidente nem como jubilado', async () => {
      const r = await como(db, ministro, () =>
        db.query('update public.vinculos_igreja set pastor_presidente = true'),
      )
      assert.equal(r.affectedRows, 0)
      const j = await como(db, ministro, () => db.query('update public.associados set jubilado = true'))
      assert.equal(j.affectedRows, 0)
    })

    it('arquivar o cadastro tira os dois perfis automáticos e arquiva a pessoa sem login', async () => {
      await como(db, secretaria, () =>
        db.query('update public.associados set arquivado_em = now() where pessoa_id = $1', [auxiliar]),
      )
      assert.deepEqual(await perfisDe(auxiliar), [])
      const p = await db.query<{ arquivada: boolean }>(
        'select arquivado_em is not null as arquivada from public.pessoas where id = $1',
        [auxiliar],
      )
      assert.equal(p.rows[0].arquivada, true)
    })

    it('cadastro arquivado libera a vaga de pastor presidente da igreja', async () => {
      // o "auxiliar" era o presidente da Igreja A e foi arquivado no teste anterior
      const novo = await cadastrar('Novo Presidente A', igrejaA, true)
      assert.deepEqual(await perfisDe(novo), ['ministro', 'presidente_igreja'])
    })
  })

  describe('nada se apaga', () => {
    it('bairros e valores não se apagam', async () => {
      for (const tabela of ['bairros', 'valores_contribuicao']) {
        await assert.rejects(
          como(db, presidente, () => db.query(`delete from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
        )
        await assert.rejects(db.query(`delete from public.${tabela}`), erroComCodigo('P0001'))
      }
    })

    it('visitante não lê as tabelas novas', async () => {
      for (const tabela of ['bairros', 'valores_contribuicao', 'vw_valores_vigentes']) {
        await assert.rejects(
          como(db, null, () => db.query(`select * from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
        )
      }
    })
  })
})
