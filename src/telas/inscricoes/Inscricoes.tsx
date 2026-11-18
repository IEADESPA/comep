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
  devolverComPendencia,
  encaminharParaAssembleia,
  linkDoArquivo,
  listarPedidos,
  NOME_DA_SITUACAO_PEDIDO,
  recusarPedido,
  type Pedido,
  type SituacaoPedido,
} from '../../dados/pedidos'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataHora, hojeIso } from '../../utilitarios/formatos'

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

/**
 * O que a secretaria confere em cada pedido: os dados pessoais, a igreja e o título, a foto 3×4 e o comprovante.
 * Por enquanto a conferência é do pedido inteiro: com a ficha aceita, os itens contam como conferidos.
 */
function conferidos(p: Pedido): { feitos: number; total: number } {
  const total = 4
  return { feitos: p.situacao === 'aguardando_assembleia' || p.situacao === 'aprovado' ? total : 0, total }
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

/** /inscricoes/:id */
export function DetalheInscricao() {
  const { id } = useParams()
  return <Detalhe key={id} id={id ?? ''} />
}

type Retorno = { sucesso?: string; erro?: string }

function Detalhe({ id }: { id: string }) {
  const [retorno, setRetorno] = useState<Retorno>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [pedido, igrejas] = await Promise.all([buscarPedido(id), listarIgrejas()])
    if (pedido.erro !== null) return pedido
    if (igrejas.erro !== null) return igrejas
    return ok({ pedido: pedido.dados, igrejas: igrejas.dados })
  })

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
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
            <>
              <h1>{pedido.pessoa?.nome}</h1>
              <p className="etiquetas">
                <span className="etiqueta etiqueta-marca">{NOME_DA_SITUACAO_PEDIDO[pedido.situacao]}</span>
              </p>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
              <DadosDoPedido pedido={pedido} />
              <Acoes pedido={pedido} igrejas={igrejas} concluir={concluir} />
            </>
          )
        }
      </MostrarCarga>
    </>
  )
}

function DadosDoPedido({ pedido }: { pedido: Pedido }) {
  const [foto, setFoto] = useState<string | null>(null)
  const [comprovante, setComprovante] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    if (pedido.foto_caminho) void linkDoArquivo(pedido.foto_caminho).then((u) => ativo && setFoto(u))
    if (pedido.comprovante_caminho) {
      void linkDoArquivo(pedido.comprovante_caminho).then((u) => ativo && setComprovante(u))
    }
    return () => {
      ativo = false
    }
  }, [pedido.foto_caminho, pedido.comprovante_caminho])

  return (
    <section className="painel" aria-labelledby="titulo-dados-pedido">
      <h2 id="titulo-dados-pedido">Dados do pedido</h2>
      <div className="ficha-com-foto">
        {foto ? (
          <img className="foto-ficha" src={foto} alt={`Foto de ${pedido.pessoa?.nome}`} />
        ) : (
          <div className="foto-ficha foto-vazia" aria-hidden="true" />
        )}
        <dl className="definicoes">
          <dt>E-mail</dt>
          <dd>{pedido.pessoa?.email ?? 'Não informado'}</dd>
          <dt>Telefone</dt>
          <dd>{pedido.pessoa?.telefone ?? 'Não informado'}</dd>
          <dt>Título</dt>
          <dd>
            {pedido.titulo?.nome}
            {pedido.titulo_desde && ` — desde ${formatarData(pedido.titulo_desde)}`}
          </dd>
          <dt>Igreja</dt>
          <dd>
            {igrejaDoPedido(pedido)}
            {pedido.denominacao_informada && ` — denominação: ${pedido.denominacao_informada}`}
          </dd>
          <dt>Função</dt>
          <dd>
            {pedido.funcao || 'Não informada'}
            {pedido.pastor_presidente && ' · pastor presidente'}
          </dd>
          {pedido.observacoes && (
            <>
              <dt>Observações</dt>
              <dd>{pedido.observacoes}</dd>
            </>
          )}
          <dt>Comprovante</dt>
          <dd>
            {comprovante ? (
              <a href={comprovante} target="_blank" rel="noreferrer">
                Abrir comprovante do título
              </a>
            ) : (
              'Carregando…'
            )}
          </dd>
          <dt>Declarações</dt>
          <dd>
            Princípios de fé, estatuto e LGPD aceitos
            {pedido.declaracoes_em && ` em ${formatarDataHora(pedido.declaracoes_em)}`}
          </dd>
          {pedido.aceite_diretor_em && (
            <>
              <dt>Aceite do diretor</dt>
              <dd>
                {pedido.aceite_diretor?.nome} em {formatarDataHora(pedido.aceite_diretor_em)}
              </dd>
            </>
          )}
          {pedido.mensagem_pendencia && (
            <>
              <dt>Pendência pedida</dt>
              <dd>{pedido.mensagem_pendencia}</dd>
            </>
          )}
        </dl>
      </div>
    </section>
  )
}

