import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { Chip } from '../../componentes/Telas'
import { listarAssociados, NOME_DA_SITUACAO, type Associado } from '../../dados/associados'
import { ok } from '../../dados/cliente'
import { listarPendencias } from '../../dados/credencial'
import { situacaoDeTodos } from '../../dados/financeiro'
import { useCarregar } from '../../estado/useCarregar'
import { contemTexto, iniciaisDe, numeroDoRegistro } from '../../utilitarios/formatos'

// Módulo "Ministros e inscrições" › Ministros (aprovado em 18/11/2026: opção 1, a tabela).
// Busca por nome, nº, igreja ou título; filtros Todos, Em dia, Em atraso, Com pendência e Jubilados;
// as colunas Nome (com as iniciais), Nº, Título, Igreja e Situação. No celular, a lista compacta.

type Filtro = 'todos' | 'emdia' | 'atraso' | 'pendencia' | 'jubilados'

const FILTROS: { chave: Filtro; nome: string }[] = [
  { chave: 'todos', nome: 'Todos' },
  { chave: 'emdia', nome: 'Em dia' },
  { chave: 'atraso', nome: 'Em atraso' },
  { chave: 'pendencia', nome: 'Com pendência' },
  { chave: 'jubilados', nome: 'Jubilados' },
]

type Linha = Associado & {
  /** null: sem a situação da contribuição (desligado, ou sem permissão para ver) */
  emDia: boolean | null
  pendencias: string[]
}

function passa(l: Linha, filtro: Filtro): boolean {
  if (filtro === 'emdia') return l.emDia === true
  if (filtro === 'atraso') return l.emDia === false
  if (filtro === 'pendencia') return l.pendencias.length > 0
  if (filtro === 'jubilados') return l.jubilado && l.situacao === 'ativo'
  return true
}

/** A busca do topo abre esta lista já filtrada (?busca=…); cada busca nova recomeça a tela. */
export function ListaMinistros() {
  const [parametros] = useSearchParams()
  const busca = parametros.get('busca') ?? ''
  return <ConteudoListaMinistros key={busca} buscaInicial={busca} />
}

