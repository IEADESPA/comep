// Modelo (desenho) da credencial: o que vai em cada lado, onde fica e como aparece.
// Medidas em MILÍMETROS no cartão (o padrão é o CR80, 85,6 × 53,98 mm, o de cartão de crédito; o tamanho vem no
// próprio modelo e muda no editor); letras em PONTOS (pt), como nos editores de texto.
// O mesmo modelo desenha a credencial digital (tela) e a impressa (tamanho real).
// Cada item tem a sua caixa fixa: um texto comprido diminui a letra para caber, nunca empurra nem corta os outros.
// Fase 3.4: a secretaria muda o modelo no editor; sem modelo salvo, vale o MODELO_PADRAO.
// Fase 5.5 (parte 7): vários modelos (um por grupo); o do ministro em readequação tem a faixa de aviso.
import type { DadosCredencial, PacoteCredenciais } from '../dados/credencial'
import { formatarCnpj, formatarCpf, formatarData, formatarDataDeInstante } from './formatos.ts'
import { ehSimbolo, SIMBOLOS, type ChaveSimbolo } from './simbolos.ts'

export const LARGURA_MM = 85.6
export const ALTURA_MM = 53.98
/** 1 pt = 1/72 polegada */
export const PT_EM_MM = 25.4 / 72
export const MAXIMO_ELEMENTOS = 60

export type Lado = 'frente' | 'verso'
export type Alinhamento = 'esquerda' | 'centro' | 'direita'
export type Peso = 400 | 600 | 700 | 800
export type Fonte = 'sans' | 'serif' | 'inter' | 'jakarta'

/** O cartão: tamanho (mm), cantos (0 = retos, para a guilhotina), sangria e área segura (as guias do editor). */
export type Cartao = { largura: number; altura: number; cantos: number; sangria: number; seguranca: number }

export const CARTAO_PADRAO: Cartao = { largura: LARGURA_MM, altura: ALTURA_MM, cantos: 0, sangria: 2, seguranca: 3 }

/** Os tamanhos prontos do editor (rodada 8). */
export const TAMANHOS = [
  { chave: 'cr80', nome: 'Cartão de crédito (CR80)', detalhe: '85,6 × 54 mm · o padrão', largura: LARGURA_MM, altura: ALTURA_MM },
  { chave: 'cracha', nome: 'Crachá em pé', detalhe: '54 × 85,6 mm', largura: ALTURA_MM, altura: LARGURA_MM },
  { chave: 'maior', nome: 'Carteirinha maior', detalhe: '100 × 70 mm', largura: 100, altura: 70 },
] as const

type Caixa = {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** graus */
  rotacao: number
}

export type ElementoTexto = Caixa & {
  tipo: 'texto'
  /** Texto fixo e/ou dados do associado entre chaves: {nome}, {cpf}… (lista em CAMPOS) */
  texto: string
  /** pt */
  tamanho: number
  peso: Peso
  cor: string
  alinhamento: Alinhamento
  maiusculas: boolean
  italico: boolean
  /** espaço entre as letras (em) */
  espacamento: number
  /** várias linhas; senão, uma linha só (a letra diminui para caber) */
  quebrar: boolean
  fonte: Fonte
  opacidade: number
  /** texto comprido: diminuir a letra para caber (senão, corta com "…") */
  encolher: boolean
  /** a menor letra (pt) ao diminuir; vazio = 45% do tamanho */
  minimo: number | null
}

export type ElementoForma = Caixa & {
  tipo: 'forma'
  forma: 'retangulo' | 'elipse'
  cor: string
  /** segunda cor (degradê); null = cor única */
  cor2: string | null
  /** direção do degradê, em graus */
  angulo: number
  /** cantos arredondados (mm) */
  raio: number
  /** espessura da borda (mm); 0 = sem borda */
  borda: number
  corBorda: string
  opacidade: number
}

export type ElementoFoto = Caixa & { tipo: 'foto'; raio: number; borda: number; corBorda: string }

export type ElementoQr = Caixa & { tipo: 'qr'; cor: string }

export type ElementoImagem = Caixa & {
  tipo: 'imagem'
  /** 'logo' (o logo do sistema), 'denominacao' (o logotipo da denominação de cada pessoa) ou o arquivo enviado no editor */
  arquivo: string
  ajuste: 'conter' | 'cobrir'
  raio: number
  borda: number
  corBorda: string
  opacidade: number
}

/** A faixa de aviso (a credencial do ministro em readequação): listrada, com o texto no meio; vai num lado do cartão. */
export type ElementoFaixa = Caixa & {
  tipo: 'faixa'
  texto: string
  /** as listras: as duas cores */
  cor: string
  cor2: string
  corTexto: string
  /** pt */
  tamanho: number
}

/** Um símbolo da biblioteca (desenho próprio em SVG, nunca emoji): utilitarios/simbolos.ts. */
export type ElementoSimbolo = Caixa & {
  tipo: 'simbolo'
  simbolo: ChaveSimbolo
  cor: string
  /** espessura do traço (na grade de 24) */
  traco: number
  opacidade: number
}

export type Elemento = ElementoTexto | ElementoForma | ElementoFoto | ElementoQr | ElementoImagem | ElementoFaixa | ElementoSimbolo
export type TipoElemento = Elemento['tipo']
/** A marca d'água: o símbolo do COMEP ou um da biblioteca, bem claro no meio do lado. */
export type MarcaDagua = { simbolo: 'comep' | ChaveSimbolo; opacidade: number; cor: string }
export type Face = {
  fundo: string
  /** segunda cor do fundo (degradê); vazio = cor única */
  fundo2: string | null
  anguloFundo: number
  /** imagem de fundo enviada no editor (cobre o lado) */
  imagem: string | null
  marca: MarcaDagua | null
  elementos: Elemento[]
}
export type ModeloCredencial = { versao: 1; cartao: Cartao; frente: Face; verso: Face }

/** O tipo do modelo no banco (credencial_modelos.tipo). */
export type TipoModelo = 'padrao' | 'grupo' | 'exclusivo' | 'readequacao'

// ---------------------------------------------------------------------
// Dados que podem ir na credencial
// ---------------------------------------------------------------------

