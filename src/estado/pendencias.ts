// O número ao lado de uma função no menu do módulo (telas novas, Fase 5.5): o que espera alguém da diretoria
// (pedidos de associação, correções, comprovantes, despesas, empréstimos, justificativas, igrejas para conferir e
// suspensas). Uma contagem que falha só fica sem número.
import { useEffect, useState } from 'react'
import type { ChavePendencia, Modulo } from '../componentes/menu'
import { despesasAguardando } from '../dados/caixa'
import type { Resultado } from '../dados/cliente'
import { listarEsclarecimentos, mesesDoConselho } from '../dados/conselhoFiscal'
import { listarJustificativas } from '../dados/encontros'
import { exercicioDe, informesPendentes } from '../dados/financeiro'
import { documentosParaConferir, igrejasEmAnalise, listarPedidosCorrecao, situacaoDasIgrejas } from '../dados/igrejas'
import { listarEmprestimos } from '../dados/patrimonio'
import { listarPedidos } from '../dados/pedidos'
import type { Perfil } from '../dados/perfis'
import { trocasPendentes } from '../dados/portal'
import { hojeIso } from '../utilitarios/formatos'

export type Pendencias = Partial<Record<ChavePendencia, number>>

async function quantos<T>(busca: () => Promise<Resultado<T[]>>, conta: (lista: T[]) => number = (l) => l.length): Promise<number | null> {
  try {
    const r = await busca()
    return r.erro === null ? conta(r.dados) : null
  } catch {
    return null
  }
}

const tem = (perfis: readonly Perfil[], ...quais: Perfil[]) => quais.some((p) => perfis.includes(p))

/** Quem decide cada pendência (para os outros, a função aparece sem número). */
const CONTAGENS: Record<ChavePendencia, { quem: readonly Perfil[]; contar: () => Promise<number | null> }> = {
  pedidosAssociacao: {
    quem: ['secretaria', 'presidencia'],
    contar: () => quantos(listarPedidos, (l) => l.filter((p) => p.situacao === 'enviado').length),
  },
  correcoes: {
    quem: ['secretaria', 'presidencia'],
    contar: async () => {
      const [correcoes, trocas] = await Promise.all([quantos(() => listarPedidosCorrecao({ pendentes: true })), quantos(trocasPendentes)])
      return correcoes === null && trocas === null ? null : (correcoes ?? 0) + (trocas ?? 0)
    },
  },
  comprovantes: { quem: ['tesouraria', 'presidencia'], contar: () => quantos(informesPendentes) },
  despesas: { quem: ['presidencia'], contar: () => quantos(despesasAguardando) },
  emprestimos: {
    quem: ['secretaria', 'presidencia'],
    contar: () => quantos(listarEmprestimos, (l) => l.filter((e) => e.situacao === 'solicitado').length),
  },
  justificativas: {
    quem: ['secretaria', 'presidencia'],
    contar: () => quantos(listarJustificativas, (l) => l.filter((j) => j.situacao === 'pendente').length),
  },
  // Igrejas (Fase 5.5): a igreja nova e os documentos para conferir; as suspensas, na Central de regularização
  igrejasConferir: {
    quem: ['secretaria', 'presidencia'],
    contar: async () => {
      const [novas, docs] = await Promise.all([
        quantos(igrejasEmAnalise),
        quantos(documentosParaConferir, (l) => l.filter((d) => d.igreja?.cadastro !== 'em_analise').length),
      ])
      return novas === null && docs === null ? null : (novas ?? 0) + (docs ?? 0)
    },
  },
  igrejasSuspensas: {
    quem: ['secretaria', 'presidencia'],
    contar: () => quantos(situacaoDasIgrejas, (l) => l.filter((s) => s.situacao.situacao === 'suspensa').length),
  },
  // Conselho Fiscal (Fase 5.5, parte 10): os meses do exercício que esperam o Conselho; as perguntas que esperam a tesouraria
  mesesParaAnalisar: {
    quem: ['conselho_fiscal'],
    contar: () =>
      quantos(
        () => mesesDoConselho(exercicioDe(hojeIso())),
        (l) => l.filter((m) => m.situacao === 'para_analisar' || m.situacao === 'mudou').length,
      ),
  },
  esclarecimentos: {
    quem: ['tesouraria', 'presidencia'],
    contar: () => quantos(() => listarEsclarecimentos(), (l) => l.filter((e) => !e.respondido_em).length),
  },
}

/**
 * As contagens das funções do módulo aberto. `recarga` (o endereço) busca de novo a cada troca de tela,
 * para o número baixar logo depois que a pessoa resolve uma pendência.
 */
export function usePendencias(modulo: Modulo | null, perfis: readonly Perfil[], recarga: string): Pendencias {
  const [pendencias, setPendencias] = useState<{ modulo: string; valores: Pendencias }>({ modulo: '', valores: {} })
  const chaves = (modulo?.funcoes ?? [])
    .map((f) => f.pendencia)
    .filter((c): c is ChavePendencia => c !== undefined && tem(perfis, ...CONTAGENS[c].quem))
  const assinatura = chaves.join(',')
  const nomeModulo = modulo?.chave ?? ''

  useEffect(() => {
    if (!assinatura) return
    let ativo = true
    const lista = assinatura.split(',') as ChavePendencia[]
    void Promise.all(lista.map((c) => CONTAGENS[c].contar())).then((numeros) => {
      if (!ativo) return
      const valores: Pendencias = {}
      lista.forEach((c, i) => {
        const n = numeros[i]
        if (n !== null && n !== undefined) valores[c] = n
      })
      setPendencias({ modulo: nomeModulo, valores })
    })
    return () => {
      ativo = false
    }
  }, [assinatura, nomeModulo, recarga])

  // ao trocar de módulo, os números do anterior não valem
  return pendencias.modulo === nomeModulo ? pendencias.valores : {}
}
