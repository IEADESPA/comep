// A condução do encontro ao vivo (secretaria e presidência). Telas novas, parte 14 (asm-conducao: o painel da
// opção 1, o roteiro da opção 3 e o telão da opção 2, juntos):
//   * o roteiro: a abertura (introdução, oração e oportunidade), as pautas do edital, as que chegaram no período
//     (a secretaria junta) e o encerramento; o item de agora vai para o telão;
//   * a votação do item de agora: pelo celular dos presentes (on-line) ou contada à mão, com o resultado;
//   * o quórum (instalar a assembleia) e os convidados (não votam e não contam no quórum).
// O telão (Telao.tsx) é a tela para a TV ou o projetor; os controles ficam aqui, no celular ou no computador.
// Também mostra, para todos com login, o resultado das votações e a ata assinada (ResultadoDaAssembleia).
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { Chip } from '../../componentes/Telas'
import { listarAssociados } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import {
  arquivarConvidado,
  avancarRoteiro,
  buscarAta,
  buscarEncontro,
  contagemQuorum,
  incluirNaPauta,
  instalarAssembleia,
  linkArquivoAta,
  listarConvidados,
  listarDeliberacoes,
  NOME_DA_MAIORIA,
  NOME_DO_INCISO,
  registrarConvidado,
  registrarVotacao,
  salvarAberturaDoRoteiro,
  type Convidado,
  type Deliberacao,
  type EncontroCompleto,
  type ItemDaPauta,
  type Maioria,
} from '../../dados/encontros'
import {
  abrirVotacao,
  encerrarVotacao,
  resultadoVotacao,
  salvarVotacao,
  votacoesDoEncontro,
  type VotacaoDoItem,
} from '../../dados/votacoes'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { explicarMaioria, oQueMudaNaConducao } from '../../utilitarios/encontros'
import { CabecalhoDoEncontro, CartaoQuorum, SoSecretaria } from './comum'
import { horaDe, itensDoRoteiro, quemAssinou, useAtualizarACada, votacaoDoItem } from './regras'

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, sucesso: string) => void

/** Os endereços antigos (/assembleias/:id/conducao) levam ao novo. */
export function ConducaoEnderecoAntigo() {
  const { id = '' } = useParams()
  return <Navigate to={`/assembleias/conducao/${id}`} replace />
}

// ---------------------------------------------------------------------
// /assembleias/conducao/:id — ao vivo
// ---------------------------------------------------------------------

export function ConducaoDoEncontro() {
  const { id = '' } = useParams()
  return (
    <SoSecretaria oQue="A condução do encontro (roteiro, quórum, votações e convidados)">
      <ConteudoConducao key={id} id={id} />
    </SoSecretaria>
  )
}

