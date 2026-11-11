// Testes da Fase 0: "cada um vê só o que lhe cabe", "nada se apaga" e auditoria.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 0 — fundação do banco', () => {
  let db: PGlite
  let presidente: string
  let ministro: string
  let novato: string

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    novato = await criarUsuario(db, 'novato@teste.local')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, ministro, 'ministro')
  })

  describe('cadastro automático', () => {
    it('cada novo login ganha um cadastro em "pessoas"', async () => {
      const r = await db.query<{ nome: string }>('select nome from public.pessoas')
      // quando o login não informa nome, usa o começo do e-mail ("novato")
      assert.deepEqual(r.rows.map((p) => p.nome).sort(), ['Ministro de Teste', 'Presidente de Teste', 'novato'].sort())
    })
  })

  describe('visitante (sem login)', () => {
    it('não lê nenhuma tabela', async () => {
      for (const tabela of ['pessoas', 'perfis_acesso', 'auditoria']) {
        await assert.rejects(
          como(db, null, () => db.query(`select * from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
          `visitante conseguiu ler ${tabela}`,
        )
      }
    })
  })

  describe('ministro', () => {
    it('vê só o próprio cadastro', async () => {
      const r = await como(db, ministro, () => db.query<{ usuario_id: string }>('select usuario_id from public.pessoas'))
      assert.deepEqual(
        r.rows.map((p) => p.usuario_id),
        [ministro],
      )
    })

    it('vê só os próprios perfis', async () => {
      const r = await como(db, ministro, () => db.query<{ perfil: string }>('select perfil from public.perfis_acesso'))
      assert.deepEqual(
        r.rows.map((p) => p.perfil),
        ['ministro'],
      )
    })

    it('não vê a auditoria', async () => {
      const r = await como(db, ministro, () => db.query('select * from public.auditoria'))
      assert.equal(r.rows.length, 0)
    })

    it('edita o próprio nome', async () => {
      const r = await como(db, ministro, () =>
        db.query("update public.pessoas set nome = 'Ministro Corrigido' where usuario_id = $1", [ministro]),
      )
      assert.equal(r.affectedRows, 1)
    })

    it('não edita o cadastro de outra pessoa', async () => {
      const r = await como(db, ministro, () =>
        db.query("update public.pessoas set nome = 'Invadido' where usuario_id = $1", [presidente]),
      )
      assert.equal(r.affectedRows, 0)
      const conferencia = await db.query<{ nome: string }>('select nome from public.pessoas where usuario_id = $1', [presidente])
      assert.equal(conferencia.rows[0].nome, 'Presidente de Teste')
    })

    it('não altera colunas protegidas (ex.: o vínculo com o login)', async () => {
      await assert.rejects(
        como(db, ministro, () =>
          db.query('update public.pessoas set usuario_id = $1 where usuario_id = $2', [presidente, ministro]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('não consegue se dar um perfil', async () => {
      await assert.rejects(
        como(db, ministro, () =>
          db.query(
            "insert into public.perfis_acesso (pessoa_id, perfil) select id, 'presidencia' from public.pessoas where usuario_id = $1",
            [ministro],
          ),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('presidência', () => {
    it('vê todos os cadastros', async () => {
      const r = await como(db, presidente, () => db.query('select id from public.pessoas'))
      assert.equal(r.rows.length, 3)
    })

    it('concede um perfil', async () => {
      const r = await como(db, presidente, () =>
        db.query(
          "insert into public.perfis_acesso (pessoa_id, perfil) select id, 'secretaria' from public.pessoas where usuario_id = $1",
          [novato],
        ),
      )
      assert.equal(r.affectedRows, 1)
      const visiveis = await como(db, novato, () => db.query('select id from public.pessoas'))
      assert.equal(visiveis.rows.length, 3, 'com perfil de secretaria, o novato deveria ver todos os cadastros')
    })

    it('retira um perfil arquivando, e ele deixa de valer na hora', async () => {
      await como(db, presidente, () =>
        db.query(
          `update public.perfis_acesso set arquivado_em = now()
           where perfil = 'secretaria' and pessoa_id = (select id from public.pessoas where usuario_id = $1)`,
          [novato],
        ),
      )
      const visiveis = await como(db, novato, () => db.query('select id from public.pessoas'))
      assert.equal(visiveis.rows.length, 1, 'sem o perfil, o novato deveria ver só o próprio cadastro')
    })

    it('vê a auditoria', async () => {
      const r = await como(db, presidente, () => db.query('select id from public.auditoria'))
      assert.ok(r.rows.length > 0)
    })
  })

  describe('nada se apaga', () => {
    it('ninguém tem permissão de apagar pela API (nem a presidência)', async () => {
      for (const tabela of ['pessoas', 'perfis_acesso', 'auditoria']) {
        await assert.rejects(
          como(db, presidente, () => db.query(`delete from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
          `foi possível apagar em ${tabela}`,
        )
      }
    })

    it('nem o dono do banco apaga: a exclusão vira erro', async () => {
      await assert.rejects(db.query('delete from public.pessoas'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(db.query('truncate public.perfis_acesso'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await db.query('select id from public.pessoas')
      assert.equal(r.rows.length, 3)
    })

    it('a auditoria não pode ser alterada nem apagada', async () => {
      await assert.rejects(db.query("update public.auditoria set tabela = 'x'"), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(db.query('delete from public.auditoria'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('auditoria', () => {
    it('registra quem mudou o quê', async () => {
      const r = await db.query<{ usuario_id: string; antes: string; depois: string }>(
        `select usuario_id, dados_antes ->> 'nome' as antes, dados_depois ->> 'nome' as depois
         from public.auditoria
         where tabela = 'pessoas' and operacao = 'UPDATE'`,
      )
      assert.deepEqual(r.rows, [{ usuario_id: ministro, antes: 'Ministro de Teste', depois: 'Ministro Corrigido' }])
    })

    it('registra a criação de cada cadastro e de cada perfil', async () => {
      const r = await db.query<{ tabela: string; total: number }>(
        `select tabela, count(*)::int as total from public.auditoria
         where operacao = 'INSERT' and tabela in ('pessoas', 'perfis_acesso')
         group by tabela order by tabela`,
      )
      assert.deepEqual(r.rows, [
        { tabela: 'perfis_acesso', total: 3 },
        { tabela: 'pessoas', total: 3 },
      ])
    })
  })
})
