import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CamposIdentidade } from '../../componentes/CamposIdentidade'
import { GerarCodigo } from '../../componentes/GerarCodigo'
import { Icone } from '../../componentes/Icone'
import { PendenciasCredencial } from '../../componentes/PendenciasCredencial'
import { AbasDaTela, Chip, FotoOuIniciais, type Aba } from '../../componentes/Telas'
import {
  arquivarAssociado,
  atualizarContato,
  buscarFicha,
  definirPastorPresidente,
  mudarIgreja,
  NOME_DA_FORMA_ADMISSAO,
  NOME_DA_SITUACAO,
  registrarTitulo,
  SUGESTOES_FUNCAO,
  type FichaAssociado,
} from '../../dados/associados'
import { listarIgrejas, listarTitulos, type Igreja, type Titulo } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { formatarReais, listarValores, NOME_DA_CATEGORIA, type ValorContribuicao } from '../../dados/configuracoes'
import { dadosCredenciais } from '../../dados/credencial'
import { registrarDesligamento } from '../../dados/encontros'
import { situacaoDe, type SituacaoContribuicao } from '../../dados/financeiro'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso, numeroDoRegistro } from '../../utilitarios/formatos'
import { erroDaIdentidade, identidadeInicial, identidadeParaGravar } from '../../utilitarios/identidade'
import { CredencialNaTela, SituacaoAgora } from '../credencial/Credenciais'

// Ministros e inscrições › a ficha do ministro (aprovada em 18/11/2026: a ficha em abas, no mesmo formato do Meu perfil).
// Abas com endereço próprio: Dados (/ministros/:id), Igreja, Título, Contribuição, Credencial, Acesso e Situação.

const ABAS = (id: string): Aba[] => [
  { para: `/ministros/${id}`, nome: 'Dados' },
  { para: `/ministros/${id}/igreja`, nome: 'Igreja' },
  { para: `/ministros/${id}/titulo`, nome: 'Título' },
  { para: `/ministros/${id}/contribuicao`, nome: 'Contribuição', curto: 'Contrib.' },
  { para: `/ministros/${id}/credencial`, nome: 'Credencial' },
  { para: `/ministros/${id}/acesso`, nome: 'Acesso' },
  { para: `/ministros/${id}/situacao`, nome: 'Situação' },
]

/** /ministros/:pessoaId e /ministros/:pessoaId/:aba — remonta a tela ao trocar de pessoa */
export function DetalheMinistro() {
  const { pessoaId, aba = 'dados' } = useParams()
  return <Ficha key={pessoaId} pessoaId={pessoaId ?? ''} aba={aba} />
}

type DadosTela = {
  ficha: FichaAssociado | null
  titulos: Titulo[]
  igrejas: Igreja[]
  valores: ValorContribuicao[]
  situacao: SituacaoContribuicao | null
}

type Retorno = { sucesso?: string; erro?: string }

