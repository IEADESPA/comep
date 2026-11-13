// Valores em reais digitados do jeito brasileiro. Um só leitor para todas as telas
// (antes, cada tela lia de um jeito e "1.500" ou "1500.50" podiam virar outro número).

/** Formatos aceitos nos campos de valor (o mesmo que lerValor entende). Para o atributo `pattern`. */
export const PADRAO_VALOR = '(R\\$ ?)?-?([0-9]{1,3}(\\.[0-9]{3})*(,[0-9]{1,2})?|[0-9]+(,[0-9]{1,2})?|[0-9]+\\.[0-9]{1,2})'

export const DICA_VALOR = 'Use vírgula nos centavos. Ex.: 1.234,56 ou 25,90'

/**
 * Lê "1.234,56", "1234,56", "1.500" (mil e quinhentos), "10.5" ou "R$ 25,90".
 * Devolve null quando não dá para entender sem adivinhar (ex.: "1,234", "abc", vazio).
 * O resultado vem arredondado aos centavos.
 */
export function lerValor(texto: string): number | null {
  const t = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  let normal: string
  if (/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(t)) normal = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d+(,\d{1,2})?$/.test(t)) normal = t.replace(',', '.')
  else if (/^-?\d+\.\d{1,2}$/.test(t)) normal = t
  else return null
  const numero = Number(normal)
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null
}

/** Valor para preencher um campo a partir de um número (12.5 → "12,50"). */
export function valorParaCampo(valor: number | string | null | undefined): string {
  return Number(valor ?? 0).toFixed(2).replace('.', ',')
}
