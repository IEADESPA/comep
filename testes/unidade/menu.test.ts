// Telas novas (Fase 5.5): o menu de cada módulo ("o módulo toma a coluna", aprovado em 18/11/2026).
// Cada função liga a um endereço que existe; o endereço aberto acende a função certa. Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { funcoesVisiveis, ITENS_MENU, localizar, MODULOS } from '../../src/componentes/menu.ts'
import { iniciaisDe, numeroDoRegistro } from '../../src/utilitarios/formatos.ts'

const onde = (caminho: string) => {
  const l = localizar(caminho)
  return l ? [l.modulo.chave, l.funcao?.chave ?? null, l.subfuncao?.titulo ?? null] : null
}

describe('o menu do módulo', () => {
  it('cada módulo e cada função usam um item do menu que existe', () => {
    for (const m of MODULOS) {
      assert.ok(ITENS_MENU.some((i) => i.caminho === m.item), m.titulo)
      for (const f of m.funcoes) {
        if (f.item) assert.ok(ITENS_MENU.some((i) => i.caminho === f.item), `${m.titulo} › ${f.titulo}`)
      }
    }
  })

  it('Ministros e inscrições: a ficha é de Ministros; o cadastro, as correções e os pedidos têm a função própria', () => {
    assert.deepEqual(onde('/ministros'), ['ministros', 'ministros', null])
    assert.deepEqual(onde('/ministros/0a1b'), ['ministros', 'ministros', null])
    assert.deepEqual(onde('/ministros/0a1b/acesso'), ['ministros', 'ministros', null])
    assert.deepEqual(onde('/ministros/novo'), ['ministros', 'cadastrar', null])
    assert.deepEqual(onde('/ministros/correcoes'), ['ministros', 'correcoes', null])
    assert.deepEqual(onde('/inscricoes'), ['ministros', 'pedidos', null])
    assert.deepEqual(onde('/inscricoes/9z'), ['ministros', 'pedidos', null])
  })

  it('as subfunções: a mais específica acende', () => {
    assert.deepEqual(onde('/financeiro/contribuicoes'), ['financeiro', 'contribuicoes', 'Situação dos ministros'])
    assert.deepEqual(onde('/financeiro/contribuicoes/cobrancas'), ['financeiro', 'contribuicoes', 'Cobranças do ano'])
    assert.deepEqual(onde('/financeiro/caixa'), ['financeiro', 'caixa', 'Lançamentos'])
    assert.deepEqual(onde('/financeiro/caixa/contas'), ['financeiro', 'caixa', 'Contas e saldos'])
    assert.deepEqual(onde('/financeiro/prestacao/mes-a-mes'), ['financeiro', 'prestacao', 'Mês a mês'])
    assert.deepEqual(onde('/financeiro/orcamento/plano'), ['financeiro', 'orcamento', 'Plano anual de trabalho'])
  })

  it('o começo do módulo (que leva à primeira função) já é do módulo, sem função acesa', () => {
    assert.deepEqual(onde('/financeiro'), ['financeiro', null, null])
    assert.deepEqual(onde('/patrimonio'), ['patrimonio', null, null])
    assert.deepEqual(onde('/patrimonio/emprestimos/5'), ['patrimonio', 'pedidos', null])
  })

  it('assembleias: os pedidos de AGE e as faltas não se confundem com uma assembleia aberta', () => {
    assert.deepEqual(onde('/assembleias/abc/presenca'), ['assembleias', 'encontros', null])
    assert.deepEqual(onde('/assembleias/pedidos/7'), ['assembleias', 'pedidos', null])
    assert.deepEqual(onde('/assembleias/faltas'), ['assembleias', 'faltas', null])
    assert.deepEqual(onde('/assembleias/presenca/abc/portaria'), ['assembleias', 'presenca', null])
    assert.deepEqual(onde('/assembleias/conducao/abc'), ['assembleias', 'conducao', null])
    assert.deepEqual(onde('/assembleias/fechamento'), ['assembleias', 'fechamento', null])
  })

  it('fora dos módulos: Início, Módulos, Meu perfil e as telas pessoais ficam com o menu curto', () => {
    for (const caminho of ['/painel', '/modulos', '/meu-perfil', '/meu-perfil/senha', '/minha-credencial', '/minhas-mensalidades', '/minha-igreja/agenda', '/meu-pedido']) {
      assert.equal(localizar(caminho), null, caminho)
    }
  })

  it('cada um vê só as funções do seu perfil', () => {
    const financeiro = MODULOS.find((m) => m.chave === 'financeiro')!
    assert.ok(funcoesVisiveis(financeiro, ['tesouraria']).some((f) => f.chave === 'comprovantes'))
    assert.ok(!funcoesVisiveis(financeiro, ['conselho_fiscal']).some((f) => f.chave === 'comprovantes'))
    assert.equal(funcoesVisiveis(financeiro, ['ministro']).length, 0)

    const assembleias = MODULOS.find((m) => m.chave === 'assembleias')!
    assert.deepEqual(
      funcoesVisiveis(assembleias, ['ministro']).map((f) => f.chave),
      ['encontros', 'pedidos'],
    )
    // parte 14: presença, condução e fechamento entram como funções (as 7 do desenho)
    assert.deepEqual(
      funcoesVisiveis(assembleias, ['secretaria']).map((f) => f.chave),
      ['encontros', 'preparar', 'presenca', 'conducao', 'fechamento', 'faltas', 'pedidos'],
    )

    const patrimonio = MODULOS.find((m) => m.chave === 'patrimonio')!
    assert.ok(funcoesVisiveis(patrimonio, ['presidente_igreja']).some((f) => f.chave === 'pedir'))
    assert.ok(!funcoesVisiveis(patrimonio, ['conselho_fiscal']).some((f) => f.chave === 'pedir'))

    const administracao = MODULOS.find((m) => m.chave === 'administracao')!
    assert.deepEqual(
      funcoesVisiveis(administracao, ['tesouraria']).map((f) => f.chave),
      ['configuracoes'],
    )
  })

  it('as subfunções com perfis próprios: o Caixa › Modelos exclusivos é da tesouraria e da presidência (D-07)', () => {
    const financeiro = MODULOS.find((m) => m.chave === 'financeiro')!
    const subsDoCaixa = (perfis: Parameters<typeof funcoesVisiveis>[1]) =>
      (funcoesVisiveis(financeiro, perfis).find((f) => f.chave === 'caixa')?.subfuncoes ?? []).map((s) => s.caminho)
    assert.ok(subsDoCaixa(['tesouraria']).includes('/financeiro/caixa/modelos'))
    assert.ok(subsDoCaixa(['presidencia']).includes('/financeiro/caixa/modelos'))
    // o Conselho Fiscal vê o Caixa (só leitura), mas não a subfunção de receber o pagamento
    assert.ok(subsDoCaixa(['conselho_fiscal']).includes('/financeiro/caixa'))
    assert.ok(!subsDoCaixa(['conselho_fiscal']).includes('/financeiro/caixa/modelos'))
    // a lista do módulo não muda (a cópia filtrada é só de quem vê)
    assert.ok(financeiro.funcoes.find((f) => f.chave === 'caixa')!.subfuncoes!.some((s) => s.caminho === '/financeiro/caixa/modelos'))
  })
})

describe('a tabela dos ministros', () => {
  it('as iniciais deixam de fora o título abreviado', () => {
    assert.equal(iniciaisDe('Pr. Marcos Antônio Lima'), 'ML')
    assert.equal(iniciaisDe('Ana'), 'A')
    assert.equal(iniciaisDe('  ev.  Samuel Pires '), 'SP')
  })

  it('o nº de registro com quatro algarismos', () => {
    assert.equal(numeroDoRegistro(42), '0042')
    assert.equal(numeroDoRegistro(12345), '12345')
  })
})
