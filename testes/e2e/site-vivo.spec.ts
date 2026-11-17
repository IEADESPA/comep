// Fase 5.5.4: site vivo — a diretoria e as igrejas do COMEP aparecem no site a partir do sistema (qualquer visitante,
// sem login). Usa a diretoria fictícia (testes/dados/semente-diretoria-teste.sql) e as igrejas fictícias da semente.
import { expect, test } from '@playwright/test'

test('a diretoria no site: Conselho Diretor e Conselho Fiscal, sem login', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Diretoria' }).click()
  await expect(page).toHaveURL(/\/diretoria$/)
  await expect(page.getByRole('heading', { name: 'Diretoria', level: 1 })).toBeVisible()
  const diretor = page.getByRole('list', { name: 'Conselho Diretor' })
  await expect(diretor).toContainText('Presidente')
  await expect(page.getByRole('list', { name: 'Conselho Fiscal' })).toBeVisible()
  await expect(page.getByText(/^Mandato de \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}\.$/)).toBeVisible()
})

test('as igrejas do COMEP no site, com a busca; e os números na página inicial', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'O COMEP hoje' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Igrejas' }).click()
  await expect(page.getByRole('heading', { name: 'Igrejas do COMEP', level: 1 })).toBeVisible()
  const igrejas = page.getByRole('list', { name: 'Igrejas' })
  await expect(igrejas).toContainText('Igreja Fictícia A (teste)')
  await expect(igrejas).toContainText(/ministros? associados?/)
  await page.getByLabel('Procurar igreja, denominação ou bairro').fill('Fictícia A')
  await expect(igrejas.getByRole('listitem')).toHaveCount(1)
  await page.getByLabel('Procurar igreja, denominação ou bairro').fill('nenhuma igreja com este nome')
  await expect(page.getByText('Nenhuma igreja encontrada.')).toBeVisible()
})
