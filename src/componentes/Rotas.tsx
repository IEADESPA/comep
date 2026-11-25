import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessao } from '../estado/contexto'
import { Aviso, Carregando } from './Basicos'
import { funcaoVisivel, localizar, podeVer, type ItemMenu } from './menu'

/** Só deixa passar quem está logado; os demais vão para a tela de entrada. */
export function RotaProtegida() {
  const { estado } = useSessao()
  const location = useLocation()

  if (estado.situacao === 'carregando') return <Carregando />
  if (estado.situacao === 'deslogado') {
    // com o que vem depois do "?" (ex.: o código da portaria lido no QR, parte 14)
    return <Navigate to="/entrar" replace state={{ voltarPara: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Mostra a tela só para os perfis do item. É conforto visual: a proteção real está no banco (RLS). */
export function ExigePerfil({ item, children }: { item: ItemMenu; children: ReactNode }) {
  const { estado } = useSessao()

  if (estado.situacao !== 'logado' || estado.conta === null) return <Carregando />
  if (estado.conta.tipo !== 'ok' || !podeVer(item, estado.conta.conta.perfis)) return <SemAcesso />
  return children
}

/**
 * Mostra a tela só a quem vê a função no menu: para as funções que têm perfis próprios dentro de um módulo (em
 * Administração, o Termo e os Avisos são da secretaria, da presidência e do administrador técnico, e a tesouraria
 * entra nas Configurações). Quem digita o endereço vê "Sem acesso", e não o erro do banco (D-11).
 */
export function ExigeFuncao({ caminho, children }: { caminho: string; children: ReactNode }) {
  const { estado } = useSessao()

  if (estado.situacao !== 'logado' || estado.conta === null) return <Carregando />
  const local = localizar(caminho)
  const pode = estado.conta.tipo === 'ok' && local?.funcao != null && funcaoVisivel(local.funcao, local.modulo, estado.conta.conta.perfis)
  return pode ? children : <SemAcesso />
}

function SemAcesso() {
  return (
    <Aviso titulo="Sem acesso">
      <p>O seu perfil não dá acesso a esta área. Se achar que é um engano, procure a secretaria do Conselho.</p>
    </Aviso>
  )
}
