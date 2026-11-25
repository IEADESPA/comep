// Correções da homologação (D-07 e D-05, 23/11/2026): o modelo exclusivo da credencial é pago pela igreja à tesouraria,
// que não abre o módulo Credenciais. A presidência FICTÍCIA cria um modelo exclusivo (rascunho, para a igreja fictícia
// A, R$ 1,00); a tesouraria FICTÍCIA recebe o pagamento em Financeiro › Caixa › Modelos exclusivos, vê a entrada no
// extrato com o "De onde veio" levando a essa tela (antes, ao "Sem acesso" de Credenciais) e desfaz o pagamento (a
// entrada é cancelada). No fim, o modelo é arquivado (nada se apaga). O Conselho Fiscal vê o Caixa, mas não essa
// subfunção. O modelo nunca fica em uso: os ministros da igreja A continuam com a credencial de sempre.
import { expect, test, type Page } from '@playwright/test'
import { abrirFuncao, arquivoDaSessao, escolherOpcaoCom, funcoesDoModulo, mensagemNaTela, nomeDaFuncao, sufixoUnico, trocarPara } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

const IGREJA = 'Igreja Fictícia A (teste)'
// não começa com "E2E ": a limpeza do credencial-modelo.spec (que arquiva "E2E …") não mexe neste
const PREFIXO = 'Exclusivo E2E'
const ORIGEM = `Modelo exclusivo da credencial — ${IGREJA}`

/** Como presidência: desfaz o pagamento (se houver) e arquiva o modelo. */
async function desfazerEArquivar(page: Page, nome: string) {
  await page.goto('credenciais/modelos')
  await expect(page.getByRole('article', { name: 'Ministro (padrão)' })).toBeVisible()
  const cartao = page.getByRole('article', { name: nome, exact: true })
  if ((await cartao.count()) === 0) return
  await cartao.getByRole('link', { name: 'Quem recebe' }).click()
  const exclusivo = page.getByRole('group', { name: 'Modelo exclusivo pago pela igreja' })
  await expect(exclusivo).toBeVisible()
  const desfazer = exclusivo.getByRole('form', { name: 'Desfazer o pagamento do modelo exclusivo' })
  if ((await desfazer.count()) > 0) {
    await desfazer.getByLabel('Motivo para desfazer (vai para o caixa) *').fill('Sobra de teste automático')
    await desfazer.getByRole('button', { name: 'Desfazer o pagamento' }).click()
    await expect(mensagemNaTela(page, /^Pagamento desfeito/)).toBeVisible()
  }
  await page.getByRole('button', { name: `Arquivar o modelo ${nome}`, exact: true }).click()
  await page.getByRole('button', { name: `Confirmar — Arquivar o modelo ${nome}`, exact: true }).click()
  await expect(page).toHaveURL(/\/credenciais\/modelos$/)
  await expect(page.getByRole('article', { name: nome, exact: true })).toHaveCount(0)
}

/** As sobras de uma rodada cortada no meio (antes do `finally`). Os testes rodam um de cada vez (workers: 1). */
async function arquivarSobrasDeRodadasAnteriores(page: Page) {
  await trocarPara(page, 'presidencia')
  await page.goto('credenciais/modelos')
  await expect(page.getByRole('article', { name: 'Ministro (padrão)' })).toBeVisible()
  const sobras = await page
    .getByRole('article', { name: new RegExp(`^${PREFIXO} `) })
    .evaluateAll((cartoes) => cartoes.map((c) => c.getAttribute('aria-label') ?? '').filter((n) => n !== ''))
  for (const sobra of sobras) await desfazerEArquivar(page, sobra)
}

