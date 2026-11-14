# Revisão da Fase 5 — Igrejas, comissões, eventos e comunicação (versão 5.0-teste)

Roteiro de 14/11/2026 (PROJETO.md, seção 9):

- a Fase 5 começa pela **igreja como instituição**;
- as respostas 26 a 39 (seção 11.3) valem para toda a fase, sem novas perguntas;
- patrimônio, assembleia on-line e telas novas ficam para a Fase 5.5.

## Entrega 5.1 — A igreja como instituição e o presidente de igreja (versão 5.0-teste.1)

O novo presidente do COMEP quer um conselho que **represente e apoie as igrejas da cidade**, não só os ministros (14/11/2026). O pastor presidente representa a igreja diante do COMEP.

**O que entrou:**

- **Documentos da igreja:**
  - o pastor presidente envia o **estatuto**, o **cartão CNPJ** e a **ata da eleição da diretoria** (ou outro documento, dizendo qual), em PDF ou foto;
  - a secretaria (ou a presidência) **confere ou recusa**, com o motivo;
  - enviar de novo substitui o anterior, que fica guardado;
  - os arquivos ficam numa pasta privada da igreja: só o pastor presidente dela, a secretaria e a presidência abrem.
- **Diretoria da igreja:** os cargos, os nomes e o mandato, como a igreja informa. Mudar guarda a anterior no histórico.
- **Pedidos de correção no cadastro:**
  - o pastor presidente pede para os ministros da igreja dele, e o próprio ministro pede para si, em "Meu perfil". Por exemplo, o nome, que só a secretaria corrige;
  - a secretaria vê os pedidos na lista de Ministros, corrige na ficha e marca como atendido (ou recusa, com o motivo);
  - quem pediu acompanha a resposta.
- **"Minha igreja"** (o painel do pastor presidente) mostra a igreja no COMEP:
  - o **peso** da igreja: quantos ministros associados ela tem e quantos estão em dia;
  - os documentos, com o que falta conferir;
  - a diretoria da igreja;
  - os ministros, com o pedido de correção em cada um;
  - os pedidos já feitos.
- **Lista de igrejas** (secretaria e presidência):
  - cada igreja mostra o peso (ministros associados e em dia), os documentos conferidos (de 3) e se a diretoria foi informada;
  - no alto aparecem os **documentos para conferir**.

### Trava 2

- [x] Migração `20261114180000_igreja_instituicao.sql`, aplicada no `comep-teste` em 14/11/2026. Verificador do Supabase: só o aviso já conhecido.
- [x] **10 testes novos do banco** (`testes/banco/igreja_instituicao.test.ts`):
  - **documentos:**
    - o pastor presidente envia os da própria igreja, não os da outra, e o ministro não envia;
    - fica um em vigor por tipo, e "outro" pede a descrição;
    - a secretaria confere ou recusa (com motivo); o pastor não confere; um documento conferido não muda;
    - quem lê os documentos e os arquivos;
  - **diretoria da igreja:**
    - o pastor da igreja registra, e mudar guarda a anterior;
    - o pastor de outra igreja não muda; datas trocadas são recusadas;
  - **correções:**
    - quem pede;
    - quem vê;
    - quem responde;
  - **resumo das igrejas:**
    - o peso, os em dia, os documentos e a diretoria;
    - o ministro não vê.
- [x] 397 testes do banco e de unidade passando.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| O pastor presidente vê o peso da igreja ("2 ministros associados") em "Minha igreja" | ✅ |
| Ele envia o estatuto (PDF), que fica "Esperando a conferência" | ✅ |
| Ele informa a diretoria da igreja | ✅ |
| Ele pede uma correção no cadastro de um ministro da igreja | ✅ |
| A presidência vê o documento em "Documentos para conferir" e confere na tela da igreja | ✅ |
| A presidência atende a correção na lista de Ministros | ✅ |
| Todos os testes de ponta a ponta, no computador e no celular, na cópia local | ✅ 105 passaram e 2 foram pulados de propósito |

