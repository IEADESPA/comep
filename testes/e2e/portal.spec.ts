// Portal do membro: login e "cada um vê só o que lhe cabe", com usuários fictícios do banco de teste.
// A proteção real dos dados está no banco (testes/banco/); aqui se confere o que cada perfil enxerga.
import { expect, test } from '@playwright/test'
import { USUARIOS, abrirMenu, abrirModulos, arquivoDaSessao, entrar, nomeDaFuncao, preencherLogin, saudacao, sair } from './ajuda'

test('senha errada mostra uma mensagem clara', async ({ page }) => {
  await preencherLogin(page, USUARIOS.presidencia.email, 'senha-errada-de-proposito')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await expect(page).toHaveURL(/\/entrar$/)
})

test.describe('presidência', () => {
  test('entra, vê todos os módulos, abre um módulo (a coluna vira o menu dele) e sai', async ({ page }, info) => {
    await entrar(page, USUARIOS.presidencia)
    await expect(page.getByRole('heading', { name: saudacao('Presidência'), level: 1 })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Presidência')
    await expect(page.getByRole('heading', { name: 'Precisa de você' })).toBeVisible()

    const modulos = await abrirModulos(page)
    for (const item of ['Inscrições', 'Ministros', 'Igrejas', 'Financeiro', 'Perfis de acesso', 'Auditoria']) {
      await expect(modulos.getByRole('link', { name: item, exact: true })).toBeVisible()
    }

    await modulos.getByRole('link', { name: 'Ministros', exact: true }).click()
    await expect(page).toHaveURL(/\/ministros$/)
    await expect(page.getByRole('heading', { name: 'Ministros', level: 1 })).toBeVisible()
    // o menu do módulo: Início para voltar, as funções do módulo e Meu perfil
    // (no celular, o Menu de cima continua curto: Início, Módulos, Avisos e Meu perfil)
    const menu = await abrirMenu(page)
    const doMenu =
      info.project.name === 'celular'
        ? ['Início', 'Módulos', 'Meu perfil']
        : ['Início', 'Ministros', 'Pedidos de associação', 'Correções pedidas', 'Cadastrar ministro', 'Meu perfil']
    for (const item of doMenu) {
      await expect(menu.getByRole('link', { name: nomeDaFuncao(item) })).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await expect(menu.getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(0)

    // A Fase 5 completou os módulos: eventos, comissões, mural e o painel da presidência
    const completo = await abrirModulos(page)
    for (const item of ['Eventos e projetos', 'Comissões', 'Mural de avisos', 'Painel da presidência']) {
      await expect(completo.getByRole('link', { name: item, exact: true })).toBeVisible()
    }
    await completo.getByRole('link', { name: 'Eventos e projetos', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Eventos e projetos', level: 1 })).toBeVisible()

    await sair(page)
    await expect(page).toHaveURL(/\/entrar$/)
  })
})

test.describe('ministro', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('vê só os módulos de ministro', async ({ page }) => {
    await page.goto('painel')
    await expect(page.getByRole('heading', { name: saudacao('Ministro'), level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Para você' })).toBeVisible()

    const menu = await abrirMenu(page)
    await expect(menu.getByRole('link', { name: 'Meu perfil', exact: true })).toBeVisible()

    const modulos = await abrirModulos(page)
    await expect(modulos.getByRole('link', { name: 'Minhas mensalidades', exact: true })).toBeVisible()
    await expect(modulos.getByRole('link', { name: 'Minha credencial', exact: true })).toBeVisible()
    for (const item of ['Inscrições', 'Ministros', 'Credenciais', 'Financeiro', 'Perfis de acesso', 'Auditoria', 'Minha igreja']) {
      await expect(modulos.getByRole('link', { name: item, exact: true })).toHaveCount(0)
    }
  })

  test('não abre as áreas da diretoria nem digitando o endereço', async ({ page }) => {
    for (const area of [
      'auditoria',
      'acessos',
      'ministros',
      'ministros/novo',
      'igrejas',
      'igrejas/nova',
      'inscricoes',
      'configuracoes',
      'minha-igreja',
      'financeiro',
    ]) {
      await page.goto(area)
      await expect(page.getByRole('heading', { name: 'Sem acesso' }), area).toBeVisible()
    }
  })
})

test.describe('pessoa sem perfil', () => {
  test.use({ storageState: arquivoDaSessao('semPerfil') })

  test('entra, é avisada e vê o caminho para o pedido de associação', async ({ page }) => {
    await page.goto('painel')
    await expect(page.getByRole('heading', { name: 'Seu pedido de associação' })).toBeVisible()
    await expect(page.getByText('Este login ainda não tem nenhum perfil no sistema.')).toBeVisible()
    await expect(page.getByRole('link', { name: /^(Fazer|Ver) o meu pedido/ })).toBeVisible()
    const menu = await abrirMenu(page)
    await expect(menu.getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(0)
    await expect(menu.getByRole('link', { name: 'Meu pedido', exact: true })).toBeVisible()
  })

  test('Meus dados não manda pedir correção na aba Correções, que ela não tem (D-01)', async ({ page }) => {
    await page.goto('meu-perfil')
    await expect(page.getByText('Pela LGPD, você pode ver e corrigir os seus dados aqui.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Correções' })).toHaveCount(0)
  })
})
