import type { Area } from '../../componentes/Icone'
import type { MesDoConselho, SituacaoMes } from '../../dados/conselhoFiscal'
import { exercicioDe } from '../../dados/financeiro'
import { hojeIso } from '../../utilitarios/formatos'

// Regras das telas do Conselho Fiscal (telas novas, Fase 5.5, parte 10), sem componentes.

/** A cor de cada situação do mês (o quadro colorido do painel). */
export const AREA_DA_SITUACAO: Record<SituacaoMes, Area | null> = {
  aprovado: 'financas',
  ressalva: 'eventos',
  para_analisar: 'pessoas',
  mudou: 'pessoas',
  esclarecimento: 'eventos',
  aberto: 'assembleias',
  futuro: null,
}

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** "OUT" a partir de "2026-10-01". */
export const mesCurto = (competencia: string) => MESES_CURTOS[Number(competencia.slice(5, 7)) - 1]

/** "2026-10" (para o endereço) a partir de "2026-10-01". */
export const mesDoEndereco = (competencia: string) => competencia.slice(0, 7)

/** O mês do endereço ("2026-10") vira a competência ("2026-10-01"), ou null. */
export function competenciaDoEndereco(mes: string | undefined): string | null {
  return mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? `${mes}-01` : null
}

/** Precisa do Conselho: sem análise, mudou depois da aprovação (o "esclarecimento" espera a tesouraria). */
export const precisaDoConselho = (m: MesDoConselho) => m.situacao === 'para_analisar' || m.situacao === 'mudou'

export const estaAprovado = (m: MesDoConselho) => m.situacao === 'aprovado' || m.situacao === 'ressalva'

/** O exercício que o parecer do ano abre: o anterior (o que fecha em março). */
export const exercicioDoParecer = () => exercicioDe(hojeIso()) - 1

/** O texto do parecer do ano, montado a partir dos meses (o Conselho ajusta antes de assinar). */
export function textoDoParecer(nomeExercicio: string, meses: MesDoConselho[]): string {
  const ressalvas = meses.filter((m) => m.situacao === 'ressalva' && m.aprovacao?.ressalva)
  const nomeMes = (c: string) =>
    ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][
      Number(c.slice(5, 7)) - 1
    ] + `/${c.slice(0, 4)}`
  const partes = [
    `O Conselho Fiscal do COMEP examinou, mês a mês, os lançamentos e os comprovantes do exercício ${nomeExercicio} (abril a março) e aprovou as contas dos 12 meses.`,
  ]
  if (ressalvas.length > 0) {
    partes.push('Ressalvas registradas nos meses:')
    for (const m of ressalvas) partes.push(`- ${nomeMes(m.competencia)}: ${m.aprovacao?.ressalva}`)
  }
  partes.push('É de parecer favorável à aprovação das contas pela Assembleia Geral (Art. 14).')
  return partes.join('\n')
}
