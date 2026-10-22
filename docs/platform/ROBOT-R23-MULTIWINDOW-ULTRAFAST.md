# ROBOT-R23 — Multiwindow UltraFast

R23 converts UltraFast ranking from one snapshot into a multiwindow stability model and adds:
- availability / maintenance gate;
- maker vs taker adjusted for adverse selection;
- 10k and 20k high-turnover stress sessions;
- stability penalty when an asset is only intermittently eligible.

All execution remains synthetic/read-only. No real or external Paper orders.
