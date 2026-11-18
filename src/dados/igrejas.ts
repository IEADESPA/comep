// Fase 5.1 — a igreja como instituição: documentos (estatuto, cartão CNPJ, ata da diretoria), a diretoria da igreja,
// os pedidos de correção no cadastro dos ministros e o resumo (o peso) das igrejas.
import { cliente, falha, ok, type Resultado } from './cliente'

export type TipoDocumentoIgreja = 'estatuto' | 'cartao_cnpj' | 'ata_diretoria' | 'outro'
export type SituacaoDocumentoIgreja = 'pendente' | 'conferido' | 'recusado'

export const NOME_DO_DOCUMENTO: Record<TipoDocumentoIgreja, string> = {
  estatuto: 'Estatuto da igreja',
  cartao_cnpj: 'Cartão CNPJ',
  ata_diretoria: 'Ata da eleição da diretoria',
  outro: 'Outro documento',
}

/** Os documentos que o cadastro da igreja precisa ter conferidos. */
export const DOCUMENTOS_ESSENCIAIS: TipoDocumentoIgreja[] = ['estatuto', 'cartao_cnpj', 'ata_diretoria']

export type DocumentoIgreja = {
  id: string
  igreja_id: string
  tipo: TipoDocumentoIgreja
  descricao: string | null
  arquivo_caminho: string
  situacao: SituacaoDocumentoIgreja
  motivo_recusa: string | null
  criado_em: string
  conferido_em: string | null
}

export async function listarDocumentosIgreja(igrejaId: string): Promise<Resultado<DocumentoIgreja[]>> {
  const { data, error } = await cliente()
    .from('igreja_documentos')
    .select('id, igreja_id, tipo, descricao, arquivo_caminho, situacao, motivo_recusa, criado_em, conferido_em')
    .eq('igreja_id', igrejaId)
    .is('arquivado_em', null)
    .order('criado_em', { ascending: false })
    .returns<DocumentoIgreja[]>()
  return error ? falha(error) : ok(data)
}

/** Envia o arquivo para a pasta da igreja e registra o documento (o anterior do mesmo tipo fica guardado). */
export async function enviarDocumentoIgreja(
  igrejaId: string,
  tipo: TipoDocumentoIgreja,
  arquivo: Blob,
  extensao: string,
  descricao: string,
): Promise<Resultado<string>> {
  const caminho = `${igrejaId}/${tipo}-${Date.now()}.${extensao}`
  const envio = await cliente().storage.from('igrejas').upload(caminho, arquivo, { upsert: false, contentType: arquivo.type })
  if (envio.error) return { dados: null, erro: 'Não foi possível enviar o arquivo. Tente de novo.' }
  const { data, error } = await cliente().rpc('registrar_documento_igreja', {
    p_igreja_id: igrejaId,
    p_tipo: tipo,
    p_caminho: caminho,
    p_descricao: descricao,
  })
  return error ? falha(error) : ok(data as string)
}

