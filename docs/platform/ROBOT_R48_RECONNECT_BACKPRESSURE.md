# ROBOT-R48 — Reconnect Storms + Rate Limits + Adaptive Backpressure

R48 extends certified R47 without changing prior blocks.

It adds reconnect generations, exponential backoff, bounded queues, explicit request budgets, stale-task expiration and decision blocking under high queue pressure. Any reconnect invalidates work created under the previous connection generation. Rate-limit budget exhaustion stops draining rather than creating retry storms.

All evidence remains synthetic/offline. Real orders = 0. External Paper orders = 0. actualBrokerPnl, actualLossesAvoided and realTradeAccuracy remain null.
