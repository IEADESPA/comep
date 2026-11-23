import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Pendencias } from '../estado/pendencias'
import { Icone } from './Icone'
import type { Funcao, Localizacao } from './menu'

// O menu do módulo (padrão aprovado em 18/11/2026, "o módulo toma a coluna"; docs/telas-novas.md).
// Notebook: a coluna vermelha da esquerda vira o menu do módulo: "← Início", o bloco com o ícone, o nome e
// "N funções", as funções grandes (com o número quando há pendência) e as subfunções da função aberta.
// Celular: logo abaixo do cabeçalho vermelho, um botão de largura inteira com a função aberta, que abre a lista.
// Recolhido (menu-recolhido opção 1, parte 14): só os ícones, numa coluna fina; passando o mouse (ou com o foco
// do teclado), aparece o nome da função.

export type PropsMenuDoModulo = {
  local: Localizacao
  funcoes: readonly Funcao[]
  pendencias: Pendencias
}

const totalDeFuncoes = (n: number) => (n === 1 ? '1 função' : `${n} funções`)

function Contagem({ n }: { n: number | undefined }) {
  if (!n) return null
  return (
    <span className="contagem-funcao">
      <span aria-hidden="true">{n > 99 ? '99+' : n}</span>
      <span className="somente-leitor">, {n === 1 ? '1 pendente' : `${n} pendentes`}</span>
    </span>
  )
}

