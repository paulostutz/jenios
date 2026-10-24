# R68 — preparação do host privado e da homologação operacional

## Escopo e base

Este bloco continua exclusivamente os robôs da JENIOS a partir do R67 certificado, commit `a2079604f11781ac11f012fe517297bd31ebaaab`, backup `backup/jenios-robot-r67-private-source-bridge-certified-20261024` e CI `40120849172` aprovada. Pesquisa e backup foram reconferidos no mesmo SHA antes das alterações; a consulta Vercel retornou zero deployments desse SHA.

O R68 prepara uma entrada local para o host privado, diagnóstico da fila sem alteração, supervisão do worker R65 e conferência offline da configuração administrativa. Não instala um serviço, não aplica esquema hospedado e não ativa monitoramento de clientes. A homologação do ambiente hospedado permanece pendente mesmo quando as verificações locais passam.

O núcleo privado já localizado e validado no R66/R67 é reutilizado. Não há reconstrução das estratégias, mudança dos adaptadores certificados ou transferência da política UltraFast para o núcleo privado.

## 1. Host privado explícito

Arquivos de entrada:

- `lib/platform/research/robot-r68-private-host.mjs`.
- `lib/platform/research/robot-r68-private-files.mjs`.
- `scripts/platform/research/r68-private-host.mjs`.

O processo usa o loader, o emissor, a fila e o transporte loopback R67 existentes. Há um único emissor e uma única nova sessão por processo. Cada comando tem `operationId` estável e os cenários já admitidos pelo protocolo R67. Repetir o comando depois de reiniciar recupera o registro persistido; não reexecuta o núcleo para fabricar outra decisão.

O manifesto, as chaves e os comandos são arquivos locais protegidos: fora do repositório e do diretório de trabalho, diretório privado `0700`, arquivos `0600`, proprietário atual, um link, sem links simbólicos e com leitura limitada pelo mesmo descritor. A chave de assinatura deve ser Ed25519 e corresponder ao digest público fixado no manifesto. A chave HMAC deve corresponder à fila existente. Chaves não entram em argumentos de linha de comando, relatórios ou no repositório.

Forma do manifesto, com valores ilustrativos que precisam ser substituídos no host isolado:

```json
{
  "schema": "JENIOS_R68_PRIVATE_HOST_CONFIG_V1",
  "coreDirectory": "/caminho/privado/core",
  "outboxDirectory": "/caminho/privado/outbox",
  "privateKeyFile": "/caminho/privado/keys/source.pem",
  "hmacKeyFile": "/caminho/privado/keys/outbox.hex",
  "commandsFile": "/caminho/privado/commands.json",
  "scopeId": "scope:0000000000000001",
  "sourceId": "source:0000000000000002",
  "sourceKeySha256": "SUBSTITUIR_PELO_SHA256_DA_CHAVE_PUBLICA_SPKI_DER",
  "origin": "http://127.0.0.1:4320"
}
```

O arquivo HMAC contém 64 caracteres hexadecimais minúsculos, com uma quebra de linha final opcional. O arquivo de comandos tem a forma `{"schema":"JENIOS_R68_PRIVATE_HOST_COMMANDS_V1","commands":[...]}`; cada item contém apenas `operationId` e `scenarios`. São admitidos até 20 comandos por arquivo. IDs repetidos com conteúdo divergente são recusados. Nenhum campo aceita código JavaScript, caminho de módulo alternativo ou callback de estratégia.

Comandos preparados:

```bash
node scripts/platform/research/r68-private-host.mjs --check --config /caminho/privado/host.json
node --experimental-vm-modules scripts/platform/research/r68-private-host.mjs --once --config /caminho/privado/host.json
node --experimental-vm-modules scripts/platform/research/r68-private-host.mjs --watch --config /caminho/privado/host.json
```

`--check` observa os arquivos e a fila sem construir loader ou emissor, criar sessão, executar o núcleo ou chamar a rede. Compara os arquivos privados com os hashes já fixados no R67; uma divergência bloqueia a prontidão local, mantendo o diagnóstico da fila. O loader R67 repete a verificação e compila os mesmos bytes somente durante execução autorizada.

`--once` e `--watch` exigem todas as condições QA R67, custos explicitamente desativados e `JENIOS_ROBOT_R68_HOST_ENABLED=true`. O destino aceito continua exclusivamente HTTP loopback, sem redirects; o R68 não cria um transporte remoto. O serviço que recebe a observação usa o endpoint e a admissão R67 já certificados.

