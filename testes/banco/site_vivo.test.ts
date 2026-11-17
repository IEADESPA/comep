// Fase 5.5.4: site vivo — a diretoria e as igrejas do COMEP no site, a partir do sistema, sem dados pessoais.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil } from './ambiente.ts'

describe('Fase 5.5.4 — site vivo (diretoria e igrejas)', () => {
  let db: PGlite
  let presidencia: string
  const p: string[] = []
  let igrejaA: string
  let igrejaB: string

  const publico = async <T>(funcao: string) =>
    ((await como(db, null, () => db.query(`select public.${funcao}() as r`))).rows[0] as { r: T }).r

  before(async () => {
    db = await criarBanco()
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Antes')
    await darPerfil(db, presidencia, 'presidencia')
    const den = (await db.query<{ id: string }>("insert into public.denominacoes (nome, sigla) values ('Assembleia de Deus', 'AD') returning id")).rows[0].id
    const bairro = (await db.query<{ id: string }>("insert into public.bairros (nome) values ('Centro') returning id")).rows[0].id
    igrejaA = (
      await db.query<{ id: string }>(
        "insert into public.igrejas (nome, denominacao_id, bairro_id, endereco, telefone, cnpj) values ('Igreja A', $1, $2, 'Rua Secreta, 10', '94999990000', null) returning id",
        [den, bairro],
      )
    ).rows[0].id
    igrejaB = (await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja B, sem associados') returning id")).rows[0].id
    for (let i = 1; i <= 4; i++) {
      const u = await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`)
      const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u])
      p.push(r.rows[0].id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [r.rows[0].id])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [r.rows[0].id, igrejaA, i === 1])
    }
    await como(db, presidencia, () =>
      db.query(
        `select public.registrar_diretoria(jsonb_build_object('inicio', current_date - 10, 'fim', current_date + 1450, 'encontro_id', null,
           'documento', 'Ata da eleição (teste)', 'membros', $1::jsonb))`,
        [
          JSON.stringify([
            { cargo: 'primeiro_secretario', pessoa_id: p[1] },
            { cargo: 'presidente', pessoa_id: p[0] },
            { cargo: 'conselheiro_fiscal', pessoa_id: p[2] },
          ]),
        ],
      ),
    )
    // o 4º saiu do COMEP: não conta mais
    await db.query("update public.associados set situacao = 'desligado' where pessoa_id = $1", [p[3]])
  })

  it('a diretoria no site: quem tem mandato valendo hoje, na ordem dos cargos; qualquer visitante vê', async () => {
    const d = await publico<{ cargo: string; nome: string; inicio: string; fim: string }[]>('diretoria_publica')
    assert.deepEqual(
      d.map((m) => [m.cargo, m.nome]),
      [
        ['presidente', 'Associado 1'],
        ['primeiro_secretario', 'Associado 2'],
        ['conselheiro_fiscal', 'Associado 3'],
      ],
    )
    assert.deepEqual(Object.keys(d[0]).sort(), ['cargo', 'fim', 'inicio', 'nome'])
  })

  it('mandato encerrado sai do site', async () => {
    const m = (await db.query<{ id: string }>("select id from public.mandatos where cargo = 'primeiro_secretario'")).rows[0].id
    await como(db, presidencia, () => db.query("select public.encerrar_mandato($1, current_date, 'Renúncia')", [m]))
    const d = await publico<{ cargo: string }[]>('diretoria_publica')
    assert.deepEqual(
      d.map((x) => x.cargo),
      ['presidente', 'conselheiro_fiscal'],
    )
  })

  it('as igrejas no site: só as que têm ministros associados ativos; sem endereço, telefone ou CNPJ', async () => {
    const g = await publico<Record<string, unknown>[]>('igrejas_publicas')
    assert.equal(g.length, 1)
    assert.deepEqual(g[0], { id: igrejaA, nome: 'Igreja A', sigla: null, denominacao: 'Assembleia de Deus', bairro: 'Centro', ministros: 3 })
    assert.ok(!g.some((x) => x.id === igrejaB))
    assert.ok(!JSON.stringify(g).includes('Rua Secreta'))
    assert.ok(!JSON.stringify(g).includes('94999990000'))
  })

  it('os números do COMEP para a página inicial', async () => {
    assert.deepEqual(await publico('numeros_publicos'), { ministros: 3, igrejas: 1, denominacoes: 1 })
  })
})