/** Notebook: o miolo da coluna vermelha quando um módulo está aberto. */
export function MenuDoModulo({ local, funcoes, pendencias, trilho = false }: PropsMenuDoModulo & { trilho?: boolean }) {
  const { modulo, funcao: aberta, subfuncao } = local
  if (trilho) {
    return (
      <>
        <Link to="/painel" className="lateral-voltar lateral-dica" data-dica="Início">
          <Icone nome="voltar" tamanho={20} />
          <span className="somente-leitor">Início</span>
        </Link>
        <hr className="lateral-divisa" />
        <ul className="lateral-funcoes" aria-label="Funções do módulo">
          {funcoes.map((f) => {
            const ativa = f.chave === aberta?.chave
            return (
              <li key={f.chave}>
                <Link
                  to={f.caminho}
                  className={ativa ? 'lateral-funcao ativa lateral-dica' : 'lateral-funcao lateral-dica'}
                  data-dica={f.titulo}
                  aria-current={ativa && !subfuncao ? 'page' : undefined}
                >
                  <Icone nome={f.icone} tamanho={20} />
                  <span className="somente-leitor">{f.titulo}</span>
                  <Contagem n={f.pendencia ? pendencias[f.pendencia] : undefined} />
                </Link>
              </li>
            )
          })}
        </ul>
      </>
    )
  }
  return (
    <>
      <Link to="/painel" className="lateral-voltar">
        <Icone nome="voltar" tamanho={18} />
        Início
      </Link>
      <div className="lateral-modulo">
        <span className="lateral-modulo-icone" aria-hidden="true">
          <Icone nome={modulo.icone} tamanho={22} />
        </span>
        <span className="lateral-modulo-nome">
          <strong>{modulo.titulo}</strong>
          <span>{totalDeFuncoes(funcoes.length)}</span>
        </span>
      </div>
      <ul className="lateral-funcoes" aria-label="Funções do módulo">
        {funcoes.map((f) => {
          const ativa = f.chave === aberta?.chave
          const subs = f.subfuncoes ?? []
          return (
            <li key={f.chave}>
              <Link
                to={f.caminho}
                className={ativa ? 'lateral-funcao ativa' : 'lateral-funcao'}
                aria-current={ativa && subs.length === 0 ? 'page' : undefined}
              >
                <Icone nome={f.icone} tamanho={19} />
                <span className="lateral-funcao-nome">{f.titulo}</span>
                <Contagem n={f.pendencia ? pendencias[f.pendencia] : undefined} />
                {subs.length > 0 && <Icone nome={ativa ? 'cima' : 'baixo'} tamanho={16} />}
              </Link>
              {/* sanfona: só a função aberta mostra as subfunções */}
              {ativa && subs.length > 0 && (
                <ul className="lateral-subfuncoes" aria-label="Subfunções">
                  {subs.map((s) => (
                    <li key={s.caminho}>
                      <Link
                        to={s.caminho}
                        className={s === subfuncao ? 'lateral-subfuncao ativa' : 'lateral-subfuncao'}
                        aria-current={s === subfuncao ? 'page' : undefined}
                      >
                        {s.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Celular: o botão com a função aberta e "N funções"; tocando, abre a lista das funções e subfunções. */
export function SeletorDeFuncao({ local, funcoes, pendencias }: PropsMenuDoModulo) {
  const [aberto, setAberto] = useState(false)
  const idAtual = useId()
  const { modulo, funcao: aberta, subfuncao } = local
  const atual = aberta?.titulo ?? modulo.titulo
  const pendenteFora = funcoes.some((f) => f.chave !== aberta?.chave && f.pendencia && (pendencias[f.pendencia] ?? 0) > 0)
  return (
    <div className="seletor-funcao so-celular">
      <button
        type="button"
        className="seletor-funcao-botao"
        aria-label="Funções do módulo"
        aria-describedby={idAtual}
        aria-expanded={aberto}
        aria-controls="funcoes-do-modulo"
        onClick={() => setAberto((a) => !a)}
      >
        <Icone nome={aberta?.icone ?? modulo.icone} tamanho={20} />
        <span className="seletor-funcao-nome" id={idAtual}>
          {atual}
          {subfuncao && subfuncao.titulo !== atual && <span>{subfuncao.titulo}</span>}
        </span>
        <span className="seletor-funcao-total">
          {pendenteFora && <span className="ponto-pendencia" aria-hidden="true" />}
          {totalDeFuncoes(funcoes.length)}
        </span>
        <Icone nome={aberto ? 'cima' : 'baixo'} tamanho={18} />
      </button>
      {aberto && (
        <nav id="funcoes-do-modulo" className="seletor-funcao-lista" aria-label="Funções do módulo">
          <ul>
            {funcoes.map((f) => {
              const subs = f.subfuncoes ?? []
              return (
                <li key={f.chave}>
                  <Link
                    to={f.caminho}
                    className={f.chave === aberta?.chave ? 'seletor-item ativa' : 'seletor-item'}
                    aria-current={f.chave === aberta?.chave && subs.length === 0 ? 'page' : undefined}
                    onClick={() => setAberto(false)}
                  >
                    <Icone nome={f.icone} tamanho={19} />
                    <span className="seletor-item-nome">{f.titulo}</span>
                    <Contagem n={f.pendencia ? pendencias[f.pendencia] : undefined} />
                  </Link>
                  {subs.length > 0 && (
                    <ul className="seletor-subfuncoes" aria-label={`Subfunções de ${f.titulo}`}>
                      {subs.map((s) => (
                        <li key={s.caminho}>
                          <Link
                            to={s.caminho}
                            className={s === subfuncao ? 'seletor-subitem ativa' : 'seletor-subitem'}
                            aria-current={s === subfuncao ? 'page' : undefined}
                            onClick={() => setAberto(false)}
                          >
                            {s.titulo}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}

/** O alto da tela de uma função: o módulo em cima (pequeno, em vermelho) e o nome da função. */
export function CabecalhoFuncao({
  modulo,
  titulo,
  sub,
  acoes,
}: {
  modulo: string
  titulo: string
  sub?: ReactNode
  acoes?: ReactNode
}) {
  return (
    <div className="cabecalho-funcao">
      <div className="cabecalho-funcao-texto">
        <span className="cabecalho-funcao-modulo">{modulo}</span>
        <h1>{titulo}</h1>
        {sub && <p className="sub-tela">{sub}</p>}
      </div>
      {acoes && <div className="cabecalho-funcao-acoes">{acoes}</div>}
    </div>
  )
}
