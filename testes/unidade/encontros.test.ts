// Fase 4.1: datas, avisos de prazo (Art. 16), edital e reuniões repetidas. Rodar: npm test

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  avisosDaData,
  codigoDoQr,
  doCampoDataHora,
  mesmasDatasNosProximosMeses,
  nomesDosMeses,
  paraCampoDataHora,
  textoDoEdital,
} from '../../src/utilitarios/encontros.ts'

const CONFIG = { antecedencia_dias: 30, meses_ago: [4, 10], dia_minimo_ago: 16, minutos_segunda_chamada: 60, faltas_aviso: 2, faltas_pauta: 3 }

describe('datas no fuso de Parauapebas', () => {
  it('campo ↔ instante, sem depender do fuso do computador', () => {
    assert.equal(doCampoDataHora('2027-04-20T19:00'), '2027-04-20T19:00:00-03:00')
    assert.equal(paraCampoDataHora('2027-04-20T22:00:00Z'), '2027-04-20T19:00')
    assert.equal(paraCampoDataHora('2027-04-21T01:30:00Z'), '2027-04-20T22:30')
  })
})

describe('avisos da data (Art. 16)', () => {
  it('assembleia com menos de 30 dias: diz a partir de quando pode', () => {
    const avisos = avisosDaData('age', '2026-12-01T19:00:00-03:00', CONFIG, '2026-11-13')
    assert.ok(avisos[0].includes('a partir de 13/12/2026'), avisos[0])
  })

  it('com prazo: diz até quando convocar', () => {
    const avisos = avisosDaData('ago', '2027-04-20T19:00:00-03:00', CONFIG, '2026-11-13')
    assert.deepEqual(avisos, ['Para esta data, a convocação precisa ser publicada até 21/03/2027.'])
  })

  it('AGO fora da 2ª quinzena de abril ou outubro', () => {
    const avisos = avisosDaData('ago', '2027-04-10T19:00:00-03:00', CONFIG, '2026-11-13')
    assert.ok(avisos.some((a) => a.includes('2ª quinzena de abril e outubro')))
  })

  it('reunião mensal não tem prazo; data passada avisa', () => {
    assert.deepEqual(avisosDaData('reuniao_mensal', '2026-11-14T19:00:00-03:00', CONFIG, '2026-11-13'), [])
    assert.deepEqual(avisosDaData('ago', '2026-11-01T19:00:00-03:00', CONFIG, '2026-11-13'), ['A data já passou.'])
  })

  it('nomes dos meses', () => {
    assert.equal(nomesDosMeses([10, 4]), 'abril e outubro')
    assert.equal(nomesDosMeses([3, 6, 9]), 'março, junho e setembro')
  })
})

describe('edital', () => {
  it('tem o tipo, a data por extenso, o local, a 2ª chamada, a pauta numerada e o Art. 11', () => {
    const texto = textoDoEdital({
      tipo: 'age',
      inicio: '2027-01-14T19:00:00-03:00',
      local: 'Sede do COMEP',
      fundamento: 'Conselho Diretor (reunião de 10/11/2026)',
      pauta: [
        { titulo: 'Reforma do estatuto', descricao: null, deliberativo: true, maioria: 'dois_tercos' },
        { titulo: ' ', descricao: null, deliberativo: false, maioria: null },
      ],
      minutosSegundaChamada: 60,
      hoje: new Date('2026-11-13T15:00:00Z'),
    })
    assert.match(texto, /^EDITAL DE CONVOCAÇÃO — ASSEMBLEIA GERAL EXTRAORDINÁRIA/)
    assert.match(texto, /quinta-feira, 14 de janeiro de 2027, às 19h00/)
    assert.match(texto, /em segunda chamada, 60 minutos depois/)
    assert.match(texto, /\n1\. Reforma do estatuto\n\n/)
    assert.match(texto, /a pedido de: Conselho Diretor/)
    assert.match(texto, /Art\. 11/)
    assert.match(texto, /Parauapebas, 13 de novembro de 2026\./)
  })
})

describe('reuniões mensais repetidas', () => {
  it('mesmo dia da semana, na mesma semana do mês', () => {
    // 03/11/2026 é a 1ª terça de novembro
    assert.deepEqual(mesmasDatasNosProximosMeses('2026-11-03T19:30:00-03:00', 3), [
      '2026-12-01T19:30:00-03:00',
      '2027-01-05T19:30:00-03:00',
      '2027-02-02T19:30:00-03:00',
    ])
  })

  it('5ª semana que não existe no mês: usa a última', () => {
    // 31/12/2026 é a 5ª quinta de dezembro; fevereiro de 2027 não tem 5ª quinta (usa 25/02)
    const datas = mesmasDatasNosProximosMeses('2026-12-31T19:00:00-03:00', 2)
    assert.deepEqual(datas, ['2027-01-28T19:00:00-03:00', '2027-02-25T19:00:00-03:00'])
  })
})

describe('QR Code da credencial (check-in)', () => {
  it('tira o código do endereço de validação (de qualquer site) ou do código puro', () => {
    const codigo = '0123456789abcdef0123456789abcdef'
    assert.equal(codigoDoQr(`https://ieadespa.github.io/comep/teste/validar/${codigo}`), codigo)
    assert.equal(codigoDoQr(` ${codigo} `), codigo)
    assert.equal(codigoDoQr('https://exemplo.com/validar/123'), null)
    assert.equal(codigoDoQr('texto qualquer'), null)
  })
})
