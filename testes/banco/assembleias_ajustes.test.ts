// Ajustes da Parte 14 pedidos pela revisão de 23/11/2026 (C:\tmp\comep-revisao\REVISAO-telas-parte-14.md):
// 1. o segredo da portaria não vai para a auditoria (que a presidência e o admin técnico leem);
// 5. o visitante (anon) não chama nenhuma das 9 funções; o perfil errado não arquiva convidado nem anula resolução;
// 7. a entrada lixo recebe uma mensagem em português, não o erro cru do banco;
// 8. depois da primeira assinatura da ata, nada do que entra no texto da ata muda (convidados, abertura e roteiro).
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Parte 14 — ajustes da revisão', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let adminTecnico: string
  let tesouraria: string
  let ministro: string
  let hoje: string
  let assinada: string

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
    adminTecnico = await criarUsuario(db, 'admin@teste.local', 'Admin Técnico de Teste')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, adminTecnico, 'admin_tecnico')
    await darPerfil(db, tesouraria, 'tesouraria')
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [
      await pessoaDe(ministro),
    ])
    hoje = await encontro('reuniao_mensal', "now() - interval '1 hour'")
    assinada = await encontro('age', "now() - interval '2 hours'")
  })

  describe('o segredo da portaria (achado 1)', () => {
    it('não aparece na auditoria, nem ao criar nem ao mudar a linha', async () => {
      await chamar(secretaria, 'select public.portaria_do_encontro($1)', [hoje])
      // uma mudança na linha (o arquivamento) também passa pela auditoria
      await db.query('update public.encontro_portarias set arquivado_em = now() where encontro_id = $1', [hoje])
      await chamar(secretaria, 'select public.portaria_do_encontro($1)', [hoje])

      for (const quem of [presidencia, adminTecnico]) {
        const r = await chamar(
          quem,
          `select operacao, dados_antes ->> 'segredo' as antes, dados_depois ->> 'segredo' as depois
           from public.auditoria where tabela = 'encontro_portarias' order by id`,
        )
        const linhas = r.rows as { operacao: string; antes: string | null; depois: string | null }[]
        assert.deepEqual(
          linhas.map((l) => l.operacao),
          ['INSERT', 'UPDATE', 'INSERT'],
        )
        for (const l of linhas) {
          for (const valor of [l.antes, l.depois]) assert.ok(valor === null || valor === '(protegido)', `segredo à vista: ${valor}`)
        }
      }
    })

    it('o código da portaria não se refaz com o que a auditoria guarda', async () => {
      const { codigo } = await um<{ codigo: string }>(secretaria, 'select public.portaria_do_encontro($1) as r', [hoje])
      const r = await chamar(
        adminTecnico,
        `select dados_depois ->> 'segredo' as s from public.auditoria
         where tabela = 'encontro_portarias' and operacao = 'INSERT' order by id desc limit 1`,
      )
      const guardado = (r.rows[0] as { s: string | null }).s
      // o que a auditoria guarda não é o segredo: não dá para refazer o código do minuto
      let refeito: string | null = null
      try {
        const x = await db.query<{ c: string }>(
          "select interno.codigo_da_portaria(decode(ltrim($1, '\\x'), 'hex'), floor(extract(epoch from now()) / 60)::bigint) as c",
          [guardado ?? ''],
        )
        refeito = x.rows[0].c
      } catch {
        refeito = null
      }
      assert.notEqual(refeito, codigo)
    })
  })

  describe('quem pode (achado 5)', () => {
    const NULO = '00000000-0000-0000-0000-000000000000'
    const FUNCOES: [string, unknown[]][] = [
      ['select public.portaria_do_encontro($1)', [NULO]],
      ['select public.marcar_minha_presenca($1, $2, true)', [NULO, 'ABCDEF']],
      ['select public.incluir_na_pauta($1, $2)', [NULO, { titulo: 'Pauta' }]],
      ['select public.salvar_abertura_do_roteiro($1, $2)', [NULO, ['Oração']]],
      ['select public.avancar_roteiro($1, $2)', [NULO, 'encerramento']],
      ['select public.registrar_convidado($1, $2, null)', [NULO, 'Convidado Fictício']],
      ['select public.arquivar_convidado($1)', [NULO]],
      ['select public.protocolar_resolucao($1, $2, null)', [NULO, 'Fica resolvido o teste.']],
      ['select public.anular_resolucao($1, $2)', [NULO, 'Engano']],
    ]

    it('o visitante (sem login) não chama nenhuma das 9 funções', async () => {
      for (const [sql, params] of FUNCOES) {
        await assert.rejects(chamar(null, sql, params), erroComCodigo(SEM_PERMISSAO), sql)
      }
    })

    it('o ministro, a tesouraria e o admin técnico não arquivam convidado nem anulam resolução', async () => {
      const convidado = await um<string>(secretaria, 'select public.registrar_convidado($1, $2, null) as r', [hoje, 'Convidado Fictício'])
      const resolucao = await um<{ id: string }>(secretaria, 'select public.protocolar_resolucao($1, $2, null) as r', [
        hoje,
        'Fica aprovado o calendário de teste.',
      ])
      for (const quem of [ministro, tesouraria, adminTecnico]) {
        await assert.rejects(chamar(quem, 'select public.arquivar_convidado($1)', [convidado]), erroComCodigo(SEM_PERMISSAO))
        await assert.rejects(chamar(quem, 'select public.anular_resolucao($1, $2)', [resolucao.id, 'Engano']), erroComCodigo(SEM_PERMISSAO))
      }
      const ainda = await db.query<{ n: number }>(
        `select (select count(*) from public.encontro_convidados where id = $1 and arquivado_em is null)::int
              + (select count(*) from public.resolucoes where id = $2 and anulada_em is null)::int as n`,
        [convidado, resolucao.id],
      )
      assert.equal(ainda.rows[0].n, 2)
    })
  })

  describe('a entrada lixo recebe mensagem em português (achado 7)', () => {
    it('o item do roteiro com 36 hífens no lugar do código da pauta', async () => {
      await assert.rejects(
        chamar(secretaria, 'select public.avancar_roteiro($1, $2)', [hoje, `pauta:${'-'.repeat(36)}`]),
        (e: unknown) => (e as { code?: string }).code === BLOQUEADO_PELO_BANCO && /roteiro/i.test((e as Error).message),
      )
    })

    it('o convidado e o "quem é" com mais de 150 letras', async () => {
      const longo = 'a'.repeat(151)
      for (const [nome, quemE] of [
        [longo, null],
        ['Convidado Fictício', longo],
      ]) {
        await assert.rejects(
          chamar(secretaria, 'select public.registrar_convidado($1, $2, $3)', [hoje, nome, quemE]),
          (e: unknown) => (e as { code?: string }).code === BLOQUEADO_PELO_BANCO && /150 letras/.test((e as Error).message),
        )
      }
    })

    it('a descrição da pauta com 5.000 letras', async () => {
      await assert.rejects(
        chamar(secretaria, 'select public.incluir_na_pauta($1, $2)', [hoje, { titulo: 'Informe', descricao: 'a'.repeat(5000) }]),
        (e: unknown) => (e as { code?: string }).code === BLOQUEADO_PELO_BANCO && /letras/.test((e as Error).message),
      )
    })

    it('o motivo da anulação com mais de 500 letras', async () => {
      const r = await um<{ id: string }>(secretaria, 'select public.protocolar_resolucao($1, $2, null) as r', [hoje, 'Fica resolvido o motivo longo.'])
      await assert.rejects(
        chamar(secretaria, 'select public.anular_resolucao($1, $2)', [r.id, 'a'.repeat(501)]),
        (e: unknown) => (e as { code?: string }).code === BLOQUEADO_PELO_BANCO && /500 letras/.test((e as Error).message),
      )
    })
  })

  describe('depois da primeira assinatura da ata (achado 8)', () => {
    let convidado: string

    before(async () => {
      convidado = await um<string>(secretaria, 'select public.registrar_convidado($1, $2, null) as r', [assinada, 'Convidado Antes da Ata'])
      await db.query(
        `insert into public.atas (encontro_id, texto, assinada_secretario_por, assinada_secretario_em)
         values ($1, 'Ata resumida da assembleia de teste.', $2, now())`,
        [assinada, await pessoaDe(secretaria)],
      )
    })

    it('não se registra nem se tira convidado', async () => {
      await assert.rejects(
        chamar(secretaria, 'select public.registrar_convidado($1, $2, null)', [assinada, 'Convidado Depois da Ata']),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(secretaria, 'select public.arquivar_convidado($1)', [convidado]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('não se troca a abertura nem se avança o roteiro', async () => {
      await assert.rejects(
        chamar(secretaria, 'select public.salvar_abertura_do_roteiro($1, $2)', [assinada, ['Oração']]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(chamar(secretaria, 'select public.avancar_roteiro($1, $2)', [assinada, 'encerramento']), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await db.query<{ n: number }>(
        "select count(*)::int as n from public.encontro_convidados where encontro_id = $1 and arquivado_em is null",
        [assinada],
      )
      assert.equal(r.rows[0].n, 1)
    })
  })
})
