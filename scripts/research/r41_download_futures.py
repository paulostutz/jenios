#!/usr/bin/env python3
"""JENIOS R41: PUBLIC verified Binance Vision USD-M perpetual 1h and 5m OHLCV.
No access to proprietary strategy code. No trading, keys, deposits or secrets.
Freeze: research/jenios-r41-futures-1h-5m-heldout/docs/research/... before this download.
"""
import calendar,concurrent.futures,csv,hashlib,io,json,re,time,urllib.request,zipfile
from datetime import datetime,timezone
from decimal import Decimal,InvalidOperation
from pathlib import Path

BASE="https://data.binance.vision/data/futures/um/monthly/klines"
OUT=Path("r41-official-dataset")
SYMBOLS=["BTCUSDT","ETHUSDT","SOLUSDT"]
INTERVALS={"1h":3600000,"5m":300000}
MONTHS=[(y,m) for y in (2025,2026) for m in range(1,13)
        if (y==2025 and m>=7) or (y==2026 and m<=9)]
MAX_DOWNLOAD=18000000
MAX_UNZIPPED=60000000
sha=lambda b:hashlib.sha256(b).hexdigest()

def fetch(url):
    if not url.startswith(BASE+"/"):raise ValueError("Non-official data source")
    for attempt in range(4):
        try:
            r=urllib.request.Request(url,headers={"User-Agent":"JENIOS-R41-Research-Only/1"})
            with urllib.request.urlopen(r,timeout=65) as stream:
                if stream.status!=200:raise ValueError("HTTP status !=200")
                blob=stream.read(MAX_DOWNLOAD+1)
                if len(blob)>MAX_DOWNLOAD:raise ValueError("Archive too large")
                return blob
        except Exception as exc:
            if attempt==3:raise RuntimeError(f"Cannot obtain official archive {url}: {exc}") from exc
            time.sleep(1.5*(attempt+1))

def milli(value):
    t=int(value)
    if t>100000000000000:
        # USD-M archive producers may switch units; reject non-millisecond aligned opens.
        if t%1000 not in (0,999):raise ValueError("Unaligned microsecond timestamp")
        t//=1000
    if not 1600000000000<t<1900000000000:raise ValueError("Invalid timestamp units")
    return t

