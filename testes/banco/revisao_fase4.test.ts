// Revisão geral da Fase 4 (13/11/2026): um teste para cada achado (docs/revisoes/fase-4.md).
// Todos falham sem a migração 20261114140000_revisao_fase4.sql. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Revisão geral da Fase 4 — correções', () => {
  let db: PGlite
  let presid: string
  let secret: string
  let estranho: string
  const u: string[] = []
  const p: string[] = []
  let eleicao: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const tem = async (quem: string, perfil: string) =>
    ((await chamar(quem, `select interno.tenho_perfil('${perfil}') as t`)).rows[0] as { t: boolean }).t
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]

  async function assembleia(tipo: string, minutosAtras: number, extra = ''): Promise<string> {
    return (
      await um<{ id: string }>(
        `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em ${extra ? ', ' + extra.split('=')[0] : ''})
         values ($1::public.tipo_encontro, 'Assembleia', now() - make_interval(mins => $2), 'Sede', 'convocado', now() ${extra ? ', ' + extra.split('=')[1] : ''})
         returning id`,
        [tipo, minutosAtras],
      )
    ).id
  }

  before(async () => {
    db = await criarBanco()
    presid = await criarUsuario(db, 'presid@teste.local', 'Presidência à Mão')
    secret = await criarUsuario(db, 'secret@teste.local', 'Secretaria à Mão')
    estranho = await criarUsuario(db, 'estranho@teste.local', 'Login Qualquer')
    await darPerfil(db, presid, 'presidencia')
    await darPerfil(db, secret, 'secretaria')
    for (let i = 1; i <= 7; i++) {
      u.push(await criarUsuario(db, `a${i}@teste.local`, `Associado ${i}`))
      const r = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [u[i - 1]])
      p.push(r.id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [r.id])
    }
    // primeira diretoria (eleita antes do sistema): presidente a1, vice a2, conselheiro a3
    await chamar(
      presid,
      `select public.registrar_diretoria(jsonb_build_object('inicio', current_date - 10, 'fim', current_date + 1400,
         'documento', 'Ata de 2025', 'membros', $1::jsonb))`,
      [JSON.stringify([{ cargo: 'presidente', pessoa_id: p[0] }, { cargo: 'vice_presidente', pessoa_id: p[1] }, { cargo: 'conselheiro_fiscal', pessoa_id: p[2] }])],
    )
    eleicao = await assembleia('ago', 60 * 24 * 30, 'instalada_em=now()')
  })

  describe('contas e perfis', () => {
    it('F1 — a secretaria não gera código de acesso para quem tem cargo pelo mandato (só a presidência)', async () => {
      await assert.rejects(chamar(secret, "select public.gerar_codigo_acesso($1, 'nova_senha')", [p[0]]), erroComCodigo(SEM_PERMISSAO))
      await chamar(presid, "select public.gerar_codigo_acesso($1, 'nova_senha')", [p[0]])
    })

    it('F4 — desligado perde o perfil da diretoria dado à mão', async () => {
      await db.query("insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'tesouraria')", [p[5]])
      assert.equal(await tem(u[5], 'tesouraria'), true)
      await db.query("update public.associados set situacao = 'desligado' where pessoa_id = $1", [p[5]])
      assert.equal(await tem(u[5], 'tesouraria'), false)
    })

    it('F7 — perfil retirado não volta a valer por "desarquivar"', async () => {
      const r = await um<{ id: string }>("insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'secretaria') returning id", [p[6]])
      await db.query('update public.perfis_acesso set arquivado_em = now() where id = $1', [r.id])
      await assert.rejects(chamar(presid, 'update public.perfis_acesso set arquivado_em = null where id = $1', [r.id]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('diretoria (mandatos)', () => {
    it('F3 — ninguém se põe num cargo que lhe dá poder novo; depois do primeiro registro, só com assembleia instalada; no máximo 4 anos', async () => {
      const presidPessoa = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [presid])).id
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [presidPessoa])
      const registrar = (membros: unknown, encontro: string | null, fim = 'current_date + 1000') =>
        chamar(
          presid,
          `select public.registrar_diretoria(jsonb_build_object('inicio', current_date, 'fim', ${fim}, 'encontro_id', $2::text, 'membros', $1::jsonb))`,
          [JSON.stringify(membros), encontro],
        )
      await assert.rejects(registrar([{ cargo: 'segundo_tesoureiro', pessoa_id: presidPessoa }], eleicao), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(registrar([{ cargo: 'segundo_tesoureiro', pessoa_id: p[3] }], null), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const naoInstalada = await assembleia('ago', 60 * 24 * 5)
      await assert.rejects(registrar([{ cargo: 'segundo_tesoureiro', pessoa_id: p[3] }], naoInstalada), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        registrar([{ cargo: 'segundo_tesoureiro', pessoa_id: p[3] }], eleicao, 'current_date + 1500'),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await registrar([{ cargo: 'segundo_tesoureiro', pessoa_id: p[3] }], eleicao)
    })

    it('F3 — tirar o presidente do cargo pede a assembleia; renunciar, a própria pessoa faz', async () => {
      const presidente = (await um<{ id: string }>("select id from public.mandatos where cargo = 'presidente'")).id
      // o vice (presidência pelo mandato) não tira o presidente sem assembleia
      await assert.rejects(chamar(u[1], "select public.encerrar_mandato($1, current_date, 'Destituição')", [presidente]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // o conselheiro renuncia (o próprio)
      const conselheiro = (await um<{ id: string }>("select id from public.mandatos where cargo = 'conselheiro_fiscal'")).id
      await chamar(u[2], "select public.encerrar_mandato($1, current_date, 'Renúncia')", [conselheiro])
      assert.equal(await tem(u[2], 'conselho_fiscal'), false)
    })

    it('F13 — mandato registrado por engano: encerrado no dia do início, não chega a valer (e libera a vaga)', async () => {
      const m = (await um<{ id: string }>("select id from public.mandatos where cargo = 'segundo_tesoureiro'")).id
      assert.equal(await tem(u[3], 'tesouraria'), true)
      await chamar(presid, "select public.encerrar_mandato($1, current_date, 'Registrado por engano')", [m])
      assert.equal(await tem(u[3], 'tesouraria'), false)
    })

    it('F5/F14 — desligado ou falecido: os mandatos acabam e a vaga fica livre; a secretaria não registra o falecimento de quem tem cargo', async () => {
      await assert.rejects(chamar(secret, 'select public.registrar_falecimento($1, current_date, null)', [p[1]]), erroComCodigo(SEM_PERMISSAO))
      await chamar(presid, 'select public.registrar_falecimento($1, current_date, null)', [p[1]])
      const v = await um<{ vigente: boolean }>("select vigente from public.vw_mandatos where cargo = 'vice_presidente'")
      assert.equal(v.vigente, false)
      await chamar(
        presid,
        `select public.registrar_diretoria(jsonb_build_object('inicio', current_date, 'fim', current_date + 1000, 'encontro_id', $2::text, 'membros', $1::jsonb))`,
        [JSON.stringify([{ cargo: 'vice_presidente', pessoa_id: p[4] }]), eleicao],
      )
    })

    it('F5 — a secretaria não arquiva associado com cargo, nem desligado; readmissão do desligado só pela assembleia', async () => {
      await assert.rejects(
        chamar(secret, 'update public.associados set arquivado_em = now() where pessoa_id = $1', [p[0]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secret, 'update public.associados set arquivado_em = now() where pessoa_id = $1', [p[5]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secret, "insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', current_date)", [p[5]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })

  describe('assembleia: quórum, votações e ata', () => {
    let ago: string
    let itemSimples: string
    let itemDesligar: string

    before(async () => {
      ago = await assembleia('ago', 10)
      itemSimples = (await um<{ id: string }>(
        "insert into public.encontro_pauta (encontro_id, ordem, titulo, deliberativo, maioria) values ($1, 1, 'Contas', true, 'simples') returning id",
        [ago],
      )).id
      itemDesligar = (await um<{ id: string }>(
        `insert into public.encontro_pauta (encontro_id, ordem, titulo, deliberativo, maioria, desligamento_pessoa_id)
         values ($1, 2, 'Desligamento', true, 'tres_quintos', $2) returning id`,
        [ago, p[6]],
      )).id
      for (const pessoa of [p[0], p[3], p[4], p[6]]) await chamar(secret, "select public.registrar_presenca($1, $2, 'lista')", [ago, pessoa])
    })

    it('F20 — a contagem do quórum é só da diretoria', async () => {
      await assert.rejects(chamar(u[3], 'select public.contagem_quorum($1)', [ago]), erroComCodigo(SEM_PERMISSAO))
    })

    it('B1 — a lista de presença da assembleia só se encerra depois de instalada', async () => {
      await assert.rejects(chamar(secret, 'select public.encerrar_presenca($1)', [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('F18 — instalar só no dia (depois da lista fechar a janela, não)', async () => {
      const velha = await assembleia('age', 60 * 24 * 3)
      await assert.rejects(chamar(secret, 'select public.instalar_assembleia($1)', [velha]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(secret, 'select public.instalar_assembleia($1)', [ago])
    })

    it('F12 — o desligamento é o do associado indicado na pauta; inciso IV confere as faltas', async () => {
      await assert.rejects(
        chamar(secret, "select public.registrar_votacao($1, 3, 0, 0, $2, 'II', null)", [itemDesligar, p[3]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secret, "select public.registrar_votacao($1, 3, 0, 0, $2, 'IV', null)", [itemDesligar, p[6]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secret, "select public.registrar_votacao($1, 3, 0, 0, $2, 'II', null)", [itemSimples, p[6]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secret, 'select public.registrar_votacao($1, 3, 0, 0, null, null, null)', [itemSimples])
    })

    it('F10 — assembleia instalada não se cancela', async () => {
      await assert.rejects(chamar(presid, "select public.cancelar_encontro($1, 'Não houve')", [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('F2 — assinatura vazia (NULL) não vira a do presidente', async () => {
      await chamar(secret, "select public.salvar_ata($1, 'Ata da assembleia de teste.')", [ago])
      await assert.rejects(chamar(estranho, 'select public.assinar_ata($1, null)', [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(secret, 'select public.assinar_ata($1, null)', [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('F11 — as votações travam já na primeira assinatura; a ata guarda o cargo de quem assinou', async () => {
      await chamar(u[0], "select public.assinar_ata($1, 'presidente')", [ago])
      await assert.rejects(
        chamar(secret, 'select public.registrar_votacao($1, 0, 3, 0, null, null, null)', [itemSimples]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      const ata = await um<{ cargo: string }>('select assinada_presidente_cargo as cargo from public.atas where encontro_id = $1', [ago])
      assert.equal(ata.cargo, 'presidente')
    })

    it('F8/F9 — antes de assinada, quem não é da diretoria não vê votações nem arquivo; depois, o associado ativo vê', async () => {
      await chamar(secret, "insert into storage.objects (bucket_id, name) values ('atas', $1)", [`${ago}/ata.pdf`])
      for (const quem of [estranho, u[3]]) {
        assert.equal((await chamar(quem, 'select 1 from public.deliberacoes where encontro_id = $1', [ago])).rows.length, 0)
        assert.equal((await chamar(quem, "select 1 from storage.objects where bucket_id = 'atas'")).rows.length, 0)
      }
      await chamar(secret, "select public.assinar_ata($1, 'secretario')", [ago])
      assert.equal((await chamar(u[3], 'select 1 from public.deliberacoes where encontro_id = $1', [ago])).rows.length, 1)
      assert.equal((await chamar(u[3], "select 1 from storage.objects where bucket_id = 'atas'")).rows.length, 1)
      // quem só tem login (não é associado) continua sem ver
      assert.equal((await chamar(estranho, 'select 1 from public.deliberacoes where encontro_id = $1', [ago])).rows.length, 0)
    })

    it('F17 — assinada pelos dois, o arquivo da ata no papel ainda entra (uma vez)', async () => {
      await chamar(secret, 'select public.anexar_ata($1, $2)', [ago, `${ago}/ata.pdf`])
      await assert.rejects(chamar(secret, 'select public.anexar_ata($1, $2)', [ago, `${ago}/ata.pdf`]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('regras e faltas', () => {
    it('F15 — só a presidência muda as regras; a 2ª chamada fica a da convocação', async () => {
      await chamar(secret, 'update public.config_assembleias set minutos_segunda_chamada = 0')
      assert.equal((await um<{ m: number }>('select minutos_segunda_chamada as m from public.config_assembleias')).m, 60)
      await assert.rejects(chamar(presid, 'update public.config_assembleias set faltas_aviso = 5, faltas_pauta = 3'), erroComCodigo('23514'))
    })

    it('F16 — faltas só contam depois de o associado entrar no sistema', async () => {
      for (const dias of [40, 30, 20]) {
        await db.query(
          `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em, presenca_encerrada_em)
           values ('reuniao_mensal', 'Reunião', now() - make_interval(days => $1), 'Sede', 'realizado', now(), now())`,
          [dias],
        )
      }
      const novo = await criarUsuario(db, 'novo@teste.local', 'Cadastrado Hoje')
      const pessoaNova = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [novo])).id
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [pessoaNova])
      assert.equal((await um<{ n: number }>('select interno.faltas_seguidas($1) as n', [pessoaNova])).n, 0)
    })

    it('F19 — rascunho cancelado sem convocação não aparece para os associados', async () => {
      const r = await um<{ id: string }>(
        "insert into public.encontros (tipo, titulo, inicio, local, situacao) values ('age', 'Rascunho', now() + interval '40 days', 'Sede', 'cancelado') returning id",
      )
      assert.equal((await chamar(u[3], 'select 1 from public.encontros where id = $1', [r.id])).rows.length, 0)
    })
  })
})
