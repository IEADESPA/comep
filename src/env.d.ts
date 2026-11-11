interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** "teste" mostra a faixa de versão de teste; vazio = produção */
  readonly VITE_AMBIENTE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
