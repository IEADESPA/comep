import { useState } from 'react'
import { Link } from 'react-router'
import { BotaoConfirmarNaLinha, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { Chip } from '../../componentes/Telas'
import type { Area } from '../../componentes/Icone'
import { listarCategoriasFinanceiras, type CategoriaFinanceira } from '../../dados/caixa'
import { ok, type Resultado } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { exercicioDe, nomeDoExercicio } from '../../dados/financeiro'
import {
  aprovarOrcamento,
  arquivarAtividade,
  buscarOrcamento,
  mandarOrcamento,
  proximasAssembleias,
  resumoExercicio,
  salvarAtividade,
  salvarOrcamento,
  voltarOrcamento,
  type AtividadePlano,
  type Orcamento,
  type Resumo,
} from '../../dados/prestacao'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { imprimir } from '../../utilitarios/exportar'
import { formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { DICA_VALOR, lerValor, PADRAO_VALOR, valorParaCampo } from '../../utilitarios/valores'
import { mesesDoExercicio, nomeDoMes, porcento, plural, useExercicio, type Concluir } from './util'

// Financeiro › Orçamento (rodada 11, opção 2: os cartões por categoria) e o plano anual de trabalho (Art. 15, I).
// O orçamento se prepara em rascunho, vai para a assembleia ("Mandar para a assembleia") e, aprovado, não muda mais.

const ehTransferencia = (sistema: string | null | undefined) => (sistema ?? '').startsWith('transferencia')

type Situacao = { nome: string; area: Area; texto: string }

function situacaoDo(o: Orcamento | null): Situacao {
  if (!o) return { nome: 'Ainda não preparado', area: 'assembleias', texto: 'Preencha o previsto de cada categoria e salve.' }
  if (o.aprovado_em_assembleia)
    return { nome: 'Aprovado', area: 'financas', texto: `Aprovado na assembleia de ${formatarData(o.aprovado_em_assembleia)}${o.ata ? ` (${o.ata})` : ''}` }
  if (o.enviado_em) {
    const para = o.encontro ? `a ${o.encontro.titulo} de ${formatarDataDeInstante(o.encontro.inicio)}` : 'a próxima assembleia'
    return {
      nome: 'Na assembleia',
      area: 'assembleias',
      texto: `Mandado em ${formatarDataDeInstante(o.enviado_em)}${o.enviado ? ` por ${o.enviado.nome}` : ''}: vai para ${para}`,
    }
  }
  return { nome: 'Rascunho', area: 'eventos', texto: 'Quando estiver pronto, mande para a assembleia (Art. 15, I).' }
}

const editavel = (o: Orcamento | null) => !o || (!o.enviado_em && !o.aprovado_em_assembleia)

/** O exercício que a tela abre: o atual, se o orçamento dele ainda não foi aprovado; senão, o próximo. */
function useExercicioDoOrcamento(): [number | null, (e: number) => void] {
  const atual = exercicioDe(hojeIso())
  const [carga] = useCarregar(() => buscarOrcamento(atual))
  const padrao = carga.situacao === 'ok' ? (carga.dados?.aprovado_em_assembleia ? atual + 1 : atual) : atual + 1
  const [exercicio, escolher] = useExercicio(padrao)
  return [carga.situacao === 'carregando' ? null : exercicio, escolher]
}

function EscolhaDoExercicio({ exercicio, aoEscolher }: { exercicio: number; aoEscolher: (e: number) => void }) {
  const atual = exercicioDe(hojeIso())
  const anos = [atual - 1, atual, atual + 1]
  return (
    <div className="pilulas" role="group" aria-label="Exercício do orçamento">
      {anos.map((a) => (
        <button key={a} type="button" className={a === exercicio ? 'pilula ativa' : 'pilula'} aria-pressed={a === exercicio} onClick={() => aoEscolher(a)}>
          {nomeDoExercicio(a)}
          {a === atual ? ' (atual)' : a > atual ? ' (próximo)' : ''}
        </button>
      ))}
    </div>
  )
}

/** /financeiro/orcamento — o previsto de cada categoria, em cartões, comparado com o ano de referência. */
export function OrcamentoPorCategoria({ perfis, concluir }: { perfis: readonly string[]; concluir: Concluir }) {
  const [exercicio, escolher] = useExercicioDoOrcamento()
  if (exercicio === null) return null
  return (
    <>
      <EscolhaDoExercicio exercicio={exercicio} aoEscolher={escolher} />
      <ConteudoOrcamento key={exercicio} exercicio={exercicio} perfis={perfis} concluir={concluir} />
    </>
  )
}

type DadosOrcamento = {
  orcamento: Orcamento | null
  referencia: Orcamento | null
  realizado: Resumo
  categorias: CategoriaFinanceira[]
  assembleias: { id: string; titulo: string; inicio: string; tipo: string }[]
}

function ConteudoOrcamento({ exercicio, perfis, concluir }: { exercicio: number; perfis: readonly string[]; concluir: Concluir }) {
  const atual = exercicioDe(hojeIso())
  // o próximo exercício se compara com o atual (até agora); o atual e os passados, com eles mesmos
  const ref = exercicio > atual ? exercicio - 1 : exercicio
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const [carga, recarregar] = useCarregar(async (): Promise<Resultado<DadosOrcamento>> => {
    const [orcamento, referencia, realizado, categorias, assembleias] = await Promise.all([
      buscarOrcamento(exercicio),
      ref === exercicio ? Promise.resolve(ok(null)) : buscarOrcamento(ref),
      resumoExercicio(ref),
      listarCategoriasFinanceiras(),
      opera ? proximasAssembleias() : Promise.resolve(ok([])),
    ])
    if (orcamento.erro !== null) return orcamento
    if (referencia.erro !== null) return referencia
    if (realizado.erro !== null) return realizado
    if (categorias.erro !== null) return categorias
    if (assembleias.erro !== null) return assembleias
    return ok({
      orcamento: orcamento.dados,
      referencia: ref === exercicio ? orcamento.dados : referencia.dados,
      realizado: realizado.dados,
      categorias: categorias.dados,
      assembleias: assembleias.dados,
    })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(d) => <TelaOrcamento key={d.orcamento?.enviado_em ?? 'rascunho'} exercicio={exercicio} referencia={ref} d={d} perfis={perfis} concluir={concluirERecarregar} />}
    </MostrarCarga>
  )
}

function TelaOrcamento({
  exercicio,
  referencia: ref,
  d,
  perfis,
  concluir,
}: {
  exercicio: number
  referencia: number
  d: DadosOrcamento
  perfis: readonly string[]
  concluir: Concluir
}) {
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const presidencia = perfis.includes('presidencia')
  const o = d.orcamento
  const pode = opera && editavel(o)
  const situacao = situacaoDo(o)
  const nome = nomeDoExercicio(exercicio)
  const categorias = d.categorias.filter((c) => !ehTransferencia(c.sistema) || (o?.itens ?? []).some((i) => i.categoria_id === c.id))
  const previstoDe = (orc: Orcamento | null, id: string) => Number(orc?.itens.find((i) => i.categoria_id === id)?.valor ?? 0)
  const realizadoDe = (c: CategoriaFinanceira) =>
    Number((c.tipo === 'entrada' ? d.realizado.entradas : d.realizado.saidas).find((x) => x.categoria === c.nome)?.total ?? 0)
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(categorias.map((c) => [c.id, previstoDe(o, c.id) ? valorParaCampo(previstoDe(o, c.id)) : ''])),
  )
  const [abrir, setAbrir] = useState<'mandar' | 'aprovar' | null>(null)
  const [encontro, setEncontro] = useState(d.assembleias.find((a) => a.tipo === 'ago')?.id ?? '')
  const [data, setData] = useState(hojeIso())
  const [ata, setAta] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()

  const valorDigitado = (id: string) => lerValor(valores[id]?.trim() || '0')
  const total = (tipo: 'entrada' | 'saida') =>
    categorias.filter((c) => c.tipo === tipo).reduce((t, c) => t + (pode ? (valorDigitado(c.id) ?? 0) : previstoDe(o, c.id)), 0)
  const resultado = total('entrada') - total('saida')
  const doPlano = (id: string) => (o?.atividades ?? []).filter((a) => a.categoria_id === id)

  function salvar() {
    setErro(null)
    const itens = categorias.map((c) => ({ categoria: c, valor: valorDigitado(c.id) }))
    const invalido = itens.find((i) => i.valor === null || i.valor < 0)
    if (invalido) return setErro(`Valor inválido em "${invalido.categoria.nome}". ${DICA_VALOR}.`)
    return umaVez(async () =>
      concluir(await salvarOrcamento(exercicio, null, itens.map((i) => ({ categoria_id: i.categoria.id, valor: i.valor ?? 0 }))), `Orçamento ${nome} salvo.`),
    )
  }

  const cartao = (c: CategoriaFinanceira) => {
    const prevRef = previstoDe(d.referencia, c.id)
    const real = realizadoDe(c)
    const atividades = doPlano(c.id)
    const somaPlano = atividades.reduce((t, a) => t + Number(a.valor ?? 0), 0)
    return (
      <li key={c.id} className={`bloco fin-cartao-orcamento area-${c.tipo === 'entrada' ? 'financas' : 'pessoas'}`} aria-label={c.nome}>
        <strong className="fin-cartao-orcamento-nome">{c.nome}</strong>
        <span className="fin-barra" aria-hidden="true">
          <span style={{ width: `${prevRef ? Math.min(100, porcento(real, prevRef)) : real > 0 ? 100 : 0}%` }} />
        </span>
        <span className="detalhe">
          {ref === exercicio ? 'Realizado' : nomeDoExercicio(ref)}: {formatarReais(real)} de {prevRef ? formatarReais(prevRef) : '—'}
        </span>
        {pode ? (
          <label>
            Previsto {nome}
            <input
              inputMode="decimal"
              pattern={PADRAO_VALOR}
              title={DICA_VALOR}
              placeholder="0,00"
              aria-label={`Previsto para ${c.nome}`}
              value={valores[c.id] ?? ''}
              onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
            />
          </label>
        ) : (
          <span className="fin-previsto">
            <span>Previsto {nome}</span>
            <strong>{formatarReais(previstoDe(o, c.id))}</strong>
          </span>
        )}
        {atividades.length > 0 && (
          <span className="detalhe">
            No plano: {formatarReais(somaPlano)} em {plural(atividades.length, 'atividade', 'atividades')}
          </span>
        )}
      </li>
    )
  }

  return (
    <>
      <div className="fin-situacao-orcamento">
        <Chip area={situacao.area}>{situacao.nome}</Chip>
        <span className="fin-situacao-texto">{situacao.texto}</span>
        <span className="fin-situacao-botoes">
          <Link to={`/financeiro/orcamento/plano?exercicio=${exercicio}`} className="botao botao-secundario">
            Plano anual de trabalho
          </Link>
          {opera && o && editavel(o) && (
            <button type="button" className="botao" aria-expanded={abrir === 'mandar'} onClick={() => setAbrir(abrir === 'mandar' ? null : 'mandar')}>
              Mandar para a assembleia
            </button>
          )}
          {opera && o?.enviado_em && !o.aprovado_em_assembleia && (
            <BotaoConfirmarNaLinha
              texto="Voltar para o rascunho"
              confirmar="Confirmar — voltar para o rascunho"
              desabilitado={enviando}
              aoConfirmar={() => void umaVez(async () => concluir(await voltarOrcamento(exercicio), `O orçamento ${nome} voltou para o rascunho.`))}
            />
          )}
          {presidencia && o?.enviado_em && !o.aprovado_em_assembleia && (
            <button type="button" className="botao" aria-expanded={abrir === 'aprovar'} onClick={() => setAbrir(abrir === 'aprovar' ? null : 'aprovar')}>
              Registrar a aprovação da assembleia
            </button>
          )}
        </span>
      </div>

      {abrir === 'mandar' && o && editavel(o) && (
        <form
          className="bloco fin-form-linha"
          aria-label="Mandar para a assembleia"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              if (concluir(await mandarOrcamento(exercicio, encontro || null), `Orçamento ${nome} mandado para a assembleia.`)) setAbrir(null)
            })
          }}
        >
          <label>
            Assembleia
            <select value={encontro} onChange={(e) => setEncontro(e.target.value)}>
              <option value="">Ainda não marcada (a próxima AGO)</option>
              {d.assembleias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titulo} — {formatarDataDeInstante(a.inicio)}
                </option>
              ))}
            </select>
          </label>
          <p className="detalhe">Mandado, o orçamento não muda mais, a não ser que volte para o rascunho. Salve o que digitou antes.</p>
          <button type="submit" className="botao" disabled={enviando}>
            Confirmar e mandar
          </button>
        </form>
      )}
      {abrir === 'aprovar' && (
        <form
          className="bloco fin-form-linha"
          aria-label="Aprovação do orçamento"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              if (concluir(await aprovarOrcamento(exercicio, data, ata), `Orçamento ${nome} aprovado.`)) setAbrir(null)
            })
          }}
        >
          <label className="campo-curto">
            Data da assembleia *
            <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Ata *
            <input required value={ata} onChange={(e) => setAta(e.target.value)} placeholder="Ex.: Ata da AGO de 28/04/2027" />
          </label>
          <button type="submit" className="botao" disabled={enviando}>
            Registrar a aprovação
          </button>
        </form>
      )}

      <h2 className="fin-titulo-grupo area-financas">Receitas · total previsto {formatarReais(total('entrada'))}</h2>
      <ul className="fin-cartoes-orcamento" aria-label="Receitas previstas">
        {categorias.filter((c) => c.tipo === 'entrada').map(cartao)}
      </ul>
      <h2 className="fin-titulo-grupo area-pessoas">Despesas · total previsto {formatarReais(total('saida'))}</h2>
      <ul className="fin-cartoes-orcamento" aria-label="Despesas previstas">
        {categorias.filter((c) => c.tipo === 'saida').map(cartao)}
      </ul>

      <p className={`fin-resultado ${resultado >= 0 ? 'area-financas' : 'area-pessoas'}`}>
        <strong>
          Resultado previsto para {nome}: {resultado >= 0 ? '+' : '−'} {formatarReais(Math.abs(resultado))}
        </strong>
        <span>
          {ref === exercicio ? 'realizado' : `em ${nomeDoExercicio(ref)}, até agora`}: {formatarReais(Number(d.realizado.total_entradas) - Number(d.realizado.total_saidas))}
        </span>
      </p>
      <Mensagem erro={erro} />
      {pode && (
        <div className="acoes">
          <button type="button" className="botao" disabled={enviando} onClick={() => void salvar()}>
            Salvar o orçamento
          </button>
        </div>
      )}
      {!opera && <p className="detalhe">O orçamento é preparado pela tesouraria e aprovado pela assembleia (Art. 15, I).</p>}
    </>
  )
}

