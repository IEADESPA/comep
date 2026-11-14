// Fase 5.4 — Mural de avisos (todos com login leem; só a secretaria publica, e escolhe se vai para o site)
// e o painel da presidência.
import { useState } from 'react'
import { Link } from 'react-router'
import { Aviso as Caixa, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { arquivarAviso, listarAvisos, painelPresidencia, salvarAviso, type Aviso, type DadosAviso } from '../../dados/avisos'
import { formatarReais } from '../../dados/configuracoes'
import { NOME_DO_TIPO_EVENTO, type TipoEvento } from '../../dados/eventos'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante, formatarDataHora } from '../../utilitarios/formatos'

function usePerfis(): readonly Perfil[] {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

const textoWhatsApp = (a: Pick<Aviso, 'titulo' | 'texto'>) => `*${a.titulo}*\n${a.texto}\n— COMEP`

// ---------------------------------------------------------------------
// /avisos
// ---------------------------------------------------------------------

export function MuralDeAvisos() {
  const perfis = usePerfis()
  const secretaria = perfis.includes('secretaria')
  const [carga, recarregar] = useCarregar(listarAvisos)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [editando, setEditando] = useState<Aviso | null>(null)
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) {
      setEditando(null)
      recarregar()
    }
  }
  return (
    <>
      <h1>Mural de avisos</h1>
      <p className="detalhe">
        Os avisos do Conselho. Quem publica é a secretaria (Art. 12, §5º); alguns vão também para o site.
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {secretaria && <FormAviso key={editando?.id ?? 'novo'} aviso={editando} aoConcluir={concluir} aoDesistir={() => setEditando(null)} />}
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(avisos) =>
          avisos.length === 0 ? (
            <p className="vazio">Nenhum aviso no mural.</p>
          ) : (
            <ul className="lista" aria-label="Avisos">
              {avisos.map((a) => (
                <LinhaAviso key={a.id} a={a} secretaria={secretaria} aoEditar={() => setEditando(a)} aoConcluir={concluir} />
              ))}
            </ul>
          )
        }
      </MostrarCarga>
    </>
  )
}

