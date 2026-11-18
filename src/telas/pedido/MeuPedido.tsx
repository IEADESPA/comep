import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Aviso, BotaoConfirmar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarIgrejas, listarTitulos } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { criarLogin } from '../../dados/codigos'
import { desistirDoPedido, ITENS_DO_PEDIDO, meuPedido, meusDados, type ItemPedido, type Pedido } from '../../dados/pedidos'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataHora } from '../../utilitarios/formatos'
import { FormularioPedido } from './FormularioPedido'
import { CampoAcesso, TelaAcesso } from '../acesso/TelaAcesso'
import { Icone, type Area, type NomeIcone } from '../../componentes/Icone'
import { CabecalhoTela, Selo, type TipoSelo } from '../../componentes/Telas'
import { PassosDoPedido } from './PassosDoPedido'

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
    <div className="tela-nova">
      <CabecalhoTela
        titulo={
          <>
            <span className="so-computador">Meu pedido de associação</span>
            <span className="so-celular">Meu pedido</span>
          </>
        }
      />
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
              corrigir={correcao ? recusadosDe(correcao) : undefined}
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

          const destaque = DESTAQUE[pedido.situacao]
          return (
            <>
              <section className={`destaque-pedido area-${destaque.area}`} aria-labelledby="titulo-situacao">
                <span className="destaque-pedido-icone" aria-hidden="true">
                  <Icone nome={destaque.icone} tamanho={26} />
                </span>
                <span className="destaque-pedido-texto">
                  <h2 id="titulo-situacao">
                    {pedido.situacao === 'aprovado'
                      ? `Aprovado na Assembleia Ordinária de ${formatarData(pedido.assembleia_data)}`
                      : destaque.titulo}
                  </h2>
                  <span>
                    {pedido.situacao === 'enviado' &&
                      `Desde ${pedido.enviado_em ? formatarDataHora(pedido.enviado_em) : '—'}. Se faltar alguma coisa, o aviso aparece aqui e no sino.`}
                    {pedido.situacao === 'pendencia' && pedido.mensagem_pendencia}
                    {pedido.situacao === 'aguardando_assembleia' &&
                      'A secretaria aceitou a sua ficha. O pedido será votado na próxima Assembleia Ordinária (2ª quinzena de abril ou de outubro).'}
                    {pedido.situacao === 'aprovado' && (
                      <>
                        Bem-vindo ao COMEP!{' '}
                        <button type="button" className="botao-texto" onClick={recarregarConta}>
                          Atualizar meu acesso
                        </button>
                      </>
                    )}
                    {pedido.situacao === 'recusado' && `Motivo: ${pedido.motivo_recusa ?? '—'}`}
                    {pedido.situacao === 'desistiu' && 'Você pode fazer outro pedido quando quiser.'}
                  </span>
                </span>
              </section>

              <div className="duas-colunas">
                <section className="aba-conteudo" aria-labelledby="titulo-conferido">
                  <h2 id="titulo-conferido" className="titulo-secao">
                    O que a secretaria conferiu
                  </h2>
                  <ul className="bloco lista-linhas" aria-labelledby="titulo-conferido">
                    {itensDoPedido(pedido).map((item) => (
                      <li key={item.nome}>
                        <span className="linha-corpo">
                          <strong>{item.nome}</strong>
                          <span className="linha-selo">
                            <Selo tipo={item.selo.tipo}>{item.selo.texto}</Selo>
                          </span>
                        </span>
                        {item.selo.tipo === 'recusado' && pedido.situacao === 'pendencia' && (
                          <a href="#corrigir-pedido" className="link-forte">
                            Enviar de novo
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="bloco" aria-labelledby="titulo-passos">
                  <h2 id="titulo-passos">Os passos</h2>
                  <PassosDoPedido pedido={pedido} />
                </section>
              </div>

              {pedido.situacao === 'pendencia' && (
                <section id="corrigir-pedido" className="aba-conteudo" aria-labelledby="titulo-corrigir">
                  <h2 id="titulo-corrigir" className="titulo-secao">
                    Corrigir e enviar de novo
                  </h2>
                  {formulario(pedido)}
                </section>
              )}

              {ABERTOS.includes(pedido.situacao) && (
                <section className="bloco painel-perigo">
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
    </div>
  )
}

const DESTAQUE: Record<Pedido['situacao'], { titulo: string; area: Area; icone: NomeIcone }> = {
  enviado: { titulo: 'Em análise pela secretaria', area: 'eventos', icone: 'relogio' },
  pendencia: { titulo: 'A secretaria pediu uma correção', area: 'pessoas', icone: 'alerta' },
  aguardando_assembleia: { titulo: 'Esperando a Assembleia Ordinária', area: 'assembleias', icone: 'assembleia' },
  aprovado: { titulo: 'Aprovado', area: 'financas', icone: 'check' },
  recusado: { titulo: 'Pedido recusado', area: 'pessoas', icone: 'x' },
  desistiu: { titulo: 'Pedido encerrado por desistência', area: 'assembleias', icone: 'x' },
}

/** O que a secretaria recusou (o candidato envia de novo só isso). */
function recusadosDe(pedido: Pedido): ItemPedido[] {
  return pedido.itens.filter((i) => i.situacao === 'recusado').map((i) => i.item)
}

/** O selo da secretaria em cada item do pedido (a conferência é item por item desde 18/11/2026). */
function itensDoPedido(pedido: Pedido): { nome: string; selo: { tipo: TipoSelo; texto: string } }[] {
  return ITENS_DO_PEDIDO.map(({ chave, nome }) => {
    const conferido = pedido.itens.find((i) => i.item === chave)
    const enviado = chave === 'foto' ? Boolean(pedido.foto_caminho) : chave === 'comprovante' ? Boolean(pedido.comprovante_caminho) : true
    const selo: { tipo: TipoSelo; texto: string } = !enviado
      ? { tipo: 'recusado', texto: 'Não enviado' }
      : conferido?.situacao === 'aprovado'
        ? { tipo: 'aprovado', texto: 'Aprovado pela secretaria' }
        : conferido?.situacao === 'recusado'
          ? { tipo: 'recusado', texto: `Recusado: ${conferido.motivo ?? ''}` }
          : pedido.situacao === 'recusado' || pedido.situacao === 'desistiu'
            ? { tipo: 'recusado', texto: 'Não conferido' }
            : { tipo: 'analise', texto: 'Em análise' }
    return { nome, selo }
  })
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
