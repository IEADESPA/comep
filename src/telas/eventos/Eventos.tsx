// Fase 5.3 — Eventos e projetos: lista (todos com login), preparar e publicar (secretaria — o secretário executivo é o
// responsável pelos eventos — e presidência), orçamento aprovado pela assembleia, inscrições (com a taxa) e as finanças.
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoArquivar, BotaoConfirmarNaLinha, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { listarEncontros } from '../../dados/encontros'
import {
  aprovarOrcamento,
  arquivarEvento,
  buscarEvento,
  cancelarEvento,
  cancelarInscricao,
  cancelarInscricoesSemPagamento,
  concluirEvento,
  financasDoEvento,
  inscrever,
  lancamentosRecentes,
  ligarLancamentoEvento,
  listarEventos,
  listarInscricoes,
  NOME_DA_SITUACAO_EVENTO,
  NOME_DA_SITUACAO_INSCRICAO,
  NOME_DO_TIPO_EVENTO,
  publicarEvento,
  registrarPagamentoInscricao,
  salvarEvento,
  type DadosEvento,
  type Evento,
  type Inscricao,
  type TipoEvento,
} from '../../dados/eventos'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { doCampoDataHora, paraCampoDataHora } from '../../utilitarios/encontros'
import { formatarDataHora, hojeIso } from '../../utilitarios/formatos'
import { DICA_VALOR, lerValor, PADRAO_VALOR, valorParaCampo } from '../../utilitarios/valores'

type Retorno = { sucesso?: string; erro?: string }

function useConta() {
  const { estado } = useSessao()
  const conta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta : null
  return { perfis: (conta?.perfis ?? []) as readonly Perfil[], pessoaId: conta?.pessoaId ?? null, nome: conta?.nome ?? '' }
}

/** Preparam e publicam: a secretaria (o secretário executivo tem este perfil) e a presidência. */
const cuida = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')
const financeiro = (perfis: readonly Perfil[]) => perfis.includes('tesouraria') || perfis.includes('presidencia')

const CLASSE: Record<Evento['situacao'], string> = {
  rascunho: 'etiqueta etiqueta-neutra',
  publicado: 'etiqueta etiqueta-ok',
  realizado: 'etiqueta etiqueta-marca',
  cancelado: 'etiqueta etiqueta-cancelada',
}

