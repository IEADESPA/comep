import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { ok } from '../../dados/cliente'
import {
  efeitoDasRegras,
  regrasDasIgrejas,
  salvarRegrasDasIgrejas,
  type EfeitoDasRegras,
  type MudancaDeSituacao,
  type RegrasIgrejas,
} from '../../dados/igrejas'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { esquecerRegrasDasIgrejas } from '../../estado/useRegrasDasIgrejas'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { diasEntre, fimDaTolerancia, oQueSuspendeu, textoDoPrazo, textoDosDiasParaMandar } from '../../utilitarios/regularizacao'
import { NumerosGrandes, SeloNivel } from './componentes'
import { carregarIgrejasComSituacao, descreverSituacao, type LinhaIgreja } from './regras'

// Igrejas › Central de regularização (aprovada no documento para a diretoria e na rodada 12, 18/11/2026; as regras
// novas do presidente, de 26/11/2026): num lugar só, quem está suspensa (com a contagem dos dias para mandar), o que
// vence nos próximos 60 dias, a associação privada com o prazo da natureza, o que falta e ainda está no prazo (o
// alvará na tolerância de janeiro) e as igrejas sem registro, com o prazo para se registrar. Só a presidência muda as
// regras, e antes de salvar a tela mostra quais igrejas mudam de situação hoje (S7-08).

const SEM_VENCER = 60

