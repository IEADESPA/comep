import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import type { NivelIgreja } from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto, hojeIso } from '../../utilitarios/formatos'
import { diasEntre } from '../../utilitarios/regularizacao'
import { NumerosGrandes, SeloNivel } from './componentes'
import { carregarIgrejasComSituacao, descreverSituacao, type LinhaIgreja } from './regras'

// Módulo Igrejas (aprovado na rodada 12, 18/11/2026):
//   * /igrejas: o painel (opção 3) — os números grandes, quem precisa de atenção e quem chamar para perto;
//   * /igrejas/lista e as subfunções Regulares, Suspensas e Sem registro: a tabela com a situação (opção 1).

const nivel = (l: LinhaIgreja): NivelIgreja => l.s?.situacao.situacao ?? 'regular'

function numerosDe(linhas: LinhaIgreja[]) {
  return [
    { rotulo: 'Regulares', valor: linhas.filter((l) => nivel(l) === 'regular').length, area: 'financas' as const },
    { rotulo: 'Suspensas', valor: linhas.filter((l) => nivel(l) === 'suspensa').length, area: 'pessoas' as const },
    { rotulo: 'Sem registro', valor: linhas.filter((l) => nivel(l) === 'sem_registro').length, area: 'assembleias' as const },
    { rotulo: 'Congregações e filiais', valor: linhas.reduce((n, l) => n + (l.s?.filiais ?? 0), 0), area: 'eventos' as const },
  ]
}

