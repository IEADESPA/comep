// Telas novas, parte 12 (Fase 5.5): a blindagem do Financeiro. Um evento com uma inscrição paga e uma despesa lançada
// no próprio evento: as duas chegam sozinhas ao caixa, com a origem (o extrato mostra de onde veio e filtra por
// origem), entram no saldo e aparecem no mês do Conselho Fiscal. No fim, a inscrição é estornada (o lançamento é
// cancelado) e a despesa é cancelada no Caixa, e o saldo volta.
// O evento FICTÍCIO, com o orçamento já aprovado, vem de testes/dados/semente-blindagem-teste.sql.
import { expect, test, type Page } from '@playwright/test'
import { abrirFuncao, arquivoDaSessao, mensagemNaTela, sufixoUnico, trocarPara } from './ajuda'

const EVENTO = 'Evento fictício da blindagem do caixa (E2E)'

test.use({ storageState: arquivoDaSessao('presidencia') })

async function abrirEvento(page: Page) {
  await page.goto('eventos')
  await page.getByRole('link', { name: EVENTO }).first().click()
  await expect(page.getByRole('heading', { name: EVENTO, level: 1 })).toBeVisible()
}

/**
 * Desfaz as sobras de uma rodada cortada no meio (antes do `finally`): a inscrição "Visitante blindagem …" paga é
 * estornada, a que ainda espera o pagamento é cancelada, e a "Despesa do evento E2E …" que ficou no caixa é cancelada.
 * Os testes rodam um de cada vez (workers: 1), então nenhum outro teste está usando essas linhas.
 */
async function desfazerSobrasDeRodadasAnteriores(page: Page) {
  await trocarPara(page, 'tesouraria')
  await abrirEvento(page)
  // espera as inscrições carregarem (contar antes disso daria zero)
  await expect(page.getByRole('list', { name: 'Inscrições' }).or(page.getByText('Ninguém inscrito ainda.')).first()).toBeVisible()
  const sobras = await page
    .getByRole('list', { name: 'Inscrições' })
    .getByRole('listitem')
    .filter({ hasText: 'Visitante blindagem' })
    .evaluateAll((itens) => itens.map((i) => i.getAttribute('aria-label') ?? '').filter((n) => n !== ''))
  for (const nome of sobras) {
    const item = page.getByRole('listitem', { name: nome, exact: true })
    const numero = nome.match(/^Inscrição (\d+):/)?.[1] ?? ''
    const estornar = item.locator('summary', { hasText: 'Estornar o pagamento e cancelar' })
    if (await estornar.count()) {
      await estornar.click()
      await item.getByLabel('Motivo (vai para o caixa) *').fill('Sobra de teste automático')
      await item.getByRole('button', { name: 'Estornar e cancelar' }).click()
      await expect(mensagemNaTela(page, `Inscrição nº ${numero} cancelada e o pagamento estornado no caixa.`)).toBeVisible()
    } else if (await item.getByRole('button', { name: 'Cancelar a inscrição' }).count()) {
      await item.getByRole('button', { name: 'Cancelar a inscrição' }).click()
      await item.getByRole('button', { name: 'Confirmar — cancelar (a vaga fica livre)' }).click()
      await expect(mensagemNaTela(page, `Inscrição nº ${numero} cancelada.`)).toBeVisible()
    }
  }

  await page.goto('financeiro/caixa')
  await expect(page.getByLabel('De onde veio')).toBeVisible()
  await expect(page.getByRole('region', { name: /^Lançamentos de / })).toBeVisible()
  const despesas = await page
    .getByRole('listitem', { name: /^Despesa do evento E2E / })
    .filter({ has: page.locator('summary', { hasText: 'Cancelar lançamento' }) })
    .evaluateAll((itens) => itens.map((i) => i.getAttribute('aria-label') ?? '').filter((n) => n !== ''))
  for (const nome of despesas) {
    const linha = page.getByRole('listitem', { name: nome, exact: true }).first()
    await linha.locator('summary', { hasText: 'Cancelar lançamento' }).click()
    await linha.getByLabel('Motivo *').fill('Sobra de teste automático')
    await linha.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(mensagemNaTela(page, /^Lançamento cancelado\./)).toBeVisible()
    await expect(linha.locator('summary', { hasText: 'Cancelar lançamento' })).toHaveCount(0)
  }
}

function mesAtual(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Belem' }).slice(0, 7)
}

