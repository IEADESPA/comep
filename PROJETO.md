# PROJETO — Sistema de Gestão do Conselho de Ministros Evangélicos de Parauapebas (COMEP)

> Documento-base do sistema. Serve para a diretoria aprovar o escopo e para orientar o desenvolvimento no VS Code (com Claude Code).
> Versão 0.36 — 21 de novembro de 2026 — atualizado com a **blindagem do Financeiro (entrega 5.5.15: toda entrada e toda saída de qualquer módulo chega sozinha ao caixa, com a origem, pela função única)**, as **notificações (entrega 5.5.14: o sino com o lido por pessoa, os avisos no celular pelo navegador e o WhatsApp da secretaria)**, a **regularização das igrejas (entregas 5.5.8 e 5.5.9: os 3 níveis, a suspensão com os 30 dias, o documento antecipado, o menor mandato, a natureza jurídica, a igreja sem registro, o cadastro pelo pastor e as filiais)**, a **entrega 5.5.4 (site vivo: diretoria e igrejas no site)**, a **entrega 5.5.3 (pedido de AGE on-line)**, a **entrega 5.5.2 (votações e enquetes on-line)**, a **entrega 5.5.1 (patrimônio e empréstimo às igrejas)**, o **lançamento depois das telas novas e do site vivo (Fase 5.5)**, o **novo roteiro (a igreja como instituição na Fase 5; a Fase 5.5 com patrimônio, assembleia on-line e telas novas)**, a **entrega 4.5 (as regras das respostas de 14/11/2026)**, as **respostas de 14/11/2026 (todas as perguntas pendentes e as da Fase 5 e do lançamento)**, a **revisão geral da Fase 4 e a Fase 4 concluída**, a **entrega 4.4 (diretoria e Conselho Fiscal: mandatos e perfis pelo cargo)**, a **entrega 4.3 (quórum, votações, desligamentos e ata)**, a **entrega 4.2 (presença e faltas)**, a **entrega 4.1 (assembleias e reuniões: convocação, pauta e edital no site)**, a **revisão geral da Fase 3**, a **entrega 3.4 (editor do modelo da credencial)**, o **ajuste da credencial (impressão para dobrar e plastificar, validade por mandato, foto 3×4)**, as **entregas 3.2 e 3.3 (credencial digital, validação pelo QR Code e impressão)**, a **entrega 3.1 (dados da credencial)**, as **decisões sobre a credencial (Fase 3)**, a **revisão geral da Fase 2**, a **entrega 2.3 (prestação de contas) e a Fase 2 concluída**, a **taxa de inscrição isenta (configurável)**, a **entrega 2.2 (caixa)**, a **entrega 2.1 (contribuições)**, o **aceite da presidência**, o **novo calendário** (lançamento com dados reais depois da versão 5.0), os **dados fictícios no teste**, a **revisão geral antes do lançamento** (entrega 1.4), as **respostas da diretoria de 12/11/2026** (títulos, diretoria, dados do site), o **Estatuto do COMEP** (25/05/2021), o **portal do ministro** (entrega 1.3), o **pedido de associação e os códigos de acesso** (entrega 1.2), a **tela de Configurações** (sistema personalizável), a previsão do perfil presidente de igreja, as **primeiras respostas da diretoria** (contribuição, exercício, Conselho Fiscal, quórum, reuniões mensais e carteirinha), as cores do COMEP, a decisão de não enviar e-mails, o login só com e-mail e senha, a Fase 0 concluída e a Fase 1 dividida em entregas. Rascunho para discussão.
>
> - O resumo do estatuto, artigo por artigo, está na **seção 13**.
> - As travas de revisão de cada fase estão na **seção 14**.
> - As perguntas que o estatuto **não** responde, e as respostas da diretoria, estão na **seção 11**.

---

## 1. Objetivo

Organizar a gestão do Conselho em um único sistema gratuito, instalável no notebook e no celular Android, cobrindo:

- um **site institucional** simples, com "Portal do membro" e "Quero me associar";
- o **pedido de associação** de novos pastores e líderes, até a aprovação em assembleia;
- cadastro de **ministros** (associados) e de **igrejas**;
- **contribuições** (taxa de inscrição e contribuição periódica), entradas, saídas, balanço anual e prestação de contas;
- **carteirinha digital** com foto;
- **assembleias e reuniões mensais** (convocação, presença, quórum, votação, ata);
- **diretoria e Conselho Fiscal** (cargos e mandatos);
- **projetos e comissões** do Conselho.

## 2. Princípios (não negociáveis)

1. **Custo zero** na fase atual: nada de domínio, servidor ou plano pago.
2. **Ninguém fica refém**: contas, código e dados pertencem ao Conselho, nunca a uma pessoa.
3. **Nada se apaga de verdade**: registros são *arquivados*; toda alteração fica registrada (quem, quando, o quê).
4. **Cada um vê só o que lhe cabe**: o banco de dados bloqueia o acesso, não só a tela.
5. **LGPD**: coletar só o necessário, pedir consentimento no cadastro e permitir que o ministro veja e corrija os próprios dados.
6. **Portabilidade**: o sistema deve poder migrar no futuro para outro servidor sem refazer as telas.
7. **O estatuto manda**: o que o estatuto define vira regra do sistema. O que ele não define fica configurável e é decidido pela diretoria (seção 11).
8. **Nada vai para produção sem revisão**: toda fase passa pelas travas da seção 14 no ambiente de teste antes.

## 3. Quem usa o sistema (perfis)

| Perfil | Quem é (cargo no estatuto) | O que pode fazer |
|---|---|---|
| **Visitante** | Qualquer pessoa | Ver o site institucional e as convocações públicas; pedir associação; validar uma carteirinha pelo QR Code |
| **Ministro** | Pastor ou líder evangélico associado (Art. 7º) | Ver/atualizar o próprio perfil e foto; ver a carteirinha; ver suas contribuições e informar pagamento com comprovante; pedir troca de igreja; confirmar presença em reuniões e assembleias; justificar falta |
| **Presidente de igreja** | Pastor presidente de uma igreja cadastrada, marcado na ficha do ministro: o perfil vem **automaticamente** e define a categoria de contribuição de R$ 40 (seção 4.4). **Não previsto no estatuto**; mantido e a melhorar (14/11/2026): ele **representa a igreja** diante do COMEP | Tudo do ministro + ver os ministros vinculados à sua igreja e se estão em dia; manter os dados, os documentos e a diretoria da igreja (Fase 5); pedir correções no cadastro dos ministros dela; na Fase 5.5, pedir itens do patrimônio emprestados |
| **Secretaria** | 1º e 2º secretários (Art. 12, §4º e §5º) | Receber os pedidos de associação e levá-los à assembleia; cadastros de ministros e igrejas; preparar convocações; registrar presença; aceitar ou recusar justificativas de falta (1º secretário); redigir atas (1º secretário); comunicação e avisos (2º secretário) |
| **Tesouraria** | 1º e 2º tesoureiros (Art. 12, §6º e §7º) | Conferir/confirmar pagamentos; lançar entradas e saídas; preparar o balanço anual e os relatórios |
| **Presidência** | Presidente e vice-presidente (Art. 12, §2º e §3º) | Visualizar tudo; convocar assembleias; **autorizar despesas** (Art. 12, §2º, VI); assinar atas com o 1º secretário; gerenciar perfis de acesso |
| **Secretário Executivo** | Art. 12, §8º | Expediente: o acesso da secretaria e da tesouraria (14/11/2026); responsável pelos eventos do Conselho (Fase 5) |
| **Conselho Fiscal** | Membros eleitos (Art. 12 e 14) | Ver todo o financeiro (só leitura) e registrar o **parecer anual sobre as contas** (Art. 14). ✅ Fase 2.3 |
| **Administrador técnico** | 1–2 pessoas de confiança (da IEADESPA nesta fase) | Configurações, backups e manutenção (sem poder apagar histórico) |

> Uma pessoa pode ter mais de um perfil (ex.: um presidente de igreja que também é tesoureiro do Conselho).
> Desde a Fase 4.4, os perfis da diretoria e do Conselho Fiscal vêm também do **cargo e do mandato** registrados no sistema (menu Diretoria): presidente e vice → Presidência; 1º e 2º secretários → Secretaria; 1º e 2º tesoureiros → Tesouraria; conselheiros → Conselho Fiscal. Na posse o acesso começa sozinho; quando o mandato termina, termina sozinho. Os perfis dados à mão em "Perfis de acesso" continuam valendo. O secretário executivo recebe Secretaria e Tesouraria (entrega 4.5).

## 4. Módulos

### 4.1 Site institucional e portão de entrada (associação)

- **Página inicial pública:** quem é o COMEP, finalidades (Art. 3º), quem pode se associar (Art. 7º), assembleias e convocações, **Fale com o COMEP** (sede, reuniões mensais, telefone, WhatsApp, e-mail, redes sociais) e CNPJ no rodapé — editáveis em Configurações; o que estiver vazio aparece como "—". Botões **"Portal do membro"** e **"Quero me associar"**.
- **Convocações publicadas no site:** o estatuto cita o site do COMEP como meio oficial de convocação (Art. 16, §2º).
- **Formulário "Quero me associar":**
  - dados pessoais;
  - título ministerial reconhecido pela denominação, com comprovante (credencial ou certificado);
  - igreja e denominação;
  - foto.
- **Declarações no formulário:**
  - concordância com os princípios de fé exigidos (Art. 7º, §1º);
  - concordância com o estatuto e o regimento interno (Art. 10, I);
  - termo de consentimento LGPD.
- **Fluxo do estatuto (Art. 7º):** pedido → análise da Diretoria (secretaria) → **aprovação na Assembleia Ordinária** (registrada com a data e a ata) → ficha aceita pelo associado e por um diretor (aceite eletrônico dos dois) → taxa de inscrição → associado ativo.
- **Associados atuais** ("já cadastrados nesta data", Art. 7º, a): a secretaria cadastra direto, sem passar pela assembleia.
- **Login com e-mail e senha** (decisão de 11/11/2026):
  - **sem "Entrar com Google"**: exigiria manter um cadastro em mais um serviço (Google Cloud), o que se preferiu evitar;
  - **login pelo CPF** fica como ideia para o futuro.
- **Sem envio de e-mail** (decisão de 11/11/2026, seção 5):
  - não há e-mail de confirmação; o pedido só vira associado depois da aprovação na assembleia, então ninguém ganha acesso só por criar login;
  - **primeiro acesso dos associados atuais**: a secretaria cadastra o associado e gera um **código de acesso**, que manda pelo WhatsApp. A pessoa cria o login com o próprio e-mail e o código, e o login fica ligado ao cadastro dela;
  - **senha esquecida**: a secretaria ou o administrador técnico gera um código; a pessoa cria uma senha nova com o e-mail e o código. Ninguém da diretoria fica sabendo a senha de ninguém.

### 4.2 Ministros (perfil do associado)

- Dados pessoais, contato, título ministerial (Pastor(a), Evangelista, Presbítero, Apóstolo(a), Bispo(a) — decisão 9; a lista fica em Configurações), data de consagração, igreja e denominação.
- Foto (comprimida automaticamente no celular antes do envio).
- Comprovante do título. RG/CPF digitalizados **não** são exigidos pelo estatuto e não serão pedidos (LGPD).
- **Nº de registro** gerado automaticamente pelo banco (vai na carteirinha).
- Situação do cadastro: **pendente, aguardando assembleia, ativo, desligado, falecido** (nunca apagado). O estatuto **não prevê suspensão**.
  - "pendente" e "aguardando assembleia" são etapas do pedido de associação; o cadastro de associado nasce **ativo**;
  - associado ativo recebe automaticamente o perfil **Ministro**; ao sair, perde o perfil;
  - cadastro feito **por engano** (duplicado, pessoa errada) é **arquivado** pela secretaria. Isso não é desligamento.
- Situação financeira, separada: **em dia / em atraso**. Quem está em atraso não vota nem pode ser votado (Art. 11).
- **Desligamento (Art. 8º)**, sempre com motivo:
  - a pedido por escrito;
  - conduta contrária à ética e aos princípios cristãos;
  - transferência pela denominação para outra cidade;
  - três faltas seguidas às reuniões mensais sem justificativa;
  - falecimento.

  A decisão é da Assembleia Ordinária, por 3/5 (decisão 5).

- Histórico de igrejas e de títulos; pedido de troca de igreja.

### 4.3 Igrejas

- Cadastro: nome, CNPJ, denominação e bairro (das listas de Configurações), endereço, telefone e nome do pastor presidente.
- O **pastor presidente** associado é marcado na ficha do ministro (uma igreja tem um só por vez) e recebe o perfil Presidente de igreja.
- Perfil da igreja com a lista de ministros vinculados.
- **A igreja como instituição** (14/11/2026 — o novo presidente quer um COMEP que represente e apoie as igrejas da cidade, não só os ministros):
  - a igreja guarda o **estatuto**, o **cartão CNPJ** e a **diretoria dela**, com os mandatos; a secretaria do COMEP confere;
  - o **presidente da igreja** a representa diante do COMEP: mantém os dados e os documentos, acompanha os ministros dela (em dia ou não) e pede correções no cadastro deles;
  - o **peso da igreja** é o número de ministros associados: uma igreja com 50 ministros tem mais voz que uma com 5. Isso serve de base para as regras de apoio (Fase 5.5).
