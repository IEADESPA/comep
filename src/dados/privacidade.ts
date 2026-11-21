// A privacidade (telas novas, Fase 5.5, parte 13): o termo de uso de dados (LGPD), com versão e aceite;
// Meu perfil › Privacidade (o termo aceito, os meus dados, o pedido de exclusão e quem mexeu nos dados);
// a secretaria (as versões, o rascunho, publicar, o lembrete e os pedidos).
import { cliente, falha, ok, type Resultado } from './cliente'

export type PontoDoResumo = { icone: string; titulo: string; texto: string }
export type ParteDoTermo = { titulo: string; texto: string }

export type Termo = {
  id: string
  versao: number
  resumo: PontoDoResumo[]
  partes: ParteDoTermo[]
  mudancas: string[]
  minuta: boolean
  vale_a_partir: string
  publicado_em: string | null
  /** o meu aceite desta versão (null: ainda não aceitei) */
  aceite?: { aceito_em: string; aparelho: string | null } | null
}

export type MeuTermo = {
  /** tem algum perfil (o termo é para quem é do COMEP; o candidato consente no pedido de associação) */
  do_comep: boolean
  /** a versão que vale hoje */
  atual: Termo | null
  /** a versão já publicada que passa a valer depois */
  proxima: Termo | null
  /** a versão a aceitar agora (null: nada a aceitar) */
  pedir: Termo | null
}

export async function meuTermo(): Promise<Resultado<MeuTermo>> {
  const { data, error } = await cliente().rpc('meu_termo')
  return error ? falha(error) : ok(data as MeuTermo)
}

export async function aceitarTermo(dados: {
  termoId: string
  aparelho: string
  dadoSensivel: boolean
  receberWhatsapp: boolean
  aparecerAniversariantes: boolean
}): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('aceitar_termo', {
    p_termo_id: dados.termoId,
    p_aparelho: dados.aparelho,
    p_dado_sensivel: dados.dadoSensivel,
    p_whatsapp: dados.receberWhatsapp,
    p_aniversariantes: dados.aparecerAniversariantes,
  })
  return error ? falha(error) : ok(null)
}

export type MinhaPrivacidade = {
  receber_whatsapp: boolean
  aparecer_aniversariantes: boolean
  aceites: { termo_id: string; versao: number; aceito_em: string; aparelho: string | null }[]
  pedidos: { id: string; tipo: 'exclusao'; texto: string; situacao: 'pendente' | 'atendido' | 'recusado'; resposta: string | null; criado_em: string; respondido_em: string | null }[]
  quem_mexeu: { em: string; quem: string; perfil: string | null; o_que: string; operacao: 'INSERT' | 'UPDATE' | 'DELETE' }[]
}

export async function minhaPrivacidade(): Promise<Resultado<MinhaPrivacidade>> {
  const { data, error } = await cliente().rpc('minha_privacidade')
  return error ? falha(error) : ok(data as MinhaPrivacidade)
}

export async function salvarPrivacidade(mudanca: { receber_whatsapp?: boolean; aparecer_aniversariantes?: boolean }): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('salvar_privacidade', { p_dados: mudanca })
  return error ? falha(error) : ok(null)
}

/** Tudo o que o COMEP guarda sobre mim (para baixar num arquivo). */
export async function meusDados(): Promise<Resultado<Record<string, unknown>>> {
  const { data, error } = await cliente().rpc('meus_dados')
  return error ? falha(error) : ok(data as Record<string, unknown>)
}

export async function pedirExclusao(texto: string): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('pedir_exclusao', { p_texto: texto })
  return error ? falha(error) : ok(data as string)
}

// ---------- A secretaria ----------

export type VersaoDoTermo = Termo & { aceites: number; faltam: number }
export type PedidoDoTitular = {
  id: string
  nome: string
  pessoa_id: string
  tipo: 'exclusao'
  texto: string
  situacao: 'pendente' | 'atendido' | 'recusado'
  resposta: string | null
  criado_em: string
}
export type VersoesDoTermo = { pessoas: number; versoes: VersaoDoTermo[]; pedidos: PedidoDoTitular[] }

export async function versoesDoTermo(): Promise<Resultado<VersoesDoTermo>> {
  const { data, error } = await cliente().rpc('versoes_do_termo')
  return error ? falha(error) : ok(data as VersoesDoTermo)
}

export async function salvarRascunhoTermo(dados: {
  mudancas?: string[]
  vale_a_partir?: string
  minuta?: boolean
  resumo?: PontoDoResumo[]
  partes?: ParteDoTermo[]
}): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_rascunho_termo', { p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function publicarTermo(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('publicar_termo', { p_id: id })
  return error ? falha(error) : ok(null)
}

/** "Mandar lembrete": o aviso no sino de quem ainda não aceitou a versão. Devolve para quantos foi. */
export async function lembrarTermo(id: string): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('lembrar_termo', { p_id: id })
  return error ? falha(error) : ok((data ?? 0) as number)
}

export async function responderPedidoTitular(id: string, atendido: boolean, resposta: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('responder_pedido_titular', { p_id: id, p_atendido: atendido, p_resposta: resposta })
  return error ? falha(error) : ok(null)
}

/** A ficha do ministro: a pessoa quer receber avisos pelo WhatsApp? */
export async function privacidadeDe(pessoaId: string): Promise<Resultado<{ receber_whatsapp: boolean }>> {
  const { data, error } = await cliente().rpc('privacidade_de', { p_pessoa: pessoaId })
  return error ? falha(error) : ok(data as { receber_whatsapp: boolean })
}
