// "De onde veio" no extrato do Caixa: o link leva a uma tela que quem está vendo abre, ou some (D-05).
// Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { linkDaOrigem, podeAbrir } from '../../src/telas/financeiro/origem.ts'

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

  it('o evento e a compra do patrimônio: quem vê o Caixa também abre Eventos e Patrimônio', () => {
    for (const perfis of [['tesouraria'], ['presidencia'], ['conselho_fiscal']] as const) {
      assert.equal(linkDaOrigem(`/eventos/${ID}`, perfis), `/eventos/${ID}`, perfis[0])
      assert.equal(linkDaOrigem('/patrimonio/bens', perfis), '/patrimonio/bens', perfis[0])
    }
  })

  it('a subfunção com perfis próprios conta: o Conselho Fiscal não abre o Caixa › Modelos exclusivos', () => {
    assert.equal(podeAbrir('/financeiro/caixa/modelos', ['tesouraria']), true)
    assert.equal(podeAbrir('/financeiro/caixa/modelos', ['conselho_fiscal']), false)
    assert.equal(podeAbrir('/financeiro/caixa', ['conselho_fiscal']), true)
    // o endereço com ?parâmetros vale pelo caminho
    assert.equal(podeAbrir(`/financeiro/contribuicoes?ministro=${ID}`, ['conselho_fiscal']), true)
    assert.equal(podeAbrir(`/ministros/${ID}/contribuicao`, ['tesouraria']), false)
  })
})
