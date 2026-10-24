# R66 — Preparação da homologação operacional dos robôs

## Estado desta preparação

Base encerrada: R65, commit `02ccf75c09702f9378a496ffb0d9cd323e21d2fc`, backup `backup/jenios-robot-r65-evolution-cycle-certified-20261024`, CI [40115691899](https://github.com/paulostutz/jenios/actions/runs/40115691899) concluída com sucesso. Os JSONs de referência R65 continuam associados ao SHA de origem documentado. Este roteiro não reabre sua certificação.

O preflight R66 examina **declarações de configuração offline**. Não consulta Supabase, conta administrativa, provedor, Vercel ou corretora; não importa o motor privado, não cria serviço e não aplica SQL. Uma declaração completa termina em `BLOCKED_PENDING_OPERATIONAL_EVIDENCE`, com `operationalReady:false`. O resultado descreve o que foi inspecionado pelo programa, sem afirmar que observou o estado real de um host.

Neste bloco permanecem desativados monitoramento de clientes, geração paga, ordens reais, Paper externo, merge, deploy e alterações em bancos hospedados. Trabalho de código e verificação isolada já autorizado pode continuar sem nova confirmação. As atividades hospedadas e a futura ativação operacional abaixo são etapas posteriores, fora da autorização atual.

## Integração existente a reaproveitar

| Componente | Fonte existente | Limite comprovado |
|---|---|---|
| Captura do motor privado | `scripts/platform/research/b297-capture-private-readonly.mjs` e `captureB297OriginalDecisions` | Carrega os bytes externos conferidos e chama `analyzeRequest` com fonte sintética e transporte bloqueado. O contrato original cobre Manual, Híbrido e Reverso. |
| UltraFast de QA | `robot-r61-ultrafast-acceptance.mjs`, `robot-r65-active-runtime.mjs` | Domínio `R61_SYNTHETIC_RUNTIME`; nenhuma atestação de motor privado operacional. |
| Emissor/admissão R65 | `robot-r65-observation-source.mjs`, `robot-r65-http.mjs` | Envelope e proveniência assinados, aceitos somente no domínio sintético certificado. |
| Banco de observações e ciclos | `robot-r64-database-store.mjs`, `robot-r65-database-store.mjs` | Esquemas revisáveis e ensaiados em PostgreSQL descartável. |
| Identidade administrativa | `lib/platform/admin-permissions.mjs` | `db.auth.getUser(token)`, usuário não anônimo e permissão `platform.admin`, obtida por allowlist privada ou `app_metadata.platform_role`. A tabela de permissões concede apenas `platform.reports`. |
| Ciclo/worker | `robot-r65-runtime.mjs`, `scripts/platform/research/r65-cycle-worker.mjs` | Entrada explícita `--once`/`--watch`; nenhum scheduler hospedado foi ativado. |

Os hashes históricos do motor, sua localização e a inspeção R66 devem ser lidos em `docs/platform/evidence/ROBOT_R66_PRIVATE_ENGINE_DISCOVERY.json`. Não publicar os arquivos privados no repositório. Localizar e conferir o motor é uma evidência diferente de conectá-lo ao emissor num host operacional.

Não rotular a saída original do motor privado como execução R61. Uma ponte futura precisa preservar a identidade do executável, o robô e a origem efetivamente executados. O verificador R65 não deve ser relaxado para aceitar um rótulo operacional sem contrato, assinatura, autorização e teste próprios.

## Preflight sem efeitos externos

Comando local, seguro para esta etapa:

```bash
node scripts/platform/research/r66-operational-preflight.mjs --json
```

Para examinar um plano de host já escolhido, ainda sem criar ou conectar esse host:

```bash
node scripts/platform/research/r66-operational-preflight.mjs --json \
  --storage persistent_private_volume \
  --worker persistent_process \
  --wake next_at_ms
```

O programa lê apenas as variáveis necessárias do ambiente do processo e nunca imprime seus valores. Código de saída `2` significa pendência de homologação; não significa que algum serviço foi ativado. Entrada inválida produz código `1`. Não há opção `--activate`, `--migrate`, `--deploy` ou `--accept`.

### Declarações exigidas para a futura QA hospedada

| Configuração existente | Valor/condição a revisar | Evidência que a configuração não substitui |
|---|---|---|
| `VERCEL_ENV` | `preview` no contexto de QA | Identidade do host e destino efetivamente implantado. |
| `JENIOS_QA_CANDIDATE_ENABLED`, `JENIOS_ROBOT_QA_ENABLED`, `JENIOS_ROBOT_R64_ENABLED`, `JENIOS_ROBOT_R65_ENABLED` | `true` somente no ambiente QA aprovado | Deploy, serviço iniciado ou testes hospedados. |
| `JENIOS_REAL_EXECUTION_ENABLED`, `JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED`, `JENIOS_PRIVATE_PAPER_EXECUTOR` | `false` explícito | Ausência de caminhos externos não examinados. |
| `JENIOS_ROBOT_ANALYST_PAID_ENABLED` | `false` explícito | Nenhum orçamento ou chamada paga fica autorizado por este roteiro. |
| `PLATFORM_SUPABASE_URL`, `PLATFORM_SUPABASE_SERVICE_ROLE_KEY` | Projeto exclusivo Platform de QA; segredo somente no servidor | Conexão real, instalação do esquema, privilégios e isolamento. Não há fallback para outra aplicação. |
| `JENIOS_ROBOT_R64_SCOPE_ID`, `JENIOS_ROBOT_R64_SOURCE_ID`, `JENIOS_ROBOT_R64_SOURCE_PUBLIC_KEY` | Identificadores no formato certificado e chave pública Ed25519 válida | Identidade independente do executável, broker ou cliente. A chave privada permanece apenas no emissor. |
| `JENIOS_ROBOT_R65_ADMIN_ORIGIN` | Origem HTTPS canônica, sem caminho/barra final | Teste de `Origin` no host real. Host/Forwarded não escolhem a origem confiável. |
| `JENIOS_ROBOT_R65_SCHEDULER_TOKEN` | Segredo privado próprio, entre 32 e 256 caracteres, sem espaços | Agendador em funcionamento ou identidade administrativa. |
| Host do emissor | Volume privado persistente, fora do checkout, permissões e proprietário conferidos | Persistência real depois de queda/reinício, locks e recuperação. |
| Host do worker | Processo supervisionado ou scheduler que respeite `nextAtMs` | Despertar dentro da janela real do banco. |

O arquivo local da fila não pode depender de um filesystem efêmero de função. A API Next pode continuar sendo uma superfície de admissão; a fila deve residir no host persistente do emissor ou numa solução durável posteriormente validada. Não marcar uma pasta temporária como volume persistente apenas porque a escrita funcionou uma vez.

## Ordem de homologação futura

### 1. Identidade do motor e conexão de observação

Conferir os hashes do arquivo original contra a evidência de descoberta. Verificar quais exports são invocados e quais robôs realmente usam esse executável. Preparar uma fonte separada para o motor privado, mantendo assinaturas e proveniência ligadas a versão, geração, sessão e entrada efetivamente usadas. Um callback fornecido ou uma flag `verified:true` não é comprovação.

O primeiro ensaio no host deve continuar sem transporte de ordens e sem conta de cliente. A evolução 750→500 ms certificada para o UltraFast não autoriza aplicar mudanças no núcleo privado dos outros três robôs.

### 2. Persistência do emissor no host escolhido

Ensaiar queda depois de persistir e antes da resposta, e perda da confirmação após admissão. A repetição deve conservar os bytes assinados, o identificador e a sequência. Depois de reinício, a sessão nova deve exigir novas confirmações; `initialSequence` não reconstitui histórico de runtime.

A validade de admissão R64 é de **120 segundos**. Um registro vencido permanece auditável e pendente de resolução conforme a fila; não deve ganhar data nova, assinatura nova ou confirmação inventada. Avaliar também reinício com lock remanescente, troca indevida de chave, diretório, escopo e conflito de operação. Recuperação de lock deve ser explícita e não baseada em roubo automático por tempo.

### 3. Banco QA e identidade administrativa real

Antes de qualquer aplicação hospedada, identificar explicitamente o projeto Platform de QA, sua referência e o escopo permitido. Os arquivos existentes a revisar, nessa ordem, são:

1. `db/schema/robot-r64-operational-store.sql`.
2. `db/schema/robot-r65-lifecycle-store.sql`.

Não criar um terceiro esquema para repetir R64/R65. A aplicação nesses bancos não faz parte deste bloco. Depois da autorização específica e aplicação, verificar no projeto real admissão atômica, repetição idempotente, conflito de sequência, permissões de execução e isolamento por escopo. O `service_role` exige vinculação de escopo pelo servidor; RLS não é prova de isolamento dessa credencial privilegiada.

Usar sessões reais distintas para comprovar:

- Admin permitido consegue consultar o relatório e executar ações autorizadas no escopo fixado pelo servidor.
- Usuário comum e usuário apenas com `platform.reports` não ganham `platform.admin`.
- Usuário anônimo, token inválido e token expirado são recusados.
- Alterar `user_metadata` não concede administração.
- `Origin` indevido continua recusado, inclusive com Host/Forwarded manipulados; a correção canônica R65 fica preservada.
- HTML anônimo contém somente o shell, sem feed, chaves ou dados administrativos.

### 4. Worker e relógio do banco

Reaproveitar `r65-cycle-worker.mjs --watch` ou o endpoint `POST /api/platform/internal/robot-evolution-cycle`, com token R65 e corpo vazio. Uma execução diária isolada ou um cron fixo por minuto não comprova o ciclo inteiro: o plano abre um segundo após o registro e a janela dura dez segundos. O host precisa respeitar `nextAtMs` para capturar os casos durante a janela real de `clock_timestamp()`.

O estudo mantém a cadência diária das 09h de São Paulo; a janela da avaliação tem seu próprio agendamento. Provar reinício, prevenção de concorrência conflitante, registro antes da janela e rejeição de casos ausentes. Uma janela perdida termina rejeitada, sem backfill. Testar liveness do scheduler não autoriza tráfego operacional de clientes.

### 5. Dados operacionais e provedor generativo

Definir o conjunto mínimo de dados observados, identidade da fonte, acesso administrativo, retenção, divulgação ao cliente e procedimento de remoção. Preservar a distinção entre o que é sintético, o que foi observado no motor e o que foi atestado por uma corretora. Não enviar documentos, credenciais, dados pessoais ou payloads brutos ao analista por conveniência.

O provedor permanece bloqueado. A ativação paga futura precisa de autorização de orçamento específica da JENIOS, modelo aprovado, tarifas atuais conferidas e limites internos financiados. O fluxo R64 exige simultaneamente a flag privada de ativação e política aprovada no banco. Respostas incertas retêm reserva para reconciliação; não repetir a chamada para tentar descobrir se houve cobrança. É possível avançar na homologação sem inferência paga, usando a alternativa determinística limitada já certificada.

### 6. Aceite do proprietário

Apresentar ao proprietário as evidências hospedadas reais, pendências, recuperação, escopo da observação e proposta concreta de ativação. Registrar o aceite antes de observar clientes. Não reabrir autorizações de código, revisão e testes isolados já concedidas. A pré-aprovação de melhoria automática permanece vinculada à política verificável; não autoriza ordens, mudanças financeiras, estratégias arbitrárias ou código gerado.

## Critério de saída e limites preservados

O preflight R66 sozinho nunca remove as pendências. O fechamento operacional dependerá das evidências reais listadas, conferidas contra o host, o executável e as identidades correspondentes. Esta preparação não apresenta cenários sintéticos como rentabilidade, taxa de acerto, perdas evitadas ou operações de mercado.

Manual conserva o controle integral do operador. Híbrido e Reverso mantêm `0.65`, reversão seletiva e exceção de megatendência. Losseshômetro continua hipotético. `actualBrokerPnl`, `actualLossesAvoided` e `realTradeAccuracy` ficam `null`; R15 não recebe backfill. Arquivamento permanece `LOGICAL_COPY_ONLY`, preservando originais e proteção contra replay, com zero bytes liberados. Não há ampliação da política automática além de UltraFast 750→500 ms, uma aplicação por histórico, comparação registrada e reversão auditável.
