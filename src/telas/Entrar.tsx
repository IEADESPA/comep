import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { entrarComEmail } from '../dados/autenticacao'
import { useSessao } from '../estado/contexto'

export function Entrar() {
  const { estado } = useSessao()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado.situacao === 'logado') {
    const destino = (location.state as { voltarPara?: string } | null)?.voltarPara ?? '/'
    return <Navigate to={destino} replace />
  }

  async function enviar() {
    setErro(null)
    setEnviando(true)
    const resultado = await entrarComEmail(email, senha)
    setEnviando(false)
    if (resultado.erro) setErro(resultado.erro)
  }

  return (
    <main className="tela-entrada">
      <div className="cartao-entrada">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={64} height={64} />
        <h1>COMEP</h1>
        <p className="subtitulo">Conselho de Ministros Evangélicos de Parauapebas</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <label>
            E-mail
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </label>

          {erro && (
            <p className="erro" role="alert">
              {erro}
            </p>
          )}

          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="rodape-entrada">
          Ainda não é inscrito no Conselho? O pedido de inscrição pelo app chega na próxima fase.
        </p>
      </div>
    </main>
  )
}
