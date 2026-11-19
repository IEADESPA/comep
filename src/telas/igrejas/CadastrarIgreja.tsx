import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { listarAssociados } from '../../dados/associados'
import { listarDenominacoes, type Denominacao } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { listarItens, type ItemLista } from '../../dados/configuracoes'
import {
  cadastrarIgreja,
  enviarDocumentoIgreja,
  NOME_DA_NATUREZA,
  NOME_DO_DOCUMENTO,
  pedirCadastroIgreja,
  type DadosCadastroIgreja,
  type NaturezaJuridica,
  type TipoDocumentoIgreja,
} from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { cnpjValido, formatarData, hojeIso } from '../../utilitarios/formatos'
import { menorMandato } from '../../utilitarios/regularizacao'
import { EscolherArquivos, FormDiretoria, type ArquivoEscolhido } from './componentes'
import { diretoriaInicial, faltaNaDiretoria, membrosDaDiretoria, PASSOS_IGREJA, type EstadoDiretoria, type OpcaoMinistro } from './regras'

// Igrejas › Cadastrar igreja (aprovado nas rodadas 9 a 11, 18/11/2026):
//   * "A igreja tem registro?" — sim: o cadastro completo em 5 passos (dados com a natureza jurídica, endereço e
//     contato, pastor e diretoria com o mandato, documentos em partes de até 25 MB, revisar); ainda não: o cadastro
//     simples, com as limitações (sem empréstimos e sem perfil de pastor presidente);
//   * o mesmo passo a passo serve ao pastor que cadastra a própria igreja (quem="pastor"): ela fica em análise e a
//     secretaria confere item por item.

const VAZIO: DadosCadastroIgreja = {
  nome: '',
  sigla: '',
  denominacao_id: '',
  cnpj: '',
  natureza_juridica: 'organizacao_religiosa',
  fundada_em: '',
  membros: '',
  endereco: '',
  bairro_id: '',
  cep: '',
  telefone: '',
  email: '',
  site: '',
  convencao: '',
  presidente_nome: '',
}

type DocsDoCadastro = Record<'estatuto' | 'cartao_cnpj' | 'ata_diretoria' | 'alvara' | 'outro', ArquivoEscolhido[]>

export type Listas = { denominacoes: Denominacao[]; bairros: ItemLista[]; ministros: OpcaoMinistro[] }

/** /igrejas/nova — a secretaria (e a presidência) cadastram a igreja. */
export function CadastrarIgreja() {
  const [carga, recarregar] = useCarregar(async () => {
    const [denominacoes, bairros, associados] = await Promise.all([listarDenominacoes(), listarItens('bairros'), listarAssociados()])
    if (denominacoes.erro !== null) return denominacoes
    if (bairros.erro !== null) return bairros
    if (associados.erro !== null) return associados
    const ministros = associados.dados
      .filter((a) => a.situacao === 'ativo')
      .map((a) => ({ pessoa_id: a.pessoa_id, nome: a.nome, numero: a.numero_registro }))
    return ok<Listas>({ denominacoes: denominacoes.dados, bairros: bairros.dados, ministros })
  })
  const [temRegistro, setTemRegistro] = useState(true)
  return (
    <div className="tela-nova">
      <CabecalhoFuncao modulo="Igrejas" titulo="Cadastrar igreja" />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(listas) => (
          <>
            <fieldset className="pergunta-registro">
              <legend>A igreja tem registro?</legend>
              <label className={temRegistro ? 'opcao-cartao escolhida' : 'opcao-cartao'}>
                <input type="radio" name="tem-registro" checked={temRegistro} onChange={() => setTemRegistro(true)} />
                <span>
                  <strong>Sim, tem CNPJ, estatuto e ata</strong>
                  <span>cadastro completo, em 5 passos</span>
                </span>
              </label>
              <label className={!temRegistro ? 'opcao-cartao escolhida' : 'opcao-cartao'}>
                <input type="radio" name="tem-registro" checked={!temRegistro} onChange={() => setTemRegistro(false)} />
                <span>
                  <strong>Ainda não</strong>
                  <span>cadastro simples, com limitações</span>
                </span>
              </label>
            </fieldset>
            {temRegistro ? <PassoAPassoIgreja quem="secretaria" listas={listas} /> : <CadastroSemRegistro listas={listas} />}
          </>
        )}
      </MostrarCarga>
    </div>
  )
}