test('a inscrição paga e a despesa do evento chegam sozinhas ao caixa, com a origem, e ao mês do Conselho Fiscal', async ({ page, browser }, info) => {
  test.setTimeout(300_000)
  await desfazerSobrasDeRodadasAnteriores(page)
  const marca = sufixoUnico(info.project.name)
  const visitante = `Visitante blindagem ${marca}`
  const despesa = `Despesa do evento E2E ${marca}`
  const telefone = `94 9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  let numero = ''
  let lancouDespesa = false

  // 1. O visitante, sem login, se inscreve pelo site (a taxa é de R$ 1,00)
  const contexto = await browser.newContext()
  const v = await contexto.newPage()
  await v.goto('agenda')
  await v.getByRole('link', { name: EVENTO }).first().click()
  const form = v.getByRole('form', { name: 'Inscrição no evento' })
  await form.getByLabel(/^Nome completo/).fill(visitante)
  await form.getByLabel(/^Telefone/).fill(telefone)
  await form.getByRole('checkbox', { name: /Aceito que o COMEP use/ }).check()
  await form.getByRole('button', { name: 'Inscrever-me' }).click()
  await expect(v.getByRole('heading', { name: 'Inscrição feita!' })).toBeVisible()
  await contexto.close()

  try {
    // 2. A tesouraria registra o pagamento: a entrada nasce no caixa, ligada à inscrição e ao evento
    await trocarPara(page, 'tesouraria')
    await abrirEvento(page)
    const inscricao = page.getByRole('list', { name: 'Inscrições' }).getByRole('listitem').filter({ hasText: visitante })
    numero = ((await inscricao.getAttribute('aria-label')) ?? '').match(/^Inscrição (\d+):/)?.[1] ?? ''
    expect(numero).not.toBe('')
    await inscricao.getByRole('button', { name: 'Registrar o pagamento' }).click()
    await expect(mensagemNaTela(page, `Pagamento da inscrição nº ${numero} registrado.`)).toBeVisible()

    // 3. A tesouraria lança a despesa no próprio evento (o orçamento está aprovado): vai para o presidente
    await page.locator('summary', { hasText: 'Lançar uma despesa ou uma receita do evento' }).click()
    const lancar = page.getByRole('form', { name: 'Lançar no evento' })
    await lancar.getByLabel('Categoria *').selectOption({ label: 'Material e expediente' })
    await lancar.getByLabel('Conta *').selectOption({ label: 'Caixa (dinheiro)' })
    await lancar.getByLabel('Valor (R$) *').fill('1,00')
    await lancar.getByLabel('Descrição *').fill(despesa)
    await lancar.getByRole('button', { name: 'Lançar a despesa' }).click()
    await expect(mensagemNaTela(page, /^Despesa lançada no evento/)).toBeVisible()
    lancouDespesa = true

    // 4. A presidência autoriza a despesa, como as outras
    await trocarPara(page, 'presidencia')
    await page.goto('financeiro')
    await abrirFuncao(page, 'Despesas a autorizar')
    await page.getByRole('listitem', { name: `Despesa: ${despesa}` }).getByRole('button', { name: 'Autorizar', exact: true }).click()
    await expect(mensagemNaTela(page, `Despesa autorizada: ${despesa}.`)).toBeVisible()

    // 5. O extrato: as duas linhas, com a origem e o link, no saldo; o filtro por origem
    await page.goto('financeiro/caixa')
    const linhaDespesa = page.getByRole('listitem', { name: despesa })
    await expect(linhaDespesa).toContainText(`De onde veio: Evento: ${EVENTO}`)
    await expect(linhaDespesa.getByRole('link', { name: `Evento: ${EVENTO}` })).toHaveAttribute('href', /\/eventos\/[0-9a-f-]{36}$/)
    await expect(linhaDespesa).not.toContainText('Aguardando autorização')
    await expect(linhaDespesa.locator('.fin-saldo-depois')).not.toHaveText('')
    const linhaInscricao = page.getByRole('listitem', { name: `Inscrição nº ${numero} — ${EVENTO} (PIX)` })
    await expect(linhaInscricao).toContainText(`De onde veio: Inscrição nº ${numero} — ${EVENTO}`)
    await expect(linhaInscricao.locator('.fin-saldo-depois')).not.toHaveText('')
    await page.getByLabel('De onde veio').selectOption('inscricao_evento')
    await expect(linhaInscricao).toBeVisible()
    await expect(linhaDespesa).toHaveCount(0)
    await page.getByLabel('De onde veio').selectOption('')

    // 6. O mês do Conselho Fiscal mostra os dois lançamentos
    await trocarPara(page, 'conselho')
    await page.goto(`conselho-fiscal/meses/${mesAtual()}`)
    const doMes = page.getByRole('list', { name: 'Lançamentos do mês' })
    await expect(doMes.getByRole('listitem', { name: despesa })).toBeVisible()
    await expect(doMes.getByRole('listitem', { name: `Inscrição nº ${numero} — ${EVENTO} (PIX)` })).toBeVisible()
  } finally {
    // 7. Limpeza: a inscrição é estornada (o lançamento é cancelado) e a despesa é cancelada no Caixa
    await trocarPara(page, 'tesouraria')
    if (numero) {
      await abrirEvento(page)
      const inscricao = page.getByRole('list', { name: 'Inscrições' }).getByRole('listitem').filter({ hasText: visitante })
      // espera a inscrição aparecer antes de contar (contar antes de carregar daria zero e deixaria o pagamento no caixa)
      await expect(inscricao).toBeVisible()
      const estornar = inscricao.locator('summary', { hasText: 'Estornar o pagamento e cancelar' })
      if (await estornar.count()) {
        await estornar.click()
        await inscricao.getByLabel('Motivo (vai para o caixa) *').fill('Teste automático')
        await inscricao.getByRole('button', { name: 'Estornar e cancelar' }).click()
        await expect(mensagemNaTela(page, `Inscrição nº ${numero} cancelada e o pagamento estornado no caixa.`)).toBeVisible()
      }
    }
    if (lancouDespesa) {
      await page.goto('financeiro/caixa')
      const linha = page.getByRole('listitem', { name: despesa }).first()
      await linha.getByText('Cancelar lançamento').click()
      await linha.getByLabel('Motivo *').fill('Teste automático')
      await linha.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await expect(mensagemNaTela(page, 'Lançamento cancelado.')).toBeVisible()
    }
  }
})
