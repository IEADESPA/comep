// Telas novas (Fase 5.5): as datas do Início e do sino e os módulos agrupados por assunto. Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dataPorExtenso, diaEMes, horaCurta, quandoFoi, saudacaoDaHora } from '../../src/utilitarios/formatos.ts'
import { ITENS_MENU, modulosDoInicio, moduloAberto } from '../../src/componentes/menu.ts'

describe('datas no fuso de Parauapebas', () => {
  it('a saudação segue a hora de Parauapebas (UTC-3), não a do computador', () => {
    assert.equal(saudacaoDaHora(new Date('2026-11-17T10:00:00Z')), 'Bom dia') // 7h
    assert.equal(saudacaoDaHora(new Date('2026-11-17T15:00:00Z')), 'Boa tarde') // 12h
    assert.equal(saudacaoDaHora(new Date('2026-11-17T21:00:00Z')), 'Boa noite') // 18h
    assert.equal(saudacaoDaHora(new Date('2026-11-18T02:00:00Z')), 'Boa noite') // 23h do dia 17
  })

  it('a data por extenso começa com maiúscula', () => {
    assert.equal(dataPorExtenso(new Date('2026-11-17T15:00:00Z')), 'Terça-feira, 17 de novembro')
  })

  it('a caixinha da agenda e a hora curta', () => {
    assert.deepEqual(diaEMes('2027-04-28T22:30:00Z'), { dia: '28', mes: 'ABR' })
    assert.equal(horaCurta('2027-04-28T22:30:00Z'), '19h30')
    assert.equal(horaCurta('2027-04-28T11:00:00Z'), '8h')
  })

  it('há quanto tempo, para o sino', () => {
    const agora = new Date('2026-11-17T18:00:00Z') // 15h em Parauapebas
    assert.equal(quandoFoi('2026-11-17T17:58:00Z', agora), 'agora há pouco')
    assert.equal(quandoFoi('2026-11-17T17:30:00Z', agora), 'há 30 min')
    assert.equal(quandoFoi('2026-11-17T16:00:00Z', agora), 'há 2 h')
    assert.equal(quandoFoi('2026-11-16T20:00:00Z', agora), 'ontem')
    assert.equal(quandoFoi('2026-11-15T13:00:00Z', agora), '15/11')
  })
})

describe('os módulos na página inicial', () => {
  it('a diretoria vê todos os módulos em algum grupo (nenhum fica sem caminho)', () => {
    const { grupos, administracao } = modulosDoInicio(['presidencia', 'ministro', 'presidente_igreja'])
    const caminhos = new Set([...grupos.flatMap((g) => g.modulos), ...administracao].map((m) => m.caminho))
    for (const item of ITENS_MENU) {
      // o cadastro da igreja pelo pastor se abre pelo convite do Início, não pela grade dos módulos
      if (['/painel', '/meu-perfil', '/meu-pedido', '/cadastrar-minha-igreja'].includes(item.caminho)) continue
      assert.ok(caminhos.has(item.caminho), item.caminho)
    }
  })

  it('o ministro vê os grupos do ministro, sem os módulos da diretoria', () => {
    const { grupos, administracao } = modulosDoInicio(['ministro'])
    assert.deepEqual(
      grupos.map((g) => g.titulo),
      ['Pessoal', 'Assembleias', 'Eventos e avisos', 'O Conselho'],
    )
    const caminhos = grupos.flatMap((g) => g.modulos).map((m) => m.caminho)
    assert.ok(caminhos.includes('/assembleias/pedidos'))
    assert.ok(!caminhos.includes('/ministros'))
    assert.ok(!caminhos.includes('/minha-igreja'))
    assert.equal(administracao.length, 0)
  })

  it('o pastor presidente ganha o grupo "Minha igreja" (com o patrimônio)', () => {
    const { grupos } = modulosDoInicio(['presidente_igreja'])
    const minhaIgreja = grupos.find((g) => g.titulo === 'Minha igreja')
    assert.deepEqual(
      minhaIgreja?.modulos.map((m) => m.caminho),
      ['/minha-igreja', '/patrimonio'],
    )
  })

  it('quem não tem perfil não vê módulo nenhum', () => {
    const { grupos, administracao } = modulosDoInicio([])
    assert.equal(grupos.length + administracao.length, 0)
  })

  it('o módulo aberto (menu curto): o próprio e as telas de dentro; nada no Início e no Meu perfil', () => {
    assert.equal(moduloAberto('/ministros/123')?.titulo, 'Ministros')
    assert.equal(moduloAberto('/assembleias/pedidos/9')?.titulo, 'Assembleias')
    assert.equal(moduloAberto('/painel'), null)
    assert.equal(moduloAberto('/meu-perfil'), null)
    assert.equal(moduloAberto('/minhas-mensalidades')?.titulo, 'Minhas mensalidades')
  })
})
