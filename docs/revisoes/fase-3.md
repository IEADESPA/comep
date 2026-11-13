# Revisão da Fase 3 — Credencial do associado (versão 3.0-teste)

> Calendário (PROJETO.md, seção 9): tudo no ambiente de teste, com dados fictícios, até a Fase 5.
> Cada entrega passa pelas travas 1 a 3. No fim da fase, há uma revisão geral independente (seção 14.4).
> Decisões sobre a credencial: PROJETO.md, seção 4.5 (12/11/2026).

## Entrega 3.1 — Dados da credencial (versão 3.0-teste.1)

**Resultado: aprovada no ambiente de teste em 13/11/2026.**

O que entrou:

- **CPF e filiação (pai e mãe)** no cadastro da pessoa. Eles vão na credencial, que é de um conselho municipal.
  - O CPF é conferido pelos dígitos verificadores, na tela e no banco, e não se repete entre duas pessoas.
  - **Quem preenche:**
    - o **candidato**, no pedido de associação: CPF e nome da mãe obrigatórios, nome do pai opcional;
    - o **associado**, em "Meu perfil": enquanto os campos estão vazios;
    - a **secretaria** (ou a presidência), na ficha do ministro, quando quiser.
  - **Depois de preenchidos, só a secretaria corrige.** O banco garante: assim ninguém muda o CPF da própria credencial. A tela mostra o campo travado e explica.
- **Sigla da igreja** (o nome curto que vai na credencial, com o CNPJ):
  - no cadastro da igreja (secretaria) e em "Minha igreja" (o pastor presidente);
  - não se repete entre igrejas;
  - o CNPJ continua só com a secretaria.
- **Pendências da credencial**, calculadas pelo banco para cada associado ativo:
  - sem foto, sem CPF, sem o nome da mãe, sem título, sem igreja, sem a função na igreja (o pastor presidente não precisa), igreja sem sigla, igreja sem CNPJ;
  - em "Meu perfil", o associado vê "Minha credencial": completa, ou o que falta, e quem resolve cada item;
  - na ficha do ministro, a secretaria vê as pendências;
  - na lista de ministros, cada associado com pendência tem a etiqueta "Credencial: N pendência(s)" e há o filtro "Só com pendência na credencial".
- **Privacidade (LGPD):** o CPF e a filiação seguem as regras do cadastro. Cada pessoa vê os seus dados, e a diretoria vê os de todos. O visitante não vê nada.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #20 — Fase 3.1: dados da credencial | Aprovado (verificar + ponta a ponta), publicado e conferido no site de teste (76 de 76) | 13/11/2026 |

### Trava 2

- [x] Migração `20261113100000_dados_credencial.sql`, aplicada no `comep-teste`.
- [x] Verificador do Supabase: só o aviso já conhecido (proteção contra senhas vazadas, que é do plano pago).
- [x] Teste de fora, como visitante sem login: "sem permissão" no CPF e nas pendências.
- [x] **7 testes novos do banco**:
  - pendências iniciais;
  - CPF com dígito errado recusado;
  - o ministro preenche e depois não muda mais, enquanto o pai, ainda vazio, ele preenche;
  - a secretaria corrige;
  - CPF repetido recusado;
  - o pastor presidente põe a sigla, mas não o CNPJ;
  - sigla repetida recusada;
  - as pendências diminuem conforme os dados chegam;
  - o ministro vê só as suas pendências, e a secretaria vê todas.
- [x] **Testes de unidade do CPF** (dígitos verificadores e formatação). São 231 testes do banco e de unidade no total.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| O associado novo vê "Minha credencial" com o que falta (sem CPF, sem o nome da mãe) | ✅ |
| CPF com dígito errado é recusado na tela | ✅ |
| Preenchidos o CPF e a mãe, as pendências somem e o CPF fica travado, com a explicação | ✅ |
| A presidência vê o CPF e a filiação na ficha, as pendências, e corrige o CPF | ✅ |
| A lista de ministros filtra quem tem pendência na credencial | ✅ |
| O candidato informa CPF e nome da mãe no pedido de associação | ✅ |
| A sigla da igreja é cadastrada e fica gravada | ✅ |

- **76 testes de ponta a ponta** passando no computador e no celular.

### Dados fictícios

`testes/dados/semente-credencial-teste.sql` roda depois de `semente-teste.sql`:

- **associados fictícios:** CPF com dígitos válidos e filiação. Alguns ficam sem CPF ou sem o nome da mãe, para a lista de pendências ter o que mostrar;
- **igrejas:** sigla pelas iniciais e **CNPJ alfanumérico fictício começando com "ZZ"**. É o formato novo da Receita, e com "ZZ" não pertence a nenhuma empresa. Algumas igrejas ficam sem sigla ou sem CNPJ.

No `comep-teste`, em 13/11/2026: 74 associados ativos, sendo 24 com a credencial completa e 50 com pendência. Os usuários dos testes automáticos não têm CPF.

