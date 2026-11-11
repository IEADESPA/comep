# PROJETO — Sistema de Gestão do Conselho de Ministros Evangélicos de Parauapebas (COMEP)

> Documento-base do sistema. Serve para a diretoria aprovar o escopo e para orientar o desenvolvimento no VS Code (com Claude Code).
> Versão 0.6 — 11 de novembro de 2026 — atualizado com o **Estatuto do COMEP** (25/05/2021), a **tela de Configurações** (sistema personalizável), a previsão do perfil presidente de igreja, as **primeiras respostas da diretoria** (contribuição, exercício, Conselho Fiscal, quórum, reuniões mensais e carteirinha), as cores do COMEP, a decisão de não enviar e-mails, o login só com e-mail e senha, a Fase 0 concluída e a Fase 1 dividida em entregas. Rascunho para discussão.
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
| **Presidente de igreja** | Pastor presidente de uma igreja cadastrada, marcado na ficha do ministro: o perfil vem **automaticamente** e define a categoria de contribuição de R$ 40 (seção 4.4). **Não previsto no estatuto** (decisão 12 — previsão de 11/11/2026: mantido) | Tudo do ministro + ver os ministros vinculados à sua igreja e se estão em dia; atualizar dados da igreja; confirmar vínculos com a sua igreja |
| **Secretaria** | 1º e 2º secretários (Art. 12, §4º e §5º) | Receber os pedidos de associação e levá-los à assembleia; cadastros de ministros e igrejas; preparar convocações; registrar presença; aceitar ou recusar justificativas de falta (1º secretário); redigir atas (1º secretário); comunicação e avisos (2º secretário) |
| **Tesouraria** | 1º e 2º tesoureiros (Art. 12, §6º e §7º) | Conferir/confirmar pagamentos; lançar entradas e saídas; preparar o balanço anual e os relatórios |
| **Presidência** | Presidente e vice-presidente (Art. 12, §2º e §3º) | Visualizar tudo; convocar assembleias; **autorizar despesas** (Art. 12, §2º, VI); assinar atas com o 1º secretário; gerenciar perfis de acesso |
| **Secretário Executivo** | Art. 12, §8º | Apoiar a presidência, a diretoria e o Conselho Fiscal: ver cadastros, financeiro e assembleias, sem aprovar nada |
| **Conselho Fiscal** | Membros eleitos (Art. 12 e 14) | Ver todo o financeiro (só leitura) e registrar o **parecer anual sobre as contas** (Art. 14) |
| **Administrador técnico** | 1–2 pessoas de confiança (da IEADESPA nesta fase) | Configurações, backups e manutenção (sem poder apagar histórico) |

> Uma pessoa pode ter mais de um perfil (ex.: um presidente de igreja que também é tesoureiro do Conselho).
> A partir da Fase 4, os perfis da diretoria e do Conselho Fiscal passam a vir do **cargo e do mandato** registrados no sistema. Quando o mandato termina, o acesso termina sozinho.

## 4. Módulos

### 4.1 Site institucional e portão de entrada (associação)

- **Página inicial pública:** quem é o COMEP, finalidades (Art. 3º), quem pode se associar (Art. 7º), assembleias e convocações, sede e contatos. Botões **"Portal do membro"** e **"Quero me associar"**.
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

- Dados pessoais, contato, título ministerial (pastor, evangelista, presbítero etc. — lista na decisão 9), data de consagração, igreja e denominação.
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
- Painel do presidente da igreja, se a diretoria mantiver esse perfil (decisão 12).

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
- **Taxa de inscrição:** valor a definir (pergunta 17).
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
- Relatórios: mensal, anual, por categoria, por igreja; exportação em PDF e planilha (CSV).
- Sem gateway de pagamento nesta fase (evita taxas). PIX automático fica para o futuro.

### 4.5 Carteirinha digital

