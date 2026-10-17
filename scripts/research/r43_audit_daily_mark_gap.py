#!/usr/bin/env python3
"""R43 deterministic official daily mark-price 2026-06-29 gap recovery candidates.
Public data, no strategies, orders or credentials. Fail closed on missing archive."""
import concurrent.futures,csv,hashlib,io,json,re,time,urllib.request,zipfile
from datetime import datetime,timezone
from decimal import Decimal
from pathlib import Path

BASE="https://data.binance.vision/data/futures/um/daily/markPriceKlines"
OUT=Path("r43-official-daily-gap")
SYMBOLS=("BTCUSDT","ETHUSDT","SOLUSDT")
INTERVALS={"1h":3_600_000,"5m":300_000}
DAY="2026-06-29"
SHA=lambda b:hashlib.sha256(b).hexdigest()
START=int(datetime(2026,6,29,tzinfo=timezone.utc).timestamp()*1000)
def fetch(url):
    if not url.startswith(BASE+"/"):raise ValueError("Nonofficial origin")
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"JENIOS-R43-OfficialDaily-Documentary-Recovery/1"})
            with urllib.request.urlopen(req,timeout=55) as r:
                if r.status!=200:raise ValueError("HTTP non-200")
                body=r.read(5_000_000)
                if len(body)>=5_000_000:raise ValueError("Daily archive too large")
                return body
        except Exception:
            if attempt==3:raise
            time.sleep(1.4*(attempt+1))
def validate(data,symbol,interval):
    step=INTERVALS[interval]
    rr=list(csv.reader(io.StringIO(data.decode("utf-8-sig"))))
    if rr and rr[0] and not rr[0][0].isdigit():
        header=rr.pop(0)
        if len(header)!=12 or "time" not in header[0].lower():raise ValueError("Unrecognized Binance daily header")
    want=86_400_000//step
    if len(rr)!=want:raise ValueError(f"Daily incomplete {symbol}-{interval}: {len(rr)} of {want}")
    normalized=[]
    for i,row in enumerate(rr):
        if len(row)!=12:raise ValueError("Field count wrong")
        t=int(row[0]);cl=int(row[6])
        if t!=START+i*step or cl!=t+step-1:raise ValueError("Gap or wrong closeTime")
        o,h,l,c=[Decimal(row[z]) for z in (1,2,3,4)]
        if not all(x.is_finite() and x>0 for x in (o,h,l,c)) or h<max(o,l,c) or l>min(o,c):
            raise ValueError("Invalid price")
        normalized.append(f"{t},{row[1]},{row[2]},{row[3]},{row[4]}\n")
    return normalized
def get(key):
    symbol,interval=key
    filename=f"{symbol}-{interval}-{DAY}.zip"
    url=f"{BASE}/{symbol}/{interval}/{filename}"
    blob=fetch(url);check=fetch(url+".CHECKSUM")
    match=re.fullmatch(rb"\s*([0-9a-fA-F]{64})\s+\*?([^\r\n\s]+)\s*",check)
    if match is None or match.group(2).decode()!=filename:raise ValueError("Wrong checksum metadata")
    if SHA(blob)!=match.group(1).decode().lower():raise ValueError("ZIP checksum mismatch")
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        if z.testzip() is not None:raise ValueError("ZIP CRC")
        if z.namelist()!=[filename[:-4]+".csv"]:raise ValueError("Unexpected ZIP member")
        if z.infolist()[0].file_size>10_000_000:raise ValueError("Too large")
        csv_bytes=z.read(z.namelist()[0])
    lines=validate(csv_bytes,symbol,interval)
    return {"symbol":symbol,"interval":interval,"filename":filename,"url":url,
      "zipSha256":SHA(blob),"checksumSha256":SHA(check),"csvSha256":SHA(csv_bytes),
      "rows":len(lines),"lines":lines,"zip":blob,"checksum":check}
def main():
    keys=[(s,i) for s in SYMBOLS for i in INTERVALS]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(get,keys))
    OUT.mkdir(exist_ok=True)
    sources=[]
    for d in results:
        folder=OUT/"sources"/d["symbol"]/d["interval"]
        folder.mkdir(parents=True,exist_ok=True)
        (folder/d["filename"]).write_bytes(d["zip"])
        (folder/(d["filename"]+".CHECKSUM")).write_bytes(d["checksum"])
        path=OUT/"normalized"/f"{d['symbol']}-mark-{d['interval']}-{DAY}.csv"
        path.parent.mkdir(exist_ok=True)
        raw=("time,open,high,low,close\n"+"".join(d["lines"])).encode()
        path.write_bytes(raw)
        sources.append({k:d[k] for k in ("symbol","interval","filename","url","zipSha256",
          "checksumSha256","csvSha256","rows")} | {"normalizedFilename":path.name,
          "normalizedSha256":SHA(raw)})
    manifest={"schema":"JENIOS_R43_OFFICIAL_DAILY_GAP_CANDIDATES_SHA256",
        "date":DAY,"source":BASE,"originalMonthlyModified":False,
        "recoveredInterval":"2026-06-29T00:00:00Z to 2026-06-30T00:00:00Z",
        "sources":sources,"archivesVerified":len(sources),
        "isCompleteReconstructionByItself":False,
        "needsFull15MonthIndependentContinuityAudit":True,
        "tradingEnabled":False,"releaseGate":"NO_GO"}
    (OUT/"MANIFESTO-R43-DIARIOS-RECUPERACAO.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("R43 VERIFIED daily gap candidates",len(sources),"total candles",sum(x["rows"] for x in sources))
if __name__=="__main__":main()
