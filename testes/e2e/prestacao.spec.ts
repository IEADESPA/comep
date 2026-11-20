// Fase 2.3: prestação de contas — resumo, mês a mês, planilha, orçamento e o balanço anual em quatro passos.
// O exercício 2021/2022 do banco de TESTE é reservado a estes testes: o ciclo do balanço termina sempre
// "reprovado pela assembleia" (devolvido à tesouraria), para poder rodar de novo. O 2025/2026 vem da
// semente fictícia (testes/dados/semente-prestacao-teste.sql), já aprovado.
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { abrirFuncao, funcoesDoModulo, mensagemNaTela, nomeDaFuncao, sufixoUnico, trocarPara, type NomeUsuario } from './ajuda'

const RESERVADO = 2021

function exercicioAtual(): number {
  const hoje = new Date()
  return hoje.getMonth() + 1 >= 4 ? hoje.getFullYear() : hoje.getFullYear() - 1
}

async function abrir(page: Page, quem: NomeUsuario, exercicio: number) {
  await trocarPara(page, quem)
  await page.goto('financeiro')
  await abrirFuncao(page, 'Prestação de contas')
  await page.getByRole('combobox', { name: 'Exercício', exact: true }).selectOption(String(exercicio))
  await expect(page.getByRole('heading', { name: `Balanço do exercício ${exercicio}/${exercicio + 1}` })).toBeVisible()
}

async function situacao(page: Page): Promise<string> {
  return (await page.locator('section[data-situacao]').getAttribute('data-situacao')) ?? ''
}

// Cada passo do balanço, feito por quem tem o perfil certo
async function fechar(page: Page, nota: string) {
  await abrir(page, 'tesouraria', RESERVADO)
  await page.getByLabel('Nota da tesouraria (opcional)').fill(nota)
  await page.getByRole('button', { name: 'Fechar o exercício e enviar à diretoria' }).click()
  await expect(mensagemNaTela(page, `Exercício ${RESERVADO}/${RESERVADO + 1} fechado e enviado à diretoria.`)).toBeVisible()
}

async function analisar(page: Page, texto: string) {
  await abrir(page, 'presidencia', RESERVADO)
  await page.getByLabel('Análise da diretoria *').fill(texto)
  await page.getByRole('button', { name: 'Registrar a análise da diretoria' }).click()
  await expect(mensagemNaTela(page, 'Análise da diretoria registrada.')).toBeVisible()
}

/** Fase 5.5, parte 10: o parecer do ano é dado no módulo Conselho Fiscal, a partir dos 12 meses aprovados. */
async function darParecer(page: Page, texto: string) {
  await trocarPara(page, 'conselho')
  await page.goto(`conselho-fiscal/parecer?exercicio=${RESERVADO}`)
  await expect(page.getByRole('heading', { name: /^Os meses: \d+ de 12 aprovados$/ })).toBeVisible()
  // o exercício reservado não tem movimento: os meses se aprovam de uma vez (só na primeira vez)
  const semMovimento = page.getByRole('button', { name: 'Aprovar os meses sem movimento' })
  if (await semMovimento.isVisible()) {
    await semMovimento.click()
    await expect(mensagemNaTela(page, /sem movimento\.$/)).toBeVisible()
  }
  await page.getByRole('combobox', { name: 'Parecer *' }).selectOption('Favorável com ressalvas')
  await page.getByLabel('Texto do parecer *').fill(texto)
  await page.getByRole('button', { name: 'Assinar o parecer do ano' }).click()
  await expect(mensagemNaTela(page, 'Parecer do Conselho Fiscal registrado.')).toBeVisible()
}

async function reprovarNaAssembleia(page: Page) {
  await abrir(page, 'presidencia', RESERVADO)
  const form = page.getByRole('form', { name: 'Decisão da assembleia' })
  await form.getByRole('combobox', { name: 'Decisão da assembleia *' }).selectOption('Reprovado')
  await form.getByLabel('Ata *').fill('Teste automático')
  await form.getByRole('button', { name: 'Registrar a decisão da assembleia' }).click()
  await expect(mensagemNaTela(page, 'Balanço reprovado: voltou para a tesouraria corrigir.')).toBeVisible()
}

