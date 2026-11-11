import { Link } from 'react-router'

// Site institucional público. Todo o texto vem do Estatuto do COMEP (PROJETO.md, seção 13).
// Endereço e contatos entram quando a diretoria confirmar (PROJETO.md, decisão 14).

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
        <Link to="/painel" className="botao botao-pequeno">
          Portal do membro
        </Link>
      </div>
    </header>
  )
}

function RodapeSite() {
  return (
    <footer className="site-rodape">
      <strong>COMEP — Conselho de Ministros Evangélicos de Parauapebas</strong>
      <span>Associação civil de natureza religiosa, sem fins lucrativos · Parauapebas, Pará</span>
    </footer>
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
            <div>
              <h2>Assembleias</h2>
              <p>
                As Assembleias Gerais Ordinárias acontecem na segunda quinzena de abril e de outubro. As convocações
                oficiais serão publicadas aqui, com pelo menos 30 dias de antecedência.
              </p>
            </div>
          </div>
        </section>
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
              <strong>Bem-vindo:</strong> aprovado, você passa a ter acesso ao Portal do membro e paga a taxa de
              inscrição.
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
