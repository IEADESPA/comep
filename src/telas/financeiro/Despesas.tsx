import { useState } from 'react'
import { MostrarCarga } from '../../componentes/Basicos'
import { Chip, Selo } from '../../componentes/Telas'
import { autorizarDespesa, despesasPorSituacao, type LinhaCaixa } from '../../dados/caixa'
import { ok } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { LinkComprovante } from './comum'
import { plural, type Concluir } from './util'

// Financeiro › Despesas a autorizar (rodada 11, opção 1: os cartões). Quem autoriza é o presidente (Art. 12, §2º, VI);
// quem lançou não autoriza a própria. Subfunções: Autorizadas e Recusadas.

const AVISO = 'Quem autoriza é o presidente (Art. 12, §2º, VI). Quem lançou a despesa não pode autorizá-la.'

/** /financeiro/despesas — as despesas esperando o presidente, em cartões, e as autorizadas no mês. */
export function DespesasEsperando({ podeAutorizar, pessoaId, concluir }: { podeAutorizar: boolean; pessoaId: string; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [esperando, autorizadas] = await Promise.all([despesasPorSituacao('aguardando_autorizacao'), despesasPorSituacao('efetivado', 100)])
    if (esperando.erro !== null) return esperando
    if (autorizadas.erro !== null) return autorizadas
    return ok({ esperando: esperando.dados, autorizadas: autorizadas.dados })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  const mes = hojeIso().slice(0, 7)
  return (
    <>
      <p className="detalhe">
        {AVISO}
        {!podeAutorizar && ' Você vê as mesmas despesas como "esperando o presidente".'}
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ esperando, autorizadas }) => {
          const doMes = autorizadas.filter((d) => (d.autorizado_em ?? '').slice(0, 7) === mes)
          const ultima = doMes[0]
          return (
            <>
              {esperando.length === 0 ? (
                <p className="vazio">Nenhuma despesa aguardando autorização.</p>
              ) : (
                <ul className="fin-cartoes" aria-label="Despesas aguardando autorização">
                  {esperando.map((d) => (
                    <CartaoDespesa key={d.id} d={d} podeAutorizar={podeAutorizar} minha={d.lancado_por_id === pessoaId} concluir={concluirERecarregar} />
                  ))}
                </ul>
              )}
              <section className="bloco" aria-labelledby="titulo-autorizadas-mes">
                <h2 id="titulo-autorizadas-mes">Autorizadas neste mês</h2>
                <p>
                  {doMes.length === 0
                    ? 'Nenhuma despesa autorizada neste mês.'
                    : `${plural(doMes.length, 'despesa', 'despesas')} · ${formatarReais(doMes.reduce((t, d) => t + Number(d.valor), 0))} · a última em ${formatarData(ultima.data)} (${ultima.descricao})`}
                </p>
              </section>
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function CartaoDespesa({ d, podeAutorizar, minha, concluir }: { d: LinhaCaixa; podeAutorizar: boolean; minha: boolean; concluir: Concluir }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const decide = podeAutorizar && !minha
  return (
    <li className="bloco fin-cartao-despesa" aria-label={`Despesa: ${d.descricao}`}>
      <div className="fin-cartao-topo">
        <Chip area="assembleias">{d.categoria_nome}</Chip>
        {decide ? <Selo tipo="analise">Esperando você</Selo> : <Selo tipo="analise">Esperando o presidente</Selo>}
      </div>
      <strong className="fin-cartao-titulo">{d.descricao}</strong>
      <strong className="fin-cartao-valor">{formatarReais(d.valor)}</strong>
      <span className="detalhe">
        {formatarData(d.data)} · sai de {d.conta_nome}
        {d.lancado_por_nome && ` · lançada por ${d.lancado_por_nome}`} em {formatarDataDeInstante(d.criado_em)}
      </span>
      <LinkComprovante caminho={d.comprovante_caminho} texto="Ver o comprovante" semTexto="sem comprovante" />
      {podeAutorizar && minha && <p className="detalhe">Você lançou esta despesa: outra pessoa da presidência autoriza.</p>}
      {decide && (
        <>
          <div className="acoes">
            <button type="button" className="botao botao-secundario" disabled={enviando} aria-expanded={recusando} onClick={() => setRecusando((r) => !r)}>
              Recusar
            </button>
            <button
              type="button"
              className="botao"
              disabled={enviando}
              onClick={() => void umaVez(async () => concluir(await autorizarDespesa(d.id, true, ''), `Despesa autorizada: ${d.descricao}.`))}
            >
              Autorizar
            </button>
          </div>
          {recusando && (
            <form
              className="form-linha form-compacto"
              aria-label={`Recusar a despesa ${d.descricao}`}
              onSubmit={(e) => {
                e.preventDefault()
                void umaVez(async () => concluir(await autorizarDespesa(d.id, false, motivo), `Despesa recusada: ${d.descricao}.`))
              }}
            >
              <label>
                Motivo *
                <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: falta a nota fiscal" />
              </label>
              <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                Recusar a despesa
              </button>
            </form>
          )}
        </>
      )}
    </li>
  )
}

/** /financeiro/despesas/autorizadas e /recusadas — as últimas decididas pelo presidente. */
export function DespesasDecididas({ situacao }: { situacao: 'efetivado' | 'recusado' }) {
  const [carga, recarregar] = useCarregar(() => despesasPorSituacao(situacao, 200))
  const autorizadas = situacao === 'efetivado'
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(despesas) =>
        despesas.length === 0 ? (
          <p className="vazio">{autorizadas ? 'Nenhuma despesa autorizada ainda.' : 'Nenhuma despesa recusada.'}</p>
        ) : (
          <>
            <p className="detalhe">
              {autorizadas ? 'As últimas despesas autorizadas pelo presidente' : 'As despesas recusadas pelo presidente, com o motivo'} (
              {plural(despesas.length, 'despesa', 'despesas')}, {formatarReais(despesas.reduce((t, d) => t + Number(d.valor), 0))}).
            </p>
            <ul className="bloco lista-linhas" aria-label={autorizadas ? 'Despesas autorizadas' : 'Despesas recusadas'}>
              {despesas.map((d) => (
                <li key={d.id} aria-label={d.descricao}>
                  <span className="linha-corpo">
                    <strong>{d.descricao}</strong>
                    <span>
                      {formatarData(d.data)} · {d.categoria_nome} · {d.conta_nome}
                      {d.lancado_por_nome && ` · lançada por ${d.lancado_por_nome}`}
                    </span>
                    <span>
                      {autorizadas ? 'Autorizada' : 'Recusada'}
                      {d.autorizado_por_nome && ` por ${d.autorizado_por_nome}`}
                      {d.autorizado_em && ` em ${formatarDataDeInstante(d.autorizado_em)}`}
                      {!autorizadas && d.motivo && ` · motivo: ${d.motivo}`}
                    </span>
                    {d.comprovante_caminho && (
                      <span>
                        <LinkComprovante caminho={d.comprovante_caminho} texto="comprovante" />
                      </span>
                    )}
                  </span>
                  <span className={autorizadas ? 'fin-valor valor-saida' : 'fin-valor'}>{formatarReais(d.valor)}</span>
                </li>
              ))}
            </ul>
          </>
        )
      }
    </MostrarCarga>
  )
}