export const CAMPOS = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'titulo_funcao', rotulo: 'Título e função' },
  { chave: 'titulo', rotulo: 'Título' },
  { chave: 'funcao', rotulo: 'Função na igreja' },
  { chave: 'cpf', rotulo: 'CPF' },
  { chave: 'numero', rotulo: 'Nº de registro' },
  { chave: 'desde', rotulo: 'Associado desde' },
  { chave: 'validade', rotulo: 'Válida até' },
  { chave: 'emissao', rotulo: 'Emitida em' },
  { chave: 'igreja', rotulo: 'Igreja (sigla)' },
  { chave: 'igreja_nome', rotulo: 'Igreja (nome completo)' },
  { chave: 'cnpj', rotulo: 'CNPJ da igreja' },
  { chave: 'mae', rotulo: 'Nome da mãe' },
  { chave: 'pai', rotulo: 'Nome do pai' },
  { chave: 'texto_verso', rotulo: 'Texto do verso (Validade e verso)' },
  { chave: 'cargo', rotulo: 'Cargo na diretoria' },
  { chave: 'anos', rotulo: 'Anos de COMEP' },
  { chave: 'prazo', rotulo: 'Prazo da readequação' },
] as const

const NOME_DO_CARGO: Record<string, string> = {
  presidente: 'Presidente do COMEP',
  vice_presidente: 'Vice-presidente do COMEP',
  primeiro_secretario: '1º secretário do COMEP',
  segundo_secretario: '2º secretário do COMEP',
  primeiro_tesoureiro: '1º tesoureiro do COMEP',
  segundo_tesoureiro: '2º tesoureiro do COMEP',
  secretario_executivo: 'Secretário executivo do COMEP',
  conselheiro_fiscal: 'Conselho Fiscal do COMEP',
}

/** Anos completos de COMEP no dia (para o modelo "10 anos de COMEP"). */
export function anosDeComep(admitido: string | null, hoje: string): string {
  if (!admitido) return ''
  const [a, m, d] = admitido.split('-').map(Number)
  const [ha, hm, hd] = hoje.split('-').map(Number)
  const anos = ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
  return anos >= 1 ? `${anos} ${anos === 1 ? 'ano' : 'anos'} de COMEP` : ''
}

export type ChaveCampo = (typeof CAMPOS)[number]['chave']
export type ValoresCredencial = Record<ChaveCampo, string>

/** O que cada dado mostra. Falta de dado obrigatório aparece como "—" (é pendência); o pai é opcional. */
export function valoresDaCredencial(c: DadosCredencial, textoVerso: string): ValoresCredencial {
  const titulo = c.titulo ?? ''
  const funcao = c.funcao ?? ''
  return {
    nome: c.nome,
    titulo_funcao: [titulo, funcao].filter(Boolean).join(' · ') || '—',
    titulo: titulo || '—',
    funcao,
    cpf: c.cpf ? formatarCpf(c.cpf) : '—',
    numero: String(c.numero_registro).padStart(4, '0'),
    desde: c.admitido_em ? formatarData(c.admitido_em) : '—',
    validade: c.valida_ate ? formatarData(c.valida_ate) : 'enquanto ativo',
    emissao: c.emitida_em ? formatarDataDeInstante(c.emitida_em) : '—',
    igreja: c.igreja_sigla || c.igreja || '—',
    igreja_nome: c.igreja || '—',
    cnpj: c.igreja_cnpj ? formatarCnpj(c.igreja_cnpj) : '—',
    mae: c.nome_mae || '—',
    pai: c.nome_pai || '',
    texto_verso: textoVerso,
    cargo: c.cargo ? (NOME_DO_CARGO[c.cargo] ?? '') : '',
    anos: anosDeComep(c.admitido_em, new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })),
    prazo: c.prazo_readequacao ? formatarData(c.prazo_readequacao) : '—',
  }
}

// Partículas que ficam por extenso (e somem só no último passo) e finais que andam junto com o último nome
const PARTICULAS = new Set(['de', 'da', 'das', 'do', 'dos', 'e', "d'"])
const FINAIS = new Set(['filho', 'filha', 'júnior', 'junior', 'jr.', 'neto', 'neta', 'sobrinho', 'sobrinha', 'segundo', 'terceiro'])

/**
 * Formas do nome, da completa para a mais curta, como nos documentos brasileiros: os nomes do meio viram
 * iniciais, do último para o primeiro ("Antonio Carlos F. das C. N. de Oliveira" … "Antonio C. F. C. N. Oliveira").
 * O primeiro e o último nome (com Filho, Júnior, Neto…) ficam sempre por extenso.
 */
export function abreviacoesDoNome(nome: string): string[] {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 2) return [partes.join(' ')]
  let fim = partes.length - 1
  if (fim > 1 && FINAIS.has(partes[fim].toLowerCase())) fim--
  const meio = partes.slice(1, fim)
  const formas = [partes.join(' ')]
  const atual = [...meio]
  for (let i = meio.length - 1; i >= 0; i--) {
    if (PARTICULAS.has(meio[i].toLowerCase())) continue
    atual[i] = `${meio[i].charAt(0).toUpperCase()}.`
    formas.push([partes[0], ...atual, ...partes.slice(fim)].join(' '))
  }
  const semParticulas = atual.filter((p) => !PARTICULAS.has(p.toLowerCase()))
  if (semParticulas.length !== atual.length) formas.push([partes[0], ...semParticulas, ...partes.slice(fim)].join(' '))
  return [...new Set(formas)]
}

/** Troca {chave} pelo dado. Chave desconhecida fica como está (assim o erro de digitação aparece). */
export function preencher(texto: string, valores: ValoresCredencial): string {
  return texto.replace(/\{([a-z_]+)\}/g, (inteiro, chave: string) =>
    Object.hasOwn(valores, chave) ? valores[chave as ChaveCampo] : inteiro,
  )
}

/** Dados FICTÍCIOS para a prévia do editor — com nome bem comprido, para conferir se tudo cabe. */
export const DADOS_EXEMPLO: DadosCredencial = {
  pessoa_id: '00000000-0000-0000-0000-000000000000',
  codigo: '0123456789abcdef0123456789abcdef',
  nome: 'Maria Aparecida dos Santos Oliveira Ferreira de Souza',
  cpf: '12345678909',
  nome_pai: 'José Raimundo de Souza Oliveira Ferreira',
  nome_mae: 'Francisca das Chagas dos Santos Oliveira',
  numero_registro: 1234,
  admitido_em: '2021-06-01',
  titulo: 'Pastor(a)',
  funcao: 'Pastor(a) presidente da congregação',
  igreja: 'Igreja Evangélica Assembleia de Deus Ministério de Exemplo em Parauapebas',
  igreja_sigla: 'IEADMEP',
  igreja_cnpj: 'ZZZZZZZZ000100',
  foto_caminho: null,
  foto_publica: null,
  valida_ate: '2029-12-31',
  emitida_em: '2026-11-13T12:00:00-03:00',
  em_dia: true,
  jubilado: false,
  pendencias: [],
  cargo: 'vice_presidente',
  prazo_readequacao: '2027-04-02', // exemplo: 120 dias da ativação em 03/12/2026
}

