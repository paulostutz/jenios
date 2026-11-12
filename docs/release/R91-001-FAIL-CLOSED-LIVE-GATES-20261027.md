# JENIOS R91 — endurecimento de recuperação e bloqueio de Live

R91 elimina o fallback permissivo de `recoverR80PaperAfterRestart`: a recuperação exige inventário persistente `pendingRecovery` e correspondência exata de ID, símbolo e estado. Falta de inventário bloqueia o procedimento, sem contato com a corretora. Atualizado teste legado R80.

**Status comprovado:** produção R79 `a24922cc829dd1b45b87a719e9fd57ab45e6d79b`; PR #22 DRAFT, R90 Preview principal READY. Supabase Platform: 0 contas de corretora, 0 autorizações Paper, 0 linhas de risco e 0 contas Live. Não existe autorização para executar ordens Live, nem evidência de teste externo. O núcleo privado R74 continua sintético. Nenhum serviço financeiro foi ativado.

**NO-GO operacional:** ainda faltam worker privado real com ledger persistente, controle de segredos, sessão e consentimento do cliente, conta demo/testnet vinculada, recibos oficiais, reconciliação e kill switch concorrente com revisão independente, além de requisitos regulatórios e contratuais por corretora. Não alterar flags de ordens reais nem publicar esta PR sem CI, homologação e rollback. Conectores B155–B177 devem ser reutilizados; não reconstruir Binance, cTrader ou MT5.
