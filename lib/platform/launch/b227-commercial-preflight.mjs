/** B227 — combine EXISTING plan/trial contracts. No catalog writes or checkout. */
import {PLATFORM_PLAN_PREVIEW,evaluateSubscriptionPreflight} from '../subscription-readiness.mjs';
import {projectPlatformCatalog} from '../checkout-readiness.mjs';
import {TRIAL_DURATION_MS} from '../trial/person-ledger.mjs';
export function assessPlatformCommercialContract({catalog=null,subscriptionEvidence={}}={}){
 const projections=projectPlatformCatalog(catalog);
 const rows=PLATFORM_PLAN_PREVIEW.map(p=>Object.freeze({code:p.code,
  advertisedPriceCents:p.priceCents,configuredProviderCatalogProduct:projections.some(x=>x.code===p.code&&x.configured===true),
  providerPriceMatchesPreview:projections.some(x=>x.code===p.code&&x.price_cents===p.priceCents),
  checkoutClaimedEnabled:projections.find(x=>x.code===p.code)?.canCheckout===true,
  independentlyVerifiedByThisReview:false}));
 const preflight=evaluateSubscriptionPreflight(subscriptionEvidence);
 return Object.freeze({schema:'JENIOS_B227_COMMERCIAL_CONTRACT',currency:'BRL',billing:'monthly',
  plans:Object.freeze(rows),trialLengthDays:TRIAL_DURATION_MS/(86400000),
  trialEligibilityRequiresIndependentIdentityVerification:true,
  subscriptionPreflightClaimed:preflight.readyForControlledQA===true,
  paymentProviderIndependentlyTested:false,
  outstanding:Object.freeze(preflight.outstanding),
  bankAccountConnectedByReview:false,subscriptionActivatedByReview:false,
  purchasesCreated:0,chargeAmountCents:0,liveExecutionAuthorized:false});
}
