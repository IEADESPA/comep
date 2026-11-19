// Testes do modelo (desenho) da credencial: conferência do que vem do banco/editor e preenchimento dos dados.
// Rodar: npm test

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  abreviacoesDoNome,
  ALTURA_MM,
  anosDeComep,
  CARTAO_PADRAO,
  conferirModelo,
  desenhoDoModelo,
  MODELO_READEQUACAO,
  modeloDaCredencial,
  posicaoDaFaixa,
  posicionarFaixa,
  PRONTOS,
  DADOS_EXEMPLO,
  ITENS_NOVOS,
  LARGURA_MM,
  limitarCaixa,
  MAXIMO_ELEMENTOS,
  MODELO_PADRAO,
  nomeDoElemento,
  normalizarModelo,
  novoElemento,
  novoId,
  preencher,
  valoresDaCredencial,
  type ElementoTexto,
} from '../../src/utilitarios/modeloCredencial.ts'

describe('modelo padrão', () => {
  it('passa pela própria conferência sem mudar nada', () => {
    assert.deepEqual(normalizarModelo(MODELO_PADRAO), MODELO_PADRAO)
  })

  it('tudo fica dentro do cartão (85,6 × 53,98 mm) e os ids não se repetem', () => {
    for (const lado of ['frente', 'verso'] as const) {
      const ids = new Set<string>()
      for (const e of MODELO_PADRAO[lado].elementos) {
        assert.ok(e.x >= 0 && e.y >= 0, `${lado}/${e.id} começa dentro`)
        assert.ok(e.x + e.w <= LARGURA_MM + 0.01, `${lado}/${e.id} cabe na largura`)
        assert.ok(e.y + e.h <= ALTURA_MM + 0.01, `${lado}/${e.id} cabe na altura`)
        assert.ok(!ids.has(e.id), `${lado}/${e.id} repetido`)
        ids.add(e.id)
      }
    }
  })

  it('a foto é 3×4 (largura/altura = 0,75)', () => {
    const foto = MODELO_PADRAO.frente.elementos.find((e) => e.tipo === 'foto')
    assert.ok(foto)
    assert.equal(Math.round((foto.w / foto.h) * 100) / 100, 0.75)
  })

  it('o nome é uma linha só (a letra diminui para caber)', () => {
    const nome = MODELO_PADRAO.frente.elementos.find((e) => e.tipo === 'texto' && e.texto === '{nome}') as ElementoTexto
    assert.equal(nome.quebrar, false)
  })

  it('a frente mostra a validade', () => {
    assert.ok(MODELO_PADRAO.frente.elementos.some((e) => e.tipo === 'texto' && e.texto.includes('{validade}')))
  })
})

