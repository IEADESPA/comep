import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { CorrecoesPendentes } from '../portal/PedidosCorrecao'
import { TrocasPendentes } from './TrocasPendentes'

/**
 * /ministros/correcoes — Ministros e inscrições › Correções pedidas: o que os ministros e os pastores presidentes
 * pediram para corrigir no cadastro (também o nome e o CNPJ da igreja, D-10), e as trocas de igreja pedidas pelo perfil.
 */
export function CorrecoesPedidas() {
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Ministros e inscrições"
        titulo="Correções pedidas"
        sub="Os ministros pedem pelo perfil, e o pastor presidente, pela igreja (também o nome e o CNPJ dela). Aceita, a correção entra sozinha no cadastro."
      />
      <CorrecoesPendentes />
      <TrocasPendentes />
    </div>
  )
}
