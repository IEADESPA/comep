// Credencial do associado — Fase 3.1: dados (CPF, filiação, sigla da igreja) e pendências.
// Fase 5.5 (parte 7): os modelos por grupo (quem recebe, a ordem, o exclusivo de igreja e a readequação).
import type { TipoModelo } from '../utilitarios/modeloCredencial'
import { cliente, falha, ok, type Resultado } from './cliente'

/** CPF (só números) e filiação, como estão gravados no cadastro da pessoa. */
export type IdentidadeGravada = { cpf: string | null; nome_pai: string | null; nome_mae: string | null }

export const MENSAGEM_CPF_REPETIDO = 'Este CPF já está no cadastro de outra pessoa. Confira os números ou fale com a secretaria.'

/**
 * CPF e filiação não saem na leitura comum do cadastro (revisão da Fase 3): só a própria pessoa,
 * a secretaria e a presidência leem, por esta função.
 */
export async function lerIdentidade(pessoaId: string): Promise<Resultado<IdentidadeGravada>> {
  const { data, error } = await cliente().rpc('identidade_pessoa', { p_pessoa_id: pessoaId })
  if (error) return falha(error)
  return ok((data as IdentidadeGravada | null) ?? { cpf: null, nome_pai: null, nome_mae: null })
}

/** Grava só os campos enviados. O associado só preenche o que está vazio; a secretaria corrige (o banco garante). */
export async function gravarIdentidade(pessoaId: string, dados: Partial<IdentidadeGravada>): Promise<Resultado<null>> {
  if (Object.keys(dados).length === 0) return ok(null)
  const { data, error } = await cliente().rpc('gravar_identidade', { p_pessoa_id: pessoaId, p_dados: dados })
  if (error) return falha(error, MENSAGEM_CPF_REPETIDO)
  return data === 'cpf_repetido' ? { dados: null, erro: MENSAGEM_CPF_REPETIDO } : ok(null)
}

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
  /** cargo na diretoria do COMEP hoje (o enum do banco) */
  cargo?: string | null
  /** o modelo de credencial desta pessoa (Fase 5.5: um por grupo) */
  modelo_id?: string | null
  /** ministro em readequação (a igreja dele é sem registro) */
  readequacao?: boolean
  prazo_readequacao?: string | null
  /** o logotipo da denominação da igreja da pessoa (enviado pela secretaria), ou vazio */
  denominacao_logotipo?: string | null
}

export type ModeloDoPacote = { nome: string; tipo: TipoModelo; desenho: unknown }

export type PacoteCredenciais = {
  fim_mandato: string | null
  texto_verso: string
  /** desenho do modelo padrão (as telas antigas); vazio = o do sistema */
  modelo?: unknown
  /** o desenho de cada modelo usado nas credenciais (pela chave modelo_id) */
  modelos?: Record<string, ModeloDoPacote>
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
  /** ministro em readequação (a igreja dele é sem registro): a conferência mostra a faixa e o prazo */
  readequacao?: boolean
  prazo_readequacao?: string | null
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

/**
 * Corrige o fim do mandato em curso. `esperado` é a data que a tela mostrava: se mudou nesse meio-tempo
 * (alguém registrou a posse), o banco recusa e pede para recarregar.
 */
export async function corrigirFimMandato(fim: string | null, esperado: string | null): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('corrigir_fim_mandato', { p_fim: fim || null, p_esperado: esperado })
  return error ? falha(error) : ok(null)
}

export async function salvarTextoVerso(texto: string): Promise<Resultado<null>> {
  const { error } = await cliente().from('config_credencial').update({ texto_verso: texto.trim() }).eq('id', true)
  return error ? falha(error) : ok(null)
}

export async function buscarConfigCredencial(): Promise<Resultado<ConfigCredencial>> {
  const { data, error } = await cliente().from('config_credencial').select('fim_mandato, texto_verso').single<ConfigCredencial>()
  return error ? falha(error) : ok(data)
}

/** Posse da nova diretoria: renova as credenciais (as impressas antigas valem até o fim do mandato atual). */
export async function registrarNovoMandato(fim: string): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('registrar_novo_mandato', { p_fim: fim })
  return error ? falha(error) : ok(data as number)
}


// ---------- Modelo (desenho) da credencial — Fase 3.4 ----------

/** Uma versão salva do modelo. Nenhuma muda nem se apaga. */
export type VersaoModelo = {
  id: string
  descricao: string
  modelo: unknown
  criado_em: string
  criado_por_nome: string | null
  em_uso: boolean
}

/** Versões salvas, da mais nova para a mais antiga (secretaria e presidência). */
export async function listarVersoesModelo(): Promise<Resultado<VersaoModelo[]>> {
  const { data, error } = await cliente()
    .from('vw_modelos_credencial')
    .select('*')
    .order('criado_em', { ascending: false })
    .returns<VersaoModelo[]>()
  return error ? falha(error) : ok(data)
}

/** Salva como versão nova; com `usar`, passa a valer para todas as credenciais. */
export async function salvarModelo(modelo: unknown, descricao: string, usar: boolean): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_modelo_credencial', {
    p_modelo: modelo,
    p_descricao: descricao.trim(),
    p_usar: usar,
  })
  return error ? falha(error) : ok(data as string)
}

