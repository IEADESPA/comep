// Fase 5.5, parte 7: os modelos da credencial por grupo — quem recebe (todas ou qualquer uma), a ordem, o exclusivo de
// uma igreja (só depois de pago) e o ministro em readequação (sempre o modelo dele). A validação pública continua.
// Rodar: npm test
import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

const DESENHO = { versao: 1, frente: { fundo: '#ffffff', elementos: [] }, verso: { fundo: '#ffffff', elementos: [] } }
const desenho = (fundo: string) => ({ ...DESENHO, frente: { ...DESENHO.frente, fundo } })

type Painel = {
  modelos: { id: string; nome: string; tipo: string; prioridade: number; em_uso: boolean; pessoas: number; regra: unknown; desenho: unknown }[]
}

describe('Fase 5.5 (parte 7) — os modelos da credencial', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let tesouraria: string
  let ministroUsuario: string
  // pessoas (associados ativos)
  let presidente: string // cargo na diretoria, pastor presidente da Igreja Pentecostal
  let pastor: string // pastor presidente da Igreja Batista
  let veterano: string // 12 anos de COMEP, igreja Batista
  let novato: string // ministro comum (o do login "ministro"), igreja Pentecostal
  let readequado: string // igreja sem registro, também pastor presidente lá… e na diretoria
  let igrejaPentecostal: string
  let igrejaBatista: string
  let igrejaSemRegistro: string
  let padrao: string
  let readequacao: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]

  async function pessoa(nome: string, admitido: string, igreja: string, pastorPresidente = false, usuario?: string) {
    const p = usuario
      ? await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])
      : await um<{ id: string }>('insert into public.pessoas (nome) values ($1) returning id', [nome])
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', $2)", [p.id, admitido])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente, funcao) values ($1, $2, $3, $4)', [
      p.id,
      igreja,
      pastorPresidente,
      pastorPresidente ? null : 'Pastor auxiliar',
    ])
    return p.id
  }

  const modeloDe = async (pessoaId: string) => (await um<{ id: string }>('select interno.modelo_da_pessoa($1) as id', [pessoaId])).id

  const salvarModelo = (quem: string, id: string | null, dados: unknown) =>
    chamar(quem, 'select public.salvar_modelo($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then((r) => (r.rows[0] as { id: string }).id)

  const salvarDesenho = (quem: string, modelo: string, fundo: string, usar = true) =>
    chamar(quem, 'select public.salvar_versao_modelo($1, $2::jsonb, $3, $4) as id', [modelo, JSON.stringify(desenho(fundo)), `Fundo ${fundo}`, usar]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )

  const painel = async (quem: string) => (await chamar(quem, 'select public.painel_modelos() as p')).rows[0] as { p: Painel }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    ministroUsuario = await criarUsuario(db, 'ministro@teste.local', 'Ministro Novato')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, tesouraria, 'tesouraria')

    const pent = await um<{ id: string }>("insert into public.denominacoes (nome, tradicao) values ('Pentecostal Fictícia', 'pentecostal') returning id")
    const bat = await um<{ id: string }>("insert into public.denominacoes (nome, tradicao) values ('Batista Fictícia', 'batista') returning id")
    igrejaPentecostal = (await um<{ id: string }>("insert into public.igrejas (nome, sigla, denominacao_id) values ('Igreja Pentecostal Fictícia', 'IPF', $1) returning id", [pent.id])).id
    igrejaBatista = (await um<{ id: string }>("insert into public.igrejas (nome, sigla, denominacao_id) values ('Igreja Batista Fictícia', 'IBF', $1) returning id", [bat.id])).id
    igrejaSemRegistro = (
      await um<{ id: string }>("insert into public.igrejas (nome, sigla, cadastro, denominacao_id) values ('Igreja Sem Registro Fictícia', 'ISR', 'sem_registro', $1) returning id", [pent.id])
    ).id

    presidente = await pessoa('Presidente Fictício', '2024-01-10', igrejaPentecostal, true)
    pastor = await pessoa('Pastor Batista Fictício', '2025-02-01', igrejaBatista, true)
    veterano = await pessoa('Veterano Fictício', '2014-03-01', igrejaBatista)
    novato = await pessoa('Ministro Novato', '2026-01-05', igrejaPentecostal, false, ministroUsuario)
    readequado = await pessoa('Readequado Fictício', '2010-01-01', igrejaSemRegistro)
    await db.query("insert into public.mandatos (pessoa_id, cargo, inicio, fim) values ($1, 'presidente', current_date - 100, current_date + 900)", [presidente])
    await db.query("insert into public.mandatos (pessoa_id, cargo, inicio, fim) values ($1, 'vice_presidente', current_date - 100, current_date + 900)", [readequado])

    padrao = (await um<{ id: string }>("select id from public.credencial_modelos where tipo = 'padrao'")).id
    readequacao = (await um<{ id: string }>("select id from public.credencial_modelos where tipo = 'readequacao'")).id
  })

  it('a migração cria o padrão (com o desenho em uso de antes) e o da readequação; todos começam no padrão', async () => {
    const n = await um<{ n: number }>('select count(*)::int as n from public.credencial_modelos')
    assert.equal(n.n, 2)
    for (const p of [presidente, pastor, veterano, novato]) assert.equal(await modeloDe(p), padrao)
    assert.equal(await modeloDe(readequado), readequacao)
  })

  it('RLS: só a secretaria, a presidência e a tesouraria leem os modelos; o ministro e o visitante, não', async () => {
    assert.equal((await chamar(secretaria, 'select id from public.credencial_modelos')).rows.length, 2)
    assert.equal((await chamar(tesouraria, 'select id from public.credencial_modelos')).rows.length, 2)
    assert.equal((await chamar(ministroUsuario, 'select id from public.credencial_modelos')).rows.length, 0)
    await assert.rejects(chamar(null, 'select id from public.credencial_modelos'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(chamar(ministroUsuario, 'select public.painel_modelos()'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(chamar(ministroUsuario, 'select public.lista_credenciais()'), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(salvarModelo(ministroUsuario, null, { nome: 'Tentativa' }), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(salvarModelo(tesouraria, null, { nome: 'Tentativa' }), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(chamar(secretaria, "insert into public.credencial_modelos (nome, tipo) values ('Direto', 'grupo')"), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(db.query('delete from public.credencial_modelos'), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('a regra é conferida: condição desconhecida, sem valor, repetida, período ao contrário e anos fora do limite', async () => {
    const regra = (condicoes: unknown[], modo = 'todas') => ({ nome: 'Regra ruim', regra: { modo, condicoes } })
    for (const ruim of [
      regra([{ tipo: 'idade', valores: ['50'] }]),
      regra([{ tipo: 'cargo', valores: [] }]),
      regra([{ tipo: 'cargo', valores: ['rei'] }]),
      regra([{ tipo: 'tradicao', valores: ['pentecostal'] }, { tipo: 'tradicao', valores: ['batista'] }]),
      regra([{ tipo: 'periodo', de: '2026-12-31', ate: '2026-01-01' }]),
      regra([{ tipo: 'tempo', anos: 0 }]),
      regra([{ tipo: 'igreja', valores: ['00000000-0000-0000-0000-000000000000'] }]),
      regra([], 'algumas'),
    ]) {
      await assert.rejects(salvarModelo(secretaria, null, ruim), erroComCodigo(BLOQUEADO_PELO_BANCO), JSON.stringify(ruim))
    }
    // "só durante o mandato" sem o fim do mandato informado
    await assert.rejects(salvarModelo(secretaria, null, regra([{ tipo: 'mandato' }])), erroComCodigo(BLOQUEADO_PELO_BANCO))
  })

  it('a ordem decide: quem se encaixa em dois modelos recebe o primeiro; rascunho não conta', async () => {
    const diretoria = await salvarModelo(secretaria, null, {
      nome: 'Diretoria',
      regra: { modo: 'todas', condicoes: [{ tipo: 'cargo', valores: ['presidente', 'vice_presidente', 'conselheiro_fiscal'] }] },
    })
    const pastores = await salvarModelo(presidencia, null, { nome: 'Pastor presidente', regra: { modo: 'todas', condicoes: [{ tipo: 'pastor_presidente' }] } })
    // rascunho (sem desenho e sem "usar"): ninguém recebe
    assert.equal(await modeloDe(presidente), padrao)
    await assert.rejects(chamar(secretaria, 'select public.por_modelo_em_uso($1, true)', [diretoria]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await salvarDesenho(secretaria, diretoria, '#18181b')
    await salvarDesenho(secretaria, pastores, '#1e3a8a')
    assert.equal(await modeloDe(presidente), diretoria, 'o presidente é pastor presidente também, mas Diretoria vem antes')
    assert.equal(await modeloDe(pastor), pastores)
    assert.equal(await modeloDe(novato), padrao)
    // o readequado está na diretoria, mas recebe SEMPRE o da readequação
    assert.equal(await modeloDe(readequado), readequacao)

    // muda a ordem: Pastor presidente primeiro
    await assert.rejects(chamar(secretaria, 'select public.ordenar_modelos($1)', [[pastores]]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await chamar(secretaria, 'select public.ordenar_modelos($1)', [[pastores, diretoria]])
    assert.equal(await modeloDe(presidente), pastores)
    await chamar(secretaria, 'select public.ordenar_modelos($1)', [[diretoria, pastores]])
    assert.equal(await modeloDe(presidente), diretoria)

    // volta a rascunho: sai da escolha
    await chamar(secretaria, 'select public.por_modelo_em_uso($1, false)', [pastores])
    assert.equal(await modeloDe(pastor), padrao)
    await chamar(secretaria, 'select public.por_modelo_em_uso($1, true)', [pastores])
    assert.equal(await modeloDe(pastor), pastores)

    // a galeria conta as pessoas de cada um
    const { p } = await painel(secretaria)
    const conta = Object.fromEntries(p.modelos.map((m) => [m.nome, m.pessoas]))
    assert.deepEqual(conta, { Diretoria: 1, 'Pastor presidente': 1, 'Ministro (padrão)': 2, 'Ministro em readequação': 1 })
    assert.deepEqual(
      p.modelos.map((m) => m.tipo),
      ['grupo', 'grupo', 'padrao', 'readequacao'],
    )
  })

  it('todas ou qualquer uma: tradição batista E 10 anos de COMEP, ou uma das duas', async () => {
    const regraTodas = { modo: 'todas', condicoes: [{ tipo: 'tradicao', valores: ['batista'] }, { tipo: 'tempo', anos: 10 }] }
    const id = await salvarModelo(secretaria, null, { nome: '10 anos batistas', regra: regraTodas })
    await salvarDesenho(secretaria, id, '#7f1d1d')
    assert.equal(await modeloDe(veterano), id, 'batista com 12 anos')
    assert.notEqual(await modeloDe(pastor), id, 'batista, mas só 1 ano: fica no Pastor presidente')
    assert.equal(await modeloDe(novato), padrao)

    // qualquer uma: o pastor batista (1 ano) também entra, mas o modelo Pastor presidente vem antes na ordem
    await salvarModelo(secretaria, id, { nome: '10 anos batistas', regra: { ...regraTodas, modo: 'qualquer' } })
    const ordem = (await painel(secretaria)).p.modelos.filter((m) => m.tipo === 'grupo').map((m) => m.id)
    await chamar(secretaria, 'select public.ordenar_modelos($1)', [[id, ...ordem.filter((x) => x !== id)]])
    assert.equal(await modeloDe(pastor), id)
    assert.equal(await modeloDe(veterano), id)

    // a simulação (antes de salvar) mostra quem receberia e quantos ficam com um modelo de cima
    const sim = (await chamar(secretaria, 'select public.simular_quem_recebe($1, $2::jsonb) as s', [id, JSON.stringify(regraTodas)])).rows[0] as {
      s: { pessoas: { nome: string }[]; acima: number }
    }
    assert.deepEqual(
      sim.s.pessoas.map((x) => x.nome),
      ['Veterano Fictício'],
    )
    assert.equal(sim.s.acima, 0)
    await chamar(secretaria, 'select public.arquivar_modelo($1)', [id])
    assert.notEqual(await modeloDe(veterano), id)
  })

  it('as outras condições: título, jubilado, comissão, admissão, igreja, denominação, período e mandato', async () => {
    const titulo = await um<{ id: string }>("insert into public.titulos_ministeriais (nome) values ('Evangelista Fictício') returning id")
    await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [novato, titulo.id])
    const comissao = await um<{ id: string }>("insert into public.comissoes (nome, tipo) values ('Comissão Fictícia', 'permanente') returning id")
    await db.query('insert into public.comissao_membros (comissao_id, pessoa_id) values ($1, $2)', [comissao.id, novato])
    const den = await um<{ id: string }>('select denominacao_id as id from public.igrejas where id = $1', [igrejaPentecostal])
    await db.query("update public.config_credencial set fim_mandato = current_date + 30 where id")

    const casos: [string, unknown, boolean][] = [
      ['titulo', { tipo: 'titulo', valores: [titulo.id] }, true],
      ['jubilado', { tipo: 'jubilado' }, false],
      ['comissao (qualquer)', { tipo: 'comissao', valores: [] }, true],
      ['comissao (esta)', { tipo: 'comissao', valores: [comissao.id] }, true],
      ['admissao', { tipo: 'admissao', valores: ['assembleia'] }, false],
      ['igreja', { tipo: 'igreja', valores: [igrejaPentecostal] }, true],
      ['denominacao', { tipo: 'denominacao', valores: [den.id] }, true],
      ['periodo de hoje', { tipo: 'periodo', de: '2020-01-01', ate: '2099-12-31' }, true],
      ['periodo que passou', { tipo: 'periodo', de: '2020-01-01', ate: '2020-12-31' }, false],
      ['mandato em curso', { tipo: 'mandato' }, true],
    ]
    const id = await salvarModelo(secretaria, null, { nome: 'Condições', regra: { modo: 'todas', condicoes: [{ tipo: 'jubilado' }] } })
    await salvarDesenho(secretaria, id, '#166534')
    const ordem = (await painel(secretaria)).p.modelos.filter((m) => m.tipo === 'grupo').map((m) => m.id)
    await chamar(secretaria, 'select public.ordenar_modelos($1)', [[id, ...ordem.filter((x) => x !== id)]])
    for (const [nome, condicao, esperado] of casos) {
      await salvarModelo(secretaria, id, { nome: 'Condições', regra: { modo: 'todas', condicoes: [condicao] } })
      assert.equal((await modeloDe(novato)) === id, esperado, nome)
    }
    // "só durante o mandato" guarda a data: depois da posse, o modelo deixa de valer
    const r = await um<{ regra: { condicoes: { ate: string }[] } }>('select regra from public.credencial_modelos where id = $1', [id])
    assert.match(r.regra.condicoes[0].ate, /^\d{4}-\d{2}-\d{2}$/)
    await db.query("update public.credencial_modelos set regra = jsonb_set(regra, '{condicoes,0,ate}', to_jsonb((current_date - 1)::text)) where id = $1", [id])
    assert.notEqual(await modeloDe(novato), id)
    await chamar(secretaria, 'select public.arquivar_modelo($1)', [id])
  })

  it('o exclusivo da igreja: só os ministros dela, só depois de pago; o pagamento é da tesouraria ou da presidência', async () => {
    const dados = { nome: 'Exclusivo · Igreja Batista', tipo: 'exclusivo', igreja_id: igrejaBatista, valor: 300, pedido_por: pastor }
    await assert.rejects(salvarModelo(secretaria, null, { ...dados, valor: 0 }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(salvarModelo(secretaria, null, { ...dados, igreja_id: igrejaSemRegistro }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    const id = await salvarModelo(secretaria, null, dados)
    await assert.rejects(salvarModelo(secretaria, null, { ...dados, nome: 'Outro exclusivo' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await salvarDesenho(secretaria, id, '#14532d')
    // primeiro da ordem
    const ordem = (await painel(secretaria)).p.modelos.filter((m) => ['grupo', 'exclusivo'].includes(m.tipo)).map((m) => m.id)
    await chamar(secretaria, 'select public.ordenar_modelos($1)', [[id, ...ordem.filter((x) => x !== id)]])
    assert.notEqual(await modeloDe(veterano), id, 'sem pagamento, não vale')

    // o pagamento: a secretaria não registra; a entrada do caixa precisa ser entrada
    await assert.rejects(chamar(secretaria, 'select public.registrar_pagamento_exclusivo($1, current_date, null)', [id]), erroComCodigo(SEM_PERMISSAO))
    const conta = await um<{ id: string }>('select conta_banco_id as id from public.config_financeiro')
    const saida = await um<{ id: string }>("select id from public.categorias_financeiras where tipo = 'saida' and sistema is null limit 1")
    const entrada = await um<{ id: string }>("select id from public.categorias_financeiras where tipo = 'entrada' and sistema is null limit 1")
    // desde a parte 12 (a blindagem do caixa), o livro-caixa só recebe lançamentos pela função do sistema
    const lancSaida = await um<{ id: string }>(
      "select interno.registrar_lancamento($1, 'saida', $2, current_date, 300, 'Saída fictícia', 'efetivado') as id",
      [conta.id, saida.id],
    )
    const lancEntrada = await um<{ id: string }>(
      "select interno.registrar_lancamento($1, 'entrada', $2, current_date, 300, 'Modelo exclusivo (fictício)', 'efetivado') as id",
      [conta.id, entrada.id],
    )
    await assert.rejects(
      chamar(tesouraria, 'select public.registrar_pagamento_exclusivo($1, current_date, $2)', [id, lancSaida.id]),
      erroComCodigo(BLOQUEADO_PELO_BANCO),
    )
    await assert.rejects(chamar(tesouraria, 'select public.registrar_pagamento_exclusivo($1, current_date + 1, null)', [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await chamar(tesouraria, 'select public.registrar_pagamento_exclusivo($1, current_date, $2)', [id, lancEntrada.id])
    assert.equal(await modeloDe(veterano), id)
    assert.equal(await modeloDe(pastor), id)
    assert.notEqual(await modeloDe(novato), id, 'outra igreja')
    // depois de pago, a igreja e o valor não mudam
    await assert.rejects(salvarModelo(secretaria, id, { ...dados, valor: 250 }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await salvarModelo(secretaria, id, { ...dados, nome: 'Exclusivo · Batista Fictícia' })
    // desfazer o pagamento (a presidência): a entrada do caixa é cancelada (estorno) e o modelo volta para os outros
    // (desde a parte 12: não existe mais "pago sem a entrada no caixa")
    await assert.rejects(chamar(presidencia, 'select public.registrar_pagamento_exclusivo($1, null, null)', [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await chamar(presidencia, "select public.desfazer_pagamento_exclusivo($1, 'Registrado por engano')", [id])
    assert.notEqual(await modeloDe(veterano), id)
    assert.equal((await um<{ s: string }>('select situacao as s from public.lancamentos where id = $1', [lancEntrada.id])).s, 'cancelado')
    await assert.rejects(chamar(presidencia, 'select public.registrar_pagamento_exclusivo($1, current_date, null)', [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await chamar(presidencia, "select public.receber_pagamento_exclusivo($1, current_date, 'PIX')", [id])
    assert.equal(await modeloDe(veterano), id)
  })

  it('o ministro em readequação: sempre o modelo dele; regularizada a igreja, sai da readequação', async () => {
    assert.equal(await modeloDe(readequado), readequacao)
    const r = (await chamar(secretaria, 'select public.dados_credenciais($1::uuid[]) as d', [[readequado, novato]])).rows[0] as {
      d: { credenciais: { pessoa_id: string; modelo_id: string; readequacao: boolean; prazo_readequacao: string | null; pendencias: string[] }[]; modelos: Record<string, { tipo: string }> }
    }
    const [doReadequado, doNovato] = r.d.credenciais
    assert.equal(doReadequado.modelo_id, readequacao)
    assert.equal(doReadequado.readequacao, true)
    assert.equal(doReadequado.prazo_readequacao, '2027-04-28')
    assert.ok(!doReadequado.pendencias.includes('Igreja sem CNPJ'), 'a igreja sem registro não tem CNPJ: não é pendência')
    assert.equal(doNovato.readequacao, false)
    assert.equal(doNovato.prazo_readequacao, null)
    assert.equal(r.d.modelos[readequacao].tipo, 'readequacao')
    assert.equal(r.d.modelos[doNovato.modelo_id].tipo, 'padrao')

    // não se arquiva nem sai de uso
    await assert.rejects(chamar(secretaria, 'select public.arquivar_modelo($1)', [readequacao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(secretaria, 'select public.por_modelo_em_uso($1, false)', [readequacao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(secretaria, 'select public.arquivar_modelo($1)', [padrao]), erroComCodigo(BLOQUEADO_PELO_BANCO))

    // a lista do módulo traz a categoria
    const lista = (await chamar(secretaria, 'select public.lista_credenciais() as l')).rows[0] as {
      l: { credenciais: { nome: string; readequacao: boolean; modelo: string }[] }
    }
    const linha = lista.l.credenciais.find((c) => c.nome === 'Readequado Fictício')
    assert.equal(linha?.readequacao, true)
    assert.equal(linha?.modelo, 'Ministro em readequação')

    await db.query("update public.igrejas set cadastro = 'completo' where id = $1", [igrejaSemRegistro])
    assert.notEqual(await modeloDe(readequado), readequacao)
    await db.query("update public.igrejas set cadastro = 'sem_registro' where id = $1", [igrejaSemRegistro])
  })

  it('a validação pública continua funcionando (sem login) e mostra a readequação com o prazo', async () => {
    const codigo = async (pessoaId: string) => {
      const d = (await chamar(secretaria, 'select public.dados_credenciais($1::uuid[]) as d', [[pessoaId]])).rows[0] as { d: { credenciais: { codigo: string }[] } }
      return d.d.credenciais[0].codigo
    }
    const valida = (await chamar(null, 'select public.validar_credencial($1) as v', [await codigo(novato)])).rows[0] as {
      v: { situacao: string; nome: string; readequacao: boolean; prazo_readequacao: string | null; cpf?: string }
    }
    assert.equal(valida.v.situacao, 'valida')
    assert.equal(valida.v.nome, 'Ministro Novato')
    assert.equal(valida.v.readequacao, false)
    assert.equal(valida.v.prazo_readequacao, null)
    assert.equal(valida.v.cpf, undefined)

    const emReadequacao = (await chamar(null, 'select public.validar_credencial($1) as v', [await codigo(readequado)])).rows[0] as {
      v: { situacao: string; readequacao: boolean; prazo_readequacao: string }
    }
    assert.equal(emReadequacao.v.situacao, 'valida')
    assert.equal(emReadequacao.v.readequacao, true)
    assert.equal(emReadequacao.v.prazo_readequacao, '2027-04-28')
    const inexistente = (await chamar(null, "select public.validar_credencial('0123456789abcdef0123456789abcdef') as v")).rows[0] as { v: { situacao: string } }
    assert.equal(inexistente.v.situacao, 'inexistente')
  })

  it('versões: cada uma é de um modelo; não se usa a de outro; a em uso não se arquiva; duplicar copia o desenho', async () => {
    const id = await salvarModelo(secretaria, null, { nome: 'Para duplicar', regra: { modo: 'todas', condicoes: [{ tipo: 'jubilado' }] } })
    const versao = await salvarDesenho(secretaria, id, '#4c0519')
    await assert.rejects(chamar(secretaria, 'select public.usar_versao_modelo($1, $2)', [padrao, versao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(secretaria, 'select public.arquivar_modelo_credencial($1)', [versao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(secretaria, 'select public.usar_versao_modelo($1, null)', [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(db.query('update public.modelos_credencial set modelo_id = $1 where id = $2', [padrao, versao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(db.query("update public.credencial_modelos set tipo = 'padrao' where id = $1", [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))

    const copia = (await chamar(presidencia, "select public.duplicar_modelo($1, 'Cópia fictícia') as id", [id])).rows[0] as { id: string }
    const m = await um<{ em_uso: boolean; desenho: { frente: { fundo: string } }; regra: unknown }>(
      'select m.em_uso, v.modelo as desenho, m.regra from public.credencial_modelos m join public.modelos_credencial v on v.id = m.versao_id where m.id = $1',
      [copia.id],
    )
    assert.equal(m.em_uso, false, 'a cópia nasce rascunho')
    assert.equal(m.desenho.frente.fundo, '#4c0519')
    assert.deepEqual(m.regra, { modo: 'todas', condicoes: [{ tipo: 'jubilado' }] })
    await assert.rejects(chamar(presidencia, "select public.duplicar_modelo($1, 'Cópia fictícia')", [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))

    // as versões do modelo, com quem salvou
    const versoes = await chamar(secretaria, 'select descricao, em_uso, criado_por_nome from public.vw_versoes_modelo where modelo_id = $1', [id])
    assert.deepEqual(versoes.rows, [{ descricao: 'Fundo #4c0519', em_uso: true, criado_por_nome: 'Secretaria de Teste' }])
    assert.equal((await chamar(ministroUsuario, 'select id from public.vw_versoes_modelo')).rows.length, 0)
  })

  it('as funções antigas mexem no padrão (as telas antigas continuam funcionando)', async () => {
    const v = (await chamar(secretaria, "select public.salvar_modelo_credencial($1::jsonb, 'Pelo editor antigo', true) as id", [JSON.stringify(desenho('#fafafa'))])).rows[0] as {
      id: string
    }
    const m = await um<{ versao_id: string }>("select versao_id from public.credencial_modelos where tipo = 'padrao'")
    assert.equal(m.versao_id, v.id)
    const cfg = await um<{ modelo_id: string }>('select modelo_id from public.config_credencial')
    assert.equal(cfg.modelo_id, v.id)
    const d = (await chamar(ministroUsuario, 'select public.dados_credenciais($1::uuid[]) as d', [[novato]])).rows[0] as { d: { modelo: { frente: { fundo: string } } } }
    assert.equal(d.d.modelo.frente.fundo, '#fafafa')
    await chamar(secretaria, 'select public.usar_modelo_credencial(null)')
    assert.equal((await um<{ versao_id: string | null }>("select versao_id from public.credencial_modelos where tipo = 'padrao'")).versao_id, null)
  })
})
