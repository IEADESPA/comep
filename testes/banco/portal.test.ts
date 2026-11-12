// Testes da Fase 1.3: portal do ministro (foto, troca de igreja) e presidente de igreja.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const DUPLICADO = '23505'

describe('Fase 1.3 — portal do ministro e presidente de igreja', () => {
  let db: PGlite
  let secretaria: string
  let presidente: string // pastor presidente da Igreja A (com login)
  let ministro: string // ministro da Igreja A (com login)
  let outro: string // ministro da Igreja B (com login)
  let semCadastro: string // login sem cadastro de associado
  let igrejaA: string
  let igrejaB: string
  let igrejaC: string
  let tituloPastor: string

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  /** Torna um login associado ativo de uma igreja (direto no banco, como faria a secretaria). */
  async function associar(usuarioId: string, igrejaId: string, pastorPresidente: boolean) {
    const pessoa = await pessoaDe(usuarioId)
    await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [pessoa])
    await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [pessoa, tituloPastor])
    await db.query(
      'insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao, pastor_presidente) values ($1, $2, $3, $4)',
      [pessoa, igrejaId, pastorPresidente ? null : 'Pastor auxiliar', pastorPresidente],
    )
  }

  async function pedirTroca(usuario: string, dados: Record<string, unknown>) {
    const colunas = ['pessoa_id', ...Object.keys(dados)]
    const valores = [await pessoaDe(usuario), ...Object.values(dados)]
    return como(db, usuario, () =>
      db.query<{ id: string; situacao: string }>(
        `insert into public.pedidos_troca_igreja (${colunas.join(', ')})
         values (${colunas.map((_, i) => `$${i + 1}`).join(', ')}) returning id, situacao`,
        valores,
      ),
    )
  }

  async function igrejaAtual(usuario: string): Promise<string> {
    const r = await db.query<{ igreja_id: string }>(
      'select igreja_id from public.vinculos_igreja where pessoa_id = $1 and fim is null and arquivado_em is null',
      [await pessoaDe(usuario)],
    )
    return r.rows[0].igreja_id
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    presidente = await criarUsuario(db, 'presidente.igreja@teste.local', 'Pastor Presidente A')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro A')
    outro = await criarUsuario(db, 'outro@teste.local', 'Ministro B')
    semCadastro = await criarUsuario(db, 'semcadastro@teste.local', 'Sem Cadastro')
    await darPerfil(db, secretaria, 'secretaria')
    const i = await db.query<{ id: string }>(
      "insert into public.igrejas (nome, telefone) values ('Igreja A', '1111'), ('Igreja B', '2222'), ('Igreja C', '3333') returning id",
    )
    ;[igrejaA, igrejaB, igrejaC] = i.rows.map((r) => r.id)
    const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
    tituloPastor = t.rows[0].id
    await associar(presidente, igrejaA, true)
    await associar(ministro, igrejaA, false)
    await associar(outro, igrejaB, false)
  })

  describe('meu perfil: foto', () => {
    it('a pessoa troca a própria foto (arquivo da própria pasta)', async () => {
      const pessoa = await pessoaDe(ministro)
      const r = await como(db, ministro, () =>
        db.query('update public.pessoas set foto_caminho = $1 where id = $2', [`pessoas/${pessoa}/foto-9.jpg`, pessoa]),
      )
      assert.equal(r.affectedRows, 1)
    })

    it('não aceita foto da pasta de outra pessoa', async () => {
      const pessoa = await pessoaDe(ministro)
      const fotoDeOutro = `pessoas/${await pessoaDe(outro)}/foto.jpg`
      await assert.rejects(
        como(db, ministro, () =>
          db.query('update public.pessoas set foto_caminho = $1 where id = $2', [fotoDeOutro, pessoa]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })

  describe('presidente de igreja', () => {
    it('vê os ministros da sua igreja, e só deles', async () => {
      const r = await como(db, presidente, () =>
        db.query<{ nome: string; pastor_presidente: boolean }>(
          'select nome, pastor_presidente from public.ministros_da_minha_igreja()',
        ),
      )
      assert.deepEqual(r.rows, [
        { nome: 'Pastor Presidente A', pastor_presidente: true },
        { nome: 'Ministro A', pastor_presidente: false },
      ])
    })

    it('quem não é presidente não vê ninguém', async () => {
      const r = await como(db, ministro, () => db.query('select * from public.ministros_da_minha_igreja()'))
      assert.equal(r.rows.length, 0)
    })

    it('continua sem ver o cadastro completo dos ministros (e-mail, observações…)', async () => {
      const outros = await como(db, presidente, () =>
        db.query<{ nome: string }>('select nome from public.pessoas'),
      )
      assert.deepEqual(
        outros.rows.map((p) => p.nome),
        ['Pastor Presidente A'],
      )
    })

    it('atualiza endereço e telefone da própria igreja', async () => {
      const r = await como(db, presidente, () =>
        db.query("update public.igrejas set telefone = '9999', endereco = 'Rua Nova, 10' where id = $1", [igrejaA]),
      )
      assert.equal(r.affectedRows, 1)
    })

    it('não muda nome, CNPJ nem arquiva a igreja', async () => {
      await assert.rejects(
        como(db, presidente, () => db.query("update public.igrejas set nome = 'Outro Nome' where id = $1", [igrejaA])),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, presidente, () => db.query('update public.igrejas set arquivado_em = now() where id = $1', [igrejaA])),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('não mexe em igreja que não preside', async () => {
      const r = await como(db, presidente, () =>
        db.query("update public.igrejas set telefone = '0000' where id = $1", [igrejaB]),
      )
      assert.equal(r.affectedRows, 0)
    })

    it('ministro comum não atualiza igreja nenhuma', async () => {
      const r = await como(db, ministro, () =>
        db.query("update public.igrejas set telefone = '0000' where id = $1", [igrejaA]),
      )
      assert.equal(r.affectedRows, 0)
    })
  })

  describe('pedido de troca de igreja', () => {
    let pedido: string

    it('quem não é associado não pede troca', async () => {
      await assert.rejects(pedirTroca(semCadastro, { igreja_id: igrejaB }), erroComCodigo(SEM_PERMISSAO))
    })

    it('não pede troca para a igreja em que já está', async () => {
      await assert.rejects(pedirTroca(ministro, { igreja_id: igrejaA }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('ninguém pede troca em nome de outro', async () => {
      const pessoaDoMinistro = await pessoaDe(ministro)
      await assert.rejects(
        como(db, outro, () =>
          db.query('insert into public.pedidos_troca_igreja (pessoa_id, igreja_id) values ($1, $2)', [
            pessoaDoMinistro,
            igrejaC,
          ]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('o ministro pede a troca; fica pendente; só um pendente por vez', async () => {
      // Não dá para já nascer aprovado: a coluna "situacao" nem pode ser enviada
      await assert.rejects(
        pedirTroca(ministro, { igreja_id: igrejaB, situacao: 'aprovado' }),
        erroComCodigo(SEM_PERMISSAO),
      )
      const r = await pedirTroca(ministro, { igreja_id: igrejaB, funcao: 'Pastor auxiliar' })
      pedido = r.rows[0].id
      assert.equal(r.rows[0].situacao, 'pendente')
      await assert.rejects(pedirTroca(ministro, { igreja_id: igrejaC }), erroComCodigo(DUPLICADO))
    })

    it('o ministro não aprova o próprio pedido; outro ministro nem vê', async () => {
      await assert.rejects(
        como(db, ministro, () =>
          db.query("update public.pedidos_troca_igreja set situacao = 'aprovado' where id = $1", [pedido]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
      const r = await como(db, outro, () => db.query('select id from public.pedidos_troca_igreja'))
      assert.equal(r.rows.length, 0)
      await assert.rejects(
        como(db, ministro, () => db.query('select public.aprovar_troca_igreja($1, null, null)', [pedido])),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('a secretaria aprova: o vínculo muda para a igreja nova e o pedido fecha', async () => {
      await como(db, secretaria, () => db.query('select public.aprovar_troca_igreja($1, null, current_date)', [pedido]))
      assert.equal(await igrejaAtual(ministro), igrejaB)
      const r = await db.query<{ situacao: string; decidido: boolean }>(
        'select situacao, decidido_por is not null as decidido from public.pedidos_troca_igreja where id = $1',
        [pedido],
      )
      assert.deepEqual(r.rows[0], { situacao: 'aprovado', decidido: true })
    })

    it('pedido decidido não muda mais', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_troca_igreja set situacao = 'recusado', motivo_recusa = 'x' where id = $1", [
            pedido,
          ]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('igreja que não está na lista: a secretaria escolhe a cadastrada ao aprovar', async () => {
      const r = await pedirTroca(outro, { igreja_informada: 'Igreja Ainda Não Cadastrada' })
      await assert.rejects(
        como(db, secretaria, () => db.query('select public.aprovar_troca_igreja($1, null, null)', [r.rows[0].id])),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, secretaria, () =>
        db.query('select public.aprovar_troca_igreja($1, $2, null)', [r.rows[0].id, igrejaC]),
      )
      assert.equal(await igrejaAtual(outro), igrejaC)
    })

    it('recusa exige motivo; o ministro pode cancelar o próprio pedido', async () => {
      const r1 = await pedirTroca(ministro, { igreja_id: igrejaC })
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_troca_igreja set situacao = 'recusado' where id = $1", [r1.rows[0].id]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, ministro, () =>
        db.query("update public.pedidos_troca_igreja set situacao = 'cancelado' where id = $1", [r1.rows[0].id]),
      )
      const s = await db.query<{ situacao: string }>('select situacao from public.pedidos_troca_igreja where id = $1', [
        r1.rows[0].id,
      ])
      assert.equal(s.rows[0].situacao, 'cancelado')
    })

    it('nada se apaga', async () => {
      await assert.rejects(
        como(db, secretaria, () => db.query('delete from public.pedidos_troca_igreja')),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(db.query('delete from public.pedidos_troca_igreja'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })
})
