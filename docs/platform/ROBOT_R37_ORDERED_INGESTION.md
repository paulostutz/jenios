# ROBOT-R37 — Ordered Ingestion + Late Epoch Defense

R37 extends the certified R36 controls without changing prior blocks.

## Objectives

- accept a small bounded amount of event reordering;
- buffer near-future epochs and drain them only after missing epochs arrive;
- reject late/stale epochs even when they use a fresh event ID;
- reject gaps beyond the configured reorder tolerance;
- maintain a bounded deduplication window;
- preserve all R31–R36 session, recovery, risk, authorization and replay protections.

## Stress battery

The default R37 battery creates a nominal 5,000-epoch stream and injects:

- one-step out-of-order events;
- exact duplicates;
- fresh-ID stale epochs;
- excessive forward gaps;
- deterministic risk pressure inherited by the R36 execution gate.

The dedup window is bounded to prevent uncontrolled state growth.

All evidence remains synthetic/offline:

- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
