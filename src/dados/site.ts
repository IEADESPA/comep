// Dados públicos do COMEP mostrados no site (PROJETO.md, decisão 14): editáveis pela diretoria.
import { cliente, falha, ok, type Resultado } from './cliente'
import type { Cargo } from './diretoria'

export type DadosComep = {
  cnpj: string | null
  endereco_sede: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  facebook: string | null
  youtube: string | null
  reunioes_mensais: string | null
}

export const CAMPOS_DADOS_COMEP: { campo: keyof DadosComep; rotulo: string; dica?: string }[] = [
  { campo: 'endereco_sede', rotulo: 'Sede (endereço)' },
  { campo: 'reunioes_mensais', rotulo: 'Reuniões mensais', dica: 'Ex.: Toda 1ª segunda-feira do mês, às 19h' },
  { campo: 'telefone', rotulo: 'Telefone' },
  { campo: 'whatsapp', rotulo: 'WhatsApp' },
  { campo: 'email', rotulo: 'E-mail' },
  { campo: 'instagram', rotulo: 'Instagram', dica: '@usuario ou o endereço completo' },
  { campo: 'facebook', rotulo: 'Facebook', dica: 'Endereço da página' },
  { campo: 'youtube', rotulo: 'YouTube', dica: 'Endereço do canal' },
  { campo: 'cnpj', rotulo: 'CNPJ' },
]

const COLUNAS = CAMPOS_DADOS_COMEP.map((c) => c.campo).join(', ')

let emMemoria: Promise<Resultado<DadosComep>> | null = null

/** Funciona também para o visitante (sem login): são dados públicos. Busca uma vez por visita. */
export function buscarDadosComep(): Promise<Resultado<DadosComep>> {
  emMemoria ??= (async () => {
    const { data, error } = await cliente().from('dados_comep').select(COLUNAS).single<DadosComep>()
    if (error) {
      emMemoria = null
      return falha<DadosComep>(error)
    }
    return ok(data)
  })()
  return emMemoria
}

export async function salvarDadosComep(dados: DadosComep): Promise<Resultado<null>> {
  const linha = Object.fromEntries(
    Object.entries(dados).map(([campo, valor]) => [campo, typeof valor === 'string' && valor.trim() ? valor.trim() : null]),
  )
  const { error } = await cliente().from('dados_comep').update(linha).eq('id', true)
  emMemoria = null
  if (error?.code === '23514') return { dados: null, erro: 'CNPJ inválido. Confira os números ou deixe em branco.' }
  return error ? falha(error) : ok(null)
}

// ---------- Site vivo (Fase 5.5.4): a diretoria e as igrejas, a partir do sistema ----------


export type MembroDaDiretoriaPublica = { cargo: Cargo; nome: string; inicio: string; fim: string }

export async function diretoriaPublica(): Promise<Resultado<MembroDaDiretoriaPublica[]>> {
  const { data, error } = await cliente().rpc('diretoria_publica')
  return error ? falha(error) : ok((data ?? []) as MembroDaDiretoriaPublica[])
}

export type IgrejaPublica = { id: string; nome: string; sigla: string | null; denominacao: string | null; bairro: string | null; ministros: number }

export async function igrejasPublicas(): Promise<Resultado<IgrejaPublica[]>> {
  const { data, error } = await cliente().rpc('igrejas_publicas')
  return error ? falha(error) : ok((data ?? []) as IgrejaPublica[])
}

export type NumerosPublicos = { ministros: number; igrejas: number; denominacoes: number }

export async function numerosPublicos(): Promise<Resultado<NumerosPublicos>> {
  const { data, error } = await cliente().rpc('numeros_publicos')
  return error ? falha(error) : ok(data as NumerosPublicos)
}
