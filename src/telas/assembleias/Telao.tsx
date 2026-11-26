// O telão da assembleia (rodada 15, asm-conducao opção 2, aprovada junto com o painel e o roteiro): a tela para a
// TV ou o projetor da sede, fora da moldura. Mostra o quórum, o item de agora do roteiro e a votação dele (a parcial
// só no voto aberto; no secreto, só quantos já votaram; encerrada, o resultado). Os controles ficam na condução,
// no celular ou no computador de quem conduz. Sem fundo preto (decisão do usuário): segue o tema claro ou escuro.
// Sem votação para mostrar (a reunião mensal, a abertura, um item de informe), o telão fica numa coluna só, no centro:
// o lado direito vazio deixava o título do encontro solto ao lado do número (revisão da parte 14, achado 10).
import { useRef } from 'react'
import { Link, useParams } from 'react-router'
import { Aviso, MostrarCarga } from '../../componentes/Basicos'
import { MarcaCaixa } from '../../componentes/Icone'
import { ok } from '../../dados/cliente'
import { buscarEncontro, contagemQuorum, listarDeliberacoes, NOME_DO_TIPO } from '../../dados/encontros'
import { resultadoVotacao, votacoesDoEncontro } from '../../dados/votacoes'
import { useCarregar } from '../../estado/useCarregar'
import { quorumPrimeiraChamada } from '../../utilitarios/encontros'
import { BarrasDaVotacao } from './Conducao'
import { SoSecretaria } from './comum'
import { itensDoRoteiro, nomeCurto, useAtualizarACada, votacaoDoItem } from './regras'

export function TelaoDoEncontro() {
  const { id = '' } = useParams()
  return (
    <SoSecretaria oQue="O telão da assembleia">
      <ConteudoTelao key={id} id={id} />
    </SoSecretaria>
  )
}

function ConteudoTelao({ id }: { id: string }) {
  const tela = useRef<HTMLDivElement>(null)
  const [carga, recarregar] = useCarregar(async () => {
    const [encontro, quorum, votos, votacoes] = await Promise.all([
      buscarEncontro(id),
      contagemQuorum(id),
      listarDeliberacoes(id),
      votacoesDoEncontro(id),
    ])
    if (encontro.erro !== null) return encontro
    if (quorum.erro !== null) return quorum
    if (votos.erro !== null) return votos
    if (votacoes.erro !== null) return votacoes
    const e = encontro.dados
    // a votação aberta do item de agora: a parcial (ou só quantos já votaram, no voto secreto)
    const atual = e ? (itensDoRoteiro(e).find((i) => i.chave === e.roteiro_atual) ?? null) : null
    const votacao = atual?.pauta ? votacaoDoItem(votacoes.dados, atual.pauta.id) : null
    const parcial = votacao?.situacao === 'aberta' ? await resultadoVotacao(votacao.id) : ok(null)
    if (parcial.erro !== null) return parcial
    return ok({ e, quorum: quorum.dados, votos: votos.dados, atual, votacao, parcial: parcial.dados })
  })
  // o telão acompanha a condução sozinho
  useAtualizarACada(recarregar, 4)

  return (
    <div className="telao" ref={tela}>
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {({ e, quorum, votos, atual, votacao, parcial }) => {
          if (!e || (e.situacao !== 'convocado' && e.situacao !== 'realizado')) {
            return (
              <Aviso titulo="Encontro não encontrado">
                <p>O telão é dos encontros convocados (ou já realizados).</p>
              </Aviso>
            )
          }
          const assembleia = e.tipo !== 'reuniao_mensal'
          const instalada = e.instalada_em !== null
          const aptos = instalada ? (e.aptos_na_instalacao ?? quorum.aptos) : quorum.aptos
          const presentes = assembleia ? (instalada ? (e.presentes_aptos_na_instalacao ?? quorum.presentes_aptos) : quorum.presentes_aptos) : quorum.presentes
          const voto = atual?.pauta ? (votos.find((v) => v.pauta_id === atual.pauta!.id) ?? null) : null
          const votacaoAberta = votacao?.situacao === 'aberta' && parcial ? parcial : null
          const temLadoDireito = Boolean(votacaoAberta || voto || atual?.pauta?.deliberativo)
          return (
            <>
              <header className="telao-topo">
                <span className="telao-marca">
                  <MarcaCaixa tamanho={44} />
                  <span>
                    <strong>COMEP</strong>
                    <span>
                      {NOME_DO_TIPO[e.tipo]} · {nomeCurto(e)}
                    </span>
                  </span>
                </span>
                <span className="telao-acoes nao-imprimir">
                  <button type="button" className="botao botao-secundario" onClick={() => void tela.current?.requestFullscreen?.()}>
                    Tela cheia
                  </button>
                  <Link className="botao-texto" to={`/assembleias/conducao/${e.id}`}>
                    Voltar à condução
                  </Link>
                </span>
              </header>
              <main className={temLadoDireito ? 'telao-miolo' : 'telao-miolo telao-uma-coluna'} aria-label="Telão">
                <section className="telao-esquerda">
                  <p className="telao-rotulo">{assembleia ? 'Quórum' : 'Presentes'}</p>
                  <p className="telao-numero">{presentes}</p>
                  <p className="telao-sub">
                    {assembleia ? (
                      <>
                        presentes de {aptos} aptos ·{' '}
                        {instalada
                          ? 'instalada'
                          : `faltam ${Math.max(0, quorumPrimeiraChamada(aptos) - presentes)} para a 1ª chamada`}
                      </>
                    ) : (
                      'presentes na reunião'
                    )}
                  </p>
                  <p className="telao-rotulo">Agora</p>
                  <h1 className="telao-item">
                    {atual ? (
                      <>
                        {atual.numero ? `${atual.numero} · ` : ''}
                        {atual.titulo}
                      </>
                    ) : (
                      'Vamos começar'
                    )}
                  </h1>
                </section>
                {temLadoDireito && (
                  <section className="telao-direita" aria-live="polite">
                    {votacaoAberta ? (
                      <>
                        {votacaoAberta.mostra_contagem ? (
                          <BarrasDaVotacao opcoes={votacaoAberta.opcoes} />
                        ) : (
                          <p className="telao-secreto">Voto secreto: o resultado aparece quando a votação for apurada.</p>
                        )}
                        <p className="telao-sub">
                          {votacaoAberta.votantes} de {votacaoAberta.aptos} votantes em dia já votaram.
                        </p>
                        <p className="telao-chamada">Vote pelo celular: aplicativo do COMEP › Votações</p>
                      </>
                    ) : voto ? (
                      <>
                        <p className={voto.aprovada ? 'telao-resultado telao-aprovado' : 'telao-resultado telao-rejeitado'}>
                          {voto.aprovada ? 'Aprovado' : 'Rejeitado'}
                        </p>
                        <BarrasDaVotacao
                          opcoes={[
                            { id: 'a', texto: 'A favor', papel: 'a_favor', votos: voto.a_favor },
                            { id: 'c', texto: 'Contra', papel: 'contra', votos: voto.contra },
                            { id: 'b', texto: 'Abstenções', papel: 'abstencao', votos: voto.abstencoes },
                          ]}
                        />
                      </>
                    ) : (
                      <p className="telao-secreto">Este item vai a votação. Aguarde a abertura.</p>
                    )}
                  </section>
                )}
              </main>
            </>
          )
        }}
      </MostrarCarga>
    </div>
  )
}
