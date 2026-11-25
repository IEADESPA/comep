import { useState } from 'react'
import { Aviso, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone, type Area } from '../../componentes/Icone'
import { CabecalhoTela, Chip } from '../../componentes/Telas'
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
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'

const ROTULO_ESTADO = {
  paga: 'Paga',
  conferencia: 'Aguardando a tesouraria',
  vencida: 'Vencida',
  a_vencer: 'A vencer',
  cancelada: 'Cancelada',
} as const

const AREA_ESTADO: Record<keyof typeof ROTULO_ESTADO, Area> = {
  paga: 'financas',
  conferencia: 'eventos',
  vencida: 'pessoas',
  a_vencer: 'assembleias',
  cancelada: 'assembleias',
}

// Telas novas (Fase 5.5, aprovada): no notebook, o resumo (situação, a próxima e o plano) e a lista dos meses;
// no celular, a próxima mensalidade em destaque, com "Já paguei: enviar o comprovante".

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
  // as contribuições marcadas no "Informar pagamento" (o botão "Enviar comprovante" de cada mês já marca)
  const [marcadas, setMarcadas] = useState<string[]>([])
  const marcarParaPagar = (id: string) => {
    setMarcadas((atual) => (atual.includes(id) ? atual : [...atual, id]))
    document.getElementById('informar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
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
    <div className="tela-nova">
      <CabecalhoTela titulo="Minhas mensalidades" sub={`Exercício ${nomeDoExercicio(exercicio)} (de abril a março)`} />
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
          if (situacao.jubilado && situacao.em_dia) {
            return (
              <Aviso titulo="Você é jubilado">
                <p>Associado jubilado é isento da contribuição (decisão da diretoria, 11/11/2026).</p>
              </Aviso>
            )
          }
          const valor = (tipo: 'mensal' | 'anual') =>
            valores.find((v: ValorContribuicao) => v.categoria === situacao.categoria_contribuicao && v.tipo === tipo)
          const visiveis = cobrancas.filter((c) => c.situacao !== 'cancelada')
          // troca no meio do exercício (14/11/2026): o banco confere; aqui só se esconde o que não tem como trocar
          const doExercicio = cobrancas.filter((c) => c.exercicio === exercicio && (c.tipo === 'mensal' || c.tipo === 'anual'))
          const informada = (c: (typeof cobrancas)[number]) => c.informes.some((i) => i.situacao === 'pendente')
          const algumaPaga = doExercicio.some((c) => c.situacao === 'paga' || informada(c))
          const mesAtual = `${hoje.slice(0, 7)}-01`
          const podeTrocar =
            doExercicio.length === 0 ||
            (plano === 'mensal'
              ? doExercicio.some(
                  (c) => c.tipo === 'mensal' && c.situacao === 'aberta' && !informada(c) && (!algumaPaga || c.competencia >= mesAtual),
                )
              : !doExercicio.some((c) => c.tipo === 'anual' && (c.situacao === 'paga' || informada(c))))

          const abertas = visiveis
            .filter((c) => ['vencida', 'a_vencer'].includes(estadoDaCobranca(c, hoje)))
            .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
          const proxima = abertas[0]
          const proximaVencida = proxima !== undefined && estadoDaCobranca(proxima, hoje) === 'vencida'

          return (
            <>
              <div className="resumo-mensalidades">
                <section className="bloco" aria-labelledby="titulo-situacao-fin">
                  <h2 id="titulo-situacao-fin" className="rotulo">
                    Situação
                  </h2>
                  {situacao.em_dia ? (
                    <Chip area="financas">
                      <Icone nome="check" tamanho={16} traco={2.6} />
                      <span>Em dia</span>
                    </Chip>
                  ) : (
                    <Chip area="pessoas">
                      <Icone nome="alerta" tamanho={16} traco={2.4} />
                      <span>Em atraso</span>
                    </Chip>
                  )}
                  <p className="detalhe">
                    {situacao.em_dia
                      ? 'Você pode votar e ser votado (Art. 11).'
                      : `${situacao.cobrancas_vencidas} contribuição(ões) vencida(s), ${formatarReais(situacao.valor_vencido)}. Quem está em atraso não vota nem é votado (Art. 11).`}
                  </p>
                </section>

                <section className="bloco bloco-proxima" aria-labelledby="titulo-proxima">
                  <h2 id="titulo-proxima" className="rotulo">
                    {proximaVencida ? 'Vencida' : 'Próxima'}
                  </h2>
                  {proxima ? (
                    <>
                      <strong className="numero-grande">
                        <span className="so-celular">{nomeDaCobranca(proxima)} · </span>
                        {formatarReais(proxima.valor)}
                      </strong>
                      <span className="detalhe">
                        <span className="so-computador">{nomeDaCobranca(proxima)} · </span>
                        {proximaVencida ? 'venceu' : 'vence'} em {formatarData(proxima.vencimento)}
                      </span>
                      <button type="button" className="botao botao-com-icone so-celular" onClick={() => marcarParaPagar(proxima.id)}>
                        <Icone nome="enviar" tamanho={20} />
                        Já paguei: enviar o comprovante
                      </button>
                    </>
                  ) : (
                    <span className="detalhe">Nada em aberto agora.</span>
                  )}
                </section>

                <section className="bloco" aria-labelledby="titulo-plano">
                  <h2 id="titulo-plano" className="rotulo">
                    Plano
                  </h2>
                  <Plano
                    plano={plano}
                    podeTrocar={podeTrocar}
                    proporcional={algumaPaga}
                    aoTrocar={async (tipo) =>
                      concluir(
                        await escolherPlano(pessoaId, exercicio, tipo),
                        tipo === 'anual'
                          ? algumaPaga
                            ? 'Plano anual escolhido: as mensalidades deste mês até março viraram uma anuidade proporcional.'
                            : 'Plano anual escolhido: uma anuidade, que vence na data da AGO de abril.'
                          : 'Plano mensal escolhido.',
                      )
                    }
                  />
                  <p className="detalhe">
                    Categoria: {NOME_DA_CATEGORIA[situacao.categoria_contribuicao]}
                    {valor('mensal') && valor('anual') &&
                      ` — ${formatarReais(valor('mensal')!.valor)} por mês ou ${formatarReais(valor('anual')!.valor)} por ano`}
                  </p>
                </section>
              </div>

              <section className="bloco" aria-labelledby="titulo-contribuicoes">
                <h2 id="titulo-contribuicoes">Contribuições do exercício</h2>
                {visiveis.length === 0 ? (
                  <p className="vazio">As cobranças deste exercício ainda não foram geradas pela tesouraria.</p>
                ) : (
                  <ul className="lista-meses" aria-label="Contribuições do exercício">
                    {visiveis.map((c) => (
                      <LinhaCobranca key={c.id} cobranca={c} hoje={hoje} aoPagar={() => marcarParaPagar(c.id)} />
                    ))}
                  </ul>
                )}
              </section>

              <InformarPagamento
                pessoaId={pessoaId}
                cobrancas={abertas}
                escolhidas={marcadas}
                setEscolhidas={setMarcadas}
                concluir={concluir}
              />
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function LinhaCobranca({ cobranca: c, hoje, aoPagar }: { cobranca: Cobranca; hoje: string; aoPagar: () => void }) {
  const estado = estadoDaCobranca(c, hoje)
  const recusado = [...c.informes].sort((a, b) => b.criado_em.localeCompare(a.criado_em)).find((i) => i.situacao === 'recusado')
  const aberta = estado === 'vencida' || estado === 'a_vencer'
  return (
    <li className="linha-mes" aria-label={nomeDaCobranca(c)}>
      <strong className="linha-mes-nome">{nomeDaCobranca(c)}</strong>
      <span className="somente-leitor"> — </span>
      <span className="linha-mes-valor">{formatarReais(c.valor)}</span>
      <span className="linha-mes-situacao">
        <Chip area={AREA_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Chip>
        <span className="detalhe">
          {estado === 'paga' ? `em ${formatarData(c.pago_em)} (${c.forma_pagamento})` : `vence em ${formatarData(c.vencimento)}`}
        </span>
      </span>
      {aberta && (
        <button type="button" className="botao-link" onClick={aoPagar}>
          Enviar comprovante
        </button>
      )}
      {aberta && recusado && <span className="linha-mes-aviso">Pagamento informado recusado pela tesouraria: {recusado.motivo_recusa}</span>}
    </li>
  )
}

function Plano({
  plano,
  podeTrocar,
  proporcional,
  aoTrocar,
}: {
  plano: 'mensal' | 'anual'
  podeTrocar: boolean
  /** já há pagamento no exercício: o anual vale deste mês até março */
  proporcional: boolean
  aoTrocar: (tipo: 'mensal' | 'anual') => Promise<boolean>
}) {
  const [enviando, umaVez] = useUmaVez()
  const outro = plano === 'mensal' ? 'anual' : 'mensal'
  return (
    <>
      <strong className="plano-nome">{plano === 'mensal' ? 'Mensal' : 'Anual (anuidade)'}</strong>
      {podeTrocar ? (
        <button
          type="button"
          className="botao-link alinhar-esquerda"
          title="Do mensal para o anual: as mensalidades em aberto deste mês até março viram uma anuidade proporcional (sem nada pago no exercício, a anuidade inteira, que vence na data da AGO de abril). Do anual para o mensal: enquanto a anuidade não foi paga."
          disabled={enviando}
          onClick={() => void umaVez(() => aoTrocar(outro))}
        >
          {outro === 'anual'
            ? proporcional
              ? 'Prefiro pagar o restante do exercício de uma vez'
              : 'Prefiro pagar o ano inteiro (anuidade)'
            : 'Prefiro pagar por mês'}
        </button>
      ) : (
        <p className="detalhe">
          {plano === 'anual'
            ? 'A anuidade já foi paga (ou informada): o plano só muda no próximo exercício.'
            : 'Não há mensalidades em aberto deste mês até março para trocar.'}
        </p>
      )}
    </>
  )
}

function InformarPagamento({
  pessoaId,
  cobrancas,
  escolhidas,
  setEscolhidas,
  concluir,
}: {
  pessoaId: string
  cobrancas: Cobranca[]
  escolhidas: string[]
  setEscolhidas: (f: (atual: string[]) => string[]) => void
  concluir: (r: { erro: string | null }, sucesso: string) => boolean
}) {
  const [data, setData] = useState(hojeIso())
  const [forma, setForma] = useState<string>('PIX')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const [versaoArquivo, setVersaoArquivo] = useState(0)

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
    const r = await informarPagamento({ pessoaId, cobrancas: escolhidas, data, forma, comprovante, observacao })
    if (r.erro !== null) return setErro(r.erro)
    setEscolhidas(() => [])
    setArquivo(null)
    setVersaoArquivo((v) => v + 1)
    setObservacao('')
    concluir(r, 'Pagamento informado. A tesouraria vai conferir.')
  }

  return (
    <section className="bloco" id="informar" aria-labelledby="titulo-informar">
      <h2 id="titulo-informar">Informar pagamento</h2>
      <p className="detalhe">Pagou pelo PIX, depósito ou transferência? Marque o que pagou e envie o comprovante: a tesouraria confere.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(enviar)
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
            <input
              key={versaoArquivo}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="largura-total">
            Observação
            <input maxLength={1000} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
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
