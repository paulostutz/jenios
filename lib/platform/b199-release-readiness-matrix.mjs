/** B199 — no-side-effect technical/commercial go-live review for the existing JENIOS Platform.
 * Reuses preflight rules; deliberately cannot grant a subscription, authorize payment,
 * attest proprietary-robot returns, turn on brokerage, or approve production promotion.
 */
import {projectPlatformCatalog,PLATFORM_PLAN_CODES} from './checkout-readiness.mjs';
import {evaluateSubscriptionPreflight} from './subscription-readiness.mjs';
import {B182_RESEARCH_EVIDENCE} from './connections/b194-performance-acceptance.mjs';
const deny=code=>{throw Object.assign(new Error(code),{code});};
export function auditPlatformLaunchTracks({catalog=null,subscriptionEvidence={},brokerActivation=null,
 originalResearch=B182_RESEARCH_EVIDENCE,nowMs=Date.now()}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('INVALID_RELEASE_AUDIT_CLOCK');
 const projected=projectPlatformCatalog(catalog);
 const byCode=new Map(projected.map(p=>[p.code,p]));
 const planRows=PLATFORM_PLAN_CODES.map(code=>Object.freeze({code,
  listed:byCode.has(code),providerConfigured:byCode.get(code)?.configured===true,
  checkoutClaimedReady:byCode.get(code)?.canCheckout===true,
  independentBillingCertified:false,
  notice:byCode.get(code)?.checkoutNotice||'Catálogo indisponível ou não configurado.'}));
 const preflight=evaluateSubscriptionPreflight(subscriptionEvidence);
 const commercialEvidenceClaimed=planRows.every(p=>p.checkoutClaimedReady)&&
  preflight.readyForControlledQA===true;
 const brokerReadOnly=brokerActivation?.authenticatedAccount===true&&
  brokerActivation?.code==='READ_ONLY_DEMO_LINKED'&&
  ['paper','testnet'].includes(brokerActivation?.environment);
 const researchInsufficient=originalResearch?.originalCoreSha256!==B182_RESEARCH_EVIDENCE.originalCoreSha256||
  originalResearch?.robustNetPerformanceDemonstrated!==true||
  originalResearch?.prospectiveCertified!==true;
 const commercePending=[...planRows.filter(p=>!p.checkoutClaimedReady).map(p=>'PLAN_CHECKOUT_UNVERIFIED_'+p.code),
  ...preflight.outstanding.map(x=>'SUBSCRIPTION_'+x.toUpperCase()),
  'INDEPENDENT_PROVIDER_PAYMENTS_ACCEPTANCE_REQUIRED'];
 const brokerPending=[...(!brokerReadOnly?['CUSTOMER_PAPER_ACCOUNT_READ_PENDING']:[]),
  'BROKER_SCOPED_PERMISSIONS_UNVERIFIED','ISOLATED_WORKER_DEPLOYMENT_PENDING',
  'PAPER_EXTERNAL_EXECUTION_NOT_AUTHORIZED','BRACKET_PROTECTION_BROKER_AUDIT_PENDING',
  'REGULATORY_AND_OPERATIONAL_REVIEW_REQUIRED',
  ...(researchInsufficient?['INDEPENDENT_ORIGINAL_ROBOT_PROSPECTIVE_PERFORMANCE_NOT_PROVEN']:[])];
 return Object.freeze({schema:'JENIOS_B199_RELEASE_READINESS_MATRIX',asOfMs:nowMs,
  product:'JENIOS Platform',tracks:Object.freeze({
   publicInformation:Object.freeze({classification:'REQUIRES_PRODUCT_OWNER_RELEASE_REVIEW',
    serverHealthCertified:false,manualSmokeRequired:true}),
   commercialSubscriptions:Object.freeze({classification:commercialEvidenceClaimed?
    'QA_EVIDENCE_CLAIMED_REQUIRES_INDEPENDENT_PROVIDER_AUDIT':'NOT_READY_FOR_INDEPENDENT_QA',
    planRows:Object.freeze(planRows),preflightChecks:Object.freeze(preflight.checks),
    pending:Object.freeze(commercePending),providerBillingIndependentlyVerified:false,
    newChargesCreated:0,subscriptionActivatedByAudit:false}),
   customerBrokerPaper:Object.freeze({classification:'NO_GO_EXTERNAL_PAPER',
    customerReadOnlyDemoClaimed:!!brokerReadOnly,pending:Object.freeze(brokerPending),
    paperOrdersSent:0,externalBrokerExecutionCertified:false}),
   capitalAtRisk:Object.freeze({classification:'NO_GO_LIVE_MONEY',
    originalResearchResult:'UNPROVEN',independentProspectiveAdvantageCertified:false,
    returnsGuaranteed:false,realOrdersAuthorized:false})
  }),
  // Even a client-origin JSON object with all flags true does not authorize launch.
  independentEvidenceAttestedByThisReport:false,
  productionPromotionAuthorized:false,liveExecutionAuthorized:false,
  paymentsCharged:0,clientFundsCustodied:false});
}
