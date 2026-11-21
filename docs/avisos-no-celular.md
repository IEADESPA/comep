# Avisos no celular — como ligar o envio

Fase 5.5, parte 11 (versão 5.5.0-teste.15). O sistema já tem tudo, menos o que depende de chave e de configuração no Supabase:

- a tabela de notificações e o sino;
- as preferências de cada pessoa (o que chega e o silêncio à noite);
- a inscrição de cada aparelho;
- a função de envio, no repositório: `supabase/functions/enviar-avisos`.

Sem os passos abaixo, os avisos aparecem só no **sino**. Com eles, chegam também ao **celular**: é a notificação do próprio navegador, sem custo, sem e-mail e sem SMS.

> **Segredos:** a chave **privada** e o segredo do envio ficam só nos *Secrets* do Supabase. Nunca no repositório, no `HANDOFF.md`, na memória ou na conversa. A chave **pública** pode ficar nas variáveis do GitHub (como o endereço do Supabase).

Faça primeiro no **comep-teste** (`ykayxhwhosgaqwxmlutb`). A produção só no lançamento (`docs/lancamento.md`).

## 1. O par de chaves do envio (VAPID)

No computador, na pasta do projeto:

```bash
npx web-push generate-vapid-keys
```

Saem duas chaves: a **Public Key** e a **Private Key**. Use um par para o teste e outro para a produção.

## 2. Os segredos da função (Supabase)

Supabase → projeto → **Edge Functions → Secrets → Add new secret**:

| Nome | Valor |
| --- | --- |
| `VAPID_PUBLICA` | a Public Key |
| `VAPID_PRIVADA` | a Private Key |
| `VAPID_CONTATO` | `mailto:` e um e-mail de quem responde pelo sistema (exigido pelos serviços de push; não recebe nada do sistema) |
| `ENVIO_SEGREDO` | uma senha longa e aleatória, com 32 caracteres ou mais (por exemplo, de um gerenciador de senhas) |

## 3. Publicar a função

```bash
npx supabase functions deploy enviar-avisos --project-ref ykayxhwhosgaqwxmlutb
```

O `supabase/config.toml` já diz que ela não exige o login do Supabase (`verify_jwt = false`). Ela confere o próprio segredo, no cabeçalho `x-comep-envio`.

## 4. Rodar a cada 5 minutos

Supabase → projeto → **Integrations → Cron**:

1. Ligue o **Cron**. Ele liga as extensões `pg_cron` e `pg_net`.
2. **Create job**, com:
   - nome: `enviar-avisos`;
   - agenda: `*/5 * * * *`;
   - tipo: **Supabase Edge Function**, `enviar-avisos`, método `POST`;
   - cabeçalho: `x-comep-envio` com o valor do `ENVIO_SEGREDO`.

Cada rodada também gera os avisos com data: os documentos da igreja 60 e 30 dias antes de vencer, e a igreja suspensa.

## 5. A chave pública no aplicativo (GitHub)

GitHub → repositório → **Settings → Secrets and variables → Actions → Variables**:

| Variável | Valor |
| --- | --- |
| `TESTE_VAPID_PUBLICA` | a Public Key do comep-teste |
| `VAPID_PUBLICA` | a Public Key do site oficial (no lançamento; até lá, a mesma do teste) |

A verificação (`.github/workflows/verificar-e-publicar.yml`) já passa essas variáveis para o build. No computador, ponha `VITE_VAPID_PUBLICA=<a Public Key>` no `.env.local`.

## 6. Conferir

1. Publique a `main` de novo, para o build pegar a variável.
2. Entre no site de teste pelo celular e toque em **"Sim, ativar"** no Início (ou em Meu perfil › Avisos › "Receber os avisos neste aparelho").
3. Com outra conta, faça algo que gere aviso. Por exemplo, a secretaria pode usar "Mandar pelo aplicativo" na ficha do ministro.
4. Em até 5 minutos, a notificação chega.
5. **Administração › Avisos e notificações** mostra:
   - quantos ativaram;
   - os aparelhos;
   - o último envio.

## Como funciona

- **Quem recebe:** só quem ativou, e só no aparelho em que ativou.
- **O que chega:**
  - os assuntos que a pessoa deixou ligados;
  - o recado da secretaria e o pedido de associação chegam sempre.
- **Silêncio à noite (22h às 7h):** só o urgente chega, por exemplo, a igreja suspensa. O resto espera as 7h.
- **O que não vai:** aviso já lido no sino e aviso com mais de 3 dias.
- **Aparelho que não existe mais** (o navegador responde 404 ou 410): a inscrição é arquivada.
- **iPhone:** só recebe com o aplicativo adicionado à tela de início (Compartilhar › Adicionar à Tela de Início).
