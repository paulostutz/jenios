/** B238: check Platform/PAY identity binding as a claimed contract, never a grant or charge. */
import {evaluateSubscriptionPreflight} from '../subscription-readiness.mjs';
export function inspectPlatformPayerLink(claim){
 const check=evaluateSubscriptionPreflight(claim||{});
 return Object.freeze({schema:'JENIOS_B238_PAYER_PREPAREDNESS',
  claimedReadyForControlledQA:check.readyForControlledQA,
  checks:Object.freeze({...check.checks}),
  missing:Object.freeze([...check.outstanding]),
  payerProviderIndependentlyAuthenticated:false,
  signedLinkExternallyVerified:false,roleEntitlementsGranted:false,
  bankAccountUsed:false,checkoutCreated:false,chargesCreated:0});
}
