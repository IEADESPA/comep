# PROJETO — Sistema de Gestão do Conselho de Ministros Evangélicos de Parauapebas

> Documento-base do sistema. Serve para a diretoria aprovar o escopo e para orientar o desenvolvimento no VS Code (com Claude Code).
> Versão 0.1 — novembro de 2026 — rascunho para discussão.

---

## 1. Objetivo

Organizar a gestão do Conselho em um único sistema gratuito, instalável no notebook e no celular Android, cobrindo:

- cadastro de **ministros** (membros inscritos no Conselho) e de **igrejas**;
- **mensalidades**, taxa de inscrição, entradas, saídas e prestação de contas;
- **carteirinha digital** com foto;
- **assembleias** (convocação, presença, ata);
- **projetos** do Conselho;
- um **portão de entrada** para novos ministros pedirem inscrição.

## 2. Princípios (não negociáveis)

1. **Custo zero** na fase atual: nada de domínio, servidor ou plano pago.
2. **Ninguém fica refém**: contas, código e dados pertencem ao Conselho, nunca a uma pessoa.
3. **Nada se apaga de verdade**: registros são *arquivados*; toda alteração fica registrada (quem, quando, o quê).
4. **Cada um vê só o que lhe cabe**: o banco de dados bloqueia o acesso, não só a tela.
5. **LGPD**: coletar só o necessário, pedir consentimento no cadastro e permitir que o ministro veja e corrija os próprios dados.
6. **Portabilidade**: o sistema deve poder migrar no futuro para outro servidor sem refazer as telas.

## 3. Quem usa o sistema (perfis)

| Perfil | Quem é | O que pode fazer |
|---|---|---|
| **Visitante** | Qualquer pessoa | Pedir inscrição; validar uma carteirinha pelo QR Code |
| **Ministro** | Membro inscrito no Conselho | Ver/atualizar o próprio perfil e foto; ver a carteirinha; ver mensalidades; informar pagamento com comprovante; pedir troca de igreja; confirmar presença em assembleia |
| **Presidente de igreja** | Pastor presidente de uma igreja cadastrada | Tudo do ministro + ver e gerenciar os ministros vinculados à sua igreja; atualizar dados da igreja; aprovar vínculos/transferências para sua igreja; ver a situação financeira (em dia/atrasado) dos seus ministros |
| **Secretaria** | Secretário(a) do Conselho | Aprovar inscrições; gerenciar cadastros de ministros e igrejas; convocar assembleias; registrar presença e atas |
| **Tesouraria** | Tesoureiro(a) do Conselho | Conferir/confirmar pagamentos; lançar entradas e saídas; gerar relatórios e prestação de contas |
| **Presidência** | Presidente e vice do Conselho | Visualizar tudo; aprovar decisões; gerenciar perfis de acesso |
| **Administrador técnico** | 1–2 pessoas de confiança | Configurações, backups e manutenção (sem poder apagar histórico) |

> Uma pessoa pode ter mais de um perfil (ex.: um presidente de igreja que também é tesoureiro do Conselho).

## 4. Módulos

### 4.1 Portão de entrada (inscrição)
- Formulário público de pedido de inscrição: dados pessoais, cargo ministerial, igreja, foto e documentos.
- Aceite do termo de consentimento (LGPD) e do estatuto/regimento do Conselho.
- Fluxo: **pedido → análise da secretaria (e, se definido, do presidente da igreja) → aprovação → cobrança da taxa de inscrição → ministro ativo**.
- Login com e-mail e senha, ou com conta Google.

### 4.2 Ministros (perfil do membro)
- Dados pessoais, contato, cargo ministerial (pastor, evangelista, presbítero etc.), data de consagração, igreja atual.
- Foto (comprimida automaticamente no celular antes do envio).
- Documentos anexos (credencial, certificado, RG/CPF digitalizado — quando a diretoria exigir).
- Situação: **pendente, ativo, em atraso, suspenso, desligado, falecido** (nunca apagado).
- Histórico de igrejas e de cargos.
- Pedido de troca de igreja com aprovação.

### 4.3 Igrejas
- Cadastro: nome, CNPJ, denominação, endereço, contatos, presidente.
- Perfil da igreja com a lista de ministros vinculados.
- Painel do presidente da igreja: ministros, situação de mensalidades, pedidos pendentes.