describe('normalizarModelo (o que vem do banco ou do editor)', () => {
  it('sem modelo, ou de outra versão: usa o padrão', () => {
    assert.deepEqual(normalizarModelo(null), MODELO_PADRAO)
    assert.deepEqual(normalizarModelo('lixo'), MODELO_PADRAO)
    assert.deepEqual(normalizarModelo({ versao: 2, frente: { elementos: [] } }), MODELO_PADRAO)
  })

  it('o padrão devolvido é uma cópia (mexer nele não estraga o original)', () => {
    const m = normalizarModelo(null)
    m.frente.elementos.pop()
    assert.notEqual(m.frente.elementos.length, MODELO_PADRAO.frente.elementos.length)
  })

  it('corrige cores, números, opções e o arquivo da imagem; descarta tipos desconhecidos', () => {
    const m = normalizarModelo({
      versao: 1,
      frente: {
        fundo: 'red; background: url(x)',
        elementos: [
          { id: 'a', tipo: 'texto', x: 500, y: -99, w: 0, h: 'x', texto: 7, tamanho: 999, peso: 900, cor: 'blue', alinhamento: 'meio' },
          { id: 'b', tipo: 'script', x: 1 },
          { id: 'c', tipo: 'imagem', arquivo: 'https://exemplo.com/x.png' },
          { id: 'd', tipo: 'forma', cor: '#ABCDEF', cor2: 'nada', opacidade: 7 },
          'não é objeto',
        ],
      },
      verso: { elementos: [] },
    })
    assert.equal(m.frente.fundo, '#ffffff')
    assert.equal(m.frente.elementos.length, 3)
    const [a, c, d] = m.frente.elementos
    assert.equal(a.tipo, 'texto')
    if (a.tipo === 'texto') {
      assert.equal(a.x, LARGURA_MM)
      assert.equal(a.y, -20)
      assert.equal(a.w, 0.2)
      assert.equal(a.h, 5)
      assert.equal(a.texto, '')
      assert.equal(a.tamanho, 40)
      assert.equal(a.peso, 400)
      assert.equal(a.cor, '#18181b')
      assert.equal(a.alinhamento, 'esquerda')
    }
    assert.ok(c.tipo === 'imagem' && c.arquivo === 'logo', 'endereço de fora vira o logo')
    assert.ok(d.tipo === 'forma' && d.cor === '#abcdef' && d.cor2 === '#18181b' && d.opacidade === 1)
    assert.deepEqual(m.verso.elementos, [])
  })

  it('ids repetidos ou inválidos ganham outro; no máximo 60 itens por lado', () => {
    const muitos = Array.from({ length: 80 }, () => ({ id: 'x', tipo: 'qr' }))
    const m = normalizarModelo({ versao: 1, frente: { elementos: [...muitos, { id: '<b>', tipo: 'foto' }] }, verso: {} })
    assert.equal(m.frente.elementos.length, MAXIMO_ELEMENTOS)
    assert.equal(new Set(m.frente.elementos.map((e) => e.id)).size, MAXIMO_ELEMENTOS)
    assert.deepEqual(m.verso, MODELO_PADRAO.verso, 'lado sem lista de itens: o padrão')
  })
})

describe('dados na credencial', () => {
  const valores = valoresDaCredencial(DADOS_EXEMPLO, 'Texto do verso')

  it('formata CPF, CNPJ, número e datas', () => {
    assert.equal(valores.cpf, '123.456.789-09')
    assert.equal(valores.cnpj, 'ZZ.ZZZ.ZZZ/0001-00')
    assert.equal(valores.numero, '1234')
    assert.equal(valores.desde, '01/06/2021')
    assert.equal(valores.validade, '31/12/2029')
    assert.equal(valores.igreja, 'IEADMEP')
    assert.equal(valores.titulo_funcao, 'Pastor(a) · Pastor(a) presidente da congregação')
  })

  it('dado obrigatório que falta aparece como "—"; o pai, se não houver, fica em branco', () => {
    const v = valoresDaCredencial(
      { ...DADOS_EXEMPLO, cpf: null, nome_pai: null, nome_mae: null, igreja_cnpj: null, valida_ate: null, numero_registro: 7 },
      '',
    )
    assert.equal(v.cpf, '—')
    assert.equal(v.mae, '—')
    assert.equal(v.cnpj, '—')
    assert.equal(v.pai, '')
    assert.equal(v.validade, 'enquanto ativo')
    assert.equal(v.numero, '0007')
  })

  it('preencher troca as chaves conhecidas e deixa as desconhecidas à vista', () => {
    assert.equal(preencher('Nº {numero} · {cpf}', valores), 'Nº 1234 · 123.456.789-09')
    assert.equal(preencher('{nao_existe} {constructor}', valores), '{nao_existe} {constructor}')
    assert.equal(preencher('{texto_verso}', valores), 'Texto do verso')
  })
})

