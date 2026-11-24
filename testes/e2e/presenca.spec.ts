// Presença e faltas (Fase 4.2; telas novas na parte 14, asm-presenca opção 3). Reuniões FICTÍCIAS criadas pelo
// próprio teste (canceladas e arquivadas no fim). Os três jeitos de marcar: o ministro digita o código da tela da
// portaria (ou abre o QR dela, que traz o código no endereço), a secretaria lê a credencial (a página de validação
// mostra o botão) e a secretaria marca pelo nome. O ministro confirma que vai, justifica a falta e a presidência
// (no lugar do 1º secretário) decide.
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

/** A presença do encontro: busca o ministro e desfaz a presença dele. */
async function desfazer(page: Page, id: string) {
  await page.goto(`assembleias/presenca/${id}`)
  await page.getByLabel('Buscar associado').fill(MINISTRO)
  await page.getByRole('listitem', { name: MINISTRO }).getByRole('button', { name: 'Desfazer' }).click()
  await expect(mensagemNaTela(page, `Presença desfeita: ${MINISTRO}.`)).toBeVisible()
}

/** O código de 6 letras que a tela da portaria mostra agora. */
async function codigoDaPortaria(page: Page, id: string): Promise<string> {
  await page.goto(`assembleias/presenca/${id}/portaria`)
  await expect(page.getByRole('heading', { name: 'Marque a sua presença' })).toBeVisible()
  await expect(page.getByRole('img', { name: /^QR Code da portaria/ })).toBeVisible()
  // fora da moldura (revisão da parte 14, achado 2): o aparelho da entrada não mostra o menu, a busca nem o sino
  await expect(page.getByRole('navigation', { name: 'Menu principal' })).toHaveCount(0)
  await expect(page.getByLabel('Buscar ministro, igreja ou tela')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Avisos/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Voltar à lista' })).toBeVisible()
  const rotulo = (await page.getByLabel(/^Código da portaria:/).getAttribute('aria-label')) ?? ''
  const codigo = rotulo.replace('Código da portaria:', '').replace(/\s/g, '')
  expect(codigo).toMatch(/^[A-Z2-9]{6}$/)
  return codigo
}

test('presença: o código da portaria, o QR dela, a credencial lida e pelo nome', async ({ page, browser }, info) => {
  test.setTimeout(240_000)
  const titulo = `Reunião presença E2E ${sufixoUnico(info.project.name)}`
  const endereco = await reuniaoPublicada(page, titulo, 1)
  const id = endereco.split('/').pop() ?? ''
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  try {
    // pelo nome (a secretaria): marcar e desfazer
    await page.getByRole('main').getByRole('link', { name: 'Presença', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Presença', level: 1 })).toBeVisible()
    await page.getByLabel('Buscar associado').fill(MINISTRO)
    const linha = page.getByRole('listitem', { name: MINISTRO })
    await linha.getByRole('button', { name: 'Marcar presente' }).click()
    await expect(mensagemNaTela(page, `Presença registrada: ${MINISTRO}.`)).toBeVisible()
    await expect(linha).toContainText('Presente às')
    await expect(page.getByRole('table', { name: 'Quem chegou' })).toContainText('pelo nome (secretaria)')
    await linha.getByRole('button', { name: 'Desfazer' }).click()
    await expect(mensagemNaTela(page, `Presença desfeita: ${MINISTRO}.`)).toBeVisible()

    // o código da tela da portaria, digitado no celular do ministro (o errado não vale)
    const m = await ministro.newPage()
    await m.goto(endereco)
    const marcar = m.getByRole('group', { name: 'Marcar a minha presença' })
    await expect(marcar).toBeVisible()
    await marcar.getByLabel('Ou digite o código').fill('ZZZZZZ')
    await marcar.getByRole('button', { name: 'Marcar presença' }).click()
    await expect(m.getByRole('alert')).toContainText('Código errado ou vencido')
    const codigo = await codigoDaPortaria(page, id)
    await marcar.getByLabel('Ou digite o código').fill(codigo.toLowerCase())
    await marcar.getByRole('button', { name: 'Marcar presença' }).click()
    // o ministro fictício está com a contribuição em atraso: marca, mas não vota
    await expect(mensagemNaTela(m, /^Presença marcada às \d\d:\d\d\. Para votar, é preciso estar em dia/)).toBeVisible()
    await expect(m.getByText(/^Presença marcada às \d\d:\d\d$/)).toBeVisible()
    await expect(marcar).toHaveCount(0)
    // a tela da portaria mostra quem chegou
    await page.reload()
    await expect(page.getByRole('list', { name: 'Chegaram agora' })).toContainText(MINISTRO)
    await expect(page.getByRole('list', { name: 'Chegaram agora' })).toContainText('código digitado')

    // o QR da portaria abre a página do encontro já com o código: marca sozinho e tira o código do endereço
    await desfazer(page, id)
    const codigoDoQr = await codigoDaPortaria(page, id)
    await m.goto(`${endereco}?portaria=${codigoDoQr}`)
    await expect(mensagemNaTela(m, /^Presença marcada às \d\d:\d\d\./)).toBeVisible()
    await expect(m).not.toHaveURL(/portaria=/)
    await page.goto(`assembleias/presenca/${id}`)
    await expect(page.getByRole('table', { name: 'Quem chegou' })).toContainText('QR da portaria')

    // a credencial lida: a página de validação (aberta pela presidência) tem o botão
    await desfazer(page, id)
    await m.goto('minha-credencial')
    const validacao = await m.getByRole('link', { name: /Abrir a página de validação/ }).getAttribute('href')
    await page.goto(validacao!)
    await page.getByRole('button', { name: `Marcar presença em ${titulo}` }).click()
    await expect(mensagemNaTela(page, `Presença registrada em "${titulo}": ${MINISTRO}`)).toBeVisible()
    await page.goto(`assembleias/presenca/${id}`)
    await expect(page.getByRole('table', { name: 'Quem chegou' })).toContainText('credencial lida')
    await expect(page.getByRole('table', { name: 'Quem chegou' })).toContainText('em atraso')
  } finally {
    await ministro.close()
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
    // três dias antes, a presença ainda não abre
    await expect(m.getByRole('group', { name: 'Marcar a minha presença' })).toHaveCount(0)
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

test('o ministro não abre a presença, a tela da portaria nem as faltas de todos', async ({ browser }) => {
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const m = await ministro.newPage()
  await m.goto('assembleias/faltas')
  await expect(m.getByRole('alert')).toBeVisible()
  await expect(m.getByRole('list', { name: 'Faltas seguidas' })).toHaveCount(0)
  await m.goto('assembleias/presenca/00000000-0000-0000-0000-000000000000/portaria')
  await expect(m.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
  await expect(m.getByLabel(/^Código da portaria:/)).toHaveCount(0)
  // o endereço antigo leva ao novo
  await m.goto('assembleias/00000000-0000-0000-0000-000000000000/presenca')
  await expect(m).toHaveURL(/\/assembleias\/presenca\/0{8}-/)
  await expect(m.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
  await ministro.close()
})
