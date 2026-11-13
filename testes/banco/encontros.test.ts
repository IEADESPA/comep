// Fase 4.1: assembleias e reuniões — preparar, convocar (regras do Art. 16), cancelar, arquivar e o site. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

/** Dia (aaaa-mm-dd) daqui a N dias, no fuso de Parauapebas. */
function daqui(dias: number): string {
  const d = new Date(Date.now() + dias * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
}

/** O próximo dia 20 de abril ou de outubro com pelo menos 31 dias de antecedência. */
function proximaAgo(): string {
  const minimo = daqui(31)
  for (let ano = Number(minimo.slice(0, 4)); ; ano++) {
    for (const mes of ['04', '10']) {
      const dia = `${ano}-${mes}-20`
      if (dia >= minimo) return dia
    }
  }
}

const quando = (dia: string, hora = '19:00') => `${dia}T${hora}:00-03:00`

describe('Fase 4.1 — assembleias e reuniões', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let ministro: string
  let ago: string
  let reuniao: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const salvar = (quem: string, id: string | null, dados: Record<string, unknown>) =>
    chamar(quem, 'select public.salvar_encontro($1, $2::jsonb) as id', [id, JSON.stringify(dados)]).then(
      (r) => (r.rows[0] as { id: string }).id,
    )
  const convocar = (quem: string, id: string) => chamar(quem, 'select public.convocar_encontro($1)', [id])
  const publicas = async () => {
    const r = await chamar(null, 'select public.convocacoes_publicas() as c')
    return (r.rows[0] as { c: { id: string; situacao: string; pauta: unknown[] }[] }).c
  }

  const AGO = {
    tipo: 'ago',
    titulo: 'Assembleia Geral Ordinária de teste',
    inicio: quando(proximaAgo()),
    local: 'Sede do COMEP',
    edital: 'O Presidente do COMEP convoca os associados…',
    pauta: [
      { titulo: 'Prestação de contas do exercício', deliberativo: true, maioria: 'simples' },
      { titulo: 'Admissão de novos associados', deliberativo: true },
      { titulo: 'Informes', descricao: 'Avisos gerais' },
    ],
  }

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro de Teste')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, ministro, 'ministro')
  })

  describe('preparar', () => {
    it('a secretaria prepara a assembleia com a pauta; o ministro não prepara nem vê o rascunho', async () => {
      await assert.rejects(salvar(ministro, null, AGO), erroComCodigo(SEM_PERMISSAO))
      ago = await salvar(secretaria, null, AGO)
      const pauta = await db.query<{ ordem: number; deliberativo: boolean; maioria: string | null }>(
        'select ordem, deliberativo, maioria from public.encontro_pauta where encontro_id = $1 and arquivado_em is null order by ordem',
        [ago],
      )
      assert.deepEqual(pauta.rows, [
        { ordem: 1, deliberativo: true, maioria: 'simples' },
        { ordem: 2, deliberativo: true, maioria: 'simples' },
        { ordem: 3, deliberativo: false, maioria: null },
      ])
      const visto = await chamar(ministro, 'select id from public.encontros')
      assert.equal(visto.rows.length, 0)
      assert.equal((await publicas()).length, 0)
    })

    it('data no passado, sem título ou sem local: recusado', async () => {
      await assert.rejects(salvar(secretaria, null, { ...AGO, inicio: quando(daqui(-1)) }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(secretaria, null, { ...AGO, titulo: ' ' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(salvar(secretaria, null, { ...AGO, local: '' }), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('alterar a pauta guarda a anterior (arquivada) e põe a nova', async () => {
      await salvar(secretaria, ago, { ...AGO, pauta: [...AGO.pauta, { titulo: 'Eleição', deliberativo: true, maioria: 'simples' }] })
      const r = await db.query<{ ativos: number; arquivados: number }>(
        `select count(*) filter (where arquivado_em is null)::int as ativos, count(*) filter (where arquivado_em is not null)::int as arquivados
         from public.encontro_pauta where encontro_id = $1`,
        [ago],
      )
      assert.deepEqual(r.rows[0], { ativos: 4, arquivados: 3 })
    })
  })

  describe('convocar (Art. 16)', () => {
    it('a convocação da assembleia é do presidente, não da secretaria', async () => {
      await assert.rejects(convocar(secretaria, ago), erroComCodigo(SEM_PERMISSAO))
    })

    it('menos de 30 dias de antecedência: recusado', async () => {
      const perto = await salvar(secretaria, null, { ...AGO, tipo: 'age', fundamento: 'Pedido de 3/5 dos associados', inicio: quando(daqui(10)) })
      await assert.rejects(convocar(presidencia, perto), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('AGO fora da 2ª quinzena de abril ou de outubro: recusada', async () => {
      const fora = await salvar(secretaria, null, { ...AGO, inicio: quando(proximaAgo().replace(/-20$/, '-05')) })
      await assert.rejects(convocar(presidencia, fora), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('AGE sem dizer quem pediu, ou sem pauta, ou sem edital: recusada', async () => {
      const longe = quando(daqui(45))
      const semFundamento = await salvar(secretaria, null, { ...AGO, tipo: 'age', inicio: longe })
      await assert.rejects(convocar(presidencia, semFundamento), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const semPauta = await salvar(secretaria, null, { ...AGO, tipo: 'age', fundamento: 'Conselho Diretor', inicio: longe, pauta: [] })
      await assert.rejects(convocar(presidencia, semPauta), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const semEdital = await salvar(secretaria, null, { ...AGO, tipo: 'age', fundamento: 'Conselho Diretor', inicio: longe, edital: '' })
      await assert.rejects(convocar(presidencia, semEdital), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('convocada: todos com login veem, o site mostra o edital e a pauta, e não muda mais', async () => {
      await convocar(presidencia, ago)
      const visto = await chamar(ministro, 'select id, situacao from public.encontros')
      assert.deepEqual(visto.rows, [{ id: ago, situacao: 'convocado' }])
      const site = await publicas()
      assert.equal(site.length, 1)
      assert.equal(site[0].id, ago)
      assert.equal(site[0].pauta.length, 4)
      await assert.rejects(salvar(secretaria, ago, AGO), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(convocar(presidencia, ago), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('a antecedência vem da configuração (se o estatuto mudar); o ministro não mexe nela', async () => {
      await chamar(ministro, 'update public.config_assembleias set antecedencia_dias = 0')
      await chamar(secretaria, 'update public.config_assembleias set antecedencia_dias = 5')
      const age = await salvar(secretaria, null, { ...AGO, tipo: 'age', fundamento: 'Conselho Diretor', inicio: quando(daqui(10)) })
      await convocar(presidencia, age)
      await chamar(secretaria, 'update public.config_assembleias set antecedencia_dias = 30')
    })
  })

  describe('reunião mensal', () => {
    it('a secretaria marca e publica, sem prazo de 30 dias; não tem votação de assembleia', async () => {
      const base = { tipo: 'reuniao_mensal', titulo: 'Reunião mensal', inicio: quando(daqui(7)), local: 'Igreja anfitriã', pauta: [] }
      await assert.rejects(
        salvar(secretaria, null, { ...base, pauta: [{ titulo: 'Desligamento', deliberativo: true, maioria: 'tres_quintos' }] }),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      reuniao = await salvar(secretaria, null, { ...base, pauta: [{ titulo: 'Oração e comunhão' }] })
      await convocar(secretaria, reuniao)
      const r = await db.query<{ situacao: string }>('select situacao from public.encontros where id = $1', [reuniao])
      assert.equal(r.rows[0].situacao, 'convocado')
      assert.ok(!(await publicas()).some((c) => c.id === reuniao), 'reunião mensal não vai para o site')
    })
  })

  describe('cancelar e arquivar', () => {
    it('cancelar pede motivo e é do presidente (assembleia); o site mostra "cancelada"', async () => {
      await assert.rejects(chamar(secretaria, "select public.cancelar_encontro($1, 'Motivo')", [ago]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(presidencia, "select public.cancelar_encontro($1, '')", [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidencia, "select public.cancelar_encontro($1, 'Mudança de local')", [ago])
      assert.equal((await publicas()).find((c) => c.id === ago)?.situacao, 'cancelado')
    })

    it('convocado não se arquiva; cancelado sim (sai das listas e do site, mas fica guardado)', async () => {
      await assert.rejects(chamar(secretaria, 'select public.arquivar_encontro($1)', [reuniao]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(ministro, 'select public.arquivar_encontro($1)', [ago]), erroComCodigo(SEM_PERMISSAO))
      await chamar(secretaria, 'select public.arquivar_encontro($1)', [ago])
      assert.ok(!(await publicas()).some((c) => c.id === ago))
      const r = await db.query('select 1 from public.encontros where id = $1', [ago])
      assert.equal(r.rows.length, 1)
      await assert.rejects(db.query('delete from public.encontros where id = $1', [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('visitante sem login só chega às convocações públicas', async () => {
      await assert.rejects(chamar(null, 'select * from public.encontros'), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(chamar(null, 'select public.salvar_encontro(null, $1::jsonb)', [JSON.stringify(AGO)]), erroComCodigo(SEM_PERMISSAO))
    })
  })
})