// ---------------------------------------------------------------------
// Modelo padrão
// ---------------------------------------------------------------------

const VERMELHO_ESCURO = '#7f1d1d'
const VERMELHO = '#b91c1c'
const VERMELHO_CLARO = '#dc2626'
const ROSA = '#fecaca'
const TINTA = '#18181b'
const CINZA = '#71717a'
const CINZA_ESCURO = '#52525b'
const BRANCO = '#ffffff'

const TEXTO: Omit<ElementoTexto, 'id' | 'x' | 'y' | 'w' | 'h' | 'texto'> = {
  tipo: 'texto',
  rotacao: 0,
  tamanho: 7,
  peso: 400,
  cor: TINTA,
  alinhamento: 'esquerda',
  maiusculas: false,
  italico: false,
  espacamento: 0,
  quebrar: false,
  fonte: 'sans',
  opacidade: 1,
  encolher: true,
  minimo: null,
}

const FORMA: Omit<ElementoForma, 'id' | 'x' | 'y' | 'w' | 'h' | 'cor'> = {
  tipo: 'forma',
  rotacao: 0,
  forma: 'retangulo',
  cor2: null,
  angulo: 90,
  raio: 0,
  borda: 0,
  corBorda: TINTA,
  opacidade: 1,
}

function texto(id: string, x: number, y: number, w: number, h: number, conteudo: string, estilo: Partial<ElementoTexto> = {}): ElementoTexto {
  return { ...TEXTO, ...estilo, id, x, y, w, h, texto: conteudo }
}

function forma(id: string, x: number, y: number, w: number, h: number, cor: string, estilo: Partial<ElementoForma> = {}): ElementoForma {
  return { ...FORMA, ...estilo, id, x, y, w, h, cor }
}

const rotulo = (id: string, x: number, y: number, w: number, conteudo: string) =>
  texto(id, x, y, w, 2.3, conteudo, { tamanho: 5, peso: 600, cor: CINZA, maiusculas: true, espacamento: 0.05 })

const dado = (id: string, x: number, y: number, w: number, conteudo: string) =>
  texto(id, x, y, w, 3.4, conteudo, { tamanho: 7.5, peso: 700 })

// Colunas dos dados na frente
const COL_A = 26.2
const COL_B = 55.6
const LARG_A = 27.4
const LARG_B = 26.6

/** Lado com fundo de cor única, sem imagem e sem marca d'água. */
function lado(fundo: string, elementos: Elemento[]): Face {
  return { fundo, fundo2: null, anguloFundo: 90, imagem: null, marca: null, elementos }
}

export const MODELO_PADRAO: ModeloCredencial = {
  versao: 1,
  cartao: { ...CARTAO_PADRAO },
  frente: lado(BRANCO, [
      forma('faixa-topo', 0, 0, LARGURA_MM, 12.8, VERMELHO_ESCURO, { cor2: VERMELHO_CLARO, angulo: 115 }),
      { id: 'logo', tipo: 'imagem', x: 3.4, y: 1.9, w: 9, h: 9, rotacao: 0, arquivo: 'logo', ajuste: 'conter', raio: 1.6, borda: 0.35, corBorda: ROSA, opacidade: 1 },
      texto('conselho', 14.4, 2.2, 48.4, 2.7, 'Conselho de Ministros Evangélicos de Parauapebas', {
        tamanho: 4.8,
        peso: 600,
        cor: BRANCO,
        maiusculas: true,
        espacamento: 0.03,
      }),
      texto('sigla', 14.4, 4.8, 40, 6.4, 'COMEP', { tamanho: 15, peso: 800, cor: BRANCO, espacamento: 0.14 }),
      forma('divisoria', 63.6, 3, 0.3, 6.8, ROSA),
      texto('tipo', 64.8, 3, 18, 6.8, 'Credencial de associado', {
        tamanho: 5.2,
        peso: 700,
        cor: BRANCO,
        alinhamento: 'direita',
        maiusculas: true,
        espacamento: 0.08,
        quebrar: true,
      }),
      { id: 'foto', tipo: 'foto', x: 3.6, y: 15.4, w: 19.5, h: 26, rotacao: 0, raio: 1.2, borda: 0.35, corBorda: VERMELHO },
      texto('nome', COL_A, 14.8, 56, 4.6, '{nome}', { tamanho: 10, peso: 800, maiusculas: true }),
      texto('titulo', COL_A, 19.4, 56, 3.4, '{titulo_funcao}', { tamanho: 7, peso: 700, cor: VERMELHO }),
      rotulo('rotulo-cpf', COL_A, 24.2, LARG_A, 'CPF'),
      dado('cpf', COL_A, 26.4, LARG_A, '{cpf}'),
      rotulo('rotulo-numero', COL_B, 24.2, LARG_B, 'Nº de registro'),
      dado('numero', COL_B, 26.4, LARG_B, '{numero}'),
      rotulo('rotulo-desde', COL_A, 30.8, LARG_A, 'Associado desde'),
      dado('desde', COL_A, 33, LARG_A, '{desde}'),
      rotulo('rotulo-validade', COL_B, 30.8, LARG_B, 'Válida até'),
      dado('validade', COL_B, 33, LARG_B, '{validade}'),
      rotulo('rotulo-igreja', COL_A, 37.4, LARG_A, 'Igreja'),
      dado('igreja', COL_A, 39.6, LARG_A, '{igreja}'),
      rotulo('rotulo-cnpj', COL_B, 37.4, LARG_B, 'CNPJ da igreja'),
      dado('cnpj', COL_B, 39.6, LARG_B, '{cnpj}'),
      forma('rodape', 0, 48.4, LARGURA_MM, 5.58, '#f4f4f5'),
      forma('rodape-linha', 0, 48.4, LARGURA_MM, 0.25, '#e4e4e7'),
      texto('rodape-texto', 3, 49.1, 79.6, 4.2, 'Situação atual: confira pelo QR Code no verso', {
        tamanho: 5.2,
        cor: CINZA_ESCURO,
        alinhamento: 'centro',
      }),
  ]),
  verso: lado(BRANCO, [
      forma('faixa-topo', 0, 0, LARGURA_MM, 2.4, VERMELHO_ESCURO, { cor2: VERMELHO_CLARO, angulo: 90 }),
      { id: 'qr', tipo: 'qr', x: 4.2, y: 5.6, w: 25, h: 25, rotacao: 0, cor: '#000000' },
      texto('qr-legenda', 3.2, 31.2, 27, 5.8, 'Aponte a câmera do celular para conferir a situação atual', {
        tamanho: 4.8,
        cor: CINZA_ESCURO,
        alinhamento: 'centro',
        quebrar: true,
      }),
      rotulo('rotulo-filiacao', 33.6, 5.4, 49, 'Filiação'),
      texto('mae', 33.6, 7.7, 49, 3.3, '{mae}', { tamanho: 7, peso: 700 }),
      texto('pai', 33.6, 11, 49, 3.3, '{pai}', { tamanho: 7, peso: 700 }),
      texto('texto-verso', 33.6, 15.4, 49, 18.4, '{texto_verso}', { tamanho: 5.4, cor: '#3f3f46', quebrar: true }),
      forma('assinatura-linha', 40, 39.6, 35, 0.25, CINZA_ESCURO),
      texto('assinatura', 33.6, 40.2, 49, 2.9, 'Presidente do COMEP', { tamanho: 5.2, cor: CINZA_ESCURO, alinhamento: 'centro' }),
      forma('rodape', 0, 48.4, LARGURA_MM, 5.58, VERMELHO_ESCURO, { cor2: VERMELHO, angulo: 90 }),
      texto('rodape-texto', 3, 49.1, 79.6, 4.2, 'COMEP · Parauapebas/PA · Nº {numero} · Emitida em {emissao}', {
        tamanho: 5.2,
        peso: 600,
        cor: BRANCO,
        alinhamento: 'centro',
        espacamento: 0.02,
      }),
  ]),
}

