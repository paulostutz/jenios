/** R112 / Block 1 — order-book integrity. Caller-supplied snapshots only.
 * No network, credentials, signing, trade execution, nor WebSocket connection.
 * Binance diff-depth reconciliation, Kraken WebSocket v2 CRC32 verifier.
 */
const fail = c => { throw Object.assign(Error(c), {code:c}); };
const decimal = s => typeof s === 'string' && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(s) && Number.isFinite(Number(s));
const pos = s => decimal(s) && Number(s) > 0;
const validId = n => Number.isSafeInteger(n) && n >= 0;
const round = n => Number(n.toFixed(8));
// Canonicalize numeric price keys so 100.10 and 100.1000 are the same level.
const priceKey = s => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
const validLevels = (rows, max) => Array.isArray(rows) && rows.length <= max && rows.every(row => Array.isArray(row) && row.length === 2 && pos(row[0]) && decimal(row[1]));

function applyLevelMap(levels, updates, maxLevels) {
  if (!validLevels(updates, maxLevels)) fail('R112_BOOK_INVALID_LEVELS');
  for (const [price, qty] of updates) {
    if (Number(qty) === 0) levels.delete(priceKey(price));
    else levels.set(priceKey(price), qty);
  }
}
function sortedBook(bids, asks, maxLevels) {
  const sort = (map, desc) => [...map.entries()].sort((a,b) => (Number(a[0])-Number(b[0]))*(desc?-1:1)).slice(0,maxLevels);
  const b = sort(bids,true), a=sort(asks,false);
  if (!b.length || !a.length || Number(b[0][0]) >= Number(a[0][0])) fail('R112_BOOK_CROSSED_OR_EMPTY');
  return {bids:Object.freeze(b.map(x=>Object.freeze([...x]))),asks:Object.freeze(a.map(x=>Object.freeze([...x])))};
}

/** Buffered depth-diff events must bridge snapshot.lastUpdateId+1.
 * Lost updates are a hard block requiring snapshot replacement, not a guess.
 */
export function reconcileBinanceDepth({snapshot,events,nowMs,maxLevels=1000,maxAgeMs=1000}={}) {
  if (!snapshot || !validId(snapshot.lastUpdateId) || !validId(snapshot.receivedAtMs) ||
    !validId(nowMs) || snapshot.receivedAtMs > nowMs || !validId(maxAgeMs) || maxAgeMs<1 ||
    !Number.isInteger(maxLevels) || maxLevels<1 || maxLevels>5000 ||
    !validLevels(snapshot.bids,maxLevels) || !validLevels(snapshot.asks,maxLevels) ||
    !Array.isArray(events) || events.length>5000) fail('R112_BINANCE_INVALID_SNAPSHOT');
  const bids=new Map(snapshot.bids.map(([p,q])=>[priceKey(p),q]));
  const asks=new Map(snapshot.asks.map(([p,q])=>[priceKey(p),q]));
  let last=snapshot.lastUpdateId, used=0, ignored=0, latest=snapshot.receivedAtMs, lastEventTime=-1;
  const issues=[];let bridged=false;
  try {sortedBook(bids,asks,maxLevels);}catch {issues.push('INITIAL_BOOK_CROSSED_OR_EMPTY');}
  for(const e of events){
    if(!e||!validId(e.U)||!validId(e.u)||e.U>e.u||!validId(e.timestampMs)||e.timestampMs>nowMs||
      !validLevels(e.b,maxLevels)||!validLevels(e.a,maxLevels))fail('R112_BINANCE_INVALID_EVENT');
    if (e.u <= last) {ignored++;continue;}
    if(e.U>last+1){issues.push('DEPTH_SEQUENCE_GAP');break;}
    if(e.u<last+1){issues.push('DEPTH_MISSING_BRIDGE');break;}
    // Buffered diffs can precede REST snapshot receipt. Compare event times
    // against previous depth events, not snapshot receipt time.
    if (lastEventTime>=0 && e.timestampMs<lastEventTime){issues.push('DEPTH_TIME_REVERSED');break;}
    applyLevelMap(bids,e.b,maxLevels);applyLevelMap(asks,e.a,maxLevels);
    last=e.u;latest=Math.max(latest,e.timestampMs);lastEventTime=e.timestampMs;used++;bridged=true;
    try {sortedBook(bids,asks,maxLevels);}catch {issues.push('CROSSED_OR_EMPTY_AFTER_DIFF');break;}
  }
  if(!events.length)issues.push('NO_DEPTH_STREAM_EVIDENCE');
  if(events.length>0&&!bridged)issues.push('NO_VALID_SNAPSHOT_BRIDGE');
  if(nowMs-latest>maxAgeMs)issues.push('BOOK_STALE');
  let book=null;
  if(!issues.length)book=sortedBook(bids,asks,maxLevels);
  return Object.freeze({schema:'JENIOS_R112_BINANCE_BOOK_V1',allow:issues.length===0,
    issues:Object.freeze([...new Set(issues)]),lastUpdateId:last,usedEvents:used,ignoredEvents:ignored,
    quoteAgeMs:nowMs-latest,top:book?Object.freeze({bid:book.bids[0][0],ask:book.asks[0][0],
    spreadBps:round((Number(book.asks[0][0])-Number(book.bids[0][0]))/
      ((Number(book.asks[0][0])+Number(book.bids[0][0]))/2)*10000)}):null,
    book:book?Object.freeze(book):null,
    resubscribeRequired:issues.length>0,readOnly:true,ordersSent:0});
}

