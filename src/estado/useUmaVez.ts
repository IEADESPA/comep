import { useCallback, useRef, useState } from 'react'

/**
 * Evita o clique duplo nas ações que gravam (lançar, transferir, autorizar…):
 * enquanto uma ação está rodando, as outras chamadas são ignoradas.
 * Devolve [ocupado, executar]; use `ocupado` para desabilitar o botão.
 */
export function useUmaVez(): [boolean, <T>(acao: () => Promise<T>) => Promise<T | undefined>] {
  const travado = useRef(false)
  const [ocupado, setOcupado] = useState(false)
  const executar = useCallback(async <T>(acao: () => Promise<T>): Promise<T | undefined> => {
    if (travado.current) return undefined
    travado.current = true
    setOcupado(true)
    try {
      return await acao()
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }, [])
  return [ocupado, executar]
}