function Ficha({ pessoaId, aba }: { pessoaId: string; aba: string }) {
  const location = useLocation()
  const [retorno, setRetorno] = useState<Retorno>({
    sucesso: (location.state as { mensagem?: string } | null)?.mensagem,
  })
  // trocou de aba: a mensagem da aba anterior não vale mais
  const [abaDaMensagem, setAbaDaMensagem] = useState(aba)
  const mensagem = abaDaMensagem === aba ? retorno : {}
  const [carga, recarregar] = useCarregar(async () => {
    const [ficha, titulos, igrejas, valores, situacao] = await Promise.all([
      buscarFicha(pessoaId),
      listarTitulos(),
      listarIgrejas(),
      listarValores(),
      situacaoDe(pessoaId),
    ])
    if (ficha.erro !== null) return ficha
    if (titulos.erro !== null) return titulos
    if (igrejas.erro !== null) return igrejas
    if (valores.erro !== null) return valores
    return ok<DadosTela>({
      ficha: ficha.dados,
      titulos: titulos.dados,
      igrejas: igrejas.dados,
      valores: valores.dados.vigentes,
      situacao: situacao.erro === null ? situacao.dados : null,
    })
  })

  /** Depois de cada ação: mostra o resultado e, se deu certo, recarrega a ficha. */
  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro ? { erro: r.erro } : { sucesso })
    setAbaDaMensagem(aba)
    if (!r.erro) recarregar()
    return !r.erro
  }

  return (
    <div className="tela-nova">
      <p className="trilha">
        <Link to="/ministros">← Ministros</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ ficha, titulos, igrejas, valores, situacao }) =>
          !ficha ? (
            <Aviso titulo="Associado não encontrado">
              <p>O cadastro pode ter sido arquivado.</p>
            </Aviso>
          ) : (
            <>
              <CabecalhoFicha ficha={ficha} situacao={situacao} />
              <AbasDaTela rotulo="Partes da ficha" abas={ABAS(pessoaId)} />
              <Mensagem sucesso={mensagem.sucesso} erro={mensagem.erro} />
              {aba === 'igreja' ? (
                <Igrejas ficha={ficha} igrejas={igrejas} concluir={concluir} />
              ) : aba === 'titulo' ? (
                <Titulos ficha={ficha} titulos={titulos} concluir={concluir} />
              ) : aba === 'contribuicao' ? (
                <Contribuicao ficha={ficha} valores={valores} situacao={situacao} />
              ) : aba === 'credencial' ? (
                <AbaCredencial pessoaId={pessoaId} />
              ) : aba === 'acesso' ? (
                <AbaAcesso ficha={ficha} />
              ) : aba === 'situacao' ? (
                <AbaSituacao ficha={ficha} concluir={concluir} />
              ) : (
                <>
                  <Dados ficha={ficha} concluir={concluir} />
                  <PendenciasCredencial pendencias={ficha.pendencias} verEm={`/ministros/${pessoaId}/credencial`} />
                </>
              )}
            </>
          )
        }
      </MostrarCarga>
    </div>
  )
}

type PropsConteudo = {
  ficha: FichaAssociado
  titulos: Titulo[]
  igrejas: Igreja[]
  valores: ValorContribuicao[]
  situacao: SituacaoContribuicao | null
  concluir: (r: { erro: string | null }, sucesso: string) => boolean
}

/** O alto da ficha: as iniciais, o nome e as etiquetas (em dia, título, nº, pastor presidente…). */
function CabecalhoFicha({ ficha, situacao }: Pick<PropsConteudo, 'ficha' | 'situacao'>) {
  const { associado } = ficha
  return (
    <section className="bloco cabecalho-ficha" aria-label="O ministro">
      <FotoOuIniciais foto={null} nome={associado.nome} largura={64} />
      <div className="cabecalho-ficha-texto">
        <span className="cabecalho-ficha-modulo">Ministros e inscrições › Ficha do ministro</span>
        <h1>{associado.nome}</h1>
        <span className="chips">
          {associado.situacao !== 'ativo' ? (
            <Chip area="assembleias">{NOME_DA_SITUACAO[associado.situacao]}</Chip>
          ) : associado.jubilado ? (
            <Chip area="assembleias">Jubilado</Chip>
          ) : (
            situacao && (situacao.em_dia ? <Chip area="financas">Em dia</Chip> : <Chip area="pessoas">Em atraso</Chip>)
          )}
          {associado.titulo && <Chip area="assembleias">{associado.titulo}</Chip>}
          <Chip area="pessoas">Nº {numeroDoRegistro(associado.numero_registro)}</Chip>
          {associado.pastor_presidente && <Chip area="pessoas">Pastor presidente</Chip>}
          {!associado.tem_login && <Chip area="eventos">Sem login</Chip>}
        </span>
      </div>
    </section>
  )
}

