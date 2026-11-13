// Credencial do associado — um lado (frente ou verso) no tamanho de cartão (CR80: 85,6 × 54 mm),
// desenhado a partir do MODELO (utilitarios/modeloCredencial.ts). O mesmo desenho serve para a tela
// (digital) e para a impressão (tamanho real): tudo é proporcional à largura do cartão.
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { urlImagemModelo } from '../dados/credencial'
import {
  cqi,
  cqiDaLetra,
  preencher,
  type Elemento,
  type ElementoTexto,
  type Lado,
  type ModeloCredencial,
  type ValoresCredencial,
} from '../utilitarios/modeloCredencial'
import { QrCode } from './QrCode'

/** A letra pode diminuir até 45% do tamanho escolhido; menor que isso, o texto é cortado com "…". */
const ESCALA_MINIMA = 0.45

const FONTES = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
} as const

const JUSTIFICAR = { esquerda: 'flex-start', centro: 'center', direita: 'flex-end' } as const
const ALINHAR = { esquerda: 'left', centro: 'center', direita: 'right' } as const

function definirEscala(caixa: HTMLElement, escala: number) {
  caixa.style.setProperty('--escala', String(Math.round(escala * 1000) / 1000))
}

/**
 * Faz cada texto caber na sua caixa: uma linha → diminui a letra até caber na largura (e na altura);
 * várias linhas → diminui até caber na altura. Nada empurra nem corta o item vizinho.
 */
function ajustarTextos(raiz: HTMLElement) {
  for (const caixa of raiz.querySelectorAll<HTMLElement>('[data-ajustar]')) {
    const texto = caixa.firstElementChild as HTMLElement | null
    if (!texto) continue
    caixa.classList.remove('cr-cortar')
    definirEscala(caixa, 1)
    const limite = caixa.getBoundingClientRect()
    if (limite.width < 1 || limite.height < 1) continue
    const cabe = () => {
      const r = texto.getBoundingClientRect()
      return r.width <= limite.width + 0.3 && r.height <= limite.height + 0.3
    }
    if (cabe()) continue
    if (caixa.dataset.ajustar === 'linha') {
      const r = texto.getBoundingClientRect()
      let escala = Math.max(ESCALA_MINIMA, Math.min(limite.width / r.width, limite.height / r.height) * 0.985)
      definirEscala(caixa, escala)
      for (let i = 0; i < 4 && !cabe() && escala > ESCALA_MINIMA; i++) {
        escala = Math.max(ESCALA_MINIMA, escala * 0.95)
        definirEscala(caixa, escala)
      }
    } else {
      // várias linhas: busca a maior letra que cabe na altura
      let menor = ESCALA_MINIMA
      let maior = 1
      for (let i = 0; i < 8; i++) {
        const meio = (menor + maior) / 2
        definirEscala(caixa, meio)
        if (cabe()) menor = meio
        else maior = meio
      }
      definirEscala(caixa, menor)
    }
    if (!cabe()) caixa.classList.add('cr-cortar')
  }
}

const caixaDo = (e: Elemento): CSSProperties => ({ left: cqi(e.x), top: cqi(e.y), width: cqi(e.w), height: cqi(e.h) })

const bordaDe = (espessura: number, corBorda: string) => (espessura > 0 ? `${cqi(espessura)} solid ${corBorda}` : undefined)

function Texto({ e, valores }: { e: ElementoTexto; valores: ValoresCredencial }) {
  const conteudo = preencher(e.texto, valores)
  return (
    <div
      className={`cr-el cr-texto${e.quebrar ? ' cr-linhas' : ''}`}
      data-ajustar={e.quebrar ? 'linhas' : 'linha'}
      data-item={e.id}
      style={{
        ...caixaDo(e),
        color: e.cor,
        fontFamily: FONTES[e.fonte],
        fontSize: `calc(${cqiDaLetra(e.tamanho)} * var(--escala, 1))`,
        fontStyle: e.italico ? 'italic' : undefined,
        fontWeight: e.peso,
        justifyContent: JUSTIFICAR[e.alinhamento],
        letterSpacing: e.espacamento ? `${e.espacamento}em` : undefined,
        textAlign: ALINHAR[e.alinhamento],
        textTransform: e.maiusculas ? 'uppercase' : undefined,
      }}
    >
      <span>{conteudo}</span>
    </div>
  )
}

