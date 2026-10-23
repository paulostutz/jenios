# ROBOT-R22 — Public Crypto Ranking + Second Holdout

R22 keeps the production alignment guard at 0.65 while testing a second independent holdout.
It also defines a public read-only crypto ranking layer for UltraFast using:
- bid/ask spread;
- top-book/aggregated depth supplied by a public provider snapshot;
- recent trade activity;
- short-horizon volatility;
- maker/taker expected cost with fill probability.

The ranking layer never authenticates, never submits orders and never claims broker PnL.
