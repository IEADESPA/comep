// CPF e filiação (pai e mãe) no formulário: conferir e decidir o que gravar (Fase 3.1).
import type { IdentidadeGravada } from '../dados/credencial'
import { cpfValido, formatarCpf, limparCpf } from './formatos'

/** Como está no formulário (o CPF pode ter pontuação). */
export type Identidade = { cpf: string; nome_pai: string; nome_mae: string }

export function identidadeInicial(gravada: IdentidadeGravada): Identidade {
  return {
    cpf: gravada.cpf ? formatarCpf(gravada.cpf) : '',
    nome_pai: gravada.nome_pai ?? '',
    nome_mae: gravada.nome_mae ?? '',
  }
}

/** Confere antes de enviar. Devolve a mensagem de erro, ou null se está tudo certo. */
export function erroDaIdentidade(valor: Identidade, obrigatorio: boolean): string | null {
  if (valor.cpf.trim() && !cpfValido(valor.cpf)) return 'CPF inválido. Confira os números.'
  if (obrigatorio && !valor.cpf.trim()) return 'Informe o seu CPF (ele vai na credencial).'
  if (obrigatorio && !valor.nome_mae.trim()) return 'Informe o nome da sua mãe (ele vai na credencial).'
  return null
}

/**
 * O que gravar: quem pode corrigir (secretaria) grava tudo; o próprio associado,
 * só o que ainda estava vazio e agora foi preenchido.
 */
export function identidadeParaGravar(valor: Identidade, gravada: IdentidadeGravada, livre: boolean): Partial<IdentidadeGravada> {
  const novo: IdentidadeGravada = {
    cpf: limparCpf(valor.cpf) || null,
    nome_pai: valor.nome_pai.trim() || null,
    nome_mae: valor.nome_mae.trim() || null,
  }
  const saida: Partial<IdentidadeGravada> = {}
  for (const campo of ['cpf', 'nome_pai', 'nome_mae'] as const) {
    if (novo[campo] === gravada[campo]) continue
    if (livre || (gravada[campo] === null && novo[campo] !== null)) saida[campo] = novo[campo]
  }
  return saida
}
