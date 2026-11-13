# Revisão da Fase 4 — Assembleias, reuniões e diretoria (versão 4.0-teste)

> Calendário (PROJETO.md, seção 9): tudo no ambiente de teste, com dados fictícios, até a Fase 5.
> Cada entrega passa pelas travas 1 a 3. No fim da fase, há uma revisão geral independente (seção 14.4).
> Decisões: PROJETO.md, seção 4.6. **O estatuto pode ser reformado** (13/11/2026): os números dele ficam em Configurações.

## Entrega 4.1 — Assembleias e reuniões: convocação, pauta e edital (versão 4.0-teste.1)

**Resultado: aprovada no ambiente de teste em 13/11/2026.**

O que entrou:

- **Onde fica:** o menu **Assembleias**, para o ministro, a secretaria e a presidência. Mostra os próximos encontros e os anteriores.
- **Três tipos de encontro:**
  - Assembleia Geral Ordinária (AGO);
  - Assembleia Geral Extraordinária (AGE);
  - reunião mensal: sem efeito de assembleia, sem votação.
- **Preparar** (secretaria ou presidência):
  - tipo, data e hora da 1ª chamada, título e local;
  - para a AGE, **quem pediu**: 3/5 dos associados ou a maioria do Conselho Diretor (Art. 16, §3º);
  - **pauta**: cada item diz se vai a votação e com que maioria (simples, 3/5 ou 2/3);
  - **texto do edital**: o sistema escreve a partir dos dados, com a data por extenso, a 1ª e a 2ª chamada, a pauta numerada e o Art. 11, e a secretaria pode ajustar;
  - o formulário já avisa o prazo: "precisa ser publicada até dd/mm" ou "a partir de dd/mm".
- **Convocar:**
  - assembleia: **só o presidente** (Art. 16, §2º), com confirmação;
  - **o banco recusa:**
    - menos de 30 dias de antecedência;
    - AGO fora da 2ª quinzena de abril ou outubro;
    - sem pauta, sem edital, ou AGE sem dizer quem pediu;
  - convocada, **não muda mais**. Para mudar, cancela-se e convoca-se de novo, com novo prazo.
- **Site:**
  - a assembleia convocada aparece na página inicial, em "Assembleias";
  - tem uma página própria com o edital e a pauta, para qualquer pessoa, sem login;
  - a cancelada aparece como "cancelada", com o motivo.
- **WhatsApp:** botão "Compartilhar no WhatsApp", com o título, a data, o local e o link do edital. É um link gratuito, sem serviço pago.
- **Imprimir o edital.**
- **Reunião mensal:**
  - a secretaria marca e publica, sem o prazo de 30 dias;
  - não aceita item de votação;
  - pode criar as dos próximos meses de uma vez, na mesma semana e no mesmo dia da semana (ex.: toda 1ª terça);
  - não vai para o site.
- **Cancelar** pede motivo. **Arquivar**, só rascunho ou encontro cancelado, tira das listas. Nada se apaga.
- **Configurações → Assembleias e reuniões:** os números do estatuto, com o valor de 2021 como padrão:
  - antecedência: 30 dias;
  - meses da AGO: abril e outubro, a partir do dia 16;
  - minutos até a 2ª chamada: 60;
  - faltas seguidas: 2 para avisar e 3 para a pauta.

  Se o estatuto mudar, a secretaria ou a presidência ajusta ali.

### Trava 2

- [x] Migração `20261113210000_encontros.sql`, aplicada no `comep-teste`.
- [x] **13 testes novos do banco** (`encontros.test.ts`):
  - a secretaria prepara, e o ministro não prepara nem vê o rascunho;
  - data passada, sem título ou sem local é recusado;
  - alterar a pauta guarda a anterior;
  - a secretaria não convoca assembleia;
  - menos de 30 dias é recusado;
  - AGO fora da quinzena é recusada;
  - AGE sem quem pediu, sem pauta ou sem edital é recusada;
  - convocada, todos veem, o site mostra e ela não muda mais;
  - a antecedência vem da configuração, e o ministro não a muda;
  - reunião mensal: sem prazo e sem votação;
  - cancelar pede motivo, é do presidente e o site mostra "cancelada";
  - arquivar: só rascunho ou cancelado, e nada se apaga;
  - o visitante só chega às convocações públicas.
