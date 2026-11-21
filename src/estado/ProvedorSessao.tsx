import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { aoMudarSessao, DIAS_CONECTADO, entrouEm, sair as sairDoSistema, sessaoAtual, type Sessao } from '../dados/autenticacao'
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

  // A pessoa fica conectada no aparelho por 30 dias (parte 13; sem "confiar neste aparelho"): depois, entra de novo
  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    void entrouEm().then(async (quando) => {
      if (!ativo || !quando) return
      if (Date.now() - quando.getTime() > DIAS_CONECTADO * 86_400_000) {
        try {
          sessionStorage.setItem('comep:sessao-venceu', '1')
        } catch {
          // sem armazenamento: só não mostra o aviso na tela de entrar
        }
        await sairDoSistema()
        setConta(null)
      }
    })
    return () => {
      ativo = false
    }
  }, [usuarioId])

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

  // Busca o cadastro de novo SEM apagar o atual: a tela continua aberta até chegar a resposta
  // (senão a tela inteira voltaria a "Carregando…" e perderia, por exemplo, a mensagem de "salvo").
  const recarregarConta = useCallback(() => {
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
