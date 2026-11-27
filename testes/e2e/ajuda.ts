import { expect, type Locator, type Page } from '@playwright/test'

// Usuários FICTÍCIOS que existem só no banco de teste (comep-teste).
export const USUARIOS = {
  presidencia: { email: 'e2e.presidencia@example.com', senhaVar: 'E2E_SENHA_PRESIDENCIA' },
  ministro: { email: 'e2e.ministro@example.com', senhaVar: 'E2E_SENHA_MINISTRO' },
  semPerfil: { email: 'e2e.semperfil@example.com', senhaVar: 'E2E_SENHA_SEM_PERFIL' },
  tesouraria: { email: 'e2e.tesouraria@example.com', senhaVar: 'E2E_SENHA_TESOURARIA' },
  conselho: { email: 'e2e.conselho@example.com', senhaVar: 'E2E_SENHA_CONSELHO' },
  // quem preside uma igreja fictícia (regular, em dia): a conta foi criada pelos caminhos do sistema em 22/11/2026
  presidenteIgreja: { email: 'e2e.presidente.igreja@example.com', senhaVar: 'E2E_SENHA_PRESIDENTE_IGREJA' },
} as const

export type Usuario = (typeof USUARIOS)[keyof typeof USUARIOS]

export function senhaDe(usuario: Usuario): string {
  const senha = process.env[usuario.senhaVar]
  if (!senha) throw new Error(`Falta a variável ${usuario.senhaVar} (arquivo .env.e2e.local ou Secret do GitHub).`)
  return senha
}

export async function preencherLogin(page: Page, email: string, senha: string) {
  await page.goto('entrar')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

export async function entrar(page: Page, usuario: Usuario) {
  await preencherLogin(page, usuario.email, senhaDe(usuario))
  await expect(page).toHaveURL(/\/painel$/)
  await aceitarTermoSeAparecer(page)
}

/**
 * O termo de uso de dados (parte 13): logo depois de entrar, quem é do COMEP e ainda não aceitou a versão que vale vê o
 * termo na tela inteira. Os usuários fictícios aceitam (fica guardado no banco de teste; a cada versão nova, de novo).
 */
export async function aceitarTermoSeAparecer(page: Page): Promise<void> {
  const termo = page.getByRole('heading', { name: /o termo de uso dos seus dados$/i, level: 1 })
  const sistema = page.locator('.estrutura')
  await expect(termo.or(sistema).first()).toBeVisible()
  if (await termo.isVisible()) {
    await page.getByRole('checkbox', { name: /^Li e aceito o termo de uso de dados/ }).check()
    await page.getByRole('button', { name: 'Aceitar e continuar' }).click()
    await expect(sistema).toBeVisible()
  }
}

/**
 * O menu CURTO (telas novas, Fase 5.5): Início, a tela aberta e Meu perfil (e o "Sair").
 * No celular ele fica atrás do botão "Menu", na barra de cima; no computador é a coluna vermelha da esquerda.
 */
export async function abrirMenu(page: Page): Promise<Locator> {
  const botao = page.getByRole('button', { name: 'Menu', exact: true })
  if (await botao.isVisible()) await botao.click()
  const menu = page.getByRole('navigation', { name: 'Menu principal' })
  await expect(menu).toBeVisible()
  return menu
}

/** Os módulos ficam na página inicial; /modulos mostra todos (no celular, é a aba "Módulos"). */
export async function abrirModulos(page: Page): Promise<Locator> {
  await page.goto('modulos')
  const modulos = page.getByRole('region', { name: 'Módulos' })
  await expect(modulos).toBeVisible()
  return modulos
}

/** O "Sair" fica no menu (no computador, embaixo da coluna vermelha; no celular, no fim do Menu). */
export async function sair(page: Page): Promise<void> {
  const menu = await abrirMenu(page)
  await menu.getByRole('button', { name: 'Sair' }).click()
}

/** A saudação do Início: "Bom dia, Fulano" (ou boa tarde, boa noite). */
export function saudacao(nome: string): RegExp {
  return new RegExp(`^(Bom dia|Boa tarde|Boa noite), ${nome}$`)
}

/** Sufixo único por execução e por tamanho de tela (computador/celular), para não misturar dados. */
export function sufixoUnico(projeto: string): string {
  return `${Date.now().toString(36)}-${projeto}`
}

/** CNPJ numérico válido e aleatório (fictício), para não repetir entre execuções. */
export function cnpjAleatorio(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1])
  const digito = (numeros: number[]) => {
    const pesos = numeros.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = numeros.reduce((total, n, i) => total + n * pesos[i], 0)
    return soma % 11 < 2 ? 0 : 11 - (soma % 11)
  }
  const d1 = digito(base)
  const d2 = digito([...base, d1])
  return [...base, d1, d2].join('')
}

