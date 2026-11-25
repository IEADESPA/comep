// A presença no encontro (secretaria e presidência) e as faltas e justificativas.
// A presença vale como "livro ou controle similar" (Art. 16, §1º). Telas novas, parte 14 (asm-presenca, opção 3,
// juntando as três): três jeitos de marcar —
//   1. a tela da portaria: um celular ou tablet na entrada com o QR Code e o código de 6 letras que muda a cada
//      minuto; o ministro lê o QR (ou digita o código) no próprio celular;
//   2. a secretaria lê o QR Code da credencial do ministro;
//   3. a secretaria marca pelo nome (quem chegou atrasado ou está sem a credencial).
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Icone, MarcaCaixa } from '../../componentes/Icone'
import { QrCode } from '../../componentes/QrCode'
import { Chip } from '../../componentes/Telas'
import {
  buscarEncontro,
  buscarConfigAssembleias,
  COMO_MARCOU,
  contagemQuorum,
  decidirJustificativa,
  desfazerPresenca,
  encerrarPresenca,
  enderecoDaPortaria,
  faltasDosAssociados,
  listaPresenca,
  listarJustificativas,
  NOME_DO_TIPO,
  portariaDoEncontro,
  registrarPresenca,
  registrarPresencaPorCodigo,
  type JustificativaParaDecidir,
  type LinhaPresenca,
} from '../../dados/encontros'
import { ok } from '../../dados/cliente'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { contemTexto, formatarDataHora, iniciaisDe } from '../../utilitarios/formatos'
import { codigoDoQr } from '../../utilitarios/encontros'
import { CabecalhoDoEncontro, CartaoQuorum, SoSecretaria } from './comum'
import { ABRE_ANTES, FECHA_DEPOIS, horaDe, nomeCurto, presencaAberta, useAgora, useAtualizarACada } from './regras'
import { LeitorQr } from './LeitorQr'

type Retorno = { sucesso?: string; erro?: string }

/** O endereço antigo (/assembleias/:id/presenca) leva ao novo. */
export function PresencaEnderecoAntigo() {
  const { id = '' } = useParams()
  return <Navigate to={`/assembleias/presenca/${id}`} replace />
}

// ---------------------------------------------------------------------
// /assembleias/presenca/:id — a presença do encontro
// ---------------------------------------------------------------------

export function PresencaDoEncontro() {
  const { id = '' } = useParams()
  return (
    <SoSecretaria oQue="A lista de presença">
      <ConteudoPresenca key={id} id={id} />
    </SoSecretaria>
  )
}

