# R65 — Ciclo de evolução, versões e operações duráveis em QA

## Estado e base preservada

Implementação em validação. Os resultados observados e a execução de referência serão registrados no checkpoint antes da certificação final. Um backup certificado só pode apontar para o commit consolidado depois de sua CI completa concluir com sucesso.

Base consultada: `backup/jenios-robot-r64-operational-integration-certified-20261024`, commit `58e1699ee1d01bdefb71ea969f360d278605732f`, CI `40110326680` concluída com sucesso. R64 preservado: 519 direcionados, 2.325 gerais, 94 Social, 32 PostgreSQL, 52 casos de navegador preservados, 31 casos de integração de runtime, build aprovado e 76 páginas.

Branch R65: `research/jenios-robot-r65-evolution-cycle-20261024`.

Backup final previsto: `backup/jenios-robot-r65-evolution-cycle-certified-20261024`.

## O que o ciclo conecta

1. Um emissor com chave Ed25519 executa os adaptadores certificados de Manual, Híbrido, Reverso e UltraFast. A decisão é calculada pelo adaptador; não é aceita uma decisão arbitrária enviada pelo chamador.
2. O emissor assina o envelope R64 e uma proveniência R65 separada, incluindo versão, geração e digest de entrada. A API verifica as duas assinaturas com a origem e o escopo configurados no servidor.
3. O banco admite recibo e proveniência na mesma transação. Repetições exatas são idempotentes; conflitos de evento, sequência ou proveniência são recusados.
4. O estudo diário R64 permanece imutável. R65 recompõe o estudo a partir dos recibos admitidos até o instante congelado e verifica seu digest. Violações de controle impedem o registro de uma candidata.
5. Uma hipótese válida do analista pode sugerir a candidata permitida. Na ausência de inferência, uma regra determinística limitada pode sugerir a mesma candidata. Nenhuma hipótese dispensa a avaliação independente.
6. O plano de avaliação é registrado antes da janela. As definições são fixas; as execuções são medidas e persistidas durante a janela com o relógio do PostgreSQL. Depois da janela, o ciclo usa somente os casos persistidos. Casos ausentes causam rejeição, sem preenchimento retroativo.
7. Se a comparação satisfaz todos os limites, uma única atualização durável da versão é gravada por comparação de revisão e digest. O adaptador ativo consome essa versão nas decisões seguintes.
8. Uma reversão administrativa restaura a referência, preserva o histórico, incrementa a geração e retira a candidata. A reativação exige duas novas confirmações de contexto fresco.

## Limite da melhoria automática

Esta implementação permite apenas a redução da idade máxima de contexto do UltraFast de **750 ms para 500 ms**, uma vez por histórico, com zero liberações indevidas na candidata, redução estrita das liberações indevidas da referência e nenhuma regressão de bloqueios indevidos na bateria registrada.

O benchmark padrão contém seis casos sintéticos pré-definidos, cobrindo contextos frescos, entre os dois limites e vencidos. A janela começa um segundo depois do registro solicitado e dura dez segundos. O banco recusa registro tardio. Uma janela perdida é rejeitada; o worker não inventa ocorrências para recuperá-la.

Não há execução de código gerado, edição autônoma de estratégias, alteração de alavancagem, tamanho de posição, credenciais, permissões ou limites financeiros. A aprovação prévia do proprietário é preservada dentro desse escopo verificável. R65 não afirma aprendizagem ilimitada ou um nível máximo de rentabilidade.

## Evidências diferentes, explicitamente separadas

| Campo | Significado |
|---|---|
| `SIGNED_QA_REPLAY` | Transporte e admissão de observações assinadas de QA; não prova operações de clientes. |
| `R61_SYNTHETIC_RUNTIME` | Origem executada pelos adaptadores certificados presentes neste repositório. |
| `SYNTHETIC_FIXTURE` | Entradas e comparação controladas, sem dados de corretora ou PnL real. |
| `PINNED_QA_REPLAY_CLOCK` | Instante de ocorrência de replay escolhido pelo host de QA, distinto da captura e da admissão. |
| `WALL_CLOCK_QA_EXECUTION` | Captura de execução de QA no relógio corrente; continua sendo sintética. |

O motor proprietário é carregado fora deste repositório. A ponte existente declara `privateCoreLoaded:false` e `runtimeBytesVerified:false`. O contrato externo R65 permanece inativo e não invoca callbacks operacionais. Portanto, não há certificação da conexão ao motor privado, do coletor de clientes, de identidade administrativa real ou do provedor real.

O cache de operações e a sessão do emissor são locais ao processo. O host deve persistir a observação assinada exata para retransmissão ou abrir uma nova sessão após reinício. `initialSequence` não restaura o histórico de runtime. A implementação não afirma possuir uma fila de saída durável conectada ao motor externo.

## Persistência, reconciliação e arquivo

`db/schema/robot-r65-lifecycle-store.sql` é uma extensão revisável do esquema R64. Não é uma migração aplicada ao Supabase hospedado. A aceitação usa banco PostgreSQL descartável separado, RLS, revogações explícitas, funções `SECURITY INVOKER` e acesso restrito ao `service_role`. O escopo é fixado pelo servidor; RLS não é apresentado como isolamento do `service_role`.

