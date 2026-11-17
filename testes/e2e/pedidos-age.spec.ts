// Fase 5.5.3: pedido de AGE on-line. Usa o pedido fictício de testes/dados/semente-pedido-age-teste.sql (aberto e
// assinado por associados fictícios em dia). Os usuários fictícios dos testes não assinam: a presidência fictícia não é
// associada e o ministro fictício está em atraso de propósito — então aqui se confere que as telas abrem, que as
// assinaturas aparecem e que quem está em atraso não assina nem abre pedido. O caminho todo (assinar, a meta de 3/5 ou do
// Conselho Diretor, marcar a AGE) está nos testes do banco: testes/banco/pedidos_age.test.ts.
import { expect, test } from '@playwright/test'
import { arquivoDaSessao } from './ajuda'

const PEDIDO = 'Pedido fictício de AGE (teste)'

test.describe('ministro (em atraso)', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê o pedido e as assinaturas, mas não assina nem abre pedido', async ({ page }) => {
    await page.goto('assembleias')
    await page.getByRole('link', { name: 'pedidos de AGE e assinaturas' }).click()
    await expect(page.getByRole('heading', { name: 'Pedidos de Assembleia Extraordinária', level: 1 })).toBeVisible()
    await page.getByRole('link', { name: new RegExp(PEDIDO.replace(/[()]/g, '\\$&')) }).click()
    await expect(page.getByRole('heading', { name: PEDIDO, level: 1 })).toBeVisible()
    await expect(page.getByText('Colhendo assinaturas')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Quem assinou' }).getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('list', { name: 'Pauta pedida' })).toContainText('Assunto fictício para a assembleia')
    await expect(page.getByRole('button', { name: 'Assinar o pedido' })).toHaveCount(0)

    // em atraso: o banco recusa abrir um pedido
    await page.goto('assembleias/pedidos/novo')
    const form = page.getByRole('form', { name: 'Pedido de AGE' })
    await form.getByLabel(/^Assunto \*/).fill('Pedido que não deve abrir (teste)')
    await form.getByLabel(/^Por que a assembleia é necessária \*/).fill('O ministro fictício está em atraso de propósito.')
    await form.getByLabel(/^Item 1/).fill('Item de teste')
    await form.getByRole('checkbox', { name: /^Assino este pedido/ }).check()
    await form.getByRole('button', { name: 'Abrir o pedido e assinar' }).click()
    await expect(page.getByRole('alert')).toContainText('Pedem a assembleia os associados em dia')
  })
})

test.describe('presidência', () => {
  test.use({ storageState: arquivoDaSessao('presidencia') })

  test('vê o pedido colhendo assinaturas (ainda sem marcar a AGE)', async ({ page }) => {
    await page.goto('assembleias/pedidos')
    await page.getByRole('link', { name: new RegExp(PEDIDO.replace(/[()]/g, '\\$&')) }).click()
    await expect(page.getByRole('heading', { name: PEDIDO, level: 1 })).toBeVisible()
    await expect(page.getByText(/^3 de \d+$/)).toBeVisible()
    await expect(page.getByRole('form', { name: 'Marcar a AGE' })).toHaveCount(0)
  })
})
