// Fase 5.5.2 — Votações e enquetes on-line (17/11/2026).
// A secretaria ou a presidência prepara, abre e encerra; os associados votam pelo celular (um voto, sem volta).
// No voto secreto (o padrão), o banco guarda QUEM votou, não O QUE; a contagem só aparece no fim.
// Na assembleia, o item da pauta é votado pelos presentes e, ao encerrar, o resultado vai para a votação do item e a ata.
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso, BotaoConfirmar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { ok } from '../../dados/cliente'
import { listarEncontros, NOME_DA_MAIORIA, type Encontro, type Maioria } from '../../dados/encontros'
import type { Perfil } from '../../dados/perfis'
import {
  abrirVotacao,
  buscarItemDePauta,
  buscarVotacao,
  cancelarVotacao,
  encerrarVotacao,
  listarVotacoes,
  NOME_DE_QUEM_VOTA,
  NOME_DO_TIPO_VOTACAO,
  resultadoVotacao,
  salvarVotacao,
  votar,
  type DadosVotacao,
  type ItemDaLista,
  type ItemDePautaParaVotar,
  type QuemVota,
  type ResultadoVotacao,
  type SituacaoVotacao,
  type TipoVotacao,
  type Votacao,
} from '../../dados/votacoes'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { doCampoDataHora, paraCampoDataHora } from '../../utilitarios/encontros'
import { formatarDataHora } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }

