// Telas novas, parte 14 (Fase 5.5): a presença pela portaria (o código que muda a cada minuto), o roteiro da
// condução (pautas do período e o item de agora), os convidados e as resoluções numeradas por ano. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Parte 14 — assembleias: portaria, roteiro, convidados e resoluções', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let ministro: string
  let outro: string
  let semAssociacao: string
  let pessoaMinistro: string
  let pessoaPresidencia: string
  let hoje: string
  let futuro: string
  let age: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(quem: string | null, sql: string, params: unknown[] = []) =>
    ((await chamar(quem, sql, params)).rows[0] as { r: T }).r

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function encontro(tipo: string, inicio: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em)
       values ($1::public.tipo_encontro, 'Encontro de teste', ${inicio}, 'Local', 'convocado', now()) returning id`,
      [tipo],
    )
    return r.rows[0].id
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    outro = await criarUsuario(db, 'outro@teste.local', 'Outro Ministro')
    semAssociacao = await criarUsuario(db, 'visitante@teste.local', 'Ainda Não Associado')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    pessoaMinistro = await pessoaDe(ministro)
    pessoaPresidencia = await pessoaDe(presidencia)
    for (const u of [ministro, outro]) {
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [
        await pessoaDe(u),
      ])
    }
    hoje = await encontro('reuniao_mensal', "now() - interval '1 hour'")
    futuro = await encontro('ago', "now() + interval '40 days'")
    age = await encontro('age', "now() - interval '30 minutes'")
  })

  describe('a portaria', () => {
    it('só a secretaria e a presidência veem o código; ele tem 6 letras sem as que se confundem', async () => {
      await assert.rejects(chamar(ministro, 'select public.portaria_do_encontro($1)', [hoje]), erroComCodigo(SEM_PERMISSAO))
      const p = await um<{ codigo: string; segundos: number; presentes: number }>(secretaria, 'select public.portaria_do_encontro($1) as r', [hoje])
      assert.match(p.codigo, /^[A-HJ-NP-Z2-9]{6}$/)
      assert.ok(p.segundos >= 1 && p.segundos <= 60)
      assert.equal(p.presentes, 0)
      // o mesmo minuto, o mesmo código (o segredo é criado uma vez só)
      const de_novo = await um<{ codigo: string }>(presidencia, 'select public.portaria_do_encontro($1) as r', [hoje])
      assert.equal(de_novo.codigo, p.codigo)
      // encontro daqui a 40 dias: a portaria ainda não abriu
      await assert.rejects(chamar(secretaria, 'select public.portaria_do_encontro($1)', [futuro]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('ninguém lê o segredo direto', async () => {
      await assert.rejects(chamar(secretaria, 'select segredo from public.encontro_portarias'), /permission denied/)
    })

    it('o código muda a cada minuto; vale o deste minuto e o do anterior', async () => {
      const r = await db.query<{ a: string; b: string; c: string }>(
        `select interno.codigo_da_portaria(segredo, 100) as a, interno.codigo_da_portaria(segredo, 101) as b,
                interno.codigo_da_portaria(segredo, 100) as c
         from public.encontro_portarias where encontro_id = $1`,
        [hoje],
      )
      assert.notEqual(r.rows[0].a, r.rows[0].b)
      assert.equal(r.rows[0].a, r.rows[0].c)
      const anterior = await db.query<{ c: string }>(
        `select interno.codigo_da_portaria(segredo, floor(extract(epoch from now()) / 60)::bigint - 1) as c
         from public.encontro_portarias where encontro_id = $1`,
        [hoje],
      )
      const r2 = await um<{ resultado: string }>(outro, 'select public.marcar_minha_presenca($1, $2, false) as r', [hoje, anterior.rows[0].c])
      assert.equal(r2.resultado, 'registrada')
    })

    it('o ministro marca a própria presença com o código (QR ou digitado); errado ou de quem não é associado, não', async () => {
      const { codigo } = await um<{ codigo: string }>(secretaria, 'select public.portaria_do_encontro($1) as r', [hoje])
      await assert.rejects(
        chamar(ministro, 'select public.marcar_minha_presenca($1, $2, true)', [hoje, 'ZZZZZZ']),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(semAssociacao, 'select public.marcar_minha_presenca($1, $2, true)', [hoje, codigo]),
        erroComCodigo(SEM_PERMISSAO),
      )
      // digitado com minúsculas e espaço, vale igual
      const r = await um<{ resultado: string; em_dia: boolean }>(ministro, 'select public.marcar_minha_presenca($1, $2, true) as r', [
        hoje,
        ` ${codigo.slice(0, 3).toLowerCase()} ${codigo.slice(3)}`,
      ])
      assert.equal(r.resultado, 'registrada')
      assert.equal(r.em_dia, true)
      const de_novo = await um<{ resultado: string }>(ministro, 'select public.marcar_minha_presenca($1, $2, false) as r', [hoje, codigo])
      assert.equal(de_novo.resultado, 'ja_presente')
      const forma = await db.query<{ forma: string; registrado_por: string }>(
        'select forma, registrado_por from public.encontro_presencas where encontro_id = $1 and pessoa_id = $2',
        [hoje, pessoaMinistro],
      )
      assert.deepEqual(forma.rows[0], { forma: 'portaria_qr', registrado_por: pessoaMinistro })
      // o código de um encontro não vale para outro
      await chamar(secretaria, 'select public.portaria_do_encontro($1)', [age])
      await assert.rejects(chamar(outro, 'select public.marcar_minha_presenca($1, $2, false)', [age, codigo]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a tela da portaria mostra quem chegou por último', async () => {
      const p = await um<{ presentes: number; chegaram: { nome: string; forma: string }[] }>(
        secretaria,
        'select public.portaria_do_encontro($1) as r',
        [hoje],
      )
      assert.equal(p.presentes, 2)
      assert.deepEqual(p.chegaram.map((c) => c.nome).sort(), ['Ministro de Teste', 'Outro Ministro'])
      assert.ok(p.chegaram.some((c) => c.forma === 'portaria_codigo'))
    })
  })

  describe('o roteiro', () => {
    it('a abertura padrão é introdução, oração e oportunidade; a secretaria ajusta', async () => {
      const r = await db.query<{ a: string[] }>('select roteiro_abertura as a from public.encontros where id = $1', [hoje])
      assert.deepEqual(r.rows[0].a, ['Introdução', 'Oração', 'Oportunidade'])
      await chamar(secretaria, 'select public.salvar_abertura_do_roteiro($1, $2)', [hoje, ['Introdução', ' ', 'Oração', 'Palavra']])
      const r2 = await db.query<{ a: string[] }>('select roteiro_abertura as a from public.encontros where id = $1', [hoje])
      assert.deepEqual(r2.rows[0].a, ['Introdução', 'Oração', 'Palavra'])
      await assert.rejects(chamar(ministro, 'select public.salvar_abertura_do_roteiro($1, $2)', [hoje, ['X']]), erroComCodigo(SEM_PERMISSAO))
    })

    it('a pauta que chegou no período entra no fim, marcada; votação só na AGO', async () => {
      await db.query(
        "insert into public.encontro_pauta (encontro_id, ordem, titulo, deliberativo, maioria) values ($1, 1, 'Do edital', false, null)",
        [hoje],
      )
      // a reunião mensal não tem votação: a pauta nova entra como informe
      await assert.rejects(
        chamar(secretaria, 'select public.incluir_na_pauta($1, $2)', [hoje, { titulo: 'Votar na reunião', deliberativo: true }]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const informe = await um<string>(secretaria, 'select public.incluir_na_pauta($1, $2) as r', [hoje, { titulo: 'Pedido que chegou depois' }])
      const ri = await db.query<{ ordem: number; origem: string }>('select ordem, origem from public.encontro_pauta where id = $1', [informe])
      assert.deepEqual(ri.rows[0], { ordem: 2, origem: 'periodo' })
      // na AGO, pode ir a votação (maioria simples, se não disser outra)
      const agoHoje = await encontro('ago', "now() - interval '20 minutes'")
      const id = await um<string>(secretaria, 'select public.incluir_na_pauta($1, $2) as r', [
        agoHoje,
        { titulo: 'Pedido que chegou depois', deliberativo: true },
      ])
      const r = await db.query<{ ordem: number; origem: string; maioria: string; incluido: boolean }>(
        'select ordem, origem, maioria, incluido_em is not null as incluido from public.encontro_pauta where id = $1',
        [id],
      )
      assert.deepEqual(r.rows[0], { ordem: 1, origem: 'periodo', maioria: 'simples', incluido: true })
      await assert.rejects(
        chamar(secretaria, 'select public.incluir_na_pauta($1, $2)', [age, { titulo: 'Votar algo novo', deliberativo: true }]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secretaria, 'select public.incluir_na_pauta($1, $2)', [age, { titulo: 'Informe novo', deliberativo: false }])
      await assert.rejects(chamar(ministro, 'select public.incluir_na_pauta($1, $2)', [hoje, { titulo: 'X' }]), erroComCodigo(SEM_PERMISSAO))
    })

    it('o item de agora: abertura, pauta deste encontro ou encerramento', async () => {
      await chamar(presidencia, 'select public.avancar_roteiro($1, $2)', [hoje, 'abertura:1'])
      const item = await db.query<{ id: string }>('select id from public.encontro_pauta where encontro_id = $1 order by ordem limit 1', [hoje])
      await chamar(secretaria, 'select public.avancar_roteiro($1, $2)', [hoje, `pauta:${item.rows[0].id}`])
      const r = await chamar(ministro, 'select roteiro_atual from public.encontros where id = $1', [hoje])
      assert.equal((r.rows[0] as { roteiro_atual: string }).roteiro_atual, `pauta:${item.rows[0].id}`)
      await assert.rejects(chamar(secretaria, 'select public.avancar_roteiro($1, $2)', [hoje, 'abertura:9']), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const deOutro = await db.query<{ id: string }>('select id from public.encontro_pauta where encontro_id = $1 limit 1', [age])
      await assert.rejects(
        chamar(secretaria, 'select public.avancar_roteiro($1, $2)', [hoje, `pauta:${deOutro.rows[0].id}`]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(ministro, 'select public.avancar_roteiro($1, $2)', [hoje, 'encerramento']), erroComCodigo(SEM_PERMISSAO))
      await chamar(secretaria, 'select public.avancar_roteiro($1, $2)', [hoje, 'encerramento'])
    })
  })

  describe('os convidados', () => {
    it('a secretaria registra e arquiva; o ministro não vê nem registra; não contam no quórum', async () => {
      const antes = await um<{ presentes: number }>(secretaria, 'select public.contagem_quorum($1) as r', [hoje])
      const id = await um<string>(secretaria, 'select public.registrar_convidado($1, $2, $3) as r', [hoje, 'Convidado Fictício', 'Vereador (exemplo)'])
      const visto = await chamar(secretaria, 'select nome, quem_e from public.encontro_convidados where encontro_id = $1', [hoje])
      assert.deepEqual(visto.rows, [{ nome: 'Convidado Fictício', quem_e: 'Vereador (exemplo)' }])
      const peloMinistro = await chamar(ministro, 'select id from public.encontro_convidados')
      assert.equal(peloMinistro.rows.length, 0)
      await assert.rejects(chamar(ministro, 'select public.registrar_convidado($1, $2, null)', [hoje, 'Alguém']), erroComCodigo(SEM_PERMISSAO))
      const depois = await um<{ presentes: number }>(secretaria, 'select public.contagem_quorum($1) as r', [hoje])
      assert.equal(depois.presentes, antes.presentes)
      await chamar(secretaria, 'select public.arquivar_convidado($1)', [id])
      const fim = await chamar(secretaria, 'select id from public.encontro_convidados where encontro_id = $1', [hoje])
      assert.equal(fim.rows.length, 0)
    })
  })

  describe('as resoluções', () => {
    it('numeradas por ano, uma depois da outra; anulada, o número não volta', async () => {
      const a = await um<{ numero: number; ano: number }>(secretaria, 'select public.protocolar_resolucao($1, $2, null) as r', [
        hoje,
        'Fica aprovado o calendário de reuniões.',
      ])
      const b = await um<{ id: string; numero: number }>(presidencia, 'select public.protocolar_resolucao($1, $2, null) as r', [
        age,
        'Fica criada a comissão de teste.',
      ])
      assert.equal(a.numero, 1)
      assert.equal(b.numero, 2)
      await chamar(secretaria, 'select public.anular_resolucao($1, $2)', [b.id, 'Engano de digitação'])
      const c = await um<{ numero: number }>(secretaria, 'select public.protocolar_resolucao($1, $2, null) as r', [age, 'Fica criada a comissão.'])
      assert.equal(c.numero, 3)
      const r = await db.query<{ protocolada_por: string }>('select protocolada_por from public.resolucoes where id = $1', [b.id])
      assert.equal(r.rows[0].protocolada_por, pessoaPresidencia)
    })

    it('só no dia, só a diretoria protocola; o item da pauta tem de ser do encontro', async () => {
      await assert.rejects(
        chamar(secretaria, 'select public.protocolar_resolucao($1, $2, null)', [futuro, 'Resolução antecipada']),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(ministro, 'select public.protocolar_resolucao($1, $2, null)', [hoje, 'Texto qualquer']), erroComCodigo(SEM_PERMISSAO))
      const deOutro = await db.query<{ id: string }>('select id from public.encontro_pauta where encontro_id = $1 limit 1', [age])
      await assert.rejects(
        chamar(secretaria, 'select public.protocolar_resolucao($1, $2, $3)', [hoje, 'Texto da resolução', deOutro.rows[0].id]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('antes da ata assinada, o ministro não lê; a diretoria lê sempre', async () => {
      const antes = await chamar(ministro, 'select numero from public.resolucoes where encontro_id = $1', [hoje])
      assert.equal(antes.rows.length, 0)
      const diretoria = await chamar(secretaria, 'select numero from public.resolucoes where encontro_id = $1', [hoje])
      assert.equal(diretoria.rows.length, 1)
    })

    it('a ata em assinatura trava as resoluções', async () => {
      await db.query(
        `insert into public.atas (encontro_id, texto, assinada_presidente_por, assinada_presidente_em)
         values ($1, 'Ata resumida da assembleia de teste.', $2, now())`,
        [age, pessoaPresidencia],
      )
      await assert.rejects(
        chamar(secretaria, 'select public.protocolar_resolucao($1, $2, null)', [age, 'Depois da assinatura']),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const r = await db.query<{ id: string }>('select id from public.resolucoes where encontro_id = $1 and anulada_em is null', [age])
      await assert.rejects(chamar(secretaria, 'select public.anular_resolucao($1, $2)', [r.rows[0].id, 'Tarde demais']), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })
})
