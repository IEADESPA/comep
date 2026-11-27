// Fase 5.5 (telas novas, parte 5): o módulo Igrejas da secretaria — o painel, a tabela por situação, a igreja sem
// registro (cadastro simples, com as limitações), a Central de regularização e a tradição das denominações.
// Dados FICTÍCIOS do banco de teste; a igreja criada aqui é arquivada no fim (nada se apaga).
import { expect, test } from '@playwright/test'
import { abrirAbaDaIgreja, abrirFuncao, arquivarIgrejaAberta, arquivoDaSessao, DENOMINACAO_DE_TESTE, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

test('o painel do módulo, a tabela por situação e a Central de regularização', async ({ page }) => {
  await page.goto('igrejas')
  await expect(page.getByRole('heading', { name: 'Todas as igrejas', level: 1 })).toBeVisible()
  const numeros = page.getByRole('list', { name: 'Os números das igrejas' })
  for (const n of ['Regulares', 'Suspensas', 'Sem registro', 'Congregações e filiais']) await expect(numeros).toContainText(n)
  await expect(page.getByRole('heading', { name: 'Precisam de atenção' })).toBeVisible()

  // a subfunção "Regulares" da função Igrejas abre a tabela filtrada
  await abrirFuncao(page, 'Regulares', 'Igrejas')
  await expect(page).toHaveURL(/\/igrejas\/lista\/regulares$/)
  await expect(page.getByRole('heading', { name: 'Regulares', level: 1 })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Igrejas', exact: true }).getByRole('link').first()).toBeVisible()

  await abrirFuncao(page, 'Central de regularização')
  await expect(page).toHaveURL(/\/igrejas\/regularizacao$/)
  await expect(page.getByRole('heading', { name: 'As regras' })).toBeVisible()
  // as regras de 26/11/2026: os dias, sem o fim da transição
  const regras = page.getByRole('region', { name: 'As regras' })
  await expect(regras.getByLabel('Dias para mandar o documento que falta ou que venceu')).toHaveValue('30')
  await expect(regras.getByLabel(/^Tolerância do alvará que vence em 31\/12/)).toHaveValue('31')
  await expect(regras.getByLabel('Dias para mandar de novo, depois da recusa fora do prazo')).toHaveValue('7')
  await expect(regras.getByLabel('Dias da associação privada para mudar para organização religiosa')).toHaveValue('120')
  await expect(regras.getByLabel('Dias da igreja sem registro para se registrar')).toHaveValue('120')
  await expect(regras).toContainText('O alvará que vence em 31/12 só suspende se o novo não chegar até 31/01.')

  // S7-08: antes de salvar, a tela diz quantas igrejas mudam de situação hoje; "Voltar" não salva nada
  await regras.getByLabel('Dias para mandar de novo, depois da recusa fora do prazo').fill('8')
  await regras.getByRole('button', { name: 'Salvar as regras' }).click()
  await expect(regras.getByRole('status').filter({ hasText: /^Com estas regras, / })).toBeVisible()
  await expect(regras.getByRole('button', { name: 'Confirmar e salvar as regras' })).toBeVisible()
  await regras.getByRole('button', { name: 'Voltar' }).click()
  await expect(regras.getByRole('button', { name: 'Salvar as regras' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: 'As regras' }).getByLabel('Dias para mandar de novo, depois da recusa fora do prazo')).toHaveValue('7')
})

test('a igreja sem registro: o cadastro simples, as limitações e o caminho para regularizar', async ({ page }, info) => {
  const nome = `Igreja Sem Registro E2E ${sufixoUnico(info.project.name)}`
  await page.goto('igrejas/nova')
  await page.getByText('Ainda não', { exact: true }).click()
  const form = page.getByRole('form', { name: 'Cadastro simples, sem registro' })
  await form.getByLabel(/^Nome da igreja/).fill(nome)
  await form.getByLabel(/^Denominação/).selectOption({ label: DENOMINACAO_DE_TESTE })
  await form.getByLabel('Pessoa de contato').fill('Pr. Contato Fictício')
  await expect(page.getByRole('list', { name: 'O que fica limitado' })).toContainText('Não pede empréstimos do patrimônio')
  await form.getByRole('button', { name: 'Cadastrar sem registro' }).click()
  await expect(mensagemNaTela(page, 'Igreja cadastrada sem registro.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'A igreja', exact: true })).toContainText('Sem registro')

  // a aba Situação: as limitações e o "Regularizar a igreja"; a agenda não registra empréstimo
  await abrirAbaDaIgreja(page, 'Situação')
  await expect(page.getByRole('list', { name: 'O que fica limitado' })).toContainText('Ninguém recebe o perfil de pastor presidente')
  // regras de 26/11/2026: o prazo para se registrar conta do cadastro (120 dias, nas regras)
  await expect(page.getByRole('list', { name: 'O que fica limitado' })).toContainText('Tem 120 dias para se regularizar')
  await expect(page.getByText(/^sem CNPJ, estatuto e ata: cadastro simples · registrar até \d{2}\/\d{2}\/\d{4}$/)).toBeVisible()
  await expect(page.getByRole('form', { name: 'Regularizar a igreja' })).toBeVisible()
  await abrirAbaDaIgreja(page, 'Agenda')
  await expect(page.getByText('Sem registro, a igreja não pega empréstimos.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Registrar empréstimo' })).toHaveCount(0)

  // aparece na subfunção "Sem registro"
  await page.goto('igrejas/lista/sem-registro')
  await expect(page.getByRole('list', { name: 'Igrejas', exact: true })).toContainText(nome)

  // Limpeza
  await page.getByRole('list', { name: 'Igrejas', exact: true }).getByRole('link', { name: new RegExp(nome) }).click()
  await arquivarIgrejaAberta(page)
})

test('as denominações ficam no módulo Igrejas, com a tradição', async ({ page }) => {
  await page.goto('igrejas/denominacoes')
  const linha = page.getByRole('listitem', { name: 'Denominação Fictícia (teste)', exact: true })
  await linha.getByLabel('Tradição de Denominação Fictícia (teste)').selectOption({ label: 'Pentecostal' })
  await expect(mensagemNaTela(page, 'Denominação Fictícia (teste): tradição salva.')).toBeVisible()
  await expect(linha).toContainText('Pentecostal')
})