- [x] **9 testes de unidade** (`encontros.test.ts`):
  - datas no fuso de Parauapebas;
  - avisos de prazo;
  - texto do edital;
  - reuniões repetidas, inclusive quando o mês não tem a 5ª semana.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #25 — Fase 4.1: assembleias e reuniões | Aprovado (verificar + ponta a ponta), publicado e conferido no site de teste (39 de 39 nos testes de assembleias, site e portal) | 13/11/2026 |

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A presidência prepara uma AGE com pauta (item com 2/3) e o texto do edital gerado; o formulário mostra o prazo | ✅ |
| O ministro não vê o rascunho | ✅ |
| Convocar (com confirmação): o botão do WhatsApp aparece; o site mostra a convocação, sem login, com a pauta e o edital; o ministro passa a ver | ✅ |
| Cancelar com motivo: o site mostra "Assembleia cancelada"; arquivar tira das listas | ✅ |
| AGE com menos de 30 dias: o formulário avisa e o banco recusa a convocação | ✅ |
| Reunião mensal: sem item de votação, criada com as dos próximos meses (mesmo título, com o mês) e publicada sem prazo; não vai para o site | ✅ |

- **92 testes de ponta a ponta** passando no computador e no celular.

### Dados fictícios

`testes/dados/semente-encontros-teste.sql`, aplicada no `comep-teste`:

- **AGO de 22/04/2027, convocada:** aparece no site, com pauta (balanço e parecer, orçamento, admissão, informes) e edital;
- **AGE de reforma do estatuto (exemplo), em rascunho:** item de 2/3;
- **reuniões mensais (1ª terça, 19h30):** dezembro e janeiro publicadas, fevereiro em rascunho.

Tudo com o local "Sede fictícia do COMEP (teste)".

## Entrega 4.2 — Presença e faltas (versão 4.0-teste.2)

**Resultado: aprovada no ambiente de teste em 13/11/2026.**

O que entrou:

- **O associado:**
  - na página do encontro, em "Minha participação": **"Vou participar"** (e "Não vou mais") e **"Justificar a falta"**, antes do encontro ou até 30 dias depois;
  - vê a situação da justificativa: em análise, aceita ou recusada (com o motivo);
  - **no Início**, vê o aviso de faltas seguidas (a partir de 2).
- **A secretaria (ou a presidência) — lista de presença** de cada encontro convocado:
  - **abre no dia**, 6 horas antes, e fecha quando é encerrada;
  - **check-in pelo QR Code** da credencial:
    - com a **câmera do celular**: o QR abre a página de validação, que, para a secretaria logada, mostra o botão **"Marcar presença em …"**. Funciona em qualquer celular;
    - **na própria lista**, com o botão "Ler o QR Code das credenciais", nos navegadores com leitor embutido (Chrome e Edge). A mesma credencial não registra de novo por 3 segundos;
  - **pela busca** do nome ou do nº, com "Marcar presente" e "Desfazer" (para engano);
  - mostra quantos estão presentes, quantos deles estão em dia (votam) e quem confirmou. Quem está em atraso aparece marcado;
  - **"Encerrar a lista"** (com confirmação): o encontro fica **realizado** e quem não esteve presente tem **falta**.
- **Faltas e justificativas** (menu Assembleias, para a secretaria e a presidência):
  - **justificativas para decidir:** aceitar, ou recusar com motivo. Decide o 1º secretário (diretoria, 11/11/2026); até a 4.4 (cargos), é o perfil Secretaria. Ninguém decide a própria;
  - **faltas seguidas às reuniões mensais**, sem justificativa aceita: "Avisar o associado" a partir de 2 e "Levar à pauta da assembleia" a partir de 3 (Art. 8º, IV). Os números estão em Configurações;
  - contam só as reuniões mensais encerradas depois da admissão; a assembleia e a reunião cancelada não contam. Se a regra vale também para as assembleias é a **pergunta 22**.

### Trava 2

- [x] Migração `20261113230000_presencas.sql`, aplicada no `comep-teste`.
- [x] **12 testes novos do banco** (`presencas.test.ts`):
  - confirmar "vou participar", e quem não é associado não confirma;
  - marcar pela lista, no dia; o ministro não marca; e encontro distante ainda não abriu;
  - pelo QR Code: devolve o nome; a segunda leitura diz "já presente"; código inválido é recusado;
  - a página do QR sabe qual encontro está aberto (só para a secretaria);
  - desfazer e encerrar: o encontro fica realizado e a lista fecha;
  - a lista de presença é só da secretaria e da presidência;
  - cada um vê só as próprias presenças, e o visitante não vê nada;
  - quem esteve presente não justifica; quem faltou justifica e pode reescrever;
  - o 1º secretário decide, recusar pede motivo, e a decidida não muda;
  - faltas seguidas param na presença ou na justificativa aceita;
  - a assembleia e a reunião cancelada não contam;
  - as próprias faltas, e a lista de todos só para a secretaria.
- [x] **1 teste de unidade:** o código da credencial lido do QR Code.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| Lista de presença: marcar o ministro pela busca e desfazer | ✅ |
| Check-in pelo QR Code: a presidência abre a página de validação da credencial do ministro e usa "Marcar presença em …"; a lista mostra "(QR Code)"; o ministro vê "Você esteve presente" | ✅ |
| O ministro confirma "Vou participar", justifica a falta, vê "em análise"; a presidência aceita e o ministro vê "aceita" | ✅ |
| O ministro não abre as faltas de todos | ✅ |

