// O botão do WhatsApp (sem custo, sem API paga: PROJETO.md, seção 4.8): abre o WhatsApp de quem clica, já com a
// mensagem escrita. Quem envia é a própria pessoa (a secretaria); o sistema não manda nada sozinho.

/** Só os números do telefone, com o 55 do Brasil quando vier com DDD (10 ou 11 números). Vazio se não der. */
export function numeroDoWhatsApp(telefone: string | null | undefined): string {
  const numero = (telefone ?? '').replace(/\D/g, '')
  if (numero.length < 10) return ''
  return numero.length <= 11 ? `55${numero}` : numero
}

/** O link que abre o WhatsApp com a mensagem (sem número: a pessoa escolhe o contato). */
export function linkDoWhatsApp(telefone: string | null | undefined, texto: string): string {
  return `https://wa.me/${numeroDoWhatsApp(telefone)}?text=${encodeURIComponent(texto)}`
}

/** "(94) 99123-4567": o telefone do jeito brasileiro (ou como veio, se não for um número do Brasil). */
export function telefoneFormatado(telefone: string | null | undefined): string {
  const n = (telefone ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return telefone ?? ''
}

/** "Pastor Samuel", "Samuel": o jeito de chamar a pessoa na mensagem (o título e o primeiro nome). */
export function tratamento(nome: string, titulo: string | null | undefined): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? ''
  return titulo ? `${titulo} ${primeiro}` : primeiro
}
