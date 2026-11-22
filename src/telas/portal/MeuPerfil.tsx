import { useEffect, useId, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CamposIdentidade } from '../../componentes/CamposIdentidade'
import { Icone, Ladrilho } from '../../componentes/Icone'
import { PendenciasCredencial } from '../../componentes/PendenciasCredencial'
import { AbasDaTela, CabecalhoTela, Chip, FotoOuIniciais, type Aba } from '../../componentes/Telas'
import {
  buscarFicha,
  NOME_DA_FORMA_ADMISSAO,
  NOME_DA_SITUACAO,
  SUGESTOES_FUNCAO,
  type FichaAssociado,
} from '../../dados/associados'
import { listarIgrejas, listarTitulos, type Igreja, type Titulo } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { formatarReais, listarValores, NOME_DA_CATEGORIA, type ValorContribuicao } from '../../dados/configuracoes'
import { buscarConfigCredencial } from '../../dados/credencial'
import { minhasFaltas, type MinhasFaltas } from '../../dados/encontros'
import { situacaoDe, type SituacaoContribuicao } from '../../dados/financeiro'
import { listarPedidosCorrecao } from '../../dados/igrejas'
import { PreferenciasDeAvisos } from '../avisos/AvisosNoCelular'
import { MinhaPrivacidadeAba, MinhaSeguranca } from '../privacidade/Privacidade'
import { FormCorrecao, ResumoDaCorrecao, SeloDaCorrecao, type DadoCorrigivel } from './PedidosCorrecao'
import { atualizarMeusDados, linkDoArquivo } from '../../dados/pedidos'
import { NOME_DO_PERFIL, type Perfil } from '../../dados/perfis'
import {
  buscarMeusDados,
  cancelarTroca,
  minhasTrocas,
  NOME_DA_SITUACAO_TROCA,
  pedirTrocaDeIgreja,
  trocarMinhaFoto,
  trocarMinhaSenha,
  type MeusDadosCompletos,
  type NovaTroca,
  type PedidoTroca,
} from '../../dados/portal'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { erroDaIdentidade, identidadeInicial, identidadeParaGravar } from '../../utilitarios/identidade'
import { prepararFoto } from '../../utilitarios/imagens'

// /meu-perfil — telas novas (Fase 5.5): a ficha com abas (aprovada: "a ficha com todas as abas").
// Cada aba tem endereço próprio: /meu-perfil (Meus dados), /meu-perfil/comep, /igreja, /senha, /avisos e /correcoes.

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, sucesso: string) => boolean

const ABAS_ASSOCIADO: readonly Aba[] = [
  { para: '/meu-perfil', nome: 'Meus dados', curto: 'Dados' },
  { para: '/meu-perfil/comep', nome: 'No COMEP' },
  { para: '/meu-perfil/igreja', nome: 'Minha igreja', curto: 'Igreja' },
  { para: '/meu-perfil/seguranca', nome: 'Segurança' },
  { para: '/meu-perfil/privacidade', nome: 'Privacidade' },
  { para: '/meu-perfil/avisos', nome: 'Avisos' },
  { para: '/meu-perfil/correcoes', nome: 'Correções' },
]

const ABAS_SEM_CADASTRO: readonly Aba[] = [
  { para: '/meu-perfil', nome: 'Meus dados', curto: 'Dados' },
  { para: '/meu-perfil/seguranca', nome: 'Segurança' },
  { para: '/meu-perfil/avisos', nome: 'Avisos' },
]

export function MeuPerfil() {
  const { estado } = useSessao()
  const { aba = 'dados' } = useParams()
  if (estado.situacao !== 'logado' || estado.conta === null) return <Carregando />
  if (estado.conta.tipo !== 'ok') {
    return (
      <Aviso titulo="Cadastro não encontrado">
        <p>Não foi possível carregar o seu cadastro. Saia e entre de novo.</p>
      </Aviso>
    )
  }
  const { pessoaId, perfis } = estado.conta.conta
  return <Conteudo key={pessoaId} pessoaId={pessoaId} perfis={perfis} email={estado.sessao.email} aba={aba} />
}

