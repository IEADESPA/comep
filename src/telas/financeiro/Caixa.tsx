import { useEffect, useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  autorizarDespesa,
  cancelarLancamento,
  despesasAguardando,
  lancamentosDoMes,
  lancar,
  listarCategoriasFinanceiras,
  NOME_DA_SITUACAO_LANCAMENTO,
  saldos,
  transferir,
  type Lancamento,
  type SaldoConta,
  type TipoLancamento,
} from '../../dados/caixa'
import { ok } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { linkDoArquivo } from '../../dados/pedidos'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'
import { DICA_VALOR, lerValor, PADRAO_VALOR } from '../../utilitarios/valores'

type Concluir = (r: { erro: string | null }, sucesso: string) => boolean

/** Aba "Caixa": saldos, novo lançamento, transferência e lançamentos do mês. */
export function CaixaAba({
  pessoaId,
  concluir,
  somenteLeitura = false,
}: {
  pessoaId: string
  concluir: Concluir
  somenteLeitura?: boolean
}) {
  const [mes, setMes] = useState(hojeIso().slice(0, 7))
  const [verDesfeitos, setVerDesfeitos] = useState(false)
  const [carga, recarregar] = useCarregar(async () => {
    const [contas, categorias, lancamentos] = await Promise.all([saldos(), listarCategoriasFinanceiras(), lancamentosDoMes(mes)])
    if (contas.erro !== null) return contas
    if (categorias.erro !== null) return categorias
    if (lancamentos.erro !== null) return lancamentos
    return ok({ contas: contas.dados, categorias: categorias.dados, lancamentos: lancamentos.dados })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ contas, categorias, lancamentos }) => (
        <>
          <ul className="lista lista-contas" aria-label="Saldos">
            {contas.map((c) => (
              <li key={c.id} className="lista-item lista-item-estatico" aria-label={`Saldo de ${c.nome}`}>
                <span>{c.nome}</span>
                <strong className="saldo">{formatarReais(c.saldo)}</strong>
                {Number(c.aguardando_autorizacao) > 0 && (
                  <span>{formatarReais(c.aguardando_autorizacao)} em despesas aguardando o presidente</span>
                )}
              </li>
            ))}
          </ul>

          {!somenteLeitura && (
            <>
              <NovoLancamento pessoaId={pessoaId} contas={contas} categorias={categorias} concluir={concluirERecarregar} />
              <Transferencia contas={contas} concluir={concluirERecarregar} />
            </>
          )}

          <section className="painel" aria-labelledby="titulo-lancamentos">
            <div className="cabecalho-painel">
              <h2 id="titulo-lancamentos">Lançamentos</h2>
              <label className="campo-curto">
                <span className="somente-leitor">Mês</span>
                <input
                  type="month"
                  required
                  value={mes}
                  onChange={(e) => {
                    if (!e.target.value) return
                    setMes(e.target.value)
                    recarregar()
                  }}
                />
              </label>
            </div>
            <label className="caixa-marcar">
              <input type="checkbox" checked={verDesfeitos} onChange={(e) => setVerDesfeitos(e.target.checked)} />
              Mostrar cancelados e recusados
            </label>
            {visiveis(lancamentos, verDesfeitos).length === 0 ? (
              <p className="vazio">Nenhum lançamento neste mês.</p>
            ) : (
              <ul className="lista" aria-label="Lançamentos do mês">
                {visiveis(lancamentos, verDesfeitos).map((l) => (
                  <LinhaLancamento key={l.id} lancamento={l} concluir={concluirERecarregar} somenteLeitura={somenteLeitura} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </MostrarCarga>
  )
}

function visiveis(lancamentos: Lancamento[], verDesfeitos: boolean) {
  return verDesfeitos ? lancamentos : lancamentos.filter((l) => l.situacao !== 'cancelado' && l.situacao !== 'recusado')
}

function LinhaLancamento({
  lancamento: l,
  concluir,
  somenteLeitura,
}: {
  lancamento: Lancamento
  concluir: Concluir
  somenteLeitura: boolean
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const sinal = l.tipo === 'entrada' ? '+' : '−'
  const valeNoSaldo = l.situacao === 'efetivado'
  return (
    <li className="lista-item lista-item-estatico" aria-label={l.descricao}>
      <strong>
        <span className={l.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida'}>
          {sinal} {formatarReais(l.valor)}
        </span>{' '}
        {l.descricao}
      </strong>
      <span>
        {formatarData(l.data)} · {l.categoria?.nome} · {l.conta?.nome}
        {!valeNoSaldo && (
          <>
            {' '}
            <span className={`etiqueta etiqueta-${l.situacao === 'aguardando_autorizacao' ? 'conferencia' : 'cancelada'}`}>
              {NOME_DA_SITUACAO_LANCAMENTO[l.situacao]}
            </span>
          </>
        )}
        {l.situacao === 'efetivado' && l.autorizado && ` · autorizada por ${l.autorizado.nome}`}
      </span>
      {l.motivo && <span>Motivo: {l.motivo}</span>}
      {!somenteLeitura && !l.cobranca_id && !['cancelado', 'recusado'].includes(l.situacao) && (
        <details className="acao-recolhida">
          <summary>Cancelar lançamento</summary>
          <form
            className="form-linha form-compacto"
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => concluir(await cancelarLancamento(l.id, motivo), 'Lançamento cancelado.'))
            }}
          >
            <label>
              Motivo *
              <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Cancelar
            </button>
          </form>
        </details>
      )}
    </li>
  )
}

function NovoLancamento({
  pessoaId,
  contas,
  categorias,
  concluir,
}: {
  pessoaId: string
  contas: SaldoConta[]
  categorias: { id: string; nome: string; tipo: TipoLancamento; sistema: string | null }[]
  concluir: Concluir
}) {
  const [tipo, setTipo] = useState<TipoLancamento>('entrada')
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [categoriaId, setCategoriaId] = useState('')
  const [data, setData] = useState(hojeIso())
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const [versaoArquivo, setVersaoArquivo] = useState(0)
  const opcoes = categorias.filter((c) => c.tipo === tipo && !c.sistema)
  const inicioDaConta = contas.find((c) => c.id === contaId)?.saldo_inicial_em

  async function enviar() {
    setErro(null)
    const numero = lerValor(valor)
    if (numero === null || numero <= 0) return setErro(`Valor inválido. ${DICA_VALOR}.`)
    let comprovante: { blob: Blob; extensao: string } | null = null
    if (arquivo) {
      const pronto = await prepararComprovante(arquivo)
      if ('erro' in pronto) return setErro(pronto.erro)
      comprovante = pronto
    }
    const r = await lancar({ pessoaId, contaId, tipo, categoriaId, data, valor: numero, descricao, comprovante })
    if (r.erro !== null) return setErro(r.erro)
    setValor('')
    setDescricao('')
    setArquivo(null)
    setVersaoArquivo((v) => v + 1)
    concluir(
      r,
      tipo === 'entrada' ? 'Entrada lançada.' : 'Despesa lançada. Ela só sai do saldo depois que o presidente autorizar.',
    )
  }

  return (
    <details className="painel acao-recolhida-painel">
      <summary>Novo lançamento</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(enviar)
        }}
      >
        <div className="grade-form">
          <label>
            Tipo
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoLancamento)
                setCategoriaId('')
              }}
            >
              <option value="entrada">Entrada (receita)</option>
              <option value="saida">Saída (despesa)</option>
            </select>
          </label>
          <label>
            Conta
            <select required value={contaId} onChange={(e) => setContaId(e.target.value)}>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria
            <select required value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">— Escolha —</option>
              {opcoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data
            <input
              type="date"
              required
              min={inicioDaConta}
              max={hojeIso()}
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <label>
            Valor (R$)
            <input
              required
              inputMode="decimal"
              pattern={PADRAO_VALOR}
              title={DICA_VALOR}
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <label>
            Comprovante (nota, recibo)
            <input
              key={versaoArquivo}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="largura-total">
            Descrição *
            <input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Oferta da reunião de novembro" />
          </label>
        </div>
        {tipo === 'saida' && (
          <p className="detalhe">A despesa fica aguardando a autorização do presidente (Art. 12, §2º, VI).</p>
        )}
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            {tipo === 'entrada' ? 'Lançar entrada' : 'Lançar despesa'}
          </button>
        </div>
      </form>
    </details>
  )
}

