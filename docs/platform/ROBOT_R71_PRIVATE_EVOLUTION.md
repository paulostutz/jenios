# R71 — estudo e evolução limitada do runtime privado

## Fechamento e base preservada

O R71 conecta as observações contextuais do motor privado ao estudo completo, à avaliação prospectiva, à aplicação durável de uma política externa permitida e ao rollback administrativo. A integração foi verificada em QA com o core original, PostgreSQL descartável e endpoints reais do Next. O monitoramento de clientes e a operação hospedada continuam inativos.

A retomada consultou o backup certificado R70, seu checkpoint, ledger, SHA `851804aa45ac8cee2aea4fe9096712a7aeff2048` e CI `40129546998` antes de alterar arquivos. R59–R70 não foram reconstruídos. Os 19 campos/seções anteriores do ledger foram preservados; o fechamento R71 foi acrescentado em `privateEvolutionIntegration`.

| Referência | Identificação |
|---|---|
| Branch de pesquisa | `research/jenios-robot-r71-private-evolution-20261024` |
| Backup de progresso | `backup/jenios-robot-r71-private-evolution-progress-20261024` |
| Backup certificado | `backup/jenios-robot-r71-private-evolution-certified-20261024` |
| SHA produtor das evidências | `5b32d99812eb61a37b4058951d15d531260edfe9` |
| CI de referência | [40135386515](https://github.com/paulostutz/jenios/actions/runs/40135386515) — SUCCESS |
| Job da referência | `120995700981` |
| Conclusão da referência | 2026-10-24T21:46:58Z (UTC) |

Os JSONs de referência mantêm o SHA que os produziu. O commit que consolida documentação, evidências e ledger passa por nova CI antes de receber o backup certificado. A coincidência entre SHA final da CI, pesquisa e backup fecha este checkpoint; não é necessário um novo commit apenas para inserir o número da própria CI.

## Lacuna corrigida sem alterar o core original

O core privado histórico já possui `chooseMode({positionOpen, ...})`. O `service.analyzeRequest` inspecionado não encaminha esse contexto. A alteração R71 versiona esse encaminhamento em um wrapper externo, usando `analyzeRequest` e `chooseMode` originais dentro da mesma VM cuja identidade e bytes são conferidos pelo loader.

O scan, a calibração e o estado de carga usados nessa segunda chamada vêm exclusivamente da resposta original. O comando externo não fornece funções, código, parâmetros financeiros nem um booleano que escolha a política ativa. A fonte consulta a versão persistida e autentica a resposta vinculada ao desafio R70.

Os bytes proprietários permanecem fora do repositório:

| Arquivo original | SHA-256 preservado |
|---|---|
| `engine.mjs` | `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea` |
| `service.mjs` | `cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be` |

Versão histórica: `jenios-research-r29.1`. O registro nativo R67 mantém literalmente `private:r67-v1`, geração `0`. A versão e a geração externas R71 aparecem em anotação assinada separada. `internalCoreRetuning=false`.

O core privado localizado oferece Manual, Híbrido e Reverso. UltraFast segue o caminho certificado R61/R65. O R71 não transfere ao core histórico o guard 0,65 dos adaptadores R61, nem amplia a política UltraFast 750→500 ms.

## Única política automática autorizada neste bloco

`HONOR_EXISTING_POSITION_CONTEXT_FOR_ASSISTED` permite `forwardPositionOpen: false → true`, exclusivamente para Híbrido/Reverso em QA sintético.

| Regra | Comportamento |
|---|---|
| Referência | `private:r71-reference-v1`; não encaminha o novo contexto |
| Candidata | `private:r71-position-context-v1`; encaminha posição aberta assistida |
| Caso assistido aberto e não pausado | Resultado permitido: `manage_existing_position`, `side:null`, `mayClose:true` |
| Manual, posição fechada ou pausa | Decisão original preservada integralmente no helper de execução |
| Elegibilidade | Ao menos três contextos sem encaminhamento na referência, abrangendo Híbrido e Reverso, na geração ativa |
| Comparação | Oito casos fixos, registrados antes da janela; nenhum caso retroativo |
| Aplicação | Referência com falhas de encaminhamento >0, candidata com zero, zero alterações nos protegidos e zero resultados fora da política |
| Limite | Uma avaliação e no máximo uma promoção por histórico |
| Rejeição | Não aplica; retira a candidata daquele histórico |
| Rollback | Restaura a referência, aumenta a geração e retira a candidata |

A métrica `missedExistingPositionRouting` descreve o encaminhamento de um contexto sintético. Ela não mede ordens evitadas, perdas evitadas, acurácia de trades ou lucro. Manual permanece sob controle do operador.

## Persistência, estudo e retransmissão

A admissão R71 chama a admissão R67 e grava a anotação na mesma transação. Um registro nativo já existente sem anotação não pode receber contexto retroativo. Repetição exata preserva os recibos originais; conflito não deixa meio par no banco. As assinaturas Ed25519 são verificadas na aplicação; o SQL verifica forma, identidade, referências e regras independentes, sem afirmar verificação criptográfica própria. `service_role` continua uma identidade confiável com bypass de RLS.

O banco escolhe os instantes de admissão após os locks, revalida a janela depois da operação nativa e preserva o primeiro instante no retry. A revisão/digest e a versão que autorizaram a captura precisam existir. A assinatura da fonte não é atestação independente de seu relógio ou host.

O estudo congela uma lista de membros em uma única seleção MVCC e pagina por ordinal. Não depende da consulta administrativa dos últimos 30 registros nem de um corte apenas por horário. Cada página reconfirma o cabeçalho, contagens e digest; o coletor verifica todas as assinaturas no instante original de admissão e reconstitui os fatos e métricas. A hash dos membros usa texto JSONB PostgreSQL, explicitamente distinto do JSON canônico das assinaturas.

Somente pares contextuais R71 entram nesse estudo. Capturas R67 históricas sem contexto permanecem preservadas e não ganham significado novo. Lotes de validação são contados separadamente e não justificam a própria hipótese.

A fila persiste o registro completo antes do envio, incluindo as assinaturas e o último estado externo consumido. Após reinício, o retry usa o mesmo registro e não executa o core novamente. Revisões/gerações antigas são recusadas. Isso não restaura a memória interna do runtime histórico. Não há roubo automático de lock órfão; restauração de todo o diretório ainda exige testemunha monotônica independente.

Limites fechados: 256 lotes e 8.000 entradas por snapshot, páginas de dez lotes, 32 revisões de estado, estado de até 8 MiB, registro de até 512 KiB, validade assinada de 120 segundos. Os limites se aplicam em conjunto e rejeitam excesso; não há truncamento silencioso nem renovação de prazo no retry. Os registros originais e o histórico são mantidos. Não foi criada purga física R71.

## Provedor, worker e administração

O contrato de hipótese admite apenas a proposta externa acima, vinculada ao digest do estudo e com status `PROPOSED_NOT_APPLIED`. Não aceita código, alavancagem ou outro ajuste financeiro. O caminho efetivamente exercitado usa `BOUNDED_DETERMINISTIC_POLICY`; o contrato preparado não é uma integração generativa ativa. Geração paga e chamadas a provedores permanecem em zero.

Entradas explícitas:

| Superfície | Finalidade |
|---|---|
| `/api/platform/robot-private-policy-observations` | Admissão assinada R71 |
| `/api/platform/robot-private-evolution-state` | Consulta assinada da versão e plano, domínio próprio mais desafio R70 |
| `/api/platform/admin/robot-private-evolution` | Relatório, avanço do ciclo e rollback por administrador Platform |
| `/api/platform/internal/robot-private-evolution` | Tick com token exclusivo do scheduler |
| `/platform/homologacao/robos/privado` | Painel administrativo privado de QA |
| `scripts/platform/research/r71-cycle-worker.mjs` | Worker por invocação explícita |
| `scripts/platform/research/r71-private-host.mjs` | Perfil fechado que reaproveita lifecycle, custódia e locks R68 |

O opt-in R71 exige todos os gates QA R67 e `JENIOS_ROBOT_R71_ENABLED=true`. O scheduler usa `JENIOS_ROBOT_R71_SCHEDULER_TOKEN`, diferente do token R65. Mutações administrativas com Origin são comparadas a `JENIOS_ROBOT_R71_ADMIN_ORIGIN`; Host e Forwarded não escolhem a origem confiável.

A CLI aceita `--check`, `--once` ou `--watch`, sempre com `--config <manifesto>`. `--check` é offline. Os demais modos só podem atuar com gates, custódia e pins válidos; nenhum serviço foi registrado ou iniciado de forma hospedada. A captura de validação usa os oito casos do plano fechado, dentro da janela, e não recebe instruções executáveis do servidor.

O painel usa somente a sessão Platform, sem fallback Social. O HTML anônimo contém um shell sem relatório; dados entram pelo endpoint autenticado. Saída ou troca de usuário elimina o relatório. Capturas completas, assinaturas, chaves, entradas detalhadas do estudo e identidade dos atores não são enviadas ao feed. Uma janela incompleta mostra métricas não medidas como `null`.

## Resultado integrado de referência

A aceitação privada ocorreu em 24/10/2026, das 18:43:41.372 às 18:44:16.258 de Brasília (21:43:41.372–21:44:16.258 UTC), no SHA de referência limpo. O build local desse SHA também começou limpo e passou antes da aceitação.

O caminho foi: fonte/emissor reais → HTTPS local com validação TLS → endpoint Next → SDK Supabase → gateway local explicitamente simulado → PostgreSQL descartável. O navegador fez GET e rollback nos endpoints reais do ensaio, com sessão administrativa explicitamente simulada.

- 40 análises dos bytes originais, em cinco lotes nativos R67 e cinco lotes contextuais R71; zero capturas modeladas nesse modo privado.
- Perda de ACK depois do commit, reinício e retransmissão exata, sem análises adicionais para repetir a operação.
- Plano de oito casos registrado antes da janela; os oito foram capturados e admitidos dentro dela, usando relógio real do PostgreSQL.
- Comparação: três contextos sem encaminhamento na referência → zero na candidata; zero alterações nos protegidos e zero resultados fora da política.
- Aplicação durável na geração 1 e consumo pela instância privada; rollback administrativo pelo navegador e consumo da referência na geração 2 pela mesma instância.
- A candidata terminou retirada naquele histórico. Outro histórico perdeu a janela e foi rejeitado como incompleto, sem fabricação de casos.
- Quatro snapshots, nove revisões e 75 RPCs reais no ensaio. Sete requisições HTTP de observação incluem retry e uma recusa com gate desligada; correspondem a cinco admissões.
- Navegador em 320 px sem overflow, erros de página, erros de console, WebSockets ou requisições externas. Dois GETs administrativos e um POST de rollback.

O processo persistente do aceite usa fonte/emissor reais, mas não é a CLI do host; o JSON preserva `privateHostCliExercised=false`. A CLI foi exercitada separadamente com TLS/receptor/estado modelados, sem PostgreSQL/Next, e esse smoke não é reatribuído ao aceite integrado.

## Baterias e origem das evidências

| Bateria de referência | Resultado | Limite da conclusão |
|---|---:|---|
| Novos testes R71 | 78/78 | Protocolo, fila, estudo, estado, acesso, HTTP, host, transporte, banco e guards |
| Subconjunto preservado R65–R70 + guard R60 | 345/345 | Contratos anteriores exercitados; não recertificação financeira |
| Testes gerais | 2.741/2.741 | Incluem os direcionados |
| Gate herdado da aplicação | 94/94 | Preservação; nenhum código do outro produto foi alterado |
| PostgreSQL R71 na CI | 21/21 | Fixture pública, concorrência e relógio reais |
| Next/SDK/PostgreSQL/navegador público na CI | 14/14 | `PUBLIC_PROTOCOL_FIXTURE_NO_PRIVATE_EXECUTION` |
| Integração local com core original | 14/14 | Execução original com entradas e posições sintéticas |
| Build / páginas estáticas | PASS / 76/76 | Sem deploy |
| Falhas / omitidos | 0 / 0 | Referência bem-sucedida |

As contagens se sobrepõem. Não somar baterias, capturas, RPCs ou requisições como operações independentes de mercado.

O PostgreSQL também demonstrou 33 lotes em quatro páginas, commit tardio entrando somente no snapshot seguinte de 34 lotes, digest JS igual ao JSONB real, CAS concorrente, recusa de janela vencida após espera por lock, histórico de três casos incompleto e recusa integral de 257 pares acima da capacidade. O ator de rollback no teste SQL é uma fixture administrativa, não identidade real.

Evidências persistidas:

- `docs/platform/evidence/ROBOT_R71_POSTGRES_ACCEPTANCE_EVIDENCE.json`
- `docs/platform/evidence/ROBOT_R71_PUBLIC_EVOLUTION_ACCEPTANCE_EVIDENCE.json`
- `docs/platform/evidence/ROBOT_R71_PRIVATE_EVOLUTION_ACCEPTANCE_EVIDENCE.json`
- `docs/platform/evidence/ROBOT_R71_TARGET_INVENTORY.json`
- `docs/platform/evidence/ROBOT_R71_PRIVATE_EVOLUTION_CHECKPOINT.json`
- `docs/platform/evidence/ROBOT_R71_CHANGE_AUDIT.json`
- `docs/platform/evidence/ROBOT_MASTER_PERFORMANCE_LEDGER.json`

Dois erros locais de implementação SQL — alias ambíguo e precedência de operadores JSONB — foram corrigidos antes do aceite completo. Os aceites integrados público e privado passaram na primeira tentativa. A instalação local do Chromium recuperou um download truncado usando o segundo CDN oficial; não foi uma falha funcional do ciclo. As revisões cruzadas não encontraram bloqueador residual.

## O que continua pendente para operação hospedada

O inventário autenticado e somente leitura confirmou zero deployments do SHA R70 e do SHA de referência R71 no projeto `jenios-ecossistem`. A lista global de metadata de variáveis continua truncada; a consulta vazia de overrides da branch R70 não prova variáveis herdadas. Nenhum valor secreto foi consultado. Esses fatos estão registrados sem declarar o ambiente completo.

As buscas anteriores localizaram o core original e sua conexão local foi comprovada. Os artefatos de planejamento e do observador Paper não estabelecem um host operacional privado aceito. Continua necessário aceitar host persistente, volume, custódia, exclusão mútua e testemunha de rollback do diretório.

Os próximos passos são de homologação operacional: aceitar um alvo QA isolado com equipe/projeto/repositório/SHA/deployment/URL exatos; completar o inventário de configuração; aplicar os esquemas revisados em escopo hospedado autorizado; executar matriz de identidade administrativa real; vincular host e scheduler; e homologar origem de dados operacionais e autorização do proprietário antes de clientes ou custos. Esta retomada proíbe deploy e migração hospedada, portanto essas ações não foram executadas.

Não houve merge, deploy, mudança de produção, migração hospedada, ordem real, Paper externo, chamada paga a provedor ou ativação de monitoramento de clientes. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`. Rentabilidade e performance comercial não estão certificadas.
