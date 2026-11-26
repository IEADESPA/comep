// S5-04 (decisão do presidente de 25/11/2026; a tela `codigo-login` da rodada 37): o código de primeiro acesso também
// liga um login que JÁ existe. Quem criou o login pelo site ("Quero me associar") e é associado antigo usa o código
// em "Tenho um código", no Início: o sistema mostra "É você?" (conferir_codigo_cadastro, que não muda nada) e, com o
// "Sim, sou eu", liga (ligar_login_ao_cadastro). O cadastro aberto pelo site é arquivado (nada se apaga), o pedido de
// associação aberto vira "desistiu", a conta fica no cadastro que a secretaria fez, e a secretaria e a presidência
// recebem no sino a lista do que o cadastro aberto tinha. A foto e os documentos não passam. Errou 5 vezes, espera 15
// minutos.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const JA_E_DO_COMEP = 'Este login já é de um cadastro do COMEP. Se precisar trocar, fale com a secretaria.'
const ESPERE = 'Você errou o código 5 vezes. Espere 15 minutos e tente de novo.'

/** O erro do banco com a mensagem exata (P0001). */
function erroComMensagem(mensagem: string) {
  return (erro: unknown) => {
    const e = erro as { code?: string; message?: string }
    return e.code === 'P0001' && e.message === mensagem
  }
}

type Conferencia = {
  valido: boolean
  conta?: { nome: string; criada_em: string; pedido: string | null }
  cadastro?: {
    nome: string
    numero: number | null
    associado_desde: string | null
    igreja: string | null
    funcao: string | null
    em_dia: boolean
  }
}
type Ligacao = { valido: boolean; nome?: string; numero?: number | null; pedido?: boolean }

