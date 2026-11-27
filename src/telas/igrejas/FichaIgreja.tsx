import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Aviso, BotaoConfirmar, Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Ladrilho } from '../../componentes/Icone'
import { AbasDaTela, Chip, Selo, type Aba } from '../../componentes/Telas'
import { listarAssociados } from '../../dados/associados'
import { arquivarIgreja, atualizarIgreja, buscarIgreja, listarDenominacoes, ministrosDaIgreja, type Denominacao, type Igreja, type MinistroDaIgreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens, type ItemLista } from '../../dados/configuracoes'
import {
  conferirDocumentoIgreja,
  listarDiretoriaIgreja,
  listarDocumentosIgreja,
  NOME_DA_NATUREZA,
  regularizarIgreja,
  situacaoDaIgreja,
  type DocumentoIgreja,
  type MembroDiretoriaIgreja,
  type NaturezaJuridica,
  type SituacaoIgreja,
} from '../../dados/igrejas'
import { listarEmprestimos, type SituacaoEmprestimo } from '../../dados/patrimonio'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { cnpjValido, formatarCnpj, formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'
import { MANDE_AQUI, NOME_DO_ITEM, oQueSuspendeu, textoDosDiasParaMandar } from '../../utilitarios/regularizacao'
import { Limitacoes } from './CadastrarIgreja'
import { FormDocumento, LinhaDocumento, SeloNivel, type Concluir } from './componentes'
import { descreverSituacao, diretoriaEmVigor, type OpcaoMinistro } from './regras'
import { FiliaisDaIgreja } from './Filiais'

// Igrejas › a igreja aberta pela secretaria (aprovada na rodada 8, "a igreja em abas"; a aba Situação na rodada 12):
// Dados, Documentos (a secretaria confere e também manda pela igreja), Diretoria (a mudança para conferir, como
// estava e como fica), Ministros, Filiais, Agenda (a secretaria registra o empréstimo direto) e Situação (regular,
// suspensa ou sem registro, o caminho para regularizar e arquivar).

const ABAS = (id: string): Aba[] => [
  { para: `/igrejas/${id}`, nome: 'Dados' },
  { para: `/igrejas/${id}/documentos`, nome: 'Documentos', curto: 'Docs' },
  { para: `/igrejas/${id}/diretoria`, nome: 'Diretoria' },
  { para: `/igrejas/${id}/ministros`, nome: 'Ministros' },
  { para: `/igrejas/${id}/filiais`, nome: 'Filiais' },
  { para: `/igrejas/${id}/agenda`, nome: 'Agenda' },
  { para: `/igrejas/${id}/situacao`, nome: 'Situação' },
]

/** /igrejas/:id e /igrejas/:id/:aba */
export function FichaIgreja() {
  const { id = '', aba = 'dados' } = useParams()
  return <Ficha key={id} id={id} aba={aba} />
}

type DadosFicha = {
  igreja: Igreja | null
  situacao: SituacaoIgreja | null
  documentos: DocumentoIgreja[]
  diretoria: MembroDiretoriaIgreja[]
  ministros: MinistroDaIgreja[]
  denominacoes: Denominacao[]
  bairros: ItemLista[]
}

function Ficha({ id, aba }: { id: string; aba: string }) {
  const location = useLocation()
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({ sucesso: (location.state as { mensagem?: string } | null)?.mensagem })
  const [abaDaMensagem, setAbaDaMensagem] = useState(aba)
  const mensagem = abaDaMensagem === aba ? retorno : {}
  const [carga, recarregar] = useCarregar(async () => {
    const [igreja, situacao, documentos, diretoria, ministros, denominacoes, bairros] = await Promise.all([
      buscarIgreja(id),
      situacaoDaIgreja(id),
      listarDocumentosIgreja(id),
      listarDiretoriaIgreja(id),
      ministrosDaIgreja(id),
      listarDenominacoes(),
      listarItens('bairros'),
    ])
    for (const r of [igreja, documentos, diretoria, ministros, denominacoes, bairros]) if (r.erro !== null) return r
    return ok<DadosFicha>({
      igreja: igreja.dados,
      situacao: situacao.erro === null ? situacao.dados : null,
      documentos: documentos.dados ?? [],
      diretoria: diretoria.dados ?? [],
      ministros: ministros.dados ?? [],
      denominacoes: denominacoes.dados ?? [],
      bairros: bairros.dados ?? [],
    })
  })
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    setAbaDaMensagem(aba)
    if (r.erro === null) recarregar()
  }

  return (
    <div className="tela-nova">
      <p className="trilha">
        <Link to="/igrejas/lista">← Igrejas</Link>
      </p>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(d) => {
          const { igreja } = d
          if (!igreja) {
            return (
              <Aviso titulo="Igreja não encontrada">
                <p>Ela pode ter sido arquivada.</p>
              </Aviso>
            )
          }
          if (igreja.cadastro === 'em_analise') {
            return (
              <Aviso titulo="Igreja em análise">
                <p>
                  O pastor cadastrou esta igreja e a secretaria ainda está conferindo. <Link to={`/igrejas/conferir/${igreja.id}`}>Abrir a análise</Link>
                </p>
              </Aviso>
            )
          }
          const pendentes = d.documentos.filter((x) => x.situacao === 'pendente').length
          return (
            <>
              <section className="bloco cabecalho-ficha" aria-label="A igreja">
                <Ladrilho area="pessoas" icone="igreja" tamanho={56} />
                <span className="cabecalho-ficha-texto">
                  <span className="cabecalho-ficha-modulo">Igrejas ›</span>
                  <h1>{igreja.nome}</h1>
                  <span className="chips">
                    {d.situacao && <SeloNivel nivel={d.situacao.situacao} />}
                    {igreja.denominacao && <Chip area="assembleias">{igreja.denominacao.nome}</Chip>}
                    <Chip area="pessoas">{d.ministros.length === 1 ? '1 ministro' : `${d.ministros.length} ministros`}</Chip>
                    {pendentes > 0 && <Chip area="eventos">{pendentes === 1 ? '1 item para conferir' : `${pendentes} itens para conferir`}</Chip>}
                  </span>
                </span>
              </section>
              <AbasDaTela rotulo="Partes da igreja" abas={ABAS(igreja.id)} />
              <Mensagem sucesso={mensagem.sucesso} erro={mensagem.erro} />
              {aba === 'documentos' ? (
                <AbaDocumentos igreja={igreja} documentos={d.documentos} diretoria={d.diretoria} ministros={d.ministros} concluir={concluir} />
              ) : aba === 'diretoria' ? (
                <AbaDiretoria igreja={igreja} documentos={d.documentos} diretoria={d.diretoria} concluir={concluir} />
              ) : aba === 'ministros' ? (
                <AbaMinistros ministros={d.ministros} />
              ) : aba === 'filiais' ? (
                igreja.cadastro === 'completo' ? (
                  <FiliaisDaIgreja
                    igrejaId={igreja.id}
                    ministros={d.ministros.map((m) => ({ pessoa_id: m.pessoa_id, nome: m.nome }))}
                    bairros={d.bairros}
                    podeMudar
                  />
                ) : (
                  <p className="vazio">A igreja sem registro não tem filiais no COMEP.</p>
                )
              ) : aba === 'agenda' ? (
                <AbaAgenda igreja={igreja} situacao={d.situacao} />
              ) : aba === 'situacao' ? (
                <AbaSituacao igreja={igreja} situacao={d.situacao} ministros={d.ministros} concluir={concluir} />
              ) : (
                <AbaDados igreja={igreja} denominacoes={d.denominacoes} bairros={d.bairros} concluir={concluir} />
              )}
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

// ---------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------

function AbaDados({ igreja, denominacoes, bairros, concluir }: { igreja: Igreja; denominacoes: Denominacao[]; bairros: ItemLista[]; concluir: Concluir }) {
  const [d, setD] = useState({
    nome: igreja.nome,
    sigla: igreja.sigla ?? '',
    denominacao_id: igreja.denominacao_id ?? '',
    cnpj: formatarCnpj(igreja.cnpj),
    natureza_juridica: igreja.natureza_juridica ?? '',
    fundada_em: igreja.fundada_em ? String(igreja.fundada_em) : '',
    membros: igreja.membros ? String(igreja.membros) : '',
    endereco: igreja.endereco ?? '',
    bairro_id: igreja.bairro_id ?? '',
    cep: igreja.cep ?? '',
    telefone: igreja.telefone ?? '',
    email: igreja.email ?? '',
    site: igreja.site ?? '',
    convencao: igreja.convencao ?? '',
    presidente_nome: igreja.presidente_nome ?? '',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  const registro = igreja.cadastro === 'completo'
  const campo = (nome: keyof typeof d) => ({ value: d[nome], onChange: (e: { target: { value: string } }) => setD((x) => ({ ...x, [nome]: e.target.value })) })

  async function salvar() {
    setErro(null)
    const cnpj = d.cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (registro && cnpj && !cnpjValido(cnpj)) return setErro('CNPJ inválido. Confira os números.')
    const cep = d.cep.replace(/\D/g, '')
    if (cep && cep.length !== 8) return setErro('O CEP tem 8 números.')
    const site = d.site.trim()
    const r = await atualizarIgreja(igreja.id, {
      nome: d.nome,
      sigla: d.sigla.toUpperCase(),
      denominacao_id: d.denominacao_id || null,
      ...(registro ? { cnpj: cnpj || null, natureza_juridica: (d.natureza_juridica || null) as NaturezaJuridica | null } : {}),
      fundada_em: d.fundada_em ? Number(d.fundada_em) : null,
      membros: d.membros ? Number(d.membros.replace(/\D/g, '')) : null,
      endereco: d.endereco,
      bairro_id: d.bairro_id || null,
      cep: cep || null,
      telefone: d.telefone,
      email: d.email.toLowerCase(),
      site: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : '',
      convencao: d.convencao,
      presidente_nome: d.presidente_nome,
    })
    concluir(r, 'Alterações salvas.')
  }

  return (
    <form
      className="aba-conteudo"
      aria-label="Dados da igreja"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(salvar)
      }}
    >
      <div className="grade-form">
        <label className="largura-total">
          Nome da igreja *
          <input required {...campo('nome')} />
        </label>
        <label>
          Sigla (vai na credencial)
          <input maxLength={20} autoCapitalize="characters" {...campo('sigla')} />
        </label>
        <label>
          Denominação
          <select {...campo('denominacao_id')}>
            <option value="">— Não informada —</option>
            {denominacoes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
            {igreja.denominacao_id && !denominacoes.some((x) => x.id === igreja.denominacao_id) && (
              <option value={igreja.denominacao_id}>{igreja.denominacao?.nome} (arquivada)</option>
            )}
          </select>
        </label>
        {registro && (
          <>
            <label>
              CNPJ
              <input inputMode="text" autoCapitalize="characters" placeholder="00.000.000/0000-00" {...campo('cnpj')} />
            </label>
            <label>
              Natureza jurídica
              <select {...campo('natureza_juridica')}>
                <option value="">— Não informada —</option>
                {(Object.keys(NOME_DA_NATUREZA) as NaturezaJuridica[]).map((n) => (
                  <option key={n} value={n}>
                    {NOME_DA_NATUREZA[n]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Fundada em (ano)
          <input inputMode="numeric" maxLength={4} {...campo('fundada_em')} />
        </label>
        <label>
          Membros (aproximado)
          <input inputMode="numeric" maxLength={7} {...campo('membros')} />
        </label>
        <label className="largura-total">
          Endereço
          <input {...campo('endereco')} />
        </label>
        <label>
          Bairro
          <select {...campo('bairro_id')}>
            <option value="">— Não informado —</option>
            {bairros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          CEP
          <input inputMode="numeric" {...campo('cep')} />
        </label>
        <label>
          Telefone
          <input type="tel" {...campo('telefone')} />
        </label>
        <label>
          E-mail
          <input type="email" {...campo('email')} />
        </label>
        <label>
          Site
          <input {...campo('site')} />
        </label>
        <label>
          Convenção estadual ou nacional
          <input {...campo('convencao')} />
        </label>
        <label className="largura-total">
          {registro ? 'Pastor presidente (nome)' : 'Pessoa de contato'}
          <input {...campo('presidente_nome')} />
        </label>
      </div>
      {registro && <p className="detalhe">O pastor presidente que é ministro associado se marca na ficha dele (aba Igreja): é o que dá o perfil.</p>}
      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Salvar
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------

function AbaDocumentos({
  igreja,
  documentos,
  diretoria,
  ministros,
  concluir,
}: {
  igreja: Igreja
  documentos: DocumentoIgreja[]
  diretoria: MembroDiretoriaIgreja[]
  ministros: MinistroDaIgreja[]
  concluir: Concluir
}) {
  return (
    <div className="aba-conteudo">
      {documentos.length === 0 ? (
        <p className="vazio">Nenhum documento enviado.</p>
      ) : (
        <ul className="bloco lista-linhas lista-itens-pedido" aria-label="Documentos da igreja">
          {documentos.map((doc) => (
            <LinhaDocumento key={doc.id} d={doc} podeConferir aoConcluir={concluir} />
          ))}
        </ul>
      )}
      <p className="detalhe">Os documentos antigos ficam guardados (o histórico). O que vale hoje se calcula pelas datas.</p>
      <details className="acao-recolhida">
        <summary>Mandar um documento pela igreja</summary>
        <FormDocumento
          igrejaId={igreja.id}
          tipos={igreja.cadastro === 'sem_registro' ? ['estatuto', 'cartao_cnpj', 'ata_diretoria', 'outro'] : undefined}
          naturezaDaIgreja={igreja.natureza_juridica}
          ministros={ministros.map((m) => ({ pessoa_id: m.pessoa_id, nome: m.nome }))}
          diretoriaAtual={diretoriaEmVigor(documentos, diretoria).membros}
          aoConcluir={(r, s) => concluir(r, `${s} Mandado pela secretaria, já entra conferido.`)}
        />
      </details>
    </div>
  )
}

// ---------------------------------------------------------------------
// Diretoria: a em vigor (pela ata que vale hoje), a próxima e a mudança para conferir
// ---------------------------------------------------------------------

function AbaDiretoria({
  igreja,
  documentos,
  diretoria,
  concluir,
}: {
  igreja: Igreja
  documentos: DocumentoIgreja[]
  diretoria: MembroDiretoriaIgreja[]
  concluir: Concluir
}) {
  const [associados] = useCarregar(async () => {
    const r = await listarAssociados()
    return r.erro !== null ? r : ok(r.dados.filter((a) => a.situacao === 'ativo').map<OpcaoMinistro>((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome, numero: a.numero_registro })))
  })
  const { vigente, proxima, membros, daAta, antiga } = diretoriaEmVigor(documentos, diretoria)
  const pendentes = documentos.filter((d) => d.tipo === 'ata_diretoria' && d.situacao === 'pendente')
  return (
    <div className="aba-conteudo">
      {pendentes.map((ata) => (
        <MudancaParaConferir key={ata.id} ata={ata} nova={daAta(ata)} atual={membros} concluir={concluir} />
      ))}
      <section className="bloco" aria-labelledby="titulo-diretoria-vigor">
        <h2 id="titulo-diretoria-vigor">Diretoria em vigor</h2>
        {membros.length === 0 ? (
          <p className="vazio">Nenhuma diretoria com ata conferida valendo hoje.</p>
        ) : (
          <>
            <ul className="lista-linhas" aria-label="Diretoria em vigor">
              {membros.map((m) => (
                <li key={m.id}>
                  <span className="linha-corpo">
                    <strong>{m.cargo}</strong>
                    <span>{m.nome}</span>
                  </span>
                  {m.pessoa_id ? <Chip area="pessoas">ministro associado</Chip> : <Chip area="assembleias">nome completo</Chip>}
                  {m.fim && <span className="detalhe">até {formatarData(m.fim)}</span>}
                </li>
              ))}
            </ul>
            {vigente && (
              <p className="detalhe">
                Pela ata conferida: mandato de {formatarData(vigente.valido_de)} a {formatarData(vigente.valido_ate)} (vale o menor mandato).
              </p>
            )}
            {antiga && <p className="aviso-texto">Diretoria informada antes, sem a ata e sem o mandato por cargo. Registre a ata nova.</p>}
          </>
        )}
        {proxima && (
          <p className="faixa-resultado faixa-ok">
            <strong>A próxima diretoria já foi conferida</strong>
            <span>
              Entra sozinha em {formatarData(proxima.valido_de)} e vale até {formatarData(proxima.valido_ate)}.
            </span>
          </p>
        )}
      </section>
      <details className="acao-recolhida">
        <summary>Registrar a ata nova pela igreja</summary>
        {associados.situacao !== 'ok' ? (
          <Carregando />
        ) : (
          <FormDocumento
            igrejaId={igreja.id}
            tipoFixo="ata_diretoria"
            naturezaDaIgreja={igreja.natureza_juridica}
            ministros={associados.dados}
            diretoriaAtual={membros}
            textoBotao="Registrar a ata"
            aoConcluir={(r) => concluir(r, 'Ata registrada pela secretaria (já conferida).')}
          />
        )}
      </details>
    </div>
  )
}

/** A mudança da diretoria mandada pelo pastor: como estava e como fica, com Recusar e "Conferir e aceitar". */
function MudancaParaConferir({ ata, nova, atual, concluir }: { ata: DocumentoIgreja; nova: MembroDiretoriaIgreja[]; atual: MembroDiretoriaIgreja[]; concluir: Concluir }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const cargos = Array.from(new Set([...atual.map((m) => m.cargo), ...nova.map((m) => m.cargo)]))
  const decidir = (aceito: boolean) => umaVez(async () => concluir(await conferirDocumentoIgreja(ata.id, aceito, motivo), aceito ? 'Diretoria conferida e aceita.' : 'Mudança da diretoria recusada.'))
  return (
    <section className="bloco" aria-label="Mudança da diretoria para conferir">
      <span className="linha-selo">
        <Selo tipo="analise">Mudança para conferir</Selo>
        <span className="detalhe">enviada em {formatarDataDeInstante(ata.criado_em)}</span>
      </span>
      <ul className="lista-mudancas">
        <li>
          <strong>Mandato</strong>
          <span>
            {formatarData(ata.valido_de)} a {formatarData(ata.valido_ate)}
          </span>
        </li>
        {cargos.map((c) => {
          const antes = atual.find((m) => m.cargo === c)?.nome
          const depois = nova.find((m) => m.cargo === c)?.nome
          return (
            <li key={c}>
              <strong>{c}</strong>
              {antes === depois ? (
                <span className="detalhe">{depois} (igual)</span>
              ) : (
                <span>
                  {antes ? <s>{antes}</s> : <em>novo cargo</em>} → <strong>{depois ?? 'sai'}</strong>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {!recusando ? (
        <span className="acoes-item">
          <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => setRecusando(true)}>
            Recusar
          </button>
          <button type="button" className="botao" disabled={enviando} onClick={() => void decidir(true)}>
            Conferir e aceitar
          </button>
        </span>
      ) : (
        <form
          className="form-linha form-compacto"
          aria-label="Recusar a mudança da diretoria"
          onSubmit={(e) => {
            e.preventDefault()
            void decidir(false)
          }}
        >
          <label>
            Motivo *
            <input required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
            Recusar
          </button>
          <button type="button" className="botao-texto" onClick={() => setRecusando(false)}>
            Cancelar
          </button>
        </form>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------
// Ministros, Agenda e Situação
// ---------------------------------------------------------------------

function AbaMinistros({ ministros }: { ministros: MinistroDaIgreja[] }) {
  return (
    <section className="aba-conteudo" aria-label="Ministros da igreja">
      {ministros.length === 0 ? (
        <p className="vazio">Nenhum ministro associado ligado a esta igreja.</p>
      ) : (
        <ul className="bloco lista-linhas" aria-label="Ministros desta igreja">
          {ministros.map((m) => (
            <li key={m.pessoa_id}>
              <Link to={`/ministros/${m.pessoa_id}`} className="linha-corpo linha-link">
                <strong>{m.nome}</strong>
                <span>{[m.titulo, m.funcao, m.pastor_presidente && 'pastor presidente'].filter(Boolean).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="detalhe">Trocar um ministro de igreja se faz na ficha dele (aba Igreja); a anterior fica no histórico.</p>
    </section>
  )
}

const SELO_EMPRESTIMO: Record<SituacaoEmprestimo, string> = {
  solicitado: 'Esperando aprovação',
  aprovado: 'Aprovado',
  retirado: 'Retirado',
  devolvido: 'Devolvido',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

function AbaAgenda({ igreja, situacao }: { igreja: Igreja; situacao: SituacaoIgreja | null }) {
  const [carga, recarregar] = useCarregar(listarEmprestimos)
  const regular = situacao?.situacao === 'regular'
  return (
    <section className="aba-conteudo" aria-label="Agenda da igreja">
      <div className="cabecalho-bloco">
        <h2 className="titulo-secao">Empréstimos do patrimônio</h2>
        {regular ? (
          <Link to={`/patrimonio/pedir?igreja=${igreja.id}&direto=1`} className="botao">
            Registrar empréstimo
          </Link>
        ) : (
          <span className="detalhe">
            {situacao?.situacao === 'sem_registro' ? 'Sem registro, a igreja não pega empréstimos.' : 'Suspensa, a igreja não pega empréstimos.'}
          </span>
        )}
      </div>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(emprestimos) => {
          const daIgreja = emprestimos.filter((e) => e.igreja_id === igreja.id).sort((a, b) => b.retirada.localeCompare(a.retirada))
          return daIgreja.length === 0 ? (
            <p className="vazio">Nenhum empréstimo para esta igreja.</p>
          ) : (
            <ul className="bloco lista-linhas" aria-label="Empréstimos da igreja">
              {daIgreja.map((e) => (
                <li key={e.id}>
                  <Link to={`/patrimonio/emprestimos/${e.id}`} className="linha-corpo linha-link">
                    <strong>{e.itens.map((i) => `${i.quantidade} × ${i.item?.nome ?? 'item'}`).join(', ')}</strong>
                    <span>
                      {formatarData(e.retirada)} a {formatarData(e.devolucao)} · {SELO_EMPRESTIMO[e.situacao]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }}
      </MostrarCarga>
      <p className="detalhe">A secretaria registra direto, já aprovado; o pastor presidente pede pela "Minha igreja".</p>
    </section>
  )
}

function AbaSituacao({ igreja, situacao, ministros, concluir }: { igreja: Igreja; situacao: SituacaoIgreja | null; ministros: MinistroDaIgreja[]; concluir: Concluir }) {
  const navigate = useNavigate()
  const [enviando, umaVez] = useUmaVez()
  const hoje = hojeIso()
  const presidente = ministros.find((m) => m.pastor_presidente)
  return (
    <div className="aba-conteudo dois-blocos">
      <section className="bloco" aria-labelledby="titulo-situacao-igreja">
        <h2 id="titulo-situacao-igreja">Situação</h2>
        {situacao && (
          <>
            <span>
              <SeloNivel nivel={situacao.situacao} />
            </span>
            <p>{descreverSituacao(situacao, hoje)}</p>
            {situacao.pendencias.length > 0 && (
              <ul className="lista-pendencias" aria-label="O que falta">
                {situacao.pendencias.map((p) => (
                  <li key={p}>{NOME_DO_ITEM[p]}</li>
                ))}
              </ul>
            )}
            {situacao.situacao === 'suspensa' && (
              <div className="faixa-resultado faixa-perigo">
                <strong>Suspensa desde {formatarData(situacao.suspensa_desde)}</strong>
                <span>
                  {oQueSuspendeu(situacao).map((t) => `${t}. `).join('')}
                  {situacao.perfil_bloqueado
                    ? 'Acabou o prazo para mandar: o perfil de pastor presidente foi bloqueado (ele continua ministro associado).'
                    : `O pastor presidente tem até ${formatarData(situacao.prazo_ate)} para mandar ${situacao.vencidos.map((v) => MANDE_AQUI[v]).join(' e ')} (${textoDosDiasParaMandar(hoje, situacao.prazo_ate!)}).`}{' '}
                  A secretaria também pode mandar pela igreja, na aba Documentos.
                </span>
              </div>
            )}
          </>
        )}
        <dl className="definicoes">
          <dt>Cadastrada em</dt>
          <dd>{formatarDataDeInstante(igreja.criado_em)}</dd>
          <dt>Pastor presidente</dt>
          <dd>{presidente?.nome ?? igreja.presidente_nome ?? '—'}</dd>
          <dt>Ministros</dt>
          <dd>{ministros.length === 1 ? '1 associado' : `${ministros.length} associados`}</dd>
          {situacao?.alvara_ate && (
            <>
              <dt>Alvará</dt>
              <dd>até {formatarData(situacao.alvara_ate)}</dd>
            </>
          )}
          {situacao?.mandato_ate && (
            <>
              <dt>Mandato da diretoria</dt>
              <dd>até {formatarData(situacao.mandato_ate)}</dd>
            </>
          )}
          {situacao?.natureza_prazo && (
            <>
              <dt>Natureza</dt>
              <dd>associação privada · mudar até {formatarData(situacao.natureza_prazo)}</dd>
            </>
          )}
          {igreja.natureza_juridica && situacao?.situacao !== 'sem_registro' && (
            <>
              <dt>Natureza jurídica</dt>
              <dd>{NOME_DA_NATUREZA[igreja.natureza_juridica]}</dd>
            </>
          )}
        </dl>
      </section>
      {situacao?.situacao === 'sem_registro' && <Regularizar igreja={igreja} concluir={concluir} />}
      {situacao?.situacao === 'sem_registro' && (
        <section className="bloco" aria-labelledby="titulo-limitada">
          <h2 id="titulo-limitada">O que fica limitado</h2>
          <Limitacoes />
        </section>
      )}
      {
        <section className="bloco" aria-labelledby="titulo-arquivar-igreja">
          <h2 id="titulo-arquivar-igreja">Arquivar a igreja</h2>
          <p className="detalhe">Nada se apaga: a igreja sai das listas e o histórico fica guardado.</p>
          {ministros.length > 0 ? (
            <p className="detalhe">
              Antes, {ministros.length === 1 ? 'o ministro precisa ir' : `os ${ministros.length} ministros precisam ir`} para outra igreja (na ficha de
              cada um, aba Igreja).
            </p>
          ) : (
            <BotaoConfirmar
              texto="Arquivar a igreja"
              confirmar="Confirmar o arquivamento"
              aviso={`Arquivar "${igreja.nome}"?`}
              desabilitado={enviando}
              aoConfirmar={() =>
                void umaVez(async () => {
                  const r = await arquivarIgreja(igreja.id)
                  if (r.erro !== null) return concluir(r, '')
                  navigate('/igrejas/lista', { replace: true, state: { mensagem: `Igreja "${igreja.nome}" arquivada.` } })
                })
              }
            />
          )}
        </section>
      }
    </div>
  )
}

function Regularizar({ igreja, concluir }: { igreja: Igreja; concluir: Concluir }) {
  const [cnpj, setCnpj] = useState('')
  const [natureza, setNatureza] = useState<NaturezaJuridica>('organizacao_religiosa')
  const [enviando, umaVez] = useUmaVez()
  return (
    <form
      className="bloco"
      aria-label="Regularizar a igreja"
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => concluir(await regularizarIgreja(igreja.id, cnpj, natureza), 'Igreja regularizada: agora é cadastro completo. Mande os documentos.'))
      }}
    >
      <h2>Regularizar a igreja</h2>
      <p className="detalhe">
        Com o CNPJ, a igreja passa ao cadastro completo. Depois, mande o estatuto, o Cartão CNPJ, a ata e o alvará (aba Documentos):
        conferidos, as limitações saem.
      </p>
      <label>
        CNPJ *
        <input required value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
      </label>
      <fieldset className="opcoes-radio">
        <legend>Natureza jurídica (como está no Cartão CNPJ)</legend>
        {(Object.keys(NOME_DA_NATUREZA) as NaturezaJuridica[]).map((n) => (
          <label key={n} className="caixa-marcar">
            <input type="radio" name="natureza-regularizar" checked={natureza === n} onChange={() => setNatureza(n)} />
            {NOME_DA_NATUREZA[n]}
          </label>
        ))}
      </fieldset>
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando || !cnpjValido(cnpj)}>
          Regularizar a igreja
        </button>
      </div>
    </form>
  )
}
