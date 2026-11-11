// Portal do membro: login e "cada um vê só o que lhe cabe", com usuários fictícios do banco de teste.
// A proteção real dos dados está no banco (testes/banco/); aqui se confere o que cada perfil enxerga.
import { expect, test } from '@playwright/test'
import { USUARIOS, abrirMenu, entrar, preencherLogin } from './ajuda'

test('senha errada mostra uma mensagem clara', async ({ page }) => {
  await preencherLogin(page, USUARIOS.presidencia.email, 'senha-errada-de-proposito')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await expect(page).toHaveURL(/\/comep\/entrar$/)
})

test.describe('presidência', () => {
  test('entra, vê o menu completo, abre uma área e sai', async ({ page }) => {
    await entrar(page, USUARIOS.presidencia)
    await expect(page.getByRole('heading', { name: 'Olá, Presidência!' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Presidência')

    const menu = await abrirMenu(page)
    for (const item of ['Inscrições', 'Ministros', 'Igrejas', 'Financeiro', 'Perfis de acesso', 'Auditoria']) {
      await expect(menu.getByRole('link', { name: item, exact: true })).toBeVisible()
    }

    await menu.getByRole('link', { name: 'Ministros', exact: true }).click()
    await expect(page).toHaveURL(/\/comep\/ministros$/)
    await expect(page.getByRole('heading', { name: 'Ministros', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Cadastrar associado' })).toBeVisible()

    // Telas das próximas fases avisam que estão em construção
    await (await abrirMenu(page)).getByRole('link', { name: 'Financeiro', exact: true }).click()
    await expect(page.getByText('Em construção — prevista para a Fase 2')).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/comep\/entrar$/)
  })
})

test.describe('ministro', () => {
  test('vê só os itens de ministro', async ({ page }) => {
    await entrar(page, USUARIOS.ministro)
    await expect(page.getByRole('heading', { name: 'Olá, Ministro!' })).toBeVisible()

    const menu = await abrirMenu(page)
    await expect(menu.getByRole('link', { name: 'Minhas mensalidades', exact: true })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Minha carteirinha', exact: true })).toBeVisible()
    for (const item of ['Inscrições', 'Ministros', 'Financeiro', 'Perfis de acesso', 'Auditoria']) {
      await expect(menu.getByRole('link', { name: item, exact: true })).toHaveCount(0)
    }
  })

  test('não abre as áreas da diretoria nem digitando o endereço', async ({ page }) => {
    await entrar(page, USUARIOS.ministro)
    for (const area of ['auditoria', 'acessos', 'ministros', 'ministros/novo', 'igrejas', 'igrejas/nova']) {
      await page.goto(area)
      await expect(page.getByRole('heading', { name: 'Sem acesso' }), area).toBeVisible()
    }
  })
})

test('pessoa sem perfil entra mas é avisada', async ({ page }) => {
  await entrar(page, USUARIOS.semPerfil)
  await expect(page.getByText('Nenhum perfil foi atribuído a você ainda.')).toBeVisible()
  const menu = await abrirMenu(page)
  await expect(menu.getByRole('link', { name: 'Financeiro', exact: true })).toHaveCount(0)
})
