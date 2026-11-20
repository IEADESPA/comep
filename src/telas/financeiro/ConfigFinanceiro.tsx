import { useState } from 'react'
import { BotaoArquivar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  alterarConta,
  arquivarCategoriaFinanceira,
  criarCategoriaFinanceira,
  criarConta,
  listarCategoriasFinanceiras,
  saldos,
  type TipoLancamento,
} from '../../dados/caixa'
import {
  arquivarValor,
  buscarPrazoTaxaInscricao,
  CATEGORIAS,
  definirTaxaInscricao,
  formatarReais,
  lancarValor,
  listarValores,
  NOME_DA_CATEGORIA,
  NOME_DO_TIPO_VALOR,
  textoDoValor,
  TIPOS_VALOR,
  type CategoriaContribuicao,
  type NovoValor,
  type TipoValor,
  type ValorContribuicao,
} from '../../dados/configuracoes'
import { buscarConfigFinanceiro, salvarConfigFinanceiro } from '../../dados/financeiro'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { DICA_VALOR, lerValor, PADRAO_VALOR, valorParaCampo } from '../../utilitarios/valores'

// As configurações do dinheiro: os valores da contribuição, a taxa de inscrição, os vencimentos e as contas e
// categorias do caixa. Aparecem em Administração › Configurações e também no Financeiro (telas novas, Fase 5.5,
// parte 9): Contribuições › Valores e planos e Caixa › Contas e saldos.

type Retorno = { sucesso?: string; erro?: string }

// ---------------------------------------------------------------------
// Valores da contribuição
// ---------------------------------------------------------------------

