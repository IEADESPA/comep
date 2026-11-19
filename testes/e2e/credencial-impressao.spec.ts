// Fase 5.5, parte 8: a impressão nova das credenciais e a credencial do ministro em readequação.
//   * imprimir 2 num pedaço já cortado (meia folha, A5): lado a lado, para dobrar, com 5 mm de espaço, a sangria e as
//     marcas de corte fora dela; com 1 no pedaço, a outra vai para a folha inteira;
//   * a credencial do ministro de uma igreja sem registro sai cinza, com a faixa de aviso, e a conferência pelo QR
//     mostra a readequação e o prazo. Igreja e ministro FICTÍCIOS, criados e arquivados pelo próprio teste.
import { expect, test } from '@playwright/test'
import {
  abrirAbaDaIgreja,
  arquivarAssociadoDeTeste,
  arquivoDaSessao,
  cadastrarMinistro,
  DENOMINACAO_DE_TESTE,
  mensagemNaTela,
  sufixoUnico,
} from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

/** mm em pixels de CSS (96 por polegada) */
const px = (mm: number) => (mm / 25.4) * 96

test('imprimir 2 num pedaço já cortado: espaço, sangria e marcas de corte; com 1 no pedaço, a outra vai para a folha', async ({ page }) => {
  await page.goto('credenciais')
  const lista = page.getByRole('list', { name: 'Credenciais', exact: true })
  await expect(lista).toBeVisible()
  const caixas = lista.getByRole('checkbox', { name: /^Marcar .+ para imprimir$/ })
  await caixas.nth(0).check()
  await caixas.nth(1).check()
  await page.getByRole('button', { name: 'Imprimir as marcadas (2)' }).click()
  await expect(page.getByRole('heading', { name: 'Imprimir', level: 1 })).toBeVisible()

  // sem pedaço: uma folha, com as 2 no alto
  const folha = page.getByRole('region', { name: 'Folha 1' })
  await expect(folha.getByRole('group', { name: / para dobrar$/ })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Imprimir 1 folha' })).toBeVisible()

  // o pedaço que sobrou: cabem 2 (meia folha, A5 deitada)
  await page.getByText('Sim, usar o pedaço primeiro').click()
  await page.getByRole('group', { name: 'Cabem no pedaço' }).getByRole('button', { name: '2', exact: true }).click()
  const pedaco = page.getByRole('region', { name: 'Pedaço que sobrou' })
  await expect(pedaco.getByRole('group', { name: / para dobrar$/ })).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Folha 1' })).toHaveCount(0)
  await expect(page.getByText(/A5, deitado/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir o pedaço' })).toBeVisible()

  // no papel: frente e verso juntos, 5 mm de espaço + 2 mm de sangria de cada lado entre os cortes; marcas e sangria
  await page.emulateMedia({ media: 'print' })
  const medidas = await pedaco.evaluate((secao) => {
    const pares = [...secao.querySelectorAll('.par-cartoes')].map((p) => p.getBoundingClientRect())
    const [f, v] = [...secao.querySelectorAll('.par-cartoes')][0].querySelectorAll('.credencial')
    return {
      entreCortes: pares[1].top - pares[0].bottom,
      dobra: v.getBoundingClientRect().left - f.getBoundingClientRect().right,
      largura: f.getBoundingClientRect().width,
      marcas: secao.querySelectorAll('.marca-corte').length,
      dobras: secao.querySelectorAll('.marca-dobra').length,
      sangrias: secao.querySelectorAll('.cr-sangria').length,
    }
  })
  expect(Math.abs(medidas.entreCortes - px(5 + 2 * 2))).toBeLessThan(2)
  expect(Math.abs(medidas.dobra)).toBeLessThan(0.5)
  expect(Math.abs(medidas.largura - px(85.6))).toBeLessThan(1)
  expect(medidas.marcas).toBe(16)
  expect(medidas.dobras).toBe(4)
  expect(medidas.sangrias).toBe(4)
  await page.emulateMedia({ media: 'screen' })

  // cabe só 1 no pedaço: a outra vai para a folha inteira, e cada um se imprime à parte (papéis diferentes)
  await page.getByRole('group', { name: 'Cabem no pedaço' }).getByRole('button', { name: '1', exact: true }).click()
  await expect(pedaco.getByRole('group', { name: / para dobrar$/ })).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Folha 1' }).getByRole('group', { name: / para dobrar$/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Imprimir o pedaço' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir a folha' })).toBeVisible()
})

test('a credencial do ministro em readequação: cinza, com a faixa, e a conferência pelo QR mostra o prazo', async ({ page, browser }, info) => {
  test.setTimeout(180_000)
  const sufixo = sufixoUnico(info.project.name)
  const igreja = `Igreja Readequação E2E ${sufixo}`
  const nome = `Ministro Readequação E2E ${sufixo}`

  // 1. A igreja sem registro (cadastro simples) e um ministro dela
  await page.goto('igrejas/nova')
  await page.getByText('Ainda não', { exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastro simples, sem registro' })
  await form.getByLabel(/^Nome da igreja/).fill(igreja)
  await form.getByLabel(/^Denominação/).selectOption({ label: DENOMINACAO_DE_TESTE })
  await form.getByLabel('Pessoa de contato').fill('Pr. Contato Fictício')
  await form.getByRole('button', { name: 'Cadastrar sem registro' }).click()
  await expect(mensagemNaTela(page, 'Igreja cadastrada sem registro.')).toBeVisible()
  const fichaDaIgreja = page.url()

  try {
    await cadastrarMinistro(page, { nome, igreja })

    // 2. A credencial: o modelo de readequação (cinza, com a faixa de aviso, a igreja sem registro e o prazo)
    await page.goto('credenciais')
    await page.getByLabel('Buscar associado').fill(nome)
    const linha = page.getByRole('listitem', { name: nome })
    await expect(linha).toContainText('Em readequação')
    await linha.getByRole('link', { name: /^Ver a credencial de / }).click()
    const frente = page.getByRole('article', { name: `Credencial de ${nome} — frente` })
    await expect(frente).toContainText('Em readequação · sem direito a voto')
    await expect(frente).toContainText('sem registro')
    await expect(frente).toContainText(/prazo até \d{2}\/\d{2}\/\d{4}/)
    await expect(frente).not.toContainText('não representa')
    const link = await page.getByRole('link', { name: /Abrir a página de validação/ }).getAttribute('href')
    expect(link).toMatch(/\/validar\/[0-9a-f]{32}$/)

    // 3. A conferência pelo QR, sem login: a readequação, a faixa e o prazo
    const visitante = await browser.newContext()
    const v = await visitante.newPage()
    await v.goto(link!)
    const resultado = v.getByLabel('Resultado da validação')
    await expect(resultado).toContainText('ministro em readequação')
    await expect(resultado).toContainText(/Em readequação · sem direito a voto · prazo até \d{2}\/\d{2}\/\d{4}/)
    await expect(resultado).toContainText('(sem registro)')
    await expect(resultado).not.toContainText('não representa')
    await visitante.close()
  } finally {
    // 4. Limpeza: o ministro e a igreja (nada se apaga)
    await arquivarAssociadoDeTeste(page, nome).catch(() => undefined)
    await page.goto(fichaDaIgreja)
    await abrirAbaDaIgreja(page, 'Situação')
    await page.getByText('Arquivar a igreja', { exact: true }).last().click()
    await page.getByRole('button', { name: 'Confirmar o arquivamento' }).click()
    await expect(page).toHaveURL(/\/igrejas\/lista$/)
  }
})
