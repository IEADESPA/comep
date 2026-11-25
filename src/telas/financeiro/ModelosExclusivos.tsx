import { useState } from 'react'
import { MostrarCarga } from '../../componentes/Basicos'
import { Chip } from '../../componentes/Telas'
import { formatarReais } from '../../dados/configuracoes'
import { desfazerPagamentoExclusivo, painelModelos, receberPagamentoExclusivo, type ModeloGrupo } from '../../dados/credencial'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import type { Concluir } from './util'

// Financeiro › Caixa › Modelos exclusivos (D-07, 22/11/2026). O modelo exclusivo da credencial é pago pela igreja, e
// quem recebe o dinheiro é a tesouraria, que não abre o módulo Credenciais. Aqui ela recebe o pagamento (a entrada vai
// para o caixa, ligada ao modelo) ou desfaz (a entrada é cancelada, com o motivo). O modelo em si (a igreja, o valor e
// o desenho) continua sendo da secretaria, em Credenciais › Modelos.

export function ModelosExclusivosNoCaixa({ concluir }: { concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(painelModelos)
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ modelos }) => {
        const exclusivos = modelos.filter((m) => m.tipo === 'exclusivo')
        const aPagar = exclusivos.filter((m) => !m.pago_em)
        const pagos = exclusivos.filter((m) => m.pago_em)
        return (
          <div className="coluna-pilha">
            <section className="bloco" aria-labelledby="titulo-exclusivos-a-pagar">
              <h2 id="titulo-exclusivos-a-pagar">Esperando o pagamento ({aPagar.length})</h2>
              {aPagar.length === 0 ? (
                <p className="vazio">Nenhum modelo exclusivo esperando o pagamento.</p>
              ) : (
                <ul className="lista-linhas" aria-label="Modelos esperando o pagamento">
                  {aPagar.map((m) => (
                    <ModeloExclusivo key={m.id} m={m} concluir={concluirERecarregar} />
                  ))}
                </ul>
              )}
            </section>
            <section className="bloco" aria-labelledby="titulo-exclusivos-pagos">
              <h2 id="titulo-exclusivos-pagos">Pagos ({pagos.length})</h2>
              {pagos.length === 0 ? (
                <p className="vazio">Nenhum modelo exclusivo pago ainda.</p>
              ) : (
                <ul className="lista-linhas" aria-label="Modelos pagos">
                  {pagos.map((m) => (
                    <ModeloExclusivo key={m.id} m={m} concluir={concluirERecarregar} />
                  ))}
                </ul>
              )}
            </section>
            <p className="detalhe">
              O modelo exclusivo é pedido pela igreja e preparado pela secretaria, em Credenciais › Modelos. Ele só vale
              para os ministros da igreja depois de pago. Desfazer o pagamento cancela a entrada do caixa, com o motivo.
            </p>
          </div>
        )
      }}
    </MostrarCarga>
  )
}

function ModeloExclusivo({ m, concluir }: { m: ModeloGrupo; concluir: Concluir }) {
  const [pagoEm, setPagoEm] = useState(hojeIso())
  const [forma, setForma] = useState('PIX')
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const valor = formatarReais(Number(m.valor ?? 0))
  return (
    <li aria-label={m.nome} className="linha-modelo-exclusivo">
      <span className="linha-corpo">
        <strong>{m.nome}</strong>
        <span>
          {m.igreja_nome ?? 'igreja não informada'} · {valor}
          {m.pedido_por_nome && ` · pedido por ${m.pedido_por_nome}`}
        </span>
        <span>
          <Chip area={m.pago_em ? 'financas' : 'eventos'}>{m.pago_em ? `pago em ${formatarData(m.pago_em)}` : 'falta o pagamento'}</Chip>
        </span>
      </span>
      {m.pago_em ? (
        <details className="acao-recolhida">
          <summary>Desfazer o pagamento</summary>
          <form
            className="form-linha"
            aria-label={`Desfazer o pagamento de ${m.nome}`}
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => {
                const r = await desfazerPagamentoExclusivo(m.id, motivo)
                concluir(r, `Pagamento de ${m.nome} desfeito: a entrada do caixa foi cancelada e o modelo deixou de valer.`)
              })
            }}
          >
            <label>
              Motivo para desfazer (vai para o caixa) *
              <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <button type="submit" className="botao botao-perigo" disabled={enviando}>
              Desfazer o pagamento
            </button>
          </form>
        </details>
      ) : (
        <form
          className="form-linha"
          aria-label={`Receber o pagamento de ${m.nome}`}
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              const r = await receberPagamentoExclusivo(m.id, pagoEm, forma)
              concluir(r, `Pagamento de ${m.nome} recebido: a entrada está no caixa e o modelo vale para os ministros da igreja.`)
            })
          }}
        >
          <label className="campo-curto">
            Pago em
            <input type="date" required max={hojeIso()} value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
          </label>
          <label className="campo-curto">
            Forma
            <select value={forma} onChange={(e) => setForma(e.target.value)}>
              <option>PIX</option>
              <option>Dinheiro</option>
              <option>Depósito</option>
            </select>
          </label>
          <button type="submit" className="botao" disabled={enviando}>
            Receber o pagamento ({valor})
          </button>
        </form>
      )}
    </li>
  )
}
