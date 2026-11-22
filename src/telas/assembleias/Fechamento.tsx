// O fechamento do encontro (rodada 15, asm-fechamento opção 3): a página da assembleia encerrada como painel
// executivo — os números (presentes, faltas, votações e resoluções), as resoluções protocoladas pela secretaria
// durante a reunião (número por ano), a ata e as faltas para conferir.
// Regra da rodada 30: a ata tem o RESUMO, feito e assinado no sistema, e o OFICIAL, feito no Word para o cartório,
// que não passa pelo sistema. O gerador monta o texto do oficial para copiar e colar no Word; o cabeçalho, a
// qualificação e as assinaturas ficam entre colchetes, para completar lá (os dados pessoais dos diretores não ficam
// na tela). Registrada, a ata oficial entra aqui em PDF.
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { listarAssociados } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import {
  anexarArquivoAta,
  anularResolucao,
  assinarAta,
  buscarAta,
  buscarEncontro,
  contagemQuorum,
  listaPresenca,
  listarConvidados,
  listarDeliberacoes,
  listarResolucoes,
  numeroDaResolucao,
  protocolarResolucao,
  salvarAta,
  type Ata,
  type Deliberacao,
  type EncontroCompleto,
  type Resolucao,
} from '../../dados/encontros'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { textoDaAta, textoDaAtaParaWord } from '../../utilitarios/encontros'
import { formatarDataHora } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'
import { LinkArquivo } from './Conducao'
import { CabecalhoDoEncontro, SoSecretaria } from './comum'
import { nomeCurto, quemAssinou, usePerfisDaConta } from './regras'

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, sucesso: string) => void

export function FechamentoDoEncontro() {
  const { id = '' } = useParams()
  return (
    <SoSecretaria oQue="O fechamento do encontro (resoluções e ata)">
      <ConteudoFechamento key={id} id={id} />
    </SoSecretaria>
  )
}

/** "aprovada por 31 a 2, 1 abstenção" (o resultado da votação do item, que vem do sistema). */
function resultadoDoItem(v: Deliberacao | undefined): string {
  if (!v) return 'sem votação'
  if (v.contra === 0 && v.abstencoes === 0 && v.a_favor > 0) return `${v.aprovada ? 'aprovada' : 'rejeitada'} por unanimidade`
  const abst = v.abstencoes === 0 ? '' : `, ${v.abstencoes} ${v.abstencoes === 1 ? 'abstenção' : 'abstenções'}`
  return `${v.aprovada ? 'aprovada' : 'rejeitada'} por ${v.a_favor} a ${v.contra}${abst}`
}

