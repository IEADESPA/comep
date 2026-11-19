// Credencial do associado — um lado (frente ou verso) no tamanho do cartão do modelo (o padrão é o CR80:
// 85,6 × 54 mm), desenhado a partir do MODELO (utilitarios/modeloCredencial.ts). O mesmo desenho serve para a tela
// (digital) e para a impressão (tamanho real): tudo é proporcional à largura do cartão.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { urlImagemModelo } from '../dados/credencial'
import {
  abreviacoesDoNome,
  cartaoDe,
  cqi,
  cqiDaLetra,
  preencher,
  type Elemento,
  type ElementoFaixa,
  type ElementoSimbolo,
  type ElementoTexto,
  type Face,
  type Lado,
  type ModeloCredencial,
  type ValoresCredencial,
} from '../utilitarios/modeloCredencial'
import { SIMBOLOS } from '../utilitarios/simbolos'
import { QrCode } from './QrCode'

/** A letra pode diminuir até 45% do tamanho escolhido. Não coube nem assim: o nome é abreviado; o resto, cortado. */
const ESCALA_MINIMA = 0.45
/** Para o nome, antes de a letra ficar menor que 60%, vale mais abreviar um nome do meio (fica mais legível). */
const ESCALA_CONFORTAVEL = 0.6

const FONTES = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  inter: 'Inter, system-ui, sans-serif',
  jakarta: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
} as const

const JUSTIFICAR = { esquerda: 'flex-start', centro: 'center', direita: 'flex-end' } as const
const ALINHAR = { esquerda: 'left', centro: 'center', direita: 'right' } as const

function definirEscala(caixa: HTMLElement, escala: number) {
  caixa.style.setProperty('--escala', String(Math.round(escala * 1000) / 1000))
}

/** A menor escala da letra de um texto: o mínimo escolhido no editor (pt), ou 45%; sem "encolher", não diminui. */
function escalaMinima(e: ElementoTexto): number {
  if (!e.encolher) return 1
  return e.minimo !== null ? Math.min(1, Math.max(0.1, e.minimo / e.tamanho)) : ESCALA_MINIMA
}

/**
 * Faz o texto caber na sua caixa: uma linha → diminui a letra até caber na largura (e na altura);
 * várias linhas → diminui até caber na altura. Nada empurra nem corta o item vizinho.
 * Devolve 'cabe', 'pequeno' (coube, mas com letra menor que 60%), 'cortado' (nem na menor letra) ou 'oculto'
 * (caixa sem tamanho: ainda não aparece).
 */
function ajustarCaixa(caixa: HTMLElement, linhas: boolean, minima: number): 'cabe' | 'pequeno' | 'cortado' | 'oculto' {
  const texto = caixa.firstElementChild as HTMLElement | null
  caixa.classList.remove('cr-cortar')
  definirEscala(caixa, 1)
  // girada a caixa, o texto gira junto: as duas medidas continuam comparáveis
  const limite = caixa.getBoundingClientRect()
  if (!texto || limite.width < 1 || limite.height < 1) return 'oculto'
  const cabe = () => {
    const r = texto.getBoundingClientRect()
    return r.width <= limite.width + 0.3 && r.height <= limite.height + 0.3
  }
  if (cabe()) return 'cabe'
  if (minima < 1) {
    if (!linhas) {
      const r = texto.getBoundingClientRect()
      let escala = Math.max(minima, Math.min(limite.width / r.width, limite.height / r.height) * 0.985)
      definirEscala(caixa, escala)
      for (let i = 0; i < 4 && !cabe() && escala > minima; i++) {
        escala = Math.max(minima, escala * 0.95)
        definirEscala(caixa, escala)
      }
    } else {
      // várias linhas: busca a maior letra que cabe na altura
      let menor = minima
      let maior = 1
      for (let i = 0; i < 6; i++) {
        const meio = (menor + maior) / 2
        definirEscala(caixa, meio)
        if (cabe()) menor = meio
        else maior = meio
      }
      definirEscala(caixa, menor)
    }
  }
  if (cabe()) return Number(caixa.style.getPropertyValue('--escala')) < ESCALA_CONFORTAVEL ? 'pequeno' : 'cabe'
  caixa.classList.add('cr-cortar')
  return 'cortado'
}

type Medidas = { u: (mm: number) => string; letra: (pt: number) => string }

