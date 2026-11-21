// Telas novas, parte 13 (Fase 5.5): o termo de uso de dados (LGPD). O primeiro acesso de um associado fictício: logo
// depois de criar a senha, o termo aparece na tela inteira (o resumo em 9 pontos, o dado sensível, o opcional e o
// aceite); "Agora não" deixa entrar e pergunta de novo no próximo acesso; aceito, fica em Meu perfil › Privacidade.
// A secretaria (aqui, a presidência fictícia) vê as versões e quem aceitou. Também: Meu perfil › Segurança.
import { expect, test, type Page } from '@playwright/test'
import { arquivarAssociadoDeTeste, arquivoDaSessao, cadastrarMinistro, abrirAbaDaFicha, mensagemNaTela, sufixoUnico, trocarPara } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

const PREFIXO = 'Associado Termo E2E'

/**
 * Arquiva os associados "Associado Termo E2E …" que sobraram de uma rodada cortada no meio (antes do `finally`). Os
 * testes rodam um de cada vez (workers: 1), então nenhum outro teste está usando esses cadastros.
 */
async function arquivarSobrasDeRodadasAnteriores(page: Page) {
  await page.goto(`ministros?busca=${encodeURIComponent(PREFIXO)}`)
  const lista = page.getByRole('list', { name: 'Ministros' })
  await expect(lista.or(page.getByText('Nenhum ministro encontrado.')).first()).toBeVisible()
  const sobras = (await lista.locator('strong').allTextContents()).filter((n) => n.startsWith(PREFIXO)).slice(0, 10)
  for (const sobra of sobras) await arquivarAssociadoDeTeste(page, sobra)
}

test('primeiro acesso: o termo na tela inteira, "Agora não", o aceite com o dado sensível e Meu perfil › Privacidade', async ({ page }, info) => {
  test.setTimeout(240_000)
  await arquivarSobrasDeRodadasAnteriores(page)
  const marca = sufixoUnico(info.project.name)
  const nome = `${PREFIXO} ${marca}`
  const email = `termo.${marca}@example.com`
  const senha = 'SenhaTermo2026'

  // a presidência cadastra e gera o código de primeiro acesso
  await cadastrarMinistro(page, { nome, igreja: 'Igreja Fictícia A (teste)' })
  await abrirAbaDaFicha(page, 'Acesso')
  await page.getByRole('button', { name: 'Gerar código de primeiro acesso' }).click()
  const codigo = (await page.locator('.codigo').textContent())?.trim() ?? ''

  try {
    // o associado cria a senha: o termo aparece na tela inteira
    await trocarPara(page, null)
    await page.goto('primeiro-acesso')
    await page.getByLabel('Código de acesso').fill(codigo)
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha nova').fill(senha)
    await page.getByLabel('Repita a senha').fill(senha)
    await page.getByRole('button', { name: 'Criar a minha senha' }).click()
    const titulo = page.getByRole('heading', { name: 'O termo de uso dos seus dados', level: 1 })
    await expect(titulo).toBeVisible()
    await expect(page.getByRole('list', { name: 'O resumo do termo' }).getByRole('listitem')).toHaveCount(9)
    await expect(page.getByText('Um dado sensível: a sua fé')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Receber avisos pelo WhatsApp' })).toBeVisible()
    // sem marcar o aceite (com o dado sensível), não continua
    await expect(page.getByRole('button', { name: 'Aceitar e continuar' })).toBeDisabled()

    // o termo completo abre sem sair do sistema
    await page.getByRole('link', { name: 'Ler o termo completo ›' }).click()
    await expect(page.getByRole('navigation', { name: 'As partes do termo' }).getByRole('link')).toHaveCount(10)
    await expect(page.getByText('Minuta.', { exact: true })).toBeVisible()
    await page.goBack()

    // "Agora não": entra no sistema
    await page.getByRole('button', { name: 'Agora não' }).click()
    await expect(titulo).toHaveCount(0)
    await expect(page.locator('.estrutura')).toBeVisible()

    // no próximo acesso (nova aba), pergunta de novo; aceita, com o WhatsApp desligado
    const nova = await page.context().newPage()
    await nova.goto('painel')
    await expect(nova.getByRole('heading', { name: 'O termo de uso dos seus dados', level: 1 })).toBeVisible()
    await nova.getByRole('switch', { name: 'Receber avisos pelo WhatsApp' }).click()
    await nova.getByRole('checkbox', { name: /^Li e aceito o termo de uso de dados \(versão \d+\), inclusive o uso do dado sensível/ }).check()
    await nova.getByRole('button', { name: 'Aceitar e continuar' }).click()
    await expect(nova.locator('.estrutura')).toBeVisible()

    // Meu perfil › Privacidade: o termo aceito, o aparelho e a escolha do WhatsApp
    await nova.goto('meu-perfil/privacidade')
    const aceito = nova.getByRole('region', { name: 'O termo que você aceitou' })
    await expect(aceito).toContainText(/Versão \d+, aceita em \d\d\/\d\d\/\d{4}, às \d{1,2}h/)
    await expect(nova.getByRole('switch', { name: 'Receber avisos pelo WhatsApp' })).toHaveAttribute('aria-checked', 'false')
    // Meu perfil › Segurança: a sessão de 30 dias e a chave de acesso (ainda não ligada no servidor)
    await nova.goto('meu-perfil/seguranca')
    await expect(nova.getByRole('region', { name: 'Este aparelho' })).toContainText('30 dias')
    await expect(nova.getByRole('region', { name: 'Chave de acesso (digital ou rosto)' })).toContainText('Ainda não ligada')
    await nova.close()
  } finally {
    await arquivarAssociadoDeTeste(page, nome)
  }
})

test('a secretaria vê as versões do termo e quem aceitou', async ({ page }) => {
  await page.goto('configuracoes/termo')
  await expect(page.getByRole('heading', { name: 'Termo de uso de dados', level: 1 })).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Versão 1')
  await expect(page.getByRole('heading', { name: /^Aceitaram a versão \d+$/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Pedidos de exclusão' })).toBeVisible()
  void mensagemNaTela
})
