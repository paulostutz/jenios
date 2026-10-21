# JENIOS B292-QA — Convergência da prova financeira do B291 (homologação)
Data: 21/10/2026. Escopo restrito: JENIOS, branch privada de Preview.

## Proveniência e salvaguardas
- Origem: `fix/jenios-b291qa-integrated-preview-20261021` em `6fb79af619b87b9515b21642cc91e532ff2be241`; CI 39666585769 SUCCESS, Preview `dpl_EJJdbqKYD2FFDpS6184FmPHT5vU7` READY.
- Variante paralela revisada: `fix/jenios-b291qa-launch-candidate-20261021` em `2cd8f89e6f0d2b2f0bb7881159abfb30d015d64a`, CI 39665148110 SUCCESS, Preview `dpl_HV9vkDnFuyLxf3cNHQPsYH3HXmUd` READY.
- Não foi realizado merge automático entre históricos divergentes. Foram transferidas apenas as três correções equivalentes de propagação explícita da prova financeira, depois de conferir o código nos dois históricos. Os demais arquivos e backups certificados permanecem preservados.
- Produção: B177-R3, commit `caaffece04649a6dc1ca6c8012d7502887771529`, NÃO ALTERAR.
- Social QA `rebzztxlzofxpfwjvbee` e Platform QA `xaicvhagftzjkqphnbgx`, SEM novas migrações ou escritas de negócio.

## Critério de execução deste bloco
1. `lib/assistant/pro-service.mjs`: acesso e consulta de Pro passam o parâmetro `strict` diretamente do `env` da requisição.
2. `lib/assistant/university-subscription.mjs`: habilitação por assinatura passa `strict` do `env`.
3. `lib/learning/access.mjs`: verificação da matrícula passa `strict` do `env`.
4. `tests/jeniosB292QaStrictAccessPropagation.test.mjs`: teste dos três entrypoints, teste dinâmico Pro e bloqueio de Preview sem a prova financeira.

## Status e limites
Alteração candidata; homologar novamente na CI e Preview deste exato commit antes de certificar. Não ativar bancos, cobrança, IA paga, cadastro livre, ordens reais ou Paper externo. Zero usuários QA impede comprovação de login, sessão, recuperação de senha e progresso multiusuário autenticado. Banco Inter real será configurado pelo proprietário posteriormente.

## Critérios de rollback
Em caso de falha, retornar a branch de Preview para `6fb79af619b87b9515b21642cc91e532ff2be241` após conferir exclusividade do alvo e interromper promoção. Backup histórico da versão anterior: `backup/jenios-b291qa-integrated-preview-certified-20261021`. Não executar rollback de produção.
