interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** "teste" mostra a faixa de versão de teste; vazio = produção */
  readonly VITE_AMBIENTE?: string
  /** a chave PÚBLICA do envio dos avisos no celular (VAPID); vazio = o envio ainda não foi ligado */
  readonly VITE_VAPID_PUBLICA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
