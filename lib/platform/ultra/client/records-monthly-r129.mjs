/** R129: local read-only records-to-UM001 bridge. Digests are not authentication. */
import {createHash} from 'node:crypto';
import {validateOperation,operationNet,units12} from '../operation.mjs';
import {consolidateMonthlyReports,monthlyPeriod,monthInZone} from './monthly-report-um001.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=code=>{throw Error('R129_MONTHLY_RECORD_'+code);};
const id=value=>typeof value==='string'&&/^[-A-Za-z0-9_.:]{1,120}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const clone=value=>JSON.parse(JSON.stringify(value));
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sortedUnique=values=>[...new Set(values)].sort();
const scopeKeys=['accountBinding','provider','environment','product','ownerScope','connectionId'];
const financialFlags=Object.freeze({sourceComplete:false,independentlyVerified:false,nativeValidated:false,financialActivationAllowed:false,billingDecisionIncluded:false,billable:false,debitExecuted:false});
const reasonLabels=Object.freeze({
 LOCAL_FIXTURE_ONLY:'Os registros e recibos são fictícios e não foram autenticados por corretora.',
 CLIENT_BINDING_UNVERIFIED:'O vínculo entre cliente, proprietário e contas é um registro local fictício.',
 SOURCE_COVERAGE_PENDING:'A paginação local não comprova a cobertura integral da competência.',
 UNATTRIBUTED_RECORDS_EXCLUDED:'Há linhas do diário sem atribuição persistente ao Ultra; elas não foram incluídas.',
 MORE_LOCAL_RECORDS_PENDING:'A última página aceita informa que há mais linhas locais a consultar.',
 EXECUTION_EVIDENCE_PENDING:'Há encerramento sem recibo local conciliado da mesma revisão.',
 EXECUTION_UNCERTAIN:'Há envio ou execução com resultado a conferir.',
 COSTS_PENDING:'Há custos ou valores do encerramento ainda incompletos.',
 FILL_DETAIL_PENDING:'O feed contém quantidades agregadas e referências, sem o detalhe de cada fill.',
 SOURCE_CUTOFF_PENDING:'Pelo menos uma fonte local foi observada antes do fim da competência.',
 MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED:'O inventário observado não comprova todas as contas e produtos do cliente.',
});
const reasons=codes=>sortedUnique(codes).map(code=>({code,label:reasonLabels[code]??code}));
function time(value){if(!Number.isSafeInteger(value)||value<=0)fail('INVALID_TIME');return value;}
function iso(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));}
function binding(value){
 if(!exact(value,['registrationId','clientId','ownerScope','evidenceMode'])||!['registrationId','clientId','ownerScope'].every(key=>id(value[key]))||value.evidenceMode!=='offline_fixture')fail('FIXTURE_REGISTRATION_REQUIRED');
 return {registrationId:value.registrationId,clientId:value.clientId,ownerScope:value.ownerScope,evidenceMode:'offline_fixture'};
}
function scope(value,registered){
 if(!exact(value,scopeKeys)||!hash(value.accountBinding)||value.environment!=='demo'||value.ownerScope!==registered.ownerScope||!id(value.connectionId)||!({binance:['spot','usds_m_futures'],profit:['b3'],mt5:['b3']})[value.provider]?.includes(value.product))fail('SCOPE_MISMATCH');
 return Object.fromEntries(scopeKeys.map(key=>[key,value[key]]));
}
function cursor(value,feedId,{nullable=false}={}){
 if(value===null&&nullable)return 0;
 if(!exact(value,['feedId','sequence'])||value.feedId!==feedId||!Number.isSafeInteger(value.sequence)||value.sequence<0)fail('INVALID_CURSOR');
 return value.sequence;
}
function validateRecord(record,feedScope,generatedAt){
 const keys=['schema','eventKind','eventId','operationKey','sequence','scope','origin','operation','evidence','result','billingDecisionIncluded','financialActivationAllowed','recordDigest'];
 if(!exact(record,keys)||record.schema!=='JENIOS_ULTRA_OPERATION_RECORD_R127'||record.eventKind!=='operation_snapshot'||!hash(record.eventId)||!hash(record.operationKey)||!hash(record.recordDigest)||!Number.isSafeInteger(record.sequence)||record.sequence<1||record.billingDecisionIncluded!==false||record.financialActivationAllowed!==false)fail('INVALID_RECORD');
 const {recordDigest,...payload}=record;
 if(digest(payload)!==recordDigest)fail('RECORD_DIGEST_MISMATCH');
 if(!exact(record.scope,[...scopeKeys,'currency'])||scopeKeys.some(key=>record.scope[key]!==feedScope[key]))fail('RECORD_SCOPE_MISMATCH');
 const operation=validateOperation(record.operation,{market:feedScope.product==='b3'?'b3':'crypto',now:generatedAt});
 if(Date.parse(operation.updatedAt)>generatedAt||operation.currency!==record.scope.currency)fail('RECORD_TIME_OR_CURRENCY_MISMATCH');
 const origin=record.origin;
 if(!exact(origin,['robot','sourcePlatform','sessionId','strategy','intentionDigest'])||origin.robot!=='ultra'||!['jenios','flow'].includes(origin.sourcePlatform)||!id(origin.sessionId)||!hash(origin.intentionDigest)||!exact(origin.strategy,['id','version','configDigest'])||!id(origin.strategy.id)||!id(origin.strategy.version)||!hash(origin.strategy.configDigest))fail('ATTRIBUTION_REQUIRED');
 const expectedKey=digest({schema:'JENIOS_ULTRA_OPERATION_KEY_R127',accountBinding:feedScope.accountBinding,product:feedScope.product,operationId:operation.id});
 if(record.operationKey!==expectedKey||record.eventId!==digest({operationKey:expectedKey,revision:operation.revision}))fail('EVENT_ID_MISMATCH');
 const evidence=record.evidence;
 if(!exact(evidence,['kind','localIntentLinked','receiptRecorded','receipt','brokerAuthenticated','nativeValidated'])||evidence.kind!=='offline_fixture'||evidence.localIntentLinked!==true||evidence.brokerAuthenticated!==false||evidence.nativeValidated!==false||typeof evidence.receiptRecorded!=='boolean'||evidence.receiptRecorded!==(evidence.receipt!==null))fail('INVALID_EVIDENCE');
 const receipt=evidence.receipt;
 if(receipt!==null){
  const receiptKeys=['source','receiptId','receiptDigest','operationDigest','observedAtMs','positionReconciled','protectionConfirmed','entryRemainderCancelled','brokerAuthenticated','nativeValidated'];
  if(!exact(receipt,receiptKeys)||receipt.source!=='offline_fixture'||!id(receipt.receiptId)||!hash(receipt.receiptDigest)||receipt.operationDigest!==digest(operation)||!Number.isSafeInteger(receipt.observedAtMs)||receipt.observedAtMs<=0||receipt.observedAtMs>generatedAt||['positionReconciled','protectionConfirmed','entryRemainderCancelled'].some(key=>typeof receipt[key]!=='boolean')||receipt.brokerAuthenticated!==false||receipt.nativeValidated!==false)fail('RECEIPT_MISMATCH');
 }
 const confirmed=receipt!==null&&receipt.positionReconciled===true&&operation.state!=='unknown';
 const result={status:operation.state==='unknown'?'execution_uncertain':operation.state!=='closed'?'not_final':!confirmed?'unverified_snapshot':operation.costsComplete?'closed_complete':'awaiting_costs',afterBrokerCosts:confirmed?operationNet(operation):null,currency:operation.currency,costsComplete:operation.costsComplete,pendingFields:['gross','fees','financing'].filter(key=>operation[key]===null)};
 if(!exact(record.result,Object.keys(result))||Object.keys(result).some(key=>!equal(record.result[key],result[key])))fail('RESULT_MISMATCH');
 return record;
}
function validatePage(page,registered,now){
 if(!exact(page,['fromCursor','batch']))fail('INVALID_PAGE');
 const batch=page.batch;
 const keys=['schema','feedId','scope','generatedAt','evidenceMode','nativeValidated','records','excludedUnattributedCount','nextCursor','hasMore','billingDecisionIncluded','financialActivationAllowed'];
 if(!exact(batch,keys)||batch.schema!=='JENIOS_ULTRA_OPERATION_RECORD_BATCH_R127'||!hash(batch.feedId)||!iso(batch.generatedAt)||Date.parse(batch.generatedAt)>now||batch.evidenceMode!=='offline_fixture'||batch.nativeValidated!==false||batch.billingDecisionIncluded!==false||batch.financialActivationAllowed!==false||!Array.isArray(batch.records)||!Number.isSafeInteger(batch.excludedUnattributedCount)||batch.excludedUnattributedCount<0||typeof batch.hasMore!=='boolean')fail('INVALID_BATCH');
 const checkedScope=scope(batch.scope,registered);
 if(batch.feedId!==digest({schema:'JENIOS_ULTRA_RECORD_FEED_R127',...checkedScope}))fail('FEED_ID_MISMATCH');
 const from=cursor(page.fromCursor,batch.feedId,{nullable:true}),to=cursor(batch.nextCursor,batch.feedId);
 const count=batch.records.length+batch.excludedUnattributedCount;
 // R127 enumerates an append-only audit; missing row numbers cannot silently
 // become a supposedly continuous local import.
 if(count>1000||to<from||to-from!==count||count===0&&batch.hasMore)fail('PAGE_RANGE_MISMATCH');
 let previous=from;
 for(const record of batch.records){
  validateRecord(record,checkedScope,Date.parse(batch.generatedAt));
  if(record.sequence<=previous||record.sequence>to)fail('RECORD_SEQUENCE_MISMATCH');
  previous=record.sequence;
 }
 const signature=digest({feedId:batch.feedId,from,to,records:batch.records.map(record=>({eventId:record.eventId,recordDigest:record.recordDigest,sequence:record.sequence})),excludedUnattributedCount:batch.excludedUnattributedCount});
 return {from,to,signature,batch,scope:checkedScope};
}
function assertRevision(previous,record){
 const old=previous.operation,next=record.operation;
 if(next.revision!==old.revision+1)fail('REVISION_GAP');
 const immutable=['id','market','symbol','currency','side','createdAt','requestedQuantity'];
 if(!equal(previous.origin,record.origin)||scopeKeys.some(key=>previous.scope[key]!==record.scope[key])||immutable.some(key=>old[key]!==next[key]))fail('OPERATION_IDENTITY_CHANGED');
 if(Date.parse(next.updatedAt)<Date.parse(old.updatedAt)||units12(next.entryQuantity)<units12(old.entryQuantity)||units12(next.exitQuantity)<units12(old.exitQuantity))fail('REVISION_REGRESSION');
 if(['closed','cancelled','rejected'].includes(old.state)&&(next.state!==old.state||next.closedAt!==old.closedAt))fail('FINAL_STATE_CHANGED');
}
function accumulate(pages,registered,now,acc={pages:[],feeds:new Map(),events:new Map(),latest:new Map(),ranges:new Map()}){
 for(const page of pages){
  const checked=validatePage(page,registered,now),{batch,from,to,signature}=checked;
  const known=acc.feeds.get(batch.feedId),rangeKey=JSON.stringify([batch.feedId,from,to]);
  if(acc.ranges.has(rangeKey)){
   if(acc.ranges.get(rangeKey)!==signature)fail('REPLAY_CONFLICT');
   continue;
  }
  if(from!==(known?.nextCursor.sequence??0))fail('CURSOR_GAP_OR_OVERLAP');
  if(known&&Date.parse(batch.generatedAt)<Date.parse(known.generatedAt))fail('SOURCE_TIME_REGRESSION');
  for(const record of batch.records){
   const existing=acc.events.get(record.eventId);
   if(existing){if(existing.recordDigest!==record.recordDigest)fail('EVENT_CONFLICT');else fail('EVENT_OUTSIDE_REPLAY');}
   const latest=acc.latest.get(record.operationKey);
   if(latest)assertRevision(latest,record);
   else if(record.operation.revision!==1)fail('INITIAL_REVISION_MISSING');
   acc.events.set(record.eventId,record);acc.latest.set(record.operationKey,record);
  }
  acc.feeds.set(batch.feedId,{feedId:batch.feedId,scope:checked.scope,nextCursor:{feedId:batch.feedId,sequence:to},generatedAt:batch.generatedAt,hasMore:batch.hasMore,excludedUnattributedCount:(known?.excludedUnattributedCount??0)+batch.excludedUnattributedCount});
  acc.ranges.set(rangeKey,signature);acc.pages.push(clone(page));
  if(acc.events.size>20000||acc.feeds.size>100||acc.pages.length>20000)fail('STATE_LIMIT');
 }
 return acc;
}
function stateFrom(acc,registered){
 const state={schema:'JENIOS_ULTRA_MONTHLY_RECORD_STATE_R129',fixtureBinding:registered,evidenceMode:'offline_fixture',pages:acc.pages,feeds:[...acc.feeds.values()].sort((a,b)=>a.feedId.localeCompare(b.feedId)),eventCount:acc.events.size,operationCount:acc.latest.size,...financialFlags};
 return {...state,stateDigest:digest(state)};
}
function readState(input,now){
 const keys=['schema','fixtureBinding','evidenceMode','pages','feeds','eventCount','operationCount',...Object.keys(financialFlags),'stateDigest'];
 if(!exact(input,keys)||input.schema!=='JENIOS_ULTRA_MONTHLY_RECORD_STATE_R129'||input.evidenceMode!=='offline_fixture'||!Array.isArray(input.pages)||!Array.isArray(input.feeds)||input.pages.length>20000||!hash(input.stateDigest)||Object.keys(financialFlags).some(key=>input[key]!==false))fail('INVALID_STATE');
 const {stateDigest,...payload}=input;
 if(digest(payload)!==stateDigest)fail('STATE_DIGEST_MISMATCH');
 const registered=binding(input.fixtureBinding),acc=accumulate(input.pages,registered,now);
 if(!equal(stateFrom(acc,registered),input))fail('STATE_CONTENT_MISMATCH');
 return {registered,acc};
}

