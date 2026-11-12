// Fase 1.2 (parte 1): configurações, pastor presidente/jubilado e as duas colunas independentes.
// Dados FICTÍCIOS no banco de teste; o que o teste cria, ele mesmo arquiva no fim (nada se apaga).
import { expect, test } from '@playwright/test'
import { arquivoDaSessao, sufixoUnico } from './ajuda'

const mensagem = (page: import('@playwright/test').Page, texto: string) =>
  page.getByRole('status').filter({ hasText: texto })

// Sessão da presidência fictícia, guardada em autenticacao.setup.ts (sem novo login a cada teste)
test.use({ storageState: arquivoDaSessao('presidencia') })

test('a presidência adiciona, altera e arquiva um bairro', async ({ page }, info) => {
  const nome = `Bairro E2E ${sufixoUnico(info.project.name)}`
  const bairros = page.locator('#bairros')
  const lista = bairros.getByRole('list', { name: 'Bairros' })

  await page.goto('configuracoes')
  await bairros.getByLabel('Novo item').fill(nome)
  await bairros.getByRole('button', { name: 'Adicionar' }).click()
  await expect(mensagem(page, `"${nome}" adicionado.`)).toBeVisible()
  await expect(lista).toContainText(nome)

  // Nome repetido é recusado
  await bairros.getByLabel('Novo item').fill(nome.toUpperCase())
  await bairros.getByRole('button', { name: 'Adicionar' }).click()
  await expect(bairros.getByRole('alert')).toContainText('Já existe')

  await bairros.getByRole('button', { name: `Alterar ${nome}` }).click()
  await bairros.getByLabel('Nome', { exact: true }).fill(`${nome} alterado`)
  await bairros.getByRole('button', { name: 'Salvar' }).click()
  await expect(lista).toContainText(`${nome} alterado`)

  await bairros.getByRole('button', { name: `Arquivar ${nome} alterado` }).click()
  await expect(mensagem(page, `"${nome} alterado" arquivado.`)).toBeVisible()
  await expect(lista).not.toContainText(nome)
})

test('mostra os valores da contribuição; a presidência lança e arquiva um valor', async ({ page }) => {
  await page.goto('configuracoes')
  const vigentes = page.getByRole('list', { name: 'Valores em vigor' })
  await expect(vigentes.getByRole('listitem', { name: 'Presidente de igreja', exact: true })).toContainText('Mensal: R$ 40,00')
  await expect(vigentes.getByRole('listitem', { name: 'Presidente de igreja', exact: true })).toContainText(
    'Anual (pago em abril): R$ 400,00',
  )
  await expect(vigentes.getByRole('listitem', { name: 'Não presidente de igreja' })).toContainText('Mensal: R$ 20,00')
  await expect(vigentes.getByRole('listitem', { name: 'Jubilado', exact: true })).toContainText('Mensal: R$ 0,00')

  // Valor futuro, de teste: não entra em vigor e é arquivado no fim
  const ano = 2090 + Math.floor(Math.random() * 9)
  const dia = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const data = `${ano}-01-${dia}`
  const dataBr = `${dia}/01/${ano}`

  const secao = page.locator('#valores')
  await secao.getByText('Lançar novo valor').click()
  await secao.getByLabel('Categoria').selectOption({ label: 'Jubilado' })
  await secao.getByLabel('Tipo').selectOption({ label: 'Taxa de inscrição' })
  await secao.getByLabel('Valor (R$)').fill('0')
  await secao.getByLabel('Vale a partir de').fill(data)
  await secao.getByLabel('Observação').fill('Valor de teste automático')
  await secao.getByRole('button', { name: 'Lançar valor' }).click()
  await expect(mensagem(page, `a partir de ${dataBr}`)).toBeVisible()

  // Ainda não vale (data futura): a inscrição do jubilado continua isenta
  await expect(vigentes.getByRole('listitem', { name: 'Jubilado', exact: true })).toContainText('Taxa de inscrição: Isenta')

  await secao.getByText(/^Histórico de valores/).click()
  await secao.getByRole('button', { name: `Arquivar o valor Jubilado Taxa de inscrição de ${dataBr}` }).click()
  await expect(mensagem(page, 'Valor arquivado.')).toBeVisible()
})