function linkDaAgenda(id: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}agenda/${id}`
}

// ---------------------------------------------------------------------
// /eventos
// ---------------------------------------------------------------------

export function ListaEventos() {
  const { perfis } = useConta()
  const local = useLocation()
  const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(listarEventos)
  const [mostrar, setMostrar] = useState<'proximos' | 'anteriores'>('proximos')
  const [agora] = useState(() => Date.now())
  return (
    <>
      <div className="cabecalho-tela">
        <h1>Eventos e projetos</h1>
        {cuida(perfis) && (
          <Link to="/eventos/novo" className="botao">
            Novo evento ou projeto
          </Link>
        )}
      </div>
      <p className="detalhe">
        Encontros, seminários, conferências e projetos do Conselho (Art. 3º, VII). O orçamento é aprovado pela assembleia; a
        inscrição pode ser aberta ao público pelo site.
      </p>
      <Mensagem sucesso={mensagem} />
      <div className="abas" role="tablist" aria-label="Quais eventos">
        {(['proximos', 'anteriores'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mostrar === m} className={mostrar === m ? 'aba ativa' : 'aba'} onClick={() => setMostrar(m)}>
            {m === 'proximos' ? 'Próximos' : 'Anteriores'}
          </button>
        ))}
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(eventos) => {
          const fimDe = (e: Evento) => new Date(e.fim ?? e.inicio).getTime()
          const lista = eventos
            .filter((e) => (mostrar === 'proximos' ? fimDe(e) >= agora : fimDe(e) < agora))
            .sort((a, b) => (mostrar === 'proximos' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)))
          if (lista.length === 0) return <p className="vazio">{mostrar === 'proximos' ? 'Nenhum evento marcado.' : 'Nenhum evento anterior.'}</p>
          return (
            <ul className="lista" aria-label="Eventos">
              {lista.map((e) => (
                <li key={e.id}>
                  <Link to={`/eventos/${e.id}`} className="lista-item">
                    <strong>
                      <span className="etiqueta etiqueta-neutra">{NOME_DO_TIPO_EVENTO[e.tipo]}</span> {e.titulo}
                    </strong>
                    <span>
                      {formatarDataHora(e.inicio)}
                      {e.local && ` · ${e.local}`}
                    </span>
                    <span>
                      <span className={CLASSE[e.situacao]}>{NOME_DA_SITUACAO_EVENTO[e.situacao]}</span>
                    </span>
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
// /eventos/novo e /eventos/:id/editar
// ---------------------------------------------------------------------

export function NovoEvento() {
  return <TelaFormulario id={null} />
}

export function EditarEvento() {
  const { id = '' } = useParams()
  return <TelaFormulario key={id} id={id} />
}

function TelaFormulario({ id }: { id: string | null }) {
  const { perfis } = useConta()
  const [carga, recarregar] = useCarregar(async () => {
    const [evento, associados] = await Promise.all([id ? buscarEvento(id) : Promise.resolve(ok(null)), listarAssociados()])
    if (evento.erro !== null) return evento
    if (associados.erro !== null) return associados
    return ok({ evento: evento.dados, associados: associados.dados.filter((a) => a.situacao === 'ativo') })
  })
  if (perfis.length === 0) return <Carregando />
  if (!cuida(perfis)) {
    return (
      <Aviso titulo="Sem permissão">
        <p>A secretaria (o secretário executivo) e a presidência preparam os eventos.</p>
      </Aviso>
    )
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to={id ? `/eventos/${id}` : '/eventos'}>← Voltar</Link>
      </p>
      <h1>{id ? 'Alterar o evento' : 'Novo evento ou projeto'}</h1>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ evento, associados }) =>
          id && (!evento || evento.situacao === 'realizado' || evento.situacao === 'cancelado') ? (
            <Aviso titulo="Não dá para alterar">
              <p>O evento não foi encontrado, já foi realizado ou foi cancelado.</p>
            </Aviso>
          ) : (
            <FormEvento evento={evento} associados={associados.map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome }))} />
          )
        }
      </MostrarCarga>
    </>
  )
}

function FormEvento({ evento, associados }: { evento: Evento | null; associados: { pessoa_id: string; nome: string }[] }) {
  const navegar = useNavigate()
  const [d, setD] = useState({
    tipo: (evento?.tipo ?? 'evento') as TipoEvento,
    titulo: evento?.titulo ?? '',
    descricao: evento?.descricao ?? '',
    local: evento?.local ?? '',
    inicio: evento ? paraCampoDataHora(evento.inicio) : '',
    fim: evento?.fim ? paraCampoDataHora(evento.fim) : '',
    responsavel_id: evento?.responsavel_id ?? '',
    orcamento: evento?.orcamento != null ? valorParaCampo(evento.orcamento) : '',
    inscricao: evento?.inscricao ?? false,
    inscricao_publica: evento?.inscricao_publica ?? false,
    inscricao_ate: evento?.inscricao_ate ? paraCampoDataHora(evento.inscricao_ate) : '',
    vagas: evento?.vagas != null ? String(evento.vagas) : '',
    taxa: evento ? valorParaCampo(evento.taxa) : '0,00',
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  const mudar = (parte: Partial<typeof d>) => setD((atual) => ({ ...atual, ...parte }))
  return (
    <form
      aria-label="Evento"
      onSubmit={(e) => {
        e.preventDefault()
        // valores do jeito brasileiro ("1.500" é mil e quinhentos), com o mesmo leitor das outras telas
        const orcamento = d.orcamento.trim() ? lerValor(d.orcamento) : null
        if (d.orcamento.trim() && (orcamento === null || orcamento < 0)) return setRetorno({ erro: `Orçamento inválido. ${DICA_VALOR}.` })
        const taxa = d.taxa.trim() ? lerValor(d.taxa) : 0
        if (taxa === null || taxa < 0) return setRetorno({ erro: `Taxa inválida. ${DICA_VALOR}.` })
        const dados: DadosEvento = {
          ...d,
          inicio: doCampoDataHora(d.inicio),
          fim: d.fim ? doCampoDataHora(d.fim) : '',
          inscricao_ate: d.inscricao && d.inscricao_ate ? doCampoDataHora(d.inscricao_ate) : '',
          inscricao_publica: d.inscricao && d.inscricao_publica,
          // a taxa vai como está, mesmo sem inscrição: assim o aviso certo aparece se já houver inscritos
          taxa: String(taxa),
          orcamento: orcamento === null ? '' : String(orcamento),
          vagas: d.inscricao ? d.vagas : '',
        }
        void umaVez(async () => {
          const r = await salvarEvento(evento?.id ?? null, dados)
          if (r.erro !== null) return setRetorno({ erro: r.erro })
          navegar(`/eventos/${r.dados}`, { state: { mensagem: evento ? 'Alterações salvas.' : 'Evento preparado. Confira e publique.' } })
        })
      }}
    >
      <div className="grade-form">
        <label>
          Tipo *
          <select value={d.tipo} onChange={(e) => mudar({ tipo: e.target.value as TipoEvento })}>
            <option value="evento">Evento (encontro, seminário, conferência…)</option>
            <option value="projeto">Projeto</option>
          </select>
        </label>
        <label>
          Responsável
          <select value={d.responsavel_id} onChange={(e) => mudar({ responsavel_id: e.target.value })}>
            <option value="">— (sem responsável definido)</option>
            {associados.map((a) => (
              <option key={a.pessoa_id} value={a.pessoa_id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="largura-total">
          Título *
          <input required minLength={3} maxLength={200} value={d.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
        </label>
        <label>
          Início *
          <input type="datetime-local" required value={d.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </label>
        <label>
          Fim
          <input type="datetime-local" min={d.inicio || undefined} value={d.fim} onChange={(e) => mudar({ fim: e.target.value })} />
        </label>
        <label className="largura-total">
          Local
          <input maxLength={300} value={d.local} onChange={(e) => mudar({ local: e.target.value })} />
        </label>
        <label className="largura-total">
          Descrição (vai para o site, se publicado)
          <textarea rows={5} maxLength={5000} value={d.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
        </label>
        <label>
          Orçamento (R$) — aprovado pela assembleia
          <input
            inputMode="decimal"
            pattern={PADRAO_VALOR}
            title={DICA_VALOR}
            value={d.orcamento}
            onChange={(e) => mudar({ orcamento: e.target.value })}
            placeholder="Ex.: 1.500,00"
          />
        </label>
      </div>
      <fieldset className="pauta-campos">
        <legend>Inscrição</legend>
        <label className="caixa-marcar">
          <input type="checkbox" checked={d.inscricao} onChange={(e) => mudar({ inscricao: e.target.checked })} />
          Este evento tem inscrição
        </label>
        {d.inscricao && (
          <div className="grade-form">
            <label className="caixa-marcar largura-total">
              <input type="checkbox" checked={d.inscricao_publica} onChange={(e) => mudar({ inscricao_publica: e.target.checked })} />
              Aberta ao público, pelo site (qualquer pessoa, com nome e telefone)
            </label>
            <label>
              Vagas
              <input type="number" min={1} value={d.vagas} onChange={(e) => mudar({ vagas: e.target.value })} placeholder="Sem limite" />
            </label>
            <label>
              Taxa de inscrição (R$)
              <input inputMode="decimal" pattern={PADRAO_VALOR} title={DICA_VALOR} value={d.taxa} onChange={(e) => mudar({ taxa: e.target.value })} />
            </label>
            <label>
              Inscrições até
              <input type="datetime-local" max={d.inicio || undefined} value={d.inscricao_ate} onChange={(e) => mudar({ inscricao_ate: e.target.value })} />
            </label>
          </div>
        )}
      </fieldset>
      <Mensagem erro={retorno.erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {evento ? 'Salvar alterações' : 'Salvar (ainda sem publicar)'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// /eventos/:id
// ---------------------------------------------------------------------

export function DetalheEvento() {
  const { id = '' } = useParams()
  return <ConteudoDetalhe key={id} id={id} />
}

function ConteudoDetalhe({ id }: { id: string }) {
  const { perfis } = useConta()
  const local = useLocation()
  const navegar = useNavigate()
  const [carga, recarregar] = useCarregar(() => buscarEvento(id))
  const [retorno, setRetorno] = useState<Retorno>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const [agora] = useState(() => Date.now())
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    // as seções de inscrição e finanças mostram a própria mensagem e mandam sucesso vazio
    if (r.erro !== null) setRetorno({ erro: r.erro })
    else setRetorno(sucesso ? { sucesso } : {})
    if (r.erro === null) recarregar()
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to="/eventos">← Eventos e projetos</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(e) => {
          if (!e) {
            return (
              <Aviso titulo="Evento não encontrado">
                <p>Ele pode ter sido arquivado, ou ainda não foi publicado.</p>
              </Aviso>
            )
          }
          const publico = e.publicado_em ? linkDaAgenda(e.id) : null
          return (
            <>
              <h1>{e.titulo}</h1>
              <p>
                <span className="etiqueta etiqueta-neutra">{NOME_DO_TIPO_EVENTO[e.tipo]}</span>{' '}
                <span className={CLASSE[e.situacao]}>{NOME_DA_SITUACAO_EVENTO[e.situacao]}</span>
              </p>
              <dl className="definicoes">
                <dt>Quando</dt>
                <dd>
                  {formatarDataHora(e.inicio)}
                  {e.fim && ` a ${formatarDataHora(e.fim)}`}
                </dd>
                {e.local && (
                  <>
                    <dt>Local</dt>
                    <dd>{e.local}</dd>
                  </>
                )}
                {e.responsavel?.nome && (
                  <>
                    <dt>Responsável</dt>
                    <dd>{e.responsavel.nome}</dd>
                  </>
                )}
                {e.inscricao && (
                  <>
                    <dt>Inscrição</dt>
                    <dd>
                      {e.inscricao_publica ? 'aberta ao público, pelo site' : 'só para os associados, pelo sistema'}
                      {e.vagas && ` · ${e.vagas} vagas`}
                      {e.taxa > 0 ? ` · taxa de ${formatarReais(e.taxa)}` : ' · sem taxa'}
                      {e.inscricao_ate && ` · até ${formatarDataHora(e.inscricao_ate)}`}
                    </dd>
                  </>
                )}
                {e.situacao === 'cancelado' && (
                  <>
                    <dt>Cancelado</dt>
                    <dd>{e.motivo_cancelamento}</dd>
                  </>
                )}
              </dl>
              {e.descricao && <p className="texto-edital">{e.descricao}</p>}
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

              {e.inscricao && <MinhaInscricao e={e} agora={agora} aoConcluir={concluir} />}
              {cuida(perfis) && <Orcamento e={e} aoConcluir={concluir} />}
              {(cuida(perfis) || perfis.includes('tesouraria')) && e.inscricao && (
                <Inscricoes e={e} podeCancelar={cuida(perfis)} podeReceber={financeiro(perfis)} aoConcluir={concluir} />
              )}
              {(financeiro(perfis) || perfis.includes('conselho_fiscal')) && <Financas e={e} podeLigar={financeiro(perfis)} aoConcluir={concluir} />}

              {cuida(perfis) && (
                <div className="acoes nao-imprimir">
                  {e.situacao === 'rascunho' && (
                    <button
                      type="button"
                      className="botao"
                      disabled={enviando}
                      onClick={() => void umaVez(async () => concluir(await publicarEvento(e.id), 'Evento publicado: já aparece no site e para os associados.'))}
                    >
                      Publicar
                    </button>
                  )}
                  {(e.situacao === 'rascunho' || e.situacao === 'publicado') && (
                    <Link className="botao botao-secundario" to={`/eventos/${e.id}/editar`}>
                      Alterar
                    </Link>
                  )}
                  {e.situacao === 'publicado' && new Date(e.inicio).getTime() <= agora && (
                    <button
                      type="button"
                      className="botao botao-secundario"
                      disabled={enviando}
                      onClick={() => void umaVez(async () => concluir(await concluirEvento(e.id), 'Evento registrado como realizado.'))}
                    >
                      Registrar como realizado
                    </button>
                  )}
                  {publico && e.situacao === 'publicado' && (
                    <a
                      className="botao botao-secundario"
                      href={`https://wa.me/?text=${encodeURIComponent(`*${e.titulo}*\n${formatarDataHora(e.inicio)}${e.local ? `\n${e.local}` : ''}\n${publico}`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Compartilhar no WhatsApp
                    </a>
                  )}
                  {publico && (
                    <a href={publico} target="_blank" rel="noreferrer">
                      Ver no site
                    </a>
                  )}
                  {(e.situacao === 'rascunho' || e.situacao === 'cancelado') && (
                    <BotaoArquivar
                      rotulo={`Arquivar ${e.titulo}`}
                      aoConfirmar={() =>
                        void umaVez(async () => {
                          const r = await arquivarEvento(e.id)
                          if (r.erro !== null) setRetorno({ erro: r.erro })
                          else navegar('/eventos')
                        })
                      }
                    />
                  )}
                </div>
              )}
              {cuida(perfis) && (e.situacao === 'rascunho' || e.situacao === 'publicado') && (
                <details className="acao-recolhida nao-imprimir">
                  <summary>Cancelar o evento</summary>
                  <form
                    className="form-linha"
                    aria-label="Cancelar o evento"
                    onSubmit={(ev) => {
                      ev.preventDefault()
                      void umaVez(async () => concluir(await cancelarEvento(e.id, motivo), 'Evento cancelado. O site mostra "cancelado".'))
                    }}
                  >
                    <label>
                      Motivo *
                      <input required maxLength={500} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
                    </label>
                    <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                      Cancelar o evento
                    </button>
                  </form>
                </details>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

/** O associado se inscreve pelo sistema (e vê a própria inscrição). */
function MinhaInscricao({ e, agora, aoConcluir }: { e: Evento; agora: number; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const { pessoaId, nome, perfis } = useConta()
  const [carga, recarregar] = useCarregar(() => listarInscricoes(e.id))
  const [telefone, setTelefone] = useState('')
  const [aceite, setAceite] = useState(false)
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  if (!perfis.includes('ministro')) return null
  const aberta = e.situacao === 'publicado' && new Date(e.inscricao_ate ?? e.inicio).getTime() > agora
  // a mensagem fica aqui, perto do que foi feito (no celular, o alto da página fica longe)
  const local = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) {
      recarregar()
      aoConcluir(r, '')
    }
  }
  return (
    <section className="painel" aria-labelledby="titulo-minha-inscricao">
      <h2 id="titulo-minha-inscricao">Minha inscrição</h2>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(inscricoes) => {
          const minha = inscricoes.find((i) => i.pessoa_id === pessoaId && i.situacao !== 'cancelada')
          if (minha) {
            return (
              <>
                <p>
                  Inscrição nº {minha.numero}: <strong>{NOME_DA_SITUACAO_INSCRICAO[minha.situacao]}</strong>
                  {minha.situacao === 'aguardando_pagamento' && ` — pague a taxa de ${formatarReais(minha.valor)} à tesouraria.`}
                </p>
                {!minha.pago_em && e.situacao === 'publicado' && (
                  <BotaoConfirmarNaLinha
                    texto="Cancelar a minha inscrição"
                    confirmar="Confirmar — cancelar (a vaga fica livre)"
                    desabilitado={enviando}
                    aoConfirmar={() => void umaVez(async () => local(await cancelarInscricao(minha.id, 'Cancelada pelo inscrito'), 'Inscrição cancelada.'))}
                  />
                )}
              </>
            )
          }
          if (!aberta) return <p className="vazio">As inscrições não estão abertas.</p>
          return (
            <form
              className="form-linha"
              aria-label="Quero me inscrever"
              onSubmit={(ev) => {
                ev.preventDefault()
                void umaVez(async () => {
                  const r = await inscrever(e.id, { nome, telefone, igreja: '', aceite })
                  local(r, r.erro === null ? `Inscrição nº ${r.dados.numero} feita.` : '')
                })
              }}
            >
              <label>
                Telefone (WhatsApp) *
                <input type="tel" required value={telefone} onChange={(ev) => setTelefone(ev.target.value)} placeholder="(94) 9xxxx-xxxx" />
              </label>
              <label className="caixa-marcar">
                <input type="checkbox" required checked={aceite} onChange={(ev) => setAceite(ev.target.checked)} />
                Aceito o uso do meu nome e telefone só para este evento (LGPD)
              </label>
              <button type="submit" className="botao" disabled={enviando}>
                Quero me inscrever{e.taxa > 0 ? ` (${formatarReais(e.taxa)})` : ''}
              </button>
            </form>
          )
        }}
      </MostrarCarga>
    </section>
  )
}

