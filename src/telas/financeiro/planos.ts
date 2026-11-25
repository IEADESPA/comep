// Os planos do exercício em Financeiro › Contribuições › Valores e planos (D-16, 25/11/2026).
// O plano escolhido fica guardado no banco mesmo quando a pessoa deixa de ser associada (arquivada, desligada) ou passa
// a jubilado. A conta da tela é a mesma das cobranças (PROJETO.md 4.4; gerar_cobrancas): só quem paga hoje, isto é, o
// associado ativo e não jubilado. Quem não escolheu paga por mês. Assim o ano inteiro e o mês somam quem paga, o mesmo
// número da Situação dos ministros.

export type PlanoGuardado = { pessoa_id: string; tipo: 'mensal' | 'anual' }
export type QuemPaga = { pessoa_id: string; jubilado: boolean }

/** Dos associados ativos, quantos pagam, quantos escolheram o ano inteiro e quantos pagam por mês. */
export function contarPlanos(
  planos: readonly PlanoGuardado[],
  associados: readonly QuemPaga[],
): { anual: number; mensal: number; pagantes: number } {
  const escolheramOAno = new Set(planos.filter((p) => p.tipo === 'anual').map((p) => p.pessoa_id))
  const pagantes = associados.filter((a) => !a.jubilado)
  const anual = pagantes.filter((a) => escolheramOAno.has(a.pessoa_id)).length
  return { anual, mensal: pagantes.length - anual, pagantes: pagantes.length }
}
