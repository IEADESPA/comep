# Roteiro do lançamento da versão 1.0

> **No fim da Fase 5.5, depois das telas novas e do site vivo** (decisão de 14/11/2026, PROJETO.md, seção 9: uma mudança só na produção, de uma vez). Até lá o sistema fica no ambiente de teste, com dados fictícios. A produção está preparada e vazia.
> Este roteiro é a trava 4 (seção 14): só se começa com todos os pré-requisitos marcados.

## Pré-requisitos (ninguém lança sem eles)

- [x] Revisão geral da Fase 1 concluída, sem problema bloqueante ou importante aberto (`docs/revisoes/fase-1.md`)
- [x] Backup semanal incluindo fotos e comprovantes, testado em 12/11/2026
- [x] Ambiente de teste no endereço próprio: `https://ieadespa.github.io/comep/teste/`
- [x] Produção preparada, sem nenhum dado: estrutura do banco e configuração de login (ver "Situação" no fim)
- [x] **Aceite da presidência:** em 12/11/2026, o presidente do COMEP concordou com tudo o que foi feito (registrado em `docs/revisoes/fase-1.md`). Repetir a conferência das fases 2 a 5 antes do lançamento
- [ ] **Termo de hospedagem** (`docs/termo-hospedagem.md`) assinado pela presidência do COMEP e pela IEADESPA
- [ ] **Riscos aceitos nas revisões gerais, revistos com a diretoria verdadeira.** Em especial o F6 da Fase 4: hoje a ata é assinada pelo **perfil** (Secretaria, Presidência), e não só pelo cargo (1º secretário, presidente). A ata guarda o cargo de quem assinou (`docs/revisoes/fase-4.md`)
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

> As migrações das fases 2 a 5 precisam estar aplicadas na produção antes deste passo (`npx supabase db push --remote=xwdnhdbpdpluotxjiawf`), depois de passarem pelas travas no teste.

1. **Administrador técnico (IEADESPA):** cria o próprio login no site oficial, em "Quero me associar → criar acesso", e **não** envia pedido.
2. **Presidente do COMEP:** faz o mesmo, com o e-mail dele.
3. **Claude Code**, no banco de produção, com os dados informados:
   - cadastra a igreja do presidente;
   - torna o presidente associado ("associado anterior ao sistema"), com título e igreja, e dá a ele o perfil **Presidência**;
   - dá ao administrador técnico o perfil **Administrador técnico**.
4. **Presidente:** entra e confere o menu completo.

A partir daí, tudo é feito pelo sistema:

- cadastrar as igrejas e os associados atuais;
- gerar os códigos de primeiro acesso, que vão pelo WhatsApp. Para quem é da diretoria, só a presidência gera;
- registrar a diretoria em exercício em **Diretoria**. O primeiro registro leva a ata ou o documento da eleição. Daí em diante, cada diretoria eleita é registrada com a assembleia instalada no sistema. O cargo dá o perfil sozinho;
- se ainda faltar alguém, dar os perfis da diretoria em "Perfis de acesso", só a associados ativos;
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
| Estrutura do banco de produção | ✅ 12/11/2026: as 9 migrações aplicadas numa produção vazia, sem erro |
| Migrações que faltam na produção | A partir de `20261112153856_limite_arquivos.sql`: limite de arquivos, toda a Fase 2 (contribuições, caixa, taxa de inscrição, Conselho Fiscal, prestação de contas e revisão geral) toda a Fase 3 (dados da credencial, credencial digital e impressão, validade por mandato, editor do modelo e revisão geral) e toda a Fase 4 (assembleias e reuniões, presença e faltas, quórum, votações, desligamentos e ata, diretoria e mandatos, revisão geral e a entrega 4.5 com as respostas de 14/11/2026) e a Fase 5 até aqui (a igreja como instituição, as comissões e os eventos). Já passaram pelas travas no teste e são aplicadas no lançamento, junto com as que vierem até o fim da Fase 5.5 |
| Login da produção (`docs/configuracao-login.md`) | ✅ 12/11/2026: sem confirmação por e-mail, senha de 8 caracteres com letras e números, endereço do site |
| Conferência da produção | ✅ 12/11/2026: mesmas regras do teste. O visitante recebe "sem permissão" em tudo, exceto os dados do site. 0 logins, 0 cadastros. Títulos e valores carregados. Pasta de arquivos privada |
| Backup da produção | ✅ Entra no backup semanal (banco + arquivos) |
| Site oficial | No banco de **teste** até o passo 1 |
