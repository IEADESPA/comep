import { useState } from 'react'
import { Aviso, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { ok } from '../../dados/cliente'
import { formatarReais, listarValores, NOME_DA_CATEGORIA, type ValorContribuicao } from '../../dados/configuracoes'
import {
  escolherPlano,
  estadoDaCobranca,
  exercicioDe,
  FORMAS_PAGAMENTO,
  informarPagamento,
  minhasCobrancas,
  nomeDaCobranca,
  nomeDoExercicio,
  planoDe,
  situacaoDe,
  type Cobranca,
} from '../../dados/financeiro'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'

const ROTULO_ESTADO = {
  paga: 'Paga',
  conferencia: 'Aguardando a tesouraria',
  vencida: 'Vencida',
  a_vencer: 'A vencer',
  cancelada: 'Cancelada',
} as const

/** /minhas-mensalidades — o associado vê as contribuições do exercício e informa pagamentos. */
export function MinhasMensalidades() {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta === null) return <Carregando />
  if (estado.conta.tipo !== 'ok') {
    return (
      <Aviso titulo="Cadastro não encontrado">
        <p>Saia e entre de novo.</p>
      </Aviso>
    )
  }
  return <Conteudo key={estado.conta.conta.pessoaId} pessoaId={estado.conta.conta.pessoaId} />
}

function Conteudo({ pessoaId }: { pessoaId: string }) {
  const hoje = hojeIso()
  const exercicio = exercicioDe(hoje)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [cobrancas, situacao, plano, valores] = await Promise.all([
      minhasCobrancas(pessoaId, exercicio),
      situacaoDe(pessoaId),
      planoDe(pessoaId, exercicio),
      listarValores(),
    ])
    if (cobrancas.erro !== null) return cobrancas
    if (situacao.erro !== null) return situacao
    if (plano.erro !== null) return plano
    if (valores.erro !== null) return valores
    return ok({ cobrancas: cobrancas.dados, situacao: situacao.dados, plano: plano.dados, valores: valores.dados.vigentes })
  })

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
    return r.erro === null
  }

  return (
    <>
      <h1>Minhas mensalidades</h1>
      <p className="detalhe">Exercício {nomeDoExercicio(exercicio)} (de abril a março).</p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ cobrancas, situacao, plano, valores }) => {
          if (!situacao) {
            return (
              <Aviso titulo="Você ainda não é associado">
                <p>As contribuições começam depois da aprovação do pedido de associação.</p>
              </Aviso>
            )
          }
          if (situacao.jubilado) {
            return (
              <Aviso titulo="Você é jubilado">
                <p>Associado jubilado é isento da contribuição (decisão da diretoria, 11/11/2026).</p>
              </Aviso>
            )
          }
          const valor = (tipo: 'mensal' | 'anual') =>
            valores.find((v: ValorContribuicao) => v.categoria === situacao.categoria_contribuicao && v.tipo === tipo)
          const visiveis = cobrancas.filter((c) => c.situacao !== 'cancelada')
          const algumaPaga = cobrancas.some((c) => c.situacao === 'paga' || c.informes.some((i) => i.situacao === 'pendente'))

          return (
            <>
              <section className="painel" aria-labelledby="titulo-situacao-fin">
                <h2 id="titulo-situacao-fin">Situação</h2>
                {situacao.em_dia ? (
                  <p>
                    <span className="etiqueta etiqueta-ok">Em dia</span> Você pode votar e ser votado (Art. 11).
                  </p>
                ) : (
                  <p>
                    <span className="etiqueta etiqueta-atraso">Em atraso</span> {situacao.cobrancas_vencidas} contribuição(ões)
                    vencida(s), {formatarReais(situacao.valor_vencido)}. Quem está em atraso não vota nem é votado (Art. 11).
                  </p>
                )}
                <p className="detalhe">
                  Categoria: {NOME_DA_CATEGORIA[situacao.categoria_contribuicao]}
                  {valor('mensal') && valor('anual') &&
                    ` — ${formatarReais(valor('mensal')!.valor)} por mês ou ${formatarReais(valor('anual')!.valor)} por ano`}
                </p>
              </section>

              <Plano
                plano={plano}
                podeTrocar={!algumaPaga}
                aoTrocar={async (tipo) =>
                  concluir(
                    await escolherPlano(pessoaId, exercicio, tipo),
                    tipo === 'anual' ? 'Plano anual escolhido: uma anuidade, que vence em abril.' : 'Plano mensal escolhido.',
                  )
                }
              />

              <section className="painel" aria-labelledby="titulo-contribuicoes">
                <h2 id="titulo-contribuicoes">Contribuições do exercício</h2>
                {visiveis.length === 0 ? (
                  <p className="vazio">As cobranças deste exercício ainda não foram geradas pela tesouraria.</p>
                ) : (
                  <ul className="lista" aria-label="Contribuições do exercício">
                    {visiveis.map((c) => (
                      <LinhaCobranca key={c.id} cobranca={c} hoje={hoje} />
                    ))}
                  </ul>
                )}
              </section>

              <InformarPagamento
                pessoaId={pessoaId}
                cobrancas={visiveis.filter((c) => ['vencida', 'a_vencer'].includes(estadoDaCobranca(c, hoje)))}
                concluir={concluir}
              />
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function LinhaCobranca({ cobranca: c, hoje }: { cobranca: Cobranca; hoje: string }) {
  const estado = estadoDaCobranca(c, hoje)
  const recusado = [...c.informes].sort((a, b) => b.criado_em.localeCompare(a.criado_em)).find((i) => i.situacao === 'recusado')
  return (
    <li className="lista-item lista-item-estatico" aria-label={nomeDaCobranca(c)}>
      <strong>
        {nomeDaCobranca(c)} — {formatarReais(c.valor)}
      </strong>
      <span>
        <span className={`etiqueta etiqueta-${estado}`}>{ROTULO_ESTADO[estado]}</span>{' '}
        {estado === 'paga' ? `em ${formatarData(c.pago_em)} (${c.forma_pagamento})` : `vence em ${formatarData(c.vencimento)}`}
      </span>
      {estado !== 'paga' && estado !== 'conferencia' && recusado && (
        <span>Pagamento informado recusado pela tesouraria: {recusado.motivo_recusa}</span>
      )}
    </li>
  )
}

function Plano({
  plano,
  podeTrocar,
  aoTrocar,
}: {
  plano: 'mensal' | 'anual'
  podeTrocar: boolean
  aoTrocar: (tipo: 'mensal' | 'anual') => Promise<boolean>
}) {
  const [enviando, setEnviando] = useState(false)
  const outro = plano === 'mensal' ? 'anual' : 'mensal'
  return (
    <section className="painel" aria-labelledby="titulo-plano">
      <h2 id="titulo-plano">Plano</h2>
      <p>
        Você paga <strong>{plano === 'mensal' ? 'por mês' : 'o ano inteiro em abril (anuidade)'}</strong>.
      </p>
      {podeTrocar ? (
        <button
          type="button"
          className="botao botao-secundario"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true)
            await aoTrocar(outro)
            setEnviando(false)
          }}
        >
          {outro === 'anual' ? 'Prefiro pagar o ano inteiro (anuidade)' : 'Prefiro pagar por mês'}
        </button>
      ) : (
        <p className="detalhe">Já há pagamento neste exercício: o plano só muda no próximo (abril).</p>
      )}
    </section>
  )
}

