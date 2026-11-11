import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useSessao } from '../estado/contexto'
import { itensVisiveis } from './menu'

export function Layout() {
  const { estado, sair } = useSessao()
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()
  const areaConteudo = useRef<HTMLElement>(null)

  // Ao trocar de tela, o conteúdo volta para o topo (no computador ele rola separado do menu)
  useEffect(() => {
    areaConteudo.current?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [pathname])

  const conta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta : null
  const itens = conta ? itensVisiveis(conta.perfis) : []

  return (
    <div className="estrutura">
      <header className="topo">
        {itens.length > 0 && (
          <button
            type="button"
            className="botao-menu"
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            Menu
          </button>
        )}
        <Link to="/" className="marca" title="Ir para o site do COMEP">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={32} height={32} />
          <span>COMEP</span>
        </Link>
        <div className="usuario">
          {conta && <span className="usuario-nome">{conta.nome}</span>}
          <button type="button" className="botao botao-secundario" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </header>

      {itens.length > 0 && (
        <nav id="menu-principal" className={menuAberto ? 'menu aberto' : 'menu'} aria-label="Menu principal">
          <ul>
            {itens.map((item) => (
              <li key={item.caminho}>
                <NavLink to={item.caminho} end={item.caminho === '/painel'} onClick={() => setMenuAberto(false)}>
                  {item.titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Coluna da direita: rola sozinha, sem levar o menu junto (no computador) */}
      <main className="area-conteudo" ref={areaConteudo}>
        <div className="conteudo">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
