// Fase 5.4: mural de avisos (só a secretaria publica; o site, se ela escolher) e o painel da presidência. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.4 — mural e painel da presidência', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let ministro: string
  let aviso: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const salvar = (quem: string, id: string | null, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.salvar_aviso($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then((r) => (r.rows[0] as { id: string }).id)
  const publicos = async () => ((await chamar(null, 'select public.avisos_publicos() as a')).rows[0] as { a: { titulo: string }[] }).a

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.rows[0].id])
  })

  describe('mural de avisos (respostas 34 e 35)', () => {
    it('só a secretaria publica (nem a presidência, nem o ministro)', async () => {
      await assert.rejects(salvar(presidencia, null, { titulo: 'Aviso', texto: 'Texto do aviso' }), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(salvar(ministro, null, { titulo: 'Aviso', texto: 'Texto do aviso' }), erroComCodigo(SEM_PERMISSAO))
      aviso = await salvar(secretaria, null, { titulo: 'Reunião de oração', texto: 'Quinta, às 19h, na sede.' })
      await assert.rejects(salvar(secretaria, null, { titulo: 'Velho', texto: 'Texto', valido_ate: '2020-01-01' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('todos com login leem; o site só vê o que a secretaria mandou para o site', async () => {
      assert.equal((await chamar(ministro, 'select id from public.avisos')).rows.length, 1)
      assert.equal((await publicos()).length, 0)
      await salvar(secretaria, aviso, { titulo: 'Reunião de oração', texto: 'Quinta, às 19h, na sede.', no_site: true })
      assert.deepEqual(
        (await publicos()).map((a) => a.titulo),
        ['Reunião de oração'],
      )
      await assert.rejects(chamar(null, 'select id from public.avisos'), erroComCodigo(SEM_PERMISSAO))
    })

    it('vencido sai do mural (e do site); tirar o aviso o arquiva', async () => {
      await db.query("update public.avisos set valido_ate = current_date - 1 where id = $1", [aviso])
      assert.equal((await chamar(ministro, 'select id from public.avisos')).rows.length, 0)
      assert.equal((await publicos()).length, 0)
      await assert.rejects(chamar(ministro, 'select public.arquivar_aviso($1)', [aviso]), erroComCodigo(SEM_PERMISSAO))
      await chamar(secretaria, 'select public.arquivar_aviso($1)', [aviso])
      await assert.rejects(db.query('delete from public.avisos where id = $1', [aviso]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('painel da presidência (resposta 36)', () => {
    it('a presidência vê associados, finanças, presença e agenda; os outros não', async () => {
      const r = await chamar(presidencia, 'select public.painel_presidencia() as p')
      const p = (r.rows[0] as { p: Record<string, Record<string, unknown>> }).p
      assert.deepEqual(Object.keys(p).sort(), ['agenda', 'associados', 'financas', 'presenca'])
      assert.equal(p.associados.ativos, 1)
      assert.equal(p.associados.em_dia, 1)
      assert.equal(typeof p.financas.saldo, 'number')
      await assert.rejects(chamar(secretaria, 'select public.painel_presidencia()'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(ministro, 'select public.painel_presidencia()'), erroComCodigo(SEM_PERMISSAO))
    })
  })
})
