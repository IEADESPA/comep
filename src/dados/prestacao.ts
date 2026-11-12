// Financeiro — Fase 2.3: prestação de contas (resumo do exercício, balanço anual, orçamento, relatórios).
import { cliente, falha, ok, type Resultado } from './cliente'
import type { SituacaoLancamento, TipoLancamento } from './caixa'

// ---------- Resumo do exercício ----------

export type ContaResumo = {
  nome: string
  tipo: 'caixa' | 'banco'
  saldo_inicial: number
  abertura: number
  entradas: number
  saidas: number
  saldo_final: number
}

export type TotalCategoria = { categoria: string; total: number }

export type Resumo = {
  exercicio: number
  inicio: string
  fim: string
  encerrado: boolean
  calculado_em: string
  contas: ContaResumo[]
  entradas: TotalCategoria[]
  saidas: TotalCategoria[]
  total_entradas: number
  total_saidas: number
  transferencias: number
  contribuicoes: { previsto: number; recebido: number; em_aberto: number; vencido: number }
  despesas_aguardando: { quantidade: number; total: number }
}

export async function resumoExercicio(exercicio: number): Promise<Resultado<Resumo>> {
  const { data, error } = await cliente().rpc('resumo_exercicio', { p_exercicio: exercicio })
  return error ? falha(error) : ok(data as Resumo)
}

export type ContribuicaoIgreja = {
  igreja: string
  associados: number
  previsto: number
  recebido: number
  em_aberto: number
  vencido: number
}

export async function contribuicoesPorIgreja(exercicio: number): Promise<Resultado<ContribuicaoIgreja[]>> {
  const { data, error } = await cliente().rpc('contribuicoes_por_igreja', { p_exercicio: exercicio })
  return error ? falha(error) : ok((data ?? []) as ContribuicaoIgreja[])
}

/** Lançamentos do exercício inteiro (abril a março), para o mês a mês e a planilha. */
export type LancamentoRelatorio = {
  data: string
  tipo: TipoLancamento
  valor: number
  descricao: string
  situacao: SituacaoLancamento
  motivo: string | null
  conta: { nome: string } | null
  categoria: { nome: string; sistema: string | null } | null
  autorizado: { nome: string } | null
}

export async function lancamentosDoExercicio(exercicio: number): Promise<Resultado<LancamentoRelatorio[]>> {
  const { data, error } = await cliente()
    .from('lancamentos')
    .select(
      `data, tipo, valor, descricao, situacao, motivo, conta:contas_financeiras(nome),
       categoria:categorias_financeiras(nome, sistema), autorizado:pessoas!lancamentos_autorizado_por_fkey(nome)`,
    )
    .gte('data', `${exercicio}-04-01`)
    .lte('data', `${exercicio + 1}-03-31`)
    .is('arquivado_em', null)
    .order('data')
    .order('criado_em')
    .range(0, 9999)
    .returns<LancamentoRelatorio[]>()
  return error ? falha(error) : ok(data)
}

// ---------- Balanço anual ----------

export type SituacaoBalanco = 'analise_diretoria' | 'aguardando_parecer' | 'aguardando_assembleia' | 'aprovado' | 'devolvido'
export type TipoParecer = 'favoravel' | 'favoravel_com_ressalvas' | 'desfavoravel'

export const NOME_DA_SITUACAO_BALANCO: Record<SituacaoBalanco, string> = {
  analise_diretoria: 'Na análise da diretoria',
  aguardando_parecer: 'Aguardando o parecer do Conselho Fiscal',
  aguardando_assembleia: 'Aguardando a assembleia',
  aprovado: 'Aprovado pela assembleia',
  devolvido: 'Devolvido à tesouraria para correção',
}

export const NOME_DO_PARECER: Record<TipoParecer, string> = {
  favoravel: 'Favorável',
  favoravel_com_ressalvas: 'Favorável com ressalvas',
  desfavoravel: 'Desfavorável',
}

export type Balanco = {
  id: string
  exercicio: number
  situacao: SituacaoBalanco
  resumo: Resumo
  nota_tesouraria: string | null
  fechado_em: string | null
  analise_diretoria: string | null
  analisado_em: string | null
  parecer: TipoParecer | null
  parecer_texto: string | null
  parecer_em: string | null
  assembleia_data: string | null
  assembleia_ata: string | null
  aprovado_assembleia: boolean | null
  motivo_devolucao: string | null
  fechado: { id: string; nome: string } | null
  analisado: { nome: string } | null
  parecerista: { nome: string } | null
}

