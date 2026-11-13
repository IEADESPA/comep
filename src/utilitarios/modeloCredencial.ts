// Modelo (desenho) da credencial: o que vai em cada lado, onde fica e como aparece.
// Medidas em MILÍMETROS no cartão CR80 (85,6 × 53,98 mm); letras em PONTOS (pt), como nos editores de texto.
// O mesmo modelo desenha a credencial digital (tela) e a impressa (tamanho real).
// Cada item tem a sua caixa fixa: um texto comprido diminui a letra para caber, nunca empurra nem corta os outros.
// Fase 3.4: a secretaria muda o modelo no editor; sem modelo salvo, vale o MODELO_PADRAO.
import type { DadosCredencial } from '../dados/credencial'
import { formatarCnpj, formatarCpf, formatarData, formatarDataDeInstante } from './formatos.ts'

export const LARGURA_MM = 85.6
export const ALTURA_MM = 53.98
/** 1 pt = 1/72 polegada */
export const PT_EM_MM = 25.4 / 72
export const MAXIMO_ELEMENTOS = 60

export type Lado = 'frente' | 'verso'
export type Alinhamento = 'esquerda' | 'centro' | 'direita'
export type Peso = 400 | 600 | 700 | 800

type Caixa = { id: string; x: number; y: number; w: number; h: number }

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
  fonte: 'sans' | 'serif'
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
  /** 'logo' (o logo do sistema) ou o arquivo enviado no editor */
  arquivo: string
  ajuste: 'conter' | 'cobrir'
  raio: number
  borda: number
  corBorda: string
  opacidade: number
}

export type Elemento = ElementoTexto | ElementoForma | ElementoFoto | ElementoQr | ElementoImagem
export type TipoElemento = Elemento['tipo']
export type Face = { fundo: string; elementos: Elemento[] }
export type ModeloCredencial = { versao: 1; frente: Face; verso: Face }

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
  { chave: 'texto_verso', rotulo: 'Texto do verso (Configurações)' },
] as const

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
  }
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
  tamanho: 7,
  peso: 400,
  cor: TINTA,
  alinhamento: 'esquerda',
  maiusculas: false,
  italico: false,
  espacamento: 0,
  quebrar: false,
  fonte: 'sans',
}

const FORMA: Omit<ElementoForma, 'id' | 'x' | 'y' | 'w' | 'h' | 'cor'> = {
  tipo: 'forma',
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

export const MODELO_PADRAO: ModeloCredencial = {
  versao: 1,
  frente: {
    fundo: BRANCO,
    elementos: [
      forma('faixa-topo', 0, 0, LARGURA_MM, 12.8, VERMELHO_ESCURO, { cor2: VERMELHO_CLARO, angulo: 115 }),
      { id: 'logo', tipo: 'imagem', x: 3.4, y: 1.9, w: 9, h: 9, arquivo: 'logo', ajuste: 'conter', raio: 1.6, borda: 0.35, corBorda: ROSA, opacidade: 1 },
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
      { id: 'foto', tipo: 'foto', x: 3.6, y: 15.4, w: 19.5, h: 26, raio: 1.2, borda: 0.35, corBorda: VERMELHO },
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
    ],
  },
  verso: {
    fundo: BRANCO,
    elementos: [
      forma('faixa-topo', 0, 0, LARGURA_MM, 2.4, VERMELHO_ESCURO, { cor2: VERMELHO_CLARO, angulo: 90 }),
      { id: 'qr', tipo: 'qr', x: 4.2, y: 5.6, w: 25, h: 25, cor: '#000000' },
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
    ],
  },
}

// ---------------------------------------------------------------------
// Conferência do modelo (vindo do banco ou do editor): o que não presta é corrigido ou descartado
// ---------------------------------------------------------------------

const COR = /^#[0-9a-f]{6}$/i
const ID = /^[a-z0-9-]{1,40}$/i
/** Logo do sistema ou imagem enviada no editor (pasta pública "credencial-modelo", nome aleatório) */
const ARQUIVO = /^(logo|[0-9a-f-]{36}\.(png|jpg|webp))$/

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

function caixa(b: Bruto, id: string): Caixa {
  return {
    id,
    x: num(b.x, -20, LARGURA_MM, 0),
    y: num(b.y, -20, ALTURA_MM, 0),
    w: num(b.w, 0.2, 120, 10),
    h: num(b.h, 0.2, 80, 5),
  }
}

function elemento(b: Bruto, id: string): Elemento | null {
  const base = caixa(b, id)
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
        fonte: opcao(b.fonte, ['sans', 'serif'] as const, 'sans'),
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
    default:
      return null
  }
}

