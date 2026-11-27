// A regularização das igrejas (Fase 5.5, parte 5): o fim do mandato, o menor mandato, os prazos e a localização
// tirada do link do Google Maps. Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  coordenadasDoLink,
  diasEntre,
  diasParaMandar,
  documentoDoItem,
  fraseParaMandar,
  fimDoMandato,
  listaCurta,
  menorMandato,
  somarDias,
  tamanhoDoArquivo,
  tempoQueFalta,
  textoDoPrazo,
  textoDosDiasParaMandar,
  vencimentoMaisProximo,
} from '../../src/utilitarios/regularizacao.ts'

describe('o mandato da diretoria', () => {
  it('o fim é a posse mais os anos, menos um dia', () => {
    assert.equal(fimDoMandato('2025-01-01', 4), '2028-12-31')
    assert.equal(fimDoMandato('2026-03-01', 2), '2028-02-29')
    assert.equal(fimDoMandato('2029-01-01', 4), '2032-12-31')
    assert.equal(fimDoMandato('2024-02-29', 1), '2025-02-28')
  })

  it('vale o MENOR mandato; sem as datas de algum cargo, não há validade', () => {
    assert.equal(
      menorMandato([
        { inicio: '2024-01-01', fim: '2027-12-31' },
        { inicio: '2024-01-01', fim: '2026-12-31' },
        { inicio: '2024-01-01', fim: '2038-12-31' },
      ]),
      '2026-12-31',
    )
    assert.equal(menorMandato([{ inicio: '2024-01-01', fim: '' }]), null)
    assert.equal(menorMandato([]), null)
  })
})

describe('os prazos', () => {
  it('conta os dias entre duas datas e soma dias', () => {
    assert.equal(diasEntre('2026-11-18', '2026-12-31'), 43)
    assert.equal(diasEntre('2027-01-01', '2026-12-31'), -1)
    assert.equal(somarDias('2027-01-01', 29), '2027-01-30')
    assert.equal(somarDias('2026-12-31', 1), '2027-01-01')
  })

  it('o texto do prazo e o tempo que falta, do jeito de falar', () => {
    assert.equal(textoDoPrazo('2026-11-18', '2026-12-31'), 'faltam 43 dias')
    assert.equal(textoDoPrazo('2026-12-30', '2026-12-31'), 'falta 1 dia')
    assert.equal(textoDoPrazo('2026-12-31', '2026-12-31'), 'vence hoje')
    assert.equal(textoDoPrazo('2027-01-01', '2026-12-31'), 'venceu ontem')
    assert.equal(textoDoPrazo('2027-01-04', '2026-12-31'), 'venceu há 4 dias')
    assert.equal(tempoQueFalta('2026-11-18', '2026-12-31'), '43 dias')
    assert.equal(tempoQueFalta('2026-11-18', '2028-12-31'), '2 anos e 1 mês')
    assert.equal(tempoQueFalta('2026-11-18', '2027-05-18'), '5 meses')
  })

  it('a igreja suspensa: os dias para mandar contam o dia de hoje (D-12)', () => {
    // o documento venceu em D = 31/12/2026: suspensa desde D+1 (01/01/2027), prazo até D+30 (30/01/2027)
    const prazo = '2027-01-30'
    // D+1, o dia da suspensão: 30 dias
    assert.equal(diasParaMandar('2027-01-01', prazo), 30)
    assert.equal(textoDosDiasParaMandar('2027-01-01', prazo), 'faltam 30 dias')
    assert.equal(fraseParaMandar('2027-01-01', prazo, 'o estatuto'), 'faltam 30 dias para mandar o estatuto')
    // D+29, a véspera do prazo: 2 dias
    assert.equal(diasParaMandar('2027-01-29', prazo), 2)
    assert.equal(fraseParaMandar('2027-01-29', prazo), 'faltam 2 dias para mandar')
    // D+30, o dia do prazo: o último dia
    assert.equal(diasParaMandar('2027-01-30', prazo), 1)
    assert.equal(textoDosDiasParaMandar('2027-01-30', prazo), 'último dia')
    assert.equal(fraseParaMandar('2027-01-30', prazo, 'o estatuto'), 'último dia para mandar o estatuto')
    // D+31, o bloqueio: acabou
    assert.equal(diasParaMandar('2027-01-31', prazo), 0)
    assert.equal(textoDosDiasParaMandar('2027-01-31', prazo), 'prazo encerrado')
    assert.equal(fraseParaMandar('2027-01-31', prazo), 'acabou o prazo para mandar')
  })

  it('o tamanho do arquivo em KB ou MB, com vírgula', () => {
    assert.equal(tamanhoDoArquivo(2_202_009), '2,1 MB')
    assert.equal(tamanhoDoArquivo(184_320), '180 KB')
  })
})

