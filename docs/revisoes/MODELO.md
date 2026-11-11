# Revisão da Fase N — versão N.0

> Copie este arquivo como `fase-N.md` no começo de cada fase e preencha durante a revisão.
> Regras completas: PROJETO.md, seção 14.

## Trava 1 — Verificação automática

| Pull request | Resultado | Data |
|---|---|---|
| #  | verde / vermelho | |

## Trava 2 — Revisão técnica no banco de teste (`comep-teste`)

- [ ] Migração aplicada no teste: `nome_da_migracao.sql`
- [ ] Tabelas, regras de acesso (RLS) e gatilhos conferidos no banco
- [ ] Verificador de segurança do Supabase: sem alertas
- [ ] Visitante sem login recusado nas tabelas novas
- [ ] Nenhuma permissão de apagar (DELETE) para `anon`/`authenticated`

Observações:

## Trava 3 — Teste de uso no ambiente de teste

Feito pelo Claude Code com **testes de ponta a ponta** (`npm run e2e`), usuários **fictícios** e banco de teste, em tamanho de computador e de celular. Cada fase acrescenta os testes das suas telas, por perfil.

| O que é testado (por perfil) | Resultado |
|---|---|
| | ✅ / ❌ |

Conferência visual (fotos das telas novas em 1280 px e 390 px):

### Problemas encontrados

| # | Gravidade (bloqueante / importante / menor) | Descrição | Como reproduzir | Corrigido em (PR) | Testado de novo |
|---|---|---|---|---|---|
| 1 | | | | | |

## Trava 4 — Aceite e lançamento

- [ ] Nenhum problema bloqueante ou importante em aberto (ou decisão registrada abaixo)
- [ ] Aceite técnico — nome e data:
- [ ] Aceite da diretoria (regras do estatuto) — nome e data:
- [ ] Migração aplicada no `comep-producao`
- [ ] Publicado e conferido em produção (entrar, menu, uma tela de cada perfil)
- [ ] Versão marcada no GitHub: `vN.0`

Decisões registradas:
