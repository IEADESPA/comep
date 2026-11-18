// Fase 5.4: mural de avisos e painel da presidência. O aviso fictício vem de testes/dados/semente-mural-teste.sql
// (quem publica é a secretaria; a publicação é testada no banco: mural_painel.test.ts).
import { expect, test } from '@playwright/test'
import { abrirModulos, arquivoDaSessao } from './ajuda'

const AVISO = 'Aviso fictício do ambiente de teste'

test.describe('presidência', () => {
  test.use({ storageState: arquivoDaSessao('presidencia') })

  test('vê o mural (sem publicar: é da secretaria) e o painel com as quatro partes', async ({ page }) => {
    await page.goto('avisos')
    await expect(page.getByRole('heading', { name: 'Mural de avisos', level: 1 })).toBeVisible()
    const aviso = page.getByRole('listitem', { name: AVISO })
    await expect(aviso).toContainText('Fixado')
    await expect(aviso.getByRole('link', { name: 'Enviar pelo WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
    await expect(page.getByText('Publicar um aviso')).toHaveCount(0)

    await page.goto('painel-presidencia')
    for (const parte of ['Associados', 'Finanças', 'Presença', 'Agenda e projetos']) {
      await expect(page.getByRole('heading', { name: parte, level: 2 })).toBeVisible()
    }
    await expect(page.getByText('Saldo do caixa')).toBeVisible()
  })
})

test.describe('ministro', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê o aviso no sino e o mural nos módulos, mas não o painel da presidência', async ({ page }) => {
    await page.goto('painel')
    await page.getByRole('button', { name: /^Avisos/ }).click()
    await expect(page.getByRole('list', { name: 'Avisos para você' })).toContainText(AVISO)
    await page.getByRole('link', { name: 'Ver o mural de avisos' }).click()
    await expect(page.getByRole('heading', { name: 'Mural de avisos', level: 1 })).toBeVisible()
    const modulos = await abrirModulos(page)
    await expect(modulos.getByRole('link', { name: 'Mural de avisos', exact: true })).toBeVisible()
    await expect(modulos.getByRole('link', { name: 'Painel da presidência', exact: true })).toHaveCount(0)
    await page.goto('painel-presidencia')
    await expect(page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible()
  })
})

test('o site mostra os avisos que a secretaria mandou para o site', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Avisos', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: AVISO, level: 3 })).toBeVisible()
})