// ---------------------------------------------------------------------
// Conferência do modelo (vindo do banco ou do editor): o que não presta é corrigido ou descartado
// ---------------------------------------------------------------------

const COR = /^#[0-9a-f]{6}$/i
const ID = /^[a-z0-9-]{1,40}$/i
/** Logo do sistema, logotipo da denominação de cada pessoa ou imagem enviada no editor (pasta pública "credencial-modelo") */
const ARQUIVO = /^(logo|denominacao|[0-9a-f-]{36}\.(png|jpg|webp))$/
/** Imagem de fundo: só a enviada no editor */
const ARQUIVO_FUNDO = /^[0-9a-f-]{36}\.(png|jpg|webp)$/

type Bruto = Record<string, unknown>

const ehObjeto = (v: unknown): v is Bruto => typeof v === 'object' && v !== null && !Array.isArray(v)

function num(v: unknown, min: number, max: number, padrao: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : padrao
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100))
}

function cor(v: unknown, padrao: string): string {
  return typeof v === 'string' && COR.test(v) ? v.toLowerCase() : padrao
}

function opcao<T extends string | number>(v: unknown, opcoes: readonly T[], padrao: T): T {
  return opcoes.includes(v as T) ? (v as T) : padrao
}

const sim = (v: unknown, padrao: boolean) => (typeof v === 'boolean' ? v : padrao)

/** O cartão de um modelo (o modelo antigo, sem o tamanho, é o CR80). */
export function cartaoDe(m: { cartao?: Cartao }): Cartao {
  return m.cartao ?? CARTAO_PADRAO
}

/** Limites de posição e tamanho (mm) para um tamanho de cartão: os mesmos no editor e na conferência. */
export function limitesDo(c: Cartao) {
  return {
    x: [-20, c.largura],
    y: [-20, c.altura],
    w: [0.2, Math.max(120, c.largura * 1.4)],
    h: [0.2, Math.max(80, c.altura * 1.4)],
  } as const
}

/** Limites do cartão padrão (CR80). */
export const LIMITES = limitesDo(CARTAO_PADRAO)

/** Põe a posição e o tamanho dentro dos limites (o editor usa ao arrastar). */
export function limitarCaixa<T extends { x: number; y: number; w: number; h: number }>(e: T, c: Cartao = CARTAO_PADRAO): T {
  const l = limitesDo(c)
  return {
    ...e,
    x: num(e.x, l.x[0], l.x[1], 0),
    y: num(e.y, l.y[0], l.y[1], 0),
    w: num(e.w, l.w[0], l.w[1], 10),
    h: num(e.h, l.h[0], l.h[1], 5),
  }
}

function caixa(b: Bruto, id: string, c: Cartao): Caixa {
  return {
    ...limitarCaixa({ id, x: b.x as number, y: b.y as number, w: b.w as number, h: b.h as number }, c),
    rotacao: num(b.rotacao, -180, 180, 0),
  }
}

function elemento(b: Bruto, id: string, c: Cartao): Elemento | null {
  const base = caixa(b, id, c)
  switch (b.tipo) {
    case 'texto':
      return {
        ...base,
        tipo: 'texto',
        texto: typeof b.texto === 'string' ? b.texto.slice(0, 400) : '',
        tamanho: num(b.tamanho, 3, 40, TEXTO.tamanho),
        peso: opcao(b.peso, [400, 600, 700, 800] as const, 400),
        cor: cor(b.cor, TINTA),
        alinhamento: opcao(b.alinhamento, ['esquerda', 'centro', 'direita'] as const, 'esquerda'),
        maiusculas: sim(b.maiusculas, false),
        italico: sim(b.italico, false),
        espacamento: num(b.espacamento, -0.1, 0.6, 0),
        quebrar: sim(b.quebrar, false),
        fonte: opcao(b.fonte, ['sans', 'serif', 'inter', 'jakarta'] as const, 'sans'),
        opacidade: num(b.opacidade, 0, 1, 1),
        encolher: sim(b.encolher, true),
        minimo: b.minimo === null || b.minimo === undefined ? null : num(b.minimo, 2, 40, 3),
      }
    case 'forma':
      return {
        ...base,
        tipo: 'forma',
        forma: opcao(b.forma, ['retangulo', 'elipse'] as const, 'retangulo'),
        cor: cor(b.cor, TINTA),
        cor2: b.cor2 === null || b.cor2 === undefined ? null : cor(b.cor2, TINTA),
        angulo: num(b.angulo, -360, 360, 90),
        raio: num(b.raio, 0, 30, 0),
        borda: num(b.borda, 0, 5, 0),
        corBorda: cor(b.corBorda, TINTA),
        opacidade: num(b.opacidade, 0, 1, 1),
      }
    case 'foto':
      return { ...base, tipo: 'foto', raio: num(b.raio, 0, 30, 0), borda: num(b.borda, 0, 5, 0), corBorda: cor(b.corBorda, TINTA) }
    case 'qr':
      return { ...base, tipo: 'qr', cor: cor(b.cor, '#000000') }
    case 'imagem':
      return {
        ...base,
        tipo: 'imagem',
        arquivo: typeof b.arquivo === 'string' && ARQUIVO.test(b.arquivo) ? b.arquivo : 'logo',
        ajuste: opcao(b.ajuste, ['conter', 'cobrir'] as const, 'conter'),
        raio: num(b.raio, 0, 30, 0),
        borda: num(b.borda, 0, 5, 0),
        corBorda: cor(b.corBorda, TINTA),
        opacidade: num(b.opacidade, 0, 1, 1),
      }
    case 'simbolo':
      return {
        ...base,
        tipo: 'simbolo',
        simbolo: ehSimbolo(b.simbolo) ? b.simbolo : 'cruz',
        cor: cor(b.cor, TINTA),
        traco: num(b.traco, 0.5, 4, 1.8),
        opacidade: num(b.opacidade, 0, 1, 1),
      }
    case 'faixa':
      return {
        ...base,
        tipo: 'faixa',
        texto: typeof b.texto === 'string' ? b.texto.slice(0, 120) : '',
        cor: cor(b.cor, FAIXA.cor),
        cor2: cor(b.cor2, FAIXA.cor2),
        corTexto: cor(b.corTexto, FAIXA.corTexto),
        tamanho: num(b.tamanho, 3, 20, FAIXA.tamanho),
      }
    default:
      return null
  }
}

