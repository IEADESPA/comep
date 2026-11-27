import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Ladrilho } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Selo } from '../../componentes/Telas'
import { arquivarIgreja, buscarIgreja, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import {
  ativarIgreja,
  conferenciaDaIgrejaNova,
  conferirItemIgreja,
  documentosParaConferir,
  igrejasEmAnalise,
  itensDaAnalise,
  listarDiretoriaIgreja,
  listarDocumentosIgreja,
  NOME_DA_NATUREZA,
  NOME_DO_DOCUMENTO,
  NOME_DO_ITEM_ANALISE,
  DOCUMENTOS_DA_REGULARIDADE,
  type ConferenciaItem,
  type DocumentoIgreja,
  type ItemAnalise,
  type MembroDiretoriaIgreja,
} from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { useRegrasDasIgrejas } from '../../estado/useRegrasDasIgrejas'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarCnpj, formatarData, formatarDataDeInstante } from '../../utilitarios/formatos'
import { ProgressoConferencia } from '../inscricoes/Inscricoes'
import { LinhaDocumento, type Concluir } from './componentes'
import { resumoDoDocumento } from './regras'

// Igrejas › Para conferir (aprovado na rodada 8 e na rodada 9, 18/11/2026):
//   * as igrejas novas, cadastradas pelos próprios pastores, que a secretaria confere item por item;
//   * os documentos que os pastores presidentes mandaram pela "Minha igreja" (conferido, entra; recusado, volta com o motivo).

type Retorno = { sucesso?: string; erro?: string }

