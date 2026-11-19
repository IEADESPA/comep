// A biblioteca de símbolos da credencial (Fase 5.5, parte 8; rodadas 10 e 11, aprovadas): desenhos PRÓPRIOS em SVG
// (traço numa grade de 24 × 24), nunca emojis. Os gerais da fé servem a qualquer modelo; os de cada tradição ajudam
// a montar os modelos por tradição (a chama dos pentecostais, as águas do batismo dos batistas…).
// Os LOGOTIPOS OFICIAIS das denominações não ficam aqui: não se copiam da internet. A secretaria envia o arquivo que
// a própria denominação fornecer (Credenciais › Símbolos).
import type { Tradicao } from '../dados/cadastros'

export type Simbolo = {
  nome: string
  /** o desenho (caminho SVG, 24 × 24) */
  d: string
  /** desenhado cheio (a chama); os outros são de traço */
  cheio?: boolean
}

export const SIMBOLOS = {
  cruz: { nome: 'Cruz', d: 'M12 3v18M7 8h10' },
  biblia: { nome: 'Bíblia', d: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM12 8v6M9.5 10.5h5' },
  pomba: { nome: 'Pomba', d: 'M3 13c3 0 5-2 6-5 1 2 3 3 5 3l4-4 3 1-3 3c0 4-3 7-8 7-3 0-5-1-7-5z' },
  chama: { nome: 'Chama', d: 'M12 2c.8 3.6 4.6 5.6 4.6 10.4a4.6 4.6 0 0 1-9.2 0c0-2.2 1.1-3.8 2.4-4.9.1 1.7.9 2.8 2.2 3.3C11.4 8.6 11.2 5.3 12 2z', cheio: true },
  coroa: { nome: 'Coroa', d: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z' },
  calice: { nome: 'Cálice', d: 'M7 3h10c0 5-2 8-5 8s-5-3-5-8zM12 11v7M8 21h8' },
  peixe: { nome: 'Peixe', d: 'M3 12c3-4 8-5 12-3l4-3v12l-4-3c-4 2-9 1-12-3z' },
  ancora: { nome: 'Âncora', d: 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 7v14M5 13a7 7 0 0 0 14 0M9 10h6' },
  ramo: { nome: 'Ramo de oliveira', d: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14zM5 19l9-9' },
  globo: { nome: 'Globo (missões)', d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' },
  estrela: { nome: 'Estrela', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
  igreja: { nome: 'Igreja', d: 'M12 2v4M10 4h4M6 22V10l6-4 6 4v12M3 22h18M10 22v-4a2 2 0 0 1 4 0v4' },
  coracao: { nome: 'Coração', d: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  sarca: { nome: 'Sarça ardente', d: 'M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-4 0-7zM5 21h14M8 21l1-5M16 21l-1-5M12 21v-6' },
  aguas: { nome: 'Águas do batismo', d: 'M3 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 19c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M12 3v7M9 7l3 3 3-3' },
  cruzChama: { nome: 'Cruz e chama', d: 'M12 9v12M8 13h8M12 2c.6 1.6 2 2.4 2 4.2a2 2 0 0 1-4 0c0-1 .5-1.6 1-2' },
  rosa: { nome: 'Rosa', d: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2a3 3 0 0 1 0 6M12 16a3 3 0 0 1 0 6M2 12a3 3 0 0 1 6 0M16 12a3 3 0 0 1 6 0' },
  cruzCeltica: { nome: 'Cruz com o círculo', d: 'M12 2v20M6 9h12M12 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  bibliaAberta: { nome: 'Bíblia aberta', d: 'M2 6c3-1 6-1 10 1 4-2 7-2 10-1v13c-3-1-6-1-10 1-4-2-7-2-10-1zM12 7v13' },
  trombeta: { nome: 'Trombeta', d: 'M3 10v4h3l9 5V5l-9 5zM18 8.5a5 5 0 0 1 0 7M20.5 6a8.5 8.5 0 0 1 0 12' },
  lampada: { nome: 'Lâmpada acesa', d: 'M4 15h12l3-3H8a4 4 0 0 0-4 3zM16 15l-1 3H6l-1-3M12 12V9M12 4c.5 1.4 1.8 2 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.9.6-1.4 1-2' },
} as const satisfies Record<string, Simbolo>

export type ChaveSimbolo = keyof typeof SIMBOLOS

export const ehSimbolo = (v: unknown): v is ChaveSimbolo => typeof v === 'string' && Object.hasOwn(SIMBOLOS, v)

/** Os gerais da fé (12), para qualquer modelo. */
export const GERAIS: readonly ChaveSimbolo[] = ['cruz', 'biblia', 'pomba', 'chama', 'coroa', 'calice', 'peixe', 'ancora', 'ramo', 'globo', 'estrela', 'igreja']

/**
 * Os símbolos de cada tradição (rodada 11: "não são só 6 tradições, há muitas denominações grandes"). As tradições
 * são as da denominação (Igrejas › Denominações); a Quadrangular entra à parte pelos quatro símbolos do evangelho
 * quadrangular, que a denominação usa.
 */
export const POR_TRADICAO: readonly { chave: Tradicao | 'quadrangular'; nome: string; exemplos: string; simbolos: readonly ChaveSimbolo[] }[] = [
  { chave: 'pentecostal', nome: 'Pentecostal', exemplos: 'Assembleia de Deus, Congregação Cristã, Deus é Amor, O Brasil para Cristo', simbolos: ['chama', 'pomba'] },
  { chave: 'quadrangular', nome: 'Quadrangular', exemplos: 'Evangelho Quadrangular', simbolos: ['cruz', 'pomba', 'calice', 'coroa'] },
  { chave: 'neopentecostal', nome: 'Neopentecostal', exemplos: 'Universal, Mundial, Sara Nossa Terra, Renascer', simbolos: ['chama', 'coroa', 'globo'] },
  { chave: 'batista', nome: 'Batista', exemplos: 'Convenção Batista Brasileira, Batista Nacional', simbolos: ['biblia', 'aguas'] },
  { chave: 'reformada', nome: 'Reformada e presbiteriana', exemplos: 'Presbiteriana do Brasil, Presbiteriana Renovada', simbolos: ['sarca'] },
  { chave: 'metodista', nome: 'Metodista e wesleyana', exemplos: 'Metodista, Metodista Wesleyana, Nazareno', simbolos: ['cruzChama'] },
  { chave: 'luterana', nome: 'Luterana', exemplos: 'Luterana do Brasil, Confissão Luterana', simbolos: ['rosa'] },
  { chave: 'anglicana', nome: 'Anglicana', exemplos: 'Episcopal Anglicana', simbolos: ['cruzCeltica'] },
  { chave: 'adventista', nome: 'Adventista', exemplos: 'Adventista do Sétimo Dia', simbolos: ['bibliaAberta', 'trombeta'] },
  { chave: 'congregacional', nome: 'Congregacional', exemplos: 'Congregacional do Brasil', simbolos: ['lampada', 'biblia'] },
]

/** O SVG do símbolo (para a imagem de fundo da marca d'água, por exemplo). */
export function svgDoSimbolo(chave: ChaveSimbolo, cor: string, traco = 1.8): string {
  const s: Simbolo = SIMBOLOS[chave]
  const caminho = s.cheio
    ? `<path d="${s.d}" fill="${cor}"/>`
    : `<path d="${s.d}" fill="none" stroke="${cor}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${caminho}</svg>`
}
