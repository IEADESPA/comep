# Revisão da Fase 2 — Financeiro (versão 2.0-teste)

**Fase concluída no ambiente de teste em 12/11/2026** — entregas 2.1, 2.2 e 2.3 (ver o fim deste arquivo).

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
| Taxa de inscrição | **Isenta** (decisão de 12/11/2026) — ver o complemento abaixo |

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
| #16 — Fase 2.2: caixa | Aprovado (verificar + ponta a ponta) e publicado | 12/11/2026 |

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

## Complemento da 2.1 — Taxa de inscrição isenta e configurável

**Resultado: aprovado no ambiente de teste em 12/11/2026.**

Decisão de 12/11/2026: hoje a taxa de inscrição é **isenta**. No futuro, a assembleia pode definir um valor.

- **Configurações → Taxa de inscrição:** mostra "Hoje: Isenta" e tem o botão **Personalizar a taxa de inscrição** (tesouraria e presidência). Nele se informam:
  - o valor (0 = isenta);
  - a partir de quando vale;
  - a assembleia e a ata;
  - o prazo para pagar.
- Um valor programado para o futuro aparece na tela, e o histórico guarda tudo.
- **Quando houver valor:**
  - quem for admitido pela assembleia (pedido aprovado) recebe **uma** cobrança "Taxa de inscrição", com vencimento N dias depois da admissão (padrão: 30);
  - quem entrou no cadastro inicial não paga, e o jubilado é isento;
  - o associado paga como as outras contribuições (informar pagamento ou pagamento recebido), e o valor entra no caixa como "taxa de inscrição".
- **Escolher o plano** (mensal ou anual) não cancela a taxa, e pagar a taxa não trava a escolha do plano.
- Site: "a taxa de inscrição, quando houver, é definida pela assembleia (hoje é isenta)".

Migração `20261112193000_taxa_inscricao.sql`, aplicada no `comep-teste`. Pull request **#17**: verificar e ponta a ponta verdes, publicado em 12/11/2026.

**Trava 2:** 7 testes novos do banco (179 no total):

- isenta hoje e sem cobrança;
- o ministro não define a taxa;
- com valor, a admissão pela assembleia gera uma cobrança, com o prazo, sem repetir;
- cadastro inicial e jubilado não pagam;
- plano e taxa não se atrapalham;
- caixa com "taxa de inscrição";
- voltar a ser isenta.

**Trava 3** (ponta a ponta):

| O que é testado | Resultado |
|---|---|
| "Hoje: Isenta" na tela e nos valores em vigor | ✅ |
| A presidência programa um valor futuro: aparece como programado, e hoje continua isenta | ✅ |
| O teste arquiva os valores de teste no fim | ✅ |

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 1 | Importante | Ao salvar a taxa, a seção "Valores da contribuição" aparecia **duas vezes**. As duas seções recarregáveis usavam a mesma chave interna, e o React se confundia | Chaves diferentes para cada seção | ✅ Ponta a ponta |
| 2 | Baixa | As duas execuções que falharam deixaram valores futuros de teste no `comep-teste` | Arquivados (nada se apaga) | ✅ |

## Entrega 2.3 — Prestação de contas (versão 2.0-teste.3)

**Resultado: aprovada no ambiente de teste em 12/11/2026.**

O que entrou (aba **Prestação de contas** do Financeiro):

- **Perfil Conselho Fiscal** (Art. 14):
  - vê todo o financeiro, só para leitura: situação dos associados, cobranças, caixa, despesas e prestação de contas;
  - não vê a aba de pagamentos a conferir e não tem botões de lançar, gerar, cancelar ou registrar;
  - vê os comprovantes de pagamento, mas não as fotos e documentos dos pedidos de associação;
  - até a Fase 4 (mandatos), o perfil é dado à mão em Administração → Acessos.
- **Resumo do exercício** (abril a março), de qualquer exercício desde 2021/2022:
  - saldo de cada conta em 01/04, entradas, saídas e saldo em 31/03;
  - receitas e despesas por categoria e o resultado do exercício. As transferências entre contas aparecem à parte, porque não são receita nem despesa;
  - contribuições previstas, recebidas, em aberto e vencidas;
  - no exercício atual, é uma prévia; despesas ainda não autorizadas aparecem como aviso e não entram nos números.
- **Mês a mês** (receitas, despesas e resultado) e **contribuições por igreja**.
- **Balanço anual em quatro passos** (Art. 12, §6º, III; Art. 14; Art. 15, I):
  1. a **tesouraria fecha** o exercício, depois de 31/03 e sem despesa aguardando, com uma nota. Os números ficam congelados e **nenhum lançamento daquele exercício muda mais**;
  2. a **diretoria** (presidência) registra a análise ou devolve para correção;
  3. o **Conselho Fiscal** dá o parecer (favorável, favorável com ressalvas ou desfavorável) ou devolve para correção;
  4. a **presidência registra a decisão da assembleia**, com data e ata. Aprovado é final; reprovado volta para a tesouraria.
  - Devolvido, o exercício reabre para a tesouraria corrigir e fechar de novo.
  - Quem fechou não registra a análise nem dá o parecer.
  - Todo passo fica no **histórico do balanço**, com quem, quando e o texto.
- **Orçamento e plano anual de trabalho** (Art. 15, I):
  - a tesouraria ou a presidência prepara o plano e o valor previsto por categoria, e a tela mostra previsto × realizado;
  - a presidência registra a aprovação da assembleia, e depois disso o orçamento não muda mais.
