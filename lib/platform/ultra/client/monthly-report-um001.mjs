/** UM001: monthly extension of the existing Ultra report. Pure, read-only.
 * Imported reports are observations, never payment authority or wallet balances.
 * No networking, persistence, trading, collection, entitlement or real debit.
 */
import {parseWorkspaceReport} from './workspace-report.mjs';
import {decimal8,format8} from './reporting.mjs';
import {operationNet} from '../operation.mjs';
const CENT=1000000n;
const SAFE=/^[A-Za-z0-9_.:-]{1,160}$/;
const REASONS=Object.freeze({
 MONTH_OPEN:'O mês ainda está em andamento.',
 SOURCE_COVERAGE_PENDING:'A cobertura completa da competência ainda não foi conciliada.',
 ACCOUNT_IDENTITY_PENDING:'O vínculo da conta com o cliente ainda precisa de confirmação.',
 COSTS_PENDING:'Há encerramentos com custos incompletos.',
 EXECUTION_UNCERTAIN:'Há execução ou envio com resultado a conferir.',
 PARTIAL_ALLOCATION_PENDING:'Há encerramento parcial sem apuração mensal confirmada.',
 DUPLICATE_CONFLICT:'Há registros divergentes ou referências repetidas que exigem conciliação.',
 HISTORICAL_POSITION_PENDING:'Falta o retrato da posição no encerramento deste mês.',
 NO_CLOSED_RESULT:'Não há resultado fechado com custos completos neste recorte.',
 AUTHORITATIVE_INTEGRATION_PENDING:'A integração autoritativa de apuração ainda não está ativa.',
 ULTRA_ATTRIBUTION_PENDING:'A atribuição das operações ao Ultra ainda precisa de conciliação.',
 MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED:'Falta confirmar a cobertura geral de contas do cliente neste mês.',
 PLAN_ELIGIBILITY_PENDING:'Falta confirmar a modalidade e o plano aplicável.',
 PRIOR_LOSS_POLICY_PENDING:'O tratamento de perdas de meses anteriores ainda não foi definido.',
 PLATFORM_COST_TREATMENT_PENDING:'Faltam os custos da plataforma e seu tratamento na base elegível.',
 BILLING_TIMEZONE_PENDING:'O fuso da competência de cobrança precisa de confirmação.',
 CURRENCY_CONVERSION_PENDING:'A emissão central ainda não tem conversão de moeda definida.',
 ROUNDING_POLICY_PENDING:'A precisão deste resultado exige regra de arredondamento confirmada.',
 EVIDENCE_PENDING:'Falta uma referência íntegra da memória de cálculo.',
 SOURCE_CUTOFF_PENDING:'O arquivo foi gerado antes do fim da competência.',
 NON_CLOSED_AMOUNTS_PENDING:'Há custos ou resultados de operações não fechadas cuja atribuição mensal precisa de conciliação.',
 OBSERVED_PRIOR_LOSS_PENDING:'Há resultado negativo anterior no histórico; seu tratamento precisa de confirmação.',
});
const reasons=codes=>[...new Set(codes)].map(code=>({code,label:REASONS[code]??code}));
function finiteTime(value){const t=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(t))throw Error('INVALID_MONTH_TIME');return t;}
function parts(value,timeZone){
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 return Object.fromEntries(formatter.formatToParts(new Date(finiteTime(value))).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function monthInZone(value,timeZone='America/Bahia'){
 const p=parts(value,timeZone);return `${p.year}-${String(p.month).padStart(2,'0')}`;
}
export function monthlyPeriod(month,timeZone='America/Bahia'){
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('INVALID_MONTH');
 const [year,mon]=month.split('-').map(Number);if(year<1970||year>2200)throw Error('INVALID_MONTH');
 function midnight(y,m){
  const target=Date.UTC(y,m-1,1);let guess=target;
  for(let i=0;i<5;i++){const p=parts(guess,timeZone);const actual=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);if(actual===target)return new Date(guess).toISOString();guess+=target-actual;}
  throw Error('UNSUPPORTED_MONTH_BOUNDARY');
 }
 return {month,timeZone,periodStart:midnight(year,mon),periodEnd:midnight(mon===12?year+1:year,mon===12?1:mon+1)};
}
function parseSource(source,now){
 if(!source||!SAFE.test(source.sourceId??'')||!['jenios','flow'].includes(source.platform))throw Error('INVALID_MONTHLY_SOURCE');
 const input=source.report;
 // Same explicit MT5/B3 validation path already present in R125. No symbol guessing.
 const mt5B3=input?.provider==='mt5'&&input.operations?.length>0&&input.operations.every(o=>o.market==='b3');
 const parsed=parseWorkspaceReport(mt5B3?{...input,provider:'profit'}:input,now);
 const report={...parsed,provider:input.provider};
 const accountKey=JSON.stringify([report.provider,report.environment,report.accountFingerprint??`unverified:${source.sourceId}`]);
 return {...source,report,accountKey};
}
function sum(rows,key,{requireAll=false}={}){
 if(!rows.length||requireAll&&rows.some(o=>o[key]===null))return null;
 const values=rows.filter(o=>o[key]!==null).map(o=>decimal8(o[key]));
 return values.length?format8(values.reduce((a,b)=>a+b,0n)):null;
}
function finalizedTotals(rows){
 if(!rows.length)return {gains:null,losses:null,gross:null,fees:null,financing:null,net:null};
 let gains=0n,losses=0n,fees=0n,financing=0n;
 for(const o of rows){const gross=decimal8(o.gross);if(gross>0n)gains+=gross;else losses-=gross;fees+=decimal8(o.fees);financing+=decimal8(o.financing);}
 return Object.fromEntries(Object.entries({gains,losses,gross:gains-losses,fees,financing,net:gains-losses-fees-financing}).map(([k,v])=>[k,format8(v)]));
}
function provisionalTotals(rows){
 const gross=sum(rows,'gross',{requireAll:true}),fees=sum(rows,'fees',{requireAll:true}),financing=sum(rows,'financing',{requireAll:true});
 return {gross,fees,financing,net:[gross,fees,financing].some(v=>v===null)?null:format8(decimal8(gross)-decimal8(fees)-decimal8(financing))};
}
function classify(o,start,end){
 const close=o.closedAt?Date.parse(o.closedAt):null,open=o.openedAt?Date.parse(o.openedAt):null;
 if(close!==null&&close>=start&&close<end)return o.costsComplete?'closed':'awaiting_costs';
 if(open!==null&&open<end&&(close===null||close>=end)){
  if(Date.parse(o.updatedAt)>=end)return 'open_at_period_end';
  return o.state==='partially_closed'?'partial':'open';
 }
 if(['sending','unknown'].includes(o.state)&&Date.parse(o.createdAt)<end)return 'uncertain';
 if(Date.parse(o.createdAt)>=start&&Date.parse(o.createdAt)<end&&['queued','cancelled','rejected'].includes(o.state))return 'non_realized';
 return null;
}

export function consolidateMonthlyReports(sources,{month,timeZone='America/Bahia',now=Date.now()}={}){
 if(!Array.isArray(sources)||!sources.length||sources.length>20)throw Error('INVALID_MONTHLY_SOURCES');
 const observedAt=finiteTime(now),period=monthlyPeriod(month??monthInZone(observedAt,timeZone),timeZone);
 const start=Date.parse(period.periodStart),end=Date.parse(period.periodEnd),parsed=sources.map(s=>parseSource(s,observedAt));
 if(new Set(parsed.map(s=>s.sourceId)).size!==parsed.length)throw Error('DUPLICATE_SOURCE_ID');
 if(parsed.reduce((n,s)=>n+s.report.operations.length,0)>20000)throw Error('MONTHLY_SOURCE_LIMIT');
 const identities=new Map(),refOwners=new Map(),accountSources=new Map();
 for(const source of parsed){
  const {report,accountKey}=source;
  if(!accountSources.has(accountKey))accountSources.set(accountKey,[]);accountSources.get(accountKey).push(source);
  for(const operation of report.operations){
   const key=JSON.stringify([accountKey,operation.id]);
   const provenance={sourceId:source.sourceId,platform:source.platform,provider:report.provider,generatedAt:report.generatedAt,operationId:operation.id,revision:operation.revision};
   const row=identities.get(key)??{key,accountKey,variants:new Map(),duplicates:0};
   const signature=JSON.stringify(operation);let variant=row.variants.get(signature);
   if(variant){variant.sources.push(provenance);row.duplicates++;}else row.variants.set(signature,{operation,sources:[provenance]});
   identities.set(key,row);
   for(const ref of operation.brokerRefs){const rk=JSON.stringify([accountKey,ref]);if(!refOwners.has(rk))refOwners.set(rk,new Set());refOwners.get(rk).add(key);}
  }
 }
 const ambiguous=new Set([...refOwners.values()].filter(ids=>ids.size>1).flatMap(ids=>[...ids]));
 const groups=new Map();
 for(const identity of identities.values()){
  const variants=[...identity.variants.values()],conflict=variants.length>1||ambiguous.has(identity.key),scopes=accountSources.get(identity.accountKey);
  const currencies=[...new Set(variants.map(v=>v.operation.currency))];
  for(const currency of currencies){
   const relevant=variants.filter(v=>v.operation.currency===currency&&classify(v.operation,start,end)!==null);if(!relevant.length)continue;
   const groupKey=JSON.stringify([identity.accountKey,currency]);let g=groups.get(groupKey);
   if(!g){const context=scopes[0].report;g={key:groupKey,accountKey:identity.accountKey,accountFingerprint:context.accountFingerprint??null,connectionLabel:context.connectionLabel,provider:context.provider,environment:context.environment,currency,sourceIds:scopes.map(s=>s.sourceId).sort(),counts:{closed:0,open:0,provisional:0,awaitingCosts:0,uncertain:0,duplicates:0,conflicts:0},operations:[],conflicts:[],codes:[],closedRows:[],pendingRows:[],unallocatedRows:[]};groups.set(groupKey,g);}
   // Divergence remains a conflict, not a chosen revision or a result.
   const selected=relevant.slice().sort((a,b)=>JSON.stringify(a.operation).localeCompare(JSON.stringify(b.operation)))[0];
   const o=selected.operation,classification=conflict?'conflict':classify(o,start,end);
   const provenance=variants.flatMap(v=>v.sources).sort((a,b)=>(a.sourceId+a.operationId).localeCompare(b.sourceId+b.operationId));
   g.counts.duplicates+=identity.duplicates;
   const projected={...o,operationKey:identity.key,net:classification==='closed'?operationNet(o):null,classification,provenance};
   if(conflict){g.counts.conflicts++;g.codes.push('DUPLICATE_CONFLICT');g.conflicts.push({operationKey:identity.key,variants});}
   else if(classification==='closed'){g.counts.closed++;g.closedRows.push(o);}
   else if(classification==='awaiting_costs'){g.counts.awaitingCosts++;g.counts.provisional++;g.pendingRows.push(o);g.codes.push('COSTS_PENDING');}
   else if(classification==='uncertain'){g.counts.uncertain++;g.codes.push('EXECUTION_UNCERTAIN');}
   else if(['open','partial','open_at_period_end'].includes(classification)){
    g.counts.open++;
    if(classification==='partial'){g.counts.provisional++;g.codes.push('PARTIAL_ALLOCATION_PENDING');}
    if(classification==='open_at_period_end'){
     g.codes.push('HISTORICAL_POSITION_PENDING');
     // Never display a later snapshot's amounts as a prior month's position.
     projected.gross=null;projected.fees=null;projected.financing=null;projected.unrealized=null;
     projected.observedState=o.state;projected.state='open';projected.observedClosedAt=o.closedAt;projected.closedAt=null;
    }
   }
   if(!['closed','awaiting_costs','conflict'].includes(classification)&&(!o.costsComplete||['gross','fees','financing'].some(k=>o[k]!==null&&decimal8(o[k])!==0n))){
    g.codes.push('NON_CLOSED_AMOUNTS_PENDING');g.unallocatedRows.push(o);
   }
   g.operations.push(projected);
  }
 }
 const output=[...groups.values()].map(g=>{
  const codes=[...g.codes,'SOURCE_COVERAGE_PENDING','ACCOUNT_IDENTITY_PENDING'];
  if(observedAt<end)codes.push('MONTH_OPEN');if(!g.closedRows.length)codes.push('NO_CLOSED_RESULT');
  const sameAccountSources=accountSources.get(g.accountKey);
  const sourceCutoffAt=new Date(Math.min(...sameAccountSources.map(s=>Date.parse(s.report.generatedAt)))).toISOString();
  if(Date.parse(sourceCutoffAt)<end)codes.push('SOURCE_CUTOFF_PENDING');
  const observedAccountKeys=[...new Set(parsed.filter(s=>s.report.environment===g.environment&&s.report.operations.some(o=>o.currency===g.currency)).map(s=>s.accountKey))].sort();
  const priorLossesObserved=[];
  for(const identity of identities.values())if(identity.accountKey===g.accountKey){
   for(const {operation:o} of identity.variants.values()){
    const net=operationNet(o);
    if(o.currency===g.currency&&o.closedAt&&Date.parse(o.closedAt)<start&&net!==null&&decimal8(net)<0n)priorLossesObserved.push({operationKey:identity.key,closedAt:o.closedAt,net});
   }
  }
  if(priorLossesObserved.length)codes.push('OBSERVED_PRIOR_LOSS_PENDING');
  const {codes:unused,closedRows,pendingRows,unallocatedRows,...rest}=g;
  return {...rest,sourceCutoffAt,observedAccountKeys,observedAccountCount:observedAccountKeys.length,priorLossesObserved,
   confirmed:finalizedTotals(closedRows),provisional:provisionalTotals(pendingRows),
   unallocatedCosts:{fees:sum(unallocatedRows,'fees'),financing:sum(unallocatedRows,'financing'),operationIds:unallocatedRows.map(o=>o.id)},
   finalNet:null,sourceComplete:false,independentlyVerified:false,pendingReasons:reasons(codes),operations:g.operations.sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)||a.id.localeCompare(b.id))};
 }).sort((a,b)=>a.key.localeCompare(b.key));
 const latestSource=parsed.reduce((a,b)=>Date.parse(a.report.generatedAt)>=Date.parse(b.report.generatedAt)?a:b);
 return {...period,periodClosed:observedAt>=end,generatedAt:latestSource.report.generatedAt,sourceComplete:false,independentlyVerified:false,groups:output,sourceCount:parsed.length,billable:false,debitExecuted:false,walletBalance:null};
}
export function monthlyReportView(report,options={}){
 const result=consolidateMonthlyReports([{sourceId:'local_report',platform:options.platform??'jenios',report}],options);
 return {...result,provider:report.provider,environment:report.environment,connectionLabel:report.connectionLabel,accountFingerprint:report.accountFingerprint??null};
}
function minor(value){const n=decimal8(value);return n%CENT===0n&&n/CENT<=BigInt(Number.MAX_SAFE_INTEGER)&&n/CENT>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n/CENT):null;}

