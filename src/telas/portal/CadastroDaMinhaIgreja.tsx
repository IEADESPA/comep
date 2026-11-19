import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Aviso, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { Selo } from '../../componentes/Telas'
import { buscarIgreja, listarDenominacoes, type Igreja } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens } from '../../dados/configuracoes'
import {
  conferenciaDaIgrejaNova,
  corrigirCadastroIgreja,
  DOCUMENTOS_DA_REGULARIDADE,
  itensDaAnalise,
  listarDiretoriaIgreja,
  listarDocumentosIgreja,
  minhaIgreja,
  NOME_DA_NATUREZA,
  NOME_DO_DOCUMENTO,
  NOME_DO_ITEM_ANALISE,
  type ConferenciaItem,
  type DadosCadastroIgreja,
  type DocumentoIgreja,
  type ItemAnalise,
  type MembroDiretoriaIgreja,
  type TipoDocumentoIgreja,
} from '../../dados/igrejas'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, formatarDataDeInstante } from '../../utilitarios/formatos'
import { PassoAPassoIgreja, type Listas } from '../igrejas/CadastrarIgreja'
import { FormDocumento, type Concluir } from '../igrejas/componentes'
import { documentosDoTipo } from '../igrejas/regras'

// O pastor (ministro associado) cadastra a igreja dele pelo sistema (aprovado na rodada 9, 18/11/2026): os mesmos 5
// passos da secretaria, com os documentos; manda para a secretaria, que confere item por item. Depois ele acompanha,
// com o selo da secretaria em cada item, e manda de novo só o que voltou. Ativada, ele vira o pastor presidente dela.

type TelaDoCadastro =
  | {
      tela: 'acompanhar'
      igreja: Igreja | null
      itens: ConferenciaItem[]
      documentos: DocumentoIgreja[]
      diretoria: MembroDiretoriaIgreja[]
    }
  | { tela: 'tem'; nome: string }
  | { tela: 'cadastrar'; listas: Listas }

/** /cadastrar-minha-igreja — remonta a cada navegação (depois de enviar o cadastro, abre o acompanhamento) */
export function CadastroDaMinhaIgreja() {
  const location = useLocation()
  return <ConteudoDoCadastro key={location.key} />
}

function ConteudoDoCadastro() {
  const { estado } = useSessao()
  const conta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta : null
  const location = useLocation()
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({ sucesso: (location.state as { mensagem?: string } | null)?.mensagem })
  const [carga, recarregar] = useCarregar(async () => {
    const minha = await minhaIgreja()
    if (minha.erro !== null) return minha
    if (minha.dados?.cadastro === 'em_analise') {
      const id = minha.dados.igreja_id
      const [igreja, itens, documentos, diretoria] = await Promise.all([buscarIgreja(id), itensDaAnalise(id), listarDocumentosIgreja(id), listarDiretoriaIgreja(id)])
      if (igreja.erro !== null) return igreja
      if (itens.erro !== null) return itens
      if (documentos.erro !== null) return documentos
      if (diretoria.erro !== null) return diretoria
      return ok<TelaDoCadastro>({ tela: 'acompanhar', igreja: igreja.dados, itens: itens.dados, documentos: documentos.dados, diretoria: diretoria.dados })
    }
    if (minha.dados) return ok<TelaDoCadastro>({ tela: 'tem', nome: minha.dados.nome })
    const [denominacoes, bairros] = await Promise.all([listarDenominacoes(), listarItens('bairros')])
    if (denominacoes.erro !== null) return denominacoes
    if (bairros.erro !== null) return bairros
    const listas: Listas = { denominacoes: denominacoes.dados, bairros: bairros.dados, ministros: [] }
    return ok<TelaDoCadastro>({ tela: 'cadastrar', listas })
  })
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <div className="tela-nova">
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(d) => {
          if (d.tela === 'tem') {
            return (
              <Aviso titulo="Você já é pastor presidente de uma igreja no COMEP">
                <p>
                  {d.nome}: <Link to="/minha-igreja">abrir a Minha igreja</Link>
                </p>
              </Aviso>
            )
          }
          if (d.tela === 'cadastrar') {
            return (
              <>
                <div className="cabecalho-nova">
                  <h1>Cadastrar a minha igreja</h1>
                  <p className="sub-tela">Os mesmos passos da secretaria. No fim, você manda para ela conferir, sem precisar ir à sede.</p>
                </div>
                {conta && <PassoAPassoIgreja quem="pastor" listas={d.listas} eu={{ pessoa_id: conta.pessoaId, nome: conta.nome }} />}
              </>
            )
          }
          if (!d.igreja) return <Aviso titulo="Igreja não encontrada">Fale com a secretaria.</Aviso>
          return (
            <Acompanhar
              igreja={d.igreja}
              itens={d.itens}
              documentos={d.documentos}
              diretoria={d.diretoria}
              eu={conta ? { pessoa_id: conta.pessoaId, nome: conta.nome } : null}
              retorno={retorno}
              concluir={concluir}
            />
          )
        }}
      </MostrarCarga>
    </div>
  )
}

