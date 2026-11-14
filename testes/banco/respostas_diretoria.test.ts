// Entrega 4.5: as regras que mudaram com as respostas de 14/11/2026 (PROJETO.md, seções 11.3 e 11.5).
// Todos falham sem a migração 20261114160000_respostas_diretoria.sql; os da revisão (no fim), sem a
// 20261114163000_respostas_diretoria_revisao.sql. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Entrega 4.5 — respostas de 14/11/2026', () => {
  let db: PGlite
  let presid: string
  let secret: string
  const u: string[] = []
  const p: string[] = []
  let eleicao: string
  let exercicio: number

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const tem = async (quem: string, perfil: string) =>
    ((await chamar(quem, `select interno.tenho_perfil('${perfil}') as t`)).rows[0] as { t: boolean }).t
  const emDia = async (pessoa: string) => (await um<{ e: boolean }>('select interno.esta_em_dia($1) as e', [pessoa])).e
  const registrar = (membros: { cargo: string; pessoa: string }[], inicio: string, fim: string, encontro: string | null = eleicao) =>
    chamar(
      presid,
      `select public.registrar_diretoria(jsonb_build_object('inicio', ${inicio}, 'fim', ${fim}, 'encontro_id', $2::text,
         'documento', 'Ata da eleição (teste)', 'membros', $1::jsonb)) as n`,
      [JSON.stringify(membros.map((m) => ({ cargo: m.cargo, pessoa_id: m.pessoa }))), encontro],
    )

  async function assembleia(tipo: string, minutosAtras: number, situacao = 'convocado'): Promise<string> {
    return (
      await um<{ id: string }>(
        `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, presenca_encerrada_em)
         values ($1::public.tipo_encontro, 'Assembleia', now() - make_interval(mins => $2), 'Sede', $3::public.situacao_encontro, now(),
                 case when $3::text = 'realizado' then now() end) returning id`,
        [tipo, minutosAtras, situacao],
      )
    ).id
  }

  async function cobranca(pessoa: string, tipo: string, competencia: string, vencimento: string): Promise<string> {
    return (
      await um<{ id: string }>(
        `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
         values ($1, interno.exercicio_de(${competencia}), $2::public.tipo_valor, ${competencia}, ${vencimento}, 'nao_presidente', 20) returning id`,
        [pessoa, tipo],
      )
    ).id
  }

  before(async () => {
    db = await criarBanco()
    presid = await criarUsuario(db, 'presid@teste.local', 'Presidência à Mão')
    secret = await criarUsuario(db, 'secret@teste.local', 'Secretaria à Mão')
    await darPerfil(db, presid, 'presidencia')
    await darPerfil(db, secret, 'secretaria')
    await db.query("update public.valores_contribuicao set vigente_desde = '2020-01-01'")
    for (let i = 1; i <= 13; i++) {
      u.push(await criarUsuario(db, `a${i}@teste.local`, `Associado ${i}`))
      const r = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u[i - 1]])
      p.push(r.id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [r.id])
    }
    exercicio = (await um<{ e: number }>('select interno.exercicio_de(current_date) as e')).e
    eleicao = (
      await um<{ id: string }>(
        `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, instalada_em)
         values ('ago', 'Eleição', now() - interval '30 days', 'Sede', 'realizado', now(), now()) returning id`,
      )
    ).id
  })

  describe('diretoria (perguntas 13, 20 e 27)', () => {
    it('o secretário executivo tem o acesso da secretaria e da tesouraria', async () => {
      await registrar(
        [
          { cargo: 'secretario_executivo', pessoa: p[0] },
          { cargo: 'conselheiro_fiscal', pessoa: p[1] },
          { cargo: 'conselheiro_fiscal', pessoa: p[2] },
        ],
        'current_date - 10',
        'current_date + 1400',
        null,
      )
      assert.equal(await tem(u[0], 'secretaria'), true)
      assert.equal(await tem(u[0], 'tesouraria'), true)
      assert.equal(await tem(u[0], 'presidencia'), false)
      const r = await chamar(u[0], 'select public.meus_perfis() as m')
      assert.deepEqual((r.rows[0] as { m: string[] }).m.sort(), ['ministro', 'secretaria', 'tesouraria'])
    })

    it('tempo de mandato e membros do Conselho Fiscal vêm das configurações (só a presidência muda)', async () => {
      // 5 anos não passam com o padrão de 4
      await assert.rejects(
        registrar([{ cargo: 'segundo_tesoureiro', pessoa: p[3] }], 'current_date + 1', "current_date + interval '5 years'"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const s = await chamar(secret, 'update public.config_assembleias set anos_mandato = 5, membros_conselho_fiscal = 2')
      assert.equal(s.affectedRows, 0)
      await chamar(presid, 'update public.config_assembleias set anos_mandato = 5, membros_conselho_fiscal = 2')
      await registrar([{ cargo: 'segundo_tesoureiro', pessoa: p[3] }], 'current_date + 1', "current_date + interval '5 years'")
      // o Conselho Fiscal já tem os 2 da configuração
      await assert.rejects(registrar([{ cargo: 'conselheiro_fiscal', pessoa: p[4] }], 'current_date + 1', 'current_date + 100'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presid, 'update public.config_assembleias set anos_mandato = 4, membros_conselho_fiscal = 3')
    })
  })

  describe('quórum e maiorias (perguntas 24 e 25)', () => {
    it('metade mais um, para cima: 74 → 38; 75 → 39; 3 → 3', async () => {
      const r = await um<{ a: number; b: number; c: number }>(
        'select interno.quorum_primeira_chamada(74) as a, interno.quorum_primeira_chamada(75) as b, interno.quorum_primeira_chamada(3) as c',
      )
      assert.deepEqual(r, { a: 38, b: 39, c: 3 })
    })

    it('3/5 sobre os votos válidos: 12 sim e 8 não aprovam, mesmo com 5 abstenções entre 25 presentes', async () => {
      const r = await um<{ sim: boolean; nao: boolean; vazio: boolean }>(
        `select interno.aprovada('tres_quintos', 25, 12, 8) as sim, interno.aprovada('tres_quintos', 25, 11, 9) as nao,
                interno.aprovada('dois_tercos', 25, 0, 0) as vazio`,
      )
      assert.deepEqual(r, { sim: true, nao: false, vazio: false })
    })
  })

  describe('em dia (perguntas 19 e 23)', () => {
    it('pagamento informado até o vencimento conta como em dia até a conferência; recusado, volta ao atraso', async () => {
      const pessoa = p[3]
      const c1 = await cobranca(pessoa, 'mensal', "date_trunc('month', current_date)::date", 'current_date - 3')
      assert.equal(await emDia(pessoa), false)
      const i1 = await um<{ id: string }>(
        `insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma, criado_em)
         values ($1, $2, current_date - 5, 20, 'PIX', now() - interval '5 days') returning id`,
        [c1, pessoa],
      )
      assert.equal(await emDia(pessoa), true)
      const v = await chamar(presid, 'select em_dia from public.vw_situacao_contribuicao where pessoa_id = $1', [pessoa])
      assert.equal((v.rows[0] as { em_dia: boolean }).em_dia, true)
      // informado depois do vencimento não conta
      const c2 = await cobranca(pessoa, 'mensal', "(date_trunc('month', current_date) - interval '1 month')::date", 'current_date - 3')
      await db.query(
        "insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma) values ($1, $2, current_date, 20, 'PIX')",
        [c2, pessoa],
      )
      assert.equal(await emDia(pessoa), false)
      await db.query("update public.informes_pagamento set situacao = 'cancelado' where cobranca_id = $1", [c2])
      await db.query("update public.cobrancas set situacao = 'cancelada', cancelada_como = 'manual' where id = $1", [c2])
      assert.equal(await emDia(pessoa), true)
      await db.query("update public.informes_pagamento set situacao = 'recusado', motivo_recusa = 'Não encontrado' where id = $1", [i1.id])
      assert.equal(await emDia(pessoa), false)
    })

    it('na assembleia, o que vence no dia dela também precisa estar pago (o anual vence na AGO)', async () => {
      const pessoa = p[4]
      await cobranca(pessoa, 'anual', 'make_date(interno.exercicio_de(current_date), 4, 1)', 'current_date')
      const ago = await assembleia('ago', 10)
      assert.equal(await emDia(pessoa), true, 'vencendo hoje, ainda não está em atraso')
      const r = await chamar(secret, 'select public.lista_presenca($1) as l', [ago])
      const linha = (r.rows[0] as { l: { pessoa_id: string; em_dia: boolean }[] }).l.find((x) => x.pessoa_id === pessoa)
      assert.equal(linha?.em_dia, false, 'na AGO de hoje, não vota sem o anual pago')
      await db.query("update public.encontros set situacao = 'cancelado', cancelado_em = now(), motivo_cancelamento = 'teste' where id = $1", [ago])
    })
  })

  describe('contribuições (pergunta 18)', () => {
    it('o anual vence na data da AGO que abre o exercício; cancelada a AGO, volta ao dia das configurações', async () => {
      const pessoa = p[5]
      const c = await cobranca(pessoa, 'anual', `make_date(${exercicio + 1}, 4, 1)`, `make_date(${exercicio + 1}, 4, 30)`)
      const ago = (
        await um<{ id: string }>(
          `insert into public.encontros (tipo, titulo, inicio, local) values ('ago', 'AGO', make_date($1, 4, 20) + time '19:00', 'Sede') returning id`,
          [exercicio + 1],
        )
      ).id
      const venc = async () => (await um<{ v: string }>('select vencimento::text as v from public.cobrancas where id = $1', [c])).v
      assert.equal(await venc(), `${exercicio + 1}-04-30`, 'em rascunho, a AGO ainda não muda o vencimento')
      await db.query("update public.encontros set situacao = 'convocado', convocado_em = now() where id = $1", [ago])
      assert.equal(await venc(), `${exercicio + 1}-04-20`)
      await db.query("update public.encontros set situacao = 'cancelado', cancelado_em = now(), motivo_cancelamento = 'teste' where id = $1", [ago])
      assert.equal(await venc(), `${exercicio + 1}-04-30`)
    })

    it('troca no meio do exercício: mensal → anual proporcional deste mês em diante; anual → mensal; anual pago não volta', async () => {
      const pessoa = p[6]
      await db.query('select interno.gerar_cobrancas_pessoa($1, $2)', [pessoa, exercicio])
      // a de abril já foi informada (há pagamento no exercício): a troca vale deste mês em diante
      const abril = await um<{ id: string }>("select id from public.cobrancas where pessoa_id = $1 and competencia = make_date($2, 4, 1)", [pessoa, exercicio])
      await db.query("insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma) values ($1, $2, current_date, 20, 'PIX')", [
        abril.id,
        pessoa,
      ])
      const meses = (
        await um<{ n: number }>(
          `select count(*)::int as n from public.cobrancas where pessoa_id = $1 and exercicio = $2 and tipo = 'mensal' and situacao = 'aberta'
             and competencia >= date_trunc('month', current_date) and id <> $3`,
          [pessoa, exercicio, abril.id],
        )
      ).n
      await chamar(u[6], "select public.escolher_plano($1, $2, 'anual')", [pessoa, exercicio])
      const anual = await um<{ valor: string; obs: string | null }>(
        "select valor::text, observacao as obs from public.cobrancas where pessoa_id = $1 and tipo = 'anual' and situacao = 'aberta'",
        [pessoa],
      )
      assert.equal(Number(anual.valor), Math.round((200 * meses * 100) / 12) / 100)
      // anual → mensal: o anual em aberto sai e as mensalidades voltam
      await chamar(u[6], "select public.escolher_plano($1, $2, 'mensal')", [pessoa, exercicio])
      const voltaram = await um<{ n: number }>(
        `select count(*)::int as n from public.cobrancas where pessoa_id = $1 and exercicio = $2 and tipo = 'mensal' and situacao = 'aberta'
           and competencia >= date_trunc('month', current_date) and id <> $3`,
        [pessoa, exercicio, abril.id],
      )
      assert.equal(voltaram.n, meses)
      // anual pago: não há o que trocar
      await chamar(u[6], "select public.escolher_plano($1, $2, 'anual')", [pessoa, exercicio])
      await db.query(
        "update public.cobrancas set situacao = 'paga', pago_em = current_date, valor_pago = valor, forma_pagamento = 'PIX' where pessoa_id = $1 and tipo = 'anual' and situacao = 'aberta'",
        [pessoa],
      )
      await assert.rejects(chamar(u[6], "select public.escolher_plano($1, $2, 'mensal')", [pessoa, exercicio]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('desligamento (perguntas 5 e 22)', () => {
    it('I, III, IV e V: a diretoria homologa e registra; I e III pedem o documento; II vai à votação; o ministro não registra', async () => {
      const alvo = p[7]
      const desligar = (quem: string, inciso: string, obs: string | null) =>
        chamar(quem, 'select public.registrar_desligamento($1, $2, current_date, $3)', [alvo, inciso, obs])
      await assert.rejects(desligar(u[8], 'I', 'Carta'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(desligar(secret, 'II', 'Conduta'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(desligar(secret, 'I', null), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await desligar(secret, 'I', 'Carta do associado de 10/11/2026')
      const d = await um<{ inciso: string; votado: boolean; situacao: string }>(
        `select d.inciso, d.deliberacao_id is not null as votado, a.situacao::text
         from public.desligamentos d join public.associados a on a.id = d.associado_id where a.pessoa_id = $1`,
        [alvo],
      )
      assert.deepEqual(d, { inciso: 'I', votado: false, situacao: 'desligado' })
    })

    it('IV: só com 3 faltas seguidas às assembleias (a reunião mensal não conta)', async () => {
      const alvo = p[8]
      await assembleia('reuniao_mensal', 5, 'realizado')
      await assembleia('age', 4, 'realizado')
      await assembleia('ago', 3, 'realizado')
      await assert.rejects(
        chamar(secret, "select public.registrar_desligamento($1, 'IV', current_date, null)", [alvo]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assembleia('age', 2, 'realizado')
      await chamar(secret, "select public.registrar_desligamento($1, 'IV', current_date, null)", [alvo])
      const a = await um<{ situacao: string }>('select situacao::text from public.associados where pessoa_id = $1', [alvo])
      assert.equal(a.situacao, 'desligado')
    })
  })

  describe('jubilação (pergunta 20)', () => {
    it('é item da assembleia, com o documento da denominação; a reunião mensal não aprova jubilação', async () => {
      const salvar = (tipo: string, descricao: string | null) =>
        chamar(secret, 'select public.salvar_encontro(null, $1::jsonb)', [
          JSON.stringify({
            tipo,
            titulo: 'Assembleia',
            inicio: new Date(Date.now() + 60 * 86_400_000).toISOString(),
            local: 'Sede',
            fundamento: 'Conselho Diretor',
            pauta: [{ titulo: 'Jubilação', descricao, deliberativo: tipo !== 'reuniao_mensal', maioria: 'simples', jubilacao_pessoa_id: p[9] }],
          }),
        ])
      await assert.rejects(salvar('age', null), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar('reuniao_mensal', 'Ofício da denominação'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await salvar('age', 'Ofício da denominação nº 12/2026')
      const r = await um<{ n: number }>('select count(*)::int as n from public.encontro_pauta where jubilacao_pessoa_id = $1', [p[9]])
      assert.equal(r.n, 1)
    })

    it('aprovada na assembleia, o associado fica jubilado (isento); não refaz a votação; o jubilado vota, mas não é votado', async () => {
      const alvo = p[9]
      await db.query('select interno.gerar_cobrancas_pessoa($1, $2)', [alvo, exercicio])
      const age = await assembleia('age', 70) // passada a hora da 2ª chamada
      const item = (
        await um<{ id: string }>(
          `insert into public.encontro_pauta (encontro_id, ordem, titulo, descricao, deliberativo, maioria, jubilacao_pessoa_id)
           values ($1, 1, 'Jubilação', 'Ofício da denominação', true, 'simples', $2) returning id`,
          [age, alvo],
        )
      ).id
      for (const pessoa of [p[0], p[10]]) await chamar(secret, "select public.registrar_presenca($1, $2, 'lista')", [age, pessoa])
      await chamar(secret, 'select public.instalar_assembleia($1)', [age])
      await chamar(secret, 'select public.registrar_votacao($1, 2, 0, 0, null, null, null)', [item])
      const a = await um<{ jubilado: boolean; futuras: number }>(
        `select a.jubilado, (select count(*)::int from public.cobrancas c where c.pessoa_id = a.pessoa_id and c.situacao = 'aberta'
           and c.competencia >= date_trunc('month', current_date)) as futuras
         from public.associados a where a.pessoa_id = $1`,
        [alvo],
      )
      assert.deepEqual(a, { jubilado: true, futuras: 0 })
      await assert.rejects(chamar(secret, 'select public.registrar_votacao($1, 0, 2, 0, null, null, null)', [item]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // não pode ser votado
      await assert.rejects(
        registrar([{ cargo: 'vice_presidente', pessoa: alvo }], 'current_date + 1', 'current_date + 100'),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })

  describe('revisão da entrega 4.5', () => {
    it('diminuir o Conselho Fiscal nas configurações não trava a renúncia de quem já está no cargo', async () => {
      // os conselheiros p[1] e p[2] estão no cargo; a presidência passa o Conselho Fiscal para 1 membro
      await chamar(presid, 'update public.config_assembleias set membros_conselho_fiscal = 1')
      const m = await um<{ id: string }>("select id from public.mandatos where pessoa_id = $1 and cargo = 'conselheiro_fiscal'", [p[1]])
      await chamar(u[1], "select public.encerrar_mandato($1, current_date, 'Renúncia', null)", [m.id])
      const r = await um<{ encerrado: boolean }>('select encerrado_em is not null as encerrado from public.mandatos where id = $1', [m.id])
      assert.equal(r.encerrado, true)
      await chamar(presid, 'update public.config_assembleias set membros_conselho_fiscal = 3')
    })

    it('arquivar o cadastro e cadastrar de novo não muda a jubilação (só a assembleia)', async () => {
      const pessoa = p[11]
      await chamar(secret, 'update public.associados set arquivado_em = now() where pessoa_id = $1', [pessoa])
      await assert.rejects(
        chamar(
          secret,
          "insert into public.associados (pessoa_id, forma_admissao, admitido_em, jubilado) values ($1, 'cadastro_inicial', '2021-06-01', true)",
          [pessoa],
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('na assembleia, o pagamento informado depois de ela começar não conta', async () => {
      const ago = await assembleia('age', 10)
      const tarde = p[12]
      const c = await cobranca(tarde, 'mensal', "date_trunc('month', current_date)::date", 'current_date')
      await db.query("insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma) values ($1, $2, current_date, 20, 'PIX')", [
        c,
        tarde,
      ])
      const r = await um<{ e: boolean }>('select interno.em_dia_no_encontro($1, $2) as e', [tarde, ago])
      assert.equal(r.e, false, 'informou durante a assembleia')
      // informado antes de começar (no prazo), conta
      await db.query(
        "update public.informes_pagamento set situacao = 'cancelado' where cobranca_id = $1",
        [c],
      )
      await db.query(
        `insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma, criado_em)
         values ($1, $2, current_date, 20, 'PIX', (select inicio - interval '1 minute' from public.encontros where id = $3))`,
        [c, tarde, ago],
      )
      const antes = await um<{ e: boolean }>('select interno.em_dia_no_encontro($1, $2) as e', [tarde, ago])
      assert.equal(antes.e, true)
    })
  })
})
