// Telas novas, parte 13 (Fase 5.5): o termo de uso de dados (LGPD), com versão e aceite — a versão nova pede o aceite
// de novo, a versão publicada não muda nem se apaga, o dado sensível tem o consentimento destacado, o opcional é
// escolha separada; Meu perfil › Privacidade (os meus dados, o pedido de exclusão e quem mexeu nos dados) e as
// versões da secretaria. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Termo = { id: string; versao: number; aceite: { aceito_em: string; aparelho: string | null } | null; minuta: boolean; resumo: unknown[]; partes: unknown[] }
type MeuTermo = { do_comep: boolean; atual: Termo | null; proxima: Termo | null; pedir: Termo | null }

describe('Fase 5.5, parte 13 — o termo de uso de dados e a privacidade', () => {
  let db: PGlite
  let secretaria: string
  let ministro: string
  let candidato: string
  let pessoaMinistro: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const meuTermo = async (quem: string) => ((await chamar(quem, 'select public.meu_termo() as t')).rows[0] as { t: MeuTermo }).t
  const aceitar = (quem: string, termo: string, sensivel = true, whatsapp: boolean | null = true, aniversario: boolean | null = false) =>
    chamar(quem, "select public.aceitar_termo($1, 'Celular · Chrome', $2, $3, $4)", [termo, sensivel, whatsapp, aniversario])

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    candidato = await criarUsuario(db, 'candidato@teste.local', 'Candidato Fictício')
    await darPerfil(db, secretaria, 'secretaria')
    pessoaMinistro = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [ministro])).id
    await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoaMinistro])
  })

  it('a versão 1 (minuta) vale desde a migração: o resumo em 9 pontos e o termo em 10 partes; quem é do COMEP precisa aceitar', async () => {
    const t = await meuTermo(ministro)
    assert.equal(t.do_comep, true)
    assert.equal(t.atual?.versao, 1)
    assert.equal(t.atual?.minuta, true)
    assert.equal(t.atual?.resumo.length, 9)
    assert.equal(t.atual?.partes.length, 10)
    assert.equal(t.pedir?.versao, 1, 'ainda não aceitou: o sistema pede')
    // o candidato (sem perfil) dá o consentimento no pedido de associação: aqui não se pede
    assert.equal((await meuTermo(candidato)).pedir, null)
    await assert.rejects(chamar(null, 'select public.meu_termo()'), erroComCodigo(SEM_PERMISSAO))
  })

  it('o aceite pede o dado sensível; guarda a versão, a data, a hora e o aparelho; não se repete nem muda', async () => {
    const id = (await meuTermo(ministro)).atual!.id
    await assert.rejects(aceitar(ministro, id, false), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await aceitar(ministro, id, true, false, true)
    const t = await meuTermo(ministro)
    assert.equal(t.pedir, null)
    assert.equal(t.atual?.aceite?.aparelho, 'Celular · Chrome')
    await assert.rejects(aceitar(ministro, id), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(db.query("update public.termo_aceites set aparelho = 'Outro'"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(db.query('delete from public.termo_aceites'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    // as escolhas opcionais (separadas)
    const p = ((await chamar(ministro, 'select public.minha_privacidade() as p')).rows[0] as { p: { receber_whatsapp: boolean; aparecer_aniversariantes: boolean; aceites: unknown[] } }).p
    assert.equal(p.receber_whatsapp, false)
    assert.equal(p.aparecer_aniversariantes, true)
    assert.equal(p.aceites.length, 1)
  })

  it('a versão publicada não muda nem se apaga; ninguém grava direto', async () => {
    await assert.rejects(db.query("update public.termos_uso set mudancas = '{x}' where versao = 1"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(db.query('delete from public.termos_uso where versao = 1'), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(secretaria, "update public.termos_uso set minuta = false"), erroComCodigo(SEM_PERMISSAO))
    await assert.rejects(
      chamar(ministro, "insert into public.termo_aceites (termo_id, pessoa_id, dado_sensivel) select id, $1, true from public.termos_uso", [pessoaMinistro]),
      erroComCodigo(SEM_PERMISSAO),
    )
  })

  it('a versão nova: rascunho da secretaria (cópia da última), publicar com o que mudou; todos aceitam de novo', async () => {
    await assert.rejects(chamar(ministro, `select public.salvar_rascunho_termo('{}'::jsonb)`), erroComCodigo(SEM_PERMISSAO))
    const id = ((await chamar(secretaria, "select public.salvar_rascunho_termo(jsonb_build_object('vale_a_partir', current_date + 10)) as id")).rows[0] as { id: string }).id
    // o rascunho não aparece para o ministro
    assert.equal((await chamar(ministro, 'select 1 from public.termos_uso where publicado_em is null')).rows.length, 0)
    // sem o que mudou, não publica
    await assert.rejects(chamar(secretaria, 'select public.publicar_termo($1)', [id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await chamar(secretaria, `select public.salvar_rascunho_termo('{"mudancas": ["A sua foto aparece na página da igreja, se você for o pastor presidente."]}'::jsonb)`)
    await chamar(secretaria, 'select public.publicar_termo($1)', [id])
    // publicada para daqui a 10 dias: é a "próxima"; a atual (1) continua aceita; já dá para aceitar a 2
    let t = await meuTermo(ministro)
    assert.equal(t.atual?.versao, 1)
    assert.equal(t.proxima?.versao, 2)
    assert.equal(t.pedir?.versao, 2)
    // quando a versão 2 passa a valer, quem não aceitou precisa aceitar
    await db.exec('alter table public.termos_uso disable trigger proteger_termo')
    await db.query('update public.termos_uso set vale_a_partir = current_date where versao = 2')
    await db.exec('alter table public.termos_uso enable trigger proteger_termo')
    t = await meuTermo(ministro)
    assert.equal(t.atual?.versao, 2)
    assert.equal(t.atual?.aceite, null)
    assert.equal(t.pedir?.versao, 2)
    await aceitar(ministro, t.atual!.id, true, false, true)
    assert.equal((await meuTermo(ministro)).pedir, null)
    // a secretaria vê as versões com quantos aceitaram
    const v = ((await chamar(secretaria, 'select public.versoes_do_termo() as v')).rows[0] as { v: { versoes: { versao: number; aceites: number; faltam: number }[] } }).v
    const v2 = v.versoes.find((x) => x.versao === 2)!
    assert.equal(v2.aceites, 1)
    assert.equal(v2.faltam, 1, 'a secretaria ainda não aceitou')
    await assert.rejects(chamar(ministro, 'select public.versoes_do_termo()'), erroComCodigo(SEM_PERMISSAO))
  })

  it('Meu perfil › Privacidade: os meus dados, o pedido de exclusão (a secretaria responde) e quem mexeu nos dados', async () => {
    const dados = ((await chamar(ministro, 'select public.meus_dados() as d')).rows[0] as { d: { cadastro: { nome: string }; termos_aceitos: unknown[] } }).d
    assert.equal(dados.cadastro.nome, 'Ministro de Teste')
    assert.equal(dados.termos_aceitos.length, 2)
    await assert.rejects(chamar(ministro, "select public.pedir_exclusao('')"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    const pedido = ((await chamar(ministro, "select public.pedir_exclusao('Quero que apaguem o meu telefone antigo.') as id")).rows[0] as { id: string }).id
    await assert.rejects(chamar(ministro, "select public.pedir_exclusao('De novo.')"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    await assert.rejects(chamar(ministro, "select public.responder_pedido_titular($1, true, 'Feito.')", [pedido]), erroComCodigo(SEM_PERMISSAO))
    await chamar(secretaria, "select public.responder_pedido_titular($1, true, 'O telefone antigo foi tirado do cadastro.')", [pedido])
    // a secretaria mexeu no cadastro do ministro: aparece em "quem mexeu"
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [secretaria])
    await db.query("update public.pessoas set telefone = '94999990000' where id = $1", [pessoaMinistro])
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
    const p = ((await chamar(ministro, 'select public.minha_privacidade() as p')).rows[0] as {
      p: { pedidos: { situacao: string }[]; quem_mexeu: { quem: string; o_que: string }[] }
    }).p
    assert.equal(p.pedidos[0].situacao, 'atendido')
    assert.ok(p.quem_mexeu.some((x) => x.quem === 'Secretaria de Teste' && x.o_que === 'o seu cadastro'))
    // a ficha: a secretaria vê se ele quer receber pelo WhatsApp; o ministro não vê a de outro
    const w = ((await chamar(secretaria, 'select public.privacidade_de($1) as w', [pessoaMinistro])).rows[0] as { w: { receber_whatsapp: boolean } }).w
    assert.equal(w.receber_whatsapp, false)
    await assert.rejects(chamar(ministro, 'select public.privacidade_de($1)', [pessoaMinistro]), erroComCodigo(SEM_PERMISSAO))
  })
})
