#!/usr/bin/env python3
"""JENIOS R43: PUBLIC checksum-verified Binance Vision USD-M MARK PRICE klines.
90 monthly archives; no strategy, trading, credentials or production changes.
"""
from __future__ import annotations
import calendar, concurrent.futures, csv, hashlib, io, json, re, time, urllib.request, zipfile
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

BASE="https://data.binance.vision/data/futures/um/monthly/markPriceKlines"
OUT=Path("r43-markprice-official")
SYMBOLS=("BTCUSDT","ETHUSDT","SOLUSDT")
INTERVALS={"1h":3_600_000,"5m":300_000}
MONTHS=[(y,m) for y in (2025,2026) for m in range(1,13) if (y==2025 and m>=7) or (y==2026 and m<=9)]
MAX_ZIP=18_000_000
MAX_UNZIP=70_000_000
sha=lambda b:hashlib.sha256(b).hexdigest()
assert len(MONTHS)==15

def fail(reason):
    raise ValueError("R43_MARKPRICE_REJECTED: "+reason)

def fetch(url):
    if not url.startswith(BASE+"/"):fail("unexpected source URL")
    for a in range(4):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"JENIOS-R43-Public-MarkPrice-Audit/1"})
            with urllib.request.urlopen(req,timeout=75) as r:
                if r.status!=200:fail("non-200 response")
                b=r.read(MAX_ZIP+1)
                if len(b)>MAX_ZIP:fail("zip too large")
                return b
        except Exception:
            if a==3:raise
            time.sleep(1.3*(a+1))

def epoch_ms(s):
    t=int(s)
    if t>=100_000_000_000_000:
        if t%1000 not in (0,999):fail("unaligned microseconds")
        t//=1000
    if not 1_500_000_000_000<=t<1_900_000_000_000:fail("timestamp range")
    return t

def parse_csv(data,symbol,interval,year,month):
    step=INTERVALS[interval]
    start=int(datetime(year,month,1,tzinfo=timezone.utc).timestamp()*1000)
    count=calendar.monthrange(year,month)[1]*86_400_000//step
    rows=list(csv.reader(io.StringIO(data.decode("utf-8-sig"))))
    if rows and rows[0] and not rows[0][0].strip().isdigit():
        header=rows.pop(0)
        if len(header)!=12 or not ("time" in header[0].lower()):fail("unknown CSV header")
    if len(rows)!=count:fail(f"{symbol}-{interval}-{year}-{month}: expected {count} rows got {len(rows)}")
    out=[]
    for i,row in enumerate(rows):
        if len(row)!=12:fail("12 Binance columns required")
        ts=epoch_ms(row[0]);ce=epoch_ms(row[6])
        if ts!=start+i*step or ce!=ts+step-1:fail(f"gap/duplicate/timestamp mismatch at row {i}")
        try:o,h,l,c=(Decimal(row[k]) for k in (1,2,3,4))
        except InvalidOperation:fail("bad decimal")
        if not all(x.is_finite() and x>0 for x in (o,h,l,c)):fail("nonpositive/nonfinite mark")
        if h<max(o,l,c) or l>min(o,c):fail("invalid mark OHLC")
        out.append(f"{ts},{row[1]},{row[2]},{row[3]},{row[4]}\n")
    return out

def get_one(key):
    symbol,interval,year,month=key
    period=f"{year:04d}-{month:02d}"
    filename=f"{symbol}-{interval}-{period}.zip"
    url=f"{BASE}/{symbol}/{interval}/{filename}"
    blob=fetch(url); checksum=fetch(url+".CHECKSUM")
    match=re.fullmatch(rb"\s*([0-9a-fA-F]{64})\s+\*?([^\s]+)\s*",checksum)
    if match is None or match.group(2).decode()!=filename:fail("checksum name/format "+filename)
    if sha(blob)!=match.group(1).decode().lower():fail("SHA256 mismatch "+filename)
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        if z.testzip() is not None:fail("ZIP CRC fail")
        names=z.namelist()
        if len(names)!=1 or names[0]!=filename[:-4]+".csv":fail("ZIP CSV member unexpected")
        info=z.getinfo(names[0])
        if info.file_size>MAX_UNZIP:fail("CSV too large")
        csv_bytes=z.read(info)
    try:
        lines=parse_csv(csv_bytes,symbol,interval,year,month)
        defect=None
    except ValueError as exc:
        # Official checksum may match a defective monthly archive: FAIL CLOSED.
        lines=[]
        defect=str(exc)
    return {"symbol":symbol,"interval":interval,"period":period,"zip":blob,"checksum":checksum,
       "coverageComplete":defect is None,"validationIssue":defect,
       "filename":filename,"sourceUrl":url,"checksumUrl":url+".CHECKSUM","zipSha256":sha(blob),
       "checksumSha256":sha(checksum),"csvSha256":sha(csv_bytes),"rows":len(lines),"lines":lines}

