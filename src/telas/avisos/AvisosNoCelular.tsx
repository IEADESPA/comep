import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone, MarcaCaixa } from '../../componentes/Icone'
import {
  cancelarInscricaoPush,
  minhasPreferenciasAvisos,
  NOME_DO_TIPO_AVISO,
  salvarPreferenciasAvisos,
  type PreferenciasAvisos,
  type TipoEscolhivel,
} from '../../dados/notificacoes'
import {
  ativarNoAparelho,
  conferirInscricao,
  desativarNoAparelho,
  ehIphoneSemInstalar,
  estadoNoAparelho,
  type EstadoNoAparelho,
} from '../../estado/avisosNoAparelho'
import { useCarregar } from '../../estado/useCarregar'
import { formatarDataDeInstante } from '../../utilitarios/formatos'

// Os avisos no celular (rodada 15, a proposta "notificacoes", aprovada em 18/11/2026; parte 11):
//   * no primeiro acesso, o Início pergunta "Receber os avisos no celular?" (Sim, ativar · Agora não);
//   * em Meu perfil › Avisos, a pessoa escolhe o que chega e o silêncio à noite, e vê os aparelhos.
// É a notificação do próprio navegador: não tem custo e chega mesmo com o aplicativo fechado.

/** O que dizer depois do "Sim, ativar" (ou em Meu perfil), conforme o aparelho. */
function textoDoEstado(estado: EstadoNoAparelho): string {
  switch (estado) {
    case 'ativo':
      return 'Pronto: os avisos chegam neste aparelho, mesmo com o aplicativo fechado.'
    case 'sem_envio':
      return 'Pronto: os avisos ficam ligados. O envio para o celular está sendo preparado pela equipe técnica; enquanto isso, eles aparecem no sino.'
    case 'bloqueado':
      return 'O navegador está bloqueando os avisos deste site. Para receber, libere as notificações nas configurações do navegador. Enquanto isso, os avisos aparecem no sino.'
    case 'sem_suporte':
      return ehIphoneSemInstalar()
        ? 'No iPhone, os avisos chegam com o aplicativo adicionado à tela de início (Compartilhar › Adicionar à Tela de Início). Enquanto isso, eles aparecem no sino.'
        : 'Este navegador não recebe avisos. Eles aparecem no sino.'
    case 'perguntar':
      return 'O navegador ainda não deu a permissão. Toque em "Sim, ativar" e escolha "Permitir".'
    case 'parado':
      return 'Os avisos estão ligados, mas este aparelho não está recebendo.'
  }
}

const EXEMPLOS = [
  { texto: 'Convocação: a assembleia foi marcada. Toque para confirmar a presença.', quando: 'agora' },
  { texto: 'O alvará da sua igreja vence em 30 dias. Mande o novo antes de vencer.', quando: '09:00' },
]

