import { useState } from 'react'
import { Link } from 'react-router'
import { BotaoArquivar, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  alterarItem,
  arquivarItem,
  arquivarValor,
  buscarPrazoTaxaInscricao,
  CATEGORIAS,
  criarItem,
  definirTaxaInscricao,
  formatarReais,
  lancarValor,
  listarItens,
  listarValores,
  NOME_DA_CATEGORIA,
  NOME_DO_TIPO_VALOR,
  textoDoValor,
  TIPOS_VALOR,
  type CategoriaContribuicao,
  type ItemLista,
  type NovoValor,
  type TabelaLista,
  type TipoValor,
  type ValorContribuicao,
} from '../../dados/configuracoes'
import type { Perfil } from '../../dados/perfis'
import { buscarDadosComep, CAMPOS_DADOS_COMEP, salvarDadosComep, type DadosComep } from '../../dados/site'
import { buscarConfigFinanceiro, salvarConfigFinanceiro } from '../../dados/financeiro'
import {
  alterarConta,
  arquivarCategoriaFinanceira,
  criarCategoriaFinanceira,
  criarConta,
  listarCategoriasFinanceiras,
  saldos,
  type TipoLancamento,
} from '../../dados/caixa'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { buscarConfigCredencial, corrigirFimMandato, registrarNovoMandato, salvarTextoVerso } from '../../dados/credencial'
import { buscarConfigAssembleias, salvarConfigAssembleias, type ConfigAssembleias } from '../../dados/encontros'
import { DICA_VALOR, lerValor, PADRAO_VALOR, valorParaCampo } from '../../utilitarios/valores'
import { cnpjValido, formatarCnpj, formatarData, hojeIso, limparCnpj } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }

/** Mesmas regras do banco (RLS): quem pode mexer em cada parte. */
const EDITAM_LISTAS: readonly Perfil[] = ['secretaria', 'presidencia', 'admin_tecnico']
const EDITAM_VALORES: readonly Perfil[] = ['tesouraria', 'presidencia']

export function Configuracoes() {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const editaListas = perfis.some((p) => EDITAM_LISTAS.includes(p))
  const editaValores = perfis.some((p) => EDITAM_VALORES.includes(p))
  // A taxa de inscrição grava em "valores": a seção de valores recarrega junto
  const [versaoValores, setVersaoValores] = useState(0)
  const [versaoTaxa, setVersaoTaxa] = useState(0)

  return (
    <>
      <h1>Configurações</h1>
      <p className="detalhe">
        As listas e os valores que o sistema usa. Arquivar um item tira ele das opções, mas não apaga nada: o que já usava
        esse item continua guardado.
      </p>

      <nav className="atalhos-secao" aria-label="Partes das configurações">
        <a href="#site">Dados do COMEP no site</a>
        <a href="#denominacoes">Denominações</a>
        <a href="#bairros">Bairros</a>
        <a href="#titulos">Títulos de ministro</a>
        <a href="#valores">Valores da contribuição</a>
        <a href="#inscricao">Taxa de inscrição</a>
        <a href="#credencial">Credencial</a>
        <a href="#assembleias">Assembleias e reuniões</a>
        <a href="#vencimentos">Vencimentos</a>
        {editaValores && <a href="#caixa">Contas e categorias do caixa</a>}
      </nav>

      <DadosDoSite podeEditar={editaListas} />
      {/* as denominações foram para o módulo Igrejas, com a tradição (telas novas, Fase 5.5) */}
      <section className="painel" id="denominacoes" aria-labelledby="titulo-denominacoes-config">
        <h2 id="titulo-denominacoes-config">Denominações (tipos de igreja)</h2>
        <p className="detalhe">
          As denominações agora ficam no módulo Igrejas, com a tradição de cada uma: <Link to="/igrejas/denominacoes">Igrejas › Denominações</Link>.
        </p>
      </section>
      <ListaConfiguravel
        tabela="bairros"
        ancora="bairros"
        titulo="Bairros"
        descricao="Bairros de Parauapebas, usados no cadastro das igrejas."
        podeEditar={editaListas}
      />
      <ListaConfiguravel
        tabela="titulos_ministeriais"
        ancora="titulos"
        titulo="Títulos de ministro"
        descricao="Títulos aceitos pelo Conselho (Art. 7º). A ordem é a mesma das listas de escolha."
        comOrdem
        podeEditar={editaListas}
      />
      <Valores key={`valores-${versaoValores}`} podeEditar={editaValores} aoMudar={() => setVersaoTaxa((v) => v + 1)} />
      <TaxaInscricao key={`taxa-${versaoTaxa}`} podeEditar={editaValores} aoMudar={() => setVersaoValores((v) => v + 1)} />
      <Vencimentos podeEditar={editaValores} />
      <ConfigCredencialSecao podeEditar={perfis.some((p) => p === 'secretaria' || p === 'presidencia')} />
      {/* as regras (números do estatuto) são da presidência; a secretaria só vê */}
      <RegrasAssembleias podeEditar={perfis.includes('presidencia')} />
      {editaValores && <ContasECategorias />}
    </>
  )
}

