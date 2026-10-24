/** Browser-safe, closed report projection. No source keys, input payloads or free text. */
const ROBOTS=['manual','hybrid','reverse','ultrafast'];
const ISSUES=['STALE_CONTEXT','SEQUENCE_GAP','CONNECTION_FAILURE','CONTROL_VIOLATION'];
const STAGES={OBSERVATION_RECORDED:'Observações de QA registradas',
  ANALYSIS_RECORDED:'Observações e hipóteses de QA registradas',
  RECONCILIATION_REQUIRED:'Observações registradas; análise exige reconciliação'};
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
function plain(value,depth=0){
  if(depth>14)return false;
  if(value===null||typeof value==='boolean')return true;
  if(typeof value==='string')return value.length<=1000;
  if(typeof value==='number')return Number.isFinite(value);
  if(!value||typeof value!=='object')return false;
  if(Array.isArray(value)){
    if(value.length>200||Reflect.ownKeys(value).length!==value.length+1)return false;
    const d=Object.getOwnPropertyDescriptors(value);
    return Array.from({length:value.length},(_,i)=>d[i]).every(x=>x&&Object.hasOwn(x,'value')&&plain(x.value,depth+1));
  }
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return false;
  const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(d);
  return keys.length<=100&&keys.every(k=>typeof k==='string'&&Object.hasOwn(d[k],'value')&&d[k].enumerable&&plain(d[k].value,depth+1));
}
function usage(value){
  if(value===null)return true;
  if(!exact(value,['input_tokens','input_tokens_details','output_tokens','output_tokens_details','total_tokens'])||
    !exact(value.input_tokens_details,['cached_tokens','cache_write_tokens'])||
    !exact(value.output_tokens_details,['reasoning_tokens']))return false;
  const a=value.input_tokens_details,b=value.output_tokens_details;
  return [value.input_tokens,value.output_tokens,value.total_tokens,a.cached_tokens,a.cache_write_tokens,b.reasoning_tokens].every(integer)&&
    value.input_tokens<=8000&&value.output_tokens<=700&&value.total_tokens===value.input_tokens+value.output_tokens&&
    a.cached_tokens+a.cache_write_tokens<=value.input_tokens&&b.reasoning_tokens<=value.output_tokens;
}
export function isR64OperationalReport(v){
  if(!plain(v)||!exact(v,['schema','evidenceKind','scopeId','periodKey','period','generatedAtMs','inputDigest',
    'snapshotCapturedAtMs','observations','findings','evidenceSelection','providerAudit','hypotheses','maturity',
    'automaticPromotionAllowed','autonomousChangesApplied','productionMonitoringStarted','independentBrokerAttestation',
    'independentCustomerConsentVerified','customerTechnicalNotifications','operationalDataDisclosureRequired',
    'realOrdersSent','externalPaperOrdersSent','actualBrokerPnl','actualLossesAvoided','realTradeAccuracy'])||
    v.schema!=='JENIOS_R64_OPERATIONAL_REPORT_V1'||v.evidenceKind!=='SIGNED_QA_REPLAY')return false;
  if(!/^scope:[a-f0-9]{16}$/.test(v.scopeId)||!/^r64:daily:\d{4}-\d{2}-\d{2}$/.test(v.periodKey)||!hex(v.inputDigest))return false;
  if(!exact(v.period,['startMs','endMs'])||!integer(v.generatedAtMs)||!integer(v.snapshotCapturedAtMs)||
    v.snapshotCapturedAtMs>v.generatedAtMs||!integer(v.period.startMs)||!integer(v.period.endMs)||
    v.period.startMs>=v.period.endMs||v.period.endMs>v.snapshotCapturedAtMs)return false;
  const o=v.observations;
  if(!exact(o,['eventCount','incidentCount','decisionCount','byRobot','sourceCount','sessionCount'])||
    !exact(o.byRobot,ROBOTS)||![o.eventCount,o.incidentCount,o.decisionCount,o.sourceCount,o.sessionCount,...Object.values(o.byRobot)].every(integer)||
    o.eventCount>5000||o.sourceCount>o.eventCount||o.sessionCount>o.eventCount||
    o.incidentCount+o.decisionCount!==o.eventCount||Object.values(o.byRobot).reduce((a,b)=>a+b,0)!==o.eventCount)return false;
  if(!Array.isArray(v.findings)||v.findings.length>20||!v.findings.every(f=>exact(f,['robot','code','eventCount','severity'])&&
    ROBOTS.includes(f.robot)&&ISSUES.includes(f.code)&&integer(f.eventCount)&&f.eventCount>0&&f.eventCount<=o.byRobot[f.robot]&&
    ['HIGH','REVIEW'].includes(f.severity)))return false;
  const e=v.evidenceSelection;
  if(!exact(e,['totalEvents','selectedEvents','limit','method'])||e.totalEvents!==o.eventCount||e.limit!==48||
    e.method!=='MOST_RECENT_48'||!integer(e.selectedEvents)||e.selectedEvents!==Math.min(48,o.eventCount))return false;
  if(!exact(v.maturity,['stage','label','completionCeilingKnown'])||!Object.hasOwn(STAGES,v.maturity.stage)||
    v.maturity.label!==STAGES[v.maturity.stage]||v.maturity.completionCeilingKnown!==false)return false;
  const a=v.providerAudit;
  if(!exact(a,['kind','reason','model','pricingVersion','providerResponseId','fingerprint','responseDigest','usage','costNanoUsd',
    'httpRequests','inferenceRequests','analysisStatus','retryAllowed'])||
    !['not_generated','usage_confirmed','unknown'].includes(a.kind)||!integer(a.httpRequests)||a.httpRequests>2||
    !integer(a.inferenceRequests)||a.inferenceRequests>1||
    !['NOT_AVAILABLE','VALID','INVALID','INCOMPLETE'].includes(a.analysisStatus)||a.retryAllowed!==false||
    typeof a.reason!=='string'||!/^[A-Z][A-Z0-9_]{0,100}$/.test(a.reason)||!usage(a.usage)||
    (a.costNanoUsd!==null&&!integer(a.costNanoUsd))||
    (a.model!==null&&(typeof a.model!=='string'||!/^gpt-[a-z0-9.-]{1,80}$/.test(a.model)))||
    (a.pricingVersion!==null&&(typeof a.pricingVersion!=='string'||!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,50}$/.test(a.pricingVersion)))||
    (a.providerResponseId!==null&&(typeof a.providerResponseId!=='string'||!/^resp_[A-Za-z0-9_-]{1,160}$/.test(a.providerResponseId)))||
    (a.fingerprint!==null&&!hex(a.fingerprint))||(a.responseDigest!==null&&!hex(a.responseDigest)))return false;
  if(a.kind==='usage_confirmed'&&(a.usage===null||a.costNanoUsd===null||a.providerResponseId===null))return false;
  if(a.kind==='not_generated'&&(a.inferenceRequests!==0||a.usage!==null||a.costNanoUsd!==null))return false;
  const h=v.hypotheses;
  if(h!==null&&(!exact(h,['findingCount','proposals','confidenceIsMeasured'])||!integer(h.findingCount)||h.findingCount>16||
    h.confidenceIsMeasured!==false||!Array.isArray(h.proposals)||h.proposals.length>1||
    !h.proposals.every(p=>exact(p,['kind','maxAgeMs'])&&p.kind==='TIGHTEN_MARKET_FRESHNESS'&&p.maxAgeMs===500)))return false;
  if((a.analysisStatus==='VALID')!==(h!==null))return false;
  if(v.maturity.stage==='RECONCILIATION_REQUIRED'&&(a.kind!=='unknown'||h!==null))return false;
  if(v.automaticPromotionAllowed!==false||v.autonomousChangesApplied!==0||v.productionMonitoringStarted!==false||
    v.independentBrokerAttestation!==false||v.independentCustomerConsentVerified!==false||v.customerTechnicalNotifications!==false||
    v.operationalDataDisclosureRequired!==true||v.realOrdersSent!==0||v.externalPaperOrdersSent!==0||
    v.actualBrokerPnl!==null||v.actualLossesAvoided!==null||v.realTradeAccuracy!==null)return false;
  return true;
}
export function requireR64AdminFeed(v){
  if(!plain(v)||!exact(v,['schema','adminOnly','evidenceKind','scopeId','reports','pendingCycles','updatedAt',
    'productionIntegrationVerified','operationalDataDisclosureRequired'])||
    v.schema!=='JENIOS_R64_ADMIN_FEED_V1'||v.adminOnly!==true||v.evidenceKind!=='SIGNED_QA_REPLAY'||
    !/^scope:[a-f0-9]{16}$/.test(v.scopeId)||v.productionIntegrationVerified!==false||v.operationalDataDisclosureRequired!==true||
    typeof v.updatedAt!=='string'||!Number.isFinite(Date.parse(v.updatedAt))||
    !Array.isArray(v.reports)||v.reports.length>30||!v.reports.every(r=>isR64OperationalReport(r)&&r.scopeId===v.scopeId)||
    !integer(v.pendingCycles)||v.pendingCycles>30)throw new Error('R64_INVALID_ADMIN_FEED');
  return v;
}