describe('editor: itens novos e conferência', () => {
  it('cada item novo já passa pela conferência e fica dentro do cartão', () => {
    for (const { tipo } of ITENS_NOVOS) {
      const e = novoElemento(tipo, `novo-${tipo}`)
      const m = normalizarModelo({ versao: 1, frente: { fundo: '#ffffff', elementos: [e] }, verso: { fundo: '#ffffff', elementos: [] } })
      assert.deepEqual(m.frente.elementos[0], e, tipo)
      assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= LARGURA_MM && e.y + e.h <= ALTURA_MM, tipo)
    }
  })

  it('o modelo padrão não tem avisos', () => {
    assert.deepEqual(conferirModelo(MODELO_PADRAO), [])
  })

  it('avisa: sem QR Code, sem foto, sem nome, sem validade, item fora do cartão, dado desconhecido, QR pequeno', () => {
    const avisos = conferirModelo({
      versao: 1,
      frente: { fundo: '#ffffff', elementos: [{ ...novoElemento('texto', 'a'), texto: 'Oi {apelido}', x: 80 }] },
      verso: { fundo: '#ffffff', elementos: [] },
    })
    for (const trecho of ['passa da borda', '{apelido}', 'QR Code', 'foto', 'nome', 'validade']) {
      assert.ok(avisos.some((a) => a.includes(trecho)), trecho)
    }
    const qrPequeno = conferirModelo({
      ...MODELO_PADRAO,
      verso: { fundo: '#ffffff', elementos: [{ ...novoElemento('qr', 'q'), w: 10, h: 10 }] },
    })
    assert.ok(qrPequeno.some((a) => a.includes('menos de 15 mm')))
  })

  it('na lista do editor, os dados aparecem pelo nome', () => {
    assert.equal(nomeDoElemento({ ...novoElemento('dado', 'd'), texto: 'Nº {numero}' }), '“Nº [Nº de registro]”')
    assert.equal(nomeDoElemento(novoElemento('linha', 'l')), 'Linha')
    assert.equal(nomeDoElemento(novoElemento('circulo', 'c')), 'Círculo')
  })
})

describe('revisão da Fase 3', () => {
  it('nome comprido: abrevia os do meio, do último para o primeiro; primeiro e último (com Júnior, Filho…) ficam', () => {
    assert.deepEqual(abreviacoesDoNome('Antonio Carlos Francisco das Chagas Nascimento de Oliveira'), [
      'Antonio Carlos Francisco das Chagas Nascimento de Oliveira',
      'Antonio Carlos Francisco das Chagas N. de Oliveira',
      'Antonio Carlos Francisco das C. N. de Oliveira',
      'Antonio Carlos F. das C. N. de Oliveira',
      'Antonio C. F. das C. N. de Oliveira',
      'Antonio C. F. C. N. Oliveira',
    ])
    const junior = abreviacoesDoNome('José da Silva Santos Júnior')
    assert.equal(junior.at(-1), 'José S. Santos Júnior')
    assert.deepEqual(abreviacoesDoNome('Maria Silva'), ['Maria Silva'])
  })

  it('id repetido feito de propósito não trava a conferência (antes: laço sem fim)', () => {
    const id = '-5'.repeat(20)
    const inicio = Date.now()
    const m = normalizarModelo({
      versao: 1,
      frente: { elementos: [{ id, tipo: 'qr' }, { id: 'a', tipo: 'qr' }, { id: 'b', tipo: 'qr' }, { id: 'c', tipo: 'qr' }, { id, tipo: 'qr' }] },
      verso: { elementos: [] },
    })
    assert.ok(Date.now() - inicio < 1000)
    assert.equal(new Set(m.frente.elementos.map((e) => e.id)).size, 5)
  })

  it('ids novos não repetem; posição e tamanho ficam dentro dos limites', () => {
    const lista = Array.from({ length: 50 }, () => ({ id: 'x' }))
    const ids = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const id = novoId([...lista, ...[...ids].map((x) => ({ id: x }))])
      assert.ok(!ids.has(id))
      ids.add(id)
    }
    assert.deepEqual(limitarCaixa({ x: -86.3, y: 999, w: 0, h: 500 }), { x: -20, y: ALTURA_MM, w: 0.2, h: 80 })
  })
})

