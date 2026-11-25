// O estilos.css é um arquivo só: uma classe nova com o mesmo nome de outra passa por cima dela em todo o sistema.
// Foi o defeito D-08 (22/11/2026): a etiqueta "NOVO" do termo ganhou o nome do Selo da secretaria (.selo-novo), e
// todos os selos (Conferido, Esperando, Recusado, Aprovado) ficaram laranja e quase ilegíveis no escuro.
// Este teste pega de novo: no nível de cima do arquivo (fora de @media), a mesma classe não recebe duas cores.
// Rodar: npm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const CSS = readFileSync(new URL('../../src/estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

type Regra = { seletor: string; corpo: string; linha: number }

/** As regras do nível de cima (as de dentro de @media e afins ficam de fora: elas mudam a tela de propósito). */
function regrasDeCima(css: string): Regra[] {
  const regras: Regra[] = []
  let profundidade = 0
  let comeco = 0
  let abertura = 0
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') {
      if (profundidade === 0) abertura = i
      profundidade++
    } else if (css[i] === '}') {
      profundidade--
      if (profundidade === 0) {
        regras.push({ seletor: css.slice(comeco, abertura).trim(), corpo: css.slice(abertura + 1, i), linha: css.slice(0, abertura).split('\n').length })
        comeco = i + 1
      }
    }
  }
  return regras
}

const CORES = new Set(['color', 'background', 'background-color'])

describe('estilos.css', () => {
  it('nenhuma classe recebe duas cores diferentes no nível de cima (o nome repetido passa por cima)', () => {
    const vistas = new Map<string, { valor: string; linha: number }>()
    const conflitos: string[] = []
    for (const r of regrasDeCima(CSS)) {
      if (r.seletor.startsWith('@')) continue
      for (const seletor of r.seletor.split(',').map((s) => s.trim())) {
        if (!/^\.[a-z0-9-]+$/.test(seletor)) continue
        for (const declaracao of r.corpo.split(';')) {
          const par = declaracao.match(/^\s*([a-z-]+)\s*:\s*([\s\S]+?)\s*$/)
          if (!par || !CORES.has(par[1])) continue
          const chave = `${seletor} ${par[1]}`
          const antes = vistas.get(chave)
          if (antes && antes.valor !== par[2]) conflitos.push(`${seletor} { ${par[1]} }: "${antes.valor}" e "${par[2]}"`)
          vistas.set(chave, { valor: par[2], linha: r.linha })
        }
      }
    }
    assert.deepEqual(conflitos, [])
  })

  it('o Selo da secretaria tem a cor do assunto (verde, laranja ou vermelho), no claro e no escuro', () => {
    const selo = regrasDeCima(CSS).filter((r) => r.seletor.split(',').map((s) => s.trim()).includes('.selo-novo'))
    assert.ok(selo.length > 0)
    for (const r of selo) {
      const cor = r.corpo.match(/(?:^|;)\s*color\s*:\s*([^;]+)/)?.[1].trim()
      const fundo = r.corpo.match(/(?:^|;)\s*background\s*:\s*([^;]+)/)?.[1].trim()
      if (cor) assert.equal(cor, 'var(--area-cor)')
      if (fundo) assert.equal(fundo, 'var(--area-fundo)')
    }
  })

  it('.alinhar-esquerda só tira o recuo do botão de texto, não o do botão cheio (revisão da parte 14, achado 10)', () => {
    // .alinhar-esquerda vem depois de .botao no arquivo: um padding nela passava por cima do recuo de todo .botao com
    // essa classe ("Abrir a tela da portaria", "Encerrar e apurar" e outros, com o texto colado na borda)
    const sozinha = regrasDeCima(CSS).filter((r) => r.seletor.split(',').map((s) => s.trim()).includes('.alinhar-esquerda'))
    assert.ok(sozinha.length > 0)
    for (const r of sozinha) assert.doesNotMatch(r.corpo, /(?:^|;)\s*padding(?:-left|-inline-start|-inline)?\s*:/, `linha ${r.linha}`)
    const texto = regrasDeCima(CSS).filter((r) => r.seletor.split(',').map((s) => s.trim()).includes('.botao-texto.alinhar-esquerda'))
    assert.ok(texto.some((r) => /(?:^|;)\s*padding-left\s*:\s*0\s*(?:;|$)/.test(r.corpo)))
  })
})
