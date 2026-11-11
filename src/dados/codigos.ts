// Códigos de acesso (sem e-mail — PROJETO.md, 4.1): primeiro acesso e senha esquecida.
import { cliente, falha, ok, type Resultado } from './cliente'

export type FinalidadeCodigo = 'primeiro_acesso' | 'nova_senha'

/** Gera um código (secretaria, presidência ou administrador). O código só aparece aqui, uma vez. */
export async function gerarCodigo(pessoaId: string, finalidade: FinalidadeCodigo): Promise<Resultado<string>> {
  const { data, error } = await cliente().rpc('gerar_codigo_acesso', { p_pessoa_id: pessoaId, p_finalidade: finalidade })
  return error ? falha(error) : ok(data as string)
}

async function conferirCodigo(codigo: string, finalidade: FinalidadeCodigo): Promise<Resultado<boolean>> {
  const { data, error } = await cliente().rpc('conferir_codigo_acesso', { p_codigo: codigo, p_finalidade: finalidade })
  return error ? falha(error) : ok(Boolean(data))
}

const SENHA_FRACA = 'A senha precisa ter pelo menos 8 caracteres, com letras e números.'

export function senhaForte(senha: string): boolean {
  return senha.length >= 8 && /[A-Za-z]/.test(senha) && /[0-9]/.test(senha)
}

function mensagemDoLogin(codigo: string | undefined): string {
  if (codigo === 'user_already_exists' || codigo === 'email_exists') {
    return 'Este e-mail já tem login. Use "Entrar" ou, se esqueceu a senha, peça um código à secretaria.'
  }
  if (codigo === 'weak_password') return SENHA_FRACA
  if (codigo === 'over_request_rate_limit') return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  if (codigo === 'email_address_invalid') return 'E-mail inválido.'
  return 'Não foi possível criar o login agora. Verifique a internet e tente de novo.'
}

/** Cria o login. Com código de primeiro acesso, o login é ligado ao cadastro que a secretaria já fez. */
export async function criarLogin(
  email: string,
  senha: string,
  extras: { nome?: string; codigoAcesso?: string },
): Promise<Resultado<null>> {
  if (!senhaForte(senha)) return { dados: null, erro: SENHA_FRACA }
  if (extras.codigoAcesso) {
    const conferido = await conferirCodigo(extras.codigoAcesso, 'primeiro_acesso')
    if (conferido.erro !== null) return conferido
    if (!conferido.dados) {
      return { dados: null, erro: 'Código inválido, vencido ou já usado. Peça um código novo à secretaria.' }
    }
  }
  const { data, error } = await cliente().auth.signUp({
    email: email.trim(),
    password: senha,
    options: {
      data: {
        ...(extras.nome ? { nome: extras.nome.trim() } : {}),
        ...(extras.codigoAcesso ? { codigo_acesso: extras.codigoAcesso } : {}),
      },
    },
  })
  if (error) return { dados: null, erro: mensagemDoLogin(error.code) }
  // Sem confirmação por e-mail, o login já volta com a sessão aberta
  if (!data.session) return { dados: null, erro: 'Login criado, mas não foi possível entrar. Tente "Entrar".' }
  return ok(null)
}

/** Senha esquecida: troca a senha com o código da secretaria e já entra. */
export async function redefinirSenha(email: string, codigo: string, senha: string): Promise<Resultado<null>> {
  if (!senhaForte(senha)) return { dados: null, erro: SENHA_FRACA }
  const { error } = await cliente().rpc('redefinir_senha_com_codigo', {
    p_email: email.trim(),
    p_codigo: codigo,
    p_senha: senha,
  })
  if (error) return falha(error)
  const entrada = await cliente().auth.signInWithPassword({ email: email.trim(), password: senha })
  if (entrada.error) return { dados: null, erro: 'Senha trocada. Agora entre com a senha nova.' }
  return ok(null)
}
