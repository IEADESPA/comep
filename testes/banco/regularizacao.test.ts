// Fase 5.5 (telas novas, parte 5): a regularização das igrejas — a situação calculada pela data (regular, suspensa,
// sem registro), os 30 dias para mandar o documento e o bloqueio do perfil de pastor presidente, o documento antecipado
// que entra sozinho, a diretoria pelo menor mandato, a natureza jurídica, a igreja sem registro, a igreja nova em
// análise (conferida item por item), as filiais, a tradição da denominação e quem lê o quê. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Situacao = {
  situacao: string
  vencidos: string[]
  pendencias: string[]
  suspensa_desde: string | null
  prazo_ate: string | null
  perfil_bloqueado: boolean
  alvara_ate: string | null
  mandato_ate: string | null
  natureza_prazo: string | null
  proximo_vencimento: string | null
}

// CNPJs fictícios com os dígitos certos (gerados pela regra da Receita, sem ligação com ninguém)
function cnpjFicticio(base: string): string {
  const v = base.split('').map((c) => c.charCodeAt(0) - 48)
  const dv = (pesos: number[]) => {
    const soma = pesos.reduce((s, p, i) => s + v[i] * p, 0)
    return soma % 11 < 2 ? 0 : 11 - (soma % 11)
  }
  v.push(dv([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  v.push(dv([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  return base + v.slice(12).join('')
}

describe('Fase 5.5 — a regularização das igrejas', () => {
  let db: PGlite
  let secretaria: string
  let tesouraria: string
  let pastorA: string
  let pastorB: string
  let pastorNovo: string
  let ministroA: string
  let ministroB: string
  let igrejaA: string
  let igrejaB: string
  let igrejaX: string
  let denominacao: string
  let bairro: string
  let cadeiras: string
  const pessoa: Record<string, string> = {}
  let arquivos = 0

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const valor = async <T>(quem: string, sql: string, params: unknown[] = []) =>
    (await chamar(quem, sql, params)).rows[0] as T
  const hoje = async (dias = 0) => (await um<{ d: string }>('select (current_date + $1::int)::text as d', [dias])).d

  async function associar(usuario: string, igreja: string, presidente: boolean) {
    const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])
    pessoa[usuario] = p.id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.id])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [p.id, igreja, presidente])
  }
  /** O documento já conferido, direto no banco (o dono do banco monta o cenário com as datas do passado). */
  async function conferido(igreja: string, tipo: string, de: number | null, ate: number | null, extra: { natureza?: string } = {}) {
    return (
      await um<{ id: string }>(
        `insert into public.igreja_documentos (igreja_id, tipo, arquivo_caminho, situacao, valido_de, valido_ate, natureza, conferido_em)
         values ($1::uuid, $2::public.tipo_documento_igreja, $1::text || '/semente-' || gen_random_uuid() || '.pdf', 'conferido',
                 current_date + $3::int, current_date + $4::int, $5, now())
         returning id`,
        [igreja, tipo, de, ate, extra.natureza ?? null],
      )
    ).id
  }
  /** Igreja regular: estatuto, Cartão CNPJ (organização religiosa), ata e alvará em dia, ativada há muito tempo. */
  async function regularizarNoBanco(igreja: string, alvaraAte = 400, mandatoAte = 800) {
    await db.query("update public.igrejas set natureza_juridica = 'organizacao_religiosa', ativada_em = current_date - 1000 where id = $1", [igreja])
    await conferido(igreja, 'estatuto', null, null)
    await conferido(igreja, 'cartao_cnpj', null, null, { natureza: 'organizacao_religiosa' })
    await conferido(igreja, 'ata_diretoria', -300, mandatoAte)
    await conferido(igreja, 'alvara', -300, alvaraAte)
  }
  const situacao = async (igreja: string) =>
    (await um<{ s: Situacao }>('select interno.situacao_igreja($1) as s', [igreja])).s
  const arquivo = async (quem: string, igreja: string) => {
    const caminho = `${igreja}/doc-${++arquivos}.pdf`
    await chamar(quem, "insert into storage.objects (bucket_id, name) values ('igrejas', $1)", [caminho])
    return caminho
  }
  const enviar = async (quem: string, igreja: string, dados: Record<string, unknown>) =>
    (await valor<{ id: string }>(quem, 'select public.enviar_documento_igreja($1, $2::jsonb) as id', [igreja, JSON.stringify(dados)])).id
  const conferir = (quem: string, doc: string, aceito = true, motivo: string | null = null) =>
    chamar(quem, 'select public.conferir_documento_igreja($1, $2, $3)', [doc, aceito, motivo])
  const tenhoPerfil = async (quem: string, perfil: string) =>
    (await valor<{ t: boolean }>(quem, 'select interno.tenho_perfil($1::public.perfil_acesso) as t', [perfil])).t
  const presido = async (quem: string) => (await chamar(quem, 'select * from interno.igrejas_que_presido()')).rows.length

  before(async () => {
    db = await criarBanco()
    // sem a tolerância de janeiro do alvará (testada em regras_regularizacao.test.ts): um alvará "vencido ontem" cai em
    // 31/12 quando o teste roda em 01/01, e a conta mudaria
    await db.query('update public.config_igrejas set dias_tolerancia_alvara = 0')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    await darPerfil(db, tesouraria, 'tesouraria')
    denominacao = (await um<{ id: string }>("insert into public.denominacoes (nome) values ('Denominação Fictícia') returning id")).id
    bairro = (await um<{ id: string }>("insert into public.bairros (nome) values ('Bairro Fictício') returning id")).id
    igrejaA = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Regular A', $1) returning id", [denominacao])).id
    igrejaB = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja B', $1) returning id", [denominacao])).id
    igrejaX = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja X', $1) returning id", [denominacao])).id
    pastorA = await criarUsuario(db, 'pa@teste.local', 'Pastor Presidente A')
    pastorB = await criarUsuario(db, 'pb@teste.local', 'Pastor Presidente B')
    pastorNovo = await criarUsuario(db, 'pn@teste.local', 'Pastor Elias Fictício')
    ministroA = await criarUsuario(db, 'ma@teste.local', 'Ministro A Fictício')
    ministroB = await criarUsuario(db, 'mb@teste.local', 'Ministro B Fictício')
    await associar(pastorA, igrejaA, true)
    await associar(pastorB, igrejaB, true)
    await associar(pastorNovo, igrejaX, false)
    await associar(ministroA, igrejaA, false)
    await associar(ministroB, igrejaB, false)
    await regularizarNoBanco(igrejaA)
    await regularizarNoBanco(igrejaB)
    cadeiras = (await um<{ id: string }>("insert into public.patrimonio_itens (nome, quantidade) values ('Cadeira fictícia', 50) returning id")).id
  })

  describe('a situação calculada pela data', () => {
    it('com todos os documentos em dia, a igreja é regular e o pastor presidente tem o perfil', async () => {
      const s = await situacao(igrejaA)
      assert.equal(s.situacao, 'regular')
      assert.deepEqual(s.vencidos, [])
      assert.equal(s.alvara_ate, await hoje(400))
      assert.equal(s.mandato_ate, await hoje(800))
      assert.equal(s.proximo_vencimento, await hoje(400))
      assert.equal(await tenhoPerfil(pastorA, 'presidente_igreja'), true)
      assert.equal(await presido(pastorA), 1)
    })

    it('o alvará venceu ontem: a igreja está suspensa hoje, com 30 dias para mandar; o perfil continua, só para mandar', async () => {
      const alvara = await um<{ id: string }>("select id from public.igreja_documentos where igreja_id = $1 and tipo = 'alvara'", [igrejaB])
      await db.query('update public.igreja_documentos set valido_ate = current_date - 1 where id = $1', [alvara.id])
      const s = await situacao(igrejaB)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.vencidos, ['alvara'])
      assert.equal(s.suspensa_desde, await hoje(0))
      assert.equal(s.prazo_ate, await hoje(29))
      assert.equal(s.perfil_bloqueado, false)
      // o perfil continua, mas só para mandar o documento: não preside com todos os direitos
      assert.equal(await tenhoPerfil(pastorB, 'presidente_igreja'), true)
      assert.equal(await presido(pastorB), 0)
      assert.equal((await chamar(pastorB, 'select * from interno.igrejas_que_cuido()')).rows.length, 1)
      // bloqueado para o resto: o contato da igreja e o empréstimo
      const r = await chamar(pastorB, "update public.igrejas set telefone = '(94) 90000-0000' where id = $1", [igrejaB])
      assert.equal(r.affectedRows, 0)
      await assert.rejects(
        chamar(secretaria, 'select public.pedir_emprestimo($1::jsonb)', [
          JSON.stringify({ igreja_id: igrejaB, retirada: await hoje(5), devolucao: await hoje(6), finalidade: 'Culto', aceite: true, itens: [{ item_id: cadeiras, quantidade: 2 }] }),
        ]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('31 dias depois do vencimento, sem ter mandado o documento: o perfil de pastor presidente é bloqueado', async () => {
      await db.query("update public.igreja_documentos set valido_ate = current_date - 31 where igreja_id = $1 and tipo = 'alvara'", [igrejaB])
      const s = await situacao(igrejaB)
      assert.equal(s.situacao, 'suspensa')
      assert.equal(s.suspensa_desde, await hoje(-30))
      assert.equal(s.prazo_ate, await hoje(-1))
      assert.equal(s.perfil_bloqueado, true)
      assert.equal(await tenhoPerfil(pastorB, 'presidente_igreja'), false)
      assert.deepEqual((await valor<{ p: string[] }>(pastorB, 'select public.meus_perfis() as p')).p, ['ministro'])
      // ele continua ministro associado; já não manda o documento (só a secretaria, pela igreja)
      assert.equal(await tenhoPerfil(pastorB, 'ministro'), true)
      await assert.rejects(arquivo(pastorB, igrejaB), erroComCodigo(SEM_PERMISSAO))
      // a minha igreja ainda aparece para ele, com o bloqueio
      const minha = await valor<{ m: { situacao: Situacao } }>(pastorB, 'select public.minha_igreja() as m')
      assert.equal(minha.m.situacao.perfil_bloqueado, true)
    })

    it('a secretaria manda o alvará novo pela igreja: entra conferido, a igreja volta a ser regular e o perfil volta', async () => {
      const caminho = await arquivo(secretaria, igrejaB)
      const id = await enviar(secretaria, igrejaB, { tipo: 'alvara', valido_de: await hoje(0), valido_ate: await hoje(200), partes: [{ caminho, nome: 'alvara.pdf', tamanho: 2000 }] })
      const d = await um<{ situacao: string }>('select situacao::text from public.igreja_documentos where id = $1', [id])
      assert.equal(d.situacao, 'conferido')
      assert.equal((await situacao(igrejaB)).situacao, 'regular')
      assert.equal(await tenhoPerfil(pastorB, 'presidente_igreja'), true)
      assert.equal(await presido(pastorB), 1)
    })

    it('mandou dentro dos 30 dias (esperando a conferência): passados os 30 dias, o perfil não é bloqueado', async () => {
      const igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Prazo', $1) returning id", [denominacao])).id
      const pastor = await criarUsuario(db, 'pprazo@teste.local', 'Pastor do Prazo')
      await associar(pastor, igreja, true)
      await regularizarNoBanco(igreja)
      await db.query("update public.igreja_documentos set valido_ate = current_date - 5 where igreja_id = $1 and tipo = 'ata_diretoria'", [igreja])
      const caminho = await arquivo(pastor, igreja)
      await enviar(pastor, igreja, {
        tipo: 'ata_diretoria',
        partes: [{ caminho }],
        diretoria: [{ cargo: 'Presidente', pessoa_id: pessoa[pastor], inicio: await hoje(-4), fim: await hoje(1400) }],
      })
      // o tempo passa: o vencimento fica 40 dias para trás e a ata nova continua esperando a secretaria
      await db.query("update public.igreja_documentos set valido_ate = current_date - 40 where igreja_id = $1 and tipo = 'ata_diretoria' and situacao = 'conferido'", [igreja])
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.vencidos, ['ata_diretoria'])
      assert.equal(s.perfil_bloqueado, false)
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), true)
    })
  })

  describe('o documento antecipado entra sozinho no dia certo', () => {
    let igreja: string
    let pastor: string
    before(async () => {
      igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Antecipada', $1) returning id", [denominacao])).id
      pastor = await criarUsuario(db, 'pant@teste.local', 'Pastor Antecipado')
      await associar(pastor, igreja, true)
      await regularizarNoBanco(igreja, 10)
    })

    it('o pastor manda o alvará do ano seguinte antes de vencer; conferido, ele emenda no atual', async () => {
      const caminho = await arquivo(pastor, igreja)
      const id = await enviar(pastor, igreja, {
        tipo: 'alvara',
        valido_de: await hoje(11),
        valido_ate: await hoje(376),
        partes: [{ caminho, nome: 'alvara-proximo.pdf', tamanho: 1500 }],
      })
      // esperando a conferência, ainda não conta
      assert.equal((await situacao(igreja)).alvara_ate, await hoje(10))
      await conferir(secretaria, id)
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'regular')
      assert.equal(s.alvara_ate, await hoje(376))
    })

    it('no dia em que o atual vence, o seguinte já vale: nenhum dia de suspensão', async () => {
      // o tempo passa: o atual venceu ontem e o seguinte começou hoje
      await db.query(
        `update public.igreja_documentos set valido_ate = current_date - 1 where igreja_id = $1 and tipo = 'alvara' and valido_de < current_date`,
        [igreja],
      )
      await db.query(
        `update public.igreja_documentos set valido_de = current_date where igreja_id = $1 and tipo = 'alvara' and valido_ate > current_date + 100`,
        [igreja],
      )
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'regular')
      assert.equal(s.alvara_ate, await hoje(376))
    })

    it('se o seguinte só começa amanhã, hoje (o dia sem alvará) a igreja fica suspensa', async () => {
      await db.query(
        `update public.igreja_documentos set valido_de = current_date + 1 where igreja_id = $1 and tipo = 'alvara' and valido_ate > current_date + 100`,
        [igreja],
      )
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.vencidos, ['alvara'])
    })

    it('alvará já vencido não é aceito; sem a validade, também não', async () => {
      const caminho = await arquivo(pastor, igreja)
      await assert.rejects(enviar(pastor, igreja, { tipo: 'alvara', valido_ate: await hoje(-1), partes: [{ caminho }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(enviar(pastor, igreja, { tipo: 'alvara', partes: [{ caminho }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('o histórico (parte 6): a secretaria registra o documento que já venceu', () => {
    it('o alvará vencido entra pela secretaria (conferido) e suspende a igreja; pelo pastor, não', async () => {
      const igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Histórico', $1) returning id", [denominacao])).id
      const pastor = await criarUsuario(db, 'phist@teste.local', 'Pastor do Histórico')
      await associar(pastor, igreja, true)
      await regularizarNoBanco(igreja)
      await db.query("update public.igreja_documentos set arquivado_em = now() where igreja_id = $1 and tipo = 'alvara'", [igreja])
      // ativada hoje, sem alvará: está nos 30 dias (o pastor ainda manda)
      await db.query('update public.igrejas set ativada_em = current_date where id = $1', [igreja])
      await assert.rejects(
        enviar(pastor, igreja, { tipo: 'alvara', valido_de: await hoje(-366), valido_ate: await hoje(-1), partes: [{ caminho: await arquivo(pastor, igreja) }] }),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const id = await enviar(secretaria, igreja, {
        tipo: 'alvara',
        valido_de: await hoje(-366),
        valido_ate: await hoje(-1),
        partes: [{ caminho: await arquivo(secretaria, igreja) }],
      })
      assert.equal((await um<{ s: string }>('select situacao::text as s from public.igreja_documentos where id = $1', [id])).s, 'conferido')
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.equal(s.suspensa_desde, await hoje(0))
      // a ata da diretoria anterior também entra, para o histórico
      await enviar(secretaria, igreja, {
        tipo: 'ata_diretoria',
        partes: [{ caminho: await arquivo(secretaria, igreja) }],
        diretoria: [{ cargo: 'Presidente', nome: 'Presidente Anterior Fictício', inicio: await hoje(-2000), fim: await hoje(-600) }],
      })
      assert.deepEqual((await situacao(igreja)).vencidos, ['alvara'])
    })
  })

  describe('os ajudantes internos (parte 6)', () => {
    it('quem tem login não chama direto o que só as outras funções usam (tornar pastor presidente, a natureza)', async () => {
      await assert.rejects(
        chamar(ministroA, 'select interno.tornar_pastor_presidente($1, $2)', [pessoa[ministroA], igrejaX]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(chamar(secretaria, 'select interno.ajustar_prazo_natureza($1)', [igrejaA]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(secretaria, 'select interno.efeitos_do_documento($1)', [igrejaA]), erroComCodigo(SEM_PERMISSAO))
    })
  })

  describe('a diretoria por cargo e o menor mandato', () => {
    it('a ata vale até o MENOR mandato; o cargo é de um ministro associado ou um nome completo', async () => {
      const caminho = await arquivo(pastorA, igrejaA)
      const id = await enviar(pastorA, igrejaA, {
        tipo: 'ata_diretoria',
        partes: [{ caminho }, { caminho: await arquivo(pastorA, igrejaA) }],
        diretoria: [
          { cargo: 'Presidente', pessoa_id: pessoa[pastorA], inicio: await hoje(900), fim: await hoje(900 + 1460) },
          { cargo: 'Vice-presidente', nome: 'Natan Ribeiro Fictício', inicio: await hoje(900), fim: await hoje(900 + 1460) },
          { cargo: 'Tesoureiro', nome: 'Jonas Batista Fictício', inicio: await hoje(900), fim: await hoje(900 + 1095) },
        ],
      })
      const d = await um<{ de: string; ate: string; partes: number; cargos: number; nome: string }>(
        `select d.valido_de::text as de, d.valido_ate::text as ate,
                (select count(*)::int from public.igreja_documento_partes p where p.documento_id = d.id) as partes,
                (select count(*)::int from public.igreja_diretoria g where g.documento_id = d.id) as cargos,
                (select g.nome from public.igreja_diretoria g where g.documento_id = d.id and g.cargo = 'Presidente') as nome
         from public.igreja_documentos d where d.id = $1`,
        [id],
      )
      assert.deepEqual(d, { de: await hoje(900), ate: await hoje(900 + 1095), partes: 2, cargos: 3, nome: 'Pastor Presidente A' })
      // a ata seguinte (antecipada) emenda no mandato atual quando conferida? Começa depois do fim do atual: não emenda
      await conferir(secretaria, id)
      assert.equal((await situacao(igrejaA)).mandato_ate, await hoje(800))
    })

    it('não existe mandato sem prazo nem vitalício; o ministro do cargo é associado ativo', async () => {
      const partes = [{ caminho: await arquivo(pastorA, igrejaA) }]
      const tentar = async (membro: Record<string, unknown>) =>
        enviar(pastorA, igrejaA, { tipo: 'ata_diretoria', partes, diretoria: [{ cargo: 'Presidente', ...membro }] })
      await assert.rejects(tentar({ nome: 'Fulano de Tal', inicio: await hoje(0) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ nome: 'Fulano de Tal', inicio: await hoje(0), fim: await hoje(365 * 25) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ nome: 'Fulano de Tal', inicio: await hoje(0), fim: await hoje(-10) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ nome: 'Fu', inicio: await hoje(0), fim: await hoje(100) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ pessoa_id: pessoa[secretaria] ?? '00000000-0000-0000-0000-000000000000', inicio: await hoje(0), fim: await hoje(100) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(enviar(pastorA, igrejaA, { tipo: 'ata_diretoria', partes, diretoria: [] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('arquivo de mais de 25 MB, fora da pasta da igreja ou sem partes: recusado', async () => {
      const caminho = await arquivo(pastorA, igrejaA)
      await assert.rejects(enviar(pastorA, igrejaA, { tipo: 'estatuto', partes: [{ caminho, tamanho: 30_000_000 }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(enviar(pastorA, igrejaA, { tipo: 'estatuto', partes: [{ caminho: `${igrejaB}/x.pdf` }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(enviar(pastorA, igrejaA, { tipo: 'estatuto', partes: [] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(enviar(pastorA, igrejaA, { tipo: 'estatuto', partes: [{ caminho }, { caminho }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('a natureza jurídica', () => {
    it('associação privada: 120 dias desde o Cartão conferido; a ata não muda o prazo; o Cartão novo encerra', async () => {
      const igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Associação', $1) returning id", [denominacao])).id
      await db.query('update public.igrejas set ativada_em = current_date - 10 where id = $1', [igreja])
      await conferido(igreja, 'estatuto', null, null)
      await conferido(igreja, 'alvara', -10, 300)
      await conferido(igreja, 'ata_diretoria', -100, 3000)
      // o Cartão CNPJ diz associação privada: a igreja passa a ser associação privada, com 120 dias desde a conferência
      const cartao = await enviar(secretaria, igreja, { tipo: 'cartao_cnpj', natureza: 'associacao_privada', partes: [{ caminho: await arquivo(secretaria, igreja) }] })
      assert.ok(cartao)
      assert.equal((await um<{ n: string }>('select natureza_juridica as n from public.igrejas where id = $1', [igreja])).n, 'associacao_privada')
      let s = await situacao(igreja)
      assert.equal(s.situacao, 'regular')
      assert.equal(s.natureza_prazo, await hoje(120))
      // a ata que muda a natureza não muda mais o prazo
      await enviar(secretaria, igreja, {
        tipo: 'ata_diretoria',
        muda_natureza: true,
        partes: [{ caminho: await arquivo(secretaria, igreja) }],
        diretoria: [{ cargo: 'Presidente', nome: 'Presidente Fictício', inicio: await hoje(-1), fim: await hoje(1400) }],
      })
      s = await situacao(igreja)
      assert.equal(s.natureza_prazo, await hoje(120))
      // o cartão novo, como organização religiosa
      await enviar(secretaria, igreja, { tipo: 'cartao_cnpj', natureza: 'organizacao_religiosa', partes: [{ caminho: await arquivo(secretaria, igreja) }] })
      assert.equal((await um<{ n: string }>('select natureza_juridica as n from public.igrejas where id = $1', [igreja])).n, 'organizacao_religiosa')
      assert.equal((await situacao(igreja)).natureza_prazo, null)
    })

    it('a secretaria muda a natureza na ficha (sem Cartão conferido): associação privada ganha os 120 dias', async () => {
      const igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Natureza Ficha', $1) returning id", [denominacao])).id
      await db.query('update public.igrejas set ativada_em = current_date - 10 where id = $1', [igreja])
      await conferido(igreja, 'ata_diretoria', -10, 365)
      await chamar(secretaria, "update public.igrejas set natureza_juridica = 'associacao_privada' where id = $1", [igreja])
      assert.equal((await situacao(igreja)).natureza_prazo, await hoje(120))
      await chamar(secretaria, "update public.igrejas set natureza_juridica = 'organizacao_religiosa' where id = $1", [igreja])
      assert.equal((await situacao(igreja)).natureza_prazo, null)
      // o pastor presidente não muda a natureza
      const r = await chamar(pastorA, "update public.igrejas set natureza_juridica = 'associacao_privada' where id = $1", [igrejaA]).catch((e) => e)
      assert.equal((r as { code?: string }).code, SEM_PERMISSAO)
    })

    it('o Cartão CNPJ precisa dizer a natureza', async () => {
      await assert.rejects(enviar(pastorA, igrejaA, { tipo: 'cartao_cnpj', partes: [{ caminho: await arquivo(pastorA, igrejaA) }] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('o que nunca foi mandado (sem a transição desde 26/11/2026)', () => {
    it('a igreja sem documentos fica suspensa desde a ativação, com os 30 dias; o fim da transição não conta mais', async () => {
      // o fim da transição (aberto pelo ambiente dos testes) não muda nada
      await db.query("update public.config_igrejas set transicao_ate = '2999-12-31'")
      await db.query('update public.igrejas set ativada_em = current_date where id = $1', [igrejaX])
      try {
        const s = await situacao(igrejaX)
        assert.equal(s.situacao, 'suspensa')
        assert.equal(s.suspensa_desde, await hoje(0))
        assert.equal(s.prazo_ate, await hoje(29))
        assert.equal(s.perfil_bloqueado, false)
      } finally {
        await db.query("update public.igrejas set ativada_em = '2999-12-31' where id = $1", [igrejaX])
      }
    })

    it('só a presidência muda as regras; quem é do COMEP lê', async () => {
      const r = await chamar(secretaria, 'update public.config_igrejas set dias_para_mandar = 60')
      assert.equal(r.affectedRows, 0)
      assert.equal((await chamar(ministroA, 'select dias_para_mandar from public.config_igrejas')).rows.length, 1)
    })
  })

  describe('a igreja sem registro', () => {
    let igreja: string
    it('a secretaria faz o cadastro simples: sem CNPJ, sem natureza e sem pastor presidente', async () => {
      igreja = (
        await valor<{ id: string }>(secretaria, 'select public.cadastrar_igreja($1::jsonb) as id', [
          JSON.stringify({ tem_registro: false, nome: 'Igreja Evangélica Betânia (fictícia)', denominacao_id: denominacao, telefone: '(94) 99777-0000', presidente_nome: 'Pr. Josué Fictício' }),
        ])
      ).id
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'sem_registro')
      assert.equal(s.perfil_bloqueado, true)
      // com o pastor presidente escolhido: recusado
      await assert.rejects(
        chamar(secretaria, 'select public.cadastrar_igreja($1::jsonb)', [
          JSON.stringify({ tem_registro: false, nome: 'Outra Sem Registro', denominacao_id: denominacao, presidente_id: pessoa[ministroA] }),
        ]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('ninguém recebe o perfil de pastor presidente nela, e ela não pega empréstimo (nem pela secretaria)', async () => {
      const p = await criarUsuario(db, 'psr@teste.local', 'Pastor Sem Registro')
      const pid = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [p])).id
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pid])
      await assert.rejects(
        db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, true)', [pid, igreja]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      // o ministro dela pode ser associado (ligado à igreja, sem ser pastor presidente)
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pid, igreja])
      await assert.rejects(
        chamar(secretaria, 'select public.pedir_emprestimo($1::jsonb)', [
          JSON.stringify({ igreja_id: igreja, retirada: await hoje(5), devolucao: await hoje(6), finalidade: 'Culto', aceite: true, itens: [{ item_id: cadeiras, quantidade: 1 }] }),
        ]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('regularizar: com o CNPJ e a natureza, vira cadastro completo', async () => {
      await assert.rejects(chamar(pastorA, 'select public.regularizar_igreja($1, $2, $3)', [igreja, cnpjFicticio('112223330001'), 'organizacao_religiosa']), erroComCodigo(SEM_PERMISSAO))
      await chamar(secretaria, 'select public.regularizar_igreja($1, $2, $3)', [igreja, cnpjFicticio('112223330001'), 'organizacao_religiosa'])
      const g = await um<{ cadastro: string }>('select cadastro from public.igrejas where id = $1', [igreja])
      assert.equal(g.cadastro, 'completo')
      assert.notEqual((await situacao(igreja)).situacao, 'sem_registro')
    })
  })

  describe('o cadastro completo pela secretaria', () => {
    it('com o CNPJ, a natureza e o pastor presidente (ministro associado): ele passa para a igreja nova', async () => {
      const p = await criarUsuario(db, 'pcad@teste.local', 'Pastor do Cadastro')
      await associar(p, igrejaX, false)
      const id = (
        await valor<{ id: string }>(secretaria, 'select public.cadastrar_igreja($1::jsonb) as id', [
          JSON.stringify({
            nome: 'Igreja Missionária Fictícia',
            sigla: 'imf',
            denominacao_id: denominacao,
            cnpj: cnpjFicticio('223334440001'),
            natureza_juridica: 'organizacao_religiosa',
            fundada_em: 2014,
            membros: 120,
            bairro_id: bairro,
            cep: '68515-000',
            email: 'contato@exemplo.com',
            site: 'exemplo.com',
            convencao: 'Convenção Estadual Fictícia',
            presidente_id: pessoa[p],
          }),
        ])
      ).id
      const g = await um<Record<string, unknown>>('select sigla, cep, site, cadastro, presidente_nome from public.igrejas where id = $1', [id])
      assert.deepEqual(g, { sigla: 'IMF', cep: '68515000', site: 'https://exemplo.com', cadastro: 'completo', presidente_nome: 'Pastor do Cadastro' })
      const v = await um<{ igreja_id: string; pastor_presidente: boolean }>(
        'select igreja_id, pastor_presidente from public.vinculos_igreja where pessoa_id = $1 and fim is null',
        [pessoa[p]],
      )
      assert.deepEqual(v, { igreja_id: id, pastor_presidente: true })
      // o vínculo anterior fica no histórico
      assert.equal((await um<{ n: number }>('select count(*)::int as n from public.vinculos_igreja where pessoa_id = $1', [pessoa[p]])).n, 2)
    })

    it('CNPJ repetido ou inválido, sem denominação ou sem natureza: recusado; o pastor presidente de outra igreja também', async () => {
      const base = { nome: 'Igreja Repetida', denominacao_id: denominacao, natureza_juridica: 'organizacao_religiosa' }
      const tentar = (dados: Record<string, unknown>) => chamar(secretaria, 'select public.cadastrar_igreja($1::jsonb)', [JSON.stringify(dados)])
      await assert.rejects(tentar({ ...base, cnpj: cnpjFicticio('223334440001') }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ ...base, cnpj: '11111111111111' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ ...base, cnpj: cnpjFicticio('334445550001'), denominacao_id: null }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ ...base, cnpj: cnpjFicticio('334445550001'), natureza_juridica: null }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(tentar({ ...base, cnpj: cnpjFicticio('334445550001'), presidente_id: pessoa[pastorA] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        chamar(pastorA, 'select public.cadastrar_igreja($1::jsonb)', [JSON.stringify({ ...base, cnpj: cnpjFicticio('334445550001') })]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('a igreja nova cadastrada pelo pastor (em análise, conferida item por item)', () => {
    let igreja: string
    const dados = {
      nome: 'Igreja Shalom Fictícia',
      denominacao_id: '',
      cnpj: cnpjFicticio('445556660001'),
      natureza_juridica: 'organizacao_religiosa',
      endereco: 'Rua Fictícia, 250',
      telefone: '(94) 93346-5555',
    }
    const item = (quem: string, nome: string, aprovar: boolean, motivo: string | null = null) =>
      chamar(quem, 'select public.conferir_item_igreja($1, $2, $3, $4)', [igreja, nome, aprovar, motivo])

    it('o ministro associado cadastra a própria igreja; ela fica em análise, com os três itens', async () => {
      dados.denominacao_id = denominacao
      igreja = (await valor<{ id: string }>(pastorNovo, 'select public.pedir_cadastro_igreja($1::jsonb) as id', [JSON.stringify(dados)])).id
      const g = await um<{ cadastro: string; cadastrada_por: string }>('select cadastro, cadastrada_por from public.igrejas where id = $1', [igreja])
      assert.deepEqual(g, { cadastro: 'em_analise', cadastrada_por: pessoa[pastorNovo] })
      const itens = await chamar(pastorNovo, 'select item, situacao from public.igreja_analise_itens where igreja_id = $1 order by item', [igreja])
      assert.deepEqual(itens.rows, [
        { item: 'dados', situacao: 'analise' },
        { item: 'diretoria', situacao: 'analise' },
        { item: 'endereco', situacao: 'analise' },
      ])
      assert.equal((await situacao(igreja)).situacao, 'em_analise')
      // um de cada vez; o pastor presidente de uma igreja não cadastra outra
      await assert.rejects(chamar(pastorNovo, 'select public.pedir_cadastro_igreja($1::jsonb)', [JSON.stringify({ ...dados, cnpj: cnpjFicticio('556667770001') })]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(pastorA, 'select public.pedir_cadastro_igreja($1::jsonb)', [JSON.stringify({ ...dados, cnpj: cnpjFicticio('556667770001') })]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // ninguém se liga a ela enquanto está em análise
      await assert.rejects(
        db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoa[ministroA], igreja]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('ele manda os documentos da igreja em análise; o outro pastor não vê nada dela', async () => {
      for (const tipo of ['estatuto', 'cartao_cnpj']) {
        await enviar(pastorNovo, igreja, { tipo, natureza: 'organizacao_religiosa', partes: [{ caminho: await arquivo(pastorNovo, igreja) }] })
      }
      await enviar(pastorNovo, igreja, {
        tipo: 'ata_diretoria',
        partes: [{ caminho: await arquivo(pastorNovo, igreja) }],
        diretoria: [{ cargo: 'Presidente', pessoa_id: pessoa[pastorNovo], inicio: await hoje(-30), fim: await hoje(1430) }],
      })
      assert.equal((await chamar(pastorNovo, 'select id from public.igreja_documentos where igreja_id = $1', [igreja])).rows.length, 3)
      assert.equal((await chamar(pastorA, 'select id from public.igreja_documentos where igreja_id = $1', [igreja])).rows.length, 0)
      assert.equal((await chamar(pastorA, 'select id from public.igreja_analise_itens where igreja_id = $1', [igreja])).rows.length, 0)
      await assert.rejects(arquivo(pastorA, igreja), erroComCodigo(SEM_PERMISSAO))
    })

    it('a secretaria confere item por item: recusa com o motivo; o pastor corrige só o que voltou', async () => {
      await assert.rejects(item(pastorNovo, 'dados', true), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(item(secretaria, 'endereco', false), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await item(secretaria, 'endereco', false, 'Falta o bairro')
      await item(secretaria, 'dados', true)
      await item(secretaria, 'diretoria', true)
      await assert.rejects(
        chamar(pastorNovo, 'select public.corrigir_cadastro_igreja($1, $2, $3::jsonb)', [igreja, 'dados', JSON.stringify(dados)]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(pastorNovo, 'select public.corrigir_cadastro_igreja($1, $2, $3::jsonb)', [igreja, 'endereco', JSON.stringify({ ...dados, bairro_id: bairro })])
      const r = await um<{ situacao: string; bairro_id: string }>(
        `select i.situacao, g.bairro_id from public.igreja_analise_itens i join public.igrejas g on g.id = i.igreja_id
         where i.igreja_id = $1 and i.item = 'endereco'`,
        [igreja],
      )
      assert.deepEqual(r, { situacao: 'analise', bairro_id: bairro })
    })

    it('"Ativar a igreja" só com tudo aprovado; ativa, o pastor vira o pastor presidente dela', async () => {
      await assert.rejects(chamar(secretaria, 'select public.ativar_igreja($1)', [igreja]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await item(secretaria, 'endereco', true)
      // os documentos ainda esperam a conferência
      await assert.rejects(chamar(secretaria, 'select public.ativar_igreja($1)', [igreja]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const docs = await chamar(secretaria, "select id from public.igreja_documentos where igreja_id = $1 and situacao = 'pendente'", [igreja])
      for (const d of docs.rows as { id: string }[]) await conferir(secretaria, d.id)
      await chamar(secretaria, 'select public.ativar_igreja($1)', [igreja])
      const g = await um<{ cadastro: string }>('select cadastro from public.igrejas where id = $1', [igreja])
      assert.equal(g.cadastro, 'completo')
      // o alvará não é exigido para ativar: ele tem os 30 dias, contados da ativação (o perfil continua, para mandar)
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.vencidos, ['alvara'])
      assert.equal(s.prazo_ate, await hoje(29))
      assert.equal(s.perfil_bloqueado, false)
      assert.equal(await tenhoPerfil(pastorNovo, 'presidente_igreja'), true)
      const minha = await valor<{ m: { igreja_id: string } }>(pastorNovo, 'select public.minha_igreja() as m')
      assert.equal(minha.m.igreja_id, igreja)
    })
  })

  describe('conferir os documentos', () => {
    it('ninguém confere o documento que ele mesmo mandou; o pastor presidente não confere', async () => {
      const dupla = await criarUsuario(db, 'dupla@teste.local', 'Secretária e Pastora')
      await darPerfil(db, dupla, 'secretaria')
      const igreja = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja da Secretária', $1) returning id", [denominacao])).id
      await associar(dupla, igreja, true)
      // ela preside a igreja: o que manda não entra conferido
      const id = await enviar(dupla, igreja, { tipo: 'estatuto', partes: [{ caminho: await arquivo(dupla, igreja) }] })
      assert.equal((await um<{ s: string }>('select situacao::text as s from public.igreja_documentos where id = $1', [id])).s, 'pendente')
      await assert.rejects(conferir(dupla, id), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(conferir(pastorA, id), erroComCodigo(SEM_PERMISSAO))
      await conferir(secretaria, id)
    })
  })

  describe('as filiais', () => {
    let filial: string
    const salvar = (quem: string, id: string | null, igreja: string | null, dados: Record<string, unknown>) =>
      valor<{ id: string }>(quem, 'select public.salvar_filial($1, $2, $3::jsonb) as id', [id, igreja, JSON.stringify(dados)]).then((r) => r.id)

    it('o pastor presidente (igreja regular) cadastra a congregação; o responsável é ministro associado da igreja', async () => {
      filial = await salvar(pastorA, null, igrejaA, {
        tipo: 'congregacao',
        nome: 'Congregação Bairro da Paz',
        bairro_id: bairro,
        responsavel_id: pessoa[ministroA],
        latitude: -6.067912,
        longitude: -49.902211,
      })
      await assert.rejects(salvar(pastorA, null, igrejaA, { tipo: 'celula', nome: 'Célula Fictícia', responsavel_id: pessoa[ministroB] }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(pastorA, null, igrejaA, { tipo: 'celula', nome: 'Célula Fictícia', latitude: -6.06 }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(pastorA, null, igrejaA, { tipo: 'templo', nome: 'Outra Fictícia' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(pastorA, null, igrejaA, { tipo: 'celula', nome: 'congregação bairro da paz' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // sem responsável também pode
      await salvar(pastorA, null, igrejaA, { tipo: 'celula', nome: 'Célula Família Fictícia' })
    })

    it('o pastor de outra igreja não cria nem vê; a secretaria vê; arquivar tira da lista', async () => {
      await assert.rejects(salvar(pastorB, null, igrejaA, { tipo: 'celula', nome: 'Célula Intrusa' }), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(salvar(pastorB, filial, null, { tipo: 'celula', nome: 'Mudada' }), erroComCodigo(SEM_PERMISSAO))
      assert.equal((await chamar(pastorB, 'select id from public.igreja_filiais')).rows.length, 0)
      assert.equal((await chamar(secretaria, 'select id from public.igreja_filiais where igreja_id = $1', [igrejaA])).rows.length, 2)
      await chamar(pastorA, 'select public.arquivar_filial($1)', [filial])
      assert.equal((await chamar(pastorA, 'select id from public.igreja_filiais')).rows.length, 1)
    })
  })

  describe('a tradição da denominação, o empréstimo registrado direto e quem lê', () => {
    it('a secretaria marca a tradição (da lista); o ministro não', async () => {
      await chamar(secretaria, "update public.denominacoes set tradicao = 'pentecostal' where id = $1", [denominacao])
      await assert.rejects(chamar(secretaria, "update public.denominacoes set tradicao = 'inventada' where id = $1", [denominacao]))
      const r = await chamar(ministroA, "update public.denominacoes set tradicao = 'batista' where id = $1", [denominacao])
      assert.equal(r.affectedRows, 0)
    })

    it('a secretaria registra o empréstimo direto (já aprovado); a tesouraria não registra direto', async () => {
      const pedido = (registrar_direto: boolean) =>
        JSON.stringify({ igreja_id: igrejaA, retirada: '2099-01-10', devolucao: '2099-01-11', finalidade: 'Culto de aniversário', aceite: true, registrar_direto, itens: [{ item_id: cadeiras, quantidade: 3 }] })
      const id = (await valor<{ id: string }>(secretaria, 'select public.pedir_emprestimo($1::jsonb) as id', [pedido(true)])).id
      assert.equal((await um<{ s: string }>('select situacao::text as s from public.emprestimos where id = $1', [id])).s, 'aprovado')
      await assert.rejects(chamar(tesouraria, 'select public.pedir_emprestimo($1::jsonb)', [pedido(true)]), erroComCodigo(SEM_PERMISSAO))
    })

    it('a situação de todas as igrejas é da secretaria; a do pastor, só a da igreja dele', async () => {
      const todas = await chamar(secretaria, 'select igreja_id, situacao ->> $1 as s from public.situacao_das_igrejas()', ['situacao'])
      assert.ok(todas.rows.length >= 5)
      await assert.rejects(chamar(pastorA, 'select * from public.situacao_das_igrejas()'), erroComCodigo(SEM_PERMISSAO))
      assert.equal((await valor<{ s: { situacao: string } }>(pastorA, 'select public.situacao_da_igreja($1) as s', [igrejaA])).s.situacao, 'regular')
      await assert.rejects(chamar(pastorA, 'select public.situacao_da_igreja($1)', [igrejaB]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(null, 'select public.minha_igreja()'), erroComCodigo(SEM_PERMISSAO))
      assert.equal((await valor<{ m: unknown }>(ministroA, 'select public.minha_igreja() as m')).m, null)
    })

    it('as partes dos documentos: o pastor lê as da sua igreja; o outro pastor e o ministro não', async () => {
      assert.ok((await chamar(pastorA, 'select p.id from public.igreja_documento_partes p join public.igreja_documentos d on d.id = p.documento_id where d.igreja_id = $1', [igrejaA])).rows.length > 0)
      assert.equal((await chamar(pastorB, 'select p.id from public.igreja_documento_partes p join public.igreja_documentos d on d.id = p.documento_id where d.igreja_id = $1', [igrejaA])).rows.length, 0)
      assert.equal((await chamar(ministroA, 'select id from public.igreja_documento_partes')).rows.length, 0)
    })

    it('nada se apaga nas tabelas novas', async () => {
      for (const tabela of ['config_igrejas', 'igreja_documento_partes', 'igreja_analise_itens', 'igreja_filiais']) {
        await assert.rejects(db.query(`delete from public.${tabela}`))
      }
    })
  })
})
