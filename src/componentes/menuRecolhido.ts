import { useCallback, useState } from 'react'

// O menu recolhido (rodada 18, menu-recolhido opção 1 "o trilho de ícones"; entrou na parte 14): no computador,
// dentro de um módulo, "Recolher o menu" deixa só os ícones numa coluna fina, e » abre de novo. A escolha fica
// guardada no aparelho, separada por pessoa (quem divide o computador não herda a escolha do outro).
// Sem armazenamento (janela anônima, dados bloqueados), vale só enquanto a tela está aberta. No celular nada muda.

const chave = (pessoaId: string) => `comep-menu-recolhido:${pessoaId}`

function escolhaGuardada(pessoaId: string | null): boolean {
  if (!pessoaId) return false
  try {
    return localStorage.getItem(chave(pessoaId)) === 'sim'
  } catch {
    return false
  }
}

/** [recolhido, mudar]: a escolha da pessoa que está usando. */
export function useMenuRecolhido(pessoaId: string | null): [boolean, (recolher: boolean) => void] {
  const [escolha, setEscolha] = useState(() => ({ pessoa: pessoaId, recolhido: escolhaGuardada(pessoaId) }))
  // entrou outra pessoa no mesmo aparelho: vale a escolha dela
  const recolhido = escolha.pessoa === pessoaId ? escolha.recolhido : escolhaGuardada(pessoaId)
  const mudar = useCallback(
    (recolher: boolean) => {
      setEscolha({ pessoa: pessoaId, recolhido: recolher })
      if (!pessoaId) return
      try {
        if (recolher) localStorage.setItem(chave(pessoaId), 'sim')
        else localStorage.removeItem(chave(pessoaId))
      } catch {
        // sem armazenamento: a escolha vale só nesta visita
      }
    },
    [pessoaId],
  )
  return [recolhido, mudar]
}