/** Pure reducer. The caller persists the returned state and cursors together.
 * Exceptions return neither a partial state nor an advanced cursor. Fixture
 * registration is not proof of a platform customer or broker account.
 */
export function ingestRecordBatchesR129(previousState,pages,{fixtureBinding,now=Date.now()}={}){
 time(now);
 const registered=binding(fixtureBinding);
 if(!Array.isArray(pages)||pages.length>20000)fail('INVALID_PAGES');
 let acc;
 if(previousState!==null){
  const checked=readState(previousState,now);
  if(!equal(checked.registered,registered))fail('CLIENT_REGISTRATION_CHANGED');
  acc=checked.acc;
 }
 acc=accumulate(pages,registered,now,acc);
 return freeze(stateFrom(acc,registered));
}

function sourceIdentity(registered,recordScope){
 const local={ownerScope:registered.ownerScope,product:recordScope.product,provider:recordScope.provider,environment:recordScope.environment,accountBinding:recordScope.accountBinding};
 const sourceId='r129_'+digest(local);
 return {sourceId,accountKey:JSON.stringify([recordScope.provider,recordScope.environment,'unverified:'+sourceId])};
}
function projection(record){
 const original=record.operation;
 // UM001 has no receipt field. Keep the original in the envelope and prevent
 // unverified financial values from appearing as a completed settlement.
 if(record.result.status==='unverified_snapshot')return {...original,gross:null,fees:null,financing:null,unrealized:null,costsComplete:false};
 return original;
}
function recordCodes(record){
 const codes=[];
 if(record.result.status==='unverified_snapshot')codes.push('EXECUTION_EVIDENCE_PENDING');
 if(['sending','unknown'].includes(record.operation.state))codes.push('EXECUTION_UNCERTAIN');
 if(record.operation.state==='closed'&&!record.operation.costsComplete)codes.push('COSTS_PENDING');
 if(units12(record.operation.entryQuantity)>0n)codes.push('FILL_DETAIL_PENDING');
 return codes;
}

