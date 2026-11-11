// Prepara fotos e comprovantes no próprio aparelho antes de enviar (economiza internet e espaço do plano gratuito).

export type ArquivoPronto = { blob: Blob; extensao: string } | { erro: string }

const LIMITE_PDF = 4 * 1024 * 1024 // 4 MB (o bucket aceita até 5 MB)

/** Reduz a imagem para no máximo `ladoMaximo` px e grava em JPEG. */
async function comprimirImagem(arquivo: File, ladoMaximo: number, qualidade: number): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height))
  const largura = Math.max(1, Math.round(bitmap.width * escala))
  const altura = Math.max(1, Math.round(bitmap.height * escala))
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  const contexto = tela.getContext('2d')
  if (!contexto) throw new Error('Sem suporte a imagens neste navegador.')
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, largura, altura)
  contexto.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()
  return new Promise((resolve, reject) =>
    tela.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao preparar a imagem.'))), 'image/jpeg', qualidade),
  )
}

/** Foto: só imagem, reduzida para 800 px (~100 KB). */
export async function prepararFoto(arquivo: File): Promise<ArquivoPronto> {
  if (!arquivo.type.startsWith('image/')) return { erro: 'A foto precisa ser uma imagem (JPG ou PNG).' }
  try {
    return { blob: await comprimirImagem(arquivo, 800, 0.82), extensao: 'jpg' }
  } catch {
    return { erro: 'Não foi possível ler esta imagem. Tente outra foto.' }
  }
}

/** Comprovante: imagem (reduzida para 1600 px, para continuar legível) ou PDF de até 4 MB. */
export async function prepararComprovante(arquivo: File): Promise<ArquivoPronto> {
  if (arquivo.type === 'application/pdf') {
    if (arquivo.size > LIMITE_PDF) return { erro: 'O PDF passa de 4 MB. Envie uma foto do documento ou um PDF menor.' }
    return { blob: arquivo, extensao: 'pdf' }
  }
  if (!arquivo.type.startsWith('image/')) return { erro: 'O comprovante precisa ser uma imagem ou um PDF.' }
  try {
    return { blob: await comprimirImagem(arquivo, 1600, 0.85), extensao: 'jpg' }
  } catch {
    return { erro: 'Não foi possível ler esta imagem. Tente outra foto do documento.' }
  }
}
