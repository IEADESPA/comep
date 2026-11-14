// Fase 5.4 — Mural de avisos (só a secretaria publica; ela escolhe se o aviso vai também para o site)
// e o painel da presidência (associados, finanças, presença e agenda).
import { cliente, falha, ok, type Resultado } from './cliente'

export type Aviso = {
  id: string
  titulo: string
  texto: string
  no_site: boolean
  fixado: boolean
  valido_ate: string | null
  criado_em: string
}

export async function listarAvisos(): Promise<Resultado<Aviso[]>> {
  const { data, error } = await cliente()
    .from('avisos')
    .select('id, titulo, texto, no_site, fixado, valido_ate, criado_em')
    .order('fixado', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(100)
    .returns<Aviso[]>()
  return error ? falha(error) : ok(data)
}

export type DadosAviso = { titulo: string; texto: string; no_site: boolean; fixado: boolean; valido_ate: string }

export async function salvarAviso(id: string | null, dados: DadosAviso): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_aviso', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function arquivarAviso(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('arquivar_aviso', { p_id: id })
  return error ? falha(error) : ok(null)
}

export type AvisoPublico = { id: string; titulo: string; texto: string; criado_em: string }

export async function avisosPublicos(): Promise<Resultado<AvisoPublico[]>> {
  const { data, error } = await cliente().rpc('avisos_publicos')
  return error ? falha(error) : ok((data ?? []) as AvisoPublico[])
}

// ---------- Painel da presidência ----------

export type PainelPresidencia = {
  associados: { ativos: number; em_dia: number; jubilados: number; igrejas: number; pedidos: number }
  financas: {
    saldo: number
    entradas_mes: number
    saidas_mes: number
    despesas_a_autorizar: number
    contribuicoes_vencidas: number
    pagamentos_a_conferir: number
  }
  presenca: {
    ultimos: { id: string; titulo: string; tipo: string; inicio: string; presentes: number }[]
    com_faltas: number
    justificativas_pendentes: number
  }
  agenda: {
    encontros: { id: string; titulo: string; tipo: string; inicio: string; situacao: string }[]
    eventos: {
      id: string
      titulo: string
      tipo: string
      inicio: string
      situacao: string
      inscritos: number
      vagas: number | null
      orcamento: number | null
      orcamento_aprovado: boolean
    }[]
    comissoes: number
  }
}

export async function painelPresidencia(): Promise<Resultado<PainelPresidencia>> {
  const { data, error } = await cliente().rpc('painel_presidencia')
  return error ? falha(error) : ok(data as PainelPresidencia)
}
