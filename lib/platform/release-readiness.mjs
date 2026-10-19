/** B95 release readiness: static gates, never a licensing or authorization source. */
export const PLATFORM_LAUNCH_GATES=Object.freeze([
 {id:'B91',name:'Registro prospectivo',needs:'Capturas futuras testemunhadas fora do navegador'},
 {id:'B92',name:'Robôs originais',needs:'Runtime privado com bytes originais atestados'},
 {id:'B93',name:'Análise de mercado',needs:'Licenças e auditoria de indicadores fora da amostra'},
 {id:'B94',name:'Estatística dos robôs',needs:'Piloto prospectivo independente dos motores originais'},
 {id:'B95',name:'Contas e assinaturas',needs:'Vínculo autenticado e ciclo JENIOS PAY homologado'}
]);
export function assessLaunchReadiness(evidence={}){
 const ciVerified=evidence.ci===true&&evidence.browser===true&&
  evidence.criticalApisPreserved===true;
 const required={
  independentProspective:evidence.independentTimestampedCaptures===true,
  privateEngineDeployed:evidence.privateRuntimeBytesVerified===true,
  providerCommercialTerms:evidence.providerTermsReviewed===true,
  robotPilot:evidence.prospectivePolicyValidated===true,
  accountLink:evidence.identityLinkVerified===true,
  subscriptions:evidence.subscriptionLifecycleVerified===true
 };
 const productReady=ciVerified&&Object.values(required).every(Boolean);
 return Object.freeze({ciVerified,requirements:required,productReady,
  commercialCheckoutAuthorized:false,realExecutionAuthorized:false,
  bankScoreChanges:0,originalCoreMutations:0});
}
