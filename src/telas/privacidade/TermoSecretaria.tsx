import { useState } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Chip } from '../../componentes/Telas'
import {
  lembrarTermo,
  publicarTermo,
  responderPedidoTitular,
  salvarRascunhoTermo,
  versoesDoTermo,
  type PedidoDoTitular,
  type VersaoDoTermo,
} from '../../dados/privacidade'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { formatarData, formatarDataDeInstante, hojeIso } from '../../utilitarios/formatos'

// Administração › Termo de uso de dados (rodada 19, a tela "Secretaria · versões"; parte 13): as versões, quem
// aceitou, o lembrete, a versão nova (o rascunho e publicar) e os pedidos de exclusão dos titulares.

type Retorno = { sucesso?: string; erro?: string | null }

function situacaoDa(v: VersaoDoTermo, hoje: string, vigente: number | null): { area: 'financas' | 'eventos' | 'assembleias'; texto: string } {
  if (!v.publicado_em) return { area: 'assembleias', texto: 'Rascunho' }
  if (v.vale_a_partir > hoje) return { area: 'eventos', texto: `Entra em ${formatarData(v.vale_a_partir).slice(0, 5)}` }
  return v.versao === vigente ? { area: 'financas', texto: 'Valendo' } : { area: 'assembleias', texto: 'Substituída' }
}