O lock `r68-private-host.lock` é adquirido antes da criação de sessão e mantido durante a vida do processo. Um segundo host é recusado. A posse local é reconferida antes de novas operações; isso não equivale a um fence entre máquinas nem prova que outro escritor foi excluído externamente.

`SIGTERM` e `SIGINT` impedem novas capturas e novos envios. A operação já iniciada termina pelo caminho existente, inclusive persistência e validação de ACK; o processo libera somente seu próprio lock. Não se inicia outra operação por timeout enquanto uma escrita anterior continua. Após `SIGKILL`, os locks encontrados são preservados para diagnóstico e recuperação externa.

| Limite do host | Valor |
|---|---:|
| Comandos no arquivo | 20 |
| Envios por tick | até 20, com parada verificada entre envios |
| Intervalo normal | 1 segundo |
| Backoff máximo de entrega incerta | 8 segundos |
| Timeout de cada transporte loopback | 3 segundos |
| Validade do registro assinado, herdada do R67 | 120 segundos |

Um novo processo cria nova sessão; não restaura a história interna do runtime privado. Registros anteriores continuam com a assinatura, a sessão e os tempos originais. Expiração e resultado incerto permanecem explícitos, sem renovar timestamps ou inventar confirmação de recebimento.

## 2. Diagnóstico da fila e recuperação

`diagnoseR68Outbox`, em `robot-r68-outbox-doctor.mjs`, aceita somente os perfis fechados `R66_OBSERVATION` e `R67_PRIVATE_CAPTURE`. A extensão de leitura no kernel existente verifica permissões, HMAC, vínculo da fonte e os validadores históricos de cada fila. Os caminhos de transação, entrega e bloqueio continuam os existentes.

A inspeção registra inventários antes e depois, metadados e digests limitados. Pode observar uma fila com lock ativo ou órfão sem removê-lo. Se os arquivos mudarem durante a leitura, o resultado é inconclusivo. Não seleciona o snapshot com maior revisão, não promove temporários e não cria uma versão nova da fila.

O relatório distingue estado persistido e estado observado no instante da consulta. Calcula expiração, tentativas incertas, limites de capacidade e sequências bloqueadas por predecessores sem gravar esses cálculos. Um registro elegível pelos metadados ainda depende da admissão efetiva do receptor.

O plano de recuperação contém um digest da observação e ações para revisão, mas não contém comando de desbloqueio. `recoveryAuthorized`, `processOwnershipVerified`, `exclusiveHostFenceVerified`, `monotonicWitnessVerified` e `operationalReady` são sempre falsos. PID inexistente, idade do lock ou arquivos estáveis não comprovam exclusividade do host. Uma futura recuperação precisa comprovar externamente a exclusão de todos os escritores e emissores e preservar os registros incertos/expirados.

Limites herdados: até 5.000 registros, 1.024 sessões, 100 tentativas por registro e 32 MiB de snapshot. Nenhuma purga física foi acrescentada; não há recuperação automática de lock nem testemunho externo contra rollback do diretório inteiro.

## 3. Supervisor do ciclo R65

`robot-r68-cycle-supervisor.mjs` envolve exclusivamente `runtime.runTick()` existente. A entrada `scripts/platform/research/r68-cycle-supervisor.mjs` oferece `--once` e `--watch`. Exige o gate R65, custos explicitamente desativados e `JENIOS_ROBOT_R68_WORKER_ENABLED=true`; não registra cron ou serviço hospedado.

A lacuna tratada é temporal: o runner anterior aguardava 60 segundos após erro, enquanto a janela do benchmark registrado dura 10 segundos. O supervisor R68 tenta novamente após 1 segundo, limitado a cinco falhas consecutivas. Com sucesso, segue `nextAtMs`, com espera de 250 ms a 60 segundos. A reinicialização consulta o estado durável pelo R65; não cria casos retroativos.

Só há um tick em andamento por instância do módulo. `SIGTERM`/`SIGINT` impedem o próximo tick e aguardam o atual. Um sink de logs quebrado, configuração desativada, relógio regressivo ou resultado fora do contrato encerra a supervisão. Os logs contêm apenas estados, códigos e metadados limitados. Não se alega exclusividade entre processos ou hosts: essa definição continua parte da homologação hospedada.

A estratégia, o plano de avaliação e a política 750→500 ms não mudam. Uma janela incompleta continua rejeitada pelo algoritmo R65, sem backfill, mesmo após reinício tardio.

## 4. Configuração administrativa e aceite hospedado

`inspectR68DeclaredHandoff` reutiliza o preflight R66 e confere adicionalmente:

