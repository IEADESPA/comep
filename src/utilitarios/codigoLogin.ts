// "Tenho um código" (S5-04; a tela `codigo-login` da rodada 37): as frases do "É você?" e do "Pronto".
// Quem criou a conta pelo site e já é associado liga a conta ao cadastro que a secretaria fez.
import { formatarData, formatarDataDeInstante, numeroDoRegistro } from './formatos.ts'

export type PedidoDaConta = 'enviado' | 'pendencia' | 'aguardando_assembleia'

/** O código como a secretaria mandou: maiúsculas, de 4 em 4 (XXXX-XXXX-XXXX). */
export function codigoParaMostrar(codigo: string): string {
  const limpo = codigo.toUpperCase().replace(/[^0-9A-Z]/g, '')
  return (limpo.match(/.{1,4}/g) ?? []).join('-')
}

/** O e-mail com o meio escondido (jo•••@exemplo.com): a tela confirma a conta sem mostrar o e-mail inteiro. */
export function emailMascarado(email: string): string {
  if (!email) return ''
  const [usuario, dominio] = email.split('@')
  return `${usuario.slice(0, 2)}•••${dominio ? `@${dominio}` : ''}`
}

export function fraseDoPedido(situacao: PedidoDaConta): string {
  if (situacao === 'pendencia') return 'com pendência'
  if (situacao === 'aguardando_assembleia') return 'aguardando a assembleia'
  return 'em análise'
}

/** "A sua conta": o e-mail, quando foi criada e o pedido de associação aberto. */
export function linhasDaConta(email: string, conta: { criada_em: string; pedido: PedidoDaConta | null }): string[] {
  return [
    `E-mail: ${emailMascarado(email)}`,
    `Conta criada em ${formatarDataDeInstante(conta.criada_em)}`,
    ...(conta.pedido ? [`Pedido de associação ${fraseDoPedido(conta.pedido)}`] : []),
  ]
}

export type CadastroDoCodigo = {
  numero: number | null
  associado_desde: string | null
  igreja: string | null
  funcao: string | null
  em_dia: boolean
}

/** "O cadastro na secretaria": o nº, desde quando é associado, a igreja e a situação. */
export function linhasDoCadastro(c: CadastroDoCodigo): string[] {
  const linhas: string[] = []
  if (c.numero !== null) {
    linhas.push(
      `Nº ${numeroDoRegistro(c.numero)}${c.associado_desde ? ` · associado desde ${formatarData(c.associado_desde)}` : ''}`,
    )
  }
  const igreja = [c.igreja, c.funcao].filter(Boolean).join(' · ')
  if (igreja) linhas.push(igreja)
  linhas.push(`Situação: ${c.em_dia ? 'em dia' : 'em atraso'}`)
  return linhas
}

/** A faixa do "Pronto", no Início, logo depois de ligar. */
export function textoDoPronto(ligado: { numero: number | null; pedido: boolean }, ministro: boolean): string {
  const entra = ministro
    ? `Você entra como ministro${ligado.numero !== null ? `, nº ${numeroDoRegistro(ligado.numero)}` : ''}.`
    : 'Você entra no seu cadastro do COMEP.'
  return ligado.pedido ? `${entra} O pedido de associação foi arquivado: você já é associado.` : entra
}
