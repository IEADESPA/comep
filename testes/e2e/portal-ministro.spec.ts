// Fase 1.3: portal do ministro (meu perfil, troca de igreja, senha) e painel do presidente de igreja.
// Dados FICTÍCIOS do banco de teste; os associados e igrejas criados aqui são arquivados no fim.
import { expect, test } from '@playwright/test'
import {
  arquivarAssociadoDeTeste,
  arquivoDaSessao,
  criarAssociadoComLogin,
  mensagemNaTela,
  preencherLogin,
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

test.describe('ministro fictício (sessão guardada)', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê os próprios dados, corrige o telefone e troca a foto', async ({ page }) => {
    await page.goto('meu-perfil')
    await expect(page.getByRole('heading', { name: 'Meu perfil', level: 1 })).toBeVisible()
    const noComep = page.locator('section', { has: page.getByRole('heading', { name: 'No COMEP' }) })
    await expect(noComep).toContainText('Nº de registro')
    await expect(noComep).toContainText('Não presidente de igreja — R$ 20,00 por mês ou R$ 200,00 por ano')
    await expect(page.getByText('Igreja Fictícia A (teste)')).toBeVisible()

    const telefone = `(94) 9${Math.floor(1000 + Math.random() * 8999)}-0000`
    await page.getByLabel('Telefone (WhatsApp)').fill(telefone)
    await page.getByRole('button', { name: 'Salvar meus dados' }).click()
    await expect(mensagemNaTela(page, 'Seus dados foram salvos.')).toBeVisible()

    await page.locator('.botao-arquivo input[type=file]').setInputFiles(FOTO)
    await expect(mensagemNaTela(page, 'Foto atualizada.')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Sua foto' })).toBeVisible()
  })
})

test('o ministro pede troca de igreja, a secretaria aprova; o ministro troca a própria senha', async ({ page }, info) => {
  test.setTimeout(120_000)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Troca E2E ${sufixo}`
  const email = `e2e.troca.${sufixo}@example.com`
  const ministro = await criarAssociadoComLogin(page, {
    nome,
    email,
    senha: 'SenhaE2e123',
    igreja: 'Igreja Fictícia A (teste)',
  })

  // O ministro pede a troca para a Igreja B
  await page.goto('meu-perfil')
  await page.getByText('Pedir troca de igreja').click()
  await page.getByLabel(/^Igreja nova/).selectOption({ label: 'Igreja Fictícia B (teste)' })
  await page.getByLabel('Função na igreja nova').fill('Pastor auxiliar')
  await page.getByRole('button', { name: 'Enviar pedido de troca' }).click()
  await expect(mensagemNaTela(page, 'Pedido de troca de igreja enviado à secretaria.')).toBeVisible()
  await expect(page.getByText(/Pedido de troca para Igreja Fictícia B \(teste\)/)).toBeVisible()

  // ...e troca a própria senha
  await page.getByLabel('Senha atual').fill('SenhaE2e123')
  await page.getByLabel('Senha nova', { exact: true }).fill('NovaSenha789')
  await page.getByLabel('Repita a senha nova').fill('NovaSenha789')
  await page.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(mensagemNaTela(page, 'Senha trocada.')).toBeVisible()

  // A presidência vê o pedido na tela de Ministros e aprova
  await trocarPara(page, 'presidencia')
  await page.goto('ministros')
  const pedido = page.getByRole('listitem', { name: `Troca de ${nome}` })
  await expect(pedido).toContainText('Igreja Fictícia B (teste)')
  await pedido.getByRole('button', { name: 'Aprovar troca' }).click()
  await expect(mensagemNaTela(page, `Troca de igreja de ${nome} aprovada.`)).toBeVisible()

  // O ministro entra com a senha nova e vê a igreja nova, com o histórico
  await trocarPara(page, null)
  await preencherLogin(page, email, 'NovaSenha789')
  await expect(page).toHaveURL(/\/painel$/)
  await page.goto('meu-perfil')
  await expect(page.getByText('Atual: Igreja Fictícia B (teste)')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Histórico de igrejas' })).toContainText('Igreja Fictícia A (teste)')
  void ministro

  await arquivarAssociadoDeTeste(page, nome)
})

test('o pastor presidente vê os ministros da igreja dele e atualiza o contato da igreja', async ({ page }, info) => {
  test.setTimeout(120_000)
  const sufixo = sufixoUnico(info.project.name)
  const igreja = `Igreja E2E ${sufixo}`
  const auxiliar = `Auxiliar E2E ${sufixo}`
  const presidente = `Presidente E2E ${sufixo}`

  // A presidência cadastra a igreja e um ministro auxiliar dela
  await trocarPara(page, 'presidencia')
  await page.goto('igrejas/nova')
  await page.getByLabel(/^Nome da igreja/).fill(igreja)
  await page.getByRole('button', { name: 'Cadastrar igreja' }).click()
  await expect(mensagemNaTela(page, 'Igreja cadastrada.')).toBeVisible()
  const enderecoIgreja = page.url()
  await page.goto('ministros/novo')
  await page.getByLabel(/^Nome completo/).fill(auxiliar)
  await page.getByLabel(/^Telefone/).fill('(94) 92222-2222')
  await page.getByLabel(/^Título ministerial/).selectOption({ label: 'Evangelista' })
  await page.getByLabel(/^Igreja \*/).selectOption({ label: igreja })
  await page.getByLabel(/^Função na igreja/).fill('Evangelista dirigente')
  await page.getByRole('button', { name: 'Cadastrar associado' }).click()
  await expect(mensagemNaTela(page, 'Associado cadastrado.')).toBeVisible()

  // O pastor presidente da igreja cria o login e abre "Minha igreja"
  await criarAssociadoComLogin(page, {
    nome: presidente,
    email: `e2e.presidente.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja,
    pastorPresidente: true,
  })
  await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Presidente de igreja')
  await page.goto('minha-igreja')
  await expect(page.getByRole('heading', { name: igreja, level: 2 })).toBeVisible()
  const ministros = page.getByRole('list', { name: 'Ministros da igreja' })
  await expect(ministros).toContainText(presidente)
  await expect(ministros).toContainText(auxiliar)
  await expect(ministros).toContainText('Evangelista dirigente')
  await expect(ministros.getByRole('link', { name: '(94) 92222-2222' })).toBeVisible()

  await page.getByLabel('Endereço').fill('Rua Fictícia, 100')
  await page.getByLabel('Telefone da igreja').fill('(94) 93333-3333')
  await page.getByRole('button', { name: 'Salvar contato da igreja' }).click()
  await expect(mensagemNaTela(page, 'Contato da igreja atualizado.')).toBeVisible()

  // Limpeza: arquiva os dois associados e a igreja de teste
  await arquivarAssociadoDeTeste(page, auxiliar)
  await arquivarAssociadoDeTeste(page, presidente)
  await page.goto(enderecoIgreja)
  await expect(page.getByLabel('Telefone')).toHaveValue('(94) 93333-3333')
  await page.getByText('Arquivar igreja', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/igrejas$/)
})
