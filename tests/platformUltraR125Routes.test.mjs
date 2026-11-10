import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {ultraProvidersForMarket,ultraRouteForMarket,ultraRouteSelection} from '../lib/platform/ultra/routes-r125.mjs';
import {ULTRA_MARKETS,ULTRA_PRODUCT_SCOPE,normalizeUltraConfig,assessUltraLeverage,ultraConnectionReadiness} from '../lib/platform/ultra/policy-r125.mjs';
import {normalizeUltraConfig as normalizePrevious,assessUltraLeverage as assessPrevious} from '../lib/platform/ultra/policy.mjs';
import {rankUltraCandidates} from '../lib/platform/ultra/selection.mjs';
import {ultraInstrumentScopeR125,rankUltraCandidatesR125} from '../lib/platform/ultra/scope-r125.mjs';
import {exportClientPlan as exportPreviousPlan} from '../lib/platform/ultra/client/plan.mjs';
import {CLIENT_SCHEMA_R125,exportClientPlanR125,validateClientPlanR125,clientRoutesR125} from '../lib/platform/ultra/client/plan-r125.mjs';
import {parseWorkspaceReport,workspaceReportView} from '../lib/platform/ultra/client/workspace-report.mjs';
import {parseLocalReport,buildLocalDashboard,reportCsv} from '../lib/platform/ultra/client/reporting.mjs';
import {parseWorkspaceReportR125,workspaceReportViewR125,parseLocalReportR125,buildLocalDashboardR125,reportCsvR125} from '../lib/platform/ultra/client/report-r125.mjs';
import {initialOperation} from '../lib/platform/ultra/operation.mjs';
import {ultraHttp,ultraReviewDigest} from '../lib/platform/ultra/http.mjs';
import {devicesHttp} from '../lib/platform/ultra/operations-http.mjs';
import {inspectPlanR125,main as clientMain} from '../scripts/platform/ultra/client-r125.mjs';

const now=Date.parse('2026-11-10T15:00:00Z'),at=offset=>new Date(now+offset).toISOString();
const market=(id='b3',provider)=>({id,capital:1000,leverage:1,currency:id==='b3'?'BRL':id==='crypto'?'USDT':'USD',...(provider===undefined?{}:{provider})});
const config=(markets=[market()])=>({markets,sessionMinutes:60,maxPositions:3,tradeRiskPct:.25,dailyLossPct:2,maxAssetPct:20,excludedSymbols:[]});
const withoutProviders=c=>({...c,markets:c.markets.map(({provider,...m})=>m)});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const quote=(symbol='WINZ26',family='mini_index')=>({market:'b3',symbol,marketOpen:true,observedAtMs:now,liquidityVerified:true,volatilityBps:40,spreadBps:1,depthUsd:3e6,fillProbability:.9,roundTripCostBps:3,adverseSelectionBps:1,stabilityRatio:.9,instrument:{evidence:'broker_metadata',symbol,observedAtMs:now,venue:'B3',kind:'future',family,expiryMs:now+86400000}});
const cryptoQuote=(kind='spot')=>({...quote(),market:'crypto',symbol:'BTCUSDT',instrument:{evidence:'broker_metadata',symbol:'BTCUSDT',observedAtMs:now,venue:'binance',kind,eligibility:{product:kind==='spot'?'spot':'usds_m_futures',status:'eligible',accountFingerprint:'a'.repeat(64),observedAtMs:now}}});
const closed=(id='trade-1',patch={})=>({...initialOperation({market:'b3',symbol:'WINZ26',currency:'BRL',side:'buy',quantity:'1'},id,now-3000),state:'closed',openedAt:at(-2000),closedAt:at(-1000),updatedAt:at(-1000),entryQuantity:'1',exitQuantity:'1',entryPrice:'100',exitPrice:'110',gross:'10.00000001',fees:'-0.1',financing:'0.2',costsComplete:true,...patch});
const workspace=(operations=[closed()],provider='mt5')=>({schema:'JENIOS_ULTRA_OPERATIONS_V1',provider,environment:'demo',connectionLabel:'Conta fictícia B3',generatedAt:at(0),operations});
const receipt=(id='receipt-1',patch={})=>({id,market:'b3',symbol:'WINZ26',currency:'BRL',side:'buy',openedAt:at(-2000),closedAt:at(-1000),gross:'10.00000001',fees:'1',financing:'-0.1',complete:true,source:'broker',...patch});
const local=(operations=[receipt()],provider='mt5')=>({...workspace(operations,provider),schema:'JENIOS_ULTRA_LOCAL_REPORT_V1'});
const viewOptions={period:'all',now:new Date(now)};

