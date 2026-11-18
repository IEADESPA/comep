// Fase 5.5.1: patrimônio e empréstimo às igrejas. A presidência FICTÍCIA (que também cuida do patrimônio) usa um bem
// fictício fixo ("Cadeira de teste (E2E)", criado na primeira rodada), pede 2 em nome de uma igreja fictícia, aprova,
// registra a retirada e a devolução (tudo volta, então a quantidade não muda). As regras finas (agenda, antecedência,
// termo, baixa do que falta) estão nos testes do banco: testes/banco/patrimonio.test.ts.
import { expect, test } from '@playwright/test'
import { abrirFuncao, abrirModulos, arquivoDaSessao, funcoesDoModulo, mensagemNaTela, nomeDaFuncao } from './ajuda'

const ITEM = 'Cadeira de teste (E2E)'

const diaDaqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })

test.describe('presidência', () => {
  test.use({ storageState: arquivoDaSessao('presidencia') })

  test('o bem, o pedido em nome da igreja com o termo, a aprovação, a retirada e a devolução', async ({ page }, info) => {
    test.setTimeout(120_000)
    await page.goto('patrimonio')
    // o módulo abre nos pedidos (a primeira função)
    await expect(page.getByRole('heading', { name: 'Pedidos', level: 1 })).toBeVisible()

    // o bem fictício (só na primeira rodada); acrescentar 1 e dar baixa de 1 deixa a quantidade igual
    await abrirFuncao(page, 'Bens')
    const bens = page.getByRole('list', { name: 'Bens' }).or(page.getByText('Nenhum bem cadastrado.'))
    await expect(bens.first()).toBeVisible()
    if ((await page.getByRole('listitem', { name: ITEM }).count()) === 0) {
      await page.getByText('Cadastrar um bem').click()
      const form = page.getByRole('form', { name: 'Bem' })
      await form.getByLabel(/^Nome \*/).fill(ITEM)
      await form.getByLabel('Categoria').fill('Mobiliário')
      await form.getByLabel(/^Quantidade \*/).fill('10')
      await form.getByLabel('Como foi adquirido').selectOption({ label: 'Doação' })
      await form.getByRole('button', { name: 'Cadastrar' }).click()
      await expect(mensagemNaTela(page, 'Bem cadastrado.')).toBeVisible()
    }
    const linha = page.getByRole('listitem', { name: ITEM })
    await expect(linha).toContainText('10 un.')
    await linha.getByRole('button', { name: 'Acrescentar' }).click()
    await linha.getByLabel('Quantos *').fill('1')
    await linha.getByLabel('De onde vieram *').fill('Doação fictícia (teste)')
    await linha.getByRole('button', { name: 'Acrescentar' }).last().click()
    await expect(mensagemNaTela(page, `1 unidade(s) acrescentada(s) em ${ITEM}.`)).toBeVisible()
    await expect(linha).toContainText('11 un.')
    await linha.getByRole('button', { name: 'Dar baixa' }).click()
    await linha.getByLabel('Quantos *').fill('1')
    await linha.getByLabel('Motivo da baixa *').fill('Teste automático')
    await linha.getByRole('button', { name: 'Dar baixa' }).last().click()
    await expect(mensagemNaTela(page, `Baixa de 1 unidade(s) em ${ITEM}.`)).toBeVisible()
    await expect(linha).toContainText('10 un.')

    // o pedido em nome de uma igreja fictícia (a equipe não precisa da antecedência)
    const dia = diaDaqui(info.project.name === 'celular' ? 41 : 40)
    await abrirFuncao(page, 'Pedir emprestado')
    const pedido = page.getByRole('form', { name: 'Pedir emprestado' })
    await pedido.getByLabel(/^Para \*/).selectOption({ index: 1 })
    await pedido.getByLabel(/^Retirada \*/).fill(dia)
    await pedido.getByLabel(/^Devolução \*/).fill(dia)
    await pedido.getByLabel(/^Para que é \*/).fill('Culto fictício (teste automático)')
    await pedido.getByLabel(`Quantos: ${ITEM}`).fill('2')
    await pedido.getByRole('checkbox', { name: 'Li e aceito o termo de compromisso em nome da igreja' }).check()
    await pedido.getByRole('button', { name: 'Enviar o pedido' }).click()
    await expect(mensagemNaTela(page, 'Pedido enviado. A secretaria vai conferir a agenda e responder.')).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Empréstimo à / })).toBeVisible()
    const endereco = page.url()

    try {
      await expect(page.getByText('Esperando a aprovação')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Termo de compromisso' })).toBeVisible()
      await expect(page.getByRole('table', { name: 'Itens emprestados' })).toContainText(ITEM)
      await page.getByRole('button', { name: 'Aprovar' }).click()
      await expect(mensagemNaTela(page, 'Empréstimo aprovado: já conta na agenda.')).toBeVisible()

      // a agenda mostra a reserva
      await page.goto('patrimonio')
      await abrirFuncao(page, 'Agenda')
      await expect(page.getByRole('list', { name: 'Reservas' })).toContainText(ITEM)

      await page.goto(endereco)
      await page.getByRole('form', { name: 'Registrar a retirada' }).getByLabel('Quem retirou *').fill('Diácono Fictício')
      await page.getByRole('button', { name: 'Registrar a retirada' }).click()
      await expect(mensagemNaTela(page, 'Retirada registrada.')).toBeVisible()
      await page.getByRole('button', { name: 'Registrar a devolução' }).click()
      await expect(mensagemNaTela(page, 'Devolução registrada: tudo voltou.')).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Voltaram' })).toBeVisible()
    } finally {
      // se algo falhou no meio, não deixa o pedido segurando as cadeiras na agenda do banco de teste
      await page.goto(endereco)
      await expect(page.getByRole('heading', { name: /^Empréstimo à / })).toBeVisible()
      if (await page.getByRole('button', { name: 'Registrar a devolução' }).count()) {
        await page.getByRole('button', { name: 'Registrar a devolução' }).click()
        await expect(mensagemNaTela(page, /Devolução registrada/)).toBeVisible()
      } else if (await page.getByText('Cancelar o pedido').count()) {
        await page.getByText('Cancelar o pedido').first().click()
        await page.getByRole('button', { name: 'Cancelar o pedido' }).click()
        await page.getByRole('button', { name: 'Confirmar — cancelar o pedido' }).click()
        await expect(mensagemNaTela(page, 'Pedido cancelado: os itens voltaram a ficar livres.')).toBeVisible()
      }
    }
  })
})