function Transferencia({ contas, concluir }: { contas: SaldoConta[]; concluir: Concluir }) {
  const [origem, setOrigem] = useState(contas.find((c) => c.tipo === 'caixa')?.id ?? '')
  const [destino, setDestino] = useState(contas.find((c) => c.tipo === 'banco')?.id ?? '')
  const [data, setData] = useState(hojeIso())
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  if (contas.length < 2) return null
  const inicio = [origem, destino]
    .map((id) => contas.find((c) => c.id === id)?.saldo_inicial_em ?? '')
    .sort()
    .at(-1)
  return (
    <details className="painel acao-recolhida-painel">
      <summary>Transferência entre contas</summary>
      <form
        className="form-linha"
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const numero = lerValor(valor)
            if (numero === null || numero <= 0) return concluir({ erro: `Valor inválido. ${DICA_VALOR}.` }, '')
            if (concluir(await transferir(origem, destino, data, numero, descricao), 'Transferência registrada.')) {
              setValor('')
              setDescricao('')
            }
          })
        }}
      >
        <label>
          De
          <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Para
          <select value={destino} onChange={(e) => setDestino(e.target.value)}>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data
          <input type="date" required min={inicio || undefined} max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Valor (R$)
          <input
            required
            inputMode="decimal"
            pattern={PADRAO_VALOR}
            title={DICA_VALOR}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
        <label>
          Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Depósito das ofertas" />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Transferir
        </button>
      </form>
    </details>
  )
}

