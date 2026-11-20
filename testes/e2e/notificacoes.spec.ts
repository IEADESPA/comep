// Telas novas, parte 11 (Fase 5.5): as notificações. O sino lê a tabela de notificações (o lido fica no banco), o
// recado da secretaria pelo aplicativo e o botão do WhatsApp na ficha do ministro, o "Lembrar todos" das
// Contribuições, Meu perfil › Avisos e Administração › Avisos e notificações.
// A notificação no celular (push) depende das chaves do envio (docs/avisos-no-celular.md): aqui, o build do teste
// não tem a chave pública, e a tela diz que o envio ainda vai ser ligado.
import { expect, test, type Page } from '@playwright/test'
import { abrirFichaDoMinistro, arquivoDaSessao, mensagemNaTela, sufixoUnico } from './ajuda'

const MINISTRO = 'Ministro de Teste'

async function abrirSino(page: Page) {
  await page.getByRole('button', { name: /^Avisos/ }).click()
  const lista = page.getByRole('region', { name: 'Avisos', exact: true })
  await expect(lista).toBeVisible()
  return lista
}

test.describe('a presidência fala com o ministro', () => {
  test.use({ storageState: arquivoDaSessao('presidencia') })

  test('na ficha: a mensagem pronta, o WhatsApp com o texto e o "Mandar pelo aplicativo"', async ({ page }, info) => {
    const marca = sufixoUnico(info.project.name)
    await abrirFichaDoMinistro(page, MINISTRO)
    await page.getByRole('button', { name: 'Falar pelo WhatsApp' }).click()
    const conversa = page.getByRole('region', { name: 'Falar com o ministro' })
    await expect(conversa).toBeVisible()
    // o ministro fictício está em atraso de propósito: a mensagem pronta é o lembrete da contribuição
    await expect(conversa.getByLabel('Mensagem pronta')).toHaveValue('mensalidade')
    const texto = conversa.getByLabel('A mensagem (pode mudar antes de mandar)')
    await expect(texto).toHaveValue(/^Olá, .+! Aqui é a secretaria do COMEP\. A sua contribuição está em aberto/)
    await conversa.getByLabel('Mensagem pronta').selectOption('livre')
    await texto.fill(`Olá! Recado de teste ${marca}.`)
    const whatsapp = conversa.getByRole('link', { name: 'Abrir no WhatsApp' })
    await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/\d*\?text=/)
    expect(decodeURIComponent((await whatsapp.getAttribute('href')) ?? '')).toContain(`Recado de teste ${marca}`)
    await conversa.getByRole('button', { name: 'Mandar pelo aplicativo' }).click()
    await expect(mensagemNaTela(page, /^Mandado:/)).toBeVisible()
  })

  test('Administração › Avisos e notificações mostra quantos ativaram e o envio', async ({ page }) => {
    await page.goto('configuracoes/avisos')
    await expect(page.getByRole('heading', { name: 'Avisos e notificações', level: 1 })).toBeVisible()
    await expect(page.getByText('Ativaram os avisos')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'O envio para o celular', level: 2 })).toBeVisible()
    await expect(page.getByRole('list', { name: 'O que o sistema avisa' })).toContainText('Assembleia ou reunião convocada')
  })
})

test.describe('a tesouraria lembra quem está em atraso', () => {
  test.use({ storageState: arquivoDaSessao('tesouraria') })

  test('"Lembrar todos" manda o lembrete (uma vez por dia)', async ({ page }) => {
    await page.goto('financeiro/contribuicoes')
    const atencao = page.getByRole('region', { name: 'Precisam de atenção', exact: true })
    await atencao.getByRole('button', { name: 'Lembrar todos' }).click()
    await expect(mensagemNaTela(page, /^(Lembrete mandado para \d+ ministros?|Ninguém para lembrar agora)/)).toBeVisible()
  })
})

test.describe('o ministro', () => {
  test.use({ storageState: arquivoDaSessao('ministro'), permissions: ['notifications'] })

  test('o recado chega no sino, com quem mandou; tocar marca como lido (no banco, vale em qualquer aparelho)', async ({ page }) => {
    await page.goto('painel')
    const sino = await abrirSino(page)
    const lista = sino.getByRole('list', { name: 'Avisos para você' })
    const recado = lista.getByRole('listitem').filter({ hasText: 'Recado de teste' }).first()
    await expect(recado).toContainText('Mandado por')
    if ((await recado.getByRole('img', { name: 'não lido' }).count()) > 0) {
      await recado.getByRole('button').click()
      await expect(recado.getByRole('img', { name: 'não lido' })).toHaveCount(0)
    }
    // o lido ficou no banco: recarregando, continua lido
    await page.reload()
    const denovo = (await abrirSino(page)).getByRole('list', { name: 'Avisos para você' }).getByRole('listitem').filter({ hasText: 'Recado de teste' }).first()
    await expect(denovo).toBeVisible()
    await expect(denovo.getByRole('img', { name: 'não lido' })).toHaveCount(0)
  })

  test('Meu perfil › Avisos: ativar neste aparelho, o que chega e o silêncio à noite', async ({ page }) => {
    await page.goto('meu-perfil/avisos')
    const aparelho = page.getByRole('region', { name: 'Neste aparelho' })
    await expect(aparelho).toBeVisible()
    const ativar = aparelho.getByRole('button', { name: 'Receber os avisos neste aparelho' })
    if (await ativar.isVisible()) await ativar.click()
    // o build do teste não tem a chave do envio: os avisos ficam ligados e a tela diz que o celular vem depois
    await expect(page.getByText(/^Pronto: os avisos ficam ligados\./).first()).toBeVisible()

    const chega = page.getByRole('region', { name: 'O que chega no celular' })
    const mural = chega.getByRole('switch', { name: 'Avisos novos no mural' })
    const antes = await mural.getAttribute('aria-checked')
    await mural.click()
    await expect(mural).toHaveAttribute('aria-checked', antes === 'true' ? 'false' : 'true')
    await expect(mensagemNaTela(page, 'Preferência guardada.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('switch', { name: 'Avisos novos no mural' })).toHaveAttribute('aria-checked', antes === 'true' ? 'false' : 'true')
    // volta como estava
    await page.getByRole('switch', { name: 'Avisos novos no mural' }).click()
    await expect(page.getByRole('switch', { name: 'Avisos novos no mural' })).toHaveAttribute('aria-checked', antes ?? 'true')
    await expect(page.getByRole('switch', { name: 'Silêncio à noite' })).toBeVisible()
  })
})
