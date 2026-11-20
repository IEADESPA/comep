import type { ReactNode } from 'react'
import type { Area } from '../../componentes/Icone'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { formatarReais } from '../../dados/configuracoes'
import { nomeDoExercicio, numerosDoFinanceiro } from '../../dados/financeiro'
import { useCarregar } from '../../estado/useCarregar'
import { useLinkDoArquivo } from './util'

// Peças das telas do Financeiro (telas novas, Fase 5.5, parte 9; rodada 11 aprovada em 18/11/2026).

/**
 * O alto de cada função: "Financeiro › Função" pequeno em cima, o nome da subfunção e, no computador, os três
 * números do Financeiro à direita (o saldo de hoje, o recebido no exercício e o que está em aberto).
 * `versao` muda depois de cada ação, para os números se atualizarem.
 */
export function CabecalhoFinanceiro({
  funcao,
  titulo,
  sub,
  versao = 0,
  acoes,
}: {
  funcao: string
  titulo: string
  sub?: ReactNode
  versao?: number
  acoes?: ReactNode
}) {
  return (
    <div className="fin-cabecalho">
      <CabecalhoFuncao modulo={`Financeiro › ${funcao}`} titulo={titulo} sub={sub} acoes={acoes} />
      <NumerosDoAlto key={versao} />
    </div>
  )
}

function NumerosDoAlto() {
  const [carga] = useCarregar(numerosDoFinanceiro)
  if (carga.situacao !== 'ok') return <div className="fin-numeros so-computador" aria-hidden="true" />
  const n = carga.dados
  return (
    <dl className="fin-numeros so-computador" aria-label="Os números do Financeiro">
      <div>
        <dt>Saldo de hoje</dt>
        <dd>{formatarReais(n.saldo)}</dd>
      </div>
      <div>
        <dt>Recebido em {nomeDoExercicio(n.exercicio)}</dt>
        <dd>{formatarReais(n.contribuicoes.recebido)}</dd>
      </div>
      <div>
        <dt>Em aberto</dt>
        <dd>{formatarReais(n.contribuicoes.em_aberto)}</dd>
      </div>
    </dl>
  )
}

/** Um número com a barra embaixo (o "medidor" do desenho aprovado). */
export function Medidor({
  rotulo,
  valor,
  sub,
  pct,
  area,
}: {
  rotulo: string
  valor: ReactNode
  sub?: ReactNode
  pct: number
  area: Area
}) {
  const largura = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className={`fin-medidor area-${area}`}>
      <span className="fin-rotulo">{rotulo}</span>
      <strong>{valor}</strong>
      <span className="fin-barra" aria-hidden="true">
        <span style={{ width: `${largura}%` }} />
      </span>
      {sub && <span className="fin-medidor-sub">{sub}</span>}
    </div>
  )
}

/** O valor com o sinal e a cor: entrada (+, verde), saída (−, vermelho) ou neutro (transferência). */
export function Valor({ tipo, valor, neutro = false }: { tipo: 'entrada' | 'saida'; valor: number; neutro?: boolean }) {
  if (neutro) return <span className="fin-valor">{formatarReais(valor)}</span>
  return (
    <span className={tipo === 'entrada' ? 'fin-valor valor-entrada' : 'fin-valor valor-saida'}>
      {tipo === 'entrada' ? '+' : '−'} {formatarReais(valor)}
    </span>
  )
}

/** "Ver comprovante" (abre noutra aba), ou "sem comprovante". */
export function LinkComprovante({ caminho, texto = 'Ver comprovante', semTexto = 'sem comprovante' }: { caminho: string | null; texto?: string; semTexto?: string }) {
  const url = useLinkDoArquivo(caminho)
  if (!caminho) return <span className="fin-sem-comprovante">{semTexto}</span>
  if (url === undefined) return <span className="detalhe">Carregando o comprovante…</span>
  if (url === null) return <span className="detalhe">Não foi possível abrir o comprovante agora.</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="fin-link-comprovante">
      <Icone nome="imagem" tamanho={16} />
      {texto}
    </a>
  )
}

