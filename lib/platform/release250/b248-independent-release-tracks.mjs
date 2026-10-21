/** B248: four independent decisions; CI does not approve banking, broker or live launch. */
import {assessPublicCandidate} from './b231-public-release-gate.mjs';
import {auditExactPlatformPlanCatalog} from './b235-commercial-catalog.mjs';
import {inspectPlatformPayerLink} from './b238-payer-binding.mjs';
import {officialBrokerImplementationMatrix} from '../launch/b220-provider-implementation-matrix.mjs';
import {B182_RESEARCH_EVIDENCE} from '../connections/b194-performance-acceptance.mjs';
export function compileIndependentLaunchDecision({technicalChecks,catalog=null,subscriptionEvidence={}},
 {nowMs=Date.now()}={}){
 const technical=assessPublicCandidate(technicalChecks,{nowMs});
 const commerce=auditExactPlatformPlanCatalog(catalog);
 const payer=inspectPlatformPayerLink(subscriptionEvidence);
 const brokers=officialBrokerImplementationMatrix();
 const readOnly=brokers.filter(p=>p.testAccountReadAdapterImplemented).length;
 return Object.freeze({schema:'JENIOS_B248_INDEPENDENT_LAUNCH_TRACKS',asOfMs:nowMs,
  publicInformation:Object.freeze({status:technical.classification,
   requiresOwnerAcceptance:true,releasePromotionPerformed:false}),
  commercialSubscriptions:Object.freeze({status:'NO_GO_EXTERNAL_PROVIDER_ACCEPTANCE',
   planPricesMatched:commerce.priceAndScopeConsistent,
   payerPreflightClaimed:payer.claimedReadyForControlledQA,
   externalBankingLifecycleCertified:false,chargesCreated:0}),
  customerBrokerPaper:Object.freeze({status:'NO_GO_EXTERNAL_BROKER_AUTH',
   totalGuides:brokers.length,offlineReadersAvailable:readOnly,
   externalAuthenticatedAccountCount:0,externalPaperOrdersSent:0}),
  liveAutomatedTrading:Object.freeze({status:'NO_GO_LIVE_EXECUTION',
   originalResearchWindow:B182_RESEARCH_EVIDENCE.window,
   robustProspectiveAdvantageCertified:false,realOrdersSent:0}),
  customerFundsCustodied:false,productionPromotionAuthorized:false,
  independentlyCertifiedOutsideCI:false});
}
