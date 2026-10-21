/** B228 — safely reuse B86 event lifecycle; cannot issue a Pix, entitlement or charge. */
import {auditSyntheticSubscription} from '../subscription-lifecycle-audit.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function assessSyntheticCommerceLifecycle(events,{nowMs}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('B228_QA_CLOCK_REQUIRED');
 const stream=auditSyntheticSubscription(events,{now:nowMs});
 return Object.freeze({schema:'JENIOS_B228_SYNTHETIC_COMMERCE',
  scenarioValid:stream.valid===true,
  hypotheticalStatus:stream.hypotheticalStatus,
  eventCount:stream.eventsApplied||0,duplicatesSuppressed:stream.duplicateIgnored||0,
  reason:stream.valid?null:stream.reason,
  externalPixChargeVerified:false,bankProviderReceiptValidated:false,
  recurringSubscriptionsAuthorized:false,renewalsCompleted:false,
  entitlementsCreated:0,realBankPixCreated:0,chargesCreated:0,
  noRealCustomerContact:true,liveExecutionAuthorized:false});
}
