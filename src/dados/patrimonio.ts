// Fase 5.5.1 — Patrimônio e empréstimo às igrejas (Art. 18; PROJETO.md, seção 4.12).
// Os bens do COMEP, o pedido da igreja (com o termo de compromisso), a agenda, a aprovação, a retirada e a devolução.
import { cliente, falha, ok, type Resultado } from './cliente'

export type FormaAquisicao = 'compra' | 'doacao' | 'legado' | 'outro'

export const NOME_DA_FORMA_AQUISICAO: Record<FormaAquisicao, string> = {
  compra: 'Compra',
  doacao: 'Doação',
  legado: 'Legado',
  outro: 'Outra',
}

export type ItemPatrimonio = {
  id: string
  nome: string
  categoria: string | null
  descricao: string | null
  quantidade: number
  emprestavel: boolean
  forma_aquisicao: FormaAquisicao
  adquirido_em: string | null
  valor_unitario: number | null
  lancamento_id: string | null
  local_guarda: string | null
}

const CAMPOS_ITEM = 'id, nome, categoria, descricao, quantidade, emprestavel, forma_aquisicao, adquirido_em, valor_unitario, lancamento_id, local_guarda'

export async function listarItens(): Promise<Resultado<ItemPatrimonio[]>> {
  const { data, error } = await cliente()
    .from('patrimonio_itens')
    .select(CAMPOS_ITEM)
    .order('categoria', { ascending: true, nullsFirst: false })
    .order('nome')
    .returns<ItemPatrimonio[]>()
  return error ? falha(error) : ok(data.map((i) => ({ ...i, valor_unitario: i.valor_unitario === null ? null : Number(i.valor_unitario) })))
}

export type DadosItem = {
  nome: string
  categoria: string
  descricao: string
  quantidade: number
  emprestavel: boolean
  forma_aquisicao: FormaAquisicao
  adquirido_em: string
  valor_unitario: number | null
  local_guarda: string
}

export async function salvarItem(id: string | null, dados: DadosItem): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_item_patrimonio', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function acrescentarItem(id: string, quantidade: number, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('acrescentar_item_patrimonio', { p_item_id: id, p_quantidade: quantidade, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function baixarItem(id: string, quantidade: number, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('baixar_item_patrimonio', {
    p_item_id: id,
    p_quantidade: quantidade,
    p_motivo: motivo,
    p_emprestimo_id: null,
  })
  return error ? falha(error) : ok(null)
}

export type Baixa = { id: string; item_id: string; quantidade: number; motivo: string; data: string; emprestimo_id: string | null }

/** Só a equipe e o Conselho Fiscal leem as baixas (para os demais vem vazio). */
export async function listarBaixas(): Promise<Resultado<Baixa[]>> {
  const { data, error } = await cliente()
    .from('patrimonio_baixas')
    .select('id, item_id, quantidade, motivo, data, emprestimo_id')
    .order('data', { ascending: false })
    .limit(200)
    .returns<Baixa[]>()
  return error ? falha(error) : ok(data)
}

// ---------- Regras (a presidência muda) ----------

export type ConfigPatrimonio = {
  antecedencia_dias: number
  prazo_maximo_dias: number
  exige_em_dia: boolean
  texto_termo: string
}

export async function buscarConfigPatrimonio(): Promise<Resultado<ConfigPatrimonio>> {
  const { data, error } = await cliente()
    .from('config_patrimonio')
    .select('antecedencia_dias, prazo_maximo_dias, exige_em_dia, texto_termo')
    .single<ConfigPatrimonio>()
  return error ? falha(error) : ok(data)
}

export async function salvarConfigPatrimonio(config: ConfigPatrimonio): Promise<Resultado<null>> {
  const { data, error } = await cliente().from('config_patrimonio').update(config).eq('id', true).select('antecedencia_dias')
  if (error) return falha(error)
  // sem a permissão, o banco não muda nada e não dá erro: avisa
  return data.length === 0 ? { dados: null, erro: 'Só a presidência muda as regras do empréstimo.' } : ok(null)
}

// ---------- Empréstimos ----------

export type SituacaoEmprestimo = 'solicitado' | 'aprovado' | 'recusado' | 'cancelado' | 'retirado' | 'devolvido'

export const NOME_DA_SITUACAO_EMPRESTIMO: Record<SituacaoEmprestimo, string> = {
  solicitado: 'Esperando a aprovação',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  retirado: 'Retirado (com a igreja)',
  devolvido: 'Devolvido',
}

export const CLASSE_DA_SITUACAO_EMPRESTIMO: Record<SituacaoEmprestimo, string> = {
  solicitado: 'etiqueta etiqueta-conferencia',
  aprovado: 'etiqueta etiqueta-ok',
  recusado: 'etiqueta etiqueta-cancelada',
  cancelado: 'etiqueta etiqueta-cancelada',
  retirado: 'etiqueta etiqueta-marca',
  devolvido: 'etiqueta etiqueta-neutra',
}