### 4.4 Financeiro
- **Mensalidades** geradas automaticamente todo mês para cada ministro ativo (valor configurável; isenções possíveis).
- **Taxa de inscrição** (entrada).
- **Informar pagamento**: o ministro anexa o comprovante (PIX/depósito); a tesouraria confere e confirma.
- Situação automática **em dia / em atraso**, com lista de inadimplentes.
- **Contas** (caixa, conta bancária) e **lançamentos** de entradas e saídas com comprovante e categoria.
- Relatórios: mensal, anual, por categoria, por igreja; **prestação de contas para a assembleia**; exportação em PDF e planilha (CSV).
- Sem gateway de pagamento nesta fase (evita taxas). PIX automático fica para o futuro.

### 4.5 Carteirinha digital
- Frente/verso com foto, nome, cargo, igreja, nº de registro, validade e situação.
- **QR Code** que abre uma página pública de validação mostrando **apenas** nome, foto, cargo e se está ativo/em dia — nenhum dado sensível.
- Download em PDF/imagem para impressão.

### 4.6 Assembleias
- Convocação: tipo (ordinária/extraordinária), data, local, pauta, edital em anexo.
- Aviso aos ministros pelo app e por link de WhatsApp.
- Confirmação de presença pelo ministro.
- **Check-in** no dia pela leitura do QR Code da carteirinha.
- Cálculo de quórum (regra conforme estatuto — ver decisões pendentes).
- Registro de deliberações e anexo da ata assinada.
- Histórico de assembleias.

### 4.7 Projetos
- Cadastro de projetos/eventos do Conselho: responsável, período, orçamento, situação.
- Lançamentos financeiros vinculados ao projeto.

### 4.8 Comunicação
- Mural de avisos (geral, por igreja ou por perfil).
- Botão de envio por WhatsApp (link gratuito, sem API paga).

### 4.9 Auditoria e segurança
- Registro automático de toda criação/alteração/arquivamento.
- Tela de auditoria para presidência e administrador técnico.

## 5. Arquitetura (100% gratuita)

| Camada | Tecnologia | Observação |
|---|---|---|
| Aplicativo | **React + Vite + TypeScript**, como **PWA** | Instala pelo navegador no notebook e no Android; funciona com internet instável |
| Hospedagem do app | **GitHub Pages** | Provisoriamente na organização **IEADESPA** (plano Team), que permite publicar a partir de repositório privado — ver regra abaixo |
| Endereço | `ieadespa.github.io/comep/` (provisório) | Domínio próprio `.com.br` fica para quando o Conselho regularizar o CNPJ e registrar no nome dele |
| Banco de dados | **Supabase** (PostgreSQL) — plano Free | Banco relacional de verdade |
| Login | **Supabase Auth** | E-mail/senha e Google |
| Fotos e arquivos | **Supabase Storage** | Pastas privadas; links temporários |
| E-mails de login | **SMTP do Gmail institucional** (senha de app) | Obrigatório — ver seção 10. Sem serviço extra |
| Código-fonte | **GitHub** — repositório `IEADESPA/comep` (privado) | Provisório até a transferência ao Conselho (seção 8); 2–3 donos |
| Backups | Repositório `IEADESPA/comep-backups` **privado** | Só arquivos criptografados |
| Automação | **GitHub Actions** | Testes das regras do banco antes de publicar, publicação do app, backup semanal criptografado e aviso anti-pausa |
| APK (futuro) | Empacotar o PWA (TWA/Capacitor) | Instalação direta, sem Play Store |

**Serviços usados: apenas GitHub + Supabase** (mais o Gmail institucional, que já existe).

**Regra do repositório:** hoje o repositório `comep` é privado (o plano Team da IEADESPA permite). Se um dia precisar ficar público (ex.: organização do Conselho no plano gratuito), isso não reduz a segurança: o código das telas é baixado pelo navegador de qualquer usuário, e a proteção está nas regras RLS do banco. No repositório **nunca** entram dados, senhas ou a chave secreta (`service_role`/`sb_secret_`) do Supabase — só a chave pública (`publishable`), feita para ser pública.

**Regra de portabilidade:** todo acesso ao banco fica concentrado em `src/dados/`. As telas nunca falam direto com o Supabase. Numa migração futura, só essa pasta muda.

## 6. Modelo de dados (tabelas principais)