// ---------------------------------------------------------------------
// Listas (denominações, bairros, títulos)
// ---------------------------------------------------------------------

type PropsLista = {
  tabela: TabelaLista
  ancora: string
  titulo: string
  descricao: string
  comSigla?: boolean
  comOrdem?: boolean
  podeEditar: boolean
}

function ListaConfiguravel({ tabela, ancora, titulo, descricao, comSigla, comOrdem, podeEditar }: PropsLista) {
  const [carga, recarregar] = useCarregar(() => listarItens(tabela))
  const [retorno, setRetorno] = useState<Retorno>({})
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
    return r.erro === null
  }

  async function adicionar(itens: ItemLista[]) {
    setEnviando(true)
    const proximaOrdem = Math.max(0, ...itens.map((i) => i.ordem ?? 0)) + 10
    const r = await criarItem(tabela, {
      nome,
      ...(comSigla ? { sigla } : {}),
      ...(comOrdem ? { ordem: proximaOrdem } : {}),
    })
    setEnviando(false)
    if (concluir(r, `"${nome.trim()}" adicionado.`)) {
      setNome('')
      setSigla('')
    }
  }

  async function arquivar(item: ItemLista) {
    concluir(await arquivarItem(tabela, item.id), `"${item.nome}" arquivado.`)
  }

  return (
    <section className="painel" id={ancora} aria-labelledby={`titulo-${ancora}`}>
      <h2 id={`titulo-${ancora}`}>{titulo}</h2>
      <p className="detalhe">{descricao}</p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(itens) => (
          <>
            {itens.length === 0 ? (
              <p className="vazio">Nenhum item ainda.</p>
            ) : (
              <ul className="lista-simples" aria-label={titulo}>
                {itens.map((item) =>
                  editando === item.id ? (
                    <li key={item.id}>
                      <EditarItem
                        item={item}
                        comSigla={comSigla}
                        comOrdem={comOrdem}
                        aoCancelar={() => setEditando(null)}
                        aoSalvar={async (dados) => {
                          const certo = concluir(await alterarItem(tabela, item.id, dados), 'Alteração salva.')
                          if (certo) setEditando(null)
                        }}
                      />
                    </li>
                  ) : (
                    <li key={item.id}>
                      <span>
                        {item.nome}
                        {item.sigla && <span className="detalhe"> ({item.sigla})</span>}
                      </span>
                      {podeEditar && (
                        <span className="acoes-item">
                          <button
                            type="button"
                            className="botao-texto"
                            aria-label={`Alterar ${item.nome}`}
                            onClick={() => setEditando(item.id)}
                          >
                            Alterar
                          </button>
                          <button
                            type="button"
                            className="botao-texto"
                            aria-label={`Arquivar ${item.nome}`}
                            onClick={() => void arquivar(item)}
                          >
                            Arquivar
                          </button>
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            )}

            {podeEditar && (
              <form
                className="form-linha"
                aria-label={`Adicionar em ${titulo}`}
                onSubmit={(e) => {
                  e.preventDefault()
                  void adicionar(itens)
                }}
              >
                <label>
                  Novo item
                  <input required value={nome} onChange={(e) => setNome(e.target.value)} />
                </label>
                {comSigla && (
                  <label>
                    Sigla (opcional)
                    <input value={sigla} onChange={(e) => setSigla(e.target.value)} />
                  </label>
                )}
                <button type="submit" className="botao" disabled={enviando}>
                  Adicionar
                </button>
              </form>
            )}
          </>
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

function EditarItem({
  item,
  comSigla,
  comOrdem,
  aoSalvar,
  aoCancelar,
}: {
  item: ItemLista
  comSigla?: boolean
  comOrdem?: boolean
  aoSalvar: (dados: Omit<ItemLista, 'id'>) => Promise<void>
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(item.nome)
  const [sigla, setSigla] = useState(item.sigla ?? '')
  const [ordem, setOrdem] = useState(String(item.ordem ?? 100))

  return (
    <form
      className="form-linha form-compacto"
      aria-label={`Alterar ${item.nome}`}
      onSubmit={(e) => {
        e.preventDefault()
        void aoSalvar({
          nome,
          ...(comSigla ? { sigla } : {}),
          ...(comOrdem ? { ordem: Number(ordem) || 100 } : {}),
        })
      }}
    >
      <label>
        Nome
        <input required value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      {comSigla && (
        <label>
          Sigla
          <input value={sigla} onChange={(e) => setSigla(e.target.value)} />
        </label>
      )}
      {comOrdem && (
        <label className="campo-curto">
          Posição
          <input type="number" min={0} step={1} value={ordem} onChange={(e) => setOrdem(e.target.value)} />
        </label>
      )}
      <button type="submit" className="botao">
        Salvar
      </button>
      <button type="button" className="botao botao-secundario" onClick={aoCancelar}>
        Cancelar
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------
// Valores da contribuição
// ---------------------------------------------------------------------

function Valores({ podeEditar, aoMudar }: { podeEditar: boolean; aoMudar: () => void }) {
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
// Dados do COMEP no site (decisão 14): o que estiver vazio aparece como "—"
// ---------------------------------------------------------------------

function DadosDoSite({ podeEditar }: { podeEditar: boolean }) {
  const [carga, recarregar] = useCarregar(buscarDadosComep)
  return (
    <section className="painel" id="site" aria-labelledby="titulo-site">
      <h2 id="titulo-site">Dados do COMEP no site</h2>
      <p className="detalhe">
        Aparecem na página inicial (Fale com o COMEP) e no rodapé. O que ficar em branco aparece como "—".
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(dados) => <FormDadosDoSite inicial={dados} podeEditar={podeEditar} />}
      </MostrarCarga>
    </section>
  )
}

function FormDadosDoSite({ inicial, podeEditar }: { inicial: DadosComep; podeEditar: boolean }) {
  const [dados, setDados] = useState<DadosComep>({ ...inicial, cnpj: formatarCnpj(inicial.cnpj) || null })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, setEnviando] = useState(false)

  async function salvar() {
    const cnpj = dados.cnpj ? limparCnpj(dados.cnpj) : ''
    if (cnpj && !cnpjValido(cnpj)) {
      setRetorno({ erro: 'CNPJ inválido. Confira os números ou deixe em branco.' })
      return
    }
    setEnviando(true)
    const r = await salvarDadosComep({ ...dados, cnpj: cnpj || null })
    setEnviando(false)
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Dados do site salvos. Já aparecem na página inicial.' })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void salvar()
      }}
    >
      <div className="grade-form">
        {CAMPOS_DADOS_COMEP.map(({ campo, rotulo, dica }) => (
          <label key={campo} className={campo === 'endereco_sede' || campo === 'reunioes_mensais' ? 'largura-total' : ''}>
            {rotulo}
            <input
              value={dados[campo] ?? ''}
              placeholder={dica}
              disabled={!podeEditar}
              type={campo === 'email' ? 'email' : 'text'}
              onChange={(e) => setDados((d) => ({ ...d, [campo]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {podeEditar && (
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar dados do site
          </button>
        </div>
      )}
    </form>
  )
}

// ---------------------------------------------------------------------
// Vencimentos das contribuições (decisão 18 — padrões provisórios)
// ---------------------------------------------------------------------

function Vencimentos({ podeEditar }: { podeEditar: boolean }) {
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

function TaxaInscricao({ podeEditar, aoMudar }: { podeEditar: boolean; aoMudar: () => void }) {
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

function ContasECategorias() {
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

// ---------------------------------------------------------------------
// Credencial: fim do mandato (validade), texto do verso e a posse de uma nova diretoria
// ---------------------------------------------------------------------

function ConfigCredencialSecao({ podeEditar }: { podeEditar: boolean }) {
  const [carga, recarregar] = useCarregar(buscarConfigCredencial)
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel" id="credencial" aria-labelledby="titulo-config-credencial">
      <h2 id="titulo-config-credencial">Credencial</h2>
      <p className="detalhe">
        A credencial traz a validade: o fim do mandato da diretoria em curso. A digital passa sozinha para o mandato
        seguinte. A impressa vale até a data que está nela: depois da posse da nova diretoria, é impressa de novo.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(config) => (
          <>
            <form
              key={`fim-${config.fim_mandato ?? ''}`}
              aria-label="Fim do mandato"
              className="form-linha"
              onSubmit={(e) => {
                e.preventDefault()
                const fim = String(new FormData(e.currentTarget).get('fim_mandato') ?? '')
                void umaVez(async () => {
                  const r = await corrigirFimMandato(fim, config.fim_mandato)
                  setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Fim do mandato corrigido.' })
                  if (r.erro === null) recarregar()
                })
              }}
            >
              <label>
                Fim do mandato da diretoria em curso
                <input name="fim_mandato" type="date" defaultValue={config.fim_mandato ?? ''} disabled={!podeEditar} />
              </label>
              {podeEditar && (
                <button type="submit" className="botao" disabled={enviando}>
                  Corrigir a data
                </button>
              )}
            </form>
            <p className="detalhe">
              Mudar a data aqui só <strong>corrige</strong> o mandato em curso: todas as credenciais dele acompanham (a
              digital e o QR Code). As já impressas continuam com a data antiga no papel: se a data mudou, imprima de novo.
              Em branco, a credencial vale enquanto o associado estiver ativo.
            </p>
            <form
              key={`verso-${config.texto_verso}`}
              aria-label="Texto do verso"
              onSubmit={(e) => {
                e.preventDefault()
                const texto = String(new FormData(e.currentTarget).get('texto_verso') ?? '')
                void umaVez(async () => {
                  const r = await salvarTextoVerso(texto)
                  setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Texto do verso salvo.' })
                  if (r.erro === null) recarregar()
                })
              }}
            >
              <label className="largura-total">
                Texto do verso
                <textarea name="texto_verso" rows={3} maxLength={600} required defaultValue={config.texto_verso} disabled={!podeEditar} />
              </label>
              {podeEditar && (
                <div className="acoes">
                  <button type="submit" className="botao" disabled={enviando}>
                    Salvar o texto do verso
                  </button>
                </div>
              )}
            </form>
            {podeEditar && (
              <p>
                <Link to="/credenciais/modelo">Editar o modelo (desenho) da credencial</Link>
              </p>
            )}
            {podeEditar && config.fim_mandato && (
              <NovoMandato
                fimAtual={config.fim_mandato}
                aoRegistrar={(quantas) => {
                  setRetorno({
                    sucesso: `Novo mandato registrado. ${quantas} credencia${quantas === 1 ? 'l renovada' : 'is renovadas'}: as impressas antigas valem até ${formatarData(config.fim_mandato)}.`,
                  })
                  recarregar()
                }}
                aoFalhar={(erro) => setRetorno({ erro })}
              />
            )}
          </>
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

/** O dia seguinte (aaaa-mm-dd), para o menor fim de mandato aceito. */
function diaSeguinte(dia: string): string {
  const d = new Date(`${dia}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Posse da nova diretoria: as credenciais passam para o novo mandato (as impressas antigas valem até o fim do atual). */
function NovoMandato({
  fimAtual,
  aoRegistrar,
  aoFalhar,
}: {
  fimAtual: string
  aoRegistrar: (quantas: number) => void
  aoFalhar: (erro: string) => void
}) {
  const [fim, setFim] = useState('')
  const [perguntando, setPerguntando] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Nova diretoria tomou posse: registrar o novo mandato</summary>
      <p className="detalhe">
        Cada associado recebe a credencial do novo mandato (novo QR Code); a digital muda sozinha. As impressas antigas
        continuam valendo até <strong>{formatarData(fimAtual)}</strong> (o fim do mandato atual) e, depois disso, o QR Code
        delas mostra "vencida": é preciso imprimir de novo. Para só corrigir a data, use o campo acima.
      </p>
      <form
        className="form-linha"
        aria-label="Novo mandato"
        onSubmit={(e) => {
          e.preventDefault()
          if (!perguntando) {
            setPerguntando(true)
            return
          }
          setPerguntando(false)
          void umaVez(async () => {
            const r = await registrarNovoMandato(fim)
            if (r.erro !== null) aoFalhar(r.erro)
            else {
              setFim('')
              aoRegistrar(r.dados)
            }
          })
        }}
      >
        <label className="campo-curto">
          Fim do novo mandato *
          <input
            type="date"
            required
            min={diaSeguinte(fimAtual > hojeIso() ? fimAtual : hojeIso())}
            value={fim}
            onChange={(e) => {
              setFim(e.target.value)
              setPerguntando(false)
            }}
          />
        </label>
        {perguntando ? (
          <span className="confirmar-linha">
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Confirmar — renovar todas as credenciais
            </button>
            <button type="button" className="botao-texto" onClick={() => setPerguntando(false)}>
              Não
            </button>
          </span>
        ) : (
          <button type="submit" className="botao" disabled={enviando}>
            Registrar o novo mandato
          </button>
        )}
      </form>
    </details>
  )
}

// ---------------------------------------------------------------------
// Assembleias e reuniões: os números do estatuto (se o estatuto mudar, muda aqui)
// ---------------------------------------------------------------------

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function RegrasAssembleias({ podeEditar }: { podeEditar: boolean }) {
  const [carga, recarregar] = useCarregar(buscarConfigAssembleias)
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel" id="assembleias" aria-labelledby="titulo-regras-assembleias">
      <h2 id="titulo-regras-assembleias">Assembleias e reuniões</h2>
      <p className="detalhe">
        Os números vêm do estatuto de 2021. Se o estatuto for reformado, a presidência ajusta aqui, e o sistema passa a
        seguir os novos. A assembleia já convocada continua com a 2ª chamada da regra que valia na convocação.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(config) => (
          <FormRegrasAssembleias
            key={JSON.stringify(config)}
            config={config}
            podeEditar={podeEditar}
            enviando={enviando}
            aoSalvar={(nova) =>
              void umaVez(async () => {
                const r = await salvarConfigAssembleias(nova)
                setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Regras das assembleias salvas.' })
                if (r.erro === null) recarregar()
              })
            }
          />
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

function FormRegrasAssembleias({
  config,
  podeEditar,
  enviando,
  aoSalvar,
}: {
  config: ConfigAssembleias
  podeEditar: boolean
  enviando: boolean
  aoSalvar: (config: ConfigAssembleias) => void
}) {
  const [c, setC] = useState(config)
  // avisar vem antes de levar à pauta (o banco também confere)
  const faltasInvertidas = c.faltas_aviso > c.faltas_pauta
  const numero = (campo: keyof Omit<ConfigAssembleias, 'meses_ago'>, rotulo: string, min: number, max: number) => (
    <label>
      {rotulo}
      <input
        type="number"
        min={min}
        max={max}
        required
        value={c[campo]}
        disabled={!podeEditar}
        onChange={(e) => setC({ ...c, [campo]: Number(e.target.value) })}
      />
    </label>
  )
  return (
    <form
      aria-label="Regras das assembleias"
      onSubmit={(e) => {
        e.preventDefault()
        aoSalvar(c)
      }}
    >
      <div className="grade-form">
        {numero('antecedencia_dias', 'Antecedência mínima da convocação, em dias (Art. 16, §2º)', 0, 365)}
        {numero('minutos_segunda_chamada', 'Minutos até a 2ª chamada (Art. 16, §4º)', 0, 600)}
        {numero('dia_minimo_ago', 'A AGO pode ser a partir do dia (Art. 16, §6º: 2ª quinzena = 16)', 1, 28)}
        {numero('faltas_aviso', 'Faltas seguidas às assembleias, sem justificativa, para avisar o associado', 1, 12)}
        {numero('faltas_pauta', 'Faltas seguidas às assembleias para homologar o desligamento (Art. 8º, IV)', 1, 12)}
        {numero('anos_mandato', 'Mandato da diretoria e do Conselho Fiscal, em anos (Art. 12)', 1, 10)}
        {numero('membros_conselho_fiscal', 'Membros do Conselho Fiscal (Art. 14)', 1, 9)}
        {numero('prazo_pedido_age_dias', 'Dias para colher as assinaturas do pedido de AGE (Art. 16, §3º)', 1, 180)}
      </div>
      <fieldset className="pauta-campos">
        <legend>Meses da Assembleia Geral Ordinária (Art. 16, §6º)</legend>
        <div className="editor-marcas">
          {MESES_CURTOS.map((nome, i) => (
            <label key={nome} className="caixa-marcar">
              <input
                type="checkbox"
                disabled={!podeEditar}
                checked={c.meses_ago.includes(i + 1)}
                onChange={(e) =>
                  setC({
                    ...c,
                    meses_ago: e.target.checked ? [...c.meses_ago, i + 1].sort((a, b) => a - b) : c.meses_ago.filter((m) => m !== i + 1),
                  })
                }
              />
              {nome}
            </label>
          ))}
        </div>
      </fieldset>
      {faltasInvertidas && (
        <p className="aviso-texto" role="alert">
          As faltas para avisar o associado não podem ser mais que as faltas para levar à pauta.
        </p>
      )}
      {podeEditar && (
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando || c.meses_ago.length === 0 || faltasInvertidas}>
            Salvar as regras
          </button>
        </div>
      )}
    </form>
  )
}
