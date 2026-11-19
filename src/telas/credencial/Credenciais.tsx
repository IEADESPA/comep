// Fase 3.2/3.3 — Credenciais: a do próprio associado e, para a secretaria/presidência, a de todos.
// Ver (digital), imprimir (tamanho real) e conferir a página de validação.
// Fase 5.5 (parte 7): cada credencial sai no MODELO da pessoa (um por grupo; o de readequação para o ministro da igreja
// sem registro); a lista do módulo é a tabela aprovada (rodada 7), com a caixinha para marcar quem vai para a impressão.
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { FaceCredencial } from '../../componentes/CartaoCredencial'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { PendenciasCredencial } from '../../componentes/PendenciasCredencial'
import { QrCode } from '../../componentes/QrCode'
import { CabecalhoTela, Chip } from '../../componentes/Telas'
import {
  dadosCredenciais,
  listaCredenciais,
  publicarFoto,
  substituirCredencial,
  urlValidacao,
  type DadosCredencial,
  type LinhaCredencial,
  type PacoteCredenciais,
} from '../../dados/credencial'
import { linkDoArquivo } from '../../dados/pedidos'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { contemTexto, formatarData, formatarDataDeInstante, hojeIso, iniciaisDe, numeroDoRegistro } from '../../utilitarios/formatos'
import { imprimir } from '../../utilitarios/exportar'
import { modeloDaCredencial, valoresDaCredencial, type ModeloCredencial } from '../../utilitarios/modeloCredencial'

/** Foto para mostrar (link temporário da pasta privada) e, de quebra, publica a cópia para o QR Code. */
function useFoto(c: DadosCredencial | undefined, publicar: boolean): string | null {
  const [foto, setFoto] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    if (c?.foto_caminho) {
      void linkDoArquivo(c.foto_caminho).then((u) => ativo && setFoto(u))
      if (publicar) void publicarFoto(c, linkDoArquivo)
    }
    return () => {
      ativo = false
    }
  }, [c, publicar])
  return foto
}

/** Frente e verso desenhados pelo modelo em uso. */
function FrenteEVerso({ modelo, textoVerso, c, foto }: { modelo: ModeloCredencial; textoVerso: string; c: DadosCredencial; foto: string | null }) {
  const valores = useMemo(() => valoresDaCredencial(c, textoVerso), [c, textoVerso])
  const url = urlValidacao(c.codigo)
  return (
    <>
      <FaceCredencial lado="frente" modelo={modelo} valores={valores} nome={c.nome} foto={foto} urlQr={url} />
      <FaceCredencial lado="verso" modelo={modelo} valores={valores} nome={c.nome} foto={foto} urlQr={url} />
    </>
  )
}

/** Frente e verso, lado a lado (computador) ou um embaixo do outro (celular). */
export function CredencialNaTela({ pacote, c }: { pacote: PacoteCredenciais; c: DadosCredencial }) {
  const foto = useFoto(c, true)
  const modelo = useMemo(() => modeloDaCredencial(pacote, c), [pacote, c])
  return (
    <div className="credencial-dupla" aria-label={`Credencial de ${c.nome}`}>
      <FrenteEVerso modelo={modelo} textoVerso={pacote.texto_verso} c={c} foto={foto} />
    </div>
  )
}

