/** B235: compare provider-advertised plan rows to the existing Platform contract without charging. */
import {PLATFORM_PLAN_PREVIEW} from '../subscription-readiness.mjs';
import {assessPlatformCommercialContract} from '../launch/b227-commercial-preflight.mjs';
export function auditExactPlatformPlanCatalog(catalog){
 const checked=assessPlatformCommercialContract({catalog});
 const entries=Array.isArray(catalog?.products)?catalog.products:[];
 const allCodes=PLATFORM_PLAN_PREVIEW.map(p=>p.code);
 const prices=PLATFORM_PLAN_PREVIEW.map(p=>({code:p.code,priceCents:p.priceCents}));
 const plans=entries.filter(x=>allCodes.includes(x.code));
 const validCatalog=catalog?.checkoutScope==='platform'&&plans.length===3&&
  new Set(plans.map(x=>x.code)).size===3&&
  prices.every(p=>{const row=plans.find(x=>x.code===p.code);return row&&
   row.category==='platform'&&row.currency==='BRL'&&row.billing_type==='monthly'&&
   row.price_cents===p.priceCents;});
 return Object.freeze({schema:'JENIOS_B235_EXACT_CATALOG_AUDIT',
  expectedPlans:Object.freeze(prices.map(x=>Object.freeze(x))),
  priceAndScopeConsistent:validCatalog===true,
  providerCheckoutEligibilityClaimed:checked.plans.every(x=>x.checkoutClaimedEnabled),
  outsideProviderPaymentAttestationMissing:true,
  entitlementGranted:false,providerChargeAuthorized:false,chargesCreated:0,
  discrepancies:Object.freeze(prices.filter(p=>entries.find(x=>x.code===p.code)?.price_cents!==p.priceCents).map(x=>x.code))});
}
