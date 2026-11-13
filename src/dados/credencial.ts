// Credencial do associado — Fase 3.1: dados (CPF, filiação, sigla da igreja) e pendências.
import { cliente, falha, ok, type Resultado } from './cliente'

/** CPF (só números) e filiação, como estão gravados no cadastro da pessoa. */
export type IdentidadeGravada = { cpf: string | null; nome_pai: string | null; nome_mae: string | null }

export const MENSAGEM_CPF_REPETIDO = 'Este CPF já está no cadastro de outra pessoa. Confira os números ou fale com a secretaria.'

export type PendenciaCredencial = {
  associado_id: string
  pessoa_id: string
  numero_registro: number
  nome: string
  igreja_id: string | null
  igreja: string | null
  pendencias: string[]
}

/** Todos os associados ativos e o que falta na credencial de cada um (a diretoria vê todos; o associado, o seu). */
export async function listarPendencias(): Promise<Resultado<PendenciaCredencial[]>> {
  const { data, error } = await cliente()
    .from('vw_pendencias_credencial')
    .select('*')
    .order('nome')
    .returns<PendenciaCredencial[]>()
  return error ? falha(error) : ok(data)
}

/** O que falta na credencial de uma pessoa (null = não é associado ativo). */
export async function pendenciasDe(pessoaId: string): Promise<Resultado<string[] | null>> {
  const { data, error } = await cliente()
    .from('vw_pendencias_credencial')
    .select('pendencias')
    .eq('pessoa_id', pessoaId)
    .maybeSingle<{ pendencias: string[] }>()
  return error ? falha(error) : ok(data ? data.pendencias : null)
}

// ---------- Credencial digital, validação pública e impressão (Fase 3.2/3.3) ----------

export type DadosCredencial = {
  pessoa_id: string
  codigo: string
  nome: string
  cpf: string | null
  nome_pai: string | null
  nome_mae: string | null
  numero_registro: number
  admitido_em: string | null
  titulo: string | null
  funcao: string | null
  igreja: string | null
  igreja_sigla: string | null
  igreja_cnpj: string | null
  foto_caminho: string | null
  foto_publica: string | null
  /** fim do mandato quando a credencial foi emitida (vai impresso; a impressa vale até essa data) */
  valida_ate: string | null
  emitida_em: string | null
  em_dia: boolean
  jubilado: boolean
  pendencias: string[]
}

export type PacoteCredenciais = {
  fim_mandato: string | null
  texto_verso: string
  /** modelo (desenho) em uso; vazio = o padrão do sistema */
  modelo?: unknown
  credenciais: DadosCredencial[]
}

/** Dados para mostrar/imprimir (cria a credencial na primeira vez). A própria, ou de vários (secretaria/presidência). */
export async function dadosCredenciais(pessoas: string[]): Promise<Resultado<PacoteCredenciais>> {
  const { data, error } = await cliente().rpc('dados_credenciais', { p_pessoas: pessoas })
  return error ? falha(error) : ok(data as PacoteCredenciais)
}

/** Perda, roubo ou dados que mudaram: emite outra; o QR Code antigo passa a dizer "substituída". */
export async function substituirCredencial(pessoaId: string, motivo: string): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('substituir_credencial', { p_pessoa_id: pessoaId, p_motivo: motivo })
  return error ? falha(error) : ok(data as string)
}

export type SituacaoValidacao = 'valida' | 'vencida' | 'substituida' | 'inativa' | 'inexistente'

export type Validacao = {
  situacao: SituacaoValidacao
  consultado_em: string
  nome?: string | null
  titulo?: string | null
  numero_registro?: number
  igreja?: string | null
  foto_publica?: string | null
  em_dia?: boolean
  valida_ate?: string | null
  /** é de um mandato anterior (a credencial já foi renovada) */
  renovada?: boolean
  substituida_em?: string
}

/** Página pública do QR Code: funciona sem login. */
export async function validarCredencial(codigo: string): Promise<Resultado<Validacao>> {
  const { data, error } = await cliente().rpc('validar_credencial', { p_codigo: codigo })
  return error ? falha(error) : ok(data as Validacao)
}

/** Endereço que vai no QR Code (o mesmo site onde a credencial foi gerada). */
export function urlValidacao(codigo: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}validar/${codigo}`
}

/** Imagem usada no modelo da credencial: o logo do sistema ou uma imagem enviada no editor. */
export function urlImagemModelo(arquivo: string): string {
  if (arquivo === 'logo') return `${import.meta.env.BASE_URL}logo.svg`
  return cliente().storage.from('credencial-modelo').getPublicUrl(arquivo).data.publicUrl
}

/** A cópia pública da foto (pasta "credenciais", só quem tem o código acha). */
export function urlFotoPublica(caminho: string): string {
  return cliente().storage.from('credenciais').getPublicUrl(caminho).data.publicUrl
}

/**
 * Publica a cópia da foto para a página de validação, se ainda não estiver publicada
 * (ou se a foto mudou). Nada se sobrescreve: cada foto nova vira um arquivo novo na pasta do código.
 */
export async function publicarFoto(c: DadosCredencial, linkPrivado: (caminho: string) => Promise<string | null>) {
  if (!c.foto_caminho) return null
  const destino = `${c.codigo}/${c.foto_caminho.split('/').pop()}`
  if (c.foto_publica === destino) return destino
  const link = await linkPrivado(c.foto_caminho)
  if (!link) return null
  const resposta = await fetch(link)
  if (!resposta.ok) return null
  const arquivo = await resposta.blob()
  const envio = await cliente().storage.from('credenciais').upload(destino, arquivo, { upsert: false, contentType: arquivo.type })
  if (envio.error && !/exists|duplicate/i.test(envio.error.message)) return null
  const { error } = await cliente().rpc('registrar_foto_publica', { p_codigo: c.codigo, p_caminho: destino })
  return error ? null : destino
}

export type ConfigCredencial = { fim_mandato: string | null; texto_verso: string }

export async function buscarConfigCredencial(): Promise<Resultado<ConfigCredencial>> {
  const { data, error } = await cliente().from('config_credencial').select('fim_mandato, texto_verso').single<ConfigCredencial>()
  return error ? falha(error) : ok(data)
}

/** Posse da nova diretoria: renova as credenciais (as impressas antigas valem até o fim do mandato atual). */
export async function registrarNovoMandato(fim: string): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('registrar_novo_mandato', { p_fim: fim })
  return error ? falha(error) : ok(data as number)
}

export async function salvarConfigCredencial(config: ConfigCredencial): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('config_credencial')
    .update({ fim_mandato: config.fim_mandato || null, texto_verso: config.texto_verso.trim() })
    .eq('id', true)
  return error ? falha(error) : ok(null)
}