function Item({ e, valores, nome, foto, urlQr }: { e: Elemento; valores: ValoresCredencial; nome: string; foto: string | null; urlQr: string }) {
  switch (e.tipo) {
    case 'texto':
      return <Texto e={e} valores={valores} />
    case 'forma':
      return (
        <div
          className="cr-el"
          data-item={e.id}
          aria-hidden="true"
          style={{
            ...caixaDo(e),
            background: e.cor2 ? `linear-gradient(${e.angulo}deg, ${e.cor}, ${e.cor2})` : e.cor,
            border: bordaDe(e.borda, e.corBorda),
            borderRadius: e.forma === 'elipse' ? '50%' : cqi(e.raio),
            opacity: e.opacidade,
          }}
        />
      )
    case 'foto':
      return (
        <div
          className="cr-el cr-foto"
          data-item={e.id}
          style={{ ...caixaDo(e), border: bordaDe(e.borda, e.corBorda), borderRadius: cqi(e.raio), fontSize: cqiDaLetra(5) }}
        >
          {foto ? <img src={foto} alt={`Foto de ${nome}`} /> : <span>sem foto</span>}
        </div>
      )
    case 'qr':
      return (
        <div className="cr-el cr-qr" data-item={e.id} style={caixaDo(e)}>
          <QrCode texto={urlQr} rotulo={`QR Code de validação da credencial de ${nome}`} cor={e.cor} />
        </div>
      )
    case 'imagem':
      return (
        <img
          className="cr-el cr-imagem"
          data-item={e.id}
          src={urlImagemModelo(e.arquivo)}
          alt=""
          style={{
            ...caixaDo(e),
            border: bordaDe(e.borda, e.corBorda),
            borderRadius: cqi(e.raio),
            objectFit: e.ajuste === 'cobrir' ? 'cover' : 'contain',
            opacity: e.opacidade,
          }}
        />
      )
  }
}

type PropsFace = {
  lado: Lado
  modelo: ModeloCredencial
  valores: ValoresCredencial
  /** nome do associado (para os textos de acessibilidade) */
  nome: string
  foto: string | null
  /** endereço que vai no QR Code */
  urlQr: string
  className?: string
}

/** Um lado da credencial, desenhado pelo modelo. */
export function FaceCredencial({ lado, modelo, valores, nome, foto, urlQr, className }: PropsFace) {
  const raiz = useRef<HTMLElement>(null)
  const face = modelo[lado]

  // Ajusta os textos a cada mudança (dados ou modelo)…
  useLayoutEffect(() => {
    if (raiz.current) ajustarTextos(raiz.current)
  }, [face, valores])

  // …e quando o cartão muda de tamanho ou as letras terminam de carregar
  useEffect(() => {
    const no = raiz.current
    if (!no) return
    let ativo = true
    const observador = new ResizeObserver(() => ativo && ajustarTextos(no))
    observador.observe(no)
    void document.fonts?.ready.then(() => ativo && ajustarTextos(no))
    return () => {
      ativo = false
      observador.disconnect()
    }
  }, [])

  return (
    <article
      ref={raiz}
      className={`credencial credencial-${lado}${className ? ` ${className}` : ''}`}
      aria-label={`Credencial de ${nome} — ${lado}`}
      style={{ background: face.fundo }}
    >
      {face.elementos.map((e) => (
        <Item key={e.id} e={e} valores={valores} nome={nome} foto={foto} urlQr={urlQr} />
      ))}
    </article>
  )
}
