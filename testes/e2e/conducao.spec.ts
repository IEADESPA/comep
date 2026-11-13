// Fase 4.3: condução da assembleia — instalar (quórum), registrar votação e escrever/assinar a ata.
// Para ter uma assembleia "acontecendo agora", o teste zera por alguns minutos a antecedência e a 2ª chamada
// nas Regras (Configurações) e devolve os valores no fim. AGE FICTÍCIA, cancelada e arquivada no fim.
// O desligamento (sem volta) é testado só no banco (testes/banco/conducao.test.ts).
import { expect, test, type Page } from '@playwright/test'
import { arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

test.use({ storageState: arquivoDaSessao('presidencia') })

async function regras(page: Page, antecedencia: string, minutos: string) {
  await page.goto('configuracoes#assembleias')
  const form = page.getByRole('form', { name: 'Regras das assembleias' })
  await form.getByLabel(/^Antecedência mínima/).fill(antecedencia)
  await form.getByLabel(/^Minutos até a 2ª chamada/).fill(minutos)
  await form.getByRole('button', { name: 'Salvar as regras' }).click()
  await expect(mensagemNaTela(page, 'Regras das assembleias salvas.')).toBeVisible()
}

function campoDaquiMinutos(minutos: number): string {
  const d = new Date(Date.now() + minutos * 60_000)
  const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${dia}T${hora}`
}

test('assembleia: instalar em 2ª chamada, registrar a votação e escrever a ata', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'espera a assembleia começar (2 minutos): roda só no computador')
  test.setTimeout(300_000)
  const titulo = `AGE condução E2E ${sufixoUnico(info.project.name)}`
  let endereco = ''
  await regras(page, '0', '0')
  try {
    // AGE que começa daqui a 2 minutos
    await page.goto('assembleias/novo')
    await page.getByLabel('Tipo *').selectOption({ label: 'Assembleia Geral Extraordinária' })
    await page.getByLabel('Data e hora (1ª chamada) *').fill(campoDaquiMinutos(2))
    await page.getByLabel(/^Título/).fill(titulo)
    await page.getByLabel('Local *').fill('Local do teste automático (E2E)')
    await page.getByLabel(/^Quem pediu/).fill('Conselho Diretor (teste automático)')
    await page.getByLabel('Item 1 da pauta').fill('Aprovar o relatório (teste)')
    await page.getByRole('checkbox', { name: 'Vai a votação' }).check()
    await page.getByRole('button', { name: 'Gerar o texto do edital' }).click()
    await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
    await expect(mensagemNaTela(page, 'Encontro preparado. Confira e convoque.')).toBeVisible()
    endereco = page.url()
    await page.getByRole('button', { name: 'Convocar a assembleia' }).click()
    await page.getByRole('button', { name: 'Confirmar — convocar (não muda mais)' }).click()
    await expect(mensagemNaTela(page, 'Assembleia convocada: já aparece no site.')).toBeVisible()

    // presença do ministro (a lista abre no dia)
    await page.getByRole('link', { name: 'Lista de presença' }).click()
    await page.getByLabel('Buscar associado').fill('Ministro de Teste')
    await page.getByRole('listitem', { name: 'Ministro de Teste' }).getByRole('button', { name: 'Marcar presente' }).click()
    await expect(mensagemNaTela(page, 'Presença registrada: Ministro de Teste.')).toBeVisible()
    // o ministro fictício está com a contribuição em atraso: presente, mas não vota (Art. 11)
    await expect(page.getByRole('listitem', { name: 'Ministro de Teste' })).toContainText('Em atraso: não vota')

    // antes da hora: não instala
    await page.goto(`${endereco}/conducao`)
    await expect(page.getByRole('heading', { name: 'Condução da assembleia' })).toBeVisible()
    await page.getByRole('button', { name: 'Instalar a assembleia' }).click()
    await expect(page.getByRole('alert')).toContainText('ainda não começou')

    // começou: sem quórum na 1ª, mas a 2ª chamada (0 minutos, nas regras do teste) instala
    await page.waitForTimeout(125_000)
    await page.getByRole('button', { name: 'Instalar a assembleia' }).click()
    await expect(mensagemNaTela(page, 'Assembleia instalada em 2ª chamada.')).toBeVisible()
    await expect(page.getByText('Instalada em 2ª chamada', { exact: true })).toBeVisible()

    // votação: o único presente está em atraso, então nenhum voto conta (Art. 11); sem votos, rejeitado
    const votacao = page.getByRole('form', { name: 'Registrar votação: Aprovar o relatório (teste)' })
    await votacao.getByLabel('A favor *').fill('1')
    await votacao.getByLabel('Contra *').fill('0')
    await votacao.getByRole('button', { name: 'Registrar a votação' }).click()
    await expect(page.getByRole('alert')).toContainText('só 0 presentes em dia podem votar')
    await votacao.getByLabel('A favor *').fill('0')
    await votacao.getByRole('button', { name: 'Registrar a votação' }).click()
    await expect(mensagemNaTela(page, 'Votação registrada: rejeitado.')).toBeVisible()
    await expect(page.getByRole('article', { name: 'Votação: Aprovar o relatório (teste)' })).toContainText('Rejeitado')

    // ata: gerar o texto, salvar e assinar como presidente
    await page.getByRole('button', { name: 'Gerar o texto da ata' }).click()
    const texto = page.getByLabel(/^Texto da ata/)
    await expect(texto).toHaveValue(/ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA/)
    await expect(texto).toHaveValue(/instalada em segunda chamada/)
    await expect(texto).toHaveValue(/1\. Aprovar o relatório \(teste\): REJEITADO, com 0 votos a favor/)
    await page.getByRole('button', { name: 'Salvar a ata' }).click()
    await expect(mensagemNaTela(page, 'Ata salva.')).toBeVisible()
    await page.getByRole('button', { name: 'Assinar como presidente' }).click()
    await expect(mensagemNaTela(page, 'Ata assinada pelo presidente.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Assinaturas' })).toContainText('1º secretário: falta assinar')
    // assinada por alguém, o texto não muda mais
    await expect(page.getByRole('button', { name: 'Salvar a ata' })).toHaveCount(0)

    // a página da assembleia mostra o resultado
    await page.goto(endereco)
    await expect(page.getByRole('list', { name: 'Votações' })).toContainText('Aprovar o relatório (teste): rejeitado')
  } finally {
    await regras(page, '30', '60')
    if (endereco) {
      await page.goto(endereco)
      await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
      if (await page.getByText('Cancelar este encontro').count()) {
        await page.getByText('Cancelar este encontro').click()
        await page.getByRole('form', { name: 'Cancelar o encontro' }).getByLabel('Motivo *').fill('Teste automático')
        await page.getByRole('button', { name: 'Cancelar o encontro' }).click()
        await expect(mensagemNaTela(page, 'Encontro cancelado.')).toBeVisible()
      }
      await page.getByRole('button', { name: `Arquivar ${titulo}` }).click()
      await page.getByRole('button', { name: `Confirmar — Arquivar ${titulo}` }).click()
      await expect(page).toHaveURL(/\/assembleias$/)
    }
  }
})
