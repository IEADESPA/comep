// Fase 4.1 — Assembleias e reuniões: lista, preparar (pauta e edital), convocar, cancelar e compartilhar.
// Quem prepara: secretaria ou presidência. Quem convoca assembleia: o presidente (Art. 16, §2º).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso, BotaoArquivar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados } from '../../dados/associados'
import {
  arquivarEncontro,
  buscarConfigAssembleias,
  buscarEncontro,
  cancelarEncontro,
  confirmarPresenca,
  convocarEncontro,
  justificarFalta,
  minhaParticipacao,
  listarEncontros,
  marcarMinhaPresenca,
  NOME_DA_MAIORIA,
  NOME_DA_SITUACAO_ENCONTRO,
  NOME_DO_TIPO,
  salvarEncontro,
  SIGLA_DO_TIPO,
  TIPOS_ENCONTRO,
  type ConfigAssembleias,
  type Encontro,
  type EncontroCompleto,
  type ItemPauta,
  type Maioria,
  type MinhaPresencaMarcada,
  type SituacaoEncontro,
  type TipoEncontro,
} from '../../dados/encontros'
import { ok, type Resultado } from '../../dados/cliente'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { ResultadoDaAssembleia } from './Conducao'
import { LeitorQr } from './LeitorQr'
import { horaDe, presencaAberta, useAgora } from './regras'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataHora } from '../../utilitarios/formatos'
import {
  avisosDaData,
  codigoDaPortaria,
  dataPorExtenso,
  diaEmParauapebas,
  doCampoDataHora,
  mesmasDatasNosProximosMeses,
  paraCampoDataHora,
  textoDoEdital,
  textoDoEditalParaWord,
  textoWhatsApp,
} from '../../utilitarios/encontros'