function Conteudo({ pessoaId, perfis, email, aba }: { pessoaId: string; perfis: Perfil[]; email: string | null; aba: string }) {
  const { recarregarConta } = useSessao()
  const [retorno, setRetorno] = useState<Retorno>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [dados, ficha, trocas, igrejas, valores, situacao, faltas, config, titulos] = await Promise.all([
      buscarMeusDados(pessoaId),
      buscarFicha(pessoaId),
      minhasTrocas(pessoaId),
      listarIgrejas(),
      listarValores(),
      situacaoDe(pessoaId),
      minhasFaltas(),
      buscarConfigCredencial(),
      listarTitulos(),
    ])
    if (dados.erro !== null) return dados
    if (ficha.erro !== null) return ficha
    if (trocas.erro !== null) return trocas
    if (igrejas.erro !== null) return igrejas
    if (valores.erro !== null) return valores
    return ok({
      dados: dados.dados,
      ficha: ficha.dados,
      trocas: trocas.dados,
      igrejas: igrejas.dados,
      // a lista dos títulos da correção (o título certo se escolhe, não se digita)
      titulos: titulos.erro === null ? titulos.dados : [],
      valores: valores.dados.vigentes,
      // estas três só completam a aba "No COMEP": se faltarem, a linha some
      situacao: situacao.dados,
      faltas: faltas.dados,
      fimMandato: config.dados?.fim_mandato ?? null,
    })
  })

  // trocou de aba: a mensagem da aba anterior não vale mais
  const [abaDaMensagem, setAbaDaMensagem] = useState(aba)
  const mensagem = abaDaMensagem === aba ? retorno : {}

  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    setAbaDaMensagem(aba)
    if (r.erro === null) recarregar()
    return r.erro === null
  }

  return (
    <div className="tela-nova">
      <CabecalhoTela titulo="Meu perfil" visivel={false} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ dados, ficha, trocas, igrejas, valores, situacao, faltas, fimMandato, titulos }) => (
          <>
            <CabecalhoPerfil dados={dados} ficha={ficha} situacao={situacao} concluir={concluir} />
            <AbasDaTela rotulo="Partes do meu perfil" abas={ficha ? ABAS_ASSOCIADO : ABAS_SEM_CADASTRO} />
            <Mensagem sucesso={mensagem.sucesso} erro={mensagem.erro} />

            {aba === 'senha' || aba === 'seguranca' ? (
              // parte 13: a senha fica em Segurança (o endereço antigo, /meu-perfil/senha, continua valendo)
              <MinhaSeguranca trocarSenha={<TrocarSenha email={email} concluir={concluir} />} />
            ) : aba === 'privacidade' ? (
              <MinhaPrivacidadeAba />
            ) : aba === 'avisos' ? (
              <PreferenciasDeAvisos pastor={perfis.includes('presidente_igreja')} />
            ) : ficha && aba === 'comep' ? (
              <NoComep ficha={ficha} valores={valores} situacao={situacao} faltas={faltas} fimMandato={fimMandato} perfis={perfis} />
            ) : ficha && aba === 'igreja' ? (
              <MinhaIgrejaEHistorico ficha={ficha} trocas={trocas} igrejas={igrejas} concluir={concluir} />
            ) : ficha && aba === 'correcoes' ? (
              <MinhasCorrecoes pessoaId={pessoaId} dados={dados} ficha={ficha} titulos={titulos} igrejas={igrejas} />
            ) : (
              <>
                <MeusDados
                  dados={dados}
                  email={email}
                  nomeTravado={ficha?.associado.situacao === 'ativo'}
                  temCorrecoes={ficha !== null}
                  concluir={(r, s) => {
                    const certo = concluir(r, s)
                    if (certo) recarregarConta()
                    return certo
                  }}
                />
                {ficha ? (
                  <PendenciasCredencial pendencias={ficha.pendencias} propria verEm="/minha-credencial" />
                ) : (
                  <Aviso titulo="Você ainda não é associado">
                    <p>
                      Quer se associar? <Link to="/meu-pedido">Faça ou acompanhe o seu pedido</Link>. Já é associado e este
                      login não mostra o seu cadastro? Peça à secretaria um código de primeiro acesso.
                    </p>
                  </Aviso>
                )}
              </>
            )}
          </>
        )}
      </MostrarCarga>
    </div>
  )
}

