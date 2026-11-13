// Fase 4.1 — Assembleias e reuniões: lista, preparar (pauta e edital), convocar, cancelar e compartilhar.
// Quem prepara: secretaria ou presidência. Quem convoca assembleia: o presidente (Art. 16, §2º).
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoArquivar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  arquivarEncontro,
  buscarConfigAssembleias,
  buscarEncontro,
  cancelarEncontro,
  convocarEncontro,
  listarEncontros,
  NOME_DA_MAIORIA,
  NOME_DA_SITUACAO_ENCONTRO,
  NOME_DO_TIPO,
  salvarEncontro,
  SIGLA_DO_TIPO,
  TIPOS_ENCONTRO,
  type ConfigAssembleias,
  type Encontro,
  type EncontroCompleto,
  type ItemPauta,
  type Maioria,
  type SituacaoEncontro,
  type TipoEncontro,
} from '../../dados/encontros'
import { ok } from '../../dados/cliente'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataHora } from '../../utilitarios/formatos'
import {
  avisosDaData,
  dataPorExtenso,
  diaEmParauapebas,
  doCampoDataHora,
  mesmasDatasNosProximosMeses,
  paraCampoDataHora,
  textoDoEdital,
  textoWhatsApp,
} from '../../utilitarios/encontros'

