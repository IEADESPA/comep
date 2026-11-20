# Telas novas — roteiro de aprovação

Combinado com o usuário em 17/11/2026, para não precisar perguntar de novo.

## Como cada rodada funciona

- **Uma tela (ou um módulo) por vez.** A próxima só começa depois que a anterior foi aprovada.
- A proposta vem numa **página de propostas**, no modelo do "Propostas de Tela IEADESPA".
- **Em cada tela:**
  - 3 opções para comparar;
  - modo claro e modo escuro;
  - notebook e celular;
  - tela cheia.
- **Aprovar:** o usuário toca em "Aprovo esta opção" e escreve, se quiser, o que mudar.
- **Onde fica guardado:** a escolha e as observações ficam no próprio artefato. Claude lê de lá antes de seguir.
- **Num módulo:** primeiro a tela principal do módulo, depois os submódulos e as telas de dentro (fichas, formulários, detalhes). Só depois vem o módulo seguinte.
- **Dados de mentira:** os nomes, números e datas das propostas são inventados.

## Regras que valem para todas as telas

- **Colunas separadas:** o menu da esquerda é uma coluna própria e a tela da direita é outra. Cada uma rola sozinha; nunca uma tela única que rola junta.
- **Celular: a navegação fica EM CIMA, nunca numa barra embaixo** (observação geral do usuário, 17/11/2026).
  - Por quê: embaixo ficam os botões do próprio aparelho (voltar, início, apps abertos), e a pessoa toca no errado. Vale também para o aplicativo (APK).
  - Os botões da tela ficam na parte de cima: o cabeçalho com o sino e o botão "Menu", e as abas logo abaixo dele.
  - "Votar" não é botão principal: o aviso de votação chega pelo sino (notificação) e pelos módulos.
- **Menu da esquerda CURTO** (17/11/2026). Só três coisas:
  - Início;
  - a tela que está aberta;
  - Meu perfil.
  - Os módulos ficam na **página inicial**. No celular, o Menu também é curto: Início, Módulos, Avisos e Meu perfil.
- ~~Abas = submódulos~~ (17/11/2026), **substituída em 18/11/2026 pelo menu do módulo** ("o módulo toma a coluna"):
  - ao entrar num módulo, a coluna vermelha da esquerda vira o menu dele: "← Início", o bloco do módulo com "N funções", as funções grandes (com o número quando há pendência) e, embaixo, Meu perfil e o cartão com "Sair";
  - as subfunções abrem embaixo da função aberta, com recuo e um traço à esquerda (sanfona);
  - no celular, logo abaixo da barra vermelha, um botão de largura inteira com a função aberta e "N funções" abre a lista das funções;
  - **as abas ficam só dentro das fichas** (ficha do ministro, da igreja, Meu perfil, Minha igreja).
  - A lista das funções de cada módulo fica num lugar só: `src/componentes/menu.ts` (`MODULOS`).
- **Cores do COMEP:** vermelho (principal), branco e cinza.
- **Modos:** claro e escuro.
- **Telas:** notebook e celular.

## A ordem

O site fica por **último**: ele já funciona e está aceitável.

| Nº | Tela ou módulo | O que entra |
| --- | --- | --- |
| 1 | **Entrar no sistema** | Entrar (e-mail e senha), primeiro acesso (código da secretaria), nova senha |
| 2 | **Início do sistema** (logo depois de entrar) | Início da diretoria (presidência e secretaria), do ministro e do pastor presidente, e de quem ainda não tem perfil (candidato) |
| 3 | **Meu perfil** | Dados, foto, igreja, senha, pedido de correção |
| 4 | **Minha credencial** | Credencial digital com QR Code e a impressão |
| 5 | **Minhas mensalidades** | Situação, plano, envio de comprovante |
| 6 | **Minha igreja** (pastor presidente) | Dados, documentos, diretoria e ministros da igreja |
| 7 | **Ministros e inscrições** | Lista de ministros, novo ministro, ficha do ministro; pedidos de associação e o detalhe |
| 8 | **Credenciais** | Lista, impressão, editor do modelo, credencial de um ministro |
| 9 | **Igrejas** | Lista, nova igreja, a igreja como instituição |
| 10 | **Financeiro** | Contribuições, caixa, despesas e prestação de contas |
| 11 | **Patrimônio** | Pedidos, pedir emprestado, agenda, bens, regras, detalhe do empréstimo |
| 12 | **Assembleias** | Lista, preparar, detalhe, presença, condução, faltas e justificativas, pedidos de AGE |
| 13 | **Votações e enquetes** | Lista, nova, a votação (votar e o resultado) |
| 14 | **Diretoria** | Conselho Diretor e Conselho Fiscal, mandatos |
| 15 | **Comissões** | Lista, nova, a comissão |
| 16 | **Eventos e projetos** | Lista, novo, o evento (inscrições, orçamento e finanças) |
| 17 | **Mural de avisos** | O mural e publicar um aviso |
| 18 | **Painel da presidência** | Os quatro blocos |
| 19 | **Administração** | Configurações, perfis de acesso, auditoria |
| 20 | **Telas de quem ainda não é membro** | Meu pedido de associação, validar credencial (QR Code) |
| 21 | **Site** (por último) | Página inicial, como se associar, agenda e evento, convocação, diretoria, igrejas |

