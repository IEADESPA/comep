import { useCallback, useEffect, useState } from 'react'
import { marcarNotificacoesLidas, minhasNotificacoes, type Notificacao, type TipoAviso } from '../dados/notificacoes'
import type { MinhaConta } from '../dados/perfis'
import type { Area, NomeIcone } from './Icone'

// O sino (telas novas, Fase 5.5): desde a parte 11, os avisos vêm da tabela de notificações do banco, e o "lido"
// fica guardado por pessoa (vale em todos os aparelhos). Os avisos são criados quando as coisas acontecem
// (assembleia convocada, votação aberta, aviso no mural…): supabase/migrations/20261120230000_notificacoes.sql.

export type AvisoDoSino = {
  chave: string
  area: Area
  icone: NomeIcone
  titulo: string
  texto: string
  quando: string
  /** o endereço que o aviso abre (sem endereço: só marca como lido) */
  para: string | null
  urgente: boolean
  /** quem mandou (o recado da secretaria) */
  de: string | null
}

const ASPECTO: Record<TipoAviso, { area: Area; icone: NomeIcone }> = {
  assembleias: { area: 'assembleias', icone: 'assembleia' },
  votacoes: { area: 'assembleias', icone: 'votar' },
  mural: { area: 'eventos', icone: 'aviso' },
  mensalidade: { area: 'financas', icone: 'mensalidade' },
  documentos: { area: 'eventos', icone: 'relogio' },
  pedido: { area: 'pessoas', icone: 'alerta' },
  recado: { area: 'pessoas', icone: 'aviso' },
}

export function avisoDoSino(n: Notificacao): AvisoDoSino {
  const aspecto = ASPECTO[n.tipo] ?? ASPECTO.recado
  return {
    chave: n.id,
    area: n.urgente ? 'pessoas' : aspecto.area,
    icone: n.urgente ? 'alerta' : n.link?.startsWith('/assembleias/pedidos') ? 'pedido' : aspecto.icone,
    titulo: n.titulo,
    texto: n.texto,
    quando: n.quando,
    para: n.link,
    urgente: n.urgente,
    de: n.enviada_por,
  }
}

export type Sino = {
  itens: AvisoDoSino[]
  carregado: boolean
  lidos: ReadonlySet<string>
  naoLidos: number
  marcarLido: (chave: string) => void
  marcarTodos: () => void
  recarregar: () => void
}

export function useSino(conta: MinhaConta | null): Sino {
  const pessoaId = conta?.pessoaId ?? null
  const [itens, setItens] = useState<AvisoDoSino[]>([])
  const [lidos, setLidos] = useState<ReadonlySet<string>>(new Set())
  const [naoLidosNoBanco, setNaoLidosNoBanco] = useState(0)
  const [carregado, setCarregado] = useState(false)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!pessoaId) return
    let ativo = true
    void minhasNotificacoes(30).then((r) => {
      if (!ativo) return
      if (r.erro === null) {
        setItens(r.dados.itens.map(avisoDoSino))
        setLidos(new Set(r.dados.itens.filter((n) => n.lida_em !== null).map((n) => n.id)))
        setNaoLidosNoBanco(r.dados.nao_lidas)
      }
      setCarregado(true)
    })
    return () => {
      ativo = false
    }
  }, [pessoaId, versao])

  // quem fica com o sistema aberto vê os avisos novos sem recarregar a página (a cada 5 minutos, e ao voltar para a aba)
  useEffect(() => {
    if (!pessoaId) return
    const atualizar = () => {
      if (document.visibilityState === 'visible') setVersao((v) => v + 1)
    }
    const relogio = window.setInterval(atualizar, 5 * 60_000)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(relogio)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [pessoaId])

  const marcar = useCallback(
    (chaves: string[] | null) => {
      if (!pessoaId) return
      const alvo = chaves ?? itens.map((i) => i.chave)
      const novos = alvo.filter((c) => !lidos.has(c))
      if (novos.length === 0 && chaves !== null) return
      setLidos((atuais) => new Set([...atuais, ...alvo]))
      setNaoLidosNoBanco((n) => (chaves === null ? 0 : Math.max(0, n - novos.length)))
      void marcarNotificacoesLidas(chaves)
    },
    [pessoaId, itens, lidos],
  )

  // os não lidos da lista mais os que ficaram de fora dela (a lista mostra os 30 mais novos)
  const naoLidosNaLista = itens.filter((i) => !lidos.has(i.chave)).length
  return {
    itens,
    carregado,
    lidos,
    naoLidos: Math.max(naoLidosNaLista, naoLidosNoBanco),
    marcarLido: (chave) => marcar([chave]),
    marcarTodos: () => marcar(null),
    recarregar: () => setVersao((v) => v + 1),
  }
}
