// Fase 5.5, parte 10: o Conselho Fiscal aprova as contas mês a mês (rodadas 13 e 14).
// O Conselho aprova um mês, pede esclarecimento noutro, a tesouraria responde (com o comprovante) e o Conselho aprova.
// Usa os dois meses antes do atual (dentro do exercício de hoje). Os lançamentos do teste são de R$ 1,00 e são
// cancelados no fim: o mês muda de novo, e a próxima execução aprova outra vez (a aprovação antiga fica arquivada).
import { expect, test, type Page } from '@playwright/test'
import { abrirFuncao, funcoesDoModulo, mensagemNaTela, nomeDaFuncao, sufixoUnico, trocarPara } from './ajuda'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

type Mes = { iso: string; nome: string; dia: string }

/** Os dois meses antes do atual, se ainda estão no exercício de hoje (abril a março); em abril e maio, não há dois. */
function mesesDoTeste(): [Mes, Mes] | null {
  const hoje = new Date()
  const exercicio = (d: Date) => (d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1)
  const mes = (n: number): Mes & { exercicio: number } => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { iso, nome: MESES[d.getMonth()], dia: `${iso}-05`, exercicio: exercicio(d) }
  }
  const a = mes(1)
  const b = mes(2)
  return a.exercicio === exercicio(hoje) && b.exercicio === exercicio(hoje) ? [a, b] : null
}

/** A tesouraria lança uma entrada de R$ 1,00 com a data pedida (o extrato vai para o mês dela). */
async function lancarEntrada(page: Page, descricao: string, dia: string) {
  await page.goto('financeiro/caixa')
  await page.getByRole('button', { name: '+ Lançar entrada', exact: true }).click()
  await page.getByRole('combobox', { name: 'Categoria', exact: true }).selectOption('Ofertas')
  await page.getByLabel('Data', { exact: true }).fill(dia)
  await page.getByLabel('Valor (R$)').first().fill('1,00')
  await page.getByLabel('Descrição *').fill(descricao)
  await page.getByRole('button', { name: 'Salvar a entrada', exact: true }).click()
  await expect(mensagemNaTela(page, 'Entrada lançada.')).toBeVisible()
  await expect(page.getByRole('listitem', { name: descricao })).toBeVisible()
}

async function cancelarNoExtrato(page: Page, descricao: string, mes: string) {
  await page.goto(`financeiro/caixa?mes=${mes}`)
  const linha = page.getByRole('listitem', { name: descricao }).first()
  await linha.getByText('Cancelar lançamento').click()
  await linha.getByLabel('Motivo *').fill('Teste automático')
  await linha.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(mensagemNaTela(page, 'Lançamento cancelado.')).toBeVisible()
}

/** Se uma execução anterior parou com pergunta sem resposta, a tesouraria responde antes. */
async function responderPendentes(page: Page) {
  await page.goto('conselho-fiscal/esclarecimentos')
  const lista = page.getByRole('list', { name: 'Perguntas esperando resposta' })
  await expect(page.getByRole('heading', { name: /^Esperando a tesouraria \(\d+\)$/ })).toBeVisible()
  for (let i = 0; i < 5 && (await lista.count()) > 0 && (await lista.getByRole('listitem').count()) > 0; i++) {
    const item = lista.getByRole('listitem').first()
    await item.getByLabel('Resposta *').fill('Teste automático (retomada)')
    await item.getByRole('button', { name: 'Mandar a resposta' }).click()
    await expect(mensagemNaTela(page, 'Resposta mandada ao Conselho Fiscal.')).toBeVisible()
  }
}

