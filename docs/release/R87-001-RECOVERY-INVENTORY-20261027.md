# JENIOS R87.001 — inventário de recuperação local sem ordens

Implementação aditiva em `PaperLedger.pendingRecovery` e `paper-recovery-inventory-r87.mjs`. Enumera no SQLite B152 somente ordens pendentes (SUBMITTING/UNKNOWN/ACK/PARTIAL), até 30, exigindo vínculo de titular e flags de execução explicitamente desligadas. O inventário não consulta corretora, não autoriza reenvio, não usa chaves e não muda o estado do kill switch. Teste offline `platformRobotR87RecoveryInventory.test.mjs` criado.

**Limitação conhecida:** B152 historicamente grava no corpo do intent apenas campos de ordem sem o símbolo do ativo. Assim, um intent legado pendente sem símbolo não pode ser reconciliado automaticamente por esta API e falha fechado com `RECOVERY_SYMBOL_MISSING`. Não preencher símbolos por suposição. A associação durável validada entre instrumento e intent deve ser implementada e testada antes de permitir qualquer worker real. Este checkpoint NÃO certifica recuperação ponta a ponta.

Base R86 `7879f441702100b3c750f944eb075af57a6a4e08`. R87 em PR #22 DRAFT, produção R79 preservada. Nenhuma conta, ordem externa, pagamento, worker ou deploy production. CI do SHA final pendente.