- Frente/verso com foto, nome, título, igreja, nº de registro, validade e situação (o conteúdo final depende da pergunta 8).
- **Validade de 4 anos, acompanhando o pleito** (diretoria, 11/11/2026): a carteirinha vence junto com o mandato da diretoria (pergunta 21).
- **QR Code** que abre uma página pública de validação mostrando **apenas** nome, foto, título e se está ativo/em dia — nenhum dado sensível.
- Download em PDF/imagem para impressão.

### 4.6 Assembleias e reuniões

- **Três tipos de encontro:**
  - Assembleia Geral Ordinária: na **2ª quinzena de abril e de outubro** (Art. 16, §6º);
  - Assembleia Geral Extraordinária: quando necessário (Art. 15);
  - **reunião mensal** (Art. 7º, §3º): **não tem efeito de AGO nem de AGE** (diretoria, 11/11/2026). Nela não se vota o que é da assembleia; o sistema registra a presença e as faltas.
- **Convocação:**
  - feita pelo presidente com **no mínimo 30 dias de antecedência**; o sistema não deixa marcar com menos;
  - publicada no site e avisada por e-mail/WhatsApp (Art. 16, §2º).
- **Pedido de Assembleia Extraordinária:** por **3/5 dos associados** ou pela maioria simples do Conselho Diretor, sempre com a pauta (Art. 16, §3º).
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

### 4.7 Projetos e comissões

- **Comissões permanentes e temporárias** (educação, segurança, saúde, política, cidadania — Art. 3º, IV), com membros indicados pela diretoria (Art. 9º, III).
- **Projetos e eventos** (encontros, seminários, conferências — Art. 3º, VII): responsável, período, orçamento, situação; lançamentos financeiros vinculados.

### 4.8 Comunicação

- Mural de avisos (geral, por igreja ou por perfil), administrado pela secretaria (Art. 12, §5º).
- Botão de envio por WhatsApp (link gratuito, sem API paga).

### 4.9 Auditoria e segurança

- Registro automático de toda criação/alteração/arquivamento.
- Tela de auditoria para presidência e administrador técnico.

### 4.10 Diretoria e Conselho Fiscal

- **Composição do Conselho Diretor** (Art. 12): presidente, vice-presidente, 1º e 2º secretários, 1º e 2º tesoureiros e secretário executivo.
- **Conselho Fiscal:** **3 membros**, mandato de **4 anos**, com as mesmas datas do Conselho Diretor (diretoria, 11/11/2026).
- **Mandato:** 4 anos, com reeleição permitida; cargos voluntários e sem salário (Art. 12).
- **Eleições:** registradas na assembleia; só candidatos e eleitores em dia (Art. 11).
- **Perfis automáticos:** os perfis de acesso da diretoria vêm do mandato vigente.
- Histórico de todas as diretorias.

### 4.11 Configurações (sistema personalizável)

Pedido de 11/11/2026: o que muda com o tempo não fica preso no código, e sim numa tela de **Configurações**:

- **Listas:** denominações (tipos de igreja), bairros e títulos de ministro. A secretaria, a presidência e o administrador técnico incluem, renomeiam e arquivam itens.
- **Valores da contribuição:** a tesouraria e a presidência lançam o valor novo, com a data em que passa a valer e a assembleia que aprovou. O valor anterior fica no histórico.
- Arquivar um item tira ele das opções, mas não apaga nada: o que já usava esse item continua guardado.
- Novas listas entram aqui conforme forem surgindo (ex.: tipos de projeto, motivos de desligamento).

### 4.12 Patrimônio (futuro)

