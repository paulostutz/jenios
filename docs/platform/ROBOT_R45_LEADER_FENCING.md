# ROBOT-R45 — Leader Election + Fencing Token / Lease

R45 extends certified R44 split-brain controls without changing prior blocks.

## Objectives

- elect a leader only from a partition with cluster majority;
- assign a strictly increasing fencing token on leadership changes;
- bind writes to leader identity + fencing token + current lease epoch;
- make a leader lose lease renewal when it loses quorum;
- block stale writers during partitions;
- keep stale writers blocked after reconvergence;
- allow the current leader to renew lease and continue safely.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
