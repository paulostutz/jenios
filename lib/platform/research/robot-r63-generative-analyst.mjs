/**
 * R63 — bounded generative analyst contract. No provider is instantiated here.
 * A host may inject an explicitly configured provider and an atomic budget
 * reservation. Model output is a hypothesis; it never grants promotion,
 * execution, deployment or access to customer accounts.
 */
import {studyR63Observations} from './robot-r63-observation-study.mjs';

const fail = code => { throw Object.assign(new Error(code), {name:'ValidationError',code}); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const canonical = (value,depth=0) => {
  if(depth>20)fail('R63_ANALYST_INVALID_JSON_VALUE');
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(!value||typeof value!=='object')fail('R63_ANALYST_INVALID_JSON_VALUE');
  const properties=Object.getOwnPropertyDescriptors(value);
  if(Array.isArray(value)){
    if(value.length>10000||Reflect.ownKeys(properties).length!==value.length+1)fail('R63_ANALYST_INVALID_JSON_VALUE');
    const items=[];
    for(let i=0;i<value.length;i++){
      const p=properties[String(i)];
      if(!p||!Object.hasOwn(p,'value')||!p.enumerable)fail('R63_ANALYST_INVALID_JSON_VALUE');
      items.push(canonical(p.value,depth+1));
    }
    return '['+items.join(',')+']';
  }
  if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('R63_ANALYST_INVALID_JSON_VALUE');
  const keys=Reflect.ownKeys(properties);
  if(keys.some(key=>typeof key!=='string'||['__proto__','prototype','constructor'].includes(key)||
      !Object.hasOwn(properties[key],'value')||!properties[key].enumerable))fail('R63_ANALYST_INVALID_JSON_VALUE');
  return '{'+keys.sort().map(key=>JSON.stringify(key)+':'+canonical(properties[key].value,depth+1)).join(',')+'}';
};
function exact(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value))) fail(code);
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const actual=Reflect.ownKeys(descriptors);
  if(actual.length!==keys.length || actual.some(key=>typeof key!=='string'||!keys.includes(key)||
      !Object.hasOwn(descriptors[key],'value')||!descriptors[key].enumerable)) fail(code);
}
const INVARIANTS=Object.freeze({
  hypothesisOnly:true,mayPromote:false,mayExecute:false,mayDeploy:false,
  realOrdersSent:0,externalPaperOrdersSent:0,
  actualBrokerPnl:null,actualLossesAvoided:null,realTradeAccuracy:null,
});

/** Recompute facts instead of trusting a caller's counters or attached claims. */
export function inspectR63AnalystStudy(study) {
  try {
    const encoded=canonical(study);
    if (!study || typeof study !== 'object' || Array.isArray(study)||encoded.length>2000000)
      fail('R63_ANALYST_INVALID_STUDY');
    const normalized=studyR63Observations(study.events,{
      scopeId:study.scopeId,nowMs:study.asOfMs,windowStartMs:study.windowStartMs,
    });
    if(encoded!==canonical(normalized)) fail('R63_ANALYST_INVALID_STUDY');
    return normalized;
  } catch { fail('R63_ANALYST_INVALID_STUDY'); }
}