function InformarPagamento({
  pessoaId,
  cobrancas,
  concluir,
}: {
  pessoaId: string
  cobrancas: Cobranca[]
  concluir: (r: { erro: string | null }, sucesso: string) => boolean
}) {
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [data, setData] = useState(hojeIso())
  const [forma, setForma] = useState<string>('PIX')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (cobrancas.length === 0) return null
  const total = cobrancas.filter((c) => escolhidas.includes(c.id)).reduce((t, c) => t + Number(c.valor), 0)

  async function enviar() {
    setErro(null)
    if (escolhidas.length === 0) return setErro('Marque qual(is) contribuição(ões) você pagou.')
    if (forma !== 'Dinheiro' && !arquivo) return setErro('Envie o comprovante (foto ou PDF) do PIX, depósito ou transferência.')
    let comprovante: { blob: Blob; extensao: string } | null = null
    if (arquivo) {
      const pronto = await prepararComprovante(arquivo)
      if ('erro' in pronto) return setErro(pronto.erro)
      comprovante = pronto
    }
    setEnviando(true)
    const r = await informarPagamento({ pessoaId, cobrancas: escolhidas, data, forma, comprovante, observacao })
    setEnviando(false)
    if (r.erro !== null) return setErro(r.erro)
    setEscolhidas([])
    setArquivo(null)
    setObservacao('')
    concluir(r, 'Pagamento informado. A tesouraria vai conferir.')
  }

  return (
    <section className="painel" aria-labelledby="titulo-informar">
      <h2 id="titulo-informar">Informar pagamento</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <fieldset>
          <legend>O que você pagou</legend>
          {cobrancas.map((c) => (
            <label key={c.id} className="caixa-marcar">
              <input
                type="checkbox"
                checked={escolhidas.includes(c.id)}
                onChange={(e) =>
                  setEscolhidas((atual) => (e.target.checked ? [...atual, c.id] : atual.filter((id) => id !== c.id)))
                }
              />
              {nomeDaCobranca(c)} — {formatarReais(c.valor)}
            </label>
          ))}
        </fieldset>
        <div className="grade-form">
          <label>
            Data do pagamento
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
          <label className="largura-total">
            Comprovante {forma === 'Dinheiro' ? '(opcional)' : '*'}
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
          <label className="largura-total">
            Observação
            <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </label>
        </div>
        {total > 0 && <p>Total: {formatarReais(total)}</p>}
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Informar pagamento'}
          </button>
        </div>
      </form>
    </section>
  )
}
