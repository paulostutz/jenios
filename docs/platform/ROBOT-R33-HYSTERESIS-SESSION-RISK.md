# ROBOT-R33 — Hysteresis + Session Drawdown

R33 adds two controls for long UltraFast sessions.

1. Economic hysteresis
- requires consecutive favorable snapshots before enabling;
- bad conditions revoke quickly;
- prevents excessive ALLOW/BLOCK oscillation around a boundary.

2. Session risk memory
- cumulative drawdown and loss-streak survive regime changes;
- a halted session does not resume merely because economics become favorable again;
- restart requires a new session/recovery process outside this model.

All testing remains synthetic/offline with zero external execution.