describe('Fase 5.5 (parte 7): o tamanho do cartão, a readequação e os modelos prontos', () => {
  it('o modelo antigo (sem o tamanho) vira o cartão de crédito; o tamanho vem conferido', () => {
    const antigo = normalizarModelo({ versao: 1, frente: { fundo: '#ffffff', elementos: [] }, verso: { fundo: '#ffffff', elementos: [] } })
    assert.deepEqual(antigo.cartao, CARTAO_PADRAO)
    const cracha = normalizarModelo({ ...antigo, cartao: { largura: 53.98, altura: 85.6, cantos: 3, sangria: 99, seguranca: -1 } })
    assert.deepEqual(cracha.cartao, { largura: 53.98, altura: 85.6, cantos: 3, sangria: 5, seguranca: 0 })
    // no crachá em pé, um item pode descer até 85,6 mm
    const item = normalizarModelo({ ...cracha, frente: { fundo: '#ffffff', elementos: [{ id: 'a', tipo: 'qr', x: 5, y: 70, w: 20, h: 20 }] } })
    assert.equal(item.frente.elementos[0].y, 70)
  })

  it('o desenho vazio do modelo de readequação é o cinza com a faixa; o dos outros, o padrão', () => {
    assert.deepEqual(desenhoDoModelo('readequacao', null), MODELO_READEQUACAO)
    assert.deepEqual(desenhoDoModelo('grupo', null), MODELO_PADRAO)
    assert.deepEqual(normalizarModelo(MODELO_READEQUACAO), MODELO_READEQUACAO)
    assert.deepEqual(conferirModelo(MODELO_READEQUACAO), [])
    const faixa = MODELO_READEQUACAO.frente.elementos.find((e) => e.tipo === 'faixa')
    assert.ok(faixa && faixa.tipo === 'faixa')
    assert.equal(posicaoDaFaixa(faixa, CARTAO_PADRAO), 'rodape')
    const textos = JSON.stringify(MODELO_READEQUACAO).toLowerCase()
    assert.ok(textos.includes('sem registro') && textos.includes('{prazo}'))
    assert.ok(!textos.includes('não representa'), 'nunca a frase "não representa o COMEP"')
  })

  it('a faixa vai para qualquer lado do cartão', () => {
    const f = novoElemento('faixa', 'f')
    for (const lado of ['rodape', 'topo', 'esquerda', 'direita'] as const) {
      assert.equal(posicaoDaFaixa(posicionarFaixa(f, lado, CARTAO_PADRAO), CARTAO_PADRAO), lado)
    }
    assert.deepEqual(posicionarFaixa(f, 'direita', CARTAO_PADRAO, 6), { ...f, x: 79.6, y: 0, w: 6, h: ALTURA_MM, rotacao: 0 })
  })

  it('os modelos prontos passam pela conferência (o "em branco" tem o que não pode faltar)', () => {
    for (const p of PRONTOS) {
      assert.deepEqual(normalizarModelo(p.modelo), p.modelo, p.nome)
      assert.deepEqual(conferirModelo(p.modelo), [], p.nome)
    }
  })

  it('o desenho de cada credencial vem do modelo da pessoa; sem modelo, o padrão antigo', () => {
    const pacote = { modelo: null, modelos: { m1: { nome: 'Readequação', tipo: 'readequacao' as const, desenho: null } } }
    assert.deepEqual(modeloDaCredencial(pacote, { modelo_id: 'm1' }), MODELO_READEQUACAO)
    assert.deepEqual(modeloDaCredencial(pacote, { modelo_id: null }), MODELO_PADRAO)
  })

  it('os dados novos: o cargo, os anos de COMEP e o prazo da readequação', () => {
    const v = valoresDaCredencial({ ...DADOS_EXEMPLO, cargo: 'presidente', prazo_readequacao: '2027-04-28' }, '')
    assert.equal(v.cargo, 'Presidente do COMEP')
    assert.equal(v.prazo, '28/04/2027')
    assert.equal(anosDeComep('2016-11-20', '2026-11-19'), '9 anos de COMEP')
    assert.equal(anosDeComep('2016-11-19', '2026-11-19'), '10 anos de COMEP')
    assert.equal(anosDeComep(null, '2026-11-19'), '')
  })
})
