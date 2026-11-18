import { useEffect, useState } from 'react'

// Modo claro e escuro (telas novas, Fase 5.5). Sem escolha, segue o do aparelho; a escolha feita no botão
// do topo fica guardada NO APARELHO (não no cadastro) e vira o atributo data-tema no <html>.
// O index.html aplica a escolha guardada antes de a tela aparecer (sem piscar no modo errado).

export type Tema = 'claro' | 'escuro'

const CHAVE = 'comep-tema'

function temaGuardado(): Tema | null {
  try {
    const t = localStorage.getItem(CHAVE)
    return t === 'claro' || t === 'escuro' ? t : null
  } catch {
    return null
  }
}

const consulta = () => window.matchMedia?.('(prefers-color-scheme: dark)')

function temaDoAparelho(): Tema {
  return consulta()?.matches ? 'escuro' : 'claro'
}

/** O tema em uso e a troca (claro ↔ escuro), guardada no aparelho. */
export function useTema(): [Tema, () => void] {
  const [guardado, setGuardado] = useState(temaGuardado)
  const [aparelho, setAparelho] = useState(temaDoAparelho)

  useEffect(() => {
    const mq = consulta()
    if (!mq) return
    const mudou = () => setAparelho(mq.matches ? 'escuro' : 'claro')
    mq.addEventListener('change', mudou)
    return () => mq.removeEventListener('change', mudou)
  }, [])

  const atual = guardado ?? aparelho

  function alternar() {
    const novo: Tema = atual === 'escuro' ? 'claro' : 'escuro'
    try {
      localStorage.setItem(CHAVE, novo)
    } catch {
      // sem armazenamento (navegação privada): vale só até fechar a página
    }
    document.documentElement.dataset.tema = novo
    setGuardado(novo)
  }

  return [atual, alternar]
}