const caixaDo = (e: Elemento, m: Medidas): CSSProperties => ({
  left: m.u(e.x),
  top: m.u(e.y),
  width: m.u(e.w),
  height: m.u(e.h),
  transform: e.rotacao ? `rotate(${e.rotacao}deg)` : undefined,
})

const bordaDe = (espessura: number, corBorda: string, m: Medidas) => (espessura > 0 ? `${m.u(espessura)} solid ${corBorda}` : undefined)

/**
 * Texto do cartão. Em uma linha com o nome: se nem a menor letra der, tenta o nome abreviado
 * ("Antonio C. F. das C. N. de Oliveira"), como nos documentos; só no fim corta com "…".
 */
function Texto({ e, valores, versao, m }: { e: ElementoTexto; valores: ValoresCredencial; versao: number; m: Medidas }) {
  const formas = useMemo(
    () =>
      !e.quebrar && e.texto.includes('{nome}')
        ? abreviacoesDoNome(valores.nome).map((nome) => preencher(e.texto, { ...valores, nome }))
        : [preencher(e.texto, valores)],
    [e.texto, e.quebrar, valores],
  )
  const minima = escalaMinima(e)
  // Qualquer mudança (texto, caixa, letra, tamanho do cartão) recomeça da forma completa
  const assinatura = [formas[0], e.w, e.h, e.tamanho, e.peso, e.fonte, e.espacamento, e.maiusculas, e.italico, minima, versao].join('|')
  const [escolha, setEscolha] = useState({ assinatura, indice: 0 })
  if (escolha.assinatura !== assinatura) setEscolha({ assinatura, indice: 0 })
  const indice = escolha.assinatura === assinatura ? escolha.indice : 0
  const caixa = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!caixa.current) return
    const resultado = ajustarCaixa(caixa.current, e.quebrar, minima)
    if ((resultado === 'cortado' || resultado === 'pequeno') && indice < formas.length - 1) {
      setEscolha({ assinatura, indice: indice + 1 })
    }
  }, [assinatura, indice, formas.length, e.quebrar, minima])

  return (
    <div
      ref={caixa}
      className={`cr-el cr-texto${e.quebrar ? ' cr-linhas' : ''}`}
      data-ajustar={e.quebrar ? 'linhas' : 'linha'}
      data-item={e.id}
      style={{
        ...caixaDo(e, m),
        color: e.cor,
        fontFamily: FONTES[e.fonte],
        fontSize: `calc(${m.letra(e.tamanho)} * var(--escala, 1))`,
        fontStyle: e.italico ? 'italic' : undefined,
        fontWeight: e.peso,
        justifyContent: JUSTIFICAR[e.alinhamento],
        letterSpacing: e.espacamento ? `${e.espacamento}em` : undefined,
        opacity: e.opacidade < 1 ? e.opacidade : undefined,
        textAlign: ALINHAR[e.alinhamento],
        textTransform: e.maiusculas ? 'uppercase' : undefined,
      }}
    >
      <span>{formas[Math.min(indice, formas.length - 1)]}</span>
    </div>
  )
}

/** A faixa de aviso: listras nas duas cores e o texto no meio (em pé quando a faixa está num lado). */
function Faixa({ e, valores, m }: { e: ElementoFaixa; valores: ValoresCredencial; m: Medidas }) {
  const emPe = e.h > e.w
  const passo = Math.max(e.w, e.h) > 0 ? 1.8 : 1
  return (
    <div
      className={`cr-el cr-faixa${emPe ? ' cr-faixa-em-pe' : ''}`}
      data-item={e.id}
      role="note"
      style={{
        ...caixaDo(e, m),
        background: `repeating-linear-gradient(-45deg, ${e.cor} 0 ${m.u(passo)}, ${e.cor2} ${m.u(passo)} ${m.u(passo * 2)})`,
      }}
    >
      {e.texto && (
        <span style={{ background: e.cor2, color: e.corTexto, fontSize: m.letra(e.tamanho), padding: `${m.u(0.4)} ${m.u(1.6)}` }}>
          {preencher(e.texto, valores)}
        </span>
      )}
    </div>
  )
}

