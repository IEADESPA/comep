// "De onde veio" no extrato do Caixa: o link leva a uma tela que quem está vendo abre, ou some (D-05).
// Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { linkDaOrigem } from '../../src/telas/financeiro/origem.ts'

const ID = '0f8e2c3a-1b2c-4d5e-8f90-123456789abc'

describe('"De onde veio" no Caixa (D-05)', () => {
  it('a contribuição: a presidência abre a ficha do ministro; a tesouraria e o Conselho Fiscal, o ministro no Financeiro', () => {
    const link = `/ministros/${ID}/contribuicao`
    assert.equal(linkDaOrigem(link, ['presidencia']), link)
    assert.equal(linkDaOrigem(link, ['tesouraria']), `/financeiro/contribuicoes?ministro=${ID}`)
    assert.equal(linkDaOrigem(link, ['conselho_fiscal']), `/financeiro/contribuicoes?ministro=${ID}`)
  })

  it('o modelo exclusivo: a presidência abre Credenciais; a tesouraria, o Caixa › Modelos exclusivos; o Conselho Fiscal, só o texto', () => {
    const link = `/credenciais/modelos/${ID}/quem-recebe`
    assert.equal(linkDaOrigem(link, ['presidencia']), link)
    assert.equal(linkDaOrigem(link, ['tesouraria']), '/financeiro/caixa/modelos')
    assert.equal(linkDaOrigem(link, ['conselho_fiscal']), null)
  })

  it('o que já abre continua igual, e sem link fica sem link', () => {
    assert.equal(linkDaOrigem('/financeiro/caixa/transferencias', ['tesouraria']), '/financeiro/caixa/transferencias')
    assert.equal(linkDaOrigem(null, ['tesouraria']), null)
  })
})
