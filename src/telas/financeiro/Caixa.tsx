import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { Chip } from '../../componentes/Telas'
import {
  caixaNoPeriodo,
  cancelarLancamento,
  lancamentosDoPeriodo,
  lancar,
  listarCategoriasFinanceiras,
  listarTransferencias,
  NOME_DA_SITUACAO_LANCAMENTO,
  saldos,
  transferir,
  type CategoriaFinanceira,
  NOME_DA_ORIGEM,
  type LinhaCaixa,
  type OrigemLancamento,
  type SaldoConta,
  type TipoLancamento,
} from '../../dados/caixa'
import { ok } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'
import { DICA_VALOR, lerValor, PADRAO_VALOR } from '../../utilitarios/valores'
import { ContasECategorias } from './ConfigFinanceiro'
import { LinkComprovante, Valor } from './comum'
import { diaPorExtenso, fimDoMes, nomeDoMes, somarMes, type Concluir } from './util'

// Financeiro › Caixa (rodada 11, opção 2: o extrato). Os lançamentos do mês por dia, com o saldo depois de cada um,
// como no extrato do banco; à direita, o saldo de hoje e os botões de lançar. Subfunções: Contas e saldos e
// Transferências.

type Formulario = 'entrada' | 'saida' | 'transferencia' | null

/** Uma linha do extrato: um lançamento, uma transferência (os dois lados juntos) ou a abertura de uma conta. */
type LinhaExtrato = {
  chave: string
  data: string
  ordem: string
  descricao: string
  detalhe: string
  tipo: 'entrada' | 'saida' | 'transferencia' | 'abertura'
  valor: number
  /** o quanto muda o saldo de todas as contas (0 na transferência; 0 no que não vale) */
  efeito: number
  conta: boolean
  linha: LinhaCaixa | null
  saldoDepois?: number
  /** de onde veio (parte 12): o filtro do extrato e o link para a origem */
  origem: OrigemLancamento | 'abertura'
}

function montarExtrato(
  lancamentos: LinhaCaixa[],
  aberturas: { conta: string; data: string; valor: number }[],
  saldoInicio: number,
  verDesfeitos: boolean,
  origem: OrigemLancamento | '',
) {
  const linhas: LinhaExtrato[] = []
  const pares = new Map<string, LinhaCaixa[]>()
  for (const l of lancamentos) {
    if (l.transferencia_id) {
      pares.set(l.transferencia_id, [...(pares.get(l.transferencia_id) ?? []), l])
      continue
    }
    const vale = l.no_saldo
    linhas.push({
      chave: l.id,
      data: l.data,
      ordem: l.criado_em,
      descricao: l.descricao,
      detalhe: `${l.categoria_nome} · ${l.conta_nome}`,
      tipo: l.tipo,
      valor: Number(l.valor),
      efeito: vale ? (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor) : 0,
      conta: vale,
      linha: l,
      origem: l.origem ?? 'avulso',
    })
  }
  for (const [id, lados] of pares) {
    const sai = lados.find((l) => l.tipo === 'saida') ?? lados[0]
    const entra = lados.find((l) => l.tipo === 'entrada')
    const efeito = lados.reduce((t, l) => t + (l.no_saldo ? (l.tipo === 'entrada' ? 1 : -1) * Number(l.valor) : 0), 0)
    linhas.push({
      chave: id,
      data: sai.data,
      ordem: sai.criado_em,
      descricao: sai.descricao,
      detalhe: `Transferência · ${sai.conta_nome} → ${entra?.conta_nome ?? '?'}`,
      tipo: 'transferencia',
      valor: Number(sai.valor),
      efeito,
      conta: sai.situacao === 'efetivado',
      linha: sai,
      origem: 'transferencia',
    })
  }
  for (const a of aberturas) {
    linhas.push({
      chave: `abertura-${a.conta}`,
      data: a.data,
      ordem: '',
      descricao: `Saldo de abertura · ${a.conta}`,
      detalhe: 'A conta passou a valer no caixa neste dia',
      tipo: 'abertura',
      valor: Number(a.valor),
      efeito: Number(a.valor),
      conta: true,
      linha: null,
      origem: 'abertura',
    })
  }
  linhas.sort((a, b) => a.data.localeCompare(b.data) || a.ordem.localeCompare(b.ordem))
  let saldo = Number(saldoInicio)
  for (const l of linhas) {
    saldo = Math.round((saldo + l.efeito) * 100) / 100
    if (l.conta) l.saldoDepois = saldo
  }
  // o filtro por origem só esconde linhas: o saldo depois de cada uma continua o de todas as contas
  const visiveis = linhas.filter(
    (l) => (verDesfeitos || !l.linha || !['cancelado', 'recusado'].includes(l.linha.situacao)) && (!origem || l.origem === origem),
  )
  // do mais novo para o mais antigo, agrupado por dia
  const dias = new Map<string, LinhaExtrato[]>()
  for (const l of [...visiveis].reverse()) dias.set(l.data, [...(dias.get(l.data) ?? []), l])
  return [...dias.entries()]
}

