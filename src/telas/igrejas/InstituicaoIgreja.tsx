// Fase 5.1 — a igreja como instituição: os documentos (estatuto, cartão CNPJ, ata da diretoria) e a diretoria dela.
// Usado na tela da igreja (secretaria e presidência, que conferem) e em "Minha igreja" (o pastor presidente, que envia).
import { useEffect, useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import {
  conferirDocumentoIgreja,
  DOCUMENTOS_ESSENCIAIS,
  enviarDocumentoIgreja,
  linkDocumentoIgreja,
  listarDiretoriaIgreja,
  listarDocumentosIgreja,
  NOME_DO_DOCUMENTO,
  salvarDiretoriaIgreja,
  type DocumentoIgreja,
  type MembroDiretoriaIgreja,
  type TipoDocumentoIgreja,
} from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante } from '../../utilitarios/formatos'
import { prepararComprovante } from '../../utilitarios/imagens'

type Retorno = { sucesso?: string; erro?: string }

const CLASSE_SITUACAO = { pendente: 'etiqueta etiqueta-conferencia', conferido: 'etiqueta etiqueta-ok', recusado: 'etiqueta etiqueta-atraso' }
const NOME_SITUACAO = { pendente: 'Esperando a conferência', conferido: 'Conferido', recusado: 'Recusado' }