def inspect_one(key):
    symbol, interval, year, month=key
    period=f"{year:04d}-{month:02d}"
    filename=f"{symbol}-{interval}-{period}.zip"
    url=f"{BASE}/{symbol}/{interval}/{filename}"
    archive=fetch(url)
    checksum=fetch(url+".CHECKSUM")
    matches=re.findall(rb"(?m)^\s*([0-9a-fA-F]{64})\s+\*?([^\r\n]+)\s*$",checksum)
    if len(matches)!=1 or matches[0][1].strip().decode()!=filename:raise ValueError(f"Invalid CHECKSUM file {filename}")
    if sha(archive)!=matches[0][0].decode().lower():raise ValueError(f"Official CHECKSUM mismatch {filename}")
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if z.testzip() is not None or z.namelist()!=[filename[:-4]+".csv"]:raise ValueError(f"Archive entries invalid {filename}")
        info=z.infolist()[0]
        if info.file_size>MAX_UNZIPPED:raise ValueError("Oversized uncompressed CSV")
        text=z.read(info).decode("utf-8-sig")
    entries=list(csv.reader(io.StringIO(text)))
    if len(entries)<2:raise ValueError(f"Empty monthly file {filename}")
    header=entries.pop(0)
    if len(header)!=12 or not (header[0].strip().lower().startswith("open_time")):
        # Most official Futures Vision CSV archives include headers; fail closed rather than guessing
        raise ValueError(f"Unexpected futures CSV header in {filename}: {header[:2]}")
    step=INTERVALS[interval]
    expected=calendar.monthrange(year,month)[1]*(24*3600000//step)
    if len(entries)!=expected:raise ValueError(f"{filename} has {len(entries)} rows, expected {expected}")
    start=int(datetime(year,month,1,tzinfo=timezone.utc).timestamp()*1000)
    normalized=[]
    for i,c in enumerate(entries):
        if len(c)!=12:raise ValueError(f"Bad field count in {filename} row {i}")
        ts=milli(c[0]); end=milli(c[6])
        if ts!=start+i*step or end!=ts+step-1:raise ValueError(f"Gap, duplicate or close-time error {filename} row {i}")
        try:o,h,l,cl,v=(Decimal(c[k]) for k in [1,2,3,4,5])
        except InvalidOperation:raise ValueError("Invalid decimal price/volume")
        if (not all(d.is_finite() for d in (o,h,l,cl,v)) or min(o,l,cl)<=0
            or v<0 or h<max(o,l,cl) or l>min(o,cl)):raise ValueError("Invalid OHLCV")
        t=datetime.fromtimestamp(ts/1000,timezone.utc).strftime("%d-%m-%Y %H:%M")
        normalized.append(f"{t},{c[1]},{c[2]},{c[3]},{c[4]},{c[5]}\n")
    return {
        "symbol":symbol,"interval":interval,"period":period,"source_url":url,
        "checksum_url":url+".CHECKSUM","zip_sha256":sha(archive),
        "checksum_sha256":sha(checksum),"source_csv_sha256":sha(text.encode("utf-8")),
        "row_count":len(normalized),"first_ms":start,"last_ms":start+(expected-1)*step,
        "archive_bytes":archive,"checksum_bytes":checksum,"lines":normalized,"filename":filename,
    }

def main():
    assert len(MONTHS)==15
    keys=[(sym,intv,y,m) for sym in SYMBOLS for intv in INTERVALS for (y,m) in MONTHS]
    assert len(keys)==90
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
        results=list(executor.map(inspect_one,keys))
    OUT.mkdir(exist_ok=True)
    records=[];dataset={}
    for sym in SYMBOLS:
      for intv in INTERVALS:
        group=sorted((r for r in results if r["symbol"]==sym and r["interval"]==intv),key=lambda r:r["period"])
        path=OUT/"normalized"/f"{sym}-usdm-futures-{intv}-2025-07_2026-09.csv"
        path.parent.mkdir(exist_ok=True)
        body="Date,Open,High,Low,Close,Volume\n"+"".join(line for r in group for line in r["lines"])
        body_bytes=body.encode("utf-8")
        path.write_bytes(body_bytes)
        if len(group)!=15:raise ValueError("Missing monthly archives")
        for prev,next_ in zip(group,group[1:]):
            if next_["first_ms"]-prev["last_ms"]!=INTERVALS[intv]:raise ValueError("Gap across month files")
        dataset[sym+"_"+intv]={
          "path":path.as_posix(),"sha256":sha(body_bytes),
          "rows":sum(r["row_count"] for r in group),
          "first":"2025-07-01T00:00:00Z","last":"2026-09-30T"+("23:00:00Z" if intv=="1h" else "23:55:00Z"),
          "frequency":intv,"market":"usdm-futures",
          "monthly_verified":len(group)
        }
    for r in results:
        out_dir=OUT/"archives"/r["symbol"]/r["interval"]
        out_dir.mkdir(parents=True,exist_ok=True)
        (out_dir/r["filename"]).write_bytes(r["archive_bytes"])
        (out_dir/(r["filename"]+".CHECKSUM")).write_bytes(r["checksum_bytes"])
        records.append({k:r[k] for k in ("symbol","interval","period","filename","source_url","checksum_url","zip_sha256","checksum_sha256","source_csv_sha256","row_count","first_ms","last_ms") if k in r})
    payload={
      "schema":"JENIOS_R41_BINANCE_FUTURES_2025H2_TO_2026Q3_FROZEN",
      "source":BASE,"market":"USD-M futures","dataSourceClaims":"official Binance Vision monthly archives",
      "sourceIndependentOfModelTuning":True,"frozenAtGitCommit":"b43a752e961426bb561a11063248657fc142c338",
      "windows":["2025-07 to 2025-12","2026-01 to 2026-03","2026-04 to 2026-09"],
      "first":"2025-07-01T00:00:00Z","endExclusive":"2026-10-01T00:00:00Z",
      "symbols":SYMBOLS,"intervals":list(INTERVALS),"monthlyCount":len(records),
      "normalized":dataset,"monthlySources":records,"synthetic":False,
      "executionEnabled":False,"customerLossAvoidedProven":False,
      "limitations":"Checksum plus HTTPS provenance does not verify real margin/funding/liquidity/fills or user intents."
    }
    (OUT/"MANIFESTO-R41-DADOS.json").write_text(json.dumps(payload,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    (OUT/"RESULTADO-R41.txt").write_text(
      f"PASS {len(records)} monthly archives all official companion checksums match; "+
      ", ".join(f"{k}={v['rows']}" for k,v in dataset.items())+"\n",encoding="utf-8"
    )
    print((OUT/"RESULTADO-R41.txt").read_text())

if __name__=="__main__":main()
