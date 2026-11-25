# Instruções para agentes (Codex, Claude e outros)

Sistema de gestão do COMEP (Conselho de Ministros Evangélicos de Parauapebas). Este repositório não tem um `CLAUDE.md` próprio: as regras estão aqui e nos arquivos abaixo. O Claude Code também segue as regras globais da IEADESPA, que estão no `CLAUDE.md` do usuário.

## Antes de mudar código, ler nesta ordem

1. **O `HANDOFF.md` da bancada privada** (`C:\MCP\bancada\projetos\comep\HANDOFF.md`, desde 24/11/2026): o estado atual do trabalho, a linha "Em uso por" (uma pessoa por vez) e o próximo passo exato. O `HANDOFF.md` deste repositório só aponta para lá.
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
- **Agentes:** quantos trabalham ao mesmo tempo, quem decide é o usuário, conforme os créditos de uso na hora (de um a quatro; decisão de 22/11/2026). Sem ordem nova, vale o último número que ele deu, que hoje é dois: um constrói e o outro prepara a homologação. Agentes em paralelo nunca mexem no mesmo código, e só um por vez usa o comep-teste (migração, ponta a ponta, PR ou conferência no navegador), com uma trava combinada entre eles.
- **Segredos:** nunca no repositório, na memória nem no `HANDOFF.md` da bancada, e nada de dado pessoal real. A chave secreta e as senhas ficam só nos *Secrets* do GitHub.
- **Dados:** os de teste são sempre fictícios, e nada se apaga (arquivar com `arquivado_em`). Toda tabela nova segue as convenções do banco (RLS, `interno.aplicar_padroes`, testes em `testes/banco/`).
- **Fluxo:** cada fase ou entrega numa branch própria, com pull request. A `main` só recebe com a verificação do GitHub verde, e entrar na `main` publica o site.
- **Testes de ponta a ponta:** só uma rodada por vez contra o banco de teste (`comep-teste`), seja local ou no GitHub.
- **Produção:** só no lançamento, no fim da Fase 5.5. Não contornar os bloqueios.
- **Passagem de bastão a cada marco**, não só no fim (commit, resultado de agente, decisão do usuário, antes de mudar de assunto):
  - gravar no `memoria-projeto` as decisões, as regras e os defeitos resolvidos, em observações curtas com data;
  - substituir o `HANDOFF.md` da bancada (`projetos/comep/`) pelo estado atual, com commit e push na bancada. Ele não acumula histórico.
