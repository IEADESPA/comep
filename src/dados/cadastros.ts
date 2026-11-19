// Listas e cadastros da secretaria: denominações, títulos ministeriais e igrejas.
import { cliente, falha, ok, type Resultado } from './cliente'

/** A tradição da denominação (Fase 5.5): serve aos modelos de credencial por tradição e ao mapa da cidade. */
export type Tradicao =
  | 'pentecostal'
  | 'neopentecostal'
  | 'batista'
  | 'reformada'
  | 'metodista'
  | 'luterana'
  | 'anglicana'
  | 'adventista'
  | 'congregacional'
  | 'outra'

export const NOME_DA_TRADICAO: Record<Tradicao, string> = {
  pentecostal: 'Pentecostal',
  neopentecostal: 'Neopentecostal',
  batista: 'Batista',
  reformada: 'Reformada e presbiteriana',
  metodista: 'Metodista e wesleyana',
  luterana: 'Luterana',
  anglicana: 'Anglicana',
  adventista: 'Adventista',
  congregacional: 'Congregacional',
  outra: 'Outra',
}

export type Denominacao = { id: string; nome: string; sigla: string | null; tradicao: Tradicao | null }
export type Titulo = { id: string; nome: string; ordem: number }

export type Igreja = {
  id: string
  nome: string
  denominacao_id: string | null
  cnpj: string | null
  /** Nome curto que vai na credencial (ex.: IEADESPA) */
  sigla: string | null
  endereco: string | null
  bairro_id: string | null
  telefone: string | null
  presidente_nome: string | null
  /** completo (com registro), sem_registro (cadastro simples) ou em_analise (o pastor cadastrou; a secretaria confere) */
  cadastro: 'completo' | 'sem_registro' | 'em_analise'
  natureza_juridica: 'organizacao_religiosa' | 'associacao_privada' | null
  fundada_em: number | null
  membros: number | null
  cep: string | null
  email: string | null
  site: string | null
  convencao: string | null
  cadastrada_por: string | null
  criado_em: string
  denominacao: { nome: string; sigla: string | null; arquivado_em: string | null; tradicao: Tradicao | null } | null
  bairro: { nome: string; arquivado_em: string | null } | null
}

const CAMPOS_IGREJA =
  'id, nome, denominacao_id, cnpj, sigla, endereco, bairro_id, telefone, presidente_nome, cadastro, natureza_juridica, fundada_em, ' +
  'membros, cep, email, site, convencao, cadastrada_por, criado_em, ' +
  'denominacao:denominacoes(nome, sigla, arquivado_em, tradicao), bairro:bairros(nome, arquivado_em)'

// ---------- Denominações ----------

export async function listarDenominacoes(): Promise<Resultado<Denominacao[]>> {
  const { data, error } = await cliente()
    .from('denominacoes')
    .select('id, nome, sigla, tradicao')
    .is('arquivado_em', null)
    .order('nome')
    .returns<Denominacao[]>()
  return error ? falha(error) : ok(data)
}

/** Cria (sem id) ou altera a denominação, com a tradição (secretaria e presidência). */
export async function salvarDenominacao(dados: Omit<Denominacao, 'id'>, id?: string): Promise<Resultado<null>> {
  const linha = { nome: dados.nome.trim(), sigla: dados.sigla?.trim() || null, tradicao: dados.tradicao || null }
  const { error } = id ? await cliente().from('denominacoes').update(linha).eq('id', id) : await cliente().from('denominacoes').insert(linha)
  return error ? falha(error, `Já existe a denominação "${linha.nome}".`) : ok(null)
}

// ---------- Títulos ministeriais ----------

export async function listarTitulos(): Promise<Resultado<Titulo[]>> {
  const { data, error } = await cliente()
    .from('titulos_ministeriais')
    .select('id, nome, ordem')
    .is('arquivado_em', null)
    .order('ordem')
    .order('nome')
  return error ? falha(error) : ok(data)
}

// ---------- Igrejas ----------

/** As igrejas do COMEP (a igreja nova, ainda em análise pela secretaria, fica de fora). */
export async function listarIgrejas(): Promise<Resultado<Igreja[]>> {
  const { data, error } = await cliente()
    .from('igrejas')
    .select(CAMPOS_IGREJA)
    .is('arquivado_em', null)
    .neq('cadastro', 'em_analise')
    .order('nome')
    .returns<Igreja[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarIgreja(id: string): Promise<Resultado<Igreja | null>> {
  const { data, error } = await cliente()
    .from('igrejas')
    .select(CAMPOS_IGREJA)
    .eq('id', id)
    .is('arquivado_em', null)
    .maybeSingle<Igreja>()
  return error ? falha(error) : ok(data)
}

/** Os dados que a secretaria (e a presidência) mudam na ficha da igreja (o cadastro novo é pela função cadastrar_igreja). */
export type DadosFichaIgreja = Pick<
  Igreja,
  | 'nome'
  | 'sigla'
  | 'denominacao_id'
  | 'cnpj'
  | 'natureza_juridica'
  | 'fundada_em'
  | 'membros'
  | 'endereco'
  | 'bairro_id'
  | 'cep'
  | 'telefone'
  | 'email'
  | 'site'
  | 'convencao'
  | 'presidente_nome'
>

/** Altera a igreja (secretaria e presidência; a regra do banco protege o resto). */
export async function atualizarIgreja(id: string, dados: Partial<DadosFichaIgreja>): Promise<Resultado<null>> {
  const linha = Object.fromEntries(
    Object.entries(dados).map(([chave, valor]) => [chave, typeof valor === 'string' ? valor.trim() || null : valor]),
  )
  const { data, error } = await cliente().from('igrejas').update(linha).eq('id', id).select('id')
  if (error) return falha(error, 'Já existe uma igreja com esse CNPJ ou essa sigla.')
  return data.length === 0 ? { dados: null, erro: 'Você não pode mudar os dados desta igreja agora.' } : ok(null)
}

export async function arquivarIgreja(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().from('igrejas').update({ arquivado_em: new Date().toISOString() }).eq('id', id)
  return error ? falha(error) : ok(null)
}

export type MinistroDaIgreja = {
  pessoa_id: string
  nome: string
  titulo: string | null
  funcao: string | null
  pastor_presidente: boolean
}

/** Associados com vínculo atual na igreja (a RLS só devolve o que quem consulta pode ver). */
export async function ministrosDaIgreja(igrejaId: string): Promise<Resultado<MinistroDaIgreja[]>> {
  const { data, error } = await cliente()
    .from('vw_associados')
    .select('pessoa_id, nome, titulo, funcao, pastor_presidente')
    .eq('igreja_id', igrejaId)
    .order('nome')
  return error ? falha(error) : ok(data)
}