// ---------------------------------------------------------------------
// O plano anual de trabalho
// ---------------------------------------------------------------------

/** /financeiro/orcamento/plano — as atividades do exercício, mês a mês, com quem cuida e quanto custa. */
export function PlanoAnual({ perfis, concluir }: { perfis: readonly string[]; concluir: Concluir }) {
  const [exercicio, escolher] = useExercicioDoOrcamento()
  if (exercicio === null) return null
  return (
    <>
      <div className="nao-imprimir">
        <EscolhaDoExercicio exercicio={exercicio} aoEscolher={escolher} />
      </div>
      <ConteudoPlano key={exercicio} exercicio={exercicio} perfis={perfis} concluir={concluir} />
    </>
  )
}

function ConteudoPlano({ exercicio, perfis, concluir }: { exercicio: number; perfis: readonly string[]; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [orcamento, categorias] = await Promise.all([buscarOrcamento(exercicio), listarCategoriasFinanceiras()])
    if (orcamento.erro !== null) return orcamento
    if (categorias.erro !== null) return categorias
    return ok({ orcamento: orcamento.dados, categorias: categorias.dados.filter((c) => !ehTransferencia(c.sistema)) })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const nome = nomeDoExercicio(exercicio)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ orcamento: o, categorias }) => {
        const pode = opera && editavel(o)
        const situacao = situacaoDo(o)
        const atividades = o?.atividades ?? []
        const grupos = [...mesesDoExercicio(exercicio).map((m) => ({ chave: m, titulo: nomeDoMes(m, true), mes: `${m}-01` })), { chave: 'ano', titulo: 'Ao longo do ano', mes: null }]
        const total = atividades.reduce((t, a) => t + Number(a.valor ?? 0), 0)
        return (
          <>
            <p className="somente-impressao titulo-impressao">COMEP — Plano anual de trabalho do exercício {nome} (abril a março)</p>
            <div className="fin-situacao-orcamento nao-imprimir">
              <Chip area={situacao.area}>{situacao.nome}</Chip>
              <span className="fin-situacao-texto">
                {plural(atividades.length, 'atividade', 'atividades')}
                {total > 0 && ` · ${formatarReais(total)} previstos nas atividades`}
              </span>
              <span className="fin-situacao-botoes">
                <Link to={`/financeiro/orcamento?exercicio=${exercicio}`} className="botao botao-secundario">
                  O orçamento por categoria
                </Link>
                <button type="button" className="botao botao-secundario botao-com-icone" onClick={imprimir}>
                  <Icone nome="imprimir" tamanho={18} />
                  Imprimir ou salvar em PDF
                </button>
              </span>
            </div>
            {!pode && opera && o && <p className="detalhe nao-imprimir">{situacao.texto}. Para mudar o plano, o orçamento precisa voltar para o rascunho.</p>}

            <Apresentacao key={o?.plano_trabalho ?? ''} exercicio={exercicio} texto={o?.plano_trabalho ?? ''} pode={pode} concluir={concluirERecarregar} />

            {atividades.length === 0 && <p className="vazio">Nenhuma atividade no plano de {nome} ainda.</p>}
            {grupos.map((g) => {
              const doGrupo = atividades.filter((a) => a.mes === g.mes)
              if (doGrupo.length === 0) return null
              return (
                <section key={g.chave} className="fin-plano-grupo" aria-labelledby={`plano-${g.chave}`}>
                  <h2 id={`plano-${g.chave}`}>{g.titulo}</h2>
                  <ul className="fin-cartoes" aria-label={`Atividades: ${g.titulo}`}>
                    {doGrupo.map((a) => (
                      <CartaoAtividade key={a.id} a={a} exercicio={exercicio} categorias={categorias} pode={pode} concluir={concluirERecarregar} />
                    ))}
                  </ul>
                </section>
              )
            })}

            {pode && <FormAtividade exercicio={exercicio} categorias={categorias} concluir={concluirERecarregar} />}
          </>
        )
      }}
    </MostrarCarga>
  )
}

