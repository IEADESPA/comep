// Associados (ministros): lista, ficha, cadastro direto e históricos de título e igreja.
import { cliente, falha, ok, type Resultado } from './cliente'
import { lerIdentidade, gravarIdentidade, pendenciasDe, type IdentidadeGravada } from './credencial'
import type { CategoriaContribuicao } from './configuracoes'
import { semInvisiveis } from '../utilitarios/textoLimpo'

export type SituacaoAssociado = 'ativo' | 'desligado' | 'falecido'
export type FormaAdmissao = 'cadastro_inicial' | 'assembleia'

export const NOME_DA_SITUACAO: Record<SituacaoAssociado, string> = {
  ativo: 'Ativo',
  desligado: 'Desligado',
  falecido: 'Falecido',
}

export const NOME_DA_FORMA_ADMISSAO: Record<FormaAdmissao, string> = {
  cadastro_inicial: 'Associado anterior ao sistema (Art. 7º, a)',
  assembleia: 'Aprovado em Assembleia Ordinária',
}

const MENSAGEM_PRESIDENTE_REPETIDO =
  'Esta igreja já tem um pastor presidente marcado. Desmarque o anterior na ficha dele primeiro.'

/**
 * Sugestões para o campo "função na igreja" (texto livre).
 * "Pastor presidente" NÃO entra aqui: é a marcação própria (dá o perfil e a categoria de contribuição).
 */
export const SUGESTOES_FUNCAO = ['Pastor auxiliar', 'Pastor de congregação', 'Evangelista dirigente', 'Missionário', 'Líder']

export type Associado = {
  id: string
  pessoa_id: string
  numero_registro: number
  situacao: SituacaoAssociado
  forma_admissao: FormaAdmissao
  admitido_em: string | null
  assembleia_data: string | null
  assembleia_ata: string | null
  observacoes: string | null
  nome: string
  email: string | null
  telefone: string | null
  tem_login: boolean
  titulo_id: string | null
  titulo: string | null
  igreja_id: string | null
  igreja: string | null
  funcao: string | null
  jubilado: boolean
  pastor_presidente: boolean
  categoria_contribuicao: CategoriaContribuicao
}

export type TituloDaPessoa = { id: string; desde: string | null; criado_em: string; titulo: { nome: string } | null }

export type VinculoDaPessoa = {
  id: string
  igreja_id: string
  funcao: string | null
  inicio: string | null
  fim: string | null
  pastor_presidente: boolean
  igreja: { nome: string } | null
}

export type FichaAssociado = {
  associado: Associado
  titulos: TituloDaPessoa[]
  vinculos: VinculoDaPessoa[]
  /** CPF e filiação (vão na credencial) */
  identidade: IdentidadeGravada
  /** O que falta para a credencial (vazio = completa) */
  pendencias: string[]
}

