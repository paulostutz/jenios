# R62 — Fechamento das fronteiras de QA dos robôs

## Estado e escopo

**Candidato em validação.** Este bloco acrescenta oito verificações de navegador às 33 do R61, com foco em dois caminhos ainda não observados na interface: negação HTTP pelas flags de execução e invalidação ao exceder os limites da sessão UltraFast. A aprovação depende da CI completa e da revalidação do commit consolidado antes do backup final.

Base consultada: `backup/jenios-robot-r61-qa-policy-integration-certified-20261024`, commit `50992b9783903ff0a5a09fbb3f8790dad601025f`, CI `40096729204` em SUCCESS. O backup R61 e sua evidência permanecem preservados.

Branch: `research/jenios-robot-r62-qa-boundary-closeout-20261024`.

Backup final reservado: `backup/jenios-robot-r62-qa-boundary-closeout-certified-20261024`. Seu ref Git será a referência autoritativa para o SHA final, depois da revalidação. O checkpoint registra a CI de evidência anterior à consolidação, evitando referência circular ao próprio commit.

## Cobertura adicional

### 1. Seis cenários de negação por flag

Para cada flag abaixo, o processo local de teste é iniciado uma vez com a string `'true'` e uma vez sem a variável:

- `JENIOS_REAL_EXECUTION_ENABLED`
- `JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED`
- `JENIOS_PRIVATE_PAPER_EXECUTOR`

Cada caso exige HTTP 404 na rota `/platform/homologacao/robos`, console ausente, página-mãe informativa com HTTP 200 e link para o console ausente. Os contadores do browser devem permanecer em zero para origens externas, APIs, métodos mutantes e WebSockets, sem erros JavaScript.

Esses valores são fixtures negativas do processo filho local. O workflow mantém os controles de execução desabilitados por padrão e não altera configuração de deploy, conta ou produção. O objetivo é observar o guard recusando uma configuração incompatível com a homologação sintética.

### 2. Duas fronteiras da sessão UltraFast

| Fronteira | Como a tela chega ao limite | Resultado exigido no evento seguinte |
|---|---|---|
| 500 snapshots | Início com dois snapshots, seguido de 498 cliques em evento normal. A decisão deve continuar permitida no evento 500. | A tentativa 501 remove o resultado anterior, mostra alerta e desabilita avanço/pausa/retomada. |
| 1.000 eventos | Início com dois snapshots; 498 pares de pausa/retomada levam a 998 eventos; duas novas confirmações normais chegam a 1.000 com decisão permitida. | A tentativa 1.001 remove o resultado anterior, mostra alerta e desabilita avanço/pausa/retomada. |

Após cada rejeição, o botão de início deve criar outra sessão, com identificador diferente, dois snapshots validados e controles coerentes. Cada ação aceita é observada no DOM: contador, estado, liberação e identificador precisam corresponder ao esperado antes do próximo clique.

Os testes usam `locator.click` do Playwright nos controles existentes. Não injetam estado React, não chamam adapters para substituir a interface e não reduzem os limites para facilitar o teste. Cada caso tem loops finitos e orçamento de 300 segundos. Não há nova simulação de rentabilidade ou aumento artificial do stress dos algoritmos.

## Reutilização e isolamento

O runner R61 recebe uma extensão opcional, selecionada por `JENIOS_ROBOT_QA_ACCEPTANCE_REVISION=R62`. Sem essa opção, os mesmos 33 casos R61 continuam sendo a bateria padrão. No R62, os dois casos de limite são registrados enquanto o servidor QA está habilitado; os seis casos de flags vêm depois, antes dos dois gates negativos já existentes. O total esperado é 41 casos, sem IDs duplicados.

Arquivos de casos novos:

- `scripts/platform/research/r62-session-limit-cases.mjs`
- `scripts/platform/research/r62-execution-flag-cases.mjs`

O workflow `.github/workflows/jenios-robot-r62-qa-boundary-closeout.yml` preserva a bateria direcionada R12–R61, executa `npm run build` com os testes gerais e Social e roda Chromium sobre o build local. Playwright continua fixado em 1.56.1, instalado fora das dependências da aplicação. O relatório usa o marcador `R62_BROWSER_ACCEPTANCE`; o artefato `r62-browser-evidence-<SHA>` retém JSON, logs e screenshots por 14 dias.

Não há alterações planejadas nos algoritmos, adapters, limites ou UI da aplicação. As exclusões de deploy do R60/R61 permanecem e recebem os refs exatos do R62. Nenhum merge ou deploy faz parte deste bloco.

### Revisão da inicialização

A árvore completa da base R61 não contém instrumentation, middleware/proxy, servidor customizado ou arquivos `.env` versionados. O layout ancestral da rota importa somente CSS; a configuração Next contém tracing dos binários Social. As páginas QA usam o guard puro, e o runner inicia diretamente o CLI Next em `127.0.0.1:4317`, com ambiente mínimo e sem herdar credenciais de aplicação.

Não foi encontrado caminho de inicialização de transporte no código inspecionado. Essa revisão e a interceptação de solicitações do browser não certificam isolamento de rede de toda a máquina. Os downloads de dependências e Chromium pertencem à preparação da CI.

## Evidência, invariantes e aceite

Checkpoint: `docs/platform/evidence/ROBOT_R62_QA_BOUNDARY_CLOSEOUT_CHECKPOINT.json`.

O ledger acrescenta `qaBoundaryCloseout`, preservando todos os registros R12–R61. Após o sucesso da CI, o relatório completo será salvo em `docs/platform/evidence/ROBOT_R62_BROWSER_BOUNDARY_EVIDENCE.json` antes da revalidação do commit consolidado.

Permanecem: alignment guard 0,65; R15 prospectivo sem backfill; `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` nulos; zero ordens reais e Paper externo; nenhuma certificação de performance comercial.

O aceite manual do proprietário continua `NOT_EXECUTED`, conforme `docs/platform/ROBOT_R61_SYNTHETIC_ACCEPTANCE.md`. O R62 fecha somente as fronteiras especificadas do console sintético. Integração operacional completa, permissões reais de conta, feed contemporâneo, execução externa e rentabilidade observada permanecem sem validação nesta rodada.
