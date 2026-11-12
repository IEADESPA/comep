import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados, NOME_DA_SITUACAO } from '../../dados/associados'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto } from '../../utilitarios/formatos'
import { TrocasPendentes } from './TrocasPendentes'

export function ListaMinistros() {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarAssociados)
  const [busca, setBusca] = useState('')

  return (
    <>
      <div className="cabecalho-tela">
        <h1>Ministros</h1>
        <Link to="/ministros/novo" className="botao">
          Cadastrar associado
        </Link>
      </div>
      <Mensagem sucesso={mensagem} />
      <TrocasPendentes />

      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(associados) => {
          const filtrados = associados.filter(
            (a) =>
              contemTexto(a.nome, busca) ||
              contemTexto(a.igreja, busca) ||
              contemTexto(a.titulo, busca) ||
              String(a.numero_registro) === busca.trim(),
          )
          return (
            <>
              <label className="busca">
                Buscar associado
                <input
                  type="search"
                  placeholder="Nome, igreja, título ou nº de registro"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              <p className="detalhe">
                {filtrados.length === associados.length
                  ? `${associados.length} associado(s)`
                  : `${filtrados.length} de ${associados.length} associado(s)`}
              </p>
              {filtrados.length === 0 ? (
                <p className="vazio">Nenhum associado encontrado.</p>
              ) : (
                <ul className="lista" aria-label="Associados">
                  {filtrados.map((a) => (
                    <li key={a.id}>
                      <Link to={`/ministros/${a.pessoa_id}`} className="lista-item">
                        <strong>
                          <span className="numero">Nº {a.numero_registro}</span> {a.nome}
                        </strong>
                        <span>{[a.titulo, a.igreja].filter(Boolean).join(' · ')}</span>
                        <span className="etiquetas">
                          {a.situacao !== 'ativo' && <span className="etiqueta">{NOME_DA_SITUACAO[a.situacao]}</span>}
                          {!a.tem_login && <span className="etiqueta etiqueta-neutra">Sem login</span>}
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
    </>
  )
}
