import { useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router'
import { Carregando, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone, Ladrilho, MarcaCaixa, type NomeIcone } from '../../componentes/Icone'
import { aceitarTermo, meuTermo, versoesDoTermo, type Termo } from '../../dados/privacidade'
import { useSessao } from '../../estado/contexto'
import { nomeDoAparelho } from '../../estado/avisosNoAparelho'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData } from '../../utilitarios/formatos'

// O termo de uso de dados (LGPD), com versão (rodadas 19 e 20, aprovadas em 19/11/2026; parte 13):
//   * a TELA INTEIRA logo depois de entrar, para quem é do COMEP e ainda não aceitou a versão que vale (ou a próxima);
//   * o resumo em 9 pontos, o dado sensível (a fé) com o consentimento destacado e o opcional como escolha separada;
//   * "Agora não": o sistema pergunta de novo no próximo acesso;
//   * o termo completo (em partes; uma MINUTA, que a diretoria e um advogado conferem), para ler e baixar em PDF.

const ICONES: readonly NomeIcone[] = ['escudo', 'texto', 'alerta', 'check', 'olho', 'igreja', 'cadeado', 'relogio', 'perfil']
const icone = (nome: string): NomeIcone => (ICONES as readonly string[]).includes(nome) ? (nome as NomeIcone) : 'texto'

const CHAVE_ADIADO = 'comep:termo-adiado'

function adiadoNesteAcesso(versao: number): boolean {
  try {
    return sessionStorage.getItem(CHAVE_ADIADO) === String(versao)
  } catch {
    return false
  }
}

/**
 * O portão do termo: depois de entrar, quem é do COMEP e ainda não aceitou a versão vê o termo na tela inteira.
 * A página do termo completo (/termo-de-uso) passa direto, para a pessoa ler antes de aceitar.
 */
export function PortaoDoTermo({ children }: { children: ReactNode }) {
  const { estado } = useSessao()
  const { pathname } = useLocation()
  const pessoaId = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.pessoaId : null
  const temPerfil = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' && estado.conta.conta.perfis.length > 0
  if (!pessoaId || !temPerfil || pathname === '/termo-de-uso') return children
  return (
    <ConferirTermo key={pessoaId} >
      {children}
    </ConferirTermo>
  )
}

/** O portão como rota (em volta das telas do sistema, em src/App.tsx). */
export function PortaoDoTermoRota() {
  return (
    <PortaoDoTermo>
      <Outlet />
    </PortaoDoTermo>
  )
}

function ConferirTermo({ children }: { children: ReactNode }) {
  const [carga, recarregar] = useCarregar(meuTermo)
  const [adiado, setAdiado] = useState(false)
  if (carga.situacao === 'carregando') return <Carregando texto="Carregando…" />
  // sem conseguir ler o termo (sem rede, banco sem a migração), o sistema não trava a pessoa
  if (carga.situacao === 'erro') return children
  const pedir = carga.dados.pedir
  if (!pedir || adiado || adiadoNesteAcesso(pedir.versao)) return children
  return (
    <TelaDoTermo
      termo={pedir}
      primeira={carga.dados.atual?.versao === pedir.versao && pedir.versao === 1}
      aoAceitar={recarregar}
      aoAdiar={() => {
        try {
          sessionStorage.setItem(CHAVE_ADIADO, String(pedir.versao))
        } catch {
          // sem armazenamento: o "Agora não" vale só nesta tela
        }
        setAdiado(true)
      }}
    />
  )
}

function Interruptor({ rotulo, ligado, aoMudar }: { rotulo: string; ligado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className="linha-interruptor">
      <span className="linha-interruptor-texto">{rotulo}</span>
      <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className="interruptor" onClick={() => aoMudar(!ligado)}>
        <span aria-hidden="true" />
      </button>
    </div>
  )
}