## Entrega 5.2 — Comissões (versão 5.0-teste.2)

As comissões do Conselho seguem o estatuto (Art. 3º, IV e Art. 9º, III) e as respostas 28 a 30 (14/11/2026).

**O que entrou:**

- **Menu Comissões**, para todos com login. Mostra:
  - as comissões em atividade, com o tipo, a área, o número de membros e quem coordena;
  - as encerradas, à parte.
- **A presidência e a secretaria criam e alteram as comissões:**
  - nome, permanente ou temporária (a temporária com término), área (educação, segurança, saúde, política, cidadania…) e finalidade;
  - o nome não se repete entre as comissões em atividade.
- **Membros:**
  - **só associados ativos**, indicados pela presidência ou pela secretaria;
  - **um coordenador por vez**: escolher outro tira o anterior da coordenação, mas ele continua membro;
  - tirar um membro guarda a data de saída;
  - quem sai do COMEP sai das comissões sozinho.
- **O coordenador cuida da sua comissão:**
  - registra as reuniões, as atividades e os avisos;
  - tira um registro feito por engano (fica guardado);
  - os registros, só os membros da comissão e a diretoria veem.
- **Encerrar** pede a data e o motivo. Os membros saem junto e nada se apaga.

### Trava 2

- [x] Migração `20261114200000_comissoes.sql`.
- [x] **8 testes novos do banco** (`testes/banco/comissoes.test.ts`):
  - quem cria; a temporária precisa de término; o nome não se repete;
  - só associados ativos e sem repetir;
  - um coordenador por vez;
  - todos veem os membros, com o nome;
  - o coordenador registra, o membro comum não, e quem é de fora não lê;
  - tirar o registro;
  - quem sai do COMEP sai das comissões;
  - encerrar pede o motivo e tira os membros.
- [x] 405 testes do banco e de unidade passando. Migração aplicada no `comep-teste`; verificador do Supabase: só o aviso já conhecido.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A presidência cria uma comissão (permanente, área Educação) | ✅ |
| Indica o ministro fictício como coordenador e registra uma reunião | ✅ |
| O ministro (coordenador) vê a comissão, a reunião registrada, e registra uma atividade | ✅ |
| O ministro não altera nem encerra a comissão | ✅ |
| Encerrar a comissão, com motivo | ✅ |

## Entrega 5.3 — Eventos e projetos, e a Agenda no site (versão 5.0-teste.3)

Eventos e projetos do Conselho (Art. 3º, VII), pelas respostas 27, 31, 32 e 33 (14/11/2026). É também o primeiro passo do **site vivo**: o que se publica no sistema aparece no site, e a inscrição feita no site entra no sistema.

**O que entrou:**

- **Menu "Eventos e projetos"**, para todos com login: os próximos e os anteriores.
- **A secretaria e a presidência preparam:**
  - o secretário executivo, responsável pelos eventos, tem o perfil da secretaria;
  - o que se registra: tipo (evento ou projeto), título, datas, local, descrição, responsável e orçamento;
  - a inscrição pode ser só para os associados ou **aberta ao público pelo site**, com vagas, taxa e prazo.
- **Publicar** leva o evento ao site e à lista dos associados. Depois do evento, ele é registrado como realizado. **Cancelar** pede o motivo, e o site mostra "cancelado". Um rascunho ou um evento cancelado se arquiva.
- **Orçamento aprovado pela assembleia:**
  - registra-se a AGO ou AGE instalada que aprovou;
  - despesa ligada ao evento só depois disso;
  - mudar o valor pede nova aprovação.
- **Inscrições:**
  - **pelo site, sem login**, com nome, telefone (com DDD) e igreja, mais o aceite da LGPD;
  - pelo sistema, o associado se inscreve em "Minha inscrição";
  - o mesmo telefone não se inscreve duas vezes;
  - as vagas acabam;
  - muitas inscrições em pouco tempo esperam, para evitar abuso;
  - a lista fica com a diretoria e a tesouraria; cada inscrito vê só a dele.
