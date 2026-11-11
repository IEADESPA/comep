// Entra uma vez com cada usuário fictício e guarda a sessão (playwright/.auth, fora do repositório).
import { expect, test as preparar } from '@playwright/test'
import { USUARIOS, arquivoDaSessao, entrar, type NomeUsuario } from './ajuda'

for (const nome of Object.keys(USUARIOS) as NomeUsuario[]) {
  preparar(`sessão de ${nome}`, async ({ page }) => {
    await entrar(page, USUARIOS[nome])
    await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
    await page.context().storageState({ path: arquivoDaSessao(nome) })
  })
}