function Apresentacao({ exercicio, texto, pode, concluir }: { exercicio: number; texto: string; pode: boolean; concluir: Concluir }) {
  const [valor, setValor] = useState(texto)
  const [enviando, umaVez] = useUmaVez()
  if (!pode) {
    return texto ? (
      <section className="bloco" aria-labelledby="titulo-apresentacao">
        <h2 id="titulo-apresentacao">Apresentação</h2>
        <p className="texto-livre">{texto}</p>
      </section>
    ) : null
  }
  return (
    <form
      className="bloco nao-imprimir"
      aria-label="Apresentação do plano"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => concluir(await salvarOrcamento(exercicio, valor, []), 'Apresentação do plano salva.'))
      }}
    >
      <label>
        Apresentação do plano (opcional)
        <textarea rows={3} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="O que o COMEP quer alcançar no exercício, em poucas linhas" />
      </label>
      <button type="submit" className="botao botao-secundario" disabled={enviando}>
        Salvar a apresentação
      </button>
    </form>
  )
}

function CartaoAtividade({
  a,
  exercicio,
  categorias,
  pode,
  concluir,
}: {
  a: AtividadePlano
  exercicio: number
  categorias: CategoriaFinanceira[]
  pode: boolean
  concluir: Concluir
}) {
  const [corrigindo, setCorrigindo] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  const categoria = categorias.find((c) => c.id === a.categoria_id)
  if (corrigindo) {
    return (
      <li className="bloco">
        <FormAtividade
          exercicio={exercicio}
          categorias={categorias}
          atividade={a}
          concluir={(r, s) => {
            const certo = concluir(r, s)
            if (certo) setCorrigindo(false)
            return certo
          }}
          aoCancelar={() => setCorrigindo(false)}
        />
      </li>
    )
  }
  return (
    <li className="bloco fin-atividade" aria-label={a.titulo}>
      <strong className="fin-cartao-titulo">{a.titulo}</strong>
      {a.descricao && <span className="texto-livre">{a.descricao}</span>}
      <span className="detalhe">
        {[a.responsavel && `quem cuida: ${a.responsavel}`, categoria && categoria.nome, a.valor !== null && formatarReais(a.valor)].filter(Boolean).join(' · ') ||
          'sem custo previsto'}
      </span>
      {pode && (
        <span className="acoes nao-imprimir">
          <button type="button" className="botao-texto" onClick={() => setCorrigindo(true)}>
            Corrigir
          </button>
          <BotaoConfirmarNaLinha
            texto="Tirar do plano"
            confirmar="Confirmar — tirar do plano"
            desabilitado={enviando}
            aoConfirmar={() => void umaVez(async () => concluir(await arquivarAtividade(a.id), `"${a.titulo}" saiu do plano.`))}
          />
        </span>
      )}
    </li>
  )
}

