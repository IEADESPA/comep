import { useState } from 'react'
import { MostrarCarga } from '../../componentes/Basicos'
import { Chip } from '../../componentes/Telas'
import { formatarReais } from '../../dados/configuracoes'
import { analisarInforme, informesConferidos, informesPendentes, nomeDaCobranca, type InformePendente } from '../../dados/financeiro'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante, iniciaisDe } from '../../utilitarios/formatos'
import { LinkComprovante } from './comum'
import { type Concluir } from './util'

// Financeiro › Comprovantes (rodada 11, opção 1: a lista): os pagamentos que os ministros informaram, com o comprovante
// ao lado e os botões; e os já conferidos.

const textoDaForma = (forma: string) => (forma.toLowerCase() === 'dinheiro' ? 'em dinheiro' : forma)

/** /financeiro/comprovantes — os pagamentos para conferir. */
export function ComprovantesParaConferir({ pessoaId, concluir }: { pessoaId: string; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(informesPendentes)
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <>
      <p className="detalhe">
        Os ministros informam o pagamento em "Minhas mensalidades". Confirmado, entra no caixa e a mensalidade fica em dia;
        recusado, volta para o ministro com o motivo.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(informes) =>
          informes.length === 0 ? (
            <p className="vazio">Nenhum pagamento aguardando conferência.</p>
          ) : (
            <ul className="bloco lista-linhas" aria-label="Pagamentos informados">
              {informes.map((i) => (
                <Informe key={i.id} informe={i} meu={i.pessoa_id === pessoaId} concluir={concluirERecarregar} />
              ))}
            </ul>
          )
        }
      </MostrarCarga>
    </>
  )
}

function Informe({ informe: i, meu, concluir }: { informe: InformePendente; meu: boolean; concluir: Concluir }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = i.pessoa?.nome ?? 'Associado'
  const contribuicao = i.cobranca ? nomeDaCobranca(i.cobranca) : 'Contribuição'

  function analisar(confirmar: boolean) {
    return umaVez(async () =>
      concluir(
        await analisarInforme(i.id, confirmar, motivo),
        confirmar ? `Pagamento de ${nome} confirmado (${contribuicao}).` : `Pagamento de ${nome} recusado.`,
      ),
    )
  }

  return (
    <li className="fin-informe" aria-label={`Pagamento de ${nome}`}>
      <span className="avatar-ministro" aria-hidden="true">
        {iniciaisDe(nome)}
      </span>
      <span className="linha-corpo">
        <strong>{nome}</strong>
        <span className="fin-informe-valor">
          {contribuicao} · <strong>{formatarReais(i.valor)}</strong>
        </span>
        <span>
          {textoDaForma(i.forma)} · pago em {formatarData(i.data_pagamento)} · informado em {formatarDataDeInstante(i.criado_em)}
          {i.observacao && ` · ${i.observacao}`}
        </span>
      </span>
      <span className="fin-informe-comprovante">
        <LinkComprovante caminho={i.comprovante_caminho} semTexto="sem comprovante (em dinheiro)" />
      </span>
      {meu ? (
        <span className="detalhe fin-informe-acoes">Este pagamento é seu: outra pessoa da tesouraria ou da presidência confere.</span>
      ) : (
        <span className="fin-informe-acoes">
          <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => setRecusando((r) => !r)} aria-expanded={recusando}>
            Recusar
          </button>
          <button type="button" className="botao" disabled={enviando} onClick={() => void analisar(true)}>
            Confirmar
          </button>
        </span>
      )}
      {recusando && !meu && (
        <form
          className="form-linha form-compacto fin-linha-largura"
          aria-label={`Recusar o pagamento de ${nome}`}
          onSubmit={(e) => {
            e.preventDefault()
            void analisar(false)
          }}
        >
          <label>
            Motivo *
            <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: comprovante ilegível" />
          </label>
          <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
            Recusar o pagamento
          </button>
        </form>
      )}
    </li>
  )
}

/** /financeiro/comprovantes/conferidos — os já conferidos (confirmados e recusados), os últimos primeiro. */
export function ComprovantesConferidos() {
  const [carga, recarregar] = useCarregar(() => informesConferidos(200))
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(informes) =>
        informes.length === 0 ? (
          <p className="vazio">Nenhum pagamento conferido ainda.</p>
        ) : (
          <>
            <p className="detalhe">Os últimos {informes.length} pagamentos conferidos pela tesouraria ou pela presidência.</p>
            <ul className="bloco lista-linhas" aria-label="Pagamentos conferidos">
              {informes.map((i) => {
                const nome = i.pessoa?.nome ?? 'Associado'
                const confirmado = i.situacao === 'confirmado'
                return (
                  <li key={i.id} className="fin-informe" aria-label={`Pagamento de ${nome}`}>
                    <span className="avatar-ministro" aria-hidden="true">
                      {iniciaisDe(nome)}
                    </span>
                    <span className="linha-corpo">
                      <strong>{nome}</strong>
                      <span className="fin-informe-valor">
                        {i.cobranca ? nomeDaCobranca(i.cobranca) : 'Contribuição'} · <strong>{formatarReais(i.valor)}</strong>
                      </span>
                      <span>
                        {confirmado ? 'Confirmado' : 'Recusado'}
                        {i.analisado && ` por ${i.analisado.nome}`}
                        {i.analisado_em && ` em ${formatarDataDeInstante(i.analisado_em)}`}
                        {!confirmado && i.motivo_recusa && ` · motivo: ${i.motivo_recusa}`}
                      </span>
                    </span>
                    <span className="fin-informe-comprovante">
                      <LinkComprovante caminho={i.comprovante_caminho} semTexto="sem comprovante (em dinheiro)" />
                    </span>
                    <span className="fin-informe-acoes">
                      <Chip area={confirmado ? 'financas' : 'pessoas'}>{confirmado ? 'Confirmado' : 'Recusado'}</Chip>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )
      }
    </MostrarCarga>
  )
}
