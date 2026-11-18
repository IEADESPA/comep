// Resumos das telas novas (Fase 5.5): o "Precisa de você" do Início, a agenda dos próximos dias e os
// avisos do sino. Tudo vem das funções que o sistema já tinha (src/dados): nada novo no banco.
// Cada parte que falhar (ou que o perfil não pode ver) só fica de fora; o resto aparece.
import type { Area, NomeIcone } from '../componentes/Icone'
import { ITENS_MENU, perfisEfetivos, podeVer } from '../componentes/menu'
import { listarAvisos } from '../dados/avisos'
import { despesasAguardando } from '../dados/caixa'
import type { Resultado } from '../dados/cliente'
import { listarEncontros, minhaParticipacao, minhasFaltas, NOME_DO_TIPO, SIGLA_DO_TIPO, listarJustificativas } from '../dados/encontros'
import { listarEventos } from '../dados/eventos'
import { cobrancasEmAbertoDe, informesPendentes, situacaoDe } from '../dados/financeiro'
import { listarPedidosCorrecao } from '../dados/igrejas'
import { listarEmprestimos } from '../dados/patrimonio'
import { listarPedidos, meuPedido } from '../dados/pedidos'
import { listarPedidosAge } from '../dados/pedidosAge'
import type { MinhaConta, Perfil } from '../dados/perfis'
import { trocasPendentes } from '../dados/portal'
import { listarVotacoes } from '../dados/votacoes'
import { diaMes, formatarData, horaCurta, hojeIso } from '../utilitarios/formatos'

/** Busca e devolve só os dados (ou null, se deu erro): uma parte que falha não derruba as outras. */
async function seguro<T>(busca: () => Promise<Resultado<T>>): Promise<T | null> {
  try {
    const r = await busca()
    return r.erro === null ? r.dados : null
  } catch {
    return null
  }
}

const vejo = (caminho: string, perfis: readonly Perfil[]) => {
  const item = ITENS_MENU.find((i) => i.caminho === caminho)
  return item ? podeVer(item, perfis) : false
}

const tem = (perfis: readonly Perfil[], ...quais: Perfil[]) => quais.some((p) => perfis.includes(p))

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

// ---------------------------------------------------------------------
// "Precisa de você" (diretoria) / "Para você" (ministro)
// ---------------------------------------------------------------------

export type ItemParaVoce = {
  chave: string
  area: Area
  icone: NomeIcone
  /** a parte em negrito */
  forte: string
  /** o resto (na linha de baixo, no notebook) */
  texto: string
  /** o botão à direita */
  acao: string
  para: string
  /** botão vermelho (a primeira coisa a fazer) */
  principal?: boolean
  /** contagem da diretoria ("3 pedidos…"): uma linha só, com "Abrir" */
  contagem?: boolean
}