/** As limitações da igreja sem registro (os dois que não e os dois que sim). */
export function Limitacoes() {
  const linha = (bom: boolean, titulo: string, sub: string) => (
    <li className={bom ? 'limite-bom' : 'limite-ruim'}>
      <Icone nome={bom ? 'check' : 'x'} tamanho={18} traco={2.6} />
      <span>
        <strong>{titulo}</strong>
        <span>{sub}</span>
      </span>
    </li>
  )
  return (
    <ul className="lista-limites" aria-label="O que fica limitado">
      {linha(false, 'Não pede empréstimos do patrimônio', 'sem CNPJ, não há como fazer o contrato')}
      {linha(false, 'Ninguém recebe o perfil de pastor presidente', 'sem ata, não há mandato que o justifique')}
      {linha(true, 'Aparece na lista de igrejas, com nome, sigla e telefone', 'e os ministros dela podem ser associados')}
      {linha(true, 'Pode se regularizar quando quiser', 'mandando o CNPJ, o estatuto e a ata')}
    </ul>
  )
}

function CadastroSemRegistro({ listas }: { listas: Listas }) {
  const navigate = useNavigate()
  const [dados, setDados] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campo = (nome: keyof DadosCadastroIgreja) => ({
    value: dados[nome],
    onChange: (e: { target: { value: string } }) => setDados((d) => ({ ...d, [nome]: e.target.value })),
  })
  return (
    <div className="duas-colunas">
      <form
        className="bloco"
        aria-label="Cadastro simples, sem registro"
        onSubmit={async (e) => {
          e.preventDefault()
          setEnviando(true)
          const r = await cadastrarIgreja({ ...dados, cnpj: '', natureza_juridica: '', tem_registro: false, presidente_id: null })
          setEnviando(false)
          if (r.erro !== null) return setErro(r.erro)
          navigate(`/igrejas/${r.dados}`, { replace: true, state: { mensagem: 'Igreja cadastrada sem registro.' } })
        }}
      >
        <div className="grade-form">
          <label className="largura-total">
            Nome da igreja *
            <input required {...campo('nome')} />
          </label>
          <label>
            Sigla
            <input maxLength={20} autoCapitalize="characters" {...campo('sigla')} />
          </label>
          <CampoDenominacao listas={listas} {...campo('denominacao_id')} />
          <label>
            Telefone
            <input type="tel" {...campo('telefone')} />
          </label>
          <CampoBairro listas={listas} {...campo('bairro_id')} />
          <label className="largura-total">
            Pessoa de contato
            <input placeholder="Ex.: Pr. Fulano de Tal" {...campo('presidente_nome')} />
          </label>
        </div>
        <Mensagem erro={erro} />
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Cadastrar sem registro
          </button>
        </div>
      </form>
      <section className="bloco" aria-labelledby="titulo-limites">
        <h2 id="titulo-limites">Cadastro simples: o que fica limitado</h2>
        <Limitacoes />
      </section>
    </div>
  )
}

function CampoDenominacao({ listas, value, onChange, desc }: { listas: Listas; value: string; onChange: (e: { target: { value: string } }) => void; desc?: ReactNode }) {
  return (
    <label>
      Denominação *
      <select required value={value} onChange={onChange}>
        <option value="">— Escolha a denominação —</option>
        {listas.denominacoes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.sigla ? `${d.nome} (${d.sigla})` : d.nome}
          </option>
        ))}
      </select>
      {desc}
    </label>
  )
}

