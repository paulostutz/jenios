#!/usr/bin/env python3
"""R40 public data acquisition ONLY: no proprietary strategy code, no keys, no trading.

Immutable research data window: 2024-01-01 <= t < 2025-07-01 UTC.
2024 = development; Jan-Jun 2025 = unexamined holdout. Do not optimize on holdout.
Source: Binance Vision public SPOT 1h monthly klines, each SHA-256 checked
against the companion CHECKSUM downloaded from Binance Vision.
"""
from __future__ import annotations
import calendar
import concurrent.futures
import csv
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
import time
import urllib.request
import zipfile

SYMBOLS = ("BTCUSDT", "ETHUSDT", "SOLUSDT")
MONTHS = [(y, m) for y in (2024, 2025)
          for m in range(1, 13) if y == 2024 or m <= 6]
CUTOFF = "2025-01-01T00:00:00Z"
END_EXCLUSIVE = "2025-07-01T00:00:00Z"
VENUE = "binance-vision-spot"
BASE = "https://data.binance.vision/data/spot/monthly/klines"
OUT = Path("out-r40")
HOUR_MS = 3_600_000
MAX_ZIP_BYTES = 8_000_000
MAX_CSV_BYTES = 20_000_000

def fail(message: str):
    raise ValueError(message)

def download(url: str) -> bytes:
    if not url.startswith(BASE + "/"):
        fail("Unexpected market-data host or path")
    error = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent":"JENIOS-R40-market-data-audit/1.0"})
            with urllib.request.urlopen(request, timeout=45) as response:
                if response.status != 200:
                    fail("Unexpected HTTP status")
                result = response.read(MAX_ZIP_BYTES + 1)
                if len(result) > MAX_ZIP_BYTES:
                    fail("Response size limit exceeded")
                return result
        except Exception as exc:
            error = exc
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to obtain official market data from {url}: {error}")

def timestamp_ms(raw: str) -> int:
    t = int(raw)
    # Binance Vision SPOT switched from milliseconds to microseconds on 2025-01-01.
    if t >= 100_000_000_000_000:
        if t % 1000 not in (0, 999):
            fail("Unexpected microsecond precision in open/close time")
        t //= 1000
    if t < 1_500_000_000_000 or t > 1_800_000_000_000:
        fail("Unsupported candle timestamp epoch")
    return t

def load_one(item):
    symbol,year,month = item
    period=f"{year:04d}-{month:02d}"
    name=f"{symbol}-1h-{period}.zip"
    url=f"{BASE}/{symbol}/1h/{name}"
    zip_bytes=download(url)
    checksum_bytes=download(url+".CHECKSUM")
    expected_matches=re.findall(rb"(?m)^([0-9a-fA-F]{64})\s+\*?([^\r\n]+)\s*$",checksum_bytes)
    if len(expected_matches)!=1 or expected_matches[0][1].decode("utf-8").strip()!=name:
        fail(f"Bad or mismatched official CHECKSUM file for {name}")
    expected=expected_matches[0][0].decode("ascii").lower()
    actual=hashlib.sha256(zip_bytes).hexdigest()
    if expected!=actual:
        fail(f"SHA256 verification FAILED for {name}")
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        names=archive.namelist()
        if len(names)!=1 or names[0]!=name[:-4]+".csv":
            fail(f"Unexpected ZIP entries for {name}: {names}")
        info=archive.getinfo(names[0])
        if info.file_size>MAX_CSV_BYTES:
            fail("Uncompressed file too large")
        csv_bytes=archive.read(names[0])
    if len(csv_bytes)>MAX_CSV_BYTES:
        fail("Decompressed file exceeds size limit")
    reader=csv.reader(io.StringIO(csv_bytes.decode("utf-8-sig")))
    rows=[]
    previous=None
    first_epoch=int(datetime(year,month,1,tzinfo=timezone.utc).timestamp()*1000)
    expected_rows=calendar.monthrange(year,month)[1]*24
    for columns in reader:
        if len(columns)==0:
            continue
        if not columns[0].lstrip("+-").isdigit() and previous is None:
            if "time" in columns[0].lower():
                continue
            fail("Unrecognized CSV header")
        if len(columns)!=12:
            fail(f"Expected 12 Binance spot kline fields: {name}")
        t=timestamp_ms(columns[0]);close_t=timestamp_ms(columns[6])
        if close_t!=t+HOUR_MS-1:
            fail("Wrong kline close time")
        if previous is None:
            if t!=first_epoch:
                fail("Month does not start at midnight UTC")
        elif t-previous!=HOUR_MS:
            fail("Missing, duplicated or unsorted hourly candle")
        try:
            o,h,l,c,v=map(Decimal,(columns[1],columns[2],columns[3],columns[4],columns[5]))
        except InvalidOperation:
            fail("Invalid numeric OHLCV value")
        if not all(x.is_finite() for x in (o,h,l,c,v)):
            fail("OHLCV contains infinity/NaN")
        if min(o,l,c)<=0 or v<0 or h<max(o,c,l) or l>min(o,c):
            fail("OHLCV violates basic bounds")
        date=datetime.fromtimestamp(t/1000,tz=timezone.utc).strftime("%d-%m-%Y %H:%M")
        rows.append(f"{date},{columns[1]},{columns[2]},{columns[3]},{columns[4]},{columns[5]}\n")
        previous=t
    if len(rows)!=expected_rows:
        fail(f"Incorrect number of rows: {name}: {len(rows)} expected {expected_rows}")
    return {"symbol":symbol,"period":period,"zip_name":name,"source_url":url,
            "checksum_url":url+".CHECKSUM", "zip_sha256":actual,
            "checksum_sha256":hashlib.sha256(checksum_bytes).hexdigest(),
            "source_csv_sha256":hashlib.sha256(csv_bytes).hexdigest(),
            "row_count":len(rows),"start_ms":first_epoch,
            "end_ms":previous,"observations":rows,
            "zip_bytes":zip_bytes,"checksum_bytes":checksum_bytes}

