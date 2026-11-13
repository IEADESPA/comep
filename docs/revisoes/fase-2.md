# Revisão da Fase 2 — Financeiro (versão 2.0-teste)

**Fase concluída no ambiente de teste em 12/11/2026** — entregas 2.1, 2.2 e 2.3. **Revisão geral da fase em 13/11/2026** (ver o fim deste arquivo).

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
| #18 — Fase 2.3: prestação de contas | Aprovado (verificar + ponta a ponta) e publicado | 12/11/2026 |

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
| 2.3 — Prestação de contas | #18 | ✅ Aprovada no teste |

- Nenhum problema bloqueante ou importante em aberto.
- **Trava 4 (aceite e produção):** pelo calendário de 12/11/2026, fica para o lançamento, depois da versão 5.0. As migrações da Fase 2 vão para o `comep-producao` nessa hora (`docs/lancamento.md`).
- Pendências para a diretoria, que não impedem a fase: perguntas 18 a 20 (vencimentos, voto na assembleia de abril e jubilado).

## Revisão geral da Fase 2 (13/11/2026)

Pedido do administrador técnico: além das travas de cada entrega, uma revisão da fase inteira (PROJETO.md, seção 14.4).

**Como foi feita:**

- Dois revisores independentes leram todo o código da Fase 2, sem ver o raciocínio de quem escreveu:
  - **banco e segurança:** as seis migrações da fase, com as permissões, as regras de acesso, as funções e os gatilhos;
  - **telas e regras:** as telas e os dados do financeiro, as configurações, a planilha e a impressão.
- Os revisores **provaram** cada achado numa cópia local do banco, ou rodando o código, antes de relatar.
- Cada correção ganhou um teste. Os 13 testes novos do banco **falham sem a correção e passam com ela** (conferido).

**O que se conferiu e estava certo:**

- O visitante sem login não lê nada do financeiro.
- Todas as funções protegidas fixam o caminho de busca, e todas as tabelas têm regras de acesso.
- As funções internas não podem ser chamadas direto.
- Não há como contar um pagamento duas vezes no caixa.
- O Conselho Fiscal só lê.
- A planilha sai com separador, acentos e decimais certos.

### Achados e correções