export async function paraVoce(conta: MinhaConta): Promise<ItemParaVoce[]> {
  const { perfis, pessoaId } = conta
  const ministro = perfisEfetivos(perfis).has('ministro')
  const cadastro = tem(perfis, 'secretaria', 'presidencia')
  const financas = tem(perfis, 'tesouraria', 'presidencia')
  const agora = new Date().toISOString()
  const hoje = hojeIso()

  const [
    votacoes,
    pedidosAge,
    faltas,
    encontros,
    situacao,
    abertas,
    eventos,
    inscricoes,
    trocas,
    correcoes,
    justificativas,
    emprestimos,
    despesas,
    informes,
  ] = await Promise.all([
    vejo('/votacoes', perfis) ? seguro(listarVotacoes) : null,
    vejo('/assembleias', perfis) ? seguro(listarPedidosAge) : null,
    ministro ? seguro(minhasFaltas) : null,
    ministro ? seguro(listarEncontros) : null,
    ministro ? seguro(() => situacaoDe(pessoaId)) : null,
    ministro ? seguro(() => cobrancasEmAbertoDe(pessoaId)) : null,
    ministro ? seguro(listarEventos) : null,
    cadastro ? seguro(listarPedidos) : null,
    cadastro ? seguro(trocasPendentes) : null,
    cadastro ? seguro(() => listarPedidosCorrecao({ pendentes: true })) : null,
    cadastro ? seguro(listarJustificativas) : null,
    cadastro ? seguro(listarEmprestimos) : null,
    tem(perfis, 'presidencia') ? seguro(despesasAguardando) : null,
    financas ? seguro(informesPendentes) : null,
  ])

  const itens: ItemParaVoce[] = []
  const contagem = (chave: string, area: Area, icone: NomeIcone, n: number, um: string, varios: string, para: string) => {
    if (n > 0) itens.push({ chave, area, icone, forte: String(n), texto: n === 1 ? um : varios, acao: 'Abrir', para, contagem: true })
  }

  // A diretoria: o que espera a decisão de alguém da secretaria, da presidência ou da tesouraria
  if (inscricoes) {
    const n = inscricoes.filter((p) => p.situacao === 'enviado').length
    contagem('inscricoes', 'pessoas', 'inscricoes', n, 'pedido de associação para analisar', 'pedidos de associação para analisar', '/inscricoes')
  }
  if (despesas) {
    const n = despesas.length
    contagem('despesas', 'financas', 'financeiro', n, 'despesa esperando a sua autorização', 'despesas esperando a sua autorização', '/financeiro')
  }
  if (informes) {
    contagem('informes', 'financas', 'mensalidade', informes.length, 'comprovante de pagamento para conferir', 'comprovantes de pagamento para conferir', '/financeiro')
  }
  if (emprestimos) {
    const esperando = emprestimos.filter((e) => e.situacao === 'solicitado').length
    const atrasados = emprestimos.filter((e) => e.situacao === 'retirado' && e.devolucao < hoje).length
    contagem('emprestimos', 'financas', 'patrimonio', esperando, 'pedido de empréstimo para aprovar', 'pedidos de empréstimo para aprovar', '/patrimonio')
    contagem('devolucoes', 'financas', 'patrimonio', atrasados, 'empréstimo com a devolução atrasada', 'empréstimos com a devolução atrasada', '/patrimonio')
  }
  if (trocas) {
    contagem('trocas', 'pessoas', 'igreja', trocas.length, 'pedido de troca de igreja para decidir', 'pedidos de troca de igreja para decidir', '/ministros')
  }
  if (correcoes) {
    contagem('correcoes', 'pessoas', 'ministros', correcoes.length, 'pedido de correção no cadastro', 'pedidos de correção no cadastro', '/ministros')
  }
  if (justificativas) {
    const n = justificativas.filter((j) => j.situacao === 'pendente').length
    contagem('justificativas', 'assembleias', 'assembleia', n, 'justificativa de falta para decidir', 'justificativas de falta para decidir', '/assembleias/faltas')
  }
  if (pedidosAge && cadastro) {
    for (const p of pedidosAge.filter((x) => x.situacao === 'atingido')) {
      itens.push({
        chave: `age-marcar-${p.id}`,
        area: 'assembleias',
        icone: 'pedido',
        forte: 'Marcar a AGE:',
        texto: `${p.titulo} atingiu as assinaturas`,
        acao: 'Marcar',
        para: `/assembleias/pedidos/${p.id}`,
      })
    }
  }

  // O associado: votar, assinar, confirmar presença, a contribuição e as inscrições abertas
  for (const v of (votacoes ?? []).filter((x) => x.posso_votar && !x.eu_votei && !x.fechada)) {
    itens.push({
      chave: `votacao-${v.id}`,
      area: 'assembleias',
      icone: 'votar',
      forte: v.tipo === 'enquete' ? 'Vote na enquete' : 'Vote',
      texto: `${v.titulo}${v.fecha_em ? ` · até ${diaMes(v.fecha_em)}, às ${horaCurta(v.fecha_em)}` : ''}`,
      acao: 'Votar',
      para: `/votacoes/${v.id}`,
      principal: true,
    })
  }
  for (const p of (pedidosAge ?? []).filter((x) => x.posso_assinar && !x.eu_assinei)) {
    itens.push({
      chave: `age-assinar-${p.id}`,
      area: 'assembleias',
      icone: 'pedido',
      forte: 'Falta a sua assinatura',
      texto: `Pedido de AGE: ${p.titulo} · até ${formatarData(p.prazo)}`,
      acao: 'Assinar',
      para: `/assembleias/pedidos/${p.id}`,
    })
  }
  if (faltas && faltas.faltas_seguidas >= faltas.faltas_aviso) {
    const n = faltas.faltas_seguidas
    itens.push({
      chave: 'faltas',
      area: 'pessoas',
      icone: 'alerta',
      forte: `Você tem ${plural(n, 'falta', 'faltas seguidas')} nas assembleias`,
      texto:
        n >= faltas.faltas_pauta
          ? 'Sem justificativa aceita, a diretoria pode homologar o desligamento (Art. 8º, IV). Abra a assembleia e use "Justificar a falta".'
          : `Com ${faltas.faltas_pauta} faltas seguidas sem justificativa, a diretoria homologa o desligamento (Art. 8º, IV). Abra a assembleia e use "Justificar a falta".`,
      acao: 'Justificar',
      para: '/assembleias',
    })
  }
  const proxima = (encontros ?? [])
    .filter((e) => e.situacao === 'convocado' && e.inicio >= agora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
  if (proxima) {
    const participacao = await seguro(() => minhaParticipacao(proxima.id, pessoaId))
    const qual = proxima.tipo === 'reuniao_mensal' ? 'na reunião mensal' : `na ${SIGLA_DO_TIPO[proxima.tipo]}`
    const confirmou = Boolean(participacao?.confirmou_em)
    itens.push({
      chave: `encontro-${proxima.id}`,
      area: 'assembleias',
      icone: 'assembleia',
      forte: confirmou ? `Presença confirmada ${qual}` : `Confirme a presença ${qual}`,
      texto: `${diaMes(proxima.inicio)}, às ${horaCurta(proxima.inicio)}${proxima.local ? `, ${proxima.local}` : ''}`,
      acao: confirmou ? 'Ver' : 'Confirmar',
      para: `/assembleias/${proxima.id}`,
    })
  }
  for (const e of (eventos ?? [])
    .filter((x) => x.situacao === 'publicado' && x.inscricao && x.inicio >= agora && (!x.inscricao_ate || x.inscricao_ate >= hoje))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 2)) {
    itens.push({
      chave: `evento-${e.id}`,
      area: 'eventos',
      icone: 'evento',
      forte: e.titulo,
      texto: `${diaMes(e.inicio)} · inscrições abertas`,
      acao: 'Ver',
      para: `/eventos/${e.id}`,
    })
  }
  if (situacao && !situacao.jubilado) {
    if (situacao.em_dia) {
      const proximaCobranca = (abertas ?? []).find((c) => c.vencimento >= hoje)
      itens.push({
        chave: 'contribuicao',
        area: 'financas',
        icone: 'mensalidade',
        forte: 'Você está em dia.',
        texto: proximaCobranca ? `Próxima contribuição em ${formatarData(proximaCobranca.vencimento).slice(0, 5)}` : 'Nenhuma contribuição em aberto',
        acao: 'Ver',
        para: '/minhas-mensalidades',
      })
    } else {
      itens.push({
        chave: 'contribuicao',
        area: 'pessoas',
        icone: 'mensalidade',
        forte: 'Contribuição em atraso:',
        texto: plural(situacao.cobrancas_vencidas, 'cobrança vencida', 'cobranças vencidas'),
        acao: 'Pagar',
        para: '/minhas-mensalidades',
      })
    }
  }
  return itens
}

