import { encode } from 'uqr'

/** QR Code desenhado no próprio navegador (nada sai para serviço de fora). Escuro no branco, para ler bem impresso. */
export function QrCode({ texto, rotulo, className, cor = '#000000' }: { texto: string; rotulo: string; className?: string; cor?: string }) {
  const { data, size } = encode(texto, { ecc: 'M', border: 2 })
  let caminho = ''
  data.forEach((linha, y) =>
    linha.forEach((escuro, x) => {
      if (escuro) caminho += `M${x} ${y}h1v1h-1z`
    }),
  )
  return (
    <svg
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={rotulo}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={caminho} fill={cor} />
    </svg>
  )
}
