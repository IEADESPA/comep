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
import { DetalheEncontro, EditarEncontro, ListaEncontros, NovoEncontro } from './telas/assembleias/Assembleias'
import { FaltasEJustificativas, ListaDePresenca } from './telas/assembleias/Presenca'
import { ConducaoAssembleia } from './telas/assembleias/Conducao'
import { DetalhePedidoAge, ListaPedidosAge, NovoPedidoAge } from './telas/assembleias/PedidosAge'
import { DetalheComissao, EditarComissao, ListaComissoes, NovaComissao } from './telas/comissoes/Comissoes'
import { DetalheEvento, EditarEvento, ListaEventos, NovoEvento } from './telas/eventos/Eventos'
import { MuralDeAvisos, PainelDaPresidencia } from './telas/avisos/Avisos'
import { DetalheEmprestimo, Patrimonio } from './telas/patrimonio/Patrimonio'
import { DetalheVotacao, EditarVotacao, ListaVotacoes, NovaVotacao } from './telas/votacoes/Votacoes'
import { Diretoria } from './telas/diretoria/Diretoria'
import { ValidarCredencial } from './telas/credencial/ValidarCredencial'
import { Entrar } from './telas/Entrar'
import { Financeiro } from './telas/financeiro/Financeiro'
import { MinhasMensalidades } from './telas/financeiro/MinhasMensalidades'
import { CadastrarIgreja } from './telas/igrejas/CadastrarIgreja'
import { CentralRegularizacao } from './telas/igrejas/CentralRegularizacao'
import { AnaliseIgreja, ParaConferir } from './telas/igrejas/Conferencia'
import { Denominacoes } from './telas/igrejas/Denominacoes'
import { FichaIgreja } from './telas/igrejas/FichaIgreja'
import { PainelIgrejas, TabelaIgrejas } from './telas/igrejas/ListaIgrejas'
import { Inicio } from './telas/inicio/Inicio'
import { Modulos } from './telas/inicio/Modulos'
import { DetalheInscricao, ListaInscricoes } from './telas/inscricoes/Inscricoes'
import { DetalheMinistro } from './telas/ministros/DetalheMinistro'
import { ListaMinistros } from './telas/ministros/ListaMinistros'
import { NovoMinistro } from './telas/ministros/NovoMinistro'
import { CorrecoesPedidas } from './telas/ministros/CorrecoesPedidas'
import { CriarAcessoPedido, MeuPedido } from './telas/pedido/MeuPedido'
import { MeuPerfil } from './telas/portal/MeuPerfil'
import { CadastroDaMinhaIgreja } from './telas/portal/CadastroDaMinhaIgreja'
import { MinhaIgreja } from './telas/portal/MinhaIgreja'
import { ConfiguracaoAusente, EmConstrucao } from './telas/Simples'
import {
  AgendaPagina,
  ConvocacaoPublicaPagina,
  DiretoriaPagina,
  EventoPublicoPagina,
  IgrejasPagina,
  PaginaInicial,
  PaginaNaoEncontrada,
  QueroMeAssociar,
} from './telas/Site'

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
          {/* Convocações das assembleias (edital e pauta), para qualquer pessoa */}
          <Route path="convocacoes/:id" element={<ConvocacaoPublicaPagina />} />
          <Route path="agenda" element={<AgendaPagina />} />
          <Route path="agenda/:id" element={<EventoPublicoPagina />} />
          <Route path="diretoria-do-comep" element={<DiretoriaPagina />} />
          <Route path="igrejas-do-comep" element={<IgrejasPagina />} />

          {/* Portal do membro (exige login) */}
          <Route element={<RotaProtegida />}>
            <Route element={<Layout />}>
              <Route path="painel" element={<Inicio />} />
              <Route path="modulos" element={<Modulos />} />
              <Route path="meu-pedido" element={<MeuPedido />} />
              <Route path="meu-perfil" element={<MeuPerfil />} />
              <Route path="meu-perfil/:aba" element={<MeuPerfil />} />

              <Route path="minhas-mensalidades" element={<Area caminho="/minhas-mensalidades" />}>
                <Route index element={<MinhasMensalidades />} />
              </Route>

              {/* Cada função do módulo tem endereço próprio (menu do módulo, src/componentes/menu.ts) */}
              <Route path="financeiro" element={<Area caminho="/financeiro" />}>
                <Route index element={<Financeiro />} />
                <Route path="contribuicoes/cobrancas" element={<Financeiro parte="cobrancas" />} />
                <Route path=":parte" element={<Financeiro />} />
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
              <Route path="assembleias" element={<Area caminho="/assembleias" />}>
                <Route index element={<ListaEncontros />} />
                <Route path="novo" element={<NovoEncontro />} />
                <Route path="faltas" element={<FaltasEJustificativas />} />
                <Route path="pedidos" element={<ListaPedidosAge />} />
                <Route path="pedidos/novo" element={<NovoPedidoAge />} />
                <Route path="pedidos/:id" element={<DetalhePedidoAge />} />
                <Route path=":id" element={<DetalheEncontro />} />
                <Route path=":id/presenca" element={<ListaDePresenca />} />
                <Route path=":id/conducao" element={<ConducaoAssembleia />} />
                <Route path=":id/editar" element={<EditarEncontro />} />
              </Route>
              <Route path="diretoria" element={<Area caminho="/diretoria" />}>
                <Route index element={<Diretoria />} />
              </Route>
              <Route path="avisos" element={<Area caminho="/avisos" />}>
                <Route index element={<MuralDeAvisos />} />
              </Route>
              <Route path="painel-presidencia" element={<Area caminho="/painel-presidencia" />}>
                <Route index element={<PainelDaPresidencia />} />
              </Route>
              <Route path="eventos" element={<Area caminho="/eventos" />}>
                <Route index element={<ListaEventos />} />
                <Route path="novo" element={<NovoEvento />} />
                <Route path=":id" element={<DetalheEvento />} />
                <Route path=":id/editar" element={<EditarEvento />} />
              </Route>
              <Route path="comissoes" element={<Area caminho="/comissoes" />}>
                <Route index element={<ListaComissoes />} />
                <Route path="nova" element={<NovaComissao />} />
                <Route path=":id" element={<DetalheComissao />} />
                <Route path=":id/editar" element={<EditarComissao />} />
              </Route>
              <Route path="votacoes" element={<Area caminho="/votacoes" />}>
                <Route index element={<ListaVotacoes />} />
                <Route path="nova" element={<NovaVotacao />} />
                <Route path=":id" element={<DetalheVotacao />} />
                <Route path=":id/editar" element={<EditarVotacao />} />
              </Route>
              <Route path="patrimonio" element={<Area caminho="/patrimonio" />}>
                <Route index element={<Patrimonio />} />
                <Route path=":aba" element={<Patrimonio />} />
                <Route path="emprestimos/:id" element={<DetalheEmprestimo />} />
              </Route>
              <Route path="minha-igreja" element={<Area caminho="/minha-igreja" />}>
                <Route index element={<MinhaIgreja />} />
                <Route path=":aba" element={<MinhaIgreja />} />
                <Route path="documentos/:tipo" element={<MinhaIgreja />} />
                <Route path="documentos/:tipo/:parte" element={<MinhaIgreja />} />
              </Route>
              <Route path="cadastrar-minha-igreja" element={<Area caminho="/cadastrar-minha-igreja" />}>
                <Route index element={<CadastroDaMinhaIgreja />} />
              </Route>

              <Route path="inscricoes" element={<Area caminho="/inscricoes" />}>
                <Route index element={<ListaInscricoes />} />
                <Route path=":id" element={<DetalheInscricao />} />
              </Route>

              <Route path="igrejas" element={<Area caminho="/igrejas" />}>
                <Route index element={<PainelIgrejas />} />
                <Route path="lista" element={<TabelaIgrejas />} />
                <Route path="lista/:filtro" element={<TabelaIgrejas />} />
                <Route path="conferir" element={<ParaConferir />} />
                <Route path="conferir/:id" element={<AnaliseIgreja />} />
                <Route path="regularizacao" element={<CentralRegularizacao />} />
                <Route path="nova" element={<CadastrarIgreja />} />
                <Route path="denominacoes" element={<Denominacoes />} />
                <Route path=":id" element={<FichaIgreja />} />
                <Route path=":id/:aba" element={<FichaIgreja />} />
              </Route>

              <Route path="ministros" element={<Area caminho="/ministros" />}>
                <Route index element={<ListaMinistros />} />
                <Route path="novo" element={<NovoMinistro />} />
                <Route path="correcoes" element={<CorrecoesPedidas />} />
                <Route path=":pessoaId" element={<DetalheMinistro />} />
                <Route path=":pessoaId/:aba" element={<DetalheMinistro />} />
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
