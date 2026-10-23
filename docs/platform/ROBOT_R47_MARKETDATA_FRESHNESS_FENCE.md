# ROBOT-R47 — Market-data Freshness Fencing

R47 extends certified R46 without changing prior blocks.

It adds a separate market-data authorization fence. A valid leader lease is not sufficient: decision data must also belong to the current connection/source epoch, use the current leader fencing token, be within a bounded age window, preserve sequence continuity, and accumulate fresh confirmations after reconnect or handoff.

Scenarios covered: stale book, old source epoch after reconnect, sequence gaps, non-monotonic exchange timestamps, old leader market data after handoff, and mandatory resync/reconfirmation under the new leader fence.

All evidence remains synthetic/offline. Real orders = 0. External Paper orders = 0. actualBrokerPnl, actualLossesAvoided, and realTradeAccuracy remain null.
