import { useState } from 'react'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { buscarIgreja, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens, type ItemLista } from '../../dados/configuracoes'
import { atualizarContatoIgreja, ministrosDaMinhaIgreja, type MinistroDaMinhaIgreja } from '../../dados/portal'
import { useCarregar } from '../../estado/useCarregar'
import { formatarCnpj } from '../../utilitarios/formatos'

/** /minha-igreja — painel do pastor presidente: a igreja e os ministros dela (decisão 12 — previsão: mantido). */
export function MinhaIgreja() {
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [carga, recarregar] = useCarregar(async () => {
    const ministros = await ministrosDaMinhaIgreja()
    if (ministros.erro !== null) return ministros
    const igrejaId = ministros.dados[0]?.igreja_id
    if (!igrejaId) return ok({ ministros: [] as MinistroDaMinhaIgreja[], igreja: null, bairros: [] as ItemLista[] })
    const [igreja, bairros] = await Promise.all([buscarIgreja(igrejaId), listarItens('bairros')])
    if (igreja.erro !== null) return igreja
    if (bairros.erro !== null) return bairros
    return ok({ ministros: ministros.dados, igreja: igreja.dados, bairros: bairros.dados })
  })

  return (
    <>
      <h1>Minha igreja</h1>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ ministros, igreja, bairros }) =>
          !igreja ? (
            <Aviso titulo="Nenhuma igreja encontrada">
              <p>
                Este painel é do pastor presidente. Se você preside uma igreja e ela não aparece aqui, peça à secretaria
                para marcar você como pastor presidente na sua ficha.
              </p>
            </Aviso>
          ) : (
            <>
              <DadosDaIgreja
                igreja={igreja}
                bairros={bairros}
                aoSalvar={(r) => {
                  setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Contato da igreja atualizado.' })
                  if (r.erro === null) recarregar()
                }}
              />
              <section className="painel" aria-labelledby="titulo-ministros-minha-igreja">
                <h2 id="titulo-ministros-minha-igreja">Ministros da igreja ({ministros.length})</h2>
                <ul className="lista" aria-label="Ministros da igreja">
                  {ministros.map((m) => (
                    <li key={m.pessoa_id} className="lista-item lista-item-estatico">
                      <strong>
                        <span className="numero">Nº {m.numero_registro}</span> {m.nome}
                      </strong>
                      <span>
                        {[m.titulo, m.funcao, m.pastor_presidente && 'pastor presidente'].filter(Boolean).join(' · ')}
                      </span>
                      {m.telefone && (
                        <span>
                          <a href={`tel:${m.telefone.replace(/[^\d+]/g, '')}`}>{m.telefone}</a>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="detalhe">
                  A situação das contribuições (em dia ou em atraso) de cada ministro aparece aqui quando o financeiro
                  entrar (Fase 2).
                </p>
              </section>
            </>
          )
        }
      </MostrarCarga>
    </>
  )
}

function DadosDaIgreja({
  igreja,
  bairros,
  aoSalvar,
}: {
  igreja: Igreja
  bairros: ItemLista[]
  aoSalvar: (r: { erro: string | null }) => void
}) {
  const [endereco, setEndereco] = useState(igreja.endereco ?? '')
  const [bairroId, setBairroId] = useState(igreja.bairro_id ?? '')
  const [telefone, setTelefone] = useState(igreja.telefone ?? '')
  const [enviando, setEnviando] = useState(false)

  return (
    <section className="painel" aria-labelledby="titulo-dados-igreja">
      <h2 id="titulo-dados-igreja">{igreja.nome}</h2>
      <dl className="definicoes">
        <dt>Denominação</dt>
        <dd>{igreja.denominacao?.nome ?? 'Não informada'}</dd>
        <dt>CNPJ</dt>
        <dd>{formatarCnpj(igreja.cnpj) || 'Não informado'}</dd>
      </dl>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setEnviando(true)
          aoSalvar(await atualizarContatoIgreja(igreja.id, { endereco, bairro_id: bairroId, telefone }))
          setEnviando(false)
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Endereço
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </label>
          <label>
            Bairro
            <select value={bairroId} onChange={(e) => setBairroId(e.target.value)}>
              <option value="">— Não informado —</option>
              {bairros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}
                </option>
              ))}
              {igreja.bairro_id && !bairros.some((b) => b.id === igreja.bairro_id) && (
                <option value={igreja.bairro_id}>{igreja.bairro?.nome} (arquivado)</option>
              )}
            </select>
          </label>
          <label>
            Telefone da igreja
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
        </div>
        <p className="detalhe">Nome, CNPJ e denominação são atualizados pela secretaria.</p>
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar contato da igreja
          </button>
        </div>
      </form>
    </section>
  )
}
