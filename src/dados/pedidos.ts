// Pedido de associação (Art. 7º) e arquivos (foto e comprovante) no Storage.
import { cliente, falha, ok, type Resultado } from './cliente'
import { gravarIdentidade, lerIdentidade, type IdentidadeGravada } from './credencial'
import { semInvisiveis } from '../utilitarios/textoLimpo'

export type SituacaoPedido = 'enviado' | 'pendencia' | 'aguardando_assembleia' | 'aprovado' | 'recusado' | 'desistiu'

export const NOME_DA_SITUACAO_PEDIDO: Record<SituacaoPedido, string> = {
  enviado: 'Aguardando análise da diretoria',
  pendencia: 'Com pendência (correção pedida)',
  aguardando_assembleia: 'Aguardando a Assembleia Ordinária',
  aprovado: 'Aprovado em assembleia',
  recusado: 'Recusado',
  desistiu: 'Desistência',
}

export type DadosPedido = {
  titulo_id: string
  titulo_desde: string
  igreja_id: string
  igreja_informada: string
  denominacao_informada: string
  funcao: string
  pastor_presidente: boolean
  foto_caminho: string | null
  comprovante_caminho: string | null
  observacoes: string
  declara_principios_fe: boolean
  declara_estatuto: boolean
  consente_lgpd: boolean
}

/** O que a secretaria confere no pedido, item por item (parte 4 das telas novas, 18/11/2026). */
export type ItemPedido = 'dados_pessoais' | 'igreja_titulo' | 'foto' | 'comprovante'
export type SituacaoItem = 'analise' | 'aprovado' | 'recusado'

export const ITENS_DO_PEDIDO: readonly { chave: ItemPedido; nome: string }[] = [
  { chave: 'dados_pessoais', nome: 'Dados pessoais' },
  { chave: 'igreja_titulo', nome: 'Igreja e título' },
  { chave: 'foto', nome: 'Foto 3×4' },
  { chave: 'comprovante', nome: 'Comprovante do título' },
]

export type ConferenciaItem = {
  item: ItemPedido
  situacao: SituacaoItem
  motivo: string | null
  conferido_em: string | null
}

export type Pedido = DadosPedido & {
  id: string
  pessoa_id: string
  situacao: SituacaoPedido
  enviado_em: string | null
  declaracoes_em: string | null
  mensagem_pendencia: string | null
  aceite_diretor_em: string | null
  assembleia_data: string | null
  assembleia_ata: string | null
  motivo_recusa: string | null
  decisao_em: string | null
  associado_id: string | null
  criado_em: string
  pessoa: { nome: string; email: string | null; telefone: string | null } | null
  titulo: { nome: string } | null
  igreja: { nome: string } | null
  aceite_diretor: { nome: string } | null
  /** a conferência da secretaria (item sem linha = em análise) */
  itens: ConferenciaItem[]
}

const CAMPOS_PEDIDO = `
  id, pessoa_id, situacao, titulo_id, titulo_desde, igreja_id, igreja_informada, denominacao_informada, funcao,
  pastor_presidente, foto_caminho, comprovante_caminho, observacoes, declara_principios_fe, declara_estatuto,
  consente_lgpd, declaracoes_em, enviado_em, mensagem_pendencia, aceite_diretor_em, assembleia_data, assembleia_ata,
  motivo_recusa, decisao_em, associado_id, criado_em,
  pessoa:pessoas!pedidos_associacao_pessoa_id_fkey(nome, email, telefone),
  titulo:titulos_ministeriais(nome),
  igreja:igrejas(nome),
  aceite_diretor:pessoas!pedidos_associacao_aceite_diretor_por_fkey(nome),
  itens:pedidos_associacao_itens(item, situacao, motivo, conferido_em)`

const vazioParaNulo = (v: string) => (v.trim() ? v.trim() : null)

function paraBanco(d: DadosPedido) {
  return {
    titulo_id: d.titulo_id || null,
    titulo_desde: d.titulo_desde || null,
    igreja_id: d.igreja_id || null,
    igreja_informada: d.igreja_id ? null : vazioParaNulo(d.igreja_informada),
    denominacao_informada: d.igreja_id ? null : vazioParaNulo(d.denominacao_informada),
    funcao: vazioParaNulo(d.funcao),
    pastor_presidente: d.pastor_presidente,
    foto_caminho: d.foto_caminho,
    comprovante_caminho: d.comprovante_caminho,
    observacoes: vazioParaNulo(d.observacoes),
    declara_principios_fe: d.declara_principios_fe,
    declara_estatuto: d.declara_estatuto,
    consente_lgpd: d.consente_lgpd,
  }
}

// ---------- Candidato ----------

/** O pedido mais recente da própria pessoa (a RLS só devolve os dela). */
export async function meuPedido(pessoaId: string): Promise<Resultado<Pedido | null>> {
  const { data, error } = await cliente()
    .from('pedidos_associacao')
    .select(CAMPOS_PEDIDO)
    .eq('pessoa_id', pessoaId)
    .is('arquivado_em', null)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle<Pedido>()
  return error ? falha(error) : ok(data)
}

export async function enviarPedido(pessoaId: string, dados: DadosPedido): Promise<Resultado<string>> {
  const { data, error } = await cliente()
    .from('pedidos_associacao')
    .insert({ pessoa_id: pessoaId, ...paraBanco(dados) })
    .select('id')
    .single()
  if (error?.code === '42501') {
    return { dados: null, erro: 'Você já é associado do COMEP. Não é preciso fazer o pedido.' }
  }
  return error ? falha(error, 'Você já tem um pedido em andamento.') : ok(data.id as string)
}

