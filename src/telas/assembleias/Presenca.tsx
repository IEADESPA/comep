// Fase 4.2 — Lista de presença (secretaria e presidência) e faltas/justificativas.
// A presença vale como "livro ou controle similar" (Art. 16, §1º). Check-in pelo QR Code da credencial:
//   * aqui mesmo, com a câmera (navegadores que leem QR Code: Chrome e Edge no Android e no computador);
//   * ou com a câmera do celular: o QR abre a página de validação, que mostra o botão "Marcar presença".
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  buscarEncontro,
  buscarConfigAssembleias,
  decidirJustificativa,
  desfazerPresenca,
  encerrarPresenca,
  faltasDosAssociados,
  listaPresenca,
  listarJustificativas,
  registrarPresenca,
  registrarPresencaPorCodigo,
  type JustificativaParaDecidir,
  type LinhaPresenca,
} from '../../dados/encontros'
import { ok } from '../../dados/cliente'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { contemTexto, formatarDataHora } from '../../utilitarios/formatos'
import { codigoDoQr, dataPorExtenso } from '../../utilitarios/encontros'

type Retorno = { sucesso?: string; erro?: string }

const horaDe = (instante: string) =>
  new Date(instante).toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' })

/** A lista fica aberta de 6 horas antes a 18 horas depois do horário marcado (a mesma regra do banco). */
const HORA = 3_600_000
const ABRE_ANTES = 6 * HORA
const FECHA_DEPOIS = 18 * HORA

// ---------------------------------------------------------------------
// Leitor de QR Code com a câmera (quando o navegador tem o leitor embutido)
// ---------------------------------------------------------------------

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type ConstrutorDetector = new (opcoes: { formats: string[] }) => Detector