function ConteudoFechamento({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, lista, quorum, votos, resolucoes, ata, convidados, associados] = await Promise.all([
      buscarEncontro(id),
      listaPresenca(id),
      contagemQuorum(id),
      listarDeliberacoes(id),
      listarResolucoes(id),
      buscarAta(id),
      listarConvidados(id),
      listarAssociados(),
    ])
    if (encontro.erro !== null) return encontro
    if (lista.erro !== null) return lista
    if (quorum.erro !== null) return quorum
    if (votos.erro !== null) return votos
    if (resolucoes.erro !== null) return resolucoes
    if (ata.erro !== null) return ata
    if (convidados.erro !== null) return convidados
    if (associados.erro !== null) return associados
    return ok({
      encontro: encontro.dados,
      lista: lista.dados,
      quorum: quorum.dados,
      votos: votos.dados,
      resolucoes: resolucoes.dados,
      ata: ata.dados,
      convidados: convidados.dados,
      todos: associados.dados.map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome })),
    })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {({ encontro: e, lista, quorum, votos, resolucoes, ata, convidados, todos }) => {
        if (!e || (e.situacao !== 'convocado' && e.situacao !== 'realizado')) {
          return (
            <Aviso titulo="Encontro não encontrado">
              <p>O fechamento é dos encontros convocados (ou já realizados).</p>
            </Aviso>
          )
        }
        const assembleia = e.tipo !== 'reuniao_mensal'
        const encerrada = e.situacao === 'realizado'
        const presentes = lista.filter((l) => l.presente_em).length
        const faltas = lista.filter((l) => !l.presente_em).length
        const justificativas = lista.filter((l) => !l.presente_em && l.justificativa).length
        const paraConferir = lista.filter((l) => !l.presente_em && l.justificativa === 'pendente').length
        const aptos = e.aptos_na_instalacao ?? quorum.aptos
        const validas = resolucoes.filter((r) => !r.anulada_em)
        const algumaAssinatura = Boolean(ata?.assinada_secretario_em || ata?.assinada_presidente_em)
        const titulo = encerrada ? (assembleia ? 'A assembleia encerrada' : 'A reunião encerrada') : 'Fechamento e ata'
        return (
          <>
            <CabecalhoDoEncontro
              e={e}
              titulo={titulo}
              acoes={
                !encerrada && (
                  <Link className="botao-texto" to={`/assembleias/conducao/${e.id}`}>
                    ← Condução
                  </Link>
                )
              }
            />
            <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
            {!encerrada && (
              <p className="aviso-texto" role="status">
                A lista de presença ainda está aberta: as faltas só contam depois de encerrada (na Presença).
              </p>
            )}
            <ul className="numeros-grandes numeros-fechamento" aria-label="Os números do encontro">
              <li className="bloco">
                <span className="rotulo">Presentes</span>
                <strong className="numero-ok">{assembleia ? `${presentes} de ${aptos} aptos` : `${presentes}`}</strong>
              </li>
              <li className="bloco">
                <span className="rotulo">Faltas</span>
                <strong className={encerrada && faltas > 0 ? 'numero-atencao' : undefined}>
                  {encerrada ? `${faltas} · ${justificativas} ${justificativas === 1 ? 'justificativa' : 'justificativas'}` : '—'}
                </strong>
              </li>
              <li className="bloco">
                <span className="rotulo">Votações</span>
                <strong>{votos.length}</strong>
              </li>
              <li className="bloco">
                <span className="rotulo">Resoluções</span>
                <strong className="numero-destaque">{validas.length}</strong>
              </li>
            </ul>

            <div className="duas-colunas fechamento-colunas">
              <div className="coluna-pilha">
                <Resolucoes e={e} resolucoes={resolucoes} votos={votos} travada={algumaAssinatura} aoConcluir={concluir} />
                {assembleia && (
                  <ResumoDaAta e={e} ata={ata} votos={votos} presentes={quorum.presentes} todos={todos} aoConcluir={concluir} />
                )}
              </div>
              <div className="coluna-pilha">
                <AtaOficial e={e} ata={ata} aoConcluir={concluir} />
                <section className="bloco" aria-labelledby="titulo-faltas-conferir">
                  <h2 id="titulo-faltas-conferir">Faltas para conferir</h2>
                  <p>
                    {paraConferir === 0
                      ? 'Nenhuma justificativa esperando o 1º secretário.'
                      : `${paraConferir} ${paraConferir === 1 ? 'justificativa esperando' : 'justificativas esperando'} o 1º secretário.`}
                  </p>
                  {paraConferir > 0 && (
                    <Link className="botao-texto alinhar-esquerda" to="/assembleias/faltas">
                      Conferir as justificativas
                    </Link>
                  )}
                </section>
                {assembleia && e.instalada_em && (
                  <TextoParaWord e={e} votos={votos} resolucoes={resolucoes} convidados={convidados.map((c) => (c.quem_e ? `${c.nome} (${c.quem_e})` : c.nome))} presentes={quorum.presentes} todos={todos} />
                )}
              </div>
            </div>
          </>
        )
      }}
    </MostrarCarga>
  )
}

// ---------------------------------------------------------------------
// As resoluções: protocoladas durante a reunião, com número por ano
// ---------------------------------------------------------------------

