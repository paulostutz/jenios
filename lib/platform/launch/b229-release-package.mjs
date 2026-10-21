/** B229 — a private, informational launch QA packet, NOT a commercial switch. */
import {buildOfficialConnectorWorklist} from './b223-provider-gaps.mjs';
import {assessPlatformCommercialContract} from './b227-commercial-preflight.mjs';
import {B182_RESEARCH_EVIDENCE} from '../connections/b194-performance-acceptance.mjs';
export function buildLaunchQaPacket({nowMs=Date.now()}={}){
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)throw Error('B229_BAD_CLOCK');
 const connectors=buildOfficialConnectorWorklist(),commercial=assessPlatformCommercialContract();
 return Object.freeze({schema:'JENIOS_B229_LAUNCH_QA_PACKET',atMs:nowMs,
  source:'B215-R2_CERTIFIED_PLUS_B216_B230_ADDITIONS',
  plans:commercial.plans.map(x=>({code:x.code,priceCents:x.advertisedPriceCents,independentlyVerified:false})),
  brokerCount:connectors.length,readOnlyTestAdapterCount:connectors.filter(x=>x.phase==='READ_ONLY_DEMO_ADAPTER_EXISTS').length,
  historicalResearch:{period:B182_RESEARCH_EVIDENCE.window,totalOpportunities:B182_RESEARCH_EVIDENCE.totalOpportunities,
   positiveScenariosAt0Bps:B182_RESEARCH_EVIDENCE.positiveCellsAtZeroBps,
   positiveScenariosAt10Bps:B182_RESEARCH_EVIDENCE.positiveCellsAtTenBps,
   positiveScenariosAt30Bps:B182_RESEARCH_EVIDENCE.positiveCellsAtThirtyBps,
   economicAdvantageCertified:false},
  incompleteTracks:Object.freeze(['OPERATOR_APPROVED_PRIVATE_HOST','EXTERNAL_READ_ONLY_BROKER_TEST',
   'AUTHORIZED_EXTERNAL_PAPER_PILOT','PROSPECTIVE_CORE_PERFORMANCE',
   'INDEPENDENT_SUBSCRIPTION_AND_PIX_ACCEPTANCE','REGULATORY_AND_SECURITY_REVIEW']),
  approvedForPublicMarketingByThisPacket:false,productionReleaseAuthorized:false,
  externalPaperOrdersSent:0,realOrdersSent:0,paymentsCreated:0,custody:false});
}