function face(bruto: unknown, padrao: Face, c: Cartao): Face {
  if (!ehObjeto(bruto) || !Array.isArray(bruto.elementos)) return structuredClone(padrao)
  const usados = new Set<string>()
  const elementos: Elemento[] = []
  for (const [i, item] of bruto.elementos.entries()) {
    if (elementos.length >= MAXIMO_ELEMENTOS) break
    if (!ehObjeto(item)) continue
    let id = typeof item.id === 'string' && ID.test(item.id) ? item.id : `item-${i + 1}`
    // repetido: ganha outro nome; o contador sempre cresce, então o laço sempre termina
    for (let n = 1; usados.has(id); n++) id = `item-${i + 1}-${n}`
    const e = elemento(item, id, c)
    if (e) {
      usados.add(id)
      elementos.push(e)
    }
  }
  const marca: MarcaDagua | null = ehObjeto(bruto.marca)
    ? {
        simbolo: ehSimbolo(bruto.marca.simbolo) ? bruto.marca.simbolo : 'comep',
        opacidade: num(bruto.marca.opacidade, 0.02, 0.5, 0.08),
        cor: cor(bruto.marca.cor, TINTA),
      }
    : null
  return {
    fundo: cor(bruto.fundo, BRANCO),
    fundo2: bruto.fundo2 === null || bruto.fundo2 === undefined ? null : cor(bruto.fundo2, BRANCO),
    anguloFundo: num(bruto.anguloFundo, -360, 360, 90),
    imagem: typeof bruto.imagem === 'string' && ARQUIVO_FUNDO.test(bruto.imagem) ? bruto.imagem : null,
    marca,
    elementos,
  }
}

function cartao(bruto: unknown): Cartao {
  if (!ehObjeto(bruto)) return { ...CARTAO_PADRAO }
  return {
    largura: num(bruto.largura, 30, 150, LARGURA_MM),
    altura: num(bruto.altura, 30, 150, ALTURA_MM),
    cantos: num(bruto.cantos, 0, 6, 0),
    sangria: num(bruto.sangria, 0, 5, 2),
    seguranca: num(bruto.seguranca, 0, 10, 3),
  }
}

/**
 * Modelo pronto para desenhar: confere tudo e põe limites. Sem modelo (ou inválido): o de partida
 * (o padrão do sistema, ou o da readequação para o modelo de readequação).
 */
export function normalizarModelo(bruto: unknown, padrao: ModeloCredencial = MODELO_PADRAO): ModeloCredencial {
  if (!ehObjeto(bruto) || bruto.versao !== 1) return structuredClone(padrao)
  const c = cartao(bruto.cartao)
  return { versao: 1, cartao: c, frente: face(bruto.frente, padrao.frente, c), verso: face(bruto.verso, padrao.verso, c) }
}

/** O desenho de um modelo do banco: o salvo, ou (vazio) o do sistema para o tipo. */
export function desenhoDoModelo(tipo: TipoModelo | undefined, desenho: unknown): ModeloCredencial {
  return normalizarModelo(desenho, tipo === 'readequacao' ? MODELO_READEQUACAO : MODELO_PADRAO)
}

/** O desenho da credencial de uma pessoa: o do modelo dela (vazio = o do sistema para o tipo do modelo). */
export function modeloDaCredencial(pacote: Pick<PacoteCredenciais, 'modelo' | 'modelos'>, c: Pick<DadosCredencial, 'modelo_id'>): ModeloCredencial {
  const m = c.modelo_id ? pacote.modelos?.[c.modelo_id] : undefined
  return m ? desenhoDoModelo(m.tipo, m.desenho) : normalizarModelo(pacote.modelo)
}

// ---------------------------------------------------------------------
// Unidades para a tela: tudo proporcional à largura do cartão ("cqi" = 1% da largura)
// ---------------------------------------------------------------------

/** mm do cartão → unidade CSS proporcional à largura do cartão */
export function cqi(mm: number, largura: number = LARGURA_MM): string {
  return `${Math.round((mm * 100_000) / largura) / 1000}cqi`
}

/** tamanho da letra (pt) → unidade CSS proporcional */
export function cqiDaLetra(pt: number, largura: number = LARGURA_MM): string {
  return cqi(pt * PT_EM_MM, largura)
}

// ---------------------------------------------------------------------
// Editor (Fase 3.4; tela inteira na Fase 5.5): itens novos, nomes para a lista e a conferência antes de salvar
// ---------------------------------------------------------------------

export type ItemNovo = 'texto' | 'dado' | 'foto' | 'qr' | 'imagem' | 'retangulo' | 'circulo' | 'linha' | 'faixa' | 'simbolo'

export const ITENS_NOVOS: readonly { tipo: ItemNovo; rotulo: string }[] = [
  { tipo: 'texto', rotulo: 'Texto' },
  { tipo: 'dado', rotulo: 'Dado do associado' },
  { tipo: 'foto', rotulo: 'Foto' },
  { tipo: 'qr', rotulo: 'QR Code' },
  { tipo: 'imagem', rotulo: 'Imagem ou logo' },
  { tipo: 'retangulo', rotulo: 'Retângulo' },
  { tipo: 'circulo', rotulo: 'Círculo' },
  { tipo: 'linha', rotulo: 'Linha' },
  { tipo: 'faixa', rotulo: 'Faixa de aviso' },
  { tipo: 'simbolo', rotulo: 'Símbolo' },
]