// ---------------------------------------------------------------------
// Agenda dos próximos dias (Início da diretoria)
// ---------------------------------------------------------------------

export type ItemAgenda = { chave: string; area: Area; inicio: string; titulo: string; detalhe: string; para: string }

export async function agendaProxima(perfis: readonly Perfil[]): Promise<ItemAgenda[]> {
  const agora = new Date()
  const inicioDoDia = new Date(agora.getTime() - 6 * 3_600_000).toISOString() // o que começou hoje ainda aparece
  const [encontros, eventos] = await Promise.all([
    vejo('/assembleias', perfis) ? seguro(listarEncontros) : null,
    vejo('/eventos', perfis) ? seguro(listarEventos) : null,
  ])
  const itens: ItemAgenda[] = [
    ...(encontros ?? [])
      .filter((e) => (e.situacao === 'agendado' || e.situacao === 'convocado') && e.inicio >= inicioDoDia)
      .map((e) => ({
        chave: `encontro-${e.id}`,
        area: 'assembleias' as const,
        inicio: e.inicio,
        titulo: `${e.titulo} · ${horaCurta(e.inicio)}`,
        detalhe: [e.local, e.situacao === 'convocado' ? 'convocada' : 'ainda sem convocação'].filter(Boolean).join(' · '),
        para: `/assembleias/${e.id}`,
      })),
    ...(eventos ?? [])
      .filter((e) => e.situacao === 'publicado' && e.inicio >= inicioDoDia)
      .map((e) => ({
        chave: `evento-${e.id}`,
        area: 'eventos' as const,
        inicio: e.inicio,
        titulo: `${e.titulo} · ${horaCurta(e.inicio)}`,
        detalhe: e.local ?? '',
        para: `/eventos/${e.id}`,
      })),
  ]
  return itens.sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 4)
}

