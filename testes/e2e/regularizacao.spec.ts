// Fase 5.5 (telas novas, parte 6): a regularização vista pelo pastor presidente. A igreja fica suspensa no dia em que
// o alvará vence: a Minha igreja vira o caminho de volta, com a contagem dos 30 dias, e o pastor manda o alvará novo;
// a presidência confere e a igreja volta a ser regular. Depois, o envio antecipado: o alvará do ano seguinte, mandado
// antes de vencer, fica guardado e entra sozinho no dia certo.
// Dados FICTÍCIOS do banco de teste; o pastor e a igreja criados aqui são arquivados no fim (nada se apaga).
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  abrirAbaDaIgreja,
  arquivarAssociadoDeTeste,
  arquivarIgrejaAberta,
  arquivoDaSessao,
  cadastrarIgreja,
  cnpjAleatorio,
  criarAssociadoComLogin,
  DENOMINACAO_DE_TESTE,
  mensagemNaTela,
  pdfFicticio,
  sufixoUnico,
  trocarPara,
} from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

/** A data de daqui a N dias (aaaa-mm-dd), no fuso de Parauapebas. */
const dia = (dias: number) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
const br = (iso: string) => iso.split('-').reverse().join('/')

/** Na ficha da igreja (aba Documentos), a presidência manda um documento pela igreja: entra já conferido. */
async function mandarPelaIgreja(page: Page, documento: string, preencher?: (form: Locator) => Promise<void>) {
  const resumo = page.getByText('Mandar um documento pela igreja')
  if (!(await page.getByRole('form', { name: 'Mandar um documento' }).isVisible())) await resumo.click()
  const form = page.getByRole('form', { name: 'Mandar um documento' })
  await form.getByRole('combobox', { name: 'Documento' }).selectOption({ label: documento })
  if (preencher) await preencher(form)
  await form.getByLabel('Escolher os arquivos do documento').setInputFiles(pdfFicticio(`${documento}.pdf`))
  await form.getByRole('button', { name: 'Mandar o documento' }).click()
  await expect(mensagemNaTela(page, `${documento}: enviado. Mandado pela secretaria, já entra conferido.`)).toBeVisible()
}

