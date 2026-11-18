// Fase 5.5.3 — Pedido de Assembleia Extraordinária on-line (Art. 16, §3º; 17/11/2026).
// /assembleias/pedidos: os pedidos (todos do COMEP veem as assinaturas, como num abaixo-assinado);
// /assembleias/pedidos/novo: o associado em dia abre o pedido com a pauta (e já assina);
// /assembleias/pedidos/:id: assinar, retirar a assinatura, cancelar (quem abriu) e marcar a AGE (presidência e secretaria).
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  assinarPedidoAge,
  buscarPedidoAge,
  cancelarPedidoAge,
  criarPedidoAge,
  listarPedidosAge,
  marcarAgeDoPedido,
  retirarAssinaturaAge,
  type ContaPedidoAge,
  type PedidoAge,
  type PedidoAgeNaLista,
} from '../../dados/pedidosAge'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { doCampoDataHora } from '../../utilitarios/encontros'
import { formatarData, formatarDataHora } from '../../utilitarios/formatos'

type Concluir = (r: { erro: string | null }, sucesso: string) => void

function usePerfis(): readonly Perfil[] {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

const marca = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')

function Situacao({ p }: { p: Pick<PedidoAgeNaLista, 'situacao' | 'expirado'> }) {
  if (p.situacao === 'coletando') {
    return p.expirado ? (
      <span className="etiqueta etiqueta-cancelada">Prazo encerrado (não atingiu)</span>
    ) : (
      <span className="etiqueta etiqueta-conferencia">Colhendo assinaturas</span>
    )
  }
  if (p.situacao === 'atingido') return <span className="etiqueta etiqueta-ok">Atingido: a AGE deve ser marcada</span>
  if (p.situacao === 'atendido') return <span className="etiqueta etiqueta-marca">AGE marcada</span>
  return <span className="etiqueta etiqueta-cancelada">Cancelado</span>
}

/** "2 de 3 assinaturas (3/5 dos associados em dia)" */
function Progresso({ c }: { c: ContaPedidoAge }) {
  const pct = Math.min(100, Math.round((c.assinaturas_aptas * 100) / Math.max(c.minimo_associados, 1)))
  return (
    <div className="resultado-opcao">
      <span>
        <strong>
          {c.assinaturas_aptas} de {c.minimo_associados}
        </strong>{' '}
        assinaturas necessárias (3/5 dos {c.aptos} associados em dia)
        {c.diretoria > 0 && ` · Conselho Diretor: ${c.assinaturas_diretoria} de ${c.minimo_diretoria}`}
      </span>
      <span className="resultado-barra" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------
// /assembleias/pedidos
// ---------------------------------------------------------------------

export function ListaPedidosAge() {
  const local = useLocation()
  const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarPedidosAge)
  return (
    <>
      <p>
        <Link to="/assembleias">← Assembleias e reuniões</Link>
      </p>
      <div className="cabecalho-tela">
        <h1>Pedidos de Assembleia Extraordinária</h1>
        <Link to="/assembleias/pedidos/novo" className="botao">
          Pedir uma AGE
        </Link>
      </div>
      <p className="detalhe">
        A Assembleia Extraordinária é pedida por 3/5 dos associados ou pela maioria simples do Conselho Diretor, com a pauta (Art.
        16, §3º). Um associado em dia abre o pedido e os outros assinam aqui. Atingidas as assinaturas, a presidência marca a AGE.
      </p>
      <Mensagem sucesso={mensagem} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pedidos) =>
          pedidos.length === 0 ? (
            <p className="vazio">Nenhum pedido de AGE.</p>
          ) : (
            <ul className="lista" aria-label="Pedidos de AGE">
              {pedidos.map((p) => (
                <li key={p.id}>
                  <Link to={`/assembleias/pedidos/${p.id}`} className="lista-item">
                    <strong>{p.titulo}</strong>
                    <span>
                      Pedido por {p.autor} em {formatarDataHora(p.criado_em)} · {p.conta.assinaturas_aptas} de {p.conta.minimo_associados}{' '}
                      assinaturas
                      {p.situacao === 'coletando' && ` · até ${formatarData(p.prazo)}`}
                    </span>
                    <span>
                      <Situacao p={p} />{' '}
                      {p.eu_assinei ? (
                        <span className="etiqueta etiqueta-paga">Você assinou</span>
                      ) : (
                        p.posso_assinar && <span className="etiqueta etiqueta-atraso">Falta a sua assinatura</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </MostrarCarga>
    </>
  )
}

// ---------------------------------------------------------------------
// /assembleias/pedidos/novo
// ---------------------------------------------------------------------

export function NovoPedidoAge() {
  const navegar = useNavigate()
  const [titulo, setTitulo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [pauta, setPauta] = useState([{ titulo: '', descricao: '' }])
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const mudarItem = (i: number, parte: Partial<{ titulo: string; descricao: string }>) =>
    setPauta((atual) => atual.map((item, j) => (j === i ? { ...item, ...parte } : item)))
  return (
    <>
      <p>
        <Link to="/assembleias/pedidos">← Pedidos de AGE</Link>
      </p>
      <h1>Pedir uma Assembleia Extraordinária</h1>
      <form
        aria-label="Pedido de AGE"
        className="painel"
        onSubmit={(e) => {
          e.preventDefault()
          setErro(null)
          if (!aceite) return setErro('Confirme que você assina o pedido.')
          void umaVez(async () => {
            const r = await criarPedidoAge({ titulo, justificativa, pauta: pauta.filter((i) => i.titulo.trim()) })
            if (r.erro !== null) return setErro(r.erro)
            navegar(`/assembleias/pedidos/${r.dados}`, {
              state: { mensagem: 'Pedido aberto com a sua assinatura. Mande o link para os associados assinarem.' },
            })
          })
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Assunto *
            <input required minLength={3} maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label className="largura-total">
            Por que a assembleia é necessária *
            <textarea required minLength={10} maxLength={5000} rows={4} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </label>
        </div>
        <fieldset className="pauta-campos">
          <legend>Pauta (Art. 16, §3º)</legend>
          {pauta.map((item, i) => (
            <div key={i} className="grade-form">
              <label>
                Item {i + 1} {i === 0 && '*'}
                <input required={i === 0} maxLength={200} value={item.titulo} onChange={(e) => mudarItem(i, { titulo: e.target.value })} />
              </label>
              <label>
                Detalhes do item {i + 1}
                <input maxLength={2000} value={item.descricao} onChange={(e) => mudarItem(i, { descricao: e.target.value })} />
              </label>
            </div>
          ))}
          {pauta.length < 20 && (
            <button type="button" className="botao-texto" onClick={() => setPauta((atual) => [...atual, { titulo: '', descricao: '' }])}>
              + Outro item
            </button>
          )}
        </fieldset>
        <label className="caixa-marcar">
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          Assino este pedido de Assembleia Extraordinária (a minha assinatura fica visível aos associados)
        </label>
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Abrir o pedido e assinar
          </button>
        </div>
      </form>
    </>
  )
}

// ---------------------------------------------------------------------
// /assembleias/pedidos/:id
// ---------------------------------------------------------------------

export function DetalhePedidoAge() {
  const { id = '' } = useParams()
  return <ConteudoPedido key={id} id={id} />
}

function ConteudoPedido({ id }: { id: string }) {
  const perfis = usePerfis()
  const local = useLocation()
  const [carga, recarregar] = useCarregar(() => buscarPedidoAge(id))
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const [enviando, umaVez] = useUmaVez()
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <>
      <p>
        <Link to="/assembleias/pedidos">← Pedidos de AGE</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(p) =>
          !p ? (
            <Aviso titulo="Pedido não encontrado">
              <p>Confira o link.</p>
            </Aviso>
          ) : (
            <>
              <h1>{p.titulo}</h1>
              <p>
                <Situacao p={p} />
              </p>
              <dl className="definicoes">
                <dt>Pedido por</dt>
                <dd>
                  {p.autor} em {formatarDataHora(p.criado_em)}
                </dd>
                {p.situacao === 'coletando' && (
                  <>
                    <dt>Assinaturas até</dt>
                    <dd>{formatarData(p.prazo)}</dd>
                  </>
                )}
                {p.atingido_em && (
                  <>
                    <dt>Atingido em</dt>
                    <dd>
                      {formatarDataHora(p.atingido_em)} —{' '}
                      {p.atingido_por === 'diretoria' ? 'pela maioria simples do Conselho Diretor' : 'por 3/5 dos associados em dia'}
                    </dd>
                  </>
                )}
                {p.situacao === 'cancelado' && (
                  <>
                    <dt>Cancelado</dt>
                    <dd>{p.motivo_cancelamento}</dd>
                  </>
                )}
              </dl>
              <h2>Por que</h2>
              <p className="texto-edital">{p.justificativa}</p>
              <h2>Pauta</h2>
              <ol className="pauta-lista" aria-label="Pauta pedida">
                {p.pauta.map((item, i) => (
                  <li key={i}>
                    <strong>{item.titulo}</strong>
                    {item.descricao && ` — ${item.descricao}`}
                  </li>
                ))}
              </ol>

              <section className="painel" aria-labelledby="titulo-assinaturas">
                <h2 id="titulo-assinaturas">Assinaturas</h2>
                <Progresso c={p.conta} />
                <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
                {p.posso_assinar && !p.eu_assinei && (
                  <div className="acoes">
                    <button
                      type="button"
                      className="botao"
                      disabled={enviando}
                      onClick={() => void umaVez(async () => concluir(await assinarPedidoAge(p.id), 'Assinatura registrada. Obrigado!'))}
                    >
                      Assinar o pedido
                    </button>
                  </div>
                )}
                {p.eu_assinei && p.situacao === 'coletando' && !p.expirado && (
                  <p className="detalhe">
                    Você assinou este pedido.{' '}
                    <button
                      type="button"
                      className="botao-texto"
                      disabled={enviando}
                      onClick={() => void umaVez(async () => concluir(await retirarAssinaturaAge(p.id), 'Sua assinatura foi retirada.'))}
                    >
                      Retirar a minha assinatura
                    </button>
                  </p>
                )}
                {p.eu_assinei && p.situacao !== 'coletando' && <p className="detalhe">Você assinou este pedido.</p>}
                <ul className="lista-simples" aria-label="Quem assinou">
                  {p.assinaturas.map((a) => (
                    <li key={`${a.nome}-${a.assinado_em}`}>
                      {a.nome} — {formatarDataHora(a.assinado_em)}
                      {a.diretoria && ' · Conselho Diretor'}
                      {!a.conta && !a.diretoria && ' · não conta hoje (não está em dia)'}
                    </li>
                  ))}
                </ul>
              </section>

              {p.sou_autor && p.situacao === 'coletando' && <CancelarPedido id={p.id} aoConcluir={concluir} />}
              {marca(perfis) && p.situacao === 'atingido' && <MarcarAge p={p} />}
              {p.encontro_id && (
                <p>
                  <Link to={`/assembleias/${p.encontro_id}`}>Ver a assembleia marcada</Link>
                </p>
              )}
            </>
          )
        }
      </MostrarCarga>
    </>
  )
}

function CancelarPedido({ id, aoConcluir }: { id: string; aoConcluir: Concluir }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Cancelar o pedido</summary>
      <form
        className="form-linha"
        aria-label="Cancelar o pedido"
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => aoConcluir(await cancelarPedidoAge(id, motivo), 'Pedido cancelado.'))
        }}
      >
        <label>
          Motivo *
          <input required minLength={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <button type="submit" className="botao botao-perigo" disabled={enviando}>
          Cancelar o pedido
        </button>
      </form>
    </details>
  )
}

function MarcarAge({ p }: { p: PedidoAge }) {
  const navegar = useNavigate()
  const [titulo, setTitulo] = useState(`Assembleia Geral Extraordinária — ${p.titulo}`)
  const [inicio, setInicio] = useState('')
  const [local, setLocal] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  return (
    <form
      className="painel"
      aria-label="Marcar a AGE"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        void umaVez(async () => {
          const r = await marcarAgeDoPedido(p.id, { titulo, inicio: doCampoDataHora(inicio), local })
          if (r.erro !== null) return setErro(r.erro)
          navegar(`/assembleias/${r.dados}`, {
            state: { mensagem: 'AGE marcada em preparo, com a pauta do pedido. Confira os itens e convoque com a antecedência do estatuto.' },
          })
        })
      }}
    >
      <h2>Marcar a AGE</h2>
      <p className="detalhe">
        A assembleia nasce em preparo, com a pauta do pedido (itens de votação, maioria simples) e o "quem pediu" preenchido. Ajuste e
        convoque como sempre (antecedência e edital).
      </p>
      <div className="grade-form">
        <label className="largura-total">
          Título *
          <input required minLength={3} maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label>
          Data e hora *
          <input type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Local *
          <input required maxLength={300} value={local} onChange={(e) => setLocal(e.target.value)} />
        </label>
      </div>
      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Marcar a AGE
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// No Início: pedidos para assinar; para a presidência e a secretaria, os atingidos
// ---------------------------------------------------------------------
