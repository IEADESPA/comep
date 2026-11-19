// Credenciais › Modelos (Fase 5.5, parte 7; rodadas 8 e 9, aprovadas: o editor na tela inteira e "Quem recebe").
//   * a galeria: um modelo por grupo, na ordem (vale o primeiro que serve à pessoa), com a prévia, quantas pessoas
//     recebem hoje, "Duplicar", "Quem recebe" e "Editar"; embaixo, "Começar de um modelo pronto";
//   * Quem recebe: à esquerda, a ordem dos modelos (arrastar ou as setas); no meio, as condições (da pessoa, da
//     igreja e do tempo; todas ou qualquer uma) e o exclusivo pago pela igreja; à direita, quem recebe hoje;
//   * o padrão recebe quem sobra; o da readequação, sempre o ministro da igreja sem registro (não sai da ordem).
import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoArquivar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { FaceCredencial } from '../../componentes/CartaoCredencial'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Chip } from '../../componentes/Telas'
import { listarAssociados, type Associado } from '../../dados/associados'
import { listarDenominacoes, listarIgrejas, listarTitulos, NOME_DA_TRADICAO, type Denominacao, type Igreja, type Titulo, type Tradicao } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarComissoes, type Comissao } from '../../dados/comissoes'
import {
  arquivarModeloGrupo,
  duplicarModelo,
  entradasParaLigar,
  ordenarModelos,
  painelModelos,
  porModeloEmUso,
  registrarPagamentoExclusivo,
  salvarModeloGrupo,
  salvarVersaoDoModelo,
  simularQuemRecebe,
  urlValidacao,
  type Condicao,
  type EntradaDoCaixa,
  type ModeloGrupo,
  type PainelModelos,
  type Regra,
  type Simulacao,
  type TipoCondicao,
} from '../../dados/credencial'
import { CARGOS } from '../../dados/diretoria'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso, iniciaisDe } from '../../utilitarios/formatos'
import { DADOS_EXEMPLO, desenhoDoModelo, PRONTOS, valoresDaCredencial, type ModeloCredencial } from '../../utilitarios/modeloCredencial'
import { DICA_VALOR, lerValor, PADRAO_VALOR, valorParaCampo } from '../../utilitarios/valores'

type Retorno = { sucesso?: string; erro?: string }

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ---------------------------------------------------------------------
// As condições de "Quem recebe" (rodada 9): da pessoa, da igreja e do tempo
// ---------------------------------------------------------------------

const CONDICOES: readonly { tipo: TipoCondicao; nome: string; grupo: 'Da pessoa' | 'Da igreja' | 'Do tempo' }[] = [
  { tipo: 'cargo', nome: 'Cargo na diretoria do COMEP', grupo: 'Da pessoa' },
  { tipo: 'titulo', nome: 'Título ministerial', grupo: 'Da pessoa' },
  { tipo: 'tempo', nome: 'Tempo de COMEP (anos)', grupo: 'Da pessoa' },
  { tipo: 'pastor_presidente', nome: 'Pastor presidente de igreja', grupo: 'Da pessoa' },
  { tipo: 'jubilado', nome: 'Jubilado', grupo: 'Da pessoa' },
  { tipo: 'comissao', nome: 'Membro de uma comissão', grupo: 'Da pessoa' },
  { tipo: 'admissao', nome: 'Forma de admissão', grupo: 'Da pessoa' },
  { tipo: 'igreja', nome: 'Igreja (uma ou várias)', grupo: 'Da igreja' },
  { tipo: 'denominacao', nome: 'Denominação', grupo: 'Da igreja' },
  { tipo: 'tradicao', nome: 'Tradição (pentecostal, batista, reformada…)', grupo: 'Da igreja' },
  { tipo: 'periodo', nome: 'Só entre duas datas (ex.: jubileu do COMEP)', grupo: 'Do tempo' },
  { tipo: 'mandato', nome: 'Só enquanto durar o mandato da diretoria', grupo: 'Do tempo' },
]

const NOME_DA_CONDICAO = Object.fromEntries(CONDICOES.map((c) => [c.tipo, c.nome])) as Record<TipoCondicao, string>

const FORMAS_ADMISSAO = [
  { valor: 'cadastro_inicial', nome: 'Cadastro inicial (fundadores e quem já era associado)' },
  { valor: 'assembleia', nome: 'Admitido pela assembleia' },
]

type Opcoes = {
  titulos: Titulo[]
  comissoes: Comissao[]
  igrejas: Igreja[]
  denominacoes: Denominacao[]
}

/** As opções de cada condição de lista (o valor e o nome). */
function opcoesDa(tipo: TipoCondicao, o: Opcoes | null): { valor: string; nome: string }[] {
  switch (tipo) {
    case 'cargo':
      return CARGOS.map((c) => ({ valor: c.cargo, nome: c.nome }))
    case 'admissao':
      return FORMAS_ADMISSAO
    case 'tradicao':
      return (Object.entries(NOME_DA_TRADICAO) as [Tradicao, string][]).map(([valor, nome]) => ({ valor, nome }))
    case 'titulo':
      return (o?.titulos ?? []).map((t) => ({ valor: t.id, nome: t.nome }))
    case 'comissao':
      return (o?.comissoes ?? []).map((c) => ({ valor: c.id, nome: c.nome }))
    case 'igreja':
      return (o?.igrejas ?? []).filter((i) => i.cadastro === 'completo').map((i) => ({ valor: i.id, nome: i.sigla ? `${i.nome} (${i.sigla})` : i.nome }))
    case 'denominacao':
      return (o?.denominacoes ?? []).map((d) => ({ valor: d.id, nome: d.nome }))
    default:
      return []
  }
}