function FormAtividade({
  exercicio,
  categorias,
  atividade,
  concluir,
  aoCancelar,
}: {
  exercicio: number
  categorias: CategoriaFinanceira[]
  atividade?: AtividadePlano
  concluir: Concluir
  aoCancelar?: () => void
}) {
  const [titulo, setTitulo] = useState(atividade?.titulo ?? '')
  const [mes, setMes] = useState(atividade?.mes ?? '')
  const [responsavel, setResponsavel] = useState(atividade?.responsavel ?? '')
  const [categoria, setCategoria] = useState(atividade?.categoria_id ?? '')
  const [valor, setValor] = useState(atividade?.valor !== null && atividade?.valor !== undefined ? valorParaCampo(atividade.valor) : '')
  const [descricao, setDescricao] = useState(atividade?.descricao ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const nova = !atividade

  return (
    <form
      className={nova ? 'bloco nao-imprimir' : 'nao-imprimir'}
      aria-label={nova ? 'Nova atividade' : `Corrigir ${atividade.titulo}`}
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        const numero = valor.trim() ? lerValor(valor) : null
        if (valor.trim() && (numero === null || numero < 0)) return setErro(`Valor inválido. ${DICA_VALOR}.`)
        void umaVez(async () => {
          const r = await salvarAtividade(exercicio, atividade?.id ?? null, {
            titulo,
            mes: mes || null,
            descricao,
            responsavel,
            categoria_id: categoria || null,
            valor: numero,
          })
          if (concluir(r, nova ? `"${titulo.trim()}" entrou no plano.` : 'Atividade corrigida.') && nova) {
            setTitulo('')
            setDescricao('')
            setValor('')
          }
        })
      }}
    >
      {nova && <h2>Nova atividade</h2>}
      <div className="grade-form">
        <label className="largura-total">
          O que é *
          <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Conferência de obreiros, com workshops" />
        </label>
        <label>
          Quando
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Ao longo do ano</option>
            {mesesDoExercicio(exercicio).map((m) => (
              <option key={m} value={`${m}-01`}>
                {nomeDoMes(m, true)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quem cuida
          <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: Comissão de eventos" />
        </label>
        <label>
          Categoria do orçamento
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">— Nenhuma —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.tipo === 'entrada' ? 'receita' : 'despesa'})
              </option>
            ))}
          </select>
        </label>
        <label>
          Quanto custa (R$)
          <input inputMode="decimal" pattern={PADRAO_VALOR} title={DICA_VALOR} placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
        </label>
        <label className="largura-total">
          Detalhes
          <textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </div>
      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {nova ? 'Pôr no plano' : 'Salvar a atividade'}
        </button>
        {aoCancelar && (
          <button type="button" className="botao botao-secundario" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
