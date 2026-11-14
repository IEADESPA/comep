// Fase 5.2 — Comissões (Art. 3º, IV; Art. 9º, III): a presidência e a secretaria criam e indicam os membros (só
// associados); o coordenador registra as reuniões, as atividades e os avisos da comissão.
import { cliente, falha, ok, type Resultado } from './cliente'

export type TipoComissao = 'permanente' | 'temporaria'
export type TipoRegistroComissao = 'reuniao' | 'atividade' | 'aviso'

export const NOME_DO_TIPO_COMISSAO: Record<TipoComissao, string> = { permanente: 'Permanente', temporaria: 'Temporária' }
export const NOME_DO_REGISTRO: Record<TipoRegistroComissao, string> = { reuniao: 'Reunião', atividade: 'Atividade', aviso: 'Aviso' }

/** As áreas do Art. 3º, IV (a lista é só sugestão; dá para escrever outra). */
export const AREAS_SUGERIDAS = ['Educação', 'Segurança', 'Saúde', 'Política', 'Cidadania']

export type Comissao = {
  id: string
  nome: string
  tipo: TipoComissao
  area: string | null
  finalidade: string | null
  inicio: string
  fim: string | null
  encerrada_em: string | null
  motivo_encerramento: string | null
}

export type MembroComissao = {
  id: string
  comissao_id: string
  pessoa_id: string
  nome: string | null
  coordenador: boolean
  desde: string
  ate: string | null
}

export type RegistroComissao = {
  id: string
  tipo: TipoRegistroComissao
  data: string
  titulo: string
  texto: string | null
  autor_id: string | null
}

const CAMPOS = 'id, nome, tipo, area, finalidade, inicio, fim, encerrada_em, motivo_encerramento'

export async function listarComissoes(): Promise<Resultado<{ comissoes: Comissao[]; membros: MembroComissao[] }>> {
  const [comissoes, membros] = await Promise.all([
    cliente().from('comissoes').select(CAMPOS).order('nome').returns<Comissao[]>(),
    cliente().from('vw_comissao_membros').select('*').is('ate', null).returns<MembroComissao[]>(),
  ])
  if (comissoes.error) return falha(comissoes.error)
  if (membros.error) return falha(membros.error)
  return ok({ comissoes: comissoes.data, membros: membros.data })
}

export type ComissaoCompleta = Comissao & { membros: MembroComissao[]; registros: RegistroComissao[]; coordeno: boolean }

export async function buscarComissao(id: string): Promise<Resultado<ComissaoCompleta | null>> {
  const [comissao, membros, registros, coordeno] = await Promise.all([
    cliente().from('comissoes').select(CAMPOS).eq('id', id).maybeSingle<Comissao>(),
    cliente().from('vw_comissao_membros').select('*').eq('comissao_id', id).order('desde').returns<MembroComissao[]>(),
    // só os membros e a diretoria leem os registros (a RLS devolve vazio para os outros)
    cliente()
      .from('comissao_registros')
      .select('id, tipo, data, titulo, texto, autor_id')
      .eq('comissao_id', id)
      .order('data', { ascending: false })
      .limit(200)
      .returns<RegistroComissao[]>(),
    cliente().rpc('coordeno_a_comissao', { p_comissao_id: id }),
  ])
  if (comissao.error) return falha(comissao.error)
  if (!comissao.data) return ok(null)
  if (membros.error) return falha(membros.error)
  if (registros.error) return falha(registros.error)
  if (coordeno.error) return falha(coordeno.error)
  return ok({ ...comissao.data, membros: membros.data, registros: registros.data, coordeno: coordeno.data === true })
}

export type DadosComissao = { nome: string; tipo: TipoComissao; area: string; finalidade: string; inicio: string; fim: string }

export async function salvarComissao(id: string | null, dados: DadosComissao): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('salvar_comissao', { p_id: id, p_dados: dados })
  return error ? falha(error) : ok(data as string)
}

export async function encerrarComissao(id: string, data: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('encerrar_comissao', { p_id: id, p_data: data, p_motivo: motivo })
  return error ? falha(error) : ok(null)
}

export async function incluirMembro(comissaoId: string, pessoaId: string, coordenador: boolean): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('incluir_membro_comissao', { p_comissao_id: comissaoId, p_pessoa_id: pessoaId, p_coordenador: coordenador })
  return error ? falha(error) : ok(null)
}

export async function definirCoordenador(comissaoId: string, pessoaId: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('definir_coordenador', { p_comissao_id: comissaoId, p_pessoa_id: pessoaId })
  return error ? falha(error) : ok(null)
}

export async function retirarMembro(membroId: string, data: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('retirar_membro_comissao', { p_membro_id: membroId, p_data: data || null })
  return error ? falha(error) : ok(null)
}

export async function registrarNaComissao(
  comissaoId: string,
  dados: { tipo: TipoRegistroComissao; data: string; titulo: string; texto: string },
): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('registrar_na_comissao', {
    p_comissao_id: comissaoId,
    p_tipo: dados.tipo,
    p_data: dados.data,
    p_titulo: dados.titulo,
    p_texto: dados.texto,
  })
  return error ? falha(error) : ok(null)
}

export async function arquivarRegistro(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('arquivar_registro_comissao', { p_id: id })
  return error ? falha(error) : ok(null)
}

/** Em atividade: não encerrada e, se temporária, dentro do prazo. */
export function comissaoAtiva(c: Pick<Comissao, 'encerrada_em' | 'fim'>, hoje: string): boolean {
  return !c.encerrada_em && (!c.fim || c.fim >= hoje)
}
