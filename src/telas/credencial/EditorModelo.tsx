// Credenciais › Modelos › editor (Fase 5.5, parte 7; rodada 8, opção 1: "o editor na tela inteira", aprovado).
// Em cima, a barra vermelha: voltar aos modelos, o nome, frente/verso, desfazer e refazer, o zoom, "Ver com" (a prévia
// com os dados de um ministro), "Testar a impressão" e "Salvar e usar". À esquerda, o trilho (Prontos, Textos, Dados,
// Imagens, Formas, Fundo, Camadas e Versões) e a gaveta da ferramenta; no meio, o cartão com as réguas e as guias
// (corte, sangria e área segura); à direita, Item (o item escolhido) e Cartão (o tamanho, os cantos e as guias).
// Cada vez que se salva nasce uma versão nova do desenho do modelo; nenhuma muda nem se apaga.
// No celular, o editor avisa que é feito no computador.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, BotaoArquivar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { FaceCredencial } from '../../componentes/CartaoCredencial'
import { Icone, type NomeIcone } from '../../componentes/Icone'
import {
  arquivarModelo,
  dadosCredenciais,
  enviarImagemModelo,
  listarPendencias,
  listarVersoesDoModelo,
  painelModelos,
  salvarVersaoDoModelo,
  urlValidacao,
  usarVersaoDoModelo,
  type DadosCredencial,
  type ModeloGrupo,
  type VersaoDoModelo,
} from '../../dados/credencial'
import { linkDoArquivo } from '../../dados/pedidos'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataHora } from '../../utilitarios/formatos'
import { prepararImagemModelo } from '../../utilitarios/imagens'
import {
  CAMPOS,
  cartaoDe,
  conferirModelo,
  DADOS_EXEMPLO,
  desenhoDoModelo,
  limitarCaixa,
  limitesDo,
  MAXIMO_ELEMENTOS,
  MODELO_PADRAO,
  MODELO_READEQUACAO,
  nomeDoElemento,
  normalizarModelo,
  novoElemento,
  novoId,
  posicaoDaFaixa,
  posicionarFaixa,
  PRONTOS,
  TAMANHOS,
  valoresDaCredencial,
  type Cartao,
  type Elemento,
  type ElementoTexto,
  type Face,
  type ItemNovo,
  type Lado,
  type ModeloCredencial,
  type PosicaoFaixa,
} from '../../utilitarios/modeloCredencial'

type Retorno = { sucesso?: string; erro?: string }