/** Item novo, no meio do cartão, pronto para mover. */
export function novoElemento(tipo: ItemNovo, id: string): Elemento {
  switch (tipo) {
    case 'texto':
      return texto(id, 30, 24, 30, 4, 'Texto novo', { tamanho: 7 })
    case 'dado':
      return texto(id, 30, 24, 30, 4, '{nome}', { tamanho: 7.5, peso: 700 })
    case 'foto':
      return { id, tipo: 'foto', x: 33, y: 14, w: 19.5, h: 26, rotacao: 0, raio: 1.2, borda: 0.35, corBorda: VERMELHO }
    case 'qr':
      return { id, tipo: 'qr', x: 31, y: 14, w: 24, h: 24, rotacao: 0, cor: '#000000' }
    case 'imagem':
      return { id, tipo: 'imagem', x: 36, y: 20, w: 14, h: 14, rotacao: 0, arquivo: 'logo', ajuste: 'conter', raio: 0, borda: 0, corBorda: TINTA, opacidade: 1 }
    case 'retangulo':
      return forma(id, 30, 20, 26, 14, VERMELHO)
    case 'circulo':
      return forma(id, 36, 20, 14, 14, VERMELHO, { forma: 'elipse' })
    case 'linha':
      return forma(id, 25, 27, 36, 0.3, CINZA_ESCURO)
    case 'faixa':
      return { ...FAIXA, id, x: 0, y: 23, w: LARGURA_MM, h: 7 }
    case 'simbolo':
      return { id, tipo: 'simbolo', x: 37, y: 21, w: 12, h: 12, rotacao: 0, simbolo: 'chama', cor: VERMELHO, traco: 1.8, opacidade: 1 }
  }
}

export type PosicaoFaixa = 'rodape' | 'topo' | 'esquerda' | 'direita'

/** Leva a faixa para um lado do cartão (no editor, "onde vai a faixa"), com a espessura dada (mm). */
export function posicionarFaixa<T extends Caixa>(e: T, posicao: PosicaoFaixa, c: Cartao, espessura = 7): T {
  switch (posicao) {
    case 'rodape':
      return { ...e, x: 0, y: Math.round((c.altura - espessura) * 100) / 100, w: c.largura, h: espessura, rotacao: 0 }
    case 'topo':
      return { ...e, x: 0, y: 0, w: c.largura, h: espessura, rotacao: 0 }
    case 'esquerda':
      return { ...e, x: 0, y: 0, w: espessura, h: c.altura, rotacao: 0 }
    case 'direita':
      return { ...e, x: Math.round((c.largura - espessura) * 100) / 100, y: 0, w: espessura, h: c.altura, rotacao: 0 }
  }
}

/** Onde a faixa está (para marcar o botão no editor); null = solta no meio. */
export function posicaoDaFaixa(e: Caixa, c: Cartao): PosicaoFaixa | null {
  const perto = (a: number, b: number) => Math.abs(a - b) < 0.3
  if (e.w >= c.largura - 0.3 && perto(e.x, 0)) {
    if (perto(e.y, 0)) return 'topo'
    if (perto(e.y + e.h, c.altura)) return 'rodape'
  }
  if (e.h >= c.altura - 0.3 && perto(e.y, 0)) {
    if (perto(e.x, 0)) return 'esquerda'
    if (perto(e.x + e.w, c.largura)) return 'direita'
  }
  return null
}

/** Nome do item na lista do editor. */
export function nomeDoElemento(e: Elemento): string {
  switch (e.tipo) {
    case 'texto': {
      // os dados aparecem pelo nome: {cnpj} → [CNPJ da igreja]
      const t = e.texto
        .replace(/\{([a-z_]+)\}/g, (inteiro, chave: string) => {
          const campo = CAMPOS.find((c) => c.chave === chave)
          return campo ? `[${campo.rotulo}]` : inteiro
        })
        .replace(/\s+/g, ' ')
        .trim()
      return t ? `“${t.length > 40 ? `${t.slice(0, 39)}…` : t}”` : 'Texto vazio'
    }
    case 'forma':
      if (e.forma === 'elipse') return 'Círculo'
      return e.h <= 0.6 || e.w <= 0.6 ? 'Linha' : 'Retângulo'
    case 'foto':
      return 'Foto do associado'
    case 'qr':
      return 'QR Code'
    case 'imagem':
      return e.arquivo === 'logo' ? 'Logo do sistema' : e.arquivo === 'denominacao' ? 'Logotipo da denominação' : 'Imagem enviada'
    case 'faixa':
      return 'Faixa de aviso'
    case 'simbolo':
      return `Símbolo: ${SIMBOLOS[e.simbolo].nome}`
  }
}

// ---------------------------------------------------------------------
// As regras do modelo (rodada 11): o que é obrigatório (não sai), o que é padrão (vem pronto, muda de lugar e de cor)
// e o que é opcional (à vontade). O verso é onde se personaliza à vontade.
// ---------------------------------------------------------------------

export type Papel = 'obrigatorio' | 'padrao' | 'opcional'

/** Os obrigatórios: cada um precisa aparecer pelo menos uma vez (na frente ou no verso). */
export const OBRIGATORIOS = [
  { chave: 'nome', nome: 'Nome' },
  { chave: 'numero', nome: 'Nº de registro' },
  { chave: 'validade', nome: 'Validade' },
  { chave: 'qr', nome: 'QR Code de conferência' },
  { chave: 'foto', nome: 'Foto 3×4' },
  { chave: 'comep', nome: 'Nome e símbolo do COMEP' },
] as const

export const PADRAO_ITENS = ['Faixa do alto', 'Título ou cargo', 'Igreja', 'Assinatura do presidente', 'Texto do verso'] as const
export const OPCIONAIS_ITENS = ['Símbolos', 'Logotipo da denominação', "Fundo e marca d'água", 'Textos livres e versículo', 'Faixa de aviso'] as const

export type ChaveObrigatorio = (typeof OBRIGATORIOS)[number]['chave']