/** O Início pergunta uma vez (no primeiro acesso): "Receber os avisos no celular?". */
export function AtivarAvisos() {
  const [carga] = useCarregar(minhasPreferenciasAvisos)
  const [enviando, setEnviando] = useState(false)
  const [resposta, setResposta] = useState<{ estado: EstadoNoAparelho; erro: string | null } | null>(null)
  const [fechado, setFechado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // quem já ativou: confere que este aparelho continua inscrito (a chave do envio pode ter chegado depois)
  const ativou = carga.situacao === 'ok' && carga.dados.ativou_em !== null
  useEffect(() => {
    if (ativou) void conferirInscricao(true)
  }, [ativou])

  if (fechado || carga.situacao !== 'ok') return null
  const prefs = carga.dados
  if (resposta === null && (prefs.ativou_em !== null || prefs.recusou_em !== null)) return null

  async function ativar() {
    setEnviando(true)
    setErro(null)
    const r = await ativarNoAparelho()
    if (r.estado !== 'perguntar' && r.estado !== 'ativo') {
      // a inscrição do aparelho já guarda o "ativou"; sem ela, guarda só a resposta
      const salvo = await salvarPreferenciasAvisos({ resposta: 'ativar' })
      if (salvo.erro !== null) setErro(salvo.erro)
    }
    setEnviando(false)
    setResposta(r)
  }

  async function agoraNao() {
    setEnviando(true)
    const r = await salvarPreferenciasAvisos({ resposta: 'agora_nao' })
    setEnviando(false)
    if (r.erro !== null) setErro(r.erro)
    else setFechado(true)
  }

  return (
    <section className="ativar-avisos">
      <div className="bloco ativar-avisos-cartao">
        <span className="ativar-avisos-sino" aria-hidden="true">
          <Icone nome="sino" tamanho={36} />
        </span>
        {resposta === null || resposta.estado === 'perguntar' ? (
          <>
            <h2 id="titulo-ativar-avisos">Receber os avisos no celular?</h2>
            <p>Convocação de assembleia, contribuição, documento da igreja perto de vencer. Chega mesmo com o aplicativo fechado.</p>
            {resposta?.estado === 'perguntar' && <p className="detalhe">{textoDoEstado('perguntar')}</p>}
            <button type="button" className="botao" disabled={enviando} onClick={() => void ativar()}>
              Sim, ativar
            </button>
            <button type="button" className="botao-texto" disabled={enviando} onClick={() => void agoraNao()}>
              Agora não
            </button>
            <span className="detalhe">Depois, você escolhe o que chega em Meu perfil › Avisos.</span>
          </>
        ) : (
          <>
            <h2 id="titulo-ativar-avisos">
              {resposta.estado === 'ativo' || resposta.estado === 'sem_envio' ? 'Avisos ligados' : 'Quase lá'}
            </h2>
            <p role="status">{textoDoEstado(resposta.estado)}</p>
            <Mensagem erro={resposta.erro} />
            <Link to="/meu-perfil/avisos" className="link-forte">
              Escolher o que chega →
            </Link>
            <button type="button" className="botao-texto" onClick={() => setFechado(true)}>
              Fechar
            </button>
          </>
        )}
        <Mensagem erro={erro} />
      </div>
      <div className="ativar-avisos-exemplos" aria-hidden="true">
        <span className="rotulo">Como chega (exemplos)</span>
        {EXEMPLOS.map((e) => (
          <span key={e.texto} className="exemplo-notificacao">
            <MarcaCaixa tamanho={34} />
            <span>
              <span className="exemplo-notificacao-topo">
                <strong>COMEP</strong>
                <span>{e.quando}</span>
              </span>
              {e.texto}
            </span>
          </span>
        ))}
        <span className="detalhe">
          É a notificação do próprio navegador: não tem custo. No iPhone, funciona com o aplicativo adicionado à tela de início.
        </span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------
// Meu perfil › Avisos: neste aparelho, o que chega e os aparelhos
// ---------------------------------------------------------------------

const TIPOS: readonly TipoEscolhivel[] = ['assembleias', 'votacoes', 'mensalidade', 'documentos', 'mural']

function Interruptor({
  ligado,
  rotulo,
  detalhe,
  aoMudar,
  desabilitado,
}: {
  ligado: boolean
  rotulo: string
  detalhe?: string
  aoMudar: (v: boolean) => void
  desabilitado?: boolean
}) {
  return (
    <div className="linha-interruptor">
      <span className="linha-interruptor-texto">
        <span>{rotulo}</span>
        {detalhe && <span className="detalhe">{detalhe}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={rotulo}
        className="interruptor"
        disabled={desabilitado}
        onClick={() => aoMudar(!ligado)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  )
}

export function PreferenciasDeAvisos({ pastor }: { pastor: boolean }) {
  const [carga, recarregar] = useCarregar(minhasPreferenciasAvisos)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(prefs) => <Preferencias prefs={prefs} pastor={pastor} recarregar={recarregar} />}
    </MostrarCarga>
  )
}

function Preferencias({ prefs, pastor, recarregar }: { prefs: PreferenciasAvisos; pastor: boolean; recarregar: () => void }) {
  const [aparelho, setAparelho] = useState<EstadoNoAparelho | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string | null }>({})
  const [desligados, setDesligados] = useState<TipoEscolhivel[]>(prefs.tipos_desligados)
  const [silencio, setSilencio] = useState(prefs.silencio_noite)

  useEffect(() => {
    let ativo = true
    void estadoNoAparelho().then((e) => ativo && setAparelho(e))
    return () => {
      ativo = false
    }
  }, [prefs])

  async function salvar(mudanca: { tipos_desligados?: TipoEscolhivel[]; silencio_noite?: boolean }) {
    const r = await salvarPreferenciasAvisos(mudanca)
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Preferência guardada.' })
    if (r.erro !== null) recarregar()
  }

  async function ativarAqui() {
    setEnviando(true)
    const r = await ativarNoAparelho()
    if (r.estado !== 'perguntar' && r.estado !== 'ativo') await salvarPreferenciasAvisos({ resposta: 'ativar' })
    setEnviando(false)
    setAparelho(r.estado)
    setRetorno(r.erro ? { erro: r.erro } : { sucesso: textoDoEstado(r.estado) })
    recarregar()
  }

  async function pararAqui() {
    setEnviando(true)
    const erro = await desativarNoAparelho()
    setEnviando(false)
    setRetorno(erro ? { erro } : { sucesso: 'Este aparelho parou de receber os avisos. Eles continuam no sino.' })
    recarregar()
  }

  async function tirar(id: string) {
    const r = await cancelarInscricaoPush({ id })
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'O aparelho saiu da lista: ele não recebe mais os avisos.' })
    recarregar()
  }

  const tipos = TIPOS.filter((t) => t !== 'documentos' || pastor)
  return (
    <div className="preferencias-avisos">
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <section className="bloco" aria-labelledby="titulo-este-aparelho">
        <h2 id="titulo-este-aparelho">Neste aparelho</h2>
        {aparelho === null ? (
          <Carregando />
        ) : (
          <>
            <p className="texto-bloco">
              {aparelho === 'ativo'
                ? 'Os avisos chegam neste aparelho, mesmo com o aplicativo fechado.'
                : aparelho === 'perguntar' || (aparelho === 'parado' && prefs.ativou_em === null)
                  ? 'Este aparelho ainda não recebe os avisos.'
                  : textoDoEstado(aparelho)}
            </p>
            {(aparelho === 'perguntar' || aparelho === 'parado' || (aparelho === 'sem_envio' && prefs.ativou_em === null)) && (
              <button type="button" className="botao alinhar-esquerda" disabled={enviando} onClick={() => void ativarAqui()}>
                Receber os avisos neste aparelho
              </button>
            )}
            {aparelho === 'ativo' && (
              <button
                type="button"
                className="botao botao-secundario alinhar-esquerda"
                disabled={enviando}
                onClick={() => void pararAqui()}
              >
                Parar de receber neste aparelho
              </button>
            )}
          </>
        )}
      </section>

      <section className="bloco" aria-labelledby="titulo-o-que-chega">
        <h2 id="titulo-o-que-chega">O que chega no celular</h2>
        <p className="detalhe">No sino, aparece tudo. Os recados da secretaria e o seu pedido de associação chegam sempre.</p>
        {tipos.map((t) => (
          <Interruptor
            key={t}
            rotulo={NOME_DO_TIPO_AVISO[t]}
            ligado={!desligados.includes(t)}
            aoMudar={(ligar) => {
              const novos = ligar ? desligados.filter((d) => d !== t) : [...desligados, t]
              setDesligados(novos)
              void salvar({ tipos_desligados: novos })
            }}
          />
        ))}
        <Interruptor
          rotulo="Silêncio à noite"
          detalhe="das 22h às 7h, só o que for urgente"
          ligado={silencio}
          aoMudar={(v) => {
            setSilencio(v)
            void salvar({ silencio_noite: v })
          }}
        />
      </section>

      <section className="bloco" aria-labelledby="titulo-meus-aparelhos">
        <h2 id="titulo-meus-aparelhos">Os aparelhos que recebem</h2>
        {prefs.aparelhos.length === 0 ? (
          <p className="vazio">Nenhum aparelho recebe os avisos ainda.</p>
        ) : (
          <ul className="lista-linhas" aria-label="Aparelhos que recebem os avisos">
            {prefs.aparelhos.map((a) => (
              <li key={a.id} className="linha-aparelho">
                <Icone nome="aparelho" tamanho={20} />
                <span className="linha-corpo">
                  <strong>{a.aparelho ?? 'Aparelho'}</strong>
                  <span>
                    desde {formatarDataDeInstante(a.criado_em)}
                    {a.ultimo_envio_em ? ` · último aviso em ${formatarDataDeInstante(a.ultimo_envio_em)}` : ''}
                  </span>
                </span>
                <button type="button" className="botao-link" onClick={() => void tirar(a.id)}>
                  Tirar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
