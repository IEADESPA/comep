// Fase 5.5.3 — Pedido de Assembleia Extraordinária on-line (Art. 16, §3º; 17/11/2026).
// Um associado em dia abre o pedido com a pauta; os outros assinam; com 3/5 dos aptos (ou a maioria simples do Conselho
// Diretor) o pedido fica atingido e a presidência marca a AGE a partir dele.
import { cliente, falha, ok, type Resultado } from './cliente'

export type SituacaoPedidoAge = 'coletando' | 'atingido' | 'atendido' | 'cancelado'

export type ContaPedidoAge = {
  assinaturas: number
  aptos: number
  assinaturas_aptas: number
  minimo_associados: number
  diretoria: number
  assinaturas_diretoria: number
  minimo_diretoria: number
}

export type PedidoAgeNaLista = {
  id: string
  titulo: string
  situacao: SituacaoPedidoAge
  prazo: string
  criado_em: string
  expirado: boolean
  autor: string
  conta: ContaPedidoAge
  eu_assinei: boolean
  posso_assinar: boolean
  encontro_id: string | null
}

export type PedidoAge = Omit<PedidoAgeNaLista, 'autor'> & {
  justificativa: string
  pauta: { titulo: string; descricao: string | null }[]
  autor: string
  sou_autor: boolean
  atingido_em: string | null
  atingido_por: 'associados' | 'diretoria' | null
  motivo_cancelamento: string | null
  assinaturas: { nome: string; assinado_em: string; conta: boolean; diretoria: boolean }[]
}

export async function listarPedidosAge(): Promise<Resultado<PedidoAgeNaLista[]>> {
  const { data, error } = await cliente().rpc('listar_pedidos_age')
  return error ? falha(error) : ok((data ?? []) as PedidoAgeNaLista[])
}

export async function buscarPedidoAge(id: string): Promise<Resultado<PedidoAge | null>> {
  const { data, error } = await cliente().rpc('detalhe_pedido_age', { p_id: id })
  return error ? falha(error) : ok((data ?? null) as PedidoAge | null)
}

export type NovoPedidoAge = { titulo: string; justificativa: string; pauta: { titulo: string; descricao: string }[] }

export async function criarPedidoAge(dados: NovoPedidoAge): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('criar_pedido_age', { p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function assinarPedidoAge(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('assinar_pedido_age', { p_id: id })
  return error ? falha(error) : ok(null)
}

export async function retirarAssinaturaAge(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('retirar_assinatura_age', { p_id: id })
  return error ? falha(error) : ok(null)
}

export async function cancelarPedidoAge(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_pedido_age', { p_id: id, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

/** Marca a AGE (em preparo) a partir do pedido atingido; devolve o id da assembleia. `inicio` é um instante com fuso. */
export async function marcarAgeDoPedido(id: string, dados: { titulo: string; inicio: string; local: string }): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('marcar_age_do_pedido', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}