- **Taxa:**
  - com taxa, a inscrição espera o pagamento;
  - a tesouraria registra o pagamento, a inscrição confirma e o valor **entra no caixa**, ligado ao evento, na categoria nova "Inscrições em eventos";
  - a taxa não muda depois de haver inscritos.
- **Finanças do evento:**
  - receitas, despesas e saldo, frente ao orçamento, para a tesouraria, a presidência e o Conselho Fiscal;
  - a tesouraria liga ao evento os lançamentos do caixa.
- **No site:**
  - o cabeçalho ganhou **Agenda**;
  - a página `/agenda` lista os eventos;
  - cada evento tem a sua página, com a inscrição;
  - a página inicial mostra os **próximos eventos**;
  - o compartilhamento pelo WhatsApp leva à página do evento no site.

### Trava 2

- [x] Migração `20261114220000_eventos.sql`, aplicada no `comep-teste`. Verificador do Supabase: só o aviso já conhecido.
- [x] **12 testes novos do banco** (`testes/banco/eventos.test.ts`):
  - **preparar e publicar:**
    - quem prepara;
    - o rascunho não vai ao site;
    - publicado, todos veem;
  - **inscrição:**
    - pelo site, com o aceite e o telefone;
    - as vagas acabam;
    - o evento só para associados não aceita visitante;
    - quem vê as inscrições;
  - **taxa:**
    - a inscrição espera o pagamento, e a taxa não muda;
    - o pagamento entra no caixa, ligado ao evento;
  - **orçamento:**
    - despesa só com o orçamento aprovado numa assembleia instalada;
    - as finanças do evento;
    - mudar o orçamento pede nova aprovação;
  - **cancelar e arquivar.**
- [x] 417 testes do banco e de unidade passando.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A presidência prepara e publica um evento com inscrição aberta ao público | ✅ |
| O visitante, sem login, vê o evento na Agenda do site, com as vagas | ✅ |
| Ele se inscreve pelo site (nome, telefone, aceite) e recebe o número | ✅ |
| A inscrição feita no site aparece no sistema ("Inscrições (1 de 5)") | ✅ |
| O ministro vê os eventos, mas não prepara | ✅ |
| Nenhuma página pública fica mais larga que a tela (com a Agenda no cabeçalho) | ✅ |

**Achado pelo teste de ponta a ponta e corrigido:** a limpeza dos testes de eventos e de comissões olhava a página antes de ela carregar, e o evento ficava sem arquivar. Agora a limpeza espera o título da página.

## Entrega 5.4 — Mural de avisos e painel da presidência (versão 5.0-teste.4)

Pelas respostas 34 a 36 (14/11/2026).

**O que entrou:**

- **Mural de avisos**, para todos com login:
  - **só a secretaria publica** (Art. 12, §5º). O secretário executivo tem o perfil;
  - o aviso tem título, texto, validade (vencido sai do mural) e pode ficar fixado no alto;
  - a secretaria escolhe, aviso a aviso, se ele vai **também para o site**;
  - cada aviso tem **"Enviar pelo WhatsApp"**, que monta o texto para o grupo, sem custo;
  - tirar do mural guarda o aviso.
- **Início:** os três avisos mais recentes, com o link para o mural.
- **No site:** a página inicial mostra os avisos que a secretaria mandou para o site. É mais um pedaço do site vivo.
- **Painel da presidência** (menu próprio, só a presidência):
  - **associados:** ativos, em dia (com a porcentagem), jubilados, igrejas e pedidos de associação em andamento;
  - **finanças:**
    - saldo do caixa, entradas e saídas do mês e contribuições vencidas;
    - as despesas esperando a autorização dela;
    - os pagamentos esperando a tesouraria;
  - **presença:** os últimos encontros com os presentes, quem tem faltas seguidas às assembleias e as justificativas pendentes;
  - **agenda e projetos:** as próximas assembleias e reuniões, os eventos com os inscritos (e o orçamento que espera a assembleia) e as comissões em atividade.

