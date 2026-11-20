import { useState } from 'react'
import { Link } from 'react-router'
import { MostrarCarga } from '../../componentes/Basicos'
import { Chip } from '../../componentes/Telas'
import { ok } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import {
  cancelarCobranca,
  cobrancasEmAbertoDe,
  exercicioDe,
  FORMAS_PAGAMENTO,
  gerarCobrancas,
  informesPendentes,
  nomeDaCobranca,
  nomeDoExercicio,
  numerosDoFinanceiro,
  planosDoExercicio,
  registrarPagamento,
  resumoDoExercicio,
  situacaoDeTodos,
  type SituacaoContribuicao,
} from '../../dados/financeiro'
import { lembrarContribuicoesEmAtraso } from '../../dados/notificacoes'
import { contribuicoesPorIgreja } from '../../dados/prestacao'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { contemTexto, hojeIso, iniciaisDe } from '../../utilitarios/formatos'
import { TaxaInscricao, Valores, Vencimentos } from './ConfigFinanceiro'
import { Medidor } from './comum'
import { plural, porcento, useExercicio, type Concluir } from './util'

// Financeiro › Contribuições (rodada 11, opção 3: o painel e quem precisa de atenção), com as subfunções
// Por igreja, Cobranças do ano e Valores e planos.

const SEM_IGREJA = 'Sem igreja informada'

type Pessoa = SituacaoContribuicao & { paraConferir: boolean }

/** /financeiro/contribuicoes — o painel: os números do ano, quem precisa de atenção, por igreja e todos os ministros. */
export function PainelContribuicoes({
  pessoaId,
  opera,
  concluir,
}: {
  pessoaId: string
  opera: boolean
  concluir: Concluir
}) {
  const [carga, recarregar] = useCarregar(async () => {
    const [todos, informes, numeros] = await Promise.all([situacaoDeTodos(), opera ? informesPendentes() : ok([]), numerosDoFinanceiro()])
    if (todos.erro !== null) return todos
    if (informes.erro !== null) return informes
    if (numeros.erro !== null) return numeros
    const conferir = new Set(informes.dados.map((i) => i.pessoa_id))
    const pessoas: Pessoa[] = todos.dados.map((s) => ({ ...s, paraConferir: conferir.has(s.pessoa_id) }))
    return ok({ pessoas, numeros: numeros.dados, paraConferir: informes.dados.length })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ pessoas, numeros, paraConferir }) => {
        const pagantes = pessoas.filter((p) => !p.jubilado)
        const isentos = pessoas.length - pagantes.length
        const emDia = pagantes.filter((p) => p.em_dia).length
        const emAtraso = pessoas.filter((p) => !p.em_dia)
        const atencao = [...pessoas.filter((p) => p.paraConferir), ...emAtraso.filter((p) => !p.paraConferir)]
        const c = numeros.contribuicoes
        return (
          <>
            <div className="fin-medidores">
              <Medidor
                rotulo="Em dia"
                valor={`${emDia} de ${pagantes.length}`}
                pct={porcento(emDia, pagantes.length)}
                area="financas"
                sub={`${porcento(emDia, pagantes.length)}% de quem paga${isentos > 0 ? ` (${plural(isentos, 'isento', 'isentos')} fora)` : ''}`}
              />
              <Medidor
                rotulo={`Recebido em ${nomeDoExercicio(numeros.exercicio)}`}
                valor={formatarReais(c.recebido)}
                pct={porcento(Number(c.recebido), Number(c.previsto))}
                area="financas"
                sub={`de ${formatarReais(c.previsto)} previstos`}
              />
              <Medidor
                rotulo="Em aberto"
                valor={formatarReais(c.em_aberto)}
                pct={porcento(Number(c.em_aberto), Number(c.previsto))}
                area="pessoas"
                sub={`${emAtraso.length} em atraso${opera ? ` e ${paraConferir} para conferir` : ''}`}
              />
            </div>

            <div className="fin-duas">
              <section className="bloco" aria-labelledby="titulo-atencao-contribuicoes">
                <div className="titulo-com-acao">
                  <h2 id="titulo-atencao-contribuicoes">Precisam de atenção</h2>
                  {opera && emAtraso.length > 0 && <LembrarTodos concluir={concluir} />}
                </div>
                {atencao.length === 0 ? (
                  <p className="vazio">Ninguém em atraso e nenhum comprovante para conferir.</p>
                ) : (
                  <ListaAtencao pessoas={atencao} opera={opera} pessoaId={pessoaId} concluir={concluirERecarregar} />
                )}
              </section>
              <PorIgrejaResumo pessoas={pagantes} />
            </div>

            <TodosOsMinistros pessoas={pessoas} opera={opera} pessoaId={pessoaId} concluir={concluirERecarregar} />
          </>
        )
      }}
    </MostrarCarga>
  )
}

