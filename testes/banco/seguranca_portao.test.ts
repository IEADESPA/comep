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
})
