// Revisão geral da Fase 2: um teste para cada achado da revisão independente (docs/revisoes/fase-2.md).
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Revisão geral da Fase 2', () => {
  let db: PGlite
  let presidente: string
  let vice: string
  let tesoureiro: string
  let secretaria: string
  let conselheiro: string
  let caixa: string
  let igreja: string
  let exercicio: number
  const categoria: Record<string, string> = {}

  const chamar = (quem: string, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function lancar(quem: string, data: string, valor = 10) {
    return chamar(quem, "select public.lancar($1, 'entrada', $2, $3::date, $4, 'Teste', null)", [
      caixa,
      categoria['Doações'],
      data,
      valor,
    ])
  }

  /** Associado novo (pessoa + igreja + associado), sem login. */
  async function novoAssociado(nome: string, forma = 'cadastro_inicial', admitido = '2020-01-01', pastorPresidente = false) {
    // Tudo numa transação: a taxa de inscrição é gerada no fim, já com o vínculo da igreja
    const r = await db.query<{ id: string }>('insert into public.pessoas (nome) values ($1) returning id', [nome])
    const pessoa = r.rows[0].id
    await db.exec(`
      begin;
      insert into public.associados (pessoa_id, forma_admissao, admitido_em, assembleia_data, assembleia_ata)
      values ('${pessoa}', '${forma}', '${admitido}', ${forma === 'assembleia' ? `'${admitido}'` : 'null'},
              ${forma === 'assembleia' ? "'Ata de teste'" : 'null'});
      insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ('${pessoa}', '${igreja}', ${pastorPresidente});
      commit;
    `)
    return pessoa
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    vice = await criarUsuario(db, 'vice@teste.local', 'Vice de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    conselheiro = await criarUsuario(db, 'conselheiro@teste.local', 'Conselheiro de Teste')
    const i = await db.query<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")
    igreja = i.rows[0].id
    // Todos são associados ativos (perfis da diretoria e do Conselho Fiscal só para associados)
    for (const u of [presidente, vice, tesoureiro, secretaria, conselheiro]) {
      const p = await pessoaDe(u)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2020-01-01')", [p])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [p, igreja])
    }
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, vice, 'presidencia')
    await darPerfil(db, tesoureiro, 'tesouraria')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, conselheiro, 'conselho_fiscal')
    await db.query("update public.valores_contribuicao set vigente_desde = '2020-01-01' where tipo in ('mensal', 'anual')")
    await db.query("update public.contas_financeiras set saldo_inicial_em = '2023-04-01'")
    const c = await db.query<{ id: string }>("select id from public.contas_financeiras where tipo = 'caixa'")
    caixa = c.rows[0].id
    const cats = await db.query<{ id: string; nome: string }>('select id, nome from public.categorias_financeiras')
    for (const x of cats.rows) categoria[x.nome] = x.id
    const e = await db.query<{ e: number }>('select interno.exercicio_de(current_date) as e')
    exercicio = e.rows[0].e
  })

  describe('contas e período fechado', () => {
    it('a tesouraria não grava direto nas contas; pelas funções, sim', async () => {
      await assert.rejects(
        chamar(tesoureiro, 'update public.contas_financeiras set saldo_inicial = 5000'),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(tesoureiro, "insert into public.contas_financeiras (nome, tipo, saldo_inicial, saldo_inicial_em) values ('Cofre', 'caixa', 1, '2024-06-01')"),
        erroComCodigo(SEM_PERMISSAO),
      )
      await chamar(tesoureiro, "select public.alterar_conta($1, 'Caixa (dinheiro)', 100, '2023-04-01')", [caixa])
    })

    it('lançamento antes do início da conta é recusado (antes, era aceito e sumia do saldo)', async () => {
      await assert.rejects(lancar(tesoureiro, '2023-03-20'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('fechado um exercício, nada até o fim dele muda — nem de exercício anterior, nem saldo inicial, nem conta nova', async () => {
      await lancar(tesoureiro, '2023-10-01') // 2023/2024 ainda aberto
      await chamar(tesoureiro, "select public.fechar_balanco(2024, 'Teste')")
      await assert.rejects(lancar(tesoureiro, '2023-10-02'), erroComCodigo(BLOQUEADO_PELO_BANCO)) // exercício anterior
      await assert.rejects(lancar(tesoureiro, '2024-10-02'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        chamar(tesoureiro, "select public.alterar_conta($1, 'Caixa (dinheiro)', 5000, '2023-04-01')", [caixa]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(tesoureiro, "select public.criar_conta('Cofre', 'caixa', 1000, '2024-06-01')"),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      // O nome ainda pode mudar; o que vem depois do período fechado continua livre
      await chamar(tesoureiro, "select public.alterar_conta($1, 'Caixa da tesouraria', 100, '2023-04-01')", [caixa])
      await lancar(tesoureiro, '2025-04-02')
    })

    it('a data do saldo inicial não pode passar dos lançamentos que a conta já tem', async () => {
      const r = await chamar(tesoureiro, "select public.criar_conta('Poupança', 'banco', 0, '2025-05-01') as id")
      const conta = (r.rows[0] as { id: string }).id
      await chamar(tesoureiro, "select public.lancar($1, 'entrada', $2, '2025-05-10', 5, 'Teste', null)", [
        conta,
        categoria['Doações'],
      ])
      await assert.rejects(
        chamar(tesoureiro, "select public.alterar_conta($1, 'Poupança', 0, '2025-06-01')", [conta]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })

  describe('cobranças e pagamentos', () => {
    let tesoureiroPessoa: string
    let membro: string

    before(async () => {
      tesoureiroPessoa = await pessoaDe(tesoureiro)
      membro = await novoAssociado('Membro de Teste')
      await chamar(tesoureiro, 'select public.gerar_cobrancas($1)', [exercicio])
    })

    it('ninguém cancela a própria cobrança', async () => {
      const c = await db.query<{ id: string }>("select id from public.cobrancas where pessoa_id = $1 and situacao = 'aberta' limit 1", [
        tesoureiroPessoa,
      ])
      await assert.rejects(
        chamar(tesoureiro, "select public.cancelar_cobranca($1, 'Isento')", [c.rows[0].id]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('pagamento registrado: valor maior que zero, diferença explicada, data fora do período fechado', async () => {
      const c = await db.query<{ id: string }>(
        "select id from public.cobrancas where pessoa_id = $1 and situacao = 'aberta' order by competencia limit 1",
        [membro],
      )
      const id = c.rows[0].id
      await assert.rejects(
        chamar(tesoureiro, "select public.registrar_pagamento($1, current_date, 0, 'Dinheiro', null)", [id]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(tesoureiro, "select public.registrar_pagamento($1, current_date, 5, 'Dinheiro', null)", [id]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(tesoureiro, "select public.registrar_pagamento($1, '2024-06-01', 20, 'Dinheiro', null)", [id]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(tesoureiro, "select public.registrar_pagamento($1, current_date, 15, 'Dinheiro', 'Desconto combinado')", [id])
    })

    it('cobrança cancelada pela tesouraria não volta ao gerar de novo', async () => {
      const c = await db.query<{ id: string }>(
        "select id from public.cobrancas where pessoa_id = $1 and situacao = 'aberta' order by competencia limit 1",
        [membro],
      )
      await chamar(tesoureiro, "select public.cancelar_cobranca($1, 'Isenção dada pela diretoria')", [c.rows[0].id])
      const r = await chamar(tesoureiro, 'select public.gerar_cobrancas($1) as n', [exercicio])
      assert.equal((r.rows[0] as { n: number }).n, 0)
    })

    it('jubilado: as cobranças em aberto do mês em diante são canceladas sozinhas', async () => {
      const jubilado = await novoAssociado('Futuro Jubilado')
      await chamar(tesoureiro, 'select public.gerar_cobrancas($1)', [exercicio])
      // a jubilação é aprovada pela assembleia (registrar_votacao grava como o sistema)
      await db.query('update public.associados set jubilado = true where pessoa_id = $1', [jubilado])
      const r = await db.query<{ abertas_futuras: number; canceladas: number }>(
        `select count(*) filter (where situacao = 'aberta' and competencia >= date_trunc('month', current_date))::int as abertas_futuras,
                count(*) filter (where cancelada_como = 'jubilado')::int as canceladas
         from public.cobrancas where pessoa_id = $1`,
        [jubilado],
      )
      assert.equal(r.rows[0].abertas_futuras, 0)
      assert.ok(r.rows[0].canceladas >= 1)
    })
  })

  describe('taxa de inscrição', () => {
    before(async () => {
      await chamar(tesoureiro, "select public.definir_taxa_inscricao(50, make_date($1, 4, 2), null, null, 30)", [exercicio])
    })

    it('com plano anual, a taxa não impede a anuidade de ser gerada', async () => {
      const pessoa = await novoAssociado('Admitido em Abril', 'assembleia', `${exercicio}-04-15`)
      await chamar(tesoureiro, "select public.escolher_plano($1, $2, 'anual')", [pessoa, exercicio])
      await chamar(tesoureiro, 'select public.gerar_cobrancas($1)', [exercicio])
      const r = await db.query<{ tipo: string }>(
        "select tipo::text from public.cobrancas where pessoa_id = $1 and situacao <> 'cancelada' order by tipo",
        [pessoa],
      )
      assert.deepEqual(
        r.rows.map((x) => x.tipo),
        ['anual', 'inscricao'],
      )
    })

    it('a taxa sai com a categoria certa (pastor presidente), mesmo com o vínculo gravado depois', async () => {
      const pessoa = await novoAssociado('Pastor Admitido', 'assembleia', `${exercicio}-04-20`, true)
      const r = await db.query<{ categoria: string }>(
        "select categoria::text from public.cobrancas where pessoa_id = $1 and tipo = 'inscricao'",
        [pessoa],
      )
      assert.deepEqual(r.rows, [{ categoria: 'presidente_igreja' }])
    })
  })

  describe('Conselho Fiscal e perfis', () => {
    it('a secretaria não gera código de acesso para o Conselho Fiscal (só a presidência)', async () => {
      const p = await pessoaDe(conselheiro)
      await assert.rejects(
        chamar(secretaria, "select public.gerar_codigo_acesso($1, 'nova_senha')", [p]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('ninguém dá perfil a si mesmo', async () => {
      const p = await pessoaDe(presidente)
      await assert.rejects(
        chamar(presidente, "insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'tesouraria')", [p]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })

    it('a mesma pessoa não é da diretoria e do Conselho Fiscal', async () => {
      const presid = await pessoaDe(presidente)
      await assert.rejects(
        chamar(vice, "insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'conselho_fiscal')", [presid]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const cons = await pessoaDe(conselheiro)
      await assert.rejects(
        chamar(vice, "insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'tesouraria')", [cons]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })
})
