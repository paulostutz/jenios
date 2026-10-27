/** B290 — Functional decision contract, offline only. Not the private JENIOS engine. */
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const SIDE=['buy','sell'],ACTION=['open','close','cancel'];
const reverse=s=>s==='buy'?'sell':'buy';
export function reverseOperatorCommand(command,{megaTrendDirection=null,operatorAuthorized=true}={}){
 if(!command||!ACTION.includes(command.action)||!SIDE.includes(command.side)||
 typeof command.eventId!=='string'||!/^[A-Za-z0-9._-]{1,80}$/.test(command.eventId)||
 !['buy','sell',null].includes(megaTrendDirection)||operatorAuthorized!==true)
 fail('B290_INVALID_OR_UNAUTHORIZED_COMMAND');
 if(command.action==='cancel'||command.action==='close')return Object.freeze({
  action:command.action,side:command.side,decision:'PASS_THROUGH_POSITION_LIFECYCLE',
  noNewExposure:true,ordersSent:0,privateCoreUsed:false});
 if(megaTrendDirection!==null){
  return Object.freeze({action:'open',side:megaTrendDirection,
   decision:command.side===megaTrendDirection?'MEGATREND_FOLLOW':'MEGATREND_VETO_REVERSE',
   noNewExposure:false,ordersSent:0,privateCoreUsed:false});
 }
 return Object.freeze({action:'open',side:reverse(command.side),
  decision:'REVERSED_OPERATOR_REFERENCE',noNewExposure:false,
  ordersSent:0,privateCoreUsed:false});
}
export function inspectSignalDelivery(signal,{recordedAtMs,deliveredAtMs}={}){
 if(!signal||!['manual','hybrid'].includes(signal.mode)||
 !['UP','DOWN','ABSTAIN'].includes(signal.direction)||
 !Number.isSafeInteger(signal.emittedAtMs)||
 !Number.isSafeInteger(signal.targetCandleOpenMs)||
 !Number.isSafeInteger(recordedAtMs)||!Number.isSafeInteger(deliveredAtMs)||
 signal.emittedAtMs>recordedAtMs||recordedAtMs>deliveredAtMs||
 deliveredAtMs>=signal.targetCandleOpenMs||signal.emittedAtMs>=signal.targetCandleOpenMs||
 signal.isOrder!==false)fail('B290_UNVERIFIED_OR_LATE_SIGNAL');
 return Object.freeze({mode:signal.mode,direction:signal.direction,
  emittedBeforeTarget:true,recordedBeforeTarget:true,deliveredBeforeTarget:true,
  originalSignalSourceVerified:false,deliveryProviderVerified:false,
  ordersSent:0,realExecution:false});
}
