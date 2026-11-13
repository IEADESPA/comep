// Assembleias e reuniões: datas no fuso de Parauapebas, avisos de prazo (Art. 16), o texto do edital e
// as reuniões mensais repetidas. Funções puras (testadas em testes/unidade/encontros.test.ts).
import type { ConfigAssembleias, ItemPauta, TipoEncontro } from '../dados/encontros'

const FUSO = 'America/Belem'
/** Parauapebas não tem horário de verão: sempre 3 horas a menos que o UTC. */
const DESLOCAMENTO = '-03:00'

/** Campo "data e hora" (aaaa-mm-ddThh:mm, hora de Parauapebas) → instante com fuso. */
export function doCampoDataHora(valor: string): string {
  return `${valor}:00${DESLOCAMENTO}`
}

/** Instante → campo "data e hora" (hora de Parauapebas). */
export function paraCampoDataHora(instante: string): string {
  const d = new Date(instante)
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`
}

/** Dia (aaaa-mm-dd) em Parauapebas. */
export function diaEmParauapebas(instante: string | Date): string {
  return new Date(instante).toLocaleDateString('sv-SE', { timeZone: FUSO })
}

function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

const formatarDia = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`

/**
 * O que impede (ou impedirá) a convocação, para avisar já no formulário. As mesmas regras do banco
 * (Art. 16, §2º e §6º), com os números da configuração.
 */
export function avisosDaData(tipo: TipoEncontro, inicio: string, config: ConfigAssembleias, hoje: string): string[] {
  const avisos: string[] = []
  const dia = diaEmParauapebas(inicio)
  if (dia < hoje) return ['A data já passou.']
  if (tipo === 'reuniao_mensal') return avisos
  const minimo = somarDias(hoje, config.antecedencia_dias)
  if (dia < minimo) {
    avisos.push(
      `A convocação precisa de ${config.antecedencia_dias} dias de antecedência (Art. 16, §2º): convocando hoje, a assembleia pode ser a partir de ${formatarDia(minimo)}.`,
    )
  } else {
    avisos.push(`Para esta data, a convocação precisa ser publicada até ${formatarDia(somarDias(dia, -config.antecedencia_dias))}.`)
  }
  if (tipo === 'ago') {
    const mes = Number(dia.slice(5, 7))
    const diaDoMes = Number(dia.slice(8, 10))
    if (!config.meses_ago.includes(mes) || diaDoMes < config.dia_minimo_ago) {
      avisos.push(`A Assembleia Ordinária acontece na 2ª quinzena de ${nomesDosMeses(config.meses_ago)} (Art. 16, §6º).`)
    }
  }
  return avisos
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export function nomesDosMeses(meses: number[]): string {
  const nomes = [...meses].sort((a, b) => a - b).map((m) => MESES[m - 1])
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

/** "quinta-feira, 20 de abril de 2027, às 19h00" (hora de Parauapebas) */
export function dataPorExtenso(instante: string, comHora = true): string {
  const d = new Date(instante)
  const data = d.toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (!comHora) return data
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(':', 'h')
  return `${data}, às ${hora}`
}

const ARTIGO: Record<TipoEncontro, string> = {
  ago: 'a Assembleia Geral Ordinária',
  age: 'a Assembleia Geral Extraordinária',
  reuniao_mensal: 'a reunião mensal',
}

/** Texto do edital de convocação, a partir dos dados do formulário (a secretaria pode ajustar depois). */
export function textoDoEdital(dados: {
  tipo: TipoEncontro
  inicio: string
  local: string
  fundamento: string
  pauta: ItemPauta[]
  minutosSegundaChamada: number
  hoje: Date
}): string {
  const itens = dados.pauta.filter((p) => p.titulo.trim())
  const linhas = [
    `EDITAL DE CONVOCAÇÃO — ${(dados.tipo === 'reuniao_mensal' ? 'Reunião mensal' : ARTIGO[dados.tipo].slice(2)).toUpperCase()}`,
    '',
    `O Presidente do Conselho de Ministros Evangélicos de Parauapebas (COMEP), no uso das atribuições que lhe confere o Estatuto (Art. 16, §2º), convoca os associados para ${ARTIGO[dados.tipo]}, que será realizada ${dataPorExtenso(dados.inicio)}, em ${dados.local.trim() || '(local)'}, em primeira chamada com a presença de metade mais um dos associados aptos e, em segunda chamada, ${dados.minutosSegundaChamada} minutos depois, com qualquer número de presentes (Art. 16, §4º), para tratar da seguinte pauta:`,
    '',
    ...(itens.length ? itens.map((p, i) => `${i + 1}. ${p.titulo.trim()}`) : ['1. (pauta)']),
    '',
  ]
  if (dados.tipo === 'age') {
    linhas.push(`Esta Assembleia Extraordinária é convocada a pedido de: ${dados.fundamento.trim() || '(quem pediu)'} (Art. 16, §3º).`, '')
  }
  linhas.push(
    'Só votam e são votados os associados em dia com os seus compromissos (Art. 11).',
    '',
    `Parauapebas, ${dataPorExtenso(dados.hoje.toISOString(), false).replace(/^[^,]+, /, '')}.`,
    '',
    'Presidente do COMEP',
  )
  return linhas.join('\n')
}

/**
 * Reuniões mensais repetidas: o mesmo dia da semana, na mesma semana do mês (ex.: toda 1ª terça),
 * nos próximos `meses` meses. Se o mês não tem a 5ª semana, usa o último daquele dia da semana.
 */
export function mesmasDatasNosProximosMeses(inicio: string, meses: number): string[] {
  const campo = paraCampoDataHora(inicio)
  const [ano, mes, dia] = campo.slice(0, 10).split('-').map(Number)
  const hora = campo.slice(11)
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  const semana = Math.ceil(dia / 7)
  const datas: string[] = []
  for (let i = 1; i <= meses; i++) {
    const alvo = new Date(Date.UTC(ano, mes - 1 + i, 1))
    const a = alvo.getUTCFullYear()
    const m = alvo.getUTCMonth()
    const primeiro = (diaDaSemana - alvo.getUTCDay() + 7) % 7 + 1
    let d = primeiro + (semana - 1) * 7
    const ultimoDoMes = new Date(Date.UTC(a, m + 1, 0)).getUTCDate()
    while (d > ultimoDoMes) d -= 7
    datas.push(doCampoDataHora(`${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hora}`))
  }
  return datas
}

/** Texto para compartilhar no WhatsApp (link gratuito, sem serviço pago). */
export function textoWhatsApp(dados: { tipo: TipoEncontro; titulo: string; inicio: string; local: string; link: string | null }): string {
  return [
    `*${dados.titulo}*`,
    `${dataPorExtenso(dados.inicio)}`,
    `Local: ${dados.local}`,
    dados.link ? `Edital e pauta: ${dados.link}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Tira o código da credencial de um texto lido no QR Code (o endereço …/validar/<código>). */
export function codigoDoQr(texto: string): string | null {
  const achado = texto.match(/\/validar\/([0-9a-f]{32})\b/) ?? texto.trim().match(/^([0-9a-f]{32})$/)
  return achado ? achado[1] : null
}

// ---------- Quórum, maiorias e ata (Fase 4.3) ----------

/** Quórum da 1ª chamada: metade mais um dos aptos (Art. 16, §4º). */
export function quorumPrimeiraChamada(aptos: number): number {
  return Math.floor(aptos / 2) + 1
}

/** Votos a favor exigidos (3/5 ou 2/3 dos presentes aptos — pergunta 24); null = maioria simples. */
export function minimoAFavor(maioria: 'simples' | 'tres_quintos' | 'dois_tercos', votantes: number): number | null {
  if (maioria === 'simples') return null
  return maioria === 'tres_quintos' ? Math.ceil((votantes * 3) / 5) : Math.ceil((votantes * 2) / 3)
}

/** A conta da maioria, em palavras, para mostrar na tela e na ata. */
export function explicarMaioria(maioria: 'simples' | 'tres_quintos' | 'dois_tercos', votantes: number): string {
  const minimo = minimoAFavor(maioria, votantes)
  if (minimo === null) return 'maioria simples (mais votos a favor que contra)'
  return `${maioria === 'tres_quintos' ? '3/5' : '2/3'} dos ${votantes} presentes aptos = ${minimo} votos a favor`
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const TIPO_NA_ATA = { ago: 'Assembleia Geral Ordinária', age: 'Assembleia Geral Extraordinária', reuniao_mensal: 'reunião mensal' } as const

type ItemNaAta = { id: string; ordem: number; titulo: string; deliberativo: boolean }
type VotoNaAta = {
  pauta_id: string
  maioria: 'simples' | 'tres_quintos' | 'dois_tercos'
  votantes: number
  a_favor: number
  contra: number
  abstencoes: number
  aprovada: boolean
  desligado?: string | null
}

/** Texto da ata a partir do que o sistema registrou (o 1º secretário completa e ajusta). */
export function textoDaAta(d: {
  tipo: 'ago' | 'age' | 'reuniao_mensal'
  inicio: string
  local: string
  chamada: 'primeira' | 'segunda' | null
  aptos: number | null
  presentesAptos: number | null
  presentes: number
  pauta: ItemNaAta[]
  votos: VotoNaAta[]
}): string {
  const data = dataPorExtenso(d.inicio).replace(/^[^,]+, /, '')
  const linhas = [
    `ATA DA ${TIPO_NA_ATA[d.tipo].toUpperCase()} DO CONSELHO DE MINISTROS EVANGÉLICOS DE PARAUAPEBAS (COMEP)`,
    '',
    `Em ${data}, em ${d.local}, reuniram-se os associados do COMEP em ${TIPO_NA_ATA[d.tipo]}, convocada pelo Presidente com a antecedência prevista no Estatuto (Art. 16, §2º). ` +
      (d.chamada
        ? `A assembleia foi instalada em ${d.chamada === 'primeira' ? 'primeira' : 'segunda'} chamada, com ${plural(d.presentesAptos ?? 0, 'associado apto presente', 'associados aptos presentes')}, de ${plural(d.aptos ?? 0, 'apto', 'aptos')} (${plural(d.presentes, 'presente', 'presentes')} ao todo), conforme a lista de presença (Art. 16, §1º e §4º).`
        : `Estiveram presentes ${plural(d.presentes, 'associado', 'associados')}, conforme a lista de presença (Art. 16, §1º).`),
    '',
    'Pauta e deliberações:',
  ]
  for (const item of d.pauta) {
    const voto = d.votos.find((v) => v.pauta_id === item.id)
    if (!item.deliberativo) {
      linhas.push(`${item.ordem}. ${item.titulo}: (informe — registrar aqui o que foi tratado).`)
    } else if (!voto) {
      linhas.push(`${item.ordem}. ${item.titulo}: (votação não registrada).`)
    } else {
      linhas.push(
        `${item.ordem}. ${item.titulo}: ${voto.aprovada ? 'APROVADO' : 'REJEITADO'}, com ${plural(voto.a_favor, 'voto', 'votos')} a favor, ${voto.contra} contra e ${plural(voto.abstencoes, 'abstenção', 'abstenções')} (exigido: ${explicarMaioria(voto.maioria, voto.votantes)}).` +
          (voto.desligado && voto.aprovada ? ` Fica desligado(a) do COMEP: ${voto.desligado} (Art. 8º).` : ''),
      )
    }
  }
  linhas.push(
    '',
    'Nada mais havendo a tratar, foi encerrada a assembleia, e eu, 1º Secretário, lavrei a presente ata, que vai assinada por mim e pelo Presidente (Art. 12, §2º, IV e §4º).',
    '',
    `Parauapebas, ${data.replace(/, às .*$/, '')}.`,
    '',
    '1º Secretário',
    '',
    'Presidente',
  )
  return linhas.join('\n')
}