export async function listarAssociados(): Promise<Resultado<Associado[]>> {
  const { data, error } = await cliente().from('vw_associados').select('*').order('nome').returns<Associado[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarFicha(pessoaId: string): Promise<Resultado<FichaAssociado | null>> {
  const [associado, titulos, vinculos, identidade, pendencias] = await Promise.all([
    cliente().from('vw_associados').select('*').eq('pessoa_id', pessoaId).maybeSingle<Associado>(),
    cliente()
      .from('titulos_pessoa')
      .select('id, desde, criado_em, titulo:titulos_ministeriais(nome)')
      .eq('pessoa_id', pessoaId)
      .is('arquivado_em', null)
      .order('criado_em', { ascending: false })
      .returns<TituloDaPessoa[]>(),
    cliente()
      .from('vinculos_igreja')
      .select('id, igreja_id, funcao, inicio, fim, pastor_presidente, igreja:igrejas(nome)')
      .eq('pessoa_id', pessoaId)
      .is('arquivado_em', null)
      .order('criado_em', { ascending: false })
      .returns<VinculoDaPessoa[]>(),
    lerIdentidade(pessoaId),
    pendenciasDe(pessoaId),
  ])
  const erro = associado.error ?? titulos.error ?? vinculos.error
  if (erro) return falha(erro)
  if (identidade.erro !== null) return identidade
  if (pendencias.erro !== null) return pendencias
  if (!associado.data) return ok(null)
  return ok({
    associado: associado.data,
    titulos: titulos.data ?? [],
    vinculos: vinculos.data ?? [],
    identidade: identidade.dados,
    pendencias: pendencias.dados ?? [],
  })
}

export type NovoAssociado = {
  nome: string
  email: string
  telefone: string
  tituloId: string
  tituloDesde: string
  igrejaId: string
  funcao: string
  vinculoInicio: string
  admitidoEm: string
  observacoes: string
  pastorPresidente: boolean
  jubilado: boolean
}

/** Cadastro direto de associado atual (Art. 7º, a). Tudo ou nada, numa única operação no banco. */
export async function cadastrarAssociado(novo: NovoAssociado): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('cadastrar_associado', {
    p_nome: semInvisiveis(novo.nome),
    p_email: novo.email,
    p_telefone: semInvisiveis(novo.telefone),
    p_titulo_id: novo.tituloId || null,
    p_titulo_desde: novo.tituloDesde || null,
    p_igreja_id: novo.igrejaId || null,
    p_funcao: novo.funcao,
    p_vinculo_inicio: novo.vinculoInicio || null,
    p_admitido_em: novo.admitidoEm || null,
    p_observacoes: novo.observacoes,
    p_pastor_presidente: novo.pastorPresidente,
    p_jubilado: novo.jubilado,
  })
  return error ? falha(error, MENSAGEM_PRESIDENTE_REPETIDO) : ok(data as string)
}

export async function atualizarContato(
  pessoaId: string,
  dados: { nome: string; telefone: string; email?: string },
  identidade: Partial<IdentidadeGravada> = {},
): Promise<Resultado<null>> {
  // primeiro CPF e filiação (se o CPF já é de outra pessoa, nada se grava)
  const gravada = await gravarIdentidade(pessoaId, identidade)
  if (gravada.erro !== null) return gravada
  const linha: Record<string, string | null> = { nome: semInvisiveis(dados.nome), telefone: semInvisiveis(dados.telefone) || null }
  if (dados.email !== undefined) linha.email = dados.email.trim().toLowerCase() || null
  const { error } = await cliente().from('pessoas').update(linha).eq('id', pessoaId)
  return error ? falha(error) : ok(null)
}

export async function registrarTitulo(pessoaId: string, tituloId: string, desde: string): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('titulos_pessoa')
    .insert({ pessoa_id: pessoaId, titulo_id: tituloId, desde: desde || null })
  return error ? falha(error) : ok(null)
}

export async function mudarIgreja(
  pessoaId: string,
  igrejaId: string,
  funcao: string,
  data: string,
  pastorPresidente: boolean,
): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('mudar_igreja', {
    p_pessoa_id: pessoaId,
    p_igreja_id: igrejaId,
    p_funcao: funcao,
    p_data: data || null,
    p_pastor_presidente: pastorPresidente,
  })
  if (error?.code === '23514') return { dados: null, erro: 'A data da troca não pode ser anterior ao início na igreja atual.' }
  return error ? falha(error, MENSAGEM_PRESIDENTE_REPETIDO) : ok(null)
}

/** Marca (ou desmarca) o pastor presidente na igreja atual. Dá ou tira o perfil "presidente de igreja". */
export async function definirPastorPresidente(vinculoId: string, presidente: boolean): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('vinculos_igreja')
    .update({ pastor_presidente: presidente })
    .eq('id', vinculoId)
  return error ? falha(error, MENSAGEM_PRESIDENTE_REPETIDO) : ok(null)
}

/** Para cadastro feito por engano (duplicado, pessoa errada). Desligamento é outra coisa (Fase 4). */
export async function arquivarAssociado(associadoId: string): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('associados')
    .update({ arquivado_em: new Date().toISOString() })
    .eq('id', associadoId)
  return error ? falha(error) : ok(null)
}
