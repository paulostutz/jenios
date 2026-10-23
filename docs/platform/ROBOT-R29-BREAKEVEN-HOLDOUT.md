# ROBOT-R29 — Independent Break-even Holdout

R29 validates the R28 adaptive break-even policy without changing it.

The holdout uses values not used by the R28 refinement grid:
- cost: 0.7 / 1.4 / 2.7 / 4.5 / 7 / 10 bps;
- fill: 35% / 60% / 82% / 98%;
- win rate: 49% / 51.5% / 54.5% / 57.5% / 61% / 67% / 73%;
- gross win: 5 / 9 / 15 / 24 bps;
- loss ratios: 0.6 / 0.9 / 1.1 / 1.4;
- 7,000 deterministic attempts per configuration.

No recalibration is allowed in R29.
Success means better positive recall with no increase in negative false-positive releases.