export type EventoBalanco = { id: string; acao: string; texto: string | null; criado_em: string; pessoa: { nome: string } | null }

export async function buscarBalanco(
  exercicio: number,
): Promise<Resultado<{ balanco: Balanco | null; eventos: EventoBalanco[] }>> {
  const { data, error } = await cliente()
    .from('balancos')
    .select(
      `id, exercicio, situacao, resumo, nota_tesouraria, fechado_em, analise_diretoria, analisado_em, parecer,
       parecer_texto, parecer_em, assembleia_data, assembleia_ata, aprovado_assembleia, motivo_devolucao,
       fechado:pessoas!balancos_fechado_por_fkey(id, nome), analisado:pessoas!balancos_analisado_por_fkey(nome),
       parecerista:pessoas!balancos_parecer_por_fkey(nome)`,
    )
    .eq('exercicio', exercicio)
    .is('arquivado_em', null)
    .maybeSingle<Balanco>()
  if (error) return falha(error)
  if (!data) return ok({ balanco: null, eventos: [] })
  const eventos = await cliente()
    .from('balanco_eventos')
    .select('id, acao, texto, criado_em, pessoa:pessoas(nome)')
    .eq('balanco_id', data.id)
    .order('criado_em', { ascending: false })
    .returns<EventoBalanco[]>()
  return eventos.error ? falha(eventos.error) : ok({ balanco: data, eventos: eventos.data })
}

/** Exercícios que já têm balanço (para a lista de escolha). */
export async function exerciciosComBalanco(): Promise<Resultado<{ exercicio: number; situacao: SituacaoBalanco }[]>> {
  const { data, error } = await cliente()
    .from('balancos')
    .select('exercicio, situacao')
    .is('arquivado_em', null)
    .order('exercicio', { ascending: false })
    .returns<{ exercicio: number; situacao: SituacaoBalanco }[]>()
  return error ? falha(error) : ok(data)
}

async function rpcSemRetorno(funcao: string, parametros: Record<string, unknown>): Promise<Resultado<null>> {
  const { error } = await cliente().rpc(funcao, parametros)
  return error ? falha(error) : ok(null)
}

export const fecharBalanco = (exercicio: number, nota: string) =>
  rpcSemRetorno('fechar_balanco', { p_exercicio: exercicio, p_nota: nota })
export const analisarBalanco = (id: string, texto: string) =>
  rpcSemRetorno('analisar_balanco', { p_balanco_id: id, p_texto: texto })
export const parecerBalanco = (id: string, parecer: TipoParecer, texto: string) =>
  rpcSemRetorno('parecer_balanco', { p_balanco_id: id, p_parecer: parecer, p_texto: texto })
export const devolverBalanco = (id: string, motivo: string) =>
  rpcSemRetorno('devolver_balanco', { p_balanco_id: id, p_motivo: motivo })
export const assembleiaBalanco = (id: string, aprovado: boolean, data: string, ata: string) =>
  rpcSemRetorno('assembleia_balanco', { p_balanco_id: id, p_aprovado: aprovado, p_data: data, p_ata: ata })

// ---------- Orçamento e plano anual de trabalho ----------

export type Orcamento = {
  id: string
  exercicio: number
  plano_trabalho: string | null
  aprovado_em_assembleia: string | null
  ata: string | null
  itens: { categoria_id: string; valor: number; arquivado_em: string | null }[]
}

export async function buscarOrcamento(exercicio: number): Promise<Resultado<Orcamento | null>> {
  const { data, error } = await cliente()
    .from('orcamentos')
    .select('id, exercicio, plano_trabalho, aprovado_em_assembleia, ata, itens:orcamento_itens(categoria_id, valor, arquivado_em)')
    .eq('exercicio', exercicio)
    .is('arquivado_em', null)
    .maybeSingle<Orcamento>()
  if (error) return falha(error)
  if (data) data.itens = data.itens.filter((i) => i.arquivado_em === null)
  return ok(data)
}

export const salvarOrcamento = (exercicio: number, plano: string, itens: { categoria_id: string; valor: number }[]) =>
  rpcSemRetorno('salvar_orcamento', { p_exercicio: exercicio, p_plano: plano, p_itens: itens })
export const aprovarOrcamento = (exercicio: number, data: string, ata: string) =>
  rpcSemRetorno('aprovar_orcamento', { p_exercicio: exercicio, p_data: data, p_ata: ata })