describe('S5-04: o código liga o login que já existe ao cadastro da secretaria', () => {
  let db: PGlite
  let presidente: string
  let secretaria: string
  let ministro: string
  let igreja: string
  let titulo: string

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>(
      'select id from public.pessoas where usuario_id = $1 and arquivado_em is null',
      [usuarioId],
    )
    return r.rows[0]?.id
  }

  async function cadastrarAssociado(nome: string): Promise<string> {
    const r = await como(db, secretaria, () =>
      db.query<{ id: string }>(
        'select public.cadastrar_associado($1, null, null, $2, null, $3, null, null, null, null, false, false) as id',
        [nome, titulo, igreja],
      ),
    )
    return r.rows[0].id
  }

  async function gerarCodigo(pessoaId: string, finalidade = 'primeiro_acesso', quem = secretaria): Promise<string> {
    const r = await como(db, quem, () =>
      db.query<{ codigo: string }>('select public.gerar_codigo_acesso($1, $2) as codigo', [pessoaId, finalidade]),
    )
    return r.rows[0].codigo
  }

  async function conferir(usuarioId: string | null, codigo: string): Promise<Conferencia> {
    const r = await como(db, usuarioId, () =>
      db.query<{ r: Conferencia }>('select public.conferir_codigo_cadastro($1) as r', [codigo]),
    )
    return r.rows[0].r
  }

  async function ligar(usuarioId: string | null, codigo: string): Promise<Ligacao> {
    const r = await como(db, usuarioId, () =>
      db.query<{ r: Ligacao }>('select public.ligar_login_ao_cadastro($1) as r', [codigo]),
    )
    return r.rows[0].r
  }

  /** As tentativas erradas ficam para trás (como se tivessem passado os 15 minutos). */
  async function passarQuinzeMinutos(usuarioId: string) {
    await db.query("update public.tentativas_codigo set criado_em = now() - interval '16 minutes' where usuario_id = $1", [
      usuarioId,
    ])
  }

  async function pedirAssociacao(usuarioId: string): Promise<string> {
    const pessoa = await pessoaDe(usuarioId)
    const r = await como(db, usuarioId, () =>
      db.query<{ id: string }>(
        `insert into public.pedidos_associacao (pessoa_id, titulo_id, igreja_id, foto_caminho, comprovante_caminho,
           declara_principios_fe, declara_estatuto, consente_lgpd)
         values ($1, $2, $3, $4, $5, true, true, true) returning id`,
        [pessoa, titulo, igreja, `pessoas/${pessoa}/foto.jpg`, `pessoas/${pessoa}/comprovante.pdf`],
      ),
    )
    return r.rows[0].id
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja Fictícia') returning id")
    igreja = i.rows[0].id
    const t = await db.query<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")
    titulo = t.rows[0].id
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, secretaria, 'secretaria')
    const pm = await pessoaDe(ministro)
    await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [pm])
  })

  describe('o caminho certo: "É você?" e depois "Sim, sou eu"', () => {
    let login: string
    let aberto: string
    let alvo: string
    let numero: number
    let codigo: string

    before(async () => {
      alvo = await cadastrarAssociado('Pr. Fictício Antigo')
      const n = await db.query<{ numero_registro: number }>('select numero_registro from public.associados where pessoa_id = $1', [
        alvo,
      ])
      numero = n.rows[0].numero_registro
      login = await criarUsuario(db, 'antigo.pelo.site@teste.local', 'Fictício pelo Site')
      aberto = await pessoaDe(login)
      codigo = await gerarCodigo(alvo)
    })

    it('"É você?" mostra a conta de agora e o cadastro da secretaria (nome, nº, igreja, título, em dia)', async () => {
      const r = await conferir(login, codigo)
      assert.equal(r.valido, true)
      assert.equal(r.conta?.nome, 'Fictício pelo Site')
      assert.equal(r.conta?.pedido, null)
      assert.ok(r.conta?.criada_em)
      assert.deepEqual(
        { nome: r.cadastro?.nome, numero: r.cadastro?.numero, igreja: r.cadastro?.igreja, funcao: r.cadastro?.funcao },
        { nome: 'Pr. Fictício Antigo', numero, igreja: 'Igreja Fictícia', funcao: 'Pastor(a)' },
      )
      assert.equal(typeof r.cadastro?.em_dia, 'boolean')
    })

    it('"É você?" não muda nada: o login continua no cadastro aberto e o código, sem uso', async () => {
      assert.equal(await pessoaDe(login), aberto)
      const c = await db.query<{ usado: boolean }>(
        'select usado_em is not null as usado from public.codigos_acesso where pessoa_id = $1',
        [alvo],
      )
      assert.deepEqual(c.rows, [{ usado: false }])
    })

    it('"Sim, sou eu": o login passa para o cadastro da secretaria, e a tela recebe o nome e o nº', async () => {
      const r = await ligar(login, codigo)
      assert.deepEqual(r, { valido: true, nome: 'Pr. Fictício Antigo', numero, pedido: false })
      assert.equal(await pessoaDe(login), alvo)
    })

    it('o cadastro da secretaria fica com o e-mail do login', async () => {
      const p = await db.query<{ email: string }>('select email from public.pessoas where id = $1', [alvo])
      assert.equal(p.rows[0].email, 'antigo.pelo.site@teste.local')
    })

    it('o cadastro aberto pelo site é arquivado, sem o login, e não se apaga', async () => {
      const p = await db.query<{ usuario_id: string | null; arquivado: boolean; nome: string }>(
        'select usuario_id, arquivado_em is not null as arquivado, nome from public.pessoas where id = $1',
        [aberto],
      )
      assert.deepEqual(p.rows[0], { usuario_id: null, arquivado: true, nome: 'Fictício pelo Site' })
    })

    it('o código fica usado', async () => {
      const c = await db.query<{ usado: boolean }>(
        'select usado_em is not null as usado from public.codigos_acesso where pessoa_id = $1',
        [alvo],
      )
      assert.deepEqual(c.rows, [{ usado: true }])
    })

    it('a conta passa a ter os perfis do associado (ministro)', async () => {
      const r = await como(db, login, () =>
        db.query<{ perfil: string }>(
          `select pa.perfil from public.perfis_acesso pa join public.pessoas p on p.id = pa.pessoa_id
           where p.usuario_id = $1 and p.arquivado_em is null and pa.arquivado_em is null`,
          [login],
        ),
      )
      assert.deepEqual(
        r.rows.map((x) => x.perfil),
        ['ministro'],
      )
    })

    it('a pessoa aceita o termo de novo (o aceite é do cadastro, e o da secretaria ainda não aceitou)', async () => {
      const r = await como(db, login, () => db.query<{ t: { pedir: unknown } }>('select public.meu_termo() as t'))
      assert.notEqual(r.rows[0].t.pedir, null)
    })

    it('a junção fica registrada (o login, os dois cadastros e o código)', async () => {
      const j = await db.query<{ usuario_id: string; pessoa_aberta_id: string; pessoa_id: string; tem_codigo: boolean }>(
        `select usuario_id, pessoa_aberta_id, pessoa_id, codigo_id is not null as tem_codigo
         from public.juncoes_cadastro where usuario_id = $1`,
        [login],
      )
      assert.deepEqual(j.rows, [{ usuario_id: login, pessoa_aberta_id: aberto, pessoa_id: alvo, tem_codigo: true }])
    })

    it('a secretaria e a presidência recebem no sino; o ministro comum, não', async () => {
      const n = await db.query<{ pessoa_id: string; tipo: string; titulo: string; link: string }>(
        "select pessoa_id, tipo, titulo, link from public.notificacoes where chave like 'juncao:%'",
      )
      const quem = n.rows.map((x) => x.pessoa_id).sort()
      assert.deepEqual(quem, [await pessoaDe(presidente), await pessoaDe(secretaria)].sort())
      for (const x of n.rows) {
        assert.deepEqual(
          { tipo: x.tipo, titulo: x.titulo, link: x.link },
          { tipo: 'pedido', titulo: 'Pr. Fictício Antigo ligou a conta ao cadastro', link: `/ministros/${alvo}` },
        )
      }
    })

    it('duas abas: a segunda vez com o mesmo código responde o mesmo e não muda nada', async () => {
      const r = await ligar(login, codigo)
      assert.deepEqual(r, { valido: true, nome: 'Pr. Fictício Antigo', numero, pedido: false })
      const j = await db.query<{ n: number }>('select count(*)::int as n from public.juncoes_cadastro where usuario_id = $1', [
        login,
      ])
      assert.equal(j.rows[0].n, 1)
      assert.equal(await pessoaDe(login), alvo)
    })

    it('depois de ligado, outro código não troca o cadastro de novo (nem no "É você?")', async () => {
      const outro = await cadastrarAssociado('Pr. Outro Fictício')
      const c = await gerarCodigo(outro)
      await assert.rejects(conferir(login, c), erroComMensagem(JA_E_DO_COMEP))
      await assert.rejects(ligar(login, c), erroComMensagem(JA_E_DO_COMEP))
      assert.equal(await pessoaDe(login), alvo)
    })
  })

  describe('a mesma resposta para todo código que não vale (não revela se existe nem de quem é)', () => {
    let login: string
    let aberto: string

    before(async () => {
      login = await criarUsuario(db, 'tentativas@teste.local', 'Tentativas Fictícias')
      aberto = await pessoaDe(login)
    })

    async function recusado(codigo: string) {
      assert.deepEqual(await conferir(login, codigo), { valido: false })
      assert.deepEqual(await ligar(login, codigo), { valido: false })
      assert.equal(await pessoaDe(login), aberto, 'o login continua no cadastro aberto')
      await passarQuinzeMinutos(login)
    }

    it('o código inventado', async () => {
      await recusado('ABCD-EFGH-JKLM')
    })

    it('o código vazio', async () => {
      await recusado('')
    })

    it('o código já usado (por outro login)', async () => {
      const alvo = await cadastrarAssociado('Pr. Já Usado')
      const c = await gerarCodigo(alvo)
      await criarUsuario(db, 'ja.usado@teste.local', undefined, { codigo_acesso: c })
      await recusado(c)
    })

    it('o código vencido', async () => {
      const alvo = await cadastrarAssociado('Pr. Vencido')
      const c = await gerarCodigo(alvo)
      await db.query("update public.codigos_acesso set expira_em = now() - interval '1 day' where pessoa_id = $1", [alvo])
      await recusado(c)
    })

    it('o código cancelado (a secretaria gerou outro)', async () => {
      const alvo = await cadastrarAssociado('Pr. Cancelado')
      const c = await gerarCodigo(alvo)
      await gerarCodigo(alvo)
      await recusado(c)
    })

    it('o código de nova senha', async () => {
      const c = await gerarCodigo(await pessoaDe(ministro), 'nova_senha')
      await recusado(c)
    })

    it('o código de um cadastro que já tem login (outra pessoa)', async () => {
      const alvo = await cadastrarAssociado('Pr. Com Login')
      const c = await gerarCodigo(alvo)
      // o cadastro ganhou login por outro caminho, com o código ainda sem uso
      const outro = await criarUsuario(db, 'outro.login@teste.local', 'Outro Login')
      await db.query('update public.pessoas set usuario_id = null, arquivado_em = now() where usuario_id = $1', [outro])
      await db.query('update public.pessoas set usuario_id = $1 where id = $2', [outro, alvo])
      await recusado(c)
    })

    it('o código de um cadastro arquivado', async () => {
      const alvo = await cadastrarAssociado('Pr. Arquivado')
      const c = await gerarCodigo(alvo)
      await db.query('update public.pessoas set arquivado_em = now() where id = $1', [alvo])
      await recusado(c)
    })

    it('nenhuma tentativa deixou registro de junção', async () => {
      const j = await db.query<{ n: number }>('select count(*)::int as n from public.juncoes_cadastro where usuario_id = $1', [
        login,
      ])
      assert.equal(j.rows[0].n, 0)
    })
  })

  describe('errou 5 vezes, espera 15 minutos', () => {
    let login: string
    let codigo: string

    before(async () => {
      login = await criarUsuario(db, 'errou.muito@teste.local', 'Errou Muito')
      codigo = await gerarCodigo(await cadastrarAssociado('Pr. Errou Muito'))
      for (let i = 0; i < 4; i++) assert.deepEqual(await conferir(login, 'ABCD-EFGH-JKL' + i), { valido: false })
      assert.deepEqual(await ligar(login, 'ABCD-EFGH-JKLX'), { valido: false })
    })

    it('na 6ª, nem o código certo passa (no "É você?" e no ligar)', async () => {
      await assert.rejects(conferir(login, codigo), erroComMensagem(ESPERE))
      await assert.rejects(ligar(login, codigo), erroComMensagem(ESPERE))
    })

    it('o erro de outro login não conta para este', async () => {
      const outro = await criarUsuario(db, 'acertou@teste.local', 'Acertou Fictício')
      const c = await gerarCodigo(await cadastrarAssociado('Pr. Acertou'))
      assert.equal((await conferir(outro, c)).valido, true)
    })

    it('passados os 15 minutos, o código certo passa', async () => {
      await passarQuinzeMinutos(login)
      assert.equal((await conferir(login, codigo)).valido, true)
      assert.equal((await ligar(login, codigo)).valido, true)
    })

    it('ninguém lê nem grava as tentativas pela API (nem a secretaria)', async () => {
      await assert.rejects(
        como(db, secretaria, () => db.query('select count(*) from public.tentativas_codigo')),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, login, () => db.query('delete from public.tentativas_codigo')),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('quem já é do COMEP não troca de cadastro por aqui', () => {
    it('o login de um associado é recusado, e o código continua valendo', async () => {
      const alvo = await cadastrarAssociado('Pr. Para o Ministro')
      const c = await gerarCodigo(alvo)
      await assert.rejects(conferir(ministro, c), erroComMensagem(JA_E_DO_COMEP))
      await assert.rejects(ligar(ministro, c), erroComMensagem(JA_E_DO_COMEP))
      const u = await db.query<{ usado: boolean }>(
        'select usado_em is not null as usado from public.codigos_acesso where pessoa_id = $1',
        [alvo],
      )
      assert.deepEqual(u.rows, [{ usado: false }])
    })

    it('o login com perfil (mesmo sem ser associado) é recusado', async () => {
      const comPerfil = await criarUsuario(db, 'tecnico@teste.local', 'Técnico Fictício')
      await darPerfil(db, comPerfil, 'admin_tecnico')
      const alvo = await cadastrarAssociado('Pr. Para o Técnico')
      await assert.rejects(ligar(comPerfil, await gerarCodigo(alvo)), erroComMensagem(JA_E_DO_COMEP))
    })

    it('a resposta não depende do código', async () => {
      await assert.rejects(conferir(ministro, 'ABCD-EFGH-JKLM'), erroComMensagem(JA_E_DO_COMEP))
      await assert.rejects(ligar(ministro, 'ABCD-EFGH-JKLM'), erroComMensagem(JA_E_DO_COMEP))
    })
  })

  describe('o cadastro aberto que já tem dados', () => {
    let login: string
    let aberto: string
    let alvo: string
    let pedido: string

    before(async () => {
      login = await criarUsuario(db, 'candidato.antigo@teste.local', 'Candidato Antigo')
      aberto = await pessoaDe(login)
      await como(db, login, () =>
        db.query("update public.pessoas set foto_caminho = $1, telefone = '(94) 90000-0000' where id = $2", [
          `pessoas/${aberto}/foto.jpg`,
          aberto,
        ]),
      )
      await db.query("insert into storage.objects (bucket_id, name, owner) values ('documentos', $1, $2), ('documentos', $3, $2)", [
        `pessoas/${aberto}/foto.jpg`,
        login,
        `pessoas/${aberto}/comprovante.pdf`,
      ])
      pedido = await pedirAssociacao(login)
      alvo = await cadastrarAssociado('Pr. Candidato Antigo')
    })

    it('"É você?" mostra o pedido de associação da conta', async () => {
      const r = await conferir(login, await gerarCodigo(alvo))
      assert.equal(r.conta?.pedido, 'enviado')
    })

    it('ligar devolve que havia pedido (a tela diz que foi arquivado)', async () => {
      const r = await ligar(login, await gerarCodigo(alvo))
      assert.equal(r.pedido, true)
    })

    it('o pedido de associação aberto vira "desistiu", pelo próprio dono', async () => {
      const p = await db.query<{ situacao: string; decisao_por: string }>(
        'select situacao, decisao_por from public.pedidos_associacao where id = $1',
        [pedido],
      )
      assert.deepEqual(p.rows[0], { situacao: 'desistiu', decisao_por: aberto })
    })

    it('nada se apaga e nada passa: a foto fica no cadastro arquivado', async () => {
      const p = await db.query<{ id: string; foto_caminho: string | null }>(
        'select id, foto_caminho from public.pessoas where id in ($1, $2) order by id = $1 desc',
        [aberto, alvo],
      )
      assert.equal(p.rows[0].foto_caminho, `pessoas/${aberto}/foto.jpg`)
      assert.equal(p.rows[1].foto_caminho, null)
    })

    it('o registro guarda a lista do que o cadastro aberto tinha', async () => {
      const j = await db.query<{ tinha: string[] }>('select tinha from public.juncoes_cadastro where usuario_id = $1', [login])
      assert.deepEqual(j.rows[0].tinha, [
        'a foto',
        'o telefone',
        '2 arquivos enviados',
        'o pedido de associação (enviado; agora "desistiu")',
      ])
    })

    it('o sino da secretaria traz a mesma lista', async () => {
      const n = await db.query<{ texto: string }>(
        `select n.texto from public.notificacoes n
         where n.pessoa_id = $1 and n.chave = (select 'juncao:' || id from public.juncoes_cadastro where usuario_id = $2)`,
        [await pessoaDe(secretaria), login],
      )
      assert.equal(n.rows.length, 1)
      assert.match(n.rows[0].texto, /^Usou o código que a secretaria gerou em \d{2}\/\d{2}\/\d{4}/)
      assert.match(n.rows[0].texto, /\(Candidato Antigo\) foi arquivado/)
      assert.match(n.rows[0].texto, /Ele tinha: a foto, o telefone, 2 arquivos enviados, o pedido de associação/)
    })
  })

  describe('o pedido que já foi encaminhado à assembleia', () => {
    let login: string
    let pedido: string

    before(async () => {
      login = await criarUsuario(db, 'na.assembleia@teste.local', 'Na Assembleia')
      pedido = await pedirAssociacao(login)
      for (const item of ['dados_pessoais', 'igreja_titulo', 'foto', 'comprovante']) {
        await como(db, presidente, () => db.query('select public.conferir_item_pedido($1, $2, true, null)', [pedido, item]))
      }
      await como(db, presidente, () =>
        db.query("update public.pedidos_associacao set situacao = 'aguardando_assembleia' where id = $1", [pedido]),
      )
      await ligar(login, await gerarCodigo(await cadastrarAssociado('Pr. Na Assembleia')))
    })

    it('liga mesmo assim; o pedido fica para a secretaria (o candidato não desiste do que já foi à assembleia)', async () => {
      const p = await db.query<{ situacao: string }>('select situacao from public.pedidos_associacao where id = $1', [pedido])
      assert.equal(p.rows[0].situacao, 'aguardando_assembleia')
    })

    it('o sino pede à secretaria que recuse o pedido, e leva a ele', async () => {
      const n = await db.query<{ texto: string; link: string }>(
        `select texto, link from public.notificacoes
         where pessoa_id = $1 and chave = (select 'juncao:' || id from public.juncoes_cadastro where usuario_id = $2)`,
        [await pessoaDe(secretaria), login],
      )
      assert.match(n.rows[0].texto, /já estava na assembleia: recuse-o/)
      assert.equal(n.rows[0].link, `/inscricoes/${pedido}`)
    })

    it('a assembleia não aprova o pedido do cadastro arquivado (não nasce associado repetido)', async () => {
      await assert.rejects(
        como(db, presidente, () => db.query("select public.aprovar_pedido($1, current_date, 'Ata fictícia')", [pedido])),
        erroComCodigo('P0001'),
      )
    })

    it('a secretaria recusa com o motivo', async () => {
      await como(db, secretaria, () =>
        db.query(
          "update public.pedidos_associacao set situacao = 'recusado', motivo_recusa = 'Já é associado pelo cadastro da secretaria.' where id = $1",
          [pedido],
        ),
      )
      const p = await db.query<{ situacao: string }>('select situacao from public.pedidos_associacao where id = $1', [pedido])
      assert.equal(p.rows[0].situacao, 'recusado')
    })
  })

  describe('quem pode', () => {
    it('quem não entrou no sistema não usa', async () => {
      await assert.rejects(conferir(null, 'ABCD-EFGH-JKLM'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(ligar(null, 'ABCD-EFGH-JKLM'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o ministro comum não lê o registro das junções; a secretaria e a presidência leem', async () => {
      const contar = (quem: string) =>
        como(db, quem, () => db.query<{ n: number }>('select count(*)::int as n from public.juncoes_cadastro'))
      assert.equal((await contar(ministro)).rows[0].n, 0)
      assert.ok((await contar(secretaria)).rows[0].n >= 1)
      assert.ok((await contar(presidente)).rows[0].n >= 1)
    })

    it('ninguém grava o registro pela tabela', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query(
            'insert into public.juncoes_cadastro (usuario_id, pessoa_aberta_id, pessoa_id) select usuario_id, id, id from public.pessoas limit 1',
          ),
        ),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('as peças internas não se chamam pela API', async () => {
      await assert.rejects(
        como(db, ministro, () => db.query('select interno.secretaria_e_presidencia()')),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        como(db, ministro, () => db.query("select * from interno.cadastro_do_codigo('ABCD-EFGH-JKLM')")),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('o Primeiro acesso de sempre (o login novo com o código) não muda', () => {
    it('o login novo com o código continua ligando o cadastro, sem registro de junção', async () => {
      const alvo = await cadastrarAssociado('Pr. Login Novo')
      const c = await gerarCodigo(alvo)
      const usuario = await criarUsuario(db, 'login.novo@teste.local', undefined, { codigo_acesso: c })
      assert.equal(await pessoaDe(usuario), alvo)
      const j = await db.query<{ n: number }>('select count(*)::int as n from public.juncoes_cadastro where usuario_id = $1', [
        usuario,
      ])
      assert.equal(j.rows[0].n, 0)
    })
  })
})
