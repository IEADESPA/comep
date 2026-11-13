// Formatos e validações usados nas telas. Sem dependências: também é testado em testes/unidade.

/** Deixa só letras e números, em maiúsculas (o CNPJ novo da Receita pode ter letras). */
export function limparCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, '')
}

/**
 * CNPJ numérico ou alfanumérico (Receita Federal, 2026): 12 caracteres + 2 dígitos verificadores.
 * Cada caractere vale (código ASCII − 48). Mesma regra da função interno.cnpj_valido no banco.
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false
  const valores = [...cnpj].map((c) => c.charCodeAt(0) - 48)
  const digito = (quantidade: number) => {
    const pesos = quantidade === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((total, peso, i) => total + valores[i] * peso, 0)
    return soma % 11 < 2 ? 0 : 11 - (soma % 11)
  }
  return digito(12) === valores[12] && digito(13) === valores[13]
}

/** 11222333000181 → 11.222.333/0001-81 */
export function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return ''
  const c = limparCnpj(cnpj)
  if (c.length !== 14) return cnpj
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

/** 2026-01-10 → 10/01/2026 */
export function formatarData(data: string | null | undefined): string {
  if (!data) return ''
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

/** Só a data de um instante (ex.: criado_em), no fuso de Parauapebas: 22h30 de 11/11 continua 11/11. */
export function formatarDataDeInstante(instante: string | null | undefined): string {
  if (!instante) return ''
  return new Date(instante).toLocaleDateString('pt-BR', { timeZone: 'America/Belem' })
}

/** Data e hora no fuso de Parauapebas (America/Belem). */
export function formatarDataHora(instante: string): string {
  return new Date(instante).toLocaleString('pt-BR', {
    timeZone: 'America/Belem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Hoje, no formato do campo de data (AAAA-MM-DD), no fuso de Parauapebas. */
export function hojeIso(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
}

/** Compara textos ignorando maiúsculas e acentos (para as buscas). */
export function contemTexto(texto: string | null | undefined, busca: string): boolean {
  const normalizar = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
  return normalizar(texto ?? '').includes(normalizar(busca.trim()))
}
