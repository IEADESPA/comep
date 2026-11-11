import { useCallback, useEffect, useState } from 'react'
import type { Resultado } from '../dados/cliente'

export type Carga<T> = { situacao: 'carregando' } | { situacao: 'erro'; erro: string } | { situacao: 'ok'; dados: T }

/**
 * Busca dados ao abrir a tela. `recarregar()` busca de novo mantendo os dados atuais na tela
 * até chegar a resposta (sem piscar "Carregando…" depois de cada ação).
 */
export function useCarregar<T>(buscar: () => Promise<Resultado<T>>): [Carga<T>, () => void] {
  const [carga, setCarga] = useState<Carga<T>>({ situacao: 'carregando' })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true
    buscar().then((r) => {
      if (!ativo) return
      setCarga(r.erro === null ? { situacao: 'ok', dados: r.dados } : { situacao: 'erro', erro: r.erro })
    })
    return () => {
      ativo = false
    }
    // `buscar` é recriada a cada render; a busca só se repete quando `versao` muda.
    // Telas com parâmetro na rota (ex.: :id) são remontadas com key={id}.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return [carga, recarregar]
}
