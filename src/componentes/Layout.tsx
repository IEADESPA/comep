import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { NOME_DO_PERFIL, type Perfil } from '../dados/perfis'
import { useSessao } from '../estado/contexto'
import { contemTexto } from '../utilitarios/formatos'
import { Icone, Ladrilho, MarcaCaixa, type NomeIcone } from './Icone'
import { ehDaDiretoria, funcoesVisiveis, itensVisiveis, localizar, moduloAberto, podeVer, ITENS_MENU, type Localizacao } from './menu'
import { MenuDoModulo, SeletorDeFuncao } from './MenuDoModulo'
import { useMenuRecolhido } from './menuRecolhido'
import { usePendencias } from '../estado/pendencias'
import { PainelAvisos } from './Sino'
import { useSino } from './useSino'
import { useTema } from './tema'

// Moldura do sistema (telas novas, Fase 5.5 — docs/telas-novas.md).
// Notebook: menu vermelho CURTO à esquerda (Início, a tela aberta e Meu perfil) e a barra branca do topo.
// Dentro de um módulo, a coluna vermelha vira o menu do módulo, com as funções (MenuDoModulo.tsx).
// Celular: barra vermelha em cima com o sino, o botão Menu e as abas (nada de barra embaixo); dentro de um
// módulo, logo abaixo dela, o botão com a função aberta, que abre a lista das funções.
// O menu e o conteúdo rolam cada um por si.

type Aberto = 'sino' | 'menu' | null

const ORDEM_DO_PAPEL: readonly Perfil[] = ['presidencia', 'secretaria', 'tesouraria', 'conselho_fiscal', 'admin_tecnico', 'presidente_igreja', 'ministro']

function papelDe(perfis: readonly Perfil[]): string {
  const principal = ORDEM_DO_PAPEL.find((p) => perfis.includes(p))
  return principal ? NOME_DO_PERFIL[principal] : 'Ainda sem perfil'
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
}

type ItemCurto = { para: string; titulo: string; icone: NomeIcone }

/** O menu curto: Início, a tela aberta e Meu perfil (quem ainda não tem perfil: Início, Meu pedido e Meu perfil). */
function itensCurtos(caminho: string, semPerfil: boolean): ItemCurto[] {
  const itens: ItemCurto[] = [{ para: '/painel', titulo: 'Início', icone: 'inicio' }]
  const aberto = moduloAberto(caminho)
  if (semPerfil) itens.push({ para: '/meu-pedido', titulo: 'Meu pedido', icone: 'pedido' })
  else if (caminho === '/modulos') itens.push({ para: '/modulos', titulo: 'Módulos', icone: 'grade' })
  else if (aberto && aberto.caminho !== '/meu-pedido') itens.push({ para: aberto.caminho, titulo: aberto.titulo, icone: aberto.icone })
  itens.push({ para: '/meu-perfil', titulo: 'Meu perfil', icone: 'perfil' })
  return itens
}

function trilhaDe(caminho: string, local: Localizacao | null, busca = ''): string {
  if (caminho === '/meu-perfil' || caminho.startsWith('/meu-perfil/')) return 'Meu perfil'
  // "Tenho um código" (S5-04): o "É você?" fica no Início
  if (caminho === '/painel' && new URLSearchParams(busca).get('codigo') === 'conferir') return 'Início › Tenho um código'
  if (caminho === '/modulos') return 'Módulos'
  if (local) {
    const partes = [local.modulo.titulo, local.funcao?.titulo, local.subfuncao?.titulo]
    // sem repetir (ex.: "Mural de avisos › Mural de avisos")
    return ['Início', ...partes.filter((p, i): p is string => Boolean(p) && p !== partes[i - 1])].join(' › ')
  }
  return moduloAberto(caminho)?.titulo ?? 'Início'
}

