// Fase 1.3: portal do ministro (meu perfil, troca de igreja, senha) e painel do presidente de igreja.
// Dados FICTÍCIOS do banco de teste; os associados e igrejas criados aqui são arquivados no fim.
import { expect, test } from '@playwright/test'
import {
  abrirFichaDoMinistro,
  arquivarAssociadoDeTeste,
  arquivarIgrejaAberta,
  arquivoDaSessao,
  cadastrarIgreja,
  cadastrarMinistro,
  criarAssociadoComLogin,
  mensagemNaTela,
  pdfFicticio,
  preencherLogin,
  sufixoUnico,
  trocarPara,
} from './ajuda'

const FOTO = {
  name: 'foto.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

test.describe('ministro fictício (sessão guardada)', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê os próprios dados e corrige o telefone', async ({ page }) => {
    // a ficha com abas (telas novas, Fase 5.5): cada aba tem endereço próprio
    await page.goto('meu-perfil/comep')
    await expect(page.getByRole('heading', { name: 'Meu perfil', level: 1 })).toBeAttached()
    const noComep = page.locator('section', { has: page.getByRole('heading', { name: 'A sua situação no COMEP' }) })
    await expect(noComep).toContainText('Nº de registro')
    await expect(noComep).toContainText('Não presidente de igreja — R$ 20,00 por mês ou R$ 200,00 por ano')
    await expect(page.getByLabel('Seus dados principais')).toContainText('Igreja Fictícia A (teste)')

    await page.getByRole('navigation', { name: 'Partes do meu perfil' }).getByRole('link', { name: 'Meus dados' }).click()
    await expect(page).toHaveURL(/\/meu-perfil$/)

    // o nome vai na credencial: o associado não muda sozinho (a secretaria corrige)
    await expect(page.getByLabel(/^Nome completo/)).toBeDisabled()
    const telefone = `(94) 9${Math.floor(1000 + Math.random() * 8999)}-0000`
    await page.getByLabel('Telefone (WhatsApp)').fill(telefone)
    await page.getByRole('button', { name: 'Salvar meus dados' }).click()
    await expect(mensagemNaTela(page, 'Seus dados foram salvos.')).toBeVisible()
    // a troca da foto fica no teste de baixo, com um ministro novo a cada rodada: a própria pessoa troca a foto
    // até 10 vezes por dia, e este ministro fictício é o mesmo em todas as rodadas
  })
})

