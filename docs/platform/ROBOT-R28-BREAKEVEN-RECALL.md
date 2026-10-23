# ROBOT-R28 — Break-even Recall Refinement

R28 refines the R27 gate to recover positive synthetic opportunities without increasing negative false positives.

Policy:
- baseline safety margin remains 1 bps;
- lower margins are permitted only when cost, fill, reward/risk and estimated win rate are jointly favorable;
- clearly weak configurations remain on the conservative 1 bps margin.

Success criteria:
1. adaptive positive recall > R27 baseline recall;
2. adaptive false-positive negative count <= baseline;
3. zero external execution.