/** Escolhe a versão em uso (null = o modelo padrão do sistema). */
export async function usarModelo(id: string | null): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('usar_modelo_credencial', { p_id: id })
  return error ? falha(error) : ok(null)
}

/** Tira a versão da lista (continua guardada). A versão em uso não pode ser arquivada. */
export async function arquivarModelo(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('arquivar_modelo_credencial', { p_id: id })
  return error ? falha(error) : ok(null)
}

/** Envia uma imagem para o modelo (ex.: o logo oficial). Devolve o nome do arquivo, que vai no modelo. */
export async function enviarImagemModelo(arquivo: Blob, extensao: 'png' | 'jpg' | 'webp'): Promise<Resultado<string>> {
  const nome = `${crypto.randomUUID()}.${extensao}`
  const { error } = await cliente().storage.from('credencial-modelo').upload(nome, arquivo, {
    upsert: false,
    contentType: arquivo.type,
  })
  if (error) {
    const recusado = /row-level security|unauthorized|403/i.test(error.message)
    return {
      dados: null,
      erro: recusado ? 'Só a secretaria ou a presidência enviam imagens do modelo.' : 'Não foi possível enviar a imagem. Tente de novo.',
    }
  }
  return ok(nome)
}


// ---------- Os modelos por grupo (Fase 5.5, parte 7) ----------

export type TipoCondicao =
  | 'cargo'
  | 'titulo'
  | 'tempo'
  | 'pastor_presidente'
  | 'jubilado'
  | 'comissao'
  | 'admissao'
  | 'igreja'
  | 'denominacao'
  | 'tradicao'
  | 'periodo'
  | 'mandato'

export type Condicao = { tipo: TipoCondicao; valores?: string[]; anos?: number; de?: string; ate?: string }
export type Regra = { modo: 'todas' | 'qualquer'; condicoes: Condicao[] }

export type ModeloGrupo = {
  id: string
  nome: string
  descricao: string | null
  tipo: TipoModelo
  prioridade: number
  em_uso: boolean
  regra: Regra
  versao_id: string | null
  desenho: unknown
  salvo_em: string | null
  igreja_id: string | null
  igreja_nome: string | null
  valor: number | null
  pedido_por: string | null
  pedido_por_nome: string | null
  pago_em: string | null
  lancamento_id: string | null
  /** quantas pessoas recebem hoje */
  pessoas: number
}

export type PainelModelos = {
  fim_mandato: string | null
  /** os dias da igreja sem registro para se registrar (cada uma conta da ativação dela; regras de 26/11/2026) */
  dias_readequacao: number | null
  associados: number
  /** na ordem: os de grupo e os exclusivos, depois o padrão e o de readequação */
  modelos: ModeloGrupo[]
}

export async function painelModelos(): Promise<Resultado<PainelModelos>> {
  const { data, error } = await cliente().rpc('painel_modelos')
  return error ? falha(error) : ok(data as PainelModelos)
}

export type DadosModelo = {
  nome: string
  descricao?: string | null
  regra?: Regra
  tipo?: 'grupo' | 'exclusivo'
  igreja_id?: string | null
  valor?: number | null
  pedido_por?: string | null
}

/** Cria (id vazio) ou muda o nome, a descrição, a regra e os dados do exclusivo. Devolve o id. */
export async function salvarModeloGrupo(id: string | null, dados: DadosModelo): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_modelo', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

/** Nova versão do desenho de um modelo; com "usar", passa a valer na hora (e põe o rascunho em uso). */
export async function salvarVersaoDoModelo(modeloId: string, desenho: unknown, descricao: string, usar: boolean): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_versao_modelo', {
    p_modelo_id: modeloId,
    p_desenho: desenho,
    p_descricao: descricao.trim(),
    p_usar: usar,
  })
  return error ? falha(error) : ok(data as string)
}

export async function usarVersaoDoModelo(modeloId: string, versaoId: string | null): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('usar_versao_modelo', { p_modelo_id: modeloId, p_versao_id: versaoId })
  return error ? falha(error) : ok(null)
}

export async function porModeloEmUso(id: string, emUso: boolean): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('por_modelo_em_uso', { p_id: id, p_em_uso: emUso })
  return error ? falha(error) : ok(null)
}

/** A ordem completa dos modelos de grupo e exclusivos, do primeiro ao último. */
export async function ordenarModelos(ids: string[]): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('ordenar_modelos', { p_ids: ids })
  return error ? falha(error) : ok(null)
}

export async function duplicarModelo(id: string, nome: string): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('duplicar_modelo', { p_id: id, p_nome: nome.trim() })
  return error ? falha(error) : ok(data as string)
}

export async function arquivarModeloGrupo(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('arquivar_modelo', { p_id: id })
  return error ? falha(error) : ok(null)
}

