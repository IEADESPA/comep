# Revisão da Fase 1 — Associação, ministros e igrejas (versão 1.0)

> A Fase 1 é entregue em partes (PROJETO.md, seção 9). Cada parte passa pelas travas 1 a 3 no ambiente de teste.
> A trava 4 (produção) é uma só, no lançamento da versão 1.0.
> Regras: PROJETO.md, seção 14.

## Entrega 1.1 — Cadastros (versão 1.0-teste.1)

**Resultado: aprovada no ambiente de teste em 11/11/2026.**

O que entrou:

- **Igrejas:** cadastro, correção e arquivamento, além da lista dos ministros de cada igreja. O CNPJ é conferido na tela e no banco, inclusive o CNPJ novo com letras (Receita Federal, 2026).
- **Denominações:** lista com cadastro e arquivamento.
- **Títulos ministeriais:** lista provisória (Pastor, Evangelista, Presbítero, Missionário, Líder) até a decisão 9.
- **Ministros:**
  - cadastro direto dos associados atuais (Art. 7º, a), feito pela secretaria ou pela presidência, com nº de registro automático;
  - ficha com contato, histórico de títulos e de igrejas, e troca de igreja;
  - arquivamento do cadastro feito por engano.
- **Perfil Ministro automático:** todo associado ativo recebe o perfil; cadastro arquivado perde.
- **Perfis de acesso:** a presidência concede e retira perfis. O banco não deixa retirar o último perfil de Presidência.
- **Auditoria:** histórico de criações, alterações e arquivamentos, com filtro por área, mostrando quem fez e o que mudou.

### Trava 1 — Verificação automática

| Pull request | Resultado | Data |
|---|---|---|
| #6 — Fase 1.1, cadastros | verde (lint, 51 testes, build e 30 testes de ponta a ponta no GitHub) | 11/11/2026 |

### Trava 2 — Revisão técnica no banco de teste (`comep-teste`)

- [x] Migrações aplicadas **só** no `comep-teste`: `20261111172138_cadastros.sql` e `20261111174009_cadastros_ajustes.sql`
- [x] 6 tabelas novas, uma visão (`vw_associados`, que respeita a RLS de quem consulta) e duas operações de várias tabelas (`cadastrar_associado`, `mudar_igreja`), todas com RLS
- [x] Verificador do Supabase sem alertas sobre as tabelas. Avisos que restam:
  - "proteção contra senhas vazadas desligada": recurso do plano pago (seção 10);
  - "índices ainda não usados": normal em banco novo;
  - índice que faltava em `titulos_pessoa.titulo_id`: criado no ajuste.
- [x] Visitante sem login recusado nas 6 tabelas e na visão
- [x] Nenhuma permissão de apagar (DELETE) para `anon`/`authenticated`; nem o dono do banco apaga
- [x] **51 testes automáticos** passando:
  - 19 da Fase 0 (regras do banco);
  - 26 da Fase 1.1 (regras do banco);
  - 6 das validações das telas.
- [x] Dados **fictícios** fixos para os testes no banco de teste:
  - "Denominação Fictícia (teste)";
  - "Igreja Fictícia A (teste)" e "Igreja Fictícia B (teste)";
  - "Pessoa Fictícia para Perfis (teste)";
  - o usuário `e2e.ministro` como associado da Igreja A.

### Trava 3 — Teste de uso no ambiente de teste

Testes de ponta a ponta (`npm run e2e`): **30 de 30 passando**, ou seja, 15 testes, cada um em tamanho de computador e de celular.

| O que é testado | Resultado |
|---|---|
| Presidência cadastra uma igreja: CNPJ errado é recusado; corrige, salva, arquiva; a auditoria mostra a criação, a alteração e o arquivamento | ✅ |
| Presidência cadastra um associado atual, registra a troca de igreja (o histórico mostra as duas), acha na lista e arquiva | ✅ |
| Presidência concede e retira um perfil de acesso | ✅ |
| Nenhuma tela da diretoria fica mais larga que a tela do celular | ✅ |
| Presidência abre "Ministros" (tela pronta) e "Financeiro" (em construção, Fase 2) | ✅ |
| Ministro não abre auditoria, perfis, ministros nem igrejas, nem digitando o endereço | ✅ |
| Testes da Fase 0 (site, login, menu por perfil) | ✅ |

Conferência visual (fotos em 1280 px e 390 px, logado como presidência fictícia):

- telas: início, igrejas, nova igreja, ministros, ficha do ministro, perfis de acesso e auditoria;
- nenhuma sobra lateral no celular.

O que as fotos revelaram está nos problemas 1 e 2.

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 1 | Importante | Ao arquivar um cadastro feito por engano, a pessoa sem login continuava aparecendo em "Perfis de acesso". Os testes deixariam a lista cada vez maior | Migração `cadastros_ajustes`: a pessoa sem login é arquivada junto. Quem tem login ou perfil da diretoria não é arquivado. As 2 pessoas fictícias que já tinham sobrado no teste foram arquivadas | ✅ teste do banco + conferido no `comep-teste` (0 pessoas fictícias sobrando) |
| 2 | Menor | Na auditoria, títulos e vínculos de igreja apareciam como "registro c294c629", sem o nome do ministro | A auditoria busca o nome da pessoa de cada registro | ✅ |
| 3 | Menor | Faltava índice na chave `titulos_pessoa.titulo_id` (aviso do verificador do Supabase) | Criado na migração `cadastros_ajustes` | ✅ |

### Pendências que não travam a próxima entrega

- **Decisão 9 (títulos):** a lista é provisória.
- **Tela da lista de títulos:** hoje só a equipe técnica muda a lista. A tela entra se a diretoria quiser mexer nela com frequência.
- **Desligamento e falecimento:** ficam para a Fase 4, decididos em assembleia (Art. 8º). Até lá, a ficha só permite arquivar cadastro feito por engano.

## Entrega 1.2 — Pedido de associação

_A preencher._

## Entrega 1.3 — Portal do ministro

_A preencher._

## Trava 4 — Aceite e lançamento da versão 1.0

- [ ] Nenhum problema bloqueante ou importante em aberto (ou decisão registrada abaixo)
- [ ] Aceite técnico — nome e data:
- [ ] Aceite da diretoria (regras do estatuto) — nome e data:
- [ ] Termo da seção 8 assinado
- [ ] Migrações aplicadas no `comep-producao`
- [ ] Publicado e conferido em produção (entrar, menu, uma tela de cada perfil)
- [ ] Versão marcada no GitHub: `v1.0`

Decisões registradas:
