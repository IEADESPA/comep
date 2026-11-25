// Revisão permanente, módulo 1 (segurança do banco inteiro, 25/11/2026): um teste para cada achado corrigido.
// Cada bloco falha sem a migração da sua correção. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const BLOQUEADO_PELO_BANCO = 'P0001'
const FORA_DO_FORMATO = '23514'

describe('Revisão permanente, módulo 1 — segurança do banco', () => {
  let db: PGlite

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const pessoaDe = async (usuario: string) => (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])).id

  before(async () => {
    db = await criarBanco()
  })

  describe('S1-01 — os avisos no celular: uma conta não toma o envio de todos', () => {
    let intruso: string
    let vitima: string
    let pessoaIntruso: string
    let pessoaVitima: string

    const CHAVE = `B${'A'.repeat(86)}`
    const SEGREDO = 'A'.repeat(22)
    const inscrever = (quem: string, endereco: string) =>
      chamar(quem, "select public.registrar_inscricao_push($1, $2, $3, 'Celular · Chrome') as id", [endereco, CHAVE, SEGREDO]).then(
        (r) => (r.rows[0] as { id: string }).id,
      )
    const ativos = async (pessoa: string) =>
      (
        await db.query<{ id: string; endpoint: string }>(
          'select id, endpoint from public.inscricoes_push where pessoa_id = $1 and arquivado_em is null order by criado_em, id',
          [pessoa],
        )
      ).rows
    type Linha = { notificacao_id: string; inscricao_id: string }
    const lote = async (limite: number) => (await db.query<Linha>('select notificacao_id, inscricao_id from interno.push_pendentes($1)', [limite])).rows
    /** Quantas linhas do lote (aviso × aparelho) são de uma pessoa. */
    const doLote = async (linhas: Linha[], pessoa: string) => {
      const dela = new Set(
        (await db.query<{ id: string }>('select id from public.inscricoes_push where pessoa_id = $1', [pessoa])).rows.map((r) => r.id),
      )
      return linhas.filter((l) => dela.has(l.inscricao_id)).length
    }
    const avisar = (pessoa: string, chave: string, minutosAtras: number) =>
      db.query(
        "select interno.notificar(array[$1]::uuid[], 'recado', 'Recado', 'Um recado de teste.', null, $2, false, now() - make_interval(mins => $3))",
        [pessoa, chave, minutosAtras],
      )

    before(async () => {
      // o intruso só criou a conta (o cadastro é aberto); a vítima é um associado comum
      intruso = await criarUsuario(db, 'intruso.push@teste.local', 'Conta Fictícia Intrusa')
      vitima = await criarUsuario(db, 'vitima.push@teste.local', 'Associado Fictício dos Avisos')
      pessoaIntruso = await pessoaDe(intruso)
      pessoaVitima = await pessoaDe(vitima)
    })

    it('só aceita o endereço de um serviço de push conhecido (Google, Mozilla, Apple, Windows)', async () => {
      const aceitos = [
        'https://fcm.googleapis.com/fcm/send/aparelho-ficticio-1',
        'https://fcm.googleapis.com/wp/aparelho-ficticio-2',
        'https://updates.push.services.mozilla.com/wpush/v2/aparelho-ficticio-3',
        'https://web.push.apple.com/QAparelhoFicticio4',
        'https://wns2-bl2p.notify.windows.com/w/?token=aparelho-ficticio-5',
        // o domínio reservado .invalid (RFC 6761) nunca existe: é o da inscrição falsa do ponta a ponta
        'https://e2e.invalid/comep/inscricao-falsa',
      ]
      for (const endereco of aceitos) assert.ok(await inscrever(vitima, endereco), endereco)

      const recusados = [
        'https://atacante.exemplo/aparelho',
        'https://localhost:8443/aparelho',
        'https://169.254.169.254/latest/meta-data',
        'https://fcm.googleapis.com.atacante.exemplo/fcm/send/x',
        'https://fcm.googleapis.com@atacante.exemplo/fcm/send/x',
        'https://fcm.googleapis.com:8443/fcm/send/x',
        'https://outropush.apple.com/x',
        'https://push.apple.com.atacante.exemplo/x',
        'http://fcm.googleapis.com/fcm/send/x',
      ]
      for (const endereco of recusados) {
        await assert.rejects(inscrever(intruso, endereco), erroComCodigo(BLOQUEADO_PELO_BANCO), endereco)
      }
      // nem o dono do banco grava um endereço fora da lista num aparelho ativo
      await assert.rejects(
        db.query("insert into public.inscricoes_push (pessoa_id, endpoint, p256dh, auth) values ($1, 'https://atacante.exemplo/x', $2, $3)", [
          pessoaIntruso,
          CHAVE,
          SEGREDO,
        ]),
        erroComCodigo(FORA_DO_FORMATO),
      )
    })

    it('cada pessoa tem no máximo 10 aparelhos ativos: o mais antigo sai quando entra o 11º', async () => {
      for (let i = 1; i <= 15; i++) await inscrever(intruso, `https://fcm.googleapis.com/fcm/send/intruso-${i}`)
      const agora = await ativos(pessoaIntruso)
      assert.equal(agora.length, 10)
      assert.deepEqual(
        agora.map((a) => a.endpoint).sort(),
        Array.from({ length: 10 }, (_, i) => `https://fcm.googleapis.com/fcm/send/intruso-${i + 6}`).sort(),
        'ficam os 10 mais novos',
      )
      const saiu = await um<{ n: number }>(
        "select count(*)::int as n from public.inscricoes_push where pessoa_id = $1 and motivo_arquivo = 'limite'",
        [pessoaIntruso],
      )
      assert.equal(saiu.n, 5)
      // o mesmo aparelho de novo não tira ninguém
      await inscrever(intruso, 'https://fcm.googleapis.com/fcm/send/intruso-15')
      assert.equal((await ativos(pessoaIntruso)).length, 10)
    })

    it('o lote do envio não fica com uma pessoa só, e um aviso não se corta no meio dos aparelhos', async () => {
      // os dois querem os avisos a qualquer hora (o teste vale de dia e de noite)
      await chamar(intruso, `select public.salvar_preferencias_avisos('{"silencio_noite": false}'::jsonb)`)
      await chamar(vitima, `select public.salvar_preferencias_avisos('{"silencio_noite": false}'::jsonb)`)
      // o intruso: 10 aparelhos e 25 avisos mais antigos que o da vítima (250 linhas, mais que o lote de 200)
      for (let i = 1; i <= 25; i++) await avisar(pessoaIntruso, `intruso:${i}`, 120 - i)
      await avisar(pessoaVitima, 'vitima:1', 0)
      const avisoDaVitima = (await um<{ id: string }>("select id from public.notificacoes where chave = 'vitima:1'")).id

      const cheio = await lote(200)
      assert.ok(
        cheio.some((l) => l.notificacao_id === avisoDaVitima),
        'o aviso da vítima entra no lote',
      )
      assert.ok((await doLote(cheio, pessoaIntruso)) <= 30, 'no máximo 3 avisos do intruso por lote (10 aparelhos cada)')

      // lote pequeno: a vez de cada pessoa vem antes do 2º aviso de quem tem muitos
      const pequeno = await lote(11)
      assert.ok(pequeno.some((l) => l.notificacao_id === avisoDaVitima), 'a vítima entra mesmo no lote pequeno')
      assert.equal(await doLote(pequeno, pessoaIntruso), 10, 'um aviso do intruso, inteiro')

      // cada aviso que entra vai para todos os aparelhos ativos da pessoa
      const porAviso = new Map<string, number>()
      for (const l of await lote(15)) porAviso.set(l.notificacao_id, (porAviso.get(l.notificacao_id) ?? 0) + 1)
      for (const [aviso, n] of porAviso) {
        const dono = (await um<{ pessoa_id: string }>('select pessoa_id from public.notificacoes where id = $1', [aviso])).pessoa_id
        assert.equal(n, (await ativos(dono)).length, `o aviso ${aviso} vai para todos os aparelhos`)
      }
    })

    it('S3-04: o resultado conta uma tentativa por aviso a cada rodada, não uma por aparelho que falhou', async () => {
      const dono = await criarUsuario(db, 'cinco.aparelhos@teste.local', 'Associado Fictício de Cinco Aparelhos')
      const pessoa = await pessoaDe(dono)
      for (let i = 1; i <= 5; i++) await inscrever(dono, `https://fcm.googleapis.com/fcm/send/cinco-${i}`)
      await chamar(dono, `select public.salvar_preferencias_avisos('{"silencio_noite": false}'::jsonb)`)
      await avisar(pessoa, 'cinco:1', 0)
      const aviso = (await um<{ id: string }>("select id from public.notificacoes where chave = 'cinco:1'")).id
      const doAviso = async () => (await lote(1000)).filter((l) => l.notificacao_id === aviso)
      const tentativas = async () => (await um<{ t: number }>('select push_tentativas as t from public.notificacoes where id = $1', [aviso])).t

      // uma rodada: os 5 aparelhos falham (o serviço respondeu 500)
      const rodada = await doAviso()
      assert.equal(rodada.length, 5)
      await db.query('select interno.push_resultado($1::jsonb)', [
        JSON.stringify(rodada.map((l) => ({ notificacao_id: aviso, inscricao_id: l.inscricao_id, ok: false, status: 500 }))),
      ])
      assert.equal(await tentativas(), 1)
      assert.equal((await doAviso()).length, 5, 'o aviso continua na fila para a rodada seguinte')

      // na rodada seguinte, um aparelho recebe: o aviso está enviado e a tentativa não sobe
      const outra = await doAviso()
      await db.query('select interno.push_resultado($1::jsonb)', [
        JSON.stringify(outra.map((l, i) => ({ notificacao_id: aviso, inscricao_id: l.inscricao_id, ok: i === 2, status: i === 2 ? 201 : 500 }))),
      ])
      assert.equal(await tentativas(), 1)
      assert.notEqual((await um<{ e: string | null }>('select push_enviado_em as e from public.notificacoes where id = $1', [aviso])).e, null)
      assert.equal((await doAviso()).length, 0)
    })

    it('S3-04: a falha de rede ou de tempo (sem resposta do serviço) conta a tentativa do aviso, mas não derruba o aparelho', async () => {
      const dono = await criarUsuario(db, 'sem.rede@teste.local', 'Associado Fictício Sem Rede')
      const pessoa = await pessoaDe(dono)
      for (let i = 1; i <= 2; i++) await inscrever(dono, `https://fcm.googleapis.com/fcm/send/sem-rede-${i}`)
      await chamar(dono, `select public.salvar_preferencias_avisos('{"silencio_noite": false}'::jsonb)`)
      await avisar(pessoa, 'sem-rede:1', 0)
      const aviso = (await um<{ id: string }>("select id from public.notificacoes where chave = 'sem-rede:1'")).id
      const rodada = (await lote(1000)).filter((l) => l.notificacao_id === aviso)
      assert.equal(rodada.length, 2)
      await db.query('select interno.push_resultado($1::jsonb)', [
        JSON.stringify(rodada.map((l) => ({ notificacao_id: aviso, inscricao_id: l.inscricao_id, ok: false, status: 0 }))),
      ])
      assert.equal((await um<{ t: number }>('select push_tentativas as t from public.notificacoes where id = $1', [aviso])).t, 1)
      const aparelhos = (
        await db.query<{ falhas: number; arquivado: boolean }>(
          'select falhas, arquivado_em is not null as arquivado from public.inscricoes_push where pessoa_id = $1',
          [pessoa],
        )
      ).rows
      assert.deepEqual(aparelhos, [
        { falhas: 0, arquivado: false },
        { falhas: 0, arquivado: false },
      ])
    })

    it('S3-04: o recado tem limite por dia para a mesma pessoa, e o teto do lote vale para ele', async () => {
      const secretaria = await criarUsuario(db, 'secretaria.recados@teste.local', 'Secretaria Fictícia dos Recados')
      await darPerfil(db, secretaria, 'secretaria')
      const destino = await criarUsuario(db, 'destino.recados@teste.local', 'Associado Fictício dos Recados')
      const outro = await criarUsuario(db, 'outro.recados@teste.local', 'Outro Associado Fictício')
      const pessoaDestino = await pessoaDe(destino)
      await inscrever(destino, 'https://fcm.googleapis.com/fcm/send/destino-recados')
      await chamar(destino, `select public.salvar_preferencias_avisos('{"silencio_noite": false}'::jsonb)`)
      const recado = (para: string, n: number) =>
        chamar(secretaria, "select public.mandar_recado($1, 'recado', 'Recado', $2) as id", [para, `Recado de teste número ${n}.`])

      for (let i = 1; i <= 30; i++) await recado(pessoaDestino, i)
      await assert.rejects(recado(pessoaDestino, 31), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // para outra pessoa, continua
      await recado(await pessoaDe(outro), 1)

      // o recado não se desliga, mas no lote entram só 3 avisos dessa pessoa (1 aparelho: 3 linhas)
      assert.equal(await doLote(await lote(1000), pessoaDestino), 3)
    })
  })
})
