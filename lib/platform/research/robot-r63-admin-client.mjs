/** Dedicated Platform session boundary. No Social client or token fallback. */
export const R63_ADMIN_FEED_URL='/api/platform/admin/robot-evolution';
const fail=()=>{throw Object.assign(new Error('Relatórios administrativos inválidos.'),{code:'R63_ADMIN_FEED_INVALID'});};
const unauthorized=()=>Response.json({error:'Entre com sua conta administrativa da Platform.'},{
  status:401,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},
});
const aborted=signal=>{
  if(signal?.aborted)throw signal.reason??new DOMException('Requisição cancelada.','AbortError');
};

/** getSession must be bound to the existing dedicated Platform auth client. */
export async function fetchR63AdminFeed(options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)||
      Object.keys(options).some(key=>!['getSession','fetcher','signal'].includes(key)))
    throw Object.assign(new Error('Configuração administrativa inválida.'),{code:'R63_ADMIN_CLIENT_INVALID'});
  const {getSession,fetcher=fetch,signal}=options;
  aborted(signal);
  if(typeof getSession!=='function')return unauthorized();
  let auth;
  try {auth=await getSession();}
  catch {aborted(signal);return unauthorized();}
  aborted(signal);
  const session=auth?.data?.session;
  if(auth?.error||typeof session?.user?.id!=='string'||!session.user.id||session.user.id.length>128||session.user.is_anonymous===true||
      typeof session.access_token!=='string'||session.access_token.length>8192||
      !/^\S+$/.test(session.access_token))return unauthorized();
  if(typeof fetcher!=='function')throw Object.assign(new Error('Consulta administrativa indisponível.'),{code:'R63_ADMIN_CLIENT_INVALID'});
  const response=await fetcher(R63_ADMIN_FEED_URL,{
    method:'GET',cache:'no-store',redirect:'error',signal,
    headers:{authorization:'Bearer '+session.access_token},
  });
  aborted(signal);
  if(!(response instanceof Response))throw Object.assign(new Error('Resposta administrativa inválida.'),{code:'R63_ADMIN_CLIENT_INVALID'});
  // Status codes remain observable: callers distinguish hidden feature (404),
  // expired/forbidden identity (401/403), and unavailable evidence (503).
  return response;
}

const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const stamp=value=>integer(value,Date.UTC(2100,0,1));
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(value));
const text=(value,max=512)=>typeof value==='string'&&value.length>0&&value.length<=max;
const labels={manual:'Manual',hybrid:'Híbrido',reverse:'Reverso',ultrafast:'UltraFast'};
const ROBOTS=Object.keys(labels);
const ISSUES=['NONE','STALE_CONTEXT','SEQUENCE_GAP','CONNECTION_FAILURE','CONTROL_VIOLATION'];
const counters=['registered','automaticallyApplied','rejected','rolledBack'];
const counts=value=>record(value)&&counters.every(key=>integer(value[key],32));

// Check a plain bounded JSON graph before accessing fields. This never invokes
// getters, toJSON or prototype methods supplied in a malformed response object.
function jsonData(value){
  let nodes=0;
  const visit=(item,depth)=>{
    if(++nodes>200000||depth>20)fail();
    if(item===null||typeof item==='boolean')return;
    if(typeof item==='number'){if(!Number.isFinite(item))fail();return;}
    if(typeof item==='string'){if(item.length>16000)fail();return;}
    if(!item||typeof item!=='object')fail();
    const descriptors=Object.getOwnPropertyDescriptors(item),keys=Reflect.ownKeys(descriptors);
    if(Array.isArray(item)){
      if(item.length>10000||keys.length!==item.length+1)fail();
      for(let index=0;index<item.length;index++){
        const p=descriptors[String(index)];
        if(!p||!Object.hasOwn(p,'value')||!p.enumerable)fail();
        visit(p.value,depth+1);
      }
      return;
    }
    if(!record(item))fail();
    for(const key of keys){
      if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||
          !Object.hasOwn(descriptors[key],'value')||!descriptors[key].enumerable)fail();
      visit(descriptors[key].value,depth+1);
    }
  };
  visit(value,0);
}

