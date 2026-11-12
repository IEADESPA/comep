// Fase 2.1: contribuições — a tesouraria gera, o associado escolhe o plano e informa o pagamento, a tesouraria confirma.
// Associado FICTÍCIO criado pelo próprio teste (e arquivado no fim). Vale em qualquer dia do ano.
import { expect, test } from '@playwright/test'
import { arquivarAssociadoDeTeste, criarAssociadoComLogin, mensagemNaTela, sufixoUnico, trocarPara } from './ajuda'

const COMPROVANTE = {
  name: 'pix.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
}

function exercicioAtual(): string {
  const hoje = new Date()
  const ano = hoje.getMonth() + 1 >= 4 ? hoje.getFullYear() : hoje.getFullYear() - 1
  return `${ano}/${ano + 1}`
}

test('a tesouraria gera as cobranças; o associado escolhe a anuidade e informa o pagamento; a tesouraria confirma', async ({
  page,
}, info) => {
  test.setTimeout(150_000)
  const sufixo = sufixoUnico(info.project.name)
  const nome = `Contribuinte E2E ${sufixo}`
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
  await page.getByRole('tab', { name: 'Cobranças do exercício' }).click()
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

  // 3. A tesouraria confere o comprovante e confirma
  await trocarPara(page, 'presidencia')
  await page.goto('financeiro')
  const pagamento = page.getByRole('listitem', { name: `Pagamento de ${nome}` })
  await expect(pagamento).toContainText(`${anuidade}: R$ 200,00`)
  await expect(pagamento.getByRole('link', { name: 'Abrir comprovante' })).toBeVisible()
  await pagamento.getByRole('button', { name: 'Confirmar pagamento' }).click()
  await expect(mensagemNaTela(page, `Pagamento de ${nome} confirmado`)).toBeVisible()

  // A situação do associado aparece certa para a tesouraria
  await page.getByRole('tab', { name: 'Situação dos associados' }).click()
  await page.getByLabel('Buscar associado').fill(nome)
  await expect(page.getByRole('listitem', { name: nome })).toContainText('Em dia')

  // O pagamento confirmado entrou sozinho no caixa (PIX → conta bancária)
  await page.getByRole('tab', { name: 'Caixa', exact: true }).click()
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
