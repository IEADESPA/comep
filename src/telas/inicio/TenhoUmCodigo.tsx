import { useEffect, useRef, useState } from 'react'
import { Mensagem } from '../../componentes/Basicos'
import { Icone, Ladrilho } from '../../componentes/Icone'
import {
  CODIGO_INVALIDO,
  conferirCodigoDoCadastro,
  ligarContaAoCadastro,
  type ConferenciaDoCodigo,
  type LigacaoDoCodigo,
} from '../../dados/codigos'
import {
  codigoParaMostrar,
  emailMascarado,
  fraseDoPedido,
  linhasDaConta,
  linhasDoCadastro,
  textoDoPronto,
} from '../../utilitarios/codigoLogin'
import { iniciaisDe, numeroDoRegistro } from '../../utilitarios/formatos'

// "Tenho um código" (S5-04; decisão do presidente de 25/11/2026; a tela `codigo-login` da rodada 37): quem criou a
// conta pelo site e já é associado liga a conta ao cadastro que a secretaria fez.
//   1. no Início, o cartão aprovado ("Já é associado do COMEP?", o botão Tenho um código) abre o campo do código;
//   2. "É você?": a conta de agora e o cadastro da secretaria, lado a lado, e o que acontece ao ligar;
//   3. "Pronto": a faixa verde no Início, já como ministro (depois do termo, que a pessoa aceita de novo).

export type CodigoConferido = { codigo: string; conferencia: Extract<ConferenciaDoCodigo, { valido: true }> }

/** 1. O cartão do Início: fechado, como foi aprovado; aberto, o campo do código. */
export function CartaoCodigo({
  aberto,
  codigoInicial,
  aoAbrir,
  aoConferir,
}: {
  aberto: boolean
  codigoInicial: string
  aoAbrir: () => void
  aoConferir: (conferido: CodigoConferido) => void
}) {
  if (!aberto) {
    return (
      <section className="bloco" aria-labelledby="titulo-ja-associado">
        <h2 id="titulo-ja-associado" style={{ fontSize: 16 }}>
          Já é associado do COMEP?
        </h2>
        <p className="texto-bloco">Peça à secretaria o código de primeiro acesso e ligue esta conta ao seu cadastro.</p>
        <button type="button" className="codigo-botao-abrir" onClick={aoAbrir}>
          <Icone nome="chave" tamanho={18} />
          Tenho um código
        </button>
      </section>
    )
  }
  return <CampoDoCodigo codigoInicial={codigoInicial} aoConferir={aoConferir} />
}

function CampoDoCodigo({
  codigoInicial,
  aoConferir,
}: {
  codigoInicial: string
  aoConferir: (conferido: CodigoConferido) => void
}) {
  const [codigo, setCodigo] = useState(codigoInicial)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  // o cartão acabou de abrir: o cursor já vai para o campo
  useEffect(() => {
    campo.current?.focus()
  }, [])

  async function conferir() {
    const digitado = codigo.trim()
    setErro(null)
    if (!digitado) {
      setErro('Digite o código que a secretaria mandou.')
      return
    }
    setEnviando(true)
    const r = await conferirCodigoDoCadastro(digitado)
    setEnviando(false)
    if (r.erro !== null) {
      setErro(r.erro)
      return
    }
    if (!r.dados.valido) {
      setErro(CODIGO_INVALIDO)
      return
    }
    aoConferir({ codigo: digitado, conferencia: r.dados })
  }

  return (
    <section className="bloco codigo-cartao" aria-labelledby="titulo-tenho-codigo">
      <div className="codigo-cartao-topo">
        <Ladrilho area="pessoas" icone="chave" tamanho={40} />
        <h2 id="titulo-tenho-codigo">Tenho um código</h2>
      </div>
      <p className="texto-bloco">
        Já é associado do COMEP? Digite o código que a secretaria mandou pelo WhatsApp: a sua conta passa a entrar no seu
        cadastro.
      </p>
      <form
        className="codigo-form"
        onSubmit={(e) => {
          e.preventDefault()
          void conferir()
        }}
      >
        <label className="codigo-campo">
          Código da secretaria
          <input
            ref={campo}
            className="codigo-entrada"
            name="codigo"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            maxLength={24}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <Mensagem erro={erro} />
        <button type="submit" className="botao codigo-botao-principal" disabled={enviando}>
          {enviando ? 'Conferindo…' : 'Conferir o código'}
        </button>
      </form>
      <p className="codigo-nota">
        O código vale 7 dias. Se a secretaria gerar outro, este deixa de valer. Errou 5 vezes, espere 15 minutos.
      </p>
    </section>
  )
}

function CartaoPessoa({
  rotulo,
  nome,
  linhas,
  destaque = false,
  className = '',
}: {
  rotulo: string
  nome: string
  linhas: readonly string[]
  destaque?: boolean
  className?: string
}) {
  return (
    <div className={`codigo-pessoa${destaque ? ' codigo-pessoa-destaque' : ''} ${className}`.trim()}>
      <p className="rotulo">{rotulo}</p>
      <div className="codigo-pessoa-nome">
        <span className="codigo-pessoa-iniciais" aria-hidden="true">
          {iniciaisDe(nome)}
        </span>
        <strong>{nome}</strong>
      </div>
      {linhas.map((l) => (
        <span key={l} className="codigo-pessoa-linha">
          {l}
        </span>
      ))}
    </div>
  )
}

