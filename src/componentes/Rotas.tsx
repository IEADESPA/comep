import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessao } from '../estado/contexto'
import { Aviso, Carregando } from './Basicos'
import { podeVer, type ItemMenu } from './menu'

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
  if (estado.conta.tipo !== 'ok' || !podeVer(item, estado.conta.conta.perfis)) {
    return (
      <Aviso titulo="Sem acesso">
        <p>O seu perfil não dá acesso a esta área. Se achar que é um engano, procure a secretaria do Conselho.</p>
      </Aviso>
    )
  }
  return children
}