/** Aba "Dados": nome, telefone, e-mail, CPF e filiação (vão na credencial). */
function Dados({ ficha, concluir }: Pick<PropsConteudo, 'ficha' | 'concluir'>) {
  const { associado } = ficha
  const [nome, setNome] = useState(associado.nome)
  const [telefone, setTelefone] = useState(associado.telefone ?? '')
  const [email, setEmail] = useState(associado.email ?? '')
  const [identidade, setIdentidade] = useState(identidadeInicial(ficha.identidade))
  const [enviando, setEnviando] = useState(false)

  async function salvar() {
    const erro = erroDaIdentidade(identidade, false)
    if (erro) return concluir({ erro }, '')
    setEnviando(true)
    // Quem já tem login usa o e-mail do próprio login; só se corrige o de quem ainda não tem.
    const r = await atualizarContato(
      associado.pessoa_id,
      { nome, telefone, ...(associado.tem_login ? {} : { email }) },
      identidadeParaGravar(identidade, ficha.identidade, true),
    )
    setEnviando(false)
    concluir(r, 'Dados salvos.')
  }

  return (
    <section className="aba-conteudo" aria-labelledby="titulo-dados">
      <h2 id="titulo-dados" className="somente-leitor">
        Dados pessoais
      </h2>
      <form
        aria-labelledby="titulo-dados"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Nome completo *
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Telefone (WhatsApp)
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <label>
            E-mail
            <input type="email" value={email} disabled={associado.tem_login} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <CamposIdentidade valor={identidade} gravada={ficha.identidade} aoMudar={setIdentidade} livre />
        </div>
        {associado.tem_login && <p className="detalhe">O e-mail é o do login: só a própria pessoa o usa.</p>}
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar
          </button>
        </div>
      </form>
    </section>
  )
}

/** Aba "Credencial": a credencial digital (frente e verso), a situação e os atalhos para imprimir e emitir outra. */
function AbaCredencial({ pessoaId }: { pessoaId: string }) {
  const [carga, recarregar] = useCarregar(() => dadosCredenciais([pessoaId]))
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(pacote) => {
        const c = pacote.credenciais[0]
        if (!c) {
          return (
            <Aviso titulo="Sem credencial">
              <p>A credencial é do associado ativo.</p>
            </Aviso>
          )
        }
        return (
          <div className="aba-conteudo">
            <CredencialNaTela pacote={pacote} c={c} />
            <div className="acoes">
              <Link className="botao botao-com-icone" to={`/credenciais/imprimir?p=${c.pessoa_id}`}>
                <Icone nome="imprimir" tamanho={18} />
                Imprimir
              </Link>
              <Link className="botao botao-secundario" to={`/credenciais/${c.pessoa_id}`}>
                Gerar nova (perda ou roubo)
              </Link>
            </div>
            <SituacaoAgora c={c} />
            <PendenciasCredencial pendencias={c.pendencias} />
          </div>
        )
      }}
    </MostrarCarga>
  )
}

/** Aba "Acesso": o login no sistema e o código de primeiro acesso (ou de nova senha). */
function AbaAcesso({ ficha }: Pick<PropsConteudo, 'ficha'>) {
  const { associado } = ficha
  return (
    <div className="dois-blocos">
      <section className="bloco" aria-labelledby="titulo-login">
        <h2 id="titulo-login">Login no sistema</h2>
        <span className="chips">
          {associado.tem_login ? <Chip area="financas">Tem acesso</Chip> : <Chip area="eventos">Ainda sem login</Chip>}
        </span>
        <dl className="definicoes">
          <dt>E-mail</dt>
          <dd>{associado.email || 'Não informado'}</dd>
          <dt>Telefone</dt>
          <dd>{associado.telefone || 'Não informado'}</dd>
        </dl>
        <p className="detalhe">
          {associado.tem_login
            ? 'Esqueceu a senha? Gere um código de nova senha e entregue a ele (vale por 7 dias).'
            : 'Ainda não entrou no sistema? Gere um código de primeiro acesso e entregue a ele (vale por 7 dias).'}
        </p>
        <GerarCodigo pessoaId={associado.pessoa_id} nome={associado.nome} temLogin={associado.tem_login} telefone={associado.telefone} />
      </section>
      <section className="bloco" aria-labelledby="titulo-perfis">
        <h2 id="titulo-perfis">Perfis de acesso</h2>
        <p>
          Todo associado ativo tem o perfil <strong>Ministro</strong>
          {associado.pastor_presidente && (
            <>
              {' '}
              e, como pastor presidente, o de <strong>Pastor presidente</strong>
            </>
          )}
          .
        </p>
        <p className="detalhe">Os perfis da diretoria (secretaria, tesouraria…) a presidência concede em Administração › Perfis de acesso.</p>
      </section>
    </div>
  )
}