- **98 testes de ponta a ponta** passando no computador e no celular; **323** do banco e de unidade.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #26 — Fase 4.2: presença e faltas | Aprovado (verificar + ponta a ponta), publicado e conferido no site de teste (17 de 17 nos testes de presença e assembleias) | 13/11/2026 |
- Ler o QR Code com a câmera dentro do app não dá para testar automaticamente (precisa de câmera). O caminho pela câmera do celular, que abre a página de validação, foi testado.

## Entrega 4.3 — Quórum, votações, desligamentos e ata (versão 4.0-teste.3)

**Resultado: aprovada no ambiente de teste em 13/11/2026.**

O que entrou:

- **Onde fica:** "Conduzir: quórum, votações e ata", na página da assembleia (AGO ou AGE), para a secretaria e a presidência.
- **1. Quórum de instalação** (Art. 16, §4º):
  - mostra os aptos (ativos e em dia), os presentes e quantos a 1ª chamada precisa: metade mais um;
  - **"Instalar a assembleia"**:
    - com quórum, instala em 1ª chamada;
    - sem quórum, mostra quantos faltam e a hora da 2ª chamada;
    - passados os minutos das regras (60), instala em 2ª chamada, com qualquer número;
  - a conta do momento fica guardada.
- **2. Votações** de cada item da pauta que vai a votação:
  - a favor, contra e abstenções;
  - **votam só os presentes em dia** (Art. 11): o sistema recusa mais votos que isso;
  - **maiorias:**
    - simples: mais a favor que contra;
    - **3/5 e 2/3 sobre os presentes aptos** (pergunta 24), com a conta mostrada (ex.: "3/5 dos 25 presentes aptos = 15 votos a favor");
  - corrigir guarda a votação anterior.
- **Desligamento (Art. 8º):**
  - num item de 3/5 da **AGO**, escolhe-se o associado e o motivo (I a pedido, II conduta, III transferência, IV três faltas);
  - aprovado, o associado fica **desligado**, perde o perfil de ministro e a credencial passa a mostrar "inativa";
  - essa votação não se refaz;
  - **falecimento (V):** registrado na ficha do ministro, sem votação (pergunta 5).
- **3. Ata** (Art. 12, §2º, IV e §4º):
  - **"Gerar o texto da ata"**: data, local, instalação (chamada e quórum) e cada item com o resultado e a conta, incluindo o desligamento. O 1º secretário completa e ajusta;
  - **assinaturas:** "Assinar como 1º secretário" (perfil Secretaria até a 4.4) e "Assinar como presidente". São **duas pessoas diferentes**;
  - depois da primeira assinatura, o texto não muda; com as duas, nada muda, e as votações ficam travadas;
  - **anexar a ata assinada no papel** (PDF ou foto), numa pasta privada;
  - **assinada, todos os associados leem** a ata e o resultado na página da assembleia.

### Trava 2

- [x] Migração `20261114100000_conducao_assembleia.sql`, aplicada no `comep-teste`, com a pasta privada `atas`.
- [x] **13 testes novos do banco** (`conducao.test.ts`):
  - **quórum:**
    - conta só os aptos (o presente em atraso não conta);
    - sem quórum antes da 2ª chamada: recusa;
    - com quórum: instala em 1ª chamada, e não instala duas vezes;
    - depois do prazo: instala em 2ª chamada;
  - **votações:**
    - item sem votação, ou votos demais: recusado;
    - maioria simples;
    - correção guarda a anterior;
    - 2/3 dos presentes aptos;
  - **desligamento:** só em item de 3/5 da AGO; perde o perfil; não se refaz;
  - **falecimento:** só a secretaria, e sem data futura;
  - **ata:**
    - o ministro não vê o rascunho;
    - assinaturas pelo perfil certo e por duas pessoas, mesmo quando uma pessoa tem os dois perfis;
    - o texto trava;
    - assinada, todos leem e as votações travam;
    - o arquivo só entra na pasta da assembleia.
- [x] **2 testes de unidade:**
  - metade mais um e o arredondamento de 3/5 e 2/3;
  - o texto da ata.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| Antes da hora, "Instalar" avisa que a assembleia ainda não começou | ✅ |
| Depois do início, sem quórum, instala em 2ª chamada (o teste zera por alguns minutos o prazo nas Regras e devolve 30 dias e 60 minutos) | ✅ |
| O ministro fictício está em atraso: aparece "Em atraso: não vota"; 1 voto a favor é recusado ("só 0 presentes em dia podem votar"); a votação sem votos fica "rejeitado" | ✅ |
| "Gerar o texto da ata" traz a instalação em 2ª chamada e o item rejeitado; salvar e assinar como presidente; o texto trava | ✅ |
| A página da assembleia mostra o resultado | ✅ |

