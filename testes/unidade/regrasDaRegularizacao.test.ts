// As regras da regularização de 26/11/2026 (decisões do presidente) nas frases das telas: o que venceu e o que nunca
// veio (faltava na ativação) e a tolerância do alvará que vence em 31/12. Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fimDaTolerancia, oQueSuspendeu, porqueSuspensa, separarVencidos } from '../../src/utilitarios/regularizacao.ts'

describe('as regras de 26/11/2026 nas frases', () => {
  it('o que suspendeu: o que venceu e o que nunca veio (faltava na ativação), sem dizer "venceu" do que nunca veio', () => {
    assert.equal(porqueSuspensa({ vencidos: ['alvara'], nunca_vieram: [] }), 'o alvará venceu')
    assert.equal(porqueSuspensa({ vencidos: ['ata_diretoria', 'alvara'] }), 'a ata da diretoria e o alvará venceram')
    assert.equal(porqueSuspensa({ vencidos: ['alvara'], nunca_vieram: ['alvara'] }), 'o alvará não veio')
    assert.equal(
      porqueSuspensa({ vencidos: ['estatuto', 'cartao_cnpj', 'ata_diretoria', 'alvara'], nunca_vieram: ['estatuto', 'cartao_cnpj', 'ata_diretoria', 'alvara'] }),
      '4 itens não vieram',
    )
    assert.equal(porqueSuspensa({ vencidos: ['estatuto', 'alvara'], nunca_vieram: ['estatuto'] }), 'o alvará venceu e o estatuto não veio')
  })

  it('a ficha separa, com os nomes, o que venceu do que nunca veio', () => {
    assert.deepEqual(separarVencidos({ vencidos: ['estatuto', 'alvara'], nunca_vieram: ['estatuto'] }), { venceram: ['alvara'], nuncaVieram: ['estatuto'] })
    assert.deepEqual(separarVencidos({ vencidos: ['ata_diretoria'] }), { venceram: ['ata_diretoria'], nuncaVieram: [] })
    assert.deepEqual(separarVencidos({ vencidos: [], nunca_vieram: [] }), { venceram: [], nuncaVieram: [] })
    assert.deepEqual(oQueSuspendeu({ vencidos: ['estatuto', 'alvara'], nunca_vieram: ['estatuto'] }), ['Venceu: Alvará de licenciamento', 'Não veio: Estatuto'])
    assert.deepEqual(oQueSuspendeu({ vencidos: ['ata_diretoria', 'alvara'] }), ['Venceu: Ata da diretoria, Alvará de licenciamento'])
  })

  it('a tolerância do alvará que vence em 31/12: o dia em que acaba', () => {
    assert.equal(fimDaTolerancia(31), '31/01')
    assert.equal(fimDaTolerancia(15), '15/01')
    assert.equal(fimDaTolerancia(45), '14/02')
    assert.equal(fimDaTolerancia(0), null)
  })
})
