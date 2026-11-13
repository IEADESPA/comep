// Fase 4.2: presença e faltas. Reuniões FICTÍCIAS criadas pelo próprio teste (canceladas e arquivadas no fim):
// marcar presença pela lista e pelo QR Code da credencial (a página de validação mostra o botão para a presidência);
// o ministro confirma que vai, justifica a falta e a presidência (no lugar do 1º secretário) decide.
import { expect, test, type Page } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

const MINISTRO = 'Ministro de Teste'

/** Campo data e hora (hora de Parauapebas) daqui a N horas. */
function campoDaquiHoras(horas: number): string {
  const d = new Date(Date.now() + horas * 3_600_000)
  const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${dia}T${hora}`
}

async function reuniaoPublicada(page: Page, titulo: string, horas: number): Promise<string> {
  await page.goto('assembleias/novo')
  await page.getByLabel('Tipo *').selectOption({ label: 'Reunião mensal' })
  await page.getByLabel('Data e hora (1ª chamada) *').fill(campoDaquiHoras(horas))
  await page.getByLabel(/^Título/).fill(titulo)
  await page.getByLabel('Local *').fill('Local do teste automático (E2E)')
  await page.getByLabel('Item 1 da pauta').fill('Oração')
  await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
  await expect(mensagemNaTela(page, 'Encontro preparado. Confira e convoque.')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar a reunião' }).click()
  await page.getByRole('button', { name: 'Confirmar — publicar' }).click()
  await expect(mensagemNaTela(page, 'Reunião publicada.')).toBeVisible()
  return page.url()
}

async function cancelarEArquivar(page: Page, endereco: string, titulo: string) {
  await page.goto(endereco)
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
  if (await page.getByText('Cancelar este encontro').count()) {
    await page.getByText('Cancelar este encontro').click()
    await page.getByRole('form', { name: 'Cancelar o encontro' }).getByLabel('Motivo *').fill('Teste automático')
    await page.getByRole('button', { name: 'Cancelar o encontro' }).click()
    await expect(mensagemNaTela(page, 'Encontro cancelado.')).toBeVisible()
  }
  await page.getByRole('button', { name: `Arquivar ${titulo}` }).click()
  await page.getByRole('button', { name: `Confirmar — Arquivar ${titulo}` }).click()
  await expect(page).toHaveURL(/\/assembleias$/)
}

test('lista de presença: marcar pela lista, desfazer e marcar pelo QR Code da credencial', async ({ page, browser }, info) => {
  test.setTimeout(150_000)
  const titulo = `Reunião presença E2E ${sufixoUnico(info.project.name)}`
  const endereco = await reuniaoPublicada(page, titulo, 1)
  try {
    // pela lista
    await page.getByRole('link', { name: 'Lista de presença' }).click()
    await expect(page.getByRole('heading', { name: 'Lista de presença' })).toBeVisible()
    await page.getByLabel('Buscar associado').fill(MINISTRO)
    const linha = page.getByRole('listitem', { name: MINISTRO })
    await linha.getByRole('button', { name: 'Marcar presente' }).click()
    await expect(mensagemNaTela(page, `Presença registrada: ${MINISTRO}.`)).toBeVisible()
    await expect(linha).toContainText('Presente às')
    await linha.getByRole('button', { name: 'Desfazer' }).click()
    await expect(mensagemNaTela(page, `Presença desfeita: ${MINISTRO}.`)).toBeVisible()

    // pelo QR Code: o ministro mostra a credencial; a página de validação (aberta pela presidência) tem o botão
    const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
    const m = await ministro.newPage()
    await m.goto('minha-credencial')
    const validacao = await m.getByRole('link', { name: /Abrir a página de validação/ }).getAttribute('href')
    await page.goto(validacao!)
    await page.getByRole('button', { name: `Marcar presença em ${titulo}` }).click()
    await expect(mensagemNaTela(page, `Presença registrada em "${titulo}": ${MINISTRO}`)).toBeVisible()

    // o ministro vê que esteve presente
    await m.goto(endereco)
    await expect(m.getByText('Você esteve presente')).toBeVisible()
    await ministro.close()

    // a lista mostra a forma (QR Code)
    await page.goto(`${endereco}/presenca`)
    await page.getByLabel('Buscar associado').fill(MINISTRO)
    await expect(page.getByRole('listitem', { name: MINISTRO })).toContainText('(QR Code)')
  } finally {
    await cancelarEArquivar(page, endereco, titulo)
  }
})

test('o ministro confirma que vai, justifica a falta e a presidência decide', async ({ page, browser }, info) => {
  test.setTimeout(150_000)
  const titulo = `Reunião justificativa E2E ${sufixoUnico(info.project.name)}`
  const endereco = await reuniaoPublicada(page, titulo, 72)
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  try {
    const m = await ministro.newPage()
    await m.goto(endereco)
    await m.getByRole('button', { name: 'Vou participar' }).click()
    await expect(mensagemNaTela(m, 'Presença confirmada. No dia, mostre a credencial.')).toBeVisible()
    await expect(m.getByText('Você confirmou que vai')).toBeVisible()
    await m.getByText('Não vou poder ir: justificar a falta').click()
    await m.getByRole('form', { name: 'Justificar a falta' }).getByLabel('Justificativa *').fill('Viagem (teste automático)')
    await m.getByRole('button', { name: 'Enviar justificativa' }).click()
    await expect(mensagemNaTela(m, 'Justificativa enviada ao 1º secretário.')).toBeVisible()
    await expect(m.getByText('em análise pelo 1º secretário')).toBeVisible()

    // a presidência decide (recusar pede motivo); aceita
    await page.goto('assembleias/faltas')
    const pendente = page.getByRole('listitem', { name: `Justificativa de ${MINISTRO}` }).filter({ hasText: titulo })
    await expect(pendente).toContainText('Viagem (teste automático)')
    await expect(pendente.getByRole('button', { name: 'Recusar' })).toBeDisabled()
    await pendente.getByRole('button', { name: 'Aceitar' }).click()
    await expect(mensagemNaTela(page, `Justificativa de ${MINISTRO} aceita.`)).toBeVisible()

    await m.reload()
    await expect(m.getByText('aceita', { exact: true })).toBeVisible()
  } finally {
    await ministro.close()
    await cancelarEArquivar(page, endereco, titulo)
  }
})

test('o ministro não abre a lista de presença nem as faltas de todos', async ({ browser }) => {
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const m = await ministro.newPage()
  await m.goto('assembleias/faltas')
  await expect(m.getByRole('alert')).toBeVisible()
  await expect(m.getByRole('list', { name: 'Faltas seguidas' })).toHaveCount(0)
  await ministro.close()
})