/** Aba "Despesas a autorizar": a presidência autoriza ou recusa; a tesouraria acompanha. */
export function DespesasAutorizar({
  podeAutorizar,
  usuarioId,
  concluir,
}: {
  podeAutorizar: boolean
  usuarioId: string
  concluir: Concluir
}) {
  const [carga, recarregar] = useCarregar(despesasAguardando)
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(despesas) =>
        despesas.length === 0 ? (
          <p className="vazio">Nenhuma despesa aguardando autorização.</p>
        ) : (
          <>
            {!podeAutorizar && <p className="detalhe">Quem autoriza é o presidente (Art. 12, §2º, VI).</p>}
            <ul className="lista" aria-label="Despesas aguardando autorização">
              {despesas.map((d) => (
                <Despesa
                  key={d.id}
                  despesa={d}
                  podeAutorizar={podeAutorizar}
                  minha={d.criado_por === usuarioId}
                  concluir={concluirERecarregar}
                />
              ))}
            </ul>
          </>
        )
      }
    </MostrarCarga>
  )
}

function Despesa({
  despesa: d,
  podeAutorizar,
  minha,
  concluir,
}: {
  despesa: Lancamento
  podeAutorizar: boolean
  minha: boolean
  concluir: Concluir
}) {
  const [comprovante, setComprovante] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  useEffect(() => {
    let ativo = true
    if (d.comprovante_caminho) void linkDoArquivo(d.comprovante_caminho).then((u) => ativo && setComprovante(u))
    return () => {
      ativo = false
    }
  }, [d.comprovante_caminho])

  return (
    <li className="lista-item lista-item-estatico" aria-label={`Despesa: ${d.descricao}`}>
      <strong>
        {formatarReais(d.valor)} — {d.descricao}
      </strong>
      <span>
        {formatarData(d.data)} · {d.categoria?.nome} · {d.conta?.nome}
      </span>
      {d.comprovante_caminho && comprovante && (
        <span>
          <a href={comprovante} target="_blank" rel="noreferrer">
            Abrir comprovante
          </a>
        </span>
      )}
      {podeAutorizar && minha && (
        <p className="detalhe">Você lançou esta despesa: outra pessoa da presidência autoriza.</p>
      )}
      {podeAutorizar && !minha && (
        <>
          <div className="acoes">
            <button
              type="button"
              className="botao"
              disabled={enviando}
              onClick={() =>
                void umaVez(async () =>
                  concluir(await autorizarDespesa(d.id, true, ''), `Despesa autorizada: ${d.descricao}.`),
                )
              }
            >
              Autorizar despesa
            </button>
          </div>
          <details className="acao-recolhida">
            <summary>Recusar</summary>
            <form
              className="form-linha form-compacto"
              onSubmit={(e) => {
                e.preventDefault()
                void umaVez(async () => concluir(await autorizarDespesa(d.id, false, motivo), `Despesa recusada: ${d.descricao}.`))
              }}
            >
              <label>
                Motivo *
                <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </label>
              <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                Recusar
              </button>
            </form>
          </details>
        </>
      )}
    </li>
  )
}
