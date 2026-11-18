import { Link } from 'react-router'
import { quandoFoi } from '../utilitarios/formatos'
import { Ladrilho } from './Icone'
import type { Sino } from './useSino'

// O sino do topo (aprovado: "painel que desce do sino"). Os avisos são montados com o que o sistema já tem
// (src/estado/resumos.ts); o que já foi lido fica guardado no aparelho (useSino.ts).

/** O painel que desce do sino (no celular, ocupa a largura logo abaixo da barra vermelha). */
export function PainelAvisos({ sino, veMural, fechar }: { sino: Sino; veMural: boolean; fechar: () => void }) {
  return (
    <section id="painel-avisos" className="painel-flutuante" aria-labelledby="titulo-painel-avisos">
      <div className="painel-avisos-cabecalho">
        <h2 id="titulo-painel-avisos">Avisos</h2>
        {sino.naoLidos > 0 && (
          <button type="button" className="botao-link" onClick={sino.marcarTodos}>
            Marcar todos como lidos
          </button>
        )}
      </div>
      {!sino.carregado ? (
        <p className="painel-avisos-vazio">Carregando…</p>
      ) : sino.itens.length === 0 ? (
        <p className="painel-avisos-vazio">Nenhum aviso por enquanto.</p>
      ) : (
        <ul className="lista-avisos" aria-label="Avisos para você">
          {sino.itens.map((a) => {
            const novo = !sino.lidos.has(a.chave)
            return (
              <li key={a.chave}>
                <Link
                  to={a.para}
                  className="aviso-linha"
                  onClick={() => {
                    sino.marcarLido(a.chave)
                    fechar()
                  }}
                >
                  <Ladrilho area={a.area} icone={a.icone} tamanho={38} />
                  <span className="aviso-linha-corpo">
                    <span className="aviso-linha-topo">
                      <strong>{a.titulo}</strong>
                      <span>{quandoFoi(a.quando)}</span>
                    </span>
                    <span className="aviso-linha-texto">{a.texto}</span>
                  </span>
                  {novo && <span className="ponto-nao-lido" aria-label="não lido" role="img" />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      {veMural && (
        <Link to="/avisos" className="painel-avisos-rodape" onClick={fechar}>
          Ver o mural de avisos
        </Link>
      )}
    </section>
  )
}