- Registro de bens móveis e imóveis em nome do COMEP (Art. 18).

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
- `igrejas`, `denominacoes` e `bairros` ✅ criadas
- `valores_contribuicao` — valor por categoria e tipo (mensal, anual, inscrição), com vigência e assembleia ✅ criada
- `associados` — nº de registro, situação, forma e data de admissão ✅ criada
- `vinculos_igreja` — histórico de ministro ↔ igreja (com data de início/fim) ✅ criada
- `titulos_ministeriais` (lista) e `titulos_pessoa` (histórico de títulos de cada um) ✅ criadas
- `pedidos_associacao` — pedidos do formulário, análise da diretoria, assembleia que aprovou, aceites do associado e do diretor
- `desligamentos` — motivo (Art. 8º), assembleia e resultado da votação
- `documentos` — anexos (referência ao arquivo no Storage)
- `configuracoes_contribuicao` — valores e periodicidade, com data de vigência e assembleia que aprovou
- `contribuicoes` — cobranças de cada associado (inscrição e periódicas: valor, vencimento, situação)
- `pagamentos_informados` — comprovantes enviados e conferência da tesouraria
- `contas` — caixa, banco
- `lancamentos` — entradas e saídas (categoria do Art. 17, conta, projeto, comprovante, autorização do presidente)
- `balancos` — balanço anual: situação, análise da diretoria, parecer do Conselho Fiscal, assembleia que aprovou
- `orcamentos` — orçamento e plano anual de trabalho
- `encontros` — assembleias ordinárias, extraordinárias e reuniões mensais (tipo, data, convocação, pauta, edital)
- `encontro_presencas` — presença, check-in e justificativa de falta
- `deliberacoes` — pauta votada, maioria exigida (simples, 3/5, 2/3), votos e resultado
- `mandatos` — pessoa, cargo, órgão (Conselho Diretor ou Conselho Fiscal), início, fim, assembleia que elegeu
- `comissoes` e `comissao_membros`
- `projetos`
- `avisos`
- `patrimonio` (futuro)

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
   - os arquivos de fotos e documentos entram no backup quando existirem (Fase 1);
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

Cada fase só é considerada entregue depois de passar pelas **4 travas de revisão da seção 14**. A versão em produção recebe o número da fase: Fase 1 → versão 1.0, Fase 2 → versão 2.0, e assim por diante.

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

- o membro `presidente-ai` é o login do **presidente da igreja (IEADESPA)**, o 2º login da entidade: hoje ele é membro comum e precisa virar **dono** da organização no GitHub (e ligar a verificação em duas etapas);
- o termo da seção 8 passa a ser exigido no lançamento da versão 1.0, antes de entrar dado real.

### Fase 1 — Associação, ministros e igrejas (versão 1.0 — primeira versão em produção)

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
- [ ] Código de acesso: primeiro acesso dos associados atuais, sem e-mail (seção 4.1)
- [ ] Formulário "Quero me associar": título e comprovante, igreja, foto, declaração dos princípios de fé (Art. 7º, §1º) e consentimento LGPD
- [ ] Análise pela diretoria (aceite de um diretor na ficha) e registro da aprovação em Assembleia Ordinária (Art. 7º)

**1.3 — Portal do ministro** (versão 1.0-teste.3)

- [ ] Meu perfil (ver/editar, foto, histórico)
- [ ] Pedido de troca de igreja pelo próprio ministro, com aprovação da secretaria
- [ ] Senha esquecida com código gerado pela secretaria
- [ ] Painel do presidente de igreja: ministros da sua igreja (decisão 12 — previsão: mantido)

**1.4 — Lançamento** (versão 1.0)

- [ ] Revisão completa da Fase 1 e aceite da presidência (trava 4)
- [ ] Termo da seção 8 assinado
- [ ] Site oficial ligado ao banco de produção, ambiente de teste em endereço próprio, dados reais liberados

### Fase 2 — Financeiro (versão 2.0)

- [ ] Contribuição mensal ou anual por categoria (presidente de igreja, não presidente, jubilado isento), no exercício de abril a março, com valores aprovados em assembleia; taxa de inscrição (pergunta 17)
- [ ] Informar pagamento com comprovante; conferência pela tesouraria
- [ ] Em dia / em atraso (define o direito a voto — Art. 11); lista de inadimplentes
- [ ] Contas e lançamentos com as categorias do Art. 17; despesas autorizadas pelo presidente
- [ ] Balanço anual com análise da diretoria e parecer do Conselho Fiscal; orçamento e plano anual
- [ ] Relatórios e prestação de contas (PDF/CSV)

### Fase 3 — Carteirinha digital (versão 3.0)

