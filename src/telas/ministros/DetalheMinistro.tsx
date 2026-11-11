import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  arquivarAssociado,
  atualizarContato,
  buscarFicha,
  mudarIgreja,
  NOME_DA_FORMA_ADMISSAO,
  NOME_DA_SITUACAO,
  registrarTitulo,
  SUGESTOES_FUNCAO,
  type FichaAssociado,
} from '../../dados/associados'
import { listarIgrejas, listarTitulos, type Igreja, type Titulo } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, hojeIso } from '../../utilitarios/formatos'

/** /ministros/:pessoaId — remonta a tela ao trocar de pessoa */
export function DetalheMinistro() {
  const { pessoaId } = useParams()
  return <Ficha key={pessoaId} pessoaId={pessoaId ?? ''} />
}

type DadosTela = { ficha: FichaAssociado | null; titulos: Titulo[]; igrejas: Igreja[] }

type Retorno = { sucesso?: string; erro?: string }

function Ficha({ pessoaId }: { pessoaId: string }) {
  const location = useLocation()
  const [retorno, setRetorno] = useState<Retorno>({
    sucesso: (location.state as { mensagem?: string } | null)?.mensagem,
  })
  const [carga, recarregar] = useCarregar(async () => {
    const [ficha, titulos, igrejas] = await Promise.all([buscarFicha(pessoaId), listarTitulos(), listarIgrejas()])
    if (ficha.erro !== null) return ficha
    if (titulos.erro !== null) return titulos
    if (igrejas.erro !== null) return igrejas
    return ok<DadosTela>({ ficha: ficha.dados, titulos: titulos.dados, igrejas: igrejas.dados })
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
        {({ ficha, titulos, igrejas }) =>
          !ficha ? (
            <Aviso titulo="Associado não encontrado">
              <p>O cadastro pode ter sido arquivado.</p>
            </Aviso>
          ) : (
            <Conteudo ficha={ficha} titulos={titulos} igrejas={igrejas} retorno={retorno} concluir={concluir} />
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
  retorno: Retorno
  concluir: (r: { erro: string | null }, sucesso: string) => boolean
}

function Conteudo({ ficha, titulos, igrejas, retorno, concluir }: PropsConteudo) {
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
        {!associado.tem_login && <span className="etiqueta etiqueta-neutra">Sem login</span>}
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

      <Contato ficha={ficha} concluir={concluir} />
      <Titulos ficha={ficha} titulos={titulos} concluir={concluir} />
      <Igrejas ficha={ficha} igrejas={igrejas} concluir={concluir} />

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
                {associado.assembleia_ata && ` — ata ${associado.assembleia_ata}`}
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
  const [enviando, setEnviando] = useState(false)

  async function salvar() {
    setEnviando(true)
    // Quem já tem login usa o e-mail do próprio login; só se corrige o de quem ainda não tem.
    const r = await atualizarContato(associado.pessoa_id, {
      nome,
      telefone,
      ...(associado.tem_login ? {} : { email }),
    })
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
        <dl className="definicoes">
          <dt>Telefone</dt>
          <dd>{associado.telefone || 'Não informado'}</dd>
          <dt>E-mail</dt>
          <dd>{associado.email || 'Não informado'}</dd>
        </dl>
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
  const [enviando, setEnviando] = useState(false)

  async function trocar() {
    setEnviando(true)
    const r = await mudarIgreja(ficha.associado.pessoa_id, igrejaId, funcao, data)
    setEnviando(false)
    if (concluir(r, 'Troca de igreja registrada.')) {
      setIgrejaId('')
      setFuncao('')
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
          </>
        ) : (
          <strong>Sem igreja</strong>
        )}
      </p>
      {ficha.vinculos.length > 1 && (
        <>
          <h3>Histórico</h3>
          <ol className="historico" aria-label="Histórico de igrejas">
            {ficha.vinculos.map((v) => (
              <li key={v.id}>
                {v.igreja?.nome}
                {v.funcao && ` (${v.funcao})`}
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
          <button type="submit" className="botao" disabled={enviando}>
            Registrar troca
          </button>
        </form>
      </details>
    </section>
  )
}
