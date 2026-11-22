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

## Entrega 5.5.3 — Pedido de Assembleia Extraordinária on-line (versão 5.5.0-teste.3)

O Art. 16, §3º diz que a AGE é pedida por 3/5 dos associados ou pela maioria simples do Conselho Diretor, sempre com a pauta. Agora o pedido e as assinaturas são feitos no sistema.

**O que entrou** (em "Assembleias" → "pedidos de AGE e assinaturas"):

- **Abrir o pedido:** um associado em dia (ou membro do Conselho Diretor) escreve o assunto, a justificativa e a pauta (de 1 a 20 itens). Ao abrir, ele já assina.
- **Assinar:**
  - os associados em dia assinam pela tela;
  - as assinaturas ficam visíveis a quem é do COMEP, como num abaixo-assinado;
  - enquanto o pedido colhe assinaturas, dá para retirar a sua;
  - quem abriu pode cancelar o pedido, com o motivo.
- **A meta:**
  - 3/5 dos associados aptos (ativos e em dia), arredondado para cima (75 aptos → 45 assinaturas);
  - ou mais da metade dos membros do Conselho Diretor em mandato.
  - Atingida a meta, o pedido fica guardado com a conta daquele momento e não muda mais.
- **O prazo** para colher as assinaturas fica nas regras das assembleias, em Configurações (30 dias). Passado o prazo sem atingir a meta, ninguém mais assina.
- **Marcar a AGE:** atingida a meta, a presidência ou a secretaria escolhe a data e o local.
  - A assembleia nasce em preparo, com a pauta do pedido: itens de votação por maioria simples, que a secretaria ajusta antes de convocar.
  - O "quem pediu" vem preenchido, por exemplo: "Pedido de 3/5 dos associados (Art. 16, §3º), feito no sistema: 45 assinaturas de associados em dia, de 75 aptos (mínimo 45), em dd/mm/aaaa".
  - A convocação segue as regras de sempre: antecedência e edital.
- **No Início:**
  - os pedidos que ainda esperam a assinatura da pessoa;
  - para a presidência e a secretaria, os pedidos que atingiram a meta.

**Decisões tomadas sem perguntar:**

- **A base dos 3/5** são os associados aptos (ativos e em dia), a mesma do quórum (pergunta 25). Só assinam os em dia.
- **A conta vale para hoje:** quem assinou e depois caiu em atraso deixa de contar. A tela mostra "não conta hoje" ao lado do nome.
- **O Conselho Diretor** são os cargos da diretoria com mandato valendo hoje; o Conselho Fiscal não entra.
- **O pedido não se altera depois de aberto.** Se precisar mudar, quem abriu cancela e abre outro.

**Verificação:**

- testes do banco: `testes/banco/pedidos_age.test.ts` (11 testes). Cobrem:
  - quem abre e quem assina;
  - assinar duas vezes e retirar a assinatura;
  - a meta pelos associados e pelo Conselho Diretor;
  - o prazo e o cancelamento;
  - quem vê;
  - marcar a AGE, com a pauta e o fundamento;
  - a conta de hoje com quem caiu em atraso;
- ponta a ponta: `testes/e2e/pedidos-age.spec.ts`, com o pedido fictício de `testes/dados/semente-pedido-age-teste.sql`. Os usuários fictícios dos testes não podem assinar: a presidência fictícia não é associada e o ministro fictício está em atraso de propósito. Por isso o teste confere a tela, as assinaturas e a recusa a quem está em atraso.

## Entrega 5.5.4 — Site vivo: a diretoria e as igrejas no site (versão 5.5.0-teste.4)

O usuário pediu em 14/11/2026 um "site vivo": o que se lança no sistema aparece no site. Já apareciam as convocações, os eventos (com a inscrição pelo site) e os avisos marcados pela secretaria; o pedido de associação e a inscrição nos eventos já iam do site para o sistema.

**O que entrou:**

- **Página "Diretoria"** (`/diretoria-do-comep`; `/diretoria` é a tela interna do sistema):
  - o Conselho Diretor e o Conselho Fiscal com mandato valendo hoje, com o cargo, o nome e o período do mandato;
  - vem do registro da diretoria no sistema: um mandato encerrado (renúncia, desligamento) sai do site na hora.
- **Página "Igrejas"** (`/igrejas-do-comep`):
  - as igrejas que têm ministros associados ativos, com o nome, a sigla, a denominação, o bairro e quantos ministros;
  - uma busca por nome, denominação ou bairro.
- **"O COMEP hoje"** na página inicial: ministros associados, igrejas e denominações. Aparece só quando já há associados cadastrados.
- **No menu do site:** Agenda, Diretoria e Igrejas.

**Decisões tomadas sem perguntar (cuidado com os dados, LGPD):**

- **Só vai para o site o que é institucional.** Ficam de fora:
  - o endereço, o telefone e o CNPJ das igrejas, que elas não autorizaram publicar;
  - o CPF, o e-mail, o telefone e a foto das pessoas.
  - Se a diretoria quiser mostrar o contato das igrejas, o próximo passo é o pastor presidente marcar "mostrar no site" em "Minha igreja".
- **A igreja só aparece com pelo menos um ministro associado ativo.** Uma igreja só cadastrada não é "do COMEP".

**Verificação:**

- testes do banco: `testes/banco/site_vivo.test.ts` (4 testes). Cobrem:
  - quem aparece na diretoria;
  - o mandato encerrado sai do site;
  - quais igrejas aparecem, sem endereço nem telefone;
  - os números;
- ponta a ponta: `testes/e2e/site-vivo.spec.ts`, como visitante sem login.

## Entrega 5.5.5 — Telas novas, parte 1: a moldura, o sino, entrar e o Início (versão 5.5.0-teste.5)

As telas aprovadas pelo usuário na página de propostas (roteiro e regras em `docs/telas-novas.md`) começam a entrar no sistema. Esta parte traz o que vale para todas as telas; a parte 2 traz as telas gerais (Meu perfil, Minha credencial, Minhas mensalidades, Minha igreja, Meu pedido e Validar credencial).

**O que entrou:**

- **Moldura do sistema** (aprovada: Opção 2, "Menu vermelho e blocos por assunto"):
  - no notebook, o menu da esquerda no vermelho do COMEP, **curto**: Início, a tela aberta e Meu perfil, com o nome e o "Sair" embaixo. Os módulos ficam na página inicial;
  - em cima, a barra branca com o caminho, a **busca** (diretoria: telas, ministros e igrejas; abre a lista já filtrada), o botão **claro/escuro** e o **sino**;
  - o menu e o conteúdo **rolam cada um por si** (regra das colunas separadas);
  - no celular, a **barra vermelha em cima** com o sino, o botão Menu e as abas Início, Módulos e Meu perfil (quem não tem perfil: Meu pedido no lugar de Módulos). **Nada de barra embaixo.**
- **Modo claro e escuro:** sem escolha, segue o do aparelho; a escolha fica guardada no aparelho (`src/componentes/tema.ts`). As cores viraram variáveis em `src/estilos.css`, com os tons das propostas.
- **Letras:** Inter no texto e Plus Jakarta Sans nos títulos, guardadas no próprio app (pacotes `@fontsource`), sem buscar em servidor de fora.
- **O sino** (aprovado: "painel que desce do sino") e o **Menu do celular** (de cima para baixo: Início, Módulos, Avisos, Meu perfil, o modo claro/escuro e Sair).
- **Entrar, Primeiro acesso, Esqueci a senha** (aprovada: Opção 3, "Vermelho forte") e, no mesmo padrão, a criação do acesso para o pedido de associação.
- **Início** (aprovado com o menu curto): "Precisa de você" (diretoria) ou "Para você" (ministro), a agenda dos próximos dias (diretoria) ou a credencial (ministro), e os módulos agrupados por assunto. Quem ainda não tem perfil vê o pedido de associação em passos. Nova tela `/modulos`, com todos os módulos (no celular, é a aba "Módulos").

**De onde vêm os dados (nada novo no banco nesta parte):**

- "Precisa de você": pedidos de associação para analisar, despesas para autorizar (presidência), comprovantes para conferir, empréstimos para aprovar ou com a devolução atrasada, trocas de igreja, pedidos de correção, justificativas de falta e pedidos de AGE que atingiram as assinaturas.
- "Para você": votações abertas, pedidos de AGE para assinar, faltas seguidas, a próxima assembleia convocada (com a presença confirmada ou não), eventos com inscrição aberta e a situação da contribuição.
- O sino é montado com o que já existe: votação aberta, pedido de AGE para assinar, assembleia convocada, aviso no mural e pendência no pedido de associação. O "lido" fica guardado no aparelho.

**Decisões tomadas sem o desenho:**

- A troca claro/escuro no celular fica no Menu (o desenho do celular só mostrava o sino e o Menu).
- O sino no celular abre logo abaixo da barra vermelha, do mesmo jeito que o Menu.
- O "Ver todos os avisos" do sino leva ao mural de avisos (ainda não existe a lista de notificações no banco).
- A agenda dos próximos dias aparece também no celular, embaixo do "Precisa de você".
- Os perfis da pessoa continuam como etiquetas logo abaixo da saudação.
- A saudação segue a hora de Parauapebas: "Bom dia", "Boa tarde" ou "Boa noite", com o primeiro nome.
- No "Já é associado do COMEP?" (quem não tem perfil) não há o botão "Tenho um código": o sistema ainda não liga um login já criado a um cadastro pelo código. Fica o texto pedindo o código à secretaria.

**O que depende do banco (para depois):**

- Uma tabela de notificações, para o sino avisar também o que hoje não fica registrado (ex.: "comprovante conferido") e guardar o "lido" na conta, e não só no aparelho.

**Verificação:**

- testes de unidade: `testes/unidade/inicio.test.ts` (as datas no fuso de Parauapebas e os módulos por perfil);
- ponta a ponta: `testes/e2e/moldura.spec.ts` (o modo escuro guardado, o sino e a navegação em cima no celular) e os testes antigos ajustados para o menu curto (os módulos agora são conferidos em `/modulos`).

## Entrega 5.5.5 — Telas novas, parte 2: as telas gerais (versão 5.5.0-teste.6)

As telas gerais aprovadas na rodada 5 (`docs/telas-novas.md`), na moldura da parte 1. Regra das **abas = submódulos**: cada aba tem endereço próprio, e o link abre na aba certa.

**O que entrou:**

- **Meu perfil** (aprovado: "a ficha com todas as abas"):
  - no alto, a foto (ou as iniciais), o nome, a função e a igreja, as etiquetas (em dia, título, nº) e "Trocar foto";
  - abas **Meus dados** (`/meu-perfil`), **No COMEP** (`/meu-perfil/comep`), **Minha igreja** (`/meu-perfil/igreja`), **Senha** (`/meu-perfil/senha`) e **Correções** (`/meu-perfil/correcoes`);
  - "No COMEP" mostra a situação, a admissão, o título, a contribuição, a credencial, as faltas seguidas e os perfis, com atalhos para as mensalidades e a credencial.
- **Minha credencial:** no notebook, a frente e o verso; no celular, só a frente, com "Ver o verso". O botão **"Mostrar o QR Code"** abre o QR grande para quem vai conferir. O cartão continua sendo o do modelo em uso (Credenciais → Modelo).
- **Minhas mensalidades:**
  - no notebook, o resumo (situação, a próxima e o plano) e a lista dos meses, com "Enviar comprovante" em cada mês em aberto;
  - no celular, a próxima mensalidade em destaque, com "Já paguei: enviar o comprovante";
  - o formulário de informar o pagamento continua embaixo, e os botões já marcam o mês.
- **Minha igreja** (aprovado: "as cinco abas da igreja"):
  - no alto, a igreja com o peso dela (ministros associados e em dia);
  - abas **Dados**, **Documentos**, **Diretoria**, **Ministros** e **Agenda** (`/minha-igreja/…`);
  - a Agenda mostra os empréstimos do patrimônio da igreja (com o selo da situação) e a agenda do COMEP.
- **Meu pedido** (aprovado: "a situação em destaque"): o quadro grande com a situação, "O que a secretaria conferiu" e os passos. O formulário (fazer, corrigir e desistir) continua o mesmo.
- **Validar credencial** (aprovada: Opção 3, "a credencial com carimbo"):
  - a credencial com o carimbo por cima (VÁLIDA, EM ATRASO, NÃO VALE ou VENCIDA);
  - ao lado, a situação e os dados;
  - o botão de marcar presença da secretaria continua.

**Decisões tomadas sem o desenho:**

- **Correções:** a tela já pede do jeito estruturado (escolher o dado, ver como está e dizer como deve ficar). O banco ainda guarda o pedido como texto, então a frase vai pronta para a secretaria corrigir à mão. O telefone e o que ainda está vazio a própria pessoa muda em "Meus dados".
- **Validar credencial:** o cartão da página pública é o desenho padrão do COMEP, porque a página sem login não recebe o modelo editado da credencial. O carimbo usa as cores do modo claro mesmo no escuro, para ler bem no papel branco.
- **Mensalidades no celular:**
  - a lista completa dos meses continua embaixo (o desenho mostrava só os dois últimos);
  - o plano aparece num bloco próprio;
  - não há chave PIX na tela, porque ela ainda não existe nas Configurações.
