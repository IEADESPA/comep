// Fase 5.3 — Eventos e projetos (Art. 3º, VII): preparar e publicar (secretaria — o secretário executivo — e presidência),
// orçamento aprovado pela assembleia, inscrição pelo site ou pelo sistema, taxa e lançamentos ligados ao evento.
import { cliente, falha, ok, type Resultado } from './cliente'

export type TipoEvento = 'evento' | 'projeto'
export type SituacaoEvento = 'rascunho' | 'publicado' | 'realizado' | 'cancelado'
export type SituacaoInscricao = 'confirmada' | 'aguardando_pagamento' | 'cancelada'

export const NOME_DO_TIPO_EVENTO: Record<TipoEvento, string> = { evento: 'Evento', projeto: 'Projeto' }
export const NOME_DA_SITUACAO_EVENTO: Record<SituacaoEvento, string> = {
  rascunho: 'Rascunho (não publicado)',
  publicado: 'Publicado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}
export const NOME_DA_SITUACAO_INSCRICAO: Record<SituacaoInscricao, string> = {
  confirmada: 'Confirmada',
  aguardando_pagamento: 'Aguardando o pagamento',
  cancelada: 'Cancelada',
}

export type Evento = {
  id: string
  tipo: TipoEvento
  titulo: string
  descricao: string | null
  local: string | null
  inicio: string
  fim: string | null
  responsavel_id: string | null
  orcamento: number | null
  orcamento_encontro_id: string | null
  orcamento_aprovado_em: string | null
  inscricao: boolean
  inscricao_publica: boolean
  inscricao_ate: string | null
  vagas: number | null
  taxa: number
  situacao: SituacaoEvento
  publicado_em: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
  /** o nome só vem para quem lê o cadastro (a diretoria) */
  responsavel?: { nome: string } | null
}

const CAMPOS =
  'id, tipo, titulo, descricao, local, inicio, fim, responsavel_id, orcamento, orcamento_encontro_id, orcamento_aprovado_em, ' +
  'inscricao, inscricao_publica, inscricao_ate, vagas, taxa, situacao, publicado_em, cancelado_em, motivo_cancelamento'

export async function listarEventos(): Promise<Resultado<Evento[]>> {
  const { data, error } = await cliente().from('eventos').select(CAMPOS).order('inicio', { ascending: false }).returns<Evento[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarEvento(id: string): Promise<Resultado<Evento | null>> {
  const { data, error } = await cliente()
    .from('eventos')
    .select(`${CAMPOS}, responsavel:pessoas!eventos_responsavel_id_fkey(nome)`)
    .eq('id', id)
    .maybeSingle<Evento>()
  return error ? falha(error) : ok(data)
}

export type DadosEvento = {
  tipo: TipoEvento
  titulo: string
  descricao: string
  local: string
  /** instantes com fuso (ISO) */
  inicio: string
  fim: string
  responsavel_id: string
  orcamento: string
  inscricao: boolean
  inscricao_publica: boolean
  inscricao_ate: string
  vagas: string
  taxa: string
}

export async function salvarEvento(id: string | null, dados: DadosEvento): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_evento', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

const acao = async (funcao: string, args: Record<string, unknown>): Promise<Resultado<null>> => {
  const { error } = await cliente().rpc(funcao, args)
  return error ? falha(error) : ok(null)
}
export const publicarEvento = (id: string) => acao('publicar_evento', { p_id: id })
export const cancelarEvento = (id: string, motivo: string) => acao('cancelar_evento', { p_id: id, p_motivo: motivo })
export const concluirEvento = (id: string) => acao('concluir_evento', { p_id: id })
export const arquivarEvento = (id: string) => acao('arquivar_evento', { p_id: id })
export const aprovarOrcamento = (id: string, encontroId: string) => acao('aprovar_orcamento_evento', { p_id: id, p_encontro_id: encontroId })
export const cancelarInscricao = (id: string, motivo: string) => acao('cancelar_inscricao', { p_id: id, p_motivo: motivo })
/** A secretaria libera as vagas das inscrições que esperam pagamento há mais de 72 horas. */
export const cancelarInscricoesSemPagamento = (eventoId: string) => acao('cancelar_inscricoes_sem_pagamento', { p_evento_id: eventoId })
export const registrarPagamentoInscricao = (id: string, data: string, forma: string) =>
  acao('registrar_pagamento_inscricao', { p_id: id, p_data: data, p_forma: forma })
export const ligarLancamentoEvento = (lancamentoId: string, eventoId: string | null) =>
  acao('ligar_lancamento_evento', { p_lancamento_id: lancamentoId, p_evento_id: eventoId })

// ---------- Inscrições ----------

export type Inscricao = {
  id: string
  evento_id: string
  numero: number
  nome: string
  telefone: string
  igreja: string | null
  pessoa_id: string | null
  situacao: SituacaoInscricao
  valor: number
  pago_em: string | null
  criado_em: string
}

/** A diretoria e a tesouraria veem todas; o associado, só a própria (a RLS decide). */
export async function listarInscricoes(eventoId: string): Promise<Resultado<Inscricao[]>> {
  const { data, error } = await cliente()
    .from('evento_inscricoes')
    .select('id, evento_id, numero, nome, telefone, igreja, pessoa_id, situacao, valor, pago_em, criado_em')
    .eq('evento_id', eventoId)
    .order('numero')
    .returns<Inscricao[]>()
  return error ? falha(error) : ok(data)
}

export type InscricaoFeita = { numero: number; situacao: SituacaoInscricao; valor: number }

/** Pelo site (sem login) ou pelo sistema (o associado logado). */
export async function inscrever(
  eventoId: string,
  dados: { nome: string; telefone: string; igreja: string; aceite: boolean },
): Promise<Resultado<InscricaoFeita>> {
  const { data, error } = await cliente().rpc('inscrever_no_evento', {
    p_evento_id: eventoId,
    p_nome: dados.nome,
    p_telefone: dados.telefone,
    p_igreja: dados.igreja,
    p_aceite: dados.aceite,
  })
  return error ? falha(error) : ok(data as InscricaoFeita)
}

// ---------- Finanças do evento ----------

export type FinancasEvento = { receitas: number; despesas: number; aguardando: number }

export async function financasDoEvento(id: string): Promise<Resultado<FinancasEvento>> {
  const { data, error } = await cliente().rpc('financas_do_evento', { p_evento_id: id })
  return error ? falha(error) : ok(data as FinancasEvento)
}

export type LancamentoParaLigar = { id: string; tipo: 'entrada' | 'saida'; data: string; valor: number; descricao: string; evento_id: string | null }

/** Lançamentos recentes do caixa (para a tesouraria ligar ao evento). */
export async function lancamentosRecentes(): Promise<Resultado<LancamentoParaLigar[]>> {
  const { data, error } = await cliente()
    .from('lancamentos')
    .select('id, tipo, data, valor, descricao, evento_id')
    .neq('situacao', 'cancelado')
    .is('arquivado_em', null)
    .order('data', { ascending: false })
    .limit(200)
    .returns<LancamentoParaLigar[]>()
  return error ? falha(error) : ok(data)
}

// ---------- O site ----------

export type EventoPublico = {
  id: string
  tipo: TipoEvento
  titulo: string
  descricao: string | null
  local: string | null
  inicio: string
  fim: string | null
  situacao: SituacaoEvento
  motivo_cancelamento: string | null
  inscricao: boolean
  inscricao_publica: boolean
  inscricao_ate: string
  taxa: number
  vagas_restantes: number | null
}

export async function eventosPublicos(): Promise<Resultado<EventoPublico[]>> {
  const { data, error } = await cliente().rpc('eventos_publicos')
  return error ? falha(error) : ok((data ?? []) as EventoPublico[])
}

/** Inscrição aberta agora (publicado, com inscrição, dentro do prazo e com vaga). */
export function inscricaoAberta(e: Pick<EventoPublico, 'situacao' | 'inscricao' | 'inscricao_ate' | 'vagas_restantes'>, agora: number): boolean {
  return e.situacao === 'publicado' && e.inscricao && new Date(e.inscricao_ate).getTime() > agora && (e.vagas_restantes === null || e.vagas_restantes > 0)
}
