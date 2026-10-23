# ROBOT-R42 — Monotonic Generation + Rollback Protection

R42 extends certified R41 checkpoint integrity without changing prior blocks.

## Objectives

- assign a strictly increasing generation to each committed checkpoint;
- maintain a high-water mark that never decreases;
- reject any cryptographically valid snapshot older than the high-water mark;
- retain the immediately previous committed checkpoint as last-known-good fallback;
- if the newest checkpoint is corrupt, fall back by one generation only;
- do not lower the high-water mark after fallback;
- fail closed if both latest and previous checkpoints are invalid.

This prevents a valid but stale snapshot from reviving old session, authorization, risk or replay state.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
