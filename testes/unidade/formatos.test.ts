// Testes das validações das telas (a mesma regra do CNPJ existe no banco: interno.cnpj_valido).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cnpjValido, contemTexto, formatarCnpj, formatarData, limparCnpj } from '../../src/utilitarios/formatos.ts'

describe('CNPJ', () => {
  it('aceita CNPJ numérico válido, com ou sem pontuação', () => {
    assert.equal(cnpjValido('11222333000181'), true)
    assert.equal(cnpjValido('11.222.333/0001-81'), true)
  })

  it('aceita o CNPJ alfanumérico (exemplo da Receita Federal)', () => {
    assert.equal(cnpjValido('12.ABC.345/01DE-35'), true)
    assert.equal(cnpjValido('12abc34501de35'), true)
  })

  it('recusa dígito errado, tamanho errado e números repetidos', () => {
    for (const cnpj of ['11222333000182', '1122233300018', '11111111111111', '12ABC34501DE36', '']) {
      assert.equal(cnpjValido(cnpj), false, cnpj)
    }
  })

  it('formata e limpa', () => {
    assert.equal(formatarCnpj('11222333000181'), '11.222.333/0001-81')
    assert.equal(limparCnpj('12.abc.345/01de-35'), '12ABC34501DE35')
  })
})

describe('textos e datas', () => {
  it('busca ignora acentos e maiúsculas', () => {
    assert.equal(contemTexto('Assembleia de Deus São José', 'sao jose'), true)
    assert.equal(contemTexto('Igreja Batista', 'presbiteriana'), false)
  })

  it('formata data do banco para o padrão brasileiro', () => {
    assert.equal(formatarData('2026-01-10'), '10/01/2026')
    assert.equal(formatarData(null), '')
  })
})