const MOSTRAR = 8

/**
 * "Lembrar todos" (rodada 11; ficou para a parte 11, com a tabela das notificações): o lembrete vai para o sino de
 * quem está em atraso e ainda não mandou o comprovante (e para o celular, se a pessoa ativou). Uma vez por dia.
 */
function LembrarTodos({ concluir }: { concluir: Concluir }) {
  const [enviando, setEnviando] = useState(false)
  async function lembrar() {
    setEnviando(true)
    const r = await lembrarContribuicoesEmAtraso()
    setEnviando(false)
    if (r.erro !== null) concluir(r, '')
    else
      concluir(
        r,
        r.dados === 0
          ? 'Ninguém para lembrar agora: quem está em atraso já recebeu o lembrete hoje ou já mandou o comprovante.'
          : `Lembrete mandado para ${plural(r.dados, 'ministro', 'ministros')}: aparece no sino e, para quem ativou, no celular.`,
      )
  }
  return (
    <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => void lembrar()}>
      {enviando ? 'Mandando…' : 'Lembrar todos'}
    </button>
  )
}

function ListaAtencao({ pessoas, opera, pessoaId, concluir }: { pessoas: Pessoa[]; opera: boolean; pessoaId: string; concluir: Concluir }) {
  const [todas, setTodas] = useState(false)
  const visiveis = todas ? pessoas : pessoas.slice(0, MOSTRAR)
  return (
    <>
      <ul className="lista-linhas" aria-label="Precisam de atenção">
        {visiveis.map((p) => (
          <LinhaPessoa key={p.pessoa_id} p={p} opera={opera} minha={p.pessoa_id === pessoaId} concluir={concluir} />
        ))}
      </ul>
      {pessoas.length > MOSTRAR && (
        <button type="button" className="botao-texto alinhar-esquerda" onClick={() => setTodas((t) => !t)}>
          {todas ? 'Mostrar menos' : `Mostrar todos (${pessoas.length})`}
        </button>
      )}
    </>
  )
}

function SituacaoChip({ p }: { p: Pessoa }) {
  if (p.paraConferir) return <Chip area="eventos">Comprovante para conferir</Chip>
  if (!p.em_dia) return <Chip area="pessoas">Em atraso: {plural(p.cobrancas_vencidas, 'vencida', 'vencidas')}, {formatarReais(p.valor_vencido)}</Chip>
  if (p.jubilado) return <Chip area="assembleias">Isento (jubilado)</Chip>
  return <Chip area="financas">Em dia</Chip>
}

/** Uma pessoa na lista: o nome, a igreja, a situação e a ação (conferir o comprovante ou registrar o pagamento). */
function LinhaPessoa({ p, opera, minha, concluir }: { p: Pessoa; opera: boolean; minha: boolean; concluir: Concluir }) {
  const [aberta, setAberta] = useState(false)
  const podeRegistrar = opera && !minha && (!p.jubilado || !p.em_dia)
  return (
    <li className="fin-linha-pessoa" aria-label={p.nome}>
      <span className="avatar-ministro" aria-hidden="true">
        {iniciaisDe(p.nome)}
      </span>
      <span className="linha-corpo">
        <strong>{p.nome}</strong>
        <span>
          nº {p.numero_registro} · {p.igreja ?? SEM_IGREJA}
        </span>
      </span>
      <span className="fin-linha-acoes">
        <SituacaoChip p={p} />
        {p.paraConferir && opera ? (
          <Link to="/financeiro/comprovantes" className="botao-link">
            Conferir
          </Link>
        ) : podeRegistrar ? (
          <button type="button" className="botao-link" onClick={() => setAberta((a) => !a)} aria-expanded={aberta}>
            {aberta ? 'Fechar' : 'Registrar pagamento recebido'}
          </button>
        ) : null}
      </span>
      {opera && minha && (!p.jubilado || !p.em_dia) && (
        <span className="detalhe fin-linha-largura">É você: outra pessoa da tesouraria ou da presidência registra o seu pagamento.</span>
      )}
      {aberta && (
        <div className="fin-linha-largura">
          <RegistrarPagamento pessoaId={p.pessoa_id} nome={p.nome} concluir={concluir} />
        </div>
      )}
    </li>
  )
}

