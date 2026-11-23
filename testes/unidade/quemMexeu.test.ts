// "Quem mexeu nos seus dados": as linhas iguais do mesmo dia e do mesmo autor viram uma, com a quantidade (D-13).
// Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { agruparQuemMexeu, type MudancaNosDados } from '../../src/utilitarios/quemMexeu.ts'

const linha = (em: string, quem: string, o_que: string, operacao: MudancaNosDados['operacao'] = 'INSERT'): MudancaNosDados => ({
  em,
  quem,
  o_que,
  operacao,
})

describe('quem mexeu nos seus dados', () => {
  it('as 12 mensalidades registradas de uma vez viram uma linha, com a quantidade', () => {
    const doze = Array.from({ length: 12 }, (_, i) => linha(`2026-11-12T14:00:${String(i).padStart(2, '0')}Z`, 'Presidência de Teste', 'as suas contribuições'))
    const agrupadas = agruparQuemMexeu([linha('2026-11-20T15:00:00Z', 'Secretaria de Teste', 'o seu cadastro', 'UPDATE'), ...doze])
    assert.deepEqual(
      agrupadas.map((a) => [a.quem, a.o_que, a.vezes]),
      [
        ['Secretaria de Teste', 'o seu cadastro', 1],
        ['Presidência de Teste', 'as suas contribuições', 12],
      ],
    )
    // a linha agrupada fica com o instante da mais recente (a lista vem da mais nova para a mais antiga)
    assert.equal(agrupadas[1].em, '2026-11-12T14:00:00Z')
  })

  it('não junta dias diferentes (no fuso de Parauapebas), autores diferentes nem operações diferentes', () => {
    const agrupadas = agruparQuemMexeu([
      // 13/11 às 01:00 em UTC ainda é 12/11 em Parauapebas: junta com a de 12/11
      linha('2026-11-13T01:00:00Z', 'Presidência de Teste', 'as suas contribuições'),
      linha('2026-11-12T14:00:00Z', 'Presidência de Teste', 'as suas contribuições'),
      linha('2026-11-11T14:00:00Z', 'Presidência de Teste', 'as suas contribuições'),
      linha('2026-11-12T14:00:00Z', 'Tesouraria de Teste', 'as suas contribuições'),
      linha('2026-11-12T14:00:00Z', 'Presidência de Teste', 'as suas contribuições', 'UPDATE'),
    ])
    assert.deepEqual(
      agrupadas.map((a) => a.vezes),
      [2, 1, 1, 1],
    )
  })
})
