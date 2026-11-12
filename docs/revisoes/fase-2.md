# Revisão da Fase 2 — Financeiro (versão 2.0-teste)

> Calendário (PROJETO.md, seção 9): tudo no ambiente de teste, com dados fictícios, até a Fase 5.
> Cada entrega passa pelas travas 1 a 3. Regras: PROJETO.md, seção 14.

## Entrega 2.1 — Contribuições (versão 2.0-teste.1)

**Resultado: aprovada no ambiente de teste em 12/11/2026.**

O que entrou:

- **Cobranças do exercício** (abril a março): a tesouraria ou a presidência gera, para cada associado ativo:
  - 12 mensalidades, ou a anuidade de abril para quem escolheu;
  - o valor vem da categoria: R$ 20/200 para não presidente, R$ 40/400 para presidente de igreja, e o jubilado não recebe cobrança;
  - quem entra no meio do exercício paga a partir do mês da admissão;
  - gerar de novo não repete nada.
- **Plano** mensal ou anual: o próprio associado (ou a tesouraria) escolhe, enquanto não houver pagamento no exercício. Quem entrou depois de abril paga por mês.
- **Minhas mensalidades** (ministro):
  - situação (em dia ou em atraso, com o total vencido) e plano;
  - contribuições com o estado de cada uma: paga, aguardando a tesouraria, vencida ou a vencer;
  - **informar pagamento** de uma ou mais contribuições, com comprovante. Para PIX, depósito e transferência o comprovante é obrigatório;
  - se a tesouraria recusar, aparece o motivo.
- **Financeiro** (tesouraria e presidência):
  - **Pagamentos informados:** abrir o comprovante e confirmar ou recusar, com motivo;
  - **Situação dos associados:** em dia ou em atraso, filtro de inadimplentes e "registrar pagamento recebido" (ex.: dinheiro na reunião mensal);
  - **Cobranças do exercício:** gerar e ver o resumo (previsto, recebido, em aberto, vencido).
- **Em dia ou em atraso** (Art. 11) também na ficha do ministro e no painel do pastor presidente ("Minha igreja").
- **Vencimentos** configuráveis em Configurações.
- **Regras no banco:**
  - só se grava pelas funções, que conferem o perfil;
  - ninguém confere ou registra o próprio pagamento;
  - cobrança não se apaga, se cancela com motivo;
  - tudo vai para a auditoria.

**Padrões provisórios**, até a diretoria responder as perguntas 17 a 20:

| Ponto | Padrão |
|---|---|
| Vencimentos | Mensalidade no dia 10; anuidade em 30 de abril |
| Admissão no meio do exercício | Paga a partir do mês da admissão; depois de abril, só mensal |
| Em atraso | Alguma contribuição vencida e não paga |
| Taxa de inscrição | Sem valor definido: ainda não é cobrada |

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| Fase 2.1 — contribuições | ver o pull request | 12/11/2026 |

### Trava 2

- [x] Migrações `20261112155108_financeiro_contribuicoes.sql` e `20261112155534_financeiro_ajustes.sql` aplicadas no `comep-teste`
- [x] Verificador do Supabase: só os avisos já conhecidos
- [x] **18 testes novos do banco**:
  - geração (valores por categoria, vencimentos, jubilado, admissão no meio do ano, sem repetir);
  - plano;
  - pagamento informado (dono, data futura, duplicado);
  - conferência (motivo, quem confere);
  - pagamento em dinheiro, cancelamento, quem vê o quê, gravação só pelas funções, painel do presidente e vencimentos.
- [x] O exercício testado é o anterior ao atual, todo vencido, para o resultado não depender do dia.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A tesouraria gera as cobranças; o associado novo vê as 12 mensalidades | ✅ |
| O associado escolhe a anuidade: as mensalidades saem e entra a anuidade de R$ 200 | ✅ |
| PIX sem comprovante é recusado na tela; com comprovante, "Aguardando a tesouraria" | ✅ |
| A tesouraria abre o comprovante, confirma, e vê o associado "Em dia" | ✅ |
| O associado vê "Em dia" e a anuidade "Paga" | ✅ |
| O ministro não abre o Financeiro | ✅ |

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 1 | Importante | A secretaria via a lista "em dia / em atraso" com **todos em dia**, porque enxergava os associados mas não as cobranças | A secretaria passa a **ler** as cobranças (só ler), já que vai precisar disso para as assembleias, na Fase 4 | ✅ Teste do banco |

### Dados fictícios

`testes/dados/semente-financeiro-teste.sql` tem pagamentos fictícios dos associados da semente: anuidades pagas e não pagas, quem paga tudo, quem deixa os 2 últimos meses e quem não paga nada.

No `comep-teste`, em 12/11/2026: **32 associados em dia e 40 em atraso**, com R$ 6.240 vencidos. Os criados pelos testes automáticos nunca pagam.
