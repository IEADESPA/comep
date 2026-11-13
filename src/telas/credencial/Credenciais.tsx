// Fase 3.2/3.3 — Credenciais: a do próprio associado e, para a secretaria/presidência, a de todos.
// Ver (digital), imprimir (tamanho real, CR80) e conferir a página de validação.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CredencialFrente, CredencialVerso } from '../../componentes/CartaoCredencial'
import { PendenciasCredencial } from '../../componentes/PendenciasCredencial'
import {
  dadosCredenciais,
  listarPendencias,
  publicarFoto,
  substituirCredencial,
  urlValidacao,
  type DadosCredencial,
  type PacoteCredenciais,
} from '../../dados/credencial'
import { linkDoArquivo } from '../../dados/pedidos'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { contemTexto, formatarData } from '../../utilitarios/formatos'
import { imprimir } from '../../utilitarios/exportar'

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

/** Frente e verso, lado a lado (computador) ou um embaixo do outro (celular). */
export function CredencialNaTela({ pacote, c }: { pacote: PacoteCredenciais; c: DadosCredencial }) {
  const foto = useFoto(c, true)
  return (
    <div className="credencial-dupla" aria-label={`Credencial de ${c.nome}`}>
      <CredencialFrente c={c} foto={foto} />
      <CredencialVerso c={c} textoVerso={pacote.texto_verso} url={urlValidacao(c.codigo)} />
    </div>
  )
}