test('a tesouraria vê as etapas, o mês a mês, o balanço para imprimir e o balanço aprovado, e baixa a planilha', async ({ page }) => {
  const atual = exercicioAtual()
  await abrir(page, 'tesouraria', atual)
  await expect(page.getByText(`Prévia: o exercício vai até 31/03/${atual + 1}.`)).toBeVisible()
  await expect(page.getByRole('list', { name: 'As etapas do balanço' }).getByRole('listitem')).toHaveCount(4)

  // as subfunções: Mês a mês e Balanço e parecer (o documento do exercício)
  await abrirFuncao(page, 'Mês a mês', 'Prestação de contas')
  await expect(page.getByRole('table', { name: 'Receitas e despesas mês a mês' }).locator('tbody tr')).toHaveCount(12)
  await abrirFuncao(page, 'Balanço e parecer', 'Prestação de contas')
  await expect(page.getByRole('table', { name: 'Saldos das contas' })).toContainText('Caixa (dinheiro)')
  await expect(page.getByRole('table', { name: 'Contribuições por igreja' })).toBeVisible()
  await abrir(page, 'tesouraria', atual)

  // Exercício anterior, da semente fictícia: balanço aprovado, números congelados
  await page.getByRole('combobox', { name: 'Exercício', exact: true }).selectOption('2025')
  const balanco = page.locator('section[data-situacao]')
  await expect(balanco).toHaveAttribute('data-situacao', 'aprovado')
  await expect(balanco).toContainText('Parecer do Conselho Fiscal: Favorável')
  await expect(balanco).toContainText('Aprovado em 25/04/2026')
  await expect(page.getByText(/^Números congelados quando a tesouraria fechou/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fechar o exercício e enviar à diretoria' })).toHaveCount(0)

  // Planilha dos lançamentos (CSV em português)
  const [arquivo] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar lançamentos (planilha)' }).click(),
  ])
  expect(arquivo.suggestedFilename()).toBe('lancamentos-2025-2026.csv')
  const conteudo = readFileSync((await arquivo.path())!, 'utf8')
  expect(conteudo.startsWith('﻿Data;Conta;Tipo;Categoria;Descrição;Valor (R$);Situação')).toBe(true)
  expect(conteudo).toContain('Oferta da reunião mensal de abril/2025')
})

test('o orçamento por categoria e o plano anual: a tesouraria prepara, manda e volta; o aprovado não muda', async ({ page }, info) => {
  const sufixo = sufixoUnico(info.project.name)
  const nome = `${RESERVADO}/${RESERVADO + 1}`
  const atividade = `Conferência de obreiros E2E ${sufixo}`
  await trocarPara(page, 'tesouraria')
  await page.goto(`financeiro/orcamento?exercicio=${RESERVADO}`)
  await expect(page.getByRole('heading', { name: 'Orçamento por categoria', level: 1 })).toBeVisible()
  // se uma execução anterior parou com o orçamento mandado, ele volta para o rascunho
  const voltar = page.getByRole('button', { name: 'Voltar para o rascunho', exact: true })
  await expect(page.getByRole('heading', { name: /^Receitas · total previsto/ })).toBeVisible()
  if (await voltar.isVisible()) {
    await voltar.click()
    await page.getByRole('button', { name: 'Confirmar — voltar para o rascunho' }).click()
    await expect(mensagemNaTela(page, `O orçamento ${nome} voltou para o rascunho.`)).toBeVisible()
  }

  // o previsto de cada categoria, em cartões
  await page.getByLabel('Previsto para Ofertas').fill('1234,56')
  await page.getByRole('button', { name: 'Salvar o orçamento' }).click()
  await expect(mensagemNaTela(page, `Orçamento ${nome} salvo.`)).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'Ofertas' }).getByLabel('Previsto para Ofertas')).toHaveValue(/^1\.?234,56$/)

  // o plano anual de trabalho: uma atividade com o mês e o custo (e tirada no fim: nada se apaga, fica arquivada)
  await page.goto(`financeiro/orcamento/plano?exercicio=${RESERVADO}`)
  await page.getByLabel('O que é *').fill(atividade)
  await page.getByLabel('Quando').selectOption({ label: `Setembro de ${RESERVADO}` })
  await page.getByLabel('Quanto custa (R$)').fill('300')
  await page.getByRole('button', { name: 'Pôr no plano' }).click()
  await expect(mensagemNaTela(page, `"${atividade}" entrou no plano.`)).toBeVisible()
  const cartao = page.getByRole('listitem', { name: atividade })
  await expect(cartao).toContainText('R$ 300,00')
  await cartao.getByRole('button', { name: 'Tirar do plano' }).click()
  await cartao.getByRole('button', { name: 'Confirmar — tirar do plano' }).click()
  await expect(mensagemNaTela(page, `"${atividade}" saiu do plano.`)).toBeVisible()

  // mandar para a assembleia: o orçamento não muda mais; voltar para o rascunho
  await page.goto(`financeiro/orcamento?exercicio=${RESERVADO}`)
  await page.getByRole('button', { name: 'Mandar para a assembleia' }).click()
  await page.getByRole('button', { name: 'Confirmar e mandar' }).click()
  await expect(mensagemNaTela(page, `Orçamento ${nome} mandado para a assembleia.`)).toBeVisible()
  await expect(page.getByLabel('Previsto para Ofertas')).toHaveCount(0)
  await page.getByRole('button', { name: 'Voltar para o rascunho', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar — voltar para o rascunho' }).click()
  await expect(mensagemNaTela(page, `O orçamento ${nome} voltou para o rascunho.`)).toBeVisible()
  // o que foi salvo continua lá (vem do banco)
  await expect(page.getByLabel('Previsto para Ofertas')).toHaveValue(/^1\.?234,56$/)

  // O orçamento aprovado (2026/2027, da semente) não se edita mais
  await page.goto('financeiro/orcamento?exercicio=2026')
  await expect(page.getByText('Aprovado na assembleia de 25/04/2026')).toBeVisible()
  await expect(page.getByLabel('Previsto para Ofertas')).toHaveCount(0)
})