function construtorDetector(): ConstrutorDetector | null {
  return (window as unknown as { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector ?? null
}

function LeitorQr({ aoLer }: { aoLer: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ligado, setLigado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ultimo = useRef<{ codigo: string; quando: number } | null>(null)
  const temLeitor = construtorDetector() !== null

  useEffect(() => {
    if (!ligado) return
    const Construtor = construtorDetector()
    if (!Construtor) return
    let fluxo: MediaStream | null = null
    let ativo = true
    let tempo = 0
    const detector = new Construtor({ formats: ['qr_code'] })
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((f) => {
        fluxo = f
        // a câmera foi desligada (ou a tela fechada) antes de o navegador liberar: solta a câmera
        if (!ativo) {
          f.getTracks().forEach((t) => t.stop())
          return
        }
        if (!video.current) return
        video.current.srcObject = f
        void video.current.play()
        const ler = async () => {
          if (!ativo || !video.current) return
          try {
            for (const achado of await detector.detect(video.current)) {
              const codigo = codigoDoQr(achado.rawValue)
              const agora = Date.now()
              // a mesma credencial na frente da câmera não registra de novo por 3 segundos
              if (codigo && !(ultimo.current?.codigo === codigo && agora - ultimo.current.quando < 3000)) {
                ultimo.current = { codigo, quando: agora }
                aoLer(codigo)
              }
            }
          } catch {
            // quadro sem imagem ainda: tenta no próximo
          }
          tempo = window.setTimeout(() => void ler(), 350)
        }
        void ler()
      })
      .catch(() => setErro('Não foi possível usar a câmera. Confira a permissão do navegador.'))
    return () => {
      ativo = false
      window.clearTimeout(tempo)
      fluxo?.getTracks().forEach((t) => t.stop())
    }
  }, [ligado, aoLer])

  if (!temLeitor) {
    return (
      <p className="detalhe">
        Este navegador não lê QR Code aqui dentro. Use a <strong>câmera do celular</strong>: aponte para o QR Code da
        credencial; a página de validação abre com o botão <strong>"Marcar presença"</strong>. Ou busque o nome abaixo.
      </p>
    )
  }
  return (
    <div className="leitor-qr">
      <button type="button" className="botao" onClick={() => setLigado((v) => !v)}>
        {ligado ? 'Desligar a câmera' : 'Ler o QR Code das credenciais'}
      </button>
      {ligado && <video ref={video} className="leitor-video" muted playsInline aria-label="Câmera lendo QR Code" />}
      <Mensagem erro={erro} />
    </div>
  )
}

// ---------------------------------------------------------------------
// /assembleias/:id/presenca — lista de presença
// ---------------------------------------------------------------------

export function ListaDePresenca() {
  const { id = '' } = useParams()
  return <ConteudoPresenca key={id} id={id} />
}

function ConteudoPresenca({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, lista] = await Promise.all([buscarEncontro(id), listaPresenca(id)])
    if (encontro.erro !== null) return encontro
    if (lista.erro !== null) return lista
    return ok({ encontro: encontro.dados, lista: lista.dados })
  })
  const [busca, setBusca] = useState('')
  const [retorno, setRetorno] = useState<Retorno>({})
  const [perguntando, setPerguntando] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  // a hora de agora, atualizada a cada 30 segundos (o botão de encerrar aparece quando o encontro começa)
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(relogio)
  }, [])

  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  const aoLer = useMemo(
    () => (codigo: string) =>
      void registrarPresencaPorCodigo(id, codigo).then((r) => {
        if (r.erro !== null) return setRetorno({ erro: r.erro })
        setRetorno({
          sucesso:
            r.dados.resultado === 'ja_presente'
              ? `${r.dados.nome} já estava presente.`
              : `Presença registrada: ${r.dados.nome}${r.dados.em_dia ? '' : ' (contribuição em atraso: não vota)'}.`,
        })
        recarregar()
      }),
    [id, recarregar],
  )

  return (
    <>
      <p className="nao-imprimir">
        <Link to={`/assembleias/${id}`}>← Voltar ao encontro</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ encontro, lista }) => {
          if (!encontro) {
            return (
              <Aviso titulo="Encontro não encontrado">
                <p>Ele pode ter sido arquivado.</p>
              </Aviso>
            )
          }
          const presentes = lista.filter((l) => l.presente_em)
          const aptos = presentes.filter((l) => l.em_dia).length
          const ativos = lista.length
          const inicio = new Date(encontro.inicio).getTime()
          const convocado = encontro.situacao === 'convocado' && !encontro.presenca_encerrada_em
          const cedo = agora < inicio - ABRE_ANTES
          const tarde = agora > inicio + FECHA_DEPOIS
          // marcar e desfazer: só na janela do encontro
          const aberta = convocado && !cedo && !tarde
          const assembleia = encontro.tipo !== 'reuniao_mensal'
          // encerrar: depois do horário marcado; assembleia, só depois de instalada (quórum)
          const podeEncerrar = convocado && inicio <= agora + 60_000 && (!assembleia || encontro.instalada_em !== null)
          const visiveis = lista.filter((l) => contemTexto(l.nome, busca) || String(l.numero_registro) === busca.trim().replace(/^0+/, ''))
          return (
            <>
              <h1>Lista de presença</h1>
              <p>
                <strong>{encontro.titulo}</strong> — {dataPorExtenso(encontro.inicio)}
              </p>
              <dl className="definicoes" aria-label="Resumo da presença">
                <dt>Presentes</dt>
                <dd>
                  {presentes.length} de {ativos} associados ({aptos} em dia, que votam)
                </dd>
                <dt>Confirmaram</dt>
                <dd>{lista.filter((l) => l.confirmou_em).length}</dd>
              </dl>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
              {encontro.situacao === 'realizado' && (
                <p className="etiqueta etiqueta-marca">Lista encerrada: quem não esteve presente tem falta.</p>
              )}
              {convocado && cedo && (
                <p className="aviso-texto" role="status">
                  A lista abre 6 horas antes do encontro, a partir de {formatarDataHora(new Date(inicio - ABRE_ANTES).toISOString())}.
                </p>
              )}
              {convocado && tarde && (
                <p className="aviso-texto" role="status">
                  A lista fechou para novas marcações (18 horas depois do horário marcado).
                  {assembleia && !encontro.instalada_em
                    ? ' A assembleia não foi instalada: se não aconteceu, cancele o encontro na página dele, com o motivo.'
                    : ''}
                </p>
              )}
              {aberta && <LeitorQr aoLer={aoLer} />}
              <label>
                Buscar associado
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou nº de registro" />
              </label>
              <ul className="lista" aria-label="Associados">
                {visiveis.map((l) => (
                  <LinhaDaLista
                    key={l.pessoa_id}
                    l={l}
                    aberta={aberta}
                    enviando={enviando}
                    aoMarcar={() => void umaVez(async () => concluir(await registrarPresenca(id, l.pessoa_id), `Presença registrada: ${l.nome}.`))}
                    aoDesfazer={() => void umaVez(async () => concluir(await desfazerPresenca(id, l.pessoa_id), `Presença desfeita: ${l.nome}.`))}
                  />
                ))}
              </ul>
              {convocado && assembleia && !encontro.instalada_em && inicio <= agora + 60_000 && !tarde && (
                <p className="detalhe">
                  Para encerrar a lista, primeiro instale a assembleia (quórum) na{' '}
                  <Link to={`/assembleias/${encontro.id}/conducao`}>condução</Link>.
                </p>
              )}
              {podeEncerrar && (
                <div className="acoes">
                  {perguntando ? (
                    <span className="confirmar-linha">
                      <button
                        type="button"
                        className="botao botao-perigo-cheio"
                        disabled={enviando}
                        onClick={() =>
                          void umaVez(async () => {
                            setPerguntando(false)
                            concluir(await encerrarPresenca(id), 'Lista encerrada: o encontro está registrado como realizado.')
                          })
                        }
                      >
                        Confirmar — encerrar (quem não está presente fica com falta)
                      </button>
                      <button type="button" className="botao-texto" onClick={() => setPerguntando(false)}>
                        Não
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="botao" onClick={() => setPerguntando(true)}>
                      Encerrar a lista de presença
                    </button>
                  )}
                </div>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function LinhaDaLista({
  l,
  aberta,
  enviando,
  aoMarcar,
  aoDesfazer,
}: {
  l: LinhaPresenca
  aberta: boolean
  enviando: boolean
  aoMarcar: () => void
  aoDesfazer: () => void
}) {
  return (
    <li className="lista-item lista-item-estatico" aria-label={l.nome}>
      <strong>
        <span className="numero">Nº {l.numero_registro}</span> {l.nome}
      </strong>
      <span>
        {l.presente_em ? (
          <span className="etiqueta etiqueta-ok">
            Presente às {horaDe(l.presente_em)} ({l.forma === 'qr_code' ? 'QR Code' : 'lista'})
          </span>
        ) : l.confirmou_em ? (
          <span className="etiqueta etiqueta-neutra">Confirmou que vem</span>
        ) : (
          <span className="etiqueta etiqueta-neutra">—</span>
        )}{' '}
        {!l.em_dia && <span className="etiqueta etiqueta-atraso">Em atraso: não vota</span>}{' '}
        {l.justificativa && (
          <span className="etiqueta etiqueta-neutra">
            Justificativa {l.justificativa === 'pendente' ? 'em análise' : l.justificativa}
          </span>
        )}
      </span>
      {aberta && (
        <span className="acoes-linha">
          {l.presente_em ? (
            <button type="button" className="botao-texto" disabled={enviando} onClick={aoDesfazer}>
              Desfazer
            </button>
          ) : (
            <button type="button" className="botao botao-secundario" disabled={enviando} onClick={aoMarcar}>
              Marcar presente
            </button>
          )}
        </span>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// /assembleias/faltas — justificativas (o 1º secretário decide) e faltas seguidas (Art. 8º, IV)
// ---------------------------------------------------------------------

export function FaltasEJustificativas() {
  const [carga, recarregar] = useCarregar(async () => {
    const [justificativas, faltas, config] = await Promise.all([listarJustificativas(), faltasDosAssociados(), buscarConfigAssembleias()])
    if (justificativas.erro !== null) return justificativas
    if (faltas.erro !== null) return faltas
    if (config.erro !== null) return config
    return ok({ justificativas: justificativas.dados, faltas: faltas.dados, config: config.dados })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  return (
    <>
      <p className="nao-imprimir">
        <Link to="/assembleias">← Assembleias e reuniões</Link>
      </p>
      <h1>Faltas e justificativas</h1>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ justificativas, faltas, config }) => {
          // as de encontros arquivados (que a pessoa não vê mais) ficam de fora
          const visiveis = justificativas.filter((j) => j.encontro)
          const pendentes = visiveis.filter((j) => j.situacao === 'pendente')
          const decididas = visiveis.filter((j) => j.situacao !== 'pendente').slice(0, 30)
          return (
            <>
              <section className="painel" aria-labelledby="titulo-justificativas">
                <h2 id="titulo-justificativas">Justificativas para decidir ({pendentes.length})</h2>
                <p className="detalhe">Decide o 1º secretário (diretoria, 11/11/2026). Para recusar, informe o motivo.</p>
                {pendentes.length === 0 ? (
                  <p className="vazio">Nenhuma justificativa esperando.</p>
                ) : (
                  <ul className="lista" aria-label="Justificativas pendentes">
                    {pendentes.map((j) => (
                      <Justificativa
                        key={j.id}
                        j={j}
                        aoDecidir={(r, texto) => {
                          setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: texto })
                          if (r.erro === null) recarregar()
                        }}
                      />
                    ))}
                  </ul>
                )}
                {decididas.length > 0 && (
                  <details className="acao-recolhida">
                    <summary>Já decididas (últimas {decididas.length})</summary>
                    <ul className="lista">
                      {decididas.map((j) => (
                        <li key={j.id} className="lista-item lista-item-estatico">
                          <strong>{j.pessoa?.nome}</strong>
                          <span>
                            {j.encontro?.titulo} — {j.situacao === 'aceita' ? 'aceita' : `recusada: ${j.motivo_decisao}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>

              <section className="painel" aria-labelledby="titulo-faltas-seguidas">
                <h2 id="titulo-faltas-seguidas">Faltas seguidas às reuniões mensais</h2>
                <p className="detalhe">
                  Sem justificativa aceita. Com {config.faltas_aviso}, avise o associado; com {config.faltas_pauta}, o caso vai
                  para a pauta da assembleia (Art. 8º, IV). Se a regra vale também para as assembleias é a pergunta 22.
                </p>
                {faltas.length === 0 ? (
                  <p className="vazio">Ninguém com falta seguida.</p>
                ) : (
                  <ul className="lista" aria-label="Faltas seguidas">
                    {faltas.map((f) => (
                      <li key={f.pessoa_id} className="lista-item lista-item-estatico" aria-label={f.nome}>
                        <strong>
                          <span className="numero">Nº {f.numero_registro}</span> {f.nome}
                        </strong>
                        <span>
                          {f.faltas_seguidas} falta{f.faltas_seguidas === 1 ? '' : 's'} seguida{f.faltas_seguidas === 1 ? '' : 's'}{' '}
                          {f.faltas_seguidas >= config.faltas_pauta ? (
                            <span className="etiqueta etiqueta-atraso">Levar à pauta da assembleia</span>
                          ) : f.faltas_seguidas >= config.faltas_aviso ? (
                            <span className="etiqueta etiqueta-conferencia">Avisar o associado</span>
                          ) : null}
                        </span>
                        <Link className="botao-texto alinhar-esquerda" to={`/ministros/${f.pessoa_id}`}>
                          Abrir a ficha
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function Justificativa({
  j,
  aoDecidir,
}: {
  j: JustificativaParaDecidir
  aoDecidir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <li className="lista-item lista-item-estatico" aria-label={`Justificativa de ${j.pessoa?.nome ?? ''}`}>
      <strong>{j.pessoa?.nome}</strong>
      <span>
        {j.encontro?.titulo} ({j.encontro ? formatarDataHora(j.encontro.inicio) : '—'}) — enviada em {formatarDataHora(j.enviada_em)}
      </span>
      <q className="texto-justificativa">{j.texto}</q>
      <span className="form-linha">
        <button
          type="button"
          className="botao"
          disabled={enviando}
          onClick={() => void umaVez(async () => aoDecidir(await decidirJustificativa(j.id, true, ''), `Justificativa de ${j.pessoa?.nome} aceita.`))}
        >
          Aceitar
        </button>
        <label>
          Motivo (para recusar)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <button
          type="button"
          className="botao botao-perigo"
          disabled={enviando || !motivo.trim()}
          onClick={() => void umaVez(async () => aoDecidir(await decidirJustificativa(j.id, false, motivo), `Justificativa de ${j.pessoa?.nome} recusada.`))}
        >
          Recusar
        </button>
      </span>
    </li>
  )
}
