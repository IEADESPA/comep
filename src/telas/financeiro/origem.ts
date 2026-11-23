// "De onde veio" no extrato do Caixa (D-05, 22/11/2026). O banco manda o link da origem para a tela de quem a criou
// (a ficha do ministro, Credenciais › Modelos…), mas quem mais usa o Caixa é a tesouraria, que não abre essas telas.
// Aqui o link vira o de uma tela que quem está vendo pode abrir, ou some (fica só o texto).
import { funcaoVisivel, ITENS_MENU, localizar, podeVer } from '../../componentes/menu.ts'
import type { Perfil } from '../../dados/perfis'

/** Se a pessoa abre o endereço: o item do menu e a função (com os perfis dela) que o endereço é. */
export function podeAbrir(caminho: string, perfis: readonly Perfil[]): boolean {
  const local = localizar(caminho.split('?')[0])
  if (!local) return false
  if (local.funcao) return funcaoVisivel(local.funcao, local.modulo, perfis)
  const item = ITENS_MENU.find((i) => i.caminho === local.modulo.item)
  return item !== undefined && podeVer(item, perfis)
}

const CONTRIBUICAO = /^\/ministros\/([0-9a-f-]{36})\/contribuicao$/
const MODELO_EXCLUSIVO = /^\/credenciais\/modelos\/[0-9a-f-]{36}\/quem-recebe$/

/** O link de "De onde veio" para quem está vendo; null = mostrar só o texto. */
export function linkDaOrigem(link: string | null, perfis: readonly Perfil[]): string | null {
  if (!link) return null
  if (podeAbrir(link, perfis)) return link
  // a contribuição: o ministro em Financeiro › Contribuições
  const ministro = CONTRIBUICAO.exec(link)?.[1]
  if (ministro) {
    const outro = `/financeiro/contribuicoes?ministro=${ministro}`
    return podeAbrir(outro, perfis) ? outro : null
  }
  // o modelo exclusivo da credencial: Financeiro › Caixa › Modelos exclusivos (só quem recebe o pagamento)
  if (MODELO_EXCLUSIVO.test(link)) return perfis.includes('tesouraria') || perfis.includes('presidencia') ? '/financeiro/caixa/modelos' : null
  return null
}
