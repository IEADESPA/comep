// A impressão das credenciais (Fase 5.5, parte 8; rodadas 8 a 11, aprovadas): só lado a lado, para dobrar (a frente e
// o verso juntos); 4 por folha A4, 5 mm de espaço entre as credenciais e 2 mm de sangria em volta; as marcas de corte
// fora da sangria. A impressão começa SEMPRE no alto da folha; as vagas que sobram saem em branco (sem a palavra
// "livre" e sem marcas). Com um pedaço de folha já cortado, a pessoa diz quantas cabem nele (meia folha, A5, cabe 2):
// as primeiras vão no pedaço e o resto em folhas inteiras.

/** Espaço entre uma credencial e a outra, fora da sangria (mm). */
export const ESPACO_MM = 5
/** A sangria em volta de cada credencial (o fundo passa do corte, porque a guilhotina não é perfeita). */
export const SANGRIA_MM = 2
/** A margem de cima e de baixo da folha (mm): o lugar das marcas de corte da primeira e da última. */
export const MARGEM_MM = 8
export const A4 = { largura: 210, altura: 297 } as const
/** As credenciais por folha A4 no tamanho de cartão de crédito. */
export const POR_FOLHA_A4 = 4

export type Folha<T> = {
  tipo: 'pedaco' | 'folha'
  /** mm */
  altura: number
  itens: T[]
}

/** A altura (mm) que um par ocupa na folha: o cartão e a sangria em cima e embaixo. */
export const alturaDoPar = (alturaCartao: number) => alturaCartao + SANGRIA_MM * 2

/** O pedaço já cortado: a altura (mm) de quem tem lugar para N credenciais (a folha A4 em quartos: 2 = meia folha, A5). */
export function alturaDoPedaco(cabem: number): number {
  return Math.round(((A4.altura * cabem) / POR_FOLHA_A4) * 100) / 100
}

/** O nome do papel do pedaço, para a janela de impressão. */
export function papelDoPedaco(cabem: number): string {
  if (cabem === 2) return 'A5, deitado (meia folha A4)'
  return `personalizado: 210 × ${String(alturaDoPedaco(cabem)).replace('.', ',')} mm`
}

/**
 * Monta as folhas: no pedaço (se houver), as primeiras `pedaco` credenciais; depois, folhas A4 inteiras, sempre a
 * partir do alto, com quantas couberem pela altura (4 no tamanho de cartão de crédito). Cada item diz a altura do
 * cartão dele (mm): modelos de tamanhos diferentes podem sair na mesma folha.
 */
export function montarFolhas<T>(itens: readonly T[], alturaCartao: (t: T) => number, pedaco: number | null): Folha<T>[] {
  const folhas: Folha<T>[] = []
  let resto = [...itens]
  if (pedaco && pedaco > 0 && resto.length > 0) {
    folhas.push({ tipo: 'pedaco', altura: alturaDoPedaco(pedaco), itens: resto.slice(0, pedaco) })
    resto = resto.slice(pedaco)
  }
  const util = A4.altura - MARGEM_MM * 2
  while (resto.length > 0) {
    const daFolha: T[] = []
    let usado = 0
    for (const item of resto) {
      const h = alturaDoPar(alturaCartao(item)) + (daFolha.length > 0 ? ESPACO_MM : 0)
      if (daFolha.length > 0 && (usado + h > util + 0.01 || daFolha.length >= POR_FOLHA_A4)) break
      daFolha.push(item)
      usado += h
    }
    folhas.push({ tipo: 'folha', altura: A4.altura, itens: daFolha })
    resto = resto.slice(daFolha.length)
  }
  return folhas
}

/** O resumo para a tela: "1, com 2 no alto", "2 (a última com 1 no alto)". */
export function resumoDasFolhas<T>(folhas: readonly Folha<T>[]): string {
  const inteiras = folhas.filter((f) => f.tipo === 'folha')
  if (inteiras.length === 0) return 'nenhuma'
  const ultima = inteiras[inteiras.length - 1].itens.length
  const completa = ultima >= POR_FOLHA_A4
  if (inteiras.length === 1) return completa ? '1' : `1, com ${ultima} no alto`
  return completa ? String(inteiras.length) : `${inteiras.length} (a última com ${ultima} no alto)`
}
