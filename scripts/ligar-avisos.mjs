// Liga os avisos no celular num projeto do Supabase (docs/avisos-no-celular.md), sem mostrar nenhum segredo.
//
// Gera aqui, com o crypto do Node:
//   - o par de chaves do envio (VAPID, curva P-256): a pública no formato não comprimido, em base64url;
//   - o segredo do envio (o cabeçalho x-comep-envio), com 48 caracteres aleatórios.
// E guarda direto, sem passar pela tela:
//   - nos Secrets das Edge Functions: VAPID_PUBLICA, VAPID_PRIVADA, VAPID_CONTATO e ENVIO_SEGREDO;
//   - no Vault do banco: envio_avisos_segredo (o Cron lê dali), e agenda o envio a cada 5 minutos.
// Só a chave PÚBLICA aparece no fim (ela pode ser vista: vai para a variável do GitHub).
//
// Uso, na pasta do projeto, com o Supabase CLI já logado:
//   node scripts/ligar-avisos.mjs --remote=<ref do projeto> [--contato=<endereço do site ou mailto:>]
// Rodar de novo troca as chaves: quem já ativou os avisos precisa ativar de novo no aparelho.
// A produção só no lançamento (docs/lancamento.md).
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argumento = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? null
const ref = argumento('remote')
const contato = argumento('contato') ?? 'https://ieadespa.github.io/comep/'
if (!ref || !/^[a-z0-9]{20}$/.test(ref)) {
  console.error('Diga o projeto: node scripts/ligar-avisos.mjs --remote=<ref do projeto> (20 letras e números).')
  process.exit(1)
}
if (!/^(https:\/\/|mailto:)/.test(contato)) {
  console.error('O contato é o endereço do site (https://...) ou um mailto:.')
  process.exit(1)
}

// 1. As chaves e o segredo
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pub = publicKey.export({ format: 'jwk' })
const pri = privateKey.export({ format: 'jwk' })
const bytes = (s) => Buffer.from(s, 'base64url')
const publica = Buffer.concat([Buffer.from([4]), bytes(pub.x), bytes(pub.y)]).toString('base64url')
const privada = pri.d
const segredo = randomBytes(36).toString('base64url')
if (bytes(publica).length !== 65 || bytes(privada).length !== 32 || segredo.length !== 48) {
  console.error('As chaves saíram com o tamanho errado: nada foi gravado.')
  process.exit(1)
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
// no Windows o npx é um .cmd e roda pelo shell: o caminho do arquivo vai entre aspas
const arquivo = (caminho) => (process.platform === 'win32' ? `"${caminho}"` : caminho)
const rodar = (args) => execFileSync(npx, args, { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' })
const pasta = mkdtempSync(join(tmpdir(), 'comep-avisos-'))
try {
  // 2. Os Secrets das Edge Functions (por arquivo, para os valores não irem na linha de comando)
  const env = join(pasta, 'segredos.env')
  writeFileSync(env, `VAPID_PUBLICA=${publica}\nVAPID_PRIVADA=${privada}\nVAPID_CONTATO=${contato}\nENVIO_SEGREDO=${segredo}\n`, { mode: 0o600 })
  rodar(['supabase', 'secrets', 'set', `--remote=${ref}`, '--env-file', arquivo(env), '--yes'])
  console.log('· Secrets das Edge Functions gravados')

  // 3. O Vault e o Cron (o Cron manda o segredo no cabeçalho, lido do Vault)
  const sql = join(pasta, 'cron.sql')
  writeFileSync(
    sql,
    `create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'envio_avisos_segredo';
  if v_id is null then
    perform vault.create_secret('${segredo}', 'envio_avisos_segredo', 'Cabeçalho x-comep-envio da função enviar-avisos');
  else
    perform vault.update_secret(v_id, '${segredo}');
  end if;
end $$;
select cron.schedule('enviar-avisos', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://${ref}.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-comep-envio', (select decrypted_secret from vault.decrypted_secrets where name = 'envio_avisos_segredo')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$cron$);
`,
    { mode: 0o600 },
  )
  rodar(['supabase', 'db', 'query', `--remote=${ref}`, '--file', arquivo(sql), '--yes'])
  console.log('· segredo no Vault (envio_avisos_segredo) e envio agendado a cada 5 minutos')
} finally {
  rmSync(pasta, { recursive: true, force: true })
  console.log('· arquivos temporários apagados')
}

console.log(`
Pronto. Falta:
  1. publicar a função: npx supabase functions deploy enviar-avisos --project-ref ${ref}
  2. pôr a chave pública na variável do GitHub (TESTE_VAPID_PUBLICA no teste, VAPID_PUBLICA no site oficial):
     ${publica}
  3. publicar a main de novo (o build pega a variável) e conferir (docs/avisos-no-celular.md, passo 6).`)
