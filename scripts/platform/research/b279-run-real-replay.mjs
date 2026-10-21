/** B279: replay exactly the UTC H1 B278 960-bar period from public read-only source.
 * Never archive OHLCV, contact a customer broker, or assert profitability.
 * A mismatched B278 source SHA fails closed; do not silently promote new candles.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {buildHistoricalPlan,collectPublicHistoricalPlan,B278_PRODUCTS} from '../../../lib/platform/research/b278-historical-ingest.mjs';
import {B279_FROZEN_B278_REFERENCE,B279_FROZEN_PROTOCOL,evaluateB279FrozenHistory} from '../../../lib/platform/research/b279-retrospective-replay.mjs';
const outDir='.jenios-b279-ci';
const path=outDir+'/B279_RETROSPECTIVE_REPLAY.json';
const at=new Date().toISOString();
const base={schema:'JENIOS_B279_REAL_RETROSPECTIVE_REPLAY_ATTEMPT_V1',at,
 b278SourceCommit:B279_FROZEN_B278_REFERENCE.b278Commit,
 b278RunId:B279_FROZEN_B278_REFERENCE.b278RunId,
 b278CollectedAt:B279_FROZEN_B278_REFERENCE.b278CollectedAt,
 protocolSha256:B279_FROZEN_PROTOCOL.sha256,
 frozenInputSha256:B279_FROZEN_B278_REFERENCE.frozenSha256Rows,
 source:'coinbase_exchange_public_spot_candles',
 pairCurrency:'USD',canMapToUsdtRobot:false,
 historicalHoldoutPreRegistered:false,
 futureProspectiveEvidenceCollected:false,
 statisticalAdvantageCertified:false,
 trainedProprietaryRobot:false,
 proprietaryRobotCoreChanged:false,
 actualTradesExecuted:false,ordersSent:0,paperOrdersSent:0,
 rawCandleDataRedistributed:false,sourceLicenseIndependentlyReviewed:false,
 dataProviderSignedAttestation:false,independentSecondProviderVerified:false,
 simulatedStopFillGuaranteed:false,brokerSlippageAndFundingModeled:false,
 liveTradingEnabled:false,deployAllowed:false};
await mkdir(outDir,{recursive:true});
let output,code=1;
try{
 const intakes=[];
 for(const row of B278_PRODUCTS){
  const period=B279_FROZEN_B278_REFERENCE;
  const plan=buildHistoricalPlan({product:row.id,startMs:period.startMs,
   endMs:period.endMs,asOfMs:Date.now()});
  const intake=await collectPublicHistoricalPlan(plan,{spacingMs:750});
  const expected=period.frozenSha256Rows.find(x=>x.product===row.id).sha256;
  console.log('B279_RESAMPLED_DIGEST',row.id,intake.manifest.candlesSha256,
   intake.manifest.candlesSha256===expected?'MATCH':'NOT_MATCH');
  if(intake.manifest.candlesSha256!==expected)
   throw Object.assign(Error('B279_B278_HISTORICAL_SHA_MISMATCH'),{code:'B279_B278_HISTORICAL_SHA_MISMATCH'});
  intakes.push(intake);
 }
 const report=evaluateB279FrozenHistory(intakes);
 output={...base,status:'REPLAY_COMPLETED_B278_SHA_MATCHED',
  sourceHashesMatched:true,realPublicHistoricalSeriesRead:true,
  observedHistoricalCandleCounts:intakes.map(x=>({product:x.manifest.product,count:x.manifest.received,
   sha256:x.manifest.candlesSha256,startMs:x.manifest.startMs,endMs:x.manifest.endMs})),
  replayClassification:report.classification,period:report.period,
  hypothesisIds:report.hypotheses,modes:report.modes,
  researchRows:report.scenarios,
  scenarioCount:report.scenarioRows,
  retrospectiveResearchOnly:true,noOperationalPermission:true,
  analysisLimitations:report.caveat};
 code=0;
 console.log('B279_SHA_MATCHED_RETROSPECTIVE_REPLAY_COMPLETE',report.scenarioRows);
}catch(error){
 const err=error?.code??error?.message;
 const reason=typeof err==='string'&&/^(?:B278|B279)_[A-Z0-9_]+$/.test(err)?
  err:'B279_EXTERNAL_REPLAY_UNAVAILABLE';
 output={...base,status:'REPLAY_FAILED_CLOSED_NO_VERIFIED_B278_HISTORY',
  reason,sourceHashesMatched:false,
  realPublicHistoricalSeriesRead:false,
  scenarioCount:0,researchRows:[],
  retrospectiveResearchOnly:true,noOperationalPermission:true,
  note:'No historical trade outcomes accepted. CI code success does NOT mean source data has passed replay.'};
 console.error('B279_REPLAY_FAILED_CLOSED',reason);
}
await writeFile(path,JSON.stringify(output,null,2)+'\n',{mode:0o600});
console.log('B279_REPLAY_MANIFEST',path,output.status);
process.exitCode=code;
