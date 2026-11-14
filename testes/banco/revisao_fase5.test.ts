// Revisão geral da Fase 5 (14/11/2026): um teste para cada achado do banco (docs/revisoes/fase-5.md).
// Todos falham sem a migração 20261114233000_revisao_fase5.sql. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Revisão geral da Fase 5 — correções do banco', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let tesouraria: string
  let soLogin: string
  let ministro: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString()
  const evento = async (dados: Record<string, unknown>) => {
    const id = (
      await chamar(secretaria, 'select public.salvar_evento(null, $1::jsonb) as id', [
        JSON.stringify({ titulo: 'Evento', inicio: daqui(30), inscricao: true, inscricao_publica: true, ...dados }),
      ])
    ).rows[0] as { id: string }
    await chamar(presidencia, 'select public.publicar_evento($1)', [id.id])
    return id.id
  }
  const inscrever = (quem: string | null, ev: string, telefone: string) =>
    chamar(quem, "select public.inscrever_no_evento($1, 'Pessoa de Teste', $2, null, true) as r", [ev, telefone])
  /** Simula o endereço de quem chama (o PostgREST põe os cabeçalhos em request.headers). */
  const deOrigem = (ip: string | null) =>
    db.query("select set_config('request.headers', $1, false)", [ip ? JSON.stringify({ 'x-forwarded-for': ip }) : ''])

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    soLogin = await criarUsuario(db, 'login@teste.local', 'Só Criou a Conta')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, tesouraria, 'tesouraria')
    const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.id])
  })

  it('inscrição pública: limite por origem (5 por hora), o aceite fica guardado e o endereço só como resumo', async () => {
    const ev = await evento({ titulo: 'Conferência' })
    await deOrigem('200.1.2.3')
    for (let i = 0; i < 5; i++) await inscrever(null, ev, `9499999000${i}`)
    await assert.rejects(inscrever(null, ev, '94999990009'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    // de outro aparelho, continua
    await deOrigem('200.9.9.9')
    await inscrever(null, ev, '94999990010')
    await deOrigem(null)
    const r = await um<{ aceite: boolean; origem: string }>(
      "select aceite_em is not null as aceite, origem from public.evento_inscricoes where telefone = '94999990010'",
    )
    assert.equal(r.aceite, true)
    assert.match(r.origem, /^[0-9a-f]{32}$/)
  })

  it('o telefone repetido não é confirmado a quem é de fora (mensagem neutra)', async () => {
    const ev = await evento({ titulo: 'Seminário' })
    await inscrever(null, ev, '94988880001')
    await assert.rejects(inscrever(null, ev, '94988880001'), (e: unknown) => /Não foi possível fazer a inscrição/.test(String((e as Error).message)))
  })

  it('não pago há mais de 72 horas não segura a vaga; a secretaria libera de uma vez', async () => {
    const ev = await evento({ titulo: 'Retiro', vagas: 1, taxa: 30 })
    await inscrever(null, ev, '94977770001')
    await assert.rejects(inscrever(null, ev, '94977770002'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await db.query("update public.evento_inscricoes set criado_em = now() - interval '73 hours' where evento_id = $1", [ev])
    await inscrever(null, ev, '94977770002')
    const n = await chamar(secretaria, 'select public.cancelar_inscricoes_sem_pagamento($1) as n', [ev])
    assert.equal((n.rows[0] as { n: number }).n, 1)
  })

  it('cancelar o lançamento do pagamento devolve a inscrição para "aguardando o pagamento"', async () => {
    const ev = await evento({ titulo: 'Curso', taxa: 25 })
    await inscrever(null, ev, '94966660001')
    const i = await um<{ id: string }>('select id from public.evento_inscricoes where evento_id = $1', [ev])
    await chamar(tesouraria, "select public.registrar_pagamento_inscricao($1, current_date, ' PIX ')", [i.id])
    const l = await um<{ lancamento_id: string }>('select lancamento_id from public.evento_inscricoes where id = $1', [i.id])
    await chamar(tesouraria, "select public.cancelar_lancamento($1, 'Data errada')", [l.lancamento_id])
    const depois = await um<{ situacao: string; pago: boolean }>(
      'select situacao, pago_em is not null as pago from public.evento_inscricoes where id = $1',
      [i.id],
    )
    assert.deepEqual(depois, { situacao: 'aguardando_pagamento', pago: false })
    // e o pagamento certo pode ser registrado de novo
    await chamar(tesouraria, "select public.registrar_pagamento_inscricao($1, current_date, 'PIX')", [i.id])
  })

  it('cancelar o evento cancela as inscrições não pagas; evento cancelado não recebe pagamento', async () => {
    const ev = await evento({ titulo: 'Congresso', taxa: 40 })
    await inscrever(null, ev, '94955550001')
    await chamar(secretaria, "select public.cancelar_evento($1, 'Chuva')", [ev])
    const i = await um<{ id: string; situacao: string }>('select id, situacao from public.evento_inscricoes where evento_id = $1', [ev])
    assert.equal(i.situacao, 'cancelada')
    await db.query("update public.evento_inscricoes set situacao = 'aguardando_pagamento' where id = $1", [i.id])
    await assert.rejects(chamar(tesouraria, "select public.registrar_pagamento_inscricao($1, current_date, 'PIX')", [i.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('o orçamento não é aprovado por uma assembleia anterior a ele', async () => {
    const ev = await evento({ titulo: 'Projeto social', orcamento: 1000 })
    const antiga = await um<{ id: string }>(
      "insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, instalada_em) values ('ago', 'AGO', now() - interval '2 years', 'Sede', 'realizado', now(), now()) returning id",
    )
    await assert.rejects(chamar(presidencia, 'select public.aprovar_orcamento_evento($1, $2)', [ev, antiga.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('quem só criou uma conta no site não lê os avisos internos, as comissões nem os eventos', async () => {
    await chamar(secretaria, "select public.salvar_aviso(null, '{\"titulo\": \"Interno\", \"texto\": \"Só para o COMEP\"}'::jsonb)")
    await chamar(secretaria, "select public.salvar_comissao(null, '{\"nome\": \"Comissão de Saúde\", \"tipo\": \"permanente\"}'::jsonb)")
    for (const tabela of ['avisos', 'comissoes', 'eventos', 'vw_comissao_membros']) {
      assert.equal((await chamar(soLogin, `select 1 from public.${tabela}`)).rows.length, 0, tabela)
    }
    // o ministro (do COMEP) continua vendo
    assert.ok((await chamar(ministro, 'select 1 from public.avisos')).rows.length >= 1)
    assert.ok((await chamar(ministro, 'select 1 from public.eventos')).rows.length >= 1)
  })

  it('o painel não conta as transferências entre contas como entradas e saídas', async () => {
    const contas = await db.query<{ id: string }>('select id from public.contas_financeiras where arquivado_em is null order by nome limit 2')
    const antes = (await chamar(presidencia, 'select public.painel_presidencia() as p')).rows[0] as { p: { financas: { entradas_mes: number } } }
    await chamar(tesouraria, "select public.transferir($1, $2, current_date, 500, 'Depósito do dinheiro no banco')", [contas.rows[0].id, contas.rows[1].id])
    const depois = (await chamar(presidencia, 'select public.painel_presidencia() as p')).rows[0] as { p: { financas: { entradas_mes: number } } }
    assert.equal(depois.p.financas.entradas_mes, antes.p.financas.entradas_mes)
  })
})
