import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Selo, type TipoSelo } from '../../componentes/Telas'
import { listarIgrejas, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import {
  aprovarPedido,
  buscarPedido,
  conferirItemPedido,
  devolverComPendencia,
  encaminharParaAssembleia,
  ITENS_DO_PEDIDO,
  linkDoArquivo,
  listarPedidos,
  recusarPedido,
  type ItemPedido,
  type Pedido,
  type SituacaoPedido,
} from '../../dados/pedidos'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataHora, hojeIso, iniciaisDe } from '../../utilitarios/formatos'
import { PassosDoPedido } from '../pedido/PassosDoPedido'

// Módulo "Ministros e inscrições" › Pedidos de associação (aprovado em 18/11/2026): os filtros em pílulas,
// cada pedido com a barra "x de N conferidos" e o selo da situação.

const GRUPOS: { titulo: string; situacoes: SituacaoPedido[] }[] = [
  { titulo: 'Em análise', situacoes: ['enviado'] },
  { titulo: 'Com pendência', situacoes: ['pendencia'] },
  { titulo: 'Esperando a AGO', situacoes: ['aguardando_assembleia'] },
  { titulo: 'Concluídos', situacoes: ['aprovado', 'recusado', 'desistiu'] },
]

const igrejaDoPedido = (p: Pedido) =>
  p.igreja?.nome ?? (p.igreja_informada ? `${p.igreja_informada} (não cadastrada)` : 'Igreja não informada')

/** O selo da situação do pedido (o mesmo selo da secretaria do "Meu pedido"). */
const SELO_DO_PEDIDO: Record<SituacaoPedido, { tipo: TipoSelo; texto: string }> = {
  enviado: { tipo: 'analise', texto: 'Em análise' },
  pendencia: { tipo: 'recusado', texto: 'Devolvido com pendência' },
  aguardando_assembleia: { tipo: 'aprovado', texto: 'Esperando a AGO' },
  aprovado: { tipo: 'aprovado', texto: 'Aprovado na AGO' },
  recusado: { tipo: 'recusado', texto: 'Recusado' },
  desistiu: { tipo: 'recusado', texto: 'Desistiu' },
}

/** O que a secretaria já aprovou: os dados pessoais, a igreja e o título, a foto 3×4 e o comprovante. */
function conferidos(p: Pedido): { feitos: number; total: number } {
  return { feitos: p.itens.filter((i) => i.situacao === 'aprovado').length, total: ITENS_DO_PEDIDO.length }
}

export function ProgressoConferencia({ feitos, total }: { feitos: number; total: number }) {
  return (
    <span className={feitos === total ? 'progresso-conferencia completo' : 'progresso-conferencia'}>
      <span>
        {feitos} de {total} conferidos
      </span>
      <span className="progresso-conferencia-barra" aria-hidden="true">
        <span style={{ width: `${Math.round((feitos * 100) / total)}%` }} />
      </span>
    </span>
  )
}