/** /financeiro/caixa — o extrato do mês (?mes=AAAA-MM). */
export function ExtratoCaixa({ pessoaId, concluir, somenteLeitura }: { pessoaId: string; concluir: Concluir; somenteLeitura: boolean }) {
  const [parametros, setParametros] = useSearchParams()
  const hojeMes = hojeIso().slice(0, 7)
  const pedido = parametros.get('mes') ?? ''
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) && pedido <= hojeMes ? pedido : hojeMes
  const irPara = (novo: string) =>
    setParametros(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('mes', novo)
        return n
      },
      { replace: true },
    )
  return <ConteudoExtrato key={mes} mes={mes} hojeMes={hojeMes} irPara={irPara} pessoaId={pessoaId} concluir={concluir} somenteLeitura={somenteLeitura} />
}

function ConteudoExtrato({
  mes,
  hojeMes,
  irPara,
  pessoaId,
  concluir,
  somenteLeitura,
}: {
  mes: string
  hojeMes: string
  irPara: (m: string) => void
  pessoaId: string
  concluir: Concluir
  somenteLeitura: boolean
}) {
  const [verDesfeitos, setVerDesfeitos] = useState(false)
  const [origem, setOrigem] = useState<OrigemLancamento | ''>('')
  const [formulario, setFormulario] = useState<Formulario>(null)
  const inicio = `${mes}-01`
  const fim = fimDoMes(mes)
  const [carga, recarregar] = useCarregar(async () => {
    const [contas, categorias, lancamentos, periodo] = await Promise.all([
      saldos(),
      listarCategoriasFinanceiras(),
      lancamentosDoPeriodo(inicio, fim),
      caixaNoPeriodo(inicio, fim),
    ])
    if (contas.erro !== null) return contas
    if (categorias.erro !== null) return categorias
    if (lancamentos.erro !== null) return lancamentos
    if (periodo.erro !== null) return periodo
    return ok({ contas: contas.dados, categorias: categorias.dados, lancamentos: lancamentos.dados, periodo: periodo.dados })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ contas, categorias, lancamentos, periodo }) => {
        const dias = montarExtrato(lancamentos, periodo.aberturas, periodo.saldo_inicio, verDesfeitos, origem)
        const origensDoMes = [...new Set(lancamentos.map((l) => l.origem ?? 'avulso'))]
        const total = contas.reduce((t, c) => t + Number(c.saldo), 0)
        return (
          <div className="fin-extrato">
            <div className="fin-extrato-lado">
              <section className="bloco fin-saldo-hoje" aria-labelledby="titulo-saldo-hoje">
                <h2 id="titulo-saldo-hoje" className="fin-rotulo">
                  Saldo de hoje
                </h2>
                <strong className="fin-saldo-total">{formatarReais(total)}</strong>
                <ul className="fin-saldos" aria-label="Saldos">
                  {contas.map((c) => (
                    <li key={c.id} aria-label={`Saldo de ${c.nome}`}>
                      <span>{c.nome}</span>
                      <strong className="saldo">{formatarReais(c.saldo)}</strong>
                      {Number(c.aguardando_autorizacao) > 0 && (
                        <span className="fin-saldo-espera">{formatarReais(c.aguardando_autorizacao)} esperando o presidente</span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
              {!somenteLeitura && (
                <div className="fin-botoes-caixa">
                  <button
                    type="button"
                    className="botao fin-botao-largo"
                    aria-expanded={formulario === 'entrada'}
                    onClick={() => setFormulario(formulario === 'entrada' ? null : 'entrada')}
                  >
                    + Lançar entrada
                  </button>
                  <button
                    type="button"
                    className="botao botao-secundario fin-botao-largo"
                    aria-expanded={formulario === 'saida'}
                    onClick={() => setFormulario(formulario === 'saida' ? null : 'saida')}
                  >
                    − Lançar despesa
                  </button>
                  {contas.length > 1 && (
                    <button
                      type="button"
                      className="botao botao-secundario fin-botao-largo"
                      aria-expanded={formulario === 'transferencia'}
                      onClick={() => setFormulario(formulario === 'transferencia' ? null : 'transferencia')}
                    >
                      Transferência entre contas
                    </button>
                  )}
                </div>
              )}
              {formulario === 'transferencia' && (
                <FormTransferencia
                  contas={contas}
                  concluir={(r, s) => {
                    const certo = concluirERecarregar(r, s)
                    if (certo) setFormulario(null)
                    return certo
                  }}
                />
              )}
              {(formulario === 'entrada' || formulario === 'saida') && (
                <NovoLancamento
                  key={formulario}
                  tipo={formulario}
                  pessoaId={pessoaId}
                  contas={contas}
                  categorias={categorias}
                  concluir={(r, s, data) => {
                    const certo = concluirERecarregar(r, s)
                    if (certo) {
                      setFormulario(null)
                      if (data && data.slice(0, 7) !== mes) irPara(data.slice(0, 7))
                    }
                    return certo
                  }}
                />
              )}
            </div>

            <div className="fin-extrato-principal">
              <div className="fin-mes">
                <button type="button" className="botao-icone" aria-label="Mês anterior" onClick={() => irPara(somarMes(mes, -1))}>
                  <Icone nome="voltar" tamanho={20} />
                </button>
                <h2>{nomeDoMes(mes, true)}</h2>
                <button
                  type="button"
                  className="botao-icone"
                  aria-label="Próximo mês"
                  disabled={mes >= hojeMes}
                  onClick={() => irPara(somarMes(mes, 1))}
                >
                  <Icone nome="seta" tamanho={20} />
                </button>
                <label className="fin-mes-campo so-computador">
                  <span className="somente-leitor">Mês</span>
                  <input
                    type="month"
                    max={hojeMes}
                    value={mes}
                    onChange={(e) => {
                      if (e.target.value) irPara(e.target.value)
                    }}
                  />
                </label>
                <span className="fin-mes-dica so-computador">o saldo à direita de cada linha é o de depois dela</span>
              </div>
              <section className="bloco fin-extrato-lista" aria-labelledby="titulo-lancamentos">
                <h2 id="titulo-lancamentos" className="somente-leitor">
                  Lançamentos de {nomeDoMes(mes)}
                </h2>
                <p className="fin-extrato-saldo">
                  <span>Saldo no começo do mês</span>
                  <strong>{formatarReais(periodo.saldo_inicio)}</strong>
                </p>
                {dias.length === 0 ? (
                  <p className="vazio">Nenhum lançamento neste mês.</p>
                ) : (
                  dias.map(([dia, linhas]) => (
                    <div key={dia} className="fin-dia">
                      <h3>{diaPorExtenso(dia)}</h3>
                      <ul aria-label={`Lançamentos de ${diaPorExtenso(dia)}`}>
                        {linhas.map((l) => (
                          <LinhaDoExtrato key={l.chave} l={l} concluir={concluirERecarregar} somenteLeitura={somenteLeitura} />
                        ))}
                      </ul>
                    </div>
                  ))
                )}
                <p className="fin-extrato-saldo">
                  <span>{mes === hojeMes ? 'Saldo de hoje' : 'Saldo no fim do mês'}</span>
                  <strong>{formatarReais(periodo.saldo_fim)}</strong>
                </p>
              </section>
              <div className="fin-extrato-filtros">
                <label>
                  De onde veio
                  <select value={origem} onChange={(e) => setOrigem(e.target.value as OrigemLancamento | '')}>
                    <option value="">Todas as origens</option>
                    {(Object.keys(NOME_DA_ORIGEM) as OrigemLancamento[])
                      .filter((o) => origensDoMes.includes(o) || o === origem)
                      .map((o) => (
                        <option key={o} value={o}>
                          {NOME_DA_ORIGEM[o]}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="caixa-marcar">
                  <input type="checkbox" checked={verDesfeitos} onChange={(e) => setVerDesfeitos(e.target.checked)} />
                  Mostrar cancelados e recusados
                </label>
              </div>
            </div>
          </div>
        )
      }}
    </MostrarCarga>
  )
}

function LinhaDoExtrato({ l, concluir, somenteLeitura }: { l: LinhaExtrato; concluir: Concluir; somenteLeitura: boolean }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const lc = l.linha
  const desfeito = lc !== null && ['cancelado', 'recusado'].includes(lc.situacao)
  // parte 12: o lançamento automático também se cancela (com o motivo), e a origem volta para "a pagar"
  const podeCancelar = !somenteLeitura && lc !== null && !desfeito
  const volta =
    lc?.origem === 'contribuicao' || lc?.origem === 'taxa_inscricao'
      ? 'A contribuição volta para "em aberto".'
      : lc?.origem === 'inscricao_evento'
        ? 'A inscrição volta a esperar o pagamento.'
        : lc?.origem === 'modelo_exclusivo'
          ? 'O modelo exclusivo volta a esperar o pagamento.'
          : lc?.origem === 'patrimonio'
            ? 'A compra deixa de estar ligada ao bem.'
            : null
  return (
    <li className={desfeito ? 'fin-linha-extrato fin-desfeito' : 'fin-linha-extrato'} aria-label={l.descricao}>
      <span className="linha-corpo">
        <strong>{l.descricao}</strong>
        <span>
          {l.detalhe}
          {lc && lc.situacao === 'efetivado' && lc.tipo === 'saida' && lc.autorizado_por_nome && !lc.transferencia_id && ` · autorizada por ${lc.autorizado_por_nome}`}
        </span>
        {lc && lc.situacao !== 'efetivado' && (
          <span>
            <Chip area={lc.situacao === 'aguardando_autorizacao' ? 'eventos' : 'assembleias'}>{NOME_DA_SITUACAO_LANCAMENTO[lc.situacao]}</Chip>
          </span>
        )}
        {lc && lc.origem && lc.origem !== 'avulso' && lc.origem !== 'transferencia' && (
          <span className="fin-origem">
            De onde veio: {lc.origem_link ? <Link to={lc.origem_link}>{lc.origem_texto}</Link> : lc.origem_texto}
          </span>
        )}
        {lc?.motivo && <span>Motivo: {lc.motivo}</span>}
        {lc?.comprovante_caminho && (
          <span>
            <LinkComprovante caminho={lc.comprovante_caminho} texto="comprovante" />
          </span>
        )}
      </span>
      <Valor tipo={l.tipo === 'saida' ? 'saida' : 'entrada'} valor={l.valor} neutro={l.tipo === 'transferencia'} />
      <span className="fin-saldo-depois">{l.saldoDepois !== undefined ? formatarReais(l.saldoDepois) : ''}</span>
      {podeCancelar && (
        <details className="acao-recolhida fin-linha-largura">
          <summary>Cancelar lançamento</summary>
          <form
            className="form-linha form-compacto"
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => concluir(await cancelarLancamento(lc.id, motivo), volta ? `Lançamento cancelado. ${volta}` : 'Lançamento cancelado.'))
            }}
          >
            {volta && <span className="detalhe">{volta}</span>}
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
  tipo,
  pessoaId,
  contas,
  categorias,
  concluir,
}: {
  tipo: TipoLancamento
  pessoaId: string
  contas: SaldoConta[]
  categorias: CategoriaFinanceira[]
  concluir: (r: { erro: string | null }, sucesso: string, data?: string) => boolean
}) {
  const [contaId, setContaId] = useState(contas.find((c) => c.tipo === 'caixa')?.id ?? contas[0]?.id ?? '')
  const [categoriaId, setCategoriaId] = useState('')
  const [data, setData] = useState(hojeIso())
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const opcoes = categorias.filter((c) => c.tipo === tipo && !c.sistema)
  const inicioDaConta = contas.find((c) => c.id === contaId)?.saldo_inicial_em
  const entrada = tipo === 'entrada'

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
    concluir(r, entrada ? 'Entrada lançada.' : 'Despesa lançada. Ela só sai do saldo depois que o presidente autorizar.', data)
  }

  return (
    <section className="bloco fin-form" aria-labelledby="titulo-novo-lancamento">
      <h2 id="titulo-novo-lancamento">{entrada ? 'Nova entrada' : 'Nova despesa'}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(enviar)
        }}
      >
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
          <input type="date" required min={inicioDaConta} max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
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
          Descrição *
          <input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={entrada ? 'Ex.: Oferta da reunião de novembro' : 'Ex.: Lanche da reunião mensal'} />
        </label>
        <label>
          Comprovante (nota, recibo)
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </label>
        {!entrada && <p className="detalhe">A despesa fica esperando a autorização do presidente (Art. 12, §2º, VI).</p>}
        <Mensagem erro={erro} />
        <button type="submit" className="botao" disabled={enviando}>
          {entrada ? 'Salvar a entrada' : 'Salvar a despesa'}
        </button>
      </form>
    </section>
  )
}

function FormTransferencia({ contas, concluir }: { contas: SaldoConta[]; concluir: Concluir }) {
  const [origem, setOrigem] = useState(contas.find((c) => c.tipo === 'caixa')?.id ?? contas[0]?.id ?? '')
  const [destino, setDestino] = useState(contas.find((c) => c.tipo === 'banco')?.id ?? contas[1]?.id ?? '')
  const [data, setData] = useState(hojeIso())
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const inicio = [origem, destino]
    .map((id) => contas.find((c) => c.id === id)?.saldo_inicial_em ?? '')
    .sort()
    .at(-1)
  return (
    <section className="bloco fin-form" aria-labelledby="titulo-transferencia">
      <h2 id="titulo-transferencia">Transferência entre contas</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const numero = lerValor(valor)
            if (numero === null || numero <= 0) return concluir({ erro: `Valor inválido. ${DICA_VALOR}.` }, '')
            concluir(await transferir(origem, destino, data, numero, descricao), 'Transferência registrada.')
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
          <input required inputMode="decimal" pattern={PADRAO_VALOR} title={DICA_VALOR} value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label>
          Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Depósito das ofertas" />
        </label>
        <p className="detalhe">Não muda o saldo total: o dinheiro só muda de conta.</p>
        <button type="submit" className="botao" disabled={enviando}>
          Transferir
        </button>
      </form>
    </section>
  )
}

/** /financeiro/caixa/contas — as contas com o saldo de cada uma; a tesouraria cria contas e categorias. */
export function ContasESaldos({ somenteLeitura }: { somenteLeitura: boolean }) {
  const [carga, recarregar] = useCarregar(saldos)
  return (
    <>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(contas) => (
          <ul className="fin-contas" aria-label="Contas e saldos">
            {contas.map((c) => (
              <li key={c.id} className="bloco" aria-label={c.nome}>
                <span className="fin-rotulo">{c.tipo === 'caixa' ? 'Dinheiro' : 'Banco'}</span>
                <strong className="fin-conta-nome">{c.nome}</strong>
                <strong className="fin-saldo-total">{formatarReais(c.saldo)}</strong>
                <dl className="definicoes">
                  <dt>Começou em</dt>
                  <dd>
                    {formatarData(c.saldo_inicial_em)}, com {formatarReais(c.saldo_inicial)}
                  </dd>
                  <dt>Entradas</dt>
                  <dd className="valor-entrada">+ {formatarReais(c.entradas)}</dd>
                  <dt>Saídas</dt>
                  <dd className="valor-saida">− {formatarReais(c.saidas)}</dd>
                  {Number(c.aguardando_autorizacao) > 0 && (
                    <>
                      <dt>Esperando o presidente</dt>
                      <dd>{formatarReais(c.aguardando_autorizacao)}</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </MostrarCarga>
      {somenteLeitura ? (
        <p className="detalhe">As contas e as categorias são da tesouraria e da presidência.</p>
      ) : (
        <ContasECategorias />
      )}
    </>
  )
}

/** /financeiro/caixa/transferencias — as transferências entre contas (o dinheiro que muda de conta). */
export function Transferencias({ concluir, somenteLeitura }: { concluir: Concluir; somenteLeitura: boolean }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [contas, lista] = await Promise.all([saldos(), listarTransferencias(100)])
    if (contas.erro !== null) return contas
    if (lista.erro !== null) return lista
    return ok({ contas: contas.dados, lista: lista.dados })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ contas, lista }) => {
        const pares = new Map<string, LinhaCaixa[]>()
        for (const l of lista) if (l.transferencia_id) pares.set(l.transferencia_id, [...(pares.get(l.transferencia_id) ?? []), l])
        const linhas = [...pares.values()].map((lados) => ({ sai: lados.find((l) => l.tipo === 'saida') ?? lados[0], entra: lados.find((l) => l.tipo === 'entrada') }))
        return (
          <div className="fin-duas">
            <section className="bloco" aria-labelledby="titulo-transferencias">
              <h2 id="titulo-transferencias">As últimas transferências</h2>
              {linhas.length === 0 ? (
                <p className="vazio">Nenhuma transferência ainda.</p>
              ) : (
                <ul className="lista-linhas" aria-label="Transferências">
                  {linhas.map(({ sai, entra }) => (
                    <li key={sai.transferencia_id} aria-label={sai.descricao} className={sai.situacao === 'cancelado' ? 'fin-desfeito' : undefined}>
                      <span className="linha-corpo">
                        <strong>{sai.descricao}</strong>
                        <span>
                          {formatarData(sai.data)} · {sai.conta_nome} → {entra?.conta_nome ?? '?'}
                          {sai.situacao === 'cancelado' && ` · cancelada${sai.motivo ? `: ${sai.motivo}` : ''}`}
                        </span>
                      </span>
                      <span className="fin-valor">{formatarReais(sai.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="detalhe">
                A transferência não é receita nem despesa: não muda o saldo total. Para cancelar, use o{' '}
                <Link to={`/financeiro/caixa?mes=${hojeIso().slice(0, 7)}`}>extrato do mês</Link>.
              </p>
            </section>
            {!somenteLeitura && contas.length > 1 && <FormTransferencia contas={contas} concluir={concluirERecarregar} />}
          </div>
        )
      }}
    </MostrarCarga>
  )
}
