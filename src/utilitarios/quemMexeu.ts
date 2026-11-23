// "Quem mexeu nos seus dados" (Meu perfil › Privacidade): as linhas iguais, do mesmo autor e do mesmo dia, viram uma
// só, com a quantidade (D-13, 22/11/2026). Exemplo: as 12 mensalidades geradas de uma vez eram 12 linhas iguais.

export type MudancaNosDados = { em: string; quem: string; o_que: string; operacao: 'INSERT' | 'UPDATE' | 'DELETE' }

export type MudancaAgrupada<T extends MudancaNosDados> = T & { vezes: number }

/** O dia em Parauapebas (aaaa-mm-dd) de um instante. */
const diaEmParauapebas = (instante: string) => new Date(instante).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })

/** Junta as mudanças iguais (mesmo autor, mesmo dia, mesma operação e mesmo dado), na ordem em que chegaram. */
export function agruparQuemMexeu<T extends MudancaNosDados>(linhas: readonly T[]): MudancaAgrupada<T>[] {
  const grupos = new Map<string, MudancaAgrupada<T>>()
  for (const l of linhas) {
    const chave = [diaEmParauapebas(l.em), l.quem, l.operacao, l.o_que].join('\u0000')
    const grupo = grupos.get(chave)
    if (grupo) grupo.vezes++
    else grupos.set(chave, { ...l, vezes: 1 })
  }
  return [...grupos.values()]
}
