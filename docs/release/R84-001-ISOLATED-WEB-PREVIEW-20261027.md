# JENIOS — R84.001 · Preview isolado R80–R83 sem execução financeira — 27/10/2026

## Estado anterior conferido nas fontes primárias
- Produção: branch `release/jenios-genios-g44-20261024`, SHA `a24922cc829dd1b45b87a719e9fd57ab45e6d79b`, deployment `dpl_3sNSm9PeR4qbRHs9RFZYyryDH68u` READY (R79).
- Trabalho paralelo preexistente: PR #22 DRAFT, head R83 `f8754b508fe81133759d13e8e7e62e85f928f63c`; CI R83 `40529465524` SUCCESS. Nenhum merge executado.
- Supabase Platform dedicado: migrações R79/R80/R81/R83 presentes, R83 cofre privado protegido por RLS e service_role. Nenhum cofre Live, consentimento Paper ou conta Alpaca operacional autenticada comprovado.
- Preview Vercel do head R83 `dpl_E4g1PMDkHq9XjHqiiMLjmpi8mew2` ERROR; logs: `S05_UNVERIFIED_PREVIEW_BRANCH`. CI verde local sem Vercel não comprova Preview funcional.
- R74 Edge permanece sintético, sem executor Paper/Live vinculado. CHEFE, LETTER, Social, PAY e M02 fora de escopo.

## Mudanças deste bloco
1. S05 reconhece exclusivamente a branch exata da PR #22 como Preview isolado da JENIOS, **nunca** como release Production.
2. Mantém o conjunto original de 20 flags externas obrigatoriamente `false` e exige mais 10 flags de risco, emissor, recuperação, vault, OAuth e worker R80–R83 explicitamente `false` no **web Preview**.
3. A Vercel recebeu variáveis separadas por branch: URLs QA Social e Platform permitidas, apenas chaves públicas sintéticas, nenhum segredo operacional, e 33 flags que desabilitam transações/atividade externa. Essas flags NÃO autorizam o host Node privado.
4. Adicionado teste `tests/platformRobotR84PreviewScope.test.mjs`: branch/ambiente, URLs, projeto e todas as flags negativas (ausente também bloqueia).
5. Não foram criados endpoints de ordem, workers financeiros, usuários, credenciais, pagamentos, ou migrations novas.

## Gates e aceite
- Exigir CI com SHA exato deste commit e um Preview Vercel READY no mesmo SHA antes de qualquer avanço de publicação.
- Preview web seguro não equivale a conectar um worker, aceitar riscos Paper do usuário, certificar recibos externos ou homologar Live.
- Manter PR #22 DRAFT, produção R79, flags de execução financeira `false` e chaves privadas ausentes.
- Para a próxima fase: preparar integração host privado e ledger persistente, recibos PAPER de conta consentida, ensaio de recovery/kill sob concorrência, revisão de segurança independente e distribuição nativa separada.

## Rollback
- A mudança de código está apenas na PR #22; reverter o commit da branch ou remover a branch de Preview restaura S05. A produção R79 fica intocada.
- Nenhuma migração foi incluída e nenhum dado financeiro foi alterado.
