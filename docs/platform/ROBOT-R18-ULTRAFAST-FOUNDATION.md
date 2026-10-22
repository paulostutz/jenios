# ROBOT-R18 — UltraFast Foundation

## Product concept
UltraFast is a separate JENIOS robot for very short holding periods. The user chooses an eligible asset, capital allocation, leverage preference and either a single-operation mode or a timed automatic session. The production design requires real-time market data, an authenticated broker/exchange connection, explicit customer consent, market-hours awareness and a hard kill switch.

## Important naming
Do not market this as institutional HFT unless JENIOS is actually operating with infrastructure capable of that classification. The initial product should be described as low-latency / ultra-short-term automated trading.

## Mandatory production gates
- live order book / quotes with freshness validation;
- dynamic asset eligibility based on spread, volatility, depth and activity;
- expected edge must clear fees + spread + slippage + safety margin;
- maximum per-trade and per-session risk;
- consecutive-loss and drawdown kill switches;
- broker rejection / stale-feed kill switches;
- timed sessions must stop before market close;
- crypto can be 24/7 but must still respect exchange maintenance and symbol availability;
- equities/indices require exchange-session calendars;
- no martingale, no loss-chasing and no risk escalation after losses.

## Product behavior
Single operation:
- JENIOS may indicate buy/sell/wait.
- Operator decision remains final.
- Robot manages short stop-gain/stop-loss only if/when execution is separately authorized.

Timed automatic session:
- customer chooses asset, capital, leverage preference and duration;
- after explicit Play/consent, future production version may choose buy/sell/wait automatically;
- it must stop on duration, market close, risk limits, stale data, connectivity failure or kill-switch event.

## Economics
Thousands of operations can be economically viable only where fee tier, spread, slippage and queue position are favorable. A positive directional model can still lose money after trading friction. Asset selection must therefore be cost-adjusted, not volatility-only.

## Monetization hypothesis
Preferred first path: free/low-cost access plus a broker/exchange partnership or affiliate/revenue share based on trading fees generated, where contractually and legally permitted.

Performance-fee charging is a separate product/legal problem. If ever offered, it should be based on consolidated net performance with losses and a high-water mark, not a fee on each isolated winning trade. Regulatory/legal review is required before launch.

This R18 block is research-only and sends no orders.
