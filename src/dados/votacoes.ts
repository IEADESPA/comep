// Fase 5.5.2 — Votações e enquetes on-line (17/11/2026). A secretaria ou a presidência prepara, abre e encerra;
// os associados votam pelo celular. No voto secreto, o banco guarda QUEM votou, não O QUE votou.
import { cliente, falha, ok, type Resultado } from './cliente'
import type { Maioria } from './encontros'

export type TipoVotacao = 'enquete' | 'votacao'
export type SituacaoVotacao = 'rascunho' | 'aberta' | 'encerrada' | 'cancelada'
export type QuemVota = 'associados' | 'em_dia' | 'presentes'

export const NOME_DO_TIPO_VOTACAO: Record<TipoVotacao, string> = { enquete: 'Enquete', votacao: 'Votação' }

export const NOME_DE_QUEM_VOTA: Record<QuemVota, string> = {
  associados: 'Todos os associados',
  em_dia: 'Os associados em dia',
  presentes: 'Os presentes na assembleia (em dia)',
}

export type ItemDaLista = {
  id: string
  tipo: TipoVotacao
  titulo: string
  situacao: SituacaoVotacao
  fecha_em: string | null
  aberta_em: string | null
  encerrada_em: string | null
  criado_em: string
  encontro: string | null
  /** encerrada, ou aberta com o prazo vencido */
  fechada: boolean
  votantes: number
  eu_votei: boolean
  posso_votar: boolean
}

export async function listarVotacoes(): Promise<Resultado<ItemDaLista[]>> {
  const { data, error } = await cliente().rpc('listar_votacoes')
  return error ? falha(error) : ok((data ?? []) as ItemDaLista[])
}

export type Votacao = {
  id: string
  tipo: TipoVotacao
  titulo: string
  descricao: string | null
  encontro_id: string | null
  pauta_id: string | null
  quem_vota: QuemVota
  secreta: boolean
  max_escolhas: number
  maioria: Maioria | null
  parcial_visivel: boolean
  fecha_em: string | null
  situacao: SituacaoVotacao
  aberta_em: string | null
  encerrada_em: string | null
  deliberacao_id: string | null
  motivo_cancelamento: string | null
  encontro: { titulo: string } | null
  opcoes: { id: string; ordem: number; texto: string; arquivado_em: string | null }[]
}

export async function buscarVotacao(id: string): Promise<Resultado<Votacao | null>> {
  const { data, error } = await cliente()
    .from('votacoes')
    .select(
      `id, tipo, titulo, descricao, encontro_id, pauta_id, quem_vota, secreta, max_escolhas, maioria, parcial_visivel, fecha_em, situacao,
       aberta_em, encerrada_em, deliberacao_id, motivo_cancelamento, encontro:encontros(titulo),
       opcoes:votacao_opcoes!votacao_opcoes_votacao_id_fkey(id, ordem, texto, arquivado_em)`,
    )
    .eq('id', id)
    .maybeSingle<Votacao>()
  if (error) return falha(error)
  if (!data) return ok(null)
  return ok({ ...data, opcoes: data.opcoes.filter((o) => o.arquivado_em === null).sort((a, b) => a.ordem - b.ordem) })
}

export type ResultadoVotacao = {
  id: string
  fechada: boolean
  votantes: number
  aptos: number
  eu_votei: boolean
  posso_votar: boolean
  /** só no voto aberto */
  minhas_opcoes: string[] | null
  mostra_contagem: boolean
  opcoes: { id: string; texto: string; papel: 'a_favor' | 'contra' | 'abstencao' | null; votos: number | null }[]
  aprovada: boolean | null
  nominal: { nome: string; opcoes: string[] | null }[] | null
}

export async function resultadoVotacao(id: string): Promise<Resultado<ResultadoVotacao | null>> {
  const { data, error } = await cliente().rpc('resultado_votacao', { p_id: id })
  return error ? falha(error) : ok((data ?? null) as ResultadoVotacao | null)
}

export type DadosVotacao = {
  tipo: TipoVotacao
  titulo: string
  descricao: string
  encontro_id: string | null
  pauta_id: string | null
  quem_vota: QuemVota
  secreta: boolean
  max_escolhas: number
  maioria: Maioria | null
  parcial_visivel: boolean
  /** instante com fuso, ou vazio */
  fecha_em: string
  opcoes: string[]
}

export async function salvarVotacao(id: string | null, dados: DadosVotacao): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_votacao', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function abrirVotacao(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('abrir_votacao', { p_id: id })
  return error ? falha(error) : ok(null)
}

export async function encerrarVotacao(id: string): Promise<Resultado<ResultadoVotacao>> {
  const { data, error } = await cliente().rpc('encerrar_votacao', { p_id: id })
  return error ? falha(error) : ok(data as ResultadoVotacao)
}

export async function cancelarVotacao(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_votacao', { p_id: id, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function votar(id: string, opcoes: string[]): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('votar', { p_id: id, p_opcoes: opcoes })
  return error ? falha(error) : ok(null)
}

export type ItemDePautaParaVotar = {
  id: string
  titulo: string
  encontro_id: string
  maioria: Maioria | null
  deliberativo: boolean
  encontro: { titulo: string; instalada_em: string | null } | null
}

export async function buscarItemDePauta(id: string): Promise<Resultado<ItemDePautaParaVotar | null>> {
  const { data, error } = await cliente()
    .from('encontro_pauta')
    .select('id, titulo, encontro_id, maioria, deliberativo, encontro:encontros(titulo, instalada_em)')
    .eq('id', id)
    .maybeSingle<ItemDePautaParaVotar>()
  return error ? falha(error) : ok(data)
}

export type VotacaoDoItem = {
  id: string
  pauta_id: string | null
  titulo: string
  situacao: SituacaoVotacao
  secreta: boolean
  parcial_visivel: boolean
  aberta_em: string | null
}

/** As votações on-line dos itens da pauta de um encontro (a condução e o telão; parte 14). */
export async function votacoesDoEncontro(encontroId: string): Promise<Resultado<VotacaoDoItem[]>> {
  const { data, error } = await cliente()
    .from('votacoes')
    .select('id, pauta_id, titulo, situacao, secreta, parcial_visivel, aberta_em')
    .eq('encontro_id', encontroId)
    .not('pauta_id', 'is', null)
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<VotacaoDoItem[]>()
  return error ? falha(error) : ok(data)
}