function ConteudoConducao({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, quorum, votos, ata, associados, votacoes, convidados] = await Promise.all([
      buscarEncontro(id),
      contagemQuorum(id),
      listarDeliberacoes(id),
      buscarAta(id),
      listarAssociados(),
      votacoesDoEncontro(id),
      listarConvidados(id),
    ])
    if (encontro.erro !== null) return encontro
    if (quorum.erro !== null) return quorum
    if (votos.erro !== null) return votos
    if (ata.erro !== null) return ata
    if (associados.erro !== null) return associados
    if (votacoes.erro !== null) return votacoes
    if (convidados.erro !== null) return convidados
    return ok({
      encontro: encontro.dados,
      quorum: quorum.dados,
      votos: votos.dados,
      ata: ata.dados,
      todos: associados.dados.map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome })),
      votacoes: votacoes.dados,
      convidados: convidados.dados,
    })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  // a contagem do quórum e os votos pelo celular mudam sozinhos
  useAtualizarACada(recarregar, 10)
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ encontro: e, quorum, votos, ata, todos, votacoes, convidados }) => {
        if (!e || (e.situacao !== 'convocado' && e.situacao !== 'realizado')) {
          return (
            <Aviso titulo="Encontro não encontrado">
              <p>A condução é dos encontros convocados (ou já realizados).</p>
            </Aviso>
          )
        }
        const assembleia = e.tipo !== 'reuniao_mensal'
        // depois da primeira assinatura da ata, nada do que entra no texto dela muda (as mesmas travas do banco)
        const muda = oQueMudaNaConducao(e, ata)
        const roteiro = itensDoRoteiro(e)
        const atual = roteiro.find((i) => i.chave === e.roteiro_atual) ?? null
        const mexer = (item: string | null, sucesso: string) => void umaVez(async () => concluir(await avancarRoteiro(e.id, item), sucesso))
        return (
          <div className="tela-nova">
            <CabecalhoDoEncontro
              e={e}
              titulo="Ao vivo"
              acoes={
                <>
                  <Link className="botao botao-secundario botao-com-icone" to={`/assembleias/telao/${e.id}`} target="_blank" rel="noreferrer">
                    <Icone nome="telao" tamanho={18} />
                    Abrir o telão
                  </Link>
                  <Link className="botao-texto" to={`/assembleias/fechamento/${e.id}`}>
                    Fechamento e ata →
                  </Link>
                </>
              }
            />
            <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
            {/* No computador: o roteiro, o item de agora e o quórum, em três colunas. No celular (desenho do celular): o
                quórum e o item de agora primeiro, depois o roteiro e os convidados (a ordem fica no estilos.css) */}
            <div className="conducao-colunas">
              {/* 1. O roteiro */}
              <section className="bloco conducao-roteiro" aria-labelledby="titulo-roteiro">
                <h2 id="titulo-roteiro">Roteiro</h2>
                <ol className="roteiro" aria-label="Roteiro">
                  {roteiro.map((item, i) => {
                    const posicaoAtual = atual ? roteiro.indexOf(atual) : -1
                    const estado = item === atual ? 'agora' : posicaoAtual > i ? 'feito' : 'a-seguir'
                    const voto = item.pauta ? votos.find((v) => v.pauta_id === item.pauta!.id) : undefined
                    return (
                      <li key={item.chave} className={`roteiro-item roteiro-${estado}`} aria-current={estado === 'agora' ? 'step' : undefined}>
                        <button
                          type="button"
                          className="roteiro-botao"
                          disabled={enviando || estado === 'agora' || !muda.roteiro}
                          aria-label={`${estado === 'agora' ? 'Agora' : 'Ir para'}: ${item.numero ? `${item.numero}. ` : ''}${item.titulo}`}
                          onClick={() => mexer(item.chave, `Agora: ${item.titulo}.`)}
                        >
                          <span className="roteiro-marca" aria-hidden="true">
                            {estado === 'feito' ? <Icone nome="check" tamanho={16} traco={2.6} /> : (item.numero ?? '•')}
                          </span>
                          <span className="roteiro-texto">
                            <span>{item.titulo}</span>
                            <span className="roteiro-detalhe">
                              {item.pauta?.origem === 'periodo' && <Chip area="eventos">chegou no período</Chip>}
                              {item.pauta?.deliberativo && !voto && <Chip area="assembleias">votação</Chip>}
                              {voto && <Chip area={voto.aprovada ? 'financas' : 'pessoas'}>{voto.aprovada ? 'aprovado' : 'rejeitado'}</Chip>}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
                {muda.travadoPelaAta ? (
                  <p className="detalhe">A ata já começou a ser assinada: o roteiro e os convidados não mudam mais.</p>
                ) : (
                  muda.roteiro && (
                    <div className="acoes">
                      {(() => {
                        const posicao = atual ? roteiro.indexOf(atual) : -1
                        const proximo = roteiro[posicao + 1]
                        return proximo ? (
                          <button type="button" className="botao" disabled={enviando} onClick={() => mexer(proximo.chave, `Agora: ${proximo.titulo}.`)}>
                            {atual ? 'Próximo item' : 'Começar o roteiro'}
                          </button>
                        ) : null
                      })()}
                    </div>
                  )
                )}
                {muda.pauta && <JuntarPauta e={e} aoConcluir={concluir} />}
                {muda.abertura && <AjustarAbertura e={e} aoConcluir={concluir} />}
              </section>

              {/* 2. A votação do item de agora */}
              <div className="coluna-pilha conducao-agora">
                {!atual ? (
                  <section className="bloco" aria-labelledby="titulo-agora">
                    <h2 id="titulo-agora">Agora</h2>
                    <p className="vazio">Comece o roteiro: o item de agora aparece aqui e no telão.</p>
                  </section>
                ) : !atual.pauta ? (
                  <section className="bloco" aria-labelledby="titulo-agora">
                    <p className="rotulo">Agora</p>
                    <h2 id="titulo-agora">{atual.titulo}</h2>
                    <p className="detalhe">{atual.chave === 'encerramento' ? 'Encerramento do encontro.' : 'Abertura do encontro.'}</p>
                  </section>
                ) : !atual.pauta.deliberativo ? (
                  <section className="bloco" aria-labelledby="titulo-agora">
                    <p className="rotulo">Agora · item {atual.numero}</p>
                    <h2 id="titulo-agora">{atual.titulo}</h2>
                    <p className="detalhe">
                      {assembleia ? 'Este item não vai a votação.' : 'A reunião mensal não tem votação: o que for decidido vira resolução.'}
                    </p>
                    <Link className="botao-texto alinhar-esquerda" to={`/assembleias/fechamento/${e.id}`}>
                      Protocolar uma resolução
                    </Link>
                  </section>
                ) : (
                  <CartaoVotacao
                    key={atual.pauta.id}
                    e={e}
                    item={atual.pauta}
                    voto={votos.find((v) => v.pauta_id === atual.pauta!.id) ?? null}
                    votacao={votacaoDoItem(votacoes, atual.pauta.id)}
                    todos={todos}
                    bloqueio={
                      !e.instalada_em
                        ? 'Instale a assembleia (quórum) antes da votação.'
                        : !muda.votacoes
                          ? 'A ata já começou a ser assinada: as votações não mudam mais.'
                          : null
                    }
                    aoConcluir={concluir}
                  />
                )}
              </div>

              {/* 3. O quórum e os convidados */}
              <div className="coluna-pilha conducao-lado">
                <div className="coluna-pilha conducao-quorum">
                  <CartaoQuorum e={e} quorum={quorum} />
                  {assembleia && !e.instalada_em && e.situacao === 'convocado' && (
                    <div className="acoes">
                      <button
                        type="button"
                        className="botao"
                        disabled={enviando}
                        onClick={() =>
                          void umaVez(async () => {
                            const r = await instalarAssembleia(e.id)
                            concluir(r, r.erro === null ? `Assembleia instalada em ${r.dados.chamada === 'primeira' ? '1ª' : '2ª'} chamada.` : '')
                          })
                        }
                      >
                        Instalar a assembleia
                      </button>
                      <Link className="botao-texto" to={`/assembleias/presenca/${e.id}`}>
                        Presença
                      </Link>
                    </div>
                  )}
                  {assembleia && !e.instalada_em && e.segunda_chamada_minutos !== null && (
                    <p className="detalhe">
                      Sem quórum, a 2ª chamada é com qualquer número, a partir das{' '}
                      {horaDe(new Date(new Date(e.inicio).getTime() + e.segunda_chamada_minutos * 60_000).toISOString())}.
                    </p>
                  )}
                </div>
                <Convidados convidados={convidados} registrar={muda.registrarConvidado} tirar={muda.tirarConvidado} e={e} aoConcluir={concluir} />
              </div>
            </div>
          </div>
        )
      }}
    </MostrarCarga>
  )
}

function JuntarPauta({ e, aoConcluir }: { e: EncontroCompleto; aoConcluir: Concluir }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [deliberativo, setDeliberativo] = useState(false)
  const [maioria, setMaioria] = useState<Maioria>('simples')
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>+ Pauta que chegou no período</summary>
      <form
        aria-label="Pauta que chegou no período"
        onSubmit={(ev) => {
          ev.preventDefault()
          void umaVez(async () => {
            const r = await incluirNaPauta(e.id, { titulo, descricao, deliberativo, maioria: deliberativo ? maioria : null })
            aoConcluir(r, `Pauta juntada ao roteiro: ${titulo.trim()}.`)
            if (r.erro === null) {
              setTitulo('')
              setDescricao('')
              setDeliberativo(false)
            }
          })
        }}
      >
        <label>
          Assunto *
          <input required maxLength={300} value={titulo} onChange={(ev) => setTitulo(ev.target.value)} />
        </label>
        <label>
          De onde veio (opcional)
          <input maxLength={2000} value={descricao} onChange={(ev) => setDescricao(ev.target.value)} placeholder="Ex.: pedido de um associado" />
        </label>
        {e.tipo === 'ago' ? (
          <>
            <label className="caixa-marcar">
              <input type="checkbox" checked={deliberativo} onChange={(ev) => setDeliberativo(ev.target.checked)} />
              Vai a votação
            </label>
            {deliberativo && (
              <label>
                Maioria exigida
                <select value={maioria} onChange={(ev) => setMaioria(ev.target.value as Maioria)}>
                  {(Object.keys(NOME_DA_MAIORIA) as Maioria[]).map((m) => (
                    <option key={m} value={m}>
                      {NOME_DA_MAIORIA[m]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        ) : (
          <p className="detalhe">
            {e.tipo === 'age'
              ? 'Na AGE, só vai a votação o que estava no edital: a pauta nova entra como informe.'
              : 'A reunião mensal não tem votação: a pauta entra como informe, e a decisão vira resolução.'}
          </p>
        )}
        <button type="submit" className="botao" disabled={enviando}>
          Juntar ao roteiro
        </button>
      </form>
    </details>
  )
}

function AjustarAbertura({ e, aoConcluir }: { e: EncontroCompleto; aoConcluir: Concluir }) {
  const [texto, setTexto] = useState(e.roteiro_abertura.join('\n'))
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Ajustar a abertura</summary>
      <form
        aria-label="A abertura do roteiro"
        onSubmit={(ev) => {
          ev.preventDefault()
          void umaVez(async () =>
            aoConcluir(await salvarAberturaDoRoteiro(e.id, texto.split('\n').map((l) => l.trim()).filter(Boolean)), 'Abertura do roteiro salva.'),
          )
        }}
      >
        <label>
          Um item por linha (antes da pauta)
          <textarea rows={4} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
        </label>
        <button type="submit" className="botao botao-secundario" disabled={enviando}>
          Salvar a abertura
        </button>
      </form>
    </details>
  )
}

function Convidados({
  e,
  convidados,
  registrar,
  tirar,
  aoConcluir,
}: {
  e: EncontroCompleto
  convidados: Convidado[]
  /** pode registrar convidado novo / tirar da lista (oQueMudaNaConducao) */
  registrar: boolean
  tirar: boolean
  aoConcluir: Concluir
}) {
  const [nome, setNome] = useState('')
  const [quemE, setQuemE] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="bloco" aria-labelledby="titulo-convidados">
      <h2 id="titulo-convidados">Convidados</h2>
      {convidados.length === 0 ? (
        <p className="vazio">Nenhum convidado registrado.</p>
      ) : (
        <ul className="lista-convidados" aria-label="Convidados">
          {convidados.map((c) => (
            <li key={c.id}>
              <span>
                <strong>{c.nome}</strong>
                {c.quem_e && <span className="detalhe"> · {c.quem_e}</span>}
              </span>
              {tirar && (
                <button
                  type="button"
                  className="botao-texto"
                  aria-label={`Tirar ${c.nome}`}
                  disabled={enviando}
                  onClick={() => void umaVez(async () => aoConcluir(await arquivarConvidado(c.id), `${c.nome} saiu da lista de convidados.`))}
                >
                  Tirar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="detalhe">Convidados não votam e não contam no quórum.</p>
      {registrar && (
        <form
          className="form-linha"
          aria-label="Registrar convidado"
          onSubmit={(ev) => {
            ev.preventDefault()
            void umaVez(async () => {
              const r = await registrarConvidado(e.id, nome, quemE)
              aoConcluir(r, `Convidado registrado: ${nome.trim()}.`)
              if (r.erro === null) {
                setNome('')
                setQuemE('')
              }
            })
          }}
        >
          <label>
            Nome do convidado *
            <input required minLength={2} maxLength={150} value={nome} onChange={(ev) => setNome(ev.target.value)} />
          </label>
          <label>
            Quem é
            <input maxLength={150} value={quemE} onChange={(ev) => setQuemE(ev.target.value)} placeholder="Ex.: Vereador" />
          </label>
          <button type="submit" className="botao botao-secundario" disabled={enviando}>
            + Convidado
          </button>
        </form>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// A votação do item de agora: pelo celular (on-line) ou contada à mão
// ---------------------------------------------------------------------

function CartaoVotacao({
  e,
  item,
  voto,
  votacao,
  todos,
  bloqueio,
  aoConcluir,
}: {
  e: EncontroCompleto
  item: ItemDaPauta
  voto: Deliberacao | null
  votacao: VotacaoDoItem | null
  todos: { pessoa_id: string; nome: string }[]
  /** por que a votação não pode acontecer agora (null = pode) */
  bloqueio: string | null
  aoConcluir: Concluir
}) {
  const [aMao, setAMao] = useState(false)
  const [secreta, setSecreta] = useState(true)
  const [enviando, umaVez] = useUmaVez()
  const nomeDe = (id: string) => todos.find((a) => a.pessoa_id === id)?.nome ?? 'associado indicado na pauta'
  const alvo = item.desligamento_pessoa_id ?? null
  const jubilando = item.jubilacao_pessoa_id ? nomeDe(item.jubilacao_pessoa_id) : null
  // aprovado, o desligamento ou a jubilação não se refazem
  const travada = Boolean(voto?.aprovada && (voto.desligamento_pessoa_id || item.jubilacao_pessoa_id))
  const desligado = voto?.desligamento_pessoa_id ? nomeDe(voto.desligamento_pessoa_id) : null
  const aberta = votacao?.situacao === 'aberta'

  async function abrirPeloCelular() {
    const criada = await salvarVotacao(null, {
      tipo: 'votacao',
      titulo: item.titulo,
      descricao: '',
      encontro_id: e.id,
      pauta_id: item.id,
      quem_vota: 'presentes',
      secreta,
      max_escolhas: 1,
      maioria: item.maioria,
      // no voto aberto, a parcial aparece no telão
      parcial_visivel: !secreta,
      fecha_em: '',
      opcoes: [],
    })
    if (criada.erro !== null) return aoConcluir(criada, '')
    aoConcluir(await abrirVotacao(criada.dados), 'Votação aberta: os presentes em dia votam pelo celular.')
  }

  return (
    <article className="bloco cartao-votacao" aria-label={`Votação: ${item.titulo}`}>
      <div className="cartao-votacao-topo">
        <span>
          <p className="rotulo">Agora · item {item.ordem}</p>
          <h2>Votação: {item.titulo}</h2>
        </span>
        {aberta && votacao?.aberta_em && <Chip area="eventos">aberta desde {horaDe(votacao.aberta_em)}</Chip>}
      </div>
      <p className="detalhe">Maioria exigida: {item.maioria ? NOME_DA_MAIORIA[item.maioria] : '—'}</p>
      {alvo && (
        <p className="detalhe">
          Desligamento de <strong>{nomeDe(alvo)}</strong> — {NOME_DO_INCISO.II} (Art. 8º): aprovado, o associado sai do COMEP e perde o
          acesso de ministro.
        </p>
      )}
      {jubilando && (
        <p className="detalhe">
          Jubilação de <strong>{jubilando}</strong>: aprovada, o associado fica jubilado — isento da contribuição; vota, mas não pode ser
          votado (14/11/2026).
        </p>
      )}
      {voto && (
        <p>
          <span className={voto.aprovada ? 'etiqueta etiqueta-ok' : 'etiqueta etiqueta-atraso'}>{voto.aprovada ? 'Aprovado' : 'Rejeitado'}</span>{' '}
          {voto.a_favor} a favor, {voto.contra} contra, {voto.abstencoes} abstenções — exigido:{' '}
          {explicarMaioria(voto.maioria, voto.a_favor + voto.contra)}.
          {desligado && voto.aprovada && ` Desligado(a): ${desligado} (Art. 8º, ${voto.desligamento_inciso}).`}
          {jubilando && voto.aprovada && ` Jubilado(a): ${jubilando}.`}
        </p>
      )}
      {aberta && votacao && <ParcialAoVivo votacaoId={votacao.id} aoConcluir={aoConcluir} />}
      {votacao?.situacao === 'rascunho' && !bloqueio && (
        <p className="detalhe">
          Há uma votação em preparo para este item: <Link to={`/votacoes/${votacao.id}`}>abrir ou ajustar</Link>.
        </p>
      )}
      {bloqueio && !travada && <p className="detalhe">{bloqueio}</p>}
      {travada && <p className="detalhe">Esta votação {jubilando ? 'jubilou' : 'desligou'} um associado e não muda mais.</p>}
      {!bloqueio && !travada && !aberta && votacao?.situacao !== 'rascunho' && (
        <>
          <div className="acoes">
            <button type="button" className="botao" disabled={enviando} onClick={() => void umaVez(abrirPeloCelular)}>
              {voto ? 'Votar de novo pelo celular' : 'Abrir a votação pelo celular'}
            </button>
            <button type="button" className="botao botao-secundario" aria-expanded={aMao} onClick={() => setAMao((v) => !v)}>
              Contar à mão
            </button>
          </div>
          <label className="caixa-marcar">
            <input type="checkbox" checked={secreta} onChange={(ev) => setSecreta(ev.target.checked)} />
            Voto secreto (ninguém vê a parcial nem quem votou em quê)
          </label>
          {aMao && <ContarAMao item={item} voto={voto} alvo={alvo} aoConcluir={aoConcluir} />}
        </>
      )}
    </article>
  )
}

/** Os votos pelo celular, enquanto a votação está aberta (a parcial só no voto aberto). */
function ParcialAoVivo({ votacaoId, aoConcluir }: { votacaoId: string; aoConcluir: Concluir }) {
  const [carga, recarregar] = useCarregar(() => resultadoVotacao(votacaoId))
  const [enviando, umaVez] = useUmaVez()
  useAtualizarACada(recarregar, 4)
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(r) =>
        r ? (
          <>
            {r.mostra_contagem && <BarrasDaVotacao opcoes={r.opcoes} />}
            <p className="detalhe" role="status">
              {r.votantes} de {r.aptos} votantes em dia já votaram pelo celular.
            </p>
            <button
              type="button"
              className="botao alinhar-esquerda"
              disabled={enviando}
              onClick={() =>
                void umaVez(async () => {
                  const fim = await encerrarVotacao(votacaoId)
                  aoConcluir(fim, fim.erro === null ? `Votação apurada: ${fim.dados.aprovada ? 'aprovado' : 'rejeitado'}.` : '')
                })
              }
            >
              Encerrar e apurar
            </button>
          </>
        ) : null
      }
    </MostrarCarga>
  )
}

/** As barras de A favor, Contra e Abstenção (a condução e o telão). */
export function BarrasDaVotacao({ opcoes }: { opcoes: { id: string; texto: string; papel: string | null; votos: number | null }[] }) {
  const total = Math.max(1, opcoes.reduce((s, o) => s + (o.votos ?? 0), 0))
  return (
    <ul className="barras-votacao" aria-label="Votos até agora">
      {opcoes.map((o) => (
        <li key={o.id} className={`barra-${o.papel ?? 'opcao'}`}>
          <span className="barras-votacao-linha">
            <span>{o.texto}</span>
            <strong>{o.votos ?? 0}</strong>
          </span>
          <span className="barras-votacao-trilho" aria-hidden="true">
            <span style={{ width: `${Math.round(((o.votos ?? 0) / total) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function ContarAMao({
  item,
  voto,
  alvo,
  aoConcluir,
}: {
  item: ItemDaPauta
  voto: Deliberacao | null
  alvo: string | null
  aoConcluir: Concluir
}) {
  const [aFavor, setAFavor] = useState('')
  const [contra, setContra] = useState('')
  const [abstencoes, setAbstencoes] = useState('0')
  const [observacao, setObservacao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <form
      className="form-linha"
      aria-label={`Registrar votação: ${item.titulo}`}
      onSubmit={(ev) => {
        ev.preventDefault()
        void umaVez(async () => {
          const r = await registrarVotacao(item.id, {
            aFavor: Number(aFavor),
            contra: Number(contra),
            abstencoes: Number(abstencoes),
            desligamentoPessoaId: alvo,
            // só a conduta vai à votação (14/11/2026)
            desligamentoInciso: alvo ? 'II' : null,
            observacao,
          })
          aoConcluir(r, r.erro === null ? `Votação registrada: ${r.dados.aprovada ? 'aprovado' : 'rejeitado'}.` : '')
        })
      }}
    >
      <label className="campo-curto">
        A favor *
        <input type="number" min={0} required value={aFavor} onChange={(ev) => setAFavor(ev.target.value)} />
      </label>
      <label className="campo-curto">
        Contra *
        <input type="number" min={0} required value={contra} onChange={(ev) => setContra(ev.target.value)} />
      </label>
      <label className="campo-curto">
        Abstenções
        <input type="number" min={0} required value={abstencoes} onChange={(ev) => setAbstencoes(ev.target.value)} />
      </label>
      <label>
        Observação
        <input maxLength={1000} value={observacao} onChange={(ev) => setObservacao(ev.target.value)} />
      </label>
      <button type="submit" className="botao" disabled={enviando}>
        {voto ? 'Corrigir a votação' : 'Registrar a votação'}
      </button>
    </form>
  )
}

export function LinkArquivo({ caminho }: { caminho: string }) {
  const [link, setLink] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    void linkArquivoAta(caminho).then((l) => ativo && setLink(l))
    return () => {
      ativo = false
    }
  }, [caminho])
  return link ? (
    <a className="botao botao-secundario" href={link} target="_blank" rel="noreferrer">
      Abrir a ata assinada (arquivo)
    </a>
  ) : null
}

// ---------------------------------------------------------------------
// Para todos com login, na página do encontro: o resultado das votações e a ata assinada
// ---------------------------------------------------------------------

export function ResultadoDaAssembleia({ e }: { e: EncontroCompleto }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [votos, ata] = await Promise.all([listarDeliberacoes(e.id), buscarAta(e.id)])
    if (votos.erro !== null) return votos
    if (ata.erro !== null) return ata
    return ok({ votos: votos.dados, ata: ata.dados })
  })
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ votos, ata }) => {
        const assinada = ata && ata.assinada_secretario_em && ata.assinada_presidente_em
        if (votos.length === 0 && !assinada) return null
        return (
          <section className="painel" aria-labelledby="titulo-resultado">
            <h2 id="titulo-resultado">Resultado</h2>
            {votos.length > 0 && (
              <ul className="lista-pendencias" aria-label="Votações">
                {e.pauta
                  .filter((p) => votos.some((v) => v.pauta_id === p.id))
                  .map((p) => {
                    const v = votos.find((x) => x.pauta_id === p.id)!
                    return (
                      <li key={p.id}>
                        {p.ordem}. {p.titulo}: <strong>{v.aprovada ? 'aprovado' : 'rejeitado'}</strong> ({v.a_favor} a favor, {v.contra} contra,{' '}
                        {v.abstencoes} abstenções)
                      </li>
                    )
                  })}
              </ul>
            )}
            {assinada && ata && (
              <>
                <h3>Ata</h3>
                <p className="texto-edital">{ata.texto}</p>
                <p className="detalhe">
                  Assinada por {quemAssinou(ata.secretario?.nome, ata.assinada_secretario_cargo)} e por{' '}
                  {quemAssinou(ata.presidente?.nome, ata.assinada_presidente_cargo)}.
                </p>
                {ata.arquivo_caminho && <LinkArquivo caminho={ata.arquivo_caminho} />}
              </>
            )}
          </section>
        )
      }}
    </MostrarCarga>
  )
}