/**
 * O pagamento do modelo exclusivo (tesouraria ou presidência), ligando uma entrada que já está no caixa.
 * Desde a parte 12 (a blindagem do caixa), o pagamento tem sempre a entrada: para receber agora, use
 * receberPagamentoExclusivo; para desfazer, desfazerPagamentoExclusivo (a entrada é cancelada).
 */
export async function registrarPagamentoExclusivo(id: string, pagoEm: string, lancamentoId: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('registrar_pagamento_exclusivo', {
    p_id: id,
    p_pago_em: pagoEm || null,
    p_lancamento_id: lancamentoId,
  })
  return error ? falha(error) : ok(null)
}

/** Receber o pagamento do modelo exclusivo: a entrada entra no caixa (dinheiro → caixa; o resto → banco), ligada ao modelo. */
export async function receberPagamentoExclusivo(id: string, data: string, forma: string): Promise<Resultado<string>> {
  const { data: lancamento, error } = await cliente().rpc('receber_pagamento_exclusivo', { p_id: id, p_data: data, p_forma: forma })
  return error ? falha(error) : ok(lancamento as string)
}

/** Desfazer o pagamento: a entrada do caixa é cancelada (estorno), e o modelo volta a esperar o pagamento. */
export async function desfazerPagamentoExclusivo(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('desfazer_pagamento_exclusivo', { p_id: id, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export type PessoaDoModelo = { pessoa_id: string; nome: string; numero_registro: number; titulo: string | null; igreja: string | null }
export type Simulacao = { pessoas: PessoaDoModelo[]; acima: number; regra: Regra }

/** Quem receberia o modelo com esta regra (ainda sem salvar); vazio = a regra salva. */
export async function simularQuemRecebe(modeloId: string, regra: Regra | null): Promise<Resultado<Simulacao>> {
  const { data, error } = await cliente().rpc('simular_quem_recebe', { p_modelo_id: modeloId, p_regra: regra })
  return error ? falha(error) : ok(data as Simulacao)
}

export type LinhaCredencial = {
  pessoa_id: string
  numero_registro: number
  nome: string
  igreja_id: string | null
  igreja: string | null
  pendencias: string[]
  em_dia: boolean
  readequacao: boolean
  /** em readequação: até quando a igreja dele tem para se registrar */
  prazo_readequacao?: string | null
  modelo_id: string | null
  modelo: string | null
  valida_ate: string | null
}

export type ListaDeCredenciais = { fim_mandato: string | null; dias_readequacao: number | null; credenciais: LinhaCredencial[] }

/** A lista do módulo Credenciais (secretaria e presidência). */
export async function listaCredenciais(): Promise<Resultado<ListaDeCredenciais>> {
  const { data, error } = await cliente().rpc('lista_credenciais')
  return error ? falha(error) : ok(data as ListaDeCredenciais)
}

export type VersaoDoModelo = {
  id: string
  modelo_id: string
  descricao: string
  modelo: unknown
  criado_em: string
  criado_por_nome: string | null
  em_uso: boolean
}

/** As versões salvas de um modelo, da mais nova para a mais antiga. */
export async function listarVersoesDoModelo(modeloId: string): Promise<Resultado<VersaoDoModelo[]>> {
  const { data, error } = await cliente()
    .from('vw_versoes_modelo')
    .select('*')
    .eq('modelo_id', modeloId)
    .order('criado_em', { ascending: false })
    .returns<VersaoDoModelo[]>()
  return error ? falha(error) : ok(data)
}

export type EntradaDoCaixa = { id: string; data: string; valor: number; descricao: string }

/** Entradas do caixa (para ligar o pagamento do modelo exclusivo); só quem lê o caixa vê. */
export async function entradasParaLigar(): Promise<Resultado<EntradaDoCaixa[]>> {
  const { data, error } = await cliente()
    .from('lancamentos')
    .select('id, data, valor, descricao')
    .eq('tipo', 'entrada')
    .neq('situacao', 'cancelado')
    .is('arquivado_em', null)
    .order('data', { ascending: false })
    .limit(200)
    .returns<EntradaDoCaixa[]>()
  return error ? falha(error) : ok(data)
}

// ---------- Os logotipos das denominações (Fase 5.5, parte 8) ----------

export type LogotipoDenominacao = {
  id: string
  nome: string
  tradicao: string | null
  logotipo: string | null
  logotipo_em: string | null
}

/** As denominações e o logotipo de cada uma (o arquivo que a denominação forneceu, enviado pela secretaria). */
export async function logotiposDasDenominacoes(): Promise<Resultado<LogotipoDenominacao[]>> {
  const { data, error } = await cliente()
    .from('denominacoes')
    .select('id, nome, tradicao, logotipo, logotipo_em')
    .is('arquivado_em', null)
    .order('nome')
    .returns<LogotipoDenominacao[]>()
  return error ? falha(error) : ok(data)
}

/** Liga o arquivo enviado (enviarImagemModelo) à denominação; vazio = tirar o logotipo. */
export async function enviarLogotipoDenominacao(denominacaoId: string, arquivo: string | null): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('enviar_logotipo_denominacao', { p_denominacao_id: denominacaoId, p_arquivo: arquivo })
  return error ? falha(error) : ok(null)
}
