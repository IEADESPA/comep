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
- Ler o QR Code com a câmera dentro do app não dá para testar automaticamente (precisa de câmera). O caminho pela câmera do celular, que abre a página de validação, foi testado.
