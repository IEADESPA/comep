import { useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useSessao } from '../estado/contexto'
import { itensVisiveis } from './menu'

export function Layout() {
  const { estado, sair } = useSessao()
  const [menuAberto, setMenuAberto] = useState(false)

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
        <div className="marca">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={32} height={32} />
          <span>COMEP</span>
        </div>
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
                <NavLink to={item.caminho} end={item.caminho === '/'} onClick={() => setMenuAberto(false)}>
                  {item.titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}
