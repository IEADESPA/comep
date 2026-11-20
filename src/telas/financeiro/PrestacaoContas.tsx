import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { NOME_DA_SITUACAO_LANCAMENTO } from '../../dados/caixa'
import { ok, type Resultado } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { exercicioDe, nomeDoExercicio } from '../../dados/financeiro'
import type { Perfil } from '../../dados/perfis'
import {
  analisarBalanco,
  assembleiaBalanco,
  buscarBalanco,
  contribuicoesPorIgreja,
  devolverBalanco,
  exerciciosComBalanco,
  fecharBalanco,
  lancamentosDoExercicio,
  NOME_DA_SITUACAO_BALANCO,
  NOME_DO_PARECER,
  resumoExercicio,
  type Balanco,
  type ContribuicaoIgreja,
  type EventoBalanco,
  type LancamentoRelatorio,
  type Resumo,
  type TotalCategoria,
} from '../../dados/prestacao'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { baixarCsv, imprimir, numeroPlanilha } from '../../utilitarios/exportar'
import { formatarData, formatarDataHora, hojeIso } from '../../utilitarios/formatos'
import { mesesComValores, PRIMEIRO_EXERCICIO, useExercicio } from './util'

// Financeiro › Prestação de contas (rodada 11, opção 1: as etapas e os números). Subfunções: o exercício (as etapas
// do balanço, os números e o passo de cada um), Mês a mês e Balanço e parecer (o documento para imprimir).
// O balanço passa por quatro passos: a tesouraria fecha, a diretoria analisa, o Conselho Fiscal dá o parecer e a
// assembleia aprecia (Art. 12, §6º, III; Art. 14; Art. 15, I).

/** A lista "Exercício" (com a situação do balanço de cada um). */
function SeletorExercicio({ exercicio, aoEscolher }: { exercicio: number; aoEscolher: (e: number) => void }) {
  const atual = exercicioDe(hojeIso())
  const [carga] = useCarregar(exerciciosComBalanco)
  const situacoes = new Map((carga.situacao === 'ok' ? carga.dados : []).map((b) => [b.exercicio, b.situacao]))
  const anos = [
    ...new Set([...Array.from({ length: Math.max(atual - PRIMEIRO_EXERCICIO + 1, 1) }, (_, i) => atual - i), ...situacoes.keys(), exercicio]),
  ].sort((a, b) => b - a)
  return (
    <label className="campo-medio">
      Exercício
      <select value={exercicio} onChange={(e) => aoEscolher(Number(e.target.value))}>
        {anos.map((a) => {
          const s = situacoes.get(a)
          return (
            <option key={a} value={a}>
              {nomeDoExercicio(a)}
              {a === atual ? ' (atual)' : ''}
              {s ? ` — ${NOME_DA_SITUACAO_BALANCO[s].toLowerCase()}` : ''}
            </option>
          )
        })}
      </select>
    </label>
  )
}

