import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone, Ladrilho } from '../../componentes/Icone'
import { Chip } from '../../componentes/Telas'
import { DIAS_CONECTADO, entrouEm, sairDosOutrosAparelhos } from '../../dados/autenticacao'
import { meusDados, minhaPrivacidade, pedirExclusao, salvarPrivacidade, type MinhaPrivacidade } from '../../dados/privacidade'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataDeInstante, horaCurta } from '../../utilitarios/formatos'

// Meu perfil › Privacidade e Meu perfil › Segurança (rodadas 19, 20 e 22; parte 13).

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

const NOME_DA_SITUACAO_PEDIDO = { pendente: 'Esperando a secretaria', atendido: 'Atendido', recusado: 'Não atendido' } as const

/** Meu perfil › Privacidade: o termo aceito, os meus dados, quem mexeu nos dados e as escolhas (rodada 19, "meus-dados"). */
export function MinhaPrivacidadeAba() {
  const [carga, recarregar] = useCarregar(minhaPrivacidade)
  return <MostrarCarga carga={carga} recarregar={recarregar}>{(p) => <ConteudoPrivacidade p={p} recarregar={recarregar} />}</MostrarCarga>
}

function ConteudoPrivacidade({ p, recarregar }: { p: MinhaPrivacidade; recarregar: () => void }) {
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string | null }>({})
  const [whatsapp, setWhatsapp] = useState(p.receber_whatsapp)
  const [aniversario, setAniversario] = useState(p.aparecer_aniversariantes)
  const [exclusao, setExclusao] = useState('')
  const [pedindo, setPedindo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [atual, ...antes] = p.aceites
  const pendente = p.pedidos.some((x) => x.situacao === 'pendente')

  async function mudar(m: { receber_whatsapp?: boolean; aparecer_aniversariantes?: boolean }) {
    const r = await salvarPrivacidade(m)
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Escolha guardada.' })
  }

  async function baixar() {
    setEnviando(true)
    const r = await meusDados()
    setEnviando(false)
    if (r.erro !== null) {
      setRetorno({ erro: r.erro })
      return
    }
    const arquivo = new Blob([JSON.stringify(r.dados, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(arquivo)
    link.download = `meus-dados-comep-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setRetorno({ sucesso: 'Os seus dados foram baixados num arquivo (formato JSON, que abre em qualquer editor de texto).' })
  }

  async function pedir() {
    setEnviando(true)
    const r = await pedirExclusao(exclusao)
    setEnviando(false)
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Pedido mandado: a secretaria responde aqui mesmo.' })
    if (r.erro === null) {
      setExclusao('')
      setPedindo(false)
      recarregar()
    }
  }

  return (
    <div className="privacidade">
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <div className="privacidade-colunas">
        <div className="privacidade-coluna">
          <section className="bloco" aria-labelledby="titulo-termo-aceito">
            <h2 id="titulo-termo-aceito">O termo que você aceitou</h2>
            {atual ? (
              <>
                <p>
                  <strong>Versão {atual.versao}</strong>, aceita em {formatarDataDeInstante(atual.aceito_em)}, às {horaCurta(atual.aceito_em)}
                  {atual.aparelho ? `, pelo ${atual.aparelho.toLowerCase()}` : ''}.
                </p>
                {antes.length > 0 && (
                  <p className="detalhe">
                    Antes: {antes.map((a) => `versão ${a.versao}, aceita em ${formatarDataDeInstante(a.aceito_em)}`).join('; ')}.
                  </p>
                )}
              </>
            ) : (
              <p>Você ainda não aceitou o termo.</p>
            )}
            <Link to="/termo-de-uso" className="link-forte">
              Ver o termo
            </Link>
          </section>

          <section className="bloco" aria-labelledby="titulo-seus-dados">
            <h2 id="titulo-seus-dados">Os seus dados</h2>
            <div className="acoes-privacidade">
              <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => void baixar()}>
                <Icone nome="baixar" tamanho={18} />
                Baixar os meus dados
              </button>
              <Link to="/meu-perfil/correcoes" className="botao botao-secundario">
                Pedir correção
              </Link>
              {!pendente && (
                <button type="button" className="botao botao-secundario" aria-expanded={pedindo} onClick={() => setPedindo((x) => !x)}>
                  Pedir a exclusão
                </button>
              )}
            </div>
            {pedindo && (
              <form
                className="form-linha"
                aria-label="Pedir a exclusão"
                onSubmit={(e) => {
                  e.preventDefault()
                  void pedir()
                }}
              >
                <label className="largura-total">
                  O que você quer que seja excluído *
                  <textarea required value={exclusao} onChange={(e) => setExclusao(e.target.value)} maxLength={2000} />
                </label>
                <button type="submit" className="botao" disabled={enviando}>
                  Mandar o pedido
                </button>
              </form>
            )}
            {p.pedidos.length > 0 && (
              <ul className="lista-linhas" aria-label="Os seus pedidos de exclusão">
                {p.pedidos.map((x) => (
                  <li key={x.id} className="linha-aparelho">
                    <span className="linha-corpo">
                      <strong>
                        {NOME_DA_SITUACAO_PEDIDO[x.situacao]} · {formatarDataDeInstante(x.criado_em)}
                      </strong>
                      <span>{x.texto}</span>
                      {x.resposta && <span>Resposta: {x.resposta}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <span className="detalhe">
              Alguns registros precisam ficar guardados pelo prazo que a lei manda, mesmo depois que você sai (por exemplo, os pagamentos).
            </span>
          </section>
        </div>

        <div className="privacidade-coluna">
          <section className="bloco" aria-labelledby="titulo-quem-mexeu">
            <h2 id="titulo-quem-mexeu">Quem mexeu nos seus dados (últimos 90 dias)</h2>
            {p.quem_mexeu.length === 0 ? (
              <p className="vazio">Ninguém além de você.</p>
            ) : (
              <ul className="lista-linhas" aria-label="Quem mexeu nos seus dados">
                {p.quem_mexeu.map((q, i) => (
                  <li key={`${q.em}-${i}`} className="linha-aparelho">
                    <Icone nome="olho" tamanho={20} />
                    <span className="linha-corpo">
                      <strong>{q.quem}</strong>
                      <span>
                        {formatarDataDeInstante(q.em)} · {q.operacao === 'INSERT' ? 'registrou' : 'mudou'} {q.o_que}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <span className="detalhe">Vem do registro automático de toda mudança no sistema (a auditoria).</span>
          </section>

          <section className="bloco" aria-labelledby="titulo-aparicoes">
            <h2 id="titulo-aparicoes">Avisos e aparições (opcional)</h2>
            <Interruptor
              rotulo="Receber avisos pelo WhatsApp"
              ligado={whatsapp}
              aoMudar={(v) => {
                setWhatsapp(v)
                void mudar({ receber_whatsapp: v })
              }}
            />
            <Interruptor
              rotulo="Aparecer na lista de aniversariantes"
              ligado={aniversario}
              aoMudar={(v) => {
                setAniversario(v)
                void mudar({ aparecer_aniversariantes: v })
              }}
            />
            <span className="detalhe">
              Sem e-mail: os avisos chegam no sino e no celular (Meu perfil › Avisos). A lista de aniversariantes ainda vai ser feita; a sua
              escolha já fica guardada para ela.
            </span>
          </section>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Meu perfil › Segurança (rodada 20, "seguranca-2", e rodada 22, "seguranca-3")
// ---------------------------------------------------------------------

/** O que a tela de segurança mostra sobre a chave de acesso (o servidor do Supabase precisa ligar as chaves). */
export function MinhaSeguranca({ trocarSenha }: { trocarSenha: ReactNode }) {
  const [desde, setDesde] = useState<Date | null>(null)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string | null }>({})
  const [enviando, setEnviando] = useState(false)
  useEffect(() => {
    void entrouEm().then(setDesde)
  }, [])
  const ate = desde ? new Date(desde.getTime() + DIAS_CONECTADO * 86_400_000) : null

  return (
    <div className="seguranca">
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <div className="privacidade-colunas">
        <div className="privacidade-coluna">
          <section className="bloco" aria-labelledby="titulo-chave-acesso">
            <div className="titulo-com-acao">
              <h2 id="titulo-chave-acesso">Chave de acesso (digital ou rosto)</h2>
              <Chip area="assembleias">Ainda não ligada</Chip>
            </div>
            <p className="texto-bloco">
              Com a chave de acesso, você entra e assina os documentos com a digital, o rosto ou o PIN do aparelho. A sua digital não sai
              do celular: o sistema guarda só uma chave que prova que é você.
            </p>
            <p className="detalhe">
              A chave de acesso ainda vai ser ligada no servidor do COMEP pela equipe técnica. Até lá, todos entram com o e-mail e a senha.
            </p>
            <Link to="/meu-perfil/seguranca/como-funciona" className="link-forte">
              Como funciona a digital →
            </Link>
          </section>

          <section className="bloco" aria-labelledby="titulo-este-aparelho-seg">
            <h2 id="titulo-este-aparelho-seg">Este aparelho</h2>
            <p className="texto-bloco">
              {desde && ate
                ? `Conectado desde ${formatarData(desde.toISOString().slice(0, 10))}. Fica conectado até ${formatarData(ate.toISOString().slice(0, 10))} (${DIAS_CONECTADO} dias); depois, você entra de novo.`
                : `Você fica conectado por ${DIAS_CONECTADO} dias neste aparelho; depois, entra de novo.`}
            </p>
            <button
              type="button"
              className="botao botao-secundario alinhar-esquerda"
              disabled={enviando}
              onClick={async () => {
                setEnviando(true)
                const r = await sairDosOutrosAparelhos()
                setEnviando(false)
                setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Pronto: os outros aparelhos saíram. Este continua conectado.' })
              }}
            >
              Sair de todos os outros aparelhos
            </button>
          </section>

          {trocarSenha}
        </div>

        <div className="privacidade-coluna">
          <section className="bloco" aria-labelledby="titulo-regras-seguranca">
            <h2 id="titulo-regras-seguranca">As regras</h2>
            <dl className="regras-seguranca">
              <dt>Ministro</dt>
              <dd>Entra com o e-mail e a senha. A digital é opcional.</dd>
              <dt>Perfil de acesso e pastor presidente</dt>
              <dd>Quando a chave de acesso for ligada, a digital passa a ser obrigatória, para entrar e para assinar.</dd>
              <dt>Ficar conectado</dt>
              <dd>{DIAS_CONECTADO} dias em cada aparelho, no celular e no computador. A digital volta a ser pedida para assinar.</dd>
              <dt>Aplicativo autenticador</dt>
              <dd>Sempre opcional (ainda não ligado).</dd>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

/** /meu-perfil/seguranca/como-funciona (rodada 22, "seguranca-3"): no celular e no computador. */
export function ComoFuncionaADigital() {
  const coluna = (icone: 'aparelho' | 'grade', titulo: string, sub: string, passos: ReactNode[], nota: ReactNode) => (
    <section className="bloco como-funciona" aria-label={titulo}>
      <span className="como-funciona-topo">
        <Ladrilho area="pessoas" icone={icone} tamanho={44} />
        <span>
          <strong>{titulo}</strong>
          <span className="detalhe">{sub}</span>
        </span>
      </span>
      <ol>
        {passos.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ol>
      <p className="como-funciona-nota">{nota}</p>
    </section>
  )
  return (
    <div className="tela-nova">
      <p className="trilha">
        <Link to="/meu-perfil/seguranca">← Meu perfil › Segurança</Link>
      </p>
      <h1>Como funciona a digital</h1>
      <p className="sub-tela">Para quem tem perfil de acesso e para o pastor presidente</p>
      <p className="detalhe">A chave de acesso ainda vai ser ligada no servidor do COMEP. Assim vai funcionar:</p>
      <div className="como-funciona-colunas">
        {coluna(
          'aparelho',
          'No celular',
          'o jeito da maioria',
          [
            'Entre com o e-mail e a senha.',
            <>
              Se você tem perfil de acesso ou é pastor presidente, o sistema pede para <strong>cadastrar a digital</strong> no seu celular. É
              uma vez só.
            </>,
            'Das próximas vezes, entre só com a digital.',
          ],
          <>
            <strong>Não precisa de computador.</strong> Quem só usa o celular faz tudo por ele.
          </>,
        )}
        {coluna(
          'grade',
          'No computador',
          'só para quem usa',
          [
            'Entre com o e-mail e a senha.',
            'O computador pede a confirmação: se ele tem leitor de digital, confirme ali; se não tem, aparece um QR Code: leia com o seu celular e confirme com a digital dele.',
            `Pronto: como no celular, você fica conectado por ${DIAS_CONECTADO} dias, sem pedir de novo.`,
          ],
          'É o caso da secretaria, que trabalha no computador da sede.',
        )}
      </div>
      <p>
        <strong>O ministro comum</strong> continua entrando só com o e-mail e a senha. A digital é obrigatória apenas para quem tem perfil de
        acesso e para o pastor presidente, porque ela também assina os documentos.
      </p>
    </div>
  )
}
