/**
 * Registro de aceite R45-B67. Só recebe evidências que o runner realmente observou.
 * Não ativa ordens reais, planos, APIs de corretoras ou deploys.
 */
export const OFFLINE_CRITERIA=Object.freeze([
 'regression','nextBuild','browserNavigation','postgresRls','sha256Integrity','sourceIsolation'
]);
export const AUTH_CRITERIA=Object.freeze([
 'dedicatedPlatformSupabase','remoteMigrationReviewedAndApplied',
 'realAuthenticatedEndToEnd','adminRoleMatrixVerifiedRemotely'
]);
export const TRADING_CRITERIA=Object.freeze([
 'brokerIntegrationHomologated','licensedMarketDataVerified',
 'prospectivePaperPilot','legalRiskReview'
]);
export function evaluatePrivateAcceptance(evidence={}){
 const ok=key=>evidence?.[key]===true;
 const offline=OFFLINE_CRITERIA.every(ok);
 const authenticated=AUTH_CRITERIA.every(ok);
 const realTrading=authenticated&&TRADING_CRITERIA.every(ok);
 const missingOffline=OFFLINE_CRITERIA.filter(k=>!ok(k));
 const missingAuth=AUTH_CRITERIA.filter(k=>!ok(k));
 const missingTrading=TRADING_CRITERIA.filter(k=>!ok(k));
 return {
   privateOfflineReady:offline,
   authenticatedHomologationReady:offline&&authenticated,
   realTradingReady:offline&&realTrading,
   noGoForMoney:!(offline&&realTrading),
   unverifiedCriteria:{offline:missingOffline,authentication:missingAuth,trading:missingTrading},
   note:'Aprovação técnica offline não equivale a autorização financeira, resultado estatístico validado ou publicação.'
 };
}
