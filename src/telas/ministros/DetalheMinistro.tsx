import { CamposIdentidade } from '../../componentes/CamposIdentidade'
import { erroDaIdentidade, identidadeInicial, identidadeParaGravar } from '../../utilitarios/identidade'
import { PendenciasCredencial } from '../../componentes/PendenciasCredencial'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { GerarCodigo } from '../../componentes/GerarCodigo'
import {
  arquivarAssociado,
  atualizarContato,
  buscarFicha,
  definirJubilado,
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
import {
  formatarReais,
  listarValores,
  NOME_DA_CATEGORIA,
  type ValorContribuicao,
} from '../../dados/configuracoes'
import { situacaoDe, type SituacaoContribuicao } from '../../dados/financeiro'
import { useCarregar } from '../../estado/useCarregar'
import { formatarCpf, formatarData, hojeIso } from '../../utilitarios/formatos'

/** /ministros/:pessoaId — remonta a tela ao trocar de pessoa */
export function DetalheMinistro() {
  const { pessoaId } = useParams()
  return <Ficha key={pessoaId} pessoaId={pessoaId ?? ''} />
}

type DadosTela = {
  ficha: FichaAssociado | null
  titulos: Titulo[]
  igrejas: Igreja[]
  valores: ValorContribuicao[]
  situacao: SituacaoContribuicao | null
}

type Retorno = { sucesso?: string; erro?: string }

function Ficha({ pessoaId }: { pessoaId: string }) {
  const location = useLocation()
  const [retorno, setRetorno] = useState<Retorno>({
    sucesso: (location.state as { mensagem?: string } | null)?.mensagem,
  })
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
    if (!r.erro) recarregar()
    return !r.erro
  }

  return (
    <>
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
            <Conteudo
              ficha={ficha}
              titulos={titulos}
              igrejas={igrejas}
              valores={valores}
              situacao={situacao}
              retorno={retorno}
              concluir={concluir}
            />
          )
        }
      </MostrarCarga>
    </>
  )
}

type PropsConteudo = {
  ficha: FichaAssociado
  titulos: Titulo[]
  igrejas: Igreja[]
  valores: ValorContribuicao[]
  situacao: SituacaoContribuicao | null
  retorno: Retorno
  concluir: (r: { erro: string | null }, sucesso: string) => boolean
}

function Conteudo({ ficha, titulos, igrejas, valores, situacao, retorno, concluir }: PropsConteudo) {
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
    <>
      <h1>{associado.nome}</h1>
      <p className="etiquetas">
        <span className="etiqueta etiqueta-marca">Nº de registro {associado.numero_registro}</span>
        <span className="etiqueta">{NOME_DA_SITUACAO[associado.situacao]}</span>
        {associado.pastor_presidente && <span className="etiqueta">Pastor presidente</span>}
        {associado.jubilado && <span className="etiqueta">Jubilado</span>}
        {!associado.tem_login && <span className="etiqueta etiqueta-neutra">Sem login</span>}
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

      <Contato ficha={ficha} concluir={concluir} />
      <PendenciasCredencial pendencias={ficha.pendencias} />
      <Titulos ficha={ficha} titulos={titulos} concluir={concluir} />
      <Igrejas ficha={ficha} igrejas={igrejas} concluir={concluir} />
      <Contribuicao ficha={ficha} valores={valores} situacao={situacao} concluir={concluir} />

      <section className="painel" aria-labelledby="titulo-admissao">
        <h2 id="titulo-admissao">Admissão no COMEP</h2>
        <dl className="definicoes">
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
          {associado.observacoes && (
            <>
              <dt>Observações</dt>
              <dd>{associado.observacoes}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="painel painel-perigo">
        <h2>Arquivar cadastro</h2>
        <p className="detalhe">
          Só para cadastro feito <strong>por engano</strong> (pessoa duplicada ou errada). Desligamento e falecimento
          são registrados em assembleia (Art. 8º) e entram numa próxima fase.
        </p>
        <BotaoConfirmar
          texto="Arquivar cadastro"
          confirmar="Confirmar arquivamento"
          aviso={`Arquivar o cadastro de ${associado.nome}? Ele perde o perfil de ministro. Nada se apaga.`}
          aoConfirmar={() => void arquivar()}
        />
      </section>
    </>
  )
}

function Contato({ ficha, concluir }: Pick<PropsConteudo, 'ficha' | 'concluir'>) {
  const { associado } = ficha
  const [editando, setEditando] = useState(false)
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
    if (concluir(r, 'Dados de contato salvos.')) setEditando(false)
  }

  return (
    <section className="painel" aria-labelledby="titulo-contato">
      <div className="cabecalho-painel">
        <h2 id="titulo-contato">Contato</h2>
        {!editando && (
          <button type="button" className="botao-texto" onClick={() => setEditando(true)}>
            Editar
          </button>
        )}
      </div>
      {editando ? (
        <form
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
              <input
                type="email"
                value={email}
                disabled={associado.tem_login}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <CamposIdentidade valor={identidade} gravada={ficha.identidade} aoMudar={setIdentidade} livre />
          </div>
          {associado.tem_login && <p className="detalhe">O e-mail é o do login e só a própria pessoa o usa.</p>}
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Salvar
            </button>
            <button type="button" className="botao botao-secundario" onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="definicoes">
            <dt>CPF</dt>
            <dd>{ficha.identidade.cpf ? formatarCpf(ficha.identidade.cpf) : 'Não informado'}</dd>
            <dt>Filiação</dt>
            <dd>
              {[ficha.identidade.nome_mae, ficha.identidade.nome_pai].filter(Boolean).join(' e ') || 'Não informada'}
            </dd>
            <dt>Telefone</dt>
            <dd>{associado.telefone || 'Não informado'}</dd>
            <dt>E-mail</dt>
            <dd>{associado.email || 'Não informado'}</dd>
            <dt>Login</dt>
            <dd>{associado.tem_login ? 'Já tem login no portal' : 'Ainda sem login no portal'}</dd>
          </dl>
          <GerarCodigo
            pessoaId={associado.pessoa_id}
            nome={associado.nome}
            temLogin={associado.tem_login}
            telefone={associado.telefone}
          />
        </>
      )}
    </section>
  )
}

