// Fase 4.2: presença e faltas — confirmar, marcar presença (lista e QR Code), encerrar, justificar e faltas seguidas.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 4.2 — presença e faltas', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let outro: string
  let semAssociacao: string
  let pessoaMinistro: string
  let pessoaOutro: string
  let hoje: string
  let futuro: string
  let codigo: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  /** Encontro criado direto no banco (para pôr no passado ou no presente). */
  async function encontro(tipo: string, inicio: string, situacao = 'convocado'): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, presenca_encerrada_em)
       values ($1, 'Encontro de teste', ${inicio}, 'Local', $2::public.situacao_encontro, now(),
               case when $2::text = 'realizado' then now() end) returning id`,
      [tipo, situacao],
    )
    return r.rows[0].id
  }

  const faltas = async (pessoa: string) =>
    (await db.query<{ n: number }>('select interno.faltas_seguidas($1) as n', [pessoa])).rows[0].n

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    outro = await criarUsuario(db, 'outro@teste.local', 'Outro Ministro')
    semAssociacao = await criarUsuario(db, 'visitante@teste.local', 'Ainda Não Associado')
    await darPerfil(db, secretaria, 'secretaria')
    pessoaMinistro = await pessoaDe(ministro)
    pessoaOutro = await pessoaDe(outro)
    for (const p of [pessoaMinistro, pessoaOutro]) {
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p])
    }
    hoje = await encontro('reuniao_mensal', "now() - interval '1 hour'")
    futuro = await encontro('ago', "now() + interval '40 days'")
    const r = await chamar(ministro, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoaMinistro]])
    codigo = (r.rows[0] as { d: { credenciais: { codigo: string }[] } }).d.credenciais[0].codigo
  })

  describe('o associado', () => {
    it('confirma "vou participar" em encontro convocado futuro; quem não é associado, não', async () => {
      await chamar(ministro, 'select public.confirmar_presenca($1, true)', [futuro])
      const r = await chamar(ministro, 'select confirmou_em is not null as vou from public.encontro_presencas where encontro_id = $1', [futuro])
      assert.deepEqual(r.rows, [{ vou: true }])
      await chamar(ministro, 'select public.confirmar_presenca($1, false)', [futuro])
      await assert.rejects(chamar(semAssociacao, 'select public.confirmar_presenca($1, true)', [futuro]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(ministro, 'select public.confirmar_presenca($1, true)', [hoje]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('a secretaria marca a presença', () => {
    it('pela lista, no dia; o ministro não marca; encontro daqui a 40 dias ainda não abriu', async () => {
      await assert.rejects(
        chamar(ministro, "select public.registrar_presenca($1, $2, 'lista')", [hoje, pessoaMinistro]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(secretaria, "select public.registrar_presenca($1, $2, 'lista')", [futuro, pessoaMinistro]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const r = await chamar(secretaria, "select public.registrar_presenca($1, $2, 'lista') as r", [hoje, pessoaOutro])
      assert.equal((r.rows[0] as { r: string }).r, 'registrada')
    })

    it('pelo QR Code da credencial: devolve o nome; a segunda leitura diz "já presente"', async () => {
      const r1 = await chamar(secretaria, 'select public.registrar_presenca_por_codigo($1, $2) as r', [hoje, codigo])
      const primeiro = (r1.rows[0] as { r: { resultado: string; nome: string; em_dia: boolean } }).r
      assert.equal(primeiro.resultado, 'registrada')
      assert.equal(primeiro.nome, 'Ministro de Teste')
      const r2 = await chamar(secretaria, 'select public.registrar_presenca_por_codigo($1, $2) as r', [hoje, codigo])
      assert.equal((r2.rows[0] as { r: { resultado: string } }).r.resultado, 'ja_presente')
      await assert.rejects(
        chamar(secretaria, 'select public.registrar_presenca_por_codigo($1, $2)', [hoje, '0'.repeat(32)]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('a página do QR Code sabe qual encontro está com a lista aberta (só para a secretaria)', async () => {
      const r = await chamar(secretaria, 'select public.encontros_com_presenca_aberta() as e')
      assert.deepEqual(((r.rows[0] as { e: { id: string }[] }).e).map((x) => x.id), [hoje])
      const m = await chamar(ministro, 'select public.encontros_com_presenca_aberta() as e')
      assert.deepEqual((m.rows[0] as { e: unknown[] }).e, [])
    })

    it('desfazer (engano) e encerrar: o encontro fica "realizado" e a lista fecha', async () => {
      await chamar(secretaria, 'select public.desfazer_presenca($1, $2)', [hoje, pessoaOutro])
      await chamar(secretaria, 'select public.encerrar_presenca($1)', [hoje])
      const e = await db.query<{ situacao: string }>('select situacao from public.encontros where id = $1', [hoje])
      assert.equal(e.rows[0].situacao, 'realizado')
      await assert.rejects(
        chamar(secretaria, "select public.registrar_presenca($1, $2, 'lista')", [hoje, pessoaOutro]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(secretaria, 'select public.encerrar_presenca($1)', [futuro]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a lista de presença (só secretaria e presidência): associados ativos, presença e se está em dia', async () => {
      await assert.rejects(chamar(ministro, 'select public.lista_presenca($1)', [hoje]), erroComCodigo(SEM_PERMISSAO))
      const r = await chamar(secretaria, 'select public.lista_presenca($1) as l', [hoje])
      const lista = (r.rows[0] as { l: { nome: string; presente_em: string | null; em_dia: boolean }[] }).l
      assert.deepEqual(lista.map((x) => [x.nome, x.presente_em !== null, x.em_dia]), [
        ['Ministro de Teste', true, true],
        ['Outro Ministro', false, true],
      ])
    })

    it('cada um vê só as próprias presenças; a secretaria vê todas; o visitante, nada', async () => {
      const meu = await chamar(ministro, 'select pessoa_id from public.encontro_presencas')
      assert.ok(meu.rows.every((x) => (x as { pessoa_id: string }).pessoa_id === pessoaMinistro))
      const todas = await chamar(secretaria, 'select distinct pessoa_id from public.encontro_presencas')
      assert.equal(todas.rows.length, 2)
      await assert.rejects(chamar(null, 'select * from public.encontro_presencas'), erroComCodigo(SEM_PERMISSAO))
    })
  })

  describe('justificativa de falta', () => {
    let justificativa: string

    it('quem esteve presente não justifica; quem faltou justifica (e pode reescrever enquanto não decidida)', async () => {
      await assert.rejects(chamar(ministro, "select public.justificar_falta($1, 'Estava doente')", [hoje]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(outro, "select public.justificar_falta($1, 'Viagem de trabalho')", [hoje])
      await chamar(outro, "select public.justificar_falta($1, 'Viagem de trabalho a Belém')", [hoje])
      const r = await db.query<{ id: string; texto: string }>('select id, texto from public.justificativas_falta where encontro_id = $1', [hoje])
      assert.equal(r.rows.length, 1)
      assert.equal(r.rows[0].texto, 'Viagem de trabalho a Belém')
      justificativa = r.rows[0].id
    })

    it('o 1º secretário (secretaria) decide: recusar pede motivo; decidida não muda', async () => {
      await assert.rejects(chamar(ministro, 'select public.decidir_justificativa($1, true, null)', [justificativa]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(secretaria, 'select public.decidir_justificativa($1, false, null)', [justificativa]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, 'select public.decidir_justificativa($1, true, null)', [justificativa])
      await assert.rejects(chamar(secretaria, "select public.decidir_justificativa($1, false, 'x')", [justificativa]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(outro, "select public.justificar_falta($1, 'Outro texto')", [hoje]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('faltas seguidas (Art. 8º, IV)', () => {
    it('contam só as assembleias (pergunta 22), da mais recente para trás, até uma presença ou uma falta justificada', async () => {
      // a reunião mensal de "hoje" (realizada) não conta
      assert.equal(await faltas(pessoaMinistro), 0)
      // uma AGE realizada: o ministro esteve; o outro faltou, com justificativa aceita
      const age = await encontro('age', "now() - interval '40 minutes'", 'realizado')
      await db.query("insert into public.encontro_presencas (encontro_id, pessoa_id, presente_em, forma) values ($1, $2, now(), 'lista')", [
        age,
        pessoaMinistro,
      ])
      await db.query("insert into public.justificativas_falta (encontro_id, pessoa_id, texto, situacao) values ($1, $2, 'Viagem', 'aceita')", [
        age,
        pessoaOutro,
      ])
      assert.equal(await faltas(pessoaMinistro), 0)
      assert.equal(await faltas(pessoaOutro), 0)
      // mais três assembleias depois dela (mais recentes), sem ninguém
      for (const minutos of [30, 20, 10]) await encontro(minutos === 20 ? 'ago' : 'age', `now() - interval '${minutos} minutes'`, 'realizado')
      assert.equal(await faltas(pessoaMinistro), 3)
      assert.equal(await faltas(pessoaOutro), 3)
    })

    it('a reunião mensal não conta (pergunta 22, 14/11/2026); a assembleia cancelada também não', async () => {
      await encontro('reuniao_mensal', "now() - interval '5 minutes'", 'realizado')
      await encontro('ago', "now() - interval '2 minutes'", 'cancelado')
      assert.equal(await faltas(pessoaMinistro), 3)
    })

    it('o associado vê as próprias, com os limites; a secretaria vê a lista de todos', async () => {
      const r = await chamar(ministro, 'select public.minhas_faltas() as f')
      assert.deepEqual((r.rows[0] as { f: unknown }).f, { faltas_seguidas: 3, faltas_aviso: 2, faltas_pauta: 3 })
      await assert.rejects(chamar(ministro, 'select public.faltas_dos_associados()'), erroComCodigo(SEM_PERMISSAO))
      const t = await chamar(secretaria, 'select public.faltas_dos_associados() as f')
      const lista = (t.rows[0] as { f: { nome: string; faltas_seguidas: number }[] }).f
      assert.deepEqual(lista.map((x) => [x.nome, x.faltas_seguidas]), [
        ['Ministro de Teste', 3],
        ['Outro Ministro', 3],
      ])
    })
  })
})
