/** B181: broker-native PAPER order gateway for separately deployed private QA process.
 * It reuses B152 durable risk reservations, B165 protected credentials, B174 customer identity,
 * B179 short-lived signed operator grant, and B178 durable one-shot dispatch claims.
 * No Next.js HTTP entrypoint. No proprietary engine import. NEVER live money.
 */
import {decryptDemo,digestDemoAccount} from './demo-vault.mjs';
import {readDemoBroker} from './demo-broker-reader.mjs';
import {alpacaPaperLedgerConnection,reserveAlpacaPaperProposal} from './alpaca-paper-risk-rehearsal.mjs';
import {nativeCustomerBinding,strategyToNativePaperProposal} from './native-broker-bridge.mjs';
import {verifyPaperGrant,assertPrivatePaperRuntime} from './alpaca-paper-dispatch-grant.mjs';
import {postNativeAlpacaPaperOnce} from './alpaca-paper-native-submit.mjs';
import {paperDispatchHash} from './alpaca-paper-dispatch-journal.mjs';
import {unknownPaperOrder} from './paper-order-observation.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
const scope=(userId,id,kind)=>({userId,id,provider:'alpaca',environment:'paper',kind});
export async function executePrivateAlpacaPaperOnce({session,storedConnection,mode,signal,order,source,meta,quote,costs,nowMs,grant},
 {ledger,journal,env=process.env,readAccount=readDemoBroker,post=postNativeAlpacaPaperOnce,fetcher=fetch,refreshConnection}={}){
 assertPrivatePaperRuntime(env);
 if(!ledger||typeof ledger.reserve!=='function'||typeof ledger.event!=='function'||!journal||typeof journal.claim!=='function')deny('PRIVATE_DURABLE_STORES_REQUIRED');
 if(typeof refreshConnection!=='function')deny('ACCOUNT_REVOCATION_FENCE_REQUIRED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true||!Number.isSafeInteger(nowMs)||nowMs<=0)deny('PRIVATE_USER_SESSION_REQUIRED');
 const c=alpacaPaperLedgerConnection(session.userId,storedConnection,{now:nowMs,env});
 const binding=nativeCustomerBinding(session.userId,storedConnection);
 if(c.id!==binding.connectionId||c.accountId!==binding.accountDigest)deny('BROKER_ACCOUNT_BOUNDARY_MISMATCH');
 const proposal=strategyToNativePaperProposal({binding,userId:session.userId,mode,signal,order,source});
 const digest=paperDispatchHash(proposal.body);
 verifyPaperGrant(grant,{userId:session.userId,connectionId:c.id,accountDigest:c.accountId,
  clientOrderId:order.clientOrderId,orderBodyDigest:digest,mode},{env,nowMs});
 // Only server-owned encrypted storage is accepted. Caller-supplied plain credentials are ignored.
 const credentials=decryptDemo(storedConnection.credential_box,scope(session.userId,c.id,'credentials'),env);
 let verified;
 try{verified=await readAccount({provider:'alpaca',environment:'paper',apiKey:credentials.apiKey,secret:credentials.secret},{fetcher,now:()=>nowMs});}
 catch{deny('PAPER_ACCOUNT_READ_NOT_VERIFIED');}
 if(verified?.identityVerified!==true||verified?.snapshot?.accountReadConfirmed!==true)deny('PAPER_ACCOUNT_READ_NOT_VERIFIED');
 const fresh=digestDemoAccount(verified.accountRef,{userId:session.userId,provider:'alpaca',environment:'paper'},env);
 if(fresh!==c.accountId)deny('PAPER_ACCOUNT_CHANGED');
 // A fresh server-role fetch is mandatory immediately before reserving and dispatching.
 const latest=await refreshConnection({userId:session.userId,connectionId:c.id});
 if(!latest||latest.user_id!==session.userId||latest.id!==c.id||latest.status!=='active'||
  latest.revoked===true||latest.external_digest!==c.accountId||latest.identity_verified!==true||
  JSON.stringify(latest.credential_box)!==JSON.stringify(storedConnection.credential_box))deny('BROKER_ACCESS_REVOKED_OR_ROTATED');
 const prep=reserveAlpacaPaperProposal({session,storedConnection,mode,signal,order,source,meta,quote,costs,nowMs},{ledger,env});
 if(prep.duplicate||prep.riskState!=='RESERVED'||!prep.riskReserved||!prep.nativeProposal)deny('PAPER_DUPLICATE_RESERVATION');
 const j={userId:session.userId,connectionId:c.id,clientOrderId:order.clientOrderId,accountDigest:c.accountId,
  proposalDigest:digest,atMs:nowMs};
 const persisted=journal.prepare(j);
 if(persisted.duplicate)deny('PREVIOUS_BROKER_DISPATCH_REQUIRES_LOOKUP');
 // Mark durable B152 intent as submitting before making the non-idempotent external POST.
 ledger.event(session,c,order.clientOrderId,{id:'paper-submit-'+digest.slice(0,32),kind:'SUBMITTING',atMs:nowMs,cumulativeQuantity:'0'});
 const claimed=journal.claim({...j,atMs:nowMs});
 if(!claimed.claimed)deny('PAPER_DISPATCH_ALREADY_CLAIMED');
 let broker;
 try{broker=await post({body:proposal.body,credentials,expectedClientOrderId:order.clientOrderId,nowMs},{env,fetcher});}
 catch{broker=null;}
 const stamp=nowMs+1;
 if(!broker||broker.kind==='ambiguous'||!broker.brokerEvent||broker.brokerEvent.kind==='UNKNOWN'){
  const event=unknownPaperOrder({clientOrderId:order.clientOrderId,reason:'transport_error',atMs:stamp,knownCumulativeQuantity:'0'});
  let riskUnknownConfirmed=false;
  try{ledger.event(session,c,order.clientOrderId,{id:event.id,kind:event.kind,atMs:event.atMs,cumulativeQuantity:event.cumulativeQuantity});riskUnknownConfirmed=true;}catch{}
  journal.observe({...j,atMs:stamp},{state:'AMBIGUOUS',evidence:paperDispatchHash({clientOrderId:order.clientOrderId,kind:'UNKNOWN',time:stamp})});
  return Object.freeze({status:riskUnknownConfirmed?'AMBIGUOUS_BROKER_POST':'RISK_RECONCILIATION_REQUIRES_REVIEW',clientOrderId:order.clientOrderId,
   needsIndependentBrokerLookup:true,automaticResubmissionAllowed:false,ordersAttemptedPaper:1,liveOrdersSent:0,realExecution:false});
 }
 try{
  ledger.event(session,c,order.clientOrderId,{...broker.brokerEvent,atMs:stamp});
  journal.observe({...j,atMs:stamp},{state:'ACKED',evidence:paperDispatchHash(broker.brokerEvent)});
 }catch{
  // Receipt may have reached the provider even if local reconciliation failed.
  journal.observe({...j,atMs:stamp},{state:'AMBIGUOUS',evidence:paperDispatchHash({kind:'LOCAL_LEDGER_RECONCILIATION_UNKNOWN'})});
  return Object.freeze({status:'LOCAL_RECONCILIATION_REQUIRES_REVIEW',clientOrderId:order.clientOrderId,
   needsIndependentBrokerLookup:true,automaticResubmissionAllowed:false,ordersAttemptedPaper:1,liveOrdersSent:0,realExecution:false});
 }
 return Object.freeze({status:'BROKER_PAPER_RECEIPT',clientOrderId:order.clientOrderId,
  brokerStatus:broker.brokerEvent.kind,positionRiskStillHeld:true,automaticResubmissionAllowed:false,
  protectionRequiresBrokerLegVerification:true,ordersAttemptedPaper:1,liveOrdersSent:0,realExecution:false});
}
export function executeLiveAlpacaOrder(){deny('REAL_EXECUTION_NOT_AUTHORIZED');}
export function retryUncertainPaperOrder(){deny('AUTOMATIC_PAPER_RETRY_FORBIDDEN');}
