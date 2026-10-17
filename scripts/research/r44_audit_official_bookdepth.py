#!/usr/bin/env python3
"""R44 public Binance Vision USD-M daily bookDepth source-quality audit.
Depth bands are NOT L2 fills, spread quotes, slippage or executable orders.
"""
from __future__ import annotations
from collections import defaultdict
import concurrent.futures,csv,hashlib,io,json,re,time,urllib.request,zipfile
from datetime import datetime,timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

BASE="https://data.binance.vision/data/futures/um/daily/bookDepth"
SYMBOLS=("BTCUSDT","ETHUSDT","SOLUSDT")
DAYS=("2026-09-02","2026-09-06")
OUT=Path("r44-official-bookdepth-qa")
BANDS=("-5","-2","-1","-0.2","0.2","1","2","5")
H=lambda b:hashlib.sha256(b).hexdigest()
def fail(s):raise ValueError("R44_BOOKDEPTH_REJECTED: "+s)
def fetch(url):
    if not url.startswith(BASE+"/"):fail("Nonofficial host/path")
    for n in range(4):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"JENIOS-R44-Archive-Quality-Only/1"})
            with urllib.request.urlopen(req,timeout=60) as r:
                if r.status!=200:fail("HTTP non-200")
                b=r.read(4_000_001)
                if len(b)>4_000_000:fail("Zip too large")
                return b
        except Exception:
            if n==3:raise
            time.sleep(1.3*(n+1))
