// Fase 1.1 — cadastros da secretaria/presidência: igrejas, associados, perfis de acesso e auditoria.
// Usa dados FICTÍCIOS do banco de teste. O que o teste cria, ele mesmo arquiva no fim (nada se apaga).
import { expect, test } from '@playwright/test'
import {
  abrirAbaDaFicha,
  abrirAbaDaIgreja,
  abrirFuncao,
  arquivarCadastroAberto,
  arquivarIgrejaAberta,
  arquivoDaSessao,
  cadastrarMinistro,
  cnpjAleatorio,
  DENOMINACAO_DE_TESTE,
  sufixoUnico,
} from './ajuda'

const IGREJA_A = 'Igreja Fictícia A (teste)'
const IGREJA_B = 'Igreja Fictícia B (teste)'
const PESSOA_PERFIS = 'Pessoa Fictícia para Perfis (teste)'

// Sessão da presidência fictícia, guardada em autenticacao.setup.ts (sem novo login a cada teste)
test.use({ storageState: arquivoDaSessao('presidencia') })

test('cadastra, corrige e arquiva uma igreja; a auditoria registra tudo', async ({ page }, info) => {
  const nome = `Igreja E2E ${sufixoUnico(info.project.name)}`

  // Igrejas › Cadastrar igreja (Fase 5.5): a igreja com registro, em 5 passos
  await page.goto('igrejas')
  await abrirFuncao(page, 'Cadastrar igreja')
  await expect(page).toHaveURL(/\/igrejas\/nova$/)
  await page.getByLabel(/^Nome da igreja/).fill(nome)
  await page.getByLabel(/^Denominação/).selectOption({ label: DENOMINACAO_DE_TESTE })

  // CNPJ com dígito errado é recusado antes de continuar
  await page.getByLabel(/^CNPJ/).fill('11.222.333/0001-82')
  await page.getByRole('button', { name: /^Continuar/ }).click()
  await expect(page.getByRole('alert')).toContainText('CNPJ válido')

  await page.getByLabel(/^CNPJ/).fill(cnpjAleatorio())
  const sigla = `E2E${Date.now().toString(36).slice(-6).toUpperCase()}${info.project.name.slice(0, 1).toUpperCase()}`
  await page.getByLabel(/^Sigla/).fill(sigla)
  // os passos: endereço e contato, pastor e diretoria, documentos (dá para mandar depois) e revisar
  for (let passo = 0; passo < 4; passo++) await page.getByRole('button', { name: /^Continuar/ }).click()
  await expect(page.getByText('Faltam: Estatuto da igreja, Cartão CNPJ, Ata da diretoria.')).toBeVisible()
  await page.getByRole('button', { name: 'Cadastrar a igreja' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Igreja cadastrada.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
  await expect(page.getByLabel(/^Sigla/)).toHaveValue(sigla)

  await page.getByLabel(/^Bairro/).selectOption({ label: 'Bairro Fictício' })
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Alterações salvas.' })).toBeVisible()

  // sem os documentos, a igreja nova fica regular até o fim da transição, com a pendência (a natureza já veio no cadastro)
  await abrirAbaDaIgreja(page, 'Situação')
  await expect(page.getByRole('region', { name: 'A igreja', exact: true })).toContainText('Regular')
  await expect(page.getByText(/^faltam 4 itens \(até /)).toBeVisible()

  await arquivarIgrejaAberta(page)
  await expect(page.getByRole('status').filter({ hasText: `Igreja "${nome}" arquivada.` })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Igrejas', exact: true }).getByText(nome)).toHaveCount(0)

  await page.goto('auditoria')
  await page.getByLabel('Mostrar').selectOption({ label: 'Igrejas' })
  const registros = page.getByRole('list', { name: 'Registros da auditoria' })
  await expect(registros.getByText(`Criação · Igrejas · ${nome}`)).toBeVisible()
  await expect(registros.getByText(`Alteração · Igrejas · ${nome}`)).toBeVisible()
  await expect(registros.getByText(`Arquivamento · Igrejas · ${nome}`)).toBeVisible()
})

test('cadastra um associado atual, registra a troca de igreja e arquiva o cadastro', async ({ page }, info) => {
  const nome = `Ministro E2E ${sufixoUnico(info.project.name)}`

  // Cadastrar ministro: passo a passo (1 Dados pessoais, 2 Igreja e ministério, 3 No COMEP)
  await page.goto('ministros')
  await abrirFuncao(page, 'Cadastrar ministro')
  await expect(page).toHaveURL(/\/ministros\/novo$/)
  // o passo não avança sem o nome (campo obrigatório)
  await page.getByRole('button', { name: /^Continuar/ }).click()
  await expect(page.getByLabel(/^Nome completo/)).toBeVisible()
  await cadastrarMinistro(page, {
    nome,
    telefone: '(94) 90000-0000',
    igreja: IGREJA_A,
    funcao: 'Pastor de congregação',
  })
  await expect(page.getByText(/^Nº \d{4,}$/)).toBeVisible()
  await expect(page.getByText('Sem login', { exact: true })).toBeVisible()

  // Troca de igreja (aba Igreja da ficha): encerra a A e abre a B
  await abrirAbaDaFicha(page, 'Igreja')
  await page.getByLabel(/^Nova igreja/).selectOption({ label: IGREJA_B })
  await page.getByLabel(/^Função$/).fill('Pastor auxiliar')
  await page.getByRole('button', { name: 'Registrar a troca' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Troca de igreja registrada.' })).toBeVisible()
  const historico = page.getByRole('list', { name: 'Histórico de igrejas' })
  await expect(historico).toContainText(IGREJA_A)
  await expect(historico).toContainText(IGREJA_B)

  // Aparece na lista com a igreja nova
  await page.getByRole('link', { name: '← Ministros' }).click()
  await page.getByLabel('Buscar ministro', { exact: true }).fill(nome)
  await expect(page.getByRole('list', { name: 'Ministros' })).toContainText(IGREJA_B)

  // Arquiva (cadastro de teste, aba Situação) — sai da lista, nada se apaga
  await page.getByRole('list', { name: 'Ministros' }).getByRole('link').first().click()
  await arquivarCadastroAberto(page)
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

test('perfil da diretoria não vai para quem não é associado (login criado pelo site)', async ({ page }) => {
  const NAO_ASSOCIADO = 'Pessoa Sem Perfil'
  await page.goto('acessos')
  await page.getByLabel('Buscar pessoa').fill(NAO_ASSOCIADO)
  const pessoa = page.getByRole('listitem', { name: NAO_ASSOCIADO })
  await expect(pessoa).toContainText('Não é associado: login criado pelo site')
  await pessoa.getByLabel(`Perfil para conceder a ${NAO_ASSOCIADO}`).selectOption({ label: 'Tesouraria' })
  await pessoa.getByRole('button', { name: 'Conceder' }).click()
  await expect(page.getByRole('alert')).toContainText('só podem ser dados a associados ativos')
  await expect(pessoa.getByRole('list', { name: `Perfis de ${NAO_ASSOCIADO}` })).not.toContainText('Tesouraria')
})

test('nenhuma tela da diretoria fica mais larga que a tela', async ({ page }) => {
  for (const caminho of [
    'painel',
    'modulos',
    'igrejas',
    'igrejas/nova',
    'ministros',
    'ministros/novo',
    'ministros/correcoes',
    'acessos',
    'auditoria',
    'configuracoes',
    'inscricoes',
  ]) {
    await page.goto(caminho)
    await page.waitForLoadState('networkidle')
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(sobra, `a tela "${caminho}" passou ${sobra}px da largura`).toBeLessThanOrEqual(0)
  }
})