/** /igrejas/conferir */
export function ParaConferir() {
  const location = useLocation()
  const [retorno, setRetorno] = useState<Retorno>({ sucesso: (location.state as { mensagem?: string } | null)?.mensagem })
  const [carga, recarregar] = useCarregar(async () => {
    const [novas, docs] = await Promise.all([igrejasEmAnalise(), documentosParaConferir()])
    if (novas.erro !== null) return novas
    if (docs.erro !== null) return docs
    // os documentos da igreja nova se conferem na análise dela
    return ok({ novas: novas.dados, docs: docs.dados.filter((d) => d.igreja?.cadastro !== 'em_analise') })
  })
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Igrejas"
        titulo="Para conferir"
        sub='O que os pastores mandaram: a igreja nova, cadastrada por eles, e os documentos da "Minha igreja". Conferido, entra; recusado, volta com o motivo.'
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ novas, docs }) => (
          <>
            <section className="bloco" aria-labelledby="titulo-novas">
              <h2 id="titulo-novas">Igrejas novas ({novas.length})</h2>
              {novas.length === 0 ? (
                <p className="vazio">Nenhuma igreja nova esperando a conferência.</p>
              ) : (
                <ul className="lista-linhas" aria-label="Igrejas novas">
                  {novas.map((i) => {
                    const c = conferenciaDaIgrejaNova(i.itens, i.documentos)
                    return (
                      <li key={i.id}>
                        <Ladrilho area="pessoas" icone="igreja" tamanho={36} />
                        <Link to={`/igrejas/conferir/${i.id}`} className="linha-corpo linha-link">
                          <strong>{i.nome}</strong>
                          <span>
                            cadastrada por {i.presidente_nome ?? 'um pastor'} em {formatarDataDeInstante(i.criado_em)}
                          </span>
                        </Link>
                        <ProgressoConferencia feitos={c.aprovados} total={c.total} />
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <section className="bloco" aria-labelledby="titulo-docs">
              <h2 id="titulo-docs">Documentos das igrejas ({docs.length})</h2>
              {docs.length === 0 ? (
                <p className="vazio">Nenhum documento esperando a conferência.</p>
              ) : (
                <ul className="lista-linhas" aria-label="Documentos para conferir">
                  {docs.map((d) => (
                    <LinhaComIgreja key={d.id} d={d} igreja={d.igreja?.nome ?? 'Igreja'} concluir={concluir} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </MostrarCarga>
    </div>
  )
}

function LinhaComIgreja({ d, igreja, concluir }: { d: DocumentoIgreja; igreja: string; concluir: Concluir }) {
  return (
    <>
      <li className="linha-titulo-igreja">
        <Link to={`/igrejas/${d.igreja_id}/documentos`}>{igreja}</Link>
      </li>
      <LinhaDocumento d={d} podeConferir aoConcluir={concluir} />
    </>
  )
}

// ---------------------------------------------------------------------
// A igreja nova, conferida item por item (rodada 9, telaAnaliseIgr)
// ---------------------------------------------------------------------

/** /igrejas/conferir/:id */
export function AnaliseIgreja() {
  const { id = '' } = useParams()
  return <Analise key={id} id={id} />
}

type DadosAnalise = { igreja: Igreja | null; itens: ConferenciaItem[]; documentos: DocumentoIgreja[]; diretoria: MembroDiretoriaIgreja[] }

function Analise({ id }: { id: string }) {
  const navigate = useNavigate()
  const [retorno, setRetorno] = useState<Retorno>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [igreja, itens, documentos, diretoria] = await Promise.all([buscarIgreja(id), itensDaAnalise(id), listarDocumentosIgreja(id), listarDiretoriaIgreja(id)])
    if (igreja.erro !== null) return igreja
    if (itens.erro !== null) return itens
    if (documentos.erro !== null) return documentos
    if (diretoria.erro !== null) return diretoria
    return ok<DadosAnalise>({ igreja: igreja.dados, itens: itens.dados, documentos: documentos.dados, diretoria: diretoria.dados })
  })
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  const [ativando, umaVez] = useUmaVez()
  const regras = useRegrasDasIgrejas()

  return (
    <div className="tela-nova">
      <p className="trilha">
        <Link to="/igrejas/conferir">← Para conferir</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ igreja, itens, documentos, diretoria }) => {
          if (!igreja) {
            return (
              <Aviso titulo="Igreja não encontrada">
                <p>Ela pode ter sido arquivada.</p>
              </Aviso>
            )
          }
          if (igreja.cadastro !== 'em_analise') {
            return (
              <Aviso titulo="Esta igreja já não está em análise">
                <p>
                  <Link to={`/igrejas/${igreja.id}`}>Abrir a ficha da igreja</Link>
                </p>
              </Aviso>
            )
          }
          const conferencia = conferenciaDaIgrejaNova(itens, documentos)
          const ultimo = (tipo: DocumentoIgreja['tipo']) => documentos.find((d) => d.tipo === tipo)
          const ata = ultimo('ata_diretoria')
          const daAta = ata ? diretoria.filter((m) => m.documento_id === ata.id) : []
          const detalhe: Record<ItemAnalise, string> = {
            dados: [
              igreja.sigla ? `${igreja.nome} (${igreja.sigla})` : igreja.nome,
              igreja.denominacao?.nome,
              igreja.cnpj && `CNPJ ${formatarCnpj(igreja.cnpj)}`,
              igreja.natureza_juridica && NOME_DA_NATUREZA[igreja.natureza_juridica],
              igreja.fundada_em && `fundada em ${igreja.fundada_em}`,
              igreja.membros && `cerca de ${igreja.membros} membros`,
            ]
              .filter(Boolean)
              .join(' · '),
            endereco:
              [igreja.endereco, igreja.bairro?.nome, igreja.cep && `CEP ${igreja.cep}`, igreja.telefone, igreja.email, igreja.site, igreja.convencao]
                .filter(Boolean)
                .join(' · ') || 'não informado',
            diretoria:
              daAta.length > 0
                ? `${daAta.map((m) => `${m.cargo}: ${m.nome}`).join(' · ')} · mandato até ${formatarData(ata?.valido_ate)}`
                : 'falta mandar a ata com a diretoria',
          }
          return (
            <>
              <section className="cabecalho-analise" aria-label="A igreja nova">
                <Ladrilho area="pessoas" icone="igreja" tamanho={52} />
                <span className="cabecalho-analise-texto">
                  <span className="cabecalho-ficha-modulo">Igrejas › Para conferir</span>
                  <h1>{igreja.nome}</h1>
                  <span className="sub-tela">
                    cadastro enviado por {igreja.presidente_nome ?? 'um pastor'} em {formatarDataDeInstante(igreja.criado_em)}
                  </span>
                </span>
                <span className="cabecalho-analise-lado">
                  <ProgressoConferencia feitos={conferencia.aprovados} total={conferencia.total} />
                </span>
              </section>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
              <div className="analise-colunas">
                <section aria-labelledby="titulo-itens-igreja" className="aba-conteudo">
                  <h2 id="titulo-itens-igreja" className="titulo-secao">
                    Confira item por item
                  </h2>
                  <ul className="bloco lista-linhas lista-itens-pedido" aria-labelledby="titulo-itens-igreja">
                    {(Object.keys(NOME_DO_ITEM_ANALISE) as ItemAnalise[]).map((item) => (
                      <ItemDaIgreja
                        key={item}
                        igrejaId={igreja.id}
                        item={item}
                        conferido={itens.find((i) => i.item === item)}
                        detalhe={detalhe[item]}
                        concluir={concluir}
                      />
                    ))}
                    {DOCUMENTOS_DA_REGULARIDADE.map((tipo) => {
                      const d = ultimo(tipo)
                      if (!d) {
                        return (
                          <li key={tipo} aria-label={NOME_DO_DOCUMENTO[tipo]}>
                            <span className="linha-corpo">
                              <strong>{NOME_DO_DOCUMENTO[tipo]}</strong>
                              <span>
                                {tipo === 'alvara'
                                  ? `ainda não veio: a igreja pode entrar e mandar depois (${regras.dias_para_mandar} dias, da ativação, ou fica suspensa)`
                                  : 'ainda não veio: o pastor precisa mandar'}
                              </span>
                            </span>
                          </li>
                        )
                      }
                      return <LinhaDocumento key={tipo} d={d} podeConferir aoConcluir={concluir} />
                    })}
                  </ul>
                </section>
                <div className="coluna-atalhos">
                  <section className="bloco" aria-labelledby="titulo-entrar">
                    <h2 id="titulo-entrar">Para a igreja entrar</h2>
                    <p className="detalhe">
                      Com os {conferencia.total} itens aprovados, o botão se libera. Ativada, a igreja fica regular e o pastor que cadastrou vira
                      o pastor presidente dela.
                    </p>
                    <button
                      type="button"
                      className="botao botao-cheio"
                      disabled={!conferencia.tudo || ativando}
                      onClick={() =>
                        void umaVez(async () => {
                          const r = await ativarIgreja(igreja.id)
                          if (r.erro !== null) return setRetorno({ erro: r.erro })
                          navigate(`/igrejas/${igreja.id}`, { replace: true, state: { mensagem: `${igreja.nome}: igreja ativada no COMEP.` } })
                        })
                      }
                    >
                      Ativar a igreja
                    </button>
                    <p className="detalhe">Recusou um item? Ele volta para o pastor com o motivo, e só aquele item é enviado de novo.</p>
                  </section>
                  {ata && (
                    <section className="bloco">
                      <h2>A ata</h2>
                      <p className="detalhe">{resumoDoDocumento(ata)}</p>
                    </section>
                  )}
                  <section className="bloco" aria-labelledby="titulo-recusar-cadastro">
                    <h2 id="titulo-recusar-cadastro">Recusar o cadastro</h2>
                    <p className="detalhe">
                      Para quando a igreja não vai entrar (cadastro repetido, de outra cidade…). Nada se apaga: o cadastro é arquivado. Avise o
                      pastor do motivo.
                    </p>
                    <BotaoConfirmar
                      texto="Recusar o cadastro"
                      confirmar="Confirmar: recusar e arquivar"
                      aviso={`Recusar o cadastro de "${igreja.nome}"?`}
                      desabilitado={ativando}
                      aoConfirmar={() =>
                        void umaVez(async () => {
                          const r = await arquivarIgreja(igreja.id)
                          if (r.erro !== null) return setRetorno({ erro: r.erro })
                          navigate('/igrejas/conferir', { replace: true, state: { mensagem: `Cadastro de "${igreja.nome}" recusado e arquivado.` } })
                        })
                      }
                    />
                  </section>
                </div>
              </div>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function ItemDaIgreja({
  igrejaId,
  item,
  conferido,
  detalhe,
  concluir,
}: {
  igrejaId: string
  item: ItemAnalise
  conferido: ConferenciaItem | undefined
  detalhe: string
  concluir: Concluir
}) {
  const nome = NOME_DO_ITEM_ANALISE[item]
  const situacao = conferido?.situacao ?? 'analise'
  const [mudando, setMudando] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const decidindo = situacao === 'analise' || mudando
  const decidir = (aprovar: boolean) =>
    umaVez(async () => {
      const r = await conferirItemIgreja(igrejaId, item, aprovar, aprovar ? '' : motivo)
      concluir(r, aprovar ? `${nome}: aprovado.` : `${nome}: recusado.`)
      if (r.erro === null) {
        setMudando(false)
        setRecusando(false)
        setMotivo('')
      }
    })
  return (
    <li aria-label={nome}>
      <span className="linha-corpo">
        <strong>{nome}</strong>
        <span>{detalhe}</span>
        {!decidindo && (
          <span className="linha-selo">
            <Selo tipo={situacao === 'aprovado' ? 'aprovado' : 'recusado'}>
              {situacao === 'aprovado' ? 'Aprovado' : `Recusado: ${conferido?.motivo ?? ''}`}
            </Selo>
            <button type="button" className="botao-link" onClick={() => setMudando(true)}>
              Mudar
            </button>
          </span>
        )}
        {decidindo && !recusando && (
          <span className="acoes-item">
            <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => setRecusando(true)}>
              Recusar
            </button>
            <button type="button" className="botao" disabled={enviando} onClick={() => void decidir(true)}>
              Aprovar
            </button>
          </span>
        )}
        {decidindo && recusando && (
          <form
            className="form-linha form-compacto"
            aria-label={`Recusar: ${nome}`}
            onSubmit={(e) => {
              e.preventDefault()
              void decidir(false)
            }}
          >
            <label>
              Motivo *
              <input required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: falta o bairro" />
            </label>
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Recusar o item
            </button>
            <button type="button" className="botao-texto" onClick={() => setRecusando(false)}>
              Cancelar
            </button>
          </form>
        )}
      </span>
    </li>
  )
}
