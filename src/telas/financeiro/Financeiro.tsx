import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { formatarReais } from '../../dados/configuracoes'
import {
  analisarInforme,
  cancelarCobranca,
  cobrancasEmAbertoDe,
  exercicioDe,
  FORMAS_PAGAMENTO,
  gerarCobrancas,
  informesPendentes,
  nomeDaCobranca,
  nomeDoExercicio,
  registrarPagamento,
  resumoDoExercicio,
  situacaoDeTodos,
  type InformePendente,
  type SituacaoContribuicao,
} from '../../dados/financeiro'
import { linkDoArquivo } from '../../dados/pedidos'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { contemTexto, formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { CaixaAba, DespesasAutorizar } from './Caixa'
import { PrestacaoContasAba } from './PrestacaoContas'

type Retorno = { sucesso?: string; erro?: string }
const ABAS = [
  'Pagamentos informados',
  'Situação dos associados',
  'Cobranças do exercício',
  'Caixa',
  'Despesas a autorizar',
  'Prestação de contas',
] as const
type Aba = (typeof ABAS)[number]

/** /financeiro — tesouraria e presidência operam; o Conselho Fiscal só vê (Fase 2: contribuições, caixa e contas). */
export function Financeiro() {
  const { estado } = useSessao()
  const perfisDaConta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const opera = perfisDaConta.includes('tesouraria') || perfisDaConta.includes('presidencia')
  const [aba, setAba] = useState<Aba>(opera ? 'Pagamentos informados' : 'Prestação de contas')
  const [retorno, setRetorno] = useState<Retorno>({})

  // Cada aba recarrega os próprios dados depois de uma ação (sem perder a busca, o filtro ou o exercício escolhido)
  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    return r.erro === null
  }

  if (estado.situacao !== 'logado' || estado.conta?.tipo !== 'ok') return <Carregando />
  const { pessoaId, perfis } = estado.conta.conta
  const usuarioId = estado.sessao.usuarioId
  // O Conselho Fiscal (Art. 14) vê tudo, sem os pagamentos a conferir e sem botões de ação
  const abas = opera ? ABAS : ABAS.filter((a) => a !== 'Pagamentos informados')
  const somenteLeitura = !opera

  return (
    <>
      <h1>Financeiro</h1>
      <p className="detalhe nao-imprimir">
        Exercício de abril a março.
        {somenteLeitura && ' Você vê o financeiro como Conselho Fiscal: só leitura, e o parecer sobre o balanço anual.'}
      </p>
      <div className="abas nao-imprimir" role="tablist" aria-label="Partes do financeiro">
        {abas.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            className={aba === a ? 'aba ativa' : 'aba'}
            onClick={() => {
              setAba(a)
              setRetorno({})
            }}
          >
            {a}
          </button>
        ))}
      </div>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {aba === 'Pagamentos informados' && <PagamentosInformados pessoaId={pessoaId} concluir={concluir} />}
      {aba === 'Situação dos associados' && (
        <SituacaoAssociados pessoaId={pessoaId} concluir={concluir} somenteLeitura={somenteLeitura} />
      )}
      {aba === 'Cobranças do exercício' && <CobrancasExercicio concluir={concluir} somenteLeitura={somenteLeitura} />}
      {aba === 'Caixa' && <CaixaAba pessoaId={pessoaId} concluir={concluir} somenteLeitura={somenteLeitura} />}
      {aba === 'Despesas a autorizar' && (
        <DespesasAutorizar podeAutorizar={perfis.includes('presidencia')} usuarioId={usuarioId} concluir={concluir} />
      )}
      {aba === 'Prestação de contas' && <PrestacaoContasAba perfis={perfis} pessoaId={pessoaId} />}
    </>
  )
}

type Concluir = (r: { erro: string | null }, sucesso: string) => boolean

// ---------------------------------------------------------------------