/** De qual obrigatório o item é (null: não é obrigatório). */
export function obrigatorioDo(e: Elemento): ChaveObrigatorio | null {
  if (e.tipo === 'qr') return 'qr'
  if (e.tipo === 'foto') return 'foto'
  if (e.tipo === 'imagem' && e.arquivo === 'logo') return 'comep'
  if (e.tipo !== 'texto') return null
  if (e.texto.includes('{nome}')) return 'nome'
  if (e.texto.includes('{numero}')) return 'numero'
  if (e.texto.includes('{validade}')) return 'validade'
  if (/\bCOMEP\b/.test(e.texto) && !e.texto.includes('{')) return 'comep'
  return null
}

/** O papel do item nas regras do modelo. */
export function papelDoItem(e: Elemento): Papel {
  if (obrigatorioDo(e)) return 'obrigatorio'
  if (e.tipo === 'forma' && (e.id === 'faixa-topo' || e.id === 'rodape' || e.id.startsWith('assinatura'))) return 'padrao'
  if (e.tipo === 'texto' && /\{(titulo|titulo_funcao|funcao|cargo|igreja|igreja_nome|cnpj|texto_verso)\}|Presidente do COMEP/.test(e.texto)) return 'padrao'
  return 'opcional'
}

/** Os obrigatórios que faltam no modelo. */
export function obrigatoriosQueFaltam(m: ModeloCredencial): ChaveObrigatorio[] {
  const tem = new Set([...m.frente.elementos, ...m.verso.elementos].map(obrigatorioDo))
  return OBRIGATORIOS.filter((o) => !tem.has(o.chave)).map((o) => o.chave)
}

/** O item pode sair? O obrigatório só sai se houver outro do mesmo tipo (na frente ou no verso). */
export function podeTirar(m: ModeloCredencial, e: Elemento): boolean {
  const qual = obrigatorioDo(e)
  if (!qual) return true
  return [...m.frente.elementos, ...m.verso.elementos].some((x) => x !== e && obrigatorioDo(x) === qual)
}

const CHAVES = new Set<string>(CAMPOS.map((c) => c.chave))
const NOME_DO_LADO: Record<Lado, string> = { frente: 'Frente', verso: 'Verso' }

/** Id novo, que ainda não existe na lista (dois cliques no mesmo instante não repetem). */
export function novoId(existentes: readonly { id: string }[]): string {
  const usados = new Set(existentes.map((e) => e.id))
  let id = ''
  do id = `item-${Math.random().toString(36).slice(2, 10)}`
  while (usados.has(id))
  return id
}

/** O que pode dar problema na credencial com este modelo (não impede salvar). */
export function conferirModelo(m: ModeloCredencial): string[] {
  const avisos: string[] = []
  const c = cartaoDe(m)
  const todos = [...m.frente.elementos, ...m.verso.elementos]
  const textos = todos.filter((e): e is ElementoTexto => e.tipo === 'texto')
  const usa = (chave: ChaveCampo) => textos.some((e) => e.texto.includes(`{${chave}}`))

  for (const lado of ['frente', 'verso'] as const) {
    for (const e of m[lado].elementos) {
      if (e.x < -0.05 || e.y < -0.05 || e.x + e.w > c.largura + 0.05 || e.y + e.h > c.altura + 0.05) {
        avisos.push(`${NOME_DO_LADO[lado]}: ${nomeDoElemento(e)} passa da borda do cartão (a parte de fora não aparece).`)
      }
      if (e.tipo === 'texto') {
        for (const [, chave] of e.texto.matchAll(/\{([a-z_]+)\}/g)) {
          if (!CHAVES.has(chave)) avisos.push(`${NOME_DO_LADO[lado]}: o texto tem {${chave}}, que não é um dado conhecido.`)
        }
      }
      if (e.tipo === 'qr' && Math.min(e.w, e.h) < 15) {
        avisos.push(`${NOME_DO_LADO[lado]}: o QR Code tem menos de 15 mm e pode não ser lido pela câmera.`)
      }
    }
  }
  if (!todos.some((e) => e.tipo === 'qr')) avisos.push('Nenhum lado tem o QR Code: não dá para conferir a credencial.')
  if (!todos.some((e) => e.tipo === 'foto')) avisos.push('A foto do associado não aparece.')
  if (!usa('nome')) avisos.push('O nome do associado não aparece.')
  if (!usa('validade')) avisos.push('A validade ("Válida até") não aparece: a credencial impressa precisa dela.')
  if (!usa('numero')) avisos.push('O nº de registro não aparece.')
  if (!todos.some((e) => obrigatorioDo(e) === 'comep')) avisos.push('O nome ou o símbolo do COMEP não aparece.')
  return avisos
}

// ---------------------------------------------------------------------
// O modelo do ministro em readequação (rodada 12, opção 1): cinza, com a faixa de aviso no rodapé.
// Categoria mais baixa: mostra a igreja sem registro e o prazo. NUNCA a frase "não representa o COMEP"
// (o estatuto deixa a diretoria escolher um ministro para representar o conselho).
// ---------------------------------------------------------------------

const CINZA_TOPO = '#52525b'
const CINZA_TOPO_2 = '#3f3f46'

/** A faixa de aviso: listras pretas e amarelas, com o texto no meio. */
const FAIXA: Omit<ElementoFaixa, 'id' | 'x' | 'y' | 'w' | 'h'> = {
  tipo: 'faixa',
  rotacao: 0,
  texto: 'Em readequação · sem direito a voto',
  cor: '#18181b',
  cor2: '#f59e0b',
  corTexto: '#18181b',
  tamanho: 5.6,
}