test('a tesouraria recebe e desfaz o pagamento do modelo exclusivo no Caixa; o "De onde veio" leva até lá (D-07, D-05)', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  await arquivarSobrasDeRodadasAnteriores(page)
  const nome = `${PREFIXO} ${sufixoUnico(info.project.name)}`

  try {
    // 1. A presidência cria o modelo exclusivo da igreja A (rascunho, esperando o pagamento)
    await page.goto('credenciais/modelos')
    await page.getByRole('button', { name: 'Novo modelo' }).click()
    const novo = page.getByRole('form', { name: 'Novo modelo' })
    await novo.getByLabel('Nome do modelo *').fill(nome)
    await novo.getByRole('radio', { name: 'Exclusivo de uma igreja (pago à parte)' }).check()
    await escolherOpcaoCom(novo.getByLabel('Igreja *'), IGREJA)
    await novo.getByLabel('Valor (R$) *').fill('1,00')
    await novo.getByRole('button', { name: 'Criar e abrir o editor' }).click()
    await expect(page).toHaveURL(/\/credenciais\/modelos\/[0-9a-f-]{36}\/editar$/)

    // 2. A tesouraria acha o modelo em Financeiro › Caixa › Modelos exclusivos e recebe o pagamento
    await trocarPara(page, 'tesouraria')
    await page.goto('financeiro/caixa')
    await abrirFuncao(page, 'Modelos exclusivos', 'Caixa')
    await expect(page).toHaveURL(/\/financeiro\/caixa\/modelos$/)
    await expect(page.getByRole('heading', { name: 'Modelos exclusivos', level: 1 })).toBeVisible()
    const esperando = page.getByRole('list', { name: 'Modelos esperando o pagamento' }).getByRole('listitem', { name: nome, exact: true })
    await expect(esperando).toContainText(IGREJA)
    await expect(esperando).toContainText('falta o pagamento')
    const receber = esperando.getByRole('form', { name: `Receber o pagamento de ${nome}` })
    await receber.getByLabel('Forma').selectOption('PIX')
    await receber.getByRole('button', { name: /^Receber o pagamento/ }).click()
    await expect(mensagemNaTela(page, `Pagamento de ${nome} recebido`)).toBeVisible()
    const pago = page.getByRole('list', { name: 'Modelos pagos' }).getByRole('listitem', { name: nome, exact: true })
    await expect(pago).toContainText(/pago em \d{2}\/\d{2}\/\d{4}/)

    // 3. No extrato, a entrada mostra de onde veio, e o link leva a tesouraria aos modelos exclusivos (não ao "Sem acesso")
    await abrirFuncao(page, 'Lançamentos', 'Caixa')
    const origem = page.getByRole('link', { name: ORIGEM, exact: true }).first()
    await expect(origem).toHaveAttribute('href', /\/financeiro\/caixa\/modelos$/)
    await origem.click()
    await expect(page).toHaveURL(/\/financeiro\/caixa\/modelos$/)
    await expect(page.getByRole('heading', { name: 'Sem acesso' })).toHaveCount(0)

    // 4. A tesouraria desfaz o pagamento (a entrada do caixa é cancelada) e o modelo volta a esperar
    const pagoDeNovo = page.getByRole('list', { name: 'Modelos pagos' }).getByRole('listitem', { name: nome, exact: true })
    await pagoDeNovo.locator('summary', { hasText: 'Desfazer o pagamento' }).click()
    const desfazer = pagoDeNovo.getByRole('form', { name: `Desfazer o pagamento de ${nome}` })
    await desfazer.getByLabel('Motivo para desfazer (vai para o caixa) *').fill('Teste automático: desfazer o pagamento')
    await desfazer.getByRole('button', { name: 'Desfazer o pagamento' }).click()
    await expect(mensagemNaTela(page, `Pagamento de ${nome} desfeito`)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Modelos esperando o pagamento' }).getByRole('listitem', { name: nome, exact: true })).toBeVisible()

    // 5. O Conselho Fiscal vê o Caixa (só leitura), mas não a subfunção; pelo endereço, volta à prestação de contas
    await trocarPara(page, 'conselho')
    await page.goto('financeiro/caixa')
    const menu = await funcoesDoModulo(page)
    await expect(menu.getByRole('link', { name: nomeDaFuncao('Contas e saldos') })).toBeVisible()
    await expect(menu.getByRole('link', { name: nomeDaFuncao('Modelos exclusivos') })).toHaveCount(0)
    await page.goto('financeiro/caixa/modelos')
    await expect(page).toHaveURL(/\/financeiro\/prestacao$/)
  } finally {
    await trocarPara(page, 'presidencia')
    await desfazerEArquivar(page, nome)
  }
})
