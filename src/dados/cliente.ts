// Único ponto de conexão com o Supabase.
// Regra de portabilidade (PROJETO.md, seção 5): as telas nunca importam o Supabase;
// elas usam as funções desta pasta. Numa migração de servidor, só src/dados/ muda.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const chavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const bancoConfigurado = Boolean(url && chavePublica)

const supabase: SupabaseClient | null =
  url && chavePublica
    ? createClient(url, chavePublica, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

export function cliente(): SupabaseClient {
  if (!supabase) {
    throw new Error('Banco de dados não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
  }
  return supabase
}

/** Erros do banco que indicam que as tabelas ainda não foram criadas (migração não aplicada). */
export function ehBancoNaoPreparado(codigo: string | undefined): boolean {
  return codigo === 'PGRST205' || codigo === '42P01'
}

/** Resultado das operações de src/dados: ou os dados, ou uma mensagem pronta para a tela. */
export type Resultado<T> = { dados: T; erro: null } | { dados: null; erro: string }

type ErroDoBanco = { code?: string; message?: string } | null

/**
 * Traduz o erro do banco para uma mensagem em português.
 * As regras do próprio banco (código P0001) já trazem a mensagem escrita para o usuário.
 */
export function mensagemDeErro(erro: ErroDoBanco, duplicado = 'Já existe um cadastro com esses dados.'): string {
  const codigo = erro?.code ?? ''
  const texto = erro?.message ?? ''
  if (codigo === 'P0001' && texto) return texto
  if (codigo === '23505') return duplicado
  if (codigo === '23514') return 'Algum dado está fora do formato esperado. Confira e tente de novo.'
  // As funções do banco explicam a recusa em português; a recusa genérica do Postgres, não
  if (codigo === '42501') return texto && !/permission denied/i.test(texto) ? texto : 'Você não tem permissão para fazer isso.'
  if (codigo === '22007' || codigo === '22008') return 'Data inválida.'
  if (/fetch|network/i.test(texto)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  return 'Não foi possível concluir agora. Tente de novo em instantes.'
}

export function ok<T>(dados: T): Resultado<T> {
  return { dados, erro: null }
}

export function falha<T>(erro: ErroDoBanco, duplicado?: string): Resultado<T> {
  return { dados: null, erro: mensagemDeErro(erro, duplicado) }
}

/**
 * Busca todas as linhas de uma consulta, de mil em mil: o servidor devolve no máximo mil por vez
 * e cortaria o resto sem avisar. A consulta precisa ter uma ordem estável (ex.: terminar em .order('id')).
 */
export async function todasAsLinhas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: ErroDoBanco }>,
  tamanho = 1000,
): Promise<Resultado<T[]>> {
  const linhas: T[] = []
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pagina(de, de + tamanho - 1)
    if (error) return falha(error)
    linhas.push(...(data ?? []))
    if (!data || data.length < tamanho) return ok(linhas)
  }
}
