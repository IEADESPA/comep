// Fase 5.1: a igreja como instituição — documentos, diretoria da igreja, pedidos de correção e o resumo das igrejas.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 5.1 — a igreja como instituição', () => {
  let db: PGlite
  let secretaria: string
  let pastorA: string
  let pastorB: string
  let ministroA: string
  let ministroB: string
  const pessoa: Record<string, string> = {}
  let igrejaA: string
  let igrejaB: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]

  async function associar(usuario: string, igreja: string, presidente: boolean) {
    const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuario])
    pessoa[usuario] = p.id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.id])
    await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [p.id, igreja, presidente])
  }
  const enviarArquivo = (quem: string, caminho: string) =>
    chamar(quem, "insert into storage.objects (bucket_id, name) values ('igrejas', $1)", [caminho])
  const registrar = (quem: string, igreja: string, tipo: string, caminho: string, descricao: string | null = null) =>
    chamar(quem, 'select public.registrar_documento_igreja($1, $2::public.tipo_documento_igreja, $3, $4) as id', [igreja, tipo, caminho, descricao]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    igrejaA = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja A') returning id")).id
    igrejaB = (await um<{ id: string }>("insert into public.igrejas (nome) values ('Igreja B') returning id")).id
    pastorA = await criarUsuario(db, 'pa@teste.local', 'Pastor Presidente A')
    pastorB = await criarUsuario(db, 'pb@teste.local', 'Pastor Presidente B')
    ministroA = await criarUsuario(db, 'ma@teste.local', 'Ministro A')
    ministroB = await criarUsuario(db, 'mb@teste.local', 'Ministro B')
    await associar(pastorA, igrejaA, true)
    await associar(pastorB, igrejaB, true)
    await associar(ministroA, igrejaA, false)
    await associar(ministroB, igrejaB, false)
  })

  describe('documentos da igreja (estatuto, cartão CNPJ, ata da diretoria)', () => {
    let estatuto: string

    it('o pastor presidente envia o estatuto da própria igreja; não o da outra; o ministro não envia', async () => {
      await enviarArquivo(pastorA, `${igrejaA}/estatuto-1.pdf`)
      await assert.rejects(enviarArquivo(pastorA, `${igrejaB}/estatuto-1.pdf`), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(enviarArquivo(ministroA, `${igrejaA}/estatuto-2.pdf`), erroComCodigo(SEM_PERMISSAO))
      estatuto = await registrar(pastorA, igrejaA, 'estatuto', `${igrejaA}/estatuto-1.pdf`)
      await assert.rejects(registrar(pastorA, igrejaB, 'estatuto', `${igrejaB}/estatuto-1.pdf`), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(registrar(pastorA, igrejaA, 'estatuto', `${igrejaB}/estatuto-1.pdf`), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(registrar(ministroA, igrejaA, 'estatuto', `${igrejaA}/estatuto-1.pdf`), erroComCodigo(SEM_PERMISSAO))
    })

    it('um em vigor por tipo (o anterior fica guardado); "outro" pede a descrição', async () => {
      await enviarArquivo(pastorA, `${igrejaA}/estatuto-2.pdf`)
      const novo = await registrar(pastorA, igrejaA, 'estatuto', `${igrejaA}/estatuto-2.pdf`)
      const r = await db.query<{ id: string; arquivado: boolean }>(
        "select id, arquivado_em is not null as arquivado from public.igreja_documentos where igreja_id = $1 and tipo = 'estatuto' order by criado_em",
        [igrejaA],
      )
      assert.deepEqual(r.rows, [
        { id: estatuto, arquivado: true },
        { id: novo, arquivado: false },
      ])
      estatuto = novo
      await assert.rejects(registrar(pastorA, igrejaA, 'outro', `${igrejaA}/estatuto-2.pdf`), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a secretaria confere ou recusa (com motivo); o pastor presidente não confere; conferido não muda', async () => {
      await assert.rejects(chamar(pastorA, 'select public.conferir_documento_igreja($1, true, null)', [estatuto]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(secretaria, 'select public.conferir_documento_igreja($1, false, null)', [estatuto]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, 'select public.conferir_documento_igreja($1, true, null)', [estatuto])
      await assert.rejects(chamar(secretaria, "select public.conferir_documento_igreja($1, false, 'x')", [estatuto]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const d = await um<{ situacao: string }>('select situacao::text from public.igreja_documentos where id = $1', [estatuto])
      assert.equal(d.situacao, 'conferido')
    })

    it('quem lê: o pastor presidente vê os da sua igreja; o outro pastor e o ministro não; a secretaria vê todos', async () => {
      const ver = async (quem: string) => (await chamar(quem, 'select igreja_id from public.igreja_documentos')).rows.length
      assert.ok((await ver(pastorA)) >= 1)
      assert.equal(await ver(pastorB), 0)
      assert.equal(await ver(ministroA), 0)
      assert.ok((await ver(secretaria)) >= 1)
      const arquivos = async (quem: string) =>
        (await chamar(quem, "select name from storage.objects where bucket_id = 'igrejas'")).rows.length
      assert.equal(await arquivos(pastorB), 0)
      assert.ok((await arquivos(pastorA)) >= 1)
    })
  })

  describe('diretoria da igreja', () => {
    const salvar = (quem: string, igreja: string, membros: { cargo: string; nome: string }[], inicio = '2025-01-01', fim = '2028-12-31') =>
      chamar(quem, 'select public.salvar_diretoria_igreja($1, $2::date, $3::date, $4::jsonb) as n', [igreja, inicio, fim, JSON.stringify(membros)])

    it('o pastor presidente registra a diretoria da sua igreja; mudar guarda a anterior', async () => {
      await salvar(pastorA, igrejaA, [
        { cargo: 'Presidente', nome: 'Pastor Presidente A' },
        { cargo: 'Tesoureiro', nome: 'Irmão Fictício' },
      ])
      await salvar(pastorA, igrejaA, [{ cargo: 'Presidente', nome: 'Pastor Presidente A' }])
      const r = await um<{ atuais: number; antigos: number }>(
        `select count(*) filter (where arquivado_em is null)::int as atuais, count(*) filter (where arquivado_em is not null)::int as antigos
         from public.igreja_diretoria where igreja_id = $1`,
        [igrejaA],
      )
      assert.deepEqual(r, { atuais: 1, antigos: 2 })
    })

    it('o pastor de outra igreja não muda; sem membros ou com o fim antes do início: recusado', async () => {
      await assert.rejects(salvar(pastorB, igrejaA, [{ cargo: 'Presidente', nome: 'Outro' }]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(salvar(pastorA, igrejaA, []), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(pastorA, igrejaA, [{ cargo: 'Presidente', nome: 'X Y' }], '2028-01-01', '2025-01-01'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      assert.equal((await chamar(pastorB, 'select id from public.igreja_diretoria')).rows.length, 0)
    })
  })

  // A correção é estruturada desde a parte 4 (o dado, como está e como deve ficar): testes/banco/correcao_estruturada.test.ts
  describe('pedidos de correção no cadastro', () => {
    let pedido: string
    const pedir = (quem: string, pessoaId: string, campo: string, valor: string) =>
      chamar(quem, 'select public.pedir_correcao_dado($1, $2, $3, null) as id', [pessoaId, campo, valor])

    it('o pastor presidente pede para os ministros da sua igreja; não para os de outra; o ministro pede para si', async () => {
      const r = await pedir(pastorA, pessoa[ministroA], 'funcao', 'Presbítero da congregação')
      pedido = (r.rows[0] as { id: string }).id
      await assert.rejects(pedir(pastorA, pessoa[ministroB], 'telefone', '(94) 90000-0000'), erroComCodigo(SEM_PERMISSAO))
      await pedir(ministroB, pessoa[ministroB], 'nome', 'Ministro B Sebastião')
      await assert.rejects(pedir(ministroA, pessoa[ministroB], 'nome', 'Outro Nome Qualquer'), erroComCodigo(SEM_PERMISSAO))
    })

    it('quem vê: o ministro vê os pedidos sobre ele; o outro pastor não', async () => {
      assert.equal((await chamar(ministroA, 'select id from public.pedidos_correcao')).rows.length, 1)
      assert.equal((await chamar(pastorB, 'select id from public.pedidos_correcao where pessoa_id = $1', [pessoa[ministroA]])).rows.length, 0)
    })

    it('a secretaria atende ou recusa (com motivo); o pastor não responde', async () => {
      await assert.rejects(chamar(pastorA, "select public.responder_correcao($1, true, 'ok')", [pedido]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(secretaria, 'select public.responder_correcao($1, false, null)', [pedido]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secretaria, "select public.responder_correcao($1, true, 'Função corrigida.')", [pedido])
      const p = await um<{ situacao: string }>('select situacao from public.pedidos_correcao where id = $1', [pedido])
      assert.equal(p.situacao, 'atendido')
    })
  })

  describe('resumo das igrejas (o peso de cada igreja)', () => {
    it('a secretaria vê os ministros associados, os em dia, os documentos conferidos e se há diretoria; o ministro não', async () => {
      const r = await chamar(secretaria, 'select * from public.resumo_das_igrejas() where igreja_id = $1', [igrejaA])
      assert.deepEqual(r.rows[0], {
        igreja_id: igrejaA,
        ministros: 2,
        ministros_em_dia: 2,
        documentos_ok: ['estatuto'],
        documentos_pendentes: 0,
        diretoria: true,
      })
      await assert.rejects(chamar(ministroA, 'select * from public.resumo_das_igrejas()'), erroComCodigo(SEM_PERMISSAO))
    })
  })
})
