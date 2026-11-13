// Fase 4.4 — Diretoria e Conselho Fiscal (Art. 12 e 14): quem é de cada cargo, o histórico e,
// para a presidência, registrar a diretoria eleita e encerrar um mandato. O cargo dá o perfil de acesso
// enquanto o mandato vale (na posse começa sozinho; no fim, termina sozinho).
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { listarAssociados } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import { buscarConfigCredencial } from '../../dados/credencial'
import {
  CARGOS,
  encerrarMandato,
  listarMandatos,
  NOME_DO_CARGO,
  registrarDiretoria,
  type Cargo,
  type Mandato,
} from '../../dados/diretoria'
import { listarEncontros } from '../../dados/encontros'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }

const ORDEM = Object.fromEntries(CARGOS.map((c, i) => [c.cargo, i])) as Record<Cargo, number>

/** Fim padrão de um mandato de 4 anos (Art. 12): o dia anterior ao mesmo dia, 4 anos depois. */
function quatroAnosDepois(inicio: string): string {
  const d = new Date(`${inicio}T12:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + 4)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function Diretoria() {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const presidencia = perfis.includes('presidencia')
  const [carga, recarregar] = useCarregar(async () => {
    const [mandatos, config] = await Promise.all([listarMandatos(), buscarConfigCredencial()])
    if (mandatos.erro !== null) return mandatos
    return ok({ mandatos: mandatos.dados, fimCredencial: config.erro === null ? config.dados.fim_mandato : null })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
      <h1>Diretoria e Conselho Fiscal</h1>
      <p className="detalhe">
        Conselho Diretor (Art. 12) e Conselho Fiscal (3 membros — Art. 14), com mandato de 4 anos. O cargo dá o perfil de acesso
        enquanto o mandato vale: na posse começa sozinho e, no fim do mandato, termina sozinho.
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ mandatos, fimCredencial }) => {
          const vigentes = mandatos.filter((m) => m.vigente).sort((a, b) => ORDEM[a.cargo] - ORDEM[b.cargo])
          const outros = mandatos.filter((m) => !m.vigente)
          const fimDiretoria = vigentes.find((m) => m.cargo === 'presidente')?.fim ?? null
          return (
            <>
              <section className="painel" aria-labelledby="titulo-atual">
                <h2 id="titulo-atual">Em exercício</h2>
                {vigentes.length === 0 ? (
                  <p className="vazio">Nenhum mandato registrado em vigor. Os perfis continuam vindo de "Perfis de acesso".</p>
                ) : (
                  <ul className="lista" aria-label="Em exercício">
                    {vigentes.map((m) => (
                      <LinhaMandato key={m.id} m={m} presidencia={presidencia} aoConcluir={concluir} />
                    ))}
                  </ul>
                )}
                {fimDiretoria && fimCredencial !== fimDiretoria && presidencia && (
                  <p className="aviso-texto">
                    O fim do mandato nas credenciais ({fimCredencial ? formatarData(fimCredencial) : 'em branco'}) não é o da diretoria em
                    exercício ({formatarData(fimDiretoria)}). Na posse da nova diretoria, registre o novo mandato em{' '}
                    <Link to="/configuracoes#credencial">Configurações → Credencial</Link>.
                  </p>
                )}
              </section>

              {presidencia && <RegistrarDiretoria aoConcluir={concluir} />}

              <section className="painel" aria-labelledby="titulo-historico">
                <h2 id="titulo-historico">Histórico e próximos mandatos</h2>
                {outros.length === 0 ? (
                  <p className="vazio">Sem outros mandatos registrados.</p>
                ) : (
                  <ul className="lista" aria-label="Histórico">
                    {outros.map((m) => (
                      <LinhaMandato key={m.id} m={m} presidencia={presidencia} aoConcluir={concluir} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        }}
      </MostrarCarga>
    </>
  )
}

function LinhaMandato({
  m,
  presidencia,
  aoConcluir,
}: {
  m: Mandato
  presidencia: boolean
  aoConcluir: (r: { erro: string | null }, s: string) => void
}) {
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const [hoje] = useState(hojeIso)
  return (
    <li className="lista-item lista-item-estatico" aria-label={`${NOME_DO_CARGO[m.cargo]}: ${m.nome}`}>
      <strong>
        {NOME_DO_CARGO[m.cargo]}: {m.nome}
      </strong>
      <span>
        {formatarData(m.inicio)} a {formatarData(m.fim)}
        {m.encontro_titulo && ` · eleito(a) em ${m.encontro_titulo}`}
        {m.encerrado_em && ` · encerrado em ${formatarData(m.encerrado_em)} (${m.motivo_encerramento})`}
        {!m.vigente && !m.encerrado_em && m.inicio > hoje && ' · ainda não tomou posse'}
      </span>
      {m.vigente && presidencia && !m.encerrado_em && (
        <details className="acao-recolhida">
          <summary>Encerrar antes (renúncia, desligamento…)</summary>
          <form
            className="form-linha"
            aria-label={`Encerrar o mandato de ${m.nome}`}
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () => aoConcluir(await encerrarMandato(m.id, data, motivo), `Mandato de ${m.nome} encerrado.`))
            }}
          >
            <label className="campo-curto">
              A partir de *
              <input type="date" required min={m.inicio} max={m.fim} value={data} onChange={(e) => setData(e.target.value)} />
            </label>
            <label>
              Motivo *
              <input required value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: renúncia" />
            </label>
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Encerrar o mandato
            </button>
          </form>
        </details>
      )}
    </li>
  )
}

function RegistrarDiretoria({ aoConcluir }: { aoConcluir: (r: { erro: string | null }, s: string) => void }) {
  const [carga, recarregar] = useCarregar(async () => {
    const [associados, encontros] = await Promise.all([listarAssociados(), listarEncontros()])
    if (associados.erro !== null) return associados
    if (encontros.erro !== null) return encontros
    return ok({
      associados: associados.dados.filter((a) => a.situacao === 'ativo'),
      assembleias: encontros.dados.filter((e) => e.tipo !== 'reuniao_mensal' && (e.situacao === 'convocado' || e.situacao === 'realizado')),
    })
  })
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [encontro, setEncontro] = useState('')
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [enviando, umaVez] = useUmaVez()
  const vagas = useMemo(
    () => CARGOS.flatMap((c) => (c.cargo === 'conselheiro_fiscal' ? [1, 2, 3].map((n) => ({ ...c, chave: `${c.cargo}-${n}`, rotulo: `${c.nome} ${n}` })) : [{ ...c, chave: c.cargo, rotulo: c.nome }])),
    [],
  )
  return (
    <details className="painel acao-recolhida-painel">
      <summary>Registrar a diretoria eleita</summary>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ associados, assembleias }) => (
          <form
            aria-label="Registrar a diretoria eleita"
            onSubmit={(e) => {
              e.preventDefault()
              const membros = vagas.filter((v) => escolhas[v.chave]).map((v) => ({ cargo: v.cargo, pessoa_id: escolhas[v.chave] }))
              void umaVez(async () => {
                const r = await registrarDiretoria({ inicio, fim, encontro_id: encontro || null, membros })
                aoConcluir(r, r.erro === null ? `${r.dados} cargo(s) registrado(s). Os perfis valem a partir da posse.` : '')
                if (r.erro === null) setEscolhas({})
              })
            }}
          >
            <p className="detalhe">
              Só associados em dia podem ser votados (Art. 11). Ninguém acumula dois cargos, nem diretoria e Conselho Fiscal. Deixe em
              branco o cargo que não foi preenchido.
            </p>
            <div className="grade-form">
              <label>
                Posse (início) *
                <input
                  type="date"
                  required
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value)
                    if (e.target.value) setFim(quatroAnosDepois(e.target.value))
                  }}
                />
              </label>
              <label>
                Fim do mandato *
                <input type="date" required min={inicio} value={fim} onChange={(e) => setFim(e.target.value)} />
              </label>
              <label className="largura-total">
                Assembleia que elegeu
                <select value={encontro} onChange={(e) => setEncontro(e.target.value)}>
                  <option value="">(não informar)</option>
                  {assembleias.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.titulo}
                    </option>
                  ))}
                </select>
              </label>
              {vagas.map((v) => (
                <label key={v.chave}>
                  {v.rotulo}
                  <select value={escolhas[v.chave] ?? ''} onChange={(e) => setEscolhas({ ...escolhas, [v.chave]: e.target.value })}>
                    <option value="">—</option>
                    {associados.map((a) => (
                      <option key={a.pessoa_id} value={a.pessoa_id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="acoes">
              <button type="submit" className="botao" disabled={enviando || Object.values(escolhas).every((v) => !v)}>
                Registrar os mandatos
              </button>
            </div>
          </form>
        )}
      </MostrarCarga>
    </details>
  )
}
