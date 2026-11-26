import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Mensagem } from '../../componentes/Basicos'
import { criarLogin, redefinirSenha } from '../../dados/codigos'
import { useSessao } from '../../estado/contexto'
import { CampoAcesso, TelaAcesso } from './TelaAcesso'

// Primeiro acesso e esqueci a senha (aprovadas: seguem a tela de entrar, "Vermelho forte").

const DICA_SENHA = 'Pelo menos 8 caracteres, com letras e números.'

function CamposSenha({
  senha,
  confirmacao,
  setSenha,
  setConfirmacao,
}: {
  senha: string
  confirmacao: string
  setSenha: (v: string) => void
  setConfirmacao: (v: string) => void
}) {
  return (
    <>
      <CampoAcesso
        rotulo="Senha nova"
        detalhe={DICA_SENHA}
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <CampoAcesso
        rotulo="Repita a senha"
        type="password"
        autoComplete="new-password"
        required
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
      />
    </>
  )
}

function CampoCodigo({ rotulo, codigo, setCodigo }: { rotulo: string; codigo: string; setCodigo: (v: string) => void }) {
  return (
    <CampoAcesso
      rotulo={rotulo}
      required
      autoComplete="one-time-code"
      autoCapitalize="characters"
      placeholder="XXXX-XXXX-XXXX"
      value={codigo}
      onChange={(e) => setCodigo(e.target.value)}
    />
  )
}

const voltarParaEntrar = (
  <Link to="/entrar" className="link-forte acesso-centro">
    ← Voltar para entrar
  </Link>
)

/** /primeiro-acesso — associado já cadastrado pela secretaria cria o login com o código recebido. */
export function PrimeiroAcesso() {
  const { estado } = useSessao()
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // Já entrou com a conta criada pelo site: o código se usa no Início, em "Tenho um código" (S5-04)
  if (estado.situacao === 'logado') return <Navigate to="/painel?codigo" replace />

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
    <TelaAcesso compacto>
      <div className="acesso-titulo">
        <h1>Primeiro acesso</h1>
        <p className="acesso-explica">
          Para quem <strong>já é associado</strong>: use o código que a secretaria entregou (pelo WhatsApp) para criar a sua
          senha.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <CampoCodigo rotulo="Código de acesso" codigo={codigo} setCodigo={setCodigo} />
        <CampoAcesso
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CamposSenha senha={senha} confirmacao={confirmacao} setSenha={setSenha} setConfirmacao={setConfirmacao} />
        <Mensagem erro={erro} />
        <button type="submit" className="botao botao-cheio" disabled={enviando}>
          {enviando ? 'Criando a senha…' : 'Criar a minha senha'}
        </button>
      </form>
      {voltarParaEntrar}
    </TelaAcesso>
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
    <TelaAcesso compacto>
      <div className="acesso-titulo">
        <h1>Esqueci a senha</h1>
        <p className="acesso-explica">
          O sistema não envia e-mails: peça à <strong>secretaria</strong> um código para criar uma senha nova. Ele chega pelo
          WhatsApp e vale por 7 dias.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <CampoCodigo rotulo="Código para nova senha" codigo={codigo} setCodigo={setCodigo} />
        <CampoAcesso
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          placeholder="seu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CamposSenha senha={senha} confirmacao={confirmacao} setSenha={setSenha} setConfirmacao={setConfirmacao} />
        <Mensagem erro={erro} />
        <button type="submit" className="botao botao-cheio" disabled={enviando}>
          {enviando ? 'Trocando…' : 'Trocar a senha'}
        </button>
      </form>
      {voltarParaEntrar}
    </TelaAcesso>
  )
}
