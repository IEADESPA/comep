// Testes da Fase 1.2 (parte 2): códigos de acesso (sem e-mail), pedido de associação e arquivos.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const DUPLICADO = '23505'

describe('Fase 1.2 — códigos de acesso, pedido de associação e arquivos', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let igrejaA: string
  let tituloPastor: string

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function gerarCodigo(quem: string, pessoaId: string, finalidade: string): Promise<string> {
    const r = await como(db, quem, () =>
      db.query<{ codigo: string }>('select public.gerar_codigo_acesso($1, $2) as codigo', [pessoaId, finalidade]),
    )
    return r.rows[0].codigo
  }

  async function conferir(codigo: string, finalidade: string): Promise<boolean> {
    const r = await como(db, null, () =>
      db.query<{ ok: boolean }>('select public.conferir_codigo_acesso($1, $2) as ok', [codigo, finalidade]),
    )
    return r.rows[0].ok
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, ministro, 'ministro')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
    igrejaA = i.rows[0].id
    const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor'")
    tituloPastor = t.rows[0].id
  })

  // -------------------------------------------------------------------
  describe('primeiro acesso com código (associado cadastrado pela secretaria)', () => {
    let pessoaAntiga: string
    let codigo: string

    before(async () => {
      const r = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          'select public.cadastrar_associado($1, null, null, $2, null, $3, null, null, null, null, false, false) as id',
          ['Pr. Associado Antigo', tituloPastor, igrejaA],
        ),
      )
      pessoaAntiga = r.rows[0].id
    })

    it('a secretaria gera um código no formato XXXX-XXXX-XXXX', async () => {
      codigo = await gerarCodigo(secretaria, pessoaAntiga, 'primeiro_acesso')
      assert.match(codigo, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/)
    })

    it('ministro não gera código', async () => {
      await assert.rejects(gerarCodigo(ministro, pessoaAntiga, 'primeiro_acesso'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o código não fica legível em lugar nenhum (nem na auditoria)', async () => {
      await assert.rejects(
        como(db, secretaria, () => db.query('select * from interno.codigos_segredos')),
        erroComCodigo(SEM_PERMISSAO),
      )
      const semTraco = codigo.replaceAll('-', '')
      const naAuditoria = await db.query(
        `select id from public.auditoria where dados_depois::text like '%' || $1 || '%' or dados_depois::text like '%' || $2 || '%'`,
        [codigo, semTraco],
      )
      assert.equal(naAuditoria.rows.length, 0)
    })

    it('visitante confere o código (com ou sem traços, maiúsculas ou não) sem ver mais nada', async () => {
      assert.equal(await conferir(codigo, 'primeiro_acesso'), true)
      assert.equal(await conferir(codigo.replaceAll('-', '').toLowerCase(), 'primeiro_acesso'), true)
      assert.equal(await conferir('AAAA-BBBB-CCCC', 'primeiro_acesso'), false)
      assert.equal(await conferir(codigo, 'nova_senha'), false, 'código de primeiro acesso não serve para nova senha')
    })

    it('gerar outro código cancela o anterior', async () => {
      const novo = await gerarCodigo(secretaria, pessoaAntiga, 'primeiro_acesso')
      assert.equal(await conferir(codigo, 'primeiro_acesso'), false)
      assert.equal(await conferir(novo, 'primeiro_acesso'), true)
      codigo = novo
    })

    it('o login criado com o código é ligado ao cadastro existente (não cria outra pessoa)', async () => {
      const antes = await db.query<{ total: number }>('select count(*)::int as total from public.pessoas')
      const usuario = await criarUsuario(db, 'antigo@teste.local', undefined, { codigo_acesso: codigo })
      const depois = await db.query<{ total: number }>('select count(*)::int as total from public.pessoas')
      assert.equal(depois.rows[0].total, antes.rows[0].total)
      assert.equal(await pessoaDe(usuario), pessoaAntiga)
      const perfis = await como(db, usuario, () =>
        db.query<{ perfil: string }>('select perfil from public.perfis_acesso where arquivado_em is null'),
      )
      assert.deepEqual(
        perfis.rows.map((p) => p.perfil),
        ['ministro'],
      )
    })

    it('o código só vale uma vez', async () => {
      assert.equal(await conferir(codigo, 'primeiro_acesso'), false)
      const outro = await criarUsuario(db, 'aproveitador@teste.local', 'Aproveitador', { codigo_acesso: codigo })
      assert.notEqual(await pessoaDe(outro), pessoaAntiga)
    })

    it('quem já tem login não recebe código de primeiro acesso', async () => {
      await assert.rejects(gerarCodigo(secretaria, pessoaAntiga, 'primeiro_acesso'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('código vencido não vale', async () => {
      const r = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          'select public.cadastrar_associado($1, null, null, $2, null, $3, null, null, null, null, false, false) as id',
          ['Pr. Código Vencido', tituloPastor, igrejaA],
        ),
      )
      const vencido = await gerarCodigo(secretaria, r.rows[0].id, 'primeiro_acesso')
      await db.query("update public.codigos_acesso set expira_em = now() - interval '1 minute' where pessoa_id = $1", [
        r.rows[0].id,
      ])
      assert.equal(await conferir(vencido, 'primeiro_acesso'), false)
    })
  })

  // -------------------------------------------------------------------
  describe('senha esquecida com código', () => {
    let codigo: string

    it('a secretaria gera código de nova senha só para quem já tem login', async () => {
      codigo = await gerarCodigo(secretaria, await pessoaDe(ministro), 'nova_senha')
      assert.ok(codigo)
    })

    it('recusa senha fraca e e-mail que não confere', async () => {
      await assert.rejects(
        como(db, null, () =>
          db.query("select public.redefinir_senha_com_codigo('ministro@teste.local', $1, 'curta1')", [codigo]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        como(db, null, () =>
          db.query("select public.redefinir_senha_com_codigo('outro@teste.local', $1, 'SenhaNova123')", [codigo]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('com e-mail e código certos, troca a senha (guardada só como resumo bcrypt) e gasta o código', async () => {
      await como(db, null, () =>
        db.query("select public.redefinir_senha_com_codigo('MINISTRO@teste.local', $1, 'SenhaNova123')", [codigo]),
      )
      const r = await db.query<{ confere: boolean; formato: string }>(
        `select encrypted_password = extensions.crypt('SenhaNova123', encrypted_password) as confere,
                left(encrypted_password, 4) as formato
         from auth.users where id = $1`,
        [ministro],
      )
      assert.deepEqual(r.rows[0], { confere: true, formato: '$2a$' })
      assert.equal(await conferir(codigo, 'nova_senha'), false)
    })
  })

  // -------------------------------------------------------------------
  describe('pedido de associação (Art. 7º)', () => {
    let candidato: string
    let pessoaCandidato: string
    let outroCandidato: string
    let pedido: string

    const arquivos = (pessoaId: string) => ({
      foto: `pessoas/${pessoaId}/foto-1.jpg`,
      comprovante: `pessoas/${pessoaId}/comprovante-1.pdf`,
    })

    async function enviarPedido(usuario: string, pessoaId: string, mudar: Record<string, unknown> = {}) {
      const a = arquivos(pessoaId)
      const dados = {
        pessoa_id: pessoaId,
        titulo_id: tituloPastor,
        igreja_id: null as string | null,
        igreja_informada: 'Igreja Nova do Bairro',
        foto_caminho: a.foto,
        comprovante_caminho: a.comprovante,
        declara_principios_fe: true,
        declara_estatuto: true,
        consente_lgpd: true,
        ...mudar,
      }
      const colunas = Object.keys(dados)
      return como(db, usuario, () =>
        db.query<{ id: string; situacao: string }>(
          `insert into public.pedidos_associacao (${colunas.join(', ')})
           values (${colunas.map((_, i) => `$${i + 1}`).join(', ')}) returning id, situacao`,
          Object.values(dados),
        ),
      )
    }

    before(async () => {
      candidato = await criarUsuario(db, 'candidato@teste.local', 'Candidato de Teste')
      outroCandidato = await criarUsuario(db, 'outro@teste.local', 'Outro Candidato')
      pessoaCandidato = await pessoaDe(candidato)
    })

    it('falta de foto, de declaração ou arquivo de outra pessoa é recusado', async () => {
      await assert.rejects(enviarPedido(candidato, pessoaCandidato, { foto_caminho: null }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        enviarPedido(candidato, pessoaCandidato, { consente_lgpd: false }),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        enviarPedido(candidato, pessoaCandidato, { foto_caminho: `pessoas/${await pessoaDe(ministro)}/foto.jpg` }),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('ninguém faz pedido em nome de outra pessoa', async () => {
      await assert.rejects(
        enviarPedido(outroCandidato, pessoaCandidato),
        (erro: unknown) => ['42501', 'P0001'].includes((erro as { code?: string }).code ?? ''),
      )
    })

    it('o candidato envia o pedido: a situação começa em "enviado", mesmo se tentar outra', async () => {
      const r = await enviarPedido(candidato, pessoaCandidato)
      pedido = r.rows[0].id
      assert.equal(r.rows[0].situacao, 'enviado')
    })

    it('só um pedido aberto por pessoa', async () => {
      await assert.rejects(enviarPedido(candidato, pessoaCandidato), erroComCodigo(DUPLICADO))
    })

    it('outro candidato não vê o pedido; a secretaria vê', async () => {
      const outro = await como(db, outroCandidato, () => db.query('select id from public.pedidos_associacao'))
      assert.equal(outro.rows.length, 0)
      const sec = await como(db, secretaria, () => db.query('select id from public.pedidos_associacao'))
      assert.equal(sec.rows.length, 1)
    })

    it('o candidato não se aprova nem escreve a análise', async () => {
      await assert.rejects(
        como(db, candidato, () =>
          db.query("update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = $1", [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        como(db, candidato, () =>
          db.query("update public.pedidos_associacao set mensagem_pendencia = 'ok' where id = $1", [pedido]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('a secretaria devolve com pendência (precisa escrever o motivo)', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_associacao set situacao = 'pendencia' where id = $1", [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, secretaria, () =>
        db.query(
          "update public.pedidos_associacao set situacao = 'pendencia', mensagem_pendencia = 'Comprovante ilegível' where id = $1",
          [pedido],
        ),
      )
    })

    it('o candidato corrige e reenvia', async () => {
      await como(db, candidato, () =>
        db.query(
          "update public.pedidos_associacao set comprovante_caminho = $2, situacao = 'enviado' where id = $1",
          [pedido, `pessoas/${pessoaCandidato}/comprovante-2.pdf`],
        ),
      )
      const r = await db.query<{ situacao: string }>('select situacao from public.pedidos_associacao where id = $1', [pedido])
      assert.equal(r.rows[0].situacao, 'enviado')
    })

    it('para encaminhar à assembleia, a igreja precisa estar cadastrada; o aceite do diretor fica registrado', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = $1", [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, secretaria, () =>
        db.query(
          "update public.pedidos_associacao set igreja_id = $2, situacao = 'aguardando_assembleia' where id = $1",
          [pedido, igrejaA],
        ),
      )
      const r = await db.query<{ aceite: string }>(
        'select aceite_diretor_por as aceite from public.pedidos_associacao where id = $1',
        [pedido],
      )
      assert.equal(r.rows[0].aceite, await pessoaDe(secretaria))
    })

    it('depois de encaminhado, o candidato não altera mais', async () => {
      await assert.rejects(
        como(db, candidato, () =>
          db.query("update public.pedidos_associacao set observacoes = 'mudei' where id = $1", [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('aprovar exige data da assembleia que não seja futura e só vale pelo "Registrar aprovação"', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("select public.aprovar_pedido($1, current_date + 1, 'Ata 1')", [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        como(db, secretaria, () =>
          db.query(
            "update public.pedidos_associacao set situacao = 'aprovado', assembleia_data = current_date where id = $1",
            [pedido],
          ),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('aprovado em assembleia, o candidato vira associado com título, igreja, foto e perfil de ministro', async () => {
      await como(db, secretaria, () => db.query("select public.aprovar_pedido($1, current_date, 'Ata 12/2026')", [pedido]))
      const a = await db.query<{ forma: string; ata: string; titulo: string; igreja: string; foto: string }>(
        `select a.forma_admissao as forma, a.assembleia_ata as ata, v.titulo, v.igreja, p.foto_caminho as foto
         from public.associados a
         join public.vw_associados v on v.id = a.id
         join public.pessoas p on p.id = a.pessoa_id
         where a.pessoa_id = $1`,
        [pessoaCandidato],
      )
      assert.deepEqual(a.rows[0], {
        forma: 'assembleia',
        ata: 'Ata 12/2026',
        titulo: 'Pastor',
        igreja: 'Igreja A',
        foto: `pessoas/${pessoaCandidato}/foto-1.jpg`,
      })
      const perfis = await db.query<{ perfil: string }>(
        'select perfil from public.perfis_acesso where pessoa_id = $1 and arquivado_em is null',
        [pessoaCandidato],
      )
      assert.deepEqual(
        perfis.rows.map((p) => p.perfil),
        ['ministro'],
      )
    })

    it('pedido encerrado não muda mais, e quem já é associado não abre outro pedido', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_associacao set motivo_recusa = 'x' where id = $1", [pedido]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(enviarPedido(candidato, pessoaCandidato), erroComCodigo(SEM_PERMISSAO))
    })

    it('recusa exige motivo; o candidato pode desistir', async () => {
      const pessoaOutro = await pessoaDe(outroCandidato)
      const r = await enviarPedido(outroCandidato, pessoaOutro)
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pedidos_associacao set situacao = 'recusado' where id = $1", [r.rows[0].id]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await como(db, outroCandidato, () =>
        db.query("update public.pedidos_associacao set situacao = 'desistiu' where id = $1", [r.rows[0].id]),
      )
      const s = await db.query<{ situacao: string }>('select situacao from public.pedidos_associacao where id = $1', [
        r.rows[0].id,
      ])
      assert.equal(s.rows[0].situacao, 'desistiu')
    })

    it('nada se apaga', async () => {
      for (const tabela of ['pedidos_associacao', 'codigos_acesso']) {
        await assert.rejects(
          como(db, secretaria, () => db.query(`delete from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
        )
      }
    })
  })

  // -------------------------------------------------------------------
  describe('arquivos (Storage): cada um na sua pasta', () => {
    let candidato: string
    let pessoaCandidato: string

    before(async () => {
      candidato = await criarUsuario(db, 'arquivos@teste.local', 'Candidato dos Arquivos')
      pessoaCandidato = await pessoaDe(candidato)
    })

    it('o bucket "documentos" é privado', async () => {
      const r = await db.query<{ public: boolean }>("select public from storage.buckets where id = 'documentos'")
      assert.equal(r.rows[0].public, false)
    })

    it('envia arquivo para a própria pasta, mas não para a de outra pessoa', async () => {
      const pastaDoMinistro = `pessoas/${await pessoaDe(ministro)}/foto.jpg`
      const r = await como(db, candidato, () =>
        db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [
          `pessoas/${pessoaCandidato}/foto.jpg`,
        ]),
      )
      assert.equal(r.affectedRows, 1)
      await assert.rejects(
        como(db, candidato, () =>
          db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [pastaDoMinistro]),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('vê os próprios arquivos; não vê os de outros; a secretaria vê', async () => {
      await db.query("insert into storage.objects (bucket_id, name) values ('documentos', $1)", [
        `pessoas/${await pessoaDe(ministro)}/comprovante.pdf`,
      ])
      const meus = await como(db, candidato, () => db.query<{ name: string }>('select name from storage.objects'))
      assert.deepEqual(
        meus.rows.map((o) => o.name),
        [`pessoas/${pessoaCandidato}/foto.jpg`],
      )
      const sec = await como(db, secretaria, () => db.query('select name from storage.objects'))
      assert.equal(sec.rows.length, 2)
    })

    it('ninguém apaga nem sobrescreve arquivos', async () => {
      const apagou = await como(db, candidato, () => db.query('delete from storage.objects'))
      assert.equal(apagou.affectedRows, 0)
      const trocou = await como(db, candidato, () => db.query("update storage.objects set name = 'x'"))
      assert.equal(trocou.affectedRows, 0)
    })
  })
})
