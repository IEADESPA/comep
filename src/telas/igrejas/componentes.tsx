// Peças das telas da igreja (Fase 5.5, partes 5 e 6), usadas pela secretaria (módulo Igrejas) e pelo pastor
// presidente (Minha igreja): a situação, os documentos com as partes (até 25 MB cada), a diretoria com o mandato
// ("mesmo mandato para todos", com exceção; vale o MENOR) e o envio de um documento.
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Icone } from '../../componentes/Icone'
import { Chip, Selo } from '../../componentes/Telas'
import {
  conferirDocumentoIgreja,
  enviarDocumentoIgreja,
  linkDocumentoIgreja,
  NOME_DA_NATUREZA,
  NOME_DO_DOCUMENTO,
  NOME_DO_NIVEL,
  type ArquivoParaEnviar,
  type DocumentoIgreja,
  type MembroDiretoriaIgreja,
  type NaturezaJuridica,
  type NivelIgreja,
  type TipoDocumentoIgreja,
} from '../../dados/igrejas'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { prepararDocumento } from '../../utilitarios/imagens'
import { fimDoMandato, menorMandato, tamanhoDoArquivo } from '../../utilitarios/regularizacao'
import {
  ANOS,
  datasDaLinha,
  diretoriaInicial,
  faltaNaDiretoria,
  membrosDaDiretoria,
  nomeDoDocumento,
  resumoDoDocumento,
  type EstadoDiretoria,
  type LinhaDiretoria,
  type OpcaoMinistro,
} from './regras'

export type Concluir = (r: { erro: string | null }, sucesso: string) => void

const AREA_DO_NIVEL = { regular: 'financas', suspensa: 'pessoas', sem_registro: 'assembleias', em_analise: 'eventos' } as const

/** A situação da igreja numa etiqueta: Regular, Suspensa, Sem registro ou Em análise. */
export function SeloNivel({ nivel }: { nivel: NivelIgreja }) {
  return <Chip area={AREA_DO_NIVEL[nivel]}>{NOME_DO_NIVEL[nivel]}</Chip>
}

/** Link temporário do arquivo (renova antes de vencer, se a página ficar aberta). */
export function LinkDocumento({ caminho, rotulo = 'Abrir' }: { caminho: string; rotulo?: string }) {
  const [link, setLink] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    const buscar = () => void linkDocumentoIgreja(caminho).then((l) => ativo && setLink(l))
    buscar()
    const relogio = window.setInterval(buscar, 8 * 60_000)
    return () => {
      ativo = false
      window.clearInterval(relogio)
    }
  }, [caminho])
  return link ? (
    <a href={link} target="_blank" rel="noreferrer">
      {rotulo}
    </a>
  ) : null
}

/** As partes do documento, cada uma com o link. */
export function PartesDoDocumento({ d }: { d: DocumentoIgreja }) {
  const partes = d.partes.length > 0 ? d.partes : [{ id: d.id, ordem: 1, arquivo_caminho: d.arquivo_caminho, nome_arquivo: null, tamanho: null }]
  if (partes.length === 1) return <LinkDocumento caminho={partes[0].arquivo_caminho} rotulo="Ver o arquivo" />
  return (
    <span className="partes-links">
      {partes.map((p) => (
        <LinkDocumento key={p.id} caminho={p.arquivo_caminho} rotulo={`Parte ${p.ordem}`} />
      ))}
    </span>
  )
}

const SELO_DOC = {
  pendente: { tipo: 'analise', texto: 'Esperando a conferência' },
  conferido: { tipo: 'aprovado', texto: 'Conferido' },
  recusado: { tipo: 'recusado', texto: 'Recusado' },
} as const