/** Only fixture identifiers and minimized, enumerated evidence leave this layer. */
export function buildR63AnalystRequest(input) {
  const study=inspectR63AnalystStudy(input);
  const selectedIds=[...new Set(study.findings.flatMap(f=>f.evidenceEventIds))].slice(0,48);
  const selectedSet=new Set(selectedIds);
  const events=study.events.filter(event=>selectedSet.has(event.eventId)).map(event=>({
    eventId:event.eventId,robot:event.robot,kind:event.kind,decision:event.decision,
    issue:event.issue,marketAgeMs:event.marketAgeMs,
  }));
  const selectedFindings=study.findings.map(finding=>({
    code:finding.code,robot:finding.robot,eventCount:finding.eventCount,
    distinctOccurredAtCount:finding.distinctOccurredAtCount,
    evidenceEventIds:finding.evidenceEventIds.filter(id=>selectedSet.has(id)),
  })).filter(finding=>finding.evidenceEventIds.length);
  return freeze({
    schema:'JENIOS_R63_ANALYST_REQUEST_V1',evidenceKind:'SYNTHETIC_FIXTURE',
    task:'REVIEW_STRUCTURED_RESEARCH_EVIDENCE',
    instructions:'Analise somente as evidências sintéticas recebidas. Retorne o esquema JENIOS_R63_ANALYST_RESPONSE_V1 com assessment HYPOTHESIS_ONLY, findings e proposals. Use somente códigos, robôs e identificadores existentes no contexto. Findings: code, robot, confidence (LOW, MEDIUM ou HIGH), evidenceEventIds. Proposals: kind TIGHTEN_MARKET_FRESHNESS, maxAgeMs 500 ou 250, evidenceEventIds. Não retorne texto livre, código, ferramentas, comandos, resultados financeiros, autorização ou mudanças em contas. Confiança é uma opinião do modelo; nenhuma saída autoriza aplicação.',
    context:{
      metrics:study.metrics,findings:selectedFindings,events,
      totalEvidenceEvents:study.events.length,includedEvidenceEvents:events.length,
      evidenceWasTruncated:selectedIds.length<new Set(study.findings.flatMap(f=>f.evidenceEventIds)).size,
    },
    responseSchema:'JENIOS_R63_ANALYST_RESPONSE_V1',
    allowedProposalKinds:['TIGHTEN_MARKET_FRESHNESS'],
    allowedMaxAgeMs:[500,250],maxOutputTokens:700,
    tools:[],toolChoice:'none',...INVARIANTS,
  });
}

function evidenceIds(ids, allowed, maximum=48) {
  if(!Array.isArray(ids)||ids.length<1||ids.length>maximum||new Set(ids).size!==ids.length||
      ids.some(id=>typeof id!=='string'||!allowed.has(id))) fail('R63_ANALYST_INVALID_EVIDENCE_REFERENCE');
  return [...ids].sort();
}