/** Foto FICTÍCIA (silhueta) para a prévia com os dados de exemplo. */
const FOTO_EXEMPLO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect width="30" height="40" fill="#cbd5e1"/><circle cx="15" cy="15" r="7" fill="#94a3b8"/><path d="M2 40c0-9 6-14 13-14s13 5 13 14z" fill="#94a3b8"/></svg>',
)}`

const arredondar = (valor: number, passo: number) => Math.round(Math.round(valor / passo) * passo * 100) / 100
/** 1 mm em pixels de CSS (96 por polegada): 100% = tamanho real */
const PX_POR_MM = 96 / 25.4

const CORES_COMEP = ['#b91c1c', '#7f1d1d', '#ffffff', '#e4e4e7', '#52525b', '#18181b']

// ---------------------------------------------------------------------
// Histórico (desfazer / refazer)
// ---------------------------------------------------------------------

type Historico = { passado: ModeloCredencial[]; presente: ModeloCredencial; futuro: ModeloCredencial[] }
const LIMITE_HISTORICO = 100

function useHistorico(inicial: ModeloCredencial) {
  const [h, setH] = useState<Historico>({ passado: [], presente: inicial, futuro: [] })
  // Digitação seguida no mesmo campo vira um passo só no "desfazer"
  const ultimo = useRef<{ chave: string; quando: number } | null>(null)

  function mudar(fn: (m: ModeloCredencial) => ModeloCredencial, chave?: string) {
    const agora = Date.now()
    const juntar = chave !== undefined && ultimo.current?.chave === chave && agora - ultimo.current.quando < 1500
    ultimo.current = chave === undefined ? null : { chave, quando: agora }
    setH((atual) => {
      const novo = fn(atual.presente)
      if (novo === atual.presente) return atual
      return {
        passado: juntar ? atual.passado : [...atual.passado, atual.presente].slice(-LIMITE_HISTORICO),
        presente: novo,
        futuro: [],
      }
    })
  }

  /** Guarda o ponto de partida (ex.: começo de um arrasto) sem mudar nada. */
  function marcar() {
    ultimo.current = null
    setH((atual) => ({ passado: [...atual.passado, atual.presente].slice(-LIMITE_HISTORICO), presente: atual.presente, futuro: [] }))
  }

  /** Muda sem criar passo no histórico (o arrasto, depois de marcar). */
  function trocar(fn: (m: ModeloCredencial) => ModeloCredencial) {
    setH((atual) => ({ ...atual, presente: fn(atual.presente) }))
  }

  function desfazer() {
    ultimo.current = null
    setH((atual) =>
      atual.passado.length === 0
        ? atual
        : { passado: atual.passado.slice(0, -1), presente: atual.passado[atual.passado.length - 1], futuro: [atual.presente, ...atual.futuro] },
    )
  }

  function refazer() {
    ultimo.current = null
    setH((atual) =>
      atual.futuro.length === 0
        ? atual
        : { passado: [...atual.passado, atual.presente], presente: atual.futuro[0], futuro: atual.futuro.slice(1) },
    )
  }

  return { modelo: h.presente, podeDesfazer: h.passado.length > 0, podeRefazer: h.futuro.length > 0, mudar, marcar, trocar, desfazer, refazer }
}

type HistoricoEditor = ReturnType<typeof useHistorico>

// ---------------------------------------------------------------------
// A página (fora da moldura: tela inteira)
// ---------------------------------------------------------------------

export function EditorTelaInteira() {
  const { id = '' } = useParams()
  return <CarregarEditor key={id} id={id} />
}

function CarregarEditor({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(painelModelos)
  return (
    <div className="editor-cheio-pagina">
      <div className="so-celular editor-no-celular">
        <Aviso titulo="O editor é feito no computador">
          <p>Os modelos da credencial se desenham numa tela maior. No celular, veja os modelos e quem recebe cada um.</p>
          <p>
            <Link to="/credenciais/modelos">← Voltar aos modelos</Link>
          </p>
        </Aviso>
      </div>
      <div className="so-computador">
        <MostrarCarga carga={carga} recarregar={recarregar}>
          {(painel) => {
            const m = painel.modelos.find((x) => x.id === id)
            if (!m) {
              return (
                <Aviso titulo="Modelo não encontrado">
                  <p>
                    Ele pode ter sido arquivado. <Link to="/credenciais/modelos">Voltar aos modelos</Link>
                  </p>
                </Aviso>
              )
            }
            return <Editor m={m} aoMudar={recarregar} />
          }}
        </MostrarCarga>
      </div>
    </div>
  )
}

type Ferramenta = 'prontos' | 'textos' | 'dados' | 'imagens' | 'formas' | 'fundo' | 'camadas' | 'versoes'

const FERRAMENTAS: readonly { chave: Ferramenta; nome: string; icone: NomeIcone }[] = [
  { chave: 'prontos', nome: 'Prontos', icone: 'grade' },
  { chave: 'textos', nome: 'Textos', icone: 'texto' },
  { chave: 'dados', nome: 'Dados', icone: 'dados' },
  { chave: 'imagens', nome: 'Imagens', icone: 'imagem' },
  { chave: 'formas', nome: 'Formas', icone: 'formas' },
  { chave: 'fundo', nome: 'Fundo', icone: 'fundo' },
  { chave: 'camadas', nome: 'Camadas', icone: 'camadas' },
  { chave: 'versoes', nome: 'Versões', icone: 'relogio' },
]

type Zoom = 'ajustar' | number

function Editor({ m, aoMudar }: { m: ModeloGrupo; aoMudar: () => void }) {
  // O desenho de partida é o que está em uso quando a tela abre
  const [inicial] = useState(() => desenhoDoModelo(m.tipo, m.desenho))
  const historico = useHistorico(inicial)
  const { modelo, mudar } = historico
  const [salvo, setSalvo] = useState(inicial)
  const [salvoEm, setSalvoEm] = useState(m.salvo_em)
  const [lado, setLado] = useState<Lado>('frente')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [ferramenta, setFerramenta] = useState<Ferramenta>('dados')
  const [aba, setAba] = useState<'item' | 'cartao'>('item')
  const [zoom, setZoom] = useState<Zoom>('ajustar')
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [retorno, setRetorno] = useState<Retorno>({})
  const previa = usePrevia()
  const cartao = cartaoDe(modelo)

  const face = modelo[lado]
  const escolhido = face.elementos.find((e) => e.id === selecionado) ?? null
  const mudou = JSON.stringify(modelo) !== JSON.stringify(salvo)

  // Avisa antes de sair com mudanças não salvas: fechando a aba ou clicando num link do sistema
  useEffect(() => {
    if (!mudou) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    const clique = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]')
      if (!link || link.getAttribute('target') === '_blank' || e.defaultPrevented) return
      if (!window.confirm('Há mudanças no modelo que não foram salvas. Sair mesmo assim e perder as mudanças?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', avisar)
    document.addEventListener('click', clique, true)
    return () => {
      window.removeEventListener('beforeunload', avisar)
      document.removeEventListener('click', clique, true)
    }
  }, [mudou])

  // Ctrl+Z / Ctrl+Y fora dos campos de texto (nos campos, vale o desfazer do próprio campo)
  useEffect(() => {
    const teclas = (e: globalThis.KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo.closest('textarea, input:not([type=checkbox]):not([type=color]):not([type=radio]):not([type=file])')) return
      if (!(e.ctrlKey || e.metaKey)) return
      const tecla = e.key.toLowerCase()
      if (tecla === 'z' && !e.shiftKey) {
        e.preventDefault()
        historico.desfazer()
      } else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) {
        e.preventDefault()
        historico.refazer()
      }
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  })

  const mudarFace = (fn: (f: Face) => Face, chave?: string) => mudar((m) => ({ ...m, [lado]: fn(m[lado]) }), chave)
  const mudarItens = (fn: (elementos: Elemento[]) => Elemento[], chave?: string) =>
    mudarFace((f) => ({ ...f, elementos: fn(f.elementos) }), chave)

  const alterar = (id: string, mudanca: Partial<Elemento>, chave?: string) =>
    mudarItens((lista) => lista.map((e) => (e.id === id ? ({ ...e, ...mudanca } as Elemento) : e)), chave && `${lado}:${id}:${chave}`)

  function acrescentar(e: Elemento) {
    if (face.elementos.length >= MAXIMO_ELEMENTOS) {
      setRetorno({ erro: `No máximo ${MAXIMO_ELEMENTOS} itens por lado.` })
      return
    }
    mudarItens((lista) => [...lista, e])
    setSelecionado(e.id)
    setAba('item')
  }

  function adicionar(tipo: ItemNovo, ajuste: Partial<Elemento> = {}) {
    const id = novoId([...modelo.frente.elementos, ...modelo.verso.elementos])
    let e = { ...novoElemento(tipo, id), ...ajuste } as Elemento
    if (e.tipo === 'faixa') e = posicionarFaixa(e, 'rodape', cartao)
    acrescentar(limitarCaixa(e, cartao))
  }

  function duplicar(e: Elemento) {
    const id = novoId([...modelo.frente.elementos, ...modelo.verso.elementos])
    mudarItens((lista) => {
      const i = lista.findIndex((x) => x.id === e.id)
      return [...lista.slice(0, i + 1), limitarCaixa({ ...e, id, x: e.x + 2, y: e.y + 2 }, cartao), ...lista.slice(i + 1)]
    })
    setSelecionado(id)
  }

  function remover(e: Elemento) {
    mudarItens((lista) => lista.filter((x) => x.id !== e.id))
    setSelecionado(null)
  }

  /** Muda a ordem (o último da lista fica por cima de todos). */
  function camada(e: Elemento, direcao: 1 | -1) {
    mudarItens((lista) => {
      const i = lista.findIndex((x) => x.id === e.id)
      const j = i + direcao
      if (j < 0 || j >= lista.length) return lista
      const nova = [...lista]
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      return nova
    })
  }

  function abrir(novo: ModeloCredencial, aviso: string) {
    mudar(() => structuredClone(novo))
    setSelecionado(null)
    setRetorno({ sucesso: aviso })
  }

  /** Novo tamanho: os itens acompanham na mesma proporção (a faixa continua no lado dela). */
  function mudarCartao(novo: Cartao) {
    mudar((atual) => {
      const antes = cartaoDe(atual)
      if (antes.largura === novo.largura && antes.altura === novo.altura) return { ...atual, cartao: novo }
      const fx = novo.largura / antes.largura
      const fy = novo.altura / antes.altura
      const ajustar = (f: Face): Face => ({
        ...f,
        elementos: f.elementos.map((e) => {
          const posicao = e.tipo === 'faixa' ? posicaoDaFaixa(e, antes) : null
          if (posicao) return posicionarFaixa(e, posicao, novo, posicao === 'rodape' || posicao === 'topo' ? e.h : e.w)
          return limitarCaixa(
            { ...e, x: arredondar(e.x * fx, 0.1), y: arredondar(e.y * fy, 0.1), w: arredondar(e.w * fx, 0.1), h: arredondar(e.h * fy, 0.1) },
            novo,
          )
        }),
      })
      return { ...atual, cartao: novo, frente: ajustar(atual.frente), verso: ajustar(atual.verso) }
    })
  }

  const avisos = useMemo(() => conferirModelo(modelo), [modelo])
  const nomeDoTipo = m.tipo === 'readequacao' ? 'MODELO_READEQUACAO' : 'MODELO_PADRAO'

  return (
    <div className="editor-cheio">
      <header className="editor-cheio-topo">
        <Link to="/credenciais/modelos" className="editor-voltar">
          <Icone nome="voltar" tamanho={18} />
          Modelos
        </Link>
        <span className="editor-cheio-nome">
          <h1>Modelo: {m.nome}</h1>
          <span>{mudou ? 'mudanças não salvas' : salvoEm ? `salvo em ${formatarDataHora(salvoEm)}` : 'desenho do sistema'}</span>
        </span>
        <div className="editor-lados" role="tablist" aria-label="Lado da credencial">
          {(['frente', 'verso'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lado === l}
              className={lado === l ? 'ativo' : undefined}
              onClick={() => {
                setLado(l)
                setSelecionado(null)
              }}
            >
              {l === 'frente' ? 'Frente' : 'Verso'}
            </button>
          ))}
        </div>
        <span className="editor-desfazer">
          <button type="button" className="botao-icone" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!historico.podeDesfazer} onClick={historico.desfazer}>
            <Icone nome="desfazer" tamanho={18} />
          </button>
          <button type="button" className="botao-icone" aria-label="Refazer" title="Refazer (Ctrl+Y)" disabled={!historico.podeRefazer} onClick={historico.refazer}>
            <Icone nome="refazer" tamanho={18} />
          </button>
        </span>
        <label className="editor-zoom">
          <span className="somente-leitor">Zoom</span>
          <select value={String(zoom)} onChange={(e) => setZoom(e.target.value === 'ajustar' ? 'ajustar' : Number(e.target.value))}>
            <option value="ajustar">Ajustar</option>
            <option value="1">100%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
            <option value="3">300%</option>
          </select>
        </label>
        <label className="editor-ver-com">
          Ver com:
          <select value={previa.escolha} onChange={(e) => previa.escolher(e.target.value)}>
            <option value="exemplo">Exemplo</option>
            {previa.associados.map((a) => (
              <option key={a.pessoa_id} value={a.pessoa_id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="botao editor-botao-claro-vazado" onClick={() => setTestando(true)}>
          Testar a impressão
        </button>
        <button type="button" className="botao editor-botao-claro" onClick={() => setSalvando(true)}>
          Salvar e usar
        </button>
      </header>

      <div className="editor-cheio-corpo">
        <nav className="editor-trilho" aria-label="Ferramentas do editor">
          {FERRAMENTAS.map((f) => (
            <button key={f.chave} type="button" aria-pressed={ferramenta === f.chave} className={ferramenta === f.chave ? 'ativo' : undefined} onClick={() => setFerramenta(f.chave)}>
              <Icone nome={f.icone} tamanho={20} />
              <span>{f.nome}</span>
            </button>
          ))}
        </nav>

        <aside className="editor-gaveta" aria-label={FERRAMENTAS.find((f) => f.chave === ferramenta)?.nome}>
          {ferramenta === 'prontos' && (
            <GavetaProntos tipo={m.tipo} aoUsar={(novo, nome) => abrir({ ...novo, cartao: cartao }, `Desenho "${nome}" aberto no editor. Dá para desfazer.`)} />
          )}
          {ferramenta === 'textos' && <GavetaTextos adicionar={adicionar} lado={lado} />}
          {ferramenta === 'dados' && <GavetaDados modelo={modelo} adicionar={adicionar} lado={lado} />}
          {ferramenta === 'imagens' && (
            <GavetaImagens adicionar={adicionar} aoErro={(erro) => setRetorno({ erro })} />
          )}
          {ferramenta === 'formas' && <GavetaFormas adicionar={adicionar} />}
          {ferramenta === 'fundo' && <GavetaFundo modelo={modelo} face={face} mudarFace={mudarFace} lado={lado} aoErro={(erro) => setRetorno({ erro })} />}
          {ferramenta === 'camadas' && (
            <GavetaCamadas face={face} selecionado={selecionado} aoSelecionar={(id) => { setSelecionado(id); setAba('item') }} camada={camada} />
          )}
          {ferramenta === 'versoes' && (
            <GavetaVersoes
              m={m}
              aoAbrir={(v) => abrir(desenhoDoModelo(m.tipo, v.modelo), `Versão "${v.descricao}" aberta no editor.`)}
              aoAbrirSistema={() => abrir(m.tipo === 'readequacao' ? MODELO_READEQUACAO : MODELO_PADRAO, `Desenho do sistema (${nomeDoTipo === 'MODELO_READEQUACAO' ? 'readequação' : 'padrão'}) aberto no editor. Salve para usar.`)}
              aoMudar={(r) => {
                setRetorno(r)
                aoMudar()
              }}
            />
          )}
        </aside>

        <main className="editor-mesa">
          <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
          <Palco
            lado={lado}
            modelo={modelo}
            previa={previa}
            zoom={zoom}
            selecionado={selecionado}
            aoSelecionar={(id) => {
              setSelecionado(id)
              if (id) setAba('item')
            }}
            historico={historico}
            aoRemover={(e) => remover(e)}
          />
          <p className="editor-legenda" aria-hidden="true">
            <span className="legenda-corte">Corte: {fmt(cartao.largura)} × {fmt(cartao.altura)} mm</span>
            <span className="legenda-sangria">Sangria: {fmt(cartao.sangria)} mm para fora</span>
            <span className="legenda-segura">Área segura: {fmt(cartao.seguranca)} mm para dentro</span>
          </p>
          <div className="editor-miniaturas" role="group" aria-label="Lados">
            {(['frente', 'verso'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={lado === l ? 'ativo' : undefined}
                aria-label={`Ver ${l === 'frente' ? 'a frente' : 'o verso'}`}
                onClick={() => {
                  setLado(l)
                  setSelecionado(null)
                }}
              >
                <span className="editor-miniatura-cartao" aria-hidden="true">
                  <FaceCredencial lado={l} modelo={modelo} {...previa.props} />
                </span>
                <span>{l === 'frente' ? 'Frente' : 'Verso'}</span>
              </button>
            ))}
          </div>
          {avisos.length > 0 && (
            <div className="editor-avisos">
              <Aviso titulo="Confira antes de salvar">
                <ul>
                  {avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Aviso>
            </div>
          )}
        </main>

        <aside className="editor-propriedades" aria-label="Propriedades">
          <div className="editor-abas" role="tablist" aria-label="O que mudar">
            <button type="button" role="tab" aria-selected={aba === 'item'} className={aba === 'item' ? 'ativo' : undefined} onClick={() => setAba('item')}>
              Item
            </button>
            <button type="button" role="tab" aria-selected={aba === 'cartao'} className={aba === 'cartao' ? 'ativo' : undefined} onClick={() => setAba('cartao')}>
              Cartão
            </button>
          </div>
          {aba === 'item' &&
            (escolhido ? (
              <Propriedades
                key={`${lado}:${escolhido.id}`}
                e={escolhido}
                cartao={cartao}
                cores={coresDoModelo(modelo)}
                alterar={(mudanca, chave) => alterar(escolhido.id, mudanca, chave)}
                aoDuplicar={() => duplicar(escolhido)}
                aoRemover={() => remover(escolhido)}
                aoSubir={() => camada(escolhido, 1)}
                aoDescer={() => camada(escolhido, -1)}
                aoErro={(erro) => setRetorno({ erro })}
              />
            ) : (
              <p className="detalhe editor-sem-item">
                Clique num item da credencial para mudar a letra, a cor, a posição e o tamanho. Para acrescentar, use o
                trilho da esquerda.
              </p>
            ))}
          {aba === 'cartao' && <PropriedadesCartao cartao={cartao} aoMudar={mudarCartao} />}
        </aside>
      </div>

      {salvando && (
        <Salvar
          m={m}
          modelo={modelo}
          avisos={avisos}
          aoFechar={() => setSalvando(false)}
          aoSalvar={(usar, gravado) => {
            mudar(() => gravado)
            setSalvo(gravado)
            setSalvoEm(new Date().toISOString())
            setSalvando(false)
            setRetorno({ sucesso: usar ? 'Modelo salvo e em uso: as credenciais de quem recebe este modelo já mudaram.' : 'Modelo salvo (sem usar ainda).' })
            aoMudar()
          }}
        />
      )}
      {testando && <TestarImpressao modelo={modelo} previa={previa} aoFechar={() => setTestando(false)} />}
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** As cores usadas no desenho (para escolher de novo com um clique). */
function coresDoModelo(m: ModeloCredencial): string[] {
  const cores = new Set<string>()
  for (const f of [m.frente, m.verso]) {
    cores.add(f.fundo)
    if (f.fundo2) cores.add(f.fundo2)
    for (const e of f.elementos) {
      if ('cor' in e) cores.add(e.cor)
      if (e.tipo === 'forma' && e.cor2) cores.add(e.cor2)
    }
  }
  return [...cores].slice(0, 10)
}

// ---------------------------------------------------------------------
// Prévia: dados de exemplo ou de um associado de verdade
// ---------------------------------------------------------------------

function usePrevia() {
  const [lista] = useCarregar(listarPendencias)
  const [escolha, setEscolha] = useState('exemplo')
  const [dados, setDados] = useState<{ c: DadosCredencial; texto: string; foto: string | null }>({
    c: DADOS_EXEMPLO,
    texto: 'Texto do verso, como em Credenciais › Validade e verso: credencial pessoal e intransferível de associado do COMEP.',
    foto: FOTO_EXEMPLO,
  })
  // a última escolha: resposta de uma escolha anterior (mais lenta) não troca a prévia
  const pedido = useRef(0)

  async function escolher(valor: string) {
    setEscolha(valor)
    const meu = ++pedido.current
    if (valor === 'exemplo') {
      setDados((d) => ({ c: DADOS_EXEMPLO, texto: d.texto, foto: FOTO_EXEMPLO }))
      return
    }
    const r = await dadosCredenciais([valor])
    const c = r.erro === null ? r.dados.credenciais[0] : undefined
    if (!c || r.erro !== null || meu !== pedido.current) return
    const foto = c.foto_caminho ? await linkDoArquivo(c.foto_caminho) : null
    if (meu !== pedido.current) return
    setDados({ c, texto: r.dados.texto_verso, foto })
  }

  const valores = useMemo(() => valoresDaCredencial(dados.c, dados.texto), [dados.c, dados.texto])
  const associados = lista.situacao === 'ok' ? lista.dados.filter((a) => a.pendencias.length === 0) : []
  return {
    escolha,
    escolher: (v: string) => void escolher(v),
    associados,
    props: { valores, nome: dados.c.nome, foto: dados.foto, urlQr: urlValidacao(dados.c.codigo) },
  }
}

type Previa = ReturnType<typeof usePrevia>

// ---------------------------------------------------------------------
// O cartão no meio: réguas, guias (corte, sangria, área segura) e a camada de edição por cima
// ---------------------------------------------------------------------

type Arrasto = {
  id: string
  modo: 'mover' | 'tamanho'
  x0: number
  y0: number
  inicio: { x: number; y: number; w: number; h: number }
  mmPorPx: number
  moveu: boolean
}

function Regua({ mm, pxPorMm, vertical }: { mm: number; pxPorMm: number; vertical?: boolean }) {
  const marcas: ReactNode[] = []
  for (let i = 0; i <= Math.floor(mm); i++) {
    const tamanho = i % 10 === 0 ? 8 : i % 5 === 0 ? 5 : 2.5
    if (pxPorMm < 3 && i % 5 !== 0) continue
    const p = i * pxPorMm
    marcas.push(
      vertical ? (
        <line key={i} x1={18 - tamanho} x2={18} y1={p} y2={p} />
      ) : (
        <line key={i} y1={18 - tamanho} y2={18} x1={p} x2={p} />
      ),
    )
    if (i % 10 === 0) {
      marcas.push(
        vertical ? (
          <text key={`t${i}`} x={1} y={p + 9}>
            {i}
          </text>
        ) : (
          <text key={`t${i}`} x={p + 2} y={9}>
            {i}
          </text>
        ),
      )
    }
  }
  const comprimento = mm * pxPorMm
  return (
    <svg className={vertical ? 'regua regua-vertical' : 'regua'} width={vertical ? 18 : comprimento} height={vertical ? comprimento : 18} aria-hidden="true">
      {marcas}
    </svg>
  )
}

function Palco({
  lado,
  modelo,
  previa,
  zoom,
  selecionado,
  aoSelecionar,
  historico,
  aoRemover,
}: {
  lado: Lado
  modelo: ModeloCredencial
  previa: Previa
  zoom: Zoom
  selecionado: string | null
  aoSelecionar: (id: string | null) => void
  historico: HistoricoEditor
  aoRemover: (e: Elemento) => void
}) {
  const area = useRef<HTMLDivElement>(null)
  const camada = useRef<HTMLDivElement>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const [espaco, setEspaco] = useState({ w: 700, h: 420 })
  const face = modelo[lado]
  const cartao = cartaoDe(modelo)

  useEffect(() => {
    const no = area.current
    if (!no) return
    const observador = new ResizeObserver(() => setEspaco({ w: no.clientWidth, h: no.clientHeight }))
    observador.observe(no)
    return () => observador.disconnect()
  }, [])

  // "Ajustar à tela": o cartão com a sangria cabe no espaço, com folga para as réguas
  const ajustado = Math.max(2, Math.min((espaco.w - 90) / (cartao.largura + cartao.sangria * 2), (Math.max(espaco.h, 300) - 70) / (cartao.altura + cartao.sangria * 2)))
  const pxPorMm = zoom === 'ajustar' ? Math.min(ajustado, 14) : zoom * PX_POR_MM
  const largura = cartao.largura * pxPorMm
  const altura = cartao.altura * pxPorMm
  const pct = (valor: number, total: number) => `${(valor * 100) / total}%`

  const trocarItem = (id: string, mudanca: Partial<Elemento>) =>
    historico.trocar((m) => ({
      ...m,
      [lado]: {
        ...m[lado],
        elementos: m[lado].elementos.map((e) => (e.id === id ? limitarCaixa({ ...e, ...mudanca } as Elemento, cartao) : e)),
      },
    }))

  function iniciar(ev: PointerEvent<HTMLElement>, e: Elemento, modo: Arrasto['modo']) {
    if (ev.button !== 0) return
    ev.stopPropagation()
    ev.preventDefault()
    aoSelecionar(e.id)
    camada.current?.focus({ preventScroll: true })
    arrasto.current = { id: e.id, modo, x0: ev.clientX, y0: ev.clientY, inicio: { x: e.x, y: e.y, w: e.w, h: e.h }, mmPorPx: 1 / pxPorMm, moveu: false }
    ev.currentTarget.setPointerCapture(ev.pointerId)
  }

  function mover(ev: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current
    if (!a) return
    const dx = (ev.clientX - a.x0) * a.mmPorPx
    const dy = (ev.clientY - a.y0) * a.mmPorPx
    if (!a.moveu) {
      if (Math.hypot(dx, dy) < 0.3) return
      a.moveu = true
      historico.marcar()
    }
    const passo = ev.shiftKey ? 1 : 0.1
    if (a.modo === 'mover') {
      trocarItem(a.id, { x: arredondar(a.inicio.x + dx, passo), y: arredondar(a.inicio.y + dy, passo) })
    } else {
      trocarItem(a.id, { w: Math.max(0.5, arredondar(a.inicio.w + dx, passo)), h: Math.max(0.3, arredondar(a.inicio.h + dy, passo)) })
    }
  }

  function soltar() {
    arrasto.current = null
  }

  function teclas(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key === 'Escape') {
      aoSelecionar(null)
      return
    }
    const e = face.elementos.find((x) => x.id === selecionado)
    if (e && (ev.key === 'Delete' || ev.key === 'Backspace')) {
      ev.preventDefault()
      aoRemover(e)
      return
    }
    const direcoes: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const d = direcoes[ev.key]
    if (!e || !d) return
    ev.preventDefault()
    const passo = ev.shiftKey ? 2 : ev.altKey ? 0.1 : 0.5
    historico.mudar(
      (m) => ({
        ...m,
        [lado]: {
          ...m[lado],
          elementos: m[lado].elementos.map((x) =>
            x.id === e.id ? limitarCaixa({ ...x, x: arredondar(x.x + d[0] * passo, 0.01), y: arredondar(x.y + d[1] * passo, 0.01) }, cartao) : x,
          ),
        },
      }),
      `${lado}:${e.id}:teclas`,
    )
  }

  const escolhido = face.elementos.find((x) => x.id === selecionado)
  const sangria = cartao.sangria * pxPorMm
  const segura = cartao.seguranca * pxPorMm

  return (
    <div className="editor-area" ref={area}>
      <div className="editor-com-reguas" style={{ width: largura + 18 + sangria * 2 + 24 }}>
        <div className="editor-regua-topo" style={{ marginLeft: 18 + sangria + 12 }}>
          <Regua mm={cartao.largura} pxPorMm={pxPorMm} />
        </div>
        <div className="editor-linha-palco">
          <div className="editor-regua-lado" style={{ marginTop: sangria + 12 }}>
            <Regua mm={cartao.altura} pxPorMm={pxPorMm} vertical />
          </div>
          <div className="editor-palco-cheio" style={{ padding: sangria + 12 }}>
            <div className="guia-sangria" style={{ inset: 12 }} aria-hidden="true" />
            <div className="editor-palco" style={{ width: largura, height: altura }}>
              <FaceCredencial lado={lado} modelo={modelo} {...previa.props} />
              <div className="guia-segura" style={{ inset: segura }} aria-hidden="true" />
              <div
                ref={camada}
                className="editor-camada"
                tabIndex={0}
                role="application"
                aria-label={`Edição da ${lado}: clique num item para escolher, arraste para mover; as setas movem o item escolhido; Delete tira`}
                onPointerDown={(ev) => {
                  if (ev.target === ev.currentTarget) aoSelecionar(null)
                }}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                onKeyDown={teclas}
              >
                {face.elementos.map((e) => (
                  <div
                    key={e.id}
                    className={e.id === selecionado ? 'editor-alvo editor-alvo-escolhido' : 'editor-alvo'}
                    data-alvo={e.id}
                    title={nomeDoElemento(e)}
                    style={{
                      left: pct(e.x, cartao.largura),
                      top: pct(e.y, cartao.altura),
                      width: pct(e.w, cartao.largura),
                      height: pct(e.h, cartao.altura),
                      transform: e.rotacao ? `rotate(${e.rotacao}deg)` : undefined,
                    }}
                    onPointerDown={(ev) => iniciar(ev, e, 'mover')}
                  >
                    {e.id === selecionado && (
                      <span className="editor-alca" title="Arraste para mudar o tamanho" onPointerDown={(ev) => iniciar(ev, e, 'tamanho')} />
                    )}
                  </div>
                ))}
              </div>
              {escolhido && (
                <span className="editor-posicao" style={{ left: `calc(${pct(escolhido.x + escolhido.w, cartao.largura)} + 6px)`, top: pct(escolhido.y, cartao.altura) }}>
                  X {fmt(escolhido.x)} · Y {fmt(escolhido.y)} mm
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// As gavetas do trilho
// ---------------------------------------------------------------------

function TituloGaveta({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="gaveta-titulo">
      <h2>{titulo}</h2>
      {children && <p className="detalhe">{children}</p>}
    </div>
  )
}

function GavetaProntos({ tipo, aoUsar }: { tipo: ModeloGrupo['tipo']; aoUsar: (m: ModeloCredencial, nome: string) => void }) {
  const lista = tipo === 'readequacao' ? [{ chave: 'readequacao', nome: 'Readequação (cinza com a faixa)', modelo: MODELO_READEQUACAO }, ...PRONTOS] : PRONTOS
  return (
    <>
      <TituloGaveta titulo="Modelos prontos">Troca o desenho deste lado e do outro. O tamanho do cartão continua. Dá para desfazer.</TituloGaveta>
      <ul className="gaveta-prontos">
        {lista.map((p) => (
          <li key={p.chave}>
            <button type="button" onClick={() => aoUsar(p.modelo, p.nome)} aria-label={`Usar o desenho ${p.nome}`}>
              <MiniFace modelo={p.modelo} />
              <span>{p.nome}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function MiniFace({ modelo }: { modelo: ModeloCredencial }) {
  const valores = useMemo(() => valoresDaCredencial({ ...DADOS_EXEMPLO, nome: 'Marcos Antônio Lima' }, 'Texto do verso.'), [])
  return (
    <span className="mini-cartao" aria-hidden="true">
      <FaceCredencial lado="frente" modelo={modelo} valores={valores} nome="Marcos Antônio Lima" foto={null} urlQr={urlValidacao(DADOS_EXEMPLO.codigo)} />
    </span>
  )
}

function GavetaTextos({ adicionar, lado }: { adicionar: (t: ItemNovo, ajuste?: Partial<Elemento>) => void; lado: Lado }) {
  const botoes: { nome: string; ajuste: Partial<ElementoTexto> }[] = [
    { nome: 'Título', ajuste: { texto: 'Título', tamanho: 11, peso: 800, h: 5.5, w: 40 } },
    { nome: 'Texto', ajuste: { texto: 'Texto novo', tamanho: 7 } },
    { nome: 'Texto pequeno', ajuste: { texto: 'Texto pequeno', tamanho: 5, h: 3 } },
    { nome: 'Versículo (várias linhas)', ajuste: { texto: '"Ide por todo o mundo e pregai o evangelho a toda criatura." (Marcos 16:15)', tamanho: 5.6, italico: true, quebrar: true, w: 45, h: 9 } },
  ]
  return (
    <>
      <TituloGaveta titulo="Textos">Entram {lado === 'frente' ? 'na frente' : 'no verso'}; os dados do ministro ficam em Dados.</TituloGaveta>
      <div className="gaveta-botoes">
        {botoes.map((b) => (
          <button key={b.nome} type="button" className="botao botao-secundario" onClick={() => adicionar('texto', b.ajuste as Partial<Elemento>)}>
            + {b.nome}
          </button>
        ))}
        <button type="button" className="botao botao-secundario" onClick={() => adicionar('faixa')}>
          + Faixa de aviso
        </button>
      </div>
    </>
  )
}

/** Os dados do ministro: os que já estão na credencial e os que dá para acrescentar. */
function GavetaDados({ modelo, adicionar, lado }: { modelo: ModeloCredencial; adicionar: (t: ItemNovo, ajuste?: Partial<Elemento>) => void; lado: Lado }) {
  const todos = [...modelo.frente.elementos, ...modelo.verso.elementos]
  const usa = (chave: string) => todos.some((e) => e.tipo === 'texto' && e.texto.includes(`{${chave}}`))
  const linhas = [
    ...CAMPOS.map((c) => ({
      chave: c.chave,
      nome: c.rotulo,
      tem: usa(c.chave),
      acrescentar: () => adicionar('dado', { texto: `{${c.chave}}` } as Partial<Elemento>),
    })),
    { chave: 'foto', nome: 'Foto 3×4', tem: todos.some((e) => e.tipo === 'foto'), acrescentar: () => adicionar('foto') },
    { chave: 'qr', nome: 'QR Code de conferência', tem: todos.some((e) => e.tipo === 'qr'), acrescentar: () => adicionar('qr') },
  ]
  return (
    <>
      <TituloGaveta titulo="Dados do ministro">
        Cada credencial sai com os dados da própria pessoa. O "+" acrescenta {lado === 'frente' ? 'na frente' : 'no verso'}.
      </TituloGaveta>
      <ul className="gaveta-dados" aria-label="Dados do ministro">
        {linhas.map((l) => (
          <li key={l.chave}>
            <span>{l.nome}</span>
            {l.tem && <span className="na-credencial">na credencial</span>}
            <button type="button" className="botao-icone" aria-label={`Acrescentar ${l.nome}`} onClick={l.acrescentar}>
              <Icone nome="mais" tamanho={16} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function GavetaImagens({ adicionar, aoErro }: { adicionar: (t: ItemNovo, ajuste?: Partial<Elemento>) => void; aoErro: (erro: string) => void }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <>
      <TituloGaveta titulo="Imagens">
        O logo do sistema ou uma imagem enviada (PNG, JPG ou WebP). O logotipo de uma denominação só com o arquivo que ela
        fornecer.
      </TituloGaveta>
      <div className="gaveta-botoes">
        <button type="button" className="botao botao-secundario" onClick={() => adicionar('imagem')}>
          + Logo do sistema
        </button>
        <label className="botao botao-secundario botao-arquivo">
          {enviando ? 'Enviando…' : 'Enviar uma imagem'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="somente-leitor"
            disabled={enviando}
            onChange={(ev) => {
              const arquivo = ev.target.files?.[0]
              ev.target.value = ''
              if (!arquivo) return
              void umaVez(async () => {
                const pronto = await prepararImagemModelo(arquivo)
                if ('erro' in pronto) return aoErro(pronto.erro)
                const r = await enviarImagemModelo(pronto.blob, pronto.extensao)
                if (r.erro !== null) aoErro(r.erro)
                else adicionar('imagem', { arquivo: r.dados } as Partial<Elemento>)
              })
            }}
          />
        </label>
      </div>
    </>
  )
}

function GavetaFormas({ adicionar }: { adicionar: (t: ItemNovo, ajuste?: Partial<Elemento>) => void }) {
  return (
    <>
      <TituloGaveta titulo="Formas">Faixas, caixas e linhas. A cor e os cantos mudam na aba Item.</TituloGaveta>
      <div className="gaveta-botoes">
        <button type="button" className="botao botao-secundario" onClick={() => adicionar('retangulo')}>
          + Retângulo
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => adicionar('circulo')}>
          + Círculo
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => adicionar('linha')}>
          + Linha
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => adicionar('faixa')}>
          + Faixa de aviso
        </button>
      </div>
    </>
  )
}

function Amostras({ cores, atual, aoEscolher, rotulo }: { cores: string[]; atual: string; aoEscolher: (c: string) => void; rotulo: string }) {
  return (
    <div className="amostras" role="group" aria-label={rotulo}>
      {cores.map((c) => (
        <button
          key={c}
          type="button"
          className={c === atual ? 'amostra escolhida' : 'amostra'}
          style={{ background: c }}
          aria-label={`Cor ${c}`}
          aria-pressed={c === atual}
          onClick={() => aoEscolher(c)}
        />
      ))}
    </div>
  )
}

function GavetaFundo({
  modelo,
  face,
  mudarFace,
  lado,
  aoErro,
}: {
  modelo: ModeloCredencial
  face: Face
  mudarFace: (fn: (f: Face) => Face, chave?: string) => void
  lado: Lado
  aoErro: (erro: string) => void
}) {
  const [enviando, umaVez] = useUmaVez()
  const modo = face.imagem ? 'imagem' : face.fundo2 ? 'degrade' : 'cor'
  return (
    <>
      <TituloGaveta titulo="Fundo do cartão">{lado === 'frente' ? 'Da frente.' : 'Do verso.'}</TituloGaveta>
      <div className="segmentado" role="group" aria-label="Tipo de fundo">
        <button type="button" aria-pressed={modo === 'cor'} onClick={() => mudarFace((f) => ({ ...f, fundo2: null, imagem: null }))}>
          Cor
        </button>
        <button type="button" aria-pressed={modo === 'degrade'} onClick={() => mudarFace((f) => ({ ...f, fundo2: f.fundo2 ?? '#fecaca', imagem: null }))}>
          Degradê
        </button>
      </div>
      <label className="campo-cor">
        Cor do fundo
        <input type="color" value={face.fundo} onChange={(e) => mudarFace((f) => ({ ...f, fundo: e.target.value }), `${lado}:fundo`)} />
      </label>
      {face.fundo2 && (
        <>
          <label className="campo-cor">
            Segunda cor (degradê)
            <input type="color" value={face.fundo2} onChange={(e) => mudarFace((f) => ({ ...f, fundo2: e.target.value }), `${lado}:fundo2`)} />
          </label>
          <CampoNumero rotulo="Direção do degradê (graus)" valor={face.anguloFundo} min={-360} max={360} passo={5} aoMudar={(anguloFundo) => mudarFace((f) => ({ ...f, anguloFundo }), `${lado}:angulo`)} />
        </>
      )}
      <h3 className="gaveta-subtitulo">Cores deste modelo</h3>
      <Amostras cores={coresDoModelo(modelo)} atual={face.fundo} rotulo="Cores deste modelo" aoEscolher={(c) => mudarFace((f) => ({ ...f, fundo: c }))} />
      <h3 className="gaveta-subtitulo">Cores do COMEP</h3>
      <Amostras cores={CORES_COMEP} atual={face.fundo} rotulo="Cores do COMEP" aoEscolher={(c) => mudarFace((f) => ({ ...f, fundo: c }))} />
      <h3 className="gaveta-subtitulo">Marca d'água</h3>
      <label className="caixa-marcar">
        <input
          type="checkbox"
          checked={face.marca !== null}
          onChange={(e) => mudarFace((f) => ({ ...f, marca: e.target.checked ? { simbolo: 'comep', opacidade: 0.08 } : null }))}
        />
        Símbolo do COMEP no meio
      </label>
      {face.marca && (
        <CampoNumero
          rotulo="Transparência da marca (%)"
          valor={Math.round(face.marca.opacidade * 100)}
          min={2}
          max={50}
          passo={1}
          aoMudar={(n) => mudarFace((f) => ({ ...f, marca: { simbolo: 'comep', opacidade: n / 100 } }), `${lado}:marca`)}
        />
      )}
      <h3 className="gaveta-subtitulo">Imagem de fundo</h3>
      {face.imagem ? (
        <button type="button" className="botao-texto" onClick={() => mudarFace((f) => ({ ...f, imagem: null }))}>
          Tirar a imagem de fundo
        </button>
      ) : (
        <label className="botao botao-secundario botao-arquivo envio-fundo">
          {enviando ? 'Enviando…' : 'Enviar uma imagem de fundo (PNG ou JPG, 1012 × 638 px ou maior)'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="somente-leitor"
            disabled={enviando}
            onChange={(ev) => {
              const arquivo = ev.target.files?.[0]
              ev.target.value = ''
              if (!arquivo) return
              void umaVez(async () => {
                const pronto = await prepararImagemModelo(arquivo)
                if ('erro' in pronto) return aoErro(pronto.erro)
                const r = await enviarImagemModelo(pronto.blob, pronto.extensao)
                if (r.erro !== null) aoErro(r.erro)
                else mudarFace((f) => ({ ...f, imagem: r.dados }))
              })
            }}
          />
        </label>
      )}
    </>
  )
}

function GavetaCamadas({
  face,
  selecionado,
  aoSelecionar,
  camada,
}: {
  face: Face
  selecionado: string | null
  aoSelecionar: (id: string) => void
  camada: (e: Elemento, direcao: 1 | -1) => void
}) {
  return (
    <>
      <TituloGaveta titulo="Camadas">O de cima da lista aparece por cima dos outros.</TituloGaveta>
      <ul className="editor-itens" aria-label="Itens deste lado">
        {[...face.elementos].reverse().map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={e.id === selecionado ? 'editor-item editor-item-escolhido' : 'editor-item'}
              aria-pressed={e.id === selecionado}
              onClick={() => aoSelecionar(e.id)}
            >
              {nomeDoElemento(e)}
            </button>
            <span className="ordem-setas">
              <button type="button" className="botao-icone" aria-label={`Trazer para cima: ${nomeDoElemento(e)}`} onClick={() => camada(e, 1)}>
                <Icone nome="cima" tamanho={14} />
              </button>
              <button type="button" className="botao-icone" aria-label={`Levar para baixo: ${nomeDoElemento(e)}`} onClick={() => camada(e, -1)}>
                <Icone nome="baixo" tamanho={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

function GavetaVersoes({
  m,
  aoAbrir,
  aoAbrirSistema,
  aoMudar,
}: {
  m: ModeloGrupo
  aoAbrir: (v: VersaoDoModelo) => void
  aoAbrirSistema: () => void
  aoMudar: (r: Retorno) => void
}) {
  const [carga, recarregar] = useCarregar(() => listarVersoesDoModelo(m.id))
  const [enviando, umaVez] = useUmaVez()
  const sistemaPermitido = m.tipo === 'padrao' || m.tipo === 'readequacao'
  const usar = (versao: string | null, mensagem: string) =>
    void umaVez(async () => {
      const r = await usarVersaoDoModelo(m.id, versao)
      aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: mensagem })
      recarregar()
    })
  return (
    <>
      <TituloGaveta titulo="Versões salvas">"Usar" muda na hora as credenciais de quem recebe este modelo. Arquivar só tira da lista; nada se apaga.</TituloGaveta>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(versoes) => (
          <ul className="lista lista-versoes" aria-label="Versões do modelo">
            {sistemaPermitido && (
              <li className="lista-item lista-item-estatico" aria-label="Desenho do sistema">
                <strong>Desenho do sistema</strong>
                <span className="detalhe">o que vem com o sistema</span>
                <span>{m.versao_id === null && <span className="etiqueta etiqueta-ok">Em uso</span>}</span>
                <span className="acoes-linha">
                  <button type="button" className="botao-texto" onClick={aoAbrirSistema}>
                    Abrir
                  </button>
                  {m.versao_id !== null && (
                    <button type="button" className="botao-texto" disabled={enviando} onClick={() => usar(null, 'Agora o modelo usa o desenho do sistema.')}>
                      Usar
                    </button>
                  )}
                </span>
              </li>
            )}
            {versoes.map((v) => (
              <li key={v.id} className="lista-item lista-item-estatico" aria-label={v.descricao}>
                <strong>{v.descricao}</strong>
                <span className="detalhe">
                  {formatarDataHora(v.criado_em)}
                  {v.criado_por_nome ? ` · ${v.criado_por_nome}` : ''}
                </span>
                <span>{v.em_uso && <span className="etiqueta etiqueta-ok">Em uso</span>}</span>
                <span className="acoes-linha">
                  <button type="button" className="botao-texto" onClick={() => aoAbrir(v)}>
                    Abrir
                  </button>
                  {!v.em_uso && (
                    <button type="button" className="botao-texto" disabled={enviando} onClick={() => usar(v.id, `Agora o modelo usa a versão "${v.descricao}".`)}>
                      Usar
                    </button>
                  )}
                  {!v.em_uso && (
                    <BotaoArquivar
                      rotulo={`Arquivar a versão ${v.descricao}`}
                      aoConfirmar={() =>
                        void umaVez(async () => {
                          const r = await arquivarModelo(v.id)
                          aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: `Versão "${v.descricao}" arquivada (continua guardada).` })
                          recarregar()
                        })
                      }
                    />
                  )}
                </span>
              </li>
            ))}
            {versoes.length === 0 && !sistemaPermitido && <li className="vazio">Nenhuma versão salva ainda.</li>}
          </ul>
        )}
      </MostrarCarga>
    </>
  )
}

// ---------------------------------------------------------------------
// À direita: o item escolhido e o cartão
// ---------------------------------------------------------------------

function CampoNumero({
  rotulo,
  valor,
  aoMudar,
  min,
  max,
  passo = 0.1,
}: {
  rotulo: string
  valor: number
  aoMudar: (n: number) => void
  min: number
  max: number
  passo?: number
}) {
  const [texto, setTexto] = useState(String(valor))
  const [anterior, setAnterior] = useState(valor)
  if (valor !== anterior) {
    setAnterior(valor)
    setTexto(String(valor))
  }
  return (
    <label className="campo-numero">
      {rotulo}
      <input
        type="number"
        inputMode="decimal"
        step={passo}
        min={min}
        max={max}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          const n = e.target.valueAsNumber
          // enquanto digita, só usa o número se já estiver dentro dos limites ("1" a caminho de "12" não vira 3)
          if (Number.isFinite(n) && n >= min && n <= max) aoMudar(Math.round(n * 100) / 100)
        }}
        onBlur={(e) => {
          const n = e.target.valueAsNumber
          const certo = Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : valor
          if (certo !== valor) aoMudar(certo)
          setTexto(String(certo))
        }}
      />
    </label>
  )
}

function CampoCor({ rotulo, valor, aoMudar, cores }: { rotulo: string; valor: string; aoMudar: (cor: string) => void; cores?: string[] }) {
  return (
    <div className="campo-cor-com-amostras">
      <span className="rotulo-pequeno">{rotulo}</span>
      <div className="amostras-linha">
        {cores && <Amostras cores={cores.slice(0, 6)} atual={valor} rotulo={`${rotulo}: cores do modelo`} aoEscolher={aoMudar} />}
        <label className="campo-cor">
          <span className="somente-leitor">{rotulo}</span>
          <input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)} />
        </label>
      </div>
    </div>
  )
}

function Marcar({ rotulo, valor, aoMudar }: { rotulo: string; valor: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label className="caixa-marcar">
      <input type="checkbox" checked={valor} onChange={(e) => aoMudar(e.target.checked)} />
      {rotulo}
    </label>
  )
}

type Alterar = (mudanca: Partial<Elemento>, chave?: string) => void

function Propriedades({
  e,
  cartao,
  cores,
  alterar,
  aoDuplicar,
  aoRemover,
  aoSubir,
  aoDescer,
  aoErro,
}: {
  e: Elemento
  cartao: Cartao
  cores: string[]
  alterar: Alterar
  aoDuplicar: () => void
  aoRemover: () => void
  aoSubir: () => void
  aoDescer: () => void
  aoErro: (erro: string) => void
}) {
  const l = limitesDo(cartao)
  const ehDado = e.tipo === 'texto' && /\{[a-z_]+\}/.test(e.texto)
  return (
    <section className="editor-item-escolhido-painel" aria-label="Item escolhido">
      <div className="titulo-com-acao">
        <h2>{nomeDoElemento(e)}</h2>
        {ehDado && <span className="etiqueta">dado do ministro</span>}
      </div>
      {e.tipo === 'texto' && <PropriedadesTexto e={e} alterar={alterar} cores={cores} />}
      {e.tipo === 'faixa' && <PropriedadesFaixa e={e} cartao={cartao} alterar={alterar} cores={cores} />}
      <div className="editor-grade">
        <CampoNumero rotulo="X (mm)" valor={e.x} min={l.x[0]} max={l.x[1]} aoMudar={(x) => alterar({ x }, 'x')} />
        <CampoNumero rotulo="Y (mm)" valor={e.y} min={l.y[0]} max={l.y[1]} aoMudar={(y) => alterar({ y }, 'y')} />
        <CampoNumero rotulo="Largura (mm)" valor={e.w} min={l.w[0]} max={l.w[1]} aoMudar={(w) => alterar({ w }, 'w')} />
        <CampoNumero rotulo="Altura (mm)" valor={e.h} min={l.h[0]} max={l.h[1]} aoMudar={(h) => alterar({ h }, 'h')} />
        <CampoNumero rotulo="Girar (graus)" valor={e.rotacao} min={-180} max={180} passo={1} aoMudar={(rotacao) => alterar({ rotacao }, 'rotacao')} />
        {(e.tipo === 'texto' || e.tipo === 'forma' || e.tipo === 'imagem') && (
          <CampoNumero
            rotulo="Transparência (%)"
            valor={Math.round(e.opacidade * 100)}
            min={0}
            max={100}
            passo={5}
            aoMudar={(n) => alterar({ opacidade: n / 100 }, 'opacidade')}
          />
        )}
      </div>
      {e.tipo === 'forma' && <PropriedadesForma e={e} alterar={alterar} cores={cores} />}
      {e.tipo === 'foto' && (
        <>
          <div className="editor-grade">
            <CampoNumero rotulo="Cantos arredondados (mm)" valor={e.raio} min={0} max={30} aoMudar={(raio) => alterar({ raio }, 'raio')} />
            <CampoNumero rotulo="Borda (mm)" valor={e.borda} min={0} max={5} aoMudar={(borda) => alterar({ borda }, 'borda')} />
          </div>
          <CampoCor rotulo="Cor da borda" valor={e.corBorda} cores={cores} aoMudar={(corBorda) => alterar({ corBorda }, 'corBorda')} />
          <button type="button" className="botao-texto" onClick={() => alterar({ h: Math.round(((e.w * 4) / 3) * 100) / 100 })}>
            Deixar 3×4 (a altura acompanha a largura)
          </button>
        </>
      )}
      {e.tipo === 'qr' && (
        <>
          <CampoCor rotulo="Cor" valor={e.cor} aoMudar={(cor) => alterar({ cor }, 'cor')} />
          <p className="detalhe">Use cor escura no fundo claro e pelo menos 15 mm, para a câmera ler bem.</p>
          <button type="button" className="botao-texto" onClick={() => alterar({ h: e.w })}>
            Deixar quadrado
          </button>
        </>
      )}
      {e.tipo === 'imagem' && <PropriedadesImagem e={e} alterar={alterar} aoErro={aoErro} />}
      <div className="acoes editor-acoes-item">
        <button type="button" className="botao botao-secundario" onClick={aoSubir}>
          Trazer para cima
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoDescer}>
          Levar para baixo
        </button>
        <button type="button" className="botao botao-secundario" onClick={aoDuplicar}>
          Duplicar
        </button>
        <button type="button" className="botao botao-perigo" onClick={aoRemover}>
          Tirar da credencial
        </button>
      </div>
    </section>
  )
}

function PropriedadesTexto({ e, alterar, cores }: { e: ElementoTexto; alterar: Alterar; cores: string[] }) {
  const campo = useRef<HTMLTextAreaElement>(null)
  function inserir(chave: string) {
    if (!chave) return
    const no = campo.current
    const ini = no?.selectionStart ?? e.texto.length
    const fim = no?.selectionEnd ?? e.texto.length
    alterar({ texto: `${e.texto.slice(0, ini)}{${chave}}${e.texto.slice(fim)}` })
  }
  return (
    <>
      <label className="largura-total">
        Texto (os dados vão entre chaves, ex.: {'{nome}'})
        <textarea ref={campo} rows={2} maxLength={400} value={e.texto} onChange={(ev) => alterar({ texto: ev.target.value }, 'texto')} />
      </label>
      <label>
        Inserir dado do ministro
        <select value="" onChange={(ev) => inserir(ev.target.value)}>
          <option value="">Escolha…</option>
          {CAMPOS.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label>
        Letra
        <select value={e.fonte} onChange={(ev) => alterar({ fonte: ev.target.value as ElementoTexto['fonte'] })}>
          <option value="jakarta">Plus Jakarta Sans (títulos)</option>
          <option value="inter">Inter</option>
          <option value="sans">Sem serifa (do aparelho)</option>
          <option value="serif">Com serifa (clássica)</option>
        </select>
      </label>
      <div className="editor-grade">
        <CampoNumero rotulo="Tamanho (pt)" valor={e.tamanho} min={3} max={40} passo={0.5} aoMudar={(tamanho) => alterar({ tamanho }, 'tamanho')} />
        <label>
          Peso
          <select value={e.peso} onChange={(ev) => alterar({ peso: Number(ev.target.value) as ElementoTexto['peso'] })}>
            <option value={400}>Normal</option>
            <option value={600}>Seminegrito</option>
            <option value={700}>Negrito</option>
            <option value={800}>Extranegrito</option>
          </select>
        </label>
      </div>
      <CampoCor rotulo="Cor" valor={e.cor} cores={cores} aoMudar={(cor) => alterar({ cor }, 'cor')} />
      <div className="segmentado" role="group" aria-label="Alinhar">
        {(['esquerda', 'centro', 'direita'] as const).map((a) => (
          <button key={a} type="button" aria-pressed={e.alinhamento === a} onClick={() => alterar({ alinhamento: a })}>
            {a === 'esquerda' ? 'Esquerda' : a === 'centro' ? 'Centro' : 'Direita'}
          </button>
        ))}
      </div>
      <div className="editor-marcas">
        <span className="linha-encolher">
          <Marcar
            rotulo={`Texto comprido: diminuir a letra até ${fmt(e.minimo ?? Math.round(e.tamanho * 0.45 * 10) / 10)} pt`}
            valor={e.encolher}
            aoMudar={(encolher) => alterar({ encolher })}
          />
        </span>
        {e.encolher && (
          <CampoNumero
            rotulo="Menor letra (pt)"
            valor={e.minimo ?? Math.round(e.tamanho * 0.45 * 10) / 10}
            min={2}
            max={40}
            passo={0.5}
            aoMudar={(minimo) => alterar({ minimo }, 'minimo')}
          />
        )}
        <Marcar rotulo="Tudo em maiúsculas" valor={e.maiusculas} aoMudar={(maiusculas) => alterar({ maiusculas })} />
        <Marcar rotulo="Itálico" valor={e.italico} aoMudar={(italico) => alterar({ italico })} />
        <Marcar rotulo="Várias linhas" valor={e.quebrar} aoMudar={(quebrar) => alterar({ quebrar })} />
      </div>
      <CampoNumero rotulo="Espaço entre letras" valor={e.espacamento} min={-0.1} max={0.6} passo={0.01} aoMudar={(espacamento) => alterar({ espacamento }, 'espacamento')} />
    </>
  )
}

const POSICOES: { chave: PosicaoFaixa; nome: string }[] = [
  { chave: 'rodape', nome: 'Rodapé' },
  { chave: 'topo', nome: 'Topo' },
  { chave: 'esquerda', nome: 'Esquerda' },
  { chave: 'direita', nome: 'Direita' },
]

/** A faixa de aviso: o texto, as cores e onde ela vai (rodada 12: "no editor se escolhe onde vai a faixa"). */
function PropriedadesFaixa({ e, cartao, alterar, cores }: { e: Extract<Elemento, { tipo: 'faixa' }>; cartao: Cartao; alterar: Alterar; cores: string[] }) {
  const posicao = posicaoDaFaixa(e, cartao)
  const espessura = posicao === 'esquerda' || posicao === 'direita' ? e.w : e.h
  return (
    <>
      <label className="largura-total">
        Texto da faixa
        <input maxLength={120} value={e.texto} onChange={(ev) => alterar({ texto: ev.target.value }, 'texto')} />
      </label>
      <div className="segmentado" role="group" aria-label="Onde vai a faixa">
        {POSICOES.map((p) => (
          <button key={p.chave} type="button" aria-pressed={posicao === p.chave} onClick={() => alterar(posicionarFaixa(e, p.chave, cartao, Math.min(espessura, 12)))}>
            {p.nome}
          </button>
        ))}
      </div>
      <div className="editor-grade">
        <CampoNumero rotulo="Tamanho da letra (pt)" valor={e.tamanho} min={3} max={20} passo={0.2} aoMudar={(tamanho) => alterar({ tamanho }, 'tamanho')} />
      </div>
      <CampoCor rotulo="Listras: cor 1" valor={e.cor} cores={cores} aoMudar={(cor) => alterar({ cor }, 'cor')} />
      <CampoCor rotulo="Listras: cor 2" valor={e.cor2} cores={cores} aoMudar={(cor2) => alterar({ cor2 }, 'cor2')} />
      <CampoCor rotulo="Cor do texto" valor={e.corTexto} cores={cores} aoMudar={(corTexto) => alterar({ corTexto }, 'corTexto')} />
      <p className="detalhe">A faixa também aparece na conferência pelo QR Code. Nunca use a frase "não representa o COMEP".</p>
    </>
  )
}

function PropriedadesForma({ e, alterar, cores }: { e: Extract<Elemento, { tipo: 'forma' }>; alterar: Alterar; cores: string[] }) {
  return (
    <>
      <label>
        Forma
        <select value={e.forma} onChange={(ev) => alterar({ forma: ev.target.value as typeof e.forma })}>
          <option value="retangulo">Retângulo (ou linha)</option>
          <option value="elipse">Círculo ou oval</option>
        </select>
      </label>
      <CampoCor rotulo="Cor" valor={e.cor} cores={cores} aoMudar={(cor) => alterar({ cor }, 'cor')} />
      <Marcar rotulo="Degradê (duas cores)" valor={e.cor2 !== null} aoMudar={(sim) => alterar({ cor2: sim ? '#dc2626' : null })} />
      {e.cor2 !== null && <CampoCor rotulo="Segunda cor (degradê)" valor={e.cor2} cores={cores} aoMudar={(cor2) => alterar({ cor2 }, 'cor2')} />}
      <div className="editor-grade">
        {e.cor2 !== null && (
          <CampoNumero rotulo="Direção do degradê (graus)" valor={e.angulo} min={-360} max={360} passo={5} aoMudar={(angulo) => alterar({ angulo }, 'angulo')} />
        )}
        {e.forma === 'retangulo' && <CampoNumero rotulo="Cantos (mm)" valor={e.raio} min={0} max={30} aoMudar={(raio) => alterar({ raio }, 'raio')} />}
        <CampoNumero rotulo="Borda (mm)" valor={e.borda} min={0} max={5} aoMudar={(borda) => alterar({ borda }, 'borda')} />
      </div>
      {e.borda > 0 && <CampoCor rotulo="Cor da borda" valor={e.corBorda} cores={cores} aoMudar={(corBorda) => alterar({ corBorda }, 'corBorda')} />}
    </>
  )
}

function PropriedadesImagem({ e, alterar, aoErro }: { e: Extract<Elemento, { tipo: 'imagem' }>; alterar: Alterar; aoErro: (erro: string) => void }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <>
      <p className="detalhe">{e.arquivo === 'logo' ? 'Mostra o logo do sistema (provisório até chegar o logo oficial).' : 'Mostra uma imagem enviada no editor.'}</p>
      <div className="acoes">
        <label className="botao botao-secundario botao-arquivo">
          {enviando ? 'Enviando…' : 'Trocar a imagem (PNG, JPG ou WebP)'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="somente-leitor"
            disabled={enviando}
            onChange={(ev) => {
              const arquivo = ev.target.files?.[0]
              ev.target.value = ''
              if (!arquivo) return
              void umaVez(async () => {
                const pronto = await prepararImagemModelo(arquivo)
                if ('erro' in pronto) return aoErro(pronto.erro)
                const r = await enviarImagemModelo(pronto.blob, pronto.extensao)
                if (r.erro !== null) aoErro(r.erro)
                else alterar({ arquivo: r.dados })
              })
            }}
          />
        </label>
        {e.arquivo !== 'logo' && (
          <button type="button" className="botao-texto" onClick={() => alterar({ arquivo: 'logo' })}>
            Voltar ao logo do sistema
          </button>
        )}
      </div>
      <div className="editor-grade">
        <label>
          Encaixe
          <select value={e.ajuste} onChange={(ev) => alterar({ ajuste: ev.target.value as typeof e.ajuste })}>
            <option value="conter">Inteira (cabe na caixa)</option>
            <option value="cobrir">Preencher a caixa (corta as sobras)</option>
          </select>
        </label>
        <CampoNumero rotulo="Cantos (mm)" valor={e.raio} min={0} max={30} aoMudar={(raio) => alterar({ raio }, 'raio')} />
        <CampoNumero rotulo="Borda (mm)" valor={e.borda} min={0} max={5} aoMudar={(borda) => alterar({ borda }, 'borda')} />
      </div>
    </>
  )
}

/** O cartão: o tamanho (pronto ou outro), os cantos, a sangria e a área segura. */
function PropriedadesCartao({ cartao, aoMudar }: { cartao: Cartao; aoMudar: (c: Cartao) => void }) {
  const pronto = TAMANHOS.find((t) => Math.abs(t.largura - cartao.largura) < 0.05 && Math.abs(t.altura - cartao.altura) < 0.05)
  const [outro, setOutro] = useState(!pronto)
  return (
    <section aria-label="O cartão">
      <h3 className="gaveta-subtitulo">Tamanho do cartão</h3>
      <div className="tamanhos" role="radiogroup" aria-label="Tamanho do cartão">
        {TAMANHOS.map((t) => (
          <label key={t.chave} className={!outro && pronto?.chave === t.chave ? 'tamanho escolhido' : 'tamanho'}>
            <input
              type="radio"
              name="tamanho"
              checked={!outro && pronto?.chave === t.chave}
              onChange={() => {
                setOutro(false)
                aoMudar({ ...cartao, largura: t.largura, altura: t.altura })
              }}
            />
            <span>
              <strong>{t.nome}</strong>
              <span>{t.detalhe}</span>
            </span>
          </label>
        ))}
        <label className={outro ? 'tamanho escolhido' : 'tamanho'}>
          <input type="radio" name="tamanho" checked={outro} onChange={() => setOutro(true)} />
          <span>
            <strong>Outro tamanho</strong>
            <span>largura e altura em mm</span>
          </span>
        </label>
      </div>
      {outro && (
        <div className="editor-grade">
          <CampoNumero rotulo="Largura (mm)" valor={cartao.largura} min={30} max={150} aoMudar={(largura) => aoMudar({ ...cartao, largura })} />
          <CampoNumero rotulo="Altura (mm)" valor={cartao.altura} min={30} max={150} aoMudar={(altura) => aoMudar({ ...cartao, altura })} />
        </div>
      )}
      <h3 className="gaveta-subtitulo">Cantos</h3>
      <div className="segmentado" role="group" aria-label="Cantos">
        <button type="button" aria-pressed={cartao.cantos === 0} onClick={() => aoMudar({ ...cartao, cantos: 0 })}>
          Retos (guilhotina)
        </button>
        <button type="button" aria-pressed={cartao.cantos > 0} onClick={() => aoMudar({ ...cartao, cantos: 3 })}>
          Redondos 3 mm
        </button>
      </div>
      <div className="editor-grade">
        <CampoNumero rotulo="Sangria (mm)" valor={cartao.sangria} min={0} max={5} passo={0.5} aoMudar={(sangria) => aoMudar({ ...cartao, sangria })} />
        <CampoNumero rotulo="Área segura (mm)" valor={cartao.seguranca} min={0} max={10} passo={0.5} aoMudar={(seguranca) => aoMudar({ ...cartao, seguranca })} />
      </div>
      <p className="detalhe">
        Mudou o tamanho? Os itens se ajustam na mesma proporção; confira antes de salvar. Cantos redondos pedem um cortador de
        canto depois da guilhotina.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------
// Salvar e testar a impressão
// ---------------------------------------------------------------------

function Janela({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [aoFechar])
  return (
    <div className="janela-fundo" onClick={aoFechar}>
      <div className="janela-editor" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <h2>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

function Salvar({
  m,
  modelo,
  avisos,
  aoFechar,
  aoSalvar,
}: {
  m: ModeloGrupo
  modelo: ModeloCredencial
  avisos: string[]
  aoFechar: () => void
  aoSalvar: (usar: boolean, gravado: ModeloCredencial) => void
}) {
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  function salvar(usar: boolean) {
    const gravado = normalizarModelo(modelo, m.tipo === 'readequacao' ? MODELO_READEQUACAO : MODELO_PADRAO)
    void umaVez(async () => {
      const r = await salvarVersaoDoModelo(m.id, gravado, descricao || 'Mudanças no desenho', usar)
      if (r.erro !== null) return setErro(r.erro)
      // o rascunho (ninguém recebe ainda) fica com o desenho novo, mesmo sem "usar"
      if (!usar && !m.em_uso && (m.tipo === 'grupo' || m.tipo === 'exclusivo')) {
        const atual = await usarVersaoDoModelo(m.id, r.dados)
        if (atual.erro !== null) return setErro(atual.erro)
      }
      aoSalvar(usar, gravado)
    })
  }
  return (
    <Janela titulo={`Salvar o modelo "${m.nome}"`} aoFechar={aoFechar}>
      <p className="detalhe">
        Cada vez que se salva nasce uma versão nova (dá para voltar a qualquer uma em Versões).{' '}
        {m.tipo === 'grupo' || m.tipo === 'exclusivo'
          ? m.em_uso
            ? `"Usar" muda na hora a credencial de ${m.pessoas} ${m.pessoas === 1 ? 'pessoa' : 'pessoas'}.`
            : 'O modelo ainda é rascunho: "Salvar e usar" põe em uso para quem recebe.'
          : `"Usar" muda na hora a credencial de ${m.pessoas} ${m.pessoas === 1 ? 'pessoa' : 'pessoas'}.`}
      </p>
      {avisos.length > 0 && (
        <Aviso titulo="Confira antes de salvar">
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Aviso>
      )}
      <form
        aria-label="Salvar o modelo"
        onSubmit={(e) => {
          e.preventDefault()
          salvar(true)
        }}
      >
        <label className="largura-total">
          O que mudou?
          <input maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: logo oficial no cabeçalho" autoFocus />
        </label>
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar e usar
          </button>
          <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => salvar(false)}>
            Salvar sem usar ainda
          </button>
          <button type="button" className="botao-texto" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </Janela>
  )
}

function TestarImpressao({ modelo, previa, aoFechar }: { modelo: ModeloCredencial; previa: Previa; aoFechar: () => void }) {
  const cartao = cartaoDe(modelo)
  return (
    <Janela titulo="Testar a impressão" aoFechar={aoFechar}>
      <p className="detalhe">
        Assim sai na folha, no tamanho real ({fmt(cartao.largura)} × {fmt(cartao.altura)} mm cada lado): a frente e o verso
        juntos, para dobrar ao meio. Para imprimir de verdade, use Credenciais › Imprimir.
      </p>
      <div className="previa-impressao">
        <div className="par-cartoes" style={{ width: `${cartao.largura * 2}mm` }}>
          <FaceCredencial lado="frente" modelo={modelo} {...previa.props} />
          <FaceCredencial lado="verso" modelo={modelo} {...previa.props} />
        </div>
      </div>
      <div className="acoes">
        <button type="button" className="botao" onClick={aoFechar} autoFocus>
          Fechar
        </button>
      </div>
    </Janela>
  )
}
