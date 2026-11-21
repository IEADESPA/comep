// Fase 5.5, parte 7: os modelos da credencial por grupo. A presidência FICTÍCIA cria um modelo a partir de um pronto,
// desenha um texto no editor de tela inteira (no computador), diz quem recebe (a igreja fictícia A), confere quem
// recebe hoje e a credencial de um ministro dessa igreja, e arquiva o modelo no fim (nada se apaga).
// No celular, o editor avisa que é feito no computador; o modelo é posto em uso pela tela "Quem recebe".
import { expect, test, type Page } from '@playwright/test'
import { arquivoDaSessao, escolherOpcaoCom, mensagemNaTela, noCelular, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

const IGREJA = 'Igreja Fictícia A (teste)'

async function arquivarSeExistir(page: Page, nome: string) {
  await page.goto('credenciais/modelos')
  // espera a galeria carregar (o padrão está sempre lá) antes de procurar o modelo do teste
  await expect(page.getByRole('article', { name: 'Ministro (padrão)' })).toBeVisible()
  const cartao = page.getByRole('article', { name: nome, exact: true })
  if ((await cartao.count()) === 0) return
  await cartao.getByRole('link', { name: 'Quem recebe' }).click()
  await page.getByRole('button', { name: `Arquivar o modelo ${nome}`, exact: true }).click()
  await page.getByRole('button', { name: `Confirmar — Arquivar o modelo ${nome}`, exact: true }).click()
  await expect(page).toHaveURL(/\/credenciais\/modelos$/)
  await expect(page.getByRole('article', { name: nome, exact: true })).toHaveCount(0)
}

/**
 * Arquiva os modelos "E2E …" que sobraram de uma rodada interrompida (por exemplo, cancelada por tempo no meio
 * do teste, antes do `finally`). Os testes rodam um de cada vez (workers: 1), então nenhum outro teste está usando
 * esses modelos. Sem isso, a sobra continua em uso para a igreja fictícia A e atrapalha a ordem e o "Hoje, N pessoas".
 */
async function arquivarSobrasDeRodadasAnteriores(page: Page) {
  await page.goto('credenciais/modelos')
  await expect(page.getByRole('article', { name: 'Ministro (padrão)' })).toBeVisible()
  const sobras = await page
    .getByRole('article', { name: /^E2E / })
    .evaluateAll((cartoes) => cartoes.map((c) => c.getAttribute('aria-label') ?? '').filter((n) => n !== ''))
  for (const sobra of sobras) await arquivarSeExistir(page, sobra)
}

test('modelos da credencial: criar de um pronto, desenhar, dizer quem recebe, conferir e arquivar', async ({ page }, info) => {
  test.setTimeout(180_000)
  await arquivarSobrasDeRodadasAnteriores(page)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `E2E ${sufixo}`
  const marca = `Texto E2E ${sufixo}`

  try {
    // 1. A galeria: o padrão e o da readequação estão sempre lá
    await page.goto('credenciais/modelos')
    await expect(page.getByRole('heading', { name: 'Modelos', level: 1 })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Ministro (padrão)' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Ministro em readequação' })).toBeVisible()

    // 2. Novo modelo a partir de um pronto (nasce rascunho e abre o editor)
    await page.getByRole('button', { name: 'Novo modelo' }).click()
    await page.getByRole('radiogroup', { name: 'Modelo pronto' }).getByText('Azul institucional').click()
    const novo = page.getByRole('form', { name: 'Novo modelo' })
    await novo.getByLabel('Nome do modelo *').fill(nome)
    await novo.getByRole('button', { name: 'Criar e abrir o editor' }).click()
    await expect(page).toHaveURL(/\/credenciais\/modelos\/[0-9a-f-]{36}\/editar$/)

    if (!noCelular(page)) {
      // 3. O editor na tela inteira: um texto novo na frente, salvo e em uso
      await expect(page.getByRole('heading', { name: `Modelo: ${nome}` })).toBeVisible()
      await page.getByRole('navigation', { name: 'Ferramentas do editor' }).getByRole('button', { name: 'Textos' }).click()
      await page.getByRole('button', { name: '+ Texto', exact: true }).click()
      const item = page.getByRole('region', { name: 'Item escolhido' })
      await item.getByLabel(/^Texto \(os dados/).fill(marca)
      await expect(page.locator('.editor-palco .credencial')).toContainText(marca)
      // um símbolo da biblioteca (desenho próprio em SVG) e as regras: o obrigatório não sai
      await page.getByRole('navigation', { name: 'Ferramentas do editor' }).getByRole('button', { name: 'Símbolos' }).click()
      await page.getByRole('button', { name: 'Acrescentar o símbolo Chama' }).first().click()
      await expect(page.locator('.editor-palco .cr-simbolo')).toHaveCount(1)
      await page.locator('.editor-palco [data-alvo="nome"]').click()
      await expect(item.getByRole('button', { name: 'Tirar da credencial' })).toBeDisabled()
      await page.getByRole('navigation', { name: 'Ferramentas do editor' }).getByRole('button', { name: 'Regras' }).click()
      await expect(page.getByRole('list', { name: 'Obrigatórios' })).toContainText('QR Code de conferência')
      // o tamanho do cartão: o padrão de cartão de crédito
      await page.getByRole('tab', { name: 'Cartão' }).click()
      await expect(page.getByRole('radio', { name: /Cartão de crédito \(CR80\)/ })).toBeChecked()
      await page.getByRole('button', { name: 'Salvar e usar' }).click()
      const janela = page.getByRole('dialog', { name: `Salvar o modelo "${nome}"` })
      await janela.getByLabel('O que mudou?').fill('Texto do teste automático')
      await janela.getByRole('button', { name: 'Salvar e usar' }).click()
      await expect(mensagemNaTela(page, /Modelo salvo e em uso/)).toBeVisible()
      await page.getByRole('link', { name: 'Modelos' }).click()
    } else {
      // no celular, o editor avisa que é feito no computador
      await expect(page.getByText('O editor é feito no computador')).toBeVisible()
      await page.getByRole('link', { name: '← Voltar aos modelos' }).click()
    }

    // 4. Quem recebe: os ministros da igreja fictícia A
    const cartao = page.getByRole('article', { name: nome, exact: true })
    await expect(cartao).toBeVisible()
    await expect(cartao).toContainText('0 pessoas')
    await cartao.getByRole('link', { name: 'Quem recebe' }).click()
    await expect(page.getByRole('heading', { name: `Quem recebe "${nome}"`, level: 1 })).toBeVisible()
    // a ordem: o modelo novo é de grupo e vem antes do padrão; sobe para o primeiro lugar (se houver outro de grupo)
    const ordem = page.getByRole('list', { name: 'Ordem dos modelos' })
    await expect(ordem.getByRole('listitem', { name: nome, exact: true })).toBeVisible()
    for (let i = 0; i < 10 && (await ordem.getByRole('listitem').first().getAttribute('aria-label')) !== nome; i++) {
      await ordem.getByRole('button', { name: `Subir ${nome}`, exact: true }).click()
      await expect(mensagemNaTela(page, 'Ordem salva.')).toBeVisible()
    }
    await expect(ordem.getByRole('listitem').first()).toHaveAccessibleName(nome)
    await page.getByLabel('+ Mais uma condição').selectOption({ label: 'Igreja (uma ou várias)' })
    await escolherOpcaoCom(page.getByLabel('Acrescentar em Igreja (uma ou várias)'), IGREJA)
    await expect(page.getByRole('heading', { name: /^Como vai ficar, [1-9]\d* pessoas?$/ })).toBeVisible()
    await page.getByRole('button', { name: 'Salvar quem recebe' }).click()
    await expect(mensagemNaTela(page, /Quem recebe salvo/)).toBeVisible()
    if (noCelular(page)) {
      await page.getByRole('button', { name: 'Pôr em uso' }).click()
      await expect(mensagemNaTela(page, 'Modelo em uso.')).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: /^Hoje, [1-9]\d* pessoas?$/ })).toBeVisible()

    // 5. A credencial de um ministro da igreja sai no modelo novo
    if (!noCelular(page)) {
      await page.goto('credenciais')
      await page.getByLabel('Buscar associado').fill(IGREJA)
      await page.getByRole('list', { name: 'Credenciais', exact: true }).getByRole('link', { name: /^Ver a credencial de / }).first().click()
      await expect(page.getByRole('article').first()).toContainText(marca)
    }
  } finally {
    // 6. Arquiva o modelo do teste (continua guardado): as credenciais voltam ao padrão
    await arquivarSeExistir(page, nome)
  }
})

test('a biblioteca de símbolos: os gerais, os de cada tradição e os logotipos das denominações', async ({ page }) => {
  await page.goto('credenciais/simbolos')
  await expect(page.getByRole('heading', { name: 'Biblioteca de símbolos', level: 1 })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Gerais da fé' })).toContainText('Chama')
  await expect(page.getByRole('list', { name: 'Por tradição' }).getByRole('listitem', { name: 'Pentecostal', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Por tradição' }).getByRole('listitem', { name: 'Batista', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Logotipos das denominações' })).toContainText('Denominação Fictícia (teste)')
  await page.getByLabel('Buscar símbolo').fill('águas')
  await expect(page.getByRole('list', { name: 'Por tradição' }).getByRole('listitem')).toHaveCount(1)
})

test('o ministro não abre os modelos da credencial', async ({ browser }) => {
  const contexto = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const page = await contexto.newPage()
  await page.goto('credenciais/modelos')
  await expect(page.getByRole('heading', { name: 'Modelos', level: 1 })).toHaveCount(0)
  await contexto.close()
})
