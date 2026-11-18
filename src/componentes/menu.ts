import type { Perfil } from '../dados/perfis'
import type { Area, NomeIcone } from './Icone'

// Itens do menu e quem vê cada um (PROJETO.md, seções 3 e 4).
// ATENÇÃO: esconder um item na tela é só conforto visual. Quem garante que uma pessoa
// não veja dados de outra são as regras RLS no banco (supabase/migrations).
//
// Telas novas (Fase 5.5, docs/telas-novas.md): o menu da esquerda é CURTO (Início, a tela aberta e Meu perfil);
// os módulos ficam na página inicial, agrupados por assunto (GRUPOS_* abaixo).

export type ItemMenu = {
  caminho: string
  titulo: string
  descricao: string
  /** 'sem_perfil' = só para quem ainda não tem perfil nenhum (ex.: candidato à associação) */
  perfis: readonly Perfil[] | 'todos' | 'sem_perfil'
  /** Fase de entrega em que a tela fica pronta (PROJETO.md, seção 9). */
  fase: number
  /** A tela já funciona (as demais mostram "Em construção"). */
  pronto?: boolean
  icone: NomeIcone
  /** a cor do assunto no ícone */
  area: Area
  /** nome curto, para a grade de módulos do celular */
  curto?: string
}

const MINISTRO: readonly Perfil[] = ['ministro']
const DIRETORIA_CADASTRO: readonly Perfil[] = ['secretaria', 'presidencia']

