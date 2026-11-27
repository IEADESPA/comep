// O texto sem o que não aparece (src/utilitarios/textoLimpo.ts): a mesma limpeza do banco no nome e no telefone.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { semInvisiveis } from '../../src/utilitarios/textoLimpo.ts'

describe('semInvisiveis', () => {
  it('o telefone colado com marcas de direção fica só com o número', () => {
    assert.equal(semInvisiveis('\u202a(94) 99999-0000\u202c\u200e'), '(94) 99999-0000')
  })

  it('o controle e o espaço diferente viram espaço; o que não aparece sai; os espaços se juntam', () => {
    assert.equal(semInvisiveis('  Maria\tda\u00a0Silva\u200b\u3164 \n Souza\ufeff '), 'Maria da Silva Souza')
    assert.equal(semInvisiveis('Nome\u00ad\u115f\u180e\u2800\ufe0f\u{e0001}'), 'Nome')
  })

  it('o acento empilhado fica com dois; os nomes reais não mudam', () => {
    assert.equal(semInvisiveis('Ana\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301\u0301'), 'Ana\u0301\u0301')
    for (const nome of ['José Antônio de Araújo', 'Jose\u0301 Anto\u0302nio', "D'Ávila D\u2019Ávila João-Paulo", '+55 (94) 9 9999-0000']) {
      assert.equal(semInvisiveis(nome), nome)
    }
  })

  it('só o que não aparece vira texto vazio', () => {
    assert.equal(semInvisiveis('\u200b\u3164 \t'), '')
  })
})
