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

A CI pública executa os novos contratos, preserva a compatibilidade das filas R66/R67 e do worker R65, exercita os cenários de retomada em PostgreSQL descartável e mantém os gates gerais de testes/build. O núcleo privado não é enviado para a CI pública. A aceitação positiva do host privado é executada localmente com os bytes originais, processos separados, HTTP loopback e PostgreSQL descartável.

A verificação local inicial passou em 46/46 testes R68 e 239/239 contratos preservados; o build passou com 2.603/2.603 testes gerais, gate herdado de 94/94 e 76/76 páginas. O worker passou 9/9 verificações PostgreSQL e o host privado original passou 12/12 verificações. Essas execuções preliminares ocorreram com a árvore de implementação em trabalho; a evidência privada será repetida no commit de referência limpo, em paralelo à CI pública, antes da consolidação final. Os resultados e seus SHAs serão consolidados no checkpoint R68. As evidências locais de núcleo original e as fixtures públicas do worker terão classificação separada. Os testes direcionados também pertencem à bateria geral; essas contagens não devem ser somadas como operações de mercado.

O fechamento segue a regra existente: guardar evidências com o SHA que as produziu, consolidar documentação e ledger em outro commit, obter CI final aprovada e criar o backup certificado no mesmo SHA final. Não se reatribui o JSON de referência nem se cria uma sequência recursiva de commits para inserir a própria CI.

## Pendências que continuam materiais

O próximo aceite requer selecionar o host e o projeto QA isolado, confirmar custódia e exclusividade externas, instalar/revisar os esquemas somente com autorização posterior, executar a matriz de identidade real e comprovar o ciclo naquele ambiente. O projeto operacional privado, os dados de clientes e o provedor generativo não estão conectados por este bloco. Custos pagos precisam de autorização específica JENIOS; autorizações de CHEFE/LETTER não se aplicam.

Ordens reais, Paper externo e chamadas pagas permanecem zero. Monitoramento de clientes permanece inativo. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` permanecem nulos. Não há merge, deploy, alteração de produção ou migração hospedada. Controle manual, guard 0.65 dos adaptadores certificados, reversão seletiva, R15 sem backfill e Losseshômetro sintético são preservados. Performance comercial continua não certificada.
