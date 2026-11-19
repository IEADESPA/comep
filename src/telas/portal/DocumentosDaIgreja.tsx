import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mensagem } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { AbasDaTela, Chip, Selo, type Aba } from '../../componentes/Telas'
import type { Igreja } from '../../dados/cadastros'
import {
  DOCUMENTOS_DA_REGULARIDADE,
  enviarDocumentoIgreja,
  NOME_DA_NATUREZA,
  NOME_DO_DOCUMENTO,
  type DocumentoIgreja,
  type MembroDiretoriaIgreja,
  type NaturezaJuridica,
  type SituacaoIgreja,
  type TipoDocumentoIgreja,
} from '../../dados/igrejas'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { diasEntre, documentoDoItem, listaCurta, MANDE_AQUI, menorMandato, somarDias, tempoQueFalta, textoDoPrazo } from '../../utilitarios/regularizacao'
import { EscolherArquivos, FormDiretoria, FormDocumento, LinhaDocumento, PartesDoDocumento, type ArquivoEscolhido, type Concluir } from '../igrejas/componentes'
import {
  diretoriaEmVigor,
  diretoriaInicial,
  documentosDoTipo,
  faltaNaDiretoria,
  membrosDaDiretoria,
  resumoDoDocumento,
  type EstadoDiretoria,
  type OpcaoMinistro,
} from '../igrejas/regras'

// Minha igreja (o pastor presidente), parte 6 das telas novas (aprovado nas rodadas 12 a 14, 18/11/2026):
//   * Documentos em cartões, com a validade e a barra do prazo (opção 2); o cartão abre a página do documento, em
//     abas: O atual, Atualizar (o passo a passo do envio antecipado: o novo entra sozinho no dia certo) e Histórico;
//   * a igreja suspensa: o caminho de volta, com a contagem dos 30 dias (opção 3).

export type DadosDaMinhaIgreja = {
  igreja: Igreja
  situacao: SituacaoIgreja
  documentos: DocumentoIgreja[]
  diretoria: MembroDiretoriaIgreja[]
  ministros: OpcaoMinistro[]
}

const DICA = 'Mande o documento novo antes de vencer: ele fica guardado e entra sozinho no dia certo, e a igreja não fica nenhum dia suspensa.'

function FaixaDica() {
  return (
    <p className="faixa-resultado faixa-ok">
      <strong>Dica de governança</strong>
      <span>{DICA}</span>
    </p>
  )
}

/** A parte do período que já passou (para a barra do prazo). */
function quantoPassou(d: DocumentoIgreja, hoje: string): number {
  if (!d.valido_de || !d.valido_ate) return 0
  const total = Math.max(1, diasEntre(d.valido_de, d.valido_ate))
  return Math.min(100, Math.max(0, Math.round((diasEntre(d.valido_de, hoje) * 100) / total)))
}

// ---------------------------------------------------------------------
// Documentos: os cartões
// ---------------------------------------------------------------------