export const MODELO_READEQUACAO: ModeloCredencial = {
  versao: 1,
  cartao: { ...CARTAO_PADRAO },
  frente: lado(BRANCO, [
    forma('faixa-topo', 0, 0, LARGURA_MM, 11.4, CINZA_TOPO_2, { cor2: CINZA_TOPO, angulo: 115 }),
    { id: 'logo', tipo: 'imagem', x: 3.4, y: 1.6, w: 8.2, h: 8.2, rotacao: 0, arquivo: 'logo', ajuste: 'conter', raio: 1.4, borda: 0.3, corBorda: '#d4d4d8', opacidade: 1 },
    texto('sigla', 13.6, 1.6, 40, 5, 'COMEP', { tamanho: 11, peso: 800, cor: BRANCO, espacamento: 0.12 }),
    texto('conselho', 13.6, 6.4, 50, 2.8, 'Conselho de Ministros Evangélicos de Parauapebas', { tamanho: 4.6, peso: 600, cor: BRANCO }),
    { id: 'foto', tipo: 'foto', x: 3.6, y: 14.4, w: 18, h: 24, rotacao: 0, raio: 1.2, borda: 0.35, corBorda: '#a1a1aa' },
    texto('nome', 24.6, 15, 39, 4.6, '{nome}', { tamanho: 9.5, peso: 800 }),
    texto('categoria', 24.6, 20.2, 39, 3.4, 'Ministro em readequação', { tamanho: 6.6, peso: 700, cor: '#3f3f46' }),
    texto('igreja', 24.6, 24, 39, 3, '{igreja} · sem registro', { tamanho: 5.6, cor: CINZA_ESCURO }),
    texto('numero', 24.6, 27.4, 39, 3, 'Nº {numero} · prazo até {prazo}', { tamanho: 5.6, cor: CINZA_ESCURO }),
    texto('validade', 24.6, 30.8, 39, 3, 'Válida até {validade}', { tamanho: 5.6, cor: CINZA_ESCURO }),
    { id: 'qr', tipo: 'qr', x: 66, y: 15, w: 16.4, h: 16.4, rotacao: 0, cor: '#000000' },
    { ...FAIXA, id: 'faixa', x: 0, y: 46.98, w: LARGURA_MM, h: 7 },
  ]),
  verso: lado(BRANCO, [
    forma('faixa-topo', 0, 0, LARGURA_MM, 2.4, CINZA_TOPO_2, { cor2: CINZA_TOPO, angulo: 90 }),
    rotulo('rotulo-cpf', 4, 5.4, 36, 'CPF'),
    dado('cpf', 4, 7.6, 36, '{cpf}'),
    rotulo('rotulo-filiacao', 4, 12, 78, 'Filiação'),
    texto('mae', 4, 14.3, 78, 3.3, '{mae}', { tamanho: 7, peso: 700 }),
    texto('pai', 4, 17.6, 78, 3.3, '{pai}', { tamanho: 7, peso: 700 }),
    texto('texto-verso', 4, 22.4, 78, 14, '{texto_verso}', { tamanho: 5.4, cor: '#3f3f46', quebrar: true }),
    forma('assinatura-linha', 25, 41.2, 35, 0.25, CINZA_ESCURO),
    texto('assinatura', 4, 41.8, 78, 2.9, 'Presidente do COMEP', { tamanho: 5.2, cor: CINZA_ESCURO, alinhamento: 'centro' }),
    forma('rodape', 0, 48.4, LARGURA_MM, 5.58, CINZA_TOPO_2, { cor2: CINZA_TOPO, angulo: 90 }),
    texto('rodape-texto', 3, 49.1, 79.6, 4.2, 'COMEP · Parauapebas/PA · Nº {numero} · Emitida em {emissao}', {
      tamanho: 5.2,
      peso: 600,
      cor: BRANCO,
      alinhamento: 'centro',
    }),
  ]),
}

// ---------------------------------------------------------------------
// Modelos prontos (rodada 8, "Começar de um modelo pronto"): o desenho padrão com outras cores, e o "em branco"
// ---------------------------------------------------------------------

type Paleta = { escuro: string; claro: string; destaque: string; suave: string; marca?: boolean }

function recolorir(base: ModeloCredencial, p: Paleta): ModeloCredencial {
  const m = structuredClone(base)
  const pintar = (e: Elemento): Elemento => {
    if (e.id === 'faixa-topo' && e.tipo === 'forma') return { ...e, cor: p.escuro, cor2: p.claro }
    if (e.id === 'rodape' && e.tipo === 'forma' && e.cor2 !== null) return { ...e, cor: p.escuro, cor2: p.destaque }
    if (e.id === 'logo' && e.tipo === 'imagem') return { ...e, corBorda: p.suave }
    if (e.id === 'divisoria' && e.tipo === 'forma') return { ...e, cor: p.suave }
    if (e.id === 'foto' && e.tipo === 'foto') return { ...e, corBorda: p.destaque }
    if (e.id === 'titulo' && e.tipo === 'texto') return { ...e, cor: p.destaque }
    return e
  }
  m.frente.elementos = m.frente.elementos.map(pintar)
  m.verso.elementos = m.verso.elementos.map(pintar)
  if (p.marca) m.frente.marca = { simbolo: 'comep', opacidade: 0.06, cor: p.escuro }
  return m
}

/** Em branco: só o que não pode faltar (o nome e o símbolo do COMEP, a foto, o nome, o nº, a validade e o QR Code). */
export const MODELO_EM_BRANCO: ModeloCredencial = {
  versao: 1,
  cartao: { ...CARTAO_PADRAO },
  frente: lado(BRANCO, [
    { id: 'logo', tipo: 'imagem', x: 4, y: 3.6, w: 7, h: 7, rotacao: 0, arquivo: 'logo', ajuste: 'conter', raio: 0, borda: 0, corBorda: TINTA, opacidade: 1 },
    texto('sigla', 12.6, 4.4, 40, 5, 'COMEP', { tamanho: 10, peso: 800, espacamento: 0.1 }),
    { id: 'foto', tipo: 'foto', x: 4, y: 15, w: 19.5, h: 26, rotacao: 0, raio: 1, borda: 0.3, corBorda: '#a1a1aa' },
    texto('nome', 27, 17, 55, 4.6, '{nome}', { tamanho: 10, peso: 800 }),
    texto('numero', 27, 23, 55, 3.4, 'Nº {numero}', { tamanho: 7 }),
    texto('validade', 27, 27, 55, 3.4, 'Válida até {validade}', { tamanho: 7 }),
  ]),
  verso: lado(BRANCO, [{ id: 'qr', tipo: 'qr', x: 30.3, y: 14.5, w: 25, h: 25, rotacao: 0, cor: '#000000' }]),
}

export const PRONTOS: readonly { chave: string; nome: string; modelo: ModeloCredencial }[] = [
  { chave: 'vermelho', nome: 'Clássico vermelho', modelo: MODELO_PADRAO },
  { chave: 'grafite', nome: 'Grafite e dourado', modelo: recolorir(MODELO_PADRAO, { escuro: '#18181b', claro: '#3f3f46', destaque: '#b45309', suave: '#fbbf24' }) },
  { chave: 'azul', nome: 'Azul institucional', modelo: recolorir(MODELO_PADRAO, { escuro: '#1e3a8a', claro: '#2563eb', destaque: '#1d4ed8', suave: '#bfdbfe' }) },
  {
    chave: 'vinho',
    nome: 'Vinho com selo',
    modelo: recolorir(MODELO_PADRAO, { escuro: '#4c0519', claro: '#9f1239', destaque: '#881337', suave: '#fecdd3', marca: true }),
  },
  { chave: 'branco', nome: 'Em branco', modelo: MODELO_EM_BRANCO },
]
