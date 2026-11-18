import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone, Ladrilho } from '../../componentes/Icone'
import { AbasDaTela, CabecalhoTela, Chip, Selo, type Aba, type TipoSelo } from '../../componentes/Telas'
import { buscarIgreja, listarIgrejas, listarTitulos, type Igreja, type Titulo } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens, type ItemLista } from '../../dados/configuracoes'
import { listarPedidosCorrecao, type PedidoCorrecao } from '../../dados/igrejas'
import { listarEmprestimos, type Emprestimo, type SituacaoEmprestimo } from '../../dados/patrimonio'
import { atualizarContatoIgreja, ministrosDaMinhaIgreja, type MinistroDaMinhaIgreja } from '../../dados/portal'
import { useSessao } from '../../estado/contexto'
import { agendaProxima } from '../../estado/resumos'
import { useCarregar } from '../../estado/useCarregar'
import { diaEMes, formatarCnpj, formatarData, hojeIso } from '../../utilitarios/formatos'
import { DiretoriaDaIgreja, DocumentosDaIgreja } from '../igrejas/InstituicaoIgreja'
import { FormCorrecao, ListaDePedidos } from './PedidosCorrecao'

/**
 * /minha-igreja — o pastor presidente representa a igreja diante do COMEP (14/11/2026).
 * Telas novas (Fase 5.5, aprovada: "as cinco abas da igreja"): Dados, Documentos, Diretoria, Ministros e Agenda,
 * cada uma com endereço próprio (/minha-igreja, /minha-igreja/documentos…).
 */

const ABAS: readonly Aba[] = [
  { para: '/minha-igreja', nome: 'Dados' },
  { para: '/minha-igreja/documentos', nome: 'Documentos' },
  { para: '/minha-igreja/diretoria', nome: 'Diretoria' },
  { para: '/minha-igreja/ministros', nome: 'Ministros' },
  { para: '/minha-igreja/agenda', nome: 'Agenda' },
]

export function MinhaIgreja() {
  const { aba = 'dados' } = useParams()
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string; aba?: string }>({})
  const [carga, recarregar] = useCarregar(async () => {
    const ministros = await ministrosDaMinhaIgreja()
    if (ministros.erro !== null) return ministros
    const igrejaId = ministros.dados[0]?.igreja_id
    if (!igrejaId) {
      return ok({
        ministros: [] as MinistroDaMinhaIgreja[],
        igreja: null,
        bairros: [] as ItemLista[],
        pedidos: [] as PedidoCorrecao[],
        titulos: [] as Titulo[],
        igrejas: [] as Igreja[],
      })
    }
    const [igreja, bairros, pedidos, titulos, igrejas] = await Promise.all([
      buscarIgreja(igrejaId),
      listarItens('bairros'),
      listarPedidosCorrecao(),
      listarTitulos(),
      listarIgrejas(),
    ])
    if (igreja.erro !== null) return igreja
    if (bairros.erro !== null) return bairros
    if (pedidos.erro !== null) return pedidos
    return ok({
      ministros: ministros.dados,
      igreja: igreja.dados,
      bairros: bairros.dados,
      pedidos: pedidos.dados,
      // as listas da correção (o título e a igreja certos se escolhem, não se digitam)
      titulos: titulos.erro === null ? titulos.dados : [],
      igrejas: igrejas.erro === null ? igrejas.dados : [],
    })
  })
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro, aba } : { sucesso, aba })
    if (r.erro === null) recarregar()
  }
  const mensagem = retorno.aba === aba ? retorno : {}

  return (
    <div className="tela-nova">
      <CabecalhoTela titulo="Minha igreja" visivel={false} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ ministros, igreja, bairros, pedidos, titulos, igrejas }) =>
          !igreja ? (
            <Aviso titulo="Nenhuma igreja encontrada">
              <p>
                Este painel é do pastor presidente. Se você preside uma igreja e ela não aparece aqui, peça à secretaria
                para marcar você como pastor presidente na sua ficha.
              </p>
            </Aviso>
          ) : (
            <>
              <TopoDaIgreja igreja={igreja} ministros={ministros} />
              <AbasDaTela rotulo="Partes da minha igreja" abas={ABAS} />
              <Mensagem sucesso={mensagem.sucesso} erro={mensagem.erro} />
              {aba === 'documentos' ? (
                <DocumentosDaIgreja igrejaId={igreja.id} podeConferir={false} />
              ) : aba === 'diretoria' ? (
                <DiretoriaDaIgreja igrejaId={igreja.id} />
              ) : aba === 'ministros' ? (
                <MinistrosDaIgreja
                  ministros={ministros}
                  pedidos={pedidos}
                  titulos={titulos}
                  igrejas={igrejas}
                  nomeDaIgreja={igreja.nome}
                  concluir={concluir}
                />
              ) : aba === 'agenda' ? (
                <AgendaDaIgreja igreja={igreja} />
              ) : (
                <DadosDaIgreja igreja={igreja} bairros={bairros} concluir={concluir} />
              )}
            </>
          )
        }
      </MostrarCarga>
    </div>
  )
}