/** /igrejas/regularizacao */
export function CentralRegularizacao() {
  const { estado } = useSessao()
  const perfis = estado.situacao === 'logado' && estado.conta?.tipo === 'ok' ? estado.conta.conta.perfis : []
  const [carga, recarregar] = useCarregar(async () => {
    const [linhas, regras] = await Promise.all([carregarIgrejasComSituacao(), regrasDasIgrejas()])
    if (linhas.erro !== null) return linhas
    if (regras.erro !== null) return regras
    return ok({ linhas: linhas.dados, regras: regras.dados })
  })
  const hoje = hojeIso()
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Igrejas"
        titulo="Central de regularização"
        sub="O COMEP representa a classe pelas igrejas regulares. Aqui fica o que falta a cada uma, para chamar para perto e ajudar."
      />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ linhas, regras }) => {
          const de = (n: LinhaIgreja['s']) => n?.situacao
          const suspensas = linhas.filter((l) => de(l.s)?.situacao === 'suspensa')
          const vencendo = linhas.filter((l) => {
            const s = de(l.s)
            return s?.situacao === 'regular' && s.proximo_vencimento && diasEntre(hoje, s.proximo_vencimento) <= SEM_VENCER && s.pendencias.length === 0
          })
          const natureza = linhas.filter((l) => de(l.s)?.situacao === 'regular' && de(l.s)?.natureza_prazo)
          const noPrazo = linhas.filter((l) => de(l.s)?.situacao === 'regular' && (de(l.s)?.pendencias.length ?? 0) > 0)
          const semRegistro = linhas.filter((l) => de(l.s)?.situacao === 'sem_registro')
          // a associação privada com documento faltando está nas duas listas: conta uma vez só (S7-10 b)
          const faltam = new Set([...noPrazo, ...natureza].map((l) => l.id)).size
          return (
            <>
              <NumerosGrandes
                itens={[
                  { rotulo: 'Suspensas', valor: suspensas.length, area: 'pessoas' },
                  { rotulo: `Vencem em ${SEM_VENCER} dias`, valor: vencendo.length, area: 'eventos' },
                  { rotulo: 'Faltam documentos', valor: faltam, area: 'assembleias' },
                  { rotulo: 'Sem registro', valor: semRegistro.length, area: 'assembleias' },
                ]}
              />
              <Secao titulo="Suspensas" vazio="Nenhuma igreja suspensa." linhas={suspensas}>
                {(l) => {
                  const s = l.s!.situacao
                  return (
                    <>
                      <span>
                        {oQueSuspendeu(s).join(' · ')} · suspensa desde {formatarData(s.suspensa_desde)}
                      </span>
                      <span className={s.perfil_bloqueado ? 'texto-perigo' : 'texto-atencao'}>
                        {s.perfil_bloqueado
                          ? 'Acabou o prazo para mandar: o perfil de pastor presidente está bloqueado. A secretaria pode mandar o documento pela igreja.'
                          : `O pastor tem até ${formatarData(s.prazo_ate)} para mandar (${textoDosDiasParaMandar(hoje, s.prazo_ate!)}).`}
                      </span>
                    </>
                  )
                }}
              </Secao>
              <Secao titulo={`Vencem nos próximos ${SEM_VENCER} dias`} vazio="Nada vencendo agora." linhas={vencendo}>
                {(l) => (
                  <span>
                    {descreverSituacao(l.s!.situacao, hoje)} · {textoDoPrazo(hoje, l.s!.situacao.proximo_vencimento!)}. Os avisos de 60 e 30 dias vão ao
                    pastor presidente.
                  </span>
                )}
              </Secao>
              <Secao titulo="Associação privada: mudar para organização religiosa" vazio="Nenhuma igreja com esse prazo." linhas={natureza}>
                {(l) => (
                  <span>
                    Até {formatarData(l.s!.situacao.natureza_prazo)} ({textoDoPrazo(hoje, l.s!.situacao.natureza_prazo!)}): mudar para organização
                    religiosa e mandar o Cartão CNPJ novo. Depois, a igreja fica suspensa.
                  </span>
                )}
              </Secao>
              <Secao titulo="Faltam documentos (ainda no prazo)" vazio="Nenhuma igreja com documento faltando no prazo." linhas={noPrazo}>
                {(l) => <span>{descreverSituacao(l.s!.situacao, hoje)}</span>}
              </Secao>
              <Secao titulo="Sem registro: chamar para perto" vazio="Nenhuma igreja sem registro." linhas={semRegistro}>
                {(l) => {
                  const ate = l.s?.situacao.readequacao_ate
                  return (
                    <>
                      <span>{[l.denominacao?.nome, l.telefone, l.presidente_nome].filter(Boolean).join(' · ') || 'sem contato'}</span>
                      {ate && (
                        <span className={diasEntre(hoje, ate) < 0 ? 'texto-perigo' : undefined}>
                          Registrar até {formatarData(ate)} ({textoDoPrazo(hoje, ate)}).
                        </span>
                      )}
                    </>
                  )
                }}
              </Secao>
              <Regras regras={regras} podeMudar={perfis.includes('presidencia')} aoSalvar={recarregar} />
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}

function Secao({
  titulo,
  vazio,
  linhas,
  children,
}: {
  titulo: string
  vazio: string
  linhas: LinhaIgreja[]
  children: (l: LinhaIgreja) => ReactNode
}) {
  return (
    <section className="bloco" aria-label={titulo}>
      <h2>
        {titulo} ({linhas.length})
      </h2>
      {linhas.length === 0 ? (
        <p className="vazio">{vazio}</p>
      ) : (
        <ul className="lista-linhas" aria-label={titulo}>
          {linhas.map((l) => (
            <li key={l.id}>
              <SeloNivel nivel={l.s?.situacao.situacao ?? 'regular'} />
              <Link to={`/igrejas/${l.id}/situacao`} className="linha-corpo linha-link">
                <strong>{l.nome}</strong>
                {children(l)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Os campos das regras, com os limites do banco. */
const CAMPOS: { campo: keyof RegrasIgrejas; rotulo: string; curto: string; min: number; max: number }[] = [
  { campo: 'dias_para_mandar', rotulo: 'Dias para mandar o documento que falta ou que venceu', curto: 'Dias para mandar o documento', min: 1, max: 180 },
  {
    campo: 'dias_tolerancia_alvara',
    rotulo: 'Tolerância do alvará que vence em 31/12, em dias (31: até 31/01; 0: sem tolerância)',
    curto: 'Tolerância do alvará que vence em 31/12',
    min: 0,
    max: 90,
  },
  { campo: 'dias_apos_recusa', rotulo: 'Dias para mandar de novo, depois da recusa fora do prazo', curto: 'Dias depois da recusa fora do prazo', min: 1, max: 60 },
  { campo: 'dias_natureza', rotulo: 'Dias da associação privada para mudar para organização religiosa', curto: 'Dias da associação privada', min: 30, max: 365 },
  { campo: 'dias_readequacao', rotulo: 'Dias da igreja sem registro para se registrar', curto: 'Dias da igreja sem registro', min: 30, max: 365 },
]

const NOME_DO_ESTADO: Record<MudancaDeSituacao['antes'], string> = {
  regular: 'regular',
  suspensa: 'suspensa',
  bloqueada: 'suspensa e com o perfil do pastor bloqueado',
}

/** Quantas mudanças a confirmação lista (as outras ficam no "e mais"). */
const MOSTRAR_MUDANCAS = 20

function Regras({ regras, podeMudar, aoSalvar }: { regras: RegrasIgrejas; podeMudar: boolean; aoSalvar: () => void }) {
  const [dados, setDados] = useState(regras)
  const [efeito, setEfeito] = useState<EfeitoDasRegras | null>(null)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [enviando, umaVez] = useUmaVez()
  const tolerancia = fimDaTolerancia(regras.dias_tolerancia_alvara)
  return (
    <section className="bloco" aria-labelledby="titulo-regras-regularizacao">
      <h2 id="titulo-regras-regularizacao">As regras</h2>
      <p className="detalhe">
        Faltou algum documento na ativação, ou venceu a ata ou o alvará, a igreja fica suspensa (desde a ativação, ou do dia seguinte ao
        vencimento). O pastor presidente tem então {regras.dias_para_mandar} dias só para mandar o documento; sem mandar, o perfil dele é bloqueado
        (ele continua ministro associado).{' '}
        {tolerancia ? `O alvará que vence em 31/12 só suspende se o novo não chegar até ${tolerancia}. ` : ''}Mandado no prazo e recusado depois
        dele, o pastor ainda tem {regras.dias_apos_recusa} dias, contados da recusa.
      </p>
      <p className="detalhe">
        A associação privada tem {regras.dias_natureza} dias, da ativação ou da conferência do Cartão CNPJ que a mostra assim, para mudar para
        organização religiosa; depois, a igreja fica suspensa. A igreja sem registro tem {regras.dias_readequacao} dias, da ativação, para se
        registrar. Mandado antes de vencer, o documento novo entra sozinho no dia certo.
      </p>
      {podeMudar ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              // primeiro o efeito (S7-08): quais igrejas mudam de situação hoje; depois, a confirmação salva
              if (efeito === null) {
                const r = await efeitoDasRegras(dados)
                if (r.erro !== null) setRetorno({ erro: r.erro })
                else setEfeito(r.dados)
                return
              }
              const r = await salvarRegrasDasIgrejas(dados)
              setEfeito(null)
              if (r.erro === null) esquecerRegrasDasIgrejas()
              setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Regras salvas.' })
              if (r.erro === null) aoSalvar()
            })
          }}
        >
          <div className="grade-form">
            {CAMPOS.map((c) => (
              <label key={c.campo}>
                {c.rotulo}
                <input
                  type="number"
                  inputMode="numeric"
                  min={c.min}
                  max={c.max}
                  required
                  value={dados[c.campo]}
                  onChange={(e) => {
                    setDados({ ...dados, [c.campo]: Number(e.target.value) })
                    setEfeito(null)
                    setRetorno({})
                  }}
                />
              </label>
            ))}
          </div>
          {efeito && <EfeitoAntesDeSalvar efeito={efeito} />}
          <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
          <div className="acoes">
            {efeito ? (
              <span className="confirmar-linha">
                <button type="submit" className={efeito.mudam.length > 0 ? 'botao botao-perigo-cheio' : 'botao'} disabled={enviando}>
                  Confirmar e salvar as regras
                </button>
                <button type="button" className="botao-texto" onClick={() => setEfeito(null)}>
                  Voltar
                </button>
              </span>
            ) : (
              <button type="submit" className="botao" disabled={enviando}>
                Salvar as regras
              </button>
            )}
          </div>
        </form>
      ) : (
        <dl className="definicoes">
          {CAMPOS.map((c) => (
            <ItemDaRegra key={c.campo} rotulo={c.curto} valor={regras[c.campo]} />
          ))}
        </dl>
      )}
      {!podeMudar && <p className="detalhe">Só a presidência muda estas regras.</p>}
    </section>
  )
}

function ItemDaRegra({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <>
      <dt>{rotulo}</dt>
      <dd>{valor === 1 ? '1 dia' : `${valor} dias`}</dd>
    </>
  )
}

/** S7-08: antes de salvar, o que muda hoje com as regras novas (nada foi salvo ainda). */
function EfeitoAntesDeSalvar({ efeito }: { efeito: EfeitoDasRegras }) {
  const n = efeito.mudam.length
  if (n === 0) {
    return (
      <p className="aviso-texto" role="status">
        Com estas regras, nenhuma das {efeito.igrejas} igrejas muda de situação hoje. Confirme para salvar.
      </p>
    )
  }
  return (
    <div className="aviso-texto" role="status">
      <p>
        Com estas regras, {n === 1 ? '1 igreja muda' : `${n} igrejas mudam`} de situação hoje. Confira antes de salvar:
      </p>
      <ul className="lista-pendencias">
        {efeito.mudam.slice(0, MOSTRAR_MUDANCAS).map((m) => (
          <li key={m.igreja_id}>
            {m.nome}: de {NOME_DO_ESTADO[m.antes]} para {NOME_DO_ESTADO[m.depois]}
          </li>
        ))}
        {n > MOSTRAR_MUDANCAS && <li>e mais {n - MOSTRAR_MUDANCAS}</li>}
      </ul>
    </div>
  )
}
