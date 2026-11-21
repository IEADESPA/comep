import { MostrarCarga } from '../../componentes/Basicos'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import { situacaoDosAvisos } from '../../dados/notificacoes'
import { chavePublicaDoEnvio } from '../../estado/avisosNoAparelho'
import { useCarregar } from '../../estado/useCarregar'
import { formatarDataDeInstante, horaCurta } from '../../utilitarios/formatos'

// Administração › Avisos e notificações (parte 11; o desenho da rodada 19 só trazia o item no menu de Configurações):
// quantos ativaram os avisos no celular, os aparelhos, o último envio e o que o sistema avisa sozinho.

const O_QUE_AVISA: readonly [string, string][] = [
  ['Assembleia ou reunião convocada', 'a todos os associados, na hora da convocação'],
  ['Pedido de AGE', 'a quem pode assinar, quando o pedido é aberto'],
  ['Votação ou enquete aberta', 'a quem pode votar, quando ela abre'],
  ['Aviso novo no mural', 'a quem é do COMEP, quando a secretaria publica'],
  ['Comprovante conferido', 'a quem pagou, quando a tesouraria confirma ou não'],
  ['Pendência no pedido de associação', 'a quem pediu'],
  ['Documentos da igreja', 'ao pastor presidente, 60 e 30 dias antes de vencer, e se a igreja ficar suspensa'],
  ['Item da igreja devolvido', 'a quem mandou, quando a secretaria devolve um documento ou um item da análise'],
  ['Lembrete da contribuição', 'quando a tesouraria aperta "Lembrar todos"'],
  ['Recado da secretaria', 'quando a secretaria usa "Mandar pelo aplicativo", na ficha do ministro'],
]

export function SituacaoDosAvisosPagina() {
  const [carga, recarregar] = useCarregar(situacaoDosAvisos)
  const chave = chavePublicaDoEnvio() !== null
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Administração"
        titulo="Avisos e notificações"
        sub="O sino e a notificação no celular, pelo navegador. Sem e-mail e sem SMS."
      />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(s) => (
          <>
            <div className="numeros-avisos">
              <span className="numero-aviso">
                <span className="detalhe">Ativaram os avisos</span>
                <strong>
                  {s.ativaram} de {s.pessoas}
                </strong>
                <span className="detalhe">{s.recusaram} responderam "Agora não"</span>
              </span>
              <span className="numero-aviso">
                <span className="detalhe">Aparelhos recebendo</span>
                <strong>{s.aparelhos}</strong>
                <span className="detalhe">de {s.pessoas_com_aparelho} pessoas</span>
              </span>
              <span className="numero-aviso">
                <span className="detalhe">Avisos nos últimos 7 dias</span>
                <strong>{s.notificacoes_7_dias}</strong>
                <span className="detalhe">no sino de cada pessoa</span>
              </span>
              <span className="numero-aviso">
                <span className="detalhe">Último envio ao celular</span>
                <strong>{s.ultimo_envio ? formatarDataDeInstante(s.ultimo_envio) : '—'}</strong>
                <span className="detalhe">{s.ultimo_envio ? `às ${horaCurta(s.ultimo_envio)}` : 'nenhum ainda'}</span>
              </span>
            </div>

            <section className="bloco" aria-labelledby="titulo-envio-celular">
              <h2 id="titulo-envio-celular">O envio para o celular</h2>
              {chave && s.ultimo_envio ? (
                <p className="texto-bloco">
                  Ligado. Os avisos chegam ao celular de quem ativou, respeitando o que cada um escolheu e o silêncio à noite.
                </p>
              ) : (
                <>
                  <p className="texto-bloco">
                    {chave
                      ? 'A chave pública já está no aplicativo, mas ainda não houve envio. Confira se a função de envio está publicada e agendada.'
                      : 'Ainda não ligado: os avisos aparecem no sino de cada pessoa, mas não chegam ao celular.'}
                    {s.esperando_envio > 0 ? ` ${s.esperando_envio} avisos estão esperando o envio.` : ''}
                  </p>
                  <p className="detalhe">
                    Para ligar, a equipe técnica segue o roteiro em docs/avisos-no-celular.md (as chaves do envio, a função e o
                    agendamento).
                  </p>
                </>
              )}
            </section>

            <section className="bloco" aria-labelledby="titulo-o-que-avisa">
              <h2 id="titulo-o-que-avisa">O que o sistema avisa sozinho</h2>
              <ul className="lista-linhas" aria-label="O que o sistema avisa">
                {O_QUE_AVISA.map(([o, quando]) => (
                  <li key={o} className="linha-aparelho">
                    <span className="linha-corpo">
                      <strong>{o}</strong>
                      <span>{quando}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="detalhe">Cada pessoa escolhe o que chega no celular em Meu perfil › Avisos. No sino, aparece tudo.</p>
            </section>
          </>
        )}
      </MostrarCarga>
    </div>
  )
}