// ---------------------------------------------------------------------
// O alto da ficha: a foto, o nome, a igreja e as etiquetas (em dia, título, nº)
// ---------------------------------------------------------------------

function CabecalhoPerfil({
  dados,
  ficha,
  situacao,
  concluir,
}: {
  dados: MeusDadosCompletos
  ficha: FichaAssociado | null
  situacao: SituacaoContribuicao | null
  concluir: Concluir
}) {
  const [foto, setFoto] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    if (dados.foto_caminho) void linkDoArquivo(dados.foto_caminho).then((u) => ativo && setFoto(u))
    return () => {
      ativo = false
    }
  }, [dados.foto_caminho])

  async function novaFoto(arquivo: File | undefined) {
    if (!arquivo) return
    const pronto = await prepararFoto(arquivo)
    if ('erro' in pronto) {
      concluir({ erro: pronto.erro }, '')
      return
    }
    setEnviando(true)
    concluir(await trocarMinhaFoto(dados.id, pronto.blob, pronto.extensao), 'Foto atualizada.')
    setEnviando(false)
  }

  const atual = ficha?.vinculos.find((v) => v.fim === null)
  const linhaIgreja = [atual?.funcao, atual?.igreja?.nome].filter(Boolean).join(' · ')
  return (
    <section className="bloco cabecalho-perfil" aria-label="Seus dados principais">
      <FotoOuIniciais foto={foto} nome={dados.nome} largura={72} />
      <div className="cabecalho-perfil-texto">
        <strong className="cabecalho-perfil-nome">{dados.nome}</strong>
        {linhaIgreja && <span className="cabecalho-perfil-igreja">{linhaIgreja}</span>}
        {ficha && (
          <span className="chips">
            {situacao && (situacao.em_dia ? <Chip area="financas">Em dia</Chip> : <Chip area="pessoas">Em atraso</Chip>)}
            {ficha.associado.titulo && <Chip area="assembleias">{ficha.associado.titulo}</Chip>}
            <Chip area="pessoas">Nº {String(ficha.associado.numero_registro).padStart(4, '0')}</Chip>
          </span>
        )}
      </div>
      <label className="botao botao-secundario botao-arquivo botao-com-icone">
        <Icone nome="camera" tamanho={18} />
        {dados.foto_caminho ? 'Trocar foto' : 'Enviar foto'}
        <input
          type="file"
          accept="image/*"
          className="somente-leitor"
          disabled={enviando}
          onChange={(e) => void novaFoto(e.target.files?.[0])}
        />
      </label>
    </section>
  )
}

// ---------------------------------------------------------------------
// Aba "Meus dados"
// ---------------------------------------------------------------------

