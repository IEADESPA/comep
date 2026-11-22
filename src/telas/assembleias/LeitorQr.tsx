// O leitor de QR Code com a câmera, quando o navegador tem o leitor embutido (Chrome e Edge no Android e no
// computador). A secretaria lê a credencial do ministro; o ministro lê o QR da portaria (parte 14).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Mensagem } from '../../componentes/Basicos'
import { Icone } from '../../componentes/Icone'

type Detector = { detect: (fonte: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
type ConstrutorDetector = new (opcoes: { formats: string[] }) => Detector

function construtorDetector(): ConstrutorDetector | null {
  return (window as unknown as { BarcodeDetector?: ConstrutorDetector }).BarcodeDetector ?? null
}

function temLeitorDeQr(): boolean {
  return construtorDetector() !== null
}

export function LeitorQr({
  aoLer,
  interpretar,
  textoDoBotao,
  rotuloDaCamera,
  semLeitor,
  ligadoDeInicio = false,
}: {
  aoLer: (codigo: string) => void
  /** tira do texto lido o que interessa (null: não é o QR esperado) */
  interpretar: (texto: string) => string | null
  textoDoBotao: string
  rotuloDaCamera: string
  /** o que dizer quando o navegador não lê QR Code aqui dentro */
  semLeitor: ReactNode
  ligadoDeInicio?: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [ligado, setLigado] = useState(ligadoDeInicio)
  const [erro, setErro] = useState<string | null>(null)
  const ultimo = useRef<{ codigo: string; quando: number } | null>(null)
  // a função de ler muda a cada tela desenhada: a câmera usa sempre a mais nova, sem religar
  const lerAgora = useRef({ aoLer, interpretar })
  useEffect(() => {
    lerAgora.current = { aoLer, interpretar }
  })
  const temLeitor = temLeitorDeQr()

  useEffect(() => {
    if (!ligado) return
    const Construtor = construtorDetector()
    if (!Construtor) return
    let fluxo: MediaStream | null = null
    let ativo = true
    let tempo = 0
    const detector = new Construtor({ formats: ['qr_code'] })
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((f) => {
        fluxo = f
        // a câmera foi desligada (ou a tela fechada) antes de o navegador liberar: solta a câmera
        if (!ativo) {
          f.getTracks().forEach((t) => t.stop())
          return
        }
        if (!video.current) return
        video.current.srcObject = f
        void video.current.play()
        const ler = async () => {
          if (!ativo || !video.current) return
          try {
            for (const achado of await detector.detect(video.current)) {
              const codigo = lerAgora.current.interpretar(achado.rawValue)
              const agora = Date.now()
              // o mesmo QR na frente da câmera não conta de novo por 3 segundos
              if (codigo && !(ultimo.current?.codigo === codigo && agora - ultimo.current.quando < 3000)) {
                ultimo.current = { codigo, quando: agora }
                lerAgora.current.aoLer(codigo)
              }
            }
          } catch {
            // quadro sem imagem ainda: tenta no próximo
          }
          tempo = window.setTimeout(() => void ler(), 350)
        }
        void ler()
      })
      .catch(() => setErro('Não foi possível usar a câmera. Confira a permissão do navegador.'))
    return () => {
      ativo = false
      window.clearTimeout(tempo)
      fluxo?.getTracks().forEach((t) => t.stop())
    }
  }, [ligado])

  if (!temLeitor) return <p className="detalhe">{semLeitor}</p>
  return (
    <div className="leitor-qr">
      <button type="button" className="botao" onClick={() => setLigado((v) => !v)}>
        <Icone nome={ligado ? 'x' : 'qr'} tamanho={18} />
        {ligado ? 'Desligar a câmera' : textoDoBotao}
      </button>
      {ligado && <video ref={video} className="leitor-video" muted playsInline aria-label={rotuloDaCamera} />}
      <Mensagem erro={erro} />
    </div>
  )
}