const COM_LISTA: readonly TipoCondicao[] = ['cargo', 'titulo', 'comissao', 'admissao', 'igreja', 'denominacao', 'tradicao']

/** Uma frase curta com a regra, para o cartão da galeria. */
function resumoDaRegra(m: ModeloGrupo, o: Opcoes | null): string {
  if (m.tipo === 'padrao') return 'Todos os outros ministros associados'
  if (m.tipo === 'readequacao') return 'Os ministros das igrejas sem registro (em readequação)'
  const partes = m.regra.condicoes.map((c) => {
    if (c.tipo === 'tempo') return `${c.anos} anos ou mais de COMEP`
    if (c.tipo === 'pastor_presidente') return 'pastores presidentes'
    if (c.tipo === 'jubilado') return 'jubilados'
    if (c.tipo === 'periodo') return `de ${formatarData(c.de ?? '')} a ${formatarData(c.ate ?? '')}`
    if (c.tipo === 'mandato') return `até ${formatarData(c.ate ?? '')} (o mandato)`
    const nomes = (c.valores ?? []).map((v) => opcoesDa(c.tipo, o).find((x) => x.valor === v)?.nome ?? '…')
    if (c.tipo === 'comissao' && nomes.length === 0) return 'membros de comissão'
    return nomes.join(', ')
  })
  const exclusivo = m.tipo === 'exclusivo' ? [`ministros da ${m.igreja_nome ?? 'igreja'}`] : []
  const tudo = [...exclusivo, ...partes]
  if (tudo.length === 0) return 'Ninguém ainda: defina quem recebe'
  return tudo.join(m.regra.modo === 'qualquer' ? ' ou ' : ' e ')
}

function ordemDe(m: ModeloGrupo, lista: ModeloGrupo[]): string {
  if (m.tipo === 'padrao') return 'Por último'
  if (m.tipo === 'readequacao') return 'Fixo'
  const grupos = lista.filter((x) => x.tipo === 'grupo' || x.tipo === 'exclusivo')
  return `${grupos.findIndex((x) => x.id === m.id) + 1}º na ordem`
}

function useOpcoes() {
  const [opcoes, setOpcoes] = useState<Opcoes | null>(null)
  useEffect(() => {
    let ativo = true
    void Promise.all([listarTitulos(), listarComissoes(), listarIgrejas(), listarDenominacoes()]).then(([t, c, i, d]) => {
      if (!ativo) return
      setOpcoes({
        titulos: t.erro === null ? t.dados : [],
        comissoes: c.erro === null ? c.dados.comissoes.filter((x) => !x.encerrada_em) : [],
        igrejas: i.erro === null ? i.dados : [],
        denominacoes: d.erro === null ? d.dados : [],
      })
    })
    return () => {
      ativo = false
    }
  }, [])
  return opcoes
}

// ---------------------------------------------------------------------
// A prévia pequena (cartão da galeria e "Quem recebe")
// ---------------------------------------------------------------------

export function MiniCartao({ desenho, nome, igreja, className }: { desenho: ModeloCredencial; nome?: string; igreja?: string | null; className?: string }) {
  const dados = useMemo(
    () => ({ ...DADOS_EXEMPLO, nome: nome ?? 'Marcos Antônio Lima', igreja: igreja ?? 'Igreja Fictícia', igreja_sigla: null, foto_caminho: null }),
    [nome, igreja],
  )
  const valores = useMemo(() => valoresDaCredencial(dados, 'Texto do verso da credencial.'), [dados])
  return (
    <div className={`mini-cartao${className ? ` ${className}` : ''}`} aria-hidden="true">
      <FaceCredencial lado="frente" modelo={desenho} valores={valores} nome={dados.nome} foto={null} urlQr={urlValidacao(DADOS_EXEMPLO.codigo)} />
    </div>
  )
}

// ---------------------------------------------------------------------
// A galeria
// ---------------------------------------------------------------------

export function GaleriaModelos() {
  const [carga, recarregar] = useCarregar(painelModelos)
  const opcoes = useOpcoes()
  const [retorno, setRetorno] = useState<Retorno>({})
  const [novo, setNovo] = useState(false)
  const sub =
    carga.situacao === 'ok'
      ? `${carga.dados.modelos.length} modelos · ${carga.dados.associados} associados · ${carga.dados.fim_mandato ? `válidas até ${formatarData(carga.dados.fim_mandato)}` : 'válidas enquanto ativo'}`
      : 'Um modelo de credencial para cada grupo'
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Credenciais"
        titulo="Modelos"
        sub={sub}
        acoes={
          <>
            <Link to="/credenciais/modelos/ordem" className="botao botao-secundario botao-com-icone">
              <Icone nome="ordem" tamanho={18} />
              Mudar a ordem
            </Link>
            <button type="button" className="botao botao-com-icone" onClick={() => setNovo(true)}>
              <Icone nome="mais" tamanho={18} />
              Novo modelo
            </button>
          </>
        }
      />
      <p className="detalhe">
        Cada grupo pode ter o seu modelo. Se a pessoa se encaixa em mais de um, vale o que vem <strong>primeiro na ordem</strong>.
        O ministro em readequação recebe sempre o modelo dele.
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(painel) => (
          <>
            <ul className="galeria-modelos" aria-label="Modelos da credencial">
              {painel.modelos.map((m) => (
                <li key={m.id}>
                  <CartaoDoModelo m={m} painel={painel} opcoes={opcoes} aoMudar={(r) => {
                    setRetorno(r)
                    if (r.sucesso) recarregar()
                  }} />
                </li>
              ))}
            </ul>
            {novo || painel.modelos.length <= 2 ? (
              <NovoModelo opcoes={opcoes} aoFechar={() => setNovo(false)} aoErro={(erro) => setRetorno({ erro })} />
            ) : (
              <section className="painel prontos-resumo" aria-labelledby="titulo-prontos-resumo">
                <h2 id="titulo-prontos-resumo">Começar de um modelo pronto</h2>
                <p className="detalhe">Clássico vermelho, grafite e dourado, azul institucional, vinho com selo, ou do zero.</p>
                <button type="button" className="botao botao-secundario" onClick={() => setNovo(true)}>
                  Escolher um modelo pronto
                </button>
              </section>
            )}
          </>
        )}
      </MostrarCarga>
    </div>
  )
}

