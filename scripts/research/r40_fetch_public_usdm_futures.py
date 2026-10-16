#!/usr/bin/env python3
"""Separate, immutable R40 USD-M futures cross-venue audit, NO trading.

Reuse EXACT month coverage, symbols, checksum validation and CSV parser from
the previously committed R40 SPOT audit. Explicitly label this distinct venue.
Do not alter source prices or adapt hypotheses after observing results.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import r40_fetch_public_klines as baseline

baseline.BASE = "https://data.binance.vision/data/futures/um/monthly/klines"
baseline.OUT = Path("out-r40-usdm")
baseline.VENUE = "binance-vision-usd-m-futures"
baseline.main()

out = baseline.OUT
manifest_path = out / "MANIFESTO-DADOS-R40.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
assert manifest["market"] == "spot"  # Fail if baseline structure changes unexpectedly.
assert len(manifest["monthlySources"]) == 54
manifest["schema"] = "JENIOS_R40_BINANCE_USDM_FUTURES_SHA256"
manifest["market"] = "usd-m-futures"
manifest["source"] = "https://data.binance.vision/data/futures/um/monthly/klines"
manifest["spot"] = False
manifest["venueVerifiedAgainstPublishedChecksums"] = True
manifest["fundingRatesIncluded"] = False
manifest["makerTakerFeesObserved"] = False
manifest["bidAskSpreadObserved"] = False
manifest["fillsObserved"] = False
manifest["riskOfLiquidationModeled"] = False
manifest["note"] = (
    "Binance Vision USD-M futures public hourly klines checked against companion "
    "CHECKSUM over HTTPS. Research only, not funding-, fill-, spread-, margin- or "
    "liquidation-complete. Not proof of client loss avoided."
)
for symbol in baseline.SYMBOLS:
    data = manifest["normalizedDatasets"][symbol]
    old_path = out / "normalized" / Path(data["path"]).name
    new_path = old_path.with_name(old_path.name.replace("-spot-", "-usdm-futures-"))
    assert old_path.exists()
    old_path.rename(new_path)
    data["path"] = new_path.as_posix()
    assert hashlib.sha256(new_path.read_bytes()).hexdigest() == data["sha256"]
assert all("/futures/um/" in x["source_url"] for x in manifest["monthlySources"])
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
(out/"RESULTADO-R40.txt").write_text(
    "R40 USD-M futures audit PASS: 54 monthly ZIPs and official checksums. "
    "Klines only; no financing, order book, brokerage fills or market execution proof.\n",
    encoding="utf-8"
)
print("FUTURES R40 VERIFIED", sum(x["rows"] for x in manifest["normalizedDatasets"].values()))
