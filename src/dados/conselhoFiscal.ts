// O Conselho Fiscal mês a mês (telas novas, Fase 5.5, parte 10): os 12 meses do exercício, a aprovação de cada mês,
// os pedidos de esclarecimento e as respostas da tesouraria, as assinaturas e o parecer do ano.
// Todas as gravações passam por funções do banco que conferem quem pode fazer o quê.
import { cliente, falha, ok, type Resultado } from './cliente'
import { enviarArquivo } from './pedidos'

export type SituacaoMes = 'futuro' | 'aberto' | 'esclarecimento' | 'aprovado' | 'ressalva' | 'mudou' | 'para_analisar'
export type DecisaoMes = 'aprovado' | 'aprovado_com_ressalva'

export const NOME_DA_SITUACAO_MES: Record<SituacaoMes, string> = {
  futuro: 'Ainda não começou',
  aberto: 'Mês aberto',
  esclarecimento: 'Esperando a tesouraria',
  aprovado: 'Aprovado',
  ressalva: 'Aprovado com ressalva',
  mudou: 'Mudou depois da aprovação',
  para_analisar: 'Para analisar',
}

export type Assinatura = { pessoa_id: string; nome: string; em: string }

export type MesDoConselho = {
  /** o primeiro dia do mês (AAAA-MM-01) */
  competencia: string
  situacao: SituacaoMes
  entradas: number
  saidas: number
  lancamentos: number
  saldo_inicio: number
  saldo_fim: number
  perguntas_abertas: number
  perguntas_respondidas: number
  aprovacao: {
    id: string
    decisao: DecisaoMes
    ressalva: string | null
    sem_movimento: boolean
    vale: boolean
    decidido_em: string
    decidido_por: string | null
    assinaturas: Assinatura[]
  } | null
}

/** Os 12 meses do exercício (abril a março), com os números e a situação de cada um. */
export async function mesesDoConselho(exercicio: number): Promise<Resultado<MesDoConselho[]>> {
  const { data, error } = await cliente().rpc('meses_do_conselho', { p_exercicio: exercicio })
  return error ? falha(error) : ok((data ?? []) as MesDoConselho[])
}

/** Os membros do Conselho Fiscal hoje (pelo perfil ou pelo mandato). */
export async function membrosDoConselho(): Promise<Resultado<{ pessoa_id: string; nome: string }[]>> {
  const { data, error } = await cliente().rpc('membros_conselho_fiscal')
  return error ? falha(error) : ok((data ?? []) as { pessoa_id: string; nome: string }[])
}

async function rpcSemRetorno(funcao: string, parametros: Record<string, unknown>): Promise<Resultado<null>> {
  const { error } = await cliente().rpc(funcao, parametros)
  return error ? falha(error) : ok(null)
}

/** Aprovar (ou aprovar com ressalva) as contas de um mês; quem decide assina. */
export const decidirMes = (competencia: string, decisao: DecisaoMes, ressalva: string) =>
  rpcSemRetorno('decidir_mes', { p_competencia: competencia, p_decisao: decisao, p_ressalva: ressalva })
export const assinarMes = (mesId: string) => rpcSemRetorno('assinar_mes', { p_mes_id: mesId })
export const assinarParecer = (balancoId: string) => rpcSemRetorno('assinar_parecer', { p_balanco_id: balancoId })

export async function aprovarMesesSemMovimento(exercicio: number): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('aprovar_meses_sem_movimento', { p_exercicio: exercicio })
  return error ? falha(error) : ok(data as number)
}

// ---------- Os pedidos de esclarecimento ----------

export type Esclarecimento = {
  id: string
  competencia: string
  lancamento_id: string | null
  pergunta: string
  perguntado_em: string
  resposta: string | null
  resposta_arquivo: string | null
  respondido_em: string | null
  perguntado: { nome: string } | null
  respondido: { nome: string } | null
  lancamento: { descricao: string; valor: number; data: string; tipo: 'entrada' | 'saida' } | null
}

/** Os pedidos (de um mês, ou todos), os sem resposta primeiro. */
export async function listarEsclarecimentos(competencia?: string): Promise<Resultado<Esclarecimento[]>> {
  let consulta = cliente()
    .from('esclarecimentos')
    .select(
      `id, competencia, lancamento_id, pergunta, perguntado_em, resposta, resposta_arquivo, respondido_em,
       perguntado:pessoas!esclarecimentos_perguntado_por_fkey(nome), respondido:pessoas!esclarecimentos_respondido_por_fkey(nome),
       lancamento:lancamentos(descricao, valor, data, tipo)`,
    )
    .is('arquivado_em', null)
  if (competencia) consulta = consulta.eq('competencia', competencia)
  const { data, error } = await consulta.order('perguntado_em', { ascending: false }).limit(300).returns<Esclarecimento[]>()
  if (error) return falha(error)
  return ok([...data.filter((e) => !e.respondido_em), ...data.filter((e) => e.respondido_em)])
}

export async function pedirEsclarecimento(competencia: string, lancamentoId: string | null, pergunta: string): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('pedir_esclarecimento', {
    p_competencia: competencia,
    p_lancamento_id: lancamentoId,
    p_pergunta: pergunta,
  })
  return error ? falha(error) : ok(data as string)
}

/** A tesouraria responde (com o comprovante que faltava, se tiver). */
export async function responderEsclarecimento(
  id: string,
  resposta: string,
  pessoaId: string,
  arquivo: { blob: Blob; extensao: string } | null,
): Promise<Resultado<null>> {
  let caminho: string | null = null
  if (arquivo) {
    // o mesmo tipo dos comprovantes de pagamento: o Conselho Fiscal consegue abrir
    const envio = await enviarArquivo(pessoaId, 'pagamento', arquivo.blob, arquivo.extensao)
    if (envio.erro !== null) return envio
    caminho = envio.dados
  }
  return rpcSemRetorno('responder_esclarecimento', { p_id: id, p_resposta: resposta, p_arquivo: caminho })
}

/** Quem assinou o parecer do ano em vigor (desde a data dele). */
export async function assinaturasDoParecer(balancoId: string, desde: string): Promise<Resultado<Assinatura[]>> {
  const { data, error } = await cliente()
    .from('conselho_assinaturas')
    .select('pessoa_id, assinado_em, pessoa:pessoas!conselho_assinaturas_pessoa_id_fkey(nome)')
    .eq('balanco_id', balancoId)
    .gte('assinado_em', desde)
    .is('arquivado_em', null)
    .order('assinado_em')
    .returns<{ pessoa_id: string; assinado_em: string; pessoa: { nome: string } | null }[]>()
  return error ? falha(error) : ok(data.map((a) => ({ pessoa_id: a.pessoa_id, nome: a.pessoa?.nome ?? '—', em: a.assinado_em })))
}
