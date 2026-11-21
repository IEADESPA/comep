import { Link } from 'react-router'
import { quandoFoi } from '../utilitarios/formatos'
import { Ladrilho } from './Icone'
import type { Sino } from './useSino'

// O sino do topo (aprovado: "painel que desce do sino"). Desde a parte 11, os avisos vêm da tabela de notificações,
// com o lido guardado por pessoa no banco (useSino.ts).

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
            const corpo = (
              <>
                <Ladrilho area={a.area} icone={a.icone} tamanho={38} />
                <span className="aviso-linha-corpo">
                  <span className="aviso-linha-topo">
                    <strong>{a.titulo}</strong>
                    <span>{quandoFoi(a.quando)}</span>
                  </span>
                  <span className="aviso-linha-texto">{a.texto}</span>
                  {a.de && <span className="aviso-linha-de">Mandado por {a.de}</span>}
                </span>
                {novo && <span className="ponto-nao-lido" aria-label="não lido" role="img" />}
              </>
            )
            return (
              <li key={a.chave}>
                {a.para ? (
                  <Link
                    to={a.para}
                    className="aviso-linha"
                    onClick={() => {
                      sino.marcarLido(a.chave)
                      fechar()
                    }}
                  >
                    {corpo}
                  </Link>
                ) : (
                  <button type="button" className="aviso-linha" onClick={() => sino.marcarLido(a.chave)}>
                    {corpo}
                  </button>
                )}
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