function BarraDoExercicio({ exercicio, aoEscolher, children }: { exercicio: number; aoEscolher: (e: number) => void; children?: ReactNode }) {
  return (
    <div className="fin-barra-acoes nao-imprimir">
      <SeletorExercicio exercicio={exercicio} aoEscolher={aoEscolher} />
      <span className="fin-espaco" />
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------
// O exercício: as etapas, os números e o passo de cada um
// ---------------------------------------------------------------------

/** /financeiro/prestacao — as etapas do balanço do exercício e os números. */
export function PrestacaoExercicio({ perfis, pessoaId }: { perfis: Perfil[]; pessoaId: string }) {
  const [exercicio, escolher] = useExercicio()
  return (
    <>
      <BarraDoExercicio exercicio={exercicio} aoEscolher={escolher}>
        <Link to={`/financeiro/prestacao/mes-a-mes?exercicio=${exercicio}`} className="botao botao-secundario">
          Mês a mês
        </Link>
        <Link to={`/financeiro/prestacao/balanco?exercicio=${exercicio}`} className="botao botao-secundario botao-com-icone">
          <Icone nome="imprimir" tamanho={18} />
          Balanço para imprimir
        </Link>
      </BarraDoExercicio>
      <ConteudoExercicio key={exercicio} exercicio={exercicio} perfis={perfis} pessoaId={pessoaId} />
    </>
  )
}

type DadosExercicio = { resumo: Resumo; balanco: { balanco: Balanco | null; eventos: EventoBalanco[] } }

function carregarExercicio(exercicio: number) {
  return async (): Promise<Resultado<DadosExercicio>> => {
    const [resumo, balanco] = await Promise.all([resumoExercicio(exercicio), buscarBalanco(exercicio)])
    if (resumo.erro !== null) return resumo
    if (balanco.erro !== null) return balanco
    return ok({ resumo: resumo.dados, balanco: balanco.dados })
  }
}

function ConteudoExercicio({ exercicio, perfis, pessoaId }: { exercicio: number; perfis: Perfil[]; pessoaId: string }) {
  const [carga, recarregar] = useCarregar(carregarExercicio(exercicio))
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(d) => {
        const { balanco, eventos } = d.balanco
        const congelado = balanco !== null && balanco.situacao !== 'devolvido'
        const resumo = congelado ? balanco.resumo : d.resumo
        return (
          <>
            <PainelBalanco
              exercicio={exercicio}
              encerrado={d.resumo.encerrado}
              aguardando={d.resumo.despesas_aguardando.quantidade}
              balanco={balanco}
              eventos={eventos}
              perfis={perfis}
              pessoaId={pessoaId}
              recarregar={recarregar}
            />
            <NumerosDoExercicio
              resumo={resumo}
              origem={
                congelado
                  ? `Números congelados quando a tesouraria fechou o exercício (${formatarDataHora(balanco.fechado_em ?? resumo.calculado_em)}).`
                  : resumo.encerrado
                    ? 'Números de agora: o exercício terminou, mas o balanço ainda não foi fechado.'
                    : `Prévia: o exercício vai até 31/03/${resumo.exercicio + 1}.`
              }
              aguardando={congelado ? null : d.resumo.despesas_aguardando}
            />
            <Planilhas exercicio={exercicio} resumo={resumo} />
          </>
        )
      }}
    </MostrarCarga>
  )
}

type Etapa = { titulo: string; feito: boolean; detalhe: ReactNode }

function etapasDo(balanco: Balanco | null): Etapa[] {
  const b = balanco && balanco.situacao !== 'devolvido' ? balanco : null
  const quem = (em: string | null, nome: string | undefined) => (em ? `${formatarDataHora(em)}${nome ? ` — ${nome}` : ''}` : '')
  return [
    { titulo: 'Fechado pela tesouraria', feito: Boolean(b?.fechado_em), detalhe: b ? quem(b.fechado_em, b.fechado?.nome) : 'depois de 31 de março' },
    { titulo: 'Análise da diretoria', feito: Boolean(b?.analisado_em), detalhe: b?.analisado_em ? quem(b.analisado_em, b.analisado?.nome) : 'a presidência' },
    {
      titulo: b?.parecer ? `Parecer do Conselho Fiscal: ${NOME_DO_PARECER[b.parecer]}` : 'Parecer do Conselho Fiscal',
      feito: Boolean(b?.parecer),
      detalhe: b?.parecer_em ? quem(b.parecer_em, b.parecerista?.nome) : 'Art. 14',
    },
    {
      titulo: 'Decisão da assembleia',
      feito: b?.situacao === 'aprovado',
      detalhe: b?.assembleia_data ? `Aprovado em ${formatarData(b.assembleia_data)} — ${b.assembleia_ata}` : 'a AGO de abril',
    },
  ]
}

