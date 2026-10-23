# ROBOT-R50 — Fee / Spread / Slippage / Liquidity / Adverse-selection Shock Stress

R50 extends certified R49 without changing prior blocks.

It re-evaluates UltraFast economics under abrupt microstructure shocks. Effective cost combines fee, spread, slippage, liquidity-driven slippage and adverse selection. Liquidity cliffs also reduce effective fill probability.

Authorization is recalculated at every epoch. Fee spikes, spread shocks, slippage expansion, adverse-selection shocks and depth collapses can revoke eligibility immediately; a later favorable regime must re-authorize independently.

All evidence remains synthetic/offline. Real orders = 0. External Paper orders = 0. actualBrokerPnl, actualLossesAvoided and realTradeAccuracy remain null.