/** Aba "Situação": a admissão, o desligamento (Art. 8º) e o arquivamento de cadastro feito por engano. */
function AbaSituacao({ ficha, concluir }: Pick<PropsConteudo, 'ficha' | 'concluir'>) {
  const navigate = useNavigate()
  const { associado } = ficha

  async function arquivar() {
    const r = await arquivarAssociado(associado.id)
    if (r.erro !== null) {
      concluir(r, '')
      return
    }
    navigate('/ministros', { replace: true, state: { mensagem: `Cadastro de ${associado.nome} arquivado.` } })
  }

  return (
    <div className="aba-conteudo">
      <div className="dois-blocos">
        <section className="bloco" aria-labelledby="titulo-admissao">
          <h2 id="titulo-admissao">Admissão no COMEP</h2>
          <dl className="definicoes">
            <dt>Situação</dt>
            <dd>{NOME_DA_SITUACAO[associado.situacao]}</dd>
            <dt>Forma</dt>
            <dd>{NOME_DA_FORMA_ADMISSAO[associado.forma_admissao]}</dd>
            <dt>Associado desde</dt>
            <dd>{formatarData(associado.admitido_em) || 'Não informado'}</dd>
            {associado.assembleia_data && (
              <>
                <dt>Assembleia</dt>
                <dd>
                  {formatarData(associado.assembleia_data)}
                  {associado.assembleia_ata && ` — ${associado.assembleia_ata}`}
                </dd>
              </>
            )}
            <dt>Jubilado</dt>
            <dd>{associado.jubilado ? 'sim' : 'não'}</dd>
            {associado.observacoes && (
              <>
                <dt>Observações</dt>
                <dd>{associado.observacoes}</dd>
              </>
            )}
          </dl>
        </section>
        <Desligamento ficha={ficha} concluir={concluir} />
      </div>

      <section className="painel painel-perigo">
        <h2>Arquivar cadastro</h2>
        <p className="detalhe">
          Só para cadastro feito <strong>por engano</strong> (pessoa duplicada ou errada). Desligamento e falecimento ficam em
          "Desligamento" (Art. 8º): nada se arquiva nesses casos.
        </p>
        <BotaoConfirmar
          texto="Arquivar cadastro"
          confirmar="Confirmar arquivamento"
          aviso={`Arquivar o cadastro de ${associado.nome}? Ele perde o perfil de ministro. Nada se apaga.`}
          aoConfirmar={() => void arquivar()}
        />
      </section>
    </div>
  )
}

