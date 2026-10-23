# ROBOT-R32 — Long-run Interlock Holdout

R32 freezes the R31 interlock and validates it over long deterministic timelines without tuning.

Coverage:
- 120 / 600 / 1,200 / 2,400 / 4,800 events;
- repeated outages;
- unknown exposure;
- partial recovery;
- stale market-data recovery;
- good and bad economic regimes;
- monotonic epochs;
- no stale authorization carryover.

Core invariant:
ALLOW only when recovery is complete and the current economic regime is eligible.