/** 2. "É você?": antes de ligar, a conta de agora e o cadastro da secretaria, e o que acontece. */
export function EVoce({
  conferido,
  email,
  aoVoltar,
  aoNaoSouEu,
  aoLigar,
}: {
  conferido: CodigoConferido
  email: string
  aoVoltar: () => void
  aoNaoSouEu: () => void
  aoLigar: (ligacao: Extract<LigacaoDoCodigo, { valido: true }>) => void
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const { codigo, conferencia } = conferido
  const { conta, cadastro } = conferencia
  const mostrado = codigoParaMostrar(codigo)
  const noCadastro = cadastro.numero !== null ? `no cadastro nº ${numeroDoRegistro(cadastro.numero)}` : 'no cadastro da secretaria'

  async function ligar() {
    setErro(null)
    setEnviando(true)
    const r = await ligarContaAoCadastro(codigo)
    if (r.erro !== null) {
      setEnviando(false)
      setErro(r.erro)
      return
    }
    if (!r.dados.valido) {
      setEnviando(false)
      setErro(CODIGO_INVALIDO)
      return
    }
    // a conta muda de cadastro: a tela espera o Início novo (o botão continua em "Ligando…")
    aoLigar(r.dados)
  }

  return (
    <div className="codigo-evoce">
      <div className="codigo-evoce-cabeca so-computador">
        <p className="rotulo">Tenho um código · {mostrado}</p>
        <h1>Este código é do cadastro abaixo. É você?</h1>
        <p className="sub-tela">Confira o nome e a igreja antes de ligar.</p>
      </div>
      <div className="codigo-evoce-cabeca so-celular">
        <div className="titulo-com-voltar">
          <button type="button" className="voltar-celular codigo-voltar" aria-label="Voltar ao código" onClick={aoVoltar}>
            <Icone nome="voltar" tamanho={24} traco={2.4} />
          </button>
          <h1>É você?</h1>
        </div>
        <p className="codigo-evoce-frase">
          O código <strong>{mostrado}</strong> é deste cadastro. A sua conta ({conta.nome}, {emailMascarado(email)}) passa a
          entrar nele.
        </p>
      </div>

      <div className="codigo-lado-a-lado">
        <CartaoPessoa className="so-computador" rotulo="A sua conta" nome={conta.nome} linhas={linhasDaConta(email, conta)} />
        <span className="codigo-seta so-computador" aria-hidden="true">
          <Icone nome="seta" tamanho={20} traco={2.4} />
        </span>
        <CartaoPessoa destaque rotulo="O cadastro na secretaria" nome={cadastro.nome} linhas={linhasDoCadastro(cadastro)} />
      </div>

      <section className="bloco" aria-labelledby="titulo-ao-ligar">
        <h2 id="titulo-ao-ligar" className="codigo-h2">
          O que acontece ao ligar
        </h2>
        <ol className="codigo-passos">
          <li>
            <span className="codigo-passo-numero" aria-hidden="true">
              1
            </span>
            <span>
              Você continua entrando com <strong>o mesmo e-mail e a mesma senha</strong>, agora {noCadastro}.
            </span>
          </li>
          <li>
            <span className="codigo-passo-numero" aria-hidden="true">
              2
            </span>
            <span>
              {conta.pedido ? (
                <>
                  O cadastro vazio que nasceu com a sua conta e o pedido de associação {fraseDoPedido(conta.pedido)} são{' '}
                  <strong>arquivados</strong>. Nada se apaga.
                </>
              ) : (
                <>
                  O cadastro vazio que nasceu com a sua conta é <strong>arquivado</strong>. Nada se apaga.
                </>
              )}
            </span>
          </li>
          <li>
            <span className="codigo-passo-numero" aria-hidden="true">
              3
            </span>
            <span>A secretaria recebe um aviso, e a ligação fica no registro.</span>
          </li>
        </ol>
      </section>

      <Mensagem erro={erro} />
      <div className="codigo-acoes">
        <button type="button" className="botao codigo-botao-principal" onClick={() => void ligar()} disabled={enviando}>
          {enviando ? 'Ligando…' : 'Sim, sou eu: ligar a conta'}
        </button>
        <button type="button" className="codigo-botao-linha" onClick={aoNaoSouEu} disabled={enviando}>
          Não sou eu
        </button>
        <span className="codigo-nota so-computador">Se não for você, nada muda: avise a secretaria.</span>
      </div>
    </div>
  )
}

export type Ligado = { anterior: string; numero: number | null; pedido: boolean }

/** 3. "Pronto": a faixa verde no Início, logo depois de ligar. */
export function FaixaPronto({ ligado, ministro }: { ligado: Ligado; ministro: boolean }) {
  return (
    <div className="codigo-pronto" role="status">
      <span className="codigo-pronto-marca" aria-hidden="true">
        <Icone nome="check" tamanho={17} traco={3} />
      </span>
      <span className="codigo-pronto-texto">
        <strong>Pronto! A sua conta está ligada ao seu cadastro.</strong>
        <span>{textoDoPronto(ligado, ministro)}</span>
      </span>
    </div>
  )
}
