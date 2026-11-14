// Fase 4.1: assembleias e reuniões. A presidência FICTÍCIA prepara uma AGE (pauta e edital), convoca, o site mostra,
// o ministro vê; depois cancela e arquiva (nada se apaga). Reunião mensal repetida pela secretaria/presidência.
import { expect, test, type Page } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

/** Campo data e hora (hora de Parauapebas) daqui a N dias. */
function campoDaqui(dias: number, hora = '19:00'): string {
  const dia = new Date(Date.now() + dias * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  return `${dia}T${hora}`
}

async function preparar(page: Page, dados: { tipo: string; titulo: string; dias: number; fundamento?: string; itens: string[] }) {
  await page.goto('assembleias')
  await page.getByRole('link', { name: 'Preparar assembleia ou reunião' }).click()
  await page.getByLabel('Tipo *').selectOption({ label: dados.tipo })
  await page.getByLabel('Data e hora (1ª chamada) *').fill(campoDaqui(dados.dias))
  await page.getByLabel(/^Título/).fill(dados.titulo)
  await page.getByLabel('Local *').fill('Local do teste automático (E2E)')
  if (dados.fundamento) await page.getByLabel(/^Quem pediu/).fill(dados.fundamento)
  for (const [i, item] of dados.itens.entries()) {
    if (i > 0) await page.getByRole('button', { name: '+ Item da pauta' }).click()
    await page.getByLabel(`Item ${i + 1} da pauta`).fill(item)
  }
}

async function arquivar(page: Page, titulo: string) {
  await page.getByRole('button', { name: `Arquivar ${titulo}` }).click()
  await page.getByRole('button', { name: `Confirmar — Arquivar ${titulo}` }).click()
  await expect(page).toHaveURL(/\/assembleias$/)
}

test('assembleia: preparar com pauta e edital, convocar, aparecer no site, cancelar e arquivar', async ({ page, browser }, info) => {
  test.setTimeout(150_000)
  const titulo = `AGE E2E ${sufixoUnico(info.project.name)}`
  await preparar(page, {
    tipo: 'Assembleia Geral Extraordinária',
    titulo,
    dias: 45,
    fundamento: 'Maioria do Conselho Diretor (teste automático)',
    itens: ['Reforma do estatuto (teste)', 'Informes'],
  })
  await page.getByRole('checkbox', { name: 'Vai a votação' }).first().check()
  // item sobre o estatuto com maioria simples: a tela avisa que a reforma pede 2/3 (Art. 21)
  const avisoEstatuto = page.getByText('A reforma do estatuto pede 2/3 dos votos válidos (Art. 21).')
  await expect(avisoEstatuto).toBeVisible()
  await page.getByRole('combobox', { name: 'Maioria exigida' }).selectOption('dois_tercos')
  await expect(avisoEstatuto).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Prazos' })).toContainText('a convocação precisa ser publicada até')
  await page.getByRole('button', { name: 'Gerar o texto do edital' }).click()
  await expect(page.getByLabel(/^Texto do edital/)).toHaveValue(/EDITAL DE CONVOCAÇÃO — ASSEMBLEIA GERAL EXTRAORDINÁRIA/)
  await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
  await expect(mensagemNaTela(page, 'Encontro preparado. Confira e convoque.')).toBeVisible()
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
  const endereco = page.url()
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })

  try {
    await expect(page.getByText('Rascunho (não convocado)')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Pauta' })).toContainText('votação: 2/3 dos votos válidos (reforma do estatuto — Art. 21)')

    // o ministro não vê o rascunho
    const m = await ministro.newPage()
    await m.goto('assembleias')
    await expect(m.getByRole('heading', { name: 'Assembleias e reuniões' })).toBeVisible()
    await expect(m.getByRole('listitem', { name: titulo })).toHaveCount(0)

    // convocar (o presidente), com confirmação
    await page.getByRole('button', { name: 'Convocar a assembleia' }).click()
    await page.getByRole('button', { name: 'Confirmar — convocar (não muda mais)' }).click()
    await expect(mensagemNaTela(page, 'Assembleia convocada: já aparece no site.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Compartilhar no WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
    const site = await page.getByRole('link', { name: 'Ver no site' }).getAttribute('href')

    // o site mostra, sem login: edital e pauta
    const visitante = await browser.newContext()
    const v = await visitante.newPage()
    await v.goto(site!)
    await expect(v.getByRole('heading', { name: titulo })).toBeVisible()
    await expect(v.getByRole('list', { name: 'Pauta' })).toContainText('Reforma do estatuto (teste)')
    await expect(v.getByText(/convoca os associados para a Assembleia Geral Extraordinária/)).toBeVisible()

    // o ministro vê a convocada
    await m.goto('assembleias')
    await expect(m.getByRole('listitem', { name: titulo })).toBeVisible()

    // cancelar (com motivo): o site mostra "cancelada"
    await page.getByText('Cancelar este encontro').click()
    await page.getByRole('form', { name: 'Cancelar o encontro' }).getByLabel('Motivo *').fill('Teste automático')
    await page.getByRole('button', { name: 'Cancelar o encontro' }).click()
    await expect(mensagemNaTela(page, 'Encontro cancelado.')).toBeVisible()
    await v.reload()
    await expect(v.getByRole('alert')).toContainText('Assembleia cancelada: Teste automático')
    await visitante.close()
  } finally {
    await ministro.close()
    await page.goto(endereco)
    if (await page.getByRole('button', { name: 'Convocar a assembleia' }).count()) {
      // falhou antes de convocar: o rascunho se arquiva direto
    } else if (await page.getByText('Cancelar este encontro').count()) {
      await page.getByText('Cancelar este encontro').click()
      await page.getByRole('form', { name: 'Cancelar o encontro' }).getByLabel('Motivo *').fill('Limpeza do teste automático')
      await page.getByRole('button', { name: 'Cancelar o encontro' }).click()
      await expect(mensagemNaTela(page, 'Encontro cancelado.')).toBeVisible()
    }
    await arquivar(page, titulo)
  }
})

test('assembleia com menos de 30 dias: o formulário avisa e o banco recusa a convocação', async ({ page }, info) => {
  const titulo = `AGE perto E2E ${sufixoUnico(info.project.name)}`
  await preparar(page, { tipo: 'Assembleia Geral Extraordinária', titulo, dias: 10, fundamento: 'Teste', itens: ['Item'] })
  await expect(page.getByRole('list', { name: 'Prazos' })).toContainText('precisa de 30 dias de antecedência')
  await page.getByRole('button', { name: 'Gerar o texto do edital' }).click()
  await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
  await page.getByRole('button', { name: 'Convocar a assembleia' }).click()
  await page.getByRole('button', { name: 'Confirmar — convocar (não muda mais)' }).click()
  await expect(page.getByRole('alert')).toContainText('pelo menos 30 dias de antecedência')
  await arquivar(page, titulo)
})

test('reunião mensal: criar com as dos próximos meses e publicar sem prazo de 30 dias', async ({ page }, info) => {
  const titulo = `Reunião E2E ${sufixoUnico(info.project.name)}`
  await preparar(page, { tipo: 'Reunião mensal', titulo, dias: 3, itens: ['Oração e comunhão'] })
  await expect(page.getByRole('checkbox', { name: 'Vai a votação' })).toHaveCount(0)
  await page.getByLabel(/^Criar também para os próximos meses/).selectOption('2')
  await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
  await expect(mensagemNaTela(page, 'Encontro preparado. Confira e convoque.')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar a reunião' }).click()
  await page.getByRole('button', { name: 'Confirmar — publicar' }).click()
  await expect(mensagemNaTela(page, 'Reunião publicada.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver no site' })).toHaveCount(0)

  // limpeza: a publicada é cancelada e arquivada; as dos próximos meses (rascunho), arquivadas
  await page.getByText('Cancelar este encontro').click()
  await page.getByRole('form', { name: 'Cancelar o encontro' }).getByLabel('Motivo *').fill('Teste automático')
  await page.getByRole('button', { name: 'Cancelar o encontro' }).click()
  await expect(mensagemNaTela(page, 'Encontro cancelado.')).toBeVisible()
  await arquivar(page, titulo)
  // as dos próximos meses levam o mesmo título, com o mês
  const seguintes = page.getByRole('listitem').filter({ hasText: `${titulo} — ` })
  await expect(seguintes).toHaveCount(2)
  await expect(seguintes.first()).toContainText('Rascunho')
  for (let i = 0; i < 2; i++) {
    const item = seguintes.first()
    const nome = (await item.getAttribute('aria-label'))!
    await item.getByRole('link', { name: 'Abrir' }).click()
    await arquivar(page, nome)
  }
})
