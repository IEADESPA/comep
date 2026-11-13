// Fase 3.1: dados da credencial — o associado preenche CPF e filiação no perfil (depois, só a secretaria corrige);
// a secretaria (aqui, a presidência) vê as pendências na ficha, corrige e filtra a lista.
// Associado FICTÍCIO criado pelo próprio teste (e arquivado no fim).
import { expect, test } from '@playwright/test'
import {
  arquivarAssociadoDeTeste,
  cpfAleatorio,
  criarAssociadoComLogin,
  mensagemNaTela,
  sufixoUnico,
  trocarPara,
} from './ajuda'

const comPontos = (cpf: string) => `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`

test('CPF e filiação: o associado preenche, a secretaria corrige; pendências da credencial', async ({ page }, info) => {
  test.setTimeout(150_000)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Credencial E2E ${sufixo}`
  const cpf = cpfAleatorio()
  const associado = await criarAssociadoComLogin(page, {
    nome,
    email: `e2e.credencial.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja: 'Igreja Fictícia A (teste)',
  })

  // 1. No perfil, a credencial mostra o que falta
  await trocarPara(page, associado)
  await page.goto('meu-perfil')
  const pendencias = page.getByRole('list', { name: 'Pendências da credencial' })
  await expect(pendencias).toContainText('Sem CPF')
  await expect(pendencias).toContainText('Sem o nome da mãe')

  // CPF com dígito errado é recusado na própria tela
  await page.getByLabel(/^CPF/).fill('123.456.789-00')
  await page.getByRole('button', { name: 'Salvar meus dados' }).click()
  await expect(page.getByRole('alert')).toContainText('CPF inválido')

  await page.getByLabel(/^CPF/).fill(cpf)
  await page.getByLabel(/^Nome da mãe/).fill('Mãe Fictícia')
  await page.getByRole('button', { name: 'Salvar meus dados' }).click()
  await expect(mensagemNaTela(page, 'Seus dados foram salvos.')).toBeVisible()
  await expect(pendencias).not.toContainText('Sem CPF')
  await expect(pendencias).not.toContainText('Sem o nome da mãe')
  // Depois de preenchido, o associado não muda mais
  await expect(page.getByLabel(/^CPF/)).toBeDisabled()
  await expect(page.getByLabel(/^CPF/)).toHaveValue(comPontos(cpf))
  await expect(page.getByText(/só a secretaria corrige/)).toBeVisible()

  // 2. A secretaria (aqui, a presidência) vê na ficha e corrige
  await trocarPara(page, 'presidencia')
  await page.goto('ministros')
  await page.getByLabel('Buscar associado').fill(nome)
  await page.getByRole('link', { name: new RegExp(nome) }).click()
  const contato = page.getByRole('region', { name: 'Contato' })
  await expect(contato).toContainText(comPontos(cpf))
  await expect(contato).toContainText('Mãe Fictícia')
  await expect(page.getByRole('list', { name: 'Pendências da credencial' })).toContainText('Sem foto')

  const corrigido = cpfAleatorio()
  await contato.getByRole('button', { name: 'Editar' }).click()
  await contato.getByLabel(/^CPF/).fill(corrigido)
  await contato.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(mensagemNaTela(page, 'Dados de contato salvos.')).toBeVisible()
  await expect(contato).toContainText(comPontos(corrigido))

  // 3. A lista de ministros filtra quem tem pendência na credencial
  await page.goto('ministros')
  await page.getByLabel(/Só com pendência na credencial/).check()
  await page.getByLabel('Buscar associado').fill(nome)
  await expect(page.getByRole('list', { name: 'Associados' })).toContainText('Credencial:')

  await arquivarAssociadoDeTeste(page, nome)
})
