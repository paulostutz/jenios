# JENIOS R89.001 — recuperação contra inventário adulterado

O módulo R80 de recuperação passa a comparar os pedidos recebidos com `pendingRecovery` do journal B152, quando disponível, antes de executar qualquer consulta à corretora. Exige correspondência exata de ID, símbolo, estado e quantidade. Inconsistências geram `R89_RECOVERY_INVENTORY_MISMATCH` e nenhuma consulta de ordem. Os testes R89 foram adicionados à CI privada consolidada.

**Limite:** o caminho legado que recebe um ledger sem `pendingRecovery` permanece existente para compatibilidade com testes e dependências antigas. O worker operacional futuro deve obrigatoriamente exigir a instância real `PaperLedger` e sua API de inventário; este bloco não é certificação ponta a ponta nem autoriza ativação. Não houve ordem, conexão externa, cobrança ou deploy em produção.

Produção R79 preservada; branch PR #22 DRAFT. R88 CI/Preview ainda precisam de aprovação do SHA final R89. Nenhuma alteração em CHEFE/LETTER.