**Módulos novos aprovados em 18/11/2026** (entram na lista; o desenho de cada um vem nas rodadas seguintes):

| Módulo | O que entra |
| --- | --- |
| **Central de regularização** (dentro do módulo Igrejas) | As suspensas com a contagem dos 30 dias, o que vence em 60 dias, a natureza jurídica com prazo, o que falta da transição e as igrejas sem registro, para chamar para perto. Depois, a biblioteca de modelos (estatuto, ata). |
| **Relações institucionais** | Ofícios (só para fora, em nome do COMEP, com modelos e número automático), demandas ao poder público (com apoio mínimo dos ministros em dia e a reunião mensal), conselhos municipais (a cadeira é da associação) e utilidade pública. |
| **Relatórios** | Todos os gráficos e relatórios do conselho, ajustáveis; o relatório de representatividade fica nele. Rodada 16, com o portal da transparência e a página pública "Igrejas cadastradas". |
| **Mapa** | As igrejas, as filiais e as ações sociais como pontos no mapa da cidade (a localização das filiais já é guardada). |
| **Formação** | A formação das diretorias e os treinamentos básicos, com o histórico ministerial e os certificados. |
| **Agenda evangélica** | Os eventos do COMEP, os empréstimos (com a agenda de cada item) e os eventos gerais das igrejas (cerca de 10 por igreja; o evento que pede patrocínio sempre). |

## Andamento

- 17/11/2026: lista combinada.
- 17/11/2026: **tela 1, Entrar no sistema — aprovada a Opção 3, "Vermelho forte"**, sem observação.
  - Notebook: metade esquerda no vermelho do COMEP, com o símbolo grande, o nome do Conselho e a frase; o formulário fica à direita.
  - Celular: o vermelho no alto e o formulário numa folha branca que sobe.
- 17/11/2026: **tela 2, Início do sistema — aprovada a Opção 2, "Menu vermelho e blocos por assunto"**. Ela vira a **moldura do sistema**:
  - menu da esquerda no vermelho do COMEP, com o item aberto marcado;
  - em cima, a barra branca com busca, claro/escuro e o sino;
  - o conteúdo em blocos: o que precisa de você, a agenda dos próximos dias e os módulos agrupados por assunto;
  - no celular: barra vermelha em cima, com o sino, o Menu e as abas.
  - Na observação, o usuário disse que essa tela do celular vale para todos os tipos de tela.
- 17/11/2026: **tela 3, Meu perfil — 3 opções** (ficha com abas, tudo em blocos, lista de ajustes), esperando a aprovação.
- 17/11/2026: **mudança no ritmo, a pedido do usuário.**
  - As **telas gerais** (as que não são de módulo) vêm **todas juntas numa rodada só**, para aprovar de uma vez. Uma a uma ficava lento.
  - Os **módulos** entram depois, um por vez, cada um com as telas de dentro dele.
  - **Rodada 4 publicada** com as telas gerais: 3 Meu perfil, 4 Minha credencial, 5 Minhas mensalidades, 6 Minha igreja, 7 Menu do celular e avisos do sino, 8 Primeiro acesso e esqueci a senha, 9 Meu pedido de associação, 10 Validar a credencial (QR Code).
  - A tela 8 traz uma proposta só, porque segue a tela de entrar aprovada.
