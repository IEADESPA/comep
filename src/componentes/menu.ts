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
    // o ministro associado cadastra a igreja que ele preside (a secretaria confere): o aviso fica no Início
    caminho: '/cadastrar-minha-igreja',
    titulo: 'Cadastrar a minha igreja',
    descricao: 'A igreja que você preside ainda não está no COMEP? Cadastre aqui, com os documentos',
    perfis: MINISTRO,
    fase: 5.5,
    pronto: true,
    icone: 'igreja',
    area: 'pessoas',
    curto: 'Minha igreja',
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
    descricao: 'Igrejas, regularização e denominações',
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
    // Fase 5.5, parte 10: o Conselho Fiscal aprova as contas mês a mês; a tesouraria e a presidência veem e respondem
    caminho: '/conselho-fiscal',
    titulo: 'Conselho Fiscal',
    descricao: 'As contas dos meses, os esclarecimentos e o parecer do ano',
    perfis: ['conselho_fiscal', 'tesouraria', 'presidencia'],
    fase: 5.5,
    pronto: true,
    icone: 'check',
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

// ---------- O menu de cada módulo: as funções (e as subfunções) ----------
//
// Padrão aprovado pelo usuário em 18/11/2026 para TODOS os módulos ("o módulo toma a coluna"): ao entrar num módulo,
// a coluna vermelha da esquerda vira o menu dele, com as funções grandes; as subfunções abrem embaixo da função
// aberta. Não há abas no alto para os submódulos (as abas ficam só dentro das fichas). Cada função é um endereço
// do sistema. Fora dos módulos (Início, Módulos, Meu perfil e as telas pessoais) continua o menu curto.

/** As contagens que aparecem ao lado de uma função quando há pendência (src/estado/pendencias.ts). */
export type ChavePendencia =
  | 'pedidosAssociacao'
  | 'correcoes'
  | 'comprovantes'
  | 'despesas'
  | 'emprestimos'
  | 'justificativas'
  | 'igrejasConferir'
  | 'igrejasSuspensas'
  | 'mesesParaAnalisar'
  | 'esclarecimentos'

export type Subfuncao = {
  titulo: string
  caminho: string
}

export type Funcao = {
  chave: string
  titulo: string
  icone: NomeIcone
  /** o endereço que a função abre; o que vem depois dele (a ficha, o detalhe…) também é dela */
  caminho: string
  /** outros começos de endereço que também são desta função */
  tambem?: readonly string[]
  /** o item do menu que dá acesso (sem isso: o do módulo) */
  item?: string
  /** só estes perfis veem a função (dentro de quem vê o item) */
  perfis?: readonly Perfil[]
  subfuncoes?: readonly Subfuncao[]
  pendencia?: ChavePendencia
}

export type Modulo = {
  chave: string
  titulo: string
  icone: NomeIcone
  area: Area
  /** o item do menu (ITENS_MENU) que dá acesso ao módulo */
  item: string
  /** os começos de endereço do módulo (ex.: /financeiro, que leva à primeira função) */
  bases: readonly string[]
  funcoes: readonly Funcao[]
}

const SECRETARIA_PRESIDENCIA: readonly Perfil[] = ['secretaria', 'presidencia']

