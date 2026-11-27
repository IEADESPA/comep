// Revisão permanente, módulo 1 (25/11/2026), achado S1-01: a função enviar-avisos manda os avisos em grupos, com
// tempo-limite em cada envio e o resultado gravado a cada grupo. Aqui vale a parte que não depende do Deno nem do
// web-push (supabase/functions/enviar-avisos/envio.ts). Rodar: npm test

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emGrupos, enviarEmGrupos, statusDoErro, type Pendente, type Resultado } from '../../supabase/functions/enviar-avisos/envio.ts'

/** Uma linha do lote: o aviso `aviso` para o aparelho `aparelho`. */
const linha = (aviso: string, aparelho: string): Pendente => ({
  notificacao_id: aviso,
  inscricao_id: aparelho,
  endpoint: `https://fcm.googleapis.com/fcm/send/${aparelho}`,
  p256dh: 'chave-ficticia',
  auth: 'segredo-ficticio',
  titulo: 'Aviso de teste',
  texto: 'Um aviso de teste.',
  link: null,
  urgente: false,
})
/** O aviso `aviso` em `n` aparelhos. */
const aviso = (aviso: string, n: number) => Array.from({ length: n }, (_, i) => linha(aviso, `${aviso}-${i + 1}`))
const nunca = () => new Promise<number>(() => {})

describe('enviar-avisos: os envios em grupos', () => {
  it('um aviso nunca se divide entre dois grupos (a tentativa conta uma vez por rodada)', () => {
    const lote = [...aviso('a', 3), ...aviso('b', 10), ...aviso('c', 2), ...aviso('d', 1)]
    const grupos = emGrupos(lote, 10)
    assert.deepEqual(
      grupos.map((g) => g.map((l) => l.notificacao_id).join('')),
      ['aaa', 'bbbbbbbbbb', 'ccd'],
    )
    // mesmo fora de ordem, as linhas do mesmo aviso ficam juntas
    const misturado = emGrupos([linha('x', 'x1'), linha('y', 'y1'), linha('x', 'x2')], 2)
    assert.deepEqual(
      misturado.map((g) => g.map((l) => l.inscricao_id)),
      [['x1', 'x2'], ['y1']],
    )
  })

  it('grava o resultado a cada grupo, não só no fim', async () => {
    const lote = Array.from({ length: 25 }, (_, i) => linha(`aviso-${i}`, `aparelho-${i}`))
    const gravados: Resultado[][] = []
    const r = await enviarEmGrupos(
      lote,
      async () => 201,
      async (resultados) => {
        gravados.push(resultados)
        return null
      },
      { porGrupo: 10 },
    )
    assert.deepEqual(
      gravados.map((g) => g.length),
      [10, 10, 5],
    )
    assert.deepEqual(r, { enviados: 25, falhas: 0, ficaram: 0, erro: null })
  })

  it('o envio que não responde desiste no tempo-limite (status 0), sem segurar os outros', async () => {
    const lote = [linha('a', 'lento'), linha('b', 'rapido')]
    const gravados: Resultado[] = []
    const inicio = Date.now()
    const r = await enviarEmGrupos(
      lote,
      (p) => (p.inscricao_id === 'lento' ? nunca() : Promise.resolve(201)),
      async (resultados) => {
        gravados.push(...resultados)
        return null
      },
      { tempoPorEnvioMs: 30 },
    )
    assert.ok(Date.now() - inicio < 2000, 'não ficou preso')
    assert.deepEqual(
      gravados.map((g) => [g.inscricao_id, g.ok, g.status]),
      [
        ['lento', false, 0],
        ['rapido', true, 201],
      ],
    )
    assert.equal(r.falhas, 1)
  })

  it('os envios de um grupo saem ao mesmo tempo', async () => {
    let agora = 0
    let maximo = 0
    await enviarEmGrupos(
      aviso('a', 8),
      async () => {
        agora++
        maximo = Math.max(maximo, agora)
        await new Promise((r) => setTimeout(r, 5))
        agora--
        return 201
      },
      async () => null,
      { porGrupo: 10 },
    )
    assert.equal(maximo, 8)
  })

  it('o tempo da rodada acabou: para de começar grupos e o resto fica para a rodada seguinte', async () => {
    let relogio = 0
    const gravados: Resultado[] = []
    const lote = Array.from({ length: 50 }, (_, i) => linha(`aviso-${i}`, `aparelho-${i}`))
    const r = await enviarEmGrupos(
      lote,
      async () => {
        relogio += 4 // cada envio "leva" 4 unidades do relógio de mentira
        return 201
      },
      async (resultados) => {
        gravados.push(...resultados)
        return null
      },
      { porGrupo: 10, tempoDaRodadaMs: 100, agora: () => relogio },
    )
    // grupo 1 começa em 0, o 2 em 40, o 3 em 80; em 120 já passou de 100
    assert.equal(gravados.length, 30)
    assert.deepEqual(r, { enviados: 30, falhas: 0, ficaram: 20, erro: null })
  })

  it('se o resultado de um grupo não for gravado, para (o que não foi gravado não pode ser mandado de novo às cegas)', async () => {
    let enviados = 0
    const r = await enviarEmGrupos(
      Array.from({ length: 30 }, (_, i) => linha(`aviso-${i}`, `aparelho-${i}`)),
      async () => {
        enviados++
        return 201
      },
      async () => 'o banco não respondeu',
      { porGrupo: 10 },
    )
    assert.equal(enviados, 10)
    assert.deepEqual(r, { enviados: 10, falhas: 0, ficaram: 20, erro: 'o banco não respondeu' })
  })

  it('o status do erro: a resposta do serviço, ou 0 quando não houve resposta', () => {
    assert.equal(statusDoErro({ statusCode: 410 }), 410)
    assert.equal(statusDoErro(Object.assign(new Error('falhou'), { statusCode: 500 })), 500)
    assert.equal(statusDoErro(new Error('Socket timeout')), 0)
    assert.equal(statusDoErro('lixo'), 0)
    assert.equal(statusDoErro({ statusCode: 'abc' }), 0)
  })
})
