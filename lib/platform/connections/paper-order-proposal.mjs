/** B172: limit/bracket payload proposals for an external PAPER account.
 * Never sends, persists or signs an order. No live host or trading credentials.
 * Output is NOT an approved risk reservation or a ready-to-submit order.
 */
import {CORE_SHA,units,digest} from '../pilot-prep/contracts.mjs';
const bad=code=>{throw Object.assign(new Error(code),{code});};
const text=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,48}$/.test(x);
const quantity=x=>{const n=units(x);if(n<=0n||n>1000000n*100000000n)bad('INVALID_PAPER_QUANTITY');return n;};
const USD=100000000n;
function cents(x){const n=units(x);if(n<=0n||n>1000000n*USD||n%1000000n!==0n)bad('PRICE_TICK_NOT_CERTIFIED');return n;}
export function paperOrderProposal({provider,environment,userId,mode,signal,order,source}){
 if(provider!=='alpaca'||environment!=='paper')bad('UNSUPPORTED_PAPER_ORDER_PROVIDER');
 if(!text(userId)||!text(order?.clientOrderId)||!text(order?.symbol)||!['direct','reverse','hybrid'].includes(mode))bad('INVALID_PAPER_SCOPE');
 if(!signal||signal.originalCoreSha256!==CORE_SHA.engine||signal.executionEnabled!==false||signal.mode!==mode||signal.side!==order.side||!['buy','sell'].includes(order.side)||!/^[a-f0-9]{64}$/.test(signal.contextDigest||'')||!['allow','approve'].includes(signal.reviewStatus))bad('ORIGINAL_CORE_REVIEW_REQUIRED');
 if(!source||source.provider!=='alpaca'||source.environment!=='paper'||source.accountAuthenticated!==true||source.ownershipVerified!==true||source.permissionsVerified!==true||source.marketDataVerified!==true||source.prospective!==true||source.liveAccount===true)bad('PAPER_ACCOUNT_GATES_REQUIRED');
 if(source.receivedAtMs!==undefined&&(!Number.isSafeInteger(source.receivedAtMs)||source.receivedAtMs<0))bad('INVALID_SOURCE_TIME');
 const qty=quantity(order.quantity),entry=cents(order.entry),stop=cents(order.stop),target=cents(order.target);
 if(order.side==='buy'?!(stop<entry&&entry<target):!(stop>entry&&entry>target))bad('INVALID_PROTECTIVE_SIDE');
 if(!/^[A-Z][A-Z0-9.]{0,14}$/.test(order.symbol))bad('INVALID_PAPER_SYMBOL');
 const risk=qty*(entry>stop?entry-stop:stop-entry)/USD;
 if(risk<=0n)bad('NON_POSITIVE_STOP_RISK');
 const notional=qty*entry/USD;
 // Risk budgets and reserved notional must be attested by a durable private ledger before submission.
 const proposal=Object.freeze({provider,environment,clientOrderId:order.clientOrderId,
  body:Object.freeze({symbol:order.symbol,qty:order.quantity,side:order.side,type:'limit',time_in_force:'day',limit_price:order.entry,order_class:'bracket',take_profit:{limit_price:order.target},stop_loss:{stop_price:order.stop},client_order_id:order.clientOrderId}),
  conceptualStopRiskUnits:risk.toString(),conceptualNotionalUnits:notional.toString(),
  engineMode:mode,originalCoreSha256:CORE_SHA.engine,originalContextDigest:signal.contextDigest,
  sent:false,ordersSent:0,canSubmit:false,ledgerRiskReserved:false,brokerBracketSupportVerified:false,
  brokerConstraintsVerified:false,permissionToTrade:false,realExecution:false,
  warning:'Request-only proposal; instrument support, account grants, original strategy risk and broker bracket acceptance must be verified in private worker before any PAPER order.'});
 return Object.freeze({...proposal,proposalDigest:digest({provider,environment,userId,proposal})});
}
export function prepareBinancePaperOrder(){bad('BINANCE_SPOT_ATOMIC_PROTECTION_NOT_CERTIFIED');}
export function sendPaperOrder(){bad('PAPER_ORDER_SENDER_DISABLED');}
export function sendRealOrder(){bad('REAL_ORDER_SENDER_DISABLED');}