// ---------------------------------------------------------------------
// O sino: avisos montados com o que já existe (votação aberta, AGE para assinar, assembleia convocada,
// aviso novo no mural, pendência no pedido de associação). "Lido" fica guardado no aparelho.
// ---------------------------------------------------------------------

export type AvisoDoSino = { chave: string; area: Area; icone: NomeIcone; titulo: string; texto: string; quando: string; para: string }

export async function avisosDoSino(conta: MinhaConta): Promise<AvisoDoSino[]> {
  const { perfis, pessoaId } = conta
  const ministro = perfisEfetivos(perfis).has('ministro')
  const agora = new Date().toISOString()
  const hoje = hojeIso()
  const [votacoes, pedidosAge, encontros, avisos, pedido] = await Promise.all([
    vejo('/votacoes', perfis) ? seguro(listarVotacoes) : null,
    vejo('/assembleias', perfis) ? seguro(listarPedidosAge) : null,
    ministro ? seguro(listarEncontros) : null,
    vejo('/avisos', perfis) ? seguro(listarAvisos) : null,
    perfis.length === 0 ? seguro(() => meuPedido(pessoaId)) : null,
  ])

  const itens: AvisoDoSino[] = []
  for (const v of (votacoes ?? []).filter((x) => x.posso_votar && !x.eu_votei && !x.fechada)) {
    itens.push({
      chave: `votacao:${v.id}`,
      area: 'assembleias',
      icone: 'votar',
      titulo: v.tipo === 'enquete' ? 'Enquete aberta' : 'Votação aberta',
      texto: `${v.titulo}${v.fecha_em ? ` Vote até ${diaMes(v.fecha_em)}.` : ''}`,
      quando: v.aberta_em ?? v.criado_em,
      para: `/votacoes/${v.id}`,
    })
  }
  for (const p of (pedidosAge ?? []).filter((x) => x.posso_assinar && !x.eu_assinei)) {
    itens.push({
      chave: `age:${p.id}`,
      area: 'assembleias',
      icone: 'pedido',
      titulo: 'Pedido de AGE',
      texto: `${p.titulo}: falta a sua assinatura.`,
      quando: p.criado_em,
      para: `/assembleias/pedidos/${p.id}`,
    })
  }
  for (const e of (encontros ?? []).filter((x) => x.situacao === 'convocado' && x.inicio >= agora && x.convocado_em)) {
    itens.push({
      chave: `encontro:${e.id}`,
      area: 'assembleias',
      icone: 'assembleia',
      titulo: e.tipo === 'reuniao_mensal' ? 'Reunião mensal convocada' : `${SIGLA_DO_TIPO[e.tipo]} convocada`,
      texto: `${NOME_DO_TIPO[e.tipo]} em ${diaMes(e.inicio)}, às ${horaCurta(e.inicio)}.`,
      quando: e.convocado_em ?? e.criado_em,
      para: `/assembleias/${e.id}`,
    })
  }
  for (const a of (avisos ?? []).filter((x) => x.valido_ate === null || x.valido_ate >= hoje).slice(0, 3)) {
    itens.push({
      chave: `aviso:${a.id}`,
      area: 'eventos',
      icone: 'aviso',
      titulo: 'Aviso no mural',
      texto: a.titulo,
      quando: a.criado_em,
      para: '/avisos',
    })
  }
  if (pedido && pedido.situacao === 'pendencia') {
    itens.push({
      chave: `pedido:${pedido.id}:pendencia:${pedido.enviado_em ?? ''}`,
      area: 'pessoas',
      icone: 'alerta',
      titulo: 'O seu pedido tem pendência',
      texto: pedido.mensagem_pendencia ?? 'A secretaria pediu uma correção no seu pedido de associação.',
      quando: pedido.enviado_em ?? pedido.criado_em,
      para: '/meu-pedido',
    })
  }
  return itens.sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 10)
}
