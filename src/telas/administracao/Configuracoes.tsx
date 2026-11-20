import { useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { alterarItem, arquivarItem, criarItem, listarItens, type ItemLista, type TabelaLista } from '../../dados/configuracoes'
import type { Perfil } from '../../dados/perfis'
import { buscarDadosComep, CAMPOS_DADOS_COMEP, salvarDadosComep, type DadosComep } from '../../dados/site'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { buscarConfigAssembleias, salvarConfigAssembleias, type ConfigAssembleias } from '../../dados/encontros'
import { cnpjValido, formatarCnpj, limparCnpj } from '../../utilitarios/formatos'
import { ContasECategorias, TaxaInscricao, Valores, Vencimentos } from '../financeiro/ConfigFinanceiro'

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
      {/* a validade e o texto do verso foram para o módulo Credenciais › Validade e verso (telas novas, Fase 5.5) */}
      <section className="painel" id="credencial" aria-labelledby="titulo-config-credencial">
        <h2 id="titulo-config-credencial">Credencial</h2>
        <p className="detalhe">
          A validade (o fim do mandato da diretoria), a posse da nova diretoria e o texto do verso agora ficam no módulo
          Credenciais: <Link to="/credenciais/validade">Credenciais › Validade e verso</Link>. Os modelos (o desenho de cada
          grupo) ficam em <Link to="/credenciais/modelos">Credenciais › Modelos</Link>.
        </p>
      </section>
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
