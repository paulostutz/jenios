# ROBOT-R31 — Recovery + Regime Interlock

R31 combines R26 recovery and R30 regime gating.

New entries require BOTH:
1. recovery state READY after reconnect, market-data resync, account reconciliation and risk reconciliation;
2. a fresh favorable economic regime evaluated in a new authorization epoch.

READY alone is insufficient.
A favorable regime alone is insufficient.
No prior authorization survives outage or regime change.

Reference pattern:
READY+GOOD -> allow
UNKNOWN EXPOSURE+GOOD -> block
READY+BAD ECONOMICS -> block
READY+NEW GOOD -> allow