- **A regularização das igrejas** (decisões do usuário com a diretoria, 18/11/2026; entregas 5.5.8 e 5.5.9). O COMEP representa a classe diante da prefeitura e das autoridades: as igrejas irregulares queimam o conselho, e as grandes e regulares não entram. Base no estatuto: o Art. 7º (o título comprovado numa denominação, com a carta de uma igreja) e a exigência dos princípios de fé, que não se prova sem estatuto. As regras viram pauta da reforma do estatuto; o sistema já funciona com elas.
  - **A igreja em 3 níveis**, calculados pelo sistema todos os dias, pelas datas dos documentos (ninguém precisa clicar):
    - **regular**: estatuto, Cartão CNPJ como organização religiosa, ata da diretoria em dia e **alvará de licenciamento** válido (o alvará já inclui o Corpo de Bombeiros e a Vigilância Sanitária; vale até 31/12);
    - **suspensa**: venceu a ata (o mandato) ou o alvará. **Sem carência**: fica suspensa no mesmo dia. O pastor presidente tem **30 dias** só para mandar o documento (a Minha igreja vira "o caminho de volta", com a contagem); sem mandar, o **perfil de pastor presidente é bloqueado** (ele continua ministro associado) e só a secretaria manda o documento pela igreja. Os avisos de 60 e 30 dias antes vão ao pastor presidente: a responsabilidade é dele;
    - **sem registro** (sem CNPJ, estatuto ou ata): cadastro simples e limitado. Não pega empréstimo do patrimônio (sem CNPJ, não há como fazer o contrato) e ninguém recebe o perfil de pastor presidente (sem ata, não há mandato). Os ministros dela podem ser associados. Pode se regularizar quando quiser.
  - **O documento antecipado**: o alvará do ano seguinte e a ata da próxima diretoria podem ir **antes de vencer**. Conferidos, ficam guardados e **entram sozinhos no dia certo**, sem nenhum dia de suspensão (dica de governança).
  - **A diretoria da igreja vai com a ata**: cada cargo com um ministro associado ou o nome completo, e o mandato de cada cargo ("mesmo mandato para todos", com a exceção de quem entrou depois). A ata vale até o **menor mandato**; não existe mandato sem prazo nem vitalício. A secretaria confere a mudança mostrando como estava e como fica.
  - **Natureza jurídica**: o Cartão CNPJ deve estar como **organização religiosa** (Código Civil, art. 44, IV: uma conquista dos pastores que vieram antes). Associação privada é aceita com prazo: até o fim do mandato da primeira diretoria registrada (eleger a nova e, na mesma ata, mudar a natureza) e, depois da ata, 90 dias para o Cartão CNPJ novo (configurável). Passou o prazo: suspensa, como o documento vencido.
  - **Transição**: quem já estava cadastrado e irregular tem até a **AGO de 28/04/2027** (configurável); o documento que nunca veio não suspende antes disso. A igreja cadastrada depois da transição sem o documento fica suspensa desde o cadastro, com os mesmos 30 dias.
  - **O cadastro completo**, em 5 passos (dados com a natureza, endereço e contato, pastor e diretoria com o mandato, documentos e revisar), pela secretaria (o documento mandado por ela já entra conferido) ou **pelo próprio pastor** (ministro associado): a igreja fica em análise, a secretaria confere item por item (dados, endereço, diretoria e cada documento) e, com tudo aprovado, ativa; ele vira o pastor presidente dela.
  - **Os documentos**: PDF ou foto, **até 25 MB por arquivo**, em quantas partes precisar (até 20); a foto é reduzida no aparelho.
  - **Filiais**: congregações, pontos de culto e células, numa gestão simples (sem lista de membros; usam o CNPJ e os documentos da matriz; a congregação com templo próprio também). O responsável é **só ministro associado** da igreja (se não houver, fica sem responsável). A localização é opcional: o link do Google Maps vira a latitude e a longitude (o mapa da cidade vem depois).
  - A igreja ganha o ano de fundação, os membros (aproximado), o CEP, o e-mail, o site e a **convenção** estadual ou nacional (opcional); a denominação ganha a **tradição** (pentecostal, batista, reformada…).
  - **Central de regularização** (módulo Igrejas): as suspensas com a contagem dos 30 dias, o que vence nos próximos 60 dias, a natureza com prazo, o que falta da transição e as sem registro, para chamar para perto. As regras (o fim da transição, os 30 dias e o prazo do Cartão CNPJ) só a presidência muda.
  - **Na agenda**, a secretaria registra o empréstimo direto (já aprovado), sem passar pelo "pedir emprestado".
  - **O histórico**: a secretaria também registra o documento que já venceu (o alvará do ano passado, a ata da diretoria anterior), que entra conferido e conta para a situação. O pastor presidente manda só o que vale agora ou o seguinte.
  - **Na Minha igreja** (o pastor presidente): os documentos em cartões, com a validade e a barra do prazo; o cartão abre a página do documento (o atual, "Atualizar" com o passo a passo do envio antecipado, e o histórico); a aba Filiais; e, suspensa, só "o caminho de volta", com a contagem dos 30 dias. Os avisos de 60 e 30 dias antes chegam pelo sino. O ministro que ainda não preside uma igreja no COMEP vê, no Início, o convite para cadastrá-la.

### 4.4 Financeiro

- **Contribuição dos associados** (respondido pela diretoria em 11/11/2026):

  | Categoria do associado | Mensal | Anual (pago em abril) |
  |---|---|---|
  | Presidente de igreja | R$ 40,00 | R$ 400,00 |
  | Não presidente de igreja | R$ 20,00 | R$ 200,00 |
  | Jubilado | isento | isento |

  - o associado paga **por mês** ou **o ano inteiro em abril**;
  - o **exercício** vai de **1º de abril a 31 de março**;
  - a **categoria é automática**:
    - jubilado (marcado na ficha) é isento;
    - quem tem o perfil **Presidente de igreja** (pastor presidente marcado na ficha) paga R$ 40/R$ 400;
    - os demais pagam R$ 20/R$ 200;
  - os valores são definidos pela Assembleia Ordinária (Art. 7º, §3º): ficam configuráveis e guardam o histórico, para os próximos reajustes;
  - vencimentos e escolha entre mensal e anual: pergunta 18.
- **Taxa de inscrição:** **isenta** (decisão de 12/11/2026). A assembleia pode definir um valor depois, em Configurações → Taxa de inscrição. Quando houver valor, é cobrada uma vez de quem for admitido pela assembleia, com prazo configurável (padrão: 30 dias); quem entrou no cadastro inicial não paga e o jubilado é isento.
- **Informar pagamento**: o ministro anexa o comprovante (PIX/depósito); a tesouraria confere e confirma.
- Situação automática **em dia / em atraso**, com lista de inadimplentes. Só vota e é votado quem está com a mensalidade em dia (Art. 11; diretoria, 11/11/2026).
- **Categorias de receita do estatuto** (Art. 17): contribuições dos associados, ofertas, doações e outras receitas.
- **Despesas**: lançadas pela tesouraria e **autorizadas pelo presidente** (Art. 12, §2º, VI). O sistema registra quem autorizou e quando.
- **Contas** (caixa, conta bancária) e lançamentos com comprovante e categoria.
- **Balanço anual (prestação de contas)**, em quatro passos:
  1. o 1º tesoureiro prepara;
  2. a diretoria analisa;
  3. o Conselho Fiscal dá parecer;
  4. a Assembleia Geral aprecia.

  (Art. 12, §6º, III; Art. 14; Art. 15, I)

- **Orçamento e plano anual de trabalho** para apreciação da assembleia (Art. 15, I).
  - O orçamento é o previsto de cada categoria do caixa. Ele se prepara em rascunho, vai para a assembleia ("Mandar para a assembleia", com a AGO ou a AGE, se já marcada) e só é aprovado depois de mandado. Mandado, não muda, a não ser que volte para o rascunho; aprovado, não muda mais.
  - O plano anual de trabalho é feito de atividades: o mês (dentro do exercício, ou "ao longo do ano"), o que é, quem cuida, a categoria do orçamento e quanto custa. Ele muda junto com o orçamento (só em rascunho). Nada se apaga: a atividade sai do plano arquivada.
- **As telas (Fase 5.5, entrega 5.5.12):** o módulo tem 6 funções na coluna da esquerda, cada uma com as subfunções:
  - Contribuições (o painel, por igreja, as cobranças do ano, os valores e os planos);
  - Comprovantes (para conferir e os já conferidos);
  - Caixa (o extrato do mês, com o saldo depois de cada linha; as contas e as transferências);
  - Despesas a autorizar (os cartões, as autorizadas e as recusadas);
  - Orçamento (os cartões por categoria e o plano anual de trabalho);
  - Prestação de contas (as etapas do balanço com os números, o mês a mês e o balanço para imprimir).
- **O Financeiro blindado (Fase 5.5, entrega 5.5.15; pedido do usuário de 20/11/2026):** toda entrada e toda saída de qualquer módulo chega sozinha ao caixa, ligada à origem. **A regra vale para todo módulo que recebe ou paga, inclusive os que ainda vêm** (os Eventos novos, com os lotes e a inscrição na hora na portaria, em dinheiro; os cursos do COMEP; a Assessoria; os planos do certificado):
  - **uma função só grava no livro-caixa** (`interno.registrar_lancamento`). O banco recusa qualquer outra gravação, até de outra função do sistema. O módulo chama a função e liga o lançamento à origem;
  - **o lançamento gravado não muda** (o valor, a conta, a data, a categoria e a origem). Para corrigir, cancela-se com o motivo e lança-se de novo. Nada se apaga;
  - **item pago num módulo tem sempre o lançamento** (restrições no banco): a contribuição paga, a inscrição paga e o modelo exclusivo pago;
  - **cancelar o lançamento devolve a origem para "a pagar"**: a contribuição volta para "em aberto", a inscrição volta a esperar o pagamento, o modelo exclusivo volta a esperar o pagamento e a compra deixa de estar ligada ao bem;
  - **cancelar a origem paga estorna o lançamento**: a inscrição paga só a tesouraria ou a presidência cancelam, com o motivo;
  - **o evento lança a própria despesa** (para a autorização do presidente, como as outras, só com o orçamento aprovado) **e a própria receita avulsa** (patrocínio, oferta);
  - **o extrato mostra de onde veio cada valor**, com o link para a origem e o filtro por origem. O mês do Conselho Fiscal também mostra a origem. Os números dos módulos são lidos do caixa: a fonte é uma só;
  - **os cursos e os eventos das IGREJAS não passam pelo caixa do COMEP**: o dinheiro é da igreja, e o COMEP só divulga.
- Relatórios: mensal, anual, por categoria, por igreja; exportação em PDF e planilha (CSV).
- Sem gateway de pagamento nesta fase (evita taxas). PIX automático fica para o futuro.

### 4.5 Credencial do associado (digital e física)

Decisões de 12/11/2026 (administrador técnico, com base na credencial que já usa), **revistas em 13/11/2026** depois de ver a primeira versão no sistema de teste:

- **Duas formas da mesma credencial:**
  - **digital:** aparece no sistema ("Minha credencial") e no app instalado no celular;
  - **física:** impressa em papel e **plastificada**. A de PVC fica para depois (é cara e desnecessária agora).
- **Validade: o fim do mandato da diretoria em curso** *(revisto em 13/11/2026)*:
  - a credencial traz **"Válida até"** com essa data;
  - a **digital** passa sozinha para o mandato seguinte: na posse da nova diretoria, o sistema emite outra, com novo QR Code;
  - a **impressa** vale até a data que está nela. **Depois da posse da nova diretoria, é preciso imprimir de novo**; passada a data, o QR Code da antiga mostra "vencida";
  - o QR Code abre a página pública de validação, que mostra a situação **de agora**:
    - se o associado está ativo;
    - se está em dia ou em atraso — em atraso fica **inapto para votar** (Art. 11);
    - até quando a credencial vale;
  - vale também para quem entra no meio do mandato (pergunta 21);
  - em Configurações → Credencial há **duas ações separadas**, para um erro de digitação não estragar nada:
    - **corrigir** a data do mandato em curso: todas as credenciais dele acompanham;
    - **registrar o novo mandato** (posse), com confirmação: as credenciais são renovadas.
- **O que vai na credencial:**
  - **cabeçalho do COMEP**, bonito: logo e nome do Conselho;
  - **foto 3×4**, nome, **CPF**, **filiação** (pai e mãe — é credencial de um conselho municipal, não de igreja);
  - **nº de registro** (o número do associado), **data de ingresso** no Conselho e a **validade**;
  - título;
  - **função/cargo na igreja**, a que a igreja informa ao Conselho;
  - **igreja pela sigla** (nome curto, porque há nomes enormes) **e o CNPJ**. Igreja sem CNPJ ou sem sigla aparece como **pendência** para o associado resolver;
  - no **verso**: QR Code, texto de rodapé configurável e espaço para outros dados que se quiser.
- **Desenho:** cada item tem o seu lugar fixo. **O nome fica numa linha só** (a letra diminui para caber), e nenhum texto comprido corta ou empurra o item vizinho (o CNPJ, por exemplo).
- **Página pública de validação:** mostra só nome, foto, título, nº de registro, igreja (sigla) e a situação. Não mostra CPF nem filiação.
- **Privacidade e correções** *(revisão geral da Fase 3, 13/11/2026)*:
  - CPF e filiação, só a própria pessoa, a secretaria e a presidência veem;
  - o nome, o CPF e a filiação vão na credencial: depois de preenchidos (o nome, depois da associação), só a secretaria corrige.
