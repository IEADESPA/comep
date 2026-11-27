// As contas e os textos das telas da igreja (Fase 5.5, partes 5 e 6), fora dos componentes: a situação em uma frase,
// o resumo de cada documento, a diretoria em vigor (pela ata que vale hoje), a diretoria do formulário ("mesmo
// mandato para todos", com a exceção) e as igrejas com a situação.
import { listarIgrejas, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import {
  NOME_DA_NATUREZA,
  NOME_DO_DOCUMENTO,
  situacaoDasIgrejas,
  type DocumentoIgreja,
  type MembroDiretoriaIgreja,
  type MembroNovo,
  type SituacaoIgreja,
  type SituacaoNaLista,
} from '../../dados/igrejas'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { fimDoMandato, fraseParaMandar, listaCurta, porqueSuspensa } from '../../utilitarios/regularizacao'

export const nomeDoDocumento = (d: Pick<DocumentoIgreja, 'tipo' | 'descricao'>) =>
  d.tipo === 'outro' ? (d.descricao ?? NOME_DO_DOCUMENTO.outro) : NOME_DO_DOCUMENTO[d.tipo]

/** O que o documento diz: a natureza do Cartão CNPJ, o período do alvará, o mandato da ata. */
export function resumoDoDocumento(d: DocumentoIgreja): string {
  if (d.tipo === 'cartao_cnpj') return d.natureza ? NOME_DA_NATUREZA[d.natureza] : 'natureza não informada'
  if (d.tipo === 'alvara' && d.valido_ate) return `vale de ${formatarData(d.valido_de)} a ${formatarData(d.valido_ate)}`
  if (d.tipo === 'ata_diretoria' && d.valido_ate) {
    return `mandato de ${formatarData(d.valido_de)} a ${formatarData(d.valido_ate)}${d.muda_natureza ? ' · muda a natureza' : ''}`
  }
  if (d.tipo === 'estatuto') return 'não vence'
  return d.descricao ?? ''
}

export type OpcaoMinistro = { pessoa_id: string; nome: string; numero?: number | null }

export type LinhaDiretoria = { cargo: string; pessoa_id: string; nome: string; personalizado: boolean; posse: string; anos: number }
export type EstadoDiretoria = { posse: string; anos: number; mesmo: boolean; linhas: LinhaDiretoria[] }

const CARGOS_SUGERIDOS = ['Presidente', 'Vice-presidente', 'Secretário(a)', 'Tesoureiro(a)']
export const ANOS = Array.from({ length: 15 }, (_, i) => i + 1)

/** A diretoria para começar: a que está valendo (com os nomes) ou os cargos de sempre. */
export function diretoriaInicial(atual: MembroDiretoriaIgreja[], presidente?: OpcaoMinistro | null): EstadoDiretoria {
  const linhas: LinhaDiretoria[] =
    atual.length > 0
      ? atual.map((m) => ({ cargo: m.cargo, pessoa_id: m.pessoa_id ?? '', nome: m.pessoa_id ? '' : m.nome, personalizado: false, posse: '', anos: 4 }))
      : CARGOS_SUGERIDOS.map((cargo, i) => ({
          cargo,
          pessoa_id: i === 0 && presidente ? presidente.pessoa_id : '',
          nome: '',
          personalizado: false,
          posse: '',
          anos: 4,
        }))
  return { posse: '', anos: 4, mesmo: true, linhas }
}

export function datasDaLinha(e: EstadoDiretoria, l: LinhaDiretoria): { inicio: string; fim: string } {
  const proprio = !e.mesmo || l.personalizado
  const posse = proprio ? l.posse || e.posse : e.posse
  const anos = proprio ? l.anos : e.anos
  return { inicio: posse, fim: posse ? fimDoMandato(posse, anos) : '' }
}

/** Os cargos prontos para o banco (só os preenchidos). */
export function membrosDaDiretoria(e: EstadoDiretoria): MembroNovo[] {
  return e.linhas
    .filter((l) => l.cargo.trim() && (l.pessoa_id || l.nome.trim()))
    .map((l) => ({ cargo: l.cargo.trim(), pessoa_id: l.pessoa_id || null, nome: l.pessoa_id ? undefined : l.nome.trim(), ...datasDaLinha(e, l) }))
}

/** O que falta para a diretoria poder ir (null: pode ir). */
export function faltaNaDiretoria(e: EstadoDiretoria): string | null {
  const membros = membrosDaDiretoria(e)
  if (membros.length === 0) return 'Informe pelo menos um cargo, com quem o ocupa.'
  if (membros.some((m) => !m.inicio)) return 'Informe a data da posse (a data da ata).'
  if (e.linhas.some((l) => l.cargo.trim() && !l.pessoa_id && l.nome.trim() && l.nome.trim().length < 5)) {
    return 'Escreva o nome completo de quem ocupa cada cargo.'
  }
  return null
}

/**
 * A igreja suspensa, para o pastor: "suspensa desde 01/02/2027, porque o alvará venceu". O que nunca veio (faltava na
 * ativação) "não veio"; a data do vencimento não entra, porque com a tolerância do alvará ela não é a véspera da
 * suspensão (regras de 26/11/2026).
 */
export function fraseDaSuspensao(s: SituacaoIgreja): string {
  return `suspensa desde ${formatarData(s.suspensa_desde)}, porque ${porqueSuspensa(s)}`
}

/** A frase da situação, para a lista e o painel ("o alvará venceu · faltam 12 dias para mandar"). */
export function descreverSituacao(s: SituacaoIgreja, hoje: string): string {
  if (s.situacao === 'sem_registro') {
    const prazo = s.readequacao_ate ? ` · registrar até ${formatarData(s.readequacao_ate)}` : ''
    return `sem CNPJ, estatuto e ata: cadastro simples${prazo}`
  }
  if (s.situacao === 'em_analise') return 'a secretaria está conferindo o cadastro'
  if (s.situacao === 'suspensa') {
    const o = porqueSuspensa(s)
    if (s.perfil_bloqueado) return `${o} · perfil do pastor bloqueado`
    return `${o} · ${s.prazo_ate ? fraseParaMandar(hoje, s.prazo_ate) : 'acabou o prazo para mandar'}`
  }
  if (s.pendencias.length > 0) {
    const n = s.pendencias.length
    // pendencias_ate vazio: o novo chegou no prazo e espera a conferência
    const quando = s.pendencias_ate ? `até ${formatarData(s.pendencias_ate)}` : 'o novo espera a conferência'
    return `${n >= 2 ? 'faltam' : 'falta'} ${listaCurta(s.pendencias)} (${quando})`
  }
  if (s.natureza_prazo) return `associação privada · mudar até ${formatarData(s.natureza_prazo)}`
  if (s.alvara_ate) return `alvará até ${formatarData(s.alvara_ate)}`
  return 'documentos em dia'
}

/** A ata que vale hoje (conferida, com o período em curso) e a diretoria dela. */
export function diretoriaEmVigor(documentos: DocumentoIgreja[], diretoria: MembroDiretoriaIgreja[], hoje = hojeIso()) {
  const atas = documentos.filter((d) => d.tipo === 'ata_diretoria' && d.situacao === 'conferido' && d.valido_ate)
  const vigente = atas
    .filter((d) => (d.valido_de ?? '') <= hoje && (d.valido_ate ?? '') >= hoje)
    .sort((a, b) => (b.valido_de ?? '').localeCompare(a.valido_de ?? '') || (b.conferido_em ?? '').localeCompare(a.conferido_em ?? ''))[0]
  const proxima = atas.filter((d) => (d.valido_de ?? '') > hoje).sort((a, b) => (a.valido_de ?? '').localeCompare(b.valido_de ?? ''))[0]
  const daAta = (ata?: DocumentoIgreja) => (ata ? diretoria.filter((m) => m.documento_id === ata.id) : [])
  // sem ata com diretoria: a informada antes da Fase 5.5 (sem o mandato por cargo)
  const antiga = diretoria.filter((m) => m.documento_id === null)
  return { vigente, proxima, membros: vigente ? daAta(vigente) : antiga, daAta, antiga: !vigente && antiga.length > 0 }
}

export type LinhaIgreja = Igreja & { s: SituacaoNaLista | null }

/** As igrejas com a situação de cada uma (a situação vem do banco, calculada pela data). */
export async function carregarIgrejasComSituacao() {
  const [igrejas, situacoes] = await Promise.all([listarIgrejas(), situacaoDasIgrejas()])
  if (igrejas.erro !== null) return igrejas
  if (situacoes.erro !== null) return situacoes
  const porId = new Map(situacoes.dados.map((s) => [s.igreja_id, s]))
  return ok(igrejas.dados.map<LinhaIgreja>((i) => ({ ...i, s: porId.get(i.id) ?? null })))
}

export const PASSOS_IGREJA = ['Dados da igreja', 'Endereço e contato', 'Pastor e diretoria', 'Documentos', 'Revisar'] as const

/** O documento de cada tipo: o que vale hoje, o seguinte já conferido (o antecipado), o que espera a conferência e o recusado. */
export function documentosDoTipo(documentos: DocumentoIgreja[], tipo: DocumentoIgreja['tipo'], hoje = hojeIso()) {
  const doTipo = documentos.filter((d) => d.tipo === tipo).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
  const esperando = doTipo.find((d) => d.situacao === 'pendente')
  const recusado = doTipo[0]?.situacao === 'recusado' ? doTipo[0] : undefined
  const conferidos = doTipo.filter((d) => d.situacao === 'conferido')
  if (tipo !== 'ata_diretoria' && tipo !== 'alvara') return { atual: conferidos[0], proximo: undefined, esperando, recusado, todos: doTipo }
  const comValidade = conferidos.filter((d) => d.valido_ate)
  const atual = comValidade
    .filter((d) => (d.valido_de ?? '') <= hoje && (d.valido_ate ?? '') >= hoje)
    .sort((a, b) => (b.valido_de ?? '').localeCompare(a.valido_de ?? ''))[0]
  const proximo = comValidade.filter((d) => (d.valido_de ?? '') > hoje).sort((a, b) => (a.valido_de ?? '').localeCompare(b.valido_de ?? ''))[0]
  return { atual, proximo, esperando, recusado, todos: doTipo }
}
