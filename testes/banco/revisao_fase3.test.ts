// Revisão geral da Fase 3 (13/11/2026): um teste para cada achado (docs/revisoes/fase-3.md).
// Todos falham sem a migração 20261113190000_revisao_fase3.sql e passam com ela. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const CPF_A = '52998224725'
const CPF_B = '11144477735'
// CPFs fictícios válidos para as tentativas
const OUTROS_CPFS = ['12345678909', '98765432100', '39053344705', '71428793860', '87748248800', '44515862007']

describe('Revisão geral da Fase 3 — correções', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let outro: string
  let fiscal: string
  let tesoureiro: string
  let admin: string
  let estranho: string
  let pessoaMinistro: string
  let pessoaOutro: string
  let pessoaEstranho: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const gravar = (quem: string, pessoa: string, dados: Record<string, string | null>) =>
    chamar(quem, 'select public.gravar_identidade($1, $2::jsonb) as r', [pessoa, JSON.stringify(dados)]).then(
      (r) => (r.rows[0] as { r: string }).r,
    )

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function codigoDe(quem: string, pessoa: string): Promise<string> {
    const r = await chamar(quem, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoa]])
    return (r.rows[0] as { d: { credenciais: { codigo: string }[] } }).d.credenciais[0].codigo
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    outro = await criarUsuario(db, 'outro@teste.local', 'Outro Ministro')
    fiscal = await criarUsuario(db, 'fiscal@teste.local', 'Membro do Conselho Fiscal')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro')
    admin = await criarUsuario(db, 'admin@teste.local', 'Administrador Técnico')
    estranho = await criarUsuario(db, 'estranho@teste.local', 'Login Novo Sem Perfil')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, fiscal, 'conselho_fiscal')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, admin, 'admin_tecnico')
    pessoaMinistro = await pessoaDe(ministro)
    pessoaOutro = await pessoaDe(outro)
    pessoaEstranho = await pessoaDe(estranho)
    for (const p of [pessoaMinistro, pessoaOutro]) {
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p])
    }
    assert.equal(await gravar(ministro, pessoaMinistro, { cpf: CPF_A, nome_mae: 'Maria Mãe', nome_pai: 'José Pai' }), 'ok')
  })

  describe('1. CPF e filiação: só a própria pessoa, a secretaria e a presidência', () => {
    it('Conselho Fiscal e tesouraria não leem CPF nem filiação (mas continuam lendo o nome)', async () => {
      for (const quem of [fiscal, tesoureiro]) {
        await assert.rejects(
          chamar(quem, 'select cpf, nome_pai, nome_mae from public.pessoas where id = $1', [pessoaMinistro]),
          erroComCodigo(SEM_PERMISSAO),
        )
        await assert.rejects(chamar(quem, 'select public.identidade_pessoa($1)', [pessoaMinistro]), erroComCodigo(SEM_PERMISSAO))
        const r = await chamar(quem, 'select nome from public.pessoas where id = $1', [pessoaMinistro])
        assert.deepEqual(r.rows, [{ nome: 'Ministro de Teste' }])
      }
    })

    it('outro ministro não lê; a própria pessoa e a secretaria leem', async () => {
      await assert.rejects(chamar(outro, 'select public.identidade_pessoa($1)', [pessoaMinistro]), erroComCodigo(SEM_PERMISSAO))
      for (const quem of [ministro, secretaria]) {
        const r = await chamar(quem, 'select public.identidade_pessoa($1) as i', [pessoaMinistro])
        assert.deepEqual((r.rows[0] as { i: unknown }).i, { cpf: CPF_A, nome_pai: 'José Pai', nome_mae: 'Maria Mãe' })
      }
    })

    it('a auditoria guarda CPF e filiação mascarados (mostra que mudou, não o valor)', async () => {
      assert.equal(await gravar(secretaria, pessoaMinistro, { cpf: CPF_B }), 'ok')
      const r = await chamar(
        admin,
        "select dados_antes ->> 'cpf' as antes, dados_depois ->> 'cpf' as depois, dados_depois ->> 'nome_mae' as mae from public.auditoria where tabela = 'pessoas' and registro_id = $1 order by id",
        [pessoaMinistro],
      )
      const linhas = r.rows as { antes: string | null; depois: string | null; mae: string | null }[]
      assert.ok(linhas.length > 0)
      const texto = JSON.stringify(linhas)
      assert.ok(!texto.includes(CPF_A) && !texto.includes(CPF_B) && !texto.includes('Maria Mãe'), texto)
      assert.ok(linhas.some((l) => l.depois === '(protegido — alterado)' && l.antes === '(protegido)'))
    })
  })

  describe('2. O nome vai na credencial', () => {
    it('depois da associação, só a secretaria corrige o nome; quem ainda não é associado muda o próprio', async () => {
      await assert.rejects(
        chamar(ministro, "update public.pessoas set nome = 'Pr. Fulano Presidente do COMEP' where id = $1", [pessoaMinistro]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await chamar(ministro, "update public.pessoas set telefone = '94999990000' where id = $1", [pessoaMinistro])
      await chamar(secretaria, "update public.pessoas set nome = 'Ministro de Teste Corrigido' where id = $1", [pessoaMinistro])
      await chamar(estranho, "update public.pessoas set nome = 'Candidato Com Nome Novo' where id = $1", [pessoaEstranho])
      const r = await db.query<{ nome: string }>('select nome from public.pessoas where id = $1', [pessoaEstranho])
      assert.equal(r.rows[0].nome, 'Candidato Com Nome Novo')
    })
  })

  describe('3. Sondar CPF', () => {
    it('quem tenta CPF de outra pessoa: no máximo 5 vezes; depois, só a secretaria resolve', async () => {
      for (let i = 0; i < 5; i++) assert.equal(await gravar(estranho, pessoaEstranho, { cpf: CPF_B }), 'cpf_repetido')
      await assert.rejects(gravar(estranho, pessoaEstranho, { cpf: OUTROS_CPFS[0] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await db.query<{ cpf: string | null }>('select cpf from public.pessoas where id = $1', [pessoaEstranho])
      assert.equal(r.rows[0].cpf, null)
      // a secretaria continua gravando
      assert.equal(await gravar(secretaria, pessoaEstranho, { cpf: OUTROS_CPFS[1] }), 'ok')
    })

    it('ninguém grava CPF de outra pessoa nem direto na tabela', async () => {
      await assert.rejects(gravar(outro, pessoaMinistro, { nome_pai: 'Outro' }), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(
        chamar(outro, 'update public.pessoas set cpf = $1 where id = $2', [OUTROS_CPFS[2], pessoaOutro]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('4. Fotos públicas da credencial', () => {
    it('nome de arquivo conferido (sem "..", sem pasta dentro de pasta) e no máximo 20 por credencial', async () => {
      const codigo = await codigoDe(ministro, pessoaMinistro)
      for (const ruim of [`${codigo}/../outra/x.jpg`, `${codigo}//x.jpg`, `${codigo}/sub/x.jpg`]) {
        await assert.rejects(
          chamar(ministro, "insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [ruim]),
          erroComCodigo(SEM_PERMISSAO),
          ruim,
        )
      }
      for (let i = 0; i < 20; i++) {
        await chamar(ministro, "insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [`${codigo}/foto-${i}.jpg`])
      }
      await assert.rejects(
        chamar(ministro, "insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [`${codigo}/foto-20.jpg`]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('ex-associado não publica foto, não é renovado na posse e não ganha credencial nova', async () => {
      const codigo = await codigoDe(outro, pessoaOutro)
      await db.query("insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [`${codigo}/antes.jpg`])
      await db.query('update public.associados set arquivado_em = now() where pessoa_id = $1', [pessoaOutro])
      await assert.rejects(
        chamar(outro, "insert into storage.objects (bucket_id, name) values ('credenciais', $1)", [`${codigo}/depois.jpg`]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(outro, 'select public.registrar_foto_publica($1, $2)', [codigo, `${codigo}/antes.jpg`]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secretaria, "select public.substituir_credencial($1, 'Perda')", [pessoaOutro]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secretaria, 'select public.corrigir_fim_mandato(current_date + 30, null)')
      await chamar(secretaria, 'select public.registrar_novo_mandato(current_date + 1500)')
      const r = await db.query<{ n: number }>(
        'select count(*)::int as n from public.credenciais where pessoa_id = $1 and renovada_em is null and substituida_em is null',
        [pessoaOutro],
      )
      assert.equal(r.rows[0].n, 1, 'continua só a credencial antiga (e a validação diz "inativa")')
      const atual = await db.query<{ codigo: string }>(
        'select codigo from public.credenciais where pessoa_id = $1 and renovada_em is null and substituida_em is null',
        [pessoaOutro],
      )
      assert.equal(atual.rows[0].codigo, codigo)
    })
  })

  describe('5. Corrigir o fim do mandato', () => {
    it('recusa se a data mudou enquanto a tela estava aberta (ex.: alguém registrou a posse)', async () => {
      // a tela foi aberta com +30; a posse mudou para +1500 (teste anterior)
      await assert.rejects(
        chamar(secretaria, 'select public.corrigir_fim_mandato(current_date + 30, current_date + 30)'),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('recusa data antes do fim do mandato anterior (ou em branco, depois de uma posse)', async () => {
      await assert.rejects(
        chamar(secretaria, 'select public.corrigir_fim_mandato(current_date + 10, current_date + 1500)'),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secretaria, 'select public.corrigir_fim_mandato(null, current_date + 1500)'),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secretaria, 'select public.corrigir_fim_mandato(current_date + 1460, current_date + 1500)')
    })

    it('ninguém muda o fim do mandato direto na tabela; o texto do verso continua direto', async () => {
      await assert.rejects(
        chamar(secretaria, 'update public.config_credencial set fim_mandato = current_date where id'),
        erroComCodigo(SEM_PERMISSAO),
      )
      await chamar(secretaria, "update public.config_credencial set texto_verso = 'Texto novo do verso' where id")
    })
  })

  describe('6. Dados das credenciais em lote', () => {
    it('lista de duas dimensões não burla o limite; ids repetidos contam uma vez', async () => {
      await assert.rejects(
        chamar(ministro, 'select public.dados_credenciais(array[array[$1::uuid, $1::uuid]])', [pessoaMinistro]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const r = await chamar(ministro, 'select public.dados_credenciais(array[$1::uuid, $1::uuid, null]) as d', [pessoaMinistro])
      assert.equal((r.rows[0] as { d: { credenciais: unknown[] } }).d.credenciais.length, 1)
    })
  })
})
