/** B81: public plan catalogue and read-only subscription contract preflight.
 * This is NOT a checkout, webhook, customer mapping or authorization.
 */
export const PLATFORM_PLAN_PREVIEW=Object.freeze([
 Object.freeze({code:'platform-nacional',name:'Nacional — B3',priceCents:9990}),
 Object.freeze({code:'platform-global-crypto',name:'Global Crypto — B3 + Cripto',priceCents:14990}),
 Object.freeze({code:'platform-internacional-pro',name:'Internacional Pro',priceCents:19990})
]);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export function evaluateSubscriptionPreflight(evidence={}){
 const checks={
  platformIdentity:uuid(evidence.platformOwnerId),
  payerIdentity:uuid(evidence.payerOwnerId),
  signedLink:Boolean(evidence.link?.serverSigned===true&&
    evidence.link?.platformOwnerId===evidence.platformOwnerId&&
    evidence.link?.payerOwnerId===evidence.payerOwnerId&&
    uuid(evidence.link?.id)),
  paymentCycle:Boolean(evidence.lifecycle?.activationVerified===true&&
    evidence.lifecycle?.renewalVerified===true&&
    evidence.lifecycle?.cancellationVerified===true),
  webhooks:Boolean(evidence.lifecycle?.idempotencyVerified===true&&
    evidence.lifecycle?.providerReconciliationVerified===true),
  reviewedCatalog:evidence.catalog?.source==='provider_confirmed'&&
    evidence.catalog?.scope==='platform'&&evidence.catalog?.pricesVerified===true
 };
 const outstanding=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
 return {checks,outstanding,readyForControlledQA:outstanding.length===0,
  clientMayCharge:false,subscriberStatus:'unverified',canExecuteReal:false};
}
export function formatPlanPreview(priceCents){
 if(!Number.isSafeInteger(priceCents)||priceCents<=0)return '—';
 return (priceCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}
