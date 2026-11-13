import { CamposIdentidade } from '../../componentes/CamposIdentidade'
import { erroDaIdentidade, identidadeInicial, identidadeParaGravar } from '../../utilitarios/identidade'
import { useState } from 'react'
import { Mensagem } from '../../componentes/Basicos'
import type { Igreja, Titulo } from '../../dados/cadastros'
import {
  atualizarMeusDados,
  type MeusDadosBasicos,
  enviarArquivo,
  enviarPedido,
  reenviarPedido,
  type DadosPedido,
  type Pedido,
} from '../../dados/pedidos'
import { SUGESTOES_FUNCAO } from '../../dados/associados'
import { prepararComprovante, prepararFoto, type ArquivoPronto } from '../../utilitarios/imagens'
import { hojeIso } from '../../utilitarios/formatos'

const OUTRA_IGREJA = '__outra__'

type Props = {
  pessoaId: string
  titulos: Titulo[]
  igrejas: Igreja[]
  dadosPessoa: MeusDadosBasicos
  /** Na correção de uma pendência: o pedido atual (os arquivos já enviados continuam valendo) */
  pedido?: Pedido
  aoConcluir: (mensagem: string) => void
}

export function FormularioPedido({ pessoaId, titulos, igrejas, dadosPessoa, pedido, aoConcluir }: Props) {
  const correcao = Boolean(pedido)
  const [nome, setNome] = useState(dadosPessoa.nome)
  const [telefone, setTelefone] = useState(dadosPessoa.telefone ?? '')
  const [identidade, setIdentidade] = useState(identidadeInicial(dadosPessoa))
  const [dados, setDados] = useState<DadosPedido>({
    titulo_id: pedido?.titulo_id ?? '',
    titulo_desde: pedido?.titulo_desde ?? '',
    igreja_id: pedido?.igreja_id ?? '',
    igreja_informada: pedido?.igreja_informada ?? '',
    denominacao_informada: pedido?.denominacao_informada ?? '',
    funcao: pedido?.funcao ?? '',
    pastor_presidente: pedido?.pastor_presidente ?? false,
    foto_caminho: pedido?.foto_caminho ?? null,
    comprovante_caminho: pedido?.comprovante_caminho ?? null,
    observacoes: pedido?.observacoes ?? '',
    // As declarações são renovadas a cada envio
    declara_principios_fe: false,
    declara_estatuto: false,
    consente_lgpd: false,
  })
  const [escolhaIgreja, setEscolhaIgreja] = useState(
    pedido ? (pedido.igreja_id ?? (pedido.igreja_informada ? OUTRA_IGREJA : '')) : '',
  )
  const [foto, setFoto] = useState<ArquivoPronto | null>(null)
  const [previaFoto, setPreviaFoto] = useState<string | null>(null)
  const [comprovante, setComprovante] = useState<ArquivoPronto | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const campo = (nome: 'titulo_id' | 'titulo_desde' | 'igreja_informada' | 'denominacao_informada' | 'funcao' | 'observacoes') => ({
    value: dados[nome],
    onChange: (e: { target: { value: string } }) => setDados((d) => ({ ...d, [nome]: e.target.value })),
  })
  const marcar = (nome: 'pastor_presidente' | 'declara_principios_fe' | 'declara_estatuto' | 'consente_lgpd') => ({
    checked: dados[nome],
    onChange: (e: { target: { checked: boolean } }) => setDados((d) => ({ ...d, [nome]: e.target.checked })),
  })

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    const pronto = await prepararFoto(arquivo)
    setFoto(pronto)
    if (previaFoto) URL.revokeObjectURL(previaFoto)
    setPreviaFoto('blob' in pronto ? URL.createObjectURL(pronto.blob) : null)
  }

  async function enviar() {
    setErro(null)
    if (foto && 'erro' in foto) return setErro(foto.erro)
    if (comprovante && 'erro' in comprovante) return setErro(comprovante.erro)
    if (!foto && !dados.foto_caminho) return setErro('Escolha uma foto sua.')
    if (!comprovante && !dados.comprovante_caminho) return setErro('Escolha o comprovante do seu título.')
    const erroIdentidade = erroDaIdentidade(identidade, true)
    if (erroIdentidade) return setErro(erroIdentidade)

    setEnviando('Salvando seus dados…')
    const pessoa = await atualizarMeusDados(pessoaId, nome, telefone, identidadeParaGravar(identidade, dadosPessoa, false))
    if (pessoa.erro !== null) return falhou(pessoa.erro)

    let fotoCaminho = dados.foto_caminho
    if (foto && 'blob' in foto) {
      setEnviando('Enviando a foto…')
      const r = await enviarArquivo(pessoaId, 'foto', foto.blob, foto.extensao)
      if (r.erro !== null) return falhou(r.erro)
      fotoCaminho = r.dados
    }
    let comprovanteCaminho = dados.comprovante_caminho
    if (comprovante && 'blob' in comprovante) {
      setEnviando('Enviando o comprovante…')
      const r = await enviarArquivo(pessoaId, 'comprovante', comprovante.blob, comprovante.extensao)
      if (r.erro !== null) return falhou(r.erro)
      comprovanteCaminho = r.dados
    }

    setEnviando('Enviando o pedido…')
    const completo: DadosPedido = {
      ...dados,
      igreja_id: escolhaIgreja === OUTRA_IGREJA ? '' : escolhaIgreja,
      foto_caminho: fotoCaminho,
      comprovante_caminho: comprovanteCaminho,
    }
    const r = pedido ? await reenviarPedido(pedido.id, completo) : await enviarPedido(pessoaId, completo)
    if (r.erro !== null) return falhou(r.erro)
    setEnviando(null)
    aoConcluir(pedido ? 'Correção enviada. A diretoria vai analisar de novo.' : 'Pedido enviado! A diretoria vai analisar.')
  }

  function falhou(mensagem: string) {
    setEnviando(null)
    setErro(mensagem)
  }

  return (
    <form
      className="painel"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      <fieldset>
        <legend>Seus dados</legend>
        <div className="grade-form">
          <label className="largura-total">
            Nome completo *
            <input required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            Telefone (WhatsApp) *
            <input required type="tel" autoComplete="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
          <CamposIdentidade valor={identidade} gravada={dadosPessoa} aoMudar={setIdentidade} obrigatorio />
        </div>
      </fieldset>

      <fieldset>
        <legend>Ministério</legend>
        <div className="grade-form">
          <label>
            Título ministerial *
            <select required {...campo('titulo_id')}>
              <option value="">— Escolha —</option>
              {titulos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data de consagração
            <input type="date" max={hojeIso()} {...campo('titulo_desde')} />
          </label>
          <label className="largura-total">
            Sua igreja *
            <select required value={escolhaIgreja} onChange={(e) => setEscolhaIgreja(e.target.value)}>
              <option value="">— Escolha —</option>
              {igrejas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
              <option value={OUTRA_IGREJA}>Minha igreja não está na lista</option>
            </select>
          </label>
          {escolhaIgreja === OUTRA_IGREJA && (
            <>
              <label>
                Nome da sua igreja *
                <input required {...campo('igreja_informada')} />
              </label>
              <label>
                Denominação
                <input {...campo('denominacao_informada')} />
              </label>
            </>
          )}
          <label>
            Função na igreja
            <input list="sugestoes-funcao-pedido" {...campo('funcao')} />
            <datalist id="sugestoes-funcao-pedido">
              {SUGESTOES_FUNCAO.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="caixa-marcar largura-total">
            <input type="checkbox" {...marcar('pastor_presidente')} />
            Sou o pastor presidente desta igreja
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Documentos</legend>
        <div className="grade-form">
          <label>
            Sua foto *
            <input type="file" accept="image/*" onChange={(e) => void escolherFoto(e.target.files?.[0])} />
            <span className="detalhe">
              {dados.foto_caminho && !foto ? 'Foto já enviada. Escolha outra só se quiser trocar.' : 'Foto de rosto, de frente.'}
            </span>
          </label>
          {previaFoto && <img className="previa-foto" src={previaFoto} alt="Prévia da sua foto" />}
          <label>
            Comprovante do título *
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={async (e) => {
                const arquivo = e.target.files?.[0]
                setComprovante(arquivo ? await prepararComprovante(arquivo) : null)
              }}
            />
            <span className="detalhe">
              {dados.comprovante_caminho && !comprovante
                ? 'Comprovante já enviado. Escolha outro só se quiser trocar.'
                : 'Credencial ou certificado reconhecido pela sua denominação (foto ou PDF).'}
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Declarações</legend>
        <label className="caixa-marcar">
          <input type="checkbox" required {...marcar('declara_principios_fe')} />
          <span>
            Declaro que a minha igreja é reconhecidamente evangélica e professa os princípios do Art. 7º, §1º do
            estatuto: Deus subsiste em três pessoas (Pai, Filho e Espírito Santo); o único meio de salvação é o Senhor
            Jesus Cristo; a Bíblia Sagrada é a revelação infalível de Deus; a santa Igreja universal é a comunidade dos
            santos.
          </span>
        </label>
        <label className="caixa-marcar">
          <input type="checkbox" required {...marcar('declara_estatuto')} />
          <span>
            Concordo com o estatuto e o regimento interno do COMEP e com os compromissos de associado: participar das
            reuniões mensais e das assembleias e contribuir com a taxa de inscrição e a contribuição definidas em
            assembleia.
          </span>
        </label>
        <label className="caixa-marcar">
          <input type="checkbox" required {...marcar('consente_lgpd')} />
          <span>
            Autorizo o COMEP a guardar e usar meus dados, minha foto e o comprovante somente para a minha associação e a
            vida do Conselho (cadastro, credencial, assembleias e contribuições), sem repassar a terceiros. Posso ver e
            corrigir meus dados no Portal do membro. O pedido fica guardado como registro do Conselho, mesmo se for
            recusado (LGPD).
          </span>
        </label>
        <p className="detalhe">
          Ao enviar, você assina eletronicamente a ficha de associação. Um diretor assina em seguida, ao encaminhar o
          pedido à Assembleia Ordinária (Art. 7º).
        </p>
      </fieldset>

      <label>
        Observações (opcional)
        <textarea rows={2} {...campo('observacoes')} />
      </label>

      <Mensagem erro={erro} />
      <div className="acoes">
        <button type="submit" className="botao" disabled={enviando !== null}>
          {enviando ?? (correcao ? 'Corrigir e reenviar' : 'Enviar pedido')}
        </button>
      </div>
    </form>
  )
}