/** Um símbolo da biblioteca (desenho próprio em SVG). */
function DesenhoDoSimbolo({ chave, cor, traco }: { chave: ElementoSimbolo['simbolo']; cor: string; traco: number }) {
  const s = SIMBOLOS[chave]
  const cheio = 'cheio' in s && s.cheio
  return (
    <svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {cheio ? (
        <path d={s.d} fill={cor} />
      ) : (
        <path d={s.d} fill="none" stroke={cor} strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

type PropsItem = {
  e: Elemento
  valores: ValoresCredencial
  nome: string
  foto: string | null
  urlQr: string
  versao: number
  m: Medidas
  /** o logotipo da denominação da pessoa (arquivo da pasta do modelo) */
  logotipo: string | null
  /** no editor: o lugar do logotipo da denominação aparece tracejado */
  editor: boolean
}

function Item({ e, valores, nome, foto, urlQr, versao, m, logotipo, editor }: PropsItem) {
  switch (e.tipo) {
    case 'texto':
      return <Texto e={e} valores={valores} versao={versao} m={m} />
    case 'faixa':
      return <Faixa e={e} valores={valores} m={m} />
    case 'simbolo':
      return (
        <div className="cr-el cr-simbolo" data-item={e.id} aria-hidden="true" style={{ ...caixaDo(e, m), opacity: e.opacidade < 1 ? e.opacidade : undefined }}>
          <DesenhoDoSimbolo chave={e.simbolo} cor={e.cor} traco={e.traco} />
        </div>
      )
    case 'forma':
      return (
        <div
          className="cr-el"
          data-item={e.id}
          aria-hidden="true"
          style={{
            ...caixaDo(e, m),
            background: e.cor2 ? `linear-gradient(${e.angulo}deg, ${e.cor}, ${e.cor2})` : e.cor,
            border: bordaDe(e.borda, e.corBorda, m),
            borderRadius: e.forma === 'elipse' ? '50%' : m.u(e.raio),
            opacity: e.opacidade,
          }}
        />
      )
    case 'foto':
      return (
        <div
          className="cr-el cr-foto"
          data-item={e.id}
          style={{ ...caixaDo(e, m), border: bordaDe(e.borda, e.corBorda, m), borderRadius: m.u(e.raio), fontSize: m.letra(5) }}
        >
          {foto ? <img src={foto} alt={`Foto de ${nome}`} /> : <span>sem foto</span>}
        </div>
      )
    case 'qr':
      return (
        <div className="cr-el cr-qr" data-item={e.id} style={caixaDo(e, m)}>
          <QrCode texto={urlQr} rotulo={`QR Code de validação da credencial de ${nome}`} cor={e.cor} />
        </div>
      )
    case 'imagem':
      if (e.arquivo === 'denominacao' && !logotipo) {
        // sem o logotipo enviado, o lugar fica vazio (no editor, tracejado)
        return editor ? (
          <div className="cr-el cr-lugar-logotipo" data-item={e.id} style={{ ...caixaDo(e, m), fontSize: m.letra(4.5) }}>
            logotipo da denominação
          </div>
        ) : null
      }
      return (
        <img
          className="cr-el cr-imagem"
          data-item={e.id}
          src={urlImagemModelo(e.arquivo === 'denominacao' ? (logotipo ?? 'logo') : e.arquivo)}
          alt=""
          style={{
            ...caixaDo(e, m),
            border: bordaDe(e.borda, e.corBorda, m),
            borderRadius: m.u(e.raio),
            objectFit: e.ajuste === 'cobrir' ? 'cover' : 'contain',
            opacity: e.opacidade,
          }}
        />
      )
  }
}

/** O fundo do lado: cor, degradê ou imagem enviada no editor. */
function fundoDaFace(face: Face): string {
  if (face.imagem) return `${face.fundo} url("${urlImagemModelo(face.imagem)}") center / cover no-repeat`
  if (face.fundo2) return `linear-gradient(${face.anguloFundo}deg, ${face.fundo}, ${face.fundo2})`
  return face.fundo
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
  /** o logotipo da denominação da igreja da pessoa (arquivo da pasta do modelo); vazio = não enviado */
  logotipo?: string | null
  /** no editor: o lugar do logotipo da denominação aparece tracejado */
  editor?: boolean
  /**
   * Na impressão: a sangria (o fundo e o que encosta na borda passam do corte) nos lados de fora do par
   * (a frente não sangra no lado da dobra; o verso também não).
   */
  sangria?: Sangria
}

export type Sangria = { mm: number; esquerda: boolean; direita: boolean; topo: boolean; base: boolean }

/** O que encosta na borda (fundo de faixa, forma, imagem que cobre, faixa de aviso) passa para a sangria. */
function comSangria(e: Elemento, c: { largura: number; altura: number }, s: Sangria): Elemento {
  if (e.tipo === 'texto' || e.tipo === 'qr' || e.tipo === 'foto' || e.tipo === 'simbolo' || e.rotacao) return e
  if (e.tipo === 'imagem' && e.ajuste !== 'cobrir') return e
  let { x, y, w, h } = e
  if (s.esquerda && x <= 0.05) {
    w += s.mm + x
    x = -s.mm
  }
  if (s.topo && y <= 0.05) {
    h += s.mm + y
    y = -s.mm
  }
  if (s.direita && x + w >= c.largura - 0.05) w = c.largura + s.mm - x
  if (s.base && y + h >= c.altura - 0.05) h = c.altura + s.mm - y
  return { ...e, x, y, w, h }
}

/** Um lado da credencial, desenhado pelo modelo. */
export function FaceCredencial({ lado, modelo, valores, nome, foto, urlQr, className, logotipo = null, editor = false, sangria }: PropsFace) {
  const raiz = useRef<HTMLElement>(null)
  const face = modelo[lado]
  const cartao = cartaoDe(modelo)
  const medidas = useMemo<Medidas>(
    () => ({ u: (mm: number) => cqi(mm, cartao.largura), letra: (pt: number) => cqiDaLetra(pt, cartao.largura) }),
    [cartao.largura],
  )
  // Muda quando o cartão muda de largura ou as letras terminam de carregar: os textos se ajustam de novo
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    const no = raiz.current
    if (!no) return
    let ativo = true
    let largura = Math.round(no.getBoundingClientRect().width)
    const observador = new ResizeObserver(() => {
      const nova = Math.round(no.getBoundingClientRect().width)
      if (ativo && nova !== largura) {
        largura = nova
        setVersao((v) => v + 1)
      }
    })
    observador.observe(no)
    if (document.fonts && document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => ativo && setVersao((v) => v + 1))
    }
    return () => {
      ativo = false
      observador.disconnect()
    }
  }, [])

  const emPe = cartao.altura > cartao.largura
  const elementos = sangria ? face.elementos.map((e) => comSangria(e, cartao, sangria)) : face.elementos
  return (
    <article
      ref={raiz}
      className={`credencial credencial-${lado}${emPe ? ' credencial-em-pe' : ''}${sangria ? ' credencial-com-sangria' : ''}${className ? ` ${className}` : ''}`}
      aria-label={`Credencial de ${nome} — ${lado}`}
      style={
        {
          background: fundoDaFace(face),
          aspectRatio: `${cartao.largura} / ${cartao.altura}`,
          '--largura-cartao': `${cartao.largura}mm`,
          '--cantos-cartao': medidas.u(cartao.cantos),
        } as CSSProperties
      }
    >
      {sangria && (
        <span
          className="cr-sangria"
          aria-hidden="true"
          style={{
            background: fundoDaFace(face),
            left: sangria.esquerda ? medidas.u(-sangria.mm) : 0,
            right: sangria.direita ? medidas.u(-sangria.mm) : 0,
            top: sangria.topo ? medidas.u(-sangria.mm) : 0,
            bottom: sangria.base ? medidas.u(-sangria.mm) : 0,
          }}
        />
      )}
      {face.marca &&
        (face.marca.simbolo === 'comep' ? (
          <img
            className="cr-marca"
            src={urlImagemModelo('logo')}
            alt=""
            aria-hidden="true"
            style={{ opacity: face.marca.opacidade, width: medidas.u(Math.min(cartao.largura, cartao.altura) * 0.7) }}
          />
        ) : (
          <span className="cr-marca" aria-hidden="true" style={{ opacity: face.marca.opacidade, width: medidas.u(Math.min(cartao.largura, cartao.altura) * 0.7) }}>
            <DesenhoDoSimbolo chave={face.marca.simbolo} cor={face.marca.cor} traco={1.6} />
          </span>
        ))}
      {elementos.map((e) => (
        <Item key={e.id} e={e} valores={valores} nome={nome} foto={foto} urlQr={urlQr} versao={versao} m={medidas} logotipo={logotipo} editor={editor} />
      ))}
    </article>
  )
}
