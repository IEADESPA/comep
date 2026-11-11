# Revisão da Fase 0 — Fundação (versão 0.1, só em teste)

> A Fase 0 não vai para produção sozinha: ela entra na produção junto com a Fase 1, no lançamento da versão 1.0.
> Regras: PROJETO.md, seção 14.

## Trava 1 — Verificação automática

| Pull request | Resultado | Data |
|---|---|---|
| #1 — esqueleto do app, banco inicial e testes | verde (após corrigir o arquivo do fluxo — problema 1) | 11/11/2026 |
| #2 — permissões locais fora do repositório | verde | 11/11/2026 |

## Trava 2 — Revisão técnica no banco de teste (`comep-teste`)

- [x] Migração `20261111125148_fundacao.sql` aplicada no `comep-teste` e no `comep-producao` (São Paulo)
- [x] Conferido nos dois bancos: 3 tabelas com RLS ligado, 6 regras de acesso, 12 gatilhos
- [x] Verificador de segurança do Supabase: sem alertas (os dois projetos)
- [x] Visitante sem login recusado nas três tabelas (HTTP 401, os dois projetos)
- [x] Nenhuma permissão de apagar para `anon`/`authenticated`
- [x] 18 testes automáticos das regras passando (PGlite e GitHub Actions)
- [x] Cadastro automático funcionando no banco real: o login criado no painel gerou a pessoa sozinho, e a auditoria registrou os 3 primeiros eventos

## Trava 3 — Teste de uso no site de teste (https://ieadespa.github.io/comep/)

**Conferência visual automática (Claude Code, 11/11/2026):** fotos do site publicado, tiradas pelo Edge sem janela, em 1280 px (computador) e 390 px (celular):

- página inicial, "Quero me associar" e "Entrar": nada cortado ou desalinhado nas duas larguras;
- `/painel` sem login leva para a tela de entrar.

A conferência automática **não substitui** o roteiro abaixo, que precisa ser feito por uma pessoa.

| # | Perfil | O que testar | Resultado | Quem testou | Data |
|---|---|---|---|---|---|
| 1 | Visitante | Abrir a página inicial; ver a faixa "versão de teste"; botões "Portal do membro" e "Quero me associar" funcionam | | | |
| 2 | Visitante | Abrir "Quero me associar" e ler os requisitos e o passo a passo | | | |
| 3 | Visitante | Tentar abrir `/comep/painel` sem login → deve ir para a tela de entrar | | | |
| 4 | Presidência | Entrar com e-mail e senha → ver "Olá", os perfis e o menu completo | | | |
| 5 | Presidência | Abrir cada item do menu → todos mostram "Em construção — Fase N" | | | |
| 6 | Qualquer | Senha errada → mensagem "E-mail ou senha incorretos" | | | |
| 7 | Qualquer | Sair → volta para a tela de entrar | | | |
| 8 | Qualquer | Instalar o app no Android pelo Chrome (menu ⋮ → Instalar app) e abrir pelo ícone | | | |
| 9 | Qualquer | Abrir no notebook e no celular: nada cortado nem desalinhado | | | |

### Problemas encontrados

| # | Gravidade | Descrição | Corrigido em | Testado de novo |
|---|---|---|---|---|
| 1 | Bloqueante | O fluxo de verificação do GitHub não rodava: texto com dois-pontos sem aspas no arquivo do fluxo | PR #1 (commit "Corrige o arquivo do fluxo…") | ✅ verificação verde |
| 2 | Importante | Projetos do Supabase criados nos EUA (a tela só oferece o continente) | Recriados em São Paulo pelo CLI | ✅ conferido |
| 3 | Menor | Arquivo de senhas dos bancos salvo numa pasta escondida do Windows | Senhas movidas para os *Secrets* do `comep-backups`; arquivo apagado | ✅ conferido |
| 4 | Menor | Ícones diferentes: cruz na tela de entrar e no app; círculo no site | Ícone único com o círculo do logo do COMEP (PR "ajuste-icone") | |

## Trava 4 — Aceite

Não se aplica sozinha: a Fase 0 é aceita junto com a Fase 1, no lançamento da versão 1.0.
