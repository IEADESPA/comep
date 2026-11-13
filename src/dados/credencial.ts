// Credencial do associado — Fase 3.1: dados (CPF, filiação, sigla da igreja) e pendências.
import { cliente, falha, ok, type Resultado } from './cliente'

/** CPF (só números) e filiação, como estão gravados no cadastro da pessoa. */
export type IdentidadeGravada = { cpf: string | null; nome_pai: string | null; nome_mae: string | null }

export const MENSAGEM_CPF_REPETIDO = 'Este CPF já está no cadastro de outra pessoa. Confira os números ou fale com a secretaria.'

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
