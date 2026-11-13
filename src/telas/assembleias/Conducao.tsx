// Fase 4.3 — Condução da assembleia (secretaria e presidência): quórum de instalação, votações (com o
// desligamento do Art. 8º) e a ata, assinada pelo 1º secretário e pelo presidente.
// Também mostra, para todos com login, o resultado das votações e a ata assinada (ResultadoDaAssembleia).
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import {
  anexarArquivoAta,
  assinarAta,
  buscarAta,
  buscarEncontro,
  contagemQuorum,
  instalarAssembleia,
  linkArquivoAta,
  listarDeliberacoes,
  NOME_DA_MAIORIA,
  NOME_DO_INCISO,
  registrarVotacao,
  salvarAta,
  type Ata,
  type Deliberacao,
  type EncontroCompleto,
  type IncisoDesligamento,
  type ItemDaPauta,
} from '../../dados/encontros'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarDataHora } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'
import { dataPorExtenso, explicarMaioria, quorumPrimeiraChamada, textoDaAta } from '../../utilitarios/encontros'

type Retorno = { sucesso?: string; erro?: string }

function usePerfis() {
  const { estado } = useSessao()
  return estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
}

const horaDe = (instante: string) =>
  new Date(instante).toLocaleTimeString('pt-BR', { timeZone: 'America/Belem', hour: '2-digit', minute: '2-digit' })

// ---------------------------------------------------------------------
// /assembleias/:id/conducao
// ---------------------------------------------------------------------

export function ConducaoAssembleia() {
  const { id = '' } = useParams()
  return <ConteudoConducao key={id} id={id} />
}