- URLs HTTPS canônicas e iguais em `PLATFORM_SUPABASE_URL` e `NEXT_PUBLIC_PLATFORM_SUPABASE_URL`.
- Formato declarado de chave pública no navegador e chave de servidor no backend, sem chave privilegiada nos campos públicos examinados.
- Identidade e chave R67 distintas da fonte R64/R65.
- Opt-ins explícitos do host e do supervisor, plano de processo persistente e flags de execução/custos desativadas.

O formato de chave não prova assinatura, projeto, usuário ou autorização. O decodificador de JWT legado serve somente para recusar uma declaração de papel privilegiado no campo público; ele não autentica o token. URLs iguais não provam que as credenciais pertencem àquele projeto. Os formatos `sb_publishable_`, `sb_secret_` e os papéis legados seguem a [documentação oficial de chaves Supabase](https://supabase.com/docs/guides/getting-started/api-keys), consultada neste bloco juntamente com o [changelog](https://supabase.com/changelog). Não houve criação, rotação, consulta ou alteração de credenciais hospedadas.

```bash
node scripts/platform/research/r68-declared-handoff.mjs --json --storage persistent_private_volume --worker persistent_process --wake next_at_ms
```

A saída não contém valores de chaves, IDs, URLs ou tokens fornecidos. O plano de armazenamento/worker precisa ser declarado nos argumentos; na ausência deles permanece `unspecified`. Código de saída 1 indica configuração incompleta/inválida; código 2 indica configuração declarada completa com evidência hospedada ainda pendente. Não existe código de sucesso que autorize ativação.

### Matriz preparada para a identidade real

| Caso no projeto QA isolado | Resultado exigido |
|---|---|
| Administrador Platform real nos GETs R65/R67 | Relatório autorizado e limitado ao escopo configurado |
| Usuário comum real | Acesso recusado |
| Usuário apenas de relatórios | Acesso recusado ao feed administrativo |
| Anônimo | Acesso recusado e nenhum feed administrativo no HTML |
| Token inválido ou expirado | Acesso recusado |
| Administrador com Origin indevida em ação R65 | Ação recusada sem mudança de estado |
| Administrador com Origin canônica em ação QA autorizada | Ação auditável; validação de estado/revisão preservada |

Todos os itens acima permanecem `NOT_EXECUTED` no preflight. O R68 não altera a autorização administrativa, não remove a checagem de Origin e não usa `Host`/`Forwarded` para eleger a origem confiável. Os ensaios locais não certificam identidade real, navegador positivo, servidor Next hospedado ou Supabase hospedado.

## Validação e fechamento

A [CI de referência 40122800873](https://github.com/paulostutz/jenios/actions/runs/40122800873) passou no commit `5e7550f1e8b48d661aeab03cf85fbe6f7b92a7e1`, job `120957801014`, concluído em **24/10/2026 às 18:55:34 UTC (15:55:34 em São Paulo)**.

| Verificação | Resultado | Natureza |
|---|---:|---|
| Contratos novos R68 | 46/46 | Arquivos privados, doctor, handoff, supervisor e exclusão de deploy |
| Contratos R65–R67 preservados e guard existente | 239/239 | Compatibilidade; sem nova certificação de estratégias |
| Testes gerais | 2.603/2.603 | Gate existente do build |
| Gate herdado da aplicação | 94/94 | Nenhuma alteração no código dos outros produtos |
| Worker em PostgreSQL 17.6 na CI | 9/9 | Processos reais e fixtures sintéticas R61/R65 |
| Host privado original local | 12/12 | CLI real, bytes originais, sinais, HTTP loopback e PostgreSQL 16.15 |
| Build e páginas estáticas | PASS; 76/76 | Sem deploy |
| Falhas/omitidos no fechamento de referência | 0/0 | Tentativas preparatórias descritas na auditoria |

Os testes direcionados estão incluídos na bateria geral. Contagens de testes, lotes e decisões não são operações independentes de mercado. A CI pública não contém nem executa o núcleo privado. A evidência positiva do núcleo foi produzida localmente com Node `v24.22.1`, árvore limpa e o mesmo SHA de referência.

### Resultado concreto do host privado

Foram **16 invocações da CLI**, incluindo consultas e recusas. O cenário fez cinco POSTs locais: quatro no percurso de admissão e um recusado pela indisponibilidade explicitamente simulada antes de qualquer admissão. Um ACK foi perdido depois do commit PostgreSQL. O reinício reutilizou o registro exato e recebeu confirmação de registro já existente.

Durante outra resposta bem-sucedida, um SIGTERM real impediu o segundo envio, deixando o lote seguinte pendente. O novo processo o entregou e admitiu um lote novo, sem duplicar os anteriores. O banco terminou com **três lotes, nove decisões originais sintéticas e duas sessões admitidas**.

Outras três decisões originais ficaram retidas fora do banco. Sua validade de 120 segundos transcorreu com relógio real; consultas repetidas reconheceram a expiração sem regravar a fila, criar sessões ou enviar requisições. Um SIGKILL separado preservou o lock órfão e o próximo runner foi recusado. O teste de perda observada do lease e o de desativação da flag impediram novas capturas/envios.

A fotografia `acknowledgedQueueBeforeOrphanProbe` é anterior ao teste de lock órfão; esse teste posterior acrescenta uma sessão vazia e mantém seu lock. Não se apresenta aquela fotografia como estado final de todos os probes. A custódia de chaves e os diretórios usados são fixtures locais temporárias; não certificam um volume hospedado ou custódia de produção.

### Resultado concreto do worker

Quatro processos, dois SIGKILL anteriores à abertura e um SIGTERM exercitaram o supervisor e o tick R65 original. O primeiro caso foi persistido antes de uma perda simulada do ACK; a tentativa após um segundo manteve seu timestamp e completou os seis casos dentro da janela real do PostgreSQL. Um segundo histórico reiniciou após o fechamento e foi rejeitado com zero casos, sem backfill.

A fixture registrou prospectivamente abertura em quatro segundos para permitir os reinícios em CI. Preservou as seis definições originais e a duração de dez segundos. Não substituiu `Date.now()` nem `clock_timestamp()`. O aceite usa os stores originais sobre adaptador `psql` local; o factory de produção da CLI, PostgREST hospedado e identidade real não foram exercitados.

### Evidências duráveis

- `docs/platform/evidence/ROBOT_R68_PRIVATE_HOST_READINESS_CHECKPOINT.json`.
- `docs/platform/evidence/ROBOT_R68_CHANGE_AUDIT.json`.
- `docs/platform/evidence/ROBOT_R68_PRIVATE_HOST_ACCEPTANCE_EVIDENCE.json` — execução original local com árvore limpa.
- `docs/platform/evidence/ROBOT_R68_WORKER_ACCEPTANCE_EVIDENCE.json` — JSON original do artefato público da CI, preservado byte a byte.
- Seção `privateHostReadiness` do ledger, mantendo os valores das 16 seções anteriores.

| Evidência | SHA-256 |
|---|---|
| JSON privado local | `01782899458b6438de7b33fafca30de0a5766314819110f405d934dd4ccd5925` |
| JSON worker da CI | `31ce798d33dc1706bb5082ae99b4a6356a8333b017e2b8653dc18a0718b56b2a` |
| ZIP do artefato `12572380817` | `6883085297e288f8ae335ffc5bbb84d98f72e19fa7c747faacc6417d271d086d` |

Duas ocorrências preparatórias ficaram registradas na auditoria: a fixture inicial do worker omitia `initialSequence`, e uma preparação local de banco forneceu `PGSERVICEFILE` vazio. Ambas pararam antes das novas observações; foram corrigidas na fixture/comando de preparação sem alterar os algoritmos certificados. A repetição limpa privada e a CI de referência terminaram sem falhas ou omissões.

O PostgreSQL local foi encerrado após os ensaios. A consulta ao projeto Vercel confirmou zero deployments do SHA de referência. Os JSONs mantêm o SHA que realmente os produziu. A consolidação documental exige CI final aprovada antes de criar o backup `backup/jenios-robot-r68-private-host-readiness-certified-20261024` no mesmo SHA final; não se cria um ciclo recursivo de commits para inserir a própria CI.

## Pendências que continuam materiais

O próximo aceite requer selecionar o host e o projeto QA isolado, confirmar custódia e exclusividade externas, instalar/revisar os esquemas somente com autorização posterior, executar a matriz de identidade real e comprovar o ciclo naquele ambiente. O projeto operacional privado, os dados de clientes e o provedor generativo não estão conectados por este bloco. Custos pagos precisam de autorização específica JENIOS; autorizações de CHEFE/LETTER não se aplicam.

Ordens reais, Paper externo e chamadas pagas permanecem zero. Monitoramento de clientes permanece inativo. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem nulos. Não há merge, deploy, alteração de produção ou migração hospedada. Controle manual, guard 0.65 dos adaptadores certificados, reversão seletiva, R15 sem backfill e Losseshômetro sintético são preservados. Performance comercial continua não certificada.