- **Física:**
  - tamanho padrão de cartão (**CR80: 85,6 × 54 mm**). A capa plástica usada é uns 10 mm maior, o que deixa uma borda boa;
  - **frente e verso juntos, lado a lado, sem espaço entre eles:** recorta-se em volta, **dobra-se ao meio**, põe-se na capa e plastifica-se. Não se recorta frente e verso separados (isso só seria para o PVC);
  - 5 credenciais por folha A4, com linha de recorte em volta e marcas da dobra *(revisto na Fase 5.5: 4 por folha, com espaço, sangria e marcas de corte; ver "Impressão das credenciais" abaixo)*.
- **Editor de credencial:** o desenho fica num **modelo editável** — onde fica cada coisa, fotos, cores e formas. Assim dá para mudar o conceito da credencial no futuro sem programar.
- **Vários modelos, um por grupo** (decisões do usuário nas rodadas 7 a 12, 18/11/2026; entregas 5.5.10 e 5.5.11). Exemplos: a diretoria com outra cor, o ministro comum, quem tem 10 anos de COMEP, os pentecostais com a chama, o modelo exclusivo de uma igreja.
  - Cada modelo tem **nome**, a regra de **quem recebe** e a **ordem**. Quem se encaixa em mais de um recebe o que vem **primeiro na ordem**; sem nenhum que sirva, fica o **modelo padrão** (o que existia antes virou o padrão).
  - O desenho de cada modelo continua em **versões que não mudam nem se apagam**: dá para voltar a qualquer uma. O modelo novo nasce **rascunho** (ninguém recebe) até "Salvar e usar" ou "Pôr em uso".
  - **Quem recebe**: as condições em 3 grupos, exigindo **todas** ou **qualquer uma**:
    - da pessoa: cargo na diretoria do COMEP (enquanto durar o mandato), título, tempo de COMEP, pastor presidente, jubilado, membro de comissão, forma de admissão;
    - da igreja: a igreja, a denominação e a **tradição** da denominação (pentecostal, batista, reformada…);
    - do tempo: só entre duas datas (ex.: jubileu do COMEP) ou só durante o mandato da diretoria em curso (guarda a data do fim; a posse seguinte não estica o modelo).
    - Sem nenhuma condição, ninguém recebe o modelo. A tela mostra quem recebe **hoje** e, com a regra mudada e ainda não salva, **como vai ficar**.
  - **Modelo exclusivo de uma igreja**: a igreja paga à parte (exemplo do usuário: R$ 300,00) para os ministros dela terem um modelo com as cores dela. Guarda o valor, quem pediu e o pagamento; **só vale depois de pago** e só para os ministros daquela igreja. O pagamento é registrado pela **tesouraria ou pela presidência** (é dinheiro), com a **entrada do caixa** ligada se houver (a tesouraria lança a entrada no Caixa, como em qualquer receita). Depois de pago, a igreja e o valor não mudam. Só a igreja com registro tem modelo exclusivo.
  - **O tamanho do cartão** fica dentro do modelo, em mm: o padrão de cartão de crédito (85,6 × 54 mm), o crachá em pé (54 × 85,6), a carteirinha maior (100 × 70) ou outro; os cantos retos (guilhotina) ou redondos, a sangria (2 mm) e a área segura (3 mm). Mudou o tamanho, os itens acompanham na mesma proporção.
  - **O editor na tela inteira** (rodada 8, opção 1): a barra vermelha em cima (voltar, o nome, frente e verso, desfazer, o zoom, "Ver com" os dados de um ministro, testar a impressão e "Salvar e usar"); à esquerda, Prontos, Textos, Dados, Imagens, Formas, Fundo (cor, degradê, imagem e marca d'água), Camadas e Versões; no meio, o cartão com as réguas e as guias de corte, sangria e área segura; à direita, o item escolhido (letra, tamanho, peso, cor, alinhamento, posição, girar, transparência, a letra que diminui no nome comprido) e o cartão. No celular, o editor avisa que é feito no computador.
- **O ministro em readequação** (o da igreja sem registro, seção 4.3) recebe **sempre** o modelo de readequação, que não sai da ordem e não pode ser trocado: uma categoria mais baixa, **cinza, com a faixa de aviso** ("Em readequação · sem direito a voto"), a **igreja sem registro** e o **prazo** (a AGO de 28/04/2027, configurável na Central de regularização). No editor se escolhe onde vai a faixa (rodapé, topo ou um dos lados). A faixa aparece também na conferência pelo QR Code. Regularizada a igreja, a credencial dele volta aos modelos comuns sozinha.
- **Nunca** a frase "não representa o COMEP" na credencial: o estatuto deixa a diretoria escolher um ministro para representar o conselho, e a frase feriria o direito do membro.
- **Impressão das credenciais** (rodadas 8 a 11; substitui as "5 por folha" acima): só **lado a lado, com dobra** (frente e verso em folhas separadas foi descartado, porque a impressora não encaixa o verso); **4 por folha**, com **5 mm de espaço** entre as credenciais e **2 mm de sangria**; as **marcas de corte fora da sangria**; a impressão começa **sempre no alto** e as vagas que sobram saem **em branco**, sem a palavra "livre" e sem marcas; **folha nova ou pedaço já cortado**: a pessoa diz quantas cabem no pedaço (meia folha, A5, cabe 2), as primeiras vão nele e o resto em folhas inteiras. O pedaço e as folhas se imprimem à parte, porque vão em papéis diferentes.
- **Símbolos** (rodadas 10 e 11): uma biblioteca de **desenhos próprios em SVG** (nunca emojis), os gerais da fé e os de cada tradição (não só 6: as denominações grandes também). Os **logotipos oficiais não são copiados da internet**: a secretaria envia o arquivo que a denominação fornecer. Na frente, há o que é **obrigatório** (não sai: nome, nº de registro, validade, QR Code, foto e o nome e o símbolo do COMEP), o **padrão** (vem pronto e muda de lugar e de cor) e o **opcional**; o **verso** é onde se personaliza à vontade. A biblioteca e os logotipos ficam em Credenciais › Símbolos; no modelo, o item "logotipo da denominação" mostra, em cada credencial, o da denominação da igreja da pessoa.

### 4.6 Assembleias e reuniões

- **Três tipos de encontro:**
  - Assembleia Geral Ordinária: na **2ª quinzena de abril e de outubro** (Art. 16, §6º);
  - Assembleia Geral Extraordinária: quando necessário (Art. 15);
  - **reunião mensal** (Art. 7º, §3º): **não tem efeito de AGO nem de AGE** (diretoria, 11/11/2026). Nela não se vota o que é da assembleia; o sistema registra a presença e as faltas.
- **Convocação:**
  - feita pelo presidente com **no mínimo 30 dias de antecedência**; o sistema não deixa marcar com menos;
  - publicada no site e avisada por e-mail/WhatsApp (Art. 16, §2º).
- **Pedido de Assembleia Extraordinária:** por **3/5 dos associados** ou pela maioria simples do Conselho Diretor, sempre com a pauta (Art. 16, §3º).
  - **No sistema (entrega 5.5.3, 17/11/2026):** em "Assembleias" → "pedidos de AGE", um associado em dia (ou membro do Conselho Diretor) abre o pedido com o assunto, a justificativa e a pauta, e já assina; os outros assinam ali (as assinaturas são vistas pelos associados, como num abaixo-assinado) e podem retirar a assinatura enquanto o pedido colhe assinaturas.
  - A conta: **3/5 dos associados aptos** (ativos e em dia, como no quórum), arredondado para cima, ou **mais da metade do Conselho Diretor** em mandato (o Conselho Fiscal não entra). Vale a situação de hoje de quem assinou: quem caiu em atraso deixa de contar.
  - A coleta tem prazo (nas regras das assembleias; 30 dias). Atingida a meta, o pedido fica guardado com a conta do momento e não muda mais.
  - A presidência (ou a secretaria) **marca a AGE a partir do pedido**: a assembleia nasce em preparo com a pauta do pedido e o "quem pediu" preenchido; a convocação segue as regras de sempre.
- **Presença:** registrada no sistema, que vale como "livro ou outro controle similar" (Art. 16, §1º), com check-in pelo QR Code da carteirinha.
- **Quórum de instalação** (Art. 16, §4º; diretoria, 11/11/2026):
  - 1ª chamada: **metade mais um dos associados aptos** (em dia na data da assembleia);
  - 2ª chamada, 60 minutos depois: com os presentes.
- **Votação:**
  - só associados **em dia** votam e são votados (Art. 11);
  - maiorias: simples; **3/5** para desligamento (Art. 8º); **2/3** para reforma do estatuto, em assembleia convocada para isso (Art. 21);
  - o sistema calcula se cada deliberação atingiu a maioria exigida.
- **Atas:** redigidas pelo 1º secretário e assinadas por ele e pelo presidente (Art. 12, §2º, IV e §4º), com anexo da ata assinada.
- **Faltas às reuniões mensais:**
  - o associado justifica a falta ao **1º secretário**, que aceita ou recusa a justificativa (diretoria, 11/11/2026);
  - com **2 faltas seguidas** sem justificativa, o sistema avisa o associado e a secretaria;
  - com **3**, o caso vai para a pauta da assembleia (Art. 8º, IV).
- Histórico de assembleias e reuniões.
- **Os números do estatuto ficam em Configurações** *(13/11/2026: a diretoria pensa em reformar o estatuto)*: antecedência da convocação (30 dias), meses e dia da AGO (abril e outubro, a partir do dia 16), minutos até a 2ª chamada (60) e faltas seguidas (2 para avisar, 3 para a pauta).
- **Pergunta 10 (diretoria atual):** por decisão do administrador técnico (13/11/2026), o fim do mandato fica com a data fictícia do teste até a diretoria informar.

### 4.7 Projetos e comissões

- **Comissões permanentes e temporárias** (educação, segurança, saúde, política, cidadania — Art. 3º, IV), com membros indicados pela diretoria (Art. 9º, III).
- **Projetos e eventos** (encontros, seminários, conferências — Art. 3º, VII): responsável, período, orçamento, situação; lançamentos financeiros vinculados.

### 4.8 Comunicação

- Mural de avisos (geral, por igreja ou por perfil), administrado pela secretaria (Art. 12, §5º).
- Botão de envio por WhatsApp (link gratuito, sem API paga).
- **As notificações (Fase 5.5, entrega 5.5.14; decisões do usuário de 18/11/2026):**
  - **A principal é a notificação no celular pelo navegador** (push), sem custo e mesmo com o aplicativo fechado: a convocação, os prazos, os documentos e a contribuição. **Sem e-mail e sem SMS.**
  - **O sino** mostra as notificações de cada pessoa, guardadas no banco: o "lido" vale em todos os aparelhos. Elas nascem quando as coisas acontecem: a assembleia ou a reunião convocada (todos os associados), a votação aberta (quem pode votar), o pedido de AGE (quem pode assinar), o aviso novo no mural (quem é do COMEP), a pendência no pedido de associação, o comprovante conferido e o item da igreja devolvido. Os documentos da igreja 60 e 30 dias antes de vencer e a igreja suspensa (urgente) saem uma vez por dia, para o pastor presidente.
  - **Ativar no primeiro acesso:** o Início pergunta "Receber os avisos no celular?". Em Meu perfil › Avisos, a pessoa escolhe o que chega no celular e o **silêncio à noite** (das 22h às 7h, só o urgente). O recado da secretaria e o pedido de associação chegam sempre.
  - **O WhatsApp é um botão da secretaria**, nunca envio automático: na ficha do ministro, "Falar pelo WhatsApp" escolhe a mensagem pronta (contribuição, assembleia, credencial ou livre), deixa ajustar e abre o WhatsApp de quem clica com o texto. Ao lado, "Mandar pelo aplicativo" põe a mesma mensagem no sino da pessoa.
  - **"Lembrar todos"** (Financeiro › Contribuições): o lembrete vai para quem está em atraso e ainda não mandou o comprovante, uma vez por dia.
  - **O envio** é a função `enviar-avisos` do Supabase, com o par de chaves do envio (VAPID) nos *Secrets* e o agendamento a cada 5 minutos. Para ligar: `docs/avisos-no-celular.md`. Até lá, os avisos ficam no sino.

### 4.9 Auditoria e segurança

- Registro automático de toda criação/alteração/arquivamento.
- Tela de auditoria para presidência e administrador técnico.

### 4.10 Diretoria e Conselho Fiscal

- **Composição do Conselho Diretor** (Art. 12): presidente, vice-presidente, 1º e 2º secretários, 1º e 2º tesoureiros e secretário executivo.
- **Conselho Fiscal:** **3 membros**, mandato de **4 anos**, com as mesmas datas do Conselho Diretor (diretoria, 11/11/2026).
- **Mandato:** 4 anos, com reeleição permitida; cargos voluntários e sem salário (Art. 12).
- **Eleições:** registradas na assembleia; só candidatos e eleitores em dia (Art. 11).
- **Perfis automáticos:** os perfis de acesso da diretoria vêm do mandato vigente.
- **O Conselho Fiscal mês a mês (Fase 5.5, entrega 5.5.13):** o Conselho aprova as contas de cada mês do exercício (abril a março), vendo cada lançamento com o comprovante.
  - Ele aprova, aprova com ressalva ou pede esclarecimento à tesouraria, sobre o mês ou sobre um lançamento. Enquanto houver pergunta sem resposta, o mês não se aprova. A tesouraria responde no próprio módulo, com o comprovante que faltava.
  - A aprovação guarda os números do mês. Se eles mudarem depois, a aprovação deixa de valer e o mês volta para a análise; a antiga fica arquivada.
  - Uma pessoa do Conselho decide; os outros membros assinam junto. Quem tem perfil da diretoria não decide.
  - O parecer do ano (Art. 14) só sai com os 12 meses aprovados, e o texto vem dos meses e das ressalvas. Os meses sem movimento se aprovam de uma vez.
- Histórico de todas as diretorias.

### 4.11 Configurações (sistema personalizável)

Pedido de 11/11/2026: o que muda com o tempo não fica preso no código, e sim numa tela de **Configurações**:

- **Dados do COMEP no site:** sede, reuniões mensais, telefone, WhatsApp, e-mail, redes sociais e CNPJ (decisão 14). Vazio aparece como "—" no site.
- **Listas:** denominações (tipos de igreja), bairros e títulos de ministro. A secretaria, a presidência e o administrador técnico incluem, renomeiam e arquivam itens.
- **Valores da contribuição:** a tesouraria e a presidência lançam o valor novo, com a data em que passa a valer e a assembleia que aprovou. O valor anterior fica no histórico.
- Arquivar um item tira ele das opções, mas não apaga nada: o que já usava esse item continua guardado.
- Novas listas entram aqui conforme forem surgindo (ex.: tipos de projeto, motivos de desligamento).

### 4.12 Patrimônio e apoio às igrejas (Fase 5.5)

- Registro de bens móveis e imóveis em nome do COMEP (Art. 18), comprados com as contribuições (pelo caixa): som, palcos, cadeiras (300 a 400)…
- **Empréstimo às igrejas:** o presidente da igreja pede os itens para uma data; a **agenda** mostra o que está livre (também frente aos eventos do COMEP); ele assina um **termo de compromisso** de zelar pelo patrimônio; o sistema registra a retirada e a devolução.
- **Regras de apoio** a definir pela diretoria: por exemplo, igrejas já estabelecidas podem precisar só de cadeiras; o peso da igreja (ministros associados) conta. A ideia é que o associado veja o benefício do que paga.
- **Como ficou (entrega 5.5.1, 17/11/2026):**
  - **Bens:** nome, categoria, quantidade, se pode ser emprestado, forma de aquisição (compra, doação, legado — Art. 18), data, valor de cada um, onde fica guardado e a compra no caixa (a tesouraria liga o bem à saída). Cadastram a secretaria (o secretário executivo), a tesouraria e a presidência.
  - **A quantidade não se edita:** entra por "Acrescentar" (com a origem) e sai por "Dar baixa" (com o motivo). As baixas ficam no histórico (equipe e Conselho Fiscal veem).
  - **O pedido:** o pastor presidente pede para a própria igreja, escolhe o período e os itens (o sistema mostra quanto está livre) e aceita o termo; o texto do termo aceito fica guardado no pedido. A equipe também pede em nome de uma igreja, sem a antecedência, e **reserva para os eventos do COMEP** (já entra aprovada).
  - **A aprovação:** a secretaria ou a presidência aprova; o banco confere de novo a agenda (dois pedidos ao mesmo tempo não emprestam o mesmo item duas vezes). Recusar pede o motivo. Na aprovação aparece o peso da igreja (ministros associados e em dia).
  - **Retirada e devolução:** a equipe registra quem levou; na devolução conta o que voltou, e **o que faltou sai do patrimônio** (baixa ligada ao empréstimo, com a explicação obrigatória). O termo é impresso com as linhas de assinatura.
  - **Regras configuráveis (a presidência muda), até a diretoria decidir:** antecedência do pedido (3 dias), prazo máximo (7 dias), exigir que o pastor esteja em dia (sim) e o texto do termo.
  - **Quem vê:** os bens e a agenda, quem é do COMEP; os pedidos, a equipe, o Conselho Fiscal, quem pediu e o pastor presidente da igreja. No menu: pastor presidente, secretaria, tesouraria, presidência e Conselho Fiscal.

### 4.13 Votações e enquetes on-line (Fase 5.5)

Pedido do usuário em 17/11/2026: votações e enquetes pelo celular, também durante a assembleia, **sem se prender ao estatuto** (que só fala em assembleia presencial).

- **Enquete:** uma pergunta com opções (de 2 a 20), para ouvir os associados; pode deixar escolher mais de uma.
- **Votação:** a favor, contra ou abstenção, com a maioria exigida (simples, 3/5 ou 2/3 dos votos válidos — a abstenção não entra, como na assembleia).
- **Quem vota:** todos os associados, só os em dia, ou só os presentes (em dia) numa assembleia. O jubilado vota.
- **Voto secreto (o padrão):** o sistema guarda **quem** votou, não **o que** votou. A contagem fica numa tabela sem auditoria e sem ligação com a pessoa; ninguém vê a parcial antes do fim, nem quem organiza.
- **Voto aberto:** quando termina, todos veem quem votou em quê; pode mostrar a parcial enquanto está aberta.
- **Na assembleia:** cada item da pauta pode ser votado pelo celular dos presentes. Ao encerrar, o resultado vai para a votação do item (deliberação e ata), com o desligamento por conduta ou a jubilação, como na contagem à mão.
- **Quem organiza:** a secretaria e a presidência preparam, abrem, encerram e cancelam. Cada associado vota uma vez, sem volta. O prazo é opcional.
- **No Início:** as votações abertas em que a pessoa ainda não votou ("Vote agora").

## 5. Arquitetura (100% gratuita)

| Camada | Tecnologia | Observação |
|---|---|---|
| Aplicativo | **React + Vite + TypeScript**, como **PWA** | Instala pelo navegador no notebook e no Android; funciona com internet instável |
| Hospedagem do app | **GitHub Pages** | Provisoriamente na organização **IEADESPA** (plano Team), que permite publicar a partir de repositório privado — ver regra abaixo |
| Endereço | `ieadespa.github.io/comep/` (provisório) | Domínio próprio `.com.br` fica para quando o Conselho tiver CNPJ e registrar no nome dele |
| Banco de dados | **Supabase** (PostgreSQL) — plano Free | Banco relacional de verdade |
| Login | **Supabase Auth** | E-mail e senha (sem Google — decisão de 11/11/2026) |
| Fotos e arquivos | **Supabase Storage** | Pastas privadas; links temporários |
| E-mails | **Nenhum** (decisão de 11/11/2026) | Os serviços gratuitos de envio não servem para isso, e o e-mail da IEADESPA (Azure) não será usado. Ver seção 4.1 e 10 |
| Avisos no celular | **Notificação do navegador** (Web Push), mandada por uma função do Supabase (Edge Function) | Sem custo; as chaves do envio ficam nos *Secrets*. Ver seção 4.8 e `docs/avisos-no-celular.md` |
| Código-fonte | **GitHub** — repositório `IEADESPA/comep` (privado) | Provisório até a transferência ao Conselho (seção 8); 2–3 donos |
| Backups | Repositório `IEADESPA/comep-backups` **privado** | Só arquivos criptografados |
| Automação | **GitHub Actions** | Testes das regras do banco antes de publicar, publicação do app, backup semanal criptografado e aviso anti-pausa |
| APK (futuro) | Empacotar o PWA (TWA/Capacitor) | Instalação direta, sem Play Store |

**Serviços usados: apenas GitHub + Supabase.**

**Regra do repositório:** hoje o repositório `comep` é privado (o plano Team da IEADESPA permite). Se um dia precisar ficar público (ex.: organização do Conselho no plano gratuito), isso não reduz a segurança: o código das telas é baixado pelo navegador de qualquer usuário, e a proteção está nas regras RLS do banco. No repositório **nunca** entram dados, senhas ou a chave secreta (`service_role`/`sb_secret_`) do Supabase — só a chave pública (`publishable`), feita para ser pública.

**Regra de portabilidade:** todo acesso ao banco fica concentrado em `src/dados/`. As telas nunca falam direto com o Supabase. Numa migração futura, só essa pasta muda.

## 6. Modelo de dados (tabelas principais)

- `pessoas` — dados pessoais do ministro (ligado ao login) ✅ criada
- `perfis_acesso` — quais perfis cada pessoa tem ✅ criada
- `auditoria` — preenchida automaticamente por gatilhos do banco ✅ criada
- `igrejas`, `denominacoes` e `bairros` ✅ criadas (a igreja ganhou o cadastro completo/sem registro/em análise e a natureza jurídica; a denominação, a tradição — Fase 5.5)
- `igreja_documentos` (com a validade e o documento antecipado), `igreja_documento_partes` (até 20 partes de 25 MB), `igreja_diretoria` (por cargo, ligada à ata), `igreja_analise_itens` (a igreja nova conferida item por item), `igreja_filiais` e `config_igrejas` (as regras da regularização) ✅ criadas (Fase 5.5)
- `valores_contribuicao` — valor por categoria e tipo (mensal, anual, inscrição), com vigência e assembleia ✅ criada
- `associados` — nº de registro, situação, forma e data de admissão ✅ criada
- `vinculos_igreja` — histórico de ministro ↔ igreja (com data de início/fim) ✅ criada
- `pedidos_troca_igreja` — troca de igreja pedida pelo ministro e decidida pela secretaria ✅ criada
- `titulos_ministeriais` (lista) e `titulos_pessoa` (histórico de títulos de cada um) ✅ criadas
- `dados_comep` — dados públicos do COMEP mostrados no site (uma linha só) ✅ criada
- `pedidos_associacao` — pedidos do formulário, análise da diretoria, assembleia que aprovou, aceites do associado e do diretor ✅ criada
- `codigos_acesso` — códigos de primeiro acesso e de nova senha (o código em si fica só como resumo, numa tabela interna) ✅ criada
- `desligamentos` — motivo (Art. 8º, I a V), a votação que decidiu (ou o falecimento) e a data ✅ criada
- Arquivos (fotos e comprovantes): Storage, bucket privado `documentos`, uma pasta por pessoa; ninguém sobrescreve nem apaga ✅ criado
- `valores_contribuicao` (seção acima) e `config_financeiro` — valores com vigência e dias de vencimento ✅ criadas
- `planos_contribuicao` — mensal ou anual, por associado e exercício ✅ criada
- `cobrancas` — mensalidades e anuidades de cada associado (valor, vencimento, situação, pagamento) ✅ criada
- `informes_pagamento` — pagamentos informados com comprovante e conferência da tesouraria ✅ criada
- `contas` — caixa, banco
- `lancamentos` — entradas e saídas (categoria do Art. 17, conta, projeto, comprovante, autorização do presidente)
- `balancos` — balanço anual: situação, análise da diretoria, parecer do Conselho Fiscal, assembleia que aprovou
- `orcamentos` — orçamento e plano anual de trabalho
- `encontros` e `encontro_pauta` — assembleias ordinárias, extraordinárias e reuniões mensais (tipo, data, convocação, pauta, edital) ✅ criadas
- `config_assembleias` — os números do estatuto (antecedência, meses da AGO, 2ª chamada, faltas) ✅ criada
- `encontro_presencas` — confirmação e presença (lista ou QR Code) ✅ criada
- `justificativas_falta` — justificativa de falta e a decisão do 1º secretário ✅ criada
- `deliberacoes` — pauta votada, maioria exigida (simples, 3/5, 2/3), votantes, votos e resultado ✅ criada
- `atas` — texto, arquivo da ata assinada e as assinaturas do 1º secretário e do presidente ✅ criada
- `mandatos` — pessoa, cargo, órgão (Conselho Diretor ou Conselho Fiscal), início, fim, assembleia que elegeu, encerramento antecipado ✅ criada
- `comissoes` e `comissao_membros`
- `projetos`
- `avisos`
- `pedidos_age` e `pedido_age_assinaturas` — pedidos de Assembleia Extraordinária assinados pelos associados ✅ criadas (Fase 5.5)
- `votacoes`, `votacao_opcoes`, `votacao_votantes` e `votacao_apuracao` — votações e enquetes on-line; a apuração fica separada de quem votou (voto secreto) ✅ criadas (Fase 5.5)
- `patrimonio_itens`, `patrimonio_baixas`, `emprestimos`, `emprestimo_itens` e `config_patrimonio` — os bens, as baixas, os empréstimos às igrejas e as reservas dos eventos, e as regras ✅ criadas (Fase 5.5)

Todas as tabelas (menos `auditoria`, que é imutável): coluna `arquivado_em` (em vez de apagar), `criado_por`, `criado_em`, `atualizado_em`.
Segurança por **RLS (Row Level Security)**: as regras de "quem vê o quê" ficam no próprio banco.

## 7. Governança anti-refém e backup

1. **Contas da associação mantenedora (IEADESPA)** como donas do GitHub e do Supabase nesta fase — decisão de 11/11/2026, porque o Conselho ainda não tem e-mail institucional. Quando tiver, tudo passa para as contas dele (seção 8).
2. **Verificação em duas etapas** ligada; códigos de recuperação impressos e guardados em envelope lacrado, com registro em ata de quem os guarda.
3. **2 a 3 donos** em cada serviço (presidência, secretaria, tesouraria). Nunca um dono só.
4. **Backup semanal automático** — funcionando desde 11/11/2026:
   - todo domingo, às 3h, o GitHub Actions exporta os dois bancos, **criptografa** e salva no repositório privado `comep-backups`;
   - o primeiro backup foi conferido: abre com a chave e não abre sem ela, e os dados batem com o banco;
   - a chave que abre os backups fica **fora do repositório**, num arquivo guardado pela IEADESPA, e também como segredo do GitHub, só para testes de restauração;
   - os arquivos de fotos e comprovantes (Storage) entram no mesmo arquivo criptografado desde 12/11/2026 (testado: 100 arquivos do teste, com a impressão digital de cada um);
   - o passo a passo de restauração está no README do `comep-backups`.
5. **Aviso anti-pausa** — funcionando desde 11/11/2026: a cada 3 dias uma consulta simples mantém os dois bancos ativos.
6. **Teste de restauração** a cada 3 meses (restaurar o backup num projeto de teste e conferir).
7. Ninguém tem botão de "apagar"; só arquivar.
8. Troca de diretoria: checklist de transferência de acessos registrado em ata.

## 8. Hospedagem provisória e transferência ao Conselho

Enquanto o Conselho não tiver CNPJ regularizado e estrutura própria, **todas as contas ficam em nome da associação mantenedora** (a organização da qual a equipe de desenvolvimento faz parte). Nada é criado em nome do Conselho ou de terceiros.

**Situação atual (11/11/2026):**

- **GitHub:** repositórios `IEADESPA/comep` e `IEADESPA/comep-backups` (privados), na organização da IEADESPA.
- **Supabase:** organização da IEADESPA (plano Free), com os projetos `comep-producao` e `comep-teste`, os dois na região **São Paulo (sa-east-1)**. Os dados ficam no Brasil. A tela do Supabase só oferece o continente; a região exata foi escolhida pelo Supabase CLI.
- **Site:** `ieadespa.github.io/comep/` está ligado ao **banco de teste**, com a faixa "versão de teste", até o lançamento da versão 1.0 (seção 14).

**Antes de cadastrar dados reais**, formalizar por escrito (ofício ou termo simples, assinado pela presidência do Conselho e pela associação):

- que o Conselho solicitou o sistema;
- que os dados pertencem ao Conselho (controlador, na LGPD) e que a associação apenas os hospeda provisoriamente (operadora);
- compromisso de sigilo e de não usar os dados para outro fim;
- compromisso de transferência de tudo quando o Conselho estiver apto, sem custo;
- que o código é cedido ao Conselho.

O termo é assinado pelo presidente, que representa o COMEP (Art. 12, §2º, III).

**Transferência (quando o Conselho estiver pronto):**

1. Conselho cria seu e-mail institucional e sua organização no GitHub e no Supabase.
2. GitHub: transferir os repositórios `comep` e `comep-backups` para a organização do Conselho (o histórico vai junto). O endereço do app muda: deixar em `ieadespa.github.io/comep` uma página que redireciona para o novo endereço, para não quebrar os QR Codes das carteirinhas já impressas.
3. Supabase: transferir o projeto para a organização do Conselho. Plano B: restaurar o último backup num projeto novo do Conselho.
4. Entregar a chave de descriptografia dos backups e trocar todas as senhas e segredos.
5. Conselho registra o domínio no próprio CNPJ, se quiser.
6. Assinar termo de entrega; a associação sai como administradora.

## 9. Fases de entrega

Cada fase só é considerada entregue depois de passar pelas **4 travas de revisão da seção 14**. A versão recebe o número da fase: Fase 1 → versão 1.0, Fase 2 → versão 2.0, e assim por diante.

> **Calendário (decisão de 12/11/2026):**
>
> - o presidente do COMEP concordou com tudo o que foi feito e quer as 6 fases prontas;
> - o sistema fica **no ambiente de teste, com dados fictícios**, até o lançamento;
> - o **lançamento com dados reais** (produção) acontece **depois das telas novas e do site vivo, no fim da Fase 5.5** (decisão de 14/11/2026: uma mudança só na produção, de uma vez), pelo roteiro `docs/lancamento.md`;
> - até lá, cada fase fecha com as travas 1 a 3 e o aceite da presidência, e a versão fica `N.0-teste`;
> - a produção já está preparada e vazia.

### Fase 0 — Fundação (versão 0.1, só em teste)

- [x] Usar as contas da IEADESPA (decisão de 11/11/2026, seção 7); dono da organização com verificação em duas etapas
- [x] Repositórios `IEADESPA/comep` e `IEADESPA/comep-backups` (privados)
- [x] Projetos `comep-producao` e `comep-teste` no Supabase, em São Paulo
- [x] Decisão: sem envio de e-mail (seção 5)
- [x] GitHub Pages ativo, com publicação automática via GitHub Actions
- [x] Esqueleto do app (PWA instalável, login, menu por perfil)
- [x] Estrutura inicial do banco (pessoas, perfis de acesso, auditoria) com testes automáticos das regras
- [x] Página inicial institucional com "Portal do membro" e "Quero me associar"
- [x] Cores do COMEP: vermelho, branco e cinza
- [x] Travas de revisão (seção 14), com testes de ponta a ponta automáticos
- [x] Backup semanal criptografado + aviso anti-pausa funcionando (testados em 11/11/2026)
- [x] Revisão da Fase 0 concluída (`docs/revisoes/fase-0.md`)

**Fica para depois, sem travar a Fase 1:**

- o membro `presidente-ai` é o login do **presidente da igreja (IEADESPA)**, o 2º login da entidade: **já é dono** da organização no GitHub (conferido em 12/11/2026); falta ligar a verificação em duas etapas;
- o termo da seção 8 passa a ser exigido no lançamento da versão 1.0, antes de entrar dado real.

### Fase 1 — Associação, ministros e igrejas (versão 1.0-teste) — concluída em 12/11/2026

A Fase 1 é entregue em partes. Cada parte passa pelas travas 1 a 3 no ambiente de teste; a trava 4 (produção) é uma só, no lançamento da versão 1.0. Revisão: `docs/revisoes/fase-1.md`.

**1.1 — Cadastros** (versão 1.0-teste.1) — concluída em 11/11/2026

- [x] Igrejas e denominações (CNPJ conferido, inclusive o novo CNPJ com letras)
- [x] Títulos ministeriais (lista provisória até a decisão 9, sem tela própria por enquanto)
- [x] Cadastro direto dos associados atuais pela secretaria (Art. 7º, a), com nº de registro automático
- [x] Ficha do ministro para a secretaria: contato, histórico de títulos e de igrejas, troca de igreja registrada pela secretaria
- [x] Tela de perfis de acesso (presidência) e tela de auditoria

**1.2 — Configurações e pedido de associação** (versão 1.0-teste.2)

- [x] Tela de Configurações (seção 4.11): denominações, bairros, títulos de ministro e valores da contribuição, com histórico
- [x] Pastor presidente (perfil automático Presidente de igreja) e jubilado; categoria de contribuição automática
- [x] Menu e conteúdo em colunas independentes no computador (cada um rola por conta própria)
- [x] Código de acesso, sem e-mail (seção 4.1): primeiro acesso dos associados atuais **e senha esquecida** (adiantada da 1.3)
- [x] Formulário "Quero me associar": título e comprovante, igreja, foto, declaração dos princípios de fé (Art. 7º, §1º) e consentimento LGPD
- [x] Análise pela diretoria (devolver com pendência, aceite de um diretor na ficha, recusa com motivo) e registro da aprovação em Assembleia Ordinária (Art. 7º)

**1.3 — Portal do ministro** (versão 1.0-teste.4) — concluída em 12/11/2026

- [x] Meu perfil: ver e corrigir os próprios dados (LGPD), trocar a foto e a senha; nº de registro, categoria e valor da contribuição, título e igreja com histórico
- [x] Pedido de troca de igreja pelo próprio ministro, aprovado ou recusado pela secretaria/presidência na tela de Ministros
- [x] Painel do presidente de igreja ("Minha igreja"): os ministros da sua igreja (só nome, telefone, nº, título e função) e o contato da igreja (endereço, bairro, telefone) — decisão 12, previsão: mantido

**1.4 — Lançamento** (versão 1.0) — roteiro em `docs/lancamento.md`

- [x] Revisão geral da Fase 1 (trava): revisão de segurança independente, conferência do banco e da API, dependências e testes; 10 correções aplicadas (12/11/2026)
- [x] Ambiente de teste no endereço próprio: `ieadespa.github.io/comep/teste/` (12/11/2026)
- [x] Aceite da presidência às regras do estatuto (12/11/2026: o presidente do COMEP concordou com tudo o que foi feito)
- [x] Banco de teste cheio de dados fictícios (`testes/dados/semente-teste.sql`): 20 igrejas, 50 associados, pedidos em todas as situações, trocas pendentes, fotos e comprovantes de mentira
- [x] Backup também das fotos e comprovantes (Storage), testado em 12/11/2026
- [x] Produção preparada sem dados: estrutura do banco e configuração de login (`docs/configuracao-login.md`)
- **Ficam para o lançamento, depois da Fase 5:**
  - verificação em duas etapas nas duas contas donas do GitHub;
  - termo da seção 8 assinado (modelo em `docs/termo-hospedagem.md`);
  - cadastrar o presidente do COMEP e dar a ele o perfil Presidência (a composição completa da diretoria entra depois — decisão 10);
  - site oficial ligado ao banco de produção e dados reais liberados.

### Fase 2 — Financeiro (versão 2.0-teste) — concluída em 12/11/2026

Revisão: `docs/revisoes/fase-2.md`.

**2.1 — Contribuições** (versão 2.0-teste.1) — concluída em 12/11/2026

- [x] Cobranças do exercício (abril a março) por categoria: mensal ou anual (escolha do associado), jubilado isento, admissão no meio do exercício
- [x] Informar pagamento com comprovante; conferência pela tesouraria (confirmar ou recusar com motivo); pagamento recebido em mãos
- [x] Em dia / em atraso (define o direito a voto — Art. 11); lista de inadimplentes; situação na ficha e no painel do presidente de igreja
- [x] Vencimentos configuráveis — padrões provisórios: dia 10 e 30 de abril (pergunta 18)
- [x] Taxa de inscrição — **isenta** (decisão de 12/11/2026); valor e prazo configuráveis em Configurações, para quando a assembleia decidir

**2.2 — Caixa** (versão 2.0-teste.2) — concluída em 12/11/2026

- [x] Contas (caixa em dinheiro, banco) com saldo inicial; lançamentos de entrada e saída com categorias (Art. 17) e comprovante
- [x] Despesas autorizadas pelo presidente (Art. 12, §2º, VI): a despesa só sai do saldo depois de autorizada; ninguém autoriza a própria; recusa com motivo
- [x] Pagamento confirmado vira entrada no caixa automaticamente (dinheiro → caixa; PIX, depósito e transferência → banco)
- [x] Transferência entre contas (ex.: depósito das ofertas); cancelamento com motivo, nada se apaga
- [x] Contas e categorias editáveis em Configurações

**2.3 — Prestação de contas** (versão 2.0-teste.3) — concluída em 12/11/2026

- [x] Perfil **Conselho Fiscal**: vê todo o financeiro (só leitura) e os comprovantes de pagamento; dá o parecer (Art. 14). Até a Fase 4, o perfil é dado em Administração → Acessos
- [x] Balanço anual em quatro passos: a tesouraria fecha (números congelados e exercício travado), a diretoria analisa, o Conselho Fiscal dá o parecer e a assembleia aprecia — com devolução para correção e histórico
- [x] Orçamento e plano anual de trabalho, com previsto × realizado e o registro da aprovação em assembleia (Art. 15, I)
- [x] Relatórios: resumo do exercício (saldos, receitas e despesas por categoria, contribuições), mês a mês e contribuições por igreja; impressão/PDF e planilha (CSV)

### Fase 3 — Credencial do associado (versão 3.0-teste)

Decisões na seção 4.5. Revisão: `docs/revisoes/fase-3.md`.

**3.1 — Dados da credencial** (versão 3.0-teste.1) — concluída em 13/11/2026

- [x] CPF e filiação no cadastro, no pedido de associação e no "Meu perfil". Depois de preenchidos, só a secretaria corrige
- [x] Sigla da igreja (secretaria e pastor presidente)
- [x] Lista de pendências da credencial: no perfil, na ficha e na lista de ministros (filtro)

**3.2 e 3.3 — Credencial digital, validação pública e impressão** (versão 3.0-teste.2) — concluídas em 13/11/2026

- [x] "Minha credencial" (frente e verso na tela, também no app instalado) e, para a secretaria e a presidência, o menu **Credenciais** (todas: ver, imprimir, conferir)
- [x] QR Code que se atualiza sozinho: página pública com a situação de agora (ativo, em dia ou inapto a votar, válida até o fim do mandato — Configurações → Credencial)
- [x] Perda ou roubo: a secretaria emite outra credencial e o QR antigo passa a dizer "substituída"
- [x] Impressão no tamanho de cartão (CR80, 85,6 × 54 mm): 5 por folha A4; uma ou várias de uma vez
- [x] Ajuste de 13/11/2026: frente e verso **juntos** para dobrar e plastificar; o nome numa linha só e nada cortado; foto 3×4; **validade na credencial** (a impressa é impressa de novo a cada mandato; a digital muda sozinha)

**3.4 — Editor do modelo da credencial** (versão 3.0-teste.3) — concluída em 13/11/2026

- [x] Editar onde fica cada coisa, fotos, cores, formas e textos, com prévia, e voltar ao modelo anterior:
  - em Credenciais → **Editar o modelo (desenho) da credencial**, para a secretaria e a presidência;
  - arrastar e mudar o tamanho com o mouse ou o dedo, ajustar pelos campos (em mm) ou mover com as setas;
  - acrescentar textos, dados do associado, foto, QR Code, imagens (ex.: o logo oficial), retângulos, círculos e linhas;
  - prévia com dados de exemplo (nome bem comprido) ou de um associado, e como sai na impressão, em tamanho real;
  - desfazer e refazer; conferência antes de salvar (QR pequeno, item fora do cartão, falta o nome, a foto ou a validade);
  - cada vez que se salva nasce uma versão; dá para usar qualquer versão, voltar ao modelo padrão e arquivar as que não servem (nada se apaga)

### Fase 4 — Assembleias, reuniões e diretoria (versão 4.0-teste) — concluída em 14/11/2026

Decisões na seção 4.6. Revisão: `docs/revisoes/fase-4.md`. **O estatuto pode ser reformado** (administrador técnico, 13/11/2026): os números dele ficam em Configurações → Assembleias e reuniões, com o valor do estatuto de 2021 como padrão.

**4.1 — Assembleias e reuniões: convocação, pauta e edital** (versão 4.0-teste.1) — concluída em 13/11/2026

- [x] Assembleias ordinárias e extraordinárias e reuniões mensais; convocação com 30 dias, pauta e edital publicados no site:
  - a secretaria (ou a presidência) prepara: data, local, pauta (com o que vai a votação e a maioria exigida) e o texto do edital, que o sistema escreve a partir dos dados;
  - **o presidente convoca** as assembleias (Art. 16, §2º). O banco recusa: menos de 30 dias, AGO fora da 2ª quinzena de abril ou outubro, sem pauta, sem edital, ou AGE sem dizer quem pediu (3/5 dos associados ou o Conselho Diretor);
  - convocada, a assembleia aparece no **site**, para qualquer pessoa (edital e pauta), e se compartilha pelo WhatsApp;
  - reunião mensal: a secretaria marca e publica, sem prazo e sem votação; dá para criar as dos próximos meses de uma vez (mesma semana e dia da semana);
  - cancelar pede motivo (o site mostra "cancelada"); arquivar só tira das listas.

**4.2 — Presença e faltas** (versão 4.0-teste.2) — concluída em 13/11/2026

- [x] Presença, check-in por QR Code e justificativa de falta (aceita pelo 1º secretário); aviso de faltas seguidas (Art. 8º, IV):
  - o associado confirma "vou participar" e, se não puder ir, justifica a falta (até 30 dias depois);
  - **check-in pelo QR Code:** a secretaria aponta a câmera do celular para a credencial; a página de validação abre com o botão "Marcar presença". Nos navegadores que leem QR Code (Chrome e Edge), também dá para ler pela própria lista de presença. Há sempre a busca pelo nome;
  - a lista mostra quem está em dia (vota) e quem está em atraso; encerrada, o encontro fica "realizado" e quem não esteve tem falta;
  - a justificativa vai ao 1º secretário (por enquanto, o perfil Secretaria; na 4.4, pelo cargo), que aceita ou recusa com motivo;
  - **faltas seguidas** às reuniões mensais, sem justificativa aceita: com 2, o associado vê o aviso no Início e a secretaria vê a lista; com 3, "levar à pauta da assembleia". Se vale também para as assembleias é a pergunta 22

**4.3 — Quórum, votações e ata** (versão 4.0-teste.3) — concluída em 13/11/2026

- [x] Quórum sobre os associados aptos (Art. 16, §4º), só votantes em dia (Art. 11) e maiorias exigidas (3/5, 2/3):
  - "Instalar a assembleia": 1ª chamada com metade mais um dos aptos (ativos e em dia) presentes; sem quórum, a 2ª chamada, passados os minutos das regras (60), instala com qualquer número. A conta do momento fica guardada;
  - votam só os presentes em dia: o sistema recusa mais votos que isso;
  - maioria simples (mais a favor que contra); 3/5 e 2/3 sobre os presentes aptos (pergunta 24). A conta aparece na tela e na ata
- [x] Deliberações e ata assinada pelo presidente e pelo 1º secretário:
  - o 1º secretário (perfil Secretaria até a 4.4) gera o texto da ata a partir do registrado (instalação, cada item com o resultado) e ajusta;
  - assinam o 1º secretário e o presidente, duas pessoas diferentes; depois da primeira assinatura o texto não muda;
  - dá para anexar a ata assinada no papel (PDF ou foto); assinada, todos os associados leem
- [x] Desligamentos decididos em assembleia (Art. 8º):
  - casos I a IV: item da pauta da AGO com maioria de 3/5; aprovado, o associado fica "desligado" e perde o perfil de ministro;
  - falecimento (V): registrado na ficha do ministro, sem votação (pergunta 5)

**4.4 — Diretoria e Conselho Fiscal** (versão 4.0-teste.4) — concluída em 13/11/2026

- [x] Diretoria e Conselho Fiscal: eleições, mandatos e perfis automáticos pelo cargo:
  - menu **Diretoria**: quem está em exercício e o histórico, para todos com login;
  - a presidência registra a diretoria eleita (posse, fim — até 4 anos — e a assembleia que elegeu). Só associados em dia podem ser votados (Art. 11); um por cargo (3 no Conselho Fiscal); ninguém acumula cargos, nem diretoria e Conselho Fiscal;
  - *revisão geral (14/11/2026):* o primeiro registro leva a ata ou o documento da eleição; depois, só com a **AGO ou AGE instalada** no sistema. Ninguém registra a si mesmo num cargo que lhe dá poder novo. Tirar alguém de presidente, vice ou do Conselho Fiscal pede a assembleia; a renúncia é a própria pessoa que faz;
  - **o cargo dá o perfil** enquanto o mandato vale; encerrar antes (renúncia, desligamento) tira o perfil; desligado do COMEP perde o perfil do cargo;
  - se o fim do mandato nas credenciais não é o da diretoria em exercício, a tela avisa para registrar o novo mandato

**Revisão geral da Fase 4** (14/11/2026) — `docs/revisoes/fase-4.md`, seção "Revisão geral da Fase 4". Também mudou:

- o **desligamento** (Art. 8º) é indicado na pauta já na convocação: na assembleia, só aquele associado pode ser desligado naquele item;
- as votações travam na **primeira** assinatura da ata; assembleia instalada não se cancela;
- só a **presidência** muda as regras das assembleias; a 2ª chamada fica a da regra que valia na convocação

### Fase 5 — Igrejas, comissões, eventos e comunicação (versão 5.0)

Roteiro de 14/11/2026: a Fase 5 começa pela igreja como instituição; as respostas 26 a 39 (seção 11.3) valem para toda a fase, sem novas perguntas.

- [x] **Antes, a entrega 4.5:** ajustes das respostas de 14/11/2026 nas regras das fases 2 e 4 (seção 11.5) — concluída em 14/11/2026 (versão 4.0-teste.6)
- [x] **5.1 — A igreja como instituição e o presidente de igreja** (seção 4.3): estatuto, cartão CNPJ e diretoria da igreja; o painel do presidente de igreja; pedidos de correção no cadastro dos ministros — concluída em 14/11/2026 (versão 5.0-teste.1; revisão em `docs/revisoes/fase-5.md`)
- [x] **5.2 — Comissões** permanentes e temporárias: só associados; a presidência e a secretaria criam; o coordenador cuida da sua comissão — concluída em 14/11/2026 (versão 5.0-teste.2)
- [x] **5.3 — Eventos e projetos:** orçamento aprovado pela assembleia, lançamentos vinculados, inscrição aberta ao público pelo site e taxa por evento; o secretário executivo é o responsável — concluída em 14/11/2026 (versão 5.0-teste.3). O site ganhou a **Agenda** (primeiro passo do site vivo)
- [x] **5.4 — Mural de avisos e painel da presidência:** só a secretaria publica e escolhe se o aviso vai ao site; envio pelo WhatsApp; painel com associados, finanças, presença, agenda e projetos — concluída em 14/11/2026 (versão 5.0-teste.4)
- [x] Revisão geral da Fase 5 — 14/11/2026 (versão 5.0-teste.5; `docs/revisoes/fase-5.md`)

O lançamento em produção passou para o fim da Fase 5.5 (14/11/2026).

### Fase 5.5 — Patrimônio, assembleia on-line, telas novas, site vivo e lançamento

Decidida em 14/11/2026: o que o sistema consegue fazer sozinho, entre a Fase 5 e a 6. **A produção só entra no fim desta fase**, já com as telas novas e o site: uma mudança só, de uma vez.

- [x] **5.5.1 — Patrimônio e empréstimo às igrejas** (seção 4.12) — 17/11/2026 (versão 5.5.0-teste.1): bens com a compra no caixa, agenda, pedido do presidente de igreja com o termo de compromisso, aprovação, retirada, devolução e baixa. As regras de apoio ficam configuráveis até a diretoria decidir
- [x] **5.5.2 — Votações e enquetes on-line** (seção 4.13) — 17/11/2026 (versão 5.5.0-teste.2): enquetes, votações com a maioria exigida, voto secreto ou aberto, prazo, e o item da pauta votado pelo celular dos presentes (o resultado vai para a ata). O usuário pediu para fazer sem se prender ao estatuto
- [x] **5.5.3 — Pedido de Assembleia Extraordinária on-line** (seção 4.6, Art. 16, §3º) — 17/11/2026 (versão 5.5.0-teste.3): o associado abre o pedido com a pauta, os outros assinam; com 3/5 dos aptos ou a maioria do Conselho Diretor, a presidência marca a AGE a partir dele
- [ ] **Telas novas:** design moderno, cores e uso no celular e no notebook, com o sistema já completo. Referência: dois artefatos de telas feitos no Claude (um para uma igreja, outro para outra associação)
- [ ] **Site vivo** (14/11/2026): o site institucional, hoje de uma página, ganha as páginas úteis, e o que se lança no sistema aparece no site (e vice-versa):
  - **do sistema para o site:** convocações, eventos, avisos públicos do mural, diretoria e igrejas do COMEP;
    - *entrega 5.5.4 (17/11/2026, versão 5.5.0-teste.4):* páginas **Diretoria** (Conselho Diretor e Conselho Fiscal com mandato valendo hoje: cargo, nome e período) e **Igrejas** (as que têm ministros associados ativos: nome, sigla, denominação, bairro e quantos ministros, com busca), e os **números do COMEP** na página inicial. Sem dados pessoais: endereço e telefone das igrejas, e foto, e-mail e telefone das pessoas não vão para o site;
  - **do site para o sistema:** pedido de associação e inscrição nos eventos;
  - o GitHub Pages publica o próprio sistema: as páginas novas são telas do mesmo aplicativo, com os dados do banco.
  - Revisto e conferido antes da produção.
- [ ] **Lançamento em produção, com dados reais** (`docs/lancamento.md`): verificação em duas etapas dos donos, termo assinado, dados do presidente, site oficial no banco de produção. O sistema recomeça do zero (respostas 37 a 39)

### Fase 6 — Melhorias futuras

- [ ] APK para Android
- [x] Notificações no celular — antecipadas para a Fase 5.5 (entrega 5.5.14), pelo navegador; o envio liga com as chaves (`docs/avisos-no-celular.md`)
- [ ] PIX automático / conciliação bancária
- [ ] Avaliar migração para servidor próprio ou plano pago, se o Conselho crescer

## 10. Limites do plano gratuito e "pegadinhas" (com a solução de cada uma)

| Ponto de atenção | O que acontece | Como resolvemos |
|---|---|---|
| **Pausa por inatividade** | Projeto gratuito pausa após 7 dias sem acesso ao banco (os dados **não** são apagados) | GitHub Actions acessa o banco a cada 3 dias |
| **Sem backup automático no plano Free** | O Supabase não guarda cópias para nós | Backup semanal próprio, criptografado, no GitHub |
| **Sem envio de e-mail** | O Supabase gratuito só manda poucos e-mails por hora, e só para a equipe; não haverá serviço de e-mail | Confirmação por e-mail desligada; acesso só depois da aprovação em assembleia; primeiro acesso e senha esquecida com **código** gerado pela secretaria e enviado pelo WhatsApp |
| **Cadastro aberto sem confirmação de e-mail** | Qualquer pessoa cria login com o nome e o e-mail que quiser | Login sozinho não dá acesso a nada; perfis da diretoria só para associados ativos (conferidos); a tela de perfis mostra quem não é associado; limite de 30 cadastros a cada 5 minutos por endereço |
| **Proteção contra senhas vazadas** | O Supabase só confere senhas vazadas (HaveIBeenPwned) no plano pago | Senha com no mínimo 8 caracteres, com letras e números |
| **Código das telas é visível** | Mesmo com repositório privado, o navegador baixa o código das telas | Nenhum segredo ou dado no repositório; segurança garantida pelo banco (RLS) |
| **Limites de espaço** | 500 MB de banco, 1 GB de arquivos, 5 GB de tráfego/mês | Comprimir fotos (~100 KB); PDFs pequenos; acompanhar o painel de uso |
| **Usuários** | 50.000 usuários **diferentes** por mês | Muito acima do necessário |
| **Só 2 projetos gratuitos** | Limite de projetos ativos por conta | 1 produção + 1 teste |
| **Regras de segurança mal feitas** | Risco de um membro ver dados de outro | Testes automáticos das regras RLS antes de cada publicação (trava 1) |
| **Mudança de regras da empresa** | O fornecedor pode mudar o plano gratuito | Backup próprio + banco PostgreSQL padrão = dá para migrar |

## 11. Decisões

### 11.1 Já respondidas pelo estatuto

| Pergunta | Resposta | Onde |
|---|---|---|
| Quem aprova a inscrição? | A diretoria recebe e analisa; a **Assembleia Ordinária aprova**. A ficha é assinada pelo associado e por um diretor | Art. 7º |
| Quais documentos são obrigatórios? | Comprovante do título reconhecido pela denominação e declaração de que a igreja segue os princípios de fé do §1º. RG/CPF digitalizados não são exigidos (e não serão pedidos — LGPD) | Art. 7º, a e §1º |
| Existe "suspenso"? | **Não.** Quem está em atraso só perde o direito de votar e ser votado. A situação "suspenso" foi retirada | Art. 11 |
| Quem vota? | Só associados em dia com os compromissos | Art. 11 |
| Quórum das assembleias | Metade mais um na 1ª convocação; qualquer número 60 minutos depois | Art. 16, §4º |
| Maiorias especiais | 3/5 para desligar associado; 2/3 para reformar o estatuto; 3/5 dos associados para pedir assembleia extraordinária | Art. 8º, 21 e 16, §3º |
| Quando são as assembleias? | Ordinárias na 2ª quinzena de abril e de outubro; convocação com 30 dias de antecedência | Art. 16, §2º e §6º |
| Quem assina as atas? | Presidente e 1º secretário | Art. 12, §2º, IV e §4º |
| Quem autoriza despesas? | O presidente | Art. 12, §2º, VI |
| Prestação de contas | Balanço anual do 1º tesoureiro, analisado pela diretoria, com parecer do Conselho Fiscal, apreciado em assembleia | Art. 12, §6º; Art. 14; Art. 15 |
| Nome oficial | COMEP — Conselho de Ministros Evangélicos de Parauapebas (o Art. 1º escreve "em Parauapebas") | Art. 1º |
| Identidade visual | O logo existe (letras COMEP com um círculo no "O"). **Cores** (informadas em 11/11/2026): vermelho (principal), branco e cinza. O arquivo original do logo será pedido depois | Capa |
| Envio de e-mails | **Não haverá** (decisão de 11/11/2026) — ver seção 5 | — |

### 11.2 Respondidas pela diretoria (11/11/2026)

As perguntas 1 a 14 foram levadas à diretoria em 11/11/2026. As primeiras respostas chegaram no mesmo dia. Os números das perguntas não mudam.

| Pergunta | Resposta da diretoria | Como fica no sistema |
|---|---|---|
| 1. Valores | **Presidente de igreja:** R$ 40,00 por mês ou R$ 400,00 por ano. **Não presidente:** R$ 20,00 por mês ou R$ 200,00 por ano. **Jubilado:** isento. O anual é pago em abril | Valores configuráveis, com histórico; categoria no cadastro do associado (seção 4.4). Taxa de inscrição: isenta, configurável (pergunta 17, respondida em 12/11/2026) |
| 2. Anual ou mensal? | Os dois: o associado paga por mês ou o ano inteiro em abril | Escolha do associado; detalhes na pergunta 18 |
| 3. Quando fica "em atraso"? | O exercício termina no último dia de março. Só vota e é votado quem está com a mensalidade em dia | Exercício de 1º de abril a 31 de março; "em dia" calculado pelos vencimentos (perguntas 18 e 19) |
| 4. Conselho Fiscal | 3 membros, mandato de 4 anos, com as mesmas datas do Conselho Diretor | Regra fixa no sistema |
| 6. Quórum | 1ª chamada: 50% + 1 dos associados aptos. 2ª chamada: com os presentes | Quórum calculado sobre os associados em dia na data da assembleia |
| 7. Reuniões mensais | Não têm efeito de AGO nem de AGE. A justificativa de falta vai ao 1º secretário | Reunião mensal registra presença e faltas, sem votações de assembleia; o 1º secretário aceita ou recusa a justificativa. Continua pendente: têm dia fixo? |
| 8. Carteirinha | Validade de 4 anos, correspondente ao pleito | **Respondida em 12/11/2026** (seção 4.5): o QR Code mostra a validade de agora, sem data impressa e sem reimpressão. **Revista em 13/11/2026:** a credencial traz "Válida até" (fim do mandato); a digital passa sozinha para o mandato seguinte e a impressa é impressa de novo a cada mandato |
| 9. Títulos aceitos *(12/11/2026)* | Pastor(a), Evangelista, Presbítero, Apóstolo(a), Bispo(a) | Lista aplicada; "Missionário" e "Líder" (provisórios) arquivados. A lista continua editável em Configurações |
| 10. Diretoria atual *(12/11/2026)* | A composição completa não está disponível; só se tem o presidente | No lançamento, o presidente é cadastrado e recebe o perfil Presidência. Os demais cargos recebem os perfis em "Perfis de acesso" quando forem informados (e, na Fase 4, pelos mandatos) |
| 14. Dados para o site *(12/11/2026)* | Ainda não há (CNPJ, sede, contatos) | O site mostra "—"; a diretoria preenche em Configurações → Dados do COMEP no site, e o site atualiza na hora |

### 11.3 Perguntas levadas à diretoria — todas respondidas em 14/11/2026

Em 14/11/2026, o administrador técnico respondeu todas as perguntas pendentes, em questionário. O que cada resposta muda no sistema está na seção 11.5.

**Levadas à diretoria em 11/11/2026:**

5. ~~Desligamento~~ — *respondida em 14/11/2026: **só a conduta contrária à ética (II) vai à votação de 3/5**, depois de um processo disciplinar. O pedido por escrito (I), a transferência (III), as 3 faltas seguidas (IV) e o falecimento (V) são fatos: **a diretoria homologa e registra**, sem votação ("não se vota um fato").*
6. ~~Quórum~~ — *respondida em 11/11/2026 (seção 11.2): sobre os associados aptos (em dia).*
7. ~~Reuniões mensais~~ — *respondida em 14/11/2026: **não têm dia fixo**; a secretaria marca cada uma.*
8. ~~Carteirinha~~ — *respondida em 12/11/2026 (seção 4.5): foto, nome, CPF, filiação, nº de registro, data de ingresso, título, função na igreja, sigla e CNPJ da igreja; validade pelo QR Code. Revista em 13/11/2026: também com "Válida até" impresso (a impressa é renovada a cada mandato).*
9. ~~Títulos ministeriais aceitos~~ — *respondida em 12/11/2026 (seção 11.2).*
10. ~~Diretoria atual~~ — *respondida em 14/11/2026: a presidência **registra a diretoria no lançamento**, na tela Diretoria, com a ata ou o documento da eleição e as datas do mandato.*
11. ~~Regimento Interno~~ — *respondida em 14/11/2026: **não existe**.*
12. ~~Perfil "presidente de igreja"~~ — *respondida em 14/11/2026: **mantido e a melhorar**: vai ser muito importante no futuro. O administrador técnico vai detalhar o que melhorar.*
13. ~~Cópia completa do estatuto~~ — *respondida em 14/11/2026: **não há outra cópia**. A reforma do estatuto pode levar um ano. Por isso, o sistema tem **configurações do estatuto** que a diretoria muda sem programação (valores, prazos, tempo de mandato e outras), conforme o que a assembleia decidir. Só uma mudança grande pede programação nova.*
14. ~~Dados para o site~~ — *respondida em 14/11/2026: **a diretoria preenche depois** em Configurações → Dados do COMEP no site.*

**Dúvidas sobre as respostas de 11/11/2026:**

17. ~~Taxa de inscrição~~ — *respondida em 12/11/2026: hoje é **isenta**; a assembleia pode definir um valor no futuro (botão "Personalizar" em Configurações). O jubilado continua isento.*
18. ~~Vencimentos~~ — *respondida em 14/11/2026:*
    - *a mensalidade vence no **dia 10**;*
    - *o anual vence **na data da AGO** que abre o exercício: a pessoa tem os 30 dias do edital para pagar. Se o estatuto mudar o mês da AGO, o vencimento acompanha;*
    - *dá para **trocar entre mensal e anual no meio do exercício**;*
    - *quem é admitido no meio do exercício paga **só os meses que faltam**.*
19. ~~Voto na assembleia de abril~~ — *respondida em 14/11/2026: para votar e ser votado na AGO, é preciso ter pago **abril (mensalista) ou o anual antes de a assembleia começar**.*
20. ~~Jubilado~~ — *respondida em 14/11/2026: o jubilado **vota, mas não pode ser votado** para cargo. A jubilação vem da denominação: a secretaria recebe o documento e põe na **pauta da assembleia, que aprova** ou não.*
21. ~~Validade da carteirinha~~ — *respondida em 12/11/2026: sim, vale até o fim do mandato em curso; renovando (em dia no ano da eleição), o QR Code passa sozinho para o mandato seguinte, sem reimprimir. Revisto em 13/11/2026: isso vale para a digital; a impressa traz a validade e é impressa de novo a cada mandato (seção 4.5).*
22. ~~Faltas~~ — *respondida em 14/11/2026: as 3 faltas seguidas contam **só nas assembleias (AGO e AGE)**, não nas reuniões mensais. Com 3, a diretoria homologa o desligamento (pergunta 5).*
23. ~~Pagamento informado e ainda não conferido~~ — *respondida em 14/11/2026: **conta como em dia** se foi informado até o vencimento. Se a tesouraria recusar depois, volta ao atraso.*
24. ~~Maiorias de 3/5 e 2/3~~ — *respondida em 14/11/2026: a base são os **votos válidos (sim + não)** dos presentes em dia. Abstenção e voto em branco não entram. Ex.: 5 presentes em dia, 1 se abstém: 3/5 é sobre os 4 votos válidos.*
25. ~~"Metade mais um" com número ímpar~~ — *respondida em 14/11/2026: **37,5 + 1, arredondado para cima: 39** com 75 em dia.*

**Fase 5 e lançamento (perguntas novas, respondidas em 14/11/2026):**

26. **Quem assina a ata, convoca e decide as justificativas, depois do lançamento:** **só quem tem o cargo** (presidente e 1º secretário em exercício; o vice e o 2º secretário quando os substituem). Até lá, vale o perfil (risco F6 da revisão geral da Fase 4).
27. **Secretário executivo:** as duas coisas — **expediente** (o acesso da secretaria e os lançamentos financeiros) e **responsável pelos eventos** do Conselho (palestras, conferências).
28. **Comissões — membros:** **só associados**.
29. **Comissões — quem cria e indica os membros:** **presidência e secretaria**.
30. **Comissões — coordenador:** **ganha acesso à própria comissão**. O modo das comissões vai ser melhorado depois.
31. **Orçamento de projetos e eventos:** **a assembleia aprova**.
32. **Inscrição nos eventos:** **aberta ao público, pelo site**.
33. **Taxa de inscrição nos eventos:** **às vezes**, com valor definido por evento; a tesouraria registra quem pagou.
34. **Mural — quem publica:** **só a secretaria**.
35. **Mural no site:** **a secretaria escolhe**, aviso a aviso, se vai também para o site público.
36. **Painel da presidência:** **associados**, **finanças**, **presença** e **agenda e projetos**.
37. **Lançamento — cadastro:** **o sistema recomeça do zero.** Não há lista: todos se cadastram pelo link do site e passam pela aprovação.
38. **Lançamento — mensalidades antigas:** **não existem.** As cobranças começam só depois que cada um é aprovado.
39. **Lançamento — aprovação dos que já eram do COMEP:** a **secretaria aprova** como "associado anterior ao sistema", para já usarem o sistema, e a **primeira AGO homologa a lista inteira**.

### 11.4 Internas (equipe técnica, sem levar à diretoria)

15. Donos das contas e quem guarda os códigos de recuperação — o 2º dono é o presidente da igreja (IEADESPA), pelo login `presidente-ai`: **já é dono** no GitHub (12/11/2026); falta ligar a verificação em duas etapas e guardar os códigos de recuperação.
16. Arquivo original do logo — pedir depois; as cores já estão aplicadas.

### 11.5 O que as respostas de 14/11/2026 mudam no sistema

Antes da Fase 5, uma entrega de ajustes (**4.5**) acerta as regras das fases 2 e 4. A Fase 5 já nasce com as respostas 26 a 39.

**Entrega 4.5 — ajustes das respostas** (versão 4.0-teste.6) — concluída em 14/11/2026. Revisão: `docs/revisoes/fase-4.md`, seção "Entrega 4.5":

- **Desligamento** (5 e 22):
  - só o inciso II vai à votação de 3/5 na AGO;
  - I, III, IV e V são homologados e registrados pela diretoria, com o documento;
  - as faltas seguidas contam só nas AGO e AGE.
- **Maiorias e quórum** (24 e 25):
  - 3/5 e 2/3 sobre os votos válidos (sim + não) dos presentes em dia;
  - 1ª chamada com a metade dos em dia mais um, arredondada para cima.
- **Contribuições** (18, 19 e 23):
  - o anual vence na data da AGO do exercício;
  - troca entre mensal e anual no meio do exercício;
  - para a AGO, abril ou o anual pago antes de começar;
  - o pagamento informado no prazo conta como em dia até a conferência.
- **Jubilado** (20): vota, mas não é votado. A jubilação vai à pauta da assembleia, com o documento da denominação.
- **Configurações do estatuto** (13): o tempo de mandato e o número de membros do Conselho Fiscal entram em Configurações → Assembleias e reuniões, junto com os números que já estavam lá (antecedência, meses e dia da AGO, 2ª chamada, faltas). Os valores e vencimentos continuam em Configurações → Financeiro.
- **Secretário executivo** (27): o cargo dá os perfis da secretaria e da tesouraria. Os eventos ficam com ele na Fase 5.

**No lançamento** (26, 37 a 39):

- recomeça do zero, com todos pelo cadastro do site;
- os antigos são aprovados pela secretaria e homologados na primeira AGO;
- a ata, a convocação e as justificativas passam a ser só de quem tem o cargo.

## 12. Convenções de desenvolvimento

- Idioma do código, das tabelas e da interface: **português**.
- Cada fase em um *branch* próprio; nada entra na `main` sem pull request com a verificação automática verde (trava 1).
- Toda fase passa pelas **travas de revisão da seção 14** antes de ir para produção.
- Segredos (chaves, senhas) **nunca** no repositório — só nos *Secrets* do GitHub Actions.
- Dados de teste fictícios; nunca usar dados reais de ministros em testes.
- Migrações do banco só **acrescentam** (nada se apaga); a mesma migração vai primeiro para o `comep-teste` e só depois para o `comep-producao`.
- Este arquivo (`PROJETO.md`) é atualizado a cada decisão da diretoria.

## 13. O Conselho segundo o Estatuto

Fonte: **Estatuto do COMEP**, Parauapebas, 25 de maio de 2021. Cópia digitalizada de 9 páginas, com carimbo de registro em cartório, assinada pelo Conselho Diretor e pelos conselheiros. O estatuto vale por prazo indeterminado, a partir da data do registro (Art. 24). O PDF original fica fora do repositório.

### 13.1 Identificação (Cap. I)

| Item | O que diz o estatuto |
|---|---|
| Nome | Conselho de Ministros Evangélicos em Parauapebas — **COMEP** (Art. 1º). Capa, cabeçalho e logo usam "de Parauapebas" |
| Natureza | Sociedade civil de natureza religiosa, **sem fins lucrativos**, por tempo indeterminado (Art. 1º). Não distribui lucros (Art. 2º) |
| Sede | Provisória: Avenida I, quadra 118, lote 42, sala 1 — Cidade Jardim — Parauapebas/PA. Foro: Parauapebas (Art. 1º) |
| Quem compõe | Número ilimitado de pastores e líderes evangélicos/protestantes do município (Art. 1º e 6º) |
| Independência | Não é subordinado a igrejas, denominações, convenções ou entidades e não intervém nelas (Art. 5º e parágrafo único) |
| Fé | Jesus Cristo como único Senhor, a direção do Espírito Santo e a Bíblia Sagrada como única regra de fé e prática (Art. 5º) |
| Parcerias | Pode se associar a outras instituições evangélicas nacionais ou internacionais, com aprovação da Assembleia Geral (Art. 4º) |

### 13.2 Finalidades (Art. 3º)

1. Reuniões periódicas entre pastores de diversas denominações: intercâmbio, amizade e companheirismo, respeitadas as diferenças doutrinárias.
2. Trabalhar pela unidade visível do corpo de Cristo.
3. Ações comuns entre denominações em evangelização, cultura cristã, ensino, edificação e ação social.
4. Comissões permanentes e temporárias em educação, segurança, saúde, política e cidadania.
5. Representar os membros junto a instituições, órgãos de governo e imprensa.
6. Ser voz profética nas grandes questões municipais, estaduais e nacionais.
7. Promover encontros, seminários e conferências.
8. Apoiar e treinar os membros nas suas atribuições ministeriais.

### 13.3 Associados (Cap. II)

- **Quem pode** (Art. 7º): pastores e líderes evangélicos que pedem livremente, por formulário assinado por eles e por um diretor, com **título reconhecido pela sua denominação**.
- **Como entra** (Art. 7º, a): os já cadastrados na data do estatuto são associados. Os novos são apresentados formalmente à Diretoria e **aprovados pela Assembleia Ordinária**.
- **Igreja** (§1º): reconhecidamente evangélica e que declare estes princípios:
  - Deus em três pessoas (Pai, Filho e Espírito Santo);
  - salvação somente em Jesus Cristo;
  - a Bíblia como revelação infalível de Deus;
  - a Igreja universal como comunidade dos santos.
- **Compromissos** (§3º e Art. 10):
  - participar das reuniões mensais e das convocadas;
  - pagar a taxa de inscrição e a contribuição (mensal ou anual, à escolha do associado — seção 4.4);
  - cumprir o estatuto e o regimento interno;
  - zelar pela unidade do corpo de Cristo;
  - levar à diretoria fatos de interesse do Conselho.
- **Direitos** (Art. 9º):
  - participar das reuniões e assembleias;
  - votar e ser votado para o Conselho Diretor, o Conselho Fiscal e cargos de representação;
  - participar de comissões, quando indicado;
  - representar a presidência, quando designado.
- **Voto** (Art. 11): só quem está em dia com os compromissos. Associados não respondem pelas obrigações do COMEP.
- **Desligamento** (Art. 8º): nos cinco casos da seção 4.2. A decisão é tomada por **3/5** em Assembleia Ordinária.

### 13.4 Administração (Cap. III)

- **Conselho Diretor** (Art. 12): presidente, vice-presidente, 1º e 2º secretários, 1º e 2º tesoureiros e secretário executivo. Os cargos são voluntários e sem salário. O mandato é de **4 anos**, com reeleição permitida.
- **Conselho Fiscal**: 3 membros (Art. 12) ou 5, eleitos a cada 2 anos (Art. 14). A diretoria esclareceu em 11/11/2026: **3 membros, mandato de 4 anos**, com as mesmas datas do Conselho Diretor. Examina as contas e dá parecer anual à Assembleia Geral.
- **Atribuições que viram regra no sistema:**
  - **presidente:** convoca e preside as assembleias; representa o COMEP; assina as atas com o secretário; movimenta contas com os tesoureiros; **autoriza compras e pagamentos**;
  - **vice-presidente:** substitui o presidente;
  - **1º secretário:** redige e assina as atas;
  - **2º secretário:** cuida da correspondência e da comunicação e substitui o 1º;
  - **1º tesoureiro:** contas bancárias com o presidente e **balanço anual**;
  - **2º tesoureiro:** auxilia e substitui o 1º;
  - **secretário executivo:** apoia a presidência, a diretoria e o Conselho Fiscal.
- **Regimento Interno**: elaborado pela diretoria e aprovado em assembleia (Art. 12, §1º, III e Art. 13).
- Diretores não podem dar aval ou fiança em nome do COMEP fora dos interesses da entidade (Art. 12, §9º).

### 13.5 Assembleias (Cap. IV)

- A **Assembleia Geral** é o órgão máximo (Art. 16).
- Reuniões ordinárias a cada seis meses (Art. 15), na 2ª quinzena de **abril e outubro** (Art. 16, §6º). Extraordinárias quando necessário.
- **A Assembleia Geral delibera sobre** (Art. 15):
  - balanços, relatórios financeiros, orçamento e plano anual;
  - Conselho Fiscal;
  - reforma do estatuto;
  - extinção e destino do patrimônio;
  - casos omissos.
- **Convocação:** pelo presidente, com **30 dias** de antecedência, por carta, e-mail, jornal, **site do COMEP** ou outro meio usado pelos membros (Art. 16, §2º).
- **Assembleia extraordinária:** por pedido de 3/5 dos associados ou da maioria simples do Conselho Diretor, com a pauta (Art. 16, §3º).
- **Quórum:** metade mais um na 1ª convocação; qualquer número após 60 minutos (Art. 16, §4º).
- **Registros:** presença em livro ou controle similar (Art. 16, §1º); decisões no livro de atas (Art. 16, §5º).

### 13.6 Receitas e patrimônio (Cap. V)

- Receitas: ofertas, contribuições e doações dos membros ou participantes, e outros proventos (Art. 17).
- Patrimônio: aquisições, doações, legados e bens registrados em nome do COMEP; os associados não participam dele (Art. 18).

### 13.7 Disposições gerais (Cap. VI)

- Reforma do estatuto por **2/3** dos membros da Assembleia Geral convocada para isso (Art. 21).
- Casos omissos resolvidos em assembleia (Art. 23).

### 13.8 Lacunas e divergências encontradas

1. Falta o **§2º do Art. 7º** (o texto pula do §1º para o §3º).
2. Faltam os **Artigos 19 e 20** (o Capítulo V cita "Dissolução" no título, mas não há artigo sobre isso na cópia) — a cópia pode estar sem uma página.
3. **Taxa anual** (Art. 7º, §3º) × **mensalidade** (Art. 10, V). *Resolvido pela diretoria (11/11/2026): o associado escolhe entre mensal e anual.*
4. **Conselho Fiscal** com 3 membros (Art. 12) × 5 membros eleitos a cada 2 anos (Art. 14), "coincidindo com o mandato da diretoria", que é de 4 anos. *Resolvido pela diretoria (11/11/2026): 3 membros, 4 anos.*
5. O Art. 15 diz "a cada 06 (seis)" sem a unidade; entende-se **meses**, o que bate com abril e outubro.
6. O Art. 8º, IV fala em "assembleias mensais"; o Art. 7º, §3º fala em "reuniões mensais". Entende-se que são as **reuniões mensais**, que, segundo a diretoria, não têm efeito de AGO nem de AGE (pergunta 22).
7. O mandato de 4 anos da diretoria que assinou em maio de 2021 terminou em 2025 — confirmar a diretoria atual (decisão 10).

## 14. Processo de entrega e travas de revisão

Criar não basta: cada fase precisa ser **testada, corrigida e aprovada no ambiente de teste** antes de ir para produção. Nenhuma fase pula uma trava.

### 14.1 As 4 travas

| Trava | O que é | Quem faz | Evidência |
|---|---|---|---|
| **1. Verificação automática** | Lint, testes das regras do banco (RLS, nada se apaga, auditoria) e build rodam em todo pull request. O GitHub **bloqueia** a aprovação se algo falhar | Automático (GitHub Actions) | Verificação verde no pull request |
| **2. Revisão técnica no banco de teste** | Migração aplicada **primeiro** no `comep-teste`; conferência das tabelas, regras e gatilhos; verificador de segurança do Supabase sem alertas; teste de fora como visitante sem login | Claude Code + administrador técnico | Resultado registrado no arquivo de revisão da fase |
| **3. Teste de uso no ambiente de teste** | **Testes de ponta a ponta automáticos**: um navegador de verdade usa o app ligado ao banco de teste, com usuários **fictícios** de cada perfil, em tamanho de computador e de celular. Rodam em todo pull request, e o GitHub bloqueia a aprovação se falharem. Cada fase acrescenta os testes das suas telas. Junto vem a conferência visual (fotos das telas). Problema encontrado → corrige → testa de novo | Claude Code (não precisa de roteiro manual — decisão de 11/11/2026) | Testes verdes no pull request e lista de problemas em `docs/revisoes/fase-N.md` |
| **4. Aceite e lançamento** | Aceite registrado; a mesma migração aplicada no `comep-producao`; publicação; conferência rápida em produção (entrar, ver o menu, abrir uma tela de cada perfil) | Administrador técnico + presidência (aceite das regras do estatuto) | Aceite com data no arquivo de revisão e a versão marcada no GitHub (ex.: `v1.0`) |

### 14.2 Gravidade dos problemas encontrados

- **Bloqueante**: dado errado, falha de segurança, perda de dado ou regra do estatuto descumprida. **Impede o lançamento.**
- **Importante**: atrapalha o uso. Corrigir antes de lançar, salvo decisão registrada no arquivo de revisão.
- **Menor**: visual ou conforto. Pode ir para a próxima versão, desde que registrado.

### 14.3 Regras de segurança da entrega

- O banco de produção só recebe migração que **já passou pela trava 3** no banco de teste.
- Migrações só acrescentam; não se apagam colunas ou tabelas com dados.
- **Voltar atrás**: se a produção der problema, republica-se a versão anterior do app. O banco não precisa voltar, porque as migrações só acrescentam.
- **Versões**:
  - enquanto a fase está em teste, as entregas são `N.0-teste.1`, `N.0-teste.2`…;
  - quando entra em produção, vira `N.0`;
  - correções depois disso: `N.1`, `N.2`…
- **Ambientes:**
  - **hoje** só existe o de teste: o site `ieadespa.github.io/comep/` está ligado ao `comep-teste` e mostra a faixa amarela;
  - **desde 12/11/2026** o ambiente de teste tem endereço próprio, `ieadespa.github.io/comep/teste/`, sempre no `comep-teste` e com a faixa; os dois saem da mesma publicação;
  - **no lançamento da versão 1.0**, o site oficial (`/comep/`) passa a usar o `comep-producao` (`docs/lancamento.md`).
- Cada pull request traz a lista das travas para marcar (`.github/pull_request_template.md`), e cada fase tem seu arquivo de revisão em `docs/revisoes/`.

### 14.4 Revisão geral de cada fase

Além das travas de cada entrega, toda fase termina com uma **revisão geral independente**: revisores que não escreveram o código procuram problemas de segurança, de dados e de regras do estatuto em tudo o que a fase fez. Cada achado ganha um teste automático, que falha antes da correção e passa depois.

| Fase | Data | Resultado | Onde está |
|---|---|---|---|
| 1 — Cadastros e acessos | 12/11/2026 (entrega 1.4) | 10 correções de segurança, 3 riscos aceitos e registrados | `docs/revisoes/fase-1.md` |
| 2 — Financeiro | 13/11/2026 | 10 problemas bloqueantes e 12 importantes corrigidos; 13 testes de regressão no banco, 17 de unidade e 1 de ponta a ponta | `docs/revisoes/fase-2.md`, seção "Revisão geral da Fase 2" |
| 3 — Credencial | 13/11/2026 | 3 problemas bloqueantes, 5 importantes e 6 menores, mais 13 pequenos ajustes; 12 testes de regressão no banco, 3 de unidade e 2 de ponta a ponta | `docs/revisoes/fase-3.md`, seção "Revisão geral da Fase 3" |
| 5 — Igrejas, comissões, eventos e comunicação | 14/11/2026 | 1 problema bloqueante, 7 importantes e 14 menores; 2 pendências para antes do link público (captcha e prazo de guarda das inscrições); 8 testes de regressão no banco | `docs/revisoes/fase-5.md`, seção "Revisão geral da Fase 5" |
| 4 — Assembleias e diretoria | 14/11/2026 | 9 problemas bloqueantes, 9 importantes e 5 menores, mais 17 pequenos ajustes; 1 risco aceito (assinatura pelo perfil, a rever no lançamento); 20 testes de regressão no banco, 3 de unidade e 4 de ponta a ponta | `docs/revisoes/fase-4.md`, seção "Revisão geral da Fase 4" |
