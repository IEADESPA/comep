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

/** Sufixo único por execução e por tamanho de tela (computador/celular), para não misturar dados. */
export function sufixoUnico(projeto: string): string {
  return `${Date.now().toString(36)}-${projeto}`
}

/** CNPJ numérico válido e aleatório (fictício), para não repetir entre execuções. */
export function cnpjAleatorio(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1])
  const digito = (numeros: number[]) => {
    const pesos = numeros.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = numeros.reduce((total, n, i) => total + n * pesos[i], 0)
    return soma % 11 < 2 ? 0 : 11 - (soma % 11)
  }
  const d1 = digito(base)
  const d2 = digito([...base, d1])
  return [...base, d1, d2].join('')
}

// ---------- Sessões reaproveitadas (ver autenticacao.setup.ts) ----------

export type NomeUsuario = keyof typeof USUARIOS

/** Arquivo com a sessão guardada de cada usuário fictício. */
export function arquivoDaSessao(nome: NomeUsuario): string {
  return `playwright/.auth/${nome}.json`
}

type ItemArmazenado = { name: string; value: string }

/** Guarda a sessão de quem está logado nesta aba (ex.: um candidato recém-criado). */
export async function guardarSessao(page: Page): Promise<ItemArmazenado[]> {
  return page.evaluate(() => Object.entries(localStorage).map(([name, value]) => ({ name, value })))
}

/**
 * Troca quem está logado nesta aba, sem fazer login de novo:
 * um usuário fictício (sessão guardada), uma sessão guardada por guardarSessao, ou ninguém (null).
 */
export async function trocarPara(page: Page, quem: NomeUsuario | ItemArmazenado[] | null): Promise<void> {
  let itens: ItemArmazenado[] = []
  if (typeof quem === 'string') {
    const { readFileSync } = await import('node:fs')
    const estado = JSON.parse(readFileSync(arquivoDaSessao(quem), 'utf8')) as {
      origins: { origin: string; localStorage: ItemArmazenado[] }[]
    }
    itens = estado.origins.flatMap((o) => o.localStorage)
  } else if (quem) {
    itens = quem
  }
  if (!page.url().startsWith('http')) await page.goto('./')
  await page.evaluate((lista) => {
    localStorage.clear()
    for (const item of lista) localStorage.setItem(item.name, item.value)
  }, itens)
}