export function SituacaoAgora({ c }: { c: DadosCredencial }) {
  const vencida = c.valida_ate !== null && c.valida_ate < hojeIso()
  return (
    <section className="painel" aria-labelledby="titulo-situacao-credencial">
      <h2 id="titulo-situacao-credencial">Situação de agora (o que o QR Code mostra)</h2>
      <p>
        {vencida ? (
          <span className="etiqueta etiqueta-atraso">Vencida (fim do mandato): aguardando a renovação</span>
        ) : (
          <span className="etiqueta etiqueta-ok">Credencial ativa</span>
        )}{' '}
        {c.em_dia ? (
          <span className="etiqueta etiqueta-ok">{c.jubilado ? 'Isento (jubilado): vota, não é votado' : 'Em dia: apto a votar e ser votado'}</span>
        ) : (
          <span className="etiqueta etiqueta-atraso">Em atraso: inapto para votar até regularizar</span>
        )}
      </p>
      <p className="detalhe">
        {c.valida_ate
          ? `Válida até ${formatarData(c.valida_ate)}, o fim do mandato da diretoria. A digital passa sozinha para o mandato seguinte. A impressa vale até a data que está nela: depois da posse da nova diretoria, imprima de novo (a antiga perde a validade).`
          : 'Válida enquanto o associado estiver ativo. (O fim do mandato da diretoria ainda não foi informado em Configurações → Credencial.)'}
      </p>
      <p>
        <a href={urlValidacao(c.codigo)} target="_blank" rel="noreferrer">
          Abrir a página de validação (a mesma do QR Code)
        </a>
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------
// /minha-credencial — o próprio associado
// ---------------------------------------------------------------------

export function MinhaCredencial() {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta?.tipo !== 'ok') return <Carregando />
  return <ConteudoMinha key={estado.conta.conta.pessoaId} pessoaId={estado.conta.conta.pessoaId} />
}

function ConteudoMinha({ pessoaId }: { pessoaId: string }) {
  const [carga, recarregar] = useCarregar(() => dadosCredenciais([pessoaId]))
  return (
    <div className="tela-nova">
      <CabecalhoTela titulo="Minha credencial" sub="A sua identificação de ministro do COMEP" />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pacote) => {
          const c = pacote.credenciais[0]
          if (!c) {
            return (
              <Aviso titulo="Você ainda não tem credencial">
                <p>A credencial é do associado ativo. Depois da aprovação do pedido de associação, ela aparece aqui.</p>
              </Aviso>
            )
          }
          return <MinhaCredencialNaTela pacote={pacote} c={c} />
        }}
      </MostrarCarga>
    </div>
  )
}

/**
 * Telas novas (Fase 5.5, aprovada): no notebook, a frente e o verso; no celular, só a frente (o verso num botão).
 * O cartão é o do modelo em uso (Credenciais → Modelo); "Mostrar o QR Code" abre o QR grande para quem vai conferir.
 */