## Entregas 3.2 e 3.3 — Credencial digital, validação pelo QR Code e impressão (versão 3.0-teste.2)

**Resultado: aprovadas no ambiente de teste em 13/11/2026.**

O que entrou:

- **Onde fica:**
  - **Credenciais** no menu da secretaria e da presidência: a lista de todos os associados ativos, com busca e o filtro completas ou com pendência. Ali se marcam várias para imprimir, e "Ver a credencial" abre a de cada um;
  - **Minha credencial** no menu do ministro;
  - um link "Ver a credencial" na ficha do ministro e no "Meu perfil".
- **A credencial** (frente e verso, no desenho de cartão CR80):
  - **frente:** cabeçalho do COMEP (logo, nome do Conselho e "Credencial de associado"), foto, nome, título e função, CPF, nº de registro, associado desde, a igreja pela sigla e o CNPJ da igreja;
  - **verso:** o QR Code ("aponte a câmera e confira a situação atual"), a filiação, o texto do verso (configurável), a linha de assinatura do presidente e o rodapé com o nome do Conselho e o nº;
  - **sem data de validade impressa.**
  - As cores são fixas (é um documento) e o desenho mantém as proporções em qualquer tamanho: celular, computador e papel.
- **Validação pública** (`/validar/<código>`, sem login, a página que o QR Code abre):
  - mostra só foto, nome, título, nº de registro, igreja (sigla) e a situação **de agora**:
    - **verde:** válida;
    - **amarelo:** válida, mas com a contribuição em atraso, e então inapto para votar (Art. 11);
    - **vermelho:** vencida (passou o fim do mandato), substituída, associado sem vínculo ativo ou código inexistente;
  - **nunca** mostra CPF nem filiação;
  - o código é aleatório, de 32 caracteres, e não dá para adivinhar.
- **Validade pelo mandato:** em Configurações → **Credencial** vão o "fim do mandato da diretoria em curso" e o texto do verso.
  - Na posse da nova diretoria, muda-se a data e todas as credenciais acompanham, **sem reimprimir** (decisão de 12/11/2026).
  - Em branco, a credencial vale enquanto o associado estiver ativo.
- **Perda ou roubo:** a secretaria emite uma nova credencial, com motivo. O QR antigo passa a dizer "substituída", e nada se apaga.
- **Foto na validação:**
  - a foto original continua na pasta privada;
  - para a página pública vai uma **cópia** numa pasta pública cujo nome é o código: só quem tem o QR acha, e não dá para listar a pasta;
  - a cópia é feita sozinha quando a credencial é vista;
  - nada se sobrescreve: foto nova vira arquivo novo.
- **Impressão** (tamanho real):
  - **5 credenciais por folha A4**, frente e verso lado a lado, com linha de corte tracejada;
  - cada lado tem **85,6 × 54 mm**, o tamanho de cartão de crédito, o mesmo do PVC e das capinhas plásticas;
  - a tela mostra a folha e explica como imprimir: A4, escala 100% e gráficos de fundo;
  - dá para imprimir uma (a própria, ou a de um associado) ou várias marcadas na lista.
- **QR Code** gerado no próprio navegador, sem serviço de fora, com a biblioteca `uqr` 0.1.3 (licença MIT, sem dependências).

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #21 — Fase 3.2/3.3: credencial digital e impressão | Aprovado (verificar + ponta a ponta), publicado e conferido no site de teste (80 de 80) | 13/11/2026 |

### Trava 2

- [x] Migração `20261113120000_credencial_digital.sql`, aplicada no `comep-teste`, com a pasta pública `credenciais`, só para as cópias das fotos.
- [x] **10 testes novos do banco** (241 no total):
  - a própria credencial, com o código igual nas próximas vezes;
  - a de outra pessoa, só a secretaria vê;
  - quem não é associado ativo não tem credencial;
  - a validação não mostra CPF nem filiação;
  - em atraso, mostra "inapto para votar";
  - vencida pelo fim do mandato, e só a secretaria muda a configuração;
  - código inexistente ou malformado não revela nada;
  - a substituição só pela secretaria e com motivo, e o QR antigo diz "substituída";
  - a cópia da foto só vai para a pasta da própria credencial;
  - associado arquivado aparece como "inativa".
- [x] `npm audit`: os 6 alertas já existiam e vêm das ferramentas de montagem do app instalável (`vite-plugin-pwa` → `workbox-build` → `glob`/`minimatch`/`deepmerge`). Rodam só na hora de montar o site e não vão para o navegador. A biblioteca nova (`uqr`) não tem dependências.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| O associado completa CPF, mãe e foto e vê "Minha credencial": frente com os dados, verso com o QR Code | ✅ |
| Na impressão, cada lado tem **85,6 mm** de largura (conferido na página de impressão) | ✅ |
| A página do QR Code, sem login: "Credencial válida", com o nome e a foto, sem CPF | ✅ |
| A presidência emite uma nova credencial (perda): o QR antigo passa a dizer "Credencial substituída" | ✅ |
| O ministro não abre a lista de credenciais; o menu dele mostra "Minha credencial" | ✅ |