test('R125 routes distinguish broker, market and terminal without granting connection or execution',()=>{
 assert.deepEqual(ULTRA_MARKETS.map(m=>m.id),['b3','crypto']);
 assert.deepEqual(ULTRA_PRODUCT_SCOPE,['mini_index','mini_usd','crypto_spot','crypto_futures']);
 assert.deepEqual(ultraProvidersForMarket('b3').map(r=>[r.provider,r.broker]),[['mt5','genial'],['profit','genial']]);
 assert.equal(ultraRouteForMarket('b3').provider,'mt5');
 assert.equal(ultraRouteForMarket('crypto').provider,'pending');
 assert.equal(ultraRouteForMarket('crypto','binance').broker,'binance');
 for(const m of ['b3','crypto'])for(const provider of ultraProvidersForMarket(m).map(r=>r.provider)){
  const r=ultraRouteSelection({market:m,provider});
  assert.equal(r.routeConfirmed,false);assert.equal(r.accountConnected,false);assert.equal(r.canStart,false);assert.equal(r.executionAvailable,false);
  assert.equal(r.credentialLocation,'trader_device');assert.equal(r.brokerApprovalPerRobotRequired,null);assert.ok(Object.isFrozen(r));
 }
 assert.equal(ultraRouteForMarket('crypto','pending').broker,'genial');
 assert.match(ultraRouteForMarket('crypto','pending').label,/pendente/);
 assert.equal(ultraRouteForMarket('crypto','pending').guide,null);
 assert.ok(Object.isFrozen(ultraProvidersForMarket('b3')[0].requirements));
});
test('R125 routes reject cross-market providers, retired Forex and prototype names',()=>{
 for(const m of ['forex','unknown','__proto__','constructor',null])assert.throws(()=>ultraProvidersForMarket(m),/ULTRA_MARKET_INVALID/);
 for(const [m,p] of [['b3','binance'],['b3','pending'],['crypto','mt5'],['crypto','profit'],['b3','MT5'],['crypto','unknown']])assert.throws(()=>ultraRouteForMarket(m,p),/ULTRA_MARKET_PROVIDER_MISMATCH/);
});
test('R125 policy adds only route metadata and preserves previous normalization and risk arithmetic',()=>{
 const input=freeze({...config([{...market('crypto','binance'),leverage:100},{...market('b3','profit'),leverage:20}]),excludedSymbols:['wdox26','WINZ26','WINZ26']});
 const before=JSON.stringify(input),current=assessUltraLeverage(input),previous=assessPrevious(withoutProviders(input));
 assert.deepEqual(withoutProviders(current.config),normalizePrevious(withoutProviders(input)));
 assert.deepEqual(current.markets.map(({provider,...m})=>m),previous.markets);
 for(const key of ['warnings','requiresAcknowledgement','explanation','liveExecutionEnabled'])assert.deepEqual(current[key],previous[key]);
 assert.equal(current.policyVersion,'ultra-r125-routes-1');assert.equal(current.liveExecutionEnabled,false);
 assert.equal(JSON.stringify(input),before);
});
test('R125 route defaults and advisory leverage never imply account readiness',()=>{
 const c=normalizeUltraConfig(config([market('b3'),market('crypto')]));
 assert.deepEqual(c.markets.map(m=>m.provider),['mt5','pending']);
 for(const leverage of [1,20,100,1000]){
  const a=assessUltraLeverage(config([{...market('b3','mt5'),leverage}]));
  assert.equal(a.markets[0].exposure,1000*leverage);assert.equal(a.markets[0].scenarios[2].loss,50*leverage);assert.equal(a.liveExecutionEnabled,false);
 }
 const readiness=ultraConnectionReadiness(config([market('b3','profit'),market('crypto','pending')]));
 assert.deepEqual(readiness.map(r=>r.provider),['profit','pending']);
 assert.ok(readiness.every(r=>r.connected===false&&r.canStart===false&&r.status==='awaiting_connection'));
});
test('R125 config refuses unsupported markets, providers and hidden fields without relaxing old bounds',()=>{
 for(const invalid of [config([market('forex')]),config([market('b3','binance')]),config([market('crypto','profit')]),config([market('b3',null)]),config([market('b3',2)]),config([{...market(),product:'stock'}]),config([{...market(),capital:1.001}]),config([{...market(),leverage:1001}]),config([market(),market()]),{...config(),executionAuthorization:true}])assert.throws(()=>normalizeUltraConfig(invalid),{status:400});
});

