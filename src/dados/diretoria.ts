// Fase 4.4 — Diretoria e Conselho Fiscal: mandatos (Art. 12 e 14). O cargo dá o perfil enquanto o mandato vale.
import { cliente, falha, ok, type Resultado } from './cliente'

export type Cargo =
  | 'presidente'
  | 'vice_presidente'
  | 'primeiro_secretario'
  | 'segundo_secretario'
  | 'primeiro_tesoureiro'
  | 'segundo_tesoureiro'
  | 'secretario_executivo'
  | 'conselheiro_fiscal'

/** Na ordem do Art. 12; o Conselho Fiscal tem 3 membros. */
export const CARGOS: readonly { cargo: Cargo; nome: string; perfil: string }[] = [
  { cargo: 'presidente', nome: 'Presidente', perfil: 'Presidência' },
  { cargo: 'vice_presidente', nome: 'Vice-presidente', perfil: 'Presidência' },
  { cargo: 'primeiro_secretario', nome: '1º secretário', perfil: 'Secretaria' },
  { cargo: 'segundo_secretario', nome: '2º secretário', perfil: 'Secretaria' },
  { cargo: 'primeiro_tesoureiro', nome: '1º tesoureiro', perfil: 'Tesouraria' },
  { cargo: 'segundo_tesoureiro', nome: '2º tesoureiro', perfil: 'Tesouraria' },
  { cargo: 'secretario_executivo', nome: 'Secretário executivo', perfil: '—' },
  { cargo: 'conselheiro_fiscal', nome: 'Conselheiro fiscal', perfil: 'Conselho Fiscal' },
]

export const NOME_DO_CARGO = Object.fromEntries(CARGOS.map((c) => [c.cargo, c.nome])) as Record<Cargo, string>

export type Mandato = {
  id: string
  pessoa_id: string
  nome: string
  cargo: Cargo
  orgao: 'conselho_diretor' | 'conselho_fiscal'
  inicio: string
  fim: string
  encerrado_em: string | null
  motivo_encerramento: string | null
  encontro_id: string | null
  encontro_titulo: string | null
  vigente: boolean
}

export async function listarMandatos(): Promise<Resultado<Mandato[]>> {
  const { data, error } = await cliente().from('vw_mandatos').select('*').order('inicio', { ascending: false }).returns<Mandato[]>()
  return error ? falha(error) : ok(data)
}

export type NovaDiretoria = {
  inicio: string
  fim: string
  /** a assembleia (instalada) que elegeu; no primeiro registro, pode ficar vazia e vale o documento */
  encontro_id: string | null
  documento: string
  membros: { cargo: Cargo; pessoa_id: string }[]
}

/** A presidência registra a diretoria eleita. Só associados em dia podem ser votados (Art. 11). */
export async function registrarDiretoria(dados: NovaDiretoria): Promise<Resultado<number>> {
  const { data, error } = await cliente().rpc('registrar_diretoria', { p_dados: dados })
  return error ? falha(error) : ok(data as number)
}

/**
 * Mandato que acaba antes. A própria pessoa renuncia; a presidência encerra os outros. Tirar alguém do cargo de
 * presidente, vice ou do Conselho Fiscal pede a assembleia (instalada) que tratou disso. No dia do início: engano.
 */
export async function encerrarMandato(id: string, data: string, motivo: string, encontroId: string | null): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('encerrar_mandato', { p_id: id, p_data: data, p_motivo: motivo, p_encontro_id: encontroId })
  return error ? falha(error) : ok(null)
}