/** Um documento na lista, com o selo da secretaria e, para quem confere, Conferir e Recusar. */
export function LinhaDocumento({ d, podeConferir, aoConcluir }: { d: DocumentoIgreja; podeConferir: boolean; aoConcluir: Concluir }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = nomeDoDocumento(d)
  const selo = SELO_DOC[d.situacao]
  const decidir = (aceito: boolean) =>
    umaVez(async () => {
      const r = await conferirDocumentoIgreja(d.id, aceito, aceito ? '' : motivo)
      aoConcluir(r, aceito ? `${nome}: conferido.` : `${nome}: recusado.`)
    })
  return (
    <li aria-label={nome}>
      <span className="linha-corpo">
        <strong>{nome}</strong>
        <span>{resumoDoDocumento(d)}</span>
        <span>
          enviado em {formatarDataDeInstante(d.criado_em)}
          {d.partes.length > 1 && ` · em ${d.partes.length} partes`}
          {d.conferido_em && d.situacao !== 'pendente' && ` · ${d.situacao === 'conferido' ? 'conferido' : 'recusado'} em ${formatarDataDeInstante(d.conferido_em)}`}
          {' · '}
          <PartesDoDocumento d={d} />
        </span>
        <span className="linha-selo">
          <Selo tipo={selo.tipo}>{d.situacao === 'recusado' ? `Recusado: ${d.motivo_recusa ?? ''}` : selo.texto}</Selo>
        </span>
        {podeConferir && d.situacao === 'pendente' && !recusando && (
          <span className="acoes-item">
            <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => setRecusando(true)}>
              Recusar
            </button>
            <button type="button" className="botao" disabled={enviando} onClick={() => void decidir(true)}>
              Conferir
            </button>
          </span>
        )}
        {podeConferir && d.situacao === 'pendente' && recusando && (
          <form
            className="form-linha form-compacto"
            aria-label={`Recusar: ${nome}`}
            onSubmit={(e) => {
              e.preventDefault()
              void decidir(false)
            }}
          >
            <label>
              Motivo *
              <input required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: falta a assinatura" />
            </label>
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Recusar o documento
            </button>
            <button type="button" className="botao-texto" onClick={() => setRecusando(false)}>
              Cancelar
            </button>
          </form>
        )}
      </span>
    </li>
  )
}

// ---------------------------------------------------------------------
// As partes do documento: até 25 MB cada; a foto é reduzida no aparelho
// ---------------------------------------------------------------------

export type ArquivoEscolhido = ArquivoParaEnviar & { tamanhoOriginal: number }

