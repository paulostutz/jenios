// Product-owned display contract. No credential, raw SQL row or broker balance.
export const STATE_SCHEMA='ULTRA_OWNER_STATE_V1';
export const SECTION_NAMES=Object.freeze(['configuration','entitlement','wallet','cycles','obligations','runtime','connections','operations','feePolicy']);
const fail=()=>{throw Error('ULTRA_INVALID_OWNER_STATE')};
const text=(v,max=160)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))fail();return v};
const bool=v=>{if(typeof v!=='boolean')fail();return v};
const integer=v=>{if(!Number.isSafeInteger(v)||v<0)fail();return v};
const nullable=(v,parse)=>v===null?null:parse(v);
const time=v=>{text(v,40);if(!Number.isFinite(Date.parse(v)))fail();return v};
const enumOf=(v,values)=>{if(!values.includes(v))fail();return v};
const array=(v,parse,max=100)=>{if(!Array.isArray(v)||v.length>max)fail();return v.map(parse)};
const decimal=v=>{if(typeof v!=='string'||!/^[-]?(?:0|[1-9]\d{0,19})(?:\.\d{1,12})?$/.test(v))fail();return v};
const env=v=>enumOf(v,['demo','live']);
const provider=v=>enumOf(v,['binance','profit','mt5']);
export const unavailable=(reason='Fonte autorizada indisponível.')=>({status:'unavailable',reason,mode:null,observedAt:null,data:null});
export const available=(data,{mode='live',observedAt=new Date().toISOString()}={})=>({status:'available',mode,observedAt,data});
export function emptyOwnerState({platform,subject,now=Date.now()}){
 return {schema:STATE_SCHEMA,owner:{platform,subject},generatedAt:new Date(now).toISOString(),sections:Object.fromEntries(SECTION_NAMES.map(k=>[k,unavailable()])),capabilities:{liveExecutionVerified:false,realBillingVerified:false}};
}
function project(name,d){
 if(!d||typeof d!=='object')fail();
 switch(name){
 case 'configuration':return {id:text(d.id),createdAt:time(d.createdAt),markets:array(d.markets,m=>({id:text(m.id,20),provider:nullable(m.provider??null,provider),currency:text(m.currency,10),capital:nullable(m.capital,v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)fail();return v}),leverage:nullable(m.leverage,v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)fail();return v})}),10)};
 case 'entitlement':return {planName:text(d.planName),status:enumOf(d.status,['active','pending','blocked','expired']),ultraIncluded:bool(d.ultraIncluded),periodEnd:nullable(d.periodEnd,time),performanceRate:enumOf(d.performanceRate,[null,10,20])};
 case 'wallet':{
  const w={currency:enumOf(d.currency,['BRL']),balanceMinor:nullable(d.balanceMinor,integer),reservedMinor:nullable(d.reservedMinor,integer),availableMinor:nullable(d.availableMinor,integer),debitAuthorized:bool(d.debitAuthorized)};
  if(w.availableMinor!==null&&(w.balanceMinor===null||w.reservedMinor===null||w.balanceMinor-w.reservedMinor!==w.availableMinor))fail();return w;
 }
 case 'cycles':return array(d,c=>({id:text(c.id),phase:text(c.phase,50),startedAt:time(c.startedAt),endedAt:nullable(c.endedAt,time),reservationMinor:nullable(c.reservationMinor,integer)}));
 case 'obligations':return array(d,o=>({id:text(o.id),month:text(o.month,7),currency:text(o.currency,10),amountMinor:nullable(o.amountMinor,integer),status:text(o.status,60)}));
 case 'runtime':return {phase:text(d.phase,60),canStart:bool(d.canStart),canPause:bool(d.canPause),reason:nullable(d.reason,v=>text(v,240))};
 case 'connections':return array(d,c=>({id:text(c.id),label:text(c.label,80),provider:provider(c.provider),environment:env(c.environment),status:text(c.status,60),lastObservedAt:nullable(c.lastObservedAt,time)}));
 case 'operations':return {rows:array(d.rows,o=>({id:text(o.id),connectionId:text(o.connectionId),environment:env(o.environment),currency:text(o.currency,10),symbol:text(o.symbol,50),state:text(o.state,50),side:enumOf(o.side,['buy','sell']),quantity:decimal(o.quantity),openedAt:nullable(o.openedAt,time),closedAt:nullable(o.closedAt,time),gross:nullable(o.gross,decimal),fees:nullable(o.fees,decimal),financing:nullable(o.financing,decimal),net:o.costsComplete===true?nullable(o.net,decimal):null,costsComplete:bool(o.costsComplete)}),200),hasMore:bool(d.hasMore),costsPending:nullable(d.costsPending??null,integer),summaries:array(d.summaries??[],r=>({connectionId:text(r.connectionId),environment:env(r.environment),currency:text(r.currency,10),period:enumOf(r.period,['today','7d','30d','90d','all']),operations:integer(r.operations),gains:decimal(r.gains),losses:decimal(r.losses),fees:decimal(r.fees),financing:decimal(r.financing),net:decimal(r.net)}),1000)};
 case 'feePolicy':return {canManage:bool(d.canManage),plans:array(d.plans,p=>({id:text(p.id),name:text(p.name),eligibility:enumOf(p.eligibility,['chargeable','exempt','pending']),enabled:nullable(p.enabled,bool),version:nullable(p.version,integer)}))};
 default:fail();
 }
}
export function validateOwnerState(raw,{platform,subject,now=Date.now(),maxAgeMs=60000}={}){
 if(raw?.schema!==STATE_SCHEMA||raw.owner?.platform!==platform||raw.owner?.subject!==subject)fail();
 time(raw.generatedAt);if(Date.parse(raw.generatedAt)>now+5000||now-Date.parse(raw.generatedAt)>maxAgeMs)fail();
 const result=emptyOwnerState({platform,subject,now});result.generatedAt=raw.generatedAt;
 result.capabilities={liveExecutionVerified:raw.capabilities?.liveExecutionVerified===true,realBillingVerified:raw.capabilities?.realBillingVerified===true};
 for(const name of SECTION_NAMES){
  const section=raw.sections?.[name];
  if(!section||section.status==='unavailable'){result.sections[name]=unavailable(section?.reason?text(section.reason,240):undefined);continue;}
  if(section.status!=='available')fail();time(section.observedAt);
  if(Date.parse(section.observedAt)>now+5000||now-Date.parse(section.observedAt)>maxAgeMs)fail();
  const mode=env(section.mode),data=project(name,section.data);
  if(name==='runtime'&&mode==='live'&&!result.capabilities.liveExecutionVerified){data.canStart=false;data.canPause=false;}
  if(name==='wallet'&&(mode==='demo'||!result.capabilities.realBillingVerified))data.debitAuthorized=false;
  result.sections[name]={status:'available',mode,observedAt:section.observedAt,data};
 }
 return result;
}
