# ROBOT-R38 — Multi-stream Ordering + Expired Replay Defense

R38 extends the certified R37 ingestion controls without changing prior blocks.

## Objectives

- isolate ordering state per stream/session;
- allow bounded reordering independently in simultaneous streams;
- keep a bounded active deduplication window;
- move expired IDs to a compact tombstone window;
- block old replay attempts even after an ID has left the active dedup window;
- preserve all R31–R37 risk, recovery, authorization, idempotency and ordering protections.

## Stress battery

Default R38 stress uses:

- 4 simultaneous streams;
- 1,800 nominal epochs per stream;
- interleaved delivery;
- out-of-order events;
- exact duplicates;
- stale epochs with fresh IDs;
- excessive forward gaps;
- replay of the first event after active-window expiration.

Active dedup and tombstone stores are both bounded.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
