// Revisão do portão do ramo fase-5.5/seguranca-modulo1 (25/11/2026): um teste para cada ressalva corrigida.
// Cada bloco falha sem a migração da sua correção. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const BLOQUEADO_PELO_BANCO = 'P0001'

/** Recusado pelo banco (P0001) com a mensagem que casa com o padrão. */
const recusadoCom = (padrao: RegExp) => (erro: unknown) =>
  (erro as { code?: string }).code === BLOQUEADO_PELO_BANCO && padrao.test((erro as { message?: string }).message ?? '')

describe('Revisão do portão — segurança do banco, módulo 1', () => {
  let db: PGlite

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const pessoaDe = async (usuario: string) => (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])).id

  before(async () => {
    db = await criarBanco()
  })

  describe('Portão 1 — os caminhos de arquivo têm tamanho, e a troca da própria foto tem teto por dia', () => {
    let tituloPastor: string
    let secretaria: string

    before(async () => {
      tituloPastor = (await um<{ id: string }>("select id from public.titulos_ministeriais where nome = 'Pastor(a)'")).id
      secretaria = await criarUsuario(db, 'secretaria.caminhos@teste.local', 'Secretaria Fictícia dos Caminhos')
      await darPerfil(db, secretaria, 'secretaria')
    })

    /** Um caminho da pasta da pessoa com o tamanho pedido (o nome do arquivo completa). */
    const caminhoCom = (pessoa: string, tamanho: number) => {
      const pasta = `pessoas/${pessoa}/`
      return `${pasta}${'a'.repeat(tamanho - pasta.length - 4)}.jpg`
    }

    it('o pedido de associação: a foto e o comprovante com caminho gigante são recusados', async () => {
      const candidato = await criarUsuario(db, 'candidato.caminho@teste.local', 'Candidato Fictício do Caminho')
      const pessoa = await pessoaDe(candidato)
      const pedir = (foto: string, comprovante: string) =>
        chamar(
          candidato,
          `insert into public.pedidos_associacao (pessoa_id, titulo_id, igreja_informada, foto_caminho, comprovante_caminho,
             declara_principios_fe, declara_estatuto, consente_lgpd)
           values ($1, $2, 'Igreja Fictícia', $3, $4, true, true, true) returning id`,
          [pessoa, tituloPastor, foto, comprovante],
        )
      const normal = `pessoas/${pessoa}/foto-1764000000000.jpg`
      await assert.rejects(pedir(caminhoCom(pessoa, 201), normal), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(pedir(normal, caminhoCom(pessoa, 500_000)), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // até 200 vale (os caminhos das telas têm uns 80)
      await pedir(caminhoCom(pessoa, 200), normal)
    })

    it('a foto da pessoa: caminho gigante recusado; a própria pessoa troca até 10 vezes por dia', async () => {
      const ministro = await criarUsuario(db, 'ministro.foto@teste.local', 'Ministro Fictício da Foto')
      const pessoa = await pessoaDe(ministro)
      const trocar = (quem: string, vez: number) =>
        chamar(quem, 'update public.pessoas set foto_caminho = $1 where id = $2', [`pessoas/${pessoa}/foto-${vez}.jpg`, pessoa])

      await assert.rejects(
        chamar(ministro, 'update public.pessoas set foto_caminho = $1 where id = $2', [caminhoCom(pessoa, 201), pessoa]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      // as trocas de ontem não contam
      await db.query(
        `insert into public.auditoria (tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id, ocorrido_em)
         select 'pessoas', $1, 'UPDATE', jsonb_build_object('foto_caminho', 'a' || g), jsonb_build_object('foto_caminho', 'b' || g), $2,
                now() - interval '1 day'
         from generate_series(1, 20) g`,
        [pessoa, ministro],
      )
      for (let vez = 1; vez <= 10; vez++) await trocar(ministro, vez)
      await assert.rejects(trocar(ministro, 11), recusadoCom(/hoje/))
      // mudar o telefone não conta como troca de foto
      await chamar(ministro, "update public.pessoas set telefone = '(94) 99999-0000' where id = $1", [pessoa])
      // a secretaria, que corrige a ficha, não tem esse teto
      await trocar(secretaria, 12)
      const agora = await um<{ foto_caminho: string }>('select foto_caminho from public.pessoas where id = $1', [pessoa])
      assert.equal(agora.foto_caminho, `pessoas/${pessoa}/foto-12.jpg`)
    })

    it('o informe de pagamento: o comprovante com caminho gigante é recusado', async () => {
      const associado = await criarUsuario(db, 'associado.caminho@teste.local', 'Associado Fictício do Caminho')
      const pessoa = await pessoaDe(associado)
      await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [pessoa])
      const cobranca = (
        await um<{ id: string }>(
          `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
           values ($1, 2030, 'mensal', '2030-04-01', '2030-04-10', 'nao_presidente', 1) returning id`,
          [pessoa],
        )
      ).id
      await assert.rejects(
        chamar(associado, "select public.informar_pagamento($1, current_date, 'PIX', $2, null)", [[cobranca], caminhoCom(pessoa, 201)]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(associado, "select public.informar_pagamento($1, current_date, 'PIX', $2, null)", [[cobranca], caminhoCom(pessoa, 200)])
    })
  })

  describe('Portão 2 — o nome e o telefone: o invisível colado sai, e o limite tem mensagem clara', () => {
    let secretaria: string
    let igreja: string

    // caracteres que não aparecem (escritos por código, para quem lê ver o que é cada um)
    const TAB = '\t'
    const ESPACO_DURO = '\u00a0'
    const HIFEN_INVISIVEL = '\u00ad'
    const ESPACO_ZERO = '\u200b'
    const MARCA_ESQ_DIR = '\u200e'
    const DIRECAO = ['\u202a', '\u202c'] as const
    const PREENCHE_HANGUL = '\u3164'
    const PREENCHE_JAMO = '\u115f'
    const SEPARADOR_MONGOL = '\u180e'
    const ETIQUETA = '\u{e0001}'
    const ACENTO_AGUDO = '\u0301'
    const CIRCUNFLEXO = '\u0302'
    const PONTO_EMBAIXO = '\u0323'

    async function associado(email: string, nome: string) {
      const usuario = await criarUsuario(db, email, nome)
      const pessoa = await pessoaDe(usuario)
      await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [pessoa])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, funcao) values ($1, $2, $3)', [pessoa, igreja, 'Pastor auxiliar'])
      return { usuario, pessoa }
    }
    const gravar = (quem: string, pessoa: string, coluna: 'nome' | 'telefone', valor: string) =>
      chamar(quem, `update public.pessoas set ${coluna} = $1 where id = $2`, [valor, pessoa])
    const lido = async (pessoa: string) => um<{ nome: string; telefone: string | null }>('select nome, telefone from public.pessoas where id = $1', [pessoa])

    before(async () => {
      secretaria = await criarUsuario(db, 'secretaria.nomes@teste.local', 'Secretaria Fictícia dos Nomes')
      await darPerfil(db, secretaria, 'secretaria')
      igreja = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja Fictícia dos Nomes') returning id")).id
    })

    it('a lista do que não aparece está completa, e os nomes reais (até com acento decomposto) continuam valendo', async () => {
      const proibido = async (texto: string) =>
        (await um<{ sim: boolean }>('select interno.tem_caractere_invisivel($1) as sim', [texto])).sim
      for (const ruim of [ESPACO_DURO, HIFEN_INVISIVEL, PREENCHE_HANGUL, PREENCHE_JAMO, SEPARADOR_MONGOL, ETIQUETA, '\u2800', '\ufe0f']) {
        assert.equal(await proibido(`Nome${ruim}Fictício`), true, `U+${ruim.codePointAt(0)!.toString(16)}`)
      }
      assert.equal(await proibido(`Ana${ACENTO_AGUDO.repeat(140)}`), true, '140 acentos empilhados')
      for (const bom of ['José Antônio de Araújo', `Jose${ACENTO_AGUDO} Anto${CIRCUNFLEXO}nio`, `Nguye${PONTO_EMBAIXO}${CIRCUNFLEXO}n Fictício`, "D'Ávila D’Ávila João-Paulo"]) {
        assert.equal(await proibido(bom), false, bom)
      }
    })

    it('o telefone colado com marcas de direção e o nome com tabulação são gravados limpos, pelo próprio e pela secretaria', async () => {
      const { usuario, pessoa } = await associado('ministro.colado@teste.local', 'Ministro Fictício Colado')
      await gravar(usuario, pessoa, 'telefone', `${DIRECAO[0]}(94) 99999-0000${DIRECAO[1]}${MARCA_ESQ_DIR}`)
      // o nome do associado, quem corrige é a secretaria (ele vai na credencial)
      await gravar(secretaria, pessoa, 'nome', `Ministro${TAB}Fictício${ESPACO_ZERO} Colado${ESPACO_DURO}da Silva${PREENCHE_HANGUL}`)
      assert.deepEqual(await lido(pessoa), { nome: 'Ministro Fictício Colado da Silva', telefone: '(94) 99999-0000' })
      // a secretaria cola na ficha: o mesmo
      await gravar(secretaria, pessoa, 'telefone', `94 98888-0000${ESPACO_ZERO}`)
      assert.equal((await lido(pessoa)).telefone, '94 98888-0000')
      // só invisível no telefone: fica sem telefone
      await gravar(usuario, pessoa, 'telefone', `${MARCA_ESQ_DIR}${ESPACO_ZERO}`)
      assert.equal((await lido(pessoa)).telefone, null)
    })

    it('o telefone vai até 40 (dois números cabem); o que passa do limite recebe a mensagem do campo', async () => {
      const { usuario, pessoa } = await associado('ministro.limites@teste.local', 'Ministro Fictício dos Limites')
      await gravar(usuario, pessoa, 'telefone', '(94) 99999-0000 / (94) 98888-0000 recado')
      assert.equal((await lido(pessoa)).telefone, '(94) 99999-0000 / (94) 98888-0000 recado')
      await assert.rejects(gravar(usuario, pessoa, 'telefone', '9'.repeat(41)), recusadoCom(/telefone.*40/))
      await assert.rejects(gravar(secretaria, pessoa, 'nome', 'N'.repeat(151)), recusadoCom(/nome.*150/))
      await assert.rejects(gravar(secretaria, pessoa, 'nome', `${ESPACO_ZERO}${PREENCHE_HANGUL} ${TAB}`), recusadoCom(/nome/i))
    })

    it('o pedido de correção do nome e do telefone já recusa na hora o que o aceite recusaria, e guarda o valor limpo', async () => {
      const { usuario, pessoa } = await associado('ministro.correcao@teste.local', 'Ministro Fictício da Correção')
      const pedir = (campo: string, valor: string) =>
        chamar(usuario, 'select public.pedir_correcao_dado($1, $2, $3, null) as id', [pessoa, campo, valor]).then((r) => (r.rows[0] as { id: string }).id)
      await assert.rejects(pedir('telefone', '(94) 99999-0000, falar com a secretária da igreja'), recusadoCom(/telefone.*40/))
      await assert.rejects(pedir('nome', `Ministro Fictício ${'Sobrenome '.repeat(15)}`), recusadoCom(/nome.*150/))
      const id = await pedir('telefone', `${DIRECAO[0]}(94) 97777-0000${DIRECAO[1]}`)
      const pedido = await um<{ valor_pedido: string; texto: string }>('select valor_pedido, texto from public.pedidos_correcao where id = $1', [id])
      assert.equal(pedido.valor_pedido, '(94) 97777-0000')
      assert.doesNotMatch(pedido.texto, /[\u202a-\u202e]/)
      // a secretaria aceita e o cadastro fica com o número limpo
      await chamar(secretaria, 'select public.responder_correcao($1, true, null)', [id])
      assert.equal((await lido(pessoa)).telefone, '(94) 97777-0000')
    })

    it('o cadastro aberto do site também tira o espaço duro e o preenchimento invisível', async () => {
      const conta = await criarUsuario(db, 'nome.duro@teste.local', `Nome${ESPACO_DURO}Fictício${PREENCHE_HANGUL} Duro`)
      assert.equal((await lido(await pessoaDe(conta))).nome, 'Nome Fictício Duro')
    })
  })
})
