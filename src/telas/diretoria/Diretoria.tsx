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
import { buscarConfigAssembleias, listarEncontros, type Encontro } from '../../dados/encontros'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { diaIsoDeInstante, formatarData, hojeIso } from '../../utilitarios/formatos'

type Retorno = { sucesso?: string; erro?: string }
type Concluir = (r: { erro: string | null }, s: string) => void

const ORDEM = Object.fromEntries(CARGOS.map((c, i) => [c.cargo, i])) as Record<Cargo, number>

/** Cargos que só a assembleia tira de alguém (fora a renúncia, que a própria pessoa faz). */
const SO_PELA_ASSEMBLEIA: Cargo[] = ['presidente', 'vice_presidente', 'conselheiro_fiscal']

/** Fim padrão do mandato (Art. 12; anos nas Configurações): o dia anterior ao mesmo dia, N anos depois. */
function anosDepois(inicio: string, anos: number): string {
  const d = new Date(`${inicio}T12:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + anos)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** O último dia permitido: N anos depois do início (o banco confere o mesmo). */
function limiteDoMandato(inicio: string, anos: number): string {
  const d = new Date(`${inicio}T12:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() + anos)
  return d.toISOString().slice(0, 10)
}

/** AGO e AGE já instaladas: só elas elegem ou tiram alguém do cargo. */
function assembleiasInstaladas(encontros: Encontro[]): Encontro[] {
  return encontros.filter((e) => e.tipo !== 'reuniao_mensal' && e.instalada_em !== null)
}

function nomeDaAssembleia(e: Encontro): string {
  return `${e.titulo} (${formatarData(diaIsoDeInstante(e.inicio))})`
}

