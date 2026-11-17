# Revisão da Fase 5.5 — Patrimônio, assembleia on-line, telas novas, site vivo e lançamento (versão 5.5-teste)

Roteiro de 14/11/2026 (PROJETO.md, seção 9):

- a Fase 5.5 fica entre a Fase 5 e a Fase 6;
- a produção só entra no fim desta fase, já com as telas novas e o site vivo, numa mudança só;
- as respostas da seção 11.3 valem para toda a fase, sem novas perguntas.

## Entrega 5.5.1 — Patrimônio e empréstimo às igrejas (versão 5.5.0-teste.1)

O presidente do COMEP quer que o associado veja o benefício do que paga (14/11/2026). O patrimônio comprado com as contribuições (som, palcos, 300 a 400 cadeiras) é emprestado às igrejas, com agenda e termo de compromisso.

**O que entrou:**

- **Os bens** (Art. 18), em "Patrimônio" → "Bens":
  - nome, categoria, quantidade, se pode ser emprestado, como foi adquirido (compra, doação, legado), desde quando, valor de cada um e onde fica guardado;
  - a tesouraria (ou a presidência) liga o bem à **compra no caixa** (uma saída);
  - a quantidade entra por **"Acrescentar"** (dizendo de onde veio) e sai por **"Dar baixa"** (com o motivo), para ficar o histórico.
- **O pedido** ("Pedir emprestado"):
  - o pastor presidente escolhe a igreja dele, o período, a finalidade e os itens;
  - o sistema mostra quanto de cada item está livre no período;
  - ele aceita o **termo de compromisso** em nome da igreja, e o texto aceito fica guardado no pedido.
- **A agenda:** o que está reservado nos próximos 90 dias (empréstimos aprovados e retirados, e as reservas dos eventos do COMEP).
- **A aprovação:** a secretaria (o secretário executivo) ou a presidência aprova ou recusa (com o motivo). Ao aprovar, o banco confere a agenda de novo. A tela mostra o peso da igreja (ministros associados e em dia).
- **Retirada e devolução:**
  - a equipe registra quem levou e imprime o termo com as linhas de assinatura;
  - na devolução, conta o que voltou;
  - o que faltou sai do patrimônio (baixa ligada ao empréstimo) e a explicação é obrigatória.
- **Reserva para os eventos do COMEP:** a equipe reserva os itens para um evento; a reserva já entra aprovada e ocupa a agenda.
- **No Início** (secretaria e presidência): os pedidos esperando a aprovação e as devoluções atrasadas.

**Decisões tomadas sem perguntar** (as regras de apoio ainda vão ser definidas pela diretoria):

- **Regras configuráveis.** Ficam em "Patrimônio" → "Regras" e só a presidência muda:
  - antecedência mínima do pedido: 3 dias;
  - prazo máximo: 7 dias;
  - exigir que o pastor esteja em dia: sim;
  - o texto do termo.
- **A equipe pede sem a antecedência.** A secretaria, a tesouraria e a presidência podem pedir em nome da igreja em cima da hora (a igreja que liga pedindo). A equipe também não passa pela regra de estar em dia.
- **Quem aprova:** só a secretaria e a presidência. A tesouraria cadastra os bens e liga a compra, mas não aprova.
- **Disponibilidade por dia.** Um item emprestado ocupa todos os dias do período, da retirada à devolução. Um empréstimo retirado e atrasado continua ocupando o item até hoje.
- **Baixa durante o empréstimo.** Enquanto os itens estão com a igreja, a baixa manual só alcança os que estão no depósito; os emprestados saem na devolução.
- **Quem vê:**
  - os bens e a agenda: quem é do COMEP;
  - os pedidos: a equipe, o Conselho Fiscal, quem pediu e o pastor presidente da igreja;
  - as baixas: a equipe e o Conselho Fiscal.
- **No menu:** o pastor presidente, a secretaria, a tesouraria, a presidência e o Conselho Fiscal (que acompanha, mas não pede). O ministro comum não vê.

**Verificação:**

