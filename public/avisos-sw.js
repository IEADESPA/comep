/* Os avisos no celular (telas novas, Fase 5.5, parte 11): o pedaço do service worker que mostra a notificação
   do navegador e abre o sistema no lugar certo ao tocar nela. Entra no service worker do aplicativo pelo
   "importScripts" (vite.config.ts). O conteúdo vem da função supabase/functions/enviar-avisos:
   { "titulo": "...", "texto": "...", "link": "/votacoes/...", "id": "<id da notificação>", "urgente": false } */

self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { texto: evento.data ? evento.data.text() : '' }
  }
  const titulo = dados.titulo || 'COMEP'
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.texto || '',
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
      lang: 'pt-BR',
      tag: dados.id || undefined,
      requireInteraction: Boolean(dados.urgente),
      data: { link: dados.link || '/painel' },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const link = (evento.notification.data && evento.notification.data.link) || '/painel'
  // só endereços do próprio sistema (nunca um site de fora)
  const caminho = /^\/(?!\/)/.test(link) ? link.slice(1) : 'painel'
  const destino = new URL(caminho, self.registration.scope).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.startsWith(self.registration.scope) && 'focus' in janela) {
          return janela.navigate(destino).then((j) => (j || janela).focus())
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