test('o Conselho aprova um mês, pede esclarecimento noutro, a tesouraria responde e o Conselho aprova', async ({ page }, info) => {
  const meses = mesesDoTeste()
  test.skip(meses === null, 'Em abril e maio o exercício ainda não tem dois meses terminados.')
  const [a, b] = meses!
  test.setTimeout(180_000)
  const sufixo = sufixoUnico(info.project.name)
  const entradaA = `CF E2E A ${sufixo}`
  const entradaB = `CF E2E B ${sufixo}`

  // 0. A tesouraria lança uma entrada em cada mês (e responde o que tiver ficado de uma execução anterior)
  await trocarPara(page, 'tesouraria')
  await responderPendentes(page)
  await lancarEntrada(page, entradaA, a.dia)
  await lancarEntrada(page, entradaB, b.dia)

  // 1. O Conselho Fiscal abre o painel do exercício e o mês A, e aprova
  await trocarPara(page, 'conselho')
  await page.goto('conselho-fiscal')
  await expect(page.getByRole('heading', { name: /^O exercício de \d{4}\/\d{4}$/, level: 1 })).toBeVisible()
  const funcoes = await funcoesDoModulo(page)
  for (const f of ['Contas dos meses', 'Esclarecimentos', 'Parecer do ano', 'Documentos']) {
    await expect(funcoes.getByRole('link', { name: nomeDaFuncao(f) })).toHaveCount(1)
  }
  await page.getByRole('list', { name: 'Os meses do exercício' }).getByRole('link', { name: new RegExp(`^${a.nome.charAt(0).toUpperCase()}${a.nome.slice(1)} de`) }).click()
  await expect(page).toHaveURL(new RegExp(`/conselho-fiscal/meses/${a.iso}$`))
  await expect(page.getByRole('list', { name: 'Lançamentos do mês' }).getByRole('listitem', { name: entradaA })).toBeVisible()
  await page.getByRole('button', { name: `Dar o parecer de ${a.nome}` }).click()
  await page.getByRole('button', { name: 'Assinar o parecer' }).click()
  await expect(mensagemNaTela(page, `As contas de ${a.nome} de ${a.iso.slice(0, 4)} foram aprovadas.`)).toBeVisible()
  await expect(page.getByRole('heading', { name: `Parecer de ${a.nome}` })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Assinaturas' })).toContainText('Conselho Fiscal de Teste')

  // 2. No mês B, pergunta à tesouraria sobre o lançamento (o mês espera a resposta)
  await page.goto(`conselho-fiscal/meses/${b.iso}`)
  const linhaB = page.getByRole('list', { name: 'Lançamentos do mês' }).getByRole('listitem', { name: entradaB })
  await linhaB.getByRole('button', { name: new RegExp(`^${entradaB}`) }).click()
  await page.getByLabel('Perguntar à tesouraria').fill(`De onde veio esta oferta? (${sufixo})`)
  await page.getByRole('button', { name: 'Mandar a pergunta' }).click()
  await expect(mensagemNaTela(page, 'Pergunta mandada à tesouraria.')).toBeVisible()
  await expect(page.getByText(`O parecer de ${b.nome} fica para depois da resposta da tesouraria.`)).toBeVisible()
  await expect(linhaB.getByTitle('Pergunta esperando a tesouraria')).toBeVisible()

  // 3. A tesouraria responde (o envio do comprovante junto é conferido nos testes do banco: aqui não, para não
  //    acumular arquivos do usuário fictício a cada execução)
  await trocarPara(page, 'tesouraria')
  await page.goto('conselho-fiscal')
  await abrirFuncao(page, 'Esclarecimentos')
  const pergunta = page.getByRole('listitem', { name: new RegExp(`^Pergunta sobre ${entradaB}`) })
  await expect(pergunta).toContainText(`De onde veio esta oferta? (${sufixo})`)
  await pergunta.getByLabel('Resposta *').fill('Oferta da reunião mensal, com o recibo.')
  await expect(pergunta.getByLabel('Comprovante (opcional)')).toBeVisible()
  await pergunta.getByRole('button', { name: 'Mandar a resposta' }).click()
  await expect(mensagemNaTela(page, 'Resposta mandada ao Conselho Fiscal.')).toBeVisible()

  // 4. O Conselho vê a resposta e aprova o mês B
  await trocarPara(page, 'conselho')
  await page.goto(`conselho-fiscal/meses/${b.iso}`)
  await expect(page.getByRole('list', { name: 'Perguntas do mês' })).toContainText('Oferta da reunião mensal, com o recibo.')
  await expect(page.getByRole('list', { name: 'Lançamentos do mês' }).getByRole('listitem', { name: entradaB })).toContainText('respondido')
  await page.getByRole('button', { name: `Dar o parecer de ${b.nome}` }).click()
  await page.getByRole('button', { name: 'Assinar o parecer' }).click()
  await expect(mensagemNaTela(page, `As contas de ${b.nome} de ${b.iso.slice(0, 4)} foram aprovadas.`)).toBeVisible()

  // 5. No Financeiro, o mês a mês mostra o parecer do Conselho
  await trocarPara(page, 'tesouraria')
  await page.goto('financeiro/prestacao/mes-a-mes')
  const tabela = page.getByRole('table', { name: 'Receitas e despesas mês a mês' })
  await expect(tabela.getByRole('row', { name: new RegExp(`^${a.nome}/${a.iso.slice(0, 4)}`) })).toContainText('Aprovado')

  // 6. Desfaz: cancela as duas entradas (os meses mudam e voltam para a análise na próxima vez)
  await cancelarNoExtrato(page, entradaA, a.iso)
  await cancelarNoExtrato(page, entradaB, b.iso)
  await page.goto(`conselho-fiscal/meses/${a.iso}`)
  await expect(page.getByText('Os números do mês mudaram depois da aprovação: confira de novo.')).toBeVisible()
})

test('o ministro não abre o Conselho Fiscal; o Conselho vê o parecer do ano e os documentos', async ({ page }) => {
  await trocarPara(page, 'ministro')
  await page.goto('conselho-fiscal')
  await expect(page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible()

  await trocarPara(page, 'conselho')
  await page.goto('conselho-fiscal/parecer?exercicio=2025')
  // o exercício da semente fictícia: o parecer favorável já dado
  await expect(page.locator('section[data-situacao]')).toHaveAttribute('data-situacao', 'aprovado')
  await expect(page.locator('section[data-situacao]')).toContainText('Parecer do Conselho Fiscal: Favorável')
  await abrirFuncao(page, 'Documentos')
  await expect(page.getByRole('table', { name: 'Os pareceres dos meses' }).locator('tbody tr')).toHaveCount(12)
  await expect(page.getByRole('button', { name: 'Imprimir ou salvar em PDF' })).toBeVisible()
})
