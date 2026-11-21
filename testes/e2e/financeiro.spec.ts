// Fase 2.1: contribuições — a tesouraria gera, o associado escolhe o plano e informa o pagamento, a tesouraria confirma.
// Associado FICTÍCIO criado pelo próprio teste (e arquivado no fim). Vale em qualquer dia do ano.
import { expect, test, type Page } from '@playwright/test'
import { abrirFuncao, arquivarAssociadoDeTeste, criarAssociadoComLogin, mensagemNaTela, sufixoUnico, trocarPara } from './ajuda'

const COMPROVANTE = {
  name: 'pix.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
}

const PREFIXO = 'Contribuinte E2E'

/**
 * Arquiva os associados "Contribuinte E2E …" que sobraram de uma rodada cortada no meio (antes do arquivamento do fim).
 * Os testes rodam um de cada vez (workers: 1), então nenhum outro teste está usando esses cadastros. Os pagamentos
 * deles continuam no caixa (arquivar o cadastro não desfaz o que foi pago).
 */
async function arquivarSobrasDeRodadasAnteriores(page: Page) {
  await trocarPara(page, 'presidencia')
  await page.goto(`ministros?busca=${encodeURIComponent(PREFIXO)}`)
  const lista = page.getByRole('list', { name: 'Ministros' })
  await expect(lista.or(page.getByText('Nenhum ministro encontrado.')).first()).toBeVisible()
  const sobras = (await lista.locator('strong').allTextContents()).filter((n) => n.startsWith(PREFIXO)).slice(0, 10)
  for (const sobra of sobras) await arquivarAssociadoDeTeste(page, sobra)
}

function exercicioAtual(): string {
  const hoje = new Date()
  const ano = hoje.getMonth() + 1 >= 4 ? hoje.getFullYear() : hoje.getFullYear() - 1
  return `${ano}/${ano + 1}`
}

test('a tesouraria gera as cobranças; o associado escolhe a anuidade e informa o pagamento; a tesouraria confirma', async ({
  page,
}, info) => {
  test.setTimeout(240_000)
  await arquivarSobrasDeRodadasAnteriores(page)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `${PREFIXO} ${sufixo}`
  const anuidade = `Anuidade ${exercicioAtual()}`
  const associado = await criarAssociadoComLogin(page, {
    nome,
    email: `e2e.contribuinte.${sufixo}@example.com`,
    senha: 'SenhaE2e123',
    igreja: 'Igreja Fictícia A (teste)',
  })

  // 1. A tesouraria (aqui, a presidência) gera as cobranças do exercício
  await trocarPara(page, 'presidencia')
  await page.goto('financeiro')
  await abrirFuncao(page, 'Cobranças do ano', 'Contribuições')
  await page.getByRole('button', { name: 'Gerar cobranças do exercício' }).click()
  await expect(mensagemNaTela(page, /cobrança\(s\) gerada\(s\)/)).toBeVisible()

  // 2. O associado vê as mensalidades, escolhe a anuidade e informa o pagamento
  await trocarPara(page, associado)
  await page.goto('minhas-mensalidades')
  await expect(page.getByRole('list', { name: 'Contribuições do exercício' }).getByRole('listitem')).toHaveCount(12)
  await page.getByRole('button', { name: 'Prefiro pagar o ano inteiro (anuidade)' }).click()
  await expect(mensagemNaTela(page, 'Plano anual escolhido')).toBeVisible()
  const lista = page.getByRole('list', { name: 'Contribuições do exercício' })
  await expect(lista.getByRole('listitem')).toHaveCount(1)
  await expect(lista).toContainText(`${anuidade} — R$ 200,00`)

  // Sem comprovante, o PIX é recusado na própria tela
  await page.getByRole('checkbox', { name: new RegExp(`^${anuidade}`) }).check()
  await page.getByRole('button', { name: 'Informar pagamento' }).click()
  await expect(page.getByRole('alert')).toContainText('Envie o comprovante')
  await page.getByLabel(/^Comprovante/).setInputFiles(COMPROVANTE)
  await page.getByRole('button', { name: 'Informar pagamento' }).click()
  await expect(mensagemNaTela(page, 'Pagamento informado. A tesouraria vai conferir.')).toBeVisible()
  await expect(lista).toContainText('Aguardando a tesouraria')

  // 3. A tesouraria confere o comprovante e confirma (o Financeiro abre nos comprovantes)
  await trocarPara(page, 'presidencia')
  await page.goto('financeiro')
  await expect(page).toHaveURL(/\/financeiro\/comprovantes$/)
  const pagamento = page.getByRole('listitem', { name: `Pagamento de ${nome}` })
  await expect(pagamento).toContainText(`${anuidade} · R$ 200,00`)
  await expect(pagamento.getByRole('link', { name: 'Ver comprovante' })).toBeVisible()
  await pagamento.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(mensagemNaTela(page, `Pagamento de ${nome} confirmado`)).toBeVisible()

  // A situação do associado aparece certa para a tesouraria
  await abrirFuncao(page, 'Situação dos ministros', 'Contribuições')
  await page.getByRole('searchbox', { name: 'Buscar ministro ou igreja', exact: true }).fill(nome)
  await expect(page.getByRole('list', { name: 'Situação dos ministros' }).getByRole('listitem', { name: nome })).toContainText('Em dia')

  // O pagamento confirmado entrou sozinho no caixa (PIX → conta bancária)
  await abrirFuncao(page, 'Caixa')
  await expect(page.getByRole('listitem', { name: `Contribuição de ${nome} — ${anuidade.toLowerCase()}` })).toContainText(
    'R$ 200,00',
  )

  // 4. O associado está em dia (pode votar e ser votado)
  await trocarPara(page, associado)
  await page.goto('minhas-mensalidades')
  await expect(page.getByText('Em dia', { exact: true })).toBeVisible()
  await expect(lista).toContainText('Paga')

  await arquivarAssociadoDeTeste(page, nome)
})
