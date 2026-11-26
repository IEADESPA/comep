// A conta fixa de quem preside uma igreja (e2e.presidente.igreja, criada em 22/11/2026 pelos caminhos do próprio
// sistema: a presidência cadastrou a igreja fictícia, com os documentos conferidos, e o ministro; ele criou o login
// com o código de primeiro acesso). A igreja é regular e ele está em dia. O primeiro teste só lê. O do D-10 pede a
// correção do nome da igreja e a presidência fictícia RECUSA, para o nome da igreja fictícia nunca mudar (o pedido
// recusado fica no histórico: nada se apaga).
import { expect, test, type Page } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico, trocarPara } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidenteIgreja') })

const IGREJA = 'Igreja Fictícia do Presidente (teste)'
const NOME = 'Presidente de Igreja de Teste'

test('quem preside uma igreja vê o perfil e abre a Minha igreja, regular, com os ministros', async ({ page }) => {
  await page.goto('painel')
  await expect(page.getByRole('list', { name: 'Seus perfis' })).toContainText('Presidente de igreja')

  await page.goto('minha-igreja/ministros')
  await expect(page.getByRole('heading', { name: IGREJA, level: 2 })).toBeVisible()
  await expect(page.getByText('Regular', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('list', { name: 'Ministros da igreja' })).toContainText(NOME)
  // D-09: "pastor presidente" uma vez só, mesmo com a função "Pastor presidente"
  const linha = page.getByRole('list', { name: 'Ministros da igreja' }).getByRole('listitem').filter({ hasText: NOME })
  expect(((await linha.innerText()).match(/pastor presidente/gi) ?? []).length).toBe(1)

  // os documentos estão em dia (mandados pela presidência, já conferidos)
  await page.goto('minha-igreja/documentos')
  const cartoes = page.getByRole('list', { name: 'Documentos da igreja' })
  await expect(cartoes.getByRole('link', { name: 'Estatuto da igreja' })).toBeVisible()
  await expect(cartoes).not.toContainText('Falta mandar')
})

/** O sino, no alto da tela (no computador e no celular). */
async function abrirSino(page: Page) {
  await page.getByRole('button', { name: /^Avisos/ }).click()
  const painel = page.getByRole('region', { name: 'Avisos', exact: true })
  await expect(painel).toBeVisible()
  return painel
}

/**
 * Se uma rodada anterior parou no meio, um pedido da igreja fictícia pode ter ficado pendente (o banco aceita um só
 * por dado): a presidência fictícia recusa o que sobrou, antes de começar.
 */
async function recusarSobras(page: Page) {
  await trocarPara(page, 'presidencia')
  await page.goto('ministros/correcoes')
  await expect(page.getByRole('heading', { name: /^Correções no cadastro \(\d+\)$/, level: 2 })).toBeVisible()
  const sobras = page.getByRole('listitem', { name: `Correção: ${IGREJA}` })
  for (let n = await sobras.count(); n > 0; n--) {
    await sobras.first().getByRole('button', { name: 'Recusar' }).click()
    const recusa = page.getByRole('form', { name: `Recusar a correção de ${IGREJA}` })
    await recusa.getByLabel(/^Motivo/).fill('Sobra de um teste automático.')
    await recusa.getByRole('button', { name: 'Recusar a correção' }).click()
    await expect(mensagemNaTela(page, `Correção de ${IGREJA}: recusada.`)).toBeVisible()
    await expect(sobras).toHaveCount(n - 1)
  }
}

test('D-10: quem preside pede a correção do nome da igreja, a presidência recusa com o motivo e a resposta chega no sino', async ({
  page,
}, info) => {
  test.setTimeout(150_000)
  const marca = sufixoUnico(info.project.name)
  const nomeNovo = `${IGREJA} ${marca}`
  const motivo = `Teste automático ${marca}: o nome segue o estatuto registrado.`
  await recusarSobras(page)

  // Minha igreja › Dados: o "Pedir correção" ao lado do Nome e do CNPJ (a Denominação, não)
  await trocarPara(page, 'presidenteIgreja')
  await page.goto('minha-igreja')
  await expect(page.getByRole('heading', { name: IGREJA, level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pedir correção do CNPJ da igreja' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Pedir correção/ })).toHaveCount(2)

  // o pedido aberto é mais alto que o campo: o vizinho da mesma linha não estica (a Denominação ao lado do CNPJ,
  // a Sigla ao lado do Nome); vale no computador, onde os campos ficam em duas colunas
  const denominacao = page.getByLabel('Denominação', { exact: true })
  const sigla = page.getByLabel('Sigla (vai na credencial)')
  const altura = async (campo: typeof sigla) => (await campo.boundingBox())?.height ?? 0
  const alturaDenominacao = await altura(denominacao)
  const alturaSigla = await altura(sigla)

  // o CNPJ: a máscara e a conferência dos dígitos na tela (sem mandar)
  await page.getByRole('button', { name: 'Pedir correção do CNPJ da igreja' }).click()
  const pedidoCnpj = page.getByRole('form', { name: 'Pedir correção: CNPJ da igreja' })
  await expect(pedidoCnpj).toBeVisible()
  expect(await altura(denominacao)).toBe(alturaDenominacao)
  await pedidoCnpj.getByLabel(/^Como deve ficar/).fill('11222333000182')
  await expect(pedidoCnpj.getByLabel(/^Como deve ficar/)).toHaveValue('11.222.333/0001-82')
  await expect(pedidoCnpj).toContainText('Confira o CNPJ: os dois últimos números (os dígitos) não batem.')
  await expect(pedidoCnpj.getByRole('button', { name: 'Mandar para a secretaria' })).toBeDisabled()
  await pedidoCnpj.getByRole('button', { name: 'Cancelar' }).click()
  await expect(pedidoCnpj).toHaveCount(0)

  // o nome: "Como está", "Como deve ficar" e "Mandar para a secretaria"; depois, "Esperando a secretaria"
  await page.getByRole('button', { name: 'Pedir correção do nome da igreja' }).click()
  const pedidoNome = page.getByRole('form', { name: 'Pedir correção: Nome da igreja' })
  await expect(pedidoNome.getByLabel('Como está')).toHaveValue(IGREJA)
  expect(await altura(sigla)).toBe(alturaSigla)
  await pedidoNome.getByLabel(/^Como deve ficar/).fill(nomeNovo)
  await pedidoNome.getByRole('button', { name: 'Mandar para a secretaria' }).click()
  await expect(mensagemNaTela(page, 'Pedido de correção enviado à secretaria.')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Nome', exact: true })).toContainText('Esperando a secretaria')
  await expect(page.getByRole('button', { name: 'Pedir correção do nome da igreja' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pedir correção do CNPJ da igreja' })).toBeVisible()

  // a presidência vê o pedido na fila de correções que já usa, com o selo Igreja e o link para a ficha, e recusa
  await trocarPara(page, 'presidencia')
  await page.goto('ministros/correcoes')
  const pedido = page.getByRole('listitem', { name: `Correção: ${IGREJA}` }).filter({ hasText: nomeNovo })
  await expect(pedido).toContainText(`Nome da igreja: ${IGREJA} → ${nomeNovo}`)
  await expect(pedido.getByText('Igreja', { exact: true })).toBeVisible()
  await expect(pedido.getByRole('link', { name: IGREJA })).toHaveAttribute('href', /\/igrejas\/[0-9a-f-]{36}$/)
  await pedido.getByRole('button', { name: 'Recusar' }).click()
  const recusa = page.getByRole('form', { name: `Recusar a correção de ${IGREJA}` })
  await recusa.getByLabel(/^Motivo/).fill(motivo)
  await recusa.getByRole('button', { name: 'Recusar a correção' }).click()
  await expect(mensagemNaTela(page, `Correção de ${IGREJA}: recusada.`)).toBeVisible()

  // quem preside vê a resposta no sino; o nome não mudou e o "Pedir correção" volta
  await trocarPara(page, 'presidenteIgreja')
  await page.goto('minha-igreja')
  await expect(page.getByRole('heading', { name: IGREJA, level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pedir correção do nome da igreja' })).toBeVisible()
  const sino = await abrirSino(page)
  const aviso = sino.getByRole('list', { name: 'Avisos para você' }).getByRole('listitem').filter({ hasText: motivo })
  await expect(aviso).toContainText('Pedido de correção recusado')

  // e, na lista dos pedidos de correção da igreja, a situação e a resposta
  await page.goto('minha-igreja/ministros')
  const historico = page.getByRole('list', { name: 'Pedidos de correção' }).getByRole('listitem').filter({ hasText: nomeNovo })
  await expect(historico).toContainText('Recusado')
  await expect(historico).toContainText(motivo)
})
