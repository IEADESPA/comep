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

/** Sai de todos os OUTROS aparelhos (este continua conectado). */
export async function sairDosOutrosAparelhos(): Promise<{ erro: string | null }> {
  const { error } = await cliente().auth.signOut({ scope: 'others' })
  return { erro: error ? 'Não foi possível sair dos outros aparelhos agora. Tente de novo em instantes.' : null }
}

/** Quanto tempo a pessoa fica conectada no aparelho (telas novas, parte 13): 30 dias; depois, entra de novo. */
export const DIAS_CONECTADO = 30

/**
 * Quando a pessoa entrou neste aparelho (a senha, ou outro jeito de entrar): vem do próprio token do login
 * (o "amr" guarda a hora de cada jeito de entrar, e a renovação do token não muda essa hora).
 */
export async function entrouEm(): Promise<Date | null> {
  const { data } = await cliente().auth.getSession()
  const token = data.session?.access_token
  if (!token) return null
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const conteudo = JSON.parse(atob(parte + '='.repeat((4 - (parte.length % 4)) % 4))) as { amr?: { timestamp?: number }[]; iat?: number }
    const horas = (conteudo.amr ?? []).map((a) => a.timestamp).filter((t): t is number => typeof t === 'number')
    const segundos = horas.length > 0 ? Math.min(...horas) : conteudo.iat
    return typeof segundos === 'number' ? new Date(segundos * 1000) : null
  } catch {
    return null
  }
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
