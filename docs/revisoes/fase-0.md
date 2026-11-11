# Revisão da Fase 0 — Fundação (versão 0.1, só em teste)

> A Fase 0 não vai para produção sozinha: ela entra na produção junto com a Fase 1, no lançamento da versão 1.0.
> Regras: PROJETO.md, seção 14.

**Resultado: Fase 0 aprovada no ambiente de teste em 11/11/2026. Liberada para começar a Fase 1.**

## Trava 1 — Verificação automática

| Pull request | Resultado | Data |
|---|---|---|
| #1 — esqueleto do app, banco inicial e testes | verde (após corrigir o arquivo do fluxo — problema 1) | 11/11/2026 |
| #2 — permissões locais fora do repositório | verde | 11/11/2026 |
| #3 — estatuto, travas de revisão e site institucional | verde | 11/11/2026 |
| #4 — ícone único | verde | 11/11/2026 |
| #5 — cores, testes de ponta a ponta e revisão da Fase 0 | ver o pull request | 11/11/2026 |

A branch `main` está protegida: o GitHub só deixa aprovar um pull request com a verificação verde, e ninguém envia direto ou à força para a `main`.

## Trava 2 — Revisão técnica no banco de teste (`comep-teste`)

- [x] Migração `20261111125148_fundacao.sql` aplicada no `comep-teste` e no `comep-producao` (São Paulo)
- [x] Conferido nos dois bancos: 3 tabelas com RLS ligado, 6 regras de acesso, 12 gatilhos
- [x] Verificador de segurança do Supabase: sem alertas (os dois projetos)
- [x] Visitante sem login recusado nas três tabelas (HTTP 401, os dois projetos)
- [x] Nenhuma permissão de apagar para `anon`/`authenticated`
- [x] 18 testes automáticos das regras do banco passando (PGlite e GitHub Actions)
- [x] Cadastro automático funcionando no banco real: cada login criado gerou a pessoa sozinho, e a auditoria registrou tudo

## Trava 3 — Teste de uso no ambiente de teste

Feito pelo Claude Code, sem roteiro manual (decisão de 11/11/2026).

### Testes de ponta a ponta (`npm run e2e`) — 22 de 22 passando

Navegador de verdade, banco de teste, usuários fictícios (`e2e.*@example.com`), cada teste em tamanho de **computador** e de **celular**:

| O que é testado | Resultado |
|---|---|
| Página inicial: título, "Portal do membro", "Quero me associar", "O que fazemos" | ✅ |
| Faixa "Versão de teste" aparece | ✅ |
| "Quero me associar": requisitos e passo a passo | ✅ |
| Portal sem login leva para a tela de entrar | ✅ |
| Endereço inexistente mostra "Página não encontrada" | ✅ |
| Nenhuma página pública fica mais larga que a tela | ✅ |
| Senha errada mostra "E-mail ou senha incorretos." | ✅ |
| Presidência: entra, vê o menu completo, abre "Ministros" (em construção) e sai | ✅ |
| Ministro: vê só os itens de ministro | ✅ |
| Ministro: não abre a auditoria nem digitando o endereço ("Sem acesso") | ✅ |
| Pessoa sem perfil: entra e é avisada; não vê o financeiro | ✅ |

### Conferência visual

Fotos do site publicado, tiradas pelo Edge sem janela, em 1280 px e 390 px: página inicial, "Quero me associar", "Entrar" e `/painel` sem login. Nada cortado ou desalinhado; cores do COMEP aplicadas.

### Backup e anti-pausa (testados no GitHub)

| O que foi testado | Resultado |
|---|---|
| Aviso anti-pausa nos dois bancos | ✅ |
| Backup semanal dos dois bancos | ✅ arquivos criptografados salvos em `comep-backups` |
| Abrir o backup **sem** a chave | ✅ recusado |
| Abrir o backup **com** a chave e conferir o conteúdo | ✅ 3 tabelas, 6 regras, gatilhos e dados iguais aos do banco naquele momento |

### Problemas encontrados

| # | Gravidade | Descrição | Corrigido em | Testado de novo |
|---|---|---|---|---|
| 1 | Bloqueante | O fluxo de verificação do GitHub não rodava: texto com dois-pontos sem aspas no arquivo do fluxo | PR #1 | ✅ verificação verde |
| 2 | Importante | Projetos do Supabase criados nos EUA (a tela só oferece o continente) | Recriados em São Paulo pelo CLI | ✅ conferido |
| 3 | Menor | Arquivo de senhas dos bancos salvo numa pasta escondida do Windows | Senhas movidas para os *Secrets* do `comep-backups`; arquivo apagado | ✅ conferido |
| 4 | Menor | Ícones diferentes: cruz na tela de entrar e no app; círculo no site | Ícone único (PR #4) | ✅ foto da tela de entrar |
| 5 | Importante | Backup e anti-pausa falhavam na produção: cada banco tem um endereço de conexão diferente (`aws-0` na produção, `aws-1` no teste) | Endereço próprio por banco nos fluxos | ✅ os dois bancos |
| 6 | Importante | Backup travou 5 minutos e falhou ao instalar o `age` pelo repositório do Ubuntu (falha de rede do servidor) | `age` baixado do GitHub com versão fixa e conferência da impressão digital; limite de tempo nos fluxos | ✅ backup verde |
| 7 | Importante | O gatilho do cadastro automático (`auth.users`) não vem na exportação da estrutura | Restauração passa a ser: migrações do repositório + dados do backup (README do `comep-backups`) | ✅ procedimento revisto |
| 8 | Menor | Testes de ponta a ponta falhavam quando o login no Supabase demorava mais de 5 s | Espera aumentada para 15 s | ✅ 22 de 22 |
| 9 | Menor | Membro `presidente-ai` da organização sem verificação em duas etapas | Recomendado ligar; não bloqueia (não é dono) | — |
| 10 | Importante | **No celular, o nome do usuário no topo cobria o botão "Sair"** (achado pelos testes de ponta a ponta no Chrome do GitHub; no Windows a fonte é mais estreita e o defeito não aparecia) | O nome encolhe com "…", o botão nunca encolhe e, em telas estreitas, o nome sai do topo (já aparece em "Olá, …") | ✅ 22 de 22 no computador e no GitHub |

## Trava 4 — Aceite

Não se aplica sozinha: a Fase 0 é aceita junto com a Fase 1, no lançamento da versão 1.0.
