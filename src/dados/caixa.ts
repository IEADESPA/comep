// Financeiro — Fase 2.2: caixa (contas, lançamentos, despesas autorizadas pelo presidente, transferências).
import { cliente, falha, ok, todasAsLinhas, type Resultado } from './cliente'
import { enviarArquivo } from './pedidos'

export type TipoLancamento = 'entrada' | 'saida'
export type SituacaoLancamento = 'efetivado' | 'aguardando_autorizacao' | 'recusado' | 'cancelado'

export const NOME_DA_SITUACAO_LANCAMENTO: Record<SituacaoLancamento, string> = {
  efetivado: 'Efetivado',
  aguardando_autorizacao: 'Aguardando autorização do presidente',
  recusado: 'Recusado pelo presidente',
  cancelado: 'Cancelado',
}

export type SaldoConta = {
  id: string
  nome: string
  tipo: 'caixa' | 'banco'
  saldo_inicial: number
  saldo_inicial_em: string
  entradas: number
  saidas: number
  saldo: number
  aguardando_autorizacao: number
}

export type CategoriaFinanceira = { id: string; nome: string; tipo: TipoLancamento; ordem: number; sistema: string | null }

export type Lancamento = {
  id: string
  conta_id: string
  tipo: TipoLancamento
  data: string
  valor: number
  descricao: string
  comprovante_caminho: string | null
  cobranca_id: string | null
  transferencia_id: string | null
  situacao: SituacaoLancamento
  motivo: string | null
  autorizado_em: string | null
  criado_em: string
  criado_por: string | null
  categoria: { nome: string } | null
  conta: { nome: string } | null
  autorizado: { nome: string } | null
}

const CAMPOS_LANCAMENTO = `id, conta_id, tipo, data, valor, descricao, comprovante_caminho, cobranca_id, transferencia_id,
  situacao, motivo, autorizado_em, criado_em, criado_por,
  categoria:categorias_financeiras(nome), conta:contas_financeiras(nome),
  autorizado:pessoas!lancamentos_autorizado_por_fkey(nome)`

export async function saldos(): Promise<Resultado<SaldoConta[]>> {
  const { data, error } = await cliente().from('vw_saldos_contas').select('*').order('tipo').returns<SaldoConta[]>()
  return error ? falha(error) : ok(data)
}

export async function listarCategoriasFinanceiras(): Promise<Resultado<CategoriaFinanceira[]>> {
  const { data, error } = await cliente()
    .from('categorias_financeiras')
    .select('id, nome, tipo, ordem, sistema')
    .is('arquivado_em', null)
    .order('tipo')
    .order('ordem')
    .order('nome')
    .returns<CategoriaFinanceira[]>()
  return error ? falha(error) : ok(data)
}

/** Lançamentos de um mês (AAAA-MM), do mais recente para o mais antigo. */
export async function lancamentosDoMes(mes: string): Promise<Resultado<Lancamento[]>> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { dados: null, erro: 'Escolha o mês (ex.: 11/2026).' }
  const [ano, m] = mes.split('-').map(Number)
  const inicio = `${mes}-01`
  const fim = new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 10)
  const { data, error } = await cliente()
    .from('lancamentos')
    .select(CAMPOS_LANCAMENTO)
    .gte('data', inicio)
    .lt('data', fim)
    .is('arquivado_em', null)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
    .returns<Lancamento[]>()
  return error ? falha(error) : ok(data)
}

export async function despesasAguardando(): Promise<Resultado<Lancamento[]>> {
  const { data, error } = await cliente()
    .from('lancamentos')
    .select(CAMPOS_LANCAMENTO)
    .eq('situacao', 'aguardando_autorizacao')
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<Lancamento[]>()
  return error ? falha(error) : ok(data)
}

export async function lancar(dados: {
  pessoaId: string
  contaId: string
  tipo: TipoLancamento
  categoriaId: string
  data: string
  valor: number
  descricao: string
  comprovante: { blob: Blob; extensao: string } | null
}): Promise<Resultado<string>> {
  let caminho: string | null = null
  if (dados.comprovante) {
    const envio = await enviarArquivo(dados.pessoaId, 'pagamento', dados.comprovante.blob, dados.comprovante.extensao)
    if (envio.erro !== null) return envio
    caminho = envio.dados
  }
  const { data, error } = await cliente().rpc('lancar', {
    p_conta_id: dados.contaId,
    p_tipo: dados.tipo,
    p_categoria: dados.categoriaId,
    p_data: dados.data,
    p_valor: dados.valor,
    p_descricao: dados.descricao,
    p_comprovante: caminho,
  })
  return error ? falha(error) : ok(data as string)
}

export async function autorizarDespesa(id: string, autorizar: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('autorizar_despesa', { p_lancamento_id: id, p_autorizar: autorizar, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function cancelarLancamento(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_lancamento', { p_lancamento_id: id, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function transferir(origem: string, destino: string, data: string, valor: number, descricao: string) {
  const { error } = await cliente().rpc('transferir', {
    p_origem: origem,
    p_destino: destino,
    p_data: data,
    p_valor: valor,
    p_descricao: descricao,
  })
  return error ? falha<null>(error) : ok(null)
}

// ---------- Configuração: contas e categorias ----------

export async function criarConta(nome: string, tipo: 'caixa' | 'banco', saldoInicial: number, desde: string) {
  const { error } = await cliente().rpc('criar_conta', {
    p_nome: nome,
    p_tipo: tipo,
    p_saldo_inicial: saldoInicial,
    p_saldo_inicial_em: desde,
  })
  return error ? falha<null>(error, 'Já existe uma conta com esse nome.') : ok(null)
}

/** O saldo inicial não muda depois que o período dele foi fechado na prestação de contas (o banco recusa). */
export async function alterarConta(id: string, dados: { nome: string; saldo_inicial: number; saldo_inicial_em: string }) {
  const { error } = await cliente().rpc('alterar_conta', {
    p_conta_id: id,
    p_nome: dados.nome,
    p_saldo_inicial: dados.saldo_inicial,
    p_saldo_inicial_em: dados.saldo_inicial_em,
  })
  return error ? falha<null>(error, 'Já existe uma conta com esse nome.') : ok(null)
}

export async function criarCategoriaFinanceira(nome: string, tipo: TipoLancamento) {
  const { error } = await cliente().from('categorias_financeiras').insert({ nome: nome.trim(), tipo, ordem: 50 })
  return error ? falha<null>(error, 'Já existe uma categoria com esse nome.') : ok(null)
}

export async function arquivarCategoriaFinanceira(id: string) {
  const { error } = await cliente()
    .from('categorias_financeiras')
    .update({ arquivado_em: new Date().toISOString() })
    .eq('id', id)
  return error ? falha<null>(error) : ok(null)
}

// ---------- Telas novas (Fase 5.5, parte 9): o caixa como extrato, as despesas e as transferências ----------

/** Um lançamento com a conta, a categoria e os nomes (vista vw_lancamentos). */
export type LinhaCaixa = {
  id: string
  conta_id: string
  tipo: TipoLancamento
  data: string
  valor: number
  descricao: string
  comprovante_caminho: string | null
  cobranca_id: string | null
  transferencia_id: string | null
  evento_id: string | null
  situacao: SituacaoLancamento
  motivo: string | null
  autorizado_em: string | null
  criado_em: string
  conta_nome: string
  conta_tipo: 'caixa' | 'banco'
  conta_desde: string
  categoria_id: string
  categoria_nome: string
  categoria_sistema: string | null
  autorizado_por_id: string | null
  autorizado_por_nome: string | null
  lancado_por_id: string | null
  lancado_por_nome: string | null
  /** efetivado e depois do saldo inicial da conta: muda o saldo */
  no_saldo: boolean
}

/** Os lançamentos de um período (datas AAAA-MM-DD, inclusive), do mais antigo para o mais novo. */
export async function lancamentosDoPeriodo(inicio: string, fim: string): Promise<Resultado<LinhaCaixa[]>> {
  return todasAsLinhas((de, ate) =>
    cliente()
      .from('vw_lancamentos')
      .select('*')
      .gte('data', inicio)
      .lte('data', fim)
      .order('data')
      .order('criado_em')
      .order('id')
      .range(de, ate)
      .returns<LinhaCaixa[]>(),
  )
}

export type CaixaNoPeriodo = {
  inicio: string
  fim: string
  saldo_inicio: number
  saldo_fim: number
  aberturas: { conta: string; data: string; valor: number }[]
}

/** O saldo de todas as contas no começo e no fim do período, e as contas abertas dentro dele. */
export async function caixaNoPeriodo(inicio: string, fim: string): Promise<Resultado<CaixaNoPeriodo>> {
  const { data, error } = await cliente().rpc('caixa_no_periodo', { p_inicio: inicio, p_fim: fim })
  return error ? falha(error) : ok(data as CaixaNoPeriodo)
}

/** As despesas de uma situação (as últimas primeiro). */
export async function despesasPorSituacao(
  situacao: 'aguardando_autorizacao' | 'efetivado' | 'recusado',
  limite = 200,
): Promise<Resultado<LinhaCaixa[]>> {
  let consulta = cliente().from('vw_lancamentos').select('*').eq('tipo', 'saida').eq('situacao', situacao)
  // a autorizada é a despesa que passou pelo presidente (a transferência e a do patrimônio entram já efetivadas)
  if (situacao === 'efetivado') consulta = consulta.not('autorizado_por_id', 'is', null)
  const { data, error } = await consulta
    .order(situacao === 'aguardando_autorizacao' ? 'criado_em' : 'autorizado_em', { ascending: situacao === 'aguardando_autorizacao' })
    .limit(limite)
    .returns<LinhaCaixa[]>()
  return error ? falha(error) : ok(data)
}

/** As transferências entre contas (o lado que sai), as últimas primeiro. */
export async function listarTransferencias(limite = 200): Promise<Resultado<LinhaCaixa[]>> {
  const { data, error } = await cliente()
    .from('vw_lancamentos')
    .select('*')
    .not('transferencia_id', 'is', null)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(limite * 2)
    .returns<LinhaCaixa[]>()
  return error ? falha(error) : ok(data)
}