function reportView(report){
  if(!record(report)||report.schema!=='JENIOS_R63_ADMIN_EVOLUTION_REPORT_V1'||
      report.evidenceKind!=='SYNTHETIC_FIXTURE'||report.scope!=='SYNTHETIC_ONLY'||
      report.adminOnly!==true||report.customerTechnicalNotifications!==false||
      report.operationalDataDisclosureRequired!==true||report.delivery!=='NOT_DISPATCHED'||
      report.scheduledDeliveryActive!==false||!/^fixture:[a-f0-9]{8}$/.test(report.scopeId??'')||
      !stamp(report.generatedAtMs)||report.timeZone!=='America/Sao_Paulo'||
      report.realOrdersSent!==0||report.externalPaperOrdersSent!==0||
      ['actualBrokerPnl','actualLossesAvoided','realTradeAccuracy'].some(key=>report[key]!==null))return false;
  const period=report.period,obs=report.observations,active=report.activeVersion,maturity=report.maturity;
  if(!record(period)||!stamp(period.startMs)||!stamp(period.endMs)||period.startMs>=period.endMs||
      period.endMs>report.generatedAtMs||period.endMs-period.startMs>172800000||
      report.reportId!==`r63-report:${report.scopeId}:${period.startMs}:${period.endMs}`)return false;
  if(!record(obs)||!integer(obs.eventCount,5000)||!integer(obs.decisionCount,5000)||
      !integer(obs.incidentCount,5000)||obs.decisionCount+obs.incidentCount!==obs.eventCount||
      !integer(obs.blockedDecisions,obs.decisionCount)||!record(obs.byRobot)||!record(obs.byIssue)||
      !ROBOTS.every(robot=>integer(obs.byRobot[robot],obs.eventCount))||
      !ISSUES.every(issue=>integer(obs.byIssue[issue],obs.eventCount))||
      ROBOTS.reduce((sum,robot)=>sum+obs.byRobot[robot],0)!==obs.eventCount||
      ISSUES.reduce((sum,issue)=>sum+obs.byIssue[issue],0)!==obs.eventCount)return false;
  if(obs.eventCount===0){if(obs.firstOccurredAtMs!==null||obs.lastOccurredAtMs!==null)return false;}
  else if(!stamp(obs.firstOccurredAtMs)||!stamp(obs.lastOccurredAtMs)||obs.firstOccurredAtMs<period.startMs||
      obs.firstOccurredAtMs>obs.lastOccurredAtMs||obs.lastOccurredAtMs>=period.endMs)return false;
  if(!record(active)||!['research:r63-v1','research:r63-v2'].includes(active.versionId)||
      active.maxAgeMs!==(active.versionId==='research:r63-v1'?750:500)||
      !stamp(active.activatedAtMs)||active.activatedAtMs>report.generatedAtMs||
      !integer(report.revision,32)||!integer(active.activationGeneration,report.revision))return false;
  if(!Array.isArray(report.robots)||report.robots.length!==4||new Set(report.robots.map(row=>row?.robot)).size!==4||
      !report.robots.every(row=>record(row)&&ROBOTS.includes(row.robot)&&row.label===labels[row.robot]&&
        row.observations===obs.byRobot[row.robot]&&Array.isArray(row.findings)&&row.findings.length<=4&&
        row.status===(row.observations?'SYNTHETIC_OBSERVED':'NO_EVIDENCE_IN_PERIOD')&&
        row.productionIntegrationVerified===false&&row.realPerformanceMeasured===false))return false;
  if(!record(report.improvements)||!counts(report.improvements.period)||!counts(report.improvements.cumulative)||
      !counters.every(key=>report.improvements.cumulative[key]>=report.improvements.period[key])||
      !Array.isArray(report.improvements.actions)||!Array.isArray(report.improvements.evaluations))return false;
  if(!record(maturity)||!['SYNTHETIC_IMPROVEMENT_APPLIED','SYNTHETIC_OBSERVATION_RECORDED',
      'AWAITING_SYNTHETIC_EVIDENCE','SYNTHETIC_PREVIOUS_VERSION_RESTORED'].includes(maturity.stage)||
      !text(maturity.label)||maturity.completionCeilingKnown!==false||maturity.productionIntegrationVerified!==false||
      maturity.externalExecutionValidated!==false||maturity.commercialPerformanceCertified!==false)return false;
  if(!Array.isArray(report.pending)||report.pending.length<1||report.pending.length>10||
      !report.pending.every(item=>text(item))||!Array.isArray(report.findings)||!Array.isArray(report.proposals)||
      !Array.isArray(report.evidenceEventIds)||report.evidenceEventIds.length!==obs.eventCount||
      new Set(report.evidenceEventIds).size!==report.evidenceEventIds.length||
      !report.evidenceEventIds.every(id=>typeof id==='string'&&/^evt:[a-f0-9]{8}$/.test(id)))return false;
  return true;
}

export function isR63AdminReportView(report){
  try{jsonData(report);return reportView(report);}catch{return false;}
}

export function requireR63AdminFeed(data){
  jsonData(data);
  if(!record(data)||data.schema!=='JENIOS_R63_ADMIN_FEED_V1'||data.adminOnly!==true||
      data.source!=='PRIVATE_RESEARCH_JOURNAL'||data.evidenceKind!=='SYNTHETIC_FIXTURE'||
      data.productionIntegrationVerified!==false||data.operationalDataDisclosureRequired!==true||
      data.realOrdersSent!==0||data.externalPaperOrdersSent!==0||!integer(data.revision)||
      !Array.isArray(data.reports)||data.reports.length>30||data.reports.length>data.revision||
      !data.reports.every(reportView)||!text(data.updatedAt,30)||!Number.isFinite(Date.parse(data.updatedAt))||
      new Date(data.updatedAt).toISOString()!==data.updatedAt)fail();
  return data;
}