function CartaoDoModelo({ m, painel, opcoes, aoMudar }: { m: ModeloGrupo; painel: PainelModelos; opcoes: Opcoes | null; aoMudar: (r: Retorno) => void }) {
  const navegar = useNavigate()
  const desenho = useMemo(() => desenhoDoModelo(m.tipo, m.desenho), [m.tipo, m.desenho])
  const [duplicando, setDuplicando] = useState(false)
  const [nomeCopia, setNomeCopia] = useState(`Cópia de ${m.nome}`.slice(0, 60))
  const [enviando, umaVez] = useUmaVez()
  const situacao = m.tipo === 'exclusivo' && !m.pago_em ? 'Falta o pagamento' : m.em_uso ? 'Em uso' : 'Rascunho'
  return (
    <article className="cartao-modelo" aria-label={m.nome}>
      <div className="cartao-modelo-topo">
        <span className="cartao-modelo-ordem">{ordemDe(m, painel.modelos)}</span>
        <Chip area={situacao === 'Em uso' ? 'financas' : 'eventos'}>{situacao}</Chip>
      </div>
      <MiniCartao desenho={desenho} />
      <h2>{m.nome}</h2>
      <p className="detalhe">{m.descricao || resumoDaRegra(m, opcoes)}</p>
      {m.tipo === 'exclusivo' && (
        <p className="detalhe">
          Exclusivo · {m.valor !== null ? reais(m.valor) : '—'} · {m.pago_em ? `pago em ${formatarData(m.pago_em)}` : 'falta o pagamento'}
        </p>
      )}
      <div className="cartao-modelo-rodape">
        <strong>
          {m.pessoas} {m.pessoas === 1 ? 'pessoa' : 'pessoas'}
        </strong>
        <span className="acoes-linha">
          <Link to={`/credenciais/modelos/${m.id}/quem-recebe`} className="botao-texto">
            Quem recebe
          </Link>
          {m.tipo !== 'readequacao' && (
            <button type="button" className="botao-texto" onClick={() => setDuplicando((v) => !v)} aria-expanded={duplicando}>
              Duplicar
            </button>
          )}
          <Link to={`/credenciais/modelos/${m.id}/editar`} className="botao-texto" aria-label={`Editar o desenho do modelo ${m.nome}`}>
            Editar
          </Link>
        </span>
      </div>
      {duplicando && (
        <form
          className="form-linha"
          aria-label={`Duplicar o modelo ${m.nome}`}
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              const r = await duplicarModelo(m.id, nomeCopia)
              if (r.erro !== null) aoMudar({ erro: r.erro })
              else navegar(`/credenciais/modelos/${r.dados}/quem-recebe`)
            })
          }}
        >
          <label>
            Nome da cópia *
            <input required minLength={2} maxLength={60} value={nomeCopia} onChange={(e) => setNomeCopia(e.target.value)} />
          </label>
          <button type="submit" className="botao" disabled={enviando}>
            Duplicar
          </button>
        </form>
      )}
    </article>
  )
}

