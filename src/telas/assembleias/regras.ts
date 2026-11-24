// Ajudantes das telas das Assembleias (Fase 5.5, parte 14): a hora, o nome curto do encontro, a lista de presença
// aberta, o roteiro da condução e os relógios das telas ao vivo. Ficam fora dos .tsx de componentes (oxlint).
import { useEffect, useState } from 'react'
import { NOME_DO_CARGO, type Cargo } from '../../dados/diretoria'
import { SIGLA_DO_TIPO, type Encontro, type EncontroCompleto, type ItemDaPauta } from '../../dados/encontros'
import type { Perfil } from '../../dados/perfis'
import type { VotacaoDoItem } from '../../dados/votacoes'
import { useSessao } from '../../estado/contexto'
import { formatarDataDeInstante } from '../../utilitarios/formatos'

export function usePerfisDaConta(): readonly Perfil[] | null {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta === null) return null
  return estado.conta.tipo === 'ok' ? estado.conta.conta.perfis : []
}

export const ehDaSecretaria = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')

export const horaDe = (instante: string) =>
  new Date(instante).toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' })

/** "AGO de 28/04/2027" (o nome curto do encontro, no alto das telas). */
export function nomeCurto(e: Pick<Encontro, 'tipo' | 'inicio'>): string {
  return `${SIGLA_DO_TIPO[e.tipo]} de ${formatarDataDeInstante(e.inicio)}`
}

/** Busca de novo a cada N segundos, enquanto a tela está aberta e visível. */
export function useAtualizarACada(recarregar: () => void, segundos: number, ligado = true) {
  useEffect(() => {
    if (!ligado) return
    const relogio = window.setInterval(() => {
      if (document.visibilityState === 'visible') recarregar()
    }, segundos * 1000)
    return () => window.clearInterval(relogio)
  }, [recarregar, segundos, ligado])
}

/** A hora de agora, atualizada a cada N segundos. */
export function useAgora(segundos = 30): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), segundos * 1000)
    return () => window.clearInterval(relogio)
  }, [segundos])
  return agora
}

/** A lista de presença fica aberta de 6 horas antes a 18 horas depois do horário marcado (a mesma regra do banco). */
const HORA = 3_600_000
export const ABRE_ANTES = 6 * HORA
export const FECHA_DEPOIS = 18 * HORA

export function presencaAberta(e: Pick<Encontro, 'situacao' | 'presenca_encerrada_em' | 'inicio'>, agora: number): boolean {
  const inicio = new Date(e.inicio).getTime()
  return e.situacao === 'convocado' && !e.presenca_encerrada_em && agora >= inicio - ABRE_ANTES && agora <= inicio + FECHA_DEPOIS
}

/** "Nome (1º Secretário)": o cargo de quem assinou, guardado na assinatura (sem mandato registrado: pelo perfil). */
export function quemAssinou(nome: string | undefined, cargo: string | null): string {
  const comoAssinou = cargo ? (NOME_DO_CARGO[cargo as Cargo] ?? cargo) : 'pelo perfil de acesso'
  return `${nome ?? '—'} (${comoAssinou})`
}

// ---------- O roteiro da condução: abertura, pauta (edital e período) e encerramento ----------

export type ItemDoRoteiro = {
  /** abertura:N, pauta:<id> ou encerramento (o que vai em encontros.roteiro_atual) */
  chave: string
  titulo: string
  /** o número do item da pauta */
  numero: number | null
  pauta: ItemDaPauta | null
}

export function itensDoRoteiro(e: EncontroCompleto): ItemDoRoteiro[] {
  return [
    ...e.roteiro_abertura.map((titulo, i) => ({ chave: `abertura:${i}`, titulo, numero: null, pauta: null })),
    ...e.pauta.map((p) => ({ chave: `pauta:${p.id}`, titulo: p.titulo, numero: p.ordem, pauta: p })),
    { chave: 'encerramento', titulo: 'Encerramento', numero: null, pauta: null },
  ]
}

/** A votação on-line mais recente do item (a cancelada não conta). */
export function votacaoDoItem(votacoes: VotacaoDoItem[], pautaId: string): VotacaoDoItem | null {
  return [...votacoes].reverse().find((v) => v.pauta_id === pautaId && v.situacao !== 'cancelada') ?? null
}