function Titulos({ ficha, titulos, concluir }: Pick<PropsConteudo, 'ficha' | 'titulos' | 'concluir'>) {
  const [tituloId, setTituloId] = useState('')
  const [desde, setDesde] = useState('')
  const [enviando, setEnviando] = useState(false)

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
    <section className="painel" aria-labelledby="titulo-titulos">
      <h2 id="titulo-titulos">Título ministerial</h2>
      <p>
        Atual: <strong>{ficha.associado.titulo ?? 'Não informado'}</strong>
      </p>
      {ficha.titulos.length > 1 && (
        <>
          <h3>Histórico</h3>
          <ol className="historico">
            {ficha.titulos.map((t, i) => (
              <li key={t.id}>
                {t.titulo?.nome}
                {t.desde && ` — desde ${formatarData(t.desde)}`}
                {i === 0 && <span className="etiqueta etiqueta-marca">Atual</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      <details className="acao-recolhida">
        <summary>Registrar novo título</summary>
        <form
          className="form-linha"
          onSubmit={(e) => {
            e.preventDefault()
            void registrar()
          }}
        >
          <label>
            Novo título
            <select required value={tituloId} onChange={(e) => setTituloId(e.target.value)}>
              <option value="">— Escolha —</option>
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
          <button type="submit" className="botao" disabled={enviando}>
            Registrar título
          </button>
        </form>
      </details>
    </section>
  )
}

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
    <section className="painel" aria-labelledby="titulo-igrejas">
      <h2 id="titulo-igrejas">Igreja</h2>
      <p>
        Atual:{' '}
        {atual ? (
          <>
            <Link to={`/igrejas/${atual.igreja_id}`}>
              <strong>{atual.igreja?.nome}</strong>
            </Link>
            {atual.funcao && ` — ${atual.funcao}`}
            {atual.pastor_presidente && <span className="etiqueta etiqueta-marca">Pastor presidente</span>}
          </>
        ) : (
          <strong>Sem igreja</strong>
        )}
      </p>
      {atual && (
        <p>
          <button
            type="button"
            className="botao botao-secundario"
            disabled={enviando}
            onClick={() => void marcarPresidente(!atual.pastor_presidente)}
          >
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
      <details className="acao-recolhida">
        <summary>Registrar troca de igreja</summary>
        <form
          className="form-linha"
          onSubmit={(e) => {
            e.preventDefault()
            void trocar()
          }}
        >
          <label>
            Nova igreja
            <select required value={igrejaId} onChange={(e) => setIgrejaId(e.target.value)}>
              <option value="">— Escolha —</option>
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
          <button type="submit" className="botao" disabled={enviando}>
            Registrar troca
          </button>
        </form>
      </details>
    </section>
  )
}

function Contribuicao({ ficha, valores, situacao, concluir }: Pick<PropsConteudo, 'ficha' | 'valores' | 'situacao' | 'concluir'>) {
  const { associado } = ficha
  const [enviando, setEnviando] = useState(false)
  const categoria = associado.categoria_contribuicao
  const valor = (tipo: ValorContribuicao['tipo']) =>
    valores.find((v) => v.categoria === categoria && v.tipo === tipo)

  async function alternarJubilado() {
    setEnviando(true)
    const r = await definirJubilado(associado.id, !associado.jubilado)
    setEnviando(false)
    concluir(r, associado.jubilado ? 'Desmarcado como jubilado.' : 'Marcado como jubilado (isento da contribuição).')
  }

  const mensal = valor('mensal')
  const anual = valor('anual')

  return (
    <section className="painel" aria-labelledby="titulo-contribuicao">
      <h2 id="titulo-contribuicao">Contribuição</h2>
      <p>
        Categoria: <strong>{NOME_DA_CATEGORIA[categoria]}</strong>
        {mensal && anual && (
          <>
            {' '}
            — {formatarReais(mensal.valor)} por mês ou {formatarReais(anual.valor)} por ano
          </>
        )}
      </p>
      {situacao && !associado.jubilado && (
        <p>
          Situação:{' '}
          {situacao.em_dia ? (
            <span className="etiqueta etiqueta-ok">Em dia</span>
          ) : (
            <span className="etiqueta etiqueta-atraso">
              Em atraso: {situacao.cobrancas_vencidas} vencida(s), {formatarReais(situacao.valor_vencido)}
            </span>
          )}
        </p>
      )}
      <p className="detalhe">
        A categoria é automática: jubilado é isento; quem está marcado como pastor presidente da igreja atual paga como
        presidente de igreja; os demais, como não presidente. Os valores ficam em Configurações.
      </p>
      <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => void alternarJubilado()}>
        {associado.jubilado ? 'Desmarcar jubilado' : 'Marcar como jubilado'}
      </button>
    </section>
  )
}
