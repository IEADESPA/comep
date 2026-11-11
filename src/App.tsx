import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './componentes/Layout'
import { ITENS_MENU } from './componentes/menu'
import { ExigePerfil, RotaProtegida } from './componentes/Rotas'
import { bancoConfigurado } from './dados/cliente'
import { ProvedorSessao } from './estado/ProvedorSessao'
import { Entrar } from './telas/Entrar'
import { Inicio } from './telas/Inicio'
import { ConfiguracaoAusente, EmConstrucao, NaoEncontrado } from './telas/Simples'

// "/comep/" vira "/comep"; com VITE_BASE=/ fica sem prefixo
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  if (!bancoConfigurado) return <ConfiguracaoAusente />

  return (
    <ProvedorSessao>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="entrar" element={<Entrar />} />
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route index element={<Inicio />} />
              {ITENS_MENU.filter((item) => item.caminho !== '/').map((item) => (
                <Route
                  key={item.caminho}
                  path={item.caminho.slice(1)}
                  element={
                    <ExigePerfil item={item}>
                      <EmConstrucao item={item} />
                    </ExigePerfil>
                  }
                />
              ))}
              <Route path="*" element={<NaoEncontrado />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ProvedorSessao>
  )
}
