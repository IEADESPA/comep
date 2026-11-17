import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../componentes/Basicos'
import { avisosPublicos } from '../dados/avisos'
import { formatarReais } from '../dados/configuracoes'
import { convocacoesPublicas, NOME_DO_TIPO, type ConvocacaoPublica } from '../dados/encontros'
import { eventosPublicos, inscricaoAberta, inscrever, NOME_DO_TIPO_EVENTO, type EventoPublico, type InscricaoFeita } from '../dados/eventos'
import { useUmaVez } from '../estado/useUmaVez'
import { NOME_DO_CARGO } from '../dados/diretoria'
import { buscarDadosComep, diretoriaPublica, igrejasPublicas, numerosPublicos, type DadosComep, type MembroDaDiretoriaPublica } from '../dados/site'
import { useCarregar } from '../estado/useCarregar'
import { dataPorExtenso } from '../utilitarios/encontros'
import { contemTexto, formatarCnpj, formatarData, formatarDataHora } from '../utilitarios/formatos'

// Site institucional público. Todo o texto vem do Estatuto do COMEP (PROJETO.md, seção 13).
// Sede, contatos e CNPJ vêm de "Configurações → Dados do COMEP no site" (decisão 14); vazio aparece "—".

const SEM_DADO = '—'

/** Dados públicos do COMEP (null enquanto carrega ou se não carregou). */
function useDadosComep(): DadosComep | null {
  const [carga] = useCarregar(buscarDadosComep)
  return carga.situacao === 'ok' ? carga.dados : null
}

/** Link de rede social a partir do que a diretoria digitou (@usuario, endereço com ou sem https). */
function linkDaRede(valor: string, base: string): string {
  if (/^https?:\/\//i.test(valor)) return valor
  if (valor.startsWith('@')) return `${base}${valor.slice(1)}`
  if (valor.includes('.')) return `https://${valor}`
  return `${base}${valor}`
}

function soNumeros(valor: string): string {
  return valor.replace(/\D/g, '')
}

const FINALIDADES = [
  {
    titulo: 'Comunhão',
    texto:
      'Reuniões periódicas entre pastores de diversas denominações, para intercâmbio, amizade e companheirismo, respeitadas as diferenças doutrinárias.',
  },
  { titulo: 'Unidade', texto: 'Trabalhar em prol da unidade visível do corpo de Cristo.' },
  {
    titulo: 'Ação conjunta',
    texto:
      'Ações comuns entre igrejas e segmentos evangélicos em evangelização, cultura cristã, ensino, edificação e ação social.',
  },
  {
    titulo: 'Presença na cidade',
    texto:
      'Comissões em educação, segurança, saúde, política e cidadania, e representação dos membros junto às instituições e aos poderes públicos.',
  },
  {
    titulo: 'Voz profética',
    texto: 'Pronunciar-se nas grandes questões e acontecimentos municipais, estaduais e nacionais.',
  },
  {
    titulo: 'Formação',
    texto:
      'Encontros, seminários e conferências, com apoio e treinamento aos membros nas suas atribuições ministeriais.',
  },
] as const

function Simbolo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="16" cy="16" r="6.5" fill="currentColor" />
    </svg>
  )
}

function CabecalhoSite() {
  return (
    <header className="site-topo">
      <div className="site-largura site-topo-conteudo">
        <Link to="/" className="site-marca" aria-label="COMEP, página inicial">
          <Simbolo />
          <span>COMEP</span>
        </Link>
        <nav className="site-menu" aria-label="Site">
          <Link to="/agenda">Agenda</Link>
          <Link to="/diretoria">Diretoria</Link>
          <Link to="/igrejas">Igrejas</Link>
          <Link to="/painel" className="botao botao-pequeno">
            Portal do membro
          </Link>
        </nav>
      </div>
    </header>
  )
}

function RodapeSite() {
  const dados = useDadosComep()
  return (
    <footer className="site-rodape">
      <strong>COMEP — Conselho de Ministros Evangélicos de Parauapebas</strong>
      <span>Associação civil de natureza religiosa, sem fins lucrativos · Parauapebas, Pará</span>
      <span>CNPJ: {dados?.cnpj ? formatarCnpj(dados.cnpj) : SEM_DADO}</span>
    </footer>
  )
}

