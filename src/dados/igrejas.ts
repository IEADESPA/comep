// A igreja como instituição (Fase 5.1) e a regularização (Fase 5.5, partes 5 e 6): documentos com validade e partes,
// a diretoria por cargo com o mandato, a situação calculada (regular, suspensa, sem registro, em análise), o cadastro
// pela secretaria e pelo próprio pastor, a conferência item por item, as filiais, os pedidos de correção e o resumo.
import type { ItemRegularidade } from '../utilitarios/regularizacao'
import { cliente, falha, ok, type Resultado } from './cliente'

export type TipoDocumentoIgreja = 'estatuto' | 'cartao_cnpj' | 'ata_diretoria' | 'alvara' | 'outro'
export type SituacaoDocumentoIgreja = 'pendente' | 'conferido' | 'recusado'
export type NaturezaJuridica = 'organizacao_religiosa' | 'associacao_privada'

export const NOME_DO_DOCUMENTO: Record<TipoDocumentoIgreja, string> = {
  estatuto: 'Estatuto da igreja',
  cartao_cnpj: 'Cartão CNPJ',
  ata_diretoria: 'Ata da diretoria',
  alvara: 'Alvará de licenciamento',
  outro: 'Outro documento',
}

export const NOME_DA_NATUREZA: Record<NaturezaJuridica, string> = {
  organizacao_religiosa: 'Organização religiosa · 322-0',
  associacao_privada: 'Associação privada · 399-9',
}

/** Os documentos que o cadastro completo precisa ter conferidos (o alvará também, para ser regular). */
export const DOCUMENTOS_ESSENCIAIS: TipoDocumentoIgreja[] = ['estatuto', 'cartao_cnpj', 'ata_diretoria']
export const DOCUMENTOS_DA_REGULARIDADE: TipoDocumentoIgreja[] = ['estatuto', 'cartao_cnpj', 'ata_diretoria', 'alvara']

export type ParteDocumento = { id: string; ordem: number; arquivo_caminho: string; nome_arquivo: string | null; tamanho: number | null }

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
  valido_de: string | null
  valido_ate: string | null
  natureza: NaturezaJuridica | null
  muda_natureza: boolean
  enviado_por: string | null
  partes: ParteDocumento[]
}

const CAMPOS_DOCUMENTO =
  'id, igreja_id, tipo, descricao, arquivo_caminho, situacao, motivo_recusa, criado_em, conferido_em, valido_de, valido_ate, natureza, ' +
  'muda_natureza, enviado_por, partes:igreja_documento_partes(id, ordem, arquivo_caminho, nome_arquivo, tamanho)'

const emOrdem = (d: DocumentoIgreja): DocumentoIgreja => ({ ...d, partes: [...(d.partes ?? [])].sort((a, b) => a.ordem - b.ordem) })

/** Os documentos da igreja (os trocados antes da conferência ficam de fora; o histórico fica). */
export async function listarDocumentosIgreja(igrejaId: string): Promise<Resultado<DocumentoIgreja[]>> {
  const { data, error } = await cliente()
    .from('igreja_documentos')
    .select(CAMPOS_DOCUMENTO)
    .eq('igreja_id', igrejaId)
    .is('arquivado_em', null)
    .order('criado_em', { ascending: false })
    .returns<DocumentoIgreja[]>()
  return error ? falha(error) : ok(data.map(emOrdem))
}

export type MembroNovo = { cargo: string; pessoa_id?: string | null; nome?: string; inicio: string; fim: string }

export type NovoDocumento = {
  tipo: TipoDocumentoIgreja
  descricao?: string
  valido_de?: string
  valido_ate?: string
  natureza?: NaturezaJuridica
  muda_natureza?: boolean
  diretoria?: MembroNovo[]
}

/** Um arquivo pronto para subir (a foto já reduzida no aparelho). */
export type ArquivoParaEnviar = { blob: Blob; extensao: string; nome: string }

/**
 * Sobe as partes para a pasta da igreja e registra o documento (com a validade e, na ata, a diretoria).
 * `aoAvancar` diz quantas partes já subiram (para a barra de envio).
 */