test('R125 scope allows only exact native WIN/WDO contracts with unexpired matching metadata',()=>{
 for(const q of [quote(),quote('WDOX26','mini_usd')])assert.deepEqual(ultraInstrumentScopeR125(freeze(q),now),{allowed:true,family:q.instrument.family,executionAuthorized:false});
 for(const q of [quote('WIN$'),quote('WINZ'),quote('WINZ2026'),quote('WINZ26.extra'),quote('winz26'),quote('PETR4'),quote('INDZ26'),quote('DOLX26'),quote('WINZ26','mini_usd'),quote('WDOX26','mini_index')])assert.equal(ultraInstrumentScopeR125(q,now).allowed,false);
 for(const patch of [{venue:'CME'},{kind:'spot'},{expiryMs:now},{expiryMs:now-1},{expiryMs:undefined},{symbol:'WDOX26'}])assert.equal(ultraInstrumentScopeR125({...quote(),instrument:{...quote().instrument,...patch}},now).allowed,false);
});
test('R125 scope requires fresh broker evidence and never guesses from a symbol',()=>{
 for(const patch of [{evidence:'client_guess'},{evidence:undefined},{observedAtMs:now-5001},{observedAtMs:now+1},{observedAtMs:'2026-11-10'},{observedAtMs:null},{symbol:undefined}])assert.deepEqual(ultraInstrumentScopeR125({...quote(),instrument:{...quote().instrument,...patch}},now),{allowed:false,reason:'NATIVE_INSTRUMENT_EVIDENCE_REQUIRED'});
 for(const q of [null,{}, {...quote(),instrument:null}])assert.equal(ultraInstrumentScopeR125(q,now).allowed,false);
 assert.equal(ultraInstrumentScopeR125({...quote(),instrument:{...quote().instrument,observedAtMs:now-5000}},now).allowed,true);
 assert.equal(ultraInstrumentScopeR125(quote(),now+.5).allowed,false);
});
test('R125 crypto Spot and Futures require separate fresh eligibility for the named Binance product',()=>{
 for(const kind of ['spot','future']){
  const q=cryptoQuote(kind),e=q.instrument.eligibility;
  assert.deepEqual(ultraInstrumentScopeR125(q,now),{allowed:true,family:kind==='spot'?'crypto_spot':'crypto_futures',executionAuthorized:false});
  for(const patch of [{product:kind==='spot'?'usds_m_futures':'spot'},{product:'coin_m_futures'},{status:'unknown'},{status:'ineligible'},{accountFingerprint:'bad'},{accountFingerprint:undefined},{observedAtMs:now-5001},{observedAtMs:now+1},{observedAtMs:null}])assert.equal(ultraInstrumentScopeR125({...q,instrument:{...q.instrument,eligibility:{...e,...patch}}},now).allowed,false);
  for(const patch of [{venue:'genial'},{venue:'BINANCE'},{eligibility:null}])assert.equal(ultraInstrumentScopeR125({...q,instrument:{...q.instrument,...patch}},now).allowed,false);
 }
 assert.equal(ultraInstrumentScopeR125({...cryptoQuote(),instrument:{...cryptoQuote().instrument,kind:'option'}},now).allowed,false);
 assert.equal(ultraInstrumentScopeR125({...quote(),market:'forex'},now).allowed,false);
});
test('R125 scoped candidates reuse R53 scores and existing liquidity, freshness and exclusion blockers',()=>{
 const cfg=config([market('b3','mt5'),market('crypto','binance')]);
 const rows=freeze([quote(),quote('WDOX26','mini_usd'),cryptoQuote()]);
 assert.deepEqual(rankUltraCandidatesR125(cfg,rows,now),rankUltraCandidates(withoutProviders(cfg),rows,now));
 const invalid={...quote('PETR4'),instrument:{...quote('PETR4').instrument,kind:'stock'}};
 assert.deepEqual(rankUltraCandidatesR125(cfg,[...rows,invalid],now),rankUltraCandidates(withoutProviders(cfg),rows,now));
 for(const patch of [{liquidityVerified:false},{observedAtMs:now-1001},{marketOpen:false}])assert.equal(rankUltraCandidatesR125(cfg,[{...quote(),...patch}],now)[0].eligible,false);
 assert.deepEqual(rankUltraCandidatesR125({...cfg,excludedSymbols:['WINZ26']},[quote()],now)[0].blockers,['ASSET_EXCLUDED']);
 assert.ok(rankUltraCandidatesR125(cfg,[quote(),quote()],now).every(r=>r.blockers.includes('DUPLICATE_INSTRUMENT')));
 assert.deepEqual(rankUltraCandidatesR125(config([market('b3')]),[cryptoQuote()],now),[]);
 assert.throws(()=>rankUltraCandidatesR125(cfg,null,now),/INVALID_OBSERVATIONS/);
});
test('R125 pending Genial crypto never inherits Binance eligibility or becomes an executable candidate',()=>{
 const observations=[cryptoQuote(),cryptoQuote('future')];
 for(const provider of [undefined,'pending'])assert.deepEqual(rankUltraCandidatesR125(config([market('crypto',provider)]),observations,now),[]);
 assert.equal(rankUltraCandidatesR125(config([market('crypto','binance')]),[cryptoQuote()],now)[0].eligible,true);
 assert.deepEqual(rankUltraCandidatesR125(config([market('b3'),market('crypto')]),[quote(),cryptoQuote()],now).map(r=>r.market),['b3']);
});
test('R125 scoped rank validates the original bounded input before filtering',()=>{
 for(const observations of [null,{},[null],[[]],[1],Array.from({length:1001},()=>({market:'forex'}))])assert.throws(()=>rankUltraCandidatesR125(config(),observations,now),/INVALID_OBSERVATIONS/);
 for(const invalidNow of [undefined,NaN,Infinity,now+.5,String(now)])assert.throws(()=>rankUltraCandidatesR125(config(),[],invalidNow),/INVALID_OBSERVATIONS/);
 assert.deepEqual(rankUltraCandidatesR125(config(),Array.from({length:1000},()=>({market:'forex'})),now),[]);
});