O estado de evolução mantém journal e histórico imutáveis por prefixo. A gravação exige revisão esperada, digest anterior e identificador de operação. A aplicação confirma a persistência por releitura antes de responder com sucesso. Capturas de benchmark mantêm a primeira ocorrência e recusam alteração de resultado ou identidade.

O arquivamento cria uma prévia com manifesto e prazo, seguida de confirmação idempotente. A cópia inclui a proveniência, e a leitura verifica o digest. **O modo é `LOGICAL_COPY_ONLY`: não há exclusão física nem espaço liberado.** Os originais mantêm a auditoria e a proteção contra replay R64. Uma política de remoção física requer armazenamento durável dos marcadores antirreplay antes de ser habilitada.

A reconciliação de chamadas incertas exige administrador, fingerprint original, resolução e digest da evidência conferida. Registra uso/custo confirmado ou ausência de cobrança confirmada em uma tabela separada. Não reescreve relatório, resultado ou digest R64. Um custo confirmado acima da reserva é preservado como incidente; não é truncado para aparentar conformidade. A geração paga permanece desabilitada. A evidência declarada não substitui verificação externa do provedor.

## Superfícies disponíveis e ativação

- `POST /api/platform/robot-evolution-observations`: admissão do envelope e da proveniência assinados.
- `POST /api/platform/internal/robot-evolution-cycle`: tick sem parâmetros, token próprio R65 e escopo fixado no servidor.
- `GET/POST /api/platform/admin/robot-evolution-cycle`: consulta e ações administrativas; o ator vem da identidade autenticada.
- `/platform/homologacao/robos/ciclo`: shell público sem dados administrativos e leitura autenticada do estado persistido em QA; indisponibilidade não produz resultados fictícios.
- Painel administrativo: versão ativa, comparação, histórico, reversão, arquivo e reconciliação.
- `node scripts/platform/research/r65-cycle-worker.mjs --once|--watch`: entrada explícita de worker, sem registrar processo, cron ou serviço automaticamente.

O acesso exige todos os gates R61/R64 de QA e `JENIOS_ROBOT_R65_ENABLED=true`. O scheduler exige `JENIOS_ROBOT_R65_SCHEDULER_TOKEN` privado de 32 a 256 caracteres. A origem externa das ações administrativas deve ser fixada em `JENIOS_ROBOT_R65_ADMIN_ORIGIN`, em formato canônico sem barra final: HTTPS no host de homologação, ou `http://127.0.0.1:4320` no ensaio local. Isso preserva a verificação de origem quando Next normaliza endereços internos; headers Host/Forwarded não escolhem a autoridade confiável. Nenhuma variável pública ativa a coleta. As branches de pesquisa e backup têm deploy desabilitado. O worker continua respeitando a cadência diária R64 às 09h de São Paulo para o estudo do dia anterior; uma avaliação já registrada continua segundo sua própria janela.

## Validação

A CI específica preserva as baterias anteriores, executa os testes R65, aceita o SQL em PostgreSQL descartável, compila a aplicação e exercita Next, gateway HTTPS de QA, identidade administrativa simulada, banco real e navegador local. As identidades Auth/PostgREST são simuladas; os comandos SQL são executados no PostgreSQL real. Não há conexão a provedor pago, corretora ou banco hospedado.

Quando o ensaio roda após as 09h de São Paulo, o registro do ciclo é exercitado integralmente pelo HTTP com relógio corrente. Antes desse horário, o harness pode declarar `DIRECT_QA_CALENDAR_FIXTURE` para a preparação do calendário de pesquisa, preservando a resposta HTTP `NOT_DUE`. Essa alternativa deve aparecer na evidência; os casos de validação continuam prospectivos no relógio real do banco. A CI nunca deve classificar essa preparação como integração HTTP positiva do calendário corrente.

Fontes executáveis da validação: workflow R65, seis arquivos de testes `platformRobotR65*.test.mjs`, `r65-postgres-acceptance.mjs` e `r65-runtime-acceptance.mjs`. Contagens unitárias, de SQL, de HTTP e de navegador são informadas separadamente; não devem ser somadas como amostras independentes de mercado.

## Invariantes e próximo bloco

Manual conserva 100% do controle do operador. Híbrido e Reverso conservam alignment guard `0.65`. Reverso mantém a seleção e exceção de megatendência; losseshômetro permanece sintético. R15 não recebe backfill. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem `null`. Ordens reais e Paper externo permanecem zero. Performance comercial não é certificada.

O próximo bloco operacional depende do runtime proprietário e de sua identidade verificável, persistência e retransmissão do emissor, revisão do uso de dados de clientes, ambiente hospedado de homologação, aplicação controlada do esquema, configuração de Auth e host do worker, orçamento/provedor autorizados e teste observacional antes de qualquer promoção sobre operações de clientes. Não houve merge, deploy, alteração de produção ou ativação de monitoramento de clientes neste bloco.
