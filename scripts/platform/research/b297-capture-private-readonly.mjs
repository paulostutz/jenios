/** B297 manual/offline CLI. Proprietary source stays OUTSIDE this public repo.
 * Needs JENIOS_B297_PRIVATE_CORE_DIR pointing to SHA-pinned engine.mjs/service.mjs.
 * Nothing is sent to network, broker, Paper broker, payments or Vercel.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {captureB297OriginalDecisions,verifyB297CaptureChain,
 inspectB297OperatorLifecycle,inspectB297B152Arithmetic,
 B297_ENGINE_SHA256,B297_SERVICE_SHA256} from '../../../lib/platform/research/b297-private-readonly-audit.mjs';
const fail=msg=>{throw new Error(msg);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const coreDir=process.env.JENIOS_B297_PRIVATE_CORE_DIR;
if(!coreDir)fail('B297_PRIVATE_SOURCE_DIR_REQUIRED');
for(const name of ['JENIOS_REAL_EXECUTION_ENABLED','JENIOS_PRIVATE_PAPER_TRANSPORT_ENABLED',
 'JENIOS_PRIVATE_PAPER_EXECUTOR'])if(process.env[name]==='true')fail('B297_EXECUTION_FLAG_PRESENT');
// Prevent a mistaken sourceMode=market request from reaching an external feed.
globalThis.fetch=async()=>fail('B297_NETWORK_FORBIDDEN');
const path=resolve(coreDir),enginePath=join(path,'engine.mjs'),servicePath=join(path,'service.mjs');
const [engineBytes,serviceBytes]=await Promise.all([readFile(enginePath),readFile(servicePath)]);
const engineSha256=hash(engineBytes),serviceSha256=hash(serviceBytes);
if(engineSha256!==B297_ENGINE_SHA256||serviceSha256!==B297_SERVICE_SHA256)
 fail('B297_ORIGINAL_EXECUTABLE_HASH_MISMATCH');
const engine=await import(pathToFileURL(enginePath).href);
const service=await import(pathToFileURL(servicePath).href);
if(typeof engine.chooseMode!=='function'||typeof engine.assertNoLiveExecution!=='function'||
 typeof service.analyzeRequest!=='function')fail('B297_ORIGINAL_EXPORTS_MISSING');
let liveDenied=false;try{engine.assertNoLiveExecution();}catch(error){
 liveDenied=error?.code==='LIVE_DISABLED';
}
if(!liveDenied)fail('B297_LIVE_EXECUTION_NOT_DISABLED');
const nowMs=Date.now();
const scenarios=['day','swing'].flatMap(horizon=>['manual','hybrid','reverse'].flatMap(mode=>
 ['buy','sell'].map(intent=>({id:`B297-${horizon}-${mode}-${intent}`,horizon,mode,intent}))));
const capture=await captureB297OriginalDecisions({analyzeRequest:service.analyzeRequest,scenarios,nowMs});
const chain=verifyB297CaptureChain(capture);
const trend=direction=>({side:direction,regime:{kind:'trend',direction},
 higherRegime:{kind:'trend',direction}});
const nonMega=direction=>({side:direction,regime:{kind:'trend',direction},higherRegime:{kind:'flat'}});
const directChecks=[
 ['reverse-buy-to-sell','reverse','buy',nonMega('buy'),'consider_reverse','reverse_preview','sell'],
 ['reverse-sell-to-buy','reverse','sell',nonMega('sell'),'consider_reverse','reverse_preview','buy'],
 ['reverse-unverified-calibration','reverse','buy',nonMega('buy'),'observe','reverse_not_calibrated',null],
 ['mega-trend-preserve','reverse','buy',trend('buy'),'consider_reverse','preserve_trend_aligned_intent','buy'],
 ['mega-trend-veto','reverse','sell',trend('buy'),'consider_reverse','suggest_trend_aligned_preview','buy'],
 ['manual-original','manual','buy',nonMega('buy'),'observe','manual_preview','buy'],
 ['hybrid-original','hybrid','sell',nonMega('buy'),'observe','hybrid_preview','buy']
].map(([id,mode,intent,scan,recommendation,action,side])=>{
 const actual=engine.chooseMode({mode,intent,scan,calibration:{recommendation}});
 if(actual.action!==action||actual.side!==side)fail('B297_ORIGINAL_CHOOSE_MODE_INVARIANT_FAILED:'+id);
 return {id,mode,intent,action:actual.action,side:actual.side,decisionSha256:hash(JSON.stringify(actual))};
});
const pause=engine.chooseMode({mode:'reverse',intent:'buy',scan:nonMega('buy'),
 calibration:{recommendation:'consider_reverse'},paused:true});
const position=engine.chooseMode({mode:'reverse',intent:'buy',scan:nonMega('buy'),
 calibration:{recommendation:'consider_reverse'},positionOpen:true});
if(pause.action!=='pause_new_entries'||position.action!=='manage_existing_position'||
 pause.side!==null||position.side!==null)fail('B297_PAUSE_OR_POSITION_GUARD_FAILED');
const events=[
 {eventId:'B297-op1',referenceId:'r1',action:'open',side:'buy',atMs:nowMs-800,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'B297-op2',referenceId:'r1',action:'cancel',side:'buy',atMs:nowMs-700,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'B297-op3',referenceId:'r2',action:'open',side:'sell',atMs:nowMs-600,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'B297-op4',referenceId:'r2',action:'close',side:'sell',atMs:nowMs-500,authorization:'LAB_FIXTURE_ONLY'},
 {eventId:'B297-op5',referenceId:'r3',action:'open',side:'buy',atMs:nowMs-400,authorization:'LAB_FIXTURE_ONLY',megaTrendDirection:'buy'},
 {eventId:'B297-op6',referenceId:'r3',action:'close',side:'buy',atMs:nowMs-300,authorization:'LAB_FIXTURE_ONLY'}
];
const lifecycle=inspectB297OperatorLifecycle(events,{nowMs});
if(lifecycle.events.filter(x=>x.action==='open').map(x=>x.referenceSide).join(',')!=='sell,buy,buy')
 fail('B297_OFFLINE_LIFECYCLE_POLICY_FAILED');
const instrument={provider:'alpaca',id:'BTC-USD',marketType:'spot',base:'BTC',quote:'USD',
 settlement:'USD',contractSize:'1',qtyStep:'0.01',minQty:'0.01',maxQty:'2',
 tickSize:'0.01',capturedAtMs:nowMs,sourceSha256:'a'.repeat(64),quantityUnit:'base'};
const order={clientOrderId:'B297-math-1',mode:'direct',side:'buy',quantity:'0.10',
 entry:'100',stop:'95',target:'115'};
const options={now:nowMs,roundTripFeeBps:20,slippageBps:10,fundingCost:'0'};
const positive=inspectB297B152Arithmetic(order,instrument,options);
if(positive.ordersSent!==0||positive.paperOrdersSent!==0)fail('B297_ARITHMETIC_NOT_READONLY');
const riskRejections=[];
for(const [id,o,m,opt] of [
 ['spot-short',{...order,side:'sell',stop:'105',target:'85'},instrument,options],
 ['invalid-protective-stop',{...order,stop:'105'},instrument,options],
 ['quantity-off-step',{...order,quantity:'0.105'},instrument,options],
 ['metadata-stale',order,{...instrument,capturedAtMs:nowMs-86400001},options],
 ['fee-overlimit',order,instrument,{...options,roundTripFeeBps:1001}]
]){
 let rejected=false,reason=null;try{inspectB297B152Arithmetic(o,m,opt);}catch(error){rejected=true;reason=error?.code||error?.message;}
 if(!rejected)fail('B297_RISK_FAILURE_NOT_BLOCKED:'+id);
 riskRejections.push({id,rejected,reason});
}
const evidence={schema:'JENIOS_B297_PRIVATE_LAB_REPORT_V1',
 createdAtMs:Date.now(),engineSha256,serviceSha256,
 checkedOriginalFileBytes:true,loadedOriginalFunctions:true,
 independentRuntimeAttestation:false,closedSyntheticSourceOnly:true,
 analysisCount:capture.entries.length,analysisCounts:capture.counts,
 decisionActions:capture.entries.map(x=>({id:x.id,mode:x.commercialMode,
  intent:x.operatorIntent,action:x.action,side:x.suggestedSide,hash:x.rawOutputSha256})),
 chainFinalSha256:chain.finalEntrySha256,chainVerified:true,
 originalChooseModeChecks:directChecks,
 pausedAndPositionGuardsVerified:true,
 syntheticLifecycleCount:lifecycle.events.length,
 lifecycleCancelClosePassThrough:lifecycle.cancelsAndClosesNeverInverted,
 b152AcceptedArithmetic:{riskUnits:positive.riskUnits,notionalUnits:positive.notionalUnits,
  settlement:positive.settlement},b152RejectedCases:riskRejections,
 liveExecutionGuardVerified:liveDenied,
 operatorFeedConnected:false,operatorConsentObserved:false,
 deliveryProviderAcknowledged:false,realPositionReconciled:false,
 independentMarketData:false,profitabilityVerified:false,
 lossometerActuallyAvoided:null,ordersSent:0,paperOrdersSent:0,
 paymentsCreated:0,deploymentsCreated:0,
 caution:'Execucao genuina do core original com inputs sinteticos e isolamento local; sem corretoras, sinais externos ou transacoes.'};
const outputFile=process.env.JENIOS_B297_EVIDENCE_JSON;
if(outputFile)await writeFile(resolve(outputFile),JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
process.stdout.write(JSON.stringify(evidence,null,2)+'\n');