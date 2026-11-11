import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { aoMudarSessao, sair as sairDoSistema, sessaoAtual, type Sessao } from '../dados/autenticacao'
import { buscarMinhaConta, type ResultadoConta } from '../dados/perfis'
import { ContextoSessao, type EstadoSessao, type ValorSessao } from './contexto'

export function ProvedorSessao({ children }: { children: ReactNode }) {
  // undefined = ainda verificando se há alguém logado neste aparelho
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined)
  const [conta, setConta] = useState<{ usuarioId: string; resultado: ResultadoConta } | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    sessaoAtual().then((s) => {
      if (ativo) setSessao(s)
    })
    const pararDeEscutar = aoMudarSessao((s) => setSessao(s))
    return () => {
      ativo = false
      pararDeEscutar()
    }
  }, [])

  const usuarioId = sessao?.usuarioId
  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    buscarMinhaConta(usuarioId).then((resultado) => {
      if (ativo) setConta({ usuarioId, resultado })
    })
    return () => {
      ativo = false
    }
  }, [usuarioId, versao])

  const recarregarConta = useCallback(() => {
    setConta(null)
    setVersao((v) => v + 1)
  }, [])

  const sair = useCallback(async () => {
    await sairDoSistema()
    setConta(null)
  }, [])

  const valor = useMemo<ValorSessao>(() => {
    let estado: EstadoSessao
    if (sessao === undefined) estado = { situacao: 'carregando' }
    else if (sessao === null) estado = { situacao: 'deslogado' }
    else {
      // Só usa a conta se for de quem está logado agora (evita mostrar dados de outra pessoa ao trocar de login)
      const resultado = conta && conta.usuarioId === sessao.usuarioId ? conta.resultado : null
      estado = { situacao: 'logado', sessao, conta: resultado }
    }
    return { estado, sair, recarregarConta }
  }, [sessao, conta, sair, recarregarConta])

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}