export function EscolherArquivos({
  arquivos,
  aoMudar,
  rotulo = 'os arquivos do documento',
}: {
  arquivos: ArquivoEscolhido[]
  aoMudar: (a: ArquivoEscolhido[]) => void
  rotulo?: string
}) {
  const [erros, setErros] = useState<string[]>([])
  const [lendo, setLendo] = useState(false)
  const id = useId()
  return (
    <div className="escolher-arquivos">
      {arquivos.length > 0 && (
        <ul className="lista-partes" aria-label="Partes escolhidas">
          {arquivos.map((a, i) => (
            <li key={`${a.nome}-${i}`}>
              <Icone nome="check" tamanho={16} traco={2.6} />
              <span className="lista-partes-nome">
                {arquivos.length > 1 && `Parte ${i + 1}: `}
                {a.nome}
              </span>
              <span className="lista-partes-tamanho">
                {tamanhoDoArquivo(a.blob.size)}
                {a.blob.size < a.tamanhoOriginal * 0.9 && ` (era ${tamanhoDoArquivo(a.tamanhoOriginal)})`}
              </span>
              <button type="button" className="botao-texto" onClick={() => aoMudar(arquivos.filter((_, j) => j !== i))}>
                Tirar
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="zona-envio" htmlFor={id}>
        <Icone nome="enviar" tamanho={24} />
        <strong>{lendo ? 'Preparando…' : arquivos.length > 0 ? '+ Adicionar outra parte' : `Escolher ${rotulo}`}</strong>
        <span>PDF ou foto, até 25 MB cada. Documento grande vai em partes; a foto é reduzida sozinha.</span>
      </label>
      <input
        id={id}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="somente-leitor"
        aria-label={`Escolher ${rotulo}`}
        disabled={lendo}
        onChange={async (ev) => {
          const lista = Array.from(ev.target.files ?? [])
          ev.target.value = ''
          if (lista.length === 0) return
          setLendo(true)
          const prontos: ArquivoEscolhido[] = []
          const novosErros: string[] = []
          for (const arquivo of lista) {
            const pronto = await prepararDocumento(arquivo)
            if ('erro' in pronto) novosErros.push(pronto.erro)
            else prontos.push({ ...pronto, nome: arquivo.name, tamanhoOriginal: arquivo.size })
          }
          setLendo(false)
          setErros(novosErros)
          if (prontos.length > 0) aoMudar([...arquivos, ...prontos].slice(0, 20))
        }}
      />
      {erros.map((e) => (
        <p key={e} className="erro" role="alert">
          {e}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// A diretoria e o mandato: "mesmo mandato para todos", com a exceção; vale o MENOR
// ---------------------------------------------------------------------

export function FormDiretoria({
  estado,
  aoMudar,
  ministros,
  textoMinistro = 'Ministro associado',
}: {
  estado: EstadoDiretoria
  aoMudar: (e: EstadoDiretoria) => void
  ministros: OpcaoMinistro[]
  textoMinistro?: string
}) {
  const mudarLinha = (i: number, parte: Partial<LinhaDiretoria>) =>
    aoMudar({ ...estado, linhas: estado.linhas.map((l, j) => (j === i ? { ...l, ...parte } : l)) })
  const membros = membrosDaDiretoria(estado)
  const ate = menorMandato(membros)
  const padraoFim = estado.posse ? fimDoMandato(estado.posse, estado.anos) : ''
  const cargoMenor = ate ? membros.find((m) => m.fim === ate) : undefined
  const temExcecao = membros.some((m) => m.fim !== membros[0]?.fim)
  return (
    <div className="form-diretoria">
      <div className="mandato-padrao">
        <label>
          Posse (data da ata) *
          <input type="date" value={estado.posse} onChange={(e) => aoMudar({ ...estado, posse: e.target.value })} />
        </label>
        <label>
          Mandato
          <select value={estado.anos} onChange={(e) => aoMudar({ ...estado, anos: Number(e.target.value) })}>
            {ANOS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1 ano' : `${n} anos`}
              </option>
            ))}
          </select>
        </label>
        <label className="caixa-marcar">
          <input type="checkbox" checked={estado.mesmo} onChange={(e) => aoMudar({ ...estado, mesmo: e.target.checked })} />
          Mesmo mandato para todos os cargos
        </label>
      </div>
      <ul className="lista-linhas bloco linhas-diretoria" aria-label="Cargos da diretoria">
        {estado.linhas.map((l, i) => {
          const proprio = !estado.mesmo || l.personalizado
          const datas = datasDaLinha(estado, l)
          return (
            <li key={i} aria-label={`Cargo ${i + 1}`}>
              <span className="linha-cargo">
                <label>
                  Cargo
                  <input aria-label={`Cargo ${i + 1}`} maxLength={80} value={l.cargo} onChange={(e) => mudarLinha(i, { cargo: e.target.value })} />
                </label>
                <label>
                  Quem ocupa
                  <select
                    aria-label={`Quem ocupa o cargo ${i + 1}`}
                    value={l.pessoa_id}
                    onChange={(e) => mudarLinha(i, { pessoa_id: e.target.value })}
                  >
                    <option value="">Escrever o nome completo</option>
                    {ministros.map((m) => (
                      <option key={m.pessoa_id} value={m.pessoa_id}>
                        {m.nome}
                        {m.numero ? ` (nº ${String(m.numero).padStart(4, '0')})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {!l.pessoa_id && (
                  <label>
                    Nome completo
                    <input aria-label={`Nome completo ${i + 1}`} maxLength={200} value={l.nome} onChange={(e) => mudarLinha(i, { nome: e.target.value })} />
                  </label>
                )}
                {proprio && (
                  <>
                    <label>
                      Posse
                      <input type="date" aria-label={`Posse do cargo ${i + 1}`} value={l.posse || estado.posse} onChange={(e) => mudarLinha(i, { posse: e.target.value })} />
                    </label>
                    <label>
                      Mandato
                      <select aria-label={`Mandato do cargo ${i + 1}`} value={l.anos} onChange={(e) => mudarLinha(i, { anos: Number(e.target.value) })}>
                        {ANOS.map((n) => (
                          <option key={n} value={n}>
                            {n === 1 ? '1 ano' : `${n} anos`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </span>
              <span className="linha-cargo-lado">
                <span className={datas.fim && datas.fim === ate && temExcecao ? 'texto-atencao' : 'detalhe'}>
                  {datas.fim ? `até ${formatarData(datas.fim)}` : 'sem a posse'}
                </span>
                {estado.mesmo && (
                  <button type="button" className="botao-link" onClick={() => mudarLinha(i, { personalizado: !l.personalizado, posse: l.posse || estado.posse, anos: l.anos })}>
                    {l.personalizado ? 'Voltar ao padrão' : 'Personalizar'}
                  </button>
                )}
                <button
                  type="button"
                  className="botao-texto"
                  aria-label={`Tirar o cargo ${i + 1}`}
                  onClick={() => aoMudar({ ...estado, linhas: estado.linhas.filter((_, j) => j !== i) })}
                >
                  Tirar
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="botao-link"
        disabled={estado.linhas.length >= 30}
        onClick={() => aoMudar({ ...estado, linhas: [...estado.linhas, { cargo: '', pessoa_id: '', nome: '', personalizado: false, posse: '', anos: estado.anos }] })}
      >
        + Adicionar cargo
      </button>
      {ate && (
        <div className={temExcecao ? 'faixa-resultado faixa-atencao' : 'faixa-resultado faixa-ok'} role="status">
          <strong>A diretoria vale até {formatarData(ate)}</strong>
          <span>
            {temExcecao && cargoMenor
              ? `Vale o menor mandato: o do cargo "${cargoMenor.cargo}". Depois dele o cargo fica vago e a ata deixa de valer.`
              : `Todos os cargos com ${estado.anos === 1 ? '1 ano' : `${estado.anos} anos`}${padraoFim ? `, a partir de ${formatarData(estado.posse)}` : ''}.`}
          </span>
        </div>
      )}
      <p className="detalhe">
        Não existe mandato sem prazo nem vitalício: confira no estatuto e na ata o tempo de cada cargo. O presidente segue a mesma
        regra. {textoMinistro === 'Ministro associado' ? 'Quem não é ministro associado entra pelo nome completo.' : textoMinistro}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------
// Mandar um documento (o tipo, as datas, a natureza ou a diretoria, e as partes)
// ---------------------------------------------------------------------

/** O último dia do ano da data (o alvará vale até 31/12). */
const fimDoAno = (data: string) => `${data.slice(0, 4)}-12-31`

export function FormDocumento({
  igrejaId,
  tipoFixo,
  tipos = ['estatuto', 'cartao_cnpj', 'ata_diretoria', 'alvara', 'outro'],
  naturezaDaIgreja,
  ministros,
  diretoriaAtual,
  presidente,
  antecipado,
  textoBotao = 'Mandar o documento',
  aoConcluir,
  rodape,
}: {
  igrejaId: string
  tipoFixo?: TipoDocumentoIgreja
  tipos?: TipoDocumentoIgreja[]
  naturezaDaIgreja: NaturezaJuridica | null
  ministros: OpcaoMinistro[]
  diretoriaAtual: MembroDiretoriaIgreja[]
  presidente?: OpcaoMinistro | null
  /** o documento seguinte: as datas começam depois do atual */
  antecipado?: { de: string } | null
  textoBotao?: string
  aoConcluir: Concluir
  rodape?: ReactNode
}) {
  const hoje = hojeIso()
  const [tipo, setTipo] = useState<TipoDocumentoIgreja>(tipoFixo ?? tipos[0])
  const [descricao, setDescricao] = useState('')
  const [natureza, setNatureza] = useState<NaturezaJuridica>('organizacao_religiosa')
  const [mudaNatureza, setMudaNatureza] = useState(false)
  const inicioAlvara = antecipado?.de ?? hoje
  const [validoDe, setValidoDe] = useState(inicioAlvara)
  const [validoAte, setValidoAte] = useState(fimDoAno(inicioAlvara))
  const [diretoria, setDiretoria] = useState<EstadoDiretoria>(() => {
    const e = diretoriaInicial(diretoriaAtual, presidente)
    return antecipado ? { ...e, posse: antecipado.de } : e
  })
  const [arquivos, setArquivos] = useState<ArquivoEscolhido[]>([])
  const [subindo, setSubindo] = useState<number | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const tipoAtual = tipoFixo ?? tipo
  const falta =
    arquivos.length === 0
      ? 'Escolha o arquivo do documento.'
      : tipoAtual === 'ata_diretoria'
        ? faltaNaDiretoria(diretoria)
        : tipoAtual === 'outro' && !descricao.trim()
          ? 'Diga que documento é este.'
          : tipoAtual === 'alvara' && (!validoAte || !validoDe)
            ? 'Informe de quando até quando o alvará vale.'
            : null

  async function mandar() {
    const r = await enviarDocumentoIgreja(
      igrejaId,
      {
        tipo: tipoAtual,
        descricao: tipoAtual === 'outro' ? descricao : undefined,
        valido_de: tipoAtual === 'alvara' ? validoDe : undefined,
        valido_ate: tipoAtual === 'alvara' ? validoAte : undefined,
        natureza: tipoAtual === 'cartao_cnpj' ? natureza : undefined,
        muda_natureza: tipoAtual === 'ata_diretoria' ? mudaNatureza : undefined,
        diretoria: tipoAtual === 'ata_diretoria' ? membrosDaDiretoria(diretoria) : undefined,
      },
      arquivos,
      (n) => setSubindo(n),
    )
    setSubindo(null)
    aoConcluir(r, `${NOME_DO_DOCUMENTO[tipoAtual]}: enviado.`)
    if (r.erro === null) setArquivos([])
  }

  return (
    <form
      className="form-documento"
      aria-label={tipoFixo ? `Mandar: ${NOME_DO_DOCUMENTO[tipoFixo]}` : 'Mandar um documento'}
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(mandar)
      }}
    >
      {!tipoFixo && (
        <label>
          Documento
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoIgreja)}>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {NOME_DO_DOCUMENTO[t]}
              </option>
            ))}
          </select>
        </label>
      )}
      {tipoAtual === 'outro' && (
        <label>
          Que documento é? *
          <input value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} />
        </label>
      )}
      {tipoAtual === 'alvara' && (
        <div className="grade-form">
          <label>
            Vale a partir de *
            <input type="date" value={validoDe} onChange={(e) => setValidoDe(e.target.value)} />
          </label>
          <label>
            Vale até *
            <input type="date" min={validoDe || undefined} value={validoAte} onChange={(e) => setValidoAte(e.target.value)} />
          </label>
          <p className="detalhe largura-total">
            O alvará de licenciamento já inclui o Corpo de Bombeiros e a Vigilância Sanitária. Ele vale até 31/12; o do ano seguinte
            pode ir antes, e entra sozinho no dia certo.
          </p>
        </div>
      )}
      {tipoAtual === 'cartao_cnpj' && (
        <fieldset className="opcoes-radio">
          <legend>Natureza jurídica (como está no Cartão CNPJ)</legend>
          {(Object.keys(NOME_DA_NATUREZA) as NaturezaJuridica[]).map((n) => (
            <label key={n} className="caixa-marcar">
              <input type="radio" name="natureza-cartao" checked={natureza === n} onChange={() => setNatureza(n)} />
              {NOME_DA_NATUREZA[n]}
            </label>
          ))}
        </fieldset>
      )}
      {tipoAtual === 'ata_diretoria' && (
        <>
          <FormDiretoria estado={diretoria} aoMudar={setDiretoria} ministros={ministros} />
          {naturezaDaIgreja === 'associacao_privada' && (
            <label className="caixa-marcar">
              <input type="checkbox" checked={mudaNatureza} onChange={(e) => setMudaNatureza(e.target.checked)} />
              Esta ata muda a natureza para organização religiosa (depois dela, o Cartão CNPJ novo tem prazo)
            </label>
          )}
        </>
      )}
      <EscolherArquivos arquivos={arquivos} aoMudar={setArquivos} />
      {rodape}
      {falta && arquivos.length > 0 && <p className="detalhe">{falta}</p>}
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando || falta !== null}>
          {subindo !== null ? `Enviando ${subindo} de ${arquivos.length}…` : enviando ? 'Enviando…' : textoBotao}
        </button>
      </div>
    </form>
  )
}

/** Os números grandes do alto (regulares, suspensas, sem registro, filiais). */
export function NumerosGrandes({ itens }: { itens: { rotulo: string; valor: number; area: 'financas' | 'pessoas' | 'assembleias' | 'eventos' }[] }) {
  return (
    <ul className="numeros-grandes" aria-label="Os números das igrejas">
      {itens.map((n) => (
        <li key={n.rotulo} className={`area-${n.area}`}>
          <span>{n.rotulo}</span>
          <strong>{n.valor}</strong>
        </li>
      ))}
    </ul>
  )
}
