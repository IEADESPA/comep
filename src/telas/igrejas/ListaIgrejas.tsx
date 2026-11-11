import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { arquivarDenominacao, criarDenominacao, listarDenominacoes, listarIgrejas } from '../../dados/cadastros'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto } from '../../utilitarios/formatos'

export function ListaIgrejas() {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarIgrejas)
  const [busca, setBusca] = useState('')

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Igrejas</h1>
        <Link to="/igrejas/nova" className="botao">
          Nova igreja
        </Link>
      </div>
      <Mensagem sucesso={mensagem} />

      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(igrejas) => {
          const filtradas = igrejas.filter(
            (i) =>
              contemTexto(i.nome, busca) ||
              contemTexto(i.denominacao?.nome, busca) ||
              contemTexto(i.denominacao?.sigla, busca) ||
              contemTexto(i.bairro, busca),
          )
          return (
            <>
              <label className="busca">
                Buscar igreja
                <input
                  type="search"
                  placeholder="Nome, denominação ou bairro"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              <p className="detalhe">
                {filtradas.length === igrejas.length
                  ? `${igrejas.length} igreja(s) cadastrada(s)`
                  : `${filtradas.length} de ${igrejas.length} igreja(s)`}
              </p>
              {filtradas.length === 0 ? (
                <p className="vazio">Nenhuma igreja encontrada.</p>
              ) : (
                <ul className="lista" aria-label="Igrejas">
                  {filtradas.map((i) => (
                    <li key={i.id}>
                      <Link to={`/igrejas/${i.id}`} className="lista-item">
                        <strong>{i.nome}</strong>
                        <span>
                          {[i.denominacao?.sigla || i.denominacao?.nome, i.bairro].filter(Boolean).join(' · ') ||
                            'Denominação não informada'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </MostrarCarga>

      <Denominacoes />
    </>
  )
}

function Denominacoes() {
  const [carga, recarregar] = useCarregar(listarDenominacoes)
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ sucesso?: string; erro?: string }>({})

  async function adicionar() {
    setEnviando(true)
    const r = await criarDenominacao(nome, sigla)
    setEnviando(false)
    if (r.erro !== null) {
      setResultado({ erro: r.erro })
      return
    }
    setResultado({ sucesso: `Denominação "${r.dados.nome}" cadastrada.` })
    setNome('')
    setSigla('')
    recarregar()
  }

  async function arquivar(id: string, nomeDenominacao: string) {
    const r = await arquivarDenominacao(id)
    setResultado(r.erro ? { erro: r.erro } : { sucesso: `Denominação "${nomeDenominacao}" arquivada.` })
    recarregar()
  }

  return (
    <section className="painel" aria-labelledby="titulo-denominacoes">
      <h2 id="titulo-denominacoes">Denominações</h2>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(denominacoes) =>
          denominacoes.length === 0 ? (
            <p className="vazio">Nenhuma denominação cadastrada ainda.</p>
          ) : (
            <ul className="lista-simples" aria-label="Denominações">
              {denominacoes.map((d) => (
                <li key={d.id}>
                  <span>
                    {d.nome}
                    {d.sigla && <span className="detalhe"> ({d.sigla})</span>}
                  </span>
                  <button
                    type="button"
                    className="botao-texto"
                    aria-label={`Arquivar a denominação ${d.nome}`}
                    onClick={() => void arquivar(d.id, d.nome)}
                  >
                    Arquivar
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </MostrarCarga>

      <form
        className="form-linha"
        aria-label="Nova denominação"
        onSubmit={(e) => {
          e.preventDefault()
          void adicionar()
        }}
      >
        <label>
          Nova denominação
          <input required value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          Sigla (opcional)
          <input value={sigla} onChange={(e) => setSigla(e.target.value)} />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Adicionar
        </button>
      </form>
      <Mensagem sucesso={resultado.sucesso} erro={resultado.erro} />
    </section>
  )
}