### Trava 2

- [x] Migração `20261114230000_mural_painel.sql`, aplicada no `comep-teste`. Verificador do Supabase: só o aviso já conhecido.
- [x] **4 testes novos do banco** (`testes/banco/mural_painel.test.ts`):
  - só a secretaria publica;
  - todos leem, e o site só vê o que foi mandado para ele;
  - vencido sai do mural e do site, e tirar arquiva;
  - o painel é só da presidência e tem as quatro partes.
- [x] 421 testes do banco e de unidade passando.

### Dados fictícios

`testes/dados/semente-mural-teste.sql`, aplicada no `comep-teste`: um aviso fictício, fixado e também no site. Os usuários fictícios dos testes não têm o perfil da secretaria; a publicação é testada no banco.

## Revisão geral da Fase 5 (14/11/2026)

Como em toda fase, a Fase 5 terminou com uma revisão geral independente (PROJETO.md, seção 14.4).

**Como foi feita:**

- Dois revisores independentes leram tudo o que a fase fez, sem ver o raciocínio de quem escreveu:
  - **banco e segurança:** as quatro migrações, com as regras de acesso, a pasta dos documentos das igrejas, a inscrição pública e o caixa;
  - **telas e regras:** a igreja, as comissões, os eventos, a agenda do site, o mural e o painel, comparando cada botão com o que o banco permite.
- O revisor do banco provou cada achado numa cópia local. O de telas leu o código e rodou os testes locais, sem gravar nada no banco de teste.
- Cada correção do banco ganhou um teste (`testes/banco/revisao_fase5.test.ts`). **Os 8 falham sem a migração da revisão** (conferido).

**O que se conferiu e estava certo:**

- O visitante sem login só chega à agenda, à inscrição e aos avisos do site, e nunca aos dados de quem se inscreveu.
- A pasta dos documentos das igrejas é privada.
- Só a secretaria publica no mural, e o painel é só da presidência.
- Um coordenador por comissão.
- O mesmo pagamento não entra duas vezes no caixa.
- As datas usam o fuso de Parauapebas, e as vagas e os prazos batem com o banco.

### Achados e correções