export async function conferirDocumentoIgreja(id: string, aceito: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('conferir_documento_igreja', { p_id: id, p_aceito: aceito, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

/** Link temporário (10 minutos) para abrir o documento. */
export async function linkDocumentoIgreja(caminho: string): Promise<string | null> {
  const { data } = await cliente().storage.from('igrejas').createSignedUrl(caminho, 600)
  return data?.signedUrl ?? null
}

/** Documentos esperando a conferência (secretaria e presidência). */
export async function documentosParaConferir(): Promise<Resultado<(DocumentoIgreja & { igreja: { nome: string } | null })[]>> {
  const { data, error } = await cliente()
    .from('igreja_documentos')
    .select('id, igreja_id, tipo, descricao, arquivo_caminho, situacao, motivo_recusa, criado_em, conferido_em, igreja:igrejas(nome)')
    .eq('situacao', 'pendente')
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<(DocumentoIgreja & { igreja: { nome: string } | null })[]>()
  return error ? falha(error) : ok(data)
}

// ---------- Diretoria da igreja ----------

export type MembroDiretoriaIgreja = { id: string; cargo: string; nome: string; inicio: string | null; fim: string | null }

export async function listarDiretoriaIgreja(igrejaId: string): Promise<Resultado<MembroDiretoriaIgreja[]>> {
  const { data, error } = await cliente()
    .from('igreja_diretoria')
    .select('id, cargo, nome, inicio, fim')
    .eq('igreja_id', igrejaId)
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<MembroDiretoriaIgreja[]>()
  return error ? falha(error) : ok(data)
}

/** Troca a diretoria inteira: a anterior fica no histórico. */
export async function salvarDiretoriaIgreja(
  igrejaId: string,
  inicio: string,
  fim: string,
  membros: { cargo: string; nome: string }[],
): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('salvar_diretoria_igreja', {
    p_igreja_id: igrejaId,
    p_inicio: inicio || null,
    p_fim: fim || null,
    p_membros: membros,
  })
  return error ? falha(error) : ok(data as number)
}

// ---------- Pedidos de correção no cadastro ----------

export type SituacaoPedidoCorrecao = 'pendente' | 'atendido' | 'recusado'

/** A lista fechada dos dados que se pedem para corrigir (nada de texto livre: 18/11/2026). */
export type CampoCorrecao = 'nome' | 'telefone' | 'email' | 'cpf' | 'nome_mae' | 'nome_pai' | 'titulo' | 'funcao' | 'igreja'

export const NOME_DO_CAMPO: Record<CampoCorrecao, string> = {
  nome: 'Nome completo',
  telefone: 'Telefone',
  email: 'E-mail',
  cpf: 'CPF',
  nome_mae: 'Nome da mãe',
  nome_pai: 'Nome do pai',
  titulo: 'Título ministerial',
  funcao: 'Função na igreja',
  igreja: 'Igreja',
}

export type PedidoCorrecao = {
  id: string
  pessoa_id: string
  igreja_id: string | null
  texto: string
  /** null = pedido antigo, em texto (antes de 18/11/2026) */
  campo: CampoCorrecao | null
  valor_atual: string | null
  valor_pedido: string | null
  situacao: SituacaoPedidoCorrecao
  resposta: string | null
  criado_em: string
  respondido_em: string | null
  /** só vem para quem pode ler o cadastro (a secretaria, ou a própria pessoa) */
  pessoa: { nome: string } | null
  autor: { nome: string } | null
}

const CAMPOS_PEDIDO =
  'id, pessoa_id, igreja_id, texto, campo, valor_atual, valor_pedido, situacao, resposta, criado_em, respondido_em, ' +
  'pessoa:pessoas!pedidos_correcao_pessoa_id_fkey(nome), autor:pessoas!pedidos_correcao_pedido_por_fkey(nome)'

/** Os pedidos que quem está logado pode ver (os seus, os da sua igreja ou, para a secretaria, todos). */
export async function listarPedidosCorrecao(filtro: { pessoaId?: string; pendentes?: boolean } = {}): Promise<Resultado<PedidoCorrecao[]>> {
  let consulta = cliente().from('pedidos_correcao').select(CAMPOS_PEDIDO).is('arquivado_em', null)
  if (filtro.pessoaId) consulta = consulta.eq('pessoa_id', filtro.pessoaId)
  if (filtro.pendentes) consulta = consulta.eq('situacao', 'pendente')
  const { data, error } = await consulta.order('criado_em', { ascending: false }).limit(200).returns<PedidoCorrecao[]>()
  return error ? falha(error) : ok(data)
}

/**
 * Pede a correção de um dado da lista fechada. O banco guarda como está hoje; no título e na igreja, `referencia`
 * é o escolhido na lista (o `valor` fica vazio).
 */
export async function pedirCorrecaoDado(
  pessoaId: string,
  campo: CampoCorrecao,
  valor: string,
  referencia: string | null = null,
): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('pedir_correcao_dado', {
    p_pessoa_id: pessoaId,
    p_campo: campo,
    p_valor: valor.trim() || null,
    p_referencia: referencia,
  })
  return error ? falha(error) : ok(null)
}

export async function responderCorrecao(id: string, atendido: boolean, resposta: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('responder_correcao', { p_id: id, p_atendido: atendido, p_resposta: resposta })
  return error ? falha(error) : ok(null)
}

export const NOME_DA_SITUACAO_PEDIDO: Record<SituacaoPedidoCorrecao, string> = {
  pendente: 'Esperando a secretaria',
  atendido: 'Atendido',
  recusado: 'Recusado',
}

// ---------- Resumo das igrejas ----------

export type ResumoIgreja = {
  igreja_id: string
  /** o peso da igreja: ministros associados com vínculo atual */
  ministros: number
  ministros_em_dia: number
  documentos_ok: TipoDocumentoIgreja[]
  documentos_pendentes: number
  diretoria: boolean
}

export async function resumoDasIgrejas(): Promise<Resultado<ResumoIgreja[]>> {
  const { data, error } = await cliente().rpc('resumo_das_igrejas')
  return error ? falha(error) : ok((data ?? []) as ResumoIgreja[])
}