function crc32(value) {
  let crc=0xFFFFFFFF;
  const bytes=new TextEncoder().encode(value);
  for(const b of bytes){crc ^= b;for(let i=0;i<8;i++)crc=(crc&1) ? (crc>>>1)^0xEDB88320 : crc>>>1;}
  return (crc^0xFFFFFFFF)>>>0;
}
const crcToken=s=>s.replace('.','').replace(/^0+/,'')||'0';
/** Kraken v2: asks ascending then bids descending, 10 levels, string decimals.
 * Known official example checksum 3310070434 is covered by tests.
 */
export function calculateKrakenBookChecksum({asks,bids}={}){
  if(!Array.isArray(asks)||!Array.isArray(bids)||asks.length<1||bids.length<1||
     asks.length>1000||bids.length>1000||
     [...asks,...bids].some(x=>!x||!pos(x.price)||!pos(x.qty)))fail('R112_KRAKEN_INVALID_LEVELS');
  const asc=[...asks].sort((a,b)=>Number(a.price)-Number(b.price)).slice(0,10);
  const desc=[...bids].sort((a,b)=>Number(b.price)-Number(a.price)).slice(0,10);
  const payload=[...asc,...desc].map(x=>crcToken(x.price)+crcToken(x.qty)).join('');
  return crc32(payload);
}
export function verifyKrakenBook({asks,bids,expectedChecksum,receivedAtMs,nowMs,maxAgeMs=1000}={}){
  if(!validId(expectedChecksum)||expectedChecksum>0xFFFFFFFF||!validId(receivedAtMs)||!validId(nowMs)||
    receivedAtMs>nowMs||!validId(maxAgeMs)||maxAgeMs<1)fail('R112_KRAKEN_INVALID_CONTEXT');
  const checksum=calculateKrakenBookChecksum({asks,bids});
  const bb=Number([...bids].sort((a,b)=>Number(b.price)-Number(a.price))[0].price);
  const aa=Number([...asks].sort((a,b)=>Number(a.price)-Number(b.price))[0].price);
  const issues=[];
  if(bb>=aa)issues.push('CROSSED_BOOK');
  if(checksum!==expectedChecksum)issues.push('CRC32_MISMATCH');
  if(nowMs-receivedAtMs>maxAgeMs)issues.push('BOOK_STALE');
  return Object.freeze({schema:'JENIOS_R112_KRAKEN_CHECKSUM_V1',allow:issues.length===0,
    issues:Object.freeze(issues),checksum,expectedChecksum,readOnly:true,
    resubscribeRequired:issues.length>0,ordersSent:0});
}