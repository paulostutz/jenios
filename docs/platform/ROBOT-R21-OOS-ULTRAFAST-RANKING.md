# ROBOT-R21 — OOS Alignment + UltraFast Ranking

R21 validates the R20 threshold candidates on a frozen out-of-sample synthetic set and expands UltraFast with:
- fill probability;
- queue deterioration;
- broker/exchange rate-limit gating;
- cost-adjusted crypto ranking;
- high-turnover sessions with cumulative cost, drawdown and loss-streak stops.

No threshold is auto-promoted from this block. A winner is only a candidate for the next refinement.
No real or external Paper orders are sent.