/** A tela inteira do aceite (rodada 20, "termo-lgpd-2": o resumo em 9 pontos, o que mudou, o opcional e o aceite). */
function TelaDoTermo({ termo, primeira, aoAceitar, aoAdiar }: { termo: Termo; primeira: boolean; aoAceitar: () => void; aoAdiar: () => void }) {
  const [li, setLi] = useState(false)
  const [whatsapp, setWhatsapp] = useState(true)
  const [aniversario, setAniversario] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aceitar() {
    setEnviando(true)
    setErro(null)
    const r = await aceitarTermo({ termoId: termo.id, aparelho: nomeDoAparelho(), dadoSensivel: li, receberWhatsapp: whatsapp, aparecerAniversariantes: aniversario })
    setEnviando(false)
    if (r.erro !== null) setErro(r.erro)
    else aoAceitar()
  }

  return (
    <main className="termo-tela" aria-labelledby="titulo-termo">
      <div className="termo-marca">
        <MarcaCaixa tamanho={32} />
        <span className="nome-comep">COMEP</span>
      </div>
      <div className="termo-cartao">
        <div className="termo-cabecalho">
          <div>
            <span className="rotulo">
              Termo de uso de dados · versão {termo.versao} · vale a partir de {formatarData(termo.vale_a_partir)}
            </span>
            <h1 id="titulo-termo">{primeira ? 'O termo de uso dos seus dados' : 'Atualizamos o termo de uso dos seus dados'}</h1>
            <p>Antes de entrar, veja o resumo. Leva 2 minutos.</p>
          </div>
          <Link to={`/termo-de-uso?versao=${termo.versao}`} className="link-forte">
            Ler o termo completo ›
          </Link>
        </div>
        {termo.minuta && (
          <p className="termo-minuta" role="note">
            <Icone nome="alerta" tamanho={18} />
            <span>
              <strong>Minuta.</strong> A diretoria e um advogado conferem este texto; quando ele mudar, você verá a versão nova.
            </span>
          </p>
        )}
        <div className="termo-corpo">
          <section aria-labelledby="titulo-em-resumo">
            <h2 id="titulo-em-resumo">Em resumo</h2>
            <ul className="termo-resumo" aria-label="O resumo do termo">
              {termo.resumo.map((p) => (
                <li key={p.titulo} className={p.icone === 'alerta' ? 'termo-ponto termo-ponto-sensivel' : 'termo-ponto'}>
                  <Ladrilho area={p.icone === 'alerta' ? 'eventos' : 'pessoas'} icone={icone(p.icone)} tamanho={34} />
                  <span>
                    <strong>{p.titulo}</strong>
                    <span>{p.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <div className="termo-lado">
            {termo.mudancas.length > 0 && (
              <section className="termo-mudou" aria-labelledby="titulo-mudou">
                <h2 id="titulo-mudou">O que mudou nesta versão</h2>
                <ul>
                  {termo.mudancas.map((m) => (
                    <li key={m}>
                      <span className="selo-novo">NOVO</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="termo-escolhe" aria-labelledby="titulo-escolhe">
              <h2 id="titulo-escolhe">Você escolhe (opcional)</h2>
              <Interruptor rotulo="Receber avisos pelo WhatsApp" ligado={whatsapp} aoMudar={setWhatsapp} />
              <Interruptor rotulo="Aparecer na lista de aniversariantes" ligado={aniversario} aoMudar={setAniversario} />
              <span className="detalhe">Muda quando quiser, em Meu perfil › Privacidade.</span>
            </section>
            <label className="termo-aceite">
              <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} />
              <span>
                Li e aceito o termo de uso de dados (versão {termo.versao}), <strong>inclusive o uso do dado sensível sobre a minha fé</strong>.
              </span>
            </label>
            <Mensagem erro={erro} />
            <div className="termo-botoes">
              <button type="button" className="botao" disabled={!li || enviando} onClick={() => void aceitar()}>
                {enviando ? 'Guardando…' : 'Aceitar e continuar'}
              </button>
              <button type="button" className="botao botao-secundario" disabled={enviando} onClick={aoAdiar}>
                Agora não
              </button>
            </div>
            <span className="detalhe">"Agora não": o sistema pergunta de novo no próximo acesso.</span>
          </div>
        </div>
      </div>
    </main>
  )
}

/** /termo-de-uso — o termo completo, em partes (rodada 20, "O termo completo"), para ler e baixar em PDF (imprimir). */
export function TermoCompleto() {
  const [parametros] = useSearchParams()
  const pedida = Number(parametros.get('versao') ?? '')
  const [carga, recarregar] = useCarregar(async () => {
    const meu = await meuTermo()
    if (meu.erro !== null) return meu
    const opcoes = [meu.dados.atual, meu.dados.proxima].filter((t): t is Termo => t !== null)
    let escolhido = opcoes.find((t) => t.versao === pedida) ?? meu.dados.atual ?? meu.dados.proxima
    // a secretaria pode abrir as versões antigas
    if (!escolhido || (pedida && escolhido.versao !== pedida)) {
      const todas = await versoesDoTermo()
      if (todas.erro === null) escolhido = todas.dados.versoes.find((t) => t.versao === pedida) ?? escolhido
    }
    return { dados: escolhido ?? null, erro: null }
  })
  return (
    <main className="termo-completo">
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(termo) =>
          !termo ? (
            <p className="vazio">Nenhum termo publicado ainda.</p>
          ) : (
            <>
              <aside className="termo-indice nao-imprimir">
                <div className="termo-marca">
                  <MarcaCaixa tamanho={32} />
                  <span className="nome-comep">COMEP</span>
                </div>
                <strong className="termo-indice-titulo">Termo de uso de dados</strong>
                <span className="detalhe">
                  Versão {termo.versao} · vale a partir de {formatarData(termo.vale_a_partir)}
                </span>
                <nav aria-label="As partes do termo">
                  <ol>
                    {termo.partes.map((p, i) => (
                      <li key={p.titulo}>
                        <a href={`#parte-${i + 1}`}>{p.titulo}</a>
                      </li>
                    ))}
                  </ol>
                </nav>
                <button type="button" className="botao botao-secundario" onClick={() => window.print()}>
                  <Icone nome="baixar" tamanho={18} />
                  Baixar em PDF
                </button>
                <Link to="/painel" className="link-forte">
                  ← Voltar
                </Link>
              </aside>
              <article className="termo-texto" aria-labelledby="titulo-termo-completo">
                <h1 id="titulo-termo-completo" className="somente-imprimir">
                  Termo de uso de dados do COMEP — versão {termo.versao}
                </h1>
                {termo.minuta && (
                  <p className="termo-minuta" role="note">
                    <Icone nome="alerta" tamanho={18} />
                    <span>
                      <strong>Minuta.</strong> A diretoria e um advogado conferem este texto antes de publicar a versão final.
                    </span>
                  </p>
                )}
                {termo.partes.map((p, i) => (
                  <section key={p.titulo} id={`parte-${i + 1}`} className="termo-parte">
                    <h2>{p.titulo}</h2>
                    <p>{p.texto}</p>
                  </section>
                ))}
              </article>
            </>
          )
        }
      </MostrarCarga>
    </main>
  )
}