test('R125 client plan round-trip declares explicit routes and never authorizes execution',()=>{
 const input=freeze({config:config([market('b3','profit'),market('crypto','binance')]),risk_acknowledged:false});
 const plan=exportClientPlanR125(input);
 assert.equal(plan.schema,CLIENT_SCHEMA_R125);assert.equal(plan.version,'R125');assert.equal(plan.executionAuthorization,false);assert.equal(plan.credentialLocation,'trader_device');
 assert.deepEqual(validateClientPlanR125(plan),plan);assert.deepEqual(plan.brokers,['binance','genial']);assert.deepEqual(plan.productScope,ULTRA_PRODUCT_SCOPE);
 assert.deepEqual(clientRoutesR125(plan).map(r=>r.provider),['profit','binance']);assert.ok(clientRoutesR125(plan).every(r=>r.canStart===false&&r.executionAvailable===false));
});
test('R125 plan names only selected brokers and leaves Binance an explicit alternative',()=>{
 for(const [markets,brokers] of [[[market('b3'),market('crypto')],['genial']],[[market('b3','profit')],['genial']],[[market('crypto','pending')],['genial']],[[market('crypto','binance')],['binance']],[[market('b3','mt5'),market('crypto','binance')],['binance','genial']]]){
  const plan=exportClientPlanR125({config:config(markets)});assert.deepEqual(plan.brokers,brokers);assert.deepEqual(validateClientPlanR125(plan),plan);
  for(const altered of [[],[...brokers,brokers[0]],['unknown'],brokers.includes('genial')?['binance']:['genial']])assert.throws(()=>validateClientPlanR125({...plan,brokers:altered}),/INVALID_CLIENT_PLAN_BROKERS/);
 }
});
test('R125 high leverage acknowledgement preserves advisories and grants no trading capability',()=>{
 const high=config([{...market('b3','mt5'),leverage:100}]);
 assert.throws(()=>exportClientPlanR125({config:high,risk_acknowledged:false}),/alavancagem/);
 const p=exportClientPlanR125({config:high,risk_acknowledged:true});assert.equal(p.riskAcknowledged,true);assert.equal(p.executionAuthorization,false);
 assert.throws(()=>validateClientPlanR125({...p,riskAcknowledged:false}),/alavancagem/);
});
test('R125 old B3 client plans migrate to Profit without changing budgets, risk or source',()=>{
 const old=freeze(exportPreviousPlan({config:config([{...market('b3'),leverage:20}]),risk_acknowledged:true})),before=JSON.stringify(old);
 const migrated=validateClientPlanR125(old);
 assert.equal(migrated.schema,CLIENT_SCHEMA_R125);assert.equal(migrated.config.markets[0].provider,'profit');assert.equal(migrated.riskAcknowledged,true);
 assert.deepEqual(withoutProviders(migrated.config),old.config);assert.equal(clientRoutesR125(old)[0].provider,'profit');assert.equal(JSON.stringify(old),before);
});
test('R125 legacy Forex or crypto requires explicit review instead of silently changing strategy or product',()=>{
 for(const markets of [[market('forex')],[market('crypto')],[market('b3'),market('crypto')],[market('b3'),market('forex')]]){
  const old=exportPreviousPlan({config:config(markets),risk_acknowledged:false});
  assert.throws(()=>validateClientPlanR125(old),/LEGACY_PLAN_REVIEW_REQUIRED/);
 }
 const old=exportPreviousPlan({config:config(),risk_acknowledged:false});
 assert.throws(()=>validateClientPlanR125({...old,config:config([market('b3','mt5')])}),/LEGACY_PLAN_CANNOT_DECLARE_ROUTE/);
});
test('R125 client plan rejects execution flags, changed manifests, credentials and malformed route declarations',()=>{
 const plan=exportClientPlanR125({config:config()});
 for(const patch of [{schema:'other'},{version:'R116'},{executionAuthorization:true},{executionAuthorization:undefined},{credentialLocation:'server'},{riskAcknowledged:'false'},{brokers:['binance']},{productScope:['mini_index']},{apiKey:'synthetic-forbidden-field'},{config:config([market('b3','binance')])}])assert.throws(()=>validateClientPlanR125({...plan,...patch}));
 assert.throws(()=>validateClientPlanR125(null));assert.throws(()=>exportClientPlanR125({}));
});