def selftest():
    t=int(datetime(2025,7,1,tzinfo=timezone.utc).timestamp()*1000)
    def mk(i):
        x=t+i*3600_000
        return f"{x},100,105,95,101,0,{x+3600_000-1},0,0,0,0,0\n"
    s=("open_time,open,high,low,close,volume,close_time,quote_volume,count,taker_buy_base,taker_buy_quote,ignore\n"+
       "".join(mk(i) for i in range(744))).encode()
    assert len(parse_csv(s,"BTCUSDT","1h",2025,7))==744
    try:
        parse_csv(s.replace(b"105,95",b"90,95",1),"BTCUSDT","1h",2025,7)
    except ValueError:pass
    else:raise AssertionError("Accepted invalid OHLC")
    try:
        parse_csv(s.replace(str(t+3600_000).encode(),str(t+7200_000).encode(),1),"BTCUSDT","1h",2025,7)
    except ValueError:pass
    else:raise AssertionError("Accepted time defect")
    print("R43 parser selftest PASS")

def main():
    selftest()
    keys=[(s,i,y,m) for s in SYMBOLS for i in INTERVALS for y,m in MONTHS]
    assert len(keys)==90
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(get_one,keys))
    OUT.mkdir(exist_ok=True)
    normalized={};records=[]
    for symbol in SYMBOLS:
      for interval,step in INTERVALS.items():
        selected=sorted((x for x in results if x["symbol"]==symbol and x["interval"]==interval),key=lambda x:x["period"])
        assert len(selected)==15
        invalid=[{"period":x["period"],"issue":x["validationIssue"]} for x in selected if not x["coverageComplete"]]
        if invalid:
            # No normalized dataset for an incomplete series, no backfill and no partial use.
            normalized[f"{symbol}_{interval}"]={"coverageComplete":False,"invalidMonths":invalid,
                "rows":0,"intervalMs":step,"usableForFullPeriod":False}
            continue
        body=("time,open,high,low,close\n"+"".join(line for x in selected for line in x["lines"])).encode()
        path=OUT/"normalized"/f"{symbol}-mark-{interval}-2025-07_2026-09.csv"
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body)
        first=int(datetime(2025,7,1,tzinfo=timezone.utc).timestamp()*1000)
        count=int((datetime(2026,10,1,tzinfo=timezone.utc).timestamp()*1000-first)/step)
        if len(body.splitlines())-1!=count:fail("unexpected complete normalized count")
        normalized[f"{symbol}_{interval}"]={"filename":path.name,"sha256":sha(body),
             "rows":count,"firstTime":first,"lastTime":first+(count-1)*step,"intervalMs":step,
             "coverageComplete":True,"usableForFullPeriod":True}
    for item in results:
        dest=OUT/"sources"/item["symbol"]/item["interval"]
        dest.mkdir(parents=True,exist_ok=True)
        (dest/item["filename"]).write_bytes(item["zip"])
        (dest/(item["filename"]+".CHECKSUM")).write_bytes(item["checksum"])
        records.append({k:item[k] for k in ("symbol","interval","period","filename","sourceUrl","checksumUrl",
            "zipSha256","checksumSha256","csvSha256","rows")})
    manifest={"schema":"JENIOS_R43_USDM_MARKPRICE_KLINES_SHA256",
       "source":BASE,"symbols":SYMBOLS,"intervals":list(INTERVALS),
       "startInclusive":"2025-07-01T00:00:00Z","endExclusive":"2026-10-01T00:00:00Z",
       "sourceArchivesChecksumVerified":len(records),"normalized":normalized,"monthlySources":records,
       "coverageStatus":"COMPLETE" if all(x["coverageComplete"] for x in results) else "PARTIAL_REJECTED_INVALID_SERIES",
       "defectiveArchives":[{"symbol":x["symbol"],"interval":x["interval"],"period":x["period"],"issue":x["validationIssue"]} for x in results if not x["coverageComplete"]],
       "markKlinesObserved":True,"markAtEventExactKnown":False,
       "maintenanceBracketsVerified":False,"brokerFillsMeasured":False,
       "liveTrading":False,"releaseGate":"NO_GO"}
    (OUT/"MANIFESTO-R43-MARK-PRICE.json").write_text(json.dumps(manifest,indent=2)+"\n")
    (OUT/"RESULTADO-R43.txt").write_text(
        "R43 90 SHA256 archives verified; coverage="+manifest["coverageStatus"]+"; "+
        ", ".join(f"{k}={v['rows']} valid={v['coverageComplete']}" for k,v in normalized.items())+
        "; defects="+str(manifest["defectiveArchives"])+"; real trading NO_GO\n")
    print((OUT/"RESULTADO-R43.txt").read_text())

if __name__=="__main__":
    import sys
    if "--selftest" in sys.argv:selftest()
    else:main()