function CampoBairro({ listas, value, onChange }: { listas: Listas; value: string; onChange: (e: { target: { value: string } }) => void }) {
  return (
    <label>
      Bairro
      <select value={value} onChange={onChange}>
        <option value="">— Escolha o bairro —</option>
        {listas.bairros.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nome}
          </option>
        ))}
      </select>
    </label>
  )
}

function PassosNoAlto({ atual }: { atual: number }) {
  return (
    <>
      <ol className="passos-cadastro so-computador" aria-label="Passos do cadastro">
        {PASSOS_IGREJA.map((nome, i) => (
          <li key={nome} className={i < atual ? 'feito' : undefined} aria-current={i === atual ? 'step' : undefined}>
            <span className="numero-passo" aria-hidden="true">
              {i < atual ? <Icone nome="check" tamanho={16} traco={3} /> : i + 1}
            </span>
            {nome}
          </li>
        ))}
      </ol>
      <div className="passos-tracos so-celular" aria-hidden="true">
        {PASSOS_IGREJA.map((nome, i) => (
          <span key={nome} className={i <= atual ? 'feito' : undefined} />
        ))}
      </div>
    </>
  )
}

/** O que falta no passo (null: pode continuar). */
function faltaNoPasso(passo: number, dados: DadosCadastroIgreja): string | null {
  if (passo === 0) {
    if (dados.nome.trim().length < 3) return 'Informe o nome da igreja.'
    if (!dados.denominacao_id) return 'Escolha a denominação.'
    if (!cnpjValido(dados.cnpj)) return 'Informe um CNPJ válido (sem CNPJ, use o cadastro simples, sem registro).'
    if (!dados.natureza_juridica) return 'Diga a natureza jurídica que está no Cartão CNPJ.'
  }
  if (passo === 1) {
    if (dados.cep && dados.cep.replace(/\D/g, '').length !== 8) return 'O CEP tem 8 números.'
    if (dados.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dados.email.trim())) return 'O e-mail da igreja não está certo.'
  }
  return null
}

/**
 * O cadastro completo em 5 passos. A secretaria cadastra (e os documentos dela já entram conferidos); o pastor
 * manda para a secretaria conferir. Pastor: `eu` é ele mesmo (o pastor presidente da igreja nova).
 */
