// Perfis de acesso (tela da presidência) e auditoria.
import { cliente, falha, ok, type Resultado } from './cliente'
import type { Perfil } from './perfis'

export type PerfilConcedido = { id: string; perfil: Perfil }

export type PessoaComPerfis = {
  id: string
  nome: string
  email: string | null
  usuario_id: string | null
  criado_em: string
  perfis_acesso: PerfilConcedido[]
  /** Cadastro de associado ativo (conferido). Sem ele, é só um login criado pelo site. */
  associados: { numero_registro: number; situacao: string }[]
}

export async function listarPessoasComPerfis(): Promise<Resultado<PessoaComPerfis[]>> {
  const { data, error } = await cliente()
    .from('pessoas')
    .select('id, nome, email, usuario_id, criado_em, perfis_acesso(id, perfil), associados(numero_registro, situacao)')
    .is('arquivado_em', null)
    .is('perfis_acesso.arquivado_em', null)
    .is('associados.arquivado_em', null)
    .order('nome')
    .returns<PessoaComPerfis[]>()
  return error ? falha(error) : ok(data)
}

export async function concederPerfil(pessoaId: string, perfil: Perfil): Promise<Resultado<null>> {
  const { error } = await cliente().from('perfis_acesso').insert({ pessoa_id: pessoaId, perfil })
  return error ? falha(error, 'Esta pessoa já tem esse perfil.') : ok(null)
}

export async function retirarPerfil(perfilAcessoId: string): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('perfis_acesso')
    .update({ arquivado_em: new Date().toISOString() })
    .eq('id', perfilAcessoId)
  return error ? falha(error) : ok(null)
}

// ---------- Auditoria ----------

export type RegistroAuditoria = {
  id: number
  tabela: string
  registro_id: string | null
  operacao: 'INSERT' | 'UPDATE' | 'DELETE'
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  usuario_id: string | null
  ocorrido_em: string
}

export type PaginaAuditoria = {
  registros: RegistroAuditoria[]
  /** Nome de quem fez cada alteração, pelo id do login */
  nomes: Record<string, string>
  /** Nome da pessoa a quem o registro se refere (títulos, vínculos, associados), pelo id da pessoa */
  pessoas: Record<string, string>
  temMais: boolean
}

const POR_PAGINA = 30

export async function listarAuditoria(tabela: string, pagina: number): Promise<Resultado<PaginaAuditoria>> {
  let consulta = cliente()
    .from('auditoria')
    .select('id, tabela, registro_id, operacao, dados_antes, dados_depois, usuario_id, ocorrido_em')
    .order('id', { ascending: false })
    .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA) // um a mais, para saber se há próxima página
  if (tabela) consulta = consulta.eq('tabela', tabela)

  const { data, error } = await consulta.returns<RegistroAuditoria[]>()
  if (error) return falha(error)

  const registros = data.slice(0, POR_PAGINA)
  const unicos = (lista: unknown[]) => [...new Set(lista.filter((v): v is string => typeof v === 'string'))]
  const usuarios = unicos(registros.map((r) => r.usuario_id))
  const idsPessoas = unicos(registros.map((r) => (r.dados_depois ?? r.dados_antes)?.pessoa_id))

  const [quemFez, aQuem] = await Promise.all([
    usuarios.length ? cliente().from('pessoas').select('usuario_id, nome').in('usuario_id', usuarios) : null,
    idsPessoas.length ? cliente().from('pessoas').select('id, nome').in('id', idsPessoas) : null,
  ])
  const nomes: Record<string, string> = {}
  for (const p of quemFez?.data ?? []) nomes[p.usuario_id as string] = p.nome as string
  const pessoas: Record<string, string> = {}
  for (const p of aQuem?.data ?? []) pessoas[p.id as string] = p.nome as string

  return ok({ registros, nomes, pessoas, temMais: data.length > POR_PAGINA })
}
