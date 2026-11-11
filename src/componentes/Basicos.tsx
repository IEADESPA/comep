import type { ReactNode } from 'react'
import type { Carga } from '../estado/useCarregar'

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

/** Mostra "Carregando…", o erro (com "Tentar de novo") ou o conteúdo. */
export function MostrarCarga<T>({
  carga,
  recarregar,
  children,
}: {
  carga: Carga<T>
  recarregar: () => void
  children: (dados: T) => ReactNode
}) {
  if (carga.situacao === 'carregando') return <Carregando />
  if (carga.situacao === 'erro') {
    return (
      <div className="erro-carga" role="alert">
        <p>{carga.erro}</p>
        <button type="button" className="botao botao-secundario" onClick={recarregar}>
          Tentar de novo
        </button>
      </div>
    )
  }
  return children(carga.dados)
}

/** Mensagem de resultado de uma ação: sucesso (status) ou erro (alert). */
export function Mensagem({ sucesso, erro }: { sucesso?: string | null; erro?: string | null }) {
  if (erro) {
    return (
      <p className="erro" role="alert">
        {erro}
      </p>
    )
  }
  if (sucesso) {
    return (
      <p className="sucesso" role="status">
        {sucesso}
      </p>
    )
  }
  return null
}

/** Botão de ação que pede confirmação na própria tela (sem janelas do navegador). */
export function BotaoConfirmar({
  texto,
  confirmar,
  aviso,
  aoConfirmar,
  desabilitado,
}: {
  texto: string
  confirmar: string
  aviso: string
  aoConfirmar: () => void
  desabilitado?: boolean
}) {
  return (
    <details className="confirmar">
      <summary className="botao botao-perigo">{texto}</summary>
      <div className="confirmar-caixa">
        <p>{aviso}</p>
        <button type="button" className="botao botao-perigo-cheio" onClick={aoConfirmar} disabled={desabilitado}>
          {confirmar}
        </button>
      </div>
    </details>
  )
}
