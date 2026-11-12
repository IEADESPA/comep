import type { Perfil } from '../dados/perfis'

// Itens do menu e quem vê cada um (PROJETO.md, seções 3 e 4).
// ATENÇÃO: esconder um item na tela é só conforto visual. Quem garante que uma pessoa
// não veja dados de outra são as regras RLS no banco (supabase/migrations).

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
}

const MINISTRO: readonly Perfil[] = ['ministro']
const DIRETORIA_CADASTRO: readonly Perfil[] = ['secretaria', 'presidencia']

export const ITENS_MENU: readonly ItemMenu[] = [
  { caminho: '/painel', titulo: 'Início', descricao: 'Resumo e atalhos', perfis: 'todos', fase: 0, pronto: true },
  { caminho: '/meu-pedido', titulo: 'Meu pedido', descricao: 'Pedido de associação ao COMEP', perfis: 'sem_perfil', fase: 1, pronto: true },
  { caminho: '/meu-perfil', titulo: 'Meu perfil', descricao: 'Seus dados, foto, igreja e senha', perfis: 'todos', fase: 1, pronto: true },
  { caminho: '/minhas-mensalidades', titulo: 'Minhas mensalidades', descricao: 'Situação, plano e envio de comprovantes', perfis: MINISTRO, fase: 2, pronto: true },
  { caminho: '/minha-carteirinha', titulo: 'Minha carteirinha', descricao: 'Carteirinha digital com QR Code', perfis: MINISTRO, fase: 3 },
  { caminho: '/minha-igreja', titulo: 'Minha igreja', descricao: 'Ministros da sua igreja e contato da igreja', perfis: ['presidente_igreja'], fase: 1, pronto: true },
  { caminho: '/inscricoes', titulo: 'Inscrições', descricao: 'Pedidos de associação para análise', perfis: DIRETORIA_CADASTRO, fase: 1, pronto: true },
  { caminho: '/ministros', titulo: 'Ministros', descricao: 'Cadastro de ministros', perfis: DIRETORIA_CADASTRO, fase: 1, pronto: true },
  { caminho: '/igrejas', titulo: 'Igrejas', descricao: 'Cadastro de igrejas e denominações', perfis: DIRETORIA_CADASTRO, fase: 1, pronto: true },
  { caminho: '/financeiro', titulo: 'Financeiro', descricao: 'Contribuições, caixa, despesas e prestação de contas', perfis: ['tesouraria', 'presidencia', 'conselho_fiscal'], fase: 2, pronto: true },
  { caminho: '/assembleias', titulo: 'Assembleias', descricao: 'Convocações, presença e atas', perfis: ['ministro', 'secretaria', 'presidencia'], fase: 4 },
  { caminho: '/projetos', titulo: 'Projetos', descricao: 'Projetos e eventos do Conselho', perfis: ['secretaria', 'tesouraria', 'presidencia'], fase: 5 },
  { caminho: '/avisos', titulo: 'Avisos', descricao: 'Mural de avisos', perfis: 'todos', fase: 5 },
  {
    caminho: '/configuracoes',
    titulo: 'Configurações',
    descricao: 'Denominações, bairros, títulos e valores da contribuição',
    perfis: ['secretaria', 'tesouraria', 'presidencia', 'admin_tecnico'],
    fase: 1,
    pronto: true,
  },
  { caminho: '/acessos', titulo: 'Perfis de acesso', descricao: 'Quem tem qual perfil no sistema', perfis: ['presidencia'], fase: 1, pronto: true },
  { caminho: '/auditoria', titulo: 'Auditoria', descricao: 'Histórico de todas as alterações', perfis: ['presidencia', 'admin_tecnico'], fase: 1, pronto: true },
]

/** O presidente de igreja tem "tudo do ministro +" (PROJETO.md, seção 3). */
export function perfisEfetivos(perfis: readonly Perfil[]): Set<Perfil> {
  const efetivos = new Set(perfis)
  if (efetivos.has('presidente_igreja')) efetivos.add('ministro')
  return efetivos
}

export function podeVer(item: ItemMenu, perfis: readonly Perfil[]): boolean {
  if (item.perfis === 'todos') return true
  if (item.perfis === 'sem_perfil') return perfis.length === 0
  const efetivos = perfisEfetivos(perfis)
  return item.perfis.some((p) => efetivos.has(p))
}

export function itensVisiveis(perfis: readonly Perfil[]): ItemMenu[] {
  return ITENS_MENU.filter((item) => podeVer(item, perfis))
}
