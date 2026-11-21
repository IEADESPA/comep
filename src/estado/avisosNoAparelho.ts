// Os avisos NESTE aparelho (a notificação do próprio navegador, sem custo): pedir a permissão, inscrever o
// aparelho e guardar a inscrição no banco. Quem manda a notificação é a função supabase/functions/enviar-avisos.
//
// A chave PÚBLICA do envio (VAPID) vem de VITE_VAPID_PUBLICA (variável do repositório, como o endereço do
// Supabase; a chave privada fica só nos segredos da função). Sem ela, o aparelho não se inscreve: os avisos
// continuam no sino, e a tela diz que o envio para o celular ainda vai ser ligado.
import { cancelarInscricaoPush, registrarInscricaoPush } from '../dados/notificacoes'

export type EstadoNoAparelho =
  /** o navegador não tem a notificação (no iPhone, só com o aplicativo adicionado à tela de início) */
  | 'sem_suporte'
  /** a pessoa (ou o navegador) bloqueou */
  | 'bloqueado'
  /** ainda não perguntou */
  | 'perguntar'
  /** permitido, mas o envio ainda não foi ligado (falta a chave pública) */
  | 'sem_envio'
  /** permitido e inscrito: os avisos chegam aqui */
  | 'ativo'
  /** permitido, mas este aparelho não está inscrito */
  | 'parado'

export function chavePublicaDoEnvio(): string | null {
  const chave = import.meta.env.VITE_VAPID_PUBLICA?.trim()
  return chave ? chave : null
}

export function temSuporte(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

/** iPhone ou iPad fora do aplicativo instalado (lá a notificação só funciona depois de "Adicionar à Tela de Início"). */
export function ehIphoneSemInstalar(): boolean {
  if (typeof navigator === 'undefined') return false
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const instalado = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return ios && !instalado
}

/** "Celular · Chrome", "Computador · Edge": só para a pessoa reconhecer o aparelho na lista. */
export function nomeDoAparelho(): string {
  const ua = navigator.userAgent
  const tipo = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Android|iPhone|iPod|Mobile/i.test(ua) ? 'Celular' : 'Computador'
  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /OPR\//.test(ua)
          ? 'Opera'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'navegador'
  return `${tipo} · ${navegador}`
}

/** A chave pública (base64 de URL) no formato que o navegador pede. */
function paraBytes(base64: string): Uint8Array<ArrayBuffer> {
  const completo = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const texto = atob(completo)
  const bytes = new Uint8Array(new ArrayBuffer(texto.length))
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i)
  return bytes
}

/** O registro do aplicativo (service worker); null se não houver (por exemplo, no modo de desenvolvimento). */
async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!temSuporte()) return null
  const atual = await navigator.serviceWorker.getRegistration()
  if (atual) return atual
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((fim) => setTimeout(() => fim(null), 4000))])
}

/** Como estão os avisos neste aparelho agora. */
export async function estadoNoAparelho(): Promise<EstadoNoAparelho> {
  if (!temSuporte()) return 'sem_suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission === 'default') return 'perguntar'
  if (!chavePublicaDoEnvio()) return 'sem_envio'
  const reg = await registro()
  const inscricao = reg ? await reg.pushManager.getSubscription() : null
  return inscricao ? 'ativo' : 'parado'
}

async function guardar(inscricao: PushSubscription): Promise<string | null> {
  const json = inscricao.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!json.endpoint || !p256dh || !auth) return 'O navegador não deu os dados da inscrição. Tente de novo.'
  const r = await registrarInscricaoPush({ endpoint: json.endpoint, p256dh, auth, aparelho: nomeDoAparelho() })
  return r.erro
}

/**
 * "Sim, ativar": pede a permissão do navegador e inscreve este aparelho.
 * Devolve o estado final e, se deu errado, a mensagem.
 */
export async function ativarNoAparelho(): Promise<{ estado: EstadoNoAparelho; erro: string | null }> {
  if (!temSuporte()) return { estado: 'sem_suporte', erro: null }
  const permissao = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permissao === 'denied') return { estado: 'bloqueado', erro: null }
  if (permissao !== 'granted') return { estado: 'perguntar', erro: null }
  const chave = chavePublicaDoEnvio()
  if (!chave) return { estado: 'sem_envio', erro: null }
  try {
    const reg = await registro()
    if (!reg)
      return { estado: 'parado', erro: 'O aplicativo ainda está carregando neste aparelho. Feche e abra de novo, e tente outra vez.' }
    const inscricao =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chave) }))
    const erro = await guardar(inscricao)
    return { estado: erro ? 'parado' : 'ativo', erro }
  } catch {
    return { estado: 'parado', erro: 'Não foi possível ativar os avisos neste aparelho agora. Tente de novo em instantes.' }
  }
}

/** "Parar de receber neste aparelho". */
export async function desativarNoAparelho(): Promise<string | null> {
  const reg = await registro()
  const inscricao = reg ? await reg.pushManager.getSubscription() : null
  if (!inscricao) return null
  const r = await cancelarInscricaoPush({ endpoint: inscricao.endpoint })
  await inscricao.unsubscribe().catch(() => false)
  return r.erro
}

/**
 * Ao abrir o sistema: se a pessoa já ativou e o navegador permite, confere que este aparelho continua inscrito
 * (a inscrição pode ter mudado, ou a chave do envio pode ter chegado depois).
 */
export async function conferirInscricao(ativou: boolean): Promise<void> {
  if (!ativou || !temSuporte() || Notification.permission !== 'granted' || !chavePublicaDoEnvio()) return
  try {
    const reg = await registro()
    if (!reg) return
    const atual = await reg.pushManager.getSubscription()
    const inscricao =
      atual ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chavePublicaDoEnvio()!) }))
    await guardar(inscricao)
  } catch {
    // sem rede ou o navegador recusou: tenta de novo na próxima vez
  }
}
