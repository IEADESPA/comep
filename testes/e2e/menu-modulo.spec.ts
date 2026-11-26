// Telas novas (Fase 5.5): o menu do módulo, aprovado em 18/11/2026 para TODOS os módulos ("o módulo toma a coluna").
// No computador, a coluna vermelha vira o menu do módulo (Início, o módulo com "N funções", as funções e as
// subfunções da função aberta). No celular, um botão logo abaixo da barra vermelha abre a lista das funções.
// Nada de abas no alto para os submódulos, e nada de barra embaixo no celular.
import { expect, test } from '@playwright/test'
import { abrirFuncao, arquivoDaSessao, funcoesDoModulo, nomeDaFuncao, noCelular } from './ajuda'

test.describe('presidência', () => {
  test.use({ storageState: arquivoDaSessao('presidencia') })

  test('Ministros e inscrições: as quatro funções, a aberta marcada, e a volta ao Início', async ({ page }) => {
    await page.goto('ministros')
    await expect(page.getByRole('heading', { name: 'Ministros', level: 1 })).toBeVisible()

    if (noCelular(page)) {
      // o botão da função aberta fica logo abaixo da barra vermelha, na metade de cima da tela
      const botao = page.getByRole('button', { name: /^Funções do módulo/ })
      await expect(botao).toContainText('Ministros')
      await expect(botao).toContainText('4 funções')
      const caixa = await botao.boundingBox()
      expect(caixa!.y, 'o botão fica no alto').toBeLessThan((page.viewportSize()?.height ?? 0) / 2)
    } else {
      const coluna = page.getByRole('navigation', { name: 'Menu principal' })
      await expect(coluna).toContainText('Ministros e inscrições')
      await expect(coluna).toContainText('4 funções')
      await expect(coluna.getByRole('link', { name: nomeDaFuncao('Ministros') })).toHaveAttribute('aria-current', 'page')
    }

    const funcoes = await funcoesDoModulo(page)
    for (const f of ['Ministros', 'Pedidos de associação', 'Correções pedidas', 'Cadastrar ministro']) {
      await expect(funcoes.getByRole('link', { name: nomeDaFuncao(f) })).toBeVisible()
    }

    await funcoes.getByRole('link', { name: nomeDaFuncao('Pedidos de associação') }).click()
    await expect(page).toHaveURL(/\/inscricoes$/)
    await expect(page.getByRole('heading', { name: 'Pedidos de associação', level: 1 })).toBeVisible()
    // os submódulos não são mais abas no alto
    await expect(page.getByRole('tablist')).toHaveCount(0)

    await abrirFuncao(page, 'Correções pedidas')
    await expect(page).toHaveURL(/\/ministros\/correcoes$/)
    await expect(page.getByRole('heading', { name: 'Correções pedidas', level: 1 })).toBeVisible()

    await abrirFuncao(page, 'Cadastrar ministro')
    await expect(page).toHaveURL(/\/ministros\/novo$/)
    await expect(page.getByRole('heading', { name: 'Cadastrar ministro', level: 1 })).toBeVisible()

    // fora do módulo, volta o menu curto
    if (!noCelular(page)) {
      await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Início', exact: true }).click()
      await expect(page).toHaveURL(/\/painel$/)
      await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: nomeDaFuncao('Pedidos de associação') })).toHaveCount(0)
    } else {
      await page.goto('painel')
      await expect(page.getByRole('button', { name: /^Funções do módulo/ })).toHaveCount(0)
    }
  })

  test('as subfunções abrem embaixo da função aberta (sanfona)', async ({ page }) => {
    await page.goto('financeiro/contribuicoes')
    await expect(page.getByRole('heading', { name: 'Situação dos ministros', level: 1 })).toBeVisible()
    const subfuncoes = page.getByRole('list', { name: 'Subfunções', exact: true })

    if (noCelular(page)) {
      // no celular, a lista mostra as funções e as subfunções
      const funcoes = await funcoesDoModulo(page)
      await expect(funcoes.getByRole('link', { name: 'Situação dos ministros' })).toHaveAttribute('aria-current', 'page')
      await funcoes.getByRole('link', { name: 'Cobranças do ano' }).click()
    } else {
      await expect(subfuncoes.getByRole('link', { name: 'Situação dos ministros' })).toHaveAttribute('aria-current', 'page')
      await subfuncoes.getByRole('link', { name: 'Cobranças do ano' }).click()
    }
    await expect(page).toHaveURL(/\/financeiro\/contribuicoes\/cobrancas$/)
    await expect(page.getByRole('heading', { name: 'Cobranças do ano', level: 1 })).toBeVisible()

    // abriu outra função: as subfunções da anterior fecham
    await abrirFuncao(page, 'Caixa')
    await expect(page).toHaveURL(/\/financeiro\/caixa$/)
    await expect(page.getByRole('list', { name: 'Saldos' })).toBeVisible()
    if (!noCelular(page)) {
      await expect(subfuncoes.getByRole('link', { name: 'Cobranças do ano' })).toHaveCount(0)
      await expect(subfuncoes.getByRole('link', { name: 'Lançamentos' })).toHaveAttribute('aria-current', 'page')
    }
  })
})

test.describe('presidência: o menu recolhido', () => {
  test.use({ storageState: arquivoDaSessao('presidencia') })

  // rodada 18, menu-recolhido opção 1 (parte 14): o trilho de ícones, só no computador
  test('recolher deixa só os ícones, com o nome ao passar o mouse, e a escolha fica guardada', async ({ page }) => {
    test.skip(noCelular(page), 'no celular nada muda: lá não existe a coluna')
    await page.goto('assembleias')
    const coluna = page.getByRole('navigation', { name: 'Menu principal' })
    await expect(coluna).toContainText('7 funções')
    await coluna.getByRole('button', { name: 'Recolher o menu' }).click()
    await expect(coluna.getByRole('button', { name: 'Abrir o menu' })).toBeVisible()
    await expect(coluna).not.toContainText('7 funções')
    expect((await coluna.boundingBox())!.width, 'a coluna fica fina').toBeLessThan(100)
    // as funções continuam lá: o ícone, o nome para o leitor de tela e a dica ao passar o mouse
    const presenca = coluna.getByRole('link', { name: nomeDaFuncao('Presença') })
    await expect(presenca).toHaveAttribute('data-dica', 'Presença')
    await presenca.hover()
    await presenca.click()
    await expect(page).toHaveURL(/\/assembleias\/presenca/)
    // a escolha fica guardada (para esta pessoa, neste aparelho)
    await page.reload()
    await expect(coluna.getByRole('button', { name: 'Abrir o menu' })).toBeVisible()
    await coluna.getByRole('button', { name: 'Abrir o menu' }).click()
    await expect(coluna).toContainText('7 funções')
    await expect(coluna.getByRole('button', { name: 'Recolher o menu' })).toBeVisible()
  })
})

test.describe('ministro', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê só as funções do perfil dele (Assembleias sem preparar nem faltas)', async ({ page }) => {
    await page.goto('assembleias')
    await expect(page.getByRole('heading', { name: 'Assembleias e reuniões', level: 1 })).toBeVisible()
    const funcoes = await funcoesDoModulo(page)
    await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Pedidos de AGE') })).toBeVisible()
    await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Preparar') })).toHaveCount(0)
    await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Faltas e justificativas') })).toHaveCount(0)
    if (noCelular(page)) await expect(page.getByRole('button', { name: /^Funções do módulo/ })).toContainText('2 funções')
    else await expect(funcoes).toContainText('2 funções')
  })
})