function LinhaAviso({
  a,
  secretaria,
  aoEditar,
  aoConcluir,
}: {
  a: Aviso
  secretaria: boolean
  aoEditar: () => void
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <li className="lista-item lista-item-estatico" aria-label={a.titulo}>
      <strong>
        {a.fixado && <span className="etiqueta etiqueta-marca">Fixado</span>} {a.titulo}
      </strong>
      <span className="texto-edital">{a.texto}</span>
      <span className="detalhe">
        {formatarDataDeInstante(a.criado_em)}
        {a.valido_ate && ` · vale até ${formatarData(a.valido_ate)}`}
        {secretaria && a.no_site && ' · também no site'}
      </span>
      <span className="acoes-linha">
        <a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp(a))}`} target="_blank" rel="noreferrer">
          Enviar pelo WhatsApp
        </a>
        {secretaria && (
          <>
            <button type="button" className="botao-texto" onClick={aoEditar}>
              Alterar
            </button>
            <button
              type="button"
              className="botao-texto"
              disabled={enviando}
              onClick={() => void umaVez(async () => aoConcluir(await arquivarAviso(a.id), 'Aviso tirado do mural (fica guardado).'))}
            >
              Tirar do mural
            </button>
          </>
        )}
      </span>
    </li>
  )
}

function FormAviso({
  aviso,
  aoConcluir,
  aoDesistir,
}: {
  aviso: Aviso | null
  aoConcluir: (r: { erro: string | null }, s: string) => void
  aoDesistir: () => void
}) {
  const [d, setD] = useState<DadosAviso>({
    titulo: aviso?.titulo ?? '',
    texto: aviso?.texto ?? '',
    no_site: aviso?.no_site ?? false,
    fixado: aviso?.fixado ?? false,
    valido_ate: aviso?.valido_ate ?? '',
  })
  const [enviando, umaVez] = useUmaVez()
  const mudar = (parte: Partial<DadosAviso>) => setD((atual) => ({ ...atual, ...parte }))
  return (
    <details className="painel acao-recolhida-painel" open={aviso !== null}>
      <summary>{aviso ? `Alterar: ${aviso.titulo}` : 'Publicar um aviso'}</summary>
      <form
        aria-label="Aviso"
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const r = await salvarAviso(aviso?.id ?? null, d)
            aoConcluir(r, aviso ? 'Aviso alterado.' : 'Aviso publicado no mural.')
            if (r.erro === null && !aviso) setD({ titulo: '', texto: '', no_site: false, fixado: false, valido_ate: '' })
          })
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Título *
            <input required minLength={3} maxLength={200} value={d.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
          </label>
          <label className="largura-total">
            Texto *
            <textarea required minLength={3} maxLength={5000} rows={5} value={d.texto} onChange={(e) => mudar({ texto: e.target.value })} />
          </label>
          <label>
            Vale até
            <input type="date" value={d.valido_ate} onChange={(e) => mudar({ valido_ate: e.target.value })} />
          </label>
          <label className="caixa-marcar">
            <input type="checkbox" checked={d.fixado} onChange={(e) => mudar({ fixado: e.target.checked })} />
            Fixar no alto do mural
          </label>
          <label className="caixa-marcar largura-total">
            <input type="checkbox" checked={d.no_site} onChange={(e) => mudar({ no_site: e.target.checked })} />
            Também no site (qualquer pessoa vê)
          </label>
        </div>
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            {aviso ? 'Salvar' : 'Publicar no mural'}
          </button>
          {aviso && (
            <button type="button" className="botao-texto" onClick={aoDesistir}>
              Desistir
            </button>
          )}
        </div>
      </form>
    </details>
  )
}

/** No Início: os avisos mais recentes (os fixados primeiro). */
export function AvisosNoInicio() {
  const [carga] = useCarregar(listarAvisos)
  if (carga.situacao !== 'ok' || carga.dados.length === 0) return null
  const avisos = carga.dados.slice(0, 3)
  return (
    <section className="painel" aria-labelledby="titulo-avisos-inicio">
      <h2 id="titulo-avisos-inicio">Mural de avisos</h2>
      <ul className="lista-pendencias" aria-label="Avisos recentes">
        {avisos.map((a) => (
          <li key={a.id}>
            <strong>{a.titulo}</strong> — {a.texto.length > 160 ? `${a.texto.slice(0, 160)}…` : a.texto}
          </li>
        ))}
      </ul>
      <Link to="/avisos">Ver o mural</Link>
    </section>
  )
}

// ---------------------------------------------------------------------
// /painel-presidencia
// ---------------------------------------------------------------------

const NOME_ENCONTRO: Record<string, string> = { ago: 'AGO', age: 'AGE', reuniao_mensal: 'Reunião mensal' }

export function PainelDaPresidencia() {
  const [carga, recarregar] = useCarregar(painelPresidencia)
  return (
    <>
      <h1>Painel da presidência</h1>
      <p className="detalhe">Associados, finanças, presença e agenda do Conselho num lugar só. Os números são de agora.</p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(p) => (
          <div className="painel-grade">
            <section className="painel" aria-labelledby="painel-associados">
              <h2 id="painel-associados">Associados</h2>
              <dl className="definicoes">
                <dt>Ativos</dt>
                <dd>{p.associados.ativos}</dd>
                <dt>Em dia (votam)</dt>
                <dd>
                  {p.associados.em_dia}
                  {p.associados.ativos > 0 && ` (${Math.round((p.associados.em_dia * 100) / p.associados.ativos)}%)`}
                </dd>
                <dt>Jubilados</dt>
                <dd>{p.associados.jubilados}</dd>
                <dt>Igrejas</dt>
                <dd>{p.associados.igrejas}</dd>
              </dl>
              {p.associados.pedidos > 0 && (
                <p>
                  <Link to="/inscricoes">{p.associados.pedidos} pedido(s) de associação em andamento</Link>
                </p>
              )}
            </section>

            <section className="painel" aria-labelledby="painel-financas">
              <h2 id="painel-financas">Finanças</h2>
              <dl className="definicoes">
                <dt>Saldo do caixa</dt>
                <dd>{formatarReais(p.financas.saldo)}</dd>
                <dt>Entradas no mês</dt>
                <dd>{formatarReais(p.financas.entradas_mes)}</dd>
                <dt>Saídas no mês</dt>
                <dd>{formatarReais(p.financas.saidas_mes)}</dd>
                <dt>Contribuições vencidas</dt>
                <dd>{formatarReais(p.financas.contribuicoes_vencidas)}</dd>
              </dl>
              {(p.financas.despesas_a_autorizar > 0 || p.financas.pagamentos_a_conferir > 0) && (
                <ul className="lista-pendencias" aria-label="Pendências financeiras">
                  {p.financas.despesas_a_autorizar > 0 && (
                    <li>
                      <Link to="/financeiro">{p.financas.despesas_a_autorizar} despesa(s) esperando a sua autorização</Link>
                    </li>
                  )}
                  {p.financas.pagamentos_a_conferir > 0 && <li>{p.financas.pagamentos_a_conferir} pagamento(s) informado(s) esperando a tesouraria</li>}
                </ul>
              )}
            </section>

            <section className="painel" aria-labelledby="painel-presenca">
              <h2 id="painel-presenca">Presença</h2>
              {p.presenca.ultimos.length === 0 ? (
                <p className="vazio">Nenhum encontro realizado ainda.</p>
              ) : (
                <ul className="lista-pendencias" aria-label="Últimos encontros">
                  {p.presenca.ultimos.map((e) => (
                    <li key={e.id}>
                      <Link to={`/assembleias/${e.id}`}>{e.titulo}</Link> ({NOME_ENCONTRO[e.tipo] ?? e.tipo}, {formatarDataHora(e.inicio)}):{' '}
                      {e.presentes} presente(s)
                    </li>
                  ))}
                </ul>
              )}
              <p>
                {p.presenca.com_faltas > 0 ? (
                  <Link to="/assembleias/faltas">{p.presenca.com_faltas} associado(s) com faltas seguidas às assembleias</Link>
                ) : (
                  'Ninguém com faltas seguidas às assembleias.'
                )}
                {p.presenca.justificativas_pendentes > 0 && ` · ${p.presenca.justificativas_pendentes} justificativa(s) esperando o 1º secretário`}
              </p>
            </section>

            <section className="painel" aria-labelledby="painel-agenda">
              <h2 id="painel-agenda">Agenda e projetos</h2>
              {p.agenda.encontros.length === 0 && p.agenda.eventos.length === 0 ? (
                <p className="vazio">Nada marcado.</p>
              ) : (
                <ul className="lista-pendencias" aria-label="Próximos">
                  {p.agenda.encontros.map((e) => (
                    <li key={e.id}>
                      <Link to={`/assembleias/${e.id}`}>{e.titulo}</Link> — {formatarDataHora(e.inicio)}
                      {e.situacao === 'agendado' && ' (rascunho)'}
                    </li>
                  ))}
                  {p.agenda.eventos.map((e) => (
                    <li key={e.id}>
                      <Link to={`/eventos/${e.id}`}>{e.titulo}</Link> ({NOME_DO_TIPO_EVENTO[e.tipo as TipoEvento] ?? e.tipo}) — {formatarDataHora(e.inicio)}
                      {e.situacao === 'rascunho' && ' (rascunho)'} · {e.inscritos} inscrito(s){e.vagas ? ` de ${e.vagas}` : ''}
                      {e.orcamento != null && !e.orcamento_aprovado && ' · orçamento aguardando a assembleia'}
                    </li>
                  ))}
                </ul>
              )}
              <p>
                <Link to="/comissoes">{p.agenda.comissoes} comissão(ões) em atividade</Link>
              </p>
            </section>
          </div>
        )}
      </MostrarCarga>
      <Caixa titulo="Atalhos">
        <p>
          <Link to="/avisos">Mural de avisos</Link> · <Link to="/eventos">Eventos e projetos</Link> · <Link to="/financeiro">Financeiro</Link> ·{' '}
          <Link to="/diretoria">Diretoria</Link>
        </p>
      </Caixa>
    </>
  )
}
