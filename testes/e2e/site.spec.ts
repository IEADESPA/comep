// Site institucional (público): o que qualquer visitante vê.
import { expect, test } from '@playwright/test'

test('página inicial mostra o COMEP e os botões de entrada', async ({ page }) => {
  await page.goto('./')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Conselho de Ministros Evangélicos de Parauapebas' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Portal do membro' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Quero me associar' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que fazemos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fale com o COMEP' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('CNPJ:')
})

test('o ambiente de teste mostra a faixa de aviso', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Versão de teste: não cadastre dados reais.')).toBeVisible()
})

test('"Quero me associar" explica requisitos e o passo a passo', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: 'Quero me associar' }).click()
  await expect(page).toHaveURL(/\/associar$/)
  await expect(page.getByRole('heading', { name: 'Requisitos' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Como funciona' })).toBeVisible()
  await expect(page.getByText('Assembleia Ordinária (abril ou outubro)')).toBeVisible()
})

test('portal do membro sem login leva para a tela de entrar', async ({ page }) => {
  await page.goto('painel')
  await expect(page).toHaveURL(/\/entrar$/)
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})

test('endereço que não existe mostra "Página não encontrada"', async ({ page }) => {
  await page.goto('endereco-que-nao-existe')
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})

test('nenhuma página pública fica mais larga que a tela', async ({ page }) => {
  for (const caminho of ['./', 'associar', 'associar/pedido', 'entrar', 'primeiro-acesso', 'nova-senha', 'agenda', 'diretoria-do-comep', 'igrejas-do-comep']) {
    await page.goto(caminho)
    await page.waitForLoadState('networkidle')
    const sobra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(sobra, `a página "${caminho}" passou ${sobra}px da largura da tela`).toBeLessThanOrEqual(0)
  }
})