test('o ministro troca a foto e pede troca de igreja, a secretaria aprova; o ministro troca a própria senha', async ({ page }, info) => {
  test.setTimeout(120_000)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Troca E2E ${sufixo}`
  const email = `e2e.troca.${sufixo}@example.com`
  const ministro = await criarAssociadoComLogin(page, {
    nome,
    email,
    senha: 'SenhaE2e123',
    igreja: 'Igreja Fictícia A (teste)',
  })

  // O ministro troca a própria foto (aba "Meus dados")
  await page.goto('meu-perfil')
  await page.locator('.botao-arquivo input[type=file]').setInputFiles(FOTO)
  await expect(mensagemNaTela(page, 'Foto atualizada.')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Sua foto' })).toBeVisible()

  // O ministro pede a troca para a Igreja B (aba "Minha igreja" do perfil)
  await page.goto('meu-perfil/igreja')
  await expect(page.getByRole('heading', { name: 'Pedir troca de igreja' })).toBeVisible()
  await page.getByLabel(/^Igreja nova/).selectOption({ label: 'Igreja Fictícia B (teste)' })
  await page.getByLabel('Função na igreja nova').fill('Pastor auxiliar')
  // Troca marcada para daqui a 10 dias: a secretaria precisa conseguir aprovar mesmo assim
  const daqui10Dias = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel('A partir de').fill(daqui10Dias)
  await page.getByRole('button', { name: 'Enviar pedido de troca' }).click()
  await expect(mensagemNaTela(page, 'Pedido de troca de igreja enviado à secretaria.')).toBeVisible()
  await expect(page.getByText(/Pedido de troca para Igreja Fictícia B \(teste\)/)).toBeVisible()

  // ...e troca a própria senha (aba "Senha")
  await page.goto('meu-perfil/senha')
  await page.getByLabel('Senha atual').fill('SenhaE2e123')
  await page.getByLabel('Senha nova', { exact: true }).fill('NovaSenha789')
  await page.getByLabel('Repita a senha nova').fill('NovaSenha789')
  await page.getByRole('button', { name: 'Trocar a senha' }).click()
  await expect(mensagemNaTela(page, 'Senha trocada.')).toBeVisible()

  // A presidência vê o pedido em Ministros e inscrições › Correções pedidas e aprova
  await trocarPara(page, 'presidencia')
  await page.goto('ministros/correcoes')
  const pedido = page.getByRole('listitem', { name: `Troca de ${nome}` })
  await expect(pedido).toContainText('Igreja Fictícia B (teste)')
  await pedido.getByRole('button', { name: 'Aprovar troca' }).click()
  await expect(mensagemNaTela(page, `Troca de igreja de ${nome} aprovada.`)).toBeVisible()

  // O ministro entra com a senha nova e vê a igreja nova, com o histórico
  await trocarPara(page, null)
  await preencherLogin(page, email, 'NovaSenha789')
  await expect(page).toHaveURL(/\/painel$/)
  await page.goto('meu-perfil/igreja')
  const historico = page.getByRole('list', { name: 'Histórico de igrejas' })
  await expect(historico.getByRole('listitem').first()).toContainText('Igreja Fictícia B (teste)')
  await expect(historico.getByRole('listitem').first()).toContainText('até hoje')
  await expect(historico).toContainText('Igreja Fictícia A (teste)')
  void ministro

  await arquivarAssociadoDeTeste(page, nome)
})

test('o pastor presidente vê os ministros da igreja dele e atualiza o contato da igreja', async ({ page }, info) => {
  test.setTimeout(120_000)
  const sufixo = sufixoUnico(info.project.name)
  const igreja = `Igreja E2E ${sufixo}`
  const auxiliar = `Auxiliar E2E ${sufixo}`
  const presidente = `Presidente E2E ${sufixo}`

  // A presidência cadastra a igreja e um ministro auxiliar dela
  await trocarPara(page, 'presidencia')
  const enderecoIgreja = await cadastrarIgreja(page, { nome: igreja })
  await cadastrarMinistro(page, {
    nome: auxiliar,
    telefone: '(94) 92222-2222',
    titulo: 'Evangelista',
    igreja,
    funcao: 'Evangelista dirigente',
  })

  // O pastor presidente da igreja cria o login e abre "Minha igreja"
  await criarAssociadoComLogin(page, {
    nome: presidente,
    email: `e2e.presidente.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja,
    pastorPresidente: true,
  })
  await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Presidente de igreja')
  // Minha igreja em abas (telas novas, Fase 5.5): Dados, Documentos, Diretoria, Ministros e Agenda
  await page.goto('minha-igreja/ministros')
  await expect(page.getByRole('heading', { name: igreja, level: 2 })).toBeVisible()
  const ministros = page.getByRole('list', { name: 'Ministros da igreja' })
  await expect(ministros).toContainText(presidente)
  await expect(ministros).toContainText(auxiliar)
  await expect(ministros).toContainText('Evangelista dirigente')
  await expect(ministros.getByRole('link', { name: '(94) 92222-2222' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Partes da minha igreja' }).getByRole('link', { name: 'Dados' }).click()
  await page.getByLabel('Endereço').fill('Rua Fictícia, 100')
  await page.getByLabel('Telefone da igreja').fill('(94) 93333-3333')
  await page.getByRole('button', { name: 'Salvar contato da igreja' }).click()
  await expect(mensagemNaTela(page, 'Contato da igreja atualizado.')).toBeVisible()

  // Fase 5.1: a igreja como instituição — o pastor presidente envia o estatuto, informa a diretoria e pede uma correção
  await expect(page.getByText(/2 ministros associados/)).toBeVisible()
  // Fase 5.5: o documento vai com as partes (até 25 MB cada); a diretoria vai com a ata, com o mandato
  // os documentos em cartões (parte 6): o cartão abre a página do documento; "Atualizar" é o passo a passo
  await page.goto('minha-igreja/documentos')
  const cartoes = page.getByRole('list', { name: 'Documentos da igreja' })
  await expect(cartoes.getByRole('link', { name: 'Estatuto da igreja' })).toContainText('Falta mandar')
  await cartoes.getByRole('link', { name: 'Estatuto da igreja' }).click()
  await page.getByRole('navigation', { name: 'Partes do documento' }).getByRole('link', { name: 'Atualizar (próximo)' }).click()
  const envio = page.getByRole('form', { name: 'Atualizar: Estatuto da igreja' })
  await envio.getByLabel('Escolher os arquivos do documento').setInputFiles([pdfFicticio('estatuto-parte-1.pdf'), pdfFicticio('estatuto-parte-2.pdf')])
  await expect(envio.getByRole('list', { name: 'Partes escolhidas' }).getByRole('listitem')).toHaveCount(2)
  await envio.getByRole('button', { name: /^Continuar/ }).click()
  await envio.getByRole('button', { name: 'Mandar para a secretaria conferir' }).click()
  await expect(mensagemNaTela(page, 'Estatuto da igreja: enviado. A secretaria vai conferir.')).toBeVisible()
  await expect(page.getByText(/esperando a conferência$/)).toBeVisible()
  await page.getByRole('navigation', { name: 'Partes do documento' }).getByRole('link', { name: 'Histórico' }).click()
  await expect(page.getByRole('list', { name: 'Histórico do documento' })).toContainText('Esperando a conferência')
  await expect(page.getByRole('list', { name: 'Histórico do documento' }).getByRole('link', { name: 'Parte 2' })).toBeVisible()

  await page.goto('minha-igreja/diretoria')
  await page.getByText('Informar a diretoria (com a ata)').click()
  const ata = page.getByRole('form', { name: 'Mandar: Ata da diretoria' })
  await ata.getByLabel('Posse (data da ata) *').fill(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Belem' }))
  // a lista mostra o nome e o nº de registro: escolhe pela opção que tem o nome
  const quemOcupa = ata.getByLabel('Quem ocupa o cargo 1')
  await quemOcupa.selectOption((await quemOcupa.locator('option', { hasText: presidente }).getAttribute('value')) ?? '')
  await ata.getByLabel('Nome completo 4').fill('Tesoureira Fictícia de Teste')
  await expect(ata.getByText(/^A diretoria vale até/)).toBeVisible()
  await ata.getByLabel('Escolher os arquivos do documento').setInputFiles(pdfFicticio('ata.pdf'))
  await ata.getByRole('button', { name: 'Mandar para a secretaria conferir' }).click()
  await expect(mensagemNaTela(page, 'Ata e diretoria enviadas: a secretaria vai conferir.')).toBeVisible()
  await expect(page.getByText('Ata nova esperando a secretaria')).toBeVisible()

  await page.goto('minha-igreja/ministros')
  // a correção é estruturada: escolhe o dado, vê como está e escolhe como deve ficar (nada de texto livre)
  await page.getByText(`Pedir correção no cadastro de ${auxiliar}`).click()
  const correcaoForm = page.getByRole('form', { name: `Pedir correção no cadastro de ${auxiliar}` })
  await correcaoForm.getByLabel(/^O que precisa ser corrigido/).selectOption({ label: 'Título ministerial' })
  await expect(correcaoForm.getByLabel('Como está hoje')).toHaveValue('Evangelista')
  await correcaoForm.getByLabel(/^Como deve ficar/).selectOption({ label: 'Presbítero' })
  await correcaoForm.getByRole('button', { name: 'Mandar para a secretaria' }).click()
  await expect(mensagemNaTela(page, 'Pedido de correção enviado à secretaria.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Pedidos de correção' })).toContainText('Esperando a secretaria')

  // A presidência confere o estatuto e atende a correção
  await trocarPara(page, 'presidencia')
  await page.goto('igrejas/conferir')
  await expect(page.getByRole('list', { name: 'Documentos para conferir' })).toContainText(igreja)
  await page.goto(`${enderecoIgreja}/documentos`)
  await page.getByRole('listitem', { name: 'Estatuto da igreja' }).getByRole('button', { name: 'Conferir' }).click()
  await expect(mensagemNaTela(page, 'Estatuto da igreja: conferido.')).toBeVisible()
  // a mudança da diretoria: como estava e como fica; conferida, vira a diretoria em vigor
  await page.goto(`${enderecoIgreja}/diretoria`)
  await page.getByRole('region', { name: 'Mudança da diretoria para conferir' }).getByRole('button', { name: 'Conferir e aceitar' }).click()
  await expect(mensagemNaTela(page, 'Diretoria conferida e aceita.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Diretoria em vigor' })).toContainText(presidente)
  await expect(page.getByRole('list', { name: 'Diretoria em vigor' })).toContainText('Tesoureira Fictícia de Teste')
  await page.goto('ministros/correcoes')
  const correcao = page.getByRole('listitem', { name: `Correção: ${auxiliar}` })
  await expect(correcao).toContainText('Título ministerial: Evangelista → Presbítero')
  await correcao.getByRole('button', { name: 'Aceitar' }).click()
  await expect(mensagemNaTela(page, `Correção de ${auxiliar}: aceita e já no cadastro.`)).toBeVisible()
  // aceita, a correção entrou sozinha no cadastro
  await abrirFichaDoMinistro(page, auxiliar)
  await expect(page.getByRole('region', { name: 'O ministro' })).toContainText('Presbítero')

  // Limpeza: arquiva os dois associados e a igreja de teste
  await arquivarAssociadoDeTeste(page, auxiliar)
  await arquivarAssociadoDeTeste(page, presidente)
  await page.goto(enderecoIgreja)
  await expect(page.getByLabel('Telefone', { exact: true })).toHaveValue('(94) 93333-3333')
  await arquivarIgrejaAberta(page)
})
