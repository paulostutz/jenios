# R61 — Integração das políticas na homologação sintética

## Escopo e estado

**Homologação sintética validada.** O R61 acrescenta um console de homologação que chama as políticas de pesquisa existentes por controles reais de interface. A CI de referência `40096367549`, no commit `d4cfc222c3303f222323b5c29d27a08a1d5afe5d`, concluiu todas as etapas com sucesso. O commit que consolida esta evidência deve passar novamente pela CI completa antes da criação do backup final. Esta certificação não representa instalação dos robôs em produção, execução em corretora ou prova de rentabilidade.

| Evidência observada na CI de referência | Resultado |
|---|---:|
| Direcionados R12–R61 | 307/307 PASS |
| Testes gerais | 2.113/2.113 PASS |
| Social | 94/94 PASS |
| Build | PASS |
| Páginas estáticas geradas | 76/76 |
| Aceitação Chromium | 33/33 PASS |
| Falhas ou casos ignorados | 0 |

A rota R61 é dinâmica; a contagem de 76 páginas é a geração estática informada pelo Next. O browser verificou desktop de 1.440 px e mobile de 375/320 px, com largura do documento igual à viewport nas duas medidas móveis. Os 33 casos incluíram 50 verificações visíveis de ordens reais/Paper externo em zero. Houve zero tentativas externas, de API, de métodos mutantes e de WebSocket, e zero erros JavaScript. As duas mensagens de console HTTP 404 correspondem aos gates negativos esperados. Screenshots de desktop/celular e os logs dos três servidores locais foram revisados; o checksum do arquivo de evidência foi conferido.

[Abrir a CI de referência](https://github.com/paulostutz/jenios/actions/runs/40096367549).

Base consultada: `backup/jenios-robot-r60-operational-closeout-certified-20261024`, commit `ac496719858df8f5d0fccb219b3109231e2091b7`, CI `40094125957` concluída com sucesso. A base mantém R59 certificado e R60 com 264 testes direcionados, 2.070 gerais, 94 Social e build aprovado.

Branch de trabalho: `research/jenios-robot-r61-qa-policy-integration-20261024`.

Backup final reservado: `backup/jenios-robot-r61-qa-policy-integration-certified-20261024`. O backup só será criado depois da CI do commit consolidado. O ref Git do backup será a referência autoritativa para o SHA final; o checkpoint registra a execução de evidência anterior à consolidação, evitando uma referência circular ao próprio commit.

## O que a interface realmente exercita

| Modo | Integração exercitada | Limite da conclusão |
|---|---|---|
| Manual | Chama R56 com perdas consecutivas, drawdown, confiança e pedido de ajuda fictícios. Exibe os alertas sem mudar modo, entrada ou saída. | Controle do operador validado no cenário sintético; nenhuma operação executada. |
| Híbrido | Usa o mesmo alignment guard R19 revalidado por R57, congelado em 0,65. Compara intenção e direção de contexto. | Orientação e abstenção em fixtures; 0,65 não é taxa de acerto. |
| Reverso | Chama R58, respeitando alinhamento, baixa confiança e exceção de megatendência. | Referência de inversão seletiva. Losseshômetro em R hipotético, sem perdas reais evitadas. |
| UltraFast | Usa entitlement simulado e R18, R31, R33, R47, R50, R52 e R53; R26/R27/R28/R30 são dependências. | Sessão, gates e decisões de laboratório. Não integra todos os módulos R18–R55 nem transporte de ordens. |

As implementações certificadas anteriores não são alteradas. Os adapters novos validam entradas, chamam essas funções e marcam a proveniência sintética. O console não consulta APIs, contas, bancos, preços públicos ou corretoras.

### UltraFast

O usuário escolhe plano simulado, ativo do catálogo, capital fictício e alavancagem de teste. Iniciar cria uma nova sessão e aplica dois snapshots sintéticos favoráveis, conforme descrito na tela. Cada evento seguinte exige clique explícito. Não há timer de execução.

Book vencido, choque de custos, manutenção, exposição desconhecida e falta de entitlement revogam a liberação. A recuperação exige dois snapshots normais novos. Pausar e retomar invalidam a prontidão anterior. O cenário de risco injeta um limite fictício de −12 R e mantém `HALTED`; somente uma nova sessão com novo identificador pode voltar à avaliação.

O planejamento R18 utiliza 5% do capital fictício por slot, até 20 slots. Nenhum slot é executado. Nocional, take-profit monetário calculado e edge esperado são valores do modelo; não são saldo ou lucro observado. O adapter limita a sessão a 1.000 eventos e 500 snapshots e reconstrói o histórico antes de aceitar cada evento. O histórico não é persistido no navegador nem enviado a um servidor.

## Acesso e isolamento

Rota: `/platform/homologacao/robos`. A página-mãe mantém os guards existentes e só mostra o link quando o gate completo do console está ativo. A rota filha executa seu próprio gate no servidor e é dinâmica, sem indexação.

Todas estas condições devem ser explícitas:

```text
VERCEL_ENV=preview
JENIOS_QA_CANDIDATE_ENABLED=true
JENIOS_ROBOT_QA_ENABLED=true
JENIOS_REAL_EXECUTION_ENABLED=false
JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED=false
JENIOS_PRIVATE_PAPER_EXECUTOR=false
```

Qualquer condição ausente ou diferente nega a rota. Flags de homologação não representam autenticação de administrador. O console só contém fixtures e não usa nem altera a API administrativa de readiness.

A CI executa o build local com `next start` ligado a `127.0.0.1`. O processo local usa o modo de execução de produção do Next, mas não é um deploy e não acessa a instalação de produção. Playwright 1.56.1 é instalado fora das dependências da aplicação. A interceptação do browser bloqueia origens externas, caminhos `/api/`, métodos mutantes e WebSockets, com Service Workers desabilitados. O relatório exige zero tentativas desses acessos e zero erros JavaScript.

Essa interceptação é evidência do tráfego do browser, não um firewall de toda a máquina. Os adapters e suas dependências de execução são funções locais sem transporte. Downloads de dependências e do Chromium pertencem à preparação da CI, não à execução dos robôs.

As exclusões nativas de deploy e o ignore script do R60 permanecem. Os refs exatos do R61 também estão excluídos em `vercel.json`. Nenhum merge ou deploy faz parte deste bloco.

## Evidência e reprodução

Workflow: `.github/workflows/jenios-robot-r61-qa-policy-integration.yml`.

Ele executa a bateria direcionada preservada, os testes novos R61, `npm run build` (incluindo testes gerais e Social), instala Chromium e roda `scripts/platform/research/r61-browser-acceptance.mjs` sobre o build local. O relatório de browser e screenshots ficam no artefato `r61-browser-evidence-<SHA>` da CI; o resumo JSON também é registrado no log com o marcador `R61_BROWSER_ACCEPTANCE`.

Resultados locais já observados: 9/9 testes dos assistidos, 30/30 do UltraFast e 4/4 dos gates. Os subprocessos locais têm restrição de ambiente; build e browser são verificados pelo workflow completo, sem substituir essa etapa pelo resultado local.

Checkpoint: `docs/platform/evidence/ROBOT_R61_QA_POLICY_INTEGRATION_CHECKPOINT.json`.

Relatório completo preservado no Git: `docs/platform/evidence/ROBOT_R61_BROWSER_ACCEPTANCE_EVIDENCE.json`. Ele mantém os 33 resultados individuais, runtime, gates, tentativas de rede, contagens e identificação/checksum do artefato da CI. Os arquivos de imagem e logs também constam do artefato, sujeito à retenção de 14 dias configurada no workflow.

Guia de aceite: `docs/platform/ROBOT_R61_SYNTHETIC_ACCEPTANCE.md`.

O ledger mantém o histórico R12–R59 e R60 e acrescenta `qaPolicyIntegration`, separando a nova evidência de interface da pesquisa anterior.

## Invariantes e pendências

`actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`. Ordens reais e Paper externo permanecem zero. R15 prospectivo não recebe backfill. O limiar do Híbrido/Reverso permanece 0,65. Produção não é aprovada e performance comercial não é certificada.

O R61 resolve a ausência de uma tela de teste ligada às políticas somente neste console sintético. O aceite manual do usuário ainda deve ser registrado. Integração no produto operacional, identidade e permissões de conta, dados contemporâneos de mercado, execução, fills, custos reais e rentabilidade exigem trabalho e evidência separados, com autorização própria. Nenhum resultado desta rodada pode preencher retrospectivamente essas lacunas.