function Orcamento({ e, aoConcluir }: { e: Evento; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [carga, recarregar] = useCarregar(async () => {
    const r = await listarEncontros()
    if (r.erro !== null) return r
    return ok(r.dados.filter((x) => x.tipo !== 'reuniao_mensal' && x.instalada_em !== null))
  })
  const [encontro, setEncontro] = useState('')
  const [enviando, umaVez] = useUmaVez()
  if (e.orcamento == null || e.orcamento <= 0) return null
  return (
    <section className="painel" aria-labelledby="titulo-orcamento">
      <h2 id="titulo-orcamento">Orçamento: {formatarReais(e.orcamento)}</h2>
      {e.orcamento_aprovado_em ? (
        <p>
          <span className="etiqueta etiqueta-ok">Aprovado pela assembleia</span> (registrado em {formatarDataHora(e.orcamento_aprovado_em)}).
        </p>
      ) : (
        <>
          <p className="aviso-texto">
            Aguardando a aprovação da assembleia. Despesas só se ligam ao evento depois da aprovação.
          </p>
          {e.situacao !== 'realizado' && e.situacao !== 'cancelado' && (
            <MostrarCarga carga={carga} recarregar={recarregar}>
              {(assembleias) =>
                assembleias.length === 0 ? (
                  <p className="detalhe">Nenhuma AGO ou AGE instalada no sistema ainda.</p>
                ) : (
                  <form
                    className="form-linha"
                    aria-label="Registrar a aprovação do orçamento"
                    onSubmit={(ev) => {
                      ev.preventDefault()
                      void umaVez(async () => aoConcluir(await aprovarOrcamento(e.id, encontro), 'Aprovação do orçamento registrada.'))
                    }}
                  >
                    <label>
                      Assembleia que aprovou *
                      <select required value={encontro} onChange={(ev) => setEncontro(ev.target.value)}>
                        <option value="">—</option>
                        {assembleias.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.titulo}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="botao" disabled={enviando}>
                      Registrar a aprovação
                    </button>
                  </form>
                )
              }
            </MostrarCarga>
          )}
        </>
      )}
    </section>
  )
}

function Inscricoes({
  e,
  podeCancelar,
  podeReceber,
  aoConcluir,
}: {
  e: Evento
  podeCancelar: boolean
  podeReceber: boolean
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [carga, recarregar] = useCarregar(() => listarInscricoes(e.id))
  const [retorno, setRetorno] = useState<Retorno>({})
  // a mensagem fica nesta seção, perto da linha em que se clicou
  const concluir = (r: { erro: string | null }, s: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: s })
    if (r.erro === null) {
      recarregar()
      aoConcluir(r, '')
    }
  }
  return (
    <section className="painel" aria-labelledby="titulo-inscricoes">
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(inscricoes) => {
          const validas = inscricoes.filter((i) => i.situacao !== 'cancelada')
          return (
            <>
              <h2 id="titulo-inscricoes">
                Inscrições ({validas.length}
                {e.vagas ? ` de ${e.vagas}` : ''})
              </h2>
              <p className="detalhe">
                Nome e telefone só para este evento (LGPD). Quem pagou e quem falta, a tesouraria registra aqui. Inscrição com taxa que
                espera o pagamento há mais de 72 horas deixa de segurar a vaga.
              </p>
              {podeCancelar && validas.some((i) => i.situacao === 'aguardando_pagamento' && Date.now() - new Date(i.criado_em).getTime() > 72 * 3_600_000) && (
                <BotaoConfirmarNaLinha
                  texto="Cancelar as inscrições sem pagamento há mais de 72 horas"
                  confirmar="Confirmar — cancelar as que não pagaram"
                  aoConfirmar={() => void cancelarInscricoesSemPagamento(e.id).then((r) => concluir(r, 'Inscrições sem pagamento canceladas: as vagas ficaram livres.'))}
                />
              )}
              {inscricoes.length === 0 ? (
                <p className="vazio">Ninguém inscrito ainda.</p>
              ) : (
                <ul className="lista" aria-label="Inscrições">
                  {inscricoes.map((i) => (
                    <LinhaInscricao key={i.id} i={i} podeCancelar={podeCancelar} podeReceber={podeReceber} aoConcluir={concluir} />
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </section>
  )
}

function LinhaInscricao({
  i,
  podeCancelar,
  podeReceber,
  aoConcluir,
}: {
  i: Inscricao
  podeCancelar: boolean
  podeReceber: boolean
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [forma, setForma] = useState('PIX')
  const [data, setData] = useState(hojeIso)
  const [enviando, umaVez] = useUmaVez()
  const telefone = i.telefone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
  return (
    <li className="lista-item lista-item-estatico" aria-label={`Inscrição ${i.numero}: ${i.nome}`}>
      <strong>
        <span className="numero">Nº {i.numero}</span> {i.nome}
      </strong>
      <span>
        {telefone}
        {i.igreja && ` · ${i.igreja}`}
      </span>
      <span>
        <span className={i.situacao === 'confirmada' ? 'etiqueta etiqueta-ok' : i.situacao === 'cancelada' ? 'etiqueta etiqueta-cancelada' : 'etiqueta etiqueta-conferencia'}>
          {NOME_DA_SITUACAO_INSCRICAO[i.situacao]}
        </span>
        {i.valor > 0 && ` · ${formatarReais(i.valor)}`}
      </span>
      {i.situacao === 'aguardando_pagamento' && (
        <span className="form-linha">
          {podeReceber && (
            <>
              <label className="campo-curto">
                Pago em
                <input type="date" max={hojeIso()} value={data} onChange={(ev) => setData(ev.target.value)} />
              </label>
              <label>
                Forma
                <select value={forma} onChange={(ev) => setForma(ev.target.value)}>
                  <option>PIX</option>
                  <option>Dinheiro</option>
                  <option>Depósito</option>
                </select>
              </label>
              <button
                type="button"
                className="botao"
                disabled={enviando}
                onClick={() =>
                  void umaVez(async () => aoConcluir(await registrarPagamentoInscricao(i.id, data, forma), `Pagamento da inscrição nº ${i.numero} registrado.`))
                }
              >
                Registrar o pagamento
              </button>
            </>
          )}
          {podeCancelar && (
            <BotaoConfirmarNaLinha
              texto="Cancelar a inscrição"
              confirmar="Confirmar — cancelar (a vaga fica livre)"
              desabilitado={enviando}
              aoConfirmar={() => void umaVez(async () => aoConcluir(await cancelarInscricao(i.id, 'Cancelada pela secretaria'), `Inscrição nº ${i.numero} cancelada.`))}
            />
          )}
        </span>
      )}
      {i.situacao === 'confirmada' && !i.pago_em && podeCancelar && (
        <span>
          <BotaoConfirmarNaLinha
            texto="Cancelar a inscrição"
            confirmar="Confirmar — cancelar (a vaga fica livre)"
            desabilitado={enviando}
            aoConfirmar={() => void umaVez(async () => aoConcluir(await cancelarInscricao(i.id, 'Cancelada pela secretaria'), `Inscrição nº ${i.numero} cancelada.`))}
          />
        </span>
      )}
    </li>
  )
}

function Financas({ e, podeLigar, aoConcluir }: { e: Evento; podeLigar: boolean; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [financas, lancamentos] = await Promise.all([financasDoEvento(e.id), podeLigar ? lancamentosRecentes() : Promise.resolve(ok([]))])
    if (financas.erro !== null) return financas
    if (lancamentos.erro !== null) return lancamentos
    return ok({ financas: financas.dados, lancamentos: lancamentos.dados })
  })
  const [lancamento, setLancamento] = useState('')
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel" aria-labelledby="titulo-financas-evento">
      <h2 id="titulo-financas-evento">Finanças do evento</h2>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ financas, lancamentos }) => {
          const ligados = lancamentos.filter((l) => l.evento_id === e.id)
          const livres = lancamentos.filter((l) => !l.evento_id)
          return (
            <>
              <dl className="definicoes" aria-label="Finanças do evento">
                <dt>Receitas</dt>
                <dd>{formatarReais(financas.receitas)}</dd>
                <dt>Despesas</dt>
                <dd>
                  {formatarReais(financas.despesas)}
                  {financas.aguardando > 0 && ` (+ ${formatarReais(financas.aguardando)} aguardando autorização)`}
                </dd>
                <dt>Saldo</dt>
                <dd>{formatarReais(financas.receitas - financas.despesas)}</dd>
                {e.orcamento != null && (
                  <>
                    <dt>Orçamento</dt>
                    <dd>
                      {formatarReais(e.orcamento)} {financas.despesas > e.orcamento && <span className="etiqueta etiqueta-atraso">Despesas acima do orçamento</span>}
                    </dd>
                  </>
                )}
              </dl>
              {podeLigar && ligados.length > 0 && (
                <ul className="lista-pendencias" aria-label="Lançamentos do evento">
                  {ligados.map((l) => (
                    <li key={l.id}>
                      {l.tipo === 'entrada' ? 'Entrada' : 'Saída'} de {formatarReais(l.valor)} — {l.descricao}
                    </li>
                  ))}
                </ul>
              )}
              {podeLigar && e.situacao !== 'cancelado' && (
                <form
                  className="form-linha"
                  aria-label="Ligar um lançamento ao evento"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    void umaVez(async () => {
                      const r = await ligarLancamentoEvento(lancamento, e.id)
                      setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Lançamento ligado ao evento.' })
                      if (r.erro === null) {
                        setLancamento('')
                        recarregar()
                        aoConcluir(r, '')
                      }
                    })
                  }}
                >
                  <label>
                    Ligar um lançamento do caixa
                    <select required value={lancamento} onChange={(ev) => setLancamento(ev.target.value)}>
                      <option value="">—</option>
                      {livres.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.data.split('-').reverse().join('/')} · {l.tipo === 'entrada' ? '+' : '−'}
                          {formatarReais(l.valor)} · {l.descricao}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="botao botao-secundario" disabled={enviando}>
                    Ligar
                  </button>
                </form>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </section>
  )
}