function MeusDados({
  dados,
  email,
  nomeTravado,
  temCorrecoes,
  concluir,
}: {
  dados: MeusDadosCompletos
  email: string | null
  /** associado ativo: o nome vai na credencial e só a secretaria corrige */
  nomeTravado: boolean
  /** quem tem cadastro de ministro tem a aba Correções (sem cadastro, nada está na credencial) */
  temCorrecoes: boolean
  concluir: Concluir
}) {
  const [nome, setNome] = useState(dados.nome)
  const [telefone, setTelefone] = useState(dados.telefone ?? '')
  const [identidade, setIdentidade] = useState(identidadeInicial(dados))
  const [enviando, setEnviando] = useState(false)
  const idNome = useId()

  async function salvar() {
    const erro = erroDaIdentidade(identidade, false)
    if (erro) return concluir({ erro }, '')
    setEnviando(true)
    concluir(
      await atualizarMeusDados(dados.id, nome, telefone, identidadeParaGravar(identidade, dados, false)),
      'Seus dados foram salvos.',
    )
    setEnviando(false)
  }

  return (
    <section className="aba-conteudo" aria-labelledby="titulo-meus-dados">
      <h2 id="titulo-meus-dados" className="somente-leitor">
        Meus dados
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void salvar()
        }}
      >
        <div className="grade-form">
          <div className="campo-com-link">
            <span className="rotulo-com-link">
              <label htmlFor={idNome}>Nome completo</label>
              {nomeTravado && (
                <Link to="/meu-perfil/correcoes" className="link-pequeno">
                  Pedir correção
                </Link>
              )}
            </span>
            <input id={idNome} required value={nome} disabled={nomeTravado} onChange={(e) => setNome(e.target.value)} />
          </div>
          <label>
            E-mail de login
            <input type="email" value={email ?? ''} disabled />
          </label>
          <label>
            Telefone (WhatsApp)
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <CamposIdentidade valor={identidade} gravada={dados} aoMudar={setIdentidade} />
        </div>
        <p className="detalhe">
          Pela LGPD, você pode ver e corrigir os seus dados aqui.
          {temCorrecoes && (
            <>
              {' '}
              O que vai na credencial e já foi preenchido, a secretaria corrige: peça na aba{' '}
              <Link to="/meu-perfil/correcoes">Correções</Link>.
            </>
          )}
        </p>
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar meus dados
          </button>
        </div>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------------
// Aba "No COMEP": a situação em detalhe
// ---------------------------------------------------------------------