- [ ] Carteirinha com foto e QR Code, válida até o fim do mandato da diretoria
- [ ] Página pública de validação
- [ ] Download para impressão

### Fase 4 — Assembleias, reuniões e diretoria (versão 4.0)

- [ ] Assembleias ordinárias e extraordinárias e reuniões mensais; convocação com 30 dias, pauta e edital publicados no site
- [ ] Presença, check-in por QR Code e justificativa de falta (aceita pelo 1º secretário); aviso de faltas seguidas (Art. 8º, IV)
- [ ] Quórum sobre os associados aptos (Art. 16, §4º), só votantes em dia (Art. 11) e maiorias exigidas (3/5, 2/3)
- [ ] Deliberações e ata assinada pelo presidente e pelo 1º secretário
- [ ] Desligamentos decididos em assembleia (Art. 8º)
- [ ] Diretoria e Conselho Fiscal: eleições, mandatos e perfis automáticos pelo cargo

### Fase 5 — Projetos, comissões e comunicação (versão 5.0)

- [ ] Comissões permanentes e temporárias
- [ ] Projetos e eventos com orçamento e lançamentos vinculados
- [ ] Mural de avisos e envio por WhatsApp
- [ ] Painel geral da presidência (indicadores)

### Fase 6 — Melhorias futuras

- [ ] APK para Android
- [ ] Notificações no celular
- [ ] Votação online em assembleia (o estatuto atual só fala em assembleia presencial com registro de presença — exigiria reforma do estatuto ou regimento)
- [ ] Pedido de assembleia extraordinária assinado on-line pelos associados (Art. 16, §3º)
- [ ] Patrimônio (Art. 18)
- [ ] PIX automático / conciliação bancária
- [ ] Avaliar migração para servidor próprio ou plano pago, se o Conselho crescer

## 10. Limites do plano gratuito e "pegadinhas" (com a solução de cada uma)

| Ponto de atenção | O que acontece | Como resolvemos |
|---|---|---|
| **Pausa por inatividade** | Projeto gratuito pausa após 7 dias sem acesso ao banco (os dados **não** são apagados) | GitHub Actions acessa o banco a cada 3 dias |
| **Sem backup automático no plano Free** | O Supabase não guarda cópias para nós | Backup semanal próprio, criptografado, no GitHub |
| **Sem envio de e-mail** | O Supabase gratuito só manda poucos e-mails por hora, e só para a equipe; não haverá serviço de e-mail | Confirmação por e-mail desligada; acesso só depois da aprovação em assembleia; primeiro acesso e senha esquecida com **código** gerado pela secretaria e enviado pelo WhatsApp |
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
| 1. Valores | **Presidente de igreja:** R$ 40,00 por mês ou R$ 400,00 por ano. **Não presidente:** R$ 20,00 por mês ou R$ 200,00 por ano. **Jubilado:** isento. O anual é pago em abril | Valores configuráveis, com histórico; categoria no cadastro do associado (seção 4.4). Falta o valor da taxa de inscrição (pergunta 17) |
| 2. Anual ou mensal? | Os dois: o associado paga por mês ou o ano inteiro em abril | Escolha do associado; detalhes na pergunta 18 |
| 3. Quando fica "em atraso"? | O exercício termina no último dia de março. Só vota e é votado quem está com a mensalidade em dia | Exercício de 1º de abril a 31 de março; "em dia" calculado pelos vencimentos (perguntas 18 e 19) |
| 4. Conselho Fiscal | 3 membros, mandato de 4 anos, com as mesmas datas do Conselho Diretor | Regra fixa no sistema |
| 6. Quórum | 1ª chamada: 50% + 1 dos associados aptos. 2ª chamada: com os presentes | Quórum calculado sobre os associados em dia na data da assembleia |
| 7. Reuniões mensais | Não têm efeito de AGO nem de AGE. A justificativa de falta vai ao 1º secretário | Reunião mensal registra presença e faltas, sem votações de assembleia; o 1º secretário aceita ou recusa a justificativa. Continua pendente: têm dia fixo? |
| 8. Carteirinha | Validade de 4 anos, correspondente ao pleito | Vence junto com o mandato da diretoria (pergunta 21). Continua pendente: o que aparece nela |

