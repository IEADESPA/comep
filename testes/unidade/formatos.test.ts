// Testes das validações das telas (a mesma regra do CNPJ existe no banco: interno.cnpj_valido).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cnpjValido,
  contemTexto,
  formatarCnpj,
  formatarData,
  limparCnpj,
  mascararCnpj,
  problemaNoCnpj,
} from '../../src/utilitarios/formatos.ts'

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

  // D-10: o "Como deve ficar" do CNPJ, em Minha igreja › Dados, põe a pontuação enquanto a pessoa digita
  it('a máscara põe a pontuação enquanto se digita', () => {
    const passos: [string, string][] = [
      ['', ''],
      ['11', '11'],
      ['112', '11.2'],
      ['11222', '11.222'],
      ['112223', '11.222.3'],
      ['112223330', '11.222.333/0'],
      ['112223330001', '11.222.333/0001'],
      ['1122233300018', '11.222.333/0001-8'],
      ['11222333000181', '11.222.333/0001-81'],
    ]
    for (const [digitado, esperado] of passos) assert.equal(mascararCnpj(digitado), esperado, digitado)
  })

  it('a máscara aceita o colado com pontuação, o alfanumérico em minúsculas e corta o que passa de 14', () => {
    assert.equal(mascararCnpj('11.222.333/0001-81'), '11.222.333/0001-81')
    assert.equal(mascararCnpj('12abc34501de35'), '12.ABC.345/01DE-35')
    assert.equal(mascararCnpj('1122233300018199'), '11.222.333/0001-81')
    // apagar a pontuação do fim não a põe de volta
    assert.equal(mascararCnpj('11.222.'), '11.222')
  })

  it('a máscara só aceita números nos dois dígitos do fim', () => {
    assert.equal(mascararCnpj('12ABC34501DEX5'), '12.ABC.345/01DE-5')
    assert.equal(mascararCnpj('12ABC34501DE3Z'), '12.ABC.345/01DE-3')
  })

  it('a conferência na tela: nada enquanto se digita; o aviso quando os 14 não batem', () => {
    assert.equal(problemaNoCnpj(''), null)
    assert.equal(problemaNoCnpj('11.222.333/0001'), null)
    assert.equal(problemaNoCnpj('11.222.333/0001-81'), null)
    assert.equal(problemaNoCnpj('12.ABC.345/01DE-35'), null)
    assert.equal(problemaNoCnpj('11.222.333/0001-82'), 'Confira o CNPJ: os dois últimos números (os dígitos) não batem.')
    assert.equal(problemaNoCnpj('11.111.111/1111-11'), 'Confira o CNPJ: os dois últimos números (os dígitos) não batem.')
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