def main():
    items=[(s,y,m) for s in SYMBOLS for y,m in MONTHS]
    # Avoid leaking information in logs other than public file dates/hashes.
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        records=list(pool.map(load_one,items))
    OUT.mkdir(parents=True,exist_ok=True)
    public_records=[]
    all_observations={s:["Date,Open,High,Low,Close,Volume\n"] for s in SYMBOLS}
    for item in records:
        symbol,period=item["symbol"],item["period"]
        folder=OUT/"archives"/symbol
        folder.mkdir(parents=True,exist_ok=True)
        (folder/item["zip_name"]).write_bytes(item["zip_bytes"])
        (folder/(item["zip_name"]+".CHECKSUM")).write_bytes(item["checksum_bytes"])
        all_observations[symbol].extend(item["observations"])
        public_records.append({key:item[key] for key in ("symbol","period","zip_name","source_url",
           "checksum_url","zip_sha256","checksum_sha256","source_csv_sha256",
           "row_count","start_ms","end_ms")})
    datasets={}
    normalized=OUT/"normalized"
    normalized.mkdir(exist_ok=True)
    for symbol in SYMBOLS:
        content="".join(all_observations[symbol]).encode("utf-8")
        path=normalized/f"{symbol}-spot-1h-2024-01_2025-06.csv"
        path.write_bytes(content)
        n=len(all_observations[symbol])-1
        training=366*24
        holdout=181*24
        if n!=training+holdout:
            fail("Unexpected development/holdout row counts")
        datasets[symbol]={"path":path.as_posix(),"sha256":hashlib.sha256(content).hexdigest(),
            "rows":n,"development_rows":training,"holdout_rows":holdout,
            "first":"2024-01-01T00:00:00Z","last":"2025-06-30T23:00:00Z"}
    manifest={"schema":"JENIOS_R40_OFFICIAL_SPOT_KLINES_SHA256","source":"https://data.binance.vision",
       "market":"spot","interval":"1h","exchangeProvidedHistoricalArchive":True,
       "exchangeDataTruthIndependentlyProven":False,
       "frozenTrainingEndExclusive":CUTOFF,"frozenDatasetEndExclusive":END_EXCLUSIVE,
       "trainingRange":"2024-01-01 to 2024-12-31","holdoutRange":"2025-01-01 to 2025-06-30",
       "symbols":list(SYMBOLS),"monthlySources":public_records,"normalizedDatasets":datasets,
       "synthetic":False,"liveExecutionPermitted":False,"customerLossAvoidedProven":False,
       "note":"Official zip SHA-256 matched companion CHECKSUM downloaded over HTTPS; does not certify market fills, real client intents, or profitability."}
    (OUT/"MANIFESTO-DADOS-R40.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    summary=f"R40 official archive audit PASS: {len(records)} monthly files with matching Binance Vision CHECKSUM; "+", ".join(f"{s}: {datasets[s]['rows']} hours" for s in SYMBOLS)
    (OUT/"RESULTADO-R40.txt").write_text(summary+"\n",encoding="utf-8")
    print(summary)

if __name__=="__main__":
    main()
