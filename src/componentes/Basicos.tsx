import type { ReactNode } from 'react'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="girador" aria-hidden="true" />
      {texto}
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
