import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarIgrejas } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { DOCUMENTOS_ESSENCIAIS, documentosParaConferir, NOME_DO_DOCUMENTO, resumoDasIgrejas, type ResumoIgreja } from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto, formatarDataDeInstante } from '../../utilitarios/formatos'

/** A busca do topo abre esta lista já filtrada (?busca=…); cada busca nova recomeça a tela. */
export function ListaIgrejas() {
  const [parametros] = useSearchParams()
  const busca = parametros.get('busca') ?? ''
  return <ConteudoListaIgrejas key={busca} buscaInicial={busca} />
}

function ConteudoListaIgrejas({ buscaInicial }: { buscaInicial: string }) {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(async () => {
    const [igrejas, resumo, conferir] = await Promise.all([listarIgrejas(), resumoDasIgrejas(), documentosParaConferir()])
    if (igrejas.erro !== null) return igrejas
    return ok({
      igrejas: igrejas.dados,
      // só a secretaria e a presidência veem o resumo e os documentos; para os outros perfis, fica sem
      resumo: new Map((resumo.erro === null ? resumo.dados : []).map((r) => [r.igreja_id, r])),
      conferir: conferir.erro === null ? conferir.dados : [],
    })
  })
  const [busca, setBusca] = useState(buscaInicial)

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
        {({ igrejas, resumo, conferir }) => {
          const filtradas = igrejas.filter(
            (i) =>
              contemTexto(i.nome, busca) ||
              contemTexto(i.denominacao?.nome, busca) ||
              contemTexto(i.denominacao?.sigla, busca) ||
              contemTexto(i.bairro?.nome, busca),
          )
          return (
            <>
              {conferir.length > 0 && (
                <section className="painel" aria-labelledby="titulo-docs-conferir">
                  <h2 id="titulo-docs-conferir">Documentos das igrejas para conferir ({conferir.length})</h2>
                  <ul className="lista" aria-label="Documentos para conferir">
                    {conferir.map((d) => (
                      <li key={d.id}>
                        <Link to={`/igrejas/${d.igreja_id}`} className="lista-item">
                          <strong>{d.igreja?.nome ?? 'Igreja'}</strong>
                          <span>
                            {d.tipo === 'outro' ? d.descricao : NOME_DO_DOCUMENTO[d.tipo]} · enviado em {formatarDataDeInstante(d.criado_em)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
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
                        {resumo.get(i.id) && <ResumoDaIgreja r={resumo.get(i.id)!} />}
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

/** O peso da igreja (ministros associados) e a situação dos documentos e da diretoria. */
function ResumoDaIgreja({ r }: { r: ResumoIgreja }) {
  const docs = DOCUMENTOS_ESSENCIAIS.filter((t) => r.documentos_ok.includes(t)).length
  return (
    <span className="detalhe">
      {r.ministros} {r.ministros === 1 ? 'ministro associado' : 'ministros associados'} ({r.ministros_em_dia} em dia) · documentos{' '}
      {docs}/{DOCUMENTOS_ESSENCIAIS.length}
      {r.documentos_pendentes > 0 && ` (${r.documentos_pendentes} para conferir)`} · {r.diretoria ? 'diretoria informada' : 'sem diretoria'}
    </span>
  )
}