- **Meus dados:** o e-mail de login segue travado. Ele é o login e não se troca por aqui.
- **Os textos dos botões:** ficaram os que já eram claros ("Salvar meus dados", "Enviar pedido de troca", "Salvar contato da igreja"). "Trocar senha" virou "Trocar a senha" e "Ver a impressão" virou "Imprimir", como no desenho.

**O que depende do banco (para depois):**

- **Correção estruturada de verdade:** `pedidos_correcao` com o campo, o valor de hoje e o valor pedido. Assim, a secretaria aceita e a correção entra sozinha no cadastro.
- **Selo da secretaria por item no pedido de associação:** cada dado e cada documento aprovado ou recusado com o motivo; "Mandar para a AGO" só com tudo aprovado. Hoje a decisão é uma só para o pedido inteiro, e o selo de cada linha segue a situação do pedido.
- **Diretoria da igreja:**
  - o cargo ligado a um ministro da igreja ("ministro da igreja") ou a um nome completo;
  - a conferência da secretaria ("conferido em…").
  - Hoje é cargo e nome, com o mandato.
- **"Dados conferidos pela secretaria"** na igreja: não há registro dessa conferência (só a dos documentos).
- **Faltas na aba "No COMEP":** aparece o número de faltas seguidas (já existe). A lista de cada falta e da justificativa depende de uma consulta nova.
- **Agenda da Minha igreja:** os empréstimos e a agenda do COMEP aparecem. Ela melhora quando o módulo de agenda for revisto.
- **Chave PIX da tesouraria** nas Configurações, para aparecer em "Como pagar".

**Verificação:**

- ponta a ponta: os testes do perfil, da igreja, da credencial e do pedido foram ajustados às abas (`portal-ministro`, `credencial-digital` e `pedido`).

## Entrega 5.5.6 — Telas novas, parte 3: o menu do módulo e o módulo Ministros e inscrições (versão 5.5.0-teste.7)

O padrão de navegação aprovado em 18/11/2026 para **todos** os módulos ("o módulo toma a coluna", rodada 11) e o primeiro módulo redesenhado (rodada 6, com o cadastro da rodada 7). Nada novo no banco.

**O que entrou:**

- **O menu do módulo** (`src/componentes/MenuDoModulo.tsx`):
  - no notebook, dentro de um módulo, a coluna vermelha vira o menu dele: "← Início", o bloco com o ícone (fundo branco), o nome e "N funções", as funções grandes com ícone e o número da pendência, a função aberta em fundo branco com o texto vermelho e, embaixo, Meu perfil e o cartão com "Sair";
  - as subfunções abrem embaixo da função aberta, com recuo e o traço à esquerda; ao abrir outra função, a anterior fecha;
  - no celular, logo abaixo da barra vermelha, o botão de largura inteira com o ícone e o nome da função aberta, "N funções" e a seta; ele abre a lista das funções e das subfunções. Nada de barra embaixo;
  - o caminho no topo mostra "Início › Módulo › Função";
  - fora dos módulos (Início, Módulos, Meu perfil e as telas pessoais), continua o menu curto.
- **A lista das funções de cada módulo num lugar só** (`MODULOS` em `src/componentes/menu.ts`), cada uma ligada a um endereço:
  - Ministros e inscrições: Ministros, Pedidos de associação, Correções pedidas e Cadastrar ministro;
  - Credenciais: Credenciais, Imprimir e Modelo;
  - Igrejas: Igrejas e Cadastrar igreja;
  - Financeiro: Contribuições (com as subfunções Situação dos associados e Cobranças do exercício), Comprovantes, Caixa, Despesas a autorizar e Prestação de contas;
  - Patrimônio: Pedidos, Pedir emprestado, Agenda, Bens e Regras;
  - Assembleias: Assembleias e reuniões, Pedidos de AGE, Faltas e justificativas e Preparar assembleia;
  - Votações e enquetes, Comissões e Eventos e projetos: a lista e o "novo";
  - Diretoria, Mural de avisos e Painel da presidência: uma função cada;
  - Administração: Configurações, Perfis de acesso e Auditoria.
- **Não há mais abas no alto para os submódulos.** O Financeiro e o Patrimônio, que tinham abas, ganharam um endereço por função (`/financeiro/caixa`, `/patrimonio/bens`…). `/financeiro` e `/patrimonio` abrem a primeira função de quem está vendo. O conteúdo de cada função continua o de antes (o usuário ainda vai escolher 3 opções de cada tela).
- **O número das pendências** ao lado da função (`src/estado/pendencias.ts`): pedidos de associação em análise, correções e trocas de igreja, comprovantes a conferir, despesas a autorizar (presidência), empréstimos para aprovar e justificativas de falta. Os atalhos do "Precisa de você" do Início levam direto à função.
- **Ministros** (aprovada: opção 1, a tabela): a busca por nome, nº, igreja ou título; os filtros Todos, Em dia, Em atraso, Com pendência e Jubilados, com a quantidade; as colunas Nome (com as iniciais), Nº, Título, Igreja e Situação. No celular, a lista compacta (iniciais, nome, nº e igreja, situação).
- **Pedidos de associação:** os filtros em pílulas, cada pedido com a barra "x de 4 conferidos" e o selo da situação.
- **Correções pedidas** (`/ministros/correcoes`): as correções no cadastro e as trocas de igreja pedidas pelos ministros, que antes ficavam no alto da lista dos ministros.
- **Cadastrar ministro** (aprovada: opção 2, o passo a passo): 1 Dados pessoais, 2 Igreja e ministério, 3 No COMEP, um de cada vez, com os passos marcados no alto, "Continuar" e "Voltar". No celular, os três traços e "1 de 3".
- **A ficha do ministro em abas**, cada uma com endereço próprio (`/ministros/:id/igreja`…): Dados, Igreja, Título, Contribuição, Credencial, Acesso e Situação. No alto, as iniciais, o nome e as etiquetas (em dia, título, nº, pastor presidente, sem login).

**Decisões tomadas sem o desenho:**

- **Módulo de uma função só** (Diretoria, Mural de avisos, Painel da presidência) também usa o menu do módulo, com "1 função", para todos os módulos terem o mesmo jeito.
- **Administração** virou um módulo (Configurações, Perfis de acesso e Auditoria), como na lista das telas (`docs/telas-novas.md`, nº 19). No Início, a linha "Administração" continua igual.
- **Nomes das funções do Financeiro:** os do desenho aprovado (Contribuições, Comprovantes…). "Pagamentos informados" virou **Comprovantes**; "Situação dos associados" e "Cobranças do exercício" viraram as subfunções de **Contribuições**. O Orçamento continua dentro da Prestação de contas, como já era.
- **A função com subfunções que não está aberta** mostra uma seta para baixo (no desenho só a aberta tinha a seta).
- **No celular, a lista das funções** mostra as subfunções de todas as funções (a sanfona é do notebook); um ponto vermelho ao lado de "N funções" avisa que há pendência em outra função.
- **Credenciais › Imprimir** aberta pelo menu, sem ninguém marcado, explica que se marca na lista.
- **Situação na tabela dos ministros:** uma etiqueta principal (Desligado, Jubilado, Em atraso ou Em dia) e, se faltar algo na credencial, uma segunda etiqueta (por exemplo, "Sem foto +2"). O desenho mostrava uma só.
- **Pedidos de associação:** além dos três filtros do desenho (Em análise, Esperando a AGO, Concluídos), ficou o **Com pendência** (devolvido ao candidato), que já existia.
- **A barra "x de 4 conferidos":** os itens são os dados pessoais, a igreja e o título, a foto 3×4 e o comprovante. Até a parte 4 (o banco da análise item por item), a conferência é do pedido inteiro: com a ficha aceita, os quatro contam como conferidos.
- **Cadastrar ministro:** o CPF e a filiação não entram no cadastro (a função do banco não recebe); ficam na aba Dados da ficha, logo depois. A forma de admissão é sempre "associado anterior ao sistema" (quem é novo faz o pedido). A contribuição segue a categoria, sem escolha no cadastro.
- **Ficha do ministro:**
  - sem "Trocar foto": a foto continua com o próprio ministro (o sistema não sobe a foto de outra pessoa);
  - a aba Dados já abre com o formulário (antes era "Editar");
  - a aba Contribuição mostra a categoria, o valor e a situação; os pagamentos continuam com a tesouraria, no Financeiro (o desenho mostrava os meses com "Registrar pagamento");
  - a aba Acesso mostra o login e o código de primeiro acesso (ou de nova senha); os perfis da diretoria continuam em Administração › Perfis de acesso;
  - "Arquivar cadastro" fica na aba Situação, com a admissão e o desligamento.
- **Os testes de ponta a ponta** ganharam ajudantes (`testes/e2e/ajuda.ts`): `abrirFuncao`, `funcoesDoModulo`, `cadastrarMinistro`, `abrirFichaDoMinistro`, `abrirAbaDaFicha` e `arquivarCadastroAberto`.

**O que depende do banco (parte 4):**

- a correção estruturada (o dado, como está e como deve ficar; aceitar aplica sozinho);
- a conferência do pedido de associação item por item, com o selo em cada item e "Mandar para a AGO" só com tudo aprovado.

**Verificação:**

- testes de unidade: `testes/unidade/menu.test.ts` (a função acesa por endereço, as subfunções, quem vê cada função, as iniciais e o nº com quatro algarismos);
- ponta a ponta: `testes/e2e/menu-modulo.spec.ts` (computador e celular: as funções do módulo, a função aberta marcada, a volta ao Início, as subfunções em sanfona e o que o ministro vê) e os testes antigos ajustados às funções (financeiro, caixa, prestação, patrimônio) e à ficha em abas (cadastros, credencial, pedido, configurações, portal, portal-ministro).

## Entrega 5.5.7 — Telas novas, parte 4: a correção estruturada e a análise do pedido item por item (versão 5.5.0-teste.8)

O banco que as telas aprovadas pediam (migração `20261118150000_correcao_e_conferencia.sql`).

**O que entrou:**

- **Correção estruturada no cadastro** (observação do usuário na rodada 5: "nada de texto livre, porque a pessoa digita errado"):
  - `pedidos_correcao` ganhou o **dado** (lista fechada: nome completo, telefone, e-mail, CPF, nome da mãe, nome do pai, título ministerial, função na igreja e igreja), **como está** (o banco preenche, não a tela) e **como deve ficar**. No título e na igreja, o "como deve ficar" se escolhe na lista;
  - **aceita, a correção entra sozinha no cadastro** (o título novo entra no histórico; a igreja certa entra hoje, com a mesma função, e a anterior fica no histórico, como na troca); recusada, volta com o motivo;
  - o pedido em texto livre deixou de ser aceito pela API (`pedir_correcao` sem permissão); os pedidos antigos, em texto, continuam na lista e se respondem como antes ("Atendido");
  - **Meu perfil › Correções**: o ministro escolhe o dado, vê como está e diz como deve ficar;
  - **Minha igreja › Ministros**: o pastor presidente pede do mesmo jeito para os ministros da igreja dele;
  - **Ministros e inscrições › Correções pedidas**: "como está → como deve ficar", com Aceitar e Recusar (com o motivo).
- **O pedido de associação conferido item por item** (tabela nova `pedidos_associacao_itens`):
  - os itens: **dados pessoais, igreja e título, foto 3×4 e o comprovante do título**, cada um em análise, aprovado ou recusado com o motivo;
  - a secretaria confere na **Análise do pedido** (desenho aprovado): o candidato no alto com a barra "x de 4 conferidos", os itens com Aprovar e Recusar (e "Mudar" depois de decidido), os passos e, ao lado, "Mandar para a AGO", que **só se libera com todos aprovados** (o banco também confere), "Devolver ao candidato" (com o motivo de cada item recusado) e "Recusar o pedido";
  - o candidato vê **o selo em cada item** em Meu pedido, com o motivo do que voltou, e **envia de novo só o que foi recusado** (o formulário mostra só essas partes e as declarações);
  - ao reenviar, o item recusado volta para a análise; o que estava aprovado e o candidato mudou (a foto, o comprovante, a igreja ou o título) também volta.

**Decisões tomadas sem perguntar:**

- **CPF e filiação** entram na lista, mas só a própria pessoa pede a correção, e o pastor presidente não vê esses pedidos (dado pessoal: só a pessoa e a secretaria).
- **E-mail:** só de quem ainda não entra no sistema. O e-mail de quem tem login é o do login e não se troca por aqui.
- **Ninguém aceita a correção do próprio cadastro**, nem confere o próprio pedido de associação (a mesma regra de "ninguém decide o próprio pedido").
- **Um pedido pendente por dado:** o mesmo dado não fica esperando a secretaria duas vezes; pedir o valor que já está no cadastro é recusado.
- **Igreja errada × troca de igreja:** a correção da igreja é para cadastro errado; quem mudou de igreja continua usando o pedido de troca, com a data.
- **Pedidos já aceitos antes da parte 4** (esperando a AGO ou aprovados) contam com os quatro itens aprovados (a migração registra isso, com o diretor que aceitou).
- **"Devolver ao candidato"** só se libera com algum item recusado; a mensagem para o candidato é montada com o motivo de cada item.
- **Itens fixos:** quatro (o pedido tem uma foto e um comprovante). Se um dia o pedido tiver mais documentos, a lista cresce em `interno.itens_do_pedido()` e nas telas (`ITENS_DO_PEDIDO`).
- **Regra nova do usuário (18/11/2026): todo ministro é ligado a uma igreja.** O banco já exigia a igreja no cadastro e no pedido; as telas agora dizem isso.