function Resolucoes({
  e,
  resolucoes,
  votos,
  travada,
  aoConcluir,
}: {
  e: EncontroCompleto
  resolucoes: Resolucao[]
  votos: Deliberacao[]
  travada: boolean
  aoConcluir: Concluir
}) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [pautaId, setPautaId] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const daPauta = (id: string | null) => (id ? (e.pauta.find((p) => p.id === id) ?? null) : null)
  const escolhido = daPauta(pautaId || null)
  return (
    <section className="bloco" aria-labelledby="titulo-resolucoes">
      <div className="bloco-cabeca">
        <h2 id="titulo-resolucoes">Resoluções</h2>
        {!travada && (
          <button type="button" className="botao-texto" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
            + Resolução
          </button>
        )}
      </div>
      {aberto && !travada && (
        <form
          className="form-resolucao"
          aria-label="Protocolar uma resolução"
          onSubmit={(ev) => {
            ev.preventDefault()
            void umaVez(async () => {
              const r = await protocolarResolucao(e.id, texto, pautaId || null)
              aoConcluir(r, r.erro === null ? `Resolução ${numeroDaResolucao(r.dados)} protocolada.` : '')
              if (r.erro === null) {
                setTexto('')
                setPautaId('')
                setAberto(false)
              }
            })
          }}
        >
          <label>
            Item da pauta (opcional)
            <select value={pautaId} onChange={(ev) => setPautaId(ev.target.value)}>
              <option value="">Nenhum (assunto geral)</option>
              {e.pauta.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ordem}. {p.titulo}
                </option>
              ))}
            </select>
          </label>
          {escolhido && <p className="detalhe">Resultado do item: {resultadoDoItem(votos.find((v) => v.pauta_id === escolhido.id))}.</p>}
          <label>
            Texto da resolução *
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              placeholder="Ex.: Aprovada a prestação de contas de 2026."
            />
          </label>
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Protocolar a resolução
            </button>
            <button type="button" className="botao-texto" onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {resolucoes.length === 0 ? (
        <p className="vazio">Nenhuma resolução protocolada.</p>
      ) : (
        <ol className="lista-resolucoes" aria-label="Resoluções protocoladas">
          {resolucoes.map((r) => (
            <LinhaResolucao
              key={r.id}
              r={r}
              item={daPauta(r.pauta_id)}
              voto={r.pauta_id ? votos.find((v) => v.pauta_id === r.pauta_id) : undefined}
              travada={travada}
              aoConcluir={aoConcluir}
            />
          ))}
        </ol>
      )}
      <p className="detalhe">O resultado de cada votação já vem do sistema; a secretaria só escreve a resolução.</p>
    </section>
  )
}

