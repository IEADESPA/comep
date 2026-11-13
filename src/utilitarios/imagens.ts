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

/**
 * Imagem do modelo da credencial (ex.: logo oficial): reduzida para 1600 px.
 * PNG e WebP continuam PNG (mantém o fundo transparente); JPEG continua JPEG.
 */
export async function prepararImagemModelo(arquivo: File): Promise<{ blob: Blob; extensao: 'png' | 'jpg' } | { erro: string }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) {
    return { erro: 'Envie uma imagem PNG, JPG ou WebP.' }
  }
  try {
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const tela = document.createElement('canvas')
    tela.width = Math.max(1, Math.round(bitmap.width * escala))
    tela.height = Math.max(1, Math.round(bitmap.height * escala))
    const contexto = tela.getContext('2d')
    if (!contexto) throw new Error('sem canvas')
    const jpeg = arquivo.type === 'image/jpeg'
    if (jpeg) {
      contexto.fillStyle = '#ffffff'
      contexto.fillRect(0, 0, tela.width, tela.height)
    }
    contexto.drawImage(bitmap, 0, 0, tela.width, tela.height)
    bitmap.close()
    const blob = await new Promise<Blob>((resolve, reject) =>
      tela.toBlob((b) => (b ? resolve(b) : reject(new Error('falha'))), jpeg ? 'image/jpeg' : 'image/png', 0.9),
    )
    if (blob.size > 1024 * 1024) return { erro: 'A imagem ficou maior que 1 MB. Use uma imagem menor.' }
    return { blob, extensao: jpeg ? 'jpg' : 'png' }
  } catch {
    return { erro: 'Não foi possível ler esta imagem. Tente outra.' }
  }
}
