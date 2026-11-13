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
| Fase 3.1 — dados da credencial | ver o pull request | 13/11/2026 |

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