export const MODULOS: readonly Modulo[] = [
  {
    chave: 'ministros',
    titulo: 'Ministros e inscrições',
    icone: 'ministros',
    area: 'pessoas',
    item: '/ministros',
    bases: ['/ministros', '/inscricoes'],
    funcoes: [
      { chave: 'ministros', titulo: 'Ministros', icone: 'ministros', caminho: '/ministros' },
      {
        chave: 'pedidos',
        titulo: 'Pedidos de associação',
        icone: 'inscricoes',
        caminho: '/inscricoes',
        item: '/inscricoes',
        pendencia: 'pedidosAssociacao',
      },
      { chave: 'correcoes', titulo: 'Correções pedidas', icone: 'editar', caminho: '/ministros/correcoes', pendencia: 'correcoes' },
      { chave: 'cadastrar', titulo: 'Cadastrar ministro', icone: 'mais', caminho: '/ministros/novo' },
    ],
  },
  {
    chave: 'credenciais',
    titulo: 'Credenciais',
    icone: 'credencial',
    area: 'pessoas',
    item: '/credenciais',
    bases: ['/credenciais'],
    funcoes: [
      { chave: 'lista', titulo: 'Credenciais', icone: 'credencial', caminho: '/credenciais' },
      { chave: 'imprimir', titulo: 'Imprimir', icone: 'imprimir', caminho: '/credenciais/imprimir' },
      // rodadas 8 e 9: um modelo por grupo, com o editor na tela inteira e "Quem recebe"
      { chave: 'modelos', titulo: 'Modelos', icone: 'grade', caminho: '/credenciais/modelos', tambem: ['/credenciais/modelo'] },
      // rodada 11: a biblioteca de símbolos e os logotipos das denominações
      { chave: 'simbolos', titulo: 'Símbolos', icone: 'estrela', caminho: '/credenciais/simbolos' },
      { chave: 'validade', titulo: 'Validade e verso', icone: 'relogio', caminho: '/credenciais/validade' },
    ],
  },
  {
    chave: 'igrejas',
    titulo: 'Igrejas',
    icone: 'igreja',
    area: 'pessoas',
    item: '/igrejas',
    bases: ['/igrejas'],
    // rodada 12 (18/11/2026): o painel é a tela inicial; a tabela serve às subfunções (todas e por situação)
    funcoes: [
      {
        chave: 'igrejas',
        titulo: 'Igrejas',
        icone: 'igreja',
        caminho: '/igrejas',
        subfuncoes: [
          { titulo: 'Todas', caminho: '/igrejas/lista' },
          { titulo: 'Regulares', caminho: '/igrejas/lista/regulares' },
          { titulo: 'Suspensas', caminho: '/igrejas/lista/suspensas' },
          { titulo: 'Sem registro', caminho: '/igrejas/lista/sem-registro' },
        ],
      },
      { chave: 'conferir', titulo: 'Para conferir', icone: 'check', caminho: '/igrejas/conferir', pendencia: 'igrejasConferir' },
      {
        chave: 'regularizacao',
        titulo: 'Central de regularização',
        icone: 'alerta',
        caminho: '/igrejas/regularizacao',
        pendencia: 'igrejasSuspensas',
      },
      { chave: 'cadastrar', titulo: 'Cadastrar igreja', icone: 'mais', caminho: '/igrejas/nova' },
      { chave: 'denominacoes', titulo: 'Denominações', icone: 'grade', caminho: '/igrejas/denominacoes' },
    ],
  },
  {
    chave: 'financeiro',
    titulo: 'Financeiro',
    icone: 'financeiro',
    area: 'financas',
    item: '/financeiro',
    bases: ['/financeiro'],
    // rodada 11 (18/11/2026): as 6 funções, cada uma com as subfunções (parte 9 das telas novas)
    funcoes: [
      {
        chave: 'contribuicoes',
        titulo: 'Contribuições',
        icone: 'mensalidade',
        caminho: '/financeiro/contribuicoes',
        subfuncoes: [
          { titulo: 'Situação dos ministros', caminho: '/financeiro/contribuicoes' },
          { titulo: 'Por igreja', caminho: '/financeiro/contribuicoes/igrejas' },
          { titulo: 'Cobranças do ano', caminho: '/financeiro/contribuicoes/cobrancas' },
          { titulo: 'Valores e planos', caminho: '/financeiro/contribuicoes/valores' },
        ],
      },
      {
        chave: 'comprovantes',
        titulo: 'Comprovantes',
        icone: 'enviar',
        caminho: '/financeiro/comprovantes',
        perfis: ['tesouraria', 'presidencia'],
        pendencia: 'comprovantes',
        subfuncoes: [
          { titulo: 'Para conferir', caminho: '/financeiro/comprovantes' },
          { titulo: 'Já conferidos', caminho: '/financeiro/comprovantes/conferidos' },
        ],
      },
      {
        chave: 'caixa',
        titulo: 'Caixa',
        icone: 'financeiro',
        caminho: '/financeiro/caixa',
        subfuncoes: [
          { titulo: 'Lançamentos', caminho: '/financeiro/caixa' },
          { titulo: 'Contas e saldos', caminho: '/financeiro/caixa/contas' },
          { titulo: 'Transferências', caminho: '/financeiro/caixa/transferencias' },
        ],
      },
      {
        chave: 'despesas',
        titulo: 'Despesas a autorizar',
        icone: 'check',
        caminho: '/financeiro/despesas',
        pendencia: 'despesas',
        subfuncoes: [
          { titulo: 'Esperando', caminho: '/financeiro/despesas' },
          { titulo: 'Autorizadas', caminho: '/financeiro/despesas/autorizadas' },
          { titulo: 'Recusadas', caminho: '/financeiro/despesas/recusadas' },
        ],
      },
      {
        chave: 'orcamento',
        titulo: 'Orçamento',
        icone: 'grade',
        caminho: '/financeiro/orcamento',
        subfuncoes: [
          { titulo: 'Por categoria', caminho: '/financeiro/orcamento' },
          { titulo: 'Plano anual de trabalho', caminho: '/financeiro/orcamento/plano' },
        ],
      },
      {
        chave: 'prestacao',
        titulo: 'Prestação de contas',
        icone: 'assembleia',
        caminho: '/financeiro/prestacao',
        subfuncoes: [
          { titulo: 'O exercício', caminho: '/financeiro/prestacao' },
          { titulo: 'Mês a mês', caminho: '/financeiro/prestacao/mes-a-mes' },
          { titulo: 'Balanço e parecer', caminho: '/financeiro/prestacao/balanco' },
        ],
      },
    ],
  },
  {
    // rodadas 13 e 14 (18/11/2026): o painel do exercício como início e a página do mês com o comprovante de cada lançamento
    chave: 'conselho',
    titulo: 'Conselho Fiscal',
    icone: 'check',
    area: 'financas',
    item: '/conselho-fiscal',
    bases: ['/conselho-fiscal'],
    funcoes: [
      {
        chave: 'meses',
        titulo: 'Contas dos meses',
        icone: 'financeiro',
        caminho: '/conselho-fiscal',
        tambem: ['/conselho-fiscal/meses'],
        pendencia: 'mesesParaAnalisar',
      },
      { chave: 'esclarecimentos', titulo: 'Esclarecimentos', icone: 'aviso', caminho: '/conselho-fiscal/esclarecimentos', pendencia: 'esclarecimentos' },
      { chave: 'parecer', titulo: 'Parecer do ano', icone: 'check', caminho: '/conselho-fiscal/parecer' },
      { chave: 'documentos', titulo: 'Documentos', icone: 'pedido', caminho: '/conselho-fiscal/documentos' },
    ],
  },
  {
    chave: 'patrimonio',
    titulo: 'Patrimônio',
    icone: 'patrimonio',
    area: 'financas',
    item: '/patrimonio',
    bases: ['/patrimonio'],
    funcoes: [
      {
        chave: 'pedidos',
        titulo: 'Pedidos',
        icone: 'pedido',
        caminho: '/patrimonio/pedidos',
        tambem: ['/patrimonio/emprestimos'],
        pendencia: 'emprestimos',
      },
      {
        chave: 'pedir',
        titulo: 'Pedir emprestado',
        icone: 'enviar',
        caminho: '/patrimonio/pedir',
        perfis: ['presidente_igreja', 'secretaria', 'tesouraria', 'presidencia'],
      },
      { chave: 'agenda', titulo: 'Agenda', icone: 'evento', caminho: '/patrimonio/agenda' },
      { chave: 'bens', titulo: 'Bens', icone: 'patrimonio', caminho: '/patrimonio/bens' },
      { chave: 'regras', titulo: 'Regras', icone: 'config', caminho: '/patrimonio/regras' },
    ],
  },
  {
    chave: 'assembleias',
    titulo: 'Assembleias',
    icone: 'assembleia',
    area: 'assembleias',
    item: '/assembleias',
    bases: ['/assembleias'],
    // rodada 15 (18/11/2026), parte 14: as 7 funções do desenho (asm-presenca, asm-conducao e asm-fechamento), com os
    // nomes e os ícones de lá (revisão da parte 14, achado 10)
    funcoes: [
      { chave: 'encontros', titulo: 'Assembleias', icone: 'assembleia', caminho: '/assembleias' },
      { chave: 'preparar', titulo: 'Preparar', icone: 'pedido', caminho: '/assembleias/novo', perfis: SECRETARIA_PRESIDENCIA },
      { chave: 'presenca', titulo: 'Presença', icone: 'qr', caminho: '/assembleias/presenca', perfis: SECRETARIA_PRESIDENCIA },
      { chave: 'conducao', titulo: 'Condução', icone: 'votar', caminho: '/assembleias/conducao', perfis: SECRETARIA_PRESIDENCIA },
      { chave: 'fechamento', titulo: 'Fechamento e ata', icone: 'check', caminho: '/assembleias/fechamento', perfis: SECRETARIA_PRESIDENCIA },
      {
        chave: 'faltas',
        titulo: 'Faltas e justificativas',
        icone: 'alerta',
        caminho: '/assembleias/faltas',
        perfis: SECRETARIA_PRESIDENCIA,
        pendencia: 'justificativas',
      },
      { chave: 'pedidos', titulo: 'Pedidos de AGE', icone: 'aviso', caminho: '/assembleias/pedidos' },
    ],
  },
  {
    chave: 'votacoes',
    titulo: 'Votações e enquetes',
    icone: 'votar',
    area: 'assembleias',
    item: '/votacoes',
    bases: ['/votacoes'],
    funcoes: [
      { chave: 'votacoes', titulo: 'Votações e enquetes', icone: 'votar', caminho: '/votacoes' },
      { chave: 'nova', titulo: 'Nova votação ou enquete', icone: 'mais', caminho: '/votacoes/nova', perfis: SECRETARIA_PRESIDENCIA },
    ],
  },
  {
    chave: 'diretoria',
    titulo: 'Diretoria',
    icone: 'diretoria',
    area: 'assembleias',
    item: '/diretoria',
    bases: ['/diretoria'],
    funcoes: [{ chave: 'diretoria', titulo: 'Conselhos e mandatos', icone: 'diretoria', caminho: '/diretoria' }],
  },
  {
    chave: 'comissoes',
    titulo: 'Comissões',
    icone: 'comissao',
    area: 'assembleias',
    item: '/comissoes',
    bases: ['/comissoes'],
    funcoes: [
      { chave: 'comissoes', titulo: 'Comissões', icone: 'comissao', caminho: '/comissoes' },
      { chave: 'nova', titulo: 'Nova comissão', icone: 'mais', caminho: '/comissoes/nova', perfis: SECRETARIA_PRESIDENCIA },
    ],
  },
  {
    chave: 'eventos',
    titulo: 'Eventos e projetos',
    icone: 'evento',
    area: 'eventos',
    item: '/eventos',
    bases: ['/eventos'],
    funcoes: [
      { chave: 'eventos', titulo: 'Eventos e projetos', icone: 'evento', caminho: '/eventos' },
      { chave: 'novo', titulo: 'Novo evento ou projeto', icone: 'mais', caminho: '/eventos/novo', perfis: SECRETARIA_PRESIDENCIA },
    ],
  },
  {
    chave: 'avisos',
    titulo: 'Mural de avisos',
    icone: 'aviso',
    area: 'eventos',
    item: '/avisos',
    bases: ['/avisos'],
    funcoes: [{ chave: 'mural', titulo: 'Mural de avisos', icone: 'aviso', caminho: '/avisos' }],
  },
  {
    chave: 'painel',
    titulo: 'Painel da presidência',
    icone: 'grade',
    area: 'assembleias',
    item: '/painel-presidencia',
    bases: ['/painel-presidencia'],
    funcoes: [{ chave: 'painel', titulo: 'Painel da presidência', icone: 'grade', caminho: '/painel-presidencia' }],
  },
  {
    chave: 'administracao',
    titulo: 'Administração',
    icone: 'config',
    area: 'assembleias',
    item: '/configuracoes',
    bases: ['/configuracoes', '/acessos', '/auditoria'],
    funcoes: [
      { chave: 'configuracoes', titulo: 'Configurações', icone: 'config', caminho: '/configuracoes' },
      { chave: 'acessos', titulo: 'Perfis de acesso', icone: 'chave', caminho: '/acessos', item: '/acessos' },
      // o termo de uso de dados (LGPD), com as versões e quem aceitou (parte 13)
      {
        chave: 'termo',
        titulo: 'Termo de uso de dados',
        icone: 'texto',
        caminho: '/configuracoes/termo',
        perfis: ['secretaria', 'presidencia', 'admin_tecnico'],
      },
      // a situação dos avisos no celular (parte 11)
      {
        chave: 'avisos',
        titulo: 'Avisos e notificações',
        icone: 'sino',
        caminho: '/configuracoes/avisos',
        perfis: ['secretaria', 'presidencia', 'admin_tecnico'],
      },
      { chave: 'auditoria', titulo: 'Auditoria', icone: 'relogio', caminho: '/auditoria', item: '/auditoria' },
    ],
  },
]

