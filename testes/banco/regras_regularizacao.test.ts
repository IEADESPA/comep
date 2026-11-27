// As regras novas da regularização das igrejas, decididas pelo presidente em 26/11/2026 (substituem a transição até a
// AGO de 28/04/2027): o que falta na ativação tem 30 dias, contados dela, sem suspender a igreja (só suspende se passar
// o prazo sem o documento; leitura confirmada em 27/11/2026); o alvará que vence em 31/12 tem até 31/01; a recusa
// depois do prazo devolve 7 dias; a natureza jurídica é a do Cartão CNPJ conferido; a associação privada e a igreja sem
// registro têm 120 dias. Junto: o documento de quem é da secretaria e preside a igreja bloqueada (S7-01) e o efeito das
// regras antes de salvar (S7-08). Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { aplicarMigracao, como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const MIGRACAO = '20261126150000'
/** A S7-01 e a regra 1 lida como o presidente decidiu (27/11/2026): nos 30 dias depois da ativação, sem suspender. */
const MIGRACOES_SEGUINTES = ['20261126150100', '20261126150200']

type Situacao = {
  situacao: string
  vencidos: string[]
  nunca_vieram: string[]
  pendencias: string[]
  pendencias_ate: string | null
  suspensa_desde: string | null
  prazo_ate: string | null
  perfil_bloqueado: boolean
  alvara_ate: string | null
  natureza_prazo: string | null
  readequacao_ate: string | null
  ativada_em: string | null
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

describe('Regularização das igrejas — as regras de 26/11/2026', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let denominacao: string
  const pessoa: Record<string, string> = {}
  let arquivos = 0
  let cnpjs = 100

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const valor = async <T>(quem: string, sql: string, params: unknown[] = []) => (await chamar(quem, sql, params)).rows[0] as T
  const hoje = async (dias = 0) => (await um<{ d: string }>('select (current_date + $1::int)::text as d', [dias])).d
  const mais = async (dia: string, dias: number) => (await um<{ d: string }>('select ($1::date + $2::int)::text as d', [dia, dias])).d
  /**
   * Fora do bloco do alvará do ano, sem a tolerância de janeiro: um alvará "vencido há 10 dias" cai em 31/12 quando o
   * teste roda em janeiro, e a conta mudaria. O bloco do alvará do ano usa a tolerância padrão.
   */
  const semTolerancia = () => {
    before(() => db.query('update public.config_igrejas set dias_tolerancia_alvara = 0'))
    after(() => db.query('update public.config_igrejas set dias_tolerancia_alvara = 31'))
  }
  const situacao = async (igreja: string, dia?: string) =>
    dia
      ? (await um<{ s: Situacao }>('select interno.situacao_igreja($1, $2::date) as s', [igreja, dia])).s
      : (await um<{ s: Situacao }>('select interno.situacao_igreja($1) as s', [igreja])).s
  const tenhoPerfil = async (quem: string, perfil: string) =>
    (await valor<{ t: boolean }>(quem, 'select interno.tenho_perfil($1::public.perfil_acesso) as t', [perfil])).t
  const cuido = async (quem: string, igreja: string) =>
    (await chamar(quem, 'select x from interno.igrejas_que_cuido() x where x = $1', [igreja])).rows.length === 1
  const arquivo = async (quem: string, igreja: string) => {
    const caminho = `${igreja}/regra-${++arquivos}.pdf`
    await chamar(quem, "insert into storage.objects (bucket_id, name) values ('igrejas', $1)", [caminho])
    return caminho
  }
  const enviar = async (quem: string, igreja: string, dados: Record<string, unknown>) =>
    (await valor<{ id: string }>(quem, 'select public.enviar_documento_igreja($1, $2::jsonb) as id', [igreja, JSON.stringify(dados)])).id
  const conferir = (quem: string, doc: string, aceito = true, motivo: string | null = null) =>
    chamar(quem, 'select public.conferir_documento_igreja($1, $2, $3)', [doc, aceito, motivo])
  const situacaoDoDocumento = async (id: string) =>
    (await um<{ s: string }>('select situacao::text as s from public.igreja_documentos where id = $1', [id])).s

  /** Um ministro associado (com login), ligado à igreja. */
  async function ministro(email: string, nome: string, igreja: string, presidente: boolean) {
    const usuario = await criarUsuario(db, email, nome)
    const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])
    pessoa[usuario] = p.id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.id])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [p.id, igreja, presidente])
    return usuario
  }
  /** A igreja cadastrada hoje pela secretaria (com registro), ainda sem documento nenhum. */
  async function igrejaNova(nome: string, natureza = 'organizacao_religiosa') {
    return (
      await valor<{ id: string }>(secretaria, 'select public.cadastrar_igreja($1::jsonb) as id', [
        JSON.stringify({ nome, denominacao_id: denominacao, cnpj: cnpjFicticio(`77788899${String(++cnpjs).padStart(4, '0')}`), natureza_juridica: natureza }),
      ])
    ).id
  }
  /** O documento já conferido, direto no banco (o dono do banco monta o cenário com as datas que quiser). */
  async function conferido(igreja: string, tipo: string, de: string | null, ate: string | null, natureza: string | null = null) {
    return (
      await um<{ id: string }>(
        `insert into public.igreja_documentos (igreja_id, tipo, arquivo_caminho, situacao, valido_de, valido_ate, natureza, conferido_em)
         values ($1::uuid, $2::public.tipo_documento_igreja, $1::text || '/semente-' || gen_random_uuid() || '.pdf', 'conferido',
                 $3::date, $4::date, $5, now())
         returning id`,
        [igreja, tipo, de, ate, natureza],
      )
    ).id
  }
  /** Igreja com o estatuto, o Cartão CNPJ e a ata em dia, e o alvará até `alvaraAte`, ativada há muito tempo. */
  async function igrejaComDocumentos(nome: string, alvaraAte: string) {
    const igreja = await igrejaNova(nome)
    await db.query('update public.igrejas set ativada_em = current_date - 400 where id = $1', [igreja])
    await conferido(igreja, 'estatuto', null, null)
    await conferido(igreja, 'cartao_cnpj', null, null, 'organizacao_religiosa')
    await conferido(igreja, 'ata_diretoria', await hoje(-300), await hoje(3000))
    await conferido(igreja, 'alvara', await hoje(-500), alvaraAte)
    return igreja
  }

  before(async () => {
    db = await criarBanco()
    // aqui as igrejas nascem com a ativação de verdade (o ambiente dos testes antigos põe um dia que não chega)
    await db.exec('alter table public.igrejas alter column ativada_em drop default')
    secretaria = await criarUsuario(db, 'secretaria@regras.local', 'Secretaria das Regras')
    await darPerfil(db, secretaria, 'secretaria')
    presidencia = await criarUsuario(db, 'presidencia@regras.local', 'Presidência das Regras')
    await darPerfil(db, presidencia, 'presidencia')
    denominacao = (await um<{ id: string }>("insert into public.denominacoes (nome) values ('Denominação das Regras (fictícia)') returning id")).id
  })

  describe('as regras padrão e quem muda', () => {
    it('os padrões: 30 dias, tolerância do alvará até 31/01, 7 dias depois da recusa e 120 dias (natureza e sem registro)', async () => {
      const c = await um<Record<string, number>>(
        'select dias_para_mandar, dias_tolerancia_alvara, dias_apos_recusa, dias_natureza, dias_readequacao from public.config_igrejas',
      )
      assert.deepEqual(c, { dias_para_mandar: 30, dias_tolerancia_alvara: 31, dias_apos_recusa: 7, dias_natureza: 120, dias_readequacao: 120 })
    })

    it('só a presidência muda os prazos; a data da transição e a da AGO não se mudam mais', async () => {
      assert.equal((await chamar(secretaria, 'update public.config_igrejas set dias_natureza = 200')).affectedRows, 0)
      const r = await chamar(presidencia, 'update public.config_igrejas set dias_natureza = 200, dias_apos_recusa = 10')
      assert.equal(r.affectedRows, 1)
      await chamar(presidencia, 'update public.config_igrejas set dias_natureza = 120, dias_apos_recusa = 7')
      await assert.rejects(chamar(presidencia, "update public.config_igrejas set transicao_ate = '2026-01-01'"), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(presidencia, "update public.config_igrejas set readequacao_ate = '2026-01-01'"), erroComCodigo(SEM_PERMISSAO))
      // fora dos limites, o banco recusa
      await assert.rejects(chamar(presidencia, 'update public.config_igrejas set dias_apos_recusa = 0'))
      await assert.rejects(chamar(presidencia, 'update public.config_igrejas set dias_natureza = 10'))
    })
  })

  describe('1. o documento que falta: 30 dias contados da ativação, sem suspender', () => {
    semTolerancia()
    const TUDO = ['estatuto', 'cartao_cnpj', 'ata_diretoria', 'alvara']
    it('a igreja cadastrada hoje, sem documentos, fica regular com os 30 dias para mandar (não suspensa); o pastor tem o perfil', async () => {
      const igreja = await igrejaNova('Igreja Ativada Hoje (fictícia)')
      const pastor = await ministro('pativa@regras.local', 'Pastor Ativado Fictício', igreja, true)
      const s = await situacao(igreja)
      assert.equal(s.ativada_em, await hoje(0))
      assert.equal(s.situacao, 'regular')
      assert.deepEqual(s.pendencias, TUDO)
      assert.equal(s.pendencias_ate, await hoje(29))
      assert.deepEqual(s.vencidos, [])
      assert.deepEqual(s.nunca_vieram, TUDO)
      assert.equal(s.suspensa_desde, null)
      assert.equal(s.perfil_bloqueado, false)
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), true)
      assert.equal(await cuido(pastor, igreja), true)
    })

    it('passou o prazo sem o documento: suspensa no dia seguinte, com os 30 dias de sempre; depois, o perfil é bloqueado', async () => {
      const igreja = await igrejaNova('Igreja do Prazo Vencido (fictícia)')
      const pastor = await ministro('pprazo@regras.local', 'Pastor do Prazo Fictício', igreja, true)
      // ativada há 29 dias: hoje é o último dia, ainda regular
      await db.query('update public.igrejas set ativada_em = current_date - 29 where id = $1', [igreja])
      let s = await situacao(igreja)
      assert.equal(s.situacao, 'regular')
      assert.equal(s.pendencias_ate, await hoje(0))
      // há 30: suspensa desde hoje, com os 30 dias para mandar
      await db.query('update public.igrejas set ativada_em = current_date - 30 where id = $1', [igreja])
      s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.vencidos, TUDO)
      assert.deepEqual(s.nunca_vieram, TUDO)
      assert.deepEqual(s.pendencias, [])
      assert.equal(s.suspensa_desde, await hoje(0))
      assert.equal(s.prazo_ate, await hoje(29))
      assert.equal(s.perfil_bloqueado, false)
      // há 59: o último dia para mandar; há 60, o perfil é bloqueado
      await db.query('update public.igrejas set ativada_em = current_date - 59 where id = $1', [igreja])
      assert.equal((await situacao(igreja)).perfil_bloqueado, false)
      await db.query('update public.igrejas set ativada_em = current_date - 60 where id = $1', [igreja])
      assert.equal((await situacao(igreja)).perfil_bloqueado, true)
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), false)
    })

    it('os dias para mandar são os das regras (a presidência muda)', async () => {
      const igreja = await igrejaNova('Igreja dos Dias Mudados (fictícia)')
      await chamar(presidencia, 'update public.config_igrejas set dias_para_mandar = 45')
      try {
        assert.equal((await situacao(igreja)).pendencias_ate, await hoje(44))
      } finally {
        await chamar(presidencia, 'update public.config_igrejas set dias_para_mandar = 30')
      }
    })

    it('conta da ativação, não da criação do cadastro (S7-03): a igreja nova pedida há 45 dias e ativada hoje', async () => {
      const pastor = await ministro('ppedido@regras.local', 'Pastor do Pedido Fictício', await igrejaNova('Igreja de Origem (fictícia)'), false)
      const igreja = (
        await valor<{ id: string }>(pastor, 'select public.pedir_cadastro_igreja($1::jsonb) as id', [
          JSON.stringify({ nome: 'Igreja Pedida (fictícia)', denominacao_id: denominacao, cnpj: cnpjFicticio('556677880001'), natureza_juridica: 'organizacao_religiosa', endereco: 'Rua Fictícia, 10', telefone: '(94) 90000-1111' }),
        ])
      ).id
      assert.equal((await um<{ a: string | null }>('select ativada_em::text as a from public.igrejas where id = $1', [igreja])).a, null)
      for (const tipo of ['estatuto', 'cartao_cnpj']) {
        await enviar(pastor, igreja, { tipo, natureza: 'organizacao_religiosa', partes: [{ caminho: await arquivo(pastor, igreja) }] })
      }
      await enviar(pastor, igreja, {
        tipo: 'ata_diretoria',
        partes: [{ caminho: await arquivo(pastor, igreja) }],
        diretoria: [{ cargo: 'Presidente', pessoa_id: pessoa[pastor], inicio: await hoje(-30), fim: await hoje(1430) }],
      })
      await db.query("update public.igrejas set criado_em = now() - interval '45 days' where id = $1", [igreja])
      for (const item of ['dados', 'endereco', 'diretoria']) {
        await chamar(secretaria, 'select public.conferir_item_igreja($1, $2, true, null)', [igreja, item])
      }
      const docs = await chamar(secretaria, "select id from public.igreja_documentos where igreja_id = $1 and situacao = 'pendente'", [igreja])
      for (const d of docs.rows as { id: string }[]) await conferir(secretaria, d.id)
      await chamar(secretaria, 'select public.ativar_igreja($1)', [igreja])
      const s = await situacao(igreja)
      assert.equal(s.ativada_em, await hoje(0))
      assert.equal(s.situacao, 'regular')
      assert.deepEqual(s.pendencias, ['alvara'])
      assert.equal(s.pendencias_ate, await hoje(29))
      assert.equal(s.perfil_bloqueado, false)
      // o pastor recebe o perfil e manda o alvará que falta
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), true)
      const id = await enviar(pastor, igreja, { tipo: 'alvara', valido_de: await hoje(-10), valido_ate: await hoje(300), partes: [{ caminho: await arquivo(pastor, igreja) }] })
      assert.equal(await situacaoDoDocumento(id), 'pendente')
    })

    it('a igreja sem registro que se regulariza hoje conta da regularização (S7-03), mesmo cadastrada há 90 dias', async () => {
      const igreja = (
        await valor<{ id: string }>(secretaria, 'select public.cadastrar_igreja($1::jsonb) as id', [
          JSON.stringify({ tem_registro: false, nome: 'Igreja Simples (fictícia)', denominacao_id: denominacao, presidente_nome: 'Pr. Simples Fictício' }),
        ])
      ).id
      await db.query("update public.igrejas set criado_em = now() - interval '90 days', ativada_em = current_date - 90 where id = $1", [igreja])
      await chamar(secretaria, 'select public.regularizar_igreja($1, $2, $3)', [igreja, cnpjFicticio('667788990001'), 'organizacao_religiosa'])
      const pastor = await ministro('pregular@regras.local', 'Pastor Regularizado Fictício', igreja, true)
      const s = await situacao(igreja)
      assert.equal(s.ativada_em, await hoje(0))
      assert.equal(s.situacao, 'regular')
      assert.equal(s.pendencias_ate, await hoje(29))
      assert.equal(s.perfil_bloqueado, false)
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), true)
      assert.equal(await cuido(pastor, igreja), true)
    })

    it('o alvará vencido (fora do fim do ano) também tem 30 dias: suspensa no dia seguinte, bloqueada depois dos 30', async () => {
      const igreja = await igrejaComDocumentos('Igreja do Alvará de Junho (fictícia)', await hoje(-1))
      let s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.nunca_vieram, [])
      assert.equal(s.suspensa_desde, await hoje(0))
      assert.equal(s.prazo_ate, await hoje(29))
      // vencido antes da ativação: faltava na ativação, então tem os 30 dias dela, sem suspender (ativada há 3 dias)
      await db.query('update public.igrejas set ativada_em = current_date - 3 where id = $1', [igreja])
      await db.query("update public.igreja_documentos set valido_ate = current_date - 200 where igreja_id = $1 and tipo = 'alvara'", [igreja])
      s = await situacao(igreja)
      assert.equal(s.situacao, 'regular')
      assert.deepEqual(s.pendencias, ['alvara'])
      assert.equal(s.pendencias_ate, await hoje(26))
      assert.deepEqual(s.nunca_vieram, [])
      // passado o prazo, suspensa como o que venceu
      s = await situacao(igreja, await hoje(27))
      assert.equal(s.situacao, 'suspensa')
      assert.equal(s.suspensa_desde, await hoje(27))
      assert.deepEqual(s.nunca_vieram, [])
    })
  })

  describe('2. o alvará do ano: o que vence em 31/12 tem até 31/01', () => {
    let igreja: string
    let ano: number
    before(async () => {
      ano = (await um<{ a: number }>('select extract(year from current_date)::int + 1 as a')).a
      igreja = await igrejaComDocumentos('Igreja do Alvará do Ano (fictícia)', `${ano}-12-31`)
    })

    it('em janeiro a igreja continua regular, com o alvará faltando até 31/01; em 01/02 fica suspensa, com os 30 dias', async () => {
      let s = await situacao(igreja, `${ano + 1}-01-01`)
      assert.equal(s.situacao, 'regular')
      assert.deepEqual(s.pendencias, ['alvara'])
      assert.equal(s.pendencias_ate, `${ano + 1}-01-31`)
      s = await situacao(igreja, `${ano + 1}-01-31`)
      assert.equal(s.situacao, 'regular')
      s = await situacao(igreja, `${ano + 1}-02-01`)
      assert.equal(s.situacao, 'suspensa')
      assert.deepEqual(s.vencidos, ['alvara'])
      assert.equal(s.suspensa_desde, `${ano + 1}-02-01`)
      // os 30 dias de sempre (de 01/02 a 02/03, ou a 01/03 no ano bissexto)
      const prazo = await mais(`${ano + 1}-02-01`, 29)
      assert.equal(s.prazo_ate, prazo)
      assert.equal(s.perfil_bloqueado, false)
      assert.equal((await situacao(igreja, prazo)).perfil_bloqueado, false)
      assert.equal((await situacao(igreja, await mais(prazo, 1))).perfil_bloqueado, true)
    })

    it('o alvará novo mandado até 31/01 e ainda na conferência: a igreja não fica suspensa; recusado, fica', async () => {
      const pastor = await ministro('pano@regras.local', 'Pastor do Alvará do Ano', igreja, true)
      const id = await enviar(pastor, igreja, {
        tipo: 'alvara',
        valido_de: `${ano + 1}-01-01`,
        valido_ate: `${ano + 1}-12-31`,
        partes: [{ caminho: await arquivo(pastor, igreja) }],
      })
      let s = await situacao(igreja, `${ano + 1}-02-10`)
      assert.equal(s.situacao, 'regular')
      assert.deepEqual(s.pendencias, ['alvara'])
      assert.equal(s.pendencias_ate, null)
      await conferir(secretaria, id, false, 'Ilegível')
      s = await situacao(igreja, `${ano + 1}-02-10`)
      assert.equal(s.situacao, 'suspensa')
      assert.equal(s.suspensa_desde, `${ano + 1}-02-01`)
    })

    it('a tolerância é configurável (0: sem tolerância) e vale só para o alvará que vence em 31/12', async () => {
      await chamar(presidencia, 'update public.config_igrejas set dias_tolerancia_alvara = 0')
      try {
        assert.equal((await situacao(igreja, `${ano + 1}-01-01`)).situacao, 'suspensa')
      } finally {
        await chamar(presidencia, 'update public.config_igrejas set dias_tolerancia_alvara = 31')
      }
      const junho = await igrejaComDocumentos('Igreja do Alvará de Junho do Ano (fictícia)', `${ano}-06-30`)
      const s = await situacao(junho, `${ano}-07-01`)
      assert.equal(s.situacao, 'suspensa')
      assert.equal(s.prazo_ate, `${ano}-07-30`)
    })
  })

  describe('3. a recusa depois do prazo: mais 7 dias', () => {
    semTolerancia()
    /** Igreja com o alvará vencido há `vencido` dias e o alvará novo esperando a conferência, mandado há `mandado` dias. */
    async function recusaDoAlvara(nome: string, email: string, vencido: number, mandado: number) {
      const igreja = await igrejaComDocumentos(nome, await hoje(-vencido))
      const pastor = await ministro(email, `Pastor ${nome}`, igreja, true)
      const doc = (
        await um<{ id: string }>(
          `insert into public.igreja_documentos (igreja_id, tipo, arquivo_caminho, situacao, valido_de, valido_ate, enviado_por, criado_em)
           values ($1::uuid, 'alvara', $1::text || '/novo-' || gen_random_uuid() || '.pdf', 'pendente', current_date - 1, current_date + 300, $2,
                   now() - make_interval(days => $3::int))
           returning id`,
          [igreja, pessoa[pastor], mandado],
        )
      ).id
      return { igreja, pastor, doc }
    }

    it('mandou dentro do prazo e a secretaria recusou depois dele: 7 dias para mandar de novo, sem perder o perfil', async () => {
      // vencido há 40 dias: suspensa desde 39 dias atrás, prazo até 10 dias atrás; o alvará novo foi mandado há 15 dias
      const { igreja, pastor, doc } = await recusaDoAlvara('Igreja da Recusa Tardia', 'precusa@regras.local', 40, 15)
      assert.equal((await situacao(igreja)).perfil_bloqueado, false)
      await conferir(secretaria, doc, false, 'O alvará é de outra igreja')
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'suspensa')
      assert.equal(s.perfil_bloqueado, false)
      assert.equal(s.prazo_ate, await hoje(6))
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), true)
      assert.equal((await situacao(igreja, await hoje(6))).perfil_bloqueado, false)
      assert.equal((await situacao(igreja, await hoje(7))).perfil_bloqueado, true)
      // ele manda de novo
      const id = await enviar(pastor, igreja, { tipo: 'alvara', valido_de: await hoje(-1), valido_ate: await hoje(300), partes: [{ caminho: await arquivo(pastor, igreja) }] })
      assert.equal(await situacaoDoDocumento(id), 'pendente')
    })

    it('mandou depois do prazo e foi recusado: perde o perfil na hora (como antes)', async () => {
      const { igreja, pastor, doc } = await recusaDoAlvara('Igreja da Remessa Tardia', 'ptarde@regras.local', 40, 5)
      await conferir(secretaria, doc, false, 'Ilegível')
      assert.equal((await situacao(igreja)).perfil_bloqueado, true)
      assert.equal(await tenhoPerfil(pastor, 'presidente_igreja'), false)
    })

    it('recusado ainda dentro do prazo: vale o prazo de sempre', async () => {
      const { igreja, doc } = await recusaDoAlvara('Igreja da Recusa no Prazo', 'pnoprazo@regras.local', 10, 5)
      await conferir(secretaria, doc, false, 'Ilegível')
      const s = await situacao(igreja)
      assert.equal(s.prazo_ate, await hoje(20))
      assert.equal(s.perfil_bloqueado, false)
    })

    it('os dias depois da recusa são configuráveis', async () => {
      const { igreja, doc } = await recusaDoAlvara('Igreja da Recusa Configurada', 'pconfig@regras.local', 40, 15)
      await conferir(secretaria, doc, false, 'Ilegível')
      await chamar(presidencia, 'update public.config_igrejas set dias_apos_recusa = 10')
      try {
        assert.equal((await situacao(igreja)).prazo_ate, await hoje(9))
      } finally {
        await chamar(presidencia, 'update public.config_igrejas set dias_apos_recusa = 7')
      }
    })
  })

  describe('4 e 5. a natureza é a do Cartão CNPJ conferido; a associação privada tem 120 dias', () => {
    const natureza = async (igreja: string) =>
      (await um<{ n: string | null }>('select natureza_juridica as n from public.igrejas where id = $1', [igreja])).n

    it('a associação privada cadastrada hoje tem 120 dias da ativação; o fim do mandato da diretoria não conta mais', async () => {
      const igreja = await igrejaNova('Igreja Associação Nova (fictícia)', 'associacao_privada')
      await conferido(igreja, 'estatuto', null, null)
      await conferido(igreja, 'ata_diretoria', await hoje(-10), await hoje(3650))
      await conferido(igreja, 'alvara', await hoje(-10), await hoje(300))
      const s = await situacao(igreja)
      assert.equal(s.natureza_prazo, await hoje(120))
      // o Cartão CNPJ ainda falta: está nos 30 dias por ele, não pela natureza
      assert.deepEqual(s.pendencias, ['cartao_cnpj'])
      assert.deepEqual(s.vencidos, [])
      await conferido(igreja, 'cartao_cnpj', null, null, 'associacao_privada')
      assert.equal((await situacao(igreja)).situacao, 'regular')
      // passou dos 120 dias: suspensa pela natureza, com os 30 dias para mandar o Cartão novo
      await db.query('update public.igrejas set ativada_em = current_date - 121, natureza_desde = current_date - 121 where id = $1', [igreja])
      const depois = await situacao(igreja)
      assert.equal(depois.situacao, 'suspensa')
      assert.deepEqual(depois.vencidos, ['natureza_juridica'])
      assert.equal(depois.suspensa_desde, await hoje(0))
      assert.equal(depois.prazo_ate, await hoje(29))
      // os dias são configuráveis
      await chamar(presidencia, 'update public.config_igrejas set dias_natureza = 150')
      try {
        assert.equal((await situacao(igreja)).natureza_prazo, await hoje(29))
      } finally {
        await chamar(presidencia, 'update public.config_igrejas set dias_natureza = 120')
      }
    })

    it('o Cartão conferido como associação privada muda a igreja cadastrada como organização religiosa (S7-02 b)', async () => {
      const igreja = await igrejaComDocumentos('Igreja do Cartão Associação (fictícia)', await hoje(300))
      const cartao = await enviar(secretaria, igreja, { tipo: 'cartao_cnpj', natureza: 'associacao_privada', partes: [{ caminho: await arquivo(secretaria, igreja) }] })
      assert.equal(await situacaoDoDocumento(cartao), 'conferido')
      assert.equal(await natureza(igreja), 'associacao_privada')
      // os 120 dias contam da conferência do Cartão (a igreja foi ativada há 400 dias)
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'regular')
      assert.equal(s.natureza_prazo, await hoje(120))
      // outro Cartão ainda como associação privada não reinicia a conta
      await db.query("update public.igrejas set natureza_desde = current_date - 50 where id = $1", [igreja])
      await enviar(secretaria, igreja, { tipo: 'cartao_cnpj', natureza: 'associacao_privada', partes: [{ caminho: await arquivo(secretaria, igreja) }] })
      assert.equal((await situacao(igreja)).natureza_prazo, await hoje(70))
      // o Cartão como organização religiosa encerra o prazo
      await enviar(secretaria, igreja, { tipo: 'cartao_cnpj', natureza: 'organizacao_religiosa', partes: [{ caminho: await arquivo(secretaria, igreja) }] })
      assert.equal(await natureza(igreja), 'organizacao_religiosa')
      assert.equal((await situacao(igreja)).natureza_prazo, null)
    })

    it('o Cartão do pastor só vale depois de conferido; com o Cartão conferido, a ficha não muda a natureza', async () => {
      const igreja = await igrejaComDocumentos('Igreja do Cartão do Pastor (fictícia)', await hoje(300))
      const pastor = await ministro('pcartao@regras.local', 'Pastor do Cartão Fictício', igreja, true)
      const id = await enviar(pastor, igreja, { tipo: 'cartao_cnpj', natureza: 'associacao_privada', partes: [{ caminho: await arquivo(pastor, igreja) }] })
      assert.equal(await natureza(igreja), 'organizacao_religiosa')
      await conferir(secretaria, id)
      assert.equal(await natureza(igreja), 'associacao_privada')
      // a secretaria não muda na ficha o que o Cartão conferido diz; mandar o mesmo valor pode
      await assert.rejects(
        chamar(secretaria, "update public.igrejas set natureza_juridica = 'organizacao_religiosa' where id = $1", [igreja]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secretaria, "update public.igrejas set natureza_juridica = 'associacao_privada', telefone = '(94) 90000-2222' where id = $1", [igreja])
    })

    it('sem Cartão conferido, a natureza mudada na ficha vale, e a associação privada ganha os 120 dias desde a mudança', async () => {
      const igreja = await igrejaNova('Igreja Natureza na Ficha (fictícia)')
      await db.query('update public.igrejas set ativada_em = current_date - 60 where id = $1', [igreja])
      await chamar(secretaria, "update public.igrejas set natureza_juridica = 'associacao_privada' where id = $1", [igreja])
      assert.equal((await situacao(igreja)).natureza_prazo, await hoje(120))
      await chamar(secretaria, "update public.igrejas set natureza_juridica = 'organizacao_religiosa' where id = $1", [igreja])
      assert.equal((await situacao(igreja)).natureza_prazo, null)
    })
  })

  describe('6. a igreja sem registro: 120 dias da ativação, sem a AGO', () => {
    let igreja: string
    let readequado: string

    before(async () => {
      igreja = (
        await valor<{ id: string }>(secretaria, 'select public.cadastrar_igreja($1::jsonb) as id', [
          JSON.stringify({ tem_registro: false, nome: 'Igreja da Readequação (fictícia)', sigla: 'IRF', denominacao_id: denominacao, presidente_nome: 'Pr. Readequação Fictício' }),
        ])
      ).id
      readequado = await ministro('preadeq@regras.local', 'Ministro em Readequação Fictício', igreja, false)
      await db.query('update public.igrejas set ativada_em = current_date - 20 where id = $1', [igreja])
    })

    it('a situação traz o prazo: 120 dias da ativação, configurável', async () => {
      const s = await situacao(igreja)
      assert.equal(s.situacao, 'sem_registro')
      assert.equal(s.readequacao_ate, await hoje(100))
      await chamar(presidencia, 'update public.config_igrejas set dias_readequacao = 90')
      try {
        assert.equal((await situacao(igreja)).readequacao_ate, await hoje(70))
      } finally {
        await chamar(presidencia, 'update public.config_igrejas set dias_readequacao = 120')
      }
    })

    it('a credencial e a validação pública mostram o prazo da igreja (não a AGO)', async () => {
      const d = (await chamar(secretaria, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoa[readequado]]])).rows[0] as {
        d: { credenciais: { readequacao: boolean; prazo_readequacao: string | null; codigo: string }[] }
      }
      const [c] = d.d.credenciais
      assert.equal(c.readequacao, true)
      assert.equal(c.prazo_readequacao, await hoje(100))
      const v = (await chamar(null, 'select public.validar_credencial($1) as v', [c.codigo])).rows[0] as { v: { prazo_readequacao: string | null } }
      assert.equal(v.v.prazo_readequacao, await hoje(100))
      // a galeria dos modelos e a lista das credenciais dizem os dias (cada igreja tem o seu prazo)
      const painel = (await chamar(secretaria, 'select public.painel_modelos() as p')).rows[0] as { p: Record<string, unknown> }
      assert.equal(painel.p.dias_readequacao, 120)
      assert.equal('readequacao_ate' in painel.p, false)
    })
  })

  describe('S7-01: quem é da secretaria e preside a igreja bloqueada', () => {
    semTolerancia()
    it('o documento que ela manda espera a conferência de outra pessoa, mesmo com a igreja bloqueada', async () => {
      const igreja = await igrejaComDocumentos('Igreja da Secretária Bloqueada (fictícia)', await hoje(-60))
      const dupla = await ministro('dupla@regras.local', 'Secretária e Pastora Fictícia', igreja, true)
      await darPerfil(db, dupla, 'secretaria')
      assert.equal((await situacao(igreja)).perfil_bloqueado, true)
      const id = await enviar(dupla, igreja, { tipo: 'alvara', valido_de: await hoje(-1), valido_ate: await hoje(300), partes: [{ caminho: await arquivo(dupla, igreja) }] })
      assert.equal(await situacaoDoDocumento(id), 'pendente')
      assert.equal((await situacao(igreja)).situacao, 'suspensa')
      await assert.rejects(conferir(dupla, id), erroComCodigo(SEM_PERMISSAO))
      await conferir(secretaria, id)
      assert.equal((await situacao(igreja)).situacao, 'regular')
    })

    it('quem é da secretaria e não preside a igreja continua mandando já conferido', async () => {
      const igreja = await igrejaComDocumentos('Igreja Comum da Secretaria (fictícia)', await hoje(-60))
      const id = await enviar(secretaria, igreja, { tipo: 'alvara', valido_de: await hoje(-1), valido_ate: await hoje(300), partes: [{ caminho: await arquivo(secretaria, igreja) }] })
      assert.equal(await situacaoDoDocumento(id), 'conferido')
    })
  })

  describe('S7-08: o efeito das regras antes de salvar', () => {
    semTolerancia()
    it('a presidência vê quais igrejas mudam de situação hoje com as regras novas; nada é salvo', async () => {
      // vencido há 10 dias: suspensa, com 20 dias ainda; com 5 dias para mandar, ficaria bloqueada
      const igreja = await igrejaComDocumentos('Igreja do Efeito (fictícia)', await hoje(-10))
      const efeito = await valor<{ e: { igrejas: number; mudam: { igreja_id: string; nome: string; antes: string; depois: string }[] } }>(
        presidencia,
        'select public.efeito_das_regras($1::jsonb) as e',
        [JSON.stringify({ dias_para_mandar: 5 })],
      )
      assert.ok(efeito.e.igrejas > 0)
      const linha = efeito.e.mudam.find((m) => m.igreja_id === igreja)
      assert.deepEqual(linha, { igreja_id: igreja, nome: 'Igreja do Efeito (fictícia)', antes: 'suspensa', depois: 'bloqueada' })
      assert.equal((await um<{ d: number }>('select dias_para_mandar as d from public.config_igrejas')).d, 30)
      // com as mesmas regras, nada muda
      const igual = await valor<{ e: { mudam: unknown[] } }>(presidencia, 'select public.efeito_das_regras($1::jsonb) as e', ['{}'])
      assert.deepEqual(igual.e.mudam, [])
    })

    it('só a presidência; valores fora dos limites são recusados com a mensagem', async () => {
      await assert.rejects(chamar(secretaria, 'select public.efeito_das_regras($1::jsonb)', ['{}']), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(null, 'select public.efeito_das_regras($1::jsonb)', ['{}']), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(
        chamar(presidencia, 'select public.efeito_das_regras($1::jsonb)', [JSON.stringify({ dias_para_mandar: 0 })]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(presidencia, 'select public.efeito_das_regras($1::jsonb)', [JSON.stringify({ dias_natureza: 'muitos' })]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })
})

describe('Regularização das igrejas — as igrejas que já existiam quando as regras de 26/11/2026 chegam', () => {
  it('os 30 dias contam da ativação: a da auditoria (a igreja nova ativada) ou a do cadastro', async () => {
    const db = await criarBanco({ antesDe: MIGRACAO })
    const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
    const denominacao = (await um<{ id: string }>("insert into public.denominacoes (nome) values ('Denominação Antiga (fictícia)') returning id")).id
    const antiga = (await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Antiga (fictícia)', $1) returning id", [denominacao])).id
    await db.query("update public.igrejas set criado_em = now() - interval '50 days' where id = $1", [antiga])
    // a igreja pedida pelo pastor há 60 dias e ativada há 10 (a mudança do cadastro fica na auditoria)
    const pastor = await criarUsuario(db, 'pantiga@regras.local', 'Pastor Antigo Fictício')
    const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [pastor])
    const ativada = (
      await um<{ id: string }>(
        "insert into public.igrejas (nome, denominacao_id, cadastro, cadastrada_por) values ('Igreja Ativada Antes (fictícia)', $1, 'em_analise', $2) returning id",
        [denominacao, p.id],
      )
    ).id
    await db.query("update public.igrejas set cadastro = 'completo' where id = $1", [ativada])
    await db.query("update public.igrejas set criado_em = now() - interval '60 days' where id = $1", [ativada])
    // a auditoria não se muda (só aqui, para pôr a ativação 10 dias atrás)
    await db.exec('alter table public.auditoria disable trigger proibir_alteracao')
    await db.query(
      "update public.auditoria set ocorrido_em = now() - interval '10 days' where tabela = 'igrejas' and registro_id = $1 and operacao = 'UPDATE'",
      [ativada],
    )
    await db.exec('alter table public.auditoria enable trigger proibir_alteracao')
    const simples = (
      await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id, cadastro) values ('Igreja Simples Antiga (fictícia)', $1, 'sem_registro') returning id", [denominacao])
    ).id
    await db.query("update public.igrejas set criado_em = now() - interval '20 days' where id = $1", [simples])

    await aplicarMigracao(db, MIGRACAO)
    for (const m of MIGRACOES_SEGUINTES) await aplicarMigracao(db, m)

    const ativadaEm = async (id: string) => (await um<{ a: string | null }>('select ativada_em::text as a from public.igrejas where id = $1', [id])).a
    const dia = async (dias: number) => (await um<{ d: string }>('select (current_date + $1::int)::text as d', [dias])).d
    assert.equal(await ativadaEm(antiga), await dia(-50))
    assert.equal(await ativadaEm(ativada), await dia(-10))
    assert.equal(await ativadaEm(simples), await dia(-20))
    // a antiga, sem documento nenhum, ativada há 50 dias: os 30 dias acabaram há 20, então suspensa desde então, ainda
    // com 10 dias para mandar (a transição acabou)
    const s = (await um<{ s: Situacao }>('select interno.situacao_igreja($1) as s', [antiga])).s
    assert.equal(s.situacao, 'suspensa')
    assert.equal(s.suspensa_desde, await dia(-20))
    assert.equal(s.prazo_ate, await dia(9))
    assert.equal(s.perfil_bloqueado, false)
    // a ativada há 10 dias ainda está nos 30 dias: regular, com o prazo
    const a = (await um<{ s: Situacao }>('select interno.situacao_igreja($1) as s', [ativada])).s
    assert.equal(a.situacao, 'regular')
    assert.equal(a.pendencias_ate, await dia(19))
    assert.equal((await um<{ s: Situacao }>('select interno.situacao_igreja($1) as s', [simples])).s.readequacao_ate, await dia(100))
    await db.close()
  })
})