function PagamentosInformados({ pessoaId, concluir }: { pessoaId: string; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(informesPendentes)
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(informes) =>
        informes.length === 0 ? (
          <p className="vazio">Nenhum pagamento aguardando conferência.</p>
        ) : (
          <ul className="lista" aria-label="Pagamentos informados">
            {informes.map((i) => (
              <Informe key={i.id} informe={i} meu={i.pessoa_id === pessoaId} concluir={concluirERecarregar} />
            ))}
          </ul>
        )
      }
    </MostrarCarga>
  )
}

function Informe({ informe: i, meu, concluir }: { informe: InformePendente; meu: boolean; concluir: Concluir }) {
  // undefined = carregando; null = não abriu
  const [comprovante, setComprovante] = useState<string | null | undefined>(undefined)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = i.pessoa?.nome ?? 'Associado'
  const contribuicao = i.cobranca ? nomeDaCobranca(i.cobranca) : 'Contribuição'

  useEffect(() => {
    let ativo = true
    if (i.comprovante_caminho) void linkDoArquivo(i.comprovante_caminho).then((u) => ativo && setComprovante(u))
    return () => {
      ativo = false
    }
  }, [i.comprovante_caminho])

  function analisar(confirmar: boolean) {
    return umaVez(async () =>
      concluir(
        await analisarInforme(i.id, confirmar, motivo),
        confirmar ? `Pagamento de ${nome} confirmado (${contribuicao}).` : `Pagamento de ${nome} recusado.`,
      ),
    )
  }

  return (
    <li className="lista-item lista-item-estatico" aria-label={`Pagamento de ${nome}`}>
      <strong>
        <Link to={`/ministros/${i.pessoa_id}`}>{nome}</Link> — {contribuicao}: {formatarReais(i.valor)}
      </strong>
      <span>
        Pago em {formatarData(i.data_pagamento)} por {i.forma} · informado em {formatarDataDeInstante(i.criado_em)}
        {i.observacao && ` · ${i.observacao}`}
      </span>
      <span>
        {i.comprovante_caminho ? (
          comprovante ? (
            <a href={comprovante} target="_blank" rel="noreferrer">
              Abrir comprovante
            </a>
          ) : comprovante === null ? (
            'Não foi possível abrir o comprovante agora. Recarregue a página.'
          ) : (
            'Carregando o comprovante…'
          )
        ) : (
          'Sem comprovante (pagamento em dinheiro)'
        )}
      </span>
      {meu ? (
        <p className="detalhe">Este pagamento é seu: outra pessoa da tesouraria ou da presidência confere.</p>
      ) : (
        <>
          <div className="acoes">
            <button type="button" className="botao" disabled={enviando} onClick={() => void analisar(true)}>
              Confirmar pagamento
            </button>
          </div>
          <RecusarInforme motivo={motivo} setMotivo={setMotivo} enviando={enviando} aoRecusar={() => void analisar(false)} />
        </>
      )}
    </li>
  )
}

function RecusarInforme({
  motivo,
  setMotivo,
  enviando,
  aoRecusar,
}: {
  motivo: string
  setMotivo: (m: string) => void
  enviando: boolean
  aoRecusar: () => void
}) {
  return (
    <details className="acao-recolhida">
      <summary>Recusar</summary>
      <form
        className="form-linha form-compacto"
        onSubmit={(e) => {
          e.preventDefault()
          aoRecusar()
        }}
      >
        <label>
          Motivo *
          <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: comprovante ilegível" />
        </label>
        <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
          Recusar
        </button>
      </form>
    </details>
  )
}

// ---------------------------------------------------------------------