test('R125 B3 MT5 workspace wrapper preserves exact old accounting and the original provider without mutation',()=>{
 const input=freeze({...workspace([closed(),closed('loss',{gross:'-3',fees:'1',financing:'0.2'})]),accountFingerprint:'b'.repeat(64)}),before=JSON.stringify(input);
 const previous={...input,provider:'profit'},actual=workspaceReportViewR125(input,viewOptions);
 assert.deepEqual(parseWorkspaceReportR125(input,now),{...parseWorkspaceReport(previous,now),provider:'mt5'});
 assert.deepEqual(actual,{...workspaceReportView(previous,viewOptions),provider:'mt5'});
 assert.equal(actual.totals[0].net,'5.70000001');assert.equal(actual.totals[0].losses,'4.20000000');
 assert.equal(actual.walletBalance,null);assert.equal(actual.brokerBalance,null);assert.equal(actual.currentConnectionConfirmed,false);assert.equal(actual.platformCosts.billable,false);
 assert.equal(JSON.stringify(input),before);assert.equal(actual.operations[0].market,'b3');
});
test('R125 local B3 MT5 receipts, dashboard and CSV reuse old exact accounting and formula safety',()=>{
 const input=freeze({...local([receipt(),receipt('loss',{gross:'-3',fees:'1',financing:'0.2'})]),connectionLabel:'=SUM(1,1)'}),before=JSON.stringify(input),previous={...input,provider:'profit'};
 assert.deepEqual(parseLocalReportR125(input),{...parseLocalReport(previous),provider:'mt5'});
 const actual=buildLocalDashboardR125(input,viewOptions);
 assert.deepEqual(actual,buildLocalDashboard(previous,viewOptions));assert.equal(actual.totals[0].net,'4.90000001');assert.equal(actual.independentlyVerified,false);
 assert.equal(reportCsvR125(input,viewOptions),reportCsv(previous,viewOptions));assert.ok(reportCsvR125(input,viewOptions).includes("'=SUM(1,1)"));
 assert.equal(JSON.stringify(input),before);
});
test('R125 report wrappers preserve pending/open states and incomplete costs without invented profit',()=>{
 const pending=closed('pending',{fees:null,costsComplete:false}),partial=closed('partial',{state:'partially_closed',closedAt:null,exitQuantity:'0.5'}),uncertain=initialOperation({market:'b3',symbol:'WDOX26',currency:'BRL',side:'sell',quantity:'1'},'unknown',now-1000);
 const result=workspaceReportViewR125(workspace([pending,partial,{...uncertain,state:'unknown'}]),viewOptions);
 assert.deepEqual(result.totals,[]);assert.equal(result.awaitingCosts,1);assert.equal(result.openCount,1);assert.equal(result.uncertainCount,1);assert.ok(result.operations.every(o=>o.net===null));
});
test('R125 wrappers retain existing Forex and Binance history and empty reports unchanged',()=>{
 for(const [provider,m,symbol,currency] of [['mt5','forex','EURUSD','USD'],['binance','crypto','BTCUSDT','USDT'],['profit','b3','PETR4','BRL']]){
  const w=workspace([closed('history',{market:m,symbol,currency})],provider),l=local([receipt('history',{market:m,symbol,currency})],provider);
  assert.deepEqual(parseWorkspaceReportR125(w,now),parseWorkspaceReport(w,now));assert.deepEqual(workspaceReportViewR125(w,viewOptions),workspaceReportView(w,viewOptions));
  assert.deepEqual(parseLocalReportR125(l),parseLocalReport(l));assert.deepEqual(buildLocalDashboardR125(l,viewOptions),buildLocalDashboard(l,viewOptions));
 }
 assert.deepEqual(workspaceReportViewR125(workspace([]),viewOptions),workspaceReportView(workspace([]),viewOptions));
});
test('R125 MT5 wrappers reject mixed markets instead of consolidating or relabeling the file',()=>{
 for(const other of ['forex','crypto']){
  const input=workspace([closed(),closed('other',{market:other,symbol:'EURUSD',currency:'USD'})]);
  assert.throws(()=>parseWorkspaceReportR125(input,now));assert.throws(()=>workspaceReportViewR125(input,viewOptions));
  const old=local([receipt(),receipt('other',{market:other,symbol:'EURUSD',currency:'USD'})]);
  assert.throws(()=>parseLocalReportR125(old));assert.throws(()=>buildLocalDashboardR125(old,viewOptions));assert.throws(()=>reportCsvR125(old,viewOptions));
 }
});
test('R125 report wrappers cannot bypass duplicate, credential, timestamp or market validation',()=>{
 for(const input of [workspace([closed(),closed()]),{...workspace(),apiKey:'synthetic-forbidden-field'},workspace([closed('future',{updatedAt:at(1000)})]),workspace([closed()],'binance')])assert.throws(()=>parseWorkspaceReportR125(input,now));
 for(const input of [local([receipt(),receipt()]),{...local(),apiKey:'synthetic-forbidden-field'},local([receipt('future',{closedAt:at(1000)})]),local([receipt()],'binance')])assert.throws(()=>parseLocalReportR125(input));
});

