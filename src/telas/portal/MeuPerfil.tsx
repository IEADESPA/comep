import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Aviso, BotaoConfirmar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  buscarFicha,
  NOME_DA_FORMA_ADMISSAO,
  NOME_DA_SITUACAO,
  SUGESTOES_FUNCAO,
  type FichaAssociado,
} from '../../dados/associados'
import { listarIgrejas, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { formatarReais, listarValores, NOME_DA_CATEGORIA, type ValorContribuicao } from '../../dados/configuracoes'
import { linkDoArquivo } from '../../dados/pedidos'
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
import { atualizarMeusDados } from '../../dados/pedidos'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { prepararFoto } from '../../utilitarios/imagens'

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, sucesso: string) => boolean

/** /meu-perfil — a própria pessoa vê e corrige os seus dados (LGPD), troca a foto e a senha. */
export function MeuPerfil() {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta === null) return <Carregando />
  if (estado.conta.tipo !== 'ok') {
    return (
      <Aviso titulo="Cadastro não encontrado">
        <p>Não foi possível carregar o seu cadastro. Saia e entre de novo.</p>
      </Aviso>
    )
  }
  const { pessoaId, perfis } = estado.conta.conta
  return <Conteudo key={pessoaId} pessoaId={pessoaId} perfis={perfis} email={estado.sessao.email} />
}

function Conteudo({ pessoaId, perfis, email }: { pessoaId: string; perfis: Perfil[]; email: string | null }) {
  const { recarregarConta } = useSessao()
  const [retorno, setRetorno] = useState<Retorno>({})
  const [carga, recarregar] = useCarregar(async () => {
    const [dados, ficha, trocas, igrejas, valores] = await Promise.all([
      buscarMeusDados(pessoaId),
      buscarFicha(pessoaId),
      minhasTrocas(pessoaId),
      listarIgrejas(),
      listarValores(),
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
      valores: valores.dados.vigentes,
    })
  })

  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
    return r.erro === null
  }

  return (
    <>
      <h1>Meu perfil</h1>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ dados, ficha, trocas, igrejas, valores }) => (
          <>
            <MeusDados
              dados={dados}
              email={email}
              concluir={(r, s) => {
                const certo = concluir(r, s)
                if (certo) recarregarConta()
                return certo
              }}
            />
            {ficha ? (
              <>
                <NoComep ficha={ficha} valores={valores} />
                <MinhaIgrejaEHistorico ficha={ficha} trocas={trocas} igrejas={igrejas} concluir={concluir} />
              </>
            ) : (
              <Aviso titulo="Você ainda não é associado">
                <p>
                  Quer se associar? <Link to="/meu-pedido">Faça ou acompanhe o seu pedido</Link>. Já é associado e este
                  login não mostra o seu cadastro? Peça à secretaria um código de primeiro acesso.
                </p>
              </Aviso>
            )}
            <section className="painel" aria-labelledby="titulo-perfis">
              <h2 id="titulo-perfis">Meus perfis de acesso</h2>
              {perfis.length === 0 ? (
                <p className="vazio">Nenhum perfil ainda.</p>
              ) : (
                <ul className="perfis" aria-label="Meus perfis">
                  {perfis.map((p) => (
                    <li key={p}>{NOME_DO_PERFIL[p]}</li>
                  ))}
                </ul>
              )}
            </section>
            <TrocarSenha email={email} concluir={concluir} />
          </>
        )}
      </MostrarCarga>
    </>
  )
}

function MeusDados({ dados, email, concluir }: { dados: MeusDadosCompletos; email: string | null; concluir: Concluir }) {
  const [nome, setNome] = useState(dados.nome)
  const [telefone, setTelefone] = useState(dados.telefone ?? '')
  const [foto, setFoto] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    if (dados.foto_caminho) void linkDoArquivo(dados.foto_caminho).then((u) => ativo && setFoto(u))
    return () => {
      ativo = false
    }
  }, [dados.foto_caminho])

  async function salvar() {
    setEnviando(true)
    concluir(await atualizarMeusDados(dados.id, nome, telefone), 'Seus dados foram salvos.')
    setEnviando(false)
  }

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

  return (
    <section className="painel" aria-labelledby="titulo-meus-dados">
      <h2 id="titulo-meus-dados">Meus dados</h2>
      <div className="ficha-com-foto">
        <div className="coluna-foto">
          {foto ? (
            <img className="foto-ficha" src={foto} alt="Sua foto" />
          ) : (
            <div className="foto-ficha foto-vazia" role="img" aria-label="Sem foto" />
          )}
          <label className="botao botao-secundario botao-arquivo">
            {dados.foto_caminho ? 'Trocar foto' : 'Enviar foto'}
            <input
              type="file"
              accept="image/*"
              className="somente-leitor"
              disabled={enviando}
              onChange={(e) => void novaFoto(e.target.files?.[0])}
            />
          </label>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void salvar()
          }}
        >
          <label>
            Nome completo
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Telefone (WhatsApp)
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <label>
            E-mail de login
            <input type="email" value={email ?? ''} disabled />
          </label>
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Salvar meus dados
            </button>
          </div>
        </form>
      </div>
      <p className="detalhe">
        Pela LGPD, você pode ver e corrigir os seus dados aqui. Título, igreja e situação são mantidos pela secretaria.
      </p>
    </section>
  )
}

