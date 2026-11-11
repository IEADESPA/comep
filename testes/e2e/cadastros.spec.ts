// Fase 1.1 — cadastros da secretaria/presidência: igrejas, associados, perfis de acesso e auditoria.
// Usa dados FICTÍCIOS do banco de teste. O que o teste cria, ele mesmo arquiva no fim (nada se apaga).
import { expect, test } from '@playwright/test'
import { USUARIOS, cnpjAleatorio, entrar, sufixoUnico } from './ajuda'

const IGREJA_A = 'Igreja Fictícia A (teste)'
const IGREJA_B = 'Igreja Fictícia B (teste)'
const PESSOA_PERFIS = 'Pessoa Fictícia para Perfis (teste)'

test.beforeEach(async ({ page }) => {
  await entrar(page, USUARIOS.presidencia)
})

test('cadastra, corrige e arquiva uma igreja; a auditoria registra tudo', async ({ page }, info) => {
  const nome = `Igreja E2E ${sufixoUnico(info.project.name)}`

  await page.goto('igrejas')
  await page.getByRole('link', { name: 'Nova igreja' }).click()
  await page.getByLabel(/^Nome da igreja/).fill(nome)
  await page.getByLabel(/^Denominação/).selectOption({ label: 'Denominação Fictícia (teste) (DFT)' })

  // CNPJ com dígito errado é recusado antes de salvar
  await page.getByLabel(/^CNPJ/).fill('11.222.333/0001-82')
  await page.getByRole('button', { name: 'Cadastrar igreja' }).click()
  await expect(page.getByRole('alert')).toContainText('CNPJ inválido')

  await page.getByLabel(/^CNPJ/).fill(cnpjAleatorio())
  await page.getByRole('button', { name: 'Cadastrar igreja' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Igreja cadastrada.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()

  await page.getByLabel(/^Bairro/).fill('Centro')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible()

  await page.getByText('Arquivar igreja', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/comep\/igrejas$/)
  await expect(page.getByRole('status').filter({ hasText: `Igreja "${nome}" arquivada.` })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Igrejas' }).getByText(nome)).toHaveCount(0)

  await page.goto('auditoria')
  await page.getByLabel('Mostrar').selectOption({ label: 'Igrejas' })
  const registros = page.getByRole('list', { name: 'Registros da auditoria' })
  await expect(registros.getByText(`Criação · Igrejas · ${nome}`)).toBeVisible()
  await expect(registros.getByText(`Alteração · Igrejas · ${nome}`)).toBeVisible()
  await expect(registros.getByText(`Arquivamento · Igrejas · ${nome}`)).toBeVisible()
})

test('cadastra um associado atual, registra a troca de igreja e arquiva o cadastro', async ({ page }, info) => {
  const nome = `Ministro E2E ${sufixoUnico(info.project.name)}`

  await page.goto('ministros')
  await page.getByRole('link', { name: 'Cadastrar associado' }).click()
  await page.getByLabel(/^Nome completo/).fill(nome)
  await page.getByLabel(/^Telefone/).fill('(94) 90000-0000')
  await page.getByLabel(/^Título ministerial/).selectOption({ label: 'Pastor' })
  await page.getByLabel(/^Igreja \*/).selectOption({ label: IGREJA_A })
  await page.getByLabel(/^Função na igreja/).fill('Pastor presidente')
  await page.getByRole('button', { name: 'Cadastrar associado' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Associado cadastrado.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
  await expect(page.getByText(/Nº de registro \d+/)).toBeVisible()
  await expect(page.getByText('Sem login')).toBeVisible()

  // Troca de igreja: encerra a A e abre a B
  await page.getByText('Registrar troca de igreja').click()
  await page.getByLabel(/^Nova igreja/).selectOption({ label: IGREJA_B })
  await page.getByLabel(/^Função$/).fill('Pastor auxiliar')
  await page.getByRole('button', { name: 'Registrar troca' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Troca de igreja registrada.' })).toBeVisible()
  const historico = page.getByRole('list', { name: 'Histórico de igrejas' })
  await expect(historico).toContainText(IGREJA_A)
  await expect(historico).toContainText(IGREJA_B)

  // Aparece na lista com a igreja nova
  await page.getByRole('link', { name: '← Ministros' }).click()
  await page.getByLabel('Buscar associado').fill(nome)
  await expect(page.getByRole('list', { name: 'Associados' })).toContainText(IGREJA_B)

  // Arquiva (cadastro de teste) — sai da lista, nada se apaga
  await page.getByRole('list', { name: 'Associados' }).getByRole('link').first().click()
  await page.getByText('Arquivar cadastro', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/comep\/ministros$/)
  await expect(page.getByRole('status').filter({ hasText: `Cadastro de ${nome} arquivado.` })).toBeVisible()
})

test('a presidência concede e retira um perfil de acesso', async ({ page }) => {
  await page.goto('acessos')
  await page.getByLabel('Buscar pessoa').fill(PESSOA_PERFIS)
  const pessoa = page.getByRole('listitem', { name: PESSOA_PERFIS })
  const perfis = pessoa.getByRole('list', { name: `Perfis de ${PESSOA_PERFIS}` })
  const retirar = pessoa.getByRole('button', { name: `Retirar o perfil Tesouraria de ${PESSOA_PERFIS}` })

  // Se uma execução anterior parou no meio, começa do zero
  if (await retirar.isVisible()) {
    await retirar.click()
    await expect(perfis).not.toContainText('Tesouraria')
  }

  await pessoa.getByLabel(`Perfil para conceder a ${PESSOA_PERFIS}`).selectOption({ label: 'Tesouraria' })
  await pessoa.getByRole('button', { name: 'Conceder' }).click()
  await expect(page.getByRole('status').filter({ hasText: `Perfil Tesouraria concedido a ${PESSOA_PERFIS}.` })).toBeVisible()
  await expect(perfis).toContainText('Tesouraria')

  await retirar.click()
  await expect(page.getByRole('status').filter({ hasText: `Perfil Tesouraria retirado de ${PESSOA_PERFIS}.` })).toBeVisible()
  await expect(perfis).not.toContainText('Tesouraria')
})

test('nenhuma tela da diretoria fica mais larga que a tela', async ({ page }) => {
  for (const caminho of ['painel', 'igrejas', 'igrejas/nova', 'ministros', 'ministros/novo', 'acessos', 'auditoria']) {
    await page.goto(caminho)
    await page.waitForLoadState('networkidle')
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(sobra, `a tela "${caminho}" passou ${sobra}px da largura`).toBeLessThanOrEqual(0)
  }
})
