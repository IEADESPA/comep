// Testes das correções da revisão geral de segurança (antes do lançamento — docs/revisoes/fase-1.md).
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Revisão de segurança antes do lançamento', () => {
  let db: PGlite
  let presidente: string
  let secretaria: string
  let administrador: string
  let ministro: string
  let estranho: string // criou login pelo site, com nome e e-mail que quis
  let igreja: string
  let titulo: string

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function associar(usuarioId: string) {
    const pessoa = await pessoaDe(usuarioId)
    await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [pessoa])
    await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [pessoa, titulo])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoa, igreja])
  }

  async function gerarCodigo(quem: string, pessoaId: string, finalidade: string) {
    return como(db, quem, () =>
      db.query<{ codigo: string }>('select public.gerar_codigo_acesso($1, $2) as codigo', [pessoaId, finalidade]),
    )
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    administrador = await criarUsuario(db, 'admin@teste.local', 'Administrador de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    estranho = await criarUsuario(db, 'diretor.novo@teste.local', 'Pr. Fulano – Secretário')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
    igreja = i.rows[0].id
    const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
    titulo = t.rows[0].id
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, administrador, 'admin_tecnico')
    await associar(ministro)
  })

  describe('1. ninguém assume a conta de quem é da diretoria', () => {
    it('a secretaria não gera código de nova senha para a presidência', async () => {
      await assert.rejects(
        gerarCodigo(secretaria, await pessoaDe(presidente), 'nova_senha'),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('o administrador técnico não gera código para a secretaria', async () => {
      await assert.rejects(
        gerarCodigo(administrador, await pessoaDe(secretaria), 'nova_senha'),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('a presidência gera; e a secretaria continua gerando para um ministro', async () => {
      const r1 = await gerarCodigo(presidente, await pessoaDe(secretaria), 'nova_senha')
      assert.ok(r1.rows[0].codigo)
      const r2 = await gerarCodigo(secretaria, await pessoaDe(ministro), 'nova_senha')
      assert.ok(r2.rows[0].codigo)
    })
  })

  describe('2. perfil da diretoria só para associado ativo', () => {
    it('a presidência não consegue dar "secretaria" a um login criado pelo site (não conferido)', async () => {
      await assert.rejects(
        como(db, presidente, async () =>
          db.query("insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'secretaria')", [
            await pessoaDe(estranho),
          ]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('dá normalmente a um associado ativo', async () => {
      const pessoa = await pessoaDe(ministro)
      const r = await como(db, presidente, () =>
        db.query("insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'tesouraria')", [pessoa]),
      )
      assert.equal(r.affectedRows, 1)
    })
  })

  describe('5 e 8. códigos e senha', () => {
    it('trocar a senha por código encerra as sessões abertas do login', async () => {
      await db.query('insert into auth.sessions (user_id) values ($1), ($1)', [ministro])
      await db.query("insert into auth.refresh_tokens (user_id, token) values ($1, 'x')", [ministro])
      // (o ministro ganhou "tesouraria" no teste anterior: agora só a presidência gera o código dele)
      const r = await gerarCodigo(presidente, await pessoaDe(ministro), 'nova_senha')
      await como(db, null, () =>
        db.query("select public.redefinir_senha_com_codigo('ministro@teste.local', $1, 'SenhaNova123')", [
          r.rows[0].codigo,
        ]),
      )
      const s = await db.query<{ total: number }>(
        `select (select count(*) from auth.sessions where user_id = $1)
              + (select count(*) from auth.refresh_tokens where user_id = $1::text) as total`,
        [ministro],
      )
      assert.equal(Number(s.rows[0].total), 0)
    })

    it('o código de primeiro acesso não fica guardado no login depois de usado', async () => {
      const p = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          'select public.cadastrar_associado($1, null, null, $2, null, $3, null, null, null, null, false, false) as id',
          ['Pr. Primeiro Acesso', titulo, igreja],
        ),
      )
      const r = await gerarCodigo(secretaria, p.rows[0].id, 'primeiro_acesso')
      const usuario = await criarUsuario(db, 'primeiro@teste.local', undefined, { codigo_acesso: r.rows[0].codigo })
      const u = await db.query<{ tem_codigo: boolean }>(
        "select raw_user_meta_data ? 'codigo_acesso' as tem_codigo from auth.users where id = $1",
        [usuario],
      )
      assert.equal(u.rows[0].tem_codigo, false)
      assert.equal(await pessoaDe(usuario), p.rows[0].id, 'o login continua ligado ao cadastro certo')
    })

    it('código de pessoa arquivada não vale mais', async () => {
      const p = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          'select public.cadastrar_associado($1, null, null, $2, null, $3, null, null, null, null, false, false) as id',
          ['Pr. Arquivado', titulo, igreja],
        ),
      )
      const r = await gerarCodigo(secretaria, p.rows[0].id, 'primeiro_acesso')
      await como(db, secretaria, () =>
        db.query('update public.associados set arquivado_em = now() where pessoa_id = $1', [p.rows[0].id]),
      )
      const c = await como(db, null, () =>
        db.query<{ ok: boolean }>("select public.conferir_codigo_acesso($1, 'primeiro_acesso') as ok", [
          r.rows[0].codigo,
        ]),
      )
      assert.equal(c.rows[0].ok, false)
    })
  })

  describe('6 e 9. pedidos: sem mudança durante a análise e sem decidir o próprio', () => {
    let candidato: string
    let pedido: string

    before(async () => {
      candidato = await criarUsuario(db, 'candidato@teste.local', 'Candidato')
      const pessoa = await pessoaDe(candidato)
      const r = await como(db, candidato, () =>
        db.query<{ id: string }>(
          `insert into public.pedidos_associacao (pessoa_id, titulo_id, igreja_id, foto_caminho, comprovante_caminho,
             declara_principios_fe, declara_estatuto, consente_lgpd)
           values ($1, $2, $3, $4, $5, true, true, true) returning id`,
          [pessoa, titulo, igreja, `pessoas/${pessoa}/f.jpg`, `pessoas/${pessoa}/c.pdf`],
        ),
      )
      pedido = r.rows[0].id
    })

    it('em análise, o candidato não troca dados (ex.: marcar-se pastor presidente)', async () => {
      await assert.rejects(
        como(db, candidato, () =>
          db.query('update public.pedidos_associacao set pastor_presidente = true where id = $1', [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('caminho de arquivo com ".." é recusado', async () => {
      const pessoa = await pessoaDe(candidato)
      await assert.rejects(
        como(db, candidato, () =>
          db.query('update public.pessoas set foto_caminho = $1 where id = $2', [
            `pessoas/${pessoa}/../outra/foto.jpg`,
            pessoa,
          ]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('"aprovado" direto, com associado de outra pessoa, é recusado', async () => {
      for (const item of ['dados_pessoais', 'igreja_titulo', 'foto', 'comprovante']) {
        await como(db, presidente, () => db.query('select public.conferir_item_pedido($1, $2, true, null)', [pedido, item]))
      }
      await como(db, presidente, () =>
        db.query("update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = $1", [pedido]),
      )
      const outro = await db.query<{ id: string }>('select id from public.associados limit 1')
      await assert.rejects(
        como(db, presidente, () =>
          db.query(
            "update public.pedidos_associacao set situacao = 'aprovado', assembleia_data = current_date, associado_id = $2 where id = $1",
            [pedido, outro.rows[0].id],
          ),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('a secretaria não decide o próprio pedido', async () => {
      const pessoaSec = await pessoaDe(secretaria)
      const r = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          `insert into public.pedidos_associacao (pessoa_id, titulo_id, igreja_id, foto_caminho, comprovante_caminho,
             declara_principios_fe, declara_estatuto, consente_lgpd)
           values ($1, $2, $3, $4, $5, true, true, true) returning id`,
          [pessoaSec, titulo, igreja, `pessoas/${pessoaSec}/f.jpg`, `pessoas/${pessoaSec}/c.pdf`],
        ),
      )
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = $1", [
            r.rows[0].id,
          ]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('troca de igreja pendente: o ministro não muda os dados (só cancela)', async () => {
      const outra = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja B') returning id")
      const pessoa = await pessoaDe(ministro)
      const t = await como(db, ministro, () =>
        db.query<{ id: string }>(
          'insert into public.pedidos_troca_igreja (pessoa_id, igreja_id) values ($1, $2) returning id',
          [pessoa, outra.rows[0].id],
        ),
      )
      await assert.rejects(
        como(db, ministro, () =>
          db.query('update public.pedidos_troca_igreja set pastor_presidente = true where id = $1', [t.rows[0].id]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const c = await como(db, ministro, () =>
        db.query("update public.pedidos_troca_igreja set situacao = 'cancelado' where id = $1", [t.rows[0].id]),
      )
      assert.equal(c.affectedRows, 1)
    })
  })

  describe('4 e 7. arquivos', () => {
    it('não envia com ".." no caminho nem passa de 30 arquivos', async () => {
      const usuario = await criarUsuario(db, 'muitos.arquivos@teste.local', 'Muitos Arquivos')
      const pessoa = await pessoaDe(usuario)
      await assert.rejects(
        como(db, usuario, () =>
          db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [
            `pessoas/${pessoa}/../x.jpg`,
          ]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
      for (let i = 0; i < 30; i++) {
        await como(db, usuario, () =>
          db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`pessoas/${pessoa}/f${i}.jpg`]),
        )
      }
      await assert.rejects(
        como(db, usuario, () =>
          db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`pessoas/${pessoa}/f31.jpg`]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('associado ativo não tem limite (pode trocar a foto quantas vezes precisar)', async () => {
      const pessoa = await pessoaDe(ministro)
      for (let i = 0; i < 31; i++) {
        await como(db, ministro, () =>
          db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`pessoas/${pessoa}/foto${i}.jpg`]),
        )
      }
      const r = await db.query<{ total: number }>(
        "select count(*)::int as total from storage.objects where name like 'pessoas/' || $1 || '/%'",
        [pessoa],
      )
      assert.equal(r.rows[0].total, 31)
    })
  })
})