function NoComep({ ficha, valores }: { ficha: FichaAssociado; valores: ValorContribuicao[] }) {
  const { associado } = ficha
  const valor = (tipo: ValorContribuicao['tipo']) =>
    valores.find((v) => v.categoria === associado.categoria_contribuicao && v.tipo === tipo)
  const mensal = valor('mensal')
  const anual = valor('anual')

  return (
    <section className="painel" aria-labelledby="titulo-no-comep">
      <h2 id="titulo-no-comep">No COMEP</h2>
      <dl className="definicoes">
        <dt>Nº de registro</dt>
        <dd>{associado.numero_registro}</dd>
        <dt>Situação</dt>
        <dd>{NOME_DA_SITUACAO[associado.situacao]}</dd>
        <dt>Admissão</dt>
        <dd>
          {NOME_DA_FORMA_ADMISSAO[associado.forma_admissao]}
          {associado.admitido_em && ` — ${formatarData(associado.admitido_em)}`}
        </dd>
        <dt>Contribuição</dt>
        <dd>
          {NOME_DA_CATEGORIA[associado.categoria_contribuicao]}
          {mensal && anual && ` — ${formatarReais(mensal.valor)} por mês ou ${formatarReais(anual.valor)} por ano`}
        </dd>
        <dt>Título</dt>
        <dd>{associado.titulo ?? 'Não informado'}</dd>
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
  )
}

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
    <section className="painel" aria-labelledby="titulo-minha-igreja-perfil">
      <h2 id="titulo-minha-igreja-perfil">Minha igreja</h2>
      <p>
        Atual: <strong>{atual?.igreja?.nome ?? 'Sem igreja'}</strong>
        {atual?.funcao && ` — ${atual.funcao}`}
        {atual?.pastor_presidente && <span className="etiqueta etiqueta-marca">Pastor presidente</span>}
      </p>
      {ficha.vinculos.length > 1 && (
        <ol className="historico" aria-label="Histórico de igrejas">
          {ficha.vinculos.map((v) => (
            <li key={v.id}>
              {v.igreja?.nome}
              <span className="detalhe">
                {' '}
                {v.inicio ? formatarData(v.inicio) : '?'} a {v.fim ? formatarData(v.fim) : 'hoje'}
              </span>
            </li>
          ))}
        </ol>
      )}

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
              O último pedido de troca (para {ultimaDecidida.igreja?.nome ?? ultimaDecidida.igreja_informada}) foi
              recusado: {ultimaDecidida.motivo_recusa}
            </p>
          )}
          <details className="acao-recolhida">
            <summary>Pedir troca de igreja</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void pedir()
              }}
            >
              <div className="grade-form">
                <label className="largura-total">
                  Igreja nova *
                  <select required value={escolha} onChange={(e) => setEscolha(e.target.value)}>
                    <option value="">— Escolha —</option>
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
                  <label className="largura-total">
                    Nome da igreja nova *
                    <input
                      required
                      value={troca.igrejaInformada}
                      onChange={(e) => setTroca({ ...troca, igrejaInformada: e.target.value })}
                    />
                  </label>
                )}
                <label>
                  Função na igreja nova
                  <input
                    list="sugestoes-funcao-perfil"
                    value={troca.funcao}
                    onChange={(e) => setTroca({ ...troca, funcao: e.target.value })}
                  />
                  <datalist id="sugestoes-funcao-perfil">
                    {SUGESTOES_FUNCAO.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <label>
                  A partir de
                  <input
                    type="date"
                    value={troca.aPartirDe}
                    onChange={(e) => setTroca({ ...troca, aPartirDe: e.target.value })}
                  />
                </label>
                <label className="caixa-marcar largura-total">
                  <input
                    type="checkbox"
                    checked={troca.pastorPresidente}
                    onChange={(e) => setTroca({ ...troca, pastorPresidente: e.target.checked })}
                  />
                  Serei o pastor presidente da igreja nova
                </label>
                <label className="largura-total">
                  Observação
                  <input value={troca.observacao} onChange={(e) => setTroca({ ...troca, observacao: e.target.value })} />
                </label>
              </div>
              <div className="acoes">
                <button type="submit" className="botao" disabled={enviando}>
                  Enviar pedido de troca
                </button>
              </div>
            </form>
          </details>
        </>
      )}
    </section>
  )
}

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
    <section className="painel" aria-labelledby="titulo-senha">
      <h2 id="titulo-senha">Trocar a senha</h2>
      <form
        className="form-linha"
        onSubmit={(e) => {
          e.preventDefault()
          void trocar()
        }}
      >
        <label>
          Senha atual
          <input
            type="password"
            autoComplete="current-password"
            required
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />
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
        <button type="submit" className="botao" disabled={enviando}>
          Trocar senha
        </button>
      </form>
      <p className="detalhe">Pelo menos 8 caracteres, com letras e números.</p>
      <Mensagem erro={erro} />
    </section>
  )
}
