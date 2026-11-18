// Fase 5.1 — pedidos de correção no cadastro: o próprio ministro ou o pastor presidente da igreja dele pedem;
// a secretaria (ou a presidência) corrige na ficha e responde.
import { useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  listarPedidosCorrecao,
  NOME_DA_SITUACAO_PEDIDO,
  pedirCorrecao,
  responderCorrecao,
  type PedidoCorrecao,
} from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataDeInstante } from '../../utilitarios/formatos'

const CLASSE = { pendente: 'etiqueta etiqueta-conferencia', atendido: 'etiqueta etiqueta-ok', recusado: 'etiqueta etiqueta-atraso' }

/** "Pedir correção" (um formulário recolhido). */
export function PedirCorrecao({
  pessoaId,
  rotulo,
  aoConcluir,
}: {
  pessoaId: string
  rotulo: string
  aoConcluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>{rotulo}</summary>
      <form
        aria-label={rotulo}
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const r = await pedirCorrecao(pessoaId, texto)
            aoConcluir(r, 'Pedido de correção enviado à secretaria.')
            if (r.erro === null) setTexto('')
          })
        }}
      >
        <label>
          O que precisa ser corrigido? *
          <textarea
            required
            minLength={5}
            maxLength={1000}
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: o título é Presbítero; o nome tem acento (Sebastião)"
          />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Enviar à secretaria
        </button>
      </form>
    </details>
  )
}

/** A lista dos pedidos, com a resposta da secretaria. `nomes` completa o nome de quem a RLS não deixa ler. */
export function ListaDePedidos({ pedidos, nomes }: { pedidos: PedidoCorrecao[]; nomes?: Map<string, string> }) {
  if (pedidos.length === 0) return <p className="vazio">Nenhum pedido de correção.</p>
  return (
    <ul className="lista" aria-label="Pedidos de correção">
      {pedidos.map((p) => {
        const nome = p.pessoa?.nome ?? nomes?.get(p.pessoa_id) ?? 'Ministro'
        return (
          <li key={p.id} className="lista-item lista-item-estatico" aria-label={`Pedido de correção: ${nome}`}>
            <strong>{nome}</strong>
            <span>
              <span className={CLASSE[p.situacao]}>{NOME_DA_SITUACAO_PEDIDO[p.situacao]}</span> pedido em {formatarDataDeInstante(p.criado_em)}
            </span>
            <q className="texto-justificativa">{p.texto}</q>
            {p.resposta && <span>Resposta da secretaria: {p.resposta}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Para a secretaria e a presidência: os pedidos esperando resposta (Ministros e inscrições › Correções pedidas). */
export function CorrecoesPendentes() {
  const [carga, recarregar] = useCarregar(() => listarPedidosCorrecao({ pendentes: true }))
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(pedidos) => (
        <section className="painel" aria-labelledby="titulo-correcoes">
          <h2 id="titulo-correcoes">Correções no cadastro ({pedidos.length})</h2>
          <p className="detalhe">Corrija na ficha do ministro e marque como atendido. Para recusar, diga o motivo.</p>
          <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
          {pedidos.length === 0 ? (
            <p className="vazio">Nenhum pedido de correção esperando.</p>
          ) : (
            <ul className="lista" aria-label="Pedidos de correção pendentes">
              {pedidos.map((p) => (
                <Pendente key={p.id} p={p} aoConcluir={concluir} />
              ))}
            </ul>
          )}
        </section>
      )}
    </MostrarCarga>
  )
}

function Pendente({ p, aoConcluir }: { p: PedidoCorrecao; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [resposta, setResposta] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = p.pessoa?.nome ?? 'Ministro'
  return (
    <li className="lista-item lista-item-estatico" aria-label={`Correção: ${nome}`}>
      <strong>
        <Link to={`/ministros/${p.pessoa_id}`}>{nome}</Link>
      </strong>
      <span>
        Pedido por {p.autor?.nome ?? '—'} em {formatarDataDeInstante(p.criado_em)}
      </span>
      <q className="texto-justificativa">{p.texto}</q>
      <span className="form-linha">
        <label>
          Resposta (obrigatória para recusar)
          <input value={resposta} maxLength={1000} onChange={(e) => setResposta(e.target.value)} />
        </label>
        <button
          type="button"
          className="botao"
          disabled={enviando}
          onClick={() => void umaVez(async () => aoConcluir(await responderCorrecao(p.id, true, resposta), `Correção de ${nome}: atendida.`))}
        >
          Atendido
        </button>
        <button
          type="button"
          className="botao botao-perigo"
          disabled={enviando || !resposta.trim()}
          onClick={() => void umaVez(async () => aoConcluir(await responderCorrecao(p.id, false, resposta), `Correção de ${nome}: recusada.`))}
        >
          Recusar
        </button>
      </span>
    </li>
  )
}
