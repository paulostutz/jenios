# R63 — Observação e melhoria contínua dos robôs

## Estado e autorização

Certificação **de melhoria contínua limitada à pesquisa sintética** aprovada na [CI de referência 40105983256](https://github.com/paulostutz/jenios/actions/runs/40105983256), commit `dc54bbddeb9512a12a15f801b4b6d1f6eae6046f`. Base preservada: backup R62, commit `b1703f5cce578bf13a5c5a29949f427a8247636d`, CI `40099968197` SUCCESS. O backup final exige também uma CI completa aprovada sobre o commit consolidado, conforme o checkpoint.

Em 24/10/2026 o proprietário aprovou antecipadamente melhorias automáticas que cumpram os critérios de avaliação, com relatórios periódicos no admin. A política `OWNER_PREAPPROVAL_20261024` registra essa autorização. Este bloco mantém a restrição vigente de não modificar produção, não fazer merge/deploy e não enviar ordens reais ou Paper externo.

Os detalhes técnicos das mudanças ficam no admin. Isso não dispensa transparência sobre tratamento de dados dos clientes ou alterações relevantes no funcionamento. O código registra `customerTechnicalNotifications:false` e `operationalDataDisclosureRequired:true`; ainda rejeita qualquer fonte operacional.

## Entrega concreta

1. `robot-r63-observation-study.mjs` valida e minimiza eventos, separa os quatro robôs, ordena e deduplica evidências e propõe hipóteses rastreáveis.
2. `robot-r63-continuous-evolution.mjs` registra a candidata, congela a avaliação sintética, recalcula baseline/candidata pelo R47 original e aplica uma nova configuração somente se os critérios forem satisfeitos.
3. `robot-r63-generative-analyst.mjs` aceita um provedor injetado com orçamento explícito; a saída é uma hipótese estruturada sem autoridade de execução.
4. `robot-r63-durable-journal.mjs` persiste estudo, estado e relatório em arquivo privado autenticado por HMAC. Um lock do worker serializa o ciclo inteiro antes de eventual reserva/chamada; o append tem lock e CAS próprios.
5. `robot-r63-research-worker.mjs` conecta estudo, análise opcional, avaliação, configuração ativa e relatório. O driver diário preserva a versão do dia anterior e não inventa novas melhorias.
6. O endpoint administrativo e os componentes React permitem consultar relatórios já persistidos, respeitando a autenticação exclusiva da Platform. A prévia de QA demonstra o mesmo relatório com fixtures explícitas.

## Domínio automático desta revisão

A única mudança admitida é reduzir a idade máxima de dados do controle R47 do UltraFast de **750 para 500 ms**, mantendo duas confirmações. São necessários pelo menos três episódios sintéticos distintos que sustentem a hipótese; uma violação do controle do operador suprime a proposta.

A avaliação registra previamente identificadores, idades e labels de seis ou mais casos, com pelo menos dois positivos e dois negativos. Os casos observados devem corresponder integralmente ao protocolo, ocorrer na janela virtual posterior e ser disjuntos do estudo. A promoção exige redução estrita de falsos permissivos, zero falsos permissivos remanescentes e nenhum aumento de falsos bloqueios.

A fixture positiva demonstra dois falsos permissivos na baseline e zero na candidata, com zero falsos bloqueios. Uma avaliação subsequente realmente consome a configuração de 500 ms e bloqueia o par de dados de 650 ms antes permitido pelo controle de 750 ms. Essa permissão é somente do componente R47 sintético; `orderAuthorized` continua `false`.

Uma regressão mantém a versão anterior. O rollback registra uma geração crescente, restaura a configuração anterior para decisões futuras e impede readotar automaticamente a candidata retirada. Não desfaz operações. O limite é uma promoção; 250 ms, código gerado, mudança de estratégia, alavancagem e ampliação do domínio automático são recusados.

Os seis casos não demonstram significância estatística, rentabilidade ou uma vantagem em mercado. O estudo e o pré-registro usam relógios virtuais: registro, avaliação e persistência são processados na mesma invocação real. Não representam pré-registro externo ou coleta prospectiva real. R15 permanece intacto; novas coortes operacionais exigirão IDs e evidência próprios.

## Relatórios e estágio

O fechamento previsto é diário às **09:00, America/Sao_Paulo**, sobre o dia local anterior encerrado. A chave do período impede duplicação. Execução atrasada considera somente o período encerrado atual, sem preencher retroativamente relatórios ausentes. O worker recusa períodos repetidos e estudos que voltam no tempo antes de consumir orçamento.

Cada relatório apresenta observações por robô, configuração vigente, candidatas avaliadas, melhorias aplicadas, rejeições, reversões e critérios pendentes. Estágios descritivos substituem qualquer percentual de perfeição. `completionCeilingKnown:false` é permanente nesta revisão; após a única mudança autorizada o comportamento esperado é `NO_CHANGE`, com novos relatórios e sem alegar refinamento adicional.

O serviço não foi iniciado em produção. `delivery:NOT_DISPATCHED`, `scheduledDeliveryActive:false` e `productionMonitoringStarted:false` continuam explícitos. Persistência local e leitura do endpoint não comprovam entrega em um admin publicado.

## Admin e limites de acesso

- Endpoint: `GET /api/platform/admin/robot-evolution`; não há endpoint de mutação.
- Usa `requirePlatformAdmin(...,'platform.admin')`, com `auth.getUser` do projeto exclusivo da Platform. Nenhuma sessão Social recebe acesso à nova rota.
- O gate original exige ambiente preview, ambas as flags QA verdadeiras e as três flags de execução/Paper exatamente falsas. R63 exige ainda `JENIOS_ROBOT_EVOLUTION_ENABLED=true`.
- Recurso desabilitado retorna 404 antes de consultar identidade ou disco. Falta de identidade retorna 401; permissão insuficiente retorna 403; indisponibilidade do journal retorna 503 sanitizado, sem substituir dados ausentes por sucesso.
- O cliente preserva esses status, rejeita payloads incompletos, cancela consultas na desmontagem e evita requisições sobrepostas. Nenhuma chave privada é enviada ao navegador.
- A rota `/platform/homologacao/robos/evolucao` é uma prévia sintética gated, sem contas, APIs de cliente, journal privado ou chamadas pagas.

A identidade real do proprietário e a leitura através de um admin publicado não foram exercitadas. Os testes de autorização usam identidades injetadas, com o mesmo verificador existente. O cenário positivo de navegador cobre a prévia sintética, não um login real.

## Analista generativo

O analista recebe no máximo 48 eventos minimizados, sem texto livre, credenciais, identificadores reais ou valores financeiros. A saída usa enums e referências já presentes, passa por validação e nunca concede autoridade para promoção, execução ou deploy. Uma análise com confiança alta não equivale a uma métrica comprovada.

A chamada requer habilitação, um provedor explicitamente injetado e reserva atômica de orçamento pelo host. Há uma tentativa e timeout de 10 segundos. O contrato solicita no máximo 700 tokens de saída; o adaptador do provedor deverá impor esse limite e respeitar a reserva de orçamento do host. Este módulo limita a resposta a 16.000 caracteres e não mede consumo de tokens. O worker pode exigir uma hipótese admitida do analista e ainda submete a candidata à avaliação determinística independente. Erro, resposta inválida, falta de orçamento ou proposta fora do domínio não permite evolução.

Nenhum provedor pago foi conectado ou acionado neste bloco. As respostas de teste usam provedores injetados. O resultado da análise é retornado pelo worker, mas respostas e identidade do provedor ainda não compõem o registro durável; isso precisará de integração e auditoria próprias antes de ativar um analista operacional.

## Worker e persistência local

O comando `node scripts/platform/research/r63-research-worker.mjs --once` processa uma execução; `--watch` inicia um processo local explícito que verifica o horário a cada minuto, sem sobrepor ciclos. Ambos processam fixtures, não usuários. A CLI não instancia um fornecedor generativo. Nenhum dos comandos é configurado como cron de produção por este commit.

O host precisa fornecer `JENIOS_ROBOT_EVOLUTION_JOURNAL_DIR` (diretório absoluto já existente, privado 0700, fora do repositório) e `JENIOS_ROBOT_EVOLUTION_JOURNAL_KEY` (64 caracteres hexadecimais secretos), além dos gates. A chave nunca vai para git, logs ou navegador. O arquivo e locks são 0600, com owner verificado, sem symlinks/hard links. Há escrita temporária exclusiva, fsync e rename atômico, HMAC e reconstrução semântica de cada registro.

O armazenamento tem limite de **100 registros e 8 MiB**; atingi-lo bloqueia a escrita sem apagar histórico. Locks abandonados bloqueiam novos ciclos até revisão, sem roubo automático. Reposição integral por um backup antigo ainda validamente assinado requer uma testemunha monotônica externa para detecção; o journal local não oferece essa garantia. Para produção distribuída será necessário um armazenamento durável adequado ao host, uma política de retenção e integração autorizada. O diretório temporário da Vercel não é apresentado como solução durável.

## Verificação e continuidade

A CI de referência terminou com todos os critérios aprovados. Os 135 testes novos R63 estão incluídos nas baterias abaixo; não são uma amostra de operações financeiras.

| Verificação | Resultado observado |
| --- | --- |
| Direcionados R12–R63 | 442/442 PASS |
| Regressão geral | 2.248/2.248 PASS |
| Social | 94/94 PASS |
| Build | PASS |
| Páginas estáticas | 76/76 |
| Navegador | 52/52 PASS: 41 preservados + 11 R63 |
| Falhas, testes omitidos e erros de página | 0 |
| Tentativas externas/API/mutações/WebSocket pelo navegador | 0 |

O navegador verificou promoção, rejeição de regressão, rollback, invalidação de resultados editados, ausência de promoção sem evidência, proteção do controle manual, acesso administrativo negado sem identidade e gates de habilitação. A captura R63 em celular foi revisada; não houve transbordamento em 375 ou 320 pixels. Os nove avisos HTTP 404 correspondem às rotas intencionalmente desabilitadas. As duas verificações HTTP do admin foram leituras loopback sem credenciais; não se afirma isolamento de rede de todo o host.

O ciclo persistido demonstrou duas entradas em períodos distintos: repetição idempotente retornou `ALREADY_STORED`; o dia seguinte preservou 500 ms e registrou zero novas melhorias. A candidata que aumentava falsos bloqueios foi rejeitada. Os cenários sem evidência suficiente ou com violação do controle retornaram `NO_CHANGE`.

A [primeira tentativa, CI 40105575123](https://github.com/paulostutz/jenios/actions/runs/40105575123), passou nos testes mas falhou no build: webpack interpretou uma URL de diretório do journal como dependência de asset. A correção usa resolução de caminho pelo filesystem, preserva as proteções de diretório e passou em cinco verificações específicas e nesta CI completa. O histórico da falha permanece no checkpoint; o navegador daquela tentativa não foi executado.

Evidências preservadas no repositório:

- [Checkpoint R63](evidence/ROBOT_R63_CONTINUOUS_IMPROVEMENT_CHECKPOINT.json).
- [Ciclo de evolução e persistência](evidence/ROBOT_R63_CONTINUOUS_IMPROVEMENT_EVIDENCE.json).
- [Aceitação de navegador](evidence/ROBOT_R63_BROWSER_ACCEPTANCE_EVIDENCE.json).
- [Ledger consolidado](evidence/ROBOT_MASTER_PERFORMANCE_LEDGER.json), com uma seção R63 adicionada e os campos históricos intactos.

O artefato `12565090236` foi baixado e seu SHA-256 conferido: `135130f1a767ac6ebea3c595ed9bf76fbb575a08af12ea5569cfa7585f1e0fb8`. As capturas e logs do artefato ficam retidos até 07/11/2026; os dois relatórios JSON são mantidos em git. A consulta da Vercel para o commit de referência retornou zero deployments.

A consolidação mantém o SHA original de cada evidência e repete a CI completa sobre o commit consolidado. Só então é criado `backup/jenios-robot-r63-continuous-improvement-certified-20261024`. O ref desse backup e sua execução correspondente no Actions identificam o commit final, evitando atribuir a evidência de um commit a outro.

Permanecem fora da certificação: operações de clientes, feed/contas/fills externos, identidade real do admin, serviço generativo pago, implantação/monitoramento de produção e desempenho comercial. Os campos `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem nulos; ordens reais e Paper externo permanecem zero.