function SituacaoAssociados({
  pessoaId,
  concluir,
  somenteLeitura,
}: {
  pessoaId: string
  concluir: Concluir
  somenteLeitura: boolean
}) {
  const [carga, recarregar] = useCarregar(situacaoDeTodos)
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  const [busca, setBusca] = useState('')
  const [soAtraso, setSoAtraso] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(todos) => {
        const emAtraso = todos.filter((s) => !s.em_dia)
        const filtrados = todos.filter(
          (s) => (!soAtraso || !s.em_dia) && (contemTexto(s.nome, busca) || contemTexto(s.igreja, busca)),
        )
        return (
          <>
            <p>
              <strong>{todos.length - emAtraso.length}</strong> em dia · <strong>{emAtraso.length}</strong> em atraso (não
              votam nem são votados — Art. 11) · total vencido {formatarReais(emAtraso.reduce((t, s) => t + Number(s.valor_vencido), 0))}
            </p>
            <div className="form-linha">
              <label>
                Buscar associado
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </label>
              <label className="caixa-marcar">
                <input type="checkbox" checked={soAtraso} onChange={(e) => setSoAtraso(e.target.checked)} />
                Só os inadimplentes
              </label>
            </div>
            <ul className="lista" aria-label="Situação dos associados">
              {filtrados.map((s) => (
                <LinhaSituacao
                  key={s.pessoa_id}
                  situacao={s}
                  aberta={aberta === s.pessoa_id}
                  aoAbrir={() => setAberta(aberta === s.pessoa_id ? null : s.pessoa_id)}
                  concluir={concluirERecarregar}
                  somenteLeitura={somenteLeitura}
                  minha={s.pessoa_id === pessoaId}
                />
              ))}
            </ul>
          </>
        )
      }}
    </MostrarCarga>
  )
}

function LinhaSituacao({
  situacao: s,
  aberta,
  aoAbrir,
  concluir,
  somenteLeitura,
  minha,
}: {
  situacao: SituacaoContribuicao
  aberta: boolean
  aoAbrir: () => void
  concluir: Concluir
  somenteLeitura: boolean
  minha: boolean
}) {
  return (
    <li className="lista-item lista-item-estatico" aria-label={s.nome}>
      <strong>
        <span className="numero">Nº {s.numero_registro}</span> {s.nome}
      </strong>
      <span>
        {s.jubilado && <span className="etiqueta etiqueta-ok">Isento (jubilado)</span>}{' '}
        {s.jubilado && s.em_dia ? null : s.em_dia ? (
          <span className="etiqueta etiqueta-ok">Em dia</span>
        ) : (
          <span className="etiqueta etiqueta-atraso">
            Em atraso: {s.cobrancas_vencidas} vencida(s), {formatarReais(s.valor_vencido)}
          </span>
        )}{' '}
        {s.igreja}
      </span>
      {(!s.jubilado || !s.em_dia) && !somenteLeitura && minha && (
        <span className="detalhe">É você: outra pessoa da tesouraria ou da presidência registra o seu pagamento.</span>
      )}
      {(!s.jubilado || !s.em_dia) && !somenteLeitura && !minha && (
        <button type="button" className="botao-texto alinhar-esquerda" onClick={aoAbrir}>
          {aberta ? 'Fechar' : 'Registrar pagamento recebido'}
        </button>
      )}
      {aberta && <RegistrarPagamento pessoaId={s.pessoa_id} nome={s.nome} concluir={concluir} />}
    </li>
  )
}