/** /inscricoes — pedidos de associação para a secretaria e a presidência. */
export function ListaInscricoes() {
  const [carga, recarregar] = useCarregar(listarPedidos)
  const [grupo, setGrupo] = useState(0)

  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Ministros e inscrições"
        titulo="Pedidos de associação"
        sub="Pedidos de associação (Art. 7º): a secretaria confere, um diretor aceita a ficha e o pedido vai para a Assembleia Ordinária, que decide."
      />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pedidos) => {
          const doGrupo = pedidos.filter((p) => GRUPOS[grupo].situacoes.includes(p.situacao))
          return (
            <>
              <div className="pilulas" role="group" aria-label="Situação dos pedidos">
                {GRUPOS.map((g, i) => (
                  <button
                    key={g.titulo}
                    type="button"
                    className={grupo === i ? 'pilula ativa' : 'pilula'}
                    aria-pressed={grupo === i}
                    onClick={() => setGrupo(i)}
                  >
                    {g.titulo} <strong>{pedidos.filter((p) => g.situacoes.includes(p.situacao)).length}</strong>
                  </button>
                ))}
              </div>
              {doGrupo.length === 0 ? (
                <p className="vazio">Nenhum pedido aqui.</p>
              ) : (
                <ul className="lista-pedidos" aria-label="Pedidos">
                  {doGrupo.map((p) => {
                    const selo = SELO_DO_PEDIDO[p.situacao]
                    const encerrado = p.situacao === 'aprovado' || p.situacao === 'recusado' || p.situacao === 'desistiu'
                    return (
                      <li key={p.id}>
                        <Link to={`/inscricoes/${p.id}`} className="linha-pedido">
                          <span className="linha-pedido-texto">
                            <strong>{p.pessoa?.nome}</strong>
                            <span>
                              {[p.titulo?.nome, igrejaDoPedido(p)].filter(Boolean).join(' · ')}
                              {p.enviado_em && ` · enviado em ${formatarData(p.enviado_em)}`}
                            </span>
                            <span className="so-celular">
                              <Selo tipo={selo.tipo}>{selo.texto}</Selo>
                            </span>
                          </span>
                          {!encerrado && (
                            <span className="so-computador">
                              <ProgressoConferencia {...conferidos(p)} />
                            </span>
                          )}
                          <span className="so-computador">
                            <Selo tipo={selo.tipo}>{selo.texto}</Selo>
                          </span>
                          <Icone nome="seta" tamanho={18} />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="detalhe">A secretaria confere o pedido. Com tudo conferido, um diretor aceita a ficha e o pedido vai para a próxima AGO.</p>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

/** /inscricoes/:id — a análise do pedido (aprovada em 18/11/2026: a secretaria confere item por item). */
export function DetalheInscricao() {
  const { id } = useParams()
  return <Detalhe key={id} id={id ?? ''} />
}

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, sucesso: string) => void

function Detalhe({ id }: { id: string }) {
  const [retorno, setRetorno] = useState<Retorno>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [pedido, igrejas] = await Promise.all([buscarPedido(id), listarIgrejas()])
    if (pedido.erro !== null) return pedido
    if (igrejas.erro !== null) return igrejas
    return ok({ pedido: pedido.dados, igrejas: igrejas.dados })
  })

  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <div className="tela-nova">
      <p className="trilha">
        <Link to="/inscricoes">← Pedidos de associação</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ pedido, igrejas }) =>
          !pedido ? (
            <Aviso titulo="Pedido não encontrado">
              <p>Volte para a lista dos pedidos de associação.</p>
            </Aviso>
          ) : (
            <Analise pedido={pedido} igrejas={igrejas} retorno={retorno} concluir={concluir} />
          )
        }
      </MostrarCarga>
    </div>
  )
}

function Analise({ pedido, igrejas, retorno, concluir }: { pedido: Pedido; igrejas: Igreja[]; retorno: Retorno; concluir: Concluir }) {
  const nome = pedido.pessoa?.nome ?? 'Candidato'
  const conferencia = conferenciaDe(pedido)
  const emAnalise = pedido.situacao === 'enviado' || pedido.situacao === 'pendencia'
  const selo = SELO_DO_PEDIDO[pedido.situacao]
  return (
    <>
      <section className="cabecalho-analise" aria-label="O candidato">
        <span className="avatar-ministro avatar-grande" aria-hidden="true">
          {iniciaisDe(nome)}
        </span>
        <span className="cabecalho-analise-texto">
          <span className="cabecalho-ficha-modulo">Ministros e inscrições › Pedidos de associação</span>
          <h1>{nome}</h1>
          <span className="sub-tela">
            {[pedido.titulo?.nome, igrejaDoPedido(pedido)].filter(Boolean).join(' · ')}
            {pedido.enviado_em && ` · pedido enviado em ${formatarData(pedido.enviado_em)}`}
          </span>
        </span>
        <span className="cabecalho-analise-lado">
          <Selo tipo={selo.tipo}>{selo.texto}</Selo>
          {emAnalise && <ProgressoConferencia feitos={conferencia.aprovados} total={conferencia.total} />}
        </span>
      </section>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

      <div className="analise-colunas">
        <section aria-labelledby="titulo-itens" className="aba-conteudo">
          <h2 id="titulo-itens" className="titulo-secao">
            {emAnalise ? 'Confira item por item' : 'O que a secretaria conferiu'}
          </h2>
          <ul className="bloco lista-linhas lista-itens-pedido" aria-labelledby="titulo-itens">
            {ITENS_DO_PEDIDO.map((item) => (
              <ItemDaAnalise key={item.chave} pedido={pedido} item={item.chave} nome={item.nome} editavel={emAnalise} concluir={concluir} />
            ))}
          </ul>
          <OutrosDados pedido={pedido} />
        </section>
        <div className="coluna-atalhos">
          <section className="bloco" aria-labelledby="titulo-passos">
            <h2 id="titulo-passos">Os passos</h2>
            <PassosDoPedido pedido={pedido} />
          </section>
          <Acoes pedido={pedido} igrejas={igrejas} conferencia={conferencia} concluir={concluir} />
        </div>
      </div>
    </>
  )
}

/** Um item do pedido: o que foi enviado e a decisão da secretaria (aprovar, ou recusar com o motivo). */
function ItemDaAnalise({
  pedido,
  item,
  nome,
  editavel,
  concluir,
}: {
  pedido: Pedido
  item: ItemPedido
  nome: string
  editavel: boolean
  concluir: Concluir
}) {
  const conferido = pedido.itens.find((i) => i.item === item)
  const situacao = conferido?.situacao ?? 'analise'
  const [mudando, setMudando] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const decidindo = editavel && (situacao === 'analise' || mudando)

  const decidir = (aprovado: boolean) =>
    umaVez(async () => {
      const r = await conferirItemPedido(pedido.id, item, aprovado, aprovado ? '' : motivo)
      concluir(r, aprovado ? `${nome}: aprovado.` : `${nome}: recusado.`)
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
        <DetalheDoItem pedido={pedido} item={item} />
        {!decidindo && (
          <span className="linha-selo">
            <Selo tipo={situacao === 'aprovado' ? 'aprovado' : situacao === 'recusado' ? 'recusado' : 'analise'}>
              {situacao === 'aprovado' ? 'Aprovado' : situacao === 'recusado' ? `Recusado: ${conferido?.motivo ?? ''}` : 'Em análise'}
            </Selo>
            {editavel && (
              <button type="button" className="botao-link" onClick={() => setMudando(true)}>
                Mudar
              </button>
            )}
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
              <input required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: a foto precisa ter o fundo claro" />
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

/** O que o candidato mandou em cada item: os dados, a igreja e o título, a foto e o comprovante. */
function DetalheDoItem({ pedido, item }: { pedido: Pedido; item: ItemPedido }) {
  const [link, setLink] = useState<string | null>(null)
  const caminho = item === 'foto' ? pedido.foto_caminho : item === 'comprovante' ? pedido.comprovante_caminho : null

  useEffect(() => {
    let ativo = true
    if (caminho) void linkDoArquivo(caminho).then((u) => ativo && setLink(u))
    return () => {
      ativo = false
    }
  }, [caminho])

  if (item === 'dados_pessoais') {
    return <span>{[pedido.pessoa?.nome, pedido.pessoa?.email, pedido.pessoa?.telefone].filter(Boolean).join(' · ')}</span>
  }
  if (item === 'igreja_titulo') {
    return (
      <span>
        {[
          pedido.titulo?.nome,
          pedido.titulo_desde && `desde ${formatarData(pedido.titulo_desde)}`,
          igrejaDoPedido(pedido),
          pedido.denominacao_informada && `denominação: ${pedido.denominacao_informada}`,
          pedido.funcao,
          pedido.pastor_presidente && 'pastor presidente',
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
    )
  }
  if (!caminho) return <span>Não enviado</span>
  if (!link) return <span>Carregando…</span>
  if (item === 'foto') {
    return (
      <span className="item-com-foto">
        <img className="foto-item" src={link} alt={`Foto de ${pedido.pessoa?.nome ?? 'candidato'}`} />
        <a href={link} target="_blank" rel="noreferrer">
          Ver a foto
        </a>
      </span>
    )
  }
  return (
    <a href={link} target="_blank" rel="noreferrer">
      Abrir comprovante do título
    </a>
  )
}

/** As declarações, as observações e o que já aconteceu no pedido. */
function OutrosDados({ pedido }: { pedido: Pedido }) {
  return (
    <dl className="definicoes bloco" aria-label="Outros dados do pedido">
      {pedido.observacoes && (
        <>
          <dt>Observações</dt>
          <dd>{pedido.observacoes}</dd>
        </>
      )}
      <dt>Declarações</dt>
      <dd>
        Princípios de fé, estatuto e LGPD aceitos
        {pedido.declaracoes_em && ` em ${formatarDataHora(pedido.declaracoes_em)}`}
      </dd>
      {pedido.mensagem_pendencia && (
        <>
          <dt>Pendência pedida</dt>
          <dd>{pedido.mensagem_pendencia}</dd>
        </>
      )}
      {pedido.aceite_diretor_em && (
        <>
          <dt>Aceite do diretor</dt>
          <dd>
            {pedido.aceite_diretor?.nome} em {formatarDataHora(pedido.aceite_diretor_em)}
          </dd>
        </>
      )}
    </dl>
  )
}

type Conferencia = { aprovados: number; recusados: string[]; total: number }

/** Quantos itens a secretaria já aprovou e o que recusou (com o motivo). */
function conferenciaDe(pedido: Pedido): Conferencia {
  const aprovados = pedido.itens.filter((i) => i.situacao === 'aprovado').length
  const recusados = ITENS_DO_PEDIDO.flatMap((item) => {
    const c = pedido.itens.find((i) => i.item === item.chave)
    return c?.situacao === 'recusado' ? [`${item.nome}: ${c.motivo ?? ''}`] : []
  })
  return { aprovados, recusados, total: ITENS_DO_PEDIDO.length }
}

/** Mesma regra do Art. 16, §6º: Assembleia Ordinária na 2ª quinzena de abril ou de outubro. */
function foraDaQuinzenaDaAgo(data: string): boolean {
  const [, mes, dia] = data.split('-').map(Number)
  return !((mes === 4 || mes === 10) && dia >= 16)
}

function Acoes({ pedido, igrejas, conferencia, concluir }: { pedido: Pedido; igrejas: Igreja[]; conferencia: Conferencia; concluir: Concluir }) {
  const [igrejaId, setIgrejaId] = useState(pedido.igreja_id ?? '')
  const [motivo, setMotivo] = useState('')
  const [data, setData] = useState(hojeIso())
  const [ata, setAta] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function executar(acao: () => Promise<{ erro: string | null }>, sucesso: string) {
    setEnviando(true)
    concluir(await acao(), sucesso)
    setEnviando(false)
  }

  if (pedido.situacao === 'aprovado') {
    return (
      <section className="bloco">
        <h2>Resultado</h2>
        <p>
          Aprovado na Assembleia Ordinária de {formatarData(pedido.assembleia_data)}
          {pedido.assembleia_ata && ` (${pedido.assembleia_ata})`}.
        </p>
        <Link to={`/ministros/${pedido.pessoa_id}`} className="botao">
          Abrir a ficha do associado
        </Link>
      </section>
    )
  }
  if (pedido.situacao === 'recusado' || pedido.situacao === 'desistiu') {
    return (
      <section className="bloco">
        <h2>Resultado</h2>
        <p>{pedido.situacao === 'recusado' ? `Recusado. Motivo: ${pedido.motivo_recusa}` : 'O candidato desistiu.'}</p>
      </section>
    )
  }

  const recusa = (
    <details className="acao-recolhida">
      <summary>Recusar o pedido</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void executar(
            () => recusarPedido(pedido.id, motivo, pedido.situacao === 'aguardando_assembleia' ? data : undefined),
            'Pedido recusado.',
          )
        }}
      >
        <label>
          Motivo *
          <textarea required rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
          Recusar
        </button>
      </form>
    </details>
  )

  if (pedido.situacao === 'aguardando_assembleia') {
    return (
      <section className="bloco" aria-labelledby="titulo-decisao">
        <h2 id="titulo-decisao">Decisão da Assembleia Ordinária</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void executar(() => aprovarPedido(pedido.id, data, ata), 'Aprovado! O candidato agora é associado (perfil Ministro e nº de registro).')
          }}
        >
          <label>
            Data da assembleia *
            <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Ata
            <input placeholder="Ex.: Ata nº 12/2026" value={ata} onChange={(e) => setAta(e.target.value)} />
          </label>
          {data && foraDaQuinzenaDaAgo(data) && (
            <p className="aviso-campo">Atenção: as Assembleias Ordinárias são na 2ª quinzena de abril e de outubro (Art. 16, §6º). Confira a data.</p>
          )}
          <button type="submit" className="botao" disabled={enviando}>
            Registrar aprovação
          </button>
        </form>
        {recusa}
      </section>
    )
  }

  // enviado ou pendência: a conferência da secretaria
  const tudoAprovado = conferencia.aprovados === conferencia.total
  return (
    <section className="bloco" aria-labelledby="titulo-analise">
      <h2 id="titulo-analise">Análise da secretaria</h2>
      {pedido.situacao === 'pendencia' && <p className="detalhe">Devolvido ao candidato: esperando a correção. Você ainda pode conferir e mandar para a AGO.</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void executar(() => encaminharParaAssembleia(pedido.id, igrejaId), 'Ficha aceita e pedido encaminhado à Assembleia Ordinária.')
        }}
      >
        <label>
          Igreja cadastrada do candidato *
          <select required value={igrejaId} onChange={(e) => setIgrejaId(e.target.value)}>
            <option value="">— Escolha —</option>
            {igrejas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
          {!pedido.igreja_id && pedido.igreja_informada && (
            <span className="detalhe">
              O candidato informou "{pedido.igreja_informada}". Se ela não está na lista,{' '}
              <Link to="/igrejas/nova" target="_blank">
                cadastre a igreja
              </Link>{' '}
              e recarregue esta página.
            </span>
          )}
        </label>
        <button type="submit" className="botao botao-cheio" disabled={enviando || !tudoAprovado}>
          Mandar para a AGO
        </button>
        <p className="detalhe">
          {tudoAprovado
            ? 'Ao mandar, você assina eletronicamente a ficha como diretor (Art. 7º). O pedido vai para a próxima Assembleia Ordinária.'
            : `Libera quando os ${conferencia.total} itens estiverem aprovados (${conferencia.aprovados} de ${conferencia.total}).`}
        </p>
      </form>

      {pedido.situacao === 'enviado' && (
        <div className="acoes-devolver">
          <button
            type="button"
            className="botao botao-secundario"
            disabled={enviando || conferencia.recusados.length === 0}
            onClick={() =>
              void executar(
                () => devolverComPendencia(pedido.id, `Corrija e envie de novo: ${conferencia.recusados.join(' ')}`),
                'Pedido devolvido ao candidato.',
              )
            }
          >
            Devolver ao candidato
          </button>
          <p className="detalhe">
            {conferencia.recusados.length === 0
              ? 'Recuse o item que precisa de correção (com o motivo) para devolver o pedido.'
              : 'O candidato vê o motivo em cada item recusado e envia de novo só o que foi recusado.'}
          </p>
        </div>
      )}
      {recusa}
    </section>
  )
}
