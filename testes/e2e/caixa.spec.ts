// Fase 2.2: caixa — a tesouraria lança, o presidente autoriza a despesa, o saldo muda; transferência; tudo desfeito no fim.
// Os valores são pequenos e o teste cancela o que lançou (motivo "Teste automático"), então o saldo volta ao que era.
import { expect, test, type Page } from '@playwright/test'
import { mensagemNaTela, sufixoUnico, trocarPara } from './ajuda'

const CAIXA = 'Caixa (dinheiro)'
const BANCO = 'Conta bancária'

/** Saldo de uma conta, em centavos, lido da aba Caixa. */
async function saldoEmCentavos(page: Page, conta: string): Promise<number> {
  const texto = await page.getByRole('listitem', { name: `Saldo de ${conta}` }).locator('.saldo').innerText()
  const limpo = texto.replace(/[^\d,-]/g, '').replace(',', '.')
  return Math.round(Number(limpo) * 100)
}

async function abrirCaixa(page: Page) {
  await page.goto('financeiro')
  await page.getByRole('tab', { name: 'Caixa', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Saldos' })).toBeVisible()
}

async function esperarSaldo(page: Page, conta: string, centavos: number) {
  await expect.poll(() => saldoEmCentavos(page, conta)).toBe(centavos)
}

async function lancar(page: Page, tipo: 'entrada' | 'saida', categoria: string, valor: string, descricao: string) {
  const painel = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Novo lançamento' }) })
  if ((await painel.getAttribute('open')) === null) await painel.locator('summary').click()
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption(tipo === 'entrada' ? 'Entrada (receita)' : 'Saída (despesa)')
  await page.getByRole('combobox', { name: 'Conta', exact: true }).selectOption(CAIXA)
  await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption(categoria)
  await page.getByLabel('Valor (R$)').first().fill(valor)
  await page.getByLabel('Descrição *').fill(descricao)
  await page.getByRole('button', { name: tipo === 'entrada' ? 'Lançar entrada' : 'Lançar despesa' }).click()
}

async function cancelar(page: Page, descricao: string) {
  const linha = page.getByRole('listitem', { name: descricao }).first()
  await linha.getByText('Cancelar lançamento').click()
  await linha.getByLabel('Motivo *').fill('Teste automático')
  await linha.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(mensagemNaTela(page, 'Lançamento cancelado.')).toBeVisible()
}

test('a tesouraria lança; a despesa só sai do saldo depois que o presidente autoriza; transferência e cancelamento', async ({
  page,
}, info) => {
  test.setTimeout(150_000)
  const sufixo = sufixoUnico(info.project.name)
  const oferta = `Oferta E2E ${sufixo}`
  const despesa = `Despesa E2E ${sufixo}`
  const deposito = `Depósito E2E ${sufixo}`

  // 1. A tesouraria lança uma entrada e uma despesa no caixa
  await trocarPara(page, 'tesouraria')
  await abrirCaixa(page)
  const caixaAntes = await saldoEmCentavos(page, CAIXA)
  const bancoAntes = await saldoEmCentavos(page, BANCO)

  await lancar(page, 'entrada', 'Ofertas', '10,00', oferta)
  await expect(mensagemNaTela(page, 'Entrada lançada.')).toBeVisible()
  await esperarSaldo(page, CAIXA, caixaAntes + 1000)

  await lancar(page, 'saida', 'Material e expediente', '3,50', despesa)
  await expect(mensagemNaTela(page, /Despesa lançada/)).toBeVisible()
  await expect(page.getByRole('listitem', { name: despesa })).toContainText('Aguardando autorização do presidente')
  await esperarSaldo(page, CAIXA, caixaAntes + 1000) // ainda não saiu

  // A tesouraria vê a despesa na fila, mas não autoriza
  await page.getByRole('tab', { name: 'Despesas a autorizar' }).click()
  const naFila = page.getByRole('listitem', { name: `Despesa: ${despesa}` })
  await expect(naFila).toContainText('R$ 3,50')
  await expect(naFila.getByRole('button', { name: 'Autorizar despesa' })).toHaveCount(0)

  // 2. O presidente autoriza
  await trocarPara(page, 'presidencia')
  await page.goto('financeiro')
  await page.getByRole('tab', { name: 'Despesas a autorizar' }).click()
  await page
    .getByRole('listitem', { name: `Despesa: ${despesa}` })
    .getByRole('button', { name: 'Autorizar despesa' })
    .click()
  await expect(mensagemNaTela(page, `Despesa autorizada: ${despesa}.`)).toBeVisible()

  // 3. A despesa saiu do saldo
  await trocarPara(page, 'tesouraria')
  await abrirCaixa(page)
  await esperarSaldo(page, CAIXA, caixaAntes + 1000 - 350)
  await expect(page.getByRole('listitem', { name: despesa })).toContainText('autorizada por')

  // 4. Transferência do caixa para o banco; cancelar desfaz os dois lados
  await page.getByText('Transferência entre contas', { exact: true }).click()
  await page.getByRole('combobox', { name: 'De', exact: true }).selectOption(CAIXA)
  await page.getByRole('combobox', { name: 'Para', exact: true }).selectOption(BANCO)
  await page.getByLabel('Valor (R$)').last().fill('5')
  await page.getByLabel('Descrição', { exact: true }).fill(deposito)
  await page.getByRole('button', { name: 'Transferir' }).click()
  await expect(mensagemNaTela(page, 'Transferência registrada.')).toBeVisible()
  await esperarSaldo(page, CAIXA, caixaAntes + 1000 - 350 - 500)
  await esperarSaldo(page, BANCO, bancoAntes + 500)
  await expect(page.getByRole('listitem', { name: deposito })).toHaveCount(2)

  await cancelar(page, deposito)
  await esperarSaldo(page, BANCO, bancoAntes)
  await expect(page.getByRole('listitem', { name: deposito })).toHaveCount(0)

  // 5. Desfaz o resto: o saldo volta ao que era, e o cancelado continua visível quando pedido
  await cancelar(page, oferta)
  await cancelar(page, despesa)
  await esperarSaldo(page, CAIXA, caixaAntes)
  await page.getByLabel('Mostrar cancelados e recusados').check()
  await expect(page.getByRole('listitem', { name: oferta })).toContainText('Cancelado')
  await expect(page.getByRole('listitem', { name: oferta })).toContainText('Motivo: Teste automático')
})

test('o ministro não vê o financeiro', async ({ page }) => {
  await trocarPara(page, 'ministro')
  await page.goto('financeiro')
  await expect(page.getByRole('tab', { name: 'Caixa', exact: true })).toHaveCount(0)
})