function usePerfis(): readonly Perfil[] {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

const prepara = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')
/** Mesma regra do banco: assembleia, só o presidente; reunião mensal, a secretaria também. */
const conduz = (perfis: readonly Perfil[], tipo: TipoEncontro) =>
  tipo === 'reuniao_mensal' ? prepara(perfis) : perfis.includes('presidencia')

const CLASSE_SITUACAO: Record<SituacaoEncontro, string> = {
  agendado: 'etiqueta etiqueta-neutra',
  convocado: 'etiqueta etiqueta-ok',
  realizado: 'etiqueta etiqueta-marca',
  cancelado: 'etiqueta etiqueta-cancelada',
}

function Situacao({ situacao }: { situacao: SituacaoEncontro }) {
  return <span className={CLASSE_SITUACAO[situacao]}>{NOME_DA_SITUACAO_ENCONTRO[situacao]}</span>
}

/** Link da convocação no site (só assembleias convocadas aparecem lá). */
function linkPublico(e: Pick<Encontro, 'id' | 'tipo' | 'situacao'>): string | null {
  if (e.tipo === 'reuniao_mensal' || e.situacao === 'agendado') return null
  return `${window.location.origin}${import.meta.env.BASE_URL}convocacoes/${e.id}`
}

// ---------------------------------------------------------------------
// /assembleias — lista
// ---------------------------------------------------------------------

export function ListaEncontros() {
  const perfis = usePerfis()
  const [carga, recarregar] = useCarregar(listarEncontros)
  const [mostrar, setMostrar] = useState<'proximos' | 'anteriores'>('proximos')
  const [agora] = useState(() => Date.now())
  return (
    <>
      <h1>Assembleias e reuniões</h1>
      <p className="detalhe">
        Assembleias Gerais Ordinárias (2ª quinzena de abril e de outubro), Extraordinárias e reuniões mensais. A convocação
        das assembleias é do presidente, com 30 dias de antecedência, e fica publicada no site.
      </p>
      {prepara(perfis) && (
        <div className="acoes">
          <Link className="botao" to="/assembleias/novo">
            Preparar assembleia ou reunião
          </Link>
          <Link className="botao botao-secundario" to="/configuracoes#assembleias">
            Regras (prazos do estatuto)
          </Link>
        </div>
      )}
      <div className="abas" role="tablist" aria-label="Quais encontros">
        {(['proximos', 'anteriores'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mostrar === m}
            className={mostrar === m ? 'aba ativa' : 'aba'}
            onClick={() => setMostrar(m)}
          >
            {m === 'proximos' ? 'Próximos' : 'Anteriores'}
          </button>
        ))}
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(todos) => {
          const lista = todos
            .filter((e) => (mostrar === 'proximos' ? new Date(e.inicio).getTime() >= agora : new Date(e.inicio).getTime() < agora))
            .sort((a, b) => (mostrar === 'proximos' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)))
          if (lista.length === 0) {
            return <p className="vazio">{mostrar === 'proximos' ? 'Nenhum encontro marcado.' : 'Nenhum encontro anterior.'}</p>
          }
          return (
            <ul className="lista" aria-label="Encontros">
              {lista.map((e) => (
                <li key={e.id} className="lista-item lista-item-estatico" aria-label={e.titulo}>
                  <strong>
                    <span className="etiqueta etiqueta-neutra">{SIGLA_DO_TIPO[e.tipo]}</span> {e.titulo}
                  </strong>
                  <span>
                    {formatarDataHora(e.inicio)} · {e.local}
                  </span>
                  <span>
                    <Situacao situacao={e.situacao} />
                  </span>
                  <Link to={`/assembleias/${e.id}`} className="botao-texto alinhar-esquerda">
                    Abrir
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
// /assembleias/novo e /assembleias/:id/editar — preparar
// ---------------------------------------------------------------------

export function NovoEncontro() {
  return <TelaFormulario id={null} />
}

export function EditarEncontro() {
  const { id = '' } = useParams()
  return <TelaFormulario key={id} id={id} />
}

function TelaFormulario({ id }: { id: string | null }) {
  const perfis = usePerfis()
  const [carga, recarregar] = useCarregar(async () => {
    const [config, encontro] = await Promise.all([buscarConfigAssembleias(), id ? buscarEncontro(id) : Promise.resolve(ok(null))])
    if (config.erro !== null) return config
    if (encontro.erro !== null) return encontro
    return ok({ config: config.dados, encontro: encontro.dados })
  })
  if (perfis.length === 0) return <Carregando />
  if (!prepara(perfis)) {
    return (
      <Aviso titulo="Sem permissão">
        <p>Só a secretaria ou a presidência preparam assembleias e reuniões.</p>
      </Aviso>
    )
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to={id ? `/assembleias/${id}` : '/assembleias'}>← Voltar</Link>
      </p>
      <h1>{id ? 'Alterar o encontro' : 'Preparar assembleia ou reunião'}</h1>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ config, encontro }) =>
          id && (!encontro || encontro.situacao !== 'agendado') ? (
            <Aviso titulo="Não dá para alterar">
              <p>Depois de convocado, o encontro não muda. Para mudar, cancele e convoque de novo.</p>
            </Aviso>
          ) : (
            <FormEncontro config={config} encontro={encontro} />
          )
        }
      </MostrarCarga>
    </>
  )
}

type Rascunho = {
  tipo: TipoEncontro
  titulo: string
  /** campo data e hora, hora de Parauapebas */
  inicio: string
  local: string
  edital: string
  fundamento: string
  pauta: ItemPauta[]
}

const ITEM_VAZIO: ItemPauta = { titulo: '', descricao: null, deliberativo: false, maioria: null }

function tituloSugerido(tipo: TipoEncontro, inicio: string): string {
  if (!inicio) return NOME_DO_TIPO[tipo]
  const d = new Date(doCampoDataHora(inicio))
  const mesAno = d.toLocaleDateString('pt-BR', { timeZone: 'America/Belem', month: 'long', year: 'numeric' })
  return `${NOME_DO_TIPO[tipo]} — ${mesAno}`
}

function FormEncontro({ config, encontro }: { config: ConfigAssembleias; encontro: EncontroCompleto | null }) {
  const navegar = useNavigate()
  const [r, setR] = useState<Rascunho>(() =>
    encontro
      ? {
          tipo: encontro.tipo,
          titulo: encontro.titulo,
          inicio: paraCampoDataHora(encontro.inicio),
          local: encontro.local,
          edital: encontro.edital ?? '',
          fundamento: encontro.fundamento ?? '',
          pauta: encontro.pauta.map(({ titulo, descricao, deliberativo, maioria }) => ({ titulo, descricao, deliberativo, maioria })),
        }
      : { tipo: 'ago', titulo: '', inicio: '', local: '', edital: '', fundamento: '', pauta: [{ ...ITEM_VAZIO }] },
  )
  const [repetir, setRepetir] = useState(0)
  const [retorno, setRetorno] = useState<{ erro?: string }>({})
  const [enviando, umaVez] = useUmaVez()
  const [hoje] = useState(() => diaEmParauapebas(new Date()))
  const avisos = useMemo(() => (r.inicio ? avisosDaData(r.tipo, doCampoDataHora(r.inicio), config, hoje) : []), [r.tipo, r.inicio, config, hoje])
  const mudar = (parte: Partial<Rascunho>) => setR((atual) => ({ ...atual, ...parte }))
  const mudarItem = (i: number, parte: Partial<ItemPauta>) =>
    setR((atual) => ({ ...atual, pauta: atual.pauta.map((p, j) => (j === i ? { ...p, ...parte } : p)) }))
  const moverItem = (i: number, d: -1 | 1) =>
    setR((atual) => {
      const j = i + d
      if (j < 0 || j >= atual.pauta.length) return atual
      const pauta = [...atual.pauta]
      ;[pauta[i], pauta[j]] = [pauta[j], pauta[i]]
      return { ...atual, pauta }
    })

  function dados(inicio: string) {
    return {
      tipo: r.tipo,
      titulo: r.titulo.trim() || tituloSugerido(r.tipo, r.inicio),
      inicio,
      local: r.local,
      edital: r.edital,
      fundamento: r.tipo === 'age' ? r.fundamento : '',
      pauta: r.pauta
        .filter((p) => p.titulo.trim())
        .map((p) => ({
          titulo: p.titulo.trim(),
          descricao: p.descricao?.trim() || null,
          deliberativo: r.tipo !== 'reuniao_mensal' && p.deliberativo,
          maioria: r.tipo !== 'reuniao_mensal' && p.deliberativo ? (p.maioria ?? 'simples') : null,
        })),
    }
  }

  return (
    <form
      aria-label="Encontro"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => {
          const inicio = doCampoDataHora(r.inicio)
          const res = await salvarEncontro(encontro?.id ?? null, dados(inicio))
          if (res.erro !== null) return setRetorno({ erro: res.erro })
          // reunião mensal: cria também as dos próximos meses (mesma semana e dia da semana)
          if (!encontro && r.tipo === 'reuniao_mensal' && repetir > 0) {
            for (const data of mesmasDatasNosProximosMeses(inicio, repetir)) {
              // o título escolhido continua, com o mês de cada uma
              const mes = tituloSugerido('reuniao_mensal', paraCampoDataHora(data))
              const titulo = r.titulo.trim() ? `${r.titulo.trim()} — ${mes.split(' — ')[1]}` : mes
              const outra = await salvarEncontro(null, { ...dados(data), titulo })
              if (outra.erro !== null) return setRetorno({ erro: `A primeira foi criada, mas não as seguintes: ${outra.erro}` })
            }
          }
          navegar(`/assembleias/${res.dados}`, { state: { mensagem: encontro ? 'Alterações salvas.' : 'Encontro preparado. Confira e convoque.' } })
        })
      }}
    >
      <div className="grade-form">
        <label>
          Tipo *
          <select value={r.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoEncontro })}>
            {TIPOS_ENCONTRO.map((t) => (
              <option key={t} value={t}>
                {NOME_DO_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data e hora (1ª chamada) *
          <input type="datetime-local" required value={r.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </label>
        <label className="largura-total">
          Título
          <input value={r.titulo} maxLength={200} onChange={(e) => mudar({ titulo: e.target.value })} placeholder={tituloSugerido(r.tipo, r.inicio)} />
        </label>
        <label className="largura-total">
          Local *
          <input required maxLength={300} value={r.local} onChange={(e) => mudar({ local: e.target.value })} placeholder="Ex.: Sede do COMEP — endereço" />
        </label>
        {r.tipo === 'age' && (
          <label className="largura-total">
            Quem pediu a Assembleia Extraordinária? * (Art. 16, §3º)
            <input
              required
              maxLength={1000}
              value={r.fundamento}
              onChange={(e) => mudar({ fundamento: e.target.value })}
              placeholder="Ex.: maioria do Conselho Diretor, reunião de 10/11/2026 — ou pedido assinado por 3/5 dos associados"
            />
          </label>
        )}
      </div>
      {avisos.length > 0 && (
        <ul className="lista-pendencias" aria-label="Prazos">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <fieldset className="pauta-campos">
        <legend>Pauta</legend>
        {r.tipo === 'reuniao_mensal' && (
          <p className="detalhe">Reunião mensal não tem votação de assembleia: os itens são de informe ou conversa.</p>
        )}
        <ol className="pauta-lista">
          {r.pauta.map((p, i) => (
            <li key={i} className="pauta-item">
              <label>
                Item {i + 1}
                <input
                  aria-label={`Item ${i + 1} da pauta`}
                  maxLength={300}
                  value={p.titulo}
                  onChange={(e) => mudarItem(i, { titulo: e.target.value })}
                  placeholder="Ex.: Prestação de contas do exercício 2026/2027"
                />
              </label>
              {r.tipo !== 'reuniao_mensal' && (
                <div className="form-linha">
                  <label className="caixa-marcar">
                    <input
                      type="checkbox"
                      checked={p.deliberativo}
                      onChange={(e) => mudarItem(i, { deliberativo: e.target.checked, maioria: e.target.checked ? (p.maioria ?? 'simples') : null })}
                    />
                    Vai a votação
                  </label>
                  {p.deliberativo && (
                    <label>
                      Maioria exigida
                      <select value={p.maioria ?? 'simples'} onChange={(e) => mudarItem(i, { maioria: e.target.value as Maioria })}>
                        {(Object.keys(NOME_DA_MAIORIA) as Maioria[]).map((m) => (
                          <option key={m} value={m}>
                            {NOME_DA_MAIORIA[m]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              <span className="acoes-linha">
                <button type="button" className="botao-texto" disabled={i === 0} onClick={() => moverItem(i, -1)}>
                  Subir
                </button>
                <button type="button" className="botao-texto" disabled={i === r.pauta.length - 1} onClick={() => moverItem(i, 1)}>
                  Descer
                </button>
                <button
                  type="button"
                  className="botao-texto"
                  onClick={() => setR((atual) => ({ ...atual, pauta: atual.pauta.filter((_, j) => j !== i) }))}
                >
                  Tirar
                </button>
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="botao botao-secundario"
          disabled={r.pauta.length >= 50}
          onClick={() => setR((atual) => ({ ...atual, pauta: [...atual.pauta, { ...ITEM_VAZIO }] }))}
        >
          + Item da pauta
        </button>
      </fieldset>

      <label className="largura-total">
        Texto do edital {r.tipo !== 'reuniao_mensal' && '* (obrigatório para convocar)'}
        <textarea rows={12} maxLength={6000} value={r.edital} onChange={(e) => mudar({ edital: e.target.value })} />
      </label>
      <div className="acoes">
        <button
          type="button"
          className="botao botao-secundario"
          disabled={!r.inicio}
          onClick={() =>
            mudar({
              edital: textoDoEdital({
                tipo: r.tipo,
                inicio: doCampoDataHora(r.inicio),
                local: r.local,
                fundamento: r.fundamento,
                pauta: r.pauta,
                minutosSegundaChamada: config.minutos_segunda_chamada,
                hoje: new Date(),
              }),
            })
          }
        >
          {r.edital ? 'Gerar o texto do edital de novo (substitui o atual)' : 'Gerar o texto do edital'}
        </button>
      </div>

      {!encontro && r.tipo === 'reuniao_mensal' && (
        <label className="campo-medio">
          Criar também para os próximos meses (mesma semana e dia da semana)
          <select value={repetir} onChange={(e) => setRepetir(Number(e.target.value))}>
            <option value={0}>Não, só esta</option>
            {[1, 2, 3, 5, 11].map((n) => (
              <option key={n} value={n}>
                Mais {n} {n === 1 ? 'mês' : 'meses'}
              </option>
            ))}
          </select>
        </label>
      )}

      <Mensagem erro={retorno.erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {encontro ? 'Salvar alterações' : 'Salvar (ainda sem convocar)'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// /assembleias/:id — detalhe, convocar, cancelar, compartilhar
// ---------------------------------------------------------------------

export function DetalheEncontro() {
  const { id = '' } = useParams()
  return <ConteudoDetalhe key={id} id={id} />
}

function ConteudoDetalhe({ id }: { id: string }) {
  const perfis = usePerfis()
  const navegar = useNavigate()
  const local = useLocation()
  const [carga, recarregar] = useCarregar(() => buscarEncontro(id))
  // mensagem trazida da tela anterior (ex.: "Encontro preparado")
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const [enviando, umaVez] = useUmaVez()
  const [perguntando, setPerguntando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
      <p className="nao-imprimir">
        <Link to="/assembleias">← Assembleias e reuniões</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(e) => {
          if (!e) {
            return (
              <Aviso titulo="Encontro não encontrado">
                <p>Ele pode ter sido arquivado, ou ainda não foi convocado.</p>
              </Aviso>
            )
          }
          const link = linkPublico(e)
          const podeConduzir = conduz(perfis, e.tipo)
          return (
            <>
              <h1>{e.titulo}</h1>
              <p>
                <span className="etiqueta etiqueta-neutra">{NOME_DO_TIPO[e.tipo]}</span> <Situacao situacao={e.situacao} />
              </p>
              <dl className="definicoes">
                <dt>Quando</dt>
                <dd>{dataPorExtenso(e.inicio)} (1ª chamada)</dd>
                <dt>Local</dt>
                <dd>{e.local}</dd>
                {e.fundamento && (
                  <>
                    <dt>Pedida por</dt>
                    <dd>{e.fundamento}</dd>
                  </>
                )}
                {e.convocado_em && (
                  <>
                    <dt>Convocada em</dt>
                    <dd>{formatarDataHora(e.convocado_em)}</dd>
                  </>
                )}
                {e.situacao === 'cancelado' && (
                  <>
                    <dt>Cancelada em</dt>
                    <dd>
                      {e.cancelado_em ? formatarDataHora(e.cancelado_em) : '—'} — {e.motivo_cancelamento}
                    </dd>
                  </>
                )}
              </dl>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

              <section className="painel" aria-labelledby="titulo-pauta">
                <h2 id="titulo-pauta">Pauta</h2>
                {e.pauta.length === 0 ? (
                  <p className="vazio">Sem itens.</p>
                ) : (
                  <ol className="pauta-lista" aria-label="Pauta">
                    {e.pauta.map((p) => (
                      <li key={p.ordem}>
                        <strong>{p.titulo}</strong>
                        {p.deliberativo && p.maioria && <span className="detalhe"> — votação: {NOME_DA_MAIORIA[p.maioria]}</span>}
                        {p.descricao && <p className="detalhe">{p.descricao}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {e.edital && (
                <section className="painel edital" aria-labelledby="titulo-edital">
                  <h2 id="titulo-edital">Edital</h2>
                  <p className="texto-edital">{e.edital}</p>
                </section>
              )}

              {/* Ações de quem prepara e de quem convoca */}
              <div className="acoes nao-imprimir">
                {e.situacao === 'agendado' && prepara(perfis) && (
                  <Link className="botao botao-secundario" to={`/assembleias/${e.id}/editar`}>
                    Alterar
                  </Link>
                )}
                {e.situacao === 'agendado' && podeConduzir && !perguntando && (
                  <button type="button" className="botao" onClick={() => setPerguntando(true)}>
                    {e.tipo === 'reuniao_mensal' ? 'Publicar a reunião' : 'Convocar a assembleia'}
                  </button>
                )}
                {e.situacao === 'agendado' && podeConduzir && perguntando && (
                  <span className="confirmar-linha">
                    <button
                      type="button"
                      className="botao botao-perigo-cheio"
                      disabled={enviando}
                      onClick={() =>
                        void umaVez(async () => {
                          setPerguntando(false)
                          concluir(
                            await convocarEncontro(e.id),
                            e.tipo === 'reuniao_mensal' ? 'Reunião publicada.' : 'Assembleia convocada: já aparece no site.',
                          )
                        })
                      }
                    >
                      {e.tipo === 'reuniao_mensal' ? 'Confirmar — publicar' : 'Confirmar — convocar (não muda mais)'}
                    </button>
                    <button type="button" className="botao-texto" onClick={() => setPerguntando(false)}>
                      Não
                    </button>
                  </span>
                )}
                {e.situacao === 'agendado' && prepara(perfis) && !podeConduzir && (
                  <span className="detalhe">Pronta? Peça ao presidente para convocar (Art. 16, §2º).</span>
                )}
                {e.situacao === 'convocado' && (
                  <a
                    className="botao botao-secundario"
                    href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp({ ...e, link }))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Compartilhar no WhatsApp
                  </a>
                )}
                {e.edital && (
                  <button type="button" className="botao botao-secundario" onClick={() => window.print()}>
                    Imprimir o edital
                  </button>
                )}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer">
                    Ver no site
                  </a>
                )}
                {(e.situacao === 'agendado' || e.situacao === 'cancelado') && prepara(perfis) && (
                  <BotaoArquivar
                    rotulo={`Arquivar ${e.titulo}`}
                    aoConfirmar={() =>
                      void umaVez(async () => {
                        const r = await arquivarEncontro(e.id)
                        if (r.erro !== null) setRetorno({ erro: r.erro })
                        else navegar('/assembleias')
                      })
                    }
                  />
                )}
              </div>

              {(e.situacao === 'agendado' || e.situacao === 'convocado') && podeConduzir && (
                <details className="acao-recolhida nao-imprimir">
                  <summary>Cancelar este encontro</summary>
                  <form
                    className="form-linha"
                    aria-label="Cancelar o encontro"
                    onSubmit={(ev) => {
                      ev.preventDefault()
                      void umaVez(async () => {
                        concluir(await cancelarEncontro(e.id, motivo), 'Encontro cancelado.')
                        setMotivo('')
                      })
                    }}
                  >
                    <label>
                      Motivo *
                      <input required value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ex.: mudança de local" />
                    </label>
                    <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                      Cancelar o encontro
                    </button>
                  </form>
                  <p className="detalhe">
                    {e.situacao === 'convocado' && e.tipo !== 'reuniao_mensal'
                      ? 'O site passa a mostrar "cancelada", com o motivo. Para uma nova data, prepare e convoque de novo (com o prazo do estatuto).'
                      : 'Nada se apaga: o encontro fica registrado como cancelado.'}
                  </p>
                </details>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}
