// Fase 4.1 — Assembleias (AGO, AGE) e reuniões mensais: preparar, convocar, cancelar e o site.
import { cliente, falha, ok, type Resultado } from './cliente'

export type TipoEncontro = 'ago' | 'age' | 'reuniao_mensal'
export type SituacaoEncontro = 'agendado' | 'convocado' | 'realizado' | 'cancelado'
export type Maioria = 'simples' | 'tres_quintos' | 'dois_tercos'

export const TIPOS_ENCONTRO: readonly TipoEncontro[] = ['ago', 'age', 'reuniao_mensal']

export const NOME_DO_TIPO: Record<TipoEncontro, string> = {
  ago: 'Assembleia Geral Ordinária',
  age: 'Assembleia Geral Extraordinária',
  reuniao_mensal: 'Reunião mensal',
}

export const SIGLA_DO_TIPO: Record<TipoEncontro, string> = { ago: 'AGO', age: 'AGE', reuniao_mensal: 'Reunião' }

export const NOME_DA_SITUACAO_ENCONTRO: Record<SituacaoEncontro, string> = {
  agendado: 'Rascunho (não convocado)',
  convocado: 'Convocado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const NOME_DA_MAIORIA: Record<Maioria, string> = {
  simples: 'Maioria simples',
  tres_quintos: '3/5 dos votos (desligamento — Art. 8º)',
  dois_tercos: '2/3 dos votos (reforma do estatuto — Art. 21)',
}

export type ItemPauta = {
  titulo: string
  descricao: string | null
  deliberativo: boolean
  maioria: Maioria | null
}

export type Encontro = {
  id: string
  tipo: TipoEncontro
  titulo: string
  inicio: string
  local: string
  edital: string | null
  fundamento: string | null
  situacao: SituacaoEncontro
  convocado_em: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
  criado_em: string
  presenca_encerrada_em: string | null
  instalada_em: string | null
  chamada: 'primeira' | 'segunda' | null
  aptos_na_instalacao: number | null
  presentes_aptos_na_instalacao: number | null
}

export type ItemDaPauta = ItemPauta & { id: string; ordem: number }
export type EncontroCompleto = Encontro & { pauta: ItemDaPauta[] }

const CAMPOS =
  'id, tipo, titulo, inicio, local, edital, fundamento, situacao, convocado_em, cancelado_em, motivo_cancelamento, criado_em, ' +
  'presenca_encerrada_em, instalada_em, chamada, aptos_na_instalacao, presentes_aptos_na_instalacao'