- **Imprimir ou salvar em PDF:** a impressão mostra só o relatório (sem menu, abas e botões), com o título do COMEP e a data de emissão.
- **Planilhas (CSV em português, abrem no Excel):** "Baixar lançamentos" traz todos os lançamentos do exercício, com situação, quem autorizou e motivo; "Baixar resumo" traz contas, categorias, contribuições e igrejas.
- **Regras no banco:**
  - só se grava pelas funções, que conferem o perfil;
  - nada se apaga;
  - tudo vai para a auditoria, com nomes novos na tela de Auditoria.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| Fase 2.3 — prestação de contas | ver o pull request | 12/11/2026 |

### Trava 2

- [x] Migrações `20261112200000_perfil_conselho_fiscal.sql` e `20261112200100_prestacao_contas.sql`, aplicadas no `comep-teste`. O perfil novo fica numa migração separada, porque o banco só usa um valor novo de lista depois de gravado.
- [x] Verificador do Supabase: só os avisos já conhecidos:
  - proteção contra senhas vazadas, que é do plano pago;
  - a tabela de códigos, que só se acessa por funções;
  - índices ainda sem uso, porque há pouco dado.

  Também há duas chaves da configuração financeira (tabela de uma linha só) sem índice. Isso não afeta nada.
- [x] **Teste de fora, como visitante sem login:** "sem permissão" em balanços, histórico, orçamentos, itens e lançamentos, e nas funções de resumo e de contribuições por igreja.
- [x] **14 testes novos do banco** (193 no total):
  - o Conselho Fiscal vê, mas não lança, não cancela e não grava direto; o ministro não vê o resumo;
  - os números do resumo: saldos por conta, transferência fora das receitas e despesas, e o saldo final que vira o inicial do exercício seguinte;
  - fechar só depois de encerrado e sem despesa aguardando; o exercício fechado trava os lançamentos;
  - cada passo só por quem pode; devolver reabre, e fechar de novo atualiza os números;
  - assembleia: aprovado é final e reprovado devolve; histórico com 7 passos;
  - quem fechou não analisa;
  - orçamento: preparar, corrigir, aprovar e travar; transferência não entra;
  - contribuições por igreja;
  - comprovantes, sim, e fotos, não, para o Conselho Fiscal.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A tesouraria vê a prévia do exercício atual, os saldos, o mês a mês (12 meses) e as contribuições por igreja | ✅ |
| O exercício 2025/2026 (semente) aparece aprovado, com o parecer, os números congelados e sem botão de fechar | ✅ |
| "Baixar lançamentos" gera `lancamentos-2025-2026.csv`, com os acentos certos e as colunas em português | ✅ |
| A tesouraria prepara o orçamento e vê previsto × realizado; o orçamento aprovado não se edita | ✅ |
| Ciclo completo do balanço com quatro usuários fictícios: a tesouraria fecha, a presidência analisa, o Conselho Fiscal dá o parecer e a presidência registra a assembleia (reprovado → devolvido, com o histórico) | ✅ |
| O Conselho Fiscal entra direto na prestação de contas, sem "Pagamentos informados" e sem botões de lançar, gerar ou registrar | ✅ |

- Usuário fictício novo: **e2e.conselho**, com o perfil Conselho Fiscal. A senha fica só no arquivo local e no Secret `E2E_SENHA_CONSELHO`.
- O exercício **2021/2022 do banco de teste é reservado ao teste automático**. O ciclo sempre termina "reprovado pela assembleia", para poder rodar de novo. Se uma execução parar no meio, a próxima termina o ciclo antes.
- **72 testes de ponta a ponta** passando no computador e no celular.
- **Conferência visual:**
  - fotos no computador e no celular;
  - a impressão mostra só o relatório;
  - as contas fecham: caixa R$ 420,00 + R$ 6.518,31 − R$ 6.310,36 = R$ 627,95, e o total mês a mês é igual ao resumo.

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 1 | Importante | A conta aberta no primeiro dia do exercício aparecia como "abertura no meio do exercício", com saldo inicial zero | O saldo da conta aberta em 01/04 conta como saldo inicial | ✅ Teste do banco |
| 2 | Menor | Os botões de imprimir e baixar ficavam colados no painel, e a frase "Exercício de abril a março" saía na impressão | Espaço entre os botões e o painel; a frase não sai na impressão | ✅ Foto |

### Dados fictícios

`testes/dados/semente-prestacao-teste.sql` roda depois das outras sementes. Ela traz:

- as contas começando em 01/04/2025, com saldo de abertura;
- o exercício **2025/2026** inteiro: contribuições, ofertas, doações, despesas autorizadas e depósitos;
- o **balanço 2025/2026 aprovado** na AGO de 25/04/2026, com análise, parecer favorável e histórico;
- o **orçamento e o plano de trabalho 2026/2027**, aprovados na mesma AGO.

Toda descrição termina com "(fictício)".

No `comep-teste`, em 12/11/2026:

- 2025/2026: receitas de R$ 24.963,28 e despesas de R$ 4.149,62;
- saldos de hoje: caixa R$ 2.754,52 e banco R$ 39.073,63.

## Conclusão da Fase 2 (12/11/2026)

| Entrega | Pull request | Situação |
|---|---|---|
| 2.1 — Contribuições | #15 | ✅ Aprovada no teste |
| 2.2 — Caixa | #16 | ✅ Aprovada no teste |
| Complemento — taxa de inscrição isenta e configurável | #17 | ✅ Aprovado no teste |
| 2.3 — Prestação de contas | ver acima | ✅ Aprovada no teste |

- Nenhum problema bloqueante ou importante em aberto.
- **Trava 4 (aceite e produção):** pelo calendário de 12/11/2026, fica para o lançamento, depois da versão 5.0. As migrações da Fase 2 vão para o `comep-producao` nessa hora (`docs/lancamento.md`).
- Pendências para a diretoria, que não impedem a fase: perguntas 18 a 20 (vencimentos, voto na assembleia de abril e jubilado).
