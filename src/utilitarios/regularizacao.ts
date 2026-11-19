// A regularização das igrejas (Fase 5.5, parte 5): contas de datas e textos que as telas usam.
// As regras valem no banco (interno.situacao_igreja); aqui é só o que a tela mostra e calcula antes de mandar.

/** Os itens que deixam a igreja regular (e o que suspende quando vence). */
export type ItemRegularidade = 'estatuto' | 'cartao_cnpj' | 'natureza_juridica' | 'ata_diretoria' | 'alvara'

export const NOME_DO_ITEM: Record<ItemRegularidade, string> = {
  estatuto: 'Estatuto',
  cartao_cnpj: 'Cartão CNPJ',
  natureza_juridica: 'Natureza jurídica (organização religiosa)',
  ata_diretoria: 'Ata da diretoria',
  alvara: 'Alvará de licenciamento',
}

/** O nome curto, no meio da frase ("falta o estatuto e o alvará"). */
export const NOME_CURTO: Record<ItemRegularidade, string> = {
  estatuto: 'o estatuto',
  cartao_cnpj: 'o Cartão CNPJ',
  natureza_juridica: 'a natureza jurídica',
  ata_diretoria: 'a ata da diretoria',
  alvara: 'o alvará',
}

/** "o estatuto", "o estatuto e o alvará", "5 itens". */
export function listaCurta(itens: readonly ItemRegularidade[]): string {
  if (itens.length <= 2) return itens.map((i) => NOME_CURTO[i]).join(' e ')
  return `${itens.length} itens`
}

/** "Mande aqui…": o documento que resolve cada item vencido. */
export const MANDE_AQUI: Record<ItemRegularidade, string> = {
  estatuto: 'o estatuto',
  cartao_cnpj: 'o Cartão CNPJ',
  natureza_juridica: 'o Cartão CNPJ novo, como organização religiosa',
  ata_diretoria: 'a ata nova',
  alvara: 'o alvará',
}

const UM_DIA = 86_400_000

/** Dias de `de` até `ate` (datas aaaa-mm-dd; negativo se `ate` vem antes). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / UM_DIA)
}

/** Soma dias a uma data aaaa-mm-dd. */
export function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T12:00:00Z`) + dias * UM_DIA).toISOString().slice(0, 10)
}

/** O fim do mandato: a posse mais N anos, menos um dia (posse 01/01/2025, 4 anos → 31/12/2028). */
export function fimDoMandato(posse: string, anos: number): string {
  const [a, m, d] = posse.split('-').map(Number)
  const fim = new Date(Date.UTC(a + anos, m - 1, d, 12))
  // 29/02 + N anos em ano comum: o JavaScript passa para 01/03; o dia anterior fica certo
  return new Date(fim.getTime() - UM_DIA).toISOString().slice(0, 10)
}

export type CargoComMandato = { inicio: string; fim: string }

/** A diretoria vale até o MENOR mandato (null se algum cargo está sem as datas). */
export function menorMandato(cargos: readonly CargoComMandato[]): string | null {
  if (cargos.length === 0 || cargos.some((c) => !c.inicio || !c.fim)) return null
  return cargos.reduce((menor, c) => (c.fim < menor ? c.fim : menor), cargos[0].fim)
}

/** "faltam 43 dias", "vence hoje", "venceu há 3 dias". */
export function textoDoPrazo(hoje: string, ate: string): string {
  const dias = diasEntre(hoje, ate)
  if (dias > 1) return `faltam ${dias} dias`
  if (dias === 1) return 'falta 1 dia'
  if (dias === 0) return 'vence hoje'
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`
}

/** "2 anos e 1 mês", "5 meses", "43 dias": o tempo que falta, do jeito de falar. */
export function tempoQueFalta(hoje: string, ate: string): string {
  const dias = diasEntre(hoje, ate)
  if (dias < 60) return dias === 1 ? '1 dia' : `${Math.max(dias, 0)} dias`
  const meses = Math.floor(dias / 30.44)
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const textoMeses = (n: number) => (n === 1 ? '1 mês' : `${n} meses`)
  if (anos === 0) return textoMeses(meses)
  const textoAnos = anos === 1 ? '1 ano' : `${anos} anos`
  return resto === 0 ? textoAnos : `${textoAnos} e ${textoMeses(resto)}`
}

/**
 * A localização tirada do link do Google Maps (ou das coordenadas coladas): "@-6.0679,-49.9022",
 * "?q=-6.0679,-49.9022", "!3d-6.0679!4d-49.9022" ou "-6.0679, -49.9022". Null se não achar.
 */
export function coordenadasDoLink(texto: string): { latitude: number; longitude: number } | null {
  const t = decodeURIComponent(texto.trim())
  const formas = [
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/,
    /^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ]
  for (const forma of formas) {
    const achado = t.match(forma)
    if (!achado) continue
    const latitude = Number(achado[1])
    const longitude = Number(achado[2])
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 }
    }
  }
  return null
}

/** O tamanho do arquivo do jeito brasileiro: "2,1 MB", "180 KB". */
export function tamanhoDoArquivo(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** O limite de cada arquivo (parte) de um documento da igreja. */
export const LIMITE_DA_PARTE = 25 * 1024 * 1024
