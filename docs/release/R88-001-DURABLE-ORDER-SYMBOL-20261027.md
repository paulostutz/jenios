# JENIOS R88.001 — binding atômico do símbolo no ledger B152

R88 altera somente o SQLite local de ensaio B152: adiciona tabela `intent_symbols`, grava `meta.id` validado na mesma transação da reserva de risco e faz `pendingRecovery` consultar esse vínculo durável. Registros antigos sem vínculo permanecem sem reconciliação automática (`RECOVERY_SYMBOL_MISSING`), não recebem preenchimento presumido.

Teste `tests/platformRobotR88DurableSymbol.test.mjs` exercita reserva, SUBMITTING, restart, UNKNOWN, idempotência e bloqueio de novas ordens enquanto existir UNKNOWN, sem acesso a corretora. Workflow R80–R88 atualizado.

Base anterior R87 `6f372d798f352c18ff4b710577875b25165c47df`; Preview R87 `dpl_FFFSTHSw7myT9gXNdWZekPPy6gxP` READY. Branch PR #22 DRAFT, release R79 `a24922cc829dd1b45b87a719e9fd57ab45e6d79b` preservada.

**Não há executor privado operacional, conta Alpaca Paper autorizada, recibo externo ou cancelamento confirmado.** R88 não cria ordem, pagamento, endpoint público, migration Supabase ou alteração de apps. Exigir CI/Preview exatos antes de homologar; revisão independente de segurança e kill switch ponta a ponta continuam pendentes.
