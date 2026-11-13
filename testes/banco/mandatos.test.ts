// Fase 4.4: diretoria e Conselho Fiscal — mandatos, regras de cargo e perfis automáticos. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 4.4 — mandatos e perfis automáticos', () => {
  let db: PGlite
  let presidencia: string
  const u: string[] = []
  const p: string[] = []

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const registrar = (quem: string, membros: { cargo: string; pessoa: string }[], inicio = 'current_date - 10', fim = 'current_date + 1450') =>
    chamar(
      quem,
      `select public.registrar_diretoria(jsonb_build_object('inicio', ${inicio}, 'fim', ${fim}, 'membros', $1::jsonb)) as n`,
      [JSON.stringify(membros.map((m) => ({ cargo: m.cargo, pessoa_id: m.pessoa })))],
    )
  const tem = async (quem: string, perfil: string) =>
    ((await chamar(quem, `select interno.tenho_perfil('${perfil}') as t`)).rows[0] as { t: boolean }).t

  before(async () => {
    db = await criarBanco()
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Antes')
    await darPerfil(db, presidencia, 'presidencia')
    for (let i = 1; i <= 8; i++) {
      u.push(await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`))
      const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u[i - 1]])
      p.push(r.rows[0].id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [r.rows[0].id])
    }
    // o 5º está em atraso: não pode ser votado (Art. 11)
    await db.query(
      `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
       values ($1, 2025, 'mensal', '2025-05-01', '2025-05-10', 'nao_presidente', 20)`,
      [p[4]],
    )
  })

  describe('registrar a diretoria eleita', () => {
    it('só a presidência registra; o ministro não', async () => {
      await assert.rejects(registrar(u[0], [{ cargo: 'presidente', pessoa: p[0] }]), erroComCodigo(SEM_PERMISSAO))
    })

    it('quem está em atraso não pode ser votado (Art. 11)', async () => {
      await assert.rejects(registrar(presidencia, [{ cargo: 'segundo_secretario', pessoa: p[4] }]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('registra presidente, 1º secretário, 1º tesoureiro e um conselheiro fiscal', async () => {
      const r = await registrar(presidencia, [
        { cargo: 'presidente', pessoa: p[0] },
        { cargo: 'primeiro_secretario', pessoa: p[1] },
        { cargo: 'primeiro_tesoureiro', pessoa: p[2] },
        { cargo: 'conselheiro_fiscal', pessoa: p[3] },
      ])
      assert.equal((r.rows[0] as { n: number }).n, 4)
    })

    it('um por cargo no período; no Conselho Fiscal, no máximo 3; ninguém acumula dois cargos', async () => {
      await assert.rejects(registrar(presidencia, [{ cargo: 'presidente', pessoa: p[5] }]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(registrar(presidencia, [{ cargo: 'vice_presidente', pessoa: p[0] }]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await registrar(presidencia, [
        { cargo: 'conselheiro_fiscal', pessoa: p[5] },
        { cargo: 'conselheiro_fiscal', pessoa: p[6] },
      ])
      await assert.rejects(registrar(presidencia, [{ cargo: 'conselheiro_fiscal', pessoa: p[7] }]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('perfis automáticos pelo cargo', () => {
    it('o cargo dá o perfil enquanto o mandato vale (e aparece no menu)', async () => {
      assert.equal(await tem(u[0], 'presidencia'), true)
      assert.equal(await tem(u[1], 'secretaria'), true)
      assert.equal(await tem(u[2], 'tesouraria'), true)
      assert.equal(await tem(u[3], 'conselho_fiscal'), true)
      assert.equal(await tem(u[1], 'presidencia'), false)
      const r = await chamar(u[0], 'select public.meus_perfis() as m')
      assert.deepEqual((r.rows[0] as { m: string[] }).m.sort(), ['ministro', 'presidencia'])
    })

    it('com o perfil do cargo, a pessoa faz o que o perfil permite (ex.: o 1º secretário prepara uma reunião)', async () => {
      const r = await chamar(
        u[1],
        "select public.salvar_encontro(null, jsonb_build_object('tipo', 'reuniao_mensal', 'titulo', 'Reunião', 'inicio', now() + interval '3 days', 'local', 'Sede')) as id",
      )
      assert.ok((r.rows[0] as { id: string }).id)
    })

    it('mandato futuro ainda não dá perfil; mandato que já acabou não dá mais', async () => {
      await registrar(presidencia, [{ cargo: 'segundo_tesoureiro', pessoa: p[7] }], 'current_date + 30', 'current_date + 1500')
      assert.equal(await tem(u[7], 'tesouraria'), false)
      await registrar(presidencia, [{ cargo: 'vice_presidente', pessoa: p[7] }], 'current_date - 1500', 'current_date - 1')
      assert.equal(await tem(u[7], 'presidencia'), false)
    })

    it('encerrar o mandato (renúncia) tira o perfil; só a presidência encerra, com motivo', async () => {
      const m = await db.query<{ id: string }>("select id from public.mandatos where cargo = 'primeiro_tesoureiro'")
      // o 5º associado não tem cargo nem perfil da presidência
      await assert.rejects(chamar(u[4], "select public.encerrar_mandato($1, current_date, 'Renúncia')", [m.rows[0].id]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(presidencia, "select public.encerrar_mandato($1, current_date, '')", [m.rows[0].id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidencia, "select public.encerrar_mandato($1, current_date, 'Renúncia')", [m.rows[0].id])
      assert.equal(await tem(u[2], 'tesouraria'), false)
    })

    it('desligado do COMEP perde o perfil do cargo', async () => {
      await db.query("update public.associados set situacao = 'desligado' where pessoa_id = $1", [p[1]])
      assert.equal(await tem(u[1], 'secretaria'), false)
    })

    it('Conselho Fiscal e diretoria não se cruzam, nem entre o cargo e o perfil dado à mão', async () => {
      // o conselheiro (pelo cargo) não recebe perfil da diretoria à mão
      await assert.rejects(
        chamar(presidencia, "insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'tesouraria')", [p[3]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      // quem tem perfil da diretoria à mão não assume cargo no Conselho Fiscal
      await chamar(presidencia, "insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'secretaria')", [p[2]])
      const m = await db.query<{ id: string }>("select id from public.mandatos where cargo = 'conselheiro_fiscal' and pessoa_id = $1", [p[6]])
      await chamar(presidencia, "select public.encerrar_mandato($1, current_date, 'Renúncia')", [m.rows[0].id])
      await assert.rejects(registrar(presidencia, [{ cargo: 'conselheiro_fiscal', pessoa: p[2] }], 'current_date + 1', 'current_date + 1450'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('todos com login veem a diretoria (o que vale agora e o histórico), até o associado sem cargo', async () => {
      // o 5º associado não tem cargo nem perfil: não lê o cadastro dos outros, mas vê o nome de quem tem cargo
      const r = await chamar(u[4], "select nome, cargo, vigente from public.vw_mandatos where cargo = 'presidente'")
      assert.deepEqual(r.rows, [{ nome: 'Associado 1', cargo: 'presidente', vigente: true }])
      await assert.rejects(chamar(null, 'select * from public.vw_mandatos'), erroComCodigo(SEM_PERMISSAO))
    })
  })
})