function MinhaCredencialNaTela({ pacote, c }: { pacote: PacoteCredenciais; c: DadosCredencial }) {
  const foto = useFoto(c, true)
  const modelo = useMemo(() => modeloDaCredencial(pacote, c), [pacote, c])
  const [verso, setVerso] = useState(false)
  const [qrAberto, setQrAberto] = useState(false)
  const vencida = c.valida_ate !== null && c.valida_ate < hojeIso()
  const situacao = vencida ? 'Vencida: aguardando a renovação' : c.em_dia ? 'Válida · em dia' : 'Válida · contribuição em atraso'

  useEffect(() => {
    if (!qrAberto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setQrAberto(false)
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [qrAberto])

  return (
    <>
      <div className={verso ? 'credencial-nova mostrar-verso' : 'credencial-nova'} aria-label={`Credencial de ${c.nome}`}>
        <FrenteEVerso modelo={modelo} textoVerso={pacote.texto_verso} c={c} foto={foto} />
      </div>
      <div className="linha-situacao">
        <Chip area={vencida ? 'pessoas' : c.em_dia ? 'financas' : 'eventos'}>
          <Icone nome={vencida ? 'alerta' : 'check'} tamanho={16} traco={2.6} />
          {situacao}
        </Chip>
        <span className="detalhe">
          {c.valida_ate ? `Válida até ${formatarData(c.valida_ate)} (fim do mandato)` : 'Válida enquanto o associado estiver ativo'}
          {c.emitida_em && ` · emitida em ${formatarDataDeInstante(c.emitida_em)}`}
        </span>
      </div>
      <div className="acoes acoes-credencial">
        <button type="button" className="botao botao-com-icone" onClick={() => setQrAberto(true)}>
          <Icone nome="qr" tamanho={20} />
          Mostrar o QR Code
        </button>
        <Link className="botao botao-secundario botao-com-icone" to="/minha-credencial/imprimir">
          <Icone nome="imprimir" tamanho={18} />
          Imprimir
        </Link>
        <button type="button" className="botao botao-secundario so-celular" aria-pressed={verso} onClick={() => setVerso((v) => !v)}>
          {verso ? 'Ver a frente' : 'Ver o verso'}
        </button>
      </div>
      <p className="detalhe">
        A digital passa sozinha para o mandato seguinte. A impressa vale até a data que está nela: depois da posse da nova
        diretoria, imprima de novo.{' '}
        <a href={urlValidacao(c.codigo)} target="_blank" rel="noreferrer">
          Abrir a página de validação (a mesma do QR Code)
        </a>
      </p>
      {c.pendencias.length > 0 && <PendenciasCredencial pendencias={c.pendencias} propria />}

      {qrAberto && (
        <div className="janela-fundo" onClick={() => setQrAberto(false)}>
          <div
            className="janela-qr"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-qr"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="titulo-qr" className="somente-leitor">
              QR Code da credencial
            </h2>
            <QrCode texto={urlValidacao(c.codigo)} rotulo={`QR Code para conferir a credencial de ${c.nome}`} className="qr-grande" />
            <strong>{c.nome}</strong>
            <span className={c.em_dia && !vencida ? 'texto-ok' : 'texto-atencao'}>
              {situacao} · nº {String(c.numero_registro).padStart(4, '0')}
            </span>
            <span className="detalhe">Aumente o brilho do celular para ler mais rápido.</span>
            <button type="button" className="botao botao-secundario" autoFocus onClick={() => setQrAberto(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export function ImprimirMinhaCredencial() {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta?.tipo !== 'ok') return <Carregando />
  return <TelaImpressao pessoas={[estado.conta.conta.pessoaId]} voltar="/minha-credencial" />
}

// ---------------------------------------------------------------------
// /credenciais — secretaria e presidência
// ---------------------------------------------------------------------

type FiltroLista = 'todas' | 'completas' | 'pendentes' | 'readequacao'

const FILTROS_LISTA: { chave: FiltroLista; nome: string }[] = [
  { chave: 'todas', nome: 'Todas' },
  { chave: 'completas', nome: 'Completas' },
  { chave: 'pendentes', nome: 'Com pendência' },
  { chave: 'readequacao', nome: 'Em readequação' },
]

function passaNoFiltro(l: LinhaCredencial, f: FiltroLista): boolean {
  if (f === 'completas') return l.pendencias.length === 0
  if (f === 'pendentes') return l.pendencias.length > 0
  if (f === 'readequacao') return l.readequacao
  return true
}

/** A lista do módulo (rodada 7, aprovada como está): a tabela com a caixinha de quem vai para a impressão. */
export function ListaCredenciais() {
  const navegar = useNavigate()
  const [carga, recarregar] = useCarregar(listaCredenciais)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroLista>('todas')
  const [escolhidas, setEscolhidas] = useState<string[]>([])

  const sub =
    carga.situacao === 'ok'
      ? [
          `${carga.dados.credenciais.length} ${carga.dados.credenciais.length === 1 ? 'credencial' : 'credenciais'}`,
          `${carga.dados.credenciais.filter((l) => l.pendencias.length === 0).length} completas`,
          carga.dados.fim_mandato ? `válidas até ${formatarData(carga.dados.fim_mandato)}` : 'válidas enquanto o associado estiver ativo',
        ].join(' · ')
      : 'A credencial de cada associado ativo'

  const imprimirMarcadas = () => navegar('/credenciais/imprimir', { state: { pessoas: escolhidas } })

  return (
    <div className="tela-nova">
      <CabecalhoFuncao modulo="Credenciais" titulo="Credenciais" sub={sub} />
      <div className="busca-com-acao">
        <label className="campo-busca">
          <Icone nome="busca" tamanho={18} />
          <input
            type="search"
            aria-label="Buscar associado"
            placeholder="Buscar por nome, igreja ou nº"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <button type="button" className="botao" disabled={escolhidas.length === 0} onClick={imprimirMarcadas}>
          Imprimir as marcadas ({escolhidas.length})
        </button>
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ credenciais: todas, fim_mandato }) => {
          const termo = busca.trim()
          const achadas = todas.filter(
            (l) => contemTexto(l.nome, termo) || contemTexto(l.igreja, termo) || (/^\d+$/.test(termo) && Number(termo) === l.numero_registro),
          )
          const visiveis = achadas.filter((l) => passaNoFiltro(l, filtro))
          const todasMarcadas = visiveis.length > 0 && visiveis.every((l) => escolhidas.includes(l.pessoa_id))
          return (
            <>
              <div className="pilulas" role="group" aria-label="Mostrar">
                {FILTROS_LISTA.filter((f) => f.chave !== 'readequacao' || todas.some((l) => l.readequacao)).map((f) => (
                  <button
                    key={f.chave}
                    type="button"
                    className={filtro === f.chave ? 'pilula ativa' : 'pilula'}
                    aria-pressed={filtro === f.chave}
                    onClick={() => setFiltro(f.chave)}
                  >
                    {f.nome} <strong>{todas.filter((l) => passaNoFiltro(l, f.chave)).length}</strong>
                  </button>
                ))}
              </div>
              {visiveis.length === 0 ? (
                <p className="vazio">Nenhum associado encontrado.</p>
              ) : (
                <div className="tabela-ministros tabela-credenciais">
                  <div className="tabela-credenciais-cabecalho so-computador">
                    <label className="caixa-marcar">
                      <input
                        type="checkbox"
                        aria-label="Marcar todas as mostradas"
                        checked={todasMarcadas}
                        onChange={(e) =>
                          setEscolhidas(
                            e.target.checked
                              ? [...new Set([...escolhidas, ...visiveis.map((l) => l.pessoa_id)])]
                              : escolhidas.filter((id) => !visiveis.some((l) => l.pessoa_id === id)),
                          )
                        }
                      />
                    </label>
                    <span aria-hidden="true">Ministro</span>
                    <span aria-hidden="true">Nº</span>
                    <span aria-hidden="true">Igreja</span>
                    <span aria-hidden="true">Situação</span>
                  </div>
                  <ul aria-label="Credenciais">
                    {visiveis.map((l) => (
                      <li key={l.pessoa_id} aria-label={l.nome}>
                        <LinhaDaCredencial
                          l={l}
                          fimMandato={fim_mandato}
                          marcada={escolhidas.includes(l.pessoa_id)}
                          aoMarcar={(sim) =>
                            setEscolhidas((atual) => (sim ? [...atual, l.pessoa_id] : atual.filter((id) => id !== l.pessoa_id)))
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {visiveis.length > 0 && visiveis.length < todas.length && (
                <p className="detalhe">
                  {visiveis.length} de {todas.length}
                </p>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function LinhaDaCredencial({
  l,
  fimMandato,
  marcada,
  aoMarcar,
}: {
  l: LinhaCredencial
  fimMandato: string | null
  marcada: boolean
  aoMarcar: (sim: boolean) => void
}) {
  const numero = numeroDoRegistro(l.numero_registro)
  return (
    <div className="linha-credencial-nova">
      <label className="caixa-marcar">
        <input type="checkbox" aria-label={`Marcar ${l.nome} para imprimir`} checked={marcada} onChange={(e) => aoMarcar(e.target.checked)} />
      </label>
      <Link to={`/credenciais/${l.pessoa_id}`} className="linha-credencial-link" aria-label={`Ver a credencial de ${l.nome}`}>
        <span className="avatar-ministro" aria-hidden="true">
          {iniciaisDe(l.nome)}
        </span>
        <span className="linha-ministro-nome">
          <strong>{l.nome}</strong>
          <span className="so-celular">
            nº {numero}
            {l.igreja && ` · ${l.igreja}`}
          </span>
          {l.modelo && <span className="so-computador">Modelo: {l.modelo}</span>}
        </span>
        <span className="linha-ministro-coluna so-computador">
          <span className="somente-leitor">nº </span>
          {numero}
        </span>
        <span className="linha-ministro-coluna so-computador">{l.igreja ?? 'Sem igreja'}</span>
        <span className="linha-ministro-situacao">
          <SituacaoDaCredencial l={l} fimMandato={fimMandato} />
        </span>
        <span className="so-computador linha-ministro-seta">
          <Icone nome="seta" tamanho={18} />
        </span>
      </Link>
    </div>
  )
}

const FALTA: Record<string, string> = {
  'Sem foto': 'Falta a foto',
  'Sem CPF': 'Falta o CPF',
  'Sem título': 'Falta o título',
  'Sem igreja': 'Falta a igreja',
  'Sem o nome da mãe': 'Falta o nome da mãe',
  'Sem a função na igreja': 'Falta a função na igreja',
}

function SituacaoDaCredencial({ l, fimMandato }: { l: LinhaCredencial; fimMandato: string | null }) {
  const ate = l.valida_ate ?? fimMandato
  const [primeira, ...outras] = l.pendencias
  if (primeira) {
    return (
      <span title={`Falta: ${l.pendencias.join(', ')}`}>
        <Chip area="eventos">
          {FALTA[primeira] ?? primeira}
          {outras.length > 0 && ` +${outras.length}`}
        </Chip>
      </span>
    )
  }
  if (l.readequacao) return <Chip area="assembleias">Em readequação</Chip>
  if (!l.em_dia) return <Chip area="pessoas">Válida · em atraso</Chip>
  return <Chip area="financas">{ate ? `Válida até ${formatarData(ate)}` : 'Válida'}</Chip>
}

export function CredencialDe() {
  const { pessoaId = '' } = useParams()
  return <ConteudoDe key={pessoaId} pessoaId={pessoaId} />
}

function ConteudoDe({ pessoaId }: { pessoaId: string }) {
  const [carga, recarregar] = useCarregar(() => dadosCredenciais([pessoaId]))
  const [motivo, setMotivo] = useState('')
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [perguntando, setPerguntando] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  return (
    <>
      <p className="nao-imprimir">
        <Link to="/credenciais">← Credenciais</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pacote) => {
          const c = pacote.credenciais[0]
          if (!c) {
            return (
              <Aviso titulo="Sem credencial">
                <p>Esta pessoa não é associada ativa.</p>
              </Aviso>
            )
          }
          return (
            <>
              <h1>Credencial de {c.nome}</h1>
              <CredencialNaTela pacote={pacote} c={c} />
              <div className="acoes nao-imprimir">
                <Link className="botao" to={`/credenciais/imprimir?p=${c.pessoa_id}`}>
                  Ver a impressão (tamanho real)
                </Link>
                <Link className="botao botao-secundario" to={`/ministros/${c.pessoa_id}`}>
                  Abrir a ficha do ministro
                </Link>
              </div>
              <SituacaoAgora c={c} />
              <PendenciasCredencial pendencias={c.pendencias} />
              <section className="painel nao-imprimir" aria-labelledby="titulo-nova-credencial">
                <h2 id="titulo-nova-credencial">Perda, roubo ou dados que mudaram</h2>
                <p className="detalhe">
                  Emitir uma nova credencial troca o QR Code: as credenciais antigas (impressas ou não) passam a mostrar
                  "substituída" na validação. Nada se apaga.
                </p>
                <form
                  className="form-linha"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!perguntando) {
                      setPerguntando(true)
                      return
                    }
                    setPerguntando(false)
                    void umaVez(async () => {
                      const r = await substituirCredencial(c.pessoa_id, motivo)
                      setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Nova credencial emitida. Imprima de novo.' })
                      if (r.erro === null) {
                        setMotivo('')
                        recarregar()
                      }
                    })
                  }}
                >
                  <label>
                    Motivo *
                    <input
                      required
                      value={motivo}
                      onChange={(e) => {
                        setMotivo(e.target.value)
                        setPerguntando(false)
                      }}
                      placeholder="Ex.: perda"
                    />
                  </label>
                  {perguntando ? (
                    <span className="confirmar-linha">
                      <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                        Confirmar — as antigas deixam de valer
                      </button>
                      <button type="button" className="botao-texto" onClick={() => setPerguntando(false)}>
                        Não
                      </button>
                    </span>
                  ) : (
                    <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                      Emitir nova credencial
                    </button>
                  )}
                </form>
                <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
              </section>
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

// ---------------------------------------------------------------------
// Impressão no tamanho real: folhas A4 com 5 credenciais. Frente e verso JUNTOS, lado a lado:
// recorta-se em volta, dobra-se ao meio, põe-se na capa plástica e plastifica-se.
// ---------------------------------------------------------------------

const POR_FOLHA = 5

export function ImprimirCredenciais() {
  const [parametros] = useSearchParams()
  const local = useLocation()
  // vindas da lista (estado da navegação: aguenta recarregar a página) ou do endereço (?p=, uma ou poucas)
  const doEstado = (local.state as { pessoas?: unknown } | null)?.pessoas
  const pessoas = useMemo(
    () =>
      Array.isArray(doEstado) ? doEstado.filter((p): p is string => typeof p === 'string') : (parametros.get('p') ?? '').split(',').filter(Boolean),
    [doEstado, parametros],
  )
  // aberta pelo menu do módulo (Credenciais › Imprimir), ainda sem ninguém marcado
  if (pessoas.length === 0) {
    return (
      <>
        <h1>Impressão das credenciais</h1>
        <Aviso titulo="Escolha quem vai para a impressão">
          <p>
            Na lista das <Link to="/credenciais">Credenciais</Link>, marque as pessoas e use "Imprimir as marcadas". Para uma só,
            abra a credencial dela e use "Ver a impressão".
          </p>
        </Aviso>
      </>
    )
  }
  return <TelaImpressao key={pessoas.join(',')} pessoas={pessoas} voltar="/credenciais" />
}

function TelaImpressao({ pessoas, voltar }: { pessoas: string[]; voltar: string }) {
  const [carga, recarregar] = useCarregar(() => dadosCredenciais(pessoas))
  return (
    <>
      <div className="nao-imprimir">
        <p>
          <Link to={voltar}>← Voltar</Link>
        </p>
        <h1>Impressão das credenciais</h1>
        <div className="aviso-texto">
          <p>
            <strong>Tamanho real:</strong> cada lado tem <strong>85,6 × 54 mm</strong> (o tamanho de cartão de crédito, o
            mesmo das capas plásticas). Frente e verso saem <strong>juntos</strong>, para dobrar. Cabem {POR_FOLHA}{' '}
            credenciais por folha A4.
          </p>
          <p>
            Na janela de impressão: papel <strong>A4</strong>, escala <strong>100%</strong> (não "ajustar à página") e com
            gráficos de fundo.
          </p>
          <p>
            Recorte na linha em volta (frente e verso continuam juntos), <strong>dobre ao meio</strong> nas marcas de cima e
            de baixo, com o desenho para fora, ponha na capa plástica e plastifique.
          </p>
        </div>
        <div className="acoes acoes-relatorio">
          <button type="button" className="botao" onClick={imprimir}>
            Imprimir
          </button>
        </div>
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(pacote) =>
          pacote.credenciais.length === 0 ? (
            <p className="vazio">Nenhuma credencial para imprimir.</p>
          ) : (
            <>
            <AvisosDaImpressao pacote={pacote} />
            <div className="folhas-impressao">
              {Array.from({ length: Math.ceil(pacote.credenciais.length / POR_FOLHA) }, (_, f) => (
                <section key={f} className="folha-a4" aria-label={`Folha ${f + 1}`}>
                  {pacote.credenciais.slice(f * POR_FOLHA, (f + 1) * POR_FOLHA).map((c) => (
                    <ParParaImprimir key={c.pessoa_id} modelo={modeloDaCredencial(pacote, c)} textoVerso={pacote.texto_verso} c={c} />
                  ))}
                </section>
              ))}
            </div>
            </>
          )
        }
      </MostrarCarga>
    </>
  )
}

/** Antes de imprimir: o que vai sair incompleto (pendências, sem validade) e textos que não couberam. */
function AvisosDaImpressao({ pacote }: { pacote: PacoteCredenciais }) {
  const comPendencia = pacote.credenciais.filter((c) => c.pendencias.length > 0)
  const semValidade = pacote.credenciais.some((c) => !c.valida_ate)
  const [cortadas, setCortadas] = useState<string[]>([])
  useEffect(() => {
    // confere depois que as letras se ajustaram (e quando as fotos chegam)
    const conferir = () =>
      setCortadas(
        [...document.querySelectorAll<HTMLElement>('.folhas-impressao .par-cartoes')]
          .filter((par) => par.querySelector('.cr-cortar'))
          .map((par) => par.getAttribute('aria-label')?.replace(/^Credencial de | para dobrar$/g, '') ?? ''),
      )
    const tempo = window.setTimeout(conferir, 800)
    return () => window.clearTimeout(tempo)
  }, [pacote])
  if (comPendencia.length === 0 && !semValidade && cortadas.length === 0) return null
  return (
    <div className="nao-imprimir">
      <Aviso titulo="Confira antes de imprimir">
        <ul>
          {semValidade && (
            <li>
              O fim do mandato não foi informado (Configurações → Credencial): a credencial sai com "Válida até: enquanto
              ativo".
            </li>
          )}
          {comPendencia.length > 0 && (
            <li>
              Sairão incompletas (com "—" ou sem foto): {comPendencia.map((c) => `${c.nome} (${c.pendencias.join(', ')})`).join('; ')}.
            </li>
          )}
          {cortadas.length > 0 && <li>Texto que não coube nem com a letra menor (saiu cortado): {cortadas.join('; ')}.</li>}
        </ul>
      </Aviso>
    </div>
  )
}

/** Frente e verso colados (sem espaço entre eles): a linha do meio é a dobra, marcada em cima e embaixo. */
function ParParaImprimir({ modelo, textoVerso, c }: { modelo: ModeloCredencial; textoVerso: string; c: DadosCredencial }) {
  // publica a foto também aqui: o QR Code da impressa mostra a foto na validação
  const foto = useFoto(c, true)
  return (
    <div className="par-impressao">
      <div className="par-cartoes" role="group" aria-label={`Credencial de ${c.nome} para dobrar`}>
        <FrenteEVerso modelo={modelo} textoVerso={textoVerso} c={c} foto={foto} />
      </div>
    </div>
  )
}
