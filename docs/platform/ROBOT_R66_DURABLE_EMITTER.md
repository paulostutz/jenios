# R66 — Motor original localizado e emissor durável em QA

## Base encerrada

R65 foi conferido antes da primeira alteração: branch de pesquisa e backup certificado apontavam para `02ccf75c09702f9378a496ffb0d9cd323e21d2fc`; CI [40115691899](https://github.com/paulostutz/jenios/actions/runs/40115691899) e job `120936376996` concluídos com sucesso em 24/10/2026 às 17:25:39 UTC (14:25:39 em São Paulo). O checkpoint, ledger e guia correspondem a essa árvore. A consulta Vercel retornou zero deployments desse SHA.

As evidências R65 preservam seu SHA de origem `5044ec1f04dedf38e98024c970991068fba3bd86`. O commit consolidado e a CI final satisfazem a regra de fechamento já existente. R66 não altera essa atribuição, não reconstrói os blocos anteriores e não exige reabrir a certificação R65.

Branch isolada: `research/jenios-robot-r66-durable-emitter-20261024`.

## Dependência original encontrada

O arquivo privado consolidado `JENIOS-Platform-R45-B52-CONSOLIDADO-PRIVADO.zip` foi localizado no backup histórico. Seu SHA-256 corresponde ao manifesto original. Os bytes de `engine.mjs` e `service.mjs` também correspondem aos hashes fixados no B297:

| Módulo | SHA-256 |
|---|---|
| Engine | `9341d9243cbe742b90bf40149663e632fc472f5586c74bf70bdfcfd114e65aea` |
| Service | `cbb92005459f79bf6e23a0edc7c5542cc62b632b6c301e3f23b98ebd514ce5be` |

Reaproveitou-se o runner B297 existente, sem modificar o núcleo. O processo com leitura restrita, sem credenciais herdadas e com `fetch` bloqueado executou 12 análises sintéticas originais (quatro por modo), sete verificações de `chooseMode`, guardas de pausa/posição e cinco rejeições de risco B152. A saída foi sanitizada e salva em `evidence/ROBOT_R66_PRIVATE_ENGINE_DISCOVERY.json`. O código privado ficou fora do checkout público.

Essa dependência implementa Manual, Híbrido e Reverso. UltraFast continua no domínio separado R61/R65. O `service.analyzeRequest` original usa `compareShadowStrategies([])`; a reversão sem calibração permanece bloqueada quando aplicável. A injeção sintética de calibração em verificações diretas de `chooseMode` não comprova calibração operacional.

O caminho de conexão a reaproveitar é `captureB297OriginalDecisions({ analyzeRequest, scenarios, nowMs })`, recebendo `service.analyzeRequest` depois da verificação dos bytes. **A conexão desse callback ao ciclo R65 continua inativa.** A saída do motor privado não foi renomeada como `R61_SYNTHETIC_RUNTIME`. Uma integração futura precisa de contrato e proveniência próprios para o executável realmente utilizado.

## Persistência e retransmissão acrescentadas

`createR66DurableEmitter` envolve o emissor R65 inalterado. Sua fábrica exige opt-in explícito `R61_SYNTHETIC_RUNTIME`, fonte/escopo fixos, chave Ed25519 e diretório privado persistente. A captura continua executando os adaptadores certificados; não aceita decisão financeira fornecida pelo chamador.

1. Abertura reserva uma sessão aleatória nova de forma durável. Não há parâmetro para reutilizar sessão ou fingir restauração com `initialSequence`.
2. Captura produz a observação e sua proveniência R65. A fila valida assinatura, identidade, sequência e vínculo de operação antes de gravar.
3. Um temporário exclusivo recebe o snapshot autenticado por HMAC. `fsync`, rename atômico e sincronização do diretório antecedem o retorno da captura.
4. Capturar não envia nada. A transmissão é uma operação explícita posterior, com exclusão mútua entre processos.
5. Repetir `operationId` com a mesma entrada devolve o registro durável exato, mesmo depois de reiniciar. Entrada divergente com o mesmo identificador é recusada.
6. Cada tentativa é registrada antes do envio. A confirmação só é aceita conforme o contrato HTTP R65: `202/STORED` ou `200/ALREADY_STORED`, evento, escopo, origem e todos os limites correspondentes.
7. Se a resposta se perde após a admissão no banco, a retransmissão reutiliza assinaturas, datas, evento e sequência. O receptor pode confirmar `ALREADY_STORED`, sem uma segunda observação.
8. Registros confirmados e pendências permanecem na fila. Não há exclusão física ou compactação que remova marcadores antirreplay.

### Reinício e falhas

O histórico de runtime anterior não é restaurado. Uma abertura nova começa com uma sessão nova e exige duas novas confirmações frescas do UltraFast. Repetir uma operação antiga recupera seu registro, mas não conta como confirmação da sessão nova. A continuidade do estado de evolução é conferida contra o último estado persistido.

Se a captura avança em memória e a gravação falha, a instância é invalidada. Não é permitido continuar usando um runtime cujo último passo não teve persistência confirmada.

Os locks nunca são roubados automaticamente por tempo. Um processo encerrado entre operações duráveis pode ser reaberto normalmente. Uma queda dentro de uma seção crítica pode deixar um lock que exige recuperação explícita pelo host: confirmar a morte do proprietário e exclusão mútua, inspecionar o snapshot, preservar evidências e somente então liberar o lock. Não prometer recuperação automática de toda queda ou detecção de restauração integral de um backup antigo: isso exige uma testemunha monotônica independente.

### Expiração não é uma nova ocorrência

O contrato R64 admite a observação por até **120.000 ms**, recusando `now >= expiresAtMs`. R66 conserva esse limite. Um registro vencido passa a `EXPIRED_UNCONFIRMED`, permanece auditável e não volta à rede. Não recebe nova data, assinatura, sessão ou confirmação inventada. Pendências vencidas não impedem a fila de tentar registros posteriores ainda válidos.

Uma confirmação HTTP valida o protocolo do receptor configurado; não é atestação criptográfica independente do banco remoto. Se a resposta foi perdida e a validade já terminou, o estado local permanece incerto até reconciliação apropriada, que este bloco não inventa.

### Limites do armazenamento local

O diretório deve ser absoluto, privado `0700`, pertencente ao processo e fora do repositório. Arquivos e locks usam `0600`; symlinks, hard links, troca de proprietário, corrupção, HMAC incorreto e divergência de fonte/escopo/chave são recusados. Chaves privadas e segredo HMAC não são gravados na fila nem nos relatórios.

Limites superiores: 5.000 registros retidos, 1.024 sessões, 100 tentativas por registro e 32 MiB, além dos limites de JSON e dos adaptadores preservados. Ao esgotar um limite, a captura falha de modo fechado. Não há purga automática. O snapshot é revalidado e regravado; a capacidade de produção para milhares de decisões diárias **não foi certificada**. O host futuro precisa de armazenamento durável e dimensionamento medido, mantendo os marcadores de repetição antes de qualquer retenção física.

## Transporte local preparado

`createR66LoopbackObservationSender` aceita somente uma origem HTTP canônica com IP literal `127.0.0.1` ou `[::1]` e porta explícita. O caminho é fixado em `/api/platform/robot-evolution-observations`. Destinos hospedados, nomes DNS, credenciais na URL, caminhos adicionais e redirects são recusados.

A função confere a assinatura R65 no relógio atual, limita tamanho de requisição/resposta e aplica prazo de resposta incluindo o corpo. Ela não instala worker, não configura serviços, não é um transporte operacional e não envia a provedores ou corretoras. Um host confiável poderia fornecer outro callback explícito à fila; isso não constitui certificação nem autorização dessa conexão.

## Preparação hospedada

O roteiro completo está em `ROBOT_R66_HOSTED_ACCEPTANCE_PLAN.md`. O preflight executável `scripts/platform/research/r66-operational-preflight.mjs` analisa somente declarações e retorna código `2` para pendências. Configuração completa nunca produz `operationalReady:true`.

Ele mantém distintas as pendências de motor, host persistente, banco QA exclusivo, identidade administrativa real, agendamento, dados operacionais, eventual orçamento de provedor e aceite do proprietário. O scheduler deve obedecer a `nextAtMs`: a avaliação R65 inicia um segundo após o registro e dura dez segundos; cron por minuto pode perder a janela. Nenhum serviço foi ativado por esse roteiro.

## Evidência do bloco e fechamento

O checkpoint R66 identifica os resultados efetivamente obtidos, a origem de cada evidência e a CI de referência. O ensaio novo usa processos Node separados, servidor HTTP local com o handler R65 real e PostgreSQL descartável com os esquemas R64/R65 preservados. Ele não testa Next hospedado, Supabase hospedado, login administrativo real ou provedor. A expiração usa um avanço explícito de relógio sintético, separado das transmissões no relógio real.

A CI mantém os testes direcionados dos contratos utilizados e os gates gerais de testes/build. As baterias de navegador, janelas de evolução e arquivamento R65 não foram recriadas: as superfícies correspondentes não foram alteradas e sua certificação anterior permanece na base. Contagens unitárias, HTTP/SQL e captura privada têm naturezas diferentes; não devem ser somadas como operações de mercado.

Regra de fechamento: uma CI bem-sucedida no commit de referência gera a evidência; a documentação/ledger são consolidados preservando esse SHA. Outra CI no commit consolidado precisa passar antes da criação do backup certificado no mesmo SHA. Não inserir a CI do próprio commit num ciclo interminável de alterações documentais.

## Invariantes

Monitoramento de clientes e motor operacional conectado permanecem inativos. Política automática continua limitada ao UltraFast, `maxAgeMs` de 750 para 500, uma vez por histórico, comparação registrada e rollback auditável. Manual conserva controle integral; Híbrido/Reverso mantêm guard `0.65`; Reverso preserva seletividade e exceção de megatendência. Losseshômetro permanece hipotético. R15 sem backfill.

`actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`. Ordens reais, Paper externo e chamadas pagas: zero. Sem migração hospedada, merge, deploy ou mudança de produção. Não há certificação de rentabilidade ou ativação operacional neste bloco.

## Resultados de referência conferidos

CI [40117603673](https://github.com/paulostutz/jenios/actions/runs/40117603673) — **SUCCESS**, commit de origem `1b7b3a7d660e30f29e54c46157d5a00aa1998232`, job `120942063291`, concluída em 24/10/2026 às 17:47:26 UTC (14:47:26 em São Paulo).

| Verificação | Resultado |
|---|---:|
| Novos testes R66 | 42/42 |
| Subconjunto direcionado de contratos preservados | 249/249 |
| Testes gerais | 2.493/2.493 |
| Gate Social herdado, sem alteração do produto | 94/94 |
| Reinício/processos/HTTP/PostgreSQL R66 | 16/16 |
| Build | PASS |
| Páginas estáticas | 76/76 |
| Falhas e omitidos | 0 |

O ensaio integrado abriu seis processos do emissor, confirmou um `SIGKILL` após captura durável e realizou oito POSTs loopback. O banco terminou com sete recibos e sete proveniências, quatro robôs e duas sessões. A primeira resposta foi perdida depois do commit; o retry usou os mesmos bytes e recebeu `ALREADY_STORED`. A fila principal terminou com sete confirmações persistidas, sem pendências. A expiração foi ensaiada separadamente, com avanço explícito de relógio sintético e sem chamada do sender.

O ZIP de evidência foi baixado e seu SHA-256 conferido contra a Actions. O JSON foi copiado byte a byte para `evidence/ROBOT_R66_EMITTER_ACCEPTANCE_EVIDENCE.json`, preservando a origem acima. As 14 seções prévias do ledger foram mantidas e a nova seção `durableEmitterIntegration` foi acrescentada. Os testes específicos estão incluídos nos gerais; não somar as baterias como operações de mercado.

A primeira publicação do workflow foi recusada antes de iniciar jobs, por uso de `runner.temp` no escopo de ambiente do job. A variável foi movida para a etapa de aceitação; as tentativas `40117478963` e `40117479954` permanecem documentadas como falhas de configuração, sem testes executados. A CI de referência corrigida passou integralmente. O fechamento final ainda exige CI no commit consolidado e backup certificado correspondente, conforme a regra acima.
