// Fase 4.4: Diretoria e Conselho Fiscal. Todos com login veem quem é de cada cargo; a presidência registra a
// diretoria eleita, com a assembleia (instalada) que elegeu — a AGO fictícia de semente-eleicao-teste.sql. Quem está
// em atraso não pode ser votado (Art. 11): o ministro fictício está em atraso, então a tentativa é recusada e nada se
// grava no banco de teste.
import { expect, test } from '@playwright/test'
import { arquivoDaSessao } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

test('a presidência vê a diretoria e não consegue registrar quem está em atraso (Art. 11)', async ({ page }) => {
  await page.goto('diretoria')
  await expect(page.getByRole('heading', { name: 'Diretoria e Conselho Fiscal', level: 1 })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Em exercício' })).toContainText('Presidente:')
  await expect(page.getByRole('list', { name: 'Em exercício' })).toContainText('Conselheiro fiscal:')

  await page.getByText('Registrar a diretoria eleita').click()
  const form = page.getByRole('form', { name: 'Registrar a diretoria eleita' })
  const posse = new Date(Date.now() + 400 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  await form.getByLabel('Posse (início) *').fill(posse)
  // o fim sugerido é de 4 anos (Art. 12)
  await expect(form.getByLabel('Fim do mandato *')).not.toHaveValue('')
  // depois do primeiro registro, a assembleia que elegeu é obrigatória (e só aparecem AGO/AGE instaladas)
  const assembleia = form.getByLabel('Assembleia que elegeu *')
  await expect(assembleia).toHaveAttribute('required', '')
  await assembleia.selectOption({ label: 'AGO de eleição da diretoria (fictícia) (20/10/2025)' })
  await form.getByLabel('2º tesoureiro').selectOption({ label: 'Ministro de Teste' })
  await form.getByRole('button', { name: 'Registrar os mandatos' }).click()
  await expect(page.getByRole('alert')).toContainText('está com a contribuição em atraso: não pode ser votado (Art. 11)')
})

test('o ministro vê a diretoria, mas não registra', async ({ browser }) => {
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const m = await ministro.newPage()
  await m.goto('diretoria')
  await expect(m.getByRole('list', { name: 'Em exercício' })).toContainText('Presidente:')
  await expect(m.getByText('Registrar a diretoria eleita')).toHaveCount(0)
  // nem encerra o mandato de ninguém (o ministro fictício não tem cargo)
  await expect(m.getByText(/Encerrar antes|Renunciar ao cargo/)).toHaveCount(0)
  await ministro.close()
})