function usePerfis(): readonly Perfil[] {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

/** Preparam, abrem e encerram: a secretaria e a presidência. */
const organiza = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')

function Situacao({ situacao, fechada }: { situacao: SituacaoVotacao; fechada: boolean }) {
  if (situacao === 'rascunho') return <span className="etiqueta etiqueta-neutra">Em preparo</span>
  if (situacao === 'cancelada') return <span className="etiqueta etiqueta-cancelada">Cancelada</span>
  if (situacao === 'aberta' && !fechada) return <span className="etiqueta etiqueta-ok">Aberta</span>
  return <span className="etiqueta etiqueta-marca">{situacao === 'aberta' ? 'Prazo encerrado' : 'Encerrada'}</span>
}

// ---------------------------------------------------------------------
// /votacoes
// ---------------------------------------------------------------------

export function ListaVotacoes() {
  const perfis = usePerfis()
  const local = useLocation()
  const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarVotacoes)
  const [mostrar, setMostrar] = useState<'abertas' | 'encerradas' | 'preparo'>('abertas')
  const abas = organiza(perfis) ? (['abertas', 'encerradas', 'preparo'] as const) : (['abertas', 'encerradas'] as const)
  const NOME_ABA = { abertas: 'Abertas', encerradas: 'Encerradas', preparo: 'Em preparo' }
  const naAba = (v: ItemDaLista) =>
    mostrar === 'preparo'
      ? v.situacao === 'rascunho'
      : mostrar === 'abertas'
        ? v.situacao === 'aberta' && !v.fechada
        : v.situacao === 'encerrada' || v.situacao === 'cancelada' || (v.situacao === 'aberta' && v.fechada)
  return (
    <>
      <div className="cabecalho-tela">
        <h1>Votações e enquetes</h1>
        {organiza(perfis) && (
          <Link to="/votacoes/nova" className="botao">
            Nova votação ou enquete
          </Link>
        )}
      </div>
      <p className="detalhe">
        Vote pelo celular. No voto secreto, o sistema guarda que você votou, mas não em quê. O resultado aparece quando a votação
        termina.
      </p>
      <Mensagem sucesso={mensagem} />
      <div className="abas" role="tablist" aria-label="Quais votações">
        {abas.map((a) => (
          <button key={a} type="button" role="tab" aria-selected={mostrar === a} className={mostrar === a ? 'aba ativa' : 'aba'} onClick={() => setMostrar(a)}>
            {NOME_ABA[a]}
          </button>
        ))}
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(lista) => {
          const mostradas = lista.filter(naAba)
          if (mostradas.length === 0) {
            return <p className="vazio">{mostrar === 'abertas' ? 'Nenhuma votação aberta agora.' : 'Nada por aqui.'}</p>
          }
          return (
            <ul className="lista" aria-label="Votações">
              {mostradas.map((v) => (
                <li key={v.id}>
                  <Link to={`/votacoes/${v.id}`} className="lista-item">
                    <strong>
                      <span className="etiqueta etiqueta-neutra">{NOME_DO_TIPO_VOTACAO[v.tipo]}</span> {v.titulo}
                    </strong>
                    <span>
                      {v.encontro && `${v.encontro} · `}
                      {v.votantes === 1 ? '1 voto' : `${v.votantes} votos`}
                      {v.fecha_em && ` · até ${formatarDataHora(v.fecha_em)}`}
                    </span>
                    <span>
                      <Situacao situacao={v.situacao} fechada={v.fechada} />{' '}
                      {v.eu_votei ? (
                        <span className="etiqueta etiqueta-paga">Você já votou</span>
                      ) : (
                        v.posso_votar && <span className="etiqueta etiqueta-atraso">Vote agora</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }}
      </MostrarCarga>
    </>
  )
}

// ---------------------------------------------------------------------
// /votacoes/nova (?pauta=<item>) e /votacoes/:id/editar
// ---------------------------------------------------------------------

export function NovaVotacao() {
  const [parametros] = useSearchParams()
  const pauta = parametros.get('pauta')
  return <TelaFormulario key={pauta ?? 'nova'} id={null} pautaId={pauta} />
}

export function EditarVotacao() {
  const { id = '' } = useParams()
  return <TelaFormulario key={id} id={id} pautaId={null} />
}

function TelaFormulario({ id, pautaId }: { id: string | null; pautaId: string | null }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [votacao, encontros] = await Promise.all([id ? buscarVotacao(id) : Promise.resolve(ok(null)), listarEncontros()])
    if (votacao.erro !== null) return votacao
    if (encontros.erro !== null) return encontros
    const idDoItem = pautaId ?? votacao.dados?.pauta_id ?? null
    const item = idDoItem ? await buscarItemDePauta(idDoItem) : ok(null)
    if (item.erro !== null) return item
    return ok({ votacao: votacao.dados, encontros: encontros.dados.filter((e) => e.situacao !== 'cancelado'), item: item.dados })
  })
  return (
    <>
      <p>
        <Link to={id ? `/votacoes/${id}` : '/votacoes'}>← {id ? 'Voltar à votação' : 'Votações e enquetes'}</Link>
      </p>
      <h1>{id ? 'Alterar a votação' : 'Nova votação ou enquete'}</h1>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ votacao, encontros, item }) =>
          id && !votacao ? (
            <Aviso titulo="Votação não encontrada">
              <p>Ela pode ter sido aberta (e aí não se altera mais) ou cancelada.</p>
            </Aviso>
          ) : votacao && votacao.situacao !== 'rascunho' ? (
            <Aviso titulo="Esta votação já foi aberta">
              <p>Depois de aberta, a votação não muda mais. Se for preciso, cancele e faça outra.</p>
            </Aviso>
          ) : (
            <FormVotacao votacao={votacao} encontros={encontros} item={item} />
          )
        }
      </MostrarCarga>
    </>
  )
}

