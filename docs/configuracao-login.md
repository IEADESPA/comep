# Configuração de login (Supabase Auth)

O sistema **não envia e-mails** (PROJETO.md, seção 4.1). Por isso o login dos projetos do Supabase precisa desta configuração. Ela é aplicada pelo Supabase CLI com um arquivo **mínimo**: só o que muda. O resto do projeto fica como está.

## O que muda

| Item | Valor | Por quê |
|---|---|---|
| `site_url` | `https://ieadespa.github.io/comep/` | Endereço do app |
| `additional_redirect_urls` | `https://ieadespa.github.io/comep/` | Único endereço autorizado |
| `enable_signup` | `true` | O candidato cria o próprio acesso ("Quero me associar") e o associado antigo também, com o código de primeiro acesso |
| `email.enable_confirmations` | `false` | Sem e-mail não há confirmação. Ninguém ganha acesso só por criar login: perfil só vem com a aprovação em assembleia ou com o código da secretaria |
| `minimum_password_length` | `8` | Senha mínima |
| `password_requirements` | `letters_digits` | Letras e números. A conferência de senhas vazadas só existe no plano pago |

Arquivo usado (`supabase/config.toml` numa pasta temporária, fora do repositório):

```toml
project_id = "comep-teste"   # ou comep-producao

[auth]
site_url = "https://ieadespa.github.io/comep/"
additional_redirect_urls = ["https://ieadespa.github.io/comep/"]
enable_signup = true
minimum_password_length = 8
password_requirements = "letters_digits"

[auth.email]
enable_confirmations = false
```

Comandos, sempre conferindo antes:

```sh
npx supabase config diff --remote=<ref do projeto> --workdir <pasta temporária>
npx supabase config push --remote=<ref do projeto> --workdir <pasta temporária>
```

O `diff` mostra só o que muda; as propriedades que o arquivo não declara ficam como estão.

## Situação

| Projeto | Aplicado em | Observação |
|---|---|---|
| `comep-teste` | 11/11/2026 | Conferido pelos testes de ponta a ponta: criar acesso, primeiro acesso com código e nova senha com código |
| `comep-producao` | 12/11/2026 | Preparado para o lançamento; o site oficial passa a usar a produção no passo 1 de `docs/lancamento.md` |

## Limite de logins

O Supabase aceita **30 logins ou cadastros a cada 5 minutos por endereço de internet**. Para pessoas usando o sistema, é folgado.

Nos testes automáticos, cada usuário fictício entra **uma vez** no começo (`testes/e2e/autenticacao.setup.ts`), e os testes reaproveitam a sessão. Assim a bateria fica bem abaixo do limite sem precisar mexer nele.

## Senha esquecida e primeiro acesso

Não usam e-mail: a secretaria, a presidência ou o administrador técnico gera um **código** na ficha da pessoa (ou em "Perfis de acesso") e manda pelo WhatsApp.

- O código vale **7 dias** e serve **uma vez**. Gerar outro cancela o anterior.
- No banco fica só o resumo (hash) do código, numa tabela interna, fora da API e da auditoria.
- A senha nova é gravada pelo próprio banco no formato do Supabase (bcrypt). Ninguém da diretoria fica sabendo a senha.
