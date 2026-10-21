/** B226 — prospective ingest *audit*, not external witness attestation. */
const deny=code=>{throw Object.assign(new Error(code),{code});};
const modes=new Set(['direct','reverse','hybrid']);
const assets=new Set(['BTCUSDT','ETHUSDT','SOLUSDT']);
export function inspectProspectiveSignalWindow(rows,{nowMs}={}){
 if(!Array.isArray(rows)||rows.length<3||rows.length>300||
   !Number.isSafeInteger(nowMs)||nowMs<=0)deny('B226_PROSPECTIVE_WINDOW_INVALID');
 const seen=new Set(),byMode={direct:0,reverse:0,hybrid:0};let last=0;
 for(const row of rows){
  if(!row||!modes.has(row.mode)||!assets.has(row.asset)||
   typeof row.eventId!=='string'||!/^[a-zA-Z0-9._-]{1,64}$/.test(row.eventId)||
   !Number.isSafeInteger(row.signalAtMs)||!Number.isSafeInteger(row.closeAtMs)||
   !Number.isSafeInteger(row.recordedAtMs)||row.signalAtMs<=last||
   row.signalAtMs>=row.closeAtMs||row.closeAtMs>row.recordedAtMs||
   row.recordedAtMs>nowMs||nowMs-row.recordedAtMs>30*86400000||
   row.realOrder!==false||row.predictedProfit!==null)
   deny('B226_INVALID_OR_LOOKAHEAD_SIGNAL');
  if(seen.has(row.eventId))deny('B226_DUPLICATE_SIGNAL');seen.add(row.eventId);
  byMode[row.mode]++;last=row.signalAtMs;
 }
 return Object.freeze({schema:'JENIOS_B226_PROSPECTIVE_WINDOW_REVIEW',samples:rows.length,
  byMode:Object.freeze(byMode),minimumThreeModesCovered:Object.values(byMode).every(n=>n>0),
  independentClockWitnessed:false,externalMarketDataAttested:false,
  originalPrivateCoreSignalsVerified:false,netProfitCertified:false,
  classification:'LOCAL_ROWS_REQUIRE_INDEPENDENT_PROVENANCE',
  brokerOrdersSent:0,realExecutionAuthorized:false});
}
