/**
 * Public display contract for the three JENIOS Platform plans.
 * A fallback catalog entry is advertising information, NOT permission to charge.
 * The server checkout remains the definitive authorization and price check.
 */
export const PLATFORM_PLAN_CODES=Object.freeze([
  'platform-nacional','platform-global-crypto','platform-internacional-pro'
]);
const CODES=new Set(PLATFORM_PLAN_CODES);
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function classifyPlatformPlan(product,catalog){
  if(!product||!CODES.has(product.code))return null;
  const configured=product.configured===true && ID.test(String(product.id||''));
  const termsValid=product.category==='platform' && product.currency==='BRL'
    && product.billing_type==='monthly' && Number.isSafeInteger(product.price_cents)
    && product.price_cents>0 && product.price_cents<=100000000;
  // A verified recurring-subscription lifecycle must be explicitly confirmed.
  const enabled=configured && termsValid && product.active===true
    && catalog?.paymentsEnabled===true && catalog?.checkoutReady===true
    && catalog?.checkoutScope==='platform' && catalog?.catalogStatus!=='defaults'
    && catalog?.subscriptionLifecycleReady===true;
  const reason=enabled?'':!configured?'Este plano ainda está em preparação e não aceita cobrança.':
    !termsValid?'A configuração comercial deste plano precisa ser revisada.':
    product.active!==true?'Contratação ainda não liberada.':
    catalog?.subscriptionLifecycleReady!==true?'Ativação e renovação das assinaturas ainda não homologadas.':
    catalog?.paymentsEnabled!==true||catalog?.checkoutReady!==true?'Cobrança de assinaturas ainda não homologada.':
    'Confirme as condições da assinatura antes de contratar.';
  return {...product,canCheckout:enabled,checkoutNotice:reason};
}

export function projectPlatformCatalog(catalog){
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))return [];
  const plans=Array.isArray(catalog.products)?catalog.products:[];
  return PLATFORM_PLAN_CODES.flatMap(code=>{
    const product=plans.find(x=>x?.code===code);
    const classified=classifyPlatformPlan(product,catalog);
    return classified?[classified]:[];
  });
}
