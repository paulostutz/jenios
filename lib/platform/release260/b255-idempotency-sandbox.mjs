/** B255: isolated sandbox owner/order idempotency. No payment, entitlement or DB writes.
 * Permanently binds a sandbox id to owner+plan+amount and rejects conflicting replays.
 */
import {createHash} from 'node:crypto';
import {PLATFORM_PLAN_PREVIEW} from '../subscription-readiness.mjs';
const catalog=new Map(PLATFORM_PLAN_PREVIEW.map(x=>[x.code,x.priceCents]));
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const code=c=>{throw Object.assign(new Error(c),{code:c});};
export class OfflinePaymentReplayJournal{
 #events=new Map();#payerByContract=new Map();
 record(event){
   if(!event||typeof event!=='object'||Array.isArray(event)||
     !UUID.test(event.eventId||'')||!UUID.test(event.payerId||'')||
     !UUID.test(event.contractId||'')||!catalog.has(event.planCode)||
     event.priceCents!==catalog.get(event.planCode)||
     !['requested','confirmed_sandbox','cancelled_sandbox','refunded_sandbox'].includes(event.kind)||
     event.environment!=='synthetic_qa'||event.bankReceipt!==null||event.realCharge!==false)
     code('UNTRUSTED_SANDBOX_EVENT');
   const key=event.eventId,contract=event.contractId;
   const identity=[event.payerId,event.planCode,event.priceCents].join(':');
   const canonical=JSON.stringify([event.eventId,contract,event.payerId,event.planCode,
     event.priceCents,event.kind,event.environment]);
   const hash=createHash('sha256').update(canonical).digest('hex');
   const previous=this.#events.get(key);
   if(previous){if(previous!==hash)code('PAYMENT_IDEMPOTENCY_CONFLICT');
     return Object.freeze({schema:'JENIOS_B255_SANDBOX_IDEMPOTENCY',duplicate:true,
       eventDigest:hash,entitlementsGranted:0,chargesCreated:0});}
   const existing=this.#payerByContract.get(contract);
   if(existing&&existing!==identity)code('CONTRACT_PAYER_OR_PLAN_CHANGED');
   this.#payerByContract.set(contract,identity);this.#events.set(key,hash);
   return Object.freeze({schema:'JENIOS_B255_SANDBOX_IDEMPOTENCY',duplicate:false,
     eventDigest:hash,entitlementsGranted:0,chargesCreated:0});
 }
 summary(){return Object.freeze({eventsSeen:this.#events.size,contractsSeen:this.#payerByContract.size,
   providerConfirmed:false,realMoneyMoved:false,accessGranted:false,chargesCreated:0});}
}
