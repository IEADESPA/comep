import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarIgrejas } from '../../dados/cadastros'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto } from '../../utilitarios/formatos'

export function ListaIgrejas() {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarIgrejas)
  const [busca, setBusca] = useState('')

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Igrejas</h1>
        <Link to="/igrejas/nova" className="botao">
          Nova igreja
        </Link>
      </div>
      <Mensagem sucesso={mensagem} />

      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(igrejas) => {
          const filtradas = igrejas.filter(
            (i) =>
              contemTexto(i.nome, busca) ||
              contemTexto(i.denominacao?.nome, busca) ||
              contemTexto(i.denominacao?.sigla, busca) ||
              contemTexto(i.bairro?.nome, busca),
          )
          return (
            <>
              <label className="busca">
                Buscar igreja
                <input
                  type="search"
                  placeholder="Nome, denominação ou bairro"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              <p className="detalhe">
                {filtradas.length === igrejas.length
                  ? `${igrejas.length} igreja(s) cadastrada(s)`
                  : `${filtradas.length} de ${igrejas.length} igreja(s)`}
              </p>
              {filtradas.length === 0 ? (
                <p className="vazio">Nenhuma igreja encontrada.</p>
              ) : (
                <ul className="lista" aria-label="Igrejas">
                  {filtradas.map((i) => (
                    <li key={i.id}>
                      <Link to={`/igrejas/${i.id}`} className="lista-item">
                        <strong>{i.nome}</strong>
                        <span>
                          {[i.denominacao?.sigla || i.denominacao?.nome, i.bairro?.nome].filter(Boolean).join(' · ') ||
                            'Denominação não informada'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </MostrarCarga>

      <p className="detalhe">
        As listas de denominações e de bairros ficam em <Link to="/configuracoes">Configurações</Link>.
      </p>
    </>
  )
}
