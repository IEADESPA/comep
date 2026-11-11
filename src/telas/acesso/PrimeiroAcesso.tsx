import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { Mensagem } from '../../componentes/Basicos'
import { criarLogin, redefinirSenha } from '../../dados/codigos'
import { useSessao } from '../../estado/contexto'

/** Moldura das telas de acesso (mesma da tela "Entrar"). */
function CartaoAcesso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="tela-entrada">
      <div className="cartao-entrada">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={56} height={56} />
        <h1>{titulo}</h1>
        <p className="subtitulo">Conselho de Ministros Evangélicos de Parauapebas</p>
        {children}
        <p className="rodape-entrada">
          <Link to="/entrar">← Voltar para "Entrar"</Link>
        </p>
      </div>
    </main>
  )
}

function CamposSenha({
  senha,
  confirmacao,
  setSenha,
  setConfirmacao,
  rotulo = 'Crie uma senha',
}: {
  senha: string
  confirmacao: string
  setSenha: (v: string) => void
  setConfirmacao: (v: string) => void
  rotulo?: string
}) {
  return (
    <>
      <label>
        {rotulo}
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <span className="detalhe">Pelo menos 8 caracteres, com letras e números.</span>
      </label>
      <label>
        Repita a senha
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
      </label>
    </>
  )
}

/** /primeiro-acesso — associado já cadastrado pela secretaria cria o login com o código recebido. */
export function PrimeiroAcesso() {
  const { estado } = useSessao()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado.situacao === 'logado') return <Navigate to="/painel" replace />

  async function enviar() {
    setErro(null)
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }
    setEnviando(true)
    const r = await criarLogin(email, senha, { codigoAcesso: codigo })
    setEnviando(false)
    if (r.erro !== null) setErro(r.erro)
  }

  return (
    <CartaoAcesso titulo="Primeiro acesso">
      <p className="texto-acesso">
        Para quem <strong>já é associado</strong> e recebeu um código da secretaria (pelo WhatsApp). Use o seu e-mail e
        crie a sua senha.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <label>
          Código de acesso
          <input
            required
            autoComplete="one-time-code"
            autoCapitalize="characters"
            placeholder="XXXX-XXXX-XXXX"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <label>
          Seu e-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <CamposSenha senha={senha} confirmacao={confirmacao} setSenha={setSenha} setConfirmacao={setConfirmacao} />
        <Mensagem erro={erro} />
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Criando o acesso…' : 'Criar meu acesso'}
        </button>
      </form>
    </CartaoAcesso>
  )
}

/** /nova-senha — senha esquecida: troca com o código gerado pela secretaria. */
export function NovaSenha() {
  const { estado } = useSessao()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado.situacao === 'logado') return <Navigate to="/painel" replace />

  async function enviar() {
    setErro(null)
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }
    setEnviando(true)
    const r = await redefinirSenha(email, codigo, senha)
    setEnviando(false)
    if (r.erro !== null) setErro(r.erro)
  }

  return (
    <CartaoAcesso titulo="Esqueci a senha">
      <p className="texto-acesso">
        Como o sistema não envia e-mails, peça à <strong>secretaria</strong> um código para nova senha. Ele chega pelo
        WhatsApp e vale por 7 dias.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <label>
          Código para nova senha
          <input
            required
            autoComplete="one-time-code"
            autoCapitalize="characters"
            placeholder="XXXX-XXXX-XXXX"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <label>
          Seu e-mail de login
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <CamposSenha
          senha={senha}
          confirmacao={confirmacao}
          setSenha={setSenha}
          setConfirmacao={setConfirmacao}
          rotulo="Nova senha"
        />
        <Mensagem erro={erro} />
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? 'Trocando…' : 'Trocar a senha e entrar'}
        </button>
      </form>
    </CartaoAcesso>
  )
}
