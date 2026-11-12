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
| #15 — Fase 2.1: contribuições | Aprovado (verificar + ponta a ponta) e publicado | 12/11/2026 |

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

## Entrega 2.2 — Caixa (versão 2.0-teste.2)

**Resultado: aprovada no ambiente de teste em 12/11/2026.**

O que entrou:

- **Contas:** "Caixa (dinheiro)" e "Conta bancária", com saldo inicial desde o início do exercício. Outras contas (ex.: uma segunda conta no banco) se criam em Configurações.
- **Lançamentos** (aba **Caixa** do Financeiro):
  - entrada ou saída, conta, categoria, data, valor, descrição e comprovante (nota ou recibo);
  - **entrada** entra no saldo na hora;
  - **despesa** fica "aguardando autorização do presidente" e só sai do saldo depois de autorizada (Art. 12, §2º, VI);
  - lista do mês, com escolha do mês; cancelados e recusados ficam escondidos, mas aparecem se pedir.
- **Despesas a autorizar** (aba nova): o presidente autoriza ou recusa com motivo. A tesouraria acompanha a fila, mas não autoriza. **Ninguém autoriza a despesa que ele mesmo lançou.**
- **Contribuição paga entra no caixa sozinha:** em dinheiro vai para o caixa; por PIX, depósito ou transferência, para o banco. A descrição diz de quem é e de qual mês ou anuidade. Os pagamentos de antes desta entrega também entraram.
- **Transferência entre contas** (ex.: depósito das ofertas no banco). Cancelar uma transferência desfaz os dois lados.
- **Cancelar lançamento** com motivo. A entrada automática de contribuição não se cancela pelo caixa: cancela-se o pagamento no Financeiro.
- **Configurações → Contas e categorias do caixa** (tesouraria e presidência): criar conta, ajustar saldo inicial, criar e arquivar categorias. As categorias automáticas (contribuições e transferências) não mudam.
- **Regras no banco:**
  - só se grava pelas funções, que conferem o perfil;
  - categoria tem que ser do mesmo tipo do lançamento, sem data futura nem valor zero;
  - nada se apaga;
  - tudo vai para a auditoria (com nomes novos na tela de Auditoria).

Categorias iniciais (editáveis): Ofertas, Doações, Outras receitas (entradas); Eventos e encontros, Ação social, Material e expediente, Tarifas bancárias, Outras despesas (saídas).

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| Fase 2.2 — caixa | ver o pull request | 12/11/2026 |

### Trava 2

- [x] Migração `20261112173735_financeiro_caixa.sql` aplicada no `comep-teste`
- [x] **14 testes novos do banco** (172 no total):
  - entrada no saldo na hora; despesa aguardando;
  - só a presidência autoriza, e não a própria despesa; recusa exige motivo;
  - categoria do tipo errado, categoria automática, data futura e valor zero recusados;
  - cancelamento com motivo; contribuição em dinheiro → caixa, PIX → banco; entrada automática não se cancela;
  - transferência e cancelamento dos dois lados; categoria automática protegida;
  - o ministro não vê nada do caixa; ninguém grava direto nem apaga.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A tesouraria lança uma oferta e o saldo do caixa sobe | ✅ |
| A tesouraria lança uma despesa: fica "aguardando", o saldo não muda e ela não consegue autorizar | ✅ |
| O presidente autoriza; a despesa sai do saldo e mostra "autorizada por" | ✅ |
| Transferência do caixa para o banco muda os dois saldos; cancelar desfaz os dois lados | ✅ |
| Cancelar com motivo devolve o saldo; o cancelado aparece quando pedido | ✅ |
| O pagamento confirmado da anuidade aparece sozinho no caixa | ✅ |
| O ministro não abre o Financeiro | ✅ |

Usuário fictício novo para os testes: **e2e.tesouraria** (perfil Tesouraria). O teste cancela o que lança, então o saldo volta ao que era.

### Dados fictícios

`testes/dados/semente-caixa-teste.sql`: de abril até hoje, ofertas da reunião mensal, doações, tarifas, material, encontros e ação social, todas autorizadas pelo presidente fictício. Uma despesa foi recusada ("não está no orçamento"), as do mês atual ficam aguardando, e as ofertas são depositadas no banco. Toda descrição termina com "(fictício)".

No `comep-teste`, em 12/11/2026: **caixa R$ 2.126,57 e banco R$ 11.817,92**, com 2 despesas aguardando a autorização.
