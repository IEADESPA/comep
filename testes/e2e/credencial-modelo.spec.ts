// Fase 3.4: editor do modelo da credencial. A presidência FICTÍCIA acrescenta um texto, salva sem usar, usa a versão
// (o texto aparece nas credenciais), devolve a versão que estava em uso e arquiva a do teste (nada se apaga).
import { expect, test, type Page } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

const PADRAO = 'Modelo padrão do sistema'

/** Imagem PNG de 1 × 1 ponto (fictícia) */
const IMAGEM = {
  name: 'logo-teste.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
}

async function abrirEditor(page: Page) {
  await page.goto('credenciais/modelo')
  await expect(page.getByRole('heading', { name: 'Modelo da credencial' })).toBeVisible()
  return page.getByRole('list', { name: 'Versões do modelo' })
}

test('editor do modelo: acrescentar um texto, salvar, usar na credencial, voltar e arquivar', async ({ page }, info) => {
  test.setTimeout(150_000)
  const sufixo = sufixoUnico(info.project.name)
  const marca = `Texto E2E ${sufixo}`
  const descricao = `E2E ${sufixo}`

  await page.goto('credenciais')
  await page.getByRole('link', { name: 'Editar o modelo (desenho) da credencial' }).click()
  const versoes = page.getByRole('list', { name: 'Versões do modelo' })
  await expect(versoes).toBeVisible()
  const emUsoAntes = (await versoes.getByRole('listitem').filter({ hasText: 'Em uso' }).getAttribute('aria-label')) ?? PADRAO

  try {
    // 1. Acrescenta um texto na frente e mexe na posição pelo campo
    await page.getByRole('button', { name: '+ Texto' }).click()
    const item = page.getByRole('region', { name: 'Item escolhido' })
    await item.getByLabel(/^Texto \(os dados/).fill(marca)
    const palco = page.locator('.editor-palco .credencial')
    await expect(palco).toContainText(marca)
    await item.getByLabel('Do topo (mm)').fill('44')
    await expect(item.getByLabel('Do topo (mm)')).toHaveValue('44')

    // imagem enviada (ex.: o logo oficial) entra no lugar do logo do sistema
    await page.getByRole('button', { name: '+ Imagem ou logo' }).click()
    await page.getByLabel('Enviar uma imagem (PNG, JPG ou WebP)').setInputFiles(IMAGEM)
    await expect(page.locator('.editor-palco img[src*="credencial-modelo"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(page.locator('.editor-palco img[src*="credencial-modelo"]')).toHaveCount(0)

    // desfazer tira o texto inteiro do passo; refazer devolve
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(palco).not.toContainText(marca)
    await page.getByRole('button', { name: 'Refazer' }).click()
    await page.getByRole('button', { name: 'Refazer' }).click()
    await page.getByRole('button', { name: 'Refazer' }).click()
    await expect(palco).toContainText(marca)

    // 2. Salva sem usar: aparece na lista, sem "Em uso"
    const salvar = page.getByRole('form', { name: 'Salvar o modelo' })
    await salvar.getByLabel('O que mudou? *').fill(descricao)
    await salvar.getByRole('button', { name: 'Salvar sem usar ainda' }).click()
    await expect(mensagemNaTela(page, 'Modelo salvo (sem usar ainda).')).toBeVisible()
    const versao = versoes.getByRole('listitem', { name: descricao, exact: true })
    await expect(versao).toBeVisible()
    await expect(versao).not.toContainText('Em uso')

    // 3. Usa: a credencial de um associado passa a mostrar o texto
    await versao.getByRole('button', { name: 'Usar esta versão' }).click()
    await expect(versao).toContainText('Em uso')
    await page.goto('credenciais')
    await page.getByRole('link', { name: 'Ver a credencial' }).first().click()
    await expect(page.getByRole('article').first()).toContainText(marca)
  } finally {
    // 4. Devolve a versão que estava em uso e arquiva a do teste
    const lista = await abrirEditor(page)
    const anterior = lista.getByRole('listitem', { name: emUsoAntes, exact: true })
    if (!(await anterior.textContent())?.includes('Em uso')) {
      await anterior.getByRole('button', { name: emUsoAntes === PADRAO ? 'Usar o padrão' : 'Usar esta versão' }).click()
      await expect(anterior).toContainText('Em uso')
    }
    const doTeste = lista.getByRole('listitem', { name: descricao, exact: true })
    if (await doTeste.count()) {
      await doTeste.getByRole('button', { name: `Arquivar a versão ${descricao}` }).click()
      await doTeste.getByRole('button', { name: `Confirmar — Arquivar a versão ${descricao}` }).click()
      await expect(doTeste).toHaveCount(0)
    }
  }
  await page.goto('credenciais')
  await page.getByRole('link', { name: 'Ver a credencial' }).first().click()
  await expect(page.getByRole('article').first()).not.toContainText(marca)
})

test('o ministro não abre o editor do modelo', async ({ browser }) => {
  const contexto = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const page = await contexto.newPage()
  await page.goto('credenciais/modelo')
  await expect(page.getByRole('heading', { name: 'Modelo da credencial' })).toHaveCount(0)
  await contexto.close()
})
