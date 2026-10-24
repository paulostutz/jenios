/** Durable QA observation cycle; never calls the R63 promotion engine. */
import { requireR64QaEnabled } from './robot-r64-access.mjs';
import { scheduleR64TelemetryPeriod,studyR64AcceptedTelemetry,inspectR64TelemetryStudy } from './robot-r64-telemetry.mjs';
import { hashR64CycleInput } from './robot-r64-database-store.mjs';
import { buildR64AnalystRequest,invokeR64AnalystProvider } from './robot-r64-generative-provider.mjs';
import { isR64OperationalReport } from './robot-r64-admin-view.mjs';

function unavailable(reason){
  return {schema:'JENIOS_R64_ANALYST_PROVIDER_RESULT_V1',kind:'not_generated',reason,
    provider:'openai',fingerprint:null,model:null,pricingVersion:null,providerResponseId:null,
    usage:null,costNanoUsd:null,responseDigest:null,analysis:null,analysisDigest:null,
    analysisStatus:'NOT_AVAILABLE',httpRequests:0,inferenceRequests:0,retryAllowed:false,
    evidenceKind:'SIGNED_QA_REPLAY',hypothesisOnly:true,mayPromote:false,mayExecute:false,
    mayDeploy:false,requiresDurableAudit:true,realOrdersSent:0,externalPaperOrdersSent:0,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null};
}

export function buildR64OperationalReport({study:input,result,generatedAtMs}){
  const study=inspectR64TelemetryStudy(input);
  const stage=result.kind==='unknown'?'RECONCILIATION_REQUIRED':
    result.analysisStatus==='VALID'?'ANALYSIS_RECORDED':'OBSERVATION_RECORDED';
  const labels={RECONCILIATION_REQUIRED:'Observações registradas; análise exige reconciliação',
    ANALYSIS_RECORDED:'Observações e hipóteses de QA registradas',
    OBSERVATION_RECORDED:'Observações de QA registradas'};
  const report={schema:'JENIOS_R64_OPERATIONAL_REPORT_V1',evidenceKind:'SIGNED_QA_REPLAY',
    scopeId:study.scopeId,periodKey:study.periodKey,period:study.period,generatedAtMs,
    inputDigest:study.inputDigest,snapshotCapturedAtMs:study.generatedAtMs,
    observations:{eventCount:study.metrics.eventCount,incidentCount:study.metrics.incidentCount,
      decisionCount:study.metrics.decisionCount,byRobot:study.metrics.byRobot,
      sourceCount:study.sourceCount,sessionCount:study.sessionCount},
    findings:study.findings.map(({robot,code,eventCount,severity})=>({robot,code,eventCount,severity})),
    evidenceSelection:study.evidenceSelection,
    providerAudit:{kind:result.kind,reason:result.reason,model:result.model,
      pricingVersion:result.pricingVersion,providerResponseId:result.providerResponseId,
      fingerprint:result.fingerprint,responseDigest:result.responseDigest,
      usage:result.usage,costNanoUsd:result.costNanoUsd,httpRequests:result.httpRequests,
      inferenceRequests:result.inferenceRequests,analysisStatus:result.analysisStatus,
      retryAllowed:false},
    hypotheses:result.analysisStatus==='VALID'&&result.analysis?{
      findingCount:result.analysis.findings.length,
      proposals:result.analysis.proposals.map(({kind,maxAgeMs})=>({kind,maxAgeMs})),
      confidenceIsMeasured:false}:null,
    maturity:{stage,label:labels[stage],completionCeilingKnown:false},
    automaticPromotionAllowed:false,autonomousChangesApplied:0,productionMonitoringStarted:false,
    independentBrokerAttestation:false,independentCustomerConsentVerified:false,
    customerTechnicalNotifications:false,operationalDataDisclosureRequired:true,
    realOrdersSent:0,externalPaperOrdersSent:0,
    actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null};
  if(!isR64OperationalReport(report))throw new Error('R64_REPORT_INVALID');
  return report;
}