function ConteudoConducao({ id }: { id: string }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, quorum, votos, ata, associados] = await Promise.all([
      buscarEncontro(id),
      contagemQuorum(id),
      listarDeliberacoes(id),
      buscarAta(id),
      listarAssociados(),
    ])
    if (encontro.erro !== null) return encontro
    if (quorum.erro !== null) return quorum
    if (votos.erro !== null) return votos
    if (ata.erro !== null) return ata
    if (associados.erro !== null) return associados
    return ok({
      encontro: encontro.dados,
      quorum: quorum.dados,
      votos: votos.dados,
      ata: ata.dados,
      associados: associados.dados.filter((a) => a.situacao === 'ativo').map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome })),
      todos: associados.dados.map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome })),
    })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const [enviando, umaVez] = useUmaVez()
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
      <p className="nao-imprimir">
        <Link to={`/assembleias/${id}`}>← Voltar à assembleia</Link>
      </p>
      <h1>Condução da assembleia</h1>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ encontro: e, quorum, votos, ata, associados, todos }) => {
          if (!e || e.tipo === 'reuniao_mensal') {
            return (
              <Aviso titulo="Assembleia não encontrada">
                <p>A condução (quórum, votações e ata) é das assembleias ordinárias e extraordinárias.</p>
              </Aviso>
            )
          }
          const assinada = Boolean(ata?.assinada_secretario_em && ata.assinada_presidente_em)
          const minimo = quorumPrimeiraChamada(quorum.aptos)
          return (
            <>
              <p>
                <strong>{e.titulo}</strong> — {dataPorExtenso(e.inicio)}
              </p>

              {/* 1. Quórum */}
              <section className="painel" aria-labelledby="titulo-quorum">
                <h2 id="titulo-quorum">1. Quórum de instalação (Art. 16, §4º)</h2>
                {e.instalada_em ? (
                  <p>
                    <span className="etiqueta etiqueta-ok">Instalada em {e.chamada === 'primeira' ? '1ª' : '2ª'} chamada</span> às{' '}
                    {horaDe(e.instalada_em)}, com {e.presentes_aptos_na_instalacao} associados aptos presentes, de{' '}
                    {e.aptos_na_instalacao} aptos.
                  </p>
                ) : (
                  <>
                    <dl className="definicoes" aria-label="Quórum agora">
                      <dt>Aptos (ativos e em dia)</dt>
                      <dd>{quorum.aptos}</dd>
                      <dt>Presentes</dt>
                      <dd>
                        {quorum.presentes} ({quorum.presentes_aptos} aptos)
                      </dd>
                      <dt>1ª chamada precisa de</dt>
                      <dd>{minimo} aptos presentes (metade mais um)</dd>
                    </dl>
                    <p className="detalhe">
                      Sem quórum, a 2ª chamada é com qualquer número, passados os minutos das regras (60). Marque as presenças na{' '}
                      <Link to={`/assembleias/${e.id}/presenca`}>lista de presença</Link>.
                    </p>
                    {e.situacao === 'convocado' && (
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
                    )}
                    <button type="button" className="botao-texto" onClick={recarregar}>
                      Atualizar a contagem
                    </button>
                  </>
                )}
              </section>

              {/* 2. Votações */}
              <section className="painel" aria-labelledby="titulo-votacoes">
                <h2 id="titulo-votacoes">2. Votações</h2>
                <p className="detalhe">
                  Votam só os presentes em dia (Art. 11): hoje, {quorum.presentes_aptos}. Nas maiorias de 3/5 e 2/3, a conta é sobre os
                  presentes aptos (pergunta 24 do PROJETO.md).
                </p>
                {e.pauta.filter((p) => p.deliberativo).length === 0 && <p className="vazio">Nenhum item desta pauta vai a votação.</p>}
                {e.pauta
                  .filter((p) => p.deliberativo)
                  .map((p) => (
                    <Votacao
                      key={p.id}
                      e={e}
                      item={p}
                      voto={votos.find((v) => v.pauta_id === p.id) ?? null}
                      associados={associados}
                      todos={todos}
                      bloqueada={!e.instalada_em || assinada}
                      aoConcluir={concluir}
                    />
                  ))}
              </section>

              {/* 3. Ata */}
              <SecaoAta e={e} ata={ata} votos={votos} quorum={quorum} todos={todos} aoConcluir={concluir} />
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function Votacao({
  e,
  item,
  voto,
  associados,
  todos,
  bloqueada,
  aoConcluir,
}: {
  e: EncontroCompleto
  item: ItemDaPauta
  voto: Deliberacao | null
  associados: { pessoa_id: string; nome: string }[]
  todos: { pessoa_id: string; nome: string }[]
  bloqueada: boolean
  aoConcluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [aFavor, setAFavor] = useState('')
  const [contra, setContra] = useState('')
  const [abstencoes, setAbstencoes] = useState('0')
  const [desligar, setDesligar] = useState('')
  const [inciso, setInciso] = useState<IncisoDesligamento>('II')
  const [observacao, setObservacao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const podeDesligar = e.tipo === 'ago' && item.maioria === 'tres_quintos'
  const travadaPorDesligamento = Boolean(voto?.desligamento_pessoa_id && voto.aprovada)
  const desligado = voto?.desligamento_pessoa_id ? todos.find((a) => a.pessoa_id === voto.desligamento_pessoa_id)?.nome : null
  return (
    <article className="votacao" aria-label={`Votação: ${item.titulo}`}>
      <h3>
        {item.ordem}. {item.titulo}
      </h3>
      <p className="detalhe">Maioria exigida: {item.maioria ? NOME_DA_MAIORIA[item.maioria] : '—'}</p>
      {voto && (
        <p>
          <span className={voto.aprovada ? 'etiqueta etiqueta-ok' : 'etiqueta etiqueta-atraso'}>{voto.aprovada ? 'Aprovado' : 'Rejeitado'}</span>{' '}
          {voto.a_favor} a favor, {voto.contra} contra, {voto.abstencoes} abstenções — exigido: {explicarMaioria(voto.maioria, voto.votantes)}.
          {desligado && voto.aprovada && ` Desligado(a): ${desligado} (Art. 8º, ${voto.desligamento_inciso}).`}
        </p>
      )}
      {!bloqueada && !travadaPorDesligamento && (
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
                desligamentoPessoaId: desligar || null,
                desligamentoInciso: desligar ? inciso : null,
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
          {podeDesligar && (
            <>
              <label>
                Desligamento do associado (Art. 8º)
                <select value={desligar} onChange={(ev) => setDesligar(ev.target.value)}>
                  <option value="">Não é desligamento</option>
                  {associados.map((a) => (
                    <option key={a.pessoa_id} value={a.pessoa_id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
              {desligar && (
                <label>
                  Motivo (Art. 8º)
                  <select value={inciso} onChange={(ev) => setInciso(ev.target.value as IncisoDesligamento)}>
                    {(['I', 'II', 'III', 'IV'] as const).map((i) => (
                      <option key={i} value={i}>
                        {NOME_DO_INCISO[i]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <label>
            Observação
            <input maxLength={1000} value={observacao} onChange={(ev) => setObservacao(ev.target.value)} />
          </label>
          <button type="submit" className="botao" disabled={enviando}>
            {voto ? 'Corrigir a votação' : 'Registrar a votação'}
          </button>
        </form>
      )}
      {travadaPorDesligamento && <p className="detalhe">Esta votação desligou um associado e não muda mais.</p>}
    </article>
  )
}

function SecaoAta({
  e,
  ata,
  votos,
  quorum,
  todos,
  aoConcluir,
}: {
  e: EncontroCompleto
  ata: Ata | null
  votos: Deliberacao[]
  quorum: { presentes: number }
  todos: { pessoa_id: string; nome: string }[]
  aoConcluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const perfis = usePerfis()
  const [texto, setTexto] = useState(ata?.texto ?? '')
  const [enviando, umaVez] = useUmaVez()
  const algumaAssinatura = Boolean(ata?.assinada_secretario_em || ata?.assinada_presidente_em)
  const assinada = Boolean(ata?.assinada_secretario_em && ata?.assinada_presidente_em)
  if (!e.instalada_em) {
    return (
      <section className="painel" aria-labelledby="titulo-ata">
        <h2 id="titulo-ata">3. Ata</h2>
        <p className="vazio">A ata é escrita depois de instalada a assembleia.</p>
      </section>
    )
  }
  return (
    <section className="painel" aria-labelledby="titulo-ata">
      <h2 id="titulo-ata">3. Ata (Art. 12, §2º, IV e §4º)</h2>
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
            <textarea rows={14} required minLength={10} maxLength={30000} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
          </label>
          <div className="acoes">
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() =>
                setTexto(
                  textoDaAta({
                    tipo: e.tipo,
                    inicio: e.inicio,
                    local: e.local,
                    chamada: e.chamada,
                    aptos: e.aptos_na_instalacao,
                    presentesAptos: e.presentes_aptos_na_instalacao,
                    presentes: quorum.presentes,
                    pauta: e.pauta,
                    votos: votos.map((v) => ({
                      ...v,
                      desligado: v.desligamento_pessoa_id ? (todos.find((a) => a.pessoa_id === v.desligamento_pessoa_id)?.nome ?? null) : null,
                    })),
                  }),
                )
              }
            >
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
              {ata.assinada_secretario_em ? `${ata.secretario?.nome ?? '—'}, em ${formatarDataHora(ata.assinada_secretario_em)}` : 'falta assinar'}
            </li>
            <li>
              Presidente:{' '}
              {ata.assinada_presidente_em ? `${ata.presidente?.nome ?? '—'}, em ${formatarDataHora(ata.assinada_presidente_em)}` : 'falta assinar'}
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
            <ArquivoAta e={e} ata={ata} aoConcluir={aoConcluir} />
          </div>
          {!algumaAssinatura && <p className="detalhe">Depois da primeira assinatura, o texto não muda mais.</p>}
          {assinada && <p className="etiqueta etiqueta-ok">Ata assinada: todos os associados podem ler.</p>}
        </>
      )}
    </section>
  )
}

function ArquivoAta({ e, ata, aoConcluir }: { e: EncontroCompleto; ata: Ata; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <>
      {ata.arquivo_caminho && <LinkArquivo caminho={ata.arquivo_caminho} />}
      <label className="botao botao-secundario botao-arquivo">
        {enviando ? 'Enviando…' : ata.arquivo_caminho ? 'Trocar o arquivo da ata assinada' : 'Anexar a ata assinada no papel (PDF ou foto)'}
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
              aoConcluir(await anexarArquivoAta(e.id, pronto.blob, pronto.extensao), 'Arquivo da ata anexado.')
            })
          }}
        />
      </label>
    </>
  )
}

function LinkArquivo({ caminho }: { caminho: string }) {
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
                  Assinada pelo 1º secretário ({ata.secretario?.nome}) e pelo presidente ({ata.presidente?.nome}).
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
