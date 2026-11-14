// Fase 5.3: eventos e projetos — preparar e publicar, inscrição pelo site e pelo sistema, taxa e pagamento,
// orçamento aprovado pela assembleia, lançamentos ligados e quem vê o quê. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.3 — eventos e projetos', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let tesouraria: string
  let ministro: string
  let pessoaMinistro: string
  let gratuito: string
  let pago: string
  let interno: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString()
  const salvar = (quem: string, id: string | null, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.salvar_evento($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then((r) => (r.rows[0] as { id: string }).id)
  const inscrever = (quem: string | null, evento: string, nome: string, telefone: string, aceite = true) =>
    chamar(quem, 'select public.inscrever_no_evento($1, $2, $3, null, $4) as r', [evento, nome, telefone, aceite]).then(
      (r) => (r.rows[0] as { r: { numero: number; situacao: string } }).r,
    )
  const publicos = async () => {
    const r = await chamar(null, 'select public.eventos_publicos() as e')
    return (r.rows[0] as { e: { id: string; situacao: string; vagas_restantes: number | null }[] }).e
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, tesouraria, 'tesouraria')
    pessoaMinistro = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])).id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoaMinistro])
  })

  describe('preparar e publicar', () => {
    it('a secretaria prepara; o ministro não; rascunho não vai ao site', async () => {
      const base = { titulo: 'Conferência de Obreiros', local: 'Ginásio', inicio: daqui(30), inscricao: true, inscricao_publica: true, vagas: 2 }
      await assert.rejects(salvar(ministro, null, base), erroComCodigo(SEM_PERMISSAO))
      gratuito = await salvar(secretaria, null, base)
      pago = await salvar(secretaria, null, { ...base, titulo: 'Seminário de Liderança', taxa: 20, vagas: null, orcamento: 1000 })
      interno = await salvar(secretaria, null, { ...base, titulo: 'Retiro dos Associados', inscricao_publica: false })
      assert.equal((await publicos()).length, 0)
      assert.equal((await chamar(ministro, 'select id from public.eventos')).rows.length, 0)
    })

    it('publicado: vai ao site e todos com login veem', async () => {
      for (const e of [gratuito, pago, interno]) await chamar(presidencia, 'select public.publicar_evento($1)', [e])
      assert.equal((await publicos()).length, 3)
      assert.equal((await chamar(ministro, 'select id from public.eventos')).rows.length, 3)
    })
  })

  describe('inscrição (resposta 32)', () => {
    it('pelo site, sem login: com o aceite da LGPD e o telefone com DDD', async () => {
      await assert.rejects(inscrever(null, gratuito, 'Visitante Um', '94 99999-0001', false), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(inscrever(null, gratuito, 'Visitante Um', '9999'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await inscrever(null, gratuito, 'Visitante Um', '(94) 99999-0001')
      assert.deepEqual(r, { numero: 1, situacao: 'confirmada', valor: 0 })
      await assert.rejects(inscrever(null, gratuito, 'Outra Pessoa', '94999990001'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('as vagas acabam; o site mostra quantas restam', async () => {
      await inscrever(null, gratuito, 'Visitante Dois', '94999990002')
      assert.equal((await publicos()).find((e) => e.id === gratuito)?.vagas_restantes, 0)
      await assert.rejects(inscrever(null, gratuito, 'Visitante Três', '94999990003'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('evento só para associados: sem login não; o ministro se inscreve pelo sistema', async () => {
      await assert.rejects(inscrever(null, interno, 'Visitante', '94999990004'), erroComCodigo(SEM_PERMISSAO))
      await inscrever(ministro, interno, 'Ministro de Teste', '94999990005')
      const r = await um<{ pessoa_id: string }>('select pessoa_id from public.evento_inscricoes where evento_id = $1', [interno])
      assert.equal(r.pessoa_id, pessoaMinistro)
    })

    it('quem vê as inscrições: a diretoria e a tesouraria; o ministro só a própria; o visitante nada', async () => {
      assert.equal((await chamar(ministro, 'select id from public.evento_inscricoes')).rows.length, 1)
      assert.equal((await chamar(secretaria, 'select id from public.evento_inscricoes')).rows.length, 3)
      await assert.rejects(chamar(null, 'select id from public.evento_inscricoes'), erroComCodigo(SEM_PERMISSAO))
    })
  })

  describe('taxa e pagamento (resposta 33)', () => {
    it('com taxa, a inscrição espera o pagamento; a taxa não muda depois de haver inscritos', async () => {
      const r = await inscrever(null, pago, 'Visitante Pagante', '94999990006')
      assert.equal(r.situacao, 'aguardando_pagamento')
      await assert.rejects(
        salvar(secretaria, pago, { titulo: 'Seminário de Liderança', inicio: daqui(30), inscricao: true, inscricao_publica: true, taxa: 30, orcamento: 1000 }),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('a tesouraria registra o pagamento: confirma e entra no caixa, ligado ao evento; a secretaria não registra', async () => {
      const i = await um<{ id: string }>('select id from public.evento_inscricoes where evento_id = $1', [pago])
      await assert.rejects(chamar(secretaria, "select public.registrar_pagamento_inscricao($1, current_date, 'PIX')", [i.id]), erroComCodigo(SEM_PERMISSAO))
      await chamar(tesouraria, "select public.registrar_pagamento_inscricao($1, current_date, 'PIX')", [i.id])
      const l = await um<{ situacao: string; valor: string; evento: string; categoria: string }>(
        `select i.situacao, l.valor::text, l.evento_id as evento, c.sistema as categoria
         from public.evento_inscricoes i join public.lancamentos l on l.id = i.lancamento_id
         join public.categorias_financeiras c on c.id = l.categoria_id where i.id = $1`,
        [i.id],
      )
      assert.deepEqual(l, { situacao: 'confirmada', valor: '20.00', evento: pago, categoria: 'inscricoes_eventos' })
    })
  })

  describe('orçamento aprovado pela assembleia (resposta 31)', () => {
    let despesa: string

    it('despesa ligada ao evento só depois da aprovação, numa AGO/AGE instalada', async () => {
      const conta = await um<{ id: string }>('select conta_banco_id as id from public.config_financeiro')
      const categoria = await um<{ id: string }>("select id from public.categorias_financeiras where tipo = 'saida' and sistema is null limit 1")
      despesa = (
        await um<{ id: string }>(
          `insert into public.lancamentos (conta_id, tipo, categoria_id, data, valor, descricao, situacao)
           values ($1, 'saida', $2, current_date, 300, 'Som do seminário', 'efetivado') returning id`,
          [conta.id, categoria.id],
        )
      ).id
      await assert.rejects(chamar(tesouraria, 'select public.ligar_lancamento_evento($1, $2)', [despesa, pago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const naoInstalada = (
        await um<{ id: string }>("insert into public.encontros (tipo, titulo, inicio, local) values ('age', 'AGE', now() + interval '40 days', 'Sede') returning id")
      ).id
      await assert.rejects(chamar(presidencia, 'select public.aprovar_orcamento_evento($1, $2)', [pago, naoInstalada]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // uma assembleia de antes do orçamento não serve (revisão geral da Fase 5)
      const antiga = (
        await um<{ id: string }>(
          "insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, instalada_em) values ('ago', 'AGO antiga', now() - interval '400 days', 'Sede', 'realizado', now(), now()) returning id",
        )
      ).id
      await assert.rejects(chamar(presidencia, 'select public.aprovar_orcamento_evento($1, $2)', [pago, antiga]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const instalada = (
        await um<{ id: string }>(
          "insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, instalada_em) values ('ago', 'AGO', now(), 'Sede', 'realizado', now(), now()) returning id",
        )
      ).id
      await chamar(presidencia, 'select public.aprovar_orcamento_evento($1, $2)', [pago, instalada])
      await chamar(tesouraria, 'select public.ligar_lancamento_evento($1, $2)', [despesa, pago])
    })

    it('as finanças do evento: receitas, despesas; o ministro não vê', async () => {
      const r = await chamar(presidencia, 'select public.financas_do_evento($1) as f', [pago])
      assert.deepEqual((r.rows[0] as { f: unknown }).f, { receitas: 20, despesas: 300, aguardando: 0 })
      await assert.rejects(chamar(ministro, 'select public.financas_do_evento($1)', [pago]), erroComCodigo(SEM_PERMISSAO))
    })

    it('mudar o orçamento pede nova aprovação', async () => {
      await salvar(secretaria, pago, { titulo: 'Seminário de Liderança', inicio: daqui(30), inscricao: true, inscricao_publica: true, taxa: 20, orcamento: 1500 })
      const e = await um<{ aprovado: boolean }>('select orcamento_aprovado_em is not null as aprovado from public.eventos where id = $1', [pago])
      assert.equal(e.aprovado, false)
    })
  })

  describe('cancelar e arquivar', () => {
    it('cancelar pede motivo; o site mostra "cancelado"; publicado não se arquiva, cancelado sim', async () => {
      await assert.rejects(chamar(secretaria, 'select public.arquivar_evento($1)', [interno]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(secretaria, "select public.cancelar_evento($1, '')", [interno]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, "select public.cancelar_evento($1, 'Mudança de data')", [interno])
      assert.equal((await publicos()).find((e) => e.id === interno)?.situacao, 'cancelado')
      await assert.rejects(inscrever(ministro, interno, 'Ministro de Teste', '94999990099'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, 'select public.arquivar_evento($1)', [interno])
      assert.ok(!(await publicos()).some((e) => e.id === interno))
      await assert.rejects(db.query('delete from public.eventos where id = $1', [interno]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })
})
