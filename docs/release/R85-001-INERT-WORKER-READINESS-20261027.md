# JENIOS R85.001 — verificação de prontidão privada (sem executor)

R85 acrescenta somente um diagnóstico privado que nunca devolve autorização de execução. Confere identidade do titular, dependências e flags financeiras fechadas; consulta o estado R80 via RPC de serviço, sem alterar o banco. Se a linha está ACTIVE, o retorno ainda é `ready:false` com `WORKER_NOT_DEPLOYED`; se PAUSED, continua bloqueado. Não cria worker, endpoint, conta, credencial, ordem ou cobrança.

Base anterior R84 `6e5a4426ee0c006986e230dce04e5e3f097ac496`; branch da PR #22 DRAFT; produção R79 `a24922cc829dd1b45b87a719e9fd57ab45e6d79b` preservada. R84 Preview `dpl_8yokLBnRj3r51xWLP5GiDjuhDRw4` ainda QUEUED na última verificação; CI R84 não confirmada. Não alegar homologação R85 antes de CI e revisão. Próximos passos exigem worker privado isolado, ledger persistente, credenciais Paper voluntárias e recibos externos, kill/recovery E2E e revisão independente.
