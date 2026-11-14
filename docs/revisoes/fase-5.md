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
