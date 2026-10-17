#!/usr/bin/env python3
"""R42: Binance Vision USD-M funding-only public audit. NO strategy, keys or orders."""
from __future__ import annotations
import calendar, concurrent.futures, csv, hashlib, io, json, re, time, urllib.request, zipfile
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

BASE="https://data.binance.vision/data/futures/um/monthly/fundingRate"
OUT=Path("r42-official-funding")
SYMBOLS=("BTCUSDT","ETHUSDT","SOLUSDT")
MONTHS=[(y,m) for y in (2025,2026) for m in range(1,13) if (y==2025 and m>=7) or (y==2026 and m<=9)]
SHA=lambda b: hashlib.sha256(b).hexdigest()
LIMIT=4_000_000
assert len(MONTHS)==15

def fail(reason):
    raise ValueError("R42_FUNDING_REJECTED: "+reason)

def download(url):
    if not url.startswith(BASE+"/"): fail("nonofficial origin")
    for i in range(4):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"JENIOS-R42-FUNDING-AUDIT/1.0"})
            with urllib.request.urlopen(req,timeout=40) as response:
                if response.status!=200: fail("unexpected HTTP code")
                blob=response.read(LIMIT+1)
                if len(blob)>LIMIT: fail("oversized source")
                return blob
        except Exception:
            if i==3: raise
            time.sleep((i+1)*1.1)

def time_ms(v):
    n=int(v)
    if n>=100_000_000_000_000:
        if n%1000: fail("funding timestamp micros not aligned")
        n//=1000
    if n<1_500_000_000_000 or n>1_900_000_000_000: fail("timestamp out of bounds")
    return n

def parse_csv(blob, symbol, year, month, require_complete=True):
    text=blob.decode("utf-8-sig")
    rdr=csv.DictReader(io.StringIO(text))
    headers=rdr.fieldnames or []
    if len(headers)<2 or len(headers)>8 or len(set(headers))!=len(headers): fail("unexpected header layout")
    timename=next((v for v in ("calc_time","fundingTime","funding_time") if v in headers),None)
    ratename=next((v for v in ("last_funding_rate","fundingRate","funding_rate") if v in headers),None)
    if not timename or not ratename: fail("unknown official funding schema: "+repr(headers))
    start=int(datetime(year,month,1,tzinfo=timezone.utc).timestamp()*1000)
    last=int(datetime(year+int(month==12),month%12+1,1,tzinfo=timezone.utc).timestamp()*1000)
    result=[]; prev=None
    for row in rdr:
        if None in row: fail("malformed data columns")
        try:
            ts=time_ms(row[timename]); rate=Decimal(row[ratename])
        except (InvalidOperation,ValueError,TypeError,KeyError) as exc:
            fail("invalid timestamp/rate: "+str(exc))
        if not (rate.is_finite() and abs(rate)<Decimal("0.1")): fail("nonfinite/extreme funding")
        if not (start<=ts<last): fail("event outside archive month")
        if prev is not None and (ts<=prev or ts-prev>36*3600_000): fail("duplicate, unsorted or >36h funding gap")
        result.append((ts,str(rate)))
        prev=ts
    if not result: fail("empty funding archive")
    if require_complete and (result[0][0]-start>36*3600_000 or last-result[-1][0]>36*3600_000): fail("month edge >36h gap")
    return result,headers

def load(key):
    symbol,year,month=key
    period=f"{year:04d}-{month:02d}"
    filename=f"{symbol}-fundingRate-{period}.zip"
    url=f"{BASE}/{symbol}/{filename}"
    archive=download(url)
    check=download(url+".CHECKSUM")
    match=re.fullmatch(rb"\s*([0-9a-fA-F]{64})\s+\*?([^\r\n\s]+)\s*",check)
    if match is None or match.group(2).decode()!=filename: fail("checksum name/format")
    if SHA(archive)!=match.group(1).decode().lower(): fail("ZIP SHA256 mismatch: "+filename)
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if z.testzip() is not None: fail("ZIP CRC")
        names=z.namelist()
        if names!=[filename.replace(".zip",".csv")]: fail("archive members")
        info=z.getinfo(names[0])
        if info.file_size>LIMIT*2: fail("inflated CSV too large")
        csv_data=z.read(info)
    values,headers=parse_csv(csv_data,symbol,year,month)
    return {
        "symbol":symbol,"period":period,"filename":filename,"url":url,
        "officialChecksumUrl":url+".CHECKSUM","archiveSha256":SHA(archive),
        "checksumSha256":SHA(check),"sourceCsvSha256":SHA(csv_data),
        "events":len(values),"firstTime":values[0][0],"lastTime":values[-1][0],
        "columnNames":headers,"values":values,"zip":archive,"checksum":check
    }

