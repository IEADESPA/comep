// Testes do modelo (desenho) da credencial: conferência do que vem do banco/editor e preenchimento dos dados.
// Rodar: npm test

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ALTURA_MM,
  conferirModelo,
  DADOS_EXEMPLO,
  ITENS_NOVOS,
  LARGURA_MM,
  MAXIMO_ELEMENTOS,
  MODELO_PADRAO,
  nomeDoElemento,
  normalizarModelo,
  novoElemento,
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
