// Pedidos de correção no cadastro. Desde a parte 4 das telas novas (18/11/2026) são ESTRUTURADOS: nada de texto livre,
// porque a pessoa digita errado. Quem pede escolhe o dado numa lista fechada, vê como está e diz como deve ficar; a
// secretaria (ou a presidência) aceita, e a correção entra sozinha no cadastro, ou recusa com o motivo.
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { Chip, Selo } from '../../componentes/Telas'
import type { Igreja, Titulo } from '../../dados/cadastros'
import {
  listarPedidosCorrecao,
  NOME_DA_SITUACAO_PEDIDO,
  NOME_DO_CAMPO,
  pedirCorrecaoDado,
  responderCorrecao,
  type CampoCorrecao,
  type PedidoCorrecao,
} from '../../dados/igrejas'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarCnpj, formatarCpf, formatarDataDeInstante } from '../../utilitarios/formatos'

const CLASSE = { pendente: 'etiqueta etiqueta-conferencia', atendido: 'etiqueta etiqueta-ok', recusado: 'etiqueta etiqueta-atraso' }

/** Um dado que pode ser corrigido, com como está hoje (vazio = não informado). */
export type DadoCorrigivel = { campo: CampoCorrecao; atual: string }

/** Como mostrar um valor: o CPF e o CNPJ com a pontuação; vazio vira "(vazio)". */
function valorParaLer(campo: PedidoCorrecao['campo'], valor: string | null): string {
  if (!valor) return '(vazio)'
  if (campo === 'cpf') return formatarCpf(valor)
  return campo === 'igreja_cnpj' ? formatarCnpj(valor) : valor
}

/** De quem é o pedido: o nome do ministro ou, no pedido da igreja (D-10), o nome da igreja. */
function nomeDoPedido(p: PedidoCorrecao, nomes?: Map<string, string>): string {
  if (p.pessoa_id === null) return p.igreja?.nome ?? 'Igreja'
  return p.pessoa?.nome ?? nomes?.get(p.pessoa_id) ?? 'Ministro'
}

/**
 * O formulário da correção: escolher o dado, ver como está hoje e dizer como deve ficar.
 * No título e na igreja, o "como deve ficar" é escolhido na lista (não se digita).
 */
export function FormCorrecao({
  pessoaId,
  dados,
  titulos,
  igrejas,
  rotulo,
  aoConcluir,
  rodape,
}: {
  pessoaId: string
  dados: readonly DadoCorrigivel[]
  titulos: readonly Titulo[]
  igrejas: readonly Igreja[]
  /** o nome do formulário (ex.: "Pedir correção no cadastro de Fulano") */
  rotulo: string
  aoConcluir: (r: { erro: string | null }, sucesso: string) => void
  rodape?: ReactNode
}) {
  const [campo, setCampo] = useState<CampoCorrecao>(dados[0]?.campo ?? 'nome')
  const [valor, setValor] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const escolhido = dados.find((d) => d.campo === campo) ?? dados[0]
  const daLista = campo === 'titulo' || campo === 'igreja'

  async function enviar() {
    const r = daLista ? await pedirCorrecaoDado(pessoaId, campo, '', valor) : await pedirCorrecaoDado(pessoaId, campo, valor)
    aoConcluir(r, 'Pedido de correção enviado à secretaria.')
    if (r.erro === null) setValor('')
  }

  return (
    <form
      aria-label={rotulo}
      onSubmit={(e) => {
        e.preventDefault()
        void umaVez(enviar)
      }}
    >
      <label>
        O que precisa ser corrigido? *
        <select
          value={campo}
          onChange={(e) => {
            setCampo(e.target.value as CampoCorrecao)
            setValor('')
          }}
        >
          {dados.map((d) => (
            <option key={d.campo} value={d.campo}>
              {NOME_DO_CAMPO[d.campo]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Como está hoje
        <input value={valorParaLer(campo, escolhido?.atual || null)} disabled />
      </label>
      {campo === 'titulo' ? (
        <label>
          Como deve ficar *
          <select required value={valor} onChange={(e) => setValor(e.target.value)}>
            <option value="">— Escolha o título —</option>
            {titulos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </label>
      ) : campo === 'igreja' ? (
        <label>
          Como deve ficar *
          <select required value={valor} onChange={(e) => setValor(e.target.value)}>
            <option value="">— Escolha a igreja —</option>
            {igrejas.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          Como deve ficar *
          <input
            required
            maxLength={300}
            type={campo === 'email' ? 'email' : campo === 'telefone' ? 'tel' : 'text'}
            inputMode={campo === 'cpf' ? 'numeric' : undefined}
            placeholder={campo === 'cpf' ? '000.000.000-00' : campo === 'telefone' ? '(94) 9____-____' : undefined}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </label>
      )}
      {campo === 'igreja' && (
        <p className="detalhe">É para corrigir um cadastro errado. Mudou de igreja? Peça a troca de igreja, com a data.</p>
      )}
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando}>
          Mandar para a secretaria
        </button>
      </div>
      {rodape}
    </form>
  )
}

/** O que foi pedido, numa linha: "Título: Evangelista → Presbítero" (o pedido antigo mostra o texto). */
export function ResumoDaCorrecao({ p }: { p: PedidoCorrecao }) {
  if (!p.campo) return <q className="texto-justificativa">{p.texto}</q>
  return (
    <span className="resumo-correcao">
      <span>{NOME_DO_CAMPO[p.campo]}: </span>
      <s>{valorParaLer(p.campo, p.valor_atual)}</s> → <strong>{valorParaLer(p.campo, p.valor_pedido)}</strong>
    </span>
  )
}

/** O selo da resposta da secretaria. */
export function SeloDaCorrecao({ p }: { p: PedidoCorrecao }) {
  if (p.situacao === 'atendido') {
    return <Selo tipo="aprovado">Aceita{p.respondido_em ? ` em ${formatarDataDeInstante(p.respondido_em)}` : ''}</Selo>
  }
  if (p.situacao === 'recusado') return <Selo tipo="recusado">Recusada{p.resposta ? `: ${p.resposta}` : ''}</Selo>
  return <Selo tipo="analise">Esperando a secretaria</Selo>
}

/**
 * A lista dos pedidos, com a resposta da secretaria. `nomes` completa o nome de quem a RLS não deixa ler. Quem preside
 * vê aqui também os pedidos da igreja (o nome e o CNPJ, D-10).
 */
export function ListaDePedidos({ pedidos, nomes }: { pedidos: PedidoCorrecao[]; nomes?: Map<string, string> }) {
  if (pedidos.length === 0) return <p className="vazio">Nenhum pedido de correção.</p>
  return (
    <ul className="lista" aria-label="Pedidos de correção">
      {pedidos.map((p) => {
        const nome = nomeDoPedido(p, nomes)
        return (
          <li key={p.id} className="lista-item lista-item-estatico" aria-label={`Pedido de correção: ${nome}`}>
            <strong>{nome}</strong>
            <ResumoDaCorrecao p={p} />
            <span>
              <span className={CLASSE[p.situacao]}>{NOME_DA_SITUACAO_PEDIDO[p.situacao]}</span> pedido em {formatarDataDeInstante(p.criado_em)}
            </span>
            {p.resposta && <span>Resposta da secretaria: {p.resposta}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Para a secretaria e a presidência: os pedidos esperando resposta (Ministros e inscrições › Correções pedidas). */
export function CorrecoesPendentes() {
  const [carga, recarregar] = useCarregar(() => listarPedidosCorrecao({ pendentes: true }))
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <MostrarCarga carga={carga} recarregar={recarregar}>
      {(pedidos) => (
        <section className="painel" aria-labelledby="titulo-correcoes">
          <h2 id="titulo-correcoes">Correções no cadastro ({pedidos.length})</h2>
          <p className="detalhe">Aceita, a correção entra sozinha no cadastro. Para recusar, diga o motivo.</p>
          <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
          {pedidos.length === 0 ? (
            <p className="vazio">Nenhum pedido de correção esperando.</p>
          ) : (
            <ul className="lista-linhas bloco" aria-label="Pedidos de correção pendentes">
              {pedidos.map((p) => (
                <Pendente key={p.id} p={p} aoConcluir={concluir} />
              ))}
            </ul>
          )}
        </section>
      )}
    </MostrarCarga>
  )
}

function Pendente({ p, aoConcluir }: { p: PedidoCorrecao; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [recusando, setRecusando] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const nome = nomeDoPedido(p)
  const estruturado = p.campo !== null
  // D-10: o pedido da igreja (o nome ou o CNPJ, pedido por quem preside) entra na mesma fila, com o selo Igreja e o
  // link para a ficha da igreja
  const daIgreja = p.pessoa_id === null
  return (
    <li className="correcao-pendente" aria-label={`Correção: ${nome}`}>
      <span className="linha-corpo">
        {daIgreja ? (
          <strong className="correcao-da-igreja">
            <Chip area="eventos">
              <Icone nome="igreja" tamanho={14} />
              Igreja
            </Chip>
            <span>
              <Link to={`/igrejas/${p.igreja_id}`}>{nome}</Link>
              {p.campo && ` · ${NOME_DO_CAMPO[p.campo]}`}
            </span>
          </strong>
        ) : (
          <strong>
            <Link to={`/ministros/${p.pessoa_id}`}>{nome}</Link>
            {p.campo && ` · ${NOME_DO_CAMPO[p.campo]}`}
          </strong>
        )}
        <ResumoDaCorrecao p={p} />
        <span>
          Pedido por {p.autor?.nome ?? '—'} em {formatarDataDeInstante(p.criado_em)}
        </span>
        {recusando && (
          <form
            className="form-linha form-compacto"
            aria-label={`Recusar a correção de ${nome}`}
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => aoConcluir(await responderCorrecao(p.id, false, resposta), `Correção de ${nome}: recusada.`))
            }}
          >
            <label>
              Motivo *
              <input required maxLength={1000} value={resposta} onChange={(e) => setResposta(e.target.value)} />
            </label>
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Recusar a correção
            </button>
            <button type="button" className="botao-texto" onClick={() => setRecusando(false)}>
              Cancelar
            </button>
          </form>
        )}
      </span>
      {!recusando && (
        <span className="acoes-item">
          <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => setRecusando(true)}>
            Recusar
          </button>
          <button
            type="button"
            className="botao"
            disabled={enviando}
            onClick={() =>
              void umaVez(async () =>
                aoConcluir(
                  await responderCorrecao(p.id, true, ''),
                  estruturado ? `Correção de ${nome}: aceita e já no cadastro.` : `Correção de ${nome}: atendida.`,
                ),
              )
            }
          >
            {estruturado ? 'Aceitar' : 'Atendido'}
          </button>
        </span>
      )}
    </li>
  )
}