/** "Por igreja": quantos estão em dia em cada igreja (as que têm mais gente em atraso primeiro). */
function PorIgrejaResumo({ pessoas }: { pessoas: Pessoa[] }) {
  const grupos = new Map<string, { total: number; emDia: number }>()
  for (const p of pessoas) {
    const nome = p.igreja ?? SEM_IGREJA
    const g = grupos.get(nome) ?? { total: 0, emDia: 0 }
    g.total += 1
    if (p.em_dia) g.emDia += 1
    grupos.set(nome, g)
  }
  const linhas = [...grupos.entries()]
    .map(([igreja, g]) => ({ igreja, ...g }))
    .sort((a, b) => a.emDia / a.total - b.emDia / b.total || b.total - a.total || a.igreja.localeCompare(b.igreja))
  return (
    <section className="bloco" aria-labelledby="titulo-por-igreja-resumo">
      <h2 id="titulo-por-igreja-resumo">Por igreja</h2>
      {linhas.length === 0 ? (
        <p className="vazio">Nenhum ministro que contribui.</p>
      ) : (
        <ul className="fin-barras" aria-label="Em dia por igreja">
          {linhas.slice(0, 6).map((l) => (
            <li key={l.igreja} className={l.emDia === l.total ? 'area-financas' : 'area-eventos'}>
              <span className="fin-barras-rotulo">
                <span>{l.igreja}</span>
                <strong>
                  {l.emDia} de {l.total}
                </strong>
              </span>
              <span className="fin-barra" aria-hidden="true">
                <span style={{ width: `${porcento(l.emDia, l.total)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/financeiro/contribuicoes/igrejas" className="botao-link alinhar-esquerda">
        Ver todas as igrejas
      </Link>
    </section>
  )
}

const MOSTRAR_TODOS = 30

/** Todos os ministros, com a busca: para achar qualquer um (ex.: registrar um pagamento adiantado). */
function TodosOsMinistros({ pessoas, opera, pessoaId, concluir }: { pessoas: Pessoa[]; opera: boolean; pessoaId: string; concluir: Concluir }) {
  const [busca, setBusca] = useState('')
  const [soAtraso, setSoAtraso] = useState(false)
  const [todos, setTodos] = useState(false)
  const termo = busca.trim()
  const filtrados = pessoas.filter((s) => (!soAtraso || !s.em_dia) && (contemTexto(s.nome, termo) || contemTexto(s.igreja, termo)))
  const visiveis = todos || termo ? filtrados : filtrados.slice(0, MOSTRAR_TODOS)
  return (
    <section className="bloco" aria-labelledby="titulo-todos-ministros">
      <h2 id="titulo-todos-ministros">Todos os ministros</h2>
      <div className="fin-filtros">
        <label className="campo-busca">
          <span className="somente-leitor">Buscar ministro ou igreja</span>
          <input
            type="search"
            aria-label="Buscar ministro ou igreja"
            placeholder="Buscar ministro ou igreja"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <label className="caixa-marcar">
          <input type="checkbox" checked={soAtraso} onChange={(e) => setSoAtraso(e.target.checked)} />
          Só os em atraso
        </label>
      </div>
      {filtrados.length === 0 ? (
        <p className="vazio">Ninguém encontrado.</p>
      ) : (
        <ul className="lista-linhas" aria-label="Situação dos ministros">
          {visiveis.map((p) => (
            <LinhaPessoa key={p.pessoa_id} p={p} opera={opera} minha={p.pessoa_id === pessoaId} concluir={concluir} />
          ))}
        </ul>
      )}
      {!termo && filtrados.length > MOSTRAR_TODOS && (
        <button type="button" className="botao-texto alinhar-esquerda" onClick={() => setTodos((t) => !t)}>
          {todos ? 'Mostrar menos' : `Mostrar todos (${filtrados.length})`}
        </button>
      )}
    </section>
  )
}

/** Registrar um pagamento recebido em mãos (e cancelar uma contribuição, com motivo). */
function RegistrarPagamento({ pessoaId, nome, concluir }: { pessoaId: string; nome: string; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(() => cobrancasEmAbertoDe(pessoaId))
  const [cobrancaId, setCobrancaId] = useState('')
  const [data, setData] = useState(hojeIso())
  const [forma, setForma] = useState<string>('Dinheiro')
  const [observacao, setObservacao] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(cobrancas) =>
        cobrancas.length === 0 ? (
          <p className="vazio">Nenhuma contribuição em aberto.</p>
        ) : (
          <>
            <form
              className="form-linha form-compacto"
              aria-label={`Registrar pagamento de ${nome}`}
              onSubmit={async (e) => {
                e.preventDefault()
                const c = cobrancas.find((x) => x.id === cobrancaId)
                if (!c) return
                await umaVez(async () =>
                  concluir(
                    await registrarPagamento(c.id, data, Number(c.valor), forma, observacao),
                    `Pagamento de ${nome} registrado (${nomeDaCobranca(c)}).`,
                  ),
                )
              }}
            >
              <label>
                Contribuição
                <select required value={cobrancaId} onChange={(e) => setCobrancaId(e.target.value)}>
                  <option value="">— Escolha —</option>
                  {cobrancas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {nomeDaCobranca(c)} — {formatarReais(c.valor)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                Forma
                <select value={forma} onChange={(e) => setForma(e.target.value)}>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observação
                <input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
              </label>
              <button type="submit" className="botao" disabled={enviando}>
                Registrar
              </button>
            </form>
            <details className="acao-recolhida">
              <summary>Cancelar uma contribuição (isenção ou lançada por engano)</summary>
              <form
                className="form-linha form-compacto"
                aria-label={`Cancelar contribuição de ${nome}`}
                onSubmit={async (e) => {
                  e.preventDefault()
                  const c = cobrancas.find((x) => x.id === cobrancaId)
                  if (!c) return concluir({ erro: 'Escolha acima qual contribuição cancelar.' }, '')
                  await umaVez(async () =>
                    concluir(await cancelarCobranca(c.id, motivo), `Contribuição cancelada: ${nomeDaCobranca(c)} de ${nome}.`),
                  )
                }}
              >
                <label>
                  Motivo *
                  <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: isenção aprovada pela diretoria" />
                </label>
                <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
                  Cancelar a contribuição escolhida
                </button>
              </form>
            </details>
          </>
        )
      }
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------

function EscolherExercicio({ exercicio, aoEscolher, anos }: { exercicio: number; aoEscolher: (e: number) => void; anos: number[] }) {
  return (
    <label className="campo-curto">
      Exercício
      <select value={exercicio} onChange={(e) => aoEscolher(Number(e.target.value))}>
        {anos.map((a) => (
          <option key={a} value={a}>
            {nomeDoExercicio(a)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** /financeiro/contribuicoes/igrejas — as contribuições do exercício por igreja. */
export function ContribuicoesPorIgreja() {
  const atual = exercicioDe(hojeIso())
  const [exercicio, escolher] = useExercicio()
  return <TabelaPorIgreja key={exercicio} exercicio={exercicio} atual={atual} aoEscolher={escolher} />
}

function TabelaPorIgreja({ exercicio, atual, aoEscolher }: { exercicio: number; atual: number; aoEscolher: (e: number) => void }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [linhas, todos] = await Promise.all([contribuicoesPorIgreja(exercicio), situacaoDeTodos()])
    if (linhas.erro !== null) return linhas
    if (todos.erro !== null) return todos
    return ok({ linhas: linhas.dados, todos: todos.dados })
  })
  return (
    <>
      <div className="fin-barra-acoes">
        <EscolherExercicio exercicio={exercicio} aoEscolher={aoEscolher} anos={[atual, atual - 1, atual - 2]} />
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ linhas, todos }) => {
          const emDia = (igreja: string) => {
            const daIgreja = todos.filter((p) => !p.jubilado && (p.igreja ?? SEM_IGREJA) === igreja)
            return `${daIgreja.filter((p) => p.em_dia).length} de ${daIgreja.length}`
          }
          return linhas.length === 0 ? (
            <p className="vazio">Nenhuma contribuição gerada para {nomeDoExercicio(exercicio)}.</p>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela-relatorio" aria-label="Contribuições por igreja">
                <thead>
                  <tr>
                    <th scope="col">Igreja</th>
                    <th scope="col" className="col-valor">
                      Em dia hoje
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
                      <td className="col-valor">{emDia(l.igreja)}</td>
                      <td className="col-valor">{formatarReais(l.previsto)}</td>
                      <td className="col-valor">{formatarReais(l.recebido)}</td>
                      <td className="col-valor">{formatarReais(l.em_aberto)}</td>
                      <td className={`col-valor ${Number(l.vencido) > 0 ? 'valor-saida' : ''}`}>{formatarReais(l.vencido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }}
      </MostrarCarga>
      <p className="detalhe">Pela igreja de hoje de cada ministro. Em dia: nada vencido e não pago (Art. 11).</p>
    </>
  )
}

/** /financeiro/contribuicoes/cobrancas — gerar as cobranças do exercício e o resumo dele. */
export function CobrancasDoAno({ concluir, somenteLeitura }: { concluir: Concluir; somenteLeitura: boolean }) {
  const hoje = hojeIso()
  const atual = exercicioDe(hoje)
  const [exercicio, escolher] = useExercicio()
  const [enviando, umaVez] = useUmaVez()
  const [versao, setVersao] = useState(0)

  return (
    <>
      <div className="fin-barra-acoes">
        <EscolherExercicio exercicio={exercicio} aoEscolher={escolher} anos={[atual + 1, atual, atual - 1]} />
        {!somenteLeitura && (
          <button
            type="button"
            className="botao"
            disabled={enviando}
            onClick={() =>
              void umaVez(async () => {
                const r = await gerarCobrancas(exercicio)
                const certo = concluir(
                  r,
                  r.erro === null
                    ? r.dados === 0
                      ? `Nenhuma cobrança nova: o exercício ${nomeDoExercicio(exercicio)} já estava gerado para todos.`
                      : `${r.dados} cobrança(s) gerada(s) para o exercício ${nomeDoExercicio(exercicio)}.`
                    : '',
                )
                if (certo) setVersao((v) => v + 1)
              })
            }
          >
            Gerar cobranças do exercício
          </button>
        )}
      </div>
      <p className="detalhe">
        Gera, para cada associado ativo, as mensalidades (ou a anuidade, para quem escolheu) pelo valor da categoria. Jubilado não
        recebe cobrança. Pode gerar de novo quando entrar associado novo: nada se repete.
      </p>
      <ResumoCobrancas key={`${exercicio}-${versao}`} exercicio={exercicio} hoje={hoje} />
    </>
  )
}

function ResumoCobrancas({ exercicio, hoje }: { exercicio: number; hoje: string }) {
  const [carga, recarregar] = useCarregar(() => resumoDoExercicio(exercicio, hoje))
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(r) => (
        <ul className="numeros-grandes fin-numeros-cobranca" aria-label="Resumo do exercício">
          <li className="area-assembleias">
            <span>Cobranças</span>
            <strong>{r.cobrancas}</strong>
          </li>
          <li className="area-assembleias">
            <span>Previsto</span>
            <strong>{formatarReais(r.previsto)}</strong>
          </li>
          <li className="area-financas">
            <span>Recebido</span>
            <strong>{formatarReais(r.recebido)}</strong>
          </li>
          <li className="area-eventos">
            <span>Em aberto</span>
            <strong>{formatarReais(r.emAberto)}</strong>
          </li>
          <li className="area-pessoas">
            <span>Vencido</span>
            <strong>{formatarReais(r.vencido)}</strong>
          </li>
        </ul>
      )}
    </MostrarCarga>
  )
}

/** /financeiro/contribuicoes/valores — os valores, a taxa de inscrição, os vencimentos e quem escolheu a anuidade. */
export function ValoresEPlanos({ podeEditar }: { podeEditar: boolean }) {
  const exercicio = exercicioDe(hojeIso())
  const [carga, recarregar] = useCarregar(async () => {
    const [planos, todos] = await Promise.all([planosDoExercicio(exercicio), situacaoDeTodos()])
    if (planos.erro !== null) return planos
    if (todos.erro !== null) return todos
    return ok({ anual: planos.dados.anual, pagantes: todos.dados.filter((p) => !p.jubilado).length })
  })
  const [versaoValores, setVersaoValores] = useState(0)
  const [versaoTaxa, setVersaoTaxa] = useState(0)
  return (
    <>
      <section className="bloco" aria-labelledby="titulo-planos">
        <h2 id="titulo-planos">Os planos em {nomeDoExercicio(exercicio)}</h2>
        <MostrarCarga carga={carga} recarregar={recarregar}>
          {({ anual, pagantes }) => (
            <p>
              <strong>{plural(anual, 'ministro escolheu', 'ministros escolheram')}</strong> pagar o ano inteiro (a anuidade, em abril);
              os outros {Math.max(pagantes - anual, 0)} pagam por mês. Cada ministro escolhe o plano em "Minhas mensalidades".
            </p>
          )}
        </MostrarCarga>
      </section>
      <Valores key={`valores-${versaoValores}`} podeEditar={podeEditar} aoMudar={() => setVersaoTaxa((v) => v + 1)} />
      <TaxaInscricao key={`taxa-${versaoTaxa}`} podeEditar={podeEditar} aoMudar={() => setVersaoValores((v) => v + 1)} />
      <Vencimentos podeEditar={podeEditar} />
    </>
  )
}
