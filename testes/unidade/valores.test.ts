// Testes das funções puras de dinheiro e planilha (revisão geral da Fase 2). Rodar: npm test

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { montarCsv } from '../../src/utilitarios/exportar.ts'
import { lerValor, PADRAO_VALOR } from '../../src/utilitarios/valores.ts'

describe('lerValor (valores em reais digitados)', () => {
  const casos: [string, number | null][] = [
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1.500', 1500],
    ['1500.50', 1500.5],
    ['10.5', 10.5],
    ['R$ 25,90', 25.9],
    ['0,5', 0.5],
    ['100', 100],
    ['12.345.678,9', 12345678.9],
    ['-50,00', -50],
    ['1,234', null],
    ['1.2345', null],
    ['abc', null],
    ['', null],
    ['10,', null],
  ]
  for (const [texto, esperado] of casos) {
    it(`"${texto}" → ${esperado}`, () => assert.equal(lerValor(texto), esperado))
  }

  it('o padrão do campo aceita exatamente o que o leitor entende', () => {
    const padrao = new RegExp(`^(?:${PADRAO_VALOR})$`)
    for (const [texto, esperado] of casos) assert.equal(padrao.test(texto), esperado !== null, texto)
  })
})

describe('montarCsv (planilha)', () => {
  it('neutraliza fórmulas no começo do texto, mas mantém números negativos', () => {
    const csv = montarCsv([['=HYPERLINK("http://x")', '+ Oferta', '-Tarifa', '@conta', '-12,50', 'Normal']])
    assert.equal(csv, '﻿"\'=HYPERLINK(""http://x"")";\'+ Oferta;\'-Tarifa;\'@conta;-12,50;Normal\r\n')
  })
})

describe('CPF', () => {
  it('confere os dígitos verificadores', async () => {
    const { cpfValido, formatarCpf } = await import('../../src/utilitarios/formatos.ts')
    assert.equal(cpfValido('529.982.247-25'), true)
    assert.equal(cpfValido('52998224725'), true)
    assert.equal(cpfValido('111.444.777-35'), true)
    assert.equal(cpfValido('123.456.789-00'), false)
    assert.equal(cpfValido('111.111.111-11'), false)
    assert.equal(cpfValido('5299822472'), false)
    assert.equal(formatarCpf('52998224725'), '529.982.247-25')
  })
})
