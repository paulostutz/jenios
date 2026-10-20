/** B175: combine the original B152 durable risk ledger with B174 Alpaca Paper proposals.
 * PRIVATE QA ONLY. No transport, credential intake, customer HTTP route, or real orders.
 */
import {nativeCustomerBinding,strategyToNativePaperProposal} from './native-broker-bridge.mjs';
import {instrument,time} from '../pilot-prep/contracts.mjs';

const deny=code=>{throw Object.assign(new Error(code),{code});};
function privateQa(env){
 if(env.VERCEL_ENV==='production'||env.JENIOS_PRIVATE_PAPER_REHEARSAL!=='true')deny('PRIVATE_REHEARSAL_DISABLED');
}
/** The private worker must obtain this row from its service-role store, never the browser. */
export function alpacaPaperLedgerConnection(verifiedUserId,storedConnection,{now=Date.now(),env=process.env}={}){
 privateQa(env);
 const binding=nativeCustomerBinding(verifiedUserId,storedConnection);
 if(binding.provider!=='alpaca'||binding.environment!=='paper'||storedConnection.identity_verified!==true)
  deny('ALPACA_ACCOUNT_NOT_VERIFIED');
 const observedAtMs=Date.parse(storedConnection.last_sync_at);
 const linkedAtMs=Date.parse(storedConnection.created_at);
 time(now);time(observedAtMs);time(linkedAtMs);
 if(linkedAtMs>now||observedAtMs>now||now-observedAtMs>300000)deny('STALE_ALPACA_ACCOUNT');
 // The account fingerprint comes from the official broker read and is encrypted/HMAC-bound in B169.
 // Use immutable initial created_at for the B152 binding: last_sync_at rotates on every GET.
 // An authenticated API read is NOT legal/civil verification of account ownership.
 return Object.freeze({id:binding.connectionId,userId:verifiedUserId,provider:'alpaca',
  accountId:binding.accountDigest,environment:'paper',permissions:Object.freeze(['read']),
  revoked:false,ownershipConfirmedAtMs:linkedAtMs});
}
/** Risk must already be configured by the private worker; public clients may not set limits. */
export function reserveAlpacaPaperProposal({session,storedConnection,mode,signal,order,source,meta,quote,costs,nowMs},
 {ledger,env=process.env}={}){
 privateQa(env);
 if(!ledger||typeof ledger.reserve!=='function'||typeof ledger.snapshot!=='function')deny('DURABLE_LEDGER_REQUIRED');
 if(!session||session.authenticated!==true||session.diagnosticCompleted!==true)deny('PRIVATE_SESSION_REQUIRED');
 time(nowMs);
 const connection=alpacaPaperLedgerConnection(session.userId,storedConnection,{now:nowMs,env});
 if(!source||source.provider!=='alpaca'||source.environment!=='paper'||source.liveAccount===true||
  source.accountDigest!==connection.accountId||source.serverVerified!==true||source.permissionsVerified!==true)
  deny('BROKER_PERMISSION_EVIDENCE_REQUIRED');
 if(!meta||meta.provider!=='alpaca'||meta.id!==order?.symbol)deny('INSTRUMENT_NOT_MATCHED');
 instrument(meta,nowMs); // B152 validates tick, quantity, base/quote, settlement, staleness.
 if(!quote||quote.provider!=='alpaca'||quote.instrument!==order?.symbol)deny('MARKET_SOURCE_NOT_MATCHED');
 if(order?.mode!==mode)deny('ORIGINAL_MODE_MISMATCH');
 const binding=nativeCustomerBinding(session.userId,storedConnection);
 // Build the broker-native draft BEFORE reserving risk to avoid orphan reservations on an invalid draft.
 const proposal=strategyToNativePaperProposal({binding,userId:session.userId,mode,signal,order,source});
 const ledgerOrder={clientOrderId:order.clientOrderId,mode,side:order.side,quantity:order.quantity,entry:order.entry,stop:order.stop,target:order.target};
 const reservation=ledger.reserve(session,connection,{order:ledgerOrder,meta,costs,quote,now:nowMs});
 return Object.freeze({clientOrderId:order.clientOrderId,provider:'alpaca',environment:'paper',
  riskState:reservation.state,duplicate:reservation.duplicate,riskReserved:!reservation.duplicate,
  risk:reservation.duplicate?null:reservation.risk,
  nativeProposal:reservation.duplicate?null:proposal,ordersSent:0,orderTransportAvailable:false,
  realExecution:false,needsPrivateTransportCertification:true});
}
/** Deliberately unavailable even after a successful risk reservation. */
export function transmitReservedAlpacaPaperOrder(){deny('PAPER_TRANSPORT_NOT_CERTIFIED');}