test('a igreja suspensa no dia: o caminho de volta com os 30 dias; o alvará do ano seguinte entra sozinho', async ({ page }, info) => {
  test.setTimeout(240_000)
  const sufixo = sufixoUnico(info.project.name)
  const igreja = `Igreja Regularização E2E ${sufixo}`
  const pastor = `Pastor Regularização E2E ${sufixo}`
  const fimDoAno = `${dia(0).slice(0, 4)}-12-31`
  const proximoAno = String(Number(dia(0).slice(0, 4)) + 1)

  // 1. A presidência cadastra a igreja e manda, pela igreja, o estatuto, o Cartão CNPJ, a ata e o alvará que venceu
  //    ontem (o histórico): a igreja fica suspensa hoje
  await trocarPara(page, 'presidencia')
  const endereco = await cadastrarIgreja(page, { nome: igreja })
  await abrirAbaDaIgreja(page, 'Documentos')
  await mandarPelaIgreja(page, 'Estatuto da igreja')
  await mandarPelaIgreja(page, 'Cartão CNPJ')
  await mandarPelaIgreja(page, 'Ata da diretoria', async (form) => {
    await form.getByLabel('Posse (data da ata) *').fill(dia(0))
    await form.getByLabel('Nome completo 1').fill('Presidente Fictício da Igreja')
  })
  await mandarPelaIgreja(page, 'Alvará de licenciamento', async (form) => {
    await form.getByLabel('Vale a partir de *').fill(dia(-366))
    await form.getByLabel('Vale até *').fill(dia(-1))
  })
  await abrirAbaDaIgreja(page, 'Situação')
  await expect(page.getByRole('region', { name: 'A igreja', exact: true })).toContainText('Suspensa')
  await expect(page.getByText(`Suspensa desde ${br(dia(0))}`)).toBeVisible()
  // D-12: no dia da suspensão, 30 dias (a mesma conta em todas as telas)
  await expect(page.getByText(/para mandar o alvará \(faltam 30 dias\)/)).toBeVisible()

  // 2. O pastor presidente (associado com login): no Início, o aviso; na Minha igreja, o caminho de volta
  const sessaoPastor = await criarAssociadoComLogin(page, {
    nome: pastor,
    email: `e2e.regularizacao.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja,
    pastorPresidente: true,
  })
  await expect(page.getByText('A igreja está suspensa:')).toBeVisible()
  await expect(page.getByText('faltam 30 dias para mandar o alvará')).toBeVisible()
  await page.goto('minha-igreja')
  await expect(page.getByRole('heading', { name: 'Para a igreja voltar a ser regular', level: 1 })).toBeVisible()
  const contagem = page.getByRole('region', { name: 'Os dias para mandar' })
  await expect(contagem).toContainText('30')
  await expect(contagem).toContainText(`até ${br(dia(29))}`)
  const mande = page.getByRole('region', { name: 'Mande aqui o alvará' })
  await mande.getByLabel('Vale até *').fill(fimDoAno)
  await mande.getByLabel('Escolher os arquivos do documento').setInputFiles(pdfFicticio('alvara-novo.pdf'))
  await mande.getByRole('button', { name: 'Mandar para a secretaria conferir' }).click()
  await expect(mensagemNaTela(page, 'Alvará de licenciamento: enviado. A secretaria vai conferir.')).toBeVisible()
  await expect(mande).toContainText('a secretaria está conferindo')

  // 3. A presidência confere o alvará novo: a igreja volta a ser regular
  await trocarPara(page, 'presidencia')
  await page.goto(`${endereco}/documentos`)
  await page
    .getByRole('listitem', { name: 'Alvará de licenciamento' })
    .filter({ hasText: 'Esperando a conferência' })
    .getByRole('button', { name: 'Conferir' })
    .click()
  await expect(mensagemNaTela(page, 'Alvará de licenciamento: conferido.')).toBeVisible()
  await abrirAbaDaIgreja(page, 'Situação')
  await expect(page.getByRole('region', { name: 'A igreja', exact: true })).toContainText('Regular')

  // 4. O pastor: os documentos em cartões; o cartão abre a página do documento; o envio antecipado (passo a passo)
  await trocarPara(page, sessaoPastor)
  await page.goto('minha-igreja/documentos')
  const cartoes = page.getByRole('list', { name: 'Documentos da igreja' })
  await expect(cartoes.getByRole('link', { name: 'Alvará de licenciamento' })).toContainText('Conferido')
  await cartoes.getByRole('link', { name: 'Alvará de licenciamento' }).click()
  await expect(page.getByRole('heading', { name: 'Alvará de licenciamento', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Partes do documento' }).getByRole('link', { name: 'Atualizar (próximo)' }).click()
  const atualizar = page.getByRole('form', { name: 'Atualizar: Alvará de licenciamento' })
  await atualizar.getByLabel('Escolher os arquivos do documento').setInputFiles(pdfFicticio(`alvara-${proximoAno}.pdf`))
  await atualizar.getByRole('button', { name: /^Continuar/ }).click()
  await expect(atualizar.getByLabel('Vale a partir de *')).toHaveValue(`${proximoAno}-01-01`)
  await expect(atualizar.getByLabel('Vale até *')).toHaveValue(`${proximoAno}-12-31`)
  await atualizar.getByRole('button', { name: /^Continuar/ }).click()
  await expect(atualizar.getByText(`Fica guardado e entra sozinho em 01/01/${proximoAno}, quando o atual termina.`)).toBeVisible()
  await atualizar.getByRole('button', { name: 'Mandar para a secretaria conferir' }).click()
  await expect(mensagemNaTela(page, 'Alvará de licenciamento: enviado. A secretaria vai conferir.')).toBeVisible()
  await expect(page.getByText(/esperando a conferência$/)).toBeVisible()

  // 5. A presidência confere o próximo: no cartão do pastor, "entra sozinho" no dia certo
  await trocarPara(page, 'presidencia')
  await page.goto(`${endereco}/documentos`)
  await page
    .getByRole('listitem', { name: 'Alvará de licenciamento' })
    .filter({ hasText: 'Esperando a conferência' })
    .getByRole('button', { name: 'Conferir' })
    .click()
  await expect(mensagemNaTela(page, 'Alvará de licenciamento: conferido.')).toBeVisible()
  await trocarPara(page, sessaoPastor)
  await page.goto('minha-igreja/documentos')
  await expect(page.getByRole('list', { name: 'Documentos da igreja' }).getByRole('link', { name: 'Alvará de licenciamento' })).toContainText(
    `O próximo já foi conferido: entra sozinho em 01/01/${proximoAno}.`,
  )

  // Limpeza: arquiva o pastor e a igreja de teste
  await arquivarAssociadoDeTeste(page, pastor)
  await page.goto(endereco)
  await arquivarIgrejaAberta(page)
})

test('o pastor cadastra a igreja dele: o convite, os 5 passos e o acompanhamento; a secretaria confere item por item e ativa', async ({ page }, info) => {
  test.setTimeout(240_000)
  const sufixo = sufixoUnico(info.project.name)
  const pastor = `Pastor Cadastro E2E ${sufixo}`
  const igreja = `Igreja do Pastor E2E ${sufixo}`

  // um ministro associado (ainda não é pastor presidente) entra: o convite está no Início
  const sessao = await criarAssociadoComLogin(page, {
    nome: pastor,
    email: `e2e.cadastro.igreja.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja: 'Igreja Fictícia A (teste)',
  })
  await expect(page.getByRole('heading', { name: 'A igreja que você preside ainda não está no COMEP?' })).toBeVisible()
  await page.getByRole('link', { name: 'Cadastrar a minha igreja' }).click()
  await expect(page).toHaveURL(/\/cadastrar-minha-igreja$/)

  // os 5 passos, com os documentos
  const form = page.getByRole('form', { name: 'Cadastrar a minha igreja' })
  await form.getByLabel(/^Nome da igreja/).fill(igreja)
  await form.getByLabel(/^Denominação/).selectOption({ label: DENOMINACAO_DE_TESTE })
  await form.getByLabel(/^CNPJ/).fill(cnpjAleatorio())
  await form.getByRole('button', { name: /^Continuar/ }).click()
  await form.getByRole('button', { name: /^Continuar/ }).click()
  await expect(form.getByText(`Você: ${pastor}`)).toBeVisible()
  await form.getByLabel('Posse (data da ata) *').fill(dia(0))
  await form.getByRole('button', { name: /^Continuar/ }).click()
  await form.getByLabel('Escolher o estatuto').setInputFiles(pdfFicticio('estatuto.pdf'))
  await form.getByLabel('Escolher o Cartão CNPJ').setInputFiles(pdfFicticio('cartao.pdf'))
  await form.getByLabel('Escolher a ata').setInputFiles(pdfFicticio('ata.pdf'))
  await form.getByRole('button', { name: /^Continuar/ }).click()
  await form.getByRole('button', { name: 'Enviar para a secretaria' }).click()
  await expect(mensagemNaTela(page, 'Cadastro enviado para a secretaria conferir.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'A conferência' })).toContainText('A secretaria está conferindo')

  // a presidência confere item por item: recusa o endereço, aprova o resto e os documentos
  await trocarPara(page, 'presidencia')
  await page.goto('igrejas/conferir')
  await page.getByRole('list', { name: 'Igrejas novas' }).getByRole('link', { name: new RegExp(igreja) }).click()
  await expect(page.getByRole('heading', { name: igreja, level: 1 })).toBeVisible()
  const analise = page.url()
  const item = (nome: string) => page.getByRole('listitem', { name: nome, exact: true })
  await item('Endereço e contato').getByRole('button', { name: 'Recusar' }).click()
  await item('Endereço e contato').getByLabel('Motivo *').fill('Falta o endereço (teste)')
  await item('Endereço e contato').getByRole('button', { name: 'Recusar o item' }).click()
  await expect(mensagemNaTela(page, 'Endereço e contato: recusado.')).toBeVisible()
  for (const nome of ['Dados da igreja', 'Pastor e diretoria']) {
    await item(nome).getByRole('button', { name: 'Aprovar' }).click()
    await expect(mensagemNaTela(page, `${nome}: aprovado.`)).toBeVisible()
  }
  for (const nome of ['Estatuto da igreja', 'Cartão CNPJ', 'Ata da diretoria']) {
    await item(nome).getByRole('button', { name: 'Conferir' }).click()
    await expect(mensagemNaTela(page, `${nome}: conferido.`)).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Ativar a igreja' })).toBeDisabled()
  // o alvará não veio: a igreja pode entrar, suspensa, com os dias das regras (S7-07; regras de 26/11/2026)
  await expect(item('Alvará de licenciamento')).toContainText(
    'ainda não veio: a igreja pode entrar, mas fica suspensa até ele chegar; o pastor tem 30 dias, da ativação, para mandar',
  )

  // o pastor vê o selo em cada item e manda de novo só o que voltou
  await trocarPara(page, sessao)
  await page.goto('cadastrar-minha-igreja')
  await expect(item('Endereço e contato')).toContainText('Recusado: Falta o endereço (teste)')
  await expect(item('Dados da igreja')).toContainText('Aprovado pela secretaria')
  await item('Endereço e contato').getByRole('button', { name: 'Enviar de novo' }).click()
  const corrigir = page.getByRole('form', { name: 'Corrigir: Endereço e contato' })
  await corrigir.getByLabel('Endereço').fill('Rua Fictícia, 250')
  await corrigir.getByRole('button', { name: 'Mandar de novo' }).click()
  await expect(mensagemNaTela(page, 'Endereço e contato: enviado de novo para a secretaria.')).toBeVisible()

  // a presidência aprova o que voltou e ativa: o pastor vira o pastor presidente da igreja nova
  await trocarPara(page, 'presidencia')
  await page.goto(analise)
  await item('Endereço e contato').getByRole('button', { name: 'Aprovar' }).click()
  await expect(mensagemNaTela(page, 'Endereço e contato: aprovado.')).toBeVisible()
  await page.getByRole('button', { name: 'Ativar a igreja' }).click()
  await expect(mensagemNaTela(page, `${igreja}: igreja ativada no COMEP.`)).toBeVisible()
  const endereco = page.url()
  // sem o alvará, a igreja fica suspensa desde a ativação (hoje), e os 30 dias contam dela (S7-03; regras de 26/11/2026)
  await expect(page.getByRole('region', { name: 'A igreja', exact: true })).toContainText('Suspensa')
  await abrirAbaDaIgreja(page, 'Situação')
  await expect(page.getByText(`Suspensa desde ${br(dia(0))}`)).toBeVisible()
  await expect(page.getByText('Não veio: Alvará de licenciamento.')).toBeVisible()

  // o pastor presidente não nasce bloqueado: na Minha igreja, o caminho de volta, com os 30 dias para mandar o alvará
  await trocarPara(page, sessao)
  await page.goto('minha-igreja')
  await expect(page.getByRole('heading', { name: 'Para a igreja voltar a ser regular', level: 1 })).toBeVisible()
  await expect(page.getByText(`${igreja} · suspensa desde ${br(dia(0))}, porque o alvará não veio.`)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Os dias para mandar' })).toContainText('30')
  await expect(page.getByRole('region', { name: 'Mande aqui o alvará' })).toBeVisible()

  // Limpeza: arquiva o pastor e a igreja de teste
  await arquivarAssociadoDeTeste(page, pastor)
  await page.goto(endereco)
  await arquivarIgrejaAberta(page)
})