export function PassoAPassoIgreja({ quem, listas, eu }: { quem: 'secretaria' | 'pastor'; listas: Listas; eu?: OpcaoMinistro }) {
  const navigate = useNavigate()
  const [passo, setPasso] = useState(0)
  const [dados, setDados] = useState<DadosCadastroIgreja>(VAZIO)
  const [presidente, setPresidente] = useState<string>(eu?.pessoa_id ?? '')
  const [diretoria, setDiretoria] = useState<EstadoDiretoria>(() => diretoriaInicial([], eu ?? null))
  const [docs, setDocs] = useState<DocsDoCadastro>({ estatuto: [], cartao_cnpj: [], ata_diretoria: [], alvara: [], outro: [] })
  const [outroNome, setOutroNome] = useState('')
  const [alvaraDe, setAlvaraDe] = useState(hojeIso())
  const [alvaraAte, setAlvaraAte] = useState(`${hojeIso().slice(0, 4)}-12-31`)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const pastor = quem === 'pastor'

  const campo = (nome: keyof DadosCadastroIgreja) => ({
    value: dados[nome],
    onChange: (e: { target: { value: string } }) => setDados((d) => ({ ...d, [nome]: e.target.value })),
  })
  const ministroPresidente = listas.ministros.find((m) => m.pessoa_id === presidente) ?? (eu && eu.pessoa_id === presidente ? eu : undefined)
  const membros = membrosDaDiretoria(diretoria)
  const faltaDiretoria = faltaNaDiretoria(diretoria)
  const diretoriaPronta = faltaDiretoria === null

  function irPara(n: number) {
    setPasso(n)
    setErro(null)
    setTimeout(() => titulo.current?.focus(), 0)
  }

  /** Escolheu o pastor presidente: ele entra no cargo de Presidente da diretoria. */
  function escolherPresidente(id: string) {
    setPresidente(id)
    setDiretoria((d) => ({
      ...d,
      linhas: d.linhas.map((l, i) => (i === 0 && /presidente/i.test(l.cargo) && !/vice/i.test(l.cargo) ? { ...l, pessoa_id: id, nome: '' } : l)),
    }))
  }

  async function concluir() {
    setErro(null)
    setEnviando('Cadastrando a igreja…')
    const nomePresidente = ministroPresidente?.nome ?? dados.presidente_nome
    const r = pastor
      ? await pedirCadastroIgreja(dados)
      : await cadastrarIgreja({ ...dados, presidente_nome: nomePresidente, tem_registro: true, presidente_id: presidente || null })
    if (r.erro !== null) {
      setEnviando(null)
      return setErro(r.erro)
    }
    const id = r.dados
    const falhas: string[] = []
    const mandar = async (tipo: TipoDocumentoIgreja, arquivos: ArquivoEscolhido[], extra: Record<string, unknown>) => {
      if (arquivos.length === 0) return
      setEnviando(`Enviando: ${NOME_DO_DOCUMENTO[tipo]}…`)
      const e = await enviarDocumentoIgreja(id, { tipo, ...extra }, arquivos)
      if (e.erro !== null) falhas.push(`${NOME_DO_DOCUMENTO[tipo]} (${e.erro})`)
    }
    await mandar('estatuto', docs.estatuto, {})
    await mandar('cartao_cnpj', docs.cartao_cnpj, { natureza: dados.natureza_juridica })
    if (diretoriaPronta) await mandar('ata_diretoria', docs.ata_diretoria, { diretoria: membros })
    await mandar('alvara', docs.alvara, { valido_de: alvaraDe, valido_ate: alvaraAte })
    if (outroNome.trim()) await mandar('outro', docs.outro, { descricao: outroNome })
    setEnviando(null)
    const aviso = falhas.length > 0 ? ` Mas não foi possível enviar: ${falhas.join('; ')}. Mande de novo.` : ''
    if (pastor) {
      navigate('/cadastrar-minha-igreja', { replace: true, state: { mensagem: `Cadastro enviado para a secretaria conferir.${aviso}` } })
    } else {
      navigate(`/igrejas/${id}`, { replace: true, state: { mensagem: `Igreja cadastrada.${aviso}` } })
    }
  }

  const faltaAgora = faltaNoPasso(passo, dados)
  const docsObrigatorios = (['estatuto', 'cartao_cnpj', 'ata_diretoria'] as const).filter((t) => docs[t].length === 0)

  return (
    <form
      className="cadastro-passo"
      aria-label={pastor ? 'Cadastrar a minha igreja' : 'Cadastrar igreja'}
      onSubmit={(e) => {
        e.preventDefault()
        if (faltaAgora) return setErro(faltaAgora)
        if (passo < PASSOS_IGREJA.length - 1) irPara(passo + 1)
        else void concluir()
      }}
    >
      <PassosNoAlto atual={passo} />
      <section className="bloco">
        <h2 ref={titulo} tabIndex={-1}>
          <span className="so-celular">
            {passo + 1} de {PASSOS_IGREJA.length} ·{' '}
          </span>
          <span className="so-computador">{passo + 1} · </span>
          {PASSOS_IGREJA[passo]}
        </h2>

        {passo === 0 && (
          <>
            <div className="grade-form">
              <label className="largura-total">
                Nome da igreja *
                <input required autoComplete="off" placeholder="Nome completo da igreja" {...campo('nome')} />
              </label>
              <label>
                Sigla (vai na credencial)
                <input maxLength={20} autoCapitalize="characters" placeholder="Ex.: IMS" {...campo('sigla')} />
              </label>
              <CampoDenominacao listas={listas} {...campo('denominacao_id')} />
              <label>
                CNPJ *
                <input required inputMode="text" autoCapitalize="characters" placeholder="00.000.000/0000-00" {...campo('cnpj')} />
              </label>
              <label>
                Fundada em (ano)
                <input inputMode="numeric" maxLength={4} placeholder="Ex.: 2014" {...campo('fundada_em')} />
              </label>
              <label>
                Membros (aproximado)
                <input inputMode="numeric" maxLength={7} placeholder="Ex.: 120" {...campo('membros')} />
              </label>
            </div>
            <fieldset className="opcoes-radio">
              <legend>Natureza jurídica (como está no Cartão CNPJ) *</legend>
              {(Object.keys(NOME_DA_NATUREZA) as NaturezaJuridica[]).map((n) => (
                <label key={n} className="caixa-marcar">
                  <input type="radio" name="natureza" checked={dados.natureza_juridica === n} onChange={() => setDados((d) => ({ ...d, natureza_juridica: n }))} />
                  {NOME_DA_NATUREZA[n]} {n === 'organizacao_religiosa' ? '· o certo para uma igreja' : '· aceita, com prazo para mudar'}
                </label>
              ))}
            </fieldset>
            {dados.natureza_juridica === 'associacao_privada' && (
              <div className="faixa-resultado faixa-atencao">
                <strong>Associação privada: aceita com prazo</strong>
                <span>
                  1 · Até o fim do mandato desta diretoria: eleger a nova e, na mesma ata, mudar a natureza para organização religiosa. 2 · Depois
                  da ata, o prazo para mandar o Cartão CNPJ novo (90 dias; muda na Central de regularização). Igreja é organização religiosa,
                  não associação (Código Civil, art. 44, IV): essa diferença foi uma conquista dos pastores que vieram antes.
                </span>
              </div>
            )}
            <p className="detalhe">
              {pastor ? 'Não achou a denominação? Fale com a secretaria, que cadastra.' : 'Não achou a denominação? Cadastre em Denominações.'}
            </p>
          </>
        )}

        {passo === 1 && (
          <div className="grade-form">
            <label className="largura-total">
              Endereço (rua e número)
              <input {...campo('endereco')} />
            </label>
            <CampoBairro listas={listas} {...campo('bairro_id')} />
            <label>
              Cidade
              <input value="Parauapebas (PA)" disabled />
            </label>
            <label>
              CEP
              <input inputMode="numeric" placeholder="68515-000" {...campo('cep')} />
            </label>
            <label>
              Telefone da igreja
              <input type="tel" {...campo('telefone')} />
            </label>
            <label>
              E-mail da igreja
              <input type="email" {...campo('email')} />
            </label>
            <label>
              Site da igreja
              <input placeholder="Ex.: minhaigreja.com.br" {...campo('site')} />
            </label>
            <label className="largura-total">
              Convenção estadual ou nacional (se tiver)
              <input placeholder="Opcional: ajuda o COMEP a entender o mapa da cidade" {...campo('convencao')} />
            </label>
          </div>
        )}

        {passo === 2 && (
          <>
            <section className="sub-bloco" aria-label="Pastor presidente">
              <h3>Pastor presidente</h3>
              {pastor && eu ? (
                <p>
                  <strong>Você: {eu.nome}</strong>
                  {eu.numero ? ` · ministro associado nº ${String(eu.numero).padStart(4, '0')}` : ''}
                </p>
              ) : (
                <>
                  <label>
                    Ministro associado
                    <select value={presidente} onChange={(e) => escolherPresidente(e.target.value)}>
                      <option value="">— Ainda não é associado (escrever o nome) —</option>
                      {listas.ministros.map((m) => (
                        <option key={m.pessoa_id} value={m.pessoa_id}>
                          {m.nome}
                          {m.numero ? ` (nº ${String(m.numero).padStart(4, '0')})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {presidente ? (
                    <p className="detalhe">
                      Ele passa a ser ligado a esta igreja como pastor presidente (e recebe o perfil); a igreja anterior fica no histórico.
                    </p>
                  ) : (
                    <label>
                      Nome completo do pastor presidente
                      <input {...campo('presidente_nome')} />
                    </label>
                  )}
                </>
              )}
            </section>
            <section className="sub-bloco" aria-label="Diretoria da igreja">
              <h3>Diretoria da igreja e o mandato</h3>
              <FormDiretoria
                estado={diretoria}
                aoMudar={setDiretoria}
                ministros={pastor && eu ? [eu] : listas.ministros}
                textoMinistro={pastor ? 'Os outros cargos entram pelo nome completo; a secretaria confere.' : undefined}
              />
              <p className="detalhe">A diretoria vai com a ata da eleição (no passo 4): vale pela ata.</p>
            </section>
          </>
        )}

        {passo === 3 && (
          <div className="documentos-cadastro">
            <CartaoDocumento titulo="Estatuto da igreja" obrigatorio>
              <EscolherArquivos arquivos={docs.estatuto} aoMudar={(a) => setDocs((d) => ({ ...d, estatuto: a }))} rotulo="o estatuto" />
            </CartaoDocumento>
            <CartaoDocumento titulo="Cartão CNPJ" obrigatorio sub={dados.natureza_juridica ? NOME_DA_NATUREZA[dados.natureza_juridica] : undefined}>
              <EscolherArquivos arquivos={docs.cartao_cnpj} aoMudar={(a) => setDocs((d) => ({ ...d, cartao_cnpj: a }))} rotulo="o Cartão CNPJ" />
            </CartaoDocumento>
            <CartaoDocumento
              titulo="Ata da eleição da diretoria"
              obrigatorio
              sub={diretoriaPronta ? `a diretoria do passo 3, até ${formatarData(menorMandato(membros))}` : `antes, complete o passo 3: ${faltaDiretoria}`}
            >
              <EscolherArquivos arquivos={docs.ata_diretoria} aoMudar={(a) => setDocs((d) => ({ ...d, ata_diretoria: a }))} rotulo="a ata" />
            </CartaoDocumento>
            <CartaoDocumento titulo="Alvará de licenciamento" sub="para ser regular (inclui bombeiros e vigilância sanitária)">
              <div className="grade-form">
                <label>
                  Vale a partir de
                  <input type="date" value={alvaraDe} onChange={(e) => setAlvaraDe(e.target.value)} />
                </label>
                <label>
                  Vale até
                  <input type="date" value={alvaraAte} onChange={(e) => setAlvaraAte(e.target.value)} />
                </label>
              </div>
              <EscolherArquivos arquivos={docs.alvara} aoMudar={(a) => setDocs((d) => ({ ...d, alvara: a }))} rotulo="o alvará" />
            </CartaoDocumento>
            <CartaoDocumento titulo="Outro documento" sub="opcional">
              <label>
                Que documento é?
                <input value={outroNome} maxLength={300} onChange={(e) => setOutroNome(e.target.value)} />
              </label>
              {outroNome.trim() && <EscolherArquivos arquivos={docs.outro} aoMudar={(a) => setDocs((d) => ({ ...d, outro: a }))} rotulo="o documento" />}
            </CartaoDocumento>
            <p className="detalhe">
              {pastor
                ? 'A secretaria confere cada documento. Se faltar algo, o aviso chega pelo sino e você manda só o que voltou.'
                : 'Com os documentos em mãos, a secretaria confere na hora: mandados por aqui, eles já entram conferidos.'}
            </p>
          </div>
        )}

        {passo === 4 && (
          <dl className="revisar-cadastro">
            <Revisao titulo="Dados da igreja" aoEditar={() => irPara(0)}>
              {[dados.sigla ? `${dados.nome} (${dados.sigla.toUpperCase()})` : dados.nome, listas.denominacoes.find((d) => d.id === dados.denominacao_id)?.nome, `CNPJ ${dados.cnpj}`, dados.natureza_juridica && NOME_DA_NATUREZA[dados.natureza_juridica]]
                .filter(Boolean)
                .join(' · ')}
            </Revisao>
            <Revisao titulo="Endereço e contato" aoEditar={() => irPara(1)}>
              {[dados.endereco, listas.bairros.find((b) => b.id === dados.bairro_id)?.nome, 'Parauapebas (PA)', dados.telefone, dados.email].filter(Boolean).join(' · ')}
            </Revisao>
            <Revisao titulo="Pastor e diretoria" aoEditar={() => irPara(2)}>
              {[ministroPresidente?.nome ?? (dados.presidente_nome || 'pastor presidente não informado'), diretoriaPronta ? `${membros.length} cargos · até ${formatarData(menorMandato(membros))}` : 'diretoria incompleta']
                .filter(Boolean)
                .join(' · ')}
            </Revisao>
            <Revisao titulo="Documentos" aoEditar={() => irPara(3)}>
              {(['estatuto', 'cartao_cnpj', 'ata_diretoria', 'alvara'] as const)
                .filter((t) => docs[t].length > 0)
                .map((t) => NOME_DO_DOCUMENTO[t])
                .join(', ') || 'nenhum'}
            </Revisao>
          </dl>
        )}
        {passo === 4 && (docsObrigatorios.length > 0 || !diretoriaPronta) && (
          <p className="aviso-texto">
            {docsObrigatorios.length > 0 && `Faltam: ${docsObrigatorios.map((t) => NOME_DO_DOCUMENTO[t]).join(', ')}. `}
            {!diretoriaPronta && 'Sem a diretoria completa, a ata não vai agora. '}
            {pastor
              ? 'Você pode mandar depois, em "Minha igreja": a secretaria só ativa a igreja com tudo conferido.'
              : 'Dá para mandar depois, na ficha da igreja. Sem eles, a igreja fica com a pendência até o fim da transição (28/04/2027) e depois é suspensa.'}
          </p>
        )}
        {passo === 4 && (
          <p className="detalhe">
            {pastor
              ? 'Ao enviar, a secretaria confere item por item. Você acompanha tudo em "Minha igreja".'
              : 'Como é a secretaria que cadastra, com os documentos conferidos, a igreja já entra ativa.'}
          </p>
        )}
      </section>

      <Mensagem erro={erro} />
      {enviando && (
        <p className="detalhe" role="status">
          {enviando}
        </p>
      )}
      <div className="botoes-passo">
        {passo > 0 ? (
          <button type="button" className="botao botao-secundario" onClick={() => irPara(passo - 1)}>
            ← Voltar
          </button>
        ) : (
          <Link to={pastor ? '/painel' : '/igrejas'} className="botao botao-secundario">
            Cancelar
          </Link>
        )}
        <button type="submit" className="botao" disabled={enviando !== null}>
          {passo < PASSOS_IGREJA.length - 1 ? `Continuar → ${PASSOS_IGREJA[passo + 1]}` : pastor ? 'Enviar para a secretaria' : 'Cadastrar a igreja'}
        </button>
      </div>
    </form>
  )
}

function CartaoDocumento({ titulo, obrigatorio, sub, children }: { titulo: string; obrigatorio?: boolean; sub?: string; children: ReactNode }) {
  return (
    <section className="cartao-documento" aria-label={titulo}>
      <h3>
        {titulo} <span>· {obrigatorio ? 'obrigatório' : 'opcional'}</span>
      </h3>
      {sub && <p className="detalhe">{sub}</p>}
      {children}
    </section>
  )
}

function Revisao({ titulo, aoEditar, children }: { titulo: string; aoEditar: () => void; children: ReactNode }) {
  return (
    <div className="revisar-linha">
      <dt>{titulo}</dt>
      <dd>{children}</dd>
      <button type="button" className="botao-link" onClick={aoEditar}>
        Editar
      </button>
    </div>
  )
}
