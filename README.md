# COMEP — Sistema de Gestão

Sistema de gestão do **Conselho de Ministros Evangélicos de Parauapebas**. O escopo, as regras e as fases estão em [PROJETO.md](PROJETO.md).

- **Endereço (provisório):** https://ieadespa.github.io/comep/
- **Hospedagem provisória:** organização IEADESPA no GitHub e no Supabase, até a transferência ao Conselho (PROJETO.md, seção 8).

## Tecnologias

React + Vite + TypeScript como app instalável (PWA) · Supabase (PostgreSQL, login e arquivos) · GitHub Pages · GitHub Actions.

## Como rodar no computador

Precisa do Node 24 ou mais novo.

```bash
npm install
cp .env.example .env.local   # preencher com o endereço e a chave publishable do projeto comep-teste
npm run dev                  # abre em http://localhost:5173/comep/
```

| Comando | O que faz |
|---|---|
| `npm run dev` | App em modo de desenvolvimento |
| `npm test` | Testa as regras do banco (RLS, "nada se apaga", auditoria) num PostgreSQL local, sem Docker |
| `npm run e2e` | Testes de ponta a ponta: navegador de verdade, banco de teste, usuários fictícios (senhas em `.env.e2e.local`, fora do repositório) — rodar depois do `npm run build` |
| `npm run lint` | Confere o código, inclusive a regra de portabilidade |
| `npm run build` | Gera a versão de publicação em `dist/` |
| `npm run db:novo <nome>` | Cria um arquivo de migração novo em `supabase/migrations/` |
| `npm run db:aplicar` | Aplica as migrações no projeto Supabase vinculado (`npx supabase link`) |

## Organização das pastas

```
src/
  dados/        ÚNICA pasta que fala com o Supabase (regra de portabilidade — o lint bloqueia o resto)
  estado/       Sessão (quem está logado e com quais perfis) e carregamento de dados das telas
  componentes/  Estrutura da tela, menu por perfil, proteção de rotas
  telas/        Telas do app (site, igrejas/, ministros/, administracao/)
  utilitarios/  Formatos e validações (CNPJ, datas, busca sem acento)
supabase/
  migrations/   Estrutura do banco (tabelas, regras de acesso, auditoria), em ordem
testes/banco/   Testes automáticos das regras do banco
testes/unidade/ Testes das validações das telas
testes/dados/   Semente de dados FICTÍCIOS para o banco de teste (só roda no comep-teste)
testes/e2e/     Testes de ponta a ponta (navegador de verdade + banco de teste)
docs/revisoes/  Registro das travas de revisão de cada fase (PROJETO.md, seção 14)
docs/configuracao-login.md  Configuração de login do Supabase (sem e-mail) em cada ambiente
docs/lancamento.md          Roteiro do lançamento da versão 1.0 (trava 4)
docs/termo-hospedagem.md    Modelo do termo de hospedagem e cessão (PROJETO.md, seção 8)
.github/workflows/  Verificação em todo pull request e publicação ao entrar na main
```

## Regras que não se negociam

- **Segredos nunca no repositório.** Aqui só entram o endereço do Supabase e a chave *publishable*, que são públicos por natureza. A chave secreta e a senha do banco ficam só nos *Secrets* do GitHub Actions ou com a diretoria.
- **Nada se apaga.** O banco bloqueia `DELETE` e `TRUNCATE`; registros são arquivados (`arquivado_em`).
- **Toda tabela nova** chama `select interno.aplicar_padroes('public.<tabela>');` (auditoria + proibição de exclusão), habilita RLS, recebe permissões explícitas e ganha testes em `testes/banco/`.
- **Dados de teste são fictícios.** Nunca usar dados reais de ministros em testes.
- **Cada fase numa branch própria**, com pull request e revisão antes de entrar na `main` (que publica automaticamente).

## Primeiro acesso de administrador

Os perfis são concedidos pela presidência dentro do sistema, mas o primeiro precisa ser dado direto no banco:

1. Supabase → projeto → **Authentication → Users → Add user** (e-mail e senha da pessoa).
2. Supabase → **SQL Editor**, trocando o e-mail:

```sql
insert into public.perfis_acesso (pessoa_id, perfil)
select id, 'presidencia' from public.pessoas where email = 'email-da-pessoa@exemplo.com';
```
