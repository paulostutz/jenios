# ROBOT-R41 — Snapshot Integrity + Atomic Checkpoint Protocol

R41 extends certified R40 persistence without modifying prior blocks.

## Objectives

- SHA-256 integrity seal over canonical snapshot content;
- detect silent mutation before restore;
- detect truncation/incomplete payload;
- two-phase checkpoint protocol: STAGED then COMMITTED;
- never recover an uncommitted staging record;
- recover only the last fully committed and integrity-verified snapshot;
- fail closed on every integrity or compatibility error.

This models process interruption exactly during persistence: a crash after staging cannot create a valid operational checkpoint.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
