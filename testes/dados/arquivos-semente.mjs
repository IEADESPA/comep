// Envia fotos e comprovantes FICTÍCIOS para os caminhos registrados pela semente (testes/dados/semente-teste.sql).
// Só para o banco de TESTE. Foto: silhueta colorida gerada aqui; comprovante: PDF "credencial fictícia".
// Uso: SUPABASE_URL=https://<ref-do-teste>.supabase.co SUPABASE_CHAVE_SECRETA=sb_secret_... node testes/dados/arquivos-semente.mjs
// A chave secreta nunca vai para o repositório nem é impressa.
import { deflateSync } from 'node:zlib'

const url = process.env.SUPABASE_URL
const chave = process.env.SUPABASE_CHAVE_SECRETA
if (!url || !chave) {
  console.error('Faltam SUPABASE_URL e SUPABASE_CHAVE_SECRETA.')
  process.exit(1)
}
const cabecalhos = { apikey: chave, Authorization: `Bearer ${chave}` }

// ---------- PNG simples (sem bibliotecas) ----------
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pedaco(tipo, dados) {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, crc])
}
const CORES = [
  [185, 28, 28], [30, 64, 175], [21, 128, 61], [180, 83, 9], [109, 40, 217], [15, 118, 110], [190, 24, 93], [71, 85, 105],
]
/** Silhueta (cabeça e ombros) sobre fundo colorido, 160×200. */
function fotoFicticia(indice) {
  const largura = 160
  const altura = 200
  const fundo = CORES[indice % CORES.length]
  const figura = fundo.map((c) => Math.round(c + (255 - c) * 0.55))
  const linha = largura * 3 + 1
  const bruto = Buffer.alloc(linha * altura)
  for (let y = 0; y < altura; y++) {
    bruto[y * linha] = 0
    for (let x = 0; x < largura; x++) {
      const cabeca = (x - 80) ** 2 + (y - 78) ** 2 <= 34 ** 2
      const ombros = (x - 80) ** 2 / 64 ** 2 + (y - 205) ** 2 / 78 ** 2 <= 1
      const [r, g, b] = cabeca || ombros ? figura : fundo
      const i = y * linha + 1 + x * 3
      bruto[i] = r
      bruto[i + 1] = g
      bruto[i + 2] = b
    }
  }
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(largura, 0)
  cabecalho.writeUInt32BE(altura, 4)
  cabecalho[8] = 8 // bits por canal
  cabecalho[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', cabecalho),
    pedaco('IDAT', deflateSync(bruto)),
    pedaco('IEND', Buffer.alloc(0)),
  ])
}

// ---------- PDF simples ----------
function pdfFicticio() {
  const texto = 'BT /F1 20 Tf 72 760 Td (Credencial ministerial - DOCUMENTO FICTICIO) Tj ET\n' +
    'BT /F1 12 Tf 72 730 Td (Gerado para o ambiente de teste do sistema do COMEP.) Tj ET\n'
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(texto)} >>\nstream\n${texto}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let corpo = '%PDF-1.4\n'
  const posicoes = []
  objetos.forEach((objeto, i) => {
    posicoes.push(Buffer.byteLength(corpo))
    corpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`
  })
  const inicioXref = Buffer.byteLength(corpo)
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  corpo += posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`
  return Buffer.from(corpo)
}

// ---------- Envio ----------
async function caminhos(tabela, coluna) {
  const r = await fetch(`${url}/rest/v1/${tabela}?select=${coluna}&${coluna}=like.*semente*`, { headers: cabecalhos })
  if (!r.ok) throw new Error(`Falha ao listar ${tabela}: HTTP ${r.status}`)
  return (await r.json()).map((linha) => linha[coluna])
}

const fotos = [...new Set([...(await caminhos('pessoas', 'foto_caminho')), ...(await caminhos('pedidos_associacao', 'foto_caminho'))])]
const comprovantes = [...new Set(await caminhos('pedidos_associacao', 'comprovante_caminho'))]
const pdf = pdfFicticio()

let enviados = 0
let jaExistiam = 0
for (const [i, caminho] of [...fotos.map((c, i) => [i, c, 'foto']), ...comprovantes.map((c, i) => [i, c, 'pdf'])].map(
  ([i, c, tipo]) => [i, { caminho: c, tipo }],
)) {
  const conteudo = caminho.tipo === 'foto' ? fotoFicticia(i) : pdf
  const r = await fetch(`${url}/storage/v1/object/documentos/${caminho.caminho}`, {
    method: 'POST',
    headers: { ...cabecalhos, 'Content-Type': caminho.tipo === 'foto' ? 'image/png' : 'application/pdf', 'x-upsert': 'false' },
    body: conteudo,
  })
  if (r.ok) enviados++
  else if (r.status === 400 || r.status === 409) jaExistiam++
  else throw new Error(`Falha ao enviar ${caminho.caminho}: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`)
}
console.log(`Fotos: ${fotos.length}; comprovantes: ${comprovantes.length}; enviados agora: ${enviados}; já existiam: ${jaExistiam}.`)