function face(bruto: unknown, padrao: Face): Face {
  if (!ehObjeto(bruto) || !Array.isArray(bruto.elementos)) return structuredClone(padrao)
  const usados = new Set<string>()
  const elementos: Elemento[] = []
  for (const [i, item] of bruto.elementos.entries()) {
    if (elementos.length >= MAXIMO_ELEMENTOS) break
    if (!ehObjeto(item)) continue
    let id = typeof item.id === 'string' && ID.test(item.id) ? item.id : `item-${i + 1}`
    while (usados.has(id)) id = `${id}-${i + 1}`.slice(-40)
    const e = elemento(item, id)
    if (e) {
      usados.add(id)
      elementos.push(e)
    }
  }
  return { fundo: cor(bruto.fundo, BRANCO), elementos }
}

/** Modelo pronto para desenhar: confere tudo e põe limites. Sem modelo (ou inválido): o padrão. */
export function normalizarModelo(bruto: unknown): ModeloCredencial {
  if (!ehObjeto(bruto) || bruto.versao !== 1) return structuredClone(MODELO_PADRAO)
  return { versao: 1, frente: face(bruto.frente, MODELO_PADRAO.frente), verso: face(bruto.verso, MODELO_PADRAO.verso) }
}

// ---------------------------------------------------------------------
// Unidades para a tela: tudo proporcional à largura do cartão ("cqi" = 1% da largura)
// ---------------------------------------------------------------------

/** mm do cartão → unidade CSS proporcional à largura do cartão */
export function cqi(mm: number): string {
  return `${Math.round((mm * 100_000) / LARGURA_MM) / 1000}cqi`
}

/** tamanho da letra (pt) → unidade CSS proporcional */
export function cqiDaLetra(pt: number): string {
  return cqi(pt * PT_EM_MM)
}

// ---------------------------------------------------------------------
// Editor (Fase 3.4): itens novos, nomes para a lista e a conferência antes de salvar
// ---------------------------------------------------------------------

export type ItemNovo = 'texto' | 'dado' | 'foto' | 'qr' | 'imagem' | 'retangulo' | 'circulo' | 'linha'

export const ITENS_NOVOS: readonly { tipo: ItemNovo; rotulo: string }[] = [
  { tipo: 'texto', rotulo: 'Texto' },
  { tipo: 'dado', rotulo: 'Dado do associado' },
  { tipo: 'foto', rotulo: 'Foto' },
  { tipo: 'qr', rotulo: 'QR Code' },
  { tipo: 'imagem', rotulo: 'Imagem ou logo' },
  { tipo: 'retangulo', rotulo: 'Retângulo' },
  { tipo: 'circulo', rotulo: 'Círculo' },
  { tipo: 'linha', rotulo: 'Linha' },
]

/** Item novo, no meio do cartão, pronto para mover. */
export function novoElemento(tipo: ItemNovo, id: string): Elemento {
  switch (tipo) {
    case 'texto':
      return texto(id, 30, 24, 30, 4, 'Texto novo', { tamanho: 7 })
    case 'dado':
      return texto(id, 30, 24, 30, 4, '{nome}', { tamanho: 7.5, peso: 700 })
    case 'foto':
      return { id, tipo: 'foto', x: 33, y: 14, w: 19.5, h: 26, raio: 1.2, borda: 0.35, corBorda: VERMELHO }
    case 'qr':
      return { id, tipo: 'qr', x: 31, y: 14, w: 24, h: 24, cor: '#000000' }
    case 'imagem':
      return { id, tipo: 'imagem', x: 36, y: 20, w: 14, h: 14, arquivo: 'logo', ajuste: 'conter', raio: 0, borda: 0, corBorda: TINTA, opacidade: 1 }
    case 'retangulo':
      return forma(id, 30, 20, 26, 14, VERMELHO)
    case 'circulo':
      return forma(id, 36, 20, 14, 14, VERMELHO, { forma: 'elipse' })
    case 'linha':
      return forma(id, 25, 27, 36, 0.3, CINZA_ESCURO)
  }
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
      return e.arquivo === 'logo' ? 'Logo do sistema' : 'Imagem enviada'
  }
}

const CHAVES = new Set<string>(CAMPOS.map((c) => c.chave))
const NOME_DO_LADO: Record<Lado, string> = { frente: 'Frente', verso: 'Verso' }

/** O que pode dar problema na credencial com este modelo (não impede salvar). */
export function conferirModelo(m: ModeloCredencial): string[] {
  const avisos: string[] = []
  const todos = [...m.frente.elementos, ...m.verso.elementos]
  const textos = todos.filter((e): e is ElementoTexto => e.tipo === 'texto')
  const usa = (chave: ChaveCampo) => textos.some((e) => e.texto.includes(`{${chave}}`))

  for (const lado of ['frente', 'verso'] as const) {
    for (const e of m[lado].elementos) {
      if (e.x < -0.05 || e.y < -0.05 || e.x + e.w > LARGURA_MM + 0.05 || e.y + e.h > ALTURA_MM + 0.05) {
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
  return avisos
}