export function Valores({ podeEditar, aoMudar }: { podeEditar: boolean; aoMudar: () => void }) {
  const [carga, recarregar] = useCarregar(listarValores)
  const [retorno, setRetorno] = useState<Retorno>({})

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) {
      recarregar()
      aoMudar()
    }
    return r.erro === null
  }

  const valorVigente = (vigentes: ValorContribuicao[], categoria: CategoriaContribuicao, tipo: TipoValor) =>
    vigentes.find((v) => v.categoria === categoria && v.tipo === tipo)

  return (
    <section className="painel" id="valores" aria-labelledby="titulo-valores">
      <h2 id="titulo-valores">Valores da contribuição</h2>
      <p className="detalhe">
        Definidos pela Assembleia Ordinária (Art. 7º, §3º). Um valor novo não apaga o anterior: passa a valer na data de
        início, e o histórico fica guardado. O presidente de igreja é quem tem esse perfil (pastor presidente marcado na
        ficha do ministro).
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ vigentes, historico }) => (
          <>
            <ul className="lista" aria-label="Valores em vigor">
              {CATEGORIAS.map((categoria) => (
                <li key={categoria} className="lista-item lista-item-estatico" aria-label={NOME_DA_CATEGORIA[categoria]}>
                  <strong>{NOME_DA_CATEGORIA[categoria]}</strong>
                  <span>
                    {TIPOS_VALOR.map((tipo) => {
                      const v = valorVigente(vigentes, categoria, tipo)
                      return (
                        <span key={tipo} className="valor-linha">
                          {NOME_DO_TIPO_VALOR[tipo]}: <strong>{v ? textoDoValor(tipo, v.valor) : 'não definido'}</strong>
                        </span>
                      )
                    })}
                  </span>
                </li>
              ))}
            </ul>

            {podeEditar && <LancarValor aoLancar={(r, texto) => concluir(r, texto)} />}

            <details className="acao-recolhida">
              <summary>Histórico de valores ({historico.length})</summary>
              <ul className="lista-simples" aria-label="Histórico de valores">
                {historico.map((v) => (
                  <li key={v.id}>
                    <span>
                      {NOME_DA_CATEGORIA[v.categoria]} · {NOME_DO_TIPO_VALOR[v.tipo]}:{' '}
                      <strong>{textoDoValor(v.tipo, v.valor)}</strong> desde {formatarData(v.vigente_desde)}
                      {v.aprovado_em_assembleia && ` · assembleia de ${formatarData(v.aprovado_em_assembleia)}`}
                      {v.ata && ` · ata ${v.ata}`}
                      {v.observacao && <span className="detalhe"> — {v.observacao}</span>}
                    </span>
                    {podeEditar && (
                      <BotaoArquivar
                        rotulo={`Arquivar o valor ${NOME_DA_CATEGORIA[v.categoria]} ${NOME_DO_TIPO_VALOR[v.tipo]} de ${formatarData(v.vigente_desde)}`}
                        aoConfirmar={async () => concluir(await arquivarValor(v.id), 'Valor arquivado.')}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

function LancarValor({ aoLancar }: { aoLancar: (r: { erro: string | null }, texto: string) => boolean }) {
  const vazio: NovoValor = {
    categoria: 'nao_presidente',
    tipo: 'mensal',
    valor: 0,
    vigente_desde: hojeIso(),
    aprovado_em_assembleia: '',
    ata: '',
    observacao: '',
  }
  const [novo, setNovo] = useState<NovoValor>(vazio)
  const [valorTexto, setValorTexto] = useState('')
  const [enviando, umaVez] = useUmaVez()

  async function lancar() {
    const valor = lerValor(valorTexto)
    if (valor === null || valor < 0) return aoLancar({ erro: `Valor inválido. ${DICA_VALOR}.` }, '')
    const r = await lancarValor({ ...novo, valor })
    const texto = `Valor lançado: ${NOME_DA_CATEGORIA[novo.categoria]} · ${NOME_DO_TIPO_VALOR[novo.tipo]} = ${formatarReais(valor)} a partir de ${formatarData(novo.vigente_desde)}.`
    if (aoLancar(r, texto)) {
      setNovo(vazio)
      setValorTexto('')
    }
  }

  return (
    <details className="acao-recolhida">
      <summary>Lançar novo valor</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(lancar)
        }}
      >
        <div className="grade-form">
          <label>
            Categoria
            <select
              value={novo.categoria}
              onChange={(e) => setNovo({ ...novo, categoria: e.target.value as CategoriaContribuicao })}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {NOME_DA_CATEGORIA[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as TipoValor })}>
              {TIPOS_VALOR.map((t) => (
                <option key={t} value={t}>
                  {NOME_DO_TIPO_VALOR[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor (R$)
            <input
              required
              inputMode="decimal"
              pattern={PADRAO_VALOR}
              title={DICA_VALOR}
              placeholder="0,00"
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value)}
            />
          </label>
          <label>
            Vale a partir de
            <input
              type="date"
              required
              value={novo.vigente_desde}
              onChange={(e) => setNovo({ ...novo, vigente_desde: e.target.value })}
            />
          </label>
          <label>
            Aprovado na assembleia de
            <input
              type="date"
              max={hojeIso()}
              value={novo.aprovado_em_assembleia ?? ''}
              onChange={(e) => setNovo({ ...novo, aprovado_em_assembleia: e.target.value })}
            />
          </label>
          <label>
            Ata
            <input value={novo.ata ?? ''} onChange={(e) => setNovo({ ...novo, ata: e.target.value })} />
          </label>
          <label className="largura-total">
            Observação
            <input value={novo.observacao ?? ''} onChange={(e) => setNovo({ ...novo, observacao: e.target.value })} />
          </label>
        </div>
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Lançar valor
          </button>
        </div>
      </form>
    </details>
  )
}

// ---------------------------------------------------------------------
// Vencimentos das contribuições (decisão 18 — padrões provisórios)
// ---------------------------------------------------------------------

export function Vencimentos({ podeEditar }: { podeEditar: boolean }) {
  const [carga, recarregar] = useCarregar(buscarConfigFinanceiro)
  const [retorno, setRetorno] = useState<Retorno>({})
  return (
    <section className="painel" id="vencimentos" aria-labelledby="titulo-vencimentos">
      <h2 id="titulo-vencimentos">Vencimentos</h2>
      <p className="detalhe">
        Valem para as cobranças geradas daqui em diante. Padrão provisório até a diretoria decidir (pergunta 18): mensalidade
        no dia 10 e anuidade em 30 de abril.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(config) => (
          <form
            className="form-linha"
            onSubmit={async (e) => {
              e.preventDefault()
              const dados = new FormData(e.currentTarget)
              const r = await salvarConfigFinanceiro({
                dia_vencimento_mensal: Number(dados.get('mensal')),
                dia_vencimento_anual: Number(dados.get('anual')),
              })
              setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Vencimentos salvos.' })
            }}
          >
            <label className="campo-curto">
              Dia do mês (mensalidade)
              <input name="mensal" type="number" min={1} max={28} required defaultValue={config.dia_vencimento_mensal} disabled={!podeEditar} />
            </label>
            <label className="campo-curto">
              Anuidade: dia de abril enquanto a AGO não é convocada
              <input name="anual" type="number" min={1} max={30} required defaultValue={config.dia_vencimento_anual} disabled={!podeEditar} />
            </label>
            <p className="detalhe largura-total">
              Convocada a AGO de abril, a anuidade vence na data dela (14/11/2026): o associado tem os dias do edital para pagar.
            </p>
            {podeEditar && (
              <button type="submit" className="botao">
                Salvar vencimentos
              </button>
            )}
          </form>
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

// ---------------------------------------------------------------------
// Taxa de inscrição (isenta hoje; a assembleia pode definir um valor)
// ---------------------------------------------------------------------

export function TaxaInscricao({ podeEditar, aoMudar }: { podeEditar: boolean; aoMudar: () => void }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [valores, prazo] = await Promise.all([listarValores(), buscarPrazoTaxaInscricao()])
    if (valores.erro !== null) return valores
    if (prazo.erro !== null) return prazo
    return { dados: { ...valores.dados, prazo: prazo.dados }, erro: null }
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [valor, setValor] = useState('')
  const [desde, setDesde] = useState(hojeIso())
  const [assembleia, setAssembleia] = useState('')
  const [ata, setAta] = useState('')
  const [prazo, setPrazo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const hoje = hojeIso()

  return (
    <section className="painel" id="inscricao" aria-labelledby="titulo-inscricao">
      <h2 id="titulo-inscricao">Taxa de inscrição</h2>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ vigentes, historico, prazo: prazoAtual }) => {
          const deHoje = (categoria: CategoriaContribuicao) =>
            vigentes.find((v) => v.categoria === categoria && v.tipo === 'inscricao')
          const presidente = deHoje('presidente_igreja')
          const outros = deHoje('nao_presidente')
          const iguais = Number(presidente?.valor ?? 0) === Number(outros?.valor ?? 0)
          const futuras = historico
            .filter((v) => v.tipo === 'inscricao' && v.categoria !== 'jubilado' && v.vigente_desde > hoje)
            .sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde))
          return (
            <>
              <p className="taxa-hoje">
                Hoje:{' '}
                {iguais ? (
                  <strong>{textoDoValor('inscricao', presidente?.valor ?? 0)}</strong>
                ) : (
                  <>
                    <strong>{textoDoValor('inscricao', presidente?.valor ?? 0)}</strong> (presidente de igreja) e{' '}
                    <strong>{textoDoValor('inscricao', outros?.valor ?? 0)}</strong> (não presidente)
                  </>
                )}
                {presidente?.aprovado_em_assembleia && ` · assembleia de ${formatarData(presidente.aprovado_em_assembleia)}`}
              </p>
              {futuras.length > 0 && (
                <ul className="lista-simples" aria-label="Taxa de inscrição programada">
                  {futuras.map((v) => (
                    <li key={v.id}>
                      <span>
                        A partir de {formatarData(v.vigente_desde)}: <strong>{textoDoValor('inscricao', v.valor)}</strong> (
                        {NOME_DA_CATEGORIA[v.categoria].toLowerCase()})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="detalhe">
                O valor é decidido pela assembleia (Art. 7º, §3º). Quando houver valor, ele é cobrado uma vez de quem for
                admitido pela assembleia (pedido de associação aprovado), com prazo de {prazoAtual} dias para pagar. Quem
                entrou no cadastro inicial não paga, e o jubilado é isento.
              </p>

              {podeEditar && (
                <details className="acao-recolhida">
                  <summary>Personalizar a taxa de inscrição</summary>
                  <form
                    aria-label="Personalizar a taxa de inscrição"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const numero = lerValor(valor)
                      if (numero === null || numero < 0) return setRetorno({ erro: `Valor inválido. ${DICA_VALOR}.` })
                      setEnviando(true)
                      const r = await definirTaxaInscricao({
                        valor: numero,
                        vigenteDesde: desde,
                        assembleia,
                        ata,
                        prazoDias: Number(prazo || prazoAtual),
                      })
                      setEnviando(false)
                      if (r.erro !== null) return setRetorno({ erro: r.erro })
                      setRetorno({
                        sucesso: `Taxa de inscrição: ${textoDoValor('inscricao', numero)} a partir de ${formatarData(desde)}.`,
                      })
                      setValor('')
                      setAta('')
                      setAssembleia('')
                      recarregar()
                      aoMudar()
                    }}
                  >
                    <div className="grade-form">
                      <label>
                        Valor da taxa (R$)
                        <input
                          required
                          inputMode="decimal"
                          pattern={PADRAO_VALOR}
              title={DICA_VALOR}
                          placeholder="0 = isenta"
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                        />
                      </label>
                      <label>
                        Vale para quem for admitido a partir de
                        <input type="date" required value={desde} onChange={(e) => setDesde(e.target.value)} />
                      </label>
                      <label>
                        Aprovada na assembleia de
                        <input type="date" max={hoje} value={assembleia} onChange={(e) => setAssembleia(e.target.value)} />
                      </label>
                      <label>
                        Ata da assembleia
                        <input value={ata} onChange={(e) => setAta(e.target.value)} placeholder="Ex.: Ata 3/2027" />
                      </label>
                      <label>
                        Prazo para pagar (dias depois da admissão)
                        <input
                          type="number"
                          min={1}
                          max={365}
                          placeholder={String(prazoAtual)}
                          value={prazo}
                          onChange={(e) => setPrazo(e.target.value)}
                        />
                      </label>
                    </div>
                    <p className="detalhe">
                      Vale para presidente e não presidente de igreja. O valor anterior não se apaga: fica no histórico dos
                      valores da contribuição.
                    </p>
                    <div className="acoes">
                      <button type="submit" className="botao" disabled={enviando}>
                        Salvar taxa de inscrição
                      </button>
                    </div>
                  </form>
                </details>
              )}
            </>
          )
        }}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}


// ---------------------------------------------------------------------
// Contas e categorias do caixa (tesouraria e presidência)
// ---------------------------------------------------------------------

export function ContasECategorias() {
  const [carga, recarregar] = useCarregar(async () => {
    const [contas, categorias] = await Promise.all([saldos(), listarCategoriasFinanceiras()])
    if (contas.erro !== null) return contas
    if (categorias.erro !== null) return categorias
    return { dados: { contas: contas.dados, categorias: categorias.dados }, erro: null }
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [nomeConta, setNomeConta] = useState('')
  const [tipoConta, setTipoConta] = useState<'caixa' | 'banco'>('banco')
  const [saldoInicial, setSaldoInicial] = useState('0')
  const [desde, setDesde] = useState(hojeIso())
  const [nomeCategoria, setNomeCategoria] = useState('')
  const [tipoCategoria, setTipoCategoria] = useState<TipoLancamento>('saida')
  const [enviando, umaVez] = useUmaVez()

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
    return r.erro === null
  }

  return (
    <section className="painel" id="caixa" aria-labelledby="titulo-caixa-config">
      <h2 id="titulo-caixa-config">Contas e categorias do caixa</h2>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ contas, categorias }) => (
          <>
            <h3>Contas</h3>
            <ul className="lista-simples" aria-label="Contas do caixa">
              {contas.map((c) => (
                <li key={c.id}>
                  <span>
                    {c.nome} <span className="detalhe">({c.tipo === 'caixa' ? 'dinheiro' : 'banco'})</span>
                  </span>
                  <span className="detalhe">
                    saldo inicial {formatarReais(c.saldo_inicial)} em {formatarData(c.saldo_inicial_em)}
                  </span>
                  <AjustarSaldo conta={c} concluir={concluir} />
                </li>
              ))}
            </ul>
            <form
              className="form-linha"
              aria-label="Nova conta"
              onSubmit={(e) => {
                e.preventDefault()
                void umaVez(async () => {
                  const saldo = lerValor(saldoInicial)
                  if (saldo === null) return concluir({ erro: `Saldo inicial inválido. ${DICA_VALOR}.` }, '')
                  if (concluir(await criarConta(nomeConta, tipoConta, saldo, desde), `Conta "${nomeConta.trim()}" criada.`)) {
                    setNomeConta('')
                  }
                })
              }}
            >
              <label>
                Nova conta
                <input required value={nomeConta} onChange={(e) => setNomeConta(e.target.value)} placeholder="Ex.: Banco do Brasil — c/c" />
              </label>
              <label className="campo-curto">
                Tipo
                <select value={tipoConta} onChange={(e) => setTipoConta(e.target.value as 'caixa' | 'banco')}>
                  <option value="banco">Banco</option>
                  <option value="caixa">Dinheiro</option>
                </select>
              </label>
              <label className="campo-curto">
                Saldo inicial
                <input
                  inputMode="decimal"
                  pattern={PADRAO_VALOR}
                  title={DICA_VALOR}
                  value={saldoInicial}
                  onChange={(e) => setSaldoInicial(e.target.value)}
                />
              </label>
              <label className="campo-curto">
                Em
                <input type="date" required max={hojeIso()} value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <button type="submit" className="botao" disabled={enviando}>
                Criar conta
              </button>
            </form>

            {(['entrada', 'saida'] as const).map((tipo) => (
              <div key={tipo}>
                <h3>{tipo === 'entrada' ? 'Categorias de entrada (Art. 17)' : 'Categorias de saída'}</h3>
                <ul className="lista-simples" aria-label={tipo === 'entrada' ? 'Categorias de entrada' : 'Categorias de saída'}>
                  {categorias
                    .filter((c) => c.tipo === tipo)
                    .map((c) => (
                      <li key={c.id}>
                        <span>
                          {c.nome}
                          {c.sistema && <span className="detalhe"> (automática)</span>}
                        </span>
                        {!c.sistema && (
                          <BotaoArquivar
                            rotulo={`Arquivar a categoria ${c.nome}`}
                            aoConfirmar={async () =>
                              concluir(await arquivarCategoriaFinanceira(c.id), `Categoria "${c.nome}" arquivada.`)
                            }
                          />
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            <form
              className="form-linha"
              aria-label="Nova categoria"
              onSubmit={async (e) => {
                e.preventDefault()
                if (concluir(await criarCategoriaFinanceira(nomeCategoria, tipoCategoria), `Categoria "${nomeCategoria.trim()}" criada.`)) {
                  setNomeCategoria('')
                }
              }}
            >
              <label>
                Nova categoria
                <input required value={nomeCategoria} onChange={(e) => setNomeCategoria(e.target.value)} />
              </label>
              <label className="campo-curto">
                Tipo
                <select value={tipoCategoria} onChange={(e) => setTipoCategoria(e.target.value as TipoLancamento)}>
                  <option value="saida">Saída</option>
                  <option value="entrada">Entrada</option>
                </select>
              </label>
              <button type="submit" className="botao">
                Adicionar
              </button>
            </form>
          </>
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

/** Ajusta o saldo inicial de uma conta. O banco recusa se o período dela já foi fechado na prestação de contas. */
function AjustarSaldo({
  conta,
  concluir,
}: {
  conta: { id: string; nome: string; saldo_inicial: number; saldo_inicial_em: string }
  concluir: (r: { erro: string | null }, sucesso: string) => boolean
}) {
  const [valor, setValor] = useState(valorParaCampo(conta.saldo_inicial))
  const [desde, setDesde] = useState(conta.saldo_inicial_em)
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Ajustar saldo inicial</summary>
      <form
        className="form-linha form-compacto"
        aria-label={`Ajustar o saldo inicial de ${conta.nome}`}
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const numero = lerValor(valor)
            if (numero === null) return concluir({ erro: `Saldo inicial inválido. ${DICA_VALOR}.` }, '')
            concluir(
              await alterarConta(conta.id, { nome: conta.nome, saldo_inicial: numero, saldo_inicial_em: desde }),
              `Saldo inicial de "${conta.nome}" ajustado.`,
            )
          })
        }}
      >
        <label className="campo-curto">
          Saldo inicial (R$)
          <input
            required
            inputMode="decimal"
            pattern={PADRAO_VALOR}
            title={DICA_VALOR}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
        <label className="campo-curto">
          Em
          <input type="date" required max={hojeIso()} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Salvar
        </button>
      </form>
      <p className="detalhe">Depois que o exercício é fechado na prestação de contas, o saldo inicial não muda mais.</p>
    </details>
  )
}

