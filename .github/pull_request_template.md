## O que muda

<!-- Em poucas linhas, para quem vai revisar. -->

## Fase e versão

- Fase:
- Versão: <!-- ex.: 1.0-teste.2 -->

## Travas de revisão (PROJETO.md, seção 14)

- [ ] **Trava 1 — Verificação automática:** lint, testes das regras do banco e build verdes neste pull request
- [ ] **Trava 2 — Revisão técnica no banco de teste:** migração aplicada no `comep-teste`, verificador de segurança do Supabase sem alertas, visitante sem login recusado
- [ ] **Trava 3 — Teste de uso:** roteiro por perfil executado no site de teste; problemas registrados e corrigidos em `docs/revisoes/fase-N.md`
- [ ] **Trava 4 — Aceite e lançamento:** aceite registrado; migração aplicada no `comep-producao`; conferência em produção

> Pull requests que não lançam versão (documentação, ajustes de teste) marcam só as travas que se aplicam e dizem por quê.

## Mudanças no banco

- [ ] Não há migração nova
- [ ] Há migração nova, e ela **só acrescenta** (não apaga coluna, tabela ou dado)
- [ ] As regras de acesso novas ganharam testes em `testes/banco/`
