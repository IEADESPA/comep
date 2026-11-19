import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { ok } from '../../dados/cliente'
import { regrasDasIgrejas, salvarRegrasDasIgrejas, type RegrasIgrejas } from '../../dados/igrejas'
import { useSessao } from '../../estado/contexto'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { diasEntre, NOME_DO_ITEM, textoDoPrazo } from '../../utilitarios/regularizacao'
import { NumerosGrandes, SeloNivel } from './componentes'
import { carregarIgrejasComSituacao, descreverSituacao, type LinhaIgreja } from './regras'

// Igrejas › Central de regularização (aprovada no documento para a diretoria e na rodada 12, 18/11/2026):
// num lugar só, quem está suspensa (com a contagem dos 30 dias), o que vence nos próximos 60 dias, a associação
// privada com o prazo da natureza, o que falta da transição (AGO de 28/04/2027) e as igrejas sem registro.

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
          const transicao = linhas.filter((l) => de(l.s)?.situacao === 'regular' && (de(l.s)?.pendencias.length ?? 0) > 0)
          const semRegistro = linhas.filter((l) => de(l.s)?.situacao === 'sem_registro')
          return (
            <>
              <NumerosGrandes
                itens={[
                  { rotulo: 'Suspensas', valor: suspensas.length, area: 'pessoas' },
                  { rotulo: `Vencem em ${SEM_VENCER} dias`, valor: vencendo.length, area: 'eventos' },
                  { rotulo: 'Faltam documentos', valor: transicao.length + natureza.length, area: 'assembleias' },
                  { rotulo: 'Sem registro', valor: semRegistro.length, area: 'assembleias' },
                ]}
              />
              <Secao titulo="Suspensas" vazio="Nenhuma igreja suspensa." linhas={suspensas}>
                {(l) => {
                  const s = l.s!.situacao
                  return (
                    <>
                      <span>
                        {s.vencidos.map((v) => NOME_DO_ITEM[v]).join(', ')} · suspensa desde {formatarData(s.suspensa_desde)}
                      </span>
                      <span className={s.perfil_bloqueado ? 'texto-perigo' : 'texto-atencao'}>
                        {s.perfil_bloqueado
                          ? 'Passaram os 30 dias: o perfil de pastor presidente está bloqueado. A secretaria pode mandar o documento pela igreja.'
                          : `O pastor tem até ${formatarData(s.prazo_ate)} para mandar (${textoDoPrazo(hoje, s.prazo_ate!)}).`}
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
                    Até {formatarData(l.s!.situacao.natureza_prazo)}: eleger a diretoria nova e, na mesma ata, mudar a natureza; depois,{' '}
                    {regras.dias_cartao_cnpj} dias para o Cartão CNPJ novo.
                  </span>
                )}
              </Secao>
              <Secao titulo={`Faltam documentos (até ${formatarData(regras.transicao_ate)})`} vazio="Nenhuma igreja com documento faltando." linhas={transicao}>
                {(l) => <span>{descreverSituacao(l.s!.situacao, hoje)}</span>}
              </Secao>
              <Secao titulo="Sem registro: chamar para perto" vazio="Nenhuma igreja sem registro." linhas={semRegistro}>
                {(l) => <span>{[l.denominacao?.nome, l.telefone, l.presidente_nome].filter(Boolean).join(' · ') || 'sem contato'}</span>}
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

function Regras({ regras, podeMudar, aoSalvar }: { regras: RegrasIgrejas; podeMudar: boolean; aoSalvar: () => void }) {
  const [dados, setDados] = useState(regras)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="bloco" aria-labelledby="titulo-regras-regularizacao">
      <h2 id="titulo-regras-regularizacao">As regras</h2>
      <p className="detalhe">
        Venceu a ata ou o alvará, a igreja fica suspensa no mesmo dia. O pastor presidente tem {regras.dias_para_mandar} dias só para mandar o
        documento; sem mandar, o perfil dele é bloqueado (ele continua ministro associado). Mandado antes de vencer, o documento novo entra
        sozinho no dia certo.
      </p>
      {podeMudar ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void umaVez(async () => {
              const r = await salvarRegrasDasIgrejas(dados)
              setRetorno(r.erro !== null ? { erro: r.erro } : { sucesso: 'Regras salvas.' })
              if (r.erro === null) aoSalvar()
            })
          }}
        >
          <div className="grade-form">
            <label>
              Fim da transição (quem já estava cadastrado)
              <input type="date" required value={dados.transicao_ate} onChange={(e) => setDados({ ...dados, transicao_ate: e.target.value })} />
            </label>
            <label>
              Dias para mandar o documento vencido
              <input
                type="number"
                min={1}
                max={180}
                required
                value={dados.dias_para_mandar}
                onChange={(e) => setDados({ ...dados, dias_para_mandar: Number(e.target.value) })}
              />
            </label>
            <label>
              Dias para o Cartão CNPJ novo (depois da ata que muda a natureza)
              <input
                type="number"
                min={30}
                max={365}
                required
                value={dados.dias_cartao_cnpj}
                onChange={(e) => setDados({ ...dados, dias_cartao_cnpj: Number(e.target.value) })}
              />
            </label>
          </div>
          <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
          <div className="acoes">
            <button type="submit" className="botao" disabled={enviando}>
              Salvar as regras
            </button>
          </div>
        </form>
      ) : (
        <dl className="definicoes">
          <dt>Fim da transição</dt>
          <dd>{formatarData(regras.transicao_ate)}</dd>
          <dt>Dias para mandar o documento</dt>
          <dd>{regras.dias_para_mandar}</dd>
          <dt>Dias para o Cartão CNPJ novo</dt>
          <dd>{regras.dias_cartao_cnpj}</dd>
        </dl>
      )}
      {!podeMudar && <p className="detalhe">Só a presidência muda estas regras.</p>}
    </section>
  )
}
