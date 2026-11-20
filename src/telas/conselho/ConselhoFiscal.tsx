import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Chip } from '../../componentes/Telas'
import { lancamentosDoPeriodo, type LinhaCaixa } from '../../dados/caixa'
import { ok, type Resultado } from '../../dados/cliente'
import { formatarReais } from '../../dados/configuracoes'
import {
  aprovarMesesSemMovimento,
  assinarMes,
  assinarParecer,
  assinaturasDoParecer,
  decidirMes,
  listarEsclarecimentos,
  membrosDoConselho,
  mesesDoConselho,
  NOME_DA_SITUACAO_MES,
  pedirEsclarecimento,
  responderEsclarecimento,
  type Assinatura,
  type DecisaoMes,
  type Esclarecimento,
  type MesDoConselho,
} from '../../dados/conselhoFiscal'
import { exercicioDe, nomeDoExercicio } from '../../dados/financeiro'
import type { Perfil } from '../../dados/perfis'
import { buscarBalanco, devolverBalanco, NOME_DA_SITUACAO_BALANCO, NOME_DO_PARECER, parecerBalanco, type TipoParecer } from '../../dados/prestacao'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { imprimir } from '../../utilitarios/exportar'
import { formatarData, formatarDataDeInstante, formatarDataHora, hojeIso } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'
import { LinkComprovante, Valor } from '../financeiro/comum'
import { fimDoMes, nomeDoMes, plural, somarMes, useExercicio, useLinkDoArquivo, type Concluir } from '../financeiro/util'
import {
  AREA_DA_SITUACAO,
  competenciaDoEndereco,
  estaAprovado,
  exercicioDoParecer,
  mesCurto,
  mesDoEndereco,
  precisaDoConselho,
  textoDoParecer,
} from './regras'

// O módulo Conselho Fiscal (telas novas, Fase 5.5, parte 10; rodadas 13 e 14 aprovadas em 18/11/2026):
//   * Contas dos meses: o painel do exercício (a opção 3 da rodada 13) é a tela inicial; clicar num mês abre a página
//     do mês (a opção 2 melhorada, fiscal-2): os saldos, cada lançamento com o comprovante, a dúvida em destaque e o
//     parecer do mês (aprovar, aprovar com ressalva ou pedir esclarecimento);
//   * Esclarecimentos: as perguntas do Conselho e as respostas da tesouraria;
//   * Parecer do ano: sai dos 12 meses aprovados, ligado à prestação de contas (Art. 14);
//   * Documentos: o parecer do ano e os pareceres dos meses, para imprimir.
// O Conselho Fiscal decide; a tesouraria e a presidência veem e respondem.

type Quem = { pessoaId: string; perfis: Perfil[]; conselho: boolean; responde: boolean }

function useQuem(): Quem | null {
  const { estado } = useSessao()
  if (estado.situacao !== 'logado' || estado.conta?.tipo !== 'ok') return null
  const { pessoaId, perfis } = estado.conta.conta
  return {
    pessoaId,
    perfis,
    conselho: perfis.includes('conselho_fiscal'),
    responde: perfis.includes('tesouraria') || perfis.includes('presidencia'),
  }
}

/** A moldura de cada tela: o cabeçalho, a mensagem do que acabou de acontecer e o conteúdo. */
function TelaDoConselho({
  funcao,
  titulo,
  sub,
  acoes,
  children,
}: {
  funcao?: string
  titulo: string
  sub?: ReactNode
  acoes?: ReactNode
  children: (concluir: Concluir, quem: Quem) => ReactNode
}) {
  const quem = useQuem()
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  if (!quem) return <Carregando />
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    return r.erro === null
  }
  return (
    <div className="tela-nova cf-tela">
      <div className="nao-imprimir">
        <CabecalhoFuncao modulo={funcao ? `Conselho Fiscal › ${funcao}` : 'Conselho Fiscal'} titulo={titulo} sub={sub} acoes={acoes} />
      </div>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {children(concluir, quem)}
    </div>
  )
}

function EscolhaDoExercicio({ exercicio, aoEscolher, anos }: { exercicio: number; aoEscolher: (e: number) => void; anos: number[] }) {
  return (
    <div className="pilulas" role="group" aria-label="Exercício">
      {anos.map((a) => (
        <button key={a} type="button" className={a === exercicio ? 'pilula ativa' : 'pilula'} aria-pressed={a === exercicio} onClick={() => aoEscolher(a)}>
          {nomeDoExercicio(a)}
        </button>
      ))}
    </div>
  )
}

function ChipDoMes({ m }: { m: MesDoConselho }) {
  const area = AREA_DA_SITUACAO[m.situacao]
  if (!area) return <span className="detalhe">—</span>
  return <Chip area={area}>{NOME_DA_SITUACAO_MES[m.situacao]}</Chip>
}

