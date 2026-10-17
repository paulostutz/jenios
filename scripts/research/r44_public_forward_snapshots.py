#!/usr/bin/env python3
"""JENIOS R44 public read-only futures quote collector; no keys, no orders.
Two chronologically separated forward observations, not profitability evidence.
"""
from __future__ import annotations
import hashlib,json,os,time,urllib.request
from datetime import datetime,timezone
from decimal import Decimal,InvalidOperation
from pathlib import Path

BASE="https://fapi.binance.com"
SYMBOLS=("BTCUSDT","ETHUSDT","SOLUSDT")
ALLOWED={"/fapi/v1/time","/fapi/v1/depth","/fapi/v1/ticker/bookTicker","/fapi/v1/premiumIndex"}
OUT=Path("r44-public-forward-observations")
SHA=lambda b:hashlib.sha256(b).hexdigest()
def die(reason):raise ValueError("R44_PUBLIC_FAIL_CLOSED: "+reason)
def utc():return datetime.now(timezone.utc).isoformat(timespec="milliseconds")
def fetch(path,query=""):
    if path not in ALLOWED or any(c in query for c in "&=?" if c=="?"):die("Disallowed endpoint/parameters")
    url=BASE+path+("?"+query if query else "")
    start=int(time.time()*1000)
    request=urllib.request.Request(url,headers={"User-Agent":"JENIOS-R44-ReadOnly-Research/1"})
    with urllib.request.urlopen(request,timeout=25) as response:
        if response.status!=200:die("Non-200 market data response")
        raw=response.read(400001)
        if len(raw)>400000:die("Oversized market data")
    end=int(time.time()*1000)
    try:parsed=json.loads(raw)
    except ValueError as exc:raise ValueError("Market data JSON invalid") from exc
    return {"path":path,"query":query,"requestStartMs":start,"receivedAtMs":end,
      "rawSha256":SHA(raw),"response":parsed}

def positive(x):
    try:v=Decimal(str(x))
    except (InvalidOperation,ValueError):die("Invalid decimal")
    if not v.is_finite() or v<=0:die("Non-positive quote")
    return v

def check_snapshot(snapshot):
    sym=snapshot["symbol"]
    book=snapshot["depth"]["response"]
    ticker=snapshot["bookTicker"]["response"]
    mark=snapshot["premiumIndex"]["response"]
    if ticker.get("symbol")!=sym or mark.get("symbol")!=sym:die("Ticker/mark symbol mismatch")
    if not isinstance(book.get("lastUpdateId"),int):die("Missing orderbook version")
    for side in ("bids","asks"):
        levels=book.get(side)
        if not isinstance(levels,list) or not 1<=len(levels)<=20:die("Wrong depth")
        prev=None
        for level in levels:
            if not isinstance(level,list) or len(level)!=2:die("Wrong book row")
            price,qty=positive(level[0]),positive(level[1])
            if prev is not None and (price>=prev if side=="bids" else price<=prev):
                die("Price ladder ordering invalid")
            prev=price
    bid=positive(book["bids"][0][0]);ask=positive(book["asks"][0][0])
    if bid>=ask:die("Crossed market")
    tickBid=positive(ticker.get("bidPrice"));tickAsk=positive(ticker.get("askPrice"))
    if tickBid>=tickAsk:die("Crossed book ticker")
    if not (Decimal(".95")*bid<=tickBid<=Decimal("1.05")*bid and
            Decimal(".95")*ask<=tickAsk<=Decimal("1.05")*ask):die("Ticker/depth disagree >5pct")
    positive(mark.get("markPrice"))
    now=snapshot["premiumIndex"]["receivedAtMs"]
    for field,val in (("depthT",book.get("T")),("depthE",book.get("E")),
                      ("tickerTime",ticker.get("time")),("markTime",mark.get("time"))):
        if not isinstance(val,int) or not (now-30000 <= val<= now+10000):
            die(f"Stale/future exchange timestamp {field}")
    return {"symbol":sym,"spreadBps":str((ask-bid)/((ask+bid)/2)*10000),
       "bestBid":str(bid),"bestAsk":str(ask),"markPrice":str(positive(mark["markPrice"])),
       "depthLevelsBid":len(book["bids"]),"depthLevelsAsk":len(book["asks"]),
       "exchangeT":book["T"],"exchangeE":book["E"]}

