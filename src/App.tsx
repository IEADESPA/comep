import { BrowserRouter, Outlet, Route, Routes } from 'react-router'
import { FaixaAmbiente } from './componentes/Basicos'
import { Layout } from './componentes/Layout'
import { ITENS_MENU } from './componentes/menu'
import { ExigePerfil, RotaProtegida } from './componentes/Rotas'
import { bancoConfigurado } from './dados/cliente'
import { ProvedorSessao } from './estado/ProvedorSessao'
import { Acessos } from './telas/administracao/Acessos'
import { Auditoria } from './telas/administracao/Auditoria'
import { Configuracoes } from './telas/administracao/Configuracoes'
import { NovaSenha, PrimeiroAcesso } from './telas/acesso/PrimeiroAcesso'
import { CredencialDe, ImprimirCredenciais, ImprimirMinhaCredencial, ListaCredenciais, MinhaCredencial } from './telas/credencial/Credenciais'
import { EditorModelo } from './telas/credencial/EditorModelo'
import { ValidarCredencial } from './telas/credencial/ValidarCredencial'
import { Entrar } from './telas/Entrar'
import { Financeiro } from './telas/financeiro/Financeiro'
import { MinhasMensalidades } from './telas/financeiro/MinhasMensalidades'
import { EditarIgreja, NovaIgreja } from './telas/igrejas/FormIgreja'
import { ListaIgrejas } from './telas/igrejas/ListaIgrejas'
import { Inicio } from './telas/Inicio'
import { DetalheInscricao, ListaInscricoes } from './telas/inscricoes/Inscricoes'
import { DetalheMinistro } from './telas/ministros/DetalheMinistro'
import { ListaMinistros } from './telas/ministros/ListaMinistros'
import { NovoMinistro } from './telas/ministros/NovoMinistro'
import { CriarAcessoPedido, MeuPedido } from './telas/pedido/MeuPedido'
import { MeuPerfil } from './telas/portal/MeuPerfil'
import { MinhaIgreja } from './telas/portal/MinhaIgreja'
import { ConfiguracaoAusente, EmConstrucao } from './telas/Simples'
import { PaginaInicial, PaginaNaoEncontrada, QueroMeAssociar } from './telas/Site'

// "/comep/" vira "/comep"; com VITE_BASE=/ fica sem prefixo
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

/** Área do menu: só abre para os perfis do item (a proteção real está no banco). */
function Area({ caminho }: { caminho: string }) {
  const item = ITENS_MENU.find((i) => i.caminho === caminho)
  if (!item) throw new Error(`Item de menu inexistente: ${caminho}`)
  return (
    <ExigePerfil item={item}>
      <Outlet />
    </ExigePerfil>
  )
}

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
          <Route path="associar/pedido" element={<CriarAcessoPedido />} />
          <Route path="entrar" element={<Entrar />} />
          <Route path="primeiro-acesso" element={<PrimeiroAcesso />} />
          <Route path="nova-senha" element={<NovaSenha />} />
          {/* Validação pública da credencial (o QR Code abre aqui, sem login) */}
          <Route path="validar/:codigo" element={<ValidarCredencial />} />

          {/* Portal do membro (exige login) */}
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route path="painel" element={<Inicio />} />
              <Route path="meu-pedido" element={<MeuPedido />} />
              <Route path="meu-perfil" element={<MeuPerfil />} />

              <Route path="minhas-mensalidades" element={<Area caminho="/minhas-mensalidades" />}>
                <Route index element={<MinhasMensalidades />} />
              </Route>

              <Route path="financeiro" element={<Area caminho="/financeiro" />}>
                <Route index element={<Financeiro />} />
              </Route>

              <Route path="minha-credencial" element={<Area caminho="/minha-credencial" />}>
                <Route index element={<MinhaCredencial />} />
                <Route path="imprimir" element={<ImprimirMinhaCredencial />} />
              </Route>
              <Route path="credenciais" element={<Area caminho="/credenciais" />}>
                <Route index element={<ListaCredenciais />} />
                <Route path="imprimir" element={<ImprimirCredenciais />} />
                <Route path="modelo" element={<EditorModelo />} />
                <Route path=":pessoaId" element={<CredencialDe />} />
              </Route>
              <Route path="minha-igreja" element={<Area caminho="/minha-igreja" />}>
                <Route index element={<MinhaIgreja />} />
              </Route>

              <Route path="inscricoes" element={<Area caminho="/inscricoes" />}>
                <Route index element={<ListaInscricoes />} />
                <Route path=":id" element={<DetalheInscricao />} />
              </Route>

              <Route path="igrejas" element={<Area caminho="/igrejas" />}>
                <Route index element={<ListaIgrejas />} />
                <Route path="nova" element={<NovaIgreja />} />
                <Route path=":id" element={<EditarIgreja />} />
              </Route>

              <Route path="ministros" element={<Area caminho="/ministros" />}>
                <Route index element={<ListaMinistros />} />
                <Route path="novo" element={<NovoMinistro />} />
                <Route path=":pessoaId" element={<DetalheMinistro />} />
              </Route>

              <Route path="acessos" element={<Area caminho="/acessos" />}>
                <Route index element={<Acessos />} />
              </Route>

              <Route path="configuracoes" element={<Area caminho="/configuracoes" />}>
                <Route index element={<Configuracoes />} />
              </Route>

              <Route path="auditoria" element={<Area caminho="/auditoria" />}>
                <Route index element={<Auditoria />} />
              </Route>

              {/* Telas das próximas entregas */}
              {ITENS_MENU.filter((item) => !item.pronto).map((item) => (
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
