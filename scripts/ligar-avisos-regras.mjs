// As regras do scripts/ligar-avisos.mjs, separadas para o teste (testes/unidade/ligarAvisos.test.ts).
// Aqui não se grava nada nem se chama o Supabase.
import { generateKeyPairSync, randomBytes } from 'node:crypto'

/** O projeto da produção (o mesmo do docs/lancamento.md): os avisos de lá só se ligam no lançamento. */
export const REF_PRODUCAO = 'xwdnhdbpdpluotxjiawf'

/** As opções da linha de comando. */
export function lerArgumentos(argv) {
  const valor = (nome) => argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? null
  const ref = valor('remote')
  return {
    ref,
    contato: valor('contato') ?? 'https://ieadespa.github.io/comep/',
    producao: ref === REF_PRODUCAO,
    lancamento: argv.includes('--e-o-lancamento'),
    trocar: argv.includes('--trocar-as-chaves'),
  }
}

/** O que impede de começar (a mensagem), ou null se pode seguir. */
export function conferirArgumentos(a) {
  if (!a.ref || !/^[a-z0-9]{20}$/.test(a.ref)) {
    return 'Diga o projeto: node scripts/ligar-avisos.mjs --remote=<ref do projeto> (20 letras e números).'
  }
  if (!/^(https:\/\/|mailto:)/.test(a.contato)) {
    return 'O contato é o endereço do site (https://...) ou um mailto:.'
  }
  if (a.producao && !a.lancamento) {
    return 'Este é o projeto da produção: a produção só no lançamento (docs/lancamento.md). No dia, rode com --e-o-lancamento.'
  }
  return null
}

/** O começo do nome da pasta temporária dos arquivos com os segredos (em os.tmpdir(), só da conta de quem roda). */
export const PREFIXO_DA_PASTA = 'comep-avisos-'

/** As pastas temporárias que uma rodada anterior deixou para trás (caiu no meio): o script apaga antes de começar. */
export function sobrasDeQueda(nomes) {
  return nomes.filter((nome) => nome.startsWith(PREFIXO_DA_PASTA) && nome.length > PREFIXO_DA_PASTA.length)
}

/** O texto (o erro do Supabase CLI, que pode trazer um trecho do SQL) com cada segredo trocado por ****. */
export function mascararSegredos(texto, segredos) {
  return segredos.filter(Boolean).reduce((t, s) => t.split(s).join('****'), String(texto))
}

/** A lista dos Secrets (só os nomes e o resumo, nunca o valor) já tem as chaves do envio? */
export function jaLigado(listaDosSecrets) {
  return /\b(VAPID_PUBLICA|VAPID_PRIVADA|ENVIO_SEGREDO)\b/.test(listaDosSecrets)
}

/**
 * O par de chaves do envio (VAPID, curva P-256: a pública não comprimida, em base64url) e o segredo do cabeçalho
 * x-comep-envio (48 caracteres). Se algo sair com o tamanho errado, para antes de gravar.
 */
export function gerarChaves() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  const pri = privateKey.export({ format: 'jwk' })
  const bytes = (s) => Buffer.from(s, 'base64url')
  const publica = Buffer.concat([Buffer.from([4]), bytes(pub.x), bytes(pub.y)]).toString('base64url')
  const privada = pri.d
  const segredo = randomBytes(36).toString('base64url')
  if (bytes(publica).length !== 65 || bytes(privada).length !== 32 || segredo.length !== 48) {
    throw new Error('As chaves saíram com o tamanho errado: nada foi gravado.')
  }
  return { publica, privada, segredo }
}
