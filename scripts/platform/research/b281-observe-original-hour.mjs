/** B281 single-attempt future-hour audit in CI. Before 17:05 UTC 21/10/2026
 * this script exits with an explicit PENDING result and does not fetch prices.
 * Rerun manually in a later GitHub workflow_dispatch if a real observation is
 * desired. This does not schedule or promise unattended work.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {
 auditB281OriginalSeal,readinessB281OriginalHour,fetchB281ReadOnlyOutcome,
 evaluateB281ObservedClosedHour,B281_B280_ANCHOR
} from '../../../lib/platform/research/b281-first-hour-observation.mjs';
const dir='.jenios-b281-ci',target=dir+'/B281_FIRST_HOUR_EVALUATION.json';
const input='docs/platform/evidence/B280_FORWARD_HOUR_SEALED_SNAPSHOT.json';
await mkdir(dir,{recursive:true});
const nowMs=Date.now();
const reportBase={
 schema:'JENIOS_B281_FIRST_HOUR_CAPTURE_ATTEMPT_V1',
 checkedAtMs:nowMs,checkedAt:new Date(nowMs).toISOString(),
 originalB280SealSha256:B281_B280_ANCHOR.sealSha256,
 b280Commit:B281_B280_ANCHOR.sourceCommit,
 b280RunId:B281_B280_ANCHOR.sourceRunId,
 b280TargetOpenMs:B281_B280_ANCHOR.targetOpenMs,
 b280TargetCloseMs:B281_B280_ANCHOR.targetCloseMs,
 eligibleForSourceObservationAfterMs:B281_B280_ANCHOR.minimumObservationAtMs,
 executedInGitHubSha:process.env.GITHUB_SHA??null,
 executedInGitHubRunId:Number(process.env.GITHUB_RUN_ID??0),
 spotOnlyUsd:true,customerBrokerConnected:false,
 originalProprietaryRobotsModified:false,
 originalB280ForecastRecomputed:false,
 automatedRealOrPaperOrders:0,positionsCreated:0,
 paymentsOrChargesCreated:0,liveTradingAllowed:false,
 marketDataProviderSigned:false,independentMarketSourceWitnessed:false,
 sourceRedistributionLicenseVerified:false,rawMarketCandlePricesArchived:false,
 performanceAdvantageCertified:false,deployAuthorized:false
};
let result={...reportBase,status:'FAIL_CLOSED_ORIGINAL_SEAL_NOT_READABLE',
 realOutcomeRetrieved:false,scenarioCount:0},exit=1;
try{
 const source=JSON.parse(await readFile(input,'utf8'));
 const anchor=auditB281OriginalSeal(source);
 const ready=readinessB281OriginalHour(source,{nowMs});
 if(!ready.candidateMayFetch){
  result={...reportBase,status:ready.status,
   originalSealValidated:anchor.valid,remainingMs:Math.max(0,
    ready.earliestObservationAtMs-nowMs),
   networkRequestsMade:0,
   realOutcomeRetrieved:false,scenarioCount:0,
   sourceIntegrityProven:false,statisticalSampleSize:0,
   noPrematurePredictionScoring:true,
   explanation:'A primeira hora ainda não encerrou ou não transcorreu a margem de cinco minutos. Nenhuma consulta ou avaliação ocorreu.'};
  exit=0;
  console.log('B281_FIRST_OUTCOME_PENDING',result.status,
   new Date(ready.earliestObservationAtMs).toISOString());
 }else{
  const candles=await fetchB281ReadOnlyOutcome(source,{
   nowMs, pause:()=>new Promise(resolve=>setTimeout(resolve,750))
  });
  const outcome=evaluateB281ObservedClosedHour(source,candles,{nowMs});
  result={...reportBase,status:'ONE_UNSIGNED_PUBLIC_FORWARD_HOUR_OBSERVED',
   originalSealValidated:true,realOutcomeRetrieved:true,
   provider:'coinbase_exchange_public_spot_candles',
   quoteCurrency:'USD',sourceIntegrityProven:false,
   sourceCandleHashes:outcome.sourceCandles,
   scenarioCount:outcome.scenarioCount,
   reportSha256:outcome.reportSha256,
   evaluation:outcome,
   statisticalSampleSize:1,
   oneHourOnly:true,provenFutureEdge:false,
   independentSourceConfirmationMissing:true,
   manualReviewRequired:true};
  exit=0;
  console.log('B281_FIRST_OUTCOME_STUDY_CREATED',
   outcome.scenarioCount,outcome.reportSha256,
   JSON.stringify(outcome.conservative30_30));
 }
}catch(e){
 const reason=typeof e?.code==='string'&&/^B281_[A-Z0-9_]+$/.test(e.code)?
  e.code:'B281_SOURCE_OR_AUDIT_UNAVAILABLE';
 result={...reportBase,status:'FAIL_CLOSED_NO_VALID_FORWARD_RESULT',reason,
  realOutcomeRetrieved:false,networkOutcomeAuthenticated:false,
  scenarioCount:0,statisticalSampleSize:0,
  explanation:'Não é permitido apresentar resultado de uma fonte indisponível, incompleta, prematura ou divergente.'};
 exit=1;
 console.error('B281_OUTCOME_UNAVAILABLE',reason);
}
await writeFile(target,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'w'});
console.log('B281_EVIDENCE_ARTIFACT',target,result.status);
process.exitCode=exit;