| Gravidade | O que acontecia | Correção | Teste |
|---|---|---|---|
| Bloqueante | O orçamento e a taxa digitados do jeito brasileiro viravam outro valor: **"1.500" virava R$ 1,50** | Os campos de valor usam o mesmo leitor do resto do sistema ("1.500", "1.500,00", "R$ 25,90") e avisam quando não entendem | — (conferido no código) |
| Importante | **Qualquer pessoa na internet podia lotar ou travar a inscrição pública**: um só freio para o evento todo, e a inscrição não paga segurava a vaga para sempre | Limite por origem (5 por hora; o endereço fica guardado só como resumo). A inscrição não paga deixa de segurar a vaga depois de 72 horas, e a secretaria cancela as vencidas de uma vez. **Falta o captcha antes do link ir para o público** (lançamento) | Banco (2) |
| Importante | **Cancelar o lançamento do pagamento** deixava a inscrição "paga" para sempre (sem consertar nem devolver) | Cancelar o lançamento devolve a inscrição para "aguardando o pagamento" | Banco |
| Importante | **Quem só criou uma conta no site** (sem ser do COMEP) lia os avisos internos, os membros das comissões e os eventos com o orçamento | Só quem é do COMEP (tem algum perfil) lê; quem só tem a conta usa o site | Banco |
| Importante | Quem pegava a **última vaga** não via o número da inscrição | A confirmação fica na tela mesmo quando as vagas acabam | — |
| Importante | O coordenador via "Tirar" em registros que não eram dele (e o banco recusava) | Só aparece nos registros dele; a diretoria tira qualquer um | — |
| Importante | O **aceite da LGPD** era pedido, mas não ficava guardado, e o texto não falava da igreja | Guarda quando e qual texto foi aceito, e o texto fala do nome, do telefone e da igreja. **O prazo de guarda vai à diretoria** (lançamento) | Banco |
| Importante | Ações sem volta com um toque só: cancelar a inscrição, tirar aviso do mural, tirar registro e membro da comissão | Pedem confirmação na própria linha | — |
| Menor | O orçamento podia ser aprovado por uma **assembleia antiga** | Só por uma assembleia do dia em que o orçamento foi definido ou depois | Banco |
| Menor | O painel contava as **transferências entre contas** como entradas e saídas | Ficam de fora, como na prestação de contas | Banco |
| Menor | **Cancelar o evento** não mexia nas inscrições, e a tesouraria ainda podia receber pagamento | As não pagas são canceladas junto, e evento cancelado não recebe pagamento | Banco |
| Menor | A mensagem **"este telefone já está inscrito"** confirmava a um desconhecido quem estava inscrito | Mensagem neutra | Banco |
| Menor | Duas gravações da diretoria da igreja ao mesmo tempo deixavam duas diretorias | Uma gravação de cada vez | — (conferido no código) |
| Menor | A categoria "Inscrições em eventos" podia não ser criada (se já existisse uma igual) e o pagamento falhava sem explicação | A categoria do sistema existe sempre. A forma de pagamento é aparada, e falta de conta no caixa tem mensagem clara | — |
| Menor | Mensagens longe do que se clicou (no celular, no alto da página) | Inscrições, minha inscrição e finanças do evento mostram a mensagem na própria seção | — |
| Menor | Lista de "Indicar um membro" desatualizada depois de incluir ou tirar | Atualiza na hora | — |
| Menor | Aviso vencido aparecia para a secretaria sem marca, e alterá-lo dava erro | Marcado como vencido; ao alterar, a validade fica em branco | — |
| Menor | "Alterar" um aviso não mostrava o formulário no celular | A tela rola até ele | — |
| Menor | Textos enganosos ("aguardando a assembleia (14/11/2026)", "o secretário executivo, se houver") e o responsável que não aparecia | Textos corrigidos; o responsável aparece na página do evento | — |
| Menor | O ministro não conseguia cancelar a própria inscrição não paga; o pagamento era sempre "hoje"; o formulário de aprovação aparecia com orçamento zero; "inscrições até" podia passar do início | Corrigido nas telas | — |
| Menor | O link do documento da igreja vencia em 10 minutos sem aviso | Renova sozinho | — |
| Menor | Textos longos nos avisos alargavam a página no celular | Quebram a linha | — |

**Pendências para antes de o link público ir para as pessoas** (no roteiro do lançamento, `docs/lancamento.md`):

- **Captcha na inscrição do site.** O limite por origem já segura o abuso comum; o captcha (Cloudflare Turnstile, gratuito) precisa de uma função no servidor e de uma chave.
- **Prazo de guarda das inscrições públicas** (LGPD). A auditoria também guarda uma cópia. A diretoria decide o prazo; a sugestão é 12 meses depois do evento.

**Riscos aceitos e registrados:**

- **Despesa acima do orçamento:** a tela avisa, mas o banco não bloqueia. A despesa já passa pela autorização da presidência (Art. 12, §2º, VI).
- **O teste do mural** conta com o aviso fictício fixado entre os primeiros. Se alguém fixar outros três no banco de teste, o teste precisa de ajuste.

**Ponta a ponta, na cópia local, depois das correções:**

- Todos os testes passaram no computador e no celular, com 2 pulados de propósito.
- O teste do menu da presidência foi atualizado: "Projetos" não está mais "em construção", e o menu mostra eventos, comissões, mural e painel.
- O teste do mural confere o mural, o painel, o Início e o site.

**Migração:** `20261114233000_revisao_fase5.sql`, aplicada no `comep-teste`. Verificador do Supabase: só o aviso já conhecido.

