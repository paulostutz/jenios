# ROBOT-R36 — Idempotency, Replay and Session/Auth Concurrency

R36 extends the certified R35 multi-session controls without modifying R35.

## Objectives

- make exact duplicate events idempotent;
- block conflicting replays that reuse an event ID with changed payload;
- block session changes before reset completion;
- block authorization changes inside an active session;
- block authorization reuse across sessions;
- preserve R33 hysteresis, R31 recovery/economic interlock and R34/R35 halted-session rules.

## Stress model

The default R36 battery uses 10 nominal sessions × 400 events plus injected:

- exact duplicate events;
- same-ID conflicting replay events;
- incomplete-reset concurrent session-switch attempts;
- partial risk reconciliation failures;
- adverse economic windows;
- repeated drawdown/loss-streak pressure.

No duplicated or concurrent event is allowed to create a second authorization or bypass a halt.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
