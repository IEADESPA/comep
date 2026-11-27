// Telas novas, parte 11 (Fase 5.5): as notificações — a tabela com o lido por pessoa, os avisos que nascem quando
// as coisas acontecem (assembleia convocada, votação aberta, pedido de AGE, mural, pedido de associação, comprovante,
// documento da igreja), os avisos com data (60 e 30 dias antes de vencer), as preferências, os aparelhos (push),
// o recado da secretaria, o "Lembrar todos" e o que o envio pega. Rodar: npm test

import type { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { como, criarBanco, criarUsuario, darPerfil, erroComCodigo } from './ambiente.ts'

const SEM_PERMISSAO = '42501'
const BLOQUEADO_PELO_BANCO = 'P0001'

type Notificacao = {
  id: string
  tipo: string
  titulo: string
  texto: string
  link: string | null
  urgente: boolean
  lida_em: string | null
  enviada_por: string | null
}
type Minhas = { itens: Notificacao[]; nao_lidas: number }
type Pendente = { notificacao_id: string; inscricao_id: string; endpoint: string; titulo: string; urgente: boolean }

describe('Fase 5.5, parte 11 — as notificações', () => {
  let db: PGlite
  let secretaria: string
  let tesouraria: string
  let presidencia: string
  let candidato: string
  let igreja: string
  const m: string[] = []
  const pessoa: string[] = []
  let pessoaCandidato: string
  let pessoaSecretaria: string

  const chamar = (quem: string | null, sql: string, params: unknown[] = []) => como(db, quem, () => db.query(sql, params))
  const um = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]
  const minhas = async (quem: string) => ((await chamar(quem, 'select public.minhas_notificacoes(50) as r')).rows[0] as { r: Minhas }).r
  const comChave = async (pessoaId: string, chave: string) =>
    (
      await db.query<{ id: string; titulo: string; texto: string; tipo: string }>(
        'select id, titulo, texto, tipo from public.notificacoes where pessoa_id = $1 and chave = $2',
        [pessoaId, chave],
      )
    ).rows
  const pendentes = async () => (await db.query<Pendente>('select * from interno.push_pendentes(500)')).rows
  const inscrever = (quem: string, endpoint: string) =>
    chamar(
      quem,
      "select public.registrar_inscricao_push($1, 'BOr4qKxS0Pj1t9pZ8sLmQwErTyUiOp1234567890abcdefghijk', 'aBcDeFgHiJkLmNoP', 'Celular · Chrome') as id",
      [endpoint],
    ).then((r) => (r.rows[0] as { id: string }).id)

  before(async () => {
    db = await criarBanco()
    secretaria = await criarUsuario(db, 'secretaria@teste.local', 'Secretaria de Teste')
    tesouraria = await criarUsuario(db, 'tesouraria@teste.local', 'Tesouraria de Teste')
    presidencia = await criarUsuario(db, 'presidencia@teste.local', 'Presidência de Teste')
    candidato = await criarUsuario(db, 'candidato@teste.local', 'Candidato Fictício')
    await darPerfil(db, secretaria, 'secretaria')
    await darPerfil(db, tesouraria, 'tesouraria')
    await darPerfil(db, presidencia, 'presidencia')
    pessoaCandidato = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [candidato])).id
    pessoaSecretaria = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [secretaria])).id
    const denominacao = (await um<{ id: string }>("insert into public.denominacoes (nome) values ('Denominação Fictícia') returning id")).id
    igreja = (
      await um<{ id: string }>("insert into public.igrejas (nome, denominacao_id) values ('Igreja Fictícia dos Avisos', $1) returning id", [
        denominacao,
      ])
    ).id
    for (let i = 1; i <= 3; i++) {
      m.push(await criarUsuario(db, `m${i}@teste.local`, `Associado ${i}`))
      const p = await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [m[i - 1]])
      pessoa.push(p.id)
      await db.query(
        "insert into public.associados (pessoa_id, forma_admissao, admitido_em) values ($1, 'cadastro_inicial', '2021-06-01')",
        [p.id],
      )
      await db.query('insert into public.vinculos_igreja (pessoa_id, igreja_id, pastor_presidente) values ($1, $2, $3)', [
        p.id,
        igreja,
        i === 1,
      ])
    }
    // o 3º está em atraso (duas cobranças vencidas)
    for (const comp of ['2025-07-01', '2025-08-01']) {
      await db.query(
        `insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor)
         values ($1, 2025, 'mensal', $2::date, $2::date + 9, 'nao_presidente', 20)`,
        [pessoa[2], comp],
      )
    }
  })

  describe('a tabela', () => {
    it('ninguém grava direto nem apaga; cada um lê só as suas', async () => {
      await assert.rejects(
        chamar(m[0], "insert into public.notificacoes (pessoa_id, tipo, titulo, texto) values ($1, 'recado', 'Oi', 'Olá, tudo bem?')", [
          pessoa[1],
        ]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await db.query("select interno.notificar(array[$1, $2]::uuid[], 'recado', 'Teste', 'Um aviso de teste.', null, 'teste:1')", [
        pessoa[0],
        pessoa[1],
      ])
      // a mesma chave não repete
      const repetida = await um<{ n: number }>(
        "select interno.notificar(array[$1]::uuid[], 'recado', 'Teste', 'De novo.', null, 'teste:1') as n",
        [pessoa[0]],
      )
      assert.equal(repetida.n, 0)
      const deM1 = await chamar(m[0], 'select pessoa_id from public.notificacoes')
      assert.ok(deM1.rows.length >= 1)
      assert.ok(deM1.rows.every((r) => (r as { pessoa_id: string }).pessoa_id === pessoa[0]))
      assert.equal((await chamar(null, 'select 1 from public.notificacoes').catch(() => ({ rows: [] }))).rows.length, 0)
      await assert.rejects(db.query("delete from public.notificacoes where chave = 'teste:1'"), erroComCodigo(BLOQUEADO_PELO_BANCO))
      await assert.rejects(chamar(m[0], 'update public.notificacoes set lida_em = now()'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o sino lê da tabela e o lido fica por pessoa (marcar uma, marcar todas, só as minhas)', async () => {
      const antes = await minhas(m[0])
      const teste = antes.itens.find((n) => n.titulo === 'Teste')!
      assert.equal(teste.lida_em, null)
      assert.ok(antes.nao_lidas >= 1)
      // marcar a notificação de outra pessoa não faz nada
      const deM2 = await comChave(pessoa[1], 'teste:1')
      assert.equal(((await chamar(m[0], 'select public.marcar_notificacoes_lidas($1) as n', [[deM2[0].id]])).rows[0] as { n: number }).n, 0)
      assert.equal(((await chamar(m[0], 'select public.marcar_notificacoes_lidas($1) as n', [[teste.id]])).rows[0] as { n: number }).n, 1)
      assert.notEqual((await minhas(m[0])).itens.find((n) => n.id === teste.id)!.lida_em, null)
      // a do 2º continua não lida
      assert.equal((await minhas(m[1])).itens.find((n) => n.titulo === 'Teste')!.lida_em, null)
      await chamar(m[1], 'select public.marcar_notificacoes_lidas(null)')
      assert.equal((await minhas(m[1])).nao_lidas, 0)
      await assert.rejects(chamar(null, 'select public.minhas_notificacoes(10)'), erroComCodigo(SEM_PERMISSAO))
    })
  })

  describe('os avisos nascem quando as coisas acontecem', () => {
    it('a assembleia convocada avisa todos os associados', async () => {
      const id = (
        await um<{ id: string }>(
          "insert into public.encontros (tipo, titulo, inicio, local) values ('ago', 'AGO de teste', now() + interval '20 days', 'Sede do COMEP') returning id",
        )
      ).id
      assert.equal((await comChave(pessoa[0], `encontro:${id}`)).length, 0, 'em rascunho ainda não avisa')
      await db.query("update public.encontros set situacao = 'convocado', convocado_em = now() where id = $1", [id])
      for (const p of pessoa) {
        const [n] = await comChave(p, `encontro:${id}`)
        assert.equal(n.titulo, 'AGO convocada')
        assert.match(n.texto, /^Assembleia Geral Ordinária em \d\d\/\d\d, às \d{1,2}h(\d\d)?, Sede do COMEP\. Confirme a presença\.$/)
      }
      // quem não é associado não recebe
      assert.equal((await comChave(pessoaCandidato, `encontro:${id}`)).length, 0)
      // convocar de novo (cancelada e convocada) não repete
      await db.query("update public.encontros set situacao = 'agendado' where id = $1", [id])
      await db.query("update public.encontros set situacao = 'convocado' where id = $1", [id])
      assert.equal((await comChave(pessoa[0], `encontro:${id}`)).length, 1)
    })

    it('a votação aberta avisa só quem pode votar (o em atraso fica de fora da votação dos em dia)', async () => {
      const id = (
        await chamar(secretaria, 'select public.salvar_votacao(null, $1::jsonb) as id', [
          JSON.stringify({ tipo: 'enquete', titulo: 'Qual o melhor dia?', quem_vota: 'em_dia', opcoes: ['Segunda', 'Terça'] }),
        ])
      ).rows[0] as { id: string }
      await chamar(secretaria, 'select public.abrir_votacao($1)', [id.id])
      assert.equal((await comChave(pessoa[0], `votacao:${id.id}`))[0].titulo, 'Enquete aberta')
      assert.equal((await comChave(pessoa[1], `votacao:${id.id}`)).length, 1)
      assert.equal((await comChave(pessoa[2], `votacao:${id.id}`)).length, 0, 'o em atraso não vota')
    })

    it('o pedido de AGE avisa quem pode assinar, menos quem abriu', async () => {
      const id = (
        await chamar(m[0], 'select public.criar_pedido_age($1::jsonb) as id', [
          JSON.stringify({
            titulo: 'Reforma do estatuto',
            justificativa: 'Precisamos atualizar o estatuto do COMEP.',
            pauta: [{ titulo: 'Reforma do estatuto', descricao: 'Permitir a votação on-line' }],
          }),
        ])
      ).rows[0] as { id: string }
      assert.equal((await comChave(pessoa[0], `age:${id.id}`)).length, 0, 'quem abriu não recebe')
      assert.match(
        (await comChave(pessoa[1], `age:${id.id}`))[0].texto,
        /^Reforma do estatuto: falta a sua assinatura \(até \d\d\/\d\d\/\d{4}\)\.$/,
      )
      assert.equal((await comChave(pessoa[2], `age:${id.id}`)).length, 0, 'o em atraso não assina')
    })

    it('o aviso novo no mural chega a quem é do COMEP (menos a secretaria que publicou)', async () => {
      const id = (
        await chamar(secretaria, 'select public.salvar_aviso(null, $1::jsonb) as id', [
          JSON.stringify({ titulo: 'Recadastramento até o fim do mês', texto: 'Atualize os seus dados.' }),
        ])
      ).rows[0] as { id: string }
      assert.equal((await comChave(pessoa[1], `aviso:${id.id}`))[0].texto, 'Recadastramento até o fim do mês')
      const tes = (await um<{ id: string }>('select id from public.pessoas where usuario_id = $1', [tesouraria])).id
      assert.equal((await comChave(tes, `aviso:${id.id}`)).length, 1)
      assert.equal((await comChave(pessoaSecretaria, `aviso:${id.id}`)).length, 0)
      assert.equal((await comChave(pessoaCandidato, `aviso:${id.id}`)).length, 0, 'quem não tem perfil não lê o mural')
    })

    it('a pendência no pedido de associação avisa quem pediu (cada pendência, um aviso)', async () => {
      // o cenário vem direto do dono do banco (as regras do pedido são testadas em pedido.test.ts)
      await db.exec('alter table public.pedidos_associacao disable trigger regras_pedido')
      const pedido = (
        await um<{ id: string }>(
          "insert into public.pedidos_associacao (pessoa_id, situacao, enviado_em) values ($1, 'enviado', now()) returning id",
          [pessoaCandidato],
        )
      ).id
      await db.query(
        "update public.pedidos_associacao set situacao = 'pendencia', mensagem_pendencia = 'Falta a foto 3x4.' where id = $1",
        [pedido],
      )
      let lista = await minhas(candidato)
      assert.equal(lista.itens.filter((n) => n.tipo === 'pedido').length, 1)
      assert.equal(lista.itens.find((n) => n.tipo === 'pedido')!.texto, 'Falta a foto 3x4.')
      await db.query("update public.pedidos_associacao set situacao = 'enviado' where id = $1", [pedido])
      await db.query(
        "update public.pedidos_associacao set situacao = 'pendencia', mensagem_pendencia = 'Falta o comprovante.' where id = $1",
        [pedido],
      )
      await db.exec('alter table public.pedidos_associacao enable trigger regras_pedido')
      lista = await minhas(candidato)
      assert.equal(lista.itens.filter((n) => n.tipo === 'pedido').length, 2)
    })

    it('o comprovante conferido avisa quem pagou (confirmado ou não)', async () => {
      const cobranca = (
        await um<{ id: string }>(
          "insert into public.cobrancas (pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor) values ($1, 2026, 'mensal', '2026-10-01', current_date + 30, 'nao_presidente', 1234.5) returning id",
          [pessoa[1]],
        )
      ).id
      const informe = (
        await um<{ id: string }>(
          "insert into public.informes_pagamento (cobranca_id, pessoa_id, data_pagamento, valor, forma) values ($1, $2, '2026-10-05', 1234.5, 'PIX') returning id",
          [cobranca, pessoa[1]],
        )
      ).id
      await db.query(
        "update public.informes_pagamento set situacao = 'recusado', motivo_recusa = 'O comprovante está ilegível' where id = $1",
        [informe],
      )
      const [n] = await comChave(pessoa[1], `informe:${informe}:recusado`)
      assert.equal(n.titulo, 'Comprovante não confirmado')
      assert.equal(n.texto, 'A tesouraria não confirmou o pagamento de R$ 1.234,50: O comprovante está ilegível.')
      assert.equal(n.tipo, 'mensalidade')
    })
  })

  describe('os avisos com data (uma vez por dia)', () => {
    async function regularizar(alvaraAte: number) {
      await db.query("update public.igrejas set natureza_juridica = 'organizacao_religiosa' where id = $1", [igreja])
      await db.query('update public.igreja_documentos set arquivado_em = now() where igreja_id = $1 and arquivado_em is null', [igreja])
      for (const [tipo, de, ate, natureza] of [
        ['estatuto', null, null, null],
        ['cartao_cnpj', null, null, 'organizacao_religiosa'],
        ['ata_diretoria', -300, 800, null],
        ['alvara', -300, alvaraAte, null],
      ] as const) {
        await db.query(
          `insert into public.igreja_documentos (igreja_id, tipo, arquivo_caminho, situacao, valido_de, valido_ate, natureza, conferido_em)
           values ($1::uuid, $2::public.tipo_documento_igreja, $1::text || '/semente-' || gen_random_uuid() || '.pdf', 'conferido',
                   current_date + $3::int, current_date + $4::int, $5, now())`,
          [igreja, tipo, de, ate, natureza],
        )
      }
    }

    it('o alvará perto de vencer avisa o pastor presidente aos 60 e aos 30 dias, uma vez só', async () => {
      await regularizar(45)
      await db.query('select interno.gerar_avisos_do_dia(true)')
      const sessenta = await db.query<{ titulo: string; link: string; chave: string }>(
        "select titulo, link, chave from public.notificacoes where pessoa_id = $1 and chave like 'igreja-vence:%'",
        [pessoa[0]],
      )
      assert.equal(sessenta.rows.length, 1)
      assert.equal(sessenta.rows[0].titulo, 'Alvará vence em 45 dias')
      assert.equal(sessenta.rows[0].link, '/minha-igreja/documentos/alvara/atualizar')
      assert.match(sessenta.rows[0].chave, /:60$/)
      // o ministro da igreja (que não é o pastor presidente) não recebe
      assert.equal(
        (await db.query("select 1 from public.notificacoes where pessoa_id = $1 and chave like 'igreja-vence:%'", [pessoa[1]])).rows.length,
        0,
      )
      // rodar de novo no mesmo dia não repete; sem forçar, nem roda
      assert.equal((await um<{ n: number }>('select interno.gerar_avisos_do_dia(true) as n')).n, 0)
      assert.equal((await um<{ n: number }>('select interno.gerar_avisos_do_dia() as n')).n, 0)
      // aos 30 dias, outro aviso
      await regularizar(20)
      await db.query('select interno.gerar_avisos_do_dia(true)')
      const todos = await db.query<{ chave: string }>(
        "select chave from public.notificacoes where pessoa_id = $1 and chave like 'igreja-vence:%' order by criado_em",
        [pessoa[0]],
      )
      assert.equal(todos.rows.length, 2)
      assert.match(todos.rows[1].chave, /:30$/)
    })
  })

  describe('as preferências e os aparelhos', () => {
    it('a resposta do primeiro acesso, o que chega e o silêncio à noite', async () => {
      const pref = async (quem: string) =>
        ((await chamar(quem, 'select public.minhas_preferencias_avisos() as p')).rows[0] as { p: Record<string, unknown> }).p
      assert.equal((await pref(m[1])).ativou_em, null)
      await chamar(m[1], `select public.salvar_preferencias_avisos('{"resposta": "agora_nao"}'::jsonb)`)
      assert.notEqual((await pref(m[1])).recusou_em, null)
      await chamar(m[1], `select public.salvar_preferencias_avisos('{"tipos_desligados": ["mural"], "silencio_noite": false}'::jsonb)`)
      const p = await pref(m[1])
      assert.deepEqual(p.tipos_desligados, ['mural'])
      assert.equal(p.silencio_noite, false)
      await assert.rejects(
        chamar(m[1], `select public.salvar_preferencias_avisos('{"tipos_desligados": ["recado"]}'::jsonb)`),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(m[1], `select public.salvar_preferencias_avisos('{"resposta": "talvez"}'::jsonb)`),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
    })

    it('o aparelho inscrito ativa os avisos; o mesmo aparelho com outra pessoa passa para ela; cada um vê só os seus', async () => {
      await inscrever(m[0], 'https://fcm.googleapis.com/fcm/send/aparelho-1')
      const p = (await chamar(m[0], 'select public.minhas_preferencias_avisos() as p')).rows[0] as {
        p: { ativou_em: string | null; aparelhos: unknown[] }
      }
      assert.notEqual(p.p.ativou_em, null)
      assert.equal(p.p.aparelhos.length, 1)
      // o computador da sede: entrou outra pessoa no mesmo navegador
      await inscrever(m[1], 'https://fcm.googleapis.com/fcm/send/aparelho-1')
      assert.equal((await chamar(m[0], 'select 1 from public.inscricoes_push where arquivado_em is null')).rows.length, 0)
      assert.equal((await chamar(m[1], 'select 1 from public.inscricoes_push where arquivado_em is null')).rows.length, 1)
      await assert.rejects(
        chamar(
          m[0],
          "select public.registrar_inscricao_push('http://inseguro.test/x', 'BOr4qKxS0Pj1t9pZ8sLmQwErTyUiOp1234567890', 'aBcDeFgHiJkL', null)",
        ),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await inscrever(m[0], 'https://fcm.googleapis.com/fcm/send/aparelho-2')
      await assert.rejects(chamar(m[0], 'select endpoint from public.push_pendentes(10)'), erroComCodigo(SEM_PERMISSAO))
    })

    it('o envio pega só quem ativou, o assunto ligado, não lido; o resultado marca o envio e arquiva o aparelho que acabou', async () => {
      // sem o silêncio da noite, para o teste valer a qualquer hora
      await chamar(m[0], `select public.salvar_preferencias_avisos('{"silencio_noite": false}'::jsonb)`)
      await db.query(
        "select interno.notificar(array[$1, $2]::uuid[], 'mural', 'Aviso no mural', 'Um aviso do mural.', '/avisos', 'mural:envio')",
        [pessoa[0], pessoa[1]],
      )
      await db.query("select interno.notificar(array[$1, $2]::uuid[], 'recado', 'Recado', 'Um recado.', null, 'recado:envio')", [
        pessoa[0],
        pessoa[1],
      ])
      await db.query("select interno.notificar(array[$1]::uuid[], 'recado', 'Recado', 'Para quem não ativou.', null, 'recado:envio')", [
        pessoa[2],
      ])
      // o lote leva no máximo 3 avisos de cada pessoa (revisão de segurança, S1-01): os avisos dos testes de cima já
      // foram mandados, e ficam na fila só os deste teste
      await db.query(
        "update public.notificacoes set push_enviado_em = now() where pessoa_id = any($1::uuid[]) and coalesce(chave, '') not in ('mural:envio', 'recado:envio')",
        [[pessoa[0], pessoa[1]]],
      )
      const lista = await pendentes()
      const ids = async (p: string, chave: string) => (await comChave(p, chave))[0].id
      const doM1Mural = await ids(pessoa[0], 'mural:envio')
      const doM2Mural = await ids(pessoa[1], 'mural:envio')
      const doM2Recado = await ids(pessoa[1], 'recado:envio')
      const doM3 = await ids(pessoa[2], 'recado:envio')
      assert.ok(lista.some((l) => l.notificacao_id === doM1Mural))
      assert.ok(!lista.some((l) => l.notificacao_id === doM2Mural), 'o 2º desligou o mural')
      assert.ok(
        lista.some((l) => l.notificacao_id === doM2Recado),
        'o recado chega sempre',
      )
      assert.ok(!lista.some((l) => l.notificacao_id === doM3), 'o 3º não ativou')
      // lido no sino antes de enviar: não manda mais
      await chamar(m[1], 'select public.marcar_notificacoes_lidas($1)', [[doM2Recado]])
      assert.ok(!(await pendentes()).some((l) => l.notificacao_id === doM2Recado))

      const doM1 = lista.filter((l) => l.notificacao_id === doM1Mural)
      assert.equal(doM1.length, 1, 'só o aparelho 2 do 1º (o 1 passou para o 2º)')
      await db.query('select interno.push_resultado($1::jsonb)', [
        JSON.stringify([{ notificacao_id: doM1Mural, inscricao_id: doM1[0].inscricao_id, ok: false, status: 410 }]),
      ])
      const ap = await um<{ motivo_arquivo: string }>('select motivo_arquivo from public.inscricoes_push where id = $1', [
        doM1[0].inscricao_id,
      ])
      assert.equal(ap.motivo_arquivo, 'expirou')
      assert.ok(!(await pendentes()).some((l) => l.notificacao_id === doM1Mural), 'sem aparelho, nada a mandar')
      // o que deu certo fica marcado
      const doM2 = (await pendentes()).find((l) => l.endpoint === 'https://fcm.googleapis.com/fcm/send/aparelho-1')
      if (doM2) {
        await db.query('select interno.push_resultado($1::jsonb)', [
          JSON.stringify([{ notificacao_id: doM2.notificacao_id, inscricao_id: doM2.inscricao_id, ok: true, status: 201 }]),
        ])
        assert.notEqual(
          (await um<{ e: string | null }>('select push_enviado_em as e from public.notificacoes where id = $1', [doM2.notificacao_id])).e,
          null,
        )
      }
    })
  })

  describe('a secretaria fala com a pessoa', () => {
    it('"Mandar pelo aplicativo": só a secretaria, a tesouraria e a presidência; chega no sino com quem mandou', async () => {
      await assert.rejects(
        chamar(m[0], "select public.mandar_recado($1, 'recado', 'Oi', 'Olá, tudo bem com você?')", [pessoa[1]]),
        erroComCodigo(SEM_PERMISSAO),
      )
      await assert.rejects(
        chamar(secretaria, "select public.mandar_recado($1, 'mural', 'Oi', 'Olá, tudo bem com você?')", [pessoa[1]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await assert.rejects(
        chamar(secretaria, "select public.mandar_recado($1, 'recado', 'Oi', '   ')", [pessoa[1]]),
        erroComCodigo(BLOQUEADO_PELO_BANCO),
      )
      await chamar(
        secretaria,
        "select public.mandar_recado($1, 'mensalidade', 'Lembrete da contribuição', 'Olá! A sua contribuição está em aberto.')",
        [pessoa[2]],
      )
      const n = (await minhas(m[2])).itens.find((x) => x.titulo === 'Lembrete da contribuição')!
      assert.equal(n.enviada_por, 'Secretaria de Teste')
      assert.equal(n.link, '/minhas-mensalidades')
    })

    it('"Lembrar todos": só quem está em atraso, uma vez por dia; só a tesouraria e a presidência', async () => {
      await assert.rejects(chamar(secretaria, 'select public.lembrar_contribuicoes_em_atraso()'), erroComCodigo(SEM_PERMISSAO))
      const n = ((await chamar(tesouraria, 'select public.lembrar_contribuicoes_em_atraso() as n')).rows[0] as { n: number }).n
      assert.equal(n, 1)
      const [aviso] = (await minhas(m[2])).itens.filter((x) => x.titulo === 'Contribuição em atraso')
      assert.equal(
        aviso.texto,
        'Você tem 2 contribuições vencidas, desde julho de 2025. Em Minhas mensalidades você vê os valores e manda o comprovante.',
      )
      assert.equal(
        ((await chamar(presidencia, 'select public.lembrar_contribuicoes_em_atraso() as n')).rows[0] as { n: number }).n,
        0,
        'no mesmo dia não repete',
      )
      assert.equal((await minhas(m[0])).itens.filter((x) => x.titulo === 'Contribuição em atraso').length, 0)
    })

    it('a situação dos avisos é da secretaria, da presidência e do administrador técnico', async () => {
      await assert.rejects(chamar(m[0], 'select public.situacao_dos_avisos()'), erroComCodigo(SEM_PERMISSAO))
      const s = (
        (await chamar(secretaria, 'select public.situacao_dos_avisos() as s')).rows[0] as { s: { ativaram: number; aparelhos: number } }
      ).s
      assert.ok(s.ativaram >= 2)
      assert.ok(s.aparelhos >= 1)
    })
  })
})