/** Mesma regra do Art. 16, §6º: Assembleia Ordinária na 2ª quinzena de abril ou de outubro. */
function foraDaQuinzenaDaAgo(data: string): boolean {
  const [, mes, dia] = data.split('-').map(Number)
  return !((mes === 4 || mes === 10) && dia >= 16)
}

function Acoes({
  pedido,
  igrejas,
  concluir,
}: {
  pedido: Pedido
  igrejas: Igreja[]
  concluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [igrejaId, setIgrejaId] = useState(pedido.igreja_id ?? '')
  const [mensagem, setMensagem] = useState('')
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
      <section className="painel">
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
      <section className="painel">
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
      <section className="painel" aria-labelledby="titulo-decisao">
        <h2 id="titulo-decisao">Decisão da Assembleia Ordinária</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void executar(
              () => aprovarPedido(pedido.id, data, ata),
              'Aprovado! O candidato agora é associado (perfil Ministro e nº de registro).',
            )
          }}
        >
          <div className="grade-form">
            <label>
              Data da assembleia *
              <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label>
              Ata
              <input placeholder="Ex.: Ata nº 12/2026" value={ata} onChange={(e) => setAta(e.target.value)} />
            </label>
          </div>
          {data && foraDaQuinzenaDaAgo(data) && (
            <p className="aviso-campo">
              Atenção: as Assembleias Ordinárias são na 2ª quinzena de abril e de outubro (Art. 16, §6º). Confira a
              data.
            </p>
          )}
          <button type="submit" className="botao" disabled={enviando}>
            Registrar aprovação
          </button>
        </form>
        {recusa}
      </section>
    )
  }

  // enviado ou pendência: análise da diretoria
  return (
    <section className="painel" aria-labelledby="titulo-analise">
      <h2 id="titulo-analise">Análise da diretoria</h2>
      {pedido.situacao === 'pendencia' && (
        <p className="detalhe">Aguardando a correção do candidato. Você ainda pode encaminhar ou recusar.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void executar(
            () => encaminharParaAssembleia(pedido.id, igrejaId),
            'Ficha aceita e pedido encaminhado à Assembleia Ordinária.',
          )
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
        <p className="detalhe">
          Ao encaminhar, você assina eletronicamente a ficha como diretor (Art. 7º). O pedido vai para a próxima
          Assembleia Ordinária.
        </p>
        <button type="submit" className="botao" disabled={enviando}>
          Aceitar a ficha e encaminhar à assembleia
        </button>
      </form>

      {pedido.situacao === 'enviado' && (
        <details className="acao-recolhida">
          <summary>Devolver com pendência</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void executar(() => devolverComPendencia(pedido.id, mensagem), 'Pedido devolvido ao candidato.')
            }}
          >
            <label>
              O que o candidato precisa corrigir *
              <textarea required rows={2} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </label>
            <button type="submit" className="botao botao-secundario" disabled={enviando}>
              Devolver
            </button>
          </form>
        </details>
      )}
      {recusa}
    </section>
  )
}
