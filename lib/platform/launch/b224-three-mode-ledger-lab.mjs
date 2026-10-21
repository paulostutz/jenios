/** B224 — sandbox-only, three robot modes share the ORIGINAL B152 risk budget. */
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from '../connections/alpaca-paper-risk-rehearsal.mjs';
import {CORE_SHA} from '../pilot-prep/contracts.mjs';
const MODES=Object.freeze(['direct','reverse','hybrid']);
const BLOCKED=new Set(['AGGREGATE_RISK_LIMIT','DAILY_LOSS_LIMIT','ORDER_RISK_LIMIT',
 'CONCURRENT_ORDER_LIMIT','NOTIONAL_LIMIT','ACCOUNT_PAUSED','RECONCILIATION_REQUIRED']);
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function exerciseThreeModesInPrivateLedger({session,storedConnection,ledger,orderTemplate,source,meta,quote,costs,nowMs},
 {env={JENIOS_PRIVATE_PAPER_REHEARSAL:'true',VERCEL_ENV:'preview'}}={}){
 if(env.VERCEL_ENV==='production'||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true'||
   env.JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED==='true'||
   !ledger||typeof ledger.reserve!=='function'||
   !orderTemplate||!String(orderTemplate.clientOrderId||'').match(/^[A-Za-z0-9_-]{1,50}$/))
  deny('B224_SIMULATED_RISK_SCOPE_REQUIRED');
 const connection=alpacaPaperLedgerConnection(session?.userId,storedConnection,{env,now:nowMs});
 const before=ledger.snapshot(session,connection).length;
 const rows=[];
 for(const mode of MODES){
  const order={...orderTemplate,mode,clientOrderId:orderTemplate.clientOrderId+'-'+mode};
  const signal={originalCoreSha256:CORE_SHA.engine,executionEnabled:false,mode,
   side:order.side,contextDigest:'a'.repeat(64),reviewStatus:'allow'};
  try{
   const reservation=reserveAlpacaPaperProposal({session,storedConnection,mode,signal,order,
    source,meta,quote,costs,nowMs},{ledger,env});
   rows.push(Object.freeze({mode,decision:'RESERVED_IN_SANDBOX',riskUnits:reservation.risk?.riskUnits||null}));
  }catch(e){if(!BLOCKED.has(e.code))throw e;
   rows.push(Object.freeze({mode,decision:'BLOCKED_BY_ORIGINAL_RISK_ENGINE',reason:e.code}));}
 }
 const after=ledger.snapshot(session,connection);
 return Object.freeze({schema:'JENIOS_B224_THREE_MODE_SHARED_RISK_LAB',modes:Object.freeze(rows),
  newLedgerIntents:after.length-before,
  originalPrivateRobotDecisionsExecuted:false,
  externalProviderAuthenticated:false,realNetworkCalls:0,ordersSent:0,
  stopExecutionGuaranteed:false,performanceCertified:false,liveExecutionAuthorized:false});
}