export const ITENS_MENU: readonly ItemMenu[] = [
  { caminho: '/painel', titulo: 'Início', descricao: 'Resumo e atalhos', perfis: 'todos', fase: 0, pronto: true, icone: 'inicio', area: 'pessoas' },
  {
    caminho: '/meu-pedido',
    titulo: 'Meu pedido',
    descricao: 'Pedido de associação ao COMEP',
    perfis: 'sem_perfil',
    fase: 1,
    pronto: true,
    icone: 'pedido',
    area: 'pessoas',
  },
  {
    caminho: '/meu-perfil',
    titulo: 'Meu perfil',
    descricao: 'Seus dados, foto, igreja e senha',
    perfis: 'todos',
    fase: 1,
    pronto: true,
    icone: 'perfil',
    area: 'pessoas',
  },
  {
    caminho: '/minhas-mensalidades',
    titulo: 'Minhas mensalidades',
    descricao: 'Situação, plano e envio de comprovantes',
    perfis: MINISTRO,
    fase: 2,
    pronto: true,
    icone: 'mensalidade',
    area: 'financas',
    curto: 'Mensalidades',
  },
  {
    caminho: '/minha-credencial',
    titulo: 'Minha credencial',
    descricao: 'Credencial digital com QR Code e impressão',
    perfis: MINISTRO,
    fase: 3,
    pronto: true,
    icone: 'credencial',
    area: 'pessoas',
    curto: 'Credencial',
  },
  {
    caminho: '/minha-igreja',
    titulo: 'Minha igreja',
    descricao: 'A sua igreja no COMEP: ministros, documentos e diretoria',
    perfis: ['presidente_igreja'],
    fase: 1,
    pronto: true,
    icone: 'igreja',
    area: 'pessoas',
  },
  {
    caminho: '/inscricoes',
    titulo: 'Inscrições',
    descricao: 'Pedidos de associação para análise',
    perfis: DIRETORIA_CADASTRO,
    fase: 1,
    pronto: true,
    icone: 'inscricoes',
    area: 'pessoas',
  },
  {
    caminho: '/ministros',
    titulo: 'Ministros',
    descricao: 'Cadastro de ministros',
    perfis: DIRETORIA_CADASTRO,
    fase: 1,
    pronto: true,
    icone: 'ministros',
    area: 'pessoas',
  },
  {
    caminho: '/credenciais',
    titulo: 'Credenciais',
    descricao: 'Ver, imprimir e conferir as credenciais dos associados',
    perfis: DIRETORIA_CADASTRO,
    fase: 3,
    pronto: true,
    icone: 'credencial',
    area: 'pessoas',
  },
  {
    caminho: '/igrejas',
    titulo: 'Igrejas',
    descricao: 'Cadastro de igrejas e denominações',
    perfis: DIRETORIA_CADASTRO,
    fase: 1,
    pronto: true,
    icone: 'igreja',
    area: 'pessoas',
  },
  {
    caminho: '/financeiro',
    titulo: 'Financeiro',
    descricao: 'Contribuições, caixa, despesas e prestação de contas',
    perfis: ['tesouraria', 'presidencia', 'conselho_fiscal'],
    fase: 2,
    pronto: true,
    icone: 'financeiro',
    area: 'financas',
  },
  {
    caminho: '/assembleias',
    titulo: 'Assembleias',
    descricao: 'Assembleias, reuniões mensais, convocações e pauta',
    perfis: ['ministro', 'secretaria', 'presidencia'],
    fase: 4,
    pronto: true,
    icone: 'assembleia',
    area: 'assembleias',
  },
  {
    caminho: '/diretoria',
    titulo: 'Diretoria',
    descricao: 'Conselho Diretor e Conselho Fiscal: cargos e mandatos',
    perfis: ['ministro', 'secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal', 'admin_tecnico'],
    fase: 4,
    pronto: true,
    icone: 'diretoria',
    area: 'assembleias',
  },
  {
    caminho: '/comissoes',
    titulo: 'Comissões',
    descricao: 'Comissões do Conselho, membros e o que cada uma faz',
    perfis: ['ministro', 'secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'],
    fase: 5,
    pronto: true,
    icone: 'comissao',
    area: 'assembleias',
  },
  {
    caminho: '/eventos',
    titulo: 'Eventos e projetos',
    descricao: 'Eventos, inscrições, orçamento e projetos do Conselho',
    perfis: ['ministro', 'secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'],
    fase: 5,
    pronto: true,
    icone: 'evento',
    area: 'eventos',
    curto: 'Eventos',
  },
  {
    caminho: '/votacoes',
    titulo: 'Votações e enquetes',
    descricao: 'Vote pelo celular: enquetes, votações e os itens da assembleia',
    perfis: ['ministro', 'presidente_igreja', 'secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'],
    fase: 5.5,
    pronto: true,
    icone: 'votar',
    area: 'assembleias',
    curto: 'Votações',
  },
  {
    caminho: '/patrimonio',
    titulo: 'Patrimônio',
    descricao: 'Bens do COMEP e o empréstimo às igrejas, com a agenda e o termo',
    perfis: ['presidente_igreja', 'secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal'],
    fase: 5.5,
    pronto: true,
    icone: 'patrimonio',
    area: 'financas',
  },
  {
    caminho: '/avisos',
    titulo: 'Mural de avisos',
    descricao: 'Os avisos do Conselho (a secretaria publica)',
    perfis: ['ministro', 'presidente_igreja', 'secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal', 'admin_tecnico'],
    fase: 5,
    pronto: true,
    icone: 'aviso',
    area: 'eventos',
    curto: 'Mural',
  },
  {
    caminho: '/painel-presidencia',
    titulo: 'Painel da presidência',
    descricao: 'Associados, finanças, presença e agenda num lugar só',
    perfis: ['presidencia'],
    fase: 5,
    pronto: true,
    icone: 'grade',
    area: 'assembleias',
    curto: 'Painel',
  },
  {
    caminho: '/configuracoes',
    titulo: 'Configurações',
    descricao: 'Denominações, bairros, títulos e valores da contribuição',
    perfis: ['secretaria', 'tesouraria', 'presidencia', 'admin_tecnico'],
    fase: 1,
    pronto: true,
    icone: 'config',
    area: 'assembleias',
  },
  {
    caminho: '/acessos',
    titulo: 'Perfis de acesso',
    descricao: 'Quem tem qual perfil no sistema',
    perfis: ['presidencia'],
    fase: 1,
    pronto: true,
    icone: 'chave',
    area: 'assembleias',
    curto: 'Acessos',
  },
  {
    caminho: '/auditoria',
    titulo: 'Auditoria',
    descricao: 'Histórico de todas as alterações',
    perfis: ['presidencia', 'admin_tecnico'],
    fase: 1,
    pronto: true,
    icone: 'relogio',
    area: 'assembleias',
  },
]

/** O presidente de igreja tem "tudo do ministro +" (PROJETO.md, seção 3). */
export function perfisEfetivos(perfis: readonly Perfil[]): Set<Perfil> {
  const efetivos = new Set(perfis)
  if (efetivos.has('presidente_igreja')) efetivos.add('ministro')
  return efetivos
}

export function podeVer(item: Pick<ItemMenu, 'perfis'>, perfis: readonly Perfil[]): boolean {
  if (item.perfis === 'todos') return true
  if (item.perfis === 'sem_perfil') return perfis.length === 0
  const efetivos = perfisEfetivos(perfis)
  return item.perfis.some((p) => efetivos.has(p))
}

export function itensVisiveis(perfis: readonly Perfil[]): ItemMenu[] {
  return ITENS_MENU.filter((item) => podeVer(item, perfis))
}

