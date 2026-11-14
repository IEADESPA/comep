import { useState } from 'react'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { buscarIgreja, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens, type ItemLista } from '../../dados/configuracoes'
import { listarPedidosCorrecao, type PedidoCorrecao } from '../../dados/igrejas'
import { atualizarContatoIgreja, ministrosDaMinhaIgreja, type MinistroDaMinhaIgreja } from '../../dados/portal'
import { useCarregar } from '../../estado/useCarregar'
import { formatarCnpj } from '../../utilitarios/formatos'
import { DiretoriaDaIgreja, DocumentosDaIgreja } from '../igrejas/InstituicaoIgreja'
import { ListaDePedidos, PedirCorrecao } from './PedidosCorrecao'

/**
 * /minha-igreja — o pastor presidente representa a igreja diante do COMEP (14/11/2026): os dados, os documentos e a
 * diretoria da igreja, os ministros dela (em dia ou não) e os pedidos de correção no cadastro deles.
 */
export function MinhaIgreja() {
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [carga, recarregar] = useCarregar(async () => {
    const ministros = await ministrosDaMinhaIgreja()
    if (ministros.erro !== null) return ministros
    const igrejaId = ministros.dados[0]?.igreja_id
    if (!igrejaId) {
      return ok({ ministros: [] as MinistroDaMinhaIgreja[], igreja: null, bairros: [] as ItemLista[], pedidos: [] as PedidoCorrecao[] })
    }
    const [igreja, bairros, pedidos] = await Promise.all([buscarIgreja(igrejaId), listarItens('bairros'), listarPedidosCorrecao()])
    if (igreja.erro !== null) return igreja
    if (bairros.erro !== null) return bairros
    if (pedidos.erro !== null) return pedidos
    return ok({ ministros: ministros.dados, igreja: igreja.dados, bairros: bairros.dados, pedidos: pedidos.dados })
  })
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
      <h1>Minha igreja</h1>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ ministros, igreja, bairros, pedidos }) =>
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
              <section className="painel" aria-labelledby="titulo-peso-igreja">
                <h2 id="titulo-peso-igreja">A igreja no COMEP</h2>
                <p>
                  <strong>
                    {ministros.length} {ministros.length === 1 ? 'ministro associado' : 'ministros associados'}
                  </strong>{' '}
                  ({ministros.filter((m) => m.em_dia).length} em dia). Quanto mais ministros associados e em dia, mais a igreja é
                  representada no Conselho.
                </p>
                <p className="detalhe">
                  O COMEP representa e apoia as igrejas da cidade. Mantenha os documentos e a diretoria da igreja em dia: eles
                  mostram ao Conselho quem é a igreja e quem responde por ela.
                </p>
              </section>
              <DocumentosDaIgreja igrejaId={igreja.id} podeConferir={false} />
              <DiretoriaDaIgreja igrejaId={igreja.id} />
              <section className="painel" aria-labelledby="titulo-ministros-minha-igreja">
                <h2 id="titulo-ministros-minha-igreja">Ministros da igreja ({ministros.length})</h2>
                <ul className="lista" aria-label="Ministros da igreja">
                  {ministros.map((m) => (
                    <li key={m.pessoa_id} className="lista-item lista-item-estatico">
                      <strong>
                        <span className="numero">Nº {m.numero_registro}</span> {m.nome}{' '}
                        {m.em_dia ? (
                          <span className="etiqueta etiqueta-ok">Em dia</span>
                        ) : (
                          <span className="etiqueta etiqueta-atraso">Em atraso</span>
                        )}
                      </strong>
                      <span>
                        {[m.titulo, m.funcao, m.pastor_presidente && 'pastor presidente'].filter(Boolean).join(' · ')}
                      </span>
                      {m.telefone && (
                        <span>
                          <a href={`tel:${m.telefone.replace(/[^\d+]/g, '')}`}>{m.telefone}</a>
                        </span>
                      )}
                      <PedirCorrecao pessoaId={m.pessoa_id} rotulo={`Pedir correção no cadastro de ${m.nome}`} aoConcluir={concluir} />
                    </li>
                  ))}
                </ul>
                <p className="detalhe">
                  Em atraso = alguma contribuição vencida e não paga. Quem está em atraso não vota nem é votado (Art. 11).
                </p>
              </section>
              <section className="painel" aria-labelledby="titulo-correcoes-igreja">
                <h2 id="titulo-correcoes-igreja">Pedidos de correção</h2>
                <ListaDePedidos pedidos={pedidos} nomes={new Map(ministros.map((m) => [m.pessoa_id, m.nome]))} />
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
  const [sigla, setSigla] = useState(igreja.sigla ?? '')
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
          aoSalvar(await atualizarContatoIgreja(igreja.id, { endereco, bairro_id: bairroId, telefone, sigla }))
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
          <label>
            Sigla (vai na credencial)
            <input
              maxLength={20}
              autoCapitalize="characters"
              placeholder="Ex.: IEADESPA"
              value={sigla}
              onChange={(e) => setSigla(e.target.value)}
            />
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
