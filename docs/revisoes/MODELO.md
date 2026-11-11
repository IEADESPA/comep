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

## Trava 3 — Teste de uso no site de teste

Dados **fictícios**. Marcar ✅ (funcionou), ❌ (problema — anotar na lista abaixo) ou ➖ (não se aplica).

| # | Perfil | O que testar | Resultado | Quem testou | Data |
|---|---|---|---|---|---|
| 1 | | | | | |

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
