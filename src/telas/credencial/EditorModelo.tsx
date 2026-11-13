// Fase 3.4 — Editor do modelo da credencial (secretaria e presidência).
// Mexe no desenho de cada lado: onde fica cada coisa, tamanhos, cores, formas, fotos, imagens e textos.
// Cada vez que se salva nasce uma versão nova; dá para voltar a qualquer versão ou ao modelo padrão.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { Aviso, BotaoArquivar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { FaceCredencial } from '../../componentes/CartaoCredencial'
import {
  arquivarModelo,
  dadosCredenciais,
  enviarImagemModelo,
  listarPendencias,
  listarVersoesModelo,
  salvarModelo,
  urlValidacao,
  usarModelo,
  type DadosCredencial,
  type VersaoModelo,
} from '../../dados/credencial'
import { linkDoArquivo } from '../../dados/pedidos'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataHora } from '../../utilitarios/formatos'
import { prepararImagemModelo } from '../../utilitarios/imagens'
import {
  ALTURA_MM,
  CAMPOS,
  conferirModelo,
  DADOS_EXEMPLO,
  ITENS_NOVOS,
  LARGURA_MM,
  MAXIMO_ELEMENTOS,
  MODELO_PADRAO,
  nomeDoElemento,
  normalizarModelo,
  novoElemento,
  valoresDaCredencial,
  type Elemento,
  type ItemNovo,
  type Lado,
  type ModeloCredencial,
} from '../../utilitarios/modeloCredencial'

type Retorno = { sucesso?: string; erro?: string }

/** Foto FICTÍCIA (silhueta) para a prévia com os dados de exemplo. */
const FOTO_EXEMPLO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40"><rect width="30" height="40" fill="#cbd5e1"/><circle cx="15" cy="15" r="7" fill="#94a3b8"/><path d="M2 40c0-9 6-14 13-14s13 5 13 14z" fill="#94a3b8"/></svg>',
)}`

const pct = (valor: number, total: number) => `${(valor * 100) / total}%`
const arredondar = (valor: number, passo: number) => Math.round(Math.round(valor / passo) * passo * 100) / 100

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

// ---------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------

export function EditorModelo() {
  const [carga, recarregar] = useCarregar(listarVersoesModelo)
  return (
    <>
      <p className="nao-imprimir">
        <Link to="/credenciais">← Credenciais</Link>
      </p>
      <h1>Modelo da credencial</h1>
      <p className="detalhe">
        O desenho de todas as credenciais (digital e impressa). Clique num item para escolher e arraste para mover; o
        quadradinho do canto muda o tamanho. As setas do teclado movem 0,5 mm (com Shift, 2 mm). Cada vez que se salva,
        nasce uma versão nova; dá para voltar a qualquer uma.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(versoes) => <Editor versoes={versoes} aoMudarVersoes={recarregar} />}
      </MostrarCarga>
    </>
  )
}

function Editor({ versoes, aoMudarVersoes }: { versoes: VersaoModelo[]; aoMudarVersoes: () => void }) {
  const emUso = versoes.find((v) => v.em_uso) ?? null
  // O modelo de partida é o que está em uso quando a tela abre
  const [inicial] = useState(() => normalizarModelo(emUso?.modelo ?? null))
  const historico = useHistorico(inicial)
  const { modelo, mudar } = historico
  const [salvo, setSalvo] = useState(inicial)
  const [lado, setLado] = useState<Lado>('frente')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [tamanho, setTamanho] = useState<'tela' | 'real'>('tela')
  const [retorno, setRetorno] = useState<Retorno>({})
  const previa = usePrevia()

  const face = modelo[lado]
  const escolhido = face.elementos.find((e) => e.id === selecionado) ?? null
  const mudou = JSON.stringify(modelo) !== JSON.stringify(salvo)

  // Avisa antes de sair da página com mudanças não salvas
  useEffect(() => {
    if (!mudou) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [mudou])

  // Ctrl+Z / Ctrl+Y fora dos campos de texto (nos campos, vale o desfazer do próprio campo)
  useEffect(() => {
    const teclas = (e: globalThis.KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (alvo.closest('input, textarea, select')) return
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

  const mudarFace = (fn: (elementos: Elemento[]) => Elemento[], chave?: string) =>
    mudar((m) => ({ ...m, [lado]: { ...m[lado], elementos: fn(m[lado].elementos) } }), chave)

  const alterar = (id: string, mudanca: Partial<Elemento>, chave?: string) =>
    mudarFace((lista) => lista.map((e) => (e.id === id ? ({ ...e, ...mudanca } as Elemento) : e)), chave && `${lado}:${id}:${chave}`)

  function adicionar(tipo: ItemNovo) {
    const id = `item-${Date.now().toString(36)}`
    mudarFace((lista) => [...lista, novoElemento(tipo, id)])
    setSelecionado(id)
  }

  function duplicar(e: Elemento) {
    const id = `item-${Date.now().toString(36)}`
    mudarFace((lista) => {
      const i = lista.findIndex((x) => x.id === e.id)
      return [...lista.slice(0, i + 1), { ...e, id, x: e.x + 2, y: e.y + 2 }, ...lista.slice(i + 1)]
    })
    setSelecionado(id)
  }

  function remover(e: Elemento) {
    mudarFace((lista) => lista.filter((x) => x.id !== e.id))
    setSelecionado(null)
  }

  /** Muda a ordem (o último da lista fica por cima de todos). */
  function camada(e: Elemento, direcao: 1 | -1) {
    mudarFace((lista) => {
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

  const avisos = useMemo(() => conferirModelo(modelo), [modelo])

  return (
    <>
      <div className="editor-barra" role="toolbar" aria-label="Opções do editor">
        <div className="abas" role="tablist" aria-label="Lado da credencial">
          {(['frente', 'verso'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lado === l}
              className={lado === l ? 'aba ativa' : 'aba'}
              onClick={() => {
                setLado(l)
                setSelecionado(null)
              }}
            >
              {l === 'frente' ? 'Frente' : 'Verso'}
            </button>
          ))}
        </div>
        <label className="campo-medio">
          Prévia com
          <select value={previa.escolha} onChange={(e) => previa.escolher(e.target.value)}>
            <option value="exemplo">Dados de exemplo (nome bem comprido)</option>
            {previa.associados.map((a) => (
              <option key={a.pessoa_id} value={a.pessoa_id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-curto">
          Tamanho
          <select value={tamanho} onChange={(e) => setTamanho(e.target.value as typeof tamanho)}>
            <option value="tela">Grande</option>
            <option value="real">Real (85,6 mm)</option>
          </select>
        </label>
        <span className="editor-desfazer">
          <button type="button" className="botao botao-secundario" disabled={!historico.podeDesfazer} onClick={historico.desfazer}>
            Desfazer
          </button>
          <button type="button" className="botao botao-secundario" disabled={!historico.podeRefazer} onClick={historico.refazer}>
            Refazer
          </button>
        </span>
      </div>

      <div className="editor">
        <div className="editor-coluna-cartao">
          <Palco
            lado={lado}
            modelo={modelo}
            previa={previa}
            real={tamanho === 'real'}
            selecionado={selecionado}
            aoSelecionar={setSelecionado}
            historico={historico}
          />
          <section className="painel" aria-labelledby="titulo-previa-impressao">
            <h2 id="titulo-previa-impressao">Como sai na impressão (frente e verso juntos, tamanho real)</h2>
            <div className="previa-impressao">
              <div className="par-cartoes">
                <FaceCredencial lado="frente" modelo={modelo} {...previa.props} />
                <FaceCredencial lado="verso" modelo={modelo} {...previa.props} />
              </div>
            </div>
          </section>
        </div>

        <div className="editor-coluna-painel">
          <section className="painel" aria-labelledby="titulo-adicionar">
            <h2 id="titulo-adicionar">Adicionar na {lado === 'frente' ? 'frente' : 'parte de trás (verso)'}</h2>
            <div className="editor-adicionar">
              {ITENS_NOVOS.map((item) => (
                <button
                  key={item.tipo}
                  type="button"
                  className="botao botao-secundario"
                  disabled={face.elementos.length >= MAXIMO_ELEMENTOS}
                  onClick={() => adicionar(item.tipo)}
                >
                  + {item.rotulo}
                </button>
              ))}
            </div>
            <label className="editor-fundo">
              Cor do fundo deste lado
              <input
                type="color"
                value={face.fundo}
                onChange={(e) => mudar((m) => ({ ...m, [lado]: { ...m[lado], fundo: e.target.value } }), `${lado}:fundo`)}
              />
            </label>
          </section>

          <section className="painel" aria-labelledby="titulo-itens">
            <h2 id="titulo-itens">Itens deste lado</h2>
            <p className="detalhe">O de cima da lista aparece por cima dos outros.</p>
            <ul className="editor-itens" aria-label="Itens deste lado">
              {[...face.elementos].reverse().map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={e.id === selecionado ? 'editor-item editor-item-escolhido' : 'editor-item'}
                    aria-pressed={e.id === selecionado}
                    onClick={() => setSelecionado(e.id)}
                  >
                    {nomeDoElemento(e)}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {escolhido && (
            <Propriedades
              key={`${lado}:${escolhido.id}`}
              e={escolhido}
              alterar={(mudanca, chave) => alterar(escolhido.id, mudanca, chave)}
              aoDuplicar={() => duplicar(escolhido)}
              aoRemover={() => remover(escolhido)}
              aoSubir={() => camada(escolhido, 1)}
              aoDescer={() => camada(escolhido, -1)}
              aoErro={(erro) => setRetorno({ erro })}
            />
          )}
        </div>
      </div>

      <Salvar
        modelo={modelo}
        mudou={mudou}
        avisos={avisos}
        aoSalvar={(usar) => {
          setSalvo(modelo)
          setRetorno({ sucesso: usar ? 'Modelo salvo e em uso em todas as credenciais.' : 'Modelo salvo (sem usar ainda).' })
          aoMudarVersoes()
        }}
        aoErro={(erro) => setRetorno({ erro })}
        aoDescartar={() => abrir(salvo, 'Mudanças descartadas. Dá para desfazer.')}
        aoPadrao={() => abrir(MODELO_PADRAO, 'Modelo padrão do sistema aberto no editor. Salve para usar.')}
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

      <Versoes
        versoes={versoes}
        aoAbrir={(v) => abrir(normalizarModelo(v.modelo), `Versão "${v.descricao}" aberta no editor.`)}
        aoUsar={(mensagem) => {
          setRetorno({ sucesso: mensagem })
          aoMudarVersoes()
        }}
        aoErro={(erro) => setRetorno({ erro })}
      />
    </>
  )
}

// ---------------------------------------------------------------------
// Prévia: dados de exemplo ou de um associado de verdade
// ---------------------------------------------------------------------

function usePrevia() {
  const [lista] = useCarregar(listarPendencias)
  const [escolha, setEscolha] = useState('exemplo')
  const [dados, setDados] = useState<{ c: DadosCredencial; texto: string; foto: string | null }>({
    c: DADOS_EXEMPLO,
    texto: 'Texto do verso, como em Configurações → Credencial: credencial pessoal e intransferível de associado do COMEP.',
    foto: FOTO_EXEMPLO,
  })
  const [textoVerso, setTextoVerso] = useState<string | null>(null)

  // O texto do verso de verdade (Configurações), também para a prévia de exemplo
  useEffect(() => {
    if (lista.situacao !== 'ok' || lista.dados.length === 0 || textoVerso !== null) return
    void dadosCredenciais([lista.dados[0].pessoa_id]).then((r) => {
      if (r.erro === null) setTextoVerso(r.dados.texto_verso)
    })
  }, [lista, textoVerso])

  async function escolher(valor: string) {
    setEscolha(valor)
    if (valor === 'exemplo') {
      setDados({ c: DADOS_EXEMPLO, texto: textoVerso ?? dados.texto, foto: FOTO_EXEMPLO })
      return
    }
    const r = await dadosCredenciais([valor])
    const c = r.erro === null ? r.dados.credenciais[0] : undefined
    if (!c || r.erro !== null) return
    const foto = c.foto_caminho ? await linkDoArquivo(c.foto_caminho) : null
    setDados({ c, texto: r.dados.texto_verso, foto })
  }

  const texto = escolha === 'exemplo' ? (textoVerso ?? dados.texto) : dados.texto
  const valores = useMemo(() => valoresDaCredencial(dados.c, texto), [dados.c, texto])
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
// Palco: o cartão com a camada de edição por cima (escolher, arrastar, mudar o tamanho)
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

function Palco({
  lado,
  modelo,
  previa,
  real,
  selecionado,
  aoSelecionar,
  historico,
}: {
  lado: Lado
  modelo: ModeloCredencial
  previa: Previa
  real: boolean
  selecionado: string | null
  aoSelecionar: (id: string | null) => void
  historico: ReturnType<typeof useHistorico>
}) {
  const camada = useRef<HTMLDivElement>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const face = modelo[lado]

  const trocarItem = (id: string, mudanca: Partial<Elemento>) =>
    historico.trocar((m) => ({
      ...m,
      [lado]: { ...m[lado], elementos: m[lado].elementos.map((e) => (e.id === id ? ({ ...e, ...mudanca } as Elemento) : e)) },
    }))

  function iniciar(ev: PointerEvent<HTMLElement>, e: Elemento, modo: Arrasto['modo']) {
    if (ev.button !== 0) return
    ev.stopPropagation()
    ev.preventDefault()
    aoSelecionar(e.id)
    camada.current?.focus({ preventScroll: true })
    const largura = camada.current?.getBoundingClientRect().width ?? 1
    arrasto.current = {
      id: e.id,
      modo,
      x0: ev.clientX,
      y0: ev.clientY,
      inicio: { x: e.x, y: e.y, w: e.w, h: e.h },
      mmPorPx: LARGURA_MM / largura,
      moveu: false,
    }
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
            x.id === e.id ? { ...x, x: arredondar(x.x + d[0] * passo, 0.01), y: arredondar(x.y + d[1] * passo, 0.01) } : x,
          ),
        },
      }),
      `${lado}:${e.id}:teclas`,
    )
  }

  return (
    <div className={real ? 'editor-palco editor-palco-real' : 'editor-palco'}>
      <FaceCredencial lado={lado} modelo={modelo} {...previa.props} />
      <div
        ref={camada}
        className="editor-camada"
        tabIndex={0}
        role="application"
        aria-label={`Edição da ${lado}: clique num item para escolher, arraste para mover; setas movem o item escolhido`}
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
            style={{ left: pct(e.x, LARGURA_MM), top: pct(e.y, ALTURA_MM), width: pct(e.w, LARGURA_MM), height: pct(e.h, ALTURA_MM) }}
            onPointerDown={(ev) => iniciar(ev, e, 'mover')}
          >
            {e.id === selecionado && (
              <span className="editor-alca" title="Arraste para mudar o tamanho" onPointerDown={(ev) => iniciar(ev, e, 'tamanho')} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Propriedades do item escolhido
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
          if (Number.isFinite(n)) aoMudar(Math.min(max, Math.max(min, Math.round(n * 100) / 100)))
        }}
      />
    </label>
  )
}

function CampoCor({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (cor: string) => void }) {
  return (
    <label className="campo-cor">
      {rotulo}
      <input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)} />
    </label>
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
  alterar,
  aoDuplicar,
  aoRemover,
  aoSubir,
  aoDescer,
  aoErro,
}: {
  e: Elemento
  alterar: Alterar
  aoDuplicar: () => void
  aoRemover: () => void
  aoSubir: () => void
  aoDescer: () => void
  aoErro: (erro: string) => void
}) {
  return (
    <section className="painel" aria-label="Item escolhido">
      <h2>{nomeDoElemento(e)}</h2>
      <div className="editor-grade">
        <CampoNumero rotulo="Da esquerda (mm)" valor={e.x} min={-20} max={LARGURA_MM} aoMudar={(x) => alterar({ x }, 'x')} />
        <CampoNumero rotulo="Do topo (mm)" valor={e.y} min={-20} max={ALTURA_MM} aoMudar={(y) => alterar({ y }, 'y')} />
        <CampoNumero rotulo="Largura (mm)" valor={e.w} min={0.2} max={120} aoMudar={(w) => alterar({ w }, 'w')} />
        <CampoNumero rotulo="Altura (mm)" valor={e.h} min={0.2} max={80} aoMudar={(h) => alterar({ h }, 'h')} />
      </div>
      {e.tipo === 'texto' && <PropriedadesTexto e={e} alterar={alterar} />}
      {e.tipo === 'forma' && <PropriedadesForma e={e} alterar={alterar} />}
      {e.tipo === 'foto' && (
        <>
          <div className="editor-grade">
            <CampoNumero rotulo="Cantos arredondados (mm)" valor={e.raio} min={0} max={30} aoMudar={(raio) => alterar({ raio }, 'raio')} />
            <CampoNumero rotulo="Borda (mm)" valor={e.borda} min={0} max={5} aoMudar={(borda) => alterar({ borda }, 'borda')} />
            <CampoCor rotulo="Cor da borda" valor={e.corBorda} aoMudar={(corBorda) => alterar({ corBorda }, 'corBorda')} />
          </div>
          <button type="button" className="botao-texto" onClick={() => alterar({ h: Math.round(((e.w * 4) / 3) * 100) / 100 })}>
            Deixar 3×4 (a altura acompanha a largura)
          </button>
        </>
      )}
      {e.tipo === 'qr' && (
        <>
          <div className="editor-grade">
            <CampoCor rotulo="Cor" valor={e.cor} aoMudar={(cor) => alterar({ cor }, 'cor')} />
          </div>
          <p className="detalhe">Use cor escura no fundo claro e pelo menos 15 mm, para a câmera ler bem.</p>
          <button type="button" className="botao-texto" onClick={() => alterar({ h: e.w })}>
            Deixar quadrado
          </button>
        </>
      )}
      {e.tipo === 'imagem' && <PropriedadesImagem e={e} alterar={alterar} aoErro={aoErro} />}
      <div className="acoes">
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

function PropriedadesTexto({ e, alterar }: { e: Extract<Elemento, { tipo: 'texto' }>; alterar: Alterar }) {
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
      <label className="campo-medio">
        Inserir dado do associado
        <select value="" onChange={(ev) => inserir(ev.target.value)}>
          <option value="">Escolha…</option>
          {CAMPOS.map((c) => (
            <option key={c.chave} value={c.chave}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </label>
      <div className="editor-grade">
        <CampoNumero rotulo="Tamanho da letra (pt)" valor={e.tamanho} min={3} max={40} passo={0.5} aoMudar={(tamanho) => alterar({ tamanho }, 'tamanho')} />
        <label>
          Espessura
          <select value={e.peso} onChange={(ev) => alterar({ peso: Number(ev.target.value) as typeof e.peso })}>
            <option value={400}>Normal</option>
            <option value={600}>Seminegrito</option>
            <option value={700}>Negrito</option>
            <option value={800}>Extranegrito</option>
          </select>
        </label>
        <CampoCor rotulo="Cor" valor={e.cor} aoMudar={(cor) => alterar({ cor }, 'cor')} />
        <label>
          Alinhamento
          <select value={e.alinhamento} onChange={(ev) => alterar({ alinhamento: ev.target.value as typeof e.alinhamento })}>
            <option value="esquerda">À esquerda</option>
            <option value="centro">No centro</option>
            <option value="direita">À direita</option>
          </select>
        </label>
        <label>
          Letra
          <select value={e.fonte} onChange={(ev) => alterar({ fonte: ev.target.value as typeof e.fonte })}>
            <option value="sans">Sem serifa (moderna)</option>
            <option value="serif">Com serifa (clássica)</option>
          </select>
        </label>
        <CampoNumero
          rotulo="Espaço entre letras"
          valor={e.espacamento}
          min={-0.1}
          max={0.6}
          passo={0.01}
          aoMudar={(espacamento) => alterar({ espacamento }, 'espacamento')}
        />
      </div>
      <div className="editor-marcas">
        <Marcar rotulo="LETRAS MAIÚSCULAS" valor={e.maiusculas} aoMudar={(maiusculas) => alterar({ maiusculas })} />
        <Marcar rotulo="Itálico" valor={e.italico} aoMudar={(italico) => alterar({ italico })} />
        <Marcar rotulo="Várias linhas" valor={e.quebrar} aoMudar={(quebrar) => alterar({ quebrar })} />
      </div>
      <p className="detalhe">
        {e.quebrar
          ? 'Várias linhas: se o texto não couber na altura, a letra diminui.'
          : 'Uma linha só: se o texto não couber na largura (um nome comprido, por exemplo), a letra diminui.'}
      </p>
    </>
  )
}

function PropriedadesForma({ e, alterar }: { e: Extract<Elemento, { tipo: 'forma' }>; alterar: Alterar }) {
  return (
    <>
      <div className="editor-grade">
        <label>
          Forma
          <select value={e.forma} onChange={(ev) => alterar({ forma: ev.target.value as typeof e.forma })}>
            <option value="retangulo">Retângulo (ou linha)</option>
            <option value="elipse">Círculo ou oval</option>
          </select>
        </label>
        <CampoCor rotulo="Cor" valor={e.cor} aoMudar={(cor) => alterar({ cor }, 'cor')} />
        {e.cor2 !== null && <CampoCor rotulo="Segunda cor (degradê)" valor={e.cor2} aoMudar={(cor2) => alterar({ cor2 }, 'cor2')} />}
        {e.cor2 !== null && (
          <CampoNumero rotulo="Direção do degradê (graus)" valor={e.angulo} min={-360} max={360} passo={5} aoMudar={(angulo) => alterar({ angulo }, 'angulo')} />
        )}
        {e.forma === 'retangulo' && (
          <CampoNumero rotulo="Cantos arredondados (mm)" valor={e.raio} min={0} max={30} aoMudar={(raio) => alterar({ raio }, 'raio')} />
        )}
        <CampoNumero rotulo="Borda (mm)" valor={e.borda} min={0} max={5} aoMudar={(borda) => alterar({ borda }, 'borda')} />
        {e.borda > 0 && <CampoCor rotulo="Cor da borda" valor={e.corBorda} aoMudar={(corBorda) => alterar({ corBorda }, 'corBorda')} />}
        <CampoNumero
          rotulo="Opacidade (%)"
          valor={Math.round(e.opacidade * 100)}
          min={0}
          max={100}
          passo={5}
          aoMudar={(n) => alterar({ opacidade: n / 100 }, 'opacidade')}
        />
      </div>
      <div className="editor-marcas">
        <Marcar rotulo="Degradê (duas cores)" valor={e.cor2 !== null} aoMudar={(sim) => alterar({ cor2: sim ? '#dc2626' : null })} />
      </div>
    </>
  )
}

function PropriedadesImagem({
  e,
  alterar,
  aoErro,
}: {
  e: Extract<Elemento, { tipo: 'imagem' }>
  alterar: Alterar
  aoErro: (erro: string) => void
}) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <>
      <p className="detalhe">
        {e.arquivo === 'logo'
          ? 'Mostra o logo do sistema (provisório até chegar o logo oficial).'
          : 'Mostra uma imagem enviada aqui no editor.'}
      </p>
      <div className="acoes">
        <label className="botao botao-secundario botao-arquivo">
          {enviando ? 'Enviando…' : 'Enviar uma imagem (PNG, JPG ou WebP)'}
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
        <CampoNumero rotulo="Cantos arredondados (mm)" valor={e.raio} min={0} max={30} aoMudar={(raio) => alterar({ raio }, 'raio')} />
        <CampoNumero rotulo="Borda (mm)" valor={e.borda} min={0} max={5} aoMudar={(borda) => alterar({ borda }, 'borda')} />
        {e.borda > 0 && <CampoCor rotulo="Cor da borda" valor={e.corBorda} aoMudar={(corBorda) => alterar({ corBorda }, 'corBorda')} />}
        <CampoNumero
          rotulo="Opacidade (%)"
          valor={Math.round(e.opacidade * 100)}
          min={0}
          max={100}
          passo={5}
          aoMudar={(n) => alterar({ opacidade: n / 100 }, 'opacidade')}
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------
// Salvar e versões
// ---------------------------------------------------------------------

function Salvar({
  modelo,
  mudou,
  avisos,
  aoSalvar,
  aoErro,
  aoDescartar,
  aoPadrao,
}: {
  modelo: ModeloCredencial
  mudou: boolean
  avisos: string[]
  aoSalvar: (usar: boolean) => void
  aoErro: (erro: string) => void
  aoDescartar: () => void
  aoPadrao: () => void
}) {
  const [descricao, setDescricao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  function salvar(usar: boolean) {
    void umaVez(async () => {
      const r = await salvarModelo(normalizarModelo(modelo), descricao, usar)
      if (r.erro !== null) aoErro(r.erro)
      else {
        setDescricao('')
        aoSalvar(usar)
      }
    })
  }
  return (
    <section className="painel" aria-labelledby="titulo-salvar-modelo">
      <h2 id="titulo-salvar-modelo">Salvar</h2>
      <p className="detalhe">{mudou ? 'Há mudanças ainda não salvas.' : 'Nada mudou desde a última vez que salvou (ou abriu).'}</p>
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
        className="form-linha"
        aria-label="Salvar o modelo"
        onSubmit={(e) => {
          e.preventDefault()
          salvar(true)
        }}
      >
        <label>
          O que mudou? *
          <input required maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: logo oficial no cabeçalho" />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Salvar e usar em todas as credenciais
        </button>
        <button
          type="button"
          className="botao botao-secundario"
          disabled={enviando}
          onClick={(e) => {
            if (e.currentTarget.form?.reportValidity()) salvar(false)
          }}
        >
          Salvar sem usar ainda
        </button>
      </form>
      <div className="acoes">
        <button type="button" className="botao-texto" disabled={!mudou} onClick={aoDescartar}>
          Descartar as mudanças
        </button>
        <button type="button" className="botao-texto" onClick={aoPadrao}>
          Abrir o modelo padrão do sistema no editor
        </button>
      </div>
    </section>
  )
}

function Versoes({
  versoes,
  aoAbrir,
  aoUsar,
  aoErro,
}: {
  versoes: VersaoModelo[]
  aoAbrir: (v: VersaoModelo) => void
  aoUsar: (mensagem: string) => void
  aoErro: (erro: string) => void
}) {
  const [enviando, umaVez] = useUmaVez()
  const padraoEmUso = !versoes.some((v) => v.em_uso)
  const usar = (id: string | null, mensagem: string) =>
    void umaVez(async () => {
      const r = await usarModelo(id)
      if (r.erro !== null) aoErro(r.erro)
      else aoUsar(mensagem)
    })
  return (
    <section className="painel" aria-labelledby="titulo-versoes-modelo">
      <h2 id="titulo-versoes-modelo">Versões salvas</h2>
      <p className="detalhe">
        "Usar" muda na hora todas as credenciais: as digitais e as próximas impressões. Arquivar só tira a versão da lista;
        nada se apaga.
      </p>
      <ul className="lista" aria-label="Versões do modelo">
        <li className="lista-item lista-item-estatico" aria-label="Modelo padrão do sistema">
          <strong>Modelo padrão do sistema</strong>
          <span className="detalhe">O desenho que vem com o sistema</span>
          <span>{padraoEmUso && <span className="etiqueta etiqueta-ok">Em uso</span>}</span>
          <span className="acoes-linha">
            {!padraoEmUso && (
              <button type="button" className="botao-texto" disabled={enviando} onClick={() => usar(null, 'Agora as credenciais usam o modelo padrão do sistema.')}>
                Usar o padrão
              </button>
            )}
          </span>
        </li>
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
                Abrir no editor
              </button>
              {!v.em_uso && (
                <button type="button" className="botao-texto" disabled={enviando} onClick={() => usar(v.id, `Agora as credenciais usam a versão "${v.descricao}".`)}>
                  Usar esta versão
                </button>
              )}
              {!v.em_uso && (
                <BotaoArquivar
                  rotulo={`Arquivar a versão ${v.descricao}`}
                  aoConfirmar={() =>
                    void umaVez(async () => {
                      const r = await arquivarModelo(v.id)
                      if (r.erro !== null) aoErro(r.erro)
                      else aoUsar(`Versão "${v.descricao}" arquivada (continua guardada).`)
                    })
                  }
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