const authorization='Bearer '+'x'.repeat(24);
const post=body=>new Request('https://www.jenios.com.br/api/platform/ultra',{method:'POST',headers:{authorization,'content-type':'application/json',origin:'https://www.jenios.com.br'},body:JSON.stringify(body)});
function database(saved=[]){
 const calls=[],writes=[],report={totals:[],lifetime:[],operations:[],days:[],count:0,unrealized:null};
 const db={auth:{getUser:async()=>({data:{user:{id:'fixture-owner'}}})},from:table=>({
  select:()=>({eq:(column,value)=>{calls.push({table,column,value});return {order:()=>({limit:async()=>({data:saved})})};}}),
  insert:row=>{writes.push({table,row});return {select:()=>({single:async()=>({data:{id:'new-plan',...row}})})};}
 }),rpc:async(name,args)=>{calls.push({name,args});return {data:report};}};
 return {db,calls,writes,report};
}
test('R125 HTTP evaluate and save bind the explicit provider into the reviewed digest',async()=>{
 const f=database(),options={getAdmin:()=>f.db},cfg=config([market('b3','mt5')]);
 const evaluated=await ultraHttp(post({action:'evaluate',config:cfg}),options);assert.equal(evaluated.status,200);const e=await evaluated.json();
 assert.equal(e.assessment.config.markets[0].provider,'mt5');assert.equal(e.liveExecutionEnabled,false);assert.equal(f.writes.length,0);
 const changed={...cfg,markets:[market('b3','profit')]};assert.notEqual(ultraReviewDigest(assessUltraLeverage(cfg)),ultraReviewDigest(assessUltraLeverage(changed)));
 assert.equal((await ultraHttp(post({action:'save',config:changed,reviewDigest:e.reviewDigest}),options)).status,409);
 const result=await ultraHttp(post({action:'save',config:cfg,reviewDigest:e.reviewDigest}),options);assert.equal(result.status,201);assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].row.user_id,'fixture-owner');assert.equal(f.writes[0].row.policy_version,'ultra-r125-routes-1');assert.deepEqual(f.writes[0].row.config,e.assessment.config);assert.equal((await result.json()).liveExecutionEnabled,false);
});
test('R125 HTTP still blocks start and rejects new Forex or mismatched providers without writes',async()=>{
 const f=database(),options={getAdmin:()=>f.db};
 for(const cfg of [config([market('forex')]),config([market('b3','binance')]),config([market('crypto','mt5')])])assert.equal((await ultraHttp(post({action:'evaluate',config:cfg}),options)).status,400);
 const res=await ultraHttp(post({action:'start'}),options),body=await res.json();assert.equal(res.status,409);assert.equal(body.liveExecutionEnabled,false);assert.ok(body.connections.every(c=>c.canStart===false&&c.connected===false));assert.equal(f.writes.length,0);
});
test('R125 HTTP retains risk acknowledgement, session identity and same-origin guards',async()=>{
 const f=database(),options={getAdmin:()=>f.db},cfg=config([{...market('b3','mt5'),leverage:100}]),assessment=assessUltraLeverage(cfg),body={action:'save',config:cfg,reviewDigest:ultraReviewDigest(assessment),riskAcknowledged:false};
 assert.equal((await ultraHttp(post(body),options)).status,409);
 const noSession=new Request(post(body),{headers:{'content-type':'application/json',origin:'https://www.jenios.com.br'}});assert.equal((await ultraHttp(noSession,options)).status,401);
 const foreign=new Request(post(body),{headers:{authorization,'content-type':'application/json',origin:'https://other.invalid'}});assert.equal((await ultraHttp(foreign,options)).status,403);assert.equal(f.writes.length,0);
});
test('R125 HTTP history remains accessible for saved legacy Forex plans without rewriting history',async()=>{
 const legacyConfig=config([market('forex')]),legacy=freeze({id:'historical-plan',config:legacyConfig,assessment:assessPrevious(legacyConfig),risk_acknowledged:false,created_at:at(-86400000)}),before=JSON.stringify(legacy),f=database([legacy]);
 const r=await ultraHttp(new Request('https://www.jenios.com.br/api/platform/ultra?period=all',{headers:{authorization}}),{getAdmin:()=>f.db,now:()=>new Date(now)});
 assert.equal(r.status,200,'retired plan scope must not break read-only historical GET');
 const body=await r.json();assert.deepEqual(body.plan,legacy);assert.deepEqual(body.report,f.report);assert.equal(body.liveExecutionEnabled,false);assert.equal(f.writes.length,0);assert.equal(JSON.stringify(legacy),before);
 assert.ok(body.connections.every(c=>c.canStart===false&&c.connected===false&&c.reviewRequired===true));assert.equal(f.calls.find(c=>c.name==='jenios_ultra_financial_report').args.p_user_id,'fixture-owner');
});
test('R125 HTTP preserves Profit in historical B3 plans with no route metadata',async()=>{
 const saved={id:'legacy-b3-plan',config:config([market('b3')]),risk_acknowledged:false},f=database([saved]);
 const r=await ultraHttp(new Request('https://www.jenios.com.br/api/platform/ultra',{headers:{authorization}}),{getAdmin:()=>f.db,now:()=>new Date(now)});assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.connections.find(c=>c.id==='b3').provider,'profit');assert.deepEqual(body.plan,saved);assert.equal(body.plan.config.markets[0].provider,undefined);assert.equal(f.writes.length,0);
});
test('R125 HTTP history preserves saved MT5 and Profit route choices while remaining disconnected',async()=>{
 for(const provider of ['mt5','profit']){
  const saved={id:'r125-plan',config:normalizeUltraConfig(config([market('b3',provider)])),risk_acknowledged:false},f=database([saved]);
  const r=await ultraHttp(new Request('https://www.jenios.com.br/api/platform/ultra',{headers:{authorization}}),{getAdmin:()=>f.db,now:()=>new Date(now)});assert.equal(r.status,200);const body=await r.json();
  assert.equal(body.connections.find(c=>c.id==='b3').provider,provider);assert.deepEqual(body.plan,saved);assert.equal(f.writes.length,0);
 }
});
test('R125 per-device HTTP accepts B3 MT5 receipts and keeps authenticated account scoping',async()=>{
 const id='11111111-1111-4111-8111-111111111111',calls=[],operation=closed();
 const db={auth:{getUser:async()=>({data:{user:{id:'fixture-owner'}}})},from:table=>({select:()=>{const filters=[],q={eq(k,v){filters.push([k,v]);return q;},order(){return q;},async limit(){calls.push({table,filters});return table==='jenios_ultra_devices'?{data:[{id,label:'MT5 B3 fictício',provider:'mt5',market:'b3',environment:'demo'}]}:{data:[{payload:operation}],count:1};}};return q;}})};
 const req=new Request('https://www.jenios.com.br/api/platform/ultra/devices?environment=demo&period=all&deviceId='+id,{headers:{authorization}}),r=await devicesHttp(req,{getAdmin:()=>db,now:()=>new Date(now)});
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.report.provider,'mt5');assert.equal(body.report.totals[0].net,'9.90000001');assert.equal(body.report.accountScope,'single_sync_connection');assert.equal(body.report.independentlyVerified,false);
 assert.ok(calls.every(c=>c.filters.some(([k,v])=>k==='user_id'&&v==='fixture-owner')));assert.ok(calls[1].filters.some(([k,v])=>k==='device_id'&&v===id));
 assert.equal(body.report.operations[0].provider,'mt5');assert.equal(body.report.operations[0].market,'b3');
});