function ConteudoPresenca({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, lista, quorum] = await Promise.all([buscarEncontro(id), listaPresenca(id), contagemQuorum(id)])
    if (encontro.erro !== null) return encontro
    if (lista.erro !== null) return lista
    if (quorum.erro !== null) return quorum
    return ok({ encontro: encontro.dados, lista: lista.dados, quorum: quorum.dados })
  })
  const [busca, setBusca] = useState('')
  const [retorno, setRetorno] = useState<Retorno>({})
  const [perguntando, setPerguntando] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  // a hora de agora, atualizada a cada 30 segundos (o botão de encerrar aparece quando o encontro começa)
  const agora = useAgora(30)
  const aberta = carga.situacao === 'ok' && carga.dados.encontro !== null && presencaAberta(carga.dados.encontro, agora)
  // quem chega pela portaria aparece sozinho na lista
  useAtualizarACada(recarregar, 15, aberta)

  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  const aoLerCredencial = (codigo: string) =>
    void registrarPresencaPorCodigo(id, codigo).then((r) => {
      if (r.erro !== null) return setRetorno({ erro: r.erro })
      setRetorno({
        sucesso:
          r.dados.resultado === 'ja_presente'
            ? `${r.dados.nome} já estava presente.`
            : `Presença registrada: ${r.dados.nome}${r.dados.em_dia ? '' : ' (contribuição em atraso: não vota)'}.`,
      })
      recarregar()
    })

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ encontro, lista, quorum }) => {
        if (!encontro) {
          return (
            <Aviso titulo="Encontro não encontrado">
              <p>Ele pode ter sido arquivado.</p>
            </Aviso>
          )
        }
        const presentes = lista.filter((l) => l.presente_em).sort((a, b) => (b.presente_em ?? '').localeCompare(a.presente_em ?? ''))
        const inicio = new Date(encontro.inicio).getTime()
        const convocado = encontro.situacao === 'convocado' && !encontro.presenca_encerrada_em
        const cedo = agora < inicio - ABRE_ANTES
        const tarde = agora > inicio + FECHA_DEPOIS
        const assembleia = encontro.tipo !== 'reuniao_mensal'
        // encerrar: depois do horário marcado; assembleia, só depois de instalada (quórum)
        const podeEncerrar = convocado && inicio <= agora + 60_000 && (!assembleia || encontro.instalada_em !== null)
        const termo = busca.trim()
        const achados =
          termo.length < 2 ? [] : lista.filter((l) => contemTexto(l.nome, termo) || String(l.numero_registro) === termo.replace(/^0+/, ''))
        return (
          <>
            <CabecalhoDoEncontro
              e={encontro}
              titulo="Presença"
              acoes={
                aberta && (
                  <Link className="botao botao-com-icone" to={`/assembleias/presenca/${id}/portaria`}>
                    <Icone nome="qr" tamanho={18} />
                    Abrir a tela da portaria
                  </Link>
                )
              }
            />
            <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
            {encontro.situacao === 'realizado' && (
              <p className="aviso-texto" role="status">
                Lista encerrada: quem não esteve presente tem falta.
              </p>
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
            <div className="duas-colunas presenca-colunas">
              <div className="coluna-pilha">
                <section className="bloco bloco-tabela" aria-labelledby="titulo-chegaram">
                  <h2 id="titulo-chegaram">
                    Quem chegou <span className="detalhe">({presentes.length})</span>
                  </h2>
                  {presentes.length === 0 ? (
                    <p className="vazio">Ninguém marcou presença ainda.</p>
                  ) : (
                    <div className="tabela-rolagem">
                      <table className="tabela-simples tabela-presenca" aria-label="Quem chegou">
                        <thead>
                          <tr>
                            <th scope="col">Ministro</th>
                            <th scope="col">Chegou</th>
                            <th scope="col">Como marcou</th>
                            <th scope="col">Vota?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {presentes.map((l) => (
                            <tr key={l.pessoa_id}>
                              <td>
                                <span className="nome-com-iniciais">
                                  <span className="iniciais-redondas" aria-hidden="true">
                                    {iniciaisDe(l.nome)}
                                  </span>
                                  <strong>{l.nome}</strong>
                                </span>
                              </td>
                              <td>{l.presente_em ? horaDe(l.presente_em) : '—'}</td>
                              <td>{l.forma ? COMO_MARCOU[l.forma] : '—'}</td>
                              <td>{l.em_dia ? <Chip area="financas">sim</Chip> : <Chip area="pessoas">em atraso</Chip>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="bloco" aria-labelledby="titulo-pelo-nome">
                  <h2 id="titulo-pelo-nome">Marcar pelo nome</h2>
                  <p className="detalhe">Para quem chegou atrasado ou está sem a credencial. Confira o documento.</p>
                  <label>
                    Buscar associado
                    <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou nº de registro" />
                  </label>
                  {termo.length >= 2 && achados.length === 0 && <p className="vazio">Ninguém com esse nome ou número.</p>}
                  {achados.length > 0 && (
                    <ul className="lista" aria-label="Associados">
                      {achados.map((l) => (
                        <LinhaDaLista
                          key={l.pessoa_id}
                          l={l}
                          aberta={aberta}
                          enviando={enviando}
                          aoMarcar={() =>
                            void umaVez(async () => concluir(await registrarPresenca(id, l.pessoa_id), `Presença registrada: ${l.nome}.`))
                          }
                          aoDesfazer={() =>
                            void umaVez(async () => concluir(await desfazerPresenca(id, l.pessoa_id), `Presença desfeita: ${l.nome}.`))
                          }
                        />
                      ))}
                    </ul>
                  )}
                </section>

                {convocado && assembleia && !encontro.instalada_em && inicio <= agora + 60_000 && !tarde && (
                  <p className="detalhe">
                    Para encerrar a lista, primeiro instale a assembleia (quórum) na{' '}
                    <Link to={`/assembleias/conducao/${encontro.id}`}>condução</Link>.
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
                      <button type="button" className="botao botao-secundario" onClick={() => setPerguntando(true)}>
                        Encerrar a lista de presença
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="coluna-pilha">
                <CartaoQuorum e={encontro} quorum={quorum} />
                <section className="bloco" aria-labelledby="titulo-tres-jeitos">
                  <h2 id="titulo-tres-jeitos">Três jeitos de marcar</h2>
                  <p>
                    1 · o ministro lê o <strong>QR da portaria</strong> com o celular; 2 · ou <strong>digita o código</strong> da tela da
                    entrada; 3 · ou a secretaria <strong>lê a credencial</strong> dele.
                  </p>
                  {/* "Abrir a tela da portaria" fica só no alto da tela (antes aparecia duas vezes; revisão da parte 14) */}
                  {aberta && (
                    <LeitorQr
                      aoLer={aoLerCredencial}
                      interpretar={codigoDoQr}
                      textoDoBotao="Ler a credencial do ministro"
                      rotuloDaCamera="Câmera lendo a credencial"
                      semLeitor={
                        <>
                          Este navegador não lê QR Code aqui dentro. Use a <strong>câmera do celular</strong>: aponte para o QR Code da
                          credencial; a página de validação abre com o botão <strong>"Marcar presença"</strong>. Ou marque pelo nome.
                        </>
                      }
                    />
                  )}
                </section>
              </div>
            </div>
          </>
        )
      }}
    </MostrarCarga>
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
            Presente às {horaDe(l.presente_em)} ({l.forma ? COMO_MARCOU[l.forma] : '—'})
          </span>
        ) : l.confirmou_em ? (
          <span className="etiqueta etiqueta-neutra">Confirmou que vem</span>
        ) : (
          <span className="etiqueta etiqueta-neutra">—</span>
        )}{' '}
        {!l.em_dia && <span className="etiqueta etiqueta-atraso">Em atraso: não vota</span>}{' '}
        {l.justificativa && (
          <span className="etiqueta etiqueta-neutra">Justificativa {l.justificativa === 'pendente' ? 'em análise' : l.justificativa}</span>
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
// /assembleias/presenca/:id/portaria — a tela da portaria (num celular ou tablet na entrada), fora da moldura:
// sem o menu, a busca e o sino da secretaria (revisão da parte 14, achado 2)
// ---------------------------------------------------------------------

export function TelaDaPortaria() {
  const { id = '' } = useParams()
  return (
    <SoSecretaria oQue="A tela da portaria">
      <ConteudoPortaria key={id} id={id} />
    </SoSecretaria>
  )
}

function ConteudoPortaria({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, portaria, quorum] = await Promise.all([buscarEncontro(id), portariaDoEncontro(id), contagemQuorum(id)])
    if (encontro.erro !== null) return encontro
    if (portaria.erro !== null) return portaria
    if (quorum.erro !== null) return quorum
    return ok({ encontro: encontro.dados, portaria: portaria.dados, quorum: quorum.dados, buscadoEm: Date.now() })
  })
  const tela = useRef<HTMLDivElement>(null)
  // a contagem até o código mudar; quando chega a zero, busca o código novo
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(relogio)
  }, [])
  useAtualizarACada(recarregar, 8)
  const restante =
    carga.situacao === 'ok' ? Math.max(0, Math.ceil(carga.dados.portaria.segundos - (agora - carga.dados.buscadoEm) / 1000)) : 60
  const vencido = carga.situacao === 'ok' && restante === 0
  useEffect(() => {
    if (vencido) recarregar()
  }, [vencido, recarregar])

  const encontroCarregado = carga.situacao === 'ok' ? carga.dados.encontro : null
  return (
    <div className="telao portaria-tela" ref={tela}>
      {/* o alto fica sempre à vista: sem a moldura, "Voltar à lista" é o único caminho de volta (também quando a portaria
          ainda não abriu ou o encontro não existe) */}
      <header className="telao-topo">
        <span className="telao-marca">
          <MarcaCaixa tamanho={44} />
          <span>
            <strong>COMEP</strong>
            <span>{encontroCarregado ? `${NOME_DO_TIPO[encontroCarregado.tipo]} · ${nomeCurto(encontroCarregado)}` : 'Tela da portaria'}</span>
          </span>
        </span>
        <span className="telao-acoes nao-imprimir">
          {encontroCarregado && (
            <button type="button" className="botao botao-secundario" onClick={() => void tela.current?.requestFullscreen?.()}>
              Tela cheia
            </button>
          )}
          <Link className="botao-texto" to={`/assembleias/presenca/${id}`}>
            Voltar à lista
          </Link>
        </span>
      </header>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ encontro, portaria, quorum }) => {
          if (!encontro) {
            return (
              <Aviso titulo="Encontro não encontrado">
                <p>Ele pode ter sido arquivado.</p>
              </Aviso>
            )
          }
          return (
            <main className="duas-colunas presenca-colunas" aria-label="Tela da portaria">
              <section className="bloco portaria-cartao" aria-labelledby="titulo-portaria">
                <h1 id="titulo-portaria">Marque a sua presença</h1>
                <p>Leia este QR Code com o celular, pelo aplicativo do COMEP</p>
                <QrCode
                  className="portaria-qr"
                  texto={enderecoDaPortaria(id, portaria.codigo)}
                  rotulo="QR Code da portaria: abre a presença no celular do ministro"
                />
                <p className="detalhe">ou digite o código</p>
                <p className="portaria-codigo" aria-label={`Código da portaria: ${portaria.codigo.split('').join(' ')}`}>
                  {portaria.codigo.split('').map((letra, i) => (
                    <span key={i} aria-hidden="true">
                      {letra}
                    </span>
                  ))}
                </p>
                <p className="detalhe">
                  O código muda a cada minuto, para só valer para quem está aqui.{' '}
                  <span aria-live="off">Muda em {restante} s.</span>
                </p>
              </section>
              <div className="coluna-pilha">
                <CartaoQuorum e={encontro} quorum={quorum} />
                <section className="bloco" aria-labelledby="titulo-chegaram-agora">
                  <h2 id="titulo-chegaram-agora">Chegaram agora</h2>
                  {portaria.chegaram.length === 0 ? (
                    <p className="vazio">Ninguém ainda.</p>
                  ) : (
                    <ul className="lista-chegadas" aria-label="Chegaram agora">
                      {portaria.chegaram.map((c) => (
                        <li key={`${c.nome}-${c.presente_em}`}>
                          <span className="iniciais-redondas" aria-hidden="true">
                            {iniciaisDe(c.nome)}
                          </span>
                          <span>
                            <strong>{c.nome}</strong>
                            <span className="detalhe">{COMO_MARCOU[c.forma]}</span>
                          </span>
                          <span className="detalhe">{horaDe(c.presente_em)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </main>
          )
        }}
      </MostrarCarga>
    </div>
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
      <CabecalhoFuncao
        modulo="Assembleias"
        titulo="Faltas e justificativas"
        sub="As justificativas para decidir e as faltas seguidas às assembleias."
      />
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
                <h2 id="titulo-faltas-seguidas">Faltas seguidas às assembleias</h2>
                <p className="detalhe">
                  Contam só as assembleias (AGO e AGE), sem justificativa aceita (14/11/2026). Com {config.faltas_aviso}, avise o
                  associado; com {config.faltas_pauta}, a diretoria homologa o desligamento (Art. 8º, IV), na ficha do associado.
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
                            <span className="etiqueta etiqueta-atraso">Homologar o desligamento (Art. 8º, IV)</span>
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
