# ROBOT-R35 — Multi-session Recovery / Reauthorization Stress

R35 extends the certified R34 controls into longer multi-session timelines.

## Scope

- multiple independent sessions;
- multiple risk halts;
- repeated infrastructure outages;
- delayed/partial recovery;
- economic regime degradation and recovery;
- repeated explicit reauthorization;
- stale-session and stale-authorization leak detection.

A halted session remains permanently ineligible. A new session must use a new session identifier and a new authorization identifier, then independently satisfy recovery READY, economic eligibility and R33 hysteresis before synthetic trade evaluation resumes.

## Stress battery

The default R35 battery spans:

- 12 sessions;
- 500 events per session;
- 6,000 total events;
- repeated transport, market-data, account and risk reconciliation failures;
- multiple drawdown/loss-streak halts;
- 11 explicit reauthorization boundaries.

All evidence remains synthetic/offline:

- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