/** Novo modelo: escolhe o desenho pronto (ou em branco), o nome e para quem é; cria como rascunho e abre o editor. */
function NovoModelo({ opcoes, aoFechar, aoErro }: { opcoes: Opcoes | null; aoFechar: () => void; aoErro: (erro: string) => void }) {
  const navegar = useNavigate()
  const [pronto, setPronto] = useState(PRONTOS[0].chave)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'grupo' | 'exclusivo'>('grupo')
  const [igreja, setIgreja] = useState('')
  const [valor, setValor] = useState('300,00')
  const [enviando, umaVez] = useUmaVez()
  const igrejas = (opcoes?.igrejas ?? []).filter((i) => i.cadastro === 'completo')
  return (
    <section className="painel" aria-labelledby="titulo-novo-modelo">
      <div className="titulo-com-acao">
        <h2 id="titulo-novo-modelo">Começar de um modelo pronto</h2>
        <span className="detalhe">ou do zero, numa credencial em branco</span>
      </div>
      <div className="prontos" role="radiogroup" aria-label="Modelo pronto">
        {PRONTOS.map((p) => (
          <label key={p.chave} className={pronto === p.chave ? 'pronto escolhido' : 'pronto'}>
            <input type="radio" name="pronto" className="somente-leitor" checked={pronto === p.chave} onChange={() => setPronto(p.chave)} />
            <MiniCartao desenho={p.modelo} />
            <span>{p.nome}</span>
          </label>
        ))}
      </div>
      <form
        className="form-novo-modelo"
        aria-label="Novo modelo"
        onSubmit={(e) => {
          e.preventDefault()
          const v = lerValor(valor)
          if (tipo === 'exclusivo' && (v === null || v <= 0)) return aoErro('Informe o valor do modelo exclusivo (ex.: 300,00).')
          const escolhido = PRONTOS.find((p) => p.chave === pronto) ?? PRONTOS[0]
          void umaVez(async () => {
            const r = await salvarModeloGrupo(null, {
              nome,
              tipo,
              ...(tipo === 'exclusivo' ? { igreja_id: igreja, valor: v } : {}),
            })
            if (r.erro !== null) return aoErro(r.erro)
            const versao = await salvarVersaoDoModelo(r.dados, escolhido.modelo, `Começou do modelo pronto "${escolhido.nome}"`, false)
            if (versao.erro !== null) return aoErro(versao.erro)
            navegar(`/credenciais/modelos/${r.dados}/editar`)
          })
        }}
      >
        <label>
          Nome do modelo *
          <input required minLength={2} maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Diretoria" />
        </label>
        <fieldset className="escolha-segmentada">
          <legend>Para quem</legend>
          <label>
            <input type="radio" name="tipo-modelo" checked={tipo === 'grupo'} onChange={() => setTipo('grupo')} />
            Um grupo (cargo, título, tradição…)
          </label>
          <label>
            <input type="radio" name="tipo-modelo" checked={tipo === 'exclusivo'} onChange={() => setTipo('exclusivo')} />
            Exclusivo de uma igreja (pago à parte)
          </label>
        </fieldset>
        {tipo === 'exclusivo' && (
          <>
            <label>
              Igreja *
              <select required value={igreja} onChange={(e) => setIgreja(e.target.value)}>
                <option value="">Escolha…</option>
                {igrejas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo-curto">
              Valor (R$) *
              <input required inputMode="decimal" pattern={PADRAO_VALOR} title={DICA_VALOR} value={valor} onChange={(e) => setValor(e.target.value)} />
            </label>
          </>
        )}
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Criar e abrir o editor
          </button>
          <button type="button" className="botao-texto" onClick={aoFechar}>
            Fechar
          </button>
        </div>
        <p className="detalhe">O modelo nasce como rascunho: ninguém recebe até você salvar o desenho e usar.</p>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------------
// A ordem dos modelos (arrastar, ou as setas)
// ---------------------------------------------------------------------

export function PaginaOrdem() {
  const [carga, recarregar] = useCarregar(painelModelos)
  const [retorno, setRetorno] = useState<Retorno>({})
  return (
    <div className="tela-nova">
      <p>
        <Link to="/credenciais/modelos">← Modelos</Link>
      </p>
      <CabecalhoFuncao modulo="Credenciais" titulo="A ordem dos modelos" sub="Quem se encaixa em mais de um recebe o de cima" />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(painel) => (
          <div className="coluna-estreita">
            <OrdemDosModelos painel={painel} atual={null} aoMudar={(r) => {
              setRetorno(r)
              recarregar()
            }} />
          </div>
        )}
      </MostrarCarga>
    </div>
  )
}

function OrdemDosModelos({ painel, atual, aoMudar }: { painel: PainelModelos; atual: string | null; aoMudar: (r: Retorno) => void }) {
  const grupos = painel.modelos.filter((m) => m.tipo === 'grupo' || m.tipo === 'exclusivo')
  const fixos = painel.modelos.filter((m) => m.tipo === 'padrao' || m.tipo === 'readequacao')
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()

  function mover(ids: string[]) {
    void umaVez(async () => {
      const r = await ordenarModelos(ids)
      aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: 'Ordem salva.' })
    })
  }
  function trocar(i: number, j: number) {
    if (j < 0 || j >= grupos.length) return
    const ids = grupos.map((m) => m.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    mover(ids)
  }
  function soltar(e: DragEvent, alvo: string) {
    e.preventDefault()
    if (!arrastando || arrastando === alvo) return
    const ids = grupos.map((m) => m.id).filter((id) => id !== arrastando)
    ids.splice(ids.indexOf(alvo), 0, arrastando)
    setArrastando(null)
    mover(ids)
  }

  return (
    <section className="painel ordem-modelos" aria-labelledby="titulo-ordem-modelos">
      <h2 id="titulo-ordem-modelos">A ordem dos modelos</h2>
      <p className="detalhe">Quem se encaixa em mais de um recebe o de cima. Arraste ou use as setas para mudar.</p>
      <ol aria-label="Ordem dos modelos">
        {grupos.map((m, i) => (
          <li
            key={m.id}
            aria-label={m.nome}
            className={m.id === atual ? 'atual' : undefined}
            draggable={!enviando}
            onDragStart={() => setArrastando(m.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => soltar(e, m.id)}
          >
            <span className="ordem-alca" aria-hidden="true">
              ⠿
            </span>
            <MiniCartao desenho={desenhoDoModelo(m.tipo, m.desenho)} className="mini-cartao-pequeno" />
            <Link to={`/credenciais/modelos/${m.id}/quem-recebe`} className="ordem-nome">
              <strong>
                {i + 1}º · {m.nome}
              </strong>
              <span>
                {m.pessoas} {m.pessoas === 1 ? 'pessoa' : 'pessoas'} hoje{m.em_uso ? '' : ' · rascunho'}
              </span>
            </Link>
            <span className="ordem-setas">
              <button type="button" className="botao-icone" aria-label={`Subir ${m.nome}`} disabled={i === 0 || enviando} onClick={() => trocar(i, i - 1)}>
                <Icone nome="cima" tamanho={16} />
              </button>
              <button
                type="button"
                className="botao-icone"
                aria-label={`Descer ${m.nome}`}
                disabled={i === grupos.length - 1 || enviando}
                onClick={() => trocar(i, i + 1)}
              >
                <Icone nome="baixo" tamanho={16} />
              </button>
            </span>
          </li>
        ))}
        {fixos.map((m) => (
          <li key={m.id} aria-label={m.nome} className={m.id === atual ? 'atual fixo' : 'fixo'}>
            <span className="ordem-alca" aria-hidden="true" />
            <MiniCartao desenho={desenhoDoModelo(m.tipo, m.desenho)} className="mini-cartao-pequeno" />
            <Link to={`/credenciais/modelos/${m.id}/quem-recebe`} className="ordem-nome">
              <strong>
                {m.tipo === 'padrao' ? `${grupos.length + 1}º · ` : ''}
                {m.nome}
              </strong>
              <span>
                {m.pessoas} {m.pessoas === 1 ? 'pessoa' : 'pessoas'} hoje · {m.tipo === 'padrao' ? 'quem sobra' : 'fixo, não sai da ordem'}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {grupos.length === 0 && <p className="vazio">Ainda não há modelos de grupo: todos recebem o padrão.</p>}
    </section>
  )
}

// ---------------------------------------------------------------------
// Quem recebe
// ---------------------------------------------------------------------

export function QuemRecebe() {
  const { id = '' } = useParams()
  const [carga, recarregar] = useCarregar(painelModelos)
  const opcoes = useOpcoes()
  const [retorno, setRetorno] = useState<Retorno>({})
  return (
    <div className="tela-nova">
      <p>
        <Link to="/credenciais/modelos">← Modelos</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(painel) => {
          const m = painel.modelos.find((x) => x.id === id)
          if (!m) {
            return (
              <Aviso titulo="Modelo não encontrado">
                <p>Ele pode ter sido arquivado. Volte aos modelos.</p>
              </Aviso>
            )
          }
          const aoMudar = (r: Retorno) => {
            setRetorno(r)
            if (r.sucesso) recarregar()
          }
          return (
            <>
              <CabecalhoFuncao modulo="Credenciais › Modelos" titulo={`Quem recebe "${m.nome}"`} sub={resumoDaRegra(m, opcoes)} />
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
              <div className="quem-recebe">
                <OrdemDosModelos painel={painel} atual={m.id} aoMudar={aoMudar} />
                <EditarQuemRecebe key={`${m.id}:${JSON.stringify(m.regra)}:${m.pago_em ?? ''}:${m.em_uso}`} m={m} painel={painel} opcoes={opcoes} aoMudar={aoMudar} />
              </div>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function EditarQuemRecebe({ m, painel, opcoes, aoMudar }: { m: ModeloGrupo; painel: PainelModelos; opcoes: Opcoes | null; aoMudar: (r: Retorno) => void }) {
  const navegar = useNavigate()
  const [nome, setNome] = useState(m.nome)
  const [descricao, setDescricao] = useState(m.descricao ?? '')
  const [regra, setRegra] = useState<Regra>(m.regra)
  const [igreja, setIgreja] = useState(m.igreja_id ?? '')
  const [valor, setValor] = useState(m.valor !== null ? valorParaCampo(m.valor) : '')
  const [pedidoPor, setPedidoPor] = useState(m.pedido_por ?? '')
  const [enviando, umaVez] = useUmaVez()
  const comRegra = m.tipo === 'grupo' || m.tipo === 'exclusivo'
  const mudouRegra = JSON.stringify(regra) !== JSON.stringify(m.regra)
  const usados = new Set(regra.condicoes.map((c) => c.tipo))

  const mudarCondicao = (i: number, c: Condicao) => setRegra((r) => ({ ...r, condicoes: r.condicoes.map((x, j) => (j === i ? c : x)) }))
  const tirarCondicao = (i: number) => setRegra((r) => ({ ...r, condicoes: r.condicoes.filter((_, j) => j !== i) }))

  function salvar() {
    const v = lerValor(valor)
    void umaVez(async () => {
      const r = await salvarModeloGrupo(m.id, {
        nome,
        descricao: descricao.trim() || null,
        ...(comRegra ? { regra } : {}),
        ...(m.tipo === 'exclusivo' ? { igreja_id: igreja, valor: v, pedido_por: pedidoPor || null } : {}),
      })
      aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: 'Quem recebe salvo. A credencial de cada um muda na hora.' })
    })
  }

  return (
    <>
      <section className="painel" aria-labelledby="titulo-condicoes">
        <div className="titulo-com-acao">
          <h2 id="titulo-condicoes">Quem recebe o modelo "{m.nome}"</h2>
          <Chip area={m.em_uso ? 'financas' : 'eventos'}>{m.em_uso ? 'Em uso' : 'Rascunho'}</Chip>
        </div>
        <div className="form-linha">
          <label>
            Nome do modelo *
            <input required minLength={2} maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Descrição (opcional)
            <input maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Conselho Diretor e Conselho Fiscal" />
          </label>
        </div>

        {m.tipo === 'padrao' && (
          <p>
            Recebem este modelo <strong>todos os ministros associados que não se encaixam em nenhum modelo de cima</strong>. Ele fica
            sempre por último.
          </p>
        )}
        {m.tipo === 'readequacao' && (
          <>
            <p>
              Recebem este modelo os <strong>ministros das igrejas sem registro</strong> (a categoria "ministro em readequação"):
              participam, mas não votam, não são votados e não têm cargo. Ele vale antes de todos os outros e não pode ser
              trocado por outro.
            </p>
            <p className="detalhe">
              Prazo da readequação: {painel.readequacao_ate ? formatarData(painel.readequacao_ate) : '—'} (muda em Igrejas › Central de
              regularização).
            </p>
          </>
        )}

        {comRegra && (
          <>
            <fieldset className="escolha-segmentada">
              <legend>Recebe quem atende a</legend>
              <label>
                <input type="radio" name="modo" checked={regra.modo === 'todas'} onChange={() => setRegra({ ...regra, modo: 'todas' })} />
                todas as condições
              </label>
              <label>
                <input type="radio" name="modo" checked={regra.modo === 'qualquer'} onChange={() => setRegra({ ...regra, modo: 'qualquer' })} />
                qualquer uma
              </label>
            </fieldset>
            <ul className="condicoes" aria-label="Condições">
              {regra.condicoes.map((c, i) => (
                <li key={c.tipo}>
                  <EditarCondicao c={c} opcoes={opcoes} fimMandato={painel.fim_mandato} aoMudar={(nova) => mudarCondicao(i, nova)} aoTirar={() => tirarCondicao(i)} />
                </li>
              ))}
            </ul>
            {regra.condicoes.length === 0 && m.tipo === 'grupo' && <p className="vazio">Sem condição, ninguém recebe este modelo.</p>}
            {regra.condicoes.length < CONDICOES.length && (
              <label className="campo-medio">
                + Mais uma condição
                <select
                  value=""
                  onChange={(e) => {
                    const tipo = e.target.value as TipoCondicao
                    if (!tipo) return
                    const nova: Condicao = COM_LISTA.includes(tipo)
                      ? { tipo, valores: [] }
                      : tipo === 'tempo'
                        ? { tipo, anos: 10 }
                        : tipo === 'periodo'
                          ? { tipo, de: hojeIso(), ate: hojeIso() }
                          : tipo === 'mandato'
                            ? { tipo, ...(painel.fim_mandato ? { ate: painel.fim_mandato } : {}) }
                            : { tipo }
                    setRegra((r) => ({ ...r, condicoes: [...r.condicoes, nova] }))
                  }}
                >
                  <option value="">Escolha a condição…</option>
                  {(['Da pessoa', 'Da igreja', 'Do tempo'] as const).map((g) => (
                    <optgroup key={g} label={g}>
                      {CONDICOES.filter((c) => c.grupo === g && !usados.has(c.tipo)).map((c) => (
                        <option key={c.tipo} value={c.tipo}>
                          {c.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {m.tipo === 'exclusivo' && (
          <Exclusivo
            m={m}
            opcoes={opcoes}
            igreja={igreja}
            setIgreja={setIgreja}
            valor={valor}
            setValor={setValor}
            pedidoPor={pedidoPor}
            setPedidoPor={setPedidoPor}
            aoMudar={aoMudar}
          />
        )}

        <div className="acoes">
          <button type="button" className="botao" disabled={enviando} onClick={salvar}>
            Salvar quem recebe
          </button>
          <Link to={`/credenciais/modelos/${m.id}/editar`} className="botao botao-secundario">
            Editar o desenho
          </Link>
          {comRegra && (
            <button
              type="button"
              className="botao-texto"
              disabled={enviando}
              onClick={() =>
                void umaVez(async () => {
                  const r = await porModeloEmUso(m.id, !m.em_uso)
                  aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: m.em_uso ? 'Modelo voltou a rascunho.' : 'Modelo em uso.' })
                })
              }
            >
              {m.em_uso ? 'Voltar a rascunho' : 'Pôr em uso'}
            </button>
          )}
          {comRegra && (
            <BotaoArquivar
              rotulo={`Arquivar o modelo ${m.nome}`}
              aoConfirmar={() =>
                void umaVez(async () => {
                  const r = await arquivarModeloGrupo(m.id)
                  if (r.erro !== null) aoMudar({ erro: r.erro })
                  else navegar('/credenciais/modelos')
                })
              }
            />
          )}
        </div>
        {mudouRegra && <p className="detalhe">Há mudanças nas condições ainda não salvas: ao lado, como vai ficar.</p>}
      </section>
      <QuemRecebeHoje m={m} regra={comRegra && mudouRegra ? regra : null} />
    </>
  )
}

function EditarCondicao({
  c,
  opcoes,
  fimMandato,
  aoMudar,
  aoTirar,
}: {
  c: Condicao
  opcoes: Opcoes | null
  fimMandato: string | null
  aoMudar: (c: Condicao) => void
  aoTirar: () => void
}) {
  const lista = opcoesDa(c.tipo, opcoes)
  const valores = c.valores ?? []
  return (
    <div className="condicao" role="group" aria-label={NOME_DA_CONDICAO[c.tipo]}>
      <div className="titulo-com-acao">
        <strong>{NOME_DA_CONDICAO[c.tipo]}</strong>
        <button type="button" className="botao-icone" aria-label={`Tirar a condição ${NOME_DA_CONDICAO[c.tipo]}`} onClick={aoTirar}>
          <Icone nome="x" tamanho={16} />
        </button>
      </div>
      {COM_LISTA.includes(c.tipo) && (
        <>
          <span className="detalhe">{c.tipo === 'comissao' && valores.length === 0 ? 'de qualquer comissão' : 'é um destes'}</span>
          <div className="fichas">
            {valores.map((v) => (
              <span key={v} className="ficha">
                {lista.find((x) => x.valor === v)?.nome ?? '…'}
                <button
                  type="button"
                  aria-label={`Tirar ${lista.find((x) => x.valor === v)?.nome ?? 'valor'}`}
                  onClick={() => aoMudar({ ...c, valores: valores.filter((x) => x !== v) })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <label className="campo-medio">
            <span className="somente-leitor">Acrescentar em {NOME_DA_CONDICAO[c.tipo]}</span>
            <select value="" aria-label={`Acrescentar em ${NOME_DA_CONDICAO[c.tipo]}`} onChange={(e) => e.target.value && aoMudar({ ...c, valores: [...valores, e.target.value] })}>
              <option value="">+ acrescentar…</option>
              {lista
                .filter((x) => !valores.includes(x.valor))
                .map((x) => (
                  <option key={x.valor} value={x.valor}>
                    {x.nome}
                  </option>
                ))}
            </select>
          </label>
          {c.tipo === 'tradicao' && (
            <p className="detalhe">Entram as igrejas das denominações marcadas com a tradição (a tradição se marca em Igrejas › Denominações).</p>
          )}
          {c.tipo === 'cargo' && <p className="detalhe">Vale enquanto durar o mandato: saiu do cargo, a próxima credencial sai no modelo seguinte.</p>}
        </>
      )}
      {c.tipo === 'tempo' && (
        <label className="campo-curto">
          Pelo menos (anos de COMEP)
          <input type="number" min={1} max={80} value={c.anos ?? 10} onChange={(e) => aoMudar({ ...c, anos: Number(e.target.value) })} />
        </label>
      )}
      {(c.tipo === 'pastor_presidente' || c.tipo === 'jubilado') && (
        <span className="detalhe">{c.tipo === 'jubilado' ? 'Os jubilados.' : 'Os pastores presidentes das igrejas (marcados na ficha).'}</span>
      )}
      {c.tipo === 'periodo' && (
        <div className="form-linha">
          <label className="campo-curto">
            De
            <input type="date" value={c.de ?? ''} onChange={(e) => aoMudar({ ...c, de: e.target.value })} />
          </label>
          <label className="campo-curto">
            Até
            <input type="date" value={c.ate ?? ''} onChange={(e) => aoMudar({ ...c, ate: e.target.value })} />
          </label>
        </div>
      )}
      {c.tipo === 'mandato' && (
        <span className="detalhe">
          {c.ate
            ? `Até ${formatarData(c.ate)}, o fim do mandato da diretoria em curso. A posse da próxima não estica o modelo.`
            : fimMandato
              ? `Até ${formatarData(fimMandato)}, o fim do mandato da diretoria em curso.`
              : 'Informe antes o fim do mandato em Credenciais › Validade e verso.'}
        </span>
      )}
    </div>
  )
}

/** O modelo exclusivo pago pela igreja: a igreja, quem pediu, o valor e o pagamento (com a entrada do caixa). */
function Exclusivo({
  m,
  opcoes,
  igreja,
  setIgreja,
  valor,
  setValor,
  pedidoPor,
  setPedidoPor,
  aoMudar,
}: {
  m: ModeloGrupo
  opcoes: Opcoes | null
  igreja: string
  setIgreja: (v: string) => void
  valor: string
  setValor: (v: string) => void
  pedidoPor: string
  setPedidoPor: (v: string) => void
  aoMudar: (r: Retorno) => void
}) {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const registraPagamento = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const [ministros] = useCarregar(async () => {
    const r = await listarAssociados()
    return r.erro !== null ? r : ok(r.dados.filter((a: Associado) => a.situacao === 'ativo'))
  })
  const [entradas] = useCarregar(async () => (registraPagamento ? entradasParaLigar() : ok<EntradaDoCaixa[]>([])))
  const [pagoEm, setPagoEm] = useState(m.pago_em ?? hojeIso())
  const [lancamento, setLancamento] = useState(m.lancamento_id ?? '')
  const [enviando, umaVez] = useUmaVez()
  const igrejas = (opcoes?.igrejas ?? []).filter((i) => i.cadastro === 'completo')
  const daIgreja = ministros.situacao === 'ok' ? ministros.dados.filter((a) => a.igreja_id === igreja) : []
  const entrada = entradas.situacao === 'ok' ? entradas.dados.find((e) => e.id === m.lancamento_id) : undefined

  return (
    <div className="bloco-exclusivo" role="group" aria-label="Modelo exclusivo pago pela igreja">
      <h3>Modelo exclusivo pago pela igreja</h3>
      <div className="form-linha">
        <label>
          Igreja *
          <select required value={igreja} disabled={Boolean(m.pago_em)} onChange={(e) => setIgreja(e.target.value)}>
            <option value="">Escolha…</option>
            {igrejas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="campo-curto">
          Valor (R$) *
          <input required inputMode="decimal" pattern={PADRAO_VALOR} title={DICA_VALOR} value={valor} disabled={Boolean(m.pago_em)} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label>
          Pedido por
          <select value={pedidoPor} onChange={(e) => setPedidoPor(e.target.value)}>
            <option value="">—</option>
            {daIgreja.map((a) => (
              <option key={a.pessoa_id} value={a.pessoa_id}>
                {a.nome}
                {a.pastor_presidente ? ', pastor presidente' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <dl className="dados-curtos">
        <dt>Pagamento</dt>
        <dd>{m.pago_em ? `pago em ${formatarData(m.pago_em)}` : 'falta o pagamento (o modelo só vale depois de pago)'}</dd>
        <dt>No caixa</dt>
        <dd>{m.lancamento_id ? (entrada ? `entrada "${entrada.descricao}" (${reais(entrada.valor)})` : 'entrada ligada') : 'sem entrada ligada'}</dd>
        <dt>Cores e logo</dt>
        <dd>os da igreja, no desenho do modelo (Editar o desenho)</dd>
      </dl>
      {registraPagamento ? (
        <form
          className="form-linha"
          aria-label="Pagamento do modelo exclusivo"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              const r = await registrarPagamentoExclusivo(m.id, pagoEm, lancamento || null)
              aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: 'Pagamento registrado: o modelo vale para os ministros da igreja.' })
            })
          }}
        >
          <label className="campo-curto">
            Pago em
            <input type="date" required max={hojeIso()} value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
          </label>
          <label>
            Entrada do caixa (opcional)
            <select value={lancamento} onChange={(e) => setLancamento(e.target.value)}>
              <option value="">Sem ligar ao caixa</option>
              {(entradas.situacao === 'ok' ? entradas.dados : []).map((x) => (
                <option key={x.id} value={x.id}>
                  {formatarData(x.data)} · {x.descricao} · {reais(x.valor)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="botao botao-secundario" disabled={enviando}>
            {m.pago_em ? 'Corrigir o pagamento' : 'Registrar o pagamento'}
          </button>
          {m.pago_em && (
            <button
              type="button"
              className="botao-texto"
              disabled={enviando}
              onClick={() =>
                void umaVez(async () => {
                  const r = await registrarPagamentoExclusivo(m.id, null, null)
                  aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: 'Pagamento desfeito: o modelo deixou de valer.' })
                })
              }
            >
              Desfazer o pagamento
            </button>
          )}
        </form>
      ) : (
        <p className="detalhe">O pagamento é registrado pela tesouraria ou pela presidência.</p>
      )}
      <p className="detalhe">
        Vale depois de pago e enquanto a igreja estiver no COMEP. Se ela sair, o modelo é arquivado e os ministros voltam ao
        modelo seguinte da ordem.
      </p>
    </div>
  )
}

/** À direita: quem recebe hoje (ou, com a regra mudada e ainda não salva, como vai ficar). */
function QuemRecebeHoje({ m, regra }: { m: ModeloGrupo; regra: Regra | null }) {
  const [sim, setSim] = useState<{ chave: string; resultado: Simulacao | null; erro: string | null } | null>(null)
  const [todas, setTodas] = useState(false)
  const chave = JSON.stringify(regra)
  useEffect(() => {
    let ativo = true
    const tempo = window.setTimeout(() => {
      void simularQuemRecebe(m.id, regra).then((r) => {
        if (!ativo) return
        setSim({ chave, resultado: r.erro === null ? r.dados : null, erro: r.erro })
      })
    }, regra ? 400 : 0)
    return () => {
      ativo = false
      window.clearTimeout(tempo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id, chave])
  const desenho = useMemo(() => desenhoDoModelo(m.tipo, m.desenho), [m.tipo, m.desenho])
  const pessoas = sim?.resultado?.pessoas ?? []
  const mostradas = todas ? pessoas : pessoas.slice(0, 5)
  return (
    <section className="painel quem-recebe-hoje" aria-labelledby="titulo-quem-recebe-hoje" aria-busy={!sim || sim.chave !== chave}>
      <div className="titulo-com-acao">
        <h2 id="titulo-quem-recebe-hoje">
          {regra ? 'Como vai ficar' : 'Hoje'}, {sim ? pessoas.length : '…'} {pessoas.length === 1 ? 'pessoa' : 'pessoas'}
        </h2>
        <Chip area="financas">atualiza sozinho</Chip>
      </div>
      <MiniCartao desenho={desenho} nome={pessoas[0]?.nome} igreja={pessoas[0]?.igreja} />
      {sim?.erro && <Mensagem erro={sim.erro} />}
      <ul className="lista-pessoas-modelo" aria-label="Quem recebe">
        {mostradas.map((p) => (
          <li key={p.pessoa_id}>
            <span className="avatar-ministro" aria-hidden="true">
              {iniciaisDe(p.nome)}
            </span>
            <span>
              <strong>{p.nome}</strong>
              <span className="detalhe">{[p.titulo, p.igreja].filter(Boolean).join(' · ')}</span>
            </span>
          </li>
        ))}
      </ul>
      {pessoas.length > 5 && (
        <button type="button" className="botao-texto" onClick={() => setTodas((v) => !v)}>
          {todas ? 'Mostrar menos' : `e mais ${pessoas.length - 5}`}
        </button>
      )}
      {sim && pessoas.length === 0 && !sim.erro && <p className="vazio">Ninguém recebe este modelo hoje.</p>}
      {(sim?.resultado?.acima ?? 0) > 0 && (
        <p className="detalhe">
          Mais {sim?.resultado?.acima} se encaixam, mas recebem um modelo de cima na ordem.
        </p>
      )}
      {m.tipo === 'exclusivo' && !m.pago_em && <p className="detalhe">Falta o pagamento: a lista mostra quem vai receber depois de pago.</p>}
      {(m.tipo === 'grupo' || m.tipo === 'exclusivo') && !m.em_uso && <p className="detalhe">Rascunho: a lista mostra quem vai receber quando o modelo estiver em uso.</p>}
      <p className="detalhe">Saiu do grupo? A credencial impressa vale até a validade; a próxima já sai no modelo certo.</p>
    </section>
  )
}
