import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { LancamentoRelatorio } from '../../dados/prestacao'
import { exercicioDe } from '../../dados/financeiro'
import { linkDoArquivo } from '../../dados/pedidos'
import { hojeIso } from '../../utilitarios/formatos'

// Ajudantes das telas do Financeiro e do Conselho Fiscal (sem componentes): os meses do exercício, o exercício
// escolhido na tela e o link dos comprovantes.

export type Concluir = (r: { erro: string | null }, sucesso: string) => boolean

/** O link temporário de um arquivo privado (undefined = carregando; null = não abriu). */
export function useLinkDoArquivo(caminho: string | null): string | null | undefined {
  const [link, setLink] = useState<{ caminho: string; url: string | null } | null>(null)
  useEffect(() => {
    let ativo = true
    if (caminho) void linkDoArquivo(caminho).then((url) => ativo && setLink({ caminho, url }))
    return () => {
      ativo = false
    }
  }, [caminho])
  if (!caminho) return null
  return link?.caminho === caminho ? link.url : undefined
}

/** O exercício escolhido na tela (?exercicio=2025), com o atual como padrão. */
export function useExercicio(padrao?: number): [number, (e: number) => void] {
  const [parametros, setParametros] = useSearchParams()
  const atual = padrao ?? exercicioDe(hojeIso())
  const lido = Number(parametros.get('exercicio'))
  const exercicio = Number.isInteger(lido) && lido >= 2000 && lido <= 2100 ? lido : atual
  const escolher = (e: number) =>
    setParametros(
      (p) => {
        const novo = new URLSearchParams(p)
        novo.set('exercicio', String(e))
        return novo
      },
      { replace: true },
    )
  return [exercicio, escolher]
}

/** O estatuto do COMEP é de 25/05/2021: o primeiro exercício possível é 2021/2022. */
export const PRIMEIRO_EXERCICIO = 2021

const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "novembro de 2026" a partir de "2026-11" (ou de uma data). */
export function nomeDoMes(mesIso: string, maiuscula = false): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  const nome = `${MESES_NOME[mes - 1]} de ${ano}`
  return maiuscula ? nome.charAt(0).toUpperCase() + nome.slice(1) : nome
}

/** Os 12 meses do exercício (abril a março), como "AAAA-MM". */
export function mesesDoExercicio(exercicio: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = ((i + 3) % 12) + 1
    const ano = mes >= 4 ? exercicio : exercicio + 1
    return `${ano}-${String(mes).padStart(2, '0')}`
  })
}

/** O último dia do mês "AAAA-MM", como AAAA-MM-DD. */
export function fimDoMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return `${mesIso}-${String(ultimo).padStart(2, '0')}`
}

/** O mês antes ou depois (n = −1 ou +1). */
export function somarMes(mesIso: string, n: number): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "17 de novembro" a partir de AAAA-MM-DD. */
export function diaPorExtenso(dataIso: string): string {
  const [, mes, dia] = dataIso.split('-').map(Number)
  return `${dia} de ${MESES_NOME[mes - 1]}`
}

/** A porcentagem inteira (0 quando o total é zero). */
export const porcento = (parte: number, total: number) => (total > 0 ? Math.round((parte * 100) / total) : 0)

/** "1 despesa" / "3 despesas". */
export const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

const MESES_EXERCICIO = ['abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'janeiro', 'fevereiro', 'março']

const ehTransferencia = (sistema: string | null | undefined) => (sistema ?? '').startsWith('transferencia')

export type MesDoExercicio = { chave: string; nome: string; receitas: number; despesas: number }

/** As receitas e as despesas de cada mês do exercício (sem as transferências, a partir do saldo inicial da conta). */
export function mesesComValores(exercicio: number, lancamentos: LancamentoRelatorio[]): MesDoExercicio[] {
  return MESES_EXERCICIO.map((nomeMes, i) => {
    const mes = ((i + 3) % 12) + 1
    const ano = mes >= 4 ? exercicio : exercicio + 1
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
    const doMes = lancamentos.filter(
      (l) => l.situacao === 'efetivado' && l.data.startsWith(prefixo) && !ehTransferencia(l.categoria?.sistema) && (!l.conta || l.data >= l.conta.saldo_inicial_em),
    )
    const receitas = doMes.filter((l) => l.tipo === 'entrada').reduce((t, l) => t + Number(l.valor), 0)
    const despesas = doMes.filter((l) => l.tipo === 'saida').reduce((t, l) => t + Number(l.valor), 0)
    return { chave: prefixo, nome: `${nomeMes}/${ano}`, receitas, despesas }
  })
}

