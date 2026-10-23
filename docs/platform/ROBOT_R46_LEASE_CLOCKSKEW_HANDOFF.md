# ROBOT-R46 — Lease Expiry + Clock Skew + Handoff / Crash Recovery

R46 extends certified R45 leader fencing without changing prior blocks.

## Objectives

- lease validity is decided by monotonic authority time, never by node-local clock alone;
- tolerate bounded clock skew but block excessive skew;
- GC/process pauses longer than the lease cannot preserve write authority;
- leader losing quorum cannot renew lease;
- graceful handoff immediately revokes the old leader and advances fencing;
- abrupt crash permits a new quorum leader with a higher fencing token;
- stale writer remains blocked after handoff or crash recovery.

## Safety invariant

A node may believe locally that its lease is still valid, but write authorization still fails if authority time says the lease expired or the fencing token is stale.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
