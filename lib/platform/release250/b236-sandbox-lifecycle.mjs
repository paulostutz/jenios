/** B236: validate fixture events with the original B86 state machine, never a payment provider. */
import {auditSyntheticSubscription} from '../subscription-lifecycle-audit.mjs';
export function reviewSandboxSubscription(events,{nowMs=Date.now()}={}){
 const result=auditSyntheticSubscription(events,{now:nowMs});
 return Object.freeze({schema:'JENIOS_B236_SANDBOX_LIFECYCLE',
  syntheticallyValid:result.valid===true,
  finalStatus:result.valid?result.hypotheticalStatus:'INVALID',
  reason:result.valid?null:result.reason,
  duplicateEvents:result.valid?result.duplicateIgnored:0,
  externalProviderReceiptVerified:false,payerIdentityVerified:false,
  realEntitlementCreated:false,chargesCreated:0,automaticRenewalEnabled:false});
}
