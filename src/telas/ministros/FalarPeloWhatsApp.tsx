import { useState } from 'react'
import { Mensagem } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'
import { FotoOuIniciais } from '../../componentes/Telas'
import type { FichaAssociado } from '../../dados/associados'
import { listarEncontros, NOME_DO_TIPO } from '../../dados/encontros'
import type { SituacaoContribuicao } from '../../dados/financeiro'
import { mandarRecado, type AssuntoRecado } from '../../dados/notificacoes'
import { useCarregar } from '../../estado/useCarregar'
import { diaMes, horaCurta } from '../../utilitarios/formatos'
import { linkDoWhatsApp, numeroDoWhatsApp, telefoneFormatado, tratamento } from '../../utilitarios/whatsapp'

// Falar pelo WhatsApp (rodada 15, a proposta "notificacoes", tela "WhatsApp da secretaria"; parte 11):
// na ficha do ministro, a secretaria escolhe a mensagem pronta, ajusta se quiser e abre o WhatsApp DELA com o texto.
// Não tem custo e não é envio automático: quem manda é a secretaria. Ao lado, "Mandar pelo aplicativo" põe a mesma
// mensagem no sino da pessoa (e no celular, se ela ativou os avisos).

type Pronta = 'mensalidade' | 'assembleia' | 'credencial' | 'livre'

const NOME_DA_PRONTA: Record<Pronta, string> = {
  mensalidade: 'Lembrete da contribuição',
  assembleia: 'A próxima assembleia ou reunião',
  credencial: 'O que falta na credencial',
  livre: 'Mensagem livre',
}

const ASSUNTO: Record<Pronta, AssuntoRecado> = {
  mensalidade: 'mensalidade',
  assembleia: 'assembleias',
  credencial: 'recado',
  livre: 'recado',
}
const TITULO: Record<Pronta, string> = {
  mensalidade: 'Lembrete da contribuição',
  assembleia: 'A próxima assembleia',
  credencial: 'A sua credencial',
  livre: 'Recado da secretaria',
}

export function FalarPeloWhatsApp({ ficha, situacao }: { ficha: FichaAssociado; situacao: SituacaoContribuicao | null }) {
  const { associado } = ficha
  const [encontros] = useCarregar(listarEncontros)
  const [agora] = useState(() => new Date().toISOString())
  const proxima =
    encontros.situacao === 'ok'
      ? encontros.dados.filter((e) => e.situacao === 'convocado' && e.inicio >= agora).sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
      : undefined
  const emAtraso = situacao !== null && !situacao.em_dia
  const [pronta, setPronta] = useState<Pronta>(emAtraso ? 'mensalidade' : ficha.pendencias.length > 0 ? 'credencial' : 'livre')
  const [editado, setEditado] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [retorno, setRetorno] = useState<{ sucesso?: string; erro?: string }>({})

  const ola = `Olá, ${tratamento(associado.nome, associado.titulo)}! Aqui é a secretaria do COMEP.`
  const textos: Record<Pronta, string> = {
    mensalidade: `${ola} A sua contribuição está em aberto${situacao && situacao.cobrancas_vencidas > 0 ? ` (${situacao.cobrancas_vencidas === 1 ? '1 cobrança vencida' : `${situacao.cobrancas_vencidas} cobranças vencidas`})` : ''}. Pelo aplicativo você vê os valores e envia o comprovante. Deus abençoe!`,
    assembleia: proxima
      ? `${ola} A ${NOME_DO_TIPO[proxima.tipo]} será em ${diaMes(proxima.inicio)}, às ${horaCurta(proxima.inicio)}, ${proxima.local}. Confirme a presença pelo aplicativo. Deus abençoe!`
      : `${ola} Fique atento à próxima assembleia: a data e o local aparecem no aplicativo, em Assembleias. Deus abençoe!`,
    credencial: `${ola} Para a sua credencial ficar completa, falta: ${ficha.pendencias.join(', ').toLowerCase() || 'nada'}. Você resolve pelo aplicativo, em Meu perfil. Deus abençoe!`,
    livre: `${ola} `,
  }
  const texto = editado ?? textos[pronta]
  const temNumero = numeroDoWhatsApp(associado.telefone) !== ''

  async function mandarPeloAplicativo() {
    setEnviando(true)
    const r = await mandarRecado(associado.pessoa_id, ASSUNTO[pronta], TITULO[pronta], texto)
    setEnviando(false)
    setRetorno(
      r.erro !== null
        ? { erro: r.erro }
        : {
            sucesso: associado.tem_login
              ? 'Mandado: a mensagem chegou no sino dele (e no celular, se ele ativou os avisos).'
              : 'Mandado: ele vê a mensagem no sino quando entrar no aplicativo.',
          },
    )
  }

  return (
    <section className="bloco falar-whatsapp" aria-labelledby="titulo-falar-whatsapp">
      <h2 id="titulo-falar-whatsapp">Falar com o ministro</h2>
      <div className="falar-whatsapp-pessoa">
        <FotoOuIniciais foto={null} nome={associado.nome} largura={44} />
        <span>
          <strong>{associado.nome}</strong>
          <span className="detalhe">
            {[
              emAtraso ? 'em atraso' : situacao?.em_dia ? 'em dia' : null,
              associado.telefone ? telefoneFormatado(associado.telefone) : 'sem telefone no cadastro',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </div>
      <div className="grade-form">
        <label className="largura-total">
          Mensagem pronta
          <select
            value={pronta}
            onChange={(e) => {
              setPronta(e.target.value as Pronta)
              setEditado(null)
              setRetorno({})
            }}
          >
            {(Object.keys(NOME_DA_PRONTA) as Pronta[]).map((p) => (
              <option key={p} value={p}>
                {NOME_DA_PRONTA[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="largura-total">
          A mensagem (pode mudar antes de mandar)
          <textarea value={texto} maxLength={1000} onChange={(e) => setEditado(e.target.value)} />
        </label>
      </div>
      <div className="falar-whatsapp-acoes">
        <a className="botao" href={linkDoWhatsApp(associado.telefone, texto)} target="_blank" rel="noreferrer">
          <Icone nome="conversa" tamanho={18} />
          Abrir no WhatsApp
        </a>
        <button
          type="button"
          className="botao botao-secundario"
          disabled={enviando || texto.trim().length < 5}
          onClick={() => void mandarPeloAplicativo()}
        >
          Mandar pelo aplicativo
        </button>
      </div>
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <span className="detalhe">
        {temNumero
          ? 'O botão abre o WhatsApp de quem está usando, com a mensagem escrita. Não tem custo: é a secretaria quem envia.'
          : 'Sem o telefone no cadastro, o WhatsApp abre para você escolher o contato.'}
      </span>
    </section>
  )
}
