import { useCallback, useEffect, useState } from 'react'
import type { MinhaConta } from '../dados/perfis'
import { avisosDoSino, type AvisoDoSino } from '../estado/resumos'

// Os avisos do sino (src/estado/resumos.ts) e o que já foi lido, guardado NO APARELHO, por pessoa.

const MAXIMO_GUARDADO = 300

function chaveDosLidos(pessoaId: string) {
  return `comep-avisos-lidos:${pessoaId}`
}

function lerLidos(pessoaId: string | null): string[] {
  if (!pessoaId) return []
  try {
    const lista: unknown = JSON.parse(localStorage.getItem(chaveDosLidos(pessoaId)) ?? '[]')
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function guardarLidos(pessoaId: string, lidos: string[]) {
  try {
    localStorage.setItem(chaveDosLidos(pessoaId), JSON.stringify(lidos.slice(-MAXIMO_GUARDADO)))
  } catch {
    // sem armazenamento: o "lido" vale só até fechar a página
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
  const perfis = conta?.perfis.join(',') ?? ''
  const [itens, setItens] = useState<AvisoDoSino[]>([])
  const [carregado, setCarregado] = useState(false)
  const [lidos, setLidos] = useState<string[]>(() => lerLidos(pessoaId))
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!conta) return
    let ativo = true
    void avisosDoSino(conta).then((novos) => {
      if (!ativo) return
      setItens(novos)
      setCarregado(true)
    })
    return () => {
      ativo = false
    }
    // a conta só muda quando muda a pessoa ou os perfis
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoaId, perfis, versao])

  const marcar = useCallback(
    (chaves: string[]) => {
      if (!pessoaId) return
      setLidos((atuais) => {
        const novos = [...atuais.filter((c) => !chaves.includes(c)), ...chaves]
        guardarLidos(pessoaId, novos)
        return novos
      })
    },
    [pessoaId],
  )

  const conjunto = new Set(lidos)
  return {
    itens,
    carregado,
    lidos: conjunto,
    naoLidos: itens.filter((i) => !conjunto.has(i.chave)).length,
    marcarLido: (chave) => marcar([chave]),
    marcarTodos: () => marcar(itens.map((i) => i.chave)),
    recarregar: () => setVersao((v) => v + 1),
  }
}
