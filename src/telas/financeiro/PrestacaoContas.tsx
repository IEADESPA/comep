import { useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarCategoriasFinanceiras, NOME_DA_SITUACAO_LANCAMENTO, type CategoriaFinanceira } from '../../dados/caixa'
import { ok, type Resultado } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import { exercicioDe, nomeDoExercicio } from '../../dados/financeiro'
import type { Perfil } from '../../dados/perfis'
import {
  analisarBalanco,
  aprovarOrcamento,
  assembleiaBalanco,
  buscarBalanco,
  buscarOrcamento,
  contribuicoesPorIgreja,
  devolverBalanco,
  exerciciosComBalanco,
  fecharBalanco,
  lancamentosDoExercicio,
  NOME_DA_SITUACAO_BALANCO,
  NOME_DO_PARECER,
  parecerBalanco,
  resumoExercicio,
  salvarOrcamento,
  type Balanco,
  type ContribuicaoIgreja,
  type EventoBalanco,
  type LancamentoRelatorio,
  type Orcamento,
  type Resumo,
  type TipoParecer,
  type TotalCategoria,
} from '../../dados/prestacao'
import { useCarregar } from '../../estado/useCarregar'
import { baixarCsv, imprimir, numeroPlanilha } from '../../utilitarios/exportar'
import { formatarData, formatarDataHora, hojeIso } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }

