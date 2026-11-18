import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Icone } from '../componentes/Icone'
import { entrarComEmail } from '../dados/autenticacao'
import { useSessao } from '../estado/contexto'
import { CampoAcesso, TelaAcesso } from './acesso/TelaAcesso'

/** /entrar — aprovada: Opção 3, "Vermelho forte" (telas novas, Fase 5.5). */
export function Entrar() {
  const { estado } = useSessao()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado.situacao === 'logado') {
    const destino = (location.state as { voltarPara?: string } | null)?.voltarPara ?? '/painel'
    return <Navigate to={destino} replace />
  }

  async function enviar() {
    setErro(null)
    setEnviando(true)
    const resultado = await entrarComEmail(email, senha)
    setEnviando(false)
    if (resultado.erro !== null) setErro(resultado.erro)
  }

  return (
    <TelaAcesso rodapeCelular={{ para: '/', texto: '← Voltar para o site' }}>
      <div className="acesso-titulo">
        <h1>Entrar</h1>
        <p className="acesso-explica so-computador">Use o e-mail e a senha do seu cadastro no COMEP.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <CampoAcesso
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CampoAcesso
          rotulo="Senha"
          aoLado={
            <Link to="/nova-senha" className="so-computador">
              Esqueci a senha
            </Link>
          }
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}

        <button type="submit" className="botao botao-cheio" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <Link to="/nova-senha" className="link-forte acesso-centro so-celular">
        Esqueci a senha
      </Link>
      <p className="separador so-computador">ainda não tem senha?</p>

      <Link to="/primeiro-acesso" className="cartao-acesso">
        <span className="cartao-acesso-icone" aria-hidden="true">
          <Icone nome="chave" tamanho={21} />
        </span>
        <span className="cartao-acesso-texto">
          <strong>Primeiro acesso</strong>
          <span>Recebi um código da secretaria</span>
        </span>
        <span className="cartao-acesso-seta" aria-hidden="true">
          <Icone nome="seta" />
        </span>
      </Link>

      <p className="acesso-associar">
        Ainda não é associado? <Link to="/associar">Veja como se associar</Link>
      </p>
    </TelaAcesso>
  )
}