- `pessoas` — dados pessoais do ministro (ligado ao login)
- `igrejas`
- `vinculos_igreja` — histórico de ministro ↔ igreja (com data de início/fim)
- `cargos_ministeriais` e `historico_cargos`
- `perfis_acesso` — quais perfis cada pessoa tem (ministro, presidente de igreja, secretaria…)
- `inscricoes` — pedidos do portão de entrada e seu andamento
- `documentos` — anexos (referência ao arquivo no Storage)
- `mensalidades` — uma por ministro por mês (valor, vencimento, situação)
- `pagamentos_informados` — comprovantes enviados e conferência da tesouraria
- `contas` — caixa, banco
- `lancamentos` — entradas e saídas (categoria, conta, projeto, comprovante)
- `projetos`
- `assembleias`, `assembleia_presencas`, `assembleia_deliberacoes`
- `avisos`
- `auditoria` — preenchida automaticamente por gatilhos do banco

Todas as tabelas: coluna `arquivado_em` (em vez de apagar), `criado_por`, `criado_em`, `atualizado_em`.
Segurança por **RLS (Row Level Security)**: as regras de "quem vê o quê" ficam no próprio banco.

## 7. Governança anti-refém e backup

1. **Contas da associação mantenedora (IEADESPA)** como donas do GitHub e do Supabase nesta fase — decisão de 11/11/2026, porque o Conselho ainda não tem e-mail institucional. Quando tiver, tudo passa para as contas dele (seção 8).
2. **Verificação em duas etapas** ligada; códigos de recuperação impressos e guardados em envelope lacrado, com registro em ata de quem os guarda.
3. **2 a 3 donos** em cada serviço (presidência, secretaria, tesouraria). Nunca um dono só.
4. **Backup semanal automático**: o GitHub Actions exporta o banco e os arquivos, **criptografa** e salva num repositório privado separado (`backups`). A chave de descriptografia fica só com a diretoria — nunca dentro do app ou do repositório.
5. **Teste de restauração** a cada 3 meses (restaurar o backup num projeto de teste e conferir).
6. Ninguém tem botão de "apagar"; só arquivar.
7. Troca de diretoria: checklist de transferência de acessos registrado em ata.

## 8. Hospedagem provisória e transferência ao Conselho

Enquanto o Conselho não tiver CNPJ regularizado e estrutura própria, **todas as contas ficam em nome da associação mantenedora** (a organização da qual a equipe de desenvolvimento faz parte). Nada é criado em nome do Conselho ou de terceiros.

**Situação atual (11/11/2026):** GitHub — repositórios `IEADESPA/comep` e `IEADESPA/comep-backups` (privados) na organização da IEADESPA. Supabase — organização da IEADESPA (plano Free), projetos `comep-producao` e `comep-teste`, ambos na região **São Paulo (sa-east-1)**: os dados ficam no Brasil. A tela do Supabase só oferece o continente; a região exata foi escolhida pelo Supabase CLI.

**Antes de cadastrar dados reais**, formalizar por escrito (ofício ou termo simples, assinado pela presidência do Conselho e pela associação):
- que o Conselho solicitou o sistema;
- que os dados pertencem ao Conselho (controlador, na LGPD) e que a associação apenas os hospeda provisoriamente (operadora);
- compromisso de sigilo e de não usar os dados para outro fim;
- compromisso de transferência de tudo quando o Conselho estiver apto, sem custo;
- que o código é cedido ao Conselho.

**Transferência (quando o Conselho estiver pronto):**
1. Conselho cria seu e-mail institucional e sua organização no GitHub e no Supabase.
2. GitHub: transferir os repositórios `comep` e `comep-backups` para a organização do Conselho (o histórico vai junto). O endereço do app muda: deixar em `ieadespa.github.io/comep` uma página que redireciona para o novo endereço, para não quebrar os QR Codes das carteirinhas já impressas.
3. Supabase: transferir o projeto para a organização do Conselho. Plano B: restaurar o último backup num projeto novo do Conselho.
4. Entregar a chave de descriptografia dos backups e trocar todas as senhas e segredos.
5. Conselho registra o domínio no próprio CNPJ, se quiser.
6. Assinar termo de entrega; a associação sai como administradora.

## 9. Fases de entrega

### Fase 0 — Fundação
- [ ] Assinar o termo de solicitação/hospedagem provisória (seção 8)
- [x] Usar as contas da IEADESPA (decisão de 11/11/2026, seção 7) — [ ] conferir verificação em duas etapas
- [x] Repositórios `IEADESPA/comep` e `IEADESPA/comep-backups` (privados) — [ ] incluir 2º dono na organização
- [x] Projetos `comep-producao` e `comep-teste` no Supabase — [ ] configurar o SMTP do e-mail de envio
- [ ] Ativar GitHub Pages no repositório `comep` (publicação automática via GitHub Actions)
- [x] Esqueleto do app (PWA instalável, login, menu por perfil)
- [x] Estrutura inicial do banco (pessoas, perfis de acesso, auditoria) com testes automáticos das regras
- [ ] Backup semanal criptografado + aviso anti-pausa funcionando

