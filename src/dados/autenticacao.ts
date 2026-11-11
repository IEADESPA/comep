import type { AuthError, Session } from '@supabase/supabase-js'
import { cliente } from './cliente'

export type Sessao = {
  usuarioId: string
  email: string | null
}

function paraSessao(s: Session | null): Sessao | null {
  return s ? { usuarioId: s.user.id, email: s.user.email ?? null } : null
}

function mensagemDeErro(erro: AuthError): string {
  switch (erro.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.'
    case 'email_not_confirmed':
      return 'Confirme o seu e-mail antes de entrar (veja a mensagem que enviamos).'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
    case 'user_banned':
      return 'Este acesso está bloqueado. Procure a secretaria do Conselho.'
    default:
      return 'Não foi possível entrar agora. Verifique a internet e tente de novo.'
  }
}

export async function entrarComEmail(email: string, senha: string): Promise<{ erro: string | null }> {
  const { error } = await cliente().auth.signInWithPassword({ email: email.trim(), password: senha })
  return { erro: error ? mensagemDeErro(error) : null }
}

/** Sai só deste aparelho (os outros aparelhos da pessoa continuam conectados). */
export async function sair(): Promise<void> {
  await cliente().auth.signOut({ scope: 'local' })
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const { data } = await cliente().auth.getSession()
  return paraSessao(data.session)
}

/** Avisa sempre que a pessoa entra ou sai. Devolve uma função para parar de escutar. */
export function aoMudarSessao(callback: (sessao: Sessao | null) => void): () => void {
  const { data } = cliente().auth.onAuthStateChange((_evento, s) => {
    // Não chamar o banco aqui dentro (recomendação do Supabase): só repassa a sessão.
    callback(paraSessao(s))
  })
  return () => data.subscription.unsubscribe()
}
