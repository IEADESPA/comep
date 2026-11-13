import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados, NOME_DA_SITUACAO } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import { listarPendencias } from '../../dados/credencial'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto } from '../../utilitarios/formatos'
import { TrocasPendentes } from './TrocasPendentes'

export function ListaMinistros() {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(async () => {
    const [associados, pendencias] = await Promise.all([listarAssociados(), listarPendencias()])
    if (associados.erro !== null) return associados
    if (pendencias.erro !== null) return pendencias
    return ok({ associados: associados.dados, pendencias: new Map(pendencias.dados.map((p) => [p.pessoa_id, p.pendencias])) })
  })
  const [busca, setBusca] = useState('')
  const [soPendencia, setSoPendencia] = useState(false)

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
        {({ associados, pendencias }) => {
          const filtrados = associados.filter(
            (a) =>
              (!soPendencia || (pendencias.get(a.pessoa_id)?.length ?? 0) > 0) &&
              (contemTexto(a.nome, busca) ||
                contemTexto(a.igreja, busca) ||
                contemTexto(a.titulo, busca) ||
                String(a.numero_registro) === busca.trim()),
          )
          const comPendencia = associados.filter((a) => (pendencias.get(a.pessoa_id)?.length ?? 0) > 0).length
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
              <label className="caixa-marcar">
                <input type="checkbox" checked={soPendencia} onChange={(e) => setSoPendencia(e.target.checked)} />
                Só com pendência na credencial ({comPendencia})
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
                          {(pendencias.get(a.pessoa_id)?.length ?? 0) > 0 && (
                            <span className="etiqueta etiqueta-atraso" title={pendencias.get(a.pessoa_id)?.join(', ')}>
                              Credencial: {pendencias.get(a.pessoa_id)?.length} pendência(s)
                            </span>
                          )}
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
