import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { formatarReais } from '../../dados/configuracoes'
import {
  analisarInforme,
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
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto, formatarData, hojeIso } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }
const ABAS = ['Pagamentos informados', 'Situação dos associados', 'Cobranças do exercício'] as const

/** /financeiro — tesouraria e presidência (Fase 2.1: contribuições). */
export function Financeiro() {
  const [aba, setAba] = useState<(typeof ABAS)[number]>('Pagamentos informados')
  const [retorno, setRetorno] = useState<Retorno>({})
  const [versao, setVersao] = useState(0)

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) setVersao((v) => v + 1)
    return r.erro === null
  }

  return (
    <>
      <h1>Financeiro</h1>
      <p className="detalhe">
        Contribuições dos associados. Exercício de abril a março. Caixa, despesas e balanço chegam nas próximas entregas da
        Fase 2.
      </p>
      <div className="abas" role="tablist" aria-label="Partes do financeiro">
        {ABAS.map((a) => (
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
      {aba === 'Pagamentos informados' && <PagamentosInformados key={versao} concluir={concluir} />}
      {aba === 'Situação dos associados' && <SituacaoAssociados key={versao} concluir={concluir} />}
      {aba === 'Cobranças do exercício' && <CobrancasExercicio key={versao} concluir={concluir} />}
    </>
  )
}

type Concluir = (r: { erro: string | null }, sucesso: string) => boolean

// ---------------------------------------------------------------------

function PagamentosInformados({ concluir }: { concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(informesPendentes)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(informes) =>
        informes.length === 0 ? (
          <p className="vazio">Nenhum pagamento aguardando conferência.</p>
        ) : (
          <ul className="lista" aria-label="Pagamentos informados">
            {informes.map((i) => (
              <Informe key={i.id} informe={i} concluir={concluir} />
            ))}
          </ul>
        )
      }
    </MostrarCarga>
  )
}

function Informe({ informe: i, concluir }: { informe: InformePendente; concluir: Concluir }) {
  const [comprovante, setComprovante] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const nome = i.pessoa?.nome ?? 'Associado'
  const contribuicao = i.cobranca ? nomeDaCobranca(i.cobranca) : 'Contribuição'

  useEffect(() => {
    let ativo = true
    if (i.comprovante_caminho) void linkDoArquivo(i.comprovante_caminho).then((u) => ativo && setComprovante(u))
    return () => {
      ativo = false
    }
  }, [i.comprovante_caminho])

  async function analisar(confirmar: boolean) {
    setEnviando(true)
    concluir(
      await analisarInforme(i.id, confirmar, motivo),
      confirmar ? `Pagamento de ${nome} confirmado (${contribuicao}).` : `Pagamento de ${nome} recusado.`,
    )
    setEnviando(false)
  }

  return (
    <li className="lista-item lista-item-estatico" aria-label={`Pagamento de ${nome}`}>
      <strong>
        <Link to={`/ministros/${i.pessoa_id}`}>{nome}</Link> — {contribuicao}: {formatarReais(i.valor)}
      </strong>
      <span>
        Pago em {formatarData(i.data_pagamento)} por {i.forma} · informado em {formatarData(i.criado_em)}
        {i.observacao && ` · ${i.observacao}`}
      </span>
      <span>
        {i.comprovante_caminho ? (
          comprovante ? (
            <a href={comprovante} target="_blank" rel="noreferrer">
              Abrir comprovante
            </a>
          ) : (
            'Carregando o comprovante…'
          )
        ) : (
          'Sem comprovante (pagamento em dinheiro)'
        )}
      </span>
      <div className="acoes">
        <button type="button" className="botao" disabled={enviando} onClick={() => void analisar(true)}>
          Confirmar pagamento
        </button>
      </div>
      <details className="acao-recolhida">
        <summary>Recusar</summary>
        <form
          className="form-linha form-compacto"
          onSubmit={(e) => {
            e.preventDefault()
            void analisar(false)
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
    </li>
  )
}

// ---------------------------------------------------------------------

function SituacaoAssociados({ concluir }: { concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(situacaoDeTodos)
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
                  concluir={concluir}
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
}: {
  situacao: SituacaoContribuicao
  aberta: boolean
  aoAbrir: () => void
  concluir: Concluir
}) {
  return (
    <li className="lista-item lista-item-estatico" aria-label={s.nome}>
      <strong>
        <span className="numero">Nº {s.numero_registro}</span> {s.nome}
      </strong>
      <span>
        {s.jubilado ? (
          <span className="etiqueta etiqueta-ok">Isento (jubilado)</span>
        ) : s.em_dia ? (
          <span className="etiqueta etiqueta-ok">Em dia</span>
        ) : (
          <span className="etiqueta etiqueta-atraso">
            Em atraso: {s.cobrancas_vencidas} vencida(s), {formatarReais(s.valor_vencido)}
          </span>
        )}{' '}
        {s.igreja}
      </span>
      {!s.jubilado && (
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
  const [enviando, setEnviando] = useState(false)

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(cobrancas) =>
        cobrancas.length === 0 ? (
          <p className="vazio">Nenhuma contribuição em aberto.</p>
        ) : (
          <form
            className="form-linha form-compacto"
            aria-label={`Registrar pagamento de ${nome}`}
            onSubmit={async (e) => {
              e.preventDefault()
              const c = cobrancas.find((x) => x.id === cobrancaId)
              if (!c) return
              setEnviando(true)
              concluir(
                await registrarPagamento(c.id, data, Number(c.valor), forma, observacao),
                `Pagamento de ${nome} registrado (${nomeDaCobranca(c)}).`,
              )
              setEnviando(false)
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
        )
      }
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------

function CobrancasExercicio({ concluir }: { concluir: Concluir }) {
  const hoje = hojeIso()
  const atual = exercicioDe(hoje)
  const [exercicio, setExercicio] = useState(atual)
  const [enviando, setEnviando] = useState(false)
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
        <button
          type="button"
          className="botao"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true)
            const r = await gerarCobrancas(exercicio)
            setEnviando(false)
            concluir(
              r,
              r.erro === null
                ? r.dados === 0
                  ? `Nenhuma cobrança nova: o exercício ${nomeDoExercicio(exercicio)} já estava gerado para todos.`
                  : `${r.dados} cobrança(s) gerada(s) para o exercício ${nomeDoExercicio(exercicio)}.`
                : '',
            )
          }}
        >
          Gerar cobranças do exercício
        </button>
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
