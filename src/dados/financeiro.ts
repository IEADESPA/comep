// Financeiro — Fase 2.1: contribuições (mensalidades e anuidade), pagamentos informados e situação.
// Todas as gravações passam por funções do banco que conferem quem pode fazer o quê.
import { cliente, falha, ok, type Resultado, todasAsLinhas } from './cliente'
import type { CategoriaContribuicao } from './configuracoes'
import { enviarArquivo } from './pedidos'

export type TipoCobranca = 'mensal' | 'anual' | 'inscricao'
export type SituacaoCobranca = 'aberta' | 'paga' | 'cancelada'
export type SituacaoInforme = 'pendente' | 'confirmado' | 'recusado' | 'cancelado'

export const FORMAS_PAGAMENTO = ['PIX', 'Depósito', 'Transferência', 'Dinheiro'] as const

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Exercício de uma data (vai de abril a março): identificado pelo ano em que começa. */
export function exercicioDe(dataIso: string): number {
  const [ano, mes] = dataIso.split('-').map(Number)
  return mes >= 4 ? ano : ano - 1
}

export function nomeDoExercicio(exercicio: number): string {
  return `${exercicio}/${exercicio + 1}`
}

/** "Abril de 2026" ou "Anuidade 2026/2027" */
export function nomeDaCobranca(c: { tipo: TipoCobranca; competencia: string; exercicio: number }): string {
  if (c.tipo === 'anual') return `Anuidade ${nomeDoExercicio(c.exercicio)}`
  if (c.tipo === 'inscricao') return 'Taxa de inscrição'
  const [ano, mes] = c.competencia.split('-').map(Number)
  const nome = MESES[mes - 1]
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`
}

export type InformeResumo = {
  id: string
  situacao: SituacaoInforme
  data_pagamento: string
  forma: string
  motivo_recusa: string | null
  criado_em: string
}

export type Cobranca = {
  id: string
  pessoa_id: string
  exercicio: number
  tipo: TipoCobranca
  competencia: string
  vencimento: string
  categoria: CategoriaContribuicao
  valor: number
  situacao: SituacaoCobranca
  pago_em: string | null
  valor_pago: number | null
  forma_pagamento: string | null
  observacao: string | null
  informes: InformeResumo[]
}

const CAMPOS_COBRANCA = `id, pessoa_id, exercicio, tipo, competencia, vencimento, categoria, valor, situacao, pago_em,
  valor_pago, forma_pagamento, observacao,
  informes:informes_pagamento(id, situacao, data_pagamento, forma, motivo_recusa, criado_em)`

export type SituacaoContribuicao = {
  pessoa_id: string
  nome: string
  numero_registro: number
  igreja: string | null
  categoria_contribuicao: CategoriaContribuicao
  jubilado: boolean
  cobrancas_vencidas: number
  valor_vencido: number
  em_dia: boolean
}

/** Como mostrar cada cobrança para quem lê: paga, aguardando a tesouraria, vencida, a vencer… */
export function estadoDaCobranca(c: Cobranca, hoje: string): 'paga' | 'conferencia' | 'vencida' | 'a_vencer' | 'cancelada' {
  if (c.situacao === 'paga') return 'paga'
  if (c.situacao === 'cancelada') return 'cancelada'
  if (c.informes.some((i) => i.situacao === 'pendente')) return 'conferencia'
  return c.vencimento < hoje ? 'vencida' : 'a_vencer'
}

// ---------- O associado ----------

/** As do exercício e também as que ficaram em aberto de exercícios anteriores (para poder pagar). */
export async function minhasCobrancas(pessoaId: string, exercicio: number): Promise<Resultado<Cobranca[]>> {
  const { data, error } = await cliente()
    .from('cobrancas')
    .select(CAMPOS_COBRANCA)
    .eq('pessoa_id', pessoaId)
    .or(`exercicio.eq.${exercicio},and(situacao.eq.aberta,exercicio.lt.${exercicio})`)
    .is('arquivado_em', null)
    .order('competencia')
    .returns<Cobranca[]>()
  return error ? falha(error) : ok(data)
}

export async function situacaoDe(pessoaId: string): Promise<Resultado<SituacaoContribuicao | null>> {
  const { data, error } = await cliente()
    .from('vw_situacao_contribuicao')
    .select('*')
    .eq('pessoa_id', pessoaId)
    .maybeSingle<SituacaoContribuicao>()
  return error ? falha(error) : ok(data)
}

export async function planoDe(pessoaId: string, exercicio: number): Promise<Resultado<'mensal' | 'anual'>> {
  const { data, error } = await cliente()
    .from('planos_contribuicao')
    .select('tipo')
    .eq('pessoa_id', pessoaId)
    .eq('exercicio', exercicio)
    .is('arquivado_em', null)
    .maybeSingle<{ tipo: 'mensal' | 'anual' }>()
  return error ? falha(error) : ok(data?.tipo ?? 'mensal')
}

export async function escolherPlano(pessoaId: string, exercicio: number, tipo: 'mensal' | 'anual'): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('escolher_plano', { p_pessoa_id: pessoaId, p_exercicio: exercicio, p_tipo: tipo })
  return error ? falha(error) : ok(null)
}

/** Envia o comprovante (se houver) e informa o pagamento de uma ou mais cobranças. */
export async function informarPagamento(dados: {
  pessoaId: string
  cobrancas: string[]
  data: string
  forma: string
  comprovante: { blob: Blob; extensao: string } | null
  observacao: string
}): Promise<Resultado<number>> {
  let caminho: string | null = null
  if (dados.comprovante) {
    const envio = await enviarArquivo(dados.pessoaId, 'pagamento', dados.comprovante.blob, dados.comprovante.extensao)
    if (envio.erro !== null) return envio
    caminho = envio.dados
  }
  const { data, error } = await cliente().rpc('informar_pagamento', {
    p_cobrancas: dados.cobrancas,
    p_data: dados.data,
    p_forma: dados.forma,
    p_comprovante: caminho,
    p_observacao: dados.observacao,
  })
  return error ? falha(error) : ok(data as number)
}

// ---------- Tesouraria / presidência ----------

export type InformePendente = {
  id: string
  pessoa_id: string
  data_pagamento: string
  valor: number
  forma: string
  comprovante_caminho: string | null
  observacao: string | null
  criado_em: string
  pessoa: { nome: string } | null
  cobranca: { tipo: TipoCobranca; competencia: string; exercicio: number; vencimento: string } | null
}

export async function informesPendentes(): Promise<Resultado<InformePendente[]>> {
  const { data, error } = await cliente()
    .from('informes_pagamento')
    .select(
      `id, pessoa_id, data_pagamento, valor, forma, comprovante_caminho, observacao, criado_em,
       pessoa:pessoas!informes_pagamento_pessoa_id_fkey(nome),
       cobranca:cobrancas(tipo, competencia, exercicio, vencimento)`,
    )
    .eq('situacao', 'pendente')
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<InformePendente[]>()
  return error ? falha(error) : ok(data)
}

export async function analisarInforme(id: string, confirmar: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('analisar_informe', { p_informe_id: id, p_confirmar: confirmar, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function gerarCobrancas(exercicio: number): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('gerar_cobrancas', { p_exercicio: exercicio })
  return error ? falha(error) : ok(data as number)
}

export async function situacaoDeTodos(): Promise<Resultado<SituacaoContribuicao[]>> {
  const { data, error } = await cliente()
    .from('vw_situacao_contribuicao')
    .select('*')
    .order('nome')
    .returns<SituacaoContribuicao[]>()
  return error ? falha(error) : ok(data)
}

export type ResumoExercicio = { previsto: number; recebido: number; emAberto: number; vencido: number; cobrancas: number }

export async function resumoDoExercicio(exercicio: number, hoje: string): Promise<Resultado<ResumoExercicio>> {
  const todas = await todasAsLinhas((de, ate) =>
    cliente()
      .from('cobrancas')
      .select('valor, situacao, vencimento, valor_pago')
      .eq('exercicio', exercicio)
      .is('arquivado_em', null)
      .neq('situacao', 'cancelada')
      .order('id')
      .range(de, ate)
      .returns<{ valor: number; situacao: SituacaoCobranca; vencimento: string; valor_pago: number | null }[]>(),
  )
  if (todas.erro !== null) return todas
  const data = todas.dados
  const resumo: ResumoExercicio = { previsto: 0, recebido: 0, emAberto: 0, vencido: 0, cobrancas: data.length }
  for (const c of data) {
    resumo.previsto += Number(c.valor)
    if (c.situacao === 'paga') resumo.recebido += Number(c.valor_pago ?? c.valor)
    else {
      resumo.emAberto += Number(c.valor)
      if (c.vencimento < hoje) resumo.vencido += Number(c.valor)
    }
  }
  return ok(resumo)
}

export async function cobrancasEmAbertoDe(pessoaId: string): Promise<Resultado<Cobranca[]>> {
  const { data, error } = await cliente()
    .from('cobrancas')
    .select(CAMPOS_COBRANCA)
    .eq('pessoa_id', pessoaId)
    .eq('situacao', 'aberta')
    .is('arquivado_em', null)
    .order('vencimento')
    .returns<Cobranca[]>()
  return error ? falha(error) : ok(data)
}

export async function registrarPagamento(
  cobrancaId: string,
  data: string,
  valor: number,
  forma: string,
  observacao: string,
): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('registrar_pagamento', {
    p_cobranca_id: cobrancaId,
    p_data: data,
    p_valor: valor,
    p_forma: forma,
    p_observacao: observacao,
  })
  return error ? falha(error) : ok(null)
}

// ---------- Configuração (vencimentos) ----------

export type ConfigFinanceiro = { dia_vencimento_mensal: number; dia_vencimento_anual: number }

export async function buscarConfigFinanceiro(): Promise<Resultado<ConfigFinanceiro>> {
  const { data, error } = await cliente()
    .from('config_financeiro')
    .select('dia_vencimento_mensal, dia_vencimento_anual')
    .single<ConfigFinanceiro>()
  return error ? falha(error) : ok(data)
}

export async function salvarConfigFinanceiro(config: ConfigFinanceiro): Promise<Resultado<null>> {
  const { error } = await cliente().from('config_financeiro').update(config).eq('id', true)
  return error ? falha(error) : ok(null)
}

/** Tesouraria/presidência: dispensa ou corrige uma cobrança em aberto (com motivo). Não volta ao gerar de novo. */
export async function cancelarCobranca(cobrancaId: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_cobranca', { p_cobranca_id: cobrancaId, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

// ---------- Telas novas (Fase 5.5, parte 9): os números do alto, os comprovantes já conferidos e os planos ----------

export type NumerosFinanceiro = {
  exercicio: number
  saldo: number
  contribuicoes: { previsto: number; recebido: number; em_aberto: number }
  em_atraso: number
  para_conferir: { quantidade: number; valor: number }
  despesas_esperando: { quantidade: number; valor: number }
}

/** O saldo de hoje, o recebido no exercício, o que está em aberto e o que espera alguém (uma chamada só). */
export async function numerosDoFinanceiro(): Promise<Resultado<NumerosFinanceiro>> {
  const { data, error } = await cliente().rpc('numeros_do_financeiro')
  return error ? falha(error) : ok(data as NumerosFinanceiro)
}

export type InformeConferido = {
  id: string
  pessoa_id: string
  data_pagamento: string
  valor: number
  forma: string
  comprovante_caminho: string | null
  situacao: SituacaoInforme
  motivo_recusa: string | null
  analisado_em: string | null
  pessoa: { nome: string } | null
  analisado: { nome: string } | null
  cobranca: { tipo: TipoCobranca; competencia: string; exercicio: number } | null
}

/** Os pagamentos já conferidos (confirmados ou recusados), os últimos primeiro. */
export async function informesConferidos(limite = 200): Promise<Resultado<InformeConferido[]>> {
  const { data, error } = await cliente()
    .from('informes_pagamento')
    .select(
      `id, pessoa_id, data_pagamento, valor, forma, comprovante_caminho, situacao, motivo_recusa, analisado_em,
       pessoa:pessoas!informes_pagamento_pessoa_id_fkey(nome),
       analisado:pessoas!informes_pagamento_analisado_por_fkey(nome),
       cobranca:cobrancas(tipo, competencia, exercicio)`,
    )
    .in('situacao', ['confirmado', 'recusado'])
    .is('arquivado_em', null)
    .order('analisado_em', { ascending: false, nullsFirst: false })
    .limit(limite)
    .returns<InformeConferido[]>()
  return error ? falha(error) : ok(data)
}

/**
 * Os planos guardados no exercício (de quem é e qual). Vêm também os de quem não é mais associado: quem conta é
 * contarPlanos (src/telas/financeiro/planos.ts), só com os associados que pagam (D-16).
 */
export async function planosDoExercicio(exercicio: number): Promise<Resultado<{ pessoa_id: string; tipo: 'mensal' | 'anual' }[]>> {
  return todasAsLinhas((de, ate) =>
    cliente()
      .from('planos_contribuicao')
      .select('pessoa_id, tipo')
      .eq('exercicio', exercicio)
      .is('arquivado_em', null)
      .order('id')
      .range(de, ate)
      .returns<{ pessoa_id: string; tipo: 'mensal' | 'anual' }[]>(),
  )
}
