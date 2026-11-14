// Fase 5.2 — Comissões: lista (todos com login), preparar e encerrar (presidência e secretaria), membros (só associados)
// e os registros do coordenador (reuniões, atividades e avisos da comissão).
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import {
  AREAS_SUGERIDAS,
  arquivarRegistro,
  buscarComissao,
  comissaoAtiva,
  definirCoordenador,
  encerrarComissao,
  incluirMembro,
  listarComissoes,
  NOME_DO_REGISTRO,
  NOME_DO_TIPO_COMISSAO,
  registrarNaComissao,
  retirarMembro,
  salvarComissao,
  type ComissaoCompleta,
  type DadosComissao,
  type TipoComissao,
  type TipoRegistroComissao,
} from '../../dados/comissoes'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }

function usePerfis(): readonly Perfil[] {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

/** Resposta 29: a presidência e a secretaria criam as comissões e indicam os membros. */
const cuida = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')

// ---------------------------------------------------------------------
// /comissoes
// ---------------------------------------------------------------------

export function ListaComissoes() {
  const perfis = usePerfis()
  const local = useLocation()
  const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarComissoes)
  const [hoje] = useState(hojeIso)
  return (
    <>
      <div className="cabecalho-tela">
        <h1>Comissões</h1>
        {cuida(perfis) && (
          <Link to="/comissoes/nova" className="botao">
            Nova comissão
          </Link>
        )}
      </div>
      <p className="detalhe">
        Comissões permanentes e temporárias do Conselho (educação, segurança, saúde, política, cidadania — Art. 3º, IV). Os membros
        são associados indicados pela diretoria (Art. 9º, III); o coordenador registra as reuniões e as atividades.
      </p>
      <Mensagem sucesso={mensagem} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ comissoes, membros }) => {
          const ativas = comissoes.filter((c) => comissaoAtiva(c, hoje))
          const antigas = comissoes.filter((c) => !comissaoAtiva(c, hoje))
          const linha = (c: (typeof comissoes)[number]) => {
            const dela = membros.filter((m) => m.comissao_id === c.id)
            const coordenador = dela.find((m) => m.coordenador)
            return (
              <li key={c.id}>
                <Link to={`/comissoes/${c.id}`} className="lista-item">
                  <strong>{c.nome}</strong>
                  <span>
                    {[NOME_DO_TIPO_COMISSAO[c.tipo], c.area, c.fim && `até ${formatarData(c.fim)}`].filter(Boolean).join(' · ')}
                  </span>
                  <span className="detalhe">
                    {dela.length} {dela.length === 1 ? 'membro' : 'membros'}
                    {coordenador && ` · coordenação: ${coordenador.nome ?? '—'}`}
                    {c.encerrada_em && ` · encerrada em ${formatarData(c.encerrada_em)}`}
                  </span>
                </Link>
              </li>
            )
          }
          return (
            <>
              {ativas.length === 0 ? (
                <p className="vazio">Nenhuma comissão em atividade.</p>
              ) : (
                <ul className="lista" aria-label="Comissões em atividade">
                  {ativas.map(linha)}
                </ul>
              )}
              {antigas.length > 0 && (
                <details className="acao-recolhida">
                  <summary>Encerradas ({antigas.length})</summary>
                  <ul className="lista" aria-label="Comissões encerradas">
                    {antigas.map(linha)}
                  </ul>
                </details>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

// ---------------------------------------------------------------------
// /comissoes/nova e /comissoes/:id/editar
// ---------------------------------------------------------------------

export function NovaComissao() {
  return <TelaFormulario id={null} />
}

export function EditarComissao() {
  const { id = '' } = useParams()
  return <TelaFormulario key={id} id={id} />
}

function TelaFormulario({ id }: { id: string | null }) {
  const perfis = usePerfis()
  const [carga, recarregar] = useCarregar(() => (id ? buscarComissao(id) : Promise.resolve(ok(null))))
  if (perfis.length === 0) return <Carregando />
  if (!cuida(perfis)) {
    return (
      <Aviso titulo="Sem permissão">
        <p>A presidência e a secretaria criam e alteram as comissões.</p>
      </Aviso>
    )
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to={id ? `/comissoes/${id}` : '/comissoes'}>← Voltar</Link>
      </p>
      <h1>{id ? 'Alterar a comissão' : 'Nova comissão'}</h1>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(comissao) =>
          id && (!comissao || comissao.encerrada_em) ? (
            <Aviso titulo="Não dá para alterar">
              <p>A comissão não foi encontrada ou já foi encerrada.</p>
            </Aviso>
          ) : (
            <FormComissao comissao={comissao} />
          )
        }
      </MostrarCarga>
    </>
  )
}

function FormComissao({ comissao }: { comissao: ComissaoCompleta | null }) {
  const navegar = useNavigate()
  const [d, setD] = useState<DadosComissao>({
    nome: comissao?.nome ?? '',
    tipo: comissao?.tipo ?? 'permanente',
    area: comissao?.area ?? '',
    finalidade: comissao?.finalidade ?? '',
    inicio: comissao?.inicio ?? hojeIso(),
    fim: comissao?.fim ?? '',
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  const mudar = (parte: Partial<DadosComissao>) => setD((atual) => ({ ...atual, ...parte }))
  return (
    <form
      aria-label="Comissão"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => {
          const r = await salvarComissao(comissao?.id ?? null, d)
          if (r.erro !== null) return setRetorno({ erro: r.erro })
          navegar(`/comissoes/${r.dados}`, { state: { mensagem: comissao ? 'Comissão alterada.' : 'Comissão criada. Indique os membros.' } })
        })
      }}
    >
      <div className="grade-form">
        <label className="largura-total">
          Nome *
          <input required minLength={3} maxLength={120} value={d.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Comissão de Educação" />
        </label>
        <label>
          Tipo *
          <select value={d.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoComissao })}>
            <option value="permanente">Permanente</option>
            <option value="temporaria">Temporária (com término)</option>
          </select>
        </label>
        <label>
          Área (Art. 3º, IV)
          <input list="areas-comissao" maxLength={80} value={d.area} onChange={(e) => mudar({ area: e.target.value })} />
          <datalist id="areas-comissao">
            {AREAS_SUGERIDAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <label>
          Início *
          <input type="date" required value={d.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </label>
        <label>
          Término {d.tipo === 'temporaria' && '*'}
          <input type="date" required={d.tipo === 'temporaria'} min={d.inicio} value={d.fim} onChange={(e) => mudar({ fim: e.target.value })} />
        </label>
        <label className="largura-total">
          Finalidade
          <textarea rows={4} maxLength={2000} value={d.finalidade} onChange={(e) => mudar({ finalidade: e.target.value })} />
        </label>
      </div>
      <Mensagem erro={retorno.erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {comissao ? 'Salvar alterações' : 'Criar a comissão'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// /comissoes/:id
// ---------------------------------------------------------------------

export function DetalheComissao() {
  const { id = '' } = useParams()
  return <ConteudoDetalhe key={id} id={id} />
}

function ConteudoDetalhe({ id }: { id: string }) {
  const perfis = usePerfis()
  const { estado } = useSessao()
  const minhaPessoa = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.pessoaId : null
  const local = useLocation()
  const [carga, recarregar] = useCarregar(() => buscarComissao(id))
  const [retorno, setRetorno] = useState<Retorno>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const [hoje] = useState(hojeIso)
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to="/comissoes">← Comissões</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(c) => {
          if (!c) {
            return (
              <Aviso titulo="Comissão não encontrada">
                <p>Ela pode ter sido arquivada.</p>
              </Aviso>
            )
          }
          const ativa = comissaoAtiva(c, hoje)
          const atuais = c.membros.filter((m) => !m.ate)
          const podeRegistrar = ativa && (cuida(perfis) || c.coordeno)
          return (
            <>
              <h1>{c.nome}</h1>
              <dl className="definicoes">
                <dt>Tipo</dt>
                <dd>{NOME_DO_TIPO_COMISSAO[c.tipo]}</dd>
                {c.area && (
                  <>
                    <dt>Área</dt>
                    <dd>{c.area}</dd>
                  </>
                )}
                <dt>Período</dt>
                <dd>
                  desde {formatarData(c.inicio)}
                  {c.fim && ` até ${formatarData(c.fim)}`}
                </dd>
                {c.encerrada_em && (
                  <>
                    <dt>Encerrada</dt>
                    <dd>
                      {formatarData(c.encerrada_em)} — {c.motivo_encerramento}
                    </dd>
                  </>
                )}
              </dl>
              {c.finalidade && <p className="texto-edital">{c.finalidade}</p>}
              {!ativa && !c.encerrada_em && <p className="aviso-texto">O prazo desta comissão temporária terminou.</p>}
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

              <section className="painel" aria-labelledby="titulo-membros-comissao">
                <h2 id="titulo-membros-comissao">Membros ({atuais.length})</h2>
                {atuais.length === 0 ? (
                  <p className="vazio">Nenhum membro indicado.</p>
                ) : (
                  <ul className="lista" aria-label="Membros da comissão">
                    {atuais.map((m) => (
                      <LinhaMembro key={m.id} m={m} pode={cuida(perfis) && ativa} comissaoId={c.id} aoConcluir={concluir} />
                    ))}
                  </ul>
                )}
                {cuida(perfis) && ativa && <IncluirMembro comissao={c} aoConcluir={concluir} />}
              </section>

              {/* os registros: os membros da comissão e a diretoria */}
              {(cuida(perfis) || atuais.some((m) => m.pessoa_id === minhaPessoa)) && (
                <Registros c={c} podeRegistrar={podeRegistrar} podeTirar={cuida(perfis) || c.coordeno} aoConcluir={concluir} />
              )}

              {cuida(perfis) && !c.encerrada_em && (
                <div className="acoes nao-imprimir">
                  <Link className="botao botao-secundario" to={`/comissoes/${c.id}/editar`}>
                    Alterar
                  </Link>
                </div>
              )}
              {cuida(perfis) && !c.encerrada_em && <Encerrar c={c} aoConcluir={concluir} />}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function LinhaMembro({
  m,
  pode,
  comissaoId,
  aoConcluir,
}: {
  m: ComissaoCompleta['membros'][number]
  pode: boolean
  comissaoId: string
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [enviando, umaVez] = useUmaVez()
  const nome = m.nome ?? 'Membro'
  return (
    <li className="lista-item lista-item-estatico" aria-label={nome}>
      <strong>
        {nome} {m.coordenador && <span className="etiqueta etiqueta-ok">Coordenação</span>}
      </strong>
      <span>desde {formatarData(m.desde)}</span>
      {pode && (
        <span className="acoes-linha">
          {!m.coordenador && (
            <button
              type="button"
              className="botao-texto"
              disabled={enviando}
              onClick={() => void umaVez(async () => aoConcluir(await definirCoordenador(comissaoId, m.pessoa_id), `${nome} agora coordena a comissão.`))}
            >
              Tornar coordenador
            </button>
          )}
          <button
            type="button"
            className="botao-texto"
            disabled={enviando}
            onClick={() => void umaVez(async () => aoConcluir(await retirarMembro(m.id, hojeIso()), `${nome} saiu da comissão.`))}
          >
            Tirar da comissão
          </button>
        </span>
      )}
    </li>
  )
}

function IncluirMembro({ comissao, aoConcluir }: { comissao: ComissaoCompleta; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [carga, recarregar] = useCarregar(async () => {
    const a = await listarAssociados()
    if (a.erro !== null) return a
    // só associados ativos (resposta 28), que ainda não estão na comissão
    const dentro = new Set(comissao.membros.filter((m) => !m.ate).map((m) => m.pessoa_id))
    return ok(a.dados.filter((x) => x.situacao === 'ativo' && !dentro.has(x.pessoa_id)))
  })
  const [pessoa, setPessoa] = useState('')
  const [coordenador, setCoordenador] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Indicar um membro</summary>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(associados) => (
          <form
            className="form-linha"
            aria-label="Indicar um membro"
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => {
                const r = await incluirMembro(comissao.id, pessoa, coordenador)
                aoConcluir(r, 'Membro indicado.')
                if (r.erro === null) {
                  setPessoa('')
                  setCoordenador(false)
                }
              })
            }}
          >
            <label>
              Associado *
              <select required value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
                <option value="">—</option>
                {associados.map((a) => (
                  <option key={a.pessoa_id} value={a.pessoa_id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="caixa-marcar">
              <input type="checkbox" checked={coordenador} onChange={(e) => setCoordenador(e.target.checked)} />
              Coordena a comissão
            </label>
            <button type="submit" className="botao" disabled={enviando}>
              Indicar
            </button>
          </form>
        )}
      </MostrarCarga>
    </details>
  )
}

function Registros({
  c,
  podeRegistrar,
  podeTirar,
  aoConcluir,
}: {
  c: ComissaoCompleta
  podeRegistrar: boolean
  podeTirar: boolean
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [tipo, setTipo] = useState<TipoRegistroComissao>('reuniao')
  const [data, setData] = useState(hojeIso)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel" aria-labelledby="titulo-registros-comissao">
      <h2 id="titulo-registros-comissao">Reuniões, atividades e avisos</h2>
      <p className="detalhe">Só os membros da comissão e a diretoria veem estes registros.</p>
      {c.registros.length === 0 ? (
        <p className="vazio">Nada registrado ainda.</p>
      ) : (
        <ul className="lista" aria-label="Registros da comissão">
          {c.registros.map((r) => (
            <li key={r.id} className="lista-item lista-item-estatico" aria-label={r.titulo}>
              <strong>
                <span className="etiqueta etiqueta-neutra">{NOME_DO_REGISTRO[r.tipo]}</span> {r.titulo}
              </strong>
              <span>{formatarData(r.data)}</span>
              {r.texto && <span className="texto-edital">{r.texto}</span>}
              {podeTirar && (
                <button
                  type="button"
                  className="botao-texto alinhar-esquerda"
                  disabled={enviando}
                  onClick={() => void umaVez(async () => aoConcluir(await arquivarRegistro(r.id), 'Registro tirado (fica guardado).'))}
                >
                  Tirar (registrado por engano)
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeRegistrar && (
        <details className="acao-recolhida">
          <summary>Registrar reunião, atividade ou aviso</summary>
          <form
            aria-label="Registrar na comissão"
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => {
                const r = await registrarNaComissao(c.id, { tipo, data, titulo, texto })
                aoConcluir(r, tipo === 'aviso' ? 'Aviso registrado.' : `${NOME_DO_REGISTRO[tipo]} registrada.`)
                if (r.erro === null) {
                  setTitulo('')
                  setTexto('')
                }
              })
            }}
          >
            <div className="grade-form">
              <label>
                Tipo
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRegistroComissao)}>
                  {(Object.keys(NOME_DO_REGISTRO) as TipoRegistroComissao[]).map((t) => (
                    <option key={t} value={t}>
                      {NOME_DO_REGISTRO[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data *
                <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label className="largura-total">
                Título *
                <input required minLength={3} maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </label>
              <label className="largura-total">
                O que foi tratado (ou o aviso)
                <textarea rows={4} maxLength={5000} value={texto} onChange={(e) => setTexto(e.target.value)} />
              </label>
            </div>
            <button type="submit" className="botao" disabled={enviando}>
              Registrar
            </button>
          </form>
        </details>
      )}
    </section>
  )
}

function Encerrar({ c, aoConcluir }: { c: ComissaoCompleta; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [data, setData] = useState(hojeIso)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida nao-imprimir">
      <summary>Encerrar a comissão</summary>
      <form
        className="form-linha"
        aria-label="Encerrar a comissão"
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => aoConcluir(await encerrarComissao(c.id, data, motivo), 'Comissão encerrada. O histórico fica guardado.'))
        }}
      >
        <label className="campo-curto">
          Data *
          <input type="date" required min={c.inicio} value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Motivo *
          <input required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: trabalho concluído" />
        </label>
        <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
          Encerrar
        </button>
      </form>
      <p className="detalhe">Os membros saem junto; nada se apaga.</p>
    </details>
  )
}
