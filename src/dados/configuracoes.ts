// Configurações: listas que a própria diretoria mantém e valores da contribuição.
import { cliente, falha, ok, type Resultado } from './cliente'

// ---------- Listas configuráveis ----------

/** Tabelas de listas simples (nome + campos opcionais). */
export type TabelaLista = 'denominacoes' | 'bairros' | 'titulos_ministeriais'

export type ItemLista = { id: string; nome: string; sigla?: string | null; ordem?: number }

const CAMPOS: Record<TabelaLista, string> = {
  denominacoes: 'id, nome, sigla',
  bairros: 'id, nome',
  titulos_ministeriais: 'id, nome, ordem',
}

export async function listarItens(tabela: TabelaLista): Promise<Resultado<ItemLista[]>> {
  let consulta = cliente().from(tabela).select(CAMPOS[tabela]).is('arquivado_em', null)
  if (tabela === 'titulos_ministeriais') consulta = consulta.order('ordem')
  const { data, error } = await consulta.order('nome').returns<ItemLista[]>()
  return error ? falha(error) : ok(data)
}

type LinhaLista = { nome: string; sigla?: string | null; ordem?: number }

function limpar(dados: Omit<ItemLista, 'id'>): LinhaLista {
  const linha: LinhaLista = { nome: dados.nome.trim() }
  if (dados.sigla !== undefined) linha.sigla = dados.sigla?.trim() || null
  if (dados.ordem !== undefined) linha.ordem = dados.ordem
  return linha
}

export async function criarItem(tabela: TabelaLista, dados: Omit<ItemLista, 'id'>): Promise<Resultado<null>> {
  const { error } = await cliente().from(tabela).insert(limpar(dados))
  return error ? falha(error, `Já existe "${dados.nome.trim()}" nesta lista.`) : ok(null)
}

export async function alterarItem(
  tabela: TabelaLista,
  id: string,
  dados: Omit<ItemLista, 'id'>,
): Promise<Resultado<null>> {
  const { error } = await cliente().from(tabela).update(limpar(dados)).eq('id', id)
  return error ? falha(error, `Já existe "${dados.nome.trim()}" nesta lista.`) : ok(null)
}

export async function arquivarItem(tabela: TabelaLista, id: string): Promise<Resultado<null>> {
  const { error } = await cliente().from(tabela).update({ arquivado_em: new Date().toISOString() }).eq('id', id)
  return error ? falha(error) : ok(null)
}

// ---------- Valores da contribuição ----------

export type CategoriaContribuicao = 'presidente_igreja' | 'nao_presidente' | 'jubilado'
export type TipoValor = 'mensal' | 'anual' | 'inscricao'

export const CATEGORIAS: readonly CategoriaContribuicao[] = ['presidente_igreja', 'nao_presidente', 'jubilado']
export const TIPOS_VALOR: readonly TipoValor[] = ['mensal', 'anual', 'inscricao']

export const NOME_DA_CATEGORIA: Record<CategoriaContribuicao, string> = {
  presidente_igreja: 'Presidente de igreja',
  nao_presidente: 'Não presidente de igreja',
  jubilado: 'Jubilado',
}

export const NOME_DO_TIPO_VALOR: Record<TipoValor, string> = {
  mensal: 'Mensal',
  anual: 'Anual (pago em abril)',
  inscricao: 'Taxa de inscrição',
}

export type ValorContribuicao = {
  id: string
  categoria: CategoriaContribuicao
  tipo: TipoValor
  valor: number
  vigente_desde: string
  aprovado_em_assembleia: string | null
  ata: string | null
  observacao: string | null
}

const CAMPOS_VALOR = 'id, categoria, tipo, valor, vigente_desde, aprovado_em_assembleia, ata, observacao'

export type ValoresContribuicao = { vigentes: ValorContribuicao[]; historico: ValorContribuicao[] }

export async function listarValores(): Promise<Resultado<ValoresContribuicao>> {
  const [vigentes, historico] = await Promise.all([
    cliente().from('vw_valores_vigentes').select(CAMPOS_VALOR).returns<ValorContribuicao[]>(),
    cliente()
      .from('valores_contribuicao')
      .select(CAMPOS_VALOR)
      .is('arquivado_em', null)
      .order('vigente_desde', { ascending: false })
      .order('criado_em', { ascending: false })
      .returns<ValorContribuicao[]>(),
  ])
  const erro = vigentes.error ?? historico.error
  if (erro) return falha(erro)
  return ok({ vigentes: vigentes.data ?? [], historico: historico.data ?? [] })
}

export type NovoValor = Omit<ValorContribuicao, 'id'>

export async function lancarValor(novo: NovoValor): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('valores_contribuicao')
    .insert({
      ...novo,
      aprovado_em_assembleia: novo.aprovado_em_assembleia || null,
      ata: novo.ata?.trim() || null,
      observacao: novo.observacao?.trim() || null,
    })
  return error ? falha(error, 'Já existe um valor para essa categoria e tipo com a mesma data de início.') : ok(null)
}

export async function arquivarValor(id: string): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('valores_contribuicao')
    .update({ arquivado_em: new Date().toISOString() })
    .eq('id', id)
  return error ? falha(error) : ok(null)
}

/** 40 → "R$ 40,00" */
export function formatarReais(valor: number | string): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