const comecaCom = (caminho: string, base: string) => caminho === base || caminho.startsWith(`${base}/`)

/** O tamanho do maior começo de endereço que bate (-1: nenhum). Ganha sempre o mais específico. */
function alcance(caminho: string, bases: readonly string[]): number {
  return bases.reduce((maior, base) => (comecaCom(caminho, base) && base.length > maior ? base.length : maior), -1)
}

const basesDaFuncao = (f: Funcao) => [f.caminho, ...(f.tambem ?? []), ...(f.subfuncoes ?? []).map((s) => s.caminho)]

export function funcaoVisivel(f: Funcao, modulo: Modulo, perfis: readonly Perfil[]): boolean {
  const item = ITENS_MENU.find((i) => i.caminho === (f.item ?? modulo.item))
  if (!item || !podeVer(item, perfis)) return false
  return f.perfis ? podeVer({ perfis: f.perfis }, perfis) : true
}

/** As funções do módulo que a pessoa pode abrir (na ordem do menu). */
export function funcoesVisiveis(modulo: Modulo, perfis: readonly Perfil[]): Funcao[] {
  return modulo.funcoes.filter((f) => funcaoVisivel(f, modulo, perfis))
}

export type Localizacao = { modulo: Modulo; funcao: Funcao | null; subfuncao: Subfuncao | null }

/** Em que módulo, função e subfunção está o endereço (null: fora dos módulos, ex.: Início e Meu perfil). */
export function localizar(caminho: string): Localizacao | null {
  let achado: Localizacao | null = null
  let melhor = -1
  for (const modulo of MODULOS) {
    if (alcance(caminho, modulo.bases) > melhor) {
      melhor = alcance(caminho, modulo.bases)
      achado = { modulo, funcao: null, subfuncao: null }
    }
    for (const funcao of modulo.funcoes) {
      const n = alcance(caminho, basesDaFuncao(funcao))
      // empate: a função ganha do módulo (mesmo começo de endereço)
      if (n >= 0 && (n > melhor || (n === melhor && achado?.funcao === null))) {
        melhor = n
        const subs = funcao.subfuncoes ?? []
        const sub = subs.reduce<Subfuncao | null>(
          (atual, s) => (alcance(caminho, [s.caminho]) > (atual ? alcance(caminho, [atual.caminho]) : -1) ? s : atual),
          null,
        )
        achado = { modulo, funcao, subfuncao: sub }
      }
    }
  }
  return achado
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
  { titulo: 'Finanças', caminhos: ['/financeiro', '/conselho-fiscal', '/patrimonio'] },
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