test('a taxa de inscrição hoje é isenta; a presidência programa um valor futuro (e arquiva no fim)', async ({ page }) => {
  await page.goto('configuracoes')
  const taxa = page.locator('#inscricao')
  await expect(taxa.getByText(/^Hoje:/)).toHaveText(/^Hoje: Isenta/)
  const vigentes = page.getByRole('list', { name: 'Valores em vigor' })
  await expect(vigentes.getByRole('listitem', { name: 'Não presidente de igreja' })).toContainText('Taxa de inscrição: Isenta')

  // Valor futuro, de teste (como se a assembleia tivesse decidido): não vale hoje
  const ano = 2090 + Math.floor(Math.random() * 9)
  const dia = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const dataBr = `${dia}/02/${ano}`
  await taxa.getByText('Personalizar a taxa de inscrição').click()
  await taxa.getByLabel('Valor da taxa (R$)').fill('50')
  await taxa.getByLabel('Vale para quem for admitido a partir de').fill(`${ano}-02-${dia}`)
  await taxa.getByLabel('Ata da assembleia').fill('Teste automático')
  await taxa.getByLabel('Prazo para pagar (dias depois da admissão)').fill('30')
  await taxa.getByRole('button', { name: 'Salvar taxa de inscrição' }).click()
  await expect(mensagem(page, `Taxa de inscrição: R$ 50,00 a partir de ${dataBr}.`)).toBeVisible()

  const programada = taxa.getByRole('list', { name: 'Taxa de inscrição programada' })
  await expect(programada).toContainText(`A partir de ${dataBr}: R$ 50,00 (presidente de igreja)`)
  await expect(programada).toContainText(`A partir de ${dataBr}: R$ 50,00 (não presidente de igreja)`)
  await expect(taxa.getByText(/^Hoje:/)).toHaveText(/^Hoje: Isenta/)

  // Limpa: arquiva os dois valores de teste (o histórico guarda tudo)
  const valores = page.locator('#valores')
  await valores.getByText(/^Histórico de valores/).click()
  for (const categoria of ['Presidente de igreja', 'Não presidente de igreja']) {
    await valores.getByRole('button', { name: `Arquivar o valor ${categoria} Taxa de inscrição de ${dataBr}` }).click()
    await expect(mensagem(page, 'Valor arquivado.')).toBeVisible()
  }
  await expect(valores.getByRole('button', { name: new RegExp(`Taxa de inscrição de ${dataBr}$`) })).toHaveCount(0)
  await expect(taxa.getByRole('list', { name: 'Taxa de inscrição programada' })).toHaveCount(0)
})

