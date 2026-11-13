// Fase 3.2/3.3: credencial digital, impressão no tamanho real (85,6 mm, frente e verso juntos para dobrar) e
// validação pública pelo QR Code; a nova credencial (perda) invalida a antiga. Nome bem comprido: tudo precisa caber
// (nada cortado nem empurrado). Associado FICTÍCIO criado pelo próprio teste (e arquivado no fim).
import { expect, test } from '@playwright/test'
import {
  arquivarAssociadoDeTeste,
  cpfAleatorio,
  criarAssociadoComLogin,
  mensagemNaTela,
  sufixoUnico,
  trocarPara,
} from './ajuda'

const FOTO = {
  name: 'foto.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

/** 85,6 mm em pixels de CSS (96 por polegada) */
const LARGURA_CR80 = (85.6 / 25.4) * 96

/** Quantos textos passam da própria caixa (deve ser zero: a letra diminui para caber) */
function textosQueTransbordam(cartao: Element) {
  return [...cartao.querySelectorAll('[data-ajustar]')].filter((caixa) => {
    const texto = caixa.firstElementChild!.getBoundingClientRect()
    const limite = caixa.getBoundingClientRect()
    return texto.width > limite.width + 1 || texto.height > limite.height + 1
  }).length
}

test('credencial digital, impressão no tamanho real e validação pelo QR Code; a nova invalida a antiga', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Maria Aparecida Credencial Digital E2E Nome Comprido ${sufixo}`
  const associado = await criarAssociadoComLogin(page, {
    nome,
    email: `e2e.credencialdigital.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja: 'Igreja Fictícia A (teste)',
  })

  // 1. O associado completa CPF, mãe e foto no perfil
  await trocarPara(page, associado)
  await page.goto('meu-perfil')
  await page.getByLabel(/^CPF/).fill(cpfAleatorio())
  await page.getByLabel(/^Nome da mãe/).fill('Mãe Fictícia')
  await page.getByRole('button', { name: 'Salvar meus dados' }).click()
  await expect(mensagemNaTela(page, 'Seus dados foram salvos.')).toBeVisible()
  await page.getByLabel('Enviar foto').setInputFiles(FOTO)
  await expect(mensagemNaTela(page, 'Foto atualizada.')).toBeVisible()

  // 2. Minha credencial: frente com os dados e verso com o QR Code
  await page.getByRole('link', { name: 'Ver a credencial (digital e impressão)' }).click()
  await expect(page).toHaveURL(/\/minha-credencial$/)
  const frente = page.getByRole('article', { name: `Credencial de ${nome} — frente` })
  await expect(frente).toContainText(nome)
  await expect(frente).toContainText('Associado desde')
  await expect(frente).toContainText('Válida até')
  expect(await frente.evaluate(textosQueTransbordam)).toBe(0)
  expect(await page.getByRole('article', { name: `Credencial de ${nome} — verso` }).evaluate(textosQueTransbordam)).toBe(0)
  await expect(page.getByRole('img', { name: `QR Code de validação da credencial de ${nome}` })).toBeVisible()
  await expect(page.getByRole('img', { name: `Foto de ${nome}` }).first()).toBeVisible()
  const link = await page.getByRole('link', { name: /Abrir a página de validação/ }).getAttribute('href')
  expect(link).toMatch(/\/validar\/[0-9a-f]{32}$/)

  // 3. Impressão: cada lado tem 85,6 mm; frente e verso JUNTOS (sem espaço), para dobrar ao meio
  await page.getByRole('link', { name: 'Ver a impressão (tamanho real)' }).click()
  await expect(page.getByRole('region', { name: 'Folha 1' })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  const par = page.getByRole('group', { name: `Credencial de ${nome} para dobrar` })
  const medidas = await par.evaluate((el) => {
    const [f, v] = [...el.querySelectorAll('.credencial')].map((c) => c.getBoundingClientRect())
    return { largura: f.width, alturas: Math.abs(f.height - v.height), espaco: v.left - f.right, topo: v.top - f.top }
  })
  expect(Math.abs(medidas.largura - LARGURA_CR80)).toBeLessThan(1)
  expect(Math.abs(medidas.espaco)).toBeLessThan(0.5)
  expect(medidas.alturas).toBeLessThan(0.5)
  expect(Math.abs(medidas.topo)).toBeLessThan(0.5)
  expect(await par.locator('.credencial').nth(0).evaluate(textosQueTransbordam)).toBe(0)
  expect(await par.locator('.credencial').nth(1).evaluate(textosQueTransbordam)).toBe(0)
  await page.emulateMedia({ media: 'screen' })

  // 4. Validação pública, sem login: válida, com a foto publicada e sem CPF
  const visitante = await browser.newContext()
  const v = await visitante.newPage()
  await v.goto(link!)
  const resultado = v.getByLabel('Resultado da validação')
  await expect(resultado).toContainText('Credencial válida')
  await expect(resultado).toContainText(nome)
  await expect(resultado).not.toContainText('CPF')
  await expect(async () => {
    await v.reload()
    await expect(v.getByRole('img', { name: `Foto de ${nome}` })).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 30_000 })

  // 5. Perda: a secretaria (aqui, a presidência) emite outra; o QR antigo passa a dizer "substituída"
  await trocarPara(page, 'presidencia')
  await page.goto('credenciais')
  await page.getByLabel('Buscar associado').fill(nome)
  await page.getByRole('listitem', { name: nome }).getByRole('link', { name: 'Ver a credencial' }).click()
  await page.getByLabel('Motivo *').fill('Perda (teste automático)')
  await page.getByRole('button', { name: 'Emitir nova credencial' }).click()
  await expect(mensagemNaTela(page, 'Nova credencial emitida.')).toBeVisible()
  await v.reload()
  await expect(v.getByLabel('Resultado da validação')).toContainText('Credencial substituída')
  await visitante.close()

  await arquivarAssociadoDeTeste(page, nome)
})

test('o ministro não abre a lista de credenciais (só a secretaria e a presidência)', async ({ page }) => {
  await trocarPara(page, 'ministro')
  await page.goto('credenciais')
  await expect(page.getByRole('list', { name: 'Credenciais' })).toHaveCount(0)
})
