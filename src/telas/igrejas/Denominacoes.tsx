import { useState } from 'react'
import { BotaoConfirmarNaLinha, Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Chip } from '../../componentes/Telas'
import { listarDenominacoes, listarIgrejas, NOME_DA_TRADICAO, salvarDenominacao, type Denominacao, type Tradicao } from '../../dados/cadastros'
import { ok } from '../../dados/cliente'
import { arquivarItem } from '../../dados/configuracoes'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'

// Igrejas › Denominações (aprovado na rodada 8: sai de Configurações e vem para o módulo Igrejas; a tradição na
// rodada 9): a lista que aparece ao cadastrar uma igreja, com a TRADIÇÃO de cada denominação (pentecostal, batista,
// reformada…), que serve aos modelos de credencial por tradição e ao mapa da cidade.

const TRADICOES = Object.keys(NOME_DA_TRADICAO) as Tradicao[]

/** /igrejas/denominacoes */
export function Denominacoes() {
  const [carga, recarregar] = useCarregar(async () => {
    const [denominacoes, igrejas] = await Promise.all([listarDenominacoes(), listarIgrejas()])
    if (denominacoes.erro !== null) return denominacoes
    if (igrejas.erro !== null) return igrejas
    const quantas = new Map<string, number>()
    for (const i of igrejas.dados) if (i.denominacao_id) quantas.set(i.denominacao_id, (quantas.get(i.denominacao_id) ?? 0) + 1)
    return ok({ denominacoes: denominacoes.dados, quantas })
  })
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Igrejas"
        titulo="Denominações"
        sub="A lista que aparece ao cadastrar uma igreja, com a tradição de cada uma (serve aos modelos de credencial por tradição e ao mapa)."
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <NovaDenominacao aoConcluir={concluir} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ denominacoes, quantas }) =>
          denominacoes.length === 0 ? (
            <p className="vazio">Nenhuma denominação cadastrada.</p>
          ) : (
            <ul className="bloco lista-linhas" aria-label="Denominações">
              {denominacoes.map((d) => (
                <LinhaDenominacao key={d.id} d={d} igrejas={quantas.get(d.id) ?? 0} aoConcluir={concluir} />
              ))}
            </ul>
          )
        }
      </MostrarCarga>
    </div>
  )
}

function CampoTradicao({ valor, aoMudar, rotulo }: { valor: Tradicao | null; aoMudar: (t: Tradicao | null) => void; rotulo: string }) {
  return (
    <label>
      Tradição
      <select aria-label={rotulo} value={valor ?? ''} onChange={(e) => aoMudar((e.target.value || null) as Tradicao | null)}>
        <option value="">— Não informada —</option>
        {TRADICOES.map((t) => (
          <option key={t} value={t}>
            {NOME_DA_TRADICAO[t]}
          </option>
        ))}
      </select>
    </label>
  )
}

function NovaDenominacao({ aoConcluir }: { aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [tradicao, setTradicao] = useState<Tradicao | null>(null)
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>+ Nova denominação</summary>
      <form
        className="form-linha"
        aria-label="Nova denominação"
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const r = await salvarDenominacao({ nome, sigla, tradicao })
            aoConcluir(r, `Denominação "${nome.trim()}" cadastrada.`)
            if (r.erro === null) {
              setNome('')
              setSigla('')
              setTradicao(null)
            }
          })
        }}
      >
        <label>
          Nome *
          <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label>
          Sigla
          <input maxLength={20} value={sigla} onChange={(e) => setSigla(e.target.value)} />
        </label>
        <CampoTradicao valor={tradicao} aoMudar={setTradicao} rotulo="Tradição da denominação nova" />
        <button type="submit" className="botao" disabled={enviando || !nome.trim()}>
          Cadastrar
        </button>
      </form>
    </details>
  )
}

function LinhaDenominacao({ d, igrejas, aoConcluir }: { d: Denominacao; igrejas: number; aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(d.nome)
  const [sigla, setSigla] = useState(d.sigla ?? '')
  const [enviando, umaVez] = useUmaVez()
  const mudarTradicao = (tradicao: Tradicao | null) =>
    void umaVez(async () => aoConcluir(await salvarDenominacao({ nome: d.nome, sigla: d.sigla, tradicao }, d.id), `${d.nome}: tradição salva.`))
  return (
    <li aria-label={d.nome}>
      {editando ? (
        <form
          className="form-linha form-compacto linha-corpo"
          aria-label={`Renomear ${d.nome}`}
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              const r = await salvarDenominacao({ nome, sigla, tradicao: d.tradicao }, d.id)
              aoConcluir(r, `Denominação "${nome.trim()}" salva.`)
              if (r.erro === null) setEditando(false)
            })
          }}
        >
          <label>
            Nome *
            <input required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Sigla
            <input maxLength={20} value={sigla} onChange={(e) => setSigla(e.target.value)} />
          </label>
          <button type="submit" className="botao" disabled={enviando}>
            Salvar
          </button>
          <button type="button" className="botao-texto" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <span className="linha-corpo">
          <strong>
            {d.nome}
            {d.sigla && ` (${d.sigla})`}
          </strong>
          <span>{igrejas === 1 ? '1 igreja' : `${igrejas} igrejas`}</span>
        </span>
      )}
      {!editando && (
        <>
          {d.tradicao && <Chip area="assembleias">{NOME_DA_TRADICAO[d.tradicao]}</Chip>}
          <CampoTradicao valor={d.tradicao} aoMudar={mudarTradicao} rotulo={`Tradição de ${d.nome}`} />
          <button type="button" className="botao-link" onClick={() => setEditando(true)}>
            Renomear
          </button>
          <BotaoConfirmarNaLinha
            texto="Arquivar"
            confirmar={`Confirmar: arquivar ${d.nome}`}
            desabilitado={enviando}
            aoConfirmar={() => void umaVez(async () => aoConcluir(await arquivarItem('denominacoes', d.id), `Denominação "${d.nome}" arquivada.`))}
          />
        </>
      )}
    </li>
  )
}