describe('a localização da filial, pelo link do Google Maps', () => {
  it('lê o link do navegador, o de "compartilhar" com q= e as coordenadas coladas', () => {
    assert.deepEqual(coordenadasDoLink('https://www.google.com/maps/place/Parauapebas/@-6.0679123,-49.9022456,15z'), {
      latitude: -6.067912,
      longitude: -49.902246,
    })
    assert.deepEqual(coordenadasDoLink('https://maps.google.com/?q=-6.0679,-49.9022'), { latitude: -6.0679, longitude: -49.9022 })
    assert.deepEqual(coordenadasDoLink('https://www.google.com/maps/place/x/data=!3d-6.0701!4d-49.8911'), { latitude: -6.0701, longitude: -49.8911 })
    assert.deepEqual(coordenadasDoLink(' -6.0679, -49.9022 '), { latitude: -6.0679, longitude: -49.9022 })
  })

  it('sem coordenadas (o link curto ou um endereço), não inventa', () => {
    assert.equal(coordenadasDoLink('https://maps.app.goo.gl/AbCdEf123'), null)
    assert.equal(coordenadasDoLink('Rua das Flores, 100'), null)
    assert.equal(coordenadasDoLink('-96.1, -49.9'), null)
  })
})

describe('os avisos (parte 6)', () => {
  const base = { situacao: 'regular' as const, vencidos: [], pendencias: [], perfil_bloqueado: false }

  it('o que vence primeiro: o alvará, a ata, a natureza ou o que falta (o alvará na tolerância de janeiro)', () => {
    assert.deepEqual(vencimentoMaisProximo({ ...base, alvara_ate: '2026-12-31', mandato_ate: '2028-12-31', proximo_vencimento: '2026-12-31' }), {
      item: 'alvara',
      ate: '2026-12-31',
    })
    assert.deepEqual(vencimentoMaisProximo({ ...base, alvara_ate: '2027-12-31', mandato_ate: '2026-12-01', proximo_vencimento: '2026-12-01' }), {
      item: 'ata_diretoria',
      ate: '2026-12-01',
    })
    assert.deepEqual(vencimentoMaisProximo({ ...base, pendencias: ['alvara'], proximo_vencimento: '2028-01-31' }), { item: 'alvara', ate: '2028-01-31' })
    // suspensa, o aviso é outro (a contagem dos 30 dias)
    assert.equal(vencimentoMaisProximo({ ...base, situacao: 'suspensa', proximo_vencimento: '2026-12-31' }), null)
  })

  it('a natureza se resolve com o Cartão CNPJ novo; a lista curta no meio da frase', () => {
    assert.equal(documentoDoItem('natureza_juridica'), 'cartao_cnpj')
    assert.equal(documentoDoItem('alvara'), 'alvara')
    assert.equal(listaCurta(['alvara']), 'o alvará')
    assert.equal(listaCurta(['estatuto', 'alvara']), 'o estatuto e o alvará')
    assert.equal(listaCurta(['estatuto', 'cartao_cnpj', 'alvara']), '3 itens')
  })
})