**Verificação:**

- testes do banco: `testes/banco/correcao_estruturada.test.ts` (11 testes: a lista fechada, o texto livre recusado, como está e como deve ficar, quem pede, quem lê (RLS, inclusive o CPF), aceitar que aplica (telefone, título, CPF, nome, e-mail, igreja), recusar com motivo, o próprio cadastro e nada se apaga) e `testes/banco/pedido_itens.test.ts` (9 testes: quem confere, o motivo, a situação de cada item, "Mandar para a AGO" só com tudo aprovado, quem lê, o reenvio que devolve à análise, o próprio pedido e nada se apaga). Os testes antigos do pedido, da segurança e da igreja ajustados à conferência e à correção estruturada;
- ponta a ponta: `pedido.spec` (a presidência aprova e recusa item por item, devolve; o candidato vê o selo e reenvia só a foto; a presidência aprova o resto e manda para a AGO) e `portal-ministro.spec` (o pastor presidente pede a correção do título; a presidência aceita e o título novo aparece na ficha).

**Correção depois da integração (18/11/2026):** a publicação da main com a parte 4 parou em dois testes dos perfis de acesso, só no celular. Não era a parte 4: a tela "Perfis de acesso" buscava as pessoas de uma vez, e o servidor devolve no máximo mil linhas. O banco de teste passou de mil pessoas (1.478, a maioria criada pelos próprios testes), e quem vinha depois na ordem alfabética sumia da lista. A lista agora vem de mil em mil (`listarPessoasComPerfis`, com `todasAsLinhas`). E, como desenhar as 1.478 deixava a tela lenta (os testes passavam perto do limite de tempo), a tela mostra sem busca só quem já tem algum perfil e, com busca, até 50 pessoas.

## Entrega 5.5.8 — Telas novas, parte 5: o banco da regularização e as telas da secretaria (versão 5.5.0-teste.9)

O lote das Igrejas e da regularização (rodadas 8 a 14, aprovadas em 18/11/2026; as regras de negócio estão no `PROJETO.md`, seção 4.3). Migrações `20261119100000_regularizacao_tipos.sql` (o tipo novo de documento, o alvará) e `20261119100100_regularizacao_igrejas.sql`.

**O que entrou no banco:**

- **A igreja** ganhou o cadastro (completo, sem registro ou em análise), a natureza jurídica (e o prazo da associação privada), o ano de fundação, os membros (aproximado), o CEP, o e-mail, o site, a convenção e quem a cadastrou. A **denominação** ganhou a tradição (lista fechada de 10).
- **Os documentos** (`igreja_documentos`): o alvará de licenciamento; a validade (de quando até quando); a natureza do Cartão CNPJ; a ata que muda a natureza. Nada se substitui: o documento que vale hoje se calcula pelas datas, e o histórico fica. Só o que espera a conferência é trocado pelo novo (e fica guardado).
- **As partes** (`igreja_documento_partes`): até 20 arquivos de até 25 MB cada (o limite da pasta subiu de 5 para 25 MB). Os documentos antigos viraram documentos de uma parte.
- **A diretoria vai com a ata** (`igreja_diretoria`): cada cargo com o ministro associado ou o nome completo, e a posse e o fim de cada cargo. A ata vale do primeiro dia da diretoria até o **menor mandato**; mandato sem prazo não entra, e mais de 20 anos também não.
- **A igreja nova cadastrada pelo pastor** (`igreja_analise_itens`): os dados, o endereço e contato e a diretoria se conferem item por item; os documentos, um a um. "Ativar a igreja" só com tudo aprovado; ativada, o pastor que cadastrou vira o pastor presidente dela.
- **As filiais** (`igreja_filiais`): congregação, ponto de culto ou célula, o bairro, o responsável (ministro associado da igreja) e a localização opcional.
- **As regras** (`config_igrejas`, só a presidência muda): o fim da transição (28/04/2027), os 30 dias para mandar o documento vencido e os 90 dias do Cartão CNPJ novo.
- **O empréstimo do patrimônio** só para a igreja regular, também quando a secretaria pede; e a secretaria (ou a presidência) **registra direto**, já aprovado (a agenda da igreja).

**Por que a situação é calculada na leitura (e não por uma rotina):**

- A situação (`interno.situacao_igreja`) se calcula toda vez que alguém olha, pela data do dia, como o mandato da diretoria do COMEP já era calculado (`interno.fim_efetivo`). Assim a **suspensão no dia**, o **fim dos 30 dias** e a **entrada do documento antecipado** acontecem sozinhos, sem ninguém clicar e sem uma rotina agendada (o plano gratuito não garante o `pg_cron`, e uma rotina que falha num dia deixaria a igreja errada).
- O perfil de pastor presidente segue a situação: `tenho_perfil` e `meus_perfis` tiram o perfil quando o pastor está bloqueado, e ele volta sozinho quando a igreja se regulariza. As "igrejas que eu presido" passaram a ser só as regulares (todos os direitos); a suspensa, nos 30 dias, só manda e lê os documentos e a diretoria (`interno.igrejas_que_cuido`).

**As telas da secretaria (módulo Igrejas, no menu do módulo):**

- **Igrejas** (o painel, opção 3 da rodada 12): os números grandes (regulares, suspensas, sem registro, filiais), quem precisa de atenção e as sem registro para chamar para perto. As subfunções **Todas, Regulares, Suspensas e Sem registro** abrem a tabela (opção 1), com a situação e o que falta de cada igreja.
- **Para conferir**: as igrejas novas (com a barra "x de N conferidos") e os documentos mandados pelos pastores (Conferir e Recusar com o motivo).
- **A análise da igreja nova**, item por item, com "Ativar a igreja".
- **Central de regularização**: as suspensas com a contagem dos 30 dias, o que vence em 60 dias, a associação privada com o prazo, o que falta da transição, as sem registro e as regras.
- **Cadastrar igreja**: "a igreja tem registro?"; sim, os 5 passos (dados com a natureza, endereço e contato, pastor e diretoria com o mandato, documentos em partes, revisar); ainda não, o cadastro simples com as limitações.
- **A igreja em abas**: Dados, Documentos (a secretaria confere e também manda pela igreja), Diretoria (a mudança para conferir, como estava e como fica; a em vigor; a próxima já conferida), Ministros, Filiais, Agenda (o empréstimo registrado direto) e Situação (o nível, o que falta, regularizar a sem registro e arquivar).
- **Denominações** (saíram de Configurações), com a tradição.
- No pastor presidente, até a parte 6: a Minha igreja manda os documentos com as partes e a validade, e a diretoria com a ata.

**Decisões tomadas sem o desenho:**

- **As datas**: o documento "vale até D" vale no dia D; a igreja fica suspensa a partir de D+1 (o desenho: "venceu em 31/12, suspensa desde 01/01"). Os 30 dias vão até D+30; o perfil é bloqueado a partir de D+31.
- **"Mandou dentro dos 30 dias"** = há um documento do mesmo tipo esperando a conferência. Se a secretaria recusar depois do prazo, o perfil é bloqueado. Bloqueado, só a secretaria manda o documento pela igreja.
- **Suspensa, o pastor não faz mais nada pela igreja** (empréstimo, correções dos ministros, contato, filiais): o banco só deixa mandar e ler os documentos e a diretoria.
- **A natureza jurídica vencida** funciona como o documento vencido: suspensa no mesmo dia, 30 dias para o Cartão CNPJ novo e, depois, o perfil bloqueado. Assim a igreja fica com as limitações da sem registro (sem empréstimo, e o perfil acaba), mas o pastor ainda manda o cartão pela própria aba.
- **A transição**: o documento que nunca veio não suspende até 28/04/2027 (a igreja aparece regular, com "faltam … (até 28/04/2027)"). A igreja cadastrada depois disso, sem o documento, fica suspensa desde o cadastro, com os 30 dias. Nos testes do banco (`testes/banco/ambiente.ts`) a transição fica aberta, para os testes antigos (igrejas sem documentos) não quebrarem com a passagem do tempo.
- **O alvará** entrou no cadastro como o 4º documento (o desenho da rodada 9 tinha três). Ele vale para ser regular, mas o cadastro termina sem ele (e sem os outros): a tela avisa e eles vão depois, na ficha.
- **O documento mandado pela secretaria (ou pela presidência) já entra conferido**, menos quando ela preside aquela igreja. Ninguém confere o documento que mandou.
- **O pastor presidente escolhido no cadastro** (ministro associado) passa a ser ligado à igreja nova; o vínculo anterior termina hoje e fica no histórico. Se ele já é pastor presidente de outra igreja, o banco recusa.
- **A diretoria informada antes desta parte** (sem ata) aparece como "informada antes" e não dá validade: é preciso registrar a ata.
- **O fim do mandato** = a posse mais os anos, menos um dia (posse 01/01/2025, 4 anos: até 31/12/2028).
- **Igreja sem registro**: o banco recusa marcar um pastor presidente nela (assim a contribuição fica a do ministro comum); os ministros dela podem ser ligados. Ela também é arquivada pela aba Situação.
- **Arquivar a igreja** só sem ministros (a tela pede para movê-los antes, na ficha de cada um).
- **Filiais**: só a igreja com registro tem; o nome não se repete na igreja; o responsável é ministro associado **da igreja**.
- **A Central de regularização** ficou sem o "registrar conversa" com a igreja sem registro (o desenho da opção 2 tinha): fica para quando houver onde guardar as conversas.
- **"Para conferir"**: os documentos da igreja nova se conferem na análise dela, e não na lista geral.
- **Configurações › Denominações** virou um aviso com o link para o módulo Igrejas.
- **O texto da situação** na tabela fica curto ("faltam 5 itens (até 28/04/2027)"); a lista do que falta aparece na aba Situação.

**O que fica para a parte 6:** as telas do pastor presidente (os documentos em cartões e a página do documento com o envio antecipado, a igreja suspensa com o caminho de volta, a aba Filiais, o cadastro da igreja pelo próprio pastor e os avisos de 60 e 30 dias no sino).

**Verificação:**

- testes do banco: `testes/banco/regularizacao.test.ts` (35 testes). Cobrem:
  - a situação pela data: regular; o alvará vencido ontem (suspensa hoje, com os 30 dias, e o perfil ainda valendo só para mandar); 31 dias depois, o perfil bloqueado (e o `meus_perfis` só com "ministro"); a secretaria manda o alvará e o perfil volta; quem mandou dentro do prazo não é bloqueado;
  - o documento antecipado: conferido, emenda no atual; no dia em que o atual vence, o seguinte já vale; com um dia de buraco, suspensa;
  - o menor mandato, as partes, os 25 MB e as recusas (sem prazo, mais de 20 anos, nome incompleto, ministro que não é associado);
  - a natureza jurídica (o prazo do primeiro mandato, os 90 dias da ata que muda, o cartão novo, a mudança na ficha e o prazo vencido);
  - a transição; a igreja sem registro (sem empréstimo, sem pastor presidente, regularizar); o cadastro completo (o pastor presidente que passa para a igreja nova, CNPJ e sigla repetidos);
  - a igreja nova do pastor (em análise, um de cada vez, ninguém se liga a ela, os documentos, a conferência item por item, a correção do que voltou e "Ativar a igreja");
  - ninguém confere o que mandou; as filiais (quem cria e quem vê); a tradição; o empréstimo registrado direto; quem lê a situação e as partes; nada se apaga;
- os testes antigos da igreja (`igreja_instituicao.test.ts`) passaram para o envio novo (com as partes) e para a diretoria com a ata;
- testes de unidade: `testes/unidade/regularizacao.test.ts` (o fim do mandato, o menor mandato, os prazos, o tamanho do arquivo e a localização tirada do link do Google Maps);
- no total, 557 testes (banco e unidade), todos passando;
- ponta a ponta: `igrejas.spec` (o painel, a tabela por situação, a Central de regularização, a igreja sem registro e a tradição), `cadastros.spec` (o cadastro em 5 passos, a ficha e o arquivamento), `configuracoes.spec` e `portal-ministro.spec` (o estatuto em 2 partes, a ata com a diretoria e o mandato, a conferência da mudança da diretoria);
- o verificador do Supabase (`db advisors`) no comep-teste: só o aviso conhecido (`auth_leaked_password_protection`).

## Entrega 5.5.9 — Telas novas, parte 6: as telas do pastor presidente (versão 5.5.0-teste.10)

As telas do pastor presidente do lote das Igrejas e da regularização (rodadas 9, 12, 13 e 14). Migração `20261119140000_regularizacao_historico.sql`.