- O desligamento, que não tem volta, é testado só no banco.
- A assinatura do 1º secretário também: não há usuário fictício só com o perfil Secretaria nos testes de ponta a ponta.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #27 — Fase 4.3: quórum, votações, desligamentos e ata | Aprovado (verificar + ponta a ponta) e publicado | 13/11/2026 |

### Decisões em aberto

- **Pergunta 24 (nova):** nas maiorias de 3/5 e 2/3, a base é os presentes aptos (como está) ou os votos válidos?
- **Pergunta 5:** previsão de que os casos I a IV vão à votação e o falecimento é registrado direto.

## Entrega 4.4 — Diretoria e Conselho Fiscal: mandatos e perfis pelo cargo (versão 4.0-teste.4)

**Resultado: aprovada no ambiente de teste em 13/11/2026.**

O que entrou:

- **Menu Diretoria**, para todos com login. Mostra:
  - quem está **em exercício**, na ordem do Art. 12: presidente, vice, 1º e 2º secretários, 1º e 2º tesoureiros, secretário executivo e os 3 conselheiros fiscais;
  - o **histórico** e os **próximos mandatos**.
- **A presidência registra a diretoria eleita:**
  - a posse;
  - o fim, sugerido para 4 anos depois (Art. 12);
  - a assembleia que elegeu;
  - quem ficou em cada cargo.
- **Regras na hora de registrar:**
  - **só associados em dia podem ser votados** (Art. 11);
  - um por cargo no período, e 3 no Conselho Fiscal;
  - ninguém acumula dois cargos, nem diretoria e Conselho Fiscal, inclusive contra os perfis dados à mão. O Conselho Fiscal fiscaliza a diretoria.
- **Perfis pelo cargo:**
  - o mapa:
    - presidente e vice → Presidência;
    - 1º e 2º secretários → Secretaria;
    - 1º e 2º tesoureiros → Tesouraria;
    - conselheiros → Conselho Fiscal;
  - **o acesso começa na posse e termina sozinho no fim do mandato**, sem ninguém mexer;
  - **encerrar antes** (renúncia, desligamento), com motivo, tira o perfil a partir da data;
  - quem é **desligado do COMEP** perde o perfil do cargo;
  - o secretário executivo fica registrado; o perfil próprio dele fica para depois;
  - os perfis dados à mão em "Perfis de acesso" continuam valendo, e a tela explica isso.
- **Credencial:** se o fim do mandato nas credenciais não é o da diretoria em exercício, a tela avisa para registrar o novo mandato em Configurações → Credencial.

### Trava 2

- [x] Migrações `20261114120000_mandatos.sql` e `20261114120100_mandatos_nomes.sql`, aplicadas no `comep-teste`.
- [x] **11 testes novos do banco** (`mandatos.test.ts`):
  - só a presidência registra;
  - quem está em atraso não pode ser votado;
  - registra os cargos;
  - um por cargo, 3 no Conselho Fiscal, e ninguém acumula;
  - o cargo dá o perfil e aparece no menu;
  - com o perfil, a pessoa faz o que ele permite;
  - mandato futuro ainda não dá perfil, e mandato vencido não dá mais;
  - encerrar tira o perfil;
  - desligado perde o perfil;
  - Conselho Fiscal e diretoria não se cruzam, nem com o perfil dado à mão;
  - todos veem a diretoria, até o associado sem cargo.
- [x] **Achado pelo teste de ponta a ponta e corrigido:** o ministro via a lista da diretoria vazia. A lista cruzava com o cadastro de pessoas, que o ministro só lê o próprio. Agora uma função mostra só o nome de quem tem cargo. O teste do banco passou a usar um associado sem cargo, e ele falha sem a correção (conferido).
- [x] Todos os testes do banco continuam passando com a regra nova dos perfis, que vale para o sistema inteiro.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| A presidência vê quem está em exercício (presidente, conselheiros) | ✅ |
| Registrar a diretoria com o ministro fictício, que está em atraso: o banco recusa ("não pode ser votado (Art. 11)") e nada se grava | ✅ |
| O fim do mandato vem sugerido (4 anos) | ✅ |
| O ministro vê a diretoria, mas não o formulário de registro | ✅ |

### Dados fictícios

`testes/dados/semente-diretoria-teste.sql`, aplicada no `comep-teste`:

- 7 cargos do Conselho Diretor e 3 do Conselho Fiscal;
- associados fictícios em dia, sem login;
- mandato de 01/01/2026 a 31/12/2029, a mesma data fictícia das credenciais.

A diretoria verdadeira depende da pergunta 10.