function PainelBalanco({
  exercicio,
  encerrado,
  aguardando,
  balanco,
  eventos,
  perfis,
  pessoaId,
  recarregar,
}: {
  exercicio: number
  encerrado: boolean
  aguardando: number
  balanco: Balanco | null
  eventos: EventoBalanco[]
  perfis: Perfil[]
  pessoaId: string
  recarregar: () => void
}) {
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [decisao, setDecisao] = useState<'aprovado' | 'reprovado'>('aprovado')
  const [data, setData] = useState(hojeIso())
  const [ata, setAta] = useState('')
  const [enviando, umaVez] = useUmaVez()

  const situacao = balanco?.situacao ?? null
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const presidencia = perfis.includes('presidencia')
  const conselho = perfis.includes('conselho_fiscal')
  const fecheiEu = balanco?.fechado?.id === pessoaId
  const nome = nomeDoExercicio(exercicio)
  const etapas = etapasDo(balanco)
  const agora = etapas.findIndex((e) => !e.feito)

  function agir(acao: () => Promise<Resultado<null>>, sucesso: string) {
    return umaVez(async () => {
      const r = await acao()
      setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
      if (r.erro === null) {
        setTexto('')
        setMotivo('')
        setAta('')
        recarregar()
      }
    })
  }

  const devolver = (
    <details className="acao-recolhida">
      <summary>Devolver à tesouraria para correção</summary>
      <form
        className="form-compacto"
        onSubmit={(e) => {
          e.preventDefault()
          if (balanco) void agir(() => devolverBalanco(balanco.id, motivo), 'Balanço devolvido à tesouraria.')
        }}
      >
        <label>
          O que precisa ser corrigido *
          <textarea required rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </label>
        <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
          Devolver
        </button>
      </form>
    </details>
  )

  return (
    <section className="bloco" aria-labelledby="titulo-balanco" data-situacao={situacao ?? 'sem_balanco'}>
      <div className="fin-titulo-balanco">
        <h2 id="titulo-balanco">Balanço do exercício {nome}</h2>
        <strong className="situacao-balanco">
          {situacao ? NOME_DA_SITUACAO_BALANCO[situacao] : encerrado ? 'Ainda não fechado pela tesouraria' : 'Exercício em andamento'}
        </strong>
      </div>
      <ol className="fin-etapas" aria-label="As etapas do balanço">
        {etapas.map((e, i) => (
          <li key={e.titulo} className={e.feito ? 'feito' : i === agora ? 'agora' : undefined}>
            <span className="fin-etapa-bola" aria-hidden="true">
              {e.feito ? <Icone nome="check" tamanho={16} traco={3} /> : i + 1}
            </span>
            <span className="fin-etapa-texto">
              <strong>{e.titulo}</strong>
              <span>{e.detalhe}</span>
            </span>
          </li>
        ))}
      </ol>
      {!situacao && !encerrado && (
        <p className="detalhe">
          O exercício vai até 31/03/{exercicio + 1}. Depois, a tesouraria fecha o balanço, a diretoria analisa, o Conselho Fiscal dá o
          parecer e a assembleia aprecia.
        </p>
      )}
      {situacao === 'devolvido' && balanco?.motivo_devolucao && <p className="aviso-texto">O que precisa ser corrigido: {balanco.motivo_devolucao}</p>}

      <div className="nao-imprimir">
        {opera && encerrado && (situacao === null || situacao === 'devolvido') && (
          <form
            aria-label="Fechar o exercício"
            onSubmit={(e) => {
              e.preventDefault()
              void agir(() => fecharBalanco(exercicio, texto), `Exercício ${nome} fechado e enviado à diretoria.`)
            }}
          >
            {aguardando > 0 && (
              <p className="aviso-texto">Há {aguardando} despesa(s) deste exercício aguardando a autorização do presidente. Resolva antes de fechar.</p>
            )}
            <label>
              Nota da tesouraria (opcional)
              <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Explicações sobre as contas do exercício" />
            </label>
            <p className="detalhe">
              Ao fechar, os números ficam congelados e os lançamentos de {nome} não mudam mais — a não ser que a diretoria ou o Conselho
              Fiscal devolvam o balanço para correção.
            </p>
            <div className="acoes">
              <button type="submit" className="botao" disabled={enviando}>
                Fechar o exercício e enviar à diretoria
              </button>
            </div>
          </form>
        )}

        {presidencia &&
          situacao === 'analise_diretoria' &&
          (fecheiEu ? (
            <p className="detalhe">Você fechou este balanço: a análise da diretoria fica com outra pessoa da presidência.</p>
          ) : (
            <>
              <form
                aria-label="Análise da diretoria"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (balanco) void agir(() => analisarBalanco(balanco.id, texto), 'Análise da diretoria registrada. Agora é com o Conselho Fiscal.')
                }}
              >
                <label>
                  Análise da diretoria *
                  <textarea required rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
                </label>
                <div className="acoes">
                  <button type="submit" className="botao" disabled={enviando}>
                    Registrar a análise da diretoria
                  </button>
                </div>
              </form>
              {devolver}
            </>
          ))}

        {/* Fase 5.5, parte 10: o parecer sai dos meses aprovados, no módulo Conselho Fiscal */}
        {situacao === 'aguardando_parecer' && (
          <p className="detalhe">
            {conselho ? 'O parecer do ano é dado no módulo Conselho Fiscal, a partir dos meses aprovados: ' : 'O Conselho Fiscal dá o parecer a partir dos meses aprovados: '}
            <Link to={`/conselho-fiscal/parecer?exercicio=${exercicio}`}>{conselho ? 'dar o parecer do ano' : 'ver o parecer do ano'}</Link>.
          </p>
        )}

        {presidencia && situacao === 'aguardando_assembleia' && (
          <form
            aria-label="Decisão da assembleia"
            onSubmit={(e) => {
              e.preventDefault()
              if (balanco)
                void agir(
                  () => assembleiaBalanco(balanco.id, decisao === 'aprovado', data, ata),
                  decisao === 'aprovado' ? 'Balanço aprovado pela assembleia.' : 'Balanço reprovado: voltou para a tesouraria corrigir.',
                )
            }}
          >
            <div className="grade-form">
              <label>
                Decisão da assembleia *
                <select value={decisao} onChange={(e) => setDecisao(e.target.value as 'aprovado' | 'reprovado')}>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </label>
              <label>
                Data da assembleia *
                <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label className="largura-total">
                Ata *
                <input required value={ata} onChange={(e) => setAta(e.target.value)} placeholder="Ex.: Ata da AGO de 24/04/2027" />
              </label>
            </div>
            <div className="acoes">
              <button type="submit" className="botao" disabled={enviando}>
                Registrar a decisão da assembleia
              </button>
            </div>
          </form>
        )}

        <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
        <Historico eventos={eventos} />
      </div>
    </section>
  )
}

