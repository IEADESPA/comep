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
