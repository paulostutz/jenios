# JENIOS R92.001 — auditoria de recuperação fail-closed

Verificados no GitHub os checkpoints B149–B177, R75 e R80–R91 antes de alterar qualquer código. O Preview principal da R91 corrigida, SHA `b7f2eca54f1409a537c21268afa58b4f66a43fc1`, está READY (`dpl_EiKyWDb23pbGp1TCGredgrpPGumr`). As outras verificações Vercel do mesmo commit falharam, portanto o conjunto não está globalmente aprovado.

R92 adiciona casos negativos à suíte existente R89: ledger sem `pendingRecovery` é rejeitado antes de consulta à corretora; divergência de símbolo entre pedido e journal também é rejeitada antes de consulta. Nenhuma mudança no executor, worker, API, flags ou schema.

Permanecem pendentes: host Node privado implantado com armazenamento durável e segredos, titular e conta de teste autenticados, teste oficial de broker, kill switch e reconciliação E2E, aprovação independente e integração nativa. A existência de conectores Binance Testnet/Alpaca Paper e guias cTrader/MT5 nos backups não comprova operação real. Nenhuma conta de corretora conectada foi comprovada.

Produção R79 e robôs privados R74 preservados. PR #22 continua DRAFT; não habilitar Paper externo/Live, Pix ou cobranças. Exigir CI do SHA R92 antes de promoção.
