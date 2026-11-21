// As notificações (telas novas, Fase 5.5, parte 11): o sino lê a tabela de notificações, com o lido por pessoa;
// as preferências (o que chega no celular e o silêncio à noite); os aparelhos inscritos para a notificação do
// navegador (push); o recado da secretaria pelo aplicativo e o "Lembrar todos" das Contribuições.
// Quem envia a notificação ao celular é a função supabase/functions/enviar-avisos (com a chave secreta).
import { cliente, falha, ok, type Resultado } from './cliente'

/** Os assuntos dos avisos (a pessoa escolhe quais chegam no celular; no sino aparecem todos). */
export type TipoAviso = 'assembleias' | 'votacoes' | 'mural' | 'mensalidade' | 'documentos' | 'pedido' | 'recado'

/** Os assuntos que a pessoa pode desligar no celular (o recado da secretaria e o pedido de associação sempre chegam). */
export type TipoEscolhivel = Exclude<TipoAviso, 'pedido' | 'recado'>

export const NOME_DO_TIPO_AVISO: Record<TipoEscolhivel, string> = {
  assembleias: 'Convocações de assembleia e reunião, e pedidos de AGE',
  votacoes: 'Votações e enquetes abertas',
  mensalidade: 'Contribuição: lembrete e comprovante conferido',
  documentos: 'Documentos da igreja: 60 e 30 dias antes de vencer',
  mural: 'Avisos novos no mural',
}

export type Notificacao = {
  id: string
  tipo: TipoAviso
  titulo: string
  texto: string
  link: string | null
  urgente: boolean
  quando: string
  lida_em: string | null
  /** quem mandou (o recado da secretaria); null = o próprio sistema */
  enviada_por: string | null
}

export type MinhasNotificacoes = { itens: Notificacao[]; nao_lidas: number }

/** As minhas notificações, da mais nova para a mais velha (e quantas ainda não li). */
export async function minhasNotificacoes(limite = 30): Promise<Resultado<MinhasNotificacoes>> {
  const { data, error } = await cliente().rpc('minhas_notificacoes', { p_limite: limite })
  return error ? falha(error) : ok((data ?? { itens: [], nao_lidas: 0 }) as MinhasNotificacoes)
}

/** Marca como lidas (sem a lista: todas). */
export async function marcarNotificacoesLidas(ids: string[] | null): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('marcar_notificacoes_lidas', { p_ids: ids })
  return error ? falha(error) : ok((data ?? 0) as number)
}

export type AparelhoInscrito = { id: string; endpoint: string; aparelho: string | null; criado_em: string; ultimo_envio_em: string | null }

export type PreferenciasAvisos = {
  ativou_em: string | null
  recusou_em: string | null
  tipos_desligados: TipoEscolhivel[]
  silencio_noite: boolean
  aparelhos: AparelhoInscrito[]
}

export async function minhasPreferenciasAvisos(): Promise<Resultado<PreferenciasAvisos>> {
  const { data, error } = await cliente().rpc('minhas_preferencias_avisos')
  return error ? falha(error) : ok(data as PreferenciasAvisos)
}

export type MudancaPreferencias = {
  /** a resposta do primeiro acesso */
  resposta?: 'ativar' | 'agora_nao'
  tipos_desligados?: TipoEscolhivel[]
  silencio_noite?: boolean
}

export async function salvarPreferenciasAvisos(mudanca: MudancaPreferencias): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('salvar_preferencias_avisos', { p_dados: mudanca })
  return error ? falha(error) : ok(null)
}

/** Guarda a inscrição deste aparelho (o endereço e as chaves que o navegador deu). */
export async function registrarInscricaoPush(inscricao: {
  endpoint: string
  p256dh: string
  auth: string
  aparelho: string
}): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('registrar_inscricao_push', {
    p_endpoint: inscricao.endpoint,
    p_p256dh: inscricao.p256dh,
    p_auth: inscricao.auth,
    p_aparelho: inscricao.aparelho,
  })
  return error ? falha(error) : ok(data as string)
}

/** Este aparelho (pelo endereço) ou um dos meus aparelhos (pelo id) para de receber. */
export async function cancelarInscricaoPush(alvo: { endpoint?: string; id?: string }): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_inscricao_push', { p_endpoint: alvo.endpoint ?? null, p_id: alvo.id ?? null })
  return error ? falha(error) : ok(null)
}

export type AssuntoRecado = 'recado' | 'mensalidade' | 'assembleias' | 'documentos'

/** "Mandar pelo aplicativo": o recado chega no sino (e no celular, se a pessoa ativou). */
export async function mandarRecado(pessoaId: string, assunto: AssuntoRecado, titulo: string, texto: string): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('mandar_recado', { p_pessoa_id: pessoaId, p_tipo: assunto, p_titulo: titulo, p_texto: texto })
  return error ? falha(error) : ok(data as string)
}

/** "Lembrar todos" (Contribuições): o lembrete para quem está em atraso. Devolve para quantos foi. */
export async function lembrarContribuicoesEmAtraso(): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('lembrar_contribuicoes_em_atraso')
  return error ? falha(error) : ok((data ?? 0) as number)
}

export type SituacaoDosAvisos = {
  pessoas: number
  ativaram: number
  recusaram: number
  aparelhos: number
  pessoas_com_aparelho: number
  ultimo_envio: string | null
  esperando_envio: number
  notificacoes_7_dias: number
}

/** Administração › Avisos e notificações. */
export async function situacaoDosAvisos(): Promise<Resultado<SituacaoDosAvisos>> {
  const { data, error } = await cliente().rpc('situacao_dos_avisos')
  return error ? falha(error) : ok(data as SituacaoDosAvisos)
}