/** Corrige os dados e devolve o pedido para a diretoria. */
export async function reenviarPedido(pedidoId: string, dados: DadosPedido): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('pedidos_associacao')
    .update({ ...paraBanco(dados), situacao: 'enviado' })
    .eq('id', pedidoId)
  return error ? falha(error) : ok(null)
}

export async function desistirDoPedido(pedidoId: string): Promise<Resultado<null>> {
  const { error } = await cliente().from('pedidos_associacao').update({ situacao: 'desistiu' }).eq('id', pedidoId)
  return error ? falha(error) : ok(null)
}

/**
 * Nome, telefone, CPF e filiação ficam no cadastro da pessoa (o próprio candidato ou associado atualiza).
 * CPF e filiação: só o que ainda estava vazio (depois, só a secretaria corrige — o banco garante).
 */
export async function atualizarMeusDados(
  pessoaId: string,
  nome: string,
  telefone: string,
  identidade: Partial<IdentidadeGravada> = {},
): Promise<Resultado<null>> {
  // primeiro CPF e filiação (se o CPF já é de outra pessoa, nada se grava)
  const gravada = await gravarIdentidade(pessoaId, identidade)
  if (gravada.erro !== null) return gravada
  const { error } = await cliente()
    .from('pessoas')
    .update({ nome: semInvisiveis(nome), telefone: semInvisiveis(telefone) || null })
    .eq('id', pessoaId)
  return error ? falha(error) : ok(null)
}

export type MeusDadosBasicos = { nome: string; telefone: string | null } & IdentidadeGravada

export async function meusDados(pessoaId: string): Promise<Resultado<MeusDadosBasicos>> {
  const [{ data, error }, identidade] = await Promise.all([
    cliente().from('pessoas').select('nome, telefone').eq('id', pessoaId).single<{ nome: string; telefone: string | null }>(),
    lerIdentidade(pessoaId),
  ])
  if (error) return falha(error)
  if (identidade.erro !== null) return identidade
  return ok({ ...data, ...identidade.dados })
}

// ---------- Secretaria / presidência ----------

export async function listarPedidos(): Promise<Resultado<Pedido[]>> {
  const { data, error } = await cliente()
    .from('pedidos_associacao')
    .select(CAMPOS_PEDIDO)
    .is('arquivado_em', null)
    .order('enviado_em', { ascending: true })
    .returns<Pedido[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarPedido(id: string): Promise<Resultado<Pedido | null>> {
  const { data, error } = await cliente().from('pedidos_associacao').select(CAMPOS_PEDIDO).eq('id', id).maybeSingle<Pedido>()
  return error ? falha(error) : ok(data)
}

async function atualizarPedido(id: string, mudancas: Record<string, unknown>): Promise<Resultado<null>> {
  const { error } = await cliente().from('pedidos_associacao').update(mudancas).eq('id', id)
  return error ? falha(error) : ok(null)
}

/** A secretaria aprova ou recusa (com o motivo) um item do pedido. */
export async function conferirItemPedido(pedidoId: string, item: ItemPedido, aprovado: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('conferir_item_pedido', {
    p_pedido_id: pedidoId,
    p_item: item,
    p_aprovado: aprovado,
    p_motivo: motivo.trim() || null,
  })
  return error ? falha(error) : ok(null)
}

export const devolverComPendencia = (id: string, mensagem: string) =>
  atualizarPedido(id, { situacao: 'pendencia', mensagem_pendencia: mensagem.trim() })

/** Aceite de um diretor na ficha (Art. 7º) e encaminhamento à Assembleia Ordinária. */
export const encaminharParaAssembleia = (id: string, igrejaId: string) =>
  atualizarPedido(id, { igreja_id: igrejaId || null, situacao: 'aguardando_assembleia' })

export const recusarPedido = (id: string, motivo: string, assembleiaData?: string) =>
  atualizarPedido(id, {
    situacao: 'recusado',
    motivo_recusa: motivo.trim(),
    ...(assembleiaData ? { assembleia_data: assembleiaData } : {}),
  })

export async function aprovarPedido(id: string, assembleiaData: string, ata: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('aprovar_pedido', {
    p_pedido_id: id,
    p_assembleia_data: assembleiaData,
    p_assembleia_ata: ata,
  })
  if (error?.code === '23505') {
    return {
      dados: null,
      erro: 'A igreja já tem um pastor presidente marcado. Desmarque o anterior na ficha dele, ou aprove sem a marcação.',
    }
  }
  return error ? falha(error) : ok(null)
}

// ---------- Arquivos (Storage, bucket privado "documentos") ----------

const BUCKET = 'documentos'

/** Envia um arquivo para a pasta da pessoa: pessoas/<id>/<tipo>-<data>.<ext>. Nunca sobrescreve. */
export async function enviarArquivo(
  pessoaId: string,
  tipo: 'foto' | 'comprovante' | 'pagamento',
  arquivo: Blob,
  extensao: string,
): Promise<Resultado<string>> {
  const caminho = `pessoas/${pessoaId}/${tipo}-${Date.now()}.${extensao}`
  const { error } = await cliente().storage.from(BUCKET).upload(caminho, arquivo, {
    upsert: false,
    contentType: arquivo.type,
  })
  if (error) {
    const recusado = /row-level security|unauthorized|403/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)
    return {
      dados: null,
      erro: recusado
        ? 'O envio foi recusado: limite de arquivos atingido para quem ainda não é associado. Procure a secretaria.'
        : 'Não foi possível enviar o arquivo. Verifique a internet e tente de novo.',
    }
  }
  return ok(caminho)
}

/** Link temporário (1 hora) para ver um arquivo privado. */
export async function linkDoArquivo(caminho: string): Promise<string | null> {
  const { data } = await cliente().storage.from(BUCKET).createSignedUrl(caminho, 3600)
  return data?.signedUrl ?? null
}