function SituacaoAgora({ pacote, c }: { pacote: PacoteCredenciais; c: DadosCredencial }) {
  return (
    <section className="painel" aria-labelledby="titulo-situacao-credencial">
      <h2 id="titulo-situacao-credencial">Situação de agora (o que o QR Code mostra)</h2>
      <p>
        <span className="etiqueta etiqueta-ok">Credencial ativa</span>{' '}
        {c.em_dia ? (
          <span className="etiqueta etiqueta-ok">{c.jubilado ? 'Isento (jubilado)' : 'Em dia: apto a votar e ser votado'}</span>
        ) : (
          <span className="etiqueta etiqueta-atraso">Em atraso: inapto para votar até regularizar</span>
        )}
      </p>
      <p className="detalhe">
        {pacote.fim_mandato
          ? `Válida até ${formatarData(pacote.fim_mandato)}, o fim do mandato da diretoria. Na posse da nova diretoria, a validade passa sozinha para o mandato seguinte: não precisa reimprimir.`
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
    <>
      <h1>Minha credencial</h1>
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
          return (
            <>
              <p className="detalhe nao-imprimir">
                Esta é a sua credencial digital. Mostre a tela ou o QR Code. Também dá para imprimir no tamanho de cartão.
              </p>
              <CredencialNaTela pacote={pacote} c={c} />
              <div className="acoes nao-imprimir">
                <Link className="botao" to={`/minha-credencial/imprimir`}>
                  Ver a impressão (tamanho real)
                </Link>
              </div>
              <SituacaoAgora pacote={pacote} c={c} />
              {c.pendencias.length > 0 && <PendenciasCredencial pendencias={c.pendencias} propria />}
            </>
          )
        }}
      </MostrarCarga>
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

export function ListaCredenciais() {
  const navegar = useNavigate()
  const [carga, recarregar] = useCarregar(listarPendencias)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'completas' | 'pendentes'>('todas')
  const [escolhidas, setEscolhidas] = useState<string[]>([])

  return (
    <>
      <h1>Credenciais</h1>
      <p className="detalhe">
        Credencial de cada associado ativo: veja a digital, imprima no tamanho de cartão (85,6 × 54 mm) e confira a página
        do QR Code. A validade não vai impressa: o QR Code mostra a situação de agora.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(todos) => {
          const visiveis = todos.filter(
            (a) =>
              (filtro === 'todas' || (filtro === 'completas' ? a.pendencias.length === 0 : a.pendencias.length > 0)) &&
              (contemTexto(a.nome, busca) || contemTexto(a.igreja, busca) || String(a.numero_registro) === busca.trim()),
          )
          const completas = todos.filter((a) => a.pendencias.length === 0).length
          const todasMarcadas = visiveis.length > 0 && visiveis.every((a) => escolhidas.includes(a.pessoa_id))
          return (
            <>
              <div className="form-linha">
                <label>
                  Buscar associado
                  <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, igreja ou nº" />
                </label>
                <label className="campo-medio">
                  Mostrar
                  <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
                    <option value="todas">Todas ({todos.length})</option>
                    <option value="completas">Completas ({completas})</option>
                    <option value="pendentes">Com pendência ({todos.length - completas})</option>
                  </select>
                </label>
              </div>
              <div className="acoes">
                <label className="caixa-marcar">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    onChange={(e) =>
                      setEscolhidas(
                        e.target.checked
                          ? [...new Set([...escolhidas, ...visiveis.map((a) => a.pessoa_id)])]
                          : escolhidas.filter((id) => !visiveis.some((a) => a.pessoa_id === id)),
                      )
                    }
                  />
                  Marcar todas as mostradas
                </label>
                <button
                  type="button"
                  className="botao"
                  disabled={escolhidas.length === 0}
                  onClick={() => navegar(`/credenciais/imprimir?p=${escolhidas.join(',')}`)}
                >
                  Imprimir as marcadas ({escolhidas.length})
                </button>
              </div>
              {visiveis.length === 0 ? (
                <p className="vazio">Nenhum associado encontrado.</p>
              ) : (
                <ul className="lista" aria-label="Credenciais">
                  {visiveis.map((a) => (
                    <li key={a.pessoa_id} className="lista-item lista-item-estatico linha-credencial" aria-label={a.nome}>
                      <label className="caixa-marcar">
                        <input
                          type="checkbox"
                          aria-label={`Marcar ${a.nome} para imprimir`}
                          checked={escolhidas.includes(a.pessoa_id)}
                          onChange={(e) =>
                            setEscolhidas((atual) =>
                              e.target.checked ? [...atual, a.pessoa_id] : atual.filter((id) => id !== a.pessoa_id),
                            )
                          }
                        />
                        <strong>
                          <span className="numero">Nº {a.numero_registro}</span> {a.nome}
                        </strong>
                      </label>
                      <span>{a.igreja ?? 'Sem igreja'}</span>
                      <span>
                        {a.pendencias.length === 0 ? (
                          <span className="etiqueta etiqueta-ok">Completa</span>
                        ) : (
                          <span className="etiqueta etiqueta-atraso" title={a.pendencias.join(', ')}>
                            Falta: {a.pendencias.join(', ')}
                          </span>
                        )}
                      </span>
                      <Link to={`/credenciais/${a.pessoa_id}`} className="botao-texto alinhar-esquerda">
                        Ver a credencial
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

export function CredencialDe() {
  const { pessoaId = '' } = useParams()
  return <ConteudoDe key={pessoaId} pessoaId={pessoaId} />
}

function ConteudoDe({ pessoaId }: { pessoaId: string }) {
  const [carga, recarregar] = useCarregar(() => dadosCredenciais([pessoaId]))
  const [motivo, setMotivo] = useState('')
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
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
              <SituacaoAgora pacote={pacote} c={c} />
              <PendenciasCredencial pendencias={c.pendencias} />
              <section className="painel nao-imprimir" aria-labelledby="titulo-nova-credencial">
                <h2 id="titulo-nova-credencial">Perda, roubo ou dados que mudaram</h2>
                <p className="detalhe">
                  Emitir uma nova credencial troca o QR Code: a credencial antiga (impressa ou não) passa a mostrar
                  "substituída" na validação. Nada se apaga.
                </p>
                <form
                  className="form-linha"
                  onSubmit={(e) => {
                    e.preventDefault()
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
                    <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: perda" />
                  </label>
                  <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                    Emitir nova credencial
                  </button>
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
// Impressão no tamanho real: folhas A4 com 5 credenciais (frente e verso lado a lado)
// ---------------------------------------------------------------------

const POR_FOLHA = 5

export function ImprimirCredenciais() {
  const [parametros] = useSearchParams()
  const pessoas = useMemo(() => (parametros.get('p') ?? '').split(',').filter(Boolean), [parametros])
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
            <strong>Tamanho real:</strong> cada lado tem <strong>85,6 × 54 mm</strong> (o tamanho de cartão de crédito,
            o mesmo do PVC e das capinhas plásticas). Cabem {POR_FOLHA} credenciais por folha A4, frente e verso lado a
            lado.
          </p>
          <p>
            Na janela de impressão: papel <strong>A4</strong>, escala <strong>100%</strong> (não "ajustar à página") e com
            gráficos de fundo. Recorte nas linhas tracejadas, dobre ou cole frente com verso e ponha na capinha.
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
            <div className="folhas-impressao">
              {Array.from({ length: Math.ceil(pacote.credenciais.length / POR_FOLHA) }, (_, f) => (
                <section key={f} className="folha-a4" aria-label={`Folha ${f + 1}`}>
                  {pacote.credenciais.slice(f * POR_FOLHA, (f + 1) * POR_FOLHA).map((c) => (
                    <ParParaImprimir key={c.pessoa_id} pacote={pacote} c={c} />
                  ))}
                </section>
              ))}
            </div>
          )
        }
      </MostrarCarga>
    </>
  )
}

function ParParaImprimir({ pacote, c }: { pacote: PacoteCredenciais; c: DadosCredencial }) {
  const foto = useFoto(c, false)
  return (
    <div className="par-impressao">
      <div className="corte">
        <CredencialFrente c={c} foto={foto} />
      </div>
      <div className="corte">
        <CredencialVerso c={c} textoVerso={pacote.texto_verso} url={urlValidacao(c.codigo)} />
      </div>
    </div>
  )
}
