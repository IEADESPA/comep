import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { CorrecoesPendentes } from '../portal/PedidosCorrecao'
import { TrocasPendentes } from './TrocasPendentes'

/**
 * /ministros/correcoes — Ministros e inscrições › Correções pedidas: o que os ministros e os pastores presidentes
 * pediram para corrigir no cadastro, e as trocas de igreja pedidas pelo perfil.
 */
export function CorrecoesPedidas() {
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Ministros e inscrições"
        titulo="Correções pedidas"
        sub="Os ministros pedem pelo perfil (ou o pastor presidente, pela igreja). Aceita, a correção entra sozinha no cadastro."
      />
      <CorrecoesPendentes />
      <TrocasPendentes />
    </div>
  )
}
