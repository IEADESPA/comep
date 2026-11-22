# Instruções para agentes (Codex, Claude e outros)

Sistema de gestão do COMEP (Conselho de Ministros Evangélicos de Parauapebas). Este repositório não tem um `CLAUDE.md` próprio: as regras estão aqui e nos arquivos abaixo. O Claude Code também segue as regras globais da IEADESPA, que estão no `CLAUDE.md` do usuário.

## Antes de mudar código, ler nesta ordem

1. **`HANDOFF.md`**: o estado atual do trabalho e o próximo passo exato.
2. **Servidor MCP `memoria-projeto`** (compartilhado entre o Claude e o Codex): os fatos duráveis do projeto. Use `search_nodes`, ou `read_graph` com `observationLimit: 0` para ter uma visão geral. A entidade principal é "COMEP — sistema de gestão"; as outras são:
   - os ambientes (teste e produção);
   - as convenções do banco;
   - os testes e a verificação;
   - as ferramentas no Windows;
   - o roteiro depois da Fase 5;
   - as pendências;
   - os defeitos resolvidos.
3. **`README.md`**: como rodar e as regras que não se negociam.
4. **`PROJETO.md`**: o escopo, as fases e as decisões da diretoria (seção 11).
5. **`docs/revisoes/`**, com uma revisão por fase, e **`docs/lancamento.md`**, o roteiro da produção.
6. Por fim, `git status` e o ramo atual.

## Regras

- **Idioma:** português do Brasil, no padrão brasileiro (vírgula decimal, datas dd/mm/aaaa). O código, as tabelas e a interface também são em português.
- **Agentes:** até dois ao mesmo tempo (decisão do usuário, 21/11/2026): um constrói e o outro prepara a homologação. Nunca os dois aplicando migração ou rodando o ponta a ponta no comep-teste, nem mexendo no mesmo código.
- **Segredos:** nunca no repositório, na memória nem no `HANDOFF.md`, e nada de dado pessoal real. A chave secreta e as senhas ficam só nos *Secrets* do GitHub.
- **Dados:** os de teste são sempre fictícios, e nada se apaga (arquivar com `arquivado_em`). Toda tabela nova segue as convenções do banco (RLS, `interno.aplicar_padroes`, testes em `testes/banco/`).
- **Fluxo:** cada fase ou entrega numa branch própria, com pull request. A `main` só recebe com a verificação do GitHub verde, e entrar na `main` publica o site.
- **Testes de ponta a ponta:** só uma rodada por vez contra o banco de teste (`comep-teste`), seja local ou no GitHub.
- **Produção:** só no lançamento, no fim da Fase 5.5. Não contornar os bloqueios.
- **Passagem de bastão a cada marco**, não só no fim (commit, resultado de agente, decisão do usuário, antes de mudar de assunto):
  - gravar no `memoria-projeto` as decisões, as regras e os defeitos resolvidos, em observações curtas com data;
  - substituir o `HANDOFF.md` pelo estado atual. Ele não acumula histórico.
