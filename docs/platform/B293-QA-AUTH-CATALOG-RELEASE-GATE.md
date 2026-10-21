# JENIOS B293-QA — Auth, sessões, permissões e catálogo em modo privado
Data: 21/10/2026. Escopo somente JENIOS Platform, Social e Universidade QA.

## Proveniência
Base: B292 QA `bbdeaa35e880d940dd6bbae9652d0283ca6c668c`, CI `39673306907` SUCCESS, Vercel Preview `dpl_GMXxPug8Zj3e9un52XeM5tdBFmP8` READY.
Branch da execução: `fix/jenios-b291qa-integrated-preview-20261021`, para reutilizar o isolamento B291 já certificado. Não mesclar a branch de pesquisa paralela `fix/jenios-b293-private-evidence-readiness-20261021`.
Produção preservada: B177-R3 `caaffece04649a6dc1ca6c8012d7502887771529`, `dpl_7omqt69GFwJRMEUp4QCyx5hXrciF`.

## Entregas B293
- Catálogo financeiro fail-closed: `projectCatalogProducts` só marca um produto como configurado/ativo após confirmação de linha persistida no PAY, incluindo quando o catálogo vem parcialmente do banco. Um catálogo de contingência é sempre inativo. A API preserva `checkoutReady=false` e `paymentsEnabled=false` em falha.
- Testes automatizados adversariais: `tests/jeniosB293QaAuthBoundaries.test.mjs` confirma token ausente/inválido, Auth anônimo, papel `user_metadata` falsificado, permissão via `app_metadata`, separação Social/Platform, reset de senha simulado sem envio, cadastro fechado, logout por conta, isolamento do catálogo e bloqueio de flags externas.
- Smoke HTTP local GET-only: `scripts/platform/b293-qa-guest-smoke.mjs` verifica caminhos públicos, 401 em serviços protegidos, Gênio gratuito e catálogo sem autorização de cobrança. O script recusa alvos diferentes de localhost.
- CI B291 inclui explicitamente smoke B293 e seu artefato; não adiciona dependência paga ou secret de produção.

## Limites de homologação
Social QA `rebzztxlzofxpfwjvbee` e Platform QA `xaicvhagftzjkqphnbgx` continuam com 0 contas Auth na verificação inicial B293. Não é possível alegar login real, senha redefinida de verdade nem sessão multi-dispositivo sem contas de teste oficiais. Não criar usuários por INSERT SQL em `auth.users`; a operação deverá usar os mecanismos oficiais de autenticação, com identidades e fluxos controlados pelo proprietário.
Sem transferência de dados para produção, sem emissão Pix, sem ativação de IA paga e sem ordens de trading/Paper externo.
Advisors Social QA alertam para funções `SECURITY DEFINER` com grants; investigar intenções e privilégios separadamente, sem revogar funções públicas já usadas pela Social nem abrir RLS para atenuar alertas.

## Certificação e rollback
Critério de aceite deste bloco: GitHub Actions success do commit exato, 0 falhas nas regressões gerais/Social, smoke GET-only B293, Preview READY no projeto `jenios-ecossistem`, backup de código/relatório e verificação de produção inalterada.
Se ocorrer falha, reverter apenas o Preview B293 para B292 `bbdeaa35e880d940dd6bbae9652d0283ca6c668c` via backup versionado. Proibido promover a produção sem aprovação explícita.