- 17/11/2026: **rodada 4 aprovada.** Ficaram com ajustes pedidos:
  - **Meu perfil:** abas, com todas desenhadas.
  - **Credencial:** a opção 1. No notebook, frente e verso; no celular, só a frente.
  - **Mensalidades:** a opção 1 no notebook e a opção 3 no celular.
  - **Minha igreja:** abas, com as cinco desenhadas, inclusive a diretoria da igreja com o mandato (ministros da igreja ou nome completo) e a conferência da secretaria, e a agenda (os empréstimos do patrimônio e os eventos).
  - **Pedido de associação:** a opção 2, com o selo da secretaria em cada documento e em cada dado. A análise termina quando tudo for aprovado.
  - **Aprovados sem mudança:** o menu e os avisos (opção 1), o primeiro acesso e esqueci a senha, e a validação da credencial (opção 3, a credencial com carimbo).
- 17/11/2026: **rodada 5 publicada** com esses ajustes, mais o Início com o menu curto. As abas funcionam na própria prévia.
- 18/11/2026: **rodada 5 aprovada** (as 6 telas). Observações:
  - **Correções no cadastro: nada de texto livre**, porque a pessoa digita errado.
    - Na aba Correções, ela **escolhe o dado** (telefone, nome, título…), vê **como está** e digita **como deve ficar**. A secretaria aceita ou recusa.
    - Aceita, a correção entra sozinha no cadastro.
    - Isso muda o pedido de correção do sistema (`pedidos_correcao`): ele ganha o campo, o valor de hoje e o valor pedido.
  - **Minha igreja:** as agendas melhoram depois, quando o módulo de agenda for revisto.
- 18/11/2026: **rodada 6, o primeiro módulo: Ministros e inscrições**, com todas as abas.
  - Depois vêm os outros módulos: Credenciais, Igrejas, Financeiro, Patrimônio, Assembleias, Votações e enquetes, Diretoria, Comissões, Eventos e projetos, Mural de avisos, Painel da presidência e Administração. O site fica por último.
- Antes disso, por engano, foi feito um quadro de design com as telas iniciais todas de uma vez ("COMEP — Telas novas"). Ele está fora do modelo combinado e não vale como proposta.
- 18/11/2026: **as telas aprovadas começam a entrar no sistema** (só no site de teste):
  - parte 1 (versão 5.5.0-teste.5): a moldura (menu curto, topo com busca, claro/escuro e sino; no celular, a barra vermelha em cima), o sino e o Menu do celular, Entrar, Primeiro acesso e Esqueci a senha, e o Início;
  - parte 2 (versão 5.5.0-teste.6): as telas gerais (Meu perfil, Minha credencial, Minhas mensalidades, Minha igreja, Meu pedido e Validar credencial);
  - parte 3 (versão 5.5.0-teste.7): o menu do módulo em todos os módulos e o módulo Ministros e inscrições (a tabela, os pedidos de associação, as correções pedidas, o cadastro passo a passo e a ficha em abas);
  - parte 4 (versão 5.5.0-teste.8): o banco da correção estruturada (aceita, entra sozinha no cadastro) e da análise do pedido de associação item por item ("Mandar para a AGO" só com tudo aprovado);
  - o registro de cada parte, com as decisões tomadas sem o desenho e o que depende do banco, está em `docs/revisoes/fase-5.5.md` (entregas 5.5.5, 5.5.6 e 5.5.7).
- 18/11/2026: **regra nova do usuário: todo ministro precisa estar ligado a uma igreja** (não existe ministro "desigrejado"). No Cadastrar ministro e no pedido de associação, a igreja é obrigatória (o banco já exigia).
- 18/11/2026: **rodada 6 aprovada** (Ministros e inscrições: a tabela, a ficha em abas e a análise do pedido item por item; o Cadastrar ministro foi refeito na rodada 7, passo a passo).
- 18/11/2026: **rodada 7 aprovada** (o Cadastrar ministro passo a passo e o módulo Credenciais). O editor do modelo da credencial ficou para ser refeito.
- 18/11/2026: **rodada 8 aprovada**: os modelos da credencial no editor de tela inteira, a impressão com marcas de corte, o módulo Igrejas e a igreja aberta pela secretaria (na agenda, a secretaria registra direto, sem "pedir emprestado"). O cadastro da igreja deve ser completo, com os documentos, e o próprio pastor também cadastra.
- 18/11/2026: **rodada 9 aprovada**: "Quem recebe" cada modelo, a impressão (4 por folha, 5 mm, sangria), o cadastro completo da igreja em 5 passos, o pastor que cadastra a igreja dele e a análise da igreja nova item por item. O Financeiro em abas foi reprovado.
- 18/11/2026: **rodada 10 aprovada**: a navegação de TODOS os módulos ("o módulo toma a coluna"), a impressão em folha nova, o mandato pelo menor prazo, a igreja sem registro, os arquivos de até 25 MB em partes e a biblioteca de símbolos.
- 18/11/2026: **rodada 11 aprovada**: as 6 funções do Financeiro, o "mesmo mandato para todos" com exceção e a natureza jurídica.
- 18/11/2026: **rodada 12 aprovada**: a igreja suspensa (o caminho de volta, com a contagem dos 30 dias), os documentos com a validade em cartões, o painel do módulo Igrejas com a Central de regularização, a credencial do ministro em readequação e as filiais em cartões.
- 18/11/2026: **rodada 13 aprovada**: o Patrimônio completo (bens em cartões, o histórico e a agenda do bem, as etiquetas, o contrato passo a passo e a devolução), o Conselho Fiscal (o ano e a página do mês) e o documento antecipado (o passo a passo, aberto pelo cartão do documento).
- 18/11/2026: **rodada 14 aprovada**: a página do bem, o contrato com a digital, a devolução em 3 etapas, as etiquetas (a mesma em todos os bens de quantidade), o Conselho Fiscal, a página do documento em abas e o módulo Relações institucionais.
- 18/11/2026: **rodada 15 aprovada**: a presença na assembleia (QR, código da portaria e a secretaria), a condução com o roteiro e o telão, o fechamento com o gerador de texto da ata, as notificações, os ofícios e as demandas (que passam pela secretaria e pela reunião mensal).
- 19/11/2026: **a construção do lote das Igrejas e da regularização** (só no site de teste):
  - parte 5 (versão 5.5.0-teste.9): o banco da regularização (a situação calculada pela data, os 30 dias, o documento antecipado, o menor mandato, a natureza jurídica, a igreja sem registro, a igreja nova em análise e as filiais) e as telas da secretaria: o painel do módulo, a tabela por situação, a Central de regularização, o "Para conferir", a análise da igreja nova, o cadastro completo em 5 passos e o simples, a igreja em abas (com a Situação e a conferência da diretoria) e as Denominações com a tradição;
  - parte 6 (versão 5.5.0-teste.10): as telas do pastor presidente (os documentos em cartões e a página do documento com o envio antecipado, a igreja suspensa, as filiais e o cadastro da igreja pelo próprio pastor);
  - o registro de cada parte, com as decisões tomadas sem o desenho, está em `docs/revisoes/fase-5.5.md` (entregas 5.5.8 e 5.5.9).
- 19/11/2026: **a construção do lote das Credenciais** (só no site de teste):
  - parte 7 (versão 5.5.0-teste.11): o banco dos modelos por grupo (quem recebe, a ordem, o exclusivo de igreja e a readequação) e o módulo no menu da coluna: a lista em tabela, Validade e verso (saiu de Configurações), a galeria dos modelos, "Quem recebe" e o editor na tela inteira, com o tamanho do cartão em mm; a credencial do ministro em readequação, cinza, com a faixa;
  - parte 8 (versão 5.5.0-teste.12): a impressão nova (4 por folha, folha nova ou pedaço cortado), a biblioteca de símbolos e os logotipos, e a faixa da readequação na conferência pelo QR;
  - o registro de cada parte, com as decisões tomadas sem o desenho, está em `docs/revisoes/fase-5.5.md` (entregas 5.5.10 e 5.5.11).
- 20/11/2026: **a construção do lote do Financeiro e do Conselho Fiscal** (só no site de teste):
  - parte 9 (versão 5.5.0-teste.13): as 6 funções do Financeiro no desenho aprovado na rodada 11 — Contribuições (o painel), Comprovantes (a lista), Caixa (o extrato), Despesas (os cartões), Orçamento (os cartões por categoria, com o plano anual de trabalho em atividades e o "Mandar para a assembleia") e Prestação de contas (as etapas e os números), cada uma com as subfunções na coluna;
  - o registro, com as decisões tomadas sem o desenho, está em `docs/revisoes/fase-5.5.md` (entrega 5.5.12).
