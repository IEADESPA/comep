// Telas novas, parte 11 (Fase 5.5): as notificações. O sino lê a tabela de notificações (o lido fica no banco), o
// recado da secretaria pelo aplicativo e o botão do WhatsApp na ficha do ministro, o "Lembrar todos" das
// Contribuições, Meu perfil › Avisos e Administração › Avisos e notificações.
// A notificação no celular (push) depende das chaves do envio (docs/avisos-no-celular.md). O teste vale com a chave
// pública no build (a variável TESTE_VAPID_PUBLICA do GitHub, ligada em 21/11/2026) e sem ela (a tela diz que o envio
// ainda vai ser ligado). O Chrome sem tela não tem o serviço de push do navegador: uma inscrição FALSA faz o papel
// dele, e no fim o teste para de receber (a inscrição é arquivada no banco, e o job enviar-avisos não manda para ela).
import { expect, test, type Page } from '@playwright/test'

/** O endereço da inscrição falsa (sempre o mesmo: a sobra de uma rodada cortada é reaproveitada e arquivada no fim). */
const ENDERECO_FALSO = 'https://e2e.invalid/comep/inscricao-falsa'

/**
 * Troca o serviço de push do navegador por uma inscrição falsa, guardada no localStorage (vale depois de recarregar).
 * Só entra em ação com a chave do envio no build: sem ela, o sistema nem chama o serviço.
 */
function inscricaoFalsa(endereco: string) {
  const marca = 'comep-e2e-inscricao-push'
  const falsa = () => ({
    endpoint: endereco,
    expirationTime: null,
    options: { userVisibleOnly: true, applicationServerKey: null },
    getKey: () => null,
    toJSON: () => ({ endpoint: endereco, expirationTime: null, keys: { p256dh: `B${'A'.repeat(86)}`, auth: 'A'.repeat(22) } }),
    unsubscribe: async () => {
      localStorage.removeItem(marca)
      return true
    },
  })
  if (!('PushManager' in window)) return
  PushManager.prototype.getSubscription = async function () {
    return (localStorage.getItem(marca) === '1' ? falsa() : null) as unknown as PushSubscription
  }
  PushManager.prototype.subscribe = async function () {
    localStorage.setItem(marca, '1')
    return falsa() as unknown as PushSubscription
  }
}
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

  test('Administração › Avisos e Termo, pelo endereço: "Sem acesso", sem o "Tentar de novo" (D-11)', async ({ page }) => {
    for (const area of ['configuracoes/avisos', 'configuracoes/termo']) {
      await page.goto(area)
      await expect(page.getByRole('heading', { name: 'Sem acesso' }), area).toBeVisible()
      await expect(page.getByRole('button', { name: 'Tentar de novo' }), area).toHaveCount(0)
    }
    // as Configurações (os valores e as contas do caixa) continuam abrindo
    await page.goto('configuracoes')
    await expect(page.getByRole('heading', { name: 'Sem acesso' })).toHaveCount(0)
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
      // espera o banco gravar o lido antes de recarregar (recarregar antes cortaria o pedido no meio)
      const gravou = page.waitForResponse((r) => r.url().includes('/rpc/marcar_notificacoes_lidas') && r.ok())
      await recado.getByRole('button').click()
      await expect(recado.getByRole('img', { name: 'não lido' })).toHaveCount(0)
      await gravou
    }
    // o lido ficou no banco: recarregando, continua lido
    await page.reload()
    const denovo = (await abrirSino(page)).getByRole('list', { name: 'Avisos para você' }).getByRole('listitem').filter({ hasText: 'Recado de teste' }).first()
    await expect(denovo).toBeVisible()
    await expect(denovo.getByRole('img', { name: 'não lido' })).toHaveCount(0)
  })

  test('Meu perfil › Avisos: ativar neste aparelho, o que chega e o silêncio à noite', async ({ page }) => {
    await page.addInitScript(inscricaoFalsa, ENDERECO_FALSO)
    await page.goto('meu-perfil/avisos')
    const aparelho = page.getByRole('region', { name: 'Neste aparelho' })
    await expect(aparelho).toBeVisible()
    const ativar = aparelho.getByRole('button', { name: 'Receber os avisos neste aparelho' })
    const parar = aparelho.getByRole('button', { name: 'Parar de receber neste aparelho' })
    // espera a tela saber como está o aparelho (o botão de ativar, o de parar ou o texto do estado)
    await expect(aparelho.getByText(/^(Este aparelho|Os avisos|Pronto)/).first()).toBeVisible()
    if (await ativar.isVisible()) await ativar.click()
    // sem a chave do envio no build: os avisos ficam ligados e a tela diz que o celular vem depois;
    // com a chave: este aparelho (a inscrição falsa) passa a receber
    const pronto = page.getByText(/^Pronto: os avisos (ficam ligados\.|chegam neste aparelho)/).first()
    await expect(pronto).toBeVisible()
    const comEnvio = /chegam neste aparelho/.test((await pronto.textContent()) ?? '')
    test.info().annotations.push({ type: 'envio', description: comEnvio ? 'build com a chave do envio' : 'build sem a chave do envio' })
    if (comEnvio) await expect(parar).toBeVisible()

    const mural = () => page.getByRole('region', { name: 'O que chega no celular' }).getByRole('switch', { name: 'Avisos novos no mural' })
    const tocar = async (ligado: 'true' | 'false') => {
      const gravou = page.waitForResponse((r) => r.url().includes('/rpc/salvar_preferencias_avisos') && r.ok())
      await mural().click()
      await expect(mural()).toHaveAttribute('aria-checked', ligado)
      await gravou
      await expect(mensagemNaTela(page, 'Preferência guardada.')).toBeVisible()
    }
    // sobra de uma rodada cortada no meio: o mural pode ter ficado desligado; o teste começa com ele ligado
    await expect(mural()).toBeVisible()
    if ((await mural().getAttribute('aria-checked')) === 'false') await tocar('true')

    await tocar('false')
    await page.reload()
    await expect(mural()).toHaveAttribute('aria-checked', 'false')
    // volta como estava (ligado)
    await tocar('true')
    await expect(page.getByRole('switch', { name: 'Silêncio à noite' })).toBeVisible()

    if (comEnvio) {
      // a inscrição falsa não pode ficar valendo no banco: o envio tentaria mandar para ela a cada 5 minutos
      await expect(parar).toBeVisible()
      const cancelou = page.waitForResponse((r) => r.url().includes('/rpc/cancelar_inscricao_push') && r.ok())
      await parar.click()
      await cancelou
      await expect(mensagemNaTela(page, 'Este aparelho parou de receber os avisos. Eles continuam no sino.')).toBeVisible()
    }
  })
})