def collect(index):
    out={"index":index,"captureStartedAtUtc":utc(),"symbols":{},"errors":[]}
    try:out["exchangeTimeStart"]=fetch("/fapi/v1/time")
    except Exception as e:out["errors"].append({"which":"time-start","reason":str(e)})
    for sym in SYMBOLS:
        try:
            item={"symbol":sym,
             "depth":fetch("/fapi/v1/depth",f"symbol={sym}&limit=20"),
             "bookTicker":fetch("/fapi/v1/ticker/bookTicker",f"symbol={sym}"),
             "premiumIndex":fetch("/fapi/v1/premiumIndex",f"symbol={sym}")}
            item["checks"]=check_snapshot(item)
            out["symbols"][sym]=item
        except Exception as e:out["errors"].append({"symbol":sym,"reason":str(e)})
    try:out["exchangeTimeEnd"]=fetch("/fapi/v1/time")
    except Exception as e:out["errors"].append({"which":"time-end","reason":str(e)})
    out["captureCompletedAtUtc"]=utc()
    return out

def selftest():
    assert len(SYMBOLS)==3 and "order" not in "".join(ALLOWED)
    assert positive("100.012")==Decimal("100.012")
    try:positive("NaN")
    except ValueError:pass
    else:raise AssertionError("Accepted invalid")
    print("R44 public collector selftest PASS")

def main():
    selftest()
    OUT.mkdir(parents=True,exist_ok=True)
    first=collect(0)
    firstRaw=(json.dumps(first,sort_keys=True,ensure_ascii=False,indent=2)+"\n").encode()
    (OUT/"OBSERVACAO-00.json").write_bytes(firstRaw)
    firstDigest=SHA(firstRaw)
    # First capture is durably written before waiting for the next observation.
    waitSeconds=65
    time.sleep(waitSeconds)
    second=collect(1)
    secondRaw=(json.dumps(second,sort_keys=True,ensure_ascii=False,indent=2)+"\n").encode()
    (OUT/"OBSERVACAO-01.json").write_bytes(secondRaw)
    complete=all(len(x["symbols"])==3 and not x["errors"] for x in (first,second))
    proof={"schema":"JENIOS_R44_FORWARD_PUBLIC_QUOTES_V1",
      "preregisteredProtocolCommit":"a730c2614369c152deaf57e0b7cb6a2eda20bb14",
      "commitOfRunningWorkflow":os.getenv("GITHUB_SHA") or None,
      "githubRunId":os.getenv("GITHUB_RUN_ID") or None,
      "sources":BASE,"publicReadOnly":True,"privateCoreAbsent":True,
      "symbols":SYMBOLS,"observationCount":2,"nominalWaitSeconds":waitSeconds,
      "observations":[{"file":"OBSERVACAO-00.json","sha256":firstDigest,
                         "timestamp":first["captureCompletedAtUtc"],"complete":len(first["symbols"])==3 and not first["errors"]},
                      {"file":"OBSERVACAO-01.json","sha256":SHA(secondRaw),
                         "timestamp":second["captureCompletedAtUtc"],"complete":len(second["symbols"])==3 and not second["errors"]}],
      "coverageComplete":complete,
      "externalClockAttested":False,
      "isPaperOnly":True,"realIntents":False,"fillsObserved":False,
      "liveOrders":False,"profitabilityProven":False,"releaseGate":"NO_GO"}
    (OUT/"MANIFESTO-R44-SNAPSHOTS.json").write_text(json.dumps(proof,indent=2)+"\n")
    print("R44 forward public source captured",len(first["symbols"]),len(second["symbols"]),
      "coverage",complete,"sha256",firstDigest)
    if not complete:die("Missing/stale order book or incomplete real snapshots")
if __name__=="__main__":
    import sys
    selftest() if "--selftest" in sys.argv else main()
