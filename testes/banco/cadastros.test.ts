// Testes da Fase 1.1: denominações, igrejas, títulos e associados.
// Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'
const REGRA_VIOLADA = '23514'
const DUPLICADO = '23505'

// CNPJs válidos (só para teste): numérico e alfanumérico (exemplo oficial da Receita Federal).
const CNPJ_NUMERICO = '11222333000181'
const CNPJ_ALFANUMERICO = '12ABC34501DE35'

describe('Fase 1.1 — cadastros', () => {
  let db: PGlite
  let presidente: string
  let secretaria: string
  let tesoureiro: string
  let ministro: string
  let semPerfil: string
  let denominacaoId: string
  let igrejaA: string
  let igrejaB: string
  let tituloPastor: string
  let tituloEvangelista: string
  let pessoaCadastrada: string

  async function pessoaDe(usuarioId: string): Promise<string> {
    const r = await db.query<{ id: string }>('select id from public.pessoas where usuario_id = $1', [usuarioId])
    return r.rows[0].id
  }

  async function cadastrarAssociado(quem: string, nome: string, igrejaId: string | null = igrejaA): Promise<string> {
    const r = await como(db, quem, () =>
      db.query<{ id: string }>(
        `select public.cadastrar_associado($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) as id`,
        [nome, null, '(94) 90000-0000', tituloPastor, '2010-03-15', igrejaId, 'Pastor auxiliar', '2015-01-01', null, null, false, false],
      ),
    )
    return r.rows[0].id
  }

  before(async () => {
    db = await criarBanco()
    presidente = await criarUsuario(db, 'presidente@teste.local', 'Presidente de Teste')
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretária de Teste')
    tesoureiro = await criarUsuario(db, 'tesoureiro@teste.local', 'Tesoureiro de Teste')
    ministro = await criarUsuario(db, 'ministro@teste.local', 'Ministro com Login')
    semPerfil = await criarUsuario(db, 'semperfil@teste.local', 'Sem Perfil')
    await darPerfil(db, presidente, 'presidencia')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, tesoureiro, 'tesouraria')

    const titulos = await db.query<{ id: string; nome: string }>('select id, nome from public.titulos_ministeriais')
    tituloPastor = titulos.rows.find((t) => t.nome === 'Pastor(a)')!.id
    tituloEvangelista = titulos.rows.find((t) => t.nome === 'Evangelista')!.id
  })

  describe('listas (denominações, títulos, igrejas)', () => {
    it('vem com a lista de títulos aprovada pela diretoria (decisão 9)', async () => {
      const r = await db.query<{ nome: string }>('select nome from public.titulos_ministeriais where arquivado_em is null order by ordem')
      assert.deepEqual(
        r.rows.map((t) => t.nome),
        ['Pastor(a)', 'Evangelista', 'Presbítero', 'Apóstolo(a)', 'Bispo(a)'],
      )
    })

    it('a secretaria cadastra denominação e igrejas', async () => {
      const d = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          "insert into public.denominacoes (nome, sigla) values ('Denominação de Teste', 'DT') returning id",
        ),
      )
      denominacaoId = d.rows[0].id
      const a = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          'insert into public.igrejas (nome, denominacao_id, cnpj) values ($1, $2, $3) returning id',
          ['Igreja A', denominacaoId, CNPJ_NUMERICO],
        ),
      )
      igrejaA = a.rows[0].id
      const b = await como(db, secretaria, () =>
        db.query<{ id: string }>(
          'insert into public.igrejas (nome, denominacao_id, cnpj) values ($1, $2, $3) returning id',
          ['Igreja B', denominacaoId, CNPJ_ALFANUMERICO],
        ),
      )
      igrejaB = b.rows[0].id
    })

    it('recusa CNPJ inválido', async () => {
      for (const cnpj of ['11222333000182', '11111111111111', '1122233300018', '11.222.333/0001-81']) {
        await assert.rejects(
          como(db, secretaria, () =>
            db.query("insert into public.igrejas (nome, cnpj) values ('Igreja X', $1)", [cnpj]),
          ),
          erroComCodigo(REGRA_VIOLADA),
          `aceitou o CNPJ ${cnpj}`,
        )
      }
    })

    it('recusa o mesmo CNPJ em duas igrejas', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("insert into public.igrejas (nome, cnpj) values ('Igreja Repetida', $1)", [CNPJ_NUMERICO]),
        ),
        erroComCodigo(DUPLICADO),
      )
    })

    it('recusa denominação com nome repetido (ignorando maiúsculas)', async () => {
      await assert.rejects(
        como(db, secretaria, () => db.query("insert into public.denominacoes (nome) values ('denominação de teste')")),
        erroComCodigo(DUPLICADO),
      )
    })

    it('quem tem login lê as listas, mas sem perfil de secretaria não cadastra', async () => {
      const r = await como(db, semPerfil, () => db.query('select id from public.igrejas'))
      assert.equal(r.rows.length, 2)
      for (const usuario of [semPerfil, tesoureiro]) {
        await assert.rejects(
          como(db, usuario, () => db.query("insert into public.igrejas (nome) values ('Igreja Indevida')")),
          erroComCodigo(SEM_PERMISSAO),
        )
      }
      const alterou = await como(db, tesoureiro, () =>
        db.query("update public.igrejas set nome = 'Invadida' where id = $1", [igrejaA]),
      )
      assert.equal(alterou.affectedRows, 0)
    })

    it('visitante (sem login) não lê nenhuma das tabelas novas', async () => {
      for (const tabela of [
        'denominacoes',
        'titulos_ministeriais',
        'igrejas',
        'associados',
        'titulos_pessoa',
        'vinculos_igreja',
        'vw_associados',
      ]) {
        await assert.rejects(
          como(db, null, () => db.query(`select * from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
          `visitante conseguiu ler ${tabela}`,
        )
      }
    })
  })

  describe('cadastro direto de associado (Art. 7º, a)', () => {
    it('a secretaria cadastra um associado atual de uma vez (pessoa, título e igreja)', async () => {
      pessoaCadastrada = await cadastrarAssociado(secretaria, 'Pr. Associado Antigo')
      const r = await como(db, secretaria, () =>
        db.query<{ nome: string; titulo: string; igreja: string; numero_registro: number; tem_login: boolean }>(
          'select nome, titulo, igreja, numero_registro, tem_login from public.vw_associados where pessoa_id = $1',
          [pessoaCadastrada],
        ),
      )
      assert.deepEqual(r.rows, [
        { nome: 'Pr. Associado Antigo', titulo: 'Pastor(a)', igreja: 'Igreja A', numero_registro: 1, tem_login: false },
      ])
    })

    it('o associado ganha o perfil "ministro" automaticamente', async () => {
      const r = await db.query<{ perfil: string }>(
        'select perfil from public.perfis_acesso where pessoa_id = $1 and arquivado_em is null',
        [pessoaCadastrada],
      )
      assert.deepEqual(
        r.rows.map((p) => p.perfil),
        ['ministro'],
      )
    })

    it('exige título e igreja', async () => {
      await assert.rejects(cadastrarAssociado(secretaria, 'Sem Igreja', null), erroComCodigo(BLOQUEADO_PELO_BANCO))
    })

    it('ministro, tesouraria e quem não tem perfil não cadastram associados', async () => {
      for (const usuario of [ministro, tesoureiro, semPerfil]) {
        await assert.rejects(cadastrarAssociado(usuario, 'Indevido'), erroComCodigo(SEM_PERMISSAO))
      }
    })

    it('a tesouraria vê a lista de associados (vai precisar para as contribuições)', async () => {
      const r = await como(db, tesoureiro, () => db.query('select id from public.vw_associados'))
      assert.equal(r.rows.length, 1)
    })

    it('a auditoria registra quem cadastrou', async () => {
      const r = await db.query<{ tabela: string }>(
        `select distinct tabela from public.auditoria
         where usuario_id = $1 and operacao = 'INSERT' and tabela in ('pessoas', 'associados', 'titulos_pessoa', 'vinculos_igreja', 'perfis_acesso')
         order by tabela`,
        [secretaria],
      )
      assert.deepEqual(
        r.rows.map((l) => l.tabela),
        ['associados', 'perfis_acesso', 'pessoas', 'titulos_pessoa', 'vinculos_igreja'],
      )
    })

    it('a secretaria corrige o e-mail de quem ainda não tem login', async () => {
      const r = await como(db, secretaria, () =>
        db.query("update public.pessoas set email = 'antigo@teste.local' where id = $1", [pessoaCadastrada]),
      )
      assert.equal(r.affectedRows, 1)
    })

    it('o e-mail de quem já tem login não é trocado por aqui', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("update public.pessoas set email = 'outro@teste.local' where usuario_id = $1", [ministro]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })
  })

  describe('títulos e igrejas: histórico', () => {
    it('novo título: o atual passa a ser o último registrado', async () => {
      await como(db, secretaria, () =>
        db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [
          pessoaCadastrada,
          tituloEvangelista,
        ]),
      )
      const r = await db.query<{ titulo: string }>('select titulo from public.vw_associados where pessoa_id = $1', [
        pessoaCadastrada,
      ])
      assert.equal(r.rows[0].titulo, 'Evangelista')
    })

    it('troca de igreja encerra o vínculo anterior e abre o novo', async () => {
      await como(db, secretaria, () =>
        db.query("select public.mudar_igreja($1, $2, 'Pastor auxiliar', '2026-01-10', false)", [pessoaCadastrada, igrejaB]),
      )
      const r = await db.query<{ igreja: string; fim: string | null }>(
        `select i.nome as igreja, v.fim::text as fim
         from public.vinculos_igreja v join public.igrejas i on i.id = v.igreja_id
         where v.pessoa_id = $1 order by v.criado_em`,
        [pessoaCadastrada],
      )
      assert.deepEqual(r.rows, [
        { igreja: 'Igreja A', fim: '2026-01-10' },
        { igreja: 'Igreja B', fim: null },
      ])
    })

    it('não deixa trocar para a mesma igreja', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query("select public.mudar_igreja($1, $2, null, '2026-02-01', false)", [pessoaCadastrada, igrejaB]),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('não deixa a pessoa ter dois vínculos atuais', async () => {
      await assert.rejects(
        como(db, secretaria, () =>
          db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [pessoaCadastrada, igrejaA]),
        ),
        erroComCodigo(DUPLICADO),
      )
    })

    it('ministro não registra troca de igreja', async () => {
      await assert.rejects(
        como(db, ministro, () => db.query('select public.mudar_igreja($1, $2, null, null, false)', [pessoaCadastrada, igrejaA])),
        erroComCodigo(SEM_PERMISSAO),
      )
    })
  })

  describe('cada ministro vê só o que é seu', () => {
    it('ministro com login vê o próprio cadastro de associado, e nada dos outros', async () => {
      // Associado com login (cadastrado direto pelo dono do banco, como faria a Fase 1.2)
      const minhaPessoa = await pessoaDe(ministro)
      await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [
        minhaPessoa,
      ])
      await db.query('insert into public.titulos_pessoa (pessoa_id, titulo_id) values ($1, $2)', [minhaPessoa, tituloPastor])
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id) values ($1, $2)', [minhaPessoa, igrejaA])

      const associados = await como(db, ministro, () =>
        db.query<{ nome: string }>('select nome from public.vw_associados'),
      )
      assert.deepEqual(
        associados.rows.map((a) => a.nome),
        ['Ministro com Login'],
      )
      for (const tabela of ['associados', 'titulos_pessoa', 'vinculos_igreja']) {
        const r = await como(db, ministro, () =>
          db.query<{ pessoa_id: string }>(`select pessoa_id from public.${tabela}`),
        )
        assert.ok(
          r.rows.every((l) => l.pessoa_id === minhaPessoa),
          `o ministro viu linhas de outra pessoa em ${tabela}`,
        )
      }
    })

    it('ministro não altera o próprio cadastro de associado (nem o número de registro)', async () => {
      const minhaPessoa = await pessoaDe(ministro)
      const r = await como(db, ministro, () =>
        db.query("update public.associados set observacoes = 'mudei' where pessoa_id = $1", [minhaPessoa]),
      )
      assert.equal(r.affectedRows, 0)
      // O número de registro é gerado pelo banco e ninguém o altera (nem a secretaria)
      await assert.rejects(
        como(db, secretaria, () => db.query('update public.associados set numero_registro = 999')),
        (erro: unknown) => ['42501', '428C9'].includes((erro as { code?: string }).code ?? ''),
      )
    })
  })

  describe('arquivar cadastro feito por engano', () => {
    it('arquivar o associado retira o perfil "ministro", o tira da lista e arquiva a pessoa sem login', async () => {
      await como(db, secretaria, () =>
        db.query('update public.associados set arquivado_em = now() where pessoa_id = $1', [pessoaCadastrada]),
      )
      const perfis = await db.query('select id from public.perfis_acesso where pessoa_id = $1 and arquivado_em is null', [
        pessoaCadastrada,
      ])
      assert.equal(perfis.rows.length, 0)
      const lista = await como(db, secretaria, () =>
        db.query('select id from public.vw_associados where pessoa_id = $1', [pessoaCadastrada]),
      )
      assert.equal(lista.rows.length, 0)
      const pessoa = await db.query<{ arquivada: boolean }>(
        'select arquivado_em is not null as arquivada from public.pessoas where id = $1',
        [pessoaCadastrada],
      )
      assert.equal(pessoa.rows[0].arquivada, true, 'a pessoa sem login deveria ser arquivada junto')
    })

    it('quem tem login não é arquivado junto e pode ser cadastrado de novo', async () => {
      const minhaPessoa = await pessoaDe(ministro)
      await como(db, secretaria, () =>
        db.query('update public.associados set arquivado_em = now() where pessoa_id = $1', [minhaPessoa]),
      )
      const pessoa = await db.query<{ arquivada: boolean }>(
        'select arquivado_em is not null as arquivada from public.pessoas where id = $1',
        [minhaPessoa],
      )
      assert.equal(pessoa.rows[0].arquivada, false)
      const r = await como(db, secretaria, () =>
        db.query<{ numero_registro: number }>(
          "insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial') returning numero_registro",
          [minhaPessoa],
        ),
      )
      assert.ok(r.rows[0].numero_registro > 2)
    })
  })

  describe('perfis de acesso', () => {
    it('não é possível retirar o último perfil de Presidência', async () => {
      const pessoaPresidente = await pessoaDe(presidente)
      await assert.rejects(
        como(db, presidente, () =>
          db.query(
            "update public.perfis_acesso set arquivado_em = now() where perfil = 'presidencia' and pessoa_id = $1",
            [pessoaPresidente],
          ),
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('com outra pessoa na Presidência, a retirada é permitida', async () => {
      const pessoaSecretaria = await pessoaDe(secretaria)
      // Perfis da diretoria só para associados ativos
      await db.query("insert into public.associados (pessoa_id, forma_admissao) values ($1, 'cadastro_inicial')", [
        pessoaSecretaria,
      ])
      await como(db, presidente, () =>
        db.query("insert into public.perfis_acesso (pessoa_id, perfil) values ($1, 'presidencia')", [
          pessoaSecretaria,
        ]),
      )
      const r = await como(db, presidente, () =>
        db.query(
          "update public.perfis_acesso set arquivado_em = now() where perfil = 'presidencia' and pessoa_id = $1",
          [pessoaSecretaria],
        ),
      )
      assert.equal(r.affectedRows, 1)
    })
  })

  describe('nada se apaga', () => {
    it('ninguém apaga pela API, nem o dono do banco', async () => {
      for (const tabela of [
        'denominacoes',
        'titulos_ministeriais',
        'igrejas',
        'associados',
        'titulos_pessoa',
        'vinculos_igreja',
      ]) {
        await assert.rejects(
          como(db, presidente, () => db.query(`delete from public.${tabela}`)),
          erroComCodigo(SEM_PERMISSAO),
          `a presidência apagou em ${tabela}`,
        )
        await assert.rejects(
          db.query(`delete from public.${tabela}`),
          erroComCodigo(BLOQUEADO_PELO_BANCO),
          `o dono do banco apagou em ${tabela}`,
        )
      }
    })
  })
})