| # | Gravidade | O que acontecia | Correção | Teste |
|---|---|---|---|---|
| 1 | Bloqueante | Depois de um balanço aprovado, a tesouraria ainda mudava o passado: alterava o saldo inicial das contas direto na tabela, criava conta com data antiga ou lançava num exercício anterior nunca fechado. O saldo de abertura do ano seguinte deixava de bater com o aprovado | Contas só pelas funções. Nada com data até o fim do último exercício fechado muda: lançamentos, saldos iniciais, contas novas. A data do saldo inicial não pode passar dos lançamentos da conta | Banco |
| 2 | Bloqueante | O tesoureiro cancelava as próprias cobranças e ficava "em dia" (Art. 11) | Ninguém cancela a própria cobrança, como já valia para registrar e conferir | Banco |
| 3 | Bloqueante | A secretaria (ou o administrador técnico) gerava código de "nova senha" para um membro do Conselho Fiscal e entrava no lugar dele | O Conselho Fiscal tem a mesma proteção da diretoria: só a presidência gera o código | Banco |
| 4 | Bloqueante | Uma só pessoa podia ter presidência e Conselho Fiscal (a presidência dava o perfil a si mesma), fazer a análise, dar o parecer e registrar a assembleia | Ninguém dá perfil a si mesmo. A mesma pessoa não pode ser da diretoria e do Conselho Fiscal. Quem registrou a análise ou é da diretoria não dá o parecer (Art. 14) | Banco |
| 5 | Bloqueante (só quando houver taxa de inscrição) | Plano anual com taxa de inscrição: a anuidade não era gerada e o associado não devia nada no ano | A taxa de inscrição não conta na hora de gerar a anuidade | Banco |
| 6 | Bloqueante | Lançamento com data anterior ao início da conta era aceito, mas não entrava no saldo: dinheiro registrado que "sumia" | O banco recusa lançamento e pagamento com data antes do início das contas | Banco |
| 7 | Bloqueante | Orçamento: "1500.50" virava 150.050. Saldo inicial: "1.234,56" virava zero e "1.500" virava 1,50, sem aviso | Um só leitor de valores para todas as telas. Entende "1.234,56", "1234,56", "1.500" e "10.5", e recusa o que é ambíguo ("1,234") em vez de adivinhar. O campo mostra o formato esperado | Unidade (15 casos) e ponta a ponta ("1.234,56") |
| 8 | Bloqueante | O servidor devolve no máximo 1.000 linhas: depois disso, o mês a mês, a planilha e o resumo das cobranças perdiam o final sem avisar | As consultas buscam de mil em mil até o fim | — (conferido no código) |
| 9 | Bloqueante | Jubilado marcado no meio do ano ficava "em atraso", com as mensalidades seguintes vencendo, e a tesouraria não tinha como resolver | Marcado como jubilado, as cobranças em aberto do mês em diante são canceladas sozinhas (isento). Também para quem já era jubilado. A tesouraria ganhou "Cancelar uma contribuição" (isenção ou engano), com motivo | Banco |
| 10 | Bloqueante | Clique duplo em "Transferir" ou "Lançar" (enquanto a foto do comprovante era preparada) gravava duas vezes | Toda ação que grava roda uma vez só e trava o botão até terminar | — (conferido no código) |
| 11 | Importante | Pagamento registrado com R$ 0 ou valor diferente, sem explicação: era um cancelamento disfarçado | Valor maior que zero. Diferença do valor da cobrança só com observação | Banco |
| 12 | Importante | Cobrança cancelada pela tesouraria (isenção) voltava ao gerar as cobranças de novo | O cancelamento guarda o tipo: o da tesouraria não volta; o da troca de plano, sim | Banco |
| 13 | Importante | Taxa de inscrição de pastor presidente saía com o valor de não presidente, porque era gerada antes do vínculo com a igreja | A taxa é gerada no fim da aprovação, já com o vínculo | Banco |
| 14 | Importante | Planilha: descrição começando com "=", "+", "-" ou "@" virava fórmula no Excel. Também quebrava textos comuns ("- Tarifa") | Esses textos saem com um apóstrofo na frente. Os números negativos continuam números | Unidade |
| 15 | Importante | O associado com mensalidade do exercício anterior em aberto via "em atraso", mas não via nem conseguia pagar a cobrança | "Minhas mensalidades" mostra também o que ficou em aberto de antes | — |
| 16 | Importante | A tela oferecia o que o banco recusa: "Autorizar" na própria despesa, "Confirmar" no próprio pagamento, "Registrar pagamento" na própria linha. E a recusa vinha como "sem permissão", sem dizer por quê | Essas pessoas veem a explicação, não o botão. As recusas do banco aparecem com o motivo | Ponta a ponta (despesa própria) |
| 17 | Importante | A prestação de contas impressa se contradizia: com o balanço congelado, "por igreja" e "realizado" do orçamento usavam números de hoje, e o mês a mês não seguia a regra do início da conta | "Realizado" usa os mesmos números do resumo; "por igreja" diz de quando é a posição; o mês a mês segue a mesma regra | — |
| 18 | Importante | Depois de cada ação, a aba era montada de novo: perdia a busca, o filtro "só inadimplentes" e o exercício escolhido | A aba recarrega os dados no lugar | Ponta a ponta |
| 19 | Importante | O "hoje" do banco virava às 21h de Parauapebas: o associado ficava "em atraso" 3 horas antes e o exercício podia ser fechado na noite de 31/03 | O banco passou a usar o fuso America/Belem | Conferido no banco de teste |
| 20 | Importante | Um lançamento feito no mesmo instante do fechamento do exercício podia entrar no período que estava sendo fechado | Fechamento e lançamentos usam uma trava: um espera o outro | — (conferido no código) |
| 21 | Importante | Arquivar um valor da contribuição ou uma categoria era um clique só, sem confirmação | "Arquivar" pergunta antes, na própria linha | Ponta a ponta |
| 22 | Importante | O saldo inicial era ajustado numa janelinha do navegador, sem conferência do valor | Formulário na própria tela, com valor e data, e o mesmo leitor de valores | — |

**Menores (corrigidos):**

- O campo do mês, nos navegadores sem calendário de mês, agora avisa em vez de travar.
- "Informado em" mostra a data de Parauapebas (antes, depois das 21h, mostrava o dia seguinte).
- O exercício seguinte aparece na lista, para preparar o orçamento antes de abril.
- Se o comprovante não abre, a tela avisa (antes ficava "carregando" para sempre).
- Pagar a taxa de inscrição não esconde mais a troca de plano.
- O campo do arquivo fica limpo depois de enviar.
- A lista de exercícios se atualiza depois de cada passo do balanço.

**Decisão para a diretoria (pergunta 23 do PROJETO.md):** quem pagou antes do vencimento e informou o pagamento, mas ainda não teve a conferência, conta como em dia para votar? Por enquanto, só conta depois que a tesouraria confirma.

**Migração:** `20261112210000_revisao_fase2.sql`, aplicada no `comep-teste` em 13/11/2026.

**Testes:**

- 223 testes do banco e de unidade (193 antes + 13 de regressão + 17 de unidade);
- 73 de ponta a ponta (72 antes + 1 novo), no computador e no celular.
