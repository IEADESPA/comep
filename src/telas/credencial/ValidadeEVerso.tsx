// Credenciais › Validade e verso (rodada 7, aprovada como está). Saiu de Configurações › Credencial (Fase 5.5, parte 7).
// À esquerda, a validade: todas valem até o fim do mandato da diretoria; corrigir a data e, à parte, registrar a posse
// da nova diretoria (com confirmação). À direita, o texto do verso, com a prévia do verso.
import { useMemo, useState } from 'react'
import { Mensagem, MostrarCarga } from '../../componentes/Basicos'
import { FaceCredencial } from '../../componentes/CartaoCredencial'
import { CabecalhoFuncao } from '../../componentes/MenuDoModulo'
import {
  buscarConfigCredencial,
  corrigirFimMandato,
  registrarNovoMandato,
  salvarTextoVerso,
  urlValidacao,
  type ConfigCredencial,
} from '../../dados/credencial'
import { useCarregar } from '../../estado/useCarregar'
import { useUmaVez } from '../../estado/useUmaVez'
import { formatarData, hojeIso } from '../../utilitarios/formatos'
import { DADOS_EXEMPLO, MODELO_PADRAO, valoresDaCredencial } from '../../utilitarios/modeloCredencial'

type Retorno = { sucesso?: string; erro?: string }

export function ValidadeEVerso() {
  const [carga, recarregar] = useCarregar(buscarConfigCredencial)
  const [retorno, setRetorno] = useState<Retorno>({})
  return (
    <div className="tela-nova">
      <CabecalhoFuncao
        modulo="Credenciais"
        titulo="Validade e verso"
        sub="A validade de todas as credenciais (o fim do mandato da diretoria) e o texto que vai no verso"
      />
      <Mensagem sucesso={retorno.sucesso} erro={retorno.erro} />
      <MostrarCarga carga={carga} recarregar={recarregar}>
        {(config) => (
          <div className="validade-verso">
            <Validade config={config} aoMudar={(r) => {
              setRetorno(r)
              if (r.sucesso) recarregar()
            }} />
            <TextoDoVerso key={config.texto_verso} config={config} aoMudar={(r) => {
              setRetorno(r)
              if (r.sucesso) recarregar()
            }} />
          </div>
        )}
      </MostrarCarga>
    </div>
  )
}

function Validade({ config, aoMudar }: { config: ConfigCredencial; aoMudar: (r: Retorno) => void }) {
  const [enviando, umaVez] = useUmaVez()
  return (
    <section className="painel" id="credencial" aria-labelledby="titulo-validade-credenciais">
      <h2 id="titulo-validade-credenciais">Validade das credenciais</h2>
      <p>
        Todas valem até o <strong>fim do mandato da diretoria</strong>.
      </p>
      <dl className="dados-curtos">
        <dt>Válidas até</dt>
        <dd>{config.fim_mandato ? formatarData(config.fim_mandato) : 'enquanto o associado estiver ativo'}</dd>
      </dl>
      <form
        key={`fim-${config.fim_mandato ?? ''}`}
        aria-label="Fim do mandato"
        className="form-linha"
        onSubmit={(e) => {
          e.preventDefault()
          const fim = String(new FormData(e.currentTarget).get('fim_mandato') ?? '')
          void umaVez(async () => {
            const r = await corrigirFimMandato(fim, config.fim_mandato)
            aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: 'Fim do mandato corrigido.' })
          })
        }}
      >
        <label>
          Fim do mandato da diretoria em curso
          <input name="fim_mandato" type="date" defaultValue={config.fim_mandato ?? ''} />
        </label>
        <button type="submit" className="botao botao-secundario" disabled={enviando}>
          Corrigir a data
        </button>
      </form>
      <p className="detalhe">
        Mudar a data aqui só <strong>corrige</strong> o mandato em curso: todas as credenciais dele acompanham (a digital e o
        QR Code). As já impressas continuam com a data antiga no papel: se a data mudou, imprima de novo. Em branco, a
        credencial vale enquanto o associado estiver ativo.
      </p>
      {config.fim_mandato && (
        <NovoMandato
          fimAtual={config.fim_mandato}
          aoRegistrar={(quantas) =>
            aoMudar({
              sucesso: `Novo mandato registrado. ${quantas} credencia${quantas === 1 ? 'l renovada' : 'is renovadas'}: as impressas antigas valem até ${formatarData(config.fim_mandato ?? '')}.`,
            })
          }
          aoFalhar={(erro) => aoMudar({ erro })}
        />
      )}
      <p className="detalhe">A posse muda a validade de todas as credenciais.</p>
    </section>
  )
}