function NoComep({
  ficha,
  valores,
  situacao,
  faltas,
  fimMandato,
  perfis,
}: {
  ficha: FichaAssociado
  valores: ValorContribuicao[]
  situacao: SituacaoContribuicao | null
  faltas: MinhasFaltas | null
  fimMandato: string | null
  perfis: Perfil[]
}) {
  const { associado } = ficha
  const valor = (tipo: ValorContribuicao['tipo']) =>
    valores.find((v) => v.categoria === associado.categoria_contribuicao && v.tipo === tipo)
  const mensal = valor('mensal')
  const anual = valor('anual')
  const tituloAtual = ficha.titulos[ficha.titulos.length - 1]

  return (
    <div className="duas-colunas">
      <section className="bloco" aria-labelledby="titulo-no-comep">
        <h2 id="titulo-no-comep">A sua situação no COMEP</h2>
        <dl className="definicoes definicoes-fortes">
          <dt>Nº de registro</dt>
          <dd>{String(associado.numero_registro).padStart(4, '0')}</dd>
          <dt>Situação</dt>
          <dd>
            {NOME_DA_SITUACAO[associado.situacao]}
            {situacao && (situacao.em_dia ? ' · em dia' : ' · contribuição em atraso')}
            {associado.jubilado && ' · jubilado'}
          </dd>
          <dt>Admissão</dt>
          <dd>
            {associado.admitido_em ? formatarData(associado.admitido_em) : 'Sem data'} ·{' '}
            {NOME_DA_FORMA_ADMISSAO[associado.forma_admissao].toLowerCase()}
          </dd>
          <dt>Título</dt>
          <dd>
            {associado.titulo ?? 'Não informado'}
            {tituloAtual?.desde && ` · desde ${formatarData(tituloAtual.desde).slice(-4)}`}
          </dd>
          <dt>Contribuição</dt>
          <dd>
            {NOME_DA_CATEGORIA[associado.categoria_contribuicao]}
            {mensal && anual && ` — ${formatarReais(mensal.valor)} por mês ou ${formatarReais(anual.valor)} por ano`}
          </dd>
          <dt>Credencial</dt>
          <dd>
            {ficha.pendencias.length > 0
              ? `falta completar (${ficha.pendencias.length})`
              : fimMandato
                ? `válida até ${formatarData(fimMandato)}`
                : 'completa'}
          </dd>
          {faltas && (
            <>
              <dt>Faltas às assembleias</dt>
              <dd>
                {faltas.faltas_seguidas === 0
                  ? 'nenhuma seguida'
                  : faltas.faltas_seguidas === 1
                    ? '1 falta sem justificativa aceita'
                    : `${faltas.faltas_seguidas} seguidas, sem justificativa aceita`}
              </dd>
            </>
          )}
          <dt>Perfis no sistema</dt>
          <dd>{perfis.length > 0 ? perfis.map((p) => NOME_DO_PERFIL[p]).join(', ') : 'nenhum'}</dd>
        </dl>
        {ficha.titulos.length > 1 && (
          <>
            <h3>Histórico de títulos</h3>
            <ol className="historico">
              {ficha.titulos.map((t) => (
                <li key={t.id}>
                  {t.titulo?.nome}
                  {t.desde && ` — desde ${formatarData(t.desde)}`}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <div className="coluna-atalhos">
        <Link to="/minhas-mensalidades" className="bloco atalho-bloco">
          <Ladrilho area="financas" icone="mensalidade" tamanho={40} />
          <span>
            <strong>Minhas mensalidades</strong>
            <span>{situacao ? (situacao.em_dia ? 'Em dia' : `Em atraso: ${situacao.cobrancas_vencidas} vencida(s)`) : 'Ver as contribuições'}</span>
          </span>
          <Icone nome="seta" />
        </Link>
        <Link to="/minha-credencial" className="bloco atalho-bloco">
          <Ladrilho area="pessoas" icone="credencial" tamanho={40} />
          <span>
            <strong>Minha credencial</strong>
            <span>{fimMandato ? `Válida até ${formatarData(fimMandato)}` : 'Digital e impressão'}</span>
          </span>
          <Icone nome="seta" />
        </Link>
        <p className="detalhe">
          Algum dado errado? Peça a correção na aba <Link to="/meu-perfil/correcoes">Correções</Link>.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Aba "Minha igreja": as igrejas (histórico) e o pedido de troca
// ---------------------------------------------------------------------

const OUTRA_IGREJA = '__outra__'

function MinhaIgrejaEHistorico({
  ficha,
  trocas,
  igrejas,
  concluir,
}: {
  ficha: FichaAssociado
  trocas: PedidoTroca[]
  igrejas: Igreja[]
  concluir: Concluir
}) {
  const atual = ficha.vinculos.find((v) => v.fim === null)
  const pendente = trocas.find((t) => t.situacao === 'pendente')
  const ultimaDecidida = trocas.find((t) => t.situacao !== 'pendente')
  const [escolha, setEscolha] = useState('')
  const [troca, setTroca] = useState<NovaTroca>({
    igrejaId: '',
    igrejaInformada: '',
    funcao: '',
    pastorPresidente: false,
    aPartirDe: hojeIso(),
    observacao: '',
  })
  const [enviando, setEnviando] = useState(false)
  const vinculos = [...ficha.vinculos].sort((a, b) => (b.inicio ?? '').localeCompare(a.inicio ?? ''))

  async function pedir() {
    setEnviando(true)
    const r = await pedirTrocaDeIgreja(ficha.associado.pessoa_id, {
      ...troca,
      igrejaId: escolha === OUTRA_IGREJA ? '' : escolha,
    })
    setEnviando(false)
    if (concluir(r, 'Pedido de troca de igreja enviado à secretaria.')) setEscolha('')
  }

  return (
    <div className="duas-colunas duas-iguais">
      <section className="bloco" aria-labelledby="titulo-minhas-igrejas">
        <h2 id="titulo-minhas-igrejas">Minhas igrejas</h2>
        {vinculos.length === 0 ? (
          <p className="vazio">Nenhuma igreja no cadastro.</p>
        ) : (
          <ul className="lista-linhas" aria-label="Histórico de igrejas">
            {vinculos.map((v) => (
              <li key={v.id}>
                <Ladrilho area="pessoas" icone="igreja" tamanho={36} />
                <span className="linha-corpo">
                  <strong>
                    {v.igreja?.nome}
                    {v === atual && v.pastor_presidente && ' · pastor presidente'}
                  </strong>
                  <span>
                    {[v.funcao, `${v.inicio ? formatarData(v.inicio) : '?'} ${v.fim ? `a ${formatarData(v.fim)}` : 'até hoje'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bloco" aria-labelledby="titulo-pedir-troca">
        <h2 id="titulo-pedir-troca">Pedir troca de igreja</h2>
        {pendente ? (
          <div className="aviso-campo">
            <p>
              Pedido de troca para <strong>{pendente.igreja?.nome ?? pendente.igreja_informada}</strong>:{' '}
              {NOME_DA_SITUACAO_TROCA.pendente.toLowerCase()}.
            </p>
            <BotaoConfirmar
              texto="Cancelar o pedido de troca"
              confirmar="Confirmar cancelamento"
              aviso="Cancelar o pedido de troca de igreja?"
              aoConfirmar={async () => concluir(await cancelarTroca(pendente.id), 'Pedido de troca cancelado.')}
            />
          </div>
        ) : (
          <>
            {ultimaDecidida?.situacao === 'recusado' && (
              <p className="detalhe">
                O último pedido de troca (para {ultimaDecidida.igreja?.nome ?? ultimaDecidida.igreja_informada}) foi recusado:{' '}
                {ultimaDecidida.motivo_recusa}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void pedir()
              }}
            >
              <label>
                Igreja nova *
                <select required value={escolha} onChange={(e) => setEscolha(e.target.value)}>
                  <option value="">— Escolha a igreja —</option>
                  {igrejas
                    .filter((i) => i.id !== atual?.igreja_id)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  <option value={OUTRA_IGREJA}>A igreja não está na lista</option>
                </select>
              </label>
              {escolha === OUTRA_IGREJA && (
                <label>
                  Nome da igreja nova *
                  <input required value={troca.igrejaInformada} onChange={(e) => setTroca({ ...troca, igrejaInformada: e.target.value })} />
                </label>
              )}
              <div className="grade-form">
                <label>
                  Função na igreja nova
                  <input list="sugestoes-funcao-perfil" value={troca.funcao} onChange={(e) => setTroca({ ...troca, funcao: e.target.value })} />
                  <datalist id="sugestoes-funcao-perfil">
                    {SUGESTOES_FUNCAO.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <label>
                  A partir de
                  <input type="date" value={troca.aPartirDe} onChange={(e) => setTroca({ ...troca, aPartirDe: e.target.value })} />
                </label>
              </div>
              <label className="caixa-marcar">
                <input
                  type="checkbox"
                  checked={troca.pastorPresidente}
                  onChange={(e) => setTroca({ ...troca, pastorPresidente: e.target.checked })}
                />
                Serei o pastor presidente da igreja nova
              </label>
              <label>
                Observação
                <input value={troca.observacao} onChange={(e) => setTroca({ ...troca, observacao: e.target.value })} />
              </label>
              <div className="acoes">
                <button type="submit" className="botao" disabled={enviando}>
                  Enviar pedido de troca
                </button>
              </div>
              <p className="detalhe">A secretaria aprova a troca.</p>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------
// Aba "Senha"
// ---------------------------------------------------------------------

function TrocarSenha({ email, concluir }: { email: string | null; concluir: Concluir }) {
  const [atual, setAtual] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function trocar() {
    setErro(null)
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')
    setEnviando(true)
    const r = await trocarMinhaSenha(email ?? '', atual, senha)
    setEnviando(false)
    if (r.erro !== null) return setErro(r.erro)
    setAtual('')
    setSenha('')
    setConfirmacao('')
    concluir(r, 'Senha trocada. Use a senha nova no próximo acesso.')
  }

  return (
    <section className="aba-conteudo aba-estreita" aria-labelledby="titulo-senha">
      <h2 id="titulo-senha" className="somente-leitor">
        Trocar a senha
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void trocar()
        }}
      >
        <label>
          Senha atual
          <input type="password" autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />
        </label>
        <label>
          Senha nova
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <label>
          Repita a senha nova
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </label>
        <p className="detalhe">Use pelo menos 8 caracteres, com letras e números.</p>
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Trocar a senha
          </button>
        </div>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------------
// Aba "Correções": escolher o dado (lista fechada), ver como está e dizer como deve ficar.
// Aceita pela secretaria, a correção entra sozinha no cadastro (parte 4 das telas novas, 18/11/2026).
// ---------------------------------------------------------------------

function dadosCorrigiveis(dados: MeusDadosCompletos, ficha: FichaAssociado): DadoCorrigivel[] {
  const atual = ficha.vinculos.find((v) => v.fim === null)
  return [
    { campo: 'nome', atual: dados.nome },
    { campo: 'telefone', atual: dados.telefone ?? '' },
    { campo: 'cpf', atual: dados.cpf ?? '' },
    { campo: 'nome_mae', atual: dados.nome_mae ?? '' },
    { campo: 'nome_pai', atual: dados.nome_pai ?? '' },
    { campo: 'titulo', atual: ficha.associado.titulo ?? '' },
    { campo: 'funcao', atual: atual?.funcao ?? '' },
    { campo: 'igreja', atual: atual?.igreja?.nome ?? '' },
  ]
}

function MinhasCorrecoes({
  pessoaId,
  dados,
  ficha,
  titulos,
  igrejas,
}: {
  pessoaId: string
  dados: MeusDadosCompletos
  ficha: FichaAssociado
  titulos: Titulo[]
  igrejas: Igreja[]
}) {
  const [carga, recarregar] = useCarregar(() => listarPedidosCorrecao({ pessoaId }))
  const [retorno, setRetorno] = useState<Retorno>({})

  return (
    <div className="duas-colunas duas-iguais">
      <section className="bloco" aria-labelledby="titulo-pedir-correcao">
        <h2 id="titulo-pedir-correcao">Pedir uma correção</h2>
        <FormCorrecao
          pessoaId={pessoaId}
          rotulo="Pedir uma correção"
          dados={dadosCorrigiveis(dados, ficha)}
          titulos={titulos}
          igrejas={igrejas}
          aoConcluir={(r, sucesso) => {
            setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
            if (r.erro === null) recarregar()
          }}
          rodape={
            <>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
              <p className="detalhe">
                A secretaria confere e, aceita, a correção entra sozinha no cadastro. O telefone e o que ainda está vazio você
                também muda na aba <Link to="/meu-perfil">Meus dados</Link>.
              </p>
            </>
          }
        />
      </section>
      <section className="bloco" aria-labelledby="titulo-meus-pedidos-correcao">
        <h2 id="titulo-meus-pedidos-correcao">Os meus pedidos</h2>
        <MostrarCarga carga={carga} recarregar={recarregar}>
          {(pedidos) =>
            pedidos.length === 0 ? (
              <p className="vazio">Nenhum pedido de correção.</p>
            ) : (
              <ul className="lista-linhas" aria-label="Meus pedidos de correção">
                {pedidos.map((p) => (
                  <li key={p.id}>
                    <span className="linha-corpo">
                      <span className="linha-texto">
                        <ResumoDaCorrecao p={p} />
                      </span>
                      <span className="linha-selo">
                        <SeloDaCorrecao p={p} />
                        <span className="detalhe">pedido em {formatarDataDeInstante(p.criado_em)}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </MostrarCarga>
      </section>
    </div>
  )
}
