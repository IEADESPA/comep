// Fase 4.3: quórum, votações (maiorias), desligamento, falecimento e ata. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

describe('Fase 4.3 — quórum, votações e ata', () => {
  let db: PGlite
  let secretaria: string
  let presidencia: string
  let ambos: string
  const m: string[] = []
  const pessoa: string[] = []
  let ago: string
  const item: Record<string, string> = {}

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const votar = (pauta: string, favor: number, contra: number, abst: number, desligar: string | null = null, inciso: string | null = null) =>
    chamar(secretaria, 'select public.registrar_votacao($1, $2, $3, $4, $5, $6, null) as r', [pauta, favor, contra, abst, desligar, inciso]).then(
      (r) => (r.rows[0] as { r: { aprovada: boolean; votantes: number } }).r,
    )

  async function assembleia(tipo: string, minutosAtras: number): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into public.encontros (tipo, titulo, inicio, local, situacao, convocado_em)
       values ($1::public.tipo_encontro, 'Assembleia de teste', now() - make_interval(mins => $2), 'Local', 'convocado', now()) returning id`,
      [tipo, minutosAtras],
    )
    return r.rows[0].id
  }

  async function pauta(encontro: string, ordem: number, deliberativo: boolean, maioria: string | null): Promise<string> {
    const r = await db.query<{ id: string }>(
      `insert into public.encontro_pauta (encontro_id, ordem, titulo, deliberativo, maioria)
       values ($1, $2::integer, 'Item ' || $2::text, $3, $4::public.maioria_exigida) returning id`,
      [encontro, ordem, deliberativo, maioria],
    )
    return r.rows[0].id
  }

  const presente = (encontro: string, p: string) => chamar(secretaria, "select public.registrar_presenca($1, $2, 'lista')", [encontro, p])

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    ambos = await criarUsuario(db, 'ambos@teste.local', 'Pessoa com Dois Perfis')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, presidencia, 'presidencia')
    await darPerfil(db, ambos, 'secretaria')
    await darPerfil(db, ambos, 'presidencia')
    for (let i = 1; i <= 4; i++) {
      m.push(await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`))
      const p = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [m[i - 1]])
      pessoa.push(p.rows[0].id)
      await db.query("insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')", [p.rows[0].id])
    }
    // o 4º está em atraso: não é apto (Art. 11)
    await db.query(
      `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
       values ($1, 2025, 'mensal', '2025-05-01', '2025-05-10', 'nao_presidente', 20)`,
      [pessoa[3]],
    )
    ago = await assembleia('ago', 10)
    item.simples = await pauta(ago, 1, true, 'simples')
    item.desligamento = await pauta(ago, 2, true, 'tres_quintos')
    item.estatuto = await pauta(ago, 3, true, 'dois_tercos')
    item.informes = await pauta(ago, 4, false, null)
  })

  describe('quórum de instalação (Art. 16, §4º)', () => {
    it('conta só os aptos (ativos e em dia): 3 aptos, metade mais um = 2', async () => {
      await presente(ago, pessoa[3]) // em atraso: presente, mas não conta no quórum
      await presente(ago, pessoa[0])
      const r = await chamar(secretaria, 'select public.contagem_quorum($1) as c', [ago])
      assert.deepEqual((r.rows[0] as { c: unknown }).c, { aptos: 3, presentes: 2, presentes_aptos: 1 })
    })

    it('sem quórum na 1ª chamada e antes da 2ª: recusa e diz a hora da 2ª chamada', async () => {
      await assert.rejects(chamar(secretaria, 'select public.instalar_assembleia($1)', [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(m[0], 'select public.instalar_assembleia($1)', [ago]), erroComCodigo(SEM_PERMISSAO))
    })

    it('com quórum: instalada em 1ª chamada, com a conta guardada; não se instala duas vezes', async () => {
      await presente(ago, pessoa[1])
      const r = await chamar(secretaria, 'select public.instalar_assembleia($1) as i', [ago])
      assert.deepEqual((r.rows[0] as { i: unknown }).i, { chamada: 'primeira', aptos: 3, presentes_aptos: 2, minimo: 2 })
      await assert.rejects(chamar(secretaria, 'select public.instalar_assembleia($1)', [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('passada a hora da 2ª chamada: instala com qualquer número', async () => {
      const outra = await assembleia('age', 61)
      const r = await chamar(presidencia, 'select public.instalar_assembleia($1) as i', [outra])
      assert.equal((r.rows[0] as { i: { chamada: string } }).i.chamada, 'segunda')
    })
  })

  describe('votações (Art. 11, 8º e 21)', () => {
    it('item sem votação, ou mais votos que presentes em dia: recusado', async () => {
      await assert.rejects(votar(item.informes, 1, 0, 0), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(votar(item.simples, 2, 1, 0), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('maioria simples: mais a favor que contra; corrigir guarda a anterior', async () => {
      assert.equal((await votar(item.simples, 1, 1, 0)).aprovada, false)
      const r = await votar(item.simples, 2, 0, 0)
      assert.equal(r.aprovada, true)
      assert.equal(r.votantes, 2)
      const n = await db.query<{ n: number }>('select count(*)::int as n from public.deliberacoes where pauta_id = $1', [item.simples])
      assert.equal(n.rows[0].n, 2)
    })

    it('2/3 dos presentes aptos: 1 de 2 não basta; 2 de 2 aprova', async () => {
      assert.equal((await votar(item.estatuto, 1, 0, 1)).aprovada, false)
      assert.equal((await votar(item.estatuto, 2, 0, 0)).aprovada, true)
    })

    it('desligamento só em item de 3/5 da AGO; aprovado, o associado sai e perde o perfil de ministro', async () => {
      await assert.rejects(votar(item.simples, 2, 0, 0, pessoa[2], 'II'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(votar(item.desligamento, 2, 0, 0, pessoa[2], 'V'), erroComCodigo(BLOQUEADO_PELO_BANCO))
      const r = await votar(item.desligamento, 2, 0, 0, pessoa[2], 'II')
      assert.equal(r.aprovada, true)
      const a = await db.query<{ situacao: string }>('select situacao from public.associados where pessoa_id = $1', [pessoa[2]])
      assert.equal(a.rows[0].situacao, 'desligado')
      const perfil = await db.query("select 1 from public.perfis_acesso where pessoa_id = $1 and perfil = 'ministro' and arquivado_em is null", [pessoa[2]])
      assert.equal(perfil.rows.length, 0)
      const d = await db.query<{ inciso: string }>('select inciso from public.desligamentos')
      assert.deepEqual(d.rows, [{ inciso: 'II' }])
      await assert.rejects(votar(item.desligamento, 0, 2, 0), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })
  })

  describe('falecimento (Art. 8º, V)', () => {
    it('a secretaria registra (sem votação); data no futuro ou o ministro: recusado', async () => {
      await assert.rejects(chamar(m[0], "select public.registrar_falecimento($1, current_date, 'x')", [pessoa[3]]), erroComCodigo(SEM_PERMISSAO))
      await assert.rejects(
        chamar(secretaria, 'select public.registrar_falecimento($1, current_date + 1, null)', [pessoa[3]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(secretaria, 'select public.registrar_falecimento($1, current_date - 2, null)', [pessoa[3]])
      const a = await db.query<{ situacao: string }>('select situacao from public.associados where pessoa_id = $1', [pessoa[3]])
      assert.equal(a.rows[0].situacao, 'falecido')
    })
  })

  describe('ata (Art. 12, §2º, IV e §4º)', () => {
    it('a secretaria redige; o ministro não vê o rascunho', async () => {
      await chamar(secretaria, "select public.salvar_ata($1, 'Ata da assembleia de teste: texto completo.')", [ago])
      const r = await chamar(m[0], 'select id from public.atas')
      assert.equal(r.rows.length, 0)
    })

    it('assinatura: o 1º secretário (Secretaria) e o presidente (Presidência), duas pessoas diferentes', async () => {
      await assert.rejects(chamar(presidencia, "select public.assinar_ata($1, 'secretario')", [ago]), erroComCodigo(SEM_PERMISSAO))
      await chamar(ambos, "select public.assinar_ata($1, 'secretario')", [ago])
      await assert.rejects(chamar(ambos, "select public.assinar_ata($1, 'presidente')", [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      // depois da primeira assinatura, o texto não muda
      await assert.rejects(chamar(secretaria, "select public.salvar_ata($1, 'Outro texto para a ata.')", [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await chamar(presidencia, "select public.assinar_ata($1, 'presidente')", [ago])
    })

    it('assinada: todos com login leem; as votações não mudam mais', async () => {
      const r = await chamar(m[0], 'select texto from public.atas')
      assert.equal(r.rows.length, 1)
      await assert.rejects(votar(item.simples, 0, 2, 0), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(db.query("update public.atas set texto = 'mudado'"), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('o arquivo da ata assinada só entra na pasta da assembleia', async () => {
      await assert.rejects(chamar(secretaria, "select public.anexar_ata($1, 'outra/ata.pdf')", [ago]), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(
        chamar(m[0], "insert into storage.objects (bucket_id, name) values ('atas', $1)", [`${ago}/ata.pdf`]),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })
})
