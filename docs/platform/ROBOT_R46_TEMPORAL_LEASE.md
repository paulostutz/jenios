# ROBOT-R46 — Temporal lease, stalls, handoff and crash

Base: certified R45 backup `backup/jenios-robot-r45-leader-fencing-certified-20261023`, commit `366662b1dfa3653efb7da259101f462eacd25bd9`.
Branch: `research/jenios-robot-r46-temporal-lease-20261023`.

R46 adds an isolated offline authority model. R12–R45 modules, tests, checkpoints and workflows remain unchanged. There is no execution transport.

Every write is checked at acceptance against authority monotonic time, leader identity, fencing token, current lease epoch, online state and majority quorum. Validity is the half-open interval ending at `expiresAt`: equality is already expired. Client timestamps and claimed deadlines have no authority.

A delayed or paused writer must revalidate on resumption. Expired leases cannot renew; a new election advances term, fencing token and lease epoch. Renewal preserves the fencing token while advancing the lease epoch, invalidating old credentials. Graceful handoff replaces the lease atomically after owner, target and shared-quorum validation. Abrupt crash blocks the offline writer immediately; takeover waits for expiration. Restarted old nodes cannot reuse credentials.

Authority rollback, nonfinite clock readings or clock exceptions permanently close this instance. A recovered clock cannot silently reopen it. Losing quorum blocks writes and renewals. Reconvergence cannot revive an expired or superseded credential.

## Evidence scope

Deterministic injected time covers exact boundaries, arbitrarily skewed writer timestamps, long pauses, renewal, partition/reconvergence, graceful handoff and crash/restart. A real monotonic clock test blocks the event loop for 25 ms against a 10 ms lease. A 2,000-cycle stress checks expired and superseded credentials on every leadership change.

This is a single trusted authority simulation, not a deployed distributed consensus/time protocol. It does not establish bounded drift between independent authority clocks, host-suspend behavior, authority restart persistence, or atomic enforcement by a real broker/storage service. Those require separate research. A prior successful check is never a transferable execution permit; actual acceptance must perform the check itself.

All evidence is synthetic/offline. `actualBrokerPnl`, `actualLossesAvoided`, and `realTradeAccuracy` remain null. Real orders and external Paper orders are zero. No production, merge or deploy.