function usePerfis(): readonly Perfil[] {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

function useMinhaPessoa(): string | null {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.pessoaId : null
}

/** Associado (ministro ou presidente de igreja): confirma presença e justifica falta. */
const ehAssociado = (perfis: readonly Perfil[]) => perfis.includes('ministro') || perfis.includes('presidente_igreja')

const prepara = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')
/** Mesma regra do banco: assembleia, só o presidente; reunião mensal, a secretaria também. */
const conduz = (perfis: readonly Perfil[], tipo: TipoEncontro) =>
  tipo === 'reuniao_mensal' ? prepara(perfis) : perfis.includes('presidencia')

const CLASSE_SITUACAO: Record<SituacaoEncontro, string> = {
  agendado: 'etiqueta etiqueta-neutra',
  convocado: 'etiqueta etiqueta-ok',
  realizado: 'etiqueta etiqueta-marca',
  cancelado: 'etiqueta etiqueta-cancelada',
}

function Situacao({ situacao }: { situacao: SituacaoEncontro }) {
  return <span className={CLASSE_SITUACAO[situacao]}>{NOME_DA_SITUACAO_ENCONTRO[situacao]}</span>
}

/** Link da convocação no site (só assembleias convocadas aparecem lá; cancelada antes de convocar, não). */
function linkPublico(e: Pick<Encontro, 'id' | 'tipo' | 'convocado_em'>): string | null {
  if (e.tipo === 'reuniao_mensal' || !e.convocado_em) return null
  return `${window.location.origin}${import.meta.env.BASE_URL}convocacoes/${e.id}`
}

/** Item que pode desligar um associado por conduta (Art. 8º, II): AGO, votação de 3/5. Os outros casos a diretoria homologa. */
const itemDeDesligamento = (tipo: TipoEncontro, p: ItemPauta) =>
  tipo === 'ago' && p.deliberativo && p.maioria === 'tres_quintos' && !p.jubilacao_pessoa_id

/** Item que pode jubilar um associado (14/11/2026): votação de assembleia (AGO ou AGE), que não seja de desligamento. */
const itemDeJubilacao = (tipo: TipoEncontro, p: ItemPauta) => tipo !== 'reuniao_mensal' && p.deliberativo && !p.desligamento_pessoa_id

/** Reforma do estatuto pede 2/3 (Art. 21): avisa se o item fala de estatuto e a maioria é outra. */
const estatutoSemDoisTercos = (tipo: TipoEncontro, p: ItemPauta) =>
  tipo !== 'reuniao_mensal' && /estatut/i.test(p.titulo) && p.deliberativo && p.maioria !== 'dois_tercos'

// ---------------------------------------------------------------------
// /assembleias — lista
// ---------------------------------------------------------------------

export function ListaEncontros() {
  const perfis = usePerfis()
  const [carga, recarregar] = useCarregar(listarEncontros)
  const [mostrar, setMostrar] = useState<'proximos' | 'anteriores'>('proximos')
  const [agora] = useState(() => Date.now())
  return (
    <>
      <h1>Assembleias e reuniões</h1>
      <p className="detalhe">
        Assembleias Gerais Ordinárias (nos meses do Art. 16, §6º), Extraordinárias e reuniões mensais. A convocação das
        assembleias é do presidente, com a antecedência do estatuto (Art. 16, §2º — os números estão nas regras), e fica
        publicada no site.
      </p>
      {prepara(perfis) && (
        <div className="acoes">
          <Link className="botao" to="/assembleias/novo">
            Preparar assembleia ou reunião
          </Link>
          <Link className="botao botao-secundario" to="/assembleias/faltas">
            Faltas e justificativas
          </Link>
          <Link className="botao botao-secundario" to="/configuracoes#assembleias">
            Regras (prazos do estatuto)
          </Link>
        </div>
      )}
      <p>
        Os associados podem pedir uma Assembleia Extraordinária (Art. 16, §3º):{' '}
        <Link to="/assembleias/pedidos">pedidos de AGE e assinaturas</Link>.
      </p>
      <div className="abas" role="tablist" aria-label="Quais encontros">
        {(['proximos', 'anteriores'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mostrar === m}
            className={mostrar === m ? 'aba ativa' : 'aba'}
            onClick={() => setMostrar(m)}
          >
            {m === 'proximos' ? 'Próximos' : 'Anteriores'}
          </button>
        ))}
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(todos) => {
          const lista = todos
            .filter((e) => (mostrar === 'proximos' ? new Date(e.inicio).getTime() >= agora : new Date(e.inicio).getTime() < agora))
            .sort((a, b) => (mostrar === 'proximos' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)))
          if (lista.length === 0) {
            return <p className="vazio">{mostrar === 'proximos' ? 'Nenhum encontro marcado.' : 'Nenhum encontro anterior.'}</p>
          }
          return (
            <ul className="lista" aria-label="Encontros">
              {lista.map((e) => (
                <li key={e.id} className="lista-item lista-item-estatico" aria-label={e.titulo}>
                  <strong>
                    <span className="etiqueta etiqueta-neutra">{SIGLA_DO_TIPO[e.tipo]}</span> {e.titulo}
                  </strong>
                  <span>
                    {formatarDataHora(e.inicio)} · {e.local}
                  </span>
                  <span>
                    <Situacao situacao={e.situacao} />
                  </span>
                  <Link to={`/assembleias/${e.id}`} className="botao-texto alinhar-esquerda">
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
          )
        }}
      </MostrarCarga>
    </>
  )
}

// ---------------------------------------------------------------------
// /assembleias/novo e /assembleias/:id/editar — preparar
// ---------------------------------------------------------------------

export function NovoEncontro() {
  return <TelaFormulario id={null} />
}

export function EditarEncontro() {
  const { id = '' } = useParams()
  return <TelaFormulario key={id} id={id} />
}

function TelaFormulario({ id }: { id: string | null }) {
  const perfis = usePerfis()
  const [carga, recarregar] = useCarregar(async () => {
    const [config, encontro, associados] = await Promise.all([
      buscarConfigAssembleias(),
      id ? buscarEncontro(id) : Promise.resolve(ok(null)),
      listarAssociados(),
    ])
    if (config.erro !== null) return config
    if (encontro.erro !== null) return encontro
    if (associados.erro !== null) return associados
    return ok({
      config: config.dados,
      encontro: encontro.dados,
      // quem pode ser desligado: associado ativo
      associados: associados.dados
        .filter((a) => a.situacao === 'ativo')
        .map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome, jubilado: a.jubilado })),
    })
  })
  if (perfis.length === 0) return <Carregando />
  if (!prepara(perfis)) {
    return (
      <Aviso titulo="Sem permissão">
        <p>Só a secretaria ou a presidência preparam assembleias e reuniões.</p>
      </Aviso>
    )
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to={id ? `/assembleias/${id}` : '/assembleias'}>← Voltar</Link>
      </p>
      <h1>{id ? 'Alterar o encontro' : 'Preparar assembleia ou reunião'}</h1>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ config, encontro, associados }) =>
          id && (!encontro || encontro.situacao !== 'agendado') ? (
            <Aviso titulo="Não dá para alterar">
              <p>Depois de convocado, o encontro não muda. Para mudar, cancele e convoque de novo.</p>
            </Aviso>
          ) : (
            <FormEncontro config={config} encontro={encontro} associados={associados} />
          )
        }
      </MostrarCarga>
    </>
  )
}

type Rascunho = {
  tipo: TipoEncontro
  titulo: string
  /** campo data e hora, hora de Parauapebas */
  inicio: string
  local: string
  edital: string
  fundamento: string
  pauta: ItemPauta[]
}