- testes do banco: `testes/banco/patrimonio.test.ts` (21 testes). Cobrem:
  - quem cadastra e as quantidades;
  - a compra no caixa;
  - as regras configuráveis;
  - o termo;
  - a antecedência, o prazo e a contribuição em dia;
  - a agenda com dois pedidos no mesmo período;
  - quem aprova;
  - a reserva do evento;
  - quem vê;
  - a retirada, a devolução com falta e a baixa;
- ponta a ponta: `testes/e2e/patrimonio.spec.ts`. A presidência fictícia faz o caminho todo com um bem fictício fixo ("Cadeira de teste (E2E)"); o Conselho Fiscal acompanha; o ministro não vê.

## Entrega 5.5.2 — Votações e enquetes on-line (versão 5.5.0-teste.2)

O usuário pediu em 17/11/2026: "pode fazer as votações, enquetes", sem se preocupar com o estatuto (que só prevê a assembleia presencial). Votar pelo celular serve para ouvir os associados em alguns assuntos e para votar os itens da assembleia.

**O que entrou** (menu "Votações e enquetes"):

- **Enquete:**
  - uma pergunta com opções, de 2 a 20;
  - pode deixar escolher mais de uma ("cada um escolhe até…").
- **Votação:**
  - a favor, contra ou abstenção, com a maioria exigida (simples, 3/5 ou 2/3);
  - a conta é a mesma da assembleia: sobre os votos válidos, e a abstenção não entra.
- **Quem vota:** todos os associados, só os em dia, ou só os presentes (e em dia) numa assembleia.
- **Voto secreto (o padrão):**
  - o banco guarda **quem** votou (a participação), mas não **o que** votou;
  - o voto vai direto para uma contagem por opção, numa tabela sem auditoria, sem carimbo de hora e sem ligação com a pessoa;
  - ninguém vê a contagem antes do fim, nem quem organiza. Senão daria para descobrir o voto de quem acabou de votar;
  - um teste confere que nem a auditoria guarda a escolha.
- **Voto aberto:** no fim, todos veem quem votou em quê. Ele pode mostrar a parcial enquanto está aberto.
- **Prazo (opcional):** passado o prazo, ninguém mais vota e o resultado já aparece.
- **Na assembleia:**
  - na condução, cada item da pauta tem o atalho "vote pelo celular dos presentes";
  - a votação do item usa a maioria do item, e só os presentes em dia votam;
  - só abre com a assembleia instalada, e só uma votação aberta por item;
  - ao encerrar, o resultado vai para a votação do item (a deliberação que entra na ata) pela mesma regra da contagem à mão, inclusive o desligamento por conduta e a jubilação.
- **O voto:** um por pessoa, sem volta. A tela pede para confirmar antes.
- **A tela aberta se atualiza sozinha** a cada 10 segundos (a participação e, se houver, a parcial). Isso serve para o telão da assembleia.
- **No Início:** "Vote agora", com as votações abertas em que a pessoa ainda não votou.

**Decisões tomadas sem perguntar:**

- **Quem organiza:** a secretaria e a presidência. Preparam, abrem, encerram e cancelam, e veem a participação (quem já votou, sem o voto).
- **Quem vota:** só o associado ativo (o jubilado vota). A conta só de equipe, sem ser associado, não vota.
- **Depois de aberta, a votação não se altera.** Se for preciso, cancela-se com o motivo e faz-se outra.
- **Risco que fica:** quem tem acesso direto ao banco (o administrador técnico, pelo SQL) poderia, com muito trabalho, ligar o último voto de cada opção à última pessoa que votou, pelos registros internos do PostgreSQL. Pelo sistema, ninguém consegue.

**Verificação:**

- testes do banco: `testes/banco/votacoes.test.ts` (12 testes). Cobrem:
  - quem prepara;
  - as opções;
  - o voto secreto, inclusive a auditoria;
  - a parcial;
  - o voto aberto;
  - as maiorias;
  - o prazo;
  - o cancelamento;
  - o item da pauta, com o resultado indo para a deliberação;
- ponta a ponta: `testes/e2e/votacoes.spec.ts`. A presidência fictícia abre uma enquete secreta, o ministro fictício vota pelo Início, a presidência encerra e o ministro vê o resultado.
