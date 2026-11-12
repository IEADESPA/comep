// Portal do ministro: meu perfil (foto, senha), pedido de troca de igreja e painel do presidente de igreja.
import { cliente, falha, ok, type Resultado } from './cliente'
import { senhaForte } from './codigos'
import { enviarArquivo } from './pedidos'

// ---------- Meu perfil ----------

export type MeusDadosCompletos = {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  foto_caminho: string | null
}

export async function buscarMeusDados(pessoaId: string): Promise<Resultado<MeusDadosCompletos>> {
  const { data, error } = await cliente()
    .from('pessoas')
    .select('id, nome, email, telefone, foto_caminho')
    .eq('id', pessoaId)
    .single<MeusDadosCompletos>()
  return error ? falha(error) : ok(data)
}

/** Envia a foto nova para a própria pasta e passa a usá-la no cadastro. */
export async function trocarMinhaFoto(pessoaId: string, foto: Blob, extensao: string): Promise<Resultado<string>> {
  const envio = await enviarArquivo(pessoaId, 'foto', foto, extensao)
  if (envio.erro !== null) return envio
  const { error } = await cliente().from('pessoas').update({ foto_caminho: envio.dados }).eq('id', pessoaId)
  return error ? falha(error) : ok(envio.dados)
}

/** Troca a senha de quem está logado (não precisa de e-mail). */
export async function trocarMinhaSenha(novaSenha: string): Promise<Resultado<null>> {
  if (!senhaForte(novaSenha)) {
    return { dados: null, erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' }
  }
  const { error } = await cliente().auth.updateUser({ password: novaSenha })
  if (!error) return ok(null)
  if (error.code === 'same_password') return { dados: null, erro: 'A senha nova precisa ser diferente da atual.' }
  if (error.code === 'weak_password') {
    return { dados: null, erro: 'A senha precisa ter pelo menos 8 caracteres, com letras e números.' }
  }
  return { dados: null, erro: 'Não foi possível trocar a senha agora. Tente de novo em instantes.' }
}

// ---------- Pedido de troca de igreja ----------

export type SituacaoTroca = 'pendente' | 'aprovado' | 'recusado' | 'cancelado'

export const NOME_DA_SITUACAO_TROCA: Record<SituacaoTroca, string> = {
  pendente: 'Aguardando a secretaria',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

export type PedidoTroca = {
  id: string
  pessoa_id: string
  igreja_id: string | null
  igreja_informada: string | null
  funcao: string | null
  pastor_presidente: boolean
  a_partir_de: string | null
  observacao: string | null
  situacao: SituacaoTroca
  motivo_recusa: string | null
  decidido_em: string | null
  criado_em: string
  igreja: { nome: string } | null
  pessoa: { nome: string } | null
}

const CAMPOS_TROCA = `id, pessoa_id, igreja_id, igreja_informada, funcao, pastor_presidente, a_partir_de, observacao,
  situacao, motivo_recusa, decidido_em, criado_em, igreja:igrejas(nome),
  pessoa:pessoas!pedidos_troca_igreja_pessoa_id_fkey(nome)`

export type NovaTroca = {
  igrejaId: string
  igrejaInformada: string
  funcao: string
  pastorPresidente: boolean
  aPartirDe: string
  observacao: string
}

/** Últimos pedidos de troca da própria pessoa (o mais recente primeiro). */
export async function minhasTrocas(pessoaId: string): Promise<Resultado<PedidoTroca[]>> {
  const { data, error } = await cliente()
    .from('pedidos_troca_igreja')
    .select(CAMPOS_TROCA)
    .eq('pessoa_id', pessoaId)
    .is('arquivado_em', null)
    .order('criado_em', { ascending: false })
    .limit(5)
    .returns<PedidoTroca[]>()
  return error ? falha(error) : ok(data)
}

export async function pedirTrocaDeIgreja(pessoaId: string, troca: NovaTroca): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('pedidos_troca_igreja')
    .insert({
      pessoa_id: pessoaId,
      igreja_id: troca.igrejaId || null,
      igreja_informada: troca.igrejaId ? null : troca.igrejaInformada.trim() || null,
      funcao: troca.funcao.trim() || null,
      pastor_presidente: troca.pastorPresidente,
      a_partir_de: troca.aPartirDe || null,
      observacao: troca.observacao.trim() || null,
    })
  return error ? falha(error, 'Você já tem um pedido de troca aguardando a secretaria.') : ok(null)
}

export async function cancelarTroca(id: string): Promise<Resultado<null>> {
  const { error } = await cliente().from('pedidos_troca_igreja').update({ situacao: 'cancelado' }).eq('id', id)
  return error ? falha(error) : ok(null)
}

// Secretaria / presidência

export async function trocasPendentes(): Promise<Resultado<PedidoTroca[]>> {
  const { data, error } = await cliente()
    .from('pedidos_troca_igreja')
    .select(CAMPOS_TROCA)
    .eq('situacao', 'pendente')
    .is('arquivado_em', null)
    .order('criado_em')
    .returns<PedidoTroca[]>()
  return error ? falha(error) : ok(data)
}

export async function aprovarTroca(id: string, igrejaId: string, data: string): Promise<Resultado<null>> {
  const { error } = await cliente().rpc('aprovar_troca_igreja', {
    p_pedido_id: id,
    p_igreja_id: igrejaId || null,
    p_data: data || null,
  })
  if (error?.code === '23505') {
    return { dados: null, erro: 'A igreja nova já tem um pastor presidente marcado. Desmarque o anterior primeiro.' }
  }
  if (error?.code === '23514') {
    return { dados: null, erro: 'A data da troca não pode ser anterior ao início na igreja atual.' }
  }
  return error ? falha(error) : ok(null)
}

export async function recusarTroca(id: string, motivo: string): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('pedidos_troca_igreja')
    .update({ situacao: 'recusado', motivo_recusa: motivo.trim() })
    .eq('id', id)
  return error ? falha(error) : ok(null)
}

// ---------- Presidente de igreja ----------

export type MinistroDaMinhaIgreja = {
  pessoa_id: string
  nome: string
  telefone: string | null
  numero_registro: number
  titulo: string | null
  funcao: string | null
  pastor_presidente: boolean
  igreja_id: string
}

export async function ministrosDaMinhaIgreja(): Promise<Resultado<MinistroDaMinhaIgreja[]>> {
  const { data, error } = await cliente().rpc('ministros_da_minha_igreja')
  return error ? falha(error) : ok((data ?? []) as MinistroDaMinhaIgreja[])
}

/** O pastor presidente atualiza só o contato da igreja (o banco recusa o resto). */
export async function atualizarContatoIgreja(
  igrejaId: string,
  dados: { endereco: string; bairro_id: string; telefone: string },
): Promise<Resultado<null>> {
  const { error } = await cliente()
    .from('igrejas')
    .update({
      endereco: dados.endereco.trim() || null,
      bairro_id: dados.bairro_id || null,
      telefone: dados.telefone.trim() || null,
    })
    .eq('id', igrejaId)
  return error ? falha(error) : ok(null)
}