/** Os dados da igreja como o formulário do cadastro (para corrigir o que voltou). */
function dadosDe(i: Igreja): DadosCadastroIgreja {
  return {
    nome: i.nome,
    sigla: i.sigla ?? '',
    denominacao_id: i.denominacao_id ?? '',
    cnpj: i.cnpj ?? '',
    natureza_juridica: i.natureza_juridica ?? '',
    fundada_em: i.fundada_em ? String(i.fundada_em) : '',
    membros: i.membros ? String(i.membros) : '',
    endereco: i.endereco ?? '',
    bairro_id: i.bairro_id ?? '',
    cep: i.cep ?? '',
    telefone: i.telefone ?? '',
    email: i.email ?? '',
    site: i.site ?? '',
    convencao: i.convencao ?? '',
    presidente_nome: i.presidente_nome ?? '',
  }
}

function Acompanhar({
  igreja,
  itens,
  documentos,
  diretoria,
  eu,
  retorno,
  concluir,
}: {
  igreja: Igreja
  itens: ConferenciaItem[]
  documentos: DocumentoIgreja[]
  diretoria: MembroDiretoriaIgreja[]
  eu: { pessoa_id: string; nome: string } | null
  retorno: { sucesso?: string; erro?: string }
  concluir: Concluir
}) {
  const conferencia = conferenciaDaIgrejaNova(itens, documentos)
  const recusados = [
    ...itens.filter((i) => i.situacao === 'recusado').map((i) => `${NOME_DO_ITEM_ANALISE[i.item]}: ${i.motivo ?? ''}`),
    ...DOCUMENTOS_DA_REGULARIDADE.map((t) => documentosDoTipo(documentos, t).recusado)
      .filter((d): d is DocumentoIgreja => d !== undefined)
      .map((d) => `${NOME_DO_DOCUMENTO[d.tipo]}: ${d.motivo_recusa ?? ''}`),
  ]
  const ultimoDe = (t: TipoDocumentoIgreja) => documentos.filter((d) => d.tipo === t).sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0]
  const ata = ultimoDe('ata_diretoria')
  const daAta = ata ? diretoria.filter((m) => m.documento_id === ata.id) : []
  const detalhe: Record<ItemAnalise, string> = {
    dados: [igreja.nome, igreja.denominacao?.nome, igreja.natureza_juridica && NOME_DA_NATUREZA[igreja.natureza_juridica]].filter(Boolean).join(' · '),
    endereco: [igreja.endereco, igreja.bairro?.nome, igreja.telefone].filter(Boolean).join(' · ') || 'não informado',
    diretoria: daAta.length > 0 ? `${daAta.map((m) => `${m.cargo}: ${m.nome}`).join(' · ')} · até ${formatarData(ata?.valido_ate)}` : 'falta mandar a ata com a diretoria',
  }
  const passos = [
    { titulo: 'Cadastro enviado', detalhe: formatarDataDeInstante(igreja.criado_em), estado: 'feito' },
    { titulo: 'Conferência da secretaria', detalhe: `${conferencia.aprovados} de ${conferencia.total} itens aprovados`, estado: 'agora' },
    { titulo: 'Igreja ativa no COMEP', detalhe: 'quando tudo for aprovado', estado: 'depois' },
  ]
  return (
    <>
      <div className="cabecalho-nova">
        <h1>Minha igreja</h1>
        <p className="sub-tela">
          {igreja.nome} · cadastro enviado em {formatarDataDeInstante(igreja.criado_em)}
        </p>
      </div>
      <section className={recusados.length > 0 ? 'faixa-resultado faixa-perigo' : 'faixa-resultado'} aria-label="A conferência">
        <strong>{conferencia.tudo ? 'Tudo aprovado: falta a secretaria ativar a igreja' : 'A secretaria está conferindo'}</strong>
        <span>
          {conferencia.aprovados} de {conferencia.total} itens aprovados.
          {recusados.length > 0 && ` Voltou: ${recusados.join('; ')}. Mande de novo só o que voltou.`}
        </span>
      </section>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <div className="analise-colunas">
        <section aria-labelledby="titulo-conferiu" className="aba-conteudo">
          <h2 id="titulo-conferiu" className="titulo-secao">
            O que a secretaria conferiu
          </h2>
          <ul className="bloco lista-linhas lista-itens-pedido" aria-label="O que a secretaria conferiu">
            {(Object.keys(NOME_DO_ITEM_ANALISE) as ItemAnalise[]).map((item) => (
              <ItemDoPastor
                key={item}
                igreja={igreja}
                item={item}
                conferido={itens.find((i) => i.item === item)}
                detalhe={detalhe[item]}
                diretoria={daAta}
                eu={eu}
                concluir={concluir}
              />
            ))}
            {DOCUMENTOS_DA_REGULARIDADE.map((tipo) => (
              <DocumentoDoPastor key={tipo} igreja={igreja} tipo={tipo} d={ultimoDe(tipo)} concluir={concluir} />
            ))}
          </ul>
        </section>
        <section className="bloco" aria-labelledby="titulo-passos-igreja">
          <h2 id="titulo-passos-igreja">Os passos</h2>
          <ol className="passos">
            {passos.map((p, i) => (
              <li key={p.titulo} className={`passo passo-${p.estado}`}>
                <span className="passo-bola" aria-hidden="true">
                  {p.estado === 'feito' ? <Icone nome="check" tamanho={18} traco={3} /> : i + 1}
                </span>
                <span className="passo-texto">
                  <strong>{p.titulo}</strong>
                  <span>{p.detalhe}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  )
}

const SELO_ITEM = { analise: { tipo: 'analise', texto: 'Em análise' }, aprovado: { tipo: 'aprovado', texto: 'Aprovado pela secretaria' }, recusado: { tipo: 'recusado', texto: 'Recusado' } } as const

function ItemDoPastor({
  igreja,
  item,
  conferido,
  detalhe,
  diretoria,
  eu,
  concluir,
}: {
  igreja: Igreja
  item: ItemAnalise
  conferido: ConferenciaItem | undefined
  detalhe: string
  diretoria: MembroDiretoriaIgreja[]
  eu: { pessoa_id: string; nome: string } | null
  concluir: Concluir
}) {
  const [corrigindo, setCorrigindo] = useState(false)
  const situacao = conferido?.situacao ?? 'analise'
  const nome = NOME_DO_ITEM_ANALISE[item]
  return (
    <li aria-label={nome}>
      <span className="linha-corpo">
        <strong>{nome}</strong>
        <span>{detalhe}</span>
        <span className="linha-selo">
          <Selo tipo={SELO_ITEM[situacao].tipo}>{situacao === 'recusado' ? `Recusado: ${conferido?.motivo ?? ''}` : SELO_ITEM[situacao].texto}</Selo>
          {situacao === 'recusado' && !corrigindo && (
            <button type="button" className="botao-link" onClick={() => setCorrigindo(true)}>
              Enviar de novo
            </button>
          )}
        </span>
        {corrigindo && item !== 'diretoria' && (
          <CorrigirDados
            igreja={igreja}
            item={item}
            aoConcluir={(r, s) => {
              concluir(r, s)
              if (r.erro === null) setCorrigindo(false)
            }}
          />
        )}
        {corrigindo && item === 'diretoria' && (
          <FormDocumento
            igrejaId={igreja.id}
            tipoFixo="ata_diretoria"
            naturezaDaIgreja={igreja.natureza_juridica}
            ministros={eu ? [eu] : []}
            diretoriaAtual={diretoria}
            textoBotao="Mandar de novo"
            aoConcluir={(r) => concluir(r, 'Ata e diretoria enviadas de novo: a secretaria vai conferir.')}
          />
        )}
      </span>
    </li>
  )
}

function CorrigirDados({ igreja, item, aoConcluir }: { igreja: Igreja; item: 'dados' | 'endereco'; aoConcluir: Concluir }) {
  const [d, setD] = useState(() => dadosDe(igreja))
  const [enviando, umaVez] = useUmaVez()
  const campo = (nome: keyof DadosCadastroIgreja) => ({ value: d[nome], onChange: (e: { target: { value: string } }) => setD((x) => ({ ...x, [nome]: e.target.value })) })
  return (
    <form
      className="form-documento"
      aria-label={`Corrigir: ${NOME_DO_ITEM_ANALISE[item]}`}
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(async () => aoConcluir(await corrigirCadastroIgreja(igreja.id, item, d), `${NOME_DO_ITEM_ANALISE[item]}: enviado de novo para a secretaria.`))
      }}
    >
      <div className="grade-form">
        {item === 'dados' ? (
          <>
            <label className="largura-total">
              Nome da igreja *
              <input required {...campo('nome')} />
            </label>
            <label>
              Sigla
              <input maxLength={20} {...campo('sigla')} />
            </label>
            <label>
              CNPJ *
              <input required {...campo('cnpj')} />
            </label>
            <label>
              Fundada em (ano)
              <input inputMode="numeric" maxLength={4} {...campo('fundada_em')} />
            </label>
            <label>
              Membros (aproximado)
              <input inputMode="numeric" maxLength={7} {...campo('membros')} />
            </label>
          </>
        ) : (
          <>
            <label className="largura-total">
              Endereço
              <input {...campo('endereco')} />
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
            <label className="largura-total">
              Convenção estadual ou nacional
              <input {...campo('convencao')} />
            </label>
          </>
        )}
      </div>
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Mandar de novo
        </button>
      </div>
    </form>
  )
}