export async function enviarDocumentoIgreja(
  igrejaId: string,
  documento: NovoDocumento,
  arquivos: ArquivoParaEnviar[],
  aoAvancar?: (enviadas: number) => void,
): Promise<Resultado<string>> {
  const partes: { caminho: string; nome: string; tamanho: number }[] = []
  const marca = Date.now()
  for (const [i, arquivo] of arquivos.entries()) {
    const caminho = `${igrejaId}/${documento.tipo}-${marca}-${i + 1}.${arquivo.extensao}`
    const envio = await cliente().storage.from('igrejas').upload(caminho, arquivo.blob, { upsert: false, contentType: arquivo.blob.type })
    if (envio.error) return { dados: null, erro: `Não foi possível enviar "${arquivo.nome}". Tente de novo.` }
    partes.push({ caminho, nome: arquivo.nome.slice(0, 200), tamanho: arquivo.blob.size })
    aoAvancar?.(i + 1)
  }
  const { data, error } = await cliente().rpc('enviar_documento_igreja', {
    p_igreja_id: igrejaId,
    p_dados: { ...documento, partes },
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

export type DocumentoParaConferir = DocumentoIgreja & { igreja: { nome: string; cadastro: CadastroIgreja } | null }

/** Documentos esperando a conferência (secretaria e presidência). */
export async function documentosParaConferir(): Promise<Resultado<DocumentoParaConferir[]>> {
  const { data, error } = await cliente()
    .from('igreja_documentos')
    .select(`${CAMPOS_DOCUMENTO}, igreja:igrejas(nome, cadastro)`)
    .eq('situacao', 'pendente')
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<DocumentoParaConferir[]>()
  return error ? falha(error) : ok(data.map((d) => ({ ...emOrdem(d), igreja: d.igreja })))
}

// ---------- Diretoria da igreja (vai com a ata) ----------

export type MembroDiretoriaIgreja = {
  id: string
  documento_id: string | null
  ordem: number | null
  cargo: string
  pessoa_id: string | null
  nome: string
  inicio: string | null
  fim: string | null
}

export async function listarDiretoriaIgreja(igrejaId: string): Promise<Resultado<MembroDiretoriaIgreja[]>> {
  const { data, error } = await cliente()
    .from('igreja_diretoria')
    .select('id, documento_id, ordem, cargo, pessoa_id, nome, inicio, fim')
    .eq('igreja_id', igrejaId)
    .is('arquivado_em', null)
    .order('ordem')
    .order('criado_em')
    .returns<MembroDiretoriaIgreja[]>()
  return error ? falha(error) : ok(data)
}

// ---------- A situação da igreja (calculada no banco, pela data) ----------

export type CadastroIgreja = 'completo' | 'sem_registro' | 'em_analise'
export type NivelIgreja = 'regular' | 'suspensa' | 'sem_registro' | 'em_analise'

export type SituacaoIgreja = {
  situacao: NivelIgreja
  /** o que suspendeu a igreja */
  vencidos: ItemRegularidade[]
  /** o que nunca veio (faltava na ativação), suspenso ou ainda nos dias para mandar */
  nunca_vieram?: ItemRegularidade[]
  /** o que falta e ainda está no prazo, sem suspender (o que faltava na ativação, nos dias dela; o alvará na tolerância de janeiro) */
  pendencias: ItemRegularidade[]
  /** até quando mandar o que falta; null quando o novo já chegou e espera a conferência */
  pendencias_ate?: string | null
  suspensa_desde?: string | null
  /** o último dia para mandar o documento (os dias das regras, ou os dias depois da recusa fora do prazo) */
  prazo_ate?: string | null
  perfil_bloqueado: boolean
  alvara_ate?: string | null
  mandato_ate?: string | null
  /** associação privada: até quando mudar para organização religiosa */
  natureza_prazo?: string | null
  proximo_vencimento?: string | null
  /** o dia em que a igreja passou a valer: os prazos contam dele */
  ativada_em?: string | null
  /** sem registro: até quando se registrar */
  readequacao_ate?: string | null
}

export const NOME_DO_NIVEL: Record<NivelIgreja, string> = {
  regular: 'Regular',
  suspensa: 'Suspensa',
  sem_registro: 'Sem registro',
  em_analise: 'Em análise',
}

export async function situacaoDaIgreja(igrejaId: string): Promise<Resultado<SituacaoIgreja>> {
  const { data, error } = await cliente().rpc('situacao_da_igreja', { p_igreja_id: igrejaId })
  return error ? falha(error) : ok(data as SituacaoIgreja)
}

export type MinhaIgrejaResumo = { igreja_id: string; nome: string; cadastro: CadastroIgreja; situacao: SituacaoIgreja }

/** A igreja de quem está logado: a que ele preside (mesmo suspensa) ou a que cadastrou e está em análise. */
export async function minhaIgreja(): Promise<Resultado<MinhaIgrejaResumo | null>> {
  const { data, error } = await cliente().rpc('minha_igreja')
  return error ? falha(error) : ok((data ?? null) as MinhaIgrejaResumo | null)
}

export type SituacaoNaLista = {
  igreja_id: string
  situacao: SituacaoIgreja
  ministros: number
  ministros_em_dia: number
  filiais: number
  documentos_pendentes: number
}

/** A situação de todas as igrejas (secretaria e presidência). */
export async function situacaoDasIgrejas(): Promise<Resultado<SituacaoNaLista[]>> {
  const { data, error } = await cliente().rpc('situacao_das_igrejas')
  return error ? falha(error) : ok((data ?? []) as SituacaoNaLista[])
}

/** As regras da regularização (decisões do presidente de 26/11/2026), em dias. Só a presidência muda. */
export type RegrasIgrejas = {
  /** para mandar o documento que falta (da ativação) ou que venceu, antes de o pastor perder o perfil */
  dias_para_mandar: number
  /** o alvará que vence em 31/12 só suspende depois destes dias (31: até 31/01; 0: sem tolerância) */
  dias_tolerancia_alvara: number
  /** mandado no prazo e recusado depois dele: os dias, da recusa, para mandar de novo */
  dias_apos_recusa: number
  /** para a associação privada mudar para organização religiosa */
  dias_natureza: number
  /** para a igreja sem registro se registrar (a readequação dos ministros dela) */
  dias_readequacao: number
}

const CAMPOS_REGRAS = 'dias_para_mandar, dias_tolerancia_alvara, dias_apos_recusa, dias_natureza, dias_readequacao'

/** Os padrões do banco, se a linha das regras ainda não existir. */
export const REGRAS_PADRAO: RegrasIgrejas = { dias_para_mandar: 30, dias_tolerancia_alvara: 31, dias_apos_recusa: 7, dias_natureza: 120, dias_readequacao: 120 }

export async function regrasDasIgrejas(): Promise<Resultado<RegrasIgrejas>> {
  const { data, error } = await cliente().from('config_igrejas').select(CAMPOS_REGRAS).maybeSingle<RegrasIgrejas>()
  if (error) return falha(error)
  return ok(data ?? REGRAS_PADRAO)
}

/** Só a presidência muda (o banco confere). */
export async function salvarRegrasDasIgrejas(regras: RegrasIgrejas): Promise<Resultado<null>> {
  const { dias_para_mandar, dias_tolerancia_alvara, dias_apos_recusa, dias_natureza, dias_readequacao } = regras
  const { data, error } = await cliente()
    .from('config_igrejas')
    .update({ dias_para_mandar, dias_tolerancia_alvara, dias_apos_recusa, dias_natureza, dias_readequacao })
    .eq('id', true)
    .select('id')
  if (error) return falha(error)
  return data.length === 0 ? { dados: null, erro: 'Só a presidência muda as regras da regularização.' } : ok(null)
}

export type MudancaDeSituacao = { igreja_id: string; nome: string; antes: 'regular' | 'suspensa' | 'bloqueada'; depois: 'regular' | 'suspensa' | 'bloqueada' }
export type EfeitoDasRegras = { igrejas: number; mudam: MudancaDeSituacao[] }

/** Antes de salvar (S7-08): quais igrejas mudam de situação hoje com as regras novas. Nada é salvo. */
export async function efeitoDasRegras(regras: RegrasIgrejas): Promise<Resultado<EfeitoDasRegras>> {
  const { data, error } = await cliente().rpc('efeito_das_regras', { p_regras: regras })
  return error ? falha(error) : ok(data as EfeitoDasRegras)
}

// ---------- O cadastro: pela secretaria, pelo pastor, a conferência item por item ----------

export type DadosCadastroIgreja = {
  nome: string
  sigla: string
  denominacao_id: string
  cnpj: string
  natureza_juridica: NaturezaJuridica | ''
  fundada_em: string
  membros: string
  endereco: string
  bairro_id: string
  cep: string
  telefone: string
  email: string
  site: string
  convencao: string
  presidente_nome: string
}

export async function cadastrarIgreja(
  dados: DadosCadastroIgreja & { tem_registro: boolean; presidente_id: string | null },
): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('cadastrar_igreja', { p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function pedirCadastroIgreja(dados: DadosCadastroIgreja): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('pedir_cadastro_igreja', { p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export type ItemAnalise = 'dados' | 'endereco' | 'diretoria'
export type SituacaoItemAnalise = 'analise' | 'aprovado' | 'recusado'

export const NOME_DO_ITEM_ANALISE: Record<ItemAnalise, string> = {
  dados: 'Dados da igreja',
  endereco: 'Endereço e contato',
  diretoria: 'Pastor e diretoria',
}

export type ConferenciaItem = { item: ItemAnalise; situacao: SituacaoItemAnalise; motivo: string | null; decidido_em: string | null }

export async function itensDaAnalise(igrejaId: string): Promise<Resultado<ConferenciaItem[]>> {
  const { data, error } = await cliente()
    .from('igreja_analise_itens')
    .select('item, situacao, motivo, decidido_em')
    .eq('igreja_id', igrejaId)
    .is('arquivado_em', null)
    .returns<ConferenciaItem[]>()
  return error ? falha(error) : ok(data)
}

export type IgrejaEmAnalise = {
  id: string
  nome: string
  presidente_nome: string | null
  criado_em: string
  itens: ConferenciaItem[]
  documentos: { tipo: TipoDocumentoIgreja; situacao: SituacaoDocumentoIgreja; arquivado_em: string | null; criado_em: string }[]
}

/** As igrejas novas, cadastradas pelos pastores, esperando a conferência (secretaria e presidência). */
export async function igrejasEmAnalise(): Promise<Resultado<IgrejaEmAnalise[]>> {
  const { data, error } = await cliente()
    .from('igrejas')
    .select('id, nome, presidente_nome, criado_em, itens:igreja_analise_itens(item, situacao, motivo, decidido_em), documentos:igreja_documentos(tipo, situacao, arquivado_em, criado_em)')
    .eq('cadastro', 'em_analise')
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<IgrejaEmAnalise[]>()
  // os documentos do mais novo para o mais antigo (o que vale na conferência é o último de cada tipo)
  return error
    ? falha(error)
    : ok(
        data.map((i) => ({
          ...i,
          documentos: i.documentos.filter((d) => d.arquivado_em === null).sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
        })),
      )
}

/** O que a conferência da igreja nova pede: os 3 itens e os documentos (o alvará, se veio). */
export function conferenciaDaIgrejaNova(itens: ConferenciaItem[], documentos: Pick<DocumentoIgreja, 'tipo' | 'situacao'>[]) {
  const ultimo = (tipo: TipoDocumentoIgreja) => documentos.find((d) => d.tipo === tipo)
  const docs = DOCUMENTOS_DA_REGULARIDADE.filter((t) => t !== 'alvara' || ultimo('alvara'))
  const total = 3 + docs.length
  const aprovados = itens.filter((i) => i.situacao === 'aprovado').length + docs.filter((t) => ultimo(t)?.situacao === 'conferido').length
  return { total, aprovados, tudo: aprovados === total }
}

export async function corrigirCadastroIgreja(igrejaId: string, item: 'dados' | 'endereco', dados: DadosCadastroIgreja): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('corrigir_cadastro_igreja', { p_igreja_id: igrejaId, p_item: item, p_dados: dados })
  return error ? falha(error) : ok(null)
}

export async function conferirItemIgreja(igrejaId: string, item: ItemAnalise, aprovar: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('conferir_item_igreja', { p_igreja_id: igrejaId, p_item: item, p_aprovar: aprovar, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function ativarIgreja(igrejaId: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('ativar_igreja', { p_igreja_id: igrejaId })
  return error ? falha(error) : ok(null)
}

export async function regularizarIgreja(igrejaId: string, cnpj: string, natureza: NaturezaJuridica): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('regularizar_igreja', { p_igreja_id: igrejaId, p_cnpj: cnpj, p_natureza: natureza })
  return error ? falha(error) : ok(null)
}

// ---------- As filiais ----------

export type TipoFilial = 'congregacao' | 'ponto_de_culto' | 'celula'

export const NOME_DO_TIPO_FILIAL: Record<TipoFilial, string> = {
  congregacao: 'Congregação',
  ponto_de_culto: 'Ponto de culto',
  celula: 'Célula',
}

export const PLURAL_DO_TIPO_FILIAL: Record<TipoFilial, string> = {
  congregacao: 'Congregações',
  ponto_de_culto: 'Pontos de culto',
  celula: 'Células',
}

export type Filial = {
  id: string
  igreja_id: string
  tipo: TipoFilial
  nome: string
  bairro_id: string | null
  responsavel_id: string | null
  latitude: number | null
  longitude: number | null
  bairro: { nome: string } | null
}

export async function listarFiliais(igrejaId: string): Promise<Resultado<Filial[]>> {
  const { data, error } = await cliente()
    .from('igreja_filiais')
    .select('id, igreja_id, tipo, nome, bairro_id, responsavel_id, latitude, longitude, bairro:bairros(nome)')
    .eq('igreja_id', igrejaId)
    .is('arquivado_em', null)
    .order('nome')
    .returns<Filial[]>()
  return error ? falha(error) : ok(data)
}

export type DadosFilial = {
  tipo: TipoFilial
  nome: string
  bairro_id: string | null
  responsavel_id: string | null
  latitude: number | null
  longitude: number | null
}

export async function salvarFilial(id: string | null, igrejaId: string, dados: DadosFilial): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_filial', { p_id: id, p_igreja_id: igrejaId, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function arquivarFilial(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('arquivar_filial', { p_id: id })
  return error ? falha(error) : ok(null)
}

// ---------- Pedidos de correção no cadastro ----------

export type SituacaoPedidoCorrecao = 'pendente' | 'atendido' | 'recusado'

/** A lista fechada dos dados que se pedem para corrigir (nada de texto livre: 18/11/2026). */
export type CampoCorrecao = 'nome' | 'telefone' | 'email' | 'cpf' | 'nome_mae' | 'nome_pai' | 'titulo' | 'funcao' | 'igreja'

/** Os dados da IGREJA que quem preside pede para corrigir (D-10, desenho minha-igreja-2): só o nome e o CNPJ. */
export type CampoCorrecaoIgreja = 'igreja_nome' | 'igreja_cnpj'

export const NOME_DO_CAMPO: Record<CampoCorrecao | CampoCorrecaoIgreja, string> = {
  nome: 'Nome completo',
  telefone: 'Telefone',
  email: 'E-mail',
  cpf: 'CPF',
  nome_mae: 'Nome da mãe',
  nome_pai: 'Nome do pai',
  titulo: 'Título ministerial',
  funcao: 'Função na igreja',
  igreja: 'Igreja',
  igreja_nome: 'Nome da igreja',
  igreja_cnpj: 'CNPJ da igreja',
}

export type PedidoCorrecao = {
  id: string
  /** null = o pedido é da IGREJA (`igreja_id` é a igreja corrigida; D-10) */
  pessoa_id: string | null
  /** no pedido da pessoa, a igreja dela; no da igreja, a igreja corrigida */
  igreja_id: string | null
  texto: string
  /** null = pedido antigo, em texto (antes de 18/11/2026) */
  campo: CampoCorrecao | CampoCorrecaoIgreja | null
  valor_atual: string | null
  valor_pedido: string | null
  situacao: SituacaoPedidoCorrecao
  resposta: string | null
  criado_em: string
  respondido_em: string | null
  /** só vem para quem pode ler o cadastro (a secretaria, ou a própria pessoa) */
  pessoa: { nome: string } | null
  autor: { nome: string } | null
  /** a igreja do pedido (no pedido da igreja, a corrigida) */
  igreja: { nome: string } | null
}

const CAMPOS_PEDIDO =
  'id, pessoa_id, igreja_id, texto, campo, valor_atual, valor_pedido, situacao, resposta, criado_em, respondido_em, ' +
  'pessoa:pessoas!pedidos_correcao_pessoa_id_fkey(nome), autor:pessoas!pedidos_correcao_pedido_por_fkey(nome), ' +
  'igreja:igrejas!pedidos_correcao_igreja_id_fkey(nome)'

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

/**
 * Quem preside a igreja pede a correção do nome ou do CNPJ dela (D-10). O banco confere tudo de novo (os dígitos do
 * CNPJ, o CNPJ de outra igreja, o igual ao de hoje e o pedido que já espera) e guarda como está hoje.
 */
export async function pedirCorrecaoDaIgreja(igrejaId: string, campo: CampoCorrecaoIgreja, valor: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('pedir_correcao_da_igreja', { p_igreja_id: igrejaId, p_campo: campo, p_valor: valor.trim() })
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