export function CartoesDocumentos({ dados, concluir }: { dados: DadosDaMinhaIgreja; concluir: Concluir }) {
  const hoje = hojeIso()
  const { igreja, documentos, diretoria, ministros } = dados
  const outros = documentos.filter((d) => d.tipo === 'outro')
  return (
    <section className="aba-conteudo" aria-labelledby="titulo-docs-cartoes">
      <h3 id="titulo-docs-cartoes" className="somente-leitor">
        Documentos da igreja
      </h3>
      <ul className="cartoes-docs" aria-label="Documentos da igreja">
        {DOCUMENTOS_DA_REGULARIDADE.map((tipo) => {
          const { atual, proximo, esperando, recusado } = documentosDoTipo(documentos, tipo, hoje)
          const comPrazo = tipo === 'ata_diretoria' || tipo === 'alvara'
          const restam = atual?.valido_ate ? diasEntre(hoje, atual.valido_ate) : null
          const perto = restam !== null && restam <= 60
          return (
            <li key={tipo}>
              <Link to={`/minha-igreja/documentos/${tipo}`} className="cartao-doc" aria-label={NOME_DO_DOCUMENTO[tipo]}>
                <span className="cartao-doc-topo">
                  <strong>{NOME_DO_DOCUMENTO[tipo]}</strong>
                  {atual ? (
                    <Selo tipo="aprovado">Conferido</Selo>
                  ) : esperando ? (
                    <Selo tipo="analise">Esperando a conferência</Selo>
                  ) : recusado ? (
                    <Selo tipo="recusado">Recusado</Selo>
                  ) : (
                    <Selo tipo="recusado">Falta mandar</Selo>
                  )}
                </span>
                <span className="detalhe">{atual ? resumoDoDocumento(atual) : recusado ? `Recusado: ${recusado.motivo_recusa ?? ''}` : 'ainda não veio'}</span>
                {comPrazo && atual?.valido_ate && (
                  <>
                    <span className="barra-prazo" aria-hidden="true">
                      <span className={perto ? 'perto' : undefined} style={{ width: `${quantoPassou(atual, hoje)}%` }} />
                    </span>
                    <span className={perto ? 'texto-atencao' : 'texto-ok'}>
                      {perto ? textoDoPrazo(hoje, atual.valido_ate) : `faltam ${tempoQueFalta(hoje, atual.valido_ate)}`}
                    </span>
                  </>
                )}
                {!comPrazo && atual && <span className="detalhe">Não tem validade. Só troca se mudar.</span>}
                {proximo ? (
                  <span className="cartao-doc-proximo">
                    <Icone nome="check" tamanho={16} traco={2.6} /> O próximo já foi conferido: entra sozinho em {formatarData(proximo.valido_de)}.
                  </span>
                ) : esperando && atual ? (
                  <span className="cartao-doc-proximo espera">O próximo está com a secretaria, esperando a conferência.</span>
                ) : null}
                <span className="link-forte">
                  {comPrazo ? (atual ? 'Mandar o próximo (antes de vencer)' : 'Mandar agora') : atual ? 'Ver o documento' : 'Mandar agora'}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="detalhe">
        Os avisos dos vencimentos chegam a você, pastor presidente, pelo sino: 60 e 30 dias antes. A responsabilidade é sua; a
        secretaria não acompanha os prazos. Vencido, a igreja fica suspensa no mesmo dia.
      </p>
      <section className="bloco" aria-labelledby="titulo-outros-docs">
        <h2 id="titulo-outros-docs">Outros documentos</h2>
        {outros.length === 0 ? (
          <p className="vazio">Nenhum outro documento.</p>
        ) : (
          <ul className="lista-linhas" aria-label="Outros documentos">
            {outros.map((d) => (
              <LinhaDocumento key={d.id} d={d} podeConferir={false} aoConcluir={concluir} />
            ))}
          </ul>
        )}
        <details className="acao-recolhida">
          <summary>Mandar outro documento</summary>
          <FormDocumento
            igrejaId={igreja.id}
            tipoFixo="outro"
            naturezaDaIgreja={igreja.natureza_juridica}
            ministros={ministros}
            diretoriaAtual={diretoriaEmVigor(documentos, diretoria).membros}
            textoBotao="Mandar para a secretaria conferir"
            aoConcluir={(r, s) => concluir(r, `${s} A secretaria vai conferir.`)}
          />
        </details>
      </section>
    </section>
  )
}

// ---------------------------------------------------------------------
// A página do documento: O atual, Atualizar (o próximo) e Histórico
// ---------------------------------------------------------------------

const ABAS_DOC = (tipo: string): Aba[] => [
  { para: `/minha-igreja/documentos/${tipo}`, nome: 'O atual', curto: 'Atual' },
  { para: `/minha-igreja/documentos/${tipo}/atualizar`, nome: 'Atualizar (próximo)', curto: 'Atualizar' },
  { para: `/minha-igreja/documentos/${tipo}/historico`, nome: 'Histórico' },
]

export function PaginaDocumento({ tipo, parte, dados, concluir }: { tipo: TipoDocumentoIgreja; parte: string; dados: DadosDaMinhaIgreja; concluir: Concluir }) {
  const hoje = hojeIso()
  const { atual, proximo, esperando, todos } = documentosDoTipo(dados.documentos, tipo, hoje)
  return (
    <>
      <p className="trilha">
        <Link to="/minha-igreja/documentos">← Documentos</Link>
      </p>
      <div className="cabecalho-funcao">
        <div className="cabecalho-funcao-texto">
          <span className="cabecalho-funcao-modulo">Minha igreja › Documentos</span>
          <h1>{NOME_DO_DOCUMENTO[tipo]}</h1>
        </div>
      </div>
      <AbasDaTela rotulo="Partes do documento" abas={ABAS_DOC(tipo)} />
      {parte === 'atualizar' ? (
        <AtualizarDocumento key={tipo} tipo={tipo} dados={dados} atual={atual} concluir={concluir} />
      ) : parte === 'historico' ? (
        <section className="aba-conteudo" aria-label="Histórico">
          {todos.length === 0 ? (
            <p className="vazio">Nenhum documento deste tipo ainda.</p>
          ) : (
            <ul className="bloco lista-linhas" aria-label="Histórico do documento">
              {todos.map((d) => {
                const rotulo =
                  d.situacao === 'pendente'
                    ? 'Esperando a conferência'
                    : d.situacao === 'recusado'
                      ? 'Recusado'
                      : d.id === atual?.id
                        ? 'Em vigor'
                        : (d.valido_de ?? '') > hoje
                          ? 'Próximo'
                          : 'Anterior'
                return (
                  <li key={d.id}>
                    <span className="linha-corpo">
                      <strong>{d.valido_ate ? `${formatarData(d.valido_de)} a ${formatarData(d.valido_ate)}` : `Enviado em ${formatarDataDeInstante(d.criado_em)}`}</strong>
                      <span>
                        {resumoDoDocumento(d)} · <PartesDoDocumento d={d} />
                      </span>
                    </span>
                    <Chip area={rotulo === 'Em vigor' ? 'financas' : rotulo === 'Recusado' ? 'pessoas' : rotulo === 'Anterior' ? 'assembleias' : 'eventos'}>{rotulo}</Chip>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="detalhe">Nada se apaga: os documentos anteriores ficam guardados.</p>
        </section>
      ) : (
        <section className="aba-conteudo" aria-label="O atual">
          <section className="bloco" aria-labelledby="titulo-doc-atual">
            <div className="cabecalho-bloco">
              <h2 id="titulo-doc-atual">{tipo === 'ata_diretoria' ? 'Ata da diretoria em vigor' : `${NOME_DO_DOCUMENTO[tipo]} em vigor`}</h2>
              {atual?.valido_ate ? (
                <Chip area={diasEntre(hoje, atual.valido_ate) <= 60 ? 'eventos' : 'financas'}>{textoDoPrazo(hoje, atual.valido_ate)}</Chip>
              ) : atual ? (
                <Chip area="financas">em dia</Chip>
              ) : null}
            </div>
            {atual ? (
              <dl className="definicoes">
                {atual.valido_ate && (
                  <>
                    <dt>{tipo === 'ata_diretoria' ? 'Mandato' : 'Vale'}</dt>
                    <dd>
                      de {formatarData(atual.valido_de)} a {formatarData(atual.valido_ate)}
                    </dd>
                  </>
                )}
                {atual.natureza && (
                  <>
                    <dt>Natureza</dt>
                    <dd>{NOME_DA_NATUREZA[atual.natureza]}</dd>
                  </>
                )}
                <dt>Conferido em</dt>
                <dd>{formatarDataDeInstante(atual.conferido_em)}</dd>
                <dt>Arquivo</dt>
                <dd>
                  <PartesDoDocumento d={atual} />
                </dd>
              </dl>
            ) : (
              <p className="vazio">Nenhum {NOME_DO_DOCUMENTO[tipo].toLowerCase()} valendo hoje.</p>
            )}
            {esperando && (
              <p className="linha-selo">
                <Selo tipo="analise">Mandado em {formatarDataDeInstante(esperando.criado_em)}: esperando a conferência</Selo>
              </p>
            )}
            {proximo && (
              <p className="faixa-resultado faixa-ok">
                <strong>O próximo já foi conferido</strong>
                <span>
                  Vale de {formatarData(proximo.valido_de)} a {formatarData(proximo.valido_ate)} e entra sozinho em {formatarData(proximo.valido_de)}.
                </span>
              </p>
            )}
          </section>
          <section className="bloco" aria-labelledby="titulo-tem-proximo">
            <h2 id="titulo-tem-proximo">
              {tipo === 'ata_diretoria' ? 'Já tem a ata da próxima diretoria?' : tipo === 'alvara' ? 'Já tem o alvará do próximo ano?' : 'Mudou o documento?'}
            </h2>
            <p className="detalhe">{tipo === 'ata_diretoria' || tipo === 'alvara' ? DICA : 'Mande o novo: a secretaria confere e o anterior fica no histórico.'}</p>
            <Link to={`/minha-igreja/documentos/${tipo}/atualizar`} className="botao botao-secundario">
              Atualizar o documento
            </Link>
          </section>
        </section>
      )}
    </>
  )
}

/** O fim do ano da data (o alvará vale até 31/12). */
const fimDoAno = (data: string) => `${data.slice(0, 4)}-12-31`

/** Atualizar (o próximo): o passo a passo — o arquivo, as datas novas (ou a natureza) e conferir e mandar. */
function AtualizarDocumento({
  tipo,
  dados,
  atual,
  concluir,
}: {
  tipo: TipoDocumentoIgreja
  dados: DadosDaMinhaIgreja
  atual: DocumentoIgreja | undefined
  concluir: Concluir
}) {
  const navigate = useNavigate()
  const hoje = hojeIso()
  const comDatas = tipo === 'ata_diretoria' || tipo === 'alvara'
  const passos = comDatas ? ['O arquivo', 'As datas novas', 'Conferir e mandar'] : tipo === 'cartao_cnpj' ? ['O arquivo', 'A natureza', 'Conferir e mandar'] : ['O arquivo', 'Conferir e mandar']
  // o novo começa no dia seguinte ao fim do atual (ou hoje, se não há um valendo)
  const inicio = atual?.valido_ate && atual.valido_ate >= hoje ? somarDias(atual.valido_ate, 1) : hoje
  const [passo, setPasso] = useState(0)
  const [arquivos, setArquivos] = useState<ArquivoEscolhido[]>([])
  const [validoDe, setValidoDe] = useState(inicio)
  const [validoAte, setValidoAte] = useState(fimDoAno(inicio))
  const [natureza, setNatureza] = useState<NaturezaJuridica>('organizacao_religiosa')
  const [mudaNatureza, setMudaNatureza] = useState(false)
  const [diretoria, setDiretoria] = useState<EstadoDiretoria>(() => ({ ...diretoriaInicial(diretoriaEmVigor(dados.documentos, dados.diretoria).membros), posse: inicio }))
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const titulo = useRef<HTMLHeadingElement>(null)
  const membros = membrosDaDiretoria(diretoria)
  const ate = tipo === 'ata_diretoria' ? menorMandato(membros) : validoAte
  const de = tipo === 'ata_diretoria' ? membros.reduce((m, x) => (x.inicio < m ? x.inicio : m), membros[0]?.inicio ?? inicio) : validoDe
  const nomeDoPasso = passos[passo]

  function falta(): string | null {
    if (nomeDoPasso === 'O arquivo' && arquivos.length === 0) return 'Escolha o arquivo do documento.'
    if (nomeDoPasso === 'As datas novas') {
      if (tipo === 'ata_diretoria') return faltaNaDiretoria(diretoria)
      if (!validoDe || !validoAte || validoAte < validoDe) return 'Informe de quando até quando o alvará vale.'
      if (validoAte < hoje) return 'Este alvará já venceu: mande o que vale agora ou o do próximo ano.'
    }
    return null
  }

  function ir(n: number) {
    setPasso(n)
    setErro(null)
    setTimeout(() => titulo.current?.focus(), 0)
  }

  async function mandar() {
    const r = await enviarDocumentoIgreja(
      dados.igreja.id,
      {
        tipo,
        valido_de: tipo === 'alvara' ? validoDe : undefined,
        valido_ate: tipo === 'alvara' ? validoAte : undefined,
        natureza: tipo === 'cartao_cnpj' ? natureza : undefined,
        muda_natureza: tipo === 'ata_diretoria' ? mudaNatureza : undefined,
        diretoria: tipo === 'ata_diretoria' ? membros : undefined,
      },
      arquivos,
    )
    if (r.erro !== null) return setErro(r.erro)
    const mensagem = `${NOME_DO_DOCUMENTO[tipo]}: enviado. A secretaria vai conferir.`
    concluir(r, mensagem)
    navigate(`/minha-igreja/documentos/${tipo}`, { state: { mensagem } })
  }

  return (
    <form
      className="cadastro-passo aba-conteudo"
      aria-label={`Atualizar: ${NOME_DO_DOCUMENTO[tipo]}`}
      onSubmit={(e) => {
        e.preventDefault()
        const f = falta()
        if (f) return setErro(f)
        if (passo < passos.length - 1) ir(passo + 1)
        else void umaVez(mandar)
      }}
    >
      {comDatas && <FaixaDica />}
      <ol className="passos-cadastro so-computador" aria-label="Passos do envio">
        {passos.map((nome, i) => (
          <li key={nome} className={i < passo ? 'feito' : undefined} aria-current={i === passo ? 'step' : undefined}>
            <span className="numero-passo" aria-hidden="true">
              {i < passo ? <Icone nome="check" tamanho={16} traco={3} /> : i + 1}
            </span>
            {nome}
          </li>
        ))}
      </ol>
      <section className="bloco">
        <h2 ref={titulo} tabIndex={-1}>
          {passo + 1} · {nomeDoPasso}
        </h2>
        {nomeDoPasso === 'O arquivo' && <EscolherArquivos arquivos={arquivos} aoMudar={setArquivos} />}
        {nomeDoPasso === 'As datas novas' && tipo === 'alvara' && (
          <div className="grade-form">
            <label>
              Vale a partir de *
              <input type="date" value={validoDe} onChange={(e) => setValidoDe(e.target.value)} />
            </label>
            <label>
              Vale até *
              <input type="date" min={validoDe || undefined} value={validoAte} onChange={(e) => setValidoAte(e.target.value)} />
            </label>
          </div>
        )}
        {nomeDoPasso === 'As datas novas' && tipo === 'ata_diretoria' && (
          <>
            <FormDiretoria estado={diretoria} aoMudar={setDiretoria} ministros={dados.ministros} />
            {dados.igreja.natureza_juridica === 'associacao_privada' && (
              <label className="caixa-marcar">
                <input type="checkbox" checked={mudaNatureza} onChange={(e) => setMudaNatureza(e.target.checked)} />
                Esta ata muda a natureza para organização religiosa
              </label>
            )}
          </>
        )}
        {nomeDoPasso === 'A natureza' && (
          <fieldset className="opcoes-radio">
            <legend>Natureza jurídica (como está no Cartão CNPJ)</legend>
            {(Object.keys(NOME_DA_NATUREZA) as NaturezaJuridica[]).map((n) => (
              <label key={n} className="caixa-marcar">
                <input type="radio" name="natureza-atualizar" checked={natureza === n} onChange={() => setNatureza(n)} />
                {NOME_DA_NATUREZA[n]}
              </label>
            ))}
          </fieldset>
        )}
        {nomeDoPasso === 'Conferir e mandar' && (
          <>
            <p>
              {arquivos.length === 1 ? '1 arquivo' : `${arquivos.length} arquivos (partes)`}: {arquivos.map((a) => a.nome).join(', ')}.
            </p>
            {comDatas && de && ate && (
              <p className="faixa-resultado faixa-ok" role="status">
                <strong>
                  {tipo === 'ata_diretoria' ? 'A diretoria nova' : 'O alvará novo'} vale de {formatarData(de)} a {formatarData(ate)}
                </strong>
                <span>
                  {de > hoje
                    ? `Fica guardado e entra sozinho em ${formatarData(de)}, quando o atual termina.`
                    : 'Conferido pela secretaria, ele já vale.'}
                </span>
              </p>
            )}
            {tipo === 'cartao_cnpj' && <p>Natureza: {NOME_DA_NATUREZA[natureza]}.</p>}
          </>
        )}
      </section>
      <Mensagem erro={erro} />
      <div className="botoes-passo">
        {passo > 0 ? (
          <button type="button" className="botao botao-secundario" onClick={() => ir(passo - 1)}>
            ← {passos[passo - 1]}
          </button>
        ) : (
          <Link to={`/minha-igreja/documentos/${tipo}`} className="botao botao-secundario">
            Cancelar
          </Link>
        )}
        <button type="submit" className="botao" disabled={enviando}>
          {passo < passos.length - 1 ? `Continuar → ${passos[passo + 1]}` : enviando ? 'Enviando…' : 'Mandar para a secretaria conferir'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// A diretoria (vai com a ata)
// ---------------------------------------------------------------------

export function DiretoriaDaMinhaIgreja({ dados, concluir }: { dados: DadosDaMinhaIgreja; concluir: Concluir }) {
  const { igreja, documentos, diretoria, ministros } = dados
  const { vigente, proxima, membros } = diretoriaEmVigor(documentos, diretoria)
  const esperando = documentos.filter((d) => d.tipo === 'ata_diretoria' && d.situacao === 'pendente')
  return (
    <section className="aba-conteudo" aria-labelledby="titulo-diretoria-minha-igreja">
      <h3 id="titulo-diretoria-minha-igreja" className="somente-leitor">
        Diretoria da igreja
      </h3>
      <section className="bloco" aria-label="Diretoria em vigor">
        <h2>Diretoria em vigor</h2>
        {membros.length === 0 ? (
          <p className="vazio">A diretoria da igreja ainda não foi informada com a ata.</p>
        ) : (
          <ul className="lista-linhas" aria-label="Diretoria da igreja">
            {membros.map((m) => (
              <li key={m.id}>
                <span className="linha-corpo">
                  <strong>{m.cargo}</strong>
                  <span>{m.nome}</span>
                </span>
                {m.pessoa_id ? <Chip area="pessoas">ministro da igreja</Chip> : <Chip area="assembleias">nome completo</Chip>}
                {m.fim && <span className="detalhe">até {formatarData(m.fim)}</span>}
              </li>
            ))}
          </ul>
        )}
        {vigente && (
          <p className="detalhe">
            Mandato de {formatarData(vigente.valido_de)} a {formatarData(vigente.valido_ate)}: vale o menor mandato. Vencido sem a ata nova, a
            igreja fica suspensa no mesmo dia.
          </p>
        )}
        {proxima && <p className="detalhe">A próxima diretoria já foi conferida: entra sozinha em {formatarData(proxima.valido_de)}.</p>}
        {esperando.length > 0 && (
          <p className="linha-selo">
            <Selo tipo="analise">Ata nova esperando a secretaria</Selo>
          </p>
        )}
      </section>
      <details className="acao-recolhida">
        <summary>{membros.length > 0 ? 'Mandar a ata nova, com a diretoria' : 'Informar a diretoria (com a ata)'}</summary>
        <FormDocumento
          igrejaId={igreja.id}
          tipoFixo="ata_diretoria"
          naturezaDaIgreja={igreja.natureza_juridica}
          ministros={ministros}
          diretoriaAtual={membros}
          textoBotao="Mandar para a secretaria conferir"
          aoConcluir={(r) => concluir(r, 'Ata e diretoria enviadas: a secretaria vai conferir.')}
        />
      </details>
      <p className="detalhe">
        Já tem a ata da próxima diretoria? <Link to="/minha-igreja/documentos/ata_diretoria/atualizar">Mande antes de vencer</Link>: ela entra
        sozinha quando a atual termina.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------
// A igreja suspensa: o caminho de volta (opção 3 da rodada 12)
// ---------------------------------------------------------------------

export function IgrejaSuspensa({ dados, concluir }: { dados: DadosDaMinhaIgreja; concluir: Concluir }) {
  const hoje = hojeIso()
  const { igreja, situacao, documentos, diretoria } = dados
  const vencidos = situacao.vencidos
  const prazo = situacao.prazo_ate ?? hoje
  const dias = Math.max(0, diasEntre(hoje, prazo) + 1)
  const mandados = vencidos.map((v) => ({ item: v, esperando: documentosDoTipo(documentos, documentoDoItem(v), hoje).esperando }))
  const tudoMandado = mandados.every((m) => m.esperando)
  const venceuEm = situacao.suspensa_desde ? formatarData(somarDias(situacao.suspensa_desde, -1)) : ''
  // as opções da ata: os ministros que já estão na diretoria (suspensa, a lista dos ministros da igreja não abre)
  const ministros: OpcaoMinistro[] = diretoria.filter((m) => m.pessoa_id).map((m) => ({ pessoa_id: m.pessoa_id!, nome: m.nome }))
  const passos = [
    { nome: `Mande ${listaCurta(vencidos)}`, sub: tudoMandado ? 'mandado' : 'agora', feito: tudoMandado, agora: !tudoMandado },
    { nome: 'A secretaria confere', sub: 'em até 3 dias úteis', feito: false, agora: tudoMandado },
    { nome: 'A igreja volta a ser regular', sub: 'tudo se libera de novo', feito: false, agora: false },
  ]
  return (
    <>
      <div className="cabecalho-nova">
        <h1>Para a igreja voltar a ser regular</h1>
        <p className="sub-tela">
          {igreja.nome} · suspensa desde {formatarData(situacao.suspensa_desde)}, porque {listaCurta(vencidos)} {vencidos.length === 1 ? 'venceu' : 'venceram'} em {venceuEm}.
        </p>
      </div>
      <section className="bloco" aria-label="O caminho de volta">
        <ol className="passos passos-linha">
          {passos.map((p, i) => (
            <li key={p.nome} className={`passo passo-${p.feito ? 'feito' : p.agora ? 'agora' : 'depois'}`}>
              <span className="passo-bola" aria-hidden="true">
                {p.feito ? <Icone nome="check" tamanho={18} traco={3} /> : i + 1}
              </span>
              <span className="passo-texto">
                <strong>{p.nome}</strong>
                <span>{p.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <div className="duas-colunas">
        <div className="coluna-atalhos">
          {mandados.map(({ item, esperando }) => (
            <section key={item} className="bloco zona-mande" aria-label={`Mande aqui ${MANDE_AQUI[item]}`}>
              <h2>
                <Icone nome="enviar" tamanho={22} /> Mande aqui {MANDE_AQUI[item]}
              </h2>
              {esperando ? (
                <p className="linha-selo">
                  <Selo tipo="analise">Recebido em {formatarDataDeInstante(esperando.criado_em)}: a secretaria está conferindo</Selo>
                </p>
              ) : (
                <FormDocumento
                  igrejaId={igreja.id}
                  tipoFixo={documentoDoItem(item)}
                  naturezaDaIgreja={igreja.natureza_juridica}
                  ministros={ministros}
                  diretoriaAtual={diretoriaEmVigor(documentos, diretoria).membros}
                  textoBotao="Mandar para a secretaria conferir"
                  aoConcluir={(r, s) => concluir(r, `${s} A secretaria vai conferir.`)}
                />
              )}
            </section>
          ))}
        </div>
        <div className="coluna-atalhos">
          <section className="bloco contagem-dias" aria-label="Os dias para mandar">
            <strong>{dias}</strong>
            <span>{dias === 1 ? 'dia para mandar' : 'dias para mandar'}</span>
            <span className="detalhe">até {formatarData(prazo)}</span>
          </section>
          <section className="bloco" aria-labelledby="titulo-por-que">
            <h2 id="titulo-por-que">Por que suspendeu</h2>
            <p className="detalhe">
              {vencidos.includes('ata_diretoria')
                ? 'Sem ata válida, a igreja não tem diretoria que responda por ela. Hoje há meios rápidos de registrar uma ata nova.'
                : vencidos.includes('alvara')
                  ? 'Sem o alvará de licenciamento (que inclui os bombeiros e a vigilância sanitária), a igreja não está regular diante da prefeitura.'
                  : 'Falta um documento que deixa a igreja regular.'}
            </p>
          </section>
          <section className="bloco" aria-labelledby="titulo-enquanto">
            <h2 id="titulo-enquanto">Enquanto isso</h2>
            <ul className="lista-limites" aria-label="O que está bloqueado">
              {[
                ['Empréstimos do patrimônio', 'bloqueados'],
                ['Pedidos e correções dos ministros', 'bloqueados'],
                ['O contato e as filiais da igreja', 'bloqueados'],
                ['O seu perfil de pastor presidente', `bloqueado em ${formatarData(somarDias(prazo, 1))}, se o documento não chegar`],
              ].map(([t, s]) => (
                <li key={t} className="limite-ruim">
                  <Icone nome="cadeado" tamanho={17} traco={2.4} />
                  <span>
                    <strong>{t}</strong>
                    <span>{s}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className="faixa-resultado faixa-ok">
            <strong>Dica de governança</strong>
            <span>Da próxima vez, mande o documento novo antes de vencer: ele entra sozinho no dia certo. Dúvidas? Fale com a secretaria ou a presidência.</span>
          </p>
        </div>
      </div>
    </>
  )
}
