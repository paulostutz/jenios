# ROBOT-R34 — Independent Hysteresis Holdout + Session Reauthorization

R34 extends the certified R33 controls without changing R33 itself.

## 1. Independent hysteresis holdout

- the R33 hysteresis policy remains frozen;
- a separate deterministic generator exercises switching periods 1, 2, 3, 5, 8, 13 and 21;
- the holdout does not reuse the 24-step R33 pattern;
- raw economic gating is compared with hysteresis transition counts;
- no real trades or external Paper orders are permitted.

## 2. Session drawdown + recovery interlock

R34 combines the R33 session-risk memory with the R31 recovery/economic interlock.

After a session is halted by drawdown or loss streak:

- recovery returning to `READY` is not sufficient;
- favorable economics are not sufficient;
- the halted `sessionId` remains ineligible;
- a new `sessionId` and a new `authorizationId` are required;
- the new session still needs recovery `READY` and an eligible economic regime;
- risk counters are reset only for the explicitly new session.

This prevents a previously halted UltraFast session from silently resuming after a transient market improvement or infrastructure recovery.

## Evidence classification

All R34 results are synthetic/offline laboratory evidence.

- `actualBrokerPnl = null`
- `actualLossesAvoided = null`
- `realTradeAccuracy = null`
- real orders = 0
- external Paper orders = 0
- deploy = disabled