/** CPF numérico válido e aleatório (fictício), para não repetir entre execuções. */
export function cpfAleatorio(): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
    if (base.every((n) => n === base[0])) continue
    const digito = (numeros: number[]) =>
      ((numeros.reduce((total, n, i) => total + n * (numeros.length + 1 - i), 0) * 10) % 11) % 10
    const d1 = digito(base)
    return [...base, d1, digito([...base, d1])].join('')
  }
}

// ---------- Sessões reaproveitadas (ver autenticacao.setup.ts) ----------

export type NomeUsuario = keyof typeof USUARIOS

/** Arquivo com a sessão guardada de cada usuário fictício. */
export function arquivoDaSessao(nome: NomeUsuario): string {
  return `playwright/.auth/${nome}.json`
}

type ItemArmazenado = { name: string; value: string }

/** Guarda a sessão de quem está logado nesta aba (ex.: um candidato recém-criado). */
export async function guardarSessao(page: Page): Promise<ItemArmazenado[]> {
  return page.evaluate(() => Object.entries(localStorage).map(([name, value]) => ({ name, value })))
}

/**
 * Troca quem está logado nesta aba, sem fazer login de novo:
 * um usuário fictício (sessão guardada), uma sessão guardada por guardarSessao, ou ninguém (null).
 */
export async function trocarPara(page: Page, quem: NomeUsuario | ItemArmazenado[] | null): Promise<void> {
  let itens: ItemArmazenado[] = []
  if (typeof quem === 'string') {
    const { readFileSync } = await import('node:fs')
    const estado = JSON.parse(readFileSync(arquivoDaSessao(quem), 'utf8')) as {
      origins: { origin: string; localStorage: ItemArmazenado[] }[]
    }
    itens = estado.origins.flatMap((o) => o.localStorage)
  } else if (quem) {
    itens = quem
  }
  if (!page.url().startsWith('http')) await page.goto('./')
  await page.evaluate((lista) => {
    localStorage.clear()
    for (const item of lista) localStorage.setItem(item.name, item.value)
  }, itens)
}

// ---------- Associados de teste criados pela própria bateria ----------

/** Mensagem de sucesso (role=status) com o texto pedido. */
export function mensagemNaTela(page: Page, texto: string | RegExp): Locator {
  return page.getByRole('status').filter({ hasText: texto })
}

// ---------- O menu do módulo (aprovado em 18/11/2026: "o módulo toma a coluna") ----------

/**
 * Abre uma função do módulo aberto: no computador, na coluna vermelha da esquerda; no celular, pelo botão
 * "Funções do módulo" logo abaixo da barra vermelha. `nome` é o nome da função; numa subfunção, passe também
 * a função dela (no computador, a subfunção só aparece embaixo da função aberta).
 */
export async function abrirFuncao(page: Page, nome: string, funcao?: string): Promise<void> {
  const menu = await funcoesDoModulo(page)
  if (funcao && !noCelular(page)) await menu.getByRole('link', { name: nomeDaFuncao(funcao) }).click()
  await menu.getByRole('link', { name: nomeDaFuncao(nome) }).click()
}