function DocumentoDoPastor({ igreja, tipo, d, concluir }: { igreja: Igreja; tipo: TipoDocumentoIgreja; d: DocumentoIgreja | undefined; concluir: Concluir }) {
  const [mandando, setMandando] = useState(false)
  const nome = NOME_DO_DOCUMENTO[tipo]
  const precisa = !d || d.situacao === 'recusado'
  return (
    <li aria-label={nome}>
      <span className="linha-corpo">
        <strong>{nome}</strong>
        <span className="linha-selo">
          {!d ? (
            <Selo tipo="recusado">{tipo === 'alvara' ? 'Ainda não veio (pode ir depois)' : 'Falta mandar'}</Selo>
          ) : d.situacao === 'conferido' ? (
            <Selo tipo="aprovado">Aprovado pela secretaria</Selo>
          ) : d.situacao === 'pendente' ? (
            <Selo tipo="analise">Em análise</Selo>
          ) : (
            <Selo tipo="recusado">Recusado: {d.motivo_recusa}</Selo>
          )}
          {precisa && !mandando && (
            <button type="button" className="botao-link" onClick={() => setMandando(true)}>
              {d ? 'Enviar de novo' : 'Mandar agora'}
            </button>
          )}
        </span>
        {mandando && (
          <FormDocumento
            igrejaId={igreja.id}
            tipoFixo={tipo}
            naturezaDaIgreja={igreja.natureza_juridica}
            ministros={[]}
            diretoriaAtual={[]}
            textoBotao="Mandar para a secretaria"
            aoConcluir={(r, s) => {
              concluir(r, `${s} A secretaria vai conferir.`)
              if (r.erro === null) setMandando(false)
            }}
          />
        )}
      </span>
    </li>
  )
}
