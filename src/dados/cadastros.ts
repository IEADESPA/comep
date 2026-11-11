// Listas e cadastros da secretaria: denominações, títulos ministeriais e igrejas.
import { cliente, falha, ok, type Resultado } from './cliente'

export type Denominacao = { id: string; nome: string; sigla: string | null }
export type Titulo = { id: string; nome: string; ordem: number }

export type Igreja = {
  id: string
  nome: string
  denominacao_id: string | null
  cnpj: string | null
  endereco: string | null
  bairro: string | null
  telefone: string | null
  presidente_nome: string | null
  denominacao: { nome: string; sigla: string | null } | null
}

export type DadosIgreja = Omit<Igreja, 'id' | 'denominacao'>

const CAMPOS_IGREJA = 'id, nome, denominacao_id, cnpj, endereco, bairro, telefone, presidente_nome, denominacao:denominacoes(nome, sigla)'

const vazioParaNulo = (valor: string | null) => (valor && valor.trim() ? valor.trim() : null)

// ---------- Denominações ----------

export async function listarDenominacoes(): Promise<Resultado<Denominacao[]>> {
  const { data, error } = await cliente()
    .from('denominacoes')
    .select('id, nome, sigla')
    .is('arquivado_em', null)
    .order('nome')
  return error ? falha(error) : ok(data)
}

export async function criarDenominacao(nome: string, sigla: string): Promise<Resultado<Denominacao>> {
  const { data, error } = await cliente()
    .from('denominacoes')
    .insert({ nome: nome.trim(), sigla: vazioParaNulo(sigla) })
    .select('id, nome, sigla')
    .single()
  return error ? falha(error, 'Já existe uma denominação com esse nome.') : ok(data)
}

export async function arquivarDenominacao(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().from('denominacoes').update({ arquivado_em: new Date().toISOString() }).eq('id', id)
  return error ? falha(error) : ok(null)
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

export async function listarIgrejas(): Promise<Resultado<Igreja[]>> {
  const { data, error } = await cliente()
    .from('igrejas')
    .select(CAMPOS_IGREJA)
    .is('arquivado_em', null)
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

/** Cria (sem id) ou altera (com id) uma igreja. Devolve o id. */
export async function salvarIgreja(dados: DadosIgreja, id?: string): Promise<Resultado<string>> {
  const linha = {
    nome: dados.nome.trim(),
    denominacao_id: dados.denominacao_id || null,
    cnpj: vazioParaNulo(dados.cnpj),
    endereco: vazioParaNulo(dados.endereco),
    bairro: vazioParaNulo(dados.bairro),
    telefone: vazioParaNulo(dados.telefone),
    presidente_nome: vazioParaNulo(dados.presidente_nome),
  }
  const consulta = id
    ? cliente().from('igrejas').update(linha).eq('id', id).select('id').single()
    : cliente().from('igrejas').insert(linha).select('id').single()
  const { data, error } = await consulta
  return error ? falha(error, 'Já existe uma igreja com esse CNPJ.') : ok(data.id as string)
}

export async function arquivarIgreja(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().from('igrejas').update({ arquivado_em: new Date().toISOString() }).eq('id', id)
  return error ? falha(error) : ok(null)
}

export type MinistroDaIgreja = { pessoa_id: string; nome: string; titulo: string | null; funcao: string | null }

/** Associados com vínculo atual na igreja (a RLS só devolve o que quem consulta pode ver). */
export async function ministrosDaIgreja(igrejaId: string): Promise<Resultado<MinistroDaIgreja[]>> {
  const { data, error } = await cliente()
    .from('vw_associados')
    .select('pessoa_id, nome, titulo, funcao')
    .eq('igreja_id', igrejaId)
    .order('nome')
  return error ? falha(error) : ok(data)
}
