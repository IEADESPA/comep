import { createContext, useContext } from 'react'
import type { Sessao } from '../dados/autenticacao'
import type { ResultadoConta } from '../dados/perfis'

export type EstadoSessao =
  | { situacao: 'carregando' }
  | { situacao: 'deslogado' }
  // conta = null enquanto o cadastro e os perfis ainda estão sendo buscados
  | { situacao: 'logado'; sessao: Sessao; conta: ResultadoConta | null }

export type ValorSessao = {
  estado: EstadoSessao
  sair: () => Promise<void>
  recarregarConta: () => void
}

export const ContextoSessao = createContext<ValorSessao | null>(null)

export function useSessao(): ValorSessao {
  const valor = useContext(ContextoSessao)
  if (!valor) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>.')
  return valor
}
