import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Simbolo } from '../../componentes/Icone'

// Moldura das telas de acesso (aprovada: Opção 3, "Vermelho forte" — docs/telas-novas.md).
// Notebook: metade esquerda no vermelho do COMEP, com o símbolo grande; o formulário fica à direita.
// Celular: o vermelho no alto e o formulário numa folha branca que sobe.

const NOME_DO_CONSELHO = 'Conselho de Ministros Evangélicos de Parauapebas'

export function TelaAcesso({
  compacto = false,
  rodapeCelular,
  children,
}: {
  /** primeiro acesso e esqueci a senha: o alto do celular é mais baixo (o formulário é maior) */
  compacto?: boolean
  /** o link de baixo, só no celular (no notebook ele fica no painel vermelho) */
  rodapeCelular?: { para: string; texto: string }
  children: ReactNode
}) {
  return (
    <main className={compacto ? 'acesso acesso-compacto' : 'acesso'}>
      <div className="acesso-painel">
        <span className="nome-comep">COMEP</span>
        <div className="acesso-painel-centro">
          <Simbolo tamanho={120} />
          <p className="acesso-painel-titulo">{NOME_DO_CONSELHO}</p>
          <p className="acesso-painel-frase">Comunhão entre os pastores e serviço à cidade.</p>
        </div>
        <Link to="/">← Voltar para o site</Link>
      </div>

      <div className="acesso-marca">
        <Simbolo tamanho={compacto ? 56 : 72} />
        <div>
          <span className="nome-comep">COMEP</span>
          <p>{NOME_DO_CONSELHO}</p>
        </div>
      </div>

      <div className="acesso-folha">
        <div className="acesso-form">{children}</div>
        {rodapeCelular && (
          <p className="acesso-voltar so-celular">
            <Link to={rodapeCelular.para}>{rodapeCelular.texto}</Link>
          </p>
        )}
      </div>
    </main>
  )
}

/** Campo das telas de acesso: rótulo em cima (com um link ao lado, se houver) e a explicação embaixo. */
export function CampoAcesso({
  rotulo,
  aoLado,
  detalhe,
  ...campo
}: { rotulo: string; aoLado?: ReactNode; detalhe?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="campo-acesso">
      <div className="campo-rotulo">
        <label htmlFor={id}>{rotulo}</label>
        {aoLado}
      </div>
      <input id={id} aria-describedby={detalhe ? `${id}-detalhe` : undefined} {...campo} />
      {detalhe && (
        <span className="detalhe" id={`${id}-detalhe`}>
          {detalhe}
        </span>
      )}
    </div>
  )
}
