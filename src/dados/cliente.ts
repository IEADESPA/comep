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