/** UM001 supplies period boundaries, decimal arithmetic, reference conflicts
 * and classifications. This function never calls performance or fee functions.
 */
export function monthlyRecordsReportR129(state,{month,timeZone='America/Bahia',now=Date.now()}={}){
 time(now);
 const {registered,acc}=readState(state,now);
 const period=monthlyPeriod(month??monthInZone(now,timeZone),timeZone),end=Date.parse(period.periodEnd);
 const sources=new Map(),partitions=new Map(),allRecords=[...acc.latest.values()];
 const observedScopes=[];
 for(const feed of acc.feeds.values()){
  const identity=sourceIdentity(registered,feed.scope);
  const rows=allRecords.filter(record=>scopeKeys.every(key=>record.scope[key]===feed.scope[key]));
  observedScopes.push({...identity,feedId:feed.feedId,clientId:registered.clientId,...feed.scope,currencies:sortedUnique(rows.map(record=>record.scope.currency)),generatedAt:feed.generatedAt,nextCursor:feed.nextCursor,hasMore:feed.hasMore,excludedUnattributedCount:feed.excludedUnattributedCount,accountFingerprint:null,identityVerified:false,coverageVerified:false});
  let source=sources.get(identity.sourceId);
  if(!source){source={...identity,scope:feed.scope,feeds:[],records:[]};sources.set(identity.sourceId,source);}
  source.feeds.push(feed);source.records.push(...rows);
 }
 for(const source of sources.values()){
  const key=JSON.stringify([registered.ownerScope,source.scope.environment,source.scope.product]);
  if(!partitions.has(key))partitions.set(key,[]);
  partitions.get(key).push(source);
 }
 const commonCodes=['LOCAL_FIXTURE_ONLY','CLIENT_BINDING_UNVERIFIED','SOURCE_COVERAGE_PENDING','MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED'];
 const globalCodes=[...commonCodes];
 for(const feed of acc.feeds.values()){
  if(feed.excludedUnattributedCount)globalCodes.push('UNATTRIBUTED_RECORDS_EXCLUDED');
  if(feed.hasMore)globalCodes.push('MORE_LOCAL_RECORDS_PENDING');
  if(Date.parse(feed.generatedAt)<end)globalCodes.push('SOURCE_CUTOFF_PENDING');
 }
 const globalPendingReasons=reasons(globalCodes);
 for(const record of allRecords)globalCodes.push(...recordCodes(record));
 const groups=[],projectedSources=[],coreViews=[];
 for(const partition of partitions.values()){
  if(partition.length>20)fail('MONTHLY_SOURCE_LIMIT');
  const coreSources=partition.map(source=>({sourceId:source.sourceId,platform:source.records[0]?.origin.sourcePlatform??'jenios',report:{schema:'JENIOS_ULTRA_OPERATIONS_V1',provider:source.scope.provider,environment:source.scope.environment,connectionLabel:'Registros fictícios Ultra R129',generatedAt:new Date(Math.max(...source.feeds.map(feed=>Date.parse(feed.generatedAt)))).toISOString(),operations:source.records.map(projection)}}));
  projectedSources.push(...coreSources);
  const monthly=consolidateMonthlyReports(coreSources,{...period,now});
  coreViews.push(monthly);
  for(const group of monthly.groups){
   const source=partition.find(candidate=>candidate.accountKey===group.accountKey);
   const ids=new Set(group.operations.map(operation=>operation.id));
   const records=source.records.filter(record=>record.scope.currency===group.currency&&ids.has(record.operation.id)).sort((a,b)=>a.operationKey.localeCompare(b.operationKey));
   const keys=new Set(records.map(record=>record.operationKey));
   const history=[...acc.events.values()].filter(record=>keys.has(record.operationKey)).sort((a,b)=>a.operationKey.localeCompare(b.operationKey)||a.operation.revision-b.operation.revision);
   const codes=[...commonCodes,...group.pendingReasons.map(reason=>reason.code)];
   for(const feed of source.feeds){
    if(feed.excludedUnattributedCount)codes.push('UNATTRIBUTED_RECORDS_EXCLUDED');
    if(feed.hasMore)codes.push('MORE_LOCAL_RECORDS_PENDING');
    if(Date.parse(feed.generatedAt)<end)codes.push('SOURCE_CUTOFF_PENDING');
   }
   for(const record of records)codes.push(...recordCodes(record));
   globalCodes.push(...codes);
   const strategies=[...new Map(records.map(record=>[digest(record.origin.strategy),record.origin.strategy])).values()];
   groups.push({scope:{clientId:registered.clientId,ownerScope:registered.ownerScope,accountBinding:source.scope.accountBinding,provider:source.scope.provider,environment:source.scope.environment,product:source.scope.product,currency:group.currency,connectionIds:sortedUnique(source.feeds.map(feed=>feed.scope.connectionId)),strategies},sourceId:source.sourceId,monthly:group,records,history,
    projectionAdjustments:records.filter(record=>record.result.status==='unverified_snapshot').map(record=>({operationKey:record.operationKey,eventId:record.eventId,reason:'EXECUTION_EVIDENCE_PENDING',maskedFields:['gross','fees','financing','unrealized','costsComplete']})),
    fillDetail:{provided:false,level:'operation_aggregate',individualFills:null,brokerReferencesTyped:false},
    confirmationLevel:'offline_fixture_only',pendingReasons:reasons(codes),...financialFlags});
  }
 }
 groups.sort((a,b)=>JSON.stringify(a.scope).localeCompare(JSON.stringify(b.scope)));
 observedScopes.sort((a,b)=>a.feedId.localeCompare(b.feedId));
 const pendingReasons=reasons(globalCodes);
 const view={...period,periodClosed:now>=end,generatedAt:coreViews.length?new Date(Math.max(...coreViews.map(core=>Date.parse(core.generatedAt)))).toISOString():new Date(now).toISOString(),sourceComplete:false,independentlyVerified:false,groups:groups.map(group=>group.monthly),sourceCount:projectedSources.length,billable:false,debitExecuted:false,walletBalance:null,recordPendingReasons:pendingReasons,recordGlobalPendingReasons:globalPendingReasons};
 const output={schema:'JENIOS_ULTRA_RECORD_MONTHLY_R129',fixtureBinding:registered,fixtureBindingDigest:digest(registered),evidenceMode:'offline_fixture',...period,periodClosed:now>=end,generatedAt:new Date(now).toISOString(),stateDigest:state.stateDigest,groups,sources:projectedSources,view,observedScopes,
  observedAccountKeys:sortedUnique(observedScopes.map(observation=>observation.accountKey)),
  excludedUnattributedCount:state.feeds.reduce((sum,feed)=>sum+feed.excludedUnattributedCount,0),eventCount:state.eventCount,operationCount:state.operationCount,
  pendingReasons,globalPendingReasons,walletBalance:null,finalNet:null,digestIsAuthentication:false,...financialFlags};
 return freeze(clone({...output,reportDigest:digest(output)}));
}
