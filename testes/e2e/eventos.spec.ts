// Fase 5.3: eventos e o site vivo. A presidência FICTÍCIA prepara e publica um evento com inscrição aberta ao público;
// o site mostra o evento; um visitante (sem login) se inscreve pelo site; a inscrição aparece no sistema. No fim, o
// evento é cancelado e arquivado. (O pagamento da taxa, que entra no caixa, é testado só no banco: eventos.test.ts.)
import { expect, test } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

function campoDaquiDias(dias: number): string {
  const d = new Date(Date.now() + dias * 86_400_000)
  const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  return `${dia}T19:00`
}

test('evento: publicar, aparecer no site, inscrição pelo site e na lista do sistema', async ({ page, browser }, info) => {
  test.setTimeout(150_000)
  const titulo = `Seminário E2E ${sufixoUnico(info.project.name)}`
  const telefone = `94 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`

  await page.goto('eventos')
  await page.getByRole('link', { name: 'Novo evento ou projeto' }).click()
  await page.getByLabel(/^Título/).fill(titulo)
  await page.getByLabel('Início *').fill(campoDaquiDias(20))
  await page.getByLabel('Local').fill('Local do teste automático (E2E)')
  await page.getByLabel(/^Descrição/).fill('Evento fictício do teste automático.')
  await page.getByRole('checkbox', { name: 'Este evento tem inscrição' }).check()
  await page.getByRole('checkbox', { name: /Aberta ao público, pelo site/ }).check()
  await page.getByLabel('Vagas').fill('5')
  await page.getByRole('button', { name: 'Salvar (ainda sem publicar)' }).click()
  await expect(mensagemNaTela(page, 'Evento preparado. Confira e publique.')).toBeVisible()
  const endereco = page.url()

  try {
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await expect(mensagemNaTela(page, 'Evento publicado: já aparece no site e para os associados.')).toBeVisible()
    const site = await page.getByRole('link', { name: 'Ver no site' }).getAttribute('href')

    // o visitante, sem login, vê o evento na agenda e se inscreve
    const visitante = await browser.newContext()
    const v = await visitante.newPage()
    await v.goto(site!.replace(/\/agenda\/.*$/, '/agenda'))
    await expect(v.getByRole('heading', { name: 'Agenda do COMEP' })).toBeVisible()
    await v.getByRole('link', { name: titulo }).click()
    await expect(v.getByRole('heading', { name: titulo })).toBeVisible()
    await expect(v.getByText('5 vagas restantes')).toBeVisible()
    const form = v.getByRole('form', { name: 'Inscrição no evento' })
    await form.getByLabel(/^Nome completo/).fill('Visitante do Teste Automático')
    await form.getByLabel(/^Telefone/).fill(telefone)
    await form.getByRole('checkbox', { name: /Aceito que o COMEP use/ }).check()
    await form.getByRole('button', { name: 'Inscrever-me' }).click()
    await expect(v.getByRole('heading', { name: 'Inscrição feita!' })).toBeVisible()
    await expect(v.getByText('Ela está confirmada.')).toBeVisible()
    await visitante.close()

    // a inscrição feita no site aparece no sistema
    await page.goto(endereco)
    await expect(page.getByRole('list', { name: 'Inscrições' })).toContainText('Visitante do Teste Automático')
    await expect(page.getByRole('heading', { name: /Inscrições \(1 de 5\)/ })).toBeVisible()
  } finally {
    await page.goto(endereco)
    // espera a página carregar antes de ver o que dá para fazer
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible()
    const cancelar = page.locator('summary', { hasText: 'Cancelar o evento' })
    if (await cancelar.count()) {
      await cancelar.click()
      await page.getByRole('form', { name: 'Cancelar o evento' }).getByLabel('Motivo *').fill('Teste automático')
      await page.getByRole('button', { name: 'Cancelar o evento' }).click()
      await expect(mensagemNaTela(page, 'Evento cancelado. O site mostra "cancelado".')).toBeVisible()
    }
    await page.getByRole('button', { name: `Arquivar ${titulo}` }).click()
    await page.getByRole('button', { name: `Confirmar — Arquivar ${titulo}` }).click()
    await expect(page).toHaveURL(/\/eventos$/)
  }
})

test('o ministro vê os eventos, mas não prepara', async ({ browser }) => {
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const m = await ministro.newPage()
  await m.goto('eventos')
  await expect(m.getByRole('heading', { name: 'Eventos e projetos' })).toBeVisible()
  await expect(m.getByRole('link', { name: 'Novo evento ou projeto' })).toHaveCount(0)
  await m.goto('eventos/novo')
  await expect(m.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
  await ministro.close()
})