test('pastor presidente paga como presidente de igreja; jubilado é isento', async ({ page }, info) => {
  const sufixo = sufixoUnico(info.project.name)
  const igreja = `Igreja E2E ${sufixo}`
  const nome = `Pastor E2E ${sufixo}`

  // Igreja só deste teste (assim a vaga de pastor presidente está livre)
  await page.goto('igrejas/nova')
  await page.getByLabel(/^Nome da igreja/).fill(igreja)
  await page.getByRole('button', { name: 'Cadastrar igreja' }).click()
  await expect(mensagem(page, 'Igreja cadastrada.')).toBeVisible()
  const enderecoIgreja = page.url()

  await page.goto('ministros/novo')
  await page.getByLabel(/^Nome completo/).fill(nome)
  await page.getByLabel(/^Título ministerial/).selectOption({ label: 'Pastor(a)' })
  await page.getByLabel(/^Igreja \*/).selectOption({ label: igreja })
  await page.getByLabel(/É o pastor presidente desta igreja/).check()
  await page.getByRole('button', { name: 'Cadastrar associado' }).click()
  await expect(mensagem(page, 'Associado cadastrado.')).toBeVisible()

  const contribuicao = page.locator('section', { has: page.getByRole('heading', { name: 'Contribuição' }) })
  await expect(contribuicao).toContainText('Categoria: Presidente de igreja — R$ 40,00 por mês ou R$ 400,00 por ano')

  await page.getByRole('button', { name: 'Desmarcar pastor presidente' }).click()
  await expect(mensagem(page, 'Desmarcado como pastor presidente.')).toBeVisible()
  await expect(contribuicao).toContainText('Categoria: Não presidente de igreja — R$ 20,00 por mês')

  await page.getByRole('button', { name: 'Marcar como jubilado' }).click()
  await expect(mensagem(page, 'Marcado como jubilado')).toBeVisible()
  await expect(contribuicao).toContainText('Categoria: Jubilado — R$ 0,00 por mês')

  // Limpeza: arquiva o associado e a igreja de teste
  await page.getByText('Arquivar cadastro', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/ministros$/)
  await page.goto(enderecoIgreja)
  await page.getByText('Arquivar igreja', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/igrejas$/)
})

test('no computador, o menu não rola junto com o conteúdo', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'no celular o menu abre pelo botão "Menu"')
  await page.goto('auditoria')
  await expect(page.getByRole('list', { name: 'Registros da auditoria' })).toBeVisible()

  const conteudo = page.locator('main.area-conteudo')
  const rolou = await conteudo.evaluate((el) => {
    el.scrollTo(0, el.scrollHeight)
    return el.scrollTop
  })
  expect(rolou, 'a auditoria deveria ser mais comprida que a tela').toBeGreaterThan(0)

  // A página em si não rolou: só a coluna da direita
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu.getByRole('link', { name: 'Início', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Sair' })).toBeInViewport()
})

test('a diretoria preenche os dados do COMEP e o site mostra; vazio aparece "—"', async ({ page }, info) => {
  const sufixo = sufixoUnico(info.project.name)
  const secao = page.locator('#site')
  const reunioes = secao.getByLabel('Reuniões mensais')
  const instagram = secao.getByLabel('Instagram')

  await page.goto('configuracoes')
  // Guarda o que já estava preenchido, para devolver no fim
  const antes = { reunioes: await reunioes.inputValue(), instagram: await instagram.inputValue() }

  await reunioes.fill(`Teste E2E ${sufixo}`)
  await instagram.fill(`@comep_e2e_${sufixo}`)
  await secao.getByRole('button', { name: 'Salvar dados do site' }).click()
  await expect(mensagem(page, 'Dados do site salvos.')).toBeVisible()

  await page.goto('./')
  const contatos = page.getByRole('region', { name: 'Fale com o COMEP' })
  await expect(contatos).toContainText(`Teste E2E ${sufixo}`)
  await expect(contatos.getByRole('link', { name: `Instagram: @comep_e2e_${sufixo}` })).toHaveAttribute(
    'href',
    `https://instagram.com/comep_e2e_${sufixo}`,
  )

  // Vazio aparece como "—"
  await page.goto('configuracoes')
  await reunioes.fill('')
  await secao.getByRole('button', { name: 'Salvar dados do site' }).click()
  await expect(mensagem(page, 'Dados do site salvos.')).toBeVisible()
  await page.goto('./')
  await expect(contatos.getByRole('definition').nth(1)).toHaveText('—')

  // Devolve os valores de antes
  await page.goto('configuracoes')
  await reunioes.fill(antes.reunioes)
  await instagram.fill(antes.instagram)
  await secao.getByRole('button', { name: 'Salvar dados do site' }).click()
  await expect(mensagem(page, 'Dados do site salvos.')).toBeVisible()
})
