/** Versioned consumer opt-in. This flag selects isolated RPCs; it does not enable
 * checkout, activate catalog products, migrate SQL or grant access. The original
 * RPC is never used as a fallback when an isolated RPC is unavailable. */
export const REVERSO_STANDALONE_CODES=Object.freeze(['platform-reverso-monthly','platform-reverso-annual']);
export const ISOLATED_PLAN_RPC_NAMES=Object.freeze({
 jenios_letter_billing_cb006:'jenios_letter_billing_isolated_revfin001',
 jenios_platform_prepare_g47:'jenios_platform_prepare_isolated_revfin001',
});
export function isolatedPlanRpcName(name,env=process.env){
 return env?.JENIOS_REVERSO_PLAN_ISOLATION_V1==='true'?(ISOLATED_PLAN_RPC_NAMES[name]??name):name;
}
export function assertLegacyPlatformAccess(access,env=process.env){
 if(env?.JENIOS_REVERSO_PLAN_ISOLATION_V1==='true'&&access?.active===true&&REVERSO_STANDALONE_CODES.includes(access.productCode))
  throw Object.assign(Error('REVFIN001_REVERSO_IS_NOT_GENERAL_PLATFORM_ACCESS'),{code:'REVFIN001_REVERSO_IS_NOT_GENERAL_PLATFORM_ACCESS'});
 return access;
}