export function Diretoria() {
  const { estado } = useSessao()
  const conta = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta : null
  const presidencia = conta?.perfis.includes('presidencia') ?? false
  const minhaPessoa = conta?.pessoaId ?? null
  const [carga, recarregar] = useCarregar(async () => {
    const [mandatos, config, encontros, regras] = await Promise.all([
      listarMandatos(),
      buscarConfigCredencial(),
      listarEncontros(),
      buscarConfigAssembleias(),
    ])
    if (mandatos.erro !== null) return mandatos
    return ok({
      mandatos: mandatos.dados,
      fimCredencial: config.erro === null ? config.dados.fim_mandato : null,
      // números do estatuto (Configurações): anos de mandato e membros do Conselho Fiscal
      anos: regras.erro === null ? regras.dados.anos_mandato : 4,
      conselheiros: regras.erro === null ? regras.dados.membros_conselho_fiscal : 3,
      // quem não é da diretoria pode não ver as assembleias; aí a lista fica vazia (só a presidência usa)
      assembleias: encontros.erro === null ? assembleiasInstaladas(encontros.dados) : [],
    })
  })
  const [retorno, setRetorno] = useState<Retorno>({})
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
  }

  return (
    <>
      <h1>Diretoria e Conselho Fiscal</h1>
      <p className="detalhe">
        Conselho Diretor (Art. 12) e Conselho Fiscal (Art. 14). O mandato e o número de conselheiros estão em Configurações → regras
        do estatuto. O cargo dá o perfil de acesso enquanto o mandato vale: na posse começa sozinho e, no fim do mandato, termina
        sozinho. O secretário executivo tem o acesso da secretaria e da tesouraria.
      </p>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ mandatos, fimCredencial, assembleias, anos, conselheiros }) => {
          const vigentes = mandatos.filter((m) => m.vigente).sort((a, b) => ORDEM[a.cargo] - ORDEM[b.cargo])
          const outros = mandatos.filter((m) => !m.vigente)
          const fimDiretoria = vigentes.find((m) => m.cargo === 'presidente')?.fim ?? null
          const linha = (m: Mandato) => (
            <LinhaMandato
              key={m.id}
              m={m}
              presidencia={presidencia}
              meu={m.pessoa_id === minhaPessoa}
              assembleias={assembleias}
              aoConcluir={concluir}
            />
          )
          return (
            <>
              <section className="painel" aria-labelledby="titulo-atual">
                <h2 id="titulo-atual">Em exercício</h2>
                {vigentes.length === 0 ? (
                  <p className="vazio">Nenhum mandato registrado em vigor. Os perfis continuam vindo de "Perfis de acesso".</p>
                ) : (
                  <ul className="lista" aria-label="Em exercício">
                    {vigentes.map(linha)}
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

              {presidencia && (
                <RegistrarDiretoria
                  primeiro={mandatos.length === 0}
                  assembleias={assembleias}
                  anos={anos}
                  conselheiros={conselheiros}
                  aoConcluir={concluir}
                />
              )}

              <section className="painel" aria-labelledby="titulo-historico">
                <h2 id="titulo-historico">Histórico e próximos mandatos</h2>
                {outros.length === 0 ? (
                  <p className="vazio">Sem outros mandatos registrados.</p>
                ) : (
                  <ul className="lista" aria-label="Histórico">
                    {outros.map(linha)}
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
  meu,
  assembleias,
  aoConcluir,
}: {
  m: Mandato
  presidencia: boolean
  /** o mandato é de quem está logado: pode renunciar */
  meu: boolean
  assembleias: Encontro[]
  aoConcluir: Concluir
}) {
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState(meu && !presidencia ? 'Renúncia' : '')
  const [assembleia, setAssembleia] = useState('')
  const [enviando, umaVez] = useUmaVez()
  const [hoje] = useState(hojeIso)
  const aberto = !m.encerrado_em && m.fim >= hoje
  const podeEncerrar = aberto && (presidencia || meu)
  // tirar alguém (que já tomou posse) de presidente, vice ou do Conselho Fiscal: só com a assembleia; renúncia não
  const pedeAssembleia = !meu && SO_PELA_ASSEMBLEIA.includes(m.cargo) && m.inicio < hoje
  return (
    <li className="lista-item lista-item-estatico" aria-label={`${NOME_DO_CARGO[m.cargo]}: ${m.nome}`}>
      <strong>
        {NOME_DO_CARGO[m.cargo]}: {m.nome}
      </strong>
      <span>
        {formatarData(m.inicio)} a {formatarData(m.fim)}
        {m.encontro_titulo && ` · eleito(a) em ${m.encontro_titulo}`}
        {m.encerrado_em && ` · encerrado em ${formatarData(m.encerrado_em)} (${m.motivo_encerramento})`}
        {aberto && m.inicio > hoje && ' · ainda não tomou posse'}
      </span>
      {podeEncerrar && (
        <details className="acao-recolhida">
          <summary>{meu && !presidencia ? 'Renunciar ao cargo' : 'Encerrar antes (renúncia, desligamento, engano…)'}</summary>
          <form
            className="form-linha"
            aria-label={`Encerrar o mandato de ${m.nome}`}
            onSubmit={(e) => {
              e.preventDefault()
              void umaVez(async () =>
                aoConcluir(await encerrarMandato(m.id, data, motivo, assembleia || null), `Mandato de ${m.nome} encerrado.`),
              )
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
            {pedeAssembleia && (
              <label>
                Assembleia que decidiu *
                <select required value={assembleia} onChange={(e) => setAssembleia(e.target.value)}>
                  <option value="">—</option>
                  {assembleias.map((a) => (
                    <option key={a.id} value={a.id}>
                      {nomeDaAssembleia(a)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Encerrar o mandato
            </button>
            {pedeAssembleia && (
              <p className="detalhe largura-total">
                Tirar alguém do cargo de presidente, vice ou do Conselho Fiscal é da assembleia (instalada no sistema). Na renúncia, a
                própria pessoa encerra pelo login dela. No dia da posse, encerrar corrige um registro feito por engano.
              </p>
            )}
          </form>
        </details>
      )}
    </li>
  )
}

function RegistrarDiretoria({
  primeiro,
  assembleias,
  anos,
  conselheiros,
  aoConcluir,
}: {
  /** nenhum mandato registrado ainda: a diretoria foi eleita antes do sistema e vale o documento */
  primeiro: boolean
  assembleias: Encontro[]
  anos: number
  conselheiros: number
  aoConcluir: Concluir
}) {
  const [carga, recarregar] = useCarregar(async () => {
    const associados = await listarAssociados()
    if (associados.erro !== null) return associados
    // o jubilado vota, mas não é votado (14/11/2026)
    return ok(associados.dados.filter((a) => a.situacao === 'ativo' && !a.jubilado))
  })
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [encontro, setEncontro] = useState('')
  const [documento, setDocumento] = useState('')
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [enviando, umaVez] = useUmaVez()
  const vagas = useMemo(
    () =>
      CARGOS.flatMap((c) =>
        c.cargo === 'conselheiro_fiscal'
          ? Array.from({ length: conselheiros }, (_, i) => ({ ...c, chave: `${c.cargo}-${i + 1}`, rotulo: `${c.nome} ${i + 1}` }))
          : [{ ...c, chave: c.cargo, rotulo: c.nome }],
      ),
    [conselheiros],
  )
  // a assembleia que elegeu é de antes da posse
  const possiveis = assembleias.filter((a) => !inicio || diaIsoDeInstante(a.inicio) <= inicio)
  return (
    <details className="painel acao-recolhida-painel">
      <summary>Registrar a diretoria eleita</summary>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(associados) => (
          <form
            aria-label="Registrar a diretoria eleita"
            onSubmit={(e) => {
              e.preventDefault()
              const membros = vagas.filter((v) => escolhas[v.chave]).map((v) => ({ cargo: v.cargo, pessoa_id: escolhas[v.chave] }))
              void umaVez(async () => {
                const r = await registrarDiretoria({ inicio, fim, encontro_id: encontro || null, documento, membros })
                aoConcluir(r, r.erro === null ? `${r.dados} cargo(s) registrado(s). Os perfis valem a partir da posse.` : '')
                if (r.erro === null) setEscolhas({})
              })
            }}
          >
            <p className="detalhe">
              Só associados em dia podem ser votados (Art. 11); o jubilado vota, mas não é votado. Ninguém acumula dois cargos, nem
              diretoria e Conselho Fiscal. Deixe em branco o cargo que não foi preenchido. O mandato é de no máximo {anos} anos.
            </p>
            {primeiro ? (
              <p className="detalhe">
                Primeiro registro: se a diretoria foi eleita antes do sistema, informe a ata ou o documento da eleição. Daqui em diante,
                cada diretoria eleita é registrada com a assembleia (AGO ou AGE) instalada no sistema.
              </p>
            ) : (
              assembleias.length === 0 && (
                <p className="aviso-texto">
                  Nenhuma AGO ou AGE instalada no sistema. A diretoria eleita é registrada com a assembleia que a elegeu — instale a
                  assembleia em Assembleias → Condução.
                </p>
              )
            )}
            <div className="grade-form">
              <label>
                Posse (início) *
                <input
                  type="date"
                  required
                  value={inicio}
                  onChange={(e) => {
                    setInicio(e.target.value)
                    if (e.target.value) setFim(anosDepois(e.target.value, anos))
                  }}
                />
              </label>
              <label>
                Fim do mandato *
                <input
                  type="date"
                  required
                  min={inicio}
                  max={inicio ? limiteDoMandato(inicio, anos) : undefined}
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </label>
              <label className="largura-total">
                Assembleia que elegeu {primeiro ? '' : '*'}
                <select required={!primeiro} value={encontro} onChange={(e) => setEncontro(e.target.value)}>
                  <option value="">{primeiro ? '(eleita antes do sistema)' : '—'}</option>
                  {possiveis.map((a) => (
                    <option key={a.id} value={a.id}>
                      {nomeDaAssembleia(a)}
                    </option>
                  ))}
                </select>
              </label>
              {primeiro && !encontro && (
                <label className="largura-total">
                  Ata ou documento da eleição *
                  <input
                    required
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="Ex.: Ata da AGO de 20/10/2025, livro 2, folhas 15 a 17"
                  />
                </label>
              )}
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