/** Os encontros que a pessoa vê (rascunhos, só a secretaria e a presidência — o banco garante). */
export async function listarEncontros(): Promise<Resultado<Encontro[]>> {
  const { data, error } = await cliente()
    .from('encontros')
    .select(CAMPOS)
    .is('arquivado_em', null)
    .order('inicio', { ascending: false })
    .returns<Encontro[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarEncontro(id: string): Promise<Resultado<EncontroCompleto | null>> {
  const [encontro, pauta] = await Promise.all([
    cliente().from('encontros').select(CAMPOS).eq('id', id).is('arquivado_em', null).maybeSingle<Encontro>(),
    cliente()
      .from('encontro_pauta')
      .select('id, ordem, titulo, descricao, deliberativo, maioria')
      .eq('encontro_id', id)
      .is('arquivado_em', null)
      .order('ordem')
      .returns<ItemDaPauta[]>(),
  ])
  if (encontro.error) return falha(encontro.error)
  if (pauta.error) return falha(pauta.error)
  return ok(encontro.data ? { ...encontro.data, pauta: pauta.data } : null)
}

export type DadosEncontro = {
  tipo: TipoEncontro
  titulo: string
  /** data e hora com fuso (ISO) */
  inicio: string
  local: string
  edital: string
  fundamento: string
  pauta: ItemPauta[]
}

/** Cria (id null) ou altera um encontro ainda não convocado. Devolve o id. */
export async function salvarEncontro(id: string | null, dados: DadosEncontro): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_encontro', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

/** Convoca (publica). Assembleia: só o presidente, com a antecedência e as regras do Art. 16. */
export async function convocarEncontro(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('convocar_encontro', { p_id: id })
  return error ? falha(error) : ok(null)
}

export async function cancelarEncontro(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_encontro', { p_id: id, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

/** Tira das listas (rascunho ou cancelado). Nada se apaga. */
export async function arquivarEncontro(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('arquivar_encontro', { p_id: id })
  return error ? falha(error) : ok(null)
}

// ---------- Regras do estatuto (Configurações) ----------

export type ConfigAssembleias = {
  antecedencia_dias: number
  meses_ago: number[]
  dia_minimo_ago: number
  minutos_segunda_chamada: number
  faltas_aviso: number
  faltas_pauta: number
}

const CAMPOS_CONFIG = 'antecedencia_dias, meses_ago, dia_minimo_ago, minutos_segunda_chamada, faltas_aviso, faltas_pauta'

export async function buscarConfigAssembleias(): Promise<Resultado<ConfigAssembleias>> {
  const { data, error } = await cliente().from('config_assembleias').select(CAMPOS_CONFIG).single<ConfigAssembleias>()
  return error ? falha(error) : ok(data)
}

export async function salvarConfigAssembleias(config: ConfigAssembleias): Promise<Resultado<null>> {
  const { error } = await cliente().from('config_assembleias').update(config).eq('id', true)
  return error ? falha(error) : ok(null)
}

// ---------- Site (sem login) ----------

export type ConvocacaoPublica = {
  id: string
  tipo: TipoEncontro
  titulo: string
  inicio: string
  local: string
  edital: string | null
  situacao: SituacaoEncontro
  convocado_em: string | null
  motivo_cancelamento: string | null
  pauta: { ordem: number; titulo: string; descricao: string | null }[]
}

/** Convocações das assembleias, para o site (qualquer pessoa vê). */
export async function convocacoesPublicas(): Promise<Resultado<ConvocacaoPublica[]>> {
  const { data, error } = await cliente().rpc('convocacoes_publicas')
  return error ? falha(error) : ok((data as ConvocacaoPublica[] | null) ?? [])
}

// ---------- Presença e faltas (Fase 4.2) ----------

export type MinhaParticipacao = {
  confirmou_em: string | null
  presente_em: string | null
  justificativa: { texto: string; situacao: 'pendente' | 'aceita' | 'recusada'; motivo_decisao: string | null } | null
}

/** A confirmação, a presença e a justificativa do próprio associado neste encontro. */
export async function minhaParticipacao(encontroId: string, pessoaId: string): Promise<Resultado<MinhaParticipacao>> {
  const [presenca, justificativa] = await Promise.all([
    cliente()
      .from('encontro_presencas')
      .select('confirmou_em, presente_em')
      .eq('encontro_id', encontroId)
      .eq('pessoa_id', pessoaId)
      .is('arquivado_em', null)
      .maybeSingle<{ confirmou_em: string | null; presente_em: string | null }>(),
    cliente()
      .from('justificativas_falta')
      .select('texto, situacao, motivo_decisao')
      .eq('encontro_id', encontroId)
      .eq('pessoa_id', pessoaId)
      .is('arquivado_em', null)
      .maybeSingle<MinhaParticipacao['justificativa']>(),
  ])
  if (presenca.error) return falha(presenca.error)
  if (justificativa.error) return falha(justificativa.error)
  return ok({
    confirmou_em: presenca.data?.confirmou_em ?? null,
    presente_em: presenca.data?.presente_em ?? null,
    justificativa: justificativa.data ?? null,
  })
}

export async function confirmarPresenca(encontroId: string, vou: boolean): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('confirmar_presenca', { p_encontro_id: encontroId, p_vou: vou })
  return error ? falha(error) : ok(null)
}

export async function justificarFalta(encontroId: string, texto: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('justificar_falta', { p_encontro_id: encontroId, p_texto: texto })
  return error ? falha(error) : ok(null)
}

export type LinhaPresenca = {
  pessoa_id: string
  nome: string
  numero_registro: number
  em_dia: boolean
  confirmou_em: string | null
  presente_em: string | null
  forma: 'qr_code' | 'lista' | null
  justificativa: 'pendente' | 'aceita' | 'recusada' | null
}

/** Lista de presença (secretaria e presidência): associados ativos, confirmação, presença, em dia, justificativa. */
export async function listaPresenca(encontroId: string): Promise<Resultado<LinhaPresenca[]>> {
  const { data, error } = await cliente().rpc('lista_presenca', { p_encontro_id: encontroId })
  return error ? falha(error) : ok((data as LinhaPresenca[] | null) ?? [])
}

export async function registrarPresenca(encontroId: string, pessoaId: string): Promise<Resultado<'registrada' | 'ja_presente'>> {
  const { data, error } = await cliente().rpc('registrar_presenca', { p_encontro_id: encontroId, p_pessoa_id: pessoaId, p_forma: 'lista' })
  return error ? falha(error) : ok(data as 'registrada' | 'ja_presente')
}

export type PresencaPorCodigo = { resultado: 'registrada' | 'ja_presente'; pessoa_id: string; nome: string; em_dia: boolean }

/** Pelo QR Code da credencial (o código de 32 caracteres). */
export async function registrarPresencaPorCodigo(encontroId: string, codigo: string): Promise<Resultado<PresencaPorCodigo>> {
  const { data, error } = await cliente().rpc('registrar_presenca_por_codigo', { p_encontro_id: encontroId, p_codigo: codigo })
  return error ? falha(error) : ok(data as PresencaPorCodigo)
}

export async function desfazerPresenca(encontroId: string, pessoaId: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('desfazer_presenca', { p_encontro_id: encontroId, p_pessoa_id: pessoaId })
  return error ? falha(error) : ok(null)
}

/** Encerra a lista: o encontro fica "realizado"; quem não esteve tem falta. */
export async function encerrarPresenca(encontroId: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('encerrar_presenca', { p_encontro_id: encontroId })
  return error ? falha(error) : ok(null)
}

export type EncontroAberto = { id: string; titulo: string; inicio: string }

/** Encontros com a lista de presença aberta agora (só a secretaria e a presidência recebem algo). */
export async function encontrosComPresencaAberta(): Promise<Resultado<EncontroAberto[]>> {
  const { data, error } = await cliente().rpc('encontros_com_presenca_aberta')
  return error ? falha(error) : ok((data as EncontroAberto[] | null) ?? [])
}

export type JustificativaParaDecidir = {
  id: string
  texto: string
  enviada_em: string
  situacao: 'pendente' | 'aceita' | 'recusada'
  motivo_decisao: string | null
  encontro: { id: string; titulo: string; inicio: string } | null
  pessoa: { nome: string } | null
}

/** Justificativas de falta (o 1º secretário decide). */
export async function listarJustificativas(): Promise<Resultado<JustificativaParaDecidir[]>> {
  const { data, error } = await cliente()
    .from('justificativas_falta')
    .select('id, texto, enviada_em, situacao, motivo_decisao, encontro:encontros(id, titulo, inicio), pessoa:pessoas(nome)')
    .is('arquivado_em', null)
    .order('enviada_em', { ascending: false })
    .limit(200)
    .returns<JustificativaParaDecidir[]>()
  return error ? falha(error) : ok(data)
}

export async function decidirJustificativa(id: string, aceita: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('decidir_justificativa', { p_id: id, p_aceita: aceita, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export type MinhasFaltas = { faltas_seguidas: number; faltas_aviso: number; faltas_pauta: number }

export async function minhasFaltas(): Promise<Resultado<MinhasFaltas>> {
  const { data, error } = await cliente().rpc('minhas_faltas')
  return error ? falha(error) : ok(data as MinhasFaltas)
}

export type FaltasDoAssociado = { pessoa_id: string; nome: string; numero_registro: number; faltas_seguidas: number }

export async function faltasDosAssociados(): Promise<Resultado<FaltasDoAssociado[]>> {
  const { data, error } = await cliente().rpc('faltas_dos_associados')
  return error ? falha(error) : ok((data as FaltasDoAssociado[] | null) ?? [])
}

// ---------- Quórum, votações, desligamento e ata (Fase 4.3) ----------

export type ContagemQuorum = { aptos: number; presentes: number; presentes_aptos: number }

/** Associados aptos (ativos e em dia) e presentes aptos, agora. */
export async function contagemQuorum(encontroId: string): Promise<Resultado<ContagemQuorum>> {
  const { data, error } = await cliente().rpc('contagem_quorum', { p_encontro_id: encontroId })
  return error ? falha(error) : ok(data as ContagemQuorum)
}

export type Instalacao = { chamada: 'primeira' | 'segunda'; aptos: number; presentes_aptos: number; minimo: number }

/** Instala a assembleia: 1ª chamada com quórum, ou 2ª chamada depois do prazo (Art. 16, §4º). */
export async function instalarAssembleia(encontroId: string): Promise<Resultado<Instalacao>> {
  const { data, error } = await cliente().rpc('instalar_assembleia', { p_encontro_id: encontroId })
  return error ? falha(error) : ok(data as Instalacao)
}

export type IncisoDesligamento = 'I' | 'II' | 'III' | 'IV' | 'V'

export const NOME_DO_INCISO: Record<IncisoDesligamento, string> = {
  I: 'I — a pedido, por escrito',
  II: 'II — conduta contrária à ética e aos princípios cristãos',
  III: 'III — transferência pela denominação para outra cidade',
  IV: 'IV — três faltas seguidas sem justificativa',
  V: 'V — falecimento',
}

export type Deliberacao = {
  id: string
  pauta_id: string
  maioria: Maioria
  votantes: number
  a_favor: number
  contra: number
  abstencoes: number
  aprovada: boolean
  desligamento_pessoa_id: string | null
  desligamento_inciso: IncisoDesligamento | null
  observacao: string | null
  criado_em: string
}

export async function listarDeliberacoes(encontroId: string): Promise<Resultado<Deliberacao[]>> {
  const { data, error } = await cliente()
    .from('deliberacoes')
    .select('id, pauta_id, maioria, votantes, a_favor, contra, abstencoes, aprovada, desligamento_pessoa_id, desligamento_inciso, observacao, criado_em')
    .eq('encontro_id', encontroId)
    .is('arquivado_em', null)
    .returns<Deliberacao[]>()
  return error ? falha(error) : ok(data)
}

export type NovaVotacao = {
  aFavor: number
  contra: number
  abstencoes: number
  desligamentoPessoaId: string | null
  desligamentoInciso: IncisoDesligamento | null
  observacao: string
}

export async function registrarVotacao(pautaId: string, v: NovaVotacao): Promise<Resultado<{ aprovada: boolean; votantes: number }>> {
  const { data, error } = await cliente().rpc('registrar_votacao', {
    p_pauta_id: pautaId,
    p_a_favor: v.aFavor,
    p_contra: v.contra,
    p_abstencoes: v.abstencoes,
    p_desligamento_pessoa_id: v.desligamentoPessoaId,
    p_desligamento_inciso: v.desligamentoInciso,
    p_observacao: v.observacao,
  })
  return error ? falha(error) : ok(data as { aprovada: boolean; votantes: number })
}

/** Falecimento (Art. 8º, V): a secretaria registra, sem votação. */
export async function registrarFalecimento(pessoaId: string, data: string, observacao: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('registrar_falecimento', { p_pessoa_id: pessoaId, p_data: data, p_observacao: observacao })
  return error ? falha(error) : ok(null)
}

export type Ata = {
  id: string
  texto: string
  arquivo_caminho: string | null
  assinada_secretario_em: string | null
  assinada_presidente_em: string | null
  secretario: { nome: string } | null
  presidente: { nome: string } | null
}

export async function buscarAta(encontroId: string): Promise<Resultado<Ata | null>> {
  const { data, error } = await cliente()
    .from('atas')
    .select(
      'id, texto, arquivo_caminho, assinada_secretario_em, assinada_presidente_em, ' +
        'secretario:pessoas!atas_assinada_secretario_por_fkey(nome), presidente:pessoas!atas_assinada_presidente_por_fkey(nome)',
    )
    .eq('encontro_id', encontroId)
    .is('arquivado_em', null)
    .maybeSingle<Ata>()
  return error ? falha(error) : ok(data)
}

export async function salvarAta(encontroId: string, texto: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('salvar_ata', { p_encontro_id: encontroId, p_texto: texto })
  return error ? falha(error) : ok(null)
}

/** Assina como 1º secretário (perfil Secretaria) ou presidente (Presidência): duas pessoas diferentes. */
export async function assinarAta(encontroId: string, como: 'secretario' | 'presidente'): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('assinar_ata', { p_encontro_id: encontroId, p_como: como })
  return error ? falha(error) : ok(null)
}

/** Anexa a ata assinada no papel (PDF ou foto), na pasta privada da assembleia. */
export async function anexarArquivoAta(encontroId: string, arquivo: Blob, extensao: string): Promise<Resultado<null>> {
  const caminho = `${encontroId}/ata-${Date.now()}.${extensao}`
  const envio = await cliente().storage.from('atas').upload(caminho, arquivo, { upsert: false, contentType: arquivo.type })
  if (envio.error) return { dados: null, erro: 'Não foi possível enviar o arquivo da ata. Tente de novo.' }
  const { error } = await cliente().rpc('anexar_ata', { p_encontro_id: encontroId, p_caminho: caminho })
  return error ? falha(error) : ok(null)
}

/** Link temporário (10 minutos) para abrir o arquivo da ata. */
export async function linkArquivoAta(caminho: string): Promise<string | null> {
  const { data } = await cliente().storage.from('atas').createSignedUrl(caminho, 600)
  return data?.signedUrl ?? null
}