- **78 testes de ponta a ponta** passando no computador e no celular.
- **Conferência visual** com fotos:
  - a lista de credenciais;
  - a credencial digital (frente e verso);
  - a folha de impressão;
  - a página de validação no celular, verde e com a foto.

### Dados fictícios

As credenciais aparecem para todos os associados fictícios do teste. Com a semente da 3.1, **24 estão completas**: com foto, CPF, filiação, título, igreja com sigla e CNPJ fictício "ZZ". As outras mostram o que falta. O fim do mandato está em branco no teste (pergunta 10 do PROJETO.md).

## Ajuste de 13/11/2026 — impressão para dobrar, validade por mandato e desenho sem cortes

O administrador técnico viu a primeira versão no site de teste e pediu (13/11/2026):

- **Frente e verso juntos.** A credencial é dobrada ao meio, posta na capa plástica e plastificada. Não é recortada em duas partes. O espaço em branco entre frente e verso saiu.
- **Nada cortado.** O nome numa linha só; se o nome quebrava em duas linhas, o CNPJ e outros dados eram cortados.
- **Foto 3×4.** A foto estava estreita e comprida.
- **Validade na credencial.** A impressa vale até o fim do mandato da diretoria e precisa ser impressa de novo a cada mandato. Senão, fica inválida.
- O tamanho (85,6 × 54 mm), a página do QR Code e o CNPJ no formato novo ficaram aprovados.

O que mudou:

- **Desenho por modelo** (`src/utilitarios/modeloCredencial.ts`):
  - cada item da credencial tem uma caixa fixa, em milímetros;
  - um texto comprido **diminui a letra até caber** na sua caixa (até 45% do tamanho). Só então é cortado com "…";
  - nenhum item empurra ou corta o vizinho;
  - o mesmo modelo desenha a digital e a impressa, e é a base do editor (3.4).
- **Foto 3×4** (19,5 × 26 mm).
- **"Válida até"** na frente da credencial, e **"Emitida em"** no rodapé do verso.
- **Impressão:** frente e verso **colados**, com uma linha fina em volta para recortar e marcas da dobra em cima e embaixo, fora do cartão. Continuam 5 por folha A4.
- **Validade por mandato** (migração `20261113150000_credencial_validade_mandato.sql`):
  - a credencial atual acompanha o fim do mandato em curso;
  - **Corrigir a data** (Configurações → Credencial): todas as credenciais do mandato acompanham, e o QR não muda;
  - **Registrar o novo mandato** (posse da nova diretoria), com confirmação:
    - a credencial atual de cada associado fica registrada, valendo até o fim do mandato que terminou;
    - nasce outra, com novo QR Code; a digital muda sozinha;
    - a impressa antiga mostra "vencida" depois da sua data;
  - **perda:** todas as credenciais da pessoa, inclusive as de mandatos anteriores ainda válidas, passam a dizer "substituída".
- **Texto padrão do verso** (migração `20261113150100_credencial_texto_verso.sql`): deixou de dizer "sem necessidade de reimpressão". Só troca se ninguém mudou o texto.

### Trava 2

- [x] Migrações aplicadas no `comep-teste`.
- [x] **8 testes novos do banco** (`credencial_mandato.test.ts`):
  - posse sem o fim do mandato informado;
  - mandato acabado e posse atrasada: "vencida";
  - só a secretaria ou a presidência registram a posse, com data válida;
  - na posse, a digital ganha novo QR e a antiga continua com a sua data;
  - corrigir a data não troca o QR nem mexe no mandato anterior;
  - a impressa do mandato anterior vale até a data dela;
  - foto pública só para a credencial atual;
  - na perda, todas viram "substituída".
- [x] **12 testes de unidade do modelo**:
  - o padrão passa pela própria conferência;
  - tudo dentro do cartão;
  - foto 3×4 e nome numa linha;
  - o que vem do banco ou do editor é conferido: cores, números, imagens só do sistema, no máximo 60 itens;
  - o preenchimento dos dados.

### Trava 3

| O que é testado (ponta a ponta) | Resultado |
|---|---|
| Associado com **nome bem comprido**: nenhum texto passa da sua caixa, na tela e na impressão | ✅ |
| A frente mostra "Válida até" | ✅ |
| Na impressão, cada lado tem 85,6 mm, frente e verso **sem espaço entre eles**, mesma altura e alinhados | ✅ |
| Configurações → Credencial: corrigir a data, e a posse pede confirmação antes de renovar | ✅ |

### Dados fictícios

No `comep-teste`, o fim do mandato foi posto em **31/12/2029, data fictícia**, para a validade aparecer. A data verdadeira depende da pergunta 10.
