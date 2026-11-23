import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// Testes de ponta a ponta (trava 3 — PROJETO.md, seção 14): um navegador de verdade abre o app
// ligado ao banco de TESTE e entra com usuários FICTÍCIOS de cada perfil.
// As senhas desses usuários vêm de .env.e2e.local (no computador, fora do repositório)
// ou dos Secrets do GitHub (no GitHub Actions).
if (existsSync('.env.e2e.local')) {
  for (const linha of readFileSync('.env.e2e.local', 'utf8').split('\n')) {
    const par = linha.match(/^([A-Z0-9_]+)=(.*)$/)
    if (par && !process.env[par[1]]) process.env[par[1]] = par[2]
  }
}

// E2E_URL permite testar o site publicado: o oficial (https://ieadespa.github.io/comep/, antes do lançamento)
// ou o ambiente de teste (https://ieadespa.github.io/comep/teste/). Os testes valem nos dois endereços.
// Sem ela, os testes sobem o build local em http://localhost:4173/comep/.
const urlExterna = process.env.E2E_URL
// Navegador: Edge no Windows, Chrome no GitHub; "chromium" usa o navegador do próprio Playwright.
const canalPedido = process.env.E2E_CANAL ?? (process.platform === 'win32' ? 'msedge' : 'chrome')
const canal = canalPedido === 'chromium' ? undefined : canalPedido

export default defineConfig({
  testDir: 'testes/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Rede de verdade: o login no Supabase às vezes passa de 5 s (padrão do Playwright)
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: urlExterna ?? 'http://localhost:4173/comep/',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Sem a placa de vídeo: num dos notebooks da equipe, o navegador sem tela com a GPU dá tela azul (regra da bancada)
    launchOptions: { args: ['--disable-gpu'] },
  },
  projects: [
    // Cada usuário fictício entra UMA vez; os testes reaproveitam a sessão (o Supabase limita logins por minuto)
    { name: 'preparar', testMatch: /.*\.setup\.ts/, use: { ...devices['Desktop Chrome'], channel: canal } },
    { name: 'computador', use: { ...devices['Desktop Chrome'], channel: canal }, dependencies: ['preparar'] },
    { name: 'celular', use: { ...devices['Pixel 7'], channel: canal }, dependencies: ['preparar'] },
  ],
  webServer: urlExterna
    ? undefined
    : {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173/comep/',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
