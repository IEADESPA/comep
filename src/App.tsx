import { BrowserRouter, Route, Routes } from 'react-router'
import { FaixaAmbiente } from './componentes/Basicos'
import { Layout } from './componentes/Layout'
import { ITENS_MENU } from './componentes/menu'
import { ExigePerfil, RotaProtegida } from './componentes/Rotas'
import { bancoConfigurado } from './dados/cliente'
import { ProvedorSessao } from './estado/ProvedorSessao'
import { Entrar } from './telas/Entrar'
import { Inicio } from './telas/Inicio'
import { ConfiguracaoAusente, EmConstrucao } from './telas/Simples'
import { PaginaInicial, PaginaNaoEncontrada, QueroMeAssociar } from './telas/Site'

// "/comep/" vira "/comep"; com VITE_BASE=/ fica sem prefixo
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  if (!bancoConfigurado) return <ConfiguracaoAusente />

  return (
    <ProvedorSessao>
      <FaixaAmbiente />
      <BrowserRouter basename={basename}>
        <Routes>
          {/* Site institucional (público) */}
          <Route index element={<PaginaInicial />} />
          <Route path="associar" element={<QueroMeAssociar />} />
          <Route path="entrar" element={<Entrar />} />

          {/* Portal do membro (exige login) */}
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route path="painel" element={<Inicio />} />
              {ITENS_MENU.filter((item) => item.caminho !== '/painel').map((item) => (
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
            </Route>
          </Route>

          <Route path="*" element={<PaginaNaoEncontrada />} />
        </Routes>
      </BrowserRouter>
    </ProvedorSessao>
  )
}
