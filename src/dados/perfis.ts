import { cliente, ehBancoNaoPreparado } from './cliente'

// Mesma lista do tipo "perfil_acesso" no banco (supabase/migrations).
export const PERFIS = [
  'ministro',
  'presidente_igreja',
  'secretaria',
  'tesouraria',
  'presidencia',
  'admin_tecnico',
  'conselho_fiscal',
] as const

export type Perfil = (typeof PERFIS)[number]

export const NOME_DO_PERFIL: Record<Perfil, string> = {
  ministro: 'Ministro',
  presidente_igreja: 'Presidente de igreja',
  secretaria: 'Secretaria',
  tesouraria: 'Tesouraria',
  presidencia: 'Presidência',
  admin_tecnico: 'Administrador técnico',
  conselho_fiscal: 'Conselho Fiscal',
}

export type MinhaConta = {
  pessoaId: string
  nome: string
  perfis: Perfil[]
}

export type ResultadoConta =
  | { tipo: 'ok'; conta: MinhaConta }
  | { tipo: 'sem_cadastro' }
  | { tipo: 'banco_nao_preparado' }
  | { tipo: 'erro'; mensagem: string }

type LinhaPessoa = {
  id: string
  nome: string
  perfis_acesso: { perfil: Perfil }[]
}

/** Busca o cadastro e os perfis de quem está logado. O banco (RLS) só devolve o que a pessoa pode ver. */
export async function buscarMinhaConta(usuarioId: string): Promise<ResultadoConta> {
  const { data, error } = await cliente()
    .from('pessoas')
    .select('id, nome, perfis_acesso(perfil)')
    .eq('usuario_id', usuarioId)
    .is('arquivado_em', null)
    .is('perfis_acesso.arquivado_em', null)
    .maybeSingle<LinhaPessoa>()

  if (error) {
    if (ehBancoNaoPreparado(error.code)) return { tipo: 'banco_nao_preparado' }
    return { tipo: 'erro', mensagem: 'Não foi possível carregar o seu cadastro. Tente de novo em instantes.' }
  }
  if (!data) return { tipo: 'sem_cadastro' }

  return {
    tipo: 'ok',
    conta: {
      pessoaId: data.id,
      nome: data.nome,
      perfis: data.perfis_acesso.map((p) => p.perfil),
    },
  }
}
