import { useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  alterarItem,
  arquivarItem,
  arquivarValor,
  CATEGORIAS,
  criarItem,
  formatarReais,
  lancarValor,
  listarItens,
  listarValores,
  NOME_DA_CATEGORIA,
  NOME_DO_TIPO_VALOR,
  TIPOS_VALOR,
  type CategoriaContribuicao,
  type ItemLista,
  type NovoValor,
  type TabelaLista,
  type TipoValor,
  type ValorContribuicao,
} from '../../dados/configuracoes'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, hojeIso } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }

/** Mesmas regras do banco (RLS): quem pode mexer em cada parte. */
const EDITAM_LISTAS: readonly Perfil[] = ['secretaria', 'presidencia', 'admin_tecnico']
const EDITAM_VALORES: readonly Perfil[] = ['tesouraria', 'presidencia']

export function Configuracoes() {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const editaListas = perfis.some((p) => EDITAM_LISTAS.includes(p))
  const editaValores = perfis.some((p) => EDITAM_VALORES.includes(p))

  return (
    <>
      <h1>Configurações</h1>
      <p className="detalhe">
        As listas e os valores que o sistema usa. Arquivar um item tira ele das opções, mas não apaga nada: o que já usava
        esse item continua guardado.
      </p>

      <nav className="atalhos-secao" aria-label="Partes das configurações">
        <a href="#denominacoes">Denominações</a>
        <a href="#bairros">Bairros</a>
        <a href="#titulos">Títulos de ministro</a>
        <a href="#valores">Valores da contribuição</a>
      </nav>

      <ListaConfiguravel
        tabela="denominacoes"
        ancora="denominacoes"
        titulo="Denominações (tipos de igreja)"
        descricao="Ex.: Assembleia de Deus, Batista, Presbiteriana, Pentecostal…"
        comSigla
        podeEditar={editaListas}
      />
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
      <Valores podeEditar={editaValores} />
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

function Valores({ podeEditar }: { podeEditar: boolean }) {
  const [carga, recarregar] = useCarregar(listarValores)
  const [retorno, setRetorno] = useState<Retorno>({})

  function concluir(r: { erro: string | null }, sucesso: string) {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
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
                          {NOME_DO_TIPO_VALOR[tipo]}: <strong>{v ? formatarReais(v.valor) : 'não definido'}</strong>
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
                      <strong>{formatarReais(v.valor)}</strong> desde {formatarData(v.vigente_desde)}
                      {v.aprovado_em_assembleia && ` · assembleia de ${formatarData(v.aprovado_em_assembleia)}`}
                      {v.ata && ` · ata ${v.ata}`}
                      {v.observacao && <span className="detalhe"> — {v.observacao}</span>}
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        className="botao-texto"
                        aria-label={`Arquivar o valor ${NOME_DA_CATEGORIA[v.categoria]} ${NOME_DO_TIPO_VALOR[v.tipo]} de ${formatarData(v.vigente_desde)}`}
                        onClick={async () => concluir(await arquivarValor(v.id), 'Valor arquivado.')}
                      >
                        Arquivar
                      </button>
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
  const [enviando, setEnviando] = useState(false)

  async function lancar() {
    const valor = Number(valorTexto.replace(',', '.'))
    setEnviando(true)
    const r = await lancarValor({ ...novo, valor })
    setEnviando(false)
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
          void lancar()
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
              pattern="[0-9]+([,.][0-9]{1,2})?"
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