/** O nome exato da função, ou seguido da contagem (", 3 pendentes"). */
export function nomeDaFuncao(nome: string): RegExp {
  return new RegExp('^' + nome.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&') + '\\s*(,|$)')
}

/** Celular = a mesma divisa da moldura (900px). */
export function noCelular(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 900
}

/**
 * A lista das funções do módulo aberto: no computador, a coluna vermelha ("Menu principal"); no celular, a lista
 * que abre no botão "Funções do módulo".
 */
export async function funcoesDoModulo(page: Page): Promise<Locator> {
  if (!noCelular(page)) return page.getByRole('navigation', { name: 'Menu principal' })
  const botao = page.getByRole('button', { name: /^Funções do módulo/ })
  await expect(botao).toBeVisible()
  if ((await botao.getAttribute('aria-expanded')) !== 'true') await botao.click()
  return page.getByRole('navigation', { name: 'Funções do módulo' })
}

// ---------- Ministros e inscrições ----------

export type MinistroDeTeste = {
  nome: string
  igreja: string
  telefone?: string
  titulo?: string
  funcao?: string
  pastorPresidente?: boolean
}

/** Cadastrar ministro, passo a passo (1 Dados pessoais, 2 Igreja e ministério, 3 No COMEP). Termina na ficha. */
export async function cadastrarMinistro(page: Page, dados: MinistroDeTeste): Promise<void> {
  await page.goto('ministros/novo')
  await page.getByLabel(/^Nome completo/).fill(dados.nome)
  if (dados.telefone) await page.getByLabel(/^Telefone/).fill(dados.telefone)
  await page.getByRole('button', { name: /^Continuar/ }).click()
  await page.getByLabel(/^Igreja \*/).selectOption({ label: dados.igreja })
  if (dados.funcao) await page.getByLabel(/^Função na igreja/).fill(dados.funcao)
  if (dados.pastorPresidente) await page.getByLabel(/É o pastor presidente desta igreja/).check()
  await page.getByLabel(/^Título ministerial/).selectOption({ label: dados.titulo ?? 'Pastor(a)' })
  await page.getByRole('button', { name: /^Continuar/ }).click()
  await page.getByRole('button', { name: 'Cadastrar o ministro' }).click()
  await expect(mensagemNaTela(page, 'Ministro cadastrado.')).toBeVisible()
  await expect(page.getByRole('heading', { name: dados.nome, level: 1 })).toBeVisible()
}

// ---------- Igrejas (Fase 5.5, parte 5: o cadastro completo em 5 passos e a ficha em abas) ----------

/** A denominação fictícia do banco de teste. */
export const DENOMINACAO_DE_TESTE = 'Denominação Fictícia (teste) (DFT)'

/**
 * Igrejas › Cadastrar igreja: o cadastro completo (com o CNPJ e a natureza), passando os 5 passos sem os documentos
 * (dá para mandar depois; até lá a igreja fica suspensa, com os dias para mandar). Termina na ficha e devolve
 * o endereço dela.
 */
export async function cadastrarIgreja(page: Page, dados: { nome: string; sigla?: string; cnpj?: string }): Promise<string> {
  await page.goto('igrejas/nova')
  await page.getByLabel(/^Nome da igreja/).fill(dados.nome)
  await page.getByLabel(/^Denominação/).selectOption({ label: DENOMINACAO_DE_TESTE })
  await page.getByLabel(/^CNPJ/).fill(dados.cnpj ?? cnpjAleatorio())
  if (dados.sigla) await page.getByLabel(/^Sigla/).fill(dados.sigla)
  for (let passo = 0; passo < 4; passo++) await page.getByRole('button', { name: /^Continuar/ }).click()
  await page.getByRole('button', { name: 'Cadastrar a igreja' }).click()
  await expect(mensagemNaTela(page, 'Igreja cadastrada.')).toBeVisible()
  await expect(page.getByRole('heading', { name: dados.nome, level: 1 })).toBeVisible()
  return page.url()
}

/** As abas da igreja aberta pela secretaria: Dados, Documentos, Diretoria, Ministros, Filiais, Agenda e Situação. */
export async function abrirAbaDaIgreja(page: Page, aba: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Partes da igreja' }).getByRole('link', { name: aba, exact: true }).click()
}

/** Limpeza da igreja aberta: aba Situação → Arquivar a igreja (nada se apaga; antes, os ministros saem dela). */
export async function arquivarIgrejaAberta(page: Page): Promise<void> {
  await abrirAbaDaIgreja(page, 'Situação')
  await page.getByText('Arquivar a igreja', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar o arquivamento' }).click()
  await expect(page).toHaveURL(/\/igrejas\/lista$/)
}

/** Escolhe na lista a opção que tem o texto (o nome do ministro vem com o nº de registro). */
export async function escolherOpcaoCom(lista: Locator, texto: string): Promise<void> {
  await lista.selectOption((await lista.locator('option', { hasText: texto }).first().getAttribute('value')) ?? '')
}

/** Um PDF fictício (o conteúdo não importa: o banco guarda o arquivo como veio). */
export function pdfFicticio(nome: string) {
  return { name: nome, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 documento fictício do teste automático: ${nome}`) }
}

/** As abas da ficha do ministro: Dados, Igreja, Título, Contribuição, Credencial, Acesso e Situação. */
export async function abrirAbaDaFicha(page: Page, aba: string): Promise<void> {
  await page.getByRole('navigation', { name: 'Partes da ficha' }).getByRole('link', { name: aba, exact: true }).click()
}

/** Na lista dos ministros, busca pelo nome e abre a ficha. */
export async function abrirFichaDoMinistro(page: Page, nome: string): Promise<void> {
  await page.goto('ministros')
  await page.getByLabel('Buscar ministro', { exact: true }).fill(nome)
  await page.getByRole('list', { name: 'Ministros' }).getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: nome, level: 1 })).toBeVisible()
}

/** Limpeza da ficha aberta: aba Situação → Arquivar cadastro (nada se apaga). */
export async function arquivarCadastroAberto(page: Page): Promise<void> {
  await abrirAbaDaFicha(page, 'Situação')
  await page.getByText('Arquivar cadastro', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click()
  await expect(page).toHaveURL(/\/ministros$/)
}

/**
 * A presidência cadastra um associado fictício e gera o código; o associado cria o login (primeiro acesso).
 * Devolve a sessão do associado (para usar com trocarPara).
 */
export async function criarAssociadoComLogin(
  page: Page,
  dados: { nome: string; email: string; senha: string; igreja: string; pastorPresidente?: boolean },
): Promise<ItemArmazenado[]> {
  await trocarPara(page, 'presidencia')
  await cadastrarMinistro(page, { nome: dados.nome, igreja: dados.igreja, pastorPresidente: dados.pastorPresidente })
  await abrirAbaDaFicha(page, 'Acesso')
  await page.getByRole('button', { name: 'Gerar código de primeiro acesso' }).click()
  const codigo = (await page.locator('.codigo').textContent())?.trim() ?? ''

  await trocarPara(page, null)
  await page.goto('primeiro-acesso')
  await page.getByLabel('Código de acesso').fill(codigo)
  await page.getByLabel('E-mail').fill(dados.email)
  await page.getByLabel('Senha nova').fill(dados.senha)
  await page.getByLabel('Repita a senha').fill(dados.senha)
  await page.getByRole('button', { name: 'Criar a minha senha' }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await aceitarTermoSeAparecer(page)
  return guardarSessao(page)
}

/** Limpeza: a presidência arquiva o cadastro de um associado de teste (nada se apaga). */
export async function arquivarAssociadoDeTeste(page: Page, nome: string): Promise<void> {
  await trocarPara(page, 'presidencia')
  await abrirFichaDoMinistro(page, nome)
  await arquivarCadastroAberto(page)
}

// ---------- Assembleias ----------

/** Campo data e hora (hora de Parauapebas) daqui a N horas. */
export function campoDaquiHoras(horas: number): string {
  const d = new Date(Date.now() + horas * 3_600_000)
  const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${dia}T${hora}`
}

/** Uma reunião mensal FICTÍCIA publicada, daqui a N horas (a reunião mensal não depende das regras das assembleias). */
export async function reuniaoMensalPublicada(page: Page, titulo: string, horas: number, pauta = 'Oração'): Promise<string> {
  await page.goto('assembleias/novo')
  await page.getByLabel('Tipo *').selectOption({ label: 'Reunião mensal' })
  await page.getByLabel('Data e hora (1ª chamada) *').fill(campoDaquiHoras(horas))
  await page.getByLabel(/^Título/).fill(titulo)
  await page.getByLabel('Local *').fill('Local do teste automático (E2E)')
  await page.getByLabel('Item 1 da pauta').fill(pauta)
  await page.getByRole('button', { name: 'Salvar (ainda sem convocar)' }).click()
  await expect(mensagemNaTela(page, 'Encontro preparado. Confira e convoque.')).toBeVisible()
  await page.getByRole('button', { name: 'Publicar a reunião' }).click()
  await page.getByRole('button', { name: 'Confirmar — publicar' }).click()
  await expect(mensagemNaTela(page, 'Reunião publicada.')).toBeVisible()
  return page.url()
}

/** Limpeza: cancela (se ainda dá) e arquiva o encontro de teste (nada se apaga). */
export async function cancelarEArquivarEncontro(page: Page, endereco: string, titulo: string): Promise<void> {
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
