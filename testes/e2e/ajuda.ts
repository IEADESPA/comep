import { expect, type Locator, type Page } from '@playwright/test'

// Usuários FICTÍCIOS que existem só no banco de teste (comep-teste).
export const USUARIOS = {
  presidencia: { email: 'e2e.presidencia@example.com', senhaVar: 'E2E_SENHA_PRESIDENCIA' },
  ministro: { email: 'e2e.ministro@example.com', senhaVar: 'E2E_SENHA_MINISTRO' },
  semPerfil: { email: 'e2e.semperfil@example.com', senhaVar: 'E2E_SENHA_SEM_PERFIL' },
} as const

export type Usuario = (typeof USUARIOS)[keyof typeof USUARIOS]

export function senhaDe(usuario: Usuario): string {
  const senha = process.env[usuario.senhaVar]
  if (!senha) throw new Error(`Falta a variável ${usuario.senhaVar} (arquivo .env.e2e.local ou Secret do GitHub).`)
  return senha
}

export async function preencherLogin(page: Page, email: string, senha: string) {
  await page.goto('entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

export async function entrar(page: Page, usuario: Usuario) {
  await preencherLogin(page, usuario.email, senhaDe(usuario))
  await expect(page).toHaveURL(/\/comep\/painel$/)
}

/** No celular o menu fica atrás do botão "Menu"; no computador ele já aparece. */
export async function abrirMenu(page: Page): Promise<Locator> {
  const botao = page.getByRole('button', { name: 'Menu' })
  if (await botao.isVisible()) await botao.click()
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu).toBeVisible()
  return menu
}
