# ROBOT-R40 — Fail-closed Snapshot Validation + Buffered Checkpoint Recovery

R40 extends certified R39 persistence without changing prior blocks.

## Objectives

- reject incompatible snapshot versions;
- reject corrupt/incomplete snapshot headers and stream state;
- reject stale or mismatched reorder-buffer entries;
- fail closed with operational authorization disabled on any restore error;
- persist and restore checkpoints taken while out-of-order events are still buffered;
- drain the restored buffer only after the missing epoch arrives.

## Safety invariant

A broken or incompatible persisted state must never be interpreted as a clean session. Restore failure results in no operational authorization.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
