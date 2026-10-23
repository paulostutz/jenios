# ROBOT-R27 — Dynamic Break-even Gate

R27 converts UltraFast from "high trade count" to "high opportunity throughput with economic filtering".

Before any synthetic attempt is eligible, the gate computes:
- expected win probability;
- gross win and gross loss;
- total friction;
- fill probability;
- safety margin;
- required break-even win rate;
- expected net edge.

The gate blocks the attempt when the estimated probability/edge does not clear break-even plus safety margin.

The block compares ungated vs gated policy across a large deterministic grid.
No real or external Paper orders are sent.
