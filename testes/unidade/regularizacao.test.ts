// A regularização das igrejas (Fase 5.5, parte 5): o fim do mandato, o menor mandato, os prazos e a localização
// tirada do link do Google Maps. Rodar: npm test
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  coordenadasDoLink,
  diasEntre,
  fimDoMandato,
  menorMandato,
  somarDias,
  tamanhoDoArquivo,
  tempoQueFalta,
  textoDoPrazo,
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