/** Synthetic preparation only. Real imported files ALWAYS remain pending,
 * even if caller-supplied flags claim to be authoritative. */
export function assessMonthlyPerformance(group,{period,policy=null,evidence=null,syntheticOnly=false}={}){
 if(!group||!period||!Array.isArray(group.pendingReasons))throw Error('INVALID_MONTHLY_ASSESSMENT');
 const codes=group.pendingReasons.map(r=>r.code).filter(c=>!['SOURCE_COVERAGE_PENDING','ACCOUNT_IDENTITY_PENDING','NO_CLOSED_RESULT'].includes(c));
 if(syntheticOnly!==true)codes.push('AUTHORITATIVE_INTEGRATION_PENDING');
 if(evidence?.sourceComplete!==true||evidence?.brokerReconciled!==true)codes.push('SOURCE_COVERAGE_PENDING');
 if(evidence?.identityConfirmed!==true)codes.push('ACCOUNT_IDENTITY_PENDING');
 if(evidence?.ultraAttributionConfirmed!==true)codes.push('ULTRA_ATTRIBUTION_PENDING');
 if(evidence?.settlementScopeComplete!==true||policy?.aggregationScope!=='single_account_confirmed'||group.observedAccountCount!==1)codes.push('MONTHLY_SETTLEMENT_SCOPE_UNCONFIRMED');
 if(policy?.timeZone!==period.timeZone||!policy?.timezoneReference)codes.push('BILLING_TIMEZONE_PENDING');
 if(group.currency!=='BRL')codes.push('CURRENCY_CONVERSION_PENDING');
 const brokerNet=group.confirmed.net;
 let eligible=brokerNet===null?null:decimal8(brokerNet),platformCosts=null;
 const pc=evidence?.platformCosts;
 if(pc?.complete!==true||!pc?.treatmentReference||typeof pc?.eligibleAmount!=='string')codes.push('PLATFORM_COST_TREATMENT_PENDING');
 else {platformCosts=decimal8(pc.eligibleAmount);if(platformCosts<0n)throw Error('INVALID_PLATFORM_COSTS');if(eligible!==null)eligible-=platformCosts;}
 if(eligible===null)codes.push('NO_CLOSED_RESULT');
 const rate=policy?.mode==='individual'?2000:policy?.mode==='included'?1000:null;
 const planConfirmed=!!(policy?.version&&policy?.eligibilityReference&&(policy.mode==='individual'||policy.mode==='included'&&policy.planId));
 if(!planConfirmed||rate===null)codes.push('PLAN_ELIGIBILITY_PENDING');
 // No prior-loss rule is invented. A fixture can demonstrate a complete prior
 // history with no unresolved losses; other situations stay pending.
 if(eligible!==null&&eligible>0n&&!(evidence?.priorLosses?.status==='none_confirmed'&&evidence.priorLosses.reference))codes.push('PRIOR_LOSS_POLICY_PENDING');
 if(!/^[a-f0-9]{64}$/.test(evidence?.sha256??''))codes.push('EVIDENCE_PENDING');
 let performance=null;
 if(eligible!==null&&eligible<=0n)performance=0n;
 else if(eligible!==null&&rate!==null){const numerator=eligible*BigInt(rate);if(numerator%10000n!==0n)codes.push('ROUNDING_POLICY_PENDING');else performance=numerator/10000n;}
 const eligibleText=eligible===null?null:format8(eligible),feeText=performance===null?null:format8(performance);
 const eligibleMinor=eligibleText===null?null:minor(eligibleText),feeMinor=feeText===null?null:minor(feeText);
 if((eligibleText!==null&&eligibleMinor===null)||(feeText!==null&&feeMinor===null))codes.push('ROUNDING_POLICY_PENDING');
 const pending=reasons(codes),complete=pending.length===0;
 const status=!complete?'pending':eligible<=0n?'no_performance_due':'ready';
 return {schema:'ULTRA_MONTHLY_ASSESSMENT_UM001',status,synthetic_only:syntheticOnly===true,complete,
  eligible_profit_minor:eligibleMinor,rate_bps:rate,performance_minor:feeMinor,
  policy_version:policy?.version??null,evidence_sha256:evidence?.sha256??null,
  plan_eligibility_confirmed:planConfirmed,policy_resolution_confirmed:complete,
  pending_reasons:pending.map(p=>p.code),pendingReasons:pending,
  calculation:{month:period.month,timeZone:period.timeZone,currency:group.currency,environment:group.environment,accountKey:group.accountKey,
   gains:group.confirmed.gains,losses:group.confirmed.losses,brokerFees:group.confirmed.fees,financing:group.confirmed.financing,brokerNet,
   eligiblePlatformCosts:platformCosts===null?null:format8(platformCosts),eligibleProfit:eligibleText,rateBps:rate,performance:feeText,
   eligible_profit_minor:eligibleMinor,rate_bps:rate,performance_minor:feeMinor,
   formula:'ganhos brutos - perdas brutas - custos corretora - financiamento - custos elegíveis confirmados da plataforma',
   performanceFormula:'max(lucro elegível mensal, 0) × percentual',
   periodStart:period.periodStart,periodEnd:period.periodEnd,operationKeys:group.operations.map(o=>o.operationKey),
   subscriptionSeparate:true,annualSubscriptionWaivesPerformance:false,defiPerformanceSeparate:true},
  billable:false,chargeCreated:false,debitExecuted:false,realIntegration:false};
}
