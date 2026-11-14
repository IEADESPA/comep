// Fase 5.2: comissões — criar, membros (só associados), coordenador, registros e quem vê. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.2 — comissões', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let semAssociacao: string
  const u: string[] = []
  const p: string[] = []
  let educacao: string
  let membroCoordenador: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const salvar = (quem: string, id: string | null, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.salvar_comissao($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then((r) => (r.rows[0] as { id: string }).id)
  const incluir = (quem: string, comissao: string, pessoa: string, coordenador = false) =>
    chamar(quem, 'select public.incluir_membro_comissao($1, $2, $3) as id', [comissao, pessoa, coordenador]).then((r) => (r.rows[0] as { id: string }).id)
  const registrar = (quem: string, comissao: string, titulo = 'Reunião de planejamento') =>
    chamar(quem, "select public.registrar_na_comissao($1, 'reuniao', current_date, $2, 'Texto') as id", [comissao, titulo])

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    semAssociacao = await criarUsuario(db, 'login@teste.local', 'Só Login')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    for (let i = 1; i <= 4; i++) {
      u.push(await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`))
      const r = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u[i - 1]])
      p.push(r.id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [r.id])
    }
  })

  describe('criar e encerrar (resposta 29)', () => {
    it('a presidência e a secretaria criam; o ministro não; a temporária precisa de término', async () => {
      await assert.rejects(salvar(u[0], null, { nome: 'Comissão X', tipo: 'permanente' }), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(salvar(secretaria, null, { nome: 'Eleições 2027', tipo: 'temporaria' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      educacao = await salvar(secretaria, null, { nome: 'Comissão de Educação', tipo: 'permanente', area: 'Educação' })
      await salvar(presidencia, null, { nome: 'Eleições 2027', tipo: 'temporaria', fim: '2027-04-30' })
      // o nome não se repete entre as ativas
      await assert.rejects(salvar(secretaria, null, { nome: 'comissão de educação', tipo: 'permanente' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('membros (resposta 28)', () => {
    it('só associados ativos; não repete; quem não é da diretoria não indica', async () => {
      await assert.rejects(incluir(u[0], educacao, p[1]), erroComCodigo(SEM_PERMISSAO))
      const r = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [semAssociacao])
      await assert.rejects(incluir(secretaria, educacao, r.id), erroComCodigo(BLOQUEADO_PELO_BANCO))
      membroCoordenador = await incluir(secretaria, educacao, p[0], true)
      await incluir(secretaria, educacao, p[1])
      await assert.rejects(incluir(secretaria, educacao, p[1]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('um coordenador por vez: escolher outro tira o anterior (que continua membro)', async () => {
      await chamar(presidencia, 'select public.definir_coordenador($1, $2)', [educacao, p[1]])
      const r = await db.query<{ pessoa_id: string; coordenador: boolean }>(
        'select pessoa_id, coordenador from public.comissao_membros where comissao_id = $1 and ate is null order by coordenador',
        [educacao],
      )
      assert.deepEqual(r.rows, [
        { pessoa_id: p[0], coordenador: false },
        { pessoa_id: p[1], coordenador: true },
      ])
      await assert.rejects(chamar(presidencia, 'select public.definir_coordenador($1, $2)', [educacao, p[3]]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidencia, 'select public.definir_coordenador($1, $2)', [educacao, p[0]])
    })

    it('todos com login veem as comissões e os nomes dos membros', async () => {
      const r = await chamar(u[3], 'select nome, coordenador from public.vw_comissao_membros where comissao_id = $1 order by nome', [educacao])
      assert.deepEqual(r.rows, [
        { nome: 'Associado 1', coordenador: true },
        { nome: 'Associado 2', coordenador: false },
      ])
    })
  })

  describe('registros do coordenador (resposta 30)', () => {
    it('o coordenador registra na sua comissão; o membro comum não; ninguém de fora lê', async () => {
      await registrar(u[0], educacao)
      await assert.rejects(registrar(u[1], educacao), erroComCodigo(SEM_PERMISSAO))
      assert.equal((await chamar(u[1], 'select id from public.comissao_registros')).rows.length, 1, 'o membro lê')
      assert.equal((await chamar(u[3], 'select id from public.comissao_registros')).rows.length, 0, 'quem não é membro não lê')
      assert.equal((await chamar(secretaria, 'select id from public.comissao_registros')).rows.length, 1, 'a diretoria lê')
    })

    it('o coordenador tira o próprio registro (fica guardado); o membro não', async () => {
      const r = await um<{ id: string }>('select id from public.comissao_registros where comissao_id = $1', [educacao])
      await assert.rejects(chamar(u[1], 'select public.arquivar_registro_comissao($1)', [r.id]), erroComCodigo(SEM_PERMISSAO))
      await chamar(u[0], 'select public.arquivar_registro_comissao($1)', [r.id])
      const a = await um<{ arquivado: boolean }>('select arquivado_em is not null as arquivado from public.comissao_registros where id = $1', [r.id])
      assert.equal(a.arquivado, true)
    })
  })

  describe('saídas', () => {
    it('quem sai do COMEP sai das comissões e deixa de coordenar', async () => {
      await db.query("update public.associados set situacao = 'desligado' where pessoa_id = $1", [p[0]])
      const m = await um<{ saiu: boolean; coordenador: boolean }>(
        'select ate is not null as saiu, coordenador from public.comissao_membros where id = $1',
        [membroCoordenador],
      )
      assert.deepEqual(m, { saiu: true, coordenador: false })
      await assert.rejects(registrar(u[0], educacao), erroComCodigo(SEM_PERMISSAO))
    })

    it('encerrar pede motivo; encerrada, não recebe membros nem registros; os membros saem junto', async () => {
      await assert.rejects(chamar(secretaria, "select public.encerrar_comissao($1, current_date, '')", [educacao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, "select public.encerrar_comissao($1, current_date, 'Trabalho concluído')", [educacao])
      await assert.rejects(incluir(secretaria, educacao, p[2]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(registrar(secretaria, educacao), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await um<{ n: number }>('select count(*)::int as n from public.comissao_membros where comissao_id = $1 and ate is null', [educacao])
      assert.equal(r.n, 0)
      await assert.rejects(db.query('delete from public.comissoes where id = $1', [educacao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })
})
