# ROBOT-R39 — Restart-safe State Persistence + Session Rotation

R39 extends certified R38 protections without changing prior blocks.

## Objectives

- snapshot per-stream ordering, dedup, tombstones and buffered events;
- persist R36 session/auth/risk state across process restart;
- restore halted sessions and processed-event fingerprints;
- rotate sessions independently per stream only after complete reset;
- reject session or authorization reuse;
- preserve replay protection after worker restart.

## Stress battery

R39 validates 3 streams with state persisted after hundreds of events, rotates each stream to a new session/authorization, serializes the state, restores it into a fresh process model and then attempts:

- replay of old session events;
- continued ingestion on the new session;
- reuse/incomplete reset attempts.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
