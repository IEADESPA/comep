// Fase 5.2: comissões. A presidência FICTÍCIA cria uma comissão, indica o ministro fictício como coordenador e
// registra uma reunião; o ministro (coordenador) vê a comissão e registra uma atividade. No fim, a comissão é encerrada
// (fica em "Encerradas" no banco de teste, com o nome "E2E").
import { expect, test } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

const MINISTRO = 'Ministro de Teste'

test('comissão: criar, indicar o coordenador, registrar e encerrar', async ({ page, browser }, info) => {
  test.setTimeout(120_000)
  const nome = `Comissão E2E ${sufixoUnico(info.project.name)}`
  await page.goto('comissoes')
  await page.getByRole('link', { name: 'Nova comissão' }).click()
  await page.getByLabel(/^Nome \*/).fill(nome)
  await page.getByLabel(/^Área/).fill('Educação')
  await page.getByLabel('Finalidade').fill('Comissão fictícia do teste automático.')
  await page.getByRole('button', { name: 'Criar a comissão' }).click()
  await expect(mensagemNaTela(page, 'Comissão criada. Indique os membros.')).toBeVisible()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
  const endereco = page.url()

  try {
    // o ministro fictício entra como coordenador
    await page.getByText('Indicar um membro').click()
    await page.getByRole('form', { name: 'Indicar um membro' }).getByLabel('Associado *').selectOption({ label: MINISTRO })
    await page.getByRole('checkbox', { name: 'Coordena a comissão' }).check()
    await page.getByRole('button', { name: 'Indicar', exact: true }).click()
    await expect(mensagemNaTela(page, 'Membro indicado.')).toBeVisible()
    await expect(page.getByRole('listitem', { name: MINISTRO })).toContainText('Coordenação')

    await page.getByText('Registrar reunião, atividade ou aviso').click()
    await page.getByRole('form', { name: 'Registrar na comissão' }).getByLabel('Título *').fill('Reunião de instalação (teste)')
    await page.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(mensagemNaTela(page, 'Reunião registrada.')).toBeVisible()

    // o ministro (coordenador) vê a comissão no menu e registra uma atividade
    const contexto = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
    const m = await contexto.newPage()
    await m.goto('comissoes')
    await m.getByRole('link', { name: new RegExp(nome) }).click()
    await expect(m.getByRole('list', { name: 'Registros da comissão' })).toContainText('Reunião de instalação (teste)')
    await m.getByText('Registrar reunião, atividade ou aviso').click()
    await m.getByRole('form', { name: 'Registrar na comissão' }).getByLabel('Tipo').selectOption({ label: 'Atividade' })
    await m.getByRole('form', { name: 'Registrar na comissão' }).getByLabel('Título *').fill('Visita às escolas (teste)')
    await m.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(mensagemNaTela(m, 'Atividade registrada.')).toBeVisible()
    // o ministro não altera nem encerra a comissão
    await expect(m.getByRole('link', { name: 'Alterar' })).toHaveCount(0)
    await expect(m.getByText('Encerrar a comissão')).toHaveCount(0)
    await contexto.close()
  } finally {
    await page.goto(endereco)
    // espera a página carregar antes de ver o que dá para fazer
    await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
    if (await page.getByText('Encerrar a comissão').count()) {
      await page.getByText('Encerrar a comissão').click()
      await page.getByRole('form', { name: 'Encerrar a comissão' }).getByLabel('Motivo *').fill('Teste automático')
      await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
      await expect(mensagemNaTela(page, 'Comissão encerrada. O histórico fica guardado.')).toBeVisible()
    }
  }
})