function TopoDaIgreja({ igreja, ministros }: { igreja: Igreja; ministros: MinistroDaMinhaIgreja[] }) {
  const emDia = ministros.filter((m) => m.em_dia).length
  const linha = [igreja.denominacao?.nome, igreja.bairro?.nome, igreja.cnpj ? `CNPJ ${formatarCnpj(igreja.cnpj)}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="bloco topo-igreja" aria-labelledby="titulo-dados-igreja">
      <Ladrilho area="pessoas" icone="igreja" tamanho={52} />
      <div className="topo-igreja-texto">
        <h2 id="titulo-dados-igreja">{igreja.nome}</h2>
        {linha && <span className="detalhe">{linha}</span>}
        <span className="chips">
          <Chip area="pessoas">
            {ministros.length} {ministros.length === 1 ? 'ministro associado' : 'ministros associados'}
          </Chip>
          <Chip area="financas">{emDia} em dia</Chip>
        </span>
      </div>
      <Link to="/minha-igreja" className="botao botao-secundario so-computador">
        Alterar o contato
      </Link>
    </section>
  )
}

// ---------------------------------------------------------------------
// Aba "Dados"
// ---------------------------------------------------------------------

function DadosDaIgreja({
  igreja,
  bairros,
  concluir,
}: {
  igreja: Igreja
  bairros: ItemLista[]
  concluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  const [endereco, setEndereco] = useState(igreja.endereco ?? '')
  const [bairroId, setBairroId] = useState(igreja.bairro_id ?? '')
  const [telefone, setTelefone] = useState(igreja.telefone ?? '')
  const [sigla, setSigla] = useState(igreja.sigla ?? '')
  const [enviando, setEnviando] = useState(false)

  return (
    <section className="aba-conteudo" aria-labelledby="titulo-contato-igreja">
      <h3 id="titulo-contato-igreja" className="somente-leitor">
        Dados e contato da igreja
      </h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setEnviando(true)
          concluir(await atualizarContatoIgreja(igreja.id, { endereco, bairro_id: bairroId, telefone, sigla }), 'Contato da igreja atualizado.')
          setEnviando(false)
        }}
      >
        <div className="grade-form">
          <label>
            <span className="rotulo-com-cadeado">
              <Icone nome="cadeado" tamanho={16} /> Nome
            </span>
            <input value={igreja.nome} disabled />
          </label>
          <label>
            Sigla (vai na credencial)
            <input maxLength={20} autoCapitalize="characters" placeholder="Ex.: IEADESPA" value={sigla} onChange={(e) => setSigla(e.target.value)} />
          </label>
          <label>
            <span className="rotulo-com-cadeado">
              <Icone nome="cadeado" tamanho={16} /> Denominação
            </span>
            <input value={igreja.denominacao?.nome ?? 'Não informada'} disabled />
          </label>
          <label>
            <span className="rotulo-com-cadeado">
              <Icone nome="cadeado" tamanho={16} /> CNPJ
            </span>
            <input value={formatarCnpj(igreja.cnpj) || 'Não informado'} disabled />
          </label>
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
        <p className="detalhe">
          Nome, CNPJ e denominação (com cadeado) são atualizados pela secretaria. O COMEP representa e apoia as igrejas da
          cidade: quanto mais ministros associados e em dia, mais a igreja é representada no Conselho.
        </p>
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar contato da igreja
          </button>
        </div>
      </form>
    </section>
  )
}

// ---------------------------------------------------------------------
// Aba "Ministros"
// ---------------------------------------------------------------------

function MinistrosDaIgreja({
  ministros,
  pedidos,
  titulos,
  igrejas,
  nomeDaIgreja,
  concluir,
}: {
  ministros: MinistroDaMinhaIgreja[]
  pedidos: PedidoCorrecao[]
  titulos: Titulo[]
  igrejas: Igreja[]
  nomeDaIgreja: string
  concluir: (r: { erro: string | null }, sucesso: string) => void
}) {
  return (
    <>
      <section className="bloco" aria-labelledby="titulo-ministros-minha-igreja">
        <h3 id="titulo-ministros-minha-igreja">Ministros da igreja ({ministros.length})</h3>
        <ul className="lista-linhas" aria-label="Ministros da igreja">
          {ministros.map((m) => (
            <li key={m.pessoa_id} className="ministro-da-igreja">
              <span className="linha-corpo">
                <strong>
                  <span className="numero">Nº {String(m.numero_registro).padStart(4, '0')}</span> {m.nome}
                </strong>
                <span>{[m.titulo, m.funcao, m.pastor_presidente && 'pastor presidente'].filter(Boolean).join(' · ')}</span>
                {m.telefone && (
                  <span>
                    <a href={`tel:${m.telefone.replace(/[^\d+]/g, '')}`}>{m.telefone}</a>
                  </span>
                )}
                <details className="acao-recolhida">
                  <summary>Pedir correção no cadastro de {m.nome}</summary>
                  <FormCorrecao
                    pessoaId={m.pessoa_id}
                    rotulo={`Pedir correção no cadastro de ${m.nome}`}
                    dados={[
                      { campo: 'nome', atual: m.nome },
                      { campo: 'telefone', atual: m.telefone ?? '' },
                      { campo: 'titulo', atual: m.titulo ?? '' },
                      { campo: 'funcao', atual: m.funcao ?? '' },
                      { campo: 'igreja', atual: nomeDaIgreja },
                      { campo: 'email', atual: '' },
                    ]}
                    titulos={titulos}
                    igrejas={igrejas}
                    aoConcluir={concluir}
                  />
                </details>
              </span>
              {m.em_dia ? <Chip area="financas">Em dia</Chip> : <Chip area="pessoas">Em atraso</Chip>}
            </li>
          ))}
        </ul>
        <p className="detalhe">Em atraso = alguma contribuição vencida e não paga. Quem está em atraso não vota nem é votado (Art. 11).</p>
      </section>
      <section className="bloco" aria-labelledby="titulo-correcoes-igreja">
        <h3 id="titulo-correcoes-igreja">Pedidos de correção</h3>
        <ListaDePedidos pedidos={pedidos} nomes={new Map(ministros.map((m) => [m.pessoa_id, m.nome]))} />
      </section>
    </>
  )
}

// ---------------------------------------------------------------------
// Aba "Agenda": os empréstimos do patrimônio da igreja e a agenda do COMEP
// ---------------------------------------------------------------------

const SELO_EMPRESTIMO: Record<SituacaoEmprestimo, { tipo: TipoSelo; texto: string }> = {
  solicitado: { tipo: 'analise', texto: 'Esperando aprovação' },
  aprovado: { tipo: 'aprovado', texto: 'Aprovado' },
  retirado: { tipo: 'aprovado', texto: 'Retirado' },
  devolvido: { tipo: 'aprovado', texto: 'Devolvido' },
  recusado: { tipo: 'recusado', texto: 'Recusado' },
  cancelado: { tipo: 'recusado', texto: 'Cancelado' },
}

function periodo(e: Pick<Emprestimo, 'retirada' | 'devolucao'>) {
  const de = formatarData(e.retirada).slice(0, 5)
  const ate = formatarData(e.devolucao).slice(0, 5)
  return de === ate ? de : `${de} a ${ate}`
}

/** O empréstimo devolvido há mais de 30 dias sai da lista. */
function diaHaTrintaDias(): string {
  return new Date(Date.now() - 30 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Belem' })
}

function AgendaDaIgreja({ igreja }: { igreja: Igreja }) {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const [emprestimos] = useCarregar(listarEmprestimos)
  const [agenda] = useCarregar(async () => ok(await agendaProxima(perfis)))
  const limite = diaHaTrintaDias()

  return (
    <div className="duas-colunas duas-iguais">
      <section className="bloco" aria-labelledby="titulo-emprestimos-igreja">
        <div className="cabecalho-bloco">
          <h3 id="titulo-emprestimos-igreja">Empréstimos do patrimônio</h3>
          <Link to="/patrimonio" className="botao botao-secundario">
            Pedir emprestado
          </Link>
        </div>
        {emprestimos.situacao !== 'ok' ? (
          emprestimos.situacao === 'carregando' ? (
            <Carregando />
          ) : (
            <p className="vazio">Não foi possível carregar os empréstimos.</p>
          )
        ) : (
          (() => {
            const daIgreja = emprestimos.dados
              .filter((e) => e.igreja_id === igreja.id && e.devolucao >= limite)
              .sort((a, b) => a.retirada.localeCompare(b.retirada))
            return daIgreja.length === 0 ? (
              <p className="vazio">Nenhum empréstimo agora. O que a igreja pedir aparece aqui.</p>
            ) : (
              <ul className="lista-linhas" aria-label="Empréstimos da igreja">
                {daIgreja.map((e) => (
                  <li key={e.id}>
                    <Ladrilho area="financas" icone="patrimonio" tamanho={36} />
                    <Link to={`/patrimonio/emprestimos/${e.id}`} className="linha-corpo linha-link">
                      <strong>
                        {e.itens.map((i) => `${i.quantidade} × ${i.item?.nome ?? 'item'}`).join(', ')} · {periodo(e)}
                      </strong>
                      <span className="linha-selo">
                        <Selo tipo={SELO_EMPRESTIMO[e.situacao].tipo}>{SELO_EMPRESTIMO[e.situacao].texto}</Selo>
                        {e.situacao === 'retirado' && e.devolucao < hojeIso() && <span className="texto-atencao">devolução atrasada</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          })()
        )}
      </section>
      <section className="bloco" aria-labelledby="titulo-agenda-comep">
        <h3 id="titulo-agenda-comep">Agenda do COMEP</h3>
        {agenda.situacao !== 'ok' ? (
          <Carregando />
        ) : agenda.dados.length === 0 ? (
          <p className="vazio">Nada marcado para os próximos dias.</p>
        ) : (
          <ul className="agenda-lista" aria-label="Agenda do COMEP">
            {agenda.dados.map((a) => {
              const { dia, mes } = diaEMes(a.inicio)
              return (
                <li key={a.chave}>
                  <Link to={a.para} className="agenda-item">
                    <span className={`data-caixa area-${a.area}`} aria-hidden="true">
                      <strong>{dia}</strong>
                      <span>{mes}</span>
                    </span>
                    <span className="agenda-corpo">
                      <span className="somente-leitor">{`${dia}/${mes}: `}</span>
                      <strong>{a.titulo}</strong>
                      {a.detalhe && <span>{a.detalhe}</span>}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