test('o balanço passa pela tesouraria, pela diretoria, pelo Conselho Fiscal e pela assembleia', async ({ page }, info) => {
  test.setTimeout(180_000)
  const sufixo = sufixoUnico(info.project.name)

  // Se uma execução anterior parou no meio do ciclo, termina o ciclo antes
  await abrir(page, 'tesouraria', RESERVADO)
  for (let i = 0; i < 3; i++) {
    const s = await situacao(page)
    if (s === 'analise_diretoria') await analisar(page, 'Teste automático (retomada)')
    else if (s === 'aguardando_parecer') await darParecer(page, 'Teste automático (retomada)')
    else if (s === 'aguardando_assembleia') await reprovarNaAssembleia(page)
    else break
    await abrir(page, 'tesouraria', RESERVADO)
  }
  expect(['sem_balanco', 'devolvido']).toContain(await situacao(page))

  // 1. A tesouraria fecha o exercício
  await fechar(page, `Teste automático ${sufixo}`)
  await expect(page.locator('section[data-situacao]')).toHaveAttribute('data-situacao', 'analise_diretoria')
  await expect(page.getByRole('button', { name: 'Registrar a análise da diretoria' })).toHaveCount(0)

  // 2. A diretoria (presidência) analisa
  await analisar(page, `Conferido no teste automático ${sufixo}`)
  await expect(page.locator('section[data-situacao]')).toHaveAttribute('data-situacao', 'aguardando_parecer')
  await expect(page.getByRole('button', { name: 'Registrar o parecer' })).toHaveCount(0) // a presidência não dá parecer

  // 3. O Conselho Fiscal dá o parecer
  await darParecer(page, `Parecer do teste automático ${sufixo}`)
  await expect(page.locator('section[data-situacao]')).toHaveAttribute('data-situacao', 'aguardando_assembleia')
  await expect(page.locator('section[data-situacao]')).toContainText('Parecer do Conselho Fiscal: Favorável com ressalvas')

  // 4. A assembleia reprova: volta para a tesouraria, com o motivo e o histórico
  await reprovarNaAssembleia(page)
  const balanco = page.locator('section[data-situacao]')
  await expect(balanco).toHaveAttribute('data-situacao', 'devolvido')
  await expect(balanco).toContainText('O que precisa ser corrigido: Reprovado pela assembleia de')
  await balanco.getByText(/^Histórico do balanço/).click()
  const historico = balanco.getByRole('list', { name: 'Histórico do balanço' })
  await expect(historico.getByRole('listitem').first()).toContainText('Reprovado pela assembleia de')
  await expect(historico).toContainText(`Parecer do teste automático ${sufixo}`)
})

test('o Conselho Fiscal só vê: sem pagamentos a conferir e sem botões de lançar ou gerar', async ({ page }) => {
  await trocarPara(page, 'conselho')
  await page.goto('financeiro')
  // o Financeiro do Conselho Fiscal abre na prestação de contas e não tem os comprovantes a conferir
  await expect(page).toHaveURL(/\/financeiro\/prestacao$/)
  await expect(page.getByRole('heading', { name: 'Prestação de contas', level: 1 })).toBeVisible()
  const funcoes = await funcoesDoModulo(page)
  await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Caixa') })).toBeVisible()
  await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Comprovantes') })).toHaveCount(0)
  await page.goto('financeiro/comprovantes')
  await expect(page).toHaveURL(/\/financeiro\/prestacao$/)

  await abrirFuncao(page, 'Caixa')
  await expect(page.getByRole('list', { name: 'Saldos' })).toBeVisible()
  await expect(page.getByText('Novo lançamento', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Transferência entre contas', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Cancelar lançamento')).toHaveCount(0)

  await abrirFuncao(page, 'Cobranças do ano', 'Contribuições')
  await expect(page.getByRole('heading', { name: 'Cobranças do ano', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gerar cobranças do exercício' })).toHaveCount(0)

  await abrirFuncao(page, 'Situação dos ministros', 'Contribuições')
  await expect(page.getByRole('list', { name: 'Situação dos ministros' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar pagamento recebido' })).toHaveCount(0)
})