**O que entrou:**

- **Minha igreja › Documentos em cartões** (opção 2 da rodada 12): o estatuto, o Cartão CNPJ, a ata da diretoria e o alvará, cada um com o selo da secretaria, o que ele diz (a natureza, o mandato, a validade), a **barra do prazo** e "faltam N dias" (em amarelo nos últimos 60). Quando o seguinte já foi conferido: "O próximo já foi conferido: entra sozinho em 01/01". Embaixo, os outros documentos.
- **A página do documento** (o cartão abre; rodada 14), em abas com endereço próprio:
  - **O atual**: o período, a natureza, quando foi conferido e o arquivo (as partes);
  - **Atualizar (próximo)**: o **passo a passo do envio antecipado** (rodada 13, opção 3), com a faixa da dica de governança: 1 o arquivo, 2 as datas novas (o alvará começa no dia seguinte ao fim do atual; a ata traz a diretoria atual para mudar só quem mudou) e 3 conferir e mandar ("fica guardado e entra sozinho em…");
  - **Histórico**: todos os do tipo (em vigor, próximo, anterior, esperando a conferência, recusado), com os arquivos.
- **A igreja suspensa** (opção 3 da rodada 12, "o caminho de volta"): os 3 passos (mande, a secretaria confere, a igreja volta a ser regular), o lugar para **mandar o documento vencido** ("Mande aqui o alvará", "Mande aqui a ata nova"), a **contagem dos 30 dias**, o porquê, o que está bloqueado (com o dia em que o perfil é bloqueado) e a dica de governança. Enquanto a igreja está suspensa, a Minha igreja mostra só isso.
- **A aba Filiais** (opção 2: os cartões), com o filtro por tipo, "Nova filial", editar e arquivar; o responsável é escolhido entre os ministros da igreja; a localização sai do link do Google Maps colado.
- **O cadastro da igreja pelo próprio pastor** (rodada 9): o **convite no Início** do ministro que ainda não preside uma igreja no COMEP; os mesmos 5 passos da secretaria (ele é o pastor presidente); e o **acompanhamento** (`/cadastrar-minha-igreja`) com o selo da secretaria em cada item, o motivo do que voltou e "Enviar de novo" só no que voltou. Ativada a igreja, ele vira o pastor presidente. A secretaria também pode **recusar o cadastro** (arquivar), na análise.
- **Os avisos de 60 e 30 dias antes, no sino** (com o que já existe: a tabela de notificações ainda não existe): o documento que vence primeiro avisa aos 60 dias e de novo aos 30 (o aviso dos 30 é outro, então volta a aparecer como novo); a igreja suspensa e o item que voltou da análise também avisam. No Início, em "Para você", a suspensão (o primeiro item, em vermelho), o vencimento dos próximos 60 dias e a igreja em análise.
- **O histórico** (migração): a secretaria (e a presidência) registram também o documento que já venceu — o alvará do ano passado, a ata da diretoria anterior —, que entra conferido e conta para a situação. O pastor continua mandando só o que vale agora ou o seguinte.

**Decisões tomadas sem o desenho:**

- **O convite no Início** aparece para todo ministro associado que não preside uma igreja no COMEP, com "Não sou pastor presidente" para fechar (fica guardado no aparelho). O desenho mostrava só o caso do pastor; o sistema não sabe, sozinho, quem é pastor de uma igreja que ainda não está cadastrada.
- **O endereço do cadastro pelo pastor** é `/cadastrar-minha-igreja` (a Minha igreja é do perfil de pastor presidente, que ele ainda não tem). Ativada a igreja, ele passa para a Minha igreja.
- **Suspensa, a lista dos ministros da igreja não abre** (o banco tira do pastor tudo, menos os documentos): na ata nova, as opções de "ministro" são os que já estavam na diretoria; os outros entram pelo nome completo.
- **"Enviar de novo" a diretoria** manda a ata de novo, com a diretoria (a diretoria vai sempre com a ata).
- **O alvará**: no envio de agora, vale de hoje até 31/12; no antecipado, do dia seguinte ao fim do atual até 31/12 do ano seguinte (as duas datas se mudam).
- **Os avisos dos 60 e 30 dias** contam o que vence primeiro (o alvará, a ata, o prazo da natureza ou o fim da transição); o documento seguinte já conferido "emenda" e tira o aviso.
- **A barra do prazo** mostra quanto do período do documento já passou.

**Verificação:**

- testes do banco: `testes/banco/regularizacao.test.ts` ganhou o teste do histórico (a secretaria registra o alvará vencido, conferido, e a igreja fica suspensa; pelo pastor, recusado; a ata anterior também entra) e o dos ajudantes internos fechados para quem tem login;
- no total, 561 testes (banco e unidade), todos passando (o `regularizacao.test.ts` do banco com 37 e o de unidade com 9);
- ponta a ponta: `testes/e2e/regularizacao.spec.ts`:
  - **a suspensão**: a presidência registra pela igreja o alvará que venceu ontem; a igreja fica suspensa hoje; o pastor vê o aviso no Início e, na Minha igreja, o caminho de volta com "30 dias para mandar"; manda o alvará novo; a presidência confere e a igreja volta a ser regular;
  - **o envio antecipado**: o cartão do alvará abre a página do documento; o passo a passo do "Atualizar" já traz 01/01 a 31/12 do ano seguinte e diz que "entra sozinho"; a presidência confere e o cartão mostra "O próximo já foi conferido: entra sozinho em 01/01";
  - **o cadastro pelo pastor**: o convite no Início, os 5 passos com os documentos, a conferência item por item (um item recusado, mandado de novo só ele), "Ativar a igreja" e a Minha igreja do pastor;
  - e o `portal-ministro.spec` passou para os cartões (o estatuto em 2 partes pelo passo a passo do "Atualizar", e o histórico com as partes).

## Entrega 5.5.10 — Telas novas, parte 7: os modelos da credencial e o módulo Credenciais (versão 5.5.0-teste.11)

O lote das Credenciais (rodadas 7 a 12, aprovadas em 18/11/2026; as regras de negócio estão no `PROJETO.md`, seção 4.5). Migração `20261119170000_credencial_modelos.sql`.

**O que entrou no banco:**

- **Os modelos** (`credencial_modelos`): nome, descrição, tipo (padrão, de grupo, exclusivo de igreja ou de readequação), a **ordem** (prioridade), a regra de **quem recebe** (as condições, com **todas** ou **qualquer uma**), o desenho em uso (uma versão) e se está **em uso** ou é rascunho. As versões do desenho (`modelos_credencial`) ganharam o modelo a que pertencem e continuam sem mudar nem se apagar.
- **A migração não quebra nada**: o desenho em uso de antes virou o **modelo padrão**; as versões já salvas ficaram com ele; as funções antigas (`salvar_modelo_credencial`, `usar_modelo_credencial`, `arquivar_modelo_credencial`) passaram a mexer no padrão; `dados_credenciais` continua trazendo `modelo` (o do padrão) e ganhou, por pessoa, o `modelo_id`, a readequação, o prazo e o cargo, e o mapa `modelos` com o desenho de cada modelo usado.
- **A escolha** (`interno.escolher_modelo`, calculada na leitura, como a situação da igreja): o ministro em readequação recebe **sempre** o modelo de readequação; depois, o primeiro modelo da ordem, em uso, cuja regra serve; o exclusivo só depois de pago e só para os ministros da igreja; sem nenhum, o padrão.
- **As condições** (conferidas por `interno.normalizar_regra`): cargo na diretoria (mandato vigente no dia), título, tempo de COMEP (pela data de admissão), pastor presidente, jubilado, comissão (sem escolher = qualquer comissão), forma de admissão, igreja, denominação, tradição, entre duas datas e só durante o mandato. No máximo 12 por modelo, sem repetir.
- **O modelo exclusivo**: a igreja (com registro), o valor, quem pediu e o pagamento (data e a entrada do caixa, opcional), registrado pela tesouraria ou pela presidência.
- **A readequação**: o prazo (`config_igrejas.readequacao_ate`, 28/04/2027, só a presidência muda, na Central de regularização); a validação pública (`validar_credencial`, que o visitante usa) só ganhou dois campos: `readequacao` e `prazo_readequacao`. Na lista das pendências da credencial, a igreja sem registro não aparece mais como "Igreja sem CNPJ".
- **As leituras**: `painel_modelos` (a galeria, com quantas pessoas recebem hoje), `simular_quem_recebe` (quem receberia com a regra da tela, antes de salvar, e quantos ficam com um modelo de cima) e `lista_credenciais` (a lista do módulo, com em dia, readequação e o modelo de cada um).

**As telas (módulo Credenciais, no menu da coluna: Credenciais, Imprimir, Modelos, Validade e verso):**

- **Credenciais** (rodada 7, aprovada como está): a tabela com a caixinha de quem vai para a impressão, a busca, os filtros (todas, completas, com pendência e, quando houver, em readequação) e a situação de cada uma ("Válida até…", "Válida · em atraso", "Falta a foto", "Em readequação"); embaixo do nome, o modelo da pessoa.
- **Validade e verso** (rodada 7, como está): saiu de Configurações (que agora leva lá). A validade, corrigir a data e registrar a posse; o texto do verso, com a prévia.
- **Modelos** (rodada 8): a galeria, com a ordem, "Em uso" ou "Rascunho", a prévia, quantas pessoas, "Quem recebe", "Duplicar" e "Editar"; "Começar de um modelo pronto" (clássico vermelho, grafite e dourado, azul institucional, vinho com selo, em branco), para um grupo ou exclusivo de uma igreja.
- **Quem recebe** (rodada 9): a ordem dos modelos à esquerda (arrastar ou as setas), as condições no meio (todas ou qualquer uma, em grupos: da pessoa, da igreja e do tempo), o bloco do exclusivo (igreja, quem pediu, valor, pagamento e a entrada do caixa) e, à direita, quem recebe hoje (ou como vai ficar), com a prévia.
- **O editor na tela inteira** (rodada 8, opção 1): a barra vermelha (voltar, o nome, frente e verso, desfazer, o zoom, "Ver com", testar a impressão e "Salvar e usar"), o trilho (Prontos, Textos, Dados, Imagens, Formas, Fundo, Camadas e Versões), o cartão com as réguas e as guias de corte, sangria e área segura, e à direita "Item" e "Cartão" (o tamanho em mm, os cantos, a sangria e a área segura).
- **A credencial do ministro em readequação** (rodada 12, opção 1): o desenho do sistema para o modelo de readequação, cinza, com a faixa listrada no rodapé ("Em readequação · sem direito a voto"), "{igreja} · sem registro" e o prazo. Cada credencial (a minha, a de um ministro e a impressão) sai no modelo da pessoa.

**Decisões tomadas sem o desenho:**

- **O pagamento do exclusivo é da tesouraria ou da presidência** (é dinheiro, como a confirmação dos comprovantes); a secretaria vê a situação. A ligação ao caixa é a mais simples e segura com o que existe: a tesouraria lança a entrada no Caixa (como qualquer receita) e liga a entrada ao modelo, como o patrimônio já liga a compra. A tesouraria ainda não abre o módulo Credenciais: por enquanto quem registra na tela é a presidência; quando o Financeiro novo chegar, o pagamento entra lá também.
- **O exclusivo vale só depois de pago.** Antes, a tela mostra "Falta o pagamento" e quem vai receber depois de pago.
- **Sem condição, ninguém recebe** o modelo de grupo (para um modelo novo não tomar o lugar do padrão de todo mundo por engano).
- **"Só durante o mandato"** guarda a data do fim do mandato do dia em que se salvou: a posse da diretoria seguinte não estica o modelo.
- **O cargo na diretoria** já é "enquanto durar o mandato": saiu do cargo, a próxima credencial sai no modelo seguinte (a impressa vale até a validade dela).
- **O modelo de readequação** vale antes de todos (o readequado nunca recebe outro, nem o da diretoria), mas aparece no fim da lista da ordem, como no desenho ("fica no fim e não pode ser trocado").
- **O rascunho** fica com o último desenho salvo (mesmo sem "usar"), para a galeria mostrar o que está sendo feito; o modelo em uso só muda com "Usar".
- **Duplicar** cria um rascunho de grupo com a mesma regra e o mesmo desenho (o exclusivo duplicado vira de grupo, sem a igreja).
- **Versões** entrou como mais um item do trilho do editor (o desenho não mostrava onde ficavam as versões salvas): abrir, usar e arquivar.
- **A faixa de aviso** virou um item do editor (Formas e Textos › "Faixa de aviso"), com os botões "onde vai a faixa" (rodapé, topo, esquerda, direita); em pé, o texto fica na vertical.
- **A ordem** se muda arrastando ou pelas setas (subir e descer), para quem usa o teclado.
- **Mudou o tamanho do cartão**, os itens acompanham na mesma proporção, e a faixa continua no lado dela.
- **A marca d'água** é o símbolo do COMEP; a biblioteca de símbolos e os logotipos das denominações chegam na parte 8.
- **As letras do editor**: Plus Jakarta Sans (só negrito, como nos títulos do sistema), Inter, a sem serifa do aparelho e a com serifa.

