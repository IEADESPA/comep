# Roteiro do lançamento da versão 1.0

> Entrega 1.4 (PROJETO.md, seção 9). É a primeira versão com **dados reais**.
> Este roteiro é a trava 4 (seção 14): só se começa com todos os pré-requisitos marcados.

## Pré-requisitos (ninguém lança sem eles)

- [x] Revisão geral da Fase 1 concluída, sem problema bloqueante ou importante aberto (`docs/revisoes/fase-1.md`)
- [x] Backup semanal incluindo fotos e comprovantes, testado em 12/11/2026
- [x] Ambiente de teste no endereço próprio: `https://ieadespa.github.io/comep/teste/`
- [x] Produção preparada, sem nenhum dado: estrutura do banco e configuração de login (ver "Situação" no fim)
- [ ] **Aceite da presidência:** a presidência do COMEP confere as regras do estatuto no ambiente de teste e dá o aceite, com nome e data registrados em `docs/revisoes/fase-1.md`
- [ ] **Termo de hospedagem** (`docs/termo-hospedagem.md`) assinado pela presidência do COMEP e pela IEADESPA
- [ ] **Verificação em duas etapas** ligada nas duas contas donas do GitHub (`seta-max` e `presidente-ai`), com os códigos de recuperação guardados
- [ ] **Dados do presidente do COMEP:**
  - nome completo;
  - telefone (WhatsApp);
  - o e-mail com que ele vai entrar;
  - igreja e denominação;
  - título.

## Passo a passo do dia

### 1. Ligar o site oficial à produção

O Claude Code faz.

No repositório `IEADESPA/comep`, em **Settings → Secrets and variables → Actions → Variables**:

| Variável | Antes (teste) | Depois (produção) |
|---|---|---|
| `SUPABASE_URL` | endereço do `comep-teste` | `https://xwdnhdbpdpluotxjiawf.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | chave publishable do teste | chave publishable da produção |
| `AMBIENTE` | `teste` | *(apagar a variável, ou deixar vazia)* |

As variáveis `TESTE_*` não mudam: o endereço `/comep/teste/` continua no banco de teste.

Depois, rodar de novo o fluxo **Verificar e publicar** (Actions → Run workflow, na `main`). Conferir que `https://ieadespa.github.io/comep/` abre **sem** a faixa amarela e que `/comep/teste/` continua **com** ela.

### 2. Primeiros acessos

O sistema começa sem ninguém com perfil. É o "ovo e a galinha": quem dá os perfis é a presidência. Por isso os dois primeiros acessos são dados direto no banco, pelo Claude Code, sem dado nenhum além desses.

1. **Administrador técnico (IEADESPA):** cria o próprio login no site oficial, em "Quero me associar → criar acesso", e **não** envia pedido.
2. **Presidente do COMEP:** faz o mesmo, com o e-mail dele.
3. **Claude Code**, no banco de produção, com os dados informados:
   - cadastra a igreja do presidente;
   - torna o presidente associado ("associado anterior ao sistema"), com título e igreja, e dá a ele o perfil **Presidência**;
   - dá ao administrador técnico o perfil **Administrador técnico**.
4. **Presidente:** entra e confere o menu completo.

A partir daí, tudo é feito pelo sistema:

- cadastrar as igrejas e os associados atuais;
- gerar os códigos de primeiro acesso, que vão pelo WhatsApp;
- dar os perfis da diretoria, só a associados ativos;
- preencher os dados do site em **Configurações**.

### 3. Conferência rápida em produção

Faz parte da trava 4.

- [ ] Site oficial sem faixa amarela; "Fale com o COMEP" com "—" ou com os dados já preenchidos
- [ ] Presidente entra e vê o menu completo
- [ ] Presidente cadastra uma igreja **real** e um associado **real**, e gera um código
- [ ] O associado faz o primeiro acesso e vê "Meu perfil"
- [ ] O próximo backup (domingo, ou rodado na hora) traz os dados de produção e abre com a chave

### 4. Marcar a versão

O Claude Code faz: cria a marca `v1.0` no GitHub e registra o aceite e a data em `docs/revisoes/fase-1.md`.

## Se algo der errado

- **Voltar o site para o teste:** devolver as três variáveis do passo 1 aos valores de antes e publicar de novo. O banco de produção não precisa mudar nada, porque as migrações só acrescentam.
- **Um associado não consegue entrar:** a secretaria gera um código de nova senha. Se for alguém da diretoria, o código é gerado pela presidência.

## Situação

| Item | Situação |
|---|---|
| Estrutura do banco de produção | Ver `docs/revisoes/fase-1.md`, "Revisão geral antes do lançamento" |
| Login da produção (`docs/configuracao-login.md`) | Idem |
| Site oficial | No banco de **teste** até o passo 1 |