### 11.3 Ainda pendentes

**Levadas à diretoria em 11/11/2026, ainda sem resposta:**

5. **Desligamento:** todos os casos do Art. 8º passam por votação de 3/5 em assembleia, ou só conduta (II) e faltas (IV)? Pedido próprio, transferência e falecimento podem ser registrados direto pela secretaria e só comunicados à assembleia?
6. **Quórum:** a "metade mais um" conta todos os associados ativos ou só os em dia?
7. **Reuniões mensais:** têm dia fixo? *(quem aceita a justificativa já foi respondido: o 1º secretário)*
8. **Carteirinha:** o que aparece nela? *(validade já respondida: 4 anos, pelo pleito)*
9. **Títulos ministeriais aceitos** (pastor, evangelista, presbítero, missionário, líder…). O estatuto não fecha a lista: fala em "títulos reconhecidos por sua denominação". *Enquanto isso, o sistema usa esses cinco; a lista muda quando a diretoria responder.*
10. **Diretoria atual:** quem são hoje o Conselho Diretor e o Conselho Fiscal, e as datas dos mandatos. A diretoria que assinou o estatuto em maio de 2021 tinha mandato de 4 anos, que terminou em 2025.
11. **Regimento Interno:** existe um aprovado (Art. 10, I e Art. 13)? Se existir, enviar — pode responder várias perguntas acima.
12. **Perfil "presidente de igreja"** (ver os ministros da sua igreja e se estão em dia): não está no estatuto. A diretoria quer manter? *Previsão (11/11/2026): **mantido**, e é o mesmo critério da contribuição: o pastor presidente marcado na ficha recebe o perfil e paga como presidente de igreja. Muda se a diretoria disser o contrário.*
13. **Cópia completa do estatuto:** na cópia recebida faltam o §2º do Art. 7º e os Artigos 19 e 20 (provavelmente sobre dissolução, citada no título do Capítulo V).
14. **Dados para o site:** o COMEP tem CNPJ? Qual a sede atual (o estatuto fala em sede provisória)? Quais os contatos oficiais (telefone/WhatsApp, e-mail, redes sociais)?

**Dúvidas sobre as respostas de 11/11/2026:**

17. **Taxa de inscrição:** qual é o valor? O jubilado também é isento dela?
18. **Vencimentos:** a mensalidade vence em que dia do mês? O anual pode ser pago até que dia de abril? A escolha entre mensal e anual vale para o exercício inteiro? Quem entra no meio do exercício paga só os meses que faltam?
19. **Voto na assembleia de abril:** ela acontece na 2ª quinzena de abril, logo no começo do exercício novo. Para votar, basta estar em dia até março, ou também com abril (ou o anual) pago?
20. **Jubilado:** sendo isento, ele vota e pode ser votado normalmente? Quem define que o associado é jubilado?
21. **Validade da carteirinha:** quem se associa no meio do mandato recebe uma carteirinha que vence no fim desse mandato, e não 4 anos depois?
22. **Faltas:** a regra de desligamento por 3 faltas seguidas sem justificativa (Art. 8º, IV) vale para as reuniões mensais?

### 11.4 Internas (equipe técnica, sem levar à diretoria)

15. Donos das contas e quem guarda os códigos de recuperação — o 2º dono é o presidente da igreja (IEADESPA), pelo login `presidente-ai`: falta mudá-lo de membro para dono no GitHub e ligar a verificação em duas etapas.
16. Arquivo original do logo — pedir depois; as cores já estão aplicadas.

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
  - **no lançamento da versão 1.0**, o site oficial passa a usar o `comep-producao`, e o ambiente de teste ganha um endereço próprio, com a faixa.
- Cada pull request traz a lista das travas para marcar (`.github/pull_request_template.md`), e cada fase tem seu arquivo de revisão em `docs/revisoes/`.