function ContatoComep() {
  const d = useDadosComep()
  const whatsapp = d?.whatsapp ? soNumeros(d.whatsapp) : ''
  const redes = [
    d?.instagram && { nome: 'Instagram', href: linkDaRede(d.instagram, 'https://instagram.com/'), texto: d.instagram },
    d?.facebook && { nome: 'Facebook', href: linkDaRede(d.facebook, 'https://facebook.com/'), texto: d.facebook },
    d?.youtube && { nome: 'YouTube', href: linkDaRede(d.youtube, 'https://youtube.com/@'), texto: d.youtube },
  ].filter((r): r is { nome: string; href: string; texto: string } => Boolean(r))

  return (
    <section className="site-secao site-secao-alt" aria-labelledby="titulo-contato">
      <div className="site-largura">
        <h2 id="titulo-contato">Fale com o COMEP</h2>
        <dl className="site-contatos">
          <div>
            <dt>Sede</dt>
            <dd>{d?.endereco_sede || SEM_DADO}</dd>
          </div>
          <div>
            <dt>Reuniões mensais</dt>
            <dd>{d?.reunioes_mensais || SEM_DADO}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{d?.telefone ? <a href={`tel:${soNumeros(d.telefone)}`}>{d.telefone}</a> : SEM_DADO}</dd>
          </div>
          <div>
            <dt>WhatsApp</dt>
            <dd>
              {d?.whatsapp ? (
                <a href={`https://wa.me/${whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp}`} target="_blank" rel="noreferrer">
                  {d.whatsapp}
                </a>
              ) : (
                SEM_DADO
              )}
            </dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{d?.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : SEM_DADO}</dd>
          </div>
          <div>
            <dt>Redes sociais</dt>
            <dd>
              {redes.length === 0
                ? SEM_DADO
                : redes.map((r, i) => (
                    <span key={r.nome}>
                      {i > 0 && ' · '}
                      <a href={r.href} target="_blank" rel="noreferrer" aria-label={`${r.nome}: ${r.texto}`}>
                        {r.nome}
                      </a>
                    </span>
                  ))}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

export function PaginaInicial() {
  return (
    <div className="site">
      <CabecalhoSite />
      <main>
        <section className="site-hero">
          <div className="site-largura">
            <p className="site-sobretitulo">COMEP</p>
            <h1>Conselho de Ministros Evangélicos de Parauapebas</h1>
            <p className="site-lead">
              Pastores e líderes de diferentes denominações, unidos em comunhão e no serviço à cidade, com Jesus Cristo
              como único Senhor e a Bíblia Sagrada como regra de fé e prática.
            </p>
            <div className="site-acoes">
              <Link to="/painel" className="botao botao-claro">
                Portal do membro
              </Link>
              <Link to="/associar" className="botao botao-contorno">
                Quero me associar
              </Link>
            </div>
          </div>
        </section>

        <section className="site-secao" aria-labelledby="quem-somos">
          <div className="site-largura">
            <h2 id="quem-somos">Quem somos</h2>
            <p>
              O COMEP é uma associação civil de natureza religiosa, sem fins lucrativos, formada por pastores e líderes
              evangélicos de Parauapebas. É independente: não é subordinado a igrejas, denominações ou convenções, e
              respeita a autonomia de cada uma delas.
            </p>
          </div>
        </section>

        <NumerosDoComep />

        <section className="site-secao site-secao-alt" aria-labelledby="o-que-fazemos">
          <div className="site-largura">
            <h2 id="o-que-fazemos">O que fazemos</h2>
            <div className="site-cartoes">
              {FINALIDADES.map((finalidade) => (
                <article key={finalidade.titulo} className="site-cartao">
                  <h3>{finalidade.titulo}</h3>
                  <p>{finalidade.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="site-secao">
          <div className="site-largura site-duas-colunas">
            <div>
              <h2>Quer fazer parte?</h2>
              <p>
                Podem se associar pastores e líderes evangélicos de Parauapebas com título reconhecido pela sua
                denominação, que compartilhem os objetivos e os princípios do Conselho.
              </p>
              <Link to="/associar" className="botao">
                Veja como se associar
              </Link>
            </div>
            <ProximasAssembleias />
          </div>
        </section>

        <ProximosEventos />
        <AvisosDoSite />

        <ContatoComep />
      </main>
      <RodapeSite />
    </div>
  )
}

export function QueroMeAssociar() {
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <p>
            <Link to="/">← Página inicial</Link>
          </p>
          <h1>Quero me associar</h1>
          <p>
            Podem se associar ao COMEP pastores e líderes evangélicos de Parauapebas que compartilhem os objetivos e os
            princípios do Conselho.
          </p>

          <h2>Requisitos</h2>
          <ul className="site-lista">
            <li>
              Ter <strong>título ministerial reconhecido pela sua denominação</strong>.
            </li>
            <li>
              Fazer parte de uma igreja reconhecidamente evangélica, que tenha como princípios:
              <ul>
                <li>Deus subsiste em três pessoas: Pai, Filho e Espírito Santo;</li>
                <li>o único meio de salvação é o Senhor Jesus Cristo;</li>
                <li>a Bíblia Sagrada é a revelação infalível de Deus para o seu povo;</li>
                <li>a santa Igreja universal é a comunidade dos santos.</li>
              </ul>
            </li>
            <li>Concordar com o estatuto e o regimento interno do COMEP.</li>
          </ul>

          <h2>Compromissos do associado</h2>
          <ul className="site-lista">
            <li>Participar das reuniões mensais e das assembleias.</li>
            <li>Contribuir com a taxa de inscrição e com a contribuição definida em assembleia.</li>
            <li>Zelar pela unidade do corpo de Cristo.</li>
          </ul>

          <h2>Como funciona</h2>
          <ol className="site-passos">
            <li>
              <strong>Pedido:</strong> você cria o seu acesso e envia seus dados, sua foto e o comprovante do seu título.
            </li>
            <li>
              <strong>Análise:</strong> a diretoria analisa o pedido e um diretor assina a ficha com você.
            </li>
            <li>
              <strong>Assembleia:</strong> o pedido é apresentado e votado na Assembleia Ordinária (abril ou outubro).
            </li>
            <li>
              <strong>Bem-vindo:</strong> aprovado, você passa a ter acesso ao Portal do membro. A taxa de inscrição,
              quando houver, é definida pela assembleia (hoje é isenta).
            </li>
          </ol>

          <div className="site-acoes site-acoes-pedido">
            <Link to="/associar/pedido" className="botao">
              Fazer meu pedido
            </Link>
            <Link to="/painel" className="botao botao-secundario">
              Já sou associado: Portal do membro
            </Link>
          </div>
          <p className="detalhe">
            Já é associado e ainda não tem login? Peça um código à secretaria e use o{' '}
            <Link to="/primeiro-acesso">primeiro acesso</Link>.
          </p>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

/** Assembleias convocadas que ainda vão acontecer (o edital fica numa página própria). */
function ProximasAssembleias() {
  const [carga] = useCarregar(convocacoesPublicas)
  const [agora] = useState(() => Date.now())
  const proximas =
    carga.situacao === 'ok'
      ? carga.dados.filter((c) => c.situacao !== 'realizado' && new Date(c.inicio).getTime() >= agora).reverse()
      : []
  return (
    <div>
      <h2>Assembleias</h2>
      {proximas.length === 0 ? (
        <p>
          As Assembleias Gerais Ordinárias acontecem duas vezes por ano, nos meses previstos no Estatuto. As convocações
          oficiais são publicadas aqui, com a antecedência que o Estatuto pede.
        </p>
      ) : (
        <ul className="site-convocacoes" aria-label="Convocações">
          {proximas.map((c) => (
            <li key={c.id}>
              <Link to={`/convocacoes/${c.id}`}>{c.titulo}</Link>
              <span>
                {c.situacao === 'cancelado' ? 'Cancelada' : dataPorExtenso(c.inicio)} · {c.local}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** /convocacoes/:id — edital e pauta de uma assembleia convocada (qualquer pessoa vê). */
export function ConvocacaoPublicaPagina() {
  const { id = '' } = useParams()
  const [carga, recarregar] = useCarregar(convocacoesPublicas)
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <MostrarCarga carga={carga} recarregar={recarregar}>
            {(lista) => {
              const c = lista.find((x) => x.id === id)
              return c ? (
                <Convocacao c={c} />
              ) : (
                <>
                  <h1>Convocação não encontrada</h1>
                  <p>
                    Ela pode ter sido retirada. <Link to="/">Ir para a página inicial</Link>
                  </p>
                </>
              )
            }}
          </MostrarCarga>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

function Convocacao({ c }: { c: ConvocacaoPublica }) {
  return (
    <article aria-labelledby="titulo-convocacao">
      <p className="site-sobretitulo">{NOME_DO_TIPO[c.tipo]}</p>
      <h1 id="titulo-convocacao">{c.titulo}</h1>
      {c.situacao === 'cancelado' && (
        <p className="erro" role="alert">
          Assembleia cancelada{c.motivo_cancelamento ? `: ${c.motivo_cancelamento}` : ''}.
        </p>
      )}
      <dl className="definicoes">
        <dt>Quando</dt>
        <dd>{dataPorExtenso(c.inicio)} (1ª chamada)</dd>
        <dt>Local</dt>
        <dd>{c.local}</dd>
        {c.convocado_em && (
          <>
            <dt>Convocada em</dt>
            <dd>{formatarDataHora(c.convocado_em)}</dd>
          </>
        )}
      </dl>
      <h2>Pauta</h2>
      <ol aria-label="Pauta">
        {c.pauta.map((p) => (
          <li key={p.ordem}>
            {p.titulo}
            {p.descricao && <p className="detalhe">{p.descricao}</p>}
          </li>
        ))}
      </ol>
      {c.edital && (
        <>
          <h2>Edital</h2>
          <p className="texto-edital">{c.edital}</p>
        </>
      )}
    </article>
  )
}

export function PaginaNaoEncontrada() {
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <h1>Página não encontrada</h1>
          <p>
            Este endereço não existe. <Link to="/">Ir para a página inicial</Link>
          </p>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

// ---------------------------------------------------------------------
// Fase 5.3 — o site vivo: os eventos publicados no sistema aparecem aqui, e a inscrição feita aqui entra no sistema
// ---------------------------------------------------------------------

function quandoDoEvento(e: Pick<EventoPublico, 'inicio' | 'fim'>): string {
  return e.fim ? `${dataPorExtenso(e.inicio)} a ${dataPorExtenso(e.fim)}` : dataPorExtenso(e.inicio)
}

/** Na página inicial: os próximos eventos (só aparece se houver). */
function ProximosEventos() {
  const [carga] = useCarregar(eventosPublicos)
  const [agora] = useState(() => Date.now())
  const proximos =
    carga.situacao === 'ok'
      ? carga.dados.filter((e) => e.situacao === 'publicado' && new Date(e.fim ?? e.inicio).getTime() >= agora).slice(0, 4)
      : []
  if (proximos.length === 0) return null
  return (
    <section className="site-secao" aria-labelledby="titulo-proximos-eventos">
      <div className="site-largura">
        <h2 id="titulo-proximos-eventos">Próximos eventos</h2>
        <ul className="site-convocacoes" aria-label="Próximos eventos">
          {proximos.map((e) => (
            <li key={e.id}>
              <Link to={`/agenda/${e.id}`}>{e.titulo}</Link>
              <span>
                {dataPorExtenso(e.inicio)}
                {e.local && ` · ${e.local}`}
                {inscricaoAberta(e, agora) && e.inscricao_publica && ' · inscrições abertas'}
              </span>
            </li>
          ))}
        </ul>
        <Link to="/agenda">Ver a agenda completa</Link>
      </div>
    </section>
  )
}

/** /agenda — os eventos e projetos publicados (qualquer pessoa vê). */
export function AgendaPagina() {
  const [carga, recarregar] = useCarregar(eventosPublicos)
  const [agora] = useState(() => Date.now())
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <h1>Agenda do COMEP</h1>
          <p>Eventos, encontros e projetos do Conselho. Quando a inscrição é aberta ao público, ela é feita aqui mesmo.</p>
          <MostrarCarga carga={carga} recarregar={recarregar}>
            {(eventos) => {
              const proximos = eventos.filter((e) => new Date(e.fim ?? e.inicio).getTime() >= agora)
              const passados = eventos.filter((e) => new Date(e.fim ?? e.inicio).getTime() < agora).reverse()
              const lista = (itens: EventoPublico[], rotulo: string) => (
                <ul className="site-convocacoes" aria-label={rotulo}>
                  {itens.map((e) => (
                    <li key={e.id}>
                      <Link to={`/agenda/${e.id}`}>{e.titulo}</Link>
                      <span>
                        {e.situacao === 'cancelado' ? 'Cancelado' : quandoDoEvento(e)}
                        {e.local && ` · ${e.local}`}
                        {inscricaoAberta(e, agora) && e.inscricao_publica && ' · inscrições abertas'}
                      </span>
                    </li>
                  ))}
                </ul>
              )
              return (
                <>
                  {proximos.length === 0 ? <p className="vazio">Nenhum evento marcado no momento.</p> : lista(proximos, 'Próximos eventos')}
                  {passados.length > 0 && (
                    <>
                      <h2>Eventos recentes</h2>
                      {lista(passados, 'Eventos recentes')}
                    </>
                  )}
                </>
              )
            }}
          </MostrarCarga>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

/** /agenda/:id — o evento, com a inscrição pelo site quando é aberta ao público. */
export function EventoPublicoPagina() {
  const { id = '' } = useParams()
  const [carga, recarregar] = useCarregar(eventosPublicos)
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <MostrarCarga carga={carga} recarregar={recarregar}>
            {(lista) => {
              const e = lista.find((x) => x.id === id)
              return e ? (
                <EventoPublico key={e.id} e={e} aoInscrever={recarregar} />
              ) : (
                <>
                  <h1>Evento não encontrado</h1>
                  <p>
                    Ele pode ter sido retirado. <Link to="/agenda">Ver a agenda</Link>
                  </p>
                </>
              )
            }}
          </MostrarCarga>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

function EventoPublico({ e, aoInscrever }: { e: EventoPublico; aoInscrever: () => void }) {
  const [agora] = useState(() => Date.now())
  const aberta = inscricaoAberta(e, agora)
  // fica aqui (e não no formulário): quem pega a última vaga ainda vê o número depois que a página recarrega
  const [feita, setFeita] = useState<InscricaoFeita | null>(null)
  return (
    <article aria-labelledby="titulo-evento-publico">
      <p className="site-sobretitulo">{NOME_DO_TIPO_EVENTO[e.tipo]}</p>
      <h1 id="titulo-evento-publico">{e.titulo}</h1>
      {e.situacao === 'cancelado' && (
        <p className="erro" role="alert">
          Evento cancelado{e.motivo_cancelamento ? `: ${e.motivo_cancelamento}` : ''}.
        </p>
      )}
      <dl className="definicoes">
        <dt>Quando</dt>
        <dd>{quandoDoEvento(e)}</dd>
        {e.local && (
          <>
            <dt>Local</dt>
            <dd>{e.local}</dd>
          </>
        )}
        {e.inscricao && (
          <>
            <dt>Inscrição</dt>
            <dd>
              {e.taxa > 0 ? `taxa de ${formatarReais(e.taxa)}` : 'gratuita'}
              {e.vagas_restantes !== null && ` · ${e.vagas_restantes} ${e.vagas_restantes === 1 ? 'vaga restante' : 'vagas restantes'}`}
              {` · até ${formatarDataHora(e.inscricao_ate)}`}
            </dd>
          </>
        )}
      </dl>
      {e.descricao && <p className="texto-edital">{e.descricao}</p>}
      {e.inscricao && !e.inscricao_publica && e.situacao === 'publicado' && (
        <p>
          A inscrição neste evento é para os associados, pelo <Link to="/painel">Portal do membro</Link>.
        </p>
      )}
      {e.inscricao &&
        e.inscricao_publica &&
        (feita ? (
          <InscricaoConfirmada feita={feita} />
        ) : aberta ? (
          <FormInscricao
            e={e}
            aoInscrever={(f) => {
              setFeita(f)
              aoInscrever()
            }}
          />
        ) : (
          <p>As inscrições estão encerradas.</p>
        ))}
    </article>
  )
}

function InscricaoConfirmada({ feita }: { feita: InscricaoFeita }) {
  return (
    <section className="painel" aria-labelledby="titulo-inscricao-feita">
      <h2 id="titulo-inscricao-feita">Inscrição feita!</h2>
      <p>
        Sua inscrição é a <strong>nº {feita.numero}</strong>.
        {feita.situacao === 'aguardando_pagamento'
          ? ` Ela fica confirmada quando a tesouraria do COMEP receber a taxa de ${formatarReais(feita.valor)}.`
          : ' Ela está confirmada.'}
      </p>
      <p className="detalhe">Guarde o número. Se precisar cancelar, fale com o COMEP pelos contatos da página inicial.</p>
    </section>
  )
}

function FormInscricao({ e, aoInscrever }: { e: EventoPublico; aoInscrever: (f: InscricaoFeita) => void }) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [igreja, setIgreja] = useState('')
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel" aria-labelledby="titulo-inscricao">
      <h2 id="titulo-inscricao">Inscreva-se</h2>
      <form
        aria-label="Inscrição no evento"
        onSubmit={(ev) => {
          ev.preventDefault()
          void umaVez(async () => {
            const r = await inscrever(e.id, { nome, telefone, igreja, aceite })
            if (r.erro !== null) return setErro(r.erro)
            setErro(null)
            aoInscrever(r.dados)
          })
        }}
      >
        <label>
          Nome completo *
          <input required minLength={3} maxLength={120} autoComplete="name" value={nome} onChange={(ev) => setNome(ev.target.value)} />
        </label>
        <label>
          Telefone (WhatsApp, com DDD) *
          <input type="tel" required autoComplete="tel" value={telefone} onChange={(ev) => setTelefone(ev.target.value)} placeholder="(94) 9xxxx-xxxx" />
        </label>
        <label>
          Igreja
          <input maxLength={200} value={igreja} onChange={(ev) => setIgreja(ev.target.value)} />
        </label>
        <label className="caixa-marcar">
          <input type="checkbox" required checked={aceite} onChange={(ev) => setAceite(ev.target.checked)} />
          Aceito que o COMEP use o meu nome, telefone e igreja só para este evento (LGPD)
        </label>
        <Mensagem erro={erro} />
        <button type="submit" className="botao" disabled={enviando}>
          {e.taxa > 0 ? `Inscrever-me (${formatarReais(e.taxa)})` : 'Inscrever-me'}
        </button>
      </form>
    </section>
  )
}

/** Na página inicial: os avisos que a secretaria mandou para o site (só aparece se houver). */
function AvisosDoSite() {
  const [carga] = useCarregar(avisosPublicos)
  if (carga.situacao !== 'ok' || carga.dados.length === 0) return null
  return (
    <section className="site-secao site-secao-alt" aria-labelledby="titulo-avisos-site">
      <div className="site-largura">
        <h2 id="titulo-avisos-site">Avisos</h2>
        <div className="site-cartoes">
          {carga.dados.slice(0, 6).map((a) => (
            <article key={a.id} className="site-cartao">
              <h3>{a.titulo}</h3>
              <p className="texto-edital">{a.texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------
// Site vivo (Fase 5.5.4): a diretoria e as igrejas, a partir do sistema (sem dados pessoais)
// ---------------------------------------------------------------------

/** /diretoria — o Conselho Diretor e o Conselho Fiscal com mandato valendo hoje. */
export function DiretoriaPagina() {
  const [carga, recarregar] = useCarregar(diretoriaPublica)
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <h1>Diretoria</h1>
          <p>
            O COMEP é dirigido pelo Conselho Diretor, eleito em Assembleia Geral, e as contas são acompanhadas pelo Conselho
            Fiscal (Art. 12 e 14 do Estatuto).
          </p>
          <MostrarCarga carga={carga} recarregar={recarregar}>
            {(membros) => {
              if (membros.length === 0) return <p className="vazio">A diretoria ainda não foi registrada no sistema.</p>
              const diretor = membros.filter((m) => m.cargo !== 'conselheiro_fiscal')
              const fiscal = membros.filter((m) => m.cargo === 'conselheiro_fiscal')
              const lista = (itens: MembroDaDiretoriaPublica[], rotulo: string) => (
                <ul className="site-lista-pessoas" aria-label={rotulo}>
                  {itens.map((m) => (
                    <li key={`${m.cargo}-${m.nome}`}>
                      <span className="site-cargo">{NOME_DO_CARGO[m.cargo]}</span>
                      <strong>{m.nome}</strong>
                    </li>
                  ))}
                </ul>
              )
              const inicio = membros.reduce((a, m) => (m.inicio < a ? m.inicio : a), membros[0].inicio)
              const fim = membros.reduce((a, m) => (m.fim > a ? m.fim : a), membros[0].fim)
              return (
                <>
                  {diretor.length > 0 && (
                    <>
                      <h2>Conselho Diretor</h2>
                      {lista(diretor, 'Conselho Diretor')}
                    </>
                  )}
                  {fiscal.length > 0 && (
                    <>
                      <h2>Conselho Fiscal</h2>
                      {lista(fiscal, 'Conselho Fiscal')}
                    </>
                  )}
                  <p className="detalhe">
                    Mandato de {formatarData(inicio)} a {formatarData(fim)}.
                  </p>
                </>
              )
            }}
          </MostrarCarga>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

/** /igrejas — as igrejas que têm ministros associados ao COMEP. */
export function IgrejasPagina() {
  const [carga, recarregar] = useCarregar(igrejasPublicas)
  const [busca, setBusca] = useState('')
  return (
    <div className="site">
      <CabecalhoSite />
      <main className="site-secao">
        <div className="site-largura site-texto">
          <h1>Igrejas do COMEP</h1>
          <p>
            As igrejas de Parauapebas que têm pastores e líderes associados ao Conselho. Cada igreja mantém a sua autonomia; o
            COMEP as representa e apoia.
          </p>
          <MostrarCarga carga={carga} recarregar={recarregar}>
            {(igrejas) => {
              if (igrejas.length === 0) return <p className="vazio">As igrejas aparecem aqui assim que os associados forem cadastrados.</p>
              const filtradas = igrejas.filter((g) => contemTexto(`${g.nome} ${g.sigla ?? ''} ${g.denominacao ?? ''} ${g.bairro ?? ''}`, busca))
              return (
                <>
                  <label className="busca">
                    Procurar igreja, denominação ou bairro
                    <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  </label>
                  {filtradas.length === 0 ? (
                    <p className="vazio">Nenhuma igreja encontrada.</p>
                  ) : (
                    <ul className="site-lista-pessoas" aria-label="Igrejas">
                      {filtradas.map((g) => (
                        <li key={g.id}>
                          <strong>
                            {g.nome}
                            {g.sigla && ` (${g.sigla})`}
                          </strong>
                          <span>
                            {[g.denominacao, g.bairro, g.ministros === 1 ? '1 ministro associado' : `${g.ministros} ministros associados`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )
            }}
          </MostrarCarga>
        </div>
      </main>
      <RodapeSite />
    </div>
  )
}

/** Na página inicial: o tamanho do COMEP (só aparece quando já há associados cadastrados). */
function NumerosDoComep() {
  const [carga] = useCarregar(numerosPublicos)
  if (carga.situacao !== 'ok' || carga.dados.ministros === 0) return null
  const n = carga.dados
  return (
    <section className="site-secao" aria-labelledby="titulo-numeros">
      <div className="site-largura">
        <h2 id="titulo-numeros">O COMEP hoje</h2>
        <dl className="site-numeros">
          <div>
            <dt>Ministros associados</dt>
            <dd>{n.ministros}</dd>
          </div>
          <div>
            <dt>Igrejas</dt>
            <dd>
              <Link to="/igrejas">{n.igrejas}</Link>
            </dd>
          </div>
          <div>
            <dt>Denominações</dt>
            <dd>{n.denominacoes}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
