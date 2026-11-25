// A assembleia ao vivo (Fase 4.3; telas novas na parte 14: asm-conducao e asm-fechamento): o roteiro (abertura,
// pauta do edital e a que chegou no período), instalar (quórum), a votação do item de agora (contada à mão), o
// telão, os convidados, a resolução protocolada e a ata (o resumo assinado e o texto do oficial para o Word).
// Para ter uma assembleia "acontecendo agora", o teste zera por alguns minutos a antecedência e a 2ª chamada
// nas Regras (Configurações) e devolve os valores no fim. AGE FICTÍCIA: instalada, ela não se cancela mais (revisão da
// Fase 4); no fim, a lista de presença é encerrada e ela fica em "Anteriores" do banco de teste, com o título "E2E".
// Se o teste parar antes de instalar, ela é cancelada e arquivada. O desligamento (sem volta) é testado só no banco
// (testes/banco/conducao.test.ts); a votação pelo celular, em votacoes.spec.ts.
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

const ITEM = 'Aprovar o relatório (teste)'

test('assembleia ao vivo: roteiro, instalar, votar, telão, convidado, resolução e ata', async ({ page }, info) => {
  test.skip(info.project.name === 'celular', 'espera a assembleia começar (2 minutos): roda só no computador')
  test.setTimeout(360_000)
  const titulo = `AGE condução E2E ${sufixoUnico(info.project.name)}`
  let endereco = ''
  let id = ''
  await regras(page, '0', '0')
  try {
    // AGE que começa daqui a 2 minutos
    await page.goto('assembleias/novo')
    await page.getByLabel('Tipo *').selectOption({ label: 'Assembleia Geral Extraordinária' })
    await page.getByLabel('Data e hora (1ª chamada) *').fill(campoDaquiMinutos(2))
    await page.getByLabel(/^Título/).fill(titulo)
    await page.getByLabel('Local *').fill('Local do teste automático (E2E)')
    await page.getByLabel(/^Quem pediu/).fill('Conselho Diretor (teste automático)')
    await page.getByLabel('Item 1 da pauta').fill(ITEM)
    await page.getByRole('checkbox', { name: 'Vai a votação' }).check()
    await page.getByRole('button', { name: 'Gerar o texto do edital' }).click()
    await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
    await expect(mensagemNaTela(page, 'Encontro preparado. Confira e convoque.')).toBeVisible()
    endereco = page.url()
    id = endereco.split('/').pop() ?? ''
    await page.getByRole('button', { name: 'Convocar a assembleia' }).click()
    await page.getByRole('button', { name: 'Confirmar — convocar (não muda mais)' }).click()
    await expect(mensagemNaTela(page, 'Assembleia convocada: já aparece no site.')).toBeVisible()

    // presença do ministro, pelo nome (a lista abre no dia)
    await page.getByRole('main').getByRole('link', { name: 'Presença', exact: true }).click()
    await page.getByLabel('Buscar associado').fill('Ministro de Teste')
    await page.getByRole('listitem', { name: 'Ministro de Teste' }).getByRole('button', { name: 'Marcar presente' }).click()
    await expect(mensagemNaTela(page, 'Presença registrada: Ministro de Teste.')).toBeVisible()
    // o ministro fictício está com a contribuição em atraso: presente, mas não vota (Art. 11)
    await expect(page.getByRole('listitem', { name: 'Ministro de Teste' })).toContainText('Em atraso: não vota')

    // a condução: o roteiro começa pela abertura (introdução, oração e oportunidade)
    await page.goto(`assembleias/conducao/${id}`)
    await expect(page.getByRole('heading', { name: 'Ao vivo', level: 1 })).toBeVisible()
    const roteiro = page.getByRole('list', { name: 'Roteiro' })
    await expect(roteiro).toContainText('Introdução')
    await expect(roteiro).toContainText(ITEM)
    await page.getByRole('button', { name: 'Começar o roteiro' }).click()
    await expect(mensagemNaTela(page, 'Agora: Introdução.')).toBeVisible()
    await page.getByRole('button', { name: 'Próximo item' }).click()
    await expect(mensagemNaTela(page, 'Agora: Oração.')).toBeVisible()

    // antes da hora: não instala
    await page.getByRole('button', { name: 'Instalar a assembleia' }).click()
    await expect(page.getByRole('alert')).toContainText('ainda não começou')

    // a pauta que chegou no período entra no roteiro (na AGE, como informe) e o convidado não conta no quórum
    await page.getByText('+ Pauta que chegou no período').click()
    const juntar = page.getByRole('form', { name: 'Pauta que chegou no período' })
    await juntar.getByLabel('Assunto *').fill('Informe do período (teste)')
    await juntar.getByRole('button', { name: 'Juntar ao roteiro' }).click()
    await expect(mensagemNaTela(page, 'Pauta juntada ao roteiro: Informe do período (teste).')).toBeVisible()
    await expect(roteiro).toContainText('chegou no período')
    const convidado = page.getByRole('form', { name: 'Registrar convidado' })
    await convidado.getByLabel('Nome do convidado *').fill('Convidado Fictício (teste)')
    await convidado.getByLabel('Quem é').fill('Vereador (exemplo)')
    await convidado.getByRole('button', { name: '+ Convidado' }).click()
    await expect(mensagemNaTela(page, 'Convidado registrado: Convidado Fictício (teste).')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Convidados' })).toContainText('Vereador (exemplo)')

    // começou: sem quórum na 1ª, mas a 2ª chamada (0 minutos, nas regras do teste) instala
    await page.waitForTimeout(125_000)
    await page.getByRole('button', { name: 'Instalar a assembleia' }).click()
    await expect(mensagemNaTela(page, 'Assembleia instalada em 2ª chamada.')).toBeVisible()
    await expect(page.getByText(/^Instalada em 2ª chamada/)).toBeVisible()

    // o item da pauta: a votação contada à mão. O único presente está em atraso, então nenhum voto conta (Art. 11)
    await roteiro.getByRole('button', { name: `Ir para: 1. ${ITEM}` }).click()
    await expect(mensagemNaTela(page, `Agora: ${ITEM}.`)).toBeVisible()
    const cartao = page.getByRole('article', { name: `Votação: ${ITEM}` })
    await cartao.getByRole('button', { name: 'Contar à mão' }).click()
    const votacao = page.getByRole('form', { name: `Registrar votação: ${ITEM}` })
    await votacao.getByLabel('A favor *').fill('1')
    await votacao.getByLabel('Contra *').fill('0')
    await votacao.getByRole('button', { name: 'Registrar a votação' }).click()
    await expect(page.getByRole('alert')).toContainText('só 0 presentes em dia podem votar')
    await votacao.getByLabel('A favor *').fill('0')
    await votacao.getByRole('button', { name: 'Registrar a votação' }).click()
    await expect(mensagemNaTela(page, 'Votação registrada: rejeitado.')).toBeVisible()
    await expect(cartao).toContainText('Rejeitado')

    // o telão (a TV da sede) acompanha o item de agora e o resultado
    await page.goto(`assembleias/telao/${id}`)
    const telao = page.getByRole('main', { name: 'Telão' })
    await expect(telao).toContainText(`1 · ${ITEM}`)
    await expect(telao).toContainText('Rejeitado')
    await expect(telao).toContainText('instalada')

    // o fechamento: a resolução protocolada (número por ano), anulada e protocolada de novo
    await page.goto(`assembleias/fechamento/${id}`)
    await expect(page.getByRole('heading', { name: 'Fechamento e ata', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: '+ Resolução' }).click()
    const nova = page.getByRole('form', { name: 'Protocolar uma resolução' })
    await nova.getByLabel('Item da pauta (opcional)').selectOption({ label: `1. ${ITEM}` })
    await expect(nova).toContainText('Resultado do item: rejeitada por 0 a 0.')
    await nova.getByLabel('Texto da resolução *').fill('Rejeitado o relatório (resolução de teste).')
    await nova.getByRole('button', { name: 'Protocolar a resolução' }).click()
    await expect(mensagemNaTela(page, /^Resolução \d{2}\/\d{4} protocolada\.$/)).toBeVisible()
    const resolucoes = page.getByRole('list', { name: 'Resoluções protocoladas' })
    const primeira = resolucoes.getByRole('listitem').filter({ hasText: 'Rejeitado o relatório (resolução de teste).' })
    await expect(primeira).toContainText('item 1 · rejeitada por 0 a 0')
    const numero = ((await primeira.getAttribute('aria-label')) ?? '').replace('Resolução ', '')
    await primeira.locator('summary', { hasText: 'Anular' }).click()
    await primeira.getByRole('form', { name: `Anular a resolução ${numero}` }).getByLabel('Motivo *').fill('Texto errado (teste)')
    await primeira.getByRole('button', { name: 'Anular', exact: true }).click()
    await expect(mensagemNaTela(page, `Resolução ${numero} anulada (o número não volta).`)).toBeVisible()
    await expect(primeira).toContainText('anulada: Texto errado (teste)')
    await page.getByRole('button', { name: '+ Resolução' }).click()
    await nova.getByLabel('Texto da resolução *').fill('Registrada a presença do convidado (resolução de teste).')
    await nova.getByRole('button', { name: 'Protocolar a resolução' }).click()
    await expect(mensagemNaTela(page, /^Resolução \d{2}\/\d{4} protocolada\.$/)).toBeVisible()
    await expect(page.getByRole('list', { name: 'Os números do encontro' })).toContainText('Resoluções1')

    // a ata: o resumo (gerar, salvar e assinar como presidente)
    await page.getByRole('button', { name: 'Gerar o texto da ata' }).click()
    const texto = page.getByRole('textbox', { name: /^Texto da ata \(o 1º secretário/ })
    await expect(texto).toHaveValue(/ATA DA ASSEMBLEIA GERAL EXTRAORDINÁRIA/)
    await expect(texto).toHaveValue(/instalada em segunda chamada/)
    await expect(texto).toHaveValue(/1\. Aprovar o relatório \(teste\): REJEITADO, com 0 votos a favor/)
    await page.getByRole('button', { name: 'Salvar a ata' }).click()
    await expect(mensagemNaTela(page, 'Ata salva.')).toBeVisible()
    // o oficial: o texto para o Word, com os convidados e só as resoluções que valem
    const word = page.getByLabel('Texto da ata oficial para o Word')
    await expect(word).toHaveValue(/Estiveram presentes como convidados, sem direito a voto: Convidado Fictício \(teste\) \(Vereador \(exemplo\)\)/)
    await expect(word).toHaveValue(/Registrada a presença do convidado \(resolução de teste\)\./)
    await expect(word).not.toHaveValue(/Rejeitado o relatório \(resolução de teste\)/)
    await expect(word).toHaveValue(/\[/)
    await page.getByRole('button', { name: 'Assinar como presidente' }).click()
    await expect(mensagemNaTela(page, 'Ata assinada pelo presidente.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Assinaturas' })).toContainText('1º secretário: falta assinar')
    // quem assinou e como: a presidência fictícia não tem mandato registrado, assina pelo perfil
    await expect(page.getByRole('list', { name: 'Assinaturas' })).toContainText('(pelo perfil de acesso)')
    // assinada por alguém, o texto, as votações e as resoluções não mudam mais
    await expect(page.getByRole('button', { name: 'Salvar a ata' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '+ Resolução' })).toHaveCount(0)
    // o PDF do oficial só entra depois das duas assinaturas
    await expect(page.getByText('Anexar a ata oficial em PDF')).toHaveCount(0)
    await page.goto(`assembleias/conducao/${id}`)
    await expect(page.getByRole('article', { name: `Votação: ${ITEM}` })).toContainText('A ata já começou a ser assinada: as votações não mudam mais.')
    await expect(page.getByRole('form', { name: `Registrar votação: ${ITEM}` })).toHaveCount(0)
    // nem o roteiro, a abertura e os convidados (revisão da parte 14, achado 8: as mesmas travas do banco)
    await expect(page.getByText('A ata já começou a ser assinada: o roteiro e os convidados não mudam mais.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Próximo item' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Roteiro' }).getByRole('button', { name: 'Ir para: Encerramento' })).toBeDisabled()
    await expect(page.getByText('Ajustar a abertura')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Tirar Convidado Fictício (teste)' })).toHaveCount(0)
    await expect(page.getByRole('form', { name: 'Registrar convidado' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Convidados' })).toContainText('Convidado Fictício (teste)')

    // a página da assembleia mostra o resultado
    await page.goto(endereco)
    await expect(page.getByRole('list', { name: 'Votações' })).toContainText(`${ITEM}: rejeitado`)
  } finally {
    await regras(page, '30', '60')
    if (endereco) {
      await page.goto(endereco)
      await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
      if (await page.getByText('Cancelar este encontro').count()) {
        // não chegou a ser instalada: cancela e arquiva
        await page.getByText('Cancelar este encontro').click()
        await page.getByRole('form', { name: 'Cancelar o encontro' }).getByLabel('Motivo *').fill('Teste automático')
        await page.getByRole('button', { name: 'Cancelar o encontro' }).click()
        await expect(mensagemNaTela(page, 'Encontro cancelado.')).toBeVisible()
        await page.getByRole('button', { name: `Arquivar ${titulo}` }).click()
        await page.getByRole('button', { name: `Confirmar — Arquivar ${titulo}` }).click()
        await expect(page).toHaveURL(/\/assembleias$/)
      } else {
        // instalada: não se cancela mais; encerra a lista e ela fica registrada como realizada
        await page.goto(`assembleias/presenca/${id}`)
        await page.getByRole('button', { name: 'Encerrar a lista de presença' }).click()
        await page.getByRole('button', { name: /^Confirmar — encerrar/ }).click()
        await expect(mensagemNaTela(page, 'Lista encerrada: o encontro está registrado como realizado.')).toBeVisible()
        // encerrada, o fechamento vira "a assembleia encerrada"
        await page.goto(`assembleias/fechamento/${id}`)
        await expect(page.getByRole('heading', { name: 'A assembleia encerrada', level: 1 })).toBeVisible()
      }
    }
  }
})

test('o ministro não abre a condução, o telão nem o fechamento', async ({ browser }) => {
  const ministro = await browser.newContext({ storageState: arquivoDaSessao('ministro') })
  const m = await ministro.newPage()
  for (const endereco of ['conducao', 'telao', 'fechamento']) {
    await m.goto(`assembleias/${endereco}/00000000-0000-0000-0000-000000000000`)
    await expect(m.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
  }
  await expect(m.getByRole('button', { name: 'Instalar a assembleia' })).toHaveCount(0)
  // o endereço antigo leva ao novo
  await m.goto('assembleias/00000000-0000-0000-0000-000000000000/conducao')
  await expect(m).toHaveURL(/\/assembleias\/conducao\/0{8}-/)
  await ministro.close()
})
