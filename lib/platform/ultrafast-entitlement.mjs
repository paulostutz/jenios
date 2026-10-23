export const ULTRAFAST_ALLOWED_PLANS=Object.freeze(['platform-global-crypto','platform-internacional-pro']);
export function ultrafastEntitlement(planCode){
 const allowed=ULTRAFAST_ALLOWED_PLANS.includes(planCode);
 return Object.freeze({feature:'ultrafast',planCode,allowed,reason:allowed?'':'REQUIRES_GLOBAL_CRYPTO_OR_PRO'});
}