**O que fica para a parte 8:** a impressão nova (4 por folha, espaço, sangria, marcas fora da sangria, vagas em branco, folha nova ou pedaço cortado), a biblioteca de símbolos (gerais e por tradição) com os logotipos das denominações e as regras obrigatório, padrão e opcional, e a faixa da readequação na conferência pelo QR Code.

**Verificação:**

- testes do banco: `testes/banco/credencial_modelos.test.ts` (11 testes): a migração (o padrão com o desenho de antes e a readequação); o RLS (a secretaria, a presidência e a tesouraria leem; o ministro e o visitante, não; ninguém grava direto; nada se apaga); a regra conferida; a ordem (o primeiro que serve, rascunho não conta, reordenar); todas ou qualquer uma e a simulação; as outras condições; o exclusivo (só os da igreja, só depois de pago, quem registra o pagamento, a entrada do caixa, a igreja e o valor que não mudam depois); o readequado sempre com o modelo dele (e a lista e os dados da credencial com a categoria e o prazo); a validação pública continua (sem login) e mostra a readequação; as versões de cada modelo; e as funções antigas no padrão. Os testes antigos do modelo (`credencial_modelo.test.ts`) continuam passando sem mudança;
- testes de unidade: `testes/unidade/modeloCredencial.test.ts` ganhou o tamanho do cartão, o desenho da readequação (sem a frase proibida), a faixa nos quatro lados, os modelos prontos, o desenho de cada credencial e os dados novos;
- no total, 578 testes (banco e unidade), todos passando;
- ponta a ponta: `credencial-modelo.spec` (refeito: criar de um modelo pronto, o editor na tela inteira no computador, quem recebe com a igreja fictícia, a ordem, a credencial de um ministro no modelo novo e arquivar; no celular, o aviso do editor e "Pôr em uso"), `configuracoes.spec` (Validade e verso) e os da credencial, das igrejas, da diretoria e do menu, verdes no computador e no celular;
- o verificador do Supabase (`db advisors`) no comep-teste: só o aviso conhecido (`auth_leaked_password_protection`).

## Entrega 5.5.11 — Telas novas, parte 8: a impressão nova, os símbolos e a readequação na conferência (versão 5.5.0-teste.12)

O fim do lote das Credenciais (rodadas 8 a 12; as regras estão no `PROJETO.md`, seção 4.5). Migração `20261119200000_credencial_logotipos.sql`.

**O que entrou:**

- **A impressão nova** (Credenciais › Imprimir; rodadas 8 a 11, `imprimir-4` com os ajustes de `imprimir-2` e `imprimir-3`): só lado a lado, para dobrar; **4 por folha A4**, com **5 mm de espaço** entre as credenciais e **2 mm de sangria** (o fundo e o que encosta na borda passam do corte nos lados de fora; na dobra, não); as **marcas de corte fora da sangria** e a dobra marcada tracejada em cima e embaixo. Começa **sempre no alto**: as vagas que sobram saem em branco, sem a palavra "livre" e sem marcas. "Tem um pedaço de folha que sobrou?": **Não** (só folhas A4) ou **Sim** (cabem 1, 2 ou 3 no pedaço; 2 = meia folha, A5 deitada): as primeiras vão no pedaço e o resto em folhas inteiras. Ao lado, "Como imprimir" com as marcadas, o que vai no pedaço e nas folhas, o papel e o botão. A conta das folhas fica em `src/utilitarios/impressao.ts`.
- **A biblioteca de símbolos** (rodadas 10 e 11): desenhos **próprios em SVG** (`src/utilitarios/simbolos.ts`), nunca emojis: os 12 gerais da fé e os de cada tradição — pentecostal, quadrangular, neopentecostal, batista, reformada e presbiteriana, metodista e wesleyana, luterana, anglicana, adventista e congregacional (as denominações grandes de cada uma aparecem como exemplo). No editor, o trilho ganhou **Símbolos** (com a busca) e a marca d'água pode ser um símbolo da biblioteca, com a cor.
- **Credenciais › Símbolos**: a biblioteca e os **logotipos das denominações**. O logotipo oficial é de cada denominação: a secretaria **envia o arquivo que a denominação fornecer** (o sistema não copia logotipos da internet). No modelo, o item "logotipo da denominação" mostra, em cada credencial, o da denominação da igreja da pessoa (sem logotipo, o lugar fica vazio; no editor, tracejado).
- **As regras do modelo** (rodada 11): no editor, **Regras** mostra o que é **obrigatório** (não sai: nome, nº de registro, validade, QR Code, foto e o nome e o símbolo do COMEP), o que é **padrão** e o que é **opcional**; cada item mostra o papel dele em Camadas e na aba Item. O obrigatório não sai ("Tirar da credencial" desligado e o Delete recusado), a não ser que haja outro igual na frente ou no verso. No verso aparece "verso: área livre".
- **A readequação na conferência pelo QR** (rodada 12, opção 1): a página de validação mostra a credencial **cinza com a faixa de aviso** ("Em readequação · sem direito a voto · prazo até 28/04/2027"), "Credencial válida — ministro em readequação", a igreja "(sem registro)", a situação ("participa, mas não vota") e o prazo. A Minha credencial e a credencial aberta pela secretaria também mostram a situação de readequação.

**Decisões tomadas sem o desenho:**

- **O pedaço e as folhas se imprimem à parte** ("Imprimir o pedaço" e "Imprimir a folha"), porque vão em papéis diferentes na impressora; com só o pedaço ou só folhas, um botão só. O pedaço de 1 e o de 3 usam papel de tamanho personalizado (210 × 74,25 mm e 210 × 222,75 mm: um quarto e três quartos da A4).
- **Modelos de tamanhos diferentes** na mesma impressão: a folha leva quantos couberem pela altura (no máximo 4); o crachá em pé leva 3.
- **A sangria** estica o fundo do lado e o que encosta na borda (faixas, formas, imagem que cobre, a faixa de aviso), nunca os textos, o QR Code, a foto e os símbolos.
- **"+ Enviar símbolo"** (o desenho tinha) ficou de fora: um símbolo enviado seria uma imagem qualquer, e a imagem já entra pelo editor (Imagens › Enviar uma imagem); a biblioteca é só de desenhos próprios.
- **Os símbolos das tradições que o desenho não trazia** (neopentecostal, anglicana, adventista e congregacional) são desenhos novos e genéricos (cruz com o círculo, Bíblia aberta, trombeta, lâmpada acesa), nunca o logotipo de uma denominação.
- **No celular**, a impressão avisa que é feita no computador (rodada 7), mas continua mostrando como vai ficar; o editor só avisa.

**Verificação:**

- testes do banco: `testes/banco/credencial_logotipos.test.ts` (4 testes): sem logotipo, a credencial não traz nenhum; só a secretaria (ou a presidência) envia, e o arquivo precisa estar na pasta do modelo; a credencial de cada pessoa traz o logotipo da denominação da igreja dela; ninguém muda o logotipo direto na tabela;
- testes de unidade: `testes/unidade/impressao.test.ts` (5 testes: 4 por folha com o espaço, a sangria e as margens; sempre do alto; o pedaço; o papel do pedaço; o crachá em pé);
- no total, 587 testes (banco e unidade), todos passando;
- ponta a ponta: `credencial-impressao.spec` (novo: imprimir 2 num pedaço já cortado, com as medidas no papel — 9 mm entre os cortes, a dobra sem espaço, 85,6 mm, 16 marcas de corte, 4 da dobra e 4 sangrias — e, com 1 no pedaço, a outra na folha; e a credencial do ministro de uma igreja sem registro, cinza, com a faixa, conferida pelo QR sem login, com o prazo e sem a frase proibida) e `credencial-modelo.spec` (o símbolo da biblioteca no editor, o obrigatório que não sai, as regras e a página Credenciais › Símbolos);
- o verificador do Supabase (`db advisors`) no comep-teste: só o aviso conhecido (`auth_leaked_password_protection`).

## Entrega 5.5.12 — Telas novas, parte 9: o Financeiro nas 6 funções (versão 5.5.0-teste.13)

O lote do Financeiro (rodadas 9 a 11, aprovadas em 18/11/2026; as regras estão no `PROJETO.md`, seção 4.4). Migração `20261119220000_financeiro_telas.sql`.

**As telas (módulo Financeiro, no menu da coluna, cada função com as subfunções em sanfona):**

- **Contribuições** (opção 3, o painel e quem precisa de atenção): os três medidores (em dia de quem paga, recebido no exercício, em aberto), "Precisam de atenção" (o comprovante para conferir e quem está em atraso, com "Conferir" ou "Registrar pagamento recebido"), "Por igreja" (quantos estão em dia) e "Todos os ministros", com a busca. Subfunções: **Por igreja** (a tabela do exercício), **Cobranças do ano** (gerar as cobranças) e **Valores e planos** (quem escolheu a anuidade, os valores, a taxa de inscrição e os vencimentos).
- **Comprovantes** (opção 1, a lista): o pagamento informado, o comprovante ao lado, "Recusar" (com o motivo) e "Confirmar". Subfunção **Já conferidos**.
- **Caixa** (opção 2, o extrato): os lançamentos do mês por dia, com o saldo depois de cada linha, o saldo no começo e no fim do mês, o mês anterior e o seguinte; à direita, o saldo de hoje por conta e os botões "+ Lançar entrada", "− Lançar despesa" e "Transferência entre contas". Subfunções: **Contas e saldos** e **Transferências**.
- **Despesas a autorizar** (opção 1, os cartões): a categoria, "Esperando você" (ou "Esperando o presidente"), o valor, quem lançou, o comprovante, "Recusar" e "Autorizar"; embaixo, as autorizadas no mês. Subfunções: **Autorizadas** e **Recusadas**.
- **Orçamento** (opção 2, os cartões por categoria): a situação (ainda não preparado, rascunho, na assembleia ou aprovado), "Plano anual de trabalho" e "Mandar para a assembleia"; os cartões de receitas e de despesas, com a barra do ano de referência e o previsto; o resultado previsto. Subfunção **Plano anual de trabalho**.
- **Prestação de contas** (opção 1, as etapas e os números): as quatro etapas do balanço, o passo de quem está vendo, os quatro números (saldo inicial, receitas, despesas, saldo final) e as categorias; as planilhas. Subfunções: **Mês a mês** e **Balanço e parecer** (o documento para imprimir).
- Em cima de cada função, no computador, os três números do Financeiro: o saldo de hoje, o recebido no exercício e o que está em aberto.

**O que entrou no banco:**

- `numeros_do_financeiro()` (os números do alto, numa chamada só) e `caixa_no_periodo(início, fim)` (o saldo de todas as contas no começo e no fim do período e as contas abertas nele, com a mesma regra dos saldos);
- a vista `vw_lancamentos` (security_invoker): o lançamento com a conta, a categoria e os nomes de quem lançou e de quem autorizou;
- o orçamento vai para a assembleia: `mandar_orcamento` (com a AGO ou AGE, se já marcada), `voltar_orcamento` e a regra de que a aprovação só vem depois de mandado (o orçamento já aprovado antes conta como mandado); `salvar_orcamento` com o plano `null` mantém o texto;
- o plano anual de trabalho em atividades (`plano_atividades`: o mês dentro do exercício, o que é, quem cuida, a categoria e quanto custa), com `salvar_atividade_plano` e `arquivar_atividade_plano` (nada se apaga). O plano só muda com o orçamento em rascunho.

**Decisões tomadas sem o desenho:**

- **O Financeiro abre no que espera alguém**, como antes: nos comprovantes para conferir (tesouraria e presidência) e na prestação de contas (Conselho Fiscal).
- **"Lembrar todos" ficou de fora**: ainda não existe a tabela das notificações (é o módulo seguinte da ordem combinada).
- **"Todos os ministros", embaixo do painel**: o painel aprovado só mostra quem precisa de atenção, e a tesouraria precisa achar qualquer um (por exemplo, para registrar um pagamento adiantado).
- **No extrato, a transferência é uma linha só** ("Conta → Dinheiro", sem mudar o saldo total), e a abertura de uma conta no mês aparece como "Saldo de abertura".
- **O orçamento compara** o próximo exercício com o atual (até agora); o atual e os passados, com eles mesmos (previsto × realizado). A tela abre no atual enquanto o orçamento dele não foi aprovado; depois, no próximo.
- **A ordem das etapas segue o estatuto** (a diretoria analisa antes do parecer do Conselho Fiscal), como o sistema já fazia; o desenho trazia as duas trocadas.
- **Os valores, a taxa de inscrição, os vencimentos, as contas e as categorias** aparecem também no Financeiro (Valores e planos; Contas e saldos), sem sair de Configurações (o mesmo componente, em `ConfigFinanceiro.tsx`).

**Verificação:**