def timestamp(s):
    try:
        if s.isdigit():
            n=int(s)
            if n>=100_000_000_000_000:n//=1000
            return datetime.fromtimestamp(n/1000,tz=timezone.utc)
        return datetime.strptime(s,"%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except Exception as exc:raise ValueError(f"Malformed bookDepth timestamp: {s}") from exc
def dec(s):
    try:v=Decimal(s)
    except (InvalidOperation,ValueError):fail("Invalid decimal")
    if not v.is_finite():fail("Nonfinite decimal")
    return v
def inspect(data,day):
    reader=csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    if set(reader.fieldnames or [])!={"timestamp","percentage","depth","notional"}:fail("Unexpected bookDepth schema")
    buckets=defaultdict(list)
    all_times=set();rows=0;previous=None;negative=0
    for entry in reader:
        if None in entry:fail("Extra CSV columns")
        t=timestamp(entry["timestamp"])
        if t.strftime("%Y-%m-%d")!=day:fail("Cross-date archive row")
        if previous is not None and t<previous:fail("Out-of-order rows")
        previous=t
        pct=dec(entry["percentage"])
        vol=dec(entry["depth"]);notional=dec(entry["notional"])
        if vol<0 or notional<0:negative+=1
        if vol<=0 or notional<=0:implied=None
        else:implied=str((notional/vol).quantize(Decimal("0.000001")))
        all_times.add(t)
        band=str(pct.normalize())
        buckets[band].append((t,implied,str(vol),str(notional)))
        rows+=1
    if not rows:fail("Empty archive")
    series={};used={}
    for band in BANDS:
        records=buckets.get(band,[])
        distinct=len(set(x[1] for x in records if x[1] is not None))
        count=len(records)
        max_run=0;run=0;last=None
        for _,value,_,_ in records:
            if value is not None and value==last:run+=1
            else:run=1
            last=value
            max_run=max(max_run,run)
        first=records[0][1] if records else None
        series[band]={"entries":count,"distinctImpliedPrices":distinct,
           "distinctRatio":round(distinct/max(count,1),6),
           "maxConsecutiveSameImplied":max_run,"firstImplied":first,
           "frozenBandWarning":count>=1000 and (distinct/max(count,1)<.05 or max_run>=120),
           "isExecutableBidAskQuote":False}
        if records:used[band]={t:x for t,x,_,_ in records}
    crosses=0;compare=0
    for t,x in used.get("-0.2",{}).items():
        ask=used.get("0.2",{}).get(t)
        if x is not None and ask is not None:
            compare+=1
            if Decimal(ask)<Decimal(x):crosses+=1
    return {"rows":rows,"uniqueSampleTimes":len(all_times),
       "claimedCadenceSeconds":30,"expectedSampleTimes":2880,
       "coverageEnough":len(all_times)>=2800,
       "rowNegatives":negative,
       "impliedInnerBandCrosses":crosses,"impliedInnerBandCompared":compare,
       "impliedCrossRate":round(crosses/max(compare,1),6),
       "impliedBandPricesNotExecutableQuotes":True,
       "frozenBandWarning":any(x["frozenBandWarning"] for x in series.values()),
       "bands":series}
def load(k):
    symbol,day=k
    name=f"{symbol}-bookDepth-{day}.zip"
    url=f"{BASE}/{symbol}/{name}"
    archive=fetch(url);checksum=fetch(url+".CHECKSUM")
    match=re.fullmatch(rb"\s*([0-9a-fA-F]{64})\s+\*?([^\s]+)\s*",checksum)
    if match is None or match.group(2).decode()!=name:fail("Invalid official checksum name")
    if H(archive)!=match.group(1).decode().lower():fail("ZIP checksum mismatch")
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if z.testzip() is not None or z.namelist()!=[name[:-4]+".csv"]:fail("ZIP CRC/member invalid")
        if z.infolist()[0].file_size>25_000_000:fail("CSV inflated too large")
        csv_data=z.read(z.namelist()[0])
    return {"symbol":symbol,"day":day,"filename":name,"sourceUrl":url,
      "zipSha256":H(archive),"checksumSha256":H(checksum),"csvSha256":H(csv_data),
      "archiveBytes":archive,"checksumBytes":checksum,"quality":inspect(csv_data,day)}
def selftest():
    data=b"timestamp,percentage,depth,notional\n2026-09-06 00:00:03,-0.2,10,1000\n2026-09-06 00:00:03,0.2,10,1002\n"
    x=inspect(data,"2026-09-06")
    assert x["uniqueSampleTimes"]==1 and x["impliedInnerBandCrosses"]==0
    wrong=data.replace(b"1002",b"500")
    assert inspect(wrong,"2026-09-06")["impliedInnerBandCrosses"]==1
    print("R44 bookDepth data quality selftest PASS")
def main():
    selftest()
    keys=[(s,d) for s in SYMBOLS for d in DAYS]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        result=list(pool.map(load,keys))
    OUT.mkdir(exist_ok=True)
    sources=[]
    for x in result:
        path=OUT/"sources"/x["symbol"]
        path.mkdir(parents=True,exist_ok=True)
        (path/x["filename"]).write_bytes(x["archiveBytes"])
        (path/(x["filename"]+".CHECKSUM")).write_bytes(x["checksumBytes"])
        sources.append({key:x[key] for key in ("symbol","day","filename","sourceUrl",
              "zipSha256","checksumSha256","csvSha256","quality")})
    warnings=[{"symbol":x["symbol"],"day":x["day"],
               "innerAskBandFrozen":x["quality"]["bands"]["0.2"]["frozenBandWarning"],
               "innerBidBandFrozen":x["quality"]["bands"]["-0.2"]["frozenBandWarning"],
               "impliedCrossRate":x["quality"]["impliedCrossRate"]}
              for x in result]
    manifest={"schema":"JENIOS_R44_PUBLIC_BOOKDEPTH_DATA_QUALITY",
       "source":BASE,"symbols":SYMBOLS,"days":DAYS,
       "archivesChecksumVerified":len(result),"sources":sources,"indicators":warnings,
       "preregisteredBeforeOpeningTheseArchiveFiles":False,
       "selectedDaysFromPubliclyReportedBug":True,
       "bookDepthIsBandAggregatedNotLevel2":True,
       "actualLiquidityOrSlippageProven":False,"liveTrading":False,"releaseGate":"NO_GO"}
    (OUT/"MANIFESTO-R44-BOOKDEPTH.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"archives":len(result),"indicators":warnings,"releaseGate":"NO_GO"}))
if __name__=="__main__":
    import sys
    selftest() if "--selftest" in sys.argv else main()
