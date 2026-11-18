import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Aviso, BotaoConfirmar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarIgrejas, listarTitulos } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { criarLogin } from '../../dados/codigos'
import { desistirDoPedido, meuPedido, meusDados, NOME_DA_SITUACAO_PEDIDO, type Pedido } from '../../dados/pedidos'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataHora } from '../../utilitarios/formatos'
import { FormularioPedido } from './FormularioPedido'
import { CampoAcesso, TelaAcesso } from '../acesso/TelaAcesso'

const ABERTOS: readonly Pedido['situacao'][] = ['enviado', 'pendencia', 'aguardando_assembleia']

/** /meu-pedido — o candidato faz, acompanha e corrige o pedido de associação. */
export function MeuPedido() {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta === null) return <Carregando />
  if (estado.conta.tipo !== 'ok') {
    return (
      <Aviso titulo="Cadastro não encontrado">
        <p>Não foi possível carregar o seu cadastro. Saia e entre de novo.</p>
      </Aviso>
    )
  }
  const { pessoaId, perfis } = estado.conta.conta
  return <ConteudoMeuPedido key={pessoaId} pessoaId={pessoaId} jaEhMinistro={perfis.includes('ministro')} />
}

function ConteudoMeuPedido({ pessoaId, jaEhMinistro }: { pessoaId: string; jaEhMinistro: boolean }) {
  const { recarregarConta } = useSessao()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novoPedido, setNovoPedido] = useState(false)
  const [carga, recarregar] = useCarregar(async () => {
    const [pedido, pessoa, titulos, igrejas] = await Promise.all([
      meuPedido(pessoaId),
      meusDados(pessoaId),
      listarTitulos(),
      listarIgrejas(),
    ])
    if (pedido.erro !== null) return pedido
    if (pessoa.erro !== null) return pessoa
    if (titulos.erro !== null) return titulos
    if (igrejas.erro !== null) return igrejas
    return ok({ pedido: pedido.dados, pessoa: pessoa.dados, titulos: titulos.dados, igrejas: igrejas.dados })
  })

  function concluido(texto: string) {
    setMensagem(texto)
    setErro(null)
    setNovoPedido(false)
    recarregar()
  }

  return (
    <>
      <h1>Pedido de associação</h1>
      <Mensagem sucesso={mensagem} erro={erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ pedido, pessoa, titulos, igrejas }) => {
          const formulario = (correcao?: Pedido) => (
            <FormularioPedido
              pessoaId={pessoaId}
              titulos={titulos}
              igrejas={igrejas}
              dadosPessoa={pessoa}
              pedido={correcao}
              aoConcluir={concluido}
            />
          )

          if (jaEhMinistro && (!pedido || pedido.situacao === 'aprovado')) {
            return (
              <Aviso titulo="Você já é associado do COMEP">
                {pedido?.assembleia_data && <p>Aprovado na Assembleia Ordinária de {formatarData(pedido.assembleia_data)}.</p>}
                <p>
                  <Link to="/painel">Ir para o início do Portal do membro</Link>
                </p>
              </Aviso>
            )
          }

          if (!pedido || novoPedido) {
            return (
              <>
                <p className="detalhe">
                  Preencha com atenção: a diretoria analisa o pedido e o apresenta na Assembleia Ordinária (2ª quinzena
                  de abril ou de outubro), que decide (Art. 7º).
                </p>
                {formulario()}
              </>
            )
          }

          return (
            <>
              <section className="painel" aria-labelledby="titulo-situacao">
                <h2 id="titulo-situacao">Situação</h2>
                <p>
                  <span className="etiqueta etiqueta-marca">{NOME_DA_SITUACAO_PEDIDO[pedido.situacao]}</span>
                </p>
                <Linha rotulo="Enviado em" valor={pedido.enviado_em && formatarDataHora(pedido.enviado_em)} />
                {pedido.situacao === 'aguardando_assembleia' && (
                  <p>
                    A diretoria aceitou a sua ficha. O pedido será votado na próxima Assembleia Ordinária (2ª quinzena de
                    abril ou de outubro).
                  </p>
                )}
                {pedido.situacao === 'aprovado' && (
                  <p>
                    Aprovado na Assembleia Ordinária de {formatarData(pedido.assembleia_data)}. Bem-vindo ao COMEP!{' '}
                    <button type="button" className="botao-texto" onClick={recarregarConta}>
                      Atualizar meu acesso
                    </button>
                  </p>
                )}
                {pedido.situacao === 'recusado' && <p>Motivo: {pedido.motivo_recusa}</p>}
              </section>

              {pedido.situacao === 'pendencia' && (
                <>
                  <Aviso titulo="A diretoria pediu uma correção">
                    <p>{pedido.mensagem_pendencia}</p>
                  </Aviso>
                  {formulario(pedido)}
                </>
              )}

              {ABERTOS.includes(pedido.situacao) && (
                <section className="painel painel-perigo">
                  <h2>Desistir do pedido</h2>
                  <BotaoConfirmar
                    texto="Desistir do pedido"
                    confirmar="Confirmar desistência"
                    aviso="Desistir? O pedido fica registrado como desistência. Você pode fazer outro depois."
                    aoConfirmar={async () => {
                      const r = await desistirDoPedido(pedido.id)
                      if (r.erro !== null) setErro(r.erro)
                      else concluido('Pedido encerrado por desistência.')
                    }}
                  />
                </section>
              )}

              {(pedido.situacao === 'recusado' || pedido.situacao === 'desistiu') && (
                <button type="button" className="botao" onClick={() => setNovoPedido(true)}>
                  Fazer um novo pedido
                </button>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | false }) {
  if (!valor) return null
  return (
    <p>
      <span className="detalhe">{rotulo}:</span> {valor}
    </p>
  )
}

/** /associar/pedido — passo 1: quem ainda não tem login cria o acesso; depois segue para /meu-pedido. */
export function CriarAcessoPedido() {
  const { estado } = useSessao()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado.situacao === 'carregando') return <Carregando />
  if (estado.situacao === 'logado') return <Navigate to="/meu-pedido" replace />

  async function enviar() {
    setErro(null)
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')
    setEnviando(true)
    const r = await criarLogin(email, senha, { nome })
    setEnviando(false)
    if (r.erro !== null) setErro(r.erro)
  }

  return (
    <TelaAcesso compacto>
      <div className="acesso-titulo">
        <h1>Quero me associar</h1>
        <p className="acesso-explica">
          <strong>Passo 1 de 2: crie o seu acesso.</strong> Com ele você envia o pedido, acompanha a análise e, depois de
          aprovado, entra no Portal do membro.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <CampoAcesso rotulo="Nome completo" required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
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
          rotulo="Crie uma senha"
          detalhe="Pelo menos 8 caracteres, com letras e números."
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
        <Mensagem erro={erro} />
        <button type="submit" className="botao botao-cheio" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar acesso e continuar'}
        </button>
      </form>
      <p className="acesso-associar">
        Já tem login?{' '}
        <Link to="/entrar" state={{ voltarPara: '/meu-pedido' }}>
          Entrar
        </Link>
      </p>
      <Link to="/associar" className="link-forte acesso-centro">
        ← Voltar
      </Link>
    </TelaAcesso>
  )
}