export async function runR64OperationalCycle({store,scopeId,env={},nowMs=Date.now(),
  fetcher,signal,invokeProvider=invokeR64AnalystProvider}={}){
  requireR64QaEnabled(env);
  if(!/^scope:[a-f0-9]{16}$/.test(scopeId||''))throw new Error('R64_SCOPE_INVALID');
  const scheduled=scheduleR64TelemetryPeriod({nowMs});
  if(!scheduled.due)return {status:'NOT_DUE',periodKey:scheduled.periodKey};
  const previous=await store.readCycle({scopeId,periodKey:scheduled.periodKey});
  if(previous?.status==='COMPLETED'||previous?.status==='NEEDS_RECONCILIATION')
    return {status:previous.status==='COMPLETED'?'ALREADY_STORED':'NEEDS_RECONCILIATION',
      periodKey:scheduled.periodKey,cycleId:previous.cycleId};
  let input;
  if(previous){
    // Resume the exact frozen snapshot, even if late QA events arrived meanwhile.
    input=previous.input;
    if(input.scopeId!==scopeId||input.periodKey!==scheduled.periodKey||
      hashR64CycleInput(input)!==previous.inputDigest)throw new Error('R64_FROZEN_INPUT_INVALID');
  }else{
    const receipts=await store.readReceipts({scopeId,period:scheduled.period});
    const study=studyR64AcceptedTelemetry(receipts,{scopeId,period:scheduled.period,generatedAtMs:nowMs});
    input={schema:'JENIOS_R64_OPERATIONAL_CYCLE_INPUT_V1',evidenceKind:'SIGNED_QA_REPLAY',
      scopeId,periodKey:scheduled.periodKey,study};
  }
  const claim=await store.claimCycle({scopeId,periodKey:scheduled.periodKey,
    inputDigest:hashR64CycleInput(input),input});
  if(claim.status!=='CLAIMED')return {status:claim.status,periodKey:scheduled.periodKey,cycleId:claim.cycleId};
  const study=inspectR64TelemetryStudy(claim.input?.study??input.study);
  const lease={cycleId:claim.cycleId,leaseOwner:claim.leaseOwner,leaseGeneration:claim.leaseGeneration};
  if(study.scopeId!==scopeId||study.periodKey!==scheduled.periodKey)throw new Error('R64_CLAIM_SCOPE_MISMATCH');
  const policy=await store.readAnalystPolicy();
  const prepared=buildR64AnalystRequest({study,policy,env,nowMs});
  let result=unavailable(prepared.reason||'PAID_ANALYST_DISABLED');
  if(prepared.status==='READY'){
    const reservation=await store.reserveAndDispatch({...lease,request:prepared.request});
    if(reservation.dispatchGranted===true){
      // Unexpected transport exceptions leave DISPATCHED durable. No invented usage,
      // no response exposure and no automatic repeat after an ambiguous attempt.
      result=await invokeProvider(prepared,{env,fetcher,signal,dispatchGranted:true,nowMs});
    }else result=unavailable(reservation.reason||'DURABLE_BUDGET_NOT_GRANTED');
  }
  const report=buildR64OperationalReport({study,result,generatedAtMs:nowMs});
  const saved=await store.completeCycle({...lease,result,report});
  if(!['COMPLETED','NEEDS_RECONCILIATION'].includes(saved.status)||!isR64OperationalReport(saved.report)||
    saved.report.scopeId!==scopeId||saved.report.periodKey!==scheduled.periodKey||
    (saved.status==='NEEDS_RECONCILIATION'&&saved.report.maturity.stage!=='RECONCILIATION_REQUIRED'))
    throw new Error('R64_DURABLE_COMPLETION_UNCONFIRMED');
  return {status:saved.status==='COMPLETED'?'STORED_OPERATIONAL_QA_REPORT':'NEEDS_RECONCILIATION',
    periodKey:scheduled.periodKey,cycleId:claim.cycleId,
    report:saved.report,productionMonitoringStarted:false};
}
