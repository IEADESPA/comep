// Peças comuns das telas novas das Assembleias (Fase 5.5, parte 14): a presença, a condução, o telão e o fechamento.
import { type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { Aviso, Carregando, MostrarCarga } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { listarEncontros, type ContagemQuorum, type Encontro } from '../../dados/encontros'
import { useCarregar } from '../../estado/useCarregar'
import { quorumPrimeiraChamada } from '../../utilitarios/encontros'
import { ehDaSecretaria, nomeCurto, presencaAberta, useAgora, usePerfisDaConta } from './regras'

/** A presença, a condução e o fechamento são da secretaria e da presidência (o banco garante; aqui, só o aviso). */
export function SoSecretaria({ oQue, children }: { oQue: string; children: ReactNode }) {
  const perfis = usePerfisDaConta()
  if (perfis === null) return <Carregando />
  if (!ehDaSecretaria(perfis)) {
    return (
      <Aviso titulo="Sem permissão">
        <p>{oQue} é da secretaria e da presidência.</p>
        <p>
          <Link to="/assembleias">Voltar às assembleias</Link>
        </p>
      </Aviso>
    )
  }
  return children
}

/** O cartão do quórum: "38 presentes de 66 aptos", a barra com a marca do mínimo e o que falta (ou a instalação). */
export function CartaoQuorum({ e, quorum, grande = false }: { e: Encontro; quorum: ContagemQuorum; grande?: boolean }) {
  const assembleia = e.tipo !== 'reuniao_mensal'
  if (!assembleia) {
    return (
      <section className="bloco cartao-quorum" aria-label="Presentes">
        <p className="rotulo">Presentes</p>
        <p className="quorum-numero">
          <strong>{quorum.presentes}</strong>{' '}
          <span>
            {quorum.presentes === 1 ? 'presente' : 'presentes'} · {quorum.presentes_aptos} em dia
          </span>
        </p>
        <p className="detalhe">Reunião mensal: não tem quórum de instalação. Há {quorum.aptos} associados em dia.</p>
      </section>
    )
  }
  const instalada = e.instalada_em !== null
  const aptos = instalada ? (e.aptos_na_instalacao ?? quorum.aptos) : quorum.aptos
  const presentesAptos = instalada ? (e.presentes_aptos_na_instalacao ?? quorum.presentes_aptos) : quorum.presentes_aptos
  const minimo = quorumPrimeiraChamada(aptos)
  const falta = Math.max(0, minimo - presentesAptos)
  const largura = aptos > 0 ? Math.min(100, Math.round((presentesAptos / aptos) * 100)) : 0
  const marca = aptos > 0 ? Math.min(100, Math.round((minimo / aptos) * 100)) : 0
  return (
    <section className={grande ? 'bloco cartao-quorum cartao-quorum-grande' : 'bloco cartao-quorum'} aria-label="Quórum">
      <p className="rotulo">Quórum · {e.chamada === 'segunda' ? '2ª chamada' : '1ª chamada'}</p>
      <p className={falta === 0 || instalada ? 'quorum-numero quorum-ok' : 'quorum-numero'}>
        <strong>{presentesAptos}</strong> <span>presentes de {aptos} aptos</span>
      </p>
      <span className="quorum-barra" aria-hidden="true">
        <span style={{ width: `${largura}%` }} />
        <i style={{ left: `${marca}%` }} />
      </span>
      {instalada ? (
        <p className="quorum-situacao quorum-ok">
          Instalada em {e.chamada === 'segunda' ? '2ª' : '1ª'} chamada
          {e.chamada === 'primeira' ? `: precisava de ${minimo} (metade mais um dos aptos)` : ': com qualquer número'}
        </p>
      ) : (
        <p className="quorum-situacao">
          {falta === 0
            ? `Já dá para instalar em 1ª chamada (precisa de ${minimo}).`
            : `Faltam ${falta} para a 1ª chamada (precisa de ${minimo}, metade mais um dos aptos).`}
        </p>
      )}
      {quorum.presentes > quorum.presentes_aptos && (
        <p className="detalhe">
          Mais {quorum.presentes - quorum.presentes_aptos} presente{quorum.presentes - quorum.presentes_aptos === 1 ? '' : 's'} em atraso
          (não vota{quorum.presentes - quorum.presentes_aptos === 1 ? '' : 'm'}).
        </p>
      )}
    </section>
  )
}

type Funcao = 'presenca' | 'conducao' | 'fechamento'

const TITULO_DA_FUNCAO: Record<Funcao, string> = { presenca: 'Presença', conducao: 'Condução', fechamento: 'Fechamento e ata' }

/**
 * /assembleias/presenca, /conducao e /fechamento sem o encontro: se há um encontro acontecendo agora (lista de
 * presença aberta), abre direto nele; senão, a pessoa escolhe.
 */
export function EscolherEncontro({ funcao }: { funcao: Funcao }) {
  const [carga, recarregar] = useCarregar(listarEncontros)
  const agora = useAgora(60)
  return (
    <SoSecretaria oQue={TITULO_DA_FUNCAO[funcao]}>
      <CabecalhoFuncao modulo="Assembleias" titulo={TITULO_DA_FUNCAO[funcao]} sub="Escolha o encontro." />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(todos) => {
          const validos = todos.filter((e) => e.situacao === 'convocado' || e.situacao === 'realizado')
          const deHoje = validos.filter((e) => presencaAberta(e, agora))
          if (deHoje.length === 1) return <Navigate to={`/assembleias/${funcao}/${deHoje[0].id}`} replace />
          const proximos = validos.filter((e) => e.situacao === 'convocado').sort((a, b) => a.inicio.localeCompare(b.inicio))
          const anteriores = validos.filter((e) => e.situacao === 'realizado').slice(0, 6)
          const lista = funcao === 'fechamento' ? [...anteriores, ...proximos] : [...proximos, ...anteriores]
          if (lista.length === 0) return <p className="vazio">Nenhum encontro convocado ou realizado.</p>
          return (
            <ul className="lista-encontros-escolher" aria-label="Encontros">
              {lista.map((e) => (
                <li key={e.id}>
                  <Link to={`/assembleias/${funcao}/${e.id}`} className="bloco encontro-escolher">
                    <Icone nome="assembleia" tamanho={22} />
                    <span>
                      <strong>{e.titulo}</strong>
                      <span className="detalhe">
                        {nomeCurto(e)} · {e.situacao === 'realizado' ? 'realizado' : presencaAberta(e, agora) ? 'acontecendo agora' : 'convocado'}
                      </span>
                    </span>
                    <Icone nome="seta" tamanho={18} />
                  </Link>
                </li>
              ))}
            </ul>
          )
        }}
      </MostrarCarga>
    </SoSecretaria>
  )
}

/** As abas do encontro nas três funções do dia (presença, condução e fechamento), com o nome curto no alto. */
export function CabecalhoDoEncontro({ e, titulo, sub, acoes }: { e: Encontro; titulo: string; sub?: ReactNode; acoes?: ReactNode }) {
  return <CabecalhoFuncao modulo={`Assembleias › ${nomeCurto(e)}`} titulo={titulo} sub={sub ?? e.titulo} acoes={acoes} />
}