/** Quem trabalha na diretoria (o Início mostra "Precisa de você", a agenda e os módulos da diretoria). */
export const PERFIS_DA_DIRETORIA: readonly Perfil[] = ['secretaria', 'tesouraria', 'presidencia', 'conselho_fiscal', 'admin_tecnico']

export function ehDaDiretoria(perfis: readonly Perfil[]): boolean {
  return perfis.some((p) => PERFIS_DA_DIRETORIA.includes(p))
}

/** O módulo aberto agora (para o menu curto e a trilha do topo); null no Início e no Meu perfil. */
export function moduloAberto(caminhoAtual: string): ItemMenu | null {
  const item = ITENS_MENU.find((i) => caminhoAtual === i.caminho || caminhoAtual.startsWith(`${i.caminho}/`))
  if (!item || item.caminho === '/painel' || item.caminho === '/meu-perfil') return null
  return item
}

// ---------- Os módulos na página inicial, agrupados por assunto ----------

export type ModuloNoInicio = Pick<ItemMenu, 'caminho' | 'titulo' | 'icone' | 'area'> & { curto: string }

/** Atalho que não é um item do menu (ex.: os pedidos de AGE, que ficam dentro de Assembleias). */
const ATALHOS: Record<string, ModuloNoInicio & Pick<ItemMenu, 'perfis'>> = {
  '/assembleias/pedidos': {
    caminho: '/assembleias/pedidos',
    titulo: 'Pedidos de AGE',
    curto: 'Pedidos de AGE',
    icone: 'pedido',
    area: 'assembleias',
    perfis: ['ministro', 'secretaria', 'presidencia'],
  },
}

type Grupo = { titulo: string; caminhos: readonly string[] }

/** Diretoria (proposta aprovada): Pessoas, Assembleias e governo, Finanças, Eventos e avisos (+ o pessoal, se for ministro). */
export const GRUPOS_DIRETORIA: readonly Grupo[] = [
  { titulo: 'Pessoal', caminhos: ['/minha-credencial', '/minhas-mensalidades', '/minha-igreja'] },
  { titulo: 'Pessoas', caminhos: ['/ministros', '/inscricoes', '/credenciais', '/igrejas'] },
  { titulo: 'Assembleias e governo', caminhos: ['/assembleias', '/votacoes', '/diretoria', '/comissoes'] },
  { titulo: 'Finanças', caminhos: ['/financeiro', '/patrimonio'] },
  { titulo: 'Eventos e avisos', caminhos: ['/eventos', '/avisos'] },
]

/** Ministro e pastor presidente (proposta aprovada): Pessoal, Assembleias, Eventos e avisos, O Conselho. */
export const GRUPOS_MINISTRO: readonly Grupo[] = [
  { titulo: 'Pessoal', caminhos: ['/minha-credencial', '/minhas-mensalidades'] },
  { titulo: 'Minha igreja', caminhos: ['/minha-igreja', '/patrimonio'] },
  { titulo: 'Assembleias', caminhos: ['/assembleias', '/votacoes', '/assembleias/pedidos'] },
  { titulo: 'Eventos e avisos', caminhos: ['/eventos', '/avisos'] },
  { titulo: 'O Conselho', caminhos: ['/diretoria', '/comissoes'] },
]

/** A linha "Administração" embaixo dos grupos, no Início da diretoria. */
export const ADMINISTRACAO: readonly string[] = ['/configuracoes', '/acessos', '/auditoria', '/painel-presidencia']

function modulo(caminho: string, perfis: readonly Perfil[]): ModuloNoInicio | null {
  const item = ITENS_MENU.find((i) => i.caminho === caminho) ?? ATALHOS[caminho]
  if (!item || !podeVer(item, perfis)) return null
  return { caminho: item.caminho, titulo: item.titulo, icone: item.icone, area: item.area, curto: item.curto ?? item.titulo }
}

export type ModulosDoInicio = {
  grupos: { titulo: string; modulos: ModuloNoInicio[] }[]
  administracao: ModuloNoInicio[]
}

/** Os módulos que a pessoa pode abrir, agrupados por assunto (grupo vazio não aparece). */
export function modulosDoInicio(perfis: readonly Perfil[]): ModulosDoInicio {
  const grupos = (ehDaDiretoria(perfis) ? GRUPOS_DIRETORIA : GRUPOS_MINISTRO)
    .map((g) => ({ titulo: g.titulo, modulos: g.caminhos.map((c) => modulo(c, perfis)).filter((m) => m !== null) }))
    .filter((g) => g.modulos.length > 0)
  const administracao = ADMINISTRACAO.map((c) => modulo(c, perfis)).filter((m) => m !== null)
  return { grupos, administracao }
}