function FormVotacao({ votacao, encontros, item }: { votacao: Votacao | null; encontros: Encontro[]; item: ItemDePautaParaVotar | null }) {
  const navegar = useNavigate()
  const [d, setD] = useState({
    tipo: (votacao?.tipo ?? (item ? 'votacao' : 'enquete')) as TipoVotacao,
    titulo: votacao?.titulo ?? item?.titulo ?? '',
    descricao: votacao?.descricao ?? '',
    encontro_id: votacao?.encontro_id ?? item?.encontro_id ?? '',
    quem_vota: (votacao?.quem_vota ?? (item ? 'presentes' : 'em_dia')) as QuemVota,
    secreta: votacao?.secreta ?? true,
    max_escolhas: String(votacao?.max_escolhas ?? 1),
    maioria: (votacao?.maioria ?? item?.maioria ?? 'simples') as Maioria,
    parcial_visivel: votacao?.parcial_visivel ?? false,
    fecha_em: votacao?.fecha_em ? paraCampoDataHora(votacao.fecha_em) : '',
    opcoes: votacao?.tipo === 'enquete' ? votacao.opcoes.map((o) => o.texto).join('\n') : '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const mudar = (parte: Partial<typeof d>) => setD((atual) => ({ ...atual, ...parte }))
  const doItem = item !== null
  const opcoes = d.opcoes
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)
  return (
    <form
      aria-label="Votação"
      className="painel"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        const dados: DadosVotacao = {
          tipo: d.tipo,
          titulo: d.titulo,
          descricao: d.descricao,
          encontro_id: d.encontro_id || null,
          pauta_id: item?.id ?? null,
          quem_vota: d.quem_vota,
          secreta: d.secreta,
          max_escolhas: d.tipo === 'enquete' ? Number(d.max_escolhas) : 1,
          maioria: d.tipo === 'votacao' ? d.maioria : null,
          parcial_visivel: !d.secreta && d.parcial_visivel,
          fecha_em: d.fecha_em ? doCampoDataHora(d.fecha_em) : '',
          opcoes: d.tipo === 'enquete' ? opcoes : [],
        }
        void umaVez(async () => {
          const r = await salvarVotacao(votacao?.id ?? null, dados)
          if (r.erro !== null) return setErro(r.erro)
          navegar(`/votacoes/${r.dados}`, { state: { mensagem: 'Salva em preparo. Confira e abra a votação quando for a hora.' } })
        })
      }}
    >
      {doItem ? (
        <p>
          Votação do item <strong>{item.titulo}</strong>, na <strong>{item.encontro?.titulo ?? 'assembleia'}</strong>: votam os presentes em
          dia, com a maioria do item ({item.maioria ? NOME_DA_MAIORIA[item.maioria] : '—'}). Ao encerrar, o resultado vai para a votação do
          item e para a ata.
        </p>
      ) : (
        <fieldset>
          <legend>O que é</legend>
          <label className="caixa-marcar">
            <input type="radio" name="tipo" checked={d.tipo === 'enquete'} onChange={() => mudar({ tipo: 'enquete' })} />
            Enquete — uma pergunta com opções, para ouvir os associados
          </label>
          <label className="caixa-marcar">
            <input type="radio" name="tipo" checked={d.tipo === 'votacao'} onChange={() => mudar({ tipo: 'votacao' })} />
            Votação — a favor, contra ou abstenção, com a maioria exigida
          </label>
        </fieldset>
      )}
      <div className="grade-form">
        <label className="largura-total">
          {d.tipo === 'enquete' ? 'Pergunta *' : 'O que se vota *'}
          <input required minLength={3} maxLength={200} value={d.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
        </label>
        <label className="largura-total">
          Explicação
          <textarea maxLength={5000} rows={3} value={d.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
        </label>
        {d.tipo === 'enquete' && (
          <>
            <label className="largura-total">
              Opções * (uma por linha, de 2 a 20)
              <textarea required rows={5} value={d.opcoes} onChange={(e) => mudar({ opcoes: e.target.value })} />
            </label>
            <label>
              Cada um escolhe até
              <input type="number" min={1} max={Math.max(1, opcoes.length)} value={d.max_escolhas} onChange={(e) => mudar({ max_escolhas: e.target.value })} />
            </label>
          </>
        )}
        {d.tipo === 'votacao' && !doItem && (
          <label>
            Maioria exigida
            <select value={d.maioria} onChange={(e) => mudar({ maioria: e.target.value as Maioria })}>
              {(Object.keys(NOME_DA_MAIORIA) as Maioria[]).map((m) => (
                <option key={m} value={m}>
                  {NOME_DA_MAIORIA[m]}
                </option>
              ))}
            </select>
          </label>
        )}
        {!doItem && (
          <>
            <label>
              Quem vota
              <select value={d.quem_vota} onChange={(e) => mudar({ quem_vota: e.target.value as QuemVota })}>
                {(Object.keys(NOME_DE_QUEM_VOTA) as QuemVota[]).map((q) => (
                  <option key={q} value={q}>
                    {NOME_DE_QUEM_VOTA[q]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assembleia {d.quem_vota === 'presentes' ? '*' : '(se for durante uma)'}
              <select required={d.quem_vota === 'presentes'} value={d.encontro_id} onChange={(e) => mudar({ encontro_id: e.target.value })}>
                <option value="">Nenhuma</option>
                {encontros.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.titulo} ({formatarDataHora(e.inicio)})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Prazo para votar (opcional)
          <input type="datetime-local" value={d.fecha_em} onChange={(e) => mudar({ fecha_em: e.target.value })} />
        </label>
        <label className="caixa-marcar largura-total">
          <input type="checkbox" checked={d.secreta} onChange={(e) => mudar({ secreta: e.target.checked, parcial_visivel: false })} />
          Voto secreto (o sistema guarda quem votou, não em quê)
        </label>
        {!d.secreta && (
          <label className="caixa-marcar largura-total">
            <input type="checkbox" checked={d.parcial_visivel} onChange={(e) => mudar({ parcial_visivel: e.target.checked })} />
            Mostrar a parcial enquanto a votação estiver aberta
          </label>
        )}
      </div>
      {!d.secreta && <p className="detalhe">Voto aberto: quando terminar, todos veem quem votou em quê.</p>}
      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Salvar em preparo
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// /votacoes/:id
// ---------------------------------------------------------------------

export function DetalheVotacao() {
  const { id = '' } = useParams()
  return <ConteudoDetalhe key={id} id={id} />
}

function ConteudoDetalhe({ id }: { id: string }) {
  const perfis = usePerfis()
  const local = useLocation()
  const [carga, recarregar] = useCarregar(async () => {
    const [v, r] = await Promise.all([buscarVotacao(id), resultadoVotacao(id)])
    if (v.erro !== null) return v
    if (r.erro !== null) return r
    return ok({ v: v.dados, r: r.dados })
  })
  const [retorno, setRetorno] = useState<Retorno>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const aberta = carga.situacao === 'ok' && carga.dados.v?.situacao === 'aberta' && !carga.dados.r?.fechada
  // aberta, a tela se atualiza sozinha (a participação e, se houver, a parcial) — bom para o telão da assembleia
  useEffect(() => {
    if (!aberta) return
    const relogio = window.setInterval(recarregar, 10_000)
    return () => window.clearInterval(relogio)
  }, [aberta, recarregar])
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <>
      <p>
        <Link to="/votacoes">← Votações e enquetes</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ v, r }) =>
          !v || !r ? (
            <Aviso titulo="Votação não encontrada">
              <p>Ela pode estar ainda em preparo.</p>
            </Aviso>
          ) : (
            <>
              <h1>{v.titulo}</h1>
              <p>
                <span className="etiqueta etiqueta-neutra">{NOME_DO_TIPO_VOTACAO[v.tipo]}</span> <Situacao situacao={v.situacao} fechada={r.fechada} />{' '}
                {v.secreta ? <span className="etiqueta etiqueta-neutra">Voto secreto</span> : <span className="etiqueta etiqueta-neutra">Voto aberto</span>}
              </p>
              {v.descricao && <p className="texto-edital">{v.descricao}</p>}
              <dl className="definicoes">
                <dt>Quem vota</dt>
                <dd>{NOME_DE_QUEM_VOTA[v.quem_vota]}</dd>
                {v.encontro && (
                  <>
                    <dt>Assembleia</dt>
                    <dd>
                      {v.encontro.titulo}
                      {v.pauta_id && v.encontro_id && organiza(perfis) && (
                        <>
                          {' '}
                          (<Link to={`/assembleias/${v.encontro_id}/conducao`}>condução</Link>)
                        </>
                      )}
                    </dd>
                  </>
                )}
                {v.tipo === 'votacao' && v.maioria && (
                  <>
                    <dt>Maioria exigida</dt>
                    <dd>{NOME_DA_MAIORIA[v.maioria]}</dd>
                  </>
                )}
                {v.tipo === 'enquete' && v.max_escolhas > 1 && (
                  <>
                    <dt>Escolhas</dt>
                    <dd>até {v.max_escolhas} opções</dd>
                  </>
                )}
                {v.fecha_em && (
                  <>
                    <dt>Prazo</dt>
                    <dd>até {formatarDataHora(v.fecha_em)}</dd>
                  </>
                )}
                {v.situacao !== 'rascunho' && (
                  <>
                    <dt>Participação</dt>
                    <dd>
                      {r.votantes} de {r.aptos} {r.aptos === 1 ? 'pessoa que pode votar' : 'pessoas que podem votar'}
                    </dd>
                  </>
                )}
                {v.situacao === 'cancelada' && (
                  <>
                    <dt>Cancelada</dt>
                    <dd>{v.motivo_cancelamento}</dd>
                  </>
                )}
              </dl>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

              {v.situacao === 'aberta' && !r.fechada && !r.eu_votei && r.posso_votar && (
                <FormVoto v={v} aoConcluir={concluir} />
              )}
              {r.eu_votei && (
                <p className="sucesso" role="note">
                  Você já votou{r.minhas_opcoes && v.opcoes.length > 0 && `: ${v.opcoes.filter((o) => r.minhas_opcoes?.includes(o.id)).map((o) => o.texto).join(', ')}`}.
                  {v.secreta && ' O seu voto é secreto: o sistema guardou só que você votou.'}
                </p>
              )}
              {v.situacao === 'aberta' && !r.fechada && !r.eu_votei && !r.posso_votar && (
                <p className="detalhe">Você não está entre os que votam nesta votação ({NOME_DE_QUEM_VOTA[v.quem_vota].toLowerCase()}).</p>
              )}

              {v.situacao !== 'rascunho' && v.situacao !== 'cancelada' && <Apuracao v={v} r={r} />}
              {organiza(perfis) && <AcoesDeQuemOrganiza v={v} r={r} aoConcluir={concluir} />}
            </>
          )
        }
      </MostrarCarga>
    </>
  )
}

function FormVoto({ v, aoConcluir }: { v: Votacao; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  const varias = v.max_escolhas > 1
  const alternar = (id: string, marcar: boolean) => {
    setConfirmando(false)
    if (!varias) return setEscolhidas([id])
    setEscolhidas((atual) => (marcar ? [...atual, id] : atual.filter((x) => x !== id)))
  }
  const textos = v.opcoes.filter((o) => escolhidas.includes(o.id)).map((o) => o.texto)
  return (
    <form
      aria-label="Seu voto"
      className="painel"
      onSubmit={(e) => {
        e.preventDefault()
        if (!confirmando) return setConfirmando(true)
        void umaVez(async () => aoConcluir(await votar(v.id, escolhidas), 'Voto registrado. Obrigado!'))
      }}
    >
      <fieldset>
        <legend>{varias ? `Seu voto (até ${v.max_escolhas} opções)` : 'Seu voto'}</legend>
        {v.opcoes.map((o) => (
          <label key={o.id} className="caixa-marcar">
            <input
              type={varias ? 'checkbox' : 'radio'}
              name="voto"
              checked={escolhidas.includes(o.id)}
              disabled={varias && !escolhidas.includes(o.id) && escolhidas.length >= v.max_escolhas}
              onChange={(e) => alternar(o.id, e.target.checked)}
            />
            {o.texto}
          </label>
        ))}
      </fieldset>
      {confirmando && (
        <p className="aviso-texto" role="status">
          Confirma o voto em <strong>{textos.join(', ')}</strong>? Depois de confirmado, o voto não muda.
        </p>
      )}
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando || escolhidas.length === 0}>
          {confirmando ? 'Confirmar o voto' : 'Votar'}
        </button>
        {confirmando && (
          <button type="button" className="botao-texto" onClick={() => setConfirmando(false)}>
            Mudar a escolha
          </button>
        )}
      </div>
    </form>
  )
}

function Apuracao({ v, r }: { v: Votacao; r: ResultadoVotacao }) {
  if (!r.mostra_contagem) {
    return (
      <p className="detalhe">
        {v.secreta ? 'Voto secreto: a contagem só aparece quando a votação terminar.' : 'A contagem aparece quando a votação terminar.'}
      </p>
    )
  }
  // na votação, a porcentagem é sobre os votos válidos (a favor + contra); na enquete, sobre quem votou
  const base = v.tipo === 'votacao' ? r.opcoes.filter((o) => o.papel !== 'abstencao').reduce((s, o) => s + (o.votos ?? 0), 0) : r.votantes
  return (
    <section className="painel" aria-labelledby="titulo-apuracao">
      <h2 id="titulo-apuracao">{r.fechada ? 'Resultado' : 'Parcial'}</h2>
      {r.aprovada !== null && (
        <p>
          <span className={r.aprovada ? 'etiqueta etiqueta-ok' : 'etiqueta etiqueta-atraso'}>{r.aprovada ? 'Aprovado' : 'Rejeitado'}</span>
          {v.deliberacao_id && ' — registrado na votação do item da pauta (vai para a ata).'}
        </p>
      )}
      <ul className="resultado-opcoes" aria-label="Contagem">
        {r.opcoes.map((o) => {
          const votos = o.votos ?? 0
          const pct = o.papel === 'abstencao' || base === 0 ? null : Math.round((votos * 100) / base)
          return (
            <li key={o.id} className="resultado-opcao">
              <span>
                <strong>{o.texto}</strong>: {votos === 1 ? '1 voto' : `${votos} votos`}
                {pct !== null && ` (${pct}%)`}
              </span>
              <span className="resultado-barra" aria-hidden="true">
                <span style={{ width: `${pct ?? 0}%` }} />
              </span>
            </li>
          )
        })}
      </ul>
      {v.tipo === 'votacao' && <p className="detalhe">A abstenção não entra na conta da maioria (votos válidos = a favor + contra).</p>}
      {r.nominal && r.nominal.length > 0 && (
        <details className="acao-recolhida">
          <summary>Quem votou em quê (voto aberto)</summary>
          <ul className="lista-simples" aria-label="Votos nominais">
            {r.nominal.map((n) => (
              <li key={n.nome}>
                {n.nome}: {(n.opcoes ?? []).join(', ')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function AcoesDeQuemOrganiza({
  v,
  r,
  aoConcluir,
}: {
  v: Votacao
  r: ResultadoVotacao
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  if (v.situacao !== 'rascunho' && v.situacao !== 'aberta') return null
  return (
    <section className="painel" aria-labelledby="titulo-organizar">
      <h2 id="titulo-organizar">Organizar</h2>
      <div className="acoes">
        {v.situacao === 'rascunho' && (
          <>
            <button
              type="button"
              className="botao"
              disabled={enviando}
              onClick={() => void umaVez(async () => aoConcluir(await abrirVotacao(v.id), 'Votação aberta: os associados já podem votar.'))}
            >
              Abrir a votação
            </button>
            <Link to={`/votacoes/${v.id}/editar`} className="botao botao-secundario">
              Alterar
            </Link>
          </>
        )}
        {v.situacao === 'aberta' && (
          <BotaoConfirmar
            texto="Encerrar e apurar"
            confirmar="Confirmar — encerrar e apurar"
            aviso={`${r.votantes} de ${r.aptos} votaram. Depois de encerrada, ninguém mais vota${v.pauta_id ? ' e o resultado vai para a votação do item da pauta' : ''}.`}
            desabilitado={enviando}
            aoConfirmar={() => void umaVez(async () => aoConcluir(await encerrarVotacao(v.id), 'Votação encerrada e apurada.'))}
          />
        )}
      </div>
      <details className="acao-recolhida">
        <summary>Cancelar</summary>
        <form
          className="form-linha"
          aria-label="Cancelar a votação"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => aoConcluir(await cancelarVotacao(v.id, motivo), 'Votação cancelada.'))
          }}
        >
          <label>
            Motivo *
            <input required minLength={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <button type="submit" className="botao botao-perigo" disabled={enviando}>
            Cancelar a votação
          </button>
        </form>
      </details>
    </section>
  )
}

// ---------------------------------------------------------------------
// No Início: as votações abertas em que a pessoa ainda não votou
// ---------------------------------------------------------------------
