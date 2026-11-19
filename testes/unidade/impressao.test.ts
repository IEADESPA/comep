// A impressão das credenciais (Fase 5.5, parte 8): 4 por folha, sempre do alto, o pedaço já cortado. Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  alturaDoPar,
  alturaDoPedaco,
  ESPACO_MM,
  MARGEM_MM,
  montarFolhas,
  papelDoPedaco,
  resumoDasFolhas,
  SANGRIA_MM,
} from '../../src/utilitarios/impressao.ts'

const CR80 = 53.98
const credenciais = (n: number) => Array.from({ length: n }, (_, i) => ({ i, altura: CR80 }))
const altura = (c: { altura: number }) => c.altura

describe('a impressão das credenciais', () => {
  it('4 por folha A4, com 5 mm de espaço e 2 mm de sangria, e as margens das marcas de corte', () => {
    const usado = 4 * alturaDoPar(CR80) + 3 * ESPACO_MM
    assert.ok(usado + 2 * MARGEM_MM <= 297, `cabe na folha: ${usado} mm`)
    assert.equal(alturaDoPar(CR80), CR80 + 2 * SANGRIA_MM)
    const folhas = montarFolhas(credenciais(9), altura, null)
    assert.deepEqual(
      folhas.map((f) => [f.tipo, f.itens.length]),
      [
        ['folha', 4],
        ['folha', 4],
        ['folha', 1],
      ],
    )
  })

  it('sempre a partir do alto: com 2, a folha leva 2 e o resto fica em branco', () => {
    const folhas = montarFolhas(credenciais(2), altura, null)
    assert.equal(folhas.length, 1)
    assert.equal(folhas[0].itens.length, 2)
    assert.equal(resumoDasFolhas(folhas), '1, com 2 no alto')
  })

  it('o pedaço já cortado: as primeiras vão nele, o resto em folhas inteiras', () => {
    const folhas = montarFolhas(credenciais(5), altura, 2)
    assert.deepEqual(
      folhas.map((f) => [f.tipo, f.itens.map((c) => c.i)]),
      [
        ['pedaco', [0, 1]],
        ['folha', [2, 3, 4]],
      ],
    )
    assert.equal(folhas[0].altura, 148.5)
    assert.equal(resumoDasFolhas(folhas), '1, com 3 no alto')
    // só o pedaço
    assert.deepEqual(
      montarFolhas(credenciais(2), altura, 2).map((f) => f.tipo),
      ['pedaco'],
    )
  })

  it('o papel do pedaço: meia folha é o A5 deitado; os outros, tamanho personalizado', () => {
    assert.equal(papelDoPedaco(2), 'A5, deitado (meia folha A4)')
    assert.equal(alturaDoPedaco(1), 74.25)
    assert.equal(papelDoPedaco(3), 'personalizado: 210 × 222,75 mm')
    // cabem os pares no pedaço
    for (const n of [1, 2, 3]) assert.ok(n * alturaDoPar(CR80) + (n - 1) * ESPACO_MM <= alturaDoPedaco(n), `pedaço de ${n}`)
  })

  it('o crachá em pé (mais alto) cabe menos por folha', () => {
    const crachas = Array.from({ length: 5 }, (_, i) => ({ i, altura: 85.6 }))
    const folhas = montarFolhas(crachas, altura, null)
    assert.deepEqual(
      folhas.map((f) => f.itens.length),
      [3, 2],
    )
  })
})
