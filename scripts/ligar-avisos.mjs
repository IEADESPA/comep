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
// Duas travas (revisão da parte 14):
//   - a produção só no lançamento: pede --e-o-lancamento e a confirmação digitada;
//   - rodar de novo troca as chaves (quem já ativou os avisos precisa ativar de novo no aparelho): se o projeto já
//     tem as chaves, pede --trocar-as-chaves e a confirmação digitada.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { conferirArgumentos, gerarChaves, jaLigado, lerArgumentos } from './ligar-avisos-regras.mjs'

const args = lerArgumentos(process.argv.slice(2))
const erro = conferirArgumentos(args)
if (erro) {
  console.error(erro)
  process.exit(1)
}
const { ref, contato } = args

/** A confirmação digitada: sem ela (ou sem quem digite), nada é gravado. */
async function confirmar(pergunta, palavra) {
  if (!process.stdin.isTTY) return false
  const leitor = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await leitor.question(`${pergunta}\nPara seguir, digite ${palavra}: `)).trim() === palavra
  } finally {
    leitor.close()
  }
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
// no Windows o npx é um .cmd e roda pelo shell: o caminho do arquivo vai entre aspas
const arquivo = (caminho) => (process.platform === 'win32' ? `"${caminho}"` : caminho)
const rodar = (parametros) => execFileSync(npx, parametros, { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' })

// As travas, antes de gerar qualquer chave
if (args.producao && !(await confirmar(`Isto liga os avisos no celular da PRODUÇÃO (${ref}).`, 'LANÇAMENTO'))) {
  console.error('Nada foi gravado.')
  process.exit(1)
}
// a lista dos Secrets traz só os nomes e um resumo, nunca o valor; e não vai para a tela
const lista = execFileSync(npx, ['supabase', 'secrets', 'list', `--remote=${ref}`], {
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
}).toString()
if (jaLigado(lista)) {
  if (!args.trocar) {
    console.error(
      'Este projeto já tem as chaves dos avisos. Rodar de novo troca as chaves, e quem já ativou os avisos precisa ' +
        'ativar de novo no aparelho. Só se a chave vazar: rode com --trocar-as-chaves.',
    )
    process.exit(1)
  }
  if (!(await confirmar('Isto troca as chaves dos avisos: todos os aparelhos param de receber até ativar de novo.', 'TROCAR'))) {
    console.error('Nada foi gravado.')
    process.exit(1)
  }
}

// 1. As chaves e o segredo
const { publica, privada, segredo } = gerarChaves()

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
  1. publicar a função: npx supabase functions deploy enviar-avisos --remote=${ref}
  2. pôr a chave pública na variável do GitHub (TESTE_VAPID_PUBLICA no teste, VAPID_PUBLICA no site oficial):
     ${publica}
  3. publicar a main de novo (o build pega a variável) e conferir (docs/avisos-no-celular.md, passo 6).`)
