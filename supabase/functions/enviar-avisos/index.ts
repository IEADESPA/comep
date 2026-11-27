// Os avisos no celular (telas novas, Fase 5.5, parte 11): a função que manda a notificação do navegador (Web Push).
//
// Roda no Supabase (Edge Functions, Deno). Pega no banco o que falta mandar (public.push_pendentes: só para quem
// ativou, o assunto que a pessoa quer, fora do silêncio da noite, ainda não lido, no máximo 3 avisos por pessoa) e
// devolve o resultado de cada envio (public.push_resultado: o aparelho que não existe mais é arquivado). Sem custo:
// quem entrega é o serviço do próprio navegador (Google, Mozilla, Apple, Microsoft).
// Os envios saem em grupos, cada um com prazo, e o resultado é gravado a cada grupo (envio.ts; revisão de segurança
// de 25/11/2026, achado S1-01).
//
// Segredos (nunca no repositório; ficam em Supabase › Edge Functions › Secrets):
//   VAPID_PUBLICA, VAPID_PRIVADA  o par de chaves do envio (npx web-push generate-vapid-keys)
//   VAPID_CONTATO                 "mailto:" de quem responde pelo envio (exigido pelos serviços de push)
//   ENVIO_SEGREDO                 uma senha longa, que o agendamento manda no cabeçalho x-comep-envio
// O Supabase já dá SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY a toda função.
// O roteiro completo para ligar está em docs/avisos-no-celular.md.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import webpush from 'npm:web-push@3.6.7'
import { enviarEmGrupos, TEMPO_POR_ENVIO_MS, type Pendente } from './envio.ts'

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

/** Compara o segredo sem dar pista pelo tempo da resposta. */
function mesmoSegredo(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diferenca = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diferenca |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diferenca === 0
}

Deno.serve(async (pedido: Request) => {
  if (pedido.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405)

  const segredo = Deno.env.get('ENVIO_SEGREDO') ?? ''
  if (segredo.length < 20 || !mesmoSegredo(pedido.headers.get('x-comep-envio') ?? '', segredo)) {
    return resposta({ erro: 'Sem permissão.' }, 401)
  }

  const publica = Deno.env.get('VAPID_PUBLICA')
  const privada = Deno.env.get('VAPID_PRIVADA')
  const contato = Deno.env.get('VAPID_CONTATO')
  const url = Deno.env.get('SUPABASE_URL')
  const chaveSecreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!publica || !privada || !contato || !url || !chaveSecreta) {
    return resposta({ erro: 'Faltam os segredos do envio (VAPID_PUBLICA, VAPID_PRIVADA e VAPID_CONTATO).' }, 500)
  }
  webpush.setVapidDetails(contato, publica, privada)

  const banco = createClient(url, chaveSecreta, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await banco.rpc('push_pendentes', { p_limite: 200 })
  if (error) return resposta({ erro: `Não foi possível ler os avisos: ${error.message}` }, 500)

  const envio = await enviarEmGrupos(
    (data ?? []) as Pendente[],
    async (p) => {
      const conteudo = JSON.stringify({ id: p.notificacao_id, titulo: p.titulo, texto: p.texto, link: p.link, urgente: p.urgente })
      const r = await webpush.sendNotification({ endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } }, conteudo, {
        // o aviso espera até 1 dia o aparelho aparecer (celular desligado, sem internet)
        TTL: 24 * 60 * 60,
        urgency: p.urgente ? 'high' : 'normal',
        // a conexão parada desiste sozinha; o prazo total de cada envio fica com o envio.ts
        timeout: TEMPO_POR_ENVIO_MS,
      })
      return r.statusCode
    },
    async (resultados) => {
      const gravado = await banco.rpc('push_resultado', { p_resultados: resultados })
      return gravado.error ? gravado.error.message : null
    },
  )

  if (envio.erro !== null) {
    return resposta(
      {
        erro: `Parte dos avisos foi mandada, mas o resultado de um grupo não foi guardado: ${envio.erro}`,
        enviados: envio.enviados,
        falhas: envio.falhas,
        ficaram: envio.ficaram,
      },
      500,
    )
  }
  return resposta({ enviados: envio.enviados, falhas: envio.falhas, ficaram: envio.ficaram })
})