function RegistrarPagamento({ pessoaId, nome, concluir }: { pessoaId: string; nome: string; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(() => cobrancasEmAbertoDe(pessoaId))
  const [cobrancaId, setCobrancaId] = useState('')
  const [data, setData] = useState(hojeIso())
  const [forma, setForma] = useState<string>('Dinheiro')
  const [observacao, setObservacao] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(cobrancas) =>
        cobrancas.length === 0 ? (
          <p className="vazio">Nenhuma contribuição em aberto.</p>
        ) : (
          <>
            <form
              className="form-linha form-compacto"
              aria-label={`Registrar pagamento de ${nome}`}
              onSubmit={async (e) => {
                e.preventDefault()
                const c = cobrancas.find((x) => x.id === cobrancaId)
                if (!c) return
                await umaVez(async () =>
                  concluir(
                    await registrarPagamento(c.id, data, Number(c.valor), forma, observacao),
                    `Pagamento de ${nome} registrado (${nomeDaCobranca(c)}).`,
                  ),
                )
              }}
            >
              <label>
                Contribuição
                <select required value={cobrancaId} onChange={(e) => setCobrancaId(e.target.value)}>
                  <option value="">— Escolha —</option>
                  {cobrancas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nomeDaCobranca(c)} — {formatarReais(c.valor)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                Forma
                <select value={forma} onChange={(e) => setForma(e.target.value)}>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observação
                <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </label>
              <button type="submit" className="botao" disabled={enviando}>
                Registrar
              </button>
            </form>
            <details className="acao-recolhida">
              <summary>Cancelar uma contribuição (isenção ou lançada por engano)</summary>
              <form
                className="form-linha form-compacto"
                aria-label={`Cancelar contribuição de ${nome}`}
                onSubmit={async (e) => {
                  e.preventDefault()
                  const c = cobrancas.find((x) => x.id === cobrancaId)
                  if (!c) return concluir({ erro: 'Escolha acima qual contribuição cancelar.' }, '')
                  await umaVez(async () =>
                    concluir(await cancelarCobranca(c.id, motivo), `Contribuição cancelada: ${nomeDaCobranca(c)} de ${nome}.`),
                  )
                }}
              >
                <label>
                  Motivo *
                  <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: isenção aprovada pela diretoria" />
                </label>
                <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                  Cancelar a contribuição escolhida
                </button>
              </form>
            </details>
          </>
        )
      }
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------

function CobrancasExercicio({ concluir, somenteLeitura }: { concluir: Concluir; somenteLeitura: boolean }) {
  const hoje = hojeIso()
  const atual = exercicioDe(hoje)
  const [exercicio, setExercicio] = useState(atual)
  const [enviando, umaVez] = useUmaVez()
  const [carga, recarregar] = useCarregar(() => resumoDoExercicio(exercicio, hoje))

  return (
    <section className="painel" aria-labelledby="titulo-cobrancas-exercicio">
      <h2 id="titulo-cobrancas-exercicio">Cobranças do exercício</h2>
      <div className="form-linha">
        <label>
          Exercício
          <select
            value={exercicio}
            onChange={(e) => {
              setExercicio(Number(e.target.value))
              setTimeout(recarregar)
            }}
          >
            {[atual + 1, atual, atual - 1].map((e) => (
              <option key={e} value={e}>
                {nomeDoExercicio(e)}
              </option>
            ))}
          </select>
        </label>
        {!somenteLeitura && (
          <button
            type="button"
            className="botao"
            disabled={enviando}
            onClick={() =>
              void umaVez(async () => {
                const r = await gerarCobrancas(exercicio)
                const certo = concluir(
                  r,
                  r.erro === null
                    ? r.dados === 0
                      ? `Nenhuma cobrança nova: o exercício ${nomeDoExercicio(exercicio)} já estava gerado para todos.`
                      : `${r.dados} cobrança(s) gerada(s) para o exercício ${nomeDoExercicio(exercicio)}.`
                    : '',
                )
                if (certo) recarregar()
              })
            }
          >
            Gerar cobranças do exercício
          </button>
        )}
      </div>
      <p className="detalhe">
        Gera, para cada associado ativo, as mensalidades (ou a anuidade, para quem escolheu) pelo valor da categoria. Jubilado
        não recebe cobrança. Pode gerar de novo quando entrar associado novo: nada se repete.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(r) => (
          <dl className="definicoes" aria-label="Resumo do exercício">
            <dt>Cobranças</dt>
            <dd>{r.cobrancas}</dd>
            <dt>Previsto</dt>
            <dd>{formatarReais(r.previsto)}</dd>
            <dt>Recebido</dt>
            <dd>{formatarReais(r.recebido)}</dd>
            <dt>Em aberto</dt>
            <dd>{formatarReais(r.emAberto)}</dd>
            <dt>Vencido</dt>
            <dd>{formatarReais(r.vencido)}</dd>
          </dl>
        )}
      </MostrarCarga>
    </section>
  )
}