function ConteudoListaMinistros({ buscaInicial }: { buscaInicial: string }) {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem
  const [carga, recarregar] = useCarregar(async () => {
    const [associados, pendencias, situacoes] = await Promise.all([listarAssociados(), listarPendencias(), situacaoDeTodos()])
    if (associados.erro !== null) return associados
    if (pendencias.erro !== null) return pendencias
    const porPessoa = new Map(pendencias.dados.map((p) => [p.pessoa_id, p.pendencias]))
    // a situação da contribuição completa a tabela; se não vier, a coluna fica só com o resto
    const emDia = new Map((situacoes.erro === null ? situacoes.dados : []).map((s) => [s.pessoa_id, s.em_dia]))
    return ok(
      associados.dados.map<Linha>((a) => ({
        ...a,
        emDia: a.situacao === 'ativo' ? (emDia.get(a.pessoa_id) ?? null) : null,
        pendencias: porPessoa.get(a.pessoa_id) ?? [],
      })),
    )
  })
  const [busca, setBusca] = useState(buscaInicial)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const sub =
    carga.situacao === 'ok'
      ? (() => {
          const ativos = carga.dados.filter((l) => l.situacao === 'ativo')
          const emDia = ativos.filter((l) => l.emDia === true).length
          return `${ativos.length} ${ativos.length === 1 ? 'ministro associado' : 'ministros associados'} · ${emDia} em dia`
        })()
      : 'Os ministros associados ao COMEP'

  return (
    <div className="tela-nova">
      <CabecalhoFuncao modulo="Ministros e inscrições" titulo="Ministros" sub={sub} />
      <Mensagem sucesso={mensagem} />
      <div className="busca-com-acao">
        <label className="campo-busca">
          <Icone nome="busca" tamanho={18} />
          <input
            type="search"
            aria-label="Buscar ministro"
            placeholder="Buscar por nome, nº, igreja ou título"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </label>
        <Link to="/ministros/novo" className="botao botao-com-icone so-computador">
          <Icone nome="mais" tamanho={18} />
          Cadastrar ministro
        </Link>
      </div>

      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(linhas) => {
          const termo = busca.trim()
          const achados = linhas.filter(
            (l) =>
              contemTexto(l.nome, termo) ||
              contemTexto(l.igreja, termo) ||
              contemTexto(l.titulo, termo) ||
              (/^\d+$/.test(termo) && Number(termo) === l.numero_registro),
          )
          const visiveis = achados.filter((l) => passa(l, filtro))
          return (
            <>
              <div className="pilulas" role="group" aria-label="Mostrar">
                {FILTROS.map((f) => (
                  <button
                    key={f.chave}
                    type="button"
                    className={filtro === f.chave ? 'pilula ativa' : 'pilula'}
                    aria-pressed={filtro === f.chave}
                    onClick={() => setFiltro(f.chave)}
                  >
                    {f.nome} <strong>{linhas.filter((l) => passa(l, f.chave)).length}</strong>
                  </button>
                ))}
              </div>
              {visiveis.length === 0 ? (
                <p className="vazio">Nenhum ministro encontrado.</p>
              ) : (
                <div className="tabela-ministros">
                  <div className="tabela-ministros-cabecalho so-computador" aria-hidden="true">
                    <span>Nome</span>
                    <span>Nº</span>
                    <span>Título</span>
                    <span>Igreja</span>
                    <span>Situação</span>
                  </div>
                  <ul aria-label="Ministros">
                    {visiveis.map((l) => (
                      <li key={l.id}>
                        <LinhaMinistro l={l} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {visiveis.length > 0 && visiveis.length < linhas.length && (
                <p className="detalhe">
                  {visiveis.length} de {linhas.length}
                </p>
              )}
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function LinhaMinistro({ l }: { l: Linha }) {
  const numero = numeroDoRegistro(l.numero_registro)
  return (
    <Link to={`/ministros/${l.pessoa_id}`} className="linha-ministro">
      <span className="avatar-ministro" aria-hidden="true">
        {iniciaisDe(l.nome)}
      </span>
      <span className="linha-ministro-nome">
        <strong>{l.nome}</strong>
        <span className="so-celular">
          nº {numero}
          {l.igreja && ` · ${l.igreja}`}
        </span>
      </span>
      <span className="linha-ministro-coluna so-computador">
        <span className="somente-leitor">nº </span>
        {numero}
      </span>
      <span className="linha-ministro-coluna so-computador">{l.titulo ?? '—'}</span>
      <span className="linha-ministro-coluna so-computador">{l.igreja ?? 'Sem igreja'}</span>
      <span className="linha-ministro-situacao">
        <SituacaoDoMinistro l={l} />
      </span>
      <span className="so-computador linha-ministro-seta">
        <Icone nome="seta" tamanho={18} />
      </span>
    </Link>
  )
}

function SituacaoDoMinistro({ l }: { l: Linha }) {
  const principal =
    l.situacao !== 'ativo' ? (
      <Chip area="assembleias">{NOME_DA_SITUACAO[l.situacao]}</Chip>
    ) : l.jubilado ? (
      <Chip area="assembleias">Jubilado</Chip>
    ) : l.emDia === false ? (
      <Chip area="pessoas">Em atraso</Chip>
    ) : l.emDia === true ? (
      <Chip area="financas">Em dia</Chip>
    ) : null
  const [primeira, ...outras] = l.pendencias
  return (
    <>
      {principal}
      {primeira && (
        <span title={`Credencial: ${l.pendencias.join(', ')}`}>
          <Chip area="eventos">
            {primeira}
            {outras.length > 0 && ` +${outras.length}`}
          </Chip>
        </span>
      )}
    </>
  )
}
