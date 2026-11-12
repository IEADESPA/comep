# Revisão da Fase 1 — Associação, ministros e igrejas (versão 1.0)

> A Fase 1 é entregue em partes (PROJETO.md, seção 9). Cada parte passa pelas travas 1 a 3 no ambiente de teste.
> A trava 4 (produção) é uma só, no lançamento da versão 1.0.
> Regras: PROJETO.md, seção 14.

## Entrega 1.1 — Cadastros (versão 1.0-teste.1)

**Resultado: aprovada no ambiente de teste em 11/11/2026.**

O que entrou:

- **Igrejas:** cadastro, correção e arquivamento, além da lista dos ministros de cada igreja. O CNPJ é conferido na tela e no banco, inclusive o CNPJ novo com letras (Receita Federal, 2026).
- **Denominações:** lista com cadastro e arquivamento.
- **Títulos ministeriais:** lista provisória (Pastor, Evangelista, Presbítero, Missionário, Líder) até a decisão 9.
- **Ministros:**
  - cadastro direto dos associados atuais (Art. 7º, a), feito pela secretaria ou pela presidência, com nº de registro automático;
  - ficha com contato, histórico de títulos e de igrejas, e troca de igreja;
  - arquivamento do cadastro feito por engano.
- **Perfil Ministro automático:** todo associado ativo recebe o perfil; cadastro arquivado perde.
- **Perfis de acesso:** a presidência concede e retira perfis. O banco não deixa retirar o último perfil de Presidência.
- **Auditoria:** histórico de criações, alterações e arquivamentos, com filtro por área, mostrando quem fez e o que mudou.

### Trava 1 — Verificação automática

| Pull request | Resultado | Data |
|---|---|---|
| #6 — Fase 1.1, cadastros | verde (lint, 51 testes, build e 30 testes de ponta a ponta no GitHub) | 11/11/2026 |

### Trava 2 — Revisão técnica no banco de teste (`comep-teste`)

- [x] Migrações aplicadas **só** no `comep-teste`: `20261111172138_cadastros.sql` e `20261111174009_cadastros_ajustes.sql`
- [x] 6 tabelas novas, uma visão (`vw_associados`, que respeita a RLS de quem consulta) e duas operações de várias tabelas (`cadastrar_associado`, `mudar_igreja`), todas com RLS
- [x] Verificador do Supabase sem alertas sobre as tabelas. Avisos que restam:
  - "proteção contra senhas vazadas desligada": recurso do plano pago (seção 10);
  - "índices ainda não usados": normal em banco novo;
  - índice que faltava em `titulos_pessoa.titulo_id`: criado no ajuste.
- [x] Visitante sem login recusado nas 6 tabelas e na visão
- [x] Nenhuma permissão de apagar (DELETE) para `anon`/`authenticated`; nem o dono do banco apaga
- [x] **51 testes automáticos** passando:
  - 19 da Fase 0 (regras do banco);
  - 26 da Fase 1.1 (regras do banco);
  - 6 das validações das telas.
- [x] Dados **fictícios** fixos para os testes no banco de teste:
  - "Denominação Fictícia (teste)";
  - "Igreja Fictícia A (teste)" e "Igreja Fictícia B (teste)";
  - "Pessoa Fictícia para Perfis (teste)";
  - o usuário `e2e.ministro` como associado da Igreja A.

### Trava 3 — Teste de uso no ambiente de teste

Testes de ponta a ponta (`npm run e2e`): **30 de 30 passando**, ou seja, 15 testes, cada um em tamanho de computador e de celular.

| O que é testado | Resultado |
|---|---|
| Presidência cadastra uma igreja: CNPJ errado é recusado; corrige, salva, arquiva; a auditoria mostra a criação, a alteração e o arquivamento | ✅ |
| Presidência cadastra um associado atual, registra a troca de igreja (o histórico mostra as duas), acha na lista e arquiva | ✅ |
| Presidência concede e retira um perfil de acesso | ✅ |
| Nenhuma tela da diretoria fica mais larga que a tela do celular | ✅ |
| Presidência abre "Ministros" (tela pronta) e "Financeiro" (em construção, Fase 2) | ✅ |
| Ministro não abre auditoria, perfis, ministros nem igrejas, nem digitando o endereço | ✅ |
| Testes da Fase 0 (site, login, menu por perfil) | ✅ |

Conferência visual (fotos em 1280 px e 390 px, logado como presidência fictícia):

- telas: início, igrejas, nova igreja, ministros, ficha do ministro, perfis de acesso e auditoria;
- nenhuma sobra lateral no celular.