function LinhaResolucao({
  r,
  item,
  voto,
  travada,
  aoConcluir,
}: {
  r: Resolucao
  item: { ordem: number; titulo: string } | null
  voto: Deliberacao | undefined
  travada: boolean
  aoConcluir: Concluir
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const numero = numeroDaResolucao(r)
  return (
    <li className={r.anulada_em ? 'resolucao resolucao-anulada' : 'resolucao'} aria-label={`Resolução ${numero}`}>
      <span className="resolucao-numero">{numero}</span>
      <span className="resolucao-texto">
        <strong>{r.texto}</strong>
        <span className="detalhe">
          {r.anulada_em
            ? `anulada: ${r.motivo_anulacao}`
            : item
              ? `item ${item.ordem} · ${resultadoDoItem(voto)}`
              : `protocolada às ${formatarDataHora(r.protocolada_em)}`}
        </span>
      </span>
      {!r.anulada_em && !travada && (
        <details className="acao-recolhida resolucao-anular">
          <summary>Anular</summary>
          <form
            className="form-linha"
            aria-label={`Anular a resolução ${numero}`}
            onSubmit={(ev) => {
              ev.preventDefault()
              void umaVez(async () => aoConcluir(await anularResolucao(r.id, motivo), `Resolução ${numero} anulada (o número não volta).`))
            }}
          >
            <label>
              Motivo *
              <input required minLength={3} maxLength={500} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
            </label>
            <button type="submit" className="botao botao-perigo" disabled={enviando}>
              Anular
            </button>
          </form>
        </details>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------
// A ata: o resumo (no sistema, assinado) e o oficial (Word e cartório, em PDF)
// ---------------------------------------------------------------------

function ResumoDaAta({
  e,
  ata,
  votos,
  presentes,
  todos,
  aoConcluir,
}: {
  e: EncontroCompleto
  ata: Ata | null
  votos: Deliberacao[]
  presentes: number
  todos: { pessoa_id: string; nome: string }[]
  aoConcluir: Concluir
}) {
  const perfis = usePerfisDaConta() ?? []
  const [texto, setTexto] = useState(ata?.texto ?? '')
  const [enviando, umaVez] = useUmaVez()
  const algumaAssinatura = Boolean(ata?.assinada_secretario_em || ata?.assinada_presidente_em)
  const assinada = Boolean(ata?.assinada_secretario_em && ata?.assinada_presidente_em)
  if (!e.instalada_em) {
    return (
      <section className="bloco" aria-labelledby="titulo-ata">
        <h2 id="titulo-ata">O resumo da ata</h2>
        <p className="vazio">A ata é escrita depois de instalada a assembleia.</p>
      </section>
    )
  }
  return (
    <section className="bloco" aria-labelledby="titulo-ata">
      <h2 id="titulo-ata">O resumo da ata (Art. 12, §2º, IV e §4º)</h2>
      <p className="detalhe">O resumo fica no sistema e todos os associados leem depois de assinado. O oficial é feito no Word.</p>
      {algumaAssinatura ? (
        <p className="texto-edital">{ata?.texto}</p>
      ) : (
        <form
          aria-label="Ata"
          onSubmit={(ev) => {
            ev.preventDefault()
            void umaVez(async () => aoConcluir(await salvarAta(e.id, texto), 'Ata salva.'))
          }}
        >
          <label>
            Texto da ata (o 1º secretário redige) *
            <textarea rows={12} required minLength={10} maxLength={30000} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
          </label>
          <div className="acoes">
            <button type="button" className="botao botao-secundario" onClick={() => setTexto(textoDaAta(dadosDaAta(e, votos, presentes, todos)))}>
              {texto ? 'Gerar o texto de novo (substitui o atual)' : 'Gerar o texto da ata'}
            </button>
            <button type="submit" className="botao" disabled={enviando}>
              Salvar a ata
            </button>
          </div>
        </form>
      )}
      {ata && (
        <>
          <ul className="lista-pendencias" aria-label="Assinaturas">
            <li>
              1º secretário:{' '}
              {ata.assinada_secretario_em
                ? `${quemAssinou(ata.secretario?.nome, ata.assinada_secretario_cargo)}, em ${formatarDataHora(ata.assinada_secretario_em)}`
                : 'falta assinar'}
            </li>
            <li>
              Presidente:{' '}
              {ata.assinada_presidente_em
                ? `${quemAssinou(ata.presidente?.nome, ata.assinada_presidente_cargo)}, em ${formatarDataHora(ata.assinada_presidente_em)}`
                : 'falta assinar'}
            </li>
          </ul>
          <div className="acoes">
            {!ata.assinada_secretario_em && perfis.includes('secretaria') && (
              <button
                type="button"
                className="botao"
                disabled={enviando}
                onClick={() => void umaVez(async () => aoConcluir(await assinarAta(e.id, 'secretario'), 'Ata assinada pelo 1º secretário.'))}
              >
                Assinar como 1º secretário
              </button>
            )}
            {!ata.assinada_presidente_em && perfis.includes('presidencia') && (
              <button
                type="button"
                className="botao"
                disabled={enviando}
                onClick={() => void umaVez(async () => aoConcluir(await assinarAta(e.id, 'presidente'), 'Ata assinada pelo presidente.'))}
              >
                Assinar como presidente
              </button>
            )}
          </div>
          {!algumaAssinatura && <p className="detalhe">Depois da primeira assinatura, o texto, as votações e as resoluções não mudam mais.</p>}
          {assinada && <p className="etiqueta etiqueta-ok">Ata assinada: todos os associados podem ler.</p>}
        </>
      )}
    </section>
  )
}

function dadosDaAta(e: EncontroCompleto, votos: Deliberacao[], presentes: number, todos: { pessoa_id: string; nome: string }[]) {
  return {
    tipo: e.tipo,
    inicio: e.inicio,
    local: e.local,
    chamada: e.chamada,
    aptos: e.aptos_na_instalacao,
    presentesAptos: e.presentes_aptos_na_instalacao,
    // a conta da instalação (a lista pode ter mudado depois)
    presentes: e.presentes_na_instalacao ?? presentes,
    pauta: e.pauta,
    votos: votos.map((v) => ({
      ...v,
      desligado: v.desligamento_pessoa_id ? (todos.find((a) => a.pessoa_id === v.desligamento_pessoa_id)?.nome ?? null) : null,
    })),
  }
}

/** O gerador do texto da ata oficial, para copiar e colar no Word. */
function TextoParaWord({
  e,
  votos,
  resolucoes,
  convidados,
  presentes,
  todos,
}: {
  e: EncontroCompleto
  votos: Deliberacao[]
  resolucoes: Resolucao[]
  convidados: string[]
  presentes: number
  todos: { pessoa_id: string; nome: string }[]
}) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const texto = textoDaAtaParaWord({ ...dadosDaAta(e, votos, presentes, todos), resolucoes, convidados })
  return (
    <section className="bloco" aria-labelledby="titulo-word">
      <h2 id="titulo-word">O texto da ata oficial, para o Word</h2>
      <p className="detalhe">
        Copie e cole no Word. O cabeçalho, a qualificação de quem assina e o que o cartório pede ficam entre colchetes, para
        completar lá: os dados pessoais dos diretores não passam pelo sistema.
      </p>
      <textarea className="texto-para-word" readOnly rows={10} value={texto} aria-label="Texto da ata oficial para o Word" />
      <div className="acoes">
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() =>
            void navigator.clipboard
              .writeText(texto)
              .then(() => setCopiado('Texto copiado: cole no Word.'))
              .catch(() => setCopiado('Não deu para copiar sozinho: selecione o texto e copie.'))
          }
        >
          <Icone nome="copiar" tamanho={18} />
          Copiar o texto
        </button>
        {copiado && (
          <span className="detalhe" role="status">
            {copiado}
          </span>
        )}
      </div>
    </section>
  )
}

/** A ata oficial (feita no Word, assinada e registrada no cartório): aqui fica só o PDF. */
function AtaOficial({ e, ata, aoConcluir }: { e: EncontroCompleto; ata: Ata | null; aoConcluir: Concluir }) {
  const [enviando, umaVez] = useUmaVez()
  const assinada = Boolean(ata?.assinada_secretario_em && ata?.assinada_presidente_em)
  const assembleia = e.tipo !== 'reuniao_mensal'
  return (
    <section className="bloco" aria-labelledby="titulo-ata-oficial">
      <h2 id="titulo-ata-oficial">A ata</h2>
      {!assembleia ? (
        <p className="detalhe">A reunião mensal não tem ata no sistema: as decisões ficam nas resoluções.</p>
      ) : ata?.arquivo_caminho ? (
        <div className="arquivo-ata">
          <span className="arquivo-ata-icone" aria-hidden="true">
            PDF
          </span>
          <span>
            <strong>Ata da {nomeCurto(e)}</strong>
            <span className="detalhe">anexada · a ata oficial, registrada</span>
          </span>
          <LinkArquivo caminho={ata.arquivo_caminho} />
        </div>
      ) : assinada ? (
        <>
          <p className="detalhe">A ata oficial é feita no Word, assinada e registrada no cartório. Aqui fica só o PDF.</p>
          <label className="botao botao-secundario botao-arquivo alinhar-esquerda">
            {enviando ? 'Enviando…' : 'Anexar a ata oficial em PDF'}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="somente-leitor"
              disabled={enviando}
              onChange={(ev) => {
                const arquivo = ev.target.files?.[0]
                ev.target.value = ''
                if (!arquivo) return
                void umaVez(async () => {
                  const pronto = await prepararComprovante(arquivo)
                  if ('erro' in pronto) return aoConcluir({ erro: pronto.erro }, '')
                  aoConcluir(await anexarArquivoAta(e.id, pronto.blob, pronto.extensao), 'Ata oficial anexada.')
                })
              }}
            />
          </label>
        </>
      ) : (
        <p className="detalhe">
          A ata oficial é feita no Word e registrada no cartório. O PDF entra aqui depois que o resumo for assinado pelo 1º secretário e
          pelo presidente.
        </p>
      )}
    </section>
  )
}
