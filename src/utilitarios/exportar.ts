// Exportação de relatórios: planilha (CSV que o Excel e o LibreOffice abrem em português) e impressão/PDF.

type Celula = string | number | null | undefined

/** Número no formato brasileiro, sem "R$" (bom para somar na planilha): 1234.5 → "1234,50". */
export function numeroPlanilha(valor: number | string | null | undefined): string {
  return Number(valor ?? 0).toFixed(2).replace('.', ',')
}

function celulaCsv(valor: Celula): string {
  const texto = valor === null || valor === undefined ? '' : String(valor)
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** Monta o CSV com ";" (padrão brasileiro) e a marca UTF-8, para os acentos abrirem certos no Excel. */
export function montarCsv(linhas: Celula[][]): string {
  return '﻿' + linhas.map((linha) => linha.map(celulaCsv).join(';')).join('\r\n') + '\r\n'
}

/** Baixa um arquivo CSV no aparelho de quem clicou (nada sai do navegador). */
export function baixarCsv(nomeArquivo: string, linhas: Celula[][]): void {
  const blob = new Blob([montarCsv(linhas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Abre a janela de impressão do navegador — nela dá para "Salvar como PDF". */
export function imprimir(): void {
  window.print()
}
