// Telas novas (Fase 5.5): a moldura do sistema. Menu curto, modo claro/escuro guardado no aparelho,
// o sino e, no celular, a navegação EM CIMA (nada de barra embaixo: lá ficam os botões do aparelho).
import { expect, test } from '@playwright/test'
import { abrirMenu, arquivoDaSessao, saudacao } from './ajuda'

test.use({ storageState: arquivoDaSessao('ministro') })

test('o modo escuro escolhido fica guardado no aparelho', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('painel')
  await expect(page.getByRole('heading', { name: saudacao('Ministro'), level: 1 })).toBeVisible()
  const botao = page.getByRole('button', { name: 'Usar o modo escuro' })
  if (await botao.isVisible()) {
    await botao.click()
  } else {
    const menu = await abrirMenu(page)
    await menu.getByRole('button', { name: 'Modo escuro' }).click()
  }
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro')
  await expect(page.getByRole('heading', { name: saudacao('Ministro'), level: 1 })).toBeVisible()
})

test('o sino abre os avisos sem sair da tela', async ({ page }) => {
  await page.goto('painel')
  await expect(page.getByRole('heading', { name: saudacao('Ministro'), level: 1 })).toBeVisible()
  await page.getByRole('button', { name: /^Avisos/ }).click()
  const painel = page.getByRole('region', { name: 'Avisos' })
  await expect(painel).toBeVisible()
  await expect(page).toHaveURL(/\/painel$/)
  await page.keyboard.press('Escape')
  await expect(painel).toHaveCount(0)
})

test('no celular, a navegação fica em cima, com as abas Início, Módulos e Meu perfil', async ({ page }, info) => {
  test.skip(info.project.name !== 'celular', 'só no celular')
  await page.goto('painel')
  const navegacao = page.getByRole('navigation', { name: 'Navegação' })
  for (const aba of ['Início', 'Módulos', 'Meu perfil']) {
    await expect(navegacao.getByRole('link', { name: aba, exact: true })).toBeVisible()
  }
  const caixa = await navegacao.boundingBox()
  const altura = page.viewportSize()?.height ?? 0
  expect(caixa, 'a navegação aparece').not.toBeNull()
  expect(caixa!.y + caixa!.height, 'a navegação fica na metade de cima da tela').toBeLessThan(altura / 2)
  await navegacao.getByRole('link', { name: 'Módulos', exact: true }).click()
  await expect(page).toHaveURL(/\/modulos$/)
  await expect(page.getByRole('region', { name: 'Módulos' }).getByRole('link', { name: 'Minha credencial' })).toBeVisible()
})
