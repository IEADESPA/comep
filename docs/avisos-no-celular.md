# Avisos no celular — como ligar o envio

Fase 5.5, parte 11 (versão 5.5.0-teste.15); o jeito de ligar foi revisto na parte 14 (versão 5.5.0-teste.18). O sistema já tem:

- a tabela de notificações e o sino;
- as preferências de cada pessoa (o que chega e o silêncio à noite);
- a inscrição de cada aparelho;
- a função de envio, no repositório: `supabase/functions/enviar-avisos`.

Sem o envio ligado, os avisos aparecem só no **sino**. Com ele, chegam também ao **celular**: é a notificação do próprio navegador, sem custo, sem e-mail e sem SMS.

> **Segredos:** a chave **privada** e o segredo do envio ficam só nos *Secrets* das Edge Functions e no *Vault* do banco. Nunca no repositório, no `HANDOFF.md`, na memória, na conversa ou na tela. A chave **pública** pode ser vista: vai para as variáveis do GitHub.

## Onde está ligado

| Projeto | Situação |
| --- | --- |
| **comep-teste** (`ykayxhwhosgaqwxmlutb`) | **Ligado** desde 21/11/2026: os Secrets, a função publicada, o Cron a cada 5 minutos lendo o segredo do Vault e a variável `TESTE_VAPID_PUBLICA` no GitHub. O `VAPID_CONTATO` é o endereço do site (`https://ieadespa.github.io/comep/`). |
| **Produção** | Só no lançamento (`docs/lancamento.md`), com o script abaixo. |

## Como ligar (o script)

O script `scripts/ligar-avisos.mjs` faz tudo o que tem segredo, sem mostrar nada:

1. gera, com o `crypto` do Node, o par de chaves do envio (VAPID, curva P-256; a pública no formato não comprimido, em base64url) e o segredo do envio (48 caracteres aleatórios);
2. grava nos **Secrets das Edge Functions**: `VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_CONTATO` e `ENVIO_SEGREDO` (por um arquivo temporário, que apaga no fim);
3. grava o segredo no **Vault** do banco, com o nome `envio_avisos_segredo`;
4. agenda no **Cron** (`pg_cron` + `pg_net`) a chamada da função a cada 5 minutos, com o cabeçalho `x-comep-envio` lido do Vault;
5. mostra só a chave **pública**.

Na pasta do projeto, com o Supabase CLI logado:

```bash
node scripts/ligar-avisos.mjs --remote=<ref do projeto>
```

O contato padrão é o endereço do site. Para outro, use `--contato=https://...` ou `--contato=mailto:...` (exigido pelos serviços de push; não recebe nada do sistema).

Depois do script:

1. **Publicar a função:**

   ```bash
   npx supabase functions deploy enviar-avisos --remote=<ref do projeto>
   ```

   O `supabase/config.toml` já diz que ela não exige o login do Supabase (`verify_jwt = false`). Ela confere o próprio segredo, no cabeçalho `x-comep-envio`.

2. **A chave pública no GitHub:** repositório → **Settings → Secrets and variables → Actions → Variables**:

   | Variável | Valor |
   | --- | --- |
   | `TESTE_VAPID_PUBLICA` | a chave pública do comep-teste |
   | `VAPID_PUBLICA` | a chave pública do site oficial (no lançamento; até lá, a mesma do teste) |

   A verificação (`.github/workflows/verificar-e-publicar.yml`) passa essas variáveis para o build. No computador, ponha `VITE_VAPID_PUBLICA=<a chave pública>` no `.env.local`.

3. **Publicar a `main` de novo**, para o build pegar a variável.

> Rodar o script de novo **troca as chaves**: quem já ativou os avisos precisa ativar de novo no aparelho. Por isso, no comep-teste, só se a chave vazar. O script tem duas travas: se o projeto já tem as chaves, ele para e pede `--trocar-as-chaves` e a palavra TROCAR digitada; na produção, ele pede `--e-o-lancamento` e a palavra LANÇAMENTO digitada.

Cada rodada do envio também gera os avisos com data: os documentos da igreja 60 e 30 dias antes de vencer, e a igreja suspensa.

## Conferir

1. Entre no site pelo celular e toque em **"Sim, ativar"** no Início (ou em Meu perfil › Avisos › "Receber os avisos neste aparelho").
2. Com outra conta, faça algo que gere aviso. Por exemplo, a secretaria pode usar "Mandar pelo aplicativo" na ficha do ministro.
3. Em até 5 minutos, a notificação chega.
4. **Administração › Avisos e notificações** mostra:
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
- **Os testes automáticos** simulam a inscrição (não deixam aparelho falso ativo) e não dependem de o sino estar quieto.