function Historico({ eventos }: { eventos: EventoBalanco[] }) {
  if (eventos.length === 0) return null
  return (
    <details className="acao-recolhida">
      <summary>Histórico do balanço ({eventos.length})</summary>
      <ul className="lista-simples" aria-label="Histórico do balanço">
        {eventos.map((e) => (
          <li key={e.id}>
            <span>
              <strong>{e.acao}</strong> — {formatarDataHora(e.criado_em)}
              {e.pessoa && `, ${e.pessoa.nome}`}
              {e.texto && <span className="detalhe"> · {e.texto}</span>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

const somaDe = (resumo: Resumo, campo: 'saldo_inicial' | 'abertura' | 'entradas' | 'saidas' | 'saldo_final') =>
  resumo.contas.reduce((t, c) => t + Number(c[campo]), 0)

/** Os quatro números (saldo inicial, receitas, despesas, saldo final) e as categorias. */
function NumerosDoExercicio({ resumo, origem, aguardando }: { resumo: Resumo; origem: string; aguardando: { quantidade: number; total: number } | null }) {
  const inicial = somaDe(resumo, 'saldo_inicial') + somaDe(resumo, 'abertura')
  return (
    <section className="fin-numeros-exercicio" aria-label={`Os números de ${nomeDoExercicio(resumo.exercicio)}`}>
      <p className="detalhe">{origem}</p>
      {aguardando && aguardando.quantidade > 0 && (
        <p className="aviso-texto">
          {aguardando.quantidade} despesa(s) aguardando a autorização do presidente ({formatarReais(aguardando.total)}) não entram nos números.
        </p>
      )}
      <ul className="numeros-grandes fin-quatro" aria-label="Saldos e resultado">
        <li className="area-assembleias">
          <span>Saldo inicial</span>
          <strong>{formatarReais(inicial)}</strong>
        </li>
        <li className="area-financas">
          <span>Receitas</span>
          <strong>+ {formatarReais(resumo.total_entradas)}</strong>
        </li>
        <li className="area-pessoas">
          <span>Despesas</span>
          <strong>− {formatarReais(resumo.total_saidas)}</strong>
        </li>
        <li className="area-assembleias">
          <span>{resumo.encerrado ? 'Saldo final' : 'Saldo de hoje'}</span>
          <strong>{formatarReais(somaDe(resumo, 'saldo_final'))}</strong>
        </li>
      </ul>
      <div className="fin-duas">
        <ListaCategorias titulo="Receitas por categoria" linhas={resumo.entradas} area="financas" />
        <ListaCategorias titulo="Despesas por categoria" linhas={resumo.saidas} area="pessoas" />
      </div>
    </section>
  )
}

function ListaCategorias({ titulo, linhas, area }: { titulo: string; linhas: TotalCategoria[]; area: 'financas' | 'pessoas' }) {
  return (
    <section className={`bloco area-${area}`} aria-label={titulo}>
      <h3>{titulo}</h3>
      {linhas.length === 0 ? (
        <p className="vazio">Nenhuma no exercício.</p>
      ) : (
        <ul className="fin-categorias">
          {linhas.map((l) => (
            <li key={l.categoria}>
              <span>{l.categoria}</span>
              <strong>{formatarReais(l.total)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** As planilhas (CSV) do exercício: buscadas na hora do clique. */
function Planilhas({ exercicio, resumo }: { exercicio: number; resumo: Resumo }) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  return (
    <div className="acoes acoes-relatorio nao-imprimir">
      <button
        type="button"
        className="botao botao-secundario"
        disabled={enviando}
        onClick={() =>
          void umaVez(async () => {
            const r = await lancamentosDoExercicio(exercicio)
            if (r.erro !== null) return setErro(r.erro)
            baixarCsv(`lancamentos-${exercicio}-${exercicio + 1}.csv`, linhasLancamentos(r.dados))
          })
        }
      >
        Baixar lançamentos (planilha)
      </button>
      <button
        type="button"
        className="botao botao-secundario"
        disabled={enviando}
        onClick={() =>
          void umaVez(async () => {
            const r = await contribuicoesPorIgreja(exercicio)
            if (r.erro !== null) return setErro(r.erro)
            baixarCsv(`resumo-${exercicio}-${exercicio + 1}.csv`, linhasResumo(resumo, r.dados, new Date().toISOString()))
          })
        }
      >
        Baixar resumo (planilha)
      </button>
      <Mensagem erro={erro} />
    </div>
  )
}

// ---------------------------------------------------------------------
// Mês a mês
// ---------------------------------------------------------------------

/** /financeiro/prestacao/mes-a-mes — as receitas e as despesas de cada mês do exercício. */
export function PrestacaoMesAMes({ colunaExtra }: { colunaExtra?: { titulo: string; valor: (exercicio: number) => Promise<Resultado<Record<string, ReactNode>>> } }) {
  const [exercicio, escolher] = useExercicio()
  return (
    <>
      <BarraDoExercicio exercicio={exercicio} aoEscolher={escolher}>
        <Link to={`/financeiro/prestacao?exercicio=${exercicio}`} className="botao botao-secundario">
          As etapas do balanço
        </Link>
      </BarraDoExercicio>
      <TabelaMesAMes key={exercicio} exercicio={exercicio} colunaExtra={colunaExtra} />
    </>
  )
}

function TabelaMesAMes({
  exercicio,
  colunaExtra,
}: {
  exercicio: number
  colunaExtra?: { titulo: string; valor: (exercicio: number) => Promise<Resultado<Record<string, ReactNode>>> }
}) {
  const [carga, recarregar] = useCarregar(async () => {
    const [lancamentos, extra] = await Promise.all([
      lancamentosDoExercicio(exercicio),
      colunaExtra ? colunaExtra.valor(exercicio) : Promise.resolve(ok<Record<string, ReactNode>>({})),
    ])
    if (lancamentos.erro !== null) return lancamentos
    const valores: Record<string, ReactNode> = extra.erro === null ? extra.dados : {}
    return ok({ lancamentos: lancamentos.dados, extra: valores })
  })
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ lancamentos, extra }) => {
        const meses = mesesComValores(exercicio, lancamentos)
        const total = meses.reduce((t, m) => ({ receitas: t.receitas + m.receitas, despesas: t.despesas + m.despesas }), { receitas: 0, despesas: 0 })
        const maior = Math.max(1, ...meses.map((m) => Math.max(m.receitas, m.despesas)))
        return (
          <div className="tabela-rolagem">
            <table className="tabela-relatorio fin-tabela-meses" aria-label="Receitas e despesas mês a mês">
              <thead>
                <tr>
                  <th scope="col">Mês</th>
                  <th scope="col" className="col-valor">
                    Receitas
                  </th>
                  <th scope="col" className="col-valor">
                    Despesas
                  </th>
                  <th scope="col" className="col-valor">
                    Resultado
                  </th>
                  <th scope="col" className="so-computador" aria-hidden="true" />
                  {colunaExtra && <th scope="col">{colunaExtra.titulo}</th>}
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.nome}>
                    <th scope="row">{m.nome}</th>
                    <td className="col-valor">{formatarReais(m.receitas)}</td>
                    <td className="col-valor">{formatarReais(m.despesas)}</td>
                    <td className={`col-valor ${m.receitas - m.despesas < 0 ? 'valor-saida' : ''}`}>{formatarReais(m.receitas - m.despesas)}</td>
                    <td className="so-computador fin-mini-barras" aria-hidden="true">
                      <span className="fin-mini-entrada" style={{ width: `${Math.round((m.receitas * 100) / maior)}%` }} />
                      <span className="fin-mini-saida" style={{ width: `${Math.round((m.despesas * 100) / maior)}%` }} />
                    </td>
                    {colunaExtra && <td>{extra[m.chave] ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td className="col-valor">{formatarReais(total.receitas)}</td>
                  <td className="col-valor">{formatarReais(total.despesas)}</td>
                  <td className="col-valor">{formatarReais(total.receitas - total.despesas)}</td>
                  <td className="so-computador" />
                  {colunaExtra && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }}
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------
// Balanço e parecer: o documento do exercício, para imprimir
// ---------------------------------------------------------------------

/** /financeiro/prestacao/balanco — o balanço do exercício, com o parecer e a decisão, do jeito que vai para a assembleia. */
export function PrestacaoBalanco() {
  const [exercicio, escolher] = useExercicio()
  return (
    <>
      <BarraDoExercicio exercicio={exercicio} aoEscolher={escolher}>
        <button type="button" className="botao botao-com-icone" onClick={imprimir}>
          <Icone nome="imprimir" tamanho={18} />
          Imprimir ou salvar em PDF
        </button>
      </BarraDoExercicio>
      <DocumentoBalanco key={exercicio} exercicio={exercicio} />
    </>
  )
}

function DocumentoBalanco({ exercicio }: { exercicio: number }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [dados, porIgreja] = await Promise.all([carregarExercicio(exercicio)(), contribuicoesPorIgreja(exercicio)])
    if (dados.erro !== null) return dados
    if (porIgreja.erro !== null) return porIgreja
    return ok({ ...dados.dados, porIgreja: porIgreja.dados })
  })
  const nome = nomeDoExercicio(exercicio)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(d) => {
        const { balanco, eventos } = d.balanco
        const congelado = balanco !== null && balanco.situacao !== 'devolvido'
        const resumo = congelado ? balanco.resumo : d.resumo
        return (
          <article className="fin-documento" aria-label={`Prestação de contas do exercício ${nome}`}>
            <header className="fin-documento-topo">
              <strong>COMEP — Conselho de Ministros Evangélicos de Parauapebas</strong>
              <h2>Prestação de contas do exercício {nome}</h2>
              <span className="detalhe">
                1º de abril de {exercicio} a 31 de março de {exercicio + 1} ·{' '}
                {congelado ? `números congelados em ${formatarDataHora(balanco.fechado_em ?? resumo.calculado_em)}` : `emitido em ${formatarDataHora(d.resumo.calculado_em)} (prévia)`}
              </span>
            </header>
            <PainelResumo resumo={resumo} />
            <PainelPorIgreja linhas={d.porIgreja} posicaoDe={congelado ? d.resumo.calculado_em : null} />
            <section className="fin-documento-secao" aria-labelledby="titulo-aprovacoes">
              <h3 id="titulo-aprovacoes">O caminho das contas</h3>
              {balanco === null ? (
                <p className="vazio">O balanço deste exercício ainda não foi fechado pela tesouraria.</p>
              ) : (
                <dl className="passos-balanco">
                  <dt>Situação</dt>
                  <dd>{NOME_DA_SITUACAO_BALANCO[balanco.situacao]}</dd>
                  {balanco.fechado_em && (
                    <>
                      <dt>1. Fechado pela tesouraria</dt>
                      <dd>
                        {formatarDataHora(balanco.fechado_em)}
                        {balanco.fechado && ` — ${balanco.fechado.nome}`}
                        {balanco.nota_tesouraria && <span className="texto-livre">{balanco.nota_tesouraria}</span>}
                      </dd>
                    </>
                  )}
                  {balanco.analise_diretoria && (
                    <>
                      <dt>2. Análise da diretoria</dt>
                      <dd>
                        {balanco.analisado_em && formatarDataHora(balanco.analisado_em)}
                        {balanco.analisado && ` — ${balanco.analisado.nome}`}
                        <span className="texto-livre">{balanco.analise_diretoria}</span>
                      </dd>
                    </>
                  )}
                  {balanco.parecer && (
                    <>
                      <dt>3. Parecer do Conselho Fiscal: {NOME_DO_PARECER[balanco.parecer]}</dt>
                      <dd>
                        {balanco.parecer_em && formatarDataHora(balanco.parecer_em)}
                        {balanco.parecerista && ` — ${balanco.parecerista.nome}`}
                        <span className="texto-livre">{balanco.parecer_texto}</span>
                      </dd>
                    </>
                  )}
                  {balanco.assembleia_data && (
                    <>
                      <dt>4. Assembleia</dt>
                      <dd>
                        {balanco.aprovado_assembleia ? 'Aprovado' : 'Reprovado'} em {formatarData(balanco.assembleia_data)} — {balanco.assembleia_ata}
                      </dd>
                    </>
                  )}
                  {balanco.situacao === 'devolvido' && balanco.motivo_devolucao && (
                    <>
                      <dt>Devolvido para correção</dt>
                      <dd>{balanco.motivo_devolucao}</dd>
                    </>
                  )}
                </dl>
              )}
              <div className="nao-imprimir">
                <Historico eventos={eventos} />
              </div>
            </section>
            <Planilhas exercicio={exercicio} resumo={resumo} />
          </article>
        )
      }}
    </MostrarCarga>
  )
}

function TabelaCategorias({ titulo, linhas, total }: { titulo: string; linhas: TotalCategoria[]; total: number }) {
  return (
    <div className="tabela-rolagem">
      <table className="tabela-relatorio" aria-label={titulo}>
        <thead>
          <tr>
            <th scope="col">{titulo}</th>
            <th scope="col" className="col-valor">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={2} className="vazio-tabela">
                Nenhuma no exercício.
              </td>
            </tr>
          ) : (
            linhas.map((l) => (
              <tr key={l.categoria}>
                <td>{l.categoria}</td>
                <td className="col-valor">{formatarReais(l.total)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="col-valor">{formatarReais(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function PainelResumo({ resumo }: { resumo: Resumo }) {
  const temAbertura = resumo.contas.some((c) => Number(c.abertura) > 0)
  const resultado = Number(resumo.total_entradas) - Number(resumo.total_saidas)
  const c = resumo.contribuicoes
  return (
    <section className="fin-documento-secao" aria-labelledby="titulo-resumo">
      <h3 id="titulo-resumo">Saldos das contas</h3>
      <div className="tabela-rolagem">
        <table className="tabela-relatorio" aria-label="Saldos das contas">
          <thead>
            <tr>
              <th scope="col">Conta</th>
              <th scope="col" className="col-valor">
                Saldo em 01/04/{resumo.exercicio}
              </th>
              {temAbertura && (
                <th scope="col" className="col-valor">
                  Abertura
                </th>
              )}
              <th scope="col" className="col-valor">
                Entradas
              </th>
              <th scope="col" className="col-valor">
                Saídas
              </th>
              <th scope="col" className="col-valor">
                {resumo.encerrado ? `Saldo em 31/03/${resumo.exercicio + 1}` : 'Saldo atual'}
              </th>
            </tr>
          </thead>
          <tbody>
            {resumo.contas.map((conta) => (
              <tr key={conta.nome}>
                <th scope="row">{conta.nome}</th>
                <td className="col-valor">{formatarReais(conta.saldo_inicial)}</td>
                {temAbertura && <td className="col-valor">{formatarReais(conta.abertura)}</td>}
                <td className="col-valor">{formatarReais(conta.entradas)}</td>
                <td className="col-valor">{formatarReais(conta.saidas)}</td>
                <td className="col-valor">{formatarReais(conta.saldo_final)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="col-valor">{formatarReais(somaDe(resumo, 'saldo_inicial'))}</td>
              {temAbertura && <td className="col-valor">{formatarReais(somaDe(resumo, 'abertura'))}</td>}
              <td className="col-valor">{formatarReais(somaDe(resumo, 'entradas'))}</td>
              <td className="col-valor">{formatarReais(somaDe(resumo, 'saidas'))}</td>
              <td className="col-valor">{formatarReais(somaDe(resumo, 'saldo_final'))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grade-relatorio">
        <TabelaCategorias titulo="Receitas" linhas={resumo.entradas} total={resumo.total_entradas} />
        <TabelaCategorias titulo="Despesas" linhas={resumo.saidas} total={resumo.total_saidas} />
      </div>
      <p className="resultado-exercicio">
        Resultado do exercício (receitas − despesas):{' '}
        <strong className={resultado >= 0 ? 'valor-entrada' : 'valor-saida'}>{formatarReais(resultado)}</strong>
      </p>
      {Number(resumo.transferencias) > 0 && (
        <p className="detalhe">Transferências entre contas no exercício: {formatarReais(resumo.transferencias)} (não são receita nem despesa).</p>
      )}

      <h3>Contribuições dos associados</h3>
      <dl className="numeros-contribuicao" aria-label="Contribuições do exercício">
        <div>
          <dt>Previsto</dt>
          <dd>{formatarReais(c.previsto)}</dd>
        </div>
        <div>
          <dt>Recebido</dt>
          <dd>{formatarReais(c.recebido)}</dd>
        </div>
        <div>
          <dt>Em aberto</dt>
          <dd>{formatarReais(c.em_aberto)}</dd>
        </div>
        <div>
          <dt>Vencido</dt>
          <dd>{formatarReais(c.vencido)}</dd>
        </div>
      </dl>
    </section>
  )
}

function PainelPorIgreja({ linhas, posicaoDe }: { linhas: ContribuicaoIgreja[]; posicaoDe: string | null }) {
  return (
    <section className="fin-documento-secao" aria-labelledby="titulo-por-igreja">
      <h3 id="titulo-por-igreja">Contribuições por igreja</h3>
      {posicaoDe && (
        <p className="detalhe">
          Posição de {formatarDataHora(posicaoDe)} — não fica congelada com o balanço: inclui pagamentos atrasados recebidos depois do fechamento.
        </p>
      )}
      {linhas.length === 0 ? (
        <p className="vazio">Nenhuma contribuição gerada para este exercício.</p>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela-relatorio" aria-label="Contribuições por igreja">
            <thead>
              <tr>
                <th scope="col">Igreja</th>
                <th scope="col" className="col-valor">
                  Associados
                </th>
                <th scope="col" className="col-valor">
                  Previsto
                </th>
                <th scope="col" className="col-valor">
                  Recebido
                </th>
                <th scope="col" className="col-valor">
                  Em aberto
                </th>
                <th scope="col" className="col-valor">
                  Vencido
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.igreja}>
                  <th scope="row">{l.igreja}</th>
                  <td className="col-valor">{l.associados}</td>
                  <td className="col-valor">{formatarReais(l.previsto)}</td>
                  <td className="col-valor">{formatarReais(l.recebido)}</td>
                  <td className="col-valor">{formatarReais(l.em_aberto)}</td>
                  <td className={`col-valor ${Number(l.vencido) > 0 ? 'valor-saida' : ''}`}>{formatarReais(l.vencido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// Planilhas (CSV)
// ---------------------------------------------------------------------

function linhasLancamentos(lancamentos: LancamentoRelatorio[]) {
  return [
    ['Data', 'Conta', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Situação', 'Autorizada por', 'Motivo'],
    ...lancamentos.map((l) => [
      formatarData(l.data),
      l.conta?.nome,
      l.tipo === 'entrada' ? 'Entrada' : 'Saída',
      l.categoria?.nome,
      l.descricao,
      numeroPlanilha(l.valor),
      NOME_DA_SITUACAO_LANCAMENTO[l.situacao],
      l.autorizado?.nome,
      l.motivo,
    ]),
  ]
}

function linhasResumo(resumo: Resumo, porIgreja: ContribuicaoIgreja[], posicaoDe: string) {
  const nome = nomeDoExercicio(resumo.exercicio)
  const c = resumo.contribuicoes
  return [
    [`COMEP — Prestação de contas do exercício ${nome}`],
    [],
    ['Conta', 'Saldo inicial', 'Abertura', 'Entradas', 'Saídas', 'Saldo final'],
    ...resumo.contas.map((x) => [
      x.nome,
      numeroPlanilha(x.saldo_inicial),
      numeroPlanilha(x.abertura),
      numeroPlanilha(x.entradas),
      numeroPlanilha(x.saidas),
      numeroPlanilha(x.saldo_final),
    ]),
    [],
    ['Receitas por categoria', 'Total'],
    ...resumo.entradas.map((x) => [x.categoria, numeroPlanilha(x.total)]),
    ['Total de receitas', numeroPlanilha(resumo.total_entradas)],
    [],
    ['Despesas por categoria', 'Total'],
    ...resumo.saidas.map((x) => [x.categoria, numeroPlanilha(x.total)]),
    ['Total de despesas', numeroPlanilha(resumo.total_saidas)],
    [],
    ['Resultado do exercício', numeroPlanilha(Number(resumo.total_entradas) - Number(resumo.total_saidas))],
    ['Transferências entre contas', numeroPlanilha(resumo.transferencias)],
    [],
    ['Contribuições', 'Previsto', 'Recebido', 'Em aberto', 'Vencido'],
    ['Associados', numeroPlanilha(c.previsto), numeroPlanilha(c.recebido), numeroPlanilha(c.em_aberto), numeroPlanilha(c.vencido)],
    [],
    [`Contribuições por igreja — posição de ${formatarDataHora(posicaoDe)}`],
    ['Igreja', 'Associados', 'Previsto', 'Recebido', 'Em aberto', 'Vencido'],
    ...porIgreja.map((x) => [
      x.igreja,
      x.associados,
      numeroPlanilha(x.previsto),
      numeroPlanilha(x.recebido),
      numeroPlanilha(x.em_aberto),
      numeroPlanilha(x.vencido),
    ]),
  ]
}
