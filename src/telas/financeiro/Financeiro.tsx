import { useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { Carregando, Mensagem } from '../../componentes/Basicos'
import { Chip } from '../../componentes/Telas'
import { ok, type Resultado } from '../../dados/cliente'
import { mesesDoConselho, NOME_DA_SITUACAO_MES } from '../../dados/conselhoFiscal'
import type { Perfil } from '../../dados/perfis'
import { AREA_DA_SITUACAO } from '../conselho/regras'
import { useSessao } from '../../estado/contexto'
import { ContasESaldos, ExtratoCaixa, Transferencias } from './Caixa'
import { CabecalhoFinanceiro } from './comum'
import { type Concluir } from './util'
import { ComprovantesConferidos, ComprovantesParaConferir } from './Comprovantes'
import { CobrancasDoAno, ContribuicoesPorIgreja, PainelContribuicoes, ValoresEPlanos } from './Contribuicoes'
import { DespesasDecididas, DespesasEsperando } from './Despesas'
import { ModelosExclusivosNoCaixa } from './ModelosExclusivos'
import { OrcamentoPorCategoria, PlanoAnual } from './Orcamento'
import { PrestacaoBalanco, PrestacaoExercicio, PrestacaoMesAMes } from './PrestacaoContas'

// O módulo Financeiro (telas novas, Fase 5.5, parte 9; rodada 11 aprovada em 18/11/2026): as 6 funções na coluna da
// esquerda ("o módulo toma a coluna"), cada uma com as subfunções em sanfona (src/componentes/menu.ts). Cada
// subfunção tem endereço próprio: /financeiro/<função>[/<subfunção>].
// A tesouraria e a presidência operam; o Conselho Fiscal só vê (Art. 14) e não confere os comprovantes.

/** No mês a mês, a situação de cada mês no Conselho Fiscal (Fase 5.5, parte 10). */
const COLUNA_DO_CONSELHO = {
  titulo: 'Conselho Fiscal',
  valor: async (exercicio: number): Promise<Resultado<Record<string, ReactNode>>> => {
    const r = await mesesDoConselho(exercicio)
    if (r.erro !== null) return r
    return ok(
      Object.fromEntries(
        r.dados.map((m) => {
          const area = AREA_DA_SITUACAO[m.situacao]
          return [m.competencia.slice(0, 7), area ? <Chip key={m.competencia} area={area}>{NOME_DA_SITUACAO_MES[m.situacao]}</Chip> : '—']
        }),
      ),
    )
  },
}

type Contexto = { pessoaId: string; perfis: Perfil[]; opera: boolean; concluir: Concluir }

type Tela = { funcao: string; titulo: string; sub?: string; conteudo: (c: Contexto) => ReactNode; soQuemOpera?: boolean }

const TELAS: Record<string, Tela> = {
  contribuicoes: {
    funcao: 'Contribuições',
    titulo: 'Situação dos ministros',
    conteudo: (c) => <PainelContribuicoes pessoaId={c.pessoaId} opera={c.opera} concluir={c.concluir} />,
  },
  'contribuicoes/igrejas': { funcao: 'Contribuições', titulo: 'Por igreja', conteudo: () => <ContribuicoesPorIgreja /> },
  'contribuicoes/cobrancas': {
    funcao: 'Contribuições',
    titulo: 'Cobranças do ano',
    conteudo: (c) => <CobrancasDoAno concluir={c.concluir} somenteLeitura={!c.opera} />,
  },
  'contribuicoes/valores': {
    funcao: 'Contribuições',
    titulo: 'Valores e planos',
    sub: 'Os valores vêm da Assembleia Ordinária (Art. 7º, §3º); o histórico fica guardado.',
    conteudo: (c) => <ValoresEPlanos podeEditar={c.opera} />,
  },
  comprovantes: {
    funcao: 'Comprovantes',
    titulo: 'Para conferir',
    soQuemOpera: true,
    conteudo: (c) => <ComprovantesParaConferir pessoaId={c.pessoaId} concluir={c.concluir} />,
  },
  'comprovantes/conferidos': { funcao: 'Comprovantes', titulo: 'Já conferidos', soQuemOpera: true, conteudo: () => <ComprovantesConferidos /> },
  caixa: {
    funcao: 'Caixa',
    titulo: 'Lançamentos',
    conteudo: (c) => <ExtratoCaixa pessoaId={c.pessoaId} perfis={c.perfis} concluir={c.concluir} somenteLeitura={!c.opera} />,
  },
  'caixa/contas': { funcao: 'Caixa', titulo: 'Contas e saldos', conteudo: (c) => <ContasESaldos somenteLeitura={!c.opera} /> },
  'caixa/transferencias': {
    funcao: 'Caixa',
    titulo: 'Transferências',
    conteudo: (c) => <Transferencias concluir={c.concluir} somenteLeitura={!c.opera} />,
  },
  'caixa/modelos': {
    funcao: 'Caixa',
    titulo: 'Modelos exclusivos',
    sub: 'O pagamento do modelo exclusivo da credencial, que a igreja paga: receber ou desfazer, com a entrada no caixa.',
    soQuemOpera: true,
    conteudo: (c) => <ModelosExclusivosNoCaixa concluir={c.concluir} />,
  },
  despesas: {
    funcao: 'Despesas a autorizar',
    titulo: 'Esperando',
    conteudo: (c) => <DespesasEsperando podeAutorizar={c.perfis.includes('presidencia')} pessoaId={c.pessoaId} concluir={c.concluir} />,
  },
  'despesas/autorizadas': { funcao: 'Despesas a autorizar', titulo: 'Autorizadas', conteudo: () => <DespesasDecididas situacao="efetivado" /> },
  'despesas/recusadas': { funcao: 'Despesas a autorizar', titulo: 'Recusadas', conteudo: () => <DespesasDecididas situacao="recusado" /> },
  orcamento: {
    funcao: 'Orçamento',
    titulo: 'Orçamento por categoria',
    sub: 'O previsto de cada categoria para o exercício (abril a março), que vai para a assembleia (Art. 15, I).',
    conteudo: (c) => <OrcamentoPorCategoria perfis={c.perfis} concluir={c.concluir} />,
  },
  'orcamento/plano': {
    funcao: 'Orçamento',
    titulo: 'Plano anual de trabalho',
    sub: 'As atividades do exercício, mês a mês, com quem cuida e quanto custa. Vai para a assembleia junto com o orçamento.',
    conteudo: (c) => <PlanoAnual perfis={c.perfis} concluir={c.concluir} />,
  },
  prestacao: {
    funcao: 'Prestação de contas',
    titulo: 'Prestação de contas',
    sub: 'O balanço do exercício (abril a março) em quatro passos: a tesouraria fecha, a diretoria analisa, o Conselho Fiscal dá o parecer e a assembleia aprecia.',
    conteudo: (c) => <PrestacaoExercicio perfis={c.perfis} pessoaId={c.pessoaId} />,
  },
  'prestacao/mes-a-mes': {
    funcao: 'Prestação de contas',
    titulo: 'Mês a mês',
    sub: 'As receitas e as despesas de cada mês e o parecer do Conselho Fiscal sobre ele.',
    conteudo: () => <PrestacaoMesAMes colunaExtra={COLUNA_DO_CONSELHO} />,
  },
  'prestacao/balanco': { funcao: 'Prestação de contas', titulo: 'Balanço e parecer', conteudo: () => <PrestacaoBalanco /> },
}

/** /financeiro, /financeiro/:parte e /financeiro/:parte/:sub. */
export function Financeiro() {
  const { estado } = useSessao()
  const { parte, sub } = useParams()
  if (estado.situacao !== 'logado' || estado.conta?.tipo !== 'ok') return <Carregando />
  const perfis = estado.conta.conta.perfis
  const opera = perfis.includes('tesouraria') || perfis.includes('presidencia')
  const chave = sub ? `${parte}/${sub}` : (parte ?? '')
  const tela = TELAS[chave]
  // /financeiro (ou um endereço que não existe) abre o que espera alguém: os comprovantes, para quem opera;
  // a prestação de contas, para o Conselho Fiscal (os comprovantes a conferir não são dele — Art. 14: só leitura)
  if (!tela || (tela.soQuemOpera && !opera)) return <Navigate to={opera ? '/financeiro/comprovantes' : '/financeiro/prestacao'} replace />
  return <TelaDoFinanceiro key={chave} tela={tela} pessoaId={estado.conta.conta.pessoaId} perfis={perfis} opera={opera} />
}

function TelaDoFinanceiro({ tela, pessoaId, perfis, opera }: { tela: Tela; pessoaId: string; perfis: Perfil[]; opera: boolean }) {
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [versao, setVersao] = useState(0)
  const concluir: Concluir = (r, sucesso) => {
    setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso })
    if (r.erro === null) setVersao((v) => v + 1)
    return r.erro === null
  }
  return (
    <div className="tela-nova fin-tela">
      <div className="nao-imprimir">
        <CabecalhoFinanceiro
          funcao={tela.funcao}
          titulo={tela.titulo}
          versao={versao}
          sub={
            [tela.sub, !opera && `Você vê o financeiro como Conselho Fiscal: só leitura${tela.funcao === 'Prestação de contas' ? ', e o parecer sobre o balanço anual' : ''}.`]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
      </div>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      {tela.conteudo({ pessoaId, perfis, opera, concluir })}
    </div>
  )
}