/** O estatuto do COMEP é de 25/05/2021: o primeiro exercício possível é 2021/2022. */
const PRIMEIRO_EXERCICIO = 2021
const MESES = ['abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'janeiro', 'fevereiro', 'março']

const ehTransferencia = (sistema: string | null | undefined) => (sistema ?? '').startsWith('transferencia')

/** Aba "Prestação de contas": escolhe o exercício e mostra balanço, resumo, mês a mês, igrejas e orçamento. */
export function PrestacaoContasAba({ perfis, pessoaId }: { perfis: Perfil[]; pessoaId: string }) {
  const atual = exercicioDe(hojeIso())
  const [exercicio, setExercicio] = useState(atual)
  const [carga] = useCarregar(exerciciosComBalanco)
  const situacoes = new Map((carga.situacao === 'ok' ? carga.dados : []).map((b) => [b.exercicio, b.situacao]))
  const anos = [
    ...new Set([...Array.from({ length: Math.max(atual - PRIMEIRO_EXERCICIO + 1, 1) }, (_, i) => atual - i), ...situacoes.keys()]),
  ].sort((a, b) => b - a)

  return (
    <>
      <div className="cabecalho-painel nao-imprimir">
        <label className="campo-medio">
          Exercício
          <select value={exercicio} onChange={(e) => setExercicio(Number(e.target.value))}>
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
      </div>
      <ConteudoExercicio key={exercicio} exercicio={exercicio} perfis={perfis} pessoaId={pessoaId} />
    </>
  )
}

type Dados = {
  resumo: Resumo
  balanco: { balanco: Balanco | null; eventos: EventoBalanco[] }
  orcamento: Orcamento | null
  porIgreja: ContribuicaoIgreja[]
  lancamentos: LancamentoRelatorio[]
  categorias: CategoriaFinanceira[]
}

function ConteudoExercicio({ exercicio, perfis, pessoaId }: { exercicio: number; perfis: Perfil[]; pessoaId: string }) {
  const [carga, recarregar] = useCarregar(async (): Promise<Resultado<Dados>> => {
    const [resumo, balanco, orcamento, porIgreja, lancamentos, categorias] = await Promise.all([
      resumoExercicio(exercicio),
      buscarBalanco(exercicio),
      buscarOrcamento(exercicio),
      contribuicoesPorIgreja(exercicio),
      lancamentosDoExercicio(exercicio),
      listarCategoriasFinanceiras(),
    ])
    if (resumo.erro !== null) return resumo
    if (balanco.erro !== null) return balanco
    if (orcamento.erro !== null) return orcamento
    if (porIgreja.erro !== null) return porIgreja
    if (lancamentos.erro !== null) return lancamentos
    if (categorias.erro !== null) return categorias
    return ok({
      resumo: resumo.dados,
      balanco: balanco.dados,
      orcamento: orcamento.dados,
      porIgreja: porIgreja.dados,
      lancamentos: lancamentos.dados,
      categorias: categorias.dados,
    })
  })
  const nome = nomeDoExercicio(exercicio)

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(d) => {
        const { balanco, eventos } = d.balanco
        const congelado = balanco !== null && balanco.situacao !== 'devolvido'
        const resumo = congelado ? balanco.resumo : d.resumo
        return (
          <>
            <div className="acoes acoes-relatorio nao-imprimir">
              <button type="button" className="botao botao-secundario" onClick={imprimir}>
                Imprimir ou salvar em PDF
              </button>
              <button
                type="button"
                className="botao botao-secundario"
                onClick={() => baixarCsv(`lancamentos-${exercicio}-${exercicio + 1}.csv`, linhasLancamentos(d.lancamentos))}
              >
                Baixar lançamentos (planilha)
              </button>
              <button
                type="button"
                className="botao botao-secundario"
                onClick={() => baixarCsv(`resumo-${exercicio}-${exercicio + 1}.csv`, linhasResumo(resumo, d.porIgreja))}
              >
                Baixar resumo (planilha)
              </button>
            </div>
            <p className="somente-impressao titulo-impressao">
              COMEP — Prestação de contas do exercício {nome} (abril a março) · emitido em {formatarDataHora(d.resumo.calculado_em)}
            </p>

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
            <PainelResumo
              resumo={resumo}
              origem={congelado ? `Números congelados quando a tesouraria fechou o exercício (${formatarDataHora(balanco.fechado_em ?? resumo.calculado_em)}).` : undefined}
            />
            <PainelMesAMes exercicio={exercicio} lancamentos={d.lancamentos} />
            <PainelPorIgreja linhas={d.porIgreja} />
            <PainelOrcamento
              exercicio={exercicio}
              orcamento={d.orcamento}
              categorias={d.categorias}
              realizado={d.resumo}
              perfis={perfis}
              recarregar={recarregar}
            />
          </>
        )
      }}
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------
// Balanço anual: fechar → análise da diretoria → parecer do Conselho Fiscal → assembleia
// ---------------------------------------------------------------------

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
  const [retorno, setRetorno] = useState<Retorno>({})
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [parecer, setParecer] = useState<TipoParecer>('favoravel')
  const [decisao, setDecisao] = useState<'aprovado' | 'reprovado'>('aprovado')
  const [data, setData] = useState(hojeIso())
  const [ata, setAta] = useState('')
  const [enviando, setEnviando] = useState(false)

  const situacao = balanco?.situacao ?? null
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const presidencia = perfis.includes('presidencia')
  const conselho = perfis.includes('conselho_fiscal')
  const fecheiEu = balanco?.fechado?.id === pessoaId
  const nome = nomeDoExercicio(exercicio)

  async function agir(promessa: Promise<Resultado<null>>, sucesso: string) {
    setEnviando(true)
    const r = await promessa
    setEnviando(false)
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) {
      setTexto('')
      setMotivo('')
      setAta('')
      recarregar()
    }
  }

  const devolver = (
    <details className="acao-recolhida">
      <summary>Devolver à tesouraria para correção</summary>
      <form
        className="form-compacto"
        onSubmit={(e) => {
          e.preventDefault()
          if (balanco) void agir(devolverBalanco(balanco.id, motivo), 'Balanço devolvido à tesouraria.')
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
    <section className="painel" aria-labelledby="titulo-balanco" data-situacao={situacao ?? 'sem_balanco'}>
      <h2 id="titulo-balanco">Balanço do exercício {nome}</h2>
      <p className="situacao-balanco">
        <strong>
          {situacao ? NOME_DA_SITUACAO_BALANCO[situacao] : encerrado ? 'Ainda não fechado pela tesouraria' : 'Exercício em andamento'}
        </strong>
      </p>
      {!situacao && !encerrado && (
        <p className="detalhe">
          O exercício vai até 31/03/{exercicio + 1}. Até lá, os números abaixo são uma prévia. Depois, a tesouraria fecha o
          balanço, a diretoria analisa, o Conselho Fiscal dá o parecer e a assembleia aprecia (Art. 12, §6º, III; Art. 14; Art.
          15, I).
        </p>
      )}
      {situacao === 'devolvido' && balanco?.motivo_devolucao && (
        <p className="aviso-texto">O que precisa ser corrigido: {balanco.motivo_devolucao}</p>
      )}

      {balanco && situacao !== 'devolvido' && (
        <dl className="passos-balanco">
          <dt>1. Fechado pela tesouraria</dt>
          <dd>
            {balanco.fechado_em && formatarDataHora(balanco.fechado_em)}
            {balanco.fechado && ` — ${balanco.fechado.nome}`}
            {balanco.nota_tesouraria && <span className="texto-livre">{balanco.nota_tesouraria}</span>}
          </dd>
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
                {balanco.aprovado_assembleia ? 'Aprovado' : 'Reprovado'} em {formatarData(balanco.assembleia_data)} —{' '}
                {balanco.assembleia_ata}
              </dd>
            </>
          )}
        </dl>
      )}

      <div className="nao-imprimir">
        {opera && encerrado && (situacao === null || situacao === 'devolvido') && (
          <form
            aria-label="Fechar o exercício"
            onSubmit={(e) => {
              e.preventDefault()
              void agir(fecharBalanco(exercicio, texto), `Exercício ${nome} fechado e enviado à diretoria.`)
            }}
          >
            {aguardando > 0 && (
              <p className="aviso-texto">
                Há {aguardando} despesa(s) deste exercício aguardando a autorização do presidente. Resolva antes de fechar.
              </p>
            )}
            <label>
              Nota da tesouraria (opcional)
              <textarea
                rows={3}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Explicações sobre as contas do exercício"
              />
            </label>
            <p className="detalhe">
              Ao fechar, os números ficam congelados e os lançamentos de {nome} não mudam mais — a não ser que a diretoria ou o
              Conselho Fiscal devolvam o balanço para correção.
            </p>
            <div className="acoes">
              <button type="submit" className="botao" disabled={enviando}>
                Fechar o exercício e enviar à diretoria
              </button>
            </div>
          </form>
        )}

        {presidencia && situacao === 'analise_diretoria' &&
          (fecheiEu ? (
            <p className="detalhe">Você fechou este balanço: a análise da diretoria fica com outra pessoa da presidência.</p>
          ) : (
            <>
              <form
                aria-label="Análise da diretoria"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (balanco) void agir(analisarBalanco(balanco.id, texto), 'Análise da diretoria registrada. Agora é com o Conselho Fiscal.')
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

        {conselho && situacao === 'aguardando_parecer' &&
          (fecheiEu ? (
            <p className="detalhe">Você fechou este balanço: o parecer fica com os outros membros do Conselho Fiscal.</p>
          ) : (
            <>
              <form
                aria-label="Parecer do Conselho Fiscal"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (balanco) void agir(parecerBalanco(balanco.id, parecer, texto), 'Parecer do Conselho Fiscal registrado.')
                }}
              >
                <label>
                  Parecer *
                  <select value={parecer} onChange={(e) => setParecer(e.target.value as TipoParecer)}>
                    {(Object.keys(NOME_DO_PARECER) as TipoParecer[]).map((p) => (
                      <option key={p} value={p}>
                        {NOME_DO_PARECER[p]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Texto do parecer *
                  <textarea required rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
                </label>
                <div className="acoes">
                  <button type="submit" className="botao" disabled={enviando}>
                    Registrar o parecer
                  </button>
                </div>
              </form>
              {devolver}
            </>
          ))}

        {presidencia && situacao === 'aguardando_assembleia' && (
          <form
            aria-label="Decisão da assembleia"
            onSubmit={(e) => {
              e.preventDefault()
              if (balanco)
                void agir(
                  assembleiaBalanco(balanco.id, decisao === 'aprovado', data, ata),
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

        {eventos.length > 0 && (
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
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------
// Resumo do exercício
// ---------------------------------------------------------------------

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

function PainelResumo({ resumo, origem }: { resumo: Resumo; origem?: string }) {
  const nome = nomeDoExercicio(resumo.exercicio)
  const temAbertura = resumo.contas.some((c) => Number(c.abertura) > 0)
  const soma = (campo: 'saldo_inicial' | 'abertura' | 'entradas' | 'saidas' | 'saldo_final') =>
    resumo.contas.reduce((t, c) => t + Number(c[campo]), 0)
  const resultado = Number(resumo.total_entradas) - Number(resumo.total_saidas)
  const c = resumo.contribuicoes

  return (
    <section className="painel" aria-labelledby="titulo-resumo">
      <h2 id="titulo-resumo">Resumo do exercício {nome}</h2>
      <p className="detalhe">
        {origem ??
          (resumo.encerrado
            ? 'Números de agora: o exercício terminou, mas o balanço ainda não foi fechado.'
            : `Prévia: o exercício vai até 31/03/${resumo.exercicio + 1}.`)}
      </p>
      {!origem && resumo.despesas_aguardando.quantidade > 0 && (
        <p className="aviso-texto">
          {resumo.despesas_aguardando.quantidade} despesa(s) aguardando a autorização do presidente (
          {formatarReais(resumo.despesas_aguardando.total)}) não entram nos números.
        </p>
      )}

      <h3>Saldos das contas</h3>
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
              <td className="col-valor">{formatarReais(soma('saldo_inicial'))}</td>
              {temAbertura && <td className="col-valor">{formatarReais(soma('abertura'))}</td>}
              <td className="col-valor">{formatarReais(soma('entradas'))}</td>
              <td className="col-valor">{formatarReais(soma('saidas'))}</td>
              <td className="col-valor">{formatarReais(soma('saldo_final'))}</td>
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
        <p className="detalhe">
          Transferências entre contas no exercício: {formatarReais(resumo.transferencias)} (não são receita nem despesa).
        </p>
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

// ---------------------------------------------------------------------
// Mês a mês e por igreja
// ---------------------------------------------------------------------

function PainelMesAMes({ exercicio, lancamentos }: { exercicio: number; lancamentos: LancamentoRelatorio[] }) {
  const meses = MESES.map((nomeMes, i) => {
    const mes = ((i + 3) % 12) + 1
    const ano = mes >= 4 ? exercicio : exercicio + 1
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`
    const doMes = lancamentos.filter(
      (l) => l.situacao === 'efetivado' && l.data.startsWith(prefixo) && !ehTransferencia(l.categoria?.sistema),
    )
    const receitas = doMes.filter((l) => l.tipo === 'entrada').reduce((t, l) => t + Number(l.valor), 0)
    const despesas = doMes.filter((l) => l.tipo === 'saida').reduce((t, l) => t + Number(l.valor), 0)
    return { nome: `${nomeMes}/${ano}`, receitas, despesas }
  })
  const total = meses.reduce((t, m) => ({ receitas: t.receitas + m.receitas, despesas: t.despesas + m.despesas }), {
    receitas: 0,
    despesas: 0,
  })

  return (
    <section className="painel" aria-labelledby="titulo-mes-a-mes">
      <h2 id="titulo-mes-a-mes">Mês a mês</h2>
      <div className="tabela-rolagem">
        <table className="tabela-relatorio" aria-label="Receitas e despesas mês a mês">
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
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.nome}>
                <th scope="row">{m.nome}</th>
                <td className="col-valor">{formatarReais(m.receitas)}</td>
                <td className="col-valor">{formatarReais(m.despesas)}</td>
                <td className={`col-valor ${m.receitas - m.despesas < 0 ? 'valor-saida' : ''}`}>
                  {formatarReais(m.receitas - m.despesas)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="col-valor">{formatarReais(total.receitas)}</td>
              <td className="col-valor">{formatarReais(total.despesas)}</td>
              <td className="col-valor">{formatarReais(total.receitas - total.despesas)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function PainelPorIgreja({ linhas }: { linhas: ContribuicaoIgreja[] }) {
  return (
    <section className="painel" aria-labelledby="titulo-por-igreja">
      <h2 id="titulo-por-igreja">Contribuições por igreja</h2>
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
// Orçamento e plano anual de trabalho (Art. 15, I)
// ---------------------------------------------------------------------

function PainelOrcamento({
  exercicio,
  orcamento,
  categorias,
  realizado,
  perfis,
  recarregar,
}: {
  exercicio: number
  orcamento: Orcamento | null
  categorias: CategoriaFinanceira[]
  realizado: Resumo
  perfis: Perfil[]
  recarregar: () => void
}) {
  const nome = nomeDoExercicio(exercicio)
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const presidencia = perfis.includes('presidencia')
  const aprovado = Boolean(orcamento?.aprovado_em_assembleia)
  const doOrcamento = categorias.filter((c) => !ehTransferencia(c.sistema))
  const previstoDe = (id: string) => Number(orcamento?.itens.find((i) => i.categoria_id === id)?.valor ?? 0)
  const realizadoDe = (c: CategoriaFinanceira) =>
    Number((c.tipo === 'entrada' ? realizado.entradas : realizado.saidas).find((x) => x.categoria === c.nome)?.total ?? 0)

  const [plano, setPlano] = useState(orcamento?.plano_trabalho ?? '')
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(doOrcamento.map((c) => [c.id, previstoDe(c.id) ? String(previstoDe(c.id)).replace('.', ',') : ''])),
  )
  const [data, setData] = useState(hojeIso())
  const [ata, setAta] = useState('')
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, setEnviando] = useState(false)

  async function agir(promessa: Promise<Resultado<null>>, sucesso: string) {
    setEnviando(true)
    const r = await promessa
    setEnviando(false)
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  const linhas = (tipo: 'entrada' | 'saida') =>
    doOrcamento
      .filter((c) => c.tipo === tipo)
      .map((c) => ({ c, previsto: previstoDe(c.id), real: realizadoDe(c) }))
      .filter((l) => l.previsto > 0 || l.real > 0)

  return (
    <section className="painel" aria-labelledby="titulo-orcamento">
      <h2 id="titulo-orcamento">Orçamento e plano de trabalho {nome}</h2>
      <p className="situacao-balanco">
        <strong>
          {aprovado
            ? `Aprovado na assembleia de ${formatarData(orcamento?.aprovado_em_assembleia)} (${orcamento?.ata})`
            : orcamento
              ? 'Em preparo — ainda não aprovado em assembleia'
              : 'Ainda não há orçamento para este exercício'}
        </strong>
      </p>
      {orcamento?.plano_trabalho && (
        <>
          <h3>Plano anual de trabalho</h3>
          <p className="texto-livre">{orcamento.plano_trabalho}</p>
        </>
      )}
      {orcamento && (
        <div className="grade-relatorio">
          {(['entrada', 'saida'] as const).map((tipo) => (
            <div className="tabela-rolagem" key={tipo}>
              <table className="tabela-relatorio" aria-label={tipo === 'entrada' ? 'Receitas: previsto e realizado' : 'Despesas: previsto e realizado'}>
                <thead>
                  <tr>
                    <th scope="col">{tipo === 'entrada' ? 'Receitas' : 'Despesas'}</th>
                    <th scope="col" className="col-valor">
                      Previsto
                    </th>
                    <th scope="col" className="col-valor">
                      Realizado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas(tipo).map(({ c, previsto, real }) => (
                    <tr key={c.id}>
                      <th scope="row">{c.nome}</th>
                      <td className="col-valor">{formatarReais(previsto)}</td>
                      <td className="col-valor">{formatarReais(real)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div className="nao-imprimir">
        {opera && !aprovado && (
          <details className="acao-recolhida">
            <summary>{orcamento ? 'Editar o orçamento' : 'Preparar o orçamento'}</summary>
            <form
              aria-label="Orçamento"
              onSubmit={(e) => {
                e.preventDefault()
                const itens = doOrcamento.map((c) => ({
                  categoria_id: c.id,
                  valor: Number((valores[c.id] || '0').replace(/\./g, '').replace(',', '.')) || 0,
                }))
                void agir(salvarOrcamento(exercicio, plano, itens), `Orçamento ${nome} salvo.`)
              }}
            >
              <label>
                Plano anual de trabalho
                <textarea
                  rows={5}
                  value={plano}
                  onChange={(e) => setPlano(e.target.value)}
                  placeholder="Atividades, encontros e projetos previstos para o exercício"
                />
              </label>
              {(['entrada', 'saida'] as const).map((tipo) => (
                <fieldset key={tipo} className="grade-form">
                  <legend>{tipo === 'entrada' ? 'Receitas previstas (R$)' : 'Despesas previstas (R$)'}</legend>
                  {doOrcamento
                    .filter((c) => c.tipo === tipo)
                    .map((c) => (
                      <label key={c.id}>
                        {c.nome}
                        <input
                          inputMode="decimal"
                          pattern="[0-9.]*([,][0-9]{1,2})?"
                          placeholder="0,00"
                          aria-label={`Previsto para ${c.nome}`}
                          value={valores[c.id] ?? ''}
                          onChange={(e) => setValores({ ...valores, [c.id]: e.target.value })}
                        />
                      </label>
                    ))}
                </fieldset>
              ))}
              <div className="acoes">
                <button type="submit" className="botao" disabled={enviando}>
                  Salvar o orçamento
                </button>
              </div>
            </form>
          </details>
        )}
        {presidencia && orcamento && !aprovado && (
          <details className="acao-recolhida">
            <summary>Registrar a aprovação da assembleia</summary>
            <form
              className="form-linha"
              aria-label="Aprovação do orçamento"
              onSubmit={(e) => {
                e.preventDefault()
                void agir(aprovarOrcamento(exercicio, data, ata), `Orçamento ${nome} aprovado.`)
              }}
            >
              <label className="campo-curto">
                Data da assembleia *
                <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                Ata *
                <input required value={ata} onChange={(e) => setAta(e.target.value)} />
              </label>
              <button type="submit" className="botao" disabled={enviando}>
                Registrar a aprovação
              </button>
            </form>
          </details>
        )}
        <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      </div>
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

function linhasResumo(resumo: Resumo, porIgreja: ContribuicaoIgreja[]) {
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
