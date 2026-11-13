// Fase 3.2/3.3: credencial digital, validação pública pelo QR Code e foto pública. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Dados = { fim_mandato: string | null; texto_verso: string; credenciais: Record<string, unknown>[] }

describe('Fase 3.2 — credencial digital e validação', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let outro: string
  let semAssociacao: string
  let pessoaMinistro: string
  let pessoaOutro: string
  let codigo: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function dados(quem: string, pessoas: string[]): Promise<Dados> {
    const r = await chamar(quem, 'select public.dados_credenciais($1::uuid[]) as d', [pessoas])
    return (r.rows[0] as { d: Dados }).d
  }

  async function validar(cod: string) {
    const r = await chamar(null, 'select public.validar_credencial($1) as v', [cod])
    return (r.rows[0] as { v: Record<string, unknown> }).v
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    outro = await criarUsuario(db, 'outro@teste.local', 'Outro Ministro')
    semAssociacao = await criarUsuario(db, 'visitante@teste.local', 'Ainda Não Associado')
    await darPerfil(db, secretaria, 'secretaria')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome, sigla) values ('Igreja de Teste', 'IDT') returning id")
    const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
    pessoaMinistro = await pessoaDe(ministro)
    pessoaOutro = await pessoaDe(outro)
    for (const p of [pessoaMinistro, pessoaOutro]) {
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao) values ($1, $2, $3)', [
        p,
        i.rows[0].id,
        'Pastor auxiliar',
      ])
      await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [p, t.rows[0].id])
    }
    await db.query("update public.pessoas set cpf = '52998224725', nome_mae = 'Maria de Teste' where id = $1", [pessoaMinistro])
  })

  describe('dados da credencial', () => {
    it('o associado vê a própria: com o código do QR (o mesmo nas próximas vezes) e os dados', async () => {
      const d = await dados(ministro, [pessoaMinistro])
      assert.equal(d.credenciais.length, 1)
      const c = d.credenciais[0]
      codigo = c.codigo as string
      assert.match(codigo, /^[0-9a-f]{32}$/)
      assert.equal(c.cpf, '52998224725')
      assert.equal(c.igreja_sigla, 'IDT')
      assert.equal(c.funcao, 'Pastor auxiliar')
      assert.equal(c.titulo, 'Pastor(a)')
      assert.equal(c.em_dia, true)
      assert.match(d.texto_verso, /intransferível/)
      assert.equal((await dados(ministro, [pessoaMinistro])).credenciais[0].codigo, codigo)
    })

    it('a credencial de outra pessoa só a secretaria (ou a presidência) vê', async () => {
      await assert.rejects(dados(ministro, [pessoaOutro]), erroComCodigo(SEM_PERMISSAO))
      const d = await dados(secretaria, [pessoaMinistro, pessoaOutro])
      assert.equal(d.credenciais.length, 2)
    })

    it('quem não é associado ativo não tem credencial', async () => {
      const p = await pessoaDe(semAssociacao)
      assert.equal((await dados(semAssociacao, [p])).credenciais.length, 0)
    })
  })

  describe('validação pública (QR Code)', () => {
    it('o visitante vê só nome, título, nº, igreja (sigla) e a situação — nada de CPF ou filiação', async () => {
      const v = await validar(codigo)
      assert.equal(v.situacao, 'valida')
      assert.equal(v.nome, 'Ministro de Teste')
      assert.equal(v.igreja, 'IDT')
      assert.equal(v.em_dia, true)
      for (const sigiloso of ['cpf', 'nome_mae', 'nome_pai', 'pessoa_id', 'codigo']) assert.equal(sigiloso in v, false, sigiloso)
    })

    it('em atraso: a credencial vale, mas mostra que está inapto para votar', async () => {
      await db.query(
        `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
         values ($1, 2025, 'mensal', '2025-05-01', '2025-05-10', 'nao_presidente', 20)`,
        [pessoaMinistro],
      )
      const v = await validar(codigo)
      assert.equal(v.situacao, 'valida')
      assert.equal(v.em_dia, false)
    })

    it('validade pelo fim do mandato: depois dele, "vencida" até a posse da nova diretoria', async () => {
      await chamar(secretaria, "update public.config_credencial set fim_mandato = current_date + 100")
      assert.equal((await validar(codigo)).situacao, 'valida')
      await chamar(secretaria, "update public.config_credencial set fim_mandato = current_date - 1")
      assert.equal((await validar(codigo)).situacao, 'vencida')
      // o ministro não mexe na configuração
      await chamar(ministro, 'update public.config_credencial set fim_mandato = null')
      const r = await db.query<{ fim: string | null }>('select fim_mandato::text as fim from public.config_credencial')
      assert.notEqual(r.rows[0].fim, null)
      await chamar(secretaria, 'update public.config_credencial set fim_mandato = null')
    })

    it('código inexistente ou malformado não revela nada', async () => {
      assert.deepEqual(Object.keys(await validar('0'.repeat(32))).sort(), ['consultado_em', 'situacao'])
      assert.equal((await validar('nao-e-um-codigo')).situacao, 'inexistente')
    })
  })

  describe('substituição e foto pública', () => {
    it('perdeu a credencial: só a secretaria emite outra, com motivo; o QR antigo diz "substituída"', async () => {
      await assert.rejects(
        chamar(ministro, "select public.substituir_credencial($1, 'Perdi')", [pessoaMinistro]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(secretaria, "select public.substituir_credencial($1, '')", [pessoaMinistro]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const r = await chamar(secretaria, "select public.substituir_credencial($1, 'Perda') as novo", [pessoaMinistro])
      const novo = (r.rows[0] as { novo: string }).novo
      assert.notEqual(novo, codigo)
      assert.equal((await validar(codigo)).situacao, 'substituida')
      assert.equal((await validar(novo)).situacao, 'valida')
      codigo = novo
    })

    it('a cópia pública da foto só vai para a pasta da própria credencial (ou pela secretaria)', async () => {
      const outroCodigo = (await dados(secretaria, [pessoaOutro])).credenciais[0].codigo as string
      await chamar(ministro, "insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [`${codigo}/foto-1.jpg`])
      await assert.rejects(
        chamar(ministro, "insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [`${outroCodigo}/foto-1.jpg`]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(ministro, 'select public.registrar_foto_publica($1, $2)', [codigo, `${outroCodigo}/foto-1.jpg`]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(ministro, 'select public.registrar_foto_publica($1, $2)', [codigo, `${codigo}/foto-1.jpg`])
      assert.equal((await validar(codigo)).foto_publica, `${codigo}/foto-1.jpg`)
    })

    it('associado arquivado: a validação mostra "inativa"', async () => {
      await db.query('update public.associados set arquivado_em = now() where pessoa_id = $1', [pessoaOutro])
      const outroCodigo = await db.query<{ codigo: string }>(
        'select codigo from public.credenciais where pessoa_id = $1 and substituida_em is null',
        [pessoaOutro],
      )
      assert.equal((await validar(outroCodigo.rows[0].codigo)).situacao, 'inativa')
    })
  })
})