export function inspectR63AnalystResponse(input,{study:rawStudy}={}) {
  const study=inspectR63AnalystStudy(rawStudy);
  const request=buildR63AnalystRequest(study);
  let response=input;
  if(typeof input==='string') {
    if(input.length>16000) fail('R63_ANALYST_RESPONSE_TOO_LARGE');
    try {response=JSON.parse(input);} catch {fail('R63_ANALYST_INVALID_RESPONSE');}
  }
  if(canonical(response).length>16000)fail('R63_ANALYST_RESPONSE_TOO_LARGE');
  exact(response,['schema','assessment','findings','proposals'],'R63_ANALYST_INVALID_RESPONSE');
  if(response.schema!=='JENIOS_R63_ANALYST_RESPONSE_V1'||response.assessment!=='HYPOTHESIS_ONLY'||
      !Array.isArray(response.findings)||response.findings.length>16||
      !Array.isArray(response.proposals)||response.proposals.length>1)
    fail('R63_ANALYST_INVALID_RESPONSE');
  const events=new Map(request.context.events.map(event=>[event.eventId,event]));
  const used=new Set(),seenFindings=new Set();
  const findings=response.findings.map(finding=>{
    exact(finding,['code','robot','confidence','evidenceEventIds'],'R63_ANALYST_INVALID_FINDING');
    const support=study.findings.find(f=>f.code===finding.code&&f.robot===finding.robot);
    if(!support||!['LOW','MEDIUM','HIGH'].includes(finding.confidence)||
        seenFindings.has(finding.robot+':'+finding.code)) fail('R63_ANALYST_UNSUPPORTED_FINDING');
    seenFindings.add(finding.robot+':'+finding.code);
    const refs=evidenceIds(finding.evidenceEventIds,events);
    if(refs.some(id=>events.get(id).issue!==finding.code||events.get(id).robot!==finding.robot))
      fail('R63_ANALYST_UNSUPPORTED_FINDING');
    refs.forEach(id=>used.add(id));
    return {code:finding.code,robot:finding.robot,modelConfidence:finding.confidence,
      confidenceIsMeasured:false,evidenceEventIds:refs,classification:'MODEL_HYPOTHESIS'};
  });
  const proposals=response.proposals.map(proposal=>{
    exact(proposal,['kind','maxAgeMs','evidenceEventIds'],'R63_ANALYST_INVALID_PROPOSAL');
    if(proposal.kind!=='TIGHTEN_MARKET_FRESHNESS'||![500,250].includes(proposal.maxAgeMs)||
        !study.proposals.some(p=>p.kind===proposal.kind)||study.metrics.byIssue.CONTROL_VIOLATION!==0)
      fail('R63_ANALYST_UNSUPPORTED_PROPOSAL');
    const refs=evidenceIds(proposal.evidenceEventIds,events);
    const support=refs.map(id=>events.get(id));
    if(support.length<3||support.some(e=>e.robot!=='ultrafast'||e.issue!=='STALE_CONTEXT'||e.marketAgeMs<=500)||
        new Set(support.map(e=>study.events.find(original=>original.eventId===e.eventId).occurredAtMs)).size<3)
      fail('R63_ANALYST_UNSUPPORTED_PROPOSAL');
    refs.forEach(id=>used.add(id));
    return {kind:proposal.kind,maxAgeMs:proposal.maxAgeMs,evidenceEventIds:refs,
      assessment:'HYPOTHESIS_REQUIRES_INDEPENDENT_VALIDATION'};
  });
  return freeze({
    schema:'JENIOS_R63_ANALYST_HYPOTHESES_V1',evidenceKind:'SYNTHETIC_FIXTURE',
    findings,proposals,evidenceEventIds:[...used].sort(),...INVARIANTS,
  });
}

/** One reserved call, no retries. Budget implementation must be atomic at host. */
export async function runR63Analyst({study,provider,budget,enabled=false}={}) {
  const result=(status,extra={})=>freeze({
    schema:'JENIOS_R63_ANALYST_RUN_V1',status,budgetReserved:false,providerCalls:0,
    analysis:null,...INVARIANTS,...extra,
  });
  if(enabled!==true) return result('DISABLED');
  const request=buildR63AnalystRequest(study);
  if(typeof provider!=='function'||!budget||typeof budget.reserve!=='function')
    return result('PROVIDER_OR_BUDGET_UNAVAILABLE');
  let reserved=false;
  try {
    reserved=await budget.reserve({operation:'ROBOT_R63_ANALYSIS',maxCalls:1,maxOutputTokens:700})===true;
  } catch {return result('BUDGET_UNAVAILABLE');}
  if(!reserved) return result('BUDGET_DENIED');
  const controller=new AbortController();
  let timer;
  try {
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
      controller.abort();reject(Object.assign(new Error('R63_ANALYST_TIMEOUT'),{code:'R63_ANALYST_TIMEOUT'}));
    },10000);});
    const output=await Promise.race([Promise.resolve().then(()=>provider(request,{signal:controller.signal})),timeout]);
    let analysis;
    try {analysis=inspectR63AnalystResponse(output,{study});}
    catch {return result('INVALID_RESPONSE',{budgetReserved:true,providerCalls:1});}
    return result('ANALYZED',{budgetReserved:true,providerCalls:1,analysis});
  } catch (error) {
    return result(error?.code==='R63_ANALYST_TIMEOUT'?'PROVIDER_TIMEOUT':'PROVIDER_FAILED',{
      budgetReserved:true,providerCalls:1,
    });
  } finally {clearTimeout(timer);}
}
