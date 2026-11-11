import type { ReactNode } from 'react'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="girador" aria-hidden="true" />
      {texto}
    </div>
  )
}

/** Faixa no topo de todas as telas quando o app está ligado ao banco de teste. */
export function FaixaAmbiente() {
  if (import.meta.env.VITE_AMBIENTE !== 'teste') return null
  return (
    <div className="faixa-teste" role="note">
      Versão de teste: não cadastre dados reais.
    </div>
  )
}

export function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="aviso" role="note">
      <h2>{titulo}</h2>
      <div>{children}</div>
    </section>
  )
}
