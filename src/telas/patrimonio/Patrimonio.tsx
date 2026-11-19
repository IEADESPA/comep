// Fase 5.5.1 — Patrimônio e empréstimo às igrejas (Art. 18; PROJETO.md, seção 4.12; 14/11/2026).
// O pastor presidente pede os itens para a igreja e aceita o termo de compromisso; a secretaria (o secretário executivo)
// ou a presidência aprova conferindo a agenda; a equipe registra a retirada e a devolução. O que não volta sai do
// patrimônio (baixa). As regras de apoio ainda vão ser definidas pela diretoria: ficam em "Regras" (a presidência muda).
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Aviso, BotaoConfirmarNaLinha, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { ok } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { listarEventos, type Evento } from '../../dados/eventos'
import {
  acrescentarItem,
  agendaPatrimonio,
  baixarItem,
  buscarConfigPatrimonio,
  buscarEmprestimo,
  cancelarEmprestimo,
  CLASSE_DA_SITUACAO_EMPRESTIMO,
  decidirEmprestimo,
  igrejasDoPedido,
  listarBaixas,
  listarEmprestimos,
  listarItens,
  livresNoPeriodo,
  NOME_DA_FORMA_AQUISICAO,
  NOME_DA_SITUACAO_EMPRESTIMO,
  pedirEmprestimo,
  registrarDevolucao,
  registrarRetirada,
  salvarConfigPatrimonio,
  salvarItem,
  type ConfigPatrimonio,
  type DadosItem,
  type Emprestimo,
  type FormaAquisicao,
  type IgrejaDoPedido,
  type ItemPatrimonio,
} from '../../dados/patrimonio'
import type { Perfil } from '../../dados/perfis'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { imprimir } from '../../utilitarios/exportar'
import { formatarData, formatarDataDeInstante, formatarDataHora, hojeIso } from '../../utilitarios/formatos'
import { DICA_VALOR, lerValor, PADRAO_VALOR, valorParaCampo } from '../../utilitarios/valores'

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, sucesso: string) => void

function useConta() {
  const { estado } = useSessao()
  const conta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta : null
  return { perfis: (conta?.perfis ?? []) as readonly Perfil[], pessoaId: conta?.pessoaId ?? null }
}

/** Cuidam do patrimônio: a secretaria (o secretário executivo), a tesouraria e a presidência. */
const equipe = (perfis: readonly Perfil[]) => perfis.some((p) => p === 'secretaria' || p === 'tesouraria' || p === 'presidencia')
/** Aprovam os empréstimos: a secretaria e a presidência. */
const aprova = (perfis: readonly Perfil[]) => perfis.includes('secretaria') || perfis.includes('presidencia')

/** Dia (aaaa-mm-dd) somado de alguns dias, sem fuso: o banco conta os dias em Parauapebas. */
function somarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d + dias))
  return data.toISOString().slice(0, 10)
}

const diasDoPeriodo = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000) + 1

const atrasado = (e: Pick<Emprestimo, 'situacao' | 'devolucao'>) => e.situacao === 'retirado' && e.devolucao < hojeIso()

const quemPediu = (e: Pick<Emprestimo, 'igreja' | 'evento'>) => (e.igreja ? e.igreja.nome : `COMEP: ${e.evento?.titulo ?? 'evento'}`)

const resumoDosItens = (e: Pick<Emprestimo, 'itens'>) => e.itens.map((i) => `${i.quantidade} × ${i.item?.nome ?? 'item'}`).join(', ')