/** /igrejas — o painel do módulo. */
export function PainelIgrejas() {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(carregarIgrejasComSituacao)
  const hoje = hojeIso()
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Igrejas"
        titulo="Todas as igrejas"
        acoes={
          <Link to="/igrejas/nova" className="botao botao-com-icone so-computador">
            <Icone nome="mais" tamanho={18} />
            Cadastrar igreja
          </Link>
        }
      />
      <Mensagem sucesso={mensagem} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(linhas) => {
          const suspensas = linhas.filter((l) => nivel(l) === 'suspensa')
          const semRegistro = linhas.filter((l) => nivel(l) === 'sem_registro')
          const vencendo = linhas.filter((l) => {
            const v = l.s?.situacao.proximo_vencimento
            return nivel(l) === 'regular' && v && diasEntre(hoje, v) <= 60
          })
          return (
            <>
              <NumerosGrandes itens={numerosDe(linhas)} />
              <div className="dois-blocos">
                <section className="bloco" aria-labelledby="titulo-atencao">
                  <h2 id="titulo-atencao">Precisam de atenção</h2>
                  {suspensas.length === 0 && vencendo.length === 0 ? (
                    <p className="vazio">Nenhuma igreja suspensa e nada vencendo nos próximos 60 dias.</p>
                  ) : (
                    <ul className="lista-linhas" aria-label="Igrejas que precisam de atenção">
                      {suspensas.map((l) => (
                        <li key={l.id}>
                          <SeloNivel nivel="suspensa" />
                          <Link to={`/igrejas/${l.id}/situacao`} className="linha-corpo linha-link">
                            <strong>{l.nome}</strong>
                            <span>{descreverSituacao(l.s!.situacao, hoje)}</span>
                          </Link>
                        </li>
                      ))}
                      {vencendo.length > 0 && (
                        <li>
                          <span className="chip area-eventos">60 dias</span>
                          <Link to="/igrejas/regularizacao" className="linha-corpo linha-link">
                            <strong>
                              {vencendo.length === 1 ? '1 igreja tem documento' : `${vencendo.length} igrejas têm documento`} vencendo nos
                              próximos 60 dias
                            </strong>
                            <span>Os avisos vão ao pastor presidente; a responsabilidade é dele.</span>
                          </Link>
                        </li>
                      )}
                    </ul>
                  )}
                </section>
                <section className="bloco" aria-labelledby="titulo-perto">
                  <h2 id="titulo-perto">Sem registro: chamar para perto</h2>
                  {semRegistro.length === 0 ? (
                    <p className="vazio">Nenhuma igreja sem registro.</p>
                  ) : (
                    <ul className="lista-linhas" aria-label="Igrejas sem registro">
                      {semRegistro.map((l) => (
                        <li key={l.id}>
                          <Link to={`/igrejas/${l.id}/situacao`} className="linha-corpo linha-link">
                            <strong>{l.nome}</strong>
                            <span>{[l.denominacao?.nome, l.telefone, l.presidente_nome].filter(Boolean).join(' · ')}</span>
                          </Link>
                          <Icone nome="seta" tamanho={18} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="detalhe">
                    O COMEP chama para perto, para ver o que falta e ajudar a regularizar. Acompanhe pela{' '}
                    <Link to="/igrejas/regularizacao">Central de regularização</Link>.
                  </p>
                </section>
              </div>
              <p className="detalhe">
                <Link to="/igrejas/lista">Ver todas as igrejas na tabela</Link>
              </p>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

const FILTROS: Record<string, { titulo: string; nivel: NivelIgreja | null }> = {
  todas: { titulo: 'Todas as igrejas', nivel: null },
  regulares: { titulo: 'Regulares', nivel: 'regular' },
  suspensas: { titulo: 'Suspensas', nivel: 'suspensa' },
  'sem-registro': { titulo: 'Sem registro', nivel: 'sem_registro' },
}

/** /igrejas/lista e /igrejas/lista/:filtro — a tabela. A busca do topo abre aqui já filtrada (?busca=…). */
export function TabelaIgrejas() {
  const [parametros] = useSearchParams()
  const { filtro = 'todas' } = useParams()
  const busca = parametros.get('busca') ?? ''
  return <ConteudoTabela key={`${filtro}-${busca}`} filtro={FILTROS[filtro] ? filtro : 'todas'} buscaInicial={busca} />
}

function ConteudoTabela({ filtro, buscaInicial }: { filtro: string; buscaInicial: string }) {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(carregarIgrejasComSituacao)
  const [busca, setBusca] = useState(buscaInicial)
  const hoje = hojeIso()
  const { titulo, nivel: nivelDoFiltro } = FILTROS[filtro]
  return (
    <div className="tela-nova">
      <CabecalhoFuncao modulo="Igrejas" titulo={titulo} />
      <Mensagem sucesso={mensagem} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(linhas) => {
          const termo = busca.trim()
          const visiveis = linhas
            .filter((l) => nivelDoFiltro === null || nivel(l) === nivelDoFiltro)
            .filter((l) => contemTexto(l.nome, termo) || contemTexto(l.denominacao?.nome, termo) || contemTexto(l.bairro?.nome, termo) || contemTexto(l.sigla, termo))
          return (
            <>
              <ul className="chips numeros-chips" aria-label="Os números das igrejas">
                {numerosDe(linhas).map((n) => (
                  <li key={n.rotulo} className={`chip area-${n.area}`}>
                    <strong>{n.valor}</strong> {n.rotulo}
                  </li>
                ))}
              </ul>
              <label className="campo-busca">
                <Icone nome="busca" tamanho={18} />
                <input
                  type="search"
                  aria-label="Buscar igreja"
                  placeholder="Buscar igreja, denominação ou bairro"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </label>
              {visiveis.length === 0 ? (
                <p className="vazio">Nenhuma igreja encontrada.</p>
              ) : (
                <div className="tabela-igrejas">
                  <div className="tabela-igrejas-cabecalho so-computador" aria-hidden="true">
                    <span>Igreja</span>
                    <span>Denominação</span>
                    <span>Situação</span>
                    <span>Documentos</span>
                    <span>Filiais</span>
                  </div>
                  <ul aria-label="Igrejas">
                    {visiveis.map((l) => (
                      <li key={l.id}>
                        <Link to={`/igrejas/${l.id}`} className="linha-igreja">
                          <span className="linha-igreja-nome">
                            <strong>{l.nome}</strong>
                            <span className="so-celular">{l.denominacao?.nome ?? 'Denominação não informada'}</span>
                          </span>
                          <span className="so-computador">{l.denominacao?.nome ?? '—'}</span>
                          <span>
                            <SeloNivel nivel={nivel(l)} />
                          </span>
                          <span className={nivel(l) === 'suspensa' ? 'linha-igreja-docs texto-perigo' : 'linha-igreja-docs'}>
                            {l.s ? descreverSituacao(l.s.situacao, hoje) : '—'}
                          </span>
                          <span className="so-computador">{l.s?.filiais ?? 0}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="detalhe">
                Regular: estatuto, Cartão CNPJ como organização religiosa, ata da diretoria em dia e alvará válido. Venceu a ata ou o
                alvará, a igreja fica suspensa no mesmo dia.
              </p>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}