def selftest():
    a="calc_time,funding_interval_hours,last_funding_rate\n1751328000000,8,0.00010\n"
    b="fundingTime,fundingRate\n1751328000000,-0.00005\n"
    assert parse_csv(a.encode(),"BTCUSDT",2025,7,require_complete=False)[0]==[(1751328000000,"0.00010")]
    assert parse_csv(b.encode(),"BTCUSDT",2025,7,require_complete=False)[0]==[(1751328000000,"-0.00005")]
    for wrong in (a.replace("0.00010","NaN"), a.replace("0.00010","0.9")):
        try: parse_csv(wrong.encode(),"BTCUSDT",2025,7,require_complete=False)
        except ValueError: pass
        else: raise AssertionError("Invalid rate accepted")
    print("R42 funding parser selftest PASS")

def main():
    selftest()
    keys=[(s,y,m) for s in SYMBOLS for y,m in MONTHS]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        files=list(pool.map(load,keys))
    OUT.mkdir(parents=True,exist_ok=True)
    sources=[];normalized={}
    for symbol in SYMBOLS:
        selected=sorted((x for x in files if x["symbol"]==symbol),key=lambda x:x["period"])
        assert len(selected)==15
        events=[]
        for f in selected:
            for a,b in f["values"]:
                if events and (a<=events[-1][0] or a-events[-1][0]>36*3600_000):
                    fail("cross-month funding gap/duplicate")
                events.append((a,b))
        csvbody="fundingTime,fundingRate\n"+"".join(f"{t},{rate}\n" for t,rate in events)
        path=OUT/"normalized"/f"{symbol}-funding-2025-07_2026-09.csv"
        path.parent.mkdir(exist_ok=True)
        data=csvbody.encode()
        path.write_bytes(data)
        normalized[symbol]={"filename":path.name,"sha256":SHA(data),
             "eventCount":len(events),"startTime":events[0][0],"lastTime":events[-1][0]}
    for f in files:
        dest=OUT/"sources"/f["symbol"]
        dest.mkdir(parents=True,exist_ok=True)
        (dest/f["filename"]).write_bytes(f["zip"])
        (dest/(f["filename"]+".CHECKSUM")).write_bytes(f["checksum"])
        sources.append({k:f[k] for k in ("symbol","period","filename","url","officialChecksumUrl",
          "archiveSha256","checksumSha256","sourceCsvSha256","events","firstTime","lastTime","columnNames")})
    manifest={"schema":"JENIOS_R42_BINANCE_VISION_USDM_FUNDING_SHA256_V1",
        "source":BASE,"start":"2025-07-01T00:00:00Z","endExclusive":"2026-10-01T00:00:00Z",
        "symbols":SYMBOLS,"monthsPerSymbol":15,"archivesVerified":len(sources),
        "normalized":normalized,"monthlySources":sources,
        "checksumsPublishedByExchange":True,"exchangeDataIndependentVerification":False,
        "tradingEnabled":False,"brokerFillsMeasured":False,
        "limitations":"Funding rates from exchange archives; actual funding paid needs quantity and mark-price at settlement. No execution, spread or liquidation validation."}
    (OUT/"MANIFESTO-FUNDING-R42.json").write_text(json.dumps(manifest,indent=2)+"\n")
    (OUT/"RESULTADO-R42.txt").write_text(
        f"PASS: {len(sources)} official ZIP/CHECKSUM matches; "+", ".join(f"{s}={normalized[s]['eventCount']}" for s in SYMBOLS)+"; NO_GO\n")
    print((OUT/"RESULTADO-R42.txt").read_text())

if __name__=="__main__":
    import sys
    selftest() if "--selftest" in sys.argv else main()