O que as fotos revelaram está nos problemas 1 e 2.

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 1 | Importante | Ao arquivar um cadastro feito por engano, a pessoa sem login continuava aparecendo em "Perfis de acesso". Os testes deixariam a lista cada vez maior | Migração `cadastros_ajustes`: a pessoa sem login é arquivada junto. Quem tem login ou perfil da diretoria não é arquivado. As 2 pessoas fictícias que já tinham sobrado no teste foram arquivadas | ✅ teste do banco + conferido no `comep-teste` (0 pessoas fictícias sobrando) |
| 2 | Menor | Na auditoria, títulos e vínculos de igreja apareciam como "registro c294c629", sem o nome do ministro | A auditoria busca o nome da pessoa de cada registro | ✅ |
| 3 | Menor | Faltava índice na chave `titulos_pessoa.titulo_id` (aviso do verificador do Supabase) | Criado na migração `cadastros_ajustes` | ✅ |

### Pendências que não travam a próxima entrega

- **Decisão 9 (títulos):** a lista é provisória.
- **Tela da lista de títulos:** hoje só a equipe técnica muda a lista. A tela entra se a diretoria quiser mexer nela com frequência.
- **Desligamento e falecimento:** ficam para a Fase 4, decididos em assembleia (Art. 8º). Até lá, a ficha só permite arquivar cadastro feito por engano.

## Entrega 1.2 — parte 1: configurações e categorias

**Resultado: aprovada no ambiente de teste em 11/11/2026.**

O que entrou (pedidos de 11/11/2026):

- **Tela de Configurações:**
  - listas de denominações (tipos de igreja), bairros e títulos de ministro: incluir, renomear e arquivar;
  - valores da contribuição com data de vigência, assembleia e histórico, já com os valores informados pela diretoria.
- **Presidente de igreja = categoria de R$ 40** (previsão da decisão 12):
  - o pastor presidente marcado na ficha recebe o perfil automaticamente;
  - uma igreja só tem um pastor presidente por vez.
- **Jubilado:** marcado na ficha, fica isento.
- **Categoria de contribuição automática** na ficha do ministro, já com os valores.
- **Duas colunas independentes no computador:** o menu e o conteúdo rolam cada um por conta própria. Ao trocar de tela, o conteúdo volta ao topo.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #8 — Fase 1.2 parte 1, configurações | verde (lint, testes, build e ponta a ponta no GitHub) | 11/11/2026 |

### Trava 2

- [x] Migração `20261111185320_configuracoes.sql` aplicada só no `comep-teste`. Os bairros digitados antes viraram itens da lista.
- [x] Verificador do Supabase sem alertas novos. Só sobram:
  - a proteção contra senhas vazadas, que é do plano pago;
  - índices ainda sem uso.
- [x] **70 testes automáticos** passando:
  - 64 do banco, dos quais 19 são novos: perfis e categorias automáticos, um presidente por igreja, valores e permissões;
  - 6 das validações das telas.

### Trava 3

Testes de ponta a ponta: **37 passando**, com 1 pulado de propósito (a rolagem das colunas só existe no computador).

| O que é testado | Resultado |
|---|---|
| Presidência adiciona, renomeia e arquiva um bairro; nome repetido é recusado | ✅ |
| Valores em vigor aparecem (R$ 40/400, R$ 20/200, jubilado isento); lançar valor futuro não muda o vigente; arquivar | ✅ |
| Cadastro de pastor presidente → categoria presidente de igreja; desmarcar → não presidente; jubilado → isento | ✅ |
| No computador, rolar o conteúdo não move o menu nem o botão "Sair" | ✅ |
| Igreja agora com bairro escolhido da lista | ✅ |
| Todos os testes anteriores | ✅ |

Conferência visual (1280 px e 390 px): Configurações, ficha do ministro com a contribuição e auditoria rolada no computador, com o menu parado.

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 4 | Importante | Cadastro arquivado continuava ocupando a vaga de pastor presidente da igreja, e ninguém mais podia ser marcado | Ao arquivar (ou quando o associado deixar de estar ativo), a marcação de pastor presidente é retirada. Corrigido antes de a migração chegar ao banco de teste | ✅ teste do banco |
| 5 | Menor | "Pastor presidente" também era sugestão do campo de texto "função", o que confundia com a marcação nova (o ministro aparecia com a função "Pastor presidente" e a categoria "não presidente") | Sugestão retirada; quem decide é a marcação própria. O ministro fictício foi ajustado | ✅ |
| 6 | Menor | Na auditoria, os valores da contribuição apareciam como "registro c0f868a1" | A auditoria mostra categoria, tipo e valor | ✅ |

## Entrega 1.2 — parte 2: pedido de associação e códigos de acesso

**Resultado: aprovada no ambiente de teste em 11/11/2026.**

O que entrou:

- **Login sem e-mail** no `comep-teste` (`docs/configuracao-login.md`):
  - cadastro aberto, sem confirmação por e-mail;
  - senha com no mínimo 8 caracteres, com letras e números.
- **Códigos de acesso**, gerados pela secretaria, pela presidência ou pelo administrador na ficha do ministro ou em "Perfis de acesso", e enviados pelo WhatsApp:
  - **primeiro acesso:** o associado antigo cria o login com o próprio e-mail e o código, e o login é ligado ao cadastro dele;
  - **senha esquecida:** a pessoa cria uma senha nova com o e-mail e o código (adiantado da entrega 1.3);
  - o código vale 7 dias e serve uma vez. No banco fica só o resumo dele, numa tabela interna, fora da API e da auditoria.
- **Pedido de associação (Art. 7º):**
  - o candidato cria o acesso pelo site e envia título, igreja (ou "minha igreja não está na lista"), foto e comprovante, mais as três declarações (princípios de fé, estatuto e LGPD);
  - a foto e as imagens são reduzidas no próprio celular antes do envio.
- **Inscrições (secretaria/presidência):**
  - pedidos agrupados por situação;
  - a ficha do pedido mostra foto, comprovante e declarações;
  - ações disponíveis: devolver com pendência, escolher a igreja cadastrada, aceitar a ficha (aceite eletrônico do diretor) e encaminhar à assembleia, recusar com motivo, e registrar a aprovação da Assembleia Ordinária (com aviso se a data não cair na 2ª quinzena de abril ou de outubro);
  - **na aprovação**, numa operação só, o candidato vira associado: nº de registro, título, igreja, foto e perfil Ministro.
- **Arquivos (Storage):** bucket privado `documentos`, com uma pasta por pessoa. Cada um envia só para a própria pasta e vê só os próprios arquivos; a secretaria e a presidência veem todos. Ninguém sobrescreve nem apaga.
- **Regras do pedido no banco**, valendo pela tela ou não:
  - o candidato não se aprova nem escreve a análise;
  - depois de encaminhado, o candidato não altera mais;
  - pedido encerrado não muda;
  - só um pedido aberto por pessoa;
  - quem já é associado não abre pedido.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| #9 — Fase 1.2 parte 2, pedido de associação | verde (lint, testes, build e ponta a ponta no GitHub e no site publicado) | 11/11/2026 |

### Trava 2

- [x] Migração `20261111191948_pedido_associacao.sql` aplicada só no `comep-teste`
- [x] Verificador do Supabase. Únicos avisos:
  - "RLS sem regra" na tabela interna dos códigos: é de propósito, ninguém deve ler essa tabela pela API;
  - a proteção contra senhas vazadas, que é do plano pago.
- [x] Funções que o visitante usa (conferir código, nova senha) ficam no esquema interno, com uma entrada simples na API, como o Supabase recomenda
- [x] **101 testes automáticos** passando:
  - 95 do banco, dos quais 31 são novos: códigos, nova senha (bcrypt), regras do pedido e pastas do Storage;
  - 6 das validações das telas.

### Trava 3

Testes de ponta a ponta: todos passando, no computador e no celular.

| O que é testado | Resultado |
|---|---|
| A presidência cadastra o associado e gera o código, com link do WhatsApp para o telefone dele | ✅ |
| Primeiro acesso: senha só com letras é recusada; com código e e-mail, entra como Ministro | ✅ |
| Senha esquecida: a presidência gera o código, a pessoa troca a senha e já entra | ✅ |
| Pedido: o candidato cria o acesso pelo site e envia título, igreja não cadastrada, foto, comprovante e declarações | ✅ |
| A presidência vê a foto e o comprovante e devolve com pendência | ✅ |
| O candidato vê a pendência, troca a foto e reenvia | ✅ |
| A presidência escolhe a igreja cadastrada, aceita a ficha (aceite do diretor registrado), registra a aprovação e abre a ficha do novo associado | ✅ |
| O candidato aprovado passa a ter o perfil Ministro | ✅ |
| O ministro não abre "Inscrições" nem "Configurações" | ✅ |
| A pessoa sem perfil vê o caminho para o pedido ("Meu pedido") | ✅ |
| Nenhuma página nova fica mais larga que o celular | ✅ |

Conferência visual (1280 px e 390 px):

- "Quero me associar", "Entrar" (com "Primeiro acesso" e "Esqueci a senha") e "Primeiro acesso";
- formulário do pedido;
- lista e ficha de inscrição.

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 7 | Importante | "Sair" encerrava a sessão da pessoa em **todos** os aparelhos (sair no notebook derrubava o celular) | "Sair" encerra só a sessão do aparelho em uso | ✅ |
| 8 | Menor | Os botões que são links (ex.: "Abrir a ficha do associado") apareciam sublinhados | Sublinhado retirado | ✅ |
| 9 | Menor | A ata aparecia repetida ("ata Ata 12/2026") | Mostra só o que foi digitado | ✅ |