- testes do banco: `testes/banco/financeiro_telas.test.ts` (10 testes): os números (e o ministro não vê); o saldo no começo e no fim do mês, com a conta aberta no meio, a transferência e a despesa esperando; os nomes na vista e o ministro sem linhas; o plano que não se apaga ao salvar o previsto; mandado não muda e volta para o rascunho; a assembleia escolhida; a aprovação só depois de mandado; as atividades (dentro do exercício, sem transferência, só a tesouraria e a presidência, arquivar). O `prestacao.test.ts` ganhou a regra do "mandar" antes de aprovar;
- no total, 597 testes (banco e unidade), todos passando;
- ponta a ponta: `financeiro.spec`, `caixa.spec`, `prestacao.spec` (refeito: as etapas, o mês a mês, o balanço para imprimir, o orçamento por categoria, o plano anual, mandar e voltar) e `menu-modulo.spec`, verdes no computador e no celular;
- o verificador do Supabase (`db advisors`) no comep-teste: só o aviso conhecido (`auth_leaked_password_protection`).

## Entrega 5.5.13 — Telas novas, parte 10: o Conselho Fiscal mês a mês (versão 5.5.0-teste.14)

O fim do lote do Financeiro e do Conselho Fiscal (rodadas 13 e 14, aprovadas em 18/11/2026; as regras estão no `PROJETO.md`, seção 4.10). Migrações `20261120100000_conselho_fiscal_meses.sql` e `20261120200000_conselho_fiscal_impressao.sql` (a correção abaixo).

**As telas (módulo Conselho Fiscal, no menu da coluna: Contas dos meses, Esclarecimentos, Parecer do ano e Documentos):**

- **Contas dos meses** (rodada 13, opção 3, como tela inicial; `fiscal-2`): o exercício em números (meses aprovados, com ressalva, para analisar e o saldo), os 12 meses num quadro colorido (aprovado, com ressalva, para analisar, esperando a tesouraria, mês aberto), "Aprovar os meses sem movimento" e o cartão do parecer do ano com os membros.
- **A página do mês** (rodada 13, opção 2 melhorada; `fiscal-2`): os saldos (no início, entrou, saiu, no fim), cada lançamento com o comprovante, a dúvida marcada em destaque, o comprovante aberto ao lado (a imagem, ou o PDF) com "Perguntar à tesouraria", e "Dar o parecer de outubro": aprovar, aprovar com ressalva ou pedir esclarecimento. Aprovado, mostra quem assinou e "Assinar também"; o mês anterior e o seguinte.
- **Esclarecimentos**: as perguntas esperando a tesouraria e as respondidas; a tesouraria (ou a presidência) responde ali, com o comprovante que faltava.
- **Parecer do ano** (Art. 14): os 12 meses, o balanço e o parecer. O formulário só aparece com os 12 meses aprovados, com o texto montado a partir dos meses e das ressalvas; "Devolver à tesouraria para correção"; os membros assinam.
- **Documentos**: os pareceres dos meses e o parecer do ano, para imprimir ou salvar em PDF.
- No Financeiro: a **Prestação de contas** leva o Conselho ao parecer do ano (o formulário saiu de lá), e o **Mês a mês** ganhou a coluna do Conselho Fiscal. No Início, "Precisa de você" mostra os meses para analisar (Conselho) e as perguntas para responder (tesouraria e presidência), e o menu mostra os mesmos números.

**O que entrou no banco:**

- `conselho_meses`: a aprovação de cada mês com a **fotografia dos números** (entradas, saídas, quantos lançamentos e os saldos). Se os números do mês mudarem depois (um lançamento novo, cancelado ou autorizado com a data dele), a aprovação **deixa de valer** ("mudou depois da aprovação") e o mês volta para a análise; aprovado de novo, a antiga fica arquivada;
- `esclarecimentos`: a pergunta (sobre o mês ou um lançamento dele), a resposta, quem e quando, e o arquivo da resposta, que vai também para o lançamento se ele estava sem comprovante (e o exercício não está fechado);
- `conselho_assinaturas`: quem assinou cada mês e o parecer do ano (o do ano vale a partir do parecer em vigor);
- as funções `meses_do_conselho`, `decidir_mes`, `assinar_mes`, `aprovar_meses_sem_movimento`, `pedir_esclarecimento`, `responder_esclarecimento`, `assinar_parecer` e `membros_conselho_fiscal`;
- `parecer_balanco` agora exige os 12 meses do exercício aprovados (e quem dá o parecer assina).

**Decisões tomadas sem o desenho:**

- **O ano do Conselho é o exercício** (abril a março), não o ano civil do desenho: o balanço e o parecer são por exercício.
- **"Não aprovar" virou "Pedir esclarecimento"** (o desenho dizia "não aprovar — pedir explicação à tesouraria"): o mês fica esperando a tesouraria e não se aprova enquanto houver pergunta sem resposta.
- **Uma pessoa do Conselho decide o mês**, e os outros membros assinam junto ("Assinar também"); a página mostra quem falta. Quem tem perfil da diretoria não decide (como no parecer do balanço; o banco já não deixa a mesma pessoa ter os dois perfis).
- **A aprovação não trava a tesouraria**: o lançamento atrasado entra normalmente, e o mês volta para a análise do Conselho (em vez de bloquear o caixa).
- **Os meses sem movimento** (por exemplo, antes de o sistema começar) se aprovam de uma vez, com a marca "sem movimento".
- **A marca de conferido (✓)** aparece nos lançamentos do mês aprovado; antes disso, a linha mostra o "?" da pergunta ou "respondido".
- **A tesouraria e a presidência abrem o módulo** (só leitura e as respostas): é lá que elas respondem.

**Defeito achado no ponta a ponta e corrigido:** a fotografia do mês aprovado guardava só as somas e a quantidade de lançamentos. A rodada do computador aprovou o mês e cancelou a sua entrada de R$ 1,00; a do celular lançou outra de R$ 1,00, e o mês apareceu aprovado (as somas e a quantidade voltaram a bater). A migração `20261120200000_conselho_fiscal_impressao.sql` guarda também a impressão digital (md5) de quais lançamentos contam no mês: qualquer troca faz a aprovação deixar de valer. O teste do banco "cancelar e lançar outro do mesmo valor" cobre o caso.

**Verificação:**

- testes do banco: `testes/banco/conselho_fiscal.test.ts` (8 testes): os 12 meses com os números e os saldos; quem decide (só o Conselho, mês terminado, ressalva com texto); a fotografia, a assinatura do outro membro e não aprovar duas vezes; o mês que mudou volta para a análise e a aprovação antiga fica arquivada; a pergunta, a resposta só da tesouraria, o arquivo que vai para o lançamento e o mês aprovado que não aceita pergunta; os meses sem movimento e o parecer do ano só com os 12 meses, com as assinaturas; os membros. O `prestacao.test.ts` aprova os meses antes do parecer;
- ponta a ponta: `conselho-fiscal.spec` (novo: o Conselho aprova o mês anterior, pede esclarecimento sobre um lançamento do outro, a tesouraria responde, o Conselho aprova (o arquivo da resposta é conferido nos testes do banco); o mês a mês mostra o parecer; o ministro não abre; o parecer e os documentos do exercício da semente) e o `prestacao.spec` (o parecer dado no módulo Conselho Fiscal, depois de aprovar os meses sem movimento).

## Entrega 5.5.14 — Telas novas, parte 11: as notificações (versão 5.5.0-teste.15)

O módulo das Notificações (rodada 15, a proposta "notificacoes", aprovada em 18/11/2026; o sino e o menu do celular da rodada 4). As regras estão no `PROJETO.md`, seção 4.8. Migração `20261120230000_notificacoes.sql`.

**O que entrou no banco:**

- `notificacoes`: para quem, o assunto (assembleias, votações, mural, contribuição, documentos, pedido e recado), o título, o texto, o link dentro do sistema, a chave que não repete, se é urgente, quando aconteceu, **quando foi lida (por pessoa)** e o envio ao celular. Cada um lê só as suas; ninguém grava direto; nada se apaga.
- `notificacao_preferencias` (a resposta do primeiro acesso, o que não chega no celular e o silêncio à noite) e `inscricoes_push` (os aparelhos; o mesmo aparelho com outra pessoa passa para ela, como no computador da sede).
- **Os avisos que o sino já mostrava passam a nascer quando as coisas acontecem** (gatilhos): a assembleia ou a reunião convocada (todos os associados), a votação ou enquete aberta (quem pode votar), o pedido de AGE (quem pode assinar, menos quem abriu), o aviso novo no mural (quem é do COMEP, menos quem publicou), a pendência no pedido de associação, o comprovante conferido (confirmado ou não) e o item ou o documento da igreja devolvido. O que já estava aberto no dia da migração entrou no sino.
- **Os avisos com data** (`gerar_avisos_do_dia`, uma vez por dia, na primeira leitura ou na rodada do envio): os documentos da igreja 60 e 30 dias antes de vencer e a igreja suspensa (urgente), para o pastor presidente.
- `mandar_recado` ("Mandar pelo aplicativo": secretaria, tesouraria e presidência), `lembrar_contribuicoes_em_atraso` (tesouraria e presidência; uma vez por dia para cada pessoa), `situacao_dos_avisos` e, só para a chave secreta do envio, `push_pendentes` e `push_resultado` (404 e 410 arquivam o aparelho).

**As telas:**

- **O sino** lê a tabela: o lido vale em todos os aparelhos; o recado mostra quem mandou; o sino se atualiza a cada 5 minutos e ao voltar para a aba.
- **"Receber os avisos no celular?"** no topo do Início (rodada 15, a tela "Ativar"): "Sim, ativar" pede a permissão do navegador e inscreve o aparelho; "Agora não" guarda a resposta. Ao lado, "Como chega", com dois exemplos.
- **Meu perfil › Avisos** (a tela "O que chega"): neste aparelho (ativar ou parar), o que chega no celular (interruptores) e o silêncio à noite, e os aparelhos que recebem.
- **"Falar pelo WhatsApp"** no alto da ficha do ministro (a tela "WhatsApp da secretaria"): a mensagem pronta (o lembrete da contribuição, a próxima assembleia, o que falta na credencial ou livre), que se pode ajustar, "Abrir no WhatsApp" (o WhatsApp de quem clica, com o texto) e "Mandar pelo aplicativo".
- **"Lembrar todos"** em Financeiro › Contribuições › Precisam de atenção (a rodada 11; tinha ficado de fora na parte 9).
- **Administração › Avisos e notificações**: quantos ativaram, os aparelhos, os avisos dos últimos 7 dias, o último envio e o que o sistema avisa sozinho.

**O envio pronto para ligar:** `supabase/functions/enviar-avisos` (Deno, `web-push`), `public/avisos-sw.js` (mostra a notificação e abre o sistema no lugar certo, entra no service worker pelo `importScripts`) e a chave pública em `VITE_VAPID_PUBLICA` (variáveis do GitHub `VAPID_PUBLICA` e `TESTE_VAPID_PUBLICA`). O roteiro do que o usuário cria está em `docs/avisos-no-celular.md`.

**Decisões tomadas sem o desenho:**

- **O pedido de ativar é um cartão no topo do Início**, não uma página que trava a entrada: quem prefere decidir depois usa o sistema normalmente.
- **"Demandas que eu apoio" e "Contratos para assinar"**, do desenho, ficam de fora da lista do que chega até esses módulos existirem (o sistema não promete o que ainda não faz). "Documentos da igreja" só aparece para o pastor presidente.
- **O recado da secretaria e o pedido de associação chegam sempre** (não se desligam).
- **"Lembrar todos"** vai só para quem está em atraso e ainda não mandou o comprovante, e não repete no mesmo dia.
- **Aviso lido no sino não vai ao celular**, nem o que tem mais de 3 dias.
- **"Ver todos os avisos"**, do desenho do sino, continua "Ver o mural de avisos": o sino mostra os 30 mais novos.

**Verificação (21/11/2026):**

- `npm test`: 620 de 620 (o `testes/banco/notificacoes.test.ts` tem 15: os gatilhos de cada assunto, a chave que não repete, o lido por pessoa, as preferências, o aparelho que muda de dono, o recado e quem pode mandar, o "Lembrar todos" uma vez por dia, os avisos com data, o envio que respeita o silêncio e o que foi desligado, e o 404/410 que arquiva o aparelho); tsc, oxlint e build sem aviso.
- Migração aplicada no `comep-teste` em 21/11, com o GitHub parado; `supabase db advisors`: só o aviso conhecido `auth_leaked_password_protection`.
- Ponta a ponta no computador e no celular (9 arquivos: `notificacoes`, `mural`, `moldura`, `financeiro`, `portal`, `portal-ministro`, `cadastros`, `menu-modulo` e `configuracoes`): 73 passaram e 2 ficaram de fora de propósito (o teste só do celular no computador e o contrário).
- O teste do lido espera o banco gravar antes de recarregar a página; o das preferências começa com o mural ligado, para limpar a sobra de uma rodada cortada no meio.
- Telas conferidas com fotos no computador e no celular: o cartão do Início, Meu perfil › Avisos, o sino com o recado, a ficha com o WhatsApp, Administração › Avisos e notificações e o "Lembrar todos".

## Entrega 5.5.15 — Telas novas, parte 12: a blindagem do Financeiro (versão 5.5.0-teste.16)