export function TermoSecretaria() {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const escreve = perfis.includes('secretaria') || perfis.includes('presidencia')
  const [carga, recarregar] = useCarregar(versoesDoTermo)
  const [retorno, setRetorno] = useState<Retorno>({})
  const [escrevendo, setEscrevendo] = useState(false)
  const concluir = (r: { erro: string | null }, sucesso: string) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) recarregar()
    return r.erro === null
  }
  const hoje = hojeIso()

  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Administração"
        titulo="Termo de uso de dados"
        sub="As versões do termo (LGPD) e quem já aceitou."
        acoes={
          escreve && !escrevendo ? (
            <button type="button" className="botao" onClick={() => setEscrevendo(true)}>
              Escrever nova versão
            </button>
          ) : undefined
        }
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(d) => {
          const publicadas = d.versoes.filter((v) => v.publicado_em)
          const vigente = publicadas.filter((v) => v.vale_a_partir <= hoje).sort((a, b) => b.versao - a.versao)[0]?.versao ?? null
          const emFoco = publicadas.sort((a, b) => b.versao - a.versao)[0]
          const rascunho = d.versoes.find((v) => !v.publicado_em)
          return (
            <>
              {escrevendo && escreve && (
                <NovaVersao
                  rascunho={rascunho ?? null}
                  base={emFoco ?? null}
                  aoFechar={() => setEscrevendo(false)}
                  concluir={concluir}
                />
              )}
              <div className="termo-secretaria">
                <div className="termo-secretaria-principal">
                  <section className="bloco" aria-labelledby="titulo-versoes">
                    <h2 id="titulo-versoes">As versões</h2>
                    <div className="tabela-rolagem">
                      <table className="tabela-simples">
                        <thead>
                          <tr>
                            <th scope="col">Versão</th>
                            <th scope="col">Publicada</th>
                            <th scope="col">Vale desde</th>
                            <th scope="col">Aceites</th>
                            <th scope="col">Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.versoes.map((v) => {
                            const s = situacaoDa(v, hoje, vigente)
                            return (
                              <tr key={v.id}>
                                <th scope="row">
                                  <Link to={`/termo-de-uso?versao=${v.versao}`}>Versão {v.versao}</Link>
                                  {v.minuta && <span className="detalhe"> · minuta</span>}
                                </th>
                                <td>{v.publicado_em ? formatarDataDeInstante(v.publicado_em) : '—'}</td>
                                <td>{formatarData(v.vale_a_partir)}</td>
                                <td>{v.publicado_em ? `${v.aceites} de ${d.pessoas}` : '—'}</td>
                                <td>
                                  <Chip area={s.area}>{s.texto}</Chip>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="bloco" aria-labelledby="titulo-como-funciona-termo">
                    <h2 id="titulo-como-funciona-termo">Como funciona</h2>
                    <p className="texto-bloco">
                      Uma versão publicada <strong>não muda nem se apaga</strong>: fica guardado o que cada pessoa aceitou, com a data, a hora e o
                      aparelho. Para mudar o termo, escreve-se uma versão nova, com a lista do que mudou, e todos aceitam de novo. O texto atual é
                      uma <strong>minuta</strong>: a diretoria e um advogado conferem antes da versão final.
                    </p>
                  </section>
                  <PedidosDosTitulares pedidos={d.pedidos} escreve={escreve} concluir={concluir} />
                </div>
                {emFoco && (
                  <div className="termo-secretaria-lado">
                    <section className="bloco" aria-labelledby="titulo-aceitaram">
                      <h2 id="titulo-aceitaram" className="fin-rotulo">
                        Aceitaram a versão {emFoco.versao}
                      </h2>
                      <strong className="fin-saldo-total">
                        {emFoco.aceites} de {d.pessoas}
                      </strong>
                      <span className="barra-progresso" aria-hidden="true">
                        <span style={{ width: `${d.pessoas ? Math.round((emFoco.aceites * 100) / d.pessoas) : 0}%` }} />
                      </span>
                      <span className="detalhe">
                        faltam {emFoco.faltam} · {emFoco.vale_a_partir > hoje ? `entra em ${formatarData(emFoco.vale_a_partir)}` : `vale desde ${formatarData(emFoco.vale_a_partir)}`}
                      </span>
                    </section>
                    {emFoco.faltam > 0 && escreve && <LembrarQuemFalta termo={emFoco} concluir={concluir} />}
                  </div>
                )}
              </div>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function LembrarQuemFalta({ termo, concluir }: { termo: VersaoDoTermo; concluir: (r: { erro: string | null }, s: string) => boolean }) {
  const [enviando, setEnviando] = useState(false)
  return (
    <section className="bloco" aria-labelledby="titulo-quem-falta">
      <h2 id="titulo-quem-falta">Quem ainda não aceitou</h2>
      <p className="texto-bloco">{termo.faltam === 1 ? '1 pessoa' : `${termo.faltam} pessoas`}. O sistema pergunta de novo a cada acesso.</p>
      <button
        type="button"
        className="botao"
        disabled={enviando}
        onClick={async () => {
          setEnviando(true)
          const r = await lembrarTermo(termo.id)
          setEnviando(false)
          concluir(r, r.erro === null && r.dados === 0 ? 'Ninguém para lembrar agora (o lembrete já foi hoje).' : `Lembrete mandado para ${r.dados ?? 0}: aparece no sino.`)
        }}
      >
        Mandar lembrete aos {termo.faltam}
      </button>
    </section>
  )
}

function NovaVersao({
  rascunho,
  base,
  aoFechar,
  concluir,
}: {
  rascunho: VersaoDoTermo | null
  base: VersaoDoTermo | null
  aoFechar: () => void
  concluir: (r: { erro: string | null }, s: string) => boolean
}) {
  const origem = rascunho ?? base
  const [mudancas, setMudancas] = useState((rascunho?.mudancas ?? []).join('\n'))
  const [vale, setVale] = useState(rascunho?.vale_a_partir ?? hojeIso())
  const [minuta, setMinuta] = useState(rascunho?.minuta ?? base?.minuta ?? true)
  const [partes, setPartes] = useState(origem?.partes ?? [])
  const [enviando, setEnviando] = useState(false)

  async function salvar(publicar: boolean) {
    setEnviando(true)
    const r = await salvarRascunhoTermo({
      mudancas: mudancas.split('\n').map((m) => m.trim()).filter(Boolean),
      vale_a_partir: vale,
      minuta,
      partes,
    })
    if (r.erro !== null || !publicar) {
      setEnviando(false)
      concluir(r, 'Rascunho guardado. Ninguém vê o rascunho até publicar.')
      return
    }
    const p = await publicarTermo(r.dados)
    setEnviando(false)
    if (concluir(p, 'Versão publicada: todos aceitam de novo a partir da data dela.')) aoFechar()
  }

  return (
    <section className="bloco" aria-labelledby="titulo-nova-versao">
      <h2 id="titulo-nova-versao">{rascunho ? `O rascunho da versão ${rascunho.versao}` : 'Nova versão do termo'}</h2>
      <p className="detalhe">Começa como cópia da última versão. Publicada, ela não muda mais.</p>
      <form
        className="grade-form"
        onSubmit={(e) => {
          e.preventDefault()
          void salvar(true)
        }}
      >
        <label className="largura-total">
          O que mudou nesta versão (uma mudança por linha) *
          <textarea value={mudancas} onChange={(e) => setMudancas(e.target.value)} rows={3} />
        </label>
        <label>
          Vale a partir de *
          <input type="date" required min={hojeIso()} value={vale} onChange={(e) => setVale(e.target.value)} />
        </label>
        <label className="caixa-marcar">
          <input type="checkbox" checked={minuta} onChange={(e) => setMinuta(e.target.checked)} />
          Ainda é minuta (falta a revisão do advogado)
        </label>
        {partes.map((p, i) => (
          <label key={p.titulo} className="largura-total">
            {p.titulo}
            <textarea
              value={p.texto}
              rows={3}
              onChange={(e) => setPartes((atuais) => atuais.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
            />
          </label>
        ))}
        <div className="acoes largura-total">
          <button type="submit" className="botao" disabled={enviando}>
            Publicar a versão
          </button>
          <button type="button" className="botao botao-secundario" disabled={enviando} onClick={() => void salvar(false)}>
            Guardar o rascunho
          </button>
          <button type="button" className="botao-texto" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </form>
    </section>
  )
}

function PedidosDosTitulares({
  pedidos,
  escreve,
  concluir,
}: {
  pedidos: PedidoDoTitular[]
  escreve: boolean
  concluir: (r: { erro: string | null }, s: string) => boolean
}) {
  return (
    <section className="bloco" aria-labelledby="titulo-pedidos-titulares">
      <h2 id="titulo-pedidos-titulares">Pedidos de exclusão</h2>
      {pedidos.length === 0 ? (
        <p className="vazio">Nenhum pedido.</p>
      ) : (
        <ul className="lista-linhas" aria-label="Pedidos de exclusão">
          {pedidos.map((p) => (
            <PedidoTitular key={p.id} p={p} escreve={escreve} concluir={concluir} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PedidoTitular({ p, escreve, concluir }: { p: PedidoDoTitular; escreve: boolean; concluir: (r: { erro: string | null }, s: string) => boolean }) {
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function responder(atendido: boolean) {
    setEnviando(true)
    concluir(await responderPedidoTitular(p.id, atendido, resposta), 'Resposta guardada: a pessoa vê em Meu perfil › Privacidade.')
    setEnviando(false)
  }
  return (
    <li className="linha-aparelho" aria-label={`Pedido de ${p.nome}`}>
      <span className="linha-corpo">
        <strong>
          {p.nome} · {formatarDataDeInstante(p.criado_em)}
        </strong>
        <span>{p.texto}</span>
        {p.resposta && <span>Resposta: {p.resposta}</span>}
        {p.situacao === 'pendente' && escreve && (
          <span className="form-linha">
            <label>
              Resposta *
              <input value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="O que foi feito, ou por que a lei manda guardar" />
            </label>
            <button type="button" className="botao" disabled={enviando || resposta.trim().length < 3} onClick={() => void responder(true)}>
              Atendido
            </button>
            <button type="button" className="botao botao-secundario" disabled={enviando || resposta.trim().length < 3} onClick={() => void responder(false)}>
              Não dá para atender
            </button>
          </span>
        )}
      </span>
      <Chip area={p.situacao === 'pendente' ? 'eventos' : p.situacao === 'atendido' ? 'financas' : 'assembleias'}>
        {p.situacao === 'pendente' ? 'Esperando' : p.situacao === 'atendido' ? 'Atendido' : 'Não atendido'}
      </Chip>
    </li>
  )
}