export function LinkDocumento({ caminho, rotulo = 'Abrir' }: { caminho: string; rotulo?: string }) {
  const [link, setLink] = useState<string | null>(null)
  useEffect(() => {
    let ativo = true
    const buscar = () => void linkDocumentoIgreja(caminho).then((l) => ativo && setLink(l))
    buscar()
    // o link vale 10 minutos: renova antes de vencer (a página pode ficar aberta)
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

// ---------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------

export function DocumentosDaIgreja({ igrejaId, podeConferir }: { igrejaId: string; podeConferir: boolean }) {
  const [carga, recarregar] = useCarregar(() => listarDocumentosIgreja(igrejaId))
  const [retorno, setRetorno] = useState<Retorno>({})
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <section className="painel" aria-labelledby={`titulo-documentos-${igrejaId}`}>
      <h2 id={`titulo-documentos-${igrejaId}`}>Documentos da igreja</h2>
      <p className="detalhe">
        O COMEP representa e apoia as igrejas: para isso, guarda o estatuto, o cartão CNPJ e a ata da diretoria de cada uma. O
        pastor presidente envia e a secretaria confere. Só quem cuida da igreja vê os arquivos.
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(documentos) => {
          const faltam = DOCUMENTOS_ESSENCIAIS.filter((t) => !documentos.some((d) => d.tipo === t && d.situacao === 'conferido'))
          return (
            <>
              {faltam.length > 0 && (
                <p className="aviso-texto">Falta conferir: {faltam.map((t) => NOME_DO_DOCUMENTO[t]).join(', ')}.</p>
              )}
              {documentos.length === 0 ? (
                <p className="vazio">Nenhum documento enviado.</p>
              ) : (
                <ul className="lista" aria-label="Documentos da igreja">
                  {documentos.map((d) => (
                    <LinhaDocumento key={d.id} d={d} podeConferir={podeConferir} aoConcluir={concluir} />
                  ))}
                </ul>
              )}
              <EnviarDocumento igrejaId={igrejaId} aoConcluir={concluir} />
            </>
          )
        }}
      </MostrarCarga>
    </section>
  )
}

function LinhaDocumento({
  d,
  podeConferir,
  aoConcluir,
}: {
  d: DocumentoIgreja
  podeConferir: boolean
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = d.tipo === 'outro' ? (d.descricao ?? NOME_DO_DOCUMENTO.outro) : NOME_DO_DOCUMENTO[d.tipo]
  return (
    <li className="lista-item lista-item-estatico" aria-label={nome}>
      <strong>{nome}</strong>
      <span>
        <span className={CLASSE_SITUACAO[d.situacao]}>{NOME_SITUACAO[d.situacao]}</span> enviado em{' '}
        {formatarDataDeInstante(d.criado_em)}
        {d.conferido_em && ` · conferido em ${formatarDataDeInstante(d.conferido_em)}`} · <LinkDocumento caminho={d.arquivo_caminho} />
      </span>
      {d.tipo !== 'outro' && d.descricao && <span>{d.descricao}</span>}
      {d.situacao === 'recusado' && <span>Motivo: {d.motivo_recusa}. Envie o documento de novo.</span>}
      {podeConferir && d.situacao === 'pendente' && (
        <span className="form-linha">
          <button
            type="button"
            className="botao"
            disabled={enviando}
            onClick={() => void umaVez(async () => aoConcluir(await conferirDocumentoIgreja(d.id, true, ''), `${nome}: conferido.`))}
          >
            Conferido
          </button>
          <label>
            Motivo (para recusar)
            <input value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <button
            type="button"
            className="botao botao-perigo"
            disabled={enviando || !motivo.trim()}
            onClick={() => void umaVez(async () => aoConcluir(await conferirDocumentoIgreja(d.id, false, motivo), `${nome}: recusado.`))}
          >
            Recusar
          </button>
        </span>
      )}
    </li>
  )
}

function EnviarDocumento({ igrejaId, aoConcluir }: { igrejaId: string; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [tipo, setTipo] = useState<TipoDocumentoIgreja>('estatuto')
  const [descricao, setDescricao] = useState('')
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Enviar um documento</summary>
      <div className="form-linha">
        <label>
          Documento
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumentoIgreja)}>
            {(Object.keys(NOME_DO_DOCUMENTO) as TipoDocumentoIgreja[]).map((t) => (
              <option key={t} value={t}>
                {NOME_DO_DOCUMENTO[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tipo === 'outro' ? 'Que documento é? *' : 'Observação'}
          <input value={descricao} maxLength={300} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <label className="botao botao-secundario botao-arquivo">
          {enviando ? 'Enviando…' : 'Escolher o arquivo (PDF ou foto)'}
          <input
            type="file"
            accept="application/pdf,image/*"
            className="somente-leitor"
            disabled={enviando || (tipo === 'outro' && !descricao.trim())}
            onChange={(ev) => {
              const arquivo = ev.target.files?.[0]
              ev.target.value = ''
              if (!arquivo) return
              void umaVez(async () => {
                const pronto = await prepararComprovante(arquivo)
                if ('erro' in pronto) return aoConcluir({ erro: pronto.erro }, '')
                aoConcluir(
                  await enviarDocumentoIgreja(igrejaId, tipo, pronto.blob, pronto.extensao, descricao),
                  `${NOME_DO_DOCUMENTO[tipo]} enviado: a secretaria vai conferir.`,
                )
                setDescricao('')
              })
            }}
          />
        </label>
      </div>
      <p className="detalhe">Enviar de novo um documento do mesmo tipo substitui o anterior, que fica guardado no histórico.</p>
    </details>
  )
}

// ---------------------------------------------------------------------
// Diretoria da igreja
// ---------------------------------------------------------------------

const CARGOS_SUGERIDOS = ['Presidente', 'Vice-presidente', 'Secretário(a)', 'Tesoureiro(a)']

export function DiretoriaDaIgreja({ igrejaId }: { igrejaId: string }) {
  const [carga, recarregar] = useCarregar(() => listarDiretoriaIgreja(igrejaId))
  const [retorno, setRetorno] = useState<Retorno>({})
  return (
    <section className="painel" aria-labelledby={`titulo-diretoria-igreja-${igrejaId}`}>
      <h2 id={`titulo-diretoria-igreja-${igrejaId}`}>Diretoria da igreja</h2>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(membros) => (
          <>
            {membros.length === 0 ? (
              <p className="vazio">A diretoria da igreja ainda não foi informada.</p>
            ) : (
              <>
                <ul className="lista-pendencias" aria-label="Diretoria da igreja">
                  {membros.map((m) => (
                    <li key={m.id}>
                      {m.cargo}: <strong>{m.nome}</strong>
                    </li>
                  ))}
                </ul>
                {(membros[0].inicio || membros[0].fim) && (
                  <p className="detalhe">
                    Mandato: {membros[0].inicio ? formatarData(membros[0].inicio) : '—'} a {membros[0].fim ? formatarData(membros[0].fim) : '—'}
                  </p>
                )}
              </>
            )}
            <FormDiretoria
              key={membros.map((m) => m.id).join()}
              igrejaId={igrejaId}
              atuais={membros}
              aoConcluir={(r, s) => {
                setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: s })
                if (r.erro === null) recarregar()
              }}
            />
          </>
        )}
      </MostrarCarga>
    </section>
  )
}

function FormDiretoria({
  igrejaId,
  atuais,
  aoConcluir,
}: {
  igrejaId: string
  atuais: MembroDiretoriaIgreja[]
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [inicio, setInicio] = useState(atuais[0]?.inicio ?? '')
  const [fim, setFim] = useState(atuais[0]?.fim ?? '')
  const [linhas, setLinhas] = useState<{ cargo: string; nome: string }[]>(
    atuais.length > 0 ? atuais.map(({ cargo, nome }) => ({ cargo, nome })) : CARGOS_SUGERIDOS.map((cargo) => ({ cargo, nome: '' })),
  )
  const [enviando, umaVez] = useUmaVez()
  const mudar = (i: number, parte: Partial<{ cargo: string; nome: string }>) =>
    setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, ...parte } : l)))
  return (
    <details className="acao-recolhida">
      <summary>{atuais.length > 0 ? 'Atualizar a diretoria da igreja' : 'Informar a diretoria da igreja'}</summary>
      <form
        aria-label="Diretoria da igreja"
        onSubmit={(e) => {
          e.preventDefault()
          const membros = linhas.filter((l) => l.cargo.trim() && l.nome.trim())
          void umaVez(async () => {
            const r = await salvarDiretoriaIgreja(igrejaId, inicio, fim, membros)
            aoConcluir(r, 'Diretoria da igreja salva. A anterior fica no histórico.')
          })
        }}
      >
        <div className="grade-form">
          <label>
            Mandato: início
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label>
            Mandato: fim
            <input type="date" min={inicio || undefined} value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          {linhas.map((l, i) => (
            <div key={i} className="form-linha largura-total">
              <label>
                Cargo
                <input aria-label={`Cargo ${i + 1}`} maxLength={80} value={l.cargo} onChange={(e) => mudar(i, { cargo: e.target.value })} />
              </label>
              <label>
                Nome
                <input aria-label={`Nome ${i + 1}`} maxLength={200} value={l.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
              </label>
              <button type="button" className="botao-texto" onClick={() => setLinhas((atual) => atual.filter((_, j) => j !== i))}>
                Tirar
              </button>
            </div>
          ))}
        </div>
        <div className="acoes">
          <button
            type="button"
            className="botao botao-secundario"
            disabled={linhas.length >= 30}
            onClick={() => setLinhas((atual) => [...atual, { cargo: '', nome: '' }])}
          >
            + Cargo
          </button>
          <button type="submit" className="botao" disabled={enviando || !linhas.some((l) => l.cargo.trim() && l.nome.trim())}>
            Salvar a diretoria
          </button>
        </div>
        <p className="detalhe">Linhas sem nome ficam de fora. Mande também a ata da eleição em "Documentos da igreja".</p>
      </form>
    </details>
  )
}