Pedido do usuário em 20/11/2026: ele homologou o Conselho Fiscal, mas só aprova o Financeiro **blindado**, isto é, integrado com todos os módulos: toda entrada e toda saída de qualquer módulo chega sozinha ao caixa. As regras estão no `PROJETO.md`, seção 4.4. Migração `20261121090000_financeiro_blindagem.sql`.

**O mapa de todo o dinheiro** (os fluxos do código que recebem ou pagam valor):

| Módulo | O que gera | Como entra no caixa (antes → agora) | O que foi corrigido |
| --- | --- | --- | --- |
| Contribuições (mensalidade e anuidade) | o pagamento confirmado (o comprovante conferido ou o registrado pela tesouraria) | sozinho, pelo gatilho `contribuicao_no_caixa`, ligado à cobrança (`cobranca_id`); dinheiro → caixa, o resto → banco | o lançamento não se cancelava pelo caixa: agora cancelar devolve a cobrança para "em aberto"; a cobrança paga sem o lançamento é recusada; o "recebido" do painel é lido do caixa |
| Taxa de inscrição de associado | a cobrança do tipo inscrição | o mesmo caminho das contribuições | o mesmo |
| Inscrição num evento do COMEP | o pagamento registrado pela tesouraria | sozinho, ligado à inscrição (`lancamento_id`) e ao evento (`evento_id`) | cancelar a inscrição paga estorna o lançamento (antes era proibido: "a devolução é com a tesouraria"); pago ↔ lançamento vira regra da tabela |
| Despesa de um evento | — | antes: lançada no Caixa e depois ligada ao evento | agora lançada pelo próprio evento (`lancar_no_evento`), ligada a ele e ao orçamento aprovado, para a autorização do presidente, como as outras |
| Receita avulsa de um evento (patrocínio, oferta) | — | antes: lançada no Caixa e depois ligada | agora lançada pelo próprio evento |
| Modelo exclusivo da credencial | o pagamento da igreja | antes: a data de pago, com a entrada do caixa **opcional** (a brecha) | agora "Receber o pagamento" cria a entrada (categoria do sistema "Modelos exclusivos da credencial"); ligar, só uma entrada avulsa sem outra origem; desfazer = estorno; pago sem a entrada é recusado; os que estavam pagos sem a entrada ganharam a entrada na migração |
| Patrimônio: a compra | o bem comprado | a tesouraria lança a saída no Caixa (com a autorização do presidente) e liga ao bem (`ligar_compra_patrimonio`) | cancelar a saída desliga o bem; o extrato mostra "Compra do patrimônio" |
| Patrimônio: avaria e falta na devolução | a baixa da quantidade | não há cobrança de avaria no sistema hoje (só a baixa registrada) | nada a corrigir; se a diretoria decidir cobrar, a cobrança entra pela função única |
| Transferência entre contas | — | as duas pernas, ligadas (`transferencia_id`) | passam pela função única; cancelar uma cancela as duas (já era assim) |
| Lançamento avulso (Caixa) | ofertas, doações, despesas do dia a dia | `lancar` | passa pela função única; o extrato mostra "Lançado no Caixa" |
| Orçamento e plano anual | a previsão | não move dinheiro | — |
| Cursos e eventos das igrejas | — | **não passam pelo caixa do COMEP** (o dinheiro é da igreja; o COMEP só divulga) | regra escrita no `PROJETO.md` |

**As travas no banco:**

- `interno.registrar_lancamento` é a única porta do livro-caixa. O gatilho `exigir_funcao_de_lancamento` recusa qualquer outra gravação em `lancamentos`, até a do dono do banco ou de outra função. A API continua só lendo (RLS).
- `proteger_lancamento`: o lançamento gravado não muda (o valor, a conta, a data, o tipo, a categoria, a descrição e a origem), e o cancelado ou recusado não volta. Nada se apaga.
- Item pago tem sempre o lançamento valendo:
  - as restrições `credencial_modelos_pago_tem_lancamento` e `evento_inscricoes_pago_tem_lancamento`;
  - o gatilho de restrição `conferir_pago_tem_lancamento` (no fim da transação), nas cobranças, nas inscrições e nos modelos exclusivos: o lançamento ligado precisa estar efetivado e com o mesmo valor.
- `lancamento_cancelado_devolve_origem`: o lançamento cancelado devolve a contribuição para "em aberto" (o comprovante confirmado vira cancelado, com o motivo), o modelo exclusivo para "falta o pagamento" e desliga a compra do bem (a inscrição já voltava).
- A origem de cada lançamento: `interno.origem_do_lancamento` e as colunas `origem`, `origem_texto` e `origem_link` em `vw_lancamentos`.

**As telas:**

- **Caixa › extrato:** cada linha mostra "De onde veio", com o link para a origem (a contribuição de quem, a inscrição nº tal do evento tal, o evento, o modelo exclusivo de qual igreja, a compra do patrimônio), e o filtro "De onde veio". O lançamento automático também se cancela (com o motivo), e a tela diz o que volta para "a pagar".
- **O evento** (Finanças do evento): "Lançar uma despesa ou uma receita do evento" (a categoria, a conta, a data, o valor e a descrição). A despesa só com o orçamento aprovado e vai para o presidente. Na inscrição paga, "Estornar o pagamento e cancelar", com o motivo (tesouraria e presidência).
- **O modelo exclusivo** (Credenciais › Quem recebe): "Receber o pagamento" (a data e a forma) cria a entrada no caixa; "A tesouraria já lançou a entrada no Caixa? Ligue aqui"; "Desfazer o pagamento" pede o motivo e cancela a entrada.
- **O mês do Conselho Fiscal** mostra a origem em cada lançamento.

**Decisões tomadas sem o desenho:**

- O ligar um lançamento do caixa ao evento continua (para o que já foi lançado antes), além do lançar pelo evento.
- A conta da entrada automática segue a forma, como já era: dinheiro → "Caixa (dinheiro)"; PIX, depósito e o resto → a conta bancária.
- O modelo exclusivo pago antes da blindagem, sem a entrada, ganhou a entrada na conta bancária, na data do pagamento (ou no início da conta, se o pagamento for anterior), com "(pago antes da blindagem do caixa)" na descrição.
- Ninguém "desfaz" um pagamento apagando a data: desfazer é sempre cancelar o lançamento (o estorno fica no extrato, com o motivo).

**Verificação (21/11/2026):**

- `npm test`: 630 de 630. O `testes/banco/financeiro_blindagem.test.ts` tem 10 testes:
  - ninguém grava direto no livro-caixa, nem o dono do banco;
  - a contribuição entra ligada à cobrança, e cancelar o lançamento devolve a cobrança para "em aberto";
  - a cobrança, a inscrição e o modelo exclusivo pagos sem o lançamento são recusados;
  - o "recebido" é lido do caixa;
  - o estorno da inscrição paga;
  - o evento lança a receita e a despesa, esta só com o orçamento aprovado;
  - desfazer o pagamento do modelo exclusivo estorna;
  - a transferência são duas pernas ligadas;
  - no fim, tudo concilia: a soma do que está pago bate com a soma dos lançamentos ligados, em cada origem.
- O `caixa.test.ts`, o `eventos.test.ts`, o `patrimonio.test.ts` e o `credencial_modelos.test.ts` passaram a usar a função única.
- tsc, oxlint e build sem aviso.
- A migração foi aplicada no `comep-teste` em 21/11, com o GitHub parado. O `supabase db advisors` mostra só o aviso conhecido `auth_leaked_password_protection`. A semente `testes/dados/semente-blindagem-teste.sql` também foi aplicada.
- Ponta a ponta no computador e no celular, em 8 arquivos (`financeiro-blindagem`, `caixa`, `financeiro`, `conselho-fiscal`, `prestacao`, `eventos`, `credencial-modelo` e `patrimonio`): 38 de 38, mais os 5 do preparo.
- O teste novo e o `financeiro.spec` limpam as sobras de rodadas cortadas antes de começar: estornam a inscrição paga, cancelam a despesa e arquivam o contribuinte. O teste novo também espera as inscrições carregarem antes de contar. Uma primeira versão contava cedo demais e deixava o pagamento no caixa; a limpeza do começo estornou essas sobras.
- As telas foram conferidas com fotos no computador e no celular: o extrato com a origem e o filtro, o evento com o "Lançar" e o mês do Conselho Fiscal. No celular, o formulário do evento passou a ter um campo por linha, porque o "Despesa do evento" ficava cortado.

## Entrega 5.5.16 — Telas novas, parte 13: a segurança e a privacidade (versão 5.5.0-teste.17)

As rodadas 19 (o termo e "meus dados"), 20 e 22 (a segurança). As regras estão no `PROJETO.md`, seção 4.9. Migrações `20261121120000_termo_privacidade.sql` e `20261121150000_quem_mexeu_rapido.sql`.

**O que entrou no banco:**

- `termos_uso`: a versão, o resumo em 9 pontos, o termo em 10 partes, o que mudou, se é minuta, a data em que passa a valer e a publicação. Só um rascunho por vez; **a versão publicada não muda nem se apaga** (gatilho). A versão 1 (minuta) entrou na migração.
- `termo_aceites`: quem aceitou qual versão, quando e em que aparelho, com o dado sensível sempre marcado. O aceite não muda nem se apaga.
- `privacidade_escolhas` (receber avisos pelo WhatsApp e aparecer na lista de aniversariantes) e `pedidos_titular` (o pedido de exclusão e a resposta da secretaria).
- As funções: `meu_termo` (o termo que vale e se precisa aceitar), `aceitar_termo`, `salvar_privacidade`, `minha_privacidade` (com quem mexeu nos dados, da auditoria, nos últimos 90 dias), `meus_dados` (o arquivo para baixar), `pedir_exclusao`, `versoes_do_termo`, `salvar_rascunho_termo`, `publicar_termo` (a versão nova precisa dizer o que mudou), `responder_pedido_titular`, `lembrar_termo` (pelo sino da parte 11, uma vez por dia) e `privacidade_de` (a ficha do ministro sabe se ele quer o WhatsApp).
- O índice `auditoria_pessoa` (a pessoa de cada registro da auditoria): "quem mexeu nos seus dados" lia a auditoria inteira, que no teste já passa de 76 mil linhas (3 s com o banco folgado; no ponta a ponta, passou do limite de 8 s e a tela mostrou o erro). Com o índice e a busca em duas partes, leva 43 ms.

**As telas:**

- **O termo na tela inteira**, logo depois de entrar (rodada 19, a tela "termo"): o resumo em 9 pontos, o dado sensível destacado, o opcional à parte, "Ler o termo completo ›", "Aceitar e continuar" e "Agora não".
- **O termo completo** (`/termo-de-uso`): as 10 partes com o índice, "Minuta" no alto e "Baixar em PDF" (pela impressão do navegador).
- **Meu perfil › Privacidade** (a tela "meus-dados"): o termo aceito (versão, data, hora e aparelho), baixar os meus dados, pedir correção ou exclusão, quem mexeu nos dados e as escolhas.
- **Meu perfil › Segurança** (rodadas 20 e 22): a chave de acesso ("Ainda não ligada"), este aparelho (os 30 dias, com a data), "Sair de todos os outros aparelhos", a senha e as regras; "Como funciona a digital" (no celular e no computador). O endereço antigo `/meu-perfil/senha` continua valendo.
- **Administração › Termo de uso de dados:** as versões, quem aceitou a versão em foco, "Mandar lembrete aos N" (quem ainda não aceitou), "Escrever nova versão" (o rascunho e publicar) e os pedidos de exclusão.
- **A ficha do ministro:** quem escolheu não receber avisos pelo WhatsApp não tem o botão "Abrir no WhatsApp" (só "Mandar pelo aplicativo").
- **A sessão de 30 dias:** depois de 30 dias da entrada em cada aparelho, o sistema sai e a tela de entrar explica.

**O que ficou de fora e por quê:**

- **A chave de acesso (passkey), a confirmação pela digital para assinar e o aplicativo autenticador:** o Supabase do teste está com as chaves desligadas (`passkeys_enabled: false`) e o autenticador também. Ligar é mudar a configuração do projeto no painel do Supabase, o que este trabalho não faz. Quando o usuário ligar (Authentication › Passkeys, com o nome "COMEP", o domínio `ieadespa.github.io` e os endereços `https://ieadespa.github.io`, `http://localhost:4173` e `http://localhost:5173`), entram: o cadastro da chave, a entrada com a digital, a obrigação para quem tem perfil e para o pastor presidente, as chaves listadas e removíveis em Segurança e a confirmação para assinar.
- **A entrada pelo CPF** (do desenho): continua o e-mail, como decidido em 11/11/2026. Achar o e-mail pelo CPF antes de entrar exporia o e-mail de qualquer pessoa.
- **A lista de aniversariantes** ainda não existe no sistema: a escolha fica guardada para ela.

**Decisões tomadas sem o desenho:**

- O termo aparece para quem tem perfil de acesso. O candidato consente no pedido de associação.
- "Agora não" vale para a aba aberta: no próximo acesso, o termo aparece de novo.
- "Quem mexeu nos seus dados" mostra quem mudou (a auditoria registra as mudanças, não as leituras).
- O lembrete do termo vai pelo sino (o recado da secretaria), uma vez por dia.
- O arquivo "meus dados" é JSON (abre em qualquer editor de texto).
- Os 30 dias contam da entrada (a data que vem na sessão), e não da última vez que a pessoa usou.

