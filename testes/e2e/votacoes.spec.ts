// Fase 5.5.2: votações e enquetes on-line. A presidência FICTÍCIA prepara e abre uma enquete secreta para todos os
// associados; o ministro fictício (em atraso de propósito, mas a enquete é de todos) vê o "Vote agora", vota e não vê a
// contagem antes do fim; a presidência encerra e o ministro vê o resultado. A enquete fica encerrada no banco de teste
// (nada se apaga), com "E2E" no título. As regras finas (voto secreto, maiorias, prazo, item da pauta) estão nos testes
// do banco: testes/banco/votacoes.test.ts.
import { expect, test } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

test('enquete secreta: preparar, abrir, o ministro vota, encerrar e o resultado', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  const titulo = `Enquete E2E ${sufixoUnico(info.project.name)}`
  await page.goto('votacoes')
  await page.getByRole('link', { name: 'Nova votação ou enquete' }).click()
  const form = page.getByRole('form', { name: 'Votação' })
  await form.getByRole('radio', { name: /^Enquete/ }).check()
  await form.getByLabel(/^Pergunta \*/).fill(titulo)
  await form.getByLabel(/^Opções \*/).fill('Segunda-feira\nTerça-feira\nQuinta-feira')
  await form.getByLabel('Quem vota').selectOption({ label: 'Todos os associados' })
  await expect(form.getByRole('checkbox', { name: /^Voto secreto/ })).toBeChecked()
  await form.getByRole('button', { name: 'Salvar em preparo' }).click()
  await expect(mensagemNaTela(page, 'Salva em preparo. Confira e abra a votação quando for a hora.')).toBeVisible()
  await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
  const endereco = page.url()

  try {
    await page.getByRole('button', { name: 'Abrir a votação' }).click()
    await expect(mensagemNaTela(page, 'Votação aberta: os associados já podem votar.')).toBeVisible()

    // o ministro vê a votação em "Para você", no Início, vota e não vê a contagem (voto secreto)
    const contexto = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
    const m = await contexto.newPage()
    await m.goto('painel')
    await m.getByRole('list', { name: /^(Para você|Precisa de você)$/ }).getByRole('link', { name: titulo }).click()
    await expect(m.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
    await expect(m.getByRole('heading', { name: 'Organizar' })).toHaveCount(0)
    const voto = m.getByRole('form', { name: 'Seu voto' })
    await voto.getByRole('radio', { name: 'Quinta-feira' }).check()
    await voto.getByRole('button', { name: 'Votar' }).click()
    await expect(voto.getByText('Depois de confirmado, o voto não muda.')).toBeVisible()
    await voto.getByRole('button', { name: 'Confirmar o voto' }).click()
    await expect(mensagemNaTela(m, 'Voto registrado. Obrigado!')).toBeVisible()
    await expect(m.getByText(/Você já votou\..*O seu voto é secreto/)).toBeVisible()
    await expect(m.getByText('Voto secreto: a contagem só aparece quando a votação terminar.')).toBeVisible()

    // a presidência vê a participação, encerra e apura
    await page.reload()
    await expect(page.getByText(/^1 de \d+ pessoas? que podem? votar$/)).toBeVisible()
    await page.getByText('Encerrar e apurar', { exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar — encerrar e apurar' }).click()
    await expect(mensagemNaTela(page, 'Votação encerrada e apurada.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Contagem' })).toContainText('Quinta-feira: 1 voto (100%)')

    // o ministro vê o resultado
    await m.reload()
    await expect(m.getByRole('heading', { name: 'Resultado' })).toBeVisible()
    await expect(m.getByRole('list', { name: 'Contagem' })).toContainText('Segunda-feira: 0 votos (0%)')
    await contexto.close()
  } finally {
    // se algo falhou no meio, não deixa a enquete aberta no banco de teste
    await page.goto(endereco)
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
    if (await page.getByRole('heading', { name: 'Organizar' }).count()) {
      await page.getByText('Cancelar', { exact: true }).click()
      await page.getByRole('form', { name: 'Cancelar a votação' }).getByLabel('Motivo *').fill('Teste automático')
      await page.getByRole('button', { name: 'Cancelar a votação' }).click()
      await expect(mensagemNaTela(page, 'Votação cancelada.')).toBeVisible()
    }
  }
})

test.describe('ministro', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê as votações, mas não prepara', async ({ page }) => {
    await page.goto('votacoes')
    await expect(page.getByRole('heading', { name: 'Votações e enquetes', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Nova votação ou enquete' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Em preparo' })).toHaveCount(0)
  })
})
