/** B280 GitHub CI: register ONE future-hour research hypothesis set. No cron,
 * background promise, trade, client account, broker order or billing request.
 * A failure writes a fail-closed artifact with ZERO registered predictions.
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {
 B278_PRODUCTS,buildHistoricalPlan,collectPublicHistoricalPlan
} from '../../../lib/platform/research/b278-historical-ingest.mjs';
import {B280_FROZEN_PROTOCOL,sealB280ForwardForecasts}
 from '../../../lib/platform/research/b280-forward-protocol.mjs';
const H=3600000,dir='.jenios-b280-ci';
const artifact=dir+'/B280_FORWARD_HOUR_SEALED.json';
await mkdir(dir,{recursive:true});
const startedAtMs=Date.now(),endMs=Math.floor(startedAtMs/H)*H-H;
const fromMs=endMs-960*H;
const inputs={
 schema:'JENIOS_B280_REAL_FORWARD_RESEARCH_CAPTURE_ATTEMPT_V1',
 startedAt:new Date(startedAtMs).toISOString(),
 source:'coinbase_exchange_public_spot_candles',quoteCurrency:'USD',
 protocolSha256:B280_FROZEN_PROTOCOL.sha256,
 githubCommit:process.env.GITHUB_SHA??null,
 workflowRunId:Number(process.env.GITHUB_RUN_ID??0),
 historicEndMs:endMs,targetWasKnownAtCollection:false,
 futureObserved:false,brokerOrdersSubmitted:0,paperOrdersSubmitted:0,
 anyCustomerAccountConnected:false,noPaymentEvents:true,
 originalProprietaryRobotChanged:false,usableForLiveRobot:false,
 sourceSigned:false,independentWitnessedMarketTime:false,
 sourceRedistributionApproved:false,profitabilityVerified:false
};
let payload,exitCode=1;
try{
 const intakes=[];
 for(const item of B278_PRODUCTS){
  const plan=buildHistoricalPlan({product:item.id,startMs:fromMs,endMs,
   asOfMs:startedAtMs});
  const intake=await collectPublicHistoricalPlan(plan,{spacingMs:675});
  intakes.push(intake);
  console.log('B280_PUBLIC_USD_SPOT_PRE_FORECAST',item.id,
   intake.manifest.candlesSha256,intake.candles.length);
 }
 const sealed=sealB280ForwardForecasts(intakes,{
  receivedAtMs:Date.now(),
  gitCommitSha:inputs.githubCommit,
  workflowRunId:inputs.workflowRunId
 });
 payload={...inputs,status:'FORWARD_HOUR_HYPOTHESES_SEALED_BEFORE_TARGET',
  sealedResearch:sealed,
  nextOutcomeHasNotOccurred:true,
  statisticalSampleSize:0,profitabilityAssessed:false,
  sourceActualHistoricalDataLoaded:true,
  embargoOnTrading:true};
 exitCode=0;
 console.log('B280_FORWARD_FORECAST_CREATED',
  sealed.forecasts.length,new Date(sealed.targetCandleOpenMs).toISOString(),
  sealed.sealSha256);
}catch(error){
 const err=error?.code??error?.message;
 const code=typeof err==='string'&&/^(?:B278|B280)_[A-Z0-9_]+$/.test(err)?
  err:'B280_RESEARCH_CAPTURE_UNAVAILABLE';
 payload={...inputs,status:'FAIL_CLOSED_NO_PROSPECTIVE_PREDICTIONS',
  code,sourceActualHistoricalDataLoaded:false,
  statisticalSampleSize:0,nextOutcomeHasNotOccurred:true,
  noHypothesesRegistered:true};
 console.error('B280_FORWARD_SEAL_NOT_CREATED',code);
}
await writeFile(artifact,JSON.stringify(payload,null,2)+'\n',{mode:0o600});
console.log('B280_PROSPECTIVE_MANIFEST',artifact,payload.status);
process.exitCode=exitCode;
