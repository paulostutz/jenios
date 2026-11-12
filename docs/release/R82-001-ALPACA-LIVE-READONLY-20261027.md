# JENIOS R82 — Alpaca Live SOMENTE LEITURA — 27/10/2026

## Continuidade e escopo
- Projeto: `paulostutz/jenios`; base da branch release/jenios-genios-g44-20261024 = `a24922cc829dd1b45b87a719e9fd57ab45e6d79b`.
- Trabalho realizado exclusivamente na PR draft #22, branch `fix/jenios-r80-private-paper-safety-20261027`. R74 privado original e blocos R77–R81 preservados.
- A R81 já teve CI `40519988726` SUCCESS, migração Supabase `20261027141752` auditada com RLS e 3 RPCs restritas a serviço. Nenhuma conta, autorização ou ordem foi criada.

## Código R82
- `lib/platform/connections/alpaca-live-readonly-r82.mjs`: nova biblioteca privada isolada, **somente GET**, com origem fixa `https://api.alpaca.markets`, somente `/v2/account` e `/v2/clock`.
- R77 continua sendo exclusivamente Alpaca PAPER `https://paper-api.alpaca.markets`. Nenhuma credencial PAPER, digest PAPER, autorização Ed25519 R78/R79 ou fluxo R80/R81 permite LIVE.
- Identidade de dono da Platform obrigatória, conexão de conta LIVE distinta com fonte privada validada, digest de conta HMAC com segredo dedicado LIVE. O módulo nunca devolve ID externo, credencial, posições, saldos ou número de conta.
- O relógio oficial deve ser válido; respostas têm limite de 64 KiB, timeout e redirecionamentos negados. Não há POST, DELETE, PATCH, cancelamento ou qualquer helper de execução.
- Gates obrigatórios: `JENIOS_R82_PRIVATE_NODE_WORKER=true`, `JENIOS_R82_ALPACA_LIVE_READ_ENABLED=true`, `JENIOS_REAL_EXECUTION_ENABLED=false`, `JENIOS_R82_ALPACA_LIVE_ORDER_EXECUTION_ENABLED=false` e ambiente não produção. Ausência de configuração bloqueia toda chamada.
- Toda resposta mantém `tradingPermissionsCertified:false`, `riskLimitsApproved:false`, `liveOrdersEnabled:false` e `ordersSent:0`, inclusive quando a conta responde ACTIVE.
- `tests/platformRobotR82LiveReadOnly.test.mjs`: suíte com GET oficial sintético, negação de live execução, separação paper/live, host allowlist, identidade de conta, divergência de digest, relógio, erros da corretora e limitação de resposta.
- `.github/workflows/jenios-r80-private-paper-safety.yml` integra a R82 às suítes consolidadas R77–R81, regressão geral, Next build e integridade de app/API/migrações.

## Evidências, limitações e requisitos para Live
- Este módulo **não** conecta uma conta LIVE real. Não existe cofre LIVE homologado, linha de conta LIVE cadastrada, usuário com acesso financeiro aprovado, nem segredos de corretora provisionados.
- Não existe worker executor Live hospedado nem suporte para POST/GET/CANCEL de ordens Live. Não alterar flags para contornar.
- O Supabase R74 está ACTIVE somente com ciclos sintéticos e sem ordens externas. Seu runtime não deve ser reescrito para transportar ordens Live.
- Concluir separadamente, antes de negociar: identidade do cliente, cofre LIVE por usuário com permissões mínimas e sem saques; consentimento expresso de execução; capital/exposição/ordem/posição/stop/perda diária/limite acumulado/alavancagem/horários por conta; idempotência e risco duráveis; kill switch e reconciliação pós-restart com prova oficial; ensaio PAPER real e revisão independente; canário Live explicitamente autorizado.
- Nenhuma execução real, Paper externa, movimentação/cobrança, alteração CHEFE/LETTER, ou deploy foi realizado pela R82.
- Rollback: manter PR draft sem merge, execução LIVE false e release R79 intacta; nenhuma migração nova R82 foi aplicada.

## Testes
A conclusão de R82 exige CI verde do commit final, comparação de branch e validação dos guards. A cobertura automatizada não comprova integração externa nem aprovação regulatória.
