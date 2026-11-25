// Fase 4.1: datas, avisos de prazo (Art. 16), edital e reuniões repetidas. Rodar: npm test

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  avisosDaData,
  codigoDoQr,
  explicarMaioria,
  minimoAFavor,
  presentesDoFechamento,
  quorumPrimeiraChamada,
  oQueMudaNaConducao,
  codigoDaPortaria,
  textoDaAta,
  textoDaAtaParaWord,
  textoDoEditalParaWord,
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

  it('hoje, mas a hora já passou: avisa (também na reunião mensal)', () => {
    const agora = new Date('2026-11-13T20:00:00-03:00').getTime()
    assert.deepEqual(avisosDaData('reuniao_mensal', '2026-11-13T19:00:00-03:00', CONFIG, '2026-11-13', agora), ['O horário já passou.'])
    assert.deepEqual(avisosDaData('reuniao_mensal', '2026-11-13T21:00:00-03:00', CONFIG, '2026-11-13', agora), [])
  })

  it('se o estatuto mudar o dia mínimo da AGO, o aviso usa o número novo', () => {
    const avisos = avisosDaData('ago', '2027-04-05T19:00:00-03:00', { ...CONFIG, dia_minimo_ago: 10 }, '2026-11-13')
    assert.ok(avisos.some((a) => a.includes('em abril e outubro, a partir do dia 10')), avisos.join(' | '))
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

  it('reunião mensal: sem quórum de 1ª e 2ª chamada e sem a regra de votação', () => {
    const texto = textoDoEdital({
      tipo: 'reuniao_mensal',
      inicio: '2026-12-01T19:30:00-03:00',
      local: 'Igreja anfitriã',
      fundamento: '',
      pauta: [{ titulo: 'Oração e comunhão', descricao: null, deliberativo: false, maioria: null }],
      minutosSegundaChamada: 60,
      hoje: new Date('2026-11-13T15:00:00Z'),
    })
    assert.match(texto, /^EDITAL DE CONVOCAÇÃO — REUNIÃO MENSAL/)
    assert.match(texto, /reunião mensal, que será realizada terça-feira, 1 de dezembro de 2026, às 19h30, em Igreja anfitriã/)
    assert.doesNotMatch(texto, /chamada|Art\. 11/)
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

describe('quórum, maiorias e ata (Fase 4.3)', () => {
  it('metade mais um, arredondado para cima (pergunta 25); 3/5 e 2/3 dos votos válidos arredondam para cima', () => {
    assert.equal(quorumPrimeiraChamada(3), 3)
    assert.equal(quorumPrimeiraChamada(74), 38)
    assert.equal(quorumPrimeiraChamada(75), 39)
    assert.equal(minimoAFavor('tres_quintos', 23), 14)
    assert.equal(minimoAFavor('dois_tercos', 23), 16)
    assert.equal(minimoAFavor('simples', 23), null)
    assert.equal(explicarMaioria('tres_quintos', 23), '3/5 dos 23 votos válidos = 14 votos a favor')
    assert.equal(explicarMaioria('dois_tercos', 1), '2/3 do único voto válido = 1 voto a favor')
    // só abstenções: a conta não dá zero votos "suficientes"
    assert.equal(explicarMaioria('tres_quintos', 0), '3/5 dos votos válidos — sem votos a favor ou contra, não há aprovação')
  })

  it('a ata traz a instalação, cada item com o resultado e o desligamento', () => {
    const texto = textoDaAta({
      tipo: 'ago',
      inicio: '2027-04-22T19:00:00-03:00',
      local: 'Sede',
      chamada: 'primeira',
      aptos: 40,
      presentesAptos: 25,
      presentes: 28,
      pauta: [
        { id: 'a', ordem: 1, titulo: 'Balanço', deliberativo: true },
        { id: 'b', ordem: 2, titulo: 'Desligamento de Fulano', deliberativo: true },
        { id: 'c', ordem: 3, titulo: 'Informes', deliberativo: false },
      ],
      votos: [
        { pauta_id: 'a', maioria: 'simples', votantes: 25, a_favor: 20, contra: 2, abstencoes: 3, aprovada: true },
        { pauta_id: 'b', maioria: 'tres_quintos', votantes: 25, a_favor: 16, contra: 5, abstencoes: 4, aprovada: true, desligado: 'Fulano de Tal' },
      ],
    })
    assert.match(texto, /^ATA DA ASSEMBLEIA GERAL ORDINÁRIA/)
    assert.match(texto, /Em 22 de abril de 2027, às 19h00, em Sede/)
    assert.match(texto, /instalada em primeira chamada, com 25 associados aptos presentes, de 40 aptos \(28 presentes ao todo\)/)
    assert.match(texto, /1\. Balanço: APROVADO, com 20 votos a favor, 2 contra e 3 abstenções/)
    // 16 a favor e 5 contra: 21 votos válidos (as 4 abstenções não entram — pergunta 24)
    assert.match(texto, /3\/5 dos 21 votos válidos = 13 votos a favor\)\. Fica desligado\(a\) do COMEP: Fulano de Tal/)
    assert.match(texto, /3\. Informes: \(informe/)
    assert.match(texto, /Parauapebas, 22 de abril de 2027\./)
  })
})

describe('o texto para o Word e a portaria (parte 14)', () => {
  const base = {
    tipo: 'ago' as const,
    inicio: '2027-04-28T19:00:00-03:00',
    local: 'Sede',
    chamada: 'primeira' as const,
    aptos: 66,
    presentesAptos: 38,
    presentes: 40,
    pauta: [{ id: 'a', ordem: 1, titulo: 'Prestação de contas de 2026', deliberativo: true }],
    votos: [{ pauta_id: 'a', maioria: 'simples' as const, votantes: 38, a_favor: 31, contra: 2, abstencoes: 1, aprovada: true }],
  }

  it('a ata para o Word: o resumo, os convidados, as resoluções válidas e o que completar entre colchetes', () => {
    const texto = textoDaAtaParaWord({
      ...base,
      convidados: ['Vereador (exemplo)'],
      resolucoes: [
        { numero: 1, ano: 2027, texto: 'Aprovada a prestação de contas de 2026.', anulada_em: null },
        { numero: 2, ano: 2027, texto: 'Anulada por engano.', anulada_em: '2027-04-28T20:00:00-03:00' },
      ],
    })
    assert.ok(texto.startsWith('[CABEÇALHO DO COMEP'), texto)
    assert.match(texto, /1\. Prestação de contas de 2026: APROVADO, com 31 votos a favor/)
    assert.match(texto, /convidados, sem direito a voto: Vereador \(exemplo\)\./)
    assert.match(texto, /Resolução nº 01\/2027: Aprovada a prestação de contas de 2026\./)
    assert.ok(!texto.includes('Anulada por engano'))
    assert.match(texto, /\[nome e qualificação do Presidente — completar no Word\]/)
    // o encerramento do resumo não se repete
    assert.equal(texto.split('Nada mais havendo a tratar').length, 2)
  })

  it('o edital para o Word leva o cabeçalho e a assinatura a completar', () => {
    const texto = textoDoEditalParaWord('EDITAL DE CONVOCAÇÃO\n\nTexto.', 'ago')
    assert.ok(texto.startsWith('[CABEÇALHO DO COMEP'))
    assert.ok(texto.endsWith('[nome e qualificação do Presidente — completar no Word]'))
  })

  it('o código da portaria: do endereço do QR ou digitado', () => {
    assert.equal(codigoDaPortaria('https://ieadespa.github.io/comep/teste/assembleias/abc?portaria=k7q2m9'), 'K7Q2M9')
    assert.equal(codigoDaPortaria(' K7Q2M9 '), 'K7Q2M9')
    assert.equal(codigoDaPortaria('https://ieadespa.github.io/comep/validar/abc'), null)
  })
})

describe('o número de presentes do fechamento (revisão da parte 14, achado 6)', () => {
  it('na assembleia, os presentes aptos contra os aptos; os em atraso à parte', () => {
    assert.equal(presentesDoFechamento({ assembleia: true, presentes: 1, presentesAptos: 0, aptos: 33 }), '0 de 33 aptos · 1 em atraso')
    assert.equal(presentesDoFechamento({ assembleia: true, presentes: 20, presentesAptos: 20, aptos: 33 }), '20 de 33 aptos')
    assert.equal(presentesDoFechamento({ assembleia: true, presentes: 22, presentesAptos: 20, aptos: 33 }), '20 de 33 aptos · 2 em atraso')
  })

  it('na reunião mensal, só quantos vieram', () => {
    assert.equal(presentesDoFechamento({ assembleia: false, presentes: 7, presentesAptos: 5, aptos: 33 }), '7')
  })
})

describe('o que ainda muda na condução (revisão da parte 14, achado 8: as mesmas travas do banco)', () => {
  const convocado = { situacao: 'convocado' as const, presenca_encerrada_em: null }
  const semAssinatura = { assinada_secretario_em: null, assinada_presidente_em: null }

  it('antes da ata, no encontro convocado: tudo muda', () => {
    assert.deepEqual(oQueMudaNaConducao(convocado, null), {
      roteiro: true,
      abertura: true,
      pauta: true,
      registrarConvidado: true,
      tirarConvidado: true,
      votacoes: true,
      travadoPelaAta: false,
    })
    assert.equal(oQueMudaNaConducao(convocado, semAssinatura).travadoPelaAta, false)
  })

  it('depois da primeira assinatura (do secretário ou do presidente), nada do que vai para a ata muda', () => {
    for (const ata of [
      { assinada_secretario_em: '2027-04-28T22:00:00Z', assinada_presidente_em: null },
      { assinada_secretario_em: null, assinada_presidente_em: '2027-04-28T22:00:00Z' },
    ]) {
      assert.deepEqual(oQueMudaNaConducao(convocado, ata), {
        roteiro: false,
        abertura: false,
        pauta: false,
        registrarConvidado: false,
        tirarConvidado: false,
        votacoes: false,
        travadoPelaAta: true,
      })
    }
  })

  it('encerrada a lista (realizado): o roteiro ainda anda e o convidado ainda sai, mas não entra pauta, abertura nem convidado', () => {
    const r = oQueMudaNaConducao({ situacao: 'realizado', presenca_encerrada_em: '2027-04-28T23:00:00Z' }, semAssinatura)
    assert.equal(r.roteiro, true)
    assert.equal(r.tirarConvidado, true)
    assert.equal(r.abertura, false)
    assert.equal(r.pauta, false)
    assert.equal(r.registrarConvidado, false)
  })
})