### Fase 1 — Portão de entrada, ministros e igrejas
- [ ] Formulário de inscrição com foto, documentos e consentimento LGPD
- [ ] Aprovação de inscrições pela secretaria
- [ ] Perfil do ministro (ver/editar, foto, histórico)
- [ ] Cadastro e perfil de igrejas; painel do presidente de igreja
- [ ] Troca de igreja com aprovação
- [ ] Auditoria automática

### Fase 2 — Financeiro
- [ ] Geração automática de mensalidades e taxa de inscrição
- [ ] Informar pagamento com comprovante; conferência pela tesouraria
- [ ] Situação em dia/atrasado; lista de inadimplentes
- [ ] Contas, lançamentos de entrada/saída, categorias
- [ ] Relatórios e prestação de contas (PDF/CSV)

### Fase 3 — Carteirinha digital
- [ ] Carteirinha com foto e QR Code
- [ ] Página pública de validação
- [ ] Download para impressão

### Fase 4 — Assembleias
- [ ] Convocação, pauta e edital
- [ ] Confirmação de presença e check-in por QR Code
- [ ] Quórum, deliberações e ata

### Fase 5 — Projetos e comunicação
- [ ] Projetos com orçamento e lançamentos vinculados
- [ ] Mural de avisos e envio por WhatsApp
- [ ] Painel geral da presidência (indicadores)

### Fase 6 — Melhorias futuras
- [ ] APK para Android
- [ ] Notificações no celular
- [ ] Votação online em assembleia (se o estatuto permitir)
- [ ] PIX automático / conciliação bancária
- [ ] Avaliar migração para servidor próprio ou plano pago, se o Conselho crescer

## 10. Limites do plano gratuito e "pegadinhas" (com a solução de cada uma)

| Ponto de atenção | O que acontece | Como resolvemos |
|---|---|---|
| **Pausa por inatividade** | Projeto gratuito pausa após 7 dias sem acesso ao banco (os dados **não** são apagados) | GitHub Actions acessa o banco a cada 3 dias |
| **Sem backup automático no plano Free** | O Supabase não guarda cópias para nós | Backup semanal próprio, criptografado, no GitHub |
| **E-mail de login padrão** | Só envia para a equipe do projeto e com limite de poucos e-mails por hora | Configurar o SMTP do Gmail institucional desde a Fase 0 |
| **Código das telas é visível** | Mesmo com repositório privado, o navegador baixa o código das telas | Nenhum segredo ou dado no repositório; segurança garantida pelo banco (RLS) |
| **Limites de espaço** | 500 MB de banco, 1 GB de arquivos, 5 GB de tráfego/mês | Comprimir fotos (~100 KB); PDFs pequenos; acompanhar o painel de uso |
| **Usuários** | 50.000 usuários **diferentes** por mês | Muito acima do necessário |
| **Só 2 projetos gratuitos** | Limite de projetos ativos por conta | 1 produção + 1 teste |
| **Regras de segurança mal feitas** | Risco de um membro ver dados de outro | Testes automáticos das regras RLS antes de cada publicação |
| **Mudança de regras da empresa** | O fornecedor pode mudar o plano gratuito | Backup próprio + banco PostgreSQL padrão = dá para migrar |

## 11. Decisões pendentes (para a diretoria)

1. Valor da mensalidade e da taxa de inscrição; regras de isenção (ex.: jubilados).
2. Quantos meses de atraso para "em atraso" e para "suspenso".
3. Quem aprova a inscrição: só a secretaria ou também o presidente da igreja?
4. Quais documentos são obrigatórios na inscrição.
5. Lista oficial de cargos ministeriais.
6. Regras de quórum e de direito a voto (ex.: só ministros em dia?), conforme o estatuto.
7. Validade da carteirinha (anual?) e o que aparece nela.
8. Quem serão os 2–3 donos das contas (na associação) e quem guarda os códigos de recuperação; quem assina o termo pelo Conselho.
9. Nome oficial do sistema e identidade visual (logo, cores).

## 12. Convenções de desenvolvimento

- Idioma do código, das tabelas e da interface: **português**.
- Cada fase em um *branch* próprio; publicação só após revisão.
- Segredos (chaves, senhas) **nunca** no repositório — só nos *Secrets* do GitHub Actions.
- Dados de teste fictícios; nunca usar dados reais de ministros em testes.
- Este arquivo (`PROJETO.md`) é atualizado a cada decisão da diretoria.
