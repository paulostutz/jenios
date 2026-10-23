# ROBOT-R43 — Replicated Checkpoint Quorum + Divergence Detection

R43 extends certified R42 checkpoint rollback protection without changing prior blocks.

## Objectives

- replicate checkpoint records across an odd-sized replica set;
- advance high-water mark only when a majority receives the new generation;
- restore only from a valid quorum of identical generation/checksum records;
- detect divergent copies at the same generation;
- fall back only one generation when the latest valid quorum is lost;
- preserve the high-water mark during fallback;
- fail closed when no valid quorum exists.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
