// Fase 5.5.2: votações e enquetes on-line — preparar e abrir, quem vota, voto secreto (só QUEM votou fica guardado),
// voto aberto, parcial, prazo, encerrar e apurar, e o item da pauta votado pelo celular dos presentes. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Resultado = {
  fechada: boolean
  votantes: number
  aptos: number
  eu_votei: boolean
  posso_votar: boolean
  minhas_opcoes: string[] | null
  mostra_contagem: boolean
  opcoes: { id: string; texto: string; papel: string | null; votos: number | null }[]
  aprovada: boolean | null
  nominal: { nome: string; opcoes: string[] }[] | null
}

describe('Fase 5.5.2 — votações e enquetes on-line', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let semPerfil: string
  const m: string[] = []
  const pessoa: string[] = []

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const salvar = (quem: string, id: string | null, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.salvar_votacao($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then((r) => (r.rows[0] as { id: string }).id)
  const abrir = (quem: string, id: string) => chamar(quem, 'select public.abrir_votacao($1)', [id])
  const encerrar = (quem: string, id: string) => chamar(quem, 'select public.encerrar_votacao($1) as r', [id]).then((r) => (r.rows[0] as { r: Resultado }).r)
  const resultado = (quem: string, id: string) =>
    chamar(quem, 'select public.resultado_votacao($1) as r', [id]).then((r) => (r.rows[0] as { r: Resultado | null }).r)
  const opcao = async (id: string, texto: string) =>
    (await db.query<{ id: string }>('select id from public.votacao_opcoes where votacao_id = $1 and texto = $2 and arquivado_em is null', [id, texto])).rows[0].id
  const votar = async (quem: string, id: string, textos: string[]) => {
    const ids = await Promise.all(textos.map((t) => opcao(id, t)))
    return chamar(quem, 'select public.votar($1, $2::uuid[])', [id, ids])
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    semPerfil = await criarUsuario(db, 'site@teste.local', 'Conta do Site')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    for (let i = 1; i <= 4; i++) {
      m.push(await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`))
      const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [m[i - 1]])
      pessoa.push(p.rows[0].id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.rows[0].id])
    }
    // o 4º está em atraso
    await db.query(
      `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
       values ($1, 2025, 'mensal', '2025-05-01', '2025-05-10', 'nao_presidente', 20)`,
      [pessoa[3]],
    )
  })

  describe('enquete com voto secreto', () => {
    let enquete: string

    it('a secretaria prepara; o associado não; opções e escolhas conferidas; secreto não tem parcial', async () => {
      const dados = {
        tipo: 'enquete',
        titulo: 'Qual o melhor dia para a reunião mensal?',
        quem_vota: 'associados',
        max_escolhas: 2,
        opcoes: ['Segunda', 'Terça', 'Quinta'],
      }
      await assert.rejects(salvar(m[0], null, dados), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(salvar(secretaria, null, { ...dados, opcoes: ['Só uma'] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(secretaria, null, { ...dados, max_escolhas: 4 }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(secretaria, null, { ...dados, parcial_visivel: true }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      enquete = await salvar(secretaria, null, dados)
    })

    it('em preparo, só quem organiza vê; aberta, todos do COMEP; depois de aberta não se altera', async () => {
      assert.equal(await resultado(m[0], enquete), null)
      assert.equal((await chamar(m[0], 'select id from public.votacoes')).rows.length, 0)
      await assert.rejects(abrir(m[0], enquete), erroComCodigo(SEM_PERMISSAO))
      await abrir(secretaria, enquete)
      assert.equal((await chamar(m[0], 'select id from public.votacoes')).rows.length, 1)
      await assert.rejects(salvar(secretaria, enquete, { tipo: 'enquete', titulo: 'Outra pergunta', opcoes: ['A', 'B'] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(semPerfil, 'select public.listar_votacoes()'), erroComCodigo(SEM_PERMISSAO))
    })

    it('cada associado vota uma vez (até 2 opções); quem não é associado não vota', async () => {
      await votar(m[0], enquete, ['Segunda', 'Quinta'])
      await assert.rejects(votar(m[0], enquete, ['Terça']), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(votar(m[1], enquete, ['Segunda', 'Terça', 'Quinta']), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(m[1], 'select public.votar($1, $2::uuid[])', [enquete, ['00000000-0000-0000-0000-000000000000']]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(votar(semPerfil, enquete, ['Terça']), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(votar(secretaria, enquete, ['Terça']), erroComCodigo(SEM_PERMISSAO))
      // "associados": o que está em atraso também vota na enquete
      await votar(m[3], enquete, ['Quinta'])
    })

    it('secreto: fica QUEM votou, não O QUE; ninguém vê a contagem antes do fim, nem quem organiza', async () => {
      const votos = await db.query<{ opcoes: string[] | null }>('select opcoes from public.votacao_votantes where votacao_id = $1', [enquete])
      assert.deepEqual(
        votos.rows.map((v) => v.opcoes),
        [null, null],
      )
      const r = await resultado(secretaria, enquete)
      assert.equal(r?.votantes, 2)
      assert.equal(r?.mostra_contagem, false)
      assert.deepEqual(
        r?.opcoes.map((o) => o.votos),
        [null, null, null],
      )
      const meu = await resultado(m[0], enquete)
      assert.equal(meu?.eu_votei, true)
      assert.equal(meu?.minhas_opcoes ?? null, null)
      // nem a auditoria guarda o voto: a contagem não tem auditoria e o registro de quem votou não tem a opção
      const auditoria = await db.query<{ tabela: string; opcoes: unknown }>(
        "select tabela, dados_depois -> 'opcoes' as opcoes from public.auditoria where tabela in ('votacao_votantes', 'votacao_apuracao')",
      )
      assert.deepEqual(
        auditoria.rows.map((a) => [a.tabela, a.opcoes]),
        [
          ['votacao_votantes', null],
          ['votacao_votantes', null],
        ],
      )
      // a contagem não se lê direto
      await assert.rejects(chamar(secretaria, 'select * from public.votacao_apuracao'), erroComCodigo(SEM_PERMISSAO))
      // quem votou: a secretaria vê a participação; o associado, só o próprio
      assert.equal((await chamar(secretaria, 'select id from public.votacao_votantes where votacao_id = $1', [enquete])).rows.length, 2)
      assert.equal((await chamar(m[3], 'select id from public.votacao_votantes where votacao_id = $1', [enquete])).rows.length, 1)
    })

    it('encerrar: só quem organiza; depois, a contagem aparece e não se vota mais', async () => {
      await assert.rejects(encerrar(m[0], enquete), erroComCodigo(SEM_PERMISSAO))
      const r = await encerrar(presidencia, enquete)
      assert.equal(r.fechada, true)
      assert.equal(r.aptos, 4)
      assert.deepEqual(
        r.opcoes.map((o) => [o.texto, o.votos]),
        [
          ['Segunda', 1],
          ['Terça', 0],
          ['Quinta', 2],
        ],
      )
      assert.equal(r.aprovada, null)
      assert.equal(r.nominal, null)
      await assert.rejects(votar(m[1], enquete, ['Terça']), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('votação com voto aberto e parcial', () => {
    let votacao: string

    it('só os em dia votam; a parcial aparece; no fim, a maioria e quem votou em quê', async () => {
      votacao = await salvar(secretaria, null, {
        tipo: 'votacao',
        titulo: 'Apoiar a marcha para Jesus',
        quem_vota: 'em_dia',
        maioria: 'simples',
        secreta: false,
        parcial_visivel: true,
      })
      await abrir(secretaria, votacao)
      await assert.rejects(votar(m[3], votacao, ['A favor']), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(votar(m[0], votacao, ['A favor', 'Contra']), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await votar(m[0], votacao, ['A favor'])
      await votar(m[1], votacao, ['Contra'])
      await votar(m[2], votacao, ['A favor'])
      const parcial = await resultado(m[3], votacao)
      assert.equal(parcial?.posso_votar, false)
      assert.equal(parcial?.aptos, 3)
      assert.deepEqual(
        parcial?.opcoes.map((o) => o.votos),
        [2, 1, 0],
      )
      assert.equal(parcial?.aprovada, null)
      const r = await encerrar(secretaria, votacao)
      assert.equal(r.aprovada, true)
      assert.deepEqual(r.nominal, [
        { nome: 'Associado 1', opcoes: ['A favor'] },
        { nome: 'Associado 2', opcoes: ['Contra'] },
        { nome: 'Associado 3', opcoes: ['A favor'] },
      ])
    })

    it('3/5 dos votos válidos: 1 a favor e 1 contra não bastam; a abstenção não entra na conta', async () => {
      const outra = await salvar(secretaria, null, { tipo: 'votacao', titulo: 'Reforma do regimento', quem_vota: 'em_dia', maioria: 'tres_quintos' })
      await abrir(secretaria, outra)
      await votar(m[0], outra, ['A favor'])
      await votar(m[1], outra, ['Contra'])
      await votar(m[2], outra, ['Abstenção'])
      assert.equal((await encerrar(secretaria, outra)).aprovada, false)
    })
  })

  describe('prazo e cancelamento', () => {
    it('passado o prazo, não se vota e o resultado já aparece', async () => {
      const v = await salvar(secretaria, null, {
        tipo: 'enquete',
        titulo: 'Tema do congresso',
        quem_vota: 'associados',
        opcoes: ['Família', 'Missões'],
        fecha_em: new Date(Date.now() + 3_600_000).toISOString(),
      })
      await assert.rejects(
        salvar(secretaria, v, { tipo: 'enquete', titulo: 'Tema do congresso', opcoes: ['A', 'B'], fecha_em: '2020-01-01T10:00:00Z' }),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await abrir(secretaria, v)
      await votar(m[0], v, ['Missões'])
      await db.query("update public.votacoes set fecha_em = now() - interval '1 minute' where id = $1", [v])
      await assert.rejects(votar(m[1], v, ['Família']), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await resultado(m[1], v)
      assert.equal(r?.fechada, true)
      assert.equal(r?.posso_votar, false)
      assert.deepEqual(
        r?.opcoes.map((o) => o.votos),
        [0, 1],
      )
    })

    it('cancelar pede o motivo; cancelada, não se vota', async () => {
      const v = await salvar(secretaria, null, { tipo: 'enquete', titulo: 'Enquete cancelada', quem_vota: 'associados', opcoes: ['Sim', 'Não'] })
      await abrir(secretaria, v)
      await assert.rejects(chamar(secretaria, "select public.cancelar_votacao($1, '')", [v]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, "select public.cancelar_votacao($1, 'Pergunta mal feita')", [v])
      await assert.rejects(votar(m[0], v, ['Sim']), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('na assembleia: o item da pauta votado pelo celular dos presentes', () => {
    let encontro: string
    let item: string
    let votacao: string

    before(async () => {
      encontro = (
        await db.query<{ id: string }>(
          `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em)
           values ('age', 'AGE de teste', now() - interval '61 minutes', 'Sede', 'convocado', now()) returning id`,
        )
      ).rows[0].id
      item = (
        await db.query<{ id: string }>(
          `insert into public.encontro_pauta (encontro_id, ordem, titulo, deliberativo, maioria)
           values ($1, 1, 'Compra do som novo', true, 'simples') returning id`,
          [encontro],
        )
      ).rows[0].id
      for (const p of [pessoa[0], pessoa[1], pessoa[3]]) {
        await chamar(secretaria, "select public.registrar_presenca($1, $2, 'lista')", [encontro, p])
      }
    })

    it('a votação do item: presentes em dia, a maioria do item; só abre com a assembleia instalada', async () => {
      votacao = await salvar(secretaria, null, { tipo: 'enquete', titulo: '', pauta_id: item, quem_vota: 'associados', maioria: 'dois_tercos' })
      const v = (await db.query<{ tipo: string; quem_vota: string; maioria: string; titulo: string }>('select * from public.votacoes where id = $1', [votacao])).rows[0]
      assert.deepEqual([v.tipo, v.quem_vota, v.maioria, v.titulo], ['votacao', 'presentes', 'simples', 'Compra do som novo'])
      await assert.rejects(abrir(secretaria, votacao), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, 'select public.instalar_assembleia($1)', [encontro])
      await abrir(secretaria, votacao)
      // uma votação aberta por item
      const segunda = await salvar(secretaria, null, { tipo: 'votacao', titulo: 'De novo', pauta_id: item })
      await assert.rejects(abrir(secretaria, segunda), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('quem não está presente, ou está em atraso, não vota', async () => {
      await assert.rejects(votar(m[2], votacao, ['A favor']), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(votar(m[3], votacao, ['A favor']), erroComCodigo(SEM_PERMISSAO))
      await votar(m[0], votacao, ['A favor'])
      await votar(m[1], votacao, ['Abstenção'])
    })

    it('ao encerrar, o resultado vai para a votação do item (deliberação, como na contagem à mão)', async () => {
      const r = await encerrar(secretaria, votacao)
      assert.equal(r.aprovada, true)
      assert.equal(r.aptos, 2)
      const d = (
        await db.query<{ votantes: number; a_favor: number; contra: number; abstencoes: number; aprovada: boolean; ligada: boolean }>(
          `select d.votantes, d.a_favor, d.contra, d.abstencoes, d.aprovada, v.deliberacao_id = d.id as ligada
           from public.deliberacoes d join public.votacoes v on v.id = $2
           where d.pauta_id = $1 and d.arquivado_em is null`,
          [item, votacao],
        )
      ).rows[0]
      assert.deepEqual(d, { votantes: 2, a_favor: 1, contra: 0, abstencoes: 1, aprovada: true, ligada: true })
    })
  })
})
