# ROBOT-R49 — Partial Fill / Cancel-Replace Race Reconciliation

R49 extends certified R48 without changing prior blocks.

It adds an offline synthetic order-state machine that tracks partial fills, cancel-pending state, cancel acknowledgements, replacement lineage, late fills, duplicate fill IDs and broker reconciliation.

Key invariants:
- replacement cannot be created before cancel acknowledgement;
- a late fill is accepted only when its exchange execution timestamp is not after the old order's terminal timestamp;
- duplicate fill events are idempotent;
- overfills and local/broker quantity mismatches force reconciliation-required;
- new order authorization is blocked while reconciliation divergence exists.

All evidence remains synthetic/offline. Real orders = 0. External Paper orders = 0. actualBrokerPnl, actualLossesAvoided and realTradeAccuracy remain null.
