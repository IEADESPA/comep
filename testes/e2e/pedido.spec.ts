// Fase 1.2 (parte 2): código de primeiro acesso, senha esquecida e pedido de associação completo.
// Tudo com dados FICTÍCIOS no banco de teste (e-mails @example.com). Os associados criados são arquivados no fim.
import { expect, test, type Page } from '@playwright/test'
import { guardarSessao, sufixoUnico, trocarPara } from './ajuda'

const mensagem = (page: Page, texto: string | RegExp) => page.getByRole('status').filter({ hasText: texto })

// Arquivos fictícios: uma imagem PNG de 1×1 e um PDF mínimo
const FOTO = {
  name: 'foto.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}
const COMPROVANTE = {
  name: 'credencial.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
}

async function abrirFichaDoMinistro(page: Page, nome: string) {
  await page.goto('ministros')
  await page.getByLabel('Buscar associado').fill(nome)
  await page.getByRole('list', { name: 'Associados' }).getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
}

async function arquivarCadastroAberto(page: Page) {
  await page.getByText('Arquivar cadastro', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/ministros$/)
}

test('associado antigo: primeiro acesso com código e, depois, senha esquecida com outro código', async ({ page }, info) => {
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Acesso E2E ${sufixo}`
  const email = `e2e.acesso.${sufixo}@example.com`

  // 1. A presidência cadastra o associado (sem login) e gera o código
  await trocarPara(page, 'presidencia')
  await page.goto('ministros/novo')
  await page.getByLabel(/^Nome completo/).fill(nome)
  await page.getByLabel(/^Telefone/).fill('(94) 90000-0000')
  await page.getByLabel(/^Título ministerial/).selectOption({ label: 'Pastor(a)' })
  await page.getByLabel(/^Igreja \*/).selectOption({ label: 'Igreja Fictícia A (teste)' })
  await page.getByRole('button', { name: 'Cadastrar associado' }).click()
  await expect(mensagem(page, 'Associado cadastrado.')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar código de primeiro acesso' }).click()
  const codigo = (await page.locator('.codigo').textContent())?.trim() ?? ''
  expect(codigo).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/)
  await expect(page.getByRole('link', { name: 'Enviar pelo WhatsApp' })).toHaveAttribute('href', /wa\.me\/5594900000000/)

  // 2. O associado cria o login com o código (sem e-mail nenhum)
  await trocarPara(page, null)
  await page.goto('entrar')
  await page.getByRole('link', { name: 'Primeiro acesso (recebi um código)' }).click()
  await page.getByLabel('Código de acesso').fill(codigo.toLowerCase())
  await page.getByLabel('Seu e-mail').fill(email)
  // Senha só com letras é recusada (precisa de letras e números)
  await page.getByLabel('Crie uma senha').fill('somenteletras')
  await page.getByLabel('Repita a senha').fill('somenteletras')
  await page.getByRole('button', { name: 'Criar meu acesso' }).click()
  await expect(page.getByRole('alert')).toContainText('pelo menos 8 caracteres, com letras e números')
  await page.getByLabel('Crie uma senha').fill('SenhaE2e123')
  await page.getByLabel('Repita a senha').fill('SenhaE2e123')
  await page.getByRole('button', { name: 'Criar meu acesso' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Olá, Acesso!' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Ministro')

  // 3. Esqueceu a senha: a presidência gera o código de nova senha
  await trocarPara(page, 'presidencia')
  await abrirFichaDoMinistro(page, nome)
  await expect(page.getByText('Já tem login no portal')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar código para nova senha' }).click()
  const codigoSenha = (await page.locator('.codigo').textContent())?.trim() ?? ''

  // 4. O associado troca a senha com o código e já entra
  await trocarPara(page, null)
  await page.goto('entrar')
  await page.getByRole('link', { name: 'Esqueci a senha' }).click()
  await page.getByLabel('Código para nova senha').fill(codigoSenha)
  await page.getByLabel('Seu e-mail de login').fill(email)
  await page.getByLabel(/^Nova senha/).fill('OutraSenha456')
  await page.getByLabel('Repita a senha').fill('OutraSenha456')
  await page.getByRole('button', { name: 'Trocar a senha e entrar' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Olá, Acesso!' })).toBeVisible()

  // Limpeza: arquiva o cadastro de teste
  await trocarPara(page, 'presidencia')
  await abrirFichaDoMinistro(page, nome)
  await arquivarCadastroAberto(page)
})

test('pedido de associação: envia, recebe pendência, corrige, a diretoria encaminha e a assembleia aprova', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Candidato E2E ${sufixo}`
  const email = `e2e.candidato.${sufixo}@example.com`

  // 1. O candidato cria o acesso pelo site
  await trocarPara(page, null)
  await page.goto('associar')
  await page.getByRole('link', { name: 'Fazer meu pedido' }).click()
  await page.getByLabel('Nome completo').fill(nome)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Crie uma senha').fill('SenhaE2e123')
  await page.getByLabel('Repita a senha').fill('SenhaE2e123')
  await page.getByRole('button', { name: 'Criar acesso e continuar' }).click()
  await expect(page).toHaveURL(/\/meu-pedido$/)

  // 2. Preenche e envia o pedido, com foto e comprovante
  await page.getByLabel(/^Telefone/).fill('(94) 91111-1111')
  await page.getByLabel(/^Título ministerial/).selectOption({ label: 'Evangelista' })
  await page.getByLabel(/^Sua igreja/).selectOption({ label: 'Minha igreja não está na lista' })
  await page.getByLabel(/^Nome da sua igreja/).fill('Igreja Informada E2E')
  await page.getByLabel(/^Sua foto/).setInputFiles(FOTO)
  await expect(page.getByAltText('Prévia da sua foto')).toBeVisible()
  await page.getByLabel(/^Comprovante do título/).setInputFiles(COMPROVANTE)
  await page.getByLabel(/princípios do Art\. 7º/).check()
  await page.getByLabel(/Concordo com o estatuto/).check()
  await page.getByLabel(/Autorizo o COMEP/).check()
  await page.getByRole('button', { name: 'Enviar pedido' }).click()
  await expect(mensagem(page, 'Pedido enviado!')).toBeVisible()
  await expect(page.getByText('Aguardando análise da diretoria')).toBeVisible()
  const candidato = await guardarSessao(page)

  // 3. A presidência analisa e devolve com pendência
  await trocarPara(page, 'presidencia')
  await page.goto('inscricoes')
  await page.getByRole('list', { name: 'Pedidos' }).getByRole('link', { name: new RegExp(nome) }).click()
  await expect(page.getByText('Igreja Informada E2E (não cadastrada)')).toBeVisible()
  await expect(page.getByRole('img', { name: `Foto de ${nome}` })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir comprovante do título' })).toBeVisible()
  await page.getByText('Devolver com pendência').click()
  await page.getByLabel(/O que o candidato precisa corrigir/).fill('Envie uma foto mais nítida.')
  await page.getByRole('button', { name: 'Devolver' }).click()
  await expect(mensagem(page, 'Pedido devolvido ao candidato.')).toBeVisible()
  const enderecoPedido = page.url()

  // 4. O candidato vê a pendência, troca a foto e reenvia
  await trocarPara(page, candidato)
  await page.goto('meu-pedido')
  await expect(page.getByText('Envie uma foto mais nítida.')).toBeVisible()
  await page.getByLabel(/^Sua foto/).setInputFiles(FOTO)
  await page.getByLabel(/princípios do Art\. 7º/).check()
  await page.getByLabel(/Concordo com o estatuto/).check()
  await page.getByLabel(/Autorizo o COMEP/).check()
  await page.getByRole('button', { name: 'Corrigir e reenviar' }).click()
  await expect(mensagem(page, 'Correção enviada.')).toBeVisible()

  // 5. A presidência escolhe a igreja cadastrada, aceita a ficha e registra a aprovação da assembleia
  await trocarPara(page, 'presidencia')
  await page.goto(enderecoPedido)
  await page.getByLabel(/^Igreja cadastrada do candidato/).selectOption({ label: 'Igreja Fictícia B (teste)' })
  await page.getByRole('button', { name: 'Aceitar a ficha e encaminhar à assembleia' }).click()
  await expect(mensagem(page, 'Ficha aceita e pedido encaminhado à Assembleia Ordinária.')).toBeVisible()
  await expect(page.getByText(/Aceite do diretor/)).toBeVisible()
  await page.getByLabel('Ata', { exact: true }).fill('Ata E2E')
  await page.getByRole('button', { name: 'Registrar aprovação' }).click()
  await expect(mensagem(page, 'Aprovado!')).toBeVisible()
  await page.getByRole('link', { name: 'Abrir a ficha do associado' }).click()
  await expect(page.getByText('Aprovado em Assembleia Ordinária')).toBeVisible()
  await expect(page.getByText(/Nº de registro \d+/)).toBeVisible()

  // 6. O candidato agora é associado
  await trocarPara(page, candidato)
  await page.goto('meu-pedido')
  await expect(page.getByText(/Aprovado na Assembleia Ordinária de/)).toBeVisible()
  await page.goto('painel')
  await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Ministro')

  // Limpeza: arquiva o associado de teste (o pedido aprovado fica no histórico)
  await trocarPara(page, 'presidencia')
  await abrirFichaDoMinistro(page, nome)
  await arquivarCadastroAberto(page)
})