**Verificação (21/11/2026):**

- `npm test`: 637 de 637. O `testes/banco/termo_privacidade.test.ts` tem 7 testes:
  - a versão 1 (minuta) vale desde a migração, com o resumo em 9 pontos e o termo em 10 partes;
  - o aceite pede o dado sensível, guarda a versão, a data, a hora e o aparelho, e não se repete nem muda;
  - a versão publicada não muda nem se apaga, e ninguém grava direto;
  - a versão nova (o rascunho e publicar com o que mudou) pede o aceite de todos de novo;
  - os meus dados, o pedido de exclusão (a secretaria responde) e quem mexeu nos dados;
  - o que a própria pessoa fez não aparece em "quem mexeu", e a busca vai pelo índice da pessoa;
  - o lembrete pelo sino vai para quem falta, uma vez por dia.
- tsc e oxlint sem aviso. O build passa, só com o aviso do tamanho do pacote, que já existia antes desta entrega.
- As duas migrações foram aplicadas no `comep-teste` em 21/11, com o GitHub parado. O `supabase db advisors` mostra só o aviso conhecido `auth_leaked_password_protection`. "Quem mexeu nos seus dados" caiu de 3 s para 43 ms.
- Ponta a ponta local no computador e no celular, todos os arquivos: 181 passaram e 3 foram pulados de propósito (valem só no computador ou só no celular).
  - Um falhou, o `site.spec` no celular: as chamadas públicas ao Supabase da página inicial ficaram sem resposta por 60 s (a rede, não o código). Rodado de novo, o `site.spec` passou, 17 de 17.
  - Depois do último ajuste de texto em Privacidade, o `termo.spec` rodou de novo: 9 de 9.
  - Os testes que criam dados limpam as sobras de rodadas cortadas antes de começar: o `termo.spec` arquiva os "Associado Termo E2E" que sobraram.
- As telas foram conferidas com fotos no computador e no celular: o termo na tela inteira, o termo completo, Meu perfil › Privacidade e Segurança, "Como funciona a digital" e Administração › Termo de uso de dados.
- Defeitos achados e corrigidos no caminho:
  - o sistema aparecia por um instante antes do termo, enquanto a conta carregava: o portão agora mostra "Carregando…";
  - "quem mexeu nos seus dados" passava do limite de tempo do banco: o índice novo resolveu;
  - o aparelho aparecia todo em minúscula ("chrome"): agora só o tipo ("pelo computador · Chrome").

## Entrega 5.5.17 — Telas novas, parte 14: as assembleias ao vivo (versão 5.5.0-teste.18)

A rodada 15 (asm-presenca opção 3; asm-conducao: o painel da opção 1, o roteiro da opção 3 e o telão da opção 2; asm-fechamento opção 3), a regra da rodada 30 (o RESUMO e o OFICIAL do edital e da ata) e a rodada 18 (o menu recolhido, opção 1). As regras estão no `PROJETO.md`, seção 4.6. Migração `20261121180000_assembleias_telas.sql`.

**O que entrou no banco:**

- **A portaria:** `encontro_portarias` guarda o segredo de cada encontro, e ninguém lê a tabela (RLS sem política). O código de 6 letras sai do segredo e do minuto (HMAC), sem as letras que se confundem. `portaria_do_encontro` (só a secretaria e a presidência) dá o código e quem chegou por último. `marcar_minha_presenca` (só o associado ativo, com a presença aberta) aceita o código do minuto e o do minuto anterior. A presença guarda o jeito: `portaria_qr` ou `portaria_codigo`, além da credencial lida e do nome.
- **O roteiro:** `encontros.roteiro_abertura` (padrão: Introdução, Oração e Oportunidade) e `roteiro_atual` (o item de agora, que vai para o telão); `encontro_pauta.origem` (`edital` ou `periodo`). As funções `incluir_na_pauta` (a pauta que chegou no período: só vai a votação na AGO), `salvar_abertura_do_roteiro` e `avancar_roteiro`.
- **Os convidados:** `encontro_convidados` (nome e "quem é"), com `registrar_convidado` e `arquivar_convidado`. Não votam e não contam no quórum.
- **As resoluções:** `resolucoes`, com número por ano (01/2026, 02/2026…), o item da pauta (opcional) e a anulação com motivo (o número não volta). `protocolar_resolucao` só no dia e só pela diretoria; `anular_resolucao`. Depois da primeira assinatura da ata, nada disso muda. O ministro lê as resoluções só depois da ata assinada.

**As telas:**

- **Presença** (`/assembleias/presenca/:id`): o quórum, "Quem chegou" com o jeito de cada um (QR da portaria, código digitado, credencial lida, pelo nome) e se vota, "Marcar pelo nome", "Três jeitos de marcar" e "Abrir a tela da portaria". **A tela da portaria** (`/assembleias/presenca/:id/portaria`) mostra o QR Code e o código grande, que mudam a cada minuto, e "Chegaram agora".
- **No celular do ministro**, na página do encontro (com a presença aberta): "Marcar a minha presença", com o leitor do QR (quando o navegador tem) e o campo do código. O QR da portaria abre a página do encontro com o código no endereço: a presença é marcada sozinha e o código sai do endereço. Quem está em atraso marca a presença e é avisado de que não vota.
- **Condução** (`/assembleias/conducao/:id`): o roteiro (a abertura, as pautas do edital, as do período e o encerramento), com "Começar o roteiro", "Próximo item" e "Ir para"; "+ Pauta que chegou no período"; o item de agora com a votação pelo celular ou contada à mão; o quórum e "Instalar a assembleia"; os convidados.
- **O telão** (`/assembleias/conducao/:id/telao`): fora da moldura, para a TV da sede, com o quórum, o item de agora e a votação (a parcial só no voto aberto). Segue o tema claro ou escuro, **sem fundo preto**.
- **Fechamento e ata** (`/assembleias/fechamento/:id`): os números (presentes, faltas, votações e resoluções), as resoluções (protocolar e anular), o resumo da ata (gerar, salvar e assinar, que antes ficava na condução), a ata oficial em PDF depois das duas assinaturas, as faltas para conferir e **o texto da ata oficial para o Word**, com "Copiar o texto". Encerrada a lista, o título vira "A assembleia encerrada".
- **O edital:** "Copiar o edital para o Word" na página do encontro (o oficial também é feito no Word).
- **O menu recolhido** (rodada 18, opção 1; só no computador, dentro dos módulos): "Recolher o menu" deixa só os ícones, com o nome ao passar o mouse; a escolha fica guardada para a pessoa, naquele navegador.
- Os endereços antigos (`/assembleias/:id/presenca` e `/assembleias/:id/conducao`) levam aos novos.

**Também nesta entrega:**

- **Os avisos no celular:** o `docs/avisos-no-celular.md` diz o que está ligado no comep-teste (desde 21/11). O script novo `scripts/ligar-avisos.mjs` liga o envio num projeto sem mostrar nenhum segredo: gera as chaves, grava os Secrets e o Vault, agenda o Cron e mostra só a chave pública. O `docs/lancamento.md` manda rodá-lo na produção no dia do lançamento.
- **A conta de teste de quem preside uma igreja** (`e2e.presidente.igreja`), criada em 22/11 pelos caminhos do próprio sistema, com a igreja fictícia regular e os documentos conferidos. A senha está só no `.env.e2e.local` e no Secret `E2E_SENHA_PRESIDENTE_IGREJA`, que a verificação do GitHub já recebe. O `presidente-igreja.spec` confere o perfil e a Minha igreja, sem mudar nada no banco.
- **O `AGENTS.md`:** até dois agentes ao mesmo tempo (decisão do usuário, 21/11/2026), um constrói e o outro prepara a homologação; nunca os dois aplicando migração ou rodando o ponta a ponta no comep-teste.
- **Os defeitos da homologação** (cada um no seu commit):
  - **D-01:** Meu perfil › Meus dados mandava pedir correção "na aba Correções" a quem não tem a aba (quem não tem cadastro de ministro). A frase agora só aparece para quem tem.
  - **D-02:** o botão do Início dizia "Mostrar a credencial" e abria a credencial. Agora diz "Mostrar o QR Code" e abre a credencial já com o QR grande (`/minha-credencial?qr=1`).
  - **D-03:** o `PROJETO.md` ainda dizia, em quatro lugares, que as faltas contam nas reuniões. Contam só as das assembleias (AGO e AGE), como foi respondido em 14/11.
  - **D-08:** todos os selos da secretaria (Conferido, Esperando, Recusado, Aprovado) estavam laranja, quase ilegíveis no escuro. A etiqueta "NOVO" do termo, da parte 13, tinha ganhado o mesmo nome do selo (`.selo-novo`) e passava por cima dele. Ela agora se chama `.etiqueta-novo`, e a letra dela usa a cor do fundo, legível no claro e no escuro. O teste novo `testes/unidade/estilos.test.ts` falha se uma classe receber duas cores diferentes no nível de cima do `estilos.css`.

**O que ficou de fora e por quê:**

- **O OFICIAL do edital e da ata** não passa pelo sistema (regra da rodada 30): o sistema gera o texto para o Word, e o cabeçalho do COMEP, a qualificação de quem assina e o que o cartório pede ficam entre colchetes, para completar lá. **Os dados pessoais dos diretores não aparecem na tela.**
- **A votação de uma pauta que chegou no período** só existe na AGO. Na AGE, só se vota o que estava no edital; na reunião mensal não há votação (a decisão vira resolução).
- **O D-05, o D-07, o D-09 e o D-10** vão num PR pequeno logo depois desta entrega. O D-06 fica para o lote do Patrimônio.

**Decisões tomadas sem o desenho:**

- A reunião mensal não tem ata no sistema: só as resoluções.
- A abertura do roteiro vem com Introdução, Oração e Oportunidade, e a secretaria ajusta em cada encontro.
- O código da portaria vale no minuto em que aparece e no minuto seguinte, para quem digita devagar.
- O menu recolhido existe só dentro dos módulos, no computador, e fica guardado no navegador, para cada pessoa.
- O botão do Início (D-02) abre o QR direto, pelo `?qr=1` no endereço.
- "Copiar o edital para o Word" entrou na página do encontro, junto do "Copiar o texto da ata", no fechamento.
- A reunião mensal mostra "N presentes · M em dia" e quantos associados estão em dia, sem a conta de "associados" que misturava os aptos com os presentes.

**Verificação (22/11/2026):**

- `npm test`: 655 de 655. O `testes/banco/assembleias_telas.test.ts` tem 13 testes:
  - a portaria: só a secretaria e a presidência veem o código; ninguém lê o segredo; o código muda a cada minuto e vale o do minuto anterior; o ministro marca com o código (o errado e o de quem não é associado, não); a tela mostra quem chegou;
  - o roteiro: a abertura padrão e o ajuste; a pauta do período entra no fim (votação só na AGO); o item de agora;
  - os convidados: a secretaria registra e arquiva, o ministro não vê, e eles não contam no quórum;
  - as resoluções: o número por ano (a anulada não devolve o número); só no dia e só a diretoria; o ministro só lê depois da ata assinada; a ata em assinatura trava.
- O `testes/unidade/estilos.test.ts` (D-08) passa e, rodado contra o `estilos.css` de antes da correção, falha nos dois casos.
- tsc e oxlint sem aviso. O build passa, só com o aviso do tamanho do pacote, que já existia antes desta entrega.
- A migração foi aplicada no `comep-teste` em 22/11, com o GitHub parado. O `supabase db advisors` mostra só o aviso conhecido `auth_leaked_password_protection`.
- Ponta a ponta local no computador e no celular, nos arquivos tocados (conducao, presenca, assembleias, menu-modulo, presidente-igreja, portal, portal-ministro, credencial-digital, termo, moldura, pedidos-age e votacoes):
  - 66 passaram, 3 foram pulados de propósito (o conducao, que espera a assembleia começar, roda só no computador) e 1 falhou: o conducao, por um seletor ambíguo do próprio teste (os dois textos da ata). Corrigido e rodado de novo com o portal: 23 passaram;
  - depois dos últimos ajustes de tela, o presenca e o menu-modulo: 19 passaram;
  - na rodada anterior, o menu recolhido mostrou um defeito de verdade: a dica que aparece ao passar o mouse entrava no nome do link para o leitor de tela. Agora ela fica de fora (`content: attr(data-dica) / ""`).
- As telas foram conferidas com fotos no computador e no celular, no claro e no escuro:
  - a presença;
  - a tela da portaria;
  - "Marcar a minha presença" no celular do ministro;
  - a condução de uma reunião mensal e de uma AGE realizada;
  - o telão;
  - o fechamento;
  - o menu recolhido, com a dica.
- Ajustes feitos depois das fotos:
  - o ícone colado no texto de "Abrir a tela da portaria" e de "Abrir o telão";
  - o exemplo do campo do código cortado no celular;
  - a conta de "associados" da reunião mensal.