/** Aba "Título": o título atual com o histórico e o registro de um título novo. */
function Titulos({ ficha, titulos, concluir }: Pick<PropsConteudo, 'ficha' | 'titulos' | 'concluir'>) {
  const [tituloId, setTituloId] = useState('')
  const [desde, setDesde] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [atual, ...anteriores] = ficha.titulos

  async function registrar() {
    setEnviando(true)
    const r = await registrarTitulo(ficha.associado.pessoa_id, tituloId, desde)
    setEnviando(false)
    if (concluir(r, 'Novo título registrado.')) {
      setTituloId('')
      setDesde('')
    }
  }

  return (
    <div className="dois-blocos">
      <section className="bloco" aria-labelledby="titulo-titulos">
        <h2 id="titulo-titulos">Título ministerial</h2>
        <dl className="definicoes definicoes-fortes">
          <dt>Atual</dt>
          <dd>
            {ficha.associado.titulo ?? 'Não informado'}
            {atual?.desde && ` · desde ${formatarData(atual.desde)}`}
          </dd>
        </dl>
        {anteriores.length > 0 && (
          <>
            <h3>Antes</h3>
            <ol className="historico" aria-label="Histórico de títulos">
              {anteriores.map((t) => (
                <li key={t.id}>
                  {t.titulo?.nome}
                  {t.desde && ` — desde ${formatarData(t.desde)}`}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <section className="bloco" aria-labelledby="titulo-novo-titulo">
        <h2 id="titulo-novo-titulo">Registrar novo título</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void registrar()
          }}
        >
          <label>
            Título
            <select required value={tituloId} onChange={(e) => setTituloId(e.target.value)}>
              <option value="">— Escolha o título —</option>
              {titulos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input type="date" max={hojeIso()} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Registrar o título
            </button>
          </div>
        </form>
        <p className="detalhe">O título anterior fica no histórico.</p>
      </section>
    </div>
  )
}

/** Aba "Igreja": a igreja atual (com o pastor presidente), o histórico e o registro da troca. */
function Igrejas({ ficha, igrejas, concluir }: Pick<PropsConteudo, 'ficha' | 'igrejas' | 'concluir'>) {
  const atual = ficha.vinculos.find((v) => v.fim === null)
  const [igrejaId, setIgrejaId] = useState('')
  const [funcao, setFuncao] = useState('')
  const [data, setData] = useState(hojeIso())
  const [presidente, setPresidente] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function marcarPresidente(valor: boolean) {
    if (!atual) return
    setEnviando(true)
    const r = await definirPastorPresidente(atual.id, valor)
    setEnviando(false)
    concluir(r, valor ? 'Marcado como pastor presidente desta igreja.' : 'Desmarcado como pastor presidente.')
  }

  async function trocar() {
    setEnviando(true)
    const r = await mudarIgreja(ficha.associado.pessoa_id, igrejaId, funcao, data, presidente)
    setEnviando(false)
    if (concluir(r, 'Troca de igreja registrada.')) {
      setIgrejaId('')
      setFuncao('')
      setPresidente(false)
    }
  }

  return (
    <div className="dois-blocos">
      <section className="bloco" aria-labelledby="titulo-igreja-atual">
        <h2 id="titulo-igreja-atual">Igreja atual</h2>
        {atual ? (
          <dl className="definicoes definicoes-fortes">
            <dt>Igreja</dt>
            <dd>
              <Link to={`/igrejas/${atual.igreja_id}`}>{atual.igreja?.nome}</Link>
            </dd>
            <dt>Função</dt>
            <dd>{atual.funcao || 'Não informada'}</dd>
            <dt>Desde</dt>
            <dd>{atual.inicio ? formatarData(atual.inicio) : 'Não informado'}</dd>
            <dt>Pastor presidente</dt>
            <dd>{atual.pastor_presidente ? 'sim' : 'não'}</dd>
          </dl>
        ) : (
          <p>
            <strong>Sem igreja</strong>
          </p>
        )}
        {atual && (
          <p>
            <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => void marcarPresidente(!atual.pastor_presidente)}>
              {atual.pastor_presidente ? 'Desmarcar pastor presidente' : 'Marcar como pastor presidente desta igreja'}
            </button>
          </p>
        )}
        {ficha.vinculos.length > 1 && (
          <>
            <h3>Histórico</h3>
            <ol className="historico" aria-label="Histórico de igrejas">
              {ficha.vinculos.map((v) => (
                <li key={v.id}>
                  {v.igreja?.nome}
                  {v.funcao && ` (${v.funcao})`}
                  {v.pastor_presidente && ' · pastor presidente'}
                  <span className="detalhe">
                    {' '}
                    {v.inicio ? formatarData(v.inicio) : '?'} a {v.fim ? formatarData(v.fim) : 'hoje'}
                  </span>
                  {v.fim === null && <span className="etiqueta etiqueta-marca">Atual</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="bloco" aria-labelledby="titulo-troca">
        <h2 id="titulo-troca">Registrar troca de igreja</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void trocar()
          }}
        >
          <label>
            Nova igreja
            <select required value={igrejaId} onChange={(e) => setIgrejaId(e.target.value)}>
              <option value="">— Escolha a igreja —</option>
              {igrejas
                .filter((i) => i.id !== atual?.igreja_id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Função
            <input list="sugestoes-funcao-troca" value={funcao} onChange={(e) => setFuncao(e.target.value)} />
            <datalist id="sugestoes-funcao-troca">
              {SUGESTOES_FUNCAO.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            A partir de
            <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="caixa-marcar">
            <input type="checkbox" checked={presidente} onChange={(e) => setPresidente(e.target.checked)} />
            Pastor presidente da nova igreja
          </label>
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Registrar a troca
            </button>
          </div>
        </form>
        <p className="detalhe">A igreja anterior fica no histórico.</p>
      </section>
    </div>
  )
}

/** Aba "Contribuição": a categoria (automática), os valores e a situação de agora. */
function Contribuicao({ ficha, valores, situacao }: Pick<PropsConteudo, 'ficha' | 'valores' | 'situacao'>) {
  const { associado } = ficha
  const categoria = associado.categoria_contribuicao
  const valor = (tipo: ValorContribuicao['tipo']) => valores.find((v) => v.categoria === categoria && v.tipo === tipo)

  const mensal = valor('mensal')
  const anual = valor('anual')

  return (
    <section className="aba-conteudo" aria-labelledby="titulo-contribuicao">
      <h2 id="titulo-contribuicao" className="somente-leitor">
        Contribuição
      </h2>
      <div className="tres-numeros">
        <div className="bloco bloco-numero">
          <span className="rotulo">Categoria</span>
          <strong>{NOME_DA_CATEGORIA[categoria]}</strong>
        </div>
        <div className="bloco bloco-numero">
          <span className="rotulo">Valor</span>
          <strong>{mensal ? `${formatarReais(mensal.valor)} por mês` : 'Sem valor em Configurações'}</strong>
        </div>
        <div className="bloco bloco-numero">
          <span className="rotulo">Situação</span>
          <span className="chips">
            {associado.jubilado ? (
              <Chip area="assembleias">Isento (jubilado)</Chip>
            ) : situacao ? (
              situacao.em_dia ? (
                <Chip area="financas">Em dia</Chip>
              ) : (
                <Chip area="pessoas">
                  Em atraso: {situacao.cobrancas_vencidas} vencida(s), {formatarReais(situacao.valor_vencido)}
                </Chip>
              )
            ) : (
              <Chip area="assembleias">Sem cobrança</Chip>
            )}
          </span>
        </div>
      </div>
      <div className="bloco">
        <p>
          Categoria: <strong>{NOME_DA_CATEGORIA[categoria]}</strong>
          {mensal && anual && (
            <>
              {' '}
              — {formatarReais(mensal.valor)} por mês ou {formatarReais(anual.valor)} por ano
            </>
          )}
        </p>
        <p className="detalhe">
          A categoria é automática: jubilado é isento; quem está marcado como pastor presidente da igreja atual paga como presidente
          de igreja; os demais, como não presidente. Os valores ficam em Configurações; os pagamentos, com a tesouraria (Financeiro).
        </p>
        <p className="detalhe">
          <strong>Jubilação:</strong> o documento vem da denominação, a secretaria põe na pauta da assembleia (item "Jubilação de") e
          a assembleia aprova. O jubilado é isento, vota, mas não pode ser votado (14/11/2026).
        </p>
      </div>
    </section>
  )
}

/** Os casos do Art. 8º que são fatos: a diretoria homologa e registra, sem votação (pergunta 5, 14/11/2026). */
const HOMOLOGADOS = [
  { inciso: 'I', nome: 'I — a pedido, por escrito', documento: 'A carta do associado (data e o que pede) *' },
  { inciso: 'III', nome: 'III — transferência pela denominação para outra cidade', documento: 'O ofício da denominação *' },
  { inciso: 'IV', nome: 'IV — três faltas seguidas às assembleias, sem justificativa', documento: 'Observação' },
  { inciso: 'V', nome: 'V — falecimento', documento: 'Observação' },
] as const
type Homologado = (typeof HOMOLOGADOS)[number]['inciso']

/**
 * Desligamento (Art. 8º): a conduta (II) vai à votação da Assembleia Ordinária, por 3/5 dos votos válidos
 * (Assembleias → condução); I, III, IV e V são homologados e registrados aqui pela diretoria.
 */
function Desligamento({ ficha, concluir }: Pick<PropsConteudo, 'ficha' | 'concluir'>) {
  const { associado } = ficha
  const [inciso, setInciso] = useState<Homologado | ''>('')
  const [data, setData] = useState('')
  const [observacao, setObservacao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const escolhido = HOMOLOGADOS.find((h) => h.inciso === inciso)
  return (
    <section className="bloco" aria-labelledby="titulo-desligamento">
      <h2 id="titulo-desligamento">Desligamento (Art. 8º)</h2>
      {associado.situacao !== 'ativo' ? (
        <p>
          Situação: <strong>{NOME_DA_SITUACAO[associado.situacao]}</strong>. O histórico fica guardado.
        </p>
      ) : (
        <>
          <p className="detalhe">
            <strong>Por conduta contrária à ética (II):</strong> depois do processo disciplinar, decide a Assembleia Ordinária, por 3/5
            dos votos válidos. Ponha o associado na pauta da AGO (item de 3/5, "Desligamento por conduta de") e registre a votação na
            condução. <strong>A pedido (I), transferência (III), três faltas seguidas às assembleias (IV) e falecimento (V)</strong> são
            fatos: a diretoria homologa e registra aqui.
          </p>
          <details className="acao-recolhida">
            <summary>Registrar desligamento homologado (I, III, IV ou V)</summary>
            <form
              className="form-linha"
              aria-label="Registrar desligamento"
              onSubmit={(e) => {
                e.preventDefault()
                if (!inciso) return
                void umaVez(async () =>
                  concluir(
                    await registrarDesligamento(associado.pessoa_id, inciso, data, observacao),
                    inciso === 'V' ? 'Falecimento registrado.' : 'Desligamento registrado.',
                  ),
                )
              }}
            >
              <label>
                Motivo (Art. 8º) *
                <select required value={inciso} onChange={(e) => setInciso(e.target.value as Homologado | '')}>
                  <option value="">— escolha —</option>
                  {HOMOLOGADOS.map((h) => (
                    <option key={h.inciso} value={h.inciso}>
                      {h.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo-curto">
                Data *
                <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                {escolhido?.documento ?? 'Documento ou observação'}
                <input
                  required={inciso === 'I' || inciso === 'III'}
                  maxLength={1000}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              </label>
              <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                {inciso === 'V' ? 'Registrar falecimento' : 'Registrar o desligamento'}
              </button>
            </form>
            {inciso === 'IV' && (
              <p className="detalhe">O sistema confere as faltas seguidas às assembleias (o número está em Configurações).</p>
            )}
          </details>
        </>
      )}
    </section>
  )
}