function Situacao({ e }: { e: Pick<Emprestimo, 'situacao' | 'devolucao'> }) {
  return (
    <>
      <span className={CLASSE_DA_SITUACAO_EMPRESTIMO[e.situacao]}>{NOME_DA_SITUACAO_EMPRESTIMO[e.situacao]}</span>
      {atrasado(e) && (
        <>
          {' '}
          <span className="etiqueta etiqueta-atraso">Devolução atrasada</span>
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// /patrimonio
// ---------------------------------------------------------------------

type Aba = 'pedidos' | 'pedir' | 'agenda' | 'bens' | 'regras'

const NOME_DA_ABA: Record<Aba, string> = {
  pedidos: 'Pedidos',
  pedir: 'Pedir emprestado',
  agenda: 'Agenda',
  bens: 'Bens',
  regras: 'Regras',
}

const ehAba = (a: string | undefined): a is Aba => a !== undefined && a in NOME_DA_ABA

/**
 * /patrimonio/:aba — cada parte é uma função do menu do módulo (src/componentes/menu.ts): pedidos, pedir emprestado,
 * agenda, bens e regras. /patrimonio abre os pedidos.
 */
export function Patrimonio() {
  const { perfis } = useConta()
  const { aba: daRota } = useParams()
  const local = useLocation()
  // o Conselho Fiscal acompanha, mas não pede
  const pede = perfis.includes('presidente_igreja') || equipe(perfis)
  if (!ehAba(daRota) || (daRota === 'pedir' && !pede)) return <Navigate to="/patrimonio/pedidos" replace state={local.state} />
  return <ParteDoPatrimonio key={daRota} aba={daRota} perfis={perfis} />
}

function ParteDoPatrimonio({ aba, perfis }: { aba: Aba; perfis: readonly Perfil[] }) {
  const local = useLocation()
  const [retorno] = useState<Retorno>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  return (
    <>
      <CabecalhoFuncao
        modulo="Patrimônio"
        titulo={NOME_DA_ABA[aba]}
        sub="Os bens do COMEP (som, palcos, cadeiras…) e o empréstimo às igrejas. O pastor presidente pede para a igreja e aceita o termo de compromisso; a secretaria ou a presidência aprova conferindo a agenda."
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {aba === 'pedidos' && <Pedidos perfis={perfis} />}
      {aba === 'pedir' && <FormPedido perfis={perfis} />}
      {aba === 'agenda' && <Agenda perfis={perfis} />}
      {aba === 'bens' && <Bens perfis={perfis} />}
      {aba === 'regras' && <Regras perfis={perfis} />}
    </>
  )
}

function Pedidos({ perfis }: { perfis: readonly Perfil[] }) {
  const [carga, recarregar] = useCarregar(listarEmprestimos)
  const [mostrar, setMostrar] = useState<'andamento' | 'anteriores'>('andamento')
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(lista) => {
        const andamento = (e: Emprestimo) => e.situacao === 'solicitado' || e.situacao === 'aprovado' || e.situacao === 'retirado'
        const esperando = lista.filter((e) => e.situacao === 'solicitado').length
        const mostrados = lista
          .filter((e) => (mostrar === 'andamento' ? andamento(e) : !andamento(e)))
          .sort((a, b) => (mostrar === 'andamento' ? a.retirada.localeCompare(b.retirada) : b.retirada.localeCompare(a.retirada)))
        return (
          <section aria-label="Pedidos de empréstimo">
            {aprova(perfis) && esperando > 0 && (
              <p className="aviso-texto">
                {esperando === 1 ? '1 pedido esperando a aprovação.' : `${esperando} pedidos esperando a aprovação.`}
              </p>
            )}
            <div className="abas" role="tablist" aria-label="Quais pedidos">
              {(['andamento', 'anteriores'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mostrar === m} className={mostrar === m ? 'aba ativa' : 'aba'} onClick={() => setMostrar(m)}>
                  {m === 'andamento' ? 'Em andamento' : 'Anteriores'}
                </button>
              ))}
            </div>
            {mostrados.length === 0 ? (
              <p className="vazio">{mostrar === 'andamento' ? 'Nenhum pedido em andamento.' : 'Nenhum pedido anterior.'}</p>
            ) : (
              <ul className="lista" aria-label="Pedidos">
                {mostrados.map((e) => (
                  <li key={e.id}>
                    <Link to={`/patrimonio/emprestimos/${e.id}`} className="lista-item">
                      <strong>{quemPediu(e)}</strong>
                      <span>
                        {formatarData(e.retirada)} a {formatarData(e.devolucao)} · {resumoDosItens(e)}
                      </span>
                      <span>
                        <Situacao e={e} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      }}
    </MostrarCarga>
  )
}

// ---------- O pedido ----------

function FormPedido({ perfis }: { perfis: readonly Perfil[] }) {
  const daEquipe = equipe(perfis)
  const [carga, recarregar] = useCarregar(async () => {
    const [igrejas, itens, config, eventos] = await Promise.all([
      igrejasDoPedido(),
      listarItens(),
      buscarConfigPatrimonio(),
      daEquipe ? listarEventos() : Promise.resolve(ok([] as Evento[])),
    ])
    if (igrejas.erro !== null) return igrejas
    if (itens.erro !== null) return itens
    if (config.erro !== null) return config
    if (eventos.erro !== null) return eventos
    return ok({
      igrejas: igrejas.dados,
      itens: itens.dados.filter((i) => i.emprestavel && i.quantidade > 0),
      config: config.dados,
      eventos: eventos.dados.filter((e) => e.situacao === 'rascunho' || e.situacao === 'publicado'),
    })
  })
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(d) =>
        d.igrejas.length === 0 && d.eventos.length === 0 ? (
          <Aviso titulo="Nenhuma igreja para o pedido">
            <p>
              Quem pede é o pastor presidente da igreja. Se você preside uma igreja e ela não aparece, peça à secretaria para
              conferir o seu cadastro.
            </p>
          </Aviso>
        ) : d.itens.length === 0 ? (
          <p className="vazio">Nenhum bem disponível para empréstimo ainda.</p>
        ) : (
          <TelaPedido {...d} daEquipe={daEquipe} />
        )
      }
    </MostrarCarga>
  )
}

function TelaPedido({
  igrejas,
  itens,
  config,
  eventos,
  daEquipe,
}: {
  igrejas: IgrejaDoPedido[]
  itens: ItemPatrimonio[]
  config: ConfigPatrimonio
  eventos: Evento[]
  daEquipe: boolean
}) {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const { estado } = useSessao()
  const perfisDaConta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  // a secretaria e a presidência (que aprovam) registram direto, já aprovado (a ficha da igreja › Agenda abre com ?direto=1)
  const podeRegistrarDireto = perfisDaConta.includes('secretaria') || perfisDaConta.includes('presidencia')
  const igrejaDaFicha = parametros.get('igreja')
  // destino: "igreja:<id>" ou "evento:<id>"
  const [destino, setDestino] = useState(
    igrejaDaFicha && igrejas.some((g) => g.id === igrejaDaFicha)
      ? `igreja:${igrejaDaFicha}`
      : igrejas.length === 1 && eventos.length === 0
        ? `igreja:${igrejas[0].id}`
        : '',
  )
  const [direto, setDireto] = useState(podeRegistrarDireto && parametros.get('direto') === '1')
  const primeiroDia = daEquipe ? hojeIso() : somarDias(hojeIso(), config.antecedencia_dias)
  const [retirada, setRetirada] = useState('')
  const [devolucao, setDevolucao] = useState('')
  const [finalidade, setFinalidade] = useState('')
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})
  const [aceite, setAceite] = useState(false)
  const [livres, setLivres] = useState<{ periodo: string; livres: Record<string, number> } | { periodo: string; erro: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()

  const ehIgreja = destino.startsWith('igreja:')
  const periodoValido = retirada !== '' && devolucao !== '' && devolucao >= retirada
  const periodo = `${retirada}|${devolucao}`
  const dias = periodoValido ? diasDoPeriodo(retirada, devolucao) : 0

  // ao escolher o período, busca quanto de cada item está livre nele
  useEffect(() => {
    if (!periodoValido) return
    let ativo = true
    void livresNoPeriodo(retirada, devolucao).then((r) => {
      if (!ativo) return
      setLivres(r.erro !== null ? { periodo, erro: r.erro } : { periodo, livres: r.dados })
    })
    return () => {
      ativo = false
    }
  }, [periodoValido, retirada, devolucao, periodo])

  const livresDoPeriodo = livres && livres.periodo === periodo && 'livres' in livres ? livres.livres : null
  const escolhidos = itens
    .map((i) => ({ item_id: i.id, quantidade: Number(quantidades[i.id] ?? 0) }))
    .filter((i) => Number.isInteger(i.quantidade) && i.quantidade > 0)

  return (
    <form
      aria-label="Pedir emprestado"
      className="painel"
      onSubmit={(ev) => {
        ev.preventDefault()
        setErro(null)
        if (!destino) return setErro('Escolha a igreja (ou o evento do COMEP).')
        if (escolhidos.length === 0) return setErro('Escolha pelo menos um item e a quantidade.')
        if (ehIgreja && !aceite) return setErro('Para pedir, aceite o termo de compromisso.')
        const [tipo, id] = destino.split(':')
        void umaVez(async () => {
          const r = await pedirEmprestimo({
            igreja_id: tipo === 'igreja' ? id : null,
            evento_id: tipo === 'evento' ? id : null,
            retirada,
            devolucao,
            finalidade,
            aceite: ehIgreja && aceite,
            registrar_direto: ehIgreja && direto,
            itens: escolhidos,
          })
          if (r.erro !== null) return setErro(r.erro)
          navegar(`/patrimonio/emprestimos/${r.dados}`, {
            state: {
              mensagem:
                tipo === 'evento'
                  ? 'Reserva feita para o evento do COMEP.'
                  : direto
                    ? 'Empréstimo registrado, já aprovado.'
                    : 'Pedido enviado. A secretaria vai conferir a agenda e responder.',
            },
          })
        })
      }}
    >
      <h2>Pedir emprestado</h2>
      <p className="detalhe">
        Peça com pelo menos {config.antecedencia_dias} dia(s) de antecedência, por no máximo {config.prazo_maximo_dias} dia(s)
        {config.exige_em_dia && '; a sua contribuição precisa estar em dia'}. O pedido só vale depois de aprovado.
      </p>
      <div className="grade-form">
        <label className="largura-total">
          Para *
          <select required value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Escolha…</option>
            {igrejas.length > 0 && (
              <optgroup label="Igreja">
                {igrejas.map((g) => (
                  // só a igreja regular pega empréstimo (suspensa ou sem registro, não há como fazer o contrato)
                  <option key={g.id} value={`igreja:${g.id}`} disabled={g.situacao !== undefined && g.situacao !== 'regular'}>
                    {g.nome}
                    {g.situacao === 'suspensa' ? ' — suspensa' : g.situacao === 'sem_registro' ? ' — sem registro' : ''}
                    {daEquipe && ` — ${g.ministros} ministro(s) associado(s), ${g.em_dia} em dia`}
                  </option>
                ))}
              </optgroup>
            )}
            {eventos.length > 0 && (
              <optgroup label="Evento do COMEP (reserva)">
                {eventos.map((e) => (
                  <option key={e.id} value={`evento:${e.id}`}>
                    {e.titulo} ({formatarDataDeInstante(e.inicio)})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label>
          Retirada *
          <input
            type="date"
            required
            min={primeiroDia}
            value={retirada}
            onChange={(e) => {
              setRetirada(e.target.value)
              if (devolucao === '' || devolucao < e.target.value) setDevolucao(e.target.value)
            }}
          />
        </label>
        <label>
          Devolução *
          <input
            type="date"
            required
            min={retirada || primeiroDia}
            max={retirada ? somarDias(retirada, config.prazo_maximo_dias - 1) : undefined}
            value={devolucao}
            onChange={(e) => setDevolucao(e.target.value)}
          />
        </label>
        <label className="largura-total">
          Para que é *
          <input required minLength={3} maxLength={500} placeholder="Ex.: culto de aniversário da igreja" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />
        </label>
      </div>
      {periodoValido && dias > config.prazo_maximo_dias && (
        <p className="erro" role="alert">
          O empréstimo é de no máximo {config.prazo_maximo_dias} dia(s); este período tem {dias}.
        </p>
      )}

      <h3>Itens</h3>
      {!periodoValido ? (
        <p className="detalhe">Escolha a retirada e a devolução para ver quanto de cada item está livre.</p>
      ) : livres?.periodo === periodo && 'erro' in livres ? (
        <p className="erro">{livres.erro}</p>
      ) : !livresDoPeriodo ? (
        <Carregando texto="Conferindo a agenda…" />
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela-relatorio" aria-label="Itens do pedido">
            <thead>
              <tr>
                <th>Item</th>
                <th className="numero">Livres no período</th>
                <th className="numero">Quantos</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const livre = livresDoPeriodo[i.id] ?? 0
                return (
                  <tr key={i.id}>
                    <td>
                      {i.nome}
                      {i.categoria && <span className="detalhe"> · {i.categoria}</span>}
                    </td>
                    <td className="numero">{livre}</td>
                    <td className="numero">
                      <input
                        type="number"
                        className="campo-numero"
                        aria-label={`Quantos: ${i.nome}`}
                        min={0}
                        max={livre}
                        step={1}
                        disabled={livre === 0}
                        value={quantidades[i.id] ?? ''}
                        onChange={(e) => setQuantidades((q) => ({ ...q, [i.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {ehIgreja && (
        <section aria-labelledby="titulo-termo-pedido">
          <h3 id="titulo-termo-pedido">Termo de compromisso</h3>
          <p className="texto-edital">{config.texto_termo}</p>
          <label className="caixa-marcar">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            Li e aceito o termo de compromisso em nome da igreja
          </label>
          {podeRegistrarDireto && (
            <label className="caixa-marcar">
              <input type="checkbox" checked={direto} onChange={(e) => setDireto(e.target.checked)} />
              Registrar direto, já aprovado (a secretaria registra, sem passar pelo pedido)
            </label>
          )}
        </section>
      )}
      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando || !periodoValido || dias > config.prazo_maximo_dias}>
          {destino.startsWith('evento:') ? 'Reservar para o evento' : direto ? 'Registrar o empréstimo' : 'Enviar o pedido'}
        </button>
      </div>
    </form>
  )
}

// ---------- Agenda ----------

function Agenda({ perfis }: { perfis: readonly Perfil[] }) {
  const [de] = useState(hojeIso)
  const ate = somarDias(de, 90)
  const [carga, recarregar] = useCarregar(() => agendaPatrimonio(de, ate))
  const vePedidos = equipe(perfis) || perfis.includes('conselho_fiscal')
  return (
    <section aria-label="Agenda do patrimônio">
      <p className="detalhe">
        O que já está reservado (aprovado ou com a igreja) de hoje a {formatarData(ate)}. Use para escolher a data do pedido.
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(reservas) =>
          reservas.length === 0 ? (
            <p className="vazio">Nada reservado nesse período: todos os itens estão livres.</p>
          ) : (
            <ul className="lista" aria-label="Reservas">
              {reservas.map((r) => {
                const conteudo = (
                  <>
                    <strong>
                      {formatarData(r.retirada)} a {formatarData(r.devolucao)} — {r.quem}
                    </strong>
                    <span>{r.itens.map((i) => `${i.quantidade} × ${i.nome}`).join(', ')}</span>
                    <span>
                      <Situacao e={r} />
                    </span>
                  </>
                )
                return (
                  <li key={r.emprestimo_id}>
                    {vePedidos ? (
                      <Link to={`/patrimonio/emprestimos/${r.emprestimo_id}`} className="lista-item">
                        {conteudo}
                      </Link>
                    ) : (
                      <div className="lista-item lista-item-estatico">{conteudo}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        }
      </MostrarCarga>
    </section>
  )
}

// ---------- Bens ----------

function Bens({ perfis }: { perfis: readonly Perfil[] }) {
  const cuida = equipe(perfis)
  const veBaixas = cuida || perfis.includes('conselho_fiscal')
  const [carga, recarregar] = useCarregar(async () => {
    const [itens, baixas] = await Promise.all([listarItens(), veBaixas ? listarBaixas() : Promise.resolve(ok([]))])
    if (itens.erro !== null) return itens
    if (baixas.erro !== null) return baixas
    return ok({ itens: itens.dados, baixas: baixas.dados })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [editando, setEditando] = useState<ItemPatrimonio | null>(null)
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) {
      setEditando(null)
      recarregar()
    }
  }
  return (
    <section aria-label="Bens do COMEP">
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {cuida && <FormItem key={editando?.id ?? 'novo'} item={editando} aoConcluir={concluir} aoDesistir={() => setEditando(null)} />}
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ itens, baixas }) => (
          <>
            {itens.length === 0 ? (
              <p className="vazio">Nenhum bem cadastrado.</p>
            ) : (
              <ul className="lista" aria-label="Bens">
                {itens.map((i) => (
                  <LinhaItem key={i.id} i={i} cuida={cuida} aoEditar={() => setEditando(i)} aoConcluir={concluir} />
                ))}
              </ul>
            )}
            {veBaixas && baixas.length > 0 && (
              <details className="acao-recolhida">
                <summary>Baixas ({baixas.length})</summary>
                <ul className="lista-simples" aria-label="Baixas">
                  {baixas.map((b) => (
                    <li key={b.id}>
                      {formatarData(b.data)} — {b.quantidade} × {itens.find((i) => i.id === b.item_id)?.nome ?? 'item'}: {b.motivo}
                      {b.emprestimo_id && (
                        <>
                          {' '}
                          (<Link to={`/patrimonio/emprestimos/${b.emprestimo_id}`}>empréstimo</Link>)
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </MostrarCarga>
    </section>
  )
}

function LinhaItem({ i, cuida, aoEditar, aoConcluir }: { i: ItemPatrimonio; cuida: boolean; aoEditar: () => void; aoConcluir: Concluir }) {
  const [acao, setAcao] = useState<'acrescentar' | 'baixa' | null>(null)
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <li className="lista-item lista-item-estatico" aria-label={i.nome}>
      <strong>
        {i.nome} <span className="etiqueta etiqueta-neutra">{i.quantidade} un.</span>
        {!i.emprestavel && (
          <>
            {' '}
            <span className="etiqueta etiqueta-cancelada">Não se empresta</span>
          </>
        )}
      </strong>
      <span className="detalhe">
        {[
          i.categoria,
          NOME_DA_FORMA_AQUISICAO[i.forma_aquisicao],
          i.adquirido_em && `desde ${formatarData(i.adquirido_em)}`,
          i.valor_unitario !== null && `${formatarReais(i.valor_unitario)} cada`,
          i.local_guarda && `guardado em: ${i.local_guarda}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      {i.descricao && <span>{i.descricao}</span>}
      {cuida && (
        <span className="acoes-linha">
          <button type="button" className="botao-texto" onClick={aoEditar}>
            Alterar
          </button>
          <button type="button" className="botao-texto" onClick={() => setAcao(acao === 'acrescentar' ? null : 'acrescentar')}>
            Acrescentar
          </button>
          <button type="button" className="botao-texto" onClick={() => setAcao(acao === 'baixa' ? null : 'baixa')}>
            Dar baixa
          </button>
        </span>
      )}
      {acao && (
        <form
          className="form-linha"
          aria-label={acao === 'acrescentar' ? `Acrescentar: ${i.nome}` : `Dar baixa: ${i.nome}`}
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              const n = Number(quantidade)
              const r = acao === 'acrescentar' ? await acrescentarItem(i.id, n, motivo) : await baixarItem(i.id, n, motivo)
              if (r.erro === null) {
                setAcao(null)
                setQuantidade('')
                setMotivo('')
              }
              aoConcluir(r, acao === 'acrescentar' ? `${n} unidade(s) acrescentada(s) em ${i.nome}.` : `Baixa de ${n} unidade(s) em ${i.nome}.`)
            })
          }}
        >
          <label>
            Quantos *
            <input type="number" className="campo-numero" required min={1} step={1} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </label>
          <label>
            {acao === 'acrescentar' ? 'De onde vieram *' : 'Motivo da baixa *'}
            <input
              required
              minLength={3}
              maxLength={500}
              placeholder={acao === 'acrescentar' ? 'Ex.: compra de 13/11/2026' : 'Ex.: quebrou, perdido, doado'}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <button type="submit" className="botao botao-pequeno" disabled={enviando}>
            {acao === 'acrescentar' ? 'Acrescentar' : 'Dar baixa'}
          </button>
        </form>
      )}
    </li>
  )
}

function FormItem({ item, aoConcluir, aoDesistir }: { item: ItemPatrimonio | null; aoConcluir: Concluir; aoDesistir: () => void }) {
  const vazio = {
    nome: '',
    categoria: '',
    descricao: '',
    quantidade: '1',
    emprestavel: true,
    forma_aquisicao: 'compra' as FormaAquisicao,
    adquirido_em: '',
    valor_unitario: '',
    local_guarda: '',
  }
  const [d, setD] = useState(
    item
      ? {
          nome: item.nome,
          categoria: item.categoria ?? '',
          descricao: item.descricao ?? '',
          quantidade: String(item.quantidade),
          emprestavel: item.emprestavel,
          forma_aquisicao: item.forma_aquisicao,
          adquirido_em: item.adquirido_em ?? '',
          valor_unitario: item.valor_unitario === null ? '' : valorParaCampo(item.valor_unitario),
          local_guarda: item.local_guarda ?? '',
        }
      : vazio,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const mudar = (parte: Partial<typeof d>) => setD((atual) => ({ ...atual, ...parte }))
  return (
    <details className="painel acao-recolhida-painel" open={item !== null}>
      <summary>{item ? `Alterar: ${item.nome}` : 'Cadastrar um bem'}</summary>
      <form
        aria-label="Bem"
        onSubmit={(e) => {
          e.preventDefault()
          setErro(null)
          const valor = d.valor_unitario.trim() === '' ? null : lerValor(d.valor_unitario)
          if (Number.isNaN(valor)) return setErro('Valor inválido.')
          const dados: DadosItem = {
            nome: d.nome,
            categoria: d.categoria,
            descricao: d.descricao,
            quantidade: Number(d.quantidade),
            emprestavel: d.emprestavel,
            forma_aquisicao: d.forma_aquisicao,
            adquirido_em: d.adquirido_em,
            valor_unitario: valor,
            local_guarda: d.local_guarda,
          }
          void umaVez(async () => {
            const r = await salvarItem(item?.id ?? null, dados)
            if (r.erro !== null) return setErro(r.erro)
            if (!item) setD(vazio)
            aoConcluir(r, item ? 'Bem alterado.' : 'Bem cadastrado.')
          })
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Nome *
            <input required minLength={3} maxLength={120} value={d.nome} onChange={(e) => mudar({ nome: e.target.value })} />
          </label>
          <label>
            Categoria
            <input maxLength={60} placeholder="Ex.: Som, Mobiliário" value={d.categoria} onChange={(e) => mudar({ categoria: e.target.value })} />
          </label>
          <label>
            Quantidade *
            {item ? (
              <input value={d.quantidade} disabled title="Use Acrescentar ou Dar baixa (fica o histórico)" />
            ) : (
              <input type="number" required min={1} step={1} value={d.quantidade} onChange={(e) => mudar({ quantidade: e.target.value })} />
            )}
          </label>
          <label>
            Como foi adquirido
            <select value={d.forma_aquisicao} onChange={(e) => mudar({ forma_aquisicao: e.target.value as FormaAquisicao })}>
              {(Object.keys(NOME_DA_FORMA_AQUISICAO) as FormaAquisicao[]).map((f) => (
                <option key={f} value={f}>
                  {NOME_DA_FORMA_AQUISICAO[f]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input type="date" max={hojeIso()} value={d.adquirido_em} onChange={(e) => mudar({ adquirido_em: e.target.value })} />
          </label>
          <label>
            Valor de cada um (R$)
            <input inputMode="decimal" pattern={PADRAO_VALOR} title={DICA_VALOR} value={d.valor_unitario} onChange={(e) => mudar({ valor_unitario: e.target.value })} />
          </label>
          <label>
            Onde fica guardado
            <input maxLength={200} value={d.local_guarda} onChange={(e) => mudar({ local_guarda: e.target.value })} />
          </label>
          <label className="largura-total">
            Descrição
            <textarea maxLength={1000} rows={2} value={d.descricao} onChange={(e) => mudar({ descricao: e.target.value })} />
          </label>
          <label className="caixa-marcar largura-total">
            <input type="checkbox" checked={d.emprestavel} onChange={(e) => mudar({ emprestavel: e.target.checked })} />
            Pode ser emprestado às igrejas
          </label>
        </div>
        {item && <p className="detalhe">A quantidade muda por "Acrescentar" ou "Dar baixa" na lista, para ficar o histórico.</p>}
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            {item ? 'Salvar' : 'Cadastrar'}
          </button>
          {item && (
            <button type="button" className="botao-texto" onClick={aoDesistir}>
              Desistir
            </button>
          )}
        </div>
      </form>
    </details>
  )
}

// ---------- Regras ----------

function Regras({ perfis }: { perfis: readonly Perfil[] }) {
  const [carga, recarregar] = useCarregar(buscarConfigPatrimonio)
  const presidencia = perfis.includes('presidencia')
  return (
    <section aria-label="Regras do empréstimo">
      <p className="detalhe">
        As regras de apoio às igrejas ainda vão ser definidas pela diretoria; até lá, valem estas (a presidência muda).
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(c) => (presidencia ? <FormRegras config={c} aoSalvar={recarregar} /> : <MostrarRegras c={c} />)}
      </MostrarCarga>
    </section>
  )
}

function MostrarRegras({ c }: { c: ConfigPatrimonio }) {
  return (
    <>
      <dl className="definicoes">
        <dt>Antecedência do pedido</dt>
        <dd>{c.antecedencia_dias} dia(s)</dd>
        <dt>Prazo máximo</dt>
        <dd>{c.prazo_maximo_dias} dia(s)</dd>
        <dt>Contribuição em dia</dt>
        <dd>{c.exige_em_dia ? 'é preciso estar em dia para pedir' : 'não é exigida'}</dd>
      </dl>
      <h2>Termo de compromisso</h2>
      <p className="texto-edital">{c.texto_termo}</p>
    </>
  )
}

function FormRegras({ config, aoSalvar }: { config: ConfigPatrimonio; aoSalvar: () => void }) {
  const [c, setC] = useState(config)
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  return (
    <form
      aria-label="Regras do empréstimo"
      className="painel"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => {
          const r = await salvarConfigPatrimonio(c)
          setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Regras do empréstimo salvas.' })
          if (r.erro === null) aoSalvar()
        })
      }}
    >
      <div className="grade-form">
        <label>
          Antecedência do pedido (dias)
          <input type="number" required min={0} max={90} value={c.antecedencia_dias} onChange={(e) => setC({ ...c, antecedencia_dias: Number(e.target.value) })} />
        </label>
        <label>
          Prazo máximo (dias)
          <input type="number" required min={1} max={90} value={c.prazo_maximo_dias} onChange={(e) => setC({ ...c, prazo_maximo_dias: Number(e.target.value) })} />
        </label>
        <label className="caixa-marcar largura-total">
          <input type="checkbox" checked={c.exige_em_dia} onChange={(e) => setC({ ...c, exige_em_dia: e.target.checked })} />
          Para pedir, o pastor precisa estar em dia com a contribuição
        </label>
        <label className="largura-total">
          Texto do termo de compromisso *
          <textarea required minLength={20} maxLength={4000} rows={6} value={c.texto_termo} onChange={(e) => setC({ ...c, texto_termo: e.target.value })} />
        </label>
      </div>
      <p className="detalhe">O texto novo vale para os pedidos seguintes; cada pedido guarda o termo que foi aceito.</p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Salvar as regras
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// /patrimonio/emprestimos/:id
// ---------------------------------------------------------------------

export function DetalheEmprestimo() {
  const { id = '' } = useParams()
  return <ConteudoEmprestimo key={id} id={id} />
}

function ConteudoEmprestimo({ id }: { id: string }) {
  const { perfis, pessoaId } = useConta()
  const local = useLocation()
  const [carga, recarregar] = useCarregar(async () => {
    const [e, igrejas] = await Promise.all([buscarEmprestimo(id), equipe(perfis) ? igrejasDoPedido() : Promise.resolve(ok([] as IgrejaDoPedido[]))])
    if (e.erro !== null) return e
    return ok({ e: e.dados, igrejas: igrejas.erro === null ? igrejas.dados : [] })
  })
  const [retorno, setRetorno] = useState<Retorno>(() => {
    const mensagem = (local.state as { mensagem?: string } | null)?.mensagem
    return mensagem ? { sucesso: mensagem } : {}
  })
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <>
      <p className="nao-imprimir">
        <Link to="/patrimonio">← Patrimônio</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ e, igrejas }) => {
          if (!e) {
            return (
              <Aviso titulo="Pedido não encontrado">
                <p>Só veem o pedido quem pediu, o pastor presidente da igreja e a equipe do patrimônio.</p>
              </Aviso>
            )
          }
          const peso = e.igreja_id ? igrejas.find((g) => g.id === e.igreja_id) : undefined
          const podeCancelar =
            (e.situacao === 'solicitado' || e.situacao === 'aprovado') &&
            (equipe(perfis) || e.solicitante_id === pessoaId || (e.igreja_id !== null && perfis.includes('presidente_igreja')))
          return (
            <>
              <h1>{e.igreja ? `Empréstimo à ${e.igreja.nome}` : `Reserva: ${e.evento?.titulo ?? 'evento do COMEP'}`}</h1>
              <p>
                <Situacao e={e} />
              </p>
              <dl className="definicoes">
                <dt>Período</dt>
                <dd>
                  retirada em {formatarData(e.retirada)}, devolução em {formatarData(e.devolucao)}
                </dd>
                <dt>Para que é</dt>
                <dd>{e.finalidade}</dd>
                <dt>Pedido por</dt>
                <dd>
                  {e.solicitante?.nome ?? '—'} em {formatarDataHora(e.criado_em)}
                </dd>
                {peso && (
                  <>
                    <dt>A igreja no COMEP</dt>
                    <dd>
                      {peso.ministros} ministro(s) associado(s), {peso.em_dia} em dia
                    </dd>
                  </>
                )}
                {e.decidido_em && (
                  <>
                    <dt>{e.situacao === 'recusado' ? 'Recusado em' : 'Aprovado em'}</dt>
                    <dd>{formatarDataHora(e.decidido_em)}</dd>
                  </>
                )}
                {e.motivo && (
                  <>
                    <dt>Motivo</dt>
                    <dd>{e.motivo}</dd>
                  </>
                )}
                {e.retirado_em && (
                  <>
                    <dt>Retirado</dt>
                    <dd>
                      em {formatarDataHora(e.retirado_em)} por {e.retirado_por_nome}
                    </dd>
                  </>
                )}
                {e.devolvido_em && (
                  <>
                    <dt>Devolvido</dt>
                    <dd>
                      em {formatarDataHora(e.devolvido_em)}
                      {e.observacao_devolucao && ` — ${e.observacao_devolucao}`}
                    </dd>
                  </>
                )}
              </dl>
              <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />

              <div className="tabela-rolagem">
                <table className="tabela-relatorio" aria-label="Itens emprestados">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="numero">Quantidade</th>
                      {e.situacao === 'devolvido' && <th className="numero">Voltaram</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {e.itens.map((i) => (
                      <tr key={i.id}>
                        <td>{i.item?.nome ?? 'item'}</td>
                        <td className="numero">{i.quantidade}</td>
                        {e.situacao === 'devolvido' && <td className="numero">{i.devolvida ?? i.quantidade}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {e.situacao === 'solicitado' && aprova(perfis) && <Decidir e={e} aoConcluir={concluir} />}
              {e.situacao === 'aprovado' && equipe(perfis) && <Retirada e={e} aoConcluir={concluir} />}
              {e.situacao === 'retirado' && equipe(perfis) && <Devolucao e={e} aoConcluir={concluir} />}
              {podeCancelar && <Cancelar e={e} aoConcluir={concluir} />}

              {e.termo_texto && (
                <section className="painel" aria-labelledby="titulo-termo">
                  <h2 id="titulo-termo">Termo de compromisso</h2>
                  <p className="texto-edital">{e.termo_texto}</p>
                  <p className="detalhe">
                    Aceito por {e.solicitante?.nome ?? '—'}, pela {e.igreja?.nome}, em {e.termo_aceito_em && formatarDataHora(e.termo_aceito_em)}.
                  </p>
                  <div className="somente-impressao">
                    <p>Itens: {resumoDosItens(e)}.</p>
                    <p>
                      Período: {formatarData(e.retirada)} a {formatarData(e.devolucao)}.
                    </p>
                    <p>Retirado por: ______________________________________ Data: ____/____/______</p>
                    <p>Entregue pelo COMEP: ________________________________</p>
                    <p>Devolvido em: ____/____/______ Recebido por: ___________________________</p>
                  </div>
                  <div className="acoes nao-imprimir">
                    <button type="button" className="botao botao-secundario" onClick={imprimir}>
                      Imprimir o termo
                    </button>
                  </div>
                </section>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function Decidir({ e, aoConcluir }: { e: Emprestimo; aoConcluir: Concluir }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel nao-imprimir" aria-labelledby="titulo-decidir">
      <h2 id="titulo-decidir">Aprovar ou recusar</h2>
      <p className="detalhe">Ao aprovar, o sistema confere de novo a agenda: se os itens já estiverem reservados nesse período, ele avisa.</p>
      <div className="acoes">
        <button
          type="button"
          className="botao"
          disabled={enviando}
          onClick={() => void umaVez(async () => aoConcluir(await decidirEmprestimo(e.id, true, motivo), 'Empréstimo aprovado: já conta na agenda.'))}
        >
          Aprovar
        </button>
      </div>
      <form
        className="form-linha"
        aria-label="Recusar o pedido"
        onSubmit={(ev) => {
          ev.preventDefault()
          void umaVez(async () => aoConcluir(await decidirEmprestimo(e.id, false, motivo), 'Pedido recusado.'))
        }}
      >
        <label>
          Motivo da recusa *
          <input required minLength={3} maxLength={500} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
        </label>
        <button type="submit" className="botao botao-perigo" disabled={enviando}>
          Recusar
        </button>
      </form>
    </section>
  )
}

function Retirada({ e, aoConcluir }: { e: Emprestimo; aoConcluir: Concluir }) {
  const [nome, setNome] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <form
      className="painel nao-imprimir"
      aria-label="Registrar a retirada"
      onSubmit={(ev) => {
        ev.preventDefault()
        void umaVez(async () => aoConcluir(await registrarRetirada(e.id, nome), 'Retirada registrada.'))
      }}
    >
      <h2>Retirada</h2>
      <p className="detalhe">Confira os itens com quem veio buscar e registre o nome. Imprima o termo para a assinatura.</p>
      <div className="form-linha">
        <label>
          Quem retirou *
          <input required minLength={3} maxLength={120} value={nome} onChange={(ev) => setNome(ev.target.value)} />
        </label>
        <button type="submit" className="botao" disabled={enviando}>
          Registrar a retirada
        </button>
      </div>
    </form>
  )
}

function Devolucao({ e, aoConcluir }: { e: Emprestimo; aoConcluir: Concluir }) {
  const [voltaram, setVoltaram] = useState<Record<string, string>>(() => Object.fromEntries(e.itens.map((i) => [i.item_id, String(i.quantidade)])))
  const [observacao, setObservacao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const faltou = e.itens.some((i) => Number(voltaram[i.item_id]) < i.quantidade)
  return (
    <form
      className="painel nao-imprimir"
      aria-label="Registrar a devolução"
      onSubmit={(ev) => {
        ev.preventDefault()
        void umaVez(async () =>
          aoConcluir(
            await registrarDevolucao(
              e.id,
              e.itens.map((i) => ({ item_id: i.item_id, devolvida: Number(voltaram[i.item_id]) })),
              observacao,
            ),
            faltou ? 'Devolução registrada; o que faltou saiu do patrimônio (baixa).' : 'Devolução registrada: tudo voltou.',
          ),
        )
      }}
    >
      <h2>Devolução</h2>
      <p className="detalhe">Conte o que voltou. O que faltar (ou voltar sem conserto) sai do patrimônio, ligado a este empréstimo.</p>
      <div className="grade-form">
        {e.itens.map((i) => (
          <label key={i.id}>
            Voltaram: {i.item?.nome ?? 'item'} (de {i.quantidade})
            <input
              type="number"
              className="campo-numero"
              required
              min={0}
              max={i.quantidade}
              step={1}
              value={voltaram[i.item_id] ?? ''}
              onChange={(ev) => setVoltaram((v) => ({ ...v, [i.item_id]: ev.target.value }))}
            />
          </label>
        ))}
        <label className="largura-total">
          {faltou ? 'O que aconteceu com o que faltou *' : 'Observação'}
          <textarea required={faltou} minLength={faltou ? 3 : undefined} maxLength={1000} rows={2} value={observacao} onChange={(ev) => setObservacao(ev.target.value)} />
        </label>
      </div>
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Registrar a devolução
        </button>
      </div>
    </form>
  )
}

function Cancelar({ e, aoConcluir }: { e: Emprestimo; aoConcluir: Concluir }) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida nao-imprimir">
      <summary>Cancelar o pedido</summary>
      <div className="form-linha">
        <label>
          Motivo
          <input maxLength={500} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
        </label>
        <BotaoConfirmarNaLinha
          texto="Cancelar o pedido"
          confirmar="Confirmar — cancelar o pedido"
          desabilitado={enviando}
          aoConfirmar={() => void umaVez(async () => aoConcluir(await cancelarEmprestimo(e.id, motivo), 'Pedido cancelado: os itens voltaram a ficar livres.'))}
        />
      </div>
    </details>
  )
}

// ---------------------------------------------------------------------
// No Início (secretaria e presidência): pedidos esperando e devoluções atrasadas
// ---------------------------------------------------------------------
