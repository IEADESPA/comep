// Associados (ministros): lista, ficha, cadastro direto e históricos de título e igreja.
import { cliente, falha, ok, type Resultado } from './cliente'

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

/** Sugestões para o campo "função na igreja" (texto livre). */
export const SUGESTOES_FUNCAO = ['Pastor presidente', 'Pastor auxiliar', 'Evangelista dirigente', 'Missionário', 'Líder']

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
}

export type TituloDaPessoa = { id: string; desde: string | null; criado_em: string; titulo: { nome: string } | null }

export type VinculoDaPessoa = {
  id: string
  igreja_id: string
  funcao: string | null
  inicio: string | null
  fim: string | null
  igreja: { nome: string } | null
}

export type FichaAssociado = {
  associado: Associado
  titulos: TituloDaPessoa[]
  vinculos: VinculoDaPessoa[]
}

export async function listarAssociados(): Promise<Resultado<Associado[]>> {
  const { data, error } = await cliente().from('vw_associados').select('*').order('nome').returns<Associado[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarFicha(pessoaId: string): Promise<Resultado<FichaAssociado | null>> {
  const [associado, titulos, vinculos] = await Promise.all([
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
      .select('id, igreja_id, funcao, inicio, fim, igreja:igrejas(nome)')
      .eq('pessoa_id', pessoaId)
      .is('arquivado_em', null)
      .order('criado_em', { ascending: false })
      .returns<VinculoDaPessoa[]>(),
  ])
  const erro = associado.error ?? titulos.error ?? vinculos.error
  if (erro) return falha(erro)
  if (!associado.data) return ok(null)
  return ok({ associado: associado.data, titulos: titulos.data ?? [], vinculos: vinculos.data ?? [] })
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
}

/** Cadastro direto de associado atual (Art. 7º, a). Tudo ou nada, numa única operação no banco. */
export async function cadastrarAssociado(novo: NovoAssociado): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('cadastrar_associado', {
    p_nome: novo.nome,
    p_email: novo.email,
    p_telefone: novo.telefone,
    p_titulo_id: novo.tituloId || null,
    p_titulo_desde: novo.tituloDesde || null,
    p_igreja_id: novo.igrejaId || null,
    p_funcao: novo.funcao,
    p_vinculo_inicio: novo.vinculoInicio || null,
    p_admitido_em: novo.admitidoEm || null,
    p_observacoes: novo.observacoes,
  })
  return error ? falha(error, 'Esta pessoa já está cadastrada como associada.') : ok(data as string)
}

export async function atualizarContato(
  pessoaId: string,
  dados: { nome: string; telefone: string; email?: string },
): Promise<Resultado<null>> {
  const linha: Record<string, string | null> = { nome: dados.nome.trim(), telefone: dados.telefone.trim() || null }
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
): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('mudar_igreja', {
    p_pessoa_id: pessoaId,
    p_igreja_id: igrejaId,
    p_funcao: funcao,
    p_data: data || null,
  })
  if (error?.code === '23514') return { dados: null, erro: 'A data da troca não pode ser anterior ao início na igreja atual.' }
  return error ? falha(error) : ok(null)
}

/** Para cadastro feito por engano (duplicado, pessoa errada). Desligamento é outra coisa (Fase 4). */
export async function arquivarAssociado(associadoId: string): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('associados')
    .update({ arquivado_em: new Date().toISOString() })
    .eq('id', associadoId)
  return error ? falha(error) : ok(null)
}
