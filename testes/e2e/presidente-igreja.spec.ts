// A conta fixa de quem preside uma igreja (e2e.presidente.igreja, criada em 22/11/2026 pelos caminhos do próprio
// sistema: a presidência cadastrou a igreja fictícia, com os documentos conferidos, e o ministro; ele criou o login
// com o código de primeiro acesso). A igreja é regular e ele está em dia. Este teste só lê: não muda nada no banco.
import { expect, test } from '@playwright/test'
import { arquivoDaSessao } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidenteIgreja') })

const IGREJA = 'Igreja Fictícia do Presidente (teste)'
const NOME = 'Presidente de Igreja de Teste'

test('quem preside uma igreja vê o perfil e abre a Minha igreja, regular, com os ministros', async ({ page }) => {
  await page.goto('painel')
  await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Presidente de igreja')

  await page.goto('minha-igreja/ministros')
  await expect(page.getByRole('heading', { name: IGREJA, level: 2 })).toBeVisible()
  await expect(page.getByText('Regular', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'Ministros da igreja' })).toContainText(NOME)

  // os documentos estão em dia (mandados pela presidência, já conferidos)
  await page.goto('minha-igreja/documentos')
  const cartoes = page.getByRole('list', { name: 'Documentos da igreja' })
  await expect(cartoes.getByRole('link', { name: 'Estatuto da igreja' })).toBeVisible()
  await expect(cartoes).not.toContainText('Falta mandar')
})
