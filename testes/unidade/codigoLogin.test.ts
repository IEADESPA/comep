// "Tenho um código" (S5-04, a tela `codigo-login` da rodada 37): as frases do "É você?" e do "Pronto". Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  codigoParaMostrar,
  emailMascarado,
  fraseDoPedido,
  linhasDaConta,
  linhasDoCadastro,
  textoDoPronto,
} from '../../src/utilitarios/codigoLogin.ts'

describe('"Tenho um código": o que a tela mostra', () => {
  it('o código aparece como a secretaria mandou (maiúsculas, de 4 em 4)', () => {
    assert.equal(codigoParaMostrar(' k7pq-2qxa-bcde '), 'K7PQ-2QXA-BCDE')
    assert.equal(codigoParaMostrar('k7pq2qxabcde'), 'K7PQ-2QXA-BCDE')
    assert.equal(codigoParaMostrar('k7p'), 'K7P')
  })

  it('o e-mail da conta, com o meio escondido', () => {
    assert.equal(emailMascarado('joao.santos@exemplo.com'), 'jo•••@exemplo.com')
    assert.equal(emailMascarado('j@exemplo.com'), 'j•••@exemplo.com')
    assert.equal(emailMascarado(''), '')
    assert.equal(emailMascarado('sem-arroba'), 'se•••')
  })

  it('o pedido de associação da conta', () => {
    assert.equal(fraseDoPedido('enviado'), 'em análise')
    assert.equal(fraseDoPedido('pendencia'), 'com pendência')
    assert.equal(fraseDoPedido('aguardando_assembleia'), 'aguardando a assembleia')
  })

  it('as linhas da conta de agora', () => {
    assert.deepEqual(linhasDaConta('joao.santos@exemplo.com', { criada_em: '2026-11-10T13:00:00Z', pedido: 'enviado' }), [
      'E-mail: jo•••@exemplo.com',
      'Conta criada em 10/11/2026',
      'Pedido de associação em análise',
    ])
    assert.deepEqual(linhasDaConta('joao.santos@exemplo.com', { criada_em: '2026-11-10T13:00:00Z', pedido: null }), [
      'E-mail: jo•••@exemplo.com',
      'Conta criada em 10/11/2026',
    ])
  })

  it('as linhas do cadastro da secretaria', () => {
    assert.deepEqual(
      linhasDoCadastro({ numero: 63, associado_desde: '2019-03-14', igreja: 'Igreja Monte Sião', funcao: 'ministro', em_dia: true }),
      ['Nº 0063 · associado desde 14/03/2019', 'Igreja Monte Sião · ministro', 'Situação: em dia'],
    )
    assert.deepEqual(
      linhasDoCadastro({ numero: 7, associado_desde: null, igreja: null, funcao: 'Pastor(a)', em_dia: false }),
      ['Nº 0007', 'Pastor(a)', 'Situação: em atraso'],
    )
    assert.deepEqual(linhasDoCadastro({ numero: null, associado_desde: null, igreja: null, funcao: null, em_dia: true }), [
      'Situação: em dia',
    ])
  })

  it('o "Pronto": o nº e o pedido arquivado', () => {
    assert.equal(
      textoDoPronto({ numero: 63, pedido: true }, true),
      'Você entra como ministro, nº 0063. O pedido de associação foi arquivado: você já é associado.',
    )
    assert.equal(textoDoPronto({ numero: 63, pedido: false }, true), 'Você entra como ministro, nº 0063.')
    assert.equal(textoDoPronto({ numero: null, pedido: false }, false), 'Você entra no seu cadastro do COMEP.')
  })
})