test.describe('Conselho Fiscal', () => {
  test.use({ storageState: arquivoDaSessao('conselho') })

  test('acompanha o patrimônio, mas não pede emprestado', async ({ page }) => {
    const modulos = await abrirModulos(page)
    await modulos.getByRole('link', { name: 'Patrimônio', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Pedidos', level: 1 })).toBeVisible()
    const funcoes = await funcoesDoModulo(page)
    await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Agenda') })).toBeVisible()
    await expect(funcoes.getByRole('link', { name: nomeDaFuncao('Pedir emprestado') })).toHaveCount(0)
    await abrirFuncao(page, 'Bens')
    await expect(page.getByRole('listitem', { name: ITEM })).toBeVisible()
    await expect(page.getByText('Cadastrar um bem')).toHaveCount(0)
  })
})

test.describe('ministro', () => {
  test.use({ storageState: arquivoDaSessao('ministro') })

  test('não vê o patrimônio (é do pastor presidente e da equipe)', async ({ page }) => {
    const modulos = await abrirModulos(page)
    await expect(modulos.getByRole('link', { name: 'Assembleias', exact: true })).toBeVisible()
    await expect(modulos.getByRole('link', { name: 'Patrimônio', exact: true })).toHaveCount(0)
    await page.goto('patrimonio')
    await expect(page.getByRole('heading', { name: 'Sem acesso' })).toBeVisible()
  })
})