export type ItemEmprestado = { id: string; item_id: string; quantidade: number; devolvida: number | null; item: { nome: string } | null }

export type Emprestimo = {
  id: string
  igreja_id: string | null
  evento_id: string | null
  solicitante_id: string
  retirada: string
  devolucao: string
  finalidade: string
  situacao: SituacaoEmprestimo
  termo_texto: string | null
  termo_aceito_em: string | null
  decidido_em: string | null
  motivo: string | null
  retirado_em: string | null
  retirado_por_nome: string | null
  devolvido_em: string | null
  observacao_devolucao: string | null
  criado_em: string
  igreja: { nome: string } | null
  evento: { titulo: string } | null
  solicitante: { nome: string } | null
  itens: ItemEmprestado[]
}

const CAMPOS_EMPRESTIMO = `id, igreja_id, evento_id, solicitante_id, retirada, devolucao, finalidade, situacao, termo_texto, termo_aceito_em,
  decidido_em, motivo, retirado_em, retirado_por_nome, devolvido_em, observacao_devolucao, criado_em,
  igreja:igrejas(nome), evento:eventos(titulo), solicitante:pessoas!emprestimos_solicitante_id_fkey(nome),
  itens:emprestimo_itens(id, item_id, quantidade, devolvida, item:patrimonio_itens(nome))`

/** O banco mostra a cada um só o que pode ver: a equipe e o Conselho Fiscal, todos; o pastor, os da sua igreja. */
export async function listarEmprestimos(): Promise<Resultado<Emprestimo[]>> {
  const { data, error } = await cliente()
    .from('emprestimos')
    .select(CAMPOS_EMPRESTIMO)
    .order('retirada', { ascending: false })
    .limit(300)
    .returns<Emprestimo[]>()
  return error ? falha(error) : ok(data)
}

export async function buscarEmprestimo(id: string): Promise<Resultado<Emprestimo | null>> {
  const { data, error } = await cliente().from('emprestimos').select(CAMPOS_EMPRESTIMO).eq('id', id).maybeSingle<Emprestimo>()
  return error ? falha(error) : ok(data)
}

/** situacao: regular, suspensa ou sem_registro (Fase 5.5): só a regular pega empréstimo. */
export type IgrejaDoPedido = { id: string; nome: string; ministros: number; em_dia: number; situacao?: string }

export async function igrejasDoPedido(): Promise<Resultado<IgrejaDoPedido[]>> {
  const { data, error } = await cliente().rpc('igrejas_do_pedido')
  return error ? falha(error) : ok((data ?? []) as IgrejaDoPedido[])
}

export type NovoPedido = {
  igreja_id: string | null
  evento_id: string | null
  retirada: string
  devolucao: string
  finalidade: string
  aceite: boolean
  /** a secretaria (ou a presidência) registra direto, já aprovado */
  registrar_direto?: boolean
  itens: { item_id: string; quantidade: number }[]
}

export async function pedirEmprestimo(pedido: NovoPedido): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('pedir_emprestimo', { p_dados: pedido })
  return error ? falha(error) : ok(data as string)
}

export async function decidirEmprestimo(id: string, aprovar: boolean, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('decidir_emprestimo', { p_id: id, p_aprovar: aprovar, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function cancelarEmprestimo(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('cancelar_emprestimo', { p_id: id, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function registrarRetirada(id: string, retiradoPor: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('registrar_retirada', { p_id: id, p_retirado_por: retiradoPor })
  return error ? falha(error) : ok(null)
}

export async function registrarDevolucao(id: string, itens: { item_id: string; devolvida: number }[], observacao: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('registrar_devolucao', { p_id: id, p_itens: itens, p_observacao: observacao })
  return error ? falha(error) : ok(null)
}

// ---------- Agenda ----------

export type ReservaNaAgenda = {
  emprestimo_id: string
  retirada: string
  devolucao: string
  situacao: SituacaoEmprestimo
  quem: string
  itens: { item_id: string; nome: string; quantidade: number }[]
}

export async function agendaPatrimonio(de: string, ate: string): Promise<Resultado<ReservaNaAgenda[]>> {
  const { data, error } = await cliente().rpc('agenda_patrimonio', { p_de: de, p_ate: ate })
  return error ? falha(error) : ok((data ?? []) as ReservaNaAgenda[])
}

export async function livresNoPeriodo(de: string, ate: string): Promise<Resultado<Record<string, number>>> {
  const { data, error } = await cliente().rpc('livres_no_periodo', { p_de: de, p_ate: ate })
  if (error) return falha(error)
  return ok(Object.fromEntries(((data ?? []) as { item_id: string; livre: number }[]).map((l) => [l.item_id, l.livre])))
}
