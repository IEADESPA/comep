// O envio dos avisos em grupos: a parte da função enviar-avisos que não depende do Deno nem do web-push (o teste
// fica em testes/unidade/enviar-avisos.test.ts, no Node). Revisão permanente, módulo 1 (25/11/2026), achado S1-01:
//   - os envios de um grupo saem ao mesmo tempo, e cada um tem um prazo: o serviço que não responde não segura o resto;
//   - o resultado é gravado a cada grupo (push_resultado), e não só no fim: se a função for cortada no meio, o que já
//     foi mandado está anotado e o lote seguinte não repete;
//   - um aviso vai inteiro num grupo (todos os aparelhos da pessoa juntos): o banco conta UMA tentativa por aviso a
//     cada rodada;
//   - quando o tempo da rodada acaba, a função para de começar grupos novos; o resto fica para a rodada seguinte
//     (o agendamento chama a função de 5 em 5 minutos).

export type Pendente = {
  notificacao_id: string
  inscricao_id: string
  endpoint: string
  p256dh: string
  auth: string
  titulo: string
  texto: string
  link: string | null
  urgente: boolean
}

/** O resultado de um envio. status 0 = não houve resposta do serviço (a rede caiu ou passou o prazo). */
export type Resultado = { notificacao_id: string; inscricao_id: string; ok: boolean; status: number }

/** Quantos envios saem ao mesmo tempo (um aviso com mais aparelhos vai inteiro, até 10). */
export const ENVIOS_POR_GRUPO = 10
/** O prazo de cada envio. O serviço de push responde em menos de 1 s; 10 s é folga para a rede ruim. */
export const TEMPO_POR_ENVIO_MS = 10_000
/**
 * Depois deste tempo a função não começa grupo novo. O Supabase corta a função em 150 s (plano gratuito): o último
 * grupo começa antes de 60 s e termina antes de 70 s, com folga para gravar o resultado.
 */
export const TEMPO_DA_RODADA_MS = 60_000

export type Opcoes = {
  porGrupo: number
  tempoPorEnvioMs: number
  tempoDaRodadaMs: number
  /** O relógio (o teste usa um de mentira). */
  agora: () => number
}

/** O código da resposta do serviço que recusou o envio, ou 0 quando não houve resposta (rede, prazo). */
export function statusDoErro(erro: unknown): number {
  if (typeof erro !== 'object' || erro === null || !('statusCode' in erro)) return 0
  const status = Number((erro as { statusCode: unknown }).statusCode)
  return Number.isInteger(status) && status > 0 ? status : 0
}

/** Espera a promessa até o prazo; depois dele, desiste com status 0. */
async function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined
  const prazo = new Promise<never>((_, desistir) => {
    relogio = setTimeout(() => desistir(new Error(`O serviço de push não respondeu em ${ms} ms.`)), ms)
  })
  try {
    return await Promise.race([promessa, prazo])
  } finally {
    clearTimeout(relogio)
  }
}

/**
 * Separa o lote em grupos de até `porGrupo` linhas, sem dividir um aviso: as linhas do mesmo aviso ficam juntas
 * (na ordem em que o aviso aparece primeiro), e o aviso maior que o grupo vai sozinho.
 */
export function emGrupos(pendentes: Pendente[], porGrupo: number): Pendente[][] {
  const porAviso = new Map<string, Pendente[]>()
  for (const p of pendentes) {
    const doAviso = porAviso.get(p.notificacao_id)
    if (doAviso) doAviso.push(p)
    else porAviso.set(p.notificacao_id, [p])
  }
  const grupos: Pendente[][] = []
  let atual: Pendente[] = []
  for (const linhas of porAviso.values()) {
    if (atual.length > 0 && atual.length + linhas.length > porGrupo) {
      grupos.push(atual)
      atual = []
    }
    atual.push(...linhas)
  }
  if (atual.length > 0) grupos.push(atual)
  return grupos
}

/**
 * Manda o lote em grupos. `enviar` devolve o status da resposta (ou lança o erro do serviço); `gravar` guarda os
 * resultados de um grupo e devolve a mensagem de erro, ou null. Se gravar falhar, para: o que foi mandado e não
 * anotado não deve ser mandado de novo às cegas, e o resto fica para a rodada seguinte.
 */
export async function enviarEmGrupos(
  pendentes: Pendente[],
  enviar: (p: Pendente) => Promise<number>,
  gravar: (resultados: Resultado[]) => Promise<string | null>,
  opcoes: Partial<Opcoes> = {},
): Promise<{ enviados: number; falhas: number; ficaram: number; erro: string | null }> {
  const porGrupo = opcoes.porGrupo ?? ENVIOS_POR_GRUPO
  const tempoPorEnvioMs = opcoes.tempoPorEnvioMs ?? TEMPO_POR_ENVIO_MS
  const tempoDaRodadaMs = opcoes.tempoDaRodadaMs ?? TEMPO_DA_RODADA_MS
  const agora = opcoes.agora ?? Date.now
  const grupos = emGrupos(pendentes, porGrupo)
  const inicio = agora()
  let enviados = 0
  let falhas = 0
  const restantes = (desde: number) => grupos.slice(desde).reduce((soma, g) => soma + g.length, 0)

  for (let i = 0; i < grupos.length; i++) {
    if (agora() - inicio >= tempoDaRodadaMs) return { enviados, falhas, ficaram: restantes(i), erro: null }
    const resultados = await Promise.all(
      grupos[i].map(async (p): Promise<Resultado> => {
        try {
          const status = await comPrazo(enviar(p), tempoPorEnvioMs)
          return { notificacao_id: p.notificacao_id, inscricao_id: p.inscricao_id, ok: true, status }
        } catch (erro) {
          return { notificacao_id: p.notificacao_id, inscricao_id: p.inscricao_id, ok: false, status: statusDoErro(erro) }
        }
      }),
    )
    enviados += resultados.filter((r) => r.ok).length
    falhas += resultados.filter((r) => !r.ok).length
    const erro = await gravar(resultados)
    if (erro !== null) return { enviados, falhas, ficaram: restantes(i + 1), erro }
  }
  return { enviados, falhas, ficaram: 0, erro: null }
}