export function Layout() {
  const { estado, sair } = useSessao()
  const { pathname, search, key: chaveDaTela } = useLocation()
  const areaConteudo = useRef<HTMLElement>(null)
  // o painel aberto (sino ou menu) vale só na tela em que foi aberto: trocou de tela, fecha
  const [abertoEm, setAbertoEm] = useState<{ qual: Aberto; tela: string }>({ qual: null, tela: '' })
  const aberto: Aberto = abertoEm.tela === chaveDaTela ? abertoEm.qual : null
  const setAberto = (qual: Aberto) => setAbertoEm({ qual, tela: chaveDaTela })
  const [tema, alternarTema] = useTema()

  const conta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta : null
  const sino = useSino(conta)

  // Ao trocar de tela, o conteúdo volta para o topo
  useEffect(() => {
    areaConteudo.current?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }, [pathname])

  // Esc fecha o painel aberto
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setAbertoEm({ qual: null, tela: '' })
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [aberto])

  const semPerfil = conta !== null && conta.perfis.length === 0
  const curtos = itensCurtos(pathname, semPerfil)
  // Dentro de um módulo (com alguma função que a pessoa pode abrir), o menu é o do módulo
  const achado = localizar(pathname)
  const funcoes = achado && conta ? funcoesVisiveis(achado.modulo, conta.perfis) : []
  const local = achado && funcoes.length > 0 ? achado : null
  const pendencias = usePendencias(local?.modulo ?? null, conta?.perfis ?? [], pathname)
  // o menu recolhido (só no computador e dentro de um módulo): a escolha de cada pessoa, guardada no aparelho
  const [recolhido, setRecolhido] = useMenuRecolhido(conta?.pessoaId ?? null)
  const trilho = local !== null && recolhido
  const trocar = (qual: Exclude<Aberto, null>) => {
    setAberto(aberto === qual ? null : qual)
    if (qual === 'sino' && aberto !== 'sino') sino.recarregar()
  }
  const temaTexto = tema === 'escuro' ? 'Usar o modo claro' : 'Usar o modo escuro'

  return (
    <div className={trilho ? 'estrutura estrutura-trilho' : 'estrutura'}>
      {/* Notebook: o menu vermelho, curto */}
      <nav className={trilho ? 'lateral lateral-trilho' : 'lateral'} aria-label="Menu principal">
        <Link to="/" className="lateral-marca" title="Ir para o site do COMEP">
          <MarcaCaixa tamanho={40} />
          <span className="nome-comep" style={{ fontSize: 18 }}>
            COMEP
          </span>
        </Link>
        {local ? (
          <>
            <MenuDoModulo local={local} funcoes={funcoes} pendencias={pendencias} trilho={trilho} />
            {trilho ? (
              <button type="button" className="lateral-recolher lateral-dica" data-dica="Abrir o menu" onClick={() => setRecolhido(false)}>
                <Icone nome="expandir" tamanho={20} />
                <span className="somente-leitor">Abrir o menu</span>
              </button>
            ) : (
              <button type="button" className="lateral-recolher" onClick={() => setRecolhido(true)}>
                <Icone nome="recolher" tamanho={20} />
                Recolher o menu
              </button>
            )}
            <NavLink to="/meu-perfil" className={trilho ? 'lateral-item lateral-perfil lateral-dica' : 'lateral-item lateral-perfil'} data-dica={trilho ? 'Meu perfil' : undefined}>
              <Icone nome="perfil" />
              <span className={trilho ? 'somente-leitor' : undefined}>Meu perfil</span>
            </NavLink>
          </>
        ) : (
          <ul>
            {curtos.map((item) => (
              <li key={item.para}>
                <NavLink to={item.para} end={item.para === '/painel'} className="lateral-item">
                  <Icone nome={item.icone} />
                  {item.titulo}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
        {conta && (
          <div className="lateral-usuario" title={trilho ? `${conta.nome} · ${papelDe(conta.perfis)}` : undefined}>
            <span className="avatar-iniciais" aria-hidden="true">
              {iniciais(conta.nome)}
            </span>
            <span className="lateral-usuario-nome">
              <strong title={conta.nome}>{conta.nome}</strong>
              <span>{papelDe(conta.perfis)}</span>
            </span>
            <button type="button" className="lateral-sair" onClick={() => void sair()}>
              Sair
            </button>
          </div>
        )}
      </nav>

      <div className="coluna">
        <header className="topo">
          {/* Notebook: a barra branca */}
          <div className="topo-computador">
            <span className="topo-trilha">{trilhaDe(pathname, local, search)}</span>
            {conta && ehDaDiretoria(conta.perfis) && <BuscaTopo perfis={conta.perfis} />}
            <button type="button" className="botao-quadrado" aria-label={temaTexto} title={temaTexto} onClick={alternarTema}>
              <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} tamanho={19} />
            </button>
            <button
              type="button"
              className="botao-quadrado"
              aria-label={sino.naoLidos > 0 ? `Avisos (${sino.naoLidos} ${sino.naoLidos === 1 ? 'novo' : 'novos'})` : 'Avisos'}
              aria-expanded={aberto === 'sino'}
              aria-controls="painel-avisos"
              onClick={() => trocar('sino')}
            >
              <Icone nome="sino" tamanho={19} />
              {sino.naoLidos > 0 && <span className="ponto-novo" aria-hidden="true" />}
            </button>
          </div>

          {/* Celular: a barra vermelha em cima */}
          <div className="topo-celular">
            <div className="topo-linha">
              <Link to="/painel" className="topo-marca" aria-label="COMEP — Início">
                <MarcaCaixa tamanho={36} />
                <span className="nome-comep" style={{ fontSize: 18 }}>
                  COMEP
                </span>
              </Link>
              <button
                type="button"
                className="botao-topo"
                aria-label={sino.naoLidos > 0 ? `Avisos (${sino.naoLidos} ${sino.naoLidos === 1 ? 'novo' : 'novos'})` : 'Avisos'}
                aria-expanded={aberto === 'sino'}
                aria-controls="painel-avisos"
                onClick={() => trocar('sino')}
              >
                <Icone nome="sino" tamanho={22} />
                {sino.naoLidos > 0 && (
                  <span className="contagem-topo" aria-hidden="true">
                    {sino.naoLidos > 9 ? '9+' : sino.naoLidos}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="botao-topo"
                aria-label="Menu"
                aria-expanded={aberto === 'menu'}
                aria-controls="menu-celular"
                onClick={() => trocar('menu')}
              >
                <Icone nome={aberto === 'menu' ? 'x' : 'menu'} tamanho={24} />
              </button>
            </div>
            <nav aria-label="Navegação">
              <ul className="abas-topo">
                <li>
                  <NavLink to="/painel" end className={({ isActive }) => (isActive ? 'ativa' : undefined)}>
                    <Icone nome="inicio" tamanho={18} />
                    Início
                  </NavLink>
                </li>
                <li>
                  {semPerfil ? (
                    <NavLink to="/meu-pedido" className={({ isActive }) => (isActive ? 'ativa' : undefined)}>
                      <Icone nome="pedido" tamanho={18} />
                      Meu pedido
                    </NavLink>
                  ) : (
                    <Link to="/modulos" className={pathname === '/modulos' || local || moduloAberto(pathname) ? 'ativa' : undefined}>
                      <Icone nome="grade" tamanho={18} />
                      Módulos
                    </Link>
                  )}
                </li>
                <li>
                  <NavLink to="/meu-perfil" className={({ isActive }) => (isActive ? 'ativa' : undefined)}>
                    <Icone nome="perfil" tamanho={18} />
                    Meu perfil
                  </NavLink>
                </li>
              </ul>
            </nav>
          </div>

          {aberto === 'sino' && conta && (
            <PainelAvisos sino={sino} veMural={itensVisiveis(conta.perfis).some((i) => i.caminho === '/avisos')} fechar={() => setAberto(null)} />
          )}

          {aberto === 'menu' && (
            <nav id="menu-celular" className="painel-flutuante menu-celular" aria-label="Menu principal">
              <ul>
                <li>
                  <NavLink to="/painel" end className="menu-celular-item">
                    <Icone nome="inicio" />
                    Início
                  </NavLink>
                </li>
                <li>
                  {semPerfil ? (
                    <NavLink to="/meu-pedido" className="menu-celular-item">
                      <Icone nome="pedido" />
                      Meu pedido
                    </NavLink>
                  ) : (
                    <NavLink to="/modulos" className="menu-celular-item">
                      <Icone nome="grade" />
                      Módulos
                    </NavLink>
                  )}
                </li>
                <li>
                  <button type="button" className="menu-celular-item" onClick={() => trocar('sino')}>
                    <Icone nome="sino" />
                    Avisos{sino.naoLidos > 0 ? ` (${sino.naoLidos})` : ''}
                  </button>
                </li>
                <li>
                  <NavLink to="/meu-perfil" className="menu-celular-item">
                    <Icone nome="perfil" />
                    Meu perfil
                  </NavLink>
                </li>
                <li>
                  <button type="button" className="menu-celular-item" onClick={alternarTema}>
                    <Icone nome={tema === 'escuro' ? 'sol' : 'lua'} />
                    {tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
                  </button>
                </li>
                <li>
                  <button type="button" className="menu-celular-item menu-celular-sair" onClick={() => void sair()}>
                    <Icone nome="sair" />
                    Sair
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </header>

        {aberto && <div className="veu" aria-hidden="true" onClick={() => setAberto(null)} />}

        {/* A coluna da direita rola sozinha, sem levar o menu junto */}
        <main className="area-conteudo" ref={areaConteudo}>
          <div className="conteudo">
            {local && <SeletorDeFuncao key={pathname} local={local} funcoes={funcoes} pendencias={pendencias} />}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// A busca do topo (diretoria): as telas e, para quem pode, os ministros e as igrejas
// ---------------------------------------------------------------------

type Resultado = { chave: string; para: string; texto: string; icone: NomeIcone; area: 'pessoas' | 'assembleias' | 'financas' | 'eventos' }

function resultadosDaBusca(texto: string, perfis: readonly Perfil[]): Resultado[] {
  const busca = texto.trim()
  if (!busca) return []
  const visiveis = itensVisiveis(perfis)
  const telas: Resultado[] = [
    ...visiveis.filter((i) => contemTexto(i.titulo, busca)),
    ...visiveis.filter((i) => !contemTexto(i.titulo, busca) && contemTexto(i.descricao, busca)),
  ]
    .slice(0, 5)
    .map((i) => ({ chave: i.caminho, para: i.caminho, texto: i.titulo, icone: i.icone, area: i.area }))
  const pode = (caminho: string) => {
    const item = ITENS_MENU.find((i) => i.caminho === caminho)
    return item ? podeVer(item, perfis) : false
  }
  const q = encodeURIComponent(busca)
  if (pode('/ministros')) telas.push({ chave: 'ministro', para: `/ministros?busca=${q}`, texto: `Buscar ministro: “${busca}”`, icone: 'ministros', area: 'pessoas' })
  if (pode('/igrejas')) telas.push({ chave: 'igreja', para: `/igrejas/lista?busca=${q}`, texto: `Buscar igreja: “${busca}”`, icone: 'igreja', area: 'pessoas' })
  return telas
}

function BuscaTopo({ perfis }: { perfis: readonly Perfil[] }) {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [aberta, setAberta] = useState(false)
  const [escolhido, setEscolhido] = useState(0)
  const resultados = resultadosDaBusca(texto, perfis)

  function ir(r: Resultado | undefined) {
    if (!r) return
    navigate(r.para)
    setTexto('')
    setAberta(false)
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setEscolhido((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setEscolhido((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      ir(resultados[escolhido])
    } else if (e.key === 'Escape') {
      setAberta(false)
    }
  }

  return (
    <div className="busca-topo" role="search">
      <Icone nome="busca" tamanho={18} />
      <input
        type="search"
        aria-label="Buscar ministro, igreja ou tela"
        placeholder="Buscar ministro, igreja ou tela"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setEscolhido(0)
          setAberta(true)
        }}
        onFocus={() => setAberta(true)}
        onBlur={() => setTimeout(() => setAberta(false), 150)}
        onKeyDown={tecla}
      />
      {aberta && texto.trim() && (
        <ul className="busca-resultados" aria-label="Resultados da busca">
          {resultados.length === 0 ? (
            <li>
              <p className="vazio">Nada encontrado.</p>
            </li>
          ) : (
            resultados.map((r, i) => (
              <li key={r.chave}>
                <Link
                  to={r.para}
                  className={i === escolhido ? 'escolhido' : undefined}
                  onClick={() => {
                    setTexto('')
                    setAberta(false)
                  }}
                >
                  <Ladrilho area={r.area} icone={r.icone} tamanho={30} />
                  {r.texto}
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