Ajuste no processo de teste:

- **Problema:** a bateria passaria do limite de 30 logins a cada 5 minutos do Supabase.
- **O que não foi feito:** o aumento do limite no projeto de teste foi barrado pela proteção do Claude Code, e ficou como está.
- **Solução:** os testes passaram a reaproveitar o login (`autenticacao.setup.ts`): cada usuário fictício entra uma vez por bateria.

## Entrega 1.3 — Portal do ministro

**Resultado: aprovada no ambiente de teste em 12/11/2026.**

O que entrou:

- **Meu perfil**, para quem tem login:
  - ver e corrigir nome e telefone (LGPD);
  - trocar a foto, que é reduzida no celular e fica na própria pasta;
  - trocar a senha, sem e-mail.

  Quem é associado também vê o nº de registro, a situação, a admissão, a categoria e o valor da contribuição, o título e a igreja, com histórico.
- **Pedido de troca de igreja** feito pelo próprio ministro:
  - a igreja pode ser da lista ou não cadastrada;
  - o ministro informa a função e se será o pastor presidente;
  - a secretaria ou a presidência aprova ou recusa, com motivo, na tela de Ministros. Se a igreja não for cadastrada, escolhe a igreja certa ao aprovar;
  - ao aprovar, o vínculo atual é encerrado e o novo é aberto, numa operação só;
  - o ministro pode cancelar enquanto o pedido estiver pendente.
- **Minha igreja**, o painel do pastor presidente (decisão 12, previsão):
  - os ministros da igreja, com nome, telefone, nº, título e função. Ele **não** vê o cadastro completo dessas pessoas;
  - ele atualiza endereço, bairro e telefone da igreja. O banco recusa mudança de nome, CNPJ, denominação ou arquivamento.

### Trava 1

| Pull request | Resultado | Data |
|---|---|---|
| Fase 1.3 — portal do ministro | ver o pull request | 12/11/2026 |

### Trava 2

- [x] Migrações `20261112121343_portal_ministro.sql` e `20261112121722_portal_ministro_ajustes.sql` aplicadas só no `comep-teste`
- [x] Verificador do Supabase: depois do ajuste, só os dois avisos esperados (tabela interna dos códigos e senhas vazadas do plano pago)
- [x] **120 testes automáticos** passando:
  - 114 do banco, dos quais 19 são novos: foto só da própria pasta, presidente de igreja (vê só os seus, muda só o contato) e troca de igreja;
  - 6 das validações das telas.

### Trava 3

Testes de ponta a ponta: **50 passando**, mais 1 pulado de propósito.

| O que é testado | Resultado |
|---|---|
| O ministro vê nº de registro, categoria (R$ 20/R$ 200) e igreja; corrige o telefone; troca a foto | ✅ |
| O ministro pede troca para a Igreja B e troca a própria senha | ✅ |
| A presidência vê o pedido na tela de Ministros e aprova | ✅ |
| O ministro entra com a senha nova e vê a igreja nova, com a antiga no histórico | ✅ |
| O pastor presidente ganha o perfil, vê "Minha igreja" com os ministros dela (inclusive o telefone) e atualiza o contato da igreja | ✅ |
| O ministro comum não vê nem abre "Minha igreja" | ✅ |

Conferência visual (1280 px e 390 px): "Meu perfil" com o pedido de troca aberto, sem sobra lateral.

### Problemas encontrados

| # | Gravidade | Descrição | Correção | Testado de novo |
|---|---|---|---|---|
| 10 | Importante | Ao salvar os dados em "Meu perfil", a tela inteira voltava a "Carregando…" e a mensagem de "salvo" sumia, porque recarregar o cadastro da sessão apagava o cadastro antes da resposta | O cadastro é recarregado mantendo a tela aberta | ✅ |
| 11 | Menor | O verificador do Supabase apontou duas regras de alteração separadas na tabela de igrejas (secretaria e pastor presidente) | Unidas numa regra só, numa migração de ajuste | ✅ |

## Trava 4 — Aceite e lançamento da versão 1.0

- [ ] Nenhum problema bloqueante ou importante em aberto (ou decisão registrada abaixo)
- [ ] Aceite técnico — nome e data:
- [ ] Aceite da diretoria (regras do estatuto) — nome e data:
- [ ] Termo da seção 8 assinado
- [ ] Migrações aplicadas no `comep-producao`
- [ ] Publicado e conferido em produção (entrar, menu, uma tela de cada perfil)
- [ ] Versão marcada no GitHub: `v1.0`

Decisões registradas:
