# R70 — conferência do receptor antes de capturar ou transmitir

## Base e lacuna concreta

Base consultada antes das alterações: R69 certificado, commit `151211d7c3c95c15fbb6650a53069657180d862c`, branch `research/jenios-robot-r69-https-integration-20261024` e backup `backup/jenios-robot-r69-https-integration-certified-20261024`. A CI `40126997344`, job `120970454480`, terminou com SUCCESS em 24/10/2026 às 19:51:15 UTC. Checkpoint e ledger coincidem; os dois refs consultados apontam para o mesmo SHA. R69 está encerrado e suas evidências de referência conservam o SHA que as produziu.

O remetente R69 valida TLS e assinaturas, mas seu primeiro contato já envia o registro completo. R70 introduz uma conferência anterior, autenticada pela chave da fonte, que não contém decisões, cenários, proveniência de execução ou feed. Ela compara a configuração declarada pelo receptor com identificadores fixados separadamente. Não reconstrói o motor, a fila, a admissão R67 ou o ciclo R65.

Pesquisa: `research/jenios-robot-r70-target-preflight-20261024`. Backups: `backup/jenios-robot-r70-target-preflight-progress-20261024` e, após a CI final, `backup/jenios-robot-r70-target-preflight-certified-20261024`. As três referências são excluídas de deploy.

## Duas verificações distintas

### Metadados externos do deployment

O comparador de snapshots recebe dados explícitos e verifica consistência. Sua classificação é sempre `PROVIDED_SNAPSHOT_COMPARISON_ONLY`. Um JSON importado não se transforma em consulta autenticada ou aceite operacional por conter flags como `live`, `verified` ou `authorized`.

Para o perfil Vercel, a verificação deve comparar deployment, projeto, equipe, SHA completo, repositório GitHub, estado READY e origem exata devolvida em `deployment.url`. Preview exige a propriedade `target` presente e com valor JSON `null`; a ausência desse campo é evidência insuficiente. Uma URL de branch ou um domínio mutável não substitui a URL do deployment selecionado. Um sufixo `.vercel.app` sozinho não comprova que a URL seja única ou aprovada.

A coleta real deste bloco foi feita pelo conector autenticado da Vercel, somente em leitura, com projeto, equipe e SHA R69 exatos e sem filtrar target ou estado. Às 20:02:08 UTC de 24/10/2026, a resposta completa continha zero deployments. O registro de aquisição fica separado do objeto submetido ao comparador. O comparador executado devolveu `BLOCKED_CERTIFIED_SHA_NOT_DEPLOYED`, com código de saída 2: nenhum destino é substituído por B291QA, produção, outro SHA ou o deployment mais recente.

Referências primárias: [API de consulta de deployment](https://vercel.com/docs/rest-api/reference/endpoints/deployments/get-a-deployment-by-id-or-url), [URLs geradas](https://vercel.com/docs/deployments/generated-urls) e [variáveis de sistema](https://vercel.com/docs/environment-variables/system-environment-variables). O inventário global de variáveis da Vercel obtido no R69 continua marcado como truncado; este bloco não o apresenta como configuração completa nem lê segredos para contornar essa limitação.

### Desafio ao processo alcançado por HTTPS

O novo endpoint é `/api/platform/robot-private-target-preflight`. Ele recebe POST por transportar um desafio assinado, mas seus efeitos são somente de leitura: não consulta banco, não usa SDK Auth, não cria sessão de runtime ou outbox e não executa o core.

O desafio usa um domínio Ed25519 próprio R70, separado dos domínios de observação e proveniência R67. Inclui nonce aleatório de 32 bytes, instante de emissão, validade de 15 segundos e todos os identificadores esperados. A chave privada deve corresponder à fonte configurada. O cliente gera um novo nonce em cada chamada efetiva. O corpo é limitado a 4.096 bytes e a resposta a 8.192 bytes; o motor TLS e o deadline total são os existentes do R69.

Os identificadores fixados usam `JENIOS_R70_TARGET_PINS_V1`, com exatamente oito campos: `schema`, `origin`, `projectId`, `deploymentId`, `commitSha`, `scopeId`, `sourceId`, `sourceKeySha256`. Eles são configuração declarada; não contêm uma autorização operacional nem uma atestação do provedor.

O receptor calcula sua resposta a partir de `VERCEL_DEPLOYMENT_ID`, `VERCEL_PROJECT_ID`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_URL` e da fonte R67 configurada. Exige gates QA, `JENIOS_ROBOT_R70_PREFLIGHT_ENABLED=true` e os ambientes Vercel preview. Valores ausentes ou incompatíveis causam recusa. `Host`, `Forwarded` e os valores esperados enviados pelo chamador não escolhem a identidade observada do servidor.

O cliente confere nonce, digest do pedido, prazo e todos os identificadores. A tolerância máxima para diferença futura de relógio é um segundo. A resposta não prolonga o prazo do desafio. Uma assinatura do domínio R67 não autentica um desafio R70.

O pré-voo aceita somente origem HTTPS canônica em `.vercel.app` ou loopback literal para o aceite local. Origem local é identificada como `LOCAL_TLS_ACCEPTANCE_FIXTURE`. A seleção da URL efetiva do deployment no control plane continua uma etapa separada. Não há redirect, TLS desativado, agente, CA, headers, proxy ou função de transporte injetável pelo manifesto.

O resultado permitido é **configuração compatível com os identificadores fixados, respondida recentemente pelo peer TLS**. Permanecem falsos `remoteQaDeploymentVerified`, `independentRuntimeAttestation`, `hostedAuthenticationCertified` e `operationalReady`. O protocolo não verifica instalação de esquema, identidade administrativa, isolamento do projeto, custódia do host ou desempenho financeiro.

O receptor não mantém um cache durável de nonces. Repetir um desafio ainda válido não cria estado ou observação; a proteção do cliente contra outra resposta está na combinação de nonce novo, digest, prazo e identificação exata. Não se apresenta isso como proteção durável contra replay de operações.

## Integração com o host existente

O perfil R70 compartilha o ciclo de vida R68/R69 e reutiliza o loader original, o lease, a fila e o remetente observacional R69. R68 e R69 mantêm seus manifestos, gates, relatórios e comportamentos existentes.

O manifesto `JENIOS_R70_PRIVATE_HOST_CONFIG_V1` acrescenta `targetPinsFile` aos dez campos existentes. Esse arquivo contém somente os oito identificadores fixados e deve atender à custódia 0600 existente. Origem, escopo, fonte e fingerprint precisam coincidir com o manifesto e a chave efetiva. Não há opção de callback, sender, script ou perfil arbitrário.

Além dos gates R67/R68/R69, a execução exige `JENIOS_ROBOT_R70_PREFLIGHT_ENABLED=true`. `--check` permanece offline: inspeciona arquivos, hashes, configuração e o doctor sem contato ao receptor, VM, sessão ou captura. Seus identificadores são descritos como declarados, e não como verificados remotamente.

Na execução, o primeiro pré-voo ocorre sob o lease e antes do loader e do emissor. Após a espera de rede, parada, gates e posse do lease são conferidos novamente. O pré-voo também antecede capturas em novos ticks e cada início de `flush(limit:1)`. Uma recusa nessa etapa não entra no emissor, não consome uma tentativa de entrega e não transforma um registro em `UNCERTAIN`.

O POST observacional continua no sender R69 e preserva a verificação do prazo R67 imediatamente antes do envio. O pré-voo não renova os 120 segundos do registro, não reassina eventos expirados e não restaura histórico interno do runtime. Locks órfãos continuam retidos; não existe desbloqueio ou recuperação automática.

## Aceite focado

O aceite R70 é voltado à nova barreira de destino. Executa a rota Next real sob TLS local e identifica os metadados de deployment como simulados. Os modos `PUBLIC_PROTOCOL_FIXTURE` e `ORIGINAL_PRIVATE_CORE` são explícitos; o privado exige os bytes originais verificados e a CLI real, sem fallback.

A confirmação observacional do ensaio usa um receptor de protocolo volátil, identificado como `VOLATILE_PROTOCOL_SINK_NOT_DATABASE`. Esse receptor não é PostgreSQL, Supabase ou comprovação de persistência de banco. O R69 já examinou Next/SDK/RPC/PostgreSQL; essa certificação é preservada, sem repetir uma bateria SQL ou financeira para validar o desafio R70.

Os ensaios preliminares demonstraram a recusa antes de loader/sessão/captura/envio, a passagem de um alvo compatível pelo novo endpoint, a retenção do registro pendente quando o pré-voo falha antes do flush e a retransmissão dos bytes originais após uma resposta compatível. O privado também demonstrou SIGTERM durante o primeiro pré-voo, encerrando antes de iniciar a VM e liberando o lease; isso não é uma nova certificação de interrupção em todas as fases. Testes unitários cobrem assinatura, domínio, nonce, tempo, identificadores, gates e limites. Nenhuma dessas entradas representa operações de clientes ou rentabilidade.

Os resultados finais, versões, digests e contagens observadas são registrados no checkpoint, no audit e nas evidências de referência. As baterias se sobrepõem e não devem ser somadas como operações independentes de mercado.

## Pesquisa do host persistente

A pesquisa complementar confirmou mecanismos reutilizáveis: custódia e lease por arquivo R68, doctor somente leitura, kernel durável R66/R67, supervisor R68 e lease transacional dos ciclos R64. O exemplo B214 pertence a outro observador Paper. O fencing R45/R46 é um modelo sintético; B218 é um gate de ambiente. Nenhum deles foi reclassificado como exclusão externa de todos os escritores do host privado.

Assinatura e HMAC não detectam, sozinhos, restauração integral de um diretório antigo legítimo. O witness necessário precisa ter autoridade e persistência independentes desse domínio de restauração. Não foi criado outro arquivo local chamado witness nem introduzido desbloqueio com base apenas em PID ou timeout.

O host persistente real, sua custódia, o volume, a política de recuperação e a autoridade externa ainda precisam ser identificados e aceitos. A coleta de processos/mount foi mantida fora deste bloco para não apresentar fatos deste ambiente temporário como prova daquele host. A matriz de identidade administrativa real já preparada no R68 permanece pendente; não foi criado outro runner Auth.

## Preservação e fechamento

O ledger recebe somente `targetPreflightIntegration`, preservando os 18 campos/seções anteriores. Protocolos e esquemas R64/R65/R67, estratégias, política automática UltraFast, guardas certificados R61 e evidências anteriores permanecem preservados. O core original histórico não recebe por associação o guarda de 0,65 dos adaptadores certificados nem a política automática UltraFast.

`actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`. Ordens reais, Paper externo, chamadas pagas, migrações hospedadas e clientes observados: zero. Nenhum merge, deploy, serviço instalado ou alteração de produção é realizado. O losseshômetro continua hipotético/sintético e R15 não recebe backfill.

As evidências de referência mantêm o SHA que as produziu. Após a CI de referência e o aceite privado limpo, consolidar os documentos, executar a CI final e criar o backup certificado no mesmo SHA. A correspondência entre a CI final, a branch e o backup fecha o checkpoint, sem commits recursivos para inserir a CI do próprio commit.

## Verificação preliminar salva

- Direcionados R65–R70 e guarda R60: **345/345 PASS**, incluindo 38 casos novos R70 e 307 preservados. Após alinhar a origem do comparador à regra fechada do protocolo, os oito casos de snapshot passaram novamente.
- Aceite público: **7/7 PASS**, concluído às 20:11:20 UTC de 24/10/2026.
- Aceite original privado: **8/8 PASS**, concluído às 20:12:05 UTC. Cinco invocações reais da CLI, um SIGTERM, dez desafios e duas requisições de observação. Três decisões originais sintéticas foram capturadas uma única vez; a retransmissão não executou novas decisões.
- A recusa antes do flush conservou o registro e a tentativa `UNCERTAIN`; a tentativa seguinte recebeu `ALREADY_STORED` e terminou `ACKNOWLEDGED`, com o mesmo corpo HTTP.

Esses resultados preliminares usam a árvore de trabalho R70 sobre o SHA-base R69 e não substituem a evidência de referência no commit limpo. A primeira tentativa pública falhou na fixture por omissão de `nowMs`; a correção e as demais tentativas de teste estão registradas em `ROBOT_R70_CHANGE_AUDIT.json`. A CI de referência e a execução privada limpa posteriores passaram; seus resultados estão abaixo. A CI final do commit consolidado e o backup no mesmo SHA continuam sendo a regra de fechamento.

## Referência validada e fechamento

Commit de referência: `c7e552b2163b7bd61c52e64ace3246796d81b2e5`.

CI de referência: [40129241284](https://github.com/paulostutz/jenios/actions/runs/40129241284), job `120977202658`, **SUCCESS**, concluída em 24/10/2026 às 20:21:15 UTC. Os logs completos foram examinados para conferir as contagens, os gates, o build e o aceite público.

| Verificação | Resultado observado |
| --- | ---: |
| Direcionados R70 | 38/38 PASS |
| Contratos R65–R69 e guarda R60 preservados | 307/307 PASS |
| Gerais do build | 2.663/2.663 PASS |
| Gate herdado da aplicação, sem alterações de outro produto | 94/94 PASS |
| Aceite público do desafio Next/TLS | 7/7 PASS |
| Aceite local com CLI e core privado original | 8/8 PASS |
| Build / páginas estáticas | PASS / 76/76 |
| Falhas finais / casos omitidos | 0 / 0 |

O build local do commit limpo terminou às 20:20:22 UTC; o aceite original privado terminou às 20:20:41.770 UTC. A CI pública terminou seu aceite às 20:21:07.396 UTC. As duas evidências têm `sourceTreeDirty=false`, o mesmo SHA de origem e 16 digests de implementação conferidos contra os arquivos do commit. A CI pública não executou o core privado.

No privado, dez pré-voos resultaram em oito respostas compatíveis e duas recusas por divergência. Houve cinco invocações da CLI, um SIGTERM, três decisões originais sintéticas e duas requisições de observação. A outbox manteve uma tentativa `UNCERTAIN` quando o pré-voo antes de flush foi recusado; a retomada confirmou a segunda tentativa com `ALREADY_STORED`, transmitindo os mesmos bytes e executando zero decisões novas. O receptor continuou sendo um Map volátil explicitamente identificado, com uma entrada e três capturas; não é recibo de banco.

As evidências foram persistidas sem reserialização ou reatribuição:

- `ROBOT_R70_PUBLIC_PREFLIGHT_ACCEPTANCE_EVIDENCE.json`: 11.152 bytes; SHA-256 `c21712ef8031da2890a1409eabd24f9e9dd9b603d4c52b9fc94d0fb364c98e64`.
- `ROBOT_R70_PRIVATE_PREFLIGHT_ACCEPTANCE_EVIDENCE.json`: 18.732 bytes; SHA-256 `70016586bf14a2cd59aa345b79f93c1a80593df9d107659dfa1493e89b83822f`.

O ZIP público de Actions, artefato `12574206424`, tinha 4.221 bytes e SHA-256 `6793432b5daff7a6bb67a0e31dc58cff77254c337ed35041e7d01868749ea195`, conferido antes da cópia. Seu prazo de retenção no Actions não afeta os JSONs agora salvos no repositório.

A consulta da Vercel também retornou zero deployments do commit de referência R70. O resultado real anterior para o R69 continua em `ROBOT_R70_CONTROL_PLANE_EVIDENCE.json`; nenhuma dessas consultas escolheu um alvo alternativo ou iniciou captura remota.

Este fechamento consolida somente documentação, checkpoint, auditoria, ledger e os dois JSONs de referência. A implementação é idêntica à do commit de referência. A certificação fica fechada quando a CI final do commit consolidado passar e `research/jenios-robot-r70-target-preflight-20261024` e `backup/jenios-robot-r70-target-preflight-certified-20261024` apontarem para esse mesmo SHA. Não inserir a CI do próprio commit mediante uma nova sequência de commits; os JSONs conservam a origem `c7e552b2163b7bd61c52e64ace3246796d81b2e5`.