/** O dia seguinte (aaaa-mm-dd), para o menor fim de mandato aceito. */
function diaSeguinte(dia: string): string {
  const d = new Date(`${dia}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Posse da nova diretoria: as credenciais passam para o novo mandato (as impressas antigas valem até o fim do atual). */
function NovoMandato({
  fimAtual,
  aoRegistrar,
  aoFalhar,
}: {
  fimAtual: string
  aoRegistrar: (quantas: number) => void
  aoFalhar: (erro: string) => void
}) {
  const [fim, setFim] = useState('')
  const [perguntando, setPerguntando] = useState(false)
  const [enviando, umaVez] = useUmaVez()
  return (
    <details className="acao-recolhida">
      <summary>Registrar a posse da nova diretoria</summary>
      <p className="detalhe">
        Cada associado recebe a credencial do novo mandato (novo QR Code); a digital muda sozinha. As impressas antigas
        continuam valendo até <strong>{formatarData(fimAtual)}</strong> (o fim do mandato atual) e, depois disso, o QR Code
        delas mostra "vencida": é preciso imprimir de novo. Para só corrigir a data, use o campo acima.
      </p>
      <form
        className="form-linha"
        aria-label="Novo mandato"
        onSubmit={(e) => {
          e.preventDefault()
          if (!perguntando) {
            setPerguntando(true)
            return
          }
          setPerguntando(false)
          void umaVez(async () => {
            const r = await registrarNovoMandato(fim)
            if (r.erro !== null) aoFalhar(r.erro)
            else {
              setFim('')
              aoRegistrar(r.dados)
            }
          })
        }}
      >
        <label className="campo-curto">
          Fim do novo mandato *
          <input
            type="date"
            required
            min={diaSeguinte(fimAtual > hojeIso() ? fimAtual : hojeIso())}
            value={fim}
            onChange={(e) => {
              setFim(e.target.value)
              setPerguntando(false)
            }}
          />
        </label>
        {perguntando ? (
          <span className="confirmar-linha">
            <button type="submit" className="botao botao-perigo-cheio" disabled={enviando}>
              Confirmar — renovar todas as credenciais
            </button>
            <button type="button" className="botao-texto" onClick={() => setPerguntando(false)}>
              Não
            </button>
          </span>
        ) : (
          <button type="submit" className="botao" disabled={enviando}>
            Registrar o novo mandato
          </button>
        )}
      </form>
    </details>
  )
}

function TextoDoVerso({ config, aoMudar }: { config: ConfigCredencial; aoMudar: (r: Retorno) => void }) {
  const [texto, setTexto] = useState(config.texto_verso)
  const [enviando, umaVez] = useUmaVez()
  // a prévia: o verso do modelo padrão, com dados de exemplo e o texto que está sendo escrito
  const valores = useMemo(() => valoresDaCredencial(DADOS_EXEMPLO, texto), [texto])
  return (
    <section className="painel" aria-labelledby="titulo-texto-verso">
      <h2 id="titulo-texto-verso">Texto do verso</h2>
      <form
        aria-label="Texto do verso"
        onSubmit={(e) => {
          e.preventDefault()
          void umaVez(async () => {
            const r = await salvarTextoVerso(texto)
            aoMudar(r.erro !== null ? { erro: r.erro } : { sucesso: 'Texto do verso salvo.' })
          })
        }}
      >
        <label className="largura-total">
          O que vai no verso
          <textarea name="texto_verso" rows={4} maxLength={600} required value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <div className="previa-verso">
          <FaceCredencial lado="verso" modelo={MODELO_PADRAO} valores={valores} nome={DADOS_EXEMPLO.nome} foto={null} urlQr={urlValidacao(DADOS_EXEMPLO.codigo)} />
        </div>
        <p className="detalhe">O texto vai no lugar de {'{texto_verso}'} em todos os modelos que usam o texto do verso.</p>
        <div className="acoes">
          <button type="submit" className="botao" disabled={enviando}>
            Salvar o texto
          </button>
        </div>
      </form>
    </section>
  )
}