/** As assinaturas dos membros: quem assinou e quem falta. */
function ListaAssinaturas({ assinaturas, membros }: { assinaturas: Assinatura[]; membros: { pessoa_id: string; nome: string }[] }) {
  const faltam = membros.filter((m) => !assinaturas.some((a) => a.pessoa_id === m.pessoa_id))
  return (
    <ul className="cf-assinaturas" aria-label="Assinaturas">
      {assinaturas.map((a) => (
        <li key={a.pessoa_id} className="area-financas">
          <Icone nome="check" tamanho={16} traco={2.6} />
          {a.nome} <span className="detalhe">({formatarDataDeInstante(a.em)})</span>
        </li>
      ))}
      {faltam.map((m) => (
        <li key={m.pessoa_id} className="area-eventos">
          <Icone nome="relogio" tamanho={16} traco={2.6} />
          {m.nome} <span className="detalhe">(falta)</span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------
// Contas dos meses: o painel do exercício (a tela inicial)
// ---------------------------------------------------------------------

/** /conselho-fiscal — o exercício mês a mês, os números e o parecer do ano. */
export function PainelConselho() {
  const atual = exercicioDe(hojeIso())
  const [exercicio, escolher] = useExercicio()
  return (
    <TelaDoConselho
      titulo={`O exercício de ${nomeDoExercicio(exercicio)}`}
      sub="Abril a março. Toque num mês para ver os lançamentos, os comprovantes e dar o parecer."
      acoes={<EscolhaDoExercicio exercicio={exercicio} aoEscolher={escolher} anos={[atual, atual - 1]} />}
    >
      {(concluir, quem) => <ConteudoPainel key={exercicio} exercicio={exercicio} quem={quem} concluir={concluir} />}
    </TelaDoConselho>
  )
}

function ConteudoPainel({ exercicio, quem, concluir }: { exercicio: number; quem: Quem; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [meses, balanco, membros] = await Promise.all([mesesDoConselho(exercicio), buscarBalanco(exercicio), membrosDoConselho()])
    if (meses.erro !== null) return meses
    if (balanco.erro !== null) return balanco
    if (membros.erro !== null) return membros
    return ok({ meses: meses.dados, balanco: balanco.dados.balanco, membros: membros.dados })
  })
  const [enviando, umaVez] = useUmaVez()
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ meses, balanco, membros }) => {
        const terminados = meses.filter((m) => m.situacao !== 'futuro' && m.situacao !== 'aberto')
        const aprovados = meses.filter(estaAprovado)
        const comRessalva = meses.filter((m) => m.situacao === 'ressalva')
        const paraAnalisar = meses.filter((m) => precisaDoConselho(m) || m.situacao === 'esclarecimento')
        const semMovimento = meses.filter((m) => precisaDoConselho(m) && Number(m.lancamentos) === 0)
        const ultimo = [...meses].reverse().find((m) => m.situacao !== 'futuro')
        return (
          <>
            <ul className="numeros-grandes" aria-label="O exercício em números">
              <li className="area-financas">
                <span>Meses aprovados</span>
                <strong>
                  {aprovados.length} de {terminados.length}
                </strong>
              </li>
              <li className="area-eventos">
                <span>Com ressalva</span>
                <strong>{comRessalva.length}</strong>
              </li>
              <li className="area-pessoas">
                <span>Para analisar</span>
                <strong>{paraAnalisar.length}</strong>
              </li>
              <li className="area-assembleias">
                <span>{ultimo?.situacao === 'aberto' ? 'Saldo de hoje' : 'Saldo no fim'}</span>
                <strong>{formatarReais(ultimo?.saldo_fim ?? 0)}</strong>
              </li>
            </ul>

            <section className="bloco" aria-labelledby="titulo-meses">
              <h2 id="titulo-meses" className="somente-leitor">
                Os meses
              </h2>
              <ul className="cf-meses" aria-label="Os meses do exercício">
                {meses.map((m) => {
                  const area = AREA_DA_SITUACAO[m.situacao]
                  const nome = nomeDoMes(m.competencia.slice(0, 7), true)
                  const conteudo = (
                    <>
                      <span className="cf-mes-quadro" aria-hidden="true">
                        {m.perguntas_abertas > 0 && <span className="cf-mes-pergunta">?</span>}
                      </span>
                      <span className="cf-mes-nome">{mesCurto(m.competencia)}</span>
                    </>
                  )
                  return (
                    <li key={m.competencia} className={area ? `area-${area} cf-mes-${m.situacao}` : 'cf-mes-futuro'}>
                      {m.situacao === 'futuro' ? (
                        <span aria-label={`${nome}: ainda não começou`}>{conteudo}</span>
                      ) : (
                        <Link to={`/conselho-fiscal/meses/${mesDoEndereco(m.competencia)}`} aria-label={`${nome}: ${NOME_DA_SITUACAO_MES[m.situacao]}`}>
                          {conteudo}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
              <ul className="cf-legenda" aria-label="Legenda">
                {(['aprovado', 'ressalva', 'para_analisar', 'esclarecimento', 'aberto'] as const).map((s) => (
                  <li key={s} className={`area-${AREA_DA_SITUACAO[s]}`}>
                    <span aria-hidden="true" />
                    {NOME_DA_SITUACAO_MES[s]}
                  </li>
                ))}
              </ul>
              {quem.conselho && semMovimento.length > 0 && (
                <div className="cf-sem-movimento">
                  <p className="detalhe">
                    {plural(semMovimento.length, 'mês terminou', 'meses terminaram')} sem nenhum lançamento (por exemplo, antes de o sistema começar).
                  </p>
                  <button
                    type="button"
                    className="botao botao-secundario"
                    disabled={enviando}
                    onClick={() =>
                      void umaVez(async () => {
                        const r = await aprovarMesesSemMovimento(exercicio)
                        if (concluir(r, r.erro === null ? `${plural(r.dados, 'mês aprovado', 'meses aprovados')} sem movimento.` : '')) recarregar()
                      })
                    }
                  >
                    Aprovar os meses sem movimento
                  </button>
                </div>
              )}
            </section>

            <section className="bloco" aria-labelledby="titulo-parecer-ano-painel">
              <h2 id="titulo-parecer-ano-painel">Parecer do ano de {nomeDoExercicio(exercicio)} (Art. 14)</h2>
              <p>
                {balanco?.parecer
                  ? `Parecer ${NOME_DO_PARECER[balanco.parecer].toLowerCase()}, dado em ${formatarDataHora(balanco.parecer_em ?? '')}. ${NOME_DA_SITUACAO_BALANCO[balanco.situacao]}.`
                  : balanco?.situacao === 'aguardando_parecer'
                    ? aprovados.length === 12
                      ? 'O balanço está esperando o parecer, e os 12 meses estão aprovados: o parecer está pronto para assinar.'
                      : `O balanço está esperando o parecer. Faltam ${12 - aprovados.length} mês(es) para aprovar.`
                    : 'Fica pronto para assinar quando os 12 meses estiverem aprovados e a tesouraria fechar o exercício (depois de março). Os pareceres de cada mês e as ressalvas entram nele sozinhos.'}
              </p>
              <ul className="cf-assinaturas" aria-label="Os membros do Conselho Fiscal">
                {membros.map((m) => (
                  <li key={m.pessoa_id} className="area-assembleias">
                    <Icone nome="perfil" tamanho={16} />
                    {m.nome}
                  </li>
                ))}
              </ul>
              <Link to={`/conselho-fiscal/parecer?exercicio=${exercicio}`} className="botao-link alinhar-esquerda">
                Ir para o parecer do ano
              </Link>
            </section>
          </>
        )
      }}
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------
// A página do mês
// ---------------------------------------------------------------------

/** Um lançamento do mês (a transferência com os dois lados juntos). */
type LinhaDoMes = { chave: string; l: LinhaCaixa; detalhe: string; transferencia: boolean }

function linhasDoMes(lancamentos: LinhaCaixa[]): LinhaDoMes[] {
  const vistos = new Set<string>()
  const linhas: LinhaDoMes[] = []
  for (const l of lancamentos.filter((x) => x.no_saldo)) {
    if (l.transferencia_id) {
      if (vistos.has(l.transferencia_id)) continue
      vistos.add(l.transferencia_id)
      const lados = lancamentos.filter((x) => x.transferencia_id === l.transferencia_id)
      const sai = lados.find((x) => x.tipo === 'saida') ?? l
      const entra = lados.find((x) => x.tipo === 'entrada')
      linhas.push({ chave: l.transferencia_id, l: sai, detalhe: `Transferência · ${sai.conta_nome} → ${entra?.conta_nome ?? '?'}`, transferencia: true })
    } else {
      linhas.push({ chave: l.id, l, detalhe: `${l.categoria_nome} · ${l.conta_nome}`, transferencia: false })
    }
  }
  return linhas
}

/** /conselho-fiscal/meses/:mes — os saldos, cada lançamento com o comprovante e o parecer do mês. */
export function MesDoConselhoPagina() {
  const { mes } = useParams()
  const competencia = competenciaDoEndereco(mes)
  if (!competencia) return <p className="erro">Mês inválido.</p>
  const nome = nomeDoMes(competencia.slice(0, 7), true)
  const anterior = somarMes(competencia.slice(0, 7), -1)
  const seguinte = somarMes(competencia.slice(0, 7), 1)
  return (
    <TelaDoConselho
      key={competencia}
      funcao="Contas dos meses"
      titulo={nome}
      acoes={
        <>
          <Link to={`/conselho-fiscal/meses/${anterior}`} className="botao botao-secundario">
            ← {nomeDoMes(anterior, true).split(' ')[0]}
          </Link>
          {seguinte <= hojeIso().slice(0, 7) && (
            <Link to={`/conselho-fiscal/meses/${seguinte}`} className="botao botao-secundario">
              {nomeDoMes(seguinte, true).split(' ')[0]} →
            </Link>
          )}
        </>
      }
    >
      {(concluir, quem) => <ConteudoMes competencia={competencia} quem={quem} concluir={concluir} />}
    </TelaDoConselho>
  )
}

function ConteudoMes({ competencia, quem, concluir }: { competencia: string; quem: Quem; concluir: Concluir }) {
  const exercicio = exercicioDe(competencia)
  const [carga, recarregar] = useCarregar(async () => {
    const [meses, lancamentos, perguntas, membros] = await Promise.all([
      mesesDoConselho(exercicio),
      lancamentosDoPeriodo(competencia, fimDoMes(competencia.slice(0, 7))),
      listarEsclarecimentos(competencia),
      membrosDoConselho(),
    ])
    if (meses.erro !== null) return meses
    if (lancamentos.erro !== null) return lancamentos
    if (perguntas.erro !== null) return perguntas
    if (membros.erro !== null) return membros
    const mes = meses.dados.find((m) => m.competencia === competencia)
    if (!mes) return { dados: null, erro: 'Mês não encontrado.' } as Resultado<never>
    return ok({ mes, lancamentos: lancamentos.dados, perguntas: perguntas.dados, membros: membros.dados })
  })
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ mes, lancamentos, perguntas, membros }) => {
        const linhas = linhasDoMes(lancamentos)
        const abertaDe = (id: string) => perguntas.some((p) => p.lancamento_id === id && !p.respondido_em)
        const respondidaDe = (id: string) => perguntas.some((p) => p.lancamento_id === id && p.respondido_em)
        const selecionada = linhas.find((x) => x.chave === escolhido) ?? linhas.find((x) => abertaDe(x.l.id)) ?? null
        const terminou = mes.situacao !== 'aberto' && mes.situacao !== 'futuro'
        return (
          <>
            <div className="cf-situacao-mes">
              <ChipDoMes m={mes} />
              <span className="detalhe">
                {mes.aprovacao && mes.aprovacao.vale
                  ? `${mes.aprovacao.decisao === 'aprovado' ? 'Aprovado' : 'Aprovado com ressalva'} por ${mes.aprovacao.decidido_por ?? '—'} em ${formatarDataDeInstante(mes.aprovacao.decidido_em)}${mes.aprovacao.sem_movimento ? ' (sem movimento)' : ''}.`
                  : mes.situacao === 'mudou'
                    ? 'Os números do mês mudaram depois da aprovação: confira de novo.'
                    : mes.situacao === 'esclarecimento'
                      ? 'Há pergunta esperando a resposta da tesouraria.'
                      : mes.situacao === 'aberto'
                        ? 'O mês ainda não terminou: o parecer vem depois.'
                        : `${plural(Number(mes.lancamentos), 'lançamento', 'lançamentos')} para conferir.`}
              </span>
            </div>
            <ul className="numeros-grandes cf-saldos-mes" aria-label="Os saldos do mês">
              <li className="area-assembleias">
                <span>Saldo no início</span>
                <strong>{formatarReais(mes.saldo_inicio)}</strong>
              </li>
              <li className="area-financas">
                <span>Entrou</span>
                <strong>+ {formatarReais(mes.entradas)}</strong>
              </li>
              <li className="area-pessoas">
                <span>Saiu</span>
                <strong>− {formatarReais(mes.saidas)}</strong>
              </li>
              <li className="area-assembleias">
                <span>Saldo no fim</span>
                <strong>{formatarReais(mes.saldo_fim)}</strong>
              </li>
            </ul>

            <div className="cf-mes">
              <div className="cf-mes-principal">
                <section className="bloco cf-lancamentos" aria-labelledby="titulo-lancamentos-mes">
                  <h2 id="titulo-lancamentos-mes">Os lançamentos</h2>
                  {linhas.length === 0 ? (
                    <p className="vazio">Nenhum lançamento neste mês.</p>
                  ) : (
                    <ul aria-label="Lançamentos do mês">
                      {linhas.map((x) => {
                        const aberta = abertaDe(x.l.id)
                        return (
                          <li key={x.chave} className={aberta ? 'cf-linha cf-linha-duvida' : x === selecionada ? 'cf-linha cf-linha-escolhida' : 'cf-linha'} aria-label={x.l.descricao}>
                            <span className="cf-linha-data">{formatarData(x.l.data).slice(0, 5)}</span>
                            <button type="button" className="cf-linha-corpo" onClick={() => setEscolhido(x.chave)} aria-pressed={x === selecionada}>
                              <strong>{x.l.descricao}</strong>
                              <span>{x.detalhe}</span>
                            </button>
                            <Valor tipo={x.l.tipo} valor={x.l.valor} neutro={x.transferencia} />
                            <span className="cf-linha-comprovante">
                              {x.transferencia ? <span className="detalhe">entre contas</span> : <LinkComprovante caminho={x.l.comprovante_caminho} texto="comprovante" />}
                            </span>
                            <span className="cf-linha-marca">
                              {aberta ? (
                                <span className="cf-duvida" title="Pergunta esperando a tesouraria">
                                  ?
                                </span>
                              ) : respondidaDe(x.l.id) ? (
                                <span className="detalhe">respondido</span>
                              ) : estaAprovado(mes) ? (
                                <span className="texto-ok" aria-label="conferido">
                                  <Icone nome="check" tamanho={18} traco={3} />
                                </span>
                              ) : null}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                <ParecerDoMes key={`${mes.situacao}-${mes.aprovacao?.id ?? ''}`} mes={mes} terminou={terminou} quem={quem} membros={membros} concluir={concluirERecarregar} />
                <PerguntasDoMes perguntas={perguntas} quem={quem} concluir={concluirERecarregar} />
              </div>

              <aside className="cf-mes-lado">
                {selecionada ? (
                  <LancamentoEscolhido key={selecionada.chave} x={selecionada} competencia={competencia} mes={mes} quem={quem} concluir={concluirERecarregar} />
                ) : (
                  <section className="bloco">
                    <h2>O comprovante</h2>
                    <p className="detalhe">Toque num lançamento para ver o comprovante e, se precisar, perguntar à tesouraria.</p>
                  </section>
                )}
              </aside>
            </div>
          </>
        )
      }}
    </MostrarCarga>
  )
}

const ehImagem = (caminho: string) => /\.(jpe?g|png|webp|gif)$/i.test(caminho)

function LancamentoEscolhido({ x, competencia, mes, quem, concluir }: { x: LinhaDoMes; competencia: string; mes: MesDoConselho; quem: Quem; concluir: Concluir }) {
  const url = useLinkDoArquivo(x.l.comprovante_caminho)
  const [pergunta, setPergunta] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const podePerguntar = quem.conselho && !estaAprovado(mes) && mes.situacao !== 'futuro'
  return (
    <section className="bloco" aria-labelledby="titulo-lancamento-escolhido">
      <h2 id="titulo-lancamento-escolhido">{x.l.descricao}</h2>
      <span className="detalhe">
        {formatarData(x.l.data)} · {x.detalhe}
        {x.l.lancado_por_nome && ` · lançado por ${x.l.lancado_por_nome}`}
        {x.l.autorizado_por_nome && ` · autorizado por ${x.l.autorizado_por_nome}`}
      </span>
      <strong className="fin-cartao-valor">{formatarReais(x.l.valor)}</strong>
      {x.l.comprovante_caminho ? (
        url ? (
          ehImagem(x.l.comprovante_caminho) ? (
            <a href={url} target="_blank" rel="noreferrer" className="cf-comprovante-imagem">
              <img src={url} alt={`Comprovante: ${x.l.descricao}`} />
            </a>
          ) : (
            <a href={url} target="_blank" rel="noreferrer" className="botao botao-secundario botao-com-icone">
              <Icone nome="pedido" tamanho={18} />
              Abrir o comprovante (PDF)
            </a>
          )
        ) : (
          <span className="detalhe">{url === null ? 'Não foi possível abrir o comprovante agora.' : 'Carregando o comprovante…'}</span>
        )
      ) : (
        <span className="fin-sem-comprovante">{x.transferencia ? 'Transferência entre contas: não tem comprovante.' : 'Este lançamento está sem comprovante.'}</span>
      )}
      {podePerguntar && !x.transferencia && (
        <form
          aria-label="A pergunta sobre o lançamento"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              if (concluir(await pedirEsclarecimento(competencia, x.l.id, pergunta), 'Pergunta mandada à tesouraria.')) setPergunta('')
            })
          }}
        >
          <label>
            Perguntar à tesouraria
            <textarea rows={3} required value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Ex.: o orçamento previa R$ 300,00; por que saiu mais?" />
          </label>
          <button type="submit" className="botao botao-secundario" disabled={enviando}>
            Mandar a pergunta
          </button>
        </form>
      )}
    </section>
  )
}

/** O parecer do mês: aprovar, aprovar com ressalva ou pedir esclarecimento; ou as assinaturas, se já aprovado. */
function ParecerDoMes({
  mes,
  terminou,
  quem,
  membros,
  concluir,
}: {
  mes: MesDoConselho
  terminou: boolean
  quem: Quem
  membros: { pessoa_id: string; nome: string }[]
  concluir: Concluir
}) {
  const [aberto, setAberto] = useState(false)
  const [escolha, setEscolha] = useState<DecisaoMes | 'esclarecimento'>('aprovado')
  const [texto, setTexto] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = nomeDoMes(mes.competencia.slice(0, 7))
  const mesNome = nome.split(' ')[0]

  if (mes.aprovacao && mes.aprovacao.vale) {
    const assinei = mes.aprovacao.assinaturas.some((a) => a.pessoa_id === quem.pessoaId)
    return (
      <section className="bloco" aria-labelledby="titulo-parecer-mes">
        <h2 id="titulo-parecer-mes">Parecer de {mesNome}</h2>
        <p>
          <strong>{mes.aprovacao.decisao === 'aprovado' ? 'Aprovado' : 'Aprovado com ressalva'}</strong>
          {mes.aprovacao.ressalva && `: ${mes.aprovacao.ressalva}`}
        </p>
        <ListaAssinaturas assinaturas={mes.aprovacao.assinaturas} membros={membros} />
        {quem.conselho && !assinei && (
          <button
            type="button"
            className="botao botao-secundario alinhar-esquerda"
            disabled={enviando}
            onClick={() => void umaVez(async () => concluir(await assinarMes(mes.aprovacao!.id), `Você assinou o parecer de ${mesNome}.`))}
          >
            Assinar também
          </button>
        )}
      </section>
    )
  }
  if (!quem.conselho || !terminou) return null
  if (mes.situacao === 'esclarecimento') {
    return <p className="detalhe">O parecer de {mesNome} fica para depois da resposta da tesouraria.</p>
  }
  if (!aberto) {
    return (
      <button type="button" className="botao fin-botao-largo" onClick={() => setAberto(true)}>
        Dar o parecer de {mesNome}
      </button>
    )
  }
  return (
    <form
      className="bloco"
      aria-label={`Parecer de ${mesNome}`}
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => {
          if (escolha === 'esclarecimento') {
            concluir(await pedirEsclarecimento(mes.competencia, null, texto), 'Pergunta mandada à tesouraria.')
          } else {
            concluir(
              await decidirMes(mes.competencia, escolha, texto),
              escolha === 'aprovado' ? `As contas de ${nome} foram aprovadas.` : `As contas de ${nome} foram aprovadas com ressalva.`,
            )
          }
        })
      }}
    >
      <h2>Parecer de {mesNome}</h2>
      <fieldset className="opcoes-radio">
        <legend className="somente-leitor">O parecer</legend>
        <label>
          <input type="radio" name="parecer-mes" checked={escolha === 'aprovado'} onChange={() => setEscolha('aprovado')} />
          <span>
            <strong>Aprovar</strong> — as contas conferem
          </span>
        </label>
        <label>
          <input type="radio" name="parecer-mes" checked={escolha === 'aprovado_com_ressalva'} onChange={() => setEscolha('aprovado_com_ressalva')} />
          <span>
            <strong>Aprovar com ressalva</strong> — conferem, com uma observação
          </span>
        </label>
        <label>
          <input type="radio" name="parecer-mes" checked={escolha === 'esclarecimento'} onChange={() => setEscolha('esclarecimento')} />
          <span>
            <strong>Pedir esclarecimento</strong> — perguntar à tesouraria antes de aprovar
          </span>
        </label>
      </fieldset>
      {escolha !== 'aprovado' && (
        <label>
          {escolha === 'esclarecimento' ? 'A pergunta *' : 'A ressalva *'}
          <textarea rows={3} required value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
      )}
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          {escolha === 'esclarecimento' ? 'Mandar a pergunta' : 'Assinar o parecer'}
        </button>
        <button type="button" className="botao botao-secundario" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function PerguntasDoMes({ perguntas, quem, concluir }: { perguntas: Esclarecimento[]; quem: Quem; concluir: Concluir }) {
  if (perguntas.length === 0) return null
  return (
    <section className="bloco" aria-labelledby="titulo-perguntas-mes">
      <h2 id="titulo-perguntas-mes">Perguntas e respostas</h2>
      <ul className="cf-perguntas" aria-label="Perguntas do mês">
        {perguntas.map((p) => (
          <Pergunta key={p.id} p={p} quem={quem} concluir={concluir} />
        ))}
      </ul>
    </section>
  )
}

/** Uma pergunta do Conselho, a resposta da tesouraria e, se ainda não respondida, o formulário (para quem responde). */
function Pergunta({ p, quem, concluir, comMes = false }: { p: Esclarecimento; quem: Quem; concluir: Concluir; comMes?: boolean }) {
  const [resposta, setResposta] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const sobre = p.lancamento ? `${p.lancamento.descricao} (${formatarReais(p.lancamento.valor)})` : 'o mês'
  return (
    <li className={p.respondido_em ? 'cf-pergunta' : 'cf-pergunta cf-pergunta-aberta'} aria-label={`Pergunta sobre ${sobre}`}>
      <span className="cf-pergunta-topo">
        {p.respondido_em ? <Chip area="financas">Respondida</Chip> : <Chip area="eventos">Esperando a tesouraria</Chip>}
        <span className="detalhe">
          {comMes && (
            <>
              <Link to={`/conselho-fiscal/meses/${mesDoEndereco(p.competencia)}`}>{nomeDoMes(p.competencia.slice(0, 7), true)}</Link> ·{' '}
            </>
          )}
          sobre {sobre}
        </span>
      </span>
      <p className="cf-pergunta-texto">
        <strong>Pergunta:</strong> {p.pergunta}
        <span className="detalhe">
          {' '}
          — {p.perguntado?.nome ?? 'Conselho Fiscal'}, {formatarDataDeInstante(p.perguntado_em)}
        </span>
      </p>
      {p.respondido_em ? (
        <p className="cf-pergunta-texto">
          <strong>Resposta:</strong> {p.resposta}
          <span className="detalhe">
            {' '}
            — {p.respondido?.nome ?? 'tesouraria'}, {formatarDataDeInstante(p.respondido_em)}
          </span>
          {p.resposta_arquivo && (
            <>
              {' '}
              <LinkComprovante caminho={p.resposta_arquivo} texto="o arquivo da resposta" />
            </>
          )}
        </p>
      ) : (
        quem.responde && (
          <form
            aria-label={`Responder: ${p.pergunta}`}
            onSubmit={(e) => {
              e.preventDefault()
              setErro(null)
              void umaVez(async () => {
                let pronto: { blob: Blob; extensao: string } | null = null
                if (arquivo) {
                  const r = await prepararComprovante(arquivo)
                  if ('erro' in r) return setErro(r.erro)
                  pronto = r
                }
                concluir(await responderEsclarecimento(p.id, resposta, quem.pessoaId, pronto), 'Resposta mandada ao Conselho Fiscal.')
              })
            }}
          >
            <label>
              Resposta *
              <textarea rows={3} required value={resposta} onChange={(e) => setResposta(e.target.value)} />
            </label>
            <label>
              Comprovante (opcional)
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            {p.lancamento_id && <p className="detalhe">Se o lançamento estava sem comprovante, o arquivo vai também para ele.</p>}
            <Mensagem erro={erro} />
            <button type="submit" className="botao" disabled={enviando}>
              Mandar a resposta
            </button>
          </form>
        )
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// Esclarecimentos: todas as perguntas
// ---------------------------------------------------------------------

/** /conselho-fiscal/esclarecimentos — as perguntas do Conselho e as respostas da tesouraria. */
export function Esclarecimentos() {
  return (
    <TelaDoConselho funcao="Esclarecimentos" titulo="Perguntas e respostas" sub="O Conselho Fiscal pergunta sobre um mês ou um lançamento; a tesouraria responde, com o comprovante que faltava.">
      {(concluir, quem) => <ListaDeEsclarecimentos quem={quem} concluir={concluir} />}
    </TelaDoConselho>
  )
}

function ListaDeEsclarecimentos({ quem, concluir }: { quem: Quem; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(() => listarEsclarecimentos())
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(perguntas) => {
        const abertas = perguntas.filter((p) => !p.respondido_em)
        const respondidas = perguntas.filter((p) => p.respondido_em)
        return (
          <>
            <section className="bloco" aria-labelledby="titulo-esperando">
              <h2 id="titulo-esperando">Esperando a tesouraria ({abertas.length})</h2>
              {abertas.length === 0 ? (
                <p className="vazio">Nenhuma pergunta esperando resposta.</p>
              ) : (
                <ul className="cf-perguntas" aria-label="Perguntas esperando resposta">
                  {abertas.map((p) => (
                    <Pergunta key={p.id} p={p} quem={quem} concluir={concluirERecarregar} comMes />
                  ))}
                </ul>
              )}
            </section>
            <section className="bloco" aria-labelledby="titulo-respondidas">
              <h2 id="titulo-respondidas">Respondidas ({respondidas.length})</h2>
              {respondidas.length === 0 ? (
                <p className="vazio">Nenhuma pergunta respondida ainda.</p>
              ) : (
                <ul className="cf-perguntas" aria-label="Perguntas respondidas">
                  {respondidas.map((p) => (
                    <Pergunta key={p.id} p={p} quem={quem} concluir={concluirERecarregar} comMes />
                  ))}
                </ul>
              )}
            </section>
          </>
        )
      }}
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------
// O parecer do ano
// ---------------------------------------------------------------------

/** /conselho-fiscal/parecer — o parecer do ano, a partir dos meses aprovados, ligado à prestação de contas. */
export function ParecerDoAno() {
  const atual = exercicioDe(hojeIso())
  const [exercicio, escolher] = useExercicio(exercicioDoParecer())
  return (
    <TelaDoConselho
      funcao="Parecer do ano"
      titulo={`Parecer do exercício de ${nomeDoExercicio(exercicio)}`}
      sub="O parecer sobre as contas do ano (Art. 14), que vai para a assembleia junto com o balanço."
      acoes={<EscolhaDoExercicio exercicio={exercicio} aoEscolher={escolher} anos={[atual - 1, atual, atual - 2]} />}
    >
      {(concluir, quem) => <ConteudoParecer key={exercicio} exercicio={exercicio} quem={quem} concluir={concluir} />}
    </TelaDoConselho>
  )
}

function ConteudoParecer({ exercicio, quem, concluir }: { exercicio: number; quem: Quem; concluir: Concluir }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [meses, balanco, membros] = await Promise.all([mesesDoConselho(exercicio), buscarBalanco(exercicio), membrosDoConselho()])
    if (meses.erro !== null) return meses
    if (balanco.erro !== null) return balanco
    if (membros.erro !== null) return membros
    const b = balanco.dados.balanco
    const assinaturas = b?.parecer && b.parecer_em ? await assinaturasDoParecer(b.id, b.parecer_em) : ok<Assinatura[]>([])
    if (assinaturas.erro !== null) return assinaturas
    return ok({ meses: meses.dados, balanco: b, membros: membros.dados, assinaturas: assinaturas.dados })
  })
  const concluirERecarregar: Concluir = (r, sucesso) => {
    const certo = concluir(r, sucesso)
    if (certo) recarregar()
    return certo
  }
  const nome = nomeDoExercicio(exercicio)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ meses, balanco, membros, assinaturas }) => {
        const aprovados = meses.filter(estaAprovado)
        const faltam = meses.filter((m) => !estaAprovado(m))
        const situacao = balanco?.situacao ?? null
        return (
          <>
            <section className="bloco" aria-labelledby="titulo-meses-parecer">
              <h2 id="titulo-meses-parecer">Os meses: {aprovados.length} de 12 aprovados</h2>
              <ul className="cf-meses cf-meses-pequenos" aria-label="Os meses do exercício">
                {meses.map((m) => {
                  const area = AREA_DA_SITUACAO[m.situacao]
                  return (
                    <li key={m.competencia} className={area ? `area-${area}` : 'cf-mes-futuro'}>
                      <Link to={`/conselho-fiscal/meses/${mesDoEndereco(m.competencia)}`} aria-label={`${nomeDoMes(m.competencia.slice(0, 7), true)}: ${NOME_DA_SITUACAO_MES[m.situacao]}`}>
                        <span className="cf-mes-quadro" aria-hidden="true" />
                        <span className="cf-mes-nome">{mesCurto(m.competencia)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {faltam.length > 0 && (
                <p className="aviso-texto">
                  O parecer do ano sai dos meses aprovados: {plural(faltam.length, 'mês ainda precisa', 'meses ainda precisam')} da aprovação do Conselho.
                </p>
              )}
              {quem.conselho && faltam.some((m) => precisaDoConselho(m) && Number(m.lancamentos) === 0) && (
                <BotaoSemMovimento exercicio={exercicio} concluir={concluirERecarregar} />
              )}
            </section>

            <section className="bloco" aria-labelledby="titulo-balanco-parecer" data-situacao={situacao ?? 'sem_balanco'}>
              <h2 id="titulo-balanco-parecer">O balanço e o parecer</h2>
              <p>
                <strong>{situacao ? NOME_DA_SITUACAO_BALANCO[situacao] : 'O balanço ainda não foi fechado pela tesouraria'}</strong>
                {' · '}
                <Link to={`/financeiro/prestacao?exercicio=${exercicio}`}>ver as etapas e os números na prestação de contas</Link>
              </p>
              {balanco?.parecer && (
                <>
                  <p>
                    <strong>Parecer do Conselho Fiscal: {NOME_DO_PARECER[balanco.parecer]}</strong>
                    <span className="detalhe">
                      {' '}
                      — {balanco.parecerista?.nome}, {formatarDataHora(balanco.parecer_em ?? '')}
                    </span>
                  </p>
                  <p className="texto-livre">{balanco.parecer_texto}</p>
                  <ListaAssinaturas assinaturas={assinaturas} membros={membros} />
                  {quem.conselho && situacao !== 'devolvido' && !assinaturas.some((a) => a.pessoa_id === quem.pessoaId) && (
                    <AssinarTambem balancoId={balanco.id} concluir={concluirERecarregar} />
                  )}
                </>
              )}
              {quem.conselho && situacao === 'aguardando_parecer' && balanco && (
                <FormParecerDoAno
                  balancoId={balanco.id}
                  textoInicial={textoDoParecer(nome, meses)}
                  pronto={faltam.length === 0}
                  fecheiEu={balanco.fechado?.id === quem.pessoaId}
                  concluir={concluirERecarregar}
                />
              )}
              {!quem.conselho && situacao === 'aguardando_parecer' && <p className="detalhe">O parecer é dado pelos membros do Conselho Fiscal.</p>}
            </section>
          </>
        )
      }}
    </MostrarCarga>
  )
}

function BotaoSemMovimento({ exercicio, concluir }: { exercicio: number; concluir: Concluir }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <button
      type="button"
      className="botao botao-secundario alinhar-esquerda"
      disabled={enviando}
      onClick={() =>
        void umaVez(async () => {
          const r = await aprovarMesesSemMovimento(exercicio)
          concluir(r, r.erro === null ? `${plural(r.dados, 'mês aprovado', 'meses aprovados')} sem movimento.` : '')
        })
      }
    >
      Aprovar os meses sem movimento
    </button>
  )
}

function AssinarTambem({ balancoId, concluir }: { balancoId: string; concluir: Concluir }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <button
      type="button"
      className="botao botao-secundario alinhar-esquerda"
      disabled={enviando}
      onClick={() => void umaVez(async () => concluir(await assinarParecer(balancoId), 'Você assinou o parecer do ano.'))}
    >
      Assinar também
    </button>
  )
}

function FormParecerDoAno({
  balancoId,
  textoInicial,
  pronto,
  fecheiEu,
  concluir,
}: {
  balancoId: string
  textoInicial: string
  pronto: boolean
  fecheiEu: boolean
  concluir: Concluir
}) {
  const [parecer, setParecer] = useState<TipoParecer>('favoravel')
  const [texto, setTexto] = useState(textoInicial)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  if (fecheiEu) return <p className="detalhe">Você fechou este balanço: o parecer fica com os outros membros do Conselho Fiscal.</p>
  return (
    <>
      {pronto ? (
        <form
          aria-label="Parecer do Conselho Fiscal"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => concluir(await parecerBalanco(balancoId, parecer, texto), 'Parecer do Conselho Fiscal registrado.'))
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
            <textarea required rows={7} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <p className="detalhe">O texto vem dos meses aprovados e das ressalvas; ajuste antes de assinar.</p>
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Assinar o parecer do ano
            </button>
          </div>
        </form>
      ) : (
        <p className="detalhe">O formulário do parecer aparece quando os 12 meses estiverem aprovados.</p>
      )}
      <details className="acao-recolhida">
        <summary>Devolver à tesouraria para correção</summary>
        <form
          className="form-compacto"
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => concluir(await devolverBalanco(balancoId, motivo), 'Balanço devolvido à tesouraria.'))
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
    </>
  )
}

// ---------------------------------------------------------------------
// Documentos: o parecer do ano e os pareceres dos meses, para imprimir
// ---------------------------------------------------------------------

/** /conselho-fiscal/documentos — o documento do Conselho Fiscal sobre o exercício, para imprimir ou salvar em PDF. */
export function DocumentosConselho() {
  const atual = exercicioDe(hojeIso())
  const [exercicio, escolher] = useExercicio(exercicioDoParecer())
  return (
    <TelaDoConselho
      funcao="Documentos"
      titulo="Documentos do Conselho Fiscal"
      acoes={
        <>
          <EscolhaDoExercicio exercicio={exercicio} aoEscolher={escolher} anos={[atual - 1, atual, atual - 2]} />
          <button type="button" className="botao botao-com-icone" onClick={imprimir}>
            <Icone nome="imprimir" tamanho={18} />
            Imprimir ou salvar em PDF
          </button>
        </>
      }
    >
      {() => <DocumentoDoExercicio key={exercicio} exercicio={exercicio} />}
    </TelaDoConselho>
  )
}

function DocumentoDoExercicio({ exercicio }: { exercicio: number }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [meses, balanco] = await Promise.all([mesesDoConselho(exercicio), buscarBalanco(exercicio)])
    if (meses.erro !== null) return meses
    if (balanco.erro !== null) return balanco
    const b = balanco.dados.balanco
    const assinaturas = b?.parecer && b.parecer_em ? await assinaturasDoParecer(b.id, b.parecer_em) : ok<Assinatura[]>([])
    if (assinaturas.erro !== null) return assinaturas
    return ok({ meses: meses.dados, balanco: b, assinaturas: assinaturas.dados })
  })
  const nome = nomeDoExercicio(exercicio)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ meses, balanco, assinaturas }) => (
        <article className="fin-documento" aria-label={`Documento do Conselho Fiscal sobre ${nome}`}>
          <header className="fin-documento-topo">
            <strong>COMEP — Conselho de Ministros Evangélicos de Parauapebas</strong>
            <h2>Conselho Fiscal · as contas do exercício {nome}</h2>
            <span className="detalhe">
              1º de abril de {exercicio} a 31 de março de {exercicio + 1} · emitido em {formatarData(hojeIso())}
            </span>
          </header>
          <section className="fin-documento-secao" aria-labelledby="titulo-doc-meses">
            <h3 id="titulo-doc-meses">Os pareceres dos meses</h3>
            <div className="tabela-rolagem">
              <table className="tabela-relatorio" aria-label="Os pareceres dos meses">
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col" className="col-valor">
                      Entrou
                    </th>
                    <th scope="col" className="col-valor">
                      Saiu
                    </th>
                    <th scope="col" className="col-valor">
                      Saldo no fim
                    </th>
                    <th scope="col">Parecer</th>
                    <th scope="col">Assinaturas</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.competencia}>
                      <th scope="row">{nomeDoMes(m.competencia.slice(0, 7), true)}</th>
                      <td className="col-valor">{formatarReais(m.entradas)}</td>
                      <td className="col-valor">{formatarReais(m.saidas)}</td>
                      <td className="col-valor">{formatarReais(m.saldo_fim)}</td>
                      <td>
                        {NOME_DA_SITUACAO_MES[m.situacao]}
                        {m.situacao === 'ressalva' && m.aprovacao?.ressalva && `: ${m.aprovacao.ressalva}`}
                      </td>
                      <td>{m.aprovacao && m.aprovacao.vale ? m.aprovacao.assinaturas.map((a) => a.nome).join(', ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="fin-documento-secao" aria-labelledby="titulo-doc-parecer">
            <h3 id="titulo-doc-parecer">O parecer do ano (Art. 14)</h3>
            {balanco?.parecer ? (
              <>
                <p>
                  <strong>{NOME_DO_PARECER[balanco.parecer]}</strong> · {formatarDataHora(balanco.parecer_em ?? '')}
                </p>
                <p className="texto-livre">{balanco.parecer_texto}</p>
                <p>Assinado por: {assinaturas.map((a) => `${a.nome} (${formatarDataDeInstante(a.em)})`).join('; ') || '—'}</p>
              </>
            ) : (
              <p className="vazio">O parecer do ano ainda não foi dado.</p>
            )}
            <p className="detalhe nao-imprimir">
              O balanço com os números está em <Link to={`/financeiro/prestacao/balanco?exercicio=${exercicio}`}>Financeiro › Prestação de contas › Balanço e parecer</Link>.
            </p>
          </section>
        </article>
      )}
    </MostrarCarga>
  )
}
