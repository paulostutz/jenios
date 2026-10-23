# ROBOT-R44 — Five-replica Partition / Split-brain / Reconvergence

R44 extends certified R43 quorum controls without changing prior blocks.

## Objectives

- use five replicas with quorum = 3;
- simulate 2/3 network partitions;
- prevent the minority partition from promoting a generation;
- allow only the majority partition to advance the high-water mark;
- detect divergent records at the same generation;
- recover from the valid majority record;
- reconverge all replicas to the majority state;
- preserve high-water mark and fail closed without quorum.

All evidence remains synthetic/offline:
- actualBrokerPnl = null
- actualLossesAvoided = null
- realTradeAccuracy = null
- real orders = 0
- external Paper orders = 0
- deploy = disabled