const ITEM_VAZIO: ItemPauta = { titulo: '', descricao: null, deliberativo: false, maioria: null }

function tituloSugerido(tipo: TipoEncontro, inicio: string): string {
  if (!inicio) return NOME_DO_TIPO[tipo]
  const d = new Date(doCampoDataHora(inicio))
  const mesAno = d.toLocaleDateString('pt-BR', { timeZone: 'America/Belem', month: 'long', year: 'numeric' })
  return `${NOME_DO_TIPO[tipo]} — ${mesAno}`
}

function FormEncontro({
  config,
  encontro,
  associados,
}: {
  config: ConfigAssembleias
  encontro: EncontroCompleto | null
  associados: { pessoa_id: string; nome: string; jubilado: boolean }[]
}) {
  const navegar = useNavigate()
  const [r, setR] = useState<Rascunho>(() =>
    encontro
      ? {
          tipo: encontro.tipo,
          titulo: encontro.titulo,
          inicio: paraCampoDataHora(encontro.inicio),
          local: encontro.local,
          edital: encontro.edital ?? '',
          fundamento: encontro.fundamento ?? '',
          pauta: encontro.pauta.map(({ titulo, descricao, deliberativo, maioria, desligamento_pessoa_id, jubilacao_pessoa_id }) => ({
            titulo,
            descricao,
            deliberativo,
            maioria,
            desligamento_pessoa_id,
            jubilacao_pessoa_id,
          })),
        }
      : { tipo: 'ago', titulo: '', inicio: '', local: '', edital: '', fundamento: '', pauta: [{ ...ITEM_VAZIO }] },
  )
  const [repetir, setRepetir] = useState(0)
  const [retorno, setRetorno] = useState<{ erro?: string }>({})
  const [enviando, umaVez] = useUmaVez()
  const [agora] = useState(() => Date.now())
  const hoje = diaEmParauapebas(new Date(agora))
  const avisos = useMemo(
    () => (r.inicio ? avisosDaData(r.tipo, doCampoDataHora(r.inicio), config, hoje, agora) : []),
    [r.tipo, r.inicio, config, hoje, agora],
  )
  // o edital foi gerado antes e não traz a data ou o local de agora
  const editalDesatualizado =
    r.edital.trim() !== '' &&
    r.inicio !== '' &&
    (!r.edital.includes(dataPorExtenso(doCampoDataHora(r.inicio))) || (r.local.trim() !== '' && !r.edital.includes(r.local.trim())))
  const mudar = (parte: Partial<Rascunho>) => setR((atual) => ({ ...atual, ...parte }))
  const mudarItem = (i: number, parte: Partial<ItemPauta>) =>
    setR((atual) => ({ ...atual, pauta: atual.pauta.map((p, j) => (j === i ? { ...p, ...parte } : p)) }))
  const moverItem = (i: number, d: -1 | 1) =>
    setR((atual) => {
      const j = i + d
      if (j < 0 || j >= atual.pauta.length) return atual
      const pauta = [...atual.pauta]
      ;[pauta[i], pauta[j]] = [pauta[j], pauta[i]]
      return { ...atual, pauta }
    })

  function dados(inicio: string) {
    return {
      tipo: r.tipo,
      titulo: r.titulo.trim() || tituloSugerido(r.tipo, r.inicio),
      inicio,
      local: r.local,
      edital: r.edital,
      fundamento: r.tipo === 'age' ? r.fundamento : '',
      pauta: r.pauta
        .filter((p) => p.titulo.trim())
        .map((p) => ({
          titulo: p.titulo.trim(),
          descricao: p.descricao?.trim() || null,
          deliberativo: r.tipo !== 'reuniao_mensal' && p.deliberativo,
          maioria: r.tipo !== 'reuniao_mensal' && p.deliberativo ? (p.maioria ?? 'simples') : null,
          desligamento_pessoa_id: itemDeDesligamento(r.tipo, p) ? p.desligamento_pessoa_id || null : null,
          jubilacao_pessoa_id: itemDeJubilacao(r.tipo, p) ? p.jubilacao_pessoa_id || null : null,
        })),
    }
  }

  return (
    <form
      aria-label="Encontro"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => {
          const inicio = doCampoDataHora(r.inicio)
          const res = await salvarEncontro(encontro?.id ?? null, dados(inicio))
          if (res.erro !== null) return setRetorno({ erro: res.erro })
          // reunião mensal: cria também as dos próximos meses (mesma semana e dia da semana)
          if (!encontro && r.tipo === 'reuniao_mensal' && repetir > 0) {
            const dataDaPrimeira = dataPorExtenso(inicio)
            for (const data of mesmasDatasNosProximosMeses(inicio, repetir)) {
              // o título escolhido continua, com o mês de cada uma
              const mes = tituloSugerido('reuniao_mensal', paraCampoDataHora(data))
              const titulo = r.titulo.trim() ? `${r.titulo.trim()} — ${mes.split(' — ')[1]}` : mes
              // o edital de cada uma leva a data dela; se o texto não traz a data da primeira, fica em branco
              const edital = r.edital.includes(dataDaPrimeira) ? r.edital.replaceAll(dataDaPrimeira, dataPorExtenso(data)) : ''
              const outra = await salvarEncontro(null, { ...dados(data), titulo, edital })
              if (outra.erro !== null) return setRetorno({ erro: `A primeira foi criada, mas não as seguintes: ${outra.erro}` })
            }
          }
          navegar(`/assembleias/${res.dados}`, { state: { mensagem: encontro ? 'Alterações salvas.' : 'Encontro preparado. Confira e convoque.' } })
        })
      }}
    >
      <div className="grade-form">
        <label>
          Tipo *
          <select value={r.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoEncontro })}>
            {TIPOS_ENCONTRO.map((t) => (
              <option key={t} value={t}>
                {NOME_DO_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data e hora (1ª chamada) *
          <input type="datetime-local" required value={r.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </label>
        <label className="largura-total">
          Título
          <input value={r.titulo} maxLength={200} onChange={(e) => mudar({ titulo: e.target.value })} placeholder={tituloSugerido(r.tipo, r.inicio)} />
        </label>
        <label className="largura-total">
          Local *
          <input required maxLength={300} value={r.local} onChange={(e) => mudar({ local: e.target.value })} placeholder="Ex.: Sede do COMEP — endereço" />
        </label>
        {r.tipo === 'age' && (
          <label className="largura-total">
            Quem pediu a Assembleia Extraordinária? * (Art. 16, §3º)
            <input
              required
              maxLength={1000}
              value={r.fundamento}
              onChange={(e) => mudar({ fundamento: e.target.value })}
              placeholder="Ex.: maioria do Conselho Diretor, reunião de 10/11/2026 — ou pedido assinado por 3/5 dos associados"
            />
          </label>
        )}
      </div>
      {avisos.length > 0 && (
        <ul className="lista-pendencias" aria-label="Prazos">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <fieldset className="pauta-campos">
        <legend>Pauta</legend>
        {r.tipo === 'reuniao_mensal' && (
          <p className="detalhe">Reunião mensal não tem votação de assembleia: os itens são de informe ou conversa.</p>
        )}
        <ol className="pauta-lista">
          {r.pauta.map((p, i) => (
            <li key={i} className="pauta-item">
              <label>
                Item {i + 1}
                <input
                  aria-label={`Item ${i + 1} da pauta`}
                  maxLength={300}
                  value={p.titulo}
                  onChange={(e) => mudarItem(i, { titulo: e.target.value })}
                  placeholder="Ex.: Prestação de contas do exercício 2026/2027"
                />
              </label>
              {r.tipo !== 'reuniao_mensal' && (
                <div className="form-linha">
                  <label className="caixa-marcar">
                    <input
                      type="checkbox"
                      checked={p.deliberativo}
                      onChange={(e) => mudarItem(i, { deliberativo: e.target.checked, maioria: e.target.checked ? (p.maioria ?? 'simples') : null })}
                    />
                    Vai a votação
                  </label>
                  {p.deliberativo && (
                    <label>
                      Maioria exigida
                      <select value={p.maioria ?? 'simples'} onChange={(e) => mudarItem(i, { maioria: e.target.value as Maioria })}>
                        {(Object.keys(NOME_DA_MAIORIA) as Maioria[]).map((m) => (
                          <option key={m} value={m}>
                            {NOME_DA_MAIORIA[m]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {itemDeDesligamento(r.tipo, p) && (
                    <label>
                      Desligamento por conduta de (Art. 8º, II)
                      <select
                        aria-label={`Desligamento de (item ${i + 1})`}
                        value={p.desligamento_pessoa_id ?? ''}
                        onChange={(e) => mudarItem(i, { desligamento_pessoa_id: e.target.value || null })}
                      >
                        <option value="">Não é desligamento</option>
                        {associados.map((a) => (
                          <option key={a.pessoa_id} value={a.pessoa_id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {itemDeJubilacao(r.tipo, p) && (
                    <label>
                      Jubilação de
                      <select
                        aria-label={`Jubilação de (item ${i + 1})`}
                        value={p.jubilacao_pessoa_id ?? ''}
                        onChange={(e) => mudarItem(i, { jubilacao_pessoa_id: e.target.value || null })}
                      >
                        <option value="">Não é jubilação</option>
                        {associados
                          .filter((a) => !a.jubilado)
                          .map((a) => (
                            <option key={a.pessoa_id} value={a.pessoa_id}>
                              {a.nome}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {p.jubilacao_pessoa_id && itemDeJubilacao(r.tipo, p) && (
                <label>
                  Documento da denominação (jubilação) *
                  <input
                    aria-label={`Documento da jubilação (item ${i + 1})`}
                    required
                    maxLength={1000}
                    value={p.descricao ?? ''}
                    onChange={(e) => mudarItem(i, { descricao: e.target.value })}
                    placeholder="Ex.: Ofício nº 12/2026 da Convenção, de 05/11/2026"
                  />
                </label>
              )}
              {estatutoSemDoisTercos(r.tipo, p) && (
                <p className="aviso-texto">A reforma do estatuto pede 2/3 dos votos válidos (Art. 21). Confira a maioria exigida.</p>
              )}
              {itemDeDesligamento(r.tipo, p) && !p.desligamento_pessoa_id && (
                <p className="detalhe">
                  Desligamento por conduta (Art. 8º, II) só na AGO, por 3/5: indique já na convocação quem será votado — na assembleia
                  não muda. Os outros casos (a pedido, transferência, faltas, falecimento) a diretoria homologa na ficha do associado.
                </p>
              )}
              <span className="acoes-linha">
                <button type="button" className="botao-texto" disabled={i === 0} onClick={() => moverItem(i, -1)}>
                  Subir
                </button>
                <button type="button" className="botao-texto" disabled={i === r.pauta.length - 1} onClick={() => moverItem(i, 1)}>
                  Descer
                </button>
                <button
                  type="button"
                  className="botao-texto"
                  onClick={() => setR((atual) => ({ ...atual, pauta: atual.pauta.filter((_, j) => j !== i) }))}
                >
                  Tirar
                </button>
              </span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="botao botao-secundario"
          disabled={r.pauta.length >= 50}
          onClick={() => setR((atual) => ({ ...atual, pauta: [...atual.pauta, { ...ITEM_VAZIO }] }))}
        >
          + Item da pauta
        </button>
      </fieldset>

      <label className="largura-total">
        Texto do edital {r.tipo !== 'reuniao_mensal' && '* (obrigatório para convocar)'}
        <textarea rows={12} maxLength={6000} value={r.edital} onChange={(e) => mudar({ edital: e.target.value })} />
      </label>
      {editalDesatualizado && (
        <p className="aviso-texto" role="status">
          O texto do edital não traz a data ou o local de agora. Gere o texto de novo ou ajuste antes de convocar.
        </p>
      )}
      <div className="acoes">
        <button
          type="button"
          className="botao botao-secundario"
          disabled={!r.inicio}
          onClick={() =>
            mudar({
              edital: textoDoEdital({
                tipo: r.tipo,
                inicio: doCampoDataHora(r.inicio),
                local: r.local,
                fundamento: r.fundamento,
                pauta: r.pauta,
                minutosSegundaChamada: config.minutos_segunda_chamada,
                hoje: new Date(),
              }),
            })
          }
        >
          {r.edital ? 'Gerar o texto do edital de novo (substitui o atual)' : 'Gerar o texto do edital'}
        </button>
      </div>

      {!encontro && r.tipo === 'reuniao_mensal' && (
        <label className="campo-medio">
          Criar também para os próximos meses (mesma semana e dia da semana)
          <select value={repetir} onChange={(e) => setRepetir(Number(e.target.value))}>
            <option value={0}>Não, só esta</option>
            {[1, 2, 3, 5, 11].map((n) => (
              <option key={n} value={n}>
                Mais {n} {n === 1 ? 'mês' : 'meses'}
              </option>
            ))}
          </select>
        </label>
      )}

      <Mensagem erro={retorno.erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {encontro ? 'Salvar alterações' : 'Salvar (ainda sem convocar)'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// /assembleias/:id — detalhe, convocar, cancelar, compartilhar
// ---------------------------------------------------------------------

export function DetalheEncontro() {
  const { id = '' } = useParams()
  return <ConteudoDetalhe key={id} id={id} />
}

function ConteudoDetalhe({ id }: { id: string }) {
  const perfis = usePerfis()
  const pessoaId = useMinhaPessoa()
  const navegar = useNavigate()
  const local = useLocation()
  const [carga, recarregar] = useCarregar(() => buscarEncontro(id))
  // mensagem trazida da tela anterior (ex.: "Encontro preparado")
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const [enviando, umaVez] = useUmaVez()
  const [perguntando, setPerguntando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
      <p className="nao-imprimir">
        <Link to="/assembleias">← Assembleias e reuniões</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(e) => {
          if (!e) {
            return (
              <Aviso titulo="Encontro não encontrado">
                <p>Ele pode ter sido arquivado, ou ainda não foi convocado.</p>
              </Aviso>
            )
          }
          const link = linkPublico(e)
          const podeConduzir = conduz(perfis, e.tipo)
          return (
            <>
              <h1>{e.titulo}</h1>
              <p>
                <span className="etiqueta etiqueta-neutra">{NOME_DO_TIPO[e.tipo]}</span> <Situacao situacao={e.situacao} />
              </p>
              <dl className="definicoes">
                <dt>Quando</dt>
                <dd>{dataPorExtenso(e.inicio)} (1ª chamada)</dd>
                <dt>Local</dt>
                <dd>{e.local}</dd>
                {e.fundamento && (
                  <>
                    <dt>Pedida por</dt>
                    <dd>{e.fundamento}</dd>
                  </>
                )}
                {e.convocado_em && (
                  <>
                    <dt>Convocada em</dt>
                    <dd>{formatarDataHora(e.convocado_em)}</dd>
                  </>
                )}
                {e.situacao === 'cancelado' && (
                  <>
                    <dt>Cancelada em</dt>
                    <dd>
                      {e.cancelado_em ? formatarDataHora(e.cancelado_em) : '—'} — {e.motivo_cancelamento}
                    </dd>
                  </>
                )}
              </dl>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

              <section className="painel" aria-labelledby="titulo-pauta">
                <h2 id="titulo-pauta">Pauta</h2>
                {e.pauta.length === 0 ? (
                  <p className="vazio">Sem itens.</p>
                ) : (
                  <ol className="pauta-lista" aria-label="Pauta">
                    {e.pauta.map((p) => (
                      <li key={p.ordem}>
                        <strong>{p.titulo}</strong>
                        {p.deliberativo && p.maioria && <span className="detalhe"> — votação: {NOME_DA_MAIORIA[p.maioria]}</span>}
                        {p.descricao && <p className="detalhe">{p.descricao}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {e.edital && (
                <section className="painel edital" aria-labelledby="titulo-edital">
                  <h2 id="titulo-edital">Edital</h2>
                  <p className="texto-edital">{e.edital}</p>
                </section>
              )}

              {e.tipo !== 'reuniao_mensal' && (e.situacao === 'convocado' || e.situacao === 'realizado') && <ResultadoDaAssembleia e={e} />}

              {ehAssociado(perfis) && pessoaId && (e.situacao === 'convocado' || e.situacao === 'realizado') && (
                <Participacao e={e} pessoaId={pessoaId} />
              )}

              {/* Ações de quem prepara e de quem convoca */}
              <div className="acoes nao-imprimir">
                {(e.situacao === 'convocado' || e.situacao === 'realizado') && prepara(perfis) && (
                  <>
                    <Link className="botao" to={`/assembleias/presenca/${e.id}`}>
                      Presença
                    </Link>
                    <Link className="botao" to={`/assembleias/conducao/${e.id}`}>
                      Condução
                    </Link>
                    <Link className="botao" to={`/assembleias/fechamento/${e.id}`}>
                      {e.tipo === 'reuniao_mensal' ? 'Fechamento e resoluções' : 'Fechamento e ata'}
                    </Link>
                  </>
                )}
                {e.situacao === 'agendado' && prepara(perfis) && (
                  <Link className="botao botao-secundario" to={`/assembleias/${e.id}/editar`}>
                    Alterar
                  </Link>
                )}
                {e.situacao === 'agendado' && podeConduzir && !perguntando && (
                  <button type="button" className="botao" onClick={() => setPerguntando(true)}>
                    {e.tipo === 'reuniao_mensal' ? 'Publicar a reunião' : 'Convocar a assembleia'}
                  </button>
                )}
                {e.situacao === 'agendado' && podeConduzir && perguntando && (
                  <span className="confirmar-linha">
                    <button
                      type="button"
                      className="botao botao-perigo-cheio"
                      disabled={enviando}
                      onClick={() =>
                        void umaVez(async () => {
                          setPerguntando(false)
                          concluir(
                            await convocarEncontro(e.id),
                            e.tipo === 'reuniao_mensal' ? 'Reunião publicada.' : 'Assembleia convocada: já aparece no site.',
                          )
                        })
                      }
                    >
                      {e.tipo === 'reuniao_mensal' ? 'Confirmar — publicar' : 'Confirmar — convocar (não muda mais)'}
                    </button>
                    <button type="button" className="botao-texto" onClick={() => setPerguntando(false)}>
                      Não
                    </button>
                  </span>
                )}
                {e.situacao === 'agendado' && prepara(perfis) && !podeConduzir && (
                  <span className="detalhe">Pronta? Peça ao presidente para convocar (Art. 16, §2º).</span>
                )}
                {e.situacao === 'convocado' && (
                  <a
                    className="botao botao-secundario"
                    href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp({ ...e, link }))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Compartilhar no WhatsApp
                  </a>
                )}
                {e.edital && (
                  <button type="button" className="botao botao-secundario" onClick={() => window.print()}>
                    Imprimir o edital
                  </button>
                )}
                {e.edital && prepara(perfis) && (
                  <button
                    type="button"
                    className="botao botao-secundario"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(textoDoEditalParaWord(e.edital ?? '', e.tipo))
                        .then(() => setRetorno({ sucesso: 'Texto do edital copiado: cole no Word para fazer o oficial.' }))
                        .catch(() => setRetorno({ erro: 'Não deu para copiar sozinho: selecione o texto do edital e copie.' }))
                    }
                  >
                    Copiar o edital para o Word
                  </button>
                )}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer">
                    Ver no site
                  </a>
                )}
                {(e.situacao === 'agendado' || e.situacao === 'cancelado') && prepara(perfis) && (
                  <BotaoArquivar
                    rotulo={`Arquivar ${e.titulo}`}
                    aoConfirmar={() =>
                      void umaVez(async () => {
                        const r = await arquivarEncontro(e.id)
                        if (r.erro !== null) setRetorno({ erro: r.erro })
                        else navegar('/assembleias')
                      })
                    }
                  />
                )}
              </div>

              {(e.situacao === 'agendado' || e.situacao === 'convocado') && podeConduzir && !e.instalada_em && (
                <details className="acao-recolhida nao-imprimir">
                  <summary>Cancelar este encontro</summary>
                  <form
                    className="form-linha"
                    aria-label="Cancelar o encontro"
                    onSubmit={(ev) => {
                      ev.preventDefault()
                      void umaVez(async () => {
                        concluir(await cancelarEncontro(e.id, motivo), 'Encontro cancelado.')
                        setMotivo('')
                      })
                    }}
                  >
                    <label>
                      Motivo *
                      <input required value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ex.: mudança de local" />
                    </label>
                    <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                      Cancelar o encontro
                    </button>
                  </form>
                  <p className="detalhe">
                    {e.situacao === 'convocado' && e.tipo !== 'reuniao_mensal'
                      ? 'O site passa a mostrar "cancelada", com o motivo. Para uma nova data, prepare e convoque de novo (com o prazo do estatuto).'
                      : 'Nada se apaga: o encontro fica registrado como cancelado.'}
                  </p>
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
// O associado: "vou participar" e justificar a falta (o 1º secretário decide)
// ---------------------------------------------------------------------

function Participacao({ e, pessoaId }: { e: EncontroCompleto; pessoaId: string }) {
  const [carga, recarregar] = useCarregar(() => minhaParticipacao(e.id, pessoaId))
  const [texto, setTexto] = useState('')
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [enviando, umaVez] = useUmaVez()
  const agora = useAgora(30)
  const futuro = e.situacao === 'convocado' && new Date(e.inicio).getTime() > agora
  const aberta = presencaAberta(e, agora)
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  const marcou = (r: Resultado<MinhaPresencaMarcada>) => {
    if (r.erro !== null) return setRetorno({ erro: r.erro })
    const hora = horaDe(r.dados.presente_em)
    setRetorno({
      sucesso:
        (r.dados.resultado === 'ja_presente' ? `Sua presença já estava marcada (às ${hora}).` : `Presença marcada às ${hora}.`) +
        (r.dados.em_dia ? '' : ' Para votar, é preciso estar em dia com as mensalidades.'),
    })
    recarregar()
  }
  // o QR da portaria abre esta página com ?portaria=CÓDIGO: marca sozinho, uma vez, e tira o código do endereço
  const [busca, setBusca] = useSearchParams()
  const codigoDoQr = codigoDaPortaria(busca.get('portaria') ?? '')
  const jaTentou = useRef(false)
  useEffect(() => {
    if (!codigoDoQr || jaTentou.current) return
    jaTentou.current = true
    void umaVez(async () => {
      marcou(await marcarMinhaPresenca(e.id, codigoDoQr, true))
      setBusca(
        (b) => {
          b.delete('portaria')
          return b
        },
        { replace: true },
      )
    })
  })
  return (
    <section className="painel nao-imprimir" aria-labelledby="titulo-participacao">
      <h2 id="titulo-participacao">Minha participação</h2>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(p) => (
          <>
            {p.presente_em && aberta ? (
              <p>
                <span className="etiqueta etiqueta-ok">Presença marcada às {horaDe(p.presente_em)}</span>
              </p>
            ) : p.presente_em ? (
              <p>
                <span className="etiqueta etiqueta-ok">Você esteve presente</span> (registrado em {formatarDataHora(p.presente_em)}).
              </p>
            ) : (
              futuro && (
                <div className="acoes">
                  {p.confirmou_em ? (
                    <>
                      <span className="etiqueta etiqueta-ok">Você confirmou que vai</span>
                      <button
                        type="button"
                        className="botao-texto"
                        disabled={enviando}
                        onClick={() => void umaVez(async () => concluir(await confirmarPresenca(e.id, false), 'Confirmação retirada.'))}
                      >
                        Não vou mais
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="botao"
                      disabled={enviando}
                      onClick={() => void umaVez(async () => concluir(await confirmarPresenca(e.id, true), 'Presença confirmada. No dia, mostre a credencial.'))}
                    >
                      Vou participar
                    </button>
                  )}
                </div>
              )
            )}
            {!p.presente_em && aberta && (
              <MarcarMinhaPresenca
                e={e}
                enviando={enviando}
                aoMarcar={(c, peloQr) => void umaVez(async () => marcou(await marcarMinhaPresenca(e.id, c, peloQr)))}
              />
            )}
            {!p.presente_em && p.justificativa && (
              <p>
                Justificativa de falta:{' '}
                {p.justificativa.situacao === 'pendente' ? (
                  <span className="etiqueta etiqueta-conferencia">em análise pelo 1º secretário</span>
                ) : p.justificativa.situacao === 'aceita' ? (
                  <span className="etiqueta etiqueta-ok">aceita</span>
                ) : (
                  <span className="etiqueta etiqueta-atraso">recusada: {p.justificativa.motivo_decisao}</span>
                )}
                <br />
                <q>{p.justificativa.texto}</q>
              </p>
            )}
            {!p.presente_em && (!p.justificativa || p.justificativa.situacao === 'pendente') && (
              <details className="acao-recolhida">
                <summary>{futuro ? 'Não vou poder ir: justificar a falta' : 'Justificar a falta'}</summary>
                <form
                  aria-label="Justificar a falta"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    void umaVez(async () => {
                      concluir(await justificarFalta(e.id, texto), 'Justificativa enviada ao 1º secretário.')
                      setTexto('')
                    })
                  }}
                >
                  <label>
                    Justificativa *
                    <textarea required minLength={3} maxLength={1000} rows={3} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
                  </label>
                  <button type="submit" className="botao" disabled={enviando}>
                    {p.justificativa ? 'Enviar de novo (substitui a anterior)' : 'Enviar justificativa'}
                  </button>
                </form>
                <p className="detalhe">Vale até 30 dias depois do encontro. O 1º secretário aceita ou recusa.</p>
              </details>
            )}
          </>
        )}
      </MostrarCarga>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
    </section>
  )
}

/** No dia do encontro: o ministro marca a presença lendo o QR da portaria ou digitando o código da tela da entrada. */
function MarcarMinhaPresenca({
  e,
  enviando,
  aoMarcar,
}: {
  e: Pick<Encontro, 'tipo'>
  enviando: boolean
  aoMarcar: (codigo: string, peloQr: boolean) => void
}) {
  const [codigo, setCodigo] = useState('')
  return (
    <div className="marcar-presenca" role="group" aria-labelledby="titulo-marcar-presenca">
      <h3 id="titulo-marcar-presenca">Marcar a minha presença</h3>
      <p className="detalhe">
        Leia o QR Code da portaria, ou digite o código que está na tela da entrada
        {e.tipo === 'reuniao_mensal' ? '.' : ' (a secretaria também pode ler a sua credencial).'}
      </p>
      <LeitorQr
        aoLer={(c) => aoMarcar(c, true)}
        interpretar={codigoDaPortaria}
        textoDoBotao="Ler o QR Code da portaria"
        rotuloDaCamera="Câmera para ler o QR Code da portaria"
        semLeitor="Este navegador não lê QR Code aqui dentro: aponte a câmera do celular para o QR da portaria (ele abre esta página já com o código) ou digite o código abaixo."
      />
      <form
        className="form-linha"
        aria-label="Marcar a minha presença pelo código"
        onSubmit={(ev) => {
          ev.preventDefault()
          aoMarcar(codigo, false)
          setCodigo('')
        }}
      >
        <label>
          Ou digite o código
          <input
            className="campo-codigo"
            required
            minLength={6}
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={codigo}
            onChange={(ev) => setCodigo(ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="K7Q2M9"
          />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Marcar presença
        </button>
      </form>
    </div>
  )
}
