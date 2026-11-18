import { useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarIgrejas, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { aprovarTroca, recusarTroca, trocasPendentes, type PedidoTroca } from '../../dados/portal'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, hojeIso } from '../../utilitarios/formatos'

/** Pedidos de troca de igreja feitos pelos ministros, para a secretaria/presidência decidir (Correções pedidas). */
export function TrocasPendentes() {
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [trocas, igrejas] = await Promise.all([trocasPendentes(), listarIgrejas()])
    if (trocas.erro !== null) return trocas
    if (igrejas.erro !== null) return igrejas
    return ok({ trocas: trocas.dados, igrejas: igrejas.dados })
  })

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ trocas, igrejas }) => (
        <section className="painel" aria-labelledby="titulo-trocas">
          <h2 id="titulo-trocas">Trocas de igreja ({trocas.length})</h2>
          <p className="detalhe">O ministro pede a troca no perfil dele. Aprovada, a igreja nova entra na ficha e a anterior fica no histórico.</p>
          <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
          {trocas.length === 0 ? (
            <p className="vazio">Nenhum pedido de troca de igreja esperando.</p>
          ) : (
            <ul className="lista" aria-label="Pedidos de troca de igreja">
              {trocas.map((t) => (
                <Troca key={t.id} troca={t} igrejas={igrejas} concluir={concluir} />
              ))}
            </ul>
          )}
        </section>
      )}
    </MostrarCarga>
  )
}

function Troca({
  troca,
  igrejas,
  concluir,
}: {
  troca: PedidoTroca
  igrejas: Igreja[]
  concluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [igrejaId, setIgrejaId] = useState(troca.igreja_id ?? '')
  const [data, setData] = useState(troca.a_partir_de ?? hojeIso())
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const destino = troca.igreja?.nome ?? `${troca.igreja_informada} (não cadastrada)`
  const nome = troca.pessoa?.nome ?? 'Ministro'

  async function executar(acao: () => Promise<{ erro: string | null }>, sucesso: string) {
    setEnviando(true)
    concluir(await acao(), sucesso)
    setEnviando(false)
  }

  return (
    <li className="lista-item lista-item-estatico" aria-label={`Troca de ${nome}`}>
      <strong>
        <Link to={`/ministros/${troca.pessoa_id}`}>{nome}</Link> → {destino}
      </strong>
      <span>
        {[troca.funcao, troca.pastor_presidente && 'como pastor presidente', `pedido em ${formatarData(troca.criado_em)}`]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {troca.observacao && <span>Observação: {troca.observacao}</span>}
      <form
        className="form-linha form-compacto"
        onSubmit={(e) => {
          e.preventDefault()
          void executar(() => aprovarTroca(troca.id, igrejaId, data), `Troca de igreja de ${nome} aprovada.`)
        }}
      >
        {!troca.igreja_id && (
          <label>
            Igreja cadastrada *
            <select required value={igrejaId} onChange={(e) => setIgrejaId(e.target.value)}>
              <option value="">— Escolha —</option>
              {igrejas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          A partir de
          {/* Pode ser data futura: o ministro pede a troca "a partir de" quando ela vai acontecer */}
          <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Aprovar troca
        </button>
      </form>
      <details className="acao-recolhida">
        <summary>Recusar</summary>
        <form
          className="form-linha form-compacto"
          onSubmit={(e) => {
            e.preventDefault()
            void executar(() => recusarTroca(troca.id, motivo), `Troca de igreja de ${nome} recusada.`)
          }}
        >
          <label>
            Motivo *
            <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
            Recusar troca
          </button>
        </form>
      </details>
    </li>
  )
}