function planFile(t,plan){const dir=mkdtempSync(join(tmpdir(),'ultra-r125-plan-')),file=join(dir,'plan.json');t.after(()=>rmSync(dir,{recursive:true,force:true}));writeFileSync(file,JSON.stringify(plan));return file;}
test('R125 CLI inspects only a local plan, leaves its bytes unchanged and exposes no execution command',t=>{
 const plan=exportClientPlanR125({config:config([market('b3','profit'),market('crypto','binance')])}),file=planFile(t,plan),before=readFileSync(file);
 const result=inspectPlanR125(file);assert.equal(result.ok,true);assert.equal(result.version,'R125');assert.equal(result.executionAvailable,false);assert.equal(result.credentialLocation,'trader_device');
 assert.deepEqual(result.markets,plan.config.markets);assert.deepEqual(result.routes.map(r=>r.provider),['profit','binance']);assert.deepEqual(clientMain(['plan',file]),result);assert.deepEqual(readFileSync(file),before);
 for(const args of [[],['plan'],['plan',file,'extra'],['start',file],['run',file],['trade',file],['cancel',file],['close',file],['connect',file],['upload',file]])assert.throws(()=>clientMain(args),/USAGE_CLIENT_R125_PLAN_FILE/);
});
test('R125 CLI keeps legacy B3 on Profit but refuses legacy Forex and crypto for review',t=>{
 for(const m of ['b3','forex','crypto']){
  const file=planFile(t,exportPreviousPlan({config:config([market(m)])}));
  if(m==='b3')assert.equal(inspectPlanR125(file).routes[0].provider,'profit');else assert.throws(()=>inspectPlanR125(file),/LEGACY_PLAN_REVIEW_REQUIRED/);
 }
});
test('R125 CLI validates bounded local JSON and sanitizes executable-process errors',t=>{
 const file=planFile(t,exportClientPlanR125({config:config()}));
 let run=spawnSync(process.execPath,['scripts/platform/ultra/client-r125.mjs','plan',file],{encoding:'utf8'});assert.equal(run.status,0);assert.equal(JSON.parse(run.stdout).executionAvailable,false);assert.equal(run.stderr,'');
 writeFileSync(file,'x'.repeat(16001));assert.throws(()=>inspectPlanR125(file),/PLAN_TOO_LARGE/);
 writeFileSync(file,'{"syntheticPrivateMarker":"do-not-echo",');assert.throws(()=>inspectPlanR125(file));
 run=spawnSync(process.execPath,['scripts/platform/ultra/client-r125.mjs','plan',file],{encoding:'utf8'});assert.equal(run.status,1);assert.equal(run.stdout,'');assert.deepEqual(JSON.parse(run.stderr),{ok:false,error:'INVALID_LOCAL_PLAN',executionAvailable:false});assert.equal(run.stderr.includes(file),false);assert.equal(run.stderr.includes('do-not-echo'),false);
});

// Next can exit zero after missing-export warnings. Check the exact named
// imports used by changed UI sources rather than relying on its exit code.
test('R125 changed UI named imports resolve to actual module exports',async()=>{
 const {readFileSync}=await import('node:fs');
 for(const file of ['PlatformUltraControl.js','PlatformUltraLocal.js','UltraAccountReport.js']){
  const url=new URL('../app/components/platform/'+file,import.meta.url),source=readFileSync(url,'utf8');
  for(const match of source.matchAll(/import \{([^}]+)\} from '([^']+\.mjs)'/g)){
   const exported=await import(new URL(match[2],url).href);
   for(const specifier of match[1].split(',')){const name=specifier.trim().split(/\s+as\s+/)[0];assert.ok(Object.hasOwn(exported,name),file+': missing export '+name);}
  }
 }
});
